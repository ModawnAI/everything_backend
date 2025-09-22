-- Create error reports table for graceful error handling and user feedback
-- This migration creates tables to track errors and provide user-friendly feedback

-- Create error reports table
CREATE TABLE IF NOT EXISTS public.error_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    
    -- Error identification
    error_code VARCHAR(100) NOT NULL,
    error_message TEXT NOT NULL,
    user_message TEXT NOT NULL,
    technical_message TEXT NOT NULL,
    
    -- Error classification
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    category VARCHAR(50) NOT NULL, -- 'booking', 'payment', 'system', 'network', 'validation', 'conflict'
    
    -- Operation context
    operation_type VARCHAR(100) NOT NULL,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    
    -- Request context
    request_id VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    
    -- Error handling information
    retryable BOOLEAN DEFAULT FALSE,
    fallback_available BOOLEAN DEFAULT FALSE,
    suggested_actions TEXT[], -- Array of suggested actions for users
    support_contact VARCHAR(100), -- Contact information for support
    estimated_resolution_time VARCHAR(100), -- Estimated time for resolution
    
    -- Resolution tracking
    resolved BOOLEAN DEFAULT FALSE,
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(100), -- 'system', 'user', 'admin'
    resolution_notes TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create unique constraint on error_code for conflict resolution
CREATE UNIQUE INDEX IF NOT EXISTS idx_error_reports_error_code_unique ON public.error_reports(error_code);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_error_reports_severity ON public.error_reports(severity);
CREATE INDEX IF NOT EXISTS idx_error_reports_category ON public.error_reports(category);
CREATE INDEX IF NOT EXISTS idx_error_reports_operation_type ON public.error_reports(operation_type);
CREATE INDEX IF NOT EXISTS idx_error_reports_user_created ON public.error_reports(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_shop_created ON public.error_reports(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_reservation_created ON public.error_reports(reservation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_payment_created ON public.error_reports(payment_id, created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_resolved ON public.error_reports(resolved);
CREATE INDEX IF NOT EXISTS idx_error_reports_created_at ON public.error_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_error_reports_retryable ON public.error_reports(retryable);
CREATE INDEX IF NOT EXISTS idx_error_reports_fallback_available ON public.error_reports(fallback_available);

-- Add trigger for updated_at
CREATE TRIGGER update_error_reports_updated_at 
    BEFORE UPDATE ON public.error_reports
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to get error statistics
CREATE OR REPLACE FUNCTION get_error_statistics(
    p_hours_back INTEGER DEFAULT 24,
    p_shop_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_category VARCHAR(50) DEFAULT NULL,
    p_severity VARCHAR(20) DEFAULT NULL
)
RETURNS TABLE (
    total_errors BIGINT,
    resolved_errors BIGINT,
    unresolved_errors BIGINT,
    errors_by_category JSONB,
    errors_by_severity JSONB,
    errors_by_operation JSONB,
    top_error_codes JSONB,
    retry_success_rate NUMERIC,
    fallback_success_rate NUMERIC,
    avg_resolution_time_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH error_data AS (
        SELECT 
            er.*,
            EXTRACT(EPOCH FROM (er.resolved_at - er.created_at)) * 1000 as resolution_time_ms
        FROM public.error_reports er
        WHERE er.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
            AND (p_shop_id IS NULL OR er.shop_id = p_shop_id)
            AND (p_user_id IS NULL OR er.user_id = p_user_id)
            AND (p_category IS NULL OR er.category = p_category)
            AND (p_severity IS NULL OR er.severity = p_severity)
    ),
    category_stats AS (
        SELECT jsonb_object_agg(category, category_count) as category_counts
        FROM (
            SELECT category, COUNT(*) as category_count
            FROM error_data
            GROUP BY category
        ) c
    ),
    severity_stats AS (
        SELECT jsonb_object_agg(severity, severity_count) as severity_counts
        FROM (
            SELECT severity, COUNT(*) as severity_count
            FROM error_data
            GROUP BY severity
        ) s
    ),
    operation_stats AS (
        SELECT jsonb_object_agg(operation_type, operation_count) as operation_counts
        FROM (
            SELECT operation_type, COUNT(*) as operation_count
            FROM error_data
            GROUP BY operation_type
        ) o
    ),
    error_code_stats AS (
        SELECT jsonb_object_agg(error_code, error_code_count) as error_code_counts
        FROM (
            SELECT error_code, COUNT(*) as error_code_count
            FROM error_data
            GROUP BY error_code
            ORDER BY error_code_count DESC
            LIMIT 10
        ) ec
    )
    SELECT 
        COUNT(*) as total_errors,
        COUNT(*) FILTER (WHERE resolved = TRUE) as resolved_errors,
        COUNT(*) FILTER (WHERE resolved = FALSE) as unresolved_errors,
        COALESCE(cs.category_counts, '{}'::jsonb) as errors_by_category,
        COALESCE(ss.severity_counts, '{}'::jsonb) as errors_by_severity,
        COALESCE(os.operation_counts, '{}'::jsonb) as errors_by_operation,
        COALESCE(ecs.error_code_counts, '{}'::jsonb) as top_error_codes,
        ROUND(
            COUNT(*) FILTER (WHERE retryable = TRUE AND resolved = TRUE) * 100.0 / 
            NULLIF(COUNT(*) FILTER (WHERE retryable = TRUE), 0), 
            2
        ) as retry_success_rate,
        ROUND(
            COUNT(*) FILTER (WHERE fallback_available = TRUE AND resolved = TRUE) * 100.0 / 
            NULLIF(COUNT(*) FILTER (WHERE fallback_available = TRUE), 0), 
            2
        ) as fallback_success_rate,
        ROUND(AVG(resolution_time_ms), 2) as avg_resolution_time_ms
    FROM error_data ed
    CROSS JOIN category_stats cs
    CROSS JOIN severity_stats ss
    CROSS JOIN operation_stats os
    CROSS JOIN error_code_stats ecs;
END;
$$;

-- Create function to cleanup old error reports
CREATE OR REPLACE FUNCTION cleanup_error_reports(
    p_days_to_keep INTEGER DEFAULT 90
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete old error reports
    DELETE FROM public.error_reports
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep
        AND resolved = TRUE;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

-- Create function to get user-friendly error suggestions
CREATE OR REPLACE FUNCTION get_error_suggestions(
    p_error_code VARCHAR(100)
)
RETURNS TABLE (
    error_code VARCHAR(100),
    user_message TEXT,
    suggested_actions TEXT[],
    support_contact VARCHAR(100),
    estimated_resolution_time VARCHAR(100),
    retryable BOOLEAN,
    fallback_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT
        er.error_code,
        er.user_message,
        er.suggested_actions,
        er.support_contact,
        er.estimated_resolution_time,
        er.retryable,
        er.fallback_available
    FROM public.error_reports er
    WHERE er.error_code = p_error_code
    ORDER BY er.created_at DESC
    LIMIT 1;
END;
$$;

-- Create function to mark error as resolved
CREATE OR REPLACE FUNCTION mark_error_resolved(
    p_error_report_id UUID,
    p_resolved_by VARCHAR(100) DEFAULT 'system',
    p_resolution_notes TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_updated_count INTEGER;
BEGIN
    UPDATE public.error_reports
    SET 
        resolved = TRUE,
        resolved_at = NOW(),
        resolved_by = p_resolved_by,
        resolution_notes = p_resolution_notes,
        updated_at = NOW()
    WHERE id = p_error_report_id;
    
    GET DIAGNOSTICS v_updated_count = ROW_COUNT;
    
    RETURN v_updated_count > 0;
END;
$$;

-- Insert some default error mappings for common scenarios
INSERT INTO public.error_reports (
    error_code, error_message, user_message, technical_message,
    severity, category, operation_type, retryable, fallback_available,
    suggested_actions, support_contact, estimated_resolution_time
) VALUES 
(
    'SLOT_CONFLICT',
    'Slot conflict detected',
    '선택하신 시간에 다른 예약이 있습니다. 다른 시간을 선택해주세요.',
    'Reservation slot conflict detected',
    'medium',
    'booking',
    'reservation_creation',
    FALSE,
    TRUE,
    ARRAY['다른 시간대를 선택해보세요', '예약 가능한 시간을 다시 확인해보세요', '고객센터에 문의하세요'],
    'customer-service',
    '즉시'
),
(
    'VERSION_CONFLICT',
    'Optimistic locking version conflict',
    '예약 정보가 업데이트되었습니다. 다시 시도해주세요.',
    'Optimistic locking version conflict',
    'low',
    'conflict',
    'reservation_update',
    TRUE,
    FALSE,
    ARRAY['페이지를 새로고침하고 다시 시도해주세요', '예약 정보를 다시 확인해주세요'],
    NULL,
    '1분 이내'
),
(
    'PAYMENT_FAILED',
    'Payment processing failed',
    '결제 처리에 실패했습니다. 결제 정보를 확인하고 다시 시도해주세요.',
    'Payment processing failed',
    'high',
    'payment',
    'payment_processing',
    TRUE,
    TRUE,
    ARRAY['결제 정보를 확인해주세요', '다른 결제 수단을 사용해보세요', '고객센터에 문의하세요'],
    'customer-service',
    '즉시'
)
ON CONFLICT (error_code) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.error_reports IS 'Tracks all errors with user-friendly messages and resolution tracking';
COMMENT ON FUNCTION get_error_statistics IS 'Get comprehensive error statistics and analytics';
COMMENT ON FUNCTION cleanup_error_reports IS 'Cleanup old resolved error reports';
COMMENT ON FUNCTION get_error_suggestions IS 'Get user-friendly error suggestions by error code';
COMMENT ON FUNCTION mark_error_resolved IS 'Mark an error report as resolved';
