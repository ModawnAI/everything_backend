import { Router } from 'express';
import { referralEarningsController } from '../controllers/referral-earnings.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole, UserRole } from '../middleware/role.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const calculateEarningsSchema = Joi.object({
  referralId: Joi.string().uuid().required(),
  referrerId: Joi.string().uuid().required(),
  referredId: Joi.string().uuid().required()
});

const processPayoutSchema = Joi.object({
  referralId: Joi.string().uuid().required(),
  referrerId: Joi.string().uuid().required(),
  referredId: Joi.string().uuid().required(),
  payoutType: Joi.string().valid('points', 'cash', 'discount').required(),
  amount: Joi.number().positive().required(),
  reason: Joi.string().min(10).max(500).required(),
  metadata: Joi.object().optional()
});

const bulkPayoutsSchema = Joi.object({
  referralIds: Joi.array().items(Joi.string().uuid()).min(1).max(100).required()
});

const earningsStatsSchema = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  payoutType: Joi.string().valid('points', 'cash', 'discount').optional()
});

const topEarnersSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10),
  period: Joi.string().valid('day', 'week', 'month', 'year').default('month')
});

/**
 * @route POST /api/referral-earnings/calculate
 * @desc Calculate referral earnings for a specific referral
 * @access Private (users can calculate own, admins can calculate any)
 */
router.post(
  '/calculate',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  validateRequestBody(calculateEarningsSchema),
  referralEarningsController.calculateReferralEarnings
);

/**
 * @route POST /api/referral-earnings/payout
 * @desc Process referral bonus payout
 * @access Private (users can payout own, admins can payout any)
 */
router.post(
  '/payout',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  validateRequestBody(processPayoutSchema),
  referralEarningsController.processReferralPayout
);

/**
 * @route GET /api/referral-earnings/summary/:userId?
 * @desc Get referral earnings summary for a user
 * @access Private (users can view own, admins can view any)
 */
router.get(
  '/summary/:userId?',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  referralEarningsController.getReferralEarningsSummary
);

/**
 * @route POST /api/referral-earnings/bulk-payouts
 * @desc Process bulk referral payouts
 * @access Private (Admin only)
 */
router.post(
  '/bulk-payouts',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  requireRole(UserRole.ADMIN),
  validateRequestBody(bulkPayoutsSchema),
  referralEarningsController.processBulkReferralPayouts
);

/**
 * @route GET /api/referral-earnings/stats
 * @desc Get referral earnings statistics
 * @access Private (Admin only)
 */
router.get(
  '/stats',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  requireRole(UserRole.ADMIN),
  validateRequestBody(earningsStatsSchema),
  referralEarningsController.getReferralEarningsStats
);

/**
 * @route GET /api/referral-earnings/top-earners
 * @desc Get top earners
 * @access Private (Admin only)
 */
router.get(
  '/top-earners',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  requireRole(UserRole.ADMIN),
  validateRequestBody(topEarnersSchema),
  referralEarningsController.getTopEarners
);

/**
 * @route GET /api/referral-earnings/friend/:friendId/payments
 * @desc Get payment history and commissions for a referred friend
 * @access Private (only referrer can view their friend's data)
 */
router.get(
  '/friend/:friendId/payments',
  referralEarningsController.referralEarningsRateLimit,
  authenticateJWT(),
  referralEarningsController.getFriendPaymentHistory
);

export default router;
