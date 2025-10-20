import { Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { ShopAccessRequest } from '../middleware/shop-access.middleware';

export interface GetShopUsersQuery {
  role?: string;
  status?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
}

export class ShopUsersController {
  /**
   * Get all users for a specific shop
   */
  async getShopUsers(
    req: ShopAccessRequest & { query: GetShopUsersQuery },
    res: Response
  ): Promise<void> {
    try {
      const { shopId } = req.params;
      const {
        role,
        status,
        sortBy = 'created_at',
        sortOrder = 'desc',
        page = '1',
        limit = '20'
      } = req.query;

      logger.info('📋 [SHOP-USERS] Getting shop users REQUEST', {
        shopId,
        filters: { role, status },
        sort: { sortBy, sortOrder },
        pagination: { page, limit }
      });

      // Parse pagination
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));
      const offset = (pageNum - 1) * limitNum;

      // Build query
      const supabase = getSupabaseClient();
      let query = supabase
        .from('users')
        .select('id, email, name, phone_number, user_role, user_status, shop_id, shop_name, profile_image_url, created_at, updated_at, last_login_at', { count: 'exact' })
        .eq('shop_id', shopId);

      // Apply filters
      if (role) {
        query = query.eq('user_role', role);
      }

      if (status) {
        query = query.eq('user_status', status);
      }

      // Apply sorting - ensure we use actual database column names
      logger.info('🔍 [SHOP-USERS-DEBUG] BEFORE transformation', {
        sortBy: sortBy,
        typeof: typeof sortBy,
        value: JSON.stringify(sortBy)
      });

      const dbSortColumn = sortBy.replace(/-/g, '_');

      logger.info('🔍 [SHOP-USERS-DEBUG] AFTER transformation', {
        dbSortColumn: dbSortColumn,
        willUseForOrder: dbSortColumn,
        sortOrder: sortOrder
      });

      query = query.order(dbSortColumn, { ascending: sortOrder === 'asc' });

      // Apply pagination
      query = query.range(offset, offset + limitNum - 1);

      // Execute query
      const { data: users, error, count } = await query;

      if (error) {
        logger.error('❌ [SHOP-USERS] Failed to fetch shop users', {
          error: error.message,
          shopId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '사용자 조회 중 오류가 발생했습니다.',
            details: error.message
          }
        });
        return;
      }

      logger.info('✅ [SHOP-USERS] Shop users retrieved successfully', {
        shopId,
        count: users?.length || 0,
        total: count
      });

      res.json({
        success: true,
        data: {
          users: users || [],
          pagination: {
            total: count || 0,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil((count || 0) / limitNum)
          }
        }
      });
    } catch (error) {
      logger.error('💥 [SHOP-USERS] Unexpected error in getShopUsers', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '사용자 조회 중 예상치 못한 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get user role distribution for a shop
   */
  async getShopUserRoles(
    req: ShopAccessRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shopId } = req.params;

      logger.info('📊 [SHOP-USERS] Getting shop user roles', { shopId });

      // Get role distribution
      const supabase = getSupabaseClient();
      const { data: users, error } = await supabase
        .from('users')
        .select('user_role')
        .eq('shop_id', shopId);

      if (error) {
        logger.error('❌ [SHOP-USERS] Failed to fetch shop user roles', {
          error: error.message,
          shopId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '역할 조회 중 오류가 발생했습니다.',
            details: error.message
          }
        });
        return;
      }

      // Count roles
      const roleCounts = (users || []).reduce((acc, user) => {
        const role = user.user_role || 'unknown';
        acc[role] = (acc[role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Format response
      const roles = Object.entries(roleCounts).map(([role, count]) => ({
        role,
        count
      }));

      logger.info('✅ [SHOP-USERS] Shop user roles retrieved successfully', {
        shopId,
        roleCount: roles.length,
        totalUsers: users?.length || 0
      });

      res.json({
        success: true,
        data: {
          roles,
          totalUsers: users?.length || 0
        }
      });
    } catch (error) {
      logger.error('💥 [SHOP-USERS] Unexpected error in getShopUserRoles', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '역할 조회 중 예상치 못한 오류가 발생했습니다.'
        }
      });
    }
  }
}
