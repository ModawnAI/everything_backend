/**
 * Monitoring Controller
 * 
 * Provides endpoints for system monitoring, health checks, and alerting
 */

import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { timeSlotService } from '../services/time-slot.service';
import { conflictResolutionService } from '../services/conflict-resolution.service';
import { healthCheckService } from '../services/health-check.service';
import { feedAlertingService } from '../services/feed-alerting.service';
import { feedDashboardService } from '../services/feed-dashboard.service';
import { logger } from '../utils/logger';

export class MonitoringController {
  /**
   * Get system health metrics
   */
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const healthMetrics = await monitoringService.getSystemHealthMetrics(
        shopId,
        timeRange
      );

      res.status(200).json({
        success: true,
        data: healthMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting system health:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get system health metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.query;
      const { severity } = req.query;

      let alerts = monitoringService.getActiveAlerts(shopId as string);

      // Filter by severity if specified
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting active alerts:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get active alerts',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { resolvedBy } = req.body;

      if (!resolvedBy) {
        res.status(400).json({
          success: false,
          error: 'resolvedBy is required'
        });
        return;
      }

      monitoringService.resolveAlert(alertId, resolvedBy);

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error resolving alert:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get monitoring configuration
   */
  async getMonitoringConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = monitoringService.getConfig();

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting monitoring config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get monitoring configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update monitoring configuration
   */
  async updateMonitoringConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;

      // Validate configuration
      if (!config || typeof config !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration format'
        });
        return;
      }

      monitoringService.updateConfig(config);

      res.status(200).json({
        success: true,
        message: 'Monitoring configuration updated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error updating monitoring config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update monitoring configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          timeSlotService: 'operational',
          conflictResolutionService: 'operational',
          monitoringService: 'operational'
        },
        version: process.env.npm_package_version || '1.0.0'
      };

      res.status(200).json(healthStatus);

    } catch (error) {
      logger.error('Health check failed:', { error: (error as Error).message });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable',
        version: process.env.npm_package_version || '1.0.0'
      });
    }
  }

  /**
   * Get time slot system metrics
   */
  async getTimeSlotMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const stats = await timeSlotService.getTimeSlotStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting time slot metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get time slot metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get conflict resolution metrics
   */
  async getConflictMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const stats = await conflictResolutionService.getConflictStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting conflict metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get conflict metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Trigger manual conflict detection
   */
  async triggerConflictDetection(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { reservationId, startDate, endDate } = req.body;

      const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

      const result = await conflictResolutionService.detectConflicts(
        shopId,
        reservationId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error triggering conflict detection:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to trigger conflict detection',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get reservation metrics for monitoring
   */
  async getReservationMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.query;
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const metrics = await monitoringService.getReservationMetrics(
        shopId as string,
        timeRange
      );

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting reservation metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get reservation metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get business metrics for analytics dashboard
   */
  async getBusinessMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const metrics = await monitoringService.getBusinessMetrics(timeRange);

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting business metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get business metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get notification delivery metrics
   */
  async getNotificationMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const metrics = await monitoringService.getNotificationMetrics(timeRange);

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting notification metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get notification metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get comprehensive monitoring dashboard data
   */
  async getMonitoringDashboard(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, shopId } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      // Get all metrics in parallel
      const [
        systemHealth,
        reservationMetrics,
        businessMetrics,
        notificationMetrics,
        activeAlerts
      ] = await Promise.all([
        monitoringService.getSystemHealthMetrics(shopId as string, timeRange),
        monitoringService.getReservationMetrics(shopId as string, timeRange),
        monitoringService.getBusinessMetrics(timeRange),
        monitoringService.getNotificationMetrics(timeRange),
        Promise.resolve(monitoringService.getActiveAlerts(shopId as string))
      ]);

      const dashboard = {
        systemHealth,
        reservationMetrics,
        businessMetrics,
        notificationMetrics,
        activeAlerts: {
          alerts: activeAlerts,
          count: activeAlerts.length,
          criticalCount: activeAlerts.filter(a => a.severity === 'critical').length,
          highCount: activeAlerts.filter(a => a.severity === 'high').length
        },
        summary: {
          overallHealth: systemHealth.successRate > 90 && activeAlerts.filter(a => a.severity === 'critical').length === 0 ? 'healthy' : 'warning',
          keyMetrics: {
            reservationSuccessRate: reservationMetrics.completionRate,
            businessConversionRate: businessMetrics.conversionRate,
            notificationDeliveryRate: notificationMetrics.deliveryRate,
            systemUptime: systemHealth.successRate
          }
        }
      };

      res.status(200).json({
        success: true,
        data: dashboard,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting monitoring dashboard:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get monitoring dashboard',
        timestamp: new Date().toISOString()
      });
    }
  }

  // ========================================
  // FEED-SPECIFIC MONITORING ENDPOINTS
  // ========================================

  /**
   * Get feed-specific metrics
   */
  async getFeedMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const feedMetrics = await monitoringService.getFeedMetrics(timeRange);

      res.status(200).json({
        success: true,
        data: feedMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed-specific alerts
   */
  async getFeedAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { severity, type } = req.query;

      // Get all alerts and filter for feed-specific ones
      const allAlerts = monitoringService.getActiveAlerts();
      let feedAlerts = allAlerts.filter(alert => alert.type === 'feed');

      // Filter by severity if specified
      if (severity) {
        feedAlerts = feedAlerts.filter(alert => alert.severity === severity);
      }

      // Filter by type if specified (performance, moderation, engagement, error, security)
      if (type) {
        feedAlerts = feedAlerts.filter(alert => 
          alert.metadata?.feedAlert && alert.metadata?.type === type
        );
      }

      res.status(200).json({
        success: true,
        data: {
          alerts: feedAlerts,
          count: feedAlerts.length,
          types: {
            performance: feedAlerts.filter(a => a.metadata?.type === 'performance').length,
            moderation: feedAlerts.filter(a => a.metadata?.type === 'moderation').length,
            engagement: feedAlerts.filter(a => a.metadata?.type === 'engagement').length,
            error: feedAlerts.filter(a => a.metadata?.type === 'error').length,
            security: feedAlerts.filter(a => a.metadata?.type === 'security').length
          }
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed alerts:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed alerts',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed performance metrics
   */
  async getFeedPerformance(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange } = req.query; // '1h', '24h', '7d', '30d'
      
      const now = new Date();
      let startTime: Date;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 60 * 60 * 1000); // Default to 1 hour
      }

      const feedMetrics = await monitoringService.getFeedMetrics({
        start: startTime.toISOString(),
        end: now.toISOString()
      });

      // Extract performance-specific data
      const performanceData = {
        avgFeedLoadTime: feedMetrics.performance.avgFeedLoadTime,
        avgPostCreationTime: feedMetrics.performance.avgPostCreationTime,
        avgCommentCreationTime: feedMetrics.performance.avgCommentCreationTime,
        cacheHitRate: feedMetrics.performance.cacheHitRate,
        redisLatency: feedMetrics.performance.redisLatency,
        errorRate: monitoringService.calculateFeedErrorRate(),
        throughput: {
          postsPerHour: feedMetrics.posts.creationRate,
          commentsPerHour: feedMetrics.comments.creationRate,
          activeUsers: feedMetrics.engagement.activeUsers
        }
      };

      res.status(200).json({
        success: true,
        data: performanceData,
        timeRange: {
          start: startTime.toISOString(),
          end: now.toISOString(),
          duration: timeRange || '1h'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed performance:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed performance metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get moderation queue status
   */
  async getModerationQueue(req: Request, res: Response): Promise<void> {
    try {
      const feedMetrics = await monitoringService.getFeedMetrics();
      
      const queueStatus = {
        totalPending: feedMetrics.moderation.queueLength,
        breakdown: {
          posts: feedMetrics.posts.pending,
          comments: feedMetrics.comments.pending
        },
        processing: {
          avgProcessingTime: feedMetrics.moderation.avgProcessingTime,
          autoApprovalRate: feedMetrics.moderation.autoApprovalRate,
          manualReviewRate: feedMetrics.moderation.manualReviewRate
        },
        rates: {
          approvalRate: feedMetrics.moderation.approvalRate,
          rejectionRate: feedMetrics.moderation.rejectionRate
        }
      };

      res.status(200).json({
        success: true,
        data: queueStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting moderation queue status:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get moderation queue status',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed engagement analytics
   */
  async getFeedEngagement(req: Request, res: Response): Promise<void> {
    try {
      const { timeRange } = req.query; // '1h', '24h', '7d', '30d'
      
      const now = new Date();
      let startTime: Date;
      
      switch (timeRange) {
        case '1h':
          startTime = new Date(now.getTime() - 60 * 60 * 1000);
          break;
        case '24h':
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          startTime = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Default to 24 hours
      }

      const feedMetrics = await monitoringService.getFeedMetrics({
        start: startTime.toISOString(),
        end: now.toISOString()
      });

      const engagementData = {
        activity: {
          totalLikes: feedMetrics.engagement.totalLikes,
          totalComments: feedMetrics.engagement.totalComments,
          totalShares: feedMetrics.engagement.totalShares,
          activeUsers: feedMetrics.engagement.activeUsers,
          trendingPosts: feedMetrics.engagement.trendingPosts
        },
        content: {
          postsCreated: feedMetrics.posts.total,
          commentsCreated: feedMetrics.comments.total,
          postsPerHour: feedMetrics.posts.creationRate,
          commentsPerHour: feedMetrics.comments.creationRate,
          engagementRate: feedMetrics.posts.engagementRate
        },
        health: {
          publishedPosts: feedMetrics.posts.published,
          pendingPosts: feedMetrics.posts.pending,
          approvedComments: feedMetrics.comments.approved,
          pendingComments: feedMetrics.comments.pending
        }
      };

      res.status(200).json({
        success: true,
        data: engagementData,
        timeRange: {
          start: startTime.toISOString(),
          end: now.toISOString(),
          duration: timeRange || '24h'
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed engagement:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed engagement analytics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed system health status
   */
  async getFeedHealth(req: Request, res: Response): Promise<void> {
    try {
      const { detailed } = req.query;
      
      if (detailed === 'true') {
        // Get detailed feed health checks
        const [
          feedApiEndpoints,
          feedRedisCache,
          feedImageProcessing,
          feedContentModeration,
          feedRanking,
          feedDatabaseQueries
        ] = await Promise.all([
          healthCheckService.checkFeedApiEndpoints(),
          healthCheckService.checkFeedRedisCache(),
          healthCheckService.checkImageProcessing(),
          healthCheckService.checkContentModeration(),
          healthCheckService.checkFeedRanking(),
          healthCheckService.checkFeedDatabaseQueries()
        ]);

        const feedChecks = {
          apiEndpoints: feedApiEndpoints,
          redisCache: feedRedisCache,
          imageProcessing: feedImageProcessing,
          contentModeration: feedContentModeration,
          feedRanking: feedRanking,
          databaseQueries: feedDatabaseQueries
        };

        // Calculate feed system overall status
        const allFeedChecks = Object.values(feedChecks);
        const healthyCount = allFeedChecks.filter(check => check.status === 'healthy').length;
        const degradedCount = allFeedChecks.filter(check => check.status === 'degraded').length;
        const unhealthyCount = allFeedChecks.filter(check => check.status === 'unhealthy').length;

        let overallStatus = 'healthy';
        if (unhealthyCount > 0) overallStatus = 'unhealthy';
        else if (degradedCount > 0) overallStatus = 'degraded';

        res.status(200).json({
          success: true,
          data: {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: feedChecks,
            summary: {
              totalChecks: allFeedChecks.length,
              healthyChecks: healthyCount,
              degradedChecks: degradedCount,
              unhealthyChecks: unhealthyCount
            }
          },
          timestamp: new Date().toISOString()
        });
      } else {
        // Get basic feed health status
        const feedApiEndpoints = await healthCheckService.checkFeedApiEndpoints();
        const feedRedisCache = await healthCheckService.checkFeedRedisCache();
        
        const basicChecks = [feedApiEndpoints, feedRedisCache];
        const healthyCount = basicChecks.filter(check => check.status === 'healthy').length;
        
        let overallStatus = 'healthy';
        if (healthyCount < basicChecks.length) {
          overallStatus = 'degraded';
        }

        res.status(200).json({
          success: true,
          data: {
            status: overallStatus,
            timestamp: new Date().toISOString(),
            checks: {
              apiEndpoints: feedApiEndpoints,
              redisCache: feedRedisCache
            },
            summary: {
              totalChecks: basicChecks.length,
              healthyChecks: healthyCount,
              degradedChecks: basicChecks.length - healthyCount,
              unhealthyChecks: 0
            }
          },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error getting feed health status:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed health status',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed alerting configuration
   */
  async getFeedAlertingConfig(req: Request, res: Response): Promise<void> {
    try {
      const { type } = req.query;
      
      if (type === 'thresholds') {
        const thresholds = feedAlertingService.getThresholds();
        res.status(200).json({
          success: true,
          data: { thresholds },
          timestamp: new Date().toISOString()
        });
      } else if (type === 'rules') {
        const rules = feedAlertingService.getRules();
        res.status(200).json({
          success: true,
          data: { rules },
          timestamp: new Date().toISOString()
        });
      } else {
        const thresholds = feedAlertingService.getThresholds();
        const rules = feedAlertingService.getRules();
        const status = feedAlertingService.getMonitoringStatus();
        
        res.status(200).json({
          success: true,
          data: {
            thresholds,
            rules,
            status
          },
          timestamp: new Date().toISOString()
        });
      }

    } catch (error) {
      logger.error('Error getting feed alerting configuration:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed alerting configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update feed alerting threshold
   */
  async updateFeedAlertingThreshold(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const thresholdData = req.body;

      // Validate required fields
      if (!thresholdData.id || !thresholdData.name || !thresholdData.metric) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: id, name, metric',
          timestamp: new Date().toISOString()
        });
        return;
      }

      await feedAlertingService.updateThreshold(thresholdData);

      res.status(200).json({
        success: true,
        message: 'Feed alerting threshold updated successfully',
        data: thresholdData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error updating feed alerting threshold:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update feed alerting threshold',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update feed alerting rule
   */
  async updateFeedAlertingRule(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const ruleData = req.body;

      // Validate required fields
      if (!ruleData.id || !ruleData.name || !ruleData.conditions) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: id, name, conditions',
          timestamp: new Date().toISOString()
        });
        return;
      }

      await feedAlertingService.updateRule(ruleData);

      res.status(200).json({
        success: true,
        message: 'Feed alerting rule updated successfully',
        data: ruleData,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error updating feed alerting rule:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update feed alerting rule',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start feed alerting monitoring
   */
  async startFeedAlerting(req: Request, res: Response): Promise<void> {
    try {
      await feedAlertingService.startMonitoring();

      res.status(200).json({
        success: true,
        message: 'Feed alerting monitoring started successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error starting feed alerting monitoring:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to start feed alerting monitoring',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Stop feed alerting monitoring
   */
  async stopFeedAlerting(req: Request, res: Response): Promise<void> {
    try {
      feedAlertingService.stopMonitoring();

      res.status(200).json({
        success: true,
        message: 'Feed alerting monitoring stopped successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error stopping feed alerting monitoring:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to stop feed alerting monitoring',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed alerting status
   */
  async getFeedAlertingStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = feedAlertingService.getMonitoringStatus();

      res.status(200).json({
        success: true,
        data: status,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed alerting status:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed alerting status',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard overview
   */
  async getFeedDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const overview = await feedDashboardService.getDashboardOverview();

      res.status(200).json({
        success: true,
        data: overview,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard overview:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard overview',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard metrics
   */
  async getFeedDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const metrics = await feedDashboardService.getDashboardMetrics(timeRange);

      res.status(200).json({
        success: true,
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard alerts
   */
  async getFeedDashboardAlerts(req: Request, res: Response): Promise<void> {
    try {
      const alerts = await feedDashboardService.getDashboardAlerts();

      res.status(200).json({
        success: true,
        data: alerts,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard alerts:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard alerts',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard trends
   */
  async getFeedDashboardTrends(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const trends = await feedDashboardService.getDashboardTrends(timeRange);

      res.status(200).json({
        success: true,
        data: trends,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard trends:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard trends',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard configuration
   */
  async getFeedDashboardConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = feedDashboardService.getDashboardConfig();

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard configuration:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update feed dashboard configuration
   */
  async updateFeedDashboardConfig(req: Request, res: Response): Promise<void> {
    try {
      const configData = req.body;

      await feedDashboardService.updateDashboardConfig(configData);

      res.status(200).json({
        success: true,
        message: 'Feed dashboard configuration updated successfully',
        data: feedDashboardService.getDashboardConfig(),
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error updating feed dashboard configuration:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update feed dashboard configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get real-time feed dashboard updates
   */
  async getFeedDashboardRealTime(req: Request, res: Response): Promise<void> {
    try {
      const updates = await feedDashboardService.getRealTimeUpdates();

      res.status(200).json({
        success: true,
        data: updates,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting real-time feed dashboard updates:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get real-time feed dashboard updates',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Clear feed dashboard cache
   */
  async clearFeedDashboardCache(req: Request, res: Response): Promise<void> {
    try {
      feedDashboardService.clearCache();

      res.status(200).json({
        success: true,
        message: 'Feed dashboard cache cleared successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error clearing feed dashboard cache:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to clear feed dashboard cache',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get feed dashboard cache statistics
   */
  async getFeedDashboardCacheStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = feedDashboardService.getCacheStats();

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting feed dashboard cache statistics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get feed dashboard cache statistics',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export const monitoringController = new MonitoringController();
