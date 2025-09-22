/**
 * Shop Service Routes
 * 
 * API endpoints for shop service catalog management including:
 * - Service CRUD operations for shop owners
 * - Service listing with filtering and pagination
 * - Service availability management
 * - Service ordering and display management
 */

import { Router } from 'express';
import { shopServiceController } from '../controllers/shop-service.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop, requireShopOwnerWithService } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import {
  validateCreateService,
  validateUpdateService,
  validateServiceListQuery,
  validateServiceId
} from '../validators/shop-service.validators';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Shop Services
 *     description: Shop service catalog management operations for shop owners
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 */

// Rate limiting for service operations
const serviceRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs for service operations
    strategy: 'fixed_window'
  }
});

const serviceUpdateRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 20, // limit each IP to 20 update/create/delete requests per 5 minutes
    strategy: 'fixed_window'
  }
});

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @swagger
 * /api/shop/services:
 *   get:
 *     summary: 샵 서비스 조회
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve all services for the authenticated shop owner's shop with optional filtering and pagination.
 *       
 *       **Features:**
 *       - Filter by service category
 *       - Filter by availability status
 *       - Pagination support with limit and offset
 *       - Services ordered by display_order then creation date
 *       - Total count and hasMore indicators for pagination
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can access their own services.
 *     tags: [Shop Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *           enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *         description: Filter services by category
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "nail"
 *       - in: query
 *         name: is_available
 *         schema:
 *           type: string
 *           enum: [true, false]
 *         description: Filter services by availability status
 *         example: "true"
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of services to return
 *         example: 20
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           minimum: 0
 *           default: 0
 *         description: Number of services to skip for pagination
 *         example: 0
 *     responses:
 *       200:
 *         description: Services retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     services:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ShopService'
 *                     totalCount:
 *                       type: integer
 *                       description: Total number of services matching the filter
 *                       example: 15
 *                     hasMore:
 *                       type: boolean
 *                       description: Whether there are more services beyond the current page
 *                       example: false
 *                 message:
 *                   type: string
 *                   example: "서비스 목록을 성공적으로 조회했습니다."
 *             examples:
 *               all_services:
 *                 summary: All services without filters
 *                 value:
 *                   success: true
 *                   data:
 *                     services: []
 *                     totalCount: 15
 *                     hasMore: false
 *                   message: "서비스 목록을 성공적으로 조회했습니다."
 *               filtered_services:
 *                 summary: Filtered by category
 *                 value:
 *                   success: true
 *                   data:
 *                     services: []
 *                     totalCount: 8
 *                     hasMore: true
 *                   message: "서비스 목록을 성공적으로 조회했습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Shop not found - User has no registered shop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
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
router.get('/',
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
 * /api/shop/services:
 *   post:
 *     summary: new service 생성
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Create a new service for the authenticated shop owner's shop.
 *       
 *       **Key Features:**
 *       - Comprehensive service information including pricing, duration, and policies
 *       - Flexible deposit options (fixed amount or percentage)
 *       - Booking and cancellation policy settings
 *       - Display order management for service listing
 *       - Automatic validation of business rules
 *       
 *       **Business Rules:**
 *       - Service name and category are required
 *       - Price range validation (min ≤ max)
 *       - Deposit can be either fixed amount OR percentage, not both
 *       - Duration must be between 1 minute and 8 hours
 *       - Booking advance days: 1-365 days
 *       - Cancellation hours: 1-168 hours (7 days)
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can create services.
 *       
 *       **Rate Limiting:** Limited to 20 create/update/delete operations per 5 minutes per IP.
 *     tags: [Shop Services]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - category
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 description: Service name
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *                 example: "젤네일"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed service description
 *                 example: "고품질 젤네일 서비스로 2-3주간 지속됩니다"
 *               category:
 *                 type: string
 *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 description: Service category
 *                 example: "nail"
 *               price_min:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Minimum price in KRW
 *                 example: 30000
 *               price_max:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 description: Maximum price in KRW
 *                 example: 50000
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *                 description: Expected service duration in minutes
 *                 example: 60
 *               deposit_amount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 1000000
 *                 description: Fixed deposit amount in KRW (mutually exclusive with deposit_percentage)
 *                 example: 10000
 *               deposit_percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 description: Deposit as percentage of service price (mutually exclusive with deposit_amount)
 *                 example: 20.0
 *               is_available:
 *                 type: boolean
 *                 default: true
 *                 description: Whether the service is currently available for booking
 *                 example: true
 *               booking_advance_days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 default: 30
 *                 description: How many days in advance customers can book this service
 *                 example: 30
 *               cancellation_hours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 default: 24
 *                 description: How many hours before the appointment customers can cancel
 *                 example: 24
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 999
 *                 default: 0
 *                 description: Display order in service listings (lower numbers appear first)
 *                 example: 1
 *           examples:
 *             basic_service:
 *               summary: Basic service with minimal fields
 *               value:
 *                 name: "젤네일"
 *                 category: "nail"
 *                 price_min: 30000
 *                 price_max: 50000
 *                 duration_minutes: 60
 *             detailed_service:
 *               summary: Detailed service with all options
 *               value:
 *                 name: "프리미엄 젤네일"
 *                 description: "고품질 젤네일 서비스로 2-3주간 지속되며, 다양한 디자인 옵션을 제공합니다"
 *                 category: "nail"
 *                 price_min: 40000
 *                 price_max: 80000
 *                 duration_minutes: 90
 *                 deposit_percentage: 30.0
 *                 is_available: true
 *                 booking_advance_days: 14
 *                 cancellation_hours: 48
 *                 display_order: 1
 *     responses:
 *       201:
 *         description: Service created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message:
 *                   type: string
 *                   example: "서비스가 성공적으로 생성되었습니다."
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             examples:
 *               validation_error:
 *                 summary: Validation error example
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "VALIDATION_ERROR"
 *                     message: "입력 데이터가 유효하지 않습니다."
 *                     details:
 *                       - field: "name"
 *                         message: "서비스명은 필수입니다."
 *                       - field: "category"
 *                         message: "서비스 카테고리는 필수입니다."
 *               price_range_error:
 *                 summary: Price range validation error
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INVALID_PRICE_RANGE"
 *                     message: "가격 범위가 올바르지 않습니다."
 *                     details: "최소 가격은 최대 가격보다 작거나 같아야 합니다."
 *               deposit_conflict_error:
 *                 summary: Deposit settings conflict
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INVALID_DEPOSIT_SETTINGS"
 *                     message: "예약금 설정이 올바르지 않습니다."
 *                     details: "고정 금액과 비율 중 하나만 설정할 수 있습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Shop not found - User has no registered shop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:
 *   post:
 *     summary: POST / (POST /)
 *     description: POST endpoint for /
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
router.post('/',
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
 * /api/shop/services/{id}:
 *   get:
 *     summary: service by ID 조회
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve detailed information for a specific service by ID.
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can access their own services.
 *       
 *       **Security:** Service ownership is automatically verified - users can only access services from their own shop.
 *     tags: [Shop Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service unique identifier
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Service retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message:
 *                   type: string
 *                   example: "서비스 정보를 성공적으로 조회했습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Service not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "SERVICE_NOT_FOUND"
 *                 message: "서비스를 찾을 수 없습니다."
 *                 details: "존재하지 않거나 접근 권한이 없는 서비스입니다."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:id:
 *   get:
 *     summary: /:id 조회
 *     description: GET endpoint for /:id
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
router.get('/:id',
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
 * /api/shop/services/{id}:
 *   put:
 *     summary: service 수정
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Update an existing service for the authenticated shop owner.
 *       
 *       **Key Features:**
 *       - Partial updates supported (only send fields you want to change)
 *       - Same validation rules as creation apply
 *       - Automatic ownership verification
 *       - Business rule validation (price ranges, deposit settings)
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can update their own services.
 *       
 *       **Rate Limiting:** Limited to 20 create/update/delete operations per 5 minutes per IP.
 *     tags: [Shop Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service unique identifier
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 255
 *                 example: "젤네일 (업데이트)"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 example: "업데이트된 젤네일 서비스 설명"
 *               category:
 *                 type: string
 *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 example: "nail"
 *               price_min:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 example: 35000
 *               price_max:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 10000000
 *                 example: 55000
 *               duration_minutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 480
 *                 example: 90
 *               deposit_amount:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 1000000
 *                 example: 15000
 *               deposit_percentage:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 example: 25.0
 *               is_available:
 *                 type: boolean
 *                 example: false
 *               booking_advance_days:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 365
 *                 example: 14
 *               cancellation_hours:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 168
 *                 example: 48
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 999
 *                 example: 2
 *           examples:
 *             price_update:
 *               summary: Update only pricing
 *               value:
 *                 price_min: 35000
 *                 price_max: 60000
 *             availability_update:
 *               summary: Disable service temporarily
 *               value:
 *                 is_available: false
 *             full_update:
 *               summary: Update multiple fields
 *               value:
 *                 name: "프리미엄 젤네일 플러스"
 *                 description: "업그레이드된 프리미엄 젤네일 서비스"
 *                 price_min: 45000
 *                 price_max: 70000
 *                 duration_minutes: 120
 *                 display_order: 1
 *     responses:
 *       200:
 *         description: Service updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/ShopService'
 *                 message:
 *                   type: string
 *                   example: "서비스가 성공적으로 업데이트되었습니다."
 *       400:
 *         description: Bad request - Invalid input data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Service not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:id:
 *   put:
 *     summary: PUT /:id (PUT /:id)
 *     description: PUT endpoint for /:id
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
router.put('/:id',
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
 * /api/shop/services/{id}:
 *   delete:
 *     summary: service 삭제
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Delete a service from the authenticated shop owner's catalog.
 *       
 *       **Important Constraints:**
 *       - Services with existing reservations cannot be deleted
 *       - Consider disabling the service instead if it has reservation history
 *       - Deletion is permanent and cannot be undone
 *       
 *       **Business Logic:**
 *       - Checks for active reservations before allowing deletion
 *       - Returns 409 Conflict if reservations exist
 *       - Suggests alternatives (disable service or wait for reservations to complete)
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can delete their own services.
 *       
 *       **Rate Limiting:** Limited to 20 create/update/delete operations per 5 minutes per IP.
 *     tags: [Shop Services]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Service unique identifier
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Service deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "서비스가 성공적으로 삭제되었습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       404:
 *         description: Service not found or access denied
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       409:
 *         description: Conflict - Service has active reservations
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "SERVICE_HAS_RESERVATIONS"
 *                 message: "예약이 있는 서비스는 삭제할 수 없습니다."
 *                 details: "서비스를 비활성화하거나 예약 완료 후 삭제해주세요."
 *       429:
 *         description: Too many requests - Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */

/**
 * @swagger
 * /:id:
 *   delete:
 *     summary: /:id 삭제
 *     description: DELETE endpoint for /:id
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
router.delete('/:id',
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

// Error handling middleware for shop service routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop service routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method,
    userId: req.user?.id
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서비스 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
