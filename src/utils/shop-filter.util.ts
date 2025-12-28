/**
 * Shop Owner Filtering Utilities
 *
 * Provides standardized functions for enforcing role-based data filtering
 * to prevent Shop Owners from accessing other shops' data.
 *
 * SECURITY: All Admin API endpoints that return shop-specific data MUST use these utilities
 * to ensure Shop Owners can only access their own shop's data.
 */

import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Response } from 'express';

/**
 * Get effective shop ID for filtering based on user role
 *
 * @param req - Authenticated request with user info
 * @param requestedShopId - Shop ID from query parameters or request body (optional)
 * @returns Effective shop ID to use for filtering
 *
 * @example
 * // In controller
 * const { shopId: requestedShopId, ...otherParams } = req.query;
 * const effectiveShopId = getEffectiveShopId(req, requestedShopId as string);
 * const result = await service.getData({ ...otherParams, shopId: effectiveShopId });
 */
export function getEffectiveShopId(
  req: AuthenticatedRequest,
  requestedShopId?: string
): string | undefined {
  const userRole = req.user?.role;
  const userShopId = req.user?.shop_id;

  // Shop Owner는 무조건 자신의 shopId만 사용 (쿼리 파라미터 무시)
  if (userRole === 'shop_owner') {
    return userShopId;
  }

  // Admin은 요청된 shopId 사용 가능 (선택적 필터)
  if (userRole === 'admin') {
    return requestedShopId;
  }

  // 기타 역할은 필터 없음
  return undefined;
}

/**
 * Validate that shop owner has shop_id in their JWT token
 *
 * @param req - Authenticated request
 * @throws Error with code 'SHOP_ID_REQUIRED' if shop owner doesn't have shop_id
 *
 * @example
 * try {
 *   validateShopOwnerShopId(req);
 * } catch (error) {
 *   if (error.message === 'SHOP_ID_REQUIRED') {
 *     return res.status(403).json({ error: 'Shop ID required' });
 *   }
 * }
 */
export function validateShopOwnerShopId(req: AuthenticatedRequest): void {
  if (req.user?.role === 'shop_owner' && !req.user?.shop_id) {
    const error = new Error('SHOP_ID_REQUIRED');
    error.name = 'ShopIdRequiredError';
    throw error;
  }
}

/**
 * Send standardized error response for missing shop ID
 *
 * @param res - Express response object
 *
 * @example
 * if (userRole === 'shop_owner' && !userShopId) {
 *   return sendShopIdRequiredError(res);
 * }
 */
export function sendShopIdRequiredError(res: Response): void {
  res.status(403).json({
    success: false,
    error: {
      code: 'SHOP_ID_REQUIRED',
      message: '샵 ID가 필요합니다.',
      timestamp: new Date().toISOString()
    }
  });
}

/**
 * Validate and get effective shop ID with automatic error handling
 * Returns null if validation fails and error response is sent
 *
 * @param req - Authenticated request
 * @param res - Express response object
 * @param requestedShopId - Optional shop ID from request
 * @returns Effective shop ID or null if validation failed
 *
 * @example
 * const effectiveShopId = validateAndGetShopId(req, res, req.query.shopId as string);
 * if (effectiveShopId === null) return; // Error response already sent
 *
 * const result = await service.getData({ shopId: effectiveShopId });
 */
export function validateAndGetShopId(
  req: AuthenticatedRequest,
  res: Response,
  requestedShopId?: string
): string | undefined | null {
  const userRole = req.user?.role;
  const userShopId = req.user?.shop_id;

  // Validate shop owner has shop_id
  if (userRole === 'shop_owner' && !userShopId) {
    sendShopIdRequiredError(res);
    return null;
  }

  // Return effective shop ID
  return getEffectiveShopId(req, requestedShopId);
}

/**
 * Check if user is a shop owner
 *
 * @param req - Authenticated request
 * @returns True if user is a shop owner
 */
export function isShopOwner(req: AuthenticatedRequest): boolean {
  return req.user?.role === 'shop_owner';
}

/**
 * Check if user is an admin
 *
 * @param req - Authenticated request
 * @returns True if user is admin
 */
export function isAdmin(req: AuthenticatedRequest): boolean {
  const role = req.user?.role;
  return role === 'admin';
}

/**
 * Get user's shop ID (only for shop owners)
 *
 * @param req - Authenticated request
 * @returns Shop ID if user is shop owner, undefined otherwise
 */
export function getUserShopId(req: AuthenticatedRequest): string | undefined {
  if (req.user?.role === 'shop_owner') {
    return req.user?.shop_id;
  }
  return undefined;
}
