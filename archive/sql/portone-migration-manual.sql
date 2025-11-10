-- =============================================
-- PortOne V2 Schema Migration - Manual Execution
-- INSTRUCTIONS: Copy and paste this SQL into your Supabase SQL Editor
-- =============================================

-- 1. Add 'portone' to payment_method enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'portone'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method')
    ) THEN
        ALTER TYPE payment_method ADD VALUE 'portone';
        RAISE NOTICE 'Added portone to payment_method enum';
    ELSE
        RAISE NOTICE 'portone already exists in payment_method enum';
    END IF;
END
$$;

-- 2. Add 'virtual_account_issued' to payment_status enum
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_enum
        WHERE enumlabel = 'virtual_account_issued'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status')
    ) THEN
        ALTER TYPE payment_status ADD VALUE 'virtual_account_issued';
        RAISE NOTICE 'Added virtual_account_issued to payment_status enum';
    ELSE
        RAISE NOTICE 'virtual_account_issued already exists in payment_status enum';
    END IF;
END
$$;

-- 3. Add PortOne V2 columns to payments table
ALTER TABLE payments
ADD COLUMN IF NOT EXISTS channel_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS store_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS payment_key VARCHAR(255),
ADD COLUMN IF NOT EXISTS gateway_method VARCHAR(100),
ADD COLUMN IF NOT EXISTS gateway_transaction_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS virtual_account_info JSONB,
ADD COLUMN IF NOT EXISTS gateway_metadata JSONB DEFAULT '{}'::jsonb;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_payments_payment_key
ON payments(payment_key) WHERE payment_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_channel_key
ON payments(channel_key) WHERE channel_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_store_id
ON payments(store_id) WHERE store_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_gateway_transaction_id
ON payments(gateway_transaction_id) WHERE gateway_transaction_id IS NOT NULL;

-- 5. Add column comments
COMMENT ON COLUMN payments.channel_key IS 'PortOne V2 channel key for payment processing';
COMMENT ON COLUMN payments.store_id IS 'PortOne V2 store identifier';
COMMENT ON COLUMN payments.payment_key IS 'PortOne V2 unique payment identifier';
COMMENT ON COLUMN payments.gateway_method IS 'PortOne V2 specific payment method';
COMMENT ON COLUMN payments.gateway_transaction_id IS 'PortOne V2 transaction ID for tracking';
COMMENT ON COLUMN payments.virtual_account_info IS 'Virtual account details from PortOne';
COMMENT ON COLUMN payments.gateway_metadata IS 'PortOne V2 specific metadata and additional fields';

-- 6. Update existing records with default metadata
UPDATE payments
SET gateway_metadata = COALESCE(gateway_metadata, '{}'::jsonb)
WHERE gateway_metadata IS NULL;

-- 7. Validation
SELECT 'Migration completed successfully! ✅' as status;
SELECT 'payment_method enum values:' as info, enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_method');

SELECT 'payment_status enum values:' as info, enumlabel
FROM pg_enum
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'payment_status');

SELECT 'New columns added to payments table:' as info, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'payments'
AND column_name IN ('channel_key', 'store_id', 'payment_key', 'gateway_method', 'gateway_transaction_id', 'virtual_account_info', 'gateway_metadata')
ORDER BY column_name;