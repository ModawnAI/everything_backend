-- Migration: Create app popups tables
-- Created: 2024-12-18
-- Description: Tables for managing app popup banners and dismissal tracking

-- App popups table
CREATE TABLE IF NOT EXISTS app_popups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  image_url TEXT NOT NULL,
  link_url TEXT,
  link_type VARCHAR(20) DEFAULT 'none', -- none, internal, external
  display_order INT DEFAULT 0,
  active BOOLEAN DEFAULT TRUE,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  target_audience VARCHAR(20) DEFAULT 'all', -- all, new_users, returning
  view_count INT DEFAULT 0,
  click_count INT DEFAULT 0,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Popup dismissals tracking
CREATE TABLE IF NOT EXISTS popup_dismissals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  device_id VARCHAR(100),
  popup_id UUID NOT NULL REFERENCES app_popups(id) ON DELETE CASCADE,
  dismiss_type VARCHAR(20) NOT NULL, -- close, never_show
  dismissed_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_popups_active ON app_popups(active, display_order);
CREATE INDEX IF NOT EXISTS idx_popups_dates ON app_popups(start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_dismissals_user ON popup_dismissals(user_id, popup_id);
CREATE INDEX IF NOT EXISTS idx_dismissals_device ON popup_dismissals(device_id, popup_id);

-- Unique constraints for dismissals (using partial unique indexes)
CREATE UNIQUE INDEX IF NOT EXISTS idx_dismissals_user_popup_unique
  ON popup_dismissals(user_id, popup_id)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_dismissals_device_popup_unique
  ON popup_dismissals(device_id, popup_id)
  WHERE device_id IS NOT NULL;

-- Comments
COMMENT ON TABLE app_popups IS 'App popup banners displayed on app open';
COMMENT ON COLUMN app_popups.link_type IS 'Type of link action: none (no action), internal (app navigation), external (browser)';
COMMENT ON COLUMN app_popups.target_audience IS 'Target audience: all, new_users, returning';
COMMENT ON COLUMN app_popups.view_count IS 'Number of times the popup was viewed';
COMMENT ON COLUMN app_popups.click_count IS 'Number of times the popup was clicked';

COMMENT ON TABLE popup_dismissals IS 'Tracks popup dismissals by users/devices';
COMMENT ON COLUMN popup_dismissals.dismiss_type IS 'Type of dismissal: close (temporary), never_show (permanent)';

-- Function to increment view count
CREATE OR REPLACE FUNCTION increment_popup_view_count(popup_ids UUID[])
RETURNS void AS $$
BEGIN
  UPDATE app_popups
  SET view_count = view_count + 1,
      updated_at = NOW()
  WHERE id = ANY(popup_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment click count
CREATE OR REPLACE FUNCTION increment_popup_click_count(p_popup_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE app_popups
  SET click_count = click_count + 1,
      updated_at = NOW()
  WHERE id = p_popup_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RLS Policies for app_popups
ALTER TABLE app_popups ENABLE ROW LEVEL SECURITY;

-- Anyone can read active popups
CREATE POLICY "Anyone can read active popups"
  ON app_popups FOR SELECT
  USING (
    active = true
    AND (start_date IS NULL OR start_date <= NOW())
    AND (end_date IS NULL OR end_date >= NOW())
  );

-- Service role has full access
CREATE POLICY "Service role can manage popups"
  ON app_popups FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for popup_dismissals
ALTER TABLE popup_dismissals ENABLE ROW LEVEL SECURITY;

-- Users can read their own dismissals
CREATE POLICY "Users can read own dismissals"
  ON popup_dismissals FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own dismissals
CREATE POLICY "Users can insert own dismissals"
  ON popup_dismissals FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Service role has full access
CREATE POLICY "Service role can manage dismissals"
  ON popup_dismissals FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
