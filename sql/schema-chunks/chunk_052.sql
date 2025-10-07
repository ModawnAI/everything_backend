-- =============================================
-- SCHEMA CHUNK 52
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 7.0KB
-- =============================================

-- =============================================

-- 기본 샵 카테고리 데이터
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

-- 기본 서비스 타입 데이터
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

-- 카테고리 메타데이터 초기 데이터
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

-- 기본 모더레이션 룰 데이터
-- 주의: created_by는 admin 사용자가 존재할 때만 설정됩니다
DO $$
DECLARE
    admin_user_id UUID;
    system_user_id UUID := '00000000-0000-0000-0000-000000000000'::UUID;
BEGIN
    -- admin 사용자 ID 가져오기
    SELECT id INTO admin_user_id FROM public.users WHERE user_role = 'admin' LIMIT 1;
    
    -- admin 사용자가 없으면 시스템 사용자 생성 또는 사용
    IF admin_user_id IS NULL THEN
        -- 시스템 사용자가 존재하는지 확인하고, 없으면 생성
        IF NOT EXISTS (SELECT 1 FROM public.users WHERE id = system_user_id) THEN
            -- auth.users에 시스템 사용자가 있는지 확인
            IF EXISTS (SELECT 1 FROM auth.users WHERE id = system_user_id) THEN
                -- auth.users에 있으면 public.users에 추가
                INSERT INTO public.users (
                    id, email, name, user_role, user_status, referral_code, created_at
                ) VALUES (
                    system_user_id,
                    'system@ebeautything.com',
                    'System User',
                    'admin',
                    'active',
                    'SYSTEM',
                    NOW()
                ) ON CONFLICT (id) DO NOTHING;
            ELSE
                -- auth.users에도 없으면 건너뛰기
                RAISE NOTICE 'Cannot create moderation rules: No admin user exists and system user cannot be created without auth.users entry';
                RETURN;
            END IF;
        END IF;
        admin_user_id := system_user_id;
    END IF;
    
    -- Insert moderation rules only if they don't already exist
    IF NOT EXISTS (SELECT 1 FROM public.moderation_rules WHERE name = 'Spam Keyword Detection') THEN
        INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
        (
            'Spam Keyword Detection',
            'Detects common spam keywords in shop descriptions and names',
            'keyword_filter',
            'flag_for_review',
            '{"keywords": ["spam", "scam", "fake", "click here", "free money", "get rich quick"], "case_sensitive": false, "match_type": "contains"}',
            2,
            admin_user_id
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.moderation_rules WHERE name = 'Inappropriate Language Filter') THEN
        INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
        (
            'Inappropriate Language Filter',
            'Detects inappropriate language in shop content',
            'inappropriate_language',
            'flag_for_review',
            '{"severity_threshold": 0.7, "categories": ["profanity", "hate_speech", "harassment"]}',
            3,
            admin_user_id
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.moderation_rules WHERE name = 'Duplicate Content Detection') THEN
        INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
        (
            'Duplicate Content Detection',
            'Detects duplicate shop descriptions or suspiciously similar content',
            'duplicate_content',
            'flag_for_review',
            '{"similarity_threshold": 0.85, "check_fields": ["description", "name"]}',
            2,
            admin_user_id
        );
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM public.moderation_rules WHERE name = 'Suspicious Contact Information') THEN
        INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
        (
            'Suspicious Contact Information',
            'Detects suspicious or fake contact information patterns',
            'custom_regex',
            'flag_for_review',
            '{"patterns": ["^(\\+?1?[-.\\(\\)\\s]?)?(\\d{3}[-.\\(\\)\\s]?)?\\d{3}[-.\\(\\)\\s]?\\d{4}$", "test@.*\\.com", "fake@.*\\.com"], "description": "Phone numbers and suspicious email patterns"}',
            2,
            admin_user_id
        );
    END IF;
END $$;