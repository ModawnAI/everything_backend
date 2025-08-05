-- Migration: Create reservation reschedule history table
-- This table tracks all reschedule operations for audit and analytics

CREATE TABLE IF NOT EXISTS reservation_reschedule_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  old_date DATE NOT NULL,
  old_time TIME NOT NULL,
  new_date DATE NOT NULL,
  new_time TIME NOT NULL,
  reason TEXT,
  requested_by TEXT NOT NULL CHECK (requested_by IN ('user', 'shop', 'admin')),
  requested_by_id UUID NOT NULL,
  fees INTEGER DEFAULT 0, -- Reschedule fees in won
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT idx_reservation_reschedule_history_reservation_id 
    ON reservation_reschedule_history(reservation_id),
  CONSTRAINT idx_reservation_reschedule_history_shop_id 
    ON reservation_reschedule_history(shop_id),
  CONSTRAINT idx_reservation_reschedule_history_timestamp 
    ON reservation_reschedule_history(timestamp),
  CONSTRAINT idx_reservation_reschedule_history_requested_by 
    ON reservation_reschedule_history(requested_by)
);

-- Create RLS policies for reservation_reschedule_history
ALTER TABLE reservation_reschedule_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own reschedule history
CREATE POLICY "Users can view own reschedule history" ON reservation_reschedule_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM reservations r 
      WHERE r.id = reservation_reschedule_history.reservation_id 
      AND r.user_id = auth.uid()
    )
  );

-- Shop owners can view reschedule history for their shops
CREATE POLICY "Shop owners can view shop reschedule history" ON reservation_reschedule_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM shops s 
      WHERE s.id = reservation_reschedule_history.shop_id 
      AND s.owner_id = auth.uid()
    )
  );

-- Admins can view all reschedule history
CREATE POLICY "Admins can view all reschedule history" ON reservation_reschedule_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM user_profiles up 
      WHERE up.user_id = auth.uid() 
      AND up.user_role = 'admin'
    )
  );

-- System can insert reschedule history (for automated operations)
CREATE POLICY "System can insert reschedule history" ON reservation_reschedule_history
  FOR INSERT WITH CHECK (true);

-- Add comment to table
COMMENT ON TABLE reservation_reschedule_history IS 'Tracks all reservation reschedule operations for audit and analytics';

-- Add comments to columns
COMMENT ON COLUMN reservation_reschedule_history.id IS 'Unique identifier for the reschedule record';
COMMENT ON COLUMN reservation_reschedule_history.reservation_id IS 'Reference to the reservation being rescheduled';
COMMENT ON COLUMN reservation_reschedule_history.shop_id IS 'Reference to the shop for analytics';
COMMENT ON COLUMN reservation_reschedule_history.old_date IS 'Original reservation date';
COMMENT ON COLUMN reservation_reschedule_history.old_time IS 'Original reservation time';
COMMENT ON COLUMN reservation_reschedule_history.new_date IS 'New reservation date';
COMMENT ON COLUMN reservation_reschedule_history.new_time IS 'New reservation time';
COMMENT ON COLUMN reservation_reschedule_history.reason IS 'Reason for rescheduling (optional)';
COMMENT ON COLUMN reservation_reschedule_history.requested_by IS 'Who requested the reschedule (user/shop/admin)';
COMMENT ON COLUMN reservation_reschedule_history.requested_by_id IS 'ID of the user who requested the reschedule';
COMMENT ON COLUMN reservation_reschedule_history.fees IS 'Reschedule fees charged (in won)';
COMMENT ON COLUMN reservation_reschedule_history.timestamp IS 'When the reschedule occurred'; 