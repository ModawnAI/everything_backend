-- User Behavior Monitoring Tables Migration
-- Creates tables for comprehensive user behavior monitoring and analysis

-- Create user_activities table for tracking user activities
CREATE TABLE IF NOT EXISTS public.user_activities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    activity_type VARCHAR(50) NOT NULL CHECK (activity_type IN (
        'login', 'payment', 'navigation', 'search', 'profile_update', 'logout'
    )),
    timestamp TIMESTAMPTZ NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    risk_factors TEXT[] NOT NULL DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for user activities
CREATE INDEX IF NOT EXISTS idx_user_activities_user_id ON public.user_activities (user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_session_id ON public.user_activities (session_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_type ON public.user_activities (activity_type, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_risk_score ON public.user_activities (risk_score DESC, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_user_activities_risk_factors ON public.user_activities USING GIN (risk_factors);

-- Create user_sessions table for tracking user sessions
CREATE TABLE IF NOT EXISTS public.user_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id VARCHAR(255) NOT NULL UNIQUE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    last_activity TIMESTAMPTZ NOT NULL,
    duration_minutes INTEGER NOT NULL DEFAULT 0,
    device_fingerprint VARCHAR(255),
    ip_address INET,
    user_agent TEXT,
    location JSONB NOT NULL DEFAULT '{}',
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for user sessions
CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON public.user_sessions (user_id, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_session_id ON public.user_sessions (session_id);
CREATE INDEX IF NOT EXISTS idx_user_sessions_active ON public.user_sessions (is_active, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_device ON public.user_sessions (device_fingerprint, last_activity DESC);
CREATE INDEX IF NOT EXISTS idx_user_sessions_ip ON public.user_sessions (ip_address, last_activity DESC);

-- Create behavior_profiles table for storing user behavior profiles
CREATE TABLE IF NOT EXISTS public.behavior_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL DEFAULT '{}',
    profile_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for behavior profiles
CREATE INDEX IF NOT EXISTS idx_behavior_profiles_user_id ON public.behavior_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_profiles_active ON public.behavior_profiles (is_active, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_profiles_version ON public.behavior_profiles (profile_version);

-- Create behavior_alerts table for storing behavior-based alerts
CREATE TABLE IF NOT EXISTS public.behavior_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    session_id VARCHAR(255),
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'suspicious_activity', 'velocity_anomaly', 'location_anomaly', 
        'device_anomaly', 'behavior_anomaly'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    detected_patterns TEXT[] NOT NULL DEFAULT '{}',
    risk_factors JSONB NOT NULL DEFAULT '[]',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for behavior alerts
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_user_id ON public.behavior_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_session_id ON public.behavior_alerts (session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_type ON public.behavior_alerts (alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_resolved ON public.behavior_alerts (is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_severity ON public.behavior_alerts (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_alerts_patterns ON public.behavior_alerts USING GIN (detected_patterns);

-- Create behavior_metrics table for storing aggregated behavior metrics
CREATE TABLE IF NOT EXISTS public.behavior_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_period_start TIMESTAMPTZ NOT NULL,
    measurement_period_end TIMESTAMPTZ NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for behavior metrics
CREATE INDEX IF NOT EXISTS idx_behavior_metrics_user_id ON public.behavior_metrics (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_metrics_type ON public.behavior_metrics (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_behavior_metrics_period ON public.behavior_metrics (measurement_period_start, measurement_period_end);

-- Create function to update user session duration
CREATE OR REPLACE FUNCTION public.update_session_duration()
RETURNS TRIGGER AS $$
BEGIN
    -- Update session duration when activity is added
    UPDATE public.user_sessions
    SET 
        last_activity = NEW.timestamp,
        duration_minutes = EXTRACT(EPOCH FROM (NEW.timestamp - start_time)) / 60,
        updated_at = now()
    WHERE session_id = NEW.session_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update session duration
DROP TRIGGER IF EXISTS trigger_update_session_duration ON public.user_activities;
CREATE TRIGGER trigger_update_session_duration
    AFTER INSERT ON public.user_activities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_session_duration();

-- Create function to cleanup inactive sessions
CREATE OR REPLACE FUNCTION public.cleanup_inactive_sessions(
    p_timeout_minutes INTEGER DEFAULT 30
)
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_deleted_count INTEGER;
    v_cutoff_time TIMESTAMPTZ;
BEGIN
    v_cutoff_time := NOW() - (p_timeout_minutes || ' minutes')::INTERVAL;
    
    -- Mark sessions as inactive
    UPDATE public.user_sessions
    SET is_active = false, updated_at = now()
    WHERE is_active = true 
    AND last_activity < v_cutoff_time;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    RETURN v_deleted_count;
END;
$$;

-- Create function to get user behavior statistics
CREATE OR REPLACE FUNCTION public.get_user_behavior_statistics(
    p_user_id UUID DEFAULT NULL,
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
    total_activities BIGINT,
    total_sessions BIGINT,
    avg_session_duration DECIMAL(10,2),
    most_common_activity_type VARCHAR(50),
    avg_risk_score DECIMAL(5,2),
    high_risk_activities BIGINT,
    alert_count BIGINT,
    unique_devices BIGINT,
    unique_locations BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH activity_stats AS (
        SELECT 
            COUNT(*) as total_activities,
            AVG(risk_score) as avg_risk_score,
            COUNT(*) FILTER (WHERE risk_score >= 70) as high_risk_activities
        FROM public.user_activities
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND timestamp BETWEEN v_start_date AND v_end_date
    ),
    session_stats AS (
        SELECT 
            COUNT(DISTINCT session_id) as total_sessions,
            AVG(duration_minutes) as avg_session_duration
        FROM public.user_sessions
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND start_time BETWEEN v_start_date AND v_end_date
    ),
    activity_type_stats AS (
        SELECT 
            activity_type,
            COUNT(*) as activity_count
        FROM public.user_activities
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND timestamp BETWEEN v_start_date AND v_end_date
        GROUP BY activity_type
        ORDER BY activity_count DESC
        LIMIT 1
    ),
    alert_stats AS (
        SELECT 
            COUNT(*) as alert_count
        FROM public.behavior_alerts
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND created_at BETWEEN v_start_date AND v_end_date
    ),
    device_stats AS (
        SELECT 
            COUNT(DISTINCT device_fingerprint) as unique_devices
        FROM public.user_sessions
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND start_time BETWEEN v_start_date AND v_end_date
            AND device_fingerprint IS NOT NULL
    ),
    location_stats AS (
        SELECT 
            COUNT(DISTINCT location->>'country') as unique_locations
        FROM public.user_sessions
        WHERE 
            (p_user_id IS NULL OR user_id = p_user_id)
            AND start_time BETWEEN v_start_date AND v_end_date
    )
    SELECT 
        COALESCE(as.total_activities, 0) as total_activities,
        COALESCE(ss.total_sessions, 0) as total_sessions,
        COALESCE(ss.avg_session_duration, 0) as avg_session_duration,
        COALESCE(ats.activity_type, 'unknown') as most_common_activity_type,
        COALESCE(as.avg_risk_score, 0) as avg_risk_score,
        COALESCE(as.high_risk_activities, 0) as high_risk_activities,
        COALESCE(als.alert_count, 0) as alert_count,
        COALESCE(ds.unique_devices, 0) as unique_devices,
        COALESCE(ls.unique_locations, 0) as unique_locations
    FROM activity_stats as
    CROSS JOIN session_stats ss
    CROSS JOIN activity_type_stats ats
    CROSS JOIN alert_stats als
    CROSS JOIN device_stats ds
    CROSS JOIN location_stats ls;
END;
$$;

-- Create function to detect suspicious behavior patterns
CREATE OR REPLACE FUNCTION public.detect_suspicious_behavior(
    p_user_id UUID,
    p_activity_type VARCHAR(50),
    p_risk_score INTEGER,
    p_metadata JSONB DEFAULT '{}'
)
RETURNS TABLE (
    is_suspicious BOOLEAN,
    risk_factors TEXT[],
    recommendations TEXT[]
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_risk_factors TEXT[] := '{}';
    v_recommendations TEXT[] := '{}';
    v_is_suspicious BOOLEAN := false;
    v_recent_activities INTEGER;
    v_avg_risk_score DECIMAL(5,2);
    v_session_count INTEGER;
BEGIN
    -- Check recent activity frequency
    SELECT COUNT(*) INTO v_recent_activities
    FROM public.user_activities
    WHERE user_id = p_user_id
    AND activity_type = p_activity_type
    AND timestamp > NOW() - INTERVAL '1 hour';
    
    -- Check average risk score
    SELECT AVG(risk_score) INTO v_avg_risk_score
    FROM public.user_activities
    WHERE user_id = p_user_id
    AND timestamp > NOW() - INTERVAL '24 hours';
    
    -- Check active sessions
    SELECT COUNT(*) INTO v_session_count
    FROM public.user_sessions
    WHERE user_id = p_user_id
    AND is_active = true;
    
    -- Analyze risk factors
    IF p_risk_score >= 80 THEN
        v_risk_factors := array_append(v_risk_factors, 'high_risk_score');
        v_recommendations := array_append(v_recommendations, 'Immediate manual review required');
        v_is_suspicious := true;
    END IF;
    
    IF v_recent_activities > 10 THEN
        v_risk_factors := array_append(v_risk_factors, 'high_activity_frequency');
        v_recommendations := array_append(v_recommendations, 'Monitor activity frequency');
        v_is_suspicious := true;
    END IF;
    
    IF v_avg_risk_score > 60 THEN
        v_risk_factors := array_append(v_risk_factors, 'elevated_average_risk');
        v_recommendations := array_append(v_recommendations, 'Review user behavior patterns');
        v_is_suspicious := true;
    END IF;
    
    IF v_session_count > 3 THEN
        v_risk_factors := array_append(v_risk_factors, 'excessive_concurrent_sessions');
        v_recommendations := array_append(v_recommendations, 'Check for session hijacking');
        v_is_suspicious := true;
    END IF;
    
    RETURN QUERY SELECT v_is_suspicious, v_risk_factors, v_recommendations;
END;
$$;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_user_sessions_updated_at ON public.user_sessions;
CREATE TRIGGER trigger_user_sessions_updated_at
    BEFORE UPDATE ON public.user_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_behavior_profiles_updated_at ON public.behavior_profiles;
CREATE TRIGGER trigger_behavior_profiles_updated_at
    BEFORE UPDATE ON public.behavior_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_behavior_alerts_updated_at ON public.behavior_alerts;
CREATE TRIGGER trigger_behavior_alerts_updated_at
    BEFORE UPDATE ON public.behavior_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE public.user_activities IS 'User activity tracking for behavior analysis and fraud detection';
COMMENT ON TABLE public.user_sessions IS 'User session tracking with device and location information';
COMMENT ON TABLE public.behavior_profiles IS 'User behavior profiles for pattern analysis and anomaly detection';
COMMENT ON TABLE public.behavior_alerts IS 'Alerts generated from behavior analysis for suspicious activities';
COMMENT ON TABLE public.behavior_metrics IS 'Aggregated behavior metrics for analysis and reporting';

COMMENT ON FUNCTION public.update_session_duration() IS 'Automatically update session duration when activities are added';
COMMENT ON FUNCTION public.cleanup_inactive_sessions(INTEGER) IS 'Clean up inactive sessions to maintain performance';
COMMENT ON FUNCTION public.get_user_behavior_statistics(UUID, TIMESTAMPTZ, TIMESTAMPTZ) IS 'Get comprehensive user behavior statistics';
COMMENT ON FUNCTION public.detect_suspicious_behavior(UUID, VARCHAR, INTEGER, JSONB) IS 'Detect suspicious behavior patterns and provide recommendations';
