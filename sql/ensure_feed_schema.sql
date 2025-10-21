-- =============================================
-- FEED SYSTEM SCHEMA VERIFICATION
-- =============================================
-- This script ensures all feed-related tables, enums, indexes,
-- and RLS policies are properly created in Supabase
-- Run this in Supabase SQL Editor to verify feed system setup
-- =============================================

-- =============================================
-- ENUMS
-- =============================================

-- Post status enum
DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('active', 'hidden', 'reported', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Comment status enum
DO $$ BEGIN
    CREATE TYPE comment_status AS ENUM ('active', 'hidden', 'deleted');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Feed posts table
CREATE TABLE IF NOT EXISTS public.feed_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    category service_category,
    location_tag TEXT,
    tagged_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    hashtags TEXT[],
    status post_status DEFAULT 'active',
    like_count INTEGER DEFAULT 0,
    comment_count INTEGER DEFAULT 0,
    view_count INTEGER DEFAULT 0,
    report_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post images table
CREATE TABLE IF NOT EXISTS public.post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Post likes table
CREATE TABLE IF NOT EXISTS public.post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id)
);

-- Post comments table
CREATE TABLE IF NOT EXISTS public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    status comment_status DEFAULT 'active',
    like_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Comment likes table
CREATE TABLE IF NOT EXISTS public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id)
);

-- =============================================
-- INDEXES
-- =============================================

-- Feed posts indexes
CREATE INDEX IF NOT EXISTS idx_feed_posts_author_id ON public.feed_posts(author_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON public.feed_posts(status);
CREATE INDEX IF NOT EXISTS idx_feed_posts_category ON public.feed_posts(category);
CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON public.feed_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feed_posts_location_tag ON public.feed_posts(location_tag);
CREATE INDEX IF NOT EXISTS idx_feed_posts_tagged_shop ON public.feed_posts(tagged_shop_id);
CREATE INDEX IF NOT EXISTS idx_feed_posts_location_category ON public.feed_posts(location_tag, category) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_feed_posts_author_created ON public.feed_posts(author_id, created_at DESC) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_feed_posts_timeline ON public.feed_posts(status, created_at DESC) WHERE status = 'active';

-- Post likes indexes
CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);

-- Post comments indexes
CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_comment_id);

-- Post images indexes
CREATE INDEX IF NOT EXISTS idx_post_images_post_id ON public.post_images(post_id);

-- Comment likes indexes
CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);

-- =============================================
-- ROW LEVEL SECURITY (RLS)
-- =============================================

-- Enable RLS on all feed tables
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Public can read active posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can manage own posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Admins can manage all feed content" ON public.feed_posts;
DROP POLICY IF EXISTS "Post owners can manage post images" ON public.post_images;
DROP POLICY IF EXISTS "Public can view post images" ON public.post_images;
DROP POLICY IF EXISTS "Users can like active posts" ON public.post_likes;
DROP POLICY IF EXISTS "Users can comment on active posts" ON public.post_comments;
DROP POLICY IF EXISTS "Users can manage own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can delete own comments" ON public.post_comments;
DROP POLICY IF EXISTS "Admins can manage all comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can like active comments" ON public.comment_likes;

-- Feed posts policies
CREATE POLICY "Public can read active posts" ON public.feed_posts
    FOR SELECT USING (status = 'active');

CREATE POLICY "Users can manage own posts" ON public.feed_posts
    FOR ALL USING (auth.uid() = author_id);

CREATE POLICY "Admins can manage all feed content" ON public.feed_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Post images policies
CREATE POLICY "Post owners can manage post images" ON public.post_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts
            WHERE feed_posts.id = post_images.post_id
            AND feed_posts.author_id = auth.uid()
        )
    );

CREATE POLICY "Public can view post images" ON public.post_images
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts
            WHERE feed_posts.id = post_images.post_id
            AND feed_posts.status = 'active'
        )
    );

-- Post likes policies
CREATE POLICY "Users can like active posts" ON public.post_likes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts
            WHERE feed_posts.id = post_likes.post_id
            AND feed_posts.status = 'active'
        )
    );

-- Post comments policies
CREATE POLICY "Users can comment on active posts" ON public.post_comments
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.feed_posts
            WHERE feed_posts.id = post_comments.post_id
            AND feed_posts.status = 'active'
        )
    );

CREATE POLICY "Public can read active comments" ON public.post_comments
    FOR SELECT USING (status = 'active');

CREATE POLICY "Users can manage own comments" ON public.post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments
    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all comments" ON public.post_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Comment likes policies
CREATE POLICY "Users can like active comments" ON public.comment_likes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.post_comments
            WHERE post_comments.id = comment_likes.comment_id
            AND post_comments.status = 'active'
        )
    );

-- =============================================
-- VERIFICATION QUERIES
-- =============================================

-- Run these to verify the schema is set up correctly:

-- Check if all tables exist
SELECT
    table_name,
    CASE WHEN table_name IN (
        'feed_posts', 'post_images', 'post_likes',
        'post_comments', 'comment_likes'
    ) THEN '✓ EXISTS' ELSE '✗ MISSING' END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'feed_posts', 'post_images', 'post_likes',
    'post_comments', 'comment_likes'
)
ORDER BY table_name;

-- Check if RLS is enabled
SELECT
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'feed_posts', 'post_images', 'post_likes',
    'post_comments', 'comment_likes'
)
ORDER BY tablename;

-- Check indexes
SELECT
    schemaname,
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'public'
AND tablename IN (
    'feed_posts', 'post_images', 'post_likes',
    'post_comments', 'comment_likes'
)
ORDER BY tablename, indexname;

-- =============================================
-- SUCCESS MESSAGE
-- =============================================
DO $$
BEGIN
    RAISE NOTICE '✓ Feed schema verification complete!';
    RAISE NOTICE '✓ Tables: feed_posts, post_images, post_likes, post_comments, comment_likes';
    RAISE NOTICE '✓ Indexes created for optimal performance';
    RAISE NOTICE '✓ Row Level Security (RLS) enabled';
    RAISE NOTICE '✓ RLS policies configured';
END $$;
