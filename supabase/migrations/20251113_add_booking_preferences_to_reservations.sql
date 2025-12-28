-- Migration: Add booking_preferences to reservations table
-- Date: 2025-11-13
-- Description: Adds JSONB column for storing snapshot of user's booking preferences at time of reservation

-- Add booking_preferences column to reservations table
ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS booking_preferences JSONB DEFAULT '{}'::jsonb;

-- Add comment to explain the structure
COMMENT ON COLUMN reservations.booking_preferences IS 'Snapshot of user booking preferences at time of reservation. Structure: {
  "skinType": "normal" | "dry" | "oily" | "combination" | "sensitive",
  "allergyInfo": "string describing allergies",
  "preferredStylist": "string with stylist preference",
  "specialRequests": "string with special requests"
}. This preserves the preferences even if user changes their profile later.';

-- Create index for JSONB queries (optional but recommended for performance)
CREATE INDEX IF NOT EXISTS idx_reservations_booking_preferences_gin
ON reservations USING gin (booking_preferences);

-- Example queries after migration:
-- 1. Get reservations with specific skin type:
--    SELECT * FROM reservations WHERE booking_preferences->>'skinType' = 'oily';
--
-- 2. Get reservations with allergy information:
--    SELECT * FROM reservations WHERE booking_preferences->>'allergyInfo' IS NOT NULL AND booking_preferences->>'allergyInfo' != '';
--
-- 3. Find reservations with preferred stylist:
--    SELECT * FROM reservations WHERE booking_preferences->>'preferredStylist' LIKE '%김%';
