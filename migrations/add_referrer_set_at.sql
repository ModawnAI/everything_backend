-- Migration: Add referrer_set_at column to track when referrer was set
-- Created: 2024-01-20
-- Purpose: Fix referrer change validation by storing exact timestamp when referrer was set

-- Add referrer_set_at column
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS referrer_set_at TIMESTAMPTZ;

-- Backfill existing users with referred_by_code
-- Use updated_at as fallback for existing data
UPDATE public.users
SET referrer_set_at = updated_at
WHERE referred_by_code IS NOT NULL
  AND referrer_set_at IS NULL;

-- Add index for performance on referrer queries
CREATE INDEX IF NOT EXISTS idx_users_referrer_set_at
ON public.users(referrer_set_at)
WHERE referred_by_code IS NOT NULL;

-- Verification queries (run after migration)
-- 1. Check column exists:
--    SELECT column_name, data_type FROM information_schema.columns
--    WHERE table_name = 'users' AND column_name = 'referrer_set_at';
--
-- 2. Check index created:
--    SELECT indexname FROM pg_indexes WHERE tablename = 'users';
--
-- 3. Verify data backfilled:
--    SELECT COUNT(*) FROM users WHERE referred_by_code IS NOT NULL AND referrer_set_at IS NULL;
--    (Should return 0)
