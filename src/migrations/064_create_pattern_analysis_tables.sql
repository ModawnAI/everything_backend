-- Pattern Analysis Tables Migration
-- Creates tables for real-time payment pattern analysis and ML-based fraud detection

-- Create pattern_analysis_models table for storing ML models
CREATE TABLE IF NOT EXISTS public.pattern_analysis_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    version VARCHAR(50) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('statistical', 'ml', 'hybrid')),
    parameters JSONB NOT NULL DEFAULT '{}',
    accuracy DECIMAL(5,4) NOT NULL DEFAULT 0.8000,
    last_trained TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    performance JSONB NOT NULL DEFAULT '{
        "precision": 0.8,
        "recall": 0.8,
        "f1Score": 0.8,
        "falsePositiveRate": 0.1
    }',
    training_data_size INTEGER DEFAULT 0,
    model_file_path TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for pattern analysis models
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_models_type ON public.pattern_analysis_models (type, is_active);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_models_accuracy ON public.pattern_analysis_models (accuracy DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_models_active ON public.pattern_analysis_models (is_active, last_trained DESC);

-- Create pattern_analysis_logs table for storing analysis results
CREATE TABLE IF NOT EXISTS public.pattern_analysis_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_id VARCHAR(255) NOT NULL,
    amount INTEGER NOT NULL,
    anomaly_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    confidence DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    is_anomaly BOOLEAN NOT NULL DEFAULT false,
    detected_patterns TEXT[] NOT NULL DEFAULT '{}',
    risk_factors JSONB NOT NULL DEFAULT '[]',
    model_version VARCHAR(50) NOT NULL,
    analysis_time_ms INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for pattern analysis logs
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_logs_user_id ON public.pattern_analysis_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_logs_payment_id ON public.pattern_analysis_logs (payment_id);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_logs_anomaly ON public.pattern_analysis_logs (is_anomaly, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_logs_score ON public.pattern_analysis_logs (anomaly_score DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_logs_patterns ON public.pattern_analysis_logs USING GIN (detected_patterns);

-- Create user_payment_profiles table for storing user behavior profiles
CREATE TABLE IF NOT EXISTS public.user_payment_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    profile_data JSONB NOT NULL DEFAULT '{}',
    profile_version VARCHAR(50) NOT NULL DEFAULT '1.0.0',
    last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for user payment profiles
CREATE INDEX IF NOT EXISTS idx_user_payment_profiles_user_id ON public.user_payment_profiles (user_id);
CREATE INDEX IF NOT EXISTS idx_user_payment_profiles_active ON public.user_payment_profiles (is_active, last_updated DESC);
CREATE INDEX IF NOT EXISTS idx_user_payment_profiles_version ON public.user_payment_profiles (profile_version);

-- Create pattern_analysis_alerts table for storing pattern-based alerts
CREATE TABLE IF NOT EXISTS public.pattern_analysis_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_id VARCHAR(255),
    alert_type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    anomaly_score DECIMAL(5,2) NOT NULL DEFAULT 0.00,
    detected_patterns TEXT[] NOT NULL DEFAULT '{}',
    risk_factors JSONB NOT NULL DEFAULT '[]',
    is_resolved BOOLEAN NOT NULL DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_notes TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for pattern analysis alerts
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_alerts_user_id ON public.pattern_analysis_alerts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_alerts_type ON public.pattern_analysis_alerts (alert_type, severity);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_alerts_resolved ON public.pattern_analysis_alerts (is_resolved, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_alerts_severity ON public.pattern_analysis_alerts (severity, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_alerts_patterns ON public.pattern_analysis_alerts USING GIN (detected_patterns);

-- Create pattern_analysis_metrics table for storing performance metrics
CREATE TABLE IF NOT EXISTS public.pattern_analysis_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_id UUID REFERENCES public.pattern_analysis_models(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL,
    metric_value DECIMAL(10,4) NOT NULL,
    measurement_period_start TIMESTAMPTZ NOT NULL,
    measurement_period_end TIMESTAMPTZ NOT NULL,
    sample_size INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for pattern analysis metrics
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_metrics_model_id ON public.pattern_analysis_metrics (model_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_metrics_type ON public.pattern_analysis_metrics (metric_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_metrics_period ON public.pattern_analysis_metrics (measurement_period_start, measurement_period_end);

-- Create function to update user payment profile
CREATE OR REPLACE FUNCTION public.update_user_payment_profile(
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
    FROM public.user_payment_profiles
    WHERE user_id = p_user_id AND is_active = true;
    
    -- If no existing profile, create default
    IF v_existing_profile IS NULL THEN
        v_existing_profile := '{
            "averageAmount": 0,
            "medianAmount": 0,
            "amountStdDev": 0,
            "preferredPaymentMethods": [],
            "timePatterns": {
                "mostActiveHour": 12,
                "mostActiveDay": 1,
                "weekendActivity": 0.3
            },
            "locationPatterns": {
                "primaryCountry": "unknown",
                "primaryRegion": "unknown",
                "travelFrequency": 0,
                "newLocationRisk": 50
            },
            "devicePatterns": {
                "primaryDevice": "unknown",
                "deviceStability": 0,
                "newDeviceRisk": 50
            },
            "behavioralPatterns": {
                "sessionDuration": {"average": 30, "stdDev": 15},
                "paymentFrequency": {"average": 1, "stdDev": 0.5},
                "amountConsistency": 0.5
            }
        }';
    END IF;
    
    -- Update profile with new payment data (simplified update)
    v_updated_profile := v_existing_profile;
    v_updated_profile := jsonb_set(v_updated_profile, '{lastPayment}', p_payment_data);
    v_updated_profile := jsonb_set(v_updated_profile, '{lastUpdated}', to_jsonb(now()));
    
    -- Upsert profile
    INSERT INTO public.user_payment_profiles (user_id, profile_data, last_updated)
    VALUES (p_user_id, v_updated_profile, now())
    ON CONFLICT (user_id) 
    DO UPDATE SET 
        profile_data = v_updated_profile,
        last_updated = now(),
        updated_at = now();
END;
$$;

-- Create function to get pattern analysis statistics
CREATE OR REPLACE FUNCTION public.get_pattern_analysis_statistics(
    p_start_date TIMESTAMPTZ DEFAULT NULL,
    p_end_date TIMESTAMPTZ DEFAULT NULL,
    p_user_id UUID DEFAULT NULL
)
RETURNS TABLE (
    total_analyses BIGINT,
    anomaly_count BIGINT,
    anomaly_rate DECIMAL(5,2),
    avg_anomaly_score DECIMAL(5,2),
    avg_confidence DECIMAL(5,2),
    most_common_patterns TEXT[],
    risk_factor_distribution JSONB,
    model_performance JSONB
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_start_date TIMESTAMPTZ := COALESCE(p_start_date, NOW() - INTERVAL '30 days');
    v_end_date TIMESTAMPTZ := COALESCE(p_end_date, NOW());
BEGIN
    RETURN QUERY
    WITH analysis_stats AS (
        SELECT 
            COUNT(*) as total_analyses,
            COUNT(*) FILTER (WHERE is_anomaly = true) as anomaly_count,
            AVG(anomaly_score) as avg_anomaly_score,
            AVG(confidence) as avg_confidence
        FROM public.pattern_analysis_logs
        WHERE 
            created_at BETWEEN v_start_date AND v_end_date
            AND (p_user_id IS NULL OR user_id = p_user_id)
    ),
    pattern_stats AS (
        SELECT 
            array_agg(pattern ORDER BY pattern_count DESC) as most_common_patterns
        FROM (
            SELECT 
                unnest(detected_patterns) as pattern,
                COUNT(*) as pattern_count
            FROM public.pattern_analysis_logs
            WHERE 
                created_at BETWEEN v_start_date AND v_end_date
                AND (p_user_id IS NULL OR user_id = p_user_id)
                AND array_length(detected_patterns, 1) > 0
            GROUP BY unnest(detected_patterns)
            ORDER BY pattern_count DESC
            LIMIT 10
        ) pattern_counts
    ),
    risk_factor_stats AS (
        SELECT 
            jsonb_object_agg(factor, factor_count) as risk_factor_distribution
        FROM (
            SELECT 
                (jsonb_array_elements(risk_factors)->>'factor') as factor,
                COUNT(*) as factor_count
            FROM public.pattern_analysis_logs
            WHERE 
                created_at BETWEEN v_start_date AND v_end_date
                AND (p_user_id IS NULL OR user_id = p_user_id)
                AND jsonb_array_length(risk_factors) > 0
            GROUP BY (jsonb_array_elements(risk_factors)->>'factor')
        ) risk_counts
    ),
    model_perf AS (
        SELECT 
            jsonb_object_agg(model_version, model_stats) as model_performance
        FROM (
            SELECT 
                model_version,
                jsonb_build_object(
                    'total_analyses', COUNT(*),
                    'avg_anomaly_score', AVG(anomaly_score),
                    'avg_confidence', AVG(confidence),
                    'anomaly_rate', ROUND(
                        (COUNT(*) FILTER (WHERE is_anomaly = true)::DECIMAL / COUNT(*)) * 100, 
                        2
                    )
                ) as model_stats
            FROM public.pattern_analysis_logs
            WHERE 
                created_at BETWEEN v_start_date AND v_end_date
                AND (p_user_id IS NULL OR user_id = p_user_id)
            GROUP BY model_version
        ) model_stats
    )
    SELECT 
        COALESCE(as.total_analyses, 0) as total_analyses,
        COALESCE(as.anomaly_count, 0) as anomaly_count,
        CASE 
            WHEN as.total_analyses > 0 
            THEN ROUND((as.anomaly_count::DECIMAL / as.total_analyses) * 100, 2)
            ELSE 0
        END as anomaly_rate,
        COALESCE(as.avg_anomaly_score, 0) as avg_anomaly_score,
        COALESCE(as.avg_confidence, 0) as avg_confidence,
        COALESCE(ps.most_common_patterns, ARRAY[]::TEXT[]) as most_common_patterns,
        COALESCE(rfs.risk_factor_distribution, '{}'::JSONB) as risk_factor_distribution,
        COALESCE(mp.model_performance, '{}'::JSONB) as model_performance
    FROM analysis_stats as
    CROSS JOIN pattern_stats ps
    CROSS JOIN risk_factor_stats rfs
    CROSS JOIN model_perf mp;
END;
$$;

-- Create function to cleanup old pattern analysis data
CREATE OR REPLACE FUNCTION public.cleanup_pattern_analysis_data(
    p_retention_days INTEGER DEFAULT 90
)
RETURNS TABLE (
    logs_deleted BIGINT,
    alerts_deleted BIGINT,
    metrics_deleted BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_cutoff_date TIMESTAMPTZ;
    v_logs_deleted BIGINT;
    v_alerts_deleted BIGINT;
    v_metrics_deleted BIGINT;
BEGIN
    v_cutoff_date := NOW() - (p_retention_days || ' days')::INTERVAL;
    
    -- Delete old analysis logs
    DELETE FROM public.pattern_analysis_logs
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_logs_deleted = ROW_COUNT;
    
    -- Delete old resolved alerts
    DELETE FROM public.pattern_analysis_alerts
    WHERE created_at < v_cutoff_date 
    AND is_resolved = true;
    GET DIAGNOSTICS v_alerts_deleted = ROW_COUNT;
    
    -- Delete old metrics
    DELETE FROM public.pattern_analysis_metrics
    WHERE created_at < v_cutoff_date;
    GET DIAGNOSTICS v_metrics_deleted = ROW_COUNT;
    
    RETURN QUERY SELECT v_logs_deleted, v_alerts_deleted, v_metrics_deleted;
END;
$$;

-- Create triggers for updated_at columns
DROP TRIGGER IF EXISTS trigger_pattern_analysis_models_updated_at ON public.pattern_analysis_models;
CREATE TRIGGER trigger_pattern_analysis_models_updated_at
    BEFORE UPDATE ON public.pattern_analysis_models
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_payment_profiles_updated_at ON public.user_payment_profiles;
CREATE TRIGGER trigger_user_payment_profiles_updated_at
    BEFORE UPDATE ON public.user_payment_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_pattern_analysis_alerts_updated_at ON public.pattern_analysis_alerts;
CREATE TRIGGER trigger_pattern_analysis_alerts_updated_at
    BEFORE UPDATE ON public.pattern_analysis_alerts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default pattern analysis models
INSERT INTO public.pattern_analysis_models (name, version, type, parameters, accuracy, performance) VALUES
('Statistical Analysis Model', '1.0.0', 'statistical', '{}', 0.75, '{
    "precision": 0.75,
    "recall": 0.70,
    "f1Score": 0.72,
    "falsePositiveRate": 0.15
}'),
('Hybrid Analysis Model', '1.0.0', 'hybrid', '{
    "statisticalWeight": 0.6,
    "mlWeight": 0.4
}', 0.85, '{
    "precision": 0.85,
    "recall": 0.80,
    "f1Score": 0.82,
    "falsePositiveRate": 0.10
}'),
('Machine Learning Model', '1.0.0', 'ml', '{
    "algorithm": "isolation_forest",
    "contamination": 0.1,
    "n_estimators": 100
}', 0.90, '{
    "precision": 0.90,
    "recall": 0.85,
    "f1Score": 0.87,
    "falsePositiveRate": 0.05
}')
ON CONFLICT DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE public.pattern_analysis_models IS 'Machine learning models for payment pattern analysis and fraud detection';
COMMENT ON TABLE public.pattern_analysis_logs IS 'Logs of real-time pattern analysis results for each payment';
COMMENT ON TABLE public.user_payment_profiles IS 'User behavior profiles for pattern analysis and anomaly detection';
COMMENT ON TABLE public.pattern_analysis_alerts IS 'Alerts generated from pattern analysis for suspicious activities';
COMMENT ON TABLE public.pattern_analysis_metrics IS 'Performance metrics for pattern analysis models';

COMMENT ON FUNCTION public.update_user_payment_profile(UUID, JSONB) IS 'Update user payment profile with new payment data';
COMMENT ON FUNCTION public.get_pattern_analysis_statistics(TIMESTAMPTZ, TIMESTAMPTZ, UUID) IS 'Get comprehensive statistics for pattern analysis system';
COMMENT ON FUNCTION public.cleanup_pattern_analysis_data(INTEGER) IS 'Clean up old pattern analysis data to maintain performance';
