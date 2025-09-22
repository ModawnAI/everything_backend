import { Router, Request, Response } from 'express';
import { healthCheckService } from '../services/health-check.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     HealthStatus:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Overall health status
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Health check timestamp
 *         uptime:
 *           type: number
 *           description: Server uptime in seconds
 *         version:
 *           type: string
 *           description: API version
 *         environment:
 *           type: string
 *           description: Environment name
 *     HealthCheckResult:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [healthy, degraded, unhealthy]
 *           description: Component health status
 *         message:
 *           type: string
 *           description: Health check message
 *         responseTime:
 *           type: number
 *           description: Response time in milliseconds
 *         details:
 *           type: object
 *           description: Additional health check details
 *         lastChecked:
 *           type: string
 *           format: date-time
 *           description: Last check timestamp
 *     DetailedHealthStatus:
 *       allOf:
 *         - $ref: '#/components/schemas/HealthStatus'
 *         - type: object
 *           properties:
 *             checks:
 *               type: object
 *               properties:
 *                 database:
 *                   $ref: '#/components/schemas/HealthCheckResult'
 *                 externalApis:
 *                   type: object
 *                   properties:
 *                     tossPayments:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     fcm:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     supabase:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                 system:
 *                   type: object
 *                   properties:
 *                     memory:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     cpu:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     disk:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                 dependencies:
 *                   type: object
 *                   properties:
 *                     redis:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *                     websocket:
 *                       $ref: '#/components/schemas/HealthCheckResult'
 *             summary:
 *               type: object
 *               properties:
 *                 totalChecks:
 *                   type: number
 *                   description: Total number of health checks
 *                 healthyChecks:
 *                   type: number
 *                   description: Number of healthy checks
 *                 degradedChecks:
 *                   type: number
 *                   description: Number of degraded checks
 *                 unhealthyChecks:
 *                   type: number
 *                   description: Number of unhealthy checks
 */

/**
 * GET /health
 * Basic health check endpoint
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
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
router.get('/', async (req: Request, res: Response) => {
  try {
    const health = await healthCheckService.getBasicHealth();
    
    logger.info('Basic health check requested', {
      correlationId: (req as any).correlationId,
      status: health.status,
    });

    res.status(200).json({
      success: true,
      data: health,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Health check failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'HEALTH_CHECK_FAILED',
        message: 'Health check failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /health/detailed
 * Comprehensive health check with all system components
 */

/**
 * @swagger
 * /detailed:
 *   get:
 *     summary: /detailed 조회
 *     description: GET endpoint for /detailed
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
router.get('/detailed', async (req: Request, res: Response) => {
  try {
    const startTime = Date.now();
    const health = await healthCheckService.getDetailedHealth();
    const responseTime = Date.now() - startTime;

    logger.info('Detailed health check requested', {
      correlationId: (req as any).correlationId,
      status: health.status,
      responseTime,
      summary: health.summary
    });

    res.status(200).json({
      success: true,
      data: health,
      responseTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Detailed health check failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DETAILED_HEALTH_CHECK_FAILED',
        message: 'Detailed health check failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /health/ready
 * Readiness probe for Kubernetes
 */

/**
 * @swagger
 * /ready:
 *   get:
 *     summary: /ready 조회
 *     description: GET endpoint for /ready
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
router.get('/ready', async (req: Request, res: Response) => {
  try {
    const health = await healthCheckService.getDetailedHealth();
    
    // Consider the service ready if overall status is healthy or degraded
    const isReady = health.status === 'healthy' || health.status === 'degraded';
    
    logger.info('Readiness probe requested', {
      correlationId: (req as any).correlationId,
      status: health.status,
      isReady,
    });

    if (isReady) {
      res.status(200).json({
        success: true,
        ready: true,
        status: health.status,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        success: false,
        ready: false,
        status: health.status,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error) {
    logger.error('Readiness probe failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(503).json({
      success: false,
      ready: false,
      error: {
        code: 'READINESS_PROBE_FAILED',
        message: 'Readiness probe failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /health/live
 * Liveness probe for Kubernetes
 */

/**
 * @swagger
 * /live:
 *   get:
 *     summary: /live 조회
 *     description: GET endpoint for /live
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
router.get('/live', async (req: Request, res: Response) => {
  try {
    // Liveness probe is always successful if the server is running
    logger.info('Liveness probe requested', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      alive: true,
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Liveness probe failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(503).json({
      success: false,
      alive: false,
      error: {
        code: 'LIVENESS_PROBE_FAILED',
        message: 'Liveness probe failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /health/cache/clear
 * Clear health check cache (admin only)
 */

/**
 * @swagger
 * /cache/clear:
 *   post:
 *     summary: POST /cache/clear (POST /cache/clear)
 *     description: POST endpoint for /cache/clear
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
router.post('/cache/clear', async (req: Request, res: Response) => {
  try {
    healthCheckService.clearCache();
    
    logger.info('Health check cache cleared', {
      correlationId: (req as any).correlationId,
      userId: (req as any).user?.id,
    });

    res.status(200).json({
      success: true,
      message: 'Health check cache cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to clear health check cache', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'CACHE_CLEAR_FAILED',
        message: 'Failed to clear health check cache',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router; 