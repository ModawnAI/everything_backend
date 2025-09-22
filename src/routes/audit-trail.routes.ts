/**
 * Audit Trail Routes
 * 
 * Admin-only routes for audit trail management and compliance reporting
 */

import { Router } from 'express';
import { auditTrailController } from '../controllers/audit-trail.controller';
import { requireAdmin } from '../middleware/rbac.middleware';
import { strictRateLimit } from '../middleware/rate-limit.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';
import { logger } from '../utils/logger';

const router = Router();

// Validation schemas
const exportRequestSchema = Joi.object({
  filter: Joi.object({
    reservationId: Joi.string().uuid().optional(),
    userId: Joi.string().uuid().optional(),
    shopId: Joi.string().uuid().optional(),
    fromStatus: Joi.string().valid('requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show').optional(),
    toStatus: Joi.string().valid('requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show').optional(),
    changedBy: Joi.string().valid('user', 'shop', 'system', 'admin').optional(),
    changedById: Joi.string().uuid().optional(),
    dateFrom: Joi.string().isoDate().optional(),
    dateTo: Joi.string().isoDate().optional(),
    reason: Joi.string().max(500).optional(),
    hasErrors: Joi.boolean().optional()
  }).optional(),
  format: Joi.string().valid('json', 'csv', 'xlsx').default('json'),
  includeMetadata: Joi.boolean().default(true),
  includeSystemContext: Joi.boolean().default(false),
  compression: Joi.string().valid('gzip', 'zip').optional(),
  encryption: Joi.boolean().default(false)
}).messages({
  'string.uuid': '유효한 UUID 형식이어야 합니다.',
  'string.isoDate': '유효한 ISO 날짜 형식이어야 합니다.',
  'any.only': '허용되지 않는 값입니다.'
});

const cleanupRequestSchema = Joi.object({
  retentionDays: Joi.number().integer().min(30).max(3650).default(365).messages({
    'number.min': '보존 기간은 최소 30일이어야 합니다.',
    'number.max': '보존 기간은 최대 3650일(10년)이어야 합니다.',
    'number.integer': '보존 기간은 정수여야 합니다.'
  })
}).messages({
  'object.base': '유효한 요청 형식이 아닙니다.'
});

// Apply admin authentication and rate limiting to all routes
router.use(requireAdmin());
router.use(strictRateLimit(20, 60000)); // 20 requests per minute for audit operations

/**
 * GET /api/admin/audit-trail
 * Get audit trail entries with filtering and pagination
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
router.get('/', async (req, res) => {
  try {
    await auditTrailController.getAuditTrail(req, res);
  } catch (error) {
    logger.error('Error in get audit trail route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '감사 추적 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/audit-trail/compliance-report
 * Generate comprehensive compliance report
 */
/**
 * @swagger
 * /compliance-report:
 *   get:
 *     summary: /compliance-report 조회
 *     description: GET endpoint for /compliance-report
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

router.get('/compliance-report', async (req, res) => {
  try {
    await auditTrailController.generateComplianceReport(req, res);
  } catch (error) {
    logger.error('Error in compliance report route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '컴플라이언스 보고서 생성 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/admin/audit-trail/trends
 * Analyze trends and patterns in audit data
 */

/**
 * @swagger
 * /trends:
 *   get:
 *     summary: /trends 조회
 *     description: GET endpoint for /trends
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
router.get('/trends', async (req, res) => {
  try {
    await auditTrailController.analyzeTrends(req, res);
  } catch (error) {
    logger.error('Error in trends analysis route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '트렌드 분석 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * POST /api/admin/audit-trail/export
 * Export audit trail data
 */
/**
 * @swagger
 * /export:
 *   post:
 *     summary: POST /export (POST /export)
 *     description: POST endpoint for /export
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

router.post('/export',
  validateRequestBody(exportRequestSchema),
  async (req, res) => {
    try {
      await auditTrailController.exportAuditTrail(req, res);
    } catch (error) {
      logger.error('Error in export audit trail route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '감사 추적 내보내기 중 오류가 발생했습니다.'
        }
      });
    }
  }
);

/**
 * GET /api/admin/audit-trail/reservation/:reservationId
 * Get complete audit trail for a specific reservation
 */

/**
 * @swagger
 * /reservation/:reservationId:
 *   get:
 *     summary: /reservation/:reservationId 조회
 *     description: GET endpoint for /reservation/:reservationId
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
router.get('/reservation/:reservationId', async (req, res) => {
  try {
    await auditTrailController.getReservationAuditTrail(req, res);
  } catch (error) {
    logger.error('Error in reservation audit trail route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      reservationId: req.params.reservationId
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '예약 감사 추적 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * POST /api/admin/audit-trail/cleanup
 * Clean up old audit trail entries (data retention)
 */
/**
 * @swagger
 * /cleanup:
 *   post:
 *     summary: POST /cleanup (POST /cleanup)
 *     description: POST endpoint for /cleanup
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

router.post('/cleanup',
  validateRequestBody(cleanupRequestSchema),
  async (req, res) => {
    try {
      await auditTrailController.cleanupOldEntries(req, res);
    } catch (error) {
      logger.error('Error in cleanup audit trail route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        body: req.body
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '감사 추적 정리 중 오류가 발생했습니다.'
        }
      });
    }
  }
);

/**
 * GET /api/admin/audit-trail/stats
 * Get audit trail statistics and health metrics
 */

/**
 * @swagger
 * /stats:
 *   get:
 *     summary: /stats 조회
 *     description: GET endpoint for /stats
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
router.get('/stats', async (req, res) => {
  try {
    await auditTrailController.getAuditTrailStats(req, res);
  } catch (error) {
    logger.error('Error in audit trail stats route', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: (req as any).user?.id,
      query: req.query
    });
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '감사 추적 통계 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

export default router;
