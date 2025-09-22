/**
 * Feed Security Middleware
 * 
 * Specialized security middleware for social feed operations
 * Includes content moderation, spam detection, and rate limiting
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { contentModerationService } from '../services/content-moderation.service';
// import { validateWithModeration, validateRateLimit } from '../validators/feed.validators';
import { AuthenticatedRequest } from './auth.middleware';

export interface FeedSecurityContext {
  userId: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

export interface UserActivityStats {
  postsToday: number;
  commentsToday: number;
  likesToday: number;
  reportsToday: number;
}

/**
 * Content moderation middleware for feed posts and comments
 */
export function contentModerationMiddleware(contentType: 'post' | 'comment' = 'post') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate with enhanced moderation
      // const validation = await validateWithModeration(req.body, contentType);
      // 
      // if (validation.error) {
      //   logger.warn('Content moderation validation failed', {
      //     userId,
      //     endpoint: req.path,
      //     errors: validation.error.details,
      //     content: req.body.content?.substring(0, 100) + '...'
      //   });

      //   res.status(400).json({
      //     error: 'Content validation failed',
      //     details: validation.error.details.map(detail => ({
      //       field: detail.path.join('.'),
      //       message: detail.message
      //     }))
      //   });
      //   return;
      // }

      // Additional content analysis for posts
      if (contentType === 'post' && req.body.content) {
        const analysisResult = await contentModerationService.analyzeContent(
          req.body.content,
          'profile_content'
        );

        // Block content with high severity violations
        if (!analysisResult.isAppropriate && analysisResult.severity === 'critical') {
          logger.error('Critical content violation detected', {
            userId,
            endpoint: req.path,
            violations: analysisResult.violations,
            score: analysisResult.score
          });

          res.status(400).json({
            error: 'Content violates community guidelines',
            reason: 'inappropriate_content',
            details: analysisResult.violations.map(v => ({
              type: v.type,
              severity: v.severity,
              description: v.description
            }))
          });
          return;
        }

        // Flag content for review if needed
        if (analysisResult.suggestedAction === 'review') {
          logger.info('Content flagged for manual review', {
            userId,
            endpoint: req.path,
            score: analysisResult.score,
            violations: analysisResult.violations
          });
          
          // Add flag to request for downstream processing
          (req as any).moderationFlag = {
            requiresReview: true,
            score: analysisResult.score,
            violations: analysisResult.violations
          };
        }
      }

      // Update sanitized content
      // req.body = validation.value;
      next();

    } catch (error) {
      logger.error('Content moderation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path
      });
      
      res.status(500).json({ error: 'Content validation failed' });
    }
  };
}

/**
 * Rate limiting middleware for feed operations
 */
export function feedRateLimitMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Get user activity stats (this would typically come from a cache or database)
      const userActivity: UserActivityStats = await getUserActivityStats(userId);

      // Validate rate limits
      // const rateLimitResult = validateRateLimit(userActivity);
      // 
      // if (!rateLimitResult.isValid) {
      //   logger.warn('Rate limit exceeded', {
      //     userId,
      //     endpoint: req.path,
      //     violations: rateLimitResult.violations,
      //     activity: userActivity
      //   });

      //   res.status(429).json({
      //     error: 'Rate limit exceeded',
      //     message: 'You have exceeded the daily limit for this action',
      //     violations: rateLimitResult.violations,
      //     limits: rateLimitResult.limits,
      //     resetTime: getNextResetTime()
      //   });
      //   return;
      // }

      next();

    } catch (error) {
      logger.error('Feed rate limit middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path
      });
      
      // Don't block on rate limit errors, just log and continue
      next();
    }
  };
}

/**
 * Spam detection middleware
 */
export function spamDetectionMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = (req as AuthenticatedRequest).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const content = req.body.content;
      if (!content || typeof content !== 'string') {
        next();
        return;
      }

      // Check for spam patterns
      const spamIndicators = [
        /(.)\1{15,}/gi, // Excessive character repetition
        /(http[s]?:\/\/[^\s]+){4,}/gi, // Multiple URLs
        /\b(buy now|click here|limited time|act now|don't miss|urgent|free money|make money fast)\b/gi,
        /\b(지금 구매|클릭하세요|한정 시간|놓치지 마세요|긴급|무료 돈|빨리 돈벌기)\b/gi
      ];

      let spamScore = 0;
      for (const pattern of spamIndicators) {
        if (pattern.test(content)) {
          spamScore++;
        }
      }

      // Check for excessive emoji usage
      const emojiCount = (content.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]/gu) || []).length;
      if (emojiCount > content.length * 0.3) {
        spamScore++;
      }

      // Block if spam score is too high
      if (spamScore >= 3) {
        logger.warn('Spam content detected', {
          userId,
          endpoint: req.path,
          spamScore,
          contentLength: content.length,
          emojiCount
        });

        res.status(400).json({
          error: 'Content appears to be spam',
          reason: 'spam_detected',
          message: 'Your content has been flagged as potential spam. Please review and try again.'
        });
        return;
      }

      // Flag for review if moderate spam score
      if (spamScore >= 2) {
        (req as any).spamFlag = {
          score: spamScore,
          requiresReview: true
        };
      }

      next();

    } catch (error) {
      logger.error('Spam detection middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path
      });
      
      // Don't block on spam detection errors, just log and continue
      next();
    }
  };
}

/**
 * Image security validation middleware
 */
export function imageSecurityMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const files = (req as any).files;
      if (!files || !Array.isArray(files) || files.length === 0) {
        next();
        return;
      }

      const userId = (req as AuthenticatedRequest).user?.id;
      
      for (const file of files) {
        // Validate file type
        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!allowedMimeTypes.includes(file.mimetype)) {
          res.status(400).json({
            error: 'Invalid file type',
            message: 'Only JPEG, PNG, and WebP images are allowed'
          });
          return;
        }

        // Validate file size (8MB limit)
        if (file.size > 8 * 1024 * 1024) {
          res.status(400).json({
            error: 'File too large',
            message: 'Image files must be smaller than 8MB'
          });
          return;
        }

        // Check for suspicious file names
        const suspiciousPatterns = [
          /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|jsp)$/i,
          /[<>:"|?*]/,
          /^\./,
          /\.{2,}/
        ];

        for (const pattern of suspiciousPatterns) {
          if (pattern.test(file.originalname)) {
            logger.warn('Suspicious file name detected', {
              userId,
              fileName: file.originalname,
              endpoint: req.path
            });

            res.status(400).json({
              error: 'Invalid file name',
              message: 'File name contains invalid characters'
            });
            return;
          }
        }
      }

      next();

    } catch (error) {
      logger.error('Image security middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as AuthenticatedRequest).user?.id,
        endpoint: req.path
      });
      
      res.status(500).json({ error: 'File validation failed' });
    }
  };
}

/**
 * Helper function to get user activity stats
 */
async function getUserActivityStats(userId: string): Promise<UserActivityStats> {
  // This would typically query the database or cache
  // For now, return mock data - implement actual logic based on your database schema
  return {
    postsToday: 0,
    commentsToday: 0,
    likesToday: 0,
    reportsToday: 0
  };
}

/**
 * Helper function to get next rate limit reset time
 */
function getNextResetTime(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  return tomorrow;
}

/**
 * Comprehensive feed security middleware
 */
export function feedSecurityMiddleware() {
  return [
    contentModerationMiddleware('post'),
    spamDetectionMiddleware(),
    feedRateLimitMiddleware()
  ];
}

/**
 * Comment security middleware
 */
export function commentSecurityMiddleware() {
  return [
    contentModerationMiddleware('comment'),
    spamDetectionMiddleware(),
    feedRateLimitMiddleware()
  ];
}

