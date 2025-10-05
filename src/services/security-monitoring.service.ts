/**
 * Security Monitoring Service
 * 
 * Comprehensive security event monitoring and threat detection
 * for social authentication flows
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ipBlockingService } from './ip-blocking.service';

export interface SecurityEvent {
  id?: string;
  event_type: SecurityEventType;
  severity: SecuritySeverity;
  source_ip: string;
  user_id?: string;
  user_agent?: string;
  endpoint: string;
  provider?: string;
  details: Record<string, any>;
  timestamp: Date;
  session_id?: string;
  device_fingerprint?: string;
}

export type SecurityEventType = 
  | 'auth_success'
  | 'auth_failure' 
  | 'rate_limit_exceeded'
  | 'suspicious_activity'
  | 'bot_detection'
  | 'multiple_provider_attempts'
  | 'token_validation_failure'
  | 'token_refresh'
  | 'token_expired'
  | 'session_created'
  | 'session_invalidated'
  | 'session_terminated'
  | 'password_change'
  | 'account_lockout'
  | 'device_anomaly'
  | 'location_anomaly'
  | 'brute_force_attempt'
  | 'profile_operation_success'
  | 'profile_operation_failure'
  | 'credential_stuffing'
  | 'account_takeover_attempt'
  | 'admin_action'
  | 'admin_session_invalidation'
  | 'admin_bulk_session_invalidation'
  | 'security_policy_violation';

export type SecuritySeverity = 'low' | 'medium' | 'high' | 'critical';

export interface SecurityAlert {
  alert_id: string;
  alert_type: string;
  severity: SecuritySeverity;
  triggered_at: Date;
  source_events: string[];
  affected_ips: string[];
  description: string;
  recommendations: string[];
}

/**
 * Security Monitoring Service Implementation
 */
class SecurityMonitoringService {
  private supabase = getSupabaseClient();

  /**
   * Log security event and trigger threat detection
   */
  async logSecurityEvent(event: Omit<SecurityEvent, 'id' | 'timestamp'>): Promise<void> {
    try {
      const securityEvent: SecurityEvent = {
        ...event,
        timestamp: new Date()
      };

      // Store event in database
      const { data, error } = await this.supabase
        .from('security_events')
        .insert({
          event_type: securityEvent.event_type,
          severity: securityEvent.severity,
          source_ip: securityEvent.source_ip,
          user_id: securityEvent.user_id,
          user_agent: securityEvent.user_agent,
          endpoint: securityEvent.endpoint,
          provider: securityEvent.provider,
          details: securityEvent.details,
          timestamp: securityEvent.timestamp.toISOString(),
          session_id: securityEvent.session_id,
          device_fingerprint: securityEvent.device_fingerprint
        })
        .select('id')
        .single();

      if (error) {
        logger.error('Failed to store security event', {
          error: error.message,
          code: error.code,
          event_type: securityEvent.event_type,
          hint: error.code === 'PGRST204' ?
            'PostgREST schema cache issue. Reload schema in Supabase Dashboard: Settings → API → Reload Schema' :
            undefined
        });
        return;
      }

      securityEvent.id = data.id;

      // Log to application logger
      this.logEventToLogger(securityEvent);

      // Trigger threat detection
      await this.detectThreats(securityEvent);

    } catch (error) {
      logger.error('Failed to log security event', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        event_type: event.event_type 
      });
    }
  }

  /**
   * Log event to application logger with appropriate level
   */
  private logEventToLogger(event: SecurityEvent): void {
    const logData = {
      event_id: event.id,
      event_type: event.event_type,
      source_ip: event.source_ip,
      user_id: event.user_id,
      endpoint: event.endpoint,
      provider: event.provider,
      details: event.details
    };

    switch (event.severity) {
      case 'critical':
        logger.error(`CRITICAL SECURITY EVENT: ${event.event_type}`, logData);
        break;
      case 'high':
        logger.warn(`HIGH SECURITY EVENT: ${event.event_type}`, logData);
        break;
      case 'medium':
        logger.warn(`MEDIUM SECURITY EVENT: ${event.event_type}`, logData);
        break;
      case 'low':
        logger.info(`SECURITY EVENT: ${event.event_type}`, logData);
        break;
    }
  }

  /**
   * Detect threats based on patterns and recent events
   */
  private async detectThreats(currentEvent: SecurityEvent): Promise<void> {
    try {
      // Get recent events from same IP
      const timeWindow = new Date(Date.now() - (15 * 60 * 1000)); // 15 minutes
      
      const { data: recentEvents, error } = await this.supabase
        .from('security_events')
        .select('*')
        .eq('source_ip', currentEvent.source_ip)
        .gte('timestamp', timeWindow.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        logger.error('Failed to get recent events for threat detection', { 
          error: error.message 
        });
        return;
      }

      const events = recentEvents || [];

      // Detect rapid authentication attempts
      const authEvents = events.filter(e => 
        e.event_type === 'auth_failure' || e.event_type === 'rate_limit_exceeded'
      );

      if (authEvents.length >= 10) {
        await this.createSecurityAlert({
          alert_id: `rapid_auth_${Date.now()}`,
          alert_type: 'rapid_auth_attempts',
          severity: 'high',
          triggered_at: new Date(),
          source_events: authEvents.map(e => e.id),
          affected_ips: [currentEvent.source_ip],
          description: `Rapid authentication attempts detected from IP ${currentEvent.source_ip}`,
          recommendations: [
            'Consider blocking this IP address',
            'Review authentication logs for patterns',
            'Implement progressive delays'
          ]
        });

        // Auto-block high-threat IPs
        await ipBlockingService.recordViolation({
          ip: currentEvent.source_ip,
          timestamp: new Date(),
          violationType: 'suspicious_activity',
          endpoint: currentEvent.endpoint,
          userAgent: currentEvent.user_agent || 'unknown',
          severity: 'high',
          details: {
            threat_type: 'rapid_auth_attempts',
            event_count: authEvents.length
          }
        });
      }

      // Detect multiple provider attempts
      const providerEvents = events.filter(e => e.provider);
      const uniqueProviders = new Set(providerEvents.map(e => e.provider));

      if (uniqueProviders.size >= 3) {
        await this.createSecurityAlert({
          alert_id: `multi_provider_${Date.now()}`,
          alert_type: 'multiple_provider_attempts',
          severity: 'medium',
          triggered_at: new Date(),
          source_events: providerEvents.map(e => e.id),
          affected_ips: [currentEvent.source_ip],
          description: `Multiple social provider attempts from IP ${currentEvent.source_ip}`,
          recommendations: [
            'Monitor for credential stuffing attempts',
            'Verify legitimate user behavior',
            'Consider additional verification'
          ]
        });
      }

      // Detect bot-like behavior
      const userAgent = currentEvent.user_agent?.toLowerCase() || '';
      const botIndicators = ['curl', 'wget', 'python-requests', 'bot', 'crawler'];
      
      if (botIndicators.some(indicator => userAgent.includes(indicator))) {
        await this.createSecurityAlert({
          alert_id: `bot_detection_${Date.now()}`,
          alert_type: 'bot_detection',
          severity: 'medium',
          triggered_at: new Date(),
          source_events: [currentEvent.id!],
          affected_ips: [currentEvent.source_ip],
          description: `Bot-like user agent detected: ${currentEvent.user_agent}`,
          recommendations: [
            'Implement CAPTCHA challenges',
            'Block automated user agents',
            'Review bot detection rules'
          ]
        });
      }

    } catch (error) {
      logger.error('Failed to detect threats', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        event_id: currentEvent.id 
      });
    }
  }

  /**
   * Create and store security alert
   */
  private async createSecurityAlert(alert: SecurityAlert): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('security_alerts')
        .insert({
          alert_id: alert.alert_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          triggered_at: alert.triggered_at.toISOString(),
          source_events: alert.source_events,
          affected_ips: alert.affected_ips,
          description: alert.description,
          recommendations: alert.recommendations,
          auto_resolved: false
        });

      if (error) {
        logger.error('Failed to store security alert', { 
          error: error.message,
          alert_id: alert.alert_id 
        });
        return;
      }

      // Log critical alerts
      if (alert.severity === 'critical' || alert.severity === 'high') {
        logger.error('SECURITY THREAT DETECTED', {
          alert_id: alert.alert_id,
          alert_type: alert.alert_type,
          severity: alert.severity,
          affected_ips: alert.affected_ips
        });
      }

    } catch (error) {
      logger.error('Failed to create security alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alert_id: alert.alert_id 
      });
    }
  }

  /**
   * Get active security alerts
   */
  async getActiveAlerts(severity?: SecuritySeverity): Promise<SecurityAlert[]> {
    try {
      let query = this.supabase
        .from('security_alerts')
        .select('*')
        .eq('auto_resolved', false)
        .order('triggered_at', { ascending: false });

      if (severity) {
        query = query.eq('severity', severity);
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to get active alerts: ${error.message}`);
      }

      return data || [];

    } catch (error) {
      logger.error('Failed to get active alerts', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      return [];
    }
  }

  /**
   * Get security metrics (alias for generateDailySummary)
   */
  async getSecurityMetrics(): Promise<{
    total_events: number;
    events_by_type: Record<string, number>;
    events_by_severity: Record<string, number>;
    top_threat_ips: Array<{ ip: string; count: number }>;
    active_alerts: number;
  }> {
    return this.generateDailySummary();
  }

  /**
   * Get unresolved alerts (alias for getActiveAlerts)
   */
  async getUnresolvedAlerts(severity?: SecuritySeverity): Promise<SecurityAlert[]> {
    return this.getActiveAlerts(severity);
  }

  /**
   * Resolve security alert
   */
  async resolveSecurityAlert(alertId: string, resolvedBy?: string, resolutionNotes?: string): Promise<void> {
    try {
      const updateData: any = {
        auto_resolved: true,
        resolved_at: new Date().toISOString(),
        resolved_by: resolvedBy
      };

      if (resolutionNotes) {
        updateData.resolution_notes = resolutionNotes;
      }

      const { error } = await this.supabase
        .from('security_alerts')
        .update(updateData)
        .eq('alert_id', alertId);

      if (error) {
        throw new Error(`Failed to resolve alert: ${error.message}`);
      }

      logger.info('Security alert resolved', { 
        alert_id: alertId,
        resolved_by: resolvedBy 
      });

    } catch (error) {
      logger.error('Failed to resolve alert', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        alert_id: alertId 
      });
      throw error;
    }
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(): Promise<any> {
    try {
      const summary = await this.generateDailySummary();
      const activeAlerts = await this.getActiveAlerts();
      
      return {
        report_id: `compliance_${Date.now()}`,
        generated_at: new Date().toISOString(),
        summary,
        active_alerts: activeAlerts,
        compliance_status: activeAlerts.length === 0 ? 'compliant' : 'needs_attention',
        recommendations: activeAlerts.length > 0 ? 
          ['Review and resolve active security alerts'] : 
          ['Continue monitoring security events']
      };
    } catch (error) {
      logger.error('Failed to generate compliance report', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Generate security alert (alias for createSecurityAlert)
   */
  async generateSecurityAlert(alert: Omit<SecurityAlert, 'alert_id' | 'triggered_at'>): Promise<void> {
    const fullAlert: SecurityAlert = {
      ...alert,
      alert_id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      triggered_at: new Date()
    };
    
    return this.createSecurityAlert(fullAlert);
  }

  /**
   * Generate daily security summary
   */
  async generateDailySummary(): Promise<{
    total_events: number;
    events_by_type: Record<string, number>;
    events_by_severity: Record<string, number>;
    top_threat_ips: Array<{ ip: string; count: number }>;
    active_alerts: number;
  }> {
    try {
      const yesterday = new Date(Date.now() - (24 * 60 * 60 * 1000));
      
      const { data: events, error } = await this.supabase
        .from('security_events')
        .select('*')
        .gte('timestamp', yesterday.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        throw new Error(`Failed to get events for summary: ${error.message}`);
      }

      const eventList = events || [];

      // Aggregate statistics
      const eventsByType = eventList.reduce((acc, event) => {
        acc[event.event_type] = (acc[event.event_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsBySeverity = eventList.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Top threat IPs
      const ipCounts = eventList.reduce((acc, event) => {
        const currentCount = acc[event.source_ip] || 0;
        acc[event.source_ip] = currentCount + 1;
        return acc;
      }, {} as Record<string, number>);

      const topThreatIps = Object.entries(ipCounts)
        .map(([ip, count]) => ({ ip, count: count as number }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      // Active alerts count
      const activeAlerts = await this.getActiveAlerts();

      return {
        total_events: eventList.length,
        events_by_type: eventsByType,
        events_by_severity: eventsBySeverity,
        top_threat_ips: topThreatIps,
        active_alerts: activeAlerts.length
      };

    } catch (error) {
      logger.error('Failed to generate daily summary', { 
        error: error instanceof Error ? error.message : 'Unknown error' 
      });
      throw error;
    }
  }

  /**
   * Log authentication success event
   */
  async logAuthSuccess(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    provider?: string;
    sessionId?: string;
    deviceFingerprint?: string;
    isNewDevice?: boolean;
    location?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.logSecurityEvent({
        event_type: 'auth_success',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        provider: data.provider,
        severity: 'low',
        details: {
          sessionId: data.sessionId,
          deviceFingerprint: data.deviceFingerprint,
          isNewDevice: data.isNewDevice,
          location: data.location,
          ...data.metadata
        }
      });

      logger.info('Authentication success logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        provider: data.provider,
        isNewDevice: data.isNewDevice
      });
    } catch (error) {
      logger.error('Failed to log auth success', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log authentication failure event
   */
  async logAuthFailure(data: {
    userId?: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    provider?: string;
    reason: string;
    errorCode?: string;
    deviceFingerprint?: string;
    location?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const severity = this.determineAuthFailureSeverity(data.reason, data.errorCode);

      await this.logSecurityEvent({
        event_type: 'auth_failure',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        provider: data.provider,
        severity,
        details: {
          reason: data.reason,
          errorCode: data.errorCode,
          deviceFingerprint: data.deviceFingerprint,
          location: data.location,
          ...data.metadata
        }
      });

      logger.warn('Authentication failure logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        provider: data.provider,
        reason: data.reason,
        severity
      });
    } catch (error) {
      logger.error('Failed to log auth failure', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log token refresh event
   */
  async logTokenRefresh(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    sessionId?: string;
    deviceFingerprint?: string;
    isNewToken?: boolean;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.logSecurityEvent({
        event_type: 'token_refresh',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity: 'low',
        details: {
          sessionId: data.sessionId,
          deviceFingerprint: data.deviceFingerprint,
          isNewToken: data.isNewToken,
          ...data.metadata
        }
      });

      logger.debug('Token refresh logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        isNewToken: data.isNewToken
      });
    } catch (error) {
      logger.error('Failed to log token refresh', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log session creation event
   */
  async logSessionCreated(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    sessionId: string;
    deviceFingerprint: string;
    isNewDevice: boolean;
    deviceInfo?: any;
    location?: any;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const severity = data.isNewDevice ? 'medium' : 'low';

      await this.logSecurityEvent({
        event_type: 'session_created',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity,
        details: {
          sessionId: data.sessionId,
          deviceFingerprint: data.deviceFingerprint,
          isNewDevice: data.isNewDevice,
          deviceInfo: data.deviceInfo,
          location: data.location,
          ...data.metadata
        }
      });

      logger.info('Session creation logged', {
        userId: data.userId,
        sessionId: data.sessionId,
        isNewDevice: data.isNewDevice,
        severity
      });
    } catch (error) {
      logger.error('Failed to log session creation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log session invalidation event
   */
  async logSessionInvalidation(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    sessionId: string;
    reason: string;
    invalidatedBy?: string;
    deviceFingerprint?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const severity = this.determineSessionInvalidationSeverity(data.reason);

      await this.logSecurityEvent({
        event_type: 'session_invalidated',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity,
        details: {
          sessionId: data.sessionId,
          reason: data.reason,
          invalidatedBy: data.invalidatedBy,
          deviceFingerprint: data.deviceFingerprint,
          ...data.metadata
        }
      });

      logger.warn('Session invalidation logged', {
        userId: data.userId,
        sessionId: data.sessionId,
        reason: data.reason,
        severity
      });
    } catch (error) {
      logger.error('Failed to log session invalidation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log password change event
   */
  async logPasswordChange(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    sessionId?: string;
    deviceFingerprint?: string;
    changedBy?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.logSecurityEvent({
        event_type: 'password_change',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity: 'medium',
        details: {
          sessionId: data.sessionId,
          deviceFingerprint: data.deviceFingerprint,
          changedBy: data.changedBy,
          ...data.metadata
        }
      });

      logger.info('Password change logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        changedBy: data.changedBy
      });
    } catch (error) {
      logger.error('Failed to log password change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log brute force attempt
   */
  async logBruteForceAttempt(data: {
    userId?: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    attemptCount: number;
    timeWindow: number;
    deviceFingerprint?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      const severity = data.attemptCount > 20 ? 'critical' : data.attemptCount > 10 ? 'high' : 'medium';

      await this.logSecurityEvent({
        event_type: 'brute_force_attempt',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity,
        details: {
          attemptCount: data.attemptCount,
          timeWindow: data.timeWindow,
          deviceFingerprint: data.deviceFingerprint,
          ...data.metadata
        }
      });

      logger.warn('Brute force attempt logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        attemptCount: data.attemptCount,
        severity
      });
    } catch (error) {
      logger.error('Failed to log brute force attempt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log account takeover attempt
   */
  async logAccountTakeoverAttempt(data: {
    userId: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    indicators: string[];
    sessionId?: string;
    deviceFingerprint?: string;
    metadata?: Record<string, any>;
  }): Promise<void> {
    try {
      await this.logSecurityEvent({
        event_type: 'account_takeover_attempt',
        user_id: data.userId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity: 'critical',
        details: {
          indicators: data.indicators,
          sessionId: data.sessionId,
          deviceFingerprint: data.deviceFingerprint,
          ...data.metadata
        }
      });

      logger.error('Account takeover attempt logged', {
        userId: data.userId,
        sourceIp: data.sourceIp,
        indicators: data.indicators
      });
    } catch (error) {
      logger.error('Failed to log account takeover attempt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: data.userId
      });
    }
  }

  /**
   * Log admin action
   */
  async logAdminAction(data: {
    adminId: string;
    targetUserId?: string;
    action: string;
    sourceIp: string;
    userAgent: string;
    endpoint: string;
    details: Record<string, any>;
    severity?: SecuritySeverity;
  }): Promise<void> {
    try {
      await this.logSecurityEvent({
        event_type: 'admin_action',
        user_id: data.adminId,
        source_ip: data.sourceIp,
        user_agent: data.userAgent,
        endpoint: data.endpoint,
        severity: data.severity || 'medium',
        details: {
          targetUserId: data.targetUserId,
          action: data.action,
          ...data.details
        }
      });

      logger.info('Admin action logged', {
        adminId: data.adminId,
        targetUserId: data.targetUserId,
        action: data.action,
        severity: data.severity || 'medium'
      });
    } catch (error) {
      logger.error('Failed to log admin action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: data.adminId
      });
    }
  }

  // Helper methods
  private determineAuthFailureSeverity(reason: string, errorCode?: string): SecuritySeverity {
    if (errorCode === 'TOKEN_EXPIRED') return 'low';
    if (reason.includes('invalid') || reason.includes('malformed')) return 'medium';
    if (reason.includes('brute force') || reason.includes('rate limit')) return 'high';
    if (reason.includes('account locked') || reason.includes('suspended')) return 'critical';
    return 'medium';
  }

  private determineSessionInvalidationSeverity(reason: string): SecuritySeverity {
    if (reason.includes('user_requested') || reason.includes('logout')) return 'low';
    if (reason.includes('security_event') || reason.includes('suspicious')) return 'high';
    if (reason.includes('admin_action') || reason.includes('compromise')) return 'critical';
    return 'medium';
  }
}

// Export singleton instance
export const securityMonitoringService = new SecurityMonitoringService();
export default securityMonitoringService;