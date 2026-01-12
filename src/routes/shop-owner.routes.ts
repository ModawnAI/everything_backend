/**
 * Shop Owner Routes
 * 
 * API endpoints for shop owner dashboard including:
 * - Dashboard overview and analytics
 * - Reservation management and status updates
 * - Shop owner profile and settings
 * - Revenue and performance tracking
 */

import { Router } from 'express';
import { shopOwnerController } from '../controllers/shop-owner.controller';
import { ShopUsersController } from '../controllers/shop-users.controller';
import { ShopPaymentsController } from '../controllers/shop-payments.controller';
import { ShopController } from '../controllers/shop.controller';
import { ShopOperatingHoursController } from '../controllers/shop-operating-hours.controller';
import { shopOwnerReviewController } from '../controllers/shop-owner-review.controller';
import { shopTagsController } from '../controllers/shop-tags.controller';

// Initialize controller instances for customers and payments
const shopUsersController = new ShopUsersController();
const shopPaymentsController = new ShopPaymentsController();
const shopController = new ShopController();
const shopOperatingHoursController = new ShopOperatingHoursController();
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { requireShopOwnerWithShop, requireSpecificShopOwnership } from '../middleware/shop-owner-auth.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();

// Validation schemas
const updateReservationStatusSchema = Joi.object({
  status: Joi.string().valid(
    'requested', 'confirmed', 'completed', 'cancelled', 'no_show'
  ).required().messages({
    'any.only': '유효하지 않은 예약 상태입니다.',
    'any.required': '예약 상태는 필수입니다.'
  }),
  notes: Joi.string().max(500).optional().messages({
    'string.max': '메모는 최대 500자까지 가능합니다.'
  })
});

const reservationIdSchema = Joi.object({
  reservationId: Joi.string().uuid().required().messages({
    'string.guid': '유효하지 않은 예약 ID입니다.',
    'any.required': '예약 ID는 필수입니다.'
  })
});

const confirmationRequestSchema = Joi.object({
  notes: Joi.string().max(500).optional().messages({
    'string.max': '확정 메모는 최대 500자까지 가능합니다.'
  })
});

const rejectionRequestSchema = Joi.object({
  notes: Joi.string().max(500).optional().messages({
    'string.max': '거절 사유는 최대 500자까지 가능합니다.'
  })
});

const serviceCompletionRequestSchema = Joi.object({
  finalAmount: Joi.number().min(0).optional().messages({
    'number.min': '최종 금액은 0 이상이어야 합니다.'
  }),
  completionNotes: Joi.string().max(1000).optional().messages({
    'string.max': '완료 메모는 최대 1000자까지 가능합니다.'
  }),
  serviceDetails: Joi.object().optional().messages({
    'object.base': '서비스 상세 정보는 객체 형태여야 합니다.'
  })
});

const analyticsQuerySchema = Joi.object({
  period: Joi.string().valid('day', 'week', 'month', 'year').optional().messages({
    'any.only': '유효하지 않은 기간입니다.'
  }),
  startDate: Joi.string().isoDate().optional().messages({
    'string.isoDate': '시작 날짜 형식이 올바르지 않습니다.'
  }),
  endDate: Joi.string().isoDate().optional().messages({
    'string.isoDate': '종료 날짜 형식이 올바르지 않습니다.'
  })
});

const reservationListQuerySchema = Joi.object({
  status: Joi.string().valid(
    'requested', 'confirmed', 'completed', 'cancelled', 'no_show'
  ).optional().messages({
    'any.only': '유효하지 않은 예약 상태입니다.'
  }),
  startDate: Joi.string().isoDate().optional().messages({
    'string.isoDate': '시작 날짜 형식이 올바르지 않습니다.'
  }),
  endDate: Joi.string().isoDate().optional().messages({
    'string.isoDate': '종료 날짜 형식이 올바르지 않습니다.'
  }),
  page: Joi.string().pattern(/^\d+$/).optional().messages({
    'string.pattern.base': '페이지 번호는 숫자로 입력해주세요.'
  }),
  limit: Joi.string().pattern(/^\d+$/).optional().messages({
    'string.pattern.base': '페이지 크기는 숫자로 입력해주세요.'
  }),
  search: Joi.string().max(100).optional().messages({
    'string.max': '검색어는 최대 100자까지 가능합니다.'
  })
});

// Rate limiting configuration
const shopOwnerRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    strategy: 'fixed_window'
  }
});

const analyticsRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs
    strategy: 'fixed_window'
  }
});

const sensitiveRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // limit each IP to 30 requests per windowMs
    strategy: 'fixed_window'
  }
});

// Middleware for all routes
router.use(authenticateJWT());

/**
 * GET /api/shop-owner/dashboard
 * Get shop owner dashboard overview
 * 
 * Returns:
 * - Number of shops
 * - Today's reservations count
 * - Pending reservations count
 * - Monthly revenue
 * - Recent pending reservations
 * 
 * Example: GET /api/shop-owner/dashboard
 */

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: /dashboard 조회
 *     description: GET endpoint for /dashboard
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/dashboard',
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopOwnerController.getDashboard(req, res);
    } catch (error) {
      logger.error('Error in dashboard route', {
        error: error instanceof Error ? error.message : 'Unknown error'
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
);

/**
 * GET /api/shop-owner/analytics
 * Get shop analytics and performance metrics
 * 
 * Query Parameters:
 * - period: Analysis period ('day', 'week', 'month', 'year') (optional, default: 'month')
 * - startDate: Custom start date (optional)
 * - endDate: Custom end date (optional)
 * 
 * Returns:
 * - Overview metrics (total reservations, completion rate, revenue, etc.)
 * - Chart data grouped by date
 * - Shop information
 * 
 * Example: GET /api/shop-owner/analytics?period=month
 * Example: GET /api/shop-owner/analytics?startDate=2024-01-01&endDate=2024-01-31
 */

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: /analytics 조회
 *     description: GET endpoint for /analytics
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/analytics',
  analyticsRateLimit,
  validateRequestBody(analyticsQuerySchema),
  async (req, res) => {
    try {
      await shopOwnerController.getAnalytics(req, res);
    } catch (error) {
      logger.error('Error in analytics route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
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
);

/**
 * GET /api/shop-owner/analytics/export-pdf
 * Export analytics data as PDF report
 *
 * Query Parameters:
 * - period: Analysis period ('day', 'week', 'month', 'year') (optional, default: 'month')
 * - startDate: Custom start date (optional)
 * - endDate: Custom end date (optional)
 *
 * Returns:
 * - PDF file download with analytics report
 *
 * Example: GET /api/shop-owner/analytics/export-pdf?period=month
 */
router.get('/analytics/export-pdf',
  analyticsRateLimit,
  validateRequestBody(analyticsQuerySchema),
  async (req, res) => {
    try {
      await shopOwnerController.exportAnalyticsPdf(req, res);
    } catch (error) {
      logger.error('Error in analytics PDF export route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'PDF 리포트 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/reservations
 * Get shop reservations with filtering and pagination
 * 
 * Query Parameters:
 * - status: Filter by reservation status (optional)
 * - startDate: Filter by start date (optional)
 * - endDate: Filter by end date (optional)
 * - page: Page number (optional, default: 1)
 * - limit: Page size (optional, default: 20)
 * - search: Search by customer name or phone (optional)
 * 
 * Returns:
 * - List of reservations with customer and service details
 * - Pagination information
 * 
 * Example: GET /api/shop-owner/reservations?status=requested&page=1&limit=20
 * Example: GET /api/shop-owner/reservations?startDate=2024-01-01&endDate=2024-01-31
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     summary: /reservations 조회
 *     description: GET endpoint for /reservations
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/reservations',
  shopOwnerRateLimit,
  validateRequestBody(reservationListQuerySchema),
  async (req, res) => {
    try {
      await shopOwnerController.getReservations(req, res);
    } catch (error) {
      logger.error('Error in reservations route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
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
);

/**
 * GET /api/shop-owner/reservations/pending
 * Get pending reservations (requested status) for shop owners
 * 
 * Query Parameters:
 * - page: Page number (optional, default: 1)
 * - limit: Page size (optional, default: 20)
 * - search: Search by customer name, phone, or email (optional)
 * 
 * Returns:
 * - List of pending reservations with detailed information
 * - Pagination information
 * - Summary statistics
 * - Waiting time and urgency level for each reservation
 * 
 * Example: GET /api/shop-owner/reservations/pending?page=1&limit=20
 * Example: GET /api/shop-owner/reservations/pending?search=김고객
 */

/**
 * @swagger
 * /reservations/pending:
 *   get:
 *     summary: /reservations/pending 조회
 *     description: GET endpoint for /reservations/pending
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/reservations/pending',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  validateRequestBody(reservationListQuerySchema),
  async (req, res) => {
    try {
      await shopOwnerController.getPendingReservations(req, res);
    } catch (error) {
      logger.error('Error in pending reservations route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
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
);

/**
 * GET /api/shop-owner/reservations/:reservationId
 * Get detailed information about a specific reservation
 *
 * Path Parameters:
 * - reservationId: Reservation UUID (required)
 *
 * Returns:
 * - Detailed reservation information including customer, services, payment info
 */
router.get('/reservations/:reservationId',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).user?.shopId;
      const { reservationId } = req.params;

      if (!shopId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      // Fetch reservation with all related data
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select(`
          *,
          users:user_id (
            id,
            name,
            nickname,
            email,
            phone_number,
            profile_image_url,
            total_points,
            birth_date,
            gender
          ),
          reservation_services (
            id,
            service_id,
            quantity,
            unit_price,
            total_price,
            shop_services:service_id (
              id,
              name,
              price,
              duration
            )
          )
        `)
        .eq('id', reservationId)
        .eq('shop_id', shopId)
        .single();

      if (error || !reservation) {
        logger.error('Reservation not found', { reservationId, shopId, error });
        res.status(404).json({
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없습니다.'
          }
        });
        return;
      }

      // Transform data for frontend
      const transformedReservation = {
        id: reservation.id,
        status: reservation.status,
        reservation_date: reservation.reservation_date,
        reservation_time: reservation.reservation_time,
        total_amount: reservation.total_amount,
        total_price: reservation.total_amount,
        deposit_amount: reservation.deposit_amount || 0,
        remaining_amount: (reservation.total_amount || 0) - (reservation.deposit_amount || 0),
        points_used: reservation.points_used || 0,
        points_earned: reservation.points_earned || 0,
        special_requests: reservation.special_requests,
        shop_notes: reservation.shop_notes,
        cancellation_reason: reservation.cancellation_reason,
        customer: reservation.users ? {
          id: reservation.users.id,
          name: reservation.users.name || reservation.users.nickname || '고객',
          email: reservation.users.email,
          phone_number: reservation.users.phone_number,
          profile_image_url: reservation.users.profile_image_url,
          total_points: reservation.users.total_points,
          birth_date: reservation.users.birth_date,
          gender: reservation.users.gender
        } : null,
        customer_name: reservation.users?.name || reservation.users?.nickname || '고객',
        customer_email: reservation.users?.email,
        customer_phone: reservation.users?.phone_number,
        user_id: reservation.user_id,
        services: reservation.reservation_services?.map((rs: any) => ({
          id: rs.id,
          service_id: rs.service_id,
          name: rs.shop_services?.name || '서비스',
          service_name: rs.shop_services?.name || '서비스',
          quantity: rs.quantity || 1,
          unit_price: rs.unit_price || 0,
          total_price: rs.total_price || 0,
          price: rs.total_price || 0,
          duration: rs.shop_services?.duration
        })) || [],
        created_at: reservation.created_at,
        updated_at: reservation.updated_at
      };

      res.status(200).json({
        success: true,
        reservation: transformedReservation
      });
    } catch (error) {
      logger.error('Error fetching reservation detail', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 상세 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * PUT /api/shop-owner/reservations/:reservationId/confirm
 * Confirm a pending reservation (requested -> confirmed)
 * 
 * Path Parameters:
 * - reservationId: Reservation UUID (required)
 * 
 * Body Parameters:
 * - notes: Optional confirmation notes (optional)
 * 
 * Returns:
 * - Confirmed reservation information
 * - Success message
 * 
 * Business Rules:
 * - Only reservations with 'requested' status can be confirmed
 * - Shop owner must own the reservation
 * - Deposit must be paid if required
 * - Sends confirmation notification to customer
 * 
 * Example: PUT /api/shop-owner/reservations/123e4567-e89b-12d3-a456-426614174000/confirm
 * Body: { "notes": "예약 확정되었습니다. 즐거운 시간 되세요!" }
 */

/**
 * @swagger
 * /reservations/:reservationId/confirm:
 *   put:
 *     summary: PUT /reservations/:reservationId/confirm (PUT /reservations/:reservationId/confirm)
 *     description: PUT endpoint for /reservations/:reservationId/confirm
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.put('/reservations/:reservationId/confirm',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  validateRequestBody(confirmationRequestSchema),
  async (req, res) => {
    try {
      await shopOwnerController.confirmReservation(req as any, res);
    } catch (error) {
      logger.error('Error in confirm reservation route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        body: req.body
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
);

/**
 * PUT /api/shop-owner/reservations/:reservationId/reject
 * Reject a pending reservation (requested -> cancelled_by_shop)
 * 
 * Path Parameters:
 * - reservationId: Reservation UUID (required)
 * 
 * Body Parameters:
 * - notes: Optional rejection reason (optional)
 * 
 * Returns:
 * - Rejected reservation information
 * - Success message
 * - Refund status if applicable
 * 
 * Business Rules:
 * - Only reservations with 'requested' status can be rejected
 * - Shop owner must own the reservation
 * - Automatically processes deposit refund if paid
 * - Sends rejection notification to customer
 * 
 * Example: PUT /api/shop-owner/reservations/123e4567-e89b-12d3-a456-426614174000/reject
 * Body: { "notes": "예약 가능한 시간이 없어서 거절합니다. 죄송합니다." }
 */

/**
 * @swagger
 * /reservations/:reservationId/reject:
 *   put:
 *     summary: PUT /reservations/:reservationId/reject (PUT /reservations/:reservationId/reject)
 *     description: PUT endpoint for /reservations/:reservationId/reject
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.put('/reservations/:reservationId/reject',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  validateRequestBody(rejectionRequestSchema),
  async (req, res) => {
    try {
      await shopOwnerController.rejectReservation(req as any, res);
    } catch (error) {
      logger.error('Error in reject reservation route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        body: req.body
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
);

/**
 * PUT /api/shop-owner/reservations/:reservationId/complete
 * Mark service as completed and trigger point calculation
 * 
 * Path Parameters:
 * - reservationId: Reservation UUID (required)
 * 
 * Body Parameters:
 * - finalAmount: Final service amount (optional, defaults to original amount)
 * - completionNotes: Optional completion notes (optional)
 * - serviceDetails: Additional service details (optional)
 * 
 * Returns:
 * - Completed reservation information
 * - Point calculation results
 * - Success message
 * 
 * Business Rules:
 * - Only reservations with 'confirmed' status can be completed
 * - Shop owner must own the reservation
 * - Automatically calculates and awards points (2.5% rate, 300,000 KRW max)
 * - Updates payment status to 'completed'
 * - Triggers referral point awards if applicable
 * 
 * Example: PUT /api/shop-owner/reservations/123e4567-e89b-12d3-a456-426614174000/complete
 * Body: { "finalAmount": 50000, "completionNotes": "서비스 완료되었습니다" }
 */

/**
 * @swagger
 * /reservations/:reservationId/complete:
 *   put:
 *     summary: PUT /reservations/:reservationId/complete (PUT /reservations/:reservationId/complete)
 *     description: PUT endpoint for /reservations/:reservationId/complete
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.put('/reservations/:reservationId/complete',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  validateRequestBody(reservationIdSchema),
  validateRequestBody(serviceCompletionRequestSchema),
  async (req, res) => {
    try {
      await shopOwnerController.completeService(req as any, res);
    } catch (error) {
      logger.error('Error in complete service route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        body: req.body
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
);

/**
 * PUT /api/shop-owner/reservations/:reservationId/status
 * Update reservation status (confirm, complete, cancel)
 * 
 * Path Parameters:
 * - reservationId: Reservation UUID (required)
 * 
 * Body Parameters:
 * - status: New reservation status (required)
 * - notes: Optional notes for status change (optional)
 * 
 * Returns:
 * - Updated reservation information
 * - Success message
 * 
 * Example: PUT /api/shop-owner/reservations/123e4567-e89b-12d3-a456-426614174000/status
 * Body: { "status": "confirmed", "notes": "예약 확정되었습니다" }
 */

/**
 * @swagger
 * /reservations/:reservationId/status:
 *   put:
 *     summary: PUT /reservations/:reservationId/status (PUT /reservations/:reservationId/status)
 *     description: PUT endpoint for /reservations/:reservationId/status
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.put('/reservations/:reservationId/status',
  sensitiveRateLimit,
  validateRequestBody(reservationIdSchema),
  validateRequestBody(updateReservationStatusSchema),
  async (req, res) => {
    try {
      await shopOwnerController.updateReservationStatus(req as any, res);
    } catch (error) {
      logger.error('Error in update reservation status route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.reservationId,
        body: req.body
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
);

/**
 * GET /api/shop-owner/profile
 * Get shop owner profile and shop information
 * 
 * Returns:
 * - User profile information
 * - List of user's shops with details
 * 
 * Example: GET /api/shop-owner/profile
 */

/**
 * @swagger
 * /profile:
 *   get:
 *     summary: /profile 조회
 *     description: GET endpoint for /profile
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Shops]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/profile',
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopOwnerController.getProfile(req, res);
    } catch (error) {
      logger.error('Error in profile route', {
        error: error instanceof Error ? error.message : 'Unknown error'
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
);

/**
 * GET /api/shop-owner/shops/:id
 * Get specific shop details by shop ID (with ownership verification)
 *
 * Path Parameters:
 * - id: Shop UUID (required)
 *
 * Returns:
 * - Shop details including images, services, and statistics
 * - Only returns shop if the authenticated user owns it
 *
 * Example: GET /api/shop-owner/shops/22222222-2222-2222-2222-222222222222
 */
router.get('/shops/:id',
  requireSpecificShopOwnership('params', 'id'),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopController.getShopById(req, res);
    } catch (error) {
      logger.error('Error in get shop by id route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 정보 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/shops/:id/operating-hours
 * Get shop operating hours by shop ID (with ownership verification)
 *
 * Path Parameters:
 * - id: Shop UUID (required)
 *
 * Returns:
 * - Shop operating hours schedule
 * - Current shop status (open/closed)
 * - Only returns if the authenticated user owns the shop
 *
 * Example: GET /api/shop-owner/shops/22222222-2222-2222-2222-222222222222/operating-hours
 */
router.get('/shops/:id/operating-hours',
  requireSpecificShopOwnership('params', 'id'),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      // The middleware already loaded shop and verified ownership
      // Get the shop operating hours from req.shop
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            details: '샵이 존재하지 않거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      const supabase = require('../config/database').getSupabaseClient();

      // Get full shop data with operating hours
      const { data: shopData, error: shopError } = await supabase
        .from('shops')
        .select('id, operating_hours')
        .eq('id', shop.id)
        .single();

      if (shopError || !shopData) {
        logger.error('Failed to fetch shop operating hours', {
          error: shopError?.message,
          shopId: shop.id
        });

        res.status(500).json({
          error: {
            code: 'DATABASE_ERROR',
            message: '영업시간 조회 중 오류가 발생했습니다.',
            details: '잠시 후 다시 시도해주세요.'
          }
        });
        return;
      }

      // Calculate current status
      const currentStatus = shopOperatingHoursController['getCurrentStatus'](shopData.operating_hours);

      logger.info('Shop operating hours retrieved successfully', {
        userId: (req as any).user?.id,
        shopId: shop.id,
        hasOperatingHours: !!shopData.operating_hours
      });

      res.status(200).json({
        success: true,
        data: {
          operating_hours: shopData.operating_hours || shopOperatingHoursController['getDefaultOperatingHours'](),
          current_status: currentStatus
        },
        message: '영업시간을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in get shop operating hours route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/customers
 * Get shop customers (users who made reservations at this shop)
 *
 * Query Parameters:
 * - status: Filter by reservation status
 * - search: Search by name, email, or phone
 * - sortBy: Sort field (total_reservations, total_spent, last_reservation_date, name)
 * - sortOrder: Sort order (asc, desc)
 * - page: Page number
 * - limit: Page size
 *
 * Returns:
 * - List of customers with reservation statistics
 * - Pagination information
 */
router.get('/customers',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      // Extract shopId from shop object (added by requireShopOwnerWithShop middleware)
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      // Forward to shop-users controller
      await shopUsersController.getShopUsers(req as any, res);
    } catch (error) {
      logger.error('Error in customers route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고객 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/customers/stats
 * Get customer statistics for the shop
 *
 * Returns:
 * - Total customers count
 * - Reservation status breakdown
 * - Customer engagement metrics
 */
router.get('/customers/stats',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopUsersController.getShopUserRoles(req as any, res);
    } catch (error) {
      logger.error('Error in customer stats route', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고객 통계 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/customers/new
 * Get new customers for the shop within a date range
 *
 * Query Parameters:
 * - startDate: Start date (YYYY-MM-DD)
 * - endDate: End date (YYYY-MM-DD)
 *
 * Returns:
 * - Count of new customers
 * - List of new customers with details
 * - Period information
 */
router.get('/customers/new',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopUsersController.getNewCustomers(req as any, res);
    } catch (error) {
      logger.error('Error in new customers route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '신규 고객 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/customers/:customerId/memo
 * Get memo for a specific customer
 *
 * Returns:
 * - Customer memo content
 * - Last updated timestamp
 */
router.get('/customers/:customerId/memo',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopUsersController.getCustomerMemo(req as any, res);
    } catch (error) {
      logger.error('Error in get customer memo route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: req.params.customerId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고객 메모 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * PUT /api/shop-owner/customers/:customerId/memo
 * Save (create or update) memo for a specific customer
 *
 * Body:
 * - memo: string - The memo content
 *
 * Returns:
 * - Success message
 */
router.put('/customers/:customerId/memo',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopUsersController.saveCustomerMemo(req as any, res);
    } catch (error) {
      logger.error('Error in save customer memo route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: req.params.customerId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고객 메모 저장 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * DELETE /api/shop-owner/customers/:customerId/memo
 * Delete memo for a specific customer
 *
 * Returns:
 * - Success message
 */
router.delete('/customers/:customerId/memo',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopUsersController.deleteCustomerMemo(req as any, res);
    } catch (error) {
      logger.error('Error in delete customer memo route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        customerId: req.params.customerId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '고객 메모 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/payments
 * Get payment records for shop owner's shop
 *
 * Query Parameters:
 * - status: Filter by payment status
 * - paymentMethod: Filter by payment method
 * - startDate: Filter by start date
 * - endDate: Filter by end date
 * - page: Page number
 * - limit: Page size
 *
 * Returns:
 * - List of payments with reservation details
 * - Pagination information
 */
router.get('/payments',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      const shopId = (req as any).shop?.id;

      // Set shopId in params for controller to access
      (req as any).params = { ...(req as any).params, shopId };

      await shopPaymentsController.getShopPayments(req as any, res);
    } catch (error) {
      logger.error('Error in payments route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 내역 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/settlement-schedule
 * Get settlement schedule for shop owner
 *
 * Returns:
 * - Summary with total pending amount, this week's settlements
 * - Schedule with dates, amounts, and payment details
 */
router.get(
  '/settlement-schedule',
  shopOwnerRateLimit,
  ...requireShopOwnerWithShop(),
  async (req: any, res: any) => {
    try {
      await shopOwnerController.getSettlementSchedule(req, res);
    } catch (error) {
      logger.error('Error in settlement schedule route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '정산 일정 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================
// Review Management Routes
// ============================================

/**
 * GET /api/shop-owner/reviews
 * Get shop reviews with replies and blind request status
 *
 * Query Parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 * - status: Filter by status ('all', 'replied', 'unreplied', 'blinded')
 * - sortBy: Sort order ('newest', 'oldest', 'rating_high', 'rating_low')
 *
 * Returns:
 * - List of reviews with replies and blind request info
 * - Pagination information
 */
router.get('/reviews',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    console.log('🔍 [ROUTE] /reviews handler entered', {
      shop: (req as any).shop,
      user: (req as any).user?.id,
      query: req.query
    });
    try {
      console.log('🔍 [ROUTE] Calling controller...');
      await shopOwnerReviewController.getReviews(req as any, res);
      console.log('🔍 [ROUTE] Controller returned');
    } catch (error) {
      console.error('❌ [ROUTE] Error in reviews route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '리뷰 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/reviews/stats
 * Get review statistics for the shop
 *
 * Returns:
 * - Total reviews count
 * - Average rating
 * - Replied/unreplied counts
 * - Blinded count
 * - Pending blind requests count
 */
router.get('/reviews/stats',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopOwnerReviewController.getStats(req as any, res);
    } catch (error) {
      logger.error('Error in review stats route', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '리뷰 통계 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * POST /api/shop-owner/reviews/:reviewId/reply
 * Create a reply to a review
 *
 * Request Body:
 * - replyText: Reply content (required, max 1000 chars)
 *
 * Returns:
 * - Created reply object
 */
router.post('/reviews/:reviewId/reply',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  async (req, res) => {
    try {
      await shopOwnerReviewController.createReply(req as any, res);
    } catch (error) {
      logger.error('Error in create reply route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '답글 등록 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * PUT /api/shop-owner/reviews/:reviewId/reply
 * Update an existing reply
 *
 * Request Body:
 * - replyId: Reply ID to update (required)
 * - replyText: Updated reply content (required, max 1000 chars)
 *
 * Returns:
 * - Updated reply object
 */
router.put('/reviews/:reviewId/reply',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  async (req, res) => {
    try {
      await shopOwnerReviewController.updateReply(req as any, res);
    } catch (error) {
      logger.error('Error in update reply route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '답글 수정 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * DELETE /api/shop-owner/reviews/:reviewId/reply
 * Delete a reply
 *
 * Request Body:
 * - replyId: Reply ID to delete (required)
 *
 * Returns:
 * - Success message
 */
router.delete('/reviews/:reviewId/reply',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  async (req, res) => {
    try {
      await shopOwnerReviewController.deleteReply(req as any, res);
    } catch (error) {
      logger.error('Error in delete reply route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '답글 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * POST /api/shop-owner/reviews/:reviewId/blind-request
 * Request blind processing for a malicious review
 *
 * Request Body:
 * - reason: Detailed reason for blind request (required)
 * - reasonCategory: Category ('profanity', 'false_info', 'personal_attack', 'spam', 'other')
 * - evidenceUrls: Array of evidence URLs (optional)
 *
 * Returns:
 * - Created blind request object
 */
router.post('/reviews/:reviewId/blind-request',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  async (req, res) => {
    try {
      await shopOwnerReviewController.requestBlind(req as any, res);
    } catch (error) {
      logger.error('Error in blind request route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId: req.params.reviewId
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '블라인드 요청 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================
// Shop Tags Management Routes
// ============================================

/**
 * GET /api/shop-owner/settings/tags
 * Get shop tags for the authenticated shop owner
 *
 * Returns:
 * - List of tags with display order
 * - Tag count
 */
router.get('/settings/tags',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopTagsController.getTags(req as any, res);
    } catch (error) {
      logger.error('Error in get tags route', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * PUT /api/shop-owner/settings/tags
 * Update shop tags (replace all)
 *
 * Request Body:
 * - tags: Array of tag strings (max 10 tags, 20 chars each)
 *
 * Returns:
 * - Updated list of tags
 * - Tag count
 */
router.put('/settings/tags',
  ...requireShopOwnerWithShop(),
  sensitiveRateLimit,
  async (req, res) => {
    try {
      await shopTagsController.updateTags(req as any, res);
    } catch (error) {
      logger.error('Error in update tags route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 저장 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/settings/tags/popular
 * Get popular tags for autocomplete
 *
 * Query Parameters:
 * - limit: Number of tags to return (default: 20, max: 50)
 *
 * Returns:
 * - List of popular tags with usage count
 */
router.get('/settings/tags/popular',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopTagsController.getPopularTags(req as any, res);
    } catch (error) {
      logger.error('Error in popular tags route', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인기 태그 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shop-owner/settings/tags/search
 * Search tags for autocomplete
 *
 * Query Parameters:
 * - q: Search query string
 * - limit: Number of results (default: 10, max: 20)
 *
 * Returns:
 * - List of matching tags
 */
router.get('/settings/tags/search',
  ...requireShopOwnerWithShop(),
  shopOwnerRateLimit,
  async (req, res) => {
    try {
      await shopTagsController.searchTags(req as any, res);
    } catch (error) {
      logger.error('Error in search tags route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for shop owner routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop owner routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '샵 오너 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router; 