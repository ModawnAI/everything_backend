/**
 * Automatic State Progression Routes
 * 
 * Admin-only routes for monitoring and managing automatic reservation state transitions
 */

import { Router } from 'express';
import { automaticStateProgressionController } from '../controllers/automatic-state-progression.controller';
import { requireAdmin } from '../middleware/rbac.middleware';
import { strictRateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Configuration validation schema
const configUpdateSchema = Joi.object({
  config: Joi.object({
    enabled: Joi.boolean().optional(),
    gracePeriods: Joi.object({
      default: Joi.number().min(1).max(180).optional(),
      serviceTypes: Joi.object().pattern(
        Joi.string(),
        Joi.number().min(1).max(180)
      ).optional()
    }).optional(),
    completionRules: Joi.object({
      autoCompleteAfterMinutes: Joi.number().min(1).max(480).optional(),
      requiresConfirmation: Joi.boolean().optional()
    }).optional(),
    noShowRules: Joi.object({
      graceMinutes: Joi.number().min(1).max(180).optional(),
      enableAutoDetection: Joi.boolean().optional()
    }).optional(),
    expiryRules: Joi.object({
      requestedExpiryHours: Joi.number().min(1).max(168).optional(),
      enableAutoExpiry: Joi.boolean().optional()
    }).optional(),
    batchSize: Joi.number().min(1).max(1000).optional(),
    maxRetries: Joi.number().min(1).max(10).optional(),
    retryDelayMs: Joi.number().min(1000).max(60000).optional()
  }).required().messages({
    'object.base': '설정 객체가 필요합니다.',
    'any.required': '설정 정보는 필수입니다.'
  })
}).messages({
  'object.base': '유효한 요청 형식이 아닙니다.'
});

// Apply admin authentication and rate limiting to all routes
router.use(requireAdmin());
router.use(strictRateLimit(10, 60000)); // 10 requests per minute for admin operations

/**
 * GET /api/admin/state-progression/status
 * Get current status and metrics of automatic state progression
 */

/**
 * @swagger
 * /status:
 *   get:
 *     summary: /status 조회
 *     description: GET endpoint for /status
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
router.get('/status', async (req, res) => {
  try {
    await automaticStateProgressionController.getStatus(req, res);
  } catch (error) {
    logger.error('Error in get status route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '상태 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * POST /api/admin/state-progression/run
 * Manually trigger automatic state progression
 */
/**
 * @swagger
 * /run:
 *   post:
 *     summary: POST /run (POST /run)
 *     description: POST endpoint for /run
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

router.post('/run', async (req, res) => {
  try {
    await automaticStateProgressionController.manualRun(req, res);
  } catch (error) {
    logger.error('Error in manual run route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '수동 실행 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/state-progression/metrics
 * Get detailed metrics and performance data
 */

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: /metrics 조회
 *     description: GET endpoint for /metrics
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
router.get('/metrics', async (req, res) => {
  try {
    await automaticStateProgressionController.getMetrics(req, res);
  } catch (error) {
    logger.error('Error in get metrics route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '메트릭 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * PUT /api/admin/state-progression/config
 * Update automatic state progression configuration
 */
/**
 * @swagger
 * /config:
 *   put:
 *     summary: PUT /config (PUT /config)
 *     description: PUT endpoint for /config
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

router.put('/config',
  validateRequestBody(configUpdateSchema),
  async (req, res) => {
    try {
      await automaticStateProgressionController.updateConfig(req, res);
    } catch (error) {
      logger.error('Error in update config route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '설정 업데이트 중 오류가 발생했습니다.'
        }
      });
    }
  }
);

/**
 * POST /api/admin/state-progression/reset-metrics
 * Reset daily metrics (admin only)
 */

/**
 * @swagger
 * /reset-metrics:
 *   post:
 *     summary: POST /reset-metrics (POST /reset-metrics)
 *     description: POST endpoint for /reset-metrics
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
router.post('/reset-metrics', async (req, res) => {
  try {
    await automaticStateProgressionController.resetMetrics(req, res);
  } catch (error) {
    logger.error('Error in reset metrics route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '메트릭 리셋 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/state-progression/health
 * Health check endpoint for monitoring systems
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

router.get('/health', async (req, res) => {
  try {
    await automaticStateProgressionController.healthCheck(req, res);
  } catch (error) {
    logger.error('Error in health check route', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });
    res.status(503).json({
      success: false,
      data: {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      },
      timestamp: new Date().toISOString()
    });
  }
});

export default router;
