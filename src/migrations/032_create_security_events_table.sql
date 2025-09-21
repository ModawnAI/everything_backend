-- Migration: Create Security Events Table
-- Description: Create table for comprehensive security event logging and monitoring

-- Create security_events table
CREATE TABLE IF NOT EXISTS public.security_events (
  id TEXT PRIMARY KEY,
  type VARCHAR(50) NOT NULL,
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  ip INET NOT NULL,
  user_agent TEXT,
  endpoint TEXT NOT NULL,
  details JSONB,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked BOOLEAN DEFAULT FALSE,
  reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip);
CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_blocked ON public.security_events(blocked);
CREATE INDEX IF NOT EXISTS idx_security_events_endpoint ON public.security_events(endpoint);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_security_events_ip_timestamp ON public.security_events(ip, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_user_timestamp ON public.security_events(user_id, timestamp);
CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events(type, severity);
CREATE INDEX IF NOT EXISTS idx_security_events_ip_type ON public.security_events(ip, type);

-- Create GIN index for JSONB details field
CREATE INDEX IF NOT EXISTS idx_security_events_details ON public.security_events USING GIN(details);

-- Create function to clean up old security events
CREATE OR REPLACE FUNCTION cleanup_old_security_events()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  -- Delete events older than 90 days
  DELETE FROM public.security_events
  WHERE timestamp < NOW() - INTERVAL '90 days';
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  -- Log cleanup operation
  INSERT INTO public.security_events (
    id,
    type,
    severity,
    ip,
    endpoint,
    details,
    timestamp
  ) VALUES (
    'cleanup_' || EXTRACT(EPOCH FROM NOW())::TEXT,
    'cleanup',
    'low',
    '127.0.0.1'::INET,
    '/admin/cleanup',
    jsonb_build_object(
      'deleted_count', deleted_count,
      'cleanup_date', NOW()
    ),
    NOW()
  );
  
  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get security metrics
CREATE OR REPLACE FUNCTION get_security_metrics(
  p_time_range INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE(
  total_events BIGINT,
  blocked_events BIGINT,
  unique_ips BIGINT,
  high_severity_events BIGINT,
  critical_events BIGINT,
  top_threats JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_events,
    COUNT(DISTINCT ip) as unique_ips,
    COUNT(*) FILTER (WHERE severity = 'high') as high_severity_events,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
    jsonb_agg(
      jsonb_build_object(
        'type', threat_type,
        'count', threat_count,
        'severity', threat_severity
      ) ORDER BY threat_count DESC
    ) as top_threats
  FROM (
    SELECT 
      type as threat_type,
      severity as threat_severity,
      COUNT(*) as threat_count
    FROM public.security_events
    WHERE timestamp >= NOW() - p_time_range
    GROUP BY type, severity
    ORDER BY threat_count DESC
    LIMIT 10
  ) threat_stats;
END;
$$ LANGUAGE plpgsql;

-- Create function to detect suspicious IPs
CREATE OR REPLACE FUNCTION detect_suspicious_ips(
  p_time_window INTERVAL DEFAULT INTERVAL '1 hour',
  p_threshold INTEGER DEFAULT 10
)
RETURNS TABLE(
  ip INET,
  event_count BIGINT,
  severity_distribution JSONB,
  last_activity TIMESTAMPTZ,
  suspicious_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.ip,
    COUNT(*) as event_count,
    jsonb_object_agg(se.severity, severity_count) as severity_distribution,
    MAX(se.timestamp) as last_activity,
    CASE 
      WHEN COUNT(*) > p_threshold * 2 THEN 100
      WHEN COUNT(*) > p_threshold THEN 75
      WHEN COUNT(*) > p_threshold / 2 THEN 50
      ELSE 25
    END as suspicious_score
  FROM public.security_events se
  JOIN (
    SELECT 
      ip,
      severity,
      COUNT(*) as severity_count
    FROM public.security_events
    WHERE timestamp >= NOW() - p_time_window
    GROUP BY ip, severity
  ) severity_stats ON se.ip = severity_stats.ip
  WHERE se.timestamp >= NOW() - p_time_window
  GROUP BY se.ip
  HAVING COUNT(*) > p_threshold
  ORDER BY suspicious_score DESC, event_count DESC;
END;
$$ LANGUAGE plpgsql;

-- Create function to get IP reputation
CREATE OR REPLACE FUNCTION get_ip_reputation(p_ip INET)
RETURNS TABLE(
  ip INET,
  total_events BIGINT,
  blocked_events BIGINT,
  severity_breakdown JSONB,
  first_seen TIMESTAMPTZ,
  last_seen TIMESTAMPTZ,
  reputation_score INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    se.ip,
    COUNT(*) as total_events,
    COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_events,
    jsonb_object_agg(se.severity, severity_count) as severity_breakdown,
    MIN(se.timestamp) as first_seen,
    MAX(se.timestamp) as last_seen,
    CASE 
      WHEN COUNT(*) FILTER (WHERE severity = 'critical') > 0 THEN 0
      WHEN COUNT(*) FILTER (WHERE severity = 'high') > 5 THEN 25
      WHEN COUNT(*) FILTER (WHERE severity = 'high') > 0 THEN 50
      WHEN COUNT(*) FILTER (WHERE severity = 'medium') > 10 THEN 75
      ELSE 100
    END as reputation_score
  FROM public.security_events se
  JOIN (
    SELECT 
      ip,
      severity,
      COUNT(*) as severity_count
    FROM public.security_events
    WHERE ip = p_ip
    GROUP BY ip, severity
  ) severity_stats ON se.ip = severity_stats.ip
  WHERE se.ip = p_ip
  GROUP BY se.ip;
END;
$$ LANGUAGE plpgsql;

-- Create RLS policies for security events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own security events
CREATE POLICY "Users can view their own security events" ON public.security_events
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy for admins to see all security events
CREATE POLICY "Admins can view all security events" ON public.security_events
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'admin'
    )
  );

-- Policy for system to insert security events
CREATE POLICY "System can insert security events" ON public.security_events
  FOR INSERT
  WITH CHECK (true);

-- Add comments for documentation
COMMENT ON TABLE public.security_events IS 'Comprehensive security event logging and monitoring';
COMMENT ON COLUMN public.security_events.id IS 'Unique identifier for the security event';
COMMENT ON COLUMN public.security_events.type IS 'Type of security event (upload, download, delete, update, access, etc.)';
COMMENT ON COLUMN public.security_events.severity IS 'Severity level of the event (low, medium, high, critical)';
COMMENT ON COLUMN public.security_events.user_id IS 'User ID associated with the event (if applicable)';
COMMENT ON COLUMN public.security_events.ip IS 'IP address from which the event originated';
COMMENT ON COLUMN public.security_events.user_agent IS 'User agent string from the request';
COMMENT ON COLUMN public.security_events.endpoint IS 'API endpoint that was accessed';
COMMENT ON COLUMN public.security_events.details IS 'Additional details about the event in JSON format';
COMMENT ON COLUMN public.security_events.timestamp IS 'When the event occurred';
COMMENT ON COLUMN public.security_events.blocked IS 'Whether the request was blocked due to this event';
COMMENT ON COLUMN public.security_events.reason IS 'Reason for blocking (if applicable)';

-- Create a view for security dashboard
CREATE OR REPLACE VIEW security_dashboard AS
SELECT 
  DATE_TRUNC('hour', timestamp) as hour,
  type,
  severity,
  COUNT(*) as event_count,
  COUNT(DISTINCT ip) as unique_ips,
  COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_count
FROM public.security_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp), type, severity
ORDER BY hour DESC, event_count DESC;

-- Grant permissions
GRANT SELECT ON public.security_events TO authenticated;
GRANT ALL ON public.security_events TO service_role;
GRANT SELECT ON public.security_dashboard TO authenticated;
GRANT ALL ON public.security_dashboard TO service_role;
