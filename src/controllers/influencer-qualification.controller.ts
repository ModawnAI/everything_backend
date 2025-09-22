import { Request, Response, NextFunction } from 'express';
import { influencerQualificationService } from '../services/influencer-qualification.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Influencer Qualification Controller
 * Handles influencer qualification checking, promotion, and management
 */
export class InfluencerQualificationController {
  /**
   * Rate limiting for influencer qualification operations
   */
  public influencerQualificationRateLimit = rateLimit({
    config: {
      max: 20, // 20 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many influencer qualification requests. Please try again later.',
        code: 'INFLUENCER_QUALIFICATION_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Check influencer qualification for a user
   */
  public checkInfluencerQualification = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Users can only check their own qualification or admins can check any
      const targetUserId = userId || currentUserId;
      
      // TODO: Add admin check here if needed
      if (targetUserId !== currentUserId) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const qualificationStatus = await influencerQualificationService.checkInfluencerQualification(targetUserId);

      logger.info('Influencer qualification checked', {
        userId: targetUserId,
        isQualified: qualificationStatus.isQualified,
        isInfluencer: qualificationStatus.isInfluencer,
        totalReferrals: qualificationStatus.totalReferrals,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: qualificationStatus
      });

    } catch (error) {
      logger.error('Failed to check influencer qualification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to check influencer qualification',
        code: 'QUALIFICATION_CHECK_FAILED'
      });
    }
  };

  /**
   * Promote a user to influencer status (admin only)
   */
  public promoteToInfluencer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, reason, manualOverride = false } = req.body;
      const promotedBy = req.user?.id;

      if (!promotedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!userId || !reason) {
        return res.status(400).json({
          error: 'User ID and reason are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      await influencerQualificationService.promoteToInfluencer(
        userId,
        promotedBy,
        reason,
        manualOverride
      );

      logger.info('User promoted to influencer', {
        userId,
        promotedBy,
        reason,
        manualOverride
      });

      res.json({
        success: true,
        message: 'User successfully promoted to influencer',
        data: {
          userId,
          promotedBy,
          reason,
          manualOverride,
          promotedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to promote user to influencer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.body.userId,
        promotedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to promote user to influencer',
        code: 'PROMOTION_FAILED'
      });
    }
  };

  /**
   * Demote a user from influencer status (admin only)
   */
  public demoteFromInfluencer = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId, reason } = req.body;
      const demotedBy = req.user?.id;

      if (!demotedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!userId || !reason) {
        return res.status(400).json({
          error: 'User ID and reason are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      await influencerQualificationService.demoteFromInfluencer(
        userId,
        demotedBy,
        reason
      );

      logger.info('User demoted from influencer', {
        userId,
        demotedBy,
        reason
      });

      res.json({
        success: true,
        message: 'User successfully demoted from influencer',
        data: {
          userId,
          demotedBy,
          reason,
          demotedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to demote user from influencer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.body.userId,
        demotedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to demote user from influencer',
        code: 'DEMOTION_FAILED'
      });
    }
  };

  /**
   * Run automatic influencer promotion process (admin only)
   */
  public runAutoPromotion = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const promotedBy = req.user?.id;

      if (!promotedBy) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const result = await influencerQualificationService.autoPromoteQualifiedUsers();

      logger.info('Automatic influencer promotion completed', {
        promoted: result.promoted.length,
        failed: result.failed.length,
        runBy: promotedBy
      });

      res.json({
        success: true,
        message: 'Automatic promotion process completed',
        data: {
          promoted: result.promoted,
          failed: result.failed,
          promotedCount: result.promoted.length,
          failedCount: result.failed.length,
          runAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to run automatic promotion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        runBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to run automatic promotion process',
        code: 'AUTO_PROMOTION_FAILED'
      });
    }
  };

  /**
   * Get influencer qualification statistics (admin only)
   */
  public getInfluencerQualificationStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await influencerQualificationService.getInfluencerQualificationStats();

      logger.info('Influencer qualification stats retrieved', {
        requestedBy: req.user?.id,
        totalUsers: stats.totalUsers,
        qualifiedUsers: stats.qualifiedUsers,
        influencers: stats.influencers
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get influencer qualification stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve influencer qualification statistics',
        code: 'STATS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Get top performers for influencer qualification (admin only)
   */
  public getTopPerformers = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { limit = 10 } = req.query;
      const stats = await influencerQualificationService.getInfluencerQualificationStats();

      const topPerformers = stats.topPerformers.slice(0, parseInt(limit as string) || 10);

      logger.info('Top performers retrieved', {
        requestedBy: req.user?.id,
        limit: parseInt(limit as string) || 10,
        returnedCount: topPerformers.length
      });

      res.json({
        success: true,
        data: {
          topPerformers,
          totalCount: stats.topPerformers.length,
          limit: parseInt(limit as string) || 10
        }
      });

    } catch (error) {
      logger.error('Failed to get top performers', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve top performers',
        code: 'TOP_PERFORMERS_RETRIEVAL_FAILED'
      });
    }
  };
}

export const influencerQualificationController = new InfluencerQualificationController();

