/**
 * Image Security Middleware
 * 
 * Advanced security middleware for image management operations including
 * request pattern analysis, IP blocking, and comprehensive audit logging
 */

import { Request, Response, NextFunction } from 'express';
import { ImageSecurityMonitoringService } from '../services/image-security-monitoring.service';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string; email: string };
}

const imageSecurityMonitoringService = new ImageSecurityMonitoringService();

interface ImageSecurityContext {
  userId?: string;
  ip: string;
  userAgent: string;
  endpoint: string;
  requestSize?: number;
  fileType?: string;
  operation: 'upload' | 'download' | 'delete' | 'update' | 'access';
}

/**
 * Enhanced rate limiting for image operations
 */
export function imageOperationRateLimit(operation: 'upload' | 'download' | 'delete' | 'update' | 'access') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = createImageSecurityContext(req, operation);
      
      // Check if IP is blocked
      const blockInfo = await imageSecurityMonitoringService.isIPBlocked(context.ip);
      if (blockInfo) {
        await imageSecurityMonitoringService.logSecurityEvent(
          'access',
          'high',
          context.ip,
          context.endpoint,
          { reason: 'Blocked IP attempted access', blockInfo },
          context.userId,
          context.userAgent,
          true,
          'IP is blocked'
        );

        res.status(403).json({
          success: false,
          error: {
            code: 'IP_BLOCKED',
            message: 'Your IP address has been temporarily blocked due to suspicious activity.',
            blockedUntil: blockInfo.blockedUntil.toISOString(),
            reason: blockInfo.reason
          }
        });
        return;
      }

      // Analyze request pattern
      const analysis = await imageSecurityMonitoringService.analyzeRequestPattern(
        context.ip,
        context.endpoint,
        context.userId,
        context.requestSize,
        context.userAgent
      );

      // Log security event
      await imageSecurityMonitoringService.logSecurityEvent(
        context.operation,
        analysis.suspicious ? 'high' : 'low',
        context.ip,
        context.endpoint,
        {
          suspicious: analysis.suspicious,
          score: analysis.score,
          reasons: analysis.reasons,
          requestSize: context.requestSize,
          fileType: context.fileType
        },
        context.userId,
        context.userAgent,
        false
      );

      // Block IP if necessary
      if (analysis.shouldBlock) {
        await imageSecurityMonitoringService.blockIP(
          context.ip,
          `Suspicious activity detected: ${analysis.reasons.join(', ')}`,
          'high',
          24 * 60 * 60 * 1000, // 24 hours
          context.userId
        );

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Your IP address has been temporarily blocked due to suspicious activity.',
            retryAfter: 24 * 60 * 60 // 24 hours in seconds
          }
        });
        return;
      }

      // Apply rate limiting based on operation type
      const rateLimitResult = await applyImageRateLimit(context, operation);
      if (!rateLimitResult.allowed) {
        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: rateLimitResult.message,
            retryAfter: rateLimitResult.retryAfter
          }
        });
        return;
      }

      // Add security headers
      res.set({
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'X-XSS-Protection': '1; mode=block',
        'X-RateLimit-Limit': rateLimitResult.limit.toString(),
        'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
        'X-RateLimit-Reset': rateLimitResult.resetTime.toString()
      });

      next();
    } catch (error) {
      logger.error('Image security middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Fail open for security
      next();
    }
  };
}

/**
 * Request size validation middleware
 */
export function validateImageRequestSize(maxSize: number = 10 * 1024 * 1024) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = parseInt(req.get('Content-Length') || '0');
    
    if (contentLength > maxSize) {
      res.status(413).json({
        success: false,
        error: {
          code: 'REQUEST_TOO_LARGE',
          message: `Request size exceeds maximum allowed size of ${Math.round(maxSize / 1024 / 1024)}MB`,
          maxSize: maxSize
        }
      });
      return;
    }

    next();
  };
}

/**
 * File type validation middleware
 * Note: For multipart/form-data uploads, this middleware allows the request through.
 * Actual file type validation happens in multer and the route handler after file parsing.
 */
export function validateImageFileType(allowedTypes: string[] = ['image/jpeg', 'image/png', 'image/webp']) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentType = req.get('Content-Type') || '';

    // multipart/form-data 요청은 통과시킴 (파일 타입은 multer에서 검증)
    if (contentType.startsWith('multipart/form-data')) {
      next();
      return;
    }

    // 직접 이미지 전송의 경우 Content-Type 검증
    if (contentType && !allowedTypes.includes(contentType)) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: `File type ${contentType} is not allowed. Allowed types: ${allowedTypes.join(', ')}`,
          allowedTypes
        }
      });
      return;
    }

    next();
  };
}

/**
 * Image operation audit logging middleware
 */
export function auditImageOperations(operation: 'upload' | 'download' | 'delete' | 'update' | 'access') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const startTime = Date.now();
    const originalSend = res.send;

    // Override res.send to capture response
    res.send = function(data: any) {
      const duration = Date.now() - startTime;
      const success = res.statusCode >= 200 && res.statusCode < 300;

      // Log the operation
      imageSecurityMonitoringService.logSecurityEvent(
        operation,
        success ? 'low' : 'medium',
        req.ip,
        req.path,
        {
          method: req.method,
          statusCode: res.statusCode,
          duration,
          success,
          userAgent: req.get('User-Agent'),
          contentLength: req.get('Content-Length'),
          contentType: req.get('Content-Type')
        },
        req.user?.id,
        req.get('User-Agent'),
        false
      ).catch(error => {
        logger.error('Failed to log image operation audit', { error });
      });

      return originalSend.call(this, data);
    };

    next();
  };
}

/**
 * Create image security context from request
 */
function createImageSecurityContext(req: Request, operation: 'upload' | 'download' | 'delete' | 'update' | 'access'): ImageSecurityContext {
  const authReq = req as AuthenticatedRequest;
  
  return {
    userId: authReq.user?.id,
    ip: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    endpoint: req.path,
    requestSize: parseInt(req.get('Content-Length') || '0'),
    fileType: req.get('Content-Type'),
    operation
  };
}

/**
 * Apply rate limiting based on image operation type
 */
async function applyImageRateLimit(
  context: ImageSecurityContext,
  operation: 'upload' | 'download' | 'delete' | 'update' | 'access'
): Promise<{
  allowed: boolean;
  message: string;
  retryAfter: number;
  limit: number;
  remaining: number;
  resetTime: number;
}> {
  const limits = {
    upload: {
      max: 10, // 10 uploads per hour
      windowMs: 60 * 60 * 1000,
      message: 'Too many image uploads. Please try again in an hour.'
    },
    download: {
      max: 100, // 100 downloads per hour
      windowMs: 60 * 60 * 1000,
      message: 'Too many image downloads. Please try again in an hour.'
    },
    delete: {
      max: 20, // 20 deletions per hour
      windowMs: 60 * 60 * 1000,
      message: 'Too many image deletions. Please try again in an hour.'
    },
    update: {
      max: 50, // 50 updates per hour
      windowMs: 60 * 60 * 1000,
      message: 'Too many image updates. Please try again in an hour.'
    },
    access: {
      max: 200, // 200 accesses per hour
      windowMs: 60 * 60 * 1000,
      message: 'Too many image accesses. Please try again in an hour.'
    }
  };

  const limit = limits[operation];
  const key = `image_${operation}:${context.userId || context.ip}`;
  const now = Date.now();
  const windowStart = now - limit.windowMs;

  // This is a simplified rate limiting implementation
  // In production, you would use Redis or a similar distributed store
  const currentCount = await getCurrentRequestCount(key, windowStart);
  
  if (currentCount >= limit.max) {
    return {
      allowed: false,
      message: limit.message,
      retryAfter: Math.ceil(limit.windowMs / 1000),
      limit: limit.max,
      remaining: 0,
      resetTime: now + limit.windowMs
    };
  }

  // Increment counter
  await incrementRequestCount(key, now);

  return {
    allowed: true,
    message: '',
    retryAfter: 0,
    limit: limit.max,
    remaining: limit.max - currentCount - 1,
    resetTime: now + limit.windowMs
  };
}

/**
 * Get current request count for key since window start
 */
async function getCurrentRequestCount(key: string, windowStart: number): Promise<number> {
  // This is a simplified implementation
  // In production, you would use Redis or a similar distributed store
  return 0;
}

/**
 * Increment request count for key
 */
async function incrementRequestCount(key: string, timestamp: number): Promise<void> {
  // This is a simplified implementation
  // In production, you would use Redis or a similar distributed store
}

/**
 * Enhanced image upload security middleware
 */
export function enhancedImageUploadSecurity() {
  return [
    validateImageRequestSize(20 * 1024 * 1024), // 20MB max
    validateImageFileType(['image/jpeg', 'image/png', 'image/webp']),
    imageOperationRateLimit('upload'),
    auditImageOperations('upload')
  ];
}

/**
 * Enhanced image download security middleware
 */
export function enhancedImageDownloadSecurity() {
  return [
    imageOperationRateLimit('download'),
    auditImageOperations('download')
  ];
}

/**
 * Enhanced image update security middleware
 */
export function enhancedImageUpdateSecurity() {
  return [
    imageOperationRateLimit('update'),
    auditImageOperations('update')
  ];
}

/**
 * Enhanced image delete security middleware
 */
export function enhancedImageDeleteSecurity() {
  return [
    imageOperationRateLimit('delete'),
    auditImageOperations('delete')
  ];
}

/**
 * Enhanced image access security middleware
 */
export function enhancedImageAccessSecurity() {
  return [
    imageOperationRateLimit('access'),
    auditImageOperations('access')
  ];
}
