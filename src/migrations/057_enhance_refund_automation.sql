-- Enhanced Refund Automation System Migration
-- Adds tables and enhancements for automated refund processing with point adjustments

-- Create refund_audit_logs table for comprehensive audit trail
CREATE TABLE IF NOT EXISTS public.refund_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id UUID REFERENCES public.refunds(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(100) NOT NULL,
    actor VARCHAR(20) NOT NULL CHECK (actor IN ('system', 'user', 'admin')),
    actor_id UUID REFERENCES public.users(id),
    details JSONB NOT NULL DEFAULT '{}',
    result VARCHAR(20) NOT NULL CHECK (result IN ('success', 'failure', 'warning')),
    processing_time_ms INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for refund audit logs
CREATE INDEX IF NOT EXISTS idx_refund_audit_logs_refund_id ON public.refund_audit_logs (refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_audit_logs_reservation_id ON public.refund_audit_logs (reservation_id);
CREATE INDEX IF NOT EXISTS idx_refund_audit_logs_user_id ON public.refund_audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_refund_audit_logs_created_at ON public.refund_audit_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refund_audit_logs_action ON public.refund_audit_logs (action, created_at DESC);

-- Create refund_point_adjustments table for tracking point reversals and restorations
CREATE TABLE IF NOT EXISTS public.refund_point_adjustments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    refund_id UUID NOT NULL REFERENCES public.refunds(id) ON DELETE CASCADE,
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    adjustment_type VARCHAR(20) NOT NULL CHECK (adjustment_type IN ('reverse_earned', 'restore_used')),
    original_transaction_id UUID REFERENCES public.point_transactions(id),
    original_amount INTEGER NOT NULL,
    adjusted_amount INTEGER NOT NULL,
    proportional_factor DECIMAL(5,4) NOT NULL DEFAULT 1.0000,
    adjustment_reason TEXT NOT NULL,
    new_transaction_id UUID REFERENCES public.point_transactions(id),
    processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for refund point adjustments
CREATE INDEX IF NOT EXISTS idx_refund_point_adjustments_refund_id ON public.refund_point_adjustments (refund_id);
CREATE INDEX IF NOT EXISTS idx_refund_point_adjustments_user_id ON public.refund_point_adjustments (user_id);
CREATE INDEX IF NOT EXISTS idx_refund_point_adjustments_reservation_id ON public.refund_point_adjustments (reservation_id);
CREATE INDEX IF NOT EXISTS idx_refund_point_adjustments_type ON public.refund_point_adjustments (adjustment_type, processed_at DESC);

-- Create refund_business_rules table for configurable refund policies
CREATE TABLE IF NOT EXISTS public.refund_business_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(20) NOT NULL CHECK (rule_type IN ('time_based', 'amount_based', 'status_based')),
    rule_condition JSONB NOT NULL,
    rule_action JSONB NOT NULL,
    priority INTEGER NOT NULL DEFAULT 100,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for refund business rules
CREATE INDEX IF NOT EXISTS idx_refund_business_rules_shop_id ON public.refund_business_rules (shop_id);
CREATE INDEX IF NOT EXISTS idx_refund_business_rules_type ON public.refund_business_rules (rule_type, is_active);
CREATE INDEX IF NOT EXISTS idx_refund_business_rules_priority ON public.refund_business_rules (priority ASC, created_at DESC);

-- Create no_show_refund_queue table for automated no-show processing
CREATE TABLE IF NOT EXISTS public.no_show_refund_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    scheduled_time TIMESTAMPTZ NOT NULL,
    grace_period_minutes INTEGER NOT NULL DEFAULT 30,
    processing_delay_hours INTEGER NOT NULL DEFAULT 2,
    eligible_for_processing_at TIMESTAMPTZ NOT NULL,
    refund_percentage INTEGER NOT NULL DEFAULT 0,
    auto_refund_enabled BOOLEAN NOT NULL DEFAULT true,
    processing_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'completed', 'failed', 'skipped')),
    processed_at TIMESTAMPTZ,
    refund_id UUID REFERENCES public.refunds(id),
    error_message TEXT,
    retry_count INTEGER NOT NULL DEFAULT 0,
    max_retries INTEGER NOT NULL DEFAULT 3,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for no-show refund queue
CREATE INDEX IF NOT EXISTS idx_no_show_refund_queue_processing_status ON public.no_show_refund_queue (processing_status, eligible_for_processing_at);
CREATE INDEX IF NOT EXISTS idx_no_show_refund_queue_reservation_id ON public.no_show_refund_queue (reservation_id);
CREATE INDEX IF NOT EXISTS idx_no_show_refund_queue_eligible_at ON public.no_show_refund_queue (eligible_for_processing_at ASC);

-- Add new columns to existing refunds table for enhanced automation
DO $$
BEGIN
    -- Add triggered_by column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' 
                   AND column_name = 'triggered_by' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.refunds ADD COLUMN triggered_by VARCHAR(20) DEFAULT 'user' CHECK (triggered_by IN ('user', 'system', 'admin'));
    END IF;
    
    -- Add trigger_reason column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' 
                   AND column_name = 'trigger_reason' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.refunds ADD COLUMN trigger_reason TEXT;
    END IF;
    
    -- Add point_adjustments_summary column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' 
                   AND column_name = 'point_adjustments_summary' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.refunds ADD COLUMN point_adjustments_summary JSONB;
    END IF;
    
    -- Add business_rule_validation column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' 
                   AND column_name = 'business_rule_validation' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.refunds ADD COLUMN business_rule_validation JSONB;
    END IF;
    
    -- Add processing_time_ms column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'refunds' 
                   AND column_name = 'processing_time_ms' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.refunds ADD COLUMN processing_time_ms INTEGER;
    END IF;
END $$;

-- Add new columns to existing shops table for refund automation settings
DO $$
BEGIN
    -- Add auto_refund_enabled column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shops' 
                   AND column_name = 'auto_refund_enabled' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.shops ADD COLUMN auto_refund_enabled BOOLEAN NOT NULL DEFAULT false;
    END IF;
    
    -- Add no_show_refund_percentage column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shops' 
                   AND column_name = 'no_show_refund_percentage' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.shops ADD COLUMN no_show_refund_percentage INTEGER NOT NULL DEFAULT 0 CHECK (no_show_refund_percentage >= 0 AND no_show_refund_percentage <= 100);
    END IF;
    
    -- Add refund_grace_period_hours column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'shops' 
                   AND column_name = 'refund_grace_period_hours' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.shops ADD COLUMN refund_grace_period_hours INTEGER NOT NULL DEFAULT 48;
    END IF;
END $$;

-- Create function to automatically queue no-show refunds
CREATE OR REPLACE FUNCTION public.queue_no_show_refund(p_reservation_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation RECORD;
    v_shop RECORD;
    v_processing_time TIMESTAMPTZ;
BEGIN
    -- Get reservation details
    SELECT r.*, s.auto_refund_enabled, s.no_show_refund_percentage, s.refund_grace_period_hours
    INTO v_reservation
    FROM public.reservations r
    JOIN public.shops s ON r.shop_id = s.id
    WHERE r.id = p_reservation_id;
    
    -- Check if reservation exists and shop has auto-refund enabled
    IF NOT FOUND OR NOT v_reservation.auto_refund_enabled THEN
        RETURN FALSE;
    END IF;
    
    -- Check if reservation is in a state that qualifies for no-show processing
    IF v_reservation.status NOT IN ('confirmed', 'in_progress') THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate when this should be eligible for processing
    -- (reservation time + grace period + processing delay)
    v_processing_time := v_reservation.reservation_date + 
                        INTERVAL '30 minutes' + -- grace period
                        INTERVAL '2 hours';     -- processing delay
    
    -- Insert into no-show queue if not already exists
    INSERT INTO public.no_show_refund_queue (
        reservation_id,
        user_id,
        shop_id,
        scheduled_time,
        grace_period_minutes,
        processing_delay_hours,
        eligible_for_processing_at,
        refund_percentage,
        auto_refund_enabled
    )
    VALUES (
        p_reservation_id,
        v_reservation.user_id,
        v_reservation.shop_id,
        v_reservation.reservation_date,
        30, -- 30 minutes grace period
        2,  -- 2 hours processing delay
        v_processing_time,
        v_reservation.no_show_refund_percentage,
        v_reservation.auto_refund_enabled
    )
    ON CONFLICT (reservation_id) DO NOTHING;
    
    RETURN TRUE;
END;
$$;

-- Create function to process point adjustments for refunds
CREATE OR REPLACE FUNCTION public.process_refund_point_adjustments(
    p_refund_id UUID,
    p_reservation_id UUID,
    p_user_id UUID,
    p_refund_amount INTEGER,
    p_original_amount INTEGER
)
RETURNS TABLE (
    earned_points_reversed INTEGER,
    used_points_restored INTEGER,
    adjustment_count INTEGER
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_proportional_factor DECIMAL(5,4);
    v_earned_points INTEGER := 0;
    v_used_points INTEGER := 0;
    v_adjustment_count INTEGER := 0;
    v_transaction RECORD;
    v_adjustment_amount INTEGER;
BEGIN
    -- Calculate proportional factor for partial refunds
    v_proportional_factor := CASE 
        WHEN p_original_amount > 0 THEN p_refund_amount::DECIMAL / p_original_amount::DECIMAL
        ELSE 1.0
    END;
    
    -- Process earned point reversals
    FOR v_transaction IN
        SELECT * FROM public.point_transactions
        WHERE reservation_id = p_reservation_id
        AND user_id = p_user_id
        AND transaction_type IN ('earned_service', 'earned_referral')
        AND status != 'cancelled'
    LOOP
        v_adjustment_amount := FLOOR(v_transaction.amount * v_proportional_factor);
        
        IF v_adjustment_amount > 0 THEN
            -- Create reversal transaction
            INSERT INTO public.point_transactions (
                user_id,
                reservation_id,
                transaction_type,
                amount,
                description,
                status,
                metadata
            ) VALUES (
                p_user_id,
                p_reservation_id,
                'adjusted',
                -v_adjustment_amount,
                '환불로 인한 적립 포인트 차감',
                'used',
                jsonb_build_object(
                    'refund_id', p_refund_id,
                    'original_transaction_id', v_transaction.id,
                    'adjustment_type', 'reverse_earned',
                    'proportional_factor', v_proportional_factor
                )
            );
            
            -- Record adjustment
            INSERT INTO public.refund_point_adjustments (
                refund_id,
                reservation_id,
                user_id,
                adjustment_type,
                original_transaction_id,
                original_amount,
                adjusted_amount,
                proportional_factor,
                adjustment_reason
            ) VALUES (
                p_refund_id,
                p_reservation_id,
                p_user_id,
                'reverse_earned',
                v_transaction.id,
                v_transaction.amount,
                v_adjustment_amount,
                v_proportional_factor,
                '환불로 인한 적립 포인트 차감'
            );
            
            v_earned_points := v_earned_points + v_adjustment_amount;
            v_adjustment_count := v_adjustment_count + 1;
        END IF;
    END LOOP;
    
    -- Process used point restorations
    FOR v_transaction IN
        SELECT * FROM public.point_transactions
        WHERE reservation_id = p_reservation_id
        AND user_id = p_user_id
        AND transaction_type = 'used_service'
        AND status = 'used'
    LOOP
        v_adjustment_amount := FLOOR(ABS(v_transaction.amount) * v_proportional_factor);
        
        IF v_adjustment_amount > 0 THEN
            -- Create restoration transaction
            INSERT INTO public.point_transactions (
                user_id,
                reservation_id,
                transaction_type,
                amount,
                description,
                status,
                metadata
            ) VALUES (
                p_user_id,
                p_reservation_id,
                'adjusted',
                v_adjustment_amount,
                '환불로 인한 사용 포인트 복원',
                'available',
                jsonb_build_object(
                    'refund_id', p_refund_id,
                    'original_transaction_id', v_transaction.id,
                    'adjustment_type', 'restore_used',
                    'proportional_factor', v_proportional_factor
                )
            );
            
            -- Record adjustment
            INSERT INTO public.refund_point_adjustments (
                refund_id,
                reservation_id,
                user_id,
                adjustment_type,
                original_transaction_id,
                original_amount,
                adjusted_amount,
                proportional_factor,
                adjustment_reason
            ) VALUES (
                p_refund_id,
                p_reservation_id,
                p_user_id,
                'restore_used',
                v_transaction.id,
                ABS(v_transaction.amount),
                v_adjustment_amount,
                v_proportional_factor,
                '환불로 인한 사용 포인트 복원'
            );
            
            v_used_points := v_used_points + v_adjustment_amount;
            v_adjustment_count := v_adjustment_count + 1;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT v_earned_points, v_used_points, v_adjustment_count;
END;
$$;

-- Create function to validate refund business rules
CREATE OR REPLACE FUNCTION public.validate_refund_business_rules(
    p_reservation_id UUID,
    p_refund_type VARCHAR(20),
    p_requested_amount INTEGER DEFAULT NULL
)
RETURNS TABLE (
    can_refund BOOLEAN,
    refund_percentage INTEGER,
    max_refund_amount INTEGER,
    policy_violations TEXT[],
    applied_rules JSONB[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_reservation RECORD;
    v_shop RECORD;
    v_now TIMESTAMPTZ := NOW();
    v_hours_until_reservation INTEGER;
    v_hours_since_payment INTEGER;
    v_can_refund BOOLEAN := TRUE;
    v_refund_percentage INTEGER := 100;
    v_max_refund_amount INTEGER;
    v_violations TEXT[] := ARRAY[]::TEXT[];
    v_rules JSONB[] := ARRAY[]::JSONB[];
BEGIN
    -- Get reservation and shop details
    SELECT r.*, s.refund_grace_period_hours, s.no_show_refund_percentage
    INTO v_reservation
    FROM public.reservations r
    JOIN public.shops s ON r.shop_id = s.id
    WHERE r.id = p_reservation_id;
    
    IF NOT FOUND THEN
        v_can_refund := FALSE;
        v_violations := array_append(v_violations, 'Reservation not found');
        v_max_refund_amount := 0;
        RETURN QUERY SELECT v_can_refund, v_refund_percentage, v_max_refund_amount, v_violations, v_rules;
        RETURN;
    END IF;
    
    -- Calculate time-based factors
    v_hours_until_reservation := EXTRACT(EPOCH FROM (v_reservation.reservation_date - v_now)) / 3600;
    v_hours_since_payment := EXTRACT(EPOCH FROM (v_now - COALESCE(v_reservation.created_at, v_now))) / 3600;
    
    -- Apply time-based rules for cancellations
    IF p_refund_type = 'cancellation' THEN
        IF v_hours_until_reservation >= 48 THEN
            v_refund_percentage := 100;
            v_rules := array_append(v_rules, jsonb_build_object(
                'rule_name', 'full_refund_window',
                'rule_type', 'time_based',
                'impact', '100% refund allowed'
            ));
        ELSIF v_hours_until_reservation >= 24 THEN
            v_refund_percentage := 50;
            v_rules := array_append(v_rules, jsonb_build_object(
                'rule_name', 'partial_refund_window',
                'rule_type', 'time_based',
                'impact', '50% refund with penalty'
            ));
        ELSIF v_hours_until_reservation >= 2 THEN
            v_refund_percentage := 25;
            v_rules := array_append(v_rules, jsonb_build_object(
                'rule_name', 'late_cancellation_window',
                'rule_type', 'time_based',
                'impact', '25% refund with heavy penalty'
            ));
        ELSE
            v_refund_percentage := 0;
            v_can_refund := FALSE;
            v_violations := array_append(v_violations, 'Cancellation too close to reservation time');
            v_rules := array_append(v_rules, jsonb_build_object(
                'rule_name', 'no_refund_window',
                'rule_type', 'time_based',
                'impact', 'No refund allowed'
            ));
        END IF;
    END IF;
    
    -- Apply status-based rules
    IF v_reservation.status = 'completed' THEN
        IF p_refund_type != 'no_show' THEN
            v_refund_percentage := LEAST(v_refund_percentage, 50);
            v_rules := array_append(v_rules, jsonb_build_object(
                'rule_name', 'completed_service_penalty',
                'rule_type', 'status_based',
                'impact', 'Reduced refund for completed service'
            ));
        END IF;
    END IF;
    
    IF v_reservation.status = 'cancelled' THEN
        v_can_refund := FALSE;
        v_violations := array_append(v_violations, 'Reservation already cancelled');
        v_rules := array_append(v_rules, jsonb_build_object(
            'rule_name', 'already_cancelled',
            'rule_type', 'status_based',
            'impact', 'No refund for already cancelled reservation'
        ));
    END IF;
    
    -- Apply no-show specific rules
    IF p_refund_type = 'no_show' THEN
        v_refund_percentage := v_reservation.no_show_refund_percentage;
        v_rules := array_append(v_rules, jsonb_build_object(
            'rule_name', 'no_show_policy',
            'rule_type', 'status_based',
            'impact', 'No-show refund percentage applied'
        ));
    END IF;
    
    -- Calculate maximum refund amount
    v_max_refund_amount := FLOOR(v_reservation.total_amount * v_refund_percentage / 100);
    
    -- Validate requested amount
    IF p_requested_amount IS NOT NULL AND p_requested_amount > v_max_refund_amount THEN
        v_violations := array_append(v_violations, 'Requested amount exceeds maximum allowed refund');
        v_rules := array_append(v_rules, jsonb_build_object(
            'rule_name', 'amount_limit_exceeded',
            'rule_type', 'amount_based',
            'impact', 'Refund amount capped at policy maximum'
        ));
    END IF;
    
    RETURN QUERY SELECT v_can_refund, v_refund_percentage, v_max_refund_amount, v_violations, v_rules;
END;
$$;

-- Create trigger to automatically queue no-show refunds when reservations are created
CREATE OR REPLACE FUNCTION public.trigger_queue_no_show_refund()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Queue for no-show processing if auto-refund is enabled
    PERFORM public.queue_no_show_refund(NEW.id);
    RETURN NEW;
END;
$$;

-- Create trigger on reservations table
DROP TRIGGER IF EXISTS trigger_queue_no_show_refund ON public.reservations;
CREATE TRIGGER trigger_queue_no_show_refund
    AFTER INSERT ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION public.trigger_queue_no_show_refund();

-- Add comments for documentation
COMMENT ON TABLE public.refund_audit_logs IS 'Comprehensive audit trail for all refund processing activities';
COMMENT ON TABLE public.refund_point_adjustments IS 'Tracks point reversals and restorations during refund processing';
COMMENT ON TABLE public.refund_business_rules IS 'Configurable business rules for refund validation and processing';
COMMENT ON TABLE public.no_show_refund_queue IS 'Queue for automated processing of no-show refunds';

COMMENT ON FUNCTION public.queue_no_show_refund(UUID) IS 'Automatically queues reservations for no-show refund processing';
COMMENT ON FUNCTION public.process_refund_point_adjustments(UUID, UUID, UUID, INTEGER, INTEGER) IS 'Processes point adjustments (reversals and restorations) for refunds';
COMMENT ON FUNCTION public.validate_refund_business_rules(UUID, VARCHAR, INTEGER) IS 'Validates refund requests against business rules and policies';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refunds_triggered_by ON public.refunds (triggered_by, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_refunds_processing_time ON public.refunds (processing_time_ms DESC);
CREATE INDEX IF NOT EXISTS idx_shops_auto_refund ON public.shops (auto_refund_enabled, no_show_refund_percentage);

-- Insert default refund business rules for shops
INSERT INTO public.refund_business_rules (
    shop_id,
    rule_name,
    rule_type,
    rule_condition,
    rule_action,
    priority,
    is_active
) 
SELECT 
    id as shop_id,
    'Default Full Refund Window',
    'time_based',
    '{"hours_until_reservation": {"min": 48}}'::jsonb,
    '{"refund_percentage": 100, "requires_approval": false}'::jsonb,
    100,
    true
FROM public.shops
WHERE NOT EXISTS (
    SELECT 1 FROM public.refund_business_rules 
    WHERE shop_id = shops.id AND rule_name = 'Default Full Refund Window'
);

INSERT INTO public.refund_business_rules (
    shop_id,
    rule_name,
    rule_type,
    rule_condition,
    rule_action,
    priority,
    is_active
) 
SELECT 
    id as shop_id,
    'Default Partial Refund Window',
    'time_based',
    '{"hours_until_reservation": {"min": 24, "max": 47}}'::jsonb,
    '{"refund_percentage": 50, "requires_approval": false}'::jsonb,
    200,
    true
FROM public.shops
WHERE NOT EXISTS (
    SELECT 1 FROM public.refund_business_rules 
    WHERE shop_id = shops.id AND rule_name = 'Default Partial Refund Window'
);
