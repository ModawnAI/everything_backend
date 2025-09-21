-- Migration: 034_create_shop_reports_table.sql
-- Description: Create table for managing shop reports and content moderation
-- Author: Task Master AI - Phase 3 Shop System
-- Created: 2025-01-20
-- Task: #12.1 - Create Shop Report Database Schema and Migration

-- Create an ENUM type for report reasons
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_reason') THEN
        CREATE TYPE public.report_reason AS ENUM (
            'inappropriate_content',
            'spam',
            'fake_shop',
            'harassment',
            'illegal_services',
            'misleading_information',
            'copyright_violation',
            'other'
        );
    END IF;
END
$$;

-- Create an ENUM type for report status
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
        CREATE TYPE public.report_status AS ENUM (
            'pending',
            'under_review',
            'resolved',
            'dismissed',
            'escalated'
        );
    END IF;
END
$$;

-- Create the shop_reports table
CREATE TABLE public.shop_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
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
    
    -- Ensure a user can only report the same shop once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, shop_id) DEFERRABLE INITIALLY DEFERRED
);

-- Add comments for documentation
COMMENT ON TABLE public.shop_reports IS 'Stores user reports about shops for content moderation.';
COMMENT ON COLUMN public.shop_reports.id IS 'Unique identifier for the report.';
COMMENT ON COLUMN public.shop_reports.reporter_id IS 'Foreign key to the users table - who reported the shop.';
COMMENT ON COLUMN public.shop_reports.shop_id IS 'Foreign key to the shops table - which shop was reported.';
COMMENT ON COLUMN public.shop_reports.reason IS 'Category of the report (inappropriate_content, spam, etc.).';
COMMENT ON COLUMN public.shop_reports.description IS 'Optional detailed description provided by the reporter.';
COMMENT ON COLUMN public.shop_reports.status IS 'Current status of the report (pending, under_review, resolved, etc.).';
COMMENT ON COLUMN public.shop_reports.reviewed_by IS 'Foreign key to users table - admin who reviewed the report.';
COMMENT ON COLUMN public.shop_reports.reviewed_at IS 'Timestamp when the report was reviewed.';
COMMENT ON COLUMN public.shop_reports.resolution_notes IS 'Notes from the moderator/admin about the resolution.';
COMMENT ON COLUMN public.shop_reports.priority IS 'Priority level of the report (1=low, 2=medium, 3=high, 4=urgent).';
COMMENT ON COLUMN public.shop_reports.is_escalated IS 'Flag indicating if the report has been escalated.';
COMMENT ON COLUMN public.shop_reports.escalation_reason IS 'Reason for escalating the report.';
COMMENT ON COLUMN public.shop_reports.created_at IS 'Timestamp when the report was created.';
COMMENT ON COLUMN public.shop_reports.updated_at IS 'Timestamp when the report was last updated.';

-- Create indexes for efficient querying
CREATE INDEX idx_shop_reports_shop_id ON public.shop_reports(shop_id);
CREATE INDEX idx_shop_reports_reporter_id ON public.shop_reports(reporter_id);
CREATE INDEX idx_shop_reports_status ON public.shop_reports(status);
CREATE INDEX idx_shop_reports_reviewed_by ON public.shop_reports(reviewed_by);
CREATE INDEX idx_shop_reports_created_at ON public.shop_reports(created_at DESC);
CREATE INDEX idx_shop_reports_priority_status ON public.shop_reports(priority DESC, status, created_at DESC);
CREATE INDEX idx_shop_reports_escalated ON public.shop_reports(is_escalated) WHERE is_escalated = TRUE;

-- Composite index for efficient moderation queries
CREATE INDEX idx_shop_reports_moderation_queue ON public.shop_reports(status, priority DESC, created_at ASC) 
    WHERE status IN ('pending', 'under_review');

-- Add RLS policies for shop_reports
ALTER TABLE public.shop_reports ENABLE ROW LEVEL SECURITY;

-- Policy for authenticated users to create reports
CREATE POLICY "Authenticated users can create shop reports"
ON public.shop_reports FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = reporter_id);

-- Policy for users to view their own reports
CREATE POLICY "Users can view their own reports"
ON public.shop_reports FOR SELECT
TO authenticated
USING (auth.uid() = reporter_id);

-- Policy for shop owners to view reports about their shops (read-only)
CREATE POLICY "Shop owners can view reports about their shops"
ON public.shop_reports FOR SELECT
TO authenticated
USING (EXISTS (
    SELECT 1 FROM public.shops 
    WHERE shops.id = shop_reports.shop_id 
    AND shops.owner_id = auth.uid()
));

-- Policy for admins to manage all reports
CREATE POLICY "Admins can manage all shop reports"
ON public.shop_reports FOR ALL
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.users 
        WHERE users.id = auth.uid() 
        AND users.role = 'admin'
    )
);

-- Create a function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_shop_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at
CREATE TRIGGER trigger_update_shop_reports_updated_at
    BEFORE UPDATE ON public.shop_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_shop_reports_updated_at();

-- Create a function to prevent duplicate reports from the same user for the same shop
-- (unless the previous report is resolved or dismissed)
CREATE OR REPLACE FUNCTION check_duplicate_shop_report()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if there's already a pending or under_review report from the same user for the same shop
    IF EXISTS (
        SELECT 1 FROM public.shop_reports 
        WHERE reporter_id = NEW.reporter_id 
        AND shop_id = NEW.shop_id 
        AND status IN ('pending', 'under_review')
        AND id != COALESCE(NEW.id, gen_random_uuid()) -- Exclude current record if updating
    ) THEN
        RAISE EXCEPTION 'A pending or under review report already exists for this shop from this user';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to prevent duplicate reports
CREATE TRIGGER trigger_check_duplicate_shop_report
    BEFORE INSERT OR UPDATE ON public.shop_reports
    FOR EACH ROW
    EXECUTE FUNCTION check_duplicate_shop_report();

-- Create a function to log report status changes for audit trail
CREATE OR REPLACE FUNCTION log_shop_report_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Only log if status actually changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.audit_log (
            table_name,
            record_id,
            action,
            old_values,
            new_values,
            user_id,
            created_at
        ) VALUES (
            'shop_reports',
            NEW.id,
            'status_change',
            json_build_object('status', OLD.status),
            json_build_object('status', NEW.status),
            auth.uid(),
            NOW()
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for audit logging (if audit_log table exists)
-- Note: This will only work if the audit_log table exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'audit_log') THEN
        CREATE TRIGGER trigger_log_shop_report_status_change
            AFTER UPDATE ON public.shop_reports
            FOR EACH ROW
            EXECUTE FUNCTION log_shop_report_status_change();
    END IF;
END
$$;
