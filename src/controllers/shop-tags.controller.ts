/**
 * Shop Tags Controller
 *
 * Handles shop tag management API endpoints
 */

import { Response } from 'express';
import { shopTagsService } from '../services/shop-tags.service';
import { logger } from '../utils/logger';
import { ShopOwnerRequest } from '../middleware/shop-owner-auth.middleware';

export class ShopTagsController {
  /**
   * GET /api/shop-owner/settings/tags
   * Get shop tags for the authenticated shop owner
   */
  async getTags(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;

      if (!shopId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const tags = await shopTagsService.getShopTags(shopId);

      res.status(200).json({
        success: true,
        data: {
          tags,
          count: tags.length
        },
        message: '태그를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('ShopTagsController.getTags error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.shop?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * PUT /api/shop-owner/settings/tags
   * Update shop tags (replace all)
   */
  async updateTags(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const shopId = req.shop?.id;

      if (!shopId) {
        res.status(404).json({
          success: false,
          error: {
            code: 'SHOP_NOT_FOUND',
            message: '샵을 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const { tags } = req.body;

      if (!Array.isArray(tags)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_INPUT',
            message: '태그는 배열 형태여야 합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (tags.length > 10) {
        res.status(400).json({
          success: false,
          error: {
            code: 'TOO_MANY_TAGS',
            message: '태그는 최대 10개까지 등록할 수 있습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Validate each tag
      for (const tag of tags) {
        if (typeof tag !== 'string' || tag.length > 20) {
          res.status(400).json({
            success: false,
            error: {
              code: 'INVALID_TAG',
              message: '태그는 20자 이하의 문자열이어야 합니다.',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }
      }

      const updatedTags = await shopTagsService.updateShopTags(shopId, tags);

      logger.info('Shop tags updated', {
        shopId,
        userId: req.user?.id,
        tagCount: updatedTags.length
      });

      res.status(200).json({
        success: true,
        data: {
          tags: updatedTags,
          count: updatedTags.length
        },
        message: '태그가 성공적으로 저장되었습니다.'
      });
    } catch (error) {
      logger.error('ShopTagsController.updateTags error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId: req.shop?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 저장 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/settings/tags/popular
   * Get popular tags for autocomplete
   */
  async getPopularTags(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 20;
      const tags = await shopTagsService.getPopularTags(Math.min(limit, 50));

      res.status(200).json({
        success: true,
        data: {
          tags
        },
        message: '인기 태그를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('ShopTagsController.getPopularTags error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '인기 태그 조회 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  }

  /**
   * GET /api/shop-owner/settings/tags/search
   * Search tags for autocomplete
   */
  async searchTags(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const { q } = req.query;

      if (!q || typeof q !== 'string') {
        res.status(200).json({
          success: true,
          data: { tags: [] },
          message: '검색 결과가 없습니다.'
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 10;
      const tags = await shopTagsService.searchTags(q, Math.min(limit, 20));

      res.status(200).json({
        success: true,
        data: {
          tags,
          query: q
        },
        message: '태그 검색이 완료되었습니다.'
      });
    } catch (error) {
      logger.error('ShopTagsController.searchTags error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query.q
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '태그 검색 중 오류가 발생했습니다.',
          timestamp: new Date().toISOString()
        }
      });
    }
  }
}

export const shopTagsController = new ShopTagsController();
