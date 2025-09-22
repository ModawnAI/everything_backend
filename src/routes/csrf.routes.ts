/**
 * CSRF Token Routes
 * 
 * Provides endpoints for CSRF token management and validation.
 * These tokens are required for all state-changing operations in the social feed.
 */

import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { csrfSanitizationIntegration } from '../middleware/csrf-sanitization-integration.middleware';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * /api/csrf/token:
 *   get:
 *     summary: CSRF token for authenticated user 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieve a CSRF token for the authenticated user. This token must be included
 *       in all state-changing requests (POST, PUT, DELETE) as either:
 *       - X-CSRF-Token header
 *       - _csrf field in request body
 *       
 *       **Token Properties:**
 *       - Expires after 1 hour
 *       - User-specific (cannot be used by other users)
 *       - Automatically rotated for security
 *       
 *       **Usage:**
 *       ```javascript
 *       // Get token
 *       const response = await fetch('/api/csrf/token', {
 *         headers: { 'Authorization': 'Bearer ' + jwt }
 *       });
 *       const { token } = await response.json();
 *       
 *       // Use token in requests
 *       await fetch('/api/feed/posts', {
 *         method: 'POST',
 *         headers: {
 *           'Authorization': 'Bearer ' + jwt,
 *           'X-CSRF-Token': token,
 *           'Content-Type': 'application/json'
 *         },
 *         body: JSON.stringify({ content: 'Hello world!' })
 *       });
 *       ```
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSRF token generated successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
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
 *                     token:
 *                       type: string
 *                       description: CSRF token to include in subsequent requests
 *                       example: "1640995200000.user123.a1b2c3d4e5f6..."
 *                     expiresAt:
 *                       type: string
 *                       format: date-time
 *                       description: Token expiration timestamp
 *                       example: "2023-12-31T23:59:59.000Z"
 *                     usage:
 *                       type: object
 *                       properties:
 *                         header:
 *                           type: string
 *                           example: "X-CSRF-Token"
 *                         body:
 *                           type: string
 *                           example: "_csrf"
 *       401:
 *         description: Unauthorized - Invalid or missing JWT token
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
 *                       example: "AUTHENTICATION_REQUIRED"
 *                     message:
 *                       type: string
 *                       example: "Authentication required"
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /token:
 *   get:
 *     summary: /token 조회
 *     description: GET endpoint for /token
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.get('/token', authenticateJWT, async (req: any, res) => {
  try {
    const userId = req.user.id;
    
    // Generate CSRF token for the user
    const token = csrfSanitizationIntegration.getCSRFTokenForUser(userId);
    
    // Calculate expiration time
    const expiresAt = new Date(Date.now() + (60 * 60 * 1000)); // 1 hour from now
    
    logger.info('CSRF token generated', {
      userId,
      tokenPrefix: token.substring(0, 20) + '...',
      expiresAt: expiresAt.toISOString()
    });

    res.json({
      success: true,
      data: {
        token,
        expiresAt: expiresAt.toISOString(),
        usage: {
          header: 'X-CSRF-Token',
          body: '_csrf'
        }
      }
    });

  } catch (error) {
    logger.error('CSRF token generation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_TOKEN_GENERATION_FAILED',
        message: 'Failed to generate CSRF token. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

/**
 * @swagger
 * /api/csrf/validate:
 *   post:
 *     summary: Validate CSRF token (Validate CSRF token)
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Validate a CSRF token without performing any other action.
 *       Useful for testing token validity before making actual requests.
 *     tags: [Security]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: CSRF token to validate
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *                 example: "1640995200000.user123.a1b2c3d4e5f6..."
 *     responses:
 *       200:
 *         description: Token validation result
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
 *                     valid:
 *                       type: boolean
 *                       description: Whether the token is valid
 *                       example: true
 *                     reason:
 *                       type: string
 *                       description: Reason for validation result
 *                       example: "Token is valid"
 *       400:
 *         description: Invalid token
 *       401:
 *         description: Unauthorized
 */
/**
 * @swagger
 * /validate:
 *   post:
 *     summary: POST /validate (POST /validate)
 *     description: POST endpoint for /validate
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Service]
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

router.post('/validate', authenticateJWT, async (req: any, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'TOKEN_REQUIRED',
          message: 'CSRF token is required for validation',
          timestamp: new Date().toISOString()
        }
      });
    }

    // Create a mock request with the token for validation
    const mockReq = {
      get: (header: string) => header === 'X-CSRF-Token' ? token : undefined,
      body: { _csrf: token },
      method: 'POST'
    };

    const securityContext = {
      userId: req.user.id,
      userRole: req.user.role,
      requestId: 'validation-' + Date.now(),
      timestamp: new Date(),
      ipAddress: req.ip || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      sanitizationApplied: [],
      securityChecks: []
    };

    // Use the private validation method (we'll need to expose this)
    // For now, we'll create a simple validation
    const tokenParts = token.split('.');
    const isValidFormat = tokenParts.length === 3;
    const isValidUser = tokenParts[1] === req.user.id;
    const isNotExpired = tokenParts[0] && (Date.now() - parseInt(tokenParts[0], 10)) < (60 * 60 * 1000);

    const valid = isValidFormat && isValidUser && isNotExpired;
    const reason = valid ? 'Token is valid' : 
                  !isValidFormat ? 'Invalid token format' :
                  !isValidUser ? 'Token user mismatch' :
                  !isNotExpired ? 'Token expired' : 'Unknown validation error';

    logger.info('CSRF token validation', {
      userId: req.user.id,
      valid,
      reason,
      tokenPrefix: token.substring(0, 20) + '...'
    });

    res.json({
      success: true,
      data: {
        valid,
        reason
      }
    });

  } catch (error) {
    logger.error('CSRF token validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'Failed to validate CSRF token. Please try again.',
        timestamp: new Date().toISOString()
      }
    });
  }
});

export default router;

