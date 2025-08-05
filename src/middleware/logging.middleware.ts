import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logger } from '../utils/logger';

// =============================================
// CORRELATION ID MIDDLEWARE
// =============================================

/**
 * Add correlation ID to request for tracking across services
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate or use existing correlation ID
  const correlationId = req.headers['x-correlation-id'] as string || 
                       req.headers['x-request-id'] as string || 
                       generateCorrelationId();
  
  // Add to request object
  (req as any).correlationId = correlationId;
  
  // Add to response headers
  res.setHeader('x-correlation-id', correlationId);
  
  // Add to logger context
  (req as any).logger = logger.child({ correlationId });
  
  next();
}

/**
 * Generate unique correlation ID
 */
function generateCorrelationId(): string {
  return `corr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// =============================================
// CUSTOM MORGAN FORMAT
// =============================================

/**
 * Custom Morgan format that integrates with Winston
 */
export const morganFormat = morgan((tokens, req: Request, res: Response) => {
  const correlationId = (req as any).correlationId || 'unknown';
  const userId = (req as any).user?.id || 'anonymous';
  const userAgent = tokens['user-agent']?.(req, res) || 'unknown';
  const method = tokens.method?.(req, res) || 'unknown';
  const url = tokens.url?.(req, res) || 'unknown';
  const status = tokens.status?.(req, res) || 'unknown';
  const responseTime = tokens['response-time']?.(req, res) || '0';
  const contentLength = tokens.res?.(req, res, 'content-length') || '0';
  const remoteAddr = tokens['remote-addr']?.(req, res) || 'unknown';
  
  // Create structured log entry
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: getLogLevel(parseInt(status)),
    message: `${method} ${url} ${status}`,
    correlationId,
    userId,
    method,
    url,
    status: parseInt(status),
    responseTime: parseFloat(responseTime),
    contentLength: parseInt(contentLength),
    remoteAddr,
    userAgent,
    requestId: correlationId,
  };

  // Log based on status code
  if (parseInt(status) >= 400) {
    logger.error('HTTP Request Error', logEntry);
  } else if (parseInt(status) >= 300) {
    logger.warn('HTTP Request Redirect', logEntry);
  } else {
    logger.info('HTTP Request', logEntry);
  }

  return null; // Don't use Morgan's default output
});

/**
 * Get appropriate log level based on HTTP status code
 */
function getLogLevel(statusCode: number): string {
  if (statusCode >= 500) return 'error';
  if (statusCode >= 400) return 'warn';
  if (statusCode >= 300) return 'info';
  return 'info';
}

// =============================================
// REQUEST/RESPONSE LOGGING MIDDLEWARE
// =============================================

/**
 * Log request details
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const requestLogger = logger.child({ correlationId });

  // Log request start
  requestLogger.info('Request started', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id || 'anonymous',
    body: sanitizeRequestBody(req.body),
    query: req.query,
    headers: sanitizeHeaders(req.headers),
  });

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - (req as any).startTime;
    
    requestLogger.info('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('content-length'),
      userId: (req as any).user?.id || 'anonymous',
    });

    return originalEnd(chunk, encoding, cb);
  };

  // Add start time
  (req as any).startTime = Date.now();
  
  next();
}

/**
 * Sanitize request body for logging (remove sensitive data)
 */
function sanitizeRequestBody(body: any): any {
  if (!body) return body;
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'key', 'authorization'];
  
  sensitiveFields.forEach(field => {
    if (sanitized[field]) {
      sanitized[field] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize headers for logging (remove sensitive data)
 */
function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '[REDACTED]';
    }
  });
  
  return sanitized;
}

// =============================================
// ERROR LOGGING MIDDLEWARE
// =============================================

/**
 * Enhanced error logging middleware
 */
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const errorLogger = logger.child({ correlationId });

  errorLogger.error('Request error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id || 'anonymous',
    body: sanitizeRequestBody(req.body),
    query: req.query,
    headers: sanitizeHeaders(req.headers),
  });

  next(err);
}

// =============================================
// PERFORMANCE LOGGING MIDDLEWARE
// =============================================

/**
 * Log slow requests
 */
export function performanceLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const perfLogger = logger.child({ correlationId });

  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const slowRequestThreshold = 1000; // 1 second

    if (duration > slowRequestThreshold) {
      perfLogger.warn('Slow request detected', {
        method: req.method,
        url: req.originalUrl,
        duration,
        statusCode: res.statusCode,
        userId: (req as any).user?.id || 'anonymous',
      });
    }
  });

  next();
}

// =============================================
// LOGGING UTILITIES
// =============================================

/**
 * Create logger with correlation ID
 */
export function createRequestLogger(correlationId: string) {
  return logger.child({ correlationId });
}

/**
 * Log business events
 */
export function logBusinessEvent(event: string, data: any, req?: Request): void {
  const correlationId = req ? (req as any).correlationId : generateCorrelationId();
  const eventLogger = logger.child({ correlationId, eventType: 'business' });

  eventLogger.info(`Business event: ${event}`, {
    event,
    data,
    userId: req ? (req as any).user?.id : 'system',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log security events
 */
export function logSecurityEvent(event: string, data: any, req?: Request): void {
  const correlationId = req ? (req as any).correlationId : generateCorrelationId();
  const securityLogger = logger.child({ correlationId, eventType: 'security' });

  securityLogger.warn(`Security event: ${event}`, {
    event,
    data,
    userId: req ? (req as any).user?.id : 'system',
    ip: req ? req.ip : 'unknown',
    userAgent: req ? req.get('User-Agent') : 'unknown',
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log audit events
 */
export function logAuditEvent(action: string, resource: string, data: any, req?: Request): void {
  const correlationId = req ? (req as any).correlationId : generateCorrelationId();
  const auditLogger = logger.child({ correlationId, eventType: 'audit' });

  auditLogger.info(`Audit event: ${action}`, {
    action,
    resource,
    data,
    userId: req ? (req as any).user?.id : 'system',
    userRole: req ? (req as any).user?.role : 'system',
    ip: req ? req.ip : 'unknown',
    timestamp: new Date().toISOString(),
  });
} 