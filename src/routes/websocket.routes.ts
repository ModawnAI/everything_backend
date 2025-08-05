import { Router } from 'express';
import WebSocketController from '../controllers/websocket.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const websocketController = new WebSocketController();

/**
 * @swagger
 * components:
 *   schemas:
 *     WebSocketConnection:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Connection ID
 *         userId:
 *           type: string
 *           description: User ID
 *         userRole:
 *           type: string
 *           description: User role
 *         rooms:
 *           type: array
 *           items:
 *             type: string
 *           description: List of room IDs
 *         connectedAt:
 *           type: string
 *           format: date-time
 *           description: Connection timestamp
 *         lastActivity:
 *           type: string
 *           format: date-time
 *           description: Last activity timestamp
 *     WebSocketRoom:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Room ID
 *         name:
 *           type: string
 *           description: Room name
 *         type:
 *           type: string
 *           enum: [admin, user, shop, reservation]
 *           description: Room type
 *         participants:
 *           type: array
 *           items:
 *             type: string
 *           description: List of participant user IDs
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Room creation timestamp
 *     AdminNotification:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Notification ID
 *         type:
 *           type: string
 *           enum: [reservation_update, payment_update, shop_approval, system_alert]
 *           description: Notification type
 *         title:
 *           type: string
 *           description: Notification title
 *         message:
 *           type: string
 *           description: Notification message
 *         data:
 *           type: object
 *           additionalProperties: true
 *           description: Additional notification data
 *         priority:
 *           type: string
 *           enum: [low, medium, high, urgent]
 *           description: Notification priority
 *         createdAt:
 *           type: string
 *           format: date-time
 *           description: Creation timestamp
 *     ReservationUpdate:
 *       type: object
 *       properties:
 *         reservationId:
 *           type: string
 *           description: Reservation ID
 *         status:
 *           type: string
 *           description: Reservation status
 *         shopId:
 *           type: string
 *           description: Shop ID
 *         userId:
 *           type: string
 *           description: User ID
 *         updateType:
 *           type: string
 *           enum: [created, confirmed, cancelled, modified]
 *           description: Update type
 *         timestamp:
 *           type: string
 *           format: date-time
 *           description: Update timestamp
 *         data:
 *           type: object
 *           additionalProperties: true
 *           description: Additional update data
 */

/**
 * @swagger
 * /api/websocket/stats:
 *   get:
 *     summary: Get WebSocket connection statistics
 *     description: Retrieve WebSocket connection statistics and room information
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: WebSocket statistics retrieved successfully
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
 *                     stats:
 *                       type: object
 *                       properties:
 *                         totalConnections:
 *                           type: number
 *                           description: Total number of connections
 *                         activeRooms:
 *                           type: number
 *                           description: Number of active rooms
 *                         connectionsByRole:
 *                           type: object
 *                           additionalProperties:
 *                             type: number
 *                           description: Connections grouped by user role
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/stats',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  websocketController.getConnectionStats.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/rooms:
 *   get:
 *     summary: Get all active rooms
 *     description: Retrieve all active WebSocket rooms accessible to the user
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Active rooms retrieved successfully
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
 *                     rooms:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/WebSocketRoom'
 *                     totalCount:
 *                       type: number
 *                       description: Total number of accessible rooms
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/rooms',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  websocketController.getAllRooms.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/rooms/{roomId}:
 *   get:
 *     summary: Get room information
 *     description: Retrieve detailed information about a specific WebSocket room
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: roomId
 *         required: true
 *         schema:
 *           type: string
 *         description: Room ID
 *     responses:
 *       200:
 *         description: Room information retrieved successfully
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
 *                     room:
 *                       $ref: '#/components/schemas/WebSocketRoom'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request - Room ID required
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Access denied to admin room
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.get('/rooms/:roomId',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  websocketController.getRoomInfo.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/admin/notification:
 *   post:
 *     summary: Send admin notification
 *     description: Send a notification to all admin users via WebSocket
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - type
 *               - title
 *               - message
 *             properties:
 *               type:
 *                 type: string
 *                 enum: [reservation_update, payment_update, shop_approval, system_alert]
 *                 description: Notification type
 *               title:
 *                 type: string
 *                 description: Notification title
 *               message:
 *                 type: string
 *                 description: Notification message
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Additional notification data
 *               priority:
 *                 type: string
 *                 enum: [low, medium, high, urgent]
 *                 default: medium
 *                 description: Notification priority
 *     responses:
 *       200:
 *         description: Admin notification sent successfully
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
 *                     type:
 *                       type: string
 *                     priority:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/admin/notification',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
  websocketController.sendAdminNotification.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/reservation/update:
 *   post:
 *     summary: Send reservation update
 *     description: Send a reservation update to relevant users via WebSocket
 *     tags: [WebSocket]
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
 *               - status
 *               - shopId
 *               - updateType
 *             properties:
 *               reservationId:
 *                 type: string
 *                 description: Reservation ID
 *               status:
 *                 type: string
 *                 description: Reservation status
 *               shopId:
 *                 type: string
 *                 description: Shop ID
 *               updateType:
 *                 type: string
 *                 enum: [created, confirmed, cancelled, modified]
 *                 description: Update type
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Additional update data
 *     responses:
 *       200:
 *         description: Reservation update sent successfully
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
 *                     updateType:
 *                       type: string
 *                     status:
 *                       type: string
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
router.post('/reservation/update',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  websocketController.sendReservationUpdate.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/user/message:
 *   post:
 *     summary: Send message to specific user
 *     description: Send a message to a specific user via WebSocket
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - targetUserId
 *               - event
 *             properties:
 *               targetUserId:
 *                 type: string
 *                 description: Target user ID
 *               event:
 *                 type: string
 *                 description: Event name
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Event data
 *     responses:
 *       200:
 *         description: Message sent to user successfully
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
 *                     targetUserId:
 *                       type: string
 *                     event:
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
 *       403:
 *         description: Forbidden - Cannot send message to other users
 *       500:
 *         description: Internal server error
 */
router.post('/user/message',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }),
  websocketController.sendToUser.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/room/message:
 *   post:
 *     summary: Send message to room
 *     description: Send a message to all users in a specific room via WebSocket
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - roomId
 *               - event
 *             properties:
 *               roomId:
 *                 type: string
 *                 description: Room ID
 *               event:
 *                 type: string
 *                 description: Event name
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Event data
 *     responses:
 *       200:
 *         description: Message sent to room successfully
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
 *                     roomId:
 *                       type: string
 *                     event:
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
 *       403:
 *         description: Forbidden - Cannot send message to admin room
 *       404:
 *         description: Room not found
 *       500:
 *         description: Internal server error
 */
router.post('/room/message',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }),
  websocketController.sendToRoom.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/broadcast:
 *   post:
 *     summary: Broadcast message to all clients
 *     description: Broadcast a message to all connected WebSocket clients (admin only)
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - event
 *             properties:
 *               event:
 *                 type: string
 *                 description: Event name
 *               data:
 *                 type: object
 *                 additionalProperties: true
 *                 description: Event data
 *     responses:
 *       200:
 *         description: Message broadcasted successfully
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
 *                     event:
 *                       type: string
 *                     broadcastAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Invalid request data
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/broadcast',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
  websocketController.broadcastMessage.bind(websocketController)
);

/**
 * @swagger
 * /api/websocket/cleanup:
 *   post:
 *     summary: Clean up inactive connections
 *     description: Clean up inactive WebSocket connections (admin only)
 *     tags: [WebSocket]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Inactive connections cleaned up successfully
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
 *                     cleanedAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Authentication required
 *       403:
 *         description: Forbidden - Admin access required
 *       500:
 *         description: Internal server error
 */
router.post('/cleanup',
  authenticateJWT,
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 5 } }),
  websocketController.cleanupInactiveConnections.bind(websocketController)
);

export default router; 