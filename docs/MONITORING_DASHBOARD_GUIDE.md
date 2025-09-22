# Production Monitoring Dashboard Guide

## Overview

The Production Monitoring Dashboard provides comprehensive real-time monitoring and alerting capabilities for the payment system and overall application health. It includes metrics collection, alert management, SLA tracking, and real-time notifications.

## Architecture

### Components

1. **MonitoringDashboardService** - Core service for metrics collection and alert management
2. **MonitoringDashboardController** - REST API endpoints for dashboard data
3. **MonitoringWebSocketService** - Real-time WebSocket updates
4. **Database Tables** - Persistent storage for alerts, metrics, and SLA data
5. **Frontend Dashboard** - React-based monitoring interface

### Data Flow

```
Metrics Collection → Alert Processing → WebSocket Broadcasting → Frontend Display
                  ↓
              Database Storage → SLA Reporting → Historical Analysis
```

## Features

### Real-Time Metrics

- **Payment Metrics**
  - Transaction success rate
  - Transaction volume and TPS
  - Average transaction value
  - Failed transaction analysis

- **System Metrics**
  - API response times
  - System availability
  - Resource usage (CPU, Memory, Disk)
  - Active connections

- **Security Metrics**
  - Fraud attempt detection
  - Blocked transactions
  - Security alerts
  - Suspicious activity monitoring

- **Business Metrics**
  - Revenue tracking
  - Points earned/redeemed
  - Refund amounts
  - Chargeback monitoring

### Alert Management

#### Alert Types
- **Payment Alerts**: Low success rates, high failure rates
- **System Alerts**: High response times, resource exhaustion
- **Security Alerts**: Fraud detection, security breaches
- **Business Alerts**: Revenue anomalies, SLA violations

#### Alert Severities
- **Critical**: Immediate action required (< 5 min response)
- **High**: Action required within 15 minutes
- **Medium**: Action required within 1 hour
- **Low**: Informational, action within 24 hours

#### Alert Lifecycle
1. **Detection** - Automated threshold monitoring
2. **Creation** - Alert generated and stored
3. **Notification** - Slack/Email notifications sent
4. **Acknowledgment** - Team member takes ownership
5. **Resolution** - Issue resolved and documented
6. **Post-mortem** - Analysis and prevention measures

### SLA Monitoring

#### Availability Targets
- **System Availability**: 99.9% uptime
- **Payment Success Rate**: 99.5%
- **API Response Time**: < 1 second average

#### Reporting Periods
- **Daily**: 24-hour rolling window
- **Weekly**: 7-day analysis
- **Monthly**: 30-day comprehensive report

## API Endpoints

### Metrics
```http
GET /api/monitoring/metrics
```
Returns current real-time metrics for all system components.

### Alerts
```http
GET /api/monitoring/alerts?severity=critical&type=payment&limit=50
POST /api/monitoring/alerts/{alertId}/acknowledge
POST /api/monitoring/alerts/{alertId}/resolve
```

### Dashboard Widgets
```http
GET /api/monitoring/widgets
```
Returns dashboard widget configuration and layout.

### SLA Reports
```http
GET /api/monitoring/sla?period=day
```

### System Health
```http
GET /api/monitoring/health
```

### Metrics History
```http
GET /api/monitoring/metrics/history?timeRange=24h&granularity=5m
```

### Data Export
```http
GET /api/monitoring/export?format=json&period=day
```

## WebSocket Events

### Client Events
- `subscribe_metrics` - Subscribe to real-time metrics
- `subscribe_alerts` - Subscribe to alert notifications
- `acknowledge_alert` - Acknowledge an alert
- `resolve_alert` - Resolve an alert

### Server Events
- `metrics_update` - Real-time metrics data
- `alert_created` - New alert notification
- `alert_updated` - Alert status change
- `system_status_change` - System health change

## Database Schema

### monitoring_alerts
```sql
CREATE TABLE monitoring_alerts (
    id UUID PRIMARY KEY,
    alert_id VARCHAR(255) UNIQUE NOT NULL,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT NOT NULL,
    metric VARCHAR(100) NOT NULL,
    threshold DECIMAL(10,2),
    current_value DECIMAL(10,2),
    status VARCHAR(20) DEFAULT 'active',
    assignee VARCHAR(255),
    escalation_level INTEGER DEFAULT 1,
    actions JSONB DEFAULT '[]',
    resolution TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE
);
```

### monitoring_metrics_history
```sql
CREATE TABLE monitoring_metrics_history (
    id UUID PRIMARY KEY,
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL,
    metric_type VARCHAR(50) NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    value DECIMAL(15,4) NOT NULL,
    metadata JSONB DEFAULT '{}'
);
```

### monitoring_sla_reports
```sql
CREATE TABLE monitoring_sla_reports (
    id UUID PRIMARY KEY,
    report_date DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL,
    availability_target DECIMAL(5,2) NOT NULL,
    availability_actual DECIMAL(5,2) NOT NULL,
    uptime_seconds INTEGER NOT NULL,
    downtime_seconds INTEGER NOT NULL,
    response_time_average INTEGER NOT NULL,
    success_rate_actual DECIMAL(5,2) NOT NULL
);
```

## Configuration

### Alert Thresholds
```typescript
const config = {
  alertThresholds: {
    paymentSuccessRate: 95, // 95%
    responseTime: 2000, // 2 seconds
    errorRate: 5, // 5%
    fraudRate: 1, // 1%
    systemLoad: 80 // 80%
  },
  slaTargets: {
    availability: 99.9, // 99.9%
    responseTime: 1000, // 1 second
    paymentSuccessRate: 99.5 // 99.5%
  }
};
```

### WebSocket Configuration
```typescript
const socketConfig = {
  path: '/socket.io/monitoring',
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
};
```

## Frontend Integration

### React Component Usage
```tsx
import { MonitoringDashboard } from './components/MonitoringDashboard';

function App() {
  return (
    <div className="app">
      <MonitoringDashboard />
    </div>
  );
}
```

### WebSocket Connection
```typescript
const socket = io('/socket.io/monitoring', {
  auth: { token: authToken }
});

socket.emit('subscribe_metrics', {
  metrics: ['payments.successRate', 'system.responseTime'],
  interval: 30000
});

socket.on('metrics_update', (data) => {
  updateDashboard(data.metrics);
});
```

## Deployment

### Environment Variables
```bash
# Monitoring Configuration
MONITORING_REFRESH_INTERVAL=30000
MONITORING_ALERT_RETENTION_DAYS=30
MONITORING_METRICS_RETENTION_DAYS=90

# Notification Settings
SLACK_WEBHOOK_URL=https://hooks.slack.com/...
MONITORING_EMAIL_RECIPIENTS=ops-team@company.com

# WebSocket Settings
WEBSOCKET_MONITORING_PATH=/socket.io/monitoring
```

### Docker Configuration
```dockerfile
# Monitoring dashboard requires WebSocket support
EXPOSE 3000
EXPOSE 3001

# Health check for monitoring service
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/api/monitoring/health || exit 1
```

## Monitoring Best Practices

### Alert Management
1. **Acknowledge alerts promptly** - Within SLA timeframes
2. **Document resolutions** - Include root cause and prevention measures
3. **Review alert thresholds** - Adjust based on system behavior
4. **Escalate critical alerts** - Follow escalation procedures

### Dashboard Usage
1. **Monitor key metrics** - Focus on business-critical indicators
2. **Use historical data** - Identify trends and patterns
3. **Set up custom views** - Tailor dashboard to team needs
4. **Export reports** - Regular SLA and performance reporting

### Performance Optimization
1. **Limit WebSocket subscriptions** - Only subscribe to needed metrics
2. **Use appropriate intervals** - Balance real-time needs with performance
3. **Archive old data** - Regular cleanup of historical metrics
4. **Monitor dashboard performance** - Ensure monitoring doesn't impact system

## Troubleshooting

### Common Issues

#### WebSocket Connection Failures
```bash
# Check WebSocket endpoint
curl -I http://localhost:3000/socket.io/monitoring

# Verify authentication
# Check browser console for auth errors
```

#### Missing Metrics
```bash
# Check service health
curl http://localhost:3000/api/monitoring/health

# Verify database connection
# Check logs for metric collection errors
```

#### Alert Notification Failures
```bash
# Test Slack webhook
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"Test alert"}' \
  $SLACK_WEBHOOK_URL

# Check email configuration
# Verify SMTP settings
```

### Performance Issues
```bash
# Check database performance
SELECT COUNT(*) FROM monitoring_metrics_history 
WHERE timestamp > NOW() - INTERVAL '24 hours';

# Monitor WebSocket connections
# Check memory usage of monitoring service
```

## Security Considerations

### Authentication
- All monitoring endpoints require authentication
- WebSocket connections use JWT token validation
- Role-based access control for sensitive operations

### Data Protection
- Sensitive metrics are masked in logs
- Alert data includes only necessary information
- Historical data is encrypted at rest

### Network Security
- WebSocket connections use secure protocols
- API endpoints are rate-limited
- CORS policies restrict access origins

## Maintenance

### Regular Tasks
1. **Weekly**: Review alert thresholds and adjust as needed
2. **Monthly**: Generate and review SLA reports
3. **Quarterly**: Analyze historical trends and optimize
4. **Annually**: Review and update monitoring strategy

### Data Cleanup
```sql
-- Clean up old alerts (automated)
SELECT cleanup_old_monitoring_alerts();

-- Clean up old metrics (automated)
SELECT cleanup_old_monitoring_metrics();
```

### Backup and Recovery
- Monitoring data is included in regular database backups
- Alert configurations are version controlled
- Dashboard configurations are exportable

## Integration with External Tools

### Slack Integration
```typescript
await notificationService.sendSlackNotification({
  channel: '#monitoring-alerts',
  message: alertMessage,
  severity: 'critical'
});
```

### Email Notifications
```typescript
await notificationService.sendEmailNotification({
  to: ['ops-team@company.com'],
  subject: 'Critical Alert',
  body: alertDetails,
  priority: 'high'
});
```

### Third-party Monitoring
- Metrics can be exported to external monitoring systems
- API endpoints support integration with monitoring tools
- WebSocket events can trigger external workflows

## Support and Contact

For issues with the monitoring dashboard:
1. Check this documentation
2. Review application logs
3. Contact the development team
4. Create an issue in the project repository

---

*This guide covers the complete monitoring dashboard implementation. For specific technical details, refer to the source code and inline documentation.*

