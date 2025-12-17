-- =============================================
-- Migration: PortOne V2 Enhancements (Final Corrected)
-- Date: 2025-12-26
-- Description: Add missing columns and tables for PortOne V2 integration
-- =============================================

-- =============================================
-- Add missing columns to payments table
-- =============================================

-- Note: payment_stage already exists in production, so we only add the two missing columns
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS cancelled_amount INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellable_amount INTEGER DEFAULT 0;

-- Add constraints for new columns
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_cancelled_amount'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT check_cancelled_amount CHECK (cancelled_amount >= 0 AND cancelled_amount <= amount);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'check_cancellable_amount'
  ) THEN
    ALTER TABLE public.payments
      ADD CONSTRAINT check_cancellable_amount CHECK (cancellable_amount >= 0 AND cancellable_amount <= amount);
  END IF;
END $$;

-- Add comments for new columns
COMMENT ON COLUMN public.payments.cancelled_amount IS 'Total amount cancelled/refunded (KRW)';
COMMENT ON COLUMN public.payments.cancellable_amount IS 'Remaining amount that can be cancelled (KRW)';

-- =============================================
-- Create webhook_logs table
-- =============================================

CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    webhook_id VARCHAR(255) NOT NULL UNIQUE, -- PortOne webhook ID for idempotency
    webhook_type VARCHAR(100), -- e.g., "Transaction.Paid", "Transaction.Cancelled"
    payment_id UUID, -- Foreign key to payments table
    provider_transaction_id VARCHAR(255), -- PortOne transaction ID
    request_body JSONB, -- Full webhook request payload
    response_status INTEGER, -- HTTP response status we sent back
    response_body JSONB, -- Response payload we sent
    status VARCHAR(50) DEFAULT 'processed', -- processed, failed, skipped (duplicate)
    error_message TEXT, -- Error message if processing failed
    processed_at TIMESTAMPTZ, -- When webhook was processed
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add foreign key to payments table if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'webhook_logs_payment_id_fkey'
  ) THEN
    ALTER TABLE public.webhook_logs
      ADD CONSTRAINT webhook_logs_payment_id_fkey
      FOREIGN KEY (payment_id) REFERENCES public.payments(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add indexes for webhook logs if they don't exist
CREATE INDEX IF NOT EXISTS idx_webhook_logs_webhook_id ON public.webhook_logs(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payment_id ON public.webhook_logs(payment_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_provider_transaction_id ON public.webhook_logs(provider_transaction_id);
CREATE INDEX IF NOT EXISTS idx_webhook_logs_created_at ON public.webhook_logs(created_at DESC);

-- Update comments
COMMENT ON TABLE public.webhook_logs IS 'Webhook event logs for idempotency and debugging';
COMMENT ON COLUMN public.webhook_logs.webhook_id IS 'Unique webhook ID from PortOne for idempotency checking';
COMMENT ON COLUMN public.webhook_logs.status IS 'Processing status: processed, failed, skipped (duplicate)';

-- =============================================
-- Billing Keys Table for Saved Cards
-- =============================================
CREATE TABLE IF NOT EXISTS public.billing_keys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    billing_key VARCHAR(255) NOT NULL UNIQUE, -- PortOne billing key
    card_type VARCHAR(50), -- CREDIT, DEBIT, GIFT
    card_company VARCHAR(100), -- Card issuer name
    card_number VARCHAR(20), -- Masked card number (e.g., "1234-****-****-5678")
    card_name VARCHAR(100), -- Cardholder name
    expiry_year INTEGER, -- Card expiry year (YYYY)
    expiry_month INTEGER, -- Card expiry month (1-12)
    is_default BOOLEAN DEFAULT FALSE, -- Default payment method
    is_active BOOLEAN DEFAULT TRUE, -- Active status
    metadata JSONB, -- Additional PortOne data
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMPTZ, -- Last successful payment timestamp
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Constraints
    CONSTRAINT check_expiry_year CHECK (expiry_year >= 2024 AND expiry_year <= 2099),
    CONSTRAINT check_expiry_month CHECK (expiry_month >= 1 AND expiry_month <= 12)
);

-- Indexes for billing keys
CREATE INDEX IF NOT EXISTS idx_billing_keys_user_id ON public.billing_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_keys_billing_key ON public.billing_keys(billing_key);
CREATE INDEX IF NOT EXISTS idx_billing_keys_is_default ON public.billing_keys(user_id, is_default) WHERE is_default = TRUE;
CREATE INDEX IF NOT EXISTS idx_billing_keys_is_active ON public.billing_keys(user_id, is_active) WHERE is_active = TRUE;

COMMENT ON TABLE public.billing_keys IS 'Saved payment methods using PortOne billing keys';
COMMENT ON COLUMN public.billing_keys.billing_key IS 'PortOne billing key for recurring payments';
COMMENT ON COLUMN public.billing_keys.is_default IS 'User default payment method';
COMMENT ON COLUMN public.billing_keys.is_active IS 'Card validity status (expired cards marked inactive)';

-- =============================================
-- RLS Policies for new tables
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_keys ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS webhook_logs_admin_all ON public.webhook_logs;
DROP POLICY IF EXISTS billing_keys_user_select ON public.billing_keys;
DROP POLICY IF EXISTS billing_keys_user_insert ON public.billing_keys;
DROP POLICY IF EXISTS billing_keys_user_update ON public.billing_keys;
DROP POLICY IF EXISTS billing_keys_user_delete ON public.billing_keys;
DROP POLICY IF EXISTS billing_keys_admin_all ON public.billing_keys;

-- Webhook logs: Admin only access
CREATE POLICY webhook_logs_admin_all ON public.webhook_logs
    FOR ALL
    USING (
        auth.uid() IN (SELECT id FROM public.users WHERE user_role IN ('super_admin', 'admin'))
    );

-- Billing keys: Users can view/manage their own
CREATE POLICY billing_keys_user_select ON public.billing_keys
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY billing_keys_user_insert ON public.billing_keys
    FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY billing_keys_user_update ON public.billing_keys
    FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY billing_keys_user_delete ON public.billing_keys
    FOR DELETE
    USING (auth.uid() = user_id);

-- Billing keys: Admin full access
CREATE POLICY billing_keys_admin_all ON public.billing_keys
    FOR ALL
    USING (
        auth.uid() IN (SELECT id FROM public.users WHERE user_role IN ('super_admin', 'admin'))
    );

-- =============================================
-- Triggers for updated_at
-- =============================================

-- Create trigger function if not exists
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for new tables
DROP TRIGGER IF EXISTS update_webhook_logs_updated_at ON public.webhook_logs;
CREATE TRIGGER update_webhook_logs_updated_at
    BEFORE UPDATE ON public.webhook_logs
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_billing_keys_updated_at ON public.billing_keys;
CREATE TRIGGER update_billing_keys_updated_at
    BEFORE UPDATE ON public.billing_keys
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- Update existing payments to populate new columns
-- =============================================

-- Set cancelled_amount from total_cancel_amount (this column exists in production)
UPDATE public.payments
SET cancelled_amount = COALESCE(total_cancel_amount, 0)
WHERE cancelled_amount = 0;

-- Set cancellable_amount (amount - cancelled_amount)
UPDATE public.payments
SET cancellable_amount = amount - COALESCE(cancelled_amount, 0)
WHERE cancellable_amount = 0;
