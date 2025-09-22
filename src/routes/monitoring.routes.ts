/**
 * Monitoring Routes
 */

import { Router } from 'express';
import { monitoringController } from '../controllers/monitoring.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();


/**
 * @swagger
 * /health:
 *   get:
 *     summary: /health 조회
 *     description: GET endpoint for /health
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Success
 *       400:
 *         description: Bad Request
 *       500:
 *         description: Internal Server Error
 */
// Health check endpoint (public)
router.get('/health', monitoringController.healthCheck.bind(monitoringController));

// System health metrics
/**
 * @swagger
 * /health/:shopId?:
 *   get:
 *     summary: /health/:shopId? 조회
 *     description: GET endpoint for /health/:shopId?
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/health/:shopId?', authenticateToken, monitoringController.getSystemHealth.bind(monitoringController));

// Active alerts
/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: /alerts 조회
 *     description: GET endpoint for /alerts
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/alerts', authenticateToken, monitoringController.getActiveAlerts.bind(monitoringController));

// Resolve alert
/**
 * @swagger
 * /alerts/:alertId/resolve:
 *   post:
 *     summary: POST /alerts/:alertId/resolve (POST /alerts/:alertId/resolve)
 *     description: POST endpoint for /alerts/:alertId/resolve
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.post('/alerts/:alertId/resolve', authenticateToken, monitoringController.resolveAlert.bind(monitoringController));

// Monitoring configuration
/**
 * @swagger
 * /config:
 *   get:
 *     summary: /config 조회
 *     description: GET endpoint for /config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/config', authenticateToken, monitoringController.getMonitoringConfig.bind(monitoringController));
/**
 * @swagger
 * /config:
 *   post:
 *     summary: POST /config (POST /config)
 *     description: POST endpoint for /config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.post('/config', authenticateToken, monitoringController.updateMonitoringConfig.bind(monitoringController));

// Time slot metrics
/**
 * @swagger
 * /metrics/time-slots/:shopId:
 *   get:
 *     summary: /metrics/time-slots/:shopId 조회
 *     description: GET endpoint for /metrics/time-slots/:shopId
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/metrics/time-slots/:shopId', authenticateToken, monitoringController.getTimeSlotMetrics.bind(monitoringController));

// Conflict metrics
/**
 * @swagger
 * /metrics/conflicts/:shopId:
 *   get:
 *     summary: /metrics/conflicts/:shopId 조회
 *     description: GET endpoint for /metrics/conflicts/:shopId
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/metrics/conflicts/:shopId', authenticateToken, monitoringController.getConflictMetrics.bind(monitoringController));

// Manual conflict detection trigger
/**
 * @swagger
 * /conflicts/:shopId/detect:
 *   post:
 *     summary: POST /conflicts/:shopId/detect (POST /conflicts/:shopId/detect)
 *     description: POST endpoint for /conflicts/:shopId/detect
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.post('/conflicts/:shopId/detect', authenticateToken, monitoringController.triggerConflictDetection.bind(monitoringController));

// Reservation metrics
/**
 * @swagger
 * /metrics/reservations:
 *   get:
 *     summary: /metrics/reservations 조회
 *     description: GET endpoint for /metrics/reservations
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/metrics/reservations', authenticateToken, monitoringController.getReservationMetrics.bind(monitoringController));

// Business metrics
/**
 * @swagger
 * /metrics/business:
 *   get:
 *     summary: /metrics/business 조회
 *     description: GET endpoint for /metrics/business
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/metrics/business', authenticateToken, monitoringController.getBusinessMetrics.bind(monitoringController));

// Notification metrics
/**
 * @swagger
 * /metrics/notifications:
 *   get:
 *     summary: /metrics/notifications 조회
 *     description: GET endpoint for /metrics/notifications
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/metrics/notifications', authenticateToken, monitoringController.getNotificationMetrics.bind(monitoringController));

// Comprehensive monitoring dashboard
/**
 * @swagger
 * /dashboard:
 *   get:
 *     summary: /dashboard 조회
 *     description: GET endpoint for /dashboard
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/dashboard', authenticateToken, monitoringController.getMonitoringDashboard.bind(monitoringController));

// ========================================
// FEED-SPECIFIC MONITORING ROUTES
// ========================================

/**
 * @swagger
 * /api/monitoring/feed/metrics:
 *   get:
 *     summary: feed-specific metrics 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves comprehensive metrics for the social feed system including:
 *       - Post and comment statistics
 *       - Moderation queue status
 *       - Performance metrics (response times, cache hit rates)
 *       - User engagement analytics
 *       - System health indicators
 *       
 *       **Metrics Include:**
 *       - Content creation rates (posts/comments per hour)
 *       - Engagement metrics (likes, comments, active users)
 *       - Moderation processing times and queue lengths
 *       - Performance benchmarks (feed load times, Redis latency)
 *       - Error rates and system health indicators
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for metrics (ISO 8601 format)
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for metrics (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Feed metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     posts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         published:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         hidden:
 *                           type: integer
 *                         creationRate:
 *                           type: number
 *                         engagementRate:
 *                           type: number
 *                     comments:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         approved:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         creationRate:
 *                           type: number
 *                     moderation:
 *                       type: object
 *                       properties:
 *                         queueLength:
 *                           type: integer
 *                         avgProcessingTime:
 *                           type: number
 *                         autoApprovalRate:
 *                           type: number
 *                         manualReviewRate:
 *                           type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         avgFeedLoadTime:
 *                           type: number
 *                         avgPostCreationTime:
 *                           type: number
 *                         cacheHitRate:
 *                           type: number
 *                         redisLatency:
 *                           type: number
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         totalLikes:
 *                           type: integer
 *                         totalComments:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         trendingPosts:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/metrics:
 *   get:
 *     summary: /feed/metrics 조회
 *     description: GET endpoint for /feed/metrics
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/metrics', authenticateToken, monitoringController.getFeedMetrics.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerts:
 *   get:
 *     summary: feed-specific alerts 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves all active alerts related to the social feed system.
 *       Supports filtering by alert type and severity level.
 *       
 *       **Alert Types:**
 *       - **performance**: Slow response times, high latency
 *       - **moderation**: Queue buildup, processing delays
 *       - **engagement**: Low user activity, content issues
 *       - **error**: High error rates, system failures
 *       - **security**: Suspicious activity, content violations
 *       
 *       **Severity Levels:**
 *       - **low**: Minor issues, informational alerts
 *       - **medium**: Moderate issues requiring attention
 *       - **high**: Significant issues requiring immediate action
 *       - **critical**: System-critical issues requiring urgent response
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [low, medium, high, critical]
 *         description: Filter alerts by severity level
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [performance, moderation, engagement, error, security]
 *         description: Filter alerts by type
 *     responses:
 *       200:
 *         description: Feed alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     alerts:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           severity:
 *                             type: string
 *                           message:
 *                             type: string
 *                           triggeredAt:
 *                             type: string
 *                             format: date-time
 *                           metadata:
 *                             type: object
 *                     count:
 *                       type: integer
 *                     types:
 *                       type: object
 *                       properties:
 *                         performance:
 *                           type: integer
 *                         moderation:
 *                           type: integer
 *                         engagement:
 *                           type: integer
 *                         error:
 *                           type: integer
 *                         security:
 *                           type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/alerts:
 *   get:
 *     summary: /feed/alerts 조회
 *     description: GET endpoint for /feed/alerts
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/alerts', authenticateToken, monitoringController.getFeedAlerts.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/performance:
 *   get:
 *     summary: feed performance metrics 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves detailed performance metrics for the social feed system
 *       including response times, throughput, and system health indicators.
 *       
 *       **Performance Metrics:**
 *       - Average feed load time (milliseconds)
 *       - Post and comment creation times
 *       - Cache hit rates and Redis latency
 *       - Error rates and system throughput
 *       - Active user counts and content generation rates
 *       
 *       **Time Ranges:**
 *       - **1h**: Last hour (default for performance monitoring)
 *       - **24h**: Last 24 hours
 *       - **7d**: Last 7 days
 *       - **30d**: Last 30 days
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 1h
 *         description: Time range for performance metrics
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Feed performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     avgFeedLoadTime:
 *                       type: number
 *                       description: Average feed load time in milliseconds
 *                     avgPostCreationTime:
 *                       type: number
 *                       description: Average post creation time in milliseconds
 *                     avgCommentCreationTime:
 *                       type: number
 *                       description: Average comment creation time in milliseconds
 *                     cacheHitRate:
 *                       type: number
 *                       description: Cache hit rate percentage
 *                     redisLatency:
 *                       type: number
 *                       description: Redis latency in milliseconds
 *                     errorRate:
 *                       type: number
 *                       description: Error rate percentage
 *                     throughput:
 *                       type: object
 *                       properties:
 *                         postsPerHour:
 *                           type: number
 *                         commentsPerHour:
 *                           type: number
 *                         activeUsers:
 *                           type: integer
 *                 timeRange:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/performance:
 *   get:
 *     summary: /feed/performance 조회
 *     description: GET endpoint for /feed/performance
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/performance', authenticateToken, monitoringController.getFeedPerformance.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/moderation/queue:
 *   get:
 *     summary: moderation queue status 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves current status of the content moderation queue including
 *       pending items, processing rates, and queue health indicators.
 *       
 *       **Queue Metrics:**
 *       - Total pending items (posts + comments)
 *       - Breakdown by content type
 *       - Average processing times
 *       - Automated vs manual review rates
 *       - Approval and rejection rates
 *       
 *       **Use Cases:**
 *       - Monitor moderation workload
 *       - Identify processing bottlenecks
 *       - Track automation effectiveness
 *       - Alert on queue buildup
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Moderation queue status retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPending:
 *                       type: integer
 *                       description: Total items pending moderation
 *                     breakdown:
 *                       type: object
 *                       properties:
 *                         posts:
 *                           type: integer
 *                         comments:
 *                           type: integer
 *                     processing:
 *                       type: object
 *                       properties:
 *                         avgProcessingTime:
 *                           type: number
 *                           description: Average processing time in milliseconds
 *                         autoApprovalRate:
 *                           type: number
 *                           description: Percentage of automated approvals
 *                         manualReviewRate:
 *                           type: number
 *                           description: Percentage requiring manual review
 *                     rates:
 *                       type: object
 *                       properties:
 *                         approvalRate:
 *                           type: number
 *                           description: Overall approval rate percentage
 *                         rejectionRate:
 *                           type: number
 *                           description: Overall rejection rate percentage
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/moderation/queue:
 *   get:
 *     summary: /feed/moderation/queue 조회
 *     description: GET endpoint for /feed/moderation/queue
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/moderation/queue', authenticateToken, monitoringController.getModerationQueue.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/engagement:
 *   get:
 *     summary: feed engagement analytics 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves comprehensive engagement analytics for the social feed
 *       including user activity, content interaction, and community health.
 *       
 *       **Engagement Metrics:**
 *       - User activity (likes, comments, shares)
 *       - Content creation rates and patterns
 *       - Active user counts and trends
 *       - Content health (published vs pending)
 *       - Community engagement rates
 *       
 *       **Time Ranges:**
 *       - **1h**: Last hour (real-time activity)
 *       - **24h**: Last 24 hours (daily patterns)
 *       - **7d**: Last 7 days (weekly trends)
 *       - **30d**: Last 30 days (monthly analytics)
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 24h, 7d, 30d]
 *           default: 24h
 *         description: Time range for engagement analytics
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Feed engagement analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     activity:
 *                       type: object
 *                       properties:
 *                         totalLikes:
 *                           type: integer
 *                         totalComments:
 *                           type: integer
 *                         totalShares:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         trendingPosts:
 *                           type: integer
 *                     content:
 *                       type: object
 *                       properties:
 *                         postsCreated:
 *                           type: integer
 *                         commentsCreated:
 *                           type: integer
 *                         postsPerHour:
 *                           type: number
 *                         commentsPerHour:
 *                           type: number
 *                         engagementRate:
 *                           type: number
 *                     health:
 *                       type: object
 *                       properties:
 *                         publishedPosts:
 *                           type: integer
 *                         pendingPosts:
 *                           type: integer
 *                         approvedComments:
 *                           type: integer
 *                         pendingComments:
 *                           type: integer
 *                 timeRange:
 *                   type: object
 *                   properties:
 *                     start:
 *                       type: string
 *                       format: date-time
 *                     end:
 *                       type: string
 *                       format: date-time
 *                     duration:
 *                       type: string
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/engagement:
 *   get:
 *     summary: /feed/engagement 조회
 *     description: GET endpoint for /feed/engagement
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/engagement', authenticateToken, monitoringController.getFeedEngagement.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/health:
 *   get:
 *     summary: feed system health status 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves comprehensive health status for the social feed system components.
 *       Supports both basic and detailed health check modes.
 *       
 *       **Health Check Components:**
 *       - **API Endpoints**: Feed API endpoint availability and response times
 *       - **Redis Cache**: Cache connectivity and operation performance
 *       - **Image Processing**: Supabase storage and Sharp library availability
 *       - **Content Moderation**: Moderation system and service availability
 *       - **Feed Ranking**: Ranking algorithm and service health
 *       - **Database Queries**: Feed-related database query performance
 *       
 *       **Health Status Levels:**
 *       - **healthy**: All components operational
 *       - **degraded**: Some components have minor issues
 *       - **unhealthy**: Critical components are failing
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: detailed
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Get detailed health checks for all feed components
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Feed health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: healthy
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     checks:
 *                       type: object
 *                       properties:
 *                         apiEndpoints:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                         redisCache:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                         imageProcessing:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                         contentModeration:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                         feedRanking:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                         databaseQueries:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                               enum: [healthy, degraded, unhealthy]
 *                             message:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             details:
 *                               type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         totalChecks:
 *                           type: integer
 *                           example: 6
 *                         healthyChecks:
 *                           type: integer
 *                           example: 6
 *                         degradedChecks:
 *                           type: integer
 *                           example: 0
 *                         unhealthyChecks:
 *                           type: integer
 *                           example: 0
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/health:
 *   get:
 *     summary: /feed/health 조회
 *     description: GET endpoint for /feed/health
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/health', authenticateToken, monitoringController.getFeedHealth.bind(monitoringController));

// ========================================
// FEED ALERTING ROUTES
// ========================================

/**
 * @swagger
 * /api/monitoring/feed/alerting/config:
 *   get:
 *     summary: feed alerting configuration 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves the current feed alerting configuration including thresholds, rules, and monitoring status.
 *       
 *       **Configuration Types:**
 *       - **thresholds**: Alert thresholds for specific metrics
 *       - **rules**: Complex alert rules with multiple conditions
 *       - **status**: Current monitoring status and statistics
 *       
 *       **Alert Thresholds Include:**
 *       - Error rate thresholds (high error rate, cache failures)
 *       - Performance thresholds (slow feed load, processing failures)
 *       - Content thresholds (moderation queue, report spikes)
 *       - Engagement thresholds (low engagement rates)
 *       
 *       **Alert Rules Include:**
 *       - System degradation detection (multiple component issues)
 *       - Content quality issues (high reports + slow moderation)
 *       - Critical performance issues (severe performance degradation)
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [thresholds, rules, status]
 *         description: Filter configuration by type (optional)
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     responses:
 *       200:
 *         description: Feed alerting configuration retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     thresholds:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           metric:
 *                             type: string
 *                           operator:
 *                             type: string
 *                             enum: [greater_than, less_than, equals, not_equals]
 *                           threshold:
 *                             type: number
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           enabled:
 *                             type: boolean
 *                           cooldownMinutes:
 *                             type: number
 *                     rules:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           name:
 *                             type: string
 *                           description:
 *                             type: string
 *                           conditions:
 *                             type: array
 *                             items:
 *                               type: object
 *                               properties:
 *                                 metric:
 *                                   type: string
 *                                 operator:
 *                                   type: string
 *                                 threshold:
 *                                   type: number
 *                           severity:
 *                             type: string
 *                           enabled:
 *                             type: boolean
 *                           cooldownMinutes:
 *                             type: number
 *                     status:
 *                       type: object
 *                       properties:
 *                         isMonitoring:
 *                           type: boolean
 *                         thresholdsCount:
 *                           type: number
 *                         rulesCount:
 *                           type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/alerting/config:
 *   get:
 *     summary: /feed/alerting/config 조회
 *     description: GET endpoint for /feed/alerting/config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/alerting/config', authenticateToken, monitoringController.getFeedAlertingConfig.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerting/thresholds/{id}:
 *   put:
 *     summary: feed alerting threshold 수정
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Updates a specific feed alerting threshold configuration.
 *       
 *       **Threshold Configuration:**
 *       - **id**: Unique identifier for the threshold
 *       - **name**: Human-readable name for the threshold
 *       - **description**: Detailed description of what triggers the alert
 *       - **metric**: Metric path to monitor (e.g., 'feed_error_rate', 'avg_feed_load_time')
 *       - **operator**: Comparison operator (greater_than, less_than, equals, not_equals)
 *       - **threshold**: Numeric threshold value
 *       - **severity**: Alert severity level (low, medium, high, critical)
 *       - **enabled**: Whether the threshold is active
 *       - **cooldownMinutes**: Minimum time between alerts of this type
 *       
 *       **Supported Metrics:**
 *       - feed_error_rate: Overall feed operation error rate (%)
 *       - avg_feed_load_time: Average feed load time (milliseconds)
 *       - moderation_queue_length: Number of items in moderation queue
 *       - engagement_rate: Overall engagement rate (%)
 *       - reports_per_hour: Content reports per hour
 *       - redis_cache_failure_rate: Redis cache failure rate (%)
 *       - image_processing_failure_rate: Image processing failure rate (%)
 *       - moderation_service_failure_rate: Moderation service failure rate (%)
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Threshold ID to update
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, metric, operator, threshold, severity]
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               metric:
 *                 type: string
 *               operator:
 *                 type: string
 *                 enum: [greater_than, less_than, equals, not_equals]
 *               threshold:
 *                 type: number
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               enabled:
 *                 type: boolean
 *                 default: true
 *               cooldownMinutes:
 *                 type: number
 *                 default: 15
 *     responses:
 *       200:
 *         description: Feed alerting threshold updated successfully
 *       400:
 *         description: Bad request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/alerting/thresholds/:id:
 *   put:
 *     summary: PUT /feed/alerting/thresholds/:id (PUT /feed/alerting/thresholds/:id)
 *     description: PUT endpoint for /feed/alerting/thresholds/:id
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.put('/feed/alerting/thresholds/:id', authenticateToken, monitoringController.updateFeedAlertingThreshold.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerting/rules/{id}:
 *   put:
 *     summary: feed alerting rule 수정
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Updates a specific feed alerting rule configuration.
 *       
 *       **Rule Configuration:**
 *       - **id**: Unique identifier for the rule
 *       - **name**: Human-readable name for the rule
 *       - **description**: Detailed description of the rule
 *       - **conditions**: Array of conditions that must all be met
 *       - **severity**: Alert severity level (low, medium, high, critical)
 *       - **enabled**: Whether the rule is active
 *       - **cooldownMinutes**: Minimum time between alerts of this type
 *       
 *       **Condition Structure:**
 *       Each condition must specify:
 *       - **metric**: Metric path to monitor
 *       - **operator**: Comparison operator
 *       - **threshold**: Numeric threshold value
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Rule ID to update
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [id, name, conditions, severity]
 *             properties:
 *               id:
 *                 type: string
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               conditions:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [metric, operator, threshold]
 *                   properties:
 *                     metric:
 *                       type: string
 *                     operator:
 *                       type: string
 *                       enum: [greater_than, less_than, equals, not_equals]
 *                     threshold:
 *                       type: number
 *               severity:
 *                 type: string
 *                 enum: [low, medium, high, critical]
 *               enabled:
 *                 type: boolean
 *                 default: true
 *               cooldownMinutes:
 *                 type: number
 *                 default: 15
 *     responses:
 *       200:
 *         description: Feed alerting rule updated successfully
 *       400:
 *         description: Bad request - Missing required fields
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/alerting/rules/:id:
 *   put:
 *     summary: PUT /feed/alerting/rules/:id (PUT /feed/alerting/rules/:id)
 *     description: PUT endpoint for /feed/alerting/rules/:id
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.put('/feed/alerting/rules/:id', authenticateToken, monitoringController.updateFeedAlertingRule.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerting/start:
 *   post:
 *     summary: Start feed alerting monitoring (Start feed alerting monitoring)
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Starts the feed alerting monitoring system.
 *       
 *       **Monitoring Features:**
 *       - Continuous monitoring of feed metrics
 *       - Threshold-based alert detection
 *       - Rule-based alert detection
 *       - Automatic alert notifications
 *       - Alert action execution
 *       
 *       **Monitoring Frequency:**
 *       - Checks run every 60 seconds
 *       - Respects cooldown periods to prevent spam
 *       - Monitors all enabled thresholds and rules
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed alerting monitoring started successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
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
 *                   example: Feed alerting monitoring started successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/feed/alerting/start', authenticateToken, monitoringController.startFeedAlerting.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerting/stop:
 *   post:
 *     summary: Stop feed alerting monitoring (Stop feed alerting monitoring)
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Stops the feed alerting monitoring system.
 *       
 *       **Stopping Monitoring:**
 *       - Immediately stops all metric monitoring
 *       - Clears monitoring intervals
 *       - Preserves alert configuration
 *       - Can be restarted at any time
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed alerting monitoring stopped successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
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
 *                   example: Feed alerting monitoring stopped successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/feed/alerting/stop', authenticateToken, monitoringController.stopFeedAlerting.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/alerting/status:
 *   get:
 *     summary: feed alerting status 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves the current status of the feed alerting monitoring system.
 *       
 *       **Status Information:**
 *       - **isMonitoring**: Whether monitoring is currently active
 *       - **thresholdsCount**: Number of configured thresholds
 *       - **rulesCount**: Number of configured rules
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Alerting]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed alerting status retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     isMonitoring:
 *                       type: boolean
 *                       example: true
 *                     thresholdsCount:
 *                       type: number
 *                       example: 8
 *                     rulesCount:
 *                       type: number
 *                       example: 3
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.get('/feed/alerting/status', authenticateToken, monitoringController.getFeedAlertingStatus.bind(monitoringController));

// ========================================
// FEED DASHBOARD ROUTES
// ========================================

/**
 * @swagger
 * /api/monitoring/feed/dashboard/overview:
 *   get:
 *     summary: feed dashboard 개요 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves a comprehensive overview of the feed system status including system health, active alerts, key metrics, and performance indicators.
 *       
 *       **Overview Data Includes:**
 *       - **System Status**: Overall health status (healthy, degraded, unhealthy)
 *       - **Active Alerts**: Number of currently active feed-related alerts
 *       - **Total Metrics**: Key counts (posts, comments, users, engagement)
 *       - **Performance**: Response times, error rates, uptime
 *       - **Health Checks**: Summary of all feed component health checks
 *       
 *       **Use Cases:**
 *       - Dashboard home page overview
 *       - System status monitoring
 *       - Quick health assessment
 *       - Alert prioritization
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed dashboard overview retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     systemStatus:
 *                       type: string
 *                       enum: [healthy, degraded, unhealthy]
 *                       example: healthy
 *                     activeAlerts:
 *                       type: integer
 *                       example: 2
 *                     totalMetrics:
 *                       type: object
 *                       properties:
 *                         posts:
 *                           type: integer
 *                           example: 1250
 *                         comments:
 *                           type: integer
 *                           example: 5600
 *                         users:
 *                           type: integer
 *                           example: 45
 *                         engagement:
 *                           type: integer
 *                           example: 12000
 *                     performance:
 *                       type: object
 *                       properties:
 *                         avgResponseTime:
 *                           type: number
 *                           example: 245.5
 *                         errorRate:
 *                           type: number
 *                           example: 1.2
 *                         uptime:
 *                           type: number
 *                           example: 86400
 *                     healthChecks:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                           example: 6
 *                         healthy:
 *                           type: integer
 *                           example: 5
 *                         degraded:
 *                           type: integer
 *                           example: 1
 *                         unhealthy:
 *                           type: integer
 *                           example: 0
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/overview:
 *   get:
 *     summary: GET /feed/dashboard/overview
 *     description: GET endpoint for /feed/dashboard/overview
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/overview', authenticateToken, monitoringController.getFeedDashboardOverview.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/metrics:
 *   get:
 *     summary: feed dashboard metrics 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves detailed metrics for the feed system including posts, comments, moderation, performance, engagement, and system health data.
 *       
 *       **Metrics Include:**
 *       - **Posts**: Total, published, pending, hidden, reported counts and rates
 *       - **Comments**: Total, approved, pending, hidden, reported counts and rates
 *       - **Moderation**: Queue length, processing times, approval rates
 *       - **Performance**: Load times, cache hit rates, Redis latency
 *       - **Engagement**: Likes, comments, shares, active users
 *       - **System Health**: Status of all feed components
 *       
 *       **Time Range Support:**
 *       - Default: Last 24 hours
 *       - Custom: Specify startDate and endDate parameters
 *       - Maximum: 7 days
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for metrics (ISO 8601 format)
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for metrics (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Feed dashboard metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *                     posts:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         published:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         hidden:
 *                           type: integer
 *                         reported:
 *                           type: integer
 *                         creationRate:
 *                           type: number
 *                         engagementRate:
 *                           type: number
 *                         trendingPosts:
 *                           type: integer
 *                     comments:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         approved:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                         hidden:
 *                           type: integer
 *                         reported:
 *                           type: integer
 *                         creationRate:
 *                           type: number
 *                     moderation:
 *                       type: object
 *                       properties:
 *                         queueLength:
 *                           type: integer
 *                         avgProcessingTime:
 *                           type: number
 *                         approvalRate:
 *                           type: number
 *                         rejectionRate:
 *                           type: number
 *                         autoApprovalRate:
 *                           type: number
 *                         manualReviewRate:
 *                           type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         avgFeedLoadTime:
 *                           type: number
 *                         avgPostCreationTime:
 *                           type: number
 *                         avgCommentCreationTime:
 *                           type: number
 *                         cacheHitRate:
 *                           type: number
 *                         redisLatency:
 *                           type: number
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         totalLikes:
 *                           type: integer
 *                         totalComments:
 *                           type: integer
 *                         totalShares:
 *                           type: integer
 *                         activeUsers:
 *                           type: integer
 *                         trendingPosts:
 *                           type: integer
 *                     systemHealth:
 *                       type: object
 *                       properties:
 *                         apiEndpoints:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         redisCache:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         imageProcessing:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         contentModeration:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         feedRanking:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                         databaseQueries:
 *                           type: string
 *                           enum: [healthy, degraded, unhealthy]
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/metrics:
 *   get:
 *     summary: /feed/dashboard/metrics 조회
 *     description: GET endpoint for /feed/dashboard/metrics
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/metrics', authenticateToken, monitoringController.getFeedDashboardMetrics.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/alerts:
 *   get:
 *     summary: feed dashboard alerts 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves comprehensive alert information for the feed system including active alerts, recent alerts, and alert summaries.
 *       
 *       **Alert Data Includes:**
 *       - **Active Alerts**: Currently unresolved feed-related alerts
 *       - **Recent Alerts**: Recently triggered and resolved alerts
 *       - **Alert Summary**: Counts by severity and type
 *       
 *       **Alert Types:**
 *       - Performance alerts (slow response times, high error rates)
 *       - Moderation alerts (queue backlog, processing issues)
 *       - Engagement alerts (low user activity, content issues)
 *       - System alerts (component failures, health issues)
 *       
 *       **Severity Levels:**
 *       - **Critical**: System-wide failures requiring immediate attention
 *       - **High**: Significant issues affecting user experience
 *       - **Medium**: Moderate issues that should be addressed soon
 *       - **Low**: Minor issues for monitoring and future improvement
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed dashboard alerts retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     active:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           triggeredAt:
 *                             type: string
 *                             format: date-time
 *                           metadata:
 *                             type: object
 *                     recent:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           id:
 *                             type: string
 *                           type:
 *                             type: string
 *                           severity:
 *                             type: string
 *                             enum: [low, medium, high, critical]
 *                           title:
 *                             type: string
 *                           message:
 *                             type: string
 *                           triggeredAt:
 *                             type: string
 *                             format: date-time
 *                           resolvedAt:
 *                             type: string
 *                             format: date-time
 *                           metadata:
 *                             type: object
 *                     summary:
 *                       type: object
 *                       properties:
 *                         total:
 *                           type: integer
 *                         bySeverity:
 *                           type: object
 *                           properties:
 *                             critical:
 *                               type: integer
 *                             high:
 *                               type: integer
 *                             medium:
 *                               type: integer
 *                             low:
 *                               type: integer
 *                         byType:
 *                           type: object
 *                           additionalProperties:
 *                             type: integer
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/alerts:
 *   get:
 *     summary: /feed/dashboard/alerts 조회
 *     description: GET endpoint for /feed/dashboard/alerts
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/alerts', authenticateToken, monitoringController.getFeedDashboardAlerts.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/trends:
 *   get:
 *     summary: feed dashboard trends 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves historical trend data for the feed system including posts, engagement, and performance trends over time.
 *       
 *       **Trend Data Includes:**
 *       - **Posts Trends**: Hourly and daily post creation and engagement patterns
 *       - **Engagement Trends**: Hourly and daily likes, comments, and shares
 *       - **Performance Trends**: Hourly and daily response times, error rates, cache performance
 *       
 *       **Time Granularity:**
 *       - **Hourly**: Data points for each hour within the time range
 *       - **Daily**: Aggregated data points for each day within the time range
 *       
 *       **Use Cases:**
 *       - Performance trend analysis
 *       - User engagement pattern identification
 *       - Capacity planning
 *       - Anomaly detection
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for trends (ISO 8601 format)
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for trends (ISO 8601 format)
 *     responses:
 *       200:
 *         description: Feed dashboard trends retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         start:
 *                           type: string
 *                           format: date-time
 *                         end:
 *                           type: string
 *                           format: date-time
 *                     posts:
 *                       type: object
 *                       properties:
 *                         hourly:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               hour:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                               engagement:
 *                                 type: number
 *                         daily:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               count:
 *                                 type: integer
 *                               engagement:
 *                                 type: number
 *                     engagement:
 *                       type: object
 *                       properties:
 *                         hourly:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               hour:
 *                                 type: string
 *                               likes:
 *                                 type: integer
 *                               comments:
 *                                 type: integer
 *                               shares:
 *                                 type: integer
 *                         daily:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               likes:
 *                                 type: integer
 *                               comments:
 *                                 type: integer
 *                               shares:
 *                                 type: integer
 *                     performance:
 *                       type: object
 *                       properties:
 *                         hourly:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               hour:
 *                                 type: string
 *                               avgLoadTime:
 *                                 type: number
 *                               errorRate:
 *                                 type: number
 *                               cacheHitRate:
 *                                 type: number
 *                         daily:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               date:
 *                                 type: string
 *                               avgLoadTime:
 *                                 type: number
 *                               errorRate:
 *                                 type: number
 *                               cacheHitRate:
 *                                 type: number
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/trends:
 *   get:
 *     summary: /feed/dashboard/trends 조회
 *     description: GET endpoint for /feed/dashboard/trends
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/trends', authenticateToken, monitoringController.getFeedDashboardTrends.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/config:
 *   get:
 *     summary: feed dashboard configuration 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves the current dashboard configuration including refresh intervals, time ranges, alert settings, and feature flags.
 *       
 *       **Configuration Includes:**
 *       - **Refresh Interval**: How often dashboard data is refreshed (seconds)
 *       - **Time Range**: Default and maximum time ranges for data queries
 *       - **Alert Settings**: Alert thresholds and notification preferences
 *       - **Feature Flags**: Enabled/disabled dashboard features
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed dashboard configuration retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     refreshInterval:
 *                       type: integer
 *                       example: 30
 *                     timeRange:
 *                       type: object
 *                       properties:
 *                         default:
 *                           type: integer
 *                           example: 24
 *                         max:
 *                           type: integer
 *                           example: 168
 *                     alerts:
 *                       type: object
 *                       properties:
 *                         enabled:
 *                           type: boolean
 *                         thresholds:
 *                           type: object
 *                           properties:
 *                             errorRate:
 *                               type: number
 *                             responseTime:
 *                               type: number
 *                             queueLength:
 *                               type: number
 *                     features:
 *                       type: object
 *                       properties:
 *                         realTimeUpdates:
 *                           type: boolean
 *                         historicalData:
 *                           type: boolean
 *                         alerting:
 *                           type: boolean
 *                         healthChecks:
 *                           type: boolean
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/config:
 *   get:
 *     summary: /feed/dashboard/config 조회
 *     description: GET endpoint for /feed/dashboard/config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/config', authenticateToken, monitoringController.getFeedDashboardConfig.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/config:
 *   put:
 *     summary: feed dashboard configuration 수정
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Updates the dashboard configuration including refresh intervals, time ranges, alert settings, and feature flags.
 *       
 *       **Configuration Updates:**
 *       - **Refresh Interval**: Adjust how often dashboard data is refreshed
 *       - **Time Range**: Modify default and maximum time ranges
 *       - **Alert Settings**: Update alert thresholds and notification preferences
 *       - **Feature Flags**: Enable/disable dashboard features
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               refreshInterval:
 *                 type: integer
 *                 minimum: 10
 *                 maximum: 3600
 *                 description: Refresh interval in seconds
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *               timeRange:
 *                 type: object
 *                 properties:
 *                   default:
 *                     type: integer
 *                     minimum: 1
 *                     maximum: 168
 *                     description: Default time range in hours
 *                   max:
 *                     type: integer
 *                     minimum: 24
 *                     maximum: 720
 *                     description: Maximum time range in hours
 *               alerts:
 *                 type: object
 *                 properties:
 *                   enabled:
 *                     type: boolean
 *                   thresholds:
 *                     type: object
 *                     properties:
 *                       errorRate:
 *                         type: number
 *                         minimum: 0
 *                         maximum: 100
 *                       responseTime:
 *                         type: number
 *                         minimum: 100
 *                         maximum: 10000
 *                       queueLength:
 *                         type: number
 *                         minimum: 1
 *                         maximum: 10000
 *               features:
 *                 type: object
 *                 properties:
 *                   realTimeUpdates:
 *                     type: boolean
 *                   historicalData:
 *                     type: boolean
 *                   alerting:
 *                     type: boolean
 *                   healthChecks:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Feed dashboard configuration updated successfully
 *       400:
 *         description: Bad request - Invalid configuration values
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/config:
 *   put:
 *     summary: PUT /feed/dashboard/config (PUT /feed/dashboard/config)
 *     description: PUT endpoint for /feed/dashboard/config
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.put('/feed/dashboard/config', authenticateToken, monitoringController.updateFeedDashboardConfig.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/realtime:
 *   get:
 *     summary: real-time feed dashboard updates 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves real-time updates for the feed dashboard including overview, metrics, and alerts data.
 *       
 *       **Real-time Data Includes:**
 *       - **Overview**: Current system status and key metrics
 *       - **Metrics**: Latest performance and engagement data
 *       - **Alerts**: Current active alerts and recent activity
 *       
 *       **Use Cases:**
 *       - Live dashboard updates
 *       - Real-time monitoring
 *       - Immediate status checks
 *       - Alert response coordination
 *       
 *       **Performance:**
 *       - Optimized for frequent polling
 *       - Cached data with smart invalidation
 *       - Minimal data transfer
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Real-time feed dashboard updates retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       $ref: '#/components/schemas/FeedDashboardOverview'
 *                     metrics:
 *                       $ref: '#/components/schemas/FeedDashboardMetrics'
 *                     alerts:
 *                       $ref: '#/components/schemas/FeedDashboardAlerts'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/realtime:
 *   get:
 *     summary: /feed/dashboard/realtime 조회
 *     description: GET endpoint for /feed/dashboard/realtime
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/realtime', authenticateToken, monitoringController.getFeedDashboardRealTime.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/cache/clear:
 *   post:
 *     summary: Clear feed dashboard cache (Clear feed dashboard cache)
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Clears all cached dashboard data to force fresh data retrieval on next request.
 *       
 *       **Cache Clearing:**
 *       - Removes all cached dashboard data
 *       - Forces fresh data retrieval
 *       - Improves data accuracy
 *       - May temporarily increase response times
 *       
 *       **Use Cases:**
 *       - Data accuracy issues
 *       - Configuration changes
 *       - Troubleshooting
 *       - Scheduled maintenance
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed dashboard cache cleared successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
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
 *                   example: Feed dashboard cache cleared successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
router.post('/feed/dashboard/cache/clear', authenticateToken, monitoringController.clearFeedDashboardCache.bind(monitoringController));

/**
 * @swagger
 * /api/monitoring/feed/dashboard/cache/stats:
 *   get:
 *     summary: feed dashboard cache statistics 조회
 *     description: |
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *       Retrieves statistics about the dashboard cache including size, keys, and hit rate information.
 *       
 *       **Cache Statistics Include:**
 *       - **Size**: Number of cached items
 *       - **Keys**: List of cached data keys
 *       - **Hit Rate**: Cache efficiency metrics
 *       
 *       **Use Cases:**
 *       - Performance monitoring
 *       - Cache optimization
 *       - Troubleshooting
 *       - Capacity planning
 *       
 *       **Authorization:** Requires valid JWT token.
 *     tags: [Monitoring, Social Feed, Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Feed dashboard cache statistics retrieved successfully
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     size:
 *                       type: integer
 *                       example: 15
 *                     keys:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["dashboard_overview", "dashboard_metrics", "dashboard_alerts"]
 *                     hitRate:
 *                       type: number
 *                       example: 0.85
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       401:
 *         description: Unauthorized - Invalid or missing token
 *       500:
 *         description: Internal server error
 */
/**
 * @swagger
 * /feed/dashboard/cache/stats:
 *   get:
 *     summary: /feed/dashboard/cache/stats 조회
 *     description: GET endpoint for /feed/dashboard/cache/stats
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
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

router.get('/feed/dashboard/cache/stats', authenticateToken, monitoringController.getFeedDashboardCacheStats.bind(monitoringController));

export default router;