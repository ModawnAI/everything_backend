-- Migration: 035_create_moderation_actions_table.sql
-- Description: Create table for tracking moderation actions taken on shop reports
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-20
-- Task: #12.1 - Create Shop Report Database Schema and Migration

-- Create an ENUM type for moderation action types
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'moderation_action_type') THEN
        CREATE TYPE public.moderation_action_type AS ENUM (
            'warning_issued',
            'content_removed',
            'shop_suspended',
            'shop_terminated',
            'report_dismissed',
            'no_action_required',
            'escalated_to_admin',
            'contact_shop_owner',
            'content_edited',
            'other'
        );
    END IF;
END
$$;

-- Create the moderation_actions table
CREATE TABLE public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.shop_reports(id) ON DELETE CASCADE,
    action_type moderation_action_type NOT NULL,
    description TEXT NOT NULL, -- Detailed description of the action taken
    moderator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE, -- Denormalized for easier querying
    action_data JSONB, -- Additional data related to the action (e.g., suspension duration, content changes)
    is_automated BOOLEAN DEFAULT FALSE, -- Whether this action was taken automatically
    automation_rule_id UUID, -- Reference to the rule that triggered automated action
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.moderation_actions IS 'Tracks moderation actions taken in response to shop reports.';
COMMENT ON COLUMN public.moderation_actions.id IS 'Unique identifier for the moderation action.';
COMMENT ON COLUMN public.moderation_actions.report_id IS 'Foreign key to shop_reports table - which report triggered this action.';
COMMENT ON COLUMN public.moderation_actions.action_type IS 'Type of moderation action taken (warning, suspension, etc.).';
COMMENT ON COLUMN public.moderation_actions.description IS 'Detailed description of what action was taken.';
COMMENT ON COLUMN public.moderation_actions.moderator_id IS 'Foreign key to users table - who took the action.';
COMMENT ON COLUMN public.moderation_actions.shop_id IS 'Foreign key to shops table - which shop was affected (denormalized for performance).';
COMMENT ON COLUMN public.moderation_actions.action_data IS 'Additional JSON data related to the action.';
COMMENT ON COLUMN public.moderation_actions.is_automated IS 'Whether this action was taken automatically by the system.';
COMMENT ON COLUMN public.moderation_actions.automation_rule_id IS 'Reference to the automation rule that triggered this action.';
COMMENT ON COLUMN public.moderation_actions.created_at IS 'Timestamp when the action was taken.';
COMMENT ON COLUMN public.moderation_actions.updated_at IS 'Timestamp when the action record was last updated.';

-- Create indexes for efficient querying
CREATE INDEX idx_moderation_actions_report_id ON public.moderation_actions(report_id);
CREATE INDEX idx_moderation_actions_shop_id ON public.moderation_actions(shop_id);
CREATE INDEX idx_moderation_actions_moderator_id ON public.moderation_actions(moderator_id);
CREATE INDEX idx_moderation_actions_action_type ON public.moderation_actions(action_type);
CREATE INDEX idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);
CREATE INDEX idx_moderation_actions_automated ON public.moderation_actions(is_automated);
CREATE INDEX idx_moderation_actions_shop_created ON public.moderation_actions(shop_id, created_at DESC);

-- Composite index for moderation history queries
CREATE INDEX idx_moderation_actions_shop_history ON public.moderation_actions(shop_id, action_type, created_at DESC);

-- Add RLS policies for moderation_actions
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to view actions (read-only for transparency)
CREATE POLICY "Authenticated users can view moderation actions"
ON public.moderation_actions FOR SELECT
TO authenticated
USING (TRUE);

-- Policy for shop owners to view actions taken on their shops
CREATE POLICY "Shop owners can view actions on their shops"
ON public.moderation_actions FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = moderation_actions.shop_id 
    AND shops.owner_id = auth.uid()
));

-- Policy for moderators/admins to create actions
CREATE POLICY "Moderators can create moderation actions"
ON public.moderation_actions FOR INSERT
TO authenticated
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role IN ('admin', 'moderator')
    )
    AND auth.uid() = moderator_id
);

-- Policy for admins to manage all actions
CREATE POLICY "Admins can manage all moderation actions"
ON public.moderation_actions FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_moderation_actions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_moderation_actions_updated_at
    BEFORE UPDATE ON public.moderation_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_moderation_actions_updated_at();

-- Create a function to automatically update shop_reports when actions are taken
CREATE OR REPLACE FUNCTION update_report_status_on_action()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the related report status based on the action type
    UPDATE public.shop_reports 
    SET 
        status = CASE 
            WHEN NEW.action_type IN ('shop_suspended', 'shop_terminated', 'warning_issued', 'content_removed', 'content_edited') THEN 'resolved'
            WHEN NEW.action_type = 'report_dismissed' THEN 'dismissed'
            WHEN NEW.action_type = 'escalated_to_admin' THEN 'escalated'
            ELSE 'resolved'
        END,
        reviewed_by = NEW.moderator_id,
        reviewed_at = NOW(),
        updated_at = NOW()
    WHERE id = NEW.report_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update report status when actions are taken
CREATE TRIGGER trigger_update_report_status_on_action
    AFTER INSERT ON public.moderation_actions
    FOR EACH ROW
    EXECUTE FUNCTION update_report_status_on_action();
