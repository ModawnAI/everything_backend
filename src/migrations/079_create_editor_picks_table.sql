-- Migration: Create editor_picks table
-- Created: 2024-12-18
-- Description: Table for managing editor's pick featured shops on home page

-- Editor's Pick table
CREATE TABLE IF NOT EXISTS editor_picks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  title VARCHAR(200),
  description TEXT,
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  start_date DATE,
  end_date DATE,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_editor_picks_active ON editor_picks(active, display_order);
CREATE INDEX IF NOT EXISTS idx_editor_picks_dates ON editor_picks(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_editor_picks_shop_id ON editor_picks(shop_id);

-- Comments
COMMENT ON TABLE editor_picks IS 'Featured shops selected by editors for display on home page';
COMMENT ON COLUMN editor_picks.title IS 'Custom title for the featured shop (optional, uses shop name if null)';
COMMENT ON COLUMN editor_picks.description IS 'Reason or description for the recommendation';
COMMENT ON COLUMN editor_picks.display_order IS 'Order in which picks are displayed (lower = first)';
COMMENT ON COLUMN editor_picks.active IS 'Whether this pick is currently active';
COMMENT ON COLUMN editor_picks.start_date IS 'Date when the pick becomes visible (null = immediately)';
COMMENT ON COLUMN editor_picks.end_date IS 'Date when the pick stops being visible (null = indefinitely)';

-- RLS Policies
ALTER TABLE editor_picks ENABLE ROW LEVEL SECURITY;

-- Allow read access for active picks to all users
CREATE POLICY "Anyone can read active editor picks"
  ON editor_picks FOR SELECT
  USING (
    active = true
    AND (start_date IS NULL OR start_date <= CURRENT_DATE)
    AND (end_date IS NULL OR end_date >= CURRENT_DATE)
  );

-- Allow full access for admin users
CREATE POLICY "Admins can manage editor picks"
  ON editor_picks FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.status = 'active'
    )
  );

-- Allow service role full access
CREATE POLICY "Service role can manage editor picks"
  ON editor_picks FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
