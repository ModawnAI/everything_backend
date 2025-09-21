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
router.post('/revoke-all-others',
  authenticateToken,
  userSessionsController.sessionManagementRateLimit,
  validateRequestBody(revokeAllOtherSessionsSchema),
  userSessionsController.revokeAllOtherSessions
);

export default router;
