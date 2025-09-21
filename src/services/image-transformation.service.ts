/**
 * Image Transformation Service
 * 
 * Handles advanced image transformations and caching strategies for CDN integration
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import sharp from 'sharp';

export interface TransformationPreset {
  name: string;
  width: number;
  height: number;
  quality: number;
  format: 'jpeg' | 'png' | 'webp' | 'avif';
  fit: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  progressive?: boolean;
  stripMetadata?: boolean;
  blur?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  gamma?: number;
}

export interface TransformationResult {
  success: boolean;
  filePath?: string;
  cdnUrls?: Record<string, string>;
  metadata?: {
    width: number;
    height: number;
    size: number;
    format: string;
    quality: number;
  };
  error?: string;
}

export interface CacheStrategy {
  enabled: boolean;
  ttl: number; // Time to live in seconds
  maxSize: number; // Max cache size in MB
  compressionLevel: number; // 1-9
  preloadPresets: string[]; // Presets to preload
}

export class ImageTransformationService {
  private supabase = getSupabaseClient();
  private cache: Map<string, Buffer> = new Map();
  private cacheTimestamps: Map<string, number> = new Map();

  // Default transformation presets
  private readonly DEFAULT_PRESETS: Record<string, TransformationPreset> = {
    thumbnail: {
      name: 'thumbnail',
      width: 200,
      height: 200,
      quality: 85,
      format: 'webp',
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    },
    small: {
      name: 'small',
      width: 400,
      height: 300,
      quality: 85,
      format: 'webp',
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    },
    medium: {
      name: 'medium',
      width: 800,
      height: 600,
      quality: 90,
      format: 'webp',
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    },
    large: {
      name: 'large',
      width: 1200,
      height: 900,
      quality: 95,
      format: 'webp',
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    },
    avatar: {
      name: 'avatar',
      width: 150,
      height: 150,
      quality: 90,
      format: 'webp',
      fit: 'cover',
      progressive: true,
      stripMetadata: true,
    },
  };

  /**
   * Transform image with specified preset
   */
  async transformImage(
    imageBuffer: Buffer,
    preset: string,
    bucket: string = 'shop-images',
    options: {
      cacheKey?: string;
      forceRegenerate?: boolean;
      optimizationLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<TransformationResult> {
    try {
      // Get preset configuration
      const presetConfig = await this.getPresetConfig(bucket, preset);
      if (!presetConfig) {
        return {
          success: false,
          error: `Preset '${preset}' not found for bucket '${bucket}'`,
        };
      }

      // Check cache first
      const cacheKey = options.cacheKey || this.generateCacheKey(imageBuffer, presetConfig);
      if (!options.forceRegenerate && this.cache.has(cacheKey)) {
        const cachedBuffer = this.cache.get(cacheKey)!;
        const filePath = await this.uploadTransformedImage(cachedBuffer, cacheKey, bucket, presetConfig);
        
        return {
          success: true,
          filePath,
          metadata: await this.extractMetadata(cachedBuffer),
        };
      }

      // Transform image using Sharp
      const transformedBuffer = await this.performTransformation(imageBuffer, presetConfig);
      
      // Cache the result
      this.cache.set(cacheKey, transformedBuffer);
      this.cacheTimestamps.set(cacheKey, Date.now());

      // Upload to storage
      const filePath = await this.uploadTransformedImage(transformedBuffer, cacheKey, bucket, presetConfig);
      
      // Mark as CDN processed
      await this.markAsCDNProcessed(filePath, bucket, presetConfig);

      const metadata = await this.extractMetadata(transformedBuffer);

      logger.info('Image transformation completed', {
        preset,
        bucket,
        originalSize: imageBuffer.length,
        transformedSize: transformedBuffer.length,
        compressionRatio: ((imageBuffer.length - transformedBuffer.length) / imageBuffer.length * 100).toFixed(2) + '%',
      });

      return {
        success: true,
        filePath,
        metadata,
      };
    } catch (error) {
      logger.error('Image transformation failed', { error, preset, bucket });
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Batch transform image with multiple presets
   */
  async batchTransformImage(
    imageBuffer: Buffer,
    presets: string[],
    bucket: string = 'shop-images',
    options: {
      cacheKey?: string;
      forceRegenerate?: boolean;
      optimizationLevel?: 'low' | 'medium' | 'high';
    } = {}
  ): Promise<Record<string, TransformationResult>> {
    const results: Record<string, TransformationResult> = {};

    // Transform in parallel for better performance
    const transformPromises = presets.map(async (preset) => {
      const result = await this.transformImage(imageBuffer, preset, bucket, {
        ...options,
        cacheKey: options.cacheKey ? `${options.cacheKey}-${preset}` : undefined,
      });
      return { preset, result };
    });

    const transformResults = await Promise.all(transformPromises);
    
    for (const { preset, result } of transformResults) {
      results[preset] = result;
    }

    logger.info('Batch image transformation completed', {
      presets,
      bucket,
      successful: Object.values(results).filter(r => r.success).length,
      failed: Object.values(results).filter(r => !r.success).length,
    });

    return results;
  }

  /**
   * Generate responsive image variants
   */
  async generateResponsiveVariants(
    imageBuffer: Buffer,
    bucket: string = 'shop-images',
    breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920],
    options: {
      cacheKey?: string;
      forceRegenerate?: boolean;
      quality?: number;
      format?: 'jpeg' | 'png' | 'webp' | 'avif';
    } = {}
  ): Promise<{
    srcSet: string;
    sizes: string;
    variants: Record<string, TransformationResult>;
  }> {
    const variants: Record<string, TransformationResult> = {};
    const srcSetEntries: string[] = [];
    
    // Generate variants for each breakpoint
    for (const width of breakpoints) {
      const preset = {
        name: `responsive-${width}`,
        width,
        height: Math.round(width * 0.75), // 4:3 aspect ratio
        quality: options.quality || 85,
        format: options.format || 'webp',
        fit: 'cover' as const,
        progressive: true,
        stripMetadata: true,
      };

      const result = await this.transformImage(imageBuffer, preset.name, bucket, {
        ...options,
        cacheKey: options.cacheKey ? `${options.cacheKey}-${width}` : undefined,
      });

      variants[`${width}w`] = result;

      if (result.success && result.filePath) {
        srcSetEntries.push(`${result.filePath} ${width}w`);
      }
    }

    // Generate srcset and sizes
    const srcSet = srcSetEntries.join(', ');
    const sizes = '(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw';

    return {
      srcSet,
      sizes,
      variants,
    };
  }

  /**
   * Get preset configuration from database or defaults
   */
  private async getPresetConfig(bucket: string, preset: string): Promise<TransformationPreset | null> {
    try {
      // Try to get from database first
      const cdnBucket = `${bucket}-cdn`;
      const { data, error } = await this.supabase
        .from('cdn_configurations')
        .select('config')
        .eq('bucket_id', cdnBucket)
        .eq('transformation_preset', preset)
        .eq('is_active', true)
        .single();

      if (data && !error) {
        return {
          name: preset,
          width: data.config.width,
          height: data.config.height,
          quality: data.config.quality,
          format: data.config.format,
          fit: data.config.fit,
          progressive: data.config.progressive,
          stripMetadata: data.config.stripMetadata,
          blur: data.config.blur,
          sharpen: data.config.sharpen,
          brightness: data.config.brightness,
          contrast: data.config.contrast,
          saturation: data.config.saturation,
          hue: data.config.hue,
          gamma: data.config.gamma,
        };
      }

      // Fallback to default presets
      return this.DEFAULT_PRESETS[preset] || null;
    } catch (error) {
      logger.error('Error fetching preset config', { error, bucket, preset });
      return this.DEFAULT_PRESETS[preset] || null;
    }
  }

  /**
   * Perform image transformation using Sharp
   */
  private async performTransformation(
    imageBuffer: Buffer,
    preset: TransformationPreset
  ): Promise<Buffer> {
    let sharpInstance = sharp(imageBuffer);

    // Apply transformations
    if (preset.width || preset.height) {
      sharpInstance = sharpInstance.resize(preset.width, preset.height, {
        fit: preset.fit,
        withoutEnlargement: true,
      });
    }

    // Apply effects
    if (preset.blur && preset.blur > 0) {
      sharpInstance = sharpInstance.blur(preset.blur);
    }

    if (preset.sharpen && preset.sharpen > 0) {
      sharpInstance = sharpInstance.sharpen(preset.sharpen);
    }

    if (preset.brightness !== undefined) {
      sharpInstance = sharpInstance.modulate({
        brightness: preset.brightness,
        saturation: preset.saturation || 1,
        hue: preset.hue || 0,
      });
    }

    if (preset.gamma !== undefined) {
      sharpInstance = sharpInstance.gamma(preset.gamma);
    }

    // Apply format-specific settings
    switch (preset.format) {
      case 'jpeg':
        sharpInstance = sharpInstance.jpeg({
          quality: preset.quality,
          progressive: preset.progressive,
          mozjpeg: true,
        });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({
          quality: preset.quality,
          progressive: preset.progressive,
          compressionLevel: 9,
        });
        break;
      case 'webp':
        sharpInstance = sharpInstance.webp({
          quality: preset.quality,
          lossless: false,
          effort: 6,
        });
        break;
      case 'avif':
        sharpInstance = sharpInstance.avif({
          quality: preset.quality,
          lossless: false,
          effort: 4,
        });
        break;
    }

    // Strip metadata if requested
    if (preset.stripMetadata) {
      sharpInstance = sharpInstance.withMetadata({});
    }

    return await sharpInstance.toBuffer();
  }

  /**
   * Upload transformed image to storage
   */
  private async uploadTransformedImage(
    buffer: Buffer,
    cacheKey: string,
    bucket: string,
    preset: TransformationPreset
  ): Promise<string> {
    const cdnBucket = `${bucket}-cdn`;
    const filePath = `transformed/${preset.name}/${cacheKey}`;

    const { data, error } = await this.supabase.storage
      .from(cdnBucket)
      .upload(filePath, buffer, {
        contentType: `image/${preset.format}`,
        upsert: true,
        metadata: {
          preset: preset.name,
          transformed_at: new Date().toISOString(),
          cache_key: cacheKey,
        },
      });

    if (error) {
      throw new Error(`Failed to upload transformed image: ${error.message}`);
    }

    return filePath;
  }

  /**
   * Mark image as CDN processed
   */
  private async markAsCDNProcessed(
    filePath: string,
    bucket: string,
    preset: TransformationPreset
  ): Promise<void> {
    const cdnBucket = `${bucket}-cdn`;
    
    const { error } = await this.supabase
      .from('storage.objects')
      .update({
        cdn_processed: true,
        cdn_transformations: {
          preset: preset.name,
          width: preset.width,
          height: preset.height,
          quality: preset.quality,
          format: preset.format,
          processed_at: new Date().toISOString(),
        },
        cache_expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      })
      .eq('bucket_id', cdnBucket)
      .eq('name', filePath);

    if (error) {
      logger.warn('Failed to mark image as CDN processed', { error, filePath, bucket });
    }
  }

  /**
   * Extract metadata from image buffer
   */
  private async extractMetadata(buffer: Buffer): Promise<{
    width: number;
    height: number;
    size: number;
    format: string;
    quality: number;
  }> {
    const metadata = await sharp(buffer).metadata();
    
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      size: buffer.length,
      format: metadata.format || 'unknown',
      quality: 85 // Default quality value
    };
  }

  /**
   * Generate cache key for image and preset combination
   */
  private generateCacheKey(imageBuffer: Buffer, preset: TransformationPreset): string {
    const crypto = require('crypto');
    const imageHash = crypto.createHash('md5').update(imageBuffer).digest('hex').substring(0, 8);
    const presetHash = crypto.createHash('md5').update(JSON.stringify(preset)).digest('hex').substring(0, 8);
    return `${imageHash}-${presetHash}`;
  }

  /**
   * Clean expired cache entries
   */
  async cleanCache(maxAge: number = 3600000): Promise<number> { // 1 hour default
    const now = Date.now();
    let cleaned = 0;

    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > maxAge) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      logger.info('Cache cleanup completed', { cleaned, remaining: this.cache.size });
    }

    return cleaned;
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    memoryUsage: number;
  } {
    const totalSize = Array.from(this.cache.values()).reduce((sum, buffer) => sum + buffer.length, 0);
    
    return {
      size: this.cache.size,
      maxSize: 1000, // Configurable
      hitRate: 0, // Would need to track hits/misses
      memoryUsage: totalSize,
    };
  }
}

export const imageTransformationService = new ImageTransformationService();
