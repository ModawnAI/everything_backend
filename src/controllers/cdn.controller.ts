/**
 * CDN Controller
 * 
 * Handles CDN-related API endpoints for image URL generation,
 * transformation, and optimization
 */

import { Request, Response, NextFunction } from 'express';
import { CDNService, ImageTransformationOptions } from '../services/cdn.service';
import { ImageService } from '../services/image.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../types/auth.types';

const cdnService = new CDNService();
const imageService = new ImageService();

export class CDNController {
  /**
   * GET /api/cdn/images/:imageId/urls
   * Get CDN URLs for an image with optional transformations
   */
  public getImageCDNUrls = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { imageId } = req.params;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
      }

      // Parse transformation options from query parameters
      const transformations: ImageTransformationOptions = {};
      
      if (req.query.width) {
        transformations.width = parseInt(req.query.width as string);
      }
      if (req.query.height) {
        transformations.height = parseInt(req.query.height as string);
      }
      if (req.query.quality) {
        transformations.quality = parseInt(req.query.quality as string);
      }
      if (req.query.format) {
        transformations.format = req.query.format as any;
      }
      if (req.query.fit) {
        transformations.fit = req.query.fit as any;
      }
      if (req.query.position) {
        transformations.position = req.query.position as any;
      }
      if (req.query.background) {
        transformations.background = req.query.background as string;
      }
      if (req.query.blur) {
        transformations.blur = parseInt(req.query.blur as string);
      }
      if (req.query.sharpen) {
        transformations.sharpen = parseInt(req.query.sharpen as string);
      }
      if (req.query.brightness) {
        transformations.brightness = parseInt(req.query.brightness as string);
      }
      if (req.query.contrast) {
        transformations.contrast = parseInt(req.query.contrast as string);
      }
      if (req.query.saturation) {
        transformations.saturation = parseInt(req.query.saturation as string);
      }
      if (req.query.hue) {
        transformations.hue = parseInt(req.query.hue as string);
      }
      if (req.query.gamma) {
        transformations.gamma = parseInt(req.query.gamma as string);
      }
      if (req.query.progressive) {
        transformations.progressive = req.query.progressive === 'true';
      }
      if (req.query.stripMetadata) {
        transformations.stripMetadata = req.query.stripMetadata === 'true';
      }

      const cdnResult = await imageService.getImageCDNUrls(imageId, transformations);

      if (!cdnResult) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: cdnResult,
        message: 'CDN URL을 성공적으로 생성했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.getImageCDNUrls error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userId: (req as AuthenticatedRequest).user?.id,
        query: req.query
      });
      next(error);
    }
  };

  /**
   * GET /api/cdn/images/:imageId/optimized
   * Get optimized CDN URLs for all sizes of an image
   */
  public getImageOptimizedCDNUrls = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { imageId } = req.params;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
      }

      const optimizedUrls = await imageService.getImageOptimizedCDNUrls(imageId);

      if (!optimizedUrls) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.'
          }
        });
      }

      res.status(200).json({
        success: true,
        data: optimizedUrls,
        message: '최적화된 CDN URL을 성공적으로 생성했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.getImageOptimizedCDNUrls error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userId: (req as AuthenticatedRequest).user?.id
      });
      next(error);
    }
  };

  /**
   * POST /api/cdn/images/:imageId/responsive
   * Generate responsive image URLs for different screen sizes
   */
  public generateResponsiveUrls = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { imageId } = req.params;
      const { breakpoints = [320, 640, 768, 1024, 1280, 1920] } = req.body;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
      }

      // Get image data to extract file path
      const { data: image, error } = await imageService['supabase']
        .from('shop_images')
        .select('image_url, large_url')
        .eq('id', imageId)
        .single();

      if (error || !image) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.'
          }
        });
      }

      // Extract file path from URL
      const filePath = imageService['extractFilePathFromUrl'](image.large_url || image.image_url);
      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IMAGE_URL',
            message: '이미지 URL에서 파일 경로를 추출할 수 없습니다.'
          }
        });
      }

      const responsiveUrls = cdnService.generateResponsiveUrls(filePath, 'shop-images', breakpoints);

      res.status(200).json({
        success: true,
        data: responsiveUrls,
        message: '반응형 이미지 URL을 성공적으로 생성했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.generateResponsiveUrls error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userId: (req as AuthenticatedRequest).user?.id,
        body: req.body
      });
      next(error);
    }
  };

  /**
   * GET /api/cdn/images/:imageId/webp
   * Generate WebP URLs with fallback
   */
  public generateWebPUrls = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { imageId } = req.params;
      const { transformations = {} } = req.body;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
      }

      // Get image data to extract file path
      const { data: image, error } = await imageService['supabase']
        .from('shop_images')
        .select('image_url, large_url')
        .eq('id', imageId)
        .single();

      if (error || !image) {
        return res.status(404).json({
          success: false,
          error: {
            code: 'IMAGE_NOT_FOUND',
            message: '이미지를 찾을 수 없습니다.'
          }
        });
      }

      // Extract file path from URL
      const filePath = imageService['extractFilePathFromUrl'](image.large_url || image.image_url);
      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IMAGE_URL',
            message: '이미지 URL에서 파일 경로를 추출할 수 없습니다.'
          }
        });
      }

      const webpUrls = cdnService.generateWebPUrls(filePath, 'shop-images', transformations);

      res.status(200).json({
        success: true,
        data: webpUrls,
        message: 'WebP URL을 성공적으로 생성했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.generateWebPUrls error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        imageId: req.params.imageId,
        userId: (req as AuthenticatedRequest).user?.id,
        body: req.body
      });
      next(error);
    }
  };

  /**
   * GET /api/cdn/config
   * Get CDN configuration
   */
  public getCDNConfig = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const config = cdnService.getConfiguration();
      const validation = cdnService.validateConfiguration();

      res.status(200).json({
        success: true,
        data: {
          config,
          validation
        },
        message: 'CDN 설정을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.getCDNConfig error:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * POST /api/cdn/test
   * Test CDN connectivity
   */
  public testCDNConnectivity = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const result = await cdnService.testCDNConnectivity();

      res.status(200).json({
        success: true,
        data: result,
        message: 'CDN 연결 테스트를 완료했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.testCDNConnectivity error:', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  };

  /**
   * POST /api/cdn/transform
   * Transform an image URL with custom parameters
   */
  public transformImageUrl = async (req: Request, res: Response, next: NextFunction): Promise<Response | void> => {
    try {
      const { filePath, bucket = 'shop-images', transformations = {}, options = {} } = req.body;
      const userId = (req as AuthenticatedRequest).user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
      }

      if (!filePath) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_FILE_PATH',
            message: '파일 경로가 필요합니다.'
          }
        });
      }

      const cdnResult = cdnService.generateCDNUrl(filePath, bucket, {
        transformations,
        ...options
      });

      res.status(200).json({
        success: true,
        data: cdnResult,
        message: '이미지 변환 URL을 성공적으로 생성했습니다.'
      });
    } catch (error) {
      logger.error('CDNController.transformImageUrl error:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as AuthenticatedRequest).user?.id,
        body: req.body
      });
      next(error);
    }
  };
}

export const cdnController = new CDNController();
