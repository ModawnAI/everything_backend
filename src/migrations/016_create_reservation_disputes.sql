-- Migration: 016_create_reservation_disputes.sql
-- Description: Create reservation disputes table for admin dispute resolution
-- Author: Task Master AI
-- Created: 2025-07-29

-- Reservation disputes table
-- Tracks all disputes and complaints related to reservations
CREATE TABLE public.reservation_disputes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  dispute_type VARCHAR(50) NOT NULL CHECK (dispute_type IN ('customer_complaint', 'shop_issue', 'payment_dispute', 'service_quality', 'other')),
  description TEXT NOT NULL,
  requested_action VARCHAR(50) NOT NULL CHECK (requested_action IN ('refund', 'reschedule', 'compensation', 'investigation', 'other')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'investigating', 'resolved', 'closed')),
  evidence TEXT[], -- Array of evidence file URLs
  resolution_notes TEXT,
  resolution_action VARCHAR(50),
  resolved_amount INTEGER, -- Amount refunded/compensated
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  resolved_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_reservation_disputes_reservation_id ON public.reservation_disputes(reservation_id);
CREATE INDEX idx_reservation_disputes_status ON public.reservation_disputes(status);
CREATE INDEX idx_reservation_disputes_priority ON public.reservation_disputes(priority);
CREATE INDEX idx_reservation_disputes_dispute_type ON public.reservation_disputes(dispute_type);
CREATE INDEX idx_reservation_disputes_created_by ON public.reservation_disputes(created_by);
CREATE INDEX idx_reservation_disputes_created_at ON public.reservation_disputes(created_at);

-- Add comments for documentation
COMMENT ON TABLE public.reservation_disputes IS 'Tracks all disputes and complaints related to reservations for admin resolution';
COMMENT ON COLUMN public.reservation_disputes.reservation_id IS 'Reference to the reservation being disputed';
COMMENT ON COLUMN public.reservation_disputes.dispute_type IS 'Type of dispute (customer_complaint, shop_issue, payment_dispute, service_quality, other)';
COMMENT ON COLUMN public.reservation_disputes.description IS 'Detailed description of the dispute';
COMMENT ON COLUMN public.reservation_disputes.requested_action IS 'Action requested by the complainant';
COMMENT ON COLUMN public.reservation_disputes.priority IS 'Priority level of the dispute';
COMMENT ON COLUMN public.reservation_disputes.status IS 'Current status of the dispute resolution';
COMMENT ON COLUMN public.reservation_disputes.evidence IS 'Array of evidence file URLs';
COMMENT ON COLUMN public.reservation_disputes.resolution_notes IS 'Admin notes about the resolution';
COMMENT ON COLUMN public.reservation_disputes.resolution_action IS 'Action taken to resolve the dispute';
COMMENT ON COLUMN public.reservation_disputes.resolved_amount IS 'Amount refunded or compensated';
COMMENT ON COLUMN public.reservation_disputes.created_by IS 'User who created the dispute';
COMMENT ON COLUMN public.reservation_disputes.resolved_by IS 'Admin who resolved the dispute';
COMMENT ON COLUMN public.reservation_disputes.resolved_at IS 'Timestamp when dispute was resolved';

-- RLS policies for reservation disputes
ALTER TABLE public.reservation_disputes ENABLE ROW LEVEL SECURITY;

-- Admin users can read all disputes
CREATE POLICY "Admin can read all reservation disputes" ON public.reservation_disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Admin users can insert disputes
CREATE POLICY "Admin can insert reservation disputes" ON public.reservation_disputes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Admin users can update disputes
CREATE POLICY "Admin can update reservation disputes" ON public.reservation_disputes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Shop owners can read disputes for their reservations
CREATE POLICY "Shop owners can read their reservation disputes" ON public.reservation_disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.shops s ON s.id = r.shop_id
      WHERE r.id = reservation_disputes.reservation_id 
      AND s.owner_id = auth.uid()
    )
  );

-- Customers can read disputes for their reservations
CREATE POLICY "Customers can read their reservation disputes" ON public.reservation_disputes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.reservations 
      WHERE id = reservation_disputes.reservation_id 
      AND user_id = auth.uid()
    )
  );

-- Function to automatically update dispute status timestamps
CREATE OR REPLACE FUNCTION update_dispute_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Update resolved_at when status changes to resolved or closed
  IF NEW.status IN ('resolved', 'closed') AND OLD.status NOT IN ('resolved', 'closed') THEN
    NEW.resolved_at = NOW();
    NEW.resolved_by = auth.uid();
  END IF;
  
  -- Update updated_at
  NEW.updated_at = NOW();
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update timestamps
CREATE TRIGGER trigger_update_dispute_timestamps
  BEFORE UPDATE ON public.reservation_disputes
  FOR EACH ROW
  EXECUTE FUNCTION update_dispute_timestamps();

-- Function to log admin actions for dispute management
CREATE OR REPLACE FUNCTION log_dispute_admin_action()
RETURNS TRIGGER AS $$
BEGIN
  -- Insert into admin_actions table for audit trail
  INSERT INTO public.admin_actions (
    admin_id,
    action_type,
    target_type,
    target_id,
    reason,
    metadata,
    created_at
  ) VALUES (
    COALESCE(NEW.resolved_by, NEW.created_by),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'dispute_created'
      WHEN TG_OP = 'UPDATE' AND NEW.status IN ('resolved', 'closed') THEN 'dispute_resolved'
      ELSE 'dispute_updated'
    END,
    'reservation_dispute',
    NEW.id,
    NEW.description,
    jsonb_build_object(
      'dispute_type', NEW.dispute_type,
      'requested_action', NEW.requested_action,
      'priority', NEW.priority,
      'status', NEW.status,
      'resolution_action', NEW.resolution_action,
      'resolved_amount', NEW.resolved_amount,
      'reservation_id', NEW.reservation_id
    ),
    COALESCE(NEW.resolved_at, NEW.created_at)
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log admin actions
CREATE TRIGGER trigger_log_dispute_admin_action
  AFTER INSERT OR UPDATE ON public.reservation_disputes
  FOR EACH ROW
  EXECUTE FUNCTION log_dispute_admin_action(); 