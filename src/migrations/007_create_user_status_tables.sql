-- Migration: 007_create_user_status_tables.sql
-- Description: Create user status management tables for tracking status changes and violations
-- Author: Task Master AI
-- Created: 2025-07-29

-- User Status Changes Table
-- Tracks all user status transitions with audit trail
CREATE TABLE IF NOT EXISTS user_status_changes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  previous_status user_status NOT NULL,
  new_status user_status NOT NULL,
  reason TEXT NOT NULL,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  effective_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  
  -- Indexes for efficient querying
  CONSTRAINT user_status_changes_user_id_idx UNIQUE (user_id, created_at)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_status_changes_user_id ON user_status_changes(user_id);
CREATE INDEX IF NOT EXISTS idx_user_status_changes_admin_id ON user_status_changes(admin_id);
CREATE INDEX IF NOT EXISTS idx_user_status_changes_created_at ON user_status_changes(created_at);
CREATE INDEX IF NOT EXISTS idx_user_status_changes_new_status ON user_status_changes(new_status);

-- User Violations Table
-- Tracks user violations and policy violations
CREATE TABLE IF NOT EXISTS user_violations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  violation_type TEXT NOT NULL CHECK (
    violation_type IN (
      'spam', 
      'inappropriate_content', 
      'fraud', 
      'harassment', 
      'terms_violation', 
      'payment_fraud'
    )
  ),
  severity TEXT NOT NULL CHECK (
    severity IN ('low', 'medium', 'high', 'critical')
  ),
  description TEXT NOT NULL,
  evidence_url TEXT,
  reported_by UUID REFERENCES users(id) ON DELETE SET NULL,
  admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'reviewed', 'resolved', 'dismissed')
  ),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  
  -- Additional metadata
  violation_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  location_info JSONB, -- Store location data if applicable
  device_info JSONB, -- Store device information
  ip_address INET,
  user_agent TEXT
);

-- Create indexes for user violations
CREATE INDEX IF NOT EXISTS idx_user_violations_user_id ON user_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_violations_violation_type ON user_violations(violation_type);
CREATE INDEX IF NOT EXISTS idx_user_violations_severity ON user_violations(severity);
CREATE INDEX IF NOT EXISTS idx_user_violations_status ON user_violations(status);
CREATE INDEX IF NOT EXISTS idx_user_violations_created_at ON user_violations(created_at);
CREATE INDEX IF NOT EXISTS idx_user_violations_reported_by ON user_violations(reported_by);
CREATE INDEX IF NOT EXISTS idx_user_violations_admin_id ON user_violations(admin_id);

-- Composite index for efficient violation queries
CREATE INDEX IF NOT EXISTS idx_user_violations_user_severity_status ON user_violations(user_id, severity, status);

-- Add RLS policies for user_status_changes table
ALTER TABLE user_status_changes ENABLE ROW LEVEL SECURITY;

-- Users can view their own status changes
CREATE POLICY "Users can view own status changes" ON user_status_changes
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all status changes
CREATE POLICY "Admins can view all status changes" ON user_status_changes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Only admins can insert status changes
CREATE POLICY "Only admins can insert status changes" ON user_status_changes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Add RLS policies for user_violations table
ALTER TABLE user_violations ENABLE ROW LEVEL SECURITY;

-- Users can view their own violations
CREATE POLICY "Users can view own violations" ON user_violations
  FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all violations
CREATE POLICY "Admins can view all violations" ON user_violations
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Admins can insert violations
CREATE POLICY "Admins can insert violations" ON user_violations
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Admins can update violations
CREATE POLICY "Admins can update violations" ON user_violations
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Add comments for documentation
COMMENT ON TABLE user_status_changes IS 'Tracks all user status transitions with full audit trail';
COMMENT ON TABLE user_violations IS 'Tracks user violations and policy violations for automated status management';

COMMENT ON COLUMN user_status_changes.effective_date IS 'When the status change takes effect';
COMMENT ON COLUMN user_status_changes.admin_id IS 'Admin who made the status change (if applicable)';
COMMENT ON COLUMN user_violations.evidence_url IS 'URL to evidence/documentation of the violation';
COMMENT ON COLUMN user_violations.location_info IS 'JSON object containing location data if applicable';
COMMENT ON COLUMN user_violations.device_info IS 'JSON object containing device information'; 