-- =============================================
-- Fix feed_posts category type
-- =============================================
-- Change feed_posts.category from service_category enum to TEXT
-- to allow flexible categorization for feed posts
-- Generated: 2025-10-24
-- =============================================

-- Create a new feed post category enum (optional - can uncomment if you want specific categories)
-- CREATE TYPE feed_post_category AS ENUM (
--   'review',           -- 리뷰 게시물
--   'tutorial',         -- 튜토리얼/가이드
--   'before_after',     -- 전후 비교
--   'promotion',        -- 프로모션/할인
--   'news',            -- 뉴스/공지
--   'question',        -- 질문
--   'general'          -- 일반 게시물
-- );

-- Step 1: Change category column to TEXT (more flexible approach)
ALTER TABLE public.feed_posts
  ALTER COLUMN category DROP DEFAULT;

ALTER TABLE public.feed_posts
  ALTER COLUMN category TYPE TEXT
  USING category::text;

-- Step 2: Make it nullable since it's optional
ALTER TABLE public.feed_posts
  ALTER COLUMN category DROP NOT NULL;

-- Step 3: Add a check constraint for valid categories (optional - limits but provides flexibility)
ALTER TABLE public.feed_posts
  ADD CONSTRAINT feed_posts_category_check
  CHECK (
    category IS NULL OR
    category IN (
      -- Service categories (for shop-related posts)
      'nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair',
      -- Feed-specific categories
      'review', 'tutorial', 'before_after', 'promotion', 'news', 'question', 'general'
    )
  );

-- =============================================
-- Migration completed successfully
-- =============================================
