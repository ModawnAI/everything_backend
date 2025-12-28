import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';

/**
 * Shop Access Validation Middleware
 *
 * Validates that users can only access shops they are authorized for:
 * - Platform admins (admin) can access any shop
 * - Shop roles (shop_owner) can only access their own shop
 *
 * This middleware should be applied to all /api/shops/:shopId/* routes
 */

const SHOP_ROLES = ['shop_owner'];
const PLATFORM_ADMIN_ROLES = ['admin'];

export interface ShopAccessRequest extends AuthenticatedRequest {
  params: {
    shopId: string;
    [key: string]: string;
  };
}

/**
 * Middleware to validate shop access based on user role and shopId
 */
export async function validateShopAccess(
  req: ShopAccessRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { shopId } = req.params;
    const user = req.user;

    // Ensure user is authenticated
    if (!user || !user.id) {
      logger.warn('⚠️ [SHOP-ACCESS] Unauthenticated user attempting shop access', {
        shopId,
        ip: req.ip
      });
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required'
        }
      });
      return;
    }

    // Extract role and shopId from user (could be from JWT token or database)
    const userRole = user.role || user.user_role;
    const userShopId = user.shopId || user.shop_id;

    logger.info('🔍 [SHOP-ACCESS] Validating shop access', {
      userId: user.id,
      userRole,
      userShopId,
      requestedShopId: shopId
    });

    // Platform admins can access any shop
    if (PLATFORM_ADMIN_ROLES.includes(userRole)) {
      logger.info('✅ [SHOP-ACCESS] Platform admin access granted', {
        userId: user.id,
        role: userRole,
        shopId
      });
      return next();
    }

    // Shop roles must have a shopId
    if (SHOP_ROLES.includes(userRole)) {
      if (!userShopId) {
        logger.error('❌ [SHOP-ACCESS] Shop role without shopId', {
          userId: user.id,
          role: userRole
        });
        res.status(403).json({
          success: false,
          error: {
            code: 'INVALID_USER_CONFIGURATION',
            message: 'User configuration error: Shop role requires shop assignment'
          }
        });
        return;
      }

      // Shop users can only access their own shop
      if (userShopId !== shopId) {
        logger.warn('⚠️ [SHOP-ACCESS] Shop access denied: User attempting to access different shop', {
          userId: user.id,
          userShopId,
          requestedShopId: shopId,
          ip: req.ip
        });
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ACCESS_DENIED',
            message: 'Access denied: You can only access your own shop'
          }
        });
        return;
      }

      logger.info('✅ [SHOP-ACCESS] Shop role access granted', {
        userId: user.id,
        role: userRole,
        shopId
      });
      return next();
    }

    // Invalid role for shop access
    logger.warn('⚠️ [SHOP-ACCESS] Invalid role for shop access', {
      userId: user.id,
      role: userRole,
      shopId
    });
    res.status(403).json({
      success: false,
      error: {
        code: 'INVALID_ROLE',
        message: 'Access denied: Invalid role for shop access'
      }
    });
  } catch (error) {
    logger.error('💥 [SHOP-ACCESS] Shop access validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      shopId: req.params.shopId,
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Internal server error during access validation'
      }
    });
  }
}

/**
 * Middleware factory to validate shop access and log audit trail
 *
 * Usage:
 * router.use('/api/shops/:shopId/*', validateShopAccessWithAudit());
 */
export function validateShopAccessWithAudit() {
  return async (req: ShopAccessRequest, res: Response, next: NextFunction): Promise<void> => {
    // First validate access
    await validateShopAccess(req, res, () => {
      // If access is granted, log to audit trail
      logShopAccess(req);
      next();
    });
  };
}

/**
 * Log shop access to audit trail for security and compliance
 */
async function logShopAccess(req: ShopAccessRequest): Promise<void> {
  try {
    const { shopId } = req.params;
    const user = req.user;

    // This would integrate with your audit logging system
    // For now, just log to application logs
    logger.info('📋 [AUDIT] Shop access logged', {
      userId: user?.id,
      shopId,
      action: `${req.method} ${req.path}`,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      timestamp: new Date().toISOString()
    });

    // TODO: Insert into user_shop_access_log table if detailed audit is required
    // const supabase = getSupabaseClient();
    // await supabase.from('user_shop_access_log').insert({
    //   user_id: user?.id,
    //   shop_id: shopId,
    //   action: `${req.method} ${req.path}`,
    //   ip_address: req.ip,
    //   user_agent: req.get('User-Agent')
    // });
  } catch (error) {
    // Don't fail the request if audit logging fails
    logger.error('⚠️ [AUDIT] Failed to log shop access', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Helper function to check if user has platform admin role
 */
export function isPlatformAdmin(role: string): boolean {
  return PLATFORM_ADMIN_ROLES.includes(role);
}

/**
 * Helper function to check if user has shop role
 */
export function isShopRole(role: string): boolean {
  return SHOP_ROLES.includes(role);
}

export default {
  validateShopAccess,
  validateShopAccessWithAudit,
  isPlatformAdmin,
  isShopRole
};
