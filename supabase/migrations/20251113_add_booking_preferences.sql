-- Migration: Add booking_preferences to users table
-- Date: 2025-11-13
-- Description: Adds JSONB column for storing user booking preferences

-- Add booking_preferences column to users table
ALTER TABLE users
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN users.booking_preferences IS 'User booking preferences stored as JSONB. Structure: {
  "skinType": "normal" | "dry" | "oily" | "combination" | "sensitive",
  "allergyInfo": "string describing allergies",
  "preferredStylist": "string with stylist preference",
  "specialRequests": "string with special requests"
}';

-- Create index for JSONB queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_users_booking_preferences_gin
ON users USING gin (booking_preferences);

-- Example queries after migration:
-- 1. Get users with specific skin type:
--    SELECT * FROM users WHERE booking_preferences->>'skinType' = 'oily';
--
-- 2. Get users with allergy information:
--    SELECT * FROM users WHERE booking_preferences->>'allergyInfo' IS NOT NULL;
--
-- 3. Update booking preferences:
--    UPDATE users SET booking_preferences = '{"skinType": "dry", "allergyInfo": "none"}'::jsonb WHERE id = 'user-id';
--
-- 4. Merge/update specific fields:
--    UPDATE users SET booking_preferences = booking_preferences || '{"skinType": "oily"}'::jsonb WHERE id = 'user-id';
