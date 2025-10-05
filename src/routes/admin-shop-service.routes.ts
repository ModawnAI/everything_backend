/**
 * Admin Shop Service Routes
 *
 * API endpoints for admin shop service management including:
 * - Service CRUD operations for any shop
 * - Service listing with filtering and pagination
 * - Service availability management
 * - Cross-shop service management
 */

import { Router } from 'express';
import { adminShopServiceController } from '../controllers/admin-shop-service.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import {
  validateCreateService,
  validateUpdateService,
  validateServiceListQuery,
  validateServiceId
} from '../validators/shop-service.validators';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Shop ID validation schema
const shopIdSchema = Joi.object({
  shopId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': '유효하지 않은 샵 ID입니다.',
      'any.required': '샵 ID는 필수입니다.'
    })
});

// Service ID validation for admin routes (includes shopId)
const adminServiceIdSchema = Joi.object({
  shopId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': '유효하지 않은 샵 ID입니다.',
      'any.required': '샵 ID는 필수입니다.'
    }),
  serviceId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': '유효하지 않은 서비스 ID입니다.',
      'any.required': '서비스 ID는 필수입니다.'
    })
});

// Validation middleware for shop ID
const validateShopId = (req: any, res: any, next: any) => {
  const { error, value } = shopIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '샵 ID가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.params = { ...req.params, ...value };
  next();
};

// Validation middleware for admin service operations
const validateAdminServiceId = (req: any, res: any, next: any) => {
  const { error, value } = adminServiceIdSchema.validate(req.params, {
    abortEarly: false,
    stripUnknown: true
  });

  if (error) {
    const validationErrors = error.details.map(detail => ({
      field: detail.path.join('.'),
      message: detail.message
    }));

    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '파라미터가 유효하지 않습니다.',
        details: validationErrors
      }
    });
  }

  req.params = { ...req.params, ...value };
  next();
};

// Rate limiting for admin service operations
const adminServiceRateLimit = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // higher limit for admins
    strategy: 'fixed_window'
  }
});

const adminServiceUpdateRateLimit = rateLimit({
  config: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    max: 50, // higher limit for admin updates
    strategy: 'fixed_window'
  }
});

// Apply authentication and admin authorization to all routes
router.use(authenticateJWT);
router.use(requireAdmin);

/**
 * @route GET /api/admin/shops/:shopId/services
 * @desc Get all services for a specific shop
 * @access Admin
 */
router.get('/:shopId/services',
  adminServiceRateLimit,
  validateShopId,
  validateServiceListQuery,
  async (req, res) => {
    try {
      await adminShopServiceController.getShopServices(req as any, res);
    } catch (error) {
      logger.error('Error in admin shop services GET route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        shopId: req.params.shopId,
        query: req.query,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 목록 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @route POST /api/admin/shops/:shopId/services
 * @desc Create a new service for a shop
 * @access Admin
 */
router.post('/:shopId/services',
  adminServiceUpdateRateLimit,
  validateShopId,
  validateCreateService,
  async (req, res) => {
    try {
      await adminShopServiceController.createShopService(req as any, res);
    } catch (error) {
      logger.error('Error in admin shop services POST route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        shopId: req.params.shopId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 생성 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @route GET /api/admin/shops/:shopId/services/:serviceId
 * @desc Get a specific service by ID
 * @access Admin
 */
router.get('/:shopId/services/:serviceId',
  adminServiceRateLimit,
  validateAdminServiceId,
  async (req, res) => {
    try {
      await adminShopServiceController.getShopServiceById(req as any, res);
    } catch (error) {
      logger.error('Error in admin shop service GET by ID route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @route PUT /api/admin/shops/:shopId/services/:serviceId
 * @desc Update a shop service
 * @access Admin
 */
router.put('/:shopId/services/:serviceId',
  adminServiceUpdateRateLimit,
  validateAdminServiceId,
  validateUpdateService,
  async (req, res) => {
    try {
      await adminShopServiceController.updateShopService(req as any, res);
    } catch (error) {
      logger.error('Error in admin shop service PUT route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId,
        body: req.body,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @route DELETE /api/admin/shops/:shopId/services/:serviceId
 * @desc Delete a shop service
 * @access Admin
 */
router.delete('/:shopId/services/:serviceId',
  adminServiceUpdateRateLimit,
  validateAdminServiceId,
  async (req, res) => {
    try {
      await adminShopServiceController.deleteShopService(req as any, res);
    } catch (error) {
      logger.error('Error in admin shop service DELETE route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId: (req as any).user?.id,
        shopId: req.params.shopId,
        serviceId: req.params.serviceId,
        userAgent: req.get('User-Agent'),
        ip: req.ip
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '서비스 삭제 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for admin shop service routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in admin shop service routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    url: req.url,
    method: req.method,
    adminId: req.user?.id
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서비스 관련 요청 처리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
