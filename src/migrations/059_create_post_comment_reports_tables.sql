-- Migration: Create post_reports and comment_reports tables
-- Description: Creates the missing report tables needed for content moderation triggers
-- Author: AI Assistant
-- Date: 2025-01-27

-- Create post_reports table for reporting feed posts
CREATE TABLE IF NOT EXISTS public.post_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    description TEXT, -- Optional detailed description from reporter
    status report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT, -- Notes from the moderator/admin
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
    is_escalated BOOLEAN DEFAULT FALSE, -- Flag for escalated reports
    escalation_reason TEXT, -- Reason for escalation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only report the same post once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, post_id) DEFERRABLE INITIALLY DEFERRED
);

-- Create comment_reports table for reporting post comments
CREATE TABLE IF NOT EXISTS public.comment_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    description TEXT, -- Optional detailed description from reporter
    status report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT, -- Notes from the moderator/admin
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
    is_escalated BOOLEAN DEFAULT FALSE, -- Flag for escalated reports
    escalation_reason TEXT, -- Reason for escalation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only report the same comment once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, comment_id) DEFERRABLE INITIALLY DEFERRED
);

-- Add missing columns to feed_posts table if they don't exist
DO $$
BEGIN
    -- Add moderation_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'feed_posts' 
        AND column_name = 'moderation_status'
    ) THEN
        ALTER TABLE public.feed_posts 
        ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'approved';
    END IF;

    -- Add is_hidden column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'feed_posts' 
        AND column_name = 'is_hidden'
    ) THEN
        ALTER TABLE public.feed_posts 
        ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add hidden_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'feed_posts' 
        AND column_name = 'hidden_at'
    ) THEN
        ALTER TABLE public.feed_posts 
        ADD COLUMN hidden_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add missing columns to post_comments table if they don't exist
DO $$
BEGIN
    -- Add moderation_status column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' 
        AND column_name = 'moderation_status'
    ) THEN
        ALTER TABLE public.post_comments 
        ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'approved';
    END IF;

    -- Add is_hidden column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' 
        AND column_name = 'is_hidden'
    ) THEN
        ALTER TABLE public.post_comments 
        ADD COLUMN is_hidden BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add hidden_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' 
        AND column_name = 'hidden_at'
    ) THEN
        ALTER TABLE public.post_comments 
        ADD COLUMN hidden_at TIMESTAMPTZ;
    END IF;

    -- Add report_count column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'post_comments' 
        AND column_name = 'report_count'
    ) THEN
        ALTER TABLE public.post_comments 
        ADD COLUMN report_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON public.post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON public.post_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON public.post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON public.post_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON public.comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_reporter_id ON public.comment_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON public.comment_reports(status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_created_at ON public.comment_reports(created_at);

-- Create indexes on feed_posts for moderation
CREATE INDEX IF NOT EXISTS idx_feed_posts_moderation_status ON public.feed_posts(moderation_status);
CREATE INDEX IF NOT EXISTS idx_feed_posts_is_hidden ON public.feed_posts(is_hidden);
CREATE INDEX IF NOT EXISTS idx_feed_posts_report_count ON public.feed_posts(report_count);

-- Create indexes on post_comments for moderation
CREATE INDEX IF NOT EXISTS idx_post_comments_moderation_status ON public.post_comments(moderation_status);
CREATE INDEX IF NOT EXISTS idx_post_comments_is_hidden ON public.post_comments(is_hidden);
CREATE INDEX IF NOT EXISTS idx_post_comments_report_count ON public.post_comments(report_count);

-- Add comments for documentation
COMMENT ON TABLE public.post_reports IS 'Reports submitted by users against feed posts';
COMMENT ON TABLE public.comment_reports IS 'Reports submitted by users against post comments';
COMMENT ON COLUMN public.feed_posts.moderation_status IS 'Current moderation status of the post';
COMMENT ON COLUMN public.feed_posts.is_hidden IS 'Whether the post is currently hidden from public view';
COMMENT ON COLUMN public.feed_posts.hidden_at IS 'Timestamp when the post was hidden';
COMMENT ON COLUMN public.post_comments.moderation_status IS 'Current moderation status of the comment';
COMMENT ON COLUMN public.post_comments.is_hidden IS 'Whether the comment is currently hidden from public view';
COMMENT ON COLUMN public.post_comments.hidden_at IS 'Timestamp when the comment was hidden';
COMMENT ON COLUMN public.post_comments.report_count IS 'Number of reports against this comment';

-- Grant necessary permissions (adjust as needed for your user roles)
-- GRANT SELECT, INSERT, UPDATE ON public.post_reports TO authenticated;
-- GRANT SELECT, INSERT, UPDATE ON public.comment_reports TO authenticated;
-- GRANT SELECT, UPDATE ON public.feed_posts TO authenticated;
-- GRANT SELECT, UPDATE ON public.post_comments TO authenticated;
