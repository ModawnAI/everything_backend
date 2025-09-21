import { Request, Response, NextFunction } from 'express';
import { referralEarningsService } from '../services/referral-earnings.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Referral Earnings Controller
 * Handles referral earnings calculation, payout processing, and earnings management
 */
export class ReferralEarningsController {
  /**
   * Rate limiting for referral earnings operations
   */
  public referralEarningsRateLimit = rateLimit({
    config: {
      max: 30, // 30 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many referral earnings requests. Please try again later.',
        code: 'REFERRAL_EARNINGS_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Calculate referral earnings for a specific referral
   */
  public calculateReferralEarnings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referralId, referrerId, referredId } = req.body;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referralId || !referrerId || !referredId) {
        return res.status(400).json({
          error: 'Referral ID, referrer ID, and referred ID are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Users can only calculate earnings for their own referrals or admins can calculate any
      if (referrerId !== currentUserId) {
        // TODO: Add admin check here if needed
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const calculation = await referralEarningsService.calculateReferralEarnings(
        referralId,
        referrerId,
        referredId
      );

      logger.info('Referral earnings calculated', {
        referralId,
        referrerId,
        totalEarnings: calculation.totalEarnings,
        isEligible: calculation.eligibility.isEligible,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: calculation
      });

    } catch (error) {
      logger.error('Failed to calculate referral earnings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referralId: req.body.referralId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to calculate referral earnings',
        code: 'EARNINGS_CALCULATION_FAILED'
      });
    }
  };

  /**
   * Process referral bonus payout
   */
  public processReferralPayout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referralId, referrerId, referredId, payoutType, amount, reason, metadata } = req.body;
      const processedBy = req.user?.id;

      if (!processedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referralId || !referrerId || !referredId || !payoutType || !amount || !reason) {
        return res.status(400).json({
          error: 'All required fields must be provided',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const payoutRequest = {
        referralId,
        referrerId,
        referredId,
        payoutType,
        amount: parseFloat(amount),
        reason,
        processedBy,
        metadata
      };

      const result = await referralEarningsService.processReferralPayout(payoutRequest);

      logger.info('Referral payout processed', {
        referralId,
        referrerId,
        payoutId: result.payoutId,
        success: result.success,
        amount: result.amount,
        processedBy
      });

      res.json({
        success: result.success,
        data: result
      });

    } catch (error) {
      logger.error('Failed to process referral payout', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referralId: req.body.referralId,
        processedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to process referral payout',
        code: 'PAYOUT_PROCESSING_FAILED'
      });
    }
  };

  /**
   * Get referral earnings summary for a user
   */
  public getReferralEarningsSummary = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Users can only view their own earnings or admins can view any
      const targetUserId = userId || currentUserId;
      
      if (targetUserId !== currentUserId) {
        // TODO: Add admin check here if needed
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const summary = await referralEarningsService.getReferralEarningsSummary(targetUserId);

      logger.info('Referral earnings summary retrieved', {
        userId: targetUserId,
        totalEarnings: summary.totalEarnings,
        availableBalance: summary.availableBalance,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: summary
      });

    } catch (error) {
      logger.error('Failed to get referral earnings summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral earnings summary',
        code: 'SUMMARY_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Process bulk referral payouts (admin only)
   */
  public processBulkReferralPayouts = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referralIds } = req.body;
      const processedBy = req.user?.id;

      if (!processedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referralIds || !Array.isArray(referralIds) || referralIds.length === 0) {
        return res.status(400).json({
          error: 'Referral IDs array is required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const result = await referralEarningsService.processBulkReferralPayouts(
        referralIds,
        processedBy
      );

      logger.info('Bulk referral payouts processed', {
        totalReferrals: referralIds.length,
        successful: result.successful.length,
        failed: result.failed.length,
        totalAmount: result.totalAmount,
        processedBy
      });

      res.json({
        success: true,
        data: {
          totalReferrals: referralIds.length,
          successful: result.successful,
          failed: result.failed,
          successfulCount: result.successful.length,
          failedCount: result.failed.length,
          totalAmount: result.totalAmount,
          processedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to process bulk referral payouts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referralIds: req.body.referralIds,
        processedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to process bulk referral payouts',
        code: 'BULK_PAYOUT_PROCESSING_FAILED'
      });
    }
  };

  /**
   * Get referral earnings statistics (admin only)
   */
  public getReferralEarningsStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { startDate, endDate, payoutType } = req.query;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // TODO: Add admin check here if needed

      // Get earnings statistics
      const stats = await this.getEarningsStatistics({
        startDate: startDate as string,
        endDate: endDate as string,
        payoutType: payoutType as string
      });

      logger.info('Referral earnings stats retrieved', {
        requestedBy,
        startDate,
        endDate,
        payoutType
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get referral earnings stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral earnings statistics',
        code: 'STATS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get top earners (admin only)
   */
  public getTopEarners = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { limit = 10, period = 'month' } = req.query;
      const requestedBy = req.user?.id;

      if (!requestedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // TODO: Add admin check here if needed

      const topEarners = await this.getTopEarnersData({
        limit: parseInt(limit as string) || 10,
        period: period as string
      });

      logger.info('Top earners retrieved', {
        requestedBy,
        limit: parseInt(limit as string) || 10,
        period
      });

      res.json({
        success: true,
        data: {
          topEarners,
          period,
          limit: parseInt(limit as string) || 10
        }
      });

    } catch (error) {
      logger.error('Failed to get top earners', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve top earners',
        code: 'TOP_EARNERS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get earnings statistics (private method)
   */
  private async getEarningsStatistics(filters: {
    startDate?: string;
    endDate?: string;
    payoutType?: string;
  }): Promise<any> {
    // TODO: Implement earnings statistics logic
    return {
      totalEarnings: 0,
      totalPayouts: 0,
      pendingEarnings: 0,
      averageEarnings: 0,
      topPayoutType: 'points',
      earningsByPeriod: [],
      payoutSuccessRate: 0
    };
  }

  /**
   * Get top earners data (private method)
   */
  private async getTopEarnersData(filters: {
    limit: number;
    period: string;
  }): Promise<any[]> {
    // TODO: Implement top earners logic
    return [];
  }
}

export const referralEarningsController = new ReferralEarningsController();
