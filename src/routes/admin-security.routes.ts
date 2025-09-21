import { Router } from 'express';
import { adminSecurityController } from '../controllers/admin-security.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminRole } from '../middleware/admin-auth.middleware';
import { validateRequestBody, validateRequestQuery } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const forceInvalidateSessionsSchema = Joi.object({
  reason: Joi.string().optional(),
  keepCurrentSession: Joi.boolean().default(false),
  eventType: Joi.string().valid('admin_action', 'account_compromise', 'suspicious_activity', 'token_theft_detected').default('admin_action')
});

const bulkInvalidateSessionsSchema = Joi.object({
  userIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required(),
  reason: Joi.string().optional(),
  eventType: Joi.string().valid('admin_action', 'account_compromise', 'suspicious_activity', 'token_theft_detected').default('admin_action')
});

const getSecurityEventsSchema = Joi.object({
  userId: Joi.string().uuid().optional(),
  eventType: Joi.string().optional(),
  severity: Joi.string().valid('low', 'medium', 'high', 'critical').optional(),
  limit: Joi.number().integer().min(1).max(100).optional(),
  offset: Joi.number().integer().min(0).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional()
});

/**
 * @route POST /api/admin/security/users/:userId/invalidate-sessions
 * @desc Force invalidate all sessions for a specific user
 * @access Admin
 */
router.post('/users/:userId/invalidate-sessions',
  authenticateToken,
  requireAdminRole,
  adminSecurityController.adminSecurityRateLimit,
  validateRequestBody(forceInvalidateSessionsSchema),
  adminSecurityController.forceInvalidateUserSessions
);

/**
 * @route GET /api/admin/security/users/:userId/sessions
 * @desc Get user session information for admin review
 * @access Admin
 */
router.get('/users/:userId/sessions',
  authenticateToken,
  requireAdminRole,
  adminSecurityController.adminSecurityRateLimit,
  adminSecurityController.getUserSessionInfo
);

/**
 * @route POST /api/admin/security/bulk-invalidate-sessions
 * @desc Bulk invalidate sessions for multiple users
 * @access Admin
 */
router.post('/bulk-invalidate-sessions',
  authenticateToken,
  requireAdminRole,
  adminSecurityController.adminSecurityRateLimit,
  validateRequestBody(bulkInvalidateSessionsSchema),
  adminSecurityController.bulkInvalidateSessions
);

/**
 * @route GET /api/admin/security/events
 * @desc Get security events related to session invalidation
 * @access Admin
 */
router.get('/events',
  authenticateToken,
  requireAdminRole,
  adminSecurityController.adminSecurityRateLimit,
  validateRequestQuery(getSecurityEventsSchema),
  adminSecurityController.getSecurityEvents
);

export default router;
