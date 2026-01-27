/**
 * User Blocking Routes
 *
 * API routes for user blocking functionality.
 */

import { Router } from 'express';
import { userBlockingController } from '../controllers/user-blocking.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { strictRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();

// Rate limiter for blocking operations (more restrictive)
// 30 requests per 15 minutes
const blockingLimiter = strictRateLimit(30, 15 * 60 * 1000);

// General limiter for read operations
// 100 requests per 15 minutes
const readLimiter = strictRateLimit(100, 15 * 60 * 1000);

/**
 * @swagger
 * tags:
 *   name: User Blocking
 *   description: User blocking management
 */

/**
 * @swagger
 * /api/users/block:
 *   post:
 *     summary: Block a user
 *     tags: [User Blocking]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *                 format: uuid
 *                 description: ID of the user to block
 *               reason:
 *                 type: string
 *                 enum: [spam, harassment, inappropriate_content, fake_account, other]
 *                 description: Reason for blocking
 *               description:
 *                 type: string
 *                 description: Optional detailed description
 *     responses:
 *       201:
 *         description: User blocked successfully
 *       400:
 *         description: Invalid request
 *       401:
 *         description: Unauthorized
 *       409:
 *         description: User already blocked
 */
router.post(
  '/block',
  authenticateJWT,
  blockingLimiter,
  userBlockingController.blockUser.bind(userBlockingController)
);

/**
 * @swagger
 * /api/users/block/{userId}:
 *   delete:
 *     summary: Unblock a user
 *     tags: [User Blocking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID of the user to unblock
 *     responses:
 *       200:
 *         description: User unblocked successfully
 *       401:
 *         description: Unauthorized
 */
router.delete(
  '/block/:userId',
  authenticateJWT,
  blockingLimiter,
  userBlockingController.unblockUser.bind(userBlockingController)
);

/**
 * @swagger
 * /api/users/blocked:
 *   get:
 *     summary: Get list of blocked users
 *     tags: [User Blocking]
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
 *     responses:
 *       200:
 *         description: List of blocked users
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/blocked',
  authenticateJWT,
  readLimiter,
  userBlockingController.getBlockedUsers.bind(userBlockingController)
);

/**
 * @swagger
 * /api/users/blocked/ids:
 *   get:
 *     summary: Get IDs of blocked users (for content filtering)
 *     tags: [User Blocking]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Array of blocked user IDs
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/blocked/ids',
  authenticateJWT,
  readLimiter,
  userBlockingController.getBlockedUserIds.bind(userBlockingController)
);

/**
 * @swagger
 * /api/users/block/check/{userId}:
 *   get:
 *     summary: Check if a user is blocked
 *     tags: [User Blocking]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *     responses:
 *       200:
 *         description: Block status
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/block/check/:userId',
  authenticateJWT,
  readLimiter,
  userBlockingController.checkIsBlocked.bind(userBlockingController)
);

export default router;
