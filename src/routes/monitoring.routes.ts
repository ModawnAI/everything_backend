import { Router, Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MetricValue:
 *       type: object
 *       properties:
 *         value:
 *           type: number
 *           description: Metric value
 *         timestamp:
 *           type: number
 *           description: Timestamp in milliseconds
 *         labels:
 *           type: object
 *           description: Optional labels
 *     Metric:
 *       type: object
 *       properties:
 *         name:
 *           type: string
 *           description: Metric name
 *         type:
 *           type: string
 *           enum: [counter, gauge, histogram, summary]
 *           description: Metric type
 *         description:
 *           type: string
 *           description: Metric description
 *         values:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/MetricValue'
 *     AlertRule:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Alert rule ID
 *         name:
 *           type: string
 *           description: Alert rule name
 *         description:
 *           type: string
 *           description: Alert rule description
 *         condition:
 *           type: string
 *           description: Alert condition expression
 *         threshold:
 *           type: number
 *           description: Alert threshold value
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Alert severity level
 *         enabled:
 *           type: boolean
 *           description: Whether the rule is enabled
 *         cooldown:
 *           type: number
 *           description: Cooldown period in seconds
 *     Alert:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Alert ID
 *         ruleId:
 *           type: string
 *           description: Associated alert rule ID
 *         severity:
 *           type: string
 *           enum: [low, medium, high, critical]
 *           description: Alert severity
 *         message:
 *           type: string
 *           description: Alert message
 *         timestamp:
 *           type: number
 *           description: Alert timestamp
 *         resolved:
 *           type: boolean
 *           description: Whether alert is resolved
 *         resolvedAt:
 *           type: number
 *           description: Resolution timestamp
 *         metadata:
 *           type: object
 *           description: Additional alert metadata
 */

/**
 * GET /monitoring/metrics
 * Get all metrics
 */
router.get('/metrics', async (req: Request, res: Response) => {
  try {
    const metrics = monitoringService.getAllMetrics();
    
    logger.info('Metrics requested', {
      correlationId: (req as any).correlationId,
      count: metrics.length,
    });

    res.status(200).json({
      success: true,
      data: metrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get metrics', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'METRICS_FETCH_FAILED',
        message: 'Failed to fetch metrics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/metrics/:name
 * Get specific metric
 */
router.get('/metrics/:name', async (req: Request, res: Response) => {
  try {
    const { name } = req.params;
    const { duration } = req.query;

    const values = monitoringService.getMetric(name, duration ? parseInt(duration as string || '0') : undefined);

    logger.info('Metric requested', {
      correlationId: (req as any).correlationId,
      name,
      duration,
      valuesCount: values.length,
    });

    res.status(200).json({
      success: true,
      data: {
        name,
        values,
        count: values.length,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get metric', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'METRIC_FETCH_FAILED',
        message: 'Failed to fetch metric',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /monitoring/metrics
 * Record a metric value
 */
router.post('/metrics', async (req: Request, res: Response) => {
  try {
    const { name, value, labels } = req.body;

    if (!name || value === undefined) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_METRIC_REQUEST',
          message: 'Name and value are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    monitoringService.recordMetric(name, value, labels);

    logger.info('Metric recorded', {
      correlationId: (req as any).correlationId,
      name,
      value,
      labels,
    });

    res.status(200).json({
      success: true,
      message: 'Metric recorded successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to record metric', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'METRIC_RECORD_FAILED',
        message: 'Failed to record metric',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/alerts
 * Get all alerts
 */
router.get('/alerts', async (req: Request, res: Response) => {
  try {
    const { active } = req.query;
    let alerts;

    if (active === 'true') {
      alerts = monitoringService.getActiveAlerts();
    } else {
      // Return all alerts (active and resolved)
      alerts = monitoringService.getActiveAlerts(); // Simplified for demo
    }

    logger.info('Alerts requested', {
      correlationId: (req as any).correlationId,
      active: active === 'true',
      count: alerts.length,
    });

    res.status(200).json({
      success: true,
      data: alerts,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get alerts', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERTS_FETCH_FAILED',
        message: 'Failed to fetch alerts',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/alerts/rules
 * Get all alert rules
 */
router.get('/alerts/rules', async (req: Request, res: Response) => {
  try {
    const rules = monitoringService.getAlertRules();

    logger.info('Alert rules requested', {
      correlationId: (req as any).correlationId,
      count: rules.length,
    });

    res.status(200).json({
      success: true,
      data: rules,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get alert rules', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RULES_FETCH_FAILED',
        message: 'Failed to fetch alert rules',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /monitoring/alerts/rules
 * Create new alert rule
 */
router.post('/alerts/rules', async (req: Request, res: Response) => {
  try {
    const rule = req.body;

    if (!rule.name || !rule.condition || !rule.threshold) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_ALERT_RULE',
          message: 'Name, condition, and threshold are required',
          timestamp: new Date().toISOString(),
        },
      });
    }

    monitoringService.addAlertRule(rule);

    logger.info('Alert rule created', {
      correlationId: (req as any).correlationId,
      ruleId: rule.id,
      name: rule.name,
    });

    res.status(201).json({
      success: true,
      message: 'Alert rule created successfully',
      data: rule,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to create alert rule', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RULE_CREATE_FAILED',
        message: 'Failed to create alert rule',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * PUT /monitoring/alerts/rules/:id
 * Update alert rule
 */
router.put('/alerts/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const success = monitoringService.updateAlertRule(id, updates);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_RULE_NOT_FOUND',
          message: 'Alert rule not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info('Alert rule updated', {
      correlationId: (req as any).correlationId,
      ruleId: id,
      updates,
    });

    res.status(200).json({
      success: true,
      message: 'Alert rule updated successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to update alert rule', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RULE_UPDATE_FAILED',
        message: 'Failed to update alert rule',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * DELETE /monitoring/alerts/rules/:id
 * Delete alert rule
 */
router.delete('/alerts/rules/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = monitoringService.deleteAlertRule(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_RULE_NOT_FOUND',
          message: 'Alert rule not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info('Alert rule deleted', {
      correlationId: (req as any).correlationId,
      ruleId: id,
    });

    res.status(200).json({
      success: true,
      message: 'Alert rule deleted successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to delete alert rule', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RULE_DELETE_FAILED',
        message: 'Failed to delete alert rule',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * POST /monitoring/alerts/:id/resolve
 * Resolve alert
 */
router.post('/alerts/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const success = monitoringService.resolveAlert(id);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'ALERT_NOT_FOUND',
          message: 'Alert not found',
          timestamp: new Date().toISOString(),
        },
      });
    }

    logger.info('Alert resolved', {
      correlationId: (req as any).correlationId,
      alertId: id,
    });

    res.status(200).json({
      success: true,
      message: 'Alert resolved successfully',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to resolve alert', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'ALERT_RESOLVE_FAILED',
        message: 'Failed to resolve alert',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/dashboard
 * Get dashboard summary
 */
router.get('/dashboard', async (req: Request, res: Response) => {
  try {
    const summary = monitoringService.getMetricsSummary();

    logger.info('Dashboard requested', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      data: summary,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get dashboard', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'DASHBOARD_FETCH_FAILED',
        message: 'Failed to fetch dashboard',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/system
 * Get system metrics
 */
router.get('/system', async (req: Request, res: Response) => {
  try {
    const systemMetrics = monitoringService.getSystemMetrics();

    logger.info('System metrics requested', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      data: systemMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get system metrics', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'SYSTEM_METRICS_FETCH_FAILED',
        message: 'Failed to fetch system metrics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

/**
 * GET /monitoring/application
 * Get application metrics
 */
router.get('/application', async (req: Request, res: Response) => {
  try {
    const applicationMetrics = monitoringService.getApplicationMetrics();

    logger.info('Application metrics requested', {
      correlationId: (req as any).correlationId,
    });

    res.status(200).json({
      success: true,
      data: applicationMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get application metrics', {
      correlationId: (req as any).correlationId,
      error: (error as Error).message,
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'APPLICATION_METRICS_FETCH_FAILED',
        message: 'Failed to fetch application metrics',
        timestamp: new Date().toISOString(),
      },
    });
  }
});

export default router; 