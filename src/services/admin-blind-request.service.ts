/**
 * Admin Blind Request Service
 *
 * Handles blind request processing for super admins
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  ReviewBlindRequest,
  ProcessBlindRequestDto,
  BlindRequestStats,
} from '../types/review-reply.types';

export class AdminBlindRequestServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'AdminBlindRequestServiceError';
  }
}

interface BlindRequestWithDetails {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  reasonCategory: string;
  evidenceUrls?: string[];
  status: string;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Date;
  createdAt: Date;
  review: {
    id: string;
    content: string;
    rating: number;
    images?: string[];
    createdAt: Date;
    user: {
      nickname: string;
      profileImage?: string;
    };
  };
  shop: {
    id: string;
    name: string;
    profileImage?: string;
  };
}

class AdminBlindRequestServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Get all blind requests for admin review
   */
  async getBlindRequests(options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    sortBy?: 'newest' | 'oldest';
  } = {}): Promise<{ requests: BlindRequestWithDetails[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, status = 'pending', sortBy = 'newest' } = options;
    const offset = (page - 1) * limit;

    try {
      let query = this.supabase
        .from('review_blind_requests')
        .select(`
          id,
          review_id,
          shop_id,
          reason,
          reason_category,
          evidence_urls,
          status,
          admin_notes,
          processed_by,
          processed_at,
          created_at,
          reviews:review_id (
            id,
            content,
            rating,
            images,
            created_at,
            users:user_id (
              nickname,
              profile_image
            )
          ),
          shops:shop_id (
            id,
            name,
            profile_image
          )
        `, { count: 'exact' });

      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) {
        logger.error('Failed to fetch blind requests', { error: error.message });
        throw new AdminBlindRequestServiceError(
          `Failed to fetch blind requests: ${error.message}`,
          'FETCH_BLIND_REQUESTS_FAILED',
          500
        );
      }

      const requests: BlindRequestWithDetails[] = (data || []).map((request: any) => ({
        id: request.id,
        reviewId: request.review_id,
        shopId: request.shop_id,
        reason: request.reason,
        reasonCategory: request.reason_category,
        evidenceUrls: request.evidence_urls,
        status: request.status,
        adminNotes: request.admin_notes,
        processedBy: request.processed_by,
        processedAt: request.processed_at ? new Date(request.processed_at) : undefined,
        createdAt: new Date(request.created_at),
        review: {
          id: request.reviews?.id,
          content: request.reviews?.content || '',
          rating: request.reviews?.rating || 0,
          images: request.reviews?.images,
          createdAt: request.reviews?.created_at ? new Date(request.reviews.created_at) : new Date(),
          user: {
            nickname: request.reviews?.users?.nickname || 'Unknown',
            profileImage: request.reviews?.users?.profile_image,
          },
        },
        shop: {
          id: request.shops?.id,
          name: request.shops?.name || 'Unknown',
          profileImage: request.shops?.profile_image,
        },
      }));

      return {
        requests,
        total: count || 0,
        hasMore: (count || 0) > offset + limit,
      };
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) throw error;
      logger.error('Unexpected error fetching blind requests', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new AdminBlindRequestServiceError(
        'An unexpected error occurred while fetching blind requests',
        'FETCH_BLIND_REQUESTS_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Get a single blind request by ID
   */
  async getBlindRequestById(requestId: string): Promise<BlindRequestWithDetails | null> {
    try {
      const { data, error } = await this.supabase
        .from('review_blind_requests')
        .select(`
          id,
          review_id,
          shop_id,
          reason,
          reason_category,
          evidence_urls,
          status,
          admin_notes,
          processed_by,
          processed_at,
          created_at,
          reviews:review_id (
            id,
            content,
            rating,
            images,
            created_at,
            users:user_id (
              nickname,
              profile_image
            )
          ),
          shops:shop_id (
            id,
            name,
            profile_image,
            user_id
          )
        `)
        .eq('id', requestId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        logger.error('Failed to fetch blind request', { error: error.message, requestId });
        throw new AdminBlindRequestServiceError(
          `Failed to fetch blind request: ${error.message}`,
          'FETCH_BLIND_REQUEST_FAILED',
          500
        );
      }

      // Supabase returns related data - handle both single object and array cases
      const reviewData = Array.isArray(data.reviews) ? data.reviews[0] : data.reviews;
      const shopData = Array.isArray(data.shops) ? data.shops[0] : data.shops;
      const userData = reviewData?.users
        ? (Array.isArray(reviewData.users) ? reviewData.users[0] : reviewData.users)
        : null;

      return {
        id: data.id,
        reviewId: data.review_id,
        shopId: data.shop_id,
        reason: data.reason,
        reasonCategory: data.reason_category,
        evidenceUrls: data.evidence_urls,
        status: data.status,
        adminNotes: data.admin_notes,
        processedBy: data.processed_by,
        processedAt: data.processed_at ? new Date(data.processed_at) : undefined,
        createdAt: new Date(data.created_at),
        review: {
          id: reviewData?.id,
          content: reviewData?.content || '',
          rating: reviewData?.rating || 0,
          images: reviewData?.images,
          createdAt: reviewData?.created_at ? new Date(reviewData.created_at) : new Date(),
          user: {
            nickname: userData?.nickname || 'Unknown',
            profileImage: userData?.profile_image,
          },
        },
        shop: {
          id: shopData?.id,
          name: shopData?.name || 'Unknown',
          profileImage: shopData?.profile_image,
        },
      };
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) throw error;
      logger.error('Unexpected error fetching blind request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw new AdminBlindRequestServiceError(
        'An unexpected error occurred while fetching the blind request',
        'FETCH_BLIND_REQUEST_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Process a blind request (approve or reject)
   */
  async processBlindRequest(
    requestId: string,
    adminUserId: string,
    dto: ProcessBlindRequestDto
  ): Promise<ReviewBlindRequest> {
    try {
      // Get the request first
      const { data: request, error: fetchError } = await this.supabase
        .from('review_blind_requests')
        .select('*, shops:shop_id (user_id)')
        .eq('id', requestId)
        .single();

      if (fetchError || !request) {
        throw new AdminBlindRequestServiceError(
          'Blind request not found',
          'BLIND_REQUEST_NOT_FOUND',
          404
        );
      }

      if (request.status !== 'pending') {
        throw new AdminBlindRequestServiceError(
          'This request has already been processed',
          'BLIND_REQUEST_ALREADY_PROCESSED',
          409
        );
      }

      // Update the request
      const { data, error } = await this.supabase
        .from('review_blind_requests')
        .update({
          status: dto.status,
          admin_notes: dto.adminNotes || null,
          processed_by: adminUserId,
          processed_at: new Date().toISOString(),
        })
        .eq('id', requestId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to process blind request', { error: error.message, requestId });
        throw new AdminBlindRequestServiceError(
          `Failed to process blind request: ${error.message}`,
          'PROCESS_BLIND_REQUEST_FAILED',
          500
        );
      }

      // If approved, blind the review
      if (dto.status === 'approved') {
        const { error: updateError } = await this.supabase
          .from('reviews')
          .update({
            is_blinded: true,
            blinded_at: new Date().toISOString(),
            blinded_reason: request.reason_category,
          })
          .eq('id', request.review_id);

        if (updateError) {
          logger.error('Failed to blind review', { error: updateError.message, reviewId: request.review_id });
          // Don't throw - the request was processed, just log the error
        }
      }

      logger.info('Blind request processed', {
        requestId,
        status: dto.status,
        adminUserId,
        reviewId: request.review_id
      });

      return {
        id: data.id,
        reviewId: data.review_id,
        shopId: data.shop_id,
        reason: data.reason,
        reasonCategory: data.reason_category,
        evidenceUrls: data.evidence_urls,
        status: data.status,
        adminNotes: data.admin_notes,
        processedBy: data.processed_by,
        processedAt: data.processed_at ? new Date(data.processed_at) : undefined,
        createdAt: new Date(data.created_at),
      };
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) throw error;
      logger.error('Unexpected error processing blind request', {
        error: error instanceof Error ? error.message : 'Unknown error',
        requestId
      });
      throw new AdminBlindRequestServiceError(
        'An unexpected error occurred while processing the blind request',
        'PROCESS_BLIND_REQUEST_UNEXPECTED_ERROR',
        500
      );
    }
  }

  /**
   * Get statistics for blind requests
   */
  async getBlindRequestStats(): Promise<BlindRequestStats> {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data: stats, error } = await this.supabase
        .from('review_blind_requests')
        .select('status, processed_at');

      if (error) {
        logger.error('Failed to fetch blind request stats', { error: error.message });
        throw new AdminBlindRequestServiceError(
          'Failed to fetch statistics',
          'FETCH_STATS_FAILED',
          500
        );
      }

      const pending = (stats || []).filter(s => s.status === 'pending').length;
      const approvedToday = (stats || []).filter(s =>
        s.status === 'approved' &&
        s.processed_at &&
        new Date(s.processed_at) >= today
      ).length;
      const rejectedToday = (stats || []).filter(s =>
        s.status === 'rejected' &&
        s.processed_at &&
        new Date(s.processed_at) >= today
      ).length;
      const totalProcessed = (stats || []).filter(s => s.status !== 'pending').length;

      return { pending, approvedToday, rejectedToday, totalProcessed };
    } catch (error) {
      if (error instanceof AdminBlindRequestServiceError) throw error;
      logger.error('Unexpected error fetching blind request stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new AdminBlindRequestServiceError(
        'An unexpected error occurred while fetching statistics',
        'FETCH_STATS_UNEXPECTED_ERROR',
        500
      );
    }
  }
}

export const adminBlindRequestService = new AdminBlindRequestServiceImpl();
