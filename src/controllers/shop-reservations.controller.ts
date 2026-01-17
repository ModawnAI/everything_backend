/**
 * Shop Reservations Controller
 *
 * Handles shop-scoped reservation management endpoints.
 * All operations are filtered by shopId from the route parameter.
 *
 * Access Control:
 * - Enforced by validateShopAccess middleware
 * - Platform admins can access any shop
 * - Shop users can only access their own shop
 */

import { Response } from 'express';
import { ShopAccessRequest } from '../middleware/shop-access.middleware';
import { reservationService } from '../services/reservation.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

export class ShopReservationsController {
  /**
   * GET /api/shops/:shopId/reservations
   * Get reservations for a specific shop with filtering
   */
  async getShopReservations(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const {
        status,
        startDate,
        endDate,
        userId,
        page = 1,
        limit = 20,
        sortBy = 'reservation_date',
        sortOrder = 'desc'
      } = req.query;

      // Validate shopId (already validated by middleware, but double-check)
      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      // Build query filters
      const filters: any = {
        shopId,
        page: parseInt(page as string) || 1,
        limit: Math.min(parseInt(limit as string) || 20, 100), // Max 100 per page
        sortBy: sortBy as string,
        sortOrder: sortOrder as string
      };

      if (status) {
        filters.status = status as string;
      }
      if (startDate) {
        filters.startDate = startDate as string;
      }
      if (endDate) {
        filters.endDate = endDate as string;
      }
      if (userId) {
        filters.userId = userId as string;
      }

      // Validate and map sortBy field
      const sortFieldMap: Record<string, string> = {
        'reservation_datetime': 'reservation_date',
        'reservation_date': 'reservation_date',
        'created_at': 'created_at',
        'updated_at': 'updated_at',
        'status': 'status'
      };

      const sortField = sortFieldMap[filters.sortBy] || 'reservation_date';
      const isAscending = filters.sortOrder === 'asc';

      logger.info('🔍 [SHOP-RESERVATIONS] Fetching reservations for shop', {
        shopId,
        filters,
        sortField,
        isAscending,
        user: { id: req.user?.id, role: req.user?.role }
      });

      // Get reservations from database with shop_id filter
      const supabase = getSupabaseClient();
      let query = supabase
        .from('reservations')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email,
            phone_number
          ),
          shops:shop_id (
            id,
            name
          )
        `, { count: 'exact' })
        .eq('shop_id', shopId)
        .order(sortField, { ascending: isAscending });

      // Add secondary sort for reservation_date to also sort by time
      if (sortField === 'reservation_date') {
        query = query.order('reservation_time', { ascending: isAscending });
      }

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.startDate) {
        query = query.gte('reservation_date', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('reservation_date', filters.endDate);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }

      // Apply pagination
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);

      const { data: reservations, error, count } = await query;

      if (error) {
        logger.error('❌ [SHOP-RESERVATIONS] Database error', {
          error: error.message,
          shopId
        });
        throw error;
      }

      const totalPages = count ? Math.ceil(count / filters.limit) : 0;

      logger.info('✅ [SHOP-RESERVATIONS] Reservations fetched successfully', {
        shopId,
        count: reservations?.length || 0,
        total: count,
        page: filters.page,
        totalPages
      });

      res.status(200).json({
        success: true,
        data: {
          reservations: reservations || [],
          pagination: {
            total: count || 0,
            page: filters.page,
            limit: filters.limit,
            totalPages,
            hasMore: filters.page < totalPages
          }
        }
      });

    } catch (error) {
      logger.error('💥 [SHOP-RESERVATIONS] Error fetching shop reservations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * PATCH /api/shops/:shopId/reservations/:reservationId
   * Update reservation status (confirm, complete, cancel, no-show)
   */
  async updateReservationStatus(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId, reservationId } = req.params;
      const { status, reason, notes } = req.body;
      const userId = req.user?.id;

      // Validate required fields
      if (!shopId || !reservationId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: '샵 ID와 예약 ID가 필요합니다.'
          }
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_STATUS',
            message: '변경할 상태를 지정해주세요.'
          }
        });
        return;
      }

      // Validate status value
      const validStatuses = ['confirmed', 'completed', 'cancelled_by_shop', 'no_show'];
      if (!validStatuses.includes(status)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS',
            message: '유효하지 않은 상태입니다.',
            details: `허용된 상태: ${validStatuses.join(', ')}`
          }
        });
        return;
      }

      // Validate reason for cancellation
      if (status === 'cancelled_by_shop' && !reason) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REASON',
            message: '취소 사유는 필수입니다.',
            details: '취소 시 reason 필드를 제공해주세요.'
          }
        });
        return;
      }

      logger.info('🔄 [SHOP-RESERVATIONS] Updating reservation status', {
        shopId,
        reservationId,
        status,
        userId,
        hasReason: !!reason
      });

      const supabase = getSupabaseClient();

      // First, verify reservation belongs to this shop
      const { data: reservation, error: fetchError } = await supabase
        .from('reservations')
        .select('id, shop_id, status, user_id')
        .eq('id', reservationId)
        .eq('shop_id', shopId)
        .single();

      if (fetchError || !reservation) {
        logger.warn('⚠️ [SHOP-RESERVATIONS] Reservation not found or access denied', {
          shopId,
          reservationId,
          error: fetchError?.message
        });

        res.status(404).json({
          success: false,
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Validate status transition
      const currentStatus = reservation.status;
      const validTransitions: Record<string, string[]> = {
        'requested': ['confirmed', 'cancelled_by_shop'],
        'confirmed': ['completed', 'cancelled_by_shop', 'no_show'],
        'completed': [],
        'cancelled_by_user': [],
        'cancelled_by_shop': [],
        'no_show': []
      };

      if (!validTransitions[currentStatus]?.includes(status)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_STATUS_TRANSITION',
            message: `${currentStatus} 상태에서 ${status}(으)로 변경할 수 없습니다.`,
            details: `현재 상태: ${currentStatus}, 허용된 전환: ${validTransitions[currentStatus]?.join(', ') || '없음'}`
          }
        });
        return;
      }

      // Update reservation status
      const updateData: any = {
        status,
        updated_at: new Date().toISOString()
      };

      if (reason) {
        updateData.cancellation_reason = reason;
      }

      if (notes) {
        updateData.shop_notes = notes;
      }

      if (status === 'cancelled_by_shop') {
        updateData.cancelled_at = new Date().toISOString();
      }

      if (status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updatedReservation, error: updateError } = await supabase
        .from('reservations')
        .update(updateData)
        .eq('id', reservationId)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (updateError) {
        logger.error('❌ [SHOP-RESERVATIONS] Failed to update reservation', {
          error: updateError.message,
          reservationId,
          shopId
        });
        throw updateError;
      }

      logger.info('✅ [SHOP-RESERVATIONS] Reservation status updated successfully', {
        reservationId,
        shopId,
        oldStatus: currentStatus,
        newStatus: status,
        userId
      });

      // Invalidate user's reservation list cache to ensure updated status is immediately visible
      try {
        const { queryCacheService } = await import('../services/query-cache.service');
        await queryCacheService.invalidatePattern(`qc:reservation:*:list:${reservation.user_id}:*`);
        logger.debug('Invalidated reservation cache for user after status update', {
          userId: reservation.user_id,
          reservationId,
          newStatus: status
        });
      } catch (cacheError) {
        logger.warn('Failed to invalidate reservation cache after status update', {
          error: cacheError instanceof Error ? cacheError.message : 'Unknown error',
          userId: reservation.user_id,
          reservationId
        });
      }

      // Award points if status changed to completed
      if (status === 'completed' && currentStatus !== 'completed') {
        try {
          const { PointService } = await import('../services/point.service');
          const pointService = new PointService();

          // Get reservation details for point calculation
          const paymentAmount = updatedReservation.total_amount - (updatedReservation.points_used || 0);
          const pointsToAward = Math.floor(paymentAmount * 0.01); // 1% reward

          logger.info('[POINT-DEBUG] Checking point award conditions', {
            reservationId,
            totalAmount: updatedReservation.total_amount,
            pointsUsed: updatedReservation.points_used,
            paymentAmount,
            pointsToAward,
            willAwardPoints: pointsToAward > 0
          });

          if (pointsToAward > 0) {
            await pointService.addPoints(
              updatedReservation.user_id,
              pointsToAward,
              'earned',
              'purchase',
              `예약 ${reservationId} 완료 적립`
            );

            logger.info('Points awarded for completed reservation', {
              reservationId,
              userId: updatedReservation.user_id,
              pointsAwarded: pointsToAward,
              totalAmount: updatedReservation.total_amount
            });
          }
        } catch (error) {
          logger.error('Failed to award points for completed reservation', {
            reservationId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          // Don't fail the status update if point awarding fails
        }
      }

      // Send customer notification (async, don't wait for completion)
      this.sendCustomerNotification(reservationId, status as any, notes, reason).catch(error => {
        logger.error('Failed to send customer notification', {
          error: error instanceof Error ? error.message : 'Unknown error',
          reservationId,
          status
        });
      });

      res.status(200).json({
        success: true,
        data: {
          reservationId: updatedReservation.id,
          status: updatedReservation.status,
          updatedAt: updatedReservation.updated_at,
          previousStatus: currentStatus
        }
      });

    } catch (error) {
      logger.error('💥 [SHOP-RESERVATIONS] Error updating reservation status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId,
        reservationId: req.params.reservationId,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 상태 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * Send customer notification for reservation status change
   */
  private async sendCustomerNotification(reservationId: string, status: 'confirmed' | 'completed' | 'cancelled_by_shop' | 'no_show', notes?: string, reason?: string): Promise<void> {
    try {
      logger.info('📨 Sending customer notification', { reservationId, status });

      const supabase = getSupabaseClient();

      // Get reservation with user and shop details
      const { data: reservation } = await supabase
        .from('reservations')
        .select(`
          *,
          users:user_id (id, email, name),
          shops:shop_id (id, name)
        `)
        .eq('id', reservationId)
        .single();

      if (!reservation) {
        logger.error('Reservation not found for notification', { reservationId });
        return;
      }

      // Get services
      const { data: reservationServices } = await supabase
        .from('reservation_services')
        .select(`
          *,
          shop_services:service_id (id, name)
        `)
        .eq('reservation_id', reservationId);

      const services = (reservationServices || []).map(rs => ({
        serviceName: rs.shop_services?.name || 'Unknown Service',
        quantity: rs.quantity,
        unitPrice: rs.unit_price,
        totalPrice: rs.total_price
      }));

      // Map status to notification type
      const statusMap: Record<typeof status, 'reservation_confirmed' | 'reservation_cancelled' | 'reservation_completed' | 'reservation_no_show'> = {
        'confirmed': 'reservation_confirmed',
        'cancelled_by_shop': 'reservation_cancelled',
        'completed': 'reservation_completed',
        'no_show': 'reservation_no_show'
      };

      const notificationType = statusMap[status];

      // Import and use customer notification service
      const { customerNotificationService } = await import('../services/customer-notification.service');

      await customerNotificationService.notifyCustomerOfReservationUpdate({
        customerId: reservation.user_id,
        reservationId: reservation.id,
        shopName: reservation.shops?.name || 'Unknown Shop',
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        services,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        remainingAmount: reservation.remaining_amount || 0,
        notificationType,
        additionalData: {
          confirmationNotes: status === 'confirmed' ? notes : undefined,
          cancellationReason: status === 'cancelled_by_shop' ? (reason || notes) : undefined,
          shopId: reservation.shop_id
        }
      });

      logger.info('✅ Customer notification sent', { reservationId, status });
    } catch (error) {
      logger.error('❌ Failed to send customer notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        status
      });
    }
  }
}
