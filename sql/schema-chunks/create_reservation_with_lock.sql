-- Enhanced function to create reservation with comprehensive locking
-- This function prevents concurrent booking conflicts using advisory locks and SELECT FOR UPDATE
CREATE OR REPLACE FUNCTION create_reservation_with_lock(
  p_shop_id UUID,
  p_user_id UUID,
  p_reservation_date DATE,
  p_reservation_time TIME,
  p_special_requests TEXT DEFAULT NULL,
  p_points_used INTEGER DEFAULT 0,
  p_services JSONB DEFAULT '[]'::JSONB,
  p_lock_timeout INTEGER DEFAULT 10000,
  p_deposit_amount INTEGER DEFAULT NULL,
  p_remaining_amount INTEGER DEFAULT NULL
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
  v_advisory_lock_acquired BOOLEAN := FALSE;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_result JSONB;
  v_advisory_lock_key BIGINT;
  v_deadlock_retry_count INTEGER := 0;
  v_max_deadlock_retries INTEGER := 3;
  v_deposit_amount INTEGER;
  v_remaining_amount INTEGER;
  -- Enhanced deposit calculation variables
  v_default_deposit_percentage DECIMAL(5,2) := 25.0;
  v_min_deposit_amount INTEGER := 10000;
  v_max_deposit_amount INTEGER := 100000;
  v_total_service_deposit INTEGER := 0;
  v_service_deposit INTEGER := 0;
  v_deposit_percentage DECIMAL(5,2);
  v_service_deposit_amount INTEGER;
BEGIN
  -- Set lock timeout
  SET lock_timeout = p_lock_timeout;
  
  -- Generate advisory lock key based on shop_id, date, and time
  -- This ensures only one reservation can be created for the same slot at a time
  v_advisory_lock_key := ('x' || substr(md5(p_shop_id::text || p_reservation_date::text || p_reservation_time::text), 1, 8))::bit(32)::bigint;
  
  -- Start transaction with retry logic for deadlocks
  LOOP
    BEGIN
      -- Acquire advisory lock for this specific time slot
      IF NOT pg_try_advisory_xact_lock(v_advisory_lock_key) THEN
        RAISE EXCEPTION 'ADVISORY_LOCK_TIMEOUT: Unable to acquire advisory lock for time slot % at %', p_reservation_time, p_reservation_date;
      END IF;
      v_advisory_lock_acquired := TRUE;
      
      -- Check for conflicting reservations with FOR UPDATE lock
      -- Now includes both 'requested' and 'confirmed' status as per v3.1 flow
      SELECT COUNT(*) INTO v_conflicting_reservations
      FROM reservations r
      JOIN reservation_services rs ON r.id = rs.reservation_id
      JOIN shop_services s ON rs.service_id = s.id
      WHERE r.shop_id = p_shop_id
        AND r.reservation_date = p_reservation_date
        AND r.status IN ('requested', 'confirmed', 'in_progress')
        AND (
          -- Check for time overlap with 15-minute buffer
          (r.reservation_time <= p_reservation_time AND 
           r.reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > p_reservation_time)
          OR
          (p_reservation_time <= r.reservation_time AND 
           p_reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > r.reservation_time)
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
        
        -- Get service details with FOR UPDATE to prevent concurrent modifications
        SELECT price_min, duration_minutes INTO v_price, v_duration_minutes
        FROM shop_services
        WHERE id = v_service_id
        FOR UPDATE;
        
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
      
      -- Calculate deposit and remaining amounts with enhanced business rules
      -- Calculate service-specific deposits
      FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
      LOOP
        v_service_id := (v_service_data->>'serviceId')::UUID;
        v_quantity := (v_service_data->>'quantity')::INTEGER;
        
        -- Get service deposit policy
        SELECT 
          price_min,
          COALESCE(deposit_amount, 0) as deposit_amount,
          COALESCE(deposit_percentage, 0) as deposit_percentage
        INTO v_price, v_service_deposit_amount, v_deposit_percentage
        FROM shop_services
        WHERE id = v_service_id;
        
        -- Calculate service-specific deposit
        IF v_service_deposit_amount > 0 THEN
          -- Fixed deposit amount per service
          v_service_deposit := v_service_deposit_amount * v_quantity;
        ELSIF v_deposit_percentage > 0 THEN
          -- Percentage-based deposit
          v_service_deposit := ROUND((v_price * v_quantity * v_deposit_percentage) / 100);
        ELSE
          -- Default deposit calculation (25% of service price)
          v_service_deposit := ROUND((v_price * v_quantity * v_default_deposit_percentage) / 100);
        END IF;
        
        -- Apply business rules constraints
        v_service_deposit := GREATEST(v_min_deposit_amount, LEAST(v_service_deposit, v_max_deposit_amount));
        
        -- Ensure deposit doesn't exceed service total
        v_service_deposit := LEAST(v_service_deposit, v_price * v_quantity);
        
        v_total_service_deposit := v_total_service_deposit + v_service_deposit;
      END LOOP;
      
      -- Final deposit calculation
      IF p_deposit_amount IS NOT NULL AND p_remaining_amount IS NOT NULL THEN
        -- Use provided amounts (validate against total)
        v_deposit_amount := LEAST(p_deposit_amount, v_total_amount);
        v_remaining_amount := v_total_amount - v_deposit_amount;
      ELSE
        -- Use calculated service deposits
        v_deposit_amount := LEAST(v_total_service_deposit, v_total_amount);
        v_remaining_amount := v_total_amount - v_deposit_amount;
      END IF;

      -- Create reservation
      INSERT INTO reservations (
        shop_id,
        user_id,
        reservation_date,
        reservation_time,
        status,
        total_amount,
        deposit_amount,
        remaining_amount,
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
        v_deposit_amount,
        v_remaining_amount,
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
        SELECT price_min INTO v_price
        FROM shop_services
        WHERE id = v_service_id;
        
        -- Insert reservation service
        INSERT INTO reservation_services (
          reservation_id,
          service_id,
          quantity,
          unit_price,
          total_price
        ) VALUES (
          v_reservation_id,
          v_service_id,
          v_quantity,
          v_price,
          v_price * v_quantity
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
        'depositAmount', r.deposit_amount,
        'remainingAmount', r.remaining_amount,
        'pointsUsed', r.points_used,
        'specialRequests', r.special_requests,
        'createdAt', r.created_at,
        'updatedAt', r.updated_at
      ) INTO v_result
      FROM reservations r
      WHERE r.id = v_reservation_id;
      
      -- Exit the retry loop on success
      EXIT;
      
    EXCEPTION
      WHEN deadlock_detected THEN
        -- Handle deadlock with exponential backoff retry
        v_deadlock_retry_count := v_deadlock_retry_count + 1;
        
        IF v_deadlock_retry_count > v_max_deadlock_retries THEN
          RAISE EXCEPTION 'DEADLOCK_RETRY_EXCEEDED: Maximum deadlock retry attempts exceeded';
        END IF;
        
        -- Rollback current transaction and wait before retry
        ROLLBACK;
        v_advisory_lock_acquired := FALSE;
        v_lock_acquired := FALSE;
        
        -- Exponential backoff: wait 100ms * 2^retry_count
        PERFORM pg_sleep(0.1 * power(2, v_deadlock_retry_count - 1));
        
        -- Continue to retry
        CONTINUE;
        
      WHEN OTHERS THEN
        -- Check if it's a lock timeout error
        IF SQLSTATE = '55P03' THEN
          RAISE EXCEPTION 'LOCK_TIMEOUT: Unable to acquire required locks within timeout period';
        END IF;
        
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
  END LOOP;
  
  RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_reservation_with_lock TO authenticated;

-- Add comment
COMMENT ON FUNCTION create_reservation_with_lock IS 'Creates a reservation with pessimistic locking to prevent concurrent booking conflicts'; 