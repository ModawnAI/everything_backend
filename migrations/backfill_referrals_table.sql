-- Migration: Backfill referrals table from existing referred_by_code data
-- Created: 2026-01-20
-- Purpose: Fix missing referral records for friend list display

-- =============================================
-- PART 1: Backfill referrals table
-- =============================================

-- Create referral records for users who have referred_by_code but no referrals record
INSERT INTO public.referrals (
  referrer_id,
  referred_id,
  referral_code,
  status,
  bonus_amount,
  bonus_paid,
  referral_reward_percentage,
  calculation_method,
  chain_validation_passed,
  created_at,
  updated_at
)
SELECT
  referrer.id AS referrer_id,
  referred.id AS referred_id,
  referred.referred_by_code AS referral_code,
  'pending' AS status,
  1000 AS bonus_amount,
  false AS bonus_paid,
  0.1 AS referral_reward_percentage,
  'percentage' AS calculation_method,
  true AS chain_validation_passed,
  COALESCE(referred.referrer_set_at, referred.created_at, NOW()) AS created_at,
  COALESCE(referred.referrer_set_at, referred.created_at, NOW()) AS updated_at
FROM
  public.users AS referred
INNER JOIN
  public.users AS referrer
  ON referrer.referral_code = referred.referred_by_code
WHERE
  -- Only users who have a referrer set
  referred.referred_by_code IS NOT NULL
  -- Only if referrer is still active
  AND referrer.user_status = 'active'
  -- Only if referral record doesn't already exist
  AND NOT EXISTS (
    SELECT 1
    FROM public.referrals r
    WHERE r.referrer_id = referrer.id
      AND r.referred_id = referred.id
  );

-- =============================================
-- PART 2: Verification Queries
-- =============================================

-- 1. Check how many records were created
-- SELECT COUNT(*) AS backfilled_count
-- FROM public.referrals
-- WHERE created_at >= NOW() - INTERVAL '1 minute';

-- 2. Verify all users with referred_by_code now have referral records
-- SELECT
--   COUNT(*) AS users_with_referrer,
--   COUNT(r.id) AS users_with_referral_record,
--   COUNT(*) - COUNT(r.id) AS missing_records
-- FROM public.users u
-- LEFT JOIN public.users referrer ON referrer.referral_code = u.referred_by_code
-- LEFT JOIN public.referrals r ON r.referrer_id = referrer.id AND r.referred_id = u.id
-- WHERE u.referred_by_code IS NOT NULL
--   AND referrer.user_status = 'active';
-- Expected: missing_records should be 0

-- 3. Sample of backfilled records
-- SELECT
--   r.id,
--   referrer.nickname AS referrer_nickname,
--   referred.nickname AS referred_nickname,
--   r.referral_code,
--   r.status,
--   r.created_at
-- FROM public.referrals r
-- INNER JOIN public.users referrer ON r.referrer_id = referrer.id
-- INNER JOIN public.users referred ON r.referred_id = referred.id
-- WHERE r.created_at >= NOW() - INTERVAL '1 minute'
-- ORDER BY r.created_at DESC
-- LIMIT 10;

-- =============================================
-- PART 3: Cleanup (if needed)
-- =============================================

-- If migration needs to be rolled back:
-- DELETE FROM public.referrals
-- WHERE created_at >= 'TIMESTAMP_WHEN_MIGRATION_RAN'
--   AND status = 'pending'
--   AND bonus_amount = 1000;
