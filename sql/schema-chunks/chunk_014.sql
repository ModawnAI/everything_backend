-- =============================================
-- SCHEMA CHUNK 14
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 2.5KB
-- =============================================

-- =============================================

-- 샵 카테고리 테이블
-- 서비스 카테고리의 상세한 관리를 위한 확장 테이블
CREATE TABLE public.shop_categories (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    subcategories TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 서비스 타입 테이블
-- 각 카테고리별 상세 서비스 타입 정의
CREATE TABLE public.service_types (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_range JSONB NOT NULL DEFAULT '{"min": 0, "max": 0}',
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_popular BOOLEAN DEFAULT FALSE,
    requirements TEXT[] DEFAULT '{}',
    benefits TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 카테고리 메타데이터 테이블
CREATE TABLE public.category_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, metadata_key)
);

-- 서비스 타입 메타데이터 테이블
CREATE TABLE public.service_type_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type_id TEXT NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_type_id, metadata_key)
);

-- 카테고리 계층 구조 테이블
CREATE TABLE public.category_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    child_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    hierarchy_level INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_category_id, child_category_id),
    CHECK (parent_category_id != child_category_id)
);