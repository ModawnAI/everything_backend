import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AdminAnalyticsService, AnalyticsFilters, ExportOptions } from '../services/admin-analytics.service';
import { logger } from '../utils/logger';

/**
 * Admin Analytics Controller
 * 
 * Provides comprehensive analytics dashboard endpoints for admin oversight
 * including real-time metrics, trend analysis, and data export functionality
 */
export default class AdminAnalyticsController {
  private analyticsService = new AdminAnalyticsService();

  /**
   * GET /api/admin/analytics/dashboard
   * Get comprehensive dashboard metrics with real-time data
   */
  async getDashboardMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract query parameters
      const filters: AnalyticsFilters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        period: req.query.period as 'day' | 'week' | 'month' | 'quarter' | 'year',
        category: req.query.category as string,
        shopId: req.query.shopId as string,
        userId: req.query.userId as string,
        includeCache: req.query.includeCache !== 'false'
      };

      logger.info('Getting dashboard metrics', { adminId, filters });

      const metrics = await this.analyticsService.getDashboardMetrics(adminId, filters);

      res.status(200).json({
        success: true,
        message: '대시보드 메트릭을 성공적으로 조회했습니다.',
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getDashboardMetrics:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'DASHBOARD_METRICS_ERROR',
          message: '대시보드 메트릭 조회 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/analytics/realtime
   * Get real-time metrics for live dashboard updates
   */
  async getRealTimeMetrics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Getting real-time metrics', { adminId });

      const metrics = await this.analyticsService.getRealTimeMetrics(adminId);

      res.status(200).json({
        success: true,
        message: '실시간 메트릭을 성공적으로 조회했습니다.',
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getRealTimeMetrics:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'REALTIME_METRICS_ERROR',
          message: '실시간 메트릭 조회 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/analytics/export
   * Export analytics data in various formats
   */
  async exportAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract query parameters
      const filters: AnalyticsFilters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        period: req.query.period as 'day' | 'week' | 'month' | 'quarter' | 'year',
        category: req.query.category as string,
        shopId: req.query.shopId as string,
        userId: req.query.userId as string,
        includeCache: req.query.includeCache !== 'false'
      };

      const options: ExportOptions = {
        format: (req.query.format as 'csv' | 'json' | 'excel') || 'csv',
        includeCharts: req.query.includeCharts === 'true',
        includeTrends: req.query.includeTrends === 'true'
      };

      // Add dateRange only if both dates are provided
      if (req.query.startDate && req.query.endDate) {
        options.dateRange = {
          startDate: req.query.startDate as string,
          endDate: req.query.endDate as string
        };
      }

      logger.info('Exporting analytics data', { adminId, filters, options });

      const exportData = await this.analyticsService.exportAnalytics(adminId, filters, options);

      // Set appropriate headers based on format
      const contentType = options.format === 'csv' 
        ? 'text/csv; charset=utf-8'
        : options.format === 'json'
        ? 'application/json'
        : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

      const filename = `analytics_export_${new Date().toISOString().split('T')[0]}.${options.format}`;

      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', Buffer.byteLength(exportData, 'utf8'));

      res.status(200).send(exportData);

    } catch (error) {
      logger.error('Error in exportAnalytics:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'EXPORT_ERROR',
          message: '데이터 내보내기 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/analytics/cache/stats
   * Get cache statistics for performance monitoring
   */
  async getCacheStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Getting cache statistics', { adminId });

      const cacheStats = this.analyticsService.getCacheStats();

      res.status(200).json({
        success: true,
        message: '캐시 통계를 성공적으로 조회했습니다.',
        data: cacheStats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getCacheStats:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_STATS_ERROR',
          message: '캐시 통계 조회 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * POST /api/admin/analytics/cache/clear
   * Clear analytics cache
   */
  async clearCache(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Clearing analytics cache', { adminId });

      this.analyticsService.clearCache();

      res.status(200).json({
        success: true,
        message: '분석 캐시를 성공적으로 초기화했습니다.',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in clearCache:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'CACHE_CLEAR_ERROR',
          message: '캐시 초기화 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/admin/analytics/health
   * Get analytics system health status
   */
  async getAnalyticsHealth(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '관리자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Getting analytics health status', { adminId });

      // Get basic metrics to test system health
      const metrics = await this.analyticsService.getRealTimeMetrics(adminId);
      const cacheStats = this.analyticsService.getCacheStats();

      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        metrics: {
          hasUserData: !!metrics.userGrowth?.totalUsers,
          hasRevenueData: !!metrics.revenue?.totalRevenue,
          hasReservationData: !!metrics.reservations?.totalReservations,
          hasPaymentData: !!metrics.payments?.totalTransactions
        },
        cache: {
          size: cacheStats.size,
          isOperational: true
        },
        performance: {
          responseTime: 'fast',
          dataFreshness: 'current'
        }
      };

      res.status(200).json({
        success: true,
        message: '분석 시스템 상태를 성공적으로 조회했습니다.',
        data: healthStatus,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error in getAnalyticsHealth:', error);
      
      res.status(500).json({
        success: false,
        error: {
          code: 'ANALYTICS_HEALTH_ERROR',
          message: '분석 시스템 상태 조회 중 오류가 발생했습니다.',
          details: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
} 