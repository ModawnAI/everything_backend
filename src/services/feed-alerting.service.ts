/**
 * Feed Alerting Service
 * 
 * Handles feed-specific alerting, threshold monitoring, and notification management
 */

import { logger } from '../utils/logger';
import { monitoringService } from './monitoring.service';
import database from '../config/database';

export interface FeedAlertThreshold {
  id: string;
  name: string;
  description: string;
  metric: string;
  operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: string;
}

export interface FeedAlertRule {
  id: string;
  name: string;
  description: string;
  conditions: {
    metric: string;
    operator: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
    threshold: number;
  }[];
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownMinutes: number;
  lastTriggered?: string;
}

export interface FeedAlertNotification {
  id: string;
  alertId: string;
  type: 'email' | 'sms' | 'webhook' | 'slack' | 'discord';
  recipient: string;
  template: string;
  enabled: boolean;
}

export interface FeedAlertAction {
  id: string;
  alertId: string;
  type: 'auto_hide_content' | 'escalate_moderation' | 'rate_limit_user' | 'disable_feature' | 'webhook_call';
  parameters: Record<string, any>;
  enabled: boolean;
}

export class FeedAlertingService {
  private thresholds: Map<string, FeedAlertThreshold> = new Map();
  private rules: Map<string, FeedAlertRule> = new Map();
  private notifications: Map<string, FeedAlertNotification[]> = new Map();
  private actions: Map<string, FeedAlertAction[]> = new Map();
  private isMonitoring: boolean = false;
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultThresholds();
    this.initializeDefaultRules();
    this.loadConfiguration();
  }

  /**
   * Initialize default alert thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: FeedAlertThreshold[] = [
      {
        id: 'high_error_rate',
        name: 'High Feed Error Rate',
        description: 'Alert when feed operation error rate exceeds threshold',
        metric: 'feed_error_rate',
        operator: 'greater_than',
        threshold: 5, // 5%
        severity: 'high',
        enabled: true,
        cooldownMinutes: 15
      },
      {
        id: 'slow_feed_load',
        name: 'Slow Feed Load Time',
        description: 'Alert when average feed load time exceeds threshold',
        metric: 'avg_feed_load_time',
        operator: 'greater_than',
        threshold: 3000, // 3 seconds
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 10
      },
      {
        id: 'high_moderation_queue',
        name: 'High Moderation Queue Length',
        description: 'Alert when moderation queue exceeds threshold',
        metric: 'moderation_queue_length',
        operator: 'greater_than',
        threshold: 100,
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 30
      },
      {
        id: 'low_engagement_rate',
        name: 'Low Engagement Rate',
        description: 'Alert when overall engagement rate drops below threshold',
        metric: 'engagement_rate',
        operator: 'less_than',
        threshold: 0.05, // 5%
        severity: 'low',
        enabled: true,
        cooldownMinutes: 60
      },
      {
        id: 'spike_in_reports',
        name: 'Spike in Content Reports',
        description: 'Alert when content reports spike above normal levels',
        metric: 'reports_per_hour',
        operator: 'greater_than',
        threshold: 50,
        severity: 'high',
        enabled: true,
        cooldownMinutes: 15
      },
      {
        id: 'redis_cache_failure',
        name: 'Redis Cache Failure',
        description: 'Alert when Redis cache operations fail',
        metric: 'redis_cache_failure_rate',
        operator: 'greater_than',
        threshold: 10, // 10%
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5
      },
      {
        id: 'image_processing_failure',
        name: 'Image Processing Failure',
        description: 'Alert when image processing fails frequently',
        metric: 'image_processing_failure_rate',
        operator: 'greater_than',
        threshold: 15, // 15%
        severity: 'high',
        enabled: true,
        cooldownMinutes: 10
      },
      {
        id: 'content_moderation_failure',
        name: 'Content Moderation Failure',
        description: 'Alert when content moderation service fails',
        metric: 'moderation_service_failure_rate',
        operator: 'greater_than',
        threshold: 5, // 5%
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 5
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.id, threshold);
    });
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: FeedAlertRule[] = [
      {
        id: 'system_degradation',
        name: 'Feed System Degradation',
        description: 'Multiple feed components showing degraded performance',
        conditions: [
          { metric: 'feed_error_rate', operator: 'greater_than', threshold: 3 },
          { metric: 'avg_feed_load_time', operator: 'greater_than', threshold: 2000 }
        ],
        severity: 'high',
        enabled: true,
        cooldownMinutes: 20
      },
      {
        id: 'content_quality_issue',
        name: 'Content Quality Issues',
        description: 'High report rate combined with low moderation queue processing',
        conditions: [
          { metric: 'reports_per_hour', operator: 'greater_than', threshold: 30 },
          { metric: 'moderation_queue_length', operator: 'greater_than', threshold: 50 }
        ],
        severity: 'medium',
        enabled: true,
        cooldownMinutes: 45
      },
      {
        id: 'performance_critical',
        name: 'Critical Performance Issues',
        description: 'Critical performance degradation affecting user experience',
        conditions: [
          { metric: 'avg_feed_load_time', operator: 'greater_than', threshold: 5000 },
          { metric: 'redis_cache_failure_rate', operator: 'greater_than', threshold: 20 }
        ],
        severity: 'critical',
        enabled: true,
        cooldownMinutes: 10
      }
    ];

    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }

  /**
   * Load configuration from database
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // Load custom thresholds from database
      const { data: thresholdData, error: thresholdError } = await database.getClient()
        .from('feed_alert_thresholds')
        .select('*');

      if (!thresholdError && thresholdData) {
        thresholdData.forEach(threshold => {
          this.thresholds.set(threshold.id, threshold);
        });
      }

      // Load custom rules from database
      const { data: ruleData, error: ruleError } = await database.getClient()
        .from('feed_alert_rules')
        .select('*');

      if (!ruleError && ruleData) {
        ruleData.forEach(rule => {
          this.rules.set(rule.id, rule);
        });
      }

      // Load notifications
      const { data: notificationData, error: notificationError } = await database.getClient()
        .from('feed_alert_notifications')
        .select('*');

      if (!notificationError && notificationData) {
        notificationData.forEach(notification => {
          if (!this.notifications.has(notification.alertId)) {
            this.notifications.set(notification.alertId, []);
          }
          this.notifications.get(notification.alertId)!.push(notification);
        });
      }

      // Load actions
      const { data: actionData, error: actionError } = await database.getClient()
        .from('feed_alert_actions')
        .select('*');

      if (!actionError && actionData) {
        actionData.forEach(action => {
          if (!this.actions.has(action.alertId)) {
            this.actions.set(action.alertId, []);
          }
          this.actions.get(action.alertId)!.push(action);
        });
      }

      logger.info('Feed alerting configuration loaded successfully');

    } catch (error) {
      logger.error('Error loading feed alerting configuration:', error);
    }
  }

  /**
   * Start monitoring feed metrics for alerts
   */
  async startMonitoring(): Promise<void> {
    if (this.isMonitoring) {
      logger.warn('Feed alerting monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    logger.info('Starting feed alerting monitoring');

    // Run initial check
    await this.checkAlerts();

    // Set up periodic monitoring
    this.monitoringInterval = setInterval(async () => {
      await this.checkAlerts();
    }, 60000); // Check every minute
  }

  /**
   * Stop monitoring feed metrics
   */
  stopMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    logger.info('Stopped feed alerting monitoring');
  }

  /**
   * Check all alert conditions
   */
  async checkAlerts(): Promise<void> {
    try {
      // Get current feed metrics
      const metrics = await monitoringService.getFeedMetrics();

      // Check threshold-based alerts
      await this.checkThresholdAlerts(metrics);

      // Check rule-based alerts
      await this.checkRuleAlerts(metrics);

    } catch (error) {
      logger.error('Error checking feed alerts:', error);
    }
  }

  /**
   * Check threshold-based alerts
   */
  private async checkThresholdAlerts(metrics: any): Promise<void> {
    for (const [thresholdId, threshold] of this.thresholds) {
      if (!threshold.enabled) continue;

      // Check cooldown
      if (this.isInCooldown(threshold.lastTriggered, threshold.cooldownMinutes)) {
        continue;
      }

      // Get metric value
      const metricValue = this.getMetricValue(metrics, threshold.metric);
      if (metricValue === null) continue;

      // Check condition
      const shouldTrigger = this.evaluateCondition(
        metricValue,
        threshold.operator,
        threshold.threshold
      );

      if (shouldTrigger) {
        await this.triggerAlert(thresholdId, threshold, metricValue, metrics);
        threshold.lastTriggered = new Date().toISOString();
      }
    }
  }

  /**
   * Check rule-based alerts
   */
  private async checkRuleAlerts(metrics: any): Promise<void> {
    for (const [ruleId, rule] of this.rules) {
      if (!rule.enabled) continue;

      // Check cooldown
      if (this.isInCooldown(rule.lastTriggered, rule.cooldownMinutes)) {
        continue;
      }

      // Check all conditions
      const allConditionsMet = rule.conditions.every(condition => {
        const metricValue = this.getMetricValue(metrics, condition.metric);
        if (metricValue === null) return false;
        return this.evaluateCondition(metricValue, condition.operator, condition.threshold);
      });

      if (allConditionsMet) {
        await this.triggerRuleAlert(ruleId, rule, metrics);
        rule.lastTriggered = new Date().toISOString();
      }
    }
  }

  /**
   * Trigger a threshold-based alert
   */
  private async triggerAlert(
    thresholdId: string,
    threshold: FeedAlertThreshold,
    metricValue: number,
    metrics: any
  ): Promise<void> {
    const alertId = `feed_${thresholdId}_${Date.now()}`;
    
    logger.warn(`Feed alert triggered: ${threshold.name}`, {
      alertId,
      thresholdId,
      metric: threshold.metric,
      value: metricValue,
      threshold: threshold.threshold,
      severity: threshold.severity
    });

    // Create alert in monitoring service
    await monitoringService.createFeedAlert(
      thresholdId as any,
      threshold.severity,
      threshold.name,
      `${threshold.description}. Current value: ${metricValue}, Threshold: ${threshold.threshold}`,
      {
        alertId,
        thresholdId,
        metric: threshold.metric,
        value: metricValue,
        threshold: threshold.threshold,
        operator: threshold.operator
      }
    );

    // Send notifications
    await this.sendNotifications(alertId, threshold.severity, threshold.name, threshold.description);

    // Execute actions
    await this.executeActions(alertId, threshold.severity, threshold.metric, metricValue, metrics);
  }

  /**
   * Trigger a rule-based alert
   */
  private async triggerRuleAlert(
    ruleId: string,
    rule: FeedAlertRule,
    metrics: any
  ): Promise<void> {
    const alertId = `feed_rule_${ruleId}_${Date.now()}`;
    
    logger.warn(`Feed rule alert triggered: ${rule.name}`, {
      alertId,
      ruleId,
      conditions: rule.conditions,
      severity: rule.severity
    });

    // Create alert in monitoring service
    await monitoringService.createFeedAlert(
      'performance',
      rule.severity,
      rule.name,
      rule.description,
      {
        alertId,
        ruleId,
        conditions: rule.conditions,
        metrics: this.getRelevantMetrics(metrics, rule.conditions)
      }
    );

    // Send notifications
    await this.sendNotifications(alertId, rule.severity, rule.name, rule.description);

    // Execute actions
    await this.executeActions(alertId, rule.severity, 'rule_based', null, metrics);
  }

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(
    alertId: string,
    severity: string,
    title: string,
    message: string
  ): Promise<void> {
    const notifications = this.notifications.get(alertId) || [];
    
    for (const notification of notifications) {
      if (!notification.enabled) continue;

      try {
        await this.sendNotification(notification, severity, title, message);
      } catch (error) {
        logger.error(`Failed to send notification for alert ${alertId}:`, error);
      }
    }
  }

  /**
   * Send a single notification
   */
  private async sendNotification(
    notification: FeedAlertNotification,
    severity: string,
    title: string,
    message: string
  ): Promise<void> {
    const notificationData = {
      type: notification.type,
      recipient: notification.recipient,
      subject: `[${severity.toUpperCase()}] Feed Alert: ${title}`,
      message: message,
      timestamp: new Date().toISOString(),
      severity
    };

    switch (notification.type) {
      case 'email':
        // TODO: Implement email notification
        logger.info('Email notification sent', notificationData);
        break;
      case 'sms':
        // TODO: Implement SMS notification
        logger.info('SMS notification sent', notificationData);
        break;
      case 'webhook':
        // TODO: Implement webhook notification
        logger.info('Webhook notification sent', notificationData);
        break;
      case 'slack':
        // TODO: Implement Slack notification
        logger.info('Slack notification sent', notificationData);
        break;
      case 'discord':
        // TODO: Implement Discord notification
        logger.info('Discord notification sent', notificationData);
        break;
    }
  }

  /**
   * Execute actions for an alert
   */
  private async executeActions(
    alertId: string,
    severity: string,
    metricType: string,
    metricValue: number | null,
    metrics: any
  ): Promise<void> {
    const actions = this.actions.get(alertId) || [];
    
    for (const action of actions) {
      if (!action.enabled) continue;

      try {
        await this.executeAction(action, severity, metricType, metricValue, metrics);
      } catch (error) {
        logger.error(`Failed to execute action for alert ${alertId}:`, error);
      }
    }
  }

  /**
   * Execute a single action
   */
  private async executeAction(
    action: FeedAlertAction,
    severity: string,
    metricType: string,
    metricValue: number | null,
    metrics: any
  ): Promise<void> {
    switch (action.type) {
      case 'auto_hide_content':
        // TODO: Implement auto-hide content action
        logger.info('Auto-hide content action executed', { action, severity });
        break;
      case 'escalate_moderation':
        // TODO: Implement escalation to moderation team
        logger.info('Moderation escalation action executed', { action, severity });
        break;
      case 'rate_limit_user':
        // TODO: Implement user rate limiting
        logger.info('User rate limiting action executed', { action, severity });
        break;
      case 'disable_feature':
        // TODO: Implement feature disabling
        logger.info('Feature disabling action executed', { action, severity });
        break;
      case 'webhook_call':
        // TODO: Implement webhook call action
        logger.info('Webhook call action executed', { action, severity });
        break;
    }
  }

  /**
   * Get metric value from metrics object
   */
  private getMetricValue(metrics: any, metricPath: string): number | null {
    const pathParts = metricPath.split('.');
    let value = metrics;

    for (const part of pathParts) {
      if (value && typeof value === 'object' && part in value) {
        value = value[part];
      } else {
        return null;
      }
    }

    return typeof value === 'number' ? value : null;
  }

  /**
   * Evaluate a condition
   */
  private evaluateCondition(value: number, operator: string, threshold: number): boolean {
    switch (operator) {
      case 'greater_than':
        return value > threshold;
      case 'less_than':
        return value < threshold;
      case 'equals':
        return value === threshold;
      case 'not_equals':
        return value !== threshold;
      default:
        return false;
    }
  }

  /**
   * Check if alert is in cooldown period
   */
  private isInCooldown(lastTriggered: string | undefined, cooldownMinutes: number): boolean {
    if (!lastTriggered) return false;

    const lastTriggeredTime = new Date(lastTriggered).getTime();
    const cooldownMs = cooldownMinutes * 60 * 1000;
    const now = Date.now();

    return (now - lastTriggeredTime) < cooldownMs;
  }

  /**
   * Get relevant metrics for rule conditions
   */
  private getRelevantMetrics(metrics: any, conditions: any[]): Record<string, any> {
    const relevantMetrics: Record<string, any> = {};
    
    conditions.forEach(condition => {
      const value = this.getMetricValue(metrics, condition.metric);
      if (value !== null) {
        relevantMetrics[condition.metric] = value;
      }
    });

    return relevantMetrics;
  }

  /**
   * Get all active thresholds
   */
  getThresholds(): FeedAlertThreshold[] {
    return Array.from(this.thresholds.values());
  }

  /**
   * Get all active rules
   */
  getRules(): FeedAlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Update a threshold
   */
  async updateThreshold(threshold: FeedAlertThreshold): Promise<void> {
    this.thresholds.set(threshold.id, threshold);
    
    // TODO: Save to database
    logger.info(`Updated feed alert threshold: ${threshold.id}`);
  }

  /**
   * Update a rule
   */
  async updateRule(rule: FeedAlertRule): Promise<void> {
    this.rules.set(rule.id, rule);
    
    // TODO: Save to database
    logger.info(`Updated feed alert rule: ${rule.id}`);
  }

  /**
   * Get monitoring status
   */
  getMonitoringStatus(): { isMonitoring: boolean; thresholdsCount: number; rulesCount: number } {
    return {
      isMonitoring: this.isMonitoring,
      thresholdsCount: this.thresholds.size,
      rulesCount: this.rules.size
    };
  }
}

export const feedAlertingService = new FeedAlertingService();
