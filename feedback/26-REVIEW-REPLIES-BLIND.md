# Plan 26: Review Replies & Blind Request

## Overview
This plan implements the review management system for shop owners, allowing them to reply to customer reviews and request blind processing for malicious reviews. This addresses Phase 5.3 feedback items from IMPLEMENTATION_PLAN.md.

**Feedback Items Addressed:**
- 점주가 고객들이 단 리뷰에 답글 달 수 있어야 함
- 악성리뷰는 '블라인드 처리 요청' 기능

---

## 1. Database Schema

### Migration: 006_add_review_replies_table.sql

```sql
-- Review Replies Table
CREATE TABLE review_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id),
  reply_text TEXT NOT NULL,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id) -- Only one reply per review
);

-- Index for efficient lookups
CREATE INDEX idx_review_replies_review ON review_replies(review_id);
CREATE INDEX idx_review_replies_shop ON review_replies(shop_id);

-- Review Blind Requests Table
CREATE TABLE review_blind_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id),
  shop_id UUID NOT NULL REFERENCES shops(id),
  reason TEXT NOT NULL,
  reason_category VARCHAR(50), -- 'profanity', 'false_info', 'personal_attack', 'spam', 'other'
  evidence_urls TEXT[], -- Screenshots or other evidence
  status VARCHAR(20) DEFAULT 'pending', -- pending, approved, rejected
  admin_notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(review_id, shop_id) -- One request per review per shop
);

-- Index for efficient admin queries
CREATE INDEX idx_blind_requests_status ON review_blind_requests(status);
CREATE INDEX idx_blind_requests_shop ON review_blind_requests(shop_id);
CREATE INDEX idx_blind_requests_created ON review_blind_requests(created_at DESC);

-- Add is_blinded flag to reviews table if not exists
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS is_blinded BOOLEAN DEFAULT false;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS blinded_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS blinded_reason TEXT;
```

---

## 2. Backend Implementation

### 2.1 Types

**File: `src/types/review-reply.types.ts`**

```typescript
export interface ReviewReply {
  id: string;
  reviewId: string;
  shopId: string;
  replyText: string;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateReplyDto {
  replyText: string;
}

export interface UpdateReplyDto {
  replyText: string;
}

export type BlindRequestReasonCategory =
  | 'profanity'
  | 'false_info'
  | 'personal_attack'
  | 'spam'
  | 'other';

export type BlindRequestStatus = 'pending' | 'approved' | 'rejected';

export interface ReviewBlindRequest {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  reasonCategory: BlindRequestReasonCategory;
  evidenceUrls?: string[];
  status: BlindRequestStatus;
  adminNotes?: string;
  processedBy?: string;
  processedAt?: Date;
  createdAt: Date;
}

export interface CreateBlindRequestDto {
  reason: string;
  reasonCategory: BlindRequestReasonCategory;
  evidenceUrls?: string[];
}

export interface ProcessBlindRequestDto {
  status: 'approved' | 'rejected';
  adminNotes?: string;
}

export interface ShopReviewWithReply {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  content: string;
  images?: string[];
  createdAt: Date;
  isBlinded: boolean;
  reply?: ReviewReply;
  blindRequest?: ReviewBlindRequest;
}
```

### 2.2 Service Layer

**File: `src/services/shop-owner/review.service.ts`**

```typescript
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/notification.service';
import {
  CreateReplyDto,
  UpdateReplyDto,
  CreateBlindRequestDto,
  ShopReviewWithReply,
  ReviewReply,
  ReviewBlindRequest,
} from '@/types/review-reply.types';

export class ShopOwnerReviewService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

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

    // Build query
    let query = supabase
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
      throw new Error(`Failed to fetch reviews: ${error.message}`);
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
      isBlinded: review.is_blinded,
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
    // Verify review belongs to shop
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, user_id, shop_id')
      .eq('id', reviewId)
      .eq('shop_id', shopId)
      .single();

    if (reviewError || !review) {
      throw new Error('Review not found or does not belong to this shop');
    }

    // Check if reply already exists
    const { data: existingReply } = await supabase
      .from('review_replies')
      .select('id')
      .eq('review_id', reviewId)
      .single();

    if (existingReply) {
      throw new Error('A reply already exists for this review. Use update instead.');
    }

    // Create reply
    const { data, error } = await supabase
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
      throw new Error(`Failed to create reply: ${error.message}`);
    }

    // Send notification to review author
    await this.notificationService.sendNotification({
      userId: review.user_id,
      type: 'review_reply',
      title: '리뷰에 답글이 달렸어요!',
      body: '내가 작성한 리뷰에 사장님이 답글을 달았습니다.',
      data: { reviewId, shopId },
    });

    return {
      id: data.id,
      reviewId: data.review_id,
      shopId: data.shop_id,
      replyText: data.reply_text,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Update an existing reply
   */
  async updateReply(
    replyId: string,
    shopId: string,
    dto: UpdateReplyDto
  ): Promise<ReviewReply> {
    const { data, error } = await supabase
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
      throw new Error(`Failed to update reply: ${error.message}`);
    }

    if (!data) {
      throw new Error('Reply not found or does not belong to this shop');
    }

    return {
      id: data.id,
      reviewId: data.review_id,
      shopId: data.shop_id,
      replyText: data.reply_text,
      createdBy: data.created_by,
      createdAt: new Date(data.created_at),
      updatedAt: new Date(data.updated_at),
    };
  }

  /**
   * Delete a reply
   */
  async deleteReply(replyId: string, shopId: string): Promise<void> {
    const { error } = await supabase
      .from('review_replies')
      .delete()
      .eq('id', replyId)
      .eq('shop_id', shopId);

    if (error) {
      throw new Error(`Failed to delete reply: ${error.message}`);
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
    // Verify review belongs to shop
    const { data: review, error: reviewError } = await supabase
      .from('reviews')
      .select('id, shop_id')
      .eq('id', reviewId)
      .eq('shop_id', shopId)
      .single();

    if (reviewError || !review) {
      throw new Error('Review not found or does not belong to this shop');
    }

    // Check if request already exists
    const { data: existingRequest } = await supabase
      .from('review_blind_requests')
      .select('id, status')
      .eq('review_id', reviewId)
      .eq('shop_id', shopId)
      .single();

    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        throw new Error('A blind request is already pending for this review');
      } else if (existingRequest.status === 'approved') {
        throw new Error('This review is already blinded');
      }
      // If rejected, allow re-submission
    }

    // Create or update blind request
    const { data, error } = await supabase
      .from('review_blind_requests')
      .upsert({
        review_id: reviewId,
        shop_id: shopId,
        reason: dto.reason,
        reason_category: dto.reasonCategory,
        evidence_urls: dto.evidenceUrls,
        status: 'pending',
      }, {
        onConflict: 'review_id,shop_id',
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create blind request: ${error.message}`);
    }

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
  }

  /**
   * Get review statistics for shop
   */
  async getReviewStats(shopId: string): Promise<{
    totalReviews: number;
    averageRating: number;
    repliedCount: number;
    unrepliedCount: number;
    blindedCount: number;
    pendingBlindRequests: number;
  }> {
    const { data, error } = await supabase.rpc('get_shop_review_stats', {
      p_shop_id: shopId,
    });

    if (error) {
      // Fallback to manual calculation
      const { data: reviews } = await supabase
        .from('reviews')
        .select('id, rating, is_blinded')
        .eq('shop_id', shopId);

      const { data: replies } = await supabase
        .from('review_replies')
        .select('review_id')
        .eq('shop_id', shopId);

      const { data: blindRequests } = await supabase
        .from('review_blind_requests')
        .select('id')
        .eq('shop_id', shopId)
        .eq('status', 'pending');

      const repliedReviewIds = new Set(replies?.map(r => r.review_id) || []);

      return {
        totalReviews: reviews?.length || 0,
        averageRating: reviews?.length
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0,
        repliedCount: repliedReviewIds.size,
        unrepliedCount: (reviews?.length || 0) - repliedReviewIds.size,
        blindedCount: reviews?.filter(r => r.is_blinded).length || 0,
        pendingBlindRequests: blindRequests?.length || 0,
      };
    }

    return data;
  }
}
```

### 2.3 Admin Service for Blind Request Processing

**File: `src/services/admin/blind-request.service.ts`**

```typescript
import { supabase } from '@/config/supabase';
import { NotificationService } from '@/services/notification.service';
import {
  ReviewBlindRequest,
  ProcessBlindRequestDto,
} from '@/types/review-reply.types';

export class BlindRequestAdminService {
  private notificationService: NotificationService;

  constructor() {
    this.notificationService = new NotificationService();
  }

  /**
   * Get all blind requests for admin review
   */
  async getBlindRequests(options: {
    page?: number;
    limit?: number;
    status?: 'pending' | 'approved' | 'rejected' | 'all';
    sortBy?: 'newest' | 'oldest';
  } = {}): Promise<{ requests: any[]; total: number; hasMore: boolean }> {
    const { page = 1, limit = 20, status = 'pending', sortBy = 'newest' } = options;
    const offset = (page - 1) * limit;

    let query = supabase
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
      throw new Error(`Failed to fetch blind requests: ${error.message}`);
    }

    return {
      requests: data || [],
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  }

  /**
   * Process a blind request (approve or reject)
   */
  async processBlindRequest(
    requestId: string,
    adminUserId: string,
    dto: ProcessBlindRequestDto
  ): Promise<ReviewBlindRequest> {
    // Get the request first
    const { data: request, error: fetchError } = await supabase
      .from('review_blind_requests')
      .select('*, shops:shop_id (user_id)')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      throw new Error('Blind request not found');
    }

    if (request.status !== 'pending') {
      throw new Error('This request has already been processed');
    }

    // Update the request
    const { data, error } = await supabase
      .from('review_blind_requests')
      .update({
        status: dto.status,
        admin_notes: dto.adminNotes,
        processed_by: adminUserId,
        processed_at: new Date().toISOString(),
      })
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to process blind request: ${error.message}`);
    }

    // If approved, blind the review
    if (dto.status === 'approved') {
      await supabase
        .from('reviews')
        .update({
          is_blinded: true,
          blinded_at: new Date().toISOString(),
          blinded_reason: request.reason_category,
        })
        .eq('id', request.review_id);
    }

    // Notify shop owner
    const shopOwnerId = request.shops?.user_id;
    if (shopOwnerId) {
      const notificationTitle = dto.status === 'approved'
        ? '블라인드 요청이 승인되었습니다'
        : '블라인드 요청이 반려되었습니다';

      const notificationBody = dto.status === 'approved'
        ? '요청하신 리뷰가 블라인드 처리되었습니다.'
        : `요청하신 리뷰의 블라인드가 반려되었습니다. ${dto.adminNotes || ''}`;

      await this.notificationService.sendNotification({
        userId: shopOwnerId,
        type: 'blind_request_result',
        title: notificationTitle,
        body: notificationBody,
        data: { requestId, reviewId: request.review_id },
      });
    }

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
  }

  /**
   * Get statistics for blind requests
   */
  async getBlindRequestStats(): Promise<{
    pending: number;
    approvedToday: number;
    rejectedToday: number;
    totalProcessed: number;
  }> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: stats } = await supabase
      .from('review_blind_requests')
      .select('status, processed_at');

    const pending = stats?.filter(s => s.status === 'pending').length || 0;
    const approvedToday = stats?.filter(s =>
      s.status === 'approved' &&
      s.processed_at &&
      new Date(s.processed_at) >= today
    ).length || 0;
    const rejectedToday = stats?.filter(s =>
      s.status === 'rejected' &&
      s.processed_at &&
      new Date(s.processed_at) >= today
    ).length || 0;
    const totalProcessed = stats?.filter(s => s.status !== 'pending').length || 0;

    return { pending, approvedToday, rejectedToday, totalProcessed };
  }
}
```

### 2.4 Controllers

**File: `src/controllers/shop-owner/review.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { ShopOwnerReviewService } from '@/services/shop-owner/review.service';
import { successResponse, errorResponse } from '@/utils/response';

const reviewService = new ShopOwnerReviewService();

export class ShopOwnerReviewController {
  /**
   * GET /shop-owner/reviews
   */
  async getReviews(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const { page, limit, status, sortBy } = req.query;

      const result = await reviewService.getShopReviews(shopId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as any,
        sortBy: sortBy as any,
      });

      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /shop-owner/reviews/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        return errorResponse(res, 'Shop not found', 404);
      }

      const stats = await reviewService.getReviewStats(shopId);
      return successResponse(res, stats);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * POST /shop-owner/reviews/:reviewId/reply
   */
  async createReply(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const userId = req.user?.id;
      const { reviewId } = req.params;
      const { replyText } = req.body;

      if (!shopId || !userId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      if (!replyText || replyText.trim().length === 0) {
        return errorResponse(res, 'Reply text is required', 400);
      }

      const reply = await reviewService.replyToReview(reviewId, shopId, userId, {
        replyText: replyText.trim(),
      });

      return successResponse(res, reply, 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * PUT /shop-owner/reviews/:reviewId/reply
   */
  async updateReply(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { replyText, replyId } = req.body;

      if (!shopId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      if (!replyText || replyText.trim().length === 0) {
        return errorResponse(res, 'Reply text is required', 400);
      }

      const reply = await reviewService.updateReply(replyId, shopId, {
        replyText: replyText.trim(),
      });

      return successResponse(res, reply);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * DELETE /shop-owner/reviews/:reviewId/reply
   */
  async deleteReply(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { replyId } = req.body;

      if (!shopId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      await reviewService.deleteReply(replyId, shopId);
      return successResponse(res, { message: 'Reply deleted successfully' });
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }

  /**
   * POST /shop-owner/reviews/:reviewId/blind-request
   */
  async requestBlind(req: Request, res: Response) {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { reason, reasonCategory, evidenceUrls } = req.body;

      if (!shopId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      if (!reason || !reasonCategory) {
        return errorResponse(res, 'Reason and category are required', 400);
      }

      const request = await reviewService.requestBlind(reviewId, shopId, {
        reason,
        reasonCategory,
        evidenceUrls,
      });

      return successResponse(res, request, 201);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

**File: `src/controllers/admin/blind-request.controller.ts`**

```typescript
import { Request, Response } from 'express';
import { BlindRequestAdminService } from '@/services/admin/blind-request.service';
import { successResponse, errorResponse } from '@/utils/response';

const blindService = new BlindRequestAdminService();

export class BlindRequestAdminController {
  /**
   * GET /admin/blind-requests
   */
  async getRequests(req: Request, res: Response) {
    try {
      const { page, limit, status, sortBy } = req.query;

      const result = await blindService.getBlindRequests({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as any,
        sortBy: sortBy as any,
      });

      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * GET /admin/blind-requests/stats
   */
  async getStats(req: Request, res: Response) {
    try {
      const stats = await blindService.getBlindRequestStats();
      return successResponse(res, stats);
    } catch (error: any) {
      return errorResponse(res, error.message, 500);
    }
  }

  /**
   * PATCH /admin/blind-requests/:requestId
   */
  async processRequest(req: Request, res: Response) {
    try {
      const adminUserId = req.user?.id;
      const { requestId } = req.params;
      const { status, adminNotes } = req.body;

      if (!adminUserId) {
        return errorResponse(res, 'Unauthorized', 401);
      }

      if (!status || !['approved', 'rejected'].includes(status)) {
        return errorResponse(res, 'Valid status (approved/rejected) is required', 400);
      }

      const result = await blindService.processBlindRequest(requestId, adminUserId, {
        status,
        adminNotes,
      });

      return successResponse(res, result);
    } catch (error: any) {
      return errorResponse(res, error.message, 400);
    }
  }
}
```

### 2.5 Routes

**File: `src/routes/shop-owner/review.routes.ts`**

```typescript
import { Router } from 'express';
import { ShopOwnerReviewController } from '@/controllers/shop-owner/review.controller';
import { authenticate } from '@/middleware/auth';
import { shopOwnerAuth } from '@/middleware/shop-owner-auth';

const router = Router();
const controller = new ShopOwnerReviewController();

// All routes require authentication and shop owner verification
router.use(authenticate);
router.use(shopOwnerAuth);

// Review management
router.get('/', controller.getReviews.bind(controller));
router.get('/stats', controller.getStats.bind(controller));

// Reply management
router.post('/:reviewId/reply', controller.createReply.bind(controller));
router.put('/:reviewId/reply', controller.updateReply.bind(controller));
router.delete('/:reviewId/reply', controller.deleteReply.bind(controller));

// Blind request
router.post('/:reviewId/blind-request', controller.requestBlind.bind(controller));

export default router;
```

**File: `src/routes/admin/blind-request.routes.ts`**

```typescript
import { Router } from 'express';
import { BlindRequestAdminController } from '@/controllers/admin/blind-request.controller';
import { authenticate } from '@/middleware/auth';
import { superAdminAuth } from '@/middleware/super-admin-auth';

const router = Router();
const controller = new BlindRequestAdminController();

// All routes require super admin authentication
router.use(authenticate);
router.use(superAdminAuth);

router.get('/', controller.getRequests.bind(controller));
router.get('/stats', controller.getStats.bind(controller));
router.patch('/:requestId', controller.processRequest.bind(controller));

export default router;
```

---

## 3. Admin Panel Implementation

### 3.1 Shop Owner Review Management Page

**File: `src/app/dashboard/my-shop/reviews/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Space,
  Button,
  Tag,
  Modal,
  Input,
  Select,
  Rate,
  Avatar,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Form,
  Radio,
} from 'antd';
import {
  MessageOutlined,
  ExclamationCircleOutlined,
  UserOutlined,
  StarFilled,
} from '@ant-design/icons';
import { shopOwnerApi } from '@/lib/api/shop-owner';

const { TextArea } = Input;
const { Option } = Select;

interface Review {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  content: string;
  images?: string[];
  createdAt: string;
  isBlinded: boolean;
  reply?: {
    id: string;
    replyText: string;
    createdAt: string;
    updatedAt: string;
  };
  blindRequest?: {
    id: string;
    status: 'pending' | 'approved' | 'rejected';
    reason: string;
    reasonCategory: string;
  };
}

export default function ShopReviewsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('all');
  const [replyModalOpen, setReplyModalOpen] = useState(false);
  const [blindModalOpen, setBlindModalOpen] = useState(false);
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyForm] = Form.useForm();
  const [blindForm] = Form.useForm();

  // Fetch reviews
  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['shop-reviews', activeTab],
    queryFn: () => shopOwnerApi.getReviews({ status: activeTab }),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['shop-review-stats'],
    queryFn: () => shopOwnerApi.getReviewStats(),
  });

  // Reply mutation
  const replyMutation = useMutation({
    mutationFn: ({ reviewId, replyText }: { reviewId: string; replyText: string }) =>
      shopOwnerApi.replyToReview(reviewId, replyText),
    onSuccess: () => {
      message.success('답글이 등록되었습니다');
      setReplyModalOpen(false);
      replyForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['shop-reviews'] });
    },
    onError: (error: any) => {
      message.error(error.message || '답글 등록에 실패했습니다');
    },
  });

  // Blind request mutation
  const blindMutation = useMutation({
    mutationFn: (data: { reviewId: string; reason: string; reasonCategory: string }) =>
      shopOwnerApi.requestBlind(data.reviewId, data.reason, data.reasonCategory),
    onSuccess: () => {
      message.success('블라인드 요청이 접수되었습니다');
      setBlindModalOpen(false);
      blindForm.resetFields();
      queryClient.invalidateQueries({ queryKey: ['shop-reviews'] });
    },
    onError: (error: any) => {
      message.error(error.message || '블라인드 요청에 실패했습니다');
    },
  });

  const openReplyModal = (review: Review) => {
    setSelectedReview(review);
    if (review.reply) {
      replyForm.setFieldsValue({ replyText: review.reply.replyText });
    }
    setReplyModalOpen(true);
  };

  const openBlindModal = (review: Review) => {
    setSelectedReview(review);
    setBlindModalOpen(true);
  };

  const handleReplySubmit = (values: { replyText: string }) => {
    if (selectedReview) {
      replyMutation.mutate({
        reviewId: selectedReview.id,
        replyText: values.replyText,
      });
    }
  };

  const handleBlindSubmit = (values: { reason: string; reasonCategory: string }) => {
    if (selectedReview) {
      blindMutation.mutate({
        reviewId: selectedReview.id,
        ...values,
      });
    }
  };

  const columns = [
    {
      title: '고객',
      dataIndex: 'userName',
      key: 'userName',
      render: (name: string, record: Review) => (
        <Space>
          <Avatar
            src={record.userProfileImage}
            icon={<UserOutlined />}
            size="small"
          />
          <span>{name}</span>
        </Space>
      ),
    },
    {
      title: '평점',
      dataIndex: 'rating',
      key: 'rating',
      width: 150,
      render: (rating: number) => (
        <Rate disabled defaultValue={rating} style={{ fontSize: 14 }} />
      ),
    },
    {
      title: '내용',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (content: string, record: Review) => (
        <div>
          {record.isBlinded ? (
            <Tag color="red">블라인드 처리됨</Tag>
          ) : (
            <span>{content}</span>
          )}
        </div>
      ),
    },
    {
      title: '작성일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR'),
    },
    {
      title: '상태',
      key: 'status',
      width: 150,
      render: (_: any, record: Review) => (
        <Space direction="vertical" size="small">
          {record.reply && <Tag color="green">답글완료</Tag>}
          {record.blindRequest && (
            <Tag color={
              record.blindRequest.status === 'pending' ? 'orange' :
              record.blindRequest.status === 'approved' ? 'red' : 'default'
            }>
              블라인드 {
                record.blindRequest.status === 'pending' ? '대기중' :
                record.blindRequest.status === 'approved' ? '승인됨' : '반려됨'
              }
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '관리',
      key: 'actions',
      width: 180,
      render: (_: any, record: Review) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<MessageOutlined />}
            onClick={() => openReplyModal(record)}
          >
            {record.reply ? '답글 수정' : '답글 달기'}
          </Button>
          {!record.isBlinded && !record.blindRequest && (
            <Button
              danger
              size="small"
              icon={<ExclamationCircleOutlined />}
              onClick={() => openBlindModal(record)}
            >
              블라인드
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'all', label: '전체' },
    { key: 'unreplied', label: '미답변' },
    { key: 'replied', label: '답변완료' },
    { key: 'blinded', label: '블라인드' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">리뷰 관리</h1>

      {/* Stats Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="전체 리뷰"
              value={stats?.totalReviews || 0}
              suffix="개"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="평균 평점"
              value={stats?.averageRating?.toFixed(1) || 0}
              prefix={<StarFilled style={{ color: '#fadb14' }} />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="미답변 리뷰"
              value={stats?.unrepliedCount || 0}
              valueStyle={{ color: stats?.unrepliedCount > 0 ? '#cf1322' : '#3f8600' }}
              suffix="개"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="블라인드 대기"
              value={stats?.pendingBlindRequests || 0}
              suffix="개"
            />
          </Card>
        </Col>
      </Row>

      {/* Reviews Table */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
        <Table
          columns={columns}
          dataSource={reviewsData?.reviews || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: reviewsData?.total || 0,
            pageSize: 20,
            showTotal: (total) => `총 ${total}개의 리뷰`,
          }}
        />
      </Card>

      {/* Reply Modal */}
      <Modal
        title="리뷰 답글"
        open={replyModalOpen}
        onCancel={() => setReplyModalOpen(false)}
        footer={null}
      >
        {selectedReview && (
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <div className="flex items-center gap-2 mb-2">
              <Avatar
                src={selectedReview.userProfileImage}
                icon={<UserOutlined />}
                size="small"
              />
              <span className="font-medium">{selectedReview.userName}</span>
              <Rate disabled defaultValue={selectedReview.rating} style={{ fontSize: 12 }} />
            </div>
            <p className="text-gray-700">{selectedReview.content}</p>
          </div>
        )}
        <Form form={replyForm} onFinish={handleReplySubmit} layout="vertical">
          <Form.Item
            name="replyText"
            label="답글 내용"
            rules={[{ required: true, message: '답글 내용을 입력해주세요' }]}
          >
            <TextArea
              rows={4}
              placeholder="고객님의 리뷰에 감사의 답글을 남겨보세요"
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setReplyModalOpen(false)}>취소</Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={replyMutation.isPending}
              >
                {selectedReview?.reply ? '수정하기' : '등록하기'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      {/* Blind Request Modal */}
      <Modal
        title="블라인드 처리 요청"
        open={blindModalOpen}
        onCancel={() => setBlindModalOpen(false)}
        footer={null}
      >
        {selectedReview && (
          <div className="mb-4 p-4 bg-red-50 rounded border border-red-200">
            <p className="text-sm text-red-600 mb-2">
              아래 리뷰에 대한 블라인드 처리를 요청합니다.
            </p>
            <p className="text-gray-700">{selectedReview.content}</p>
          </div>
        )}
        <Form form={blindForm} onFinish={handleBlindSubmit} layout="vertical">
          <Form.Item
            name="reasonCategory"
            label="신고 사유"
            rules={[{ required: true, message: '신고 사유를 선택해주세요' }]}
          >
            <Radio.Group>
              <Space direction="vertical">
                <Radio value="profanity">욕설/비속어 포함</Radio>
                <Radio value="false_info">허위 정보</Radio>
                <Radio value="personal_attack">인신공격/명예훼손</Radio>
                <Radio value="spam">스팸/광고성 리뷰</Radio>
                <Radio value="other">기타</Radio>
              </Space>
            </Radio.Group>
          </Form.Item>
          <Form.Item
            name="reason"
            label="상세 사유"
            rules={[{ required: true, message: '상세 사유를 입력해주세요' }]}
          >
            <TextArea
              rows={3}
              placeholder="블라인드 처리가 필요한 구체적인 사유를 설명해주세요"
              maxLength={500}
              showCount
            />
          </Form.Item>
          <Form.Item className="mb-0 text-right">
            <Space>
              <Button onClick={() => setBlindModalOpen(false)}>취소</Button>
              <Button
                type="primary"
                danger
                htmlType="submit"
                loading={blindMutation.isPending}
              >
                블라인드 요청
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
```

### 3.2 Super Admin Blind Request Moderation Page

**File: `src/app/dashboard/moderation/blind-requests/page.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Card,
  Table,
  Space,
  Button,
  Tag,
  Modal,
  Input,
  Avatar,
  message,
  Tabs,
  Statistic,
  Row,
  Col,
  Image,
  Descriptions,
} from 'antd';
import {
  CheckOutlined,
  CloseOutlined,
  UserOutlined,
  ShopOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { adminApi } from '@/lib/api/admin';

const { TextArea } = Input;

interface BlindRequest {
  id: string;
  reviewId: string;
  shopId: string;
  reason: string;
  reasonCategory: string;
  evidenceUrls?: string[];
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  createdAt: string;
  reviews: {
    id: string;
    content: string;
    rating: number;
    images?: string[];
    createdAt: string;
    users: {
      nickname: string;
      profileImage?: string;
    };
  };
  shops: {
    id: string;
    name: string;
    profileImage?: string;
  };
}

export default function BlindRequestsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [processModalOpen, setProcessModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<BlindRequest | null>(null);
  const [processAction, setProcessAction] = useState<'approved' | 'rejected'>('approved');
  const [adminNotes, setAdminNotes] = useState('');

  // Fetch blind requests
  const { data: requestsData, isLoading } = useQuery({
    queryKey: ['blind-requests', activeTab],
    queryFn: () => adminApi.getBlindRequests({ status: activeTab }),
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ['blind-request-stats'],
    queryFn: () => adminApi.getBlindRequestStats(),
  });

  // Process mutation
  const processMutation = useMutation({
    mutationFn: ({ requestId, status, adminNotes }: {
      requestId: string;
      status: 'approved' | 'rejected';
      adminNotes?: string;
    }) => adminApi.processBlindRequest(requestId, status, adminNotes),
    onSuccess: (_, variables) => {
      message.success(
        variables.status === 'approved'
          ? '블라인드 요청이 승인되었습니다'
          : '블라인드 요청이 반려되었습니다'
      );
      setProcessModalOpen(false);
      setAdminNotes('');
      queryClient.invalidateQueries({ queryKey: ['blind-requests'] });
      queryClient.invalidateQueries({ queryKey: ['blind-request-stats'] });
    },
    onError: (error: any) => {
      message.error(error.message || '처리에 실패했습니다');
    },
  });

  const openDetailModal = (request: BlindRequest) => {
    setSelectedRequest(request);
    setDetailModalOpen(true);
  };

  const openProcessModal = (request: BlindRequest, action: 'approved' | 'rejected') => {
    setSelectedRequest(request);
    setProcessAction(action);
    setProcessModalOpen(true);
  };

  const handleProcess = () => {
    if (selectedRequest) {
      processMutation.mutate({
        requestId: selectedRequest.id,
        status: processAction,
        adminNotes: adminNotes || undefined,
      });
    }
  };

  const getReasonCategoryLabel = (category: string) => {
    const labels: Record<string, string> = {
      profanity: '욕설/비속어',
      false_info: '허위 정보',
      personal_attack: '인신공격',
      spam: '스팸/광고',
      other: '기타',
    };
    return labels[category] || category;
  };

  const columns = [
    {
      title: '샵',
      key: 'shop',
      width: 200,
      render: (_: any, record: BlindRequest) => (
        <Space>
          <Avatar
            src={record.shops?.profileImage}
            icon={<ShopOutlined />}
            size="small"
          />
          <span>{record.shops?.name || 'Unknown'}</span>
        </Space>
      ),
    },
    {
      title: '리뷰 작성자',
      key: 'reviewer',
      width: 150,
      render: (_: any, record: BlindRequest) => (
        <Space>
          <Avatar
            src={record.reviews?.users?.profileImage}
            icon={<UserOutlined />}
            size="small"
          />
          <span>{record.reviews?.users?.nickname || 'Unknown'}</span>
        </Space>
      ),
    },
    {
      title: '신고 사유',
      dataIndex: 'reasonCategory',
      key: 'reasonCategory',
      width: 120,
      render: (category: string) => (
        <Tag color="orange">{getReasonCategoryLabel(category)}</Tag>
      ),
    },
    {
      title: '리뷰 내용',
      key: 'reviewContent',
      ellipsis: true,
      render: (_: any, record: BlindRequest) => (
        <span>{record.reviews?.content || '-'}</span>
      ),
    },
    {
      title: '요청일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString('ko-KR'),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={
          status === 'pending' ? 'orange' :
          status === 'approved' ? 'green' : 'red'
        }>
          {status === 'pending' ? '대기중' :
           status === 'approved' ? '승인됨' : '반려됨'}
        </Tag>
      ),
    },
    {
      title: '관리',
      key: 'actions',
      width: 250,
      render: (_: any, record: BlindRequest) => (
        <Space>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => openDetailModal(record)}
          >
            상세
          </Button>
          {record.status === 'pending' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<CheckOutlined />}
                onClick={() => openProcessModal(record, 'approved')}
              >
                승인
              </Button>
              <Button
                danger
                size="small"
                icon={<CloseOutlined />}
                onClick={() => openProcessModal(record, 'rejected')}
              >
                반려
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ];

  const tabItems = [
    { key: 'pending', label: `대기중 (${stats?.pending || 0})` },
    { key: 'approved', label: '승인됨' },
    { key: 'rejected', label: '반려됨' },
    { key: 'all', label: '전체' },
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">블라인드 요청 관리</h1>

      {/* Stats Cards */}
      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="대기중"
              value={stats?.pending || 0}
              valueStyle={{ color: '#cf1322' }}
              suffix="건"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="오늘 승인"
              value={stats?.approvedToday || 0}
              valueStyle={{ color: '#3f8600' }}
              suffix="건"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="오늘 반려"
              value={stats?.rejectedToday || 0}
              suffix="건"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="총 처리"
              value={stats?.totalProcessed || 0}
              suffix="건"
            />
          </Card>
        </Col>
      </Row>

      {/* Requests Table */}
      <Card>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
        />
        <Table
          columns={columns}
          dataSource={requestsData?.requests || []}
          rowKey="id"
          loading={isLoading}
          pagination={{
            total: requestsData?.total || 0,
            pageSize: 20,
            showTotal: (total) => `총 ${total}건의 요청`,
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title="블라인드 요청 상세"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={700}
        footer={[
          <Button key="close" onClick={() => setDetailModalOpen(false)}>
            닫기
          </Button>,
          ...(selectedRequest?.status === 'pending' ? [
            <Button
              key="reject"
              danger
              onClick={() => {
                setDetailModalOpen(false);
                openProcessModal(selectedRequest!, 'rejected');
              }}
            >
              반려
            </Button>,
            <Button
              key="approve"
              type="primary"
              onClick={() => {
                setDetailModalOpen(false);
                openProcessModal(selectedRequest!, 'approved');
              }}
            >
              승인
            </Button>,
          ] : []),
        ]}
      >
        {selectedRequest && (
          <div className="space-y-4">
            <Descriptions title="요청 정보" bordered column={2}>
              <Descriptions.Item label="샵 이름">
                {selectedRequest.shops?.name}
              </Descriptions.Item>
              <Descriptions.Item label="요청일">
                {new Date(selectedRequest.createdAt).toLocaleString('ko-KR')}
              </Descriptions.Item>
              <Descriptions.Item label="신고 유형">
                <Tag color="orange">
                  {getReasonCategoryLabel(selectedRequest.reasonCategory)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="상태">
                <Tag color={
                  selectedRequest.status === 'pending' ? 'orange' :
                  selectedRequest.status === 'approved' ? 'green' : 'red'
                }>
                  {selectedRequest.status === 'pending' ? '대기중' :
                   selectedRequest.status === 'approved' ? '승인됨' : '반려됨'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="상세 사유" span={2}>
                {selectedRequest.reason}
              </Descriptions.Item>
            </Descriptions>

            <Card title="신고된 리뷰" size="small">
              <div className="p-4 bg-gray-50 rounded">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar
                    src={selectedRequest.reviews?.users?.profileImage}
                    icon={<UserOutlined />}
                    size="small"
                  />
                  <span className="font-medium">
                    {selectedRequest.reviews?.users?.nickname}
                  </span>
                  <span className="text-gray-500 text-sm">
                    {new Date(selectedRequest.reviews?.createdAt).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <p className="text-gray-700">{selectedRequest.reviews?.content}</p>
                {selectedRequest.reviews?.images && selectedRequest.reviews.images.length > 0 && (
                  <div className="mt-2 flex gap-2">
                    <Image.PreviewGroup>
                      {selectedRequest.reviews.images.map((img, idx) => (
                        <Image
                          key={idx}
                          src={img}
                          width={80}
                          height={80}
                          style={{ objectFit: 'cover' }}
                        />
                      ))}
                    </Image.PreviewGroup>
                  </div>
                )}
              </div>
            </Card>

            {selectedRequest.adminNotes && (
              <Card title="관리자 노트" size="small">
                <p>{selectedRequest.adminNotes}</p>
              </Card>
            )}
          </div>
        )}
      </Modal>

      {/* Process Modal */}
      <Modal
        title={processAction === 'approved' ? '블라인드 승인' : '블라인드 반려'}
        open={processModalOpen}
        onCancel={() => {
          setProcessModalOpen(false);
          setAdminNotes('');
        }}
        onOk={handleProcess}
        okText={processAction === 'approved' ? '승인하기' : '반려하기'}
        okButtonProps={{
          danger: processAction === 'rejected',
          loading: processMutation.isPending,
        }}
      >
        <div className="space-y-4">
          <p>
            {processAction === 'approved'
              ? '이 리뷰를 블라인드 처리하시겠습니까? 고객에게 리뷰가 노출되지 않습니다.'
              : '블라인드 요청을 반려하시겠습니까? 리뷰는 그대로 유지됩니다.'}
          </p>
          <div>
            <label className="block text-sm font-medium mb-1">
              관리자 메모 (선택)
            </label>
            <TextArea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder={
                processAction === 'approved'
                  ? '블라인드 승인 사유를 입력하세요'
                  : '반려 사유를 입력하세요 (샵 관리자에게 전달됩니다)'
              }
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
```

---

## 4. Mobile App Implementation

### 4.1 Display Shop Owner Reply on Reviews

**File: `src/components/reviews/ReviewCard.tsx` (Update)**

```tsx
'use client';

import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { StarRating } from '@/components/ui/star-rating';
import { formatDate } from '@/lib/utils';
import { ShopIcon, MessageSquareIcon } from 'lucide-react';

interface ReviewReply {
  id: string;
  replyText: string;
  createdAt: string;
}

interface ReviewCardProps {
  review: {
    id: string;
    userName: string;
    userProfileImage?: string;
    rating: number;
    content: string;
    images?: string[];
    createdAt: string;
    isBlinded?: boolean;
    reply?: ReviewReply;
  };
  shopName?: string;
}

export function ReviewCard({ review, shopName }: ReviewCardProps) {
  if (review.isBlinded) {
    return (
      <Card className="p-4 bg-gray-50">
        <p className="text-gray-500 text-sm text-center">
          해당 리뷰는 운영정책 위반으로 블라인드 처리되었습니다.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4">
      {/* Review Header */}
      <div className="flex items-center gap-3 mb-3">
        <Avatar
          src={review.userProfileImage}
          alt={review.userName}
          fallback={review.userName.charAt(0)}
          className="w-10 h-10"
        />
        <div className="flex-1">
          <p className="font-medium">{review.userName}</p>
          <div className="flex items-center gap-2">
            <StarRating rating={review.rating} size="sm" />
            <span className="text-xs text-gray-500">
              {formatDate(review.createdAt)}
            </span>
          </div>
        </div>
      </div>

      {/* Review Content */}
      <p className="text-gray-700 mb-3">{review.content}</p>

      {/* Review Images */}
      {review.images && review.images.length > 0 && (
        <div className="flex gap-2 mb-3 overflow-x-auto">
          {review.images.map((img, idx) => (
            <img
              key={idx}
              src={img}
              alt={`리뷰 이미지 ${idx + 1}`}
              className="w-20 h-20 object-cover rounded-lg flex-shrink-0"
            />
          ))}
        </div>
      )}

      {/* Shop Owner Reply */}
      {review.reply && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg">
            <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
              <ShopIcon className="w-4 h-4 text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-blue-700">
                  {shopName || '사장님'} 답글
                </span>
                <span className="text-xs text-gray-500">
                  {formatDate(review.reply.createdAt)}
                </span>
              </div>
              <p className="text-sm text-gray-700">{review.reply.replyText}</p>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}
```

### 4.2 Update API Client

**File: `src/lib/api/reviews-api.ts` (Update)**

```typescript
import { apiClient } from './client';

export interface ReviewReply {
  id: string;
  replyText: string;
  createdAt: string;
}

export interface Review {
  id: string;
  userId: string;
  userName: string;
  userProfileImage?: string;
  rating: number;
  content: string;
  images?: string[];
  createdAt: string;
  isBlinded: boolean;
  reply?: ReviewReply;
}

export const reviewsApi = {
  // Get reviews for a shop (includes replies)
  getShopReviews: async (shopId: string, params?: {
    page?: number;
    limit?: number;
  }): Promise<{ reviews: Review[]; total: number; hasMore: boolean }> => {
    const { data } = await apiClient.get(`/shops/${shopId}/reviews`, { params });
    return data.data;
  },

  // Create a review
  createReview: async (shopId: string, reviewData: {
    rating: number;
    content: string;
    images?: string[];
    autoPostToFeed?: boolean;
  }): Promise<Review> => {
    const { data } = await apiClient.post(`/shops/${shopId}/reviews`, reviewData);
    return data.data;
  },
};
```

---

## 5. Files Summary

### New Files

**Backend:**
- `src/types/review-reply.types.ts`
- `src/services/shop-owner/review.service.ts`
- `src/services/admin/blind-request.service.ts`
- `src/controllers/shop-owner/review.controller.ts`
- `src/controllers/admin/blind-request.controller.ts`
- `src/routes/shop-owner/review.routes.ts`
- `src/routes/admin/blind-request.routes.ts`
- `src/migrations/006_add_review_replies_table.sql`

**Admin Panel:**
- `src/app/dashboard/my-shop/reviews/page.tsx`
- `src/app/dashboard/moderation/blind-requests/page.tsx`

### Modified Files

**Backend:**
- `src/routes/shop-owner/index.ts` (add review routes)
- `src/routes/admin/index.ts` (add blind request routes)

**Mobile App:**
- `src/components/reviews/ReviewCard.tsx` (add reply display)
- `src/lib/api/reviews-api.ts` (add reply types)

---

## 6. API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shop-owner/reviews` | Get shop reviews with replies |
| GET | `/shop-owner/reviews/stats` | Get review statistics |
| POST | `/shop-owner/reviews/:reviewId/reply` | Create reply to review |
| PUT | `/shop-owner/reviews/:reviewId/reply` | Update reply |
| DELETE | `/shop-owner/reviews/:reviewId/reply` | Delete reply |
| POST | `/shop-owner/reviews/:reviewId/blind-request` | Request blind processing |
| GET | `/admin/blind-requests` | Get all blind requests |
| GET | `/admin/blind-requests/stats` | Get blind request statistics |
| PATCH | `/admin/blind-requests/:requestId` | Process blind request |

---

## 7. Testing Checklist

- [ ] Shop owner can view all reviews for their shop
- [ ] Shop owner can reply to a review
- [ ] Shop owner can edit their reply
- [ ] Shop owner can delete their reply
- [ ] Shop owner can request blind for malicious review
- [ ] Review author receives notification when shop replies
- [ ] Blinded reviews show appropriate message to users
- [ ] Super admin can view all pending blind requests
- [ ] Super admin can approve blind requests
- [ ] Super admin can reject blind requests
- [ ] Shop owner receives notification of blind request result
- [ ] Review reply displays correctly in mobile app
