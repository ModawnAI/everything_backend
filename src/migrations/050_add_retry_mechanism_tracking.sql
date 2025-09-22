-- Add retry mechanism tracking tables for monitoring and analytics
-- This migration creates tables to track retry operations and their outcomes

-- Create retry operation tracking table
CREATE TABLE IF NOT EXISTS public.retry_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id VARCHAR(255) NOT NULL UNIQUE, -- Unique operation identifier
    operation_type VARCHAR(50) NOT NULL, -- 'reservation_creation', 'reservation_update', 'payment_processing', 'conflict_resolution'
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL,
    payment_id UUID REFERENCES public.payments(id) ON DELETE SET NULL,
    
    -- Retry configuration
    max_retries INTEGER NOT NULL DEFAULT 3,
    base_delay_ms INTEGER NOT NULL DEFAULT 100,
    max_delay_ms INTEGER NOT NULL DEFAULT 5000,
    exponential_backoff_multiplier DECIMAL(3,2) NOT NULL DEFAULT 2.0,
    jitter_factor DECIMAL(3,2) NOT NULL DEFAULT 0.1,
    timeout_ms INTEGER NOT NULL DEFAULT 30000,
    
    -- Operation status
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'timeout'
    success BOOLEAN,
    total_attempts INTEGER DEFAULT 0,
    total_duration_ms INTEGER,
    
    -- Error tracking
    final_error_message TEXT,
    final_error_type VARCHAR(50), -- 'conflict', 'timeout', 'deadlock', 'version_conflict', 'temporary', 'unknown'
    
    -- Retry details
    retry_reasons TEXT[], -- Array of retry reasons for each attempt
    conflict_detected BOOLEAN DEFAULT FALSE,
    lock_timeout_detected BOOLEAN DEFAULT FALSE,
    deadlock_detected BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_retry_operations_operation_id ON public.retry_operations(operation_id);
CREATE INDEX IF NOT EXISTS idx_retry_operations_status ON public.retry_operations(status);
CREATE INDEX IF NOT EXISTS idx_retry_operations_operation_type ON public.retry_operations(operation_type);
CREATE INDEX IF NOT EXISTS idx_retry_operations_shop_created ON public.retry_operations(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_retry_operations_user_created ON public.retry_operations(user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_retry_operations_started_at ON public.retry_operations(started_at);

-- Create retry attempt details table
CREATE TABLE IF NOT EXISTS public.retry_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id VARCHAR(255) NOT NULL REFERENCES public.retry_operations(operation_id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    
    -- Attempt details
    started_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    duration_ms INTEGER,
    success BOOLEAN NOT NULL,
    
    -- Error details
    error_message TEXT,
    error_type VARCHAR(50),
    retry_reason VARCHAR(50),
    
    -- Retry configuration for this attempt
    delay_before_retry_ms INTEGER,
    timeout_used_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for retry attempts
CREATE INDEX IF NOT EXISTS idx_retry_attempts_operation_id ON public.retry_attempts(operation_id);
CREATE INDEX IF NOT EXISTS idx_retry_attempts_attempt_number ON public.retry_attempts(attempt_number);
CREATE INDEX IF NOT EXISTS idx_retry_attempts_success ON public.retry_attempts(success);
CREATE INDEX IF NOT EXISTS idx_retry_attempts_error_type ON public.retry_attempts(error_type);

-- Add triggers for updated_at
CREATE TRIGGER update_retry_operations_updated_at 
    BEFORE UPDATE ON public.retry_operations
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to start retry operation tracking
CREATE OR REPLACE FUNCTION start_retry_operation_tracking(
    p_operation_id VARCHAR(255),
    p_operation_type VARCHAR(50),
    p_user_id UUID DEFAULT NULL,
    p_shop_id UUID DEFAULT NULL,
    p_reservation_id UUID DEFAULT NULL,
    p_payment_id UUID DEFAULT NULL,
    p_max_retries INTEGER DEFAULT 3,
    p_base_delay_ms INTEGER DEFAULT 100,
    p_max_delay_ms INTEGER DEFAULT 5000,
    p_exponential_backoff_multiplier DECIMAL(3,2) DEFAULT 2.0,
    p_jitter_factor DECIMAL(3,2) DEFAULT 0.1,
    p_timeout_ms INTEGER DEFAULT 30000,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operation_record_id UUID;
BEGIN
    INSERT INTO public.retry_operations (
        operation_id, operation_type, user_id, shop_id, reservation_id, payment_id,
        max_retries, base_delay_ms, max_delay_ms, exponential_backoff_multiplier,
        jitter_factor, timeout_ms, metadata, status
    ) VALUES (
        p_operation_id, p_operation_type, p_user_id, p_shop_id, p_reservation_id, p_payment_id,
        p_max_retries, p_base_delay_ms, p_max_delay_ms, p_exponential_backoff_multiplier,
        p_jitter_factor, p_timeout_ms, p_metadata, 'in_progress'
    ) RETURNING id INTO v_operation_record_id;
    
    RETURN v_operation_record_id;
END;
$$;

-- Create function to record retry attempt
CREATE OR REPLACE FUNCTION record_retry_attempt(
    p_operation_id VARCHAR(255),
    p_attempt_number INTEGER,
    p_success BOOLEAN,
    p_error_message TEXT DEFAULT NULL,
    p_error_type VARCHAR(50) DEFAULT NULL,
    p_retry_reason VARCHAR(50) DEFAULT NULL,
    p_delay_before_retry_ms INTEGER DEFAULT NULL,
    p_timeout_used_ms INTEGER DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_attempt_id UUID;
    v_completed_at TIMESTAMPTZ;
    v_duration_ms INTEGER;
BEGIN
    v_completed_at := NOW();
    
    -- Calculate duration if this is a completion
    IF p_success OR p_error_message IS NOT NULL THEN
        SELECT 
            EXTRACT(EPOCH FROM (v_completed_at - started_at)) * 1000
        INTO v_duration_ms
        FROM public.retry_operations
        WHERE operation_id = p_operation_id;
    END IF;
    
    INSERT INTO public.retry_attempts (
        operation_id, attempt_number, completed_at, duration_ms, success,
        error_message, error_type, retry_reason, delay_before_retry_ms,
        timeout_used_ms, metadata
    ) VALUES (
        p_operation_id, p_attempt_number, v_completed_at, v_duration_ms, p_success,
        p_error_message, p_error_type, p_retry_reason, p_delay_before_retry_ms,
        p_timeout_used_ms, p_metadata
    ) RETURNING id INTO v_attempt_id;
    
    -- Update operation record
    UPDATE public.retry_operations
    SET 
        total_attempts = total_attempts + 1,
        updated_at = NOW()
    WHERE operation_id = p_operation_id;
    
    RETURN v_attempt_id;
END;
$$;

-- Create function to complete retry operation
CREATE OR REPLACE FUNCTION complete_retry_operation(
    p_operation_id VARCHAR(255),
    p_success BOOLEAN,
    p_final_error_message TEXT DEFAULT NULL,
    p_final_error_type VARCHAR(50) DEFAULT NULL,
    p_retry_reasons TEXT[] DEFAULT NULL,
    p_conflict_detected BOOLEAN DEFAULT FALSE,
    p_lock_timeout_detected BOOLEAN DEFAULT FALSE,
    p_deadlock_detected BOOLEAN DEFAULT FALSE,
    p_metadata JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_duration_ms INTEGER;
BEGIN
    -- Calculate total duration
    SELECT 
        EXTRACT(EPOCH FROM (NOW() - started_at)) * 1000
    INTO v_total_duration_ms
    FROM public.retry_operations
    WHERE operation_id = p_operation_id;
    
    UPDATE public.retry_operations
    SET 
        status = CASE 
            WHEN p_success THEN 'completed'
            WHEN p_final_error_message ILIKE '%timeout%' THEN 'timeout'
            ELSE 'failed'
        END,
        success = p_success,
        total_duration_ms = v_total_duration_ms,
        final_error_message = p_final_error_message,
        final_error_type = p_final_error_type,
        retry_reasons = p_retry_reasons,
        conflict_detected = p_conflict_detected,
        lock_timeout_detected = p_lock_timeout_detected,
        deadlock_detected = p_deadlock_detected,
        metadata = COALESCE(metadata, '{}') || p_metadata,
        completed_at = NOW(),
        updated_at = NOW()
    WHERE operation_id = p_operation_id;
END;
$$;

-- Create function to get retry operation statistics
CREATE OR REPLACE FUNCTION get_retry_operation_statistics(
    p_hours_back INTEGER DEFAULT 24,
    p_shop_id UUID DEFAULT NULL,
    p_operation_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    operation_type VARCHAR(50),
    total_operations BIGINT,
    successful_operations BIGINT,
    failed_operations BIGINT,
    timeout_operations BIGINT,
    avg_attempts NUMERIC,
    avg_duration_ms NUMERIC,
    max_duration_ms INTEGER,
    conflict_rate NUMERIC,
    lock_timeout_rate NUMERIC,
    deadlock_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ro.operation_type,
        COUNT(*) as total_operations,
        COUNT(*) FILTER (WHERE ro.success = TRUE) as successful_operations,
        COUNT(*) FILTER (WHERE ro.success = FALSE) as failed_operations,
        COUNT(*) FILTER (WHERE ro.status = 'timeout') as timeout_operations,
        ROUND(AVG(ro.total_attempts), 2) as avg_attempts,
        ROUND(AVG(ro.total_duration_ms), 2) as avg_duration_ms,
        MAX(ro.total_duration_ms) as max_duration_ms,
        ROUND(
            COUNT(*) FILTER (WHERE ro.conflict_detected = TRUE) * 100.0 / COUNT(*), 
            2
        ) as conflict_rate,
        ROUND(
            COUNT(*) FILTER (WHERE ro.lock_timeout_detected = TRUE) * 100.0 / COUNT(*), 
            2
        ) as lock_timeout_rate,
        ROUND(
            COUNT(*) FILTER (WHERE ro.deadlock_detected = TRUE) * 100.0 / COUNT(*), 
            2
        ) as deadlock_rate
    FROM public.retry_operations ro
    WHERE ro.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
        AND (p_shop_id IS NULL OR ro.shop_id = p_shop_id)
        AND (p_operation_type IS NULL OR ro.operation_type = p_operation_type)
    GROUP BY ro.operation_type
    ORDER BY total_operations DESC;
END;
$$;

-- Create function to cleanup old retry operation data
CREATE OR REPLACE FUNCTION cleanup_retry_operation_data(
    p_days_to_keep INTEGER DEFAULT 30
)
RETURNS TABLE (
    deleted_operations INTEGER,
    deleted_attempts INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_operations INTEGER;
    v_deleted_attempts INTEGER;
BEGIN
    -- Delete old retry attempts first (due to foreign key constraint)
    DELETE FROM public.retry_attempts
    WHERE operation_id IN (
        SELECT operation_id 
        FROM public.retry_operations 
        WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep
    );
    
    GET DIAGNOSTICS v_deleted_attempts = ROW_COUNT;
    
    -- Delete old retry operations
    DELETE FROM public.retry_operations
    WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS v_deleted_operations = ROW_COUNT;
    
    RETURN QUERY SELECT v_deleted_operations, v_deleted_attempts;
END;
$$;

-- Add comments for documentation
COMMENT ON TABLE public.retry_operations IS 'Tracks retry operations for monitoring and analytics';
COMMENT ON TABLE public.retry_attempts IS 'Tracks individual retry attempts within operations';
COMMENT ON FUNCTION start_retry_operation_tracking IS 'Start tracking a retry operation';
COMMENT ON FUNCTION record_retry_attempt IS 'Record a single retry attempt';
COMMENT ON FUNCTION complete_retry_operation IS 'Complete retry operation tracking';
COMMENT ON FUNCTION get_retry_operation_statistics IS 'Get retry operation statistics for monitoring';
COMMENT ON FUNCTION cleanup_retry_operation_data IS 'Cleanup old retry operation data';
