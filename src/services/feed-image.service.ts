/**
 * Feed Image Service
 * 
 * Handles image upload, processing, and management for social feed posts
 * Integrates with Sharp for image optimization and Supabase Storage
 */

import sharp from 'sharp';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { storageService } from './storage.service';
import { imageTransformationService } from './image-transformation.service';

export interface FeedImageUploadOptions {
  altText?: string;
  displayOrder: number;
}

export interface FeedImageUploadResult {
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  metadata?: {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}

export interface FeedImageBatchUploadResult {
  success: boolean;
  images?: Array<{
    imageUrl: string;
    thumbnailUrl: string;
    altText?: string;
    displayOrder: number;
    metadata: {
      originalSize: number;
      optimizedSize: number;
      width: number;
      height: number;
      format: string;
    };
  }>;
  error?: string;
}

export class FeedImageService {
  private supabase = getSupabaseClient();
  private readonly BUCKET_ID = 'feed-posts';
  private readonly MAX_IMAGES_PER_POST = 10;
  private readonly MAX_FILE_SIZE = 8 * 1024 * 1024; // 8MB
  private readonly ALLOWED_FORMATS = ['jpeg', 'jpg', 'png', 'webp'];
  private readonly IMAGE_QUALITY = 85;
  private readonly THUMBNAIL_SIZE = 300;
  private readonly MEDIUM_SIZE = 800;
  private readonly LARGE_SIZE = 1200;

  /**
   * Validate image file
   */
  private async validateImageFile(buffer: Buffer, fileName: string): Promise<void> {
    // Check file size
    if (buffer.length > this.MAX_FILE_SIZE) {
      throw new Error(`File size exceeds maximum limit of ${this.MAX_FILE_SIZE / 1024 / 1024}MB`);
    }

    // Check file format
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (!fileExtension || !this.ALLOWED_FORMATS.includes(fileExtension)) {
      throw new Error(`Unsupported file format. Allowed formats: ${this.ALLOWED_FORMATS.join(', ')}`);
    }

    // Validate image using Sharp
    try {
      const metadata = await sharp(buffer).metadata();
      if (!metadata.width || !metadata.height) {
        throw new Error('Invalid image file');
      }

      // Check dimensions (minimum 100x100, maximum 4000x4000)
      if (metadata.width < 100 || metadata.height < 100) {
        throw new Error('Image dimensions too small. Minimum 100x100 pixels required');
      }
      if (metadata.width > 4000 || metadata.height > 4000) {
        throw new Error('Image dimensions too large. Maximum 4000x4000 pixels allowed');
      }
    } catch (error) {
      throw new Error('Invalid or corrupted image file');
    }
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(userId: string, originalName: string): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    return `${userId}/${timestamp}-${randomSuffix}.${extension}`;
  }

  /**
   * Process image with Sharp - create optimized versions
   */
  private async processImage(buffer: Buffer): Promise<{
    thumbnail: { buffer: Buffer; info: sharp.OutputInfo };
    medium: { buffer: Buffer; info: sharp.OutputInfo };
    large: { buffer: Buffer; info: sharp.OutputInfo };
    original: { metadata: sharp.Metadata };
  }> {
    const originalMetadata = await sharp(buffer).metadata();

    // Create thumbnail (300px max dimension)
    const thumbnailResult = await sharp(buffer)
      .resize(this.THUMBNAIL_SIZE, this.THUMBNAIL_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: this.IMAGE_QUALITY, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    // Create medium size (800px max dimension)
    const mediumResult = await sharp(buffer)
      .resize(this.MEDIUM_SIZE, this.MEDIUM_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: this.IMAGE_QUALITY, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    // Create large size (1200px max dimension)
    const largeResult = await sharp(buffer)
      .resize(this.LARGE_SIZE, this.LARGE_SIZE, {
        fit: 'inside',
        withoutEnlargement: true
      })
      .webp({ quality: this.IMAGE_QUALITY, effort: 6 })
      .toBuffer({ resolveWithObject: true });

    return {
      thumbnail: { buffer: thumbnailResult.data, info: thumbnailResult.info },
      medium: { buffer: mediumResult.data, info: mediumResult.info },
      large: { buffer: largeResult.data, info: largeResult.info },
      original: { metadata: originalMetadata }
    };
  }

  /**
   * Upload processed image to storage
   */
  private async uploadToStorage(
    buffer: Buffer,
    filePath: string,
    contentType: string = 'image/webp'
  ): Promise<string> {
    const result = await storageService.uploadFile(this.BUCKET_ID, filePath, buffer, {
      contentType,
      optimizeImage: false, // Already optimized
      metadata: {
        uploadedAt: new Date().toISOString(),
        processedBy: 'feed-image-service'
      }
    });

    if (!result.success || !result.fileUrl) {
      throw new Error(result.error || 'Failed to upload image to storage');
    }

    return result.fileUrl;
  }

  /**
   * Upload a single feed post image
   */
  async uploadFeedImage(
    userId: string,
    imageBuffer: Buffer,
    fileName: string,
    options: FeedImageUploadOptions
  ): Promise<FeedImageUploadResult> {
    try {
      // Validate image
      await this.validateImageFile(imageBuffer, fileName);

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFilename(userId, fileName);
      const baseFileName = uniqueFileName.replace(/\.[^/.]+$/, ''); // Remove extension

      // Process image into different sizes
      const processedImages = await this.processImage(imageBuffer);

      // Upload all sizes to storage
      const [thumbnailUrl, mediumUrl, largeUrl] = await Promise.all([
        this.uploadToStorage(
          processedImages.thumbnail.buffer,
          `thumbnails/${baseFileName}.webp`
        ),
        this.uploadToStorage(
          processedImages.medium.buffer,
          `medium/${baseFileName}.webp`
        ),
        this.uploadToStorage(
          processedImages.large.buffer,
          `large/${baseFileName}.webp`
        )
      ]);

      // Use medium size as the main image URL for feed display
      const imageUrl = mediumUrl;

      logger.info('Feed image uploaded successfully', {
        userId,
        fileName,
        imageUrl,
        thumbnailUrl,
        originalSize: imageBuffer.length,
        optimizedSize: processedImages.medium.buffer.length,
        dimensions: {
          original: `${processedImages.original.metadata.width}x${processedImages.original.metadata.height}`,
          medium: `${processedImages.medium.info.width}x${processedImages.medium.info.height}`,
          thumbnail: `${processedImages.thumbnail.info.width}x${processedImages.thumbnail.info.height}`
        }
      });

      return {
        success: true,
        imageUrl,
        thumbnailUrl,
        metadata: {
          originalSize: imageBuffer.length,
          optimizedSize: processedImages.medium.buffer.length,
          width: processedImages.medium.info.width!,
          height: processedImages.medium.info.height!,
          format: 'webp'
        }
      };

    } catch (error) {
      logger.error('Feed image upload failed', {
        userId,
        fileName,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image upload failed'
      };
    }
  }

  /**
   * Upload multiple feed post images
   */
  async uploadFeedImages(
    userId: string,
    images: Array<{
      buffer: Buffer;
      fileName: string;
      altText?: string;
      displayOrder: number;
    }>
  ): Promise<FeedImageBatchUploadResult> {
    try {
      // Validate batch size
      if (images.length > this.MAX_IMAGES_PER_POST) {
        return {
          success: false,
          error: `Maximum ${this.MAX_IMAGES_PER_POST} images allowed per post`
        };
      }

      if (images.length === 0) {
        return {
          success: false,
          error: 'No images provided'
        };
      }

      // Upload all images
      const uploadPromises = images.map(async (image) => {
        const result = await this.uploadFeedImage(userId, image.buffer, image.fileName, {
          altText: image.altText,
          displayOrder: image.displayOrder
        });

        if (!result.success) {
          throw new Error(`Failed to upload ${image.fileName}: ${result.error}`);
        }

        return {
          imageUrl: result.imageUrl!,
          thumbnailUrl: result.thumbnailUrl!,
          altText: image.altText,
          displayOrder: image.displayOrder,
          metadata: result.metadata!
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);

      // Sort by display order
      uploadedImages.sort((a, b) => a.displayOrder - b.displayOrder);

      logger.info('Feed images batch upload completed', {
        userId,
        imageCount: uploadedImages.length,
        totalOriginalSize: uploadedImages.reduce((sum, img) => sum + img.metadata.originalSize, 0),
        totalOptimizedSize: uploadedImages.reduce((sum, img) => sum + img.metadata.optimizedSize, 0)
      });

      return {
        success: true,
        images: uploadedImages
      };

    } catch (error) {
      logger.error('Feed images batch upload failed', {
        userId,
        imageCount: images.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Batch image upload failed'
      };
    }
  }

  /**
   * Delete feed post image
   */
  async deleteFeedImage(userId: string, imageUrl: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Extract file path from URL
      const urlParts = imageUrl.split('/');
      const fileName = urlParts[urlParts.length - 1];
      const baseFileName = fileName.replace(/\.[^/.]+$/, '');

      // Delete all sizes
      const deletePromises = [
        storageService.deleteFile(this.BUCKET_ID, `thumbnails/${baseFileName}.webp`),
        storageService.deleteFile(this.BUCKET_ID, `medium/${baseFileName}.webp`),
        storageService.deleteFile(this.BUCKET_ID, `large/${baseFileName}.webp`)
      ];

      await Promise.all(deletePromises);

      logger.info('Feed image deleted successfully', { userId, imageUrl });

      return { success: true };

    } catch (error) {
      logger.error('Feed image deletion failed', {
        userId,
        imageUrl,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image deletion failed'
      };
    }
  }
}

export const feedImageService = new FeedImageService();
