import { Response } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { ShopAccessRequest } from '../middleware/shop-access.middleware';

export interface GetShopUsersQuery {
  status?: string; // Reservation status filter
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: string;
  limit?: string;
  search?: string; // Search by customer name or email
}

export class ShopUsersController {
  /**
   * Get all customers who made reservations at a specific shop
   */
  async getShopUsers(
    req: ShopAccessRequest & { query: GetShopUsersQuery },
    res: Response
  ): Promise<void> {
    try {
      const { shopId } = req.params;
      const {
        status,
        sortBy = 'total_reservations',
        sortOrder = 'desc',
        page = '1',
        limit = '20',
        search
      } = req.query;

      logger.info('📋 [SHOP-USERS] Getting shop customers REQUEST', {
        shopId,
        filters: { status, search },
        sort: { sortBy, sortOrder },
        pagination: { page, limit }
      });

      // Parse pagination
      const pageNum = Math.max(1, parseInt(page, 10));
      const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10)));

      const supabase = getSupabaseClient();

      // First, get all reservations for this shop with user info
      let reservationsQuery = supabase
        .from('reservations')
        .select(`
          user_id,
          status,
          total_amount,
          created_at,
          users!inner (
            id,
            email,
            name,
            phone_number,
            profile_image_url
          )
        `)
        .eq('shop_id', shopId);

      // Apply status filter if provided
      if (status) {
        reservationsQuery = reservationsQuery.eq('status', status);
      }

      const { data: reservations, error: reservationsError } = await reservationsQuery;

      if (reservationsError) {
        logger.error('❌ [SHOP-USERS] Failed to fetch reservations', {
          error: reservationsError.message,
          shopId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '고객 조회 중 오류가 발생했습니다.',
            details: reservationsError.message
          }
        });
        return;
      }

      // Aggregate customer data
      const customerMap = new Map<string, {
        id: string;
        email: string;
        name: string;
        phone_number: string | null;
        profile_image_url: string | null;
        total_reservations: number;
        total_spent: number;
        last_reservation_date: string;
        reservation_statuses: Record<string, number>;
      }>();

      (reservations || []).forEach((reservation: any) => {
        const user = reservation.users;
        if (!user) return;

        const userId = user.id;
        const existing = customerMap.get(userId);

        if (existing) {
          existing.total_reservations += 1;
          existing.total_spent += reservation.total_amount || 0;
          existing.reservation_statuses[reservation.status] =
            (existing.reservation_statuses[reservation.status] || 0) + 1;

          // Update last reservation date if this one is more recent
          if (new Date(reservation.created_at) > new Date(existing.last_reservation_date)) {
            existing.last_reservation_date = reservation.created_at;
          }
        } else {
          customerMap.set(userId, {
            id: user.id,
            email: user.email,
            name: user.name,
            phone_number: user.phone_number,
            profile_image_url: user.profile_image_url,
            total_reservations: 1,
            total_spent: reservation.total_amount || 0,
            last_reservation_date: reservation.created_at,
            reservation_statuses: {
              [reservation.status]: 1
            }
          });
        }
      });

      // Convert map to array
      let customers = Array.from(customerMap.values());

      // Apply search filter
      if (search) {
        const searchLower = search.toLowerCase();
        customers = customers.filter(customer =>
          customer.name?.toLowerCase().includes(searchLower) ||
          customer.email?.toLowerCase().includes(searchLower) ||
          customer.phone_number?.toLowerCase().includes(searchLower)
        );
      }

      // Apply sorting
      customers.sort((a, b) => {
        let aValue: any;
        let bValue: any;

        switch (sortBy) {
          case 'total_reservations':
            aValue = a.total_reservations;
            bValue = b.total_reservations;
            break;
          case 'total_spent':
            aValue = a.total_spent;
            bValue = b.total_spent;
            break;
          case 'last_reservation_date':
            aValue = new Date(a.last_reservation_date).getTime();
            bValue = new Date(b.last_reservation_date).getTime();
            break;
          case 'name':
            aValue = a.name?.toLowerCase() || '';
            bValue = b.name?.toLowerCase() || '';
            break;
          default:
            aValue = a.total_reservations;
            bValue = b.total_reservations;
        }

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      });

      // Apply pagination
      const total = customers.length;
      const offset = (pageNum - 1) * limitNum;
      const paginatedCustomers = customers.slice(offset, offset + limitNum);

      logger.info('✅ [SHOP-USERS] Shop customers retrieved successfully', {
        shopId,
        count: paginatedCustomers.length,
        total: total
      });

      res.json({
        success: true,
        data: {
          customers: paginatedCustomers,
          pagination: {
            total,
            page: pageNum,
            limit: limitNum,
            totalPages: Math.ceil(total / limitNum)
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
          message: '고객 조회 중 예상치 못한 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get reservation status distribution for shop customers
   */
  async getShopUserRoles(
    req: ShopAccessRequest,
    res: Response
  ): Promise<void> {
    try {
      const { shopId } = req.params;

      logger.info('📊 [SHOP-USERS] Getting customer reservation status distribution', { shopId });

      // Get all reservations for this shop
      const supabase = getSupabaseClient();
      const { data: reservations, error } = await supabase
        .from('reservations')
        .select('status, user_id')
        .eq('shop_id', shopId);

      if (error) {
        logger.error('❌ [SHOP-USERS] Failed to fetch reservations', {
          error: error.message,
          shopId
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'DATABASE_ERROR',
            message: '통계 조회 중 오류가 발생했습니다.',
            details: error.message
          }
        });
        return;
      }

      // Count reservation statuses
      const statusCounts = (reservations || []).reduce((acc, reservation) => {
        const status = reservation.status || 'unknown';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Count unique customers
      const uniqueCustomers = new Set((reservations || []).map(r => r.user_id));

      // Format response
      const statuses = Object.entries(statusCounts).map(([status, count]) => ({
        status,
        count
      }));

      logger.info('✅ [SHOP-USERS] Customer statistics retrieved successfully', {
        shopId,
        statusCount: statuses.length,
        totalReservations: reservations?.length || 0,
        uniqueCustomers: uniqueCustomers.size
      });

      res.json({
        success: true,
        data: {
          statuses,
          totalReservations: reservations?.length || 0,
          uniqueCustomers: uniqueCustomers.size
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
          message: '통계 조회 중 예상치 못한 오류가 발생했습니다.'
        }
      });
    }
  }
}
