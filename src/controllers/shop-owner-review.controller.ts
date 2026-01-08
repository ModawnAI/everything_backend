/**
 * Shop Owner Review Controller
 *
 * Handles review management endpoints for shop owners including:
 * - Fetching shop reviews with replies
 * - Creating, updating, and deleting review replies
 * - Requesting blind processing for malicious reviews
 * - Review statistics
 */

import { Request, Response } from 'express';
import { shopOwnerReviewService, ShopOwnerReviewServiceError } from '../services/shop-owner-review.service';
import { logger } from '../utils/logger';

interface ShopOwnerRequest extends Request {
  user?: {
    id: string;
    user_role: string;
  };
  shop?: {
    id: string;
    name: string;
  };
}

export class ShopOwnerReviewController {
  /**
   * GET /api/shop-owner/reviews
   * Get shop reviews with replies and blind request status
   */
  async getReviews(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      console.log('🔍 [REVIEWS] getReviews called', { shopId, query: req.query });

      if (!shopId) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            details: '샵 정보를 다시 확인해주세요.'
          }
        });
        return;
      }

      const { page, limit, status, sortBy } = req.query;

      console.log('🔍 [REVIEWS] Calling service', { shopId, status, page, limit, sortBy });

      const result = await shopOwnerReviewService.getShopReviews(shopId, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        status: status as 'all' | 'replied' | 'unreplied' | 'blinded' | undefined,
        sortBy: sortBy as 'newest' | 'oldest' | 'rating_high' | 'rating_low' | undefined,
      });

      console.log('🔍 [REVIEWS] Service result', { reviewCount: result.reviews?.length, total: result.total });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      console.error('❌ [REVIEWS] Error in getReviews', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error fetching shop reviews', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '리뷰를 불러오는 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/reviews/stats
   * Get review statistics for the shop
   */
  async getStats(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      if (!shopId) {
        res.status(404).json({
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.'
          }
        });
        return;
      }

      const stats = await shopOwnerReviewService.getReviewStats(shopId);

      res.status(200).json({
        success: true,
        data: stats
      });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error fetching review stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '통계를 불러오는 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/shop-owner/reviews/:reviewId/reply
   * Create a reply to a review
   */
  async createReply(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      const userId = req.user?.id;
      const { reviewId } = req.params;
      const { replyText } = req.body;

      if (!shopId || !userId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      if (!replyText || typeof replyText !== 'string' || replyText.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '답글 내용을 입력해주세요.'
          }
        });
        return;
      }

      if (replyText.length > 1000) {
        res.status(400).json({
          error: {
            code: 'REPLY_TOO_LONG',
            message: '답글은 1000자 이내로 작성해주세요.'
          }
        });
        return;
      }

      const reply = await shopOwnerReviewService.replyToReview(reviewId, shopId, userId, {
        replyText: replyText.trim(),
      });

      res.status(201).json({
        success: true,
        data: reply,
        message: '답글이 등록되었습니다.'
      });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error creating reply', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '답글 등록 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * PUT /api/shop-owner/reviews/:reviewId/reply
   * Update an existing reply
   */
  async updateReply(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { replyText, replyId } = req.body;

      if (!shopId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      if (!replyId) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '답글 ID가 필요합니다.'
          }
        });
        return;
      }

      if (!replyText || typeof replyText !== 'string' || replyText.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '답글 내용을 입력해주세요.'
          }
        });
        return;
      }

      if (replyText.length > 1000) {
        res.status(400).json({
          error: {
            code: 'REPLY_TOO_LONG',
            message: '답글은 1000자 이내로 작성해주세요.'
          }
        });
        return;
      }

      const reply = await shopOwnerReviewService.updateReply(replyId, shopId, {
        replyText: replyText.trim(),
      });

      res.status(200).json({
        success: true,
        data: reply,
        message: '답글이 수정되었습니다.'
      });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error updating reply', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '답글 수정 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * DELETE /api/shop-owner/reviews/:reviewId/reply
   * Delete a reply
   */
  async deleteReply(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { replyId } = req.body;

      if (!shopId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      if (!replyId) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '답글 ID가 필요합니다.'
          }
        });
        return;
      }

      await shopOwnerReviewService.deleteReply(replyId, shopId);

      res.status(200).json({
        success: true,
        message: '답글이 삭제되었습니다.'
      });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error deleting reply', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '답글 삭제 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * POST /api/shop-owner/reviews/:reviewId/blind-request
   * Request blind processing for a malicious review
   */
  async requestBlind(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;
      const { reviewId } = req.params;
      const { reason, reasonCategory, evidenceUrls } = req.body;

      if (!shopId) {
        res.status(401).json({
          error: {
            code: 'UNAUTHORIZED',
            message: '인증이 필요합니다.'
          }
        });
        return;
      }

      if (!reason || typeof reason !== 'string' || reason.trim().length === 0) {
        res.status(400).json({
          error: {
            code: 'INVALID_INPUT',
            message: '블라인드 요청 사유를 입력해주세요.'
          }
        });
        return;
      }

      const validCategories = ['profanity', 'false_info', 'personal_attack', 'spam', 'other'];
      if (!reasonCategory || !validCategories.includes(reasonCategory)) {
        res.status(400).json({
          error: {
            code: 'INVALID_CATEGORY',
            message: '올바른 신고 카테고리를 선택해주세요.'
          }
        });
        return;
      }

      const blindRequest = await shopOwnerReviewService.requestBlind(reviewId, shopId, {
        reason: reason.trim(),
        reasonCategory,
        evidenceUrls: evidenceUrls || [],
      });

      res.status(201).json({
        success: true,
        data: blindRequest,
        message: '블라인드 요청이 접수되었습니다.'
      });
    } catch (error) {
      if (error instanceof ShopOwnerReviewServiceError) {
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message
          }
        });
        return;
      }
      logger.error('Error creating blind request', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: '블라인드 요청 중 오류가 발생했습니다.'
        }
      });
    }
  }
}

export const shopOwnerReviewController = new ShopOwnerReviewController();
