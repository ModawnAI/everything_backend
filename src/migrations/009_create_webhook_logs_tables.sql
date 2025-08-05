-- Migration: Create webhook logs tables for TossPayments webhook handling
-- Description: Tables for webhook idempotency and failure tracking

-- Create webhook_logs table for idempotency
CREATE TABLE IF NOT EXISTS public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_key TEXT NOT NULL,
    status TEXT NOT NULL,
    webhook_id TEXT NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create webhook_failures table for failure tracking
CREATE TABLE IF NOT EXISTS public.webhook_failures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    payment_key TEXT NOT NULL,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    failed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    retried_at TIMESTAMP WITH TIME ZONE,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution_notes TEXT
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_payment_key_status 
ON public.webhook_logs(payment_key, status);

CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed 
ON public.webhook_logs(processed);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_payment_key 
ON public.webhook_failures(payment_key);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_resolved 
ON public.webhook_failures(resolved);

CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry_count 
ON public.webhook_failures(retry_count);

-- Create unique constraint for idempotency
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_unique 
ON public.webhook_logs(payment_key, status, webhook_id);

-- Add RLS policies
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;

-- Webhook logs policies (admin only access)
CREATE POLICY "Admin can view webhook logs" ON public.webhook_logs
    FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Admin can insert webhook logs" ON public.webhook_logs
    FOR INSERT WITH CHECK (auth.role() = 'admin');

CREATE POLICY "Admin can update webhook logs" ON public.webhook_logs
    FOR UPDATE USING (auth.role() = 'admin');

-- Webhook failures policies (admin only access)
CREATE POLICY "Admin can view webhook failures" ON public.webhook_failures
    FOR SELECT USING (auth.role() = 'admin');

CREATE POLICY "Admin can insert webhook failures" ON public.webhook_failures
    FOR INSERT WITH CHECK (auth.role() = 'admin');

CREATE POLICY "Admin can update webhook failures" ON public.webhook_failures
    FOR UPDATE USING (auth.role() = 'admin');

-- Create function to clean up old webhook logs
CREATE OR REPLACE FUNCTION cleanup_old_webhook_logs()
RETURNS void AS $$
BEGIN
    -- Delete webhook logs older than 30 days
    DELETE FROM public.webhook_logs 
    WHERE created_at < NOW() - INTERVAL '30 days';
    
    -- Delete resolved webhook failures older than 90 days
    DELETE FROM public.webhook_failures 
    WHERE resolved = true AND resolved_at < NOW() - INTERVAL '90 days';
    
    -- Delete unresolved failures older than 7 days (likely abandoned)
    DELETE FROM public.webhook_failures 
    WHERE resolved = false AND failed_at < NOW() - INTERVAL '7 days';
END;
$$ LANGUAGE plpgsql;

-- Create function to retry failed webhooks
CREATE OR REPLACE FUNCTION retry_failed_webhook(failure_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    failure_record RECORD;
    success BOOLEAN := false;
BEGIN
    -- Get failure record
    SELECT * INTO failure_record 
    FROM public.webhook_failures 
    WHERE id = failure_id AND resolved = false;
    
    IF NOT FOUND THEN
        RETURN false;
    END IF;
    
    -- Update retry count
    UPDATE public.webhook_failures 
    SET retry_count = retry_count + 1,
        retried_at = NOW()
    WHERE id = failure_id;
    
    -- Note: Actual webhook retry logic would be implemented in the application
    -- This function just marks the failure for retry
    
    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE public.webhook_logs IS 'Tracks processed webhooks for idempotency';
COMMENT ON TABLE public.webhook_failures IS 'Tracks failed webhooks for analysis and retry';
COMMENT ON FUNCTION cleanup_old_webhook_logs() IS 'Cleans up old webhook logs and failures';
COMMENT ON FUNCTION retry_failed_webhook(UUID) IS 'Marks a failed webhook for retry'; 