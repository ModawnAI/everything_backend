/**
 * User Status Management Routes
 * 
 * Admin endpoints for user status management including:
 * - Status change operations
 * - Violation management
 * - Status history and statistics
 * - Bulk operations
 */

import { Router } from 'express';
import { UserStatusController } from '../controllers/user-status.controller';
import { validateRequestBody } from '../middleware/validation.middleware';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

// Validation schemas
import Joi from 'joi';

const router = Router();
const userStatusController = new UserStatusController();

// Validation schemas
const changeUserStatusSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': '유효한 사용자 ID가 필요합니다.',
    'any.required': '사용자 ID는 필수입니다.'
  }),
  newStatus: Joi.string().valid('active', 'inactive', 'suspended', 'deleted').required().messages({
    'any.only': '유효한 상태값이 필요합니다.',
    'any.required': '새로운 상태는 필수입니다.'
  }),
  reason: Joi.string().min(10).max(500).required().messages({
    'string.min': '사유는 최소 10자 이상이어야 합니다.',
    'string.max': '사유는 최대 500자까지 입력 가능합니다.',
    'any.required': '상태 변경 사유는 필수입니다.'
  }),
  effectiveDate: Joi.date().iso().optional().messages({
    'date.base': '유효한 날짜 형식이 필요합니다.'
  }),
  notes: Joi.string().max(1000).optional().messages({
    'string.max': '메모는 최대 1000자까지 입력 가능합니다.'
  })
});

const addUserViolationSchema = Joi.object({
  userId: Joi.string().uuid().required().messages({
    'string.uuid': '유효한 사용자 ID가 필요합니다.',
    'any.required': '사용자 ID는 필수입니다.'
  }),
  violationType: Joi.string().valid(
    'spam', 
    'inappropriate_content', 
    'fraud', 
    'harassment', 
    'terms_violation', 
    'payment_fraud'
  ).required().messages({
    'any.only': '유효한 위반 유형이 필요합니다.',
    'any.required': '위반 유형은 필수입니다.'
  }),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').required().messages({
    'any.only': '유효한 심각도가 필요합니다.',
    'any.required': '심각도는 필수입니다.'
  }),
  description: Joi.string().min(10).max(1000).required().messages({
    'string.min': '위반 내용은 최소 10자 이상이어야 합니다.',
    'string.max': '위반 내용은 최대 1000자까지 입력 가능합니다.',
    'any.required': '위반 내용은 필수입니다.'
  }),
  evidenceUrl: Joi.string().uri().optional().messages({
    'string.uri': '유효한 URL 형식이 필요합니다.'
  }),
  reportedBy: Joi.string().uuid().optional().messages({
    'string.uuid': '유효한 신고자 ID가 필요합니다.'
  })
});

const resolveViolationSchema = Joi.object({
  resolution: Joi.string().min(10).max(500).required().messages({
    'string.min': '해결 내용은 최소 10자 이상이어야 합니다.',
    'string.max': '해결 내용은 최대 500자까지 입력 가능합니다.',
    'any.required': '해결 내용은 필수입니다.'
  })
});

const bulkStatusChangeSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required().messages({
    'array.min': '최소 1명의 사용자가 필요합니다.',
    'array.max': '최대 100명까지 일괄 처리 가능합니다.',
    'any.required': '사용자 ID 목록은 필수입니다.'
  }),
  newStatus: Joi.string().valid('active', 'inactive', 'suspended', 'deleted').required().messages({
    'any.only': '유효한 상태값이 필요합니다.',
    'any.required': '새로운 상태는 필수입니다.'
  }),
  reason: Joi.string().min(10).max(500).required().messages({
    'string.min': '사유는 최소 10자 이상이어야 합니다.',
    'string.max': '사유는 최대 500자까지 입력 가능합니다.',
    'any.required': '상태 변경 사유는 필수입니다.'
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
router.use(adminRateLimit);

/**
 * PUT /api/admin/users/:userId/status
 * Change user status (Admin only)
 */
router.put(
  '/users/:userId/status',
  sensitiveRateLimit,
  validateRequestBody(changeUserStatusSchema),
  userStatusController.changeUserStatus
);

/**
 * GET /api/admin/users/:userId/status/history
 * Get user status change history
 */
router.get(
  '/users/:userId/status/history',
  userStatusController.getUserStatusHistory
);

/**
 * POST /api/admin/users/:userId/violations
 * Add user violation
 */
router.post(
  '/users/:userId/violations',
  sensitiveRateLimit,
  validateRequestBody(addUserViolationSchema),
  userStatusController.addUserViolation
);

/**
 * GET /api/admin/users/:userId/violations
 * Get user violations
 */
router.get(
  '/users/:userId/violations',
  userStatusController.getUserViolations
);

/**
 * PUT /api/admin/violations/:violationId/resolve
 * Resolve user violation
 */
router.put(
  '/violations/:violationId/resolve',
  sensitiveRateLimit,
  validateRequestBody(resolveViolationSchema),
  userStatusController.resolveViolation
);

/**
 * GET /api/admin/users/status/:status
 * Get users by status
 */
router.get(
  '/users/status/:status',
  userStatusController.getUsersByStatus
);

/**
 * POST /api/admin/users/bulk-status-change
 * Bulk status change operation
 */
router.post(
  '/users/bulk-status-change',
  sensitiveRateLimit,
  validateRequestBody(bulkStatusChangeSchema),
  userStatusController.bulkStatusChange
);

/**
 * GET /api/admin/users/status-stats
 * Get status change statistics
 */
router.get(
  '/users/status-stats',
  userStatusController.getStatusStats
);

// Error handling middleware
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('User status routes error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    userId: req.user?.id
  });

  if (error.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: '입력 데이터가 올바르지 않습니다.',
        details: error.details,
        timestamp: new Date().toISOString()
      }
    });
  }

  if (error.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: '인증이 필요합니다.',
        timestamp: new Date().toISOString()
      }
    });
  }

  if (error.name === 'ForbiddenError') {
    return res.status(403).json({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: '관리자 권한이 필요합니다.',
        timestamp: new Date().toISOString()
      }
    });
  }

  // Default error response
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '서버 오류가 발생했습니다.',
      timestamp: new Date().toISOString()
    }
  });
});

export default router; 