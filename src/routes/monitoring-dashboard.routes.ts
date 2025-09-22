/**
 * Monitoring Dashboard Routes
 * 
 * API routes for production monitoring dashboard:
 * - Real-time metrics and KPIs
 * - Dashboard widgets and configuration
 * - Alert management and notifications
 * - SLA reporting and analytics
 * - System health monitoring
 */

import { Router } from 'express';
import { monitoringDashboardController } from '../controllers/monitoring-dashboard.controller';
// Note: Authentication and rate limiting middleware will be applied at the app level
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Authentication and rate limiting will be applied at the app level
// All monitoring routes require authentication

/**
 * @swagger
 * /api/monitoring/metrics:
 *   get:
 *     summary: real-time metrics 조회
 *     description: Retrieve current system metrics including payments, system performance, and security data
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
 *         description: Real-time metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     timestamp:
 *                       type: string
 *                       format: date-time
 *                     payments:
 *                       type: object
 *                       properties:
 *                         totalTransactions:
 *                           type: number
 *                         successRate:
 *                           type: number
 *                         totalVolume:
 *                           type: number
 *                     system:
 *                       type: object
 *                       properties:
 *                         responseTime:
 *                           type: number
 *                         availability:
 *                           type: number
 *                         cpuUsage:
 *                           type: number
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Internal server error
 */
router.get('/metrics', monitoringDashboardController.getRealTimeMetrics.bind(monitoringDashboardController));

/**
 * @swagger
 * /api/monitoring/widgets:
 *   get:
 *     summary: dashboard widgets 조회
 *     description: Retrieve dashboard widget configuration and layout
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
 *         description: Dashboard widgets retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                         enum: [metric, chart, table, alert, status]
 *                       title:
 *                         type: string
 *                       position:
 *                         type: object
 *                         properties:
 *                           x:
 *                             type: number
 *                           y:
 *                             type: number
 *                           width:
 *                             type: number
 *                           height:
 *                             type: number
 */
router.get('/widgets', monitoringDashboardController.getDashboardWidgets.bind(monitoringDashboardController));

/**
 * @swagger
 * /api/monitoring/alerts:
 *   get:
 *     summary: active alerts 조회
 *     description: Retrieve current active system alerts with optional filtering
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: severity
 *         schema:
 *           type: string
 *           enum: [critical, high, medium, low]
 *         description: Filter by alert severity
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [payment, system, security, business]
 *         description: Filter by alert type
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 50
 *         description: Maximum number of alerts to return
 *     responses:
 *       200:
 *         description: Active alerts retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       type:
 *                         type: string
 *                       severity:
 *                         type: string
 *                       title:
 *                         type: string
 *                       description:
 *                         type: string
 *                       status:
 *                         type: string
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 */
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

router.get('/alerts', 
  [
    query('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
    query('type').optional().isIn(['payment', 'system', 'security', 'business']),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  validateRequest,
  monitoringDashboardController.getActiveAlerts.bind(monitoringDashboardController)
);

/**
 * @swagger
 * /api/monitoring/alerts/{alertId}/acknowledge:
 *   post:
 *     summary: Acknowledge alert (Acknowledge alert)
 *     description: Mark an alert as acknowledged by a team member
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID to acknowledge
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               assignee:
 *                 type: string
 *                 description: User ID of the assignee (optional, defaults to current user)
 *     responses:
 *       200:
 *         description: Alert acknowledged successfully
 *       400:
 *         description: Invalid request
 *       404:
 *         description: Alert not found
 */
router.post('/alerts/:alertId/acknowledge',
  [
    param('alertId').notEmpty().withMessage('Alert ID is required'),
    body('assignee').optional().isString()
  ],
  validateRequest,
  monitoringDashboardController.acknowledgeAlert.bind(monitoringDashboardController)
);

/**
 * @swagger
 * /api/monitoring/alerts/{alertId}/resolve:
 *   post:
 *     summary: Resolve alert (Resolve alert)
 *     description: Mark an alert as resolved with resolution details
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: alertId
 *         required: true
 *         schema:
 *           type: string
 *         description: Alert ID to resolve
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - resolution
 *             properties:
 *               resolution:
 *                 type: string
 *                 description: Description of how the alert was resolved
 *     responses:
 *       200:
 *         description: Alert resolved successfully
 *       400:
 *         description: Invalid request or missing resolution
 *       404:
 *         description: Alert not found
 */
router.post('/alerts/:alertId/resolve',
  [
    param('alertId').notEmpty().withMessage('Alert ID is required'),
    body('resolution').notEmpty().withMessage('Resolution description is required')
  ],
  validateRequest,
  monitoringDashboardController.resolveAlert.bind(monitoringDashboardController)
);

/**
 * @swagger
 * /api/monitoring/sla:
 *   get:
 *     summary: SLA report 조회
 *     description: Retrieve Service Level Agreement report for specified period
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Report period
 *     responses:
 *       200:
 *         description: SLA report retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     period:
 *                       type: string
 *                     availability:
 *                       type: object
 *                       properties:
 *                         target:
 *                           type: number
 *                         actual:
 *                           type: number
 *                         uptime:
 *                           type: number
 *                         downtime:
 *                           type: number
 *                     performance:
 *                       type: object
 *                       properties:
 *                         responseTimeTarget:
 *                           type: number
 *                         averageResponseTime:
 *                           type: number
 */
/**
 * @swagger
 * /sla:
 *   get:
 *     summary: /sla 조회
 *     description: GET endpoint for /sla
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

router.get('/sla',
  [
    query('period').optional().isIn(['day', 'week', 'month'])
  ],
  validateRequest,
  monitoringDashboardController.getSLAReport.bind(monitoringDashboardController)
);

/**
 * @swagger
 * /api/monitoring/health:
 *   get:
 *     summary: system health status 조회
 *     description: Retrieve overall system health status and component health
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
 *         description: System health status retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     overall:
 *                       type: string
 *                       enum: [healthy, warning, degraded]
 *                     components:
 *                       type: object
 *                       properties:
 *                         payments:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             successRate:
 *                               type: number
 *                         system:
 *                           type: object
 *                           properties:
 *                             status:
 *                               type: string
 *                             responseTime:
 *                               type: number
 *                             availability:
 *                               type: number
 */
router.get('/health', monitoringDashboardController.getSystemHealth.bind(monitoringDashboardController));

/**
 * @swagger
 * /api/monitoring/metrics/history:
 *   get:
 *     summary: metrics history 조회
 *     description: Retrieve historical metrics data for specified time range
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         schema:
 *           type: string
 *           enum: [1h, 6h, 24h, 7d, 30d]
 *           default: 1h
 *         description: Time range for historical data
 *       - in: query
 *         name: metrics
 *         schema:
 *           type: string
 *         description: Comma-separated list of specific metrics to retrieve
 *       - in: query
 *         name: granularity
 *         schema:
 *           type: string
 *           enum: [1m, 5m, 15m, 1h, 1d]
 *           default: 5m
 *         description: Data granularity
 *     responses:
 *       200:
 *         description: Metrics history retrieved successfully
 */
router.get('/metrics/history',
  [
    query('timeRange').optional().isIn(['1h', '6h', '24h', '7d', '30d']),
    query('granularity').optional().isIn(['1m', '5m', '15m', '1h', '1d']),
    query('metrics').optional().isString()
  ],
  validateRequest,
  monitoringDashboardController.getMetricsHistory.bind(monitoringDashboardController)
);

/**
 * @swagger
 * /api/monitoring/export:
 *   get:
 *     summary: Export dashboard data (Export dashboard data)
 *     description: Export monitoring dashboard data in JSON or CSV format
 *       
 *       서비스 API입니다. 플랫폼의 핵심 기능을 제공합니다.
 *       
 *       ---
 *       
 *     tags: [Monitoring]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [json, csv]
 *           default: json
 *         description: Export format
 *       - in: query
 *         name: period
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *           default: day
 *         description: Data period to export
 *     responses:
 *       200:
 *         description: Dashboard data exported successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *           text/csv:
 *             schema:
 *               type: string
 */
router.get('/export',
  [
    query('format').optional().isIn(['json', 'csv']),
    query('period').optional().isIn(['day', 'week', 'month'])
  ],
  validateRequest,
  monitoringDashboardController.exportDashboardData.bind(monitoringDashboardController)
);

export default router;
