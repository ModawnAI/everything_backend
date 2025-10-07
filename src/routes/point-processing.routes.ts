/**
 * Point Processing Routes
 * 
 * Admin routes for point processing tasks including:
 * - Manual triggering of point processing jobs
 * - Processing statistics and monitoring
 * - Admin control over automated point workflows
 */

import { Router } from 'express';
import { PointProcessingController } from '../controllers/point-processing.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
const pointProcessingController = new PointProcessingController();

// All routes require authentication and admin privileges
router.use(authenticateJWT());


/**
 * @swagger
 * /trigger/all:
 *   post:
 *     summary: POST /trigger/all (POST /trigger/all)
 *     description: POST endpoint for /trigger/all
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Points & Rewards]
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
// Manual trigger endpoints
router.post('/trigger/all', pointProcessingController.triggerAllProcessing.bind(pointProcessingController));
/**
 * @swagger
 * /trigger/pending:
 *   post:
 *     summary: POST /trigger/pending (POST /trigger/pending)
 *     description: POST endpoint for /trigger/pending
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Point System]
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

router.post('/trigger/pending', pointProcessingController.triggerPendingProcessing.bind(pointProcessingController));
/**
 * @swagger
 * /trigger/expired:
 *   post:
 *     summary: POST /trigger/expired (POST /trigger/expired)
 *     description: POST endpoint for /trigger/expired
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Point System]
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

router.post('/trigger/expired', pointProcessingController.triggerExpiredProcessing.bind(pointProcessingController));
/**
 * @swagger
 * /trigger/warnings:
 *   post:
 *     summary: POST /trigger/warnings (POST /trigger/warnings)
 *     description: POST endpoint for /trigger/warnings
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Point System]
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

router.post('/trigger/warnings', pointProcessingController.triggerExpirationWarnings.bind(pointProcessingController));

// Statistics and monitoring endpoints
/**
 * @swagger
 * /stats:
 *   get:
 *     summary: /stats 조회
 *     description: GET endpoint for /stats
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Point System]
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

router.get('/stats', pointProcessingController.getProcessingStats.bind(pointProcessingController));
/**
 * @swagger
 * /analytics:
 *   get:
 *     summary: /analytics 조회
 *     description: GET endpoint for /analytics
 *       
 *       포인트 시스템 API입니다. 포인트 적립, 사용, 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Point System]
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

router.get('/analytics', pointProcessingController.getProcessingAnalytics.bind(pointProcessingController));

export default router; 