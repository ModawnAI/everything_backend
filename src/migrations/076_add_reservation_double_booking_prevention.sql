-- Migration 076: Add Double Booking Prevention
-- Purpose: Prevent double bookings by adding database-level constraints and indexes
--
-- Changes:
-- 1. Add partial unique index to prevent concurrent bookings for the same shop/date/time
-- 2. Add check constraint for valid reservation times
-- 3. Add function to validate time slot availability at database level
-- 4. Add trigger to automatically check for overlapping reservations

-- =============================================
-- 1. Create unique index for preventing duplicate bookings
-- =============================================
-- This partial index ensures that only one active reservation can exist
-- for a given shop, date, and time combination
-- Note: Only applies to 'requested', 'confirmed', and 'in_progress' statuses

CREATE UNIQUE INDEX IF NOT EXISTS idx_reservations_no_double_booking
ON reservations (shop_id, reservation_date, reservation_time)
WHERE status IN ('requested', 'confirmed', 'in_progress');

COMMENT ON INDEX idx_reservations_no_double_booking IS
'Prevents double bookings by enforcing unique constraint on active reservations (requested, confirmed, in_progress) for the same shop, date, and time';

-- =============================================
-- 2. Add check constraint for valid time format
-- =============================================
-- Ensures reservation_time is in valid HH:MM format

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'reservations_time_format_check'
  ) THEN
    ALTER TABLE reservations
    ADD CONSTRAINT reservations_time_format_check
    CHECK (reservation_time ~ '^\d{2}:\d{2}$');
  END IF;
END $$;

COMMENT ON CONSTRAINT reservations_time_format_check ON reservations IS
'Ensures reservation_time is in HH:MM format (e.g., 14:30)';

-- =============================================
-- 3. Create function to check for overlapping reservations
-- =============================================
-- This function checks if a new reservation overlaps with existing ones
-- considering service duration and buffer times

CREATE OR REPLACE FUNCTION check_reservation_overlap()
RETURNS TRIGGER AS $$
DECLARE
  v_overlap_count INTEGER;
  v_service_duration INTEGER;
  v_buffer_time INTEGER := 15; -- 15-minute buffer
  v_new_start_time TIME;
  v_new_end_time TIME;
  v_existing_reservation RECORD;
BEGIN
  -- Calculate total service duration for the new reservation
  SELECT COALESCE(SUM(
    COALESCE(ss.duration_minutes, 60) * rs.quantity
  ), 0) INTO v_service_duration
  FROM reservation_services rs
  LEFT JOIN shop_services ss ON rs.service_id = ss.id
  WHERE rs.reservation_id = NEW.id;

  -- Set start and end times for the new reservation
  v_new_start_time := NEW.reservation_time::TIME;
  v_new_end_time := v_new_start_time + (v_service_duration + v_buffer_time) * INTERVAL '1 minute';

  -- Check for overlapping reservations
  FOR v_existing_reservation IN
    SELECT
      r.id,
      r.reservation_time,
      COALESCE(SUM(
        COALESCE(ss.duration_minutes, 60) * rs.quantity
      ), 0) as total_duration
    FROM reservations r
    LEFT JOIN reservation_services rs ON r.id = rs.reservation_id
    LEFT JOIN shop_services ss ON rs.service_id = ss.id
    WHERE r.shop_id = NEW.shop_id
      AND r.reservation_date = NEW.reservation_date
      AND r.status IN ('requested', 'confirmed', 'in_progress')
      AND r.id != NEW.id
    GROUP BY r.id, r.reservation_time
  LOOP
    DECLARE
      v_existing_start_time TIME;
      v_existing_end_time TIME;
    BEGIN
      v_existing_start_time := v_existing_reservation.reservation_time::TIME;
      v_existing_end_time := v_existing_start_time +
        (v_existing_reservation.total_duration + v_buffer_time) * INTERVAL '1 minute';

      -- Check for overlap with buffer consideration
      IF (v_new_start_time < v_existing_end_time AND v_new_end_time > v_existing_start_time) THEN
        RAISE EXCEPTION
          'Double booking prevented: Reservation overlaps with existing reservation % (% - %)',
          v_existing_reservation.id,
          v_existing_start_time,
          v_existing_end_time
        USING ERRCODE = '23505'; -- unique_violation error code
      END IF;
    END;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION check_reservation_overlap() IS
'Trigger function that prevents overlapping reservations by checking service durations and buffer times';

-- =============================================
-- 4. Create trigger to check for overlaps on insert/update
-- =============================================

DROP TRIGGER IF EXISTS trg_check_reservation_overlap ON reservations;

CREATE TRIGGER trg_check_reservation_overlap
  BEFORE INSERT OR UPDATE OF shop_id, reservation_date, reservation_time, status
  ON reservations
  FOR EACH ROW
  WHEN (NEW.status IN ('requested', 'confirmed', 'in_progress'))
  EXECUTE FUNCTION check_reservation_overlap();

COMMENT ON TRIGGER trg_check_reservation_overlap ON reservations IS
'Automatically checks for overlapping reservations before insert or update of active reservations';

-- =============================================
-- 5. Add index for faster overlap detection queries
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reservations_shop_date_time_status
ON reservations (shop_id, reservation_date, reservation_time, status)
WHERE status IN ('requested', 'confirmed', 'in_progress');

COMMENT ON INDEX idx_reservations_shop_date_time_status IS
'Optimizes queries for checking reservation availability and detecting overlaps';

-- =============================================
-- 6. Add index for cleaning up stale 'requested' reservations
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reservations_status_created_at
ON reservations (status, created_at)
WHERE status = 'requested';

COMMENT ON INDEX idx_reservations_status_created_at IS
'Optimizes queries for cleaning up stale requested reservations (older than 15 minutes)';

-- =============================================
-- 7. Create function to clean up stale 'requested' reservations
-- =============================================
-- This function automatically expires 'requested' reservations older than 15 minutes

CREATE OR REPLACE FUNCTION cleanup_stale_requested_reservations()
RETURNS INTEGER AS $$
DECLARE
  v_updated_count INTEGER;
BEGIN
  -- Update stale 'requested' reservations to 'cancelled_by_system'
  UPDATE reservations
  SET
    status = 'cancelled_by_system',
    updated_at = NOW()
  WHERE status = 'requested'
    AND created_at < NOW() - INTERVAL '15 minutes'
    AND id NOT IN (
      -- Don't cancel if there's a recent payment attempt
      SELECT DISTINCT reservation_id
      FROM reservation_payments
      WHERE created_at > NOW() - INTERVAL '5 minutes'
    );

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  -- Log the cleanup
  IF v_updated_count > 0 THEN
    RAISE NOTICE 'Cleaned up % stale requested reservations', v_updated_count;
  END IF;

  RETURN v_updated_count;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION cleanup_stale_requested_reservations() IS
'Cleans up stale requested reservations that are older than 15 minutes and have no recent payment attempts';

-- =============================================
-- 8. Grant necessary permissions
-- =============================================

-- Grant execute permission on functions
GRANT EXECUTE ON FUNCTION check_reservation_overlap() TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_stale_requested_reservations() TO authenticated;

-- =============================================
-- 9. Add helpful view for monitoring double booking risks
-- =============================================

CREATE OR REPLACE VIEW v_reservation_conflicts AS
SELECT
  r1.id as reservation_1_id,
  r1.shop_id,
  r1.reservation_date,
  r1.reservation_time as time_1,
  r1.status as status_1,
  r2.id as reservation_2_id,
  r2.reservation_time as time_2,
  r2.status as status_2,
  r1.created_at as created_1,
  r2.created_at as created_2
FROM reservations r1
INNER JOIN reservations r2 ON
  r1.shop_id = r2.shop_id
  AND r1.reservation_date = r2.reservation_date
  AND r1.reservation_time = r2.reservation_time
  AND r1.id < r2.id
  AND r1.status IN ('requested', 'confirmed', 'in_progress')
  AND r2.status IN ('requested', 'confirmed', 'in_progress');

COMMENT ON VIEW v_reservation_conflicts IS
'View for monitoring potential double booking conflicts (should always be empty if constraints work correctly)';

-- =============================================
-- Migration complete
-- =============================================
-- This migration adds comprehensive double booking prevention:
-- ✅ Unique index prevents exact duplicate bookings
-- ✅ Trigger validates overlapping time slots
-- ✅ Function cleans up stale reservations
-- ✅ Monitoring view for conflict detection
