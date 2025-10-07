-- =============================================
-- SCHEMA CHUNK 18
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 0.4KB
-- =============================================

-- =============================================

-- 사용자 즐겨찾기 테이블
-- 홈 화면의 "내가 찜한 샵" 섹션을 위한 테이블
-- UNIQUE 제약으로 중복 즐겨찾기 방지
CREATE TABLE public.user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, shop_id) -- 동일 샵 중복 즐겨찾기 방지
);