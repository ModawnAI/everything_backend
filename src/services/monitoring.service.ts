/**
 * Monitoring Service
 * 
 * Comprehensive monitoring and alerting for the time slot system,
 * including performance metrics, error tracking, and conflict monitoring
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface PerformanceMetrics {
  operation: string;
  duration: number;
  success: boolean;
  timestamp: string;
  metadata: Record<string, any>;
}

export interface ErrorMetrics {
  errorType: string;
  errorMessage: string;
  operation: string;
  frequency: number;
  lastOccurred: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, any>;
}

export interface ConflictMetrics {
  conflictType: string;
  count: number;
  resolutionRate: number;
  averageResolutionTime: number;
  shopId?: string;
  timeRange: {
    start: string;
    end: string;
  };
}

export interface SystemHealthMetrics {
  totalRequests: number;
  successRate: number;
  averageResponseTime: number;
  errorRate: number;
  conflictRate: number;
  timeSlot: {
    total: number;
    available: number;
    utilizationRate: number;
  };
  capacity: {
    totalCapacity: number;
    usedCapacity: number;
    utilizationRate: number;
  };
}

export interface Alert {
  id: string;
  type: 'performance' | 'error' | 'conflict' | 'capacity' | 'system';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  shopId?: string;
  triggeredAt: string;
  resolvedAt?: string;
  metadata: Record<string, any>;
}

export interface MonitoringConfig {
  performanceThresholds: {
    maxResponseTime: number; // milliseconds
    minSuccessRate: number; // percentage
    maxErrorRate: number; // percentage
  };
  conflictThresholds: {
    maxConflictRate: number; // percentage
    maxUnresolvedConflicts: number;
  };
  capacityThresholds: {
    maxUtilizationRate: number; // percentage
    minAvailableSlots: number;
  };
  alerting: {
    enabled: boolean;
    emailRecipients: string[];
    webhookUrls: string[];
  };
}

export class MonitoringService {
  private supabase = getSupabaseClient();
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private errors: Map<string, ErrorMetrics> = new Map();
  private alerts: Map<string, Alert> = new Map();
  private config: MonitoringConfig;

  constructor() {
    this.config = this.getDefaultConfig();
  }

  /**
   * Track performance metrics for operations
   */
  trackPerformance(
    operation: string,
    duration: number,
    success: boolean,
    metadata: Record<string, any> = {}
  ): void {
    try {
      const metric: PerformanceMetrics = {
        operation,
        duration,
        success,
        timestamp: new Date().toISOString(),
        metadata
      };

      // Store in memory
      if (!this.metrics.has(operation)) {
        this.metrics.set(operation, []);
      }
      this.metrics.get(operation)!.push(metric);

      // Keep only last 1000 metrics per operation
      const operationMetrics = this.metrics.get(operation)!;
      if (operationMetrics.length > 1000) {
        operationMetrics.splice(0, operationMetrics.length - 1000);
      }

      // Check performance thresholds
      this.checkPerformanceThresholds(operation, metric);

      logger.debug('Performance metric tracked:', metric);

    } catch (error) {
      logger.error('Error tracking performance metric:', { operation, duration, success, error });
    }
  }

  /**
   * Track error metrics
   */
  trackError(
    errorType: string,
    errorMessage: string,
    operation: string,
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata: Record<string, any> = {}
  ): void {
    try {
      const errorKey = `${errorType}_${operation}`;
      const existingError = this.errors.get(errorKey);

      const errorMetric: ErrorMetrics = {
        errorType,
        errorMessage,
        operation,
        frequency: existingError ? existingError.frequency + 1 : 1,
        lastOccurred: new Date().toISOString(),
        severity,
        metadata
      };

      this.errors.set(errorKey, errorMetric);

      // Create alert for high severity errors
      if (severity === 'high' || severity === 'critical') {
        this.createAlert({
          type: 'error',
          severity,
          title: `${errorType} Error in ${operation}`,
          description: errorMessage,
          metadata: { ...metadata, frequency: errorMetric.frequency }
        });
      }

      logger.error('Error metric tracked:', errorMetric);

    } catch (error) {
      logger.error('Error tracking error metric:', { errorType, errorMessage, operation, error });
    }
  }

  /**
   * Track conflict metrics
   */
  async trackConflict(
    conflictType: string,
    shopId: string,
    resolved: boolean,
    resolutionTime?: number,
    metadata: Record<string, any> = {}
  ): Promise<void> {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      // Store conflict metrics in database
      const { error } = await this.supabase
        .from('conflict_metrics')
        .insert({
          conflict_type: conflictType,
          shop_id: shopId,
          resolved,
          resolution_time: resolutionTime,
          metadata,
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error storing conflict metrics:', error);
      return;
    }

      // Check conflict thresholds
      await this.checkConflictThresholds(shopId, conflictType);

      logger.debug('Conflict metric tracked:', {
        conflictType,
        shopId,
        resolved,
        resolutionTime
      });

    } catch (error) {
      logger.error('Error tracking conflict metric:', { conflictType, shopId, resolved, error });
    }
  }

  /**
   * Get system health metrics
   */
  async getSystemHealthMetrics(
    shopId?: string,
    timeRange?: { start: string; end: string }
  ): Promise<SystemHealthMetrics> {
    try {
      const endTime = timeRange?.end || new Date().toISOString();
      const startTime = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(startTime, endTime);
      
      // Get time slot metrics
      const timeSlotMetrics = await this.getTimeSlotMetrics(shopId, startTime, endTime);
      
      // Get capacity metrics
      const capacityMetrics = await this.getCapacityMetrics(shopId, startTime, endTime);
      
      // Get conflict metrics
      const conflictMetrics = await this.getConflictMetrics(shopId, startTime, endTime);

      const healthMetrics: SystemHealthMetrics = {
        totalRequests: performanceMetrics.totalRequests,
        successRate: performanceMetrics.successRate,
        averageResponseTime: performanceMetrics.averageResponseTime,
        errorRate: performanceMetrics.errorRate,
        conflictRate: conflictMetrics.conflictRate,
        timeSlot: timeSlotMetrics,
        capacity: capacityMetrics
      };

      return healthMetrics;

    } catch (error) {
      logger.error('Error getting system health metrics:', { shopId, timeRange, error });
      throw error;
    }
  }

  /**
   * Create an alert
   */
  createAlert(alertData: Omit<Alert, 'id' | 'triggeredAt'>): void {
    try {
      const alert: Alert = {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        triggeredAt: new Date().toISOString(),
        ...alertData
      };

      this.alerts.set(alert.id, alert);

      // Log alert
      logger.warn('Alert created:', alert);

      // Send notifications if configured
      if (this.config.alerting.enabled) {
        this.sendAlertNotification(alert);
      }

    } catch (error) {
      logger.error('Error creating alert:', { alertData, error });
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(shopId?: string): Alert[] {
    const activeAlerts = Array.from(this.alerts.values())
      .filter(alert => !alert.resolvedAt)
      .filter(alert => !shopId || alert.shopId === shopId)
      .sort((a, b) => new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime());

    return activeAlerts;
  }

  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string, resolvedBy: string): void {
    try {
      const alert = this.alerts.get(alertId);
      if (alert) {
        alert.resolvedAt = new Date().toISOString();
        this.alerts.set(alertId, alert);
        
        logger.info('Alert resolved:', { alertId, resolvedBy });
      }
    } catch (error) {
      logger.error('Error resolving alert:', { alertId, resolvedBy, error });
    }
  }

  /**
   * Update monitoring configuration
   */
  updateConfig(newConfig: Partial<MonitoringConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('Monitoring configuration updated:', newConfig);
  }

  /**
   * Get monitoring configuration
   */
  getConfig(): MonitoringConfig {
    return { ...this.config };
  }

  // Private helper methods

  private getDefaultConfig(): MonitoringConfig {
    return {
      performanceThresholds: {
        maxResponseTime: 5000, // 5 seconds
        minSuccessRate: 95, // 95%
        maxErrorRate: 5 // 5%
      },
      conflictThresholds: {
        maxConflictRate: 10, // 10%
        maxUnresolvedConflicts: 5
      },
      capacityThresholds: {
        maxUtilizationRate: 90, // 90%
        minAvailableSlots: 3
      },
      alerting: {
        enabled: true,
        emailRecipients: [],
        webhookUrls: []
      }
    };
  }

  private checkPerformanceThresholds(operation: string, metric: PerformanceMetrics): void {
    const { maxResponseTime, minSuccessRate } = this.config.performanceThresholds;

    // Check response time threshold
    if (metric.duration > maxResponseTime) {
      this.createAlert({
        type: 'performance',
        severity: metric.duration > maxResponseTime * 2 ? 'high' : 'medium',
        title: `Slow Response Time: ${operation}`,
        description: `Operation ${operation} took ${metric.duration}ms (threshold: ${maxResponseTime}ms)`,
        metadata: { operation, duration: metric.duration, threshold: maxResponseTime }
      });
    }

    // Check success rate threshold
    const operationMetrics = this.metrics.get(operation) || [];
    const recentMetrics = operationMetrics.slice(-100); // Last 100 requests
    if (recentMetrics.length >= 10) {
      const successRate = (recentMetrics.filter(m => m.success).length / recentMetrics.length) * 100;
      
      if (successRate < minSuccessRate) {
        this.createAlert({
          type: 'performance',
          severity: successRate < minSuccessRate / 2 ? 'critical' : 'high',
          title: `Low Success Rate: ${operation}`,
          description: `Operation ${operation} success rate is ${successRate.toFixed(1)}% (threshold: ${minSuccessRate}%)`,
          metadata: { operation, successRate, threshold: minSuccessRate }
        });
      }
    }
  }

  private async checkConflictThresholds(shopId: string, conflictType: string): Promise<void> {
    try {
      const { maxConflictRate, maxUnresolvedConflicts } = this.config.conflictThresholds;
      
      // Get recent conflicts
      const { data: recentConflicts, error } = await this.supabase
        .from('conflicts')
        .select('*')
        .eq('shop_id', shopId)
        .gte('detected_at', new Date(Date.now() - 60 * 60 * 1000).toISOString()) // Last hour
        .order('detected_at', { ascending: false });

      if (error) {
        logger.error('Error checking conflict thresholds:', error);
        return;
      }

      const conflicts = recentConflicts || [];
      const unresolvedConflicts = conflicts.filter(c => !c.resolved_at);
      const conflictRate = conflicts.length > 0 ? (unresolvedConflicts.length / conflicts.length) * 100 : 0;

      // Check unresolved conflicts threshold
      if (unresolvedConflicts.length > maxUnresolvedConflicts) {
        this.createAlert({
          type: 'conflict',
          severity: 'high',
          title: `High Unresolved Conflicts: ${shopId}`,
          description: `Shop has ${unresolvedConflicts.length} unresolved conflicts (threshold: ${maxUnresolvedConflicts})`,
          shopId,
          metadata: { 
            unresolvedCount: unresolvedConflicts.length, 
            threshold: maxUnresolvedConflicts,
            conflictType 
          }
        });
      }

      // Check conflict rate threshold
      if (conflictRate > maxConflictRate) {
        this.createAlert({
          type: 'conflict',
          severity: conflictRate > maxConflictRate * 2 ? 'critical' : 'high',
          title: `High Conflict Rate: ${shopId}`,
          description: `Shop has ${conflictRate.toFixed(1)}% conflict rate (threshold: ${maxConflictRate}%)`,
          shopId,
          metadata: { 
            conflictRate, 
            threshold: maxConflictRate,
            totalConflicts: conflicts.length,
            conflictType 
          }
        });
      }

    } catch (error) {
      logger.error('Error checking conflict thresholds:', { shopId, conflictType, error });
    }
  }

  private calculatePerformanceMetrics(startTime: string, endTime: string) {
    let totalRequests = 0;
    let successfulRequests = 0;
    let totalResponseTime = 0;

    for (const [operation, metrics] of this.metrics.entries()) {
      const recentMetrics = metrics.filter(m => 
        m.timestamp >= startTime && m.timestamp <= endTime
      );

      totalRequests += recentMetrics.length;
      successfulRequests += recentMetrics.filter(m => m.success).length;
      totalResponseTime += recentMetrics.reduce((sum, m) => sum + m.duration, 0);
    }

    const successRate = totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100;
    const averageResponseTime = totalRequests > 0 ? totalResponseTime / totalRequests : 0;
    const errorRate = 100 - successRate;

    return {
      totalRequests,
      successRate,
      averageResponseTime,
      errorRate
    };
  }

  private async getTimeSlotMetrics(
    shopId?: string,
    startTime?: string,
    endTime?: string
  ): Promise<{ total: number; available: number; utilizationRate: number }> {
    // This would query the time slot data from the database
    // For now, return mock data
    return {
      total: 100,
      available: 75,
      utilizationRate: 25
    };
  }

  private async getCapacityMetrics(
    shopId?: string,
    startTime?: string,
    endTime?: string
  ): Promise<{ totalCapacity: number; usedCapacity: number; utilizationRate: number }> {
    // This would query the capacity data from the database
    // For now, return mock data
    return {
      totalCapacity: 10,
      usedCapacity: 6,
      utilizationRate: 60
    };
  }

  private async getConflictMetrics(
    shopId?: string,
    startTime?: string,
    endTime?: string
  ): Promise<{ conflictRate: number }> {
    try {
      let query = this.supabase
        .from('conflicts')
        .select('*')
        .gte('detected_at', startTime || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .lte('detected_at', endTime || new Date().toISOString());

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data: conflicts, error } = await query;

      if (error) {
        logger.error('Error getting conflict metrics:', error);
        return { conflictRate: 0 };
      }

      const totalConflicts = conflicts?.length || 0;
      const resolvedConflicts = conflicts?.filter(c => c.resolved_at).length || 0;
      const conflictRate = totalConflicts > 0 ? ((totalConflicts - resolvedConflicts) / totalConflicts) * 100 : 0;

      return { conflictRate };

    } catch (error) {
      logger.error('Error calculating conflict metrics:', { shopId, startTime, endTime, error });
      return { conflictRate: 0 };
    }
  }

  private sendAlertNotification(alert: Alert): void {
    // This would integrate with notification services (email, Slack, etc.)
    logger.warn('Alert notification sent:', {
      alertId: alert.id,
      type: alert.type,
      severity: alert.severity,
      title: alert.title
    });
  }
}

export const monitoringService = new MonitoringService(); 