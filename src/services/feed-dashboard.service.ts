/**
 * Feed Dashboard Service
 * 
 * Provides comprehensive dashboard data aggregation for feed monitoring
 */

import { logger } from '../utils/logger';
import { monitoringService } from './monitoring.service';
import { feedAlertingService } from './feed-alerting.service';
import { healthCheckService } from './health-check.service';
import database from '../config/database';

export interface FeedDashboardOverview {
  timestamp: string;
  systemStatus: 'healthy' | 'degraded' | 'unhealthy';
  activeAlerts: number;
  totalMetrics: {
    posts: number;
    comments: number;
    users: number;
    engagement: number;
  };
  performance: {
    avgResponseTime: number;
    errorRate: number;
    uptime: number;
  };
  healthChecks: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  };
}

export interface FeedDashboardMetrics {
  timestamp: string;
  timeRange: {
    start: string;
    end: string;
  };
  posts: {
    total: number;
    published: number;
    pending: number;
    hidden: number;
    reported: number;
    creationRate: number;
    engagementRate: number;
    trendingPosts: number;
  };
  comments: {
    total: number;
    approved: number;
    pending: number;
    hidden: number;
    reported: number;
    creationRate: number;
  };
  moderation: {
    queueLength: number;
    avgProcessingTime: number;
    approvalRate: number;
    rejectionRate: number;
    autoApprovalRate: number;
    manualReviewRate: number;
  };
  performance: {
    avgFeedLoadTime: number;
    avgPostCreationTime: number;
    avgCommentCreationTime: number;
    cacheHitRate: number;
    redisLatency: number;
  };
  engagement: {
    totalLikes: number;
    totalComments: number;
    totalShares: number;
    activeUsers: number;
    trendingPosts: number;
  };
  systemHealth: {
    apiEndpoints: 'healthy' | 'degraded' | 'unhealthy';
    redisCache: 'healthy' | 'degraded' | 'unhealthy';
    imageProcessing: 'healthy' | 'degraded' | 'unhealthy';
    contentModeration: 'healthy' | 'degraded' | 'unhealthy';
    feedRanking: 'healthy' | 'degraded' | 'unhealthy';
    databaseQueries: 'healthy' | 'degraded' | 'unhealthy';
  };
}

export interface FeedDashboardAlerts {
  timestamp: string;
  active: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    triggeredAt: string;
    metadata: Record<string, any>;
  }>;
  recent: Array<{
    id: string;
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    title: string;
    message: string;
    triggeredAt: string;
    resolvedAt?: string;
    metadata: Record<string, any>;
  }>;
  summary: {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  };
}

export interface FeedDashboardTrends {
  timestamp: string;
  timeRange: {
    start: string;
    end: string;
  };
  posts: {
    hourly: Array<{
      hour: string;
      count: number;
      engagement: number;
    }>;
    daily: Array<{
      date: string;
      count: number;
      engagement: number;
    }>;
  };
  engagement: {
    hourly: Array<{
      hour: string;
      likes: number;
      comments: number;
      shares: number;
    }>;
    daily: Array<{
      date: string;
      likes: number;
      comments: number;
      shares: number;
    }>;
  };
  performance: {
    hourly: Array<{
      hour: string;
      avgLoadTime: number;
      errorRate: number;
      cacheHitRate: number;
    }>;
    daily: Array<{
      date: string;
      avgLoadTime: number;
      errorRate: number;
      cacheHitRate: number;
    }>;
  };
}

export interface FeedDashboardConfig {
  refreshInterval: number; // seconds
  timeRange: {
    default: number; // hours
    max: number; // hours
  };
  alerts: {
    enabled: boolean;
    thresholds: Record<string, number>;
  };
  features: {
    realTimeUpdates: boolean;
    historicalData: boolean;
    alerting: boolean;
    healthChecks: boolean;
  };
}

export class FeedDashboardService {
  private config: FeedDashboardConfig;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout: number = 30000; // 30 seconds

  constructor() {
    this.config = {
      refreshInterval: 30,
      timeRange: {
        default: 24,
        max: 168 // 7 days
      },
      alerts: {
        enabled: true,
        thresholds: {
          errorRate: 5,
          responseTime: 3000,
          queueLength: 100
        }
      },
      features: {
        realTimeUpdates: true,
        historicalData: true,
        alerting: true,
        healthChecks: true
      }
    };
  }

  /**
   * Get dashboard overview data
   */
  async getDashboardOverview(): Promise<FeedDashboardOverview> {
    const cacheKey = 'dashboard_overview';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const [
        metrics,
        alerts,
        healthStatus,
        alertingStatus
      ] = await Promise.all([
        monitoringService.getFeedMetrics(),
        monitoringService.getActiveAlerts(),
        healthCheckService.getDetailedHealth(),
        feedAlertingService.getMonitoringStatus()
      ]);

      // Calculate system status
      const systemStatus = this.calculateSystemStatus(healthStatus, metrics);

      // Get active feed alerts
      const activeFeedAlerts = alerts.filter(alert => alert.type === 'feed');

      // Calculate health check summary
      const healthChecks = this.calculateHealthCheckSummary(healthStatus);

      const overview: FeedDashboardOverview = {
        timestamp: new Date().toISOString(),
        systemStatus,
        activeAlerts: activeFeedAlerts.length,
        totalMetrics: {
          posts: metrics.posts.total,
          comments: metrics.comments.total,
          users: metrics.engagement.activeUsers,
          engagement: metrics.engagement.totalLikes + metrics.engagement.totalComments
        },
        performance: {
          avgResponseTime: metrics.performance.avgFeedLoadTime,
          errorRate: this.calculateErrorRate(metrics),
          uptime: process.uptime()
        },
        healthChecks
      };

      this.setCachedData(cacheKey, overview);
      return overview;

    } catch (error) {
      logger.error('Error getting dashboard overview:', error);
      throw error;
    }
  }

  /**
   * Get detailed dashboard metrics
   */
  async getDashboardMetrics(timeRange?: { start: string; end: string }): Promise<FeedDashboardMetrics> {
    const cacheKey = `dashboard_metrics_${JSON.stringify(timeRange)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const [
        metrics,
        healthStatus
      ] = await Promise.all([
        monitoringService.getFeedMetrics(timeRange),
        healthCheckService.getDetailedHealth()
      ]);

      const dashboardMetrics: FeedDashboardMetrics = {
        timestamp: new Date().toISOString(),
        timeRange: timeRange || {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        posts: metrics.posts,
        comments: metrics.comments,
        moderation: metrics.moderation,
        performance: metrics.performance,
        engagement: metrics.engagement,
        systemHealth: {
          apiEndpoints: healthStatus.checks.feed?.apiEndpoints?.status || 'unhealthy',
          redisCache: healthStatus.checks.feed?.redisCache?.status || 'unhealthy',
          imageProcessing: healthStatus.checks.feed?.imageProcessing?.status || 'unhealthy',
          contentModeration: healthStatus.checks.feed?.contentModeration?.status || 'unhealthy',
          feedRanking: healthStatus.checks.feed?.feedRanking?.status || 'unhealthy',
          databaseQueries: healthStatus.checks.feed?.databaseQueries?.status || 'unhealthy'
        }
      };

      this.setCachedData(cacheKey, dashboardMetrics);
      return dashboardMetrics;

    } catch (error) {
      logger.error('Error getting dashboard metrics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard alerts data
   */
  async getDashboardAlerts(): Promise<FeedDashboardAlerts> {
    const cacheKey = 'dashboard_alerts';
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const [activeAlerts, recentAlerts] = await Promise.all([
        monitoringService.getActiveAlerts(),
        this.getRecentAlerts()
      ]);

      // Filter feed alerts
      const activeFeedAlerts = activeAlerts.filter(alert => alert.type === 'feed');
      const recentFeedAlerts = recentAlerts.filter(alert => alert.type === 'feed');

      // Calculate summary
      const summary = this.calculateAlertSummary([...activeFeedAlerts, ...recentFeedAlerts]);

      const dashboardAlerts: FeedDashboardAlerts = {
        timestamp: new Date().toISOString(),
        active: activeFeedAlerts.map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.description,
          triggeredAt: alert.triggeredAt,
          metadata: alert.metadata
        })),
        recent: recentFeedAlerts.map(alert => ({
          id: alert.id,
          type: alert.type,
          severity: alert.severity,
          title: alert.title,
          message: alert.description,
          triggeredAt: alert.triggeredAt,
          resolvedAt: alert.resolvedAt,
          metadata: alert.metadata
        })),
        summary
      };

      this.setCachedData(cacheKey, dashboardAlerts);
      return dashboardAlerts;

    } catch (error) {
      logger.error('Error getting dashboard alerts:', error);
      throw error;
    }
  }

  /**
   * Get dashboard trends data
   */
  async getDashboardTrends(timeRange?: { start: string; end: string }): Promise<FeedDashboardTrends> {
    const cacheKey = `dashboard_trends_${JSON.stringify(timeRange)}`;
    const cached = this.getCachedData(cacheKey);
    if (cached) return cached;

    try {
      const [
        postsTrends,
        engagementTrends,
        performanceTrends
      ] = await Promise.all([
        this.getPostsTrends(timeRange),
        this.getEngagementTrends(timeRange),
        this.getPerformanceTrends(timeRange)
      ]);

      const dashboardTrends: FeedDashboardTrends = {
        timestamp: new Date().toISOString(),
        timeRange: timeRange || {
          start: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          end: new Date().toISOString()
        },
        posts: postsTrends,
        engagement: engagementTrends,
        performance: performanceTrends
      };

      this.setCachedData(cacheKey, dashboardTrends);
      return dashboardTrends;

    } catch (error) {
      logger.error('Error getting dashboard trends:', error);
      throw error;
    }
  }

  /**
   * Get dashboard configuration
   */
  getDashboardConfig(): FeedDashboardConfig {
    return { ...this.config };
  }

  /**
   * Update dashboard configuration
   */
  async updateDashboardConfig(config: Partial<FeedDashboardConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    // Clear cache when config changes
    this.cache.clear();
    
    logger.info('Dashboard configuration updated', { config });
  }

  /**
   * Get real-time dashboard updates
   */
  async getRealTimeUpdates(): Promise<{
    overview: FeedDashboardOverview;
    metrics: FeedDashboardMetrics;
    alerts: FeedDashboardAlerts;
  }> {
    try {
      const [overview, metrics, alerts] = await Promise.all([
        this.getDashboardOverview(),
        this.getDashboardMetrics(),
        this.getDashboardAlerts()
      ]);

      return { overview, metrics, alerts };

    } catch (error) {
      logger.error('Error getting real-time updates:', error);
      throw error;
    }
  }

  /**
   * Calculate system status from health checks and metrics
   */
  private calculateSystemStatus(healthStatus: any, metrics: any): 'healthy' | 'degraded' | 'unhealthy' {
    const feedHealth = healthStatus.checks.feed;
    if (!feedHealth) return 'unhealthy';

    const healthCounts = {
      healthy: 0,
      degraded: 0,
      unhealthy: 0
    };

    // Count health check statuses
    Object.values(feedHealth).forEach((check: any) => {
      if (check.status === 'healthy') healthCounts.healthy++;
      else if (check.status === 'degraded') healthCounts.degraded++;
      else healthCounts.unhealthy++;
    });

    // Check error rate
    const errorRate = this.calculateErrorRate(metrics);
    if (errorRate > 10) healthCounts.unhealthy++;
    else if (errorRate > 5) healthCounts.degraded++;

    // Determine overall status
    if (healthCounts.unhealthy > 0) return 'unhealthy';
    if (healthCounts.degraded > 0) return 'degraded';
    return 'healthy';
  }

  /**
   * Calculate health check summary
   */
  private calculateHealthCheckSummary(healthStatus: any): {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
  } {
    const feedHealth = healthStatus.checks.feed;
    if (!feedHealth) return { total: 0, healthy: 0, degraded: 0, unhealthy: 0 };

    const checks = Object.values(feedHealth);
    const summary = {
      total: checks.length,
      healthy: 0,
      degraded: 0,
      unhealthy: 0
    };

    checks.forEach((check: any) => {
      if (check.status === 'healthy') summary.healthy++;
      else if (check.status === 'degraded') summary.degraded++;
      else summary.unhealthy++;
    });

    return summary;
  }

  /**
   * Calculate error rate from metrics
   */
  private calculateErrorRate(metrics: any): number {
    // This is a simplified calculation
    // In a real implementation, you'd calculate this from actual error data
    return metrics.performance?.errorRate || 0;
  }

  /**
   * Calculate alert summary
   */
  private calculateAlertSummary(alerts: any[]): {
    total: number;
    bySeverity: {
      critical: number;
      high: number;
      medium: number;
      low: number;
    };
    byType: Record<string, number>;
  } {
    const summary = {
      total: alerts.length,
      bySeverity: {
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      },
      byType: {} as Record<string, number>
    };

    alerts.forEach(alert => {
      summary.bySeverity[alert.severity]++;
      summary.byType[alert.type] = (summary.byType[alert.type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Get recent alerts from database
   */
  private async getRecentAlerts(): Promise<any[]> {
    try {
      // This would typically query the database for recent alerts
      // For now, return empty array
      return [];
    } catch (error) {
      logger.error('Error getting recent alerts:', error);
      return [];
    }
  }

  /**
   * Get posts trends data
   */
  private async getPostsTrends(timeRange?: { start: string; end: string }): Promise<{
    hourly: Array<{ hour: string; count: number; engagement: number }>;
    daily: Array<{ date: string; count: number; engagement: number }>;
  }> {
    // This would typically query the database for posts trends
    // For now, return mock data
    return {
      hourly: [],
      daily: []
    };
  }

  /**
   * Get engagement trends data
   */
  private async getEngagementTrends(timeRange?: { start: string; end: string }): Promise<{
    hourly: Array<{ hour: string; likes: number; comments: number; shares: number }>;
    daily: Array<{ date: string; likes: number; comments: number; shares: number }>;
  }> {
    // This would typically query the database for engagement trends
    // For now, return mock data
    return {
      hourly: [],
      daily: []
    };
  }

  /**
   * Get performance trends data
   */
  private async getPerformanceTrends(timeRange?: { start: string; end: string }): Promise<{
    hourly: Array<{ hour: string; avgLoadTime: number; errorRate: number; cacheHitRate: number }>;
    daily: Array<{ date: string; avgLoadTime: number; errorRate: number; cacheHitRate: number }>;
  }> {
    // This would typically query the database for performance trends
    // For now, return mock data
    return {
      hourly: [],
      daily: []
    };
  }

  /**
   * Get cached data
   */
  private getCachedData(key: string): any {
    const cached = this.cache.get(key);
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  /**
   * Set cached data
   */
  private setCachedData(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Dashboard cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    keys: string[];
    hitRate: number;
  } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
      hitRate: 0 // Would need to track hits/misses for real implementation
    };
  }
}

export const feedDashboardService = new FeedDashboardService();

