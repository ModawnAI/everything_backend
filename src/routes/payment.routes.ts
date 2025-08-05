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

const router = Router();
const paymentController = new PaymentController();

/**
 * Payment initialization and confirmation routes
 */

// POST /api/payments/toss/prepare
// Initialize payment with TossPayments
router.post(
  '/toss/prepare',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.preparePayment.bind(paymentController)
);

// POST /api/payments/toss/confirm
// Confirm payment with TossPayments
router.post(
  '/toss/confirm',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.confirmPayment.bind(paymentController)
);

/**
 * Webhook routes
 */

// POST /api/webhooks/toss-payments
// Handle webhooks from TossPayments
router.post(
  '/webhooks/toss-payments',
  paymentController.handleWebhook.bind(paymentController)
);

/**
 * Payment information routes
 */

// GET /api/payments/:paymentId
// Get payment details
router.get(
  '/:paymentId',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.getPaymentDetails.bind(paymentController)
);

// GET /api/payments/user/:userId
// Get user's payment history
router.get(
  '/user/:userId',
  authenticateJWT,
  paymentRateLimit(),
  paymentController.getUserPaymentHistory.bind(paymentController)
);

/**
 * Payment redirect routes
 */

// GET /api/payments/success
// Handle successful payment redirect
router.get(
  '/success',
  paymentController.handlePaymentSuccess.bind(paymentController)
);

// GET /api/payments/fail
// Handle failed payment redirect
router.get(
  '/fail',
  paymentController.handlePaymentFail.bind(paymentController)
);

export default router; 