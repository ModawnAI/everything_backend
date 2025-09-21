/**
 * User Favorites Management Service
 * 
 * Handles comprehensive user favorites operations including:
 * - Adding/removing shop favorites
 * - Retrieving user's favorite shops
 * - Favorites count and statistics
 * - Real-time sync capabilities
 * - Data validation and error handling
 */

import { getSupabaseClient } from '../config/database';
// Database types - using direct Supabase types
import { logger } from '../utils/logger';
import { websocketService } from './websocket.service';

// Favorites operation interfaces
export interface FavoriteShopRequest {
  shopId: string;
}

export interface FavoriteShopResponse {
  success: boolean;
  isFavorite: boolean;
  favoriteId?: string;
  message: string;
}

export interface UserFavoritesResponse {
  success: boolean;
  favorites: FavoriteShop[];
  totalCount: number;
  message: string;
}

export interface FavoriteShop {
  id: string;
  shopId: string;
  shop: {
    id: string;
    name: string;
    description: string;
    address: string;
    mainCategory: string;
    shopStatus: string;
    shopType: string;
    latitude: number;
    longitude: number;
    totalBookings: number;
    isFeatured: boolean;
    featuredUntil?: string;
    commissionRate: number;
    createdAt: string;
    updatedAt: string;
  };
  addedAt: string;
}

export interface FavoritesStatsResponse {
  success: boolean;
  stats: {
    totalFavorites: number;
    favoriteCategories: Array<{
      category: string;
      count: number;
    }>;
    recentlyAdded: Array<{
      shopId: string;
      shopName: string;
      addedAt: string;
    }>;
  };
  message: string;
}

export interface BulkFavoritesRequest {
  shopIds: string[];
}

export interface BulkFavoritesResponse {
  success: boolean;
  added: string[];
  removed: string[];
  failed: Array<{
    shopId: string;
    reason: string;
  }>;
  message: string;
}

export class FavoritesService {
  private supabase = getSupabaseClient();

  /**
   * Add a shop to user's favorites
   */
  async addFavorite(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    try {
      // Validate shop exists and is active
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('id, name, shop_status')
        .eq('id', shopId)
        .single();

      if (shopError || !shop) {
        logger.warn('FavoritesService.addFavorite: Shop not found', { userId, shopId, error: shopError });
        return {
          success: false,
          isFavorite: false,
          message: 'Shop not found or inactive'
        };
      }

      if (shop.shop_status !== 'approved') {
        return {
          success: false,
          isFavorite: false,
          message: 'Cannot favorite unapproved shops'
        };
      }

      // Check if already favorited
      const { data: existingFavorite, error: checkError } = await this.supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .single();

      if (existingFavorite) {
        return {
          success: true,
          isFavorite: true,
          favoriteId: existingFavorite.id,
          message: 'Shop is already in favorites'
        };
      }

      // Add to favorites
      const { data: newFavorite, error: insertError } = await this.supabase
        .from('user_favorites')
        .insert({
          user_id: userId,
          shop_id: shopId
        })
        .select('id')
        .single();

      if (insertError) {
        logger.error('FavoritesService.addFavorite: Database error', { userId, shopId, error: insertError });
        return {
          success: false,
          isFavorite: false,
          message: 'Failed to add shop to favorites'
        };
      }

      // Emit real-time update
      await this.emitFavoritesUpdate(userId, 'added', shopId, shop.name);

      logger.info('FavoritesService.addFavorite: Success', { userId, shopId, favoriteId: newFavorite.id });

      return {
        success: true,
        isFavorite: true,
        favoriteId: newFavorite.id,
        message: 'Shop added to favorites successfully'
      };

    } catch (error) {
      logger.error('FavoritesService.addFavorite: Unexpected error', { userId, shopId, error });
      return {
        success: false,
        isFavorite: false,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Remove a shop from user's favorites
   */
  async removeFavorite(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    try {
      // Check if favorite exists
      const { data: existingFavorite, error: checkError } = await this.supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .single();

      if (!existingFavorite) {
        return {
          success: true,
          isFavorite: false,
          message: 'Shop is not in favorites'
        };
      }

      // Get shop name for real-time update
      const { data: shop } = await this.supabase
        .from('shops')
        .select('name')
        .eq('id', shopId)
        .single();

      // Remove from favorites
      const { error: deleteError } = await this.supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', userId)
        .eq('shop_id', shopId);

      if (deleteError) {
        logger.error('FavoritesService.removeFavorite: Database error', { userId, shopId, error: deleteError });
        return {
          success: false,
          isFavorite: true,
          message: 'Failed to remove shop from favorites'
        };
      }

      // Emit real-time update
      await this.emitFavoritesUpdate(userId, 'removed', shopId, shop?.name || 'Unknown Shop');

      logger.info('FavoritesService.removeFavorite: Success', { userId, shopId });

      return {
        success: true,
        isFavorite: false,
        message: 'Shop removed from favorites successfully'
      };

    } catch (error) {
      logger.error('FavoritesService.removeFavorite: Unexpected error', { userId, shopId, error });
      return {
        success: false,
        isFavorite: true,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Toggle favorite status (add if not favorited, remove if favorited)
   */
  async toggleFavorite(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    try {
      // Check current status
      const { data: existingFavorite, error: checkError } = await this.supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .single();

      if (existingFavorite) {
        return await this.removeFavorite(userId, shopId);
      } else {
        return await this.addFavorite(userId, shopId);
      }

    } catch (error) {
      logger.error('FavoritesService.toggleFavorite: Unexpected error', { userId, shopId, error });
      return {
        success: false,
        isFavorite: false,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Check if a shop is favorited by user
   */
  async isFavorite(userId: string, shopId: string): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', userId)
        .eq('shop_id', shopId)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.error('FavoritesService.isFavorite: Database error', { userId, shopId, error });
        return false;
      }

      return !!data;

    } catch (error) {
      logger.error('FavoritesService.isFavorite: Unexpected error', { userId, shopId, error });
      return false;
    }
  }

  /**
   * Get user's favorite shops with full shop details
   */
  async getUserFavorites(userId: string, options?: {
    limit?: number;
    offset?: number;
    category?: string;
    sortBy?: 'recent' | 'name' | 'bookings';
  }): Promise<UserFavoritesResponse> {
    try {
      const { limit = 50, offset = 0, category, sortBy = 'recent' } = options || {};

      let query = this.supabase
        .from('user_favorites')
        .select(`
          id,
          shop_id,
          created_at,
          shops!inner (
            id,
            name,
            description,
            address,
            main_category,
            shop_status,
            shop_type,
            latitude,
            longitude,
            total_bookings,
            is_featured,
            featured_until,
            commission_rate,
            created_at,
            updated_at
          )
        `)
        .eq('user_id', userId);

      // Filter by category if provided
      if (category) {
        query = query.eq('shops.main_category', category);
      }

      // Apply sorting
      switch (sortBy) {
        case 'recent':
          query = query.order('created_at', { ascending: false });
          break;
        case 'name':
          query = query.order('shops.name', { ascending: true });
          break;
        case 'bookings':
          query = query.order('shops.total_bookings', { ascending: false });
          break;
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: favorites, error, count } = await query;

      if (error) {
        logger.error('FavoritesService.getUserFavorites: Database error', { userId, error });
        return {
          success: false,
          favorites: [],
          totalCount: 0,
          message: 'Failed to retrieve favorites'
        };
      }

      const formattedFavorites: FavoriteShop[] = favorites?.map(fav => ({
        id: fav.id,
        shopId: fav.shop_id,
        shop: {
          id: fav.shops[0]?.id,
          name: fav.shops[0]?.name,
          description: fav.shops[0]?.description || '',
          address: fav.shops[0]?.address,
          mainCategory: fav.shops[0]?.main_category,
          shopStatus: fav.shops[0]?.shop_status,
          shopType: fav.shops[0]?.shop_type,
          latitude: fav.shops[0]?.latitude || 0,
          longitude: fav.shops[0]?.longitude || 0,
          totalBookings: fav.shops[0]?.total_bookings || 0,
          isFeatured: fav.shops[0]?.is_featured || false,
          featuredUntil: fav.shops[0]?.featured_until,
          commissionRate: fav.shops[0]?.commission_rate || 0,
          createdAt: fav.shops[0]?.created_at,
          updatedAt: fav.shops[0]?.updated_at
        },
        addedAt: fav.created_at
      })) || [];

      return {
        success: true,
        favorites: formattedFavorites,
        totalCount: count || 0,
        message: 'Favorites retrieved successfully'
      };

    } catch (error) {
      logger.error('FavoritesService.getUserFavorites: Unexpected error', { userId, error });
      return {
        success: false,
        favorites: [],
        totalCount: 0,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Get favorites statistics for user
   */
  async getFavoritesStats(userId: string): Promise<FavoritesStatsResponse> {
    try {
      // Get total count
      const { count: totalCount, error: countError } = await this.supabase
        .from('user_favorites')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);

      if (countError) {
        logger.error('FavoritesService.getFavoritesStats: Count error', { userId, error: countError });
        return {
          success: false,
          stats: {
            totalFavorites: 0,
            favoriteCategories: [],
            recentlyAdded: []
          },
          message: 'Failed to retrieve favorites statistics'
        };
      }

      // Get category breakdown
      const { data: categoryData, error: categoryError } = await this.supabase
        .from('user_favorites')
        .select(`
          shops!inner (main_category)
        `)
        .eq('user_id', userId);

      if (categoryError) {
        logger.error('FavoritesService.getFavoritesStats: Category error', { userId, error: categoryError });
        return {
          success: false,
          stats: {
            totalFavorites: 0,
            favoriteCategories: [],
            recentlyAdded: []
          },
          message: 'Failed to retrieve favorites statistics'
        };
      }

      // Count categories
      const categoryCounts: Record<string, number> = {};
      categoryData?.forEach(item => {
        const category = item.shops[0]?.main_category;
        categoryCounts[category] = (categoryCounts[category] || 0) + 1;
      });

      const favoriteCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count);

      // Get recently added
      const { data: recentData, error: recentError } = await this.supabase
        .from('user_favorites')
        .select(`
          shop_id,
          created_at,
          shops!inner (name)
        `)
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(5);

      if (recentError) {
        logger.error('FavoritesService.getFavoritesStats: Recent error', { userId, error: recentError });
        return {
          success: false,
          stats: {
            totalFavorites: 0,
            favoriteCategories: [],
            recentlyAdded: []
          },
          message: 'Failed to retrieve favorites statistics'
        };
      }

      const recentlyAdded = recentData?.map(item => ({
        shopId: item.shop_id,
        shopName: item.shops[0]?.name,
        addedAt: item.created_at
      })) || [];

      return {
        success: true,
        stats: {
          totalFavorites: totalCount || 0,
          favoriteCategories,
          recentlyAdded
        },
        message: 'Favorites statistics retrieved successfully'
      };

    } catch (error) {
      logger.error('FavoritesService.getFavoritesStats: Unexpected error', { userId, error });
      return {
        success: false,
        stats: {
          totalFavorites: 0,
          favoriteCategories: [],
          recentlyAdded: []
        },
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Bulk add/remove favorites
   */
  async bulkUpdateFavorites(userId: string, shopIds: string[], action: 'add' | 'remove'): Promise<BulkFavoritesResponse> {
    try {
      const added: string[] = [];
      const removed: string[] = [];
      const failed: Array<{ shopId: string; reason: string }> = [];

      for (const shopId of shopIds) {
        try {
          if (action === 'add') {
            const result = await this.addFavorite(userId, shopId);
            if (result.success) {
              added.push(shopId);
            } else {
              failed.push({ shopId, reason: result.message });
            }
          } else {
            const result = await this.removeFavorite(userId, shopId);
            if (result.success) {
              removed.push(shopId);
            } else {
              failed.push({ shopId, reason: result.message });
            }
          }
        } catch (error) {
          failed.push({ shopId, reason: 'Unexpected error occurred' });
        }
      }

      return {
        success: true,
        added,
        removed,
        failed,
        message: `Bulk ${action} operation completed`
      };

    } catch (error) {
      logger.error('FavoritesService.bulkUpdateFavorites: Unexpected error', { userId, shopIds, action, error });
      return {
        success: false,
        added: [],
        removed: [],
        failed: shopIds.map(shopId => ({ shopId, reason: 'An unexpected error occurred' })),
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Check multiple shops favorite status
   */
  async checkMultipleFavorites(userId: string, shopIds: string[]): Promise<Record<string, boolean>> {
    try {
      const { data, error } = await this.supabase
        .from('user_favorites')
        .select('shop_id')
        .eq('user_id', userId)
        .in('shop_id', shopIds);

      if (error) {
        logger.error('FavoritesService.checkMultipleFavorites: Database error', { userId, shopIds, error });
        return {};
      }

      const favoriteShopIds = new Set(data?.map(item => item.shop_id) || []);
      
      return shopIds.reduce((acc, shopId) => {
        acc[shopId] = favoriteShopIds.has(shopId);
        return acc;
      }, {} as Record<string, boolean>);

    } catch (error) {
      logger.error('FavoritesService.checkMultipleFavorites: Unexpected error', { userId, shopIds, error });
      return {};
    }
  }

  /**
   * Emit real-time favorites update via WebSocket
   */
  private async emitFavoritesUpdate(userId: string, action: 'added' | 'removed', shopId: string, shopName: string): Promise<void> {
    try {
      // WebSocket notification for favorites update
      // await websocketService.emitToUser(userId, 'favorites_updated', {
      //   action,
      //   shopId,
      //   shopName,
      //   timestamp: new Date().toISOString()
      // });
    } catch (error) {
      logger.error('FavoritesService.emitFavoritesUpdate: WebSocket error', { userId, action, shopId, error });
      // Don't throw error - WebSocket failure shouldn't break favorites functionality
    }
  }
}

export const favoritesService = new FavoritesService();
