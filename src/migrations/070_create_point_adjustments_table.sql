-- Migration: Create point_adjustments table for admin point management
-- Description: Creates the point_adjustments table to track manual point adjustments by admins

CREATE TABLE IF NOT EXISTS point_adjustments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL CHECK (amount > 0),
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add', 'subtract', 'expire')),
  reason TEXT NOT NULL CHECK (LENGTH(reason) >= 5 AND LENGTH(reason) <= 500),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'customer_service',
    'promotional',
    'error_correction',
    'system_maintenance',
    'fraud_prevention',
    'other'
  )),
  notes TEXT CHECK (LENGTH(notes) <= 1000),
  previous_balance INTEGER NOT NULL,
  new_balance INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_point_adjustments_user_id ON point_adjustments(user_id);
CREATE INDEX idx_point_adjustments_admin_id ON point_adjustments(admin_id);
CREATE INDEX idx_point_adjustments_created_at ON point_adjustments(created_at DESC);
CREATE INDEX idx_point_adjustments_category ON point_adjustments(category);

-- Add RLS policies
ALTER TABLE point_adjustments ENABLE ROW LEVEL SECURITY;

-- Admin can view all adjustments
CREATE POLICY "Admins can view all point adjustments"
  ON point_adjustments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Admin can insert adjustments
CREATE POLICY "Admins can insert point adjustments"
  ON point_adjustments
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_point_adjustments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER point_adjustments_updated_at
  BEFORE UPDATE ON point_adjustments
  FOR EACH ROW
  EXECUTE FUNCTION update_point_adjustments_updated_at();

-- Add comment
COMMENT ON TABLE point_adjustments IS 'Tracks manual point adjustments made by administrators';
