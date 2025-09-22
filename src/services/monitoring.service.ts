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

export interface ReservationMetrics {
  totalRequests: number;
  confirmedReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  noShowReservations: number;
  requestRate: number; // requests per hour
  confirmationRate: number; // percentage
  completionRate: number; // percentage
  cancellationRate: number; // percentage
  noShowRate: number; // percentage
  averageConfirmationTime: number; // minutes
  averageCompletionTime: number; // minutes
  revenueGenerated: number;
  timeRange: {
    start: string;
    end: string;
  };
}

export interface BusinessMetrics {
  dailyReservations: number;
  weeklyReservations: number;
  monthlyReservations: number;
  conversionRate: number; // request to confirmation
  completionRate: number; // confirmation to completion
  customerRetentionRate: number;
  averageReservationValue: number;
  totalRevenue: number;
  peakHours: string[];
  popularServices: Array<{
    serviceId: string;
    serviceName: string;
    bookingCount: number;
    revenue: number;
  }>;
}

export interface NotificationMetrics {
  totalSent: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  deliveryRate: number; // percentage
  averageDeliveryTime: number; // milliseconds
  notificationTypes: {
    reservation_confirmed: number;
    reservation_cancelled: number;
    payment_reminder: number;
    no_show_warning: number;
    no_show_final: number;
  };
  channels: {
    email: number;
    sms: number;
    push: number;
    in_app: number;
  };
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
  reservationThresholds: {
    minConfirmationRate: number; // percentage
    maxCancellationRate: number; // percentage
    maxNoShowRate: number; // percentage
    minCompletionRate: number; // percentage
  };
  businessThresholds: {
    minConversionRate: number; // percentage
    minCustomerRetentionRate: number; // percentage
    minAverageReservationValue: number; // KRW
  };
  notificationThresholds: {
    minDeliveryRate: number; // percentage
    maxAverageDeliveryTime: number; // milliseconds
    maxFailedDeliveries: number; // per hour
  };
  alerting: {
    enabled: boolean;
    emailRecipients: string[];
    webhookUrls: string[];
    businessMetricAlerts: boolean;
    notificationAlerts: boolean;
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

  /**
   * Get reservation metrics for a specific time range
   */
  async getReservationMetrics(
    shopId?: string,
    timeRange?: { start: string; end: string }
  ): Promise<ReservationMetrics> {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = timeRange?.end || new Date().toISOString();

      let query = this.supabase
        .from('reservations')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data: reservations, error } = await query;

      if (error) {
        logger.error('Error fetching reservation metrics:', error);
        throw error;
      }

      const reservationsList = reservations || [];
      const totalRequests = reservationsList.length;
      const confirmedReservations = reservationsList.filter(r => r.status === 'confirmed').length;
      const completedReservations = reservationsList.filter(r => r.status === 'completed').length;
      const cancelledReservations = reservationsList.filter(r => 
        r.status === 'cancelled_by_user' || r.status === 'cancelled_by_shop'
      ).length;
      const noShowReservations = reservationsList.filter(r => r.status === 'no_show').length;

      // Calculate rates
      const requestRate = totalRequests > 0 ? totalRequests / 24 : 0; // requests per hour
      const confirmationRate = totalRequests > 0 ? (confirmedReservations / totalRequests) * 100 : 0;
      const completionRate = confirmedReservations > 0 ? (completedReservations / confirmedReservations) * 100 : 0;
      const cancellationRate = totalRequests > 0 ? (cancelledReservations / totalRequests) * 100 : 0;
      const noShowRate = totalRequests > 0 ? (noShowReservations / totalRequests) * 100 : 0;

      // Calculate average times
      const confirmedWithTimes = reservationsList.filter(r => 
        r.status === 'confirmed' && r.confirmed_at
      );
      const averageConfirmationTime = confirmedWithTimes.length > 0 
        ? confirmedWithTimes.reduce((sum, r) => {
            const createdTime = new Date(r.created_at).getTime();
            const confirmedTime = new Date(r.confirmed_at).getTime();
            return sum + (confirmedTime - createdTime) / (1000 * 60); // minutes
          }, 0) / confirmedWithTimes.length
        : 0;

      const completedWithTimes = reservationsList.filter(r => 
        r.status === 'completed' && r.completed_at && r.confirmed_at
      );
      const averageCompletionTime = completedWithTimes.length > 0
        ? completedWithTimes.reduce((sum, r) => {
            const confirmedTime = new Date(r.confirmed_at).getTime();
            const completedTime = new Date(r.completed_at).getTime();
            return sum + (completedTime - confirmedTime) / (1000 * 60); // minutes
          }, 0) / completedWithTimes.length
        : 0;

      // Calculate revenue
      const revenueGenerated = reservationsList
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);

      const metrics: ReservationMetrics = {
        totalRequests,
        confirmedReservations,
        completedReservations,
        cancelledReservations,
        noShowReservations,
        requestRate,
        confirmationRate,
        completionRate,
        cancellationRate,
        noShowRate,
        averageConfirmationTime,
        averageCompletionTime,
        revenueGenerated,
        timeRange: { start: startDate, end: endDate }
      };

      // Check thresholds and create alerts if needed
      await this.checkReservationThresholds(metrics, shopId);

      return metrics;

    } catch (error) {
      logger.error('Error getting reservation metrics:', error);
      throw error;
    }
  }

  /**
   * Get business metrics for analytics dashboard
   */
  async getBusinessMetrics(
    timeRange?: { start: string; end: string }
  ): Promise<BusinessMetrics> {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const endDate = timeRange?.end || new Date().toISOString();

      // Get reservations for the period
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          reservation_services!inner(
            service_id,
            total_price,
            shop_services!inner(
              id,
              name
            )
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        logger.error('Error fetching business metrics:', error);
        throw error;
      }

      const reservationsList = reservations || [];
      
      // Calculate basic metrics
      const dailyReservations = reservationsList.filter(r => {
        const reservationDate = new Date(r.created_at);
        const today = new Date();
        return reservationDate.toDateString() === today.toDateString();
      }).length;

      const weeklyReservations = reservationsList.filter(r => {
        const reservationDate = new Date(r.created_at);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return reservationDate >= weekAgo;
      }).length;

      const monthlyReservations = reservationsList.length;

      // Calculate conversion and completion rates
      const totalRequests = reservationsList.length;
      const confirmedReservations = reservationsList.filter(r => r.status === 'confirmed').length;
      const completedReservations = reservationsList.filter(r => r.status === 'completed').length;
      
      const conversionRate = totalRequests > 0 ? (confirmedReservations / totalRequests) * 100 : 0;
      const completionRate = confirmedReservations > 0 ? (completedReservations / confirmedReservations) * 100 : 0;

      // Calculate customer retention (simplified - users with multiple reservations)
      const userReservations = reservationsList.reduce((acc, r) => {
        acc[r.user_id] = (acc[r.user_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const returningCustomers = Object.values(userReservations).filter((count: number) => count > 1).length;
      const totalCustomers = Object.keys(userReservations).length;
      const customerRetentionRate = totalCustomers > 0 ? (returningCustomers / totalCustomers) * 100 : 0;

      // Calculate revenue metrics
      const totalRevenue = reservationsList
        .filter(r => r.status === 'completed')
        .reduce((sum, r) => sum + (r.total_amount || 0), 0);

      const averageReservationValue = totalRequests > 0 ? totalRevenue / totalRequests : 0;

      // Find peak hours
      const hourCounts = reservationsList.reduce((acc, r) => {
        const hour = new Date(r.created_at).getHours();
        acc[hour] = (acc[hour] || 0) + 1;
        return acc;
      }, {} as Record<number, number>);

      const peakHours = Object.entries(hourCounts)
        .sort(([,a], [,b]) => (b as number) - (a as number))
        .slice(0, 3)
        .map(([hour]) => `${hour}:00`);

      // Calculate popular services
      const serviceStats = reservationsList.reduce((acc, r) => {
        r.reservation_services?.forEach((rs: any) => {
          const serviceId = rs.service_id;
          const serviceName = rs.shop_services?.name || 'Unknown Service';
          const revenue = rs.total_price || 0;

          if (!acc[serviceId]) {
            acc[serviceId] = {
              serviceId,
              serviceName,
              bookingCount: 0,
              revenue: 0
            };
          }

          acc[serviceId].bookingCount += 1;
          acc[serviceId].revenue += revenue;
        });
        return acc;
      }, {} as Record<string, {
        serviceId: string;
        serviceName: string;
        bookingCount: number;
        revenue: number;
      }>);

      const popularServices: Array<{
        serviceId: string;
        serviceName: string;
        bookingCount: number;
        revenue: number;
      }> = Object.values(serviceStats)
        .filter((service): service is {
          serviceId: string;
          serviceName: string;
          bookingCount: number;
          revenue: number;
        } => Boolean(service))
        .sort((a, b) => b.bookingCount - a.bookingCount)
        .slice(0, 5);

      const metrics: BusinessMetrics = {
        dailyReservations,
        weeklyReservations,
        monthlyReservations,
        conversionRate,
        completionRate,
        customerRetentionRate,
        averageReservationValue,
        totalRevenue,
        peakHours,
        popularServices
      };

      // Check business thresholds
      await this.checkBusinessThresholds(metrics);

      return metrics;

    } catch (error) {
      logger.error('Error getting business metrics:', error);
      throw error;
    }
  }

  /**
   * Get notification delivery metrics
   */
  async getNotificationMetrics(
    timeRange?: { start: string; end: string }
  ): Promise<NotificationMetrics> {
    try {
      const startDate = timeRange?.start || new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const endDate = timeRange?.end || new Date().toISOString();

      const { data: notifications, error } = await this.supabase
        .from('notifications')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) {
        logger.error('Error fetching notification metrics:', error);
        throw error;
      }

      const notificationsList = notifications || [];
      const totalSent = notificationsList.length;
      const successfulDeliveries = notificationsList.filter(n => n.status === 'sent').length;
      const failedDeliveries = notificationsList.filter(n => n.status === 'failed').length;
      const deliveryRate = totalSent > 0 ? (successfulDeliveries / totalSent) * 100 : 0;

      // Calculate average delivery time
      const deliveredNotifications = notificationsList.filter(n => 
        n.status === 'sent' && n.sent_at
      );
      const averageDeliveryTime = deliveredNotifications.length > 0
        ? deliveredNotifications.reduce((sum, n) => {
            const createdTime = new Date(n.created_at).getTime();
            const sentTime = new Date(n.sent_at).getTime();
            return sum + (sentTime - createdTime);
          }, 0) / deliveredNotifications.length
        : 0;

      // Count notification types
      const notificationTypes = {
        reservation_confirmed: notificationsList.filter(n => n.notification_type === 'reservation_confirmed').length,
        reservation_cancelled: notificationsList.filter(n => n.notification_type === 'reservation_cancelled').length,
        payment_reminder: notificationsList.filter(n => n.notification_type === 'payment_reminder').length,
        no_show_warning: notificationsList.filter(n => n.notification_type === 'no_show_warning').length,
        no_show_final: notificationsList.filter(n => n.notification_type === 'no_show_final').length
      };

      // Count delivery channels
      const channels = {
        email: notificationsList.filter(n => n.channel === 'email').length,
        sms: notificationsList.filter(n => n.channel === 'sms').length,
        push: notificationsList.filter(n => n.channel === 'push').length,
        in_app: notificationsList.filter(n => n.channel === 'in_app').length
      };

      const metrics: NotificationMetrics = {
        totalSent,
        successfulDeliveries,
        failedDeliveries,
        deliveryRate,
        averageDeliveryTime,
        notificationTypes,
        channels
      };

      // Check notification thresholds
      await this.checkNotificationThresholds(metrics);

      return metrics;

    } catch (error) {
      logger.error('Error getting notification metrics:', error);
      throw error;
    }
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
      reservationThresholds: {
        minConfirmationRate: 80, // 80%
        maxCancellationRate: 15, // 15%
        maxNoShowRate: 10, // 10%
        minCompletionRate: 85 // 85%
      },
      businessThresholds: {
        minConversionRate: 75, // 75%
        minCustomerRetentionRate: 60, // 60%
        minAverageReservationValue: 30000 // 30,000 KRW
      },
      notificationThresholds: {
        minDeliveryRate: 95, // 95%
        maxAverageDeliveryTime: 2000, // 2 seconds
        maxFailedDeliveries: 10 // per hour
      },
      alerting: {
        enabled: true,
        emailRecipients: [],
        webhookUrls: [],
        businessMetricAlerts: true,
        notificationAlerts: true
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

  /**
   * Check reservation metrics against thresholds
   */
  private async checkReservationThresholds(
    metrics: ReservationMetrics, 
    shopId?: string
  ): Promise<void> {
    try {
      const thresholds = this.config.reservationThresholds;

      // Check confirmation rate
      if (metrics.confirmationRate < thresholds.minConfirmationRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.confirmationRate < thresholds.minConfirmationRate / 2 ? 'critical' : 'high',
          title: `Low Confirmation Rate${shopId ? ` - Shop ${shopId}` : ''}`,
          description: `Confirmation rate is ${metrics.confirmationRate.toFixed(1)}% (threshold: ${thresholds.minConfirmationRate}%)`,
          shopId,
          metadata: { 
            confirmationRate: metrics.confirmationRate, 
            threshold: thresholds.minConfirmationRate,
            timeRange: metrics.timeRange
          }
        });
      }

      // Check cancellation rate
      if (metrics.cancellationRate > thresholds.maxCancellationRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.cancellationRate > thresholds.maxCancellationRate * 2 ? 'critical' : 'high',
          title: `High Cancellation Rate${shopId ? ` - Shop ${shopId}` : ''}`,
          description: `Cancellation rate is ${metrics.cancellationRate.toFixed(1)}% (threshold: ${thresholds.maxCancellationRate}%)`,
          shopId,
          metadata: { 
            cancellationRate: metrics.cancellationRate, 
            threshold: thresholds.maxCancellationRate,
            timeRange: metrics.timeRange
          }
        });
      }

      // Check no-show rate
      if (metrics.noShowRate > thresholds.maxNoShowRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.noShowRate > thresholds.maxNoShowRate * 2 ? 'critical' : 'high',
          title: `High No-Show Rate${shopId ? ` - Shop ${shopId}` : ''}`,
          description: `No-show rate is ${metrics.noShowRate.toFixed(1)}% (threshold: ${thresholds.maxNoShowRate}%)`,
          shopId,
          metadata: { 
            noShowRate: metrics.noShowRate, 
            threshold: thresholds.maxNoShowRate,
            timeRange: metrics.timeRange
          }
        });
      }

      // Check completion rate
      if (metrics.completionRate < thresholds.minCompletionRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.completionRate < thresholds.minCompletionRate / 2 ? 'critical' : 'high',
          title: `Low Completion Rate${shopId ? ` - Shop ${shopId}` : ''}`,
          description: `Completion rate is ${metrics.completionRate.toFixed(1)}% (threshold: ${thresholds.minCompletionRate}%)`,
          shopId,
          metadata: { 
            completionRate: metrics.completionRate, 
            threshold: thresholds.minCompletionRate,
            timeRange: metrics.timeRange
          }
        });
      }

    } catch (error) {
      logger.error('Error checking reservation thresholds:', error);
    }
  }

  /**
   * Check business metrics against thresholds
   */
  private async checkBusinessThresholds(metrics: BusinessMetrics): Promise<void> {
    try {
      const thresholds = this.config.businessThresholds;

      // Check conversion rate
      if (metrics.conversionRate < thresholds.minConversionRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.conversionRate < thresholds.minConversionRate / 2 ? 'critical' : 'high',
          title: 'Low Business Conversion Rate',
          description: `Conversion rate is ${metrics.conversionRate.toFixed(1)}% (threshold: ${thresholds.minConversionRate}%)`,
          metadata: { 
            conversionRate: metrics.conversionRate, 
            threshold: thresholds.minConversionRate,
            dailyReservations: metrics.dailyReservations
          }
        });
      }

      // Check customer retention rate
      if (metrics.customerRetentionRate < thresholds.minCustomerRetentionRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.customerRetentionRate < thresholds.minCustomerRetentionRate / 2 ? 'critical' : 'medium',
          title: 'Low Customer Retention Rate',
          description: `Customer retention rate is ${metrics.customerRetentionRate.toFixed(1)}% (threshold: ${thresholds.minCustomerRetentionRate}%)`,
          metadata: { 
            customerRetentionRate: metrics.customerRetentionRate, 
            threshold: thresholds.minCustomerRetentionRate,
            totalCustomers: Object.keys({}).length // This would need to be calculated
          }
        });
      }

      // Check average reservation value
      if (metrics.averageReservationValue < thresholds.minAverageReservationValue) {
        this.createAlert({
          type: 'system',
          severity: metrics.averageReservationValue < thresholds.minAverageReservationValue / 2 ? 'critical' : 'medium',
          title: 'Low Average Reservation Value',
          description: `Average reservation value is ${metrics.averageReservationValue.toFixed(0)} KRW (threshold: ${thresholds.minAverageReservationValue} KRW)`,
          metadata: { 
            averageReservationValue: metrics.averageReservationValue, 
            threshold: thresholds.minAverageReservationValue,
            totalRevenue: metrics.totalRevenue
          }
        });
      }

    } catch (error) {
      logger.error('Error checking business thresholds:', error);
    }
  }

  /**
   * Check notification metrics against thresholds
   */
  private async checkNotificationThresholds(metrics: NotificationMetrics): Promise<void> {
    try {
      const thresholds = this.config.notificationThresholds;

      // Check delivery rate
      if (metrics.deliveryRate < thresholds.minDeliveryRate) {
        this.createAlert({
          type: 'system',
          severity: metrics.deliveryRate < thresholds.minDeliveryRate / 2 ? 'critical' : 'high',
          title: 'Low Notification Delivery Rate',
          description: `Notification delivery rate is ${metrics.deliveryRate.toFixed(1)}% (threshold: ${thresholds.minDeliveryRate}%)`,
          metadata: { 
            deliveryRate: metrics.deliveryRate, 
            threshold: thresholds.minDeliveryRate,
            totalSent: metrics.totalSent,
            failedDeliveries: metrics.failedDeliveries
          }
        });
      }

      // Check average delivery time
      if (metrics.averageDeliveryTime > thresholds.maxAverageDeliveryTime) {
        this.createAlert({
          type: 'system',
          severity: metrics.averageDeliveryTime > thresholds.maxAverageDeliveryTime * 2 ? 'critical' : 'medium',
          title: 'Slow Notification Delivery',
          description: `Average notification delivery time is ${metrics.averageDeliveryTime.toFixed(0)}ms (threshold: ${thresholds.maxAverageDeliveryTime}ms)`,
          metadata: { 
            averageDeliveryTime: metrics.averageDeliveryTime, 
            threshold: thresholds.maxAverageDeliveryTime,
            successfulDeliveries: metrics.successfulDeliveries
          }
        });
      }

      // Check failed deliveries per hour
      const failedDeliveriesPerHour = metrics.failedDeliveries; // Assuming 24-hour period
      if (failedDeliveriesPerHour > thresholds.maxFailedDeliveries) {
        this.createAlert({
          type: 'system',
          severity: failedDeliveriesPerHour > thresholds.maxFailedDeliveries * 2 ? 'critical' : 'high',
          title: 'High Notification Failure Rate',
          description: `Failed deliveries: ${failedDeliveriesPerHour} (threshold: ${thresholds.maxFailedDeliveries} per hour)`,
          metadata: { 
            failedDeliveries: failedDeliveriesPerHour, 
            threshold: thresholds.maxFailedDeliveries,
            totalSent: metrics.totalSent
          }
        });
      }

    } catch (error) {
      logger.error('Error checking notification thresholds:', error);
    }
  }
}

export const monitoringService = new MonitoringService(); 