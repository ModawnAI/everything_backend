-- Migration: Create Geographic Anomaly Detection Tables
-- Description: Create tables for IP-based geographic anomaly detection and monitoring
-- Version: 1.0.0
-- Created: 2024-01-15

-- Create geographic alerts table
CREATE TABLE IF NOT EXISTS geographic_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN (
        'geographic_anomaly', 'impossible_travel', 'high_risk_location', 'vpn_detection'
    )),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    location JSONB NOT NULL,
    anomaly_details JSONB NOT NULL DEFAULT '[]',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create geolocation cache table
CREATE TABLE IF NOT EXISTS geolocation_cache (
    ip_address INET PRIMARY KEY,
    country VARCHAR(100) NOT NULL,
    country_code VARCHAR(2) NOT NULL,
    region VARCHAR(100) NOT NULL,
    region_code VARCHAR(10) NOT NULL,
    city VARCHAR(100) NOT NULL,
    latitude DECIMAL(10, 8) NOT NULL,
    longitude DECIMAL(11, 8) NOT NULL,
    timezone VARCHAR(50) NOT NULL,
    is_vpn BOOLEAN NOT NULL DEFAULT FALSE,
    is_proxy BOOLEAN NOT NULL DEFAULT FALSE,
    is_tor BOOLEAN NOT NULL DEFAULT FALSE,
    isp VARCHAR(255) NOT NULL,
    organization VARCHAR(255) NOT NULL,
    asn VARCHAR(50) NOT NULL,
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    confidence INTEGER NOT NULL DEFAULT 0 CHECK (confidence >= 0 AND confidence <= 100),
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
);

-- Create country risk profiles table
CREATE TABLE IF NOT EXISTS country_risk_profiles (
    country_code VARCHAR(2) PRIMARY KEY,
    country_name VARCHAR(100) NOT NULL,
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    risk_score INTEGER NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
    factors JSONB NOT NULL DEFAULT '[]',
    is_blocked BOOLEAN NOT NULL DEFAULT FALSE,
    requires_verification BOOLEAN NOT NULL DEFAULT FALSE,
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create user geographic profiles table
CREATE TABLE IF NOT EXISTS user_geographic_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    primary_location JSONB NOT NULL,
    travel_patterns JSONB NOT NULL DEFAULT '{}',
    risk_indicators JSONB NOT NULL DEFAULT '{}',
    last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    profile_version VARCHAR(20) NOT NULL DEFAULT '1.0.0'
);

-- Create geographic analysis events table
CREATE TABLE IF NOT EXISTS geographic_analysis_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    ip_address INET NOT NULL,
    geolocation_data JSONB NOT NULL,
    analysis_result JSONB NOT NULL,
    anomaly_score INTEGER NOT NULL DEFAULT 0 CHECK (anomaly_score >= 0 AND anomaly_score <= 100),
    risk_level VARCHAR(20) NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
    detected_anomalies JSONB NOT NULL DEFAULT '[]',
    travel_analysis JSONB NOT NULL DEFAULT '{}',
    recommendations TEXT[] NOT NULL DEFAULT '{}',
    analysis_time INTEGER NOT NULL DEFAULT 0, -- in milliseconds
    data_source VARCHAR(50) NOT NULL DEFAULT 'ip-api',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_user_id ON geographic_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_payment_id ON geographic_alerts(payment_id);
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_alert_type ON geographic_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_severity ON geographic_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_created_at ON geographic_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_geographic_alerts_is_resolved ON geographic_alerts(is_resolved);

CREATE INDEX IF NOT EXISTS idx_geolocation_cache_expires_at ON geolocation_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_geolocation_cache_country_code ON geolocation_cache(country_code);
CREATE INDEX IF NOT EXISTS idx_geolocation_cache_risk_score ON geolocation_cache(risk_score);

CREATE INDEX IF NOT EXISTS idx_country_risk_profiles_risk_level ON country_risk_profiles(risk_level);
CREATE INDEX IF NOT EXISTS idx_country_risk_profiles_is_blocked ON country_risk_profiles(is_blocked);
CREATE INDEX IF NOT EXISTS idx_country_risk_profiles_requires_verification ON country_risk_profiles(requires_verification);

CREATE INDEX IF NOT EXISTS idx_user_geographic_profiles_last_updated ON user_geographic_profiles(last_updated);

CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_user_id ON geographic_analysis_events(user_id);
CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_payment_id ON geographic_analysis_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_ip_address ON geographic_analysis_events(ip_address);
CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_anomaly_score ON geographic_analysis_events(anomaly_score);
CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_risk_level ON geographic_analysis_events(risk_level);
CREATE INDEX IF NOT EXISTS idx_geographic_analysis_events_created_at ON geographic_analysis_events(created_at);

-- Create function to clean up expired geolocation cache entries
CREATE OR REPLACE FUNCTION cleanup_expired_geolocation_cache()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM geolocation_cache 
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get country risk profile
CREATE OR REPLACE FUNCTION get_country_risk_profile(country_code_param VARCHAR(2))
RETURNS TABLE (
    country_code VARCHAR(2),
    country_name VARCHAR(100),
    risk_level VARCHAR(20),
    risk_score INTEGER,
    is_blocked BOOLEAN,
    requires_verification BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        crp.country_code,
        crp.country_name,
        crp.risk_level,
        crp.risk_score,
        crp.is_blocked,
        crp.requires_verification
    FROM country_risk_profiles crp
    WHERE crp.country_code = country_code_param;
    
    -- If no profile found, return default
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT 
            country_code_param::VARCHAR(2),
            'Unknown'::VARCHAR(100),
            'medium'::VARCHAR(20),
            50::INTEGER,
            FALSE::BOOLEAN,
            TRUE::BOOLEAN;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to update user geographic profile
CREATE OR REPLACE FUNCTION update_user_geographic_profile(
    user_id_param UUID,
    primary_location_param JSONB,
    travel_patterns_param JSONB DEFAULT '{}',
    risk_indicators_param JSONB DEFAULT '{}',
    profile_version_param VARCHAR(20) DEFAULT '1.0.0'
)
RETURNS VOID AS $$
BEGIN
    INSERT INTO user_geographic_profiles (
        user_id,
        primary_location,
        travel_patterns,
        risk_indicators,
        last_updated,
        profile_version
    ) VALUES (
        user_id_param,
        primary_location_param,
        travel_patterns_param,
        risk_indicators_param,
        NOW(),
        profile_version_param
    )
    ON CONFLICT (user_id) DO UPDATE SET
        primary_location = EXCLUDED.primary_location,
        travel_patterns = EXCLUDED.travel_patterns,
        risk_indicators = EXCLUDED.risk_indicators,
        last_updated = EXCLUDED.last_updated,
        profile_version = EXCLUDED.profile_version;
END;
$$ LANGUAGE plpgsql;

-- Create function to log geographic analysis event
CREATE OR REPLACE FUNCTION log_geographic_analysis_event(
    user_id_param UUID,
    payment_id_param UUID,
    ip_address_param INET,
    geolocation_data_param JSONB,
    analysis_result_param JSONB,
    anomaly_score_param INTEGER,
    risk_level_param VARCHAR(20),
    detected_anomalies_param JSONB DEFAULT '[]',
    travel_analysis_param JSONB DEFAULT '{}',
    recommendations_param TEXT[] DEFAULT '{}',
    analysis_time_param INTEGER DEFAULT 0,
    data_source_param VARCHAR(50) DEFAULT 'ip-api'
)
RETURNS UUID AS $$
DECLARE
    event_id UUID;
BEGIN
    INSERT INTO geographic_analysis_events (
        user_id,
        payment_id,
        ip_address,
        geolocation_data,
        analysis_result,
        anomaly_score,
        risk_level,
        detected_anomalies,
        travel_analysis,
        recommendations,
        analysis_time,
        data_source
    ) VALUES (
        user_id_param,
        payment_id_param,
        ip_address_param,
        geolocation_data_param,
        analysis_result_param,
        anomaly_score_param,
        risk_level_param,
        detected_anomalies_param,
        travel_analysis_param,
        recommendations_param,
        analysis_time_param,
        data_source_param
    )
    RETURNING id INTO event_id;
    
    RETURN event_id;
END;
$$ LANGUAGE plpgsql;

-- Create function to get geographic analysis statistics
CREATE OR REPLACE FUNCTION get_geographic_analysis_stats(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    total_analyses BIGINT,
    high_risk_analyses BIGINT,
    critical_analyses BIGINT,
    vpn_detections BIGINT,
    proxy_detections BIGINT,
    impossible_travel_detections BIGINT,
    new_country_detections BIGINT,
    high_risk_country_detections BIGINT,
    average_anomaly_score NUMERIC,
    average_analysis_time NUMERIC
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_analyses,
        COUNT(*) FILTER (WHERE risk_level = 'high') as high_risk_analyses,
        COUNT(*) FILTER (WHERE risk_level = 'critical') as critical_analyses,
        COUNT(*) FILTER (WHERE detected_anomalies::text LIKE '%vpn_proxy%') as vpn_detections,
        COUNT(*) FILTER (WHERE detected_anomalies::text LIKE '%proxy%') as proxy_detections,
        COUNT(*) FILTER (WHERE detected_anomalies::text LIKE '%impossible_travel%') as impossible_travel_detections,
        COUNT(*) FILTER (WHERE detected_anomalies::text LIKE '%new_country%') as new_country_detections,
        COUNT(*) FILTER (WHERE detected_anomalies::text LIKE '%high_risk_country%') as high_risk_country_detections,
        ROUND(AVG(anomaly_score), 2) as average_anomaly_score,
        ROUND(AVG(analysis_time), 2) as average_analysis_time
    FROM geographic_analysis_events
    WHERE created_at >= start_date AND created_at <= end_date;
END;
$$ LANGUAGE plpgsql;

-- Create function to get user geographic risk score
CREATE OR REPLACE FUNCTION get_user_geographic_risk_score(user_id_param UUID)
RETURNS TABLE (
    user_id UUID,
    risk_score INTEGER,
    risk_level VARCHAR(20),
    primary_country VARCHAR(100),
    travel_frequency NUMERIC,
    vpn_usage_ratio NUMERIC,
    new_location_risk INTEGER,
    last_analysis TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ugp.user_id,
        COALESCE(
            (ugp.risk_indicators->>'newLocationRisk')::INTEGER,
            50
        ) as risk_score,
        CASE 
            WHEN (ugp.risk_indicators->>'newLocationRisk')::INTEGER >= 80 THEN 'critical'
            WHEN (ugp.risk_indicators->>'newLocationRisk')::INTEGER >= 60 THEN 'high'
            WHEN (ugp.risk_indicators->>'newLocationRisk')::INTEGER >= 40 THEN 'medium'
            ELSE 'low'
        END as risk_level,
        ugp.primary_location->>'country' as primary_country,
        COALESCE(
            (ugp.travel_patterns->>'travelFrequency')::NUMERIC,
            0
        ) as travel_frequency,
        COALESCE(
            (ugp.risk_indicators->>'vpnUsage')::NUMERIC,
            0
        ) as vpn_usage_ratio,
        COALESCE(
            (ugp.risk_indicators->>'newLocationRisk')::INTEGER,
            50
        ) as new_location_risk,
        ugp.last_updated as last_analysis
    FROM user_geographic_profiles ugp
    WHERE ugp.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- Insert default country risk profiles
INSERT INTO country_risk_profiles (country_code, country_name, risk_level, risk_score, is_blocked, requires_verification) VALUES
('KR', 'South Korea', 'low', 10, FALSE, FALSE),
('US', 'United States', 'low', 15, FALSE, FALSE),
('JP', 'Japan', 'low', 12, FALSE, FALSE),
('SG', 'Singapore', 'low', 8, FALSE, FALSE),
('CA', 'Canada', 'low', 18, FALSE, FALSE),
('AU', 'Australia', 'low', 20, FALSE, FALSE),
('GB', 'United Kingdom', 'low', 22, FALSE, FALSE),
('DE', 'Germany', 'low', 25, FALSE, FALSE),
('FR', 'France', 'low', 28, FALSE, FALSE),
('IT', 'Italy', 'low', 30, FALSE, FALSE),
('ES', 'Spain', 'low', 32, FALSE, FALSE),
('NL', 'Netherlands', 'low', 15, FALSE, FALSE),
('SE', 'Sweden', 'low', 12, FALSE, FALSE),
('NO', 'Norway', 'low', 10, FALSE, FALSE),
('DK', 'Denmark', 'low', 8, FALSE, FALSE),
('FI', 'Finland', 'low', 10, FALSE, FALSE),
('CH', 'Switzerland', 'low', 15, FALSE, FALSE),
('AT', 'Austria', 'low', 18, FALSE, FALSE),
('BE', 'Belgium', 'low', 20, FALSE, FALSE),
('IE', 'Ireland', 'low', 22, FALSE, FALSE),
('CN', 'China', 'medium', 45, FALSE, TRUE),
('RU', 'Russia', 'high', 75, FALSE, TRUE),
('IN', 'India', 'medium', 40, FALSE, TRUE),
('BR', 'Brazil', 'medium', 50, FALSE, TRUE),
('MX', 'Mexico', 'medium', 55, FALSE, TRUE),
('AR', 'Argentina', 'medium', 60, FALSE, TRUE),
('ZA', 'South Africa', 'medium', 65, FALSE, TRUE),
('NG', 'Nigeria', 'high', 80, FALSE, TRUE),
('XX', 'Unknown/Blocked', 'critical', 100, TRUE, TRUE)
ON CONFLICT (country_code) DO NOTHING;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_geographic_alerts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_geographic_alerts_updated_at
    BEFORE UPDATE ON geographic_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_geographic_alerts_updated_at();

-- Create trigger to clean up expired geolocation cache
CREATE OR REPLACE FUNCTION trigger_cleanup_expired_geolocation_cache()
RETURNS TRIGGER AS $$
BEGIN
    -- Clean up expired entries when new ones are inserted
    PERFORM cleanup_expired_geolocation_cache();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cleanup_expired_geolocation_cache
    AFTER INSERT ON geolocation_cache
    FOR EACH ROW
    EXECUTE FUNCTION trigger_cleanup_expired_geolocation_cache();

-- Create view for geographic analysis summary
CREATE OR REPLACE VIEW v_geographic_analysis_summary AS
SELECT 
    DATE_TRUNC('hour', gae.created_at) as analysis_hour,
    COUNT(*) as total_analyses,
    COUNT(*) FILTER (WHERE gae.risk_level = 'critical') as critical_analyses,
    COUNT(*) FILTER (WHERE gae.risk_level = 'high') as high_risk_analyses,
    COUNT(*) FILTER (WHERE gae.risk_level = 'medium') as medium_risk_analyses,
    COUNT(*) FILTER (WHERE gae.risk_level = 'low') as low_risk_analyses,
    ROUND(AVG(gae.anomaly_score), 2) as avg_anomaly_score,
    ROUND(AVG(gae.analysis_time), 2) as avg_analysis_time,
    COUNT(DISTINCT gae.user_id) as unique_users,
    COUNT(DISTINCT gae.ip_address) as unique_ips
FROM geographic_analysis_events gae
GROUP BY DATE_TRUNC('hour', gae.created_at)
ORDER BY analysis_hour DESC;

-- Create view for country risk analysis
CREATE OR REPLACE VIEW v_country_risk_analysis AS
SELECT 
    crp.country_code,
    crp.country_name,
    crp.risk_level,
    crp.risk_score,
    crp.is_blocked,
    crp.requires_verification,
    COUNT(gae.id) as analysis_count,
    ROUND(AVG(gae.anomaly_score), 2) as avg_anomaly_score,
    COUNT(*) FILTER (WHERE gae.risk_level = 'critical') as critical_count,
    COUNT(*) FILTER (WHERE gae.risk_level = 'high') as high_risk_count
FROM country_risk_profiles crp
LEFT JOIN geographic_analysis_events gae ON gae.geolocation_data->>'countryCode' = crp.country_code
    AND gae.created_at >= NOW() - INTERVAL '7 days'
GROUP BY crp.country_code, crp.country_name, crp.risk_level, crp.risk_score, crp.is_blocked, crp.requires_verification
ORDER BY crp.risk_score DESC, analysis_count DESC;

-- Add comments
COMMENT ON TABLE geographic_alerts IS 'Stores geographic anomaly alerts and security events';
COMMENT ON TABLE geolocation_cache IS 'Caches IP geolocation data to reduce API calls';
COMMENT ON TABLE country_risk_profiles IS 'Defines risk profiles for different countries';
COMMENT ON TABLE user_geographic_profiles IS 'Stores user geographic behavior profiles';
COMMENT ON TABLE geographic_analysis_events IS 'Logs all geographic analysis events and results';

COMMENT ON FUNCTION cleanup_expired_geolocation_cache() IS 'Removes expired geolocation cache entries';
COMMENT ON FUNCTION get_country_risk_profile(VARCHAR(2)) IS 'Gets risk profile for a specific country';
COMMENT ON FUNCTION update_user_geographic_profile(UUID, JSONB, JSONB, JSONB, VARCHAR(20)) IS 'Updates user geographic profile';
COMMENT ON FUNCTION log_geographic_analysis_event(UUID, UUID, INET, JSONB, JSONB, INTEGER, VARCHAR(20), JSONB, JSONB, TEXT[], INTEGER, VARCHAR(50)) IS 'Logs a geographic analysis event';
COMMENT ON FUNCTION get_geographic_analysis_stats(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Gets geographic analysis statistics for a time period';
COMMENT ON FUNCTION get_user_geographic_risk_score(UUID) IS 'Gets geographic risk score for a user';

COMMENT ON VIEW v_geographic_analysis_summary IS 'Hourly summary of geographic analysis events';
COMMENT ON VIEW v_country_risk_analysis IS 'Country-wise risk analysis and statistics';

