/**
 * Referral Controller
 * 
 * Handles referral system endpoints for tracking, statistics,
 * and referral history management
 */

import { Request, Response, NextFunction } from 'express';
import { referralService } from '../services/referral.service';
import { logger } from '../utils/logger';
import {
  ReferralStatsResponse,
  ReferralHistoryResponse,
  ReferralBonusPayoutResponse,
  ReferralError,
  ReferralValidationError,
  ReferralLimitExceededError,
  ReferralBonusPayoutError
} from '../types/referral.types';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Referral request interfaces
 */
interface GetReferralStatsRequest extends AuthenticatedRequest {}

interface GetReferralHistoryRequest extends AuthenticatedRequest {
  query: {
    page?: string;
    limit?: string;
  };
}

interface UpdateReferralStatusRequest extends AuthenticatedRequest {
  body: {
    referralId: string;
    status: 'pending' | 'completed' | 'cancelled' | 'expired';
    notes?: string;
  };
}

interface ReferralBonusPayoutRequest extends AuthenticatedRequest {
  body: {
    referralId: string;
    payoutMethod: 'points' | 'cash' | 'bank_transfer';
    payoutDetails?: {
      accountNumber?: string;
      bankName?: string;
      recipientName?: string;
    };
  };
}

interface SetReferrerRequest extends AuthenticatedRequest {
  body: {
    referralCode: string;
  };
}

/**
 * Referral Controller Class
 */
export class ReferralController {
  /**
   * GET /api/referrals/stats
   * Get referral statistics for authenticated user
   */
  public getReferralStats = async (req: GetReferralStatsRequest, res: Response<ReferralStatsResponse>, next: NextFunction): Promise<void> => {
    const requestId = `stats-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Referral stats request', {
        userId,
        requestId
      });

      // Get referral statistics
      const stats = await referralService.getReferralStats(userId);

      // Get recent referrals for the stats response
      const { referrals: recentReferrals } = await referralService.getReferralHistory(userId, 1, 5);

      const duration = Date.now() - startTime;
      logger.info('Referral stats retrieved successfully', {
        userId,
        totalReferrals: stats.totalReferrals,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: {
          stats,
          recentReferrals
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to get referral stats', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천 통계 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/referrals/history
   * Get referral history for authenticated user
   */
  public getReferralHistory = async (req: GetReferralHistoryRequest, res: Response<ReferralHistoryResponse>, next: NextFunction): Promise<void> => {
    const requestId = `history-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const page = parseInt(req.query.page || '1');
      const limit = Math.min(parseInt(req.query.limit || '20'), 100); // Max 100 per page

      logger.info('Referral history request', {
        userId,
        page,
        limit,
        requestId
      });

      // Get referral history
      const { referrals, pagination } = await referralService.getReferralHistory(userId, page, limit);

      const duration = Date.now() - startTime;
      logger.info('Referral history retrieved successfully', {
        userId,
        totalReferrals: pagination.total,
        page,
        limit,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: {
          referrals,
          pagination
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to get referral history', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천 기록 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * PUT /api/referrals/:referralId/status
   * Update referral status (admin only)
   */
  public updateReferralStatus = async (req: UpdateReferralStatusRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `update-status-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
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

      const { referralId, status, notes } = req.body;

      logger.info('Referral status update request', {
        userId,
        referralId,
        status,
        requestId
      });

      // Update referral status
      const updatedReferral = await referralService.updateReferralStatus({
        referralId,
        status,
        notes
      });

      const duration = Date.now() - startTime;
      logger.info('Referral status updated successfully', {
        userId,
        referralId,
        status,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: {
          referral: updatedReferral,
          message: '추천 상태가 업데이트되었습니다.'
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to update referral status', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천 상태 업데이트 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/referrals/:referralId/payout
   * Process referral bonus payout (admin only)
   */
  public processReferralPayout = async (req: ReferralBonusPayoutRequest, res: Response<ReferralBonusPayoutResponse>, next: NextFunction): Promise<void> => {
    const requestId = `payout-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
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

      const { referralId, payoutMethod, payoutDetails } = req.body;

      logger.info('Referral payout request', {
        userId,
        referralId,
        payoutMethod,
        requestId
      });

      // TODO: Implement payout processing
      // For now, return a placeholder response
      const duration = Date.now() - startTime;
      logger.info('Referral payout processed successfully', {
        userId,
        referralId,
        payoutMethod,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: {
          referralId,
          payoutAmount: 1000, // Placeholder
          payoutMethod,
          payoutStatus: 'pending',
          payoutDate: new Date().toISOString(),
          transactionId: `payout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        }
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to process referral payout', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천 보너스 지급 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/referrals/analytics
   * Get referral analytics for admin dashboard
   */
  public getReferralAnalytics = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `analytics-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
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

      logger.info('Referral analytics request', {
        userId,
        requestId
      });

      // Get referral analytics
      const analytics = await referralService.getReferralAnalytics();

      const duration = Date.now() - startTime;
      logger.info('Referral analytics retrieved successfully', {
        userId,
        totalReferrals: analytics.totalReferrals,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Failed to get referral analytics', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천 분석 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * GET /api/referrals/my-referrer
   * Get the referrer info for authenticated user (who referred this user)
   */
  public getMyReferrer = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `my-referrer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Get my referrer request', {
        userId,
        requestId
      });

      // Get referrer info
      const referrer = await referralService.getMyReferrer(userId);

      const duration = Date.now() - startTime;
      logger.info('My referrer info retrieved successfully', {
        userId,
        hasReferrer: !!referrer,
        duration,
        requestId
      });

      res.status(200).json({
        success: true,
        data: referrer
      });

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Failed to get my referrer', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천인 정보 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };

  /**
   * POST /api/referrals/set-referrer
   * Set referrer using referral code
   */
  public setReferrer = async (req: SetReferrerRequest, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `set-referrer-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { referralCode } = req.body;

      if (!referralCode || typeof referralCode !== 'string') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REFERRAL_CODE',
            message: '추천 코드를 입력해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.info('Set referrer request', {
        userId,
        referralCode: referralCode.substring(0, 4) + '****', // Mask code in logs
        requestId
      });

      // Set referrer
      const result = await referralService.setReferrerByCode(userId, referralCode);

      const duration = Date.now() - startTime;
      logger.info('Set referrer completed', {
        userId,
        success: result.success,
        duration,
        requestId
      });

      if (result.success) {
        res.status(200).json({
          success: true,
          message: result.message,
          data: result.referrer
        });
      } else {
        res.status(400).json({
          success: false,
          error: {
            code: 'SET_REFERRER_FAILED',
            message: result.message,
            timestamp: new Date().toISOString()
          }
        });
      }

    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Failed to set referrer', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });

      // Handle specific error types
      if (error instanceof ReferralError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generic error
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '추천인 설정 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

// Export singleton instance
export const referralController = new ReferralController(); 