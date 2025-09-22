/**
 * @swagger
 * tags:
 *   - name: 결제
 *     description: 토스페이먼츠 연동 결제 API
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
 * - TossPayments payment initialization and confirmation
 * - Webhook handling for payment status updates
 * - Payment history and details retrieval
 * - Success/failure redirect handlers
 */

import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { paymentRateLimit } from '../middleware/rate-limit.middleware';
import { tossPaymentsWebhookSecurity } from '../middleware/webhook-security.middleware';

const router = Router();
const paymentController = new PaymentController();

/**
 * Payment initialization and confirmation routes
 */

/**
 * @swagger
 * /api/payments/toss/prepare:
 *   post:
 *     summary: Initialize payment with TossPayments (Initialize payment with TossPayments)
 *     description: Prepare a payment transaction with TossPayments for reservation deposit or full payment
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
  '/toss/prepare',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.preparePayment.bind(paymentController)
);

/**
 * @swagger
 * /api/payments/toss/confirm:
 *   post:
 *     summary: Confirm payment with TossPayments (Confirm payment with TossPayments)
 *     description: Confirm and finalize a payment transaction with TossPayments
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
 *                 description: TossPayments payment key
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
  '/toss/confirm',
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
 * /api/webhooks/toss-payments:
 *   post:
 *     summary: Handle TossPayments webhooks (Handle TossPayments webhooks)
 *     description: Receive and process webhook notifications from TossPayments for payment status updates
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
 *             description: TossPayments webhook payload
 *     responses:
 *       200:
 *         description: Webhook processed successfully
 *       400:
 *         description: Invalid webhook payload
 *       500:
 *         description: Webhook processing failed
 */
router.post(
  '/webhooks/toss-payments',
  tossPaymentsWebhookSecurity,
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
 *     description: Handle redirect from TossPayments after successful payment
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
 *     description: Handle redirect from TossPayments after failed payment
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

export default router; 