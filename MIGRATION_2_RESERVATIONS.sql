ALTER TABLE reservations ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN reservations.booking_preferences IS 'Snapshot of user booking preferences at time of reservation. Preserves historical data even if user changes profile later.';

CREATE INDEX IF NOT EXISTS idx_reservations_booking_preferences_gin ON reservations USING gin (booking_preferences);
