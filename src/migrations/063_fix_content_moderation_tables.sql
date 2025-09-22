-- Migration: Fix content moderation tables and triggers
-- Description: Creates missing post_reports and comment_reports tables, adds missing columns
-- Author: AI Assistant
-- Date: 2025-01-27

-- First, let's add missing columns to feed_posts table if they don't exist
DO $$
BEGIN
    -- Add is_hidden column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feed_posts' AND column_name = 'is_hidden') THEN
        ALTER TABLE feed_posts ADD COLUMN is_hidden BOOLEAN DEFAULT false;
    END IF;
    
    -- Add moderation_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feed_posts' AND column_name = 'moderation_status') THEN
        ALTER TABLE feed_posts ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'active';
    END IF;
    
    -- Add hidden_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'feed_posts' AND column_name = 'hidden_at') THEN
        ALTER TABLE feed_posts ADD COLUMN hidden_at TIMESTAMPTZ;
    END IF;
END $$;

-- Add missing columns to post_comments table if they don't exist
DO $$
BEGIN
    -- Add is_hidden column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'post_comments' AND column_name = 'is_hidden') THEN
        ALTER TABLE post_comments ADD COLUMN is_hidden BOOLEAN DEFAULT false;
    END IF;
    
    -- Add moderation_status column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'post_comments' AND column_name = 'moderation_status') THEN
        ALTER TABLE post_comments ADD COLUMN moderation_status VARCHAR(20) DEFAULT 'active';
    END IF;
    
    -- Add hidden_at column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'post_comments' AND column_name = 'hidden_at') THEN
        ALTER TABLE post_comments ADD COLUMN hidden_at TIMESTAMPTZ;
    END IF;
    
    -- Add report_count column if it doesn't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'post_comments' AND column_name = 'report_count') THEN
        ALTER TABLE post_comments ADD COLUMN report_count INTEGER DEFAULT 0;
    END IF;
END $$;

-- Create post_reports table
CREATE TABLE IF NOT EXISTS post_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL, -- report reason
    description TEXT, -- detailed description from reporter
    status VARCHAR(20) DEFAULT 'pending', -- pending, resolved, dismissed
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- admin who reviewed
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT, -- notes from the moderator/admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only report the same post once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, post_id) DEFERRABLE INITIALLY DEFERRED
);

-- Create comment_reports table
CREATE TABLE IF NOT EXISTS comment_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES post_comments(id) ON DELETE CASCADE,
    reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason VARCHAR(50) NOT NULL, -- report reason
    description TEXT, -- detailed description from reporter
    status VARCHAR(20) DEFAULT 'pending', -- pending, resolved, dismissed
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL, -- admin who reviewed
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT, -- notes from the moderator/admin
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only report the same comment once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, comment_id) DEFERRABLE INITIALLY DEFERRED
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_post_reports_post_id ON post_reports(post_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_reporter_id ON post_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_post_reports_status ON post_reports(status);
CREATE INDEX IF NOT EXISTS idx_post_reports_created_at ON post_reports(created_at);

CREATE INDEX IF NOT EXISTS idx_comment_reports_comment_id ON comment_reports(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_reporter_id ON comment_reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_comment_reports_status ON comment_reports(status);
CREATE INDEX IF NOT EXISTS idx_comment_reports_created_at ON comment_reports(created_at);

-- Create moderation_log table if it doesn't exist
CREATE TABLE IF NOT EXISTS moderation_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_id UUID NOT NULL,
    content_type VARCHAR(20) NOT NULL CHECK (content_type IN ('post', 'comment', 'user')),
    action VARCHAR(50) NOT NULL,
    reason TEXT,
    admin_id UUID REFERENCES users(id),
    automated BOOLEAN DEFAULT false,
    report_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for moderation_log performance
CREATE INDEX IF NOT EXISTS idx_moderation_log_content ON moderation_log(content_id, content_type);
CREATE INDEX IF NOT EXISTS idx_moderation_log_created_at ON moderation_log(created_at);
CREATE INDEX IF NOT EXISTS idx_moderation_log_automated ON moderation_log(automated);

-- Add comments for documentation
COMMENT ON TABLE post_reports IS 'User reports on feed posts for content moderation';
COMMENT ON TABLE comment_reports IS 'User reports on post comments for content moderation';
COMMENT ON TABLE moderation_log IS 'Audit log for all moderation actions, both automated and manual';
