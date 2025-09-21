-- Function: reschedule_reservation
-- Handles reservation rescheduling with transaction management and validation

CREATE OR REPLACE FUNCTION reschedule_reservation(
  p_reservation_id UUID,
  p_new_date DATE,
  p_new_time TIME,
  p_reason TEXT DEFAULT NULL,
  p_requested_by TEXT DEFAULT 'user',
  p_requested_by_id UUID DEFAULT NULL,
  p_fees INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  shop_id UUID,
  user_id UUID,
  reservation_date DATE,
  reservation_time TIME,
  status TEXT,
  total_amount INTEGER,
  points_used INTEGER,
  special_requests TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
DECLARE
  v_shop_id UUID;
  v_user_id UUID;
  v_reservation_date DATE;
  v_reservation_time TIME;
BEGIN
  -- Get current reservation details
  SELECT shop_id, user_id, reservation_date, reservation_time 
  INTO v_shop_id, v_user_id, v_reservation_date, v_reservation_time
  FROM reservations
  WHERE id = p_reservation_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Reservation not found';
  END IF;
  
  -- Update the reservation
  UPDATE reservations
  SET 
    reservation_date = p_new_date,
    reservation_time = p_new_time,
    updated_at = NOW()
  WHERE id = p_reservation_id;
  
  -- Log the reschedule history
  INSERT INTO reservation_reschedule_history (
    reservation_id,
    shop_id,
    old_date,
    old_time,
    new_date,
    new_time,
    reason,
    requested_by,
    requested_by_id,
    fees
  ) VALUES (
    p_reservation_id,
    v_shop_id,
    v_reservation_date,
    v_reservation_time,
    p_new_date,
    p_new_time,
    p_reason,
    p_requested_by,
    COALESCE(p_requested_by_id, v_user_id),
    p_fees
  );
  
  -- Return updated reservation
  RETURN QUERY
  SELECT 
    r.id,
    r.shop_id,
    r.user_id,
    r.reservation_date,
    r.reservation_time,
    r.status,
    r.total_amount,
    r.points_used,
    r.special_requests,
    r.created_at,
    r.updated_at
  FROM reservations r
  WHERE r.id = p_reservation_id;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Rollback any changes
    RAISE EXCEPTION 'Failed to reschedule reservation: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION reschedule_reservation(UUID, DATE, TIME, TEXT, TEXT, UUID, INTEGER) TO authenticated;

-- Add comment to function
COMMENT ON FUNCTION reschedule_reservation IS 'Reschedules a reservation with history logging and fee tracking'; 