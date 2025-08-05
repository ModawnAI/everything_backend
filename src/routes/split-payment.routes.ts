/**
 * Split Payment Routes
 * 
 * Defines all split payment-related API endpoints including:
 * - Split payment plan creation and management
 * - Split payment processing and confirmation
 * - Payment status and history retrieval
 * - Payment reminder management
 */

import { Router } from 'express';
import { SplitPaymentController } from '../controllers/split-payment.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { paymentRateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const splitPaymentController = new SplitPaymentController();

/**
 * Split payment plan management routes
 */

// POST /api/split-payments/create-plan
// Create a new split payment plan for a reservation
router.post(
  '/create-plan',
  authenticateJWT,
  paymentRateLimit(),
  splitPaymentController.createSplitPaymentPlan.bind(splitPaymentController)
);

// POST /api/split-payments/process
// Process a payment for a specific installment
router.post(
  '/process',
  authenticateJWT,
  paymentRateLimit(),
  splitPaymentController.processSplitPayment.bind(splitPaymentController)
);

// POST /api/split-payments/initialize-remaining
// Initialize payment for remaining balance
router.post(
  '/initialize-remaining',
  authenticateJWT,
  paymentRateLimit(),
  splitPaymentController.initializeRemainingPayment.bind(splitPaymentController)
);

/**
 * Split payment information routes
 */

// GET /api/split-payments/status/:reservationId
// Get split payment status for a reservation
router.get(
  '/status/:reservationId',
  authenticateJWT,
  paymentRateLimit(),
  splitPaymentController.getSplitPaymentStatus.bind(splitPaymentController)
);

/**
 * Admin routes
 */

// GET /api/split-payments/overdue
// Get overdue installments (admin only)
router.get(
  '/overdue',
  authenticateJWT,
  paymentRateLimit(),
  splitPaymentController.getOverdueInstallments.bind(splitPaymentController)
);

export default router; 