import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { refreshTokenService } from '../services/refresh-token.service';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { ipBlockingService } from '../services/ip-blocking.service';
import { logger } from '../utils/logger';

/**
 * Security Event Detection Middleware
 * Automatically detects security events and triggers session invalidation
 */

interface SecurityEventContext {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  requestId: string;
  sessionId?: string;
}

interface SecurityTrigger {
  eventType: 'password_change' | 'account_compromise' | 'admin_action' | 'suspicious_activity' | 'failed_login_threshold' | 'location_anomaly' | 'device_anomaly' | 'token_theft_detected';
  severity: 'low' | 'medium' | 'high' | 'critical';
  autoTriggered: boolean;
  metadata?: any;
}

/**
 * Middleware to detect and respond to security events
 */
export const securityEventDetection = () => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const context: SecurityEventContext = {
        userId: req.user?.id,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] || 'unknown',
        endpoint: req.originalUrl,
        requestId: req.headers['x-request-id'] as string || `req_${Date.now()}`,
        sessionId: req.headers['x-session-id'] as string
      };

      // Store context for later use in response handlers
      req.securityContext = context;

      // Check for immediate security triggers
      const triggers = await detectSecurityTriggers(req, context);

      // Process any detected triggers
      for (const trigger of triggers) {
        await processSecurityTrigger(trigger, context);
      }

      next();
    } catch (error) {
      logger.error('Security event detection middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.originalUrl,
        userId: req.user?.id
      });
      next(); // Continue processing even if security detection fails
    }
  };
};

/**
 * Detect security triggers based on request context
 */
async function detectSecurityTriggers(req: Request, context: SecurityEventContext): Promise<SecurityTrigger[]> {
  const triggers: SecurityTrigger[] = [];

  try {
    // 1. Check for suspicious IP activity
    if (context.userId) {
      const ipViolations = await ipBlockingService.getViolationHistory(context.ipAddress);
      if (ipViolations.length > 5) {
        triggers.push({
          eventType: 'suspicious_activity',
          severity: 'high',
          autoTriggered: true,
          metadata: {
            ipAddress: context.ipAddress,
            violationCount: ipViolations.length,
            reason: 'excessive_ip_violations'
          }
        });
      }
    }

    // 2. Check for location anomalies (simplified - would use geo-IP in production)
    if (context.userId && req.headers['cf-ipcountry']) {
      const userCountry = req.headers['cf-ipcountry'] as string;
      const isAnomalousLocation = await checkLocationAnomaly(context.userId, userCountry);
      
      if (isAnomalousLocation) {
        triggers.push({
          eventType: 'location_anomaly',
          severity: 'medium',
          autoTriggered: true,
          metadata: {
            suspiciousLocations: [userCountry],
            ipAddress: context.ipAddress,
            reason: 'unusual_geographic_login'
          }
        });
      }
    }

    // 3. Check for device anomalies
    if (context.userId && context.userAgent) {
      const isAnomalousDevice = await checkDeviceAnomaly(context.userId, context.userAgent);
      
      if (isAnomalousDevice) {
        triggers.push({
          eventType: 'device_anomaly',
          severity: 'medium',
          autoTriggered: true,
          metadata: {
            userAgent: context.userAgent,
            ipAddress: context.ipAddress,
            reason: 'unusual_device_signature'
          }
        });
      }
    }

    // 4. Check for concurrent session anomalies
    if (context.userId) {
      const sessionAnalytics = await refreshTokenService.getUserSessionAnalytics(context.userId);
      if (sessionAnalytics.activeSessions > 10) { // More than 10 active sessions
        triggers.push({
          eventType: 'suspicious_activity',
          severity: 'high',
          autoTriggered: true,
          metadata: {
            activeSessionCount: sessionAnalytics.activeSessions,
            reason: 'excessive_concurrent_sessions'
          }
        });
      }
    }

    // 5. Check for rapid authentication attempts (handled by rate limiting, but double-check)
    if (context.endpoint.includes('/auth/') && context.userId) {
      const recentAttempts = await getRecentAuthAttempts(context.userId, context.ipAddress);
      if (recentAttempts > 15) { // More than 15 attempts in last hour
        triggers.push({
          eventType: 'failed_login_threshold',
          severity: 'high',
          autoTriggered: true,
          metadata: {
            attemptCount: recentAttempts,
            preserveMobileSessions: true,
            reason: 'excessive_auth_attempts'
          }
        });
      }
    }

  } catch (error) {
    logger.error('Error detecting security triggers', {
      error: error instanceof Error ? error.message : 'Unknown error',
      context
    });
  }

  return triggers;
}

/**
 * Process a detected security trigger
 */
async function processSecurityTrigger(trigger: SecurityTrigger, context: SecurityEventContext): Promise<void> {
  try {
    if (!context.userId) {
      logger.warn('Security trigger detected but no user ID available', { trigger, context });
      return;
    }

    logger.warn('Processing security trigger', {
      eventType: trigger.eventType,
      severity: trigger.severity,
      userId: context.userId,
      autoTriggered: trigger.autoTriggered
    });

    // Determine session invalidation strategy based on trigger type and severity
    const shouldInvalidateSessions = ['high', 'critical'].includes(trigger.severity) ||
                                   ['account_compromise', 'token_theft_detected', 'suspicious_activity'].includes(trigger.eventType);

    if (shouldInvalidateSessions) {
      // Invalidate sessions with intelligent filtering
      const result = await refreshTokenService.invalidateSessionsOnSecurityEvent(
        context.userId,
        trigger.eventType,
        true, // Keep current session for most cases
        context.sessionId,
        {
          ...trigger.metadata,
          severity: trigger.severity,
          autoTriggered: trigger.autoTriggered,
          ipAddress: context.ipAddress,
          userAgent: context.userAgent
        }
      );

      logger.warn('Sessions invalidated due to security trigger', {
        userId: context.userId,
        eventType: trigger.eventType,
        invalidatedCount: result.invalidatedCount,
        failedCount: result.failedCount,
        securityEventId: result.securityEventId,
        notificationSent: result.notificationSent
      });

      // Log security event for monitoring
        await securityMonitoringService.logSecurityEvent({
        event_type: 'session_invalidated',
        user_id: context.userId,
        source_ip: context.ipAddress,
        user_agent: context.userAgent,
        endpoint: context.endpoint,
        severity: trigger.severity,
        details: {
          trigger: trigger.eventType,
          autoTriggered: trigger.autoTriggered,
          sessionsInvalidated: result.invalidatedCount,
          securityEventId: result.securityEventId
        }
      });
    }

    // For critical events, also block the IP temporarily
    if (trigger.severity === 'critical') {
      await ipBlockingService.recordViolation({
        ip: context.ipAddress,
        timestamp: new Date(),
        violationType: 'suspicious_activity',
        endpoint: context.endpoint,
        userAgent: context.userAgent,
        severity: 'high',
        details: {
          securityTrigger: trigger.eventType,
          autoTriggered: true
        }
      });
    }

  } catch (error) {
    logger.error('Failed to process security trigger', {
      error: error instanceof Error ? error.message : 'Unknown error',
      trigger,
      context
    });
  }
}

/**
 * Check if the login location is anomalous for the user
 */
async function checkLocationAnomaly(userId: string, country: string): Promise<boolean> {
  try {
    // This would check against user's historical login locations
    // For now, implement a simple check
    const suspiciousCountries = ['CN', 'RU', 'KP']; // Example suspicious countries
    return suspiciousCountries.includes(country);
  } catch (error) {
    logger.debug('Error checking location anomaly', { error, userId, country });
    return false;
  }
}

/**
 * Check if the device signature is anomalous for the user
 */
async function checkDeviceAnomaly(userId: string, userAgent: string): Promise<boolean> {
  try {
    // This would analyze device fingerprints and user patterns
    // For now, implement a simple check for suspicious user agents
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i
    ];
    
    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  } catch (error) {
    logger.debug('Error checking device anomaly', { error, userId, userAgent });
    return false;
  }
}

/**
 * Get recent authentication attempts for user/IP combination
 */
async function getRecentAuthAttempts(userId: string, ipAddress: string): Promise<number> {
  try {
    // This would query authentication logs
    // For now, return a mock value
    return 0;
  } catch (error) {
    logger.debug('Error getting recent auth attempts', { error, userId, ipAddress });
    return 0;
  }
}

/**
 * Response handler to detect post-request security events
 */
export const securityEventResponseHandler = () => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    // Store original send method
    const originalSend = res.send;

    // Override send method to detect security events in responses
    res.send = function(body: any) {
      // Check response for security indicators
      if (res.statusCode === 401 || res.statusCode === 403) {
        // Potential authentication/authorization failure
        handleAuthFailure(req, res);
      }

      // Call original send method
      return originalSend.call(this, body);
    };

    next();
  };
};

/**
 * Handle authentication failures
 */
async function handleAuthFailure(req: Request, res: Response): Promise<void> {
  try {
    const context = req.securityContext;
    if (!context) return;

    // Log authentication failure
    logger.warn('Authentication failure detected', {
      userId: context.userId,
      ipAddress: context.ipAddress,
      endpoint: context.endpoint,
      statusCode: res.statusCode
    });

    // Record violation for potential IP blocking
    await ipBlockingService.recordViolation({
      ip: context.ipAddress,
      timestamp: new Date(),
        violationType: 'suspicious_activity',
      endpoint: context.endpoint,
      userAgent: context.userAgent,
      severity: 'medium',
      details: {
        statusCode: res.statusCode,
        endpoint: context.endpoint
      }
    });

  } catch (error) {
    logger.error('Error handling auth failure', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      securityContext?: SecurityEventContext;
    }
  }
}
