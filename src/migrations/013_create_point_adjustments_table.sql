-- Migration: 013_create_point_adjustments_table.sql
-- Description: Create point adjustments table for admin point adjustment system with approval workflows
-- Author: Task Master AI
-- Created: 2025-01-27

-- Point Adjustments Table
-- Tracks all admin point adjustments with approval workflows and audit logging
CREATE TABLE IF NOT EXISTS point_adjustments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL, -- Positive amount for add/subtract/expire
  adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('add', 'subtract', 'expire')),
  reason TEXT NOT NULL,
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'customer_service', 'system_error', 'fraud_prevention', 
    'promotional', 'compensation', 'technical_issue', 'other'
  )),
  adjusted_by UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  previous_balance INTEGER NOT NULL DEFAULT 0,
  new_balance INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'completed')),
  approval_level INTEGER,
  approved_by UUID REFERENCES users(id) ON DELETE SET NULL,
  approved_at TIMESTAMP WITH TIME ZONE,
  rejected_by UUID REFERENCES users(id) ON DELETE SET NULL,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  transaction_id UUID REFERENCES point_transactions(id) ON DELETE SET NULL,
  audit_log_id UUID NOT NULL REFERENCES admin_actions(id) ON DELETE RESTRICT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_point_adjustments_user_id ON point_adjustments(user_id);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_adjusted_by ON point_adjustments(adjusted_by);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_status ON point_adjustments(status);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_category ON point_adjustments(category);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_created_at ON point_adjustments(created_at);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_approval_level ON point_adjustments(approval_level);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_audit_log_id ON point_adjustments(audit_log_id);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_point_adjustments_user_status ON point_adjustments(user_id, status);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_status_created ON point_adjustments(status, created_at);
CREATE INDEX IF NOT EXISTS idx_point_adjustments_category_created ON point_adjustments(category, created_at);

-- Add trigger to update updated_at column
CREATE TRIGGER update_point_adjustments_updated_at 
  BEFORE UPDATE ON point_adjustments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add RLS policies for point_adjustments table
ALTER TABLE point_adjustments ENABLE ROW LEVEL SECURITY;

-- Policy: Admins can view all adjustments
CREATE POLICY "Admins can view all point adjustments" ON point_adjustments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can create adjustments
CREATE POLICY "Admins can create point adjustments" ON point_adjustments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('admin', 'super_admin')
    )
  );

-- Policy: Admins can update adjustments (for approval/rejection)
CREATE POLICY "Admins can update point adjustments" ON point_adjustments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role IN ('admin', 'super_admin')
    )
  );

-- Policy: Users can view their own adjustments (read-only)
CREATE POLICY "Users can view their own point adjustments" ON point_adjustments
  FOR SELECT USING (
    user_id = auth.uid()
  );

-- Create view for adjustment statistics
CREATE OR REPLACE VIEW point_adjustment_stats AS
SELECT 
  DATE_TRUNC('day', created_at) as date,
  category,
  adjustment_type,
  status,
  COUNT(*) as count,
  SUM(amount) as total_amount,
  AVG(amount) as average_amount
FROM point_adjustments
GROUP BY DATE_TRUNC('day', created_at), category, adjustment_type, status
ORDER BY date DESC, category, adjustment_type, status;

-- Create view for pending approvals
CREATE OR REPLACE VIEW pending_point_adjustments AS
SELECT 
  pa.id,
  pa.user_id,
  u.name as user_name,
  u.email as user_email,
  pa.amount,
  pa.adjustment_type,
  pa.reason,
  pa.category,
  pa.previous_balance,
  pa.approval_level,
  pa.created_at,
  pa.notes,
  admin.name as adjusted_by_name,
  admin.email as adjusted_by_email
FROM point_adjustments pa
JOIN users u ON pa.user_id = u.id
JOIN users admin ON pa.adjusted_by = admin.id
WHERE pa.status = 'pending'
ORDER BY pa.created_at ASC;

-- Add comment for documentation
COMMENT ON TABLE point_adjustments IS 'Tracks admin point adjustments with approval workflows and audit logging';
COMMENT ON COLUMN point_adjustments.adjustment_type IS 'Type of adjustment: add, subtract, or expire';
COMMENT ON COLUMN point_adjustments.category IS 'Category for organizing adjustments by reason';
COMMENT ON COLUMN point_adjustments.approval_level IS 'Required approval level based on amount thresholds';
COMMENT ON COLUMN point_adjustments.status IS 'Current status: pending, approved, rejected, or completed';
COMMENT ON COLUMN point_adjustments.audit_log_id IS 'Reference to admin_actions table for audit trail'; 