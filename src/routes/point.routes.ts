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
 * GET /api/users/:userId/points/balance
 * Get user's point balance
 */
router.get(
  '/users/:userId/points/balance',
  authenticateJWT,
  pointController.getUserPointBalance.bind(pointController)
);

/**
 * GET /api/users/:userId/points/history
 * Get user's point transaction history
 */
router.get(
  '/users/:userId/points/history',
  authenticateJWT,
  pointController.getUserTransactionHistory.bind(pointController)
);

/**
 * POST /api/points/use
 * Use points for service payment
 */
router.post(
  '/points/use',
  authenticateJWT,
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
  '/points/earn',
  authenticateJWT,
  pointController.earnPoints.bind(pointController)
);

// =============================================
// ADMIN POINT ENDPOINTS (Admin only)
// =============================================

/**
 * POST /api/admin/points/adjust
 * Admin point adjustment (admin only)
 */
router.post(
  '/admin/points/adjust',
  authenticateJWT,
  pointController.adjustPoints.bind(pointController)
);

export default router; 