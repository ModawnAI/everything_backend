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

/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: GET /dashboard
 *     description: GET endpoint for /dashboard
 *     tags: [Admin - Users]
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

/**
 * @swagger
 * /export:
 *   get:
 *     summary: GET /export
 *     description: GET endpoint for /export
 *     tags: [Admin - Users]
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

/**
 * @swagger
 * /health:
 *   get:
 *     summary: GET /health
 *     description: GET endpoint for /health
 *     tags: [Admin - Users]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
router.get('/health',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getAnalyticsHealth.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/shops/{shopId}/analytics:
 *   get:
 *     summary: Get detailed analytics for a specific shop
 *     description: |
 *       Retrieve comprehensive analytics and performance metrics for a specific shop including:
 *       - Shop basic information and status
 *       - Performance metrics (reservations, revenue, services)
 *       - Registration and approval timeline
 *       - User engagement metrics (favorites, reviews)
 *       - Discovery and trending data
 *       
 *       **Authorization:** Requires admin role and valid JWT token.
 *     tags: [Admin Analytics]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: shopId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date for analytics period
 *         example: "2024-01-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date for analytics period
 *         example: "2024-01-31"
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month, quarter, year]
 *         description: Analysis period
 *         example: "month"
 *       - in: query
 *         name: includeCache
 *         schema:
 *           type: boolean
 *           default: true
 *         description: Include cached data
 *         example: true
 *     responses:
 *       200:
 *         description: Shop analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "샵 분석 데이터를 성공적으로 조회했습니다."
 *                 data:
 *                   type: object
 *                   properties:
 *                     shop:
 *                       type: object
 *                       properties:
 *                         id:
 *                           type: string
 *                           format: uuid
 *                         name:
 *                           type: string
 *                         description:
 *                           type: string
 *                         mainCategory:
 *                           type: string
 *                         subCategories:
 *                           type: array
 *                           items:
 *                             type: string
 *                         status:
 *                           type: string
 *                         verificationStatus:
 *                           type: string
 *                         createdAt:
 *                           type: string
 *                           format: date-time
 *                         updatedAt:
 *                           type: string
 *                           format: date-time
 *                         ownerId:
 *                           type: string
 *                           format: uuid
 *                         address:
 *                           type: string
 *                         location:
 *                           type: object
 *                           properties:
 *                             latitude:
 *                               type: number
 *                             longitude:
 *                               type: number
 *                         contact:
 *                           type: object
 *                           properties:
 *                             phone:
 *                               type: string
 *                             email:
 *                               type: string
 *                         businessLicense:
 *                           type: string
 *                         isFeatured:
 *                           type: boolean
 *                         rating:
 *                           type: number
 *                         reviewCount:
 *                           type: integer
 *                     performance:
 *                       type: object
 *                       properties:
 *                         reservations:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             completed:
 *                               type: integer
 *                             cancelled:
 *                               type: integer
 *                             noShow:
 *                               type: integer
 *                             completionRate:
 *                               type: number
 *                             averageValue:
 *                               type: number
 *                         revenue:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: number
 *                             averagePerReservation:
 *                               type: number
 *                         services:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             available:
 *                               type: integer
 *                             categories:
 *                               type: array
 *                               items:
 *                                 type: string
 *                     registration:
 *                       type: object
 *                       properties:
 *                         registrationTime:
 *                           type: integer
 *                           description: Days to complete registration
 *                         approvalTime:
 *                           type: integer
 *                           description: Days to get approved
 *                         profileCompleteness:
 *                           type: integer
 *                           description: Profile completeness percentage
 *                         status:
 *                           type: string
 *                         verificationStatus:
 *                           type: string
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         favorites:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             newThisPeriod:
 *                               type: integer
 *                         reviews:
 *                           type: object
 *                           properties:
 *                             total:
 *                               type: integer
 *                             averageRating:
 *                               type: number
 *                         engagement:
 *                           type: object
 *                           properties:
 *                             totalInteractions:
 *                               type: integer
 *                             engagementRate:
 *                               type: number
 *                     discovery:
 *                       type: object
 *                       properties:
 *                         searchAppearances:
 *                           type: integer
 *                         profileViews:
 *                           type: integer
 *                         discoverySources:
 *                           type: object
 *                           properties:
 *                             search:
 *                               type: integer
 *                             recommendations:
 *                               type: integer
 *                             direct:
 *                               type: integer
 *                         trendingScore:
 *                           type: number
 *                     period:
 *                       type: object
 *                       properties:
 *                         startDate:
 *                           type: string
 *                           format: date
 *                         endDate:
 *                           type: string
 *                           format: date
 *                         period:
 *                           type: string
 *                     generatedAt:
 *                       type: string
 *                       format: date-time
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Bad request - Invalid shop ID or parameters
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "MISSING_SHOP_ID"
 *                     message:
 *                       type: string
 *                       example: "샵 ID가 필요합니다."
 *                     details:
 *                       type: string
 *                       example: "URL 경로에 유효한 샵 ID를 포함해주세요."
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       401:
 *         description: Unauthorized - Admin authentication required
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "UNAUTHORIZED"
 *                     message:
 *                       type: string
 *                       example: "관리자 인증이 필요합니다."
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       404:
 *         description: Shop not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "SHOP_NOT_FOUND"
 *                     message:
 *                       type: string
 *                       example: "샵을 찾을 수 없습니다."
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: object
 *                   properties:
 *                     code:
 *                       type: string
 *                       example: "SHOP_ANALYTICS_ERROR"
 *                     message:
 *                       type: string
 *                       example: "샵 분석 데이터 조회 중 오류가 발생했습니다."
 *                     details:
 *                       type: string
 *                       example: "Unknown error"
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 */

/**
 * @swagger
 * /shops/:shopId/analytics:
 *   get:
 *     summary: GET /shops/:shopId/analytics
 *     description: GET endpoint for /shops/:shopId/analytics
 *     tags: [Admin - Users]
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
router.get('/shops/:shopId/analytics',
  authenticateJWT,
  requireRole('admin'),
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getShopAnalytics.bind(adminAnalyticsController)
);

export default router; 