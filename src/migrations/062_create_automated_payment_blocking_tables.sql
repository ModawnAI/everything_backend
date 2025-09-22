-- Migration: Create Automated Payment Blocking Tables
-- Description: Create tables for automated payment blocking and whitelist/blacklist management
-- Version: 1.0.0
-- Created: 2024-01-15

-- Create blocking rules table
CREATE TABLE IF NOT EXISTS blocking_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('automatic', 'manual', 'scheduled')),
    conditions JSONB NOT NULL DEFAULT '[]',
    actions JSONB NOT NULL DEFAULT '[]',
    priority INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metadata JSONB NOT NULL DEFAULT '{}'
);

-- Create whitelist entries table
CREATE TABLE IF NOT EXISTS whitelist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'user', 'ip_address', 'email', 'phone', 'card_number', 'device_fingerprint'
    )),
    value VARCHAR(500) NOT NULL,
    reason TEXT NOT NULL,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}',
    UNIQUE(type, value)
);

-- Create blacklist entries table
CREATE TABLE IF NOT EXISTS blacklist_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(50) NOT NULL CHECK (type IN (
        'user', 'ip_address', 'email', 'phone', 'card_number', 'device_fingerprint', 'country', 'isp'
    )),
    value VARCHAR(500) NOT NULL,
    reason TEXT NOT NULL,
    added_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    metadata JSONB NOT NULL DEFAULT '{}',
    UNIQUE(type, value)
);

-- Create blocking events table
CREATE TABLE IF NOT EXISTS blocking_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    blocking_rule VARCHAR(255) NOT NULL,
    blocking_reason TEXT NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    actions JSONB NOT NULL DEFAULT '[]',
    is_overridden BOOLEAN NOT NULL DEFAULT FALSE,
    overridden_by UUID REFERENCES users(id) ON DELETE SET NULL,
    overridden_at TIMESTAMP WITH TIME ZONE,
    override_reason TEXT,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_at TIMESTAMP WITH TIME ZONE,
    resolution TEXT,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create blocking overrides table
CREATE TABLE IF NOT EXISTS blocking_overrides (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    blocking_event_id UUID NOT NULL REFERENCES blocking_events(id) ON DELETE CASCADE,
    overridden_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    override_reason TEXT NOT NULL,
    new_action VARCHAR(20) NOT NULL CHECK (new_action IN ('allow', 'block', 'review')),
    override_type VARCHAR(20) NOT NULL CHECK (override_type IN ('admin', 'system', 'user')),
    is_permanent BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMP WITH TIME ZONE,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_blocking_rules_type ON blocking_rules(type);
CREATE INDEX IF NOT EXISTS idx_blocking_rules_priority ON blocking_rules(priority);
CREATE INDEX IF NOT EXISTS idx_blocking_rules_is_active ON blocking_rules(is_active);
CREATE INDEX IF NOT EXISTS idx_blocking_rules_created_by ON blocking_rules(created_by);

CREATE INDEX IF NOT EXISTS idx_whitelist_entries_type ON whitelist_entries(type);
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_value ON whitelist_entries(value);
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_is_active ON whitelist_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_expires_at ON whitelist_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_whitelist_entries_added_by ON whitelist_entries(added_by);

CREATE INDEX IF NOT EXISTS idx_blacklist_entries_type ON blacklist_entries(type);
CREATE INDEX IF NOT EXISTS idx_blacklist_entries_value ON blacklist_entries(value);
CREATE INDEX IF NOT EXISTS idx_blacklist_entries_is_active ON blacklist_entries(is_active);
CREATE INDEX IF NOT EXISTS idx_blacklist_entries_severity ON blacklist_entries(severity);
CREATE INDEX IF NOT EXISTS idx_blacklist_entries_expires_at ON blacklist_entries(expires_at);
CREATE INDEX IF NOT EXISTS idx_blacklist_entries_added_by ON blacklist_entries(added_by);

CREATE INDEX IF NOT EXISTS idx_blocking_events_user_id ON blocking_events(user_id);
CREATE INDEX IF NOT EXISTS idx_blocking_events_payment_id ON blocking_events(payment_id);
CREATE INDEX IF NOT EXISTS idx_blocking_events_blocking_rule ON blocking_events(blocking_rule);
CREATE INDEX IF NOT EXISTS idx_blocking_events_severity ON blocking_events(severity);
CREATE INDEX IF NOT EXISTS idx_blocking_events_is_overridden ON blocking_events(is_overridden);
CREATE INDEX IF NOT EXISTS idx_blocking_events_is_resolved ON blocking_events(is_resolved);
CREATE INDEX IF NOT EXISTS idx_blocking_events_created_at ON blocking_events(created_at);

CREATE INDEX IF NOT EXISTS idx_blocking_overrides_blocking_event_id ON blocking_overrides(blocking_event_id);
CREATE INDEX IF NOT EXISTS idx_blocking_overrides_overridden_by ON blocking_overrides(overridden_by);
CREATE INDEX IF NOT EXISTS idx_blocking_overrides_override_type ON blocking_overrides(override_type);
CREATE INDEX IF NOT EXISTS idx_blocking_overrides_created_at ON blocking_overrides(created_at);

-- Create function to evaluate blocking conditions
CREATE OR REPLACE FUNCTION evaluate_blocking_condition(
    field_value ANYELEMENT,
    operator VARCHAR(20),
    expected_value ANYELEMENT
)
RETURNS BOOLEAN AS $$
BEGIN
    CASE operator
        WHEN 'equals' THEN
            RETURN field_value = expected_value;
        WHEN 'not_equals' THEN
            RETURN field_value != expected_value;
        WHEN 'greater_than' THEN
            RETURN field_value > expected_value;
        WHEN 'less_than' THEN
            RETURN field_value < expected_value;
        WHEN 'contains' THEN
            RETURN field_value::TEXT ILIKE '%' || expected_value::TEXT || '%';
        WHEN 'not_contains' THEN
            RETURN field_value::TEXT NOT ILIKE '%' || expected_value::TEXT || '%';
        WHEN 'in' THEN
            RETURN field_value = ANY(expected_value);
        WHEN 'not_in' THEN
            RETURN field_value != ALL(expected_value);
        WHEN 'regex' THEN
            RETURN field_value::TEXT ~ expected_value::TEXT;
        ELSE
            RETURN FALSE;
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- Create function to check whitelist
CREATE OR REPLACE FUNCTION check_whitelist(
    user_id_param UUID,
    ip_address_param INET,
    email_param VARCHAR(255),
    phone_param VARCHAR(50),
    card_number_param VARCHAR(50),
    device_fingerprint_param VARCHAR(500)
)
RETURNS TABLE (
    is_whitelisted BOOLEAN,
    entry_type VARCHAR(50),
    entry_value VARCHAR(500),
    entry_reason TEXT
) AS $$
BEGIN
    -- Check user whitelist
    RETURN QUERY
    SELECT TRUE, 'user'::VARCHAR(50), user_id_param::VARCHAR(500), we.reason
    FROM whitelist_entries we
    WHERE we.type = 'user' 
      AND we.value = user_id_param::TEXT
      AND we.is_active = TRUE
      AND (we.expires_at IS NULL OR we.expires_at > NOW())
    LIMIT 1;

    -- Check IP address whitelist
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT TRUE, 'ip_address'::VARCHAR(50), ip_address_param::VARCHAR(500), we.reason
        FROM whitelist_entries we
        WHERE we.type = 'ip_address' 
          AND we.value = ip_address_param::TEXT
          AND we.is_active = TRUE
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check email whitelist
    IF NOT FOUND AND email_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'email'::VARCHAR(50), email_param, we.reason
        FROM whitelist_entries we
        WHERE we.type = 'email' 
          AND we.value = email_param
          AND we.is_active = TRUE
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check phone whitelist
    IF NOT FOUND AND phone_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'phone'::VARCHAR(50), phone_param, we.reason
        FROM whitelist_entries we
        WHERE we.type = 'phone' 
          AND we.value = phone_param
          AND we.is_active = TRUE
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check card number whitelist
    IF NOT FOUND AND card_number_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'card_number'::VARCHAR(50), card_number_param, we.reason
        FROM whitelist_entries we
        WHERE we.type = 'card_number' 
          AND we.value = card_number_param
          AND we.is_active = TRUE
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check device fingerprint whitelist
    IF NOT FOUND AND device_fingerprint_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'device_fingerprint'::VARCHAR(50), device_fingerprint_param, we.reason
        FROM whitelist_entries we
        WHERE we.type = 'device_fingerprint' 
          AND we.value = device_fingerprint_param
          AND we.is_active = TRUE
          AND (we.expires_at IS NULL OR we.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Return false if no whitelist entry found
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE, 'none'::VARCHAR(50), ''::VARCHAR(500), ''::TEXT;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to check blacklist
CREATE OR REPLACE FUNCTION check_blacklist(
    user_id_param UUID,
    ip_address_param INET,
    email_param VARCHAR(255),
    phone_param VARCHAR(50),
    card_number_param VARCHAR(50),
    device_fingerprint_param VARCHAR(500),
    country_param VARCHAR(100),
    isp_param VARCHAR(255)
)
RETURNS TABLE (
    is_blacklisted BOOLEAN,
    entry_type VARCHAR(50),
    entry_value VARCHAR(500),
    entry_reason TEXT,
    entry_severity VARCHAR(20)
) AS $$
BEGIN
    -- Check user blacklist
    RETURN QUERY
    SELECT TRUE, 'user'::VARCHAR(50), user_id_param::VARCHAR(500), be.reason, be.severity
    FROM blacklist_entries be
    WHERE be.type = 'user' 
      AND be.value = user_id_param::TEXT
      AND be.is_active = TRUE
      AND (be.expires_at IS NULL OR be.expires_at > NOW())
    LIMIT 1;

    -- Check IP address blacklist
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT TRUE, 'ip_address'::VARCHAR(50), ip_address_param::VARCHAR(500), be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'ip_address' 
          AND be.value = ip_address_param::TEXT
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check email blacklist
    IF NOT FOUND AND email_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'email'::VARCHAR(50), email_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'email' 
          AND be.value = email_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check phone blacklist
    IF NOT FOUND AND phone_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'phone'::VARCHAR(50), phone_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'phone' 
          AND be.value = phone_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check card number blacklist
    IF NOT FOUND AND card_number_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'card_number'::VARCHAR(50), card_number_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'card_number' 
          AND be.value = card_number_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check device fingerprint blacklist
    IF NOT FOUND AND device_fingerprint_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'device_fingerprint'::VARCHAR(50), device_fingerprint_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'device_fingerprint' 
          AND be.value = device_fingerprint_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check country blacklist
    IF NOT FOUND AND country_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'country'::VARCHAR(50), country_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'country' 
          AND be.value = country_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Check ISP blacklist
    IF NOT FOUND AND isp_param IS NOT NULL THEN
        RETURN QUERY
        SELECT TRUE, 'isp'::VARCHAR(50), isp_param, be.reason, be.severity
        FROM blacklist_entries be
        WHERE be.type = 'isp' 
          AND be.value = isp_param
          AND be.is_active = TRUE
          AND (be.expires_at IS NULL OR be.expires_at > NOW())
        LIMIT 1;
    END IF;

    -- Return false if no blacklist entry found
    IF NOT FOUND THEN
        RETURN QUERY
        SELECT FALSE, 'none'::VARCHAR(50), ''::VARCHAR(500), ''::TEXT, 'low'::VARCHAR(20);
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create function to get blocking analytics
CREATE OR REPLACE FUNCTION get_blocking_analytics(
    start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '24 hours',
    end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
)
RETURNS TABLE (
    total_blocks BIGINT,
    blocks_by_severity JSONB,
    blocks_by_rule JSONB,
    override_rate NUMERIC,
    average_resolution_time NUMERIC,
    whitelist_size BIGINT,
    blacklist_size BIGINT,
    active_rules BIGINT
) AS $$
DECLARE
    total_blocks_count BIGINT;
    blocks_by_severity_json JSONB;
    blocks_by_rule_json JSONB;
    overridden_count BIGINT;
    resolved_count BIGINT;
    total_resolution_time NUMERIC;
    whitelist_count BIGINT;
    blacklist_count BIGINT;
    active_rules_count BIGINT;
BEGIN
    -- Get total blocks
    SELECT COUNT(*) INTO total_blocks_count
    FROM blocking_events
    WHERE created_at >= start_date AND created_at <= end_date;

    -- Get blocks by severity
    SELECT jsonb_object_agg(severity, count) INTO blocks_by_severity_json
    FROM (
        SELECT severity, COUNT(*) as count
        FROM blocking_events
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY severity
    ) severity_counts;

    -- Get blocks by rule
    SELECT jsonb_object_agg(blocking_rule, count) INTO blocks_by_rule_json
    FROM (
        SELECT blocking_rule, COUNT(*) as count
        FROM blocking_events
        WHERE created_at >= start_date AND created_at <= end_date
        GROUP BY blocking_rule
    ) rule_counts;

    -- Get override rate
    SELECT COUNT(*) INTO overridden_count
    FROM blocking_events
    WHERE created_at >= start_date AND created_at <= end_date
      AND is_overridden = TRUE;

    -- Get average resolution time
    SELECT COUNT(*), COALESCE(AVG(EXTRACT(EPOCH FROM (resolved_at - created_at)) / 60), 0)
    INTO resolved_count, total_resolution_time
    FROM blocking_events
    WHERE created_at >= start_date AND created_at <= end_date
      AND is_resolved = TRUE
      AND resolved_at IS NOT NULL;

    -- Get whitelist size
    SELECT COUNT(*) INTO whitelist_count
    FROM whitelist_entries
    WHERE is_active = TRUE;

    -- Get blacklist size
    SELECT COUNT(*) INTO blacklist_count
    FROM blacklist_entries
    WHERE is_active = TRUE;

    -- Get active rules count
    SELECT COUNT(*) INTO active_rules_count
    FROM blocking_rules
    WHERE is_active = TRUE;

    RETURN QUERY
    SELECT 
        total_blocks_count,
        COALESCE(blocks_by_severity_json, '{}'::JSONB),
        COALESCE(blocks_by_rule_json, '{}'::JSONB),
        CASE 
            WHEN total_blocks_count > 0 THEN (overridden_count::NUMERIC / total_blocks_count::NUMERIC) * 100
            ELSE 0
        END,
        COALESCE(total_resolution_time, 0),
        whitelist_count,
        blacklist_count,
        active_rules_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up expired entries
CREATE OR REPLACE FUNCTION cleanup_expired_blocking_entries()
RETURNS INTEGER AS $$
DECLARE
    whitelist_deleted INTEGER;
    blacklist_deleted INTEGER;
    total_deleted INTEGER;
BEGIN
    -- Clean up expired whitelist entries
    DELETE FROM whitelist_entries 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
      AND is_active = TRUE;
    
    GET DIAGNOSTICS whitelist_deleted = ROW_COUNT;

    -- Clean up expired blacklist entries
    DELETE FROM blacklist_entries 
    WHERE expires_at IS NOT NULL 
      AND expires_at < NOW()
      AND is_active = TRUE;
    
    GET DIAGNOSTICS blacklist_deleted = ROW_COUNT;

    total_deleted := whitelist_deleted + blacklist_deleted;
    
    RETURN total_deleted;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_blocking_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blocking_events_updated_at
    BEFORE UPDATE ON blocking_events
    FOR EACH ROW
    EXECUTE FUNCTION update_blocking_events_updated_at();

-- Create trigger to update blocking_rules updated_at
CREATE OR REPLACE FUNCTION update_blocking_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_blocking_rules_updated_at
    BEFORE UPDATE ON blocking_rules
    FOR EACH ROW
    EXECUTE FUNCTION update_blocking_rules_updated_at();

-- Create view for blocking events summary
CREATE OR REPLACE VIEW v_blocking_events_summary AS
SELECT 
    DATE_TRUNC('hour', be.created_at) as event_hour,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE be.severity = 'critical') as critical_events,
    COUNT(*) FILTER (WHERE be.severity = 'high') as high_events,
    COUNT(*) FILTER (WHERE be.severity = 'medium') as medium_events,
    COUNT(*) FILTER (WHERE be.severity = 'low') as low_events,
    COUNT(*) FILTER (WHERE be.is_overridden = TRUE) as overridden_events,
    COUNT(*) FILTER (WHERE be.is_resolved = TRUE) as resolved_events,
    ROUND(AVG(EXTRACT(EPOCH FROM (be.resolved_at - be.created_at)) / 60), 2) as avg_resolution_time_minutes
FROM blocking_events be
GROUP BY DATE_TRUNC('hour', be.created_at)
ORDER BY event_hour DESC;

-- Create view for blocking rules performance
CREATE OR REPLACE VIEW v_blocking_rules_performance AS
SELECT 
    br.id,
    br.name,
    br.type,
    br.priority,
    br.is_active,
    COUNT(be.id) as trigger_count,
    COUNT(be.id) FILTER (WHERE be.is_overridden = TRUE) as override_count,
    COUNT(be.id) FILTER (WHERE be.is_resolved = TRUE) as resolution_count,
    CASE 
        WHEN COUNT(be.id) > 0 THEN 
            ROUND((COUNT(be.id) FILTER (WHERE be.is_overridden = TRUE)::NUMERIC / COUNT(be.id)::NUMERIC) * 100, 2)
        ELSE 0
    END as override_rate_percentage,
    ROUND(AVG(EXTRACT(EPOCH FROM (be.resolved_at - be.created_at)) / 60), 2) as avg_resolution_time_minutes
FROM blocking_rules br
LEFT JOIN blocking_events be ON be.blocking_rule = br.id
    AND be.created_at >= NOW() - INTERVAL '7 days'
GROUP BY br.id, br.name, br.type, br.priority, br.is_active
ORDER BY trigger_count DESC;

-- Insert default blocking rules
INSERT INTO blocking_rules (name, description, type, conditions, actions, priority, created_by) VALUES
('High Risk Score Block', 'Block payments with fraud score >= 90', 'automatic', 
 '[{"field": "fraud_score", "operator": "greater_than", "value": 90}]',
 '[{"type": "block_payment", "parameters": {"reason": "High fraud score"}, "severity": "critical", "message": "Payment blocked due to high fraud score"}]',
 100, (SELECT id FROM users LIMIT 1)),

('Critical Risk Level Block', 'Block payments with critical risk level', 'automatic',
 '[{"field": "risk_level", "operator": "equals", "value": "critical"}]',
 '[{"type": "block_payment", "parameters": {"reason": "Critical risk level"}, "severity": "critical", "message": "Payment blocked due to critical risk level"}]',
 90, (SELECT id FROM users LIMIT 1)),

('High Amount Review', 'Flag high amount payments for review', 'manual',
 '[{"field": "amount", "operator": "greater_than", "value": 1000000}]',
 '[{"type": "flag_for_review", "parameters": {"reason": "High amount"}, "severity": "medium", "message": "High amount payment flagged for review"}]',
 50, (SELECT id FROM users LIMIT 1)),

('New User Verification', 'Require verification for new users', 'automatic',
 '[{"field": "user_age_days", "operator": "less_than", "value": 7}]',
 '[{"type": "require_verification", "parameters": {"reason": "New user"}, "severity": "low", "message": "Verification required for new user"}]',
 30, (SELECT id FROM users LIMIT 1))

ON CONFLICT (id) DO NOTHING;

-- Add comments
COMMENT ON TABLE blocking_rules IS 'Defines automated payment blocking rules and conditions';
COMMENT ON TABLE whitelist_entries IS 'Stores whitelisted entities that bypass blocking rules';
COMMENT ON TABLE blacklist_entries IS 'Stores blacklisted entities that are automatically blocked';
COMMENT ON TABLE blocking_events IS 'Logs all payment blocking events and decisions';
COMMENT ON TABLE blocking_overrides IS 'Tracks manual overrides of blocking decisions';

COMMENT ON FUNCTION evaluate_blocking_condition(ANYELEMENT, VARCHAR(20), ANYELEMENT) IS 'Evaluates a single blocking condition';
COMMENT ON FUNCTION check_whitelist(UUID, INET, VARCHAR(255), VARCHAR(50), VARCHAR(50), VARCHAR(500)) IS 'Checks if entity is whitelisted';
COMMENT ON FUNCTION check_blacklist(UUID, INET, VARCHAR(255), VARCHAR(50), VARCHAR(50), VARCHAR(500), VARCHAR(100), VARCHAR(255)) IS 'Checks if entity is blacklisted';
COMMENT ON FUNCTION get_blocking_analytics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Gets comprehensive blocking analytics';
COMMENT ON FUNCTION cleanup_expired_blocking_entries() IS 'Removes expired whitelist and blacklist entries';

COMMENT ON VIEW v_blocking_events_summary IS 'Hourly summary of blocking events';
COMMENT ON VIEW v_blocking_rules_performance IS 'Performance metrics for blocking rules';

