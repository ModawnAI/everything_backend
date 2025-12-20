-- Migration: Add customer memos table
-- Description: Create table for shop owners to store notes about customers
-- Version: 082
-- Safe to re-run: Yes (uses IF NOT EXISTS and DROP IF EXISTS)

-- Create customer_memos table
CREATE TABLE IF NOT EXISTS customer_memos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  customer_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  memo TEXT NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(shop_id, customer_user_id)
);

-- Add comments
COMMENT ON TABLE customer_memos IS 'Stores shop owner notes/memos about individual customers';
COMMENT ON COLUMN customer_memos.shop_id IS 'The shop that owns this memo';
COMMENT ON COLUMN customer_memos.customer_user_id IS 'The customer this memo is about';
COMMENT ON COLUMN customer_memos.memo IS 'The memo content';
COMMENT ON COLUMN customer_memos.created_by IS 'The user who created/last updated the memo';

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_customer_memos_shop ON customer_memos(shop_id);
CREATE INDEX IF NOT EXISTS idx_customer_memos_customer ON customer_memos(customer_user_id);
CREATE INDEX IF NOT EXISTS idx_customer_memos_shop_customer ON customer_memos(shop_id, customer_user_id);

-- Enable RLS
ALTER TABLE customer_memos ENABLE ROW LEVEL SECURITY;

-- Drop existing policies before creating (to make migration idempotent)
DROP POLICY IF EXISTS "Shop owners can view their customer memos" ON customer_memos;
DROP POLICY IF EXISTS "Shop owners can insert customer memos" ON customer_memos;
DROP POLICY IF EXISTS "Shop owners can update their customer memos" ON customer_memos;
DROP POLICY IF EXISTS "Shop owners can delete their customer memos" ON customer_memos;
DROP POLICY IF EXISTS "Service role has full access to customer_memos" ON customer_memos;

-- RLS Policies
-- Shop owners can view memos for their shop
CREATE POLICY "Shop owners can view their customer memos"
ON customer_memos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_memos.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- Shop owners can insert memos for their shop
CREATE POLICY "Shop owners can insert customer memos"
ON customer_memos FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_memos.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- Shop owners can update memos for their shop
CREATE POLICY "Shop owners can update their customer memos"
ON customer_memos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_memos.shop_id
    AND shops.owner_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_memos.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- Shop owners can delete memos for their shop
CREATE POLICY "Shop owners can delete their customer memos"
ON customer_memos FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM shops
    WHERE shops.id = customer_memos.shop_id
    AND shops.owner_id = auth.uid()
  )
);

-- Service role can do everything (for admin operations)
CREATE POLICY "Service role has full access to customer_memos"
ON customer_memos FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_customer_memos_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger (to make migration idempotent)
DROP TRIGGER IF EXISTS trigger_update_customer_memos_updated_at ON customer_memos;
CREATE TRIGGER trigger_update_customer_memos_updated_at
  BEFORE UPDATE ON customer_memos
  FOR EACH ROW
  EXECUTE FUNCTION update_customer_memos_updated_at();
