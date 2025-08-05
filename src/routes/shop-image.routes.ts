/**
 * Shop Image Routes
 * 
 * Defines all shop image management endpoints with proper middleware,
 * validation, and authentication
 */

import { Router } from 'express';
import multer from 'multer';
import { shopImageController } from '../controllers/shop-image.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();



// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const uploadShopImageSchema = Joi.object({
  isPrimary: Joi.string().valid('true', 'false').optional()
    .messages({
      'any.only': 'isPrimary는 true 또는 false여야 합니다.'
    }),
  altText: Joi.string().max(255).optional()
    .messages({
      'string.max': '대체 텍스트는 255자를 초과할 수 없습니다.'
    }),
  displayOrder: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': '표시 순서는 숫자여야 합니다.',
      'number.integer': '표시 순서는 정수여야 합니다.',
      'number.min': '표시 순서는 0 이상이어야 합니다.'
    })
});

const updateShopImageSchema = Joi.object({
  altText: Joi.string().max(255).optional()
    .messages({
      'string.max': '대체 텍스트는 255자를 초과할 수 없습니다.'
    }),
  isPrimary: Joi.string().valid('true', 'false').optional()
    .messages({
      'any.only': 'isPrimary는 true 또는 false여야 합니다.'
    }),
  displayOrder: Joi.number().integer().min(0).optional()
    .messages({
      'number.base': '표시 순서는 숫자여야 합니다.',
      'number.integer': '표시 순서는 정수여야 합니다.',
      'number.min': '표시 순서는 0 이상이어야 합니다.'
    })
});

// =============================================
// SHOP IMAGE MANAGEMENT ENDPOINTS
// =============================================

/**
 * POST /api/shops/:shopId/images
 * Upload shop image with optimization
 */
// Rate limiting configuration
const uploadRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 uploads per 15 minutes
    strategy: 'fixed_window'
  }
});

const publicRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per 15 minutes
    strategy: 'fixed_window'
  }
});

const deleteRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 deletions per 15 minutes
    strategy: 'fixed_window'
  }
});

const updateRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 updates per 15 minutes
    strategy: 'fixed_window'
  }
});

const primaryRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 primary image changes per 15 minutes
    strategy: 'fixed_window'
  }
});

/**
 * POST /api/shops/:shopId/images
 * Upload shop image with optimization
 */
router.post('/:shopId/images',
  uploadRateLimit,
  authenticateJWT(),
  upload.single('image'),
  (req: any, res: any, next: any) => {
    // Validate uploaded file
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: '업로드할 이미지 파일을 선택해주세요.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate file type
    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Validate file size
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: '이미지 파일 크기는 5MB 이하여야 합니다.',
          timestamp: new Date().toISOString()
        }
      });
    }

    next();
  },
  validateRequestBody(uploadShopImageSchema),
  shopImageController.uploadShopImage
);

/**
 * GET /api/shops/:shopId/images
 * Get shop images
 */
router.get('/:shopId/images',
  publicRateLimit,
  shopImageController.getShopImages
);

/**
 * DELETE /api/shops/:shopId/images/:imageId
 * Delete shop image
 */
router.delete('/:shopId/images/:imageId',
  deleteRateLimit,
  authenticateJWT(),
  shopImageController.deleteShopImage
);

/**
 * PUT /api/shops/:shopId/images/:imageId
 * Update shop image metadata
 */
router.put('/:shopId/images/:imageId',
  updateRateLimit,
  authenticateJWT(),
  validateRequestBody(updateShopImageSchema),
  shopImageController.updateShopImage
);

/**
 * POST /api/shops/:shopId/images/:imageId/set-primary
 * Set image as primary
 */
router.post('/:shopId/images/:imageId/set-primary',
  primaryRateLimit,
  authenticateJWT(),
  shopImageController.setPrimaryImage
);

export default router; 