/**
 * Admin Authentication Middleware
 * 
 * Provides admin-specific authentication and authorization
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { UserRole } from './role.middleware';
import { logger } from '../utils/logger';

/**
 * Middleware to require admin authentication
 */
export const requireAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userRole = req.user.role;

    // Check if user is admin
    if (userRole !== 'admin') {
      logger.warn('Admin access denied', {
        userId: req.user.id,
        userRole,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_ACCESS_REQUIRED',
          message: 'Admin access required for this operation',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Admin auth middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ADMIN_AUTH_FAILED',
        message: 'Failed to verify admin authentication',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Middleware to require super admin authentication
 */
export const requireSuperAdminAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
    }

    const userRole = req.user.role;

    // DB only has 'admin' role - treat all admins as having full access
    if (userRole !== 'admin') {
      logger.warn('Super admin access denied', {
        userId: req.user.id,
        userRole,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'SUPER_ADMIN_ACCESS_REQUIRED',
          message: 'Super admin access required for this operation',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  } catch (error) {
    logger.error('Super admin auth middleware error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SUPER_ADMIN_AUTH_FAILED',
        message: 'Failed to verify super admin authentication',
        timestamp: new Date().toISOString()
      }
    });
  }
};

/**
 * Alias for requireAdminAuth for backward compatibility
 */
export const requireAdminRole = requireAdminAuth;

/**
 * Middleware to log admin actions
 */
export const logAdminAction = (action: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (req.user) {
        logger.info('Admin action performed', {
          adminId: req.user.id,
          adminRole: req.user.role,
          action,
          endpoint: req.originalUrl,
          method: req.method,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent']
        });
      }
      next();
    } catch (error) {
      logger.error('Admin action logging error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action
      });
      next(); // Don't block the request if logging fails
    }
  };
};
