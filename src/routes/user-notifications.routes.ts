/**
 * User Notifications Routes
 *
 * Routes for user notification inbox and management
 */

import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const notificationController = new NotificationController();

/**
 * @swagger
 * /api/user/notifications:
 *   get:
 *     summary: Get user notification inbox
 *     description: Retrieve paginated list of notifications for the authenticated user
 *     tags: [User Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number (1-indexed)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of notifications per page
 *       - in: query
 *         name: unreadOnly
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Filter to show only unread notifications
 *     responses:
 *       200:
 *         description: Notifications retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           title:
 *                             type: string
 *                           body:
 *                             type: string
 *                           data:
 *                             type: object
 *                           status:
 *                             type: string
 *                           read:
 *                             type: boolean
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUserNotificationHistory.bind(notificationController)
);

/**
 * @swagger
 * /api/user/notifications/{notificationId}/read:
 *   put:
 *     summary: Mark notification as read
 *     description: Mark a single notification as read for the authenticated user
 *     tags: [User Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: notificationId
 *         required: true
 *         schema:
 *           type: string
 *         description: Notification ID
 *     responses:
 *       200:
 *         description: Notification marked as read
 *       400:
 *         description: Update failed
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.put('/:notificationId/read',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.markAsRead.bind(notificationController)
);

export default router;
