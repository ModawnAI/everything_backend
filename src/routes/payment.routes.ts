/**
 * @swagger
 * tags:
 *   - name: 결제
 *     description: PortOne 연동 결제 API
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 */

/**
 * Payment Routes
 * 
 * Defines all payment-related API endpoints including:
 * - PortOne payment initialization and confirmation
 * - Webhook handling for payment status updates
 * - Payment history and details retrieval
 * - Success/failure redirect handlers
 */

import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { paymentRateLimit } from '../middleware/rate-limit.middleware';
import { portOneV2WebhookSecurity } from '../middleware/webhook-security.middleware';

const router = Router();
const paymentController = new PaymentController();

/**
 * Payment initialization and confirmation routes
 */

/**
 * @swagger
 * /api/payments/portone/prepare:
 *   post:
 *     summary: Initialize payment with PortOne (Initialize payment with PortOne)
 *     description: Prepare a payment transaction with PortOne for reservation deposit or full payment
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
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
 *               - amount
 *               - customerName
 *               - customerEmail
 *             properties:
 *               reservationId:
 *                 type: string
 *                 format: uuid
 *                 description: Reservation UUID
 *               amount:
 *                 type: integer
 *                 minimum: 1000
 *                 description: Payment amount in KRW
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *               customerEmail:
 *                 type: string
 *                 format: email
 *                 description: Customer email
 *               customerMobilePhone:
 *                 type: string
 *                 description: Customer mobile phone
 *               paymentType:
 *                 type: string
 *                 enum: [deposit, final]
 *                 description: Payment type
 *     responses:
 *       200:
 *         description: Payment preparation successful
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
 *                     paymentKey:
 *                       type: string
 *                     orderId:
 *                       type: string
 *                     amount:
 *                       type: integer
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       500:
 *         description: Internal server error
 */
router.post(
  '/portone/prepare',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.preparePayment.bind(paymentController)
);

/**
 * @swagger
 * /api/payments/portone/confirm:
 *   post:
 *     summary: Confirm payment with PortOne (Confirm payment with PortOne)
 *     description: Confirm and finalize a payment transaction with PortOne
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - paymentKey
 *               - orderId
 *               - amount
 *             properties:
 *               paymentKey:
 *                 type: string
 *                 description: PortOne payment key
 *               orderId:
 *                 type: string
 *                 description: Order identifier
 *               amount:
 *                 type: integer
 *                 description: Payment amount in KRW
 *     responses:
 *       200:
 *         description: Payment confirmation successful
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
 *                     paymentId:
 *                       type: string
 *                     status:
 *                       type: string
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid payment parameters
 *       401:
 *         description: Authentication required
 *       402:
 *         description: Payment failed
 *       500:
 *         description: Internal server error
 */
router.post(
  '/portone/confirm',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.confirmPayment.bind(paymentController)
);

/**
 * Two-stage payment routes
 */

// POST /api/payments/deposit/prepare
// Prepare deposit payment (20-30% of total amount)
router.post(
  '/deposit/prepare',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.prepareDepositPayment.bind(paymentController)
);

// POST /api/payments/final/prepare
// Prepare final payment (remaining amount after service completion)
router.post(
  '/final/prepare',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.prepareFinalPayment.bind(paymentController)
);

// GET /api/payments/status/:reservationId
// Get comprehensive payment status for a reservation
router.get(
  '/status/:reservationId',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.getPaymentStatus.bind(paymentController)
);

/**
 * Webhook routes
 */

/**
 * @swagger
 * /api/webhooks/portone:
 *   post:
 *     summary: Handle PortOne webhooks (Handle PortOne webhooks)
 *     description: Receive and process webhook notifications from PortOne for payment status updates
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             description: PortOne webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       500:
 *         description: Webhook processing failed
 */
router.post(
  '/webhooks/portone',
  portOneV2WebhookSecurity,
  paymentController.handleWebhook.bind(paymentController)
);

/**
 * Payment information routes
 */

/**
 * @swagger
 * /api/payments/{paymentId}:
 *   get:
 *     summary: payment details 조회
 *     description: Retrieve detailed information about a specific payment
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Payment UUID
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
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       format: uuid
 *                     reservationId:
 *                       type: string
 *                       format: uuid
 *                     amount:
 *                       type: integer
 *                     status:
 *                       type: string
 *                       enum: [pending, deposit_paid, fully_paid, failed, refunded]
 *                     paymentMethod:
 *                       type: string
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 *       404:
 *         description: Payment not found
 *       500:
 *         description: Internal server error
 */
router.get(
  '/:paymentId',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.getPaymentDetails.bind(paymentController)
);

/**
 * @swagger
 * /api/payments/user/{userId}:
 *   get:
 *     summary: user payment history 조회
 *     description: Retrieve payment history for a specific user
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: User UUID
 *     responses:
 *       200:
 *         description: Payment history retrieved successfully
 *       401:
 *         description: Authentication required
 *       403:
 *         description: Access denied
 */
router.get(
  '/user/:userId',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.getUserPaymentHistory.bind(paymentController)
);

/**
 * Payment redirect routes
 */

/**
 * @swagger
 * /api/payments/success:
 *   get:
 *     summary: Handle successful payment redirect (Handle successful payment redirect)
 *     description: Handle redirect from PortOne after successful payment
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     responses:
 *       200:
 *         description: Payment success handled
 */
router.get(
  '/success',
  paymentController.handlePaymentSuccess.bind(paymentController)
);

/**
 * @swagger
 * /api/payments/fail:
 *   get:
 *     summary: Handle failed payment redirect (Handle failed payment redirect)
 *     description: Handle redirect from PortOne after failed payment
 *       
 *       결제 관련 API입니다. 결제 처리와 관리 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [결제]
 *     responses:
 *       200:
 *         description: Payment failure handled
 */
router.get(
  '/fail',
  paymentController.handlePaymentFail.bind(paymentController)
);

/**
 * Billing key payment routes (pay with saved card)
 */

/**
 * @swagger
 * /api/payments/billing-key:
 *   post:
 *     summary: Pay with saved billing key
 *     description: Make instant payment using a saved payment method (billing key)
 *
 *       저장된 결제 수단(빌링키)을 사용하여 즉시 결제를 진행합니다.
 *       결제창 없이 서버-투-서버로 바로 결제가 완료됩니다.
 *
 *       ---
 *
 *     tags: [결제]
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
 *               - paymentMethodId
 *               - amount
 *             properties:
 *               reservationId:
 *                 type: string
 *                 format: uuid
 *                 description: Reservation ID to pay for
 *                 example: "123e4567-e89b-12d3-a456-426614174000"
 *               paymentMethodId:
 *                 type: string
 *                 format: uuid
 *                 description: User's saved payment method ID
 *                 example: "pm_123e4567-e89b-12d3-a456-426614174000"
 *               amount:
 *                 type: integer
 *                 minimum: 100
 *                 description: Payment amount in KRW
 *                 example: 50000
 *               paymentType:
 *                 type: string
 *                 enum: [deposit, final, single]
 *                 default: deposit
 *                 description: Type of payment
 *               orderName:
 *                 type: string
 *                 description: Custom order name (optional)
 *                 example: "에뷰리띵 예약금"
 *     responses:
 *       200:
 *         description: Payment completed successfully
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
 *                     paymentId:
 *                       type: string
 *                       description: Internal payment ID
 *                     transactionId:
 *                       type: string
 *                       description: PortOne transaction ID
 *                     status:
 *                       type: string
 *                       example: "PAID"
 *                     paidAt:
 *                       type: string
 *                       format: date-time
 *                     receiptUrl:
 *                       type: string
 *                       format: uri
 *                 message:
 *                   type: string
 *                   example: "결제가 완료되었습니다."
 *       400:
 *         description: Invalid request parameters
 *       401:
 *         description: Authentication required
 *       404:
 *         description: Payment method or reservation not found
 *       402:
 *         description: Payment failed
 *       500:
 *         description: Internal server error
 */
router.post(
  '/billing-key',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.payWithBillingKey.bind(paymentController)
);

export default router; 