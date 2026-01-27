/**
 * Admin User Blocking Routes
 *
 * Admin API routes for managing user block notifications.
 */

import { Router } from 'express';
import { userBlockingController } from '../../controllers/user-blocking.controller';
import { authenticateJWT } from '../../middleware/auth.middleware';
import { requireRole } from '../../middleware/rbac.middleware';
import { createRateLimiter } from '../../middleware/rate-limit.middleware';

const router = Router();

// Rate limiter for admin operations
const adminLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 minutes
});

/**
 * @swagger
 * tags:
 *   name: Admin - User Blocking
 *   description: Admin endpoints for user blocking management
 */

/**
 * @swagger
 * /api/admin/blocks/notifications:
 *   get:
 *     summary: Get block notifications for review
 *     tags: [Admin - User Blocking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: unreviewed
 *         schema:
 *           type: boolean
 *         description: Filter to only show unreviewed notifications
 *     responses:
 *       200:
 *         description: List of block notifications
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/notifications',
  authenticateJWT,
  requireRole(['admin', 'super_admin']),
  adminLimiter,
  userBlockingController.getBlockNotifications.bind(userBlockingController)
);

/**
 * @swagger
 * /api/admin/blocks/notifications/{id}/review:
 *   patch:
 *     summary: Review a block notification
 *     tags: [Admin - User Blocking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *                 description: Review notes
 *     responses:
 *       200:
 *         description: Notification reviewed successfully
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.patch(
  '/notifications/:id/review',
  authenticateJWT,
  requireRole(['admin', 'super_admin']),
  adminLimiter,
  userBlockingController.reviewBlockNotification.bind(userBlockingController)
);

/**
 * @swagger
 * /api/admin/blocks/statistics:
 *   get:
 *     summary: Get block statistics for dashboard
 *     tags: [Admin - User Blocking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Block statistics
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.get(
  '/statistics',
  authenticateJWT,
  requireRole(['admin', 'super_admin']),
  adminLimiter,
  userBlockingController.getBlockStatistics.bind(userBlockingController)
);

export default router;
