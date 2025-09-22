/**
 * Content Validation Middleware
 * 
 * Comprehensive content validation middleware for social feed and other content types.
 * Extends existing validation patterns with enhanced image validation, size limits,
 * and configurable content rules.
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import { contentModerationService } from '../services/content-moderation.service';
import { contentModerator } from '../services/content-moderator.service';
import { hashtagValidationService } from '../services/hashtag-validation.service';
import { profanityFilterService } from '../services/profanity-filter.service';
import { AuthenticatedRequest } from './auth.middleware';
import { ValidationError, RequestValidationError } from './validation.middleware';

export interface ContentValidationConfig {
  // Content limits
  maxContentLength: number; // Default: 2000 characters
  maxHashtags: number; // Default: 10
  maxImages: number; // Default: 10
  
  // Image validation
  maxImageSize: number; // Default: 8MB in bytes
  allowedImageTypes: string[]; // Default: ['image/jpeg', 'image/png', 'image/webp']
  maxImageDimensions: { width: number; height: number }; // Default: 4096x4096
  
  // Security settings
  enableProfanityFilter: boolean; // Default: true
  enableSpamDetection: boolean; // Default: true
  enableModerationAnalysis: boolean; // Default: true
  enableImageAnalysis: boolean; // Default: true
  
  // Rate limiting (per user per day)
  maxPostsPerDay: number; // Default: 10
  maxCommentsPerDay: number; // Default: 100
  maxLikesPerDay: number; // Default: 500
  maxReportsPerDay: number; // Default: 20
  
  // Content type specific settings
  contentType: 'post' | 'comment' | 'profile' | 'general';
  
  // Moderation thresholds
  blockThreshold: number; // Default: 85 (0-100 scale)
  reviewThreshold: number; // Default: 70 (0-100 scale)
}

export interface ContentValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  moderationFlags?: {
    requiresReview: boolean;
    score: number;
    violations: any[];
  };
  spamFlags?: {
    score: number;
    requiresReview: boolean;
  };
  sanitizedContent?: any;
}

export interface ImageValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  metadata?: {
    width: number;
    height: number;
    format: string;
    size: number;
    hasTransparency?: boolean;
  };
}

export class ContentValidationMiddleware {
  private config: ContentValidationConfig;

  constructor(config?: Partial<ContentValidationConfig>) {
    this.config = {
      // Default configuration
      maxContentLength: 2000,
      maxHashtags: 10,
      maxImages: 10,
      maxImageSize: 8 * 1024 * 1024, // 8MB
      allowedImageTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      maxImageDimensions: { width: 4096, height: 4096 },
      enableProfanityFilter: true,
      enableSpamDetection: true,
      enableModerationAnalysis: true,
      enableImageAnalysis: true,
      maxPostsPerDay: 10,
      maxCommentsPerDay: 100,
      maxLikesPerDay: 500,
      maxReportsPerDay: 20,
      contentType: 'general',
      blockThreshold: 85,
      reviewThreshold: 70,
      ...config
    };
  }

  /**
   * Main content validation middleware
   */
  public validateContent(schema?: Joi.Schema) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for content validation',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Validate request body with Joi schema if provided
        if (schema) {
          const { error, value } = schema.validate(req.body, {
            abortEarly: false,
            stripUnknown: true,
            allowUnknown: false
          });

          if (error) {
            const validationErrors: ValidationError[] = error.details.map(detail => ({
              field: detail.path.join('.'),
              message: detail.message,
              value: detail.context?.value
            }));

            logger.warn('Content schema validation failed', {
              userId,
              errors: validationErrors,
              path: req.path,
              method: req.method,
              contentType: this.config.contentType
            });

            res.status(400).json({
              success: false,
              error: {
                code: 'VALIDATION_ERROR',
                message: 'Content validation failed',
                details: validationErrors,
                timestamp: new Date().toISOString()
              }
            });
            return;
          }

          req.body = value;
        }

        // Perform comprehensive content validation
        const validationResult = await this.performContentValidation(req);

        if (!validationResult.isValid) {
          logger.warn('Content validation failed', {
            userId,
            errors: validationResult.errors,
            warnings: validationResult.warnings,
            path: req.path,
            contentType: this.config.contentType
          });

          res.status(400).json({
            success: false,
            error: {
              code: 'CONTENT_VALIDATION_ERROR',
              message: 'Content does not meet validation requirements',
              details: validationResult.errors,
              warnings: validationResult.warnings,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Add validation flags to request for downstream processing
        if (validationResult.moderationFlags) {
          (req as any).moderationFlags = validationResult.moderationFlags;
        }
        if (validationResult.spamFlags) {
          (req as any).spamFlags = validationResult.spamFlags;
        }

        // Update request body with sanitized content
        if (validationResult.sanitizedContent) {
          req.body = { ...req.body, ...validationResult.sanitizedContent };
        }

        next();

      } catch (error) {
        logger.error('Content validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: (req as AuthenticatedRequest).user?.id,
          path: req.path,
          method: req.method,
          contentType: this.config.contentType
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Content validation error occurred',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Image validation middleware for file uploads
   */
  public validateImages() {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const files = (req as any).files;
        if (!files || !Array.isArray(files) || files.length === 0) {
          next();
          return;
        }

        const userId = (req as AuthenticatedRequest).user?.id;
        
        // Validate number of images
        if (files.length > this.config.maxImages) {
          res.status(400).json({
            success: false,
            error: {
              code: 'TOO_MANY_IMAGES',
              message: `Maximum ${this.config.maxImages} images allowed`,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Validate each image
        for (let i = 0; i < files.length; i++) {
          const file = files[i];
          const imageValidation = await this.validateSingleImage(file);

          if (!imageValidation.isValid) {
            logger.warn('Image validation failed', {
              userId,
              fileName: file.originalname,
              errors: imageValidation.errors,
              path: req.path
            });

            res.status(400).json({
              success: false,
              error: {
                code: 'IMAGE_VALIDATION_ERROR',
                message: `Image ${i + 1} validation failed`,
                details: imageValidation.errors,
                timestamp: new Date().toISOString()
              }
            });
            return;
          }

          // Add metadata to file object
          if (imageValidation.metadata) {
            file.metadata = imageValidation.metadata;
          }
        }

        next();

      } catch (error) {
        logger.error('Image validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          userId: (req as AuthenticatedRequest).user?.id,
          path: req.path
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Image validation error occurred',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Perform comprehensive content validation
   */
  private async performContentValidation(req: Request): Promise<ContentValidationResult> {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    let moderationFlags: any = undefined;
    let spamFlags: any = undefined;
    const sanitizedContent: any = {};

    const { content, hashtags, images } = req.body;

    // Content length validation
    if (content && typeof content === 'string') {
      if (content.length > this.config.maxContentLength) {
        errors.push({
          field: 'content',
          message: `Content exceeds maximum length of ${this.config.maxContentLength} characters`,
          value: content.length
        });
      }

      // Enhanced profanity filtering
      if (this.config.enableProfanityFilter) {
        const profanityAnalysis = await profanityFilterService.analyzeProfanity(content);
        if (!profanityAnalysis.isClean && profanityAnalysis.severity !== 'none') {
          const severityLevel = this.getSeverityLevel(profanityAnalysis.severity);
          const blockThreshold = this.config.contentType === 'comment' ? 2 : 3; // Stricter for comments
          
          if (severityLevel >= blockThreshold) {
            errors.push({
              field: 'content',
              message: `Content contains ${profanityAnalysis.severity} inappropriate language`,
              value: profanityAnalysis.detectedWords.map(w => w.category)
            });
          } else {
            warnings.push({
              field: 'content',
              message: 'Content may contain mild inappropriate language',
              value: profanityAnalysis.suggestions
            });
          }
          
          // Use cleaned text if available
          if (profanityAnalysis.cleanedText !== content) {
            sanitizedContent.content = profanityAnalysis.cleanedText;
          }
        }
      }

      // Spam detection
      if (this.config.enableSpamDetection) {
        const spamResult = this.detectSpam(content);
        if (spamResult.isSpam) {
          errors.push({
            field: 'content',
            message: 'Content appears to be spam',
            value: spamResult.indicators
          });
        } else if (spamResult.score > 0) {
          spamFlags = {
            score: spamResult.score,
            requiresReview: spamResult.score >= 2
          };
        }
      }

      // Content moderation analysis
      if (this.config.enableModerationAnalysis) {
        try {
          let analysisResult;
          
          if (this.config.contentType === 'post') {
            // Use feed-specific moderation for posts
            analysisResult = await contentModerator.analyzeFeedPost({
              content,
              hashtags: req.body.hashtags,
              images: req.body.images,
              location_tag: req.body.location_tag,
              category: req.body.category
            });
          } else if (this.config.contentType === 'comment') {
            // Use feed-specific moderation for comments
            analysisResult = await contentModerator.analyzeComment(content);
          } else {
            // Use general content moderation for other types
            analysisResult = await contentModerationService.analyzeContent(content, 'profile_content');
          }

          if (analysisResult.score >= this.config.blockThreshold) {
            errors.push({
              field: 'content',
              message: 'Content violates community guidelines',
              value: analysisResult.violations.map((v: any) => v.type)
            });
          } else if (analysisResult.score >= this.config.reviewThreshold) {
            moderationFlags = {
              requiresReview: analysisResult.requiresReview || true,
              score: analysisResult.score,
              violations: analysisResult.violations
            };
          }
        } catch (error) {
          logger.warn('Content moderation analysis failed', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Sanitize content (basic HTML/XSS protection)
      sanitizedContent.content = this.sanitizeContent(content);
    }

    // Enhanced hashtag validation
    if (hashtags && Array.isArray(hashtags)) {
      if (hashtags.length > this.config.maxHashtags) {
        errors.push({
          field: 'hashtags',
          message: `Maximum ${this.config.maxHashtags} hashtags allowed`,
          value: hashtags.length
        });
      }

      const hashtagValidationResults = await hashtagValidationService.validateHashtags(hashtags);
      
      // Add errors for invalid hashtags
      for (const result of hashtagValidationResults.results) {
        if (!result.isValid) {
          const blockingViolations = result.violations.filter(v => v.suggestedAction === 'block');
          if (blockingViolations.length > 0) {
            errors.push({
              field: 'hashtags',
              message: `Hashtag "${result.sanitizedHashtag}" is not allowed: ${blockingViolations[0].description}`,
              value: blockingViolations.map(v => v.type)
            });
          }
          
          const warningViolations = result.violations.filter(v => v.suggestedAction === 'warn');
          if (warningViolations.length > 0) {
            warnings.push({
              field: 'hashtags',
              message: `Hashtag "${result.sanitizedHashtag}" may be inappropriate: ${warningViolations[0].description}`,
              value: result.suggestions || []
            });
          }
        }
      }

      // Use only valid hashtags
      sanitizedContent.hashtags = hashtagValidationResults.validHashtags;
      
      // Update hashtag usage statistics for valid hashtags
      for (const validHashtag of hashtagValidationResults.validHashtags) {
        hashtagValidationService.updateHashtagUsage(validHashtag).catch(error => {
          logger.warn('Failed to update hashtag usage', { hashtag: validHashtag, error });
        });
      }
    }

    // Image array validation (URLs)
    if (images && Array.isArray(images)) {
      if (images.length > this.config.maxImages) {
        errors.push({
          field: 'images',
          message: `Maximum ${this.config.maxImages} images allowed`,
          value: images.length
        });
      }

      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (!image.image_url || !this.isValidImageUrl(image.image_url)) {
          errors.push({
            field: `images[${i}].image_url`,
            message: 'Invalid image URL',
            value: image.image_url
          });
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      moderationFlags,
      spamFlags,
      sanitizedContent: Object.keys(sanitizedContent).length > 0 ? sanitizedContent : undefined
    };
  }

  /**
   * Validate a single image file
   */
  private async validateSingleImage(file: any): Promise<ImageValidationResult> {
    const errors: ValidationError[] = [];

    try {
      // File type validation
      if (!this.config.allowedImageTypes.includes(file.mimetype)) {
        errors.push({
          field: 'file.type',
          message: `Invalid file type. Allowed types: ${this.config.allowedImageTypes.join(', ')}`,
          value: file.mimetype
        });
      }

      // File size validation
      if (file.size > this.config.maxImageSize) {
        errors.push({
          field: 'file.size',
          message: `File size exceeds maximum of ${Math.round(this.config.maxImageSize / (1024 * 1024))}MB`,
          value: `${Math.round(file.size / (1024 * 1024))}MB`
        });
      }

      // File name validation
      const suspiciousPatterns = [
        /\.(exe|bat|cmd|com|pif|scr|vbs|js|jar|php|asp|jsp)$/i,
        /[<>:"|?*]/,
        /^\./,
        /\.{2,}/
      ];

      for (const pattern of suspiciousPatterns) {
        if (pattern.test(file.originalname)) {
          errors.push({
            field: 'file.name',
            message: 'File name contains invalid characters or suspicious extension',
            value: file.originalname
          });
          break;
        }
      }

      // Image analysis with Sharp (if enabled and no errors so far)
      let metadata: any = undefined;
      if (this.config.enableImageAnalysis && errors.length === 0) {
        try {
          const imageInfo = await sharp(file.buffer).metadata();
          
          metadata = {
            width: imageInfo.width || 0,
            height: imageInfo.height || 0,
            format: imageInfo.format || 'unknown',
            size: file.size,
            hasTransparency: imageInfo.hasAlpha || false
          };

          // Dimension validation
          if (imageInfo.width && imageInfo.width > this.config.maxImageDimensions.width) {
            errors.push({
              field: 'image.width',
              message: `Image width exceeds maximum of ${this.config.maxImageDimensions.width}px`,
              value: `${imageInfo.width}px`
            });
          }

          if (imageInfo.height && imageInfo.height > this.config.maxImageDimensions.height) {
            errors.push({
              field: 'image.height',
              message: `Image height exceeds maximum of ${this.config.maxImageDimensions.height}px`,
              value: `${imageInfo.height}px`
            });
          }

          // Minimum dimension check (prevent 1x1 pixel images)
          if (imageInfo.width && imageInfo.width < 10) {
            errors.push({
              field: 'image.width',
              message: 'Image width too small (minimum 10px)',
              value: `${imageInfo.width}px`
            });
          }

          if (imageInfo.height && imageInfo.height < 10) {
            errors.push({
              field: 'image.height',
              message: 'Image height too small (minimum 10px)',
              value: `${imageInfo.height}px`
            });
          }

        } catch (sharpError) {
          errors.push({
            field: 'image.format',
            message: 'Unable to process image file - may be corrupted',
            value: file.originalname
          });
        }
      }

      return {
        isValid: errors.length === 0,
        errors,
        metadata
      };

    } catch (error) {
      logger.error('Image validation error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName: file.originalname
      });

      return {
        isValid: false,
        errors: [{
          field: 'image',
          message: 'Image validation failed',
          value: error instanceof Error ? error.message : 'Unknown error'
        }]
      };
    }
  }

  /**
   * Get severity level for comparison (0=none, 1=mild, 2=moderate, 3=severe, 4=extreme)
   */
  private getSeverityLevel(severity: string): number {
    const levels = { none: 0, mild: 1, moderate: 2, severe: 3, extreme: 4 };
    return levels[severity as keyof typeof levels] || 0;
  }

  /**
   * Detect spam patterns in content
   */
  private detectSpam(content: string): { isSpam: boolean; score: number; indicators: string[] } {
    const spamPatterns = [
      { pattern: /(.)\1{15,}/gi, name: 'excessive_repetition' },
      { pattern: /(http[s]?:\/\/[^\s]+){4,}/gi, name: 'multiple_urls' },
      { pattern: /\b(buy now|click here|limited time|act now|don't miss|urgent|free money|make money fast)\b/gi, name: 'spam_keywords_en' },
      { pattern: /\b(지금 구매|클릭하세요|한정 시간|놓치지 마세요|긴급|무료 돈|빨리 돈벌기)\b/gi, name: 'spam_keywords_ko' }
    ];

    let score = 0;
    const indicators: string[] = [];

    for (const { pattern, name } of spamPatterns) {
      if (pattern.test(content)) {
        score++;
        indicators.push(name);
      }
    }

    // Check for excessive emoji usage (basic pattern for common emojis)
    const emojiCount = (content.match(/[\u2600-\u27BF]|[\uD83C-\uDBFF\uDC00-\uDFFF]+/g) || []).length;
    if (emojiCount > content.length * 0.3) {
      score++;
      indicators.push('excessive_emojis');
    }

    return {
      isSpam: score >= 3,
      score,
      indicators
    };
  }


  /**
   * Validate image URL format
   */
  private isValidImageUrl(url: string): boolean {
    if (!url || typeof url !== 'string') return false;
    
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'https:' && 
             (urlObj.hostname.includes('supabase') || 
              urlObj.hostname.includes('amazonaws.com') ||
              urlObj.hostname.includes('googleapis.com'));
    } catch {
      return false;
    }
  }

  /**
   * Sanitize content (basic XSS protection)
   */
  private sanitizeContent(content: string): string {
    return content
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .trim();
  }

}

// Export convenience functions for common use cases
export function createPostValidationMiddleware(config?: Partial<ContentValidationConfig>) {
  const middleware = new ContentValidationMiddleware({
    ...config,
    contentType: 'post',
    maxContentLength: 2000,
    maxHashtags: 10,
    maxImages: 10
  });
  return middleware;
}

export function createCommentValidationMiddleware(config?: Partial<ContentValidationConfig>) {
  const middleware = new ContentValidationMiddleware({
    ...config,
    contentType: 'comment',
    maxContentLength: 500,
    maxHashtags: 5,
    maxImages: 3
  });
  return middleware;
}

export function createProfileValidationMiddleware(config?: Partial<ContentValidationConfig>) {
  const middleware = new ContentValidationMiddleware({
    ...config,
    contentType: 'profile',
    maxContentLength: 1000,
    maxHashtags: 5,
    maxImages: 5
  });
  return middleware;
}
