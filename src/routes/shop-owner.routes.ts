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
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
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
router.use(authenticateJWT);

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