-- Function to create reservation with pessimistic locking
-- This function prevents concurrent booking conflicts using SELECT FOR UPDATE
CREATE OR REPLACE FUNCTION create_reservation_with_lock(
  p_shop_id UUID,
  p_user_id UUID,
  p_reservation_date DATE,
  p_reservation_time TIME,
  p_special_requests TEXT DEFAULT NULL,
  p_points_used INTEGER DEFAULT 0,
  p_services JSONB,
  p_lock_timeout INTEGER DEFAULT 10000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
  v_service_record RECORD;
  v_service_data JSONB;
  v_service_id UUID;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_duration_minutes INTEGER;
  v_conflicting_reservations INTEGER;
  v_lock_acquired BOOLEAN := FALSE;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_result JSONB;
BEGIN
  -- Set lock timeout
  SET lock_timeout = p_lock_timeout;
  
  -- Start transaction
  BEGIN
    -- Check for conflicting reservations with FOR UPDATE lock
    SELECT COUNT(*) INTO v_conflicting_reservations
    FROM reservations r
    JOIN reservation_services rs ON r.id = rs.reservation_id
    JOIN services s ON rs.service_id = s.id
    WHERE r.shop_id = p_shop_id
      AND r.reservation_date = p_reservation_date
      AND r.status IN ('confirmed', 'in_progress')
      AND (
        -- Check for time overlap
        (r.reservation_time <= p_reservation_time AND 
         r.reservation_time + INTERVAL '1 minute' * s.duration_minutes > p_reservation_time)
        OR
        (p_reservation_time <= r.reservation_time AND 
         p_reservation_time + INTERVAL '1 minute' * s.duration_minutes > r.reservation_time)
      )
    FOR UPDATE;
    
    -- If conflicts found, raise error
    IF v_conflicting_reservations > 0 THEN
      RAISE EXCEPTION 'SLOT_CONFLICT: Time slot is not available due to existing reservations';
    END IF;
    
    -- Calculate total amount and validate services
    FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      v_service_id := (v_service_data->>'serviceId')::UUID;
      v_quantity := (v_service_data->>'quantity')::INTEGER;
      
      -- Get service details
      SELECT price, duration_minutes INTO v_price, v_duration_minutes
      FROM services
      WHERE id = v_service_id;
      
      IF NOT FOUND THEN
        RAISE EXCEPTION 'SERVICE_NOT_FOUND: Service with ID % does not exist', v_service_id;
      END IF;
      
      -- Validate quantity
      IF v_quantity <= 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be greater than 0';
      END IF;
      
      -- Add to total amount
      v_total_amount := v_total_amount + (v_price * v_quantity);
    END LOOP;
    
    -- Validate points usage
    IF p_points_used < 0 THEN
      RAISE EXCEPTION 'INVALID_POINTS: Points used cannot be negative';
    END IF;
    
    IF p_points_used > v_total_amount THEN
      RAISE EXCEPTION 'INSUFFICIENT_AMOUNT: Points used cannot exceed total amount';
    END IF;
    
    -- Create reservation
    INSERT INTO reservations (
      shop_id,
      user_id,
      reservation_date,
      reservation_time,
      status,
      total_amount,
      points_used,
      special_requests,
      created_at,
      updated_at
    ) VALUES (
      p_shop_id,
      p_user_id,
      p_reservation_date,
      p_reservation_time,
      'requested',
      v_total_amount,
      p_points_used,
      p_special_requests,
      NOW(),
      NOW()
    ) RETURNING id INTO v_reservation_id;
    
    -- Create reservation services
    FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
    LOOP
      v_service_id := (v_service_data->>'serviceId')::UUID;
      v_quantity := (v_service_data->>'quantity')::INTEGER;
      
      -- Get service price
      SELECT price INTO v_price
      FROM services
      WHERE id = v_service_id;
      
      -- Insert reservation service
      INSERT INTO reservation_services (
        reservation_id,
        service_id,
        quantity,
        price
      ) VALUES (
        v_reservation_id,
        v_service_id,
        v_quantity,
        v_price
      );
    END LOOP;
    
    -- Mark lock as acquired
    v_lock_acquired := TRUE;
    
    -- Return reservation data
    SELECT jsonb_build_object(
      'id', r.id,
      'shopId', r.shop_id,
      'userId', r.user_id,
      'reservationDate', r.reservation_date,
      'reservationTime', r.reservation_time,
      'status', r.status,
      'totalAmount', r.total_amount,
      'pointsUsed', r.points_used,
      'specialRequests', r.special_requests,
      'createdAt', r.created_at,
      'updatedAt', r.updated_at
    ) INTO v_result
    FROM reservations r
    WHERE r.id = v_reservation_id;
    
    RETURN v_result;
    
  EXCEPTION
    WHEN OTHERS THEN
      -- If lock was acquired but error occurred, we need to clean up
      IF v_lock_acquired AND v_reservation_id IS NOT NULL THEN
        -- Delete any created reservation services
        DELETE FROM reservation_services WHERE reservation_id = v_reservation_id;
        -- Delete the reservation
        DELETE FROM reservations WHERE id = v_reservation_id;
      END IF;
      
      -- Re-raise the exception
      RAISE;
  END;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_reservation_with_lock TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_reservation_with_lock IS 'Creates a reservation with pessimistic locking to prevent concurrent booking conflicts'; 