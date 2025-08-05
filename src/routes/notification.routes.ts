import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const notificationController = new NotificationController();

/**
 * @swagger
 * components:
 *   schemas:
 *     DeviceToken:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Device token ID
 *         userId:
 *           type: string
 *           description: User ID
 *         token:
 *           type: string
 *           description: Firebase device token
 *         deviceType:
 *           type: string
 *           enum: [android, ios, web]
 *           description: Device type
 *         isActive:
 *           type: boolean
 *           description: Whether the token is active
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     NotificationPayload:
 *       type: object
 *       properties:
 *         title:
 *           type: string
 *           description: Notification title
 *         body:
 *           type: string
 *           description: Notification body
 *         data:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Additional data for the notification
 *         imageUrl:
 *           type: string
 *           description: Image URL for the notification
 *         clickAction:
 *           type: string
 *           description: Action to perform when notification is clicked
 *     NotificationHistory:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Notification history ID
 *         userId:
 *           type: string
 *           description: User ID
 *         title:
 *           type: string
 *           description: Notification title
 *         body:
 *           type: string
 *           description: Notification body
 *         data:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Additional data
 *         status:
 *           type: string
 *           enum: [sent, failed, pending]
 *           description: Notification status
 *         sentAt:
 *           type: string
 *           format: date-time
 *           description: When the notification was sent
 *         errorMessage:
 *           type: string
 *           description: Error message if failed
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *     NotificationSettings:
 *       type: object
 *       properties:
 *         userId:
 *           type: string
 *           description: User ID
 *         pushEnabled:
 *           type: boolean
 *           description: Whether push notifications are enabled
 *         emailEnabled:
 *           type: boolean
 *           description: Whether email notifications are enabled
 *         smsEnabled:
 *           type: boolean
 *           description: Whether SMS notifications are enabled
 *         reservationUpdates:
 *           type: boolean
 *           description: Whether to receive reservation updates
 *         paymentNotifications:
 *           type: boolean
 *           description: Whether to receive payment notifications
 *         promotionalMessages:
 *           type: boolean
 *           description: Whether to receive promotional messages
 *         systemAlerts:
 *           type: boolean
 *           description: Whether to receive system alerts
 *         updatedAt:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *     NotificationTemplate:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Template ID
 *         title:
 *           type: string
 *           description: Template title
 *         body:
 *           type: string
 *           description: Template body
 *         data:
 *           type: object
 *           additionalProperties:
 *             type: string
 *           description: Template data
 *         imageUrl:
 *           type: string
 *           description: Template image URL
 *         clickAction:
 *           type: string
 *           description: Template click action
 */

/**
 * @swagger
 * /api/notifications/register:
 *   post:
 *     summary: Register device token for push notifications
 *     description: Register a device token to receive push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *               - deviceType
 *             properties:
 *               token:
 *                 type: string
 *                 description: Firebase device token
 *               deviceType:
 *                 type: string
 *                 enum: [android, ios, web]
 *                 description: Device type
 *     responses:
 *       200:
 *         description: Device token registered successfully
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
 *                     userId:
 *                       type: string
 *                     deviceType:
 *                       type: string
 *                     registeredAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/register',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // Low rate limit for token registration
  notificationController.registerDeviceToken.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/unregister:
 *   post:
 *     summary: Unregister device token
 *     description: Unregister a device token to stop receiving push notifications
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - token
 *             properties:
 *               token:
 *                 type: string
 *                 description: Firebase device token to unregister
 *     responses:
 *       200:
 *         description: Device token unregistered successfully
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
 *                     userId:
 *                       type: string
 *                     unregisteredAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/unregister',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  notificationController.unregisterDeviceToken.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send notification to current user
 *     description: Send a test notification to the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - body
 *             properties:
 *               title:
 *                 type: string
 *                 description: Notification title
 *               body:
 *                 type: string
 *                 description: Notification body
 *               data:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Additional data for the notification
 *     responses:
 *       200:
 *         description: Notification sent successfully
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
 *                     notificationId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/send',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 5 } }), // Very low rate limit for sending notifications
  notificationController.sendNotificationToSelf.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/template:
 *   post:
 *     summary: Send template notification
 *     description: Send a notification using a predefined template
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - templateId
 *             properties:
 *               templateId:
 *                 type: string
 *                 description: Template ID to use
 *               customData:
 *                 type: object
 *                 additionalProperties:
 *                   type: string
 *                 description: Custom data to include with the template
 *     responses:
 *       200:
 *         description: Template notification sent successfully
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
 *                     notificationId:
 *                       type: string
 *                     templateId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     sentAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/template',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 5 } }),
  notificationController.sendTemplateNotification.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/templates:
 *   get:
 *     summary: Get notification templates
 *     description: Retrieve all available notification templates
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification templates retrieved successfully
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
 *                     templates:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NotificationTemplate'
 *                     totalCount:
 *                       type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/templates',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  notificationController.getNotificationTemplates.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/settings:
 *   get:
 *     summary: Get user notification settings
 *     description: Retrieve notification settings for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification settings retrieved successfully
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
 *                     settings:
 *                       $ref: '#/components/schemas/NotificationSettings'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/settings',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUserNotificationSettings.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: Update user notification settings
 *     description: Update notification settings for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/NotificationSettings'
 *     responses:
 *       200:
 *         description: Notification settings updated successfully
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
 *                     settings:
 *                       $ref: '#/components/schemas/NotificationSettings'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.put('/settings',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  notificationController.updateUserNotificationSettings.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/history:
 *   get:
 *     summary: Get user notification history
 *     description: Retrieve notification history for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of notifications to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *     responses:
 *       200:
 *         description: Notification history retrieved successfully
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
 *                     history:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/NotificationHistory'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         limit:
 *                           type: integer
 *                         offset:
 *                           type: integer
 *                         total:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/history',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUserNotificationHistory.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/tokens:
 *   get:
 *     summary: Get user device tokens
 *     description: Retrieve all active device tokens for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Device tokens retrieved successfully
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
 *                     tokens:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/DeviceToken'
 *                     totalCount:
 *                       type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/tokens',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  notificationController.getUserDeviceTokens.bind(notificationController)
);

export default router; 