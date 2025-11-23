-- Migration: Create notification_history table for FCM push notification delivery tracking
-- Description: Tracks push notification delivery status, success/failure, and timing

-- Create notification_history table
CREATE TABLE IF NOT EXISTS public.notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL CHECK (status IN ('sent', 'failed', 'pending')),
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for query performance
CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON public.notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON public.notification_history(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON public.notification_history(sent_at DESC) WHERE sent_at IS NOT NULL;

-- Add RLS policies
ALTER TABLE public.notification_history ENABLE ROW LEVEL SECURITY;

-- Users can view their own notification history
CREATE POLICY "Users can view their own notification history"
ON public.notification_history
FOR SELECT
USING (auth.uid() = user_id);

-- Service role can do anything
CREATE POLICY "Service role can manage notification history"
ON public.notification_history
FOR ALL
USING (auth.role() = 'service_role');

-- Add comment
COMMENT ON TABLE public.notification_history IS 'Tracks push notification delivery history for FCM push notifications';
COMMENT ON COLUMN public.notification_history.status IS 'Delivery status: sent, failed, pending';
COMMENT ON COLUMN public.notification_history.data IS 'Additional data payload sent with notification';
COMMENT ON COLUMN public.notification_history.error_message IS 'Error message if delivery failed';
