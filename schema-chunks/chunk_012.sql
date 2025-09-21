-- =============================================
-- SCHEMA CHUNK 12
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 2.6KB
-- =============================================

-- =============================================

-- 피드 게시물 테이블
-- v3.2 피드 기능: 샵, 인플루언서, 일반 사용자가 콘텐츠를 게시하고 소통
CREATE TABLE public.feed_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- 게시물 텍스트 내용
    category service_category, -- 관련 서비스 카테고리 (선택사항)
    location_tag TEXT, -- 위치 태그 (예: "서울시 강남구")
    tagged_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL, -- 태그된 샵
    hashtags TEXT[], -- 해시태그 배열
    status post_status DEFAULT 'active', -- 게시물 상태
    like_count INTEGER DEFAULT 0, -- 좋아요 수 (성능용 비정규화)
    comment_count INTEGER DEFAULT 0, -- 댓글 수 (성능용 비정규화)
    view_count INTEGER DEFAULT 0, -- 조회 수 (분석용)
    report_count INTEGER DEFAULT 0, -- 신고 수
    is_featured BOOLEAN DEFAULT FALSE, -- 추천 게시물 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 피드 게시물 이미지 테이블
-- 게시물당 여러 이미지 지원 (최대 10개)
CREATE TABLE public.post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    alt_text VARCHAR(255), -- 접근성을 위한 대체 텍스트
    display_order INTEGER DEFAULT 0, -- 이미지 노출 순서
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 게시물 좋아요 테이블
-- 사용자별 좋아요 기록 및 중복 방지
CREATE TABLE public.post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id) -- 동일 게시물 중복 좋아요 방지
);

-- 게시물 댓글 테이블
-- 댓글 및 대댓글 지원 (parent_comment_id 활용)
CREATE TABLE public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE, -- 대댓글용
    content TEXT NOT NULL, -- 댓글 내용
    status comment_status DEFAULT 'active', -- 댓글 상태
    like_count INTEGER DEFAULT 0, -- 댓글 좋아요 수
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 댓글 좋아요 테이블
-- 댓글에 대한 좋아요 기능
CREATE TABLE public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id) -- 동일 댓글 중복 좋아요 방지
);