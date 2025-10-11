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
import adminShopServiceRoutes from './admin-shop-service.routes';

// Validation schemas
import Joi from 'joi';

const router = Router();

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
  }),
  business_license_image_url: Joi.string().uri().optional().messages({
    'string.uri': '사업자등록증 이미지 URL 형식이 올바르지 않습니다.'
  }),
  // Admin-specific fields
  owner_id: Joi.string().uuid().optional().messages({
    'string.guid': '유효하지 않은 오너 ID입니다.'
  }),
  shop_status: Joi.string().valid('active', 'inactive', 'pending_approval', 'suspended', 'deleted').optional().messages({
    'any.only': '유효하지 않은 샵 상태입니다.'
  }),
  verification_status: Joi.string().valid('pending', 'verified', 'rejected').optional().messages({
    'any.only': '유효하지 않은 검증 상태입니다.'
  }),
  shop_type: Joi.string().valid('partnered', 'non_partnered').optional().messages({
    'any.only': '샵 타입은 partnered 또는 non_partnered여야 합니다.'
  }),
  commission_rate: Joi.number().min(0).max(100).optional().messages({
    'number.base': '수수료율은 숫자여야 합니다.',
    'number.min': '수수료율은 0 이상이어야 합니다.',
    'number.max': '수수료율은 100 이하여야 합니다.'
  }),
  is_featured: Joi.boolean().optional().messages({
    'boolean.base': '추천 샵 여부는 true 또는 false여야 합니다.'
  })
});

const updateShopSchema = Joi.object({
  name: Joi.string().min(1).max(255).optional().messages({
    'string.empty': '샵명은 비어있을 수 없습니다.',
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
    'string.empty': '주소는 비어있을 수 없습니다.'
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
  }),
  business_license_image_url: Joi.string().uri().optional().messages({
    'string.uri': '사업자등록증 이미지 URL 형식이 올바르지 않습니다.'
  }),
  // Admin-specific fields
  owner_id: Joi.string().uuid().optional().messages({
    'string.guid': '유효하지 않은 오너 ID입니다.'
  }),
  shop_status: Joi.string().valid('active', 'inactive', 'pending_approval', 'suspended', 'deleted').optional().messages({
    'any.only': '유효하지 않은 샵 상태입니다.'
  }),
  verification_status: Joi.string().valid('pending', 'verified', 'rejected').optional().messages({
    'any.only': '유효하지 않은 검증 상태입니다.'
  }),
  shop_type: Joi.string().valid('partnered', 'non_partnered').optional().messages({
    'any.only': '샵 타입은 partnered 또는 non_partnered여야 합니다.'
  }),
  commission_rate: Joi.number().min(0).max(100).optional().messages({
    'number.base': '수수료율은 숫자여야 합니다.',
    'number.min': '수수료율은 0 이상이어야 합니다.',
    'number.max': '수수료율은 100 이하여야 합니다.'
  }),
  is_featured: Joi.boolean().optional().messages({
    'boolean.base': '추천 샵 여부는 true 또는 false여야 합니다.'
  })
});

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
router.use(authenticateJWT());
router.use(requireAdmin());

// Mount shop services routes BEFORE other routes to ensure proper matching
// This must come before /:shopId routes to prevent path conflicts
router.use('/:shopId/services', adminShopServiceRoutes);

/**
 * POST /api/admin/shops
 * Create a new shop (Admin only)
 */
router.post(
  '/',
  sensitiveRateLimit,
  validateRequestBody(createShopSchema),
  adminShopController.createShop
);

/**
 * GET /api/admin/shops
 * Get all shops with filtering and pagination (Admin only)
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - status: Filter by shop status (active, inactive, suspended, deleted)
 * - category: Filter by service category
 * - shopType: Filter by shop type (partnered, non_partnered)
 * - verificationStatus: Filter by verification status (pending, verified, rejected)
 * - sortBy: Sort field (created_at, name, main_category, shop_status, verification_status)
 * - sortOrder: Sort order (asc, desc)
 */
router.get(
  '/',
  adminRateLimit,
  adminShopController.getAllShops
);

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
 * GET /api/admin/shops/search
 * Search all shops (Admin only)
 *
 * Query parameters:
 * - page: Page number (default: 1)
 * - limit: Items per page (default: 20, max: 100)
 * - search: Search term for shop name, description, or address
 * - category: Filter by service category
 * - verificationStatus: Filter by verification status (pending, verified, rejected)
 * - shopStatus: Filter by shop status (active, inactive, suspended)
 * - sortBy: Sort field (created_at, name, main_category)
 * - sortOrder: Sort order (asc, desc)
 */
router.post(
  '/search',
  adminRateLimit,
  adminShopController.searchShops
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

/**
 * GET /api/admin/shops/:shopId/analytics
 * Get shop analytics data (Admin only)
 *
 * Query parameters:
 * - period: Time period for analytics (7d, 30d, 90d) - default: 30d
 *
 * Returns:
 * - Shop information
 * - Services statistics
 * - Booking analytics
 * - Customer metrics
 * - Performance data
 */
router.get(
  '/:shopId/analytics',
  adminRateLimit,
  adminShopController.getShopAnalytics
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
 * GET /api/admin/shops/:shopId
 * Get detailed shop information by ID (Admin only)
 *
 * Returns complete shop details including:
 * - Basic shop information
 * - Operating hours
 * - Services
 * - Images
 * - Owner information
 * - Verification status
 */
router.get(
  '/:shopId',
  adminRateLimit,
  adminShopController.getShopById
);

/**
 * PUT /api/admin/shops/:shopId
 * Update shop information (Admin only)
 */
router.put(
  '/:shopId',
  sensitiveRateLimit,
  validateRequestBody(updateShopSchema),
  adminShopController.updateShop
);

/**
 * DELETE /api/admin/shops/:shopId
 * Delete shop (Admin only, supports soft and hard delete)
 *
 * Query parameters:
 * - permanent: Set to 'true' for hard delete, defaults to 'false' (soft delete)
 */
router.delete(
  '/:shopId',
  sensitiveRateLimit,
  adminShopController.deleteShop
);

// Data integrity management routes
router.get(
  '/data-integrity/status',
  adminRateLimit,
  adminShopController.getDataIntegrityStatus
);

router.post(
  '/data-integrity/validate',
  adminRateLimit,
  adminShopController.validateDataIntegrity
);

router.post(
  '/data-integrity/cleanup',
  sensitiveRateLimit, // More restrictive rate limit for cleanup operations
  adminShopController.cleanupOrphanedData
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