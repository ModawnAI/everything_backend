-- Create automatic state progression triggers and scheduled functions
-- This migration implements automatic state changes based on time and business rules

-- =============================================
-- AUTOMATIC STATE PROGRESSION TRIGGERS
-- =============================================

-- Function to handle automatic state progression
CREATE OR REPLACE FUNCTION handle_automatic_state_progression()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_current_time TIMESTAMPTZ := NOW();
    v_reservation_time TIMESTAMPTZ;
    v_grace_period INTERVAL := '1 hour'; -- Default grace period
BEGIN
    -- Only process if reservation_datetime is being updated or status is confirmed
    IF TG_OP = 'UPDATE' THEN
        -- If reservation_datetime is being set and status is confirmed, check for auto-progression
        IF NEW.reservation_datetime IS NOT NULL 
           AND OLD.reservation_datetime IS DISTINCT FROM NEW.reservation_datetime
           AND NEW.status = 'confirmed' THEN
            
            v_reservation_time := NEW.reservation_datetime;
            
            -- If reservation time has passed, automatically mark as completed
            -- (This is a business rule - confirmed reservations auto-complete after their time)
            IF v_reservation_time <= v_current_time THEN
                -- Use the state machine function to transition
                PERFORM transition_reservation_status(
                    NEW.id,
                    'completed',
                    'system',
                    '00000000-0000-0000-0000-000000000000'::UUID,
                    'Automatic completion after reservation time',
                    jsonb_build_object(
                        'auto_completed', true,
                        'completion_time', v_current_time
                    )
                );
                
                -- Update the NEW record to reflect the status change
                NEW.status := 'completed';
                NEW.updated_at := v_current_time;
            END IF;
        END IF;
        
        -- If status is being changed to confirmed, check if it should auto-complete
        IF OLD.status != 'confirmed' AND NEW.status = 'confirmed' THEN
            IF NEW.reservation_datetime IS NOT NULL 
               AND NEW.reservation_datetime <= v_current_time THEN
                
                -- Auto-complete confirmed reservations that are already past their time
                PERFORM transition_reservation_status(
                    NEW.id,
                    'completed',
                    'system',
                    '00000000-0000-0000-0000-000000000000'::UUID,
                    'Automatic completion - reservation time already passed',
                    jsonb_build_object(
                        'auto_completed', true,
                        'completion_time', v_current_time,
                        'was_past_time', true
                    )
                );
                
                NEW.status := 'completed';
                NEW.updated_at := v_current_time;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;

-- Create trigger for automatic state progression
DROP TRIGGER IF EXISTS trigger_automatic_state_progression ON public.reservations;
CREATE TRIGGER trigger_automatic_state_progression
    AFTER UPDATE ON public.reservations
    FOR EACH ROW
    EXECUTE FUNCTION handle_automatic_state_progression();

-- =============================================
-- SCHEDULED NO-SHOW DETECTION
-- =============================================

-- Function to run scheduled no-show detection
CREATE OR REPLACE FUNCTION scheduled_no_show_detection()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_result JSONB;
    v_grace_period_hours INTEGER := 1; -- Default grace period
BEGIN
    -- Run no-show detection with grace period
    v_result := detect_no_show_reservations(v_grace_period_hours);
    
    -- Log the result
    RAISE NOTICE 'Scheduled no-show detection completed: %', v_result;
    
    RETURN v_result;
END;
$$;

-- =============================================
-- RESERVATION EXPIRY HANDLING
-- =============================================

-- Function to handle reservation expiry (requested reservations that are too old)
CREATE OR REPLACE FUNCTION handle_expired_reservations(
    p_expiry_hours INTEGER DEFAULT 24
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_expired_reservations UUID[];
    v_current_time TIMESTAMPTZ := NOW();
    v_expiry_time TIMESTAMPTZ := v_current_time - (p_expiry_hours || ' hours')::INTERVAL;
    v_result JSONB;
BEGIN
    -- Find requested reservations that are older than expiry period
    SELECT ARRAY_AGG(id) INTO v_expired_reservations
    FROM public.reservations
    WHERE status = 'requested'
      AND created_at < v_expiry_time;
    
    -- If no reservations found, return early
    IF v_expired_reservations IS NULL OR array_length(v_expired_reservations, 1) = 0 THEN
        RETURN jsonb_build_object(
            'expired_count', 0,
            'processed_reservations', '[]',
            'message', 'No expired reservations detected'
        );
    END IF;
    
    -- Transition all expired reservations to cancelled_by_system
    -- Note: We'll need to add this status to the enum if it doesn't exist
    -- For now, we'll use cancelled_by_shop with a special reason
    v_result := bulk_transition_reservations(
        v_expired_reservations,
        'cancelled_by_shop', -- Using existing status
        'system',
        '00000000-0000-0000-0000-000000000000'::UUID, -- System UUID
        'Automatic cancellation due to expiry',
        jsonb_build_object(
            'expiry_hours', p_expiry_hours,
            'expired_at', v_current_time,
            'auto_cancelled', true,
            'cancellation_type', 'expiry'
        )
    );
    
    -- Add expiry count to result
    v_result := v_result || jsonb_build_object(
        'expired_count', array_length(v_expired_reservations, 1)
    );
    
    RETURN v_result;
END;
$$;

-- =============================================
-- COMPREHENSIVE STATE CLEANUP FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION comprehensive_reservation_cleanup()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_no_show_result JSONB;
    v_expired_result JSONB;
    v_combined_result JSONB;
BEGIN
    -- Run no-show detection
    v_no_show_result := detect_no_show_reservations(1); -- 1 hour grace period
    
    -- Run expired reservation cleanup
    v_expired_result := handle_expired_reservations(24); -- 24 hour expiry
    
    -- Combine results
    v_combined_result := jsonb_build_object(
        'no_show_detection', v_no_show_result,
        'expired_cleanup', v_expired_result,
        'executed_at', NOW(),
        'message', 'Comprehensive reservation cleanup completed'
    );
    
    RETURN v_combined_result;
END;
$$;

-- =============================================
-- RESERVATION STATUS SUMMARY FUNCTION
-- =============================================

CREATE OR REPLACE FUNCTION get_reservation_status_summary(
    p_shop_id UUID DEFAULT NULL,
    p_user_id UUID DEFAULT NULL,
    p_date_from DATE DEFAULT NULL,
    p_date_to DATE DEFAULT NULL
)
RETURNS TABLE (
    status reservation_status,
    count BIGINT,
    total_amount BIGINT,
    avg_amount NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        r.status,
        COUNT(*) as count,
        SUM(r.total_amount) as total_amount,
        ROUND(AVG(r.total_amount), 2) as avg_amount
    FROM public.reservations r
    WHERE (p_shop_id IS NULL OR r.shop_id = p_shop_id)
      AND (p_user_id IS NULL OR r.user_id = p_user_id)
      AND (p_date_from IS NULL OR r.reservation_date >= p_date_from)
      AND (p_date_to IS NULL OR r.reservation_date <= p_date_to)
    GROUP BY r.status
    ORDER BY r.status;
END;
$$;

-- =============================================
-- PERFORMANCE OPTIMIZATION INDEXES
-- =============================================

-- Index for expiry detection
CREATE INDEX IF NOT EXISTS idx_reservations_expiry_detection 
ON public.reservations(created_at) 
WHERE status = 'requested';

-- Index for status summary queries
CREATE INDEX IF NOT EXISTS idx_reservations_status_summary 
ON public.reservations(status, shop_id, user_id, reservation_date, total_amount);

-- Index for automatic progression queries
CREATE INDEX IF NOT EXISTS idx_reservations_auto_progression 
ON public.reservations(status, reservation_datetime, updated_at) 
WHERE status = 'confirmed';

-- =============================================
-- COMMENTS AND DOCUMENTATION
-- =============================================

COMMENT ON FUNCTION handle_automatic_state_progression IS 
'Trigger function that automatically progresses reservation states based on time and business rules.';

COMMENT ON FUNCTION scheduled_no_show_detection IS 
'Function to run scheduled no-show detection with configurable grace period.';

COMMENT ON FUNCTION handle_expired_reservations IS 
'Function to handle expired requested reservations that were never confirmed.';

COMMENT ON FUNCTION comprehensive_reservation_cleanup IS 
'Master function that runs all automatic cleanup processes for reservations.';

COMMENT ON FUNCTION get_reservation_status_summary IS 
'Returns summary statistics for reservations by status with optional filtering.';

-- Add comments for indexes
COMMENT ON INDEX idx_reservations_expiry_detection IS 
'Optimizes queries for detecting expired requested reservations.';

COMMENT ON INDEX idx_reservations_status_summary IS 
'Optimizes status summary queries with multiple filter combinations.';

COMMENT ON INDEX idx_reservations_auto_progression IS 
'Optimizes automatic state progression queries for confirmed reservations.';
