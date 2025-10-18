/**
 * Unified Authentication Routes
 * REST API endpoints for unified authentication system
 */

import { Router } from 'express';
import { unifiedAuthController } from '../controllers/unified-auth.controller';
import {
  authenticate,
  rateLimitLogin
} from '../middleware/unified-auth.middleware';
import { body, validationResult } from 'express-validator';

const router = Router();

/**
 * Validation middleware
 */
const validate = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        details: errors.array()
      }
    });
  }
  next();
};

/**
 * POST /api/auth/login
 * Login endpoint for all user roles (admin, shop_owner, customer)
 *
 * @body {string} email - User email
 * @body {string} password - User password
 * @body {string} role - User role (admin, shop_owner, customer)
 * @body {string} [device_id] - Optional device identifier
 * @body {string} [device_name] - Optional device name
 *
 * @returns {LoginResponse} Access token, refresh token, user info
 */
router.post(
  '/login',
  rateLimitLogin(5, 15 * 60 * 1000), // 5 attempts per 15 minutes
  [
    body('email').isEmail().normalizeEmail().withMessage('Valid email is required'),
    body('password').isString().isLength({ min: 1 }).withMessage('Password is required'),
    body('role').isIn(['admin', 'shop_owner', 'customer']).withMessage('Valid role is required'),
    body('device_id').optional().isString(),
    body('device_name').optional().isString(),
    validate
  ],
  unifiedAuthController.login
);

/**
 * POST /api/auth/logout
 * Logout from current session
 *
 * @header {string} Authorization - Bearer token
 * @body {string} [reason] - Optional logout reason
 *
 * @returns {Object} Success message
 */
router.post(
  '/logout',
  authenticate,
  [
    body('reason').optional().isString(),
    validate
  ],
  unifiedAuthController.logout
);

/**
 * POST /api/auth/logout-all
 * Logout from all devices
 *
 * @header {string} Authorization - Bearer token
 * @body {string} [reason] - Optional logout reason
 *
 * @returns {Object} Success message with count of sessions revoked
 */
router.post(
  '/logout-all',
  authenticate,
  [
    body('reason').optional().isString(),
    validate
  ],
  unifiedAuthController.logoutAll
);

/**
 * POST /api/auth/refresh
 * Refresh access token using refresh token
 *
 * @body {string} refreshToken - Refresh token
 *
 * @returns {Object} New access token and expiration
 */
router.post(
  '/refresh',
  [
    body('refreshToken').isString().notEmpty().withMessage('Refresh token is required'),
    validate
  ],
  unifiedAuthController.refreshToken
);

/**
 * GET /api/auth/validate
 * Validate current session
 *
 * @header {string} Authorization - Bearer token
 *
 * @returns {Object} Session validation result
 */
router.get(
  '/validate',
  unifiedAuthController.validateSession
);

/**
 * GET /api/auth/sessions
 * Get user's active sessions
 *
 * @header {string} Authorization - Bearer token
 *
 * @returns {Object} List of active sessions
 */
router.get(
  '/sessions',
  authenticate,
  unifiedAuthController.getSessions
);

/**
 * POST /api/auth/change-password
 * Change user password
 *
 * @header {string} Authorization - Bearer token
 * @body {string} currentPassword - Current password
 * @body {string} newPassword - New password (min 8 characters)
 *
 * @returns {Object} Success message
 */
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').isString().notEmpty().withMessage('Current password is required'),
    body('newPassword')
      .isString()
      .isLength({ min: 8 })
      .withMessage('New password must be at least 8 characters long'),
    validate
  ],
  unifiedAuthController.changePassword
);

/**
 * GET /api/auth/login-statistics
 * Get login statistics for current user
 *
 * @header {string} Authorization - Bearer token
 *
 * @returns {Object} Login attempt statistics
 */
router.get(
  '/login-statistics',
  authenticate,
  unifiedAuthController.getLoginStatistics
);

/**
 * GET /api/auth/security-logs
 * Get security logs for current user
 *
 * @header {string} Authorization - Bearer token
 * @query {number} [limit=50] - Number of logs to retrieve
 *
 * @returns {Object} Security event logs
 */
router.get(
  '/security-logs',
  authenticate,
  unifiedAuthController.getSecurityLogs
);

export default router;
