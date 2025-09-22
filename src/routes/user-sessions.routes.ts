import { Router } from 'express';
import { userSessionsController } from '../controllers/user-sessions.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const revokeSessionSchema = Joi.object({
  reason: Joi.string().default('user_requested')
});

const revokeAllOtherSessionsSchema = Joi.object({
  reason: Joi.string().default('user_requested_logout_others')
});

/**
 * @route GET /api/user/sessions
 * @desc Get all active sessions for the authenticated user
 * @access Private
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: GET /
 *     description: GET endpoint for /
 *     tags: [Users]
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
router.get('/',
  authenticateToken,
  userSessionsController.sessionManagementRateLimit,
  userSessionsController.getActiveSessions
);

/**
 * @route GET /api/user/sessions/analytics
 * @desc Get session analytics for the authenticated user
 * @access Private
 */
router.get('/analytics',
  authenticateToken,
  userSessionsController.sessionManagementRateLimit,
  userSessionsController.getSessionAnalytics
);

/**
 * @route DELETE /api/user/sessions/:sessionId
 * @desc Revoke a specific session
 * @access Private
 */
router.delete('/:sessionId',
  authenticateToken,
  userSessionsController.sessionManagementRateLimit,
  validateRequestBody(revokeSessionSchema),
  userSessionsController.revokeSession
);

/**
 * @route POST /api/user/sessions/revoke-all-others
 * @desc Revoke all other sessions (keep current session active)
 * @access Private
 */

/**
 * @swagger
 * /revoke-all-others:
 *   post:
 *     summary: POST /revoke-all-others
 *     description: POST endpoint for /revoke-all-others
 *     tags: [Users]
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
router.post('/revoke-all-others',
  authenticateToken,
  userSessionsController.sessionManagementRateLimit,
  validateRequestBody(revokeAllOtherSessionsSchema),
  userSessionsController.revokeAllOtherSessions
);

export default router;
