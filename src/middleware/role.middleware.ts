/**
 * Role-based Access Control Middleware
 * 
 * Provides role-based authorization for different user types
 */

import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { logger } from '../utils/logger';

/**
 * User roles enum
 * Note: This enum is deprecated. Use UserRole from unified-auth.types.ts instead.
 * Kept for backward compatibility with legacy code.
 */
export enum UserRole {
  USER = 'user',
  ADMIN = 'admin',
  SHOP_OWNER = 'shop_owner',
  CUSTOMER = 'customer'
}

/**
 * Role hierarchy for permission checking
 */
const ROLE_HIERARCHY: Record<UserRole, number> = {
  [UserRole.USER]: 1,
  [UserRole.CUSTOMER]: 2,
  [UserRole.SHOP_OWNER]: 3,
  [UserRole.ADMIN]: 4
};

/**
 * Middleware to require specific role
 */
export const requireRole = (requiredRole: UserRole | UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

      const userRole = req.user.role as UserRole;
      const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];

      // Check if user has any of the required roles
      const hasRequiredRole = requiredRoles.some(role => {
        if (role === userRole) return true;
        
        // Check role hierarchy (higher roles can access lower role resources)
        const userRoleLevel = ROLE_HIERARCHY[userRole] || 0;
        const requiredRoleLevel = ROLE_HIERARCHY[role] || 0;
        
        return userRoleLevel >= requiredRoleLevel;
      });

      if (!hasRequiredRole) {
        logger.warn('Access denied due to insufficient role', {
          userId: req.user.id,
          userRole,
          requiredRoles,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'INSUFFICIENT_ROLE',
            message: 'Insufficient permissions for this operation',
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Role middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ROLE_CHECK_FAILED',
          message: 'Failed to verify user role',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Middleware to require admin role
 */
export const requireAdmin = requireRole(UserRole.ADMIN);

/**
 * Middleware to require shop owner role
 */
export const requireShopOwner = requireRole(UserRole.SHOP_OWNER);

/**
 * Middleware to check if user can access resource
 */
export const canAccessResource = (resourceOwnerId: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

      const userRole = req.user.role as UserRole;
      const userId = req.user.id;

      // Admin can access any resource
      if (userRole === UserRole.ADMIN) {
        return next();
      }

      // Users can only access their own resources
      if (userId === resourceOwnerId) {
        return next();
      }

      logger.warn('Access denied to resource', {
        userId,
        userRole,
        resourceOwnerId,
        endpoint: req.originalUrl
      });

      return res.status(403).json({
        success: false,
        error: {
          code: 'RESOURCE_ACCESS_DENIED',
          message: 'Access denied to this resource',
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Resource access check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'RESOURCE_CHECK_FAILED',
          message: 'Failed to verify resource access',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

/**
 * Middleware to check if user can perform action
 */
export const canPerformAction = (action: string, resource?: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
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

      const userRole = req.user.role as UserRole;
      const userId = req.user.id;

      // Define action permissions
      const actionPermissions: Record<string, UserRole[]> = {
        'read:users': [UserRole.ADMIN],
        'write:users': [UserRole.ADMIN],
        'delete:users': [UserRole.ADMIN],
        'read:analytics': [UserRole.ADMIN],
        'write:analytics': [UserRole.ADMIN],
        'read:security': [UserRole.ADMIN],
        'write:security': [UserRole.ADMIN],
        'manage:system': [UserRole.ADMIN]
      };

      const allowedRoles = actionPermissions[action] || [UserRole.USER];
      const hasPermission = allowedRoles.includes(userRole) || 
                           allowedRoles.some(role => ROLE_HIERARCHY[userRole] >= ROLE_HIERARCHY[role]);

      if (!hasPermission) {
        logger.warn('Action denied due to insufficient permissions', {
          userId,
          userRole,
          action,
          resource,
          endpoint: req.originalUrl
        });

        return res.status(403).json({
          success: false,
          error: {
            code: 'ACTION_DENIED',
            message: 'Insufficient permissions for this action',
            timestamp: new Date().toISOString()
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Action permission check error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        action
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'PERMISSION_CHECK_FAILED',
          message: 'Failed to verify action permissions',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
};

