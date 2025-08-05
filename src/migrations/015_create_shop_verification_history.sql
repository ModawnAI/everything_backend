-- Migration: 015_create_shop_verification_history.sql
-- Description: Create shop verification history table for admin approval workflow
-- Author: Task Master AI
-- Created: 2025-07-29

-- Shop verification history table
-- Tracks all verification actions and status changes for shops
CREATE TABLE public.shop_verification_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  previous_verification_status shop_verification_status,
  new_verification_status shop_verification_status NOT NULL,
  previous_shop_status shop_status,
  new_shop_status shop_status,
  action VARCHAR(50) NOT NULL CHECK (action IN ('approve', 'reject', 'request_revision', 'suspend', 'reactivate')),
  reason TEXT,
  admin_notes TEXT,
  verification_notes TEXT,
  reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_shop_verification_history_shop_id ON public.shop_verification_history(shop_id);
CREATE INDEX idx_shop_verification_history_reviewed_by ON public.shop_verification_history(reviewed_by);
CREATE INDEX idx_shop_verification_history_reviewed_at ON public.shop_verification_history(reviewed_at);
CREATE INDEX idx_shop_verification_history_action ON public.shop_verification_history(action);

-- Add comments for documentation
COMMENT ON TABLE public.shop_verification_history IS 'Tracks all shop verification actions and status changes for admin audit trail';
COMMENT ON COLUMN public.shop_verification_history.shop_id IS 'Reference to the shop being verified';
COMMENT ON COLUMN public.shop_verification_history.previous_verification_status IS 'Previous verification status before the action';
COMMENT ON COLUMN public.shop_verification_history.new_verification_status IS 'New verification status after the action';
COMMENT ON COLUMN public.shop_verification_history.previous_shop_status IS 'Previous shop status before the action';
COMMENT ON COLUMN public.shop_verification_history.new_shop_status IS 'New shop status after the action';
COMMENT ON COLUMN public.shop_verification_history.action IS 'Type of verification action performed';
COMMENT ON COLUMN public.shop_verification_history.reason IS 'Reason for the verification action';
COMMENT ON COLUMN public.shop_verification_history.admin_notes IS 'Internal admin notes for the action';
COMMENT ON COLUMN public.shop_verification_history.verification_notes IS 'Public verification notes';
COMMENT ON COLUMN public.shop_verification_history.reviewed_by IS 'Admin user who performed the action';
COMMENT ON COLUMN public.shop_verification_history.reviewed_at IS 'Timestamp when the action was performed';

-- RLS policies for shop verification history
ALTER TABLE public.shop_verification_history ENABLE ROW LEVEL SECURITY;

-- Admin users can read all verification history
CREATE POLICY "Admin can read all shop verification history" ON public.shop_verification_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Admin users can insert verification history
CREATE POLICY "Admin can insert shop verification history" ON public.shop_verification_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE users.id = auth.uid() 
      AND users.user_role = 'admin'
    )
  );

-- Shop owners can read their own shop verification history
CREATE POLICY "Shop owners can read their own verification history" ON public.shop_verification_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.shops 
      WHERE shops.id = shop_verification_history.shop_id 
      AND shops.owner_id = auth.uid()
    )
  );

-- Function to automatically update shop status when verification status changes
CREATE OR REPLACE FUNCTION update_shop_status_on_verification()
RETURNS TRIGGER AS $$
BEGIN
  -- Update shop status based on verification status
  IF NEW.new_verification_status = 'verified' THEN
    UPDATE public.shops 
    SET shop_status = 'active', updated_at = NOW()
    WHERE id = NEW.shop_id;
  ELSIF NEW.new_verification_status = 'rejected' THEN
    UPDATE public.shops 
    SET shop_status = 'inactive', updated_at = NOW()
    WHERE id = NEW.shop_id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update shop status
CREATE TRIGGER trigger_update_shop_status_on_verification
  AFTER INSERT ON public.shop_verification_history
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_status_on_verification();

-- Function to log admin actions for audit trail
CREATE OR REPLACE FUNCTION log_admin_verification_action()
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
    NEW.reviewed_by,
    'shop_' || NEW.action,
    'shop',
    NEW.shop_id,
    NEW.reason,
    jsonb_build_object(
      'previous_verification_status', NEW.previous_verification_status,
      'new_verification_status', NEW.new_verification_status,
      'previous_shop_status', NEW.previous_shop_status,
      'new_shop_status', NEW.new_shop_status,
      'admin_notes', NEW.admin_notes,
      'verification_notes', NEW.verification_notes
    ),
    NEW.reviewed_at
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to log admin actions
CREATE TRIGGER trigger_log_admin_verification_action
  AFTER INSERT ON public.shop_verification_history
  FOR EACH ROW
  EXECUTE FUNCTION log_admin_verification_action(); 