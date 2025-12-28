import { Router } from 'express';
import { shopOwnerAuthController } from '../controllers/shop-owner-auth.controller';
import { logger } from '../utils/logger';

const router = Router();

// Debug middleware for all shop owner auth routes
router.use((req, res, next) => {
  logger.info('Shop owner auth router reached', {
    method: req.method,
    path: req.path,
    fullUrl: req.url,
    body: req.body
  });
  next();
});

/**
 * Shop Owner Authentication Routes
 *
 * Security features for shop owner access:
 * - Email/password authentication via Supabase Auth
 * - Shop ownership verification
 * - Session management with refresh tokens (24 hour access, 7 day refresh)
 * - Failed login attempt tracking
 * - Account locking after multiple failures (30 minute lockout)
 * - Device tracking and session management
 * - Comprehensive audit logging
 */

/**
 * POST /api/shop-owner/auth/login
 * Shop owner login with email and password
 *
 * Request Body:
 * {
 *   "email": "owner@example.com",
 *   "password": "securepassword",
 *   "deviceInfo": {
 *     "deviceId": "optional-device-identifier",
 *     "deviceName": "iPhone 14 Pro",
 *     "userAgent": "optional-user-agent"
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "shopOwner": {
 *       "id": "uuid",
 *       "email": "owner@example.com",
 *       "name": "Shop Owner Name",
 *       "role": "shop_owner",
 *       "shop": {
 *         "id": "shop-uuid",
 *         "name": "Beautiful Salon",
 *         "status": "active",
 *         "mainCategory": "hair",
 *         "address": "Seoul, South Korea",
 *         "phoneNumber": "02-1234-5678"
 *       }
 *     },
 *     "token": "jwt-access-token",
 *     "refreshToken": "jwt-refresh-token",
 *     "expiresAt": "2024-01-01T12:00:00Z",
 *     "security": {
 *       "lastLoginAt": "2024-01-01T10:00:00Z",
 *       "loginLocation": "Seoul, South Korea"
 *     }
 *   }
 * }
 *
 * Security Features:
 * - Email/password authentication via Supabase Auth
 * - Shop ownership verification (must own an active shop)
 * - Failed login attempt tracking (locks after 5 attempts for 30 minutes)
 * - Account status validation
 * - Session creation with device tracking
 * - Comprehensive audit logging
 */

/**
 * @swagger
 * /api/shop-owner/auth/login:
 *   post:
 *     summary: Shop owner login
 *     description: |
 *       Authenticate shop owner users with security features including:
 *       - Email/password authentication via Supabase Auth
 *       - Shop ownership verification (must own an active shop)
 *       - Failed login attempt tracking (locks after 5 attempts for 30 minutes)
 *       - Session creation with device tracking
 *       - Comprehensive audit logging
 *     tags:
 *       - Shop Owner Authentication
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
 *                 description: Shop owner email address
 *                 example: owner@beautysalon.com
 *               password:
 *                 type: string
 *                 format: password
 *                 description: Shop owner password
 *                 example: ShopOwnerPassword123!
 *               deviceInfo:
 *                 type: object
 *                 description: Optional device information for session tracking
 *                 properties:
 *                   deviceId:
 *                     type: string
 *                     description: Unique device identifier
 *                     example: device-12345
 *                   deviceName:
 *                     type: string
 *                     description: Human-readable device name
 *                     example: iPhone 14 Pro
 *                   userAgent:
 *                     type: string
 *                     description: Browser user agent
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
 *                     shopOwner:
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
 *                           enum: [shop_owner]
 *                         shop:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                             status:
 *                               type: string
 *                               enum: [active, inactive, suspended]
 *                             mainCategory:
 *                               type: string
 *                             address:
 *                               type: string
 *                             phoneNumber:
 *                               type: string
 *                     token:
 *                       type: string
 *                       description: JWT access token (24 hour expiry)
 *                     refreshToken:
 *                       type: string
 *                       description: JWT refresh token (7 day expiry)
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                     security:
 *                       type: object
 *                       properties:
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
 *                   type: string
 *                   example: Invalid email or password
 *       401:
 *         description: Authentication failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Invalid shop owner credentials
 *       403:
 *         description: Account locked or no active shop
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: Account locked due to multiple failed login attempts
 *       500:
 *         description: Internal server error
 */
router.post('/login', (req, res) => shopOwnerAuthController.shopOwnerLogin(req, res));

/**
 * @swagger
 * /api/shop-owner/auth/refresh:
 *   post:
 *     summary: Refresh shop owner session token
 *     description: |
 *       Refresh shop owner access token using refresh token
 *       - Validates refresh token
 *       - Creates new session and revokes old one
 *       - IP address tracking
 *       - Session activity logging
 *     tags:
 *       - Shop Owner Authentication
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
 *                     shopOwner:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [shop_owner]
 *                         shop:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
 *                     token:
 *                       type: string
 *                       description: New JWT access token
 *                     refreshToken:
 *                       type: string
 *                       description: New JWT refresh token
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Invalid or expired refresh token
 *       500:
 *         description: Internal server error
 */
router.post('/refresh', (req, res) => shopOwnerAuthController.refreshSession(req, res));

/**
 * POST /api/shop-owner/auth/logout
 * Shop owner logout and session revocation
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
 * /api/shop-owner/auth/logout:
 *   post:
 *     summary: Shop owner logout
 *     description: |
 *       Logout shop owner user and revoke session
 *       - Revokes active session
 *       - Logs logout action
 *       - Clears session data
 *     tags:
 *       - Shop Owner Authentication
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
router.post('/logout', (req, res) => shopOwnerAuthController.shopOwnerLogout(req, res));

/**
 * GET /api/shop-owner/auth/validate
 * Validate shop owner session
 *
 * Headers:
 * Authorization: Bearer <jwt-access-token>
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "shopOwner": {
 *       "id": "uuid",
 *       "email": "owner@example.com",
 *       "role": "shop_owner",
 *       "shop": {
 *         "id": "shop-uuid",
 *         "name": "Beautiful Salon"
 *       }
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
 * - Validates shop owner user status
 * - Updates session activity timestamp
 * - IP address tracking and logging
 */

/**
 * @swagger
 * /api/shop-owner/auth/validate:
 *   get:
 *     summary: Validate shop owner session
 *     description: |
 *       Validate shop owner JWT token and session
 *       - Validates JWT token
 *       - Checks session status in database
 *       - Validates shop owner user status and shop status
 *       - Updates session activity timestamp
 *       - IP address tracking and logging
 *     tags:
 *       - Shop Owner Authentication
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
 *                     shopOwner:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         email:
 *                           type: string
 *                         role:
 *                           type: string
 *                           enum: [shop_owner]
 *                         shop:
 *                           type: object
 *                           properties:
 *                             id:
 *                               type: string
 *                               format: uuid
 *                             name:
 *                               type: string
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
router.get('/validate', (req, res) => shopOwnerAuthController.validateSession(req, res));

/**
 * @swagger
 * /api/shop-owner/auth/profile:
 *   get:
 *     summary: Get shop owner profile
 *     description: |
 *       Get current shop owner profile information
 *       - Requires valid shop owner session
 *       - Returns comprehensive profile data
 *       - Includes shop information
 *       - Includes security-related information
 *     tags:
 *       - Shop Owner Authentication
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
 *                       enum: [shop_owner]
 *                     status:
 *                       type: string
 *                       enum: [active, inactive, suspended]
 *                     shop:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [active, inactive, suspended]
 *                         mainCategory:
 *                           type: string
 *                         address:
 *                           type: string
 *                         phoneNumber:
 *                           type: string
 *                         description:
 *                           type: string
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
router.get('/profile', (req, res) => shopOwnerAuthController.getShopOwnerProfile(req, res));

/**
 * @swagger
 * /api/shop-owner/auth/sessions:
 *   get:
 *     summary: Get shop owner active sessions
 *     description: |
 *       Get all active sessions for the currently authenticated shop owner
 *       - Returns list of active sessions
 *       - Includes device and location information
 *       - Requires valid shop owner session
 *     tags:
 *       - Shop Owner Authentication
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
 *                           deviceName:
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
router.get('/sessions', (req, res) => shopOwnerAuthController.getShopOwnerSessions(req, res));

/**
 * POST /api/shop-owner/auth/change-password
 * Change shop owner password
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
 * - Validates current password via Supabase Auth
 * - Enforces password strength requirements (min 8 characters)
 * - Logs password change action
 * - Updates password securely via Supabase Auth
 * - Requires valid shop owner session
 */

/**
 * @swagger
 * /api/shop-owner/auth/change-password:
 *   post:
 *     summary: Change shop owner password
 *     description: |
 *       Change shop owner password with security validation
 *       - Validates current password via Supabase Auth
 *       - Enforces password strength requirements (min 8 characters)
 *       - Logs password change action
 *       - Updates password securely via Supabase Auth
 *       - Requires valid shop owner session
 *     tags:
 *       - Shop Owner Authentication
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
 *                 description: New password (minimum 8 characters)
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
 *                   type: string
 *                   example: Current password is incorrect
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/change-password', (req, res) => shopOwnerAuthController.changePassword(req, res));

export default router;
