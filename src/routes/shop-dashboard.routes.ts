/**
 * Shop Dashboard Routes
 * 
 * Comprehensive API endpoints for shop owner dashboard including:
 * - Dashboard overview and analytics
 * - Shop profile management
 * - Service catalog management
 * - Operating hours management
 * - Reservation management and status updates
 * - Revenue and performance tracking
 * - Shop settings and preferences
 */

import { Router } from 'express';
import { shopOwnerController } from '../controllers/shop-owner.controller';
import { shopProfileController } from '../controllers/shop-profile.controller';
import { shopServiceController } from '../controllers/shop-service.controller';
import { shopOperatingHoursController } from '../controllers/shop-operating-hours.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop, requireShopOwnerWithService } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

// Import validation schemas
import Joi from 'joi';
import { validateShopProfileUpdate } from '../validators/shop-profile.validators';
import { validateOperatingHoursComprehensive } from '../validators/shop-operating-hours.validators';
import {
  validateCreateService,
  validateUpdateService,
  validateServiceListQuery,
  validateServiceId
} from '../validators/shop-service.validators';

const router = Router();

// Rate limiting configurations
const dashboardRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 100 }
});

const analyticsRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 50 }
});

const profileRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 30 }
});

const serviceRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 100 }
});

const serviceUpdateRateLimit = rateLimit({
  config: { windowMs: 5 * 60 * 1000, max: 20 }
});

const operatingHoursRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 50 }
});

const operatingHoursUpdateRateLimit = rateLimit({
  config: { windowMs: 5 * 60 * 1000, max: 10 }
});

const reservationRateLimit = rateLimit({
  config: { windowMs: 15 * 60 * 1000, max: 100 }
});

const reservationUpdateRateLimit = rateLimit({
  config: { windowMs: 5 * 60 * 1000, max: 30 }
});

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

// ============================================================================
// DASHBOARD OVERVIEW ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/dashboard:
 *   get:
 *     summary: Get shop dashboard overview
 *     description: |
 *       Retrieve comprehensive dashboard overview for the authenticated shop owner including:
 *       - Shop basic information and status
 *       - Recent reservations and statistics
 *       - Revenue summary and trends
 *       - Service performance metrics
 *       - Quick action items and notifications
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved dashboard overview
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     shop_info:
 *                       type: object
 *                       properties:
 *                         id: { type: 'string', example: 'shop-123' }
 *                         name: { type: 'string', example: 'Beautiful Nails' }
 *                         status: { type: 'string', example: 'active' }
 *                         verification_status: { type: 'string', example: 'verified' }
 *                     recent_stats:
 *                       type: object
 *                       properties:
 *                         total_reservations: { type: 'integer', example: 45 }
 *                         pending_reservations: { type: 'integer', example: 3 }
 *                         completed_today: { type: 'integer', example: 8 }
 *                         revenue_today: { type: 'number', example: 240000 }
 *                     quick_actions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           action: { type: 'string', example: 'update_operating_hours' }
 *                           title: { type: 'string', example: '영업시간 업데이트' }
 *                           description: { type: 'string', example: '다음 주 영업시간을 설정하세요' }
 *                           priority: { type: 'string', example: 'high' }
 *                 message: { type: 'string', example: '대시보드 정보를 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: GET /
 *     description: GET endpoint for /
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
router.get('/',
  ...requireShopOwnerWithShop(),
  dashboardRateLimit,
  async (req, res) => {
    try {
      await shopOwnerController.getDashboard(req, res);
    } catch (error) {
      logger.error('Error in shop dashboard GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
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
 * @swagger
 * /api/shop/dashboard/analytics:
 *   get:
 *     summary: Get shop analytics and performance metrics
 *     description: |
 *       Retrieve detailed analytics and performance metrics for the authenticated shop owner including:
 *       - Revenue trends and statistics
 *       - Reservation patterns and conversion rates
 *       - Service performance and popularity
 *       - Customer demographics and behavior
 *       - Time-based analysis (daily, weekly, monthly, yearly)
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, year]
 *         description: Analysis period
 *         example: month
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for custom period analysis
 *         example: '2024-01-01'
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for custom period analysis
 *         example: '2024-01-31'
 *     responses:
 *       200:
 *         description: Successfully retrieved analytics data
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     period: { type: 'string', example: 'month' }
 *                     revenue:
 *                       type: object
 *                       properties:
 *                         total: { type: 'number', example: 2400000 }
 *                         growth: { type: 'number', example: 15.5 }
 *                         daily_average: { type: 'number', example: 80000 }
 *                     reservations:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer', example: 120 }
 *                         completed: { type: 'integer', example: 110 }
 *                         cancelled: { type: 'integer', example: 8 }
 *                         no_show: { type: 'integer', example: 2 }
 *                         conversion_rate: { type: 'number', example: 91.7 }
 *                     services:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           service_id: { type: 'string', example: 'service-123' }
 *                           name: { type: 'string', example: '젤네일' }
 *                           bookings: { type: 'integer', example: 45 }
 *                           revenue: { type: 'number', example: 1350000 }
 *                           popularity_score: { type: 'number', example: 85.5 }
 *                 message: { type: 'string', example: '분석 데이터를 성공적으로 조회했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: GET /analytics
 *     description: GET endpoint for /analytics
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
  ...requireShopOwnerWithShop(),
  analyticsRateLimit,
  validateRequestBody(analyticsQuerySchema),
  async (req, res) => {
    try {
      await shopOwnerController.getAnalytics(req, res);
    } catch (error) {
      logger.error('Error in shop analytics GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '분석 데이터 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================================================
// SHOP PROFILE MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/dashboard/profile:
 *   get:
 *     summary: Get shop profile information
 *     description: |
 *       Retrieve the authenticated shop owner's complete shop profile information including:
 *       - Basic shop information (name, description, contact details)
 *       - Location and address information
 *       - Business registration and verification status
 *       - Operating hours and availability
 *       - Payment methods and policies
 *       - Service categories and specialties
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved shop profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Shop'
 *                 message: { type: 'string', example: '샵 프로필을 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ShopNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/profile',
  ...requireShopOwnerWithShop(),
  profileRateLimit,
  async (req, res) => {
    try {
      await shopProfileController.getShopProfile(req, res);
    } catch (error) {
      logger.error('Error in shop profile GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 프로필 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/profile:
 *   put:
 *     summary: Update shop profile information
 *     description: |
 *       Update the authenticated shop owner's shop profile information. 
 *       Supports partial updates - only provided fields will be updated.
 *       
 *       **Key Features:**
 *       - Basic information updates (name, description, contact details)
 *       - Location and address updates
 *       - Business registration information updates
 *       - Operating hours and availability updates
 *       - Payment methods and policy updates
 *       - Service categories and specialties updates
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Profile]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Shop name
 *                 example: "Beautiful Nails Studio"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Shop description
 *                 example: "프리미엄 네일 아트 전문 샵"
 *               phone_number:
 *                 type: string
 *                 pattern: "^[0-9-+\\s()]+$"
 *                 description: Contact phone number
 *                 example: "02-1234-5678"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *                 example: "info@beautifulnails.com"
 *               address:
 *                 type: string
 *                 minLength: 1
 *                 description: Shop address
 *                 example: "서울시 강남구 테헤란로 123"
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Latitude coordinate
 *                 example: 37.5665
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Longitude coordinate
 *                 example: 126.9780
 *               business_license:
 *                 type: string
 *                 pattern: "^[0-9]{10}$"
 *                 description: 10-digit Korean business registration number
 *                 example: "1234567890"
 *               service_categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 description: Service categories offered
 *                 example: ["nail", "eyelash"]
 *               operating_hours:
 *                 type: object
 *                 description: Operating hours by day of week
 *                 additionalProperties:
 *                   type: object
 *                   properties:
 *                     open:
 *                       type: string
 *                       pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
 *                       description: Opening time (HH:mm format)
 *                       example: "09:00"
 *                     close:
 *                       type: string
 *                       pattern: "^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$"
 *                       description: Closing time (HH:mm format)
 *                       example: "21:00"
 *                     is_open:
 *                       type: boolean
 *                       description: Whether the shop is open on this day
 *                       example: true
 *                   required: [open, close]
 *                 example:
 *                   monday: { "open": "09:00", "close": "21:00", "is_open": true }
 *                   tuesday: { "open": "09:00", "close": "21:00", "is_open": true }
 *                   sunday: { "is_open": false }
 *               payment_methods:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [cash, card, bank_transfer, mobile_payment]
 *                 description: Accepted payment methods
 *                 example: ["cash", "card", "mobile_payment"]
 *     responses:
 *       200:
 *         description: Shop profile successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Shop'
 *                 message: { type: 'string', example: '샵 프로필이 성공적으로 업데이트되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ShopNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /profile:
 *   put:
 *     summary: PUT /profile
 *     description: PUT endpoint for /profile
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
router.put('/profile',
  ...requireShopOwnerWithShop(),
  profileRateLimit,
  validateShopProfileUpdate,
  async (req, res) => {
    try {
      await shopProfileController.updateShopProfile(req, res);
    } catch (error) {
      logger.error('Error in shop profile PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 프로필 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/profile/status:
 *   get:
 *     summary: Get shop profile completion status
 *     description: |
 *       Retrieve the completion status of the shop profile including:
 *       - Profile completion percentage
 *       - Missing required fields
 *       - Verification status
 *       - Next steps and recommendations
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved profile status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     completion_percentage: { type: 'number', example: 85.5 }
 *                     missing_fields: 
 *                       type: array
 *                       items: { type: 'string' }
 *                       example: ["business_license", "operating_hours"]
 *                     verification_status: { type: 'string', example: 'pending' }
 *                     next_steps:
 *                       type: array
 *                       items: { type: 'string' }
 *                       example: ["사업자등록증 업로드", "영업시간 설정"]
 *                 message: { type: 'string', example: '프로필 상태를 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ShopNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/profile/status',
  ...requireShopOwnerWithShop(),
  profileRateLimit,
  async (req, res) => {
    try {
      await shopProfileController.getProfileStatus(req, res);
    } catch (error) {
      logger.error('Error in shop profile status route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '프로필 상태 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================================================
// SERVICE CATALOG MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/dashboard/services:
 *   get:
 *     summary: Get shop services catalog
 *     description: |
 *       Retrieve all services for the authenticated shop owner's shop with optional filtering and pagination.
 *       
 *       **Features:**
 *       - Service listing with filtering by category and availability
 *       - Pagination support for large service catalogs
 *       - Service performance metrics and statistics
 *       - Service ordering and display management
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter by service category
 *         example: nail
 *       - in: query
 *         name: is_available
 *         schema:
 *           type: boolean
 *         description: Filter by service availability
 *         example: true
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of services to return
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of services to skip
 *         example: 0
 *     responses:
 *       200:
 *         description: Successfully retrieved services
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ShopService'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer', example: 25 }
 *                         limit: { type: 'integer', example: 10 }
 *                         offset: { type: 'integer', example: 0 }
 *                         has_more: { type: 'boolean', example: true }
 *                 message: { type: 'string', example: '서비스 목록을 성공적으로 조회했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /services:
 *   get:
 *     summary: GET /services
 *     description: GET endpoint for /services
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
router.get('/services',
  ...requireShopOwnerWithShop(),
  serviceRateLimit,
  validateServiceListQuery,
  async (req, res) => {
    try {
      await shopServiceController.getServices(req, res);
    } catch (error) {
      logger.error('Error in shop services GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/services:
 *   post:
 *     summary: Create new service
 *     description: |
 *       Create a new service for the authenticated shop owner's shop.
 *       
 *       **Key Features:**
 *       - Service creation with comprehensive validation
 *       - Price range and duration configuration
 *       - Deposit and cancellation policy settings
 *       - Service availability and display order management
 *       - Automatic shop association
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, category, price_min, price_max, duration_minutes]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Service name
 *                 example: "젤네일 아트"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Service description
 *                 example: "고품질 젤네일 아트 서비스"
 *               category:
 *                 type: string
 *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 description: Service category
 *                 example: nail
 *               price_min:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Minimum service price (KRW)
 *                 example: 30000
 *               price_max:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Maximum service price (KRW)
 *                 example: 50000
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *                 description: Service duration in minutes
 *                 example: 60
 *               deposit_amount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 1000000
 *                 description: Fixed deposit amount (KRW)
 *                 example: 10000
 *               deposit_percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Deposit percentage
 *                 example: 20
 *               is_available:
 *                 type: boolean
 *                 description: Service availability
 *                 example: true
 *               booking_advance_days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 description: Advance booking limit in days
 *                 example: 30
 *               cancellation_hours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 description: Cancellation deadline in hours
 *                 example: 24
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 999
 *                 description: Display order priority
 *                 example: 1
 *     responses:
 *       201:
 *         description: Service successfully created
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message: { type: 'string', example: '서비스가 성공적으로 생성되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /services:
 *   post:
 *     summary: POST /services
 *     description: POST endpoint for /services
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
router.post('/services',
  ...requireShopOwnerWithShop(),
  serviceUpdateRateLimit,
  validateCreateService,
  async (req, res) => {
    try {
      await shopServiceController.createService(req, res);
    } catch (error) {
      logger.error('Error in shop services POST route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/services/{id}:
 *   get:
 *     summary: Get service by ID
 *     description: |
 *       Retrieve a specific service by ID for the authenticated shop owner.
 *       
 *       **Features:**
 *       - Service details with full information
 *       - Service performance metrics and statistics
 *       - Booking history and customer feedback
 *       - Service availability and scheduling information
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *       **Security:** Service ownership is automatically verified - users can only access services from their own shop.
 *     tags: [Shop Dashboard - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Successfully retrieved service
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message: { type: 'string', example: '서비스를 성공적으로 조회했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ServiceNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/services/:id',
  ...requireShopOwnerWithService(),
  serviceRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await shopServiceController.getServiceById(req, res);
    } catch (error) {
      logger.error('Error in shop service GET by ID route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        serviceId: req.params.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/services/{id}:
 *   put:
 *     summary: Update service
 *     description: |
 *       Update an existing service for the authenticated shop owner.
 *       
 *       **Key Features:**
 *       - Partial updates supported - only provided fields will be updated
 *       - Service validation and business rule enforcement
 *       - Price and policy updates with validation
 *       - Availability and display order management
 *       - Automatic shop association verification
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Service name
 *                 example: "프리미엄 젤네일 아트"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Service description
 *                 example: "고품질 프리미엄 젤네일 아트 서비스"
 *               price_min:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Minimum service price (KRW)
 *                 example: 35000
 *               price_max:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Maximum service price (KRW)
 *                 example: 60000
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *                 description: Service duration in minutes
 *                 example: 90
 *               is_available:
 *                 type: boolean
 *                 description: Service availability
 *                 example: true
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 999
 *                 description: Display order priority
 *                 example: 2
 *     responses:
 *       200:
 *         description: Service successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message: { type: 'string', example: '서비스가 성공적으로 업데이트되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ServiceNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /services/:id:
 *   put:
 *     summary: PUT /services/:id
 *     description: PUT endpoint for /services/:id
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
router.put('/services/:id',
  ...requireShopOwnerWithService(),
  serviceUpdateRateLimit,
  validateServiceId,
  validateUpdateService,
  async (req, res) => {
    try {
      await shopServiceController.updateService(req as any, res);
    } catch (error) {
      logger.error('Error in shop service PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        serviceId: req.params.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/dashboard/services/{id}:
 *   delete:
 *     summary: Delete service
 *     description: |
 *       Delete a service from the authenticated shop owner's catalog.
 *       
 *       **Key Features:**
 *       - Service deletion with reservation validation
 *       - Prevents deletion of services with active reservations
 *       - Soft delete option for data preservation
 *       - Automatic cleanup of related data
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Service successfully deleted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 message: { type: 'string', example: '서비스가 성공적으로 삭제되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ServiceNotFound'
 *       409:
 *         description: Conflict - Service has active reservations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: false }
 *                 error:
 *                   type: object
 *                   properties:
 *                     code: { type: 'string', example: 'SERVICE_HAS_ACTIVE_RESERVATIONS' }
 *                     message: { type: 'string', example: '활성 예약이 있는 서비스는 삭제할 수 없습니다.' }
 *                     details: { type: 'string', example: '먼저 모든 예약을 취소하거나 완료해주세요.' }
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /services/:id:
 *   delete:
 *     summary: DELETE /services/:id
 *     description: DELETE endpoint for /services/:id
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
router.delete('/services/:id',
  ...requireShopOwnerWithService(),
  serviceUpdateRateLimit,
  validateServiceId,
  async (req, res) => {
    try {
      await shopServiceController.deleteService(req, res);
    } catch (error) {
      logger.error('Error in shop service DELETE route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        serviceId: req.params.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================================================
// OPERATING HOURS MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/dashboard/operating-hours:
 *   get:
 *     summary: Get shop operating hours
 *     description: |
 *       Retrieve the current operating hours schedule for the authenticated shop owner's shop.
 *       
 *       **Features:**
 *       - Weekly schedule with day-by-day hours
 *       - Break times and special hours management
 *       - Closed day indicators
 *       - Current status (open/closed) based on current time
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved operating hours
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     operating_hours:
 *                       $ref: '#/components/schemas/WeeklyOperatingHours'
 *                     current_status:
 *                       type: object
 *                       properties:
 *                         is_open: { type: 'boolean', example: true }
 *                         current_day: { type: 'string', example: 'monday' }
 *                         current_time: { type: 'string', example: '14:30' }
 *                         next_opening: { type: 'string', nullable: true, example: 'Today at 18:00' }
 *                 message: { type: 'string', example: '영업시간을 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ShopNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/operating-hours',
  ...requireShopOwnerWithShop(),
  operatingHoursRateLimit,
  async (req, res) => {
    try {
      await shopOperatingHoursController.getOperatingHours(req, res);
    } catch (error) {
      logger.error('Error in shop operating hours GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
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
 * @swagger
 * /api/shop/dashboard/operating-hours:
 *   put:
 *     summary: Update shop operating hours
 *     description: |
 *       Update the operating hours schedule for the authenticated shop owner's shop.
 *       
 *       **Key Features:**
 *       - Set weekly schedule with day-by-day configuration
 *       - Break times and special hours management
 *       - Overnight hours support (e.g., 22:00 - 02:00)
 *       - Real-time validation and business rule enforcement
 *       - Days can be marked as closed with `closed: true`
 *       - All days are optional (existing hours preserved if not provided)
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Shop Dashboard - Operating Hours]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - operating_hours
 *             properties:
 *               operating_hours:
 *                 $ref: '#/components/schemas/WeeklyOperatingHours'
 *     responses:
 *       200:
 *         description: Operating hours successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     operating_hours:
 *                       $ref: '#/components/schemas/WeeklyOperatingHours'
 *                     current_status:
 *                       type: object
 *                       properties:
 *                         is_open: { type: 'boolean', example: true }
 *                         current_day: { type: 'string', example: 'monday' }
 *                         current_time: { type: 'string', example: '14:30' }
 *                         next_opening: { type: 'string', nullable: true, example: 'Today at 18:00' }
 *                 message: { type: 'string', example: '영업시간이 성공적으로 업데이트되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ShopNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /operating-hours:
 *   put:
 *     summary: PUT /operating-hours
 *     description: PUT endpoint for /operating-hours
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
router.put('/operating-hours',
  ...requireShopOwnerWithShop(),
  operatingHoursUpdateRateLimit,
  validateOperatingHoursComprehensive,
  async (req, res) => {
    try {
      await shopOperatingHoursController.updateOperatingHours(req, res);
    } catch (error) {
      logger.error('Error in shop operating hours PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '영업시간 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// ============================================================================
// RESERVATION MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/dashboard/reservations:
 *   get:
 *     summary: Get shop reservations
 *     description: |
 *       Retrieve reservations for the authenticated shop owner's shop with filtering and pagination.
 *       
 *       **Features:**
 *       - Reservation listing with status filtering
 *       - Date range filtering and search
 *       - Customer information and service details
 *       - Pagination support for large reservation lists
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [예약]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [requested, confirmed, completed, cancelled, no_show]
 *         description: Filter by reservation status
 *         example: confirmed
 *       - in: query
 *         name: start_date
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *         example: '2024-01-01'
 *       - in: query
 *         name: end_date
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *         example: '2024-01-31'
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of reservations to return
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of reservations to skip
 *         example: 0
 *     responses:
 *       200:
 *         description: Successfully retrieved reservations
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Reservation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total: { type: 'integer', example: 50 }
 *                         limit: { type: 'integer', example: 20 }
 *                         offset: { type: 'integer', example: 0 }
 *                         has_more: { type: 'boolean', example: true }
 *                 message: { type: 'string', example: '예약 목록을 성공적으로 조회했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /reservations:
 *   get:
 *     summary: GET /reservations
 *     description: GET endpoint for /reservations
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
  ...requireShopOwnerWithShop(),
  reservationRateLimit,
  async (req, res) => {
    try {
      await shopOwnerController.getReservations(req, res);
    } catch (error) {
      logger.error('Error in shop reservations GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
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
 * @swagger
 * /api/shop/dashboard/reservations/{reservationId}/status:
 *   put:
 *     summary: Update reservation status
 *     description: |
 *       Update the status of a specific reservation for the authenticated shop owner.
 *       
 *       **Key Features:**
 *       - Status updates with validation
 *       - Notes and comments support
 *       - Automatic notifications to customers
 *       - Audit logging for status changes
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [예약]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: reservationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [requested, confirmed, completed, cancelled, no_show]
 *                 description: New reservation status
 *                 example: confirmed
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *                 description: Optional notes about the status change
 *                 example: "고객 요청으로 시간 변경"
 *     responses:
 *       200:
 *         description: Reservation status successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   $ref: '#/components/schemas/Reservation'
 *                 message: { type: 'string', example: '예약 상태가 성공적으로 업데이트되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ReservationNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /reservations/:reservationId/status:
 *   put:
 *     summary: PUT /reservations/:reservationId/status
 *     description: PUT endpoint for /reservations/:reservationId/status
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
  ...requireShopOwnerWithShop(),
  reservationUpdateRateLimit,
  validateRequestBody(updateReservationStatusSchema),
  async (req, res) => {
    try {
      await shopOwnerController.updateReservationStatus(req as any, res);
    } catch (error) {
      logger.error('Error in shop reservation status PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        reservationId: req.params.reservationId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
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
);

export default router;
