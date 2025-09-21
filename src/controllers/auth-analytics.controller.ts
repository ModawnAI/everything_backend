import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { authAnalyticsService } from '../services/auth-analytics.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';

/**
 * Authentication Analytics Controller
 * Provides comprehensive authentication analytics and insights
 */
export class AuthAnalyticsController {
  /**
   * Rate limiting for analytics endpoints
   */
  public analyticsRateLimit = rateLimit({
    config: {
      max: 100, // 100 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many analytics requests. Please try again later.',
        code: 'ANALYTICS_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Get comprehensive authentication analytics
   */
  public getAuthAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { 
        startDate, 
        endDate, 
        userId,
        period = 'day'
      } = req.query;

      // Validate dates
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      if (start >= end) {
        return res.status(400).json({
          error: 'Start date must be before end date',
          code: 'INVALID_DATE_RANGE'
        });
      }

      const analytics = await authAnalyticsService.getAuthAnalytics(
        start,
        end,
        userId as string
      );

      logger.info('Auth analytics retrieved', {
        userId: req.user?.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        targetUserId: userId
      });

      res.json({
        success: true,
        data: {
          ...analytics,
          period: {
            start: start.toISOString(),
            end: end.toISOString(),
            days: Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))
          },
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get auth analytics', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve authentication analytics',
        code: 'ANALYTICS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get authentication trends over time
   */
  public getAuthTrends = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { 
        period = 'day',
        startDate, 
        endDate 
      } = req.query;

      // Validate period
      if (!['hour', 'day', 'week', 'month'].includes(period as string)) {
        return res.status(400).json({
          error: 'Invalid period. Must be one of: hour, day, week, month',
          code: 'INVALID_PERIOD'
        });
      }

      // Validate dates
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      const trends = await authAnalyticsService.getAuthTrends(
        period as 'hour' | 'day' | 'week' | 'month',
        start,
        end
      );

      logger.info('Auth trends retrieved', {
        userId: req.user?.id,
        period,
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      logger.error('Failed to get auth trends', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve authentication trends',
        code: 'TRENDS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get security insights and threat analysis
   */
  public getSecurityInsights = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { 
        startDate, 
        endDate 
      } = req.query;

      // Validate dates
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate as string) : new Date();

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({
          error: 'Invalid date format',
          code: 'INVALID_DATE_FORMAT'
        });
      }

      const insights = await authAnalyticsService.getSecurityInsights(start, end);

      logger.info('Security insights retrieved', {
        userId: req.user?.id,
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        riskScore: insights.riskScore
      });

      res.json({
        success: true,
        data: insights
      });

    } catch (error) {
      logger.error('Failed to get security insights', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve security insights',
        code: 'INSIGHTS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get user authentication profile
   */
  public getUserAuthProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const { days = 30 } = req.query;

      if (!userId) {
        return res.status(400).json({
          error: 'User ID is required',
          code: 'MISSING_USER_ID'
        });
      }

      const daysNumber = parseInt(days as string);
      if (isNaN(daysNumber) || daysNumber < 1 || daysNumber > 365) {
        return res.status(400).json({
          error: 'Days must be a number between 1 and 365',
          code: 'INVALID_DAYS_RANGE'
        });
      }

      const profile = await authAnalyticsService.getUserAuthProfile(userId, daysNumber);

      logger.info('User auth profile retrieved', {
        requestedBy: req.user?.id,
        targetUserId: userId,
        days: daysNumber
      });

      res.json({
        success: true,
        data: profile
      });

    } catch (error) {
      logger.error('Failed to get user auth profile', {
        userId: req.user?.id,
        targetUserId: req.params.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve user authentication profile',
        code: 'USER_PROFILE_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get real-time authentication metrics
   */
  public getRealTimeMetrics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const metrics = await authAnalyticsService.getRealTimeMetrics();

      logger.debug('Real-time metrics retrieved', {
        userId: req.user?.id,
        activeUsers: metrics.activeUsers,
        activeSessions: metrics.activeSessions
      });

      res.json({
        success: true,
        data: {
          ...metrics,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get real-time metrics', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve real-time metrics',
        code: 'REALTIME_METRICS_FAILED'
      });
    }
  };

  /**
   * Get authentication dashboard data
   */
  public getDashboardData = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { period = 'day' } = req.query;

      // Get data for last 7 days by default
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);

      // Get all dashboard data in parallel
      const [analytics, trends, insights, realTimeMetrics] = await Promise.all([
        authAnalyticsService.getAuthAnalytics(startDate, endDate),
        authAnalyticsService.getAuthTrends(period as 'hour' | 'day' | 'week' | 'month', startDate, endDate),
        authAnalyticsService.getSecurityInsights(startDate, endDate),
        authAnalyticsService.getRealTimeMetrics()
      ]);

      logger.info('Dashboard data retrieved', {
        userId: req.user?.id,
        period,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      res.json({
        success: true,
        data: {
          analytics,
          trends,
          insights,
          realTimeMetrics,
          period: {
            start: startDate.toISOString(),
            end: endDate.toISOString(),
            type: period
          },
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get dashboard data', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to retrieve dashboard data',
        code: 'DASHBOARD_DATA_FAILED'
      });
    }
  };
}

export const authAnalyticsController = new AuthAnalyticsController();
