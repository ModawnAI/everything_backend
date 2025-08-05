import { Router } from 'express';
import AdminAnalyticsController from '../controllers/admin-analytics.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const adminAnalyticsController = new AdminAnalyticsController();

/**
 * @swagger
 * components:
 *   schemas:
 *     DashboardMetrics:
 *       type: object
 *       properties:
 *         userGrowth:
 *           type: object
 *           properties:
 *             totalUsers:
 *               type: number
 *               description: Total number of users
 *             activeUsers:
 *               type: number
 *               description: Number of active users
 *             newUsersThisMonth:
 *               type: number
 *               description: New users registered this month
 *             userGrowthRate:
 *               type: number
 *               description: User growth rate percentage
 *             userRetentionRate:
 *               type: number
 *               description: User retention rate percentage
 *         revenue:
 *           type: object
 *           properties:
 *             totalRevenue:
 *               type: number
 *               description: Total revenue
 *             revenueThisMonth:
 *               type: number
 *               description: Revenue this month
 *             averageOrderValue:
 *               type: number
 *               description: Average order value
 *             revenueGrowthRate:
 *               type: number
 *               description: Revenue growth rate percentage
 *         reservations:
 *           type: object
 *           properties:
 *             totalReservations:
 *               type: number
 *               description: Total number of reservations
 *             completedReservations:
 *               type: number
 *               description: Number of completed reservations
 *             reservationSuccessRate:
 *               type: number
 *               description: Reservation success rate percentage
 *         payments:
 *           type: object
 *           properties:
 *             totalTransactions:
 *               type: number
 *               description: Total number of transactions
 *             successfulTransactions:
 *               type: number
 *               description: Number of successful transactions
 *             conversionRate:
 *               type: number
 *               description: Payment conversion rate percentage
 *         systemHealth:
 *           type: object
 *           properties:
 *             activeUsers:
 *               type: number
 *               description: Number of active users
 *             systemLoad:
 *               type: number
 *               description: System load percentage
 *             uptime:
 *               type: number
 *               description: System uptime percentage
 *         businessIntelligence:
 *           type: object
 *           properties:
 *             keyPerformanceIndicators:
 *               type: object
 *               properties:
 *                 customerAcquisitionCost:
 *                   type: number
 *                   description: Customer acquisition cost
 *                 customerLifetimeValue:
 *                   type: number
 *                   description: Customer lifetime value
 *                 revenuePerUser:
 *                   type: number
 *                   description: Revenue per user
 *             insights:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   type:
 *                     type: string
 *                     enum: [positive, negative, neutral]
 *                   title:
 *                     type: string
 *                   description:
 *                     type: string
 *                   impact:
 *                     type: string
 *                     enum: [high, medium, low]
 *     AnalyticsFilters:
 *       type: object
 *       properties:
 *         startDate:
 *           type: string
 *           format: date-time
 *           description: Start date for analytics period
 *         endDate:
 *           type: string
 *           format: date-time
 *           description: End date for analytics period
 *         period:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *           description: Analytics period
 *         category:
 *           type: string
 *           description: Filter by category
 *         shopId:
 *           type: string
 *           description: Filter by shop ID
 *         userId:
 *           type: string
 *           description: Filter by user ID
 *         includeCache:
 *           type: boolean
 *           description: Whether to include cached data
 *     ExportOptions:
 *       type: object
 *       properties:
 *         format:
 *           type: string
 *           enum: [csv, json, excel]
 *           description: Export format
 *         includeCharts:
 *           type: boolean
 *           description: Whether to include charts in export
 *         includeTrends:
 *           type: boolean
 *           description: Whether to include trends in export
 *         dateRange:
 *           type: object
 *           properties:
 *             startDate:
 *               type: string
 *               format: date-time
 *             endDate:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/admin/analytics/dashboard:
 *   get:
 *     summary: Get comprehensive dashboard metrics
 *     description: Retrieve comprehensive analytics dashboard with user growth, revenue, reservations, payments, and business intelligence metrics
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics period
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *         description: Analytics period
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *         description: Filter by shop ID
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: includeCache
 *         schema:
 *           type: boolean
 *         description: Whether to include cached data
 *     responses:
 *       200:
 *         description: Dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   $ref: '#/components/schemas/DashboardMetrics'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getDashboardMetrics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/realtime:
 *   get:
 *     summary: Get real-time metrics
 *     description: Retrieve real-time metrics for live dashboard updates
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   description: Partial dashboard metrics for real-time updates
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/realtime',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 200 } }), // Higher rate limit for real-time updates
  adminAnalyticsController.getRealTimeMetrics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/export:
 *   get:
 *     summary: Export analytics data
 *     description: Export analytics data in various formats (CSV, JSON, Excel)
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [csv, json, excel]
 *         description: Export format
 *         default: csv
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for export period
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for export period
 *       - in: query
 *         name: includeCharts
 *         schema:
 *           type: boolean
 *         description: Whether to include charts in export
 *       - in: query
 *         name: includeTrends
 *         schema:
 *           type: boolean
 *         description: Whether to include trends in export
 *     responses:
 *       200:
 *         description: Analytics data exported successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               description: CSV export data
 *           application/json:
 *             schema:
 *               type: object
 *               description: JSON export data
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *               description: Excel export data
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/export',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }), // Lower rate limit for exports
  adminAnalyticsController.exportAnalytics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/cache/stats:
 *   get:
 *     summary: Get cache statistics
 *     description: Retrieve analytics cache statistics for performance monitoring
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Cache statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     size:
 *                       type: number
 *                       description: Number of cached items
 *                     keys:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Array of cache keys
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/cache/stats',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  adminAnalyticsController.getCacheStats.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/cache/clear:
 *   post:
 *     summary: Clear analytics cache
 *     description: Clear all analytics cache data
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics cache cleared successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.post('/cache/clear',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // Very low rate limit for cache clearing
  adminAnalyticsController.clearCache.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/health:
 *   get:
 *     summary: Get analytics system health
 *     description: Check the health status of the analytics system
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Analytics system health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     metrics:
 *                       type: object
 *                       properties:
 *                         hasUserData:
 *                           type: boolean
 *                         hasRevenueData:
 *                           type: boolean
 *                         hasReservationData:
 *                           type: boolean
 *                         hasPaymentData:
 *                           type: boolean
 *                     cache:
 *                       type: object
 *                       properties:
 *                         size:
 *                           type: number
 *                         isOperational:
 *                           type: boolean
 *                     performance:
 *                       type: object
 *                       properties:
 *                         responseTime:
 *                           type: string
 *                         dataFreshness:
 *                           type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/health',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getAnalyticsHealth.bind(adminAnalyticsController)
);

export default router; 