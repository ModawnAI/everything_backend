import { Router } from 'express';
import { adminAuthController } from '../controllers/admin-auth.controller';

const router = Router();

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
router.post('/login', adminAuthController.adminLogin);

/**
 * POST /api/admin/auth/refresh
 * Refresh admin session token
 * 
 * Request Body:
 * {
 *   "refreshToken": "jwt-refresh-token"
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "admin": { ... },
 *     "session": {
 *       "token": "new-jwt-access-token",
 *       "expiresAt": "2024-01-01T12:00:00Z",
 *       "refreshToken": "new-jwt-refresh-token"
 *     },
 *     "security": { ... }
 *   }
 * }
 * 
 * Security Features:
 * - Validates refresh token
 * - Creates new session and revokes old one
 * - IP address tracking
 * - Session activity logging
 */
router.post('/refresh', adminAuthController.refreshSession);

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
router.post('/logout', adminAuthController.adminLogout);

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
router.get('/validate', adminAuthController.validateSession);

/**
 * GET /api/admin/auth/profile
 * Get admin profile information
 * 
 * Headers:
 * Authorization: Bearer <jwt-access-token>
 * 
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "id": "uuid",
 *     "email": "admin@example.com",
 *     "name": "Admin Name",
 *     "role": "admin",
 *     "status": "active",
 *     "permissions": ["user_management", "shop_approval", ...],
 *     "createdAt": "2024-01-01T00:00:00Z",
 *     "lastLoginAt": "2024-01-01T10:00:00Z",
 *     "lastLoginIp": "192.168.1.1"
 *   }
 * }
 * 
 * Security Features:
 * - Requires valid admin session
 * - Returns comprehensive profile data
 * - Includes security-related information
 */
router.get('/profile', adminAuthController.getAdminProfile);

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
router.post('/change-password', adminAuthController.changePassword);

export default router; 