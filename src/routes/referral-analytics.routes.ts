import { Router } from 'express';
import { referralAnalyticsController } from '../controllers/referral-analytics.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole, UserRole } from '../middleware/role.middleware';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const trendsQuerySchema = Joi.object({
  period: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required()
});

const generateReportSchema = Joi.object({
  reportType: Joi.string().valid('overview', 'trends', 'user', 'system', 'financial').required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  userId: Joi.string().uuid().optional()
});

const exportQuerySchema = Joi.object({
  format: Joi.string().valid('json', 'csv', 'xlsx').default('json'),
  reportType: Joi.string().valid('overview', 'trends', 'user', 'system', 'financial').required(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().required(),
  userId: Joi.string().uuid().optional()
});

const dashboardQuerySchema = Joi.object({
  period: Joi.string().valid('day', 'week', 'month', 'year').default('month'),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional()
});

/**
 * @route GET /api/referral-analytics/overview
 * @desc Get referral analytics overview
 * @access Private
 */
router.get(
  '/overview',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  referralAnalyticsController.getReferralAnalyticsOverview
);

/**
 * @route GET /api/referral-analytics/trends
 * @desc Get referral trends data
 * @access Private
 */
router.get(
  '/trends',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  validateRequestBody(trendsQuerySchema),
  referralAnalyticsController.getReferralTrends
);

/**
 * @route GET /api/referral-analytics/user/:userId?
 * @desc Get user referral analytics
 * @access Private (users can view own, admins can view any)
 */
router.get(
  '/user/:userId?',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  referralAnalyticsController.getUserReferralAnalytics
);

/**
 * @route GET /api/referral-analytics/system-metrics
 * @desc Get referral system metrics
 * @access Private (Admin only)
 */
router.get(
  '/system-metrics',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  requireRole(UserRole.ADMIN),
  referralAnalyticsController.getReferralSystemMetrics
);

/**
 * @route POST /api/referral-analytics/generate-report
 * @desc Generate comprehensive referral report
 * @access Private
 */
router.post(
  '/generate-report',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  validateRequestBody(generateReportSchema),
  referralAnalyticsController.generateReferralReport
);

/**
 * @route GET /api/referral-analytics/dashboard
 * @desc Get referral analytics dashboard data
 * @access Private
 */
router.get(
  '/dashboard',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  validateRequestBody(dashboardQuerySchema),
  referralAnalyticsController.getReferralAnalyticsDashboard
);

/**
 * @route GET /api/referral-analytics/export
 * @desc Export referral analytics data
 * @access Private
 */
router.get(
  '/export',
  referralAnalyticsController.referralAnalyticsRateLimit,
  authenticateJWT,
  validateRequestBody(exportQuerySchema),
  referralAnalyticsController.exportReferralAnalytics
);

export default router;
