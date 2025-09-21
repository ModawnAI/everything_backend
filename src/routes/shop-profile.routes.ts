/**
 * Shop Profile Routes
 * 
 * API endpoints for shop profile management including:
 * - Shop profile retrieval and updates for shop owners
 * - Profile completion status checking
 * - Shop owner authorization and validation
 */

import { Router } from 'express';
import { shopProfileController } from '../controllers/shop-profile.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateShopProfileUpdate } from '../validators/shop-profile.validators';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * tags:
 *   - name: Shop Profile
 *     description: Shop profile management operations for shop owners
 */

// Rate limiting for profile operations
const profileRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // limit each IP to 50 requests per windowMs for profile operations
    strategy: 'fixed_window'
  }
});

const updateRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 10, // limit each IP to 10 update requests per 5 minutes
    strategy: 'fixed_window'
  }
});

// Apply authentication to all routes
router.use(authenticateJWT);

/**
 * @swagger
 * /api/shop/profile:
 *   get:
 *     summary: Get shop owner's profile
 *     description: |
 *       Retrieve the authenticated shop owner's complete shop profile information including:
 *       - Basic shop details (name, description, contact info)
 *       - Location information (address, coordinates)
 *       - Business information (license, categories, payment methods)
 *       - Operating hours and settings
 *       - Associated services and images
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can access their own profile.
 *     tags: [Shop Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shop profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Shop'
 *                     - type: object
 *                       properties:
 *                         shop_services:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ShopService'
 *                         shop_images:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ShopImage'
 *                 message:
 *                   type: string
 *                   example: "샵 프로필을 성공적으로 조회했습니다."
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "UNAUTHORIZED"
 *                 message: "인증이 필요합니다."
 *                 details: "로그인 후 다시 시도해주세요."
 *       404:
 *         description: Shop not found - User has no registered shop
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *             example:
 *               success: false
 *               error:
 *                 code: "SHOP_NOT_FOUND"
 *                 message: "등록된 샵이 없습니다."
 *                 details: "샵 등록을 먼저 완료해주세요."
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
router.get('/',
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
 * /api/shop/profile:
 *   put:
 *     summary: Update shop owner's profile
 *     description: |
 *       Update the authenticated shop owner's shop profile information. 
 *       All fields are optional - only provided fields will be updated.
 *       
 *       **Key Features:**
 *       - Partial updates supported (only send fields you want to change)
 *       - Automatic coordinate validation for latitude/longitude
 *       - Operating hours validation with time format checking
 *       - Business license format validation
 *       - Payment methods and category validation
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can update their own profile.
 *       
 *       **Rate Limiting:** Limited to 10 updates per 5 minutes per IP.
 *     tags: [Shop Profile]
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
 *                 example: "네일아트 전문점"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Shop description
 *                 example: "프리미엄 네일아트 서비스를 제공하는 전문점입니다."
 *               phone_number:
 *                 type: string
 *                 maxLength: 20
 *                 pattern: "^[0-9-+\\s()]+$"
 *                 description: Contact phone number
 *                 example: "02-1234-5678"
 *               email:
 *                 type: string
 *                 format: email
 *                 maxLength: 255
 *                 description: Contact email
 *                 example: "contact@nailshop.com"
 *               address:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 500
 *                 description: Shop address
 *                 example: "서울시 강남구 테헤란로 123"
 *               detailed_address:
 *                 type: string
 *                 maxLength: 500
 *                 description: Detailed address (floor, unit number, etc.)
 *                 example: "2층 201호"
 *               postal_code:
 *                 type: string
 *                 maxLength: 10
 *                 pattern: "^[0-9-]+$"
 *                 description: Postal code
 *                 example: "06234"
 *               latitude:
 *                 type: number
 *                 minimum: -90
 *                 maximum: 90
 *                 description: Shop latitude coordinate
 *                 example: 37.5665
 *               longitude:
 *                 type: number
 *                 minimum: -180
 *                 maximum: 180
 *                 description: Shop longitude coordinate
 *                 example: 126.9780
 *               main_category:
 *                 type: string
 *                 enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 description: Primary service category
 *                 example: "nail"
 *               sub_categories:
 *                 type: array
 *                 maxItems: 5
 *                 uniqueItems: true
 *                 items:
 *                   type: string
 *                   enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                 description: Additional service categories
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
 *                 minItems: 1
 *                 maxItems: 5
 *                 uniqueItems: true
 *                 items:
 *                   type: string
 *                   enum: [cash, card, transfer, mobile_pay, point]
 *                 description: Accepted payment methods
 *                 example: ["card", "mobile_pay", "cash"]
 *               kakao_channel_url:
 *                 type: string
 *                 format: uri
 *                 maxLength: 500
 *                 description: KakaoTalk channel URL for customer communication
 *                 example: "https://pf.kakao.com/_example"
 *               business_license_number:
 *                 type: string
 *                 maxLength: 50
 *                 pattern: "^[0-9-]+$"
 *                 description: Business registration number
 *                 example: "123-45-67890"
 *           examples:
 *             basic_update:
 *               summary: Basic information update
 *               value:
 *                 name: "네일아트 전문점"
 *                 phone_number: "02-1234-5678"
 *                 description: "프리미엄 네일아트 서비스 제공"
 *             location_update:
 *               summary: Location information update
 *               value:
 *                 address: "서울시 강남구 테헤란로 456"
 *                 detailed_address: "3층 301호"
 *                 latitude: 37.5665
 *                 longitude: 126.9780
 *             hours_update:
 *               summary: Operating hours update
 *               value:
 *                 operating_hours:
 *                   monday: { "open": "10:00", "close": "20:00", "is_open": true }
 *                   tuesday: { "open": "10:00", "close": "20:00", "is_open": true }
 *                   wednesday: { "open": "10:00", "close": "20:00", "is_open": true }
 *                   thursday: { "open": "10:00", "close": "20:00", "is_open": true }
 *                   friday: { "open": "10:00", "close": "22:00", "is_open": true }
 *                   saturday: { "open": "10:00", "close": "22:00", "is_open": true }
 *                   sunday: { "is_open": false }
 *     responses:
 *       200:
 *         description: Shop profile updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   allOf:
 *                     - $ref: '#/components/schemas/Shop'
 *                     - type: object
 *                       properties:
 *                         shop_services:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ShopService'
 *                         shop_images:
 *                           type: array
 *                           items:
 *                             $ref: '#/components/schemas/ShopImage'
 *                 message:
 *                   type: string
 *                   example: "샵 프로필이 성공적으로 업데이트되었습니다."
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
 *                       - field: "phone_number"
 *                         message: "전화번호 형식이 올바르지 않습니다."
 *                       - field: "operating_hours"
 *                         message: "monday의 종료 시간은 시작 시간보다 늦어야 합니다."
 *               empty_update:
 *                 summary: Empty update data
 *                 value:
 *                   success: false
 *                   error:
 *                     code: "INVALID_INPUT"
 *                     message: "업데이트할 데이터가 없습니다."
 *                     details: "최소 하나의 필드를 제공해주세요."
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
router.put('/',
  ...requireShopOwnerWithShop(),
  updateRateLimit,
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
 * /api/shop/profile/status:
 *   get:
 *     summary: Get shop profile completion status
 *     description: |
 *       Check the completion status of the shop profile setup process.
 *       Returns detailed information about which required fields are completed
 *       and which are still missing for full profile completion.
 *       
 *       **Use Cases:**
 *       - Profile completion progress tracking
 *       - Onboarding flow guidance
 *       - Verification readiness checking
 *       - Dashboard status indicators
 *       
 *       **Authorization:** Requires valid JWT token. Only shop owners can check their own profile status.
 *     tags: [Shop Profile]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile status retrieved successfully
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
 *                     completionPercentage:
 *                       type: number
 *                       minimum: 0
 *                       maximum: 100
 *                       description: Profile completion percentage
 *                       example: 85
 *                     requiredFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of all required fields for profile completion
 *                       example: ["name", "address", "main_category", "phone_number", "business_license_number", "business_license_image_url"]
 *                     completedFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of completed required fields
 *                       example: ["name", "address", "main_category", "phone_number", "business_license_number"]
 *                     missingFields:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: List of missing required fields
 *                       example: ["business_license_image_url"]
 *                     shopStatus:
 *                       type: string
 *                       enum: [pending_approval, active, inactive, suspended, deleted]
 *                       description: Current shop operational status
 *                       example: "pending_approval"
 *                     verificationStatus:
 *                       type: string
 *                       enum: [pending, verified, rejected, under_review]
 *                       description: Current verification status
 *                       example: "pending"
 *                     shopId:
 *                       type: string
 *                       format: uuid
 *                       description: Shop unique identifier
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     shopName:
 *                       type: string
 *                       description: Shop name
 *                       example: "네일아트 전문점"
 *                 message:
 *                   type: string
 *                   example: "프로필 상태를 조회했습니다."
 *             examples:
 *               complete_profile:
 *                 summary: Fully completed profile
 *                 value:
 *                   success: true
 *                   data:
 *                     completionPercentage: 100
 *                     requiredFields: ["name", "address", "main_category", "phone_number", "business_license_number", "business_license_image_url"]
 *                     completedFields: ["name", "address", "main_category", "phone_number", "business_license_number", "business_license_image_url"]
 *                     missingFields: []
 *                     shopStatus: "active"
 *                     verificationStatus: "verified"
 *                     shopId: "123e4567-e89b-12d3-a456-426614174000"
 *                     shopName: "네일아트 전문점"
 *                   message: "프로필 상태를 조회했습니다."
 *               incomplete_profile:
 *                 summary: Partially completed profile
 *                 value:
 *                   success: true
 *                   data:
 *                     completionPercentage: 67
 *                     requiredFields: ["name", "address", "main_category", "phone_number", "business_license_number", "business_license_image_url"]
 *                     completedFields: ["name", "address", "main_category", "phone_number"]
 *                     missingFields: ["business_license_number", "business_license_image_url"]
 *                     shopStatus: "pending_approval"
 *                     verificationStatus: "pending"
 *                     shopId: "123e4567-e89b-12d3-a456-426614174000"
 *                     shopName: "네일아트 전문점"
 *                   message: "프로필 상태를 조회했습니다."
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
router.get('/status',
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

// Error handling middleware for shop profile routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop profile routes', {
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
      message: '샵 프로필 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
