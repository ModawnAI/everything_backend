-- Migration: Create shop_reports table for shop moderation
-- Description: Creates the shop_reports table to track reports against shops

CREATE TABLE IF NOT EXISTS shop_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_type VARCHAR(50) NOT NULL CHECK (report_type IN (
    'inappropriate_content',
    'spam',
    'fake_listing',
    'harassment',
    'other'
  )),
  title VARCHAR(255) NOT NULL CHECK (LENGTH(title) >= 5 AND LENGTH(title) <= 255),
  description TEXT NOT NULL CHECK (LENGTH(description) >= 10 AND LENGTH(description) <= 2000),
  evidence_urls TEXT[], -- Array of URLs to evidence
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN (
    'pending',
    'under_review',
    'resolved',
    'dismissed'
  )),
  admin_notes TEXT CHECK (LENGTH(admin_notes) <= 1000),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient queries
CREATE INDEX idx_shop_reports_shop_id ON shop_reports(shop_id);
CREATE INDEX idx_shop_reports_reporter_id ON shop_reports(reporter_id);
CREATE INDEX idx_shop_reports_status ON shop_reports(status);
CREATE INDEX idx_shop_reports_report_type ON shop_reports(report_type);
CREATE INDEX idx_shop_reports_created_at ON shop_reports(created_at DESC);

-- Add RLS policies
ALTER TABLE shop_reports ENABLE ROW LEVEL SECURITY;

-- Admins can view all shop reports
CREATE POLICY "Admins can view all shop reports"
  ON shop_reports
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Users can view their own reports
CREATE POLICY "Users can view their own shop reports"
  ON shop_reports
  FOR SELECT
  TO authenticated
  USING (reporter_id = auth.uid());

-- Users can create shop reports
CREATE POLICY "Users can create shop reports"
  ON shop_reports
  FOR INSERT
  TO authenticated
  WITH CHECK (reporter_id = auth.uid());

-- Admins can update shop reports
CREATE POLICY "Admins can update shop reports"
  ON shop_reports
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admins
      WHERE admins.id = auth.uid()
      AND admins.is_active = true
    )
  );

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_reports_updated_at
  BEFORE UPDATE ON shop_reports
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_reports_updated_at();

-- Add comment
COMMENT ON TABLE shop_reports IS 'Reports submitted against shops for policy violations';
