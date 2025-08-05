/**
 * Point Processing Controller
 * 
 * Provides admin endpoints for point processing tasks including:
 * - Manual triggering of point processing jobs
 * - Processing statistics and monitoring
 * - Admin control over automated point workflows
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { pointProcessingService, PointProcessingStats } from '../services/point-processing.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class PointProcessingController {
  private supabase = getSupabaseClient();

  /**
   * Manually trigger all point processing tasks
   */
  async triggerAllProcessing(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      logger.info('Admin triggered all point processing tasks', {
        adminUserId: req.user.id,
        timestamp: new Date().toISOString()
      });

      const stats = await pointProcessingService.runAllProcessingTasks();

      res.status(200).json({
        success: true,
        message: '포인트 처리 작업이 완료되었습니다.',
        data: {
          stats,
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error triggering point processing tasks', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '포인트 처리 작업 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Manually trigger pending to available processing
   */
  async triggerPendingProcessing(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      logger.info('Admin triggered pending points processing', {
        adminUserId: req.user.id,
        timestamp: new Date().toISOString()
      });

      const processedCount = await pointProcessingService.processPendingToAvailable();

      res.status(200).json({
        success: true,
        message: `${processedCount}개의 대기 중인 포인트가 처리되었습니다.`,
        data: {
          processedCount,
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error triggering pending points processing', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '대기 중인 포인트 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Manually trigger expired points processing
   */
  async triggerExpiredProcessing(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      logger.info('Admin triggered expired points processing', {
        adminUserId: req.user.id,
        timestamp: new Date().toISOString()
      });

      const processedCount = await pointProcessingService.processExpiredPoints();

      res.status(200).json({
        success: true,
        message: `${processedCount}개의 만료된 포인트가 처리되었습니다.`,
        data: {
          processedCount,
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error triggering expired points processing', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '만료된 포인트 처리 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Manually trigger expiration warning notifications
   */
  async triggerExpirationWarnings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      logger.info('Admin triggered expiration warning notifications', {
        adminUserId: req.user.id,
        timestamp: new Date().toISOString()
      });

      const warningsSent = await pointProcessingService.sendExpirationWarnings();

      res.status(200).json({
        success: true,
        message: `${warningsSent}개의 만료 경고 알림이 전송되었습니다.`,
        data: {
          warningsSent,
          triggeredBy: req.user.id,
          triggeredAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error triggering expiration warning notifications', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '만료 경고 알림 전송 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Get point processing statistics
   */
  async getProcessingStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      const stats = await pointProcessingService.getProcessingStats();

      res.status(200).json({
        success: true,
        data: {
          stats,
          retrievedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting point processing stats', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '포인트 처리 통계 조회 중 오류가 발생했습니다.'
      });
    }
  }

  /**
   * Get detailed point processing analytics
   */
  async getProcessingAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Check admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          message: '관리자 권한이 필요합니다.'
        });
        return;
      }

      const { startDate, endDate } = req.query;
      const start = startDate ? new Date(startDate as string) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // Default to 30 days ago
      const end = endDate ? new Date(endDate as string) : new Date();

      // Get point transaction statistics for the date range
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('status, amount, created_at, updated_at')
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (error) {
        logger.error('Error fetching point transaction analytics', {
          error: error.message,
          adminUserId: req.user.id
        });
        throw new Error(`Failed to fetch analytics: ${error.message}`);
      }

      // Calculate analytics
      const analytics = {
        totalTransactions: transactions?.length || 0,
        totalPointsEarned: 0,
        totalPointsUsed: 0,
        totalPointsExpired: 0,
        statusBreakdown: {
          pending: 0,
          available: 0,
          used: 0,
          expired: 0
        },
        dailyStats: new Map<string, { earned: number; used: number; expired: number }>()
      };

      for (const transaction of transactions || []) {
        const amount = Math.abs(transaction.amount);
        const date = transaction.created_at.split('T')[0];

        // Initialize daily stats if not exists
        if (!analytics.dailyStats.has(date)) {
          analytics.dailyStats.set(date, { earned: 0, used: 0, expired: 0 });
        }

        const dailyStats = analytics.dailyStats.get(date)!;

        if (transaction.amount > 0) {
          analytics.totalPointsEarned += amount;
          dailyStats.earned += amount;
        } else {
          analytics.totalPointsUsed += amount;
          dailyStats.used += amount;
        }

        if (transaction.status === 'expired') {
          analytics.totalPointsExpired += amount;
          dailyStats.expired += amount;
        }

        analytics.statusBreakdown[transaction.status as keyof typeof analytics.statusBreakdown]++;
      }

      // Convert daily stats to array format
      const dailyStatsArray = Array.from(analytics.dailyStats.entries()).map(([date, stats]) => ({
        date,
        ...stats
      }));

      res.status(200).json({
        success: true,
        data: {
          period: {
            start: start.toISOString(),
            end: end.toISOString()
          },
          analytics: {
            ...analytics,
            dailyStats: dailyStatsArray
          },
          retrievedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Error getting point processing analytics', {
        adminUserId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'INTERNAL_SERVER_ERROR',
        message: '포인트 처리 분석 조회 중 오류가 발생했습니다.'
      });
    }
  }
} 