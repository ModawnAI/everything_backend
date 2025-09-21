/**
 * Security Event Logging Middleware
 * 
 * Centralized middleware for logging security events from all security middleware
 */

import { Request, Response, NextFunction } from 'express';
import { comprehensiveSecurityLoggingService } from '../services/comprehensive-security-logging.service';
import { logger } from '../utils/logger';

/**
 * Security event logging middleware
 * This should be placed after all security middleware to capture their events
 */
export function securityEventLoggingMiddleware() {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Store original response methods
    const originalJson = res.json.bind(res);
    const originalStatus = res.status.bind(res);
    const originalSend = res.send.bind(res);

    // Track response details
    let responseCode = 200;
    let responseSent = false;

    // Override response methods to capture security events
    res.status = function(code: number) {
      responseCode = code;
      return originalStatus(code);
    };

    res.json = function(obj: any) {
      if (!responseSent) {
        responseSent = true;
        logSecurityResponse(req, res, responseCode, obj);
      }
      return originalJson(obj);
    };

    res.send = function(data: any) {
      if (!responseSent) {
        responseSent = true;
        logSecurityResponse(req, res, responseCode, data);
      }
      return originalSend(data);
    };

    // Log request start
    logSecurityRequest(req);

    next();
  };
}

/**
 * Log security request
 */
function logSecurityRequest(req: Request): void {
  try {
    const securityContext = {
      method: req.method,
      url: req.originalUrl,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id,
      deviceFingerprint: (req as any).session?.deviceFingerprint,
      headers: sanitizeHeaders(req.headers),
      query: sanitizeQuery(req.query),
      body: sanitizeBody(req.body),
      timestamp: new Date()
    };

    logger.debug('Security request logged', securityContext);

  } catch (error) {
    logger.error('Failed to log security request', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log security response
 */
function logSecurityResponse(req: Request, res: Response, statusCode: number, responseData: any): void {
  try {
    const securityContext = {
      method: req.method,
      url: req.originalUrl,
      statusCode,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      userId: (req as any).user?.id,
      sessionId: (req as any).session?.id,
      deviceFingerprint: (req as any).session?.deviceFingerprint,
      responseTime: Date.now() - (req as any).startTime,
      responseData: sanitizeResponseData(responseData),
      timestamp: new Date()
    };

    // Log based on status code
    if (statusCode >= 400) {
      logger.warn('Security response error', securityContext);
    } else {
      logger.debug('Security response logged', securityContext);
    }

  } catch (error) {
    logger.error('Failed to log security response', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl,
      statusCode
    });
  }
}

/**
 * Sanitize headers for logging
 */
function sanitizeHeaders(headers: any): any {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
    'x-session-token'
  ];

  const sanitized = { ...headers };
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize query parameters for logging
 */
function sanitizeQuery(query: any): any {
  if (!query || typeof query !== 'object') return query;

  const sensitiveParams = ['password', 'token', 'key', 'secret'];
  const sanitized = { ...query };

  sensitiveParams.forEach(param => {
    if (sanitized[param]) {
      sanitized[param] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize request body for logging
 */
function sanitizeBody(body: any): any {
  if (!body || typeof body !== 'object') return body;

  const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
  const sanitized = { ...body };

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Sanitize response data for logging
 */
function sanitizeResponseData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['token', 'key', 'secret', 'auth', 'password'];
  const sanitized = { ...data };

  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

/**
 * Log security event from middleware
 */
export async function logSecurityEventFromMiddleware(
  req: Request,
  middleware: string,
  eventType: string,
  details: any,
  threatLevel: 'low' | 'medium' | 'high' | 'critical' = 'medium',
  blocked: boolean = false
): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logSecurityEvent({
      req,
      middleware,
      threatLevel,
      details: {
        eventType,
        ...details
      },
      blocked,
      responseCode: blocked ? 400 : 200
    });

  } catch (error) {
    logger.error('Failed to log security event from middleware', {
      error: error instanceof Error ? error.message : 'Unknown error',
      middleware,
      eventType,
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log XSS event
 */
export async function logXSSEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logXSSEvent(req, violations, blocked);
  } catch (error) {
    logger.error('Failed to log XSS event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log CSRF event
 */
export async function logCSRFEvent(req: Request, violation: any, blocked: boolean = false): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logCSRFEvent(req, violation, blocked);
  } catch (error) {
    logger.error('Failed to log CSRF event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log SQL injection event
 */
export async function logSQLInjectionEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logSQLInjectionEvent(req, violations, blocked);
  } catch (error) {
    logger.error('Failed to log SQL injection event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log RPC security event
 */
export async function logRPCSecurityEvent(req: Request, violations: any[], blocked: boolean = false): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logRPCSecurityEvent(req, violations, blocked);
  } catch (error) {
    logger.error('Failed to log RPC security event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log rate limit event
 */
export async function logRateLimitEvent(req: Request, details: any, blocked: boolean = false): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logRateLimitEvent(req, details, blocked);
  } catch (error) {
    logger.error('Failed to log rate limit event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log security validation event
 */
export async function logSecurityValidationEvent(
  req: Request, 
  threats: string[], 
  threatLevel: string, 
  blocked: boolean = false
): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logSecurityValidationEvent(req, threats, threatLevel, blocked);
  } catch (error) {
    logger.error('Failed to log security validation event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log authentication event
 */
export async function logAuthEvent(req: Request, eventType: 'success' | 'failure', details: any): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logAuthEvent(req, eventType, details);
  } catch (error) {
    logger.error('Failed to log auth event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}

/**
 * Log admin action event
 */
export async function logAdminActionEvent(req: Request, action: string, targetUserId?: string, details: any = {}): Promise<void> {
  try {
    await comprehensiveSecurityLoggingService.logAdminActionEvent(req, action, targetUserId, details);
  } catch (error) {
    logger.error('Failed to log admin action event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      endpoint: req.originalUrl
    });
  }
}
