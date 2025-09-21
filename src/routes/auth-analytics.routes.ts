import { Router } from 'express';
import { authAnalyticsController } from '../controllers/auth-analytics.controller';
import { authenticateToken } from '../middleware/auth.middleware';
import { requireAdminRole } from '../middleware/admin-auth.middleware';
import { validateRequestQuery } from '../middleware/validation.middleware';
import Joi from 'joi';

const router = Router();

// Validation schemas
const analyticsQuerySchema = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional(),
  userId: Joi.string().uuid().optional(),
  period: Joi.string().valid('hour', 'day', 'week', 'month').optional()
});

const trendsQuerySchema = Joi.object({
  period: Joi.string().valid('hour', 'day', 'week', 'month').optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional()
});

const insightsQuerySchema = Joi.object({
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().optional()
});

const userProfileQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).optional()
});

const dashboardQuerySchema = Joi.object({
  period: Joi.string().valid('hour', 'day', 'week', 'month').optional()
});

/**
 * @route GET /api/analytics/auth
 * @desc Get comprehensive authentication analytics
 * @access Admin
 */
router.get('/',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(analyticsQuerySchema),
  authAnalyticsController.getAuthAnalytics
);

/**
 * @route GET /api/analytics/auth/trends
 * @desc Get authentication trends over time
 * @access Admin
 */
router.get('/trends',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(trendsQuerySchema),
  authAnalyticsController.getAuthTrends
);

/**
 * @route GET /api/analytics/auth/insights
 * @desc Get security insights and threat analysis
 * @access Admin
 */
router.get('/insights',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(insightsQuerySchema),
  authAnalyticsController.getSecurityInsights
);

/**
 * @route GET /api/analytics/auth/users/:userId/profile
 * @desc Get user authentication profile
 * @access Admin
 */
router.get('/users/:userId/profile',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(userProfileQuerySchema),
  authAnalyticsController.getUserAuthProfile
);

/**
 * @route GET /api/analytics/auth/realtime
 * @desc Get real-time authentication metrics
 * @access Admin
 */
router.get('/realtime',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  authAnalyticsController.getRealTimeMetrics
);

/**
 * @route GET /api/analytics/auth/dashboard
 * @desc Get comprehensive dashboard data
 * @access Admin
 */
router.get('/dashboard',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(dashboardQuerySchema),
  authAnalyticsController.getDashboardData
);

export default router;
