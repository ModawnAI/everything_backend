-- Migration: Add shop entry requests table
-- Description: Create table for users to request shops to be added to the platform
-- Version: 081
-- Safe to re-run: Yes (uses IF NOT EXISTS and DROP IF EXISTS)

-- Create shop_entry_requests table
CREATE TABLE IF NOT EXISTS shop_entry_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  requester_email VARCHAR(255),
  requester_phone VARCHAR(20),
  shop_name VARCHAR(200) NOT NULL,
  shop_address TEXT,
  shop_phone VARCHAR(20),
  shop_category VARCHAR(50),
  additional_info TEXT,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'contacted', 'registered', 'rejected')),
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments
COMMENT ON TABLE shop_entry_requests IS 'Stores user requests for adding new shops to the platform';
COMMENT ON COLUMN shop_entry_requests.status IS 'Status: pending, contacted, registered, rejected';
COMMENT ON COLUMN shop_entry_requests.requester_user_id IS 'Optional - user who submitted the request (if logged in)';
COMMENT ON COLUMN shop_entry_requests.requester_email IS 'Contact email for the requester';
COMMENT ON COLUMN shop_entry_requests.requester_phone IS 'Contact phone for the requester';
COMMENT ON COLUMN shop_entry_requests.shop_category IS 'Category: nail, eyelash, waxing, hair, other';

-- Create indexes (IF NOT EXISTS is supported)
CREATE INDEX IF NOT EXISTS idx_shop_entry_requests_status ON shop_entry_requests(status);
CREATE INDEX IF NOT EXISTS idx_shop_entry_requests_created ON shop_entry_requests(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_entry_requests_requester ON shop_entry_requests(requester_user_id) WHERE requester_user_id IS NOT NULL;

-- Enable RLS (safe to run multiple times)
ALTER TABLE shop_entry_requests ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before creating (to make migration idempotent)
DROP POLICY IF EXISTS "Anyone can submit shop entry request" ON shop_entry_requests;
DROP POLICY IF EXISTS "Users can view their own shop entry requests" ON shop_entry_requests;
DROP POLICY IF EXISTS "Service role has full access to shop_entry_requests" ON shop_entry_requests;

-- RLS Policies
-- Anyone can insert (public form submission)
CREATE POLICY "Anyone can submit shop entry request"
ON shop_entry_requests FOR INSERT
TO public
WITH CHECK (true);

-- Users can view their own requests
CREATE POLICY "Users can view their own shop entry requests"
ON shop_entry_requests FOR SELECT
TO authenticated
USING (requester_user_id = auth.uid());

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access to shop_entry_requests"
ON shop_entry_requests FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger for updated_at (CREATE OR REPLACE is safe)
CREATE OR REPLACE FUNCTION update_shop_entry_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (to make migration idempotent)
DROP TRIGGER IF EXISTS trigger_update_shop_entry_requests_updated_at ON shop_entry_requests;
CREATE TRIGGER trigger_update_shop_entry_requests_updated_at
  BEFORE UPDATE ON shop_entry_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_entry_requests_updated_at();
