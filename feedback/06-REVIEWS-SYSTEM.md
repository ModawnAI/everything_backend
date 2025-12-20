# Implementation Plan: Reviews System

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 20-30 hours |
| **Risk Level** | Medium |
| **Components Affected** | Backend + Frontend + Admin |
| **Dependencies** | Reservations (completed status) |

## Problem Statement

The Reviews System is marked as TODO throughout the codebase:

```typescript
// Backend: src/controllers/user-profile.controller.ts:170
// TODO: Implement reviews table and API

// Frontend: ShopReviews component exists but has no API connection
// Admin: No review moderation UI exists
```

**Impact:**
1. Users cannot leave reviews for completed services
2. New customers cannot see shop ratings/reviews
3. Shop owners cannot respond to feedback
4. No quality signal for shop discovery
5. Missing user engagement feature

---

## Database Schema

### Step 1: Create Reviews Tables

**File:** `src/migrations/XXX_create_reviews_tables.sql`

```sql
-- Migration: Create reviews system tables
-- Purpose: Enable user reviews and ratings for shops and services

-- =============================================
-- ENUM TYPES
-- =============================================

-- Review status enum
DO $$ BEGIN
  CREATE TYPE review_status AS ENUM (
    'pending',        -- Awaiting moderation (if enabled)
    'approved',       -- Published and visible
    'hidden',         -- Hidden by admin
    'rejected',       -- Rejected during moderation
    'deleted'         -- Soft deleted
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Review type enum
DO $$ BEGIN
  CREATE TYPE review_type AS ENUM (
    'service',        -- Review of specific service
    'shop'            -- General shop review
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- =============================================
-- TABLES
-- =============================================

-- Main reviews table
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Relationships
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE,
  reservation_id UUID REFERENCES reservations(id) ON DELETE SET NULL,
  service_id UUID REFERENCES shop_services(id) ON DELETE SET NULL,

  -- Review content
  review_type review_type NOT NULL DEFAULT 'service',
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title VARCHAR(200),
  content TEXT,

  -- Service-specific ratings (optional)
  service_quality_rating INTEGER CHECK (service_quality_rating >= 1 AND service_quality_rating <= 5),
  staff_friendliness_rating INTEGER CHECK (staff_friendliness_rating >= 1 AND staff_friendliness_rating <= 5),
  cleanliness_rating INTEGER CHECK (cleanliness_rating >= 1 AND cleanliness_rating <= 5),
  value_for_money_rating INTEGER CHECK (value_for_money_rating >= 1 AND value_for_money_rating <= 5),

  -- Media
  image_urls TEXT[] DEFAULT '{}',

  -- Status and moderation
  status review_status NOT NULL DEFAULT 'approved',
  moderation_notes TEXT,
  moderated_by UUID REFERENCES users(id),
  moderated_at TIMESTAMPTZ,

  -- Engagement metrics
  helpful_count INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,

  -- Shop owner response
  owner_response TEXT,
  owner_response_at TIMESTAMPTZ,

  -- Metadata
  is_verified_purchase BOOLEAN DEFAULT false,
  visit_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Constraints
  CONSTRAINT unique_reservation_review UNIQUE (user_id, reservation_id)
);

-- Review helpful votes
CREATE TABLE IF NOT EXISTS review_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_helpful BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_review_vote UNIQUE (review_id, user_id)
);

-- Review reports
CREATE TABLE IF NOT EXISTS review_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
  reporter_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  reason VARCHAR(100) NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending',
  resolved_by UUID REFERENCES users(id),
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT unique_review_report UNIQUE (review_id, reporter_id)
);

-- Shop rating summary (denormalized for performance)
CREATE TABLE IF NOT EXISTS shop_rating_summary (
  shop_id UUID PRIMARY KEY REFERENCES shops(id) ON DELETE CASCADE,
  total_reviews INTEGER DEFAULT 0,
  average_rating NUMERIC(3, 2) DEFAULT 0,
  rating_1_count INTEGER DEFAULT 0,
  rating_2_count INTEGER DEFAULT 0,
  rating_3_count INTEGER DEFAULT 0,
  rating_4_count INTEGER DEFAULT 0,
  rating_5_count INTEGER DEFAULT 0,
  average_service_quality NUMERIC(3, 2),
  average_staff_friendliness NUMERIC(3, 2),
  average_cleanliness NUMERIC(3, 2),
  average_value_for_money NUMERIC(3, 2),
  last_review_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_reservation_id ON reviews(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reviews_service_id ON reviews(service_id);
CREATE INDEX IF NOT EXISTS idx_reviews_status ON reviews(status);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON reviews(rating);
CREATE INDEX IF NOT EXISTS idx_reviews_created_at ON reviews(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_status ON reviews(shop_id, status);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);

-- =============================================
-- ROW LEVEL SECURITY
-- =============================================

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_rating_summary ENABLE ROW LEVEL SECURITY;

-- Reviews: Anyone can read approved reviews, users can manage own
CREATE POLICY "read_approved_reviews" ON reviews
  FOR SELECT
  USING (status = 'approved' OR user_id = auth.uid());

CREATE POLICY "users_create_reviews" ON reviews
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_reviews" ON reviews
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "admin_manage_reviews" ON reviews
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Shop owners can respond to reviews
CREATE POLICY "shop_owner_respond" ON reviews
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = reviews.shop_id
      AND shops.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM shops
      WHERE shops.id = reviews.shop_id
      AND shops.owner_id = auth.uid()
    )
  );

-- Rating summary: Public read
CREATE POLICY "read_rating_summary" ON shop_rating_summary
  FOR SELECT
  USING (true);

-- =============================================
-- TRIGGERS
-- =============================================

-- Update shop rating summary on review changes
CREATE OR REPLACE FUNCTION update_shop_rating_summary()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate new summary
  INSERT INTO shop_rating_summary (shop_id, total_reviews, average_rating,
    rating_1_count, rating_2_count, rating_3_count, rating_4_count, rating_5_count,
    average_service_quality, average_staff_friendliness, average_cleanliness,
    average_value_for_money, last_review_at)
  SELECT
    COALESCE(NEW.shop_id, OLD.shop_id),
    COUNT(*),
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*) FILTER (WHERE rating = 1),
    COUNT(*) FILTER (WHERE rating = 2),
    COUNT(*) FILTER (WHERE rating = 3),
    COUNT(*) FILTER (WHERE rating = 4),
    COUNT(*) FILTER (WHERE rating = 5),
    ROUND(AVG(service_quality_rating)::numeric, 2),
    ROUND(AVG(staff_friendliness_rating)::numeric, 2),
    ROUND(AVG(cleanliness_rating)::numeric, 2),
    ROUND(AVG(value_for_money_rating)::numeric, 2),
    MAX(created_at)
  FROM reviews
  WHERE shop_id = COALESCE(NEW.shop_id, OLD.shop_id)
    AND status = 'approved'
  ON CONFLICT (shop_id) DO UPDATE SET
    total_reviews = EXCLUDED.total_reviews,
    average_rating = EXCLUDED.average_rating,
    rating_1_count = EXCLUDED.rating_1_count,
    rating_2_count = EXCLUDED.rating_2_count,
    rating_3_count = EXCLUDED.rating_3_count,
    rating_4_count = EXCLUDED.rating_4_count,
    rating_5_count = EXCLUDED.rating_5_count,
    average_service_quality = EXCLUDED.average_service_quality,
    average_staff_friendliness = EXCLUDED.average_staff_friendliness,
    average_cleanliness = EXCLUDED.average_cleanliness,
    average_value_for_money = EXCLUDED.average_value_for_money,
    last_review_at = EXCLUDED.last_review_at,
    updated_at = NOW();

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_rating_summary
  AFTER INSERT OR UPDATE OR DELETE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_shop_rating_summary();

-- Update helpful count on vote changes
CREATE OR REPLACE FUNCTION update_review_helpful_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE reviews
  SET helpful_count = (
    SELECT COUNT(*) FROM review_votes
    WHERE review_id = COALESCE(NEW.review_id, OLD.review_id)
    AND is_helpful = true
  )
  WHERE id = COALESCE(NEW.review_id, OLD.review_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_helpful_count
  AFTER INSERT OR UPDATE OR DELETE ON review_votes
  FOR EACH ROW
  EXECUTE FUNCTION update_review_helpful_count();

-- Update timestamps
CREATE TRIGGER trigger_reviews_updated_at
  BEFORE UPDATE ON reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Comments
COMMENT ON TABLE reviews IS 'User reviews and ratings for shops and services';
COMMENT ON TABLE review_votes IS 'Helpful/not helpful votes on reviews';
COMMENT ON TABLE review_reports IS 'User reports on inappropriate reviews';
COMMENT ON TABLE shop_rating_summary IS 'Denormalized rating statistics per shop';
```

---

## Backend Implementation

### Step 2: Define Review Types

**File:** `src/types/review.types.ts`

```typescript
/**
 * Review system type definitions
 * Consistent with database schema
 */

// Review status enum (matches database)
export type ReviewStatus = 'pending' | 'approved' | 'hidden' | 'rejected' | 'deleted';

// Review type enum
export type ReviewType = 'service' | 'shop';

// Base review interface
export interface Review {
  id: string;
  userId: string;
  shopId: string;
  reservationId?: string;
  serviceId?: string;
  reviewType: ReviewType;
  rating: number; // 1-5
  title?: string;
  content?: string;
  serviceQualityRating?: number;
  staffFriendlinessRating?: number;
  cleanlinessRating?: number;
  valueForMoneyRating?: number;
  imageUrls: string[];
  status: ReviewStatus;
  moderationNotes?: string;
  moderatedBy?: string;
  moderatedAt?: string;
  helpfulCount: number;
  reportCount: number;
  ownerResponse?: string;
  ownerResponseAt?: string;
  isVerifiedPurchase: boolean;
  visitDate?: string;
  createdAt: string;
  updatedAt: string;
  // Joined data
  user?: {
    id: string;
    name: string;
    nickname?: string;
    profileImageUrl?: string;
  };
  shop?: {
    id: string;
    name: string;
  };
  service?: {
    id: string;
    name: string;
  };
}

// Create review request
export interface CreateReviewRequest {
  shopId: string;
  reservationId?: string;
  serviceId?: string;
  reviewType?: ReviewType;
  rating: number;
  title?: string;
  content?: string;
  serviceQualityRating?: number;
  staffFriendlinessRating?: number;
  cleanlinessRating?: number;
  valueForMoneyRating?: number;
  imageUrls?: string[];
  visitDate?: string;
}

// Update review request
export interface UpdateReviewRequest {
  rating?: number;
  title?: string;
  content?: string;
  serviceQualityRating?: number;
  staffFriendlinessRating?: number;
  cleanlinessRating?: number;
  valueForMoneyRating?: number;
  imageUrls?: string[];
}

// Owner response request
export interface OwnerResponseRequest {
  response: string;
}

// Review list parameters
export interface ReviewListParams {
  shopId?: string;
  userId?: string;
  serviceId?: string;
  status?: ReviewStatus;
  minRating?: number;
  maxRating?: number;
  hasImages?: boolean;
  sortBy?: 'newest' | 'oldest' | 'highest' | 'lowest' | 'helpful';
  page?: number;
  limit?: number;
}

// Review list response
export interface ReviewListResponse {
  reviews: Review[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// Shop rating summary
export interface ShopRatingSummary {
  shopId: string;
  totalReviews: number;
  averageRating: number;
  rating1Count: number;
  rating2Count: number;
  rating3Count: number;
  rating4Count: number;
  rating5Count: number;
  averageServiceQuality?: number;
  averageStaffFriendliness?: number;
  averageCleanliness?: number;
  averageValueForMoney?: number;
  lastReviewAt?: string;
}

// Review vote
export interface ReviewVote {
  id: string;
  reviewId: string;
  userId: string;
  isHelpful: boolean;
  createdAt: string;
}

// Review report
export interface ReviewReport {
  id: string;
  reviewId: string;
  reporterId: string;
  reason: string;
  description?: string;
  status: 'pending' | 'resolved' | 'dismissed';
  resolvedBy?: string;
  resolvedAt?: string;
  createdAt: string;
}

// Report reason options
export const REPORT_REASONS = [
  'spam',
  'inappropriate_content',
  'fake_review',
  'harassment',
  'competitor_review',
  'personal_information',
  'other',
] as const;

export type ReportReason = typeof REPORT_REASONS[number];
```

### Step 3: Create Review Service

**File:** `src/services/review.service.ts`

```typescript
/**
 * Review Service
 * Handles all review-related business logic
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  Review,
  CreateReviewRequest,
  UpdateReviewRequest,
  OwnerResponseRequest,
  ReviewListParams,
  ReviewListResponse,
  ShopRatingSummary,
  ReviewStatus,
} from '../types/review.types';

export class ReviewService {
  private supabase = getSupabaseClient();

  /**
   * Create a new review
   */
  async createReview(userId: string, data: CreateReviewRequest): Promise<Review> {
    // Validate rating
    if (data.rating < 1 || data.rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    // Check if user can review (must have completed reservation)
    if (data.reservationId) {
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('id, user_id, shop_id, status')
        .eq('id', data.reservationId)
        .single();

      if (reservationError || !reservation) {
        throw new Error('Reservation not found');
      }

      if (reservation.user_id !== userId) {
        throw new Error('You can only review your own reservations');
      }

      if (reservation.status !== 'completed') {
        throw new Error('You can only review completed reservations');
      }

      // Check for existing review
      const { data: existingReview } = await this.supabase
        .from('reviews')
        .select('id')
        .eq('user_id', userId)
        .eq('reservation_id', data.reservationId)
        .single();

      if (existingReview) {
        throw new Error('You have already reviewed this reservation');
      }
    }

    // Create review
    const { data: review, error } = await this.supabase
      .from('reviews')
      .insert({
        user_id: userId,
        shop_id: data.shopId,
        reservation_id: data.reservationId,
        service_id: data.serviceId,
        review_type: data.reviewType || 'service',
        rating: data.rating,
        title: data.title,
        content: data.content,
        service_quality_rating: data.serviceQualityRating,
        staff_friendliness_rating: data.staffFriendlinessRating,
        cleanliness_rating: data.cleanlinessRating,
        value_for_money_rating: data.valueForMoneyRating,
        image_urls: data.imageUrls || [],
        visit_date: data.visitDate,
        is_verified_purchase: !!data.reservationId,
        status: 'approved', // Auto-approve for now
      })
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `)
      .single();

    if (error) {
      logger.error('Failed to create review', { error, userId, data });
      throw new Error('Failed to create review');
    }

    logger.info('Review created', { reviewId: review.id, userId, shopId: data.shopId });

    return this.mapReview(review);
  }

  /**
   * Get reviews with filtering and pagination
   */
  async getReviews(params: ReviewListParams): Promise<ReviewListResponse> {
    const {
      shopId,
      userId,
      serviceId,
      status = 'approved',
      minRating,
      maxRating,
      hasImages,
      sortBy = 'newest',
      page = 1,
      limit = 20,
    } = params;

    let query = this.supabase
      .from('reviews')
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `, { count: 'exact' });

    // Filters
    if (shopId) query = query.eq('shop_id', shopId);
    if (userId) query = query.eq('user_id', userId);
    if (serviceId) query = query.eq('service_id', serviceId);
    if (status) query = query.eq('status', status);
    if (minRating) query = query.gte('rating', minRating);
    if (maxRating) query = query.lte('rating', maxRating);
    if (hasImages) query = query.not('image_urls', 'eq', '{}');

    // Sorting
    switch (sortBy) {
      case 'oldest':
        query = query.order('created_at', { ascending: true });
        break;
      case 'highest':
        query = query.order('rating', { ascending: false });
        break;
      case 'lowest':
        query = query.order('rating', { ascending: true });
        break;
      case 'helpful':
        query = query.order('helpful_count', { ascending: false });
        break;
      default:
        query = query.order('created_at', { ascending: false });
    }

    // Pagination
    const offset = (page - 1) * limit;
    query = query.range(offset, offset + limit - 1);

    const { data: reviews, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch reviews', { error, params });
      throw new Error('Failed to fetch reviews');
    }

    return {
      reviews: reviews.map(this.mapReview),
      pagination: {
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
      },
    };
  }

  /**
   * Get single review by ID
   */
  async getReview(reviewId: string): Promise<Review | null> {
    const { data, error } = await this.supabase
      .from('reviews')
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `)
      .eq('id', reviewId)
      .single();

    if (error || !data) {
      return null;
    }

    return this.mapReview(data);
  }

  /**
   * Update a review
   */
  async updateReview(
    reviewId: string,
    userId: string,
    data: UpdateReviewRequest
  ): Promise<Review> {
    // Verify ownership
    const { data: existing, error: fetchError } = await this.supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existing) {
      throw new Error('Review not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('You can only edit your own reviews');
    }

    // Validate rating if provided
    if (data.rating && (data.rating < 1 || data.rating > 5)) {
      throw new Error('Rating must be between 1 and 5');
    }

    const { data: review, error } = await this.supabase
      .from('reviews')
      .update({
        rating: data.rating,
        title: data.title,
        content: data.content,
        service_quality_rating: data.serviceQualityRating,
        staff_friendliness_rating: data.staffFriendlinessRating,
        cleanliness_rating: data.cleanlinessRating,
        value_for_money_rating: data.valueForMoneyRating,
        image_urls: data.imageUrls,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `)
      .single();

    if (error) {
      logger.error('Failed to update review', { error, reviewId, userId });
      throw new Error('Failed to update review');
    }

    return this.mapReview(review);
  }

  /**
   * Delete a review (soft delete)
   */
  async deleteReview(reviewId: string, userId: string): Promise<void> {
    const { data: existing, error: fetchError } = await this.supabase
      .from('reviews')
      .select('user_id')
      .eq('id', reviewId)
      .single();

    if (fetchError || !existing) {
      throw new Error('Review not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('You can only delete your own reviews');
    }

    const { error } = await this.supabase
      .from('reviews')
      .update({ status: 'deleted', updated_at: new Date().toISOString() })
      .eq('id', reviewId);

    if (error) {
      logger.error('Failed to delete review', { error, reviewId, userId });
      throw new Error('Failed to delete review');
    }

    logger.info('Review deleted', { reviewId, userId });
  }

  /**
   * Add shop owner response
   */
  async addOwnerResponse(
    reviewId: string,
    ownerId: string,
    data: OwnerResponseRequest
  ): Promise<Review> {
    // Verify ownership
    const { data: review, error: fetchError } = await this.supabase
      .from('reviews')
      .select('shop_id, shops!inner(owner_id)')
      .eq('id', reviewId)
      .single();

    if (fetchError || !review) {
      throw new Error('Review not found');
    }

    if ((review as any).shops.owner_id !== ownerId) {
      throw new Error('You can only respond to reviews for your shop');
    }

    const { data: updated, error } = await this.supabase
      .from('reviews')
      .update({
        owner_response: data.response,
        owner_response_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `)
      .single();

    if (error) {
      logger.error('Failed to add owner response', { error, reviewId, ownerId });
      throw new Error('Failed to add response');
    }

    return this.mapReview(updated);
  }

  /**
   * Vote on a review (helpful/not helpful)
   */
  async voteReview(
    reviewId: string,
    userId: string,
    isHelpful: boolean
  ): Promise<{ helpfulCount: number }> {
    // Upsert vote
    const { error } = await this.supabase
      .from('review_votes')
      .upsert({
        review_id: reviewId,
        user_id: userId,
        is_helpful: isHelpful,
      }, {
        onConflict: 'review_id,user_id',
      });

    if (error) {
      logger.error('Failed to vote on review', { error, reviewId, userId });
      throw new Error('Failed to vote');
    }

    // Get updated count
    const { data: review } = await this.supabase
      .from('reviews')
      .select('helpful_count')
      .eq('id', reviewId)
      .single();

    return { helpfulCount: review?.helpful_count || 0 };
  }

  /**
   * Report a review
   */
  async reportReview(
    reviewId: string,
    reporterId: string,
    reason: string,
    description?: string
  ): Promise<void> {
    // Check for existing report
    const { data: existing } = await this.supabase
      .from('review_reports')
      .select('id')
      .eq('review_id', reviewId)
      .eq('reporter_id', reporterId)
      .single();

    if (existing) {
      throw new Error('You have already reported this review');
    }

    const { error } = await this.supabase
      .from('review_reports')
      .insert({
        review_id: reviewId,
        reporter_id: reporterId,
        reason,
        description,
      });

    if (error) {
      logger.error('Failed to report review', { error, reviewId, reporterId });
      throw new Error('Failed to report review');
    }

    // Increment report count
    await this.supabase.rpc('increment_review_report_count', { review_id: reviewId });

    logger.info('Review reported', { reviewId, reporterId, reason });
  }

  /**
   * Get shop rating summary
   */
  async getShopRatingSummary(shopId: string): Promise<ShopRatingSummary | null> {
    const { data, error } = await this.supabase
      .from('shop_rating_summary')
      .select('*')
      .eq('shop_id', shopId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      shopId: data.shop_id,
      totalReviews: data.total_reviews,
      averageRating: parseFloat(data.average_rating) || 0,
      rating1Count: data.rating_1_count,
      rating2Count: data.rating_2_count,
      rating3Count: data.rating_3_count,
      rating4Count: data.rating_4_count,
      rating5Count: data.rating_5_count,
      averageServiceQuality: data.average_service_quality ? parseFloat(data.average_service_quality) : undefined,
      averageStaffFriendliness: data.average_staff_friendliness ? parseFloat(data.average_staff_friendliness) : undefined,
      averageCleanliness: data.average_cleanliness ? parseFloat(data.average_cleanliness) : undefined,
      averageValueForMoney: data.average_value_for_money ? parseFloat(data.average_value_for_money) : undefined,
      lastReviewAt: data.last_review_at,
    };
  }

  /**
   * Admin: Moderate review
   */
  async moderateReview(
    reviewId: string,
    adminId: string,
    status: ReviewStatus,
    notes?: string
  ): Promise<Review> {
    const { data, error } = await this.supabase
      .from('reviews')
      .update({
        status,
        moderation_notes: notes,
        moderated_by: adminId,
        moderated_at: new Date().toISOString(),
      })
      .eq('id', reviewId)
      .select(`
        *,
        user:users(id, name, nickname, profile_image_url),
        shop:shops(id, name),
        service:shop_services(id, name)
      `)
      .single();

    if (error) {
      logger.error('Failed to moderate review', { error, reviewId, adminId });
      throw new Error('Failed to moderate review');
    }

    logger.info('Review moderated', { reviewId, adminId, status });

    return this.mapReview(data);
  }

  /**
   * Map database row to Review type
   */
  private mapReview(row: any): Review {
    return {
      id: row.id,
      userId: row.user_id,
      shopId: row.shop_id,
      reservationId: row.reservation_id,
      serviceId: row.service_id,
      reviewType: row.review_type,
      rating: row.rating,
      title: row.title,
      content: row.content,
      serviceQualityRating: row.service_quality_rating,
      staffFriendlinessRating: row.staff_friendliness_rating,
      cleanlinessRating: row.cleanliness_rating,
      valueForMoneyRating: row.value_for_money_rating,
      imageUrls: row.image_urls || [],
      status: row.status,
      moderationNotes: row.moderation_notes,
      moderatedBy: row.moderated_by,
      moderatedAt: row.moderated_at,
      helpfulCount: row.helpful_count || 0,
      reportCount: row.report_count || 0,
      ownerResponse: row.owner_response,
      ownerResponseAt: row.owner_response_at,
      isVerifiedPurchase: row.is_verified_purchase,
      visitDate: row.visit_date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      user: row.user,
      shop: row.shop,
      service: row.service,
    };
  }
}

export const reviewService = new ReviewService();
export default reviewService;
```

### Step 4: Create Review Controller

**File:** `src/controllers/review.controller.ts`

```typescript
/**
 * Review Controller
 * Handles HTTP requests for review operations
 */

import { Request, Response, NextFunction } from 'express';
import { reviewService } from '../services/review.service';
import { AuthenticatedRequest } from '../types/auth.types';
import { logger } from '../utils/logger';

export class ReviewController {
  /**
   * GET /api/reviews
   * Get list of reviews with filters
   */
  async getReviews(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        shopId,
        userId,
        serviceId,
        status,
        minRating,
        maxRating,
        hasImages,
        sortBy,
        page,
        limit,
      } = req.query;

      const result = await reviewService.getReviews({
        shopId: shopId as string,
        userId: userId as string,
        serviceId: serviceId as string,
        status: status as any,
        minRating: minRating ? parseInt(minRating as string) : undefined,
        maxRating: maxRating ? parseInt(maxRating as string) : undefined,
        hasImages: hasImages === 'true',
        sortBy: sortBy as any,
        page: page ? parseInt(page as string) : 1,
        limit: limit ? parseInt(limit as string) : 20,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/reviews/:id
   * Get single review
   */
  async getReview(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;

      const review = await reviewService.getReview(id);

      if (!review) {
        return res.status(404).json({
          success: false,
          error: { message: 'Review not found', code: 'NOT_FOUND' },
        });
      }

      res.json({
        success: true,
        data: { review },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews
   * Create new review
   */
  async createReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const userId = req.user!.id;

      const review = await reviewService.createReview(userId, req.body);

      res.status(201).json({
        success: true,
        data: { review },
        message: '리뷰가 등록되었습니다',
      });
    } catch (error: any) {
      if (error.message.includes('already reviewed')) {
        return res.status(400).json({
          success: false,
          error: { message: error.message, code: 'ALREADY_REVIEWED' },
        });
      }
      next(error);
    }
  }

  /**
   * PUT /api/reviews/:id
   * Update review
   */
  async updateReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const review = await reviewService.updateReview(id, userId, req.body);

      res.json({
        success: true,
        data: { review },
        message: '리뷰가 수정되었습니다',
      });
    } catch (error: any) {
      if (error.message.includes('not found')) {
        return res.status(404).json({
          success: false,
          error: { message: error.message, code: 'NOT_FOUND' },
        });
      }
      if (error.message.includes('only edit your own')) {
        return res.status(403).json({
          success: false,
          error: { message: error.message, code: 'FORBIDDEN' },
        });
      }
      next(error);
    }
  }

  /**
   * DELETE /api/reviews/:id
   * Delete review
   */
  async deleteReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      await reviewService.deleteReview(id, userId);

      res.json({
        success: true,
        message: '리뷰가 삭제되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews/:id/response
   * Add owner response
   */
  async addOwnerResponse(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const ownerId = req.user!.id;

      const review = await reviewService.addOwnerResponse(id, ownerId, req.body);

      res.json({
        success: true,
        data: { review },
        message: '답변이 등록되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews/:id/vote
   * Vote on review
   */
  async voteReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const userId = req.user!.id;
      const { isHelpful } = req.body;

      const result = await reviewService.voteReview(id, userId, isHelpful);

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * POST /api/reviews/:id/report
   * Report review
   */
  async reportReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const reporterId = req.user!.id;
      const { reason, description } = req.body;

      await reviewService.reportReview(id, reporterId, reason, description);

      res.json({
        success: true,
        message: '신고가 접수되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /api/shops/:shopId/rating
   * Get shop rating summary
   */
  async getShopRating(req: Request, res: Response, next: NextFunction) {
    try {
      const { shopId } = req.params;

      const summary = await reviewService.getShopRatingSummary(shopId);

      res.json({
        success: true,
        data: { summary },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Admin: PUT /api/admin/reviews/:id/moderate
   * Moderate review
   */
  async moderateReview(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const adminId = req.user!.id;
      const { status, notes } = req.body;

      const review = await reviewService.moderateReview(id, adminId, status, notes);

      res.json({
        success: true,
        data: { review },
        message: '리뷰가 처리되었습니다',
      });
    } catch (error) {
      next(error);
    }
  }
}

export const reviewController = new ReviewController();
export default reviewController;
```

### Step 5: Create Review Routes

**File:** `src/routes/review.routes.ts`

```typescript
/**
 * Review Routes
 * Public and authenticated routes for review operations
 */

import { Router } from 'express';
import { reviewController } from '../controllers/review.controller';
import { authenticateUser, optionalAuth } from '../middleware/auth.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, param, query } from 'express-validator';

const router = Router();

// Validation schemas
const createReviewValidation = [
  body('shopId').isUUID().withMessage('Valid shop ID required'),
  body('rating').isInt({ min: 1, max: 5 }).withMessage('Rating must be 1-5'),
  body('reservationId').optional().isUUID(),
  body('serviceId').optional().isUUID(),
  body('title').optional().isString().trim().isLength({ max: 200 }),
  body('content').optional().isString().trim().isLength({ max: 2000 }),
  body('serviceQualityRating').optional().isInt({ min: 1, max: 5 }),
  body('staffFriendlinessRating').optional().isInt({ min: 1, max: 5 }),
  body('cleanlinessRating').optional().isInt({ min: 1, max: 5 }),
  body('valueForMoneyRating').optional().isInt({ min: 1, max: 5 }),
  body('imageUrls').optional().isArray({ max: 5 }),
];

const updateReviewValidation = [
  param('id').isUUID(),
  body('rating').optional().isInt({ min: 1, max: 5 }),
  body('title').optional().isString().trim().isLength({ max: 200 }),
  body('content').optional().isString().trim().isLength({ max: 2000 }),
];

// Public routes
router.get('/', reviewController.getReviews);
router.get('/:id', param('id').isUUID(), validateRequest, reviewController.getReview);

// Authenticated routes
router.post('/',
  authenticateUser,
  createReviewValidation,
  validateRequest,
  reviewController.createReview
);

router.put('/:id',
  authenticateUser,
  updateReviewValidation,
  validateRequest,
  reviewController.updateReview
);

router.delete('/:id',
  authenticateUser,
  param('id').isUUID(),
  validateRequest,
  reviewController.deleteReview
);

router.post('/:id/response',
  authenticateUser,
  [param('id').isUUID(), body('response').isString().trim().isLength({ min: 1, max: 1000 })],
  validateRequest,
  reviewController.addOwnerResponse
);

router.post('/:id/vote',
  authenticateUser,
  [param('id').isUUID(), body('isHelpful').isBoolean()],
  validateRequest,
  reviewController.voteReview
);

router.post('/:id/report',
  authenticateUser,
  [
    param('id').isUUID(),
    body('reason').isString().isIn(['spam', 'inappropriate_content', 'fake_review', 'harassment', 'competitor_review', 'personal_information', 'other']),
    body('description').optional().isString().trim().isLength({ max: 500 }),
  ],
  validateRequest,
  reviewController.reportReview
);

export default router;
```

---

## Frontend Implementation

### Step 6: Create Review Components

**Frontend components to create:**

1. `src/components/reviews/review-card.tsx` - Single review display
2. `src/components/reviews/review-list.tsx` - List of reviews with pagination
3. `src/components/reviews/review-form.tsx` - Create/edit review form
4. `src/components/reviews/rating-summary.tsx` - Shop rating summary
5. `src/components/reviews/star-rating.tsx` - Interactive star rating
6. `src/components/reviews/review-filters.tsx` - Filtering options

**API client to create:**

`src/lib/api/review-api.ts` - Review API methods

---

## Testing Plan

- [ ] Create review for completed reservation
- [ ] Prevent duplicate reviews
- [ ] Rate limiting on review creation
- [ ] Owner response functionality
- [ ] Helpful vote system
- [ ] Report functionality
- [ ] Rating summary calculations
- [ ] Image upload and display
- [ ] Review moderation (admin)

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Create backend types
- [ ] Implement service layer
- [ ] Implement controller
- [ ] Add routes
- [ ] Create frontend API client
- [ ] Create React components
- [ ] Add to shop detail page
- [ ] Add to user dashboard
- [ ] Admin moderation UI
- [ ] Test end-to-end flow
- [ ] Deploy to staging
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Review creation success rate | >95% |
| Average reviews per shop | >5 |
| Review moderation response time | <24h |
| User engagement (helpful votes) | >10% |
