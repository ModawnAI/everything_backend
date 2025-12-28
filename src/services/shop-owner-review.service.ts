/**
 * Shop Owner Review Service
 *
 * Handles review management for shop owners including replies and blind requests
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  CreateReplyDto,
  UpdateReplyDto,
  CreateBlindRequestDto,
  ShopReviewWithReply,
  ReviewReply,
  ReviewBlindRequest,
  ReviewStats,
} from '../types/review-reply.types';

export class ShopOwnerReviewServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'ShopOwnerReviewServiceError';
  }
}

class ShopOwnerReviewServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Get all reviews for a shop with replies and blind request status
   */
  async getShopReviews(
    shopId: string,
    options: {
      page?: number;
      limit?: number;
      status?: 'all' | 'replied' | 'unreplied' | 'blinded';
      sortBy?: 'newest' | 'oldest' | 'rating_high' | 'rating_low';
    } = {}
  ): Promise<{ reviews: ShopReviewWithReply[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, status = 'all', sortBy = 'newest' } = options;
    const offset = (page - 1) * limit;

    try {
      // Build query
      let query = this.supabase
        .from('reviews')
        .select(`
          id,
          user_id,
          rating,
          content,
          images,
          is_blinded,
          created_at,
          users:user_id (
            nickname,
            profile_image
          ),
          review_replies (
            id,
            reply_text,
            created_by,
            created_at,
            updated_at
          ),
          review_blind_requests (
            id,
            reason,
            reason_category,
            status,
            created_at
          )
        `, { count: 'exact' })
        .eq('shop_id', shopId);

      // Apply status filter
      if (status === 'replied') {
        query = query.not('review_replies', 'is', null);
      } else if (status === 'unreplied') {
        query = query.is('review_replies', null);
      } else if (status === 'blinded') {
        query = query.eq('is_blinded', true);
      }

      // Apply sorting
      switch (sortBy) {
        case 'oldest':
          query = query.order('created_at', { ascending: true });
          break;
        case 'rating_high':
          query = query.order('rating', { ascending: false });
          break;
        case 'rating_low':
          query = query.order('rating', { ascending: true });
          break;
        default:
          query = query.order('created_at', { ascending: false });
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch shop reviews', { error: error.message, shopId });
        throw new ShopOwnerReviewServiceError(
          `Failed to fetch reviews: ${error.message}`,
          'FETCH_REVIEWS_FAILED',
          500
        );
      }

      const reviews: ShopReviewWithReply[] = (data || []).map((review: any) => ({
        id: review.id,
        userId: review.user_id,
        userName: review.users?.nickname || 'Unknown',
        userProfileImage: review.users?.profile_image,
        rating: review.rating,
        content: review.content,
        images: review.images,
        createdAt: new Date(review.created_at),
        isBlinded: review.is_blinded || false,
        reply: review.review_replies?.[0] ? {
          id: review.review_replies[0].id,
          reviewId: review.id,
          shopId,
          replyText: review.review_replies[0].reply_text,
          createdBy: review.review_replies[0].created_by,
          createdAt: new Date(review.review_replies[0].created_at),
          updatedAt: new Date(review.review_replies[0].updated_at),
        } : undefined,
        blindRequest: review.review_blind_requests?.[0] ? {
          id: review.review_blind_requests[0].id,
          reviewId: review.id,
          shopId,
          reason: review.review_blind_requests[0].reason,
          reasonCategory: review.review_blind_requests[0].reason_category,
          status: review.review_blind_requests[0].status,
          createdAt: new Date(review.review_blind_requests[0].created_at),
        } : undefined,
      }));

      return {
        reviews,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      };
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error fetching shop reviews', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while fetching reviews',
        'FETCH_REVIEWS_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Reply to a review
   */
  async replyToReview(
    reviewId: string,
    shopId: string,
    userId: string,
    dto: CreateReplyDto
  ): Promise<ReviewReply> {
    try {
      // Verify review belongs to shop
      const { data: review, error: reviewError } = await this.supabase
        .from('reviews')
        .select('id, user_id, shop_id')
        .eq('id', reviewId)
        .eq('shop_id', shopId)
        .single();

      if (reviewError || !review) {
        throw new ShopOwnerReviewServiceError(
          'Review not found or does not belong to this shop',
          'REVIEW_NOT_FOUND',
          404
        );
      }

      // Check if reply already exists
      const { data: existingReply } = await this.supabase
        .from('review_replies')
        .select('id')
        .eq('review_id', reviewId)
        .single();

      if (existingReply) {
        throw new ShopOwnerReviewServiceError(
          'A reply already exists for this review. Use update instead.',
          'REPLY_ALREADY_EXISTS',
          409
        );
      }

      // Create reply
      const { data, error } = await this.supabase
        .from('review_replies')
        .insert({
          review_id: reviewId,
          shop_id: shopId,
          reply_text: dto.replyText,
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create review reply', { error: error.message, reviewId, shopId });
        throw new ShopOwnerReviewServiceError(
          `Failed to create reply: ${error.message}`,
          'CREATE_REPLY_FAILED',
          500
        );
      }

      logger.info('Review reply created', { replyId: data.id, reviewId, shopId });

      return {
        id: data.id,
        reviewId: data.review_id,
        shopId: data.shop_id,
        replyText: data.reply_text,
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error creating reply', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while creating the reply',
        'CREATE_REPLY_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Update an existing reply
   */
  async updateReply(
    replyId: string,
    shopId: string,
    dto: UpdateReplyDto
  ): Promise<ReviewReply> {
    try {
      const { data, error } = await this.supabase
        .from('review_replies')
        .update({
          reply_text: dto.replyText,
          updated_at: new Date().toISOString(),
        })
        .eq('id', replyId)
        .eq('shop_id', shopId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update reply', { error: error.message, replyId, shopId });
        throw new ShopOwnerReviewServiceError(
          `Failed to update reply: ${error.message}`,
          'UPDATE_REPLY_FAILED',
          500
        );
      }

      if (!data) {
        throw new ShopOwnerReviewServiceError(
          'Reply not found or does not belong to this shop',
          'REPLY_NOT_FOUND',
          404
        );
      }

      logger.info('Review reply updated', { replyId, shopId });

      return {
        id: data.id,
        reviewId: data.review_id,
        shopId: data.shop_id,
        replyText: data.reply_text,
        createdBy: data.created_by,
        createdAt: new Date(data.created_at),
        updatedAt: new Date(data.updated_at),
      };
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error updating reply', {
        error: error instanceof Error ? error.message : 'Unknown error',
        replyId,
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while updating the reply',
        'UPDATE_REPLY_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Delete a reply
   */
  async deleteReply(replyId: string, shopId: string): Promise<void> {
    try {
      const { error, count } = await this.supabase
        .from('review_replies')
        .delete()
        .eq('id', replyId)
        .eq('shop_id', shopId);

      if (error) {
        logger.error('Failed to delete reply', { error: error.message, replyId, shopId });
        throw new ShopOwnerReviewServiceError(
          `Failed to delete reply: ${error.message}`,
          'DELETE_REPLY_FAILED',
          500
        );
      }

      logger.info('Review reply deleted', { replyId, shopId });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error deleting reply', {
        error: error instanceof Error ? error.message : 'Unknown error',
        replyId,
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while deleting the reply',
        'DELETE_REPLY_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Request blind processing for a malicious review
   */
  async requestBlind(
    reviewId: string,
    shopId: string,
    dto: CreateBlindRequestDto
  ): Promise<ReviewBlindRequest> {
    try {
      // Verify review belongs to shop
      const { data: review, error: reviewError } = await this.supabase
        .from('reviews')
        .select('id, shop_id, is_blinded')
        .eq('id', reviewId)
        .eq('shop_id', shopId)
        .single();

      if (reviewError || !review) {
        throw new ShopOwnerReviewServiceError(
          'Review not found or does not belong to this shop',
          'REVIEW_NOT_FOUND',
          404
        );
      }

      if (review.is_blinded) {
        throw new ShopOwnerReviewServiceError(
          'This review is already blinded',
          'REVIEW_ALREADY_BLINDED',
          409
        );
      }

      // Check if request already exists
      const { data: existingRequest } = await this.supabase
        .from('review_blind_requests')
        .select('id, status')
        .eq('review_id', reviewId)
        .eq('shop_id', shopId)
        .single();

      if (existingRequest) {
        if (existingRequest.status === 'pending') {
          throw new ShopOwnerReviewServiceError(
            'A blind request is already pending for this review',
            'BLIND_REQUEST_PENDING',
            409
          );
        } else if (existingRequest.status === 'approved') {
          throw new ShopOwnerReviewServiceError(
            'This review is already blinded',
            'REVIEW_ALREADY_BLINDED',
            409
          );
        }
        // If rejected, allow re-submission by updating
      }

      // Create or update blind request
      const { data, error } = await this.supabase
        .from('review_blind_requests')
        .upsert({
          review_id: reviewId,
          shop_id: shopId,
          reason: dto.reason,
          reason_category: dto.reasonCategory,
          evidence_urls: dto.evidenceUrls || [],
          status: 'pending',
        }, {
          onConflict: 'review_id,shop_id',
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create blind request', { error: error.message, reviewId, shopId });
        throw new ShopOwnerReviewServiceError(
          `Failed to create blind request: ${error.message}`,
          'CREATE_BLIND_REQUEST_FAILED',
          500
        );
      }

      logger.info('Blind request created', { requestId: data.id, reviewId, shopId });

      return {
        id: data.id,
        reviewId: data.review_id,
        shopId: data.shop_id,
        reason: data.reason,
        reasonCategory: data.reason_category,
        evidenceUrls: data.evidence_urls,
        status: data.status,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error creating blind request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reviewId,
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while creating the blind request',
        'CREATE_BLIND_REQUEST_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Get review statistics for shop
   */
  async getReviewStats(shopId: string): Promise<ReviewStats> {
    try {
      // Get all reviews for the shop
      const { data: reviews, error: reviewsError } = await this.supabase
        .from('reviews')
        .select('id, rating, is_blinded')
        .eq('shop_id', shopId);

      if (reviewsError) {
        logger.error('Failed to fetch reviews for stats', { error: reviewsError.message, shopId });
        throw new ShopOwnerReviewServiceError(
          'Failed to fetch review statistics',
          'FETCH_STATS_FAILED',
          500
        );
      }

      // Get replies count
      const { data: replies, error: repliesError } = await this.supabase
        .from('review_replies')
        .select('review_id')
        .eq('shop_id', shopId);

      if (repliesError) {
        logger.error('Failed to fetch replies for stats', { error: repliesError.message, shopId });
      }

      // Get pending blind requests count
      const { data: blindRequests, error: blindError } = await this.supabase
        .from('review_blind_requests')
        .select('id')
        .eq('shop_id', shopId)
        .eq('status', 'pending');

      if (blindError) {
        logger.error('Failed to fetch blind requests for stats', { error: blindError.message, shopId });
      }

      const repliedReviewIds = new Set((replies || []).map(r => r.review_id));
      const totalReviews = reviews?.length || 0;
      const totalRating = (reviews || []).reduce((sum, r) => sum + r.rating, 0);

      return {
        totalReviews,
        averageRating: totalReviews > 0 ? totalRating / totalReviews : 0,
        repliedCount: repliedReviewIds.size,
        unrepliedCount: totalReviews - repliedReviewIds.size,
        blindedCount: (reviews || []).filter(r => r.is_blinded).length,
        pendingBlindRequests: blindRequests?.length || 0,
      };
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) throw error;
      logger.error('Unexpected error fetching review stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
      throw new ShopOwnerReviewServiceError(
        'An unexpected error occurred while fetching statistics',
        'FETCH_STATS_UNEXPECTED_ERROR',
        500
      );
    }
  }
}

export const shopOwnerReviewService = new ShopOwnerReviewServiceImpl();
