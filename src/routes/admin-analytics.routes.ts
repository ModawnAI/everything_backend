import { Router } from 'express';
import AdminAnalyticsController from '../controllers/admin-analytics.controller';
import { AdminAnalyticsOptimizedController } from '../controllers/admin-analytics-optimized.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';

const router = Router();
const adminAnalyticsController = new AdminAnalyticsController();
const adminAnalyticsOptimizedController = new AdminAnalyticsOptimizedController();

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
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *     summary: comprehensive dashboard metrics 조회
 *     description: Retrieve comprehensive analytics dashboard with user growth, revenue, reservations, payments, and business intelligence metrics
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *     summary: /dashboard 조회
 *     description: GET endpoint for /dashboard
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getDashboardMetrics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/realtime:
 *   get:
 *     summary: real-time metrics 조회
 *     description: Retrieve real-time metrics for live dashboard updates
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 200 } }), // Higher rate limit for real-time updates
  adminAnalyticsController.getRealTimeMetrics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/export:
 *   get:
 *     summary: Export analytics data (Export analytics data)
 *     description: Export analytics data in various formats (CSV, JSON, Excel)
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *     summary: /export 조회
 *     description: GET endpoint for /export
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }), // Lower rate limit for exports
  adminAnalyticsController.exportAnalytics.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/cache/stats:
 *   get:
 *     summary: cache statistics 조회
 *     description: Retrieve analytics cache statistics for performance monitoring
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
  adminAnalyticsController.getCacheStats.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/cache/clear:
 *   post:
 *     summary: Clear analytics cache (Clear analytics cache)
 *     description: Clear all analytics cache data
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // Very low rate limit for cache clearing
  adminAnalyticsController.clearCache.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/analytics/health:
 *   get:
 *     summary: analytics system health 조회
 *     description: Check the health status of the analytics system
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *     summary: /health 조회
 *     description: GET endpoint for /health
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getAnalyticsHealth.bind(adminAnalyticsController)
);

/**
 * @swagger
 * /api/admin/shops/{shopId}/analytics:
 *   get:
 *     summary: detailed analytics for a specific shop 조회
 *     description: |
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
 *     summary: /shops/:shopId/analytics 조회
 *     description: GET endpoint for /shops/:shopId/analytics
 *       
 *       관리자용 분석 대시보드 API입니다. 비즈니스 지표와 분석을 제공합니다.
 *       
 *       ---
 *       
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
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
  adminAnalyticsController.getShopAnalytics.bind(adminAnalyticsController)
);

// ============================================
// OPTIMIZED ANALYTICS ENDPOINTS (Materialized Views)
// ============================================

/**
 * @swagger
 * /api/admin/analytics/dashboard/quick:
 *   get:
 *     summary: Get quick dashboard metrics (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve pre-calculated dashboard metrics from materialized views.
 *       Performance: < 10ms response time (100-1000x faster than on-demand calculation)
 *       Data Freshness: Auto-refreshed by pg_cron every 2 minutes
 *
 *       Returns 15 key metrics:
 *       - User metrics (total, active, new this month, growth rate)
 *       - Revenue metrics (total, today, month, growth rate)
 *       - Reservation metrics (total, active, today, success rate)
 *       - Shop metrics (total, active, pending approvals)
 *       - Payment metrics (total transactions, successful, conversion rate)
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quick dashboard metrics retrieved successfully
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
router.get('/dashboard/quick',
  // authenticateJWT and requireRole('admin') are already applied globally via app.use('/api/admin/*', ...)
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }), // Higher rate limit due to excellent performance
  adminAnalyticsOptimizedController.getQuickDashboardMetrics.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/trends/users:
 *   get:
 *     summary: Get user growth daily trends (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve user growth trends from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 5 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Number of days to return (default: 30, max: 90)
 *     responses:
 *       200:
 *         description: User growth trends retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/trends/users',
  // authenticateJWT and requireRole('admin') are already applied globally via app.use('/api/admin/*', ...)
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getUserGrowthTrends.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/trends/revenue:
 *   get:
 *     summary: Get revenue daily trends (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve revenue trends from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 5 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Number of days to return (default: 30, max: 90)
 *     responses:
 *       200:
 *         description: Revenue trends retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/trends/revenue',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getRevenueTrends.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/trends/reservations:
 *   get:
 *     summary: Get reservation daily trends (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve reservation trends from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 5 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 30
 *           maximum: 90
 *         description: Number of days to return (default: 30, max: 90)
 *     responses:
 *       200:
 *         description: Reservation trends retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/trends/reservations',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getReservationTrends.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/shops/performance:
 *   get:
 *     summary: Get shop performance summary (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve shop performance metrics from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 10 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *           maximum: 100
 *         description: Number of shops to return (default: 20, max: 100)
 *     responses:
 *       200:
 *         description: Shop performance retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/shops/performance',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getShopPerformance.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/payments/summary:
 *   get:
 *     summary: Get payment status summary (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve payment status summary from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 10 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Payment status summary retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/payments/summary',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getPaymentStatusSummary.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/points/summary:
 *   get:
 *     summary: Get point transaction summary (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve point transaction summary from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 10 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Point transaction summary retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/points/summary',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getPointTransactionSummary.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/categories/performance:
 *   get:
 *     summary: Get category performance summary (< 10ms, auto-refreshed)
 *     description: |
 *       Retrieve category performance metrics from materialized views.
 *       Performance: < 10ms response time
 *       Data Freshness: Auto-refreshed by pg_cron every 10 minutes
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Category performance retrieved successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/categories/performance',
  rateLimit({ config: { windowMs: 5 * 60 * 1000, max: 300 } }),
  adminAnalyticsOptimizedController.getCategoryPerformance.bind(adminAnalyticsOptimizedController)
);

/**
 * @swagger
 * /api/admin/analytics/refresh:
 *   post:
 *     summary: Manually refresh all materialized views (admin only)
 *     description: |
 *       Manually trigger refresh of all analytics materialized views.
 *       Note: Views are auto-refreshed by pg_cron, this is only for manual refresh needs.
 *       This operation takes ~1-2 seconds to refresh all 8 views.
 *     tags: [Admin Analytics - Optimized]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All materialized views refreshed successfully
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.post('/refresh',
  rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }), // Low rate limit for manual refresh
  adminAnalyticsOptimizedController.refreshAllViews.bind(adminAnalyticsOptimizedController)
);

export default router; 