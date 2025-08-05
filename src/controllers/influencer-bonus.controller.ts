/**
 * Influencer Bonus Controller
 * 
 * Handles influencer bonus system endpoints including:
 * - Influencer bonus analytics and reporting
 * - Bonus validation and monitoring
 * - Influencer qualification tracking
 * - Performance metrics and insights
 */

import { Request, Response, NextFunction } from 'express';
import { InfluencerBonusService } from '../services/influencer-bonus.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Request interfaces
 */
interface GetInfluencerBonusStatsRequest extends AuthenticatedRequest {
  query: {
    startDate?: string;
    endDate?: string;
  };
}

interface GetInfluencerBonusAnalyticsRequest extends AuthenticatedRequest {
  params: {
    influencerId: string;
  };
  query: {
    startDate?: string;
    endDate?: string;
  };
}

interface ValidateInfluencerBonusRequest extends AuthenticatedRequest {
  params: {
    transactionId: string;
  };
  body: {
    userId: string;
  };
}

interface CheckInfluencerQualificationRequest extends AuthenticatedRequest {
  body: {
    userId: string;
    criteria: {
      minimumFollowers?: number;
      minimumEngagement?: number;
      minimumContentPosts?: number;
      accountAge?: number;
      verificationStatus?: boolean;
      contentQuality?: 'high' | 'medium' | 'low';
    };
  };
}

/**
 * Influencer Bonus Controller Class
 */
export class InfluencerBonusController {
  private influencerBonusService = new InfluencerBonusService();

  /**
   * GET /api/admin/influencer-bonus/stats
   * Get influencer bonus statistics (Admin only)
   */
  public getInfluencerBonusStats = async (
    req: GetInfluencerBonusStatsRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

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

      // TODO: Add admin role check
      // if (req.user?.user_role !== 'admin') {
      //   res.status(403).json({
      //     success: false,
      //     error: {
      //       code: 'FORBIDDEN',
      //       message: '관리자 권한이 필요합니다.',
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   return;
      // }

      const { startDate, endDate } = req.query;
      const timeRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;

      logger.info('Influencer bonus stats request', {
        adminId,
        timeRange,
        requestId
      });

      // Get influencer bonus statistics
      const stats = await this.influencerBonusService.getInfluencerBonusStats(timeRange);

      const duration = Date.now() - startTime;
      logger.info('Influencer bonus stats retrieved successfully', {
        adminId,
        totalInfluencers: stats.totalInfluencers,
        totalBonusPoints: stats.totalBonusPointsAwarded,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: stats,
        message: '인플루언서 보너스 통계를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to get influencer bonus stats', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INFLUENCER_BONUS_STATS_ERROR',
          message: '인플루언서 보너스 통계 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/admin/influencer-bonus/analytics/:influencerId
   * Get detailed analytics for a specific influencer (Admin only)
   */
  public getInfluencerBonusAnalytics = async (
    req: GetInfluencerBonusAnalyticsRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

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

      // TODO: Add admin role check
      // if (req.user?.user_role !== 'admin') {
      //   res.status(403).json({
      //     success: false,
      //     error: {
      //       code: 'FORBIDDEN',
      //       message: '관리자 권한이 필요합니다.',
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   return;
      // }

      const { influencerId } = req.params;
      const { startDate, endDate } = req.query;
      const timeRange = startDate && endDate ? { start: startDate, end: endDate } : undefined;

      logger.info('Influencer bonus analytics request', {
        adminId,
        influencerId,
        timeRange,
        requestId
      });

      // Get influencer bonus analytics
      const analytics = await this.influencerBonusService.getInfluencerBonusAnalytics(
        influencerId,
        timeRange
      );

      const duration = Date.now() - startTime;
      logger.info('Influencer bonus analytics retrieved successfully', {
        adminId,
        influencerId,
        influencerName: analytics.influencerName,
        totalBonusPoints: analytics.totalBonusPoints,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: analytics,
        message: '인플루언서 보너스 분석을 성공적으로 조회했습니다.'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to get influencer bonus analytics', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INFLUENCER_BONUS_ANALYTICS_ERROR',
          message: '인플루언서 보너스 분석 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/admin/influencer-bonus/validate/:transactionId
   * Validate influencer bonus calculation (Admin only)
   */
  public validateInfluencerBonus = async (
    req: ValidateInfluencerBonusRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = `validate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

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

      // TODO: Add admin role check
      // if (req.user?.user_role !== 'admin') {
      //   res.status(403).json({
      //     success: false,
      //     error: {
      //       code: 'FORBIDDEN',
      //       message: '관리자 권한이 필요합니다.',
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   return;
      // }

      const { transactionId } = req.params;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: '사용자 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Influencer bonus validation request', {
        adminId,
        transactionId,
        userId,
        requestId
      });

      // Validate influencer bonus
      const validation = await this.influencerBonusService.validateInfluencerBonus(
        userId,
        transactionId
      );

      const duration = Date.now() - startTime;
      logger.info('Influencer bonus validation completed', {
        adminId,
        transactionId,
        userId,
        isValid: validation.isValid,
        errorCount: validation.errors.length,
        warningCount: validation.warnings.length,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: validation,
        message: validation.isValid 
          ? '인플루언서 보너스 검증이 성공했습니다.'
          : '인플루언서 보너스 검증에서 문제가 발견되었습니다.'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to validate influencer bonus', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INFLUENCER_BONUS_VALIDATION_ERROR',
          message: '인플루언서 보너스 검증 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/admin/influencer-bonus/check-qualification
   * Check influencer qualification based on criteria (Admin only)
   */
  public checkInfluencerQualification = async (
    req: CheckInfluencerQualificationRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    const requestId = `qualification-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

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

      // TODO: Add admin role check
      // if (req.user?.user_role !== 'admin') {
      //   res.status(403).json({
      //     success: false,
      //     error: {
      //       code: 'FORBIDDEN',
      //       message: '관리자 권한이 필요합니다.',
      //       timestamp: new Date().toISOString()
      //     }
      //   });
      //   return;
      // }

      const { userId, criteria } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_USER_ID',
            message: '사용자 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Influencer qualification check request', {
        adminId,
        userId,
        criteria,
        requestId
      });

      // Check influencer qualification
      const result = await this.influencerBonusService.checkInfluencerQualification(
        userId,
        criteria
      );

      const duration = Date.now() - startTime;
      logger.info('Influencer qualification check completed', {
        adminId,
        userId,
        userName: result.userName,
        isQualified: result.isQualified,
        qualificationScore: result.qualificationScore,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: result,
        message: result.isQualified 
          ? '인플루언서 자격 조건을 충족합니다.'
          : '인플루언서 자격 조건을 충족하지 않습니다.'
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to check influencer qualification', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INFLUENCER_QUALIFICATION_CHECK_ERROR',
          message: '인플루언서 자격 확인 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

// Export singleton instance
export const influencerBonusController = new InfluencerBonusController(); 