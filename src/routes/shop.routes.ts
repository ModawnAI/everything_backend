/**
 * @swagger
 * tags:
 *   - name: Shops
 *     description: Shop management and discovery endpoints
 */

/**
 * Shop Routes
 * 
 * API endpoints for shop management including:
 * - Location-based shop discovery
 * - Shop details and information
 * - Shop management operations
 */

import { Router } from 'express';
import { ShopController } from '../controllers/shop.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();
const shopController = new ShopController();

// Validation schemas
const createShopSchema = Joi.object({
  name: Joi.string().min(1).max(255).required().messages({
    'string.empty': '샵명은 필수입니다.',
    'string.min': '샵명은 최소 1자 이상이어야 합니다.',
    'string.max': '샵명은 최대 255자까지 가능합니다.',
    'any.required': '샵명은 필수입니다.'
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': '샵 설명은 최대 1000자까지 가능합니다.'
  }),
  phone_number: Joi.string().pattern(/^[0-9-+\s()]+$/).optional().messages({
    'string.pattern.base': '전화번호 형식이 올바르지 않습니다.'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': '이메일 형식이 올바르지 않습니다.'
  }),
  address: Joi.string().min(1).required().messages({
    'string.empty': '주소는 필수입니다.',
    'any.required': '주소는 필수입니다.'
  }),
  detailed_address: Joi.string().max(500).optional().messages({
    'string.max': '상세주소는 최대 500자까지 가능합니다.'
  }),
  postal_code: Joi.string().pattern(/^[0-9-]+$/).optional().messages({
    'string.pattern.base': '우편번호 형식이 올바르지 않습니다.'
  }),
  latitude: Joi.number().min(-90).max(90).optional().messages({
    'number.min': '위도는 -90~90 범위 내에서 입력해주세요.',
    'number.max': '위도는 -90~90 범위 내에서 입력해주세요.'
  }),
  longitude: Joi.number().min(-180).max(180).optional().messages({
    'number.min': '경도는 -180~180 범위 내에서 입력해주세요.',
    'number.max': '경도는 -180~180 범위 내에서 입력해주세요.'
  }),
  main_category: Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  ).required().messages({
    'any.only': '유효하지 않은 서비스 카테고리입니다.',
    'any.required': '주 서비스 카테고리는 필수입니다.'
  }),
  sub_categories: Joi.array().items(Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  )).optional().messages({
    'array.base': '부가 서비스는 배열 형태로 입력해주세요.'
  }),
  operating_hours: Joi.object().optional(),
  payment_methods: Joi.array().items(Joi.string().valid(
    'cash', 'card', 'mobile_payment', 'bank_transfer'
  )).optional().messages({
    'array.base': '결제 수단은 배열 형태로 입력해주세요.'
  }),
  kakao_channel_url: Joi.string().uri().optional().messages({
    'string.uri': '카카오톡 채널 URL 형식이 올바르지 않습니다.'
  }),
  business_license_number: Joi.string().max(50).optional().messages({
    'string.max': '사업자등록번호는 최대 50자까지 가능합니다.'
  })
});

const updateShopSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional().messages({
    'string.empty': '샵명은 필수입니다.',
    'string.min': '샵명은 최소 1자 이상이어야 합니다.',
    'string.max': '샵명은 최대 255자까지 가능합니다.'
  }),
  description: Joi.string().max(1000).optional().messages({
    'string.max': '샵 설명은 최대 1000자까지 가능합니다.'
  }),
  phone_number: Joi.string().pattern(/^[0-9-+\s()]+$/).optional().messages({
    'string.pattern.base': '전화번호 형식이 올바르지 않습니다.'
  }),
  email: Joi.string().email().optional().messages({
    'string.email': '이메일 형식이 올바르지 않습니다.'
  }),
  address: Joi.string().min(1).optional().messages({
    'string.empty': '주소는 필수입니다.'
  }),
  detailed_address: Joi.string().max(500).optional().messages({
    'string.max': '상세주소는 최대 500자까지 가능합니다.'
  }),
  postal_code: Joi.string().pattern(/^[0-9-]+$/).optional().messages({
    'string.pattern.base': '우편번호 형식이 올바르지 않습니다.'
  }),
  latitude: Joi.number().min(-90).max(90).optional().messages({
    'number.min': '위도는 -90~90 범위 내에서 입력해주세요.',
    'number.max': '위도는 -90~90 범위 내에서 입력해주세요.'
  }),
  longitude: Joi.number().min(-180).max(180).optional().messages({
    'number.min': '경도는 -180~180 범위 내에서 입력해주세요.',
    'number.max': '경도는 -180~180 범위 내에서 입력해주세요.'
  }),
  main_category: Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  ).optional().messages({
    'any.only': '유효하지 않은 서비스 카테고리입니다.'
  }),
  sub_categories: Joi.array().items(Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  )).optional().messages({
    'array.base': '부가 서비스는 배열 형태로 입력해주세요.'
  }),
  operating_hours: Joi.object().optional(),
  payment_methods: Joi.array().items(Joi.string().valid(
    'cash', 'card', 'mobile_payment', 'bank_transfer'
  )).optional().messages({
    'array.base': '결제 수단은 배열 형태로 입력해주세요.'
  }),
  kakao_channel_url: Joi.string().uri().optional().messages({
    'string.uri': '카카오톡 채널 URL 형식이 올바르지 않습니다.'
  }),
  business_license_number: Joi.string().max(50).optional().messages({
    'string.max': '사업자등록번호는 최대 50자까지 가능합니다.'
  })
});

const nearbyShopsSchema = Joi.object({
  latitude: Joi.string().required().messages({
    'string.empty': '위도는 필수입니다.',
    'any.required': '위도는 필수입니다.'
  }),
  longitude: Joi.string().required().messages({
    'string.empty': '경도는 필수입니다.',
    'any.required': '경도는 필수입니다.'
  }),
  radius: Joi.string().pattern(/^\d+(\.\d+)?$/).optional().messages({
    'string.pattern.base': '반경은 숫자로 입력해주세요.'
  }),
  category: Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  ).optional().messages({
    'any.only': '유효하지 않은 카테고리입니다.'
  }),
  shopType: Joi.string().valid('partnered', 'non_partnered').optional().messages({
    'any.only': '유효하지 않은 샵 타입입니다.'
  }),
  onlyFeatured: Joi.string().valid('true', 'false').optional().messages({
    'any.only': 'onlyFeatured는 true 또는 false여야 합니다.'
  }),
  limit: Joi.string().pattern(/^\d+$/).optional().messages({
    'string.pattern.base': 'limit은 숫자로 입력해주세요.'
  }),
  offset: Joi.string().pattern(/^\d+$/).optional().messages({
    'string.pattern.base': 'offset은 숫자로 입력해주세요.'
  })
});

const boundsShopsSchema = Joi.object({
  neLat: Joi.string().required().messages({
    'string.empty': '북동쪽 위도는 필수입니다.',
    'any.required': '북동쪽 위도는 필수입니다.'
  }),
  neLng: Joi.string().required().messages({
    'string.empty': '북동쪽 경도는 필수입니다.',
    'any.required': '북동쪽 경도는 필수입니다.'
  }),
  swLat: Joi.string().required().messages({
    'string.empty': '남서쪽 위도는 필수입니다.',
    'any.required': '남서쪽 위도는 필수입니다.'
  }),
  swLng: Joi.string().required().messages({
    'string.empty': '남서쪽 경도는 필수입니다.',
    'any.required': '남서쪽 경도는 필수입니다.'
  }),
  category: Joi.string().valid(
    'nail', 'hair', 'makeup', 'skincare', 'massage', 'tattoo', 'piercing', 'eyebrow', 'eyelash'
  ).optional().messages({
    'any.only': '유효하지 않은 카테고리입니다.'
  }),
  shopType: Joi.string().valid('partnered', 'non_partnered').optional().messages({
    'any.only': '유효하지 않은 샵 타입입니다.'
  }),
  onlyFeatured: Joi.string().valid('true', 'false').optional().messages({
    'any.only': 'onlyFeatured는 true 또는 false여야 합니다.'
  })
});

const shopIdSchema = Joi.object({
  id: Joi.string().uuid().required().messages({
    'string.guid': '유효하지 않은 샵 ID입니다.',
    'any.required': '샵 ID는 필수입니다.'
  })
});

// Rate limiting configuration
const publicRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    strategy: 'fixed_window'
  }
});

const searchRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    strategy: 'fixed_window'
  }
});

// Apply rate limiting to all routes
router.use(publicRateLimit);

/**
 * @swagger
 * /api/shops:
 *   post:
 *     tags:
 *       - Shops
 *     summary: Create a new shop
 *     description: Create a new shop (requires authentication and shop owner role)
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
 *               - address
 *               - main_category
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 255
 *                 description: Shop name
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Shop description
 *               phone_number:
 *                 type: string
 *                 description: Contact phone number
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Contact email
 *               address:
 *                 type: string
 *                 description: Shop address
 *               detailed_address:
 *                 type: string
 *                 maxLength: 500
 *                 description: Detailed address
 *               postal_code:
 *                 type: string
 *                 description: Postal code
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Shop latitude
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Shop longitude
 *               main_category:
 *                 type: string
 *                 description: Primary service category
 *               sub_categories:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Additional service categories
 *               operating_hours:
 *                 type: object
 *                 description: Operating hours by day
 *               payment_methods:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Accepted payment methods
 *               kakao_channel_url:
 *                 type: string
 *                 description: KakaoTalk channel URL
 *               business_license_number:
 *                 type: string
 *                 description: Business license number
 *     responses:
 *       201:
 *         description: Shop created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Shop'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         $ref: '#/components/responses/Forbidden'
 */
router.post('/',
  authenticateJWT,
  validateRequestBody(createShopSchema),
  async (req, res) => {
    try {
      await shopController.createShop(req, res);
    } catch (error) {
      logger.error('Error in create shop route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shops
 * Get all shops with optional filtering
 * 
 * Query Parameters:
 * - status: Shop status filter (optional)
 * - category: Service category filter (optional)
 * - shopType: Shop type filter (optional)
 * - ownerId: Shop owner ID filter (optional)
 * - limit: Maximum number of results (optional, default: 50)
 * - offset: Pagination offset (optional, default: 0)
 * 
 * Example: GET /api/shops?status=active&category=nail&limit=20
 */
router.get('/',
  async (req, res) => {
    try {
      await shopController.getAllShops(req, res);
    } catch (error) {
      logger.error('Error in get all shops route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shops/nearby
 * Find nearby shops within specified radius
 * 
 * Query Parameters:
 * - latitude: User's latitude (required)
 * - longitude: User's longitude (required)
 * - radius: Search radius in km (optional, default: 10)
 * - category: Shop category filter (optional)
 * - shopType: Shop type filter (optional)
 * - onlyFeatured: Show only featured shops (optional, default: false)
 * - limit: Maximum number of results (optional, default: 50)
 * - offset: Pagination offset (optional, default: 0)
 * 
 * Example: GET /api/shops/nearby?latitude=37.5665&longitude=126.9780&radius=5&category=nail&limit=20
 */
router.get('/nearby',
  searchRateLimit,
  validateRequestBody(nearbyShopsSchema),
  async (req, res) => {
    try {
      await shopController.getNearbyShops(req, res);
    } catch (error) {
      logger.error('Error in nearby shops route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '주변 샵 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shops/bounds
 * Get shops within a bounding box (for map interfaces)
 * 
 * Query Parameters:
 * - neLat: North-east latitude (required)
 * - neLng: North-east longitude (required)
 * - swLat: South-west latitude (required)
 * - swLng: South-west longitude (required)
 * - category: Shop category filter (optional)
 * - shopType: Shop type filter (optional)
 * - onlyFeatured: Show only featured shops (optional)
 * 
 * Example: GET /api/shops/bounds?neLat=37.6&neLng=127.0&swLat=37.5&swLng=126.9&category=nail
 */
router.get('/bounds',
  searchRateLimit,
  validateRequestBody(boundsShopsSchema),
  async (req, res) => {
    try {
      await shopController.getShopsInBounds(req, res);
    } catch (error) {
      logger.error('Error in bounds shops route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '지도 영역 샵 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * PUT /api/shops/:id
 * Update shop details
 * 
 * Path Parameters:
 * - id: Shop UUID (required)
 * 
 * Body Parameters: (all optional)
 * - name: Shop name
 * - description: Shop description
 * - phone_number: Contact phone number
 * - email: Contact email
 * - address: Shop address
 * - detailed_address: Detailed address
 * - postal_code: Postal code
 * - latitude: Shop latitude
 * - longitude: Shop longitude
 * - main_category: Primary service category
 * - sub_categories: Additional service categories
 * - operating_hours: Operating hours
 * - payment_methods: Accepted payment methods
 * - kakao_channel_url: KakaoTalk channel URL
 * - business_license_number: Business license number
 * 
 * Example: PUT /api/shops/123e4567-e89b-12d3-a456-426614174000
 */
router.put('/:id',
  authenticateJWT,
  validateRequestBody(shopIdSchema),
  validateRequestBody(updateShopSchema),
  async (req, res) => {
    try {
      await shopController.updateShop(req, res);
    } catch (error) {
      logger.error('Error in update shop route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id,
        body: req.body
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 정보 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * DELETE /api/shops/:id
 * Delete shop (soft delete)
 * 
 * Path Parameters:
 * - id: Shop UUID (required)
 * 
 * Example: DELETE /api/shops/123e4567-e89b-12d3-a456-426614174000
 */
router.delete('/:id',
  authenticateJWT,
  validateRequestBody(shopIdSchema),
  async (req, res) => {
    try {
      await shopController.deleteShop(req, res);
    } catch (error) {
      logger.error('Error in delete shop route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '샵 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * GET /api/shops/:id
 * Get shop details by ID
 * 
 * Path Parameters:
 * - id: Shop UUID (required)
 * 
 * Example: GET /api/shops/123e4567-e89b-12d3-a456-426614174000
 */
router.get('/:id',
  validateRequestBody(shopIdSchema),
  async (req, res) => {
    try {
      await shopController.getShopById(req, res);
    } catch (error) {
      logger.error('Error in shop details route', {
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
 * @swagger
 * /api/shops/{id}/contact-info:
 *   get:
 *     summary: Get public contact information for a shop
 *     description: Retrieve public contact information for a specific shop including phone, email, social media, etc.
 *     tags: [Shops]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *     responses:
 *       200:
 *         description: Public contact information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     shopId:
 *                       type: string
 *                       format: uuid
 *                     contactMethods:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           method_type:
 *                             type: string
 *                             enum: [phone, email, kakao_channel, instagram, facebook, website, other]
 *                           value:
 *                             type: string
 *                           description:
 *                             type: string
 *                           display_order:
 *                             type: integer
 *       400:
 *         description: Invalid shop ID
 *       404:
 *         description: Shop not found
 *       429:
 *         description: Rate limit exceeded
 *       500:
 *         description: Internal server error
 */
router.get('/:id/contact-info',
  rateLimit({
    config: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 60, // Limit each IP to 60 requests per windowMs for public contact info
      message: {
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many contact info requests, please try again later'
      },
      enableHeaders: true
    }
  }),
  async (req, res) => {
    try {
      // Import the shop contact methods controller
      const { shopContactMethodsController } = await import('../controllers/shop-contact-methods.controller');
      await shopContactMethodsController.getPublicShopContactInfo(req, res);
    } catch (error) {
      logger.error('Error in shop contact info route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.id
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: 'An error occurred while retrieving contact information'
      });
    }
  }
);

// Error handling middleware for shop routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '샵 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router; 