-- Identity Verification Tables for Danal Integration
-- Migration: 20251227_identity_verification
-- Description: Add tables for storing identity verification records using PortOne V2 Danal service

-- Create identity_verifications table
CREATE TABLE IF NOT EXISTS identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- PortOne V2 identifiers
  verification_id TEXT NOT NULL UNIQUE, -- identityVerificationId from PortOne
  store_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,

  -- User information
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT, -- Custom customer identifier

  -- Verification status
  status TEXT NOT NULL DEFAULT 'READY' CHECK (status IN ('READY', 'VERIFIED', 'FAILED')),

  -- Verified customer information (populated after successful verification)
  verified_customer JSONB, -- Contains: ci, di, name, gender, birthDate, phoneNumber, operator, isForeigner

  -- Request information
  custom_data JSONB, -- Custom data sent with verification request

  -- PortOne metadata
  pg_provider TEXT DEFAULT 'danal',
  pg_tx_id TEXT, -- Transaction ID from PG provider
  pg_raw_response JSONB, -- Raw response from PG provider

  -- Timestamps
  requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Additional metadata
  metadata JSONB DEFAULT '{}'::jsonb
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_identity_verifications_verification_id ON identity_verifications(verification_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_user_id ON identity_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_status ON identity_verifications(status);
CREATE INDEX IF NOT EXISTS idx_identity_verifications_created_at ON identity_verifications(created_at DESC);

-- Create index on ci/di for duplicate checking
CREATE INDEX IF NOT EXISTS idx_identity_verifications_ci ON identity_verifications((verified_customer->>'ci'));
CREATE INDEX IF NOT EXISTS idx_identity_verifications_di ON identity_verifications((verified_customer->>'di'));

-- Enable Row Level Security
ALTER TABLE identity_verifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for identity_verifications
-- Users can view their own verifications
CREATE POLICY "Users can view own verifications"
  ON identity_verifications
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can manage all verifications
CREATE POLICY "Service role full access"
  ON identity_verifications
  FOR ALL
  USING (auth.role() = 'service_role');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_identity_verifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER identity_verifications_updated_at
  BEFORE UPDATE ON identity_verifications
  FOR EACH ROW
  EXECUTE FUNCTION update_identity_verifications_updated_at();

-- Add comments for documentation
COMMENT ON TABLE identity_verifications IS 'Stores identity verification records using PortOne V2 Danal service';
COMMENT ON COLUMN identity_verifications.verification_id IS 'Unique identifier from PortOne (identityVerificationId)';
COMMENT ON COLUMN identity_verifications.verified_customer IS 'Verified customer information including ci, di, name, gender, birthDate, phoneNumber, operator, isForeigner';
COMMENT ON COLUMN identity_verifications.status IS 'Verification status: READY (pending), VERIFIED (success), FAILED (failed)';
COMMENT ON COLUMN identity_verifications.pg_tx_id IS 'Transaction ID from payment gateway provider';
