/**
 * Shop Owner Authorization Middleware
 * 
 * Provides comprehensive authorization middleware for shop owner operations including:
 * - Shop ownership verification
 * - Role-based access control for shop_owner role
 * - Shop existence and status validation
 * - Security monitoring and audit logging
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { AuthenticatedRequest } from './auth.middleware';

// Extended Request interface for shop owner operations
export interface ShopOwnerRequest extends AuthenticatedRequest {
  shop?: {
    id: string;
    name: string;
    owner_id: string;
    shop_status: string;
    verification_status: string;
    created_at: string;
    updated_at: string;
  };
}

// Shop ownership verification error types
export class ShopOwnershipError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public code: string = 'SHOP_OWNERSHIP_ERROR'
  ) {
    super(message);
    this.name = 'ShopOwnershipError';
  }
}

export class ShopNotFoundError extends ShopOwnershipError {
  constructor(message: string = 'Shop not found') {
    super(message, 404, 'SHOP_NOT_FOUND');
    this.name = 'ShopNotFoundError';
  }
}

export class ShopNotOwnedError extends ShopOwnershipError {
  constructor(message: string = 'You do not own this shop') {
    super(message, 403, 'SHOP_NOT_OWNED');
    this.name = 'ShopNotOwnedError';
  }
}

export class ShopInactiveError extends ShopOwnershipError {
  constructor(message: string = 'Shop is not active') {
    super(message, 403, 'SHOP_INACTIVE');
    this.name = 'ShopInactiveError';
  }
}

export class ShopOwnerRoleRequiredError extends ShopOwnershipError {
  constructor(message: string = 'Shop owner role required') {
    super(message, 403, 'SHOP_OWNER_ROLE_REQUIRED');
    this.name = 'ShopOwnerRoleRequiredError';
  }
}

/**
 * Verify that the authenticated user has shop_owner or superadmin role
 */
export function requireShopOwnerRole() {
  return (req: ShopOwnerRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: '인증이 필요합니다.',
          details: '로그인 후 다시 시도해주세요.'
        }
      });
      return;
    }

    // Allow shop_owner and admin roles
    const allowedRoles = ['shop_owner', 'admin'];
    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Shop owner or admin role required', {
        userId: req.user.id,
        userRole: req.user.role,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      // Log security event for unauthorized access attempt
      securityMonitoringService.logSecurityEvent({
        event_type: 'auth_failure',
        user_id: req.user.id,
        source_ip: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.path,
        severity: 'medium',
        details: {
          requiredRoles: allowedRoles,
          actualRole: req.user.role,
          activity_type: 'role_verification_failed'
        }
      });

      res.status(403).json({
        success: false,
        error: {
          code: 'SHOP_OWNER_ROLE_REQUIRED',
          message: '샵 운영자 또는 관리자 권한이 필요합니다.',
          details: '샵 관리 기능을 사용하려면 샵 운영자 또는 관리자로 등록되어야 합니다.'
        }
      });
      return;
    }

    next();
  };
}

/**
 * Verify that the authenticated user owns a shop (superadmin can access any shop)
 */
export function requireShopOwnership() {
  return async (req: ShopOwnerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();
      const isAdmin = req.user.role === 'admin';

      console.log('🔍 [SHOP-MIDDLEWARE-DEBUG] requireShopOwnership called', {
        userId: req.user.id,
        userRole: req.user.role,
        isAdmin,
        path: req.path
      });

      // For admin, get the first active shop or any shop if shopId is in params
      let query = supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_id,
          shop_status,
          verification_status,
          created_at,
          updated_at
        `);

      // If admin and shopId in params/body/query/token, get that specific shop
      const shopIdFromToken = (req.user as any).shopId;
      const shopIdFromRequest = req.params.shopId || req.params.id || req.body.shopId || (req.query.shopId as string) || shopIdFromToken;

      if (shopIdFromRequest) {
        // Use specific shopId from token, params, body, or query (for both admin and shop_owner)
        query = query.eq('id', shopIdFromRequest);
        if (!isAdmin) {
          // Non-admin must own the shop
          query = query.eq('owner_id', req.user.id);
        }
      } else if (isAdmin) {
        // Admin without specific shopId: get first active shop
        query = query.eq('shop_status', 'active').limit(1);
      } else {
        // Regular shop_owner without shopId: get first owned active shop
        query = query.eq('owner_id', req.user.id).eq('shop_status', 'active').limit(1);
      }

      const { data: shop, error } = await query.single();

      console.log('🔍 [SHOP-MIDDLEWARE-DEBUG] Query result', {
        hasShop: !!shop,
        hasError: !!error,
        error: error?.message,
        errorCode: error?.code,
        shopId: shop?.id,
        ownerId: shop?.owner_id
      });

      if (error || !shop) {
        logger.warn('User has no registered shop', {
          userId: req.user.id,
          userRole: req.user.role,
          isAdmin,
          error: error?.message,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        // Log security event for shop access attempt without ownership
        try {
          await securityMonitoringService.logSecurityEvent({
            event_type: 'auth_failure',
            user_id: req.user.id,
            source_ip: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            endpoint: req.path,
            severity: 'low',
            details: {
              activity_type: 'shop_access_without_ownership',
              errorCode: error?.code || 'NO_SHOP_FOUND',
              userRole: req.user.role
            }
          });
        } catch (securityError) {
          // Silently fail if security_events table doesn't exist
          logger.debug('Security monitoring failed', { error: securityError instanceof Error ? securityError.message : 'Unknown error' });
        }

        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: isAdmin ? '샵을 찾을 수 없습니다.' : '등록된 샵이 없습니다.',
            details: isAdmin ? '요청한 샵이 존재하지 않습니다.' : '샵 등록을 먼저 완료해주세요.'
          }
        });
        return;
      }

      // For non-admin, check if shop is active
      if (!isAdmin && shop.shop_status !== 'active') {
        logger.warn('User attempted to access inactive shop', {
          userId: req.user.id,
          shopId: shop.id,
          shopStatus: shop.shop_status,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        // Log security event for inactive shop access attempt
        try {
          await securityMonitoringService.logSecurityEvent({
            event_type: 'auth_failure',
            user_id: req.user.id,
            source_ip: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            endpoint: req.path,
            severity: 'low',
            details: {
              activity_type: 'inactive_shop_access',
              shopId: shop.id,
              shopStatus: shop.shop_status
            }
          });
        } catch (securityError) {
          // Silently fail if security_events table doesn't exist
          logger.debug('Security monitoring failed', { error: securityError instanceof Error ? securityError.message : 'Unknown error' });
        }

        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_INACTIVE',
            message: '샵이 활성화되지 않았습니다.',
            details: `현재 샵 상태: ${shop.shop_status}. 샵 승인을 기다려주세요.`
          }
        });
        return;
      }

      // Add shop information to request
      req.shop = shop;

      logger.debug('Shop ownership verified', {
        userId: req.user.id,
        userRole: req.user.role,
        isAdmin,
        shopId: shop.id,
        shopName: shop.name,
        shopStatus: shop.shop_status,
        verificationStatus: shop.verification_status
      });

      next();
    } catch (error) {
      logger.error('Shop ownership verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 소유권 확인 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  };
}

/**
 * Verify shop ownership for a specific shop ID (from URL params or body)
 */
export function requireSpecificShopOwnership(shopIdSource: 'params' | 'body' = 'params', shopIdField: string = 'shopId') {
  return async (req: ShopOwnerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Extract shop ID from request
      let shopId: string;
      if (shopIdSource === 'params') {
        shopId = req.params[shopIdField];
      } else {
        shopId = req.body[shopIdField];
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            details: `${shopIdField} 필드를 제공해주세요.`
          }
        });
        return;
      }

      const supabase = getSupabaseClient();
      const isAdmin = req.user.role === 'admin';

      // Build query for shop verification
      let query = supabase
        .from('shops')
        .select(`
          id,
          name,
          owner_id,
          shop_status,
          verification_status,
          created_at,
          updated_at
        `)
        .eq('id', shopId);

      // Admins can access any shop, shop_owners must own it
      if (!isAdmin) {
        query = query.eq('owner_id', req.user.id);
      }

      const { data: shop, error } = await query.single();

      if (error || !shop) {
        logger.warn(isAdmin ? 'Admin attempted to access non-existent shop' : 'User attempted to access shop they do not own', {
          userId: req.user.id,
          userRole: req.user.role,
          isAdmin,
          shopId,
          error: error?.message,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        // Log security event for unauthorized shop access attempt
        try {
          await securityMonitoringService.logSecurityEvent({
            event_type: 'auth_failure',
            user_id: req.user.id,
            source_ip: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            endpoint: req.path,
            severity: isAdmin ? 'low' : 'high',
            details: {
              activity_type: isAdmin ? 'shop_not_found' : 'unauthorized_shop_access',
              targetShopId: shopId,
              errorCode: error?.code || 'SHOP_NOT_FOUND',
              userRole: req.user.role
            }
          });
        } catch (securityError) {
          // Silently fail if security_events table doesn't exist
          logger.debug('Security monitoring failed', { error: securityError instanceof Error ? securityError.message : 'Unknown error' });
        }

        res.status(isAdmin ? 404 : 403).json({
          success: false,
          error: {
            code: isAdmin ? 'SHOP_NOT_FOUND' : 'SHOP_NOT_OWNED',
            message: isAdmin ? '샵을 찾을 수 없습니다.' : '해당 샵에 대한 권한이 없습니다.',
            details: isAdmin ? '요청한 샵이 존재하지 않습니다.' : '자신이 소유한 샵만 관리할 수 있습니다.'
          }
        });
        return;
      }

      // For non-admin, check if shop is active
      if (!isAdmin && shop.shop_status !== 'active') {
        logger.warn('User attempted to access inactive shop', {
          userId: req.user.id,
          shopId: shop.id,
          shopStatus: shop.shop_status,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_INACTIVE',
            message: '샵이 활성화되지 않았습니다.',
            details: `현재 샵 상태: ${shop.shop_status}. 샵 승인을 기다려주세요.`
          }
        });
        return;
      }

      // Add shop information to request
      req.shop = shop;

      logger.debug('Specific shop ownership verified', {
        userId: req.user.id,
        userRole: req.user.role,
        isAdmin,
        shopId: shop.id,
        shopName: shop.name,
        shopStatus: shop.shop_status
      });

      next();
    } catch (error) {
      logger.error('Specific shop ownership verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        shopId: shopIdSource === 'params' ? req.params[shopIdField] : req.body[shopIdField],
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 소유권 확인 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  };
}

/**
 * Verify shop ownership for service operations (service belongs to user's shop)
 */
export function requireServiceOwnership() {
  return async (req: ShopOwnerRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (!req.user) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const serviceId = req.params.serviceId || req.params.id;
      if (!serviceId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SERVICE_ID',
            message: '서비스 ID가 필요합니다.',
            details: '서비스 ID를 제공해주세요.'
          }
        });
        return;
      }

      const supabase = getSupabaseClient();

      // Verify service ownership through shop ownership
      const { data: service, error } = await supabase
        .from('shop_services')
        .select(`
          id,
          name,
          shop_id,
          shop:shops!inner(
            id,
            name,
            owner_id,
            shop_status
          )
        `)
        .eq('id', serviceId)
        .eq('shop.owner_id', req.user.id)
        .single() as { data: any; error: any };

      if (error || !service) {
        logger.warn('User attempted to access service they do not own', {
          userId: req.user.id,
          serviceId,
          error: error?.message,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        // Log security event for unauthorized service access attempt
        try {
          await securityMonitoringService.logSecurityEvent({
            event_type: 'auth_failure',
            user_id: req.user.id,
            source_ip: req.ip || 'unknown',
            user_agent: req.headers['user-agent'] || 'unknown',
            endpoint: req.path,
            severity: 'medium',
            details: {
              activity_type: 'unauthorized_service_access',
              targetServiceId: serviceId,
              errorCode: error?.code || 'SERVICE_NOT_FOUND'
            }
          });
        } catch (securityError) {
          // Silently fail if security_events table doesn't exist
          logger.debug('Security monitoring failed', { error: securityError instanceof Error ? securityError.message : 'Unknown error' });
        }

        res.status(403).json({
          success: false,
          error: {
            code: 'SERVICE_NOT_OWNED',
            message: '해당 서비스에 대한 권한이 없습니다.',
            details: '자신이 소유한 샵의 서비스만 관리할 수 있습니다.'
          }
        });
        return;
      }

      // Check if shop is active
      if (service.shop.shop_status !== 'active') {
        logger.warn('User attempted to access service from inactive shop', {
          userId: req.user.id,
          serviceId,
          shopId: service.shop.id,
          shopStatus: service.shop.shop_status,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          endpoint: req.path
        });

        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_INACTIVE',
            message: '샵이 활성화되지 않았습니다.',
            details: `현재 샵 상태: ${service.shop.shop_status}. 샵 승인을 기다려주세요.`
          }
        });
        return;
      }

      // Add shop and service information to request
      req.shop = {
        id: service.shop.id,
        name: service.shop.name,
        owner_id: service.shop.owner_id,
        shop_status: service.shop.shop_status,
        verification_status: 'verified', // Default for existing shops
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      logger.debug('Service ownership verified', {
        userId: req.user.id,
        serviceId: service.id,
        serviceName: service.name,
        shopId: service.shop.id,
        shopName: service.shop.name
      });

      next();
    } catch (error) {
      logger.error('Service ownership verification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        serviceId: req.params.serviceId || req.params.id,
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        endpoint: req.path
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 소유권 확인 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  };
}

/**
 * Combined middleware: require shop owner role AND shop ownership
 */
export function requireShopOwnerWithShop() {
  return [
    requireShopOwnerRole(),
    requireShopOwnership()
  ];
}

/**
 * Combined middleware: require shop owner role AND specific shop ownership
 */
export function requireShopOwnerWithSpecificShop(shopIdSource: 'params' | 'body' = 'params', shopIdField: string = 'shopId') {
  return [
    requireShopOwnerRole(),
    requireSpecificShopOwnership(shopIdSource, shopIdField)
  ];
}

/**
 * Combined middleware: require shop owner role AND service ownership
 */
export function requireShopOwnerWithService() {
  return [
    requireShopOwnerRole(),
    requireServiceOwnership()
  ];
}

/**
 * Utility function to get shop ID from request
 */
export function getShopIdFromRequest(req: ShopOwnerRequest): string | null {
  // First check if shop is already loaded in request
  if (req.shop?.id) {
    return req.shop.id;
  }

  // Check common parameter names
  const shopId = req.params.shopId || 
                 req.params.id || 
                 req.body.shopId || 
                 req.body.shop_id;

  return shopId || null;
}

/**
 * Utility function to check if user has shop owner role
 */
export function isShopOwner(req: ShopOwnerRequest): boolean {
  return req.user?.role === 'shop_owner';
}

/**
 * Utility function to check if user owns a specific shop
 */
export function ownsShop(req: ShopOwnerRequest, shopId: string): boolean {
  return req.shop?.id === shopId && req.shop?.owner_id === req.user?.id;
}

export default {
  requireShopOwnerRole,
  requireShopOwnership,
  requireSpecificShopOwnership,
  requireServiceOwnership,
  requireShopOwnerWithShop,
  requireShopOwnerWithSpecificShop,
  requireShopOwnerWithService,
  getShopIdFromRequest,
  isShopOwner,
  ownsShop,
  ShopOwnershipError,
  ShopNotFoundError,
  ShopNotOwnedError,
  ShopInactiveError,
  ShopOwnerRoleRequiredError
};
