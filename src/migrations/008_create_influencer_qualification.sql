-- =============================================
-- Influencer Qualification System Migration
-- =============================================

-- Add influencer qualification fields to users table
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS last_qualification_check TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS qualification_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS influencer_since TIMESTAMPTZ;

-- Create influencer actions table for tracking promotions/demotions
CREATE TABLE public.influencer_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    action VARCHAR(20) NOT NULL CHECK (action IN ('promotion', 'demotion', 'requalification')),
    performed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason TEXT NOT NULL,
    manual_override BOOLEAN DEFAULT FALSE,
    effective_date TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Index for performance
    INDEX idx_influencer_actions_user_id (user_id),
    INDEX idx_influencer_actions_performed_by (performed_by),
    INDEX idx_influencer_actions_action (action),
    INDEX idx_influencer_actions_effective_date (effective_date)
);

-- Create influencer qualification requirements table
CREATE TABLE public.influencer_requirements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requirement_name VARCHAR(50) NOT NULL UNIQUE,
    requirement_description TEXT NOT NULL,
    is_mandatory BOOLEAN DEFAULT TRUE,
    weight INTEGER DEFAULT 1, -- Weight for scoring
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default influencer requirements
INSERT INTO public.influencer_requirements (requirement_name, requirement_description, is_mandatory, weight) VALUES
('minimum_referrals', 'Minimum 50 successful referrals', TRUE, 40),
('all_referrals_paid', 'All successful referrals must be paid', TRUE, 30),
('account_active', 'User account must be active', TRUE, 10),
('profile_complete', 'User profile must be complete', TRUE, 10),
('phone_verified', 'Phone number must be verified', TRUE, 10);

-- Create function to check influencer qualification
CREATE OR REPLACE FUNCTION public.check_influencer_qualification(user_id UUID)
RETURNS TABLE (
    is_qualified BOOLEAN,
    total_referrals INTEGER,
    successful_referrals INTEGER,
    paid_referrals INTEGER,
    qualification_score INTEGER,
    requirements_met JSONB
) AS $$
DECLARE
    user_record RECORD;
    referral_stats RECORD;
    requirements_met JSONB := '{}';
    score INTEGER := 0;
BEGIN
    -- Get user information
    SELECT 
        u.id,
        u.name,
        u.user_status,
        u.is_influencer,
        u.phone_verified,
        u.profile_image_url,
        u.total_referrals,
        u.successful_referrals
    INTO user_record
    FROM public.users u
    WHERE u.id = user_id;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    -- Get detailed referral statistics
    SELECT 
        COUNT(rr.id) as total_referrals,
        COUNT(r.id) as successful_referrals,
        COUNT(CASE WHEN r.bonus_paid = TRUE THEN r.id END) as paid_referrals
    INTO referral_stats
    FROM public.referral_relationships rr
    LEFT JOIN public.referrals r ON r.referrer_id = rr.referrer_id AND r.referred_id = rr.referred_id
    WHERE rr.referrer_id = user_id AND rr.status = 'active';

    -- Check requirements
    requirements_met := jsonb_build_object(
        'minimum_referrals', (referral_stats.total_referrals >= 50),
        'all_referrals_paid', (referral_stats.successful_referrals = 0 OR referral_stats.paid_referrals = referral_stats.successful_referrals),
        'account_active', (user_record.user_status = 'active'),
        'profile_complete', (user_record.profile_image_url IS NOT NULL AND user_record.name IS NOT NULL),
        'phone_verified', (user_record.phone_verified = TRUE)
    );

    -- Calculate qualification score
    score := 0;
    IF (referral_stats.total_referrals >= 50) THEN score := score + 40; END IF;
    IF (referral_stats.successful_referrals = 0 OR referral_stats.paid_referrals = referral_stats.successful_referrals) THEN score := score + 30; END IF;
    IF (user_record.user_status = 'active') THEN score := score + 10; END IF;
    IF (user_record.profile_image_url IS NOT NULL AND user_record.name IS NOT NULL) THEN score := score + 10; END IF;
    IF (user_record.phone_verified = TRUE) THEN score := score + 10; END IF;

    -- Return results
    RETURN QUERY SELECT
        (score = 100) as is_qualified,
        COALESCE(referral_stats.total_referrals, 0)::INTEGER as total_referrals,
        COALESCE(referral_stats.successful_referrals, 0)::INTEGER as successful_referrals,
        COALESCE(referral_stats.paid_referrals, 0)::INTEGER as paid_referrals,
        score as qualification_score,
        requirements_met;
END;
$$ LANGUAGE plpgsql;

-- Create function to automatically promote qualified users
CREATE OR REPLACE FUNCTION public.auto_promote_influencers()
RETURNS TABLE (
    promoted_count INTEGER,
    promoted_users UUID[]
) AS $$
DECLARE
    user_record RECORD;
    qualification_result RECORD;
    promoted_users UUID[] := '{}';
    promoted_count INTEGER := 0;
BEGIN
    -- Get users who might be qualified (have at least 40 referrals)
    FOR user_record IN 
        SELECT id, name, is_influencer, last_qualification_check
        FROM public.users
        WHERE user_status = 'active' 
        AND is_influencer = FALSE
        AND total_referrals >= 40
        AND (last_qualification_check IS NULL OR last_qualification_check < NOW() - INTERVAL '24 hours')
    LOOP
        -- Check qualification
        SELECT * INTO qualification_result
        FROM public.check_influencer_qualification(user_record.id);

        -- If qualified, promote
        IF qualification_result.is_qualified THEN
            -- Update user status
            UPDATE public.users
            SET 
                is_influencer = TRUE,
                influencer_since = NOW(),
                last_qualification_check = NOW(),
                updated_at = NOW()
            WHERE id = user_record.id;

            -- Log the promotion
            INSERT INTO public.influencer_actions (
                user_id, action, performed_by, reason, manual_override, effective_date
            ) VALUES (
                user_record.id,
                'promotion',
                user_record.id, -- System promotion
                'Automatic promotion based on qualification criteria',
                FALSE,
                NOW()
            );

            -- Add to promoted list
            promoted_users := array_append(promoted_users, user_record.id);
            promoted_count := promoted_count + 1;
        ELSE
            -- Update qualification check timestamp
            UPDATE public.users
            SET last_qualification_check = NOW()
            WHERE id = user_record.id;
        END IF;
    END LOOP;

    RETURN QUERY SELECT promoted_count, promoted_users;
END;
$$ LANGUAGE plpgsql;

-- Create function to get influencer qualification statistics
CREATE OR REPLACE FUNCTION public.get_influencer_qualification_stats()
RETURNS TABLE (
    total_users INTEGER,
    qualified_users INTEGER,
    influencers INTEGER,
    pending_qualification INTEGER,
    average_referrals NUMERIC,
    qualification_rate NUMERIC,
    promotion_rate NUMERIC
) AS $$
DECLARE
    total_users_count INTEGER;
    qualified_users_count INTEGER;
    influencers_count INTEGER;
    pending_count INTEGER;
    avg_referrals NUMERIC;
    qual_rate NUMERIC;
    promo_rate NUMERIC;
BEGIN
    -- Get total active users
    SELECT COUNT(*) INTO total_users_count
    FROM public.users
    WHERE user_status = 'active';

    -- Get influencers
    SELECT COUNT(*) INTO influencers_count
    FROM public.users
    WHERE user_status = 'active' AND is_influencer = TRUE;

    -- Get qualified users (have 50+ referrals)
    SELECT COUNT(*) INTO qualified_users_count
    FROM public.users
    WHERE user_status = 'active' 
    AND total_referrals >= 50
    AND is_influencer = FALSE;

    -- Get pending qualification (40-49 referrals)
    SELECT COUNT(*) INTO pending_count
    FROM public.users
    WHERE user_status = 'active' 
    AND total_referrals >= 40 
    AND total_referrals < 50
    AND is_influencer = FALSE;

    -- Get average referrals
    SELECT COALESCE(AVG(total_referrals), 0) INTO avg_referrals
    FROM public.users
    WHERE user_status = 'active';

    -- Calculate rates
    qual_rate := CASE 
        WHEN total_users_count > 0 THEN (qualified_users_count::NUMERIC / total_users_count::NUMERIC) * 100
        ELSE 0
    END;

    promo_rate := CASE 
        WHEN qualified_users_count > 0 THEN (influencers_count::NUMERIC / qualified_users_count::NUMERIC) * 100
        ELSE 0
    END;

    RETURN QUERY SELECT 
        total_users_count,
        qualified_users_count,
        influencers_count,
        pending_count,
        ROUND(avg_referrals, 2),
        ROUND(qual_rate, 2),
        ROUND(promo_rate, 2);
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update qualification score when user data changes
CREATE OR REPLACE FUNCTION public.update_user_qualification_score()
RETURNS TRIGGER AS $$
DECLARE
    qualification_result RECORD;
BEGIN
    -- Check qualification and update score
    SELECT * INTO qualification_result
    FROM public.check_influencer_qualification(NEW.id);

    -- Update qualification score
    NEW.qualification_score := qualification_result.qualification_score;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_qualification_score
    BEFORE UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION public.update_user_qualification_score();

-- RLS Policies
ALTER TABLE public.influencer_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_requirements ENABLE ROW LEVEL SECURITY;

-- Users can view their own influencer actions
CREATE POLICY "Users can view own influencer actions" ON public.influencer_actions
    FOR SELECT USING (auth.uid() = user_id);

-- Admins can view all influencer actions
CREATE POLICY "Admins can view all influencer actions" ON public.influencer_actions
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Admins can insert influencer actions
CREATE POLICY "Admins can insert influencer actions" ON public.influencer_actions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Everyone can view influencer requirements
CREATE POLICY "Everyone can view influencer requirements" ON public.influencer_requirements
    FOR SELECT USING (is_active = TRUE);

-- Only admins can modify influencer requirements
CREATE POLICY "Admins can modify influencer requirements" ON public.influencer_requirements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Comments
COMMENT ON TABLE public.influencer_actions IS 'Tracks influencer promotions, demotions, and requalifications';
COMMENT ON TABLE public.influencer_requirements IS 'Defines requirements for influencer qualification';
COMMENT ON COLUMN public.users.last_qualification_check IS 'Last time the user was checked for influencer qualification';
COMMENT ON COLUMN public.users.qualification_score IS 'Current qualification score (0-100)';
COMMENT ON COLUMN public.users.influencer_since IS 'Date when user became an influencer';
