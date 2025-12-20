/**
 * Shop Owner Notification Routes
 * Routes for shop owners to view and manage notifications from admin
 */

import { Router } from 'express';
import { shopOwnerNotificationController } from '../controllers/shop-owner-notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';

const router = Router();

// All routes require authentication and shop owner status
router.use(authenticateJWT());
router.use(requireShopOwnerWithShop);

/**
 * GET /api/shop-owner/notifications
 * Get notifications for the shop
 */
router.get(
  '/',
  shopOwnerNotificationController.getNotifications.bind(shopOwnerNotificationController)
);

/**
 * POST /api/shop-owner/notifications/read-all
 * Mark all notifications as read
 */
router.post(
  '/read-all',
  shopOwnerNotificationController.markAllAsRead.bind(shopOwnerNotificationController)
);

/**
 * POST /api/shop-owner/notifications/:id/read
 * Mark a specific notification as read
 */
router.post(
  '/:id/read',
  shopOwnerNotificationController.markAsRead.bind(shopOwnerNotificationController)
);

export default router;
