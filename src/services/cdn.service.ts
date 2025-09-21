/**
 * CDN Service
 * 
 * Handles CDN integration with Supabase Storage for optimized image delivery
 * including URL transformation, cache optimization, and on-demand resizing
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface CDNConfig {
  enabled: boolean;
  baseUrl: string;
  fallbackUrl: string;
  cacheHeaders: {
    maxAge: number;
    sMaxAge: number;
    staleWhileRevalidate: number;
  };
  imageTransformation: {
    enabled: boolean;
    quality: number;
    format: 'auto' | 'webp' | 'jpeg' | 'png';
    progressive: boolean;
  };
  onDemandResizing: {
    enabled: boolean;
    maxWidth: number;
    maxHeight: number;
    quality: number;
  };
}

export interface ImageTransformationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png' | 'auto';
  fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
  position?: 'top' | 'right top' | 'right' | 'right bottom' | 'bottom' | 'left bottom' | 'left' | 'left top' | 'center';
  background?: string;
  blur?: number;
  sharpen?: number;
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hue?: number;
  gamma?: number;
  progressive?: boolean;
  stripMetadata?: boolean;
}

export interface CDNUrlOptions {
  transformations?: ImageTransformationOptions;
  cacheBust?: boolean;
  expires?: number;
  signature?: string;
}

export interface CDNResult {
  url: string;
  cdnUrl: string;
  transformations?: ImageTransformationOptions;
  cacheHeaders: Record<string, string>;
  expiresAt?: Date;
}

export class CDNService {
  private supabase = getSupabaseClient();
  private cdnConfig: CDNConfig;
  private transformationCache: Map<string, any> = new Map();
  private cacheExpiry: Map<string, number> = new Map();

  constructor() {
    this.cdnConfig = this.loadCDNConfig();
  }

  /**
   * Get CDN-optimized bucket name
   */
  private getCDNBucketName(bucket: string): string {
    const cdnBuckets = ['shop-images', 'profile-images', 'service-images'];
    if (cdnBuckets.includes(bucket)) {
      return `${bucket}-cdn`;
    }
    return bucket;
  }

  /**
   * Load CDN configuration from environment variables
   */
  private loadCDNConfig(): CDNConfig {
    return {
      enabled: process.env.CDN_ENABLED === 'true',
      baseUrl: process.env.CDN_BASE_URL || process.env.SUPABASE_URL?.replace('supabase.co', 'supabase-cdn.com') || '',
      fallbackUrl: process.env.SUPABASE_URL || '',
      cacheHeaders: {
        maxAge: parseInt(process.env.CDN_CACHE_MAX_AGE || '31536000'), // 1 year
        sMaxAge: parseInt(process.env.CDN_CACHE_S_MAX_AGE || '86400'), // 1 day
        staleWhileRevalidate: parseInt(process.env.CDN_STALE_WHILE_REVALIDATE || '604800'), // 1 week
      },
      imageTransformation: {
        enabled: process.env.CDN_IMAGE_TRANSFORMATION === 'true',
        quality: parseInt(process.env.CDN_IMAGE_QUALITY || '85'),
        format: (process.env.CDN_IMAGE_FORMAT as any) || 'auto',
        progressive: process.env.CDN_IMAGE_PROGRESSIVE === 'true',
      },
      onDemandResizing: {
        enabled: process.env.CDN_ON_DEMAND_RESIZING === 'true',
        maxWidth: parseInt(process.env.CDN_MAX_WIDTH || '2048'),
        maxHeight: parseInt(process.env.CDN_MAX_HEIGHT || '2048'),
        quality: parseInt(process.env.CDN_RESIZE_QUALITY || '80'),
      },
    };
  }

  /**
   * Generate CDN URL with transformations
   */
  generateCDNUrl(
    filePath: string,
    bucket: string = 'shop-images',
    options: CDNUrlOptions = {}
  ): CDNResult {
    if (!this.cdnConfig.enabled) {
      return this.generateFallbackUrl(filePath, bucket);
    }

    // Use CDN-optimized bucket if available
    const cdnBucket = this.getCDNBucketName(bucket);
    const baseUrl = this.cdnConfig.baseUrl;
    const bucketUrl = `${baseUrl}/storage/v1/object/public/${cdnBucket}`;
    
    let cdnUrl = `${bucketUrl}/${filePath}`;
    
    // Add transformations if provided
    if (options.transformations && this.cdnConfig.imageTransformation.enabled) {
      cdnUrl = this.addTransformations(cdnUrl, options.transformations);
    }

    // Add cache busting if requested
    if (options.cacheBust) {
      const timestamp = Date.now();
      cdnUrl += `?cb=${timestamp}`;
    }

    // Add expiration if provided
    if (options.expires) {
      const separator = cdnUrl.includes('?') ? '&' : '?';
      cdnUrl += `${separator}expires=${options.expires}`;
    }

    // Add signature if provided
    if (options.signature) {
      const separator = cdnUrl.includes('?') ? '&' : '?';
      cdnUrl += `${separator}signature=${options.signature}`;
    }

    const cacheHeaders = this.generateCacheHeaders(options.expires);

    return {
      url: `${bucketUrl}/${filePath}`,
      cdnUrl,
      transformations: options.transformations,
      cacheHeaders,
      expiresAt: options.expires ? new Date(options.expires * 1000) : undefined,
    };
  }

  /**
   * Generate optimized image URLs for different sizes
   */
  generateOptimizedUrls(
    filePath: string,
    bucket: string = 'shop-images',
    sizes: Array<{ name: string; width: number; height?: number; quality?: number }> = []
  ): Record<string, CDNResult> {
    const results: Record<string, CDNResult> = {};

    // Original image
    results.original = this.generateCDNUrl(filePath, bucket);

    // Generate size variants
    for (const size of sizes) {
      const transformations: ImageTransformationOptions = {
        width: size.width,
        height: size.height,
        quality: size.quality || this.cdnConfig.imageTransformation.quality,
        format: this.cdnConfig.imageTransformation.format,
        fit: 'cover',
        progressive: this.cdnConfig.imageTransformation.progressive,
        stripMetadata: true,
      };

      results[size.name] = this.generateCDNUrl(filePath, bucket, {
        transformations,
      });
    }

    return results;
  }

  /**
   * Generate CDN URL using database presets
   */
  async generatePresetUrl(
    filePath: string,
    bucket: string = 'shop-images',
    preset: string = 'original',
    options: CDNUrlOptions = {}
  ): Promise<CDNResult> {
    try {
      // Get preset configuration from database
      const presetConfig = await this.getTransformationPreset(bucket, preset);
      
      if (presetConfig) {
        const transformations: ImageTransformationOptions = {
          width: presetConfig.width,
          height: presetConfig.height,
          quality: presetConfig.quality,
          format: presetConfig.format,
          fit: presetConfig.fit,
          progressive: presetConfig.progressive,
          stripMetadata: presetConfig.stripMetadata,
        };

        return this.generateCDNUrl(filePath, bucket, {
          ...options,
          transformations,
        });
      }

      // Fallback to default transformations
      return this.generateCDNUrl(filePath, bucket, options);
    } catch (error) {
      logger.error('Error generating preset URL', { error, filePath, bucket, preset });
      return this.generateFallbackUrl(filePath, bucket);
    }
  }

  /**
   * Get transformation preset from database
   */
  private async getTransformationPreset(bucket: string, preset: string): Promise<any> {
    const cacheKey = `${bucket}-${preset}`;
    const now = Date.now();
    
    // Check cache first
    if (this.transformationCache.has(cacheKey) && this.cacheExpiry.get(cacheKey)! > now) {
      return this.transformationCache.get(cacheKey);
    }

    try {
      const cdnBucket = this.getCDNBucketName(bucket);
      const { data, error } = await this.supabase
        .from('cdn_configurations')
        .select('config')
        .eq('bucket_id', cdnBucket)
        .eq('transformation_preset', preset)
        .eq('is_active', true)
        .single();

      if (error || !data) {
        return null;
      }

      // Cache the result for 1 hour
      this.transformationCache.set(cacheKey, data.config);
      this.cacheExpiry.set(cacheKey, now + 3600000);

      return data.config;
    } catch (error) {
      logger.error('Error fetching transformation preset', { error, bucket, preset });
      return null;
    }
  }

  /**
   * Generate optimized URLs for all presets
   */
  async generateAllPresetUrls(
    filePath: string,
    bucket: string = 'shop-images',
    options: CDNUrlOptions = {}
  ): Promise<Record<string, CDNResult>> {
    try {
      const cdnBucket = this.getCDNBucketName(bucket);
      const { data, error } = await this.supabase
        .from('cdn_configurations')
        .select('transformation_preset, config')
        .eq('bucket_id', cdnBucket)
        .eq('is_active', true);

      if (error || !data) {
        return { original: this.generateCDNUrl(filePath, bucket, options) };
      }

      const results: Record<string, CDNResult> = {};

      for (const preset of data) {
        const transformations: ImageTransformationOptions = {
          width: preset.config.width,
          height: preset.config.height,
          quality: preset.config.quality,
          format: preset.config.format,
          fit: preset.config.fit,
          progressive: preset.config.progressive,
          stripMetadata: preset.config.stripMetadata,
        };

        results[preset.transformation_preset] = this.generateCDNUrl(filePath, bucket, {
          ...options,
          transformations,
        });
      }

      return results;
    } catch (error) {
      logger.error('Error generating all preset URLs', { error, filePath, bucket });
      return { original: this.generateCDNUrl(filePath, bucket, options) };
    }
  }

  /**
   * Generate responsive image URLs for different screen sizes
   */
  generateResponsiveUrls(
    filePath: string,
    bucket: string = 'shop-images',
    breakpoints: number[] = [320, 640, 768, 1024, 1280, 1920]
  ): {
    srcSet: string;
    sizes: string;
    urls: Record<string, CDNResult>;
  } {
    const urls: Record<string, CDNResult> = {};
    const srcSetEntries: string[] = [];
    const sizesEntries: string[] = [];

    for (const width of breakpoints) {
      const transformations: ImageTransformationOptions = {
        width,
        quality: this.cdnConfig.imageTransformation.quality,
        format: this.cdnConfig.imageTransformation.format,
        fit: 'cover',
        progressive: this.cdnConfig.imageTransformation.progressive,
        stripMetadata: true,
      };

      const result = this.generateCDNUrl(filePath, bucket, {
        transformations,
      });

      urls[`w${width}`] = result;
      srcSetEntries.push(`${result.cdnUrl} ${width}w`);
      
      // Generate sizes attribute
      if (width <= 640) {
        sizesEntries.push(`(max-width: 640px) ${width}px`);
      } else if (width <= 768) {
        sizesEntries.push(`(max-width: 768px) ${width}px`);
      } else if (width <= 1024) {
        sizesEntries.push(`(max-width: 1024px) ${width}px`);
      } else if (width <= 1280) {
        sizesEntries.push(`(max-width: 1280px) ${width}px`);
      } else {
        sizesEntries.push(`${width}px`);
      }
    }

    return {
      srcSet: srcSetEntries.join(', '),
      sizes: sizesEntries.join(', '),
      urls,
    };
  }

  /**
   * Generate WebP URLs with fallback
   */
  generateWebPUrls(
    filePath: string,
    bucket: string = 'shop-images',
    transformations: ImageTransformationOptions = {}
  ): {
    webp: CDNResult;
    fallback: CDNResult;
  } {
    const webpTransformations: ImageTransformationOptions = {
      ...transformations,
      format: 'webp',
      quality: transformations.quality || this.cdnConfig.imageTransformation.quality,
    };

    const fallbackTransformations: ImageTransformationOptions = {
      ...transformations,
      format: 'jpeg',
      quality: transformations.quality || this.cdnConfig.imageTransformation.quality,
    };

    return {
      webp: this.generateCDNUrl(filePath, bucket, {
        transformations: webpTransformations,
      }),
      fallback: this.generateCDNUrl(filePath, bucket, {
        transformations: fallbackTransformations,
      }),
    };
  }

  /**
   * Clean expired cache entries
   */
  async cleanExpiredCache(): Promise<{ deletedCount: number; errors: string[] }> {
    try {
      const { data, error } = await this.supabase.rpc('clean_expired_cdn_cache');
      
      if (error) {
        logger.error('Error cleaning expired cache', { error });
        return { deletedCount: 0, errors: [error.message] };
      }

      logger.info('CDN cache cleanup completed', { deletedCount: data });
      return { deletedCount: data, errors: [] };
    } catch (error) {
      logger.error('Error cleaning expired cache', { error });
      return { deletedCount: 0, errors: [error.message] };
    }
  }

  /**
   * Get CDN cache statistics
   */
  async getCacheStats(): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('cdn_cache_stats')
        .select('*');

      if (error) {
        logger.error('Error fetching cache stats', { error });
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error fetching cache stats', { error });
      return null;
    }
  }

  /**
   * Optimize image for CDN delivery
   */
  async optimizeImageForCDN(
    filePath: string,
    bucket: string,
    optimizationLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{ optimized: boolean; message: string }> {
    try {
      const cdnBucket = this.getCDNBucketName(bucket);
      
      // Mark file as CDN processed
      const { error } = await this.supabase
        .from('storage.objects')
        .update({
          cdn_processed: true,
          cdn_transformations: {
            optimization_level: optimizationLevel,
            processed_at: new Date().toISOString(),
          },
        })
        .eq('bucket_id', cdnBucket)
        .eq('name', filePath);

      if (error) {
        logger.error('Error marking file as CDN processed', { error, filePath, bucket });
        return { optimized: false, message: error.message };
      }

      logger.info('Image marked for CDN optimization', { filePath, bucket, optimizationLevel });
      return { optimized: true, message: 'Image optimized for CDN delivery' };
    } catch (error) {
      logger.error('Error optimizing image for CDN', { error, filePath, bucket });
      return { optimized: false, message: error.message };
    }
  }

  /**
   * Batch optimize multiple images
   */
  async batchOptimizeImages(
    filePaths: string[],
    bucket: string,
    optimizationLevel: 'low' | 'medium' | 'high' = 'medium'
  ): Promise<{ optimized: number; failed: number; errors: string[] }> {
    let optimized = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const filePath of filePaths) {
      try {
        const result = await this.optimizeImageForCDN(filePath, bucket, optimizationLevel);
        if (result.optimized) {
          optimized++;
        } else {
          failed++;
          errors.push(`${filePath}: ${result.message}`);
        }
      } catch (error) {
        failed++;
        errors.push(`${filePath}: ${error.message}`);
      }
    }

    logger.info('Batch CDN optimization completed', { 
      total: filePaths.length, 
      optimized, 
      failed 
    });

    return { optimized, failed, errors };
  }

  /**
   * Add image transformations to URL
   */
  private addTransformations(url: string, transformations: ImageTransformationOptions): string {
    const params: string[] = [];

    if (transformations.width) {
      params.push(`w=${transformations.width}`);
    }
    if (transformations.height) {
      params.push(`h=${transformations.height}`);
    }
    if (transformations.quality) {
      params.push(`q=${transformations.quality}`);
    }
    if (transformations.format && transformations.format !== 'auto') {
      params.push(`f=${transformations.format}`);
    }
    if (transformations.fit) {
      params.push(`fit=${transformations.fit}`);
    }
    if (transformations.position) {
      params.push(`pos=${encodeURIComponent(transformations.position)}`);
    }
    if (transformations.background) {
      params.push(`bg=${encodeURIComponent(transformations.background)}`);
    }
    if (transformations.blur) {
      params.push(`blur=${transformations.blur}`);
    }
    if (transformations.sharpen) {
      params.push(`sharpen=${transformations.sharpen}`);
    }
    if (transformations.brightness) {
      params.push(`brightness=${transformations.brightness}`);
    }
    if (transformations.contrast) {
      params.push(`contrast=${transformations.contrast}`);
    }
    if (transformations.saturation) {
      params.push(`saturation=${transformations.saturation}`);
    }
    if (transformations.hue) {
      params.push(`hue=${transformations.hue}`);
    }
    if (transformations.gamma) {
      params.push(`gamma=${transformations.gamma}`);
    }
    if (transformations.progressive) {
      params.push('progressive=true');
    }
    if (transformations.stripMetadata) {
      params.push('strip=true');
    }

    if (params.length > 0) {
      const separator = url.includes('?') ? '&' : '?';
      return `${url}${separator}${params.join('&')}`;
    }

    return url;
  }

  /**
   * Generate cache headers
   */
  private generateCacheHeaders(expires?: number): Record<string, string> {
    const headers: Record<string, string> = {
      'Cache-Control': `public, max-age=${this.cdnConfig.cacheHeaders.maxAge}, s-maxage=${this.cdnConfig.cacheHeaders.sMaxAge}, stale-while-revalidate=${this.cdnConfig.cacheHeaders.staleWhileRevalidate}`,
      'Vary': 'Accept, Accept-Encoding',
    };

    if (expires) {
      headers['Expires'] = new Date(expires * 1000).toUTCString();
    }

    return headers;
  }

  /**
   * Generate fallback URL when CDN is disabled
   */
  private generateFallbackUrl(filePath: string, bucket: string): CDNResult {
    const { data: urlData } = this.supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    return {
      url: urlData.publicUrl,
      cdnUrl: urlData.publicUrl,
      cacheHeaders: this.generateCacheHeaders(),
    };
  }

  /**
   * Validate CDN configuration
   */
  validateConfiguration(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (this.cdnConfig.enabled) {
      if (!this.cdnConfig.baseUrl) {
        errors.push('CDN_BASE_URL is required when CDN is enabled');
      }

      if (this.cdnConfig.cacheHeaders.maxAge <= 0) {
        errors.push('CDN_CACHE_MAX_AGE must be greater than 0');
      }

      if (this.cdnConfig.imageTransformation.quality < 1 || this.cdnConfig.imageTransformation.quality > 100) {
        errors.push('CDN_IMAGE_QUALITY must be between 1 and 100');
      }

      if (this.cdnConfig.onDemandResizing.maxWidth <= 0) {
        errors.push('CDN_MAX_WIDTH must be greater than 0');
      }

      if (this.cdnConfig.onDemandResizing.maxHeight <= 0) {
        errors.push('CDN_MAX_HEIGHT must be greater than 0');
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Get CDN configuration
   */
  getConfiguration(): CDNConfig {
    return { ...this.cdnConfig };
  }

  /**
   * Update CDN configuration
   */
  updateConfiguration(newConfig: Partial<CDNConfig>): void {
    this.cdnConfig = { ...this.cdnConfig, ...newConfig };
    logger.info('CDN configuration updated', { config: this.cdnConfig });
  }

  /**
   * Test CDN connectivity
   */
  async testCDNConnectivity(): Promise<{ success: boolean; latency?: number; error?: string }> {
    if (!this.cdnConfig.enabled) {
      return { success: true };
    }

    try {
      const startTime = Date.now();
      const testUrl = `${this.cdnConfig.baseUrl}/health`;
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(testUrl, {
        method: 'HEAD',
        signal: controller.signal,
      });
      
      clearTimeout(timeoutId);

      const latency = Date.now() - startTime;

      if (response.ok) {
        return { success: true, latency };
      } else {
        return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}
