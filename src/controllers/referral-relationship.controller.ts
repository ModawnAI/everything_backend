import { Request, Response, NextFunction } from 'express';
import { referralRelationshipService } from '../services/referral-relationship.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Referral Relationship Controller
 * Handles referral relationship tracking, validation, and management
 */
export class ReferralRelationshipController {
  /**
   * Rate limiting for referral relationship operations
   */
  public referralRelationshipRateLimit = rateLimit({
    config: {
      max: 30, // 30 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many referral relationship requests. Please try again later.',
        code: 'REFERRAL_RELATIONSHIP_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Create a referral relationship
   */
  public createReferralRelationship = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referredId, referralCode } = req.body;
      const referrerId = req.user?.id;

      if (!referrerId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referredId || !referralCode) {
        return res.status(400).json({
          error: 'Referred user ID and referral code are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      // Validate referral eligibility first
      const validation = await referralRelationshipService.validateReferralEligibility(
        referrerId,
        referredId
      );

      if (!validation.canRefer) {
        return res.status(400).json({
          error: validation.reason || 'Cannot create referral relationship',
          code: validation.errorCode || 'REFERRAL_NOT_ALLOWED',
          details: {
            relationshipDepth: validation.relationshipDepth,
            existingRelationship: validation.existingRelationship
          }
        });
      }

      // Create the relationship
      const relationship = await referralRelationshipService.createReferralRelationship(
        referrerId,
        referredId,
        referralCode
      );

      logger.info('Referral relationship created', {
        relationshipId: relationship.id,
        referrerId,
        referredId,
        relationshipDepth: relationship.relationshipDepth
      });

      res.status(201).json({
        success: true,
        data: {
          relationship,
          message: 'Referral relationship created successfully'
        }
      });

    } catch (error) {
      logger.error('Failed to create referral relationship', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId: req.user?.id,
        referredId: req.body.referredId
      });

      res.status(500).json({
        error: 'Failed to create referral relationship',
        code: 'RELATIONSHIP_CREATION_FAILED'
      });
    }
  };

  /**
   * Validate referral eligibility
   */
  public validateReferralEligibility = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referredId } = req.params;
      const referrerId = req.user?.id;

      if (!referrerId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referredId) {
        return res.status(400).json({
          error: 'Referred user ID is required',
          code: 'MISSING_REFERRED_USER_ID'
        });
      }

      const validation = await referralRelationshipService.validateReferralEligibility(
        referrerId,
        referredId
      );

      logger.info('Referral eligibility validated', {
        referrerId,
        referredId,
        canRefer: validation.canRefer,
        reason: validation.reason
      });

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.error('Failed to validate referral eligibility', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId: req.user?.id,
        referredId: req.params.referredId
      });

      res.status(500).json({
        error: 'Failed to validate referral eligibility',
        code: 'VALIDATION_FAILED'
      });
    }
  };

  /**
   * Get referral chain for a user
   */
  public getReferralChain = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      // Users can only view their own referral chain or admins can view any
      const targetUserId = userId || currentUserId;
      
      // TODO: Add admin check here if needed
      if (targetUserId !== currentUserId) {
        return res.status(403).json({
          error: 'Access denied',
          code: 'ACCESS_DENIED'
        });
      }

      const chain = await referralRelationshipService.getReferralChain(targetUserId);

      logger.info('Referral chain retrieved', {
        userId: targetUserId,
        chainLength: chain.length,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: {
          chain,
          totalLevels: chain.length,
          maxDepth: Math.max(...chain.map(c => c.level), 0)
        }
      });

    } catch (error) {
      logger.error('Failed to get referral chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.params.userId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to get referral chain',
        code: 'CHAIN_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Check for circular references
   */
  public checkCircularReference = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { referrerId, referredId } = req.body;
      const currentUserId = req.user?.id;

      if (!currentUserId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      if (!referrerId || !referredId) {
        return res.status(400).json({
          error: 'Referrer ID and referred ID are required',
          code: 'MISSING_REQUIRED_FIELDS'
        });
      }

      const circularCheck = await referralRelationshipService.checkCircularReference(
        referrerId,
        referredId
      );

      logger.info('Circular reference check completed', {
        referrerId,
        referredId,
        hasCircularReference: circularCheck.hasCircularReference,
        depth: circularCheck.depth,
        requestedBy: currentUserId
      });

      res.json({
        success: true,
        data: circularCheck
      });

    } catch (error) {
      logger.error('Failed to check circular reference', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId: req.body.referrerId,
        referredId: req.body.referredId,
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to check circular reference',
        code: 'CIRCULAR_CHECK_FAILED'
      });
    }
  };

  /**
   * Get referral relationship statistics (admin only)
   */
  public getReferralRelationshipStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await referralRelationshipService.getReferralRelationshipStats();

      logger.info('Referral relationship stats retrieved', {
        requestedBy: req.user?.id,
        totalRelationships: stats.totalRelationships,
        activeRelationships: stats.activeRelationships
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get referral relationship stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral relationship statistics',
        code: 'STATS_RETRIEVAL_FAILED'
      });
    }
  };
}

export const referralRelationshipController = new ReferralRelationshipController();
