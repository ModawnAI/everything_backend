/**
 * No-Show Detection Routes
 * 
 * API routes for no-show detection system including:
 * - Manual override endpoints
 * - Statistics and reporting
 * - Configuration management
 * - Manual trigger endpoints
 */

import { Router } from 'express';
import { noShowDetectionController } from '../controllers/no-show-detection.controller';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

// Apply authentication middleware to all routes
router.use(authenticateJWT());

// Manual override for no-show detection
// POST /api/admin/no-show/override
router.post('/override', 
  requireRole('shop_owner', 'admin'),
  noShowDetectionController.manualOverride.bind(noShowDetectionController)
);

// Get no-show statistics
// GET /api/admin/no-show/statistics?startDate=2024-01-01&endDate=2024-01-31&shopId=optional
router.get('/statistics',
  requireRole('shop_owner', 'admin'),
  noShowDetectionController.getStatistics.bind(noShowDetectionController)
);

// Get current no-show detection configuration (admin only)
// GET /api/admin/no-show/config
router.get('/config',
  requireRole('admin'),
  noShowDetectionController.getConfiguration.bind(noShowDetectionController)
);

// Update no-show detection configuration (admin only)
// PUT /api/admin/no-show/config
router.put('/config',
  requireRole('admin'),
  noShowDetectionController.updateConfiguration.bind(noShowDetectionController)
);

// Manually trigger no-show detection (admin only)
// POST /api/admin/no-show/trigger
router.post('/trigger',
  requireRole('admin'),
  noShowDetectionController.triggerDetection.bind(noShowDetectionController)
);

// Get no-show detection status for a specific reservation
// GET /api/admin/no-show/reservation/:reservationId
router.get('/reservation/:reservationId',
  requireRole('shop_owner', 'admin'),
  noShowDetectionController.getReservationStatus.bind(noShowDetectionController)
);

export default router; 