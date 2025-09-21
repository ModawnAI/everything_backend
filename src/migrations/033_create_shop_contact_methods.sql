-- Migration: 033_create_shop_contact_methods.sql
-- Description: Create shop contact methods table for managing multiple contact options
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-19
-- Task: #9.1 - Design and implement shop contact methods database schema

-- =============================================
-- SHOP CONTACT METHODS TABLE
-- =============================================

-- Create enum for contact method types
CREATE TYPE contact_method_type AS ENUM (
    'phone',
    'email', 
    'kakaotalk_channel',
    'kakaotalk_id',
    'instagram',
    'facebook',
    'youtube',
    'naver_blog',
    'tiktok',
    'website',
    'whatsapp',
    'telegram',
    'discord',
    'custom'
);

-- Create enum for contact method status
CREATE TYPE contact_method_status AS ENUM (
    'active',
    'inactive',
    'verified',
    'pending_verification',
    'suspended'
);

-- Main shop contact methods table
CREATE TABLE public.shop_contact_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    contact_type contact_method_type NOT NULL,
    contact_value TEXT NOT NULL,
    display_name VARCHAR(255), -- Human-readable name for the contact method
    is_primary BOOLEAN DEFAULT FALSE, -- Primary contact method for this type
    is_public BOOLEAN DEFAULT TRUE, -- Whether this contact method is visible to customers
    verification_status contact_method_status DEFAULT 'pending_verification',
    verification_token VARCHAR(255), -- Token for verification process
    verification_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}', -- Additional metadata (e.g., KakaoTalk channel info, social media handles)
    display_order INTEGER DEFAULT 0, -- Order for displaying multiple contact methods
    click_count INTEGER DEFAULT 0, -- Track how many times this contact method was accessed
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one primary contact method per type per shop
    UNIQUE(shop_id, contact_type, is_primary) DEFERRABLE INITIALLY DEFERRED,
    
    -- Ensure unique contact values within the same type (case-insensitive)
    UNIQUE(contact_type, LOWER(contact_value))
);

-- =============================================
-- CONTACT METHOD ACCESS LOG TABLE
-- =============================================

-- Track access to contact methods for analytics and security
CREATE TABLE public.contact_method_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_method_id UUID NOT NULL REFERENCES public.shop_contact_methods(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for anonymous access
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    access_type VARCHAR(50) DEFAULT 'view', -- 'view', 'click', 'call', 'message'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================

-- Primary indexes for shop contact methods
CREATE INDEX idx_shop_contact_methods_shop_id ON public.shop_contact_methods(shop_id);
CREATE INDEX idx_shop_contact_methods_type ON public.shop_contact_methods(contact_type);
CREATE INDEX idx_shop_contact_methods_status ON public.shop_contact_methods(verification_status);
CREATE INDEX idx_shop_contact_methods_primary ON public.shop_contact_methods(shop_id, contact_type, is_primary);
CREATE INDEX idx_shop_contact_methods_public ON public.shop_contact_methods(shop_id, is_public, verification_status);
CREATE INDEX idx_shop_contact_methods_display_order ON public.shop_contact_methods(shop_id, display_order);

-- Indexes for contact method access logs
CREATE INDEX idx_contact_access_logs_contact_method_id ON public.contact_method_access_logs(contact_method_id);
CREATE INDEX idx_contact_access_logs_user_id ON public.contact_method_access_logs(user_id);
CREATE INDEX idx_contact_access_logs_created_at ON public.contact_method_access_logs(created_at);
CREATE INDEX idx_contact_access_logs_ip_address ON public.contact_method_access_logs(ip_address);

-- Composite index for analytics queries
CREATE INDEX idx_contact_access_logs_analytics ON public.contact_method_access_logs(contact_method_id, created_at, access_type);

-- =============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- =============================================

-- Function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_contact_methods_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update updated_at
CREATE TRIGGER trigger_update_shop_contact_methods_updated_at
    BEFORE UPDATE ON public.shop_contact_methods
    FOR EACH ROW
    EXECUTE FUNCTION update_shop_contact_methods_updated_at();

-- =============================================
-- FUNCTIONS FOR CONTACT METHOD MANAGEMENT
-- =============================================

-- Function to ensure only one primary contact method per type per shop
CREATE OR REPLACE FUNCTION ensure_single_primary_contact_method()
RETURNS TRIGGER AS $$
BEGIN
    -- If setting a contact method as primary, unset all others of the same type
    IF NEW.is_primary = TRUE THEN
        UPDATE public.shop_contact_methods 
        SET is_primary = FALSE 
        WHERE shop_id = NEW.shop_id 
          AND contact_type = NEW.contact_type 
          AND id != NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce single primary contact method per type
CREATE TRIGGER trigger_ensure_single_primary_contact_method
    BEFORE INSERT OR UPDATE ON public.shop_contact_methods
    FOR EACH ROW
    EXECUTE FUNCTION ensure_single_primary_contact_method();

-- Function to increment click count when contact method is accessed
CREATE OR REPLACE FUNCTION increment_contact_method_click_count()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.shop_contact_methods 
    SET 
        click_count = click_count + 1,
        last_accessed_at = NOW()
    WHERE id = NEW.contact_method_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment click count on access
CREATE TRIGGER trigger_increment_contact_method_click_count
    AFTER INSERT ON public.contact_method_access_logs
    FOR EACH ROW
    EXECUTE FUNCTION increment_contact_method_click_count();

-- =============================================
-- VIEWS FOR COMMON QUERIES
-- =============================================

-- View for active public contact methods
CREATE VIEW public.shop_public_contact_methods AS
SELECT 
    scm.id,
    scm.shop_id,
    s.name as shop_name,
    scm.contact_type,
    scm.contact_value,
    scm.display_name,
    scm.is_primary,
    scm.metadata,
    scm.display_order,
    scm.click_count,
    scm.last_accessed_at
FROM public.shop_contact_methods scm
JOIN public.shops s ON scm.shop_id = s.id
WHERE scm.is_public = TRUE 
  AND scm.verification_status = 'verified'
  AND s.shop_status = 'active'
ORDER BY scm.shop_id, scm.display_order;

-- View for contact method analytics
CREATE VIEW public.contact_method_analytics AS
SELECT 
    scm.id as contact_method_id,
    scm.shop_id,
    s.name as shop_name,
    scm.contact_type,
    scm.contact_value,
    scm.click_count,
    COUNT(cmal.id) as total_accesses,
    COUNT(DISTINCT cmal.user_id) as unique_users,
    COUNT(DISTINCT DATE(cmal.created_at)) as active_days,
    MAX(cmal.created_at) as last_access,
    MIN(cmal.created_at) as first_access
FROM public.shop_contact_methods scm
JOIN public.shops s ON scm.shop_id = s.id
LEFT JOIN public.contact_method_access_logs cmal ON scm.id = cmal.contact_method_id
GROUP BY scm.id, scm.shop_id, s.name, scm.contact_type, scm.contact_value, scm.click_count;

-- =============================================
-- COMMENTS FOR DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.shop_contact_methods IS 'Stores multiple contact methods for shops including KakaoTalk channels, phone, email, and social media';
COMMENT ON TABLE public.contact_method_access_logs IS 'Logs access to shop contact methods for analytics and security monitoring';

COMMENT ON COLUMN public.shop_contact_methods.contact_type IS 'Type of contact method (phone, email, kakaotalk_channel, etc.)';
COMMENT ON COLUMN public.shop_contact_methods.contact_value IS 'The actual contact value (phone number, email, KakaoTalk channel URL, etc.)';
COMMENT ON COLUMN public.shop_contact_methods.display_name IS 'Human-readable name for display purposes';
COMMENT ON COLUMN public.shop_contact_methods.is_primary IS 'Whether this is the primary contact method for this type';
COMMENT ON COLUMN public.shop_contact_methods.is_public IS 'Whether this contact method is visible to customers';
COMMENT ON COLUMN public.shop_contact_methods.verification_status IS 'Current verification status of the contact method';
COMMENT ON COLUMN public.shop_contact_methods.metadata IS 'Additional metadata in JSON format (e.g., KakaoTalk channel info)';
COMMENT ON COLUMN public.shop_contact_methods.click_count IS 'Number of times this contact method has been accessed';

COMMENT ON VIEW public.shop_public_contact_methods IS 'View showing only active, verified, and public contact methods for shops';
COMMENT ON VIEW public.contact_method_analytics IS 'Analytics view for contact method usage and performance';

-- =============================================
-- INITIAL DATA MIGRATION
-- =============================================

-- Migrate existing contact information from shops table to the new contact methods table
INSERT INTO public.shop_contact_methods (
    shop_id, 
    contact_type, 
    contact_value, 
    display_name, 
    is_primary, 
    verification_status,
    display_order
)
SELECT 
    id as shop_id,
    'phone' as contact_type,
    phone_number as contact_value,
    'Phone Number' as display_name,
    TRUE as is_primary,
    CASE 
        WHEN shop_status = 'active' THEN 'verified'::contact_method_status
        ELSE 'pending_verification'::contact_method_status
    END as verification_status,
    1 as display_order
FROM public.shops 
WHERE phone_number IS NOT NULL AND phone_number != '';

INSERT INTO public.shop_contact_methods (
    shop_id, 
    contact_type, 
    contact_value, 
    display_name, 
    is_primary, 
    verification_status,
    display_order
)
SELECT 
    id as shop_id,
    'email' as contact_type,
    email as contact_value,
    'Email Address' as display_name,
    TRUE as is_primary,
    CASE 
        WHEN shop_status = 'active' THEN 'verified'::contact_method_status
        ELSE 'pending_verification'::contact_method_status
    END as verification_status,
    2 as display_order
FROM public.shops 
WHERE email IS NOT NULL AND email != '';

INSERT INTO public.shop_contact_methods (
    shop_id, 
    contact_type, 
    contact_value, 
    display_name, 
    is_primary, 
    verification_status,
    metadata,
    display_order
)
SELECT 
    id as shop_id,
    'kakaotalk_channel' as contact_type,
    kakao_channel_url as contact_value,
    'KakaoTalk Channel' as display_name,
    TRUE as is_primary,
    CASE 
        WHEN shop_status = 'active' THEN 'verified'::contact_method_status
        ELSE 'pending_verification'::contact_method_status
    END as verification_status,
    '{"migrated_from_shops_table": true}'::jsonb as metadata,
    3 as display_order
FROM public.shops 
WHERE kakao_channel_url IS NOT NULL AND kakao_channel_url != '';
