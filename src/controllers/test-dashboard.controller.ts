import { Request, Response } from 'express';
import { AdminAnalyticsRealtimeService } from '../services/admin-analytics-realtime.service';
import { AdminAnalyticsOptimizedService } from '../services/admin-analytics-optimized.service';
import { logger } from '../utils/logger';

/**
 * Test Dashboard Controller
 *
 * Provides unauthenticated endpoints for testing dashboard functionality
 */
export class TestDashboardController {
  private realtimeService = new AdminAnalyticsRealtimeService();
  private optimizedService = new AdminAnalyticsOptimizedService();

  /**
   * GET /api/test/dashboard/realtime
   * Test real-time dashboard metrics without authentication
   */
  async getRealtimeDashboard(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[TEST] Getting real-time dashboard metrics');

      const metrics = await this.realtimeService.getRealTimeDashboardMetrics();

      res.status(200).json({
        success: true,
        message: 'Real-time dashboard metrics retrieved successfully',
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[TEST] Error getting real-time dashboard:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_REALTIME_DASHBOARD_ERROR',
          message: 'Error retrieving real-time dashboard metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/test/dashboard/materialized
   * Test materialized view dashboard metrics without authentication
   */
  async getMaterializedDashboard(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[TEST] Getting materialized dashboard metrics');

      const metrics = await this.optimizedService.getQuickDashboardMetrics();

      res.status(200).json({
        success: true,
        message: 'Materialized dashboard metrics retrieved successfully',
        data: metrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[TEST] Error getting materialized dashboard:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_MATERIALIZED_DASHBOARD_ERROR',
          message: 'Error retrieving materialized dashboard metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/test/dashboard/compare
   * Compare both real-time and materialized view results
   */
  async compareDashboards(req: Request, res: Response): Promise<void> {
    try {
      logger.info('[TEST] Comparing dashboard metrics');

      const [realtimeMetrics, materializedMetrics] = await Promise.allSettled([
        this.realtimeService.getRealTimeDashboardMetrics(),
        this.optimizedService.getQuickDashboardMetrics()
      ]);

      const result: any = {
        realtime: realtimeMetrics.status === 'fulfilled' ? {
          success: true,
          data: realtimeMetrics.value
        } : {
          success: false,
          error: realtimeMetrics.reason
        },
        materialized: materializedMetrics.status === 'fulfilled' ? {
          success: true,
          data: materializedMetrics.value
        } : {
          success: false,
          error: materializedMetrics.reason
        }
      };

      // Compare key metrics if both succeeded
      if (result.realtime.success && result.materialized.success) {
        const rt = result.realtime.data;
        const mv = result.materialized.data;

        result.comparison = {
          todayRevenueDiff: rt.todayRevenue - mv.todayRevenue,
          todayReservationsDiff: rt.todayReservations - mv.todayReservations,
          totalUsersDiff: rt.totalUsers - mv.totalUsers,
          totalRevenueDiff: rt.totalRevenue - mv.totalRevenue,
          recommendation: rt.todayRevenue > 0 || rt.todayReservations > 0
            ? 'Use real-time data - more current'
            : 'Materialized view data acceptable'
        };
      }

      res.status(200).json({
        success: true,
        message: 'Dashboard comparison completed',
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('[TEST] Error comparing dashboards:', error);

      res.status(500).json({
        success: false,
        error: {
          code: 'TEST_COMPARE_DASHBOARD_ERROR',
          message: 'Error comparing dashboard metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }
}