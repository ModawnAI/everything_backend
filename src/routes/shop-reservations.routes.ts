/**
 * Shop-Scoped Reservation Routes
 *
 * Provides reservation management endpoints for shop owners and managers.
 * All endpoints are scoped to a specific shop (/api/shops/:shopId/reservations)
 *
 * Access Control:
 * - Platform admins (super_admin, admin): Can access any shop
 * - Shop roles (shop_owner, shop_manager, shop_admin, manager): Only their own shop
 */

import { Router } from 'express';
import { ShopReservationsController } from '../controllers/shop-reservations.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateShopAccess } from '../middleware/shop-access.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true }); // mergeParams to access :shopId from parent router
const controller = new ShopReservationsController();

// Apply authentication and shop access validation to ALL routes
router.use(authenticateJWT());
router.use(validateShopAccess);

/**
 * @swagger
 * /api/shops/{shopId}/reservations:
 *   get:
 *     summary: Get shop reservations
 *     description: Retrieve reservations for a specific shop with filtering options
 *     tags: [Shop Management - Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *       - name: status
 *         in: query
 *         schema:
 *           type: string
 *           enum: [requested, confirmed, completed, cancelled_by_user, cancelled_by_shop, no_show]
 *         description: Filter by reservation status
 *       - name: startDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter from date (YYYY-MM-DD)
 *       - name: endDate
 *         in: query
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter to date (YYYY-MM-DD)
 *       - name: userId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
 *       - name: page
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - name: limit
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Items per page
 *     responses:
 *       200:
 *         description: Reservations retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservations:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Reservation'
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         page:
 *                           type: integer
 *                         limit:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - not authorized for this shop
 *       500:
 *         description: Internal server error
 */
router.get('/',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      await controller.getShopReservations(req as any, res);
    } catch (error) {
      logger.error('Error in shop reservations route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/{shopId}/reservations/{reservationId}:
 *   patch:
 *     summary: Update reservation status
 *     description: Update the status of a specific reservation (confirm, complete, cancel)
 *     tags: [Shop Management - Reservations]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - name: shopId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *       - name: reservationId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Reservation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [confirmed, completed, cancelled_by_shop, no_show]
 *                 description: New reservation status
 *               reason:
 *                 type: string
 *                 maxLength: 500
 *                 description: Reason for status change (required for cancellation)
 *               notes:
 *                 type: string
 *                 maxLength: 1000
 *                 description: Additional notes
 *     responses:
 *       200:
 *         description: Reservation status updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     reservationId:
 *                       type: string
 *                       format: uuid
 *                     status:
 *                       type: string
 *                     updatedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - not authorized for this shop
 *       404:
 *         description: Reservation not found
 *       500:
 *         description: Internal server error
 */
router.patch('/:reservationId',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }), // 50 requests per 15 minutes
  async (req, res) => {
    try {
      await controller.updateReservationStatus(req as any, res);
    } catch (error) {
      logger.error('Error in update reservation status route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        reservationId: req.params.reservationId,
        body: req.body
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '예약 상태 업데이트 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for shop reservation routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop reservation routes', {
    error: error instanceof Error ? error.message : 'Unknown error',
    stack: error instanceof Error ? error.stack : undefined,
    shopId: req.params.shopId,
    url: req.url,
    method: req.method
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: '예약 관리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
