import { Request, Response, NextFunction } from 'express';
import { referralCodeService } from '../services/referral-code.service';
import { logger } from '../utils/logger';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Referral Code Controller
 * Handles referral code generation, validation, and management
 */
export class ReferralCodeController {
  /**
   * Rate limiting for referral code operations
   */
  public referralCodeRateLimit = rateLimit({
    config: {
      max: 20, // 20 requests per 15 minutes
      windowMs: 15 * 60 * 1000,
      strategy: 'sliding_window',
      scope: 'ip',
      enableHeaders: true,
      message: {
        error: 'Too many referral code requests. Please try again later.',
        code: 'REFERRAL_CODE_RATE_LIMIT_EXCEEDED'
      }
    }
  });

  /**
   * Generate a new referral code for the authenticated user
   */
  public generateReferralCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          code: 'AUTHENTICATION_REQUIRED'
        });
      }

      const { 
        length = 8,
        excludeSimilar = true,
        excludeProfanity = true 
      } = req.body;

      const code = await referralCodeService.generateReferralCode({
        length,
        excludeSimilar,
        excludeProfanity,
        maxAttempts: 50
      });

      logger.info('Referral code generated for user', {
        userId,
        code,
        length,
        excludeSimilar,
        excludeProfanity
      });

      res.json({
        success: true,
        data: {
          code,
          length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to generate referral code', {
        userId: req.user?.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to generate referral code',
        code: 'REFERRAL_CODE_GENERATION_FAILED'
      });
    }
  };

  /**
   * Validate a referral code
   */
  public validateReferralCode = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { code } = req.params;

      if (!code) {
        return res.status(400).json({
          error: 'Referral code is required',
          code: 'MISSING_REFERRAL_CODE'
        });
      }

      // Validate code format
      if (code.length < 4 || code.length > 12) {
        return res.status(400).json({
          error: 'Referral code must be between 4 and 12 characters',
          code: 'INVALID_REFERRAL_CODE_LENGTH'
        });
      }

      if (!/^[A-Z0-9]+$/.test(code)) {
        return res.status(400).json({
          error: 'Referral code must contain only uppercase letters and numbers',
          code: 'INVALID_REFERRAL_CODE_FORMAT'
        });
      }

      const result = await referralCodeService.validateReferralCode(code);

      logger.info('Referral code validation', {
        code,
        isValid: result.isValid,
        referrerId: result.referrerId,
        requestedBy: req.user?.id
      });

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Failed to validate referral code', {
        code: req.params.code,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        error: 'Failed to validate referral code',
        code: 'REFERRAL_CODE_VALIDATION_FAILED'
      });
    }
  };

  /**
   * Batch generate referral codes (admin only)
   */
  public batchGenerateReferralCodes = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { count = 10, options = {} } = req.body;

      if (count > 100) {
        return res.status(400).json({
          error: 'Maximum 100 codes can be generated at once',
          code: 'BATCH_SIZE_EXCEEDED'
        });
      }

      const codes = await referralCodeService.batchGenerateReferralCodes(count, options);

      logger.info('Batch referral codes generated', {
        requested: count,
        generated: codes.length,
        requestedBy: req.user?.id
      });

      res.json({
        success: true,
        data: {
          codes,
          count: codes.length,
          generatedAt: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to batch generate referral codes', {
        count: req.body.count,
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to batch generate referral codes',
        code: 'BATCH_GENERATION_FAILED'
      });
    }
  };

  /**
   * Get referral code statistics (admin only)
   */
  public getReferralCodeStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const stats = await referralCodeService.getReferralCodeStats();

      logger.info('Referral code stats retrieved', {
        requestedBy: req.user?.id,
        totalCodes: stats.totalCodes,
        activeCodes: stats.activeCodes
      });

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Failed to get referral code stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to retrieve referral code statistics',
        code: 'STATS_RETRIEVAL_FAILED'
      });
    }
  };

  /**
   * Clear referral code cache (admin only)
   */
  public clearReferralCodeCache = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      referralCodeService.clearCache();

      logger.info('Referral code cache cleared', {
        requestedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'Referral code cache cleared successfully'
      });

    } catch (error) {
      logger.error('Failed to clear referral code cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to clear referral code cache',
        code: 'CACHE_CLEAR_FAILED'
      });
    }
  };

  /**
   * Reset referral code generation statistics (admin only)
   */
  public resetReferralCodeStats = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      referralCodeService.resetStats();

      logger.info('Referral code generation statistics reset', {
        requestedBy: req.user?.id
      });

      res.json({
        success: true,
        message: 'Referral code generation statistics reset successfully'
      });

    } catch (error) {
      logger.error('Failed to reset referral code stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestedBy: req.user?.id
      });

      res.status(500).json({
        error: 'Failed to reset referral code statistics',
        code: 'STATS_RESET_FAILED'
      });
    }
  };
}

export const referralCodeController = new ReferralCodeController();
