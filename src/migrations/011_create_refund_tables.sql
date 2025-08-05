-- Description: Create tables for comprehensive refund functionality
-- This migration adds support for refund processing, approval workflows, and audit trails

-- Refunds table
-- Tracks all refund requests and their processing status
CREATE TABLE public.refunds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payment_id UUID NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  refund_type refund_type NOT NULL,
  refund_reason refund_reason NOT NULL,
  requested_amount INTEGER NOT NULL,
  approved_amount INTEGER,
  refunded_amount INTEGER DEFAULT 0,
  refund_status refund_status DEFAULT 'pending',
  refund_method refund_method,
  bank_code VARCHAR(10),
  account_number VARCHAR(50),
  account_holder_name VARCHAR(100),
  refund_reason_details TEXT,
  admin_notes TEXT,
  customer_notes TEXT,
  requested_at TIMESTAMPTZ DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES public.users(id),
  processed_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancelled_by UUID REFERENCES public.users(id),
  cancellation_reason TEXT,
  provider_refund_id VARCHAR(255),
  provider_transaction_id VARCHAR(255),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure amounts are valid
  CONSTRAINT valid_refund_amounts CHECK (
    requested_amount > 0 AND
    (approved_amount IS NULL OR approved_amount > 0) AND
    refunded_amount >= 0 AND
    (approved_amount IS NULL OR approved_amount <= requested_amount) AND
    refunded_amount <= COALESCE(approved_amount, requested_amount)
  ),
  
  -- Ensure refund method is provided when approved
  CONSTRAINT valid_refund_method CHECK (
    (refund_status = 'pending' AND refund_method IS NULL) OR
    (refund_status IN ('approved', 'processing', 'completed') AND refund_method IS NOT NULL)
  )
);

-- Refund Approval Workflow table
-- Tracks the approval workflow for refunds requiring admin approval
CREATE TABLE public.refund_approvals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  approver_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  action approval_action NOT NULL,
  amount INTEGER,
  reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure amount is provided for approval actions
  CONSTRAINT valid_approval_amount CHECK (
    (action IN ('approved', 'rejected') AND amount IS NOT NULL) OR
    action = 'pending_review'
  )
);

-- Refund Audit Log table
-- Tracks all actions and changes to refund records
CREATE TABLE public.refund_audit_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
  action_performed audit_action NOT NULL,
  performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  old_values JSONB,
  new_values JSONB,
  action_details TEXT,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Refund Policies table
-- Defines refund policies for different scenarios
CREATE TABLE public.refund_policies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  policy_name VARCHAR(100) NOT NULL UNIQUE,
  policy_type refund_policy_type NOT NULL,
  description TEXT,
  refund_percentage INTEGER NOT NULL,
  max_refund_amount INTEGER,
  time_limit_hours INTEGER,
  requires_approval BOOLEAN DEFAULT TRUE,
  auto_approve_for_admin BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure percentage is valid
  CONSTRAINT valid_refund_percentage CHECK (
    refund_percentage >= 0 AND refund_percentage <= 100
  ),
  
  -- Ensure time limit is positive
  CONSTRAINT valid_time_limit CHECK (
    time_limit_hours IS NULL OR time_limit_hours > 0
  )
);

-- Create indexes for performance
CREATE INDEX idx_refunds_payment_id ON public.refunds(payment_id);
CREATE INDEX idx_refunds_reservation_id ON public.refunds(reservation_id);
CREATE INDEX idx_refunds_user_id ON public.refunds(user_id);
CREATE INDEX idx_refunds_status ON public.refunds(refund_status);
CREATE INDEX idx_refunds_requested_at ON public.refunds(requested_at);
CREATE INDEX idx_refunds_type ON public.refunds(refund_type);

CREATE INDEX idx_refund_approvals_refund_id ON public.refund_approvals(refund_id);
CREATE INDEX idx_refund_approvals_approver_id ON public.refund_approvals(approver_id);
CREATE INDEX idx_refund_approvals_action ON public.refund_approvals(action);
CREATE INDEX idx_refund_approvals_created_at ON public.refund_approvals(created_at);

CREATE INDEX idx_refund_audit_logs_refund_id ON public.refund_audit_logs(refund_id);
CREATE INDEX idx_refund_audit_logs_performed_by ON public.refund_audit_logs(performed_by);
CREATE INDEX idx_refund_audit_logs_action ON public.refund_audit_logs(action_performed);
CREATE INDEX idx_refund_audit_logs_created_at ON public.refund_audit_logs(created_at);

CREATE INDEX idx_refund_policies_type ON public.refund_policies(policy_type);
CREATE INDEX idx_refund_policies_active ON public.refund_policies(is_active);

-- Add RLS policies for security
ALTER TABLE public.refunds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_approvals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.refund_policies ENABLE ROW LEVEL SECURITY;

-- Refunds policies
CREATE POLICY "Users can view their own refunds" ON public.refunds
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create refunds for their own payments" ON public.refunds
  FOR INSERT WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
      SELECT 1 FROM public.payments 
      WHERE id = payment_id AND user_id = auth.uid()
    )
  );

-- Refund approvals policies
CREATE POLICY "Admins can view all refund approvals" ON public.refund_approvals
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can create refund approvals" ON public.refund_approvals
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Refund audit logs policies
CREATE POLICY "Admins can view all refund audit logs" ON public.refund_audit_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "System can create refund audit logs" ON public.refund_audit_logs
  FOR INSERT WITH CHECK (true);

-- Refund policies policies
CREATE POLICY "All users can view active refund policies" ON public.refund_policies
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage refund policies" ON public.refund_policies
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_refund_audit_log()
RETURNS TRIGGER AS $$
BEGIN
  -- Log the change
  INSERT INTO public.refund_audit_logs (
    refund_id,
    action_performed,
    performed_by,
    old_values,
    new_values,
    action_details
  ) VALUES (
    COALESCE(NEW.id, OLD.id),
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'created'
      WHEN TG_OP = 'UPDATE' THEN 'updated'
      WHEN TG_OP = 'DELETE' THEN 'deleted'
    END,
    COALESCE(NEW.approved_by, OLD.approved_by, auth.uid()),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    CASE 
      WHEN TG_OP = 'INSERT' THEN 'Refund request created'
      WHEN TG_OP = 'UPDATE' THEN 'Refund status updated'
      WHEN TG_OP = 'DELETE' THEN 'Refund request deleted'
    END
  );
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refund_audit_log
  AFTER INSERT OR UPDATE OR DELETE ON public.refunds
  FOR EACH ROW
  EXECUTE FUNCTION update_refund_audit_log();

-- Function to calculate refund amount based on policy
CREATE OR REPLACE FUNCTION calculate_refund_amount(
  p_payment_amount INTEGER,
  p_policy_type refund_policy_type,
  p_hours_since_payment INTEGER
)
RETURNS INTEGER AS $$
DECLARE
  v_policy RECORD;
  v_refund_amount INTEGER;
BEGIN
  -- Get the applicable policy
  SELECT * INTO v_policy
  FROM public.refund_policies
  WHERE policy_type = p_policy_type
    AND is_active = true
    AND (time_limit_hours IS NULL OR p_hours_since_payment <= time_limit_hours)
  ORDER BY time_limit_hours DESC NULLS LAST
  LIMIT 1;
  
  -- If no policy found, return 0
  IF v_policy IS NULL THEN
    RETURN 0;
  END IF;
  
  -- Calculate refund amount
  v_refund_amount := (p_payment_amount * v_policy.refund_percentage) / 100;
  
  -- Apply maximum refund amount if specified
  IF v_policy.max_refund_amount IS NOT NULL AND v_refund_amount > v_policy.max_refund_amount THEN
    v_refund_amount := v_policy.max_refund_amount;
  END IF;
  
  RETURN v_refund_amount;
END;
$$ LANGUAGE plpgsql;

-- Function to process automatic refunds
CREATE OR REPLACE FUNCTION process_automatic_refund(
  p_payment_id UUID,
  p_refund_reason refund_reason,
  p_refund_type refund_type DEFAULT 'full'
)
RETURNS UUID AS $$
DECLARE
  v_payment RECORD;
  v_refund_amount INTEGER;
  v_hours_since_payment INTEGER;
  v_refund_id UUID;
BEGIN
  -- Get payment details
  SELECT * INTO v_payment
  FROM public.payments
  WHERE id = p_payment_id;
  
  IF v_payment IS NULL THEN
    RAISE EXCEPTION 'Payment not found';
  END IF;
  
  -- Calculate hours since payment
  v_hours_since_payment := EXTRACT(EPOCH FROM (NOW() - v_payment.paid_at)) / 3600;
  
  -- Calculate refund amount based on policy
  v_refund_amount := calculate_refund_amount(
    v_payment.amount,
    p_refund_type::refund_policy_type,
    v_hours_since_payment
  );
  
  -- Create refund record
  INSERT INTO public.refunds (
    payment_id,
    reservation_id,
    user_id,
    refund_type,
    refund_reason,
    requested_amount,
    approved_amount,
    refund_status,
    refund_method
  ) VALUES (
    p_payment_id,
    v_payment.reservation_id,
    v_payment.user_id,
    p_refund_type,
    p_refund_reason,
    v_refund_amount,
    v_refund_amount,
    'approved',
    'automatic'
  ) RETURNING id INTO v_refund_id;
  
  RETURN v_refund_id;
END;
$$ LANGUAGE plpgsql;

-- Insert default refund policies
INSERT INTO public.refund_policies (
  policy_name,
  policy_type,
  description,
  refund_percentage,
  max_refund_amount,
  time_limit_hours,
  requires_approval,
  auto_approve_for_admin
) VALUES 
  ('Full Refund - Within 24 Hours', 'full', 'Full refund for cancellations within 24 hours of payment', 100, NULL, 24, FALSE, TRUE),
  ('Partial Refund - Within 48 Hours', 'partial', 'Partial refund for cancellations within 48 hours of payment', 50, 50000, 48, TRUE, FALSE),
  ('No Refund - After 48 Hours', 'none', 'No refund for cancellations after 48 hours', 0, 0, 48, TRUE, FALSE),
  ('Admin Override', 'admin_override', 'Admin can override refund policies', 100, NULL, NULL, TRUE, TRUE); 