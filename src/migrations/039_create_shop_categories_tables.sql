-- Migration: Create Shop Categories Tables
-- Description: Creates tables for shop categories, service types, and related metadata
-- Version: 039
-- Created: 2024-01-XX

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create shop_categories table
CREATE TABLE IF NOT EXISTS public.shop_categories (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    subcategories TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create service_types table
CREATE TABLE IF NOT EXISTS public.service_types (
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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- Create category_metadata table for additional category information
CREATE TABLE IF NOT EXISTS public.category_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(category_id, metadata_key)
);

-- Create service_type_metadata table for additional service type information
CREATE TABLE IF NOT EXISTS public.service_type_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type_id TEXT NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_type_id, metadata_key)
);

-- Create category_hierarchy table for hierarchical relationships
CREATE TABLE IF NOT EXISTS public.category_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    child_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    hierarchy_level INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(parent_category_id, child_category_id),
    CHECK (parent_category_id != child_category_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shop_categories_active ON public.shop_categories(is_active);
CREATE INDEX IF NOT EXISTS idx_shop_categories_sort_order ON public.shop_categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_service_types_category_id ON public.service_types(category_id);
CREATE INDEX IF NOT EXISTS idx_service_types_active ON public.service_types(is_active);
CREATE INDEX IF NOT EXISTS idx_service_types_popular ON public.service_types(is_popular);
CREATE INDEX IF NOT EXISTS idx_service_types_sort_order ON public.service_types(sort_order);
CREATE INDEX IF NOT EXISTS idx_category_metadata_category_id ON public.category_metadata(category_id);
CREATE INDEX IF NOT EXISTS idx_service_type_metadata_service_type_id ON public.service_type_metadata(service_type_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_parent ON public.category_hierarchy(parent_category_id);
CREATE INDEX IF NOT EXISTS idx_category_hierarchy_child ON public.category_hierarchy(child_category_id);

-- Enable Row Level Security
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_hierarchy ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shop_categories
CREATE POLICY "Allow public read access to active shop categories" ON public.shop_categories
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Allow authenticated users to read all shop categories" ON public.shop_categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to shop categories" ON public.shop_categories
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for service_types
CREATE POLICY "Allow public read access to active service types" ON public.service_types
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Allow authenticated users to read all service types" ON public.service_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to service types" ON public.service_types
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for category_metadata
CREATE POLICY "Allow public read access to category metadata" ON public.category_metadata
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to category metadata" ON public.category_metadata
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for service_type_metadata
CREATE POLICY "Allow public read access to service type metadata" ON public.service_type_metadata
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to service type metadata" ON public.service_type_metadata
    FOR ALL USING (auth.role() = 'service_role');

-- RLS Policies for category_hierarchy
CREATE POLICY "Allow public read access to category hierarchy" ON public.category_hierarchy
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to category hierarchy" ON public.category_hierarchy
    FOR ALL USING (auth.role() = 'service_role');

-- Insert default shop categories
INSERT INTO public.shop_categories (id, display_name, description, icon, color, subcategories, is_active, sort_order) VALUES
('nail', '네일아트', '매니큐어, 페디큐어, 네일아트 등 네일 관련 서비스', '💅', '#FF6B9D', ARRAY['manicure', 'pedicure', 'nail_art', 'gel_nails'], TRUE, 1),
('eyelash', '속눈썹', '속눈썹 연장, 리프팅, 펌 등 속눈썹 관련 서비스', '👁️', '#8B5CF6', ARRAY['lash_extension', 'lash_lifting', 'lash_perm'], TRUE, 2),
('waxing', '왁싱', '털 제거를 위한 왁싱 서비스', '🪶', '#F59E0B', ARRAY['face_waxing', 'body_waxing', 'bikini_waxing'], TRUE, 3),
('eyebrow_tattoo', '눈썹 문신', '반영구 눈썹 문신 및 보정 서비스', '✏️', '#10B981', ARRAY['eyebrow_tattoo', 'eyebrow_correction', 'eyebrow_design'], TRUE, 4),
('hair', '헤어', '헤어컷, 펌, 염색 등 헤어 관련 서비스', '💇‍♀️', '#3B82F6', ARRAY['haircut', 'perm', 'dye', 'styling'], TRUE, 5)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    subcategories = EXCLUDED.subcategories,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Insert default service types for each category
INSERT INTO public.service_types (id, category_id, name, description, price_range, duration_minutes, is_popular, requirements, benefits, is_active, sort_order) VALUES
-- Nail services
('basic_manicure', 'nail', '베이직 매니큐어', '기본적인 손톱 관리 및 매니큐어', '{"min": 15000, "max": 25000}', 60, TRUE, ARRAY['깨끗한 손'], ARRAY['손톱 건강', '깔끔한 외관'], TRUE, 1),
('gel_manicure', 'nail', '젤 매니큐어', '오래 지속되는 젤 매니큐어', '{"min": 25000, "max": 40000}', 90, TRUE, ARRAY['기존 젤 제거', '깨끗한 손'], ARRAY['2-3주 지속', '반짝이는 외관'], TRUE, 2),
('nail_art', 'nail', '네일아트', '다양한 디자인의 네일아트', '{"min": 30000, "max": 60000}', 120, FALSE, ARRAY['젤 매니큐어', '디자인 선택'], ARRAY['개성 표현', '특별한 외관'], TRUE, 3),
('pedicure', 'nail', '페디큐어', '발톱 관리 및 발 케어 서비스', '{"min": 25000, "max": 60000}', 90, FALSE, ARRAY['발 상태 확인'], ARRAY['발 건강 관리', '깔끔한 발톱'], TRUE, 4),

-- Eyelash services
('classic_extension', 'eyelash', '클래식 속눈썹 연장', '자연스러운 속눈썹 연장', '{"min": 40000, "max": 60000}', 120, TRUE, ARRAY['속눈썹 정리', '알레르기 테스트'], ARRAY['자연스러운 연장', '2-3주 지속'], TRUE, 1),
('volume_extension', 'eyelash', '볼륨 속눈썹 연장', '풍성한 볼륨의 속눈썹 연장', '{"min": 50000, "max": 80000}', 150, TRUE, ARRAY['속눈썹 정리', '알레르기 테스트'], ARRAY['풍성한 볼륨', '드라마틱한 효과'], TRUE, 2),
('lash_lifting', 'eyelash', '속눈썹 리프팅', '자연 속눈썹을 위로 올리는 리프팅', '{"min": 30000, "max": 50000}', 90, FALSE, ARRAY['깨끗한 속눈썹'], ARRAY['자연스러운 곡선', '6-8주 지속'], TRUE, 3),

-- Waxing services
('face_waxing', 'waxing', '페이스 왁싱', '얼굴 털 제거 왁싱', '{"min": 10000, "max": 20000}', 30, TRUE, ARRAY['깨끗한 피부', '자극 없는 상태'], ARRAY['부드러운 피부', '2-3주 지속'], TRUE, 1),
('body_waxing', 'waxing', '바디 왁싱', '몸 전체 털 제거 왁싱', '{"min": 30000, "max": 80000}', 120, FALSE, ARRAY['깨끗한 피부', '충분한 털 길이'], ARRAY['부드러운 피부', '3-4주 지속'], TRUE, 2),
('bikini_waxing', 'waxing', '비키니 왁싱', '비키니 라인 털 제거 왁싱', '{"min": 25000, "max": 50000}', 45, TRUE, ARRAY['털 길이 확인', '피부 상태 체크'], ARRAY['깔끔한 라인', '자신감 향상'], TRUE, 3),

-- Eyebrow tattoo services
('eyebrow_tattoo', 'eyebrow_tattoo', '눈썹 문신', '반영구 눈썹 문신', '{"min": 100000, "max": 200000}', 180, TRUE, ARRAY['피부 상태 확인', '알레르기 테스트'], ARRAY['자연스러운 눈썹', '1-2년 지속'], TRUE, 1),
('eyebrow_correction', 'eyebrow_tattoo', '눈썹 보정', '기존 눈썹 문신 보정', '{"min": 150000, "max": 300000}', 240, FALSE, ARRAY['기존 문신 확인', '보정 가능성 검토'], ARRAY['개선된 모양', '자연스러운 결과'], TRUE, 2),
('eyebrow_design', 'eyebrow_tattoo', '눈썹 디자인', '맞춤형 눈썹 디자인 문신', '{"min": 120000, "max": 250000}', 200, FALSE, ARRAY['상담', '디자인 선택'], ARRAY['개성 있는 눈썹', '자연스러운 모양'], TRUE, 3),

-- Hair services
('haircut', 'hair', '헤어컷', '기본 헤어컷 서비스', '{"min": 20000, "max": 50000}', 60, TRUE, ARRAY['깨끗한 머리'], ARRAY['깔끔한 스타일', '상담 포함'], TRUE, 1),
('perm', 'hair', '펌', '머리카락 곱슬펌', '{"min": 50000, "max": 120000}', 180, FALSE, ARRAY['머리카락 상태 확인', '상담'], ARRAY['곱슬 스타일', '3-6개월 지속'], TRUE, 2),
('hair_dye', 'hair', '헤어 염색', '머리카락 염색 서비스', '{"min": 40000, "max": 150000}', 120, TRUE, ARRAY['알레르기 테스트', '상담'], ARRAY['새로운 색상', '개성 표현'], TRUE, 3),
('hair_treatment', 'hair', '헤어 트리트먼트', '헤어 케어 및 치료 서비스', '{"min": 30000, "max": 120000}', 90, FALSE, ARRAY['헤어 상태 진단'], ARRAY['건강한 헤어', '손상 복구'], TRUE, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_range = EXCLUDED.price_range,
    duration_minutes = EXCLUDED.duration_minutes,
    is_popular = EXCLUDED.is_popular,
    requirements = EXCLUDED.requirements,
    benefits = EXCLUDED.benefits,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- Insert some sample category metadata
INSERT INTO public.category_metadata (category_id, metadata_key, metadata_value) VALUES
('nail', 'popularity_score', '{"score": 85, "trend": "increasing"}'),
('eyelash', 'popularity_score', '{"score": 92, "trend": "stable"}'),
('waxing', 'popularity_score', '{"score": 78, "trend": "increasing"}'),
('eyebrow_tattoo', 'popularity_score', '{"score": 88, "trend": "stable"}'),
('hair', 'popularity_score', '{"score": 95, "trend": "increasing"}'),
('nail', 'seasonal_trends', '{"spring": 90, "summer": 95, "autumn": 85, "winter": 80}'),
('eyelash', 'seasonal_trends', '{"spring": 85, "summer": 90, "autumn": 88, "winter": 92}'),
('waxing', 'seasonal_trends', '{"spring": 95, "summer": 98, "autumn": 85, "winter": 70}'),
('eyebrow_tattoo', 'seasonal_trends', '{"spring": 88, "summer": 85, "autumn": 90, "winter": 92}'),
('hair', 'seasonal_trends', '{"spring": 90, "summer": 85, "autumn": 95, "winter": 88}')
ON CONFLICT (category_id, metadata_key) DO UPDATE SET
    metadata_value = EXCLUDED.metadata_value,
    updated_at = NOW();

-- Insert some sample service type metadata
INSERT INTO public.service_type_metadata (service_type_id, metadata_key, metadata_value) VALUES
('gel_manicure', 'difficulty_level', '{"level": "intermediate", "score": 6}'),
('volume_extension', 'difficulty_level', '{"level": "advanced", "score": 8}'),
('eyebrow_tattoo', 'difficulty_level', '{"level": "expert", "score": 9}'),
('hair_dye', 'difficulty_level', '{"level": "intermediate", "score": 7}'),
('gel_manicure', 'equipment_required', '{"items": ["UV lamp", "gel polish", "nail files", "cuticle pusher"]}'),
('volume_extension', 'equipment_required', '{"items": ["lash extensions", "adhesive", "tweezers", "eye pads"]}'),
('eyebrow_tattoo', 'equipment_required', '{"items": ["tattoo machine", "pigments", "needles", "numbing cream"]}'),
('hair_dye', 'equipment_required', '{"items": ["hair color", "developer", "brushes", "foil sheets"]}')
ON CONFLICT (service_type_id, metadata_key) DO UPDATE SET
    metadata_value = EXCLUDED.metadata_value,
    updated_at = NOW();

-- Create functions for category management
CREATE OR REPLACE FUNCTION public.get_category_hierarchy()
RETURNS TABLE (
    category_id TEXT,
    display_name TEXT,
    parent_category_id TEXT,
    hierarchy_level INTEGER,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as category_id,
        c.display_name,
        h.parent_category_id,
        h.hierarchy_level,
        c.sort_order
    FROM public.shop_categories c
    LEFT JOIN public.category_hierarchy h ON c.id = h.child_category_id
    WHERE c.is_active = TRUE
    ORDER BY c.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.get_category_statistics()
RETURNS TABLE (
    total_categories BIGINT,
    active_categories BIGINT,
    total_services BIGINT,
    popular_services BIGINT,
    average_price_per_category JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.shop_categories) as total_categories,
        (SELECT COUNT(*) FROM public.shop_categories WHERE is_active = TRUE) as active_categories,
        (SELECT COUNT(*) FROM public.service_types) as total_services,
        (SELECT COUNT(*) FROM public.service_types WHERE is_popular = TRUE) as popular_services,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'category_id', c.id,
                    'category_name', c.display_name,
                    'average_price', (
                        SELECT AVG((st.price_range->>'min')::numeric + (st.price_range->>'max')::numeric) / 2
                        FROM public.service_types st
                        WHERE st.category_id = c.id AND st.is_active = TRUE
                    )
                )
            )
            FROM public.shop_categories c
            WHERE c.is_active = TRUE
        ) as average_price_per_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_shop_categories_updated_at
    BEFORE UPDATE ON public.shop_categories
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_types_updated_at
    BEFORE UPDATE ON public.service_types
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_category_metadata_updated_at
    BEFORE UPDATE ON public.category_metadata
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_type_metadata_updated_at
    BEFORE UPDATE ON public.service_type_metadata
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Create views for easier querying
CREATE OR REPLACE VIEW public.active_categories_with_services AS
SELECT 
    c.id,
    c.display_name,
    c.description,
    c.icon,
    c.color,
    c.subcategories,
    c.sort_order,
    COUNT(st.id) as service_count,
    COUNT(CASE WHEN st.is_popular THEN 1 END) as popular_service_count
FROM public.shop_categories c
LEFT JOIN public.service_types st ON c.id = st.category_id AND st.is_active = TRUE
WHERE c.is_active = TRUE
GROUP BY c.id, c.display_name, c.description, c.icon, c.color, c.subcategories, c.sort_order
ORDER BY c.sort_order;

CREATE OR REPLACE VIEW public.popular_services_by_category AS
SELECT 
    c.id as category_id,
    c.display_name as category_name,
    st.id as service_id,
    st.name as service_name,
    st.description,
    st.price_range,
    st.duration_minutes,
    st.sort_order
FROM public.shop_categories c
JOIN public.service_types st ON c.id = st.category_id
WHERE c.is_active = TRUE 
    AND st.is_active = TRUE 
    AND st.is_popular = TRUE
ORDER BY c.sort_order, st.sort_order;

-- Grant necessary permissions
GRANT SELECT ON public.shop_categories TO authenticated;
GRANT SELECT ON public.service_types TO authenticated;
GRANT SELECT ON public.category_metadata TO authenticated;
GRANT SELECT ON public.service_type_metadata TO authenticated;
GRANT SELECT ON public.category_hierarchy TO authenticated;
GRANT SELECT ON public.active_categories_with_services TO authenticated;
GRANT SELECT ON public.popular_services_by_category TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION public.get_category_hierarchy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_category_statistics() TO authenticated;
