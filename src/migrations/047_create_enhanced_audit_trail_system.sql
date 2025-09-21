-- Create enhanced audit trail system for comprehensive state machine tracking
-- This migration adds advanced audit capabilities and reporting functions

-- =============================================
-- ENHANCED AUDIT TRAIL TABLES
-- =============================================

-- Create detailed state transition audit table (extends reservation_status_logs)
CREATE TABLE IF NOT EXISTS public.reservation_state_audit (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    transition_id UUID REFERENCES public.reservation_status_logs(id) ON DELETE CASCADE,
    from_status reservation_status NOT NULL,
    to_status reservation_status NOT NULL,
    changed_by TEXT NOT NULL CHECK (changed_by IN ('user', 'shop', 'system', 'admin')),
    changed_by_id UUID NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    business_context JSONB DEFAULT '{}', -- Additional business context
    system_context JSONB DEFAULT '{}', -- System-level context (IP, user agent, etc.)
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create state machine performance metrics table
CREATE TABLE IF NOT EXISTS public.reservation_state_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_date DATE NOT NULL,
    metric_type TEXT NOT NULL CHECK (metric_type IN ('transition_count', 'avg_processing_time', 'error_rate', 'auto_completion_rate')),
    status_from reservation_status,
    status_to reservation_status,
    metric_value NUMERIC NOT NULL,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(metric_date, metric_type, status_from, status_to)
);

-- =============================================
-- AUDIT TRAIL FUNCTIONS
-- =============================================

-- Function to create enhanced audit trail entry
CREATE OR REPLACE FUNCTION create_enhanced_audit_entry(
    p_reservation_id UUID,
    p_transition_id UUID,
    p_from_status reservation_status,
    p_to_status reservation_status,
    p_changed_by TEXT,
    p_changed_by_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_business_context JSONB DEFAULT '{}',
    p_system_context JSONB DEFAULT '{}'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_audit_id UUID;
BEGIN
    INSERT INTO public.reservation_state_audit (
        reservation_id,
        transition_id,
        from_status,
        to_status,
        changed_by,
        changed_by_id,
        reason,
        metadata,
        business_context,
        system_context
    ) VALUES (
        p_reservation_id,
        p_transition_id,
        p_from_status,
        p_to_status,
        p_changed_by,
        p_changed_by_id,
        p_reason,
        p_metadata,
        p_business_context,
        p_system_context
    ) RETURNING id INTO v_audit_id;
    
    RETURN v_audit_id;
END;
$$;

-- Enhanced state transition function with comprehensive audit trail
CREATE OR REPLACE FUNCTION transition_reservation_status_enhanced(
    p_reservation_id UUID,
    p_to_status reservation_status,
    p_changed_by TEXT,
    p_changed_by_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}',
    p_business_context JSONB DEFAULT '{}',
    p_system_context JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_from_status reservation_status;
    v_updated_reservation RECORD;
    v_log_id UUID;
    v_audit_id UUID;
    v_start_time TIMESTAMPTZ := clock_timestamp();
    v_end_time TIMESTAMPTZ;
    v_processing_time INTERVAL;
    v_result JSONB;
BEGIN
    -- Get current reservation status
    SELECT status INTO v_from_status
    FROM public.reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;
    
    -- Validate the transition
    PERFORM validate_reservation_state_transition(
        p_reservation_id, 
        v_from_status, 
        p_to_status, 
        p_changed_by, 
        p_changed_by_id, 
        p_reason
    );
    
    -- Begin transaction block (atomic operation)
    BEGIN
        -- Update reservation status
        UPDATE public.reservations 
        SET 
            status = p_to_status,
            updated_at = NOW()
        WHERE id = p_reservation_id
        RETURNING * INTO v_updated_reservation;
        
        -- Create standard audit log entry
        INSERT INTO public.reservation_status_logs (
            reservation_id,
            from_status,
            to_status,
            changed_by,
            changed_by_id,
            reason,
            metadata,
            timestamp
        ) VALUES (
            p_reservation_id,
            v_from_status,
            p_to_status,
            p_changed_by,
            p_changed_by_id,
            p_reason,
            p_metadata,
            NOW()
        ) RETURNING id INTO v_log_id;
        
        -- Create enhanced audit trail entry
        v_audit_id := create_enhanced_audit_entry(
            p_reservation_id,
            v_log_id,
            v_from_status,
            p_to_status,
            p_changed_by,
            p_changed_by_id,
            p_reason,
            p_metadata,
            p_business_context,
            p_system_context
        );
        
        -- Calculate processing time
        v_end_time := clock_timestamp();
        v_processing_time := v_end_time - v_start_time;
        
        -- Prepare result
        v_result := jsonb_build_object(
            'success', TRUE,
            'reservation_id', p_reservation_id,
            'from_status', v_from_status,
            'to_status', p_to_status,
            'log_id', v_log_id,
            'audit_id', v_audit_id,
            'processing_time_ms', EXTRACT(EPOCH FROM v_processing_time) * 1000,
            'updated_at', v_updated_reservation.updated_at,
            'message', 'Enhanced state transition completed successfully'
        );
        
        RETURN v_result;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Log error in audit trail
            INSERT INTO public.reservation_state_audit (
                reservation_id,
                from_status,
                to_status,
                changed_by,
                changed_by_id,
                reason,
                metadata,
                business_context,
                system_context
            ) VALUES (
                p_reservation_id,
                v_from_status,
                p_to_status,
                p_changed_by,
                p_changed_by_id,
                'TRANSITION_FAILED: ' || COALESCE(p_reason, 'Unknown error'),
                p_metadata || jsonb_build_object('error', SQLERRM),
                p_business_context,
                p_system_context || jsonb_build_object('error_context', 'transition_failed')
            );
            
            RAISE EXCEPTION 'Enhanced state transition failed: %', SQLERRM;
    END;
END;
$$;

-- =============================================
-- AUDIT REPORTING FUNCTIONS
-- =============================================

-- Function to get comprehensive audit trail for a reservation
CREATE OR REPLACE FUNCTION get_reservation_audit_trail(
    p_reservation_id UUID
)
RETURNS TABLE (
    audit_id UUID,
    transition_id UUID,
    from_status reservation_status,
    to_status reservation_status,
    changed_by TEXT,
    changed_by_id UUID,
    reason TEXT,
    metadata JSONB,
    business_context JSONB,
    system_context JSONB,
    timestamp TIMESTAMPTZ,
    processing_time_ms NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rsa.id,
        rsa.transition_id,
        rsa.from_status,
        rsa.to_status,
        rsa.changed_by,
        rsa.changed_by_id,
        rsa.reason,
        rsa.metadata,
        rsa.business_context,
        rsa.system_context,
        rsa.timestamp,
        COALESCE((rsa.metadata->>'processing_time_ms')::NUMERIC, 0)
    FROM public.reservation_state_audit rsa
    WHERE rsa.reservation_id = p_reservation_id
    ORDER BY rsa.timestamp ASC;
END;
$$;

-- Function to get state transition statistics
CREATE OR REPLACE FUNCTION get_state_transition_statistics(
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL,
    p_shop_id UUID DEFAULT NULL,
    p_changed_by TEXT DEFAULT NULL
)
RETURNS TABLE (
    from_status reservation_status,
    to_status reservation_status,
    transition_count BIGINT,
    avg_processing_time_ms NUMERIC,
    success_rate NUMERIC,
    error_count BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rsa.from_status,
        rsa.to_status,
        COUNT(*) as transition_count,
        ROUND(AVG(COALESCE((rsa.metadata->>'processing_time_ms')::NUMERIC, 0)), 2) as avg_processing_time_ms,
        ROUND(
            (COUNT(*) FILTER (WHERE rsa.reason NOT LIKE 'TRANSITION_FAILED:%'))::NUMERIC / 
            NULLIF(COUNT(*), 0) * 100, 2
        ) as success_rate,
        COUNT(*) FILTER (WHERE rsa.reason LIKE 'TRANSITION_FAILED:%') as error_count
    FROM public.reservation_state_audit rsa
    JOIN public.reservations r ON rsa.reservation_id = r.id
    WHERE (p_date_from IS NULL OR DATE(rsa.timestamp) >= p_date_from)
      AND (p_date_to IS NULL OR DATE(rsa.timestamp) <= p_date_to)
      AND (p_shop_id IS NULL OR r.shop_id = p_shop_id)
      AND (p_changed_by IS NULL OR rsa.changed_by = p_changed_by)
    GROUP BY rsa.from_status, rsa.to_status
    ORDER BY transition_count DESC;
END;
$$;

-- Function to generate daily metrics
CREATE OR REPLACE FUNCTION generate_daily_state_metrics(
    p_metric_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_metrics JSONB := '{}';
    v_transition_stats RECORD;
    v_result JSONB;
BEGIN
    -- Get transition count metrics
    FOR v_transition_stats IN
        SELECT 
            from_status,
            to_status,
            COUNT(*) as count,
            AVG(COALESCE((metadata->>'processing_time_ms')::NUMERIC, 0)) as avg_time
        FROM public.reservation_state_audit
        WHERE DATE(timestamp) = p_metric_date
        GROUP BY from_status, to_status
    LOOP
        -- Insert transition count metric
        INSERT INTO public.reservation_state_metrics (
            metric_date, metric_type, status_from, status_to, metric_value
        ) VALUES (
            p_metric_date, 'transition_count', 
            v_transition_stats.from_status, v_transition_stats.to_status, 
            v_transition_stats.count
        ) ON CONFLICT (metric_date, metric_type, status_from, status_to) 
        DO UPDATE SET metric_value = EXCLUDED.metric_value;
        
        -- Insert average processing time metric
        INSERT INTO public.reservation_state_metrics (
            metric_date, metric_type, status_from, status_to, metric_value
        ) VALUES (
            p_metric_date, 'avg_processing_time', 
            v_transition_stats.from_status, v_transition_stats.to_status, 
            v_transition_stats.avg_time
        ) ON CONFLICT (metric_date, metric_type, status_from, status_to) 
        DO UPDATE SET metric_value = EXCLUDED.metric_value;
    END LOOP;
    
    -- Calculate error rate
    INSERT INTO public.reservation_state_metrics (
        metric_date, metric_type, metric_value, metadata
    ) VALUES (
        p_metric_date, 'error_rate',
        (
            SELECT ROUND(
                (COUNT(*) FILTER (WHERE reason LIKE 'TRANSITION_FAILED:%'))::NUMERIC / 
                NULLIF(COUNT(*), 0) * 100, 2
            )
            FROM public.reservation_state_audit
            WHERE DATE(timestamp) = p_metric_date
        ),
        jsonb_build_object('total_transitions', (
            SELECT COUNT(*) FROM public.reservation_state_audit
            WHERE DATE(timestamp) = p_metric_date
        ))
    ) ON CONFLICT (metric_date, metric_type, status_from, status_to) 
    DO UPDATE SET metric_value = EXCLUDED.metric_value;
    
    v_result := jsonb_build_object(
        'date', p_metric_date,
        'metrics_generated', TRUE,
        'message', 'Daily state metrics generated successfully'
    );
    
    RETURN v_result;
END;
$$;

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Indexes for audit trail queries
CREATE INDEX IF NOT EXISTS idx_reservation_state_audit_reservation_timestamp 
ON public.reservation_state_audit(reservation_id, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_state_audit_changed_by_timestamp 
ON public.reservation_state_audit(changed_by, timestamp DESC);

CREATE INDEX IF NOT EXISTS idx_reservation_state_audit_status_transition 
ON public.reservation_state_audit(from_status, to_status, timestamp);

CREATE INDEX IF NOT EXISTS idx_reservation_state_audit_date 
ON public.reservation_state_audit(DATE(timestamp));

-- Indexes for metrics table
CREATE INDEX IF NOT EXISTS idx_reservation_state_metrics_date_type 
ON public.reservation_state_metrics(metric_date, metric_type);

CREATE INDEX IF NOT EXISTS idx_reservation_state_metrics_status 
ON public.reservation_state_metrics(status_from, status_to, metric_date);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

-- Enable RLS on new tables
ALTER TABLE public.reservation_state_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_state_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reservation_state_audit
CREATE POLICY "Users can view audit trail for their reservations" ON public.reservation_state_audit
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reservations r
            WHERE r.id = reservation_state_audit.reservation_id
            AND r.user_id = auth.uid()
        )
    );

CREATE POLICY "Shop owners can view audit trail for their shop's reservations" ON public.reservation_state_audit
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.reservations r
            JOIN public.shops s ON r.shop_id = s.id
            WHERE r.id = reservation_state_audit.reservation_id
            AND s.owner_id = auth.uid()
        )
    );

CREATE POLICY "Admins can view all audit trails" ON public.reservation_state_audit
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.user_role = 'admin'
        )
    );

-- RLS Policies for reservation_state_metrics
CREATE POLICY "Admins can view all metrics" ON public.reservation_state_metrics
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users u
            WHERE u.id = auth.uid()
            AND u.user_role = 'admin'
        )
    );

CREATE POLICY "System can insert metrics" ON public.reservation_state_metrics
    FOR INSERT WITH CHECK (TRUE); -- System functions need to insert metrics

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON TABLE public.reservation_state_audit IS 
'Enhanced audit trail for reservation state transitions with comprehensive context tracking.';

COMMENT ON TABLE public.reservation_state_metrics IS 
'Performance and usage metrics for reservation state machine operations.';

COMMENT ON FUNCTION create_enhanced_audit_entry IS 
'Creates detailed audit trail entries with business and system context.';

COMMENT ON FUNCTION transition_reservation_status_enhanced IS 
'Enhanced state transition function with comprehensive audit trail and performance tracking.';

COMMENT ON FUNCTION get_reservation_audit_trail IS 
'Returns complete audit trail for a reservation including performance metrics.';

COMMENT ON FUNCTION get_state_transition_statistics IS 
'Returns statistical analysis of state transitions with success rates and performance metrics.';

COMMENT ON FUNCTION generate_daily_state_metrics IS 
'Generates daily performance and usage metrics for the state machine system.';
