/**
 * Image Metadata Management Routes
 * 
 * Provides comprehensive API endpoints for advanced image metadata management
 * including alt text generation, categorization, reordering, and batch operations
 */

import { Router } from 'express';
import { imageMetadataController } from '../controllers/image-metadata.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import { 
  enhancedImageAccessSecurity, 
  enhancedImageUpdateSecurity 
} from '../middleware/image-security.middleware';
import { logger } from '../utils/logger';
import Joi from 'joi';

const router = Router();

// Rate limiting configurations
const metadataRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    strategy: 'fixed_window',
    scope: 'ip',
    enableHeaders: true,
    message: '너무 많은 메타데이터 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
});

const batchRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 batch requests per window
    strategy: 'fixed_window',
    scope: 'ip',
    enableHeaders: true,
    message: '너무 많은 배치 작업 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
});

// Validation schemas
const updateMetadataSchema = Joi.object({
  alt_text: Joi.string().max(255).optional()
    .messages({
      'string.max': '대체 텍스트는 255자를 초과할 수 없습니다.'
    }),
  title: Joi.string().max(255).optional()
    .messages({
      'string.max': '제목은 255자를 초과할 수 없습니다.'
    }),
  description: Joi.string().max(1000).optional()
    .messages({
      'string.max': '설명은 1000자를 초과할 수 없습니다.'
    }),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    .messages({
      'array.max': '최대 10개의 태그만 허용됩니다.',
      'string.max': '각 태그는 50자를 초과할 수 없습니다.'
    }),
  category: Joi.string().valid('exterior', 'interior', 'service', 'staff', 'equipment', 'other').optional()
    .messages({
      'any.only': '유효하지 않은 카테고리입니다.'
    }),
  is_primary: Joi.boolean().optional(),
  display_order: Joi.number().integer().min(0).max(9999).optional()
    .messages({
      'number.base': '표시 순서는 숫자여야 합니다.',
      'number.integer': '표시 순서는 정수여야 합니다.',
      'number.min': '표시 순서는 0 이상이어야 합니다.',
      'number.max': '표시 순서는 9999 이하여야 합니다.'
    }),
  is_archived: Joi.boolean().optional()
});

const reorderImagesSchema = Joi.object({
  imageOrders: Joi.array().items(
    Joi.object({
      imageId: Joi.string().uuid().required()
        .messages({
          'string.guid': '유효하지 않은 이미지 ID입니다.'
        }),
      displayOrder: Joi.number().integer().min(0).max(9999).required()
        .messages({
          'number.base': '표시 순서는 숫자여야 합니다.',
          'number.integer': '표시 순서는 정수여야 합니다.',
          'number.min': '표시 순서는 0 이상이어야 합니다.',
          'number.max': '표시 순서는 9999 이하여야 합니다.'
        })
    })
  ).min(1).max(50).required()
    .messages({
      'array.min': '최소 1개의 이미지 순서가 필요합니다.',
      'array.max': '최대 50개의 이미지 순서만 허용됩니다.'
    })
});

const batchUpdateSchema = Joi.object({
  updates: Joi.array().items(
    Joi.object({
      imageId: Joi.string().uuid().required()
        .messages({
          'string.guid': '유효하지 않은 이미지 ID입니다.'
        }),
      metadata: updateMetadataSchema.required()
    })
  ).min(1).max(20).required()
    .messages({
      'array.min': '최소 1개의 업데이트가 필요합니다.',
      'array.max': '최대 20개의 업데이트만 허용됩니다.'
    })
});

const searchImagesSchema = Joi.object({
  searchText: Joi.string().max(255).optional()
    .messages({
      'string.max': '검색어는 255자를 초과할 수 없습니다.'
    }),
  category: Joi.string().valid('exterior', 'interior', 'service', 'staff', 'equipment', 'other').optional()
    .messages({
      'any.only': '유효하지 않은 카테고리입니다.'
    }),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional()
    .messages({
      'array.max': '최대 10개의 태그만 허용됩니다.',
      'string.max': '각 태그는 50자를 초과할 수 없습니다.'
    }),
  hasAltText: Joi.boolean().optional(),
  isOptimized: Joi.boolean().optional(),
  dateRange: Joi.object({
    start: Joi.date().iso().required(),
    end: Joi.date().iso().required()
  }).optional()
});

const archiveImagesSchema = Joi.object({
  imageIds: Joi.array().items(Joi.string().uuid()).min(1).max(50).required()
    .messages({
      'array.min': '최소 1개의 이미지 ID가 필요합니다.',
      'array.max': '최대 50개의 이미지 ID만 허용됩니다.',
      'string.guid': '유효하지 않은 이미지 ID입니다.'
    }),
  archive: Joi.boolean().default(true)
});

// ============================================================================
// IMAGE METADATA MANAGEMENT ROUTES
// ============================================================================

/**
 * @swagger
 * /api/shop/images/{imageId}/metadata:
 *   get:
 *     summary: Get image metadata
 *     description: |
 *       Retrieve comprehensive metadata for a specific image including
 *       alt text, tags, category, and optimization information.
 *       
 *       **Features:**
 *       - Complete image metadata retrieval
 *       - Access logging for analytics
 *       - Optimization status tracking
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Image ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Successfully retrieved image metadata
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     image: { $ref: '#/components/schemas/ImageMetadata' }
 *                 message: { type: 'string', example: '이미지 메타데이터를 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:imageId/metadata',
  ...enhancedImageAccessSecurity(),
  async (req, res, next) => {
    try {
      await imageMetadataController.getImageMetadata(req, res, next);
    } catch (error) {
      logger.error('Error in image metadata GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 메타데이터 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/images/{imageId}/metadata:
 *   put:
 *     summary: Update image metadata
 *     description: |
 *       Update metadata for a specific image including alt text, title,
 *       description, tags, category, and display order.
 *       
 *       **Features:**
 *       - Comprehensive metadata updates
 *       - Validation and sanitization
 *       - Access logging
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Image ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               alt_text:
 *                 type: string
 *                 maxLength: 255
 *                 description: Alt text for accessibility
 *                 example: "네일샵 내부 사진"
 *               title:
 *                 type: string
 *                 maxLength: 255
 *                 description: Image title
 *                 example: "샵 내부 전경"
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Detailed description
 *                 example: "깔끔하고 모던한 인테리어의 네일샵 내부"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                   maxLength: 50
 *                 maxItems: 10
 *                 description: Image tags for categorization
 *                 example: ["인테리어", "모던", "깔끔"]
 *               category:
 *                 type: string
 *                 enum: [exterior, interior, service, staff, equipment, other]
 *                 description: Image category
 *                 example: "interior"
 *               is_primary:
 *                 type: boolean
 *                 description: Whether this is the primary image
 *                 example: true
 *               display_order:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 9999
 *                 description: Display order for sorting
 *                 example: 1
 *               is_archived:
 *                 type: boolean
 *                 description: Whether image is archived
 *                 example: false
 *     responses:
 *       200:
 *         description: Image metadata successfully updated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     image: { $ref: '#/components/schemas/ImageMetadata' }
 *                 message: { type: 'string', example: '이미지 메타데이터가 성공적으로 업데이트되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:imageId/metadata',
  ...enhancedImageUpdateSecurity(),
  validateRequestBody(updateMetadataSchema),
  async (req, res, next) => {
    try {
      await imageMetadataController.updateImageMetadata(req, res, next);
    } catch (error) {
      logger.error('Error in image metadata PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 메타데이터 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/images/{imageId}/alt-text-suggestions:
 *   get:
 *     summary: Get alt text suggestions
 *     description: |
 *       Generate intelligent alt text suggestions for an image based on
 *       its category, tags, and shop information.
 *       
 *       **Features:**
 *       - AI-powered alt text generation
 *       - Multiple suggestion options
 *       - Confidence scoring
 *       - Context-aware suggestions
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: imageId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Image ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Successfully generated alt text suggestions
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     suggestions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           suggestion: { type: 'string', example: '네일샵 내부 사진' }
 *                           confidence: { type: 'number', example: 0.9 }
 *                           reasoning: { type: 'string', example: 'Based on image category: interior' }
 *                 message: { type: 'string', example: '대체 텍스트 제안을 성공적으로 생성했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       404:
 *         $ref: '#/components/responses/ImageNotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:imageId/alt-text-suggestions',
  ...enhancedImageAccessSecurity(),
  async (req, res, next) => {
    try {
      await imageMetadataController.getAltTextSuggestions(req, res, next);
    } catch (error) {
      logger.error('Error in alt text suggestions GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '대체 텍스트 제안 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/{shopId}/images/reorder:
 *   put:
 *     summary: Reorder shop images
 *     description: |
 *       Reorder images for a shop by updating their display order.
 *       Supports drag-and-drop reordering functionality.
 *       
 *       **Features:**
 *       - Drag-and-drop reordering
 *       - Batch order updates
 *       - Validation of image ownership
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageOrders]
 *             properties:
 *               imageOrders:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [imageId, displayOrder]
 *                   properties:
 *                     imageId:
 *                       type: string
 *                       format: uuid
 *                       description: Image ID
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     displayOrder:
 *                       type: integer
 *                       minimum: 0
 *                       maximum: 9999
 *                       description: New display order
 *                       example: 1
 *                 minItems: 1
 *                 maxItems: 50
 *                 description: Array of image orders
 *     responses:
 *       200:
 *         description: Images successfully reordered
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     reordered_count: { type: 'integer', example: 5 }
 *                 message: { type: 'string', example: '이미지 순서가 성공적으로 변경되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:shopId/images/reorder',
  ...enhancedImageUpdateSecurity(),
  validateRequestBody(reorderImagesSchema),
  async (req, res, next) => {
    try {
      await imageMetadataController.reorderImages(req, res, next);
    } catch (error) {
      logger.error('Error in reorder images PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 순서 변경 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/{shopId}/images/batch-update:
 *   put:
 *     summary: Batch update image metadata
 *     description: |
 *       Update metadata for multiple images in a single operation.
 *       Useful for bulk operations like adding tags or changing categories.
 *       
 *       **Features:**
 *       - Bulk metadata updates
 *       - Partial success handling
 *       - Detailed error reporting
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [updates]
 *             properties:
 *               updates:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [imageId, metadata]
 *                   properties:
 *                     imageId:
 *                       type: string
 *                       format: uuid
 *                       description: Image ID
 *                       example: "123e4567-e89b-12d3-a456-426614174000"
 *                     metadata:
 *                       type: object
 *                       properties:
 *                         alt_text: { type: 'string', maxLength: 255 }
 *                         title: { type: 'string', maxLength: 255 }
 *                         description: { type: 'string', maxLength: 1000 }
 *                         tags: { type: 'array', items: { type: 'string' }, maxItems: 10 }
 *                         category: { type: 'string', enum: [exterior, interior, service, staff, equipment, other] }
 *                         is_primary: { type: 'boolean' }
 *                         display_order: { type: 'integer', minimum: 0, maximum: 9999 }
 *                         is_archived: { type: 'boolean' }
 *                 minItems: 1
 *                 maxItems: 20
 *                 description: Array of image updates
 *     responses:
 *       200:
 *         description: Batch update completed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     success_count: { type: 'integer', example: 18 }
 *                     failed_count: { type: 'integer', example: 2 }
 *                     errors: { type: 'array', items: { type: 'string' } }
 *                 message: { type: 'string', example: '배치 업데이트가 완료되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:shopId/images/batch-update',
  ...enhancedImageUpdateSecurity(),
  validateRequestBody(batchUpdateSchema),
  async (req, res, next) => {
    try {
      await imageMetadataController.batchUpdateMetadata(req, res, next);
    } catch (error) {
      logger.error('Error in batch update PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '배치 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/{shopId}/images/search:
 *   post:
 *     summary: Search images by metadata
 *     description: |
 *       Search for images using various metadata criteria including
 *       text search, category, tags, and date ranges.
 *       
 *       **Features:**
 *       - Full-text search across titles, descriptions, and alt text
 *       - Category and tag filtering
 *       - Date range filtering
 *       - Optimization status filtering
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               searchText:
 *                 type: string
 *                 maxLength: 255
 *                 description: Text to search for
 *                 example: "내부"
 *               category:
 *                 type: string
 *                 enum: [exterior, interior, service, staff, equipment, other]
 *                 description: Filter by category
 *                 example: "interior"
 *               tags:
 *                 type: array
 *                 items:
 *                   type: string
 *                 maxItems: 10
 *                 description: Filter by tags
 *                 example: ["모던", "깔끔"]
 *               hasAltText:
 *                 type: boolean
 *                 description: Filter by alt text presence
 *                 example: true
 *               isOptimized:
 *                 type: boolean
 *                 description: Filter by optimization status
 *                 example: true
 *               dateRange:
 *                 type: object
 *                 properties:
 *                   start:
 *                     type: string
 *                     format: date-time
 *                     description: Start date
 *                     example: "2024-01-01T00:00:00Z"
 *                   end:
 *                     type: string
 *                     format: date-time
 *                     description: End date
 *                     example: "2024-12-31T23:59:59Z"
 *     responses:
 *       200:
 *         description: Search completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     images:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/ImageMetadata'
 *                     total_count: { type: 'integer', example: 15 }
 *                 message: { type: 'string', example: '검색이 완료되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/:shopId/images/search',
  ...enhancedImageAccessSecurity(),
  validateRequestBody(searchImagesSchema),
  async (req, res, next) => {
    try {
      await imageMetadataController.searchImages(req, res, next);
    } catch (error) {
      logger.error('Error in search images POST route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 검색 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/{shopId}/images/stats:
 *   get:
 *     summary: Get image statistics
 *     description: |
 *       Retrieve comprehensive statistics about images for a shop
 *       including counts, sizes, and category breakdowns.
 *       
 *       **Features:**
 *       - Total image count and size statistics
 *       - Category breakdown
 *       - Optimization status tracking
 *       - Archive status tracking
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Successfully retrieved image statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     total_images: { type: 'integer', example: 25 }
 *                     total_size: { type: 'integer', example: 52428800 }
 *                     avg_size: { type: 'number', example: 2097152 }
 *                     optimized_count: { type: 'integer', example: 20 }
 *                     archived_count: { type: 'integer', example: 2 }
 *                     category_stats:
 *                       type: object
 *                       additionalProperties:
 *                         type: 'integer'
 *                       example:
 *                         interior: 10
 *                         exterior: 5
 *                         service: 8
 *                         staff: 2
 *                 message: { type: 'string', example: '이미지 통계를 성공적으로 조회했습니다.' }
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.get('/:shopId/images/stats',
  ...enhancedImageAccessSecurity(),
  async (req, res, next) => {
    try {
      await imageMetadataController.getImageStats(req, res, next);
    } catch (error) {
      logger.error('Error in image stats GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 통계 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shop/{shopId}/images/archive:
 *   put:
 *     summary: Archive/unarchive images
 *     description: |
 *       Archive or unarchive multiple images for a shop.
 *       Archived images are hidden from normal views but can be restored.
 *       
 *       **Features:**
 *       - Bulk archive/unarchive operations
 *       - Soft delete functionality
 *       - Archive timestamp tracking
 *       
 *       **Authorization:** Requires valid JWT token and shop owner role.
 *     tags: [Image Metadata]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [imageIds]
 *             properties:
 *               imageIds:
 *                 type: array
 *                 items:
 *                   type: string
 *                   format: uuid
 *                 minItems: 1
 *                 maxItems: 50
 *                 description: Array of image IDs to archive/unarchive
 *                 example: ["123e4567-e89b-12d3-a456-426614174000", "456e7890-e89b-12d3-a456-426614174000"]
 *               archive:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to archive (true) or unarchive (false)
 *                 example: true
 *     responses:
 *       200:
 *         description: Images successfully archived/unarchived
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success: { type: 'boolean', example: true }
 *                 data:
 *                   type: object
 *                   properties:
 *                     processed_count: { type: 'integer', example: 5 }
 *                     archive_status: { type: 'boolean', example: true }
 *                 message: { type: 'string', example: '이미지가 성공적으로 보관되었습니다.' }
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         $ref: '#/components/responses/ForbiddenError'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.put('/:shopId/images/archive',
  ...enhancedImageUpdateSecurity(),
  validateRequestBody(archiveImagesSchema),
  async (req, res, next) => {
    try {
      await imageMetadataController.archiveImages(req, res, next);
    } catch (error) {
      logger.error('Error in archive images PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '이미지 보관 처리 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

export default router;
