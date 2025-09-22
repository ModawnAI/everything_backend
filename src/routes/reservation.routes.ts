/**
 * @swagger
 * tags:
 *   - name: Reservations
 *     description: Reservation management and booking endpoints
 */

/**
 * Reservation Routes
 * 
 * API endpoints for reservation management including:
 * - Available time slots for booking
 * - Reservation creation and management
 * - Reservation status updates
 */

import { Router } from 'express';
import { ReservationController } from '../controllers/reservation.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { bookingValidationMiddleware } from '../middleware/booking-validation.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();
const reservationController = new ReservationController();

// Validation schemas with v3.1 flow support
const createReservationSchema = Joi.object({
  shopId: Joi.string().uuid().required().messages({
    'string.guid': '유효하지 않은 샵 ID입니다.',
    'any.required': '샵 ID는 필수입니다.'
  }),
  services: Joi.array().items(
    Joi.object({
      serviceId: Joi.string().uuid().required().messages({
        'string.guid': '유효하지 않은 서비스 ID입니다.',
        'any.required': '서비스 ID는 필수입니다.'
      }),
      quantity: Joi.number().integer().min(1).max(10).default(1).messages({
        'number.base': '수량은 숫자여야 합니다.',
        'number.integer': '수량은 정수여야 합니다.',
        'number.min': '수량은 최소 1개 이상이어야 합니다.',
        'number.max': '수량은 최대 10개까지 가능합니다.'
      })
    })
  ).min(1).required().messages({
    'array.base': '서비스는 배열 형태로 입력해주세요.',
    'array.min': '최소 하나의 서비스를 선택해야 합니다.',
    'any.required': '서비스는 필수입니다.'
  }),
  reservationDate: Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).required().messages({
    'string.pattern.base': '날짜 형식이 올바르지 않습니다.',
    'any.required': '예약 날짜는 필수입니다.'
  }),
  reservationTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required().messages({
    'string.pattern.base': '시간 형식이 올바르지 않습니다.',
    'any.required': '예약 시간은 필수입니다.'
  }),
  specialRequests: Joi.string().max(500).optional().messages({
    'string.max': '특별 요청사항은 최대 500자까지 가능합니다.'
  }),
  pointsToUse: Joi.number().integer().min(0).optional().messages({
    'number.base': '사용할 포인트는 숫자여야 합니다.',
    'number.integer': '사용할 포인트는 정수여야 합니다.',
    'number.min': '사용할 포인트는 0 이상이어야 합니다.'
  }),
  // v3.1 Flow - Payment information
  paymentInfo: Joi.object({
    depositAmount: Joi.number().min(0).optional().messages({
      'number.base': '보증금은 숫자여야 합니다.',
      'number.min': '보증금은 0 이상이어야 합니다.'
    }),
    remainingAmount: Joi.number().min(0).optional().messages({
      'number.base': '잔여 금액은 숫자여야 합니다.',
      'number.min': '잔여 금액은 0 이상이어야 합니다.'
    }),
    paymentMethod: Joi.string().valid('card', 'cash', 'points', 'mixed').optional().messages({
      'any.only': '결제 방법은 card, cash, points, mixed 중 하나여야 합니다.'
    }),
    depositRequired: Joi.boolean().optional().messages({
      'boolean.base': '보증금 필요 여부는 true/false여야 합니다.'
    })
  }).optional(),
  // v3.1 Flow - Request metadata
  requestMetadata: Joi.object({
    source: Joi.string().valid('mobile_app', 'web_app', 'admin_panel').optional().messages({
      'any.only': '요청 소스는 mobile_app, web_app, admin_panel 중 하나여야 합니다.'
    }),
    userAgent: Joi.string().max(500).optional().messages({
      'string.max': '사용자 에이전트는 최대 500자까지 가능합니다.'
    }),
    ipAddress: Joi.string().ip().optional().messages({
      'string.ip': '유효하지 않은 IP 주소 형식입니다.'
    }),
    referrer: Joi.string().uri().optional().messages({
      'string.uri': '유효하지 않은 리퍼러 URL입니다.'
    })
  }).optional(),
  // v3.1 Flow - Notification preferences
  notificationPreferences: Joi.object({
    emailNotifications: Joi.boolean().optional().messages({
      'boolean.base': '이메일 알림 설정은 true/false여야 합니다.'
    }),
    smsNotifications: Joi.boolean().optional().messages({
      'boolean.base': 'SMS 알림 설정은 true/false여야 합니다.'
    }),
    pushNotifications: Joi.boolean().optional().messages({
      'boolean.base': '푸시 알림 설정은 true/false여야 합니다.'
    })
  }).optional()
});

const reservationIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': '유효하지 않은 예약 ID입니다.',
    'any.required': '예약 ID는 필수입니다.'
  })
});

/**
 * @swagger
 * /api/shops/{shopId}/available-slots:
 *   get:
 *     tags:
 *       - Reservations
 *     summary: Get available time slots
 *     description: Get available time slots for a shop on a specific date
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop UUID
 *       - name: date
 *         in: query
 *         required: true
 *         schema:
 *           type: string
 *           format: date
 *         description: Date in YYYY-MM-DD format
 *       - name: serviceIds[]
 *         in: query
 *         required: true
 *         schema:
 *           type: array
 *           items:
 *             type: string
 *             format: uuid
 *         description: Array of service UUIDs
 *       - name: startTime
 *         in: query
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: Start time filter (HH:MM format)
 *       - name: endTime
 *         in: query
 *         schema:
 *           type: string
 *           pattern: '^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$'
 *         description: End time filter (HH:MM format)
 *       - name: interval
 *         in: query
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Interval in minutes
 *     responses:
 *       200:
 *         description: Available time slots retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 slots:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/TimeSlot'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/shops/:shopId/available-slots',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      await reservationController.getAvailableSlots(req, res);
    } catch (error) {
      logger.error('Error in available slots route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 가능 시간 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * POST /api/reservations
 * Create a new reservation
 * 
 * Request Body:
 * {
 *   "shopId": "uuid",
 *   "services": [
 *     {
 *       "serviceId": "uuid",
 *       "quantity": 1
 *     }
 *   ],
 *   "reservationDate": "2024-03-15",
 *   "reservationTime": "14:00",
 *   "specialRequests": "특별 요청사항",
 *   "pointsToUse": 5000
 * }
 */
router.post('/',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }), // 20 requests per 15 minutes
  validateRequestBody(createReservationSchema),
  bookingValidationMiddleware.validateBookingRequest,
  async (req, res) => {
    try {
      await reservationController.createReservation(req, res);
    } catch (error) {
      logger.error('Error in create reservation route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/reservations
 * Get user's reservations with filtering
 * 
 * Query Parameters:
 * - status: Filter by reservation status
 * - startDate: Filter from date
 * - endDate: Filter to date
 * - shopId: Filter by shop
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20)
 */
router.get('/',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      await reservationController.getReservations(req, res);
    } catch (error) {
      logger.error('Error in get reservations route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/reservations/:id
 * Get specific reservation details
 * 
 * Path Parameters:
 * - id: Reservation UUID
 */
router.get('/:id',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      await reservationController.getReservationById(req, res);
    } catch (error) {
      logger.error('Error in get reservation by id route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id
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

// Validation schema for cancellation request
const cancelReservationSchema = Joi.object({
  reason: Joi.string().max(500).optional().messages({
    'string.max': '취소 사유는 최대 500자까지 가능합니다.'
  }),
  cancellationType: Joi.string().valid('user_request', 'shop_request', 'no_show', 'admin_force').optional().messages({
    'any.only': '유효하지 않은 취소 유형입니다.'
  }),
  refundPreference: Joi.string().valid('full_refund', 'partial_refund', 'no_refund').optional().messages({
    'any.only': '유효하지 않은 환불 선호도입니다.'
  }),
  notifyShop: Joi.boolean().optional().messages({
    'boolean.base': '샵 알림 여부는 true/false 값이어야 합니다.'
  }),
  notifyCustomer: Joi.boolean().optional().messages({
    'boolean.base': '고객 알림 여부는 true/false 값이어야 합니다.'
  })
});

/**
 * PUT /api/reservations/:id/cancel
 * Cancel a reservation with comprehensive v3.2 cancellation system
 * 
 * Path Parameters:
 * - id: Reservation UUID
 * 
 * Request Body:
 * - reason: Optional cancellation reason (max 500 characters)
 * - cancellationType: Optional cancellation type (user_request, shop_request, no_show, admin_force)
 * - refundPreference: Optional refund preference (full_refund, partial_refund, no_refund)
 * - notifyShop: Optional flag to notify shop owner (default: true)
 * - notifyCustomer: Optional flag to notify customer (default: true)
 * 
 * Returns:
 * - Cancelled reservation information
 * - Refund processing details
 * - Cancellation audit trail
 * 
 * Business Rules:
 * - User can only cancel their own reservations
 * - 24-hour refund policy applies based on cancellation timing
 * - Automatic refund processing based on payment status
 * - Comprehensive audit trail for all cancellations
 * 
 * Example:
 * PUT /api/reservations/123e4567-e89b-12d3-a456-426614174000/cancel
 * Body: {
 *   "reason": "개인 사정으로 인한 취소",
 *   "cancellationType": "user_request",
 *   "refundPreference": "full_refund",
 *   "notifyShop": true,
 *   "notifyCustomer": false
 * }
 */
router.put('/:id/cancel',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // 10 requests per 15 minutes
  validateRequestBody(cancelReservationSchema),
  async (req, res) => {
    try {
      await reservationController.cancelReservation(req, res);
    } catch (error) {
      logger.error('Error in cancel reservation route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 취소 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);



// Error handling middleware for reservation routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in reservation routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '예약 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router; 