/**
 * Admin Security Events Routes
 * 
 * Administrative routes for monitoring and managing comprehensive security events
 */

import { Router, Request, Response } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { requireAdmin } from '../middleware/rbac.middleware';
import { comprehensiveSecurityLoggingService } from '../services/comprehensive-security-logging.service';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { logger } from '../utils/logger';

const router = Router();

// Apply authentication and admin role requirement to all routes
router.use(authenticateJWT());
router.use(requireAdmin());

/**
 * GET /api/admin/security-events/statistics
 * Get comprehensive security statistics
 */

/**
 * @swagger
 * /statistics:
 *   get:
 *     summary: /statistics 조회
 *     description: GET endpoint for /statistics
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.get('/statistics', async (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 24 * 60 * 60 * 1000; // Default 24 hours
    
    const statistics = await comprehensiveSecurityLoggingService.getSecurityStatistics(timeWindow);
    
    res.json({
      success: true,
      data: {
        ...statistics,
        timeWindow: timeWindow,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get security statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'STATISTICS_ERROR',
        message: 'Failed to retrieve security statistics'
      }
    });
  }
});

/**
 * GET /api/admin/security-events/recent
 * Get recent security events
 */

/**
 * @swagger
 * /recent:
 *   get:
 *     summary: /recent 조회
 *     description: GET endpoint for /recent
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.get('/recent', async (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;
    const middleware = req.query.middleware as string;
    const threatLevel = req.query.threatLevel as string;
    const severity = req.query.severity as string;

    const statistics = await comprehensiveSecurityLoggingService.getSecurityStatistics();
    let recentEvents = statistics.recentEvents;

    // Apply filters
    if (middleware) {
      recentEvents = recentEvents.filter(e => e.middleware === middleware);
    }
    if (threatLevel) {
      recentEvents = recentEvents.filter(e => e.threatLevel === threatLevel);
    }
    if (severity) {
      recentEvents = recentEvents.filter(e => e.severity === severity);
    }

    // Apply pagination
    const paginatedEvents = recentEvents.slice(offset, offset + limit);

    res.json({
      success: true,
      data: {
        events: paginatedEvents,
        pagination: {
          limit,
          offset,
          total: recentEvents.length,
          hasMore: offset + limit < recentEvents.length
        },
        filters: {
          middleware,
          threatLevel,
          severity
        }
      }
    });

  } catch (error) {
    logger.error('Failed to get recent security events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'EVENTS_ERROR',
        message: 'Failed to retrieve recent security events'
      }
    });
  }
});

/**
 * GET /api/admin/security-events/alerts
 * Get active security alerts
 */

/**
 * @swagger
 * /alerts:
 *   get:
 *     summary: /alerts 조회
 *     description: GET endpoint for /alerts
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const severity = req.query.severity as string;
    const alerts = await securityMonitoringService.getActiveAlerts(severity as any);

    res.json({
      success: true,
      data: {
        alerts,
        count: alerts.length,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get security alerts', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_ERROR',
        message: 'Failed to retrieve security alerts'
      }
    });
  }
});

/**
 * POST /api/admin/security-events/alerts/:alertId/resolve
 * Resolve a security alert
 */

/**
 * @swagger
 * /alerts/:alertId/resolve:
 *   post:
 *     summary: POST /alerts/:alertId/resolve (POST /alerts/:alertId/resolve)
 *     description: POST endpoint for /alerts/:alertId/resolve
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.post('/alerts/:alertId/resolve', async (req: Request, res: Response) => {
  try {
    const { alertId } = req.params;
    const { resolutionNotes } = req.body;
    const adminId = (req as any).user?.id;

    await securityMonitoringService.resolveSecurityAlert(alertId, adminId, resolutionNotes);

    // Log admin action
    await comprehensiveSecurityLoggingService.logAdminActionEvent(req, 'resolve_security_alert', undefined, {
      alertId,
      resolutionNotes
    });

    res.json({
      success: true,
      data: {
        message: 'Security alert resolved successfully',
        alertId,
        resolvedBy: adminId,
        resolvedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to resolve security alert', {
      error: error instanceof Error ? error.message : 'Unknown error',
      alertId: req.params.alertId,
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'RESOLVE_ALERT_ERROR',
        message: 'Failed to resolve security alert'
      }
    });
  }
});

/**
 * GET /api/admin/security-events/compliance-report
 * Generate compliance report
 */

/**
 * @swagger
 * /compliance-report:
 *   get:
 *     summary: /compliance-report 조회
 *     description: GET endpoint for /compliance-report
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.get('/compliance-report', async (req: Request, res: Response) => {
  try {
    const report = await securityMonitoringService.generateComplianceReport();

    res.json({
      success: true,
      data: report
    });

  } catch (error) {
    logger.error('Failed to generate compliance report', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'COMPLIANCE_REPORT_ERROR',
        message: 'Failed to generate compliance report'
      }
    });
  }
});

/**
 * GET /api/admin/security-events/middleware-stats
 * Get statistics by middleware
 */
/**
 * @swagger
 * /middleware-stats:
 *   get:
 *     summary: /middleware-stats 조회
 *     description: GET endpoint for /middleware-stats
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
 *       
 *       ---
 *       
 *     tags: [Admin Security]
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

router.get('/middleware-stats', async (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 24 * 60 * 60 * 1000;
    const statistics = await comprehensiveSecurityLoggingService.getSecurityStatistics(timeWindow);

    const middlewareStats = Object.entries(statistics.eventsByMiddleware).map(([middleware, count]) => ({
      middleware,
      count,
      percentage: ((count / statistics.totalEvents) * 100).toFixed(2)
    }));

    res.json({
      success: true,
      data: {
        middlewareStats,
        totalEvents: statistics.totalEvents,
        timeWindow,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get middleware statistics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'MIDDLEWARE_STATS_ERROR',
        message: 'Failed to retrieve middleware statistics'
      }
    });
  }
});

/**
 * GET /api/admin/security-events/threat-analysis
 * Get threat analysis
 */

/**
 * @swagger
 * /threat-analysis:
 *   get:
 *     summary: /threat-analysis 조회
 *     description: GET endpoint for /threat-analysis
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.get('/threat-analysis', async (req: Request, res: Response) => {
  try {
    const timeWindow = parseInt(req.query.timeWindow as string) || 24 * 60 * 60 * 1000;
    const statistics = await comprehensiveSecurityLoggingService.getSecurityStatistics(timeWindow);

    const threatAnalysis = {
      threatLevels: statistics.eventsByThreatLevel,
      severities: statistics.eventsBySeverity,
      blockedEvents: statistics.blockedEvents,
      blockRate: statistics.totalEvents > 0 ? 
        ((statistics.blockedEvents / statistics.totalEvents) * 100).toFixed(2) : '0.00',
      topThreatIPs: statistics.topThreatIPs,
      riskScore: calculateRiskScore(statistics)
    };

    res.json({
      success: true,
      data: {
        ...threatAnalysis,
        timeWindow,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    logger.error('Failed to get threat analysis', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'THREAT_ANALYSIS_ERROR',
        message: 'Failed to retrieve threat analysis'
      }
    });
  }
});

/**
 * POST /api/admin/security-events/export
 * Export security events
 */

/**
 * @swagger
 * /export:
 *   post:
 *     summary: POST /export (POST /export)
 *     description: POST endpoint for /export
 *       
 *       관리자용 보안 관리 API입니다. 보안 이벤트와 위협을 모니터링합니다.
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
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { format = 'json', timeWindow = 24 * 60 * 60 * 1000, filters = {} } = req.body;
    
    const statistics = await comprehensiveSecurityLoggingService.getSecurityStatistics(timeWindow);
    let events = statistics.recentEvents;

    // Apply filters
    if (filters.middleware) {
      events = events.filter(e => e.middleware === filters.middleware);
    }
    if (filters.threatLevel) {
      events = events.filter(e => e.threatLevel === filters.threatLevel);
    }
    if (filters.severity) {
      events = events.filter(e => e.severity === filters.severity);
    }

    // Log admin action
    await comprehensiveSecurityLoggingService.logAdminActionEvent(req, 'export_security_events', undefined, {
      format,
      timeWindow,
      filters,
      eventCount: events.length
    });

    if (format === 'csv') {
      const csv = convertToCSV(events);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="security-events.csv"');
      res.send(csv);
    } else {
      res.json({
        success: true,
        data: {
          events,
          metadata: {
            exportedAt: new Date().toISOString(),
            totalEvents: events.length,
            timeWindow,
            filters
          }
        }
      });
    }

  } catch (error) {
    logger.error('Failed to export security events', {
      error: error instanceof Error ? error.message : 'Unknown error',
      adminId: (req as any).user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'EXPORT_ERROR',
        message: 'Failed to export security events'
      }
    });
  }
});

/**
 * Calculate risk score based on security statistics
 */
function calculateRiskScore(statistics: any): number {
  const { eventsByThreatLevel, eventsBySeverity, blockedEvents, totalEvents } = statistics;
  
  let riskScore = 0;
  
  // Base score from threat levels
  riskScore += (eventsByThreatLevel.critical || 0) * 10;
  riskScore += (eventsByThreatLevel.high || 0) * 5;
  riskScore += (eventsByThreatLevel.medium || 0) * 2;
  riskScore += (eventsByThreatLevel.low || 0) * 1;
  
  // Severity multiplier
  riskScore += (eventsBySeverity.critical || 0) * 15;
  riskScore += (eventsBySeverity.high || 0) * 8;
  riskScore += (eventsBySeverity.medium || 0) * 3;
  
  // Block rate penalty
  const blockRate = totalEvents > 0 ? (blockedEvents / totalEvents) : 0;
  riskScore += blockRate * 20;
  
  // Normalize to 0-100 scale
  const maxPossibleScore = totalEvents * 25; // Worst case scenario
  const normalizedScore = maxPossibleScore > 0 ? Math.min((riskScore / maxPossibleScore) * 100, 100) : 0;
  
  return Math.round(normalizedScore);
}

/**
 * Convert events to CSV format
 */
function convertToCSV(events: any[]): string {
  if (events.length === 0) return 'No events to export';
  
  const headers = [
    'Timestamp',
    'Event Type',
    'Severity',
    'Middleware',
    'Threat Level',
    'Source IP',
    'User ID',
    'Endpoint',
    'Method',
    'Blocked',
    'Response Code',
    'Correlation ID'
  ];
  
  const rows = events.map(event => [
    event.timestamp,
    event.eventType,
    event.severity,
    event.middleware,
    event.threatLevel,
    event.sourceIp,
    event.userId || '',
    event.endpoint,
    event.method,
    event.blocked ? 'Yes' : 'No',
    event.responseCode || '',
    event.correlationId || ''
  ]);
  
  const csvContent = [headers, ...rows]
    .map(row => row.map(field => `"${field}"`).join(','))
    .join('\n');
  
  return csvContent;
}

export default router;
