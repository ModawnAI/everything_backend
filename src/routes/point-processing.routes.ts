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
router.use(authenticateJWT);

// Manual trigger endpoints
router.post('/trigger/all', pointProcessingController.triggerAllProcessing.bind(pointProcessingController));
router.post('/trigger/pending', pointProcessingController.triggerPendingProcessing.bind(pointProcessingController));
router.post('/trigger/expired', pointProcessingController.triggerExpiredProcessing.bind(pointProcessingController));
router.post('/trigger/warnings', pointProcessingController.triggerExpirationWarnings.bind(pointProcessingController));

// Statistics and monitoring endpoints
router.get('/stats', pointProcessingController.getProcessingStats.bind(pointProcessingController));
router.get('/analytics', pointProcessingController.getProcessingAnalytics.bind(pointProcessingController));

export default router; 