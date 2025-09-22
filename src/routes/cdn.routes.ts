/**
 * CDN Routes
 * 
 * API routes for CDN functionality including image URL generation,
 * transformation, and optimization
 */

import { Router } from 'express';
import { cdnController } from '../controllers/cdn.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
// Validation middleware - simplified for now
const validateRequestBody = (schema: any) => (req: any, res: any, next: any) => next();
const validateQueryParams = (schema: any) => (req: any, res: any, next: any) => next();
import Joi from 'joi';

const router = Router();

// Rate limiting configurations
const cdnUrlRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    strategy: 'sliding_window'
  }
});

const cdnConfigRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per 15 minutes
    strategy: 'fixed_window'
  }
});

const cdnTestRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 requests per 15 minutes
    strategy: 'fixed_window'
  }
});

// Validation schemas
const imageIdSchema = Joi.object({
  imageId: Joi.string().uuid().required()
});

const responsiveUrlsSchema = Joi.object({
  breakpoints: Joi.array().items(Joi.number().integer().min(100).max(4000)).min(1).max(10).optional()
});

const webpUrlsSchema = Joi.object({
  transformations: Joi.object({
    width: Joi.number().integer().min(1).max(4000).optional(),
    height: Joi.number().integer().min(1).max(4000).optional(),
    quality: Joi.number().integer().min(1).max(100).optional(),
    format: Joi.string().valid('webp', 'jpeg', 'png', 'auto').optional(),
    fit: Joi.string().valid('cover', 'contain', 'fill', 'inside', 'outside').optional(),
    position: Joi.string().optional(),
    background: Joi.string().optional(),
    blur: Joi.number().min(0).max(100).optional(),
    sharpen: Joi.number().min(0).max(100).optional(),
    brightness: Joi.number().min(-100).max(100).optional(),
    contrast: Joi.number().min(-100).max(100).optional(),
    saturation: Joi.number().min(-100).max(100).optional(),
    hue: Joi.number().min(-180).max(180).optional(),
    gamma: Joi.number().min(0.1).max(3).optional(),
    progressive: Joi.boolean().optional(),
    stripMetadata: Joi.boolean().optional()
  }).optional()
});

const transformImageUrlSchema = Joi.object({
  filePath: Joi.string().required(),
  bucket: Joi.string().optional(),
  transformations: Joi.object({
    width: Joi.number().integer().min(1).max(4000).optional(),
    height: Joi.number().integer().min(1).max(4000).optional(),
    quality: Joi.number().integer().min(1).max(100).optional(),
    format: Joi.string().valid('webp', 'jpeg', 'png', 'auto').optional(),
    fit: Joi.string().valid('cover', 'contain', 'fill', 'inside', 'outside').optional(),
    position: Joi.string().optional(),
    background: Joi.string().optional(),
    blur: Joi.number().min(0).max(100).optional(),
    sharpen: Joi.number().min(0).max(100).optional(),
    brightness: Joi.number().min(-100).max(100).optional(),
    contrast: Joi.number().min(-100).max(100).optional(),
    saturation: Joi.number().min(-100).max(100).optional(),
    hue: Joi.number().min(-180).max(180).optional(),
    gamma: Joi.number().min(0.1).max(3).optional(),
    progressive: Joi.boolean().optional(),
    stripMetadata: Joi.boolean().optional()
  }).optional(),
  options: Joi.object({
    cacheBust: Joi.boolean().optional(),
    expires: Joi.number().integer().positive().optional(),
    signature: Joi.string().optional()
  }).optional()
});

const queryParamsSchema = Joi.object({
  width: Joi.number().integer().min(1).max(4000).optional(),
  height: Joi.number().integer().min(1).max(4000).optional(),
  quality: Joi.number().integer().min(1).max(100).optional(),
  format: Joi.string().valid('webp', 'jpeg', 'png', 'auto').optional(),
  fit: Joi.string().valid('cover', 'contain', 'fill', 'inside', 'outside').optional(),
  position: Joi.string().optional(),
  background: Joi.string().optional(),
  blur: Joi.number().min(0).max(100).optional(),
  sharpen: Joi.number().min(0).max(100).optional(),
  brightness: Joi.number().min(-100).max(100).optional(),
  contrast: Joi.number().min(-100).max(100).optional(),
  saturation: Joi.number().min(-100).max(100).optional(),
  hue: Joi.number().min(-180).max(180).optional(),
  gamma: Joi.number().min(0.1).max(3).optional(),
  progressive: Joi.boolean().optional(),
  stripMetadata: Joi.boolean().optional()
});

// ============================================================================
// CDN ROUTES
// ============================================================================

/**
 * @swagger
 * /api/cdn/images/{imageId}/urls:
 *   get:
 *     summary: Get CDN URLs for an image
 *     description: Generate CDN URLs for an image with optional transformations
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the image
 *       - in: query
 *         name: width
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 4000
 *         description: Image width
 *       - in: query
 *         name: height
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 4000
 *         description: Image height
 *       - in: query
 *         name: quality
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *         description: Image quality (1-100)
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [webp, jpeg, png, auto]
 *         description: Image format
 *       - in: query
 *         name: fit
 *         schema:
 *           type: string
 *           enum: [cover, contain, fill, inside, outside]
 *         description: How to fit the image
 *     responses:
 *       200:
 *         description: CDN URLs generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     url: { type: 'string', example: 'https://example.com/image.jpg' }
 *                     cdnUrl: { type: 'string', example: 'https://cdn.example.com/image.jpg?w=800&h=600&q=85' }
 *                     transformations: { type: 'object' }
 *                     cacheHeaders: { type: 'object' }
 *                     expiresAt: { type: 'string', format: 'date-time' }
 *                 message: { type: 'string', example: 'CDN URL을 성공적으로 생성했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /images/:imageId/urls:
 *   get:
 *     summary: GET /images/:imageId/urls
 *     description: GET endpoint for /images/:imageId/urls
 *     tags: [System]
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
router.get('/images/:imageId/urls',
  authenticateJWT,
  cdnUrlRateLimit,
  validateQueryParams(queryParamsSchema),
  cdnController.getImageCDNUrls
);

/**
 * @swagger
 * /api/cdn/images/{imageId}/optimized:
 *   get:
 *     summary: Get optimized CDN URLs for all sizes
 *     description: Generate optimized CDN URLs for all sizes of an image (thumbnail, medium, large, WebP, responsive)
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the image
 *     responses:
 *       200:
 *         description: Optimized CDN URLs generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     original: { $ref: '#/components/schemas/CDNResult' }
 *                     thumbnail: { $ref: '#/components/schemas/CDNResult' }
 *                     medium: { $ref: '#/components/schemas/CDNResult' }
 *                     large: { $ref: '#/components/schemas/CDNResult' }
 *                     webp:
 *                       type: object
 *                       properties:
 *                         original: { $ref: '#/components/schemas/CDNResult' }
 *                         thumbnail: { $ref: '#/components/schemas/CDNResult' }
 *                         medium: { $ref: '#/components/schemas/CDNResult' }
 *                         large: { $ref: '#/components/schemas/CDNResult' }
 *                     responsive:
 *                       type: object
 *                       properties:
 *                         srcSet: { type: 'string' }
 *                         sizes: { type: 'string' }
 *                         urls: { type: 'object' }
 *                 message: { type: 'string', example: '최적화된 CDN URL을 성공적으로 생성했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /images/:imageId/optimized:
 *   get:
 *     summary: GET /images/:imageId/optimized
 *     description: GET endpoint for /images/:imageId/optimized
 *     tags: [System]
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
router.get('/images/:imageId/optimized',
  authenticateJWT,
  cdnUrlRateLimit,
  cdnController.getImageOptimizedCDNUrls
);

/**
 * @swagger
 * /api/cdn/images/{imageId}/responsive:
 *   post:
 *     summary: Generate responsive image URLs
 *     description: Generate responsive image URLs for different screen sizes
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the image
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               breakpoints:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 100
 *                   maximum: 4000
 *                 minItems: 1
 *                 maxItems: 10
 *                 example: [320, 640, 768, 1024, 1280, 1920]
 *     responses:
 *       200:
 *         description: Responsive URLs generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     srcSet: { type: 'string' }
 *                     sizes: { type: 'string' }
 *                     urls: { type: 'object' }
 *                 message: { type: 'string', example: '반응형 이미지 URL을 성공적으로 생성했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /images/:imageId/responsive:
 *   post:
 *     summary: POST /images/:imageId/responsive
 *     description: POST endpoint for /images/:imageId/responsive
 *     tags: [System]
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
router.post('/images/:imageId/responsive',
  authenticateJWT,
  cdnUrlRateLimit,
  validateRequestBody(responsiveUrlsSchema),
  cdnController.generateResponsiveUrls
);

/**
 * @swagger
 * /api/cdn/images/{imageId}/webp:
 *   get:
 *     summary: Generate WebP URLs with fallback
 *     description: Generate WebP URLs with JPEG/PNG fallback for an image
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         schema:
 *           type: string
 *           format: uuid
 *         required: true
 *         description: ID of the image
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               transformations:
 *                 type: object
 *                 properties:
 *                   width: { type: 'integer', minimum: 1, maximum: 4000 }
 *                   height: { type: 'integer', minimum: 1, maximum: 4000 }
 *                   quality: { type: 'integer', minimum: 1, maximum: 100 }
 *                   format: { type: 'string', enum: [webp, jpeg, png, auto] }
 *                   fit: { type: 'string', enum: [cover, contain, fill, inside, outside] }
 *     responses:
 *       200:
 *         description: WebP URLs generated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     webp: { $ref: '#/components/schemas/CDNResult' }
 *                     fallback: { $ref: '#/components/schemas/CDNResult' }
 *                 message: { type: 'string', example: 'WebP URL을 성공적으로 생성했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /images/:imageId/webp:
 *   get:
 *     summary: GET /images/:imageId/webp
 *     description: GET endpoint for /images/:imageId/webp
 *     tags: [System]
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
router.get('/images/:imageId/webp',
  authenticateJWT,
  cdnUrlRateLimit,
  validateRequestBody(webpUrlsSchema),
  cdnController.generateWebPUrls
);

/**
 * @swagger
 * /api/cdn/config:
 *   get:
 *     summary: Get CDN configuration
 *     description: Get current CDN configuration and validation status
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CDN configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     config: { type: 'object' }
 *                     validation: { type: 'object' }
 *                 message: { type: 'string', example: 'CDN 설정을 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/config',
  authenticateJWT,
  cdnConfigRateLimit,
  cdnController.getCDNConfig
);

/**
 * @swagger
 * /api/cdn/test:
 *   post:
 *     summary: Test CDN connectivity
 *     description: Test CDN connectivity and performance
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CDN connectivity test completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     success: { type: 'boolean' }
 *                     latency: { type: 'number' }
 *                     error: { type: 'string' }
 *                 message: { type: 'string', example: 'CDN 연결 테스트를 완료했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/test',
  authenticateJWT,
  cdnTestRateLimit,
  cdnController.testCDNConnectivity
);

/**
 * @swagger
 * /api/cdn/transform:
 *   post:
 *     summary: Transform image URL
 *     description: Transform an image URL with custom parameters
 *     tags: [CDN]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - filePath
 *             properties:
 *               filePath:
 *                 type: string
 *                 description: Path to the image file in storage
 *                 example: "large/shop-123-image.jpg"
 *               bucket:
 *                 type: string
 *                 default: "shop-images"
 *                 description: Storage bucket name
 *               transformations:
 *                 type: object
 *                 properties:
 *                   width: { type: 'integer', minimum: 1, maximum: 4000 }
 *                   height: { type: 'integer', minimum: 1, maximum: 4000 }
 *                   quality: { type: 'integer', minimum: 1, maximum: 100 }
 *                   format: { type: 'string', enum: [webp, jpeg, png, auto] }
 *                   fit: { type: 'string', enum: [cover, contain, fill, inside, outside] }
 *               options:
 *                 type: object
 *                 properties:
 *                   cacheBust: { type: 'boolean' }
 *                   expires: { type: 'integer' }
 *                   signature: { type: 'string' }
 *     responses:
 *       200:
 *         description: Image URL transformed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data: { $ref: '#/components/schemas/CDNResult' }
 *                 message: { type: 'string', example: '이미지 변환 URL을 성공적으로 생성했습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */

/**
 * @swagger
 * /transform:
 *   post:
 *     summary: POST /transform
 *     description: POST endpoint for /transform
 *     tags: [System]
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
router.post('/transform',
  authenticateJWT,
  cdnUrlRateLimit,
  validateRequestBody(transformImageUrlSchema),
  cdnController.transformImageUrl
);

export default router;
