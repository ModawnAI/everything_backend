-- =============================================
-- Referral Earnings and Payout System Migration
-- =============================================

-- Create referral earnings table
CREATE TABLE public.referral_earnings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('points', 'cash', 'discount')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    calculation_details JSONB NOT NULL,
    eligibility_details JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_referral_earnings_referrer_id (referrer_id),
    INDEX idx_referral_earnings_referral_id (referral_id),
    INDEX idx_referral_earnings_status (status),
    INDEX idx_referral_earnings_payout_type (payout_type),
    INDEX idx_referral_earnings_created_at (created_at)
);

-- Create referral payouts table
CREATE TABLE public.referral_payouts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referral_id UUID NOT NULL REFERENCES public.referrals(id) ON DELETE CASCADE,
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payout_type VARCHAR(20) NOT NULL CHECK (payout_type IN ('points', 'cash', 'discount')),
    amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    transaction_id VARCHAR(255),
    reason TEXT NOT NULL,
    processed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    processed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    error TEXT,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Indexes for performance
    INDEX idx_referral_payouts_referrer_id (referrer_id),
    INDEX idx_referral_payouts_referral_id (referral_id),
    INDEX idx_referral_payouts_status (status),
    INDEX idx_referral_payouts_payout_type (payout_type),
    INDEX idx_referral_payouts_processed_by (processed_by),
    INDEX idx_referral_payouts_created_at (created_at)
);

-- Create referral tier configuration table
CREATE TABLE public.referral_tier_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    tier_name VARCHAR(20) NOT NULL UNIQUE,
    min_referrals INTEGER NOT NULL CHECK (min_referrals >= 0),
    max_referrals INTEGER CHECK (max_referrals IS NULL OR max_referrals > min_referrals),
    multiplier DECIMAL(3,2) NOT NULL DEFAULT 1.00 CHECK (multiplier > 0),
    benefits JSONB NOT NULL DEFAULT '[]',
    requirements JSONB NOT NULL DEFAULT '[]',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default tier configurations
INSERT INTO public.referral_tier_config (tier_name, min_referrals, max_referrals, multiplier, benefits, requirements) VALUES
('bronze', 0, 9, 1.00, '["Basic referral bonus"]', '["Active account", "Phone verified"]'),
('silver', 10, 24, 1.20, '["20% bonus multiplier", "Priority support"]', '["10+ referrals", "Active account", "Phone verified"]'),
('gold', 25, 49, 1.50, '["50% bonus multiplier", "Exclusive rewards", "Early access"]', '["25+ referrals", "Active account", "Phone verified", "Profile complete"]'),
('platinum', 50, 99, 2.00, '["100% bonus multiplier", "VIP support", "Exclusive events"]', '["50+ referrals", "Active account", "Phone verified", "Profile complete", "No violations"]'),
('diamond', 100, NULL, 2.50, '["150% bonus multiplier", "Premium support", "Exclusive perks", "Influencer status"]', '["100+ referrals", "Active account", "Phone verified", "Profile complete", "No violations", "Influencer qualified"]');

-- Create referral earnings summary view
CREATE VIEW public.referral_earnings_summary AS
SELECT 
    u.id as user_id,
    u.name as user_name,
    u.email as user_email,
    u.total_referrals,
    u.successful_referrals,
    u.is_influencer,
    COALESCE(SUM(re.amount), 0) as total_earnings,
    COALESCE(SUM(CASE WHEN re.status = 'completed' THEN re.amount ELSE 0 END), 0) as completed_earnings,
    COALESCE(SUM(CASE WHEN re.status = 'pending' THEN re.amount ELSE 0 END), 0) as pending_earnings,
    COALESCE(SUM(CASE WHEN re.payout_type = 'points' THEN re.amount ELSE 0 END), 0) as points_earnings,
    COALESCE(SUM(CASE WHEN re.payout_type = 'cash' THEN re.amount ELSE 0 END), 0) as cash_earnings,
    COALESCE(SUM(CASE WHEN re.payout_type = 'discount' THEN re.amount ELSE 0 END), 0) as discount_earnings,
    COALESCE(SUM(rp.amount), 0) as total_payouts,
    COALESCE(SUM(CASE WHEN rp.status = 'completed' THEN rp.amount ELSE 0 END), 0) as completed_payouts,
    COALESCE(SUM(CASE WHEN rp.status = 'pending' THEN rp.amount ELSE 0 END), 0) as pending_payouts,
    COALESCE(SUM(re.amount), 0) - COALESCE(SUM(CASE WHEN rp.status = 'completed' THEN rp.amount ELSE 0 END), 0) as available_balance,
    MAX(re.created_at) as last_earning_date,
    MAX(rp.processed_at) as last_payout_date
FROM public.users u
LEFT JOIN public.referral_earnings re ON u.id = re.referrer_id
LEFT JOIN public.referral_payouts rp ON u.id = rp.referrer_id
WHERE u.user_status = 'active'
GROUP BY u.id, u.name, u.email, u.total_referrals, u.successful_referrals, u.is_influencer;

-- Create function to calculate referral earnings
CREATE OR REPLACE FUNCTION public.calculate_referral_earnings(
    p_referral_id UUID,
    p_referrer_id UUID,
    p_referred_id UUID
)
RETURNS TABLE (
    base_amount DECIMAL(10,2),
    bonus_amount DECIMAL(10,2),
    total_earnings DECIMAL(10,2),
    influencer_multiplier DECIMAL(3,2),
    tier_multiplier DECIMAL(3,2),
    is_eligible BOOLEAN,
    eligibility_reasons TEXT[]
) AS $$
DECLARE
    referral_record RECORD;
    referrer_record RECORD;
    referred_record RECORD;
    tier_config RECORD;
    base_amount DECIMAL(10,2);
    influencer_multiplier DECIMAL(3,2) := 1.00;
    tier_multiplier DECIMAL(3,2) := 1.00;
    total_earnings DECIMAL(10,2);
    is_eligible BOOLEAN := TRUE;
    eligibility_reasons TEXT[] := '{}';
BEGIN
    -- Get referral details
    SELECT * INTO referral_record
    FROM public.referrals
    WHERE id = p_referral_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Get referrer details
    SELECT * INTO referrer_record
    FROM public.users
    WHERE id = p_referrer_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Get referred user details
    SELECT * INTO referred_record
    FROM public.users
    WHERE id = p_referred_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Set base amount
    base_amount := COALESCE(referral_record.bonus_amount, 1000.00);

    -- Calculate influencer multiplier
    IF referrer_record.is_influencer THEN
        influencer_multiplier := 1.50;
    END IF;

    -- Get tier multiplier
    SELECT multiplier INTO tier_multiplier
    FROM public.referral_tier_config
    WHERE is_active = TRUE
    AND referrer_record.total_referrals >= min_referrals
    AND (max_referrals IS NULL OR referrer_record.total_referrals <= max_referrals)
    ORDER BY min_referrals DESC
    LIMIT 1;

    -- Calculate total earnings
    total_earnings := base_amount * influencer_multiplier * tier_multiplier;

    -- Check eligibility
    IF referrer_record.user_status != 'active' OR referred_record.user_status != 'active' THEN
        is_eligible := FALSE;
        eligibility_reasons := array_append(eligibility_reasons, 'Account not active');
    END IF;

    IF NOT referrer_record.phone_verified THEN
        is_eligible := FALSE;
        eligibility_reasons := array_append(eligibility_reasons, 'Phone not verified');
    END IF;

    IF referrer_record.name IS NULL OR referrer_record.profile_image_url IS NULL THEN
        is_eligible := FALSE;
        eligibility_reasons := array_append(eligibility_reasons, 'Profile incomplete');
    END IF;

    -- Return results
    RETURN QUERY SELECT
        base_amount,
        total_earnings - base_amount,
        total_earnings,
        influencer_multiplier,
        tier_multiplier,
        is_eligible,
        eligibility_reasons;
END;
$$ LANGUAGE plpgsql;

-- Create function to process referral payout
CREATE OR REPLACE FUNCTION public.process_referral_payout(
    p_referral_id UUID,
    p_processed_by UUID,
    p_reason TEXT DEFAULT 'Referral bonus payout'
)
RETURNS TABLE (
    payout_id UUID,
    success BOOLEAN,
    error_message TEXT
) AS $$
DECLARE
    referral_record RECORD;
    earnings_calculation RECORD;
    payout_id UUID;
    transaction_id TEXT;
BEGIN
    -- Get referral details
    SELECT * INTO referral_record
    FROM public.referrals
    WHERE id = p_referral_id;

    IF NOT FOUND THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Referral not found';
        RETURN;
    END IF;

    -- Check if already paid
    IF referral_record.bonus_paid THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Referral bonus already paid';
        RETURN;
    END IF;

    -- Calculate earnings
    SELECT * INTO earnings_calculation
    FROM public.calculate_referral_earnings(
        p_referral_id,
        referral_record.referrer_id,
        referral_record.referred_id
    );

    IF NOT earnings_calculation.is_eligible THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, 'Referral not eligible for payout';
        RETURN;
    END IF;

    -- Create payout record
    INSERT INTO public.referral_payouts (
        referral_id,
        referrer_id,
        referred_id,
        payout_type,
        amount,
        reason,
        processed_by,
        status,
        created_at
    ) VALUES (
        p_referral_id,
        referral_record.referrer_id,
        referral_record.referred_id,
        COALESCE(referral_record.bonus_type, 'points'),
        earnings_calculation.total_earnings,
        p_reason,
        p_processed_by,
        'pending',
        NOW()
    ) RETURNING id INTO payout_id;

    -- Generate transaction ID
    transaction_id := 'payout_' || payout_id::TEXT || '_' || EXTRACT(EPOCH FROM NOW())::TEXT;

    -- Update payout record with transaction ID
    UPDATE public.referral_payouts
    SET 
        transaction_id = transaction_id,
        status = 'completed',
        processed_at = NOW()
    WHERE id = payout_id;

    -- Update referral record
    UPDATE public.referrals
    SET 
        bonus_paid = TRUE,
        updated_at = NOW()
    WHERE id = p_referral_id;

    -- Create earnings record
    INSERT INTO public.referral_earnings (
        referral_id,
        referrer_id,
        referred_id,
        amount,
        payout_type,
        status,
        calculation_details,
        eligibility_details,
        created_at
    ) VALUES (
        p_referral_id,
        referral_record.referrer_id,
        referral_record.referred_id,
        earnings_calculation.total_earnings,
        COALESCE(referral_record.bonus_type, 'points'),
        'completed',
        jsonb_build_object(
            'base_amount', earnings_calculation.base_amount,
            'influencer_multiplier', earnings_calculation.influencer_multiplier,
            'tier_multiplier', earnings_calculation.tier_multiplier,
            'bonus_amount', earnings_calculation.bonus_amount
        ),
        jsonb_build_object(
            'is_eligible', earnings_calculation.is_eligible,
            'reasons', earnings_calculation.eligibility_reasons
        ),
        NOW()
    );

    RETURN QUERY SELECT payout_id, TRUE, NULL::TEXT;

EXCEPTION
    WHEN OTHERS THEN
        RETURN QUERY SELECT NULL::UUID, FALSE, SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create function to get referral earnings summary
CREATE OR REPLACE FUNCTION public.get_referral_earnings_summary(p_user_id UUID)
RETURNS TABLE (
    user_id UUID,
    total_earnings DECIMAL(10,2),
    total_payouts DECIMAL(10,2),
    pending_earnings DECIMAL(10,2),
    available_balance DECIMAL(10,2),
    points_earnings DECIMAL(10,2),
    cash_earnings DECIMAL(10,2),
    discount_earnings DECIMAL(10,2),
    last_earning_date TIMESTAMPTZ,
    last_payout_date TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        res.user_id,
        res.total_earnings,
        res.total_payouts,
        res.pending_earnings,
        res.available_balance,
        res.points_earnings,
        res.cash_earnings,
        res.discount_earnings,
        res.last_earning_date,
        res.last_payout_date
    FROM public.referral_earnings_summary res
    WHERE res.user_id = p_user_id;
END;
$$ LANGUAGE plpgsql;

-- RLS Policies
ALTER TABLE public.referral_earnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_payouts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_tier_config ENABLE ROW LEVEL SECURITY;

-- Users can view their own earnings
CREATE POLICY "Users can view own referral earnings" ON public.referral_earnings
    FOR SELECT USING (auth.uid() = referrer_id);

-- Users can view their own payouts
CREATE POLICY "Users can view own referral payouts" ON public.referral_payouts
    FOR SELECT USING (auth.uid() = referrer_id);

-- Admins can view all earnings and payouts
CREATE POLICY "Admins can view all referral earnings" ON public.referral_earnings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

CREATE POLICY "Admins can view all referral payouts" ON public.referral_payouts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Admins can insert earnings and payouts
CREATE POLICY "Admins can insert referral earnings" ON public.referral_earnings
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

CREATE POLICY "Admins can insert referral payouts" ON public.referral_payouts
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Everyone can view tier configuration
CREATE POLICY "Everyone can view referral tier config" ON public.referral_tier_config
    FOR SELECT USING (is_active = TRUE);

-- Only admins can modify tier configuration
CREATE POLICY "Admins can modify referral tier config" ON public.referral_tier_config
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Comments
COMMENT ON TABLE public.referral_earnings IS 'Tracks referral earnings calculations and status';
COMMENT ON TABLE public.referral_payouts IS 'Tracks referral bonus payouts and transactions';
COMMENT ON TABLE public.referral_tier_config IS 'Configuration for referral tier multipliers and benefits';
COMMENT ON VIEW public.referral_earnings_summary IS 'Summary view of user referral earnings and payouts';
