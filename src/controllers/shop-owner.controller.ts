/**
 * Shop Owner Controller
 * 
 * Handles shop owner dashboard operations including:
 * - Shop analytics and performance metrics
 * - Reservation management and status updates
 * - Shop profile and settings management
 * - Revenue and payment tracking
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { ReservationStatus, PaymentStatus } from '../types/database.types';

// Request interfaces
interface ShopOwnerRequest extends Request {
  user?: {
    id: string;
    user_role: string;
  };
}

interface ReservationStatusRequest extends ShopOwnerRequest {
  params: {
    reservationId: string;
  };
  body: {
    status: ReservationStatus;
    notes?: string;
  };
}

interface AnalyticsRequest extends ShopOwnerRequest {
  query: {
    period?: string; // 'day', 'week', 'month', 'year'
    startDate?: string;
    endDate?: string;
  };
}

interface ReservationListRequest extends ShopOwnerRequest {
  query: {
    status?: ReservationStatus;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
    search?: string;
  };
}

export class ShopOwnerController {
  private supabase = getSupabaseClient();

  /**
   * GET /api/shop-owner/dashboard
   * Get shop owner dashboard overview
   */
  async getDashboard(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Get user's shops
      const { data: shops, error: shopsError } = await this.supabase
        .from('shops')
        .select('*')
        .eq('owner_id', userId)
        .eq('shop_status', 'active');

      if (shopsError) {
        logger.error('Failed to get user shops', { error: shopsError.message, userId });
        res.status(500).json({
          error: {
            code: 'SHOPS_FETCH_FAILED',
            message: '샵 정보 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!shops || shops.length === 0) {
        res.status(404).json({
          error: {
            code: 'NO_SHOPS_FOUND',
            message: '활성화된 샵이 없습니다.',
            details: '샵을 등록하거나 활성화해주세요.'
          }
        });
        return;
      }

      const shopIds = shops.map(shop => shop.id);

      // Get today's reservations
      const today = new Date().toISOString().split('T')[0];
      const { data: todayReservations, error: todayError } = await this.supabase
        .from('reservations')
        .select('*')
        .in('shop_id', shopIds)
        .eq('reservation_date', today)
        .in('status', ['requested', 'confirmed']);

      if (todayError) {
        logger.error('Failed to get today reservations', { error: todayError.message });
      }

      // Get this month's revenue
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const { data: monthlyRevenue, error: revenueError } = await this.supabase
        .from('reservations')
        .select('total_amount')
        .in('shop_id', shopIds)
        .eq('status', 'completed')
        .gte('completed_at', startOfMonth.toISOString());

      if (revenueError) {
        logger.error('Failed to get monthly revenue', { error: revenueError.message });
      }

      // Get pending reservations
      const { data: pendingReservations, error: pendingError } = await this.supabase
        .from('reservations')
        .select('*')
        .in('shop_id', shopIds)
        .eq('status', 'requested')
        .order('created_at', { ascending: false })
        .limit(5);

      if (pendingError) {
        logger.error('Failed to get pending reservations', { error: pendingError.message });
      }

      // Calculate metrics
      const totalRevenue = monthlyRevenue?.reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
      const todayCount = todayReservations?.length || 0;
      const pendingCount = pendingReservations?.length || 0;

      const dashboard = {
        shops: shops.length,
        todayReservations: todayCount,
        pendingReservations: pendingCount,
        monthlyRevenue: totalRevenue,
        recentPendingReservations: pendingReservations || []
      };

      logger.info('Shop owner dashboard retrieved', { userId, shopCount: shops.length });

      res.status(200).json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Error in getDashboard', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '대시보드 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/analytics
   * Get shop analytics and performance metrics
   */
  async getAnalytics(req: AnalyticsRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const { period = 'month', startDate, endDate } = req.query;

      // Get user's shops
      const { data: shops, error: shopsError } = await this.supabase
        .from('shops')
        .select('id, name')
        .eq('owner_id', userId)
        .eq('shop_status', 'active');

      if (shopsError || !shops || shops.length === 0) {
        res.status(404).json({
          error: {
            code: 'NO_SHOPS_FOUND',
            message: '활성화된 샵이 없습니다.',
            details: '샵을 등록하거나 활성화해주세요.'
          }
        });
        return;
      }

      const shopIds = shops.map(shop => shop.id);

      // Calculate date range
      const now = new Date();
      let startDateObj: Date;
      let endDateObj: Date;

      if (startDate && endDate) {
        startDateObj = new Date(startDate);
        endDateObj = new Date(endDate);
      } else {
        switch (period) {
          case 'day':
            startDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            endDateObj = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
            break;
          case 'week':
            const dayOfWeek = now.getDay();
            const daysToSubtract = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
            startDateObj = new Date(now.getTime() - daysToSubtract * 24 * 60 * 60 * 1000);
            endDateObj = new Date(startDateObj.getTime() + 7 * 24 * 60 * 60 * 1000);
            break;
          case 'year':
            startDateObj = new Date(now.getFullYear(), 0, 1);
            endDateObj = new Date(now.getFullYear() + 1, 0, 1);
            break;
          default: // month
            startDateObj = new Date(now.getFullYear(), now.getMonth(), 1);
            endDateObj = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        }
      }

      // Get reservations in date range
      const { data: reservations, error: reservationsError } = await this.supabase
        .from('reservations')
        .select(`
          id, reservation_date, status, total_amount, points_earned,
          shops!inner(name)
        `)
        .in('shop_id', shopIds)
        .gte('reservation_date', startDateObj.toISOString().split('T')[0])
        .lt('reservation_date', endDateObj.toISOString().split('T')[0]);

      if (reservationsError) {
        logger.error('Failed to get reservations for analytics', { error: reservationsError.message });
        res.status(500).json({
          error: {
            code: 'ANALYTICS_FETCH_FAILED',
            message: '분석 데이터 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Calculate analytics
      const totalReservations = reservations?.length || 0;
      const completedReservations = reservations?.filter(r => r.status === 'completed').length || 0;
      const totalRevenue = reservations?.filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0) || 0;
      const totalPointsEarned = reservations?.filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.points_earned || 0), 0) || 0;

      // Group by date for chart data
      const dailyData = new Map<string, { reservations: number; revenue: number }>();
      
      reservations?.forEach(reservation => {
        const date = reservation.reservation_date;
        const existing = dailyData.get(date) || { reservations: 0, revenue: 0 };
        
        existing.reservations++;
        if (reservation.status === 'completed') {
          existing.revenue += reservation.total_amount || 0;
        }
        
        dailyData.set(date, existing);
      });

      const chartData = Array.from(dailyData.entries()).map(([date, data]) => ({
        date,
        reservations: data.reservations,
        revenue: data.revenue
      })).sort((a, b) => a.date.localeCompare(b.date));

      const analytics = {
        period,
        dateRange: {
          start: startDateObj.toISOString().split('T')[0],
          end: endDateObj.toISOString().split('T')[0]
        },
        overview: {
          totalReservations,
          completedReservations,
          completionRate: totalReservations > 0 ? (completedReservations / totalReservations) * 100 : 0,
          totalRevenue,
          totalPointsEarned,
          averageRevenue: completedReservations > 0 ? totalRevenue / completedReservations : 0
        },
        chartData,
        shops: shops.map(shop => ({
          id: shop.id,
          name: shop.name
        }))
      };

      logger.info('Shop analytics retrieved', { userId, period, totalReservations });

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Error in getAnalytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '분석 데이터 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/reservations
   * Get shop reservations with filtering and pagination
   */
  async getReservations(req: ReservationListRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      const {
        status,
        startDate,
        endDate,
        page = '1',
        limit = '20',
        search
      } = req.query;

      // Get user's shops
      const { data: shops, error: shopsError } = await this.supabase
        .from('shops')
        .select('id')
        .eq('owner_id', userId)
        .eq('shop_status', 'active');

      if (shopsError || !shops || shops.length === 0) {
        res.status(404).json({
          error: {
            code: 'NO_SHOPS_FOUND',
            message: '활성화된 샵이 없습니다.',
            details: '샵을 등록하거나 활성화해주세요.'
          }
        });
        return;
      }

      const shopIds = shops.map(shop => shop.id);
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Build query
      let query = this.supabase
        .from('reservations')
        .select(`
          *,
          users!inner(name, phone_number),
          shops!inner(name),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name)
          )
        `)
        .in('shop_id', shopIds);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }
      if (startDate) {
        query = query.gte('reservation_date', startDate);
      }
      if (endDate) {
        query = query.lte('reservation_date', endDate);
      }
      if (search) {
        query = query.or(`users.name.ilike.%${search}%,users.phone_number.ilike.%${search}%`);
      }

      // Apply pagination
      query = query.order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data: reservations, error: reservationsError, count } = await query;

      if (reservationsError) {
        logger.error('Failed to get reservations', { error: reservationsError.message, userId });
        res.status(500).json({
          error: {
            code: 'RESERVATIONS_FETCH_FAILED',
            message: '예약 목록 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Format response
      const formattedReservations = reservations?.map(reservation => ({
        id: reservation.id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        pointsUsed: reservation.points_used,
        pointsEarned: reservation.points_earned,
        specialRequests: reservation.special_requests,
        customer: {
          name: reservation.users?.name,
          phoneNumber: reservation.users?.phone_number
        },
        shop: {
          name: reservation.shops?.name
        },
        services: reservation.reservation_services?.map(rs => ({
          name: rs.shop_services?.name,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price
        })) || [],
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at
      })) || [];

      logger.info('Shop reservations retrieved', { 
        userId, 
        count: formattedReservations.length,
        page: pageNum,
        limit: limitNum
      });

      res.status(200).json({
        success: true,
        data: {
          reservations: formattedReservations,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: count || 0,
            totalPages: Math.ceil((count || 0) / limitNum)
          }
        }
      });

    } catch (error) {
      logger.error('Error in getReservations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PUT /api/shop-owner/reservations/:reservationId/status
   * Update reservation status (confirm, complete, cancel)
   */
  async updateReservationStatus(req: ReservationStatusRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { reservationId } = req.params;
      const { status, notes } = req.body;

      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      if (!reservationId) {
        res.status(400).json({
          error: {
            code: 'MISSING_RESERVATION_ID',
            message: '예약 ID가 필요합니다.',
            details: '예약 ID를 제공해주세요.'
          }
        });
        return;
      }

      // Get reservation and verify ownership
      const { data: reservation, error: fetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(owner_id)
        `)
        .eq('id', reservationId)
        .single();

      if (fetchError || !reservation) {
        res.status(404).json({
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.',
            details: '예약이 존재하지 않거나 삭제되었습니다.'
          }
        });
        return;
      }

      // Verify shop ownership
      if (reservation.shops?.owner_id !== userId) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: '이 예약을 관리할 권한이 없습니다.',
            details: '자신의 샵 예약만 관리할 수 있습니다.'
          }
        });
        return;
      }

      // Prepare update data
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      // Set appropriate timestamp based on status
      switch (status) {
        case 'confirmed':
          updateData.confirmed_at = new Date().toISOString();
          break;
        case 'completed':
          updateData.completed_at = new Date().toISOString();
          break;
        case 'cancelled_by_shop':
          updateData.cancelled_at = new Date().toISOString();
          if (notes) {
            updateData.cancellation_reason = notes;
          }
          break;
      }

      // Update reservation
      const { data: updatedReservation, error: updateError } = await this.supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .select()
        .single();

      if (updateError) {
        logger.error('Failed to update reservation status', {
          error: updateError.message,
          reservationId,
          status,
          userId
        });

        res.status(500).json({
          error: {
            code: 'RESERVATION_UPDATE_FAILED',
            message: '예약 상태 업데이트에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      logger.info('Reservation status updated', {
        reservationId,
        oldStatus: reservation.status,
        newStatus: status,
        userId
      });

      res.status(200).json({
        success: true,
        data: {
          reservation: updatedReservation,
          message: '예약 상태가 성공적으로 업데이트되었습니다.'
        }
      });

    } catch (error) {
      logger.error('Error in updateReservationStatus', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 상태 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/profile
   * Get shop owner profile and shop information
   */
  async getProfile(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            details: '로그인 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Get user profile
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, name, email, phone_number, user_status, user_role, created_at')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        res.status(404).json({
          error: {
            code: 'USER_NOT_FOUND',
            message: '사용자 정보를 찾을 수 없습니다.',
            details: '사용자 계정이 존재하지 않습니다.'
          }
        });
        return;
      }

      // Get user's shops
      const { data: shops, error: shopsError } = await this.supabase
        .from('shops')
        .select(`
          *,
          shop_images(image_url, alt_text, is_primary)
        `)
        .eq('owner_id', userId)
        .order('created_at', { ascending: false });

      if (shopsError) {
        logger.error('Failed to get user shops', { error: shopsError.message, userId });
      }

      const profile = {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          phoneNumber: user.phone_number,
          status: user.user_status,
          role: user.user_role,
          createdAt: user.created_at
        },
        shops: shops || []
      };

      logger.info('Shop owner profile retrieved', { userId });

      res.status(200).json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Error in getProfile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '프로필 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}

export const shopOwnerController = new ShopOwnerController(); 