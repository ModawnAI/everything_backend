import { Request, Response, NextFunction } from 'express';
import { referralAnalyticsService } from '../services/referral-analytics.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Referral Analytics Controller
 * Handles referral analytics and reporting endpoints
 */
export class ReferralAnalyticsController {
  /**
   * Rate limiting for referral analytics operations
   */
  public referralAnalyticsRateLimit = rateLimit({
    config: {
      max: 50, // 50 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many referral analytics requests. Please try again later.',
        code: 'REFERRAL_ANALYTICS_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Get referral analytics overview
   */
  public getReferralAnalyticsOverview = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const overview = await referralAnalyticsService.getReferralAnalyticsOverview();

      logger.info('Referral analytics overview retrieved', {
        requestedBy,
        totalReferrals: overview.totalReferrals,
        conversionRate: overview.conversionRate
      });

      res.json({
        success: true,
        data: overview
      });

    } catch (error) {
      logger.error('Failed to get referral analytics overview', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral analytics overview',
        code: 'OVERVIEW_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get referral trends data
   */
  public getReferralTrends = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { period = 'month', startDate, endDate } = req.query;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!startDate || !endDate) {
        return res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const trends = await referralAnalyticsService.getReferralTrends(
        period as 'day' | 'week' | 'month' | 'year',
        startDate as string,
        endDate as string
      );

      logger.info('Referral trends data retrieved', {
        requestedBy,
        period,
        startDate,
        endDate,
        totalReferrals: trends.summary.totalReferrals
      });

      res.json({
        success: true,
        data: trends
      });

    } catch (error) {
      logger.error('Failed to get referral trends data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id,
        period: req.query.period,
        startDate: req.query.startDate,
        endDate: req.query.endDate
      });

      res.status(500).json({
        error: 'Failed to retrieve referral trends data',
        code: 'TRENDS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get user referral analytics
   */
  public getUserReferralAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Users can only view their own analytics or admins can view any
      const targetUserId = userId || currentUserId;
      
      if (targetUserId !== currentUserId) {
        // TODO: Add admin check here if needed
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const analytics = await referralAnalyticsService.getUserReferralAnalytics(targetUserId);

      logger.info('User referral analytics retrieved', {
        userId: targetUserId,
        totalReferrals: analytics.totalReferrals,
        conversionRate: analytics.conversionRate,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('Failed to get user referral analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve user referral analytics',
        code: 'USER_ANALYTICS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get referral system metrics (admin only)
   */
  public getReferralSystemMetrics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // TODO: Add admin check here if needed

      const metrics = await referralAnalyticsService.getReferralSystemMetrics();

      logger.info('Referral system metrics retrieved', {
        requestedBy,
        activeUsers: metrics.systemHealth.activeUsers,
        totalReferrals: metrics.systemHealth.totalReferrals
      });

      res.json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('Failed to get referral system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral system metrics',
        code: 'SYSTEM_METRICS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Generate comprehensive referral report
   */
  public generateReferralReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { reportType, startDate, endDate, userId } = req.body;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!reportType || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Report type, start date, and end date are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const report = await referralAnalyticsService.generateReferralReport(
        reportType,
        startDate,
        endDate,
        userId
      );

      logger.info('Referral report generated', {
        reportId: report.reportId,
        reportType,
        startDate,
        endDate,
        requestedBy
      });

      res.json({
        success: true,
        data: report
      });

    } catch (error) {
      logger.error('Failed to generate referral report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportType: req.body.reportType,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to generate referral report',
        code: 'REPORT_GENERATION_FAILED'
      });
    }
  };

  /**
   * Get referral analytics dashboard data
   */
  public getReferralAnalyticsDashboard = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { period = 'month', startDate, endDate } = req.query;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Get overview data
      const overview = await referralAnalyticsService.getReferralAnalyticsOverview();

      // Get trends data if dates provided
      let trends = null;
      if (startDate && endDate) {
        trends = await referralAnalyticsService.getReferralTrends(
          period as 'day' | 'week' | 'month' | 'year',
          startDate as string,
          endDate as string
        );
      }

      // Get system metrics
      const systemMetrics = await referralAnalyticsService.getReferralSystemMetrics();

      const dashboard = {
        overview,
        trends,
        systemMetrics,
        generatedAt: new Date().toISOString(),
        period: {
          type: period,
          startDate: startDate || null,
          endDate: endDate || null
        }
      };

      logger.info('Referral analytics dashboard retrieved', {
        requestedBy,
        period,
        hasTrends: !!trends
      });

      res.json({
        success: true,
        data: dashboard
      });

    } catch (error) {
      logger.error('Failed to get referral analytics dashboard', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral analytics dashboard',
        code: 'DASHBOARD_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Export referral analytics data
   */
  public exportReferralAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { format = 'json', reportType, startDate, endDate, userId } = req.query;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!reportType || !startDate || !endDate) {
        return res.status(400).json({
          error: 'Report type, start date, and end date are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Generate report
      const report = await referralAnalyticsService.generateReferralReport(
        reportType as 'overview' | 'trends' | 'user' | 'system' | 'financial',
        startDate as string,
        endDate as string,
        userId as string
      );

      // Set response headers based on format
      const filename = `referral_analytics_${reportType}_${startDate}_to_${endDate}`;
      
      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
        
        // TODO: Convert report data to CSV format
        res.send('CSV export not implemented yet');
      } else if (format === 'xlsx') {
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.xlsx"`);
        
        // TODO: Convert report data to Excel format
        res.send('Excel export not implemented yet');
      } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}.json"`);
        res.json(report);
      }

      logger.info('Referral analytics data exported', {
        requestedBy,
        format,
        reportType,
        startDate,
        endDate
      });

    } catch (error) {
      logger.error('Failed to export referral analytics data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to export referral analytics data',
        code: 'EXPORT_FAILED'
      });
    }
  };
}

export const referralAnalyticsController = new ReferralAnalyticsController();

