/**
 * Service Image Routes
 *
 * API endpoints for service image management including:
 * - Upload service images
 * - Get service images
 * - Update image metadata (display order, alt text)
 * - Delete service images
 * - Set primary image
 */

import { Router } from 'express';
import multer from 'multer';
import { serviceImageController } from '../controllers/service-image.controller';
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
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Validation schemas
const uploadImageSchema = Joi.object({
  displayOrder: Joi.number().integer().min(0).optional(),
  altText: Joi.string().max(255).optional(),
  isPrimary: Joi.string().valid('true', 'false').optional()
});

const updateImageSchema = Joi.object({
  displayOrder: Joi.number().integer().min(0).optional(),
  altText: Joi.string().max(255).optional(),
  isPrimary: Joi.boolean().optional()
});

const reorderImagesSchema = Joi.object({
  imageIds: Joi.array().items(Joi.string().uuid()).min(1).required()
});

// Rate limiting
const uploadRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 uploads per 15 minutes
    strategy: 'fixed_window'
  }
});

const generalRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000,
    max: 100,
    strategy: 'fixed_window'
  }
});

// Apply authentication to all routes
router.use(authenticateJWT());

/**
 * POST /api/shop/services/:serviceId/images
 * Upload service image
 */
router.post('/:serviceId/images',
  uploadRateLimit,
  upload.single('image'),
  (req: any, res: any, next: any) => {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'NO_FILE_PROVIDED',
          message: '업로드할 이미지 파일을 선택해주세요.'
        }
      });
    }

    const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(req.file.mimetype)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_FILE_TYPE',
          message: 'JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.'
        }
      });
    }

    if (req.file.size > 5 * 1024 * 1024) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'FILE_TOO_LARGE',
          message: '이미지 파일 크기는 5MB 이하여야 합니다.'
        }
      });
    }

    next();
  },
  validateRequestBody(uploadImageSchema),
  serviceImageController.uploadServiceImage
);

/**
 * GET /api/shop/services/:serviceId/images
 * Get all images for a service
 */
router.get('/:serviceId/images',
  generalRateLimit,
  serviceImageController.getServiceImages
);

/**
 * PUT /api/shop/services/:serviceId/images/:imageId
 * Update image metadata
 */
router.put('/:serviceId/images/:imageId',
  generalRateLimit,
  validateRequestBody(updateImageSchema),
  serviceImageController.updateServiceImage
);

/**
 * DELETE /api/shop/services/:serviceId/images/:imageId
 * Delete service image
 */
router.delete('/:serviceId/images/:imageId',
  generalRateLimit,
  serviceImageController.deleteServiceImage
);

/**
 * POST /api/shop/services/:serviceId/images/:imageId/set-primary
 * Set image as primary
 */
router.post('/:serviceId/images/:imageId/set-primary',
  generalRateLimit,
  serviceImageController.setPrimaryImage
);

/**
 * PUT /api/shop/services/:serviceId/images/reorder
 * Reorder images
 */
router.put('/:serviceId/images/reorder',
  generalRateLimit,
  validateRequestBody(reorderImagesSchema),
  serviceImageController.reorderImages
);

export default router;
