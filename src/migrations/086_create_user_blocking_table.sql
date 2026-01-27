-- Migration: Create user_blocks table
-- Description: Creates user blocking functionality for iOS Guideline 1.2 compliance
-- Author: AI Assistant
-- Date: 2025-01-27

-- Create enum for block reasons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_block_reason') THEN
        CREATE TYPE user_block_reason AS ENUM (
            'spam',
            'harassment',
            'inappropriate_content',
            'fake_account',
            'other'
        );
    END IF;
END $$;

-- Create user_blocks table
CREATE TABLE IF NOT EXISTS public.user_blocks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason user_block_reason DEFAULT 'other',
    description TEXT, -- Optional detailed description from blocker
    created_at TIMESTAMPTZ DEFAULT NOW(),

    -- Prevent self-blocking and duplicate blocks
    CONSTRAINT no_self_block CHECK (blocker_id != blocked_user_id),
    UNIQUE(blocker_id, blocked_user_id)
);

-- Create admin_block_notifications table for notifying admins about blocks
CREATE TABLE IF NOT EXISTS public.admin_block_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    block_id UUID NOT NULL REFERENCES public.user_blocks(id) ON DELETE CASCADE,
    blocker_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    blocked_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reason user_block_reason,
    description TEXT,
    is_reviewed BOOLEAN DEFAULT FALSE,
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocker_id ON public.user_blocks(blocker_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked_user_id ON public.user_blocks(blocked_user_id);
CREATE INDEX IF NOT EXISTS idx_user_blocks_created_at ON public.user_blocks(created_at);

CREATE INDEX IF NOT EXISTS idx_admin_block_notifications_is_reviewed ON public.admin_block_notifications(is_reviewed);
CREATE INDEX IF NOT EXISTS idx_admin_block_notifications_created_at ON public.admin_block_notifications(created_at);

-- Function to automatically create admin notification when a user is blocked
CREATE OR REPLACE FUNCTION notify_admin_on_user_block()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.admin_block_notifications (
        block_id,
        blocker_id,
        blocked_user_id,
        reason,
        description
    ) VALUES (
        NEW.id,
        NEW.blocker_id,
        NEW.blocked_user_id,
        NEW.reason,
        NEW.description
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to notify admins on block
DROP TRIGGER IF EXISTS trigger_notify_admin_on_user_block ON public.user_blocks;
CREATE TRIGGER trigger_notify_admin_on_user_block
    AFTER INSERT ON public.user_blocks
    FOR EACH ROW
    EXECUTE FUNCTION notify_admin_on_user_block();

-- Function to check if a user is blocked by another user
CREATE OR REPLACE FUNCTION is_user_blocked(
    p_user_id UUID,
    p_target_user_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_blocks
        WHERE blocker_id = p_user_id
        AND blocked_user_id = p_target_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to get all blocked user IDs for a user
CREATE OR REPLACE FUNCTION get_blocked_user_ids(p_user_id UUID)
RETURNS TABLE(blocked_user_id UUID) AS $$
BEGIN
    RETURN QUERY
    SELECT ub.blocked_user_id
    FROM public.user_blocks ub
    WHERE ub.blocker_id = p_user_id;
END;
$$ LANGUAGE plpgsql STABLE;

-- Enable RLS
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_block_notifications ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_blocks
-- Users can view their own blocks
DROP POLICY IF EXISTS "Users can view their own blocks" ON public.user_blocks;
CREATE POLICY "Users can view their own blocks"
    ON public.user_blocks FOR SELECT
    USING (auth.uid() = blocker_id);

-- Users can create their own blocks
DROP POLICY IF EXISTS "Users can create their own blocks" ON public.user_blocks;
CREATE POLICY "Users can create their own blocks"
    ON public.user_blocks FOR INSERT
    WITH CHECK (auth.uid() = blocker_id);

-- Users can delete their own blocks
DROP POLICY IF EXISTS "Users can delete their own blocks" ON public.user_blocks;
CREATE POLICY "Users can delete their own blocks"
    ON public.user_blocks FOR DELETE
    USING (auth.uid() = blocker_id);

-- RLS Policies for admin_block_notifications (admin only)
DROP POLICY IF EXISTS "Admins can view block notifications" ON public.admin_block_notifications;
CREATE POLICY "Admins can view block notifications"
    ON public.admin_block_notifications FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'super_admin')
        )
    );

DROP POLICY IF EXISTS "Admins can update block notifications" ON public.admin_block_notifications;
CREATE POLICY "Admins can update block notifications"
    ON public.admin_block_notifications FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.role IN ('admin', 'super_admin')
        )
    );

-- Add comments for documentation
COMMENT ON TABLE public.user_blocks IS 'Stores user blocking relationships for iOS Guideline 1.2 compliance';
COMMENT ON TABLE public.admin_block_notifications IS 'Notifies admins when users block each other';
COMMENT ON COLUMN public.user_blocks.blocker_id IS 'User who initiated the block';
COMMENT ON COLUMN public.user_blocks.blocked_user_id IS 'User who is blocked';
COMMENT ON COLUMN public.user_blocks.reason IS 'Reason for blocking';
COMMENT ON FUNCTION is_user_blocked IS 'Check if a user has blocked another user';
COMMENT ON FUNCTION get_blocked_user_ids IS 'Get all user IDs blocked by a specific user';
