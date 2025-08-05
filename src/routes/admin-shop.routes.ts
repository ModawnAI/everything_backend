/**
 * Admin Shop Routes
 * 
 * Admin endpoints for shop verification and management including:
 * - Pending shop approval workflow
 * - Shop verification status management
 * - Verification history and audit trails
 * - Shop verification statistics
 */

import { Router } from 'express';
import { adminShopController } from '../controllers/admin-shop.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();

// Validation schemas
const approveShopSchema = Joi.object({
  approved: Joi.boolean().required().messages({
    'boolean.base': '승인 여부는 true 또는 false여야 합니다.',
    'any.required': '승인 여부는 필수입니다.'
  }),
  shopType: Joi.string().valid('partnered', 'non_partnered').optional().messages({
    'any.only': '샵 타입은 partnered 또는 non_partnered여야 합니다.'
  }),
  commissionRate: Joi.number().min(0).max(100).optional().messages({
    'number.base': '수수료율은 숫자여야 합니다.',
    'number.min': '수수료율은 0 이상이어야 합니다.',
    'number.max': '수수료율은 100 이하여야 합니다.'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': '메모는 최대 1000자까지 입력 가능합니다.'
  })
});

// Rate limiting configuration
const adminRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    strategy: 'fixed_window',
    scope: 'user'
  },
  onLimitReached: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '요청이 너무 많습니다. 15분 후에 다시 시도해주세요.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

const sensitiveRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    strategy: 'fixed_window',
    scope: 'user'
  },
  onLimitReached: (req, res) => {
    res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMIT_EXCEEDED',
        message: '민감한 작업의 요청이 너무 많습니다. 15분 후에 다시 시도해주세요.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

// Middleware for all routes
router.use(authenticateJWT);
router.use(requireAdmin());

/**
 * GET /api/admin/shops/pending
 * Get list of shops pending verification (Admin only)
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search term for shop name, description, or address
 * - category: Filter by service category
 * - sortBy: Sort field (created_at, name, main_category)
 * - sortOrder: Sort order (asc, desc)
 */
router.get(
  '/pending',
  adminRateLimit,
  adminShopController.getPendingShops
);

/**
 * PUT /api/admin/shops/:shopId/approve
 * Approve or reject a shop (Admin only)
 * 
 * Request body:
 * {
 *   "approved": true,
 *   "shopType": "partnered",
 *   "commissionRate": 10.0,
 *   "notes": "승인 완료"
 * }
 */
router.put(
  '/:shopId/approve',
  sensitiveRateLimit,
  validateRequestBody(approveShopSchema),
  adminShopController.approveShop
);

/**
 * GET /api/admin/shops/:shopId/verification-history
 * Get shop verification history (Admin only)
 * 
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 */
router.get(
  '/:shopId/verification-history',
  adminRateLimit,
  adminShopController.getShopVerificationHistory
);

/**
 * GET /api/admin/shops/verification-stats
 * Get shop verification statistics (Admin only)
 * 
 * Returns:
 * - Overall verification status counts
 * - Recent verification activity (last 30 days)
 */
router.get(
  '/verification-stats',
  adminRateLimit,
  adminShopController.getVerificationStats
);

/**
 * GET /api/admin/shops/:shopId/verification-requirements
 * Check if shop meets verification requirements (Admin only)
 * 
 * Returns:
 * - Whether shop meets all requirements
 * - List of missing requirements
 * - Recommendations for completion
 */
router.get(
  '/:shopId/verification-requirements',
  adminRateLimit,
  adminShopController.checkVerificationRequirements
);

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Admin shop routes error:', { error });
  
  if (error.isJoi) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 유효하지 않습니다.',
        details: error.details.map((detail: any) => detail.message)
      }
    });
    return;
  }

  res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export { router as adminShopRoutes }; 