/**
 * Comprehensive Security Event Logging Service
 * 
 * Centralized security event logging that integrates all security middleware
 * and provides unified logging, monitoring, and alerting capabilities
 */

import { Request } from 'express';
import { securityMonitoringService, SecurityEventType, SecuritySeverity } from './security-monitoring.service';
import { logger } from '../utils/logger';

export interface ComprehensiveSecurityEvent {
  id?: string;
  eventType: SecurityEventType;
  severity: SecuritySeverity;
  sourceIp: string;
  userId?: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  sessionId?: string;
  deviceFingerprint?: string;
  details: Record<string, any>;
  timestamp: Date;
  middleware: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
  responseCode?: number;
  correlationId?: string;
}

export interface SecurityEventContext {
  req: Request;
  middleware: string;
  threatLevel: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  blocked?: boolean;
  responseCode?: number;
}

/**
 * Comprehensive Security Logging Service
 */
class ComprehensiveSecurityLoggingService {
  private eventBuffer: ComprehensiveSecurityEvent[] = [];
  private readonly BUFFER_SIZE = 100;
  private readonly FLUSH_INTERVAL = 30000; // 30 seconds
  private flushTimer?: NodeJS.Timeout;

  constructor() {
    this.startFlushTimer();
  }

  /**
   * Log security event from any middleware
   */
  async logSecurityEvent(context: SecurityEventContext): Promise<void> {
    try {
      const event: ComprehensiveSecurityEvent = {
        eventType: this.mapToSecurityEventType(context.middleware, context.details),
        severity: this.mapToSecuritySeverity(context.threatLevel),
        sourceIp: context.req.ip || context.req.connection.remoteAddress || 'unknown',
        userId: (context.req as any).user?.id,
        userAgent: context.req.get('User-Agent'),
        endpoint: context.req.originalUrl,
        method: context.req.method,
        sessionId: (context.req as any).session?.id,
        deviceFingerprint: (context.req as any).session?.deviceFingerprint,
        details: context.details,
        timestamp: new Date(),
        middleware: context.middleware,
        threatLevel: context.threatLevel,
        blocked: context.blocked || false,
        responseCode: context.responseCode,
        correlationId: (context.req as any).correlationId || `req_${Date.now()}`
      };

      // Add to buffer
      this.eventBuffer.push(event);

      // Log immediately for critical events
      if (context.threatLevel === 'critical') {
        await this.flushEvents();
      }

      // Log to application logger
      this.logToApplicationLogger(event);

      // Auto-flush if buffer is full
      if (this.eventBuffer.length >= this.BUFFER_SIZE) {
        await this.flushEvents();
      }

    } catch (error) {
      logger.error('Failed to log comprehensive security event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        middleware: context.middleware,
        endpoint: context.req.originalUrl
      });
    }
  }

  /**
   * Log XSS protection event
   */
  async logXSSEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
    const threatLevel = violations.some(v => v.severity === 'critical') ? 'critical' : 
                       violations.some(v => v.severity === 'high') ? 'high' : 'medium';

    await this.logSecurityEvent({
      req,
      middleware: 'xss-protection',
      threatLevel,
      details: {
        violations: violations.map(v => ({
          type: v.type,
          pattern: v.pattern,
          severity: v.severity,
          input: v.input?.substring(0, 100) // Truncate for security
        })),
        violationCount: violations.length,
        blocked
      },
      blocked,
      responseCode: blocked ? 400 : 200
    });
  }

  /**
   * Log CSRF protection event
   */
  async logCSRFEvent(req: Request, violation: any, blocked: boolean = false): Promise<void> {
    const threatLevel = violation.severity === 'critical' ? 'critical' : 
                       violation.severity === 'high' ? 'high' : 'medium';

    await this.logSecurityEvent({
      req,
      middleware: 'csrf-protection',
      threatLevel,
      details: {
        violation: {
          type: violation.type,
          reason: violation.reason,
          severity: violation.severity,
          token: violation.token ? 'present' : 'missing'
        },
        blocked
      },
      blocked,
      responseCode: blocked ? 403 : 200
    });
  }

  /**
   * Log SQL injection prevention event
   */
  async logSQLInjectionEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
    const threatLevel = violations.some(v => v.severity === 'critical') ? 'critical' : 
                       violations.some(v => v.severity === 'high') ? 'high' : 'medium';

    await this.logSecurityEvent({
      req,
      middleware: 'sql-injection-prevention',
      threatLevel,
      details: {
        violations: violations.map(v => ({
          type: v.type,
          pattern: v.pattern,
          severity: v.severity,
          input: v.input?.substring(0, 100) // Truncate for security
        })),
        violationCount: violations.length,
        blocked
      },
      blocked,
      responseCode: blocked ? 400 : 200
    });
  }

  /**
   * Log RPC security event
   */
  async logRPCSecurityEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
    const threatLevel = violations.some(v => v.severity === 'critical') ? 'critical' : 
                       violations.some(v => v.severity === 'high') ? 'high' : 'medium';

    await this.logSecurityEvent({
      req,
      middleware: 'rpc-security',
      threatLevel,
      details: {
        violations: violations.map(v => ({
          type: v.type,
          functionName: v.functionName,
          severity: v.severity,
          reason: v.reason
        })),
        violationCount: violations.length,
        blocked
      },
      blocked,
      responseCode: blocked ? 400 : 200
    });
  }

  /**
   * Log rate limiting event
   */
  async logRateLimitEvent(req: Request, details: any, blocked: boolean = false): Promise<void> {
    const threatLevel = details.severity === 'critical' ? 'critical' : 
                       details.severity === 'high' ? 'high' : 'medium';

    await this.logSecurityEvent({
      req,
      middleware: 'rate-limiting',
      threatLevel,
      details: {
        limitType: details.limitType,
        currentCount: details.currentCount,
        limit: details.limit,
        windowMs: details.windowMs,
        remaining: details.remaining,
        resetTime: details.resetTime,
        blocked
      },
      blocked,
      responseCode: blocked ? 429 : 200
    });
  }

  /**
   * Log security validation event
   */
  async logSecurityValidationEvent(req: Request, threats: string[], threatLevel: string, blocked: boolean = false): Promise<void> {
    const mappedThreatLevel = threatLevel === 'critical' ? 'critical' : 
                             threatLevel === 'high' ? 'high' : 
                             threatLevel === 'medium' ? 'medium' : 'low';

    await this.logSecurityEvent({
      req,
      middleware: 'security-validation',
      threatLevel: mappedThreatLevel,
      details: {
        threats,
        threatCount: threats.length,
        blocked
      },
      blocked,
      responseCode: blocked ? 400 : 200
    });
  }

  /**
   * Log authentication event
   */
  async logAuthEvent(req: Request, eventType: 'success' | 'failure', details: any): Promise<void> {
    const threatLevel = eventType === 'failure' ? 'medium' : 'low';

    await this.logSecurityEvent({
      req,
      middleware: 'authentication',
      threatLevel,
      details: {
        eventType,
        ...details
      },
      blocked: eventType === 'failure'
    });
  }

  /**
   * Log admin action event
   */
  async logAdminActionEvent(req: Request, action: string, targetUserId?: string, details: any = {}): Promise<void> {
    await this.logSecurityEvent({
      req,
      middleware: 'admin-actions',
      threatLevel: 'medium',
      details: {
        action,
        targetUserId,
        ...details
      }
    });
  }

  /**
   * Get security statistics
   */
  async getSecurityStatistics(timeWindow: number = 24 * 60 * 60 * 1000): Promise<{
    totalEvents: number;
    eventsByMiddleware: Record<string, number>;
    eventsByThreatLevel: Record<string, number>;
    eventsBySeverity: Record<string, number>;
    blockedEvents: number;
    topThreatIPs: Array<{ ip: string; count: number }>;
    recentEvents: ComprehensiveSecurityEvent[];
  }> {
    try {
      const since = new Date(Date.now() - timeWindow);
      const recentEvents = this.eventBuffer.filter(e => e.timestamp >= since);

      const eventsByMiddleware = recentEvents.reduce((acc, event) => {
        acc[event.middleware] = (acc[event.middleware] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsByThreatLevel = recentEvents.reduce((acc, event) => {
        acc[event.threatLevel] = (acc[event.threatLevel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const eventsBySeverity = recentEvents.reduce((acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const blockedEvents = recentEvents.filter(e => e.blocked).length;

      const ipCounts = recentEvents.reduce((acc, event) => {
        acc[event.sourceIp] = (acc[event.sourceIp] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const topThreatIPs = Object.entries(ipCounts)
        .map(([ip, count]) => ({ ip, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10);

      return {
        totalEvents: recentEvents.length,
        eventsByMiddleware,
        eventsByThreatLevel,
        eventsBySeverity,
        blockedEvents,
        topThreatIPs,
        recentEvents: recentEvents.slice(-50) // Last 50 events
      };

    } catch (error) {
      logger.error('Failed to get security statistics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Flush events to security monitoring service
   */
  private async flushEvents(): Promise<void> {
    if (this.eventBuffer.length === 0) return;

    try {
      const events = [...this.eventBuffer];
      this.eventBuffer = [];

      // Send to security monitoring service
      for (const event of events) {
        await securityMonitoringService.logSecurityEvent({
          event_type: event.eventType,
          severity: event.severity,
          source_ip: event.sourceIp,
          user_id: event.userId,
          user_agent: event.userAgent,
          endpoint: event.endpoint,
          details: {
            ...event.details,
            middleware: event.middleware,
            threatLevel: event.threatLevel,
            blocked: event.blocked,
            responseCode: event.responseCode,
            correlationId: event.correlationId
          },
          session_id: event.sessionId,
          device_fingerprint: event.deviceFingerprint
        });
      }

      logger.debug(`Flushed ${events.length} security events to monitoring service`);

    } catch (error) {
      logger.error('Failed to flush security events', {
        error: error instanceof Error ? error.message : 'Unknown error',
        eventCount: this.eventBuffer.length
      });
    }
  }

  /**
   * Start periodic flush timer
   */
  private startFlushTimer(): void {
    this.flushTimer = setInterval(() => {
      this.flushEvents().catch(error => {
        logger.error('Error in flush timer', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      });
    }, this.FLUSH_INTERVAL);
  }

  /**
   * Stop flush timer
   */
  public stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
  }

  /**
   * Map middleware to security event type
   */
  private mapToSecurityEventType(middleware: string, details: any): SecurityEventType {
    switch (middleware) {
      case 'xss-protection':
        return 'security_policy_violation';
      case 'csrf-protection':
        return 'security_policy_violation';
      case 'sql-injection-prevention':
        return 'security_policy_violation';
      case 'rpc-security':
        return 'security_policy_violation';
      case 'rate-limiting':
        return 'rate_limit_exceeded';
      case 'security-validation':
        return 'suspicious_activity';
      case 'authentication':
        return details.eventType === 'success' ? 'auth_success' : 'auth_failure';
      case 'admin-actions':
        return 'admin_action';
      default:
        return 'suspicious_activity';
    }
  }

  /**
   * Map threat level to security severity
   */
  private mapToSecuritySeverity(threatLevel: string): SecuritySeverity {
    switch (threatLevel) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      case 'low':
        return 'low';
      default:
        return 'medium';
    }
  }

  /**
   * Log to application logger
   */
  private logToApplicationLogger(event: ComprehensiveSecurityEvent): void {
    const logData = {
      eventId: event.id,
      eventType: event.eventType,
      middleware: event.middleware,
      threatLevel: event.threatLevel,
      sourceIp: event.sourceIp,
      userId: event.userId,
      endpoint: event.endpoint,
      method: event.method,
      blocked: event.blocked,
      responseCode: event.responseCode,
      correlationId: event.correlationId,
      details: event.details
    };

    switch (event.severity) {
      case 'critical':
        logger.error(`CRITICAL SECURITY EVENT [${event.middleware}]: ${event.eventType}`, logData);
        break;
      case 'high':
        logger.warn(`HIGH SECURITY EVENT [${event.middleware}]: ${event.eventType}`, logData);
        break;
      case 'medium':
        logger.warn(`MEDIUM SECURITY EVENT [${event.middleware}]: ${event.eventType}`, logData);
        break;
      case 'low':
        logger.info(`SECURITY EVENT [${event.middleware}]: ${event.eventType}`, logData);
        break;
    }
  }
}

// Export singleton instance
export const comprehensiveSecurityLoggingService = new ComprehensiveSecurityLoggingService();
export default comprehensiveSecurityLoggingService;
