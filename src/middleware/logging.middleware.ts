import { Request, Response, NextFunction } from 'express';
import morgan from 'morgan';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

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

  // Skip logging for health check endpoint
  if (url === '/health') {
    return null;
  }

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

  // Log directly to console to bypass Winston filtering
  const logMessage = `[${logEntry.timestamp}] ${method} ${url} ${status} - ${responseTime}ms - ${remoteAddr}`;

  if (parseInt(status) >= 400) {
    console.log(`❌ ${logMessage}`);
  } else if (parseInt(status) >= 300) {
    console.log(`↪️  ${logMessage}`);
  } else {
    console.log(`✅ ${logMessage}`);
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
 * In development mode, logs verbose request/response information for debugging
 */
export function requestLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const requestLogger = logger.child({ correlationId });
  const isDevelopment = config.server.isDevelopment;

  // Skip logging for health check endpoint
  const isHealthCheck = req.originalUrl === '/health';

  // Log request start
  const requestLogData: any = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id || 'anonymous',
  };

  // In development mode, log more details (except health checks)
  if (!isHealthCheck) {
    if (isDevelopment) {
      requestLogData.body = sanitizeRequestBody(req.body);
      requestLogData.query = req.query;
      requestLogData.params = req.params;
      requestLogData.headers = sanitizeHeaders(req.headers);

      requestLogger.info('🚀 [DEV] Request started', requestLogData);
    } else {
      requestLogger.info('Request started', requestLogData);
    }
  }

  // Capture response body in development mode
  let responseBody: any = null;
  if (isDevelopment) {
    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      responseBody = body;
      return originalJson(body);
    };
  }

  // Override res.end to log response
  const originalEnd = res.end.bind(res);
  res.end = function(chunk?: any, encoding?: any, cb?: any) {
    const responseTime = Date.now() - (req as any).startTime;

    const responseLogData: any = {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      responseTime,
      contentLength: res.get('content-length'),
      userId: (req as any).user?.id || 'anonymous',
    };

    // Skip logging for health check endpoint
    if (!isHealthCheck) {
      // In development mode, log response body and additional details
      if (isDevelopment) {
        if (responseBody) {
          responseLogData.responseBody = responseBody;
        }

        // Add color-coded emoji based on status
        let statusEmoji = '✅';
        if (res.statusCode >= 500) statusEmoji = '💥';
        else if (res.statusCode >= 400) statusEmoji = '⚠️';
        else if (res.statusCode >= 300) statusEmoji = '↪️';

        requestLogger.info(`${statusEmoji} [DEV] Request completed`, responseLogData);
      } else {
        requestLogger.info('Request completed', responseLogData);
      }
    }

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
 * In development mode, logs full error details including stack trace
 */
export function errorLoggingMiddleware(err: Error, req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const errorLogger = logger.child({ correlationId });
  const isDevelopment = config.server.isDevelopment;

  const errorLogData: any = {
    error: err.message,
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    userId: (req as any).user?.id || 'anonymous',
  };

  // In development mode, include full stack trace and request details
  if (isDevelopment) {
    errorLogData.stack = err.stack;
    errorLogData.body = sanitizeRequestBody(req.body);
    errorLogData.query = req.query;
    errorLogData.params = req.params;
    errorLogData.headers = sanitizeHeaders(req.headers);

    errorLogger.error('💥 [DEV] Request error', errorLogData);
  } else {
    errorLogger.error('Request error', errorLogData);
  }

  next(err);
}

// =============================================
// PERFORMANCE LOGGING MIDDLEWARE
// =============================================

/**
 * Log slow requests
 * In development mode, logs all request timings for performance analysis
 */
export function performanceLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const correlationId = (req as any).correlationId || generateCorrelationId();
  const perfLogger = logger.child({ correlationId });
  const isDevelopment = config.server.isDevelopment;
  const isHealthCheck = req.originalUrl === '/health';

  res.on('finish', () => {
    // Skip performance logging for health check endpoint
    if (isHealthCheck) {
      return;
    }

    const duration = Date.now() - startTime;
    const slowRequestThreshold = 1000; // 1 second

    const perfLogData = {
      method: req.method,
      url: req.originalUrl,
      duration,
      statusCode: res.statusCode,
      userId: (req as any).user?.id || 'anonymous',
    };

    // In development mode, log all request timings
    if (isDevelopment) {
      if (duration > slowRequestThreshold) {
        perfLogger.warn('🐌 [DEV] Slow request detected', perfLogData);
      } else if (duration > 500) {
        perfLogger.info('⏱️ [DEV] Moderately slow request', perfLogData);
      } else {
        perfLogger.debug('⚡ [DEV] Fast request', perfLogData);
      }
    } else {
      // In production, only log slow requests
      if (duration > slowRequestThreshold) {
        perfLogger.warn('Slow request detected', perfLogData);
      }
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