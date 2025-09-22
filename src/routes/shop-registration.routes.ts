/**
 * Shop Registration Routes
 * 
 * API endpoints for multi-step shop registration workflow including:
 * - Step-by-step registration process
 * - Document upload and validation
 * - Registration status tracking
 * - Korean business license validation
 */

import { Router } from 'express';
import { ShopRegistrationController } from '../controllers/shop-registration.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { applyResponseStandardization } from '../middleware/response-standardization.middleware';
import { 
  registrationStepSchema,
  completeShopRegistrationSchema,
  shopImageSchema
} from '../validators/shop-registration.validators';
import Joi from 'joi';

const router = Router();
const shopRegistrationController = new ShopRegistrationController();

// Apply response standardization
router.use(applyResponseStandardization());

// Rate limiting for registration endpoints
const registrationRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 registration attempts per window
    message: {
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '등록 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 900 // 15 minutes in seconds
      }
    },
    enableHeaders: true
  }
});

const validationRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // 50 validation requests per window
    message: {
      error: {
        code: 'VALIDATION_RATE_LIMIT_EXCEEDED',
        message: '검증 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        retryAfter: 300 // 5 minutes in seconds
      }
    },
    enableHeaders: true
  }
});

// Validation schemas for request bodies
const stepRegistrationSchema = Joi.object({
  step: Joi.number().integer().min(1).max(4).required(),
  data: Joi.object().required()
});

const completeRegistrationSchema = Joi.object({
  complete_registration: Joi.boolean().valid(true).required(),
  data: completeShopRegistrationSchema.required()
});

const imageUploadSchema = Joi.object({
  shop_id: Joi.string().uuid().required(),
  images: Joi.array().items(shopImageSchema).min(1).max(10).required()
});

/**
 * @swagger
 * /api/shop/register:
 *   post:
 *     tags:
 *       - Shop Registration
 *     summary: Register a new shop (multi-step or complete) (Register a new shop (multi-step or complete))
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Register a new shop using either step-by-step process or complete registration.
 *       
 *       **Step-by-step process:**
 *       - Step 1: Basic information (name, category, contact)
 *       - Step 2: Address and location
 *       - Step 3: Business license and verification documents
 *       - Step 4: Operating hours and payment methods
 *       
 *       **Complete registration:**
 *       - All information provided at once
 *       - Faster processing but requires all data upfront
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             oneOf:
 *               - type: object
 *                 title: Step Registration
 *                 properties:
 *                   step:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 4
 *                     description: Registration step (1-4)
 *                     example: 1
 *                   data:
 *                     type: object
 *                     description: Step-specific data
 *                     example:
 *                       name: "뷰티살롱 ABC"
 *                       phone_number: "010-1234-5678"
 *                       main_category: "nail"
 *                 required: [step, data]
 *               - type: object
 *                 title: Complete Registration
 *                 properties:
 *                   complete_registration:
 *                     type: boolean
 *                     enum: [true]
 *                     description: Flag for complete registration
 *                   data:
 *                     type: object
 *                     description: Complete shop information
 *                     properties:
 *                       name:
 *                         type: string
 *                         example: "뷰티살롱 ABC"
 *                       phone_number:
 *                         type: string
 *                         example: "010-1234-5678"
 *                       main_category:
 *                         type: string
 *                         enum: [nail, eyelash, waxing, eyebrow_tattoo, hair]
 *                       address:
 *                         type: string
 *                         example: "서울시 강남구 테헤란로 123"
 *                       latitude:
 *                         type: number
 *                         example: 37.5665
 *                       longitude:
 *                         type: number
 *                         example: 126.9780
 *                       business_license_number:
 *                         type: string
 *                         example: "123-45-67890"
 *                       business_license_image_url:
 *                         type: string
 *                         format: uri
 *                         example: "https://storage.supabase.co/v1/object/public/documents/license.jpg"
 *                 required: [complete_registration, data]
 *     responses:
 *       201:
 *         description: Registration successful
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
 *                     shop_id:
 *                       type: string
 *                       format: uuid
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     step_completed:
 *                       type: integer
 *                       example: 1
 *                     next_step:
 *                       type: integer
 *                       nullable: true
 *                       example: 2
 *                     registration_complete:
 *                       type: boolean
 *                       example: false
 *                     status:
 *                       type: string
 *                       example: "pending_approval"
 *                 message:
 *                   type: string
 *                   example: "1단계 등록이 완료되었습니다."
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Authentication required
 *       409:
 *         description: Shop already registered
 *       429:
 *         description: Rate limit exceeded
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
  registrationRateLimit,
  authenticateJWT,
  requireAdmin(),
  validateRequestBody(Joi.alternatives().try(stepRegistrationSchema, completeRegistrationSchema)),
  shopRegistrationController.registerShop.bind(shopRegistrationController)
);

/**
 * @swagger
 * /api/shop/register/images:
 *   post:
 *     tags:
 *       - Shop Registration
 *     summary: Upload shop images (Upload shop images)
 *     description: Upload multiple images for a registered shop with display order and metadata
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shop_id:
 *                 type: string
 *                 format: uuid
 *                 description: Shop ID to upload images for
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               images:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 10
 *                 items:
 *                   type: object
 *                   properties:
 *                     image_url:
 *                       type: string
 *                       format: uri
 *                       description: Image URL from Supabase Storage
 *                       example: "https://storage.supabase.co/v1/object/public/shop-images/image1.jpg"
 *                     alt_text:
 *                       type: string
 *                       maxLength: 200
 *                       description: Alternative text for accessibility
 *                       example: "샵 내부 전경"
 *                     is_primary:
 *                       type: boolean
 *                       default: false
 *                       description: Whether this is the primary shop image
 *                       example: true
 *                     display_order:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 10
 *                       default: 0
 *                       description: Display order for image carousel
 *                       example: 0
 *                   required: [image_url]
 *             required: [shop_id, images]
 *     responses:
 *       201:
 *         description: Images uploaded successfully
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
 *                     shop_id:
 *                       type: string
 *                       format: uuid
 *                     images:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           image_url:
 *                             type: string
 *                             format: uri
 *                           is_primary:
 *                             type: boolean
 *                           display_order:
 *                             type: integer
 *                     uploaded_count:
 *                       type: integer
 *                       example: 3
 *                 message:
 *                   type: string
 *                   example: "이미지가 성공적으로 업로드되었습니다."
 *       400:
 *         description: Invalid image data
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Shop not found or access denied
 */

/**
 * @swagger
 * /images:
 *   post:
 *     summary: POST /images (POST /images)
 *     description: POST endpoint for /images
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
router.post('/images',
  registrationRateLimit,
  authenticateJWT,
  requireAdmin(),
  validateRequestBody(imageUploadSchema),
  shopRegistrationController.uploadShopImages.bind(shopRegistrationController)
);

/**
 * @swagger
 * /api/shop/register/status/{registrationId}:
 *   get:
 *     tags:
 *       - Shop Registration
 *     summary: registration status 조회
 *     description: Retrieve the current status and completion progress of a shop registration
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: registrationId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop registration ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Registration status retrieved successfully
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
 *                     shop:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending_approval, active, inactive, suspended, deleted]
 *                         verification_status:
 *                           type: string
 *                           enum: [pending, verified, rejected]
 *                         created_at:
 *                           type: string
 *                           format: date-time
 *                         updated_at:
 *                           type: string
 *                           format: date-time
 *                     completion_status:
 *                       type: object
 *                       properties:
 *                         basic_info:
 *                           type: boolean
 *                           description: Basic information completed
 *                         business_license:
 *                           type: boolean
 *                           description: Business license uploaded and validated
 *                         images:
 *                           type: boolean
 *                           description: Shop images uploaded
 *                         overall_complete:
 *                           type: boolean
 *                           description: Registration fully complete
 *                     images_count:
 *                       type: integer
 *                       description: Number of uploaded images
 *                     next_steps:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Remaining steps to complete registration
 *                       example: ["사업자등록증 업로드", "샵 이미지 업로드"]
 *                 message:
 *                   type: string
 *                   example: "등록 상태를 조회했습니다."
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Registration not found
 */

/**
 * @swagger
 * /status/:registrationId:
 *   get:
 *     summary: /status/:registrationId 조회
 *     description: GET endpoint for /status/:registrationId
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
router.get('/status/:registrationId',
  authenticateJWT,
  requireAdmin(),
  shopRegistrationController.getRegistrationStatus.bind(shopRegistrationController)
);

/**
 * @swagger
 * /api/shop/register/validate/business-license/{licenseNumber}:
 *   get:
 *     tags:
 *       - Shop Registration
 *     summary: Validate Korean business license number (Validate Korean business license number)
 *     description: |
 *       
 *       샵 관련 API입니다. 샵 정보 조회와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Validate a Korean business license number using checksum algorithm.
 *       Supports formats: 123-45-67890, 1234567890
 *     parameters:
 *       - in: path
 *         name: licenseNumber
 *         required: true
 *         schema:
 *           type: string
 *         description: Korean business license number (with or without hyphens)
 *         example: "123-45-67890"
 *     responses:
 *       200:
 *         description: Business license validation result
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
 *                     license_number:
 *                       type: string
 *                       example: "123-45-67890"
 *                     is_valid:
 *                       type: boolean
 *                       example: true
 *                     formatted_number:
 *                       type: string
 *                       description: Properly formatted license number
 *                       example: "123-45-67890"
 *                 message:
 *                   type: string
 *                   example: "유효한 사업자등록번호입니다."
 *       400:
 *         description: Invalid business license number
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "VALIDATION_ERROR"
 *                     message:
 *                       type: string
 *                       example: "유효하지 않은 사업자등록번호입니다."
 *                     details:
 *                       type: object
 *                       properties:
 *                         license_number:
 *                           type: string
 *                         is_valid:
 *                           type: boolean
 *                           example: false
 */

/**
 * @swagger
 * /validate/business-license/:licenseNumber:
 *   get:
 *     summary: /validate/business-license/:licenseNumber 조회
 *     description: GET endpoint for /validate/business-license/:licenseNumber
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
router.get('/validate/business-license/:licenseNumber',
  validationRateLimit,
  shopRegistrationController.validateBusinessLicense.bind(shopRegistrationController)
);

export default router;
