-- Create comprehensive reservation state machine functions
-- This migration implements the core state transition logic and validation
-- 
-- PREREQUISITES:
-- - Migration 040: create_base_reservation_tables.sql (creates reservations and reservation_status_logs tables)
-- - The reservation_status enum type must exist

-- =============================================
-- STATE TRANSITION VALIDATION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION validate_reservation_state_transition(
    p_reservation_id UUID,
    p_from_status reservation_status,
    p_to_status reservation_status,
    p_changed_by TEXT,
    p_changed_by_id UUID,
    p_reason TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_status reservation_status;
    v_reservation_exists BOOLEAN;
    v_valid_transition BOOLEAN := FALSE;
BEGIN
    -- Check if reservation exists and get current status
    SELECT status INTO v_current_status
    FROM public.reservations 
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found: %', p_reservation_id;
    END IF;
    
    -- Validate that the from_status matches current status
    IF v_current_status != p_from_status THEN
        RAISE EXCEPTION 'Status mismatch: expected %, got %', v_current_status, p_from_status;
    END IF;
    
    -- Define valid state transitions
    -- requested → confirmed, cancelled_by_user, cancelled_by_shop
    -- confirmed → completed, cancelled_by_user, cancelled_by_shop, no_show
    -- completed → (terminal state)
    -- cancelled_by_user → (terminal state)
    -- cancelled_by_shop → (terminal state)
    -- no_show → (terminal state)
    
    CASE p_from_status
        WHEN 'requested' THEN
            v_valid_transition := p_to_status IN ('confirmed', 'cancelled_by_user', 'cancelled_by_shop');
        WHEN 'confirmed' THEN
            v_valid_transition := p_to_status IN ('completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show');
        WHEN 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show' THEN
            v_valid_transition := FALSE; -- Terminal states
        ELSE
            v_valid_transition := FALSE;
    END CASE;
    
    IF NOT v_valid_transition THEN
        RAISE EXCEPTION 'Invalid state transition: % → %', p_from_status, p_to_status;
    END IF;
    
    -- Validate changed_by values
    IF p_changed_by NOT IN ('user', 'shop', 'system', 'admin') THEN
        RAISE EXCEPTION 'Invalid changed_by value: %', p_changed_by;
    END IF;
    
    RETURN TRUE;
END;
$$;

-- =============================================
-- ATOMIC STATE TRANSITION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION transition_reservation_status(
    p_reservation_id UUID,
    p_to_status reservation_status,
    p_changed_by TEXT,
    p_changed_by_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_from_status reservation_status;
    v_updated_reservation RECORD;
    v_log_id UUID;
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
        
        -- Create audit log entry
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
        
        -- Prepare result
        v_result := jsonb_build_object(
            'success', TRUE,
            'reservation_id', p_reservation_id,
            'from_status', v_from_status,
            'to_status', p_to_status,
            'log_id', v_log_id,
            'updated_at', v_updated_reservation.updated_at,
            'message', 'State transition completed successfully'
        );
        
        RETURN v_result;
        
    EXCEPTION
        WHEN OTHERS THEN
            -- Rollback will happen automatically
            RAISE EXCEPTION 'State transition failed: %', SQLERRM;
    END;
END;
$$;

-- =============================================
-- BULK STATE TRANSITION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION bulk_transition_reservations(
    p_reservation_ids UUID[],
    p_to_status reservation_status,
    p_changed_by TEXT,
    p_changed_by_id UUID,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_success_count INTEGER := 0;
    v_failure_count INTEGER := 0;
    v_failures JSONB := '[]';
    v_result JSONB;
    v_transition_result JSONB;
BEGIN
    -- Process each reservation
    FOREACH v_reservation_id IN ARRAY p_reservation_ids
    LOOP
        BEGIN
            v_transition_result := transition_reservation_status(
                v_reservation_id,
                p_to_status,
                p_changed_by,
                p_changed_by_id,
                p_reason,
                p_metadata
            );
            
            v_success_count := v_success_count + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_failure_count := v_failure_count + 1;
                v_failures := v_failures || jsonb_build_object(
                    'reservation_id', v_reservation_id,
                    'error', SQLERRM
                );
        END;
    END LOOP;
    
    -- Prepare result
    v_result := jsonb_build_object(
        'total_processed', array_length(p_reservation_ids, 1),
        'success_count', v_success_count,
        'failure_count', v_failure_count,
        'failures', v_failures,
        'message', format('Bulk transition completed: %s successful, %s failed', v_success_count, v_failure_count)
    );
    
    RETURN v_result;
END;
$$;

-- =============================================
-- NO-SHOW DETECTION FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION detect_no_show_reservations(
    p_grace_period_hours INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_no_show_reservations UUID[];
    v_current_time TIMESTAMPTZ := NOW();
    v_grace_period TIMESTAMPTZ := v_current_time - (p_grace_period_hours || ' hours')::INTERVAL;
    v_result JSONB;
BEGIN
    -- Find confirmed reservations that are past their time + grace period
    SELECT ARRAY_AGG(id) INTO v_no_show_reservations
    FROM public.reservations
    WHERE status = 'confirmed'
      AND reservation_datetime < v_grace_period
      AND reservation_datetime IS NOT NULL;
    
    -- If no reservations found, return early
    IF v_no_show_reservations IS NULL OR array_length(v_no_show_reservations, 1) = 0 THEN
        RETURN jsonb_build_object(
            'no_show_count', 0,
            'processed_reservations', '[]',
            'message', 'No no-show reservations detected'
        );
    END IF;
    
    -- Transition all no-show reservations
    v_result := bulk_transition_reservations(
        v_no_show_reservations,
        'no_show',
        'system',
        '00000000-0000-0000-0000-000000000000'::UUID, -- System UUID
        'Automatic no-show detection after grace period',
        jsonb_build_object(
            'grace_period_hours', p_grace_period_hours,
            'detected_at', v_current_time
        )
    );
    
    -- Add no-show count to result
    v_result := v_result || jsonb_build_object(
        'no_show_count', array_length(v_no_show_reservations, 1)
    );
    
    RETURN v_result;
END;
$$;

-- =============================================
-- RESERVATION STATUS QUERY HELPERS
-- =============================================

CREATE OR REPLACE FUNCTION get_reservation_status_history(
    p_reservation_id UUID
)
RETURNS TABLE (
    log_id UUID,
    from_status reservation_status,
    to_status reservation_status,
    changed_by TEXT,
    changed_by_id UUID,
    reason TEXT,
    metadata JSONB,
    changed_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        rsl.id,
        rsl.from_status,
        rsl.to_status,
        rsl.changed_by,
        rsl.changed_by_id,
        rsl.reason,
        rsl.metadata,
        rsl.timestamp as changed_at
    FROM public.reservation_status_logs rsl
    WHERE rsl.reservation_id = p_reservation_id
    ORDER BY rsl.timestamp ASC;
END;
$$;

-- =============================================
-- PERFORMANCE INDEXES
-- =============================================

-- Index for state transition queries
CREATE INDEX IF NOT EXISTS idx_reservations_status_datetime 
ON public.reservations(status, reservation_datetime) 
WHERE status IN ('confirmed', 'requested');

-- Index for no-show detection
CREATE INDEX IF NOT EXISTS idx_reservations_no_show_detection 
ON public.reservations(reservation_datetime) 
WHERE status = 'confirmed' AND reservation_datetime IS NOT NULL;

-- Index for status logs by reservation and timestamp
CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_reservation_timestamp 
ON public.reservation_status_logs(reservation_id, timestamp DESC);

-- Index for audit queries by changed_by
CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_changed_by_timestamp 
ON public.reservation_status_logs(changed_by, timestamp DESC);

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON FUNCTION validate_reservation_state_transition IS 
'Validates if a reservation state transition is allowed. Ensures business rules are followed.';

COMMENT ON FUNCTION transition_reservation_status IS 
'Atomically transitions a reservation from one status to another with full audit logging.';

COMMENT ON FUNCTION bulk_transition_reservations IS 
'Performs bulk state transitions on multiple reservations with error handling.';

COMMENT ON FUNCTION detect_no_show_reservations IS 
'Automatically detects and transitions no-show reservations after grace period.';

COMMENT ON FUNCTION get_reservation_status_history IS 
'Returns complete status change history for a reservation.';
