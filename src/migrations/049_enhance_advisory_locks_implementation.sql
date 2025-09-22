-- Enhanced advisory locks implementation with metrics and better error handling
-- This migration enhances the existing create_reservation_with_lock function

-- Ensure UUID extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Ensure required tables exist (in case base schema wasn't applied)
-- Create shops table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shop_services table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.shop_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    price_min INTEGER,
    duration_minutes INTEGER,
    deposit_amount INTEGER,
    deposit_percentage DECIMAL(5,2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create reservation_services table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.reservation_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
    quantity INTEGER DEFAULT 1,
    unit_price INTEGER NOT NULL,
    total_price INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    amount INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create advisory lock metrics table for monitoring
CREATE TABLE IF NOT EXISTS public.advisory_lock_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lock_key BIGINT NOT NULL,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    operation_type VARCHAR(50) NOT NULL, -- 'reservation_creation', 'reservation_update', 'payment_processing'
    lock_duration_ms INTEGER, -- How long the lock was held
    success BOOLEAN NOT NULL,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    conflict_detected BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_advisory_lock_metrics_shop_created ON public.advisory_lock_metrics(shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_advisory_lock_metrics_lock_key ON public.advisory_lock_metrics(lock_key);

-- Add comment for documentation
COMMENT ON TABLE public.advisory_lock_metrics IS 'Metrics for monitoring advisory lock performance and conflicts';

-- Enhanced function to create reservation with comprehensive locking and metrics
CREATE OR REPLACE FUNCTION create_reservation_with_lock_enhanced(
  p_shop_id UUID,
  p_user_id UUID,
  p_reservation_date DATE,
  p_reservation_time TIME,
  p_special_requests TEXT DEFAULT NULL,
  p_points_used INTEGER DEFAULT 0,
  p_services JSONB DEFAULT '[]'::JSONB,
  p_lock_timeout INTEGER DEFAULT 10000,
  p_deposit_amount INTEGER DEFAULT NULL,
  p_remaining_amount INTEGER DEFAULT NULL,
  p_enable_metrics BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_reservation_id UUID;
  v_total_amount DECIMAL(10,2) := 0;
  v_service_record RECORD;
  v_service_data JSONB;
  v_service_id UUID;
  v_quantity INTEGER;
  v_price DECIMAL(10,2);
  v_duration_minutes INTEGER;
  v_conflicting_reservations INTEGER;
  v_lock_acquired BOOLEAN := FALSE;
  v_advisory_lock_acquired BOOLEAN := FALSE;
  v_start_time TIMESTAMP;
  v_end_time TIMESTAMP;
  v_result JSONB;
  v_advisory_lock_key BIGINT;
  v_deadlock_retry_count INTEGER := 0;
  v_max_deadlock_retries INTEGER := 3;
  v_deposit_amount INTEGER;
  v_remaining_amount INTEGER;
  -- Enhanced deposit calculation variables
  v_default_deposit_percentage DECIMAL(5,2) := 25.0;
  v_min_deposit_amount INTEGER := 10000;
  v_max_deposit_amount INTEGER := 100000;
  v_total_service_deposit INTEGER := 0;
  v_service_deposit INTEGER := 0;
  v_deposit_percentage DECIMAL(5,2);
  v_service_deposit_amount INTEGER;
  -- Metrics tracking
  v_lock_start_time TIMESTAMP;
  v_lock_end_time TIMESTAMP;
  v_lock_duration_ms INTEGER;
  v_operation_success BOOLEAN := FALSE;
  v_error_message TEXT;
  v_retry_count INTEGER := 0;
  v_conflict_detected BOOLEAN := FALSE;
  v_metrics_id UUID;
BEGIN
  -- Set lock timeout
  SET lock_timeout = p_lock_timeout;
  
  -- Record start time for metrics
  v_lock_start_time := clock_timestamp();
  
  -- Generate advisory lock key based on shop_id, date, and time
  -- This ensures only one reservation can be created for the same slot at a time
  v_advisory_lock_key := ('x' || substr(md5(p_shop_id::text || p_reservation_date::text || p_reservation_time::text), 1, 8))::bit(32)::bigint;
  
  -- Start transaction with retry logic for deadlocks
  LOOP
    BEGIN
      -- Acquire advisory lock for this specific time slot
      IF NOT pg_try_advisory_xact_lock(v_advisory_lock_key) THEN
        v_retry_count := v_retry_count + 1;
        v_error_message := format('Unable to acquire advisory lock for time slot %s at %s (attempt %s)', p_reservation_time, p_reservation_date, v_retry_count);
        
        IF v_retry_count >= v_max_deadlock_retries THEN
          RAISE EXCEPTION 'ADVISORY_LOCK_TIMEOUT: %', v_error_message;
        END IF;
        
        -- Wait before retry (exponential backoff)
        PERFORM pg_sleep(LEAST(0.1 * power(2, v_retry_count - 1), 1.0));
        CONTINUE;
      END IF;
      v_advisory_lock_acquired := TRUE;
      
      -- Check for conflicting reservations with FOR UPDATE lock
      -- Now includes both 'requested' and 'confirmed' status as per v3.1 flow
      SELECT COUNT(*) INTO v_conflicting_reservations
      FROM reservations r
      JOIN reservation_services rs ON r.id = rs.reservation_id
      JOIN shop_services s ON rs.service_id = s.id
      WHERE r.shop_id = p_shop_id
        AND r.reservation_date = p_reservation_date
        AND r.status IN ('requested', 'confirmed', 'in_progress')
        AND (
          -- Check for time overlap with 15-minute buffer
          (r.reservation_time <= p_reservation_time AND 
           r.reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > p_reservation_time)
          OR
          (p_reservation_time <= r.reservation_time AND 
           p_reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > r.reservation_time)
        )
      FOR UPDATE;
    
      -- If conflicts found, raise error
      IF v_conflicting_reservations > 0 THEN
        v_conflict_detected := TRUE;
        v_error_message := format('Time slot conflict detected: %s existing reservations', v_conflicting_reservations);
        RAISE EXCEPTION 'SLOT_CONFLICT: %', v_error_message;
      END IF;
      
      -- Calculate total amount and validate services
      FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
      LOOP
        v_service_id := (v_service_data->>'serviceId')::UUID;
        v_quantity := (v_service_data->>'quantity')::INTEGER;
        
        -- Get service details with FOR UPDATE to prevent concurrent modifications
        SELECT price_min, duration_minutes INTO v_price, v_duration_minutes
        FROM shop_services
        WHERE id = v_service_id
        FOR UPDATE;
        
        IF NOT FOUND THEN
          v_error_message := format('Service not found: %s', v_service_id);
          RAISE EXCEPTION 'SERVICE_NOT_FOUND: %', v_error_message;
        END IF;
        
        -- Calculate service total
        v_total_amount := v_total_amount + (v_price * v_quantity);
        
        -- Calculate deposit for this service
        SELECT 
          COALESCE(deposit_percentage, v_default_deposit_percentage),
          COALESCE(deposit_amount, 0)
        INTO v_deposit_percentage, v_service_deposit_amount
        FROM shop_services
        WHERE id = v_service_id;
        
        IF v_service_deposit_amount > 0 THEN
          v_service_deposit := v_service_deposit_amount * v_quantity;
        ELSE
          v_service_deposit := ROUND((v_price * v_quantity * v_deposit_percentage / 100)::DECIMAL, 0)::INTEGER;
        END IF;
        
        -- Apply min/max deposit limits
        v_service_deposit := GREATEST(v_min_deposit_amount, LEAST(v_max_deposit_amount, v_service_deposit));
        v_total_service_deposit := v_total_service_deposit + v_service_deposit;
      END LOOP;
      
      -- Use provided deposit amount or calculate default
      IF p_deposit_amount IS NOT NULL THEN
        v_deposit_amount := p_deposit_amount;
      ELSE
        v_deposit_amount := v_total_service_deposit;
      END IF;
      
      IF p_remaining_amount IS NOT NULL THEN
        v_remaining_amount := p_remaining_amount;
      ELSE
        v_remaining_amount := v_total_amount - v_deposit_amount;
      END IF;
      
      -- Create reservation record with version field
      INSERT INTO reservations (
        user_id, shop_id, reservation_date, reservation_time, 
        reservation_datetime, status, total_amount, deposit_amount, 
        remaining_amount, points_used, special_requests, version
      ) VALUES (
        p_user_id, p_shop_id, p_reservation_date, p_reservation_time,
        (p_reservation_date::text || ' ' || p_reservation_time::text)::TIMESTAMPTZ,
        'requested', v_total_amount, v_deposit_amount, v_remaining_amount, 
        p_points_used, p_special_requests, 1
      ) RETURNING id INTO v_reservation_id;
      
      -- Insert reservation services with version field
      FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
      LOOP
        v_service_id := (v_service_data->>'serviceId')::UUID;
        v_quantity := (v_service_data->>'quantity')::INTEGER;
        
        SELECT price_min INTO v_price
        FROM shop_services
        WHERE id = v_service_id;
        
        INSERT INTO reservation_services (
          reservation_id, service_id, quantity, unit_price, 
          total_price, version
        ) VALUES (
          v_reservation_id, v_service_id, v_quantity, v_price,
          v_price * v_quantity, 1
        );
      END LOOP;
      
      -- Mark operation as successful
      v_operation_success := TRUE;
      
      -- Exit the retry loop on success
      EXIT;
      
    EXCEPTION
      WHEN deadlock_detected THEN
        v_deadlock_retry_count := v_deadlock_retry_count + 1;
        v_error_message := format('Deadlock detected (attempt %s)', v_deadlock_retry_count);
        
        IF v_deadlock_retry_count >= v_max_deadlock_retries THEN
          RAISE;
        END IF;
        
        -- Wait before retry with exponential backoff
        PERFORM pg_sleep(LEAST(0.1 * power(2, v_deadlock_retry_count - 1), 1.0));
        
      WHEN OTHERS THEN
        v_error_message := SQLERRM;
        RAISE;
    END;
  END LOOP;
  
  -- Record end time for metrics
  v_lock_end_time := clock_timestamp();
  v_lock_duration_ms := EXTRACT(EPOCH FROM (v_lock_end_time - v_lock_start_time)) * 1000;
  
  -- Record metrics if enabled
  IF p_enable_metrics THEN
    INSERT INTO public.advisory_lock_metrics (
      lock_key, shop_id, operation_type, lock_duration_ms, 
      success, error_message, retry_count, conflict_detected
    ) VALUES (
      v_advisory_lock_key, p_shop_id, 'reservation_creation', 
      v_lock_duration_ms, v_operation_success, v_error_message, 
      v_retry_count, v_conflict_detected
    ) RETURNING id INTO v_metrics_id;
  END IF;
  
  -- Return result
  v_result := jsonb_build_object(
    'success', v_operation_success,
    'reservation_id', v_reservation_id,
    'total_amount', v_total_amount,
    'deposit_amount', v_deposit_amount,
    'remaining_amount', v_remaining_amount,
    'points_used', p_points_used,
    'lock_duration_ms', v_lock_duration_ms,
    'retry_count', v_retry_count,
    'metrics_id', v_metrics_id
  );
  
  RETURN v_result;
  
EXCEPTION
  WHEN OTHERS THEN
    -- Record failure metrics
    v_lock_end_time := clock_timestamp();
    v_lock_duration_ms := EXTRACT(EPOCH FROM (v_lock_end_time - v_lock_start_time)) * 1000;
    
    IF p_enable_metrics THEN
      INSERT INTO public.advisory_lock_metrics (
        lock_key, shop_id, operation_type, lock_duration_ms, 
        success, error_message, retry_count, conflict_detected
      ) VALUES (
        v_advisory_lock_key, p_shop_id, 'reservation_creation', 
        v_lock_duration_ms, FALSE, SQLERRM, v_retry_count, v_conflict_detected
      );
    END IF;
    
    -- Re-raise the exception
    RAISE;
END;
$$;

-- Create function to get advisory lock metrics
CREATE OR REPLACE FUNCTION get_advisory_lock_metrics(
  p_shop_id UUID DEFAULT NULL,
  p_hours_back INTEGER DEFAULT 24,
  p_operation_type VARCHAR(50) DEFAULT NULL
)
RETURNS TABLE (
  shop_id UUID,
  operation_type VARCHAR(50),
  total_operations BIGINT,
  successful_operations BIGINT,
  failed_operations BIGINT,
  avg_lock_duration_ms NUMERIC,
  max_lock_duration_ms INTEGER,
  total_conflicts BIGINT,
  avg_retry_count NUMERIC,
  max_retry_count INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    alm.shop_id,
    alm.operation_type,
    COUNT(*) as total_operations,
    COUNT(*) FILTER (WHERE alm.success = TRUE) as successful_operations,
    COUNT(*) FILTER (WHERE alm.success = FALSE) as failed_operations,
    ROUND(AVG(alm.lock_duration_ms), 2) as avg_lock_duration_ms,
    MAX(alm.lock_duration_ms) as max_lock_duration_ms,
    COUNT(*) FILTER (WHERE alm.conflict_detected = TRUE) as total_conflicts,
    ROUND(AVG(alm.retry_count), 2) as avg_retry_count,
    MAX(alm.retry_count) as max_retry_count
  FROM public.advisory_lock_metrics alm
  WHERE alm.created_at >= NOW() - INTERVAL '1 hour' * p_hours_back
    AND (p_shop_id IS NULL OR alm.shop_id = p_shop_id)
    AND (p_operation_type IS NULL OR alm.operation_type = p_operation_type)
  GROUP BY alm.shop_id, alm.operation_type
  ORDER BY total_operations DESC;
END;
$$;

-- Create function to cleanup old metrics
CREATE OR REPLACE FUNCTION cleanup_advisory_lock_metrics(
  p_days_to_keep INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_deleted_count INTEGER;
BEGIN
  DELETE FROM public.advisory_lock_metrics
  WHERE created_at < NOW() - INTERVAL '1 day' * p_days_to_keep;
  
  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
  
  RETURN v_deleted_count;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION create_reservation_with_lock_enhanced IS 'Enhanced reservation creation with advisory locks, metrics tracking, and better error handling';
COMMENT ON FUNCTION get_advisory_lock_metrics IS 'Get advisory lock performance metrics for monitoring and optimization';
COMMENT ON FUNCTION cleanup_advisory_lock_metrics IS 'Cleanup old advisory lock metrics to manage database size';
