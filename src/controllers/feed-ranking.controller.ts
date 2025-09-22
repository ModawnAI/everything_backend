/**
 * Feed Ranking Controller
 * 
 * Handles API endpoints for personalized feed ranking, trending content,
 * and feed analytics. Integrates with the FeedRankingService to provide
 * sophisticated content curation and discovery features.
 */

import { Request, Response } from 'express';
import { feedRankingService } from '../services/feed-ranking.service';
import { logger } from '../utils/logger';
import { validateRequestBody } from '../middleware/validation.middleware';
import Joi from 'joi';

// Extend Request interface to include user
interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

// Validation schemas
const feedOptionsSchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(20),
  offset: Joi.number().integer().min(0).default(0),
  timeWindow: Joi.string().valid('hour', 'day', 'week', 'month').default('week'),
  includeFollowedOnly: Joi.boolean().default(false),
  categoryFilter: Joi.array().items(Joi.string()).max(10),
  locationFilter: Joi.string().max(100),
  minQualityScore: Joi.number().min(0).max(100),
  diversityBoost: Joi.boolean().default(true),
  personalizedWeights: Joi.object({
    recency: Joi.number().min(0).max(1),
    engagement: Joi.number().min(0).max(1),
    relevance: Joi.number().min(0).max(1),
    authorInfluence: Joi.number().min(0).max(1)
  })
});

const trendingOptionsSchema = Joi.object({
  timeframe: Joi.string().valid('hour', 'day', 'week').default('day'),
  category: Joi.string().max(50),
  location: Joi.string().max(100),
  limit: Joi.number().integer().min(1).max(50).default(20)
});

const interactionSchema = Joi.object({
  type: Joi.string().valid('like', 'comment', 'share', 'view').required(),
  postId: Joi.string().uuid().required(),
  category: Joi.string().max(50),
  authorId: Joi.string().uuid()
});

/**
 * Get personalized feed for authenticated user
 */
export const getPersonalizedFeed = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to access personalized feed.'
        }
      });
      return;
    }

    // Validate request body
    const { error, value: options } = feedOptionsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    // Add userId to options
    const feedOptions = {
      ...options,
      userId
    };

    logger.info('Generating personalized feed', {
      userId,
      options: feedOptions
    });

    const result = await feedRankingService.generatePersonalizedFeed(feedOptions);

    res.status(200).json({
      success: true,
      data: {
        posts: result.posts.map(post => ({
          id: post.id,
          content: post.content,
          category: post.category,
          location_tag: post.location_tag,
          hashtags: post.hashtags,
          images: post.images,
          author: {
            id: post.author_id,
            name: post.author?.name,
            nickname: post.author?.nickname,
            profile_image_url: post.author?.profile_image_url,
            is_influencer: post.author?.is_influencer,
            verification_status: (post.author as any)?.verification_status
          },
          stats: {
            like_count: post.like_count,
            comment_count: post.comment_count,
            share_count: post.share_count,
            view_count: post.view_count
          },
          created_at: post.created_at,
          updated_at: post.updated_at
        })),
        pagination: {
          total: result.totalCount,
          limit: feedOptions.limit,
          offset: feedOptions.offset,
          nextOffset: result.nextOffset
        },
        metadata: {
          rankingFactors: result.metrics.map(metric => ({
            postId: metric.postId,
            finalScore: metric.finalScore,
            engagementRate: metric.engagementRate,
            viralityScore: metric.viralityScore,
            qualityScore: metric.qualityScore,
            freshnessScore: metric.freshnessScore,
            relevanceScore: metric.relevanceScore,
            authorInfluenceScore: metric.authorInfluenceScore,
            rankingFactors: metric.rankingFactors
          }))
        }
      },
      message: 'Personalized feed generated successfully.'
    });

  } catch (error) {
    logger.error('Failed to generate personalized feed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FEED_GENERATION_FAILED',
        message: 'Failed to generate personalized feed. Please try again.'
      }
    });
  }
};

/**
 * Get trending content
 */
export const getTrendingContent = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    // Validate query parameters
    const { error, value: options } = trendingOptionsSchema.validate(req.query);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    logger.info('Fetching trending content', { options });

    const trending = await feedRankingService.getTrendingContent(options);

    res.status(200).json({
      success: true,
      data: {
        trending: trending.map(item => ({
          postId: item.postId,
          trendingScore: item.trendingScore,
          category: item.category,
          location: item.location,
          timeframe: item.timeframe,
          metrics: {
            engagementVelocity: item.metrics.engagementVelocity,
            shareRate: item.metrics.shareRate,
            commentRate: item.metrics.commentRate,
            uniqueViewers: item.metrics.uniqueViewers
          }
        })),
        timeframe: options.timeframe,
        category: options.category,
        location: options.location
      },
      message: 'Trending content retrieved successfully.'
    });

  } catch (error) {
    logger.error('Failed to get trending content', {
      error: error instanceof Error ? error.message : 'Unknown error',
      query: req.query
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'TRENDING_CONTENT_FAILED',
        message: 'Failed to retrieve trending content. Please try again.'
      }
    });
  }
};

/**
 * Record user interaction for preference learning
 */
export const recordInteraction = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to record interactions.'
        }
      });
      return;
    }

    // Validate request body
    const { error, value: interaction } = interactionSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    logger.info('Recording user interaction', {
      userId,
      interaction
    });

    await feedRankingService.updateUserPreferences(userId, interaction);

    res.status(200).json({
      success: true,
      message: 'Interaction recorded successfully for preference learning.'
    });

  } catch (error) {
    logger.error('Failed to record interaction', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERACTION_RECORDING_FAILED',
        message: 'Failed to record interaction. Please try again.'
      }
    });
  }
};

/**
 * Get feed analytics for user
 */
export const getFeedAnalytics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to access feed analytics.'
        }
      });
      return;
    }

    const timeframe = req.query.timeframe as 'day' | 'week' | 'month' || 'week';

    logger.info('Getting feed analytics', {
      userId,
      timeframe
    });

    const analytics = await feedRankingService.getFeedAnalytics(userId, timeframe);

    res.status(200).json({
      success: true,
      data: {
        analytics,
        timeframe,
        generatedAt: new Date().toISOString()
      },
      message: 'Feed analytics retrieved successfully.'
    });

  } catch (error) {
    logger.error('Failed to get feed analytics', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      timeframe: req.query.timeframe
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'FEED_ANALYTICS_FAILED',
        message: 'Failed to retrieve feed analytics. Please try again.'
      }
    });
  }
};

/**
 * Get personalized feed weights for user
 */
export const getPersonalizedWeights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to access personalized weights.'
        }
      });
      return;
    }

    // Get user preferences to show current weights
    const preferences = await (feedRankingService as any).getUserPreferences(userId);
    const weights = await (feedRankingService as any).calculatePersonalizedWeights(preferences);

    res.status(200).json({
      success: true,
      data: {
        weights,
        preferences: {
          categoryInterests: preferences.categoryInterests,
          personalityProfile: preferences.personalityProfile
        },
        explanation: {
          recency: 'How much recent content is prioritized',
          engagement: 'How much high-engagement content is prioritized',
          relevance: 'How much personalized content is prioritized',
          authorInfluence: 'How much influencer content is prioritized'
        }
      },
      message: 'Personalized weights retrieved successfully.'
    });

  } catch (error) {
    logger.error('Failed to get personalized weights', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'PERSONALIZED_WEIGHTS_FAILED',
        message: 'Failed to retrieve personalized weights. Please try again.'
      }
    });
  }
};

/**
 * Update personalized weights for user
 */
export const updatePersonalizedWeights = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      res.status(401).json({
        success: false,
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required to update personalized weights.'
        }
      });
      return;
    }

    // Validate weights
    const weightsSchema = Joi.object({
      recency: Joi.number().min(0).max(1).required(),
      engagement: Joi.number().min(0).max(1).required(),
      relevance: Joi.number().min(0).max(1).required(),
      authorInfluence: Joi.number().min(0).max(1).required()
    });

    const { error, value: weights } = weightsSchema.validate(req.body);
    if (error) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: error.details[0].message
        }
      });
      return;
    }

    // Ensure weights sum to 1
    const total = Object.values(weights).reduce((sum: number, weight: number) => sum + weight, 0);
    if (Math.abs(Number(total) - 1) > 0.01) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_WEIGHTS',
          message: 'Weights must sum to 1.0'
        }
      });
      return;
    }

    logger.info('Updating personalized weights', {
      userId,
      weights
    });

    // Cache the updated weights (in a real implementation, you might store in database)
    const cacheKey = `user_custom_weights:${userId}`;
    const redisClient = (feedRankingService as any).redis;
    await redisClient.setex(cacheKey, 24 * 60 * 60, JSON.stringify(weights)); // 24 hours

    res.status(200).json({
      success: true,
      data: {
        weights,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      },
      message: 'Personalized weights updated successfully.'
    });

  } catch (error) {
    logger.error('Failed to update personalized weights', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: req.user?.id,
      body: req.body
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'WEIGHTS_UPDATE_FAILED',
        message: 'Failed to update personalized weights. Please try again.'
      }
    });
  }
};
