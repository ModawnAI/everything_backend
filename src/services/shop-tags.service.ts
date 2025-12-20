/**
 * Shop Tags Service
 *
 * Handles shop tag management including CRUD operations
 * and popular tags for autocomplete
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface ShopTag {
  id: string;
  shopId: string;
  tag: string;
  displayOrder: number;
  createdAt: Date;
}

export interface PopularTag {
  tag: string;
  usageCount: number;
}

export class ShopTagsService {
  /**
   * Get shop tags
   */
  async getShopTags(shopId: string): Promise<ShopTag[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_tags')
      .select('*')
      .eq('shop_id', shopId)
      .order('display_order');

    if (error) {
      logger.error('Failed to fetch shop tags', { shopId, error: error.message });
      throw new Error(`Failed to fetch shop tags: ${error.message}`);
    }

    return (data || []).map(tag => ({
      id: tag.id,
      shopId: tag.shop_id,
      tag: tag.tag,
      displayOrder: tag.display_order,
      createdAt: new Date(tag.created_at),
    }));
  }

  /**
   * Update shop tags (replace all)
   */
  async updateShopTags(shopId: string, tags: string[]): Promise<ShopTag[]> {
    const supabase = getSupabaseClient();

    // Validate and clean tags
    const cleanTags = tags
      .map(tag => tag.trim().replace(/^#/, '')) // Remove leading #
      .filter(tag => tag.length > 0 && tag.length <= 20)
      .slice(0, 10); // Max 10 tags

    // Remove duplicates
    const uniqueTags = [...new Set(cleanTags)];

    logger.info('Updating shop tags', {
      shopId,
      originalCount: tags.length,
      cleanedCount: uniqueTags.length
    });

    // Delete existing tags
    const { error: deleteError } = await supabase
      .from('shop_tags')
      .delete()
      .eq('shop_id', shopId);

    if (deleteError) {
      logger.error('Failed to delete existing tags', { shopId, error: deleteError.message });
      throw new Error(`Failed to update tags: ${deleteError.message}`);
    }

    if (uniqueTags.length === 0) {
      return [];
    }

    // Insert new tags
    const tagsToInsert = uniqueTags.map((tag, index) => ({
      shop_id: shopId,
      tag,
      display_order: index,
    }));

    const { data, error: insertError } = await supabase
      .from('shop_tags')
      .insert(tagsToInsert)
      .select();

    if (insertError) {
      logger.error('Failed to insert new tags', { shopId, error: insertError.message });
      throw new Error(`Failed to insert tags: ${insertError.message}`);
    }

    logger.info('Shop tags updated successfully', { shopId, count: data?.length || 0 });

    return (data || []).map(tag => ({
      id: tag.id,
      shopId: tag.shop_id,
      tag: tag.tag,
      displayOrder: tag.display_order,
      createdAt: new Date(tag.created_at),
    }));
  }

  /**
   * Get popular tags for autocomplete
   */
  async getPopularTags(limit: number = 20): Promise<PopularTag[]> {
    const supabase = getSupabaseClient();

    // Try to get from popular_tags view first
    const { data, error } = await supabase
      .from('popular_tags')
      .select('*')
      .limit(limit);

    if (error) {
      logger.warn('Failed to fetch from popular_tags view, using fallback', { error: error.message });

      // Fallback to direct aggregation query
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('shop_tags')
        .select('tag');

      if (fallbackError) {
        logger.error('Fallback query also failed', { error: fallbackError.message });
        return [];
      }

      // Manual aggregation
      const tagCounts = new Map<string, number>();
      (fallbackData || []).forEach(item => {
        tagCounts.set(item.tag, (tagCounts.get(item.tag) || 0) + 1);
      });

      return Array.from(tagCounts.entries())
        .map(([tag, usageCount]) => ({ tag, usageCount }))
        .sort((a, b) => b.usageCount - a.usageCount)
        .slice(0, limit);
    }

    return (data || []).map(item => ({
      tag: item.tag,
      usageCount: Number(item.usage_count),
    }));
  }

  /**
   * Search tags for autocomplete
   */
  async searchTags(query: string, limit: number = 10): Promise<string[]> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('shop_tags')
      .select('tag')
      .ilike('tag', `%${query}%`)
      .limit(limit * 2); // Get more to filter duplicates

    if (error) {
      logger.error('Failed to search tags', { query, error: error.message });
      throw new Error(`Failed to search tags: ${error.message}`);
    }

    // Remove duplicates and return
    return [...new Set((data || []).map(item => item.tag))].slice(0, limit);
  }

  /**
   * Get shops by tag
   */
  async getShopsByTag(tag: string, page: number = 1, limit: number = 20): Promise<{
    shops: any[];
    total: number;
    hasMore: boolean;
  }> {
    const supabase = getSupabaseClient();
    const offset = (page - 1) * limit;

    const { data, error, count } = await supabase
      .from('shop_tags')
      .select(`
        shops:shop_id (
          id,
          name,
          address,
          main_category,
          shop_status
        )
      `, { count: 'exact' })
      .eq('tag', tag)
      .range(offset, offset + limit - 1);

    if (error) {
      logger.error('Failed to get shops by tag', { tag, error: error.message });
      throw new Error(`Failed to get shops by tag: ${error.message}`);
    }

    const shops = (data || [])
      .map(item => item.shops)
      .filter(shop => shop && (shop as any).shop_status === 'active');

    return {
      shops,
      total: count || 0,
      hasMore: (count || 0) > offset + limit,
    };
  }
}

export const shopTagsService = new ShopTagsService();
