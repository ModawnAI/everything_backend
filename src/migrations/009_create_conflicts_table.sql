-- Migration: Create conflicts table
-- This table tracks all conflict detection and resolution operations

CREATE TABLE IF NOT EXISTS conflicts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL CHECK (type IN (
    'time_overlap', 'resource_shortage', 'staff_unavailable', 
    'capacity_exceeded', 'double_booking', 'service_conflict', 'payment_conflict'
  )),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  affected_reservations UUID[] NOT NULL, -- Array of reservation IDs
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES users(id),
  resolution_method TEXT CHECK (resolution_method IN (
    'automatic_reschedule', 'manual_reschedule', 'cancellation', 
    'compensation', 'priority_override', 'resource_reallocation'
  )),
  compensation JSONB, -- Compensation details
  metadata JSONB, -- Additional conflict data
  
  -- Indexes for performance
  CONSTRAINT idx_conflicts_shop_id ON conflicts(shop_id),
  CONSTRAINT idx_conflicts_type ON conflicts(type),
  CONSTRAINT idx_conflicts_severity ON conflicts(severity),
  CONSTRAINT idx_conflicts_detected_at ON conflicts(detected_at),
  CONSTRAINT idx_conflicts_resolved_at ON conflicts(resolved_at)
);

-- Create RLS policies for conflicts
ALTER TABLE conflicts ENABLE ROW LEVEL SECURITY;

-- Shop owners can view conflicts for their shops
CREATE POLICY "Shop owners can view shop conflicts" ON conflicts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s 
      WHERE s.id = conflicts.shop_id 
      AND s.owner_id = auth.uid()
    )
  );

-- Admins can view all conflicts
CREATE POLICY "Admins can view all conflicts" ON conflicts
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.user_role = 'admin'
    )
  );

-- Shop owners can update conflicts for their shops
CREATE POLICY "Shop owners can update shop conflicts" ON conflicts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM shops s 
      WHERE s.id = conflicts.shop_id 
      AND s.owner_id = auth.uid()
    )
  );

-- Admins can update all conflicts
CREATE POLICY "Admins can update all conflicts" ON conflicts
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM users u 
      WHERE u.id = auth.uid() 
      AND u.user_role = 'admin'
    )
  );

-- System can insert conflicts (for automated detection)
CREATE POLICY "System can insert conflicts" ON conflicts
  FOR INSERT WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE conflicts IS 'Tracks all conflict detection and resolution operations for audit and analytics';

-- Add comments to columns
COMMENT ON COLUMN conflicts.id IS 'Unique identifier for the conflict record';
COMMENT ON COLUMN conflicts.type IS 'Type of conflict detected';
COMMENT ON COLUMN conflicts.severity IS 'Severity level of the conflict';
COMMENT ON COLUMN conflicts.description IS 'Human-readable description of the conflict';
COMMENT ON COLUMN conflicts.affected_reservations IS 'Array of reservation IDs affected by this conflict';
COMMENT ON COLUMN conflicts.shop_id IS 'Reference to the shop where the conflict occurred';
COMMENT ON COLUMN conflicts.detected_at IS 'When the conflict was detected';
COMMENT ON COLUMN conflicts.resolved_at IS 'When the conflict was resolved (if resolved)';
COMMENT ON COLUMN conflicts.resolved_by IS 'User who resolved the conflict';
COMMENT ON COLUMN conflicts.resolution_method IS 'Method used to resolve the conflict';
COMMENT ON COLUMN conflicts.compensation IS 'Compensation details if applicable';
COMMENT ON COLUMN conflicts.metadata IS 'Additional conflict data and context'; 