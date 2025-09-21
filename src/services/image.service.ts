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
import { ImageSecurityService } from './image-security.service';
import { CDNService, CDNResult, ImageTransformationOptions } from './cdn.service';
import { imageTransformationService } from './image-transformation.service';

export interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  progressive?: boolean;
  stripMetadata?: boolean;
  optimize?: boolean;
  compressionLevel?: number;
  mozjpeg?: boolean;
  webpLossless?: boolean;
  webpNearLossless?: boolean;
  webpQuality?: number;
  pngCompressionLevel?: number;
  pngAdaptiveFiltering?: boolean;
  pngPalette?: boolean;
  pngQuantization?: boolean;
  pngColors?: number;
}

export interface ImageUploadResult {
  success: boolean;
  imageUrl?: string;
  thumbnailUrl?: string;
  mediumUrl?: string;
  largeUrl?: string;
  // CDN URLs
  cdnUrls?: {
    original: CDNResult;
    thumbnail: CDNResult;
    medium: CDNResult;
    large: CDNResult;
    webp?: {
      original: CDNResult;
      thumbnail: CDNResult;
      medium: CDNResult;
      large: CDNResult;
    };
    responsive?: {
      srcSet: string;
      sizes: string;
      urls: Record<string, CDNResult>;
    };
  };
  metadata?: {
    originalSize: number;
    optimizedSize: number;
    width: number;
    height: number;
    format: string;
    compressionRatio?: number;
    webpSize?: number;
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
  private cdnService = new CDNService();

  /**
   * Enhanced image optimization using Sharp with advanced features
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
      fit = 'inside',
      progressive = true,
      stripMetadata = true,
      optimize = true,
      compressionLevel = 6,
      mozjpeg = true,
      webpLossless = false,
      webpNearLossless = false,
      webpQuality = 80,
      pngCompressionLevel = 6,
      pngAdaptiveFiltering = true,
      pngPalette = true,
      pngQuantization = true,
      pngColors = 256
    } = options;

    try {
    let sharpInstance = sharp(buffer);

      // Strip metadata for security and size reduction
      if (stripMetadata) {
        sharpInstance = sharpInstance.withMetadata({
          exif: {} as any,
          icc: ''
        });
      }

      // Resize image with enhanced options
      sharpInstance = sharpInstance.resize(width, height, {
        fit,
        withoutEnlargement: true,
        kernel: sharp.kernel.lanczos3,
        fastShrinkOnLoad: true
      });

      // Apply format-specific optimization with advanced settings
    switch (format) {
      case 'jpeg':
          sharpInstance = sharpInstance.jpeg({
            quality,
            progressive,
            mozjpeg,
            // compressionLevel, // Not available in JpegOptions
            trellisQuantisation: true,
            overshootDeringing: true,
            optimizeScans: true,
            quantisationTable: 3
          });
        break;

      case 'png':
          sharpInstance = sharpInstance.png({
            quality,
            compressionLevel: pngCompressionLevel,
            adaptiveFiltering: pngAdaptiveFiltering,
            palette: pngPalette,
            colors: pngColors,
            dither: pngQuantization ? 1.0 : 0,
            progressive: false,
            force: false
          });
        break;

      case 'webp':
          sharpInstance = sharpInstance.webp({
            quality: webpQuality,
            lossless: webpLossless,
            nearLossless: webpNearLossless,
            smartSubsample: true,
            effort: 6,
            alphaQuality: 100,
            preset: 'photo'
          });
        break;
    }

    return await sharpInstance.toBuffer();

    } catch (error) {
      logger.error('Image optimization failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options,
        bufferSize: buffer.length
      });
      throw new Error('이미지 최적화 중 오류가 발생했습니다.');
    }
  }

  /**
   * Generate multiple image formats with enhanced optimization
   */
  private async generateImageFormats(buffer: Buffer): Promise<{
    thumbnail: Buffer;
    medium: Buffer;
    large: Buffer;
    thumbnailWebp: Buffer;
    mediumWebp: Buffer;
    largeWebp: Buffer;
  }> {
    // Generate optimized JPEG formats
    const [thumbnail, medium, large] = await Promise.all([
      this.optimizeImage(buffer, { 
        width: 150, 
        height: 150, 
        fit: 'cover',
        quality: 85,
        progressive: true,
        mozjpeg: true
      }),
      this.optimizeImage(buffer, { 
        width: 400, 
        height: 300, 
        fit: 'inside',
        quality: 85,
        progressive: true,
        mozjpeg: true
      }),
      this.optimizeImage(buffer, { 
        width: 800, 
        height: 600, 
        fit: 'inside',
        quality: 90,
        progressive: true,
        mozjpeg: true
      })
    ]);

    // Generate WebP formats for better compression
    const [thumbnailWebp, mediumWebp, largeWebp] = await Promise.all([
      this.optimizeImage(buffer, { 
        width: 150, 
        height: 150, 
        fit: 'cover',
        format: 'webp',
        webpQuality: 85,
        webpLossless: false
      }),
      this.optimizeImage(buffer, { 
        width: 400, 
        height: 300, 
        fit: 'inside',
        format: 'webp',
        webpQuality: 85,
        webpLossless: false
      }),
      this.optimizeImage(buffer, { 
        width: 800, 
        height: 600, 
        fit: 'inside',
        format: 'webp',
        webpQuality: 90,
        webpLossless: false
      })
    ]);

    return { 
      thumbnail, 
      medium, 
      large, 
      thumbnailWebp, 
      mediumWebp, 
      largeWebp 
    };
  }

  /**
   * Extract enhanced image metadata with EXIF data
   */
  private async extractMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    format: string;
    size: number;
    exif?: any;
    icc?: any;
    iptc?: any;
    xmp?: any;
    density?: number;
    hasAlpha?: boolean;
    channels?: number;
    space?: string;
  }> {
    const metadata = await sharp(buffer).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
      size: buffer.length,
      exif: metadata.exif,
      icc: metadata.icc,
      iptc: metadata.iptc,
      xmp: metadata.xmp,
      density: metadata.density,
      hasAlpha: metadata.hasAlpha,
      channels: metadata.channels,
      space: metadata.space
    };
  }

  /**
   * Advanced image processing with automatic format optimization
   */
  async processImageAdvanced(
    buffer: Buffer,
    fileName: string,
    options: {
      maxWidth?: number;
      maxHeight?: number;
      quality?: number;
      enableWebP?: boolean;
      enableProgressive?: boolean;
      stripMetadata?: boolean;
      optimizeForWeb?: boolean;
    } = {}
  ): Promise<{
    original: Buffer;
    optimized: Buffer;
    webp?: Buffer;
    metadata: any;
    compressionStats: {
      originalSize: number;
      optimizedSize: number;
      webpSize?: number;
      compressionRatio: number;
      webpCompressionRatio?: number;
    };
  }> {
    const {
      maxWidth = 1920,
      maxHeight = 1080,
      quality = 85,
      enableWebP = true,
      enableProgressive = true,
      stripMetadata = true,
      optimizeForWeb = true
    } = options;

    try {
      // Extract original metadata
      const originalMetadata = await this.extractMetadata(buffer);
      
      // Determine optimal format based on image characteristics
      const optimalFormat = this.determineOptimalFormat(originalMetadata, optimizeForWeb);
      
      // Calculate optimal dimensions
      const { width, height } = this.calculateOptimalDimensions(
        originalMetadata.width,
        originalMetadata.height,
        maxWidth,
        maxHeight
      );

      // Process original image
      const optimized = await this.optimizeImage(buffer, {
        width,
        height,
        quality,
        format: optimalFormat,
        progressive: enableProgressive,
        stripMetadata,
        optimize: true,
        mozjpeg: optimalFormat === 'jpeg',
        webpQuality: quality
      });

      // Generate WebP version if enabled and beneficial
      let webp: Buffer | undefined;
      if (enableWebP && optimalFormat !== 'webp') {
        webp = await this.optimizeImage(buffer, {
          width,
          height,
          format: 'webp',
          webpQuality: quality,
          webpLossless: false,
          stripMetadata
        });
      }

      // Calculate compression statistics
      const compressionStats = {
        originalSize: buffer.length,
        optimizedSize: optimized.length,
        webpSize: webp?.length,
        compressionRatio: ((buffer.length - optimized.length) / buffer.length * 100),
        webpCompressionRatio: webp ? ((buffer.length - webp.length) / buffer.length * 100) : undefined
      };

      return {
        original: buffer,
        optimized,
        webp,
        metadata: originalMetadata,
        compressionStats
      };

    } catch (error) {
      logger.error('Advanced image processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        fileName,
        options
      });
      throw new Error('고급 이미지 처리 중 오류가 발생했습니다.');
    }
  }

  /**
   * Determine optimal image format based on characteristics
   */
  private determineOptimalFormat(metadata: any, optimizeForWeb: boolean): 'jpeg' | 'png' | 'webp' {
    if (!optimizeForWeb) {
      return 'jpeg'; // Default fallback
    }

    // Use WebP for better compression if supported
    if (metadata.hasAlpha) {
      return 'png'; // PNG for images with transparency
    }

    // Use JPEG for photos and complex images
    if (metadata.format === 'jpeg' || metadata.format === 'jpg') {
      return 'jpeg';
    }

    // Use WebP for better compression
    return 'webp';
  }

  /**
   * Calculate optimal dimensions maintaining aspect ratio
   */
  private calculateOptimalDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    if (originalWidth <= maxWidth && originalHeight <= maxHeight) {
      return { width: originalWidth, height: originalHeight };
    }

    const aspectRatio = originalWidth / originalHeight;
    const maxAspectRatio = maxWidth / maxHeight;

    if (aspectRatio > maxAspectRatio) {
      // Image is wider than max aspect ratio
      return {
        width: maxWidth,
        height: Math.round(maxWidth / aspectRatio)
      };
    } else {
      // Image is taller than max aspect ratio
      return {
        width: Math.round(maxHeight * aspectRatio),
        height: maxHeight
      };
    }
  }

  /**
   * Validate image file with enhanced security checks
   */
  private async validateImageFile(buffer: Buffer, fileName: string, mimeType?: string): Promise<void> {
    const securityResult = await ImageSecurityService.validateImageSecurity(buffer, fileName, mimeType);
    
    if (!securityResult.isValid) {
      const errorMessage = securityResult.errors.join(' ');
      throw new Error(errorMessage);
    }

    // Log warnings if any
    if (securityResult.warnings.length > 0) {
      logger.warn('Image validation warnings', {
        fileName,
        warnings: securityResult.warnings,
      });
    }

    // Store detected MIME type for later use
    if (securityResult.detectedMimeType) {
      // Update the buffer with proper MIME type if needed
      logger.info('Image security validation passed', {
        fileName,
        detectedMimeType: securityResult.detectedMimeType,
        originalMimeType: mimeType,
      });
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
    mimeType: string,
    options: {
      isPrimary?: boolean;
      altText?: string;
      displayOrder?: number;
    } = {}
  ): Promise<ImageUploadResult> {
    try {
      // Validate file with enhanced security checks
      await this.validateImageFile(imageBuffer, fileName, mimeType);

      // Extract original metadata
      const originalMetadata = await this.extractMetadata(imageBuffer);

      // Generate unique filename
      const uniqueFileName = this.generateUniqueFilename(fileName, `shop-${shopId}`);
      const fileExtension = fileName.split('.').pop()?.toLowerCase() || 'jpg';

      // Generate CDN-optimized formats using transformation service
      const transformationResults = await imageTransformationService.batchTransformImage(
        imageBuffer,
        ['thumbnail', 'small', 'medium', 'large'],
        'shop-images',
        {
          cacheKey: uniqueFileName,
          optimizationLevel: 'high',
        }
      );

      // Generate responsive variants for better performance
      const responsiveVariants = await imageTransformationService.generateResponsiveVariants(
        imageBuffer,
        'shop-images',
        [320, 640, 768, 1024, 1280, 1920],
        {
          cacheKey: uniqueFileName,
          quality: 90,
          format: 'webp',
        }
      );

      // Upload original to main bucket
      const originalUrl = await this.uploadToStorage(imageBuffer, `large/${uniqueFileName}`, mimeType);

      // Generate CDN URLs for all variants
        const cdnUrls = await this.cdnService.generateAllPresetUrls(`large/${uniqueFileName}`, 'shop-images');

      // Use large format as main image URL
      const imageUrl = originalUrl;

      // Calculate optimized size (use original size for now)
      const optimizedSize = imageBuffer.length;

      // Save to database with CDN URLs
      const imageData = {
        shop_id: shopId,
        image_url: imageUrl,
        thumbnail_url: cdnUrls.thumbnail?.cdnUrl || originalUrl,
        medium_url: cdnUrls.medium?.cdnUrl || originalUrl,
        large_url: cdnUrls.large?.cdnUrl || originalUrl,
        thumbnail_webp_url: cdnUrls.thumbnail?.cdnUrl || originalUrl,
        medium_webp_url: cdnUrls.medium?.cdnUrl || originalUrl,
        large_webp_url: cdnUrls.large?.cdnUrl || originalUrl,
        alt_text: options.altText,
        is_primary: options.isPrimary || false,
        display_order: options.displayOrder || 0,
        metadata: {
          originalSize: originalMetadata.size,
          optimizedSize,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format,
          cdnUrls: cdnUrls,
          responsiveSrcSet: responsiveVariants.srcSet,
          responsiveSizes: responsiveVariants.sizes,
          transformationStatus: 'completed' as any
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
        thumbnailUrl: cdnUrls.thumbnail?.cdnUrl || originalUrl,
        mediumUrl: cdnUrls.medium?.cdnUrl || originalUrl,
        largeUrl: cdnUrls.large?.cdnUrl || originalUrl,
        cdnUrls: {
          original: cdnUrls.original || { url: originalUrl, cdnUrl: originalUrl, cacheHeaders: {} },
          thumbnail: cdnUrls.thumbnail || { url: originalUrl, cdnUrl: originalUrl, cacheHeaders: {} },
          medium: cdnUrls.medium || { url: originalUrl, cdnUrl: originalUrl, cacheHeaders: {} },
          large: cdnUrls.large || { url: originalUrl, cdnUrl: originalUrl, cacheHeaders: {} }
        },
        // responsiveVariants, // Not in ImageUploadResult type
        // transformationResults, // Not in ImageUploadResult type
        metadata: {
          originalSize: originalMetadata.size,
          optimizedSize,
          width: originalMetadata.width,
          height: originalMetadata.height,
          format: originalMetadata.format,
          // cdnOptimized: true // Not in metadata type
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
   * Generate CDN URLs for different image sizes
   */
  private generateCDNUrls(
    fileName: string,
    sizes: Record<string, { width: number; height: number; quality: number }>
  ): {
    original: CDNResult;
    thumbnail: CDNResult;
    medium: CDNResult;
    large: CDNResult;
    webp: {
      original: CDNResult;
      thumbnail: CDNResult;
      medium: CDNResult;
      large: CDNResult;
    };
    responsive: {
      srcSet: string;
      sizes: string;
      urls: Record<string, CDNResult>;
    };
  } {
    const basePath = `large/${fileName}`;
    const thumbnailPath = `thumbnails/${fileName}`;
    const mediumPath = `medium/${fileName}`;
    const largePath = `large/${fileName}`;

    // Generate original URLs
    const original = this.cdnService.generateCDNUrl(basePath);
    const thumbnail = this.cdnService.generateCDNUrl(thumbnailPath, 'shop-images', {
      transformations: {
        width: sizes.thumbnail.width,
        height: sizes.thumbnail.height,
        quality: sizes.thumbnail.quality,
        fit: 'cover',
        progressive: true,
        stripMetadata: true,
      },
    });
    const medium = this.cdnService.generateCDNUrl(mediumPath, 'shop-images', {
      transformations: {
        width: sizes.medium.width,
        height: sizes.medium.height,
        quality: sizes.medium.quality,
        fit: 'cover',
        progressive: true,
        stripMetadata: true,
      },
    });
    const large = this.cdnService.generateCDNUrl(largePath, 'shop-images', {
      transformations: {
        width: sizes.large.width,
        height: sizes.large.height,
        quality: sizes.large.quality,
        fit: 'cover',
        progressive: true,
        stripMetadata: true,
      },
    });

    // Generate WebP URLs
    const webpOriginal = this.cdnService.generateWebPUrls(basePath, 'shop-images', {
      quality: 90,
      progressive: true,
      stripMetadata: true,
    });
    const webpThumbnail = this.cdnService.generateWebPUrls(thumbnailPath, 'shop-images', {
      width: sizes.thumbnail.width,
      height: sizes.thumbnail.height,
      quality: sizes.thumbnail.quality,
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    });
    const webpMedium = this.cdnService.generateWebPUrls(mediumPath, 'shop-images', {
      width: sizes.medium.width,
      height: sizes.medium.height,
      quality: sizes.medium.quality,
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    });
    const webpLarge = this.cdnService.generateWebPUrls(largePath, 'shop-images', {
      width: sizes.large.width,
      height: sizes.large.height,
      quality: sizes.large.quality,
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    });

    // Generate responsive URLs
    const responsive = this.cdnService.generateResponsiveUrls(basePath, 'shop-images', [320, 640, 768, 1024, 1280, 1920]);

    return {
      original,
      thumbnail,
      medium,
      large,
      webp: {
        original: webpOriginal.webp,
        thumbnail: webpThumbnail.webp,
        medium: webpMedium.webp,
        large: webpLarge.webp,
      },
      responsive,
    };
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
   * Get CDN URLs for an existing image
   */
  async getImageCDNUrls(
    imageId: string,
    transformations?: ImageTransformationOptions
  ): Promise<CDNResult | null> {
    try {
      const { data: image, error } = await this.supabase
        .from('shop_images')
        .select('image_url, thumbnail_url, medium_url, large_url')
        .eq('id', imageId)
        .single();

      if (error || !image) {
        logger.error('Error fetching image for CDN URLs:', { imageId, error });
        return null;
      }

      // Extract file path from the image URL
      const filePath = this.extractFilePathFromUrl(image.image_url);
      if (!filePath) {
        logger.error('Could not extract file path from image URL:', { imageUrl: image.image_url });
        return null;
      }

      return this.cdnService.generateCDNUrl(filePath, 'shop-images', {
        transformations,
      });
    } catch (error) {
      logger.error('ImageService.getImageCDNUrls error:', { imageId, error });
      return null;
    }
  }

  /**
   * Get optimized CDN URLs for all sizes of an image
   */
  async getImageOptimizedCDNUrls(imageId: string): Promise<{
    original: CDNResult;
    thumbnail: CDNResult;
    medium: CDNResult;
    large: CDNResult;
    webp: {
      original: CDNResult;
      thumbnail: CDNResult;
      medium: CDNResult;
      large: CDNResult;
    };
    responsive: {
      srcSet: string;
      sizes: string;
      urls: Record<string, CDNResult>;
    };
  } | null> {
    try {
      const { data: image, error } = await this.supabase
        .from('shop_images')
        .select('image_url, thumbnail_url, medium_url, large_url')
        .eq('id', imageId)
        .single();

      if (error || !image) {
        logger.error('Error fetching image for optimized CDN URLs:', { imageId, error });
        return null;
      }

      // Extract file path from the large URL (main image)
      const filePath = this.extractFilePathFromUrl(image.large_url || image.image_url);
      if (!filePath) {
        logger.error('Could not extract file path from image URL:', { imageUrl: image.image_url });
        return null;
      }

      // Generate CDN URLs for different sizes
      return this.generateCDNUrls(filePath, {
        thumbnail: { width: 300, height: 300, quality: 85 },
        medium: { width: 800, height: 600, quality: 85 },
        large: { width: 1200, height: 900, quality: 90 },
      });
    } catch (error) {
      logger.error('ImageService.getImageOptimizedCDNUrls error:', { imageId, error });
      return null;
    }
  }

  /**
   * Extract file path from Supabase Storage URL
   */
  private extractFilePathFromUrl(url: string): string | null {
    try {
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const bucketIndex = pathParts.findIndex(part => part === 'shop-images');
      
      if (bucketIndex === -1 || bucketIndex === pathParts.length - 1) {
        return null;
      }

      // Return the path after the bucket name
      return pathParts.slice(bucketIndex + 1).join('/');
    } catch (error) {
      logger.error('Error extracting file path from URL:', { url, error });
      return null;
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