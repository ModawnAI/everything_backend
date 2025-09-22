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

/**
 * @swagger
 * /:
 *   get:
 *     summary: / 조회
 *     description: GET endpoint for /
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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
/**
 * @swagger
 * /trends:
 *   get:
 *     summary: /trends 조회
 *     description: GET endpoint for /trends
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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
/**
 * @swagger
 * /insights:
 *   get:
 *     summary: /insights 조회
 *     description: GET endpoint for /insights
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

/**
 * @swagger
 * /users/:userId/profile:
 *   get:
 *     summary: /users/:userId/profile 조회
 *     description: GET endpoint for /users/:userId/profile
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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
/**
 * @swagger
 * /realtime:
 *   get:
 *     summary: /realtime 조회
 *     description: GET endpoint for /realtime
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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
/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: /dashboard 조회
 *     description: GET endpoint for /dashboard
 *       
 *       인증 관련 API입니다. 로그인, 회원가입, 토큰 관리를 처리합니다.
 *       
 *       ---
 *       
 *     tags: [Authentication]
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

router.get('/dashboard',
  authenticateToken,
  requireAdminRole,
  authAnalyticsController.analyticsRateLimit,
  validateRequestQuery(dashboardQuerySchema),
  authAnalyticsController.getDashboardData
);

export default router;
