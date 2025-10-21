import { Router } from 'express';
import { authenticateJWT, requireRole } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import adminPaymentController from '../controllers/admin-payment.controller';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PaymentFilters:
 *       type: object
 *       properties:
 *         status:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled, refunded]
 *         paymentMethod:
 *           type: string
 *           enum: [card, transfer, cash, points]
 *         shopId:
 *           type: string
 *           format: uuid
 *         userId:
 *           type: string
 *           format: uuid
 *         startDate:
 *           type: string
 *           format: date
 *         endDate:
 *           type: string
 *           format: date
 *         minAmount:
 *           type: number
 *         maxAmount:
 *           type: number
 *         isDeposit:
 *           type: boolean
 *         hasRefund:
 *           type: boolean
 *         sortBy:
 *           type: string
 *           enum: [paid_at, created_at, amount, customer_name, shop_name]
 *         sortOrder:
 *           type: string
 *           enum: [asc, desc]
 *         page:
 *           type: integer
 *           minimum: 1
 *         limit:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *     
 *     RefundRequest:
 *       type: object
 *       required:
 *         - refundAmount
 *         - reason
 *         - refundMethod
 *       properties:
 *         refundAmount:
 *           type: number
 *           minimum: 0
 *         reason:
 *           type: string
 *         refundMethod:
 *           type: string
 *           enum: [original, points]
 *         notes:
 *           type: string
 *         notifyCustomer:
 *           type: boolean
 *           default: true
 *     
 *     PaymentListResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             payments:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   reservationId:
 *                     type: string
 *                   userId:
 *                     type: string
 *                   paymentMethod:
 *                     type: string
 *                   paymentStatus:
 *                     type: string
 *                   amount:
 *                     type: number
 *                   currency:
 *                     type: string
 *                   isDeposit:
 *                     type: boolean
 *                   paidAt:
 *                     type: string
 *                     format: date-time
 *                   refundedAt:
 *                     type: string
 *                     format: date-time
 *                   refundAmount:
 *                     type: number
 *                   netAmount:
 *                     type: number
 *                   customer:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       email:
 *                         type: string
 *                       phoneNumber:
 *                         type: string
 *                   shop:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       mainCategory:
 *                         type: string
 *                       shopStatus:
 *                         type: string
 *                   reservation:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       reservationDate:
 *                         type: string
 *                       reservationTime:
 *                         type: string
 *                       status:
 *                         type: string
 *                       totalAmount:
 *                         type: number
 *             totalCount:
 *               type: integer
 *             hasMore:
 *               type: boolean
 *             currentPage:
 *               type: integer
 *             totalPages:
 *               type: integer
 *         message:
 *           type: string
 *     
 *     PaymentSummary:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             totalPayments:
 *               type: integer
 *             totalAmount:
 *               type: number
 *             totalRefunds:
 *               type: number
 *             netRevenue:
 *               type: number
 *             averagePaymentAmount:
 *               type: number
 *             paymentsByStatus:
 *               type: object
 *             paymentsByMethod:
 *               type: object
 *             paymentsByShop:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   shopId:
 *                     type: string
 *                   shopName:
 *                     type: string
 *                   count:
 *                     type: integer
 *                   amount:
 *                     type: number
 *                   refunds:
 *                     type: number
 *                   netAmount:
 *                     type: number
 *             dailyPayments:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   date:
 *                     type: string
 *                   count:
 *                     type: integer
 *                   amount:
 *                     type: number
 *                   refunds:
 *                     type: number
 *                   netAmount:
 *                     type: number
 *         message:
 *           type: string
 *     
 *     SettlementReport:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             settlements:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   shopId:
 *                     type: string
 *                   shopName:
 *                     type: string
 *                   shopType:
 *                     type: string
 *                   commissionRate:
 *                     type: number
 *                   completedReservations:
 *                     type: integer
 *                   grossRevenue:
 *                     type: number
 *                   commissionAmount:
 *                     type: number
 *                   netPayout:
 *                     type: number
 *                   lastSettlementDate:
 *                     type: string
 *                     format: date-time
 *                   nextSettlementDate:
 *                     type: string
 *                     format: date-time
 *                   isEligibleForSettlement:
 *                     type: boolean
 *             summary:
 *               type: object
 *               properties:
 *                 totalShops:
 *                   type: integer
 *                 totalGrossRevenue:
 *                   type: number
 *                 totalCommissionAmount:
 *                   type: number
 *                 totalNetPayout:
 *                   type: number
 *                 averageCommissionRate:
 *                   type: number
 *             dateRange:
 *               type: object
 *               properties:
 *                 startDate:
 *                   type: string
 *                 endDate:
 *                   type: string
 *         message:
 *           type: string
 *     
 *     PaymentAnalytics:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         data:
 *           type: object
 *           properties:
 *             totalTransactions:
 *               type: integer
 *             successfulTransactions:
 *               type: integer
 *             failedTransactions:
 *               type: integer
 *             totalRevenue:
 *               type: number
 *             totalRefunds:
 *               type: number
 *             netRevenue:
 *               type: number
 *             averageTransactionValue:
 *               type: number
 *             conversionRate:
 *               type: number
 *             refundRate:
 *               type: number
 *             transactionsByMethod:
 *               type: object
 *             transactionsByStatus:
 *               type: object
 *             revenueTrends:
 *               type: object
 *               properties:
 *                 daily:
 *                   type: array
 *                 weekly:
 *                   type: array
 *                 monthly:
 *                   type: array
 *             topPerformingShops:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   shopId:
 *                     type: string
 *                   shopName:
 *                     type: string
 *                   revenue:
 *                     type: number
 *                   transactions:
 *                     type: integer
 *                   averageOrderValue:
 *                     type: number
 *         message:
 *           type: string
 */

/**
 * @swagger
 * /api/admin/payments:
 *   get:
 *     summary: comprehensive payment list with advanced filtering 조회
 *     description: Retrieve payment transactions with advanced filtering, sorting, and pagination capabilities
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled, refunded]
 *         description: Filter by payment status
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [card, transfer, cash, points]
 *         description: Filter by payment method
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by shop ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
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
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Minimum payment amount
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Maximum payment amount
 *       - in: query
 *         name: isDeposit
 *         schema:
 *           type: boolean
 *         description: Filter by deposit payments
 *       - in: query
 *         name: hasRefund
 *         schema:
 *           type: boolean
 *         description: Filter by payments with refunds
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [paid_at, created_at, amount, customer_name, shop_name]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 20
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Payment list retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentListResponse'
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Payments]
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
router.get('/',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 15 minutes, 100 requests
  (req, res) => adminPaymentController.getPayments(req, res)
);

/**
 * @swagger
 * /api/admin/payments/summary:
 *   get:
 *     summary: payment summary with aggregated statistics 조회
 *     description: Retrieve comprehensive payment summary with aggregated statistics and insights
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for summary calculation
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for summary calculation
 *     responses:
 *       200:
 *         description: Payment summary retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentSummary'
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/summary',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }), // 15 minutes, 50 requests
  (req, res) => adminPaymentController.getPaymentSummary(req, res)
);

/**
 * @swagger
 * /api/admin/payments/settlements:
 *   get:
 *     summary: comprehensive settlement report 조회
 *     description: Retrieve detailed settlement report for financial oversight and shop payouts
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for settlement period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for settlement period
 *     responses:
 *       200:
 *         description: Settlement report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SettlementReport'
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/settlements',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }), // 15 minutes, 30 requests
  (req, res) => adminPaymentController.getSettlementReport(req, res)
);

/**
 * @swagger
 * /api/admin/payments/analytics:
 *   get:
 *     summary: comprehensive payment analytics 조회
 *     description: Retrieve detailed payment analytics and business intelligence data
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics period
 *     responses:
 *       200:
 *         description: Payment analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/PaymentAnalytics'
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/analytics',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }), // 15 minutes, 30 requests
  (req, res) => adminPaymentController.getPaymentAnalytics(req, res)
);

/**
 * @swagger
 * /api/admin/payments/export:
 *   get:
 *     summary: Export payment data for external analysis (Export payment data for external analysis)
 *     description: Export payment data as CSV for external analysis and reporting
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, cancelled, refunded]
 *         description: Filter by payment status
 *       - in: query
 *         name: paymentMethod
 *         schema:
 *           type: string
 *           enum: [card, transfer, cash, points]
 *         description: Filter by payment method
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by shop ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by user ID
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
 *       - in: query
 *         name: minAmount
 *         schema:
 *           type: number
 *         description: Minimum payment amount
 *       - in: query
 *         name: maxAmount
 *         schema:
 *           type: number
 *         description: Maximum payment amount
 *       - in: query
 *         name: isDeposit
 *         schema:
 *           type: boolean
 *         description: Filter by deposit payments
 *       - in: query
 *         name: hasRefund
 *         schema:
 *           type: boolean
 *         description: Filter by payments with refunds
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [paid_at, created_at, amount, customer_name, shop_name]
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Payment data exported successfully as CSV
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /export:
 *   get:
 *     summary: /export 조회
 *     description: GET endpoint for /export
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Payments]
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
router.get('/export',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // 15 minutes, 10 requests (export is resource-intensive)
  (req, res) => adminPaymentController.exportPayments(req, res)
);

/**
 * @swagger
 * /api/admin/payments/{paymentId}:
 *   get:
 *     summary: detailed information for a specific payment 조회
 *     description: Retrieve comprehensive details for a specific payment transaction
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
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
 *                 data:
 *                   $ref: '#/components/schemas/PaymentListResponse/properties/data/properties/payments/items'
 *                 message:
 *                   type: string
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.get('/:paymentId',
  authenticateJWT(),
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }), // 15 minutes, 100 requests
  (req, res) => adminPaymentController.getPaymentDetails(req, res)
);

/**
 * @swagger
 * /api/admin/payments/{paymentId}/refund:
 *   post:
 *     summary: refund for a specific payment 처리
 *     description: Process refund for a specific payment with comprehensive tracking and customer notification
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/RefundRequest'
 *     responses:
 *       200:
 *         description: Refund processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: boolean
 *                     refund:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                         paymentId:
 *                           type: string
 *                         refundAmount:
 *                           type: number
 *                         reason:
 *                           type: string
 *                         refundMethod:
 *                           type: string
 *                         status:
 *                           type: string
 *                           enum: [pending, processed, failed]
 *                         processedAt:
 *                           type: string
 *                           format: date-time
 *                     payment:
 *                       type: object
 *                       properties:
 *                         previousStatus:
 *                           type: string
 *                         newStatus:
 *                           type: string
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                 message:
 *                   type: string
 *       400:
 *         description: Bad request - Invalid refund request
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */

/**
 * @swagger
 * /:paymentId/refund:
 *   post:
 *     summary: POST /:paymentId/refund (POST /:paymentId/refund)
 *     description: POST endpoint for /:paymentId/refund
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Payments]
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
router.post('/:paymentId/refund',
  authenticateJWT(),
  requireRole(['admin', 'shop_owner']), // Shop owners can refund their own shops
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }), // 15 minutes, 20 requests (refund operations)
  (req, res) => adminPaymentController.processRefund(req, res)
);

export default router; 