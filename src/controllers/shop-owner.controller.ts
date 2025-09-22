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
      const { data: reservation, error: reservationFetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(owner_id)
        `)
        .eq('id', reservationId)
        .single();

      if (reservationFetchError || !reservation) {
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

      // Use state machine to execute status transition
      const { reservationStateMachine } = await import('../services/reservation-state-machine.service');
      
      const transitionResult = await reservationStateMachine.executeTransition(
        reservationId,
        status,
        'shop',
        userId,
        notes || `Status updated to ${status} by shop owner`,
        {
          updated_at: new Date().toISOString(),
          ...(status === 'confirmed' && { confirmed_at: new Date().toISOString() }),
          ...(status === 'completed' && { completed_at: new Date().toISOString() }),
          ...(status === 'cancelled_by_shop' && { 
            cancelled_at: new Date().toISOString(),
            ...(notes && { cancellation_reason: notes })
          })
        }
      );

      if (!transitionResult.success) {
        logger.error('Failed to update reservation status via state machine', {
          errors: transitionResult.errors,
          warnings: transitionResult.warnings,
          reservationId,
          status,
          userId
        });

        res.status(400).json({
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: '예약 상태 업데이트에 실패했습니다.',
            details: transitionResult.errors.join(', ')
          }
        });
        return;
      }

      // Get updated reservation
      const { data: updatedReservation, error: updatedReservationFetchError } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (updatedReservationFetchError) {
        logger.error('Failed to fetch updated reservation after state transition', {
          error: updatedReservationFetchError.message,
          reservationId,
          status,
          userId
        });

        res.status(500).json({
          error: {
            code: 'RESERVATION_FETCH_FAILED',
            message: '예약 정보 조회에 실패했습니다.',
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
   * GET /api/shop-owner/reservations/pending
   * Get pending reservations (requested status) for shop owners
   */
  async getPendingReservations(req: ReservationListRequest, res: Response): Promise<void> {
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
        page = '1',
        limit = '20',
        search
      } = req.query;

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
      const pageNum = parseInt(page as string) || 1;
      const limitNum = parseInt(limit as string) || 20;
      const offset = (pageNum - 1) * limitNum;

      // Build query specifically for pending (requested) reservations
      let query = this.supabase
        .from('reservations')
        .select(`
          *,
          users!inner(name, phone_number, email),
          shops!inner(name, address),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name, description)
          ),
          payments(
            id,
            amount,
            payment_status,
            is_deposit,
            paid_at
          )
        `)
        .in('shop_id', shopIds)
        .eq('status', 'requested'); // Only requested status reservations

      // Apply search filter if provided
      if (search) {
        query = query.or(`users.name.ilike.%${search}%,users.phone_number.ilike.%${search}%,users.email.ilike.%${search}%`);
      }

      // Apply pagination and ordering
      query = query.order('created_at', { ascending: false })
        .range(offset, offset + limitNum - 1);

      const { data: reservations, error: reservationsError, count } = await query;

      if (reservationsError) {
        logger.error('Failed to get pending reservations', { error: reservationsError.message, userId });
        res.status(500).json({
          error: {
            code: 'PENDING_RESERVATIONS_FETCH_FAILED',
            message: '대기 중인 예약 목록 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Format response with additional pending-specific information
      const formattedReservations = reservations?.map(reservation => ({
        id: reservation.id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        remainingAmount: reservation.remaining_amount,
        pointsUsed: reservation.points_used,
        specialRequests: reservation.special_requests,
        customer: {
          name: reservation.users?.name,
          phoneNumber: reservation.users?.phone_number,
          email: reservation.users?.email
        },
        shop: {
          name: reservation.shops?.name,
          address: reservation.shops?.address
        },
        services: reservation.reservation_services?.map(rs => ({
          name: rs.shop_services?.name,
          description: rs.shop_services?.description,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price
        })) || [],
        payments: reservation.payments?.map(payment => ({
          id: payment.id,
          amount: payment.amount,
          status: payment.payment_status,
          isDeposit: payment.is_deposit,
          paidAt: payment.paid_at
        })) || [],
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at,
        // Additional pending-specific fields
        waitingTime: this.calculateWaitingTime(reservation.created_at),
        urgencyLevel: this.calculateUrgencyLevel(reservation.reservation_date, reservation.created_at)
      })) || [];

      logger.info('Pending reservations retrieved', { 
        userId, 
        count: formattedReservations.length,
        page: pageNum,
        limit: limitNum,
        shopCount: shops.length
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
          },
          summary: {
            totalPending: count || 0,
            shopsWithPending: shops.length
          }
        }
      });

    } catch (error) {
      logger.error('Error in getPendingReservations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '대기 중인 예약 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Calculate waiting time since reservation was created
   */
  private calculateWaitingTime(createdAt: string): string {
    const created = new Date(createdAt);
    const now = new Date();
    const diffMs = now.getTime() - created.getTime();
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days}일 ${diffHours % 24}시간`;
    } else if (diffHours > 0) {
      return `${diffHours}시간 ${diffMinutes}분`;
    } else {
      return `${diffMinutes}분`;
    }
  }

  /**
   * Calculate urgency level based on reservation date and creation time
   */
  private calculateUrgencyLevel(reservationDate: string, createdAt: string): 'low' | 'medium' | 'high' {
    const reservation = new Date(reservationDate);
    const created = new Date(createdAt);
    const now = new Date();
    
    const daysUntilReservation = Math.ceil((reservation.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    const hoursSinceCreated = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60));

    // High urgency: reservation is tomorrow or today and created more than 2 hours ago
    if (daysUntilReservation <= 1 && hoursSinceCreated > 2) {
      return 'high';
    }
    
    // Medium urgency: reservation is within 3 days or created more than 12 hours ago
    if (daysUntilReservation <= 3 || hoursSinceCreated > 12) {
      return 'medium';
    }
    
    // Low urgency: all other cases
    return 'low';
  }

  /**
   * PUT /api/shop-owner/reservations/:reservationId/confirm
   * Confirm a pending reservation (requested -> confirmed)
   */
  async confirmReservation(req: ReservationStatusRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { reservationId } = req.params;
      const { notes } = req.body;

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
      const { data: reservation, error: confirmReservationFetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(owner_id, name),
          users!inner(name, email, phone_number),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name)
          ),
          payments(
            id,
            amount,
            payment_status,
            is_deposit,
            paid_at
          )
        `)
        .eq('id', reservationId)
        .single();

      if (confirmReservationFetchError || !reservation) {
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

      // Verify reservation is in 'requested' status
      if (reservation.status !== 'requested') {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: '이 예약은 확정할 수 없습니다.',
            details: `현재 상태: ${reservation.status}. 'requested' 상태의 예약만 확정할 수 있습니다.`
          }
        });
        return;
      }

      // Check if deposit is required and paid
      const hasDepositPayment = reservation.payments?.some(payment => 
        payment.payment_status === 'deposit_paid' && payment.is_deposit
      );

      if (reservation.deposit_amount && reservation.deposit_amount > 0 && !hasDepositPayment) {
        res.status(400).json({
          error: {
            code: 'DEPOSIT_NOT_PAID',
            message: '예약금이 결제되지 않았습니다.',
            details: '예약금 결제 후 예약을 확정할 수 있습니다.'
          }
        });
        return;
      }

      // Use state machine to execute confirmation transition
      const { reservationStateMachine } = await import('../services/reservation-state-machine.service');
      
      const transitionResult = await reservationStateMachine.executeTransition(
        reservationId,
        'confirmed',
        'shop',
        userId,
        notes || 'Shop owner confirmed reservation',
        {
          confirmation_notes: notes,
          confirmed_at: new Date().toISOString()
        }
      );

      if (!transitionResult.success) {
        logger.error('Failed to confirm reservation via state machine', {
          errors: transitionResult.errors,
          warnings: transitionResult.warnings,
          reservationId,
          userId
        });

        res.status(400).json({
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: '예약 확정에 실패했습니다.',
            details: transitionResult.errors.join(', ')
          }
        });
        return;
      }

      // Get updated reservation with related data
      const { data: updatedReservation, error: fetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(name),
          users!inner(name, email, phone_number),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name)
          )
        `)
        .eq('id', reservationId)
        .single();

      if (fetchError) {
        logger.error('Failed to fetch updated reservation after state transition', {
          error: fetchError.message,
          reservationId,
          userId
        });

        res.status(500).json({
          error: {
            code: 'RESERVATION_FETCH_FAILED',
            message: '예약 정보 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Send confirmation notification to customer
      try {
        const { customerNotificationService } = await import('../services/customer-notification.service');
        
        await customerNotificationService.notifyCustomerOfReservationUpdate({
          customerId: reservation.user_id,
          reservationId: reservation.id,
          shopName: updatedReservation.shops?.name || 'Unknown Shop',
          reservationDate: updatedReservation.reservation_date,
          reservationTime: updatedReservation.reservation_time,
          services: updatedReservation.reservation_services?.map((rs: any) => ({
            serviceName: rs.shop_services?.name || 'Unknown Service',
            quantity: rs.quantity,
            unitPrice: rs.unit_price,
            totalPrice: rs.total_price
          })) || [],
          totalAmount: updatedReservation.total_amount,
          depositAmount: updatedReservation.deposit_amount,
          remainingAmount: updatedReservation.remaining_amount,
          specialRequests: updatedReservation.special_requests,
          notificationType: 'reservation_confirmed',
          additionalData: {
            confirmationNotes: notes
          }
        });
      } catch (notificationError) {
        logger.warn('Failed to send confirmation notification', {
          reservationId,
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
        });
        // Don't fail the confirmation if notification fails
      }

      // Log successful confirmation
      logger.info('Reservation confirmed successfully', {
        reservationId,
        userId,
        customerId: reservation.user_id,
        shopId: reservation.shop_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        notes: notes || null
      });

      // Format response
      const formattedReservation = {
        id: updatedReservation.id,
        reservationDate: updatedReservation.reservation_date,
        reservationTime: updatedReservation.reservation_time,
        status: updatedReservation.status,
        confirmedAt: updatedReservation.confirmed_at,
        confirmationNotes: updatedReservation.confirmation_notes,
        totalAmount: updatedReservation.total_amount,
        depositAmount: updatedReservation.deposit_amount,
        customer: {
          name: updatedReservation.users?.name,
          email: updatedReservation.users?.email,
          phoneNumber: updatedReservation.users?.phone_number
        },
        shop: {
          name: updatedReservation.shops?.name
        },
        services: updatedReservation.reservation_services?.map((rs: any) => ({
          name: rs.shop_services?.name,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price
        })) || []
      };

      res.status(200).json({
        success: true,
        data: {
          reservation: formattedReservation,
          message: '예약이 성공적으로 확정되었습니다.'
        }
      });

    } catch (error) {
      logger.error('Error in confirmReservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 확정 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }


  /**
   * PUT /api/shop-owner/reservations/:reservationId/reject
   * Reject a pending reservation (requested -> cancelled_by_shop)
   */
  async rejectReservation(req: ReservationStatusRequest, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const { reservationId } = req.params;
      const { notes } = req.body;

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
      const { data: reservation, error: rejectReservationFetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(owner_id, name),
          users!inner(name, email, phone_number),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name)
          ),
          payments(
            id,
            amount,
            payment_status,
            is_deposit,
            paid_at
          )
        `)
        .eq('id', reservationId)
        .single();

      if (rejectReservationFetchError || !reservation) {
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

      // Verify reservation is in 'requested' status
      if (reservation.status !== 'requested') {
        res.status(400).json({
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: '이 예약은 거절할 수 없습니다.',
            details: `현재 상태: ${reservation.status}. 'requested' 상태의 예약만 거절할 수 있습니다.`
          }
        });
        return;
      }

      // Use state machine to execute rejection transition
      const { reservationStateMachine } = await import('../services/reservation-state-machine.service');
      
      const rejectionReason = notes || '샵 사정으로 인한 예약 거절';
      
      const transitionResult = await reservationStateMachine.executeTransition(
        reservationId,
        'cancelled_by_shop',
        'shop',
        userId,
        rejectionReason,
        {
          cancellation_reason: rejectionReason,
          cancelled_at: new Date().toISOString()
        }
      );

      if (!transitionResult.success) {
        logger.error('Failed to reject reservation via state machine', {
          errors: transitionResult.errors,
          warnings: transitionResult.warnings,
          reservationId,
          userId
        });

        res.status(400).json({
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: '예약 거절에 실패했습니다.',
            details: transitionResult.errors.join(', ')
          }
        });
        return;
      }

      // Get updated reservation with related data
      const { data: updatedReservation, error: fetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(name),
          users!inner(name, email, phone_number),
          reservation_services(
            quantity,
            unit_price,
            total_price,
            shop_services!inner(name)
          )
        `)
        .eq('id', reservationId)
        .single();

      if (fetchError) {
        logger.error('Failed to fetch updated reservation after state transition', {
          error: fetchError.message,
          reservationId,
          userId
        });

        res.status(500).json({
          error: {
            code: 'RESERVATION_FETCH_FAILED',
            message: '예약 정보 조회에 실패했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Process refund if deposit was paid
      let refundProcessed = false;
      const depositPayment = reservation.payments?.find(payment => 
        payment.payment_status === 'deposit_paid' && payment.is_deposit
      );

      if (depositPayment && reservation.deposit_amount && reservation.deposit_amount > 0) {
        try {
          await this.processDepositRefund(reservation, depositPayment);
          refundProcessed = true;
          logger.info('Deposit refund processed for rejected reservation', {
            reservationId,
            depositAmount: reservation.deposit_amount,
            paymentId: depositPayment.id
          });
        } catch (refundError) {
          logger.error('Failed to process deposit refund for rejected reservation', {
            reservationId,
            depositAmount: reservation.deposit_amount,
            error: refundError instanceof Error ? refundError.message : 'Unknown error'
          });
          // Continue with rejection even if refund fails - manual processing may be needed
        }
      }

      // Send rejection notification to customer
      try {
        const { customerNotificationService } = await import('../services/customer-notification.service');
        
        await customerNotificationService.notifyCustomerOfReservationUpdate({
          customerId: reservation.user_id,
          reservationId: reservation.id,
          shopName: updatedReservation.shops?.name || 'Unknown Shop',
          reservationDate: updatedReservation.reservation_date,
          reservationTime: updatedReservation.reservation_time,
          services: updatedReservation.reservation_services?.map((rs: any) => ({
            serviceName: rs.shop_services?.name || 'Unknown Service',
            quantity: rs.quantity,
            unitPrice: rs.unit_price,
            totalPrice: rs.total_price
          })) || [],
          totalAmount: updatedReservation.total_amount,
          depositAmount: updatedReservation.deposit_amount,
          remainingAmount: updatedReservation.remaining_amount,
          specialRequests: updatedReservation.special_requests,
          notificationType: 'reservation_rejected',
          additionalData: {
            rejectionReason: rejectionReason,
            refundProcessed,
            refundAmount: refundProcessed ? reservation.deposit_amount : undefined
          }
        });
      } catch (notificationError) {
        logger.warn('Failed to send rejection notification', {
          reservationId,
          error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
        });
        // Don't fail the rejection if notification fails
      }

      // Log successful rejection
      logger.info('Reservation rejected successfully', {
        reservationId,
        userId,
        customerId: reservation.user_id,
        shopId: reservation.shop_id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        rejectionReason: rejectionReason,
        refundProcessed
      });

      // Format response
      const formattedReservation = {
        id: updatedReservation.id,
        reservationDate: updatedReservation.reservation_date,
        reservationTime: updatedReservation.reservation_time,
        status: updatedReservation.status,
        cancelledAt: updatedReservation.cancelled_at,
        cancellationReason: updatedReservation.cancellation_reason,
        totalAmount: updatedReservation.total_amount,
        depositAmount: updatedReservation.deposit_amount,
        refundProcessed,
        customer: {
          name: updatedReservation.users?.name,
          email: updatedReservation.users?.email,
          phoneNumber: updatedReservation.users?.phone_number
        },
        shop: {
          name: updatedReservation.shops?.name
        },
        services: updatedReservation.reservation_services?.map((rs: any) => ({
          name: rs.shop_services?.name,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price
        })) || []
      };

      res.status(200).json({
        success: true,
        data: {
          reservation: formattedReservation,
          message: refundProcessed 
            ? '예약이 거절되었고 예약금이 환불 처리되었습니다.'
            : '예약이 거절되었습니다.'
        }
      });

    } catch (error) {
      logger.error('Error in rejectReservation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        userId: (req as any).user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 거절 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Process deposit refund for rejected reservation
   */
  private async processDepositRefund(reservation: any, depositPayment: any): Promise<void> {
    try {
      // Update payment status to refunded
      await this.supabase
        .from('payments')
        .update({
          payment_status: 'refunded',
          refunded_at: new Date().toISOString(),
          refund_amount: depositPayment.amount,
          metadata: {
            ...depositPayment.metadata,
            refund_reason: 'reservation_rejected_by_shop',
            refund_processed_at: new Date().toISOString()
          }
        })
        .eq('id', depositPayment.id);

      // TODO: Integrate with actual payment provider refund API (TossPayments, etc.)
      // For now, we just mark the payment as refunded in our system
      // In production, this would call the actual payment provider's refund API

      logger.info('Payment marked as refunded for rejected reservation', {
        paymentId: depositPayment.id,
        amount: depositPayment.amount,
        reservationId: reservation.id
      });

    } catch (error) {
      logger.error('Failed to process payment refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: depositPayment.id,
        reservationId: reservation.id
      });
      throw error;
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

  /**
   * PUT /api/shop-owner/reservations/:reservationId/complete
   * Mark service as completed and trigger point calculation
   */
  async completeService(req: any, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const { reservationId } = req.params;
      const { finalAmount, completionNotes, serviceDetails } = req.body;

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

      // Get reservation with payment and shop information
      const { data: reservation, error: reservationFetchError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          shops!inner(
            id,
            owner_id,
            name
          ),
          payments(
            id,
            amount,
            payment_status,
            is_deposit
          ),
          reservation_services(
            id,
            service_id,
            quantity,
            unit_price,
            total_price,
            shop_services(
              id,
              name,
              duration_minutes
            )
          )
        `)
        .eq('id', reservationId)
        .single();

      if (reservationFetchError || !reservation) {
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

      // Check if reservation is in a completable state
      if (reservation.status !== 'confirmed') {
        res.status(400).json({
          error: {
            code: 'INVALID_RESERVATION_STATUS',
            message: '완료할 수 없는 예약 상태입니다.',
            details: `현재 상태: ${reservation.status}. 확정된 예약만 완료할 수 있습니다.`
          }
        });
        return;
      }

      // Calculate final amount (use provided amount or existing total)
      const calculatedFinalAmount = finalAmount || reservation.total_amount;
      
      // Validate final amount
      if (calculatedFinalAmount <= 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_FINAL_AMOUNT',
            message: '유효하지 않은 최종 금액입니다.',
            details: '최종 금액은 0보다 커야 합니다.'
          }
        });
        return;
      }

      // Update reservation status to completed
      const { reservationStateMachine } = await import('../services/reservation-state-machine.service');
      
      const transitionResult = await reservationStateMachine.executeTransition(
        reservationId,
        'completed',
        'shop',
        userId,
        completionNotes || '서비스 완료 처리',
        {
          completed_at: new Date().toISOString(),
          final_amount: calculatedFinalAmount,
          completion_notes: completionNotes,
          service_details: serviceDetails,
          updated_at: new Date().toISOString()
        }
      );

      if (!transitionResult.success) {
        logger.error('Failed to complete reservation via state machine', {
          errors: transitionResult.errors,
          warnings: transitionResult.warnings,
          reservationId,
          userId
        });

        res.status(400).json({
          error: {
            code: 'STATE_TRANSITION_FAILED',
            message: '서비스 완료 처리에 실패했습니다.',
            details: transitionResult.errors.join(', ')
          }
        });
        return;
      }

      // Update payment status to fully_paid and handle remaining balance
      await this.updatePaymentStatusOnCompletion(reservation, calculatedFinalAmount);

      // Calculate and award points
      try {
        const { pointProcessingService } = await import('../services/point-processing.service');
        await pointProcessingService.awardPointsForCompletion({
          reservationId,
          userId: reservation.user_id,
          finalAmount: calculatedFinalAmount,
          shopId: reservation.shop_id,
          shopName: reservation.shops.name,
          services: reservation.reservation_services || [],
          completionNotes
        });
      } catch (pointError) {
        logger.error('Failed to award points for completion', {
          error: pointError instanceof Error ? pointError.message : 'Unknown error',
          reservationId,
          userId: reservation.user_id,
          finalAmount: calculatedFinalAmount
        });
        // Don't fail the completion if points fail - just log the error
      }

      // Get updated reservation for response
      const { data: updatedReservation, error: updatedReservationFetchError } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (updatedReservationFetchError) {
        logger.error('Failed to fetch updated reservation after completion', {
          error: updatedReservationFetchError.message,
          reservationId
        });
      }

      logger.info('Service completed successfully', {
        reservationId,
        userId: reservation.user_id,
        shopId: reservation.shop_id,
        finalAmount: calculatedFinalAmount,
        completedBy: userId
      });

      res.status(200).json({
        success: true,
        message: '서비스가 성공적으로 완료 처리되었습니다.',
        data: {
          reservation: updatedReservation || reservation,
          finalAmount: calculatedFinalAmount,
          pointsAwarded: true, // Will be calculated by point service
          completionTime: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error in complete service', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params?.reservationId,
        userId: req.user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 완료 처리 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Update payment status to fully_paid on service completion
   */
  private async updatePaymentStatusOnCompletion(reservation: any, finalAmount: number): Promise<void> {
    try {
      const payments = reservation.payments || [];
      
      // Calculate total paid amount
      const totalPaidAmount = payments
        .filter((p: any) => p.payment_status === 'completed')
        .reduce((sum: number, p: any) => sum + (p.amount || 0), 0);

      // Calculate remaining amount
      const remainingAmount = finalAmount - totalPaidAmount;

      logger.info('Processing payment status updates on completion', {
        reservationId: reservation.id,
        finalAmount,
        totalPaidAmount,
        remainingAmount,
        paymentsCount: payments.length
      });

      // Update all existing payments to completed status
      for (const payment of payments) {
        if (payment.payment_status !== 'completed') {
          const { error: paymentUpdateError } = await this.supabase
            .from('payments')
            .update({
              payment_status: 'completed',
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', payment.id);

          if (paymentUpdateError) {
            logger.error('Failed to update payment status', {
              error: paymentUpdateError.message,
              paymentId: payment.id,
              reservationId: reservation.id
            });
          } else {
            logger.info('Payment status updated to completed', {
              paymentId: payment.id,
              amount: payment.amount,
              isDeposit: payment.is_deposit
            });
          }
        }
      }

      // If there's a remaining amount, create a new payment record for the remaining balance
      if (remainingAmount > 0) {
        const { error: remainingPaymentError } = await this.supabase
          .from('payments')
          .insert({
            reservation_id: reservation.id,
            amount: remainingAmount,
            payment_status: 'completed',
            is_deposit: false,
            payment_method: 'cash', // Assume remaining amount is paid in cash
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              type: 'remaining_balance',
              final_amount: finalAmount,
              total_paid_before: totalPaidAmount,
              completion_notes: 'Remaining balance collected on service completion'
            }
          });

        if (remainingPaymentError) {
          logger.error('Failed to create remaining balance payment record', {
            error: remainingPaymentError.message,
            reservationId: reservation.id,
            remainingAmount
          });
        } else {
          logger.info('Remaining balance payment record created', {
            reservationId: reservation.id,
            remainingAmount,
            finalAmount
          });
        }
      } else if (remainingAmount < 0) {
        // Handle overpayment case (refund needed)
        const overpaymentAmount = Math.abs(remainingAmount);
        logger.warn('Overpayment detected on service completion', {
          reservationId: reservation.id,
          overpaymentAmount,
          finalAmount,
          totalPaidAmount
        });

        // Create a refund record (negative payment)
        const { error: refundError } = await this.supabase
          .from('payments')
          .insert({
            reservation_id: reservation.id,
            amount: -overpaymentAmount, // Negative amount for refund
            payment_status: 'completed',
            is_deposit: false,
            payment_method: 'refund',
            paid_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            metadata: {
              type: 'refund',
              original_amount: finalAmount,
              total_paid: totalPaidAmount,
              overpayment_amount: overpaymentAmount,
              completion_notes: 'Refund for overpayment on service completion'
            }
          });

        if (refundError) {
          logger.error('Failed to create refund payment record', {
            error: refundError.message,
            reservationId: reservation.id,
            overpaymentAmount
          });
        } else {
          logger.info('Refund payment record created', {
            reservationId: reservation.id,
            overpaymentAmount,
            finalAmount
          });
        }
      }

      // Update reservation with final amount and payment status
      const { error: reservationUpdateError } = await this.supabase
        .from('reservations')
        .update({
          total_amount: finalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservation.id);

      if (reservationUpdateError) {
        logger.error('Failed to update reservation with final amount', {
          error: reservationUpdateError.message,
          reservationId: reservation.id,
          finalAmount
        });
      }

      logger.info('Payment status updates completed successfully', {
        reservationId: reservation.id,
        finalAmount,
        totalPaidAmount,
        remainingAmount,
        paymentsProcessed: payments.length
      });

    } catch (error) {
      logger.error('Error updating payment status on completion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: reservation.id,
        finalAmount
      });
      throw error;
    }
  }
}

export const shopOwnerController = new ShopOwnerController(); 