-- Enhance Payment Status Tracking for Two-Stage Payment System
-- This migration adds new payment statuses and fields to support comprehensive two-stage payment tracking

-- Ensure payment_status enum exists (in case base schema wasn't applied)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'payment_status') THEN
        CREATE TYPE payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded', 'failed');
    END IF;
END $$;

-- Ensure payments table exists with payment_status column
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL,
    user_id UUID NOT NULL,
    payment_method VARCHAR(50),
    payment_status payment_status DEFAULT 'pending',
    amount INTEGER NOT NULL,
    is_deposit BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add is_deposit column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' 
                   AND column_name = 'is_deposit' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.payments ADD COLUMN is_deposit BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Add payment_status column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'payments' 
                   AND column_name = 'payment_status' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.payments ADD COLUMN payment_status payment_status DEFAULT 'pending';
    END IF;
END $$;

-- Add new payment status values to the enum
ALTER TYPE payment_status ADD VALUE 'final_payment_pending' AFTER 'deposit_paid';
ALTER TYPE payment_status ADD VALUE 'deposit_refunded' AFTER 'partially_refunded';
ALTER TYPE payment_status ADD VALUE 'final_payment_refunded' AFTER 'deposit_refunded';
ALTER TYPE payment_status ADD VALUE 'overdue' AFTER 'final_payment_refunded';

-- Add new fields to payments table for enhanced two-stage payment tracking
ALTER TABLE public.payments 
ADD COLUMN payment_stage VARCHAR(20) DEFAULT 'single' NOT NULL CHECK (payment_stage IN ('deposit', 'final', 'single')),
ADD COLUMN due_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN reminder_sent_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN reminder_count INTEGER DEFAULT 0 NOT NULL,
ADD COLUMN final_payment_grace_period_hours INTEGER DEFAULT 72 NOT NULL;

-- Add indexes for performance on new fields
CREATE INDEX idx_payments_payment_stage ON public.payments (payment_stage);
CREATE INDEX idx_payments_due_date ON public.payments (due_date);
CREATE INDEX idx_payments_status_stage ON public.payments (payment_status, payment_stage);

-- Add comments for documentation
COMMENT ON COLUMN public.payments.payment_stage IS 'Payment stage type: deposit, final, or single payment';
COMMENT ON COLUMN public.payments.due_date IS 'Due date for final payment (only applicable for deposit payments)';
COMMENT ON COLUMN public.payments.reminder_sent_at IS 'Timestamp when payment reminder was last sent';
COMMENT ON COLUMN public.payments.reminder_count IS 'Number of payment reminders sent';
COMMENT ON COLUMN public.payments.final_payment_grace_period_hours IS 'Grace period in hours after service completion for final payment';

-- Create function to validate payment status transitions
CREATE OR REPLACE FUNCTION validate_payment_status_transition(
    p_old_status payment_status,
    p_new_status payment_status,
    p_payment_stage VARCHAR(20)
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    -- Define valid transitions for each payment stage
    CASE p_payment_stage
        WHEN 'deposit' THEN
            -- Deposit payment transitions
            RETURN (p_old_status, p_new_status) IN (
                ('pending', 'deposit_paid'),
                ('pending', 'failed'),
                ('deposit_paid', 'deposit_refunded'),
                ('deposit_paid', 'final_payment_pending'),
                ('failed', 'pending')
            );
        
        WHEN 'final' THEN
            -- Final payment transitions
            RETURN (p_old_status, p_new_status) IN (
                ('pending', 'fully_paid'),
                ('pending', 'failed'),
                ('final_payment_pending', 'fully_paid'),
                ('final_payment_pending', 'overdue'),
                ('fully_paid', 'final_payment_refunded'),
                ('overdue', 'fully_paid'),
                ('failed', 'pending')
            );
        
        WHEN 'single' THEN
            -- Single payment transitions
            RETURN (p_old_status, p_new_status) IN (
                ('pending', 'fully_paid'),
                ('pending', 'failed'),
                ('fully_paid', 'refunded'),
                ('fully_paid', 'partially_refunded'),
                ('failed', 'pending')
            );
        
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$;

-- Create trigger to enforce payment status transition validation
CREATE OR REPLACE FUNCTION check_payment_status_transition()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Skip validation for INSERT operations
    IF TG_OP = 'INSERT' THEN
        RETURN NEW;
    END IF;
    
    -- Validate status transition for UPDATE operations
    IF TG_OP = 'UPDATE' AND OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN
        IF NOT validate_payment_status_transition(
            OLD.payment_status,
            NEW.payment_status,
            NEW.payment_stage
        ) THEN
            RAISE EXCEPTION 'Invalid payment status transition from % to % for payment stage %',
                OLD.payment_status, NEW.payment_status, NEW.payment_stage;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_validate_payment_status_transition ON public.payments;
CREATE TRIGGER trigger_validate_payment_status_transition
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION check_payment_status_transition();

-- Create function to automatically set due dates for deposit payments
CREATE OR REPLACE FUNCTION set_payment_due_date()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Set due date for deposit payments when they become 'deposit_paid'
    IF NEW.payment_stage = 'deposit' AND NEW.payment_status = 'deposit_paid' THEN
        -- Set due date to 7 days after service completion (default grace period)
        NEW.due_date := NEW.created_at::timestamp + INTERVAL '7 days';
    END IF;
    
    -- Clear due date for final payments when they become 'fully_paid'
    IF NEW.payment_stage = 'final' AND NEW.payment_status = 'fully_paid' THEN
        NEW.due_date := NULL;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create the trigger for due date management
DROP TRIGGER IF EXISTS trigger_set_payment_due_date ON public.payments;
CREATE TRIGGER trigger_set_payment_due_date
    BEFORE UPDATE ON public.payments
    FOR EACH ROW
    EXECUTE FUNCTION set_payment_due_date();

-- Create function to get payment status summary for a reservation
CREATE OR REPLACE FUNCTION get_reservation_payment_summary(p_reservation_id UUID)
RETURNS TABLE (
    reservation_id UUID,
    total_amount NUMERIC,
    deposit_amount NUMERIC,
    remaining_amount NUMERIC,
    deposit_status payment_status,
    final_payment_status payment_status,
    overall_status VARCHAR(50),
    is_overdue BOOLEAN,
    days_until_due INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation RECORD;
    v_deposit_payment RECORD;
    v_final_payment RECORD;
    v_overall_status VARCHAR(50);
    v_is_overdue BOOLEAN := FALSE;
    v_days_until_due INTEGER := NULL;
BEGIN
    -- Get reservation details
    SELECT * INTO v_reservation
    FROM public.reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;
    
    -- Get deposit payment
    SELECT * INTO v_deposit_payment
    FROM public.payments
    WHERE reservation_id = p_reservation_id
    AND payment_stage = 'deposit'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Get final payment
    SELECT * INTO v_final_payment
    FROM public.payments
    WHERE reservation_id = p_reservation_id
    AND payment_stage = 'final'
    ORDER BY created_at DESC
    LIMIT 1;
    
    -- Determine overall payment status
    IF v_deposit_payment.payment_status = 'deposit_paid' AND 
       (v_final_payment IS NULL OR v_final_payment.payment_status = 'fully_paid') THEN
        v_overall_status := 'fully_paid';
    ELSIF v_deposit_payment.payment_status = 'deposit_paid' AND 
          v_final_payment.payment_status = 'final_payment_pending' THEN
        v_overall_status := 'deposit_paid';
        -- Check if overdue
        IF v_final_payment.due_date < NOW() THEN
            v_is_overdue := TRUE;
            v_days_until_due := -EXTRACT(DAY FROM (NOW() - v_final_payment.due_date))::INTEGER;
        ELSE
            v_days_until_due := EXTRACT(DAY FROM (v_final_payment.due_date - NOW()))::INTEGER;
        END IF;
    ELSIF v_deposit_payment.payment_status = 'pending' THEN
        v_overall_status := 'pending';
    ELSE
        v_overall_status := 'failed';
    END IF;
    
    RETURN QUERY SELECT
        p_reservation_id,
        v_reservation.total_amount,
        v_reservation.deposit_amount,
        v_reservation.remaining_amount,
        COALESCE(v_deposit_payment.payment_status, 'pending'::payment_status),
        COALESCE(v_final_payment.payment_status, 'pending'::payment_status),
        v_overall_status,
        v_is_overdue,
        v_days_until_due;
END;
$$;

-- Add comment for the function
COMMENT ON FUNCTION get_reservation_payment_summary(UUID) IS 'Get comprehensive payment status summary for a reservation including deposit and final payment statuses';

-- Update existing payments to have default payment_stage based on is_deposit flag
UPDATE public.payments 
SET payment_stage = CASE 
    WHEN is_deposit = true THEN 'deposit'
    ELSE 'single'
END
WHERE payment_stage = 'single'; -- Only update default values

-- Add comment for the updated enum
COMMENT ON TYPE payment_status IS 'Payment status enum including two-stage payment states: pending, deposit_paid, final_payment_pending, fully_paid, refunded, partially_refunded, failed, deposit_refunded, final_payment_refunded, overdue';
