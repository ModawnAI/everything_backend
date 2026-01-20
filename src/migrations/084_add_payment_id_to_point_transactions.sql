-- Add payment_id to point_transactions Table Migration
-- Adds payment_id column to enable accurate matching between payments and commission points
-- This fixes the friend detail page points mismatch issue (2026-01-20)

-- Step 1: Add payment_id column to point_transactions table
ALTER TABLE public.point_transactions
ADD COLUMN IF NOT EXISTS payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL;

-- Step 2: Create index for performance
CREATE INDEX IF NOT EXISTS idx_point_transactions_payment_id
ON public.point_transactions (payment_id);

-- Step 3: Create composite index for common query pattern
CREATE INDEX IF NOT EXISTS idx_point_transactions_user_payment
ON public.point_transactions (user_id, payment_id);

-- Step 4: Add comment for documentation
COMMENT ON COLUMN public.point_transactions.payment_id IS
'References the payment that triggered this point transaction (for referral commissions)';

-- Step 5: Optional - Migrate existing data using time-based matching
-- This attempts to match existing point_transactions with payments based on time proximity
-- Only updates earned_referral transactions that don't already have a payment_id
DO $$
DECLARE
    updated_count INTEGER := 0;
    total_count INTEGER := 0;
BEGIN
    -- Get total count of records to migrate
    SELECT COUNT(*) INTO total_count
    FROM public.point_transactions pt
    WHERE pt.transaction_type = 'earned_referral'
      AND pt.payment_id IS NULL
      AND pt.reservation_id IS NOT NULL;

    RAISE NOTICE 'Starting migration for % earned_referral transactions', total_count;

    -- Update point_transactions with payment_id based on reservation_id and time proximity
    -- Match with the most recent payment for the same reservation (±10 minutes)
    WITH matched_payments AS (
        SELECT DISTINCT ON (pt.id)
            pt.id AS transaction_id,
            p.id AS matched_payment_id,
            ABS(EXTRACT(EPOCH FROM (pt.created_at - p.paid_at))) AS time_diff_seconds
        FROM public.point_transactions pt
        INNER JOIN public.payments p ON p.reservation_id = pt.reservation_id
        WHERE pt.transaction_type = 'earned_referral'
          AND pt.payment_id IS NULL
          AND pt.reservation_id IS NOT NULL
          AND p.paid_at IS NOT NULL
          AND p.payment_status = 'fully_paid'
          -- Match within ±10 minutes (600 seconds)
          AND ABS(EXTRACT(EPOCH FROM (pt.created_at - p.paid_at))) < 600
        ORDER BY pt.id, time_diff_seconds ASC
    )
    UPDATE public.point_transactions pt
    SET payment_id = mp.matched_payment_id
    FROM matched_payments mp
    WHERE pt.id = mp.transaction_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;

    RAISE NOTICE 'Migration completed: % / % records updated with payment_id', updated_count, total_count;
    RAISE NOTICE 'Unmatched records: %', total_count - updated_count;

EXCEPTION
    WHEN OTHERS THEN
        RAISE WARNING 'Data migration encountered an error: %', SQLERRM;
        RAISE NOTICE 'Migration will continue - new records will use payment_id correctly';
END $$;

-- Step 6: Log migration completion
DO $$
BEGIN
    RAISE NOTICE '====================================================================';
    RAISE NOTICE 'Migration 084: payment_id column added to point_transactions';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Update enhanced-referral.service.ts to pass payment_id';
    RAISE NOTICE '2. Update point.service.ts to accept and store payment_id';
    RAISE NOTICE '3. Update referral-earnings.service.ts getFriendPaymentHistory()';
    RAISE NOTICE '====================================================================';
END $$;
