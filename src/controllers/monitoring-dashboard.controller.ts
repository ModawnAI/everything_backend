/**
 * Monitoring Dashboard Controller
 * 
 * REST API endpoints for the production monitoring dashboard:
 * - Real-time metrics and KPIs
 * - Dashboard widgets and configuration
 * - Alert management and notifications
 * - SLA reporting and analytics
 * - System health and performance data
 */

import { Request, Response } from 'express';
import { monitoringDashboardService } from '../services/monitoring-dashboard.service';
import { logger } from '../utils/logger';
import { validateRequest } from '../middleware/validation.middleware';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

export class MonitoringDashboardController {
  /**
   * Get real-time metrics for dashboard
   * GET /api/monitoring/metrics
   */
  async getRealTimeMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('Getting real-time metrics', {
        userId: req.user?.id,
        timestamp: new Date().toISOString()
      });

      const metrics = await monitoringDashboardService.getRealTimeMetrics();

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get real-time metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_FETCH_ERROR',
          message: '실시간 메트릭을 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Get dashboard widgets configuration
   * GET /api/monitoring/widgets
   */
  async getDashboardWidgets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('Getting dashboard widgets', {
        userId: req.user?.id
      });

      const widgets = await monitoringDashboardService.getDashboardWidgets();

      res.status(200).json({
        success: true,
        data: widgets,
        count: widgets.length
      });
    } catch (error) {
      logger.error('Failed to get dashboard widgets', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'WIDGETS_FETCH_ERROR',
          message: '대시보드 위젯을 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Get active alerts
   * GET /api/monitoring/alerts
   */
  async getActiveAlerts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { severity, type, limit = 50 } = req.query;

      logger.info('Getting active alerts', {
        userId: req.user?.id,
        filters: { severity, type, limit }
      });

      let alerts = monitoringDashboardService.getActiveAlerts();

      // Apply filters
      if (severity) {
        const severityFilter = Array.isArray(severity) ? severity : [severity];
        alerts = alerts.filter(alert => severityFilter.includes(alert.severity));
      }

      if (type) {
        const typeFilter = Array.isArray(type) ? type : [type];
        alerts = alerts.filter(alert => typeFilter.includes(alert.type));
      }

      // Apply limit
      alerts = alerts.slice(0, parseInt(limit as string));

      res.status(200).json({
        success: true,
        data: alerts,
        count: alerts.length,
        filters: { severity, type, limit }
      });
    } catch (error) {
      logger.error('Failed to get active alerts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ALERTS_FETCH_ERROR',
          message: '활성 알림을 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Acknowledge alert
   * POST /api/monitoring/alerts/:alertId/acknowledge
   */
  async acknowledgeAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { assignee } = req.body;
      const userId = req.user?.id;

      logger.info('Acknowledging alert', {
        alertId,
        assignee: assignee || userId,
        userId
      });

      await monitoringDashboardService.acknowledgeAlert(
        alertId,
        assignee || userId
      );

      res.status(200).json({
        success: true,
        message: '알림이 확인되었습니다.',
        data: {
          alertId,
          assignee: assignee || userId,
          acknowledgedAt: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to acknowledge alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: req.params.alertId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ALERT_ACKNOWLEDGE_ERROR',
          message: '알림 확인에 실패했습니다.'
        }
      });
    }
  }

  /**
   * Resolve alert
   * POST /api/monitoring/alerts/:alertId/resolve
   */
  async resolveAlert(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { resolution } = req.body;
      const userId = req.user?.id;

      if (!resolution) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_RESOLUTION',
            message: '해결 내용을 입력해주세요.'
          }
        });
        return;
      }

      logger.info('Resolving alert', {
        alertId,
        resolution,
        userId
      });

      await monitoringDashboardService.resolveAlert(alertId, resolution);

      res.status(200).json({
        success: true,
        message: '알림이 해결되었습니다.',
        data: {
          alertId,
          resolution,
          resolvedAt: new Date().toISOString(),
          resolvedBy: userId
        }
      });
    } catch (error) {
      logger.error('Failed to resolve alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        alertId: req.params.alertId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'ALERT_RESOLVE_ERROR',
          message: '알림 해결에 실패했습니다.'
        }
      });
    }
  }

  /**
   * Get SLA report
   * GET /api/monitoring/sla
   */
  async getSLAReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { period = 'day' } = req.query;

      if (!['day', 'week', 'month'].includes(period as string)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_PERIOD',
            message: '유효하지 않은 기간입니다. day, week, month 중 하나를 선택해주세요.'
          }
        });
        return;
      }

      logger.info('Getting SLA report', {
        period,
        userId: req.user?.id
      });

      const slaReport = await monitoringDashboardService.getSLAReport(
        period as 'day' | 'week' | 'month'
      );

      res.status(200).json({
        success: true,
        data: slaReport,
        period
      });
    } catch (error) {
      logger.error('Failed to get SLA report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period: req.query.period,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'SLA_REPORT_ERROR',
          message: 'SLA 리포트를 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Get system health status
   * GET /api/monitoring/health
   */
  async getSystemHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      logger.info('Getting system health status', {
        userId: req.user?.id
      });

      const metrics = await monitoringDashboardService.getRealTimeMetrics();
      
      // Extract health-related metrics
      const healthStatus = {
        overall: 'healthy',
        components: {
          payments: {
            status: metrics.payments.successRate >= 95 ? 'healthy' : 'degraded',
            successRate: metrics.payments.successRate,
            transactionsPerSecond: metrics.payments.transactionsPerSecond
          },
          system: {
            status: metrics.system.responseTime <= 2000 ? 'healthy' : 'degraded',
            responseTime: metrics.system.responseTime,
            availability: metrics.system.availability,
            cpuUsage: metrics.system.cpuUsage,
            memoryUsage: metrics.system.memoryUsage
          },
          security: {
            status: metrics.security.fraudAttempts === 0 ? 'healthy' : 'warning',
            fraudAttempts: metrics.security.fraudAttempts,
            securityAlerts: metrics.security.securityAlerts
          }
        },
        timestamp: metrics.timestamp
      };

      // Determine overall status
      const componentStatuses = Object.values(healthStatus.components).map(c => c.status);
      if (componentStatuses.includes('degraded')) {
        healthStatus.overall = 'degraded';
      } else if (componentStatuses.includes('warning')) {
        healthStatus.overall = 'warning';
      }

      res.status(200).json({
        success: true,
        data: healthStatus
      });
    } catch (error) {
      logger.error('Failed to get system health status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'HEALTH_STATUS_ERROR',
          message: '시스템 상태를 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Get metrics history
   * GET /api/monitoring/metrics/history
   */
  async getMetricsHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        timeRange = '1h',
        metrics: requestedMetrics,
        granularity = '5m'
      } = req.query;

      logger.info('Getting metrics history', {
        timeRange,
        requestedMetrics,
        granularity,
        userId: req.user?.id
      });

      // This would typically query a time-series database
      // For now, we'll return sample data structure
      const historyData = {
        timeRange,
        granularity,
        metrics: requestedMetrics ? (requestedMetrics as string).split(',') : ['all'],
        data: [
          {
            timestamp: new Date(Date.now() - 60000).toISOString(),
            payments: {
              successRate: 98.5,
              transactionsPerSecond: 12.3,
              totalVolume: 1500000
            },
            system: {
              responseTime: 450,
              errorRate: 1.2,
              availability: 99.9
            }
          },
          {
            timestamp: new Date().toISOString(),
            payments: {
              successRate: 98.7,
              transactionsPerSecond: 11.8,
              totalVolume: 1520000
            },
            system: {
              responseTime: 420,
              errorRate: 1.1,
              availability: 99.9
            }
          }
        ]
      };

      res.status(200).json({
        success: true,
        data: historyData
      });
    } catch (error) {
      logger.error('Failed to get metrics history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_HISTORY_ERROR',
          message: '메트릭 히스토리를 가져오는데 실패했습니다.'
        }
      });
    }
  }

  /**
   * Export dashboard data
   * GET /api/monitoring/export
   */
  async exportDashboardData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { format = 'json', period = 'day' } = req.query;

      logger.info('Exporting dashboard data', {
        format,
        period,
        userId: req.user?.id
      });

      const [metrics, alerts, slaReport] = await Promise.all([
        monitoringDashboardService.getRealTimeMetrics(),
        monitoringDashboardService.getActiveAlerts(),
        monitoringDashboardService.getSLAReport(period as 'day' | 'week' | 'month')
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        period,
        metrics,
        alerts,
        slaReport,
        summary: {
          totalAlerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
          systemHealth: metrics.system.availability >= 99 ? 'healthy' : 'degraded'
        }
      };

      if (format === 'csv') {
        // Convert to CSV format
        const csv = this.convertToCSV(exportData);
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename=dashboard-export-${Date.now()}.csv`);
        res.status(200).send(csv);
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename=dashboard-export-${Date.now()}.json`);
        res.status(200).json(exportData);
      }
    } catch (error) {
      logger.error('Failed to export dashboard data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: '대시보드 데이터 내보내기에 실패했습니다.'
        }
      });
    }
  }

  /**
   * Helper method to convert data to CSV
   */
  private convertToCSV(data: any): string {
    // Simple CSV conversion for metrics
    const headers = ['Timestamp', 'Payment Success Rate', 'Response Time', 'Error Rate', 'Availability'];
    const rows = [headers.join(',')];
    
    // Add current metrics row
    rows.push([
      data.metrics.timestamp,
      data.metrics.payments.successRate,
      data.metrics.system.responseTime,
      data.metrics.system.errorRate,
      data.metrics.system.availability
    ].join(','));

    return rows.join('\n');
  }
}

export const monitoringDashboardController = new MonitoringDashboardController();
