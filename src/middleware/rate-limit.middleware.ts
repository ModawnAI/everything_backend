/**
 * Rate Limiting Middleware
 * 
 * Comprehensive rate limiting system with user role-based limits,
 * endpoint-specific controls, Redis backend, and intelligent error handling
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';
import {
  RateLimitConfig,
  RateLimitResult,
  RateLimitError,
  RateLimitViolation,
  RateLimitMiddlewareOptions,
  RateLimitHeaders,
  RateLimitContext,
  RateLimitStore
} from '../types/rate-limit.types';
import {
  USER_ROLE_LIMITS,
  ENDPOINT_LIMITS,
  RATE_LIMIT_HEADERS,
  RATE_LIMIT_MESSAGES,
  getRoleLimitConfig,
  getEndpointLimitConfig,
  isWhitelistedIP,
  isWhitelistedUser,
  isBlacklistedIP,
  isBlacklistedUser,
  applyBlacklistPenalty,
  applyAdaptiveRateLimit,
  generateRateLimitKey
} from '../config/rate-limit.config';
import { getRedisRateLimitStore } from '../utils/redis-rate-limit-store';
import { getRateLimiterFlexibleService } from '../services/rate-limiter-flexible.service';
import { ipBlockingService } from '../services/ip-blocking.service';

/**
 * Rate Limiting Service
 * Updated to use rate-limiter-flexible for better performance and Redis support
 */
class RateLimitService {
  private flexibleService = getRateLimiterFlexibleService();
  private store: RateLimitStore;

  constructor() {
    try {
      this.store = getRedisRateLimitStore();
    } catch (error) {
      // In test environment, create a mock store
      this.store = {
        get: async () => null,
        set: async () => {},
        increment: async () => ({ totalHits: 1, resetTime: new Date(), remainingRequests: 999 }),
        reset: async () => {},
        cleanup: async () => {},
      };
    }
  }

  /**
   * Set store for testing
   */
  setStore(store: RateLimitStore): void {
    this.store = store;
  }

  /**
   * Check rate limit for a request using rate-limiter-flexible
   */
  async checkRateLimit(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      // Use rate-limiter-flexible for better performance
      return await this.flexibleService.checkRateLimit(context, config);

    } catch (error) {
      logger.error('Rate limit check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });

      // Graceful degradation - allow request if rate limiting fails
      return {
        allowed: true,
        totalHits: 0,
        remainingRequests: 999,
        resetTime: new Date(Date.now() + 900000) // 15 minutes
      };
    }
  }

  /**
   * Generate rate limit key (kept for compatibility)
   */
  private generateKey(context: RateLimitContext, config: RateLimitConfig): string {
    const { userRole, userId, ip, endpoint } = context;

    switch (config.scope) {
      case 'user':
        return generateRateLimitKey('user', userId || ip, endpoint);
      case 'ip':
        return generateRateLimitKey('ip', ip, endpoint);
      case 'endpoint':
        return generateRateLimitKey('endpoint', endpoint);
      case 'user_endpoint':
        return generateRateLimitKey('user_endpoint', `${userId || ip}:${endpoint}`);
      case 'global':
      default:
        return generateRateLimitKey('global', 'all', endpoint);
    }
  }

  /**
   * Log rate limit violation
   */
  async logViolation(
    context: RateLimitContext,
    result: RateLimitResult,
    config: RateLimitConfig
  ): Promise<void> {
    try {
      const violation: RateLimitViolation = {
        key: this.generateKey(context, config),
        limit: config.max,
        current: result.totalHits,
        resetTime: result.resetTime,
        ip: context.ip,
        endpoint: context.endpoint,
        method: context.method,
        timestamp: new Date()
      };

      if (context.userAgent) violation.userAgent = context.userAgent;
      if (context.userId) violation.userId = context.userId;
      if (context.userRole) violation.userRole = context.userRole;

      // Log to application logs
      logger.warn('Rate limit exceeded', violation);

      // Store violation for analytics (optional)
      const violationKey = generateRateLimitKey('violation', context.ip, new Date().toDateString());
      await this.store.increment(violationKey, 86400); // 24 hours

      // Apply progressive penalties for repeat offenders
      if (result.totalHits > config.max * 2) {
        await this.flexibleService.penalizeUser(context, config, 2);
      }

    } catch (error) {
      logger.error('Failed to log rate limit violation', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get system load for adaptive rate limiting
   */
  private getSystemLoad(): { cpu: number; memory: number } {
    // In production, you might use proper system monitoring
    // For now, return mock values
    return {
      cpu: Math.random() * 100,
      memory: Math.random() * 100
    };
  }

  /**
   * Get rate limit status without consuming points
   */
  async getRateLimitStatus(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    return await this.flexibleService.getRateLimitStatus(context, config);
  }

  /**
   * Reset rate limit for a user
   */
  async resetRateLimit(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<boolean> {
    return await this.flexibleService.resetRateLimit(context, config);
  }
}

// Global rate limit service instance
const rateLimitService = new RateLimitService();

/**
 * Create rate limit context from request
 */
function createRateLimitContext(req: Request): RateLimitContext {
  const authReq = req as AuthenticatedRequest;
  
  const context: RateLimitContext = {
    req,
    ip: req.ip || req.connection.remoteAddress || 'unknown',
    endpoint: req.route?.path || req.path,
    method: req.method
  };

  if (authReq.user?.role) context.userRole = authReq.user.role as any;
  if (authReq.user?.id) context.userId = authReq.user.id;
  const userAgent = req.get('User-Agent');
  if (userAgent) context.userAgent = userAgent;

  return context;
}

/**
 * Set rate limit headers on response
 */
function setRateLimitHeaders(res: Response, result: RateLimitResult, config: RateLimitConfig): void {
  const headers: Record<string, string> = {
    [RATE_LIMIT_HEADERS.LIMIT]: config.max.toString(),
    [RATE_LIMIT_HEADERS.REMAINING]: result.remainingRequests.toString(),
    [RATE_LIMIT_HEADERS.RESET]: Math.ceil(result.resetTime.getTime() / 1000).toString(),
    [RATE_LIMIT_HEADERS.USED]: result.totalHits.toString()
  };

  if (result.retryAfter) {
    headers[RATE_LIMIT_HEADERS.RETRY_AFTER] = result.retryAfter.toString();
  }

  Object.entries(headers).forEach(([key, value]) => {
    if (value) {
      res.set(key, value);
    }
  });
}

/**
 * Main rate limiting middleware factory
 */
export function rateLimit(options: RateLimitMiddlewareOptions = {}) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const context = createRateLimitContext(req);
      const authReq = req as AuthenticatedRequest;

      // Check whitelist first
      if (context.userId && isWhitelistedUser(context.userId)) {
        return next();
      }
      
      if (isWhitelistedIP(context.ip)) {
        return next();
      }

      // Check if IP is blocked
      const blockInfo = await ipBlockingService.isIPBlocked(context.ip);
      if (blockInfo) {
        logger.warn('Blocked IP attempted access', {
          ip: context.ip,
          endpoint: context.endpoint,
          blockedAt: blockInfo.blockedAt,
          blockedUntil: blockInfo.blockedUntil,
          reason: blockInfo.reason
        });

        res.status(403).json({
          error: {
            code: 'IP_BLOCKED',
            message: 'Your IP address has been temporarily blocked due to suspicious activity.',
            blockedUntil: blockInfo.blockedUntil.toISOString(),
            reason: blockInfo.reason
          }
        });
        return;
      }

      // Determine rate limit configuration
      let config: RateLimitConfig;

      // Check for endpoint-specific limits first
      const endpointConfig = getEndpointLimitConfig(context.endpoint);
      if (endpointConfig) {
        config = endpointConfig;
      } else {
        // Use role-based limits
        const userRole = authReq.user?.role || 'guest';
        config = getRoleLimitConfig(userRole);
      }

      // Apply custom configuration from options
      if (options.config) {
        config = { ...config, ...options.config };
      }

      // Apply blacklist penalty
      if (context.userId && isBlacklistedUser(context.userId)) {
        config = applyBlacklistPenalty(config);
      }
      
      if (isBlacklistedIP(context.ip)) {
        config = applyBlacklistPenalty(config);
      }

      // Apply adaptive rate limiting
      const systemLoad = rateLimitService['getSystemLoad']();
      config = applyAdaptiveRateLimit(config, systemLoad.cpu, systemLoad.memory);

      // Check rate limit
      const result = await rateLimitService.checkRateLimit(context, config);

      // Set rate limit headers
      if (config.enableHeaders) {
        setRateLimitHeaders(res, result, config);
      }

      // Handle rate limit exceeded
      if (!result.allowed) {
        // Log violation
        await rateLimitService.logViolation(context, result, config);

        // Record IP violation for blocking system
        await ipBlockingService.recordViolation({
          ip: context.ip,
          timestamp: new Date(),
          violationType: 'rate_limit',
          endpoint: context.endpoint,
          userAgent: context.userAgent,
          severity: result.totalHits > config.max * 2 ? 'high' : 'medium',
          details: {
            limit: config.max,
            actual: result.totalHits,
            windowMs: config.windowMs
          }
        });

        // Call custom handler if provided
        if (options.onLimitReached) {
          options.onLimitReached(req, res, result);
          return;
        }

        // Default rate limit response
        const message = typeof config.message === 'string' 
          ? { error: config.message }
          : (config.message || RATE_LIMIT_MESSAGES.GENERIC);

        const errorResponse = Object.assign(
          {},
          message,
          {
            limit: config.max,
            remaining: result.remainingRequests,
            resetTime: result.resetTime.toISOString()
          }
        );

        if (result.retryAfter) {
          (errorResponse as any).retryAfter = result.retryAfter;
        }

        res.status(429).json({
          error: errorResponse
        });
        return;
      }

      // Request allowed, continue
      next();

    } catch (error) {
      logger.error('Rate limiting middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        endpoint: req.path
      });

      // On error, allow request (graceful degradation)
      next();
    }
  };
}

/**
 * Endpoint-specific rate limiting
 */
export function endpointRateLimit(endpointName: keyof typeof ENDPOINT_LIMITS) {
  return rateLimit({
    config: ENDPOINT_LIMITS[endpointName]
  });
}

/**
 * Role-based rate limiting
 */
export function roleBasedRateLimit(options: RateLimitMiddlewareOptions = {}) {
  return rateLimit(options);
}

/**
 * Strict rate limiting for sensitive operations
 */
export function strictRateLimit(maxRequests: number, windowMs: number = 900000) {
  return rateLimit({
    config: {
      max: maxRequests,
      windowMs,
      strategy: 'fixed_window',
      scope: 'ip',
      enableHeaders: true,
      message: RATE_LIMIT_MESSAGES.GENERIC
    }
  });
}

/**
 * Login rate limiting with progressive penalties
 */
export function loginRateLimit() {
  return rateLimit({
    config: ENDPOINT_LIMITS.login,
    onLimitReached: (req: Request, res: Response, result: RateLimitResult) => {
      logger.warn('Login rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        attempts: result.totalHits,
        resetTime: result.resetTime
      });

      res.status(429).json({
        error: {
          ...RATE_LIMIT_MESSAGES.LOGIN,
          attempts: result.totalHits,
          maxAttempts: ENDPOINT_LIMITS.login.max,
          resetTime: result.resetTime.toISOString(),
          retryAfter: result.retryAfter
        }
      });
    }
  });
}

/**
 * Payment rate limiting with enhanced security
 */
export function paymentRateLimit() {
  return rateLimit({
    config: ENDPOINT_LIMITS.payment_process,
    onLimitReached: (req: Request, res: Response, result: RateLimitResult) => {
      const authReq = req as AuthenticatedRequest;
      
      logger.error('Payment rate limit exceeded - potential abuse', {
        ip: req.ip,
        userId: authReq.user?.id,
        userAgent: req.get('User-Agent'),
        attempts: result.totalHits,
        resetTime: result.resetTime
      });

      res.status(429).json({
        error: {
          ...RATE_LIMIT_MESSAGES.PAYMENT,
          resetTime: result.resetTime.toISOString(),
          retryAfter: result.retryAfter
        }
      });
    }
  });
}

/**
 * File upload rate limiting
 */
export function uploadRateLimit() {
  return rateLimit({
    config: ENDPOINT_LIMITS.file_upload,
    onLimitReached: (req: Request, res: Response, result: RateLimitResult) => {
      res.status(429).json({
        error: {
          ...RATE_LIMIT_MESSAGES.FILE_UPLOAD,
          resetTime: result.resetTime.toISOString(),
          retryAfter: result.retryAfter
        }
      });
    }
  });
}

/**
 * Get rate limit status for user
 */
export async function getRateLimitStatus(
  userId: string, 
  ip: string, 
  endpoint: string
): Promise<RateLimitResult | null> {
  try {
    const context: RateLimitContext = {
      req: {} as Request,
      userId,
      ip,
      endpoint,
      method: 'GET'
    };

    const config = getRoleLimitConfig('user'); // Default to user role
    return await rateLimitService.getRateLimitStatus(context, config);

  } catch (error) {
    logger.error('Failed to get rate limit status', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      ip,
      endpoint
    });
    return null;
  }
}

/**
 * Reset rate limit for user (admin function)
 */
export async function resetRateLimit(
  userId: string, 
  ip: string, 
  endpoint?: string
): Promise<boolean> {
  try {
    const context: RateLimitContext = {
      req: {} as Request,
      userId,
      ip,
      endpoint: endpoint || 'all',
      method: 'GET'
    };

    const config = getRoleLimitConfig('user'); // Default to user role
    const result = await rateLimitService.resetRateLimit(context, config);

    logger.info('Rate limit reset', { userId, ip, endpoint });
    return result;

  } catch (error) {
    logger.error('Failed to reset rate limit', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      ip,
      endpoint
    });
    return false;
  }
}

export { rateLimitService };

export default {
  rateLimit,
  endpointRateLimit,
  roleBasedRateLimit,
  strictRateLimit,
  loginRateLimit,
  paymentRateLimit,
  uploadRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  rateLimitService
}; 