import { Router } from 'express';
import { cspViolationHandler } from '../middleware/security.middleware';
import { logger } from '../utils/logger';
import Tokens from 'csrf';

const router = Router();

// Initialize CSRF instance
const tokens = new Tokens({
  secretLength: 18,
  saltLength: 8
});

/**
 * CSRF Token Generation Endpoint
 * GET /api/security/csrf-token
 * 
 * Generates a CSRF token for the client
 */

/**
 * @swagger
 * /csrf-token:
 *   get:
 *     summary: /csrf-token 조회
 *     description: GET endpoint for /csrf-token
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.get('/csrf-token', (req, res) => {
  try {
    const secret = tokens.secretSync();
    const token = tokens.create(secret);
    
    res.json({
      success: true,
      message: 'CSRF token generated',
      data: {
        token,
        secret,
        expiresIn: '1 hour' // Token should be refreshed periodically
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to generate CSRF token', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({ error: 'Failed to generate CSRF token' });
  }
});

/**
 * CSP Violation Report Endpoint
 * POST /api/security/csp-report
 * 
 * Handles Content Security Policy violation reports from browsers
 */
/**
 * @swagger
 * /csp-report:
 *   post:
 *     summary: POST /csp-report (POST /csp-report)
 *     description: POST endpoint for /csp-report
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Security]
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

router.post('/csp-report', cspViolationHandler());

/**
 * Security Headers Test Endpoint
 * GET /api/security/test-headers
 * 
 * Returns current security headers configuration for testing
 */

/**
 * @swagger
 * /test-headers:
 *   get:
 *     summary: /test-headers 조회
 *     description: GET endpoint for /test-headers
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.get('/test-headers', (req, res) => {
  try {
    const securityHeaders = {
      'Content-Security-Policy': req.get('Content-Security-Policy'),
      'X-Content-Type-Options': req.get('X-Content-Type-Options'),
      'X-Frame-Options': req.get('X-Frame-Options'),
      'X-XSS-Protection': req.get('X-XSS-Protection'),
      'Strict-Transport-Security': req.get('Strict-Transport-Security'),
      'Referrer-Policy': req.get('Referrer-Policy'),
      'Permissions-Policy': req.get('Permissions-Policy'),
      'Cross-Origin-Embedder-Policy': req.get('Cross-Origin-Embedder-Policy'),
      'Cross-Origin-Opener-Policy': req.get('Cross-Origin-Opener-Policy'),
      'Cross-Origin-Resource-Policy': req.get('Cross-Origin-Resource-Policy')
    };

    res.json({
      success: true,
      message: 'Security headers test endpoint',
      headers: securityHeaders,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get security headers', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({ error: 'Failed to get security headers' });
  }
});

/**
 * Security Configuration Endpoint
 * GET /api/security/config
 * 
 * Returns current security configuration (non-sensitive parts)
 */

/**
 * @swagger
 * /config:
 *   get:
 *     summary: /config 조회
 *     description: GET endpoint for /config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
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
router.get('/config', (req, res) => {
  try {
    const config = {
      environment: process.env.NODE_ENV || 'development',
      cors: {
        enabled: true,
        credentials: true,
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
      },
      csp: {
        enabled: true,
        reportOnly: process.env.NODE_ENV === 'development',
        reportUri: '/api/security/csp-report'
      },
      hsts: {
        enabled: process.env.NODE_ENV === 'production',
        maxAge: 31536000, // 1 year
        includeSubDomains: true,
        preload: true
      },
      rateLimiting: {
        enabled: true,
        redis: process.env.REDIS_URL ? 'enabled' : 'disabled'
      }
    };

    res.json({
      success: true,
      message: 'Security configuration',
      config,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    logger.error('Failed to get security configuration', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({ error: 'Failed to get security configuration' });
  }
});

/**
 * Security Health Check Endpoint
 * GET /api/security/health
 * 
 * Returns security system health status
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: /health 조회
 *     description: GET endpoint for /health
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
router.get('/health', (req, res) => {
  try {
    const health = {
      status: 'healthy',
      checks: {
        csp: {
          status: 'enabled',
          reportEndpoint: '/api/security/csp-report'
        },
        cors: {
          status: 'enabled',
          credentials: true
        },
        hsts: {
          status: process.env.NODE_ENV === 'production' ? 'enabled' : 'disabled'
        },
        rateLimiting: {
          status: process.env.REDIS_URL ? 'enabled' : 'disabled'
        }
      },
      timestamp: new Date().toISOString()
    };

    res.json({
      success: true,
      message: 'Security health check',
      health
    });
  } catch (error) {
    logger.error('Failed to get security health', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(500).json({ error: 'Failed to get security health' });
  }
});

export default router;
