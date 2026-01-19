/**
 * Review Service
 *
 * Handles shop reviews with auto-post to feed functionality
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { feedService } from './feed.service';
import { pointService } from './point.service';
import { POINT_POLICY_V32 } from '../constants/point-policies';

export interface Review {
  id: string;
  user_id: string;
  shop_id: string;
  reservation_id?: string;
  rating: number;
  content?: string;
  images: Array<{ url: string; alt_text?: string }>;
  status: 'active' | 'hidden' | 'deleted';
  owner_response?: string;
  owner_response_at?: string;
  is_verified: boolean;
  auto_posted_to_feed: boolean;
  feed_post_id?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  user?: {
    id: string;
    name: string;
    nickname?: string;
    profile_image_url?: string;
  };
  shop?: {
    id: string;
    name: string;
    main_category?: string;
  };
}

export interface CreateReviewData {
  user_id: string;
  shop_id: string;
  reservation_id?: string;
  rating: number;
  content?: string;
  images?: Array<{ url: string; alt_text?: string }>;
}

export interface ReviewResult {
  success: boolean;
  review?: Review;
  error?: string;
}

export interface ReviewsListResult {
  success: boolean;
  reviews?: Review[];
  total?: number;
  pagination?: {
    limit: number;
    offset: number;
    total: number;
    hasMore: boolean;
  };
  error?: string;
}

/**
 * Review Service
 * Manages shop reviews and auto-posting to feed
 */
export class ReviewService {
  private supabase = getSupabaseClient();

  /**
   * Create a review with optional auto-post to feed
   */
  async createReview(
    data: CreateReviewData,
    options: { autoPostToFeed?: boolean } = {}
  ): Promise<ReviewResult> {
    try {
      const { autoPostToFeed = false } = options;

      // Validate rating
      if (data.rating < 1 || data.rating > 5) {
        return { success: false, error: 'Rating must be between 1 and 5' };
      }

      // Check if shop exists
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, name, main_category')
        .eq('id', data.shop_id)
        .single();

      if (shopError || !shop) {
        return { success: false, error: 'Shop not found' };
      }

      // Check for duplicate review (one review per reservation)
      if (data.reservation_id) {
        const { data: existingReview } = await this.supabase
          .from('reviews')
          .select('id')
          .eq('reservation_id', data.reservation_id)
          .eq('user_id', data.user_id)
          .maybeSingle();

        if (existingReview) {
          return { success: false, error: 'You have already reviewed this reservation' };
        }
      }

      const now = new Date().toISOString();

      // Create the review
      const { data: review, error: reviewError } = await this.supabase
        .from('reviews')
        .insert({
          user_id: data.user_id,
          shop_id: data.shop_id,
          reservation_id: data.reservation_id,
          rating: data.rating,
          content: data.content,
          images: data.images || [],
          status: 'active',
          is_verified: !!data.reservation_id, // Verified if from a reservation
          auto_posted_to_feed: false,
          created_at: now,
          updated_at: now
        })
        .select()
        .single();

      if (reviewError) {
        logger.error('Error creating review', { error: reviewError });
        return { success: false, error: 'Failed to create review' };
      }

      // Auto-post to feed if requested
      let feedPostId: string | undefined;
      if (autoPostToFeed && data.content) {
        const feedResult = await this.createFeedPostFromReview(review, shop, data);
        if (feedResult.success && feedResult.postId) {
          feedPostId = feedResult.postId;

          // Update review with feed post reference
          await this.supabase
            .from('reviews')
            .update({
              auto_posted_to_feed: true,
              feed_post_id: feedPostId
            })
            .eq('id', review.id);

          review.auto_posted_to_feed = true;
          review.feed_post_id = feedPostId;
        }
      }

      logger.info('Review created successfully', {
        reviewId: review.id,
        shopId: data.shop_id,
        userId: data.user_id,
        rating: data.rating,
        autoPosted: autoPostToFeed && !!feedPostId
      });

      // Award review points
      const hasPhotos = data.images && data.images.length > 0;
      const reviewPoints = hasPhotos
        ? POINT_POLICY_V32.REVIEW_POINTS.PHOTO
        : POINT_POLICY_V32.REVIEW_POINTS.NORMAL;

      const pointDescription = hasPhotos
        ? `포토 리뷰 작성 포인트 (${shop.name})`
        : `리뷰 작성 포인트 (${shop.name})`;

      try {
        await pointService.addPoints(
          data.user_id,
          reviewPoints,
          'earned',
          'review',
          pointDescription
        );

        logger.info('Review points awarded', {
          userId: data.user_id,
          reviewId: review.id,
          points: reviewPoints,
          hasPhotos
        });
      } catch (pointError) {
        // Log error but don't fail the review creation
        logger.error('Failed to award review points', {
          error: pointError instanceof Error ? pointError.message : 'Unknown error',
          userId: data.user_id,
          reviewId: review.id
        });
      }

      return {
        success: true,
        review: this.mapReview(review)
      };

    } catch (error) {
      logger.error('Error in createReview', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Create a feed post from a review
   */
  private async createFeedPostFromReview(
    review: any,
    shop: { id: string; name: string; main_category?: string },
    data: CreateReviewData
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    try {
      // Generate star rating display
      const stars = '⭐'.repeat(data.rating);

      // Create feed content
      const content = `${shop.name}에서 시술 받았어요! ${stars}\n\n${data.content || ''}`;

      // Transform review images to feed post format
      const images = (data.images || []).map((img, index) => ({
        image_url: img.url,
        alt_text: img.alt_text || `Review image ${index + 1}`,
        display_order: index + 1
      }));

      // Create the feed post using feed service
      const result = await feedService.createPost({
        author_id: data.user_id,
        content: content.trim(),
        category: 'review',
        tagged_shop_id: shop.id,
        hashtags: this.generateHashtags(shop),
        images
      });

      if (!result.success || !result.post) {
        logger.warn('Failed to create feed post from review', {
          reviewId: review.id,
          error: result.error
        });
        return { success: false, error: result.error };
      }

      // Update the feed post to include source reference
      await this.supabase
        .from('feed_posts')
        .update({
          source_type: 'review',
          source_id: review.id
        })
        .eq('id', result.post.id);

      logger.info('Feed post created from review', {
        reviewId: review.id,
        feedPostId: result.post.id
      });

      return { success: true, postId: result.post.id };

    } catch (error) {
      logger.error('Error creating feed post from review', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { success: false, error: 'Failed to create feed post' };
    }
  }

  /**
   * Generate hashtags for review post
   */
  private generateHashtags(shop: { name: string; main_category?: string }): string[] {
    const hashtags: string[] = ['리뷰', '후기'];

    if (shop.main_category) {
      const categoryMap: Record<string, string> = {
        'nail': '네일',
        'eyelash': '속눈썹',
        'waxing': '왁싱',
        'eyebrow': '눈썹',
        'hair': '헤어'
      };
      const koreanCategory = categoryMap[shop.main_category.toLowerCase()];
      if (koreanCategory) {
        hashtags.push(koreanCategory);
      }
    }

    // Add shop name as hashtag (cleaned)
    const cleanShopName = shop.name.replace(/[^가-힣a-zA-Z0-9]/g, '');
    if (cleanShopName.length > 0 && cleanShopName.length <= 30) {
      hashtags.push(cleanShopName);
    }

    return hashtags.slice(0, 10); // Max 10 hashtags
  }

  /**
   * Get reviews for a shop
   */
  async getShopReviews(
    shopId: string,
    options: { limit?: number; offset?: number; minRating?: number } = {}
  ): Promise<ReviewsListResult> {
    try {
      const limit = Math.min(options.limit || 20, 50);
      const offset = options.offset || 0;

      let query = this.supabase
        .from('reviews')
        .select(`
          *,
          user:users!reviews_user_id_fkey (
            id,
            name,
            nickname,
            profile_image_url
          )
        `, { count: 'exact' })
        .eq('shop_id', shopId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (options.minRating) {
        query = query.gte('rating', options.minRating);
      }

      const { data, error, count } = await query;

      if (error) {
        logger.error('Error fetching shop reviews', { error, shopId });
        return { success: false, error: 'Failed to fetch reviews' };
      }

      const reviews = (data || []).map(this.mapReview);

      return {
        success: true,
        reviews,
        total: count || 0,
        pagination: {
          limit,
          offset,
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        }
      };

    } catch (error) {
      logger.error('Error in getShopReviews', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get user's reviews
   */
  async getUserReviews(
    userId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<ReviewsListResult> {
    try {
      const limit = Math.min(options.limit || 20, 50);
      const offset = options.offset || 0;

      const { data, error, count } = await this.supabase
        .from('reviews')
        .select(`
          *,
          shop:shops!reviews_shop_id_fkey (
            id,
            name,
            main_category
          )
        `, { count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        logger.error('Error fetching user reviews', { error, userId });
        return { success: false, error: 'Failed to fetch reviews' };
      }

      const reviews = (data || []).map(this.mapReview);

      return {
        success: true,
        reviews,
        total: count || 0,
        pagination: {
          limit,
          offset,
          total: count || 0,
          hasMore: (offset + limit) < (count || 0)
        }
      };

    } catch (error) {
      logger.error('Error in getUserReviews', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get a single review
   */
  async getReview(reviewId: string): Promise<ReviewResult> {
    try {
      const { data, error } = await this.supabase
        .from('reviews')
        .select(`
          *,
          user:users!reviews_user_id_fkey (
            id,
            name,
            nickname,
            profile_image_url
          ),
          shop:shops!reviews_shop_id_fkey (
            id,
            name,
            main_category
          )
        `)
        .eq('id', reviewId)
        .single();

      if (error || !data) {
        return { success: false, error: 'Review not found' };
      }

      return {
        success: true,
        review: this.mapReview(data)
      };

    } catch (error) {
      logger.error('Error in getReview', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    data: { content?: string; rating?: number; images?: Array<{ url: string; alt_text?: string }> }
  ): Promise<ReviewResult> {
    try {
      // Check ownership
      const { data: existing, error: checkError } = await this.supabase
        .from('reviews')
        .select('id, user_id')
        .eq('id', reviewId)
        .single();

      if (checkError || !existing) {
        return { success: false, error: 'Review not found' };
      }

      if (existing.user_id !== userId) {
        return { success: false, error: 'You can only update your own reviews' };
      }

      // Validate rating if provided
      if (data.rating !== undefined && (data.rating < 1 || data.rating > 5)) {
        return { success: false, error: 'Rating must be between 1 and 5' };
      }

      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString()
      };

      if (data.content !== undefined) updateData.content = data.content;
      if (data.rating !== undefined) updateData.rating = data.rating;
      if (data.images !== undefined) updateData.images = data.images;

      const { data: review, error } = await this.supabase
        .from('reviews')
        .update(updateData)
        .eq('id', reviewId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating review', { error, reviewId });
        return { success: false, error: 'Failed to update review' };
      }

      logger.info('Review updated successfully', { reviewId, userId });

      return {
        success: true,
        review: this.mapReview(review)
      };

    } catch (error) {
      logger.error('Error in updateReview', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Delete a review (soft delete)
   */
  async deleteReview(reviewId: string, userId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Check ownership
      const { data: existing, error: checkError } = await this.supabase
        .from('reviews')
        .select('id, user_id')
        .eq('id', reviewId)
        .single();

      if (checkError || !existing) {
        return { success: false, error: 'Review not found' };
      }

      if (existing.user_id !== userId) {
        return { success: false, error: 'You can only delete your own reviews' };
      }

      const { error } = await this.supabase
        .from('reviews')
        .update({ status: 'deleted', updated_at: new Date().toISOString() })
        .eq('id', reviewId);

      if (error) {
        logger.error('Error deleting review', { error, reviewId });
        return { success: false, error: 'Failed to delete review' };
      }

      logger.info('Review deleted successfully', { reviewId, userId });

      return { success: true };

    } catch (error) {
      logger.error('Error in deleteReview', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Add owner response to a review
   */
  async addOwnerResponse(
    reviewId: string,
    ownerId: string,
    response: string
  ): Promise<ReviewResult> {
    try {
      // Check if owner owns the shop for this review
      const { data: review, error: reviewError } = await this.supabase
        .from('reviews')
        .select('id, shop_id')
        .eq('id', reviewId)
        .single();

      if (reviewError || !review) {
        return { success: false, error: 'Review not found' };
      }

      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('owner_id')
        .eq('id', review.shop_id)
        .single();

      if (shopError || !shop || shop.owner_id !== ownerId) {
        return { success: false, error: 'You can only respond to reviews for your own shop' };
      }

      const { data: updated, error } = await this.supabase
        .from('reviews')
        .update({
          owner_response: response,
          owner_response_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', reviewId)
        .select()
        .single();

      if (error) {
        logger.error('Error adding owner response', { error, reviewId });
        return { success: false, error: 'Failed to add response' };
      }

      logger.info('Owner response added successfully', { reviewId, ownerId });

      return {
        success: true,
        review: this.mapReview(updated)
      };

    } catch (error) {
      logger.error('Error in addOwnerResponse', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Get shop average rating
   */
  async getShopRating(shopId: string): Promise<{ success: boolean; rating?: number; count?: number; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('reviews')
        .select('rating')
        .eq('shop_id', shopId)
        .eq('status', 'active');

      if (error) {
        logger.error('Error fetching shop rating', { error, shopId });
        return { success: false, error: 'Failed to fetch rating' };
      }

      if (!data || data.length === 0) {
        return { success: true, rating: 0, count: 0 };
      }

      const totalRating = data.reduce((sum, r) => sum + r.rating, 0);
      const avgRating = totalRating / data.length;

      return {
        success: true,
        rating: Math.round(avgRating * 10) / 10, // Round to 1 decimal
        count: data.length
      };

    } catch (error) {
      logger.error('Error in getShopRating', { error: error instanceof Error ? error.message : 'Unknown error' });
      return { success: false, error: 'Internal server error' };
    }
  }

  /**
   * Map database row to Review interface
   */
  private mapReview(data: any): Review {
    return {
      id: data.id,
      user_id: data.user_id,
      shop_id: data.shop_id,
      reservation_id: data.reservation_id,
      rating: data.rating,
      content: data.content,
      images: data.images || [],
      status: data.status,
      owner_response: data.owner_response,
      owner_response_at: data.owner_response_at,
      is_verified: data.is_verified,
      auto_posted_to_feed: data.auto_posted_to_feed,
      feed_post_id: data.feed_post_id,
      created_at: data.created_at,
      updated_at: data.updated_at,
      user: data.user,
      shop: data.shop
    };
  }
}

export const reviewService = new ReviewService();
