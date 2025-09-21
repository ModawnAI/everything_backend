/**
 * Image Metadata Controller
 * 
 * Handles advanced image metadata management including alt text generation,
 * categorization, reordering, and batch operations
 */

import { Request, Response, NextFunction } from 'express';
import { ImageMetadataService, ImageMetadataUpdate, ImageReorderRequest } from '../services/image-metadata.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

// Request interfaces
interface AuthenticatedRequest extends Request {
  user?: { id: string; role: string };
}

export class ImageMetadataController {
  private supabase = getSupabaseClient();
  private imageMetadataService = new ImageMetadataService();

  /**
   * GET /api/shop/images/:imageId/metadata
   * Get image metadata
   */
  public getImageMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageId = req.params.imageId;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!imageId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IMAGE_ID',
            message: '이미지 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the image
      const { data: image, error: imageError } = await this.supabase
        .from('shop_images')
        .select(`
          *,
          shops!inner(
            id,
            owner_id
          )
        `)
        .eq('id', imageId)
        .eq('shops.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          image: image
        },
        message: '이미지 메타데이터를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.getImageMetadata error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/shop/images/:imageId/metadata
   * Update image metadata
   */
  public updateImageMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageId = req.params.imageId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const updates: ImageMetadataUpdate = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!imageId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IMAGE_ID',
            message: '이미지 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the image
      const { data: image, error: imageError } = await this.supabase
        .from('shop_images')
        .select(`
          id,
          shops!inner(
            id,
            owner_id
          )
        `)
        .eq('id', imageId)
        .eq('shops.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Update metadata
      const updatedImage = await this.imageMetadataService.updateImageMetadata(imageId, updates);

      if (!updatedImage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '이미지 메타데이터 업데이트에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          image: updatedImage
        },
        message: '이미지 메타데이터가 성공적으로 업데이트되었습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.updateImageMetadata error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/shop/images/:imageId/alt-text-suggestions
   * Get alt text suggestions
   */
  public getAltTextSuggestions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageId = req.params.imageId;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!imageId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_IMAGE_ID',
            message: '이미지 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the image
      const { data: image, error: imageError } = await this.supabase
        .from('shop_images')
        .select(`
          id,
          shops!inner(
            id,
            owner_id
          )
        `)
        .eq('id', imageId)
        .eq('shops.owner_id', userId)
        .single();

      if (imageError || !image) {
        res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Generate suggestions
      const suggestions = await this.imageMetadataService.generateAltTextSuggestion(imageId);

      res.status(200).json({
        success: true,
        data: {
          suggestions
        },
        message: '대체 텍스트 제안을 성공적으로 생성했습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.getAltTextSuggestions error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/shop/:shopId/images/reorder
   * Reorder shop images
   */
  public reorderImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const { imageOrders }: { imageOrders: ImageReorderRequest[] } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, owner_id')
        .eq('id', shopId)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
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

      // Reorder images
      const success = await this.imageMetadataService.reorderImages(shopId, imageOrders);

      if (!success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'REORDER_FAILED',
            message: '이미지 순서 변경에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          reordered_count: imageOrders.length
        },
        message: '이미지 순서가 성공적으로 변경되었습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.reorderImages error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/shop/:shopId/images/batch-update
   * Batch update image metadata
   */
  public batchUpdateMetadata = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const { updates } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, owner_id')
        .eq('id', shopId)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
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

      // Perform batch update
      const result = await this.imageMetadataService.batchUpdateMetadata(updates);

      res.status(200).json({
        success: true,
        data: {
          success_count: result.success,
          failed_count: result.failed,
          errors: result.errors
        },
        message: '배치 업데이트가 완료되었습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.batchUpdateMetadata error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/shop/:shopId/images/search
   * Search images by metadata
   */
  public searchImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const searchQuery = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, owner_id')
        .eq('id', shopId)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
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

      // Search images
      const images = await this.imageMetadataService.searchImages(shopId, searchQuery);

      res.status(200).json({
        success: true,
        data: {
          images,
          total_count: images.length
        },
        message: '검색이 완료되었습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.searchImages error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/shop/:shopId/images/stats
   * Get image statistics
   */
  public getImageStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, owner_id')
        .eq('id', shopId)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
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

      // Get statistics
      const stats = await this.imageMetadataService.getImageStats(shopId);

      if (!stats) {
        res.status(400).json({
          success: false,
          error: {
            code: 'STATS_FAILED',
            message: '이미지 통계 조회에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: stats,
        message: '이미지 통계를 성공적으로 조회했습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.getImageStats error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/shop/:shopId/images/archive
   * Archive/unarchive images
   */
  public archiveImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as AuthenticatedRequest).user?.id;
      const { imageIds, archive = true } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Verify user owns the shop
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, owner_id')
        .eq('id', shopId)
        .eq('owner_id', userId)
        .single();

      if (shopError || !shop) {
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

      // Archive images
      const success = await this.imageMetadataService.archiveImages(imageIds, archive);

      if (!success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'ARCHIVE_FAILED',
            message: '이미지 보관 처리에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          processed_count: imageIds.length,
          archive_status: archive
        },
        message: archive ? '이미지가 성공적으로 보관되었습니다.' : '이미지가 성공적으로 복원되었습니다.'
      });

    } catch (error) {
      logger.error('ImageMetadataController.archiveImages error:', { error });
      next(error);
    }
  };
}

export const imageMetadataController = new ImageMetadataController();
