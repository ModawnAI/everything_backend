-- Migration: Add user_role_update to admin_action_type enum
-- Description: Adds support for logging user role changes in admin actions
-- Date: 2024-01-01

-- Add new value to admin_action_type enum
ALTER TYPE admin_action_type ADD VALUE 'user_role_update';

-- Optional: Create user_role_history table for detailed role change tracking
-- This table provides more detailed tracking than the general admin_actions table
CREATE TABLE IF NOT EXISTS public.user_role_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    previous_role user_role NOT NULL,
    new_role user_role NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for efficient queries
CREATE INDEX IF NOT EXISTS idx_user_role_history_user_id ON public.user_role_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_role_history_changed_by ON public.user_role_history(changed_by);
CREATE INDEX IF NOT EXISTS idx_user_role_history_created_at ON public.user_role_history(created_at);

-- Add RLS policies for user_role_history table
ALTER TABLE public.user_role_history ENABLE ROW LEVEL SECURITY;

-- Only admins can view role history
CREATE POLICY "Admins can view all role history" ON public.user_role_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Only admins can insert role history (handled by service layer)
CREATE POLICY "Admins can insert role history" ON public.user_role_history
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- Add comment for documentation
COMMENT ON TABLE public.user_role_history IS 'Tracks all user role changes for audit purposes';
COMMENT ON COLUMN public.user_role_history.user_id IS 'User whose role was changed';
COMMENT ON COLUMN public.user_role_history.previous_role IS 'Role before the change';
COMMENT ON COLUMN public.user_role_history.new_role IS 'Role after the change';
COMMENT ON COLUMN public.user_role_history.changed_by IS 'Admin who made the change';
COMMENT ON COLUMN public.user_role_history.reason IS 'Reason for the role change';
COMMENT ON COLUMN public.user_role_history.admin_notes IS 'Additional notes from admin';
