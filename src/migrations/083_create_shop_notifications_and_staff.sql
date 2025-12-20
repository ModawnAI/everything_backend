-- ============================================
-- Migration 083: Shop Notifications & Staff Management
-- ============================================
-- This migration creates tables for:
-- 1. Shop notifications (announcements from super admin to shops)
-- 2. Shop notification receipts (tracking delivery and read status)
-- 3. Shop staff management (staff members for revenue tracking)
-- ============================================

-- ============================================
-- Shop Notifications Table
-- ============================================
CREATE TABLE IF NOT EXISTS shop_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  notification_type VARCHAR(50) DEFAULT 'announcement', -- announcement, update, alert, promotion
  priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
  target_categories VARCHAR(50)[], -- null = all shops, or specific categories
  send_push BOOLEAN DEFAULT true,
  send_in_app BOOLEAN DEFAULT true,
  scheduled_at TIMESTAMP WITH TIME ZONE,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Track which shops received/read notifications
CREATE TABLE IF NOT EXISTS shop_notification_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id UUID NOT NULL REFERENCES shop_notifications(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  read_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(notification_id, shop_id)
);

-- Indexes for notifications
CREATE INDEX IF NOT EXISTS idx_shop_notifications_sent ON shop_notifications(sent_at DESC);
CREATE INDEX IF NOT EXISTS idx_shop_notifications_type ON shop_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_shop_notifications_created_by ON shop_notifications(created_by);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_shop ON shop_notification_receipts(shop_id);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_notification ON shop_notification_receipts(notification_id);
CREATE INDEX IF NOT EXISTS idx_notification_receipts_unread ON shop_notification_receipts(shop_id) WHERE read_at IS NULL;

-- ============================================
-- Shop Staff Management Table
-- ============================================
CREATE TABLE IF NOT EXISTS shop_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  nickname VARCHAR(100),
  profile_image TEXT,
  role VARCHAR(50) DEFAULT 'staff', -- owner, manager, staff
  phone VARCHAR(20),
  email VARCHAR(255),
  commission_rate DECIMAL(5, 2) DEFAULT 0, -- Commission percentage
  is_active BOOLEAN DEFAULT true,
  hire_date DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for staff lookups
CREATE INDEX IF NOT EXISTS idx_shop_staff_shop ON shop_staff(shop_id);
CREATE INDEX IF NOT EXISTS idx_shop_staff_active ON shop_staff(shop_id) WHERE is_active = true;

-- Link reservations to staff (if not already exists)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'reservations' AND column_name = 'staff_id'
  ) THEN
    ALTER TABLE reservations ADD COLUMN staff_id UUID REFERENCES shop_staff(id);
    CREATE INDEX idx_reservations_staff ON reservations(staff_id);
  END IF;
END $$;

-- ============================================
-- RLS Policies for shop_notifications
-- ============================================
ALTER TABLE shop_notifications ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything with shop_notifications
CREATE POLICY shop_notifications_superadmin_all ON shop_notifications
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- ============================================
-- RLS Policies for shop_notification_receipts
-- ============================================
ALTER TABLE shop_notification_receipts ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY shop_notification_receipts_superadmin_all ON shop_notification_receipts
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Shop owners can read their own notification receipts
CREATE POLICY shop_notification_receipts_shop_owner_select ON shop_notification_receipts
  FOR SELECT
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );

-- Shop owners can update their own notification receipts (to mark as read)
CREATE POLICY shop_notification_receipts_shop_owner_update ON shop_notification_receipts
  FOR UPDATE
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );

-- ============================================
-- RLS Policies for shop_staff
-- ============================================
ALTER TABLE shop_staff ENABLE ROW LEVEL SECURITY;

-- Super admins can do everything
CREATE POLICY shop_staff_superadmin_all ON shop_staff
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'super_admin'
    )
  );

-- Shop owners can manage their own staff
CREATE POLICY shop_staff_shop_owner_all ON shop_staff
  FOR ALL
  TO authenticated
  USING (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  )
  WITH CHECK (
    shop_id IN (
      SELECT id FROM shops WHERE owner_id = auth.uid()
    )
  );

-- Users can view staff of shops (for public display of staff on services)
CREATE POLICY shop_staff_public_select ON shop_staff
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- ============================================
-- Views for Analytics
-- ============================================

-- Staff revenue summary view
CREATE OR REPLACE VIEW staff_revenue_summary AS
SELECT
  s.id AS staff_id,
  s.shop_id,
  s.name AS staff_name,
  s.nickname AS staff_nickname,
  s.role AS staff_role,
  s.commission_rate,
  COUNT(r.id) AS total_reservations,
  SUM(CASE WHEN r.status = 'completed' THEN COALESCE(p.amount, 0) ELSE 0 END) AS total_revenue,
  COUNT(CASE WHEN r.status = 'completed' THEN 1 END) AS completed_count,
  AVG(rev.rating) AS avg_rating
FROM shop_staff s
LEFT JOIN reservations r ON r.staff_id = s.id
LEFT JOIN payments p ON p.reservation_id = r.id
LEFT JOIN reviews rev ON rev.reservation_id = r.id
WHERE s.is_active = true
GROUP BY s.id, s.shop_id, s.name, s.nickname, s.role, s.commission_rate;

-- Grant access to the view
GRANT SELECT ON staff_revenue_summary TO authenticated;

-- ============================================
-- Updated_at triggers
-- ============================================
CREATE OR REPLACE FUNCTION update_shop_notifications_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_notifications_updated_at_trigger
  BEFORE UPDATE ON shop_notifications
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_notifications_updated_at();

CREATE OR REPLACE FUNCTION update_shop_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shop_staff_updated_at_trigger
  BEFORE UPDATE ON shop_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_staff_updated_at();
