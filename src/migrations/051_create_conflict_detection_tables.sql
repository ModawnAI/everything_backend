-- Create conflict detection and resolution tables
-- This migration creates tables to track and resolve various types of conflicts

-- Create conflict detection log table
CREATE TABLE IF NOT EXISTS public.conflict_detection_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conflict_id VARCHAR(255) NOT NULL UNIQUE, -- Unique conflict identifier
    conflict_type VARCHAR(50) NOT NULL, -- 'slot_overlap', 'capacity_exceeded', 'resource_conflict', 'payment_conflict', 'version_conflict'
    severity VARCHAR(20) NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    
    -- Affected entities
    affected_reservations UUID[] DEFAULT '{}', -- Array of affected reservation IDs
    affected_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL,
    affected_user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    
    -- Conflict details
    conflict_details JSONB DEFAULT '{}', -- Detailed conflict information
    
    -- Detection information
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    detected_by VARCHAR(50) DEFAULT 'system', -- 'system', 'user', 'admin'
    detection_method VARCHAR(50) DEFAULT 'realtime', -- 'realtime', 'batch', 'manual'
    
    -- Resolution information
    status VARCHAR(20) NOT NULL DEFAULT 'detected', -- 'detected', 'resolving', 'resolved', 'failed', 'escalated'
    resolution_strategy VARCHAR(100), -- Strategy used for resolution
    resolution_notes TEXT, -- Notes about resolution
    resolved_at TIMESTAMPTZ,
    resolved_by VARCHAR(50), -- 'system', 'user', 'admin'
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conflict resolution actions table
CREATE TABLE IF NOT EXISTS public.conflict_resolution_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conflict_id VARCHAR(255) NOT NULL REFERENCES public.conflict_detection_log(conflict_id) ON DELETE CASCADE,
    action_type VARCHAR(50) NOT NULL, -- 'retry_operation', 'reschedule_reservation', 'cancel_reservation', 'merge_reservations', 'update_payment'
    action_parameters JSONB DEFAULT '{}',
    priority INTEGER DEFAULT 1,
    
    -- Execution details
    executed_at TIMESTAMPTZ,
    execution_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'executing', 'completed', 'failed', 'skipped'
    execution_result JSONB DEFAULT '{}',
    execution_error TEXT,
    execution_duration_ms INTEGER,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create conflict resolution strategies table
CREATE TABLE IF NOT EXISTS public.conflict_resolution_strategies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    strategy_id VARCHAR(100) NOT NULL UNIQUE,
    strategy_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Strategy configuration
    conflict_types TEXT[] NOT NULL DEFAULT '{}', -- Array of conflict types this strategy handles
    severity_levels TEXT[] DEFAULT '{}', -- Severity levels this strategy handles
    automatic_resolution BOOLEAN DEFAULT FALSE,
    requires_user_approval BOOLEAN DEFAULT TRUE,
    max_auto_attempts INTEGER DEFAULT 3,
    
    -- Strategy actions
    actions JSONB NOT NULL DEFAULT '[]', -- Array of actions to execute
    
    -- Configuration
    is_active BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 100, -- Lower number = higher priority
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_conflict_id ON public.conflict_detection_log(conflict_id);
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_type_severity ON public.conflict_detection_log(conflict_type, severity);
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_status ON public.conflict_detection_log(status);
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_shop_detected ON public.conflict_detection_log(affected_shop_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_user_detected ON public.conflict_detection_log(affected_user_id, detected_at);
CREATE INDEX IF NOT EXISTS idx_conflict_detection_log_detected_at ON public.conflict_detection_log(detected_at);

CREATE INDEX IF NOT EXISTS idx_conflict_resolution_actions_conflict_id ON public.conflict_resolution_actions(conflict_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_actions_status ON public.conflict_resolution_actions(execution_status);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_actions_priority ON public.conflict_resolution_actions(priority);

CREATE INDEX IF NOT EXISTS idx_conflict_resolution_strategies_strategy_id ON public.conflict_resolution_strategies(strategy_id);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_strategies_active ON public.conflict_resolution_strategies(is_active);
CREATE INDEX IF NOT EXISTS idx_conflict_resolution_strategies_priority ON public.conflict_resolution_strategies(priority);

-- Add triggers for updated_at
CREATE TRIGGER update_conflict_detection_log_updated_at 
    BEFORE UPDATE ON public.conflict_detection_log
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conflict_resolution_actions_updated_at 
    BEFORE UPDATE ON public.conflict_resolution_actions
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_conflict_resolution_strategies_updated_at 
    BEFORE UPDATE ON public.conflict_resolution_strategies
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Create function to detect slot overlap conflicts
CREATE OR REPLACE FUNCTION detect_slot_overlap_conflicts(
    p_shop_id UUID,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_duration_minutes INTEGER,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (
    conflicting_reservation_id UUID,
    conflicting_start_time TIME,
    conflicting_duration INTEGER,
    overlap_type VARCHAR(50)
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_operation_start_time TIME;
    v_operation_end_time TIME;
    v_conflict_start_time TIME;
    v_conflict_end_time TIME;
BEGIN
    -- Calculate operation time range
    v_operation_start_time := p_reservation_time;
    v_operation_end_time := p_reservation_time + INTERVAL '1 minute' * p_duration_minutes;
    
    RETURN QUERY
    SELECT 
        r.id,
        r.reservation_time,
        COALESCE(ss.duration_minutes, 60),
        CASE 
            WHEN r.reservation_time < v_operation_start_time AND 
                 (r.reservation_time + INTERVAL '1 minute' * COALESCE(ss.duration_minutes, 60)) > v_operation_start_time THEN 'partial_overlap_start'
            WHEN r.reservation_time >= v_operation_start_time AND 
                 r.reservation_time < v_operation_end_time THEN 'full_overlap'
            WHEN r.reservation_time < v_operation_end_time AND 
                 (r.reservation_time + INTERVAL '1 minute' * COALESCE(ss.duration_minutes, 60)) > v_operation_end_time THEN 'partial_overlap_end'
            ELSE 'unknown'
        END
    FROM public.reservations r
    JOIN public.reservation_services rs ON r.id = rs.reservation_id
    JOIN public.shop_services ss ON rs.service_id = ss.id
    WHERE r.shop_id = p_shop_id
        AND r.reservation_date = p_reservation_date
        AND r.status IN ('requested', 'confirmed')
        AND (p_exclude_reservation_id IS NULL OR r.id != p_exclude_reservation_id)
        AND (
            -- Check for any overlap
            (r.reservation_time < v_operation_end_time AND 
             (r.reservation_time + INTERVAL '1 minute' * COALESCE(ss.duration_minutes, 60)) > v_operation_start_time)
        );
END;
$$;

-- Create function to detect capacity conflicts
CREATE OR REPLACE FUNCTION detect_capacity_conflicts(
    p_shop_id UUID,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_requested_capacity INTEGER,
    p_exclude_reservation_id UUID DEFAULT NULL
)
RETURNS TABLE (
    current_capacity INTEGER,
    max_capacity INTEGER,
    available_capacity INTEGER,
    conflicting_reservations UUID[]
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_max_capacity INTEGER;
    v_current_capacity INTEGER;
    v_available_capacity INTEGER;
    v_conflicting_reservations UUID[];
BEGIN
    -- Get shop max capacity
    SELECT COALESCE(max_concurrent_reservations, 1) INTO v_max_capacity
    FROM public.shops
    WHERE id = p_shop_id;
    
    -- Count current reservations at the same time
    SELECT COUNT(*), ARRAY_AGG(id)
    INTO v_current_capacity, v_conflicting_reservations
    FROM public.reservations
    WHERE shop_id = p_shop_id
        AND reservation_date = p_reservation_date
        AND reservation_time = p_reservation_time
        AND status IN ('requested', 'confirmed')
        AND (p_exclude_reservation_id IS NULL OR id != p_exclude_reservation_id);
    
    v_available_capacity := v_max_capacity - v_current_capacity;
    
    -- Only return conflict if capacity would be exceeded
    IF v_available_capacity < p_requested_capacity THEN
        RETURN QUERY SELECT v_current_capacity, v_max_capacity, v_available_capacity, v_conflicting_reservations;
    END IF;
END;
$$;

-- Create function to get conflict statistics
CREATE OR REPLACE FUNCTION get_conflict_statistics(
    p_hours_back INTEGER DEFAULT 24,
    p_shop_id UUID DEFAULT NULL,
    p_conflict_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
    total_conflicts BIGINT,
    resolved_conflicts BIGINT,
    unresolved_conflicts BIGINT,
    conflicts_by_type JSONB,
    conflicts_by_severity JSONB,
    avg_resolution_time_ms NUMERIC,
    resolution_success_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    WITH conflict_data AS (
        SELECT 
            cdl.*,
            EXTRACT(EPOCH FROM (cdl.resolved_at - cdl.detected_at)) * 1000 as resolution_time_ms
        FROM public.conflict_detection_log cdl
        WHERE cdl.detected_at >= NOW() - INTERVAL '1 hour' * p_hours_back
            AND (p_shop_id IS NULL OR cdl.affected_shop_id = p_shop_id)
            AND (p_conflict_type IS NULL OR cdl.conflict_type = p_conflict_type)
    ),
    type_stats AS (
        SELECT jsonb_object_agg(conflict_type, type_count) as type_counts
        FROM (
            SELECT conflict_type, COUNT(*) as type_count
            FROM conflict_data
            GROUP BY conflict_type
        ) t
    ),
    severity_stats AS (
        SELECT jsonb_object_agg(severity, severity_count) as severity_counts
        FROM (
            SELECT severity, COUNT(*) as severity_count
            FROM conflict_data
            GROUP BY severity
        ) s
    )
    SELECT 
        COUNT(*) as total_conflicts,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_conflicts,
        COUNT(*) FILTER (WHERE status != 'resolved') as unresolved_conflicts,
        COALESCE(ts.type_counts, '{}'::jsonb) as conflicts_by_type,
        COALESCE(ss.severity_counts, '{}'::jsonb) as conflicts_by_severity,
        ROUND(AVG(resolution_time_ms), 2) as avg_resolution_time_ms,
        ROUND(
            COUNT(*) FILTER (WHERE status = 'resolved') * 100.0 / NULLIF(COUNT(*), 0), 
            2
        ) as resolution_success_rate
    FROM conflict_data cd
    CROSS JOIN type_stats ts
    CROSS JOIN severity_stats ss;
END;
$$;

-- Create function to cleanup old conflict data
CREATE OR REPLACE FUNCTION cleanup_conflict_data(
    p_days_to_keep INTEGER DEFAULT 30
)
RETURNS TABLE (
    deleted_conflicts INTEGER,
    deleted_actions INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_deleted_actions INTEGER;
    v_deleted_conflicts INTEGER;
BEGIN
    -- Delete old resolution actions first (due to foreign key constraint)
    DELETE FROM public.conflict_resolution_actions
    WHERE conflict_id IN (
        SELECT conflict_id 
        FROM public.conflict_detection_log 
        WHERE detected_at < NOW() - INTERVAL '1 day' * p_days_to_keep
    );
    
    GET DIAGNOSTICS v_deleted_actions = ROW_COUNT;
    
    -- Delete old conflicts
    DELETE FROM public.conflict_detection_log
    WHERE detected_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
    
    GET DIAGNOSTICS v_deleted_conflicts = ROW_COUNT;
    
    RETURN QUERY SELECT v_deleted_conflicts, v_deleted_actions;
END;
$$;

-- Insert default conflict resolution strategies
INSERT INTO public.conflict_resolution_strategies (
    strategy_id, strategy_name, description, conflict_types, severity_levels,
    automatic_resolution, requires_user_approval, max_auto_attempts, actions, priority
) VALUES 
(
    'auto_retry_version_conflict',
    'Automatic Version Conflict Retry',
    'Automatically retry operations with version conflicts',
    ARRAY['version_conflict'],
    ARRAY['low', 'medium'],
    TRUE,
    FALSE,
    3,
    '[{"action": "retry_operation", "parameters": {"maxRetries": 3, "backoffMs": 100}, "priority": 1}]'::jsonb,
    10
),
(
    'auto_reschedule_overlap',
    'Automatic Slot Overlap Rescheduling',
    'Automatically reschedule overlapping reservations to next available slots',
    ARRAY['slot_overlap'],
    ARRAY['medium', 'high'],
    TRUE,
    FALSE,
    1,
    '[{"action": "reschedule_reservation", "parameters": {"findNextAvailableSlot": true, "notifyCustomer": true}, "priority": 1}]'::jsonb,
    20
),
(
    'manual_capacity_resolution',
    'Manual Capacity Conflict Resolution',
    'Manual resolution required for capacity conflicts',
    ARRAY['capacity_exceeded'],
    ARRAY['high', 'critical'],
    FALSE,
    TRUE,
    0,
    '[{"action": "cancel_reservation", "parameters": {"notifyCustomer": true, "refundDeposit": true}, "priority": 1}, {"action": "reschedule_reservation", "parameters": {"findAlternativeSlot": true, "notifyCustomer": true}, "priority": 2}]'::jsonb,
    30
),
(
    'payment_conflict_resolution',
    'Payment Conflict Resolution',
    'Resolve payment conflicts with automatic retry and manual fallback',
    ARRAY['payment_conflict'],
    ARRAY['high', 'critical'],
    TRUE,
    TRUE,
    2,
    '[{"action": "retry_operation", "parameters": {"maxRetries": 2, "backoffMs": 500}, "priority": 1}, {"action": "update_payment", "parameters": {"reconcilePayments": true, "notifyCustomer": true}, "priority": 2}]'::jsonb,
    40
)
ON CONFLICT (strategy_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.conflict_detection_log IS 'Logs all detected conflicts in the system';
COMMENT ON TABLE public.conflict_resolution_actions IS 'Tracks resolution actions for conflicts';
COMMENT ON TABLE public.conflict_resolution_strategies IS 'Defines resolution strategies for different conflict types';
COMMENT ON FUNCTION detect_slot_overlap_conflicts IS 'Detect slot overlap conflicts for a given reservation';
COMMENT ON FUNCTION detect_capacity_conflicts IS 'Detect capacity conflicts for a given reservation';
COMMENT ON FUNCTION get_conflict_statistics IS 'Get comprehensive conflict statistics';
COMMENT ON FUNCTION cleanup_conflict_data IS 'Cleanup old conflict data';
