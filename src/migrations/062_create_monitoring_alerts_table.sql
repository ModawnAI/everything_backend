-- Migration: Create monitoring alerts table
-- Description: Create table to store monitoring alerts and their lifecycle
-- Version: 053
-- Date: 2024-01-22

-- Create monitoring_alerts table
CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('payment', 'system', 'security', 'business')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('critical', 'high', 'medium', 'low')),
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    metric VARCHAR(100) NOT NULL,
    threshold DECIMAL(10,2),
    current_value DECIMAL(10,2),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
    assignee VARCHAR(255),
    escalation_level INTEGER DEFAULT 1,
    actions JSONB DEFAULT '[]'::jsonb,
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_alert_id ON monitoring_alerts(alert_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type ON monitoring_alerts(type);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_severity ON monitoring_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status ON monitoring_alerts(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at ON monitoring_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_assignee ON monitoring_alerts(assignee);

-- Create composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_status_severity ON monitoring_alerts(status, severity);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_type_status ON monitoring_alerts(type, status);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_status ON monitoring_alerts(created_at, status);

-- Create monitoring_metrics_history table for historical data
CREATE TABLE IF NOT EXISTS monitoring_metrics_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for metrics history
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_timestamp ON monitoring_metrics_history(timestamp);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_type ON monitoring_metrics_history(metric_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_name ON monitoring_metrics_history(metric_name);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_type_name ON monitoring_metrics_history(metric_type, metric_name);
CREATE INDEX IF NOT EXISTS idx_monitoring_metrics_history_timestamp_type ON monitoring_metrics_history(timestamp, metric_type);

-- Create hypertable for time-series data (if TimescaleDB is available)
-- This will be ignored if TimescaleDB extension is not installed
DO $$
BEGIN
    -- Check if TimescaleDB extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'timescaledb') THEN
        -- Create hypertable for better time-series performance
        PERFORM create_hypertable('monitoring_metrics_history', 'timestamp', if_not_exists => TRUE);
        
        -- Set compression policy (compress data older than 7 days)
        PERFORM add_compression_policy('monitoring_metrics_history', INTERVAL '7 days', if_not_exists => TRUE);
        
        -- Set retention policy (keep data for 90 days)
        PERFORM add_retention_policy('monitoring_metrics_history', INTERVAL '90 days', if_not_exists => TRUE);
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- TimescaleDB not available, continue without hypertable
        NULL;
END $$;

-- Create monitoring_dashboard_widgets table for widget configurations
CREATE TABLE IF NOT EXISTS monitoring_dashboard_widgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    widget_id VARCHAR(100) UNIQUE NOT NULL,
    user_id UUID,
    type VARCHAR(50) NOT NULL CHECK (type IN ('metric', 'chart', 'table', 'alert', 'status')),
    title VARCHAR(200) NOT NULL,
    description TEXT,
    position JSONB NOT NULL DEFAULT '{}'::jsonb,
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for dashboard widgets
CREATE INDEX IF NOT EXISTS idx_monitoring_dashboard_widgets_widget_id ON monitoring_dashboard_widgets(widget_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_dashboard_widgets_user_id ON monitoring_dashboard_widgets(user_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_dashboard_widgets_type ON monitoring_dashboard_widgets(type);
CREATE INDEX IF NOT EXISTS idx_monitoring_dashboard_widgets_active ON monitoring_dashboard_widgets(is_active);

-- Create monitoring_sla_reports table for SLA tracking
CREATE TABLE IF NOT EXISTS monitoring_sla_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_date DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL CHECK (period_type IN ('day', 'week', 'month')),
    availability_target DECIMAL(5,2) NOT NULL,
    availability_actual DECIMAL(5,2) NOT NULL,
    uptime_seconds INTEGER NOT NULL,
    downtime_seconds INTEGER NOT NULL,
    incident_count INTEGER DEFAULT 0,
    response_time_target INTEGER NOT NULL,
    response_time_average INTEGER NOT NULL,
    response_time_p95 INTEGER NOT NULL,
    response_time_p99 INTEGER NOT NULL,
    success_rate_target DECIMAL(5,2) NOT NULL,
    success_rate_actual DECIMAL(5,2) NOT NULL,
    error_count INTEGER DEFAULT 0,
    mtbf_seconds INTEGER,
    mttr_seconds INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for SLA reports
CREATE INDEX IF NOT EXISTS idx_monitoring_sla_reports_date ON monitoring_sla_reports(report_date);
CREATE INDEX IF NOT EXISTS idx_monitoring_sla_reports_period ON monitoring_sla_reports(period_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_sla_reports_date_period ON monitoring_sla_reports(report_date, period_type);

-- Create unique constraint to prevent duplicate reports
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_sla_reports_unique ON monitoring_sla_reports(report_date, period_type);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_monitoring_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to tables with updated_at column
CREATE TRIGGER trigger_monitoring_alerts_updated_at
    BEFORE UPDATE ON monitoring_alerts
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_updated_at();

CREATE TRIGGER trigger_monitoring_dashboard_widgets_updated_at
    BEFORE UPDATE ON monitoring_dashboard_widgets
    FOR EACH ROW
    EXECUTE FUNCTION update_monitoring_updated_at();

-- Create function to clean up old alerts
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_alerts()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete resolved alerts older than 30 days
    DELETE FROM monitoring_alerts 
    WHERE status = 'resolved' 
    AND resolved_at < CURRENT_TIMESTAMP - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to clean up old metrics history
CREATE OR REPLACE FUNCTION cleanup_old_monitoring_metrics()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    -- Delete metrics older than 90 days (unless using TimescaleDB retention policy)
    DELETE FROM monitoring_metrics_history 
    WHERE timestamp < CURRENT_TIMESTAMP - INTERVAL '90 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to calculate SLA metrics
CREATE OR REPLACE FUNCTION calculate_sla_metrics(
    start_date TIMESTAMP WITH TIME ZONE,
    end_date TIMESTAMP WITH TIME ZONE
)
RETURNS TABLE (
    availability_actual DECIMAL(5,2),
    uptime_seconds INTEGER,
    downtime_seconds INTEGER,
    incident_count INTEGER,
    response_time_average INTEGER,
    response_time_p95 INTEGER,
    response_time_p99 INTEGER,
    success_rate_actual DECIMAL(5,2),
    error_count INTEGER
) AS $$
BEGIN
    -- This is a placeholder function that would calculate actual SLA metrics
    -- In a real implementation, this would query various system metrics tables
    
    RETURN QUERY SELECT
        99.95::DECIMAL(5,2) as availability_actual,
        86395 as uptime_seconds,
        5 as downtime_seconds,
        1 as incident_count,
        850 as response_time_average,
        1200 as response_time_p95,
        1800 as response_time_p99,
        99.7::DECIMAL(5,2) as success_rate_actual,
        15 as error_count;
END;
$$ LANGUAGE plpgsql;

-- Insert default dashboard widgets
INSERT INTO monitoring_dashboard_widgets (widget_id, type, title, description, position, config) VALUES
('payment_success_rate', 'metric', 'Payment Success Rate', 'Percentage of successful payment transactions', 
 '{"x": 0, "y": 0, "width": 3, "height": 2}'::jsonb, 
 '{"metric": "payments.successRate", "format": "percentage", "threshold": 95, "color": "green"}'::jsonb),
 
('transaction_volume', 'metric', 'Transaction Volume', 'Total transaction volume in the last hour', 
 '{"x": 3, "y": 0, "width": 3, "height": 2}'::jsonb, 
 '{"metric": "payments.totalVolume", "format": "currency", "color": "blue"}'::jsonb),
 
('response_time', 'metric', 'Response Time', 'Average API response time', 
 '{"x": 6, "y": 0, "width": 3, "height": 2}'::jsonb, 
 '{"metric": "system.responseTime", "format": "milliseconds", "threshold": 2000, "color": "orange"}'::jsonb),
 
('system_availability', 'metric', 'System Availability', 'System uptime percentage', 
 '{"x": 9, "y": 0, "width": 3, "height": 2}'::jsonb, 
 '{"metric": "system.availability", "format": "percentage", "threshold": 99.9, "color": "green"}'::jsonb),
 
('payment_trend_chart', 'chart', 'Payment Trends', 'Payment volume and success rate over time', 
 '{"x": 0, "y": 4, "width": 6, "height": 4}'::jsonb, 
 '{"chartType": "line", "metrics": ["payments.totalVolume", "payments.successRate"], "timeRange": "24h"}'::jsonb),
 
('active_alerts', 'alert', 'Active Alerts', 'Current system alerts requiring attention', 
 '{"x": 0, "y": 8, "width": 12, "height": 3}'::jsonb, 
 '{"maxAlerts": 10, "severityFilter": ["critical", "high"]}'::jsonb)
ON CONFLICT (widget_id) DO NOTHING;

-- Add comments for documentation
COMMENT ON TABLE monitoring_alerts IS 'Stores monitoring alerts and their lifecycle management';
COMMENT ON TABLE monitoring_metrics_history IS 'Historical time-series data for monitoring metrics';
COMMENT ON TABLE monitoring_dashboard_widgets IS 'Dashboard widget configurations for monitoring interface';
COMMENT ON TABLE monitoring_sla_reports IS 'Service Level Agreement reports and metrics';

COMMENT ON COLUMN monitoring_alerts.alert_id IS 'Unique identifier for the alert instance';
COMMENT ON COLUMN monitoring_alerts.escalation_level IS 'Current escalation level of the alert';
COMMENT ON COLUMN monitoring_alerts.actions IS 'JSON array of recommended actions for resolving the alert';

COMMENT ON FUNCTION cleanup_old_monitoring_alerts() IS 'Cleans up resolved alerts older than 30 days';
COMMENT ON FUNCTION cleanup_old_monitoring_metrics() IS 'Cleans up metrics history older than 90 days';
COMMENT ON FUNCTION calculate_sla_metrics(TIMESTAMP WITH TIME ZONE, TIMESTAMP WITH TIME ZONE) IS 'Calculates SLA metrics for a given time period';
