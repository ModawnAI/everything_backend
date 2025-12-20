/**
 * Admin Shop Notification Routes
 * Routes for super admin to manage shop notifications
 */

import { Router } from 'express';
import { adminShopNotificationController } from '../controllers/admin-shop-notification.controller';

const router = Router();

/**
 * GET /api/admin/shop-notifications
 * Get all shop notifications with stats
 */
router.get(
  '/',
  adminShopNotificationController.getNotifications.bind(adminShopNotificationController)
);

/**
 * GET /api/admin/shop-notifications/:id
 * Get a single notification by ID
 */
router.get(
  '/:id',
  adminShopNotificationController.getNotificationById.bind(adminShopNotificationController)
);

/**
 * POST /api/admin/shop-notifications
 * Create a new shop notification
 */
router.post(
  '/',
  adminShopNotificationController.createNotification.bind(adminShopNotificationController)
);

/**
 * POST /api/admin/shop-notifications/:id/send
 * Send a scheduled notification
 */
router.post(
  '/:id/send',
  adminShopNotificationController.sendNotification.bind(adminShopNotificationController)
);

/**
 * DELETE /api/admin/shop-notifications/:id
 * Delete a notification
 */
router.delete(
  '/:id',
  adminShopNotificationController.deleteNotification.bind(adminShopNotificationController)
);

export default router;
