import { Router } from 'express';
import { adminPushNotificationController } from '../controllers/admin-push-notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdminAuth } from '../middleware/admin-auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Apply authentication, admin authorization, and rate limiting to all routes
router.use(authenticateJWT());
router.use(requireAdminAuth);
router.use(rateLimit());

/**
 * POST /api/admin/push/send
 * Send push notification to users
 */
router.post('/send', adminPushNotificationController.sendPushNotification);

/**
 * GET /api/admin/push/history
 * Get push notification history
 */
router.get('/history', adminPushNotificationController.getPushHistory);

/**
 * GET /api/admin/push/:id
 * Get push notification details
 */
router.get('/:id', adminPushNotificationController.getPushNotificationById);

export default router;
