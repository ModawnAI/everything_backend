/**
 * Storage Routes
 * 
 * API endpoints for storage management including:
 * - File upload and management
 * - Storage cleanup operations
 * - Storage statistics and monitoring
 */

import { Router } from 'express';
import multer from 'multer';
import { storageController } from '../controllers/storage.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();

// Validation schemas
const uploadFileSchema = Joi.object({
  bucketId: Joi.string().required().messages({
    'string.empty': '저장소 ID는 필수입니다.',
    'any.required': '저장소 ID는 필수입니다.'
  }),
  filePath: Joi.string().optional(),
  optimizeImage: Joi.boolean().optional(),
  imageOptions: Joi.object({
    width: Joi.number().min(1).max(4000).optional(),
    height: Joi.number().min(1).max(4000).optional(),
    quality: Joi.number().min(1).max(100).optional(),
    format: Joi.string().valid('jpeg', 'png', 'webp').optional()
  }).optional()
});

const cleanupSchema = Joi.object({
  dryRun: Joi.boolean().optional()
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB (larger for business documents)
    files: 1
  },
  fileFilter: (req, file, cb) => {
    // Check file type based on bucket
    const bucketId = req.body.bucketId;
    const allowedTypes = {
      'profile-images': ['image/jpeg', 'image/png', 'image/webp'],
      'shop-images': ['image/jpeg', 'image/png', 'image/webp'],
      'service-images': ['image/jpeg', 'image/png', 'image/webp'],
      'business-documents': ['application/pdf', 'image/jpeg', 'image/png'],
      'popup-images': ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
      'banners': ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    };

    const bucketAllowedTypes = allowedTypes[bucketId as keyof typeof allowedTypes] || ['image/jpeg', 'image/png', 'image/webp'];
    
    if (bucketAllowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`지원하지 않는 파일 형식입니다. 허용된 형식: ${bucketAllowedTypes.join(', ')}`));
    }
  }
});

// Rate limiting configuration
const storageRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 50, // 50 requests per window
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
});

const adminRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: '너무 많은 요청이 발생했습니다. 잠시 후 다시 시도해주세요.'
  }
});

// Middleware for all routes
router.use(authenticateJWT());

/**
 * POST /api/storage/upload
 * Upload file to storage
 */
router.post(
  '/upload',
  storageRateLimit,
  upload.single('file'),
  validateRequestBody(uploadFileSchema),
  (req, res) => storageController.uploadFile(req as any, res)
);

/**
 * DELETE /api/storage/files/:bucketId/:filePath
 * Delete file from storage
 */
router.delete(
  '/files/:bucketId/:filePath',
  storageRateLimit,
  storageController.deleteFile
);

/**
 * GET /api/storage/files/:bucketId
 * List files in bucket
 */
router.get(
  '/files/:bucketId',
  storageRateLimit,
  storageController.listFiles
);

/**
 * POST /api/storage/cleanup
 * Clean up orphaned files (Admin only)
 */
router.post(
  '/cleanup',
  adminRateLimit,
  validateRequestBody(cleanupSchema),
  storageController.cleanupOrphanedFiles
);

/**
 * GET /api/storage/stats
 * Get storage statistics (Admin only)
 */
router.get(
  '/stats',
  adminRateLimit,
  storageController.getStorageStats
);

/**
 * POST /api/storage/initialize
 * Initialize storage buckets and policies (Admin only)
 */
router.post(
  '/initialize',
  adminRateLimit,
  storageController.initializeStorage
);

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
  if (error instanceof multer.MulterError) {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: {
          code: 'FILE_TOO_LARGE',
          message: '파일 크기가 너무 큽니다.',
          details: '최대 20MB까지 업로드 가능합니다.'
        }
      });
    }
    return res.status(400).json({
      error: {
        code: 'UPLOAD_ERROR',
        message: '파일 업로드 중 오류가 발생했습니다.',
        details: error.message
      }
    });
  }

  if (error.message && error.message.includes('지원하지 않는 파일 형식')) {
    return res.status(400).json({
      error: {
        code: 'INVALID_FILE_TYPE',
        message: '지원하지 않는 파일 형식입니다.',
        details: error.message
      }
    });
  }

  logger.error('Storage routes error:', { error });
  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export { router as storageRoutes }; 