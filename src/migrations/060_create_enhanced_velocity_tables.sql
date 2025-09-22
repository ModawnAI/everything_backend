-- Enhanced Velocity Checking Tables Migration
-- Creates tables for multi-dimensional velocity analysis and fraud detection

-- Create velocity_profiles table for storing user velocity profiles
CREATE TABLE IF NOT EXISTS public.velocity_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL DEFAULT '{}',
    profile_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for velocity profiles
CREATE INDEX IF NOT EXISTS idx_velocity_profiles_user_id ON public.velocity_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_velocity_profiles_active ON public.velocity_profiles (is_active, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_profiles_version ON public.velocity_profiles (profile_version);

-- Create velocity_checks table for storing velocity check results
CREATE TABLE IF NOT EXISTS public.velocity_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    merchant_category VARCHAR(100),
    location JSONB NOT NULL DEFAULT '{}',
    device_fingerprint VARCHAR(255),
    ip_address INET,
    is_exceeded BOOLEAN NOT NULL DEFAULT false,
    overall_risk_score INTEGER NOT NULL DEFAULT 0 CHECK (overall_risk_score >= 0 AND overall_risk_score <= 100),
    dimension_results JSONB NOT NULL DEFAULT '[]',
    correlations JSONB NOT NULL DEFAULT '[]',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    analysis_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for velocity checks
CREATE INDEX IF NOT EXISTS idx_velocity_checks_user_id ON public.velocity_checks (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_checks_payment_id ON public.velocity_checks (payment_id);
CREATE INDEX IF NOT EXISTS idx_velocity_checks_exceeded ON public.velocity_checks (is_exceeded, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_checks_risk_score ON public.velocity_checks (overall_risk_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_checks_location ON public.velocity_checks USING GIN (location);

-- Create velocity_alerts table for storing velocity-based alerts
CREATE TABLE IF NOT EXISTS public.velocity_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_id VARCHAR(255),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'velocity_exceeded', 'velocity_anomaly', 'correlation_anomaly'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    dimensions TEXT[] NOT NULL DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for velocity alerts
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_user_id ON public.velocity_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_payment_id ON public.velocity_alerts (payment_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_type ON public.velocity_alerts (alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_resolved ON public.velocity_alerts (is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_severity ON public.velocity_alerts (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_alerts_dimensions ON public.velocity_alerts USING GIN (dimensions);

-- Create velocity_metrics table for storing aggregated velocity metrics
CREATE TABLE IF NOT EXISTS public.velocity_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    dimension VARCHAR(50) NOT NULL,
    time_window_minutes INTEGER NOT NULL,
    measurement_period_start TIMESTAMPTZ NOT NULL,
    measurement_period_end TIMESTAMPTZ NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for velocity metrics
CREATE INDEX IF NOT EXISTS idx_velocity_metrics_user_id ON public.velocity_metrics (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_velocity_metrics_type ON public.velocity_metrics (metric_type, dimension);
CREATE INDEX IF NOT EXISTS idx_velocity_metrics_period ON public.velocity_metrics (measurement_period_start, measurement_period_end);
CREATE INDEX IF NOT EXISTS idx_velocity_metrics_time_window ON public.velocity_metrics (time_window_minutes, created_at DESC);

-- Create function to update velocity profile
CREATE OR REPLACE FUNCTION public.update_velocity_profile(
    p_user_id UUID,
    p_payment_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    v_existing_profile JSONB;
    v_updated_profile JSONB;
BEGIN
    -- Get existing profile
    SELECT profile_data INTO v_existing_profile
    FROM public.velocity_profiles
    WHERE user_id = p_user_id AND is_active = true;
    
    -- If no existing profile, create default
    IF v_existing_profile IS NULL THEN
        v_existing_profile := '{
            "dimensions": {
                "amount": {"average": 0, "median": 0, "stdDev": 0, "peak": 0, "trend": "stable"},
                "frequency": {"average": 0, "peak": 0, "pattern": [], "trend": "stable"},
                "location": {"primaryCountry": "unknown", "primaryRegion": "unknown", "travelFrequency": 0, "newLocationRisk": 50},
                "device": {"primaryDevice": "unknown", "deviceStability": 0, "newDeviceRisk": 50},
                "paymentMethod": {"preferredMethods": [], "methodStability": 0},
                "merchantCategory": {"preferredCategories": [], "categoryStability": 0}
            },
            "thresholds": {
                "amount": 100000,
                "frequency": 5,
                "location": 2,
                "device": 1,
                "paymentMethod": 2,
                "merchantCategory": 3
            }
        }';
    END IF;
    
    -- Update profile with new payment data (simplified update)
    v_updated_profile := v_existing_profile;
    v_updated_profile := jsonb_set(v_updated_profile, '{lastPayment}', p_payment_data);
    v_updated_profile := jsonb_set(v_updated_profile, '{lastUpdated}', to_jsonb(now()));
    
    -- Upsert profile
    INSERT INTO public.velocity_profiles (user_id, profile_data, last_updated)
    VALUES (p_user_id, v_updated_profile, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        profile_data = v_updated_profile,
        last_updated = now(),
        updated_at = now();
END;
$$;

-- Create function to get velocity statistics
CREATE OR REPLACE FUNCTION public.get_velocity_statistics(
    p_user_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    total_checks BIGINT,
    exceeded_checks BIGINT,
    exceed_rate DECIMAL(5,2),
    avg_risk_score DECIMAL(5,2),
    high_risk_checks BIGINT,
    alert_count BIGINT,
    most_common_dimensions TEXT[],
    dimension_distribution JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH check_stats AS (
        SELECT 
            COUNT(*) as total_checks,
            COUNT(*) FILTER (WHERE is_exceeded = true) as exceeded_checks,
            AVG(overall_risk_score) as avg_risk_score,
            COUNT(*) FILTER (WHERE overall_risk_score >= 70) as high_risk_checks
        FROM public.velocity_checks
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND created_at BETWEEN v_start_date AND v_end_date
    ),
    alert_stats AS (
        SELECT 
            COUNT(*) as alert_count
        FROM public.velocity_alerts
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND created_at BETWEEN v_start_date AND v_end_date
    ),
    dimension_stats AS (
        SELECT 
            array_agg(dimension ORDER BY dimension_count DESC) as most_common_dimensions
        FROM (
            SELECT 
                jsonb_array_elements(dimension_results)->>'dimension' as dimension,
                COUNT(*) as dimension_count
            FROM public.velocity_checks
            WHERE 
                (p_user_id IS NULL OR user_id = p_user_id)
                AND created_at BETWEEN v_start_date AND v_end_date
                AND jsonb_array_length(dimension_results) > 0
            GROUP BY jsonb_array_elements(dimension_results)->>'dimension'
            ORDER BY dimension_count DESC
            LIMIT 10
        ) dimension_counts
    ),
    dimension_dist AS (
        SELECT 
            jsonb_object_agg(dimension, dimension_count) as dimension_distribution
        FROM (
            SELECT 
                jsonb_array_elements(dimension_results)->>'dimension' as dimension,
                COUNT(*) as dimension_count
            FROM public.velocity_checks
            WHERE 
                (p_user_id IS NULL OR user_id = p_user_id)
                AND created_at BETWEEN v_start_date AND v_end_date
                AND jsonb_array_length(dimension_results) > 0
            GROUP BY jsonb_array_elements(dimension_results)->>'dimension'
        ) dimension_counts
    )
    SELECT 
        COALESCE(cs.total_checks, 0) as total_checks,
        COALESCE(cs.exceeded_checks, 0) as exceeded_checks,
        CASE 
            WHEN cs.total_checks > 0 
            THEN ROUND((cs.exceeded_checks::DECIMAL / cs.total_checks) * 100, 2)
            ELSE 0
        END as exceed_rate,
        COALESCE(cs.avg_risk_score, 0) as avg_risk_score,
        COALESCE(cs.high_risk_checks, 0) as high_risk_checks,
        COALESCE(als.alert_count, 0) as alert_count,
        COALESCE(ds.most_common_dimensions, ARRAY[]::TEXT[]) as most_common_dimensions,
        COALESCE(dd.dimension_distribution, '{}'::JSONB) as dimension_distribution
    FROM check_stats cs
    CROSS JOIN alert_stats als
    CROSS JOIN dimension_stats ds
    CROSS JOIN dimension_dist dd;
END;
$$;

-- Create function to detect velocity anomalies
CREATE OR REPLACE FUNCTION public.detect_velocity_anomaly(
    p_user_id UUID,
    p_dimension VARCHAR(50),
    p_current_value DECIMAL,
    p_threshold DECIMAL,
    p_time_window INTEGER
)
RETURNS TABLE (
    is_anomaly BOOLEAN,
    anomaly_score DECIMAL(5,2),
    risk_factors TEXT[],
    recommendations TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_is_anomaly BOOLEAN := false;
    v_anomaly_score DECIMAL(5,2) := 0;
    v_risk_factors TEXT[] := '{}';
    v_recommendations TEXT[] := '{}';
    v_historical_avg DECIMAL(10,2);
    v_deviation_percentage DECIMAL(5,2);
BEGIN
    -- Get historical average for the dimension
    SELECT AVG(
        CASE p_dimension
            WHEN 'amount' THEN (dimension_results->0->>'currentValue')::DECIMAL
            WHEN 'frequency' THEN (dimension_results->1->>'currentValue')::DECIMAL
            WHEN 'location' THEN (dimension_results->2->>'currentValue')::DECIMAL
            WHEN 'device' THEN (dimension_results->3->>'currentValue')::DECIMAL
            WHEN 'payment_method' THEN (dimension_results->4->>'currentValue')::DECIMAL
            WHEN 'merchant_category' THEN (dimension_results->5->>'currentValue')::DECIMAL
        END
    ) INTO v_historical_avg
    FROM public.velocity_checks
    WHERE user_id = p_user_id
    AND created_at > NOW() - (p_time_window || ' minutes')::INTERVAL
    AND jsonb_array_length(dimension_results) > 0;
    
    -- Calculate deviation percentage
    IF v_historical_avg > 0 THEN
        v_deviation_percentage := ABS((p_current_value - v_historical_avg) / v_historical_avg) * 100;
    ELSE
        v_deviation_percentage := 100;
    END IF;
    
    -- Check for anomalies
    IF p_current_value > p_threshold THEN
        v_is_anomaly := true;
        v_anomaly_score := LEAST(100, (p_current_value / p_threshold) * 100);
        v_risk_factors := array_append(v_risk_factors, 'threshold_exceeded');
        v_recommendations := array_append(v_recommendations, 'Velocity threshold exceeded - manual review required');
    END IF;
    
    IF v_deviation_percentage > 200 THEN
        v_is_anomaly := true;
        v_anomaly_score := GREATEST(v_anomaly_score, LEAST(100, v_deviation_percentage / 2));
        v_risk_factors := array_append(v_risk_factors, 'high_deviation');
        v_recommendations := array_append(v_recommendations, 'Significant deviation from historical pattern');
    END IF;
    
    IF v_anomaly_score >= 80 THEN
        v_recommendations := array_append(v_recommendations, 'Critical velocity anomaly - immediate review required');
    ELSIF v_anomaly_score >= 60 THEN
        v_recommendations := array_append(v_recommendations, 'High velocity anomaly - enhanced monitoring recommended');
    END IF;
    
    RETURN QUERY SELECT v_is_anomaly, v_anomaly_score, v_risk_factors, v_recommendations;
END;
$$;

-- Create function to cleanup old velocity data
CREATE OR REPLACE FUNCTION public.cleanup_velocity_data(
    p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    checks_deleted BIGINT,
    alerts_deleted BIGINT,
    metrics_deleted BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cutoff_date TIMESTAMPTZ;
    v_checks_deleted BIGINT;
    v_alerts_deleted BIGINT;
    v_metrics_deleted BIGINT;
BEGIN
    v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
    
    -- Delete old velocity checks
    DELETE FROM public.velocity_checks
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_checks_deleted = ROW_COUNT;
    
    -- Delete old resolved alerts
    DELETE FROM public.velocity_alerts
    WHERE created_at < v_cutoff_date 
    AND is_resolved = true;
    GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;
    
    -- Delete old metrics
    DELETE FROM public.velocity_metrics
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_metrics_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT v_checks_deleted, v_alerts_deleted, v_metrics_deleted;
END;
$$;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_velocity_profiles_updated_at ON public.velocity_profiles;
CREATE TRIGGER trigger_velocity_profiles_updated_at
    BEFORE UPDATE ON public.velocity_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_velocity_alerts_updated_at ON public.velocity_alerts;
CREATE TRIGGER trigger_velocity_alerts_updated_at
    BEFORE UPDATE ON public.velocity_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.velocity_profiles IS 'User velocity profiles for multi-dimensional fraud detection';
COMMENT ON TABLE public.velocity_checks IS 'Velocity check results for payment transactions';
COMMENT ON TABLE public.velocity_alerts IS 'Alerts generated from velocity analysis for suspicious activities';
COMMENT ON TABLE public.velocity_metrics IS 'Aggregated velocity metrics for analysis and reporting';

COMMENT ON FUNCTION public.update_velocity_profile(UUID, JSONB) IS 'Update user velocity profile with new payment data';
COMMENT ON FUNCTION public.get_velocity_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Get comprehensive velocity statistics';
COMMENT ON FUNCTION public.detect_velocity_anomaly(UUID, VARCHAR, DECIMAL, DECIMAL, INTEGER) IS 'Detect velocity anomalies and provide recommendations';
COMMENT ON FUNCTION public.cleanup_velocity_data(INTEGER) IS 'Clean up old velocity data to maintain performance';

