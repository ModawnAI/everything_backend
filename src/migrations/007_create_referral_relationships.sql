-- =============================================
-- Referral Relationships Table Migration
-- =============================================

-- Referral relationships table for tracking referral chains and preventing circular references
CREATE TABLE public.referral_relationships (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    referrer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referred_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    referral_code VARCHAR(20) NOT NULL,
    relationship_depth INTEGER NOT NULL DEFAULT 0,
    is_circular BOOLEAN DEFAULT FALSE,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure one referral relationship per referred user
    UNIQUE(referred_id),
    
    -- Ensure referrer and referred are different
    CHECK (referrer_id != referred_id)
);

-- Indexes for performance
CREATE INDEX idx_referral_relationships_referrer_id ON public.referral_relationships(referrer_id);
CREATE INDEX idx_referral_relationships_referred_id ON public.referral_relationships(referred_id);
CREATE INDEX idx_referral_relationships_status ON public.referral_relationships(status);
CREATE INDEX idx_referral_relationships_depth ON public.referral_relationships(relationship_depth);
CREATE INDEX idx_referral_relationships_circular ON public.referral_relationships(is_circular);

-- Function to increment user referral count
CREATE OR REPLACE FUNCTION public.increment_user_referral_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET 
        total_referrals = total_referrals + 1,
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement user referral count
CREATE OR REPLACE FUNCTION public.decrement_user_referral_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE public.users 
    SET 
        total_referrals = GREATEST(total_referrals - 1, 0),
        updated_at = NOW()
    WHERE id = user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to check for circular references
CREATE OR REPLACE FUNCTION public.check_referral_circular_reference(
    referrer_id UUID,
    referred_id UUID,
    max_depth INTEGER DEFAULT 10
)
RETURNS BOOLEAN AS $$
DECLARE
    current_user_id UUID;
    depth INTEGER := 0;
    visited_users UUID[] := ARRAY[]::UUID[];
BEGIN
    current_user_id := referred_id;
    
    WHILE current_user_id IS NOT NULL AND depth < max_depth LOOP
        -- Check if we've already visited this user (circular reference)
        IF current_user_id = ANY(visited_users) THEN
            RETURN TRUE;
        END IF;
        
        -- Check if we've reached the original referrer (circular reference)
        IF current_user_id = referrer_id THEN
            RETURN TRUE;
        END IF;
        
        -- Add current user to visited list
        visited_users := array_append(visited_users, current_user_id);
        
        -- Get the referrer of current user
        SELECT rr.referrer_id INTO current_user_id
        FROM public.referral_relationships rr
        WHERE rr.referred_id = current_user_id
        AND rr.status = 'active'
        LIMIT 1;
        
        depth := depth + 1;
    END LOOP;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate relationship depth
CREATE OR REPLACE FUNCTION public.calculate_referral_depth(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    current_user_id UUID;
    depth INTEGER := 0;
    max_depth INTEGER := 20;
BEGIN
    current_user_id := user_id;
    
    WHILE current_user_id IS NOT NULL AND depth < max_depth LOOP
        SELECT rr.referrer_id INTO current_user_id
        FROM public.referral_relationships rr
        WHERE rr.referred_id = current_user_id
        AND rr.status = 'active'
        LIMIT 1;
        
        IF current_user_id IS NOT NULL THEN
            depth := depth + 1;
        END IF;
    END LOOP;
    
    RETURN depth;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically calculate relationship depth on insert
CREATE OR REPLACE FUNCTION public.set_referral_relationship_depth()
RETURNS TRIGGER AS $$
BEGIN
    NEW.relationship_depth := public.calculate_referral_depth(NEW.referrer_id);
    NEW.is_circular := public.check_referral_circular_reference(NEW.referrer_id, NEW.referred_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_referral_relationship_depth
    BEFORE INSERT ON public.referral_relationships
    FOR EACH ROW
    EXECUTE FUNCTION public.set_referral_relationship_depth();

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_referral_relationship_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_referral_relationship_updated_at
    BEFORE UPDATE ON public.referral_relationships
    FOR EACH ROW
    EXECUTE FUNCTION public.update_referral_relationship_updated_at();

-- RLS Policies
ALTER TABLE public.referral_relationships ENABLE ROW LEVEL SECURITY;

-- Users can view their own referral relationships
CREATE POLICY "Users can view own referral relationships" ON public.referral_relationships
    FOR SELECT USING (
        auth.uid() = referrer_id OR 
        auth.uid() = referred_id
    );

-- Users can create referral relationships (with validation)
CREATE POLICY "Users can create referral relationships" ON public.referral_relationships
    FOR INSERT WITH CHECK (
        auth.uid() = referrer_id AND
        auth.uid() != referred_id
    );

-- Only admins can update referral relationships
CREATE POLICY "Admins can update referral relationships" ON public.referral_relationships
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Only admins can delete referral relationships
CREATE POLICY "Admins can delete referral relationships" ON public.referral_relationships
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() 
            AND user_role = 'admin'
        )
    );

-- Comments
COMMENT ON TABLE public.referral_relationships IS 'Tracks referral relationships with circular reference prevention';
COMMENT ON COLUMN public.referral_relationships.referrer_id IS 'User who provided the referral code';
COMMENT ON COLUMN public.referral_relationships.referred_id IS 'User who used the referral code';
COMMENT ON COLUMN public.referral_relationships.relationship_depth IS 'Number of levels deep in the referral chain';
COMMENT ON COLUMN public.referral_relationships.is_circular IS 'Whether this relationship creates a circular reference';
COMMENT ON COLUMN public.referral_relationships.status IS 'Status of the referral relationship';
