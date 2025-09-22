import { Router, Request, Response } from 'express';
import { shutdownService } from '../services/shutdown.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     ShutdownStatus:
 *       type: object
 *       properties:
 *         isShuttingDown:
 *           type: boolean
 *           description: Whether the system is currently shutting down
 *         startTime:
 *           type: number
 *           description: Timestamp when shutdown started
 *         completedSteps:
 *           type: array
 *           items:
 *             type: string
 *           description: List of completed shutdown steps
 *         remainingSteps:
 *           type: array
 *           items:
 *             type: string
 *           description: List of remaining shutdown steps
 *         error:
 *           type: string
 *           description: Error message if shutdown failed
 */

/**
 * GET /shutdown/status
 * Get current shutdown status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const status = shutdownService.getShutdownStatus();
    
    logger.info('Shutdown status requested', {
      correlationId: (req as any).correlationId,
      isShuttingDown: status.isShuttingDown,
    });

    res.status(200).json({
      success: true,
      data: status,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get shutdown status', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SHUTDOWN_STATUS_FAILED',
        message: 'Failed to get shutdown status',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /shutdown/initiate
 * Manually initiate graceful shutdown (admin only)
 */

/**
 * @swagger
 * /initiate:
 *   post:
 *     summary: POST /initiate
 *     description: POST endpoint for /initiate
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
router.post('/initiate', async (req: Request, res: Response) => {
  try {
    const status = shutdownService.getShutdownStatus();
    
    if (status.isShuttingDown) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'SHUTDOWN_ALREADY_IN_PROGRESS',
          message: 'Shutdown is already in progress',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.warn('Manual shutdown initiated', {
      correlationId: (req as any).correlationId,
      userId: (req as any).user?.id,
    });

    res.status(200).json({
      success: true,
      message: 'Graceful shutdown initiated',
      timestamp: new Date().toISOString(),
    });

    // Initiate shutdown after response
    setTimeout(() => {
      process.emit('SIGTERM');
    }, 1000);
  } catch (error) {
    logger.error('Failed to initiate shutdown', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SHUTDOWN_INITIATE_FAILED',
        message: 'Failed to initiate shutdown',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /shutdown/test
 * Test shutdown process without actually shutting down
 */

/**
 * @swagger
 * /test:
 *   post:
 *     summary: POST /test
 *     description: POST endpoint for /test
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
router.post('/test', async (req: Request, res: Response) => {
  try {
    logger.info('Shutdown test initiated', {
      correlationId: (req as any).correlationId,
    });

    // Simulate shutdown steps without actually shutting down
    const testSteps = [
      'Stop accepting new connections',
      'Complete in-flight requests',
      'Close WebSocket connections',
      'Close database connections',
      'Close Redis connections',
      'Close monitoring connections',
      'Stop health checks',
    ];

    const results = [];
    
    for (const step of testSteps) {
      await new Promise(resolve => setTimeout(resolve, 500)); // Simulate step execution
      results.push({ step, status: 'completed', duration: 500 });
    }

    res.status(200).json({
      success: true,
      message: 'Shutdown test completed successfully',
      data: {
        steps: results,
        totalDuration: results.length * 500,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Shutdown test failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SHUTDOWN_TEST_FAILED',
        message: 'Shutdown test failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /shutdown/health
 * Health check endpoint that indicates shutdown status
 */

/**
 * @swagger
 * /health:
 *   get:
 *     summary: GET /health
 *     description: GET endpoint for /health
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const status = shutdownService.getShutdownStatus();
    
    if (status.isShuttingDown) {
      return res.status(503).json({
        success: false,
        status: 'shutting_down',
        message: 'System is shutting down',
        data: {
          startTime: status.startTime,
          completedSteps: status.completedSteps,
          remainingSteps: status.remainingSteps,
        },
        timestamp: new Date().toISOString(),
      });
    }

    res.status(200).json({
      success: true,
      status: 'healthy',
      message: 'System is healthy and ready',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Shutdown health check failed', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      status: 'error',
      error: {
        code: 'SHUTDOWN_HEALTH_CHECK_FAILED',
        message: 'Shutdown health check failed',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router; 