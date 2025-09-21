/**
 * Shop Image Controller
 * 
 * Handles shop image upload, management, and optimization
 */

import { Request, Response, NextFunction } from 'express';
import { imageService, ShopImageData } from '../services/image.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

// Request interfaces
interface ShopImageRequest extends Request {
  user?: { id: string };
  file?: Express.Multer.File;
}

export class ShopImageController {
  /**
   * POST /api/shops/:shopId/images
   * Upload shop image
   */
  public uploadShopImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const userId = (req as any).user?.id;

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

      const file = req.file;
      if (!file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'NO_FILE_PROVIDED',
            message: '업로드할 이미지 파일을 선택해주세요.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract options from request body
      const { isPrimary, altText, displayOrder } = req.body;

      const uploadOptions: {
        isPrimary?: boolean;
        altText?: string;
        displayOrder?: number;
      } = {
        isPrimary: isPrimary === 'true'
      };

      if (altText) {
        uploadOptions.altText = altText;
      }

      if (displayOrder) {
        uploadOptions.displayOrder = parseInt(displayOrder);
      }

      const result = await imageService.uploadShopImage(
        shopId,
        file.buffer,
        file.originalname,
        file.mimetype,
        uploadOptions
      );

      if (!result.success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPLOAD_FAILED',
            message: result.error || '이미지 업로드에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: {
          imageUrl: result.imageUrl,
          thumbnailUrl: result.thumbnailUrl,
          mediumUrl: result.mediumUrl,
          largeUrl: result.largeUrl,
          metadata: result.metadata,
          message: '샵 이미지가 성공적으로 업로드되었습니다.'
        }
      });

    } catch (error) {
      logger.error('ShopImageController.uploadShopImage error:', { error });
      next(error);
    }
  };

  /**
   * GET /api/shops/:shopId/images
   * Get shop images
   */
  public getShopImages = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;

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

      const images = await imageService.getShopImages(shopId);

      res.status(200).json({
        success: true,
        data: {
          images,
          count: images.length,
          message: '샵 이미지를 성공적으로 조회했습니다.'
        }
      });

    } catch (error) {
      logger.error('ShopImageController.getShopImages error:', { error });
      next(error);
    }
  };

  /**
   * DELETE /api/shops/:shopId/images/:imageId
   * Delete shop image
   */
  public deleteShopImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageId = req.params.imageId;
      const userId = (req as any).user?.id;

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

      const success = await imageService.deleteShopImage(imageId);

      if (!success) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: '이미지 삭제에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          message: '이미지가 성공적으로 삭제되었습니다.'
        }
      });

    } catch (error) {
      logger.error('ShopImageController.deleteShopImage error:', { error });
      next(error);
    }
  };

  /**
   * PUT /api/shops/:shopId/images/:imageId
   * Update shop image metadata
   */
  public updateShopImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const imageId = req.params.imageId;
      const userId = (req as any).user?.id;

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

      const { altText, isPrimary, displayOrder } = req.body;

      const updateOptions: {
        alt_text?: string;
        is_primary?: boolean;
        display_order?: number;
      } = {
        is_primary: isPrimary === 'true'
      };

      if (altText) {
        updateOptions.alt_text = altText;
      }

      if (displayOrder) {
        updateOptions.display_order = parseInt(displayOrder);
      }

      const updatedImage = await imageService.updateShopImage(imageId, updateOptions);

      if (!updatedImage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '이미지 정보 업데이트에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          image: updatedImage,
          message: '이미지 정보가 성공적으로 업데이트되었습니다.'
        }
      });

    } catch (error) {
      logger.error('ShopImageController.updateShopImage error:', { error });
      next(error);
    }
  };

  /**
   * POST /api/shops/:shopId/images/:imageId/set-primary
   * Set image as primary
   */
  public setPrimaryImage = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const shopId = req.params.shopId;
      const imageId = req.params.imageId;
      const userId = (req as any).user?.id;

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

      if (!shopId || !imageId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: '샵 ID와 이미지 ID가 필요합니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // First, unset all primary images for this shop
      const supabase = getSupabaseClient();
      const { error: unsetError } = await supabase
        .from('shop_images')
        .update({ is_primary: false })
        .eq('shop_id', shopId);

      if (unsetError) {
        logger.error('Error unsetting primary images:', { shopId, error: unsetError });
        res.status(500).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '대표 이미지 설정에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Set the specified image as primary
      const updatedImage = await imageService.updateShopImage(imageId, {
        is_primary: true
      });

      if (!updatedImage) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '대표 이미지 설정에 실패했습니다.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          image: updatedImage,
          message: '대표 이미지가 성공적으로 설정되었습니다.'
        }
      });

    } catch (error) {
      logger.error('ShopImageController.setPrimaryImage error:', { error });
      next(error);
    }
  };
}

export const shopImageController = new ShopImageController(); 