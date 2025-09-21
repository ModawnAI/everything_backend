/**
 * Advanced Image Metadata Management Service
 * 
 * Provides comprehensive metadata management for shop images including:
 * - Intelligent alt text generation
 * - Image categorization and tagging
 * - Display ordering and reordering
 * - Batch metadata operations
 * - Metadata validation and sanitization
 * - Image statistics and analytics
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface ImageMetadata {
  id: string;
  shop_id: string;
  image_url: string;
  thumbnail_url?: string;
  medium_url?: string;
  large_url?: string;
  thumbnail_webp_url?: string;
  medium_webp_url?: string;
  large_webp_url?: string;
  alt_text?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  is_primary: boolean;
  display_order: number;
  file_size?: number;
  width?: number;
  height?: number;
  format?: string;
  compression_ratio?: number;
  metadata?: any;
  is_optimized: boolean;
  optimization_date?: string;
  last_accessed?: string;
  access_count: number;
  is_archived: boolean;
  archived_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ImageMetadataUpdate {
  alt_text?: string;
  title?: string;
  description?: string;
  tags?: string[];
  category?: string;
  is_primary?: boolean;
  display_order?: number;
  is_archived?: boolean;
}

export interface ImageReorderRequest {
  imageId: string;
  displayOrder: number;
}

export interface ImageStats {
  total_images: number;
  total_size: number;
  avg_size: number;
  optimized_count: number;
  archived_count: number;
  category_stats: Record<string, number>;
}

export interface AltTextSuggestion {
  suggestion: string;
  confidence: number;
  reasoning: string;
}

export class ImageMetadataService {
  private supabase = getSupabaseClient();

  /**
   * Get image metadata by ID
   */
  async getImageMetadata(imageId: string): Promise<ImageMetadata | null> {
    try {
      const { data, error } = await this.supabase
        .from('shop_images')
        .select('*')
        .eq('id', imageId)
        .single();

      if (error) {
        logger.error('Failed to get image metadata', { imageId, error });
        return null;
      }

      return data as ImageMetadata;
    } catch (error) {
      logger.error('Error getting image metadata', { imageId, error });
      return null;
    }
  }

  /**
   * Get all images for a shop with metadata
   */
  async getShopImages(shopId: string, options: {
    includeArchived?: boolean;
    category?: string;
    tags?: string[];
    limit?: number;
    offset?: number;
    sortBy?: 'display_order' | 'created_at' | 'updated_at' | 'access_count';
    sortOrder?: 'asc' | 'desc';
  } = {}): Promise<ImageMetadata[]> {
    try {
      const {
        includeArchived = false,
        category,
        tags,
        limit = 50,
        offset = 0,
        sortBy = 'display_order',
        sortOrder = 'asc'
      } = options;

      let query = this.supabase
        .from('shop_images')
        .select('*')
        .eq('shop_id', shopId);

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      if (category) {
        query = query.eq('category', category);
      }

      if (tags && tags.length > 0) {
        query = query.overlaps('tags', tags);
      }

      query = query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error } = await query;

      if (error) {
        logger.error('Failed to get shop images', { shopId, error });
        return [];
      }

      return data as ImageMetadata[];
    } catch (error) {
      logger.error('Error getting shop images', { shopId, error });
      return [];
    }
  }

  /**
   * Update image metadata
   */
  async updateImageMetadata(imageId: string, updates: ImageMetadataUpdate): Promise<ImageMetadata | null> {
    try {
      // Validate updates
      const validationResult = this.validateMetadataUpdates(updates);
      if (!validationResult.isValid) {
        throw new Error(`Validation failed: ${validationResult.errors.join(', ')}`);
      }

      // Update the image
      const { data, error } = await this.supabase
        .from('shop_images')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update image metadata', { imageId, error });
        return null;
      }

      // Log access
      await this.logImageAccess(imageId);

      return data as ImageMetadata;
    } catch (error) {
      logger.error('Error updating image metadata', { imageId, error, updates });
      return null;
    }
  }

  /**
   * Generate intelligent alt text suggestions
   */
  async generateAltTextSuggestion(imageId: string): Promise<AltTextSuggestion[]> {
    try {
      const image = await this.getImageMetadata(imageId);
      if (!image) {
        return [];
      }

      const suggestions: AltTextSuggestion[] = [];

      // Get shop information
      const { data: shop } = await this.supabase
        .from('shops')
        .select('name, category')
        .eq('id', image.shop_id)
        .single();

      const shopName = shop?.name || '샵';
      const shopCategory = shop?.category || '';

      // Generate suggestions based on category
      if (image.category) {
        suggestions.push({
          suggestion: this.generateCategoryBasedAltText(image.category, shopName),
          confidence: 0.9,
          reasoning: `Based on image category: ${image.category}`
        });
      }

      // Generate suggestions based on tags
      if (image.tags && image.tags.length > 0) {
        suggestions.push({
          suggestion: this.generateTagBasedAltText(image.tags, shopName),
          confidence: 0.8,
          reasoning: `Based on image tags: ${image.tags.join(', ')}`
        });
      }

      // Generate suggestions based on shop category
      if (shopCategory) {
        suggestions.push({
          suggestion: this.generateShopCategoryBasedAltText(shopCategory, shopName),
          confidence: 0.7,
          reasoning: `Based on shop category: ${shopCategory}`
        });
      }

      // Generate generic suggestion
      suggestions.push({
        suggestion: `${shopName} 이미지`,
        confidence: 0.5,
        reasoning: 'Generic suggestion based on shop name'
      });

      return suggestions.sort((a, b) => b.confidence - a.confidence);
    } catch (error) {
      logger.error('Error generating alt text suggestions', { imageId, error });
      return [];
    }
  }

  /**
   * Reorder images for a shop
   */
  async reorderImages(shopId: string, imageOrders: ImageReorderRequest[]): Promise<boolean> {
    try {
      // Validate that all images belong to the shop
      const imageIds = imageOrders.map(order => order.imageId);
      const { data: existingImages } = await this.supabase
        .from('shop_images')
        .select('id')
        .eq('shop_id', shopId)
        .in('id', imageIds);

      if (existingImages.length !== imageIds.length) {
        throw new Error('Some images do not belong to the specified shop');
      }

      // Update display orders
      const updates = imageOrders.map(order => ({
        id: order.imageId,
        display_order: order.displayOrder,
        updated_at: new Date().toISOString()
      }));

      const { error } = await this.supabase
        .from('shop_images')
        .upsert(updates, { onConflict: 'id' });

      if (error) {
        logger.error('Failed to reorder images', { shopId, error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error reordering images', { shopId, error });
      return false;
    }
  }

  /**
   * Batch update metadata for multiple images
   */
  async batchUpdateMetadata(updates: Array<{
    imageId: string;
    metadata: ImageMetadataUpdate;
  }>): Promise<{ success: number; failed: number; errors: string[] }> {
    const results = { success: 0, failed: 0, errors: [] as string[] };

    for (const update of updates) {
      try {
        const result = await this.updateImageMetadata(update.imageId, update.metadata);
        if (result) {
          results.success++;
        } else {
          results.failed++;
          results.errors.push(`Failed to update image ${update.imageId}`);
        }
      } catch (error) {
        results.failed++;
        results.errors.push(`Error updating image ${update.imageId}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    return results;
  }

  /**
   * Get image statistics for a shop
   */
  async getImageStats(shopId: string): Promise<ImageStats | null> {
    try {
      const { data, error } = await this.supabase
        .rpc('get_shop_image_stats', { p_shop_id: shopId });

      if (error) {
        logger.error('Failed to get image stats', { shopId, error });
        return null;
      }

      return data[0] as ImageStats;
    } catch (error) {
      logger.error('Error getting image stats', { shopId, error });
      return null;
    }
  }

  /**
   * Archive/unarchive images
   */
  async archiveImages(imageIds: string[], archive: boolean = true): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('shop_images')
        .update({
          is_archived: archive,
          archived_at: archive ? new Date().toISOString() : null,
          updated_at: new Date().toISOString()
        })
        .in('id', imageIds);

      if (error) {
        logger.error('Failed to archive images', { imageIds, archive, error });
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error archiving images', { imageIds, archive, error });
      return false;
    }
  }

  /**
   * Search images by metadata
   */
  async searchImages(shopId: string, query: {
    searchText?: string;
    category?: string;
    tags?: string[];
    hasAltText?: boolean;
    isOptimized?: boolean;
    dateRange?: {
      start: string;
      end: string;
    };
  }): Promise<ImageMetadata[]> {
    try {
      let dbQuery = this.supabase
        .from('shop_images')
        .select('*')
        .eq('shop_id', shopId)
        .eq('is_archived', false);

      if (query.searchText) {
        dbQuery = dbQuery.or(`title.ilike.%${query.searchText}%,description.ilike.%${query.searchText}%,alt_text.ilike.%${query.searchText}%`);
      }

      if (query.category) {
        dbQuery = dbQuery.eq('category', query.category);
      }

      if (query.tags && query.tags.length > 0) {
        dbQuery = dbQuery.overlaps('tags', query.tags);
      }

      if (query.hasAltText !== undefined) {
        if (query.hasAltText) {
          dbQuery = dbQuery.not('alt_text', 'is', null);
        } else {
          dbQuery = dbQuery.is('alt_text', null);
        }
      }

      if (query.isOptimized !== undefined) {
        dbQuery = dbQuery.eq('is_optimized', query.isOptimized);
      }

      if (query.dateRange) {
        dbQuery = dbQuery
          .gte('created_at', query.dateRange.start)
          .lte('created_at', query.dateRange.end);
      }

      const { data, error } = await dbQuery.order('display_order', { ascending: true });

      if (error) {
        logger.error('Failed to search images', { shopId, query, error });
        return [];
      }

      return data as ImageMetadata[];
    } catch (error) {
      logger.error('Error searching images', { shopId, query, error });
      return [];
    }
  }

  /**
   * Log image access for analytics
   */
  private async logImageAccess(imageId: string): Promise<void> {
    try {
      // Get current access count
      const { data: currentData } = await this.supabase
        .from('shop_images')
        .select('access_count')
        .eq('id', imageId)
        .single();
      
      const currentCount = currentData?.access_count || 0;
      
      await this.supabase
        .from('shop_images')
        .update({
          last_accessed: new Date().toISOString(),
          access_count: currentCount + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', imageId);
    } catch (error) {
      logger.warn('Failed to log image access', { imageId, error });
    }
  }

  /**
   * Validate metadata updates
   */
  private validateMetadataUpdates(updates: ImageMetadataUpdate): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (updates.alt_text && updates.alt_text.length > 255) {
      errors.push('Alt text must be 255 characters or less');
    }

    if (updates.title && updates.title.length > 255) {
      errors.push('Title must be 255 characters or less');
    }

    if (updates.description && updates.description.length > 1000) {
      errors.push('Description must be 1000 characters or less');
    }

    if (updates.tags && updates.tags.length > 10) {
      errors.push('Maximum 10 tags allowed');
    }

    if (updates.tags && updates.tags.some(tag => tag.length > 50)) {
      errors.push('Each tag must be 50 characters or less');
    }

    if (updates.category && !['exterior', 'interior', 'service', 'staff', 'equipment', 'other'].includes(updates.category)) {
      errors.push('Invalid category');
    }

    if (updates.display_order !== undefined && (updates.display_order < 0 || updates.display_order > 9999)) {
      errors.push('Display order must be between 0 and 9999');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate category-based alt text
   */
  private generateCategoryBasedAltText(category: string, shopName: string): string {
    const categoryMap: Record<string, string> = {
      'exterior': `${shopName} 외관 사진`,
      'interior': `${shopName} 내부 사진`,
      'service': `${shopName} 서비스 사진`,
      'staff': `${shopName} 직원 사진`,
      'equipment': `${shopName} 장비 사진`,
      'other': `${shopName} 이미지`
    };

    return categoryMap[category] || `${shopName} 이미지`;
  }

  /**
   * Generate tag-based alt text
   */
  private generateTagBasedAltText(tags: string[], shopName: string): string {
    const relevantTags = tags.slice(0, 3).join(', ');
    return `${shopName} - ${relevantTags}`;
  }

  /**
   * Generate shop category-based alt text
   */
  private generateShopCategoryBasedAltText(shopCategory: string, shopName: string): string {
    const categoryMap: Record<string, string> = {
      'nail': `${shopName} 네일샵`,
      'eyelash': `${shopName} 속눈썹샵`,
      'waxing': `${shopName} 왁싱샵`,
      'eyebrow_tattoo': `${shopName} 눈썹문신샵`,
      'hair': `${shopName} 헤어샵`
    };

    return categoryMap[shopCategory] || `${shopName} 이미지`;
  }
}
