/**
 * Feed Controller
 * 
 * Handles social feed operations including post creation, retrieval,
 * likes, comments, and feed algorithm implementation
 */

import { Request, Response } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { feedService } from '../services/feed.service';
import { feedImageService } from '../services/feed-image.service';
import { feedLoggingService } from '../services/feed-logging.service';
// import { validateFeedPost, validateComment, validateFeedQuery } from '../validators/feed.validators';

export class FeedController {
  private supabase = getSupabaseClient();

  /**
   * Create a new feed post
   * POST /api/feed/posts
   */
  async createPost(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // [DEBUG] Log complete request body in development
      if (process.env.NODE_ENV === 'development') {
        logger.info('📦 [FEED-DEBUG] createPost request body:', {
          body: req.body,
          bodyKeys: Object.keys(req.body || {}),
          hasImages: !!req.body.images,
          imagesCount: req.body.images?.length || 0,
          imagesStructure: req.body.images?.map((img: any) => ({
            hasImageUrl: !!img.imageUrl,
            hasImage_url: !!img.image_url,
            hasAltText: !!img.altText,
            hasAlt_text: !!img.alt_text,
            hasDisplayOrder: !!img.displayOrder,
            hasDisplay_order: !!img.display_order,
            keys: Object.keys(img)
          }))
        });
      }

      // Validate request body
      // const { error, value } = validateFeedPost(req.body);
      // if (error) {
      //   res.status(400).json({
      //     error: 'Validation failed',
      //     details: error.details.map(d => d.message)
      //   });
      //   return;
      // }
      const value = req.body;

      // Normalize field names (camelCase → snake_case for database compatibility)
      const normalizedValue = {
        content: value.content,
        category: value.category,
        location_tag: value.location_tag || value.locationTag,
        tagged_shop_id: value.tagged_shop_id || value.taggedShopId,
        hashtags: value.hashtags,
        images: value.images?.map((img: any) => ({
          image_url: img.image_url || img.imageUrl,
          alt_text: img.alt_text || img.altText,
          display_order: img.display_order || img.displayOrder
        }))
      };

      if (process.env.NODE_ENV === 'development') {
        logger.info('🔄 [FEED-DEBUG] Normalized data for service:', {
          original_has_images: !!value.images,
          normalized_has_images: !!normalizedValue.images,
          normalized_images_count: normalizedValue.images?.length || 0,
          normalized_images: normalizedValue.images?.map((img: any) => ({
            has_image_url: !!img.image_url,
            image_url: img.image_url,
            display_order: img.display_order
          }))
        });
      }

      const postData = {
        ...normalizedValue,
        author_id: userId
      };

      const result = await feedService.createPost(postData);
      
      if (!result.success) {
        // Log failed post creation
        feedLoggingService.logPostCreationPerformance(
          Date.now() - startTime,
          'unknown',
          userId,
          false,
          req
        );
        res.status(400).json({ error: result.error });
        return;
      }

      // Log successful post creation
      const duration = Date.now() - startTime;
      feedLoggingService.logPostCreation(
        result.post?.id || 'unknown',
        userId,
        {
          category: postData.category,
          hasImages: postData.images && postData.images.length > 0,
          contentLength: postData.content?.length || 0,
          hashtags: postData.hashtags || []
        },
        req
      );
      feedLoggingService.logPostCreationPerformance(duration, result.post?.id || 'unknown', userId, true, req);

      res.status(201).json({
        success: true,
        message: 'Post created successfully',
        data: result.post
      });

    } catch (error) {
      const userId = (req as any).user?.id;
      const duration = Date.now() - startTime;
      
      // Log feed error
      feedLoggingService.logFeedError(
        error as Error,
        {
          userId,
          operation: 'post_creation',
          metadata: { duration }
        },
        req
      );
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get feed posts with pagination and filtering
   * GET /api/feed/posts
   */
  async getFeedPosts(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate query parameters
      // const { error, value } = validateFeedQuery(req.query);
      // if (error) {
      //   res.status(400).json({ 
      //     error: 'Validation failed', 
      //     details: error.details.map(d => d.message) 
      //   });
      //   return;
      // }
      const value = req.query;

      const result = await feedService.getFeedPosts(userId, value);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Log feed load performance
      const duration = Date.now() - startTime;
      feedLoggingService.logFeedLoad(
        duration,
        userId,
        result.posts.length,
        false, // TODO: Implement cache hit detection
        req
      );

      res.json({
        success: true,
        data: {
          posts: result.posts,
          pagination: result.pagination,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      const userId = (req as any).user?.id;
      const duration = Date.now() - startTime;
      
      // Log feed error
      feedLoggingService.logFeedError(
        error as Error,
        {
          userId,
          operation: 'feed_load',
          metadata: { duration }
        },
        req
      );
      
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get user's own posts (most recent 10)
   * GET /api/user/feed/my-posts
   */
  async getMyPosts(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.getMyPosts(userId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Log feed load performance
      const duration = Date.now() - startTime;
      feedLoggingService.logFeedLoad(
        duration,
        userId,
        result.posts?.length || 0,
        false,
        req
      );

      res.json({
        success: true,
        data: {
          posts: result.posts || []
        }
      });

    } catch (error) {
      const userId = (req as any).user?.id;
      const duration = Date.now() - startTime;

      feedLoggingService.logFeedError(
        error as Error,
        {
          userId,
          operation: 'my_posts_load',
          metadata: { duration }
        },
        req
      );

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get discover feed (posts from other users and shops)
   * GET /api/user/feed/discover
   */
  async getDiscoverFeed(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.getDiscoverFeed(userId);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      // Log feed load performance
      const duration = Date.now() - startTime;
      feedLoggingService.logFeedLoad(
        duration,
        userId,
        result.posts?.length || 0,
        false,
        req
      );

      res.json({
        success: true,
        data: {
          posts: result.posts || []
        }
      });

    } catch (error) {
      const userId = (req as any).user?.id;
      const duration = Date.now() - startTime;

      feedLoggingService.logFeedError(
        error as Error,
        {
          userId,
          operation: 'discover_feed_load',
          metadata: { duration }
        },
        req
      );

      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get a specific feed post
   * GET /api/feed/posts/:postId
   */
  async getPostById(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.getPostById(postId, userId);
      
      if (!result.success) {
        res.status(404).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        data: result.post
      });

    } catch (error) {
      logger.error('Error fetching feed post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update a feed post
   * PUT /api/feed/posts/:postId
   */
  async updatePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      // const { error, value } = validateFeedPost(req.body);
      // if (error) {
      //   res.status(400).json({ 
      //     error: 'Validation failed', 
      //     details: error.details.map(d => d.message) 
      //   });
      //   return;
      // }
      const value = req.body;

      const result = await feedService.updatePost(postId, userId, value);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Post updated successfully',
        data: result.post
      });

    } catch (error) {
      logger.error('Error updating feed post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a feed post
   * DELETE /api/feed/posts/:postId
   */
  async deletePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.deletePost(postId, userId);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Post deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting feed post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Like a feed post
   * POST /api/feed/posts/:postId/like
   */
  async likePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.likePost(postId, userId);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Post liked successfully',
        data: { liked: result.liked, likeCount: result.likeCount }
      });

    } catch (error) {
      logger.error('Error liking feed post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Unlike a feed post
   * DELETE /api/feed/posts/:postId/like
   */
  async unlikePost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.unlikePost(postId, userId);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Post unliked successfully',
        data: { liked: result.liked, likeCount: result.likeCount }
      });

    } catch (error) {
      logger.error('Error unliking feed post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Add a comment to a feed post
   * POST /api/feed/posts/:postId/comments
   */
  async addComment(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      // const { error, value } = validateComment(req.body);
      // if (error) {
      //   res.status(400).json({ 
      //     error: 'Validation failed', 
      //     details: error.details.map(d => d.message) 
      //   });
      //   return;
      // }
      const value = req.body;

      const result = await feedService.addComment(postId, userId, value);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: result.comment
      });

    } catch (error) {
      logger.error('Error adding comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Get comments for a feed post
   * GET /api/feed/posts/:postId/comments
   */
  async getComments(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const { page = '1', limit = '20' } = req.query;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Parse and validate pagination parameters
      const parsedPage = parseInt(page as string, 10);
      const parsedLimit = parseInt(limit as string, 10);

      // Validate parsed values
      if (isNaN(parsedPage) || parsedPage < 1) {
        res.status(400).json({ error: 'Invalid page parameter' });
        return;
      }

      if (isNaN(parsedLimit) || parsedLimit < 1 || parsedLimit > 50) {
        res.status(400).json({ error: 'Invalid limit parameter (must be between 1 and 50)' });
        return;
      }

      const result = await feedService.getComments(postId, {
        page: parsedPage,
        limit: parsedLimit
      });

      if (!result.success) {
        logger.error('getComments service error', {
          postId,
          userId,
          error: result.error,
          page: parsedPage,
          limit: parsedLimit
        });
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        data: {
          comments: result.comments,
          pagination: result.pagination,
          hasMore: result.hasMore
        }
      });

    } catch (error) {
      logger.error('Error fetching comments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Update a comment
   * PUT /api/feed/comments/:commentId
   */
  async updateComment(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Validate request body
      // const { error, value } = validateComment(req.body);
      // if (error) {
      //   res.status(400).json({ 
      //     error: 'Validation failed', 
      //     details: error.details.map(d => d.message) 
      //   });
      //   return;
      // }
      const value = req.body;

      const result = await feedService.updateComment(commentId, userId, value);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Comment updated successfully',
        data: result.comment
      });

    } catch (error) {
      logger.error('Error updating comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: req.params.commentId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Delete a comment
   * DELETE /api/feed/comments/:commentId
   */
  async deleteComment(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.deleteComment(commentId, userId);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Comment deleted successfully'
      });

    } catch (error) {
      logger.error('Error deleting comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: req.params.commentId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Like a comment
   * POST /api/feed/comments/:commentId/like
   */
  async likeComment(req: Request, res: Response): Promise<void> {
    try {
      const { commentId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const result = await feedService.likeComment(commentId, userId);
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Comment liked successfully',
        data: { liked: result.liked, likeCount: result.likeCount }
      });

    } catch (error) {
      logger.error('Error liking comment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        commentId: req.params.commentId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Report a feed post
   * POST /api/feed/posts/:postId/report
   */
  async reportPost(req: Request, res: Response): Promise<void> {
    try {
      const { postId } = req.params;
      const userId = (req as any).user?.id;

      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      const { reason, description } = req.body;

      if (!reason) {
        res.status(400).json({ error: 'Report reason is required' });
        return;
      }

      const result = await feedService.reportPost(postId, userId, { reason, description });
      
      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({
        success: true,
        message: 'Post reported successfully'
      });

    } catch (error) {
      logger.error('Error reporting post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        postId: req.params.postId,
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Upload images for feed posts
   * POST /api/feed/upload-images
   */
  async uploadImages(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ error: 'Authentication required' });
        return;
      }

      // Check if files were uploaded
      const files = (req as any).files;
      if (!files || !Array.isArray(files) || files.length === 0) {
        res.status(400).json({ error: 'No images provided' });
        return;
      }

      // Validate number of images
      if (files.length > 10) {
        res.status(400).json({ error: 'Maximum 10 images allowed per upload' });
        return;
      }

      // Prepare images for upload
      const imagesToUpload = files.map((file: any, index: number) => ({
        buffer: file.buffer,
        fileName: file.originalname,
        altText: req.body[`altText_${index}`] || undefined,
        displayOrder: parseInt(req.body[`displayOrder_${index}`]) || index + 1
      }));

      // Upload images
      const result = await feedImageService.uploadFeedImages(userId, imagesToUpload);

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.status(201).json({
        success: true,
        message: 'Images uploaded successfully',
        data: {
          images: result.images
        }
      });

    } catch (error) {
      logger.error('Error uploading feed images', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  // =============================================================================
  // SAVED FEEDS ENDPOINTS
  // =============================================================================

  /**
   * Save/bookmark a post
   * POST /api/feed/posts/:postId/save
   */
  async savePost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { postId } = req.params;
      if (!postId) {
        res.status(400).json({ success: false, error: 'Post ID is required' });
        return;
      }

      const result = await feedService.savePost(userId, postId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '저장되었습니다.'
      });

    } catch (error) {
      logger.error('Error saving post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        postId: req.params.postId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Unsave/unbookmark a post
   * DELETE /api/feed/posts/:postId/save
   */
  async unsavePost(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { postId } = req.params;
      if (!postId) {
        res.status(400).json({ success: false, error: 'Post ID is required' });
        return;
      }

      const result = await feedService.unsavePost(userId, postId);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: '저장이 취소되었습니다.'
      });

    } catch (error) {
      logger.error('Error unsaving post', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        postId: req.params.postId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Get user's saved posts
   * GET /api/feed/saved
   */
  async getSavedPosts(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 20;
      const offset = parseInt(req.query.offset as string) || 0;

      const result = await feedService.getSavedPosts(userId, { limit, offset });

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        data: {
          posts: result.posts,
          pagination: result.pagination
        }
      });

    } catch (error) {
      logger.error('Error getting saved posts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  // =============================================================================
  // USER FEED PROFILE ENDPOINTS
  // =============================================================================

  /**
   * Get user feed profile
   * GET /api/feed/users/:userId/profile
   */
  async getUserFeedProfile(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      if (!userId) {
        res.status(400).json({ success: false, error: 'User ID is required' });
        return;
      }

      const viewerId = (req as any).user?.id;
      const postLimit = parseInt(req.query.postLimit as string) || 50;

      const result = await feedService.getUserFeedProfile(userId, viewerId, { postLimit });

      if (!result.success) {
        res.status(404).json(result);
        return;
      }

      res.json({
        success: true,
        data: result.profile
      });

    } catch (error) {
      logger.error('Error getting user feed profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        targetUserId: req.params.userId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Update user bio
   * PUT /api/feed/users/bio
   */
  async updateUserBio(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { bio } = req.body;
      if (bio === undefined) {
        res.status(400).json({ success: false, error: 'Bio is required' });
        return;
      }

      const result = await feedService.updateUserBio(userId, bio);

      if (!result.success) {
        res.status(400).json(result);
        return;
      }

      res.json({
        success: true,
        message: 'Bio updated successfully'
      });

    } catch (error) {
      logger.error('Error updating user bio', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }

  /**
   * Check if post is saved by current user
   * GET /api/feed/posts/:postId/saved-status
   */
  async getPostSavedStatus(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({ success: false, error: 'Authentication required' });
        return;
      }

      const { postId } = req.params;
      if (!postId) {
        res.status(400).json({ success: false, error: 'Post ID is required' });
        return;
      }

      const isSaved = await feedService.isPostSaved(userId, postId);

      res.json({
        success: true,
        data: { isSaved }
      });

    } catch (error) {
      logger.error('Error checking post saved status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
        postId: req.params.postId
      });
      res.status(500).json({ success: false, error: 'Internal server error' });
    }
  }
}

export default new FeedController();
