-- Description: Create tables for split payment functionality
-- This migration adds support for deposit + remaining balance payments
-- with proper tracking, scheduling, and validation

-- Split Payment Plans table
-- Tracks the overall split payment plan for a reservation
CREATE TABLE public.split_payment_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL,
  deposit_amount INTEGER NOT NULL,
  remaining_amount INTEGER NOT NULL,
  deposit_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  remaining_payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  deposit_paid_at TIMESTAMPTZ,
  remaining_paid_at TIMESTAMPTZ,
  remaining_due_date TIMESTAMPTZ NOT NULL,
  status split_payment_status DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure amounts are valid
  CONSTRAINT valid_split_amounts CHECK (
    total_amount > 0 AND
    deposit_amount > 0 AND
    remaining_amount > 0 AND
    deposit_amount + remaining_amount = total_amount
  ),
  
  -- Ensure due date is in the future
  CONSTRAINT valid_due_date CHECK (remaining_due_date > NOW())
);

-- Payment Installments table
-- Tracks individual payment installments within a split payment plan
CREATE TABLE public.payment_installments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  split_payment_plan_id UUID NOT NULL REFERENCES public.split_payment_plans(id) ON DELETE CASCADE,
  payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
  installment_number INTEGER NOT NULL,
  installment_type installment_type NOT NULL,
  amount INTEGER NOT NULL,
  due_date TIMESTAMPTZ NOT NULL,
  paid_at TIMESTAMPTZ,
  status installment_status DEFAULT 'pending',
  reminder_sent_at TIMESTAMPTZ,
  reminder_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure installment number is positive
  CONSTRAINT valid_installment_number CHECK (installment_number > 0),
  
  -- Ensure amount is positive
  CONSTRAINT valid_installment_amount CHECK (amount > 0),
  
  -- Ensure due date is in the future when created
  CONSTRAINT valid_installment_due_date CHECK (due_date > created_at),
  
  -- Unique constraint for installment number within a plan
  UNIQUE(split_payment_plan_id, installment_number)
);

-- Payment Reminders table
-- Tracks reminder notifications for upcoming or overdue payments
CREATE TABLE public.payment_reminders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  installment_id UUID NOT NULL REFERENCES public.payment_installments(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reminder_type reminder_type NOT NULL,
  scheduled_at TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  notification_id UUID,
  status reminder_status DEFAULT 'scheduled',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Ensure scheduled time is in the future when created
  CONSTRAINT valid_reminder_schedule CHECK (scheduled_at > created_at)
);

-- Create indexes for performance
CREATE INDEX idx_split_payment_plans_reservation_id ON public.split_payment_plans(reservation_id);
CREATE INDEX idx_split_payment_plans_user_id ON public.split_payment_plans(user_id);
CREATE INDEX idx_split_payment_plans_status ON public.split_payment_plans(status);
CREATE INDEX idx_split_payment_plans_due_date ON public.split_payment_plans(remaining_due_date);

CREATE INDEX idx_payment_installments_plan_id ON public.payment_installments(split_payment_plan_id);
CREATE INDEX idx_payment_installments_payment_id ON public.payment_installments(payment_id);
CREATE INDEX idx_payment_installments_status ON public.payment_installments(status);
CREATE INDEX idx_payment_installments_due_date ON public.payment_installments(due_date);
CREATE INDEX idx_payment_installments_type ON public.payment_installments(installment_type);

CREATE INDEX idx_payment_reminders_installment_id ON public.payment_reminders(installment_id);
CREATE INDEX idx_payment_reminders_user_id ON public.payment_reminders(user_id);
CREATE INDEX idx_payment_reminders_status ON public.payment_reminders(status);
CREATE INDEX idx_payment_reminders_scheduled_at ON public.payment_reminders(scheduled_at);

-- Add RLS policies for security
ALTER TABLE public.split_payment_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_installments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_reminders ENABLE ROW LEVEL SECURITY;

-- Split payment plans policies
CREATE POLICY "Users can view their own split payment plans" ON public.split_payment_plans
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own split payment plans" ON public.split_payment_plans
  FOR UPDATE USING (auth.uid() = user_id);

-- Payment installments policies
CREATE POLICY "Users can view their own payment installments" ON public.payment_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.split_payment_plans 
      WHERE id = split_payment_plan_id AND user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update their own payment installments" ON public.payment_installments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.split_payment_plans 
      WHERE id = split_payment_plan_id AND user_id = auth.uid()
    )
  );

-- Payment reminders policies
CREATE POLICY "Users can view their own payment reminders" ON public.payment_reminders
  FOR SELECT USING (auth.uid() = user_id);

-- Admin policies for management
CREATE POLICY "Admins can view all split payment plans" ON public.split_payment_plans
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all split payment plans" ON public.split_payment_plans
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can view all payment installments" ON public.payment_installments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update all payment installments" ON public.payment_installments
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_split_payment_plan_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Update split payment plan status based on installment status
  UPDATE public.split_payment_plans
  SET 
    status = CASE 
      WHEN EXISTS (
        SELECT 1 FROM public.payment_installments 
        WHERE split_payment_plan_id = NEW.split_payment_plan_id AND status = 'paid'
      ) THEN 'completed'
      WHEN EXISTS (
        SELECT 1 FROM public.payment_installments 
        WHERE split_payment_plan_id = NEW.split_payment_plan_id AND status = 'overdue'
      ) THEN 'overdue'
      WHEN EXISTS (
        SELECT 1 FROM public.payment_installments 
        WHERE split_payment_plan_id = NEW.split_payment_plan_id AND status = 'pending'
      ) THEN 'pending'
      ELSE 'completed'
    END,
    updated_at = NOW()
  WHERE id = NEW.split_payment_plan_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_split_payment_plan_status
  AFTER UPDATE ON public.payment_installments
  FOR EACH ROW
  EXECUTE FUNCTION update_split_payment_plan_status();

-- Function to create split payment plan
CREATE OR REPLACE FUNCTION create_split_payment_plan(
  p_reservation_id UUID,
  p_user_id UUID,
  p_total_amount INTEGER,
  p_deposit_amount INTEGER,
  p_remaining_due_date TIMESTAMPTZ
)
RETURNS UUID AS $$
DECLARE
  v_plan_id UUID;
  v_remaining_amount INTEGER;
BEGIN
  -- Calculate remaining amount
  v_remaining_amount := p_total_amount - p_deposit_amount;
  
  -- Validate amounts
  IF p_deposit_amount <= 0 OR v_remaining_amount <= 0 THEN
    RAISE EXCEPTION 'Invalid split payment amounts';
  END IF;
  
  -- Create split payment plan
  INSERT INTO public.split_payment_plans (
    reservation_id,
    user_id,
    total_amount,
    deposit_amount,
    remaining_amount,
    remaining_due_date
  ) VALUES (
    p_reservation_id,
    p_user_id,
    p_total_amount,
    p_deposit_amount,
    v_remaining_amount,
    p_remaining_due_date
  ) RETURNING id INTO v_plan_id;
  
  -- Create deposit installment
  INSERT INTO public.payment_installments (
    split_payment_plan_id,
    installment_number,
    installment_type,
    amount,
    due_date
  ) VALUES (
    v_plan_id,
    1,
    'deposit',
    p_deposit_amount,
    NOW() -- Deposit is due immediately
  );
  
  -- Create remaining balance installment
  INSERT INTO public.payment_installments (
    split_payment_plan_id,
    installment_number,
    installment_type,
    amount,
    due_date
  ) VALUES (
    v_plan_id,
    2,
    'remaining',
    v_remaining_amount,
    p_remaining_due_date
  );
  
  RETURN v_plan_id;
END;
$$ LANGUAGE plpgsql; 