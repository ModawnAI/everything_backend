-- Migration: 005_create_reservation_status_logs.sql
-- Description: Create reservation status logs table for state machine audit trail
-- Author: Task Master AI
-- Created: 2025-07-29

-- Create reservation status logs table for audit trail
CREATE TABLE public.reservation_status_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  from_status reservation_status NOT NULL,
  to_status reservation_status NOT NULL,
  changed_by TEXT NOT NULL CHECK (changed_by IN ('user', 'shop', 'system', 'admin')),
  changed_by_id UUID NOT NULL,
  reason TEXT,
  metadata JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX idx_reservation_status_logs_reservation_id ON public.reservation_status_logs(reservation_id);
CREATE INDEX idx_reservation_status_logs_timestamp ON public.reservation_status_logs(timestamp);
CREATE INDEX idx_reservation_status_logs_changed_by ON public.reservation_status_logs(changed_by);
CREATE INDEX idx_reservation_status_logs_from_status ON public.reservation_status_logs(from_status);
CREATE INDEX idx_reservation_status_logs_to_status ON public.reservation_status_logs(to_status);

-- Add comments for documentation
COMMENT ON TABLE public.reservation_status_logs IS 'Audit trail for reservation status changes';
COMMENT ON COLUMN public.reservation_status_logs.reservation_id IS 'Reference to the reservation being modified';
COMMENT ON COLUMN public.reservation_status_logs.from_status IS 'Previous status before the change';
COMMENT ON COLUMN public.reservation_status_logs.to_status IS 'New status after the change';
COMMENT ON COLUMN public.reservation_status_logs.changed_by IS 'Type of entity that made the change (user, shop, system, admin)';
COMMENT ON COLUMN public.reservation_status_logs.changed_by_id IS 'ID of the entity that made the change';
COMMENT ON COLUMN public.reservation_status_logs.reason IS 'Optional reason for the status change';
COMMENT ON COLUMN public.reservation_status_logs.metadata IS 'Additional metadata for the status change';
COMMENT ON COLUMN public.reservation_status_logs.timestamp IS 'When the status change occurred';

-- Add RLS policies for the logs table
ALTER TABLE public.reservation_status_logs ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view logs for their own reservations
CREATE POLICY "Users can view their own reservation status logs" ON public.reservation_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_status_logs.reservation_id
      AND r.user_id = auth.uid()
    )
  );

-- Policy: Shop owners can view logs for their shop's reservations
CREATE POLICY "Shop owners can view their shop's reservation status logs" ON public.reservation_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.shops s ON r.shop_id = s.id
      WHERE r.id = reservation_status_logs.reservation_id
      AND s.owner_id = auth.uid()
    )
  );

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all reservation status logs" ON public.reservation_status_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.user_role = 'admin'
    )
  );

-- Policy: System can insert logs (for automatic transitions)
CREATE POLICY "System can insert reservation status logs" ON public.reservation_status_logs
  FOR INSERT WITH CHECK (
    changed_by = 'system'
  );

-- Policy: Users can insert logs for their own reservations
CREATE POLICY "Users can insert logs for their own reservations" ON public.reservation_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      WHERE r.id = reservation_status_logs.reservation_id
      AND r.user_id = auth.uid()
    )
    AND changed_by = 'user'
  );

-- Policy: Shop owners can insert logs for their shop's reservations
CREATE POLICY "Shop owners can insert logs for their shop's reservations" ON public.reservation_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.shops s ON r.shop_id = s.id
      WHERE r.id = reservation_status_logs.reservation_id
      AND s.owner_id = auth.uid()
    )
    AND changed_by = 'shop'
  );

-- Policy: Admins can insert logs
CREATE POLICY "Admins can insert reservation status logs" ON public.reservation_status_logs
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid()
      AND u.user_role = 'admin'
    )
    AND changed_by = 'admin'
  ); 