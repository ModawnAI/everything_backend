import { Request, Response } from 'express';
import { adminReservationService } from '../services/admin-reservation.service';
import { adminAuthService } from '../services/admin-auth.service';
import { logger } from '../utils/logger';
import { ReservationStatus } from '../types/database.types';

// Create validation arrays for type checking
const VALID_RESERVATION_STATUSES: ReservationStatus[] = ['requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show'];

export class AdminReservationController {
  /**
   * GET /api/admin/reservations
   * Get reservations with comprehensive filtering and admin oversight
   */
  async getReservations(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract and validate query parameters
      const {
        status,
        shopId: requestedShopId,
        userId,
        startDate,
        endDate,
        search,
        minAmount,
        maxAmount,
        hasPointsUsed,
        sortBy,
        sortOrder,
        page = '1',
        limit = '20'
      } = req.query;

      // Validate status if provided
      if (status && !VALID_RESERVATION_STATUSES.includes(status as ReservationStatus)) {
        res.status(400).json({
          success: false,
          error: 'Invalid reservation status'
        });
        return;
      }

      // Validate sort order
      if (sortOrder && !['asc', 'desc'].includes(sortOrder as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid sort order. Must be "asc" or "desc"'
        });
        return;
      }

      // Validate amount filters
      if (minAmount && isNaN(Number(minAmount))) {
        res.status(400).json({
          success: false,
          error: 'Invalid minimum amount'
        });
        return;
      }

      if (maxAmount && isNaN(Number(maxAmount))) {
        res.status(400).json({
          success: false,
          error: 'Invalid maximum amount'
        });
        return;
      }

      // SECURITY: Enforce role-based shop filtering
      // Shop Owner: MUST use their own shop_id (ignore query parameter)
      // Admin/Super Admin: CAN use requested shop_id (optional filter)
      let effectiveShopId: string | undefined;

      if (adminRole === 'shop_owner') {
        // Shop Owner는 무조건 자신의 shopId만 사용 (쿼리 파라미터 무시)
        effectiveShopId = adminShopId;
        logger.info('Shop Owner filtering applied', {
          adminId: user.id,
          shopId: effectiveShopId,
          requestedShopId
        });
      } else if (adminRole === 'admin') {
        // Admin은 쿼리 파라미터의 shopId 사용 가능 (선택적 필터)
        effectiveShopId = requestedShopId as string | undefined;
      }

      const filters = {
        ...(status && { status: status as ReservationStatus }),
        ...(effectiveShopId && { shopId: effectiveShopId }),
        ...(userId && { userId: userId as string }),
        ...(startDate && { startDate: startDate as string }),
        ...(endDate && { endDate: endDate as string }),
        ...(search && { search: search as string }),
        ...(minAmount && { minAmount: Number(minAmount) }),
        ...(maxAmount && { maxAmount: Number(maxAmount) }),
        ...(hasPointsUsed !== undefined && { hasPointsUsed: hasPointsUsed === 'true' }),
        ...(sortBy && { sortBy: sortBy as any }),
        sortOrder: sortOrder as 'asc' | 'desc',
        page: parseInt(page as string, 10),
        limit: parseInt(limit as string, 10)
      };

      const result = await adminReservationService.getReservations(filters, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin get reservations failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get reservations'
      });
    }
  }

  /**
   * PUT /api/admin/reservations/:id/status
   * Update reservation status with admin oversight
   */
  async updateReservationStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id: reservationId } = req.params;
      const { status, notes, reason, notifyCustomer = true, notifyShop, autoProcessPayment } = req.body; // Default notifyCustomer to true
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: 'Reservation ID is required'
        });
        return;
      }

      // SECURITY: Shop Owner can only update reservations from their own shop
      if (adminRole === 'shop_owner' && adminShopId) {
        const { data: reservation, error: reservationError } = await adminReservationService['supabase']
          .from('reservations')
          .select('shop_id')
          .eq('id', reservationId)
          .single();

        if (reservationError || !reservation) {
          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없습니다.'
          });
          return;
        }

        if (reservation.shop_id !== adminShopId) {
          logger.warn('Shop Owner attempted to update reservation from another shop', {
            adminId: user.id,
            adminShopId,
            reservationId,
            reservationShopId: reservation.shop_id
          });

          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없거나 접근 권한이 없습니다.'
          });
          return;
        }
      }

      if (!status || !VALID_RESERVATION_STATUSES.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Valid reservation status is required'
        });
        return;
      }

      const request = {
        status,
        notes,
        reason,
        notifyCustomer: notifyCustomer === true,
        notifyShop: notifyShop === true,
        autoProcessPayment: autoProcessPayment === true
      };

      const result = await adminReservationService.updateReservationStatus(reservationId, request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Admin reservation status update failed', {
        error: errorMessage,
        reservationId: req.params.id,
        ipAddress: req.ip
      });

      // Determine appropriate HTTP status code based on error type
      let statusCode = 500;
      let clientError = errorMessage;

      if (errorMessage.includes('Reservation not found')) {
        statusCode = 404;
        clientError = '예약을 찾을 수 없습니다.';
      } else if (errorMessage.includes('Invalid status transition')) {
        statusCode = 400;
        clientError = errorMessage; // Return actual transition error
      } else if (errorMessage.includes('not allowed') || errorMessage.includes('validation')) {
        statusCode = 400;
      }

      res.status(statusCode).json({
        success: false,
        error: clientError
      });
    }
  }

  /**
   * POST /api/admin/reservations/:id/dispute
   * Create reservation dispute for admin resolution
   */
  async createReservationDispute(req: Request, res: Response): Promise<void> {
    try {
      const { id: reservationId } = req.params;
      const { disputeType, description, requestedAction, priority, evidence } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: 'Reservation ID is required'
        });
        return;
      }

      // SECURITY: Shop Owner can only create disputes for their own shop's reservations
      if (adminRole === 'shop_owner' && adminShopId) {
        const { data: reservation, error: reservationError } = await adminReservationService['supabase']
          .from('reservations')
          .select('shop_id')
          .eq('id', reservationId)
          .single();

        if (reservationError || !reservation) {
          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없습니다.'
          });
          return;
        }

        if (reservation.shop_id !== adminShopId) {
          logger.warn('Shop Owner attempted to create dispute for reservation from another shop', {
            adminId: user.id,
            adminShopId,
            reservationId,
            reservationShopId: reservation.shop_id
          });

          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없거나 접근 권한이 없습니다.'
          });
          return;
        }
      }

      if (!disputeType || !['customer_complaint', 'shop_issue', 'payment_dispute', 'service_quality', 'other'].includes(disputeType)) {
        res.status(400).json({
          success: false,
          error: 'Valid dispute type is required'
        });
        return;
      }

      if (!description || description.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Dispute description is required'
        });
        return;
      }

      if (!requestedAction || !['refund', 'reschedule', 'compensation', 'investigation', 'other'].includes(requestedAction)) {
        res.status(400).json({
          success: false,
          error: 'Valid requested action is required'
        });
        return;
      }

      if (!priority || !['low', 'medium', 'high', 'urgent'].includes(priority)) {
        res.status(400).json({
          success: false,
          error: 'Valid priority level is required'
        });
        return;
      }

      const request = {
        disputeType,
        description: description.trim(),
        requestedAction,
        priority,
        evidence: evidence || []
      };

      const result = await adminReservationService.createReservationDispute(reservationId, request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin reservation dispute creation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to create reservation dispute';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('Reservation not found') ? 'Reservation not found' : 'Failed to create reservation dispute'
      });
    }
  }

  /**
   * GET /api/admin/reservations/analytics
   * Get reservation analytics for admin dashboard
   */
  async getReservationAnalytics(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { startDate, endDate } = req.query;
      const dateRange = startDate && endDate ? {
        startDate: startDate as string,
        endDate: endDate as string
      } : undefined;

      // SECURITY: Pass shopId to service layer for Shop Owner filtering
      // Note: Service layer needs to filter analytics data by shopId for shop_owner role
      const analytics = await adminReservationService.getReservationAnalytics(
        user.id,
        dateRange,
        adminRole === 'shop_owner' ? adminShopId : undefined
      );

      res.json({
        success: true,
        data: analytics
      });
    } catch (error) {
      logger.error('Admin get reservation analytics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get reservation analytics'
      });
    }
  }

  /**
   * GET /api/admin/reservations/statistics
   * Get reservation statistics for admin dashboard (frontend-compatible)
   */
  async getReservationStatistics(req: Request, res: Response): Promise<void> {
    try {
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract query parameters
      const { shopId: requestedShopId, staffId, dateFrom, dateTo } = req.query;

      // SECURITY: Enforce role-based shop filtering
      let effectiveShopId: string | undefined;

      if (adminRole === 'shop_owner') {
        // Shop Owner는 무조건 자신의 shopId만 사용 (쿼리 파라미터 무시)
        effectiveShopId = adminShopId;
        logger.info('Shop Owner filtering applied to statistics', {
          adminId: user.id,
          shopId: effectiveShopId,
          requestedShopId
        });
      } else if (adminRole === 'admin') {
        // Admin은 쿼리 파라미터의 shopId 사용 가능 (선택적 필터)
        effectiveShopId = requestedShopId as string | undefined;
      }

      // Build filters
      const filters = {
        shopId: effectiveShopId,
        staffId: staffId as string | undefined,
        dateFrom: dateFrom as string | undefined,
        dateTo: dateTo as string | undefined
      };

      const statistics = await adminReservationService.getReservationStatistics(user.id, filters);

      res.json({
        success: true,
        data: statistics,
        message: 'Statistics retrieved successfully'
      });
    } catch (error) {
      logger.error('Admin get reservation statistics failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get reservation statistics'
      });
    }
  }

  /**
   * GET /api/admin/reservations/:id/details
   * Get detailed reservation information for admin oversight
   */
  async getReservationDetails(req: Request, res: Response): Promise<void> {
    try {
      const { id: reservationId } = req.params;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: 'Reservation ID is required'
        });
        return;
      }

      // Get reservation with detailed information
      let query = adminReservationService['supabase']
        .from('reservations')
        .select(`
          *,
          customer:users!reservations_user_id_fkey(
            id,
            name,
            email,
            phone_number,
            user_status,
            created_at,
            last_login_at
          ),
          shop:shops!reservations_shop_id_fkey(
            id,
            name,
            description,
            address,
            detailed_address,
            phone_number,
            email,
            main_category,
            shop_status,
            verification_status,
            created_at
          ),
          services:reservation_services(
            id,
            quantity,
            unit_price,
            total_price,
            service:shop_services(
              id,
              name,
              description,
              category,
              price_min,
              price_max,
              duration_minutes
            )
          ),
          payments:payments(
            id,
            payment_method,
            payment_status,
            amount,
            paid_at,
            created_at
          )
        `)
        .eq('id', reservationId);

      // SECURITY: Shop Owner can only view reservations from their own shop
      if (adminRole === 'shop_owner' && adminShopId) {
        query = query.eq('shop_id', adminShopId);
      }

      const { data: reservation, error } = await query.single();

      if (error || !reservation) {
        res.status(404).json({
          success: false,
          error: adminRole === 'shop_owner'
            ? '예약을 찾을 수 없거나 접근 권한이 없습니다.'
            : 'Reservation not found'
        });
        return;
      }

      // Calculate additional metrics
      const now = new Date();
      const reservationDate = new Date(reservation.reservation_datetime);
      const daysUntilReservation = Math.floor((reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      const totalPaidAmount = (reservation.payments || []).reduce((sum: number, payment: any) => {
        return sum + (payment.payment_status === 'fully_paid' ? payment.amount : 0);
      }, 0);

      const outstandingAmount = reservation.total_amount - totalPaidAmount;

      // Determine reservation state
      const isOverdue = reservation.status === 'confirmed' && daysUntilReservation < 0;
      const isToday = daysUntilReservation === 0;
      const isPast = daysUntilReservation < 0;

      const reservationDetails = {
        id: reservation.id,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        reservationDatetime: reservation.reservation_datetime,
        status: reservation.status,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        remainingAmount: reservation.remaining_amount,
        pointsUsed: reservation.points_used,
        pointsEarned: reservation.points_earned,
        specialRequests: reservation.special_requests,
        cancellationReason: reservation.cancellation_reason,
        noShowReason: reservation.no_show_reason,
        confirmedAt: reservation.confirmed_at,
        completedAt: reservation.completed_at,
        cancelledAt: reservation.cancelled_at,
        createdAt: reservation.created_at,
        updatedAt: reservation.updated_at,
        // Customer information
        customer: reservation.customer ? {
          id: reservation.customer.id,
          name: reservation.customer.name,
          email: reservation.customer.email,
          phoneNumber: reservation.customer.phone_number,
          userStatus: reservation.customer.user_status,
          joinedAt: reservation.customer.created_at,
          lastLoginAt: reservation.customer.last_login_at
        } : undefined,
        // Shop information
        shop: reservation.shop ? {
          id: reservation.shop.id,
          name: reservation.shop.name,
          description: reservation.shop.description,
          address: reservation.shop.address,
          detailedAddress: reservation.shop.detailed_address,
          phoneNumber: reservation.shop.phone_number,
          email: reservation.shop.email,
          mainCategory: reservation.shop.main_category,
          shopStatus: reservation.shop.shop_status,
          verificationStatus: reservation.shop.verification_status,
          joinedAt: reservation.shop.created_at
        } : undefined,
        // Services information
        services: (reservation.services || []).map((service: any) => ({
          id: service.id,
          name: service.service?.name || 'Unknown Service',
          description: service.service?.description,
          category: service.service?.category || 'unknown',
          quantity: service.quantity,
          unitPrice: service.unit_price,
          totalPrice: service.total_price,
          originalPriceMin: service.service?.price_min,
          originalPriceMax: service.service?.price_max,
          durationMinutes: service.service?.duration_minutes
        })),
        // Payment information
        payments: (reservation.payments || []).map((payment: any) => ({
          id: payment.id,
          paymentMethod: payment.payment_method,
          paymentStatus: payment.payment_status,
          amount: payment.amount,
          paidAt: payment.paid_at,
          createdAt: payment.created_at
        })),
        // Computed fields
        daysUntilReservation,
        isOverdue,
        isToday,
        isPast,
        totalPaidAmount,
        outstandingAmount,
        // Analysis
        analysis: {
          paymentCompletion: (totalPaidAmount / reservation.total_amount) * 100,
          hasDisputes: false,
          openDisputes: 0,
          isUrgent: isOverdue,
          requiresAttention: isOverdue || outstandingAmount > 0
        }
      };

      res.json({
        success: true,
        data: reservationDetails
      });
    } catch (error) {
      logger.error('Admin get reservation details failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get reservation details'
      });
    }
  }

  /**
   * POST /api/admin/reservations/:id/force-complete
   * Force complete a reservation for dispute resolution
   */
  async forceCompleteReservation(req: Request, res: Response): Promise<void> {
    try {
      const { id: reservationId } = req.params;
      const { reason, notes, refundAmount, compensationPoints, notifyCustomer, notifyShop } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: 'Reservation ID is required'
        });
        return;
      }

      // SECURITY: Shop Owner can only force complete reservations from their own shop
      if (adminRole === 'shop_owner' && adminShopId) {
        const { data: reservation, error: reservationError } = await adminReservationService['supabase']
          .from('reservations')
          .select('shop_id')
          .eq('id', reservationId)
          .single();

        if (reservationError || !reservation) {
          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없습니다.'
          });
          return;
        }

        if (reservation.shop_id !== adminShopId) {
          logger.warn('Shop Owner attempted to force complete reservation from another shop', {
            adminId: user.id,
            adminShopId,
            reservationId,
            reservationShopId: reservation.shop_id
          });

          res.status(404).json({
            success: false,
            error: '예약을 찾을 수 없거나 접근 권한이 없습니다.'
          });
          return;
        }
      }

      if (!reason || reason.trim().length === 0) {
        res.status(400).json({
          success: false,
          error: 'Force completion reason is required'
        });
        return;
      }

      // Validate refund amount if provided
      if (refundAmount !== undefined && (isNaN(Number(refundAmount)) || Number(refundAmount) < 0)) {
        res.status(400).json({
          success: false,
          error: 'Invalid refund amount'
        });
        return;
      }

      // Validate compensation points if provided
      if (compensationPoints !== undefined && (isNaN(Number(compensationPoints)) || Number(compensationPoints) < 0)) {
        res.status(400).json({
          success: false,
          error: 'Invalid compensation points'
        });
        return;
      }

      const request = {
        reason: reason.trim(),
        notes: notes?.trim() || '',
        refundAmount: refundAmount ? Number(refundAmount) : undefined,
        compensationPoints: compensationPoints ? Number(compensationPoints) : undefined,
        notifyCustomer: notifyCustomer === true,
        notifyShop: notifyShop === true
      };

      const result = await adminReservationService.forceCompleteReservation(reservationId, request, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin force complete reservation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id,
        ipAddress: req.ip
      });

      const errorMessage = error instanceof Error ? error.message : 'Failed to force complete reservation';
      
      res.status(500).json({
        success: false,
        error: errorMessage.includes('Reservation not found') ? 'Reservation not found' : 'Failed to force complete reservation'
      });
    }
  }

  /**
   * POST /api/admin/reservations/bulk-status-update
   * Perform bulk status updates on multiple reservations
   */
  async bulkStatusUpdate(req: Request, res: Response): Promise<void> {
    try {
      const { reservationIds, status, notes, reason, notifyCustomers, notifyShops } = req.body;
      // Get user from request (set by authenticateJWT middleware)
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      // SECURITY: Get admin role and shop_id for role-based filtering
      const adminRole = user.role;
      const adminShopId = user.shopId;

      // SECURITY: Shop Owner must have shop_id
      if (adminRole === 'shop_owner' && !adminShopId) {
        res.status(403).json({
          success: false,
          error: {
            code: 'SHOP_ID_REQUIRED',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!reservationIds || !Array.isArray(reservationIds) || reservationIds.length === 0) {
        res.status(400).json({
          success: false,
          error: 'Reservation IDs array is required'
        });
        return;
      }

      if (!status || !VALID_RESERVATION_STATUSES.includes(status)) {
        res.status(400).json({
          success: false,
          error: 'Valid reservation status is required'
        });
        return;
      }

      const results: Array<{ reservationId: string; success: boolean; error?: string }> = [];
      let successful = 0;
      let failed = 0;

      for (const reservationId of reservationIds) {
        try {
          // SECURITY: Shop Owner can only bulk update reservations from their own shop
          if (adminRole === 'shop_owner' && adminShopId) {
            const { data: reservation, error: reservationError } = await adminReservationService['supabase']
              .from('reservations')
              .select('shop_id')
              .eq('id', reservationId)
              .single();

            if (reservationError || !reservation) {
              results.push({
                reservationId,
                success: false,
                error: '예약을 찾을 수 없습니다.'
              });
              failed++;
              continue;
            }

            if (reservation.shop_id !== adminShopId) {
              logger.warn('Shop Owner attempted to bulk update reservation from another shop', {
                adminId: user.id,
                adminShopId,
                reservationId,
                reservationShopId: reservation.shop_id
              });

              results.push({
                reservationId,
                success: false,
                error: '예약을 찾을 수 없거나 접근 권한이 없습니다.'
              });
              failed++;
              continue;
            }
          }

          await adminReservationService.updateReservationStatus(reservationId, {
            status,
            notes,
            reason,
            notifyCustomer: notifyCustomers === true,
            notifyShop: notifyShops === true,
            autoProcessPayment: false // Don't auto-process payments in bulk operations
          }, user.id);

          results.push({ reservationId, success: true });
          successful++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          results.push({ reservationId, success: false, error: errorMessage });
          failed++;
        }
      }

      res.json({
        success: true,
        data: {
          results,
          summary: {
            total: reservationIds.length,
            successful,
            failed
          }
        }
      });
    } catch (error) {
      logger.error('Admin bulk reservation status update failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform bulk reservation status update'
      });
    }
  }
}

export const adminReservationController = new AdminReservationController(); 