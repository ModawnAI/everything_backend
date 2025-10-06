/**
 * Response Standardization Middleware
 * 
 * Integrates the response formatter with existing error handling and
 * ensures all API responses follow the standardized format
 */

import { Request, Response, NextFunction } from 'express';
import { responseFormatterMiddleware } from '../utils/response-formatter';
import { logger } from '../utils/logger';

// =============================================
// RESPONSE STANDARDIZATION MIDDLEWARE
// =============================================

/**
 * Main response standardization middleware
 * Combines response formatter with request tracking
 */
export function responseStandardizationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip response standardization for Swagger UI, documentation routes, and admin login
    if (req.path.startsWith('/api-docs') ||
        req.path.startsWith('/admin-docs') ||
        req.path.startsWith('/service-docs') ||
        req.path === '/swagger.json' ||
        req.path === '/api/openapi.json' ||
        req.path.includes('swagger-ui') ||
        req.path === '/api/admin/auth/login') {
      return next();
    }

    // Generate request ID if not present
    if (!req.headers['x-request-id']) {
      req.headers['x-request-id'] = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Set request ID header in response
    res.setHeader('X-Request-ID', req.headers['x-request-id'] as string);

    // Add CORS headers for API documentation
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Request-ID');

    // Apply response formatter middleware
    responseFormatterMiddleware()(req, res, next);
  };
}

/**
 * Response validation middleware
 * Ensures all responses follow the standard format
 */
export function responseValidationMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip response standardization for Swagger UI, documentation routes, and admin login
    if (req.path.startsWith('/api-docs') ||
        req.path.startsWith('/admin-docs') ||
        req.path.startsWith('/service-docs') ||
        req.path === '/swagger.json' ||
        req.path === '/api/openapi.json' ||
        req.path.includes('swagger-ui') ||
        req.path === '/api/admin/auth/login') {
      return next();
    }

    const originalJson = res.json;
    const originalSend = res.send;

    // Override res.json to validate response format
    res.json = function(body: any) {
      // Skip validation for already formatted responses
      if (body && typeof body === 'object' && 'success' in body) {
        return originalJson.call(this, body);
      }

      // Log warning for non-standard responses
      logger.warn('Non-standard API response detected', {
        path: req.originalUrl,
        method: req.method,
        statusCode: res.statusCode,
        responseType: typeof body,
        requestId: req.headers['x-request-id']
      });

      // Wrap non-standard responses in standard format
      const standardResponse = {
        success: res.statusCode >= 200 && res.statusCode < 300,
        data: body,
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id']
      };

      return originalJson.call(this, standardResponse);
    };

    // Override res.send for text responses
    res.send = function(body: any) {
      // Only wrap if it's not already a JSON response
      if (typeof body === 'string' && !res.get('Content-Type')?.includes('application/json')) {
        const standardResponse = {
          success: res.statusCode >= 200 && res.statusCode < 300,
          message: body,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        };

        res.setHeader('Content-Type', 'application/json');
        return originalSend.call(this, JSON.stringify(standardResponse));
      }

      return originalSend.call(this, body);
    };

    next();
  };
}

/**
 * Performance tracking middleware
 * Adds execution time to response metadata
 */
export function performanceTrackingMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const startTime = Date.now();
    res.locals.startTime = startTime;

    // Track response completion
    res.on('finish', () => {
      const executionTime = Date.now() - startTime;
      const requestId = req.headers['x-request-id'];

      // Log performance metrics
      logger.info('Request completed', {
        method: req.method,
        path: req.originalUrl,
        statusCode: res.statusCode,
        executionTime,
        requestId,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        contentLength: res.get('Content-Length')
      });

      // Log slow requests
      if (executionTime > 1000) {
        logger.warn('Slow request detected', {
          method: req.method,
          path: req.originalUrl,
          executionTime,
          requestId
        });
      }
    });

    next();
  };
}

/**
 * API versioning middleware
 * Adds API version to response headers
 */
export function apiVersioningMiddleware(version: string = '1.0.0') {
  return (req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-API-Version', version);
    res.locals.apiVersion = version;
    next();
  };
}

/**
 * Content type enforcement middleware
 * Ensures JSON content type for API responses
 */
export function contentTypeMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Skip content type enforcement for Swagger UI and documentation routes
    if (req.path.startsWith('/api-docs') || 
        req.path === '/swagger.json' || 
        req.path === '/api/openapi.json' ||
        req.path.includes('swagger-ui')) {
      return next();
    }

    // Set default content type for API responses
    if (req.path.startsWith('/api/')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    }

    next();
  };
}

/**
 * Security headers middleware
 * Adds security-related headers to responses
 */
export function securityHeadersMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // Security headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Remove server header for security
    res.removeHeader('X-Powered-By');

    next();
  };
}

/**
 * Combined standardization middleware
 * Applies all standardization middlewares in the correct order
 */
export function applyResponseStandardization() {
  return [
    performanceTrackingMiddleware(),
    apiVersioningMiddleware(),
    securityHeadersMiddleware(),
    contentTypeMiddleware(),
    responseStandardizationMiddleware(),
    responseValidationMiddleware()
  ];
}

// =============================================
// RESPONSE INTERCEPTOR FOR LEGACY ROUTES
// =============================================

/**
 * Legacy response interceptor
 * Converts legacy response formats to standard format
 */
export function legacyResponseInterceptor() {
  return (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(body: any) {
      // Check if it's already in standard format
      if (body && typeof body === 'object' && 'success' in body) {
        return originalJson.call(this, body);
      }

      // Convert legacy formats
      let standardResponse: any;

      if (body && typeof body === 'object') {
        // Handle different legacy formats
        if ('error' in body && !('success' in body)) {
          // Legacy error format
          standardResponse = {
            success: false,
            error: body.error,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          };
        } else if ('data' in body && !('success' in body)) {
          // Legacy data format
          standardResponse = {
            success: true,
            data: body.data,
            message: body.message,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          };
        } else {
          // Generic object - wrap as data
          standardResponse = {
            success: res.statusCode >= 200 && res.statusCode < 300,
            data: body,
            timestamp: new Date().toISOString(),
            requestId: req.headers['x-request-id']
          };
        }
      } else {
        // Primitive values
        standardResponse = {
          success: res.statusCode >= 200 && res.statusCode < 300,
          data: body,
          timestamp: new Date().toISOString(),
          requestId: req.headers['x-request-id']
        };
      }

      return originalJson.call(this, standardResponse);
    };

    next();
  };
}

export default {
  responseStandardizationMiddleware,
  responseValidationMiddleware,
  performanceTrackingMiddleware,
  apiVersioningMiddleware,
  contentTypeMiddleware,
  securityHeadersMiddleware,
  applyResponseStandardization,
  legacyResponseInterceptor
};
