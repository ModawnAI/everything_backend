/**
 * Monitoring Routes
 */

import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Health check endpoint (public)
router.get('/health', monitoringController.healthCheck.bind(monitoringController));

// System health metrics
router.get('/health/:shopId?', authenticateToken, monitoringController.getSystemHealth.bind(monitoringController));

// Active alerts
router.get('/alerts', authenticateToken, monitoringController.getActiveAlerts.bind(monitoringController));

// Resolve alert
router.post('/alerts/:alertId/resolve', authenticateToken, monitoringController.resolveAlert.bind(monitoringController));

// Monitoring configuration
router.get('/config', authenticateToken, monitoringController.getMonitoringConfig.bind(monitoringController));
router.post('/config', authenticateToken, monitoringController.updateMonitoringConfig.bind(monitoringController));

// Time slot metrics
router.get('/metrics/time-slots/:shopId', authenticateToken, monitoringController.getTimeSlotMetrics.bind(monitoringController));

// Conflict metrics
router.get('/metrics/conflicts/:shopId', authenticateToken, monitoringController.getConflictMetrics.bind(monitoringController));

// Manual conflict detection trigger
router.post('/conflicts/:shopId/detect', authenticateToken, monitoringController.triggerConflictDetection.bind(monitoringController));

export default router;