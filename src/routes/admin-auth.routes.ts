import { Router } from 'express';
import { adminAuthController } from '../controllers/admin-auth.controller';
import { logger } from '../utils/logger';

const router = Router();

// Debug middleware for all admin auth routes
router.use((req, res, next) => {
  logger.info('Admin auth router reached', {
    method: req.method,
    path: req.path,
    fullUrl: req.url,
    body: req.body
  });
  next();
});

/**
 * Admin Authentication Routes
 * 
 * Enhanced security features for admin access:
 * - IP whitelist validation
 * - Longer session expiry (24 hours)
 * - Failed login attempt tracking
 * - Account locking after multiple failures
 * - Session management with refresh tokens
 * - Comprehensive audit logging
 */

/**
 * POST /api/admin/auth/login
 * Admin login with enhanced security
 * 
 * Request Body:
 * {
 *   "email": "admin@example.com",
 *   "password": "securepassword",
 *   "deviceId": "optional-device-identifier"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "admin": {
 *       "id": "uuid",
 *       "email": "admin@example.com",
 *       "name": "Admin Name",
 *       "role": "admin",
 *       "permissions": ["user_management", "shop_approval", ...]
 *     },
 *     "session": {
 *       "token": "jwt-access-token",
 *       "expiresAt": "2024-01-01T12:00:00Z",
 *       "refreshToken": "jwt-refresh-token"
 *     },
 *     "security": {
 *       "requiresTwoFactor": false,
 *       "lastLoginAt": "2024-01-01T10:00:00Z",
 *       "loginLocation": "Seoul, South Korea"
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - IP whitelist validation
 * - Failed login attempt tracking (locks after 5 attempts)
 * - Account status validation
 * - Session creation with device tracking
 * - Comprehensive audit logging
 */

/**
 * @swagger
 * /api/admin/auth/login:
 *   post:
 *     summary: Admin login
 *     description: |
 *       Authenticate admin users with enhanced security features including:
 *       - IP whitelist validation
 *       - Failed login attempt tracking (locks after 5 attempts)
 *       - Session creation with device tracking
 *       - Comprehensive audit logging
 *     tags:
 *       - Admin Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Admin email address
 *                 example: admin@ebeautything.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Admin password
 *                 example: AdminPassword123!
 *               deviceId:
 *                 type: string
 *                 description: Optional device identifier for session tracking
 *                 example: device-12345
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                           format: email
 *                         name:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [admin]
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           description: JWT access token
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         refreshToken:
 *                           type: string
 *                           description: JWT refresh token
 *                     security:
 *                       type: object
 *                       properties:
 *                         requiresTwoFactor:
 *                           type: boolean
 *                         lastLoginAt:
 *                           type: string
 *                           format: date-time
 *                         loginLocation:
 *                           type: string
 *       400:
 *         description: Bad Request - Invalid input
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: INVALID_CREDENTIALS
 *                     message:
 *                       type: string
 *                       example: Invalid email or password
 *       401:
 *         description: Authentication failed
 *       403:
 *         description: Account locked or IP not whitelisted
 *       500:
 *         description: Internal server error
 */
/**
 * GET /api/admin/auth/csrf
 * Get CSRF token for admin forms
 */
router.get('/csrf', (req, res) => {
  res.json({
    success: true,
    data: {
      csrfToken: 'dev-csrf-token-' + Date.now()
    }
  });
});

router.post('/login', (req, res) => adminAuthController.adminLogin(req, res));

/**
 * @swagger
 * /api/admin/auth/refresh:
 *   post:
 *     summary: Refresh admin session token
 *     description: |
 *       Refresh admin access token using refresh token
 *       - Validates refresh token
 *       - Creates new session and revokes old one
 *       - IP address tracking
 *       - Session activity logging
 *     tags:
 *       - Admin Authentication
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: JWT refresh token
 *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
 *     responses:
 *       200:
 *         description: Token refreshed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         token:
 *                           type: string
 *                           description: New JWT access token
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         refreshToken:
 *                           type: string
 *                           description: New JWT refresh token
 *       401:
 *         description: Invalid or expired refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', (req, res) => adminAuthController.refreshSession(req, res));

/**
 * POST /api/admin/auth/logout
 * Admin logout and session revocation
 * 
 * Headers:
 * Authorization: Bearer <jwt-access-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Successfully logged out"
 * }
 * 
 * Security Features:
 * - Revokes active session
 * - Logs logout action
 * - Clears session data
 */

/**
 * @swagger
 * /api/admin/auth/logout:
 *   post:
 *     summary: Admin logout
 *     description: |
 *       Logout admin user and revoke session
 *       - Revokes active session
 *       - Logs logout action
 *       - Clears session data
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Successfully logged out
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/logout', (req, res) => adminAuthController.adminLogout(req, res));

/**
 * GET /api/admin/auth/validate
 * Validate admin session
 * 
 * Headers:
 * Authorization: Bearer <jwt-access-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "admin": {
 *       "id": "uuid",
 *       "email": "admin@example.com",
 *       "role": "admin",
 *       "permissions": ["user_management", "shop_approval", ...]
 *     },
 *     "session": {
 *       "id": "session-uuid",
 *       "expiresAt": "2024-01-01T12:00:00Z",
 *       "lastActivityAt": "2024-01-01T11:30:00Z"
 *     }
 *   }
 * }
 * 
 * Security Features:
 * - Validates JWT token
 * - Checks session status in database
 * - Validates admin user status
 * - Updates session activity timestamp
 * - IP address validation (logs mismatches)
 */

/**
 * @swagger
 * /api/admin/auth/validate:
 *   get:
 *     summary: Validate admin session
 *     description: |
 *       Validate admin JWT token and session
 *       - Validates JWT token
 *       - Checks session status in database
 *       - Validates admin user status
 *       - Updates session activity timestamp
 *       - IP address validation (logs mismatches)
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Session is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     admin:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [admin]
 *                         permissions:
 *                           type: array
 *                           items:
 *                             type: string
 *                     session:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         expiresAt:
 *                           type: string
 *                           format: date-time
 *                         lastActivityAt:
 *                           type: string
 *                           format: date-time
 *       401:
 *         description: Invalid or expired session
 *       500:
 *         description: Internal server error
 */
router.get('/validate', (req, res) => adminAuthController.validateSession(req, res));

/**
 * @swagger
 * /api/admin/auth/profile:
 *   get:
 *     summary: Get admin profile
 *     description: |
 *       Get current admin profile information
 *       - Requires valid admin session
 *       - Returns comprehensive profile data
 *       - Includes security-related information
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     email:
 *                       type: string
 *                       format: email
 *                     name:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [admin]
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, suspended]
 *                     permissions:
 *                       type: array
 *                       items:
 *                         type: string
 *                     createdAt:
 *                       type: string
 *                       format: date-time
 *                     lastLoginAt:
 *                       type: string
 *                       format: date-time
 *                     lastLoginIp:
 *                       type: string
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/profile', (req, res) => adminAuthController.getAdminProfile(req, res));

/**
 * @swagger
 * /api/admin/auth/sessions:
 *   get:
 *     summary: Get admin active sessions
 *     description: |
 *       Get all active sessions for the currently authenticated admin
 *       - Returns list of active sessions
 *       - Includes device and location information
 *       - Requires valid admin session
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     sessions:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                             format: uuid
 *                           deviceId:
 *                             type: string
 *                           ipAddress:
 *                             type: string
 *                           userAgent:
 *                             type: string
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                           lastActivityAt:
 *                             type: string
 *                             format: date-time
 *                           expiresAt:
 *                             type: string
 *                             format: date-time
 *                           isActive:
 *                             type: boolean
 *                     total:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/sessions', (req, res) => adminAuthController.getAdminSessions(req, res));

/**
 * POST /api/admin/auth/change-password
 * Change admin password
 * 
 * Headers:
 * Authorization: Bearer <jwt-access-token>
 * 
 * Request Body:
 * {
 *   "currentPassword": "oldpassword",
 *   "newPassword": "newsecurepassword"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Password changed successfully"
 * }
 * 
 * Security Features:
 * - Validates current password
 * - Enforces password strength requirements
 * - Logs password change action
 * - Updates password hash securely
 * - Requires valid admin session
 */

/**
 * @swagger
 * /api/admin/auth/change-password:
 *   post:
 *     summary: Change admin password
 *     description: |
 *       Change admin password with security validation
 *       - Validates current password
 *       - Enforces password strength requirements
 *       - Logs password change action
 *       - Updates password hash securely
 *       - Requires valid admin session
 *     tags:
 *       - Admin Authentication
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 format: password
 *                 description: Current password
 *                 example: OldPassword123!
 *               newPassword:
 *                 type: string
 *                 format: password
 *                 description: New password (min 8 characters, must include uppercase, lowercase, number, special char)
 *                 example: NewSecurePassword123!
 *     responses:
 *       200:
 *         description: Password changed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Password changed successfully
 *       400:
 *         description: Bad Request - Invalid password
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: INVALID_PASSWORD
 *                     message:
 *                       type: string
 *                       example: Current password is incorrect
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/change-password', (req, res) => adminAuthController.changePassword(req, res));

export default router; 