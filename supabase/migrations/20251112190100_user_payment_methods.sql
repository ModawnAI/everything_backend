-- Migration: User Payment Methods (Billing Keys)
-- Description: Add support for users to save and manage payment methods via PortOne billing keys
-- Date: 2025-11-12

-- Create user_payment_methods table
CREATE TABLE IF NOT EXISTS public.user_payment_methods (
  -- Primary key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- User reference
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- PortOne billing key info
  billing_key TEXT NOT NULL UNIQUE,
  portone_customer_id TEXT,
  issue_id TEXT,
  issue_name TEXT,

  -- Payment method details
  payment_method_type TEXT NOT NULL DEFAULT 'CARD', -- 'CARD', 'MOBILE', 'EASY_PAY'

  -- Card-specific info (if method type is CARD)
  card_company TEXT,           -- 'KB국민카드', '신한카드', etc.
  card_type TEXT,              -- 'CREDIT', 'DEBIT', 'GIFT'
  card_number_masked TEXT,     -- '1234-****-****-5678'
  card_number_last4 TEXT,      -- '5678'
  card_brand TEXT,             -- 'VISA', 'MASTERCARD', 'JCB', etc.

  -- User-friendly display
  nickname TEXT,                -- User's custom name for this payment method

  -- Settings
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  issued_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  last_used_at TIMESTAMP WITH TIME ZONE,
  usage_count INTEGER DEFAULT 0,

  -- PortOne response metadata (JSONB for flexibility)
  portone_metadata JSONB,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE,

  -- Constraints
  CONSTRAINT unique_user_billing_key UNIQUE(user_id, billing_key),
  CONSTRAINT check_card_last4_length CHECK (card_number_last4 IS NULL OR length(card_number_last4) = 4)
);

-- Create indexes for performance
CREATE INDEX idx_user_payment_methods_user_id
  ON public.user_payment_methods(user_id)
  WHERE is_active = true;

CREATE INDEX idx_user_payment_methods_billing_key
  ON public.user_payment_methods(billing_key)
  WHERE is_active = true;

CREATE INDEX idx_user_payment_methods_is_default
  ON public.user_payment_methods(user_id, is_default)
  WHERE is_default = true AND is_active = true;

CREATE INDEX idx_user_payment_methods_created_at
  ON public.user_payment_methods(created_at DESC);

-- Only one default payment method per user
CREATE UNIQUE INDEX idx_user_default_payment_method
  ON public.user_payment_methods(user_id)
  WHERE is_default = true AND is_active = true;

-- Enable Row Level Security (RLS)
ALTER TABLE public.user_payment_methods ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own payment methods
CREATE POLICY "Users can view their own payment methods"
  ON public.user_payment_methods FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own payment methods"
  ON public.user_payment_methods FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own payment methods"
  ON public.user_payment_methods FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete (soft delete) their own payment methods"
  ON public.user_payment_methods FOR DELETE
  USING (auth.uid() = user_id);

-- Admin policies (for admin dashboard)
CREATE POLICY "Admins can view all payment methods"
  ON public.user_payment_methods FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.raw_user_meta_data->>'role' = 'admin'
    )
  );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_user_payment_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_payment_methods_updated_at
  BEFORE UPDATE ON public.user_payment_methods
  FOR EACH ROW
  EXECUTE FUNCTION update_user_payment_methods_updated_at();

-- Add helpful comments
COMMENT ON TABLE public.user_payment_methods IS 'Stores user payment methods (billing keys) from PortOne for quick checkout';
COMMENT ON COLUMN public.user_payment_methods.billing_key IS 'PortOne billing key - used for subscription/recurring payments';
COMMENT ON COLUMN public.user_payment_methods.card_number_masked IS 'Masked card number for display (e.g., 1234-****-****-5678)';
COMMENT ON COLUMN public.user_payment_methods.is_default IS 'Whether this is the user default payment method (only one per user)';
COMMENT ON COLUMN public.user_payment_methods.usage_count IS 'Number of times this payment method has been used';
