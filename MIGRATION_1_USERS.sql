ALTER TABLE users ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN users.booking_preferences IS 'User booking preferences stored as JSONB. Structure: skinType, allergyInfo, preferredStylist, specialRequests';

CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin ON users USING gin (booking_preferences);
