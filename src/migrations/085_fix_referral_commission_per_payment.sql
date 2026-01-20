-- Fix Referral Commission: Create Individual Commission per Payment
-- Deletes bulk commission record and creates individual commission for each payment
-- Fixes friend detail page showing 0P for individual payments (2026-01-20)

-- Problem:
-- - Migration created payment records in bulk without calling confirmPaymentWithVerification
-- - Single commission record created with total amount (175P) instead of per-payment
-- - No payment_id linkage, causing commission matching to fail
-- - Friend detail page shows all payments as "+0P"

-- Solution:
-- - Delete existing bulk commission record
-- - Create individual commission record for each payment
-- - Link each commission to its payment via payment_id
-- - Calculate correct commission rate (10% for first payment, 5% for subsequent)

DO $$
DECLARE
    deleted_count INTEGER := 0;
    inserted_count INTEGER := 0;
    referrer_id UUID := '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
    referred_id UUID := '3fc00cc7-e748-45c1-9e30-07a779678a76';
BEGIN
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Migration 085: Fix Referral Commission Per Payment';
    RAISE NOTICE 'Referrer: %', referrer_id;
    RAISE NOTICE 'Referred User: %', referred_id;
    RAISE NOTICE '=================================================================';

    -- Step 1: Delete existing bulk commission record
    DELETE FROM point_transactions
    WHERE id = '7295bfb5-8273-4136-880f-587b08defd33'
      AND transaction_type = 'earned_referral'
      AND user_id = referrer_id
      AND referred_user_id = referred_id;

    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RAISE NOTICE 'Step 1: Deleted % bulk commission record(s)', deleted_count;

    -- Step 2: Create individual commission for each fully_paid payment
    -- Commission calculation:
    -- - Base points: payment_amount * 0.05 (5% of payment amount)
    -- - First payment: base_points * 0.10 (10% commission rate)
    -- - Subsequent payments: base_points * 0.05 (5% commission rate)

    WITH ranked_payments AS (
        SELECT
            p.id AS payment_id,
            p.amount,
            p.paid_at,
            p.user_id,
            ROW_NUMBER() OVER (ORDER BY p.paid_at ASC) AS payment_order
        FROM payments p
        WHERE p.user_id = referred_id
          AND p.payment_status = 'fully_paid'
          AND p.paid_at IS NOT NULL
        ORDER BY p.paid_at ASC
    ),
    commission_calculations AS (
        SELECT
            payment_id,
            amount,
            paid_at,
            payment_order,
            -- Calculate base points (5% of payment amount)
            FLOOR(amount * 0.05)::INTEGER AS base_points,
            -- Commission rate: 10% for first payment, 5% for others
            CASE WHEN payment_order = 1 THEN 0.10 ELSE 0.05 END AS commission_rate,
            -- Final commission amount
            FLOOR(
                FLOOR(amount * 0.05)::INTEGER *
                CASE WHEN payment_order = 1 THEN 0.10 ELSE 0.05 END
            )::INTEGER AS commission_amount
        FROM ranked_payments
    )
    INSERT INTO point_transactions (
        id,
        user_id,
        referred_user_id,
        amount,
        transaction_type,
        description,
        status,
        payment_id,
        available_from,
        expires_at,
        created_at,
        updated_at,
        metadata
    )
    SELECT
        gen_random_uuid(),
        referrer_id,
        referred_id,
        cc.commission_amount,
        'earned_referral',
        '추천 보상: ' || cc.commission_amount || '포인트',
        'available',
        cc.payment_id,
        cc.paid_at,
        cc.paid_at + INTERVAL '1 year',
        cc.paid_at,
        cc.paid_at,
        jsonb_build_object(
            'payment_order', cc.payment_order,
            'payment_amount', cc.amount,
            'base_points', cc.base_points,
            'commission_rate', cc.commission_rate,
            'migration', '085_fix_referral_commission_per_payment',
            'migrated_at', NOW()
        )
    FROM commission_calculations cc;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    RAISE NOTICE 'Step 2: Created % individual commission record(s)', inserted_count;

    -- Step 3: Verification
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Verification:';

    -- Show created commissions
    RAISE NOTICE 'Created commissions:';
    FOR i IN (
        SELECT
            pt.id,
            pt.payment_id,
            pt.amount,
            pt.status,
            pt.created_at,
            (pt.metadata->>'payment_order')::INTEGER AS payment_order,
            (pt.metadata->>'commission_rate')::NUMERIC AS commission_rate
        FROM point_transactions pt
        WHERE pt.user_id = referrer_id
          AND pt.referred_user_id = referred_id
          AND pt.transaction_type = 'earned_referral'
        ORDER BY pt.created_at ASC
    ) LOOP
        RAISE NOTICE '  - Payment #%: %P (rate: %%, payment_id: %)',
            i.payment_order, i.amount, i.commission_rate * 100, i.payment_id;
    END LOOP;

    -- Calculate total
    DECLARE
        total_commission INTEGER;
    BEGIN
        SELECT COALESCE(SUM(amount), 0) INTO total_commission
        FROM point_transactions
        WHERE user_id = referrer_id
          AND referred_user_id = referred_id
          AND transaction_type = 'earned_referral';

        RAISE NOTICE '';
        RAISE NOTICE 'Total commission: %P', total_commission;
        RAISE NOTICE '=================================================================';
    END;

    -- Step 4: Update referrals table (set bonus_amount to total)
    UPDATE referrals
    SET
        bonus_amount = (
            SELECT COALESCE(SUM(amount), 0)
            FROM point_transactions
            WHERE user_id = referrer_id
              AND referred_user_id = referred_id
              AND transaction_type = 'earned_referral'
        ),
        updated_at = NOW()
    WHERE referrer_id = referrer_id
      AND referred_id = referred_id;

    RAISE NOTICE '';
    RAISE NOTICE 'Step 4: Updated referrals table with total bonus amount';

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Migration failed: %', SQLERRM;
        RAISE NOTICE 'Rolling back changes...';
        RAISE EXCEPTION 'Migration aborted';
END $$;

-- Final verification query
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '=================================================================';
    RAISE NOTICE 'Migration 085 completed successfully!';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test friend detail page - each payment should show correct commission';
    RAISE NOTICE '2. Verify total commission matches sum of individual commissions';
    RAISE NOTICE '3. Check that new payments create individual commissions automatically';
    RAISE NOTICE '=================================================================';
END $$;
