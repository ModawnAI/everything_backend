-- =============================================
-- Referral System Tables Migration
-- =============================================

-- Referral records table
CREATE TABLE public.referrals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'cancelled', 'expired')),
    bonus_amount INTEGER NOT NULL DEFAULT 1000,
    bonus_type VARCHAR(20) NOT NULL DEFAULT 'points' CHECK (bonus_type IN ('points', 'cash', 'discount', 'free_service')),
    bonus_paid BOOLEAN DEFAULT FALSE,
    bonus_paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    notes TEXT,
    UNIQUE(referred_id) -- One referral per referred user
);

-- Referral bonus configuration table
CREATE TABLE public.referral_bonus_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    bonus_type VARCHAR(20) NOT NULL CHECK (bonus_type IN ('points', 'cash', 'discount', 'free_service')),
    bonus_amount INTEGER NOT NULL,
    minimum_requirement VARCHAR(100),
    valid_days INTEGER NOT NULL DEFAULT 30,
    max_referrals_per_user INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Phone verification records table
CREATE TABLE public.phone_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    verification_method VARCHAR(10) NOT NULL CHECK (verification_method IN ('sms', 'pass')),
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed', 'expired')),
    tx_id VARCHAR(100), -- Transaction ID for PASS verification
    otp_code VARCHAR(10), -- For SMS verification
    pass_result JSONB, -- PASS verification result
    ci VARCHAR(255), -- Connecting Information from PASS
    di VARCHAR(255), -- Duplicate Information from PASS
    redirect_url TEXT, -- PASS redirect URL
    expires_at TIMESTAMPTZ NOT NULL,
    verified_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Referral indexes
CREATE INDEX idx_referrals_referrer_id ON public.referrals(referrer_id);
CREATE INDEX idx_referrals_referred_id ON public.referrals(referred_id);
CREATE INDEX idx_referrals_referral_code ON public.referrals(referral_code);
CREATE INDEX idx_referrals_status ON public.referrals(status);
CREATE INDEX idx_referrals_expires_at ON public.referrals(expires_at);

-- Phone verification indexes
CREATE INDEX idx_phone_verifications_user_id ON public.phone_verifications(user_id);
CREATE INDEX idx_phone_verifications_phone_number ON public.phone_verifications(phone_number);
CREATE INDEX idx_phone_verifications_tx_id ON public.phone_verifications(tx_id);
CREATE INDEX idx_phone_verifications_status ON public.phone_verifications(status);
CREATE INDEX idx_phone_verifications_expires_at ON public.phone_verifications(expires_at);

-- =============================================
-- Row Level Security (RLS)
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_bonus_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;

-- Referral RLS policies
CREATE POLICY "Users can view own referrals" ON public.referrals
    FOR SELECT USING (auth.uid() = referrer_id OR auth.uid() = referred_id);

CREATE POLICY "Users can create referrals" ON public.referrals
    FOR INSERT WITH CHECK (auth.uid() = referrer_id);

CREATE POLICY "Users can update own referrals" ON public.referrals
    FOR UPDATE USING (auth.uid() = referrer_id);

-- Phone verification RLS policies
CREATE POLICY "Users can view own phone verifications" ON public.phone_verifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create phone verifications" ON public.phone_verifications
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can update own phone verifications" ON public.phone_verifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Admin policies for referral bonus configs
CREATE POLICY "Admins can manage referral configs" ON public.referral_bonus_configs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.user_role = 'admin'
        )
    );

-- =============================================
-- Triggers for Automatic Updates
-- =============================================

-- Updated at triggers
CREATE TRIGGER update_referrals_updated_at BEFORE UPDATE ON public.referrals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_referral_bonus_configs_updated_at BEFORE UPDATE ON public.referral_bonus_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_phone_verifications_updated_at BEFORE UPDATE ON public.phone_verifications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Initial Data
-- =============================================

-- Default referral bonus configuration
INSERT INTO public.referral_bonus_configs (
    bonus_type,
    bonus_amount,
    minimum_requirement,
    valid_days,
    max_referrals_per_user,
    is_active
) VALUES (
    'points',
    1000,
    'profile_complete,phone_verified',
    30,
    50,
    true
) ON CONFLICT DO NOTHING;

-- =============================================
-- Functions for Referral System
-- =============================================

-- Function to increment referral count
CREATE OR REPLACE FUNCTION increment_referrals(user_uuid UUID)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT total_referrals FROM public.users WHERE id = user_uuid), 0
    ) + 1;
END;
$$ LANGUAGE plpgsql;

-- Function to increment points
CREATE OR REPLACE FUNCTION increment_points(user_uuid UUID, points_to_add INTEGER)
RETURNS INTEGER AS $$
BEGIN
    RETURN COALESCE(
        (SELECT available_points FROM public.users WHERE id = user_uuid), 0
    ) + points_to_add;
END;
$$ LANGUAGE plpgsql; 