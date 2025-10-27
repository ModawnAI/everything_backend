/**
 * Point Routes
 * 
 * Routes for point-related functionality including:
 * - Point balance and history
 * - Point earning and usage
 * - Admin point adjustments
 */

import { Router } from 'express';
import { PointController } from '../controllers/point.controller';
import { authenticateJWT } from '../middleware/auth.middleware';

const router = Router();
const pointController = new PointController();

// =============================================
// USER POINT ENDPOINTS (Authenticated)
// =============================================

/**
 * GET /api/points/balance
 * Get authenticated user's point balance
 */
router.get(
  '/balance',
  authenticateJWT(),
  pointController.getMyPointBalance.bind(pointController)
);

/**
 * GET /api/points/history
 * Get authenticated user's point transaction history
 */
router.get(
  '/history',
  authenticateJWT(),
  pointController.getMyTransactionHistory.bind(pointController)
);

/**
 * POST /api/points/use
 * Use points for service payment
 */
router.post(
  '/use',
  authenticateJWT(),
  pointController.usePoints.bind(pointController)
);

// =============================================
// SYSTEM POINT ENDPOINTS (Internal use)
// =============================================

/**
 * POST /api/points/earn
 * Create point earning transaction (system use)
 * This endpoint is used internally by the system to award points
 */
router.post(
  '/earn',
  authenticateJWT(),
  pointController.earnPoints.bind(pointController)
);

// =============================================
// ADMIN POINT ENDPOINTS (Admin only)
// =============================================

/**
 * POST /api/points/adjust
 * Admin point adjustment (admin only)
 */
router.post(
  '/adjust',
  authenticateJWT(),
  pointController.adjustPoints.bind(pointController)
);

export default router; 