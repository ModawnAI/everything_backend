import { logger } from '../utils/logger';
import { config } from '../config/environment';
import os from 'os';

// =============================================
// MONITORING TYPES
// =============================================

export interface MetricValue {
  value: number;
  timestamp: number;
  labels?: Record<string, string>;
}

export interface Metric {
  name: string;
  type: 'counter' | 'gauge' | 'histogram' | 'summary';
  description: string;
  values: MetricValue[];
  labels?: Record<string, string>;
}

export interface AlertRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // seconds
  lastTriggered?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: number;
  resolved: boolean;
  resolvedAt?: number;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usagePercent: number;
  };
  network: {
    bytesIn: number;
    bytesOut: number;
    connections: number;
  };
}

export interface ApplicationMetrics {
  requests: {
    total: number;
    success: number;
    error: number;
    rate: number; // requests per second
  };
  responseTime: {
    average: number;
    p95: number;
    p99: number;
    max: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    rate: number; // errors per second
  };
  business: {
    reservations: {
      total: number;
      pending: number;
      completed: number;
      cancelled: number;
    };
    payments: {
      total: number;
      success: number;
      failed: number;
      successRate: number;
    };
    users: {
      total: number;
      active: number;
      new: number;
    };
  };
}

// =============================================
// MONITORING SERVICE
// =============================================

export class MonitoringService {
  private metrics: Map<string, Metric> = new Map();
  private alertRules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private startTime: number = Date.now();

  constructor() {
    this.initializeDefaultMetrics();
    this.initializeDefaultAlertRules();
    this.startMetricsCollection();
  }

  /**
   * Initialize default application metrics
   */
  private initializeDefaultMetrics(): void {
    // System metrics
    this.createMetric('system_cpu_usage', 'gauge', 'CPU usage percentage');
    this.createMetric('system_memory_usage', 'gauge', 'Memory usage percentage');
    this.createMetric('system_disk_usage', 'gauge', 'Disk usage percentage');
    this.createMetric('system_load_average', 'gauge', 'System load average');

    // Application metrics
    this.createMetric('app_requests_total', 'counter', 'Total number of requests');
    this.createMetric('app_requests_success', 'counter', 'Total number of successful requests');
    this.createMetric('app_requests_error', 'counter', 'Total number of error requests');
    this.createMetric('app_response_time', 'histogram', 'Response time in milliseconds');
    this.createMetric('app_errors_total', 'counter', 'Total number of errors');
    this.createMetric('app_errors_by_type', 'counter', 'Errors by type');

    // Business metrics
    this.createMetric('business_reservations_total', 'counter', 'Total number of reservations');
    this.createMetric('business_payments_total', 'counter', 'Total number of payments');
    this.createMetric('business_payments_success', 'counter', 'Total number of successful payments');
    this.createMetric('business_users_total', 'counter', 'Total number of users');
    this.createMetric('business_users_active', 'counter', 'Number of active users');
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultAlertRules(): void {
    this.addAlertRule({
      id: 'high_cpu_usage',
      name: 'High CPU Usage',
      description: 'CPU usage is above 80%',
      condition: 'system_cpu_usage > 80',
      threshold: 80,
      severity: 'high',
      enabled: true,
      cooldown: 300, // 5 minutes
    });

    this.addAlertRule({
      id: 'high_memory_usage',
      name: 'High Memory Usage',
      description: 'Memory usage is above 85%',
      condition: 'system_memory_usage > 85',
      threshold: 85,
      severity: 'high',
      enabled: true,
      cooldown: 300,
    });

    this.addAlertRule({
      id: 'high_error_rate',
      name: 'High Error Rate',
      description: 'Error rate is above 5%',
      condition: 'app_errors_total / app_requests_total > 0.05',
      threshold: 0.05,
      severity: 'critical',
      enabled: true,
      cooldown: 60,
    });

    this.addAlertRule({
      id: 'slow_response_time',
      name: 'Slow Response Time',
      description: 'Average response time is above 2 seconds',
      condition: 'app_response_time_average > 2000',
      threshold: 2000,
      severity: 'medium',
      enabled: true,
      cooldown: 120,
    });

    this.addAlertRule({
      id: 'low_payment_success_rate',
      name: 'Low Payment Success Rate',
      description: 'Payment success rate is below 90%',
      condition: 'business_payments_success / business_payments_total < 0.9',
      threshold: 0.9,
      severity: 'critical',
      enabled: true,
      cooldown: 300,
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    // Collect system metrics every 30 seconds
    setInterval(() => {
      this.collectSystemMetrics();
    }, 30000);

    // Collect application metrics every 10 seconds
    setInterval(() => {
      this.collectApplicationMetrics();
    }, 10000);

    // Check alert rules every 30 seconds
    setInterval(() => {
      this.checkAlertRules();
    }, 30000);

    logger.info('Monitoring service started');
  }

  /**
   * Create a new metric
   */
  createMetric(name: string, type: Metric['type'], description: string): void {
    this.metrics.set(name, {
      name,
      type,
      description,
      values: [],
      labels: {},
    });
  }

  /**
   * Record a metric value
   */
  recordMetric(name: string, value: number, labels?: Record<string, string>): void {
    const metric = this.metrics.get(name);
    if (!metric) {
      logger.warn(`Metric ${name} not found`);
      return;
    }

    const metricValue: MetricValue = {
      value,
      timestamp: Date.now(),
      labels,
    };

    metric.values.push(metricValue);

    // Keep only last 1000 values to prevent memory issues
    if (metric.values.length > 1000) {
      metric.values = metric.values.slice(-1000);
    }

    logger.debug('Metric recorded', { name, value, labels });
  }

  /**
   * Get metric values
   */
  getMetric(name: string, duration?: number): MetricValue[] {
    const metric = this.metrics.get(name);
    if (!metric) return [];

    let values = metric.values;

    if (duration) {
      const cutoff = Date.now() - duration;
      values = values.filter(v => v.timestamp >= cutoff);
    }

    return values;
  }

  /**
   * Get current metric value
   */
  getCurrentMetric(name: string): number | null {
    const values = this.getMetric(name);
    return values.length > 0 ? values[values.length - 1].value : null;
  }

  /**
   * Add alert rule
   */
  addAlertRule(rule: AlertRule): void {
    this.alertRules.set(rule.id, rule);
    logger.info('Alert rule added', { ruleId: rule.id, name: rule.name });
  }

  /**
   * Update alert rule
   */
  updateAlertRule(ruleId: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    Object.assign(rule, updates);
    this.alertRules.set(ruleId, rule);
    logger.info('Alert rule updated', { ruleId, updates });
    return true;
  }

  /**
   * Delete alert rule
   */
  deleteAlertRule(ruleId: string): boolean {
    const deleted = this.alertRules.delete(ruleId);
    if (deleted) {
      logger.info('Alert rule deleted', { ruleId });
    }
    return deleted;
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts.filter(alert => !alert.resolved);
  }

  /**
   * Resolve alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert) return false;

    alert.resolved = true;
    alert.resolvedAt = Date.now();
    logger.info('Alert resolved', { alertId });
    return true;
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    try {
      // CPU metrics
      const cpus = os.cpus();
      const loadAverage = os.loadavg();
      const cpuUsage = this.calculateCPUUsage();

      this.recordMetric('system_cpu_usage', cpuUsage);
      this.recordMetric('system_load_average', loadAverage[0] || 0);

      // Memory metrics
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memoryUsagePercent = (usedMem / totalMem) * 100;

      this.recordMetric('system_memory_usage', memoryUsagePercent);

      // Simplified disk metrics (in production, use a library like 'diskusage')
      this.recordMetric('system_disk_usage', 45.2); // Mock value

      logger.debug('System metrics collected');
    } catch (error) {
      logger.error('Failed to collect system metrics', { error: (error as Error).message });
    }
  }

  /**
   * Collect application metrics
   */
  private collectApplicationMetrics(): void {
    try {
      // Mock application metrics (in production, these would be real)
      const requestsTotal = this.getCurrentMetric('app_requests_total') || 0;
      const requestsSuccess = this.getCurrentMetric('app_requests_success') || 0;
      const requestsError = this.getCurrentMetric('app_requests_error') || 0;

      // Calculate rates
      const now = Date.now();
      const uptime = (now - this.startTime) / 1000;
      const requestRate = uptime > 0 ? requestsTotal / uptime : 0;
      const errorRate = uptime > 0 ? requestsError / uptime : 0;

      this.recordMetric('app_requests_total', requestsTotal + Math.floor(Math.random() * 10));
      this.recordMetric('app_requests_success', requestsSuccess + Math.floor(Math.random() * 8));
      this.recordMetric('app_requests_error', requestsError + Math.floor(Math.random() * 2));

      // Mock response time
      const responseTime = 150 + Math.random() * 200;
      this.recordMetric('app_response_time', responseTime);

      logger.debug('Application metrics collected');
    } catch (error) {
      logger.error('Failed to collect application metrics', { error: (error as Error).message });
    }
  }

  /**
   * Check alert rules
   */
  private checkAlertRules(): void {
    for (const rule of this.alertRules.values()) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (rule.lastTriggered && Date.now() - rule.lastTriggered < rule.cooldown * 1000) {
        continue;
      }

      const triggered = this.evaluateAlertCondition(rule);
      if (triggered) {
        this.triggerAlert(rule);
        rule.lastTriggered = Date.now();
      }
    }
  }

  /**
   * Evaluate alert condition
   */
  private evaluateAlertCondition(rule: AlertRule): boolean {
    try {
      const condition = rule.condition;
      
      // Simple condition evaluation (in production, use a proper expression parser)
      if (condition.includes('system_cpu_usage')) {
        const cpuUsage = this.getCurrentMetric('system_cpu_usage') || 0;
        return cpuUsage > rule.threshold;
      }
      
      if (condition.includes('system_memory_usage')) {
        const memoryUsage = this.getCurrentMetric('system_memory_usage') || 0;
        return memoryUsage > rule.threshold;
      }
      
      if (condition.includes('app_response_time')) {
        const responseTime = this.getCurrentMetric('app_response_time') || 0;
        return responseTime > rule.threshold;
      }

      // Mock conditions for demonstration
      if (condition.includes('high_error_rate')) {
        return Math.random() > 0.8; // 20% chance of triggering
      }

      return false;
    } catch (error) {
      logger.error('Failed to evaluate alert condition', { ruleId: rule.id, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Trigger alert
   */
  private triggerAlert(rule: AlertRule): void {
    const alert: Alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      severity: rule.severity,
      message: rule.description,
      timestamp: Date.now(),
      resolved: false,
      metadata: {
        condition: rule.condition,
        threshold: rule.threshold,
      },
    };

    this.alerts.push(alert);

    // Keep only last 1000 alerts
    if (this.alerts.length > 1000) {
      this.alerts = this.alerts.slice(-1000);
    }

    logger.warn('Alert triggered', { alertId: alert.id, ruleId: rule.id, severity: rule.severity });

    // Send notification (in production, integrate with notification service)
    this.sendAlertNotification(alert);
  }

  /**
   * Send alert notification
   */
  private sendAlertNotification(alert: Alert): void {
    // In production, integrate with notification service
    logger.info('Alert notification sent', {
      alertId: alert.id,
      severity: alert.severity,
      message: alert.message,
    });
  }

  /**
   * Calculate CPU usage
   */
  private calculateCPUUsage(): number {
    // Simplified CPU calculation (in production, use proper CPU monitoring)
    return 25 + Math.random() * 30; // Mock value between 25-55%
  }

  /**
   * Get system metrics
   */
  getSystemMetrics(): SystemMetrics {
    const cpuUsage = this.getCurrentMetric('system_cpu_usage') || 0;
    const memoryUsage = this.getCurrentMetric('system_memory_usage') || 0;
    const loadAverage = os.loadavg();

    return {
      cpu: {
        usage: cpuUsage,
        loadAverage,
        cores: os.cpus().length,
      },
      memory: {
        total: os.totalmem(),
        used: os.totalmem() - os.freemem(),
        free: os.freemem(),
        usagePercent: memoryUsage,
      },
      disk: {
        total: 1000000000000, // Mock values
        used: 450000000000,
        free: 550000000000,
        usagePercent: 45,
      },
      network: {
        bytesIn: 1000000,
        bytesOut: 500000,
        connections: 150,
      },
    };
  }

  /**
   * Get application metrics
   */
  getApplicationMetrics(): ApplicationMetrics {
    const requestsTotal = this.getCurrentMetric('app_requests_total') || 0;
    const requestsSuccess = this.getCurrentMetric('app_requests_success') || 0;
    const requestsError = this.getCurrentMetric('app_requests_error') || 0;
    const responseTime = this.getCurrentMetric('app_response_time') || 0;

    return {
      requests: {
        total: requestsTotal,
        success: requestsSuccess,
        error: requestsError,
        rate: 15.5, // Mock rate
      },
      responseTime: {
        average: responseTime,
        p95: responseTime * 1.5,
        p99: responseTime * 2,
        max: responseTime * 3,
      },
      errors: {
        total: requestsError,
        byType: {
          'validation_error': 5,
          'database_error': 2,
          'external_api_error': 3,
        },
        rate: 0.5, // Mock rate
      },
      business: {
        reservations: {
          total: 1250,
          pending: 45,
          completed: 1150,
          cancelled: 55,
        },
        payments: {
          total: 1200,
          success: 1140,
          failed: 60,
          successRate: 95,
        },
        users: {
          total: 5000,
          active: 3200,
          new: 150,
        },
      },
    };
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  /**
   * Get metrics summary
   */
  getMetricsSummary(): {
    system: SystemMetrics;
    application: ApplicationMetrics;
    alerts: {
      total: number;
      active: number;
      bySeverity: Record<string, number>;
    };
  } {
    const activeAlerts = this.getActiveAlerts();
    const alertsBySeverity = activeAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return {
      system: this.getSystemMetrics(),
      application: this.getApplicationMetrics(),
      alerts: {
        total: this.alerts.length,
        active: activeAlerts.length,
        bySeverity: alertsBySeverity,
      },
    };
  }
}

// Global monitoring service instance
export const monitoringService = new MonitoringService(); 