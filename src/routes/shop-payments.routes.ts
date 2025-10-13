/**
 * Shop-Scoped Payment Routes
 *
 * Provides payment viewing endpoints for shop owners and managers.
 * All endpoints are scoped to a specific shop (/api/shops/:shopId/payments)
 *
 * Access Control:
 * - Platform admins (super_admin, admin): Can access any shop
 * - Shop roles (shop_owner, shop_manager, shop_admin, manager): Only their own shop
 */

import { Router } from 'express';
import { ShopPaymentsController } from '../controllers/shop-payments.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { validateShopAccess } from '../middleware/shop-access.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { logger } from '../utils/logger';

const router = Router({ mergeParams: true }); // mergeParams to access :shopId from parent router
const controller = new ShopPaymentsController();

// Apply authentication and shop access validation to ALL routes
router.use(authenticateJWT());
router.use(validateShopAccess);

/**
 * @swagger
 * /api/shops/{shopId}/payments:
 *   get:
 *     summary: Get shop payments
 *     description: Retrieve payment records for a specific shop with filtering options
 *     tags: [Shop Management - Payments]
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
 *           enum: [pending, completed, failed, refunded, partially_refunded]
 *         description: Filter by payment status
 *       - name: paymentMethod
 *         in: query
 *         schema:
 *           type: string
 *           enum: [card, cash, points, mixed]
 *         description: Filter by payment method
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
 *       - name: reservationId
 *         in: query
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by reservation ID
 *       - name: minAmount
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Minimum payment amount
 *       - name: maxAmount
 *         in: query
 *         schema:
 *           type: integer
 *           minimum: 0
 *         description: Maximum payment amount
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
 *         description: Payments retrieved successfully
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
 *                     payments:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Payment'
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
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalAmount:
 *                           type: integer
 *                         totalRefunded:
 *                           type: integer
 *                         netAmount:
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
      await controller.getShopPayments(req as any, res);
    } catch (error) {
      logger.error('Error in shop payments route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 내역 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

/**
 * @swagger
 * /api/shops/{shopId}/payments/{paymentId}:
 *   get:
 *     summary: Get payment details
 *     description: Retrieve detailed information about a specific payment
 *     tags: [Shop Management - Payments]
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
 *       - name: paymentId
 *         in: path
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     responses:
 *       200:
 *         description: Payment details retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Payment'
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied - not authorized for this shop
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.get('/:paymentId',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 100 requests per 15 minutes
  async (req, res) => {
    try {
      await controller.getPaymentDetails(req as any, res);
    } catch (error) {
      logger.error('Error in get payment details route', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.params.shopId,
        paymentId: req.params.paymentId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 상세 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
);

// Error handling middleware for shop payment routes
router.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error in shop payment routes', {
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
      message: '결제 관리 중 오류가 발생했습니다.',
      details: '잠시 후 다시 시도해주세요.'
    }
  });
});

export default router;
