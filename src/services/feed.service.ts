/**
 * Feed Service
 * 
 * Handles social feed business logic including post management,
 * feed algorithm, likes, comments, and content moderation
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { contentModerator } from './content-moderator.service';
import { notificationService } from './notification.service';
import { cacheService } from './cache.service';

export interface FeedPost {
  id: string;
  author_id: string;
  content: string;
  category?: string;
  location_tag?: string;
  tagged_shop_id?: string;
  hashtags: string[];
  status: 'active' | 'hidden' | 'deleted';
  like_count: number;
  comment_count: number;
  view_count: number;
  report_count: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    nickname?: string;
    profile_image_url?: string;
    is_influencer: boolean;
  };
  images?: Array<{
    id: string;
    image_url: string;
    alt_text?: string;
    display_order: number;
  }>;
  tagged_shop?: {
    id: string;
    name: string;
    main_category: string;
  };
  is_liked?: boolean;
}

export interface FeedComment {
  id: string;
  post_id: string;
  author_id: string;
  content: string;
  parent_comment_id?: string;
  like_count: number;
  created_at: string;
  updated_at: string;
  author?: {
    id: string;
    name: string;
    nickname?: string;
    profile_image_url?: string;
  };
  is_liked?: boolean;
  replies?: FeedComment[];
}

export interface FeedQuery {
  page?: number;
  limit?: number;
  category?: string;
  hashtag?: string;
  location?: string;
  author_id?: string;
  sort?: 'recent' | 'popular' | 'trending';
}

export interface FeedResult {
  success: boolean;
  posts?: FeedPost[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  hasMore?: boolean;
  error?: string;
}

export interface CommentResult {
  success: boolean;
  comments?: FeedComment[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  hasMore?: boolean;
  error?: string;
}

export interface LikeResult {
  success: boolean;
  liked?: boolean;
  likeCount?: number;
  error?: string;
}

export class FeedService {
  private supabase = getSupabaseClient();

  /**
   * Create a new feed post
   */
  async createPost(postData: {
    author_id: string;
    content: string;
    category?: string;
    location_tag?: string;
    tagged_shop_id?: string;
    hashtags?: string[];
    images?: Array<{
      image_url: string;
      alt_text?: string;
      display_order: number;
    }>;
  }): Promise<{ success: boolean; post?: FeedPost; error?: string }> {
    try {
      // [DEBUG] Log incoming data structure
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔍 [FEED-SERVICE-DEBUG] createPost called with:', {
          author_id: postData.author_id,
          content_length: postData.content?.length || 0,
          category: postData.category,
          location_tag: postData.location_tag,
          tagged_shop_id: postData.tagged_shop_id,
          hashtags_count: postData.hashtags?.length || 0,
          hashtags: postData.hashtags,
          images_count: postData.images?.length || 0,
          images_structure: postData.images?.map(img => ({
            has_image_url: !!img.image_url,
            image_url_length: img.image_url?.length || 0,
            has_alt_text: !!img.alt_text,
            display_order: img.display_order,
            keys: Object.keys(img)
          }))
        });
      }

      // Validate hashtags (max 10)
      if (postData.hashtags && postData.hashtags.length > 10) {
        logger.warn('🚫 [FEED-SERVICE-DEBUG] Hashtag validation failed', {
          count: postData.hashtags.length,
          max: 10
        });
        return { success: false, error: 'Maximum 10 hashtags allowed' };
      }

      // Validate content length (max 2000 characters)
      if (postData.content.length > 2000) {
        logger.warn('🚫 [FEED-SERVICE-DEBUG] Content length validation failed', {
          length: postData.content.length,
          max: 2000
        });
        return { success: false, error: 'Content exceeds maximum length of 2000 characters' };
      }

      // Content moderation analysis
      if (process.env.NODE_ENV === 'development') {
        logger.info('🔎 [FEED-SERVICE-DEBUG] Starting content moderation');
      }

      const moderationResult = await contentModerator.analyzeFeedPost({
        content: postData.content,
        hashtags: postData.hashtags,
        images: postData.images?.map(img => ({ url: img.image_url, alt_text: img.alt_text })),
        location_tag: postData.location_tag,
        category: postData.category
      });

      if (process.env.NODE_ENV === 'development') {
        logger.info('✅ [FEED-SERVICE-DEBUG] Moderation completed', {
          autoAction: moderationResult.autoAction,
          score: moderationResult.score,
          severity: moderationResult.severity
        });
      }

      // Handle critical violations
      if (moderationResult.autoAction === 'remove') {
        logger.warn('🚫 [FEED-SERVICE-DEBUG] Post creation blocked due to content violations', {
          score: moderationResult.score,
          severity: moderationResult.severity,
          violations: moderationResult.violations.map(v => v.type)
        });
        return {
          success: false,
          error: 'Content violates community guidelines and cannot be posted'
        };
      }

      // Prepare data for database insertion
      const dbInsertData = {
        author_id: postData.author_id,
        content: postData.content,
        category: postData.category,
        location_tag: postData.location_tag,
        tagged_shop_id: postData.tagged_shop_id,
        hashtags: postData.hashtags || [],
        status: 'active',
        moderation_status: moderationResult.autoAction === 'flag' ? 'flagged' :
                         moderationResult.autoAction === 'hide' ? 'hidden' : 'approved',
        is_hidden: moderationResult.autoAction === 'hide'
      };

      if (process.env.NODE_ENV === 'development') {
        logger.info('💾 [FEED-SERVICE-DEBUG] Attempting database INSERT with:', {
          ...dbInsertData,
          content: `${dbInsertData.content.substring(0, 50)}...`,
          hashtags_type: typeof dbInsertData.hashtags,
          hashtags_isArray: Array.isArray(dbInsertData.hashtags)
        });
      }

      // Create post
      const { data: post, error: postError } = await this.supabase
        .from('feed_posts')
        .insert(dbInsertData)
        .select()
        .single();

      if (postError) {
        logger.error('💥 [FEED-SERVICE-DEBUG] Database INSERT failed!', {
          error: postError,
          errorMessage: postError.message,
          errorDetails: postError.details,
          errorHint: postError.hint,
          errorCode: postError.code,
          insertData: {
            ...dbInsertData,
            content: `${dbInsertData.content.substring(0, 50)}...`
          }
        });
        return { success: false, error: `Failed to create post: ${postError.message}` };
      }

      if (process.env.NODE_ENV === 'development') {
        logger.info('✅ [FEED-SERVICE-DEBUG] feed_posts INSERT successful', {
          post_id: post.id,
          has_images_to_add: !!(postData.images && postData.images.length > 0)
        });
      }

      // Add images if provided
      if (postData.images && postData.images.length > 0) {
        const imageData = postData.images.map(img => ({
          post_id: post.id,
          image_url: img.image_url,
          alt_text: img.alt_text,
          display_order: img.display_order
        }));

        if (process.env.NODE_ENV === 'development') {
          logger.info('🖼️ [FEED-SERVICE-DEBUG] Adding post images to post_images table', {
            post_id: post.id,
            image_count: imageData.length,
            images: imageData.map(img => ({
              image_url: img.image_url,
              has_alt_text: !!img.alt_text,
              display_order: img.display_order
            }))
          });
        }

        const { error: imageError } = await this.supabase
          .from('post_images')
          .insert(imageData);

        if (imageError) {
          logger.error('💥 [FEED-SERVICE-DEBUG] post_images INSERT failed!', {
            error: imageError,
            errorMessage: imageError.message,
            errorDetails: imageError.details,
            errorHint: imageError.hint,
            errorCode: imageError.code,
            imageData
          });
          // Continue without failing the post creation
        } else if (process.env.NODE_ENV === 'development') {
          logger.info('✅ [FEED-SERVICE-DEBUG] post_images INSERT successful', {
            post_id: post.id,
            images_added: imageData.length
          });
        }
      }

      // Get the complete post with author info
      const completePost = await this.getPostById(post.id, post.author_id);
      
      logger.info('Feed post created successfully', {
        postId: post.id,
        authorId: post.author_id,
        category: post.category,
        hashtagCount: postData.hashtags?.length || 0,
        moderationStatus: post.moderation_status,
        moderationScore: post.moderation_score,
        requiresReview: post.requires_review
      });
      
      return { success: true, post: completePost.post };

    } catch (error) {
      logger.error('Error in createPost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get feed posts with algorithm-based ranking
   */
  async getFeedPosts(userId: string, query: FeedQuery): Promise<FeedResult> {
    try {
      const page = query.page || 1;
      const limit = Math.min(query.limit || 20, 50); // Max 50 posts per page
      const offset = (page - 1) * limit;

      // Build query
      let supabaseQuery = this.supabase
        .from('feed_posts')
        .select(`
          *,
          author:users!feed_posts_author_id_fkey(
            id,
            name,
            nickname,
            profile_image_url,
            is_influencer
          ),
          images:post_images(
            id,
            image_url,
            alt_text,
            display_order
          ),
          tagged_shop:shops!feed_posts_tagged_shop_id_fkey(
            id,
            name,
            main_category
          )
        `)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      // Apply filters
      if (query.category) {
        supabaseQuery = supabaseQuery.eq('category', query.category);
      }

      if (query.hashtag) {
        supabaseQuery = supabaseQuery.contains('hashtags', [query.hashtag]);
      }

      if (query.location) {
        supabaseQuery = supabaseQuery.ilike('location_tag', `%${query.location}%`);
      }

      if (query.author_id) {
        supabaseQuery = supabaseQuery.eq('author_id', query.author_id);
      }

      // Get total count for pagination - create a separate query for counting
      let countQuery = this.supabase
        .from('feed_posts')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active');

      // Apply the same filters to count query
      if (query.category) {
        countQuery = countQuery.eq('category', query.category);
      }
      if (query.hashtag) {
        countQuery = countQuery.contains('hashtags', [query.hashtag]);
      }
      if (query.location) {
        countQuery = countQuery.ilike('location_tag', `%${query.location}%`);
      }
      if (query.author_id) {
        countQuery = countQuery.eq('author_id', query.author_id);
      }

      const { count } = await countQuery;

      // Apply pagination to main query
      supabaseQuery = supabaseQuery.range(offset, offset + limit - 1);

      const { data: posts, error } = await supabaseQuery;

      if (error) {
        logger.error('Error fetching feed posts', { error });
        return { success: false, error: 'Failed to fetch posts' };
      }

      // Add user-specific data (like status)
      const postsWithUserData = await this.addUserSpecificData(posts || [], userId);

      // Apply feed algorithm if not filtered
      let rankedPosts = postsWithUserData;
      if (!query.author_id && !query.hashtag && !query.category) {
        rankedPosts = this.applyFeedAlgorithm(postsWithUserData, userId);
      }

      return {
        success: true,
        posts: rankedPosts,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      logger.error('Error in getFeedPosts', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get user's own posts (most recent 10)
   */
  async getMyPosts(userId: string): Promise<FeedResult> {
    try {
      const { data: posts, error } = await this.supabase
        .from('feed_posts')
        .select(`
          *,
          author:users!feed_posts_author_id_fkey(
            id,
            name,
            nickname,
            profile_image_url,
            is_influencer
          ),
          images:post_images(
            id,
            image_url,
            alt_text,
            display_order
          ),
          tagged_shop:shops!feed_posts_tagged_shop_id_fkey(
            id,
            name,
            main_category
          )
        `)
        .eq('status', 'active')
        .eq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching user posts', { error });
        return { success: false, error: 'Failed to fetch user posts' };
      }

      const postsWithUserData = await this.addUserSpecificData(posts || [], userId);

      return {
        success: true,
        posts: postsWithUserData,
        hasMore: false
      };

    } catch (error) {
      logger.error('Error in getMyPosts', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get discover feed (posts from other users and shops, excluding own posts)
   */
  async getDiscoverFeed(userId: string): Promise<FeedResult> {
    try {
      const { data: posts, error } = await this.supabase
        .from('feed_posts')
        .select(`
          *,
          author:users!feed_posts_author_id_fkey(
            id,
            name,
            nickname,
            profile_image_url,
            is_influencer
          ),
          images:post_images(
            id,
            image_url,
            alt_text,
            display_order
          ),
          tagged_shop:shops!feed_posts_tagged_shop_id_fkey(
            id,
            name,
            main_category
          )
        `)
        .eq('status', 'active')
        .neq('author_id', userId)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) {
        logger.error('Error fetching discover feed', { error });
        return { success: false, error: 'Failed to fetch discover feed' };
      }

      const postsWithUserData = await this.addUserSpecificData(posts || [], userId);

      return {
        success: true,
        posts: postsWithUserData,
        hasMore: false
      };

    } catch (error) {
      logger.error('Error in getDiscoverFeed', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get a specific post by ID
   */
  async getPostById(postId: string, userId: string): Promise<{ success: boolean; post?: FeedPost; error?: string }> {
    try {
      const { data: post, error } = await this.supabase
        .from('feed_posts')
        .select(`
          *,
          author:users!feed_posts_author_id_fkey(
            id,
            name,
            nickname,
            profile_image_url,
            is_influencer
          ),
          images:post_images(
            id,
            image_url,
            alt_text,
            display_order
          ),
          tagged_shop:shops!feed_posts_tagged_shop_id_fkey(
            id,
            name,
            main_category
          )
        `)
        .eq('id', postId)
        .eq('status', 'active')
        .single();

      if (error || !post) {
        return { success: false, error: 'Post not found' };
      }

      // Add user-specific data
      const postsWithUserData = await this.addUserSpecificData([post], userId);
      
      return { success: true, post: postsWithUserData[0] };

    } catch (error) {
      logger.error('Error in getPostById', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update a feed post
   */
  async updatePost(postId: string, userId: string, updateData: {
    content?: string;
    category?: string;
    location_tag?: string;
    tagged_shop_id?: string;
    hashtags?: string[];
  }): Promise<{ success: boolean; post?: FeedPost; error?: string }> {
    try {
      // Check if user owns the post
      const { data: existingPost, error: checkError } = await this.supabase
        .from('feed_posts')
        .select('author_id')
        .eq('id', postId)
        .single();

      if (checkError || !existingPost) {
        return { success: false, error: 'Post not found' };
      }

      if (existingPost.author_id !== userId) {
        return { success: false, error: 'Not authorized to update this post' };
      }

      // Validate hashtags
      if (updateData.hashtags && updateData.hashtags.length > 10) {
        return { success: false, error: 'Maximum 10 hashtags allowed' };
      }

      // Validate content length
      if (updateData.content && updateData.content.length > 2000) {
        return { success: false, error: 'Content exceeds maximum length of 2000 characters' };
      }

      // Update post
      const { data: post, error } = await this.supabase
        .from('feed_posts')
        .update({
          ...updateData,
          updated_at: new Date().toISOString()
        })
        .eq('id', postId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating feed post', { error });
        return { success: false, error: 'Failed to update post' };
      }

      // Get complete post with author info
      const completePost = await this.getPostById(postId, userId);
      
      return { success: true, post: completePost.post };

    } catch (error) {
      logger.error('Error in updatePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Delete a feed post
   */
  async deletePost(postId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user owns the post
      const { data: existingPost, error: checkError } = await this.supabase
        .from('feed_posts')
        .select('author_id')
        .eq('id', postId)
        .single();

      if (checkError || !existingPost) {
        return { success: false, error: 'Post not found' };
      }

      if (existingPost.author_id !== userId) {
        return { success: false, error: 'Not authorized to delete this post' };
      }

      // Soft delete by updating status
      const { error } = await this.supabase
        .from('feed_posts')
        .update({ 
          status: 'deleted',
          updated_at: new Date().toISOString()
        })
        .eq('id', postId);

      if (error) {
        logger.error('Error deleting feed post', { error });
        return { success: false, error: 'Failed to delete post' };
      }

      return { success: true };

    } catch (error) {
      logger.error('Error in deletePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Like a feed post
   */
  async likePost(postId: string, userId: string): Promise<LikeResult> {
    try {
      // Check if already liked
      const { data: existingLike, error: checkError } = await this.supabase
        .from('post_likes')
        .select('id')
        .eq('post_id', postId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('Error checking existing like', { error: checkError });
        return { success: false, error: 'Failed to check like status' };
      }

      if (existingLike) {
        return { success: false, error: 'Post already liked' };
      }

      // Add like
      const { error: likeError } = await this.supabase
        .from('post_likes')
        .insert({
          post_id: postId,
          user_id: userId
        });

      if (likeError) {
        logger.error('Error adding like', { error: likeError });
        return { success: false, error: 'Failed to like post' };
      }

      // Get updated like count
      const { count: likeCount } = await this.supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      return { success: true, liked: true, likeCount: likeCount || 0 };

    } catch (error) {
      logger.error('Error in likePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Unlike a feed post
   */
  async unlikePost(postId: string, userId: string): Promise<LikeResult> {
    try {
      // Remove like
      const { error } = await this.supabase
        .from('post_likes')
        .delete()
        .eq('post_id', postId)
        .eq('user_id', userId);

      if (error) {
        logger.error('Error removing like', { error });
        return { success: false, error: 'Failed to unlike post' };
      }

      // Get updated like count
      const { count: likeCount } = await this.supabase
        .from('post_likes')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId);

      return { success: true, liked: false, likeCount: likeCount || 0 };

    } catch (error) {
      logger.error('Error in unlikePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Add a comment to a feed post
   */
  async addComment(postId: string, userId: string, commentData: {
    content: string;
    parent_comment_id?: string;
  }): Promise<{ success: boolean; comment?: FeedComment; error?: string }> {
    try {
      // Validate content length
      if (commentData.content.length > 1000) {
        return { success: false, error: 'Comment exceeds maximum length of 1000 characters' };
      }

      // Add comment
      const { data: comment, error } = await this.supabase
        .from('post_comments')
        .insert({
          post_id: postId,
          user_id: userId,
          content: commentData.content,
          parent_comment_id: commentData.parent_comment_id
        })
        .select(`
          *,
          author:users!post_comments_user_id_fkey(
            id,
            name,
            nickname,
            profile_image_url
          )
        `)
        .single();

      if (error) {
        logger.error('Error adding comment', { error });
        return { success: false, error: 'Failed to add comment' };
      }

      return { success: true, comment };

    } catch (error) {
      logger.error('Error in addComment', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get comments for a feed post
   */
  async getComments(postId: string, pagination: { page: number; limit: number }): Promise<CommentResult> {
    try {
      const { page, limit } = pagination;
      const offset = (page - 1) * limit;

      // Get total count
      const { count } = await this.supabase
        .from('post_comments')
        .select('*', { count: 'exact', head: true })
        .eq('post_id', postId)
        .is('parent_comment_id', null); // Only top-level comments

      // Get comments
      const { data: comments, error } = await this.supabase
        .from('post_comments')
        .select(`
          *,
          author:users!post_comments_user_id_fkey(
            id,
            name,
            nickname,
            profile_image_url
          )
        `)
        .eq('post_id', postId)
        .is('parent_comment_id', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching comments from Supabase', {
          error,
          postId,
          page,
          limit,
          offset,
          errorMessage: error.message,
          errorDetails: error.details,
          errorHint: error.hint
        });
        return {
          success: false,
          error: `Failed to fetch comments: ${error.message || 'Unknown database error'}`
        };
      }

      return {
        success: true,
        comments: comments || [],
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        },
        hasMore: (count || 0) > offset + limit
      };

    } catch (error) {
      logger.error('Error in getComments', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update a comment
   */
  async updateComment(commentId: string, userId: string, updateData: {
    content: string;
  }): Promise<{ success: boolean; comment?: FeedComment; error?: string }> {
    try {
      // Check if user owns the comment
      const { data: existingComment, error: checkError } = await this.supabase
        .from('post_comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (checkError || !existingComment) {
        return { success: false, error: 'Comment not found' };
      }

      if (existingComment.user_id !== userId) {
        return { success: false, error: 'Not authorized to update this comment' };
      }

      // Validate content length
      if (updateData.content.length > 1000) {
        return { success: false, error: 'Comment exceeds maximum length of 1000 characters' };
      }

      // Update comment
      const { data: comment, error } = await this.supabase
        .from('post_comments')
        .update({
          content: updateData.content,
          updated_at: new Date().toISOString()
        })
        .eq('id', commentId)
        .select(`
          *,
          author:users!post_comments_user_id_fkey(
            id,
            name,
            nickname,
            profile_image_url
          )
        `)
        .single();

      if (error) {
        logger.error('Error updating comment', { error });
        return { success: false, error: 'Failed to update comment' };
      }

      return { success: true, comment };

    } catch (error) {
      logger.error('Error in updateComment', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Delete a comment
   */
  async deleteComment(commentId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if user owns the comment
      const { data: existingComment, error: checkError } = await this.supabase
        .from('post_comments')
        .select('user_id')
        .eq('id', commentId)
        .single();

      if (checkError || !existingComment) {
        return { success: false, error: 'Comment not found' };
      }

      if (existingComment.user_id !== userId) {
        return { success: false, error: 'Not authorized to delete this comment' };
      }

      // Delete comment
      const { error } = await this.supabase
        .from('post_comments')
        .delete()
        .eq('id', commentId);

      if (error) {
        logger.error('Error deleting comment', { error });
        return { success: false, error: 'Failed to delete comment' };
      }

      return { success: true };

    } catch (error) {
      logger.error('Error in deleteComment', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Like a comment
   */
  async likeComment(commentId: string, userId: string): Promise<LikeResult> {
    try {
      // Check if already liked
      const { data: existingLike, error: checkError } = await this.supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', userId)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        logger.error('Error checking existing comment like', { error: checkError });
        return { success: false, error: 'Failed to check like status' };
      }

      if (existingLike) {
        return { success: false, error: 'Comment already liked' };
      }

      // Add like
      const { error: likeError } = await this.supabase
        .from('comment_likes')
        .insert({
          comment_id: commentId,
          user_id: userId
        });

      if (likeError) {
        logger.error('Error adding comment like', { error: likeError });
        return { success: false, error: 'Failed to like comment' };
      }

      // Get updated like count
      const { count: likeCount } = await this.supabase
        .from('comment_likes')
        .select('*', { count: 'exact', head: true })
        .eq('comment_id', commentId);

      return { success: true, liked: true, likeCount: likeCount || 0 };

    } catch (error) {
      logger.error('Error in likeComment', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }


  /**
   * Add user-specific data to posts (like status, etc.)
   */
  private async addUserSpecificData(posts: FeedPost[], userId: string): Promise<FeedPost[]> {
    try {
      if (posts.length === 0) return posts;

      const postIds = posts.map(p => p.id);

      // Get user's likes for these posts
      const { data: userLikes } = await this.supabase
        .from('post_likes')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      const likedPostIds = new Set(userLikes?.map(like => like.post_id) || []);

      // Add like status to posts
      return posts.map(post => ({
        ...post,
        is_liked: likedPostIds.has(post.id)
      }));

    } catch (error) {
      logger.error('Error adding user-specific data', { error: error instanceof Error ? error.message : 'Unknown error' });
      return posts; // Return posts without user data if error occurs
    }
  }

  /**
   * Apply feed algorithm for ranking posts with caching and performance optimization
   */
  private applyFeedAlgorithm(posts: FeedPost[], userId: string): FeedPost[] {
    try {
      // Cache scores to avoid recalculation during sorting
      const postsWithScores = posts.map(post => ({
        post,
        score: this.calculateFeedScore(post, userId)
      }));

      // Sort by score (higher first), with tiebreakers
      postsWithScores.sort((a, b) => {
        // Primary sort: by calculated score
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        
        // Tiebreaker 1: Featured posts first
        if (a.post.is_featured !== b.post.is_featured) {
          return b.post.is_featured ? 1 : -1;
        }
        
        // Tiebreaker 2: More recent posts first
        const timeA = new Date(a.post.created_at).getTime();
        const timeB = new Date(b.post.created_at).getTime();
        return timeB - timeA;
      });

      // Log algorithm performance for monitoring
      logger.debug('Feed algorithm applied', {
        userId,
        totalPosts: posts.length,
        scoreRange: {
          highest: postsWithScores[0]?.score || 0,
          lowest: postsWithScores[postsWithScores.length - 1]?.score || 0
        },
        featuredPosts: posts.filter(p => p.is_featured).length,
        influencerPosts: posts.filter(p => p.author?.is_influencer).length
      });

      return postsWithScores.map(item => item.post);
    } catch (error) {
      logger.error('Error applying feed algorithm', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        postCount: posts.length
      });
      return posts; // Return original order if error occurs
    }
  }

  /**
   * Calculate feed score for a post using weighted algorithm
   * Weights: Recency (40%), Engagement (30%), Relevance (20%), Author Influence (10%)
   */
  private calculateFeedScore(post: FeedPost, userId: string): number {
    let score = 0;

    // 1. Recency Score (40% weight) - Exponential decay over time
    const recencyScore = this.calculateRecencyScore(post);
    score += recencyScore * 0.4;

    // 2. Engagement Score (30% weight) - Likes + Comments*2 / Views
    const engagementScore = this.calculateEngagementScore(post);
    score += engagementScore * 0.3;

    // 3. Relevance Score (20% weight) - Location/Category matching
    const relevanceScore = this.calculateRelevanceScore(post, userId);
    score += relevanceScore * 0.2;

    // 4. Author Influence Score (10% weight) - Influencer status and following
    const authorInfluenceScore = this.calculateAuthorInfluenceScore(post);
    score += authorInfluenceScore * 0.1;

    // Trending boost for viral content
    const trendingBoost = this.calculateTrendingBoost(post);
    score += trendingBoost;

    // Featured posts boost
    if (post.is_featured) {
      score += 5; // Reduced from 15 to maintain algorithm balance
    }

    return Math.max(0, score); // Ensure non-negative score
  }

  /**
   * Calculate recency score with exponential decay
   */
  private calculateRecencyScore(post: FeedPost): number {
    const hoursAge = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    
    // Exponential decay: newer posts get higher scores
    // Score decreases by half every 24 hours
    const decayRate = 0.693 / 24; // ln(2) / 24 hours
    const recencyScore = 100 * Math.exp(-decayRate * hoursAge);
    
    return Math.max(0, Math.min(100, recencyScore));
  }

  /**
   * Calculate engagement score based on interactions
   */
  private calculateEngagementScore(post: FeedPost): number {
    const views = Math.max(post.view_count, 1); // Avoid division by zero
    const likes = post.like_count || 0;
    const comments = post.comment_count || 0;
    
    // Comments are weighted 2x more than likes
    const totalEngagement = likes + (comments * 2);
    const engagementRate = totalEngagement / views;
    
    // Normalize to 0-100 scale with logarithmic scaling for viral content
    let engagementScore = Math.min(engagementRate * 100, 100);
    
    // Boost for high engagement (viral detection)
    if (engagementRate > 0.1) { // 10% engagement rate
      engagementScore = Math.min(engagementScore * 1.2, 100);
    }
    
    return engagementScore;
  }

  /**
   * Calculate relevance score based on user preferences and content matching
   */
  private calculateRelevanceScore(post: FeedPost, userId: string): number {
    let relevanceScore = 0;
    
    // Base relevance for posts with location tags (future: match user location)
    if (post.location_tag) {
      relevanceScore += 30;
    }
    
    // Category relevance (future: match user category preferences)
    if (post.category) {
      relevanceScore += 25;
    }
    
    // Shop tagging relevance (posts about specific shops)
    if (post.tagged_shop_id) {
      relevanceScore += 20;
    }
    
    // Hashtag relevance (future: match user interests)
    if (post.hashtags && post.hashtags.length > 0) {
      relevanceScore += Math.min(post.hashtags.length * 5, 25);
    }
    
    return Math.min(relevanceScore, 100);
  }

  /**
   * Calculate author influence score
   */
  private calculateAuthorInfluenceScore(post: FeedPost): number {
    let influenceScore = 0;
    
    // Verified influencer boost
    if (post.author?.is_influencer) {
      influenceScore += 60;
    }
    
    // Author activity boost (future: based on follower count, engagement history)
    // For now, use a simple heuristic based on post engagement
    const authorEngagement = (post.like_count + post.comment_count) / Math.max(post.view_count, 1);
    if (authorEngagement > 0.05) { // 5% engagement rate
      influenceScore += 40;
    }
    
    return Math.min(influenceScore, 100);
  }

  /**
   * Calculate trending boost for viral content detection
   */
  private calculateTrendingBoost(post: FeedPost): number {
    const hoursAge = (Date.now() - new Date(post.created_at).getTime()) / (1000 * 60 * 60);
    
    // Only apply trending boost to recent posts (within 48 hours)
    if (hoursAge > 48) {
      return 0;
    }
    
    const views = Math.max(post.view_count, 1);
    const engagement = post.like_count + (post.comment_count * 2);
    const engagementRate = engagement / views;
    
    // High engagement rate indicates trending content
    if (engagementRate > 0.15 && engagement > 10) { // 15% rate with minimum interactions
      return 10; // Trending boost
    }
    
    if (engagementRate > 0.25 && engagement > 5) { // Very high engagement
      return 15; // Higher trending boost
    }
    
    return 0;
  }

  /**
   * Report a feed post
   */
  async reportPost(postId: string, userId: string, reportData: {
    reason: string;
    description?: string;
  }): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if post exists
      const { data: post, error: postError } = await this.supabase
        .from('feed_posts')
        .select('id, author_id, content')
        .eq('id', postId)
        .single();

      if (postError || !post) {
        console.error('🔴 [REPORT] Error fetching post:', {
          postId,
          postError,
          errorCode: postError?.code,
          errorMessage: postError?.message,
          errorDetails: postError?.details
        });
        logger.error('Error fetching post for report', {
          postId,
          postError,
          errorCode: postError?.code,
          errorMessage: postError?.message,
          errorDetails: postError?.details
        });
        return { success: false, error: 'Post not found' };
      }

      // Check if user already reported this post
      const { data: existingReport, error: checkError } = await this.supabase
        .from('post_reports')
        .select('id')
        .eq('post_id', postId)
        .eq('reporter_id', userId)
        .eq('status', 'pending')
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        logger.error('Error checking existing report', { error: checkError });
        return { success: false, error: 'Failed to check existing reports' };
      }

      if (existingReport) {
        return { success: false, error: 'You have already reported this post' };
      }

      // Add report
      const { error } = await this.supabase
        .from('post_reports')
        .insert({
          post_id: postId,
          reporter_id: userId,
          reason: reportData.reason,
          description: reportData.description,
          status: 'pending'
        });

      if (error) {
        logger.error('Error creating report', { error });
        return { success: false, error: 'Failed to submit report' };
      }

      // Send acknowledgment notification to reporter
      try {
        await notificationService.sendReportAcknowledgment(
          userId,
          'post',
          postId,
          reportData.reason
        );
      } catch (notificationError) {
        logger.warn('Failed to send report acknowledgment', { 
          error: notificationError,
          reporterId: userId,
          postId 
        });
        // Don't fail the report if notification fails
      }

      // Check if this post should trigger admin alerts
      const { data: reportCount } = await this.supabase
        .from('post_reports')
        .select('id', { count: 'exact' })
        .eq('post_id', postId)
        .eq('status', 'pending');

      const count = reportCount?.length || 0;

      // Send admin alerts for high report counts
      if (count >= 3) {
        try {
          const priority = count >= 7 ? 'critical' : 'high';
          await notificationService.sendAdminModerationAlert(
            'post',
            postId,
            priority,
            `Multiple reports received: ${reportData.reason}`,
            count,
            post.author_id
          );
        } catch (alertError) {
          logger.warn('Failed to send admin moderation alert', { 
            error: alertError,
            postId,
            reportCount: count 
          });
        }
      }

      logger.info('Post reported successfully', {
        postId,
        reporterId: userId,
        reason: reportData.reason,
        totalReports: count
      });

      return { success: true };

    } catch (error) {
      logger.error('Error in reportPost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  // =============================================================================
  // SAVED FEEDS FUNCTIONALITY
  // =============================================================================

  /**
   * Save/bookmark a feed post
   */
  async savePost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check if post exists
      const { data: post, error: postError } = await this.supabase
        .from('feed_posts')
        .select('id')
        .eq('id', postId)
        .eq('status', 'active')
        .single();

      if (postError || !post) {
        return { success: false, error: 'Post not found' };
      }

      // Insert into saved_feeds (unique constraint will prevent duplicates)
      const { error: saveError } = await this.supabase
        .from('saved_feeds')
        .insert({
          user_id: userId,
          post_id: postId,
          created_at: new Date().toISOString()
        });

      // Ignore duplicate error (23505 = unique_violation)
      if (saveError && saveError.code !== '23505') {
        logger.error('Error saving post', { error: saveError });
        return { success: false, error: 'Failed to save post' };
      }

      logger.info('Post saved successfully', { userId, postId });
      return { success: true };

    } catch (error) {
      logger.error('Error in savePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Unsave/unbookmark a feed post
   */
  async unsavePost(userId: string, postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const { error: deleteError } = await this.supabase
        .from('saved_feeds')
        .delete()
        .eq('user_id', userId)
        .eq('post_id', postId);

      if (deleteError) {
        logger.error('Error unsaving post', { error: deleteError });
        return { success: false, error: 'Failed to unsave post' };
      }

      logger.info('Post unsaved successfully', { userId, postId });
      return { success: true };

    } catch (error) {
      logger.error('Error in unsavePost', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get user's saved/bookmarked posts
   */
  async getSavedPosts(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<{
    success: boolean;
    posts?: FeedPost[];
    total?: number;
    pagination?: { limit: number; offset: number; total: number; hasMore: boolean };
    error?: string
  }> {
    try {
      const limit = Math.min(options.limit || 20, 50);
      const offset = options.offset || 0;

      // Get saved post IDs with count
      const { data: savedFeeds, error: savedError, count } = await this.supabase
        .from('saved_feeds')
        .select('post_id, created_at', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (savedError) {
        logger.error('Error fetching saved feeds', { error: savedError });
        return { success: false, error: 'Failed to fetch saved posts' };
      }

      if (!savedFeeds || savedFeeds.length === 0) {
        return {
          success: true,
          posts: [],
          total: 0,
          pagination: { limit, offset, total: 0, hasMore: false }
        };
      }

      const postIds = savedFeeds.map(sf => sf.post_id);

      // Fetch the actual posts with all details
      const { data: posts, error: postsError } = await this.supabase
        .from('feed_posts')
        .select(`
          id,
          author_id,
          content,
          category,
          location_tag,
          tagged_shop_id,
          hashtags,
          status,
          like_count,
          comment_count,
          view_count,
          report_count,
          is_featured,
          created_at,
          updated_at,
          source_type,
          source_id,
          author:users!feed_posts_author_id_fkey (
            id,
            name,
            nickname,
            profile_image_url,
            is_influencer
          ),
          images:post_images (
            id,
            image_url,
            alt_text,
            display_order
          ),
          tagged_shop:shops!feed_posts_tagged_shop_id_fkey (
            id,
            name,
            main_category
          )
        `)
        .in('id', postIds)
        .eq('status', 'active');

      if (postsError) {
        logger.error('Error fetching saved posts details', { error: postsError });
        return { success: false, error: 'Failed to fetch saved posts' };
      }

      // Sort posts by saved order and add saved marker
      const postMap = new Map(posts?.map(p => [p.id, p]) || []);
      const orderedPosts = savedFeeds
        .map(sf => {
          const post = postMap.get(sf.post_id);
          if (post) {
            return {
              ...post,
              is_saved: true,
              saved_at: sf.created_at
            };
          }
          return null;
        })
        .filter(Boolean) as unknown as FeedPost[];

      // Add like status for current user
      const postsWithLikes = await this.addUserSpecificData(orderedPosts, userId);

      // Mark all as saved
      const finalPosts = postsWithLikes.map(p => ({ ...p, is_saved: true }));

      return {
        success: true,
        posts: finalPosts,
        total: count || 0,
        pagination: {
          limit,
          offset,
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        }
      };

    } catch (error) {
      logger.error('Error in getSavedPosts', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Check if a post is saved by the user
   */
  async isPostSaved(userId: string, postId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('saved_feeds')
        .select('id')
        .eq('user_id', userId)
        .eq('post_id', postId)
        .maybeSingle();

      if (error) {
        logger.error('Error checking if post is saved', { error });
        return false;
      }

      return !!data;

    } catch (error) {
      logger.error('Error in isPostSaved', { error: error instanceof Error ? error.message : 'Unknown error' });
      return false;
    }
  }

  /**
   * Add saved status to posts for a user
   */
  async addSavedStatus(posts: FeedPost[], userId: string): Promise<FeedPost[]> {
    try {
      if (posts.length === 0) return posts;

      const postIds = posts.map(p => p.id);

      const { data: savedFeeds } = await this.supabase
        .from('saved_feeds')
        .select('post_id')
        .eq('user_id', userId)
        .in('post_id', postIds);

      const savedPostIds = new Set(savedFeeds?.map(sf => sf.post_id) || []);

      return posts.map(post => ({
        ...post,
        is_saved: savedPostIds.has(post.id)
      }));

    } catch (error) {
      logger.error('Error adding saved status', { error: error instanceof Error ? error.message : 'Unknown error' });
      return posts;
    }
  }

  // =============================================================================
  // USER FEED PROFILE
  // =============================================================================

  /**
   * Get user's feed profile with their posts
   */
  async getUserFeedProfile(
    userId: string,
    viewerId?: string,
    options: { postLimit?: number } = {}
  ): Promise<{
    success: boolean;
    profile?: {
      id: string;
      nickname: string;
      profile_image_url: string | null;
      bio: string | null;
      post_count: number;
      posts: FeedPost[];
    };
    error?: string;
  }> {
    try {
      const postLimit = Math.min(options.postLimit || 50, 100);

      // Get user info
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, name, nickname, profile_image_url, bio')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return { success: false, error: 'User not found' };
      }

      // Get user's posts with count
      const { data: posts, error: postsError, count } = await this.supabase
        .from('feed_posts')
        .select(`
          id,
          author_id,
          content,
          category,
          location_tag,
          tagged_shop_id,
          hashtags,
          status,
          like_count,
          comment_count,
          view_count,
          report_count,
          is_featured,
          created_at,
          updated_at,
          source_type,
          source_id,
          images:post_images (
            id,
            image_url,
            alt_text,
            display_order
          )
        `, { count: 'exact' })
        .eq('author_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(postLimit);

      if (postsError) {
        logger.error('Error fetching user posts', { error: postsError });
        return { success: false, error: 'Failed to fetch user posts' };
      }

      // Add user data as author to each post
      const postsWithAuthor = (posts || []).map(post => ({
        ...post,
        author: {
          id: user.id,
          name: user.name,
          nickname: user.nickname,
          profile_image_url: user.profile_image_url,
          is_influencer: false // Will be updated if needed
        }
      }));

      // If viewer is logged in, add like and saved status
      let finalPosts = postsWithAuthor as FeedPost[];
      if (viewerId) {
        finalPosts = await this.addUserSpecificData(finalPosts, viewerId);
        finalPosts = await this.addSavedStatus(finalPosts, viewerId);
      }

      return {
        success: true,
        profile: {
          id: user.id,
          nickname: user.nickname || user.name,
          profile_image_url: user.profile_image_url,
          bio: user.bio,
          post_count: count || 0,
          posts: finalPosts
        }
      };

    } catch (error) {
      logger.error('Error in getUserFeedProfile', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update user bio
   */
  async updateUserBio(userId: string, bio: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Validate bio length (max 500 characters)
      if (bio && bio.length > 500) {
        return { success: false, error: 'Bio must be 500 characters or less' };
      }

      const { error: updateError } = await this.supabase
        .from('users')
        .update({ bio, updated_at: new Date().toISOString() })
        .eq('id', userId);

      if (updateError) {
        logger.error('Error updating user bio', { error: updateError });
        return { success: false, error: 'Failed to update bio' };
      }

      logger.info('User bio updated successfully', { userId });
      return { success: true };

    } catch (error) {
      logger.error('Error in updateUserBio', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }
}

export const feedService = new FeedService();
