/**
 * Spam Detection and Rate Limiting Integration Middleware
 * 
 * Combines advanced spam detection with adaptive rate limiting for comprehensive
 * protection against abuse, spam, and system overload.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { spamDetectionService } from '../services/spam-detection.service';
import { adaptiveRateLimitService } from '../services/adaptive-rate-limit.service';
import { AuthenticatedRequest } from './auth.middleware';
import { ValidationError } from './validation.middleware';

export interface SpamRateLimitConfig {
  enableSpamDetection: boolean;
  enableAdaptiveRateLimit: boolean;
  enableBehavioralAnalysis: boolean;
  enableContentAnalysis: boolean;
  
  // Action thresholds
  warnThreshold: number;     // 0-100, spam score for warnings
  throttleThreshold: number; // 0-100, spam score for throttling
  blockThreshold: number;    // 0-100, spam score for blocking
  
  // Rate limiting
  baseRateLimit: {
    windowMs: number;
    max: number;
  };
  
  // Content type specific settings
  contentTypeSettings: {
    [key: string]: {
      spamThreshold: number;
      rateLimitMultiplier: number;
      enableBehavioralCheck: boolean;
    };
  };
  
  // Response configuration
  includeSpamAnalysis: boolean; // Include spam analysis in response (for debugging)
  includeRateLimitReasoning: boolean; // Include rate limit reasoning
}

export interface SpamRateLimitResult {
  allowed: boolean;
  spamAnalysis?: any;
  rateLimitResult?: any;
  action: 'allow' | 'warn' | 'throttle' | 'block' | 'quarantine';
  message: string;
  recommendations?: string[];
  retryAfter?: number;
  metadata: {
    spamScore: number;
    trustLevel: string;
    appliedMultiplier: number;
    reasoning: string[];
  };
}

class SpamRateLimitMiddleware {
  private config: SpamRateLimitConfig;

  constructor(config?: Partial<SpamRateLimitConfig>) {
    this.config = {
      enableSpamDetection: true,
      enableAdaptiveRateLimit: true,
      enableBehavioralAnalysis: true,
      enableContentAnalysis: true,
      warnThreshold: 40,
      throttleThreshold: 60,
      blockThreshold: 80,
      baseRateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100
      },
      contentTypeSettings: {
        post: {
          spamThreshold: 60,
          rateLimitMultiplier: 1.0,
          enableBehavioralCheck: true
        },
        comment: {
          spamThreshold: 50, // Stricter for comments
          rateLimitMultiplier: 1.2,
          enableBehavioralCheck: true
        },
        like: {
          spamThreshold: 70,
          rateLimitMultiplier: 2.0, // More lenient for likes
          enableBehavioralCheck: false
        },
        report: {
          spamThreshold: 30, // Very strict for reports
          rateLimitMultiplier: 0.5,
          enableBehavioralCheck: true
        },
        upload: {
          spamThreshold: 70,
          rateLimitMultiplier: 0.3, // Very restrictive for uploads
          enableBehavioralCheck: true
        }
      },
      includeSpamAnalysis: false,
      includeRateLimitReasoning: false,
      ...config
    };
  }

  /**
   * Main middleware function for spam detection and rate limiting
   */
  public middleware(contentType: string = 'general') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for spam and rate limit protection',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Perform comprehensive analysis
        const result = await this.performAnalysis(req, userId, contentType);

        // Handle the result
        if (!result.allowed) {
          this.handleBlocked(res, result);
          return;
        }

        // Add analysis results to request for downstream processing
        (req as any).spamAnalysis = result.spamAnalysis;
        (req as any).rateLimitResult = result.rateLimitResult;
        (req as any).spamRateLimitMetadata = result.metadata;

        // Add warnings to response headers if needed
        if (result.action === 'warn' && result.recommendations) {
          res.set('X-Content-Warning', result.recommendations.join('; '));
        }

        next();

      } catch (error) {
        logger.error('Spam rate limit middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: (req as AuthenticatedRequest).user?.id,
          path: req.path,
          method: req.method,
          contentType
        });

        // Fail securely - block on error
        res.status(429).json({
          success: false,
          error: {
            code: 'SECURITY_CHECK_FAILED',
            message: 'Security validation failed. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Perform comprehensive spam and rate limit analysis
   */
  private async performAnalysis(
    req: Request,
    userId: string,
    contentType: string
  ): Promise<SpamRateLimitResult> {
    let spamAnalysis: any = null;
    let rateLimitResult: any = null;
    let finalAction: 'allow' | 'warn' | 'throttle' | 'block' | 'quarantine' = 'allow';
    let message = 'Request allowed';
    let recommendations: string[] = [];
    let retryAfter: number | undefined;

    // Get content type settings
    const contentSettings = this.config.contentTypeSettings[contentType] || 
                           this.config.contentTypeSettings.post;

    // 1. Spam Detection Analysis
    if (this.config.enableSpamDetection && req.body) {
      spamAnalysis = await this.performSpamAnalysis(req, userId, contentType);
      
      if (spamAnalysis.spamScore >= this.config.blockThreshold) {
        finalAction = 'block';
        message = 'Content blocked due to spam detection';
        recommendations = spamAnalysis.recommendations || [];
      } else if (spamAnalysis.spamScore >= this.config.throttleThreshold) {
        finalAction = 'throttle';
        message = 'Content flagged for review';
        recommendations = spamAnalysis.recommendations || [];
      } else if (spamAnalysis.spamScore >= this.config.warnThreshold) {
        finalAction = 'warn';
        message = 'Content may need review';
        recommendations = spamAnalysis.recommendations || [];
      }
    }

    // 2. Adaptive Rate Limiting
    if (this.config.enableAdaptiveRateLimit) {
      rateLimitResult = await this.performRateLimitCheck(userId, contentType, spamAnalysis?.spamScore || 0);
      
      if (!rateLimitResult.allowed) {
        finalAction = 'throttle';
        message = 'Rate limit exceeded';
        retryAfter = rateLimitResult.retryAfter;
      }
    }

    // 3. Determine final action (most restrictive wins)
    const actionPriority = { allow: 0, warn: 1, throttle: 2, quarantine: 3, block: 4 };
    if (spamAnalysis?.suggestedAction && 
        actionPriority[spamAnalysis.suggestedAction] > actionPriority[finalAction]) {
      finalAction = spamAnalysis.suggestedAction;
    }

    // 4. Update user profiles based on analysis
    await this.updateUserProfiles(userId, spamAnalysis, rateLimitResult, finalAction);

    return {
      allowed: finalAction === 'allow' || finalAction === 'warn',
      spamAnalysis: this.config.includeSpamAnalysis ? spamAnalysis : undefined,
      rateLimitResult: this.config.includeRateLimitReasoning ? rateLimitResult : undefined,
      action: finalAction,
      message,
      recommendations: recommendations.length > 0 ? recommendations : undefined,
      retryAfter,
      metadata: {
        spamScore: spamAnalysis?.spamScore || 0,
        trustLevel: rateLimitResult?.trustLevel || 'unknown',
        appliedMultiplier: rateLimitResult?.appliedMultiplier || 1.0,
        reasoning: [
          ...(spamAnalysis?.detectedPatterns?.map((p: any) => `Spam: ${p.type}`) || []),
          ...(rateLimitResult?.reasoning || [])
        ]
      }
    };
  }

  /**
   * Perform spam analysis on content
   */
  private async performSpamAnalysis(req: Request, userId: string, contentType: string): Promise<any> {
    try {
      const content = {
        text: req.body.content || req.body.text || '',
        userId,
        contentType: contentType as 'post' | 'comment',
        metadata: {
          images: req.body.images,
          hashtags: req.body.hashtags,
          mentions: req.body.mentions,
          location: req.body.location_tag
        }
      };

      return await spamDetectionService.analyzeContent(content);
    } catch (error) {
      logger.warn('Spam analysis failed', { userId, contentType, error });
      return {
        isSpam: false,
        spamScore: 0,
        suggestedAction: 'allow',
        recommendations: []
      };
    }
  }

  /**
   * Perform adaptive rate limit check
   */
  private async performRateLimitCheck(
    userId: string, 
    contentType: string, 
    spamScore: number
  ): Promise<any> {
    try {
      const baseConfig = {
        ...this.config.baseRateLimit,
        strategy: 'sliding_window' as const,
        scope: 'user' as const,
        enableHeaders: true,
        message: 'Rate limit exceeded'
      };

      const adaptiveResult = await adaptiveRateLimitService.calculateAdaptiveRateLimit(
        userId,
        contentType as any,
        baseConfig
      );

      // Simulate rate limit check (in real implementation, this would check actual usage)
      const allowed = true; // Placeholder - implement actual rate limiting logic
      const retryAfter = allowed ? 0 : Math.ceil(adaptiveResult.config.windowMs / 1000);

      return {
        allowed,
        retryAfter,
        limit: adaptiveResult.config.max,
        remaining: adaptiveResult.config.max - 1, // Placeholder
        resetTime: new Date(Date.now() + adaptiveResult.config.windowMs),
        appliedMultiplier: adaptiveResult.appliedMultiplier,
        reasoning: adaptiveResult.reasoning,
        trustLevel: adaptiveResult.trustProfile.trustLevel
      };
    } catch (error) {
      logger.warn('Rate limit check failed', { userId, contentType, error });
      return {
        allowed: true,
        appliedMultiplier: 1.0,
        reasoning: ['Rate limit check failed - allowing by default'],
        trustLevel: 'unknown'
      };
    }
  }

  /**
   * Update user profiles based on analysis results
   */
  private async updateUserProfiles(
    userId: string,
    spamAnalysis: any,
    rateLimitResult: any,
    finalAction: string
  ): Promise<void> {
    try {
      // Update spam score if analysis was performed
      if (spamAnalysis && typeof spamAnalysis.spamScore === 'number') {
        await spamDetectionService.updateUserSpamScore(userId, spamAnalysis.spamScore);
      }

      // Record interaction result
      if (finalAction === 'allow' || finalAction === 'warn') {
        await adaptiveRateLimitService.recordSuccessfulInteraction(userId, 'content_creation');
      } else if (finalAction === 'throttle' || finalAction === 'block') {
        await adaptiveRateLimitService.recordViolation(userId, {
          endpoint: 'content_creation',
          limit: rateLimitResult?.limit || 100,
          actual: rateLimitResult?.limit || 101,
          windowMs: rateLimitResult?.config?.windowMs || 900000
        });
      }
    } catch (error) {
      logger.warn('Failed to update user profiles', { userId, error });
    }
  }

  /**
   * Handle blocked requests
   */
  private handleBlocked(res: Response, result: SpamRateLimitResult): void {
    const statusCode = this.getStatusCodeForAction(result.action);
    
    const response: any = {
      success: false,
      error: {
        code: this.getErrorCodeForAction(result.action),
        message: result.message,
        action: result.action,
        timestamp: new Date().toISOString()
      }
    };

    // Add recommendations if available
    if (result.recommendations && result.recommendations.length > 0) {
      response.error.recommendations = result.recommendations;
    }

    // Add retry information for rate limiting
    if (result.retryAfter) {
      response.error.retryAfter = result.retryAfter;
      response.error.retryAt = new Date(Date.now() + (result.retryAfter * 1000)).toISOString();
      res.set('Retry-After', result.retryAfter.toString());
    }

    // Add metadata for debugging (if enabled)
    if (this.config.includeSpamAnalysis || this.config.includeRateLimitReasoning) {
      response.debug = {
        spamScore: result.metadata.spamScore,
        trustLevel: result.metadata.trustLevel,
        appliedMultiplier: result.metadata.appliedMultiplier,
        reasoning: result.metadata.reasoning
      };
    }

    res.status(statusCode).json(response);
  }

  /**
   * Get HTTP status code for action
   */
  private getStatusCodeForAction(action: string): number {
    switch (action) {
      case 'warn': return 200; // Allow but with warnings
      case 'throttle': return 429; // Too Many Requests
      case 'block': return 403; // Forbidden
      case 'quarantine': return 403; // Forbidden
      default: return 200;
    }
  }

  /**
   * Get error code for action
   */
  private getErrorCodeForAction(action: string): string {
    switch (action) {
      case 'warn': return 'CONTENT_WARNING';
      case 'throttle': return 'RATE_LIMIT_EXCEEDED';
      case 'block': return 'CONTENT_BLOCKED';
      case 'quarantine': return 'CONTENT_QUARANTINED';
      default: return 'UNKNOWN_ACTION';
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<SpamRateLimitConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Export convenience functions for different content types
export function createPostSpamRateLimit(config?: Partial<SpamRateLimitConfig>) {
  const middleware = new SpamRateLimitMiddleware({
    ...config,
    contentTypeSettings: {
      ...config?.contentTypeSettings,
      post: {
        spamThreshold: 60,
        rateLimitMultiplier: 1.0,
        enableBehavioralCheck: true,
        ...config?.contentTypeSettings?.post
      }
    }
  });
  return middleware.middleware('post');
}

export function createCommentSpamRateLimit(config?: Partial<SpamRateLimitConfig>) {
  const middleware = new SpamRateLimitMiddleware({
    ...config,
    contentTypeSettings: {
      ...config?.contentTypeSettings,
      comment: {
        spamThreshold: 50,
        rateLimitMultiplier: 1.2,
        enableBehavioralCheck: true,
        ...config?.contentTypeSettings?.comment
      }
    }
  });
  return middleware.middleware('comment');
}

export function createUploadSpamRateLimit(config?: Partial<SpamRateLimitConfig>) {
  const middleware = new SpamRateLimitMiddleware({
    ...config,
    contentTypeSettings: {
      ...config?.contentTypeSettings,
      upload: {
        spamThreshold: 70,
        rateLimitMultiplier: 0.3,
        enableBehavioralCheck: true,
        ...config?.contentTypeSettings?.upload
      }
    }
  });
  return middleware.middleware('upload');
}

export { SpamRateLimitMiddleware };
