import { Router } from 'express';
import NotificationController from '../controllers/notification.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireShopOwnerWithShop } from '../middleware/shop-owner-auth.middleware';
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
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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
 *     summary: Register device token for push notifications (Register device token for push notifications)
 *     description: Register a device token to receive push notifications
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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

/**
 * @swagger
 * /register:
 *   post:
 *     summary: POST /register (POST /register)
 *     description: POST endpoint for /register
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.post('/register',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // Low rate limit for token registration
  notificationController.registerDeviceToken.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/unregister:
 *   post:
 *     summary: Unregister device token (Unregister device token)
 *     description: Unregister a device token to stop receiving push notifications
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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
/**
 * @swagger
 * /unregister:
 *   post:
 *     summary: POST /unregister (POST /unregister)
 *     description: POST endpoint for /unregister
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notification]
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

router.post('/unregister',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  notificationController.unregisterDeviceToken.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/send:
 *   post:
 *     summary: Send notification to current user (Send notification to current user)
 *     description: Send a test notification to the authenticated user
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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

/**
 * @swagger
 * /send:
 *   post:
 *     summary: POST /send (POST /send)
 *     description: POST endpoint for /send
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.post('/send',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 5 } }), // Very low rate limit for sending notifications
  notificationController.sendNotificationToSelf.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/template:
 *   post:
 *     summary: Send template notification (Send template notification)
 *     description: Send a notification using a predefined template
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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

/**
 * @swagger
 * /template:
 *   post:
 *     summary: POST /template (POST /template)
 *     description: POST endpoint for /template
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.post('/template',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 5 } }),
  notificationController.sendTemplateNotification.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/templates:
 *   get:
 *     summary: notification templates 조회
 *     description: Retrieve all available notification templates
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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
 *     summary: user notification settings 조회
 *     description: Retrieve notification settings for the authenticated user
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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
 * /api/notifications/preferences:
 *   get:
 *     summary: user notification preferences 조회 (alias for settings)
 *     description: Retrieve notification preferences for the authenticated user (same as /settings)
 *
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *
 *       ---
 *
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Notification preferences retrieved successfully
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
router.get('/preferences',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUserNotificationSettings.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/settings:
 *   put:
 *     summary: user notification settings 수정
 *     description: Update notification settings for the authenticated user
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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
 *     summary: user notification history 조회
 *     description: Retrieve notification history for the authenticated user
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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

/**
 * @swagger
 * /history:
 *   get:
 *     summary: /history 조회
 *     description: GET endpoint for /history
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.get('/history',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUserNotificationHistory.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/tokens:
 *   get:
 *     summary: user device tokens 조회
 *     description: Retrieve all active device tokens for the authenticated user
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
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

// ===== USER NOTIFICATION INBOX ENDPOINTS =====
// ⚠️ IMPORTANT: Specific routes MUST come before parameterized routes (/:notificationId)

/**
 * @swagger
 * /api/notifications/unread-count:
 *   get:
 *     summary: Get unread notification count
 *     description: Get the count of unread notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Unread count retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/unread-count',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getUnreadCount.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/read-all:
 *   post:
 *     summary: Mark all notifications as read
 *     description: Mark all unread notifications as read for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All notifications marked as read
 *       401:
 *         description: Unauthorized
 */
router.post('/read-all',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  notificationController.markAllAsRead.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/read:
 *   delete:
 *     summary: Delete all read notifications
 *     description: Soft delete all read notifications for the authenticated user
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Read notifications deleted successfully
 *       401:
 *         description: Unauthorized
 */
router.delete('/read',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  notificationController.deleteAllRead.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   get:
 *     summary: Get single notification by ID
 *     description: Retrieve a single notification for the authenticated user
 *     tags: [Notifications]
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
 *         description: Notification retrieved successfully
 *       404:
 *         description: Notification not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:notificationId',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getNotification.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/{notificationId}:
 *   delete:
 *     summary: Delete notification
 *     description: Soft delete a single notification for the authenticated user
 *     tags: [Notifications]
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
 *         description: Notification deleted successfully
 *       400:
 *         description: Delete failed
 *       401:
 *         description: Unauthorized
 */
router.delete('/:notificationId',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  notificationController.deleteNotification.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/preferences:
 *   put:
 *     summary: Update notification preferences
 *     description: Update notification preferences for the authenticated user (alias for /settings)
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
 *         description: Preferences updated successfully
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized
 */
router.put('/preferences',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  notificationController.updateUserNotificationSettings.bind(notificationController)
);

// ===== SHOP OWNER NOTIFICATION ROUTES =====

/**
 * @swagger
 * /api/notifications/shop/reservations:
 *   get:
 *     summary: shop reservation notifications 조회
 *     description: Retrieve reservation notifications for the authenticated shop owner
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Shop Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           default: unread
 *           enum: [unread, read, all]
 *         description: Filter by notification status
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: Number of notifications to retrieve
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of notifications to skip
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for filtering
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for filtering
 *     responses:
 *       200:
 *         description: Shop reservation notifications retrieved successfully
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
 *                     shopId:
 *                       type: string
 *                     notifications:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           templateType:
 *                             type: string
 *                           title:
 *                             type: string
 *                           body:
 *                             type: string
 *                           status:
 *                             type: string
 *                           deliveryAttempts:
 *                             type: number
 *                           successfulDeliveries:
 *                             type: number
 *                           failedDeliveries:
 *                             type: number
 *                           createdAt:
 *                             type: string
 *                             format: date-time
 *                     total:
 *                       type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Shop owner authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /shop/reservations:
 *   get:
 *     summary: /shop/reservations 조회
 *     description: GET endpoint for /shop/reservations
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.get('/shop/reservations',
  authenticateJWT,
  ...requireShopOwnerWithShop(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getShopReservationNotifications.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/shop/send:
 *   post:
 *     summary: Send reservation notification to customer (Send reservation notification to customer)
 *     description: Send a reservation notification to a customer from the shop owner
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Shop Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reservationId
 *               - notificationType
 *             properties:
 *               reservationId:
 *                 type: string
 *                 description: ID of the reservation
 *               notificationType:
 *                 type: string
 *                 enum: [reservation_requested, reservation_confirmed, reservation_rejected, reservation_completed, reservation_cancelled, reservation_no_show, reservation_reminder]
 *                 description: Type of notification to send
 *               customMessage:
 *                 type: string
 *                 description: Custom message to include with the notification
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *                 default: medium
 *                 description: Notification priority level
 *               useFallback:
 *                 type: boolean
 *                 default: true
 *                 description: Whether to use fallback delivery system
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
 *                     reservationId:
 *                       type: string
 *                     customerId:
 *                       type: string
 *                     notificationType:
 *                       type: string
 *                     priority:
 *                       type: string
 *                     deliveryMethod:
 *                       type: string
 *                     result:
 *                       type: object
 *                       properties:
 *                         success:
 *                           type: boolean
 *                         deliveryResults:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               channel:
 *                                 type: string
 *                               success:
 *                                 type: boolean
 *                               messageId:
 *                                 type: string
 *                               deliveredAt:
 *                                 type: string
 *                                 format: date-time
 *                         finalStatus:
 *                           type: string
 *                           enum: [delivered, partially_delivered, failed]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Shop owner authentication required
 *       404:
 *         description: Reservation not found or not owned by shop
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /shop/send:
 *   post:
 *     summary: POST /shop/send (POST /shop/send)
 *     description: POST endpoint for /shop/send
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.post('/shop/send',
  authenticateJWT,
  ...requireShopOwnerWithShop(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  notificationController.sendReservationNotificationToCustomer.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/shop/preferences:
 *   get:
 *     summary: shop owner notification preferences 조회
 *     description: Retrieve notification preferences for the authenticated shop owner
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Shop Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Shop owner notification preferences retrieved successfully
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
 *                     shopId:
 *                       type: string
 *                     preferences:
 *                       type: object
 *                       properties:
 *                         reservationNotifications:
 *                           type: object
 *                           properties:
 *                             newRequest:
 *                               type: boolean
 *                             confirmed:
 *                               type: boolean
 *                             cancelled:
 *                               type: boolean
 *                             completed:
 *                               type: boolean
 *                             noShow:
 *                               type: boolean
 *                             reminder:
 *                               type: boolean
 *                         deliveryPreferences:
 *                           type: object
 *                           properties:
 *                             websocket:
 *                               type: boolean
 *                             push:
 *                               type: boolean
 *                             email:
 *                               type: boolean
 *                             sms:
 *                               type: boolean
 *                         timingPreferences:
 *                           type: object
 *                           properties:
 *                             reminderHoursBefore:
 *                               type: number
 *                             quietHoursStart:
 *                               type: string
 *                             quietHoursEnd:
 *                               type: string
 *                         prioritySettings:
 *                           type: object
 *                           properties:
 *                             newRequest:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             confirmed:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             cancelled:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             completed:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             noShow:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                             reminder:
 *                               type: string
 *                               enum: [low, medium, high, critical]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Shop owner authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /shop/preferences:
 *   get:
 *     summary: /shop/preferences 조회
 *     description: GET endpoint for /shop/preferences
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.get('/shop/preferences',
  authenticateJWT,
  ...requireShopOwnerWithShop(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  notificationController.getShopOwnerNotificationPreferences.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/shop/preferences:
 *   put:
 *     summary: shop owner notification preferences 수정
 *     description: Update notification preferences for the authenticated shop owner
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Shop Notifications]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               preferences:
 *                 type: object
 *                 properties:
 *                   reservationNotifications:
 *                     type: object
 *                     properties:
 *                       newRequest:
 *                         type: boolean
 *                       confirmed:
 *                         type: boolean
 *                       cancelled:
 *                         type: boolean
 *                       completed:
 *                         type: boolean
 *                       noShow:
 *                         type: boolean
 *                       reminder:
 *                         type: boolean
 *                   deliveryPreferences:
 *                     type: object
 *                     properties:
 *                       websocket:
 *                         type: boolean
 *                       push:
 *                         type: boolean
 *                       email:
 *                         type: boolean
 *                       sms:
 *                         type: boolean
 *                   timingPreferences:
 *                     type: object
 *                     properties:
 *                       reminderHoursBefore:
 *                         type: number
 *                       quietHoursStart:
 *                         type: string
 *                       quietHoursEnd:
 *                         type: string
 *                   prioritySettings:
 *                     type: object
 *                     properties:
 *                       newRequest:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       confirmed:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       cancelled:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       completed:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       noShow:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *                       reminder:
 *                         type: string
 *                         enum: [low, medium, high, critical]
 *     responses:
 *       200:
 *         description: Shop owner notification preferences updated successfully
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
 *                     shopId:
 *                       type: string
 *                     preferences:
 *                       type: object
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Shop owner authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /shop/preferences:
 *   put:
 *     summary: PUT /shop/preferences (PUT /shop/preferences)
 *     description: PUT endpoint for /shop/preferences
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.put('/shop/preferences',
  authenticateJWT,
  ...requireShopOwnerWithShop(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  notificationController.updateShopOwnerNotificationPreferences.bind(notificationController)
);

/**
 * @swagger
 * /api/notifications/shop/analytics:
 *   get:
 *     summary: shop notification delivery analytics 조회
 *     description: Retrieve notification delivery analytics for the authenticated shop
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Shop Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics
 *       - in: query
 *         name: templateType
 *         schema:
 *           type: string
 *         description: Filter by template type
 *     responses:
 *       200:
 *         description: Shop notification analytics retrieved successfully
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
 *                     shopId:
 *                       type: string
 *                     analytics:
 *                       type: object
 *                       properties:
 *                         totalNotifications:
 *                           type: number
 *                         deliveryStats:
 *                           type: object
 *                           properties:
 *                             delivered:
 *                               type: number
 *                             partiallyDelivered:
 *                               type: number
 *                             failed:
 *                               type: number
 *                             pending:
 *                               type: number
 *                         templateStats:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               templateType:
 *                                 type: string
 *                               totalSent:
 *                                 type: number
 *                               successRate:
 *                                 type: number
 *                               averageDeliveryTime:
 *                                 type: number
 *                         timeSeriesData:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               sent:
 *                                 type: number
 *                               delivered:
 *                                 type: number
 *                               failed:
 *                                 type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Shop owner authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /shop/analytics:
 *   get:
 *     summary: /shop/analytics 조회
 *     description: GET endpoint for /shop/analytics
 *       
 *       알림 관련 API입니다. 푸시 알림과 알림 설정을 관리합니다.
 *       
 *       ---
 *       
 *     tags: [Notifications]
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
router.get('/shop/analytics',
  authenticateJWT,
  ...requireShopOwnerWithShop(),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  notificationController.getShopNotificationAnalytics.bind(notificationController)
);

export default router; 