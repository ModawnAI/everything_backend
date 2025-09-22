/**
 * Conflict Resolution Routes
 * 
 * Defines API endpoints for conflict detection and resolution functionality
 */

import { Router } from 'express';
import { conflictResolutionController } from '../controllers/conflict-resolution.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/rbac.middleware';

const router = Router();

// Apply authentication to all routes
router.use(authenticateJWT());


/**
 * @swagger
 * /shops/:shopId/conflicts/detect:
 *   get:
 *     summary: GET /shops/:shopId/conflicts/detect
 *     description: GET endpoint for /shops/:shopId/conflicts/detect
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
// Detect conflicts for a shop
router.get('/shops/:shopId/conflicts/detect', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  conflictResolutionController.detectConflicts.bind(conflictResolutionController)
);

// Resolve a specific conflict
router.post('/conflicts/:conflictId/resolve', 
  requirePermission({ resource: 'reservations', action: 'update' }),
  conflictResolutionController.resolveConflict.bind(conflictResolutionController)
);

// Calculate priority scores for conflicting reservations
router.post('/conflicts/priority-scores', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  conflictResolutionController.calculatePriorityScores.bind(conflictResolutionController)
);

// Get conflict history for a shop
router.get('/shops/:shopId/conflicts/history', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  conflictResolutionController.getConflictHistory.bind(conflictResolutionController)
);

// Get conflict statistics for a shop
router.get('/shops/:shopId/conflicts/stats', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  conflictResolutionController.getConflictStats.bind(conflictResolutionController)
);

// Get manual conflict resolution interface data
router.get('/shops/:shopId/conflicts/manual-interface', 
  requirePermission({ resource: 'reservations', action: 'read' }),
  conflictResolutionController.getManualInterfaceData.bind(conflictResolutionController)
);


/**
 * @swagger
 * /shops/:shopId/conflicts/prevent:
 *   post:
 *     summary: POST /shops/:shopId/conflicts/prevent
 *     description: POST endpoint for /shops/:shopId/conflicts/prevent
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
// Apply automatic conflict prevention
router.post('/shops/:shopId/conflicts/prevent', 
  requirePermission({ resource: 'reservations', action: 'update' }),
  conflictResolutionController.applyConflictPrevention.bind(conflictResolutionController)
);

export default router; 