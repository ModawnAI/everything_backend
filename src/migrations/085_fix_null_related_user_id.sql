-- Fix NULL related_user_id in point_transactions
-- Recovers related_user_id for earned_referral transactions that have NULL value
-- This fixes the friend detail page commission display issue (2026-01-20)

-- Summary:
-- Before fix: Commissions were created with referred_user_id (non-existent column)
-- Result: related_user_id stored as NULL, causing 0P display in friend detail page
-- After fix: New commissions use correct column (related_user_id)
-- This migration: Recovers related_user_id for existing NULL records

DO $$
DECLARE
    updated_count INTEGER := 0;
    total_null_count INTEGER := 0;
BEGIN
    -- Get count of NULL related_user_id records
    SELECT COUNT(*) INTO total_null_count
    FROM public.point_transactions
    WHERE transaction_type = 'earned_referral'
      AND related_user_id IS NULL;

    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Migration 085: Fix NULL related_user_id in point_transactions';
    RAISE NOTICE 'Found % earned_referral transactions with NULL related_user_id', total_null_count;
    RAISE NOTICE '=================================================================';

    IF total_null_count = 0 THEN
        RAISE NOTICE 'No records to update. Migration completed.';
        RETURN;
    END IF;

    -- Strategy 1: Match by payment_id (most accurate)
    -- If payment_id exists, find the payment's user_id (referred user)
    WITH payment_match AS (
        SELECT DISTINCT ON (pt.id)
            pt.id AS transaction_id,
            p.user_id AS referred_user_id
        FROM public.point_transactions pt
        INNER JOIN public.payments p ON p.id = pt.payment_id
        WHERE pt.transaction_type = 'earned_referral'
          AND pt.related_user_id IS NULL
          AND pt.payment_id IS NOT NULL
    )
    UPDATE public.point_transactions pt
    SET related_user_id = pm.referred_user_id
    FROM payment_match pm
    WHERE pt.id = pm.transaction_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Strategy 1 (payment_id match): % records updated', updated_count;

    -- Strategy 2: Match by reservation_id + time proximity (±10 minutes)
    -- For records without payment_id, use reservation and time-based matching
    WITH reservation_match AS (
        SELECT DISTINCT ON (pt.id)
            pt.id AS transaction_id,
            r.user_id AS referred_user_id,
            ABS(EXTRACT(EPOCH FROM (pt.created_at - p.paid_at))) AS time_diff_seconds
        FROM public.point_transactions pt
        INNER JOIN public.reservations r ON r.id = pt.reservation_id
        INNER JOIN public.payments p ON p.reservation_id = r.id
        WHERE pt.transaction_type = 'earned_referral'
          AND pt.related_user_id IS NULL
          AND pt.payment_id IS NULL
          AND pt.reservation_id IS NOT NULL
          AND p.paid_at IS NOT NULL
          AND p.payment_status = 'fully_paid'
          -- Match within ±10 minutes (600 seconds)
          AND ABS(EXTRACT(EPOCH FROM (pt.created_at - p.paid_at))) < 600
        ORDER BY pt.id, time_diff_seconds ASC
    )
    UPDATE public.point_transactions pt
    SET related_user_id = rm.referred_user_id
    FROM reservation_match rm
    WHERE pt.id = rm.transaction_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Strategy 2 (reservation_id + time match): % records updated', updated_count;

    -- Strategy 3: Match by referrals table (fallback)
    -- Use referrals table to find referred_id based on referrer_id (user_id) and timing
    WITH referral_match AS (
        SELECT DISTINCT ON (pt.id)
            pt.id AS transaction_id,
            ref.referred_id AS referred_user_id,
            ABS(EXTRACT(EPOCH FROM (pt.created_at - ref.created_at))) AS time_diff_seconds
        FROM public.point_transactions pt
        INNER JOIN public.referrals ref ON ref.referrer_id = pt.user_id
        WHERE pt.transaction_type = 'earned_referral'
          AND pt.related_user_id IS NULL
          AND ref.status = 'completed'
          AND ref.bonus_paid = true
          -- Match within ±1 hour (3600 seconds)
          AND ABS(EXTRACT(EPOCH FROM (pt.created_at - ref.updated_at))) < 3600
        ORDER BY pt.id, time_diff_seconds ASC
    )
    UPDATE public.point_transactions pt
    SET related_user_id = rfm.referred_user_id
    FROM referral_match rfm
    WHERE pt.id = rfm.transaction_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Strategy 3 (referrals table match): % records updated', updated_count;

    -- Final report
    SELECT COUNT(*) INTO updated_count
    FROM public.point_transactions
    WHERE transaction_type = 'earned_referral'
      AND related_user_id IS NOT NULL;

    SELECT COUNT(*) INTO total_null_count
    FROM public.point_transactions
    WHERE transaction_type = 'earned_referral'
      AND related_user_id IS NULL;

    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Migration completed:';
    RAISE NOTICE '  - Total earned_referral transactions: %', updated_count + total_null_count;
    RAISE NOTICE '  - Successfully recovered: %', updated_count;
    RAISE NOTICE '  - Still NULL (unmatched): %', total_null_count;
    RAISE NOTICE '=================================================================';

    IF total_null_count > 0 THEN
        RAISE WARNING 'Some records could not be matched. These will continue to show 0P in friend detail page.';
        RAISE NOTICE 'Run this query to see unmatched records:';
        RAISE NOTICE 'SELECT id, user_id, amount, description, created_at FROM point_transactions WHERE transaction_type = ''earned_referral'' AND related_user_id IS NULL;';
    END IF;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Migration encountered an error: %', SQLERRM;
        RAISE NOTICE 'Partial update may have been applied. Check transaction logs.';
END $$;

-- Verify migration success
DO $$
DECLARE
    success_count INTEGER;
    null_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO success_count
    FROM public.point_transactions
    WHERE transaction_type = 'earned_referral'
      AND related_user_id IS NOT NULL;

    SELECT COUNT(*) INTO null_count
    FROM public.point_transactions
    WHERE transaction_type = 'earned_referral'
      AND related_user_id IS NULL;

    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Verification:';
    RAISE NOTICE '  ✓ Transactions with valid related_user_id: %', success_count;
    RAISE NOTICE '  ✗ Transactions still NULL: %', null_count;
    RAISE NOTICE '=================================================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test friend detail page - commissions should show correct amounts';
    RAISE NOTICE '2. Monitor new commissions to ensure they use related_user_id correctly';
    RAISE NOTICE '3. If NULL records remain, investigate manually using the query above';
    RAISE NOTICE '=================================================================';
END $$;
