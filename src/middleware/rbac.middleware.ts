/**
 * RBAC Authorization Middleware
 * 
 * Comprehensive Role-Based Access Control middleware with granular permissions,
 * condition validation, ownership verification, and security audit logging
 */

import { Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  Permission,
  PermissionContext,
  PermissionResult,
  PermissionCondition,
  PermissionError,
  InsufficientPermissionError,
  ResourceAccessError,
  ConditionNotMetError,
  AuthorizedRequest,
  PermissionMiddlewareOptions,
  Resource,
  PermissionAction,
  UserRole,
  PermissionAuditLog
} from '../types/permissions.types';
import {
  PERMISSION_MATRIX,
  RESOURCE_OWNERSHIP,
  getPermissionsForRole,
  hasPermission,
  getPermissionConditions,
  requiresOwnership,
  getResourceOwnership
} from '../config/permissions.config';

/**
 * Permission Service Class
 * Handles all permission checking logic and condition validation
 */
export class PermissionService {
  private supabase = getSupabaseClient();

  /**
   * Check if user has permission for specific resource and action
   */
  async checkPermission(
    context: PermissionContext,
    resource: Resource,
    action: PermissionAction,
    options: Partial<PermissionMiddlewareOptions> = {}
  ): Promise<PermissionResult> {
    try {
      // Admin override check
      if (options.allowSuperAdmin !== false && context.userRole === 'admin') {
        return { allowed: true, reason: 'Admin override' };
      }

      // Check if role has basic permission
      if (!hasPermission(context.userRole, resource, action)) {
        return {
          allowed: false,
          reason: `Role ${context.userRole} does not have permission for ${action} on ${resource}`,
          missingPermissions: [{ resource, action }]
        };
      }

      // Get required conditions for this permission
      const conditions = getPermissionConditions(context.userRole, resource, action);
      
      if (conditions.length === 0) {
        return { allowed: true, reason: 'Permission granted without conditions' };
      }

      // Validate all required conditions
      const conditionResults = await Promise.all(
        conditions.map(condition => this.validateCondition(condition, context, resource))
      );

      const failedConditions = conditions.filter((_, index) => !conditionResults[index]);

      if (failedConditions.length > 0) {
        return {
          allowed: false,
          reason: `Required conditions not met: ${failedConditions.join(', ')}`,
          requiredConditions: failedConditions
        };
      }

      return { allowed: true, reason: 'All conditions satisfied' };

    } catch (error) {
      logger.error('Permission check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        resource,
        action
      });

      return {
        allowed: false,
        reason: 'Permission check failed due to internal error'
      };
    }
  }

  /**
   * Validate a specific permission condition
   */
  private async validateCondition(
    condition: PermissionCondition,
    context: PermissionContext,
    resource: Resource
  ): Promise<boolean> {
    switch (condition) {
      case 'own_resource':
        return this.validateOwnership(context, resource);

      case 'same_shop':
        return this.validateShopAccess(context, resource);

      case 'active_status':
        return this.validateActiveStatus(context);

      case 'verified_user':
        return this.validateUserVerification(context);

      case 'approved_shop':
        return this.validateShopApproval(context);

      case 'within_hours':
        return this.validateBusinessHours(context);

      case 'payment_verified':
        return this.validatePaymentVerification(context);

      case 'influencer_tier':
        return this.validateInfluencerTier(context);

      default:
        logger.warn('Unknown permission condition', { condition, context });
        return false;
    }
  }

  /**
   * Validate resource ownership
   */
  private async validateOwnership(
    context: PermissionContext,
    resource: Resource
  ): Promise<boolean> {
    if (!context.resourceId) {
      return true; // No specific resource to check ownership for
    }

    try {
      const ownership = getResourceOwnership(resource);
      
      const { data, error } = await this.supabase
        .from(resource)
        .select(ownership.ownerField)
        .eq('id', context.resourceId)
        .single();

      if (error || !data) {
        logger.warn('Failed to verify resource ownership', {
          error: error?.message,
          resource,
          resourceId: context.resourceId
        });
        return false;
      }

      return (data as any)[ownership.ownerField] === context.userId;

    } catch (error) {
      logger.error('Ownership validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource,
        resourceId: context.resourceId,
        userId: context.userId
      });
      return false;
    }
  }

  /**
   * Validate shop access (for shop owners)
   */
  private async validateShopAccess(
    context: PermissionContext,
    resource: Resource
  ): Promise<boolean> {
    if (!context.resourceId || !context.shopId) {
      return false;
    }

    try {
      const ownership = getResourceOwnership(resource);
      
      if (!ownership.shopField) {
        return false; // Resource doesn't have shop association
      }

      const { data, error } = await this.supabase
        .from(resource)
        .select(ownership.shopField)
        .eq('id', context.resourceId)
        .single();

      if (error || !data) {
        return false;
      }

      return (data as any)[ownership.shopField!] === context.shopId;

    } catch (error) {
      logger.error('Shop access validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resource,
        resourceId: context.resourceId,
        shopId: context.shopId
      });
      return false;
    }
  }

  /**
   * Validate user account is active
   */
  private validateActiveStatus(context: PermissionContext): boolean {
    return context.userStatus === 'active';
  }

  /**
   * Validate user email verification
   */
  private validateUserVerification(context: PermissionContext): boolean {
    return context.isEmailVerified === true;
  }

  /**
   * Validate shop approval status
   */
  private async validateShopApproval(context: PermissionContext): Promise<boolean> {
    if (!context.shopId) {
      return false;
    }

    try {
      const { data, error } = await this.supabase
        .from('shops')
        .select('shop_status')
        .eq('id', context.shopId)
        .single();

      if (error || !data) {
        return false;
      }

      return data.shop_status === 'approved';

    } catch (error) {
      logger.error('Shop approval validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: context.shopId
      });
      return false;
    }
  }

  /**
   * Validate business hours restriction
   */
  private validateBusinessHours(context: PermissionContext): boolean {
    if (!context.businessHours || !context.requestTime) {
      return true; // No restrictions if not specified
    }

    const currentTime = context.requestTime.getHours() * 100 + context.requestTime.getMinutes();
    const startTime = parseInt(context.businessHours.start.replace(':', ''));
    const endTime = parseInt(context.businessHours.end.replace(':', ''));

    return currentTime >= startTime && currentTime <= endTime;
  }

  /**
   * Validate payment method verification
   */
  private validatePaymentVerification(context: PermissionContext): boolean {
    return context.isPaymentVerified === true;
  }

  /**
   * Validate influencer tier requirements
   */
  private validateInfluencerTier(context: PermissionContext): boolean {
    return context.userRole === 'influencer' && !!context.influencerTier;
  }

  /**
   * Log permission check for audit trail
   */
  async logPermissionCheck(
    context: PermissionContext,
    resource: Resource,
    action: PermissionAction,
    result: PermissionResult,
    additionalContext?: Record<string, any>
  ): Promise<void> {
    try {
      const auditLog: PermissionAuditLog = {
        userId: context.userId,
        userRole: context.userRole,
        resource,
        action,
        allowed: result.allowed,
        timestamp: new Date(),
        ...(context.resourceId && { resourceId: context.resourceId }),
        ...(result.reason && { reason: result.reason }),
        ...(additionalContext && { additionalContext })
      };

      // Log to Winston
      logger.info('Permission check', {
        ...auditLog,
        level: result.allowed ? 'info' : 'warn'
      });

      // Store in database for compliance (optional)
      if (!result.allowed) {
        await this.supabase
          .from('audit_logs')
          .insert({
            user_id: context.userId,
            action: `permission_denied_${action}_${resource}`,
            resource_type: resource,
            resource_id: context.resourceId,
            details: {
              reason: result.reason,
              requiredConditions: result.requiredConditions,
              userRole: context.userRole
            },
            ip_address: additionalContext?.ip,
            user_agent: additionalContext?.userAgent
          });
      }

    } catch (error) {
      logger.error('Failed to log permission check', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        resource,
        action
      });
    }
  }
}

// Global permission service instance
const permissionService = new PermissionService();

/**
 * Create permission context from authenticated request
 */
function createPermissionContext(
  req: AuthorizedRequest,
  options: PermissionMiddlewareOptions
): PermissionContext {
  const user = req.user;
  if (!user) {
    throw new PermissionError('User not authenticated');
  }

  const context: PermissionContext = {
    userId: user.id,
    userRole: user.role,
    userStatus: user.status,
    requestTime: new Date()
  };

  if (user.shopId) context.shopId = user.shopId;
  if (options.getResourceId) {
    const resourceId = options.getResourceId(req);
    if (resourceId) context.resourceId = resourceId;
  }
  if (user.isEmailVerified !== undefined) context.isEmailVerified = user.isEmailVerified;
  if (user.isPaymentVerified !== undefined) context.isPaymentVerified = user.isPaymentVerified;
  if (user.influencerTier) context.influencerTier = user.influencerTier;
  if (!options.getShopId) context.businessHours = { start: '09:00', end: '21:00' };

  return context;
}

/**
 * Main RBAC authorization middleware factory
 */
export function requirePermission(options: PermissionMiddlewareOptions) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Create permission context
      const context = createPermissionContext(req, options);

      // Check permission
      const result = await permissionService.checkPermission(
        context,
        options.resource,
        options.action,
        options
      );

      // Log the permission check
      await permissionService.logPermissionCheck(
        context,
        options.resource,
        options.action,
        result,
        {
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.originalUrl,
          method: req.method
        }
      );

      // Handle permission result
      if (!result.allowed) {
        const error = new InsufficientPermissionError(
          options.resource,
          options.action,
          context.userRole,
          result.missingPermissions
        );

        if (options.errorHandler) {
          options.errorHandler(error, req, res);
          return;
        }

        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            reason: result.reason,
            requiredConditions: result.requiredConditions,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Store permission context in request for downstream use
      req.permissionContext = context;
      req.permissions = getPermissionsForRole(context.userRole);

      next();

    } catch (error) {
      if (error instanceof PermissionError) {
        logger.warn('Permission middleware error', {
          error: error.message,
          code: error.code,
          resource: options.resource,
          action: options.action,
          ip: req.ip
        });

        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.error('Unexpected permission middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        resource: options.resource,
        action: options.action,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Multiple permission checking (require ANY of the permissions)
 */
export function requireAnyPermission(
  permissions: Array<{resource: Resource; action: PermissionAction}>,
  options: Partial<PermissionMiddlewareOptions> = {}
) {
  return async (req: AuthorizedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = req.user;
      if (!user) {
        throw new PermissionError('User not authenticated');
      }

      // Check if user has ANY of the required permissions
      const hasAnyPermission = permissions.some(({ resource, action }) =>
        hasPermission(user.role, resource, action)
      );

      if (!hasAnyPermission) {
        const error = new InsufficientPermissionError(
          permissions[0].resource,
          permissions[0].action,
          user.role,
          permissions
        );

        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: `Requires any of: ${permissions.map(p => `${p.action} on ${p.resource}`).join(', ')}`,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next();

    } catch (error) {
      logger.error('Multiple permission check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        permissions,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Resource ownership middleware
 */
export function requireResourceOwnership(
  resource: Resource,
  getResourceId: (req: any) => string
) {
  return requirePermission({
    resource,
    action: 'read', // Default to read permission
    getResourceId,
    skipOwnershipCheck: false
  });
}

/**
 * Shop ownership middleware
 */
export function requireShopOwnership(getShopId: (req: any) => string) {
  return requirePermission({
    resource: 'shops',
    action: 'manage',
    getShopId,
    skipOwnershipCheck: false
  });
}

/**
 * Admin only middleware
 */
export function requireAdmin() {
  return (req: AuthorizedRequest, res: Response, next: NextFunction): void => {
         const user = req.user;
     if (!user || user.role !== 'admin') {
      res.status(403).json({
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

/**
 * Export permission service for direct use
 */
export { permissionService };

export default {
  requirePermission,
  requireAnyPermission,
  requireResourceOwnership,
  requireShopOwnership,
  requireAdmin,
  PermissionService,
  permissionService
}; 