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

/**
 * @swagger
 * /users/:userId/invalidate-sessions:
 *   post:
 *     summary: POST /users/:userId/invalidate-sessions (POST /users/:userId/invalidate-sessions)
 *     description: POST endpoint for /users/:userId/invalidate-sessions
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
 *       
 *       ---
 *       
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
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
/**
 * @swagger
 * /users/:userId/sessions:
 *   get:
 *     summary: /users/:userId/sessions 조회
 *     description: GET endpoint for /users/:userId/sessions
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
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
/**
 * @swagger
 * /bulk-invalidate-sessions:
 *   post:
 *     summary: POST /bulk-invalidate-sessions (POST /bulk-invalidate-sessions)
 *     description: POST endpoint for /bulk-invalidate-sessions
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
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

/**
 * @swagger
 * /events:
 *   get:
 *     summary: /events 조회
 *     description: GET endpoint for /events
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
 *       
 *       ---
 *       
 *     tags: [Admin - Users]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 *       401:
 *         description: Authentication required
 */
router.get('/events',
  authenticateToken,
  requireAdminRole,
  adminSecurityController.adminSecurityRateLimit,
  validateRequestQuery(getSecurityEventsSchema),
  adminSecurityController.getSecurityEvents
);

export default router;
