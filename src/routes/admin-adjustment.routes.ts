/**
 * Admin Adjustment Routes
 * 
 * Routes for admin point adjustment system including:
 * - Point adjustment creation and management
 * - Approval workflow management
 * - Audit log viewing and filtering
 * - Adjustment statistics and reporting
 * - Multi-level authorization
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { adminAdjustmentController } from '../controllers/admin-adjustment.controller';
import { validateRequestBody, validateQueryParams } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const createAdjustmentSchema = Joi.object({
  userId: Joi.string()
    .uuid()
    .required()
    .messages({
      'string.guid': 'User ID must be a valid UUID',
      'any.required': 'User ID is required'
    }),
  amount: Joi.number()
    .integer()
    .min(1)
    .required()
    .messages({
      'number.base': 'Amount must be a number',
      'number.integer': 'Amount must be an integer',
      'number.min': 'Amount must be at least 1',
      'any.required': 'Amount is required'
    }),
  reason: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Reason cannot be empty',
      'string.max': 'Reason cannot exceed 500 characters',
      'any.required': 'Reason is required'
    }),
  adjustmentType: Joi.string()
    .valid('add', 'subtract', 'expire')
    .required()
    .messages({
      'any.only': 'Adjustment type must be add, subtract, or expire',
      'any.required': 'Adjustment type is required'
    }),
  category: Joi.string()
    .valid('customer_service', 'system_error', 'fraud_prevention', 'promotional', 'compensation', 'technical_issue', 'other')
    .required()
    .messages({
      'any.only': 'Invalid category',
      'any.required': 'Category is required'
    }),
  requiresApproval: Joi.boolean()
    .optional()
    .messages({
      'boolean.base': 'Requires approval must be a boolean'
    }),
  notes: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

const approveAdjustmentSchema = Joi.object({
  approverLevel: Joi.number()
    .integer()
    .min(1)
    .max(4)
    .required()
    .messages({
      'number.base': 'Approver level must be a number',
      'number.integer': 'Approver level must be an integer',
      'number.min': 'Approver level must be at least 1',
      'number.max': 'Approver level cannot exceed 4',
      'any.required': 'Approver level is required'
    }),
  notes: Joi.string()
    .max(1000)
    .optional()
    .messages({
      'string.max': 'Notes cannot exceed 1000 characters'
    })
});

const rejectAdjustmentSchema = Joi.object({
  reason: Joi.string()
    .min(1)
    .max(500)
    .required()
    .messages({
      'string.empty': 'Rejection reason cannot be empty',
      'string.max': 'Rejection reason cannot exceed 500 characters',
      'any.required': 'Rejection reason is required'
    })
});

const auditLogsQuerySchema = Joi.object({
  adminId: Joi.string()
    .uuid()
    .optional()
    .messages({
      'string.guid': 'Admin ID must be a valid UUID'
    }),
  actionType: Joi.string()
    .valid('user_suspended', 'shop_approved', 'shop_rejected', 'refund_processed', 'points_adjusted')
    .optional()
    .messages({
      'any.only': 'Invalid action type'
    }),
  targetType: Joi.string()
    .max(50)
    .optional()
    .messages({
      'string.max': 'Target type cannot exceed 50 characters'
    }),
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Start date must be in ISO format'
    }),
  endDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'End date must be in ISO format'
    }),
  reason: Joi.string()
    .max(200)
    .optional()
    .messages({
      'string.max': 'Reason filter cannot exceed 200 characters'
    }),
  page: Joi.number()
    .integer()
    .min(1)
    .optional()
    .messages({
      'number.base': 'Page must be a number',
      'number.integer': 'Page must be an integer',
      'number.min': 'Page must be at least 1'
    }),
  limit: Joi.number()
    .integer()
    .min(1)
    .max(100)
    .optional()
    .messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit cannot exceed 100'
    })
});

const adjustmentStatsQuerySchema = Joi.object({
  startDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'Start date must be in ISO format'
    }),
  endDate: Joi.date()
    .iso()
    .optional()
    .messages({
      'date.format': 'End date must be in ISO format'
    })
});

// Rate limiting configuration
const createAdjustmentLimiter = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // limit each IP to 10 requests per windowMs
    strategy: 'fixed_window',
    scope: 'ip'
  }
});

const approvalLimiter = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    strategy: 'fixed_window',
    scope: 'ip'
  }
});

const auditLogsLimiter = rateLimit({
  config: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 30, // limit each IP to 30 requests per windowMs
    strategy: 'fixed_window',
    scope: 'ip'
  }
});

// Point Adjustment Routes
router.post(
  '/admin/point-adjustments',
  authenticateJWT,
  createAdjustmentLimiter,
  validateRequestBody(createAdjustmentSchema),
  adminAdjustmentController.createAdjustment.bind(adminAdjustmentController)
);

router.post(
  '/admin/point-adjustments/:adjustmentId/approve',
  authenticateJWT,
  approvalLimiter,
  validateRequestBody(approveAdjustmentSchema),
  adminAdjustmentController.approveAdjustment.bind(adminAdjustmentController)
);

router.post(
  '/admin/point-adjustments/:adjustmentId/reject',
  authenticateJWT,
  approvalLimiter,
  validateRequestBody(rejectAdjustmentSchema),
  adminAdjustmentController.rejectAdjustment.bind(adminAdjustmentController)
);

router.get(
  '/admin/point-adjustments/:adjustmentId',
  authenticateJWT,
  adminAdjustmentController.getAdjustment.bind(adminAdjustmentController)
);

router.get(
  '/admin/point-adjustments/pending',
  authenticateJWT,
  adminAdjustmentController.getPendingAdjustments.bind(adminAdjustmentController)
);

router.get(
  '/admin/point-adjustments/stats',
  authenticateJWT,
  validateQueryParams(adjustmentStatsQuerySchema),
  adminAdjustmentController.getAdjustmentStats.bind(adminAdjustmentController)
);

router.get(
  '/admin/point-adjustments/user/:userId',
  authenticateJWT,
  adminAdjustmentController.getUserAdjustmentHistory.bind(adminAdjustmentController)
);

// Audit Log Routes
router.get(
  '/admin/audit-logs',
  authenticateJWT,
  auditLogsLimiter,
  validateQueryParams(auditLogsQuerySchema),
  adminAdjustmentController.getAuditLogs.bind(adminAdjustmentController)
);

router.get(
  '/admin/audit-logs/export',
  authenticateJWT,
  auditLogsLimiter,
  validateQueryParams(auditLogsQuerySchema),
  adminAdjustmentController.exportAuditLogs.bind(adminAdjustmentController)
);

export default router; 