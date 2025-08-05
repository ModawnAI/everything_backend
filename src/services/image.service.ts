/**
 * Image Service
 * 
 * Handles image upload, optimization, and management using Sharp
 * Supports multiple image formats and Supabase Storage integration
 */

import sharp from 'sharp';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
}

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  largeUrl?: string;
  metadata?: {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    format: string;
  };
  error?: string;
}

export interface ShopImageData {
  id: string;
  shop_id: string;
  image_url: string;
  thumbnail_url?: string;
  medium_url?: string;
  large_url?: string;
  alt_text?: string;
  is_primary: boolean;
  display_order: number;
  metadata?: {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    format: string;
  };
  created_at: string;
}

export class ImageService {
  private supabase = getSupabaseClient();

  /**
   * Optimize image using Sharp
   */
  private async optimizeImage(
    buffer: Buffer,
    options: ImageOptimizationOptions = {}
  ): Promise<Buffer> {
    const {
      width = 800,
      height = 600,
      quality = 80,
      format = 'jpeg',
      fit = 'inside'
    } = options;

    let sharpInstance = sharp(buffer);

    // Resize image
    sharpInstance = sharpInstance.resize(width, height, { fit });

    // Apply format-specific optimization
    switch (format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({ quality });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
    }

    return await sharpInstance.toBuffer();
  }

  /**
   * Generate multiple image formats
   */
  private async generateImageFormats(buffer: Buffer): Promise<{
    thumbnail: Buffer;
    medium: Buffer;
    large: Buffer;
  }> {
    const [thumbnail, medium, large] = await Promise.all([
      this.optimizeImage(buffer, { width: 150, height: 150, fit: 'cover' }),
      this.optimizeImage(buffer, { width: 400, height: 300, fit: 'inside' }),
      this.optimizeImage(buffer, { width: 800, height: 600, fit: 'inside' })
    ]);

    return { thumbnail, medium, large };
  }

  /**
   * Extract image metadata
   */
  private async extractMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
  }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length
    };
  }

  /**
   * Validate image file
   */
  private validateImageFile(buffer: Buffer, fileName: string): void {
    const maxSize = config.storage.maxFileSize; // 5MB
    const allowedTypes = config.storage.allowedFileTypes;
    
    if (buffer.length > maxSize) {
      throw new Error(`이미지 파일 크기는 ${Math.round(maxSize / 1024 / 1024)}MB 이하여야 합니다.`);
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    const allowedExtensions = allowedTypes.map(type => type.split('/')[1]);
    
    if (!extension || !allowedExtensions.includes(extension)) {
      throw new Error('JPG, PNG, WebP 형식의 이미지만 업로드 가능합니다.');
    }
  }

  /**
   * Get content type for file extension
   */
  private getContentType(extension?: string): string {
    switch (extension?.toLowerCase()) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg';
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /**
   * Generate unique filename
   */
  private generateUniqueFilename(originalName: string, prefix: string): string {
    const extension = originalName.split('.').pop()?.toLowerCase() || 'jpg';
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 15);
    return `${prefix}-${timestamp}-${randomId}.${extension}`;
  }

  /**
   * Upload image to Supabase Storage
   */
  private async uploadToStorage(
    buffer: Buffer,
    filePath: string,
    contentType: string
  ): Promise<string> {
    const { data, error } = await this.supabase.storage
      .from('shop-images')
      .upload(filePath, buffer, {
        contentType,
        upsert: false
      });

    if (error) {
      throw new Error(`Storage upload failed: ${error.message}`);
    }

    // Get public URL
    const { data: urlData } = this.supabase.storage
      .from('shop-images')
      .getPublicUrl(filePath);

    return urlData.publicUrl;
  }

  /**
   * Upload shop image with optimization
   */
  async uploadShopImage(
    shopId: string,
    imageBuffer: Buffer,
    fileName: string,
    options: {
      isPrimary?: boolean;
      altText?: string;
      displayOrder?: number;
    } = {}
  ): Promise<ImageUploadResult> {
    try {
      // Validate file
      this.validateImageFile(imageBuffer, fileName);

      // Extract original metadata
      const originalMetadata = await this.extractMetadata(imageBuffer);

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFilename(fileName, `shop-${shopId}`);
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';

      // Generate multiple formats
      const { thumbnail, medium, large } = await this.generateImageFormats(imageBuffer);

      // Upload all formats to storage
      const [thumbnailUrl, mediumUrl, largeUrl] = await Promise.all([
        this.uploadToStorage(thumbnail, `thumbnails/${uniqueFileName}`, this.getContentType(fileExtension)),
        this.uploadToStorage(medium, `medium/${uniqueFileName}`, this.getContentType(fileExtension)),
        this.uploadToStorage(large, `large/${uniqueFileName}`, this.getContentType(fileExtension))
      ]);

      // Use large format as main image URL
      const imageUrl = largeUrl;

      // Calculate optimized size (use large format size)
      const optimizedSize = large.length;

      // Save to database
      const imageData = {
        shop_id: shopId,
        image_url: imageUrl,
        thumbnail_url: thumbnailUrl,
        medium_url: mediumUrl,
        large_url: largeUrl,
        alt_text: options.altText,
        is_primary: options.isPrimary || false,
        display_order: options.displayOrder || 0,
        metadata: {
          originalSize: originalMetadata.size,
          optimizedSize,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format
        }
      };

      const { data: savedImage, error: dbError } = await this.supabase
        .from('shop_images')
        .insert(imageData)
        .select()
        .single();

      if (dbError) {
        logger.error('Error saving shop image to database:', { shopId, error: dbError });
        throw new Error(`Database save failed: ${dbError.message}`);
      }

      logger.info('Shop image uploaded successfully:', { 
        shopId, 
        imageId: savedImage.id,
        originalSize: originalMetadata.size,
        optimizedSize 
      });

      return {
        success: true,
        imageUrl,
        thumbnailUrl,
        mediumUrl,
        largeUrl,
        metadata: {
          originalSize: originalMetadata.size,
          optimizedSize,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format
        }
      };

    } catch (error) {
      logger.error('ImageService.uploadShopImage error:', { shopId, error });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Get shop images
   */
  async getShopImages(shopId: string): Promise<ShopImageData[]> {
    try {
      const { data: images, error } = await this.supabase
        .from('shop_images')
        .select('*')
        .eq('shop_id', shopId)
        .order('display_order', { ascending: true });

      if (error) {
        logger.error('Error fetching shop images:', { shopId, error });
        throw new Error(`Failed to fetch shop images: ${error.message}`);
      }

      return images || [];
    } catch (error) {
      logger.error('ImageService.getShopImages error:', { shopId, error });
      throw error;
    }
  }

  /**
   * Delete shop image
   */
  async deleteShopImage(imageId: string): Promise<boolean> {
    try {
      // Get image data first
      const { data: image, error: fetchError } = await this.supabase
        .from('shop_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (fetchError || !image) {
        throw new Error('Image not found');
      }

      // Delete from storage (all formats)
      const filePaths = [
        image.image_url.split('/').pop(),
        image.thumbnail_url?.split('/').pop(),
        image.medium_url?.split('/').pop(),
        image.large_url?.split('/').pop()
      ].filter(Boolean);

      // Delete from Supabase Storage
      for (const filePath of filePaths) {
        if (filePath) {
          await this.supabase.storage
            .from('shop-images')
            .remove([filePath]);
        }
      }

      // Delete from database
      const { error: deleteError } = await this.supabase
        .from('shop_images')
        .delete()
        .eq('id', imageId);

      if (deleteError) {
        logger.error('Error deleting shop image from database:', { imageId, error: deleteError });
        throw new Error(`Database delete failed: ${deleteError.message}`);
      }

      logger.info('Shop image deleted successfully:', { imageId });
      return true;

    } catch (error) {
      logger.error('ImageService.deleteShopImage error:', { imageId, error });
      return false;
    }
  }

  /**
   * Update shop image metadata
   */
  async updateShopImage(
    imageId: string,
    updates: {
      alt_text?: string;
      is_primary?: boolean;
      display_order?: number;
    }
  ): Promise<ShopImageData | null> {
    try {
      const { data: image, error } = await this.supabase
        .from('shop_images')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId)
        .select()
        .single();

      if (error) {
        logger.error('Error updating shop image:', { imageId, error });
        throw new Error(`Update failed: ${error.message}`);
      }

      return image;
    } catch (error) {
      logger.error('ImageService.updateShopImage error:', { imageId, error });
      return null;
    }
  }
}

export const imageService = new ImageService(); 