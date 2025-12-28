/**
 * Unified Authentication Middleware
 * Validates sessions and enforces role-based access control
 */

import { Request, Response, NextFunction } from 'express';
import { UnifiedAuthService } from '../services/unified-auth.service';
import { UserRole } from '../types/unified-auth.types';
import { logger } from '../utils/logger';

const authService = new UnifiedAuthService();

/**
 * Extract token from request headers
 */
const extractToken = (req: Request): string | null => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return null;
  }

  if (authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  return null;
};

/**
 * Authenticate request and validate session
 */
export const authenticate = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (!token) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'No authentication token provided'
        }
      });
      return;
    }

    const validation = await authService.validateSession(token);

    if (!validation.valid) {
      const errorMessages: Record<string, string> = {
        session_not_found: 'Session not found',
        session_inactive: 'Session is inactive',
        session_expired: 'Session has expired',
        account_locked: 'Account is locked',
        token_expired: 'Token has expired',
        invalid_token: 'Invalid token',
        validation_error: 'Session validation failed'
      };

      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: errorMessages[validation.error || 'validation_error'] || 'Authentication failed'
        }
      });
      return;
    }

    // Attach user info to request
    (req as any).user = {
      id: validation.user?.id,
      email: validation.user?.email,
      role: validation.user?.role,
      shopId: validation.user?.shop_id,
      session: validation.session
    };

    next();
  } catch (error) {
    logger.error('Authentication middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path
    });

    res.status(401).json({
      success: false,
      error: {
        code: 'AUTHENTICATION_ERROR',
        message: 'Authentication failed'
      }
    });
  }
};

/**
 * Require specific role(s)
 */
export const requireRole = (...allowedRoles: UserRole[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user || !user.role) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    if (!allowedRoles.includes(user.role)) {
      logger.warn('Role access denied', {
        userId: user.id,
        userRole: user.role,
        requiredRoles: allowedRoles,
        path: req.path
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions'
        }
      });
      return;
    }

    next();
  };
};

/**
 * Require admin role
 */
export const requireAdmin = requireRole('admin');

/**
 * Require shop owner role
 */
export const requireShopOwner = requireRole('shop_owner');

/**
 * Require customer role
 */
export const requireCustomer = requireRole('customer');

/**
 * Require admin or shop owner
 */
export const requireAdminOrShopOwner = requireRole('admin', 'shop_owner');

/**
 * Require shop association for shop owners
 */
export const requireShopAssociation = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const user = (req as any).user;

  if (!user) {
    res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'User not authenticated'
      }
    });
    return;
  }

  // Only shop owners need shop association
  if (user.role === 'shop_owner' && !user.shopId) {
    logger.warn('Shop owner without shop association', {
      userId: user.id,
      path: req.path
    });

    res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Shop association required'
      }
    });
    return;
  }

  next();
};

/**
 * Validate shop access for shop owners
 * Ensures shop owners can only access their own shop's data
 */
export const validateShopAccess = (shopIdParam: string = 'shopId') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User not authenticated'
        }
      });
      return;
    }

    // Admin can access any shop
    if (user.role === 'admin') {
      next();
      return;
    }

    // Shop owner can only access their own shop
    if (user.role === 'shop_owner') {
      const requestedShopId = req.params[shopIdParam] || req.body[shopIdParam] || req.query[shopIdParam];

      if (!requestedShopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Shop ID is required'
          }
        });
        return;
      }

      if (requestedShopId !== user.shopId) {
        logger.warn('Shop owner attempted to access different shop', {
          userId: user.id,
          userShopId: user.shopId,
          requestedShopId,
          path: req.path
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Access denied to this shop'
          }
        });
        return;
      }
    }

    next();
  };
};

/**
 * Optional authentication
 * Attaches user info if token is valid, but doesn't block request if not
 */
export const optionalAuth = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = extractToken(req);

    if (token) {
      const validation = await authService.validateSession(token);

      if (validation.valid) {
        (req as any).user = {
          id: validation.user?.id,
          email: validation.user?.email,
          role: validation.user?.role,
          shopId: validation.user?.shop_id,
          session: validation.session
        };
      }
    }

    next();
  } catch (error) {
    // Don't block request on error, just log and continue
    logger.error('Optional auth middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      path: req.path
    });
    next();
  }
};

/**
 * Rate limiting based on IP address
 * Can be enhanced with Redis for distributed rate limiting
 */
const loginAttempts = new Map<string, { count: number; resetAt: number }>();

export const rateLimitLogin = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();

    const attempts = loginAttempts.get(ip);

    if (attempts) {
      // Reset window if expired
      if (now > attempts.resetAt) {
        loginAttempts.delete(ip);
      } else if (attempts.count >= maxAttempts) {
        const remainingTime = Math.ceil((attempts.resetAt - now) / 1000 / 60);

        logger.warn('Login rate limit exceeded', {
          ip,
          attempts: attempts.count,
          remainingMinutes: remainingTime
        });

        res.status(429).json({
          success: false,
          error: {
            code: 'TOO_MANY_ATTEMPTS',
            message: `Too many login attempts. Please try again in ${remainingTime} minutes.`
          }
        });
        return;
      }
    }

    // Track this attempt
    const currentAttempts = attempts || { count: 0, resetAt: now + windowMs };
    currentAttempts.count += 1;
    loginAttempts.set(ip, currentAttempts);

    next();
  };
};

/**
 * Clean up expired rate limit entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [ip, attempts] of loginAttempts.entries()) {
    if (now > attempts.resetAt) {
      loginAttempts.delete(ip);
    }
  }
}, 5 * 60 * 1000); // Clean up every 5 minutes
