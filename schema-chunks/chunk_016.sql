-- =============================================
-- SCHEMA CHUNK 16
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 2.9KB
-- =============================================

-- =============================================

-- 샵 연락처 방법 테이블
-- "가게 메시지 보내기" 기능을 위한 다양한 연락 수단 관리
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

-- 연락처 방법 접근 로그 테이블
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

-- 샵 연락처 정보 테이블 (v3.2 레거시 - 호환성 유지)
-- "가게 메시지 보내기" 기능을 위한 다양한 연락 수단 관리
-- JSONB 구조로 통합하여 중복 제거
CREATE TABLE public.shop_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    contact_methods JSONB NOT NULL DEFAULT '[]', -- 연락 수단들 배열
    -- JSONB 구조 예시:
    -- [
    --   {"type": "kakao", "label": "카카오톡 채널", "value": "https://pf.kakao.com/_abc123", "is_primary": true},
    --   {"type": "instagram", "label": "인스타그램", "value": "@shop_handle", "is_primary": false},
    --   {"type": "phone", "label": "전화 문의", "value": "02-123-4567", "is_primary": false},
    --   {"type": "website", "label": "홈페이지", "value": "https://shop.com", "is_primary": false}
    -- ]
    is_active BOOLEAN DEFAULT TRUE, -- 연락처 활성화 상태
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id)
);