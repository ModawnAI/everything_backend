-- Enhanced Referral System Migration
-- Adds tables and enhancements for the improved referral reward calculation system

-- Create referral_codes table for unique code generation and collision prevention
CREATE TABLE IF NOT EXISTS public.referral_codes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    code VARCHAR(20) NOT NULL UNIQUE,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    expires_at TIMESTAMPTZ NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    used_count INTEGER NOT NULL DEFAULT 0,
    max_uses INTEGER DEFAULT NULL, -- NULL means unlimited uses
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on referral code for fast lookups
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON public.referral_codes (code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_id ON public.referral_codes (user_id);
CREATE INDEX IF NOT EXISTS idx_referral_codes_active ON public.referral_codes (is_active, expires_at);

-- Create influencer_promotions table to track automatic influencer promotions
CREATE TABLE IF NOT EXISTS public.influencer_promotions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    promoted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    referral_count_at_promotion INTEGER NOT NULL,
    promotion_reason VARCHAR(100) NOT NULL DEFAULT 'referral_threshold_met',
    previous_status BOOLEAN NOT NULL DEFAULT false,
    new_status BOOLEAN NOT NULL DEFAULT true,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create index on user_id for influencer promotions
CREATE INDEX IF NOT EXISTS idx_influencer_promotions_user_id ON public.influencer_promotions (user_id);
CREATE INDEX IF NOT EXISTS idx_influencer_promotions_promoted_at ON public.influencer_promotions (promoted_at DESC);

-- Create referral_analytics table for tracking detailed referral metrics
CREATE TABLE IF NOT EXISTS public.referral_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    analytics_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_referrals INTEGER NOT NULL DEFAULT 0,
    successful_referrals INTEGER NOT NULL DEFAULT 0,
    pending_referrals INTEGER NOT NULL DEFAULT 0,
    total_rewards_earned INTEGER NOT NULL DEFAULT 0,
    conversion_rate DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    monthly_referrals INTEGER NOT NULL DEFAULT 0,
    monthly_rewards INTEGER NOT NULL DEFAULT 0,
    influencer_status BOOLEAN NOT NULL DEFAULT false,
    analytics_data JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    
    -- Ensure one record per user per date
    UNIQUE(user_id, analytics_date)
);

-- Create indexes for referral analytics
CREATE INDEX IF NOT EXISTS idx_referral_analytics_user_date ON public.referral_analytics (user_id, analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_date ON public.referral_analytics (analytics_date DESC);
CREATE INDEX IF NOT EXISTS idx_referral_analytics_influencer ON public.referral_analytics (influencer_status, total_referrals DESC);

-- Add new columns to existing users table for enhanced referral tracking
DO $$
BEGIN
    -- Add influencer_qualified_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'influencer_qualified_at' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN influencer_qualified_at TIMESTAMPTZ;
    END IF;
    
    -- Add successful_referrals column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'successful_referrals' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN successful_referrals INTEGER NOT NULL DEFAULT 0;
    END IF;
    
    -- Add referral_rewards_earned column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'users' 
                   AND column_name = 'referral_rewards_earned' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.users ADD COLUMN referral_rewards_earned INTEGER NOT NULL DEFAULT 0;
    END IF;
END $$;

-- Add new columns to existing referrals table for enhanced tracking
DO $$
BEGIN
    -- Add original_payment_amount column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referrals' 
                   AND column_name = 'original_payment_amount' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.referrals ADD COLUMN original_payment_amount INTEGER;
    END IF;
    
    -- Add referral_reward_percentage column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referrals' 
                   AND column_name = 'referral_reward_percentage' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.referrals ADD COLUMN referral_reward_percentage DECIMAL(5,4) NOT NULL DEFAULT 0.1000; -- 10%
    END IF;
    
    -- Add calculation_method column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referrals' 
                   AND column_name = 'calculation_method' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.referrals ADD COLUMN calculation_method VARCHAR(50) NOT NULL DEFAULT 'base_points_percentage';
    END IF;
    
    -- Add chain_validation_passed column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'referrals' 
                   AND column_name = 'chain_validation_passed' 
                   AND table_schema = 'public') THEN
        ALTER TABLE public.referrals ADD COLUMN chain_validation_passed BOOLEAN NOT NULL DEFAULT true;
    END IF;
END $$;

-- Create function to automatically check and promote users to influencer status
CREATE OR REPLACE FUNCTION public.check_and_promote_influencer(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_successful_referrals INTEGER;
    v_is_influencer BOOLEAN;
    v_promotion_threshold INTEGER := 50; -- 50 successful referrals
BEGIN
    -- Get current user status
    SELECT is_influencer INTO v_is_influencer
    FROM public.users
    WHERE id = p_user_id;
    
    -- If already an influencer, no need to check
    IF v_is_influencer THEN
        RETURN FALSE;
    END IF;
    
    -- Count successful referrals
    SELECT COUNT(*) INTO v_successful_referrals
    FROM public.referrals
    WHERE referrer_id = p_user_id
    AND status = 'completed'
    AND bonus_paid = true;
    
    -- Check if user qualifies for influencer status
    IF v_successful_referrals >= v_promotion_threshold THEN
        -- Promote to influencer
        UPDATE public.users
        SET 
            is_influencer = true,
            influencer_qualified_at = NOW(),
            successful_referrals = v_successful_referrals,
            updated_at = NOW()
        WHERE id = p_user_id;
        
        -- Log the promotion
        INSERT INTO public.influencer_promotions (
            user_id,
            promoted_at,
            referral_count_at_promotion,
            promotion_reason,
            previous_status,
            new_status
        ) VALUES (
            p_user_id,
            NOW(),
            v_successful_referrals,
            'referral_threshold_met',
            false,
            true
        );
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$;

-- Create function to validate referral chain and prevent circular references
CREATE OR REPLACE FUNCTION public.validate_referral_chain(
    p_referrer_id UUID,
    p_referred_id UUID,
    p_max_depth INTEGER DEFAULT 10
)
RETURNS TABLE (
    is_valid BOOLEAN,
    has_circular_reference BOOLEAN,
    chain_depth INTEGER,
    violation_reason TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_current_user_id UUID := p_referrer_id;
    v_depth INTEGER := 0;
    v_visited_users UUID[] := ARRAY[]::UUID[];
    v_has_circular BOOLEAN := FALSE;
    v_violation TEXT := NULL;
BEGIN
    -- Check if user is trying to refer themselves
    IF p_referrer_id = p_referred_id THEN
        RETURN QUERY SELECT FALSE, TRUE, 0, 'User cannot refer themselves';
        RETURN;
    END IF;
    
    -- Traverse the referral chain upward
    WHILE v_current_user_id IS NOT NULL AND v_depth < p_max_depth LOOP
        -- Check if we've seen this user before (circular reference)
        IF v_current_user_id = ANY(v_visited_users) THEN
            v_has_circular := TRUE;
            v_violation := 'Circular reference detected in referral chain';
            EXIT;
        END IF;
        
        -- Check if current user is the one being referred (would create a circle)
        IF v_current_user_id = p_referred_id THEN
            v_has_circular := TRUE;
            v_violation := 'User cannot be referred by someone in their referral chain';
            EXIT;
        END IF;
        
        -- Add current user to visited list
        v_visited_users := array_append(v_visited_users, v_current_user_id);
        v_depth := v_depth + 1;
        
        -- Get the referrer of the current user
        SELECT referrer_id INTO v_current_user_id
        FROM public.referrals
        WHERE referred_id = v_current_user_id
        AND status = 'completed';
        
        -- If no referrer found, break the loop
        IF NOT FOUND THEN
            v_current_user_id := NULL;
        END IF;
    END LOOP;
    
    -- Check if maximum depth was exceeded
    IF v_depth >= p_max_depth THEN
        v_violation := 'Referral chain exceeds maximum depth of ' || p_max_depth;
    END IF;
    
    -- Return validation result
    RETURN QUERY SELECT 
        (NOT v_has_circular AND v_violation IS NULL),
        v_has_circular,
        v_depth,
        v_violation;
END;
$$;

-- Create function to calculate referral reward based on original payment amount
CREATE OR REPLACE FUNCTION public.calculate_referral_reward(
    p_original_payment_amount INTEGER,
    p_referral_percentage DECIMAL DEFAULT 0.10
)
RETURNS TABLE (
    base_points_earned INTEGER,
    referral_reward_amount INTEGER,
    calculation_method TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_earning_rate DECIMAL := 0.025; -- 2.5% from point policies
    v_max_eligible_amount INTEGER := 300000; -- 300,000 KRW cap
    v_base_points INTEGER;
    v_referral_reward INTEGER;
BEGIN
    -- Calculate base points (before influencer multiplier)
    -- This follows the same logic as point calculation but without multipliers
    v_base_points := FLOOR(
        LEAST(p_original_payment_amount, v_max_eligible_amount) * v_earning_rate
    );
    
    -- Calculate referral reward as percentage of base points
    v_referral_reward := FLOOR(v_base_points * p_referral_percentage);
    
    RETURN QUERY SELECT 
        v_base_points,
        v_referral_reward,
        'base_points_percentage'::TEXT;
END;
$$;

-- Create trigger to automatically update referral analytics
CREATE OR REPLACE FUNCTION public.update_referral_analytics_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- Update analytics when referral status changes
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        -- Update or insert analytics record for the referrer
        INSERT INTO public.referral_analytics (
            user_id,
            analytics_date,
            total_referrals,
            successful_referrals,
            pending_referrals
        )
        SELECT 
            NEW.referrer_id,
            CURRENT_DATE,
            COUNT(*),
            COUNT(*) FILTER (WHERE status = 'completed' AND bonus_paid = true),
            COUNT(*) FILTER (WHERE status = 'pending')
        FROM public.referrals
        WHERE referrer_id = NEW.referrer_id
        ON CONFLICT (user_id, analytics_date)
        DO UPDATE SET
            total_referrals = EXCLUDED.total_referrals,
            successful_referrals = EXCLUDED.successful_referrals,
            pending_referrals = EXCLUDED.pending_referrals,
            updated_at = NOW();
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger on referrals table
DROP TRIGGER IF EXISTS trigger_update_referral_analytics ON public.referrals;
CREATE TRIGGER trigger_update_referral_analytics
    AFTER UPDATE ON public.referrals
    FOR EACH ROW
    EXECUTE FUNCTION public.update_referral_analytics_trigger();

-- Add comments for documentation
COMMENT ON TABLE public.referral_codes IS 'Stores unique referral codes with collision prevention';
COMMENT ON TABLE public.influencer_promotions IS 'Tracks automatic promotions to influencer status';
COMMENT ON TABLE public.referral_analytics IS 'Stores daily referral analytics and metrics';

COMMENT ON FUNCTION public.check_and_promote_influencer(UUID) IS 'Automatically checks and promotes users to influencer status when they reach 50 successful referrals';
COMMENT ON FUNCTION public.validate_referral_chain(UUID, UUID, INTEGER) IS 'Validates referral chains to prevent circular references';
COMMENT ON FUNCTION public.calculate_referral_reward(INTEGER, DECIMAL) IS 'Calculates referral rewards as 10% of base points earned from original payment';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_influencer_qualified ON public.users (is_influencer, influencer_qualified_at);
CREATE INDEX IF NOT EXISTS idx_users_successful_referrals ON public.users (successful_referrals DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_calculation_method ON public.referrals (calculation_method, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_referrals_chain_validation ON public.referrals (chain_validation_passed, status);
