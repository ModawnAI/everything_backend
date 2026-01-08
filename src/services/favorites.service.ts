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
import { queryCacheService } from './query-cache.service';
import { batchQueryService } from './batch-query.service';

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

export interface FavoriteIdsResponse {
  success: boolean;
  favoriteIds: string[];
  count: number;
  message?: string;
}

export interface BatchToggleResult {
  success: boolean;
  added: string[];
  removed: string[];
  failed: Array<{ shopId: string; error: string }>;
  favoriteIds: string[];
  count: number;
  message?: string;
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
   * OPTIMIZED: Uses single RPC call to combine validation and insert
   */
  async addFavorite(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    try {
      // Use RPC to combine validation and insert in single database roundtrip
      const { data: result, error } = await this.supabase.rpc('add_favorite_atomic', {
        p_user_id: userId,
        p_shop_id: shopId
      });

      if (error) {
        // Fallback to original multi-query approach if RPC doesn't exist
        return await this.addFavoriteFallback(userId, shopId);
      }

      // Invalidate all favorites-related cache for this user (use pattern matching)
      await queryCacheService.invalidatePattern(`*favorites*${userId}*`);

      // Emit real-time update
      await this.emitFavoritesUpdate(userId, 'added', shopId, result.shop_name);

      logger.info('FavoritesService.addFavorite: Success', { userId, shopId, favoriteId: result.favorite_id });

      return {
        success: true,
        isFavorite: true,
        favoriteId: result.favorite_id,
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
   * Fallback method for add favorite (original implementation)
   */
  private async addFavoriteFallback(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    // Validate shop exists and is active - with caching
    const shop = await queryCacheService.getCachedQuery(
      `shop:${shopId}`,
      async () => {
        const { data, error } = await this.supabase
          .from('shops')
          .select('id, name, shop_status')
          .eq('id', shopId)
          .single();

        if (error || !data) {
          throw new Error('Shop not found');
        }
        return data;
      },
      { namespace: 'shop', ttl: 1800 }
    );

    if (!shop || shop.shop_status !== 'active') {
      return {
        success: false,
        isFavorite: false,
        message: 'Cannot favorite inactive shops'
      };
    }

    // Check if already favorited
    const { data: existingFavorite } = await this.supabase
      .from('user_favorites')
      .select('id')
      .eq('user_id', userId)
      .eq('shop_id', shopId)
      .maybeSingle();

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
      .insert({ user_id: userId, shop_id: shopId })
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

    // Invalidate all favorites-related cache for this user (use pattern matching)
    await queryCacheService.invalidatePattern(`*favorites*${userId}*`);

    // Emit real-time update
    await this.emitFavoritesUpdate(userId, 'added', shopId, shop.name);

    return {
      success: true,
      isFavorite: true,
      favoriteId: newFavorite.id,
      message: 'Shop added to favorites successfully'
    };
  }

  /**
   * Remove a shop from user's favorites
   * Optimized: Uses cached shop data and single delete operation
   */
  async removeFavorite(userId: string, shopId: string): Promise<FavoriteShopResponse> {
    try {
      // Get shop data from cache for real-time update
      // IMPORTANT: Select same fields as addFavoriteFallback to avoid cache inconsistency
      const shop = await queryCacheService.getCachedQuery(
        `shop:${shopId}`,
        async () => {
          const { data, error } = await this.supabase
            .from('shops')
            .select('id, name, shop_status')
            .eq('id', shopId)
            .single();

          if (error || !data) {
            return null;
          }

          return data;
        },
        {
          namespace: 'shop',
          ttl: 1800, // 30 minutes
        }
      );

      // Remove from favorites (delete automatically returns nothing if not exists)
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

      // Invalidate all favorites-related cache for this user (use pattern matching)
      await queryCacheService.invalidatePattern(`*favorites*${userId}*`);

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
      const { data: existingFavorite } = await this.supabase
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
   * Optimized: Added caching for frequently accessed favorites lists
   */
  async getUserFavorites(userId: string, options?: {
    limit?: number;
    offset?: number;
    category?: string;
    sortBy?: 'recent' | 'name' | 'bookings';
    includeShopData?: boolean;
  }): Promise<UserFavoritesResponse> {
    try {
      const { limit = 50, offset = 0, category, sortBy = 'recent', includeShopData = false } = options || {};

      // Create cache key based on query parameters
      const cacheKey = `list:${userId}:${limit}:${offset}:${category || 'all'}:${sortBy}:${includeShopData}`;

      const result = await queryCacheService.getCachedQuery(
        cacheKey,
        async () => {
          // Build select query based on includeShopData parameter
          let selectQuery: string;
          if (includeShopData) {
            selectQuery = `
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
            `;
          } else {
            selectQuery = `
              id,
              user_id,
              shop_id,
              created_at
            `;
          }

          let query = this.supabase
            .from('user_favorites')
            .select(selectQuery, { count: 'exact' })
            .eq('user_id', userId);

          // Filter by category if provided (only when includeShopData is true)
          if (category && includeShopData) {
            query = query.eq('shops.main_category', category);
          }

          // Apply sorting
          if (includeShopData) {
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
          } else {
            // When not including shop data, only recent sorting is available
            query = query.order('created_at', { ascending: false });
          }

          // Apply pagination with exact count for accurate totalCount
          const { data: favorites, error, count } = await query
            .range(offset, offset + limit - 1);

          if (error) {
            logger.error('FavoritesService.getUserFavorites: Database error', { userId, error });
            throw error;
          }

          // Only fetch shop images when includeShopData is true
          const shopIds = favorites?.map((fav: any) => fav.shop_id).filter(Boolean) || [];
          const shopImagesMap = new Map<string, any[]>();

          if (includeShopData && shopIds.length > 0) {
            try {
              const { data: allShopImages, error: imagesError } = await this.supabase
                .from('shop_images')
                .select('*')
                .in('shop_id', shopIds)
                .order('is_main', { ascending: false })
                .order('display_order', { ascending: true });

              if (!imagesError && allShopImages) {
                allShopImages.forEach(image => {
                  if (!shopImagesMap.has(image.shop_id)) {
                    shopImagesMap.set(image.shop_id, []);
                  }
                  shopImagesMap.get(image.shop_id)!.push(image);
                });
              }
            } catch (error) {
              logger.error('Failed to fetch shop images for favorites', {
                error: error instanceof Error ? error.message : 'Unknown error',
                shopIds
              });
            }
          }

          // Format response based on includeShopData flag
          const formattedFavorites: any[] = favorites?.map((fav: any) => {
            if (includeShopData) {
              return {
                id: fav.id,
                shopId: fav.shop_id,
                shop: {
                  id: fav.shops?.[0]?.id,
                  name: fav.shops?.[0]?.name,
                  description: fav.shops?.[0]?.description || '',
                  address: fav.shops?.[0]?.address,
                  mainCategory: fav.shops?.[0]?.main_category,
                  shopStatus: fav.shops?.[0]?.shop_status,
                  shopType: fav.shops?.[0]?.shop_type,
                  latitude: fav.shops?.[0]?.latitude || 0,
                  longitude: fav.shops?.[0]?.longitude || 0,
                  totalBookings: fav.shops?.[0]?.total_bookings || 0,
                  isFeatured: fav.shops?.[0]?.is_featured || false,
                  featuredUntil: fav.shops?.[0]?.featured_until,
                  commissionRate: fav.shops?.[0]?.commission_rate || 0,
                  createdAt: fav.shops?.[0]?.created_at,
                  updatedAt: fav.shops?.[0]?.updated_at,
                  shopImages: shopImagesMap.get(fav.shop_id) || []
                },
                addedAt: fav.created_at
              };
            } else {
              // Minimal response - just favorite metadata
              return {
                id: fav.id,
                user_id: fav.user_id,
                shop_id: fav.shop_id,
                created_at: fav.created_at
              };
            }
          }) || [];

          return {
            favorites: formattedFavorites,
            totalCount: count || 0
          };
        },
        {
          namespace: 'favorites',
          ttl: 300, // 5 minutes
        }
      );

      return {
        success: true,
        favorites: result.favorites,
        totalCount: result.totalCount,
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
   * Optimized: Single query with caching instead of 3 separate queries
   */
  async getFavoritesStats(userId: string): Promise<FavoritesStatsResponse> {
    try {
      // Use cached query for stats
      const stats = await queryCacheService.getCachedQuery(
        `stats:${userId}`,
        async () => {
          // Single query to get all needed data
          const { data: allFavorites, error } = await this.supabase
            .from('user_favorites')
            .select(`
              shop_id,
              created_at,
              shops!inner (
                name,
                main_category
              )
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });

          if (error) {
            logger.error('FavoritesService.getFavoritesStats: Database error', { userId, error });
            throw error;
          }

          // Process data in memory
          const totalFavorites = allFavorites?.length || 0;

          // Count categories
          const categoryCounts: Record<string, number> = {};
          allFavorites?.forEach(item => {
            // Supabase returns shops as an array due to join, so we take the first element
            const shop = Array.isArray(item.shops) ? item.shops[0] : item.shops;
            const category = shop?.main_category;
            if (category) {
              categoryCounts[category] = (categoryCounts[category] || 0) + 1;
            }
          });

          const favoriteCategories = Object.entries(categoryCounts)
            .map(([category, count]) => ({ category, count }))
            .sort((a, b) => b.count - a.count);

          // Get recently added (already sorted by created_at desc)
          const recentlyAdded = allFavorites?.slice(0, 5).map(item => {
            // Supabase returns shops as an array due to join, so we take the first element
            const shop = Array.isArray(item.shops) ? item.shops[0] : item.shops;
            return {
              shopId: item.shop_id,
              shopName: shop?.name || 'Unknown Shop',
              addedAt: item.created_at
            };
          }) || [];

          return {
            totalFavorites,
            favoriteCategories,
            recentlyAdded
          };
        },
        {
          namespace: 'favorites',
          ttl: 300, // 5 minutes - stats don't need to be real-time
        }
      );

      return {
        success: true,
        stats,
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
   * Optimized: Uses batch operations instead of individual queries
   */
  async bulkUpdateFavorites(userId: string, shopIds: string[], action: 'add' | 'remove'): Promise<BulkFavoritesResponse> {
    try {
      const added: string[] = [];
      const removed: string[] = [];
      const failed: Array<{ shopId: string; reason: string }> = [];

      if (action === 'add') {
        // Batch check which shops exist
        const shopsMap = await batchQueryService.batchGetShops(shopIds);

        // Batch check which are already favorited
        const existingFavorites = await batchQueryService.batchCheckFavorites(userId, shopIds);

        // Prepare records to insert
        const recordsToInsert = shopIds
          .filter(shopId => {
            if (!shopsMap.has(shopId)) {
              failed.push({ shopId, reason: 'Shop not found' });
              return false;
            }
            if (existingFavorites.has(shopId)) {
              failed.push({ shopId, reason: 'Already in favorites' });
              return false;
            }
            return true;
          })
          .map(shopId => ({
            user_id: userId,
            shop_id: shopId,
            created_at: new Date().toISOString()
          }));

        // Batch insert
        if (recordsToInsert.length > 0) {
          const insertResult = await batchQueryService.batchInsert('user_favorites', recordsToInsert);

          insertResult.success.forEach((record: any) => {
            added.push(record.shop_id);
          });

          insertResult.failed.forEach((failedRecord: any) => {
            failed.push({
              shopId: failedRecord.record.shop_id,
              reason: failedRecord.error
            });
          });
        }

      } else {
        // Batch delete
        const deleteResult = await batchQueryService.batchDelete('user_favorites', shopIds);

        if (deleteResult.success) {
          removed.push(...shopIds);
        } else {
          failed.push(...shopIds.map(shopId => ({ shopId, reason: 'Delete failed' })));
        }
      }

      // Invalidate all favorites-related cache for this user (use pattern matching)
      await queryCacheService.invalidatePattern(`*favorites*${userId}*`);

      logger.info('FavoritesService.bulkUpdateFavorites: Success', {
        userId,
        action,
        added: added.length,
        removed: removed.length,
        failed: failed.length
      });

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
   * Optimized: Uses batch service with caching
   */
  async checkMultipleFavorites(userId: string, shopIds: string[]): Promise<Record<string, boolean>> {
    try {
      // Use batch service which includes caching
      const favoriteShopIds = await batchQueryService.batchCheckFavorites(userId, shopIds);

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

  /**
   * Get lightweight list of favorite shop IDs
   * Optimized for fast synchronization
   */
  async getFavoriteIds(userId: string): Promise<FavoriteIdsResponse> {
    try {
      const { data, error } = await this.supabase
        .from('user_favorites')
        .select('shop_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('FavoritesService.getFavoriteIds: Database error', { userId, error: error.message });
        return {
          success: false,
          favoriteIds: [],
          count: 0,
          message: 'Failed to retrieve favorite IDs'
        };
      }

      const favoriteIds = data?.map(f => f.shop_id) || [];

      return {
        success: true,
        favoriteIds,
        count: favoriteIds.length
      };

    } catch (error) {
      logger.error('FavoritesService.getFavoriteIds: Unexpected error', { userId, error });
      return {
        success: false,
        favoriteIds: [],
        count: 0,
        message: 'An unexpected error occurred'
      };
    }
  }

  /**
   * Batch toggle multiple favorites
   * Used for offline sync and bulk operations
   */
  async batchToggleFavorites(
    userId: string,
    add: string[],
    remove: string[]
  ): Promise<BatchToggleResult> {
    const results: BatchToggleResult = {
      success: true,
      added: [],
      removed: [],
      failed: [],
      favoriteIds: [],
      count: 0
    };

    try {
      // Process additions
      for (const shopId of add || []) {
        try {
          // Validate shop exists and is active (with caching)
          const shop = await queryCacheService.getCachedQuery(
            `shop:${shopId}`,
            async () => {
              const { data, error } = await this.supabase
                .from('shops')
                .select('id, name, shop_status')
                .eq('id', shopId)
                .single();

              if (error || !data) {
                throw new Error('Shop not found');
              }
              return data;
            },
            { namespace: 'shop', ttl: 300 }
          );

          if (!shop || shop.shop_status !== 'active') {
            results.failed.push({ shopId, error: 'Shop is not active' });
            continue;
          }

          // Add to favorites (upsert to handle duplicates)
          const { error } = await this.supabase
            .from('user_favorites')
            .upsert(
              {
                user_id: userId,
                shop_id: shopId,
                created_at: new Date().toISOString()
              },
              { onConflict: 'user_id,shop_id' }
            );

          if (error) {
            results.failed.push({ shopId, error: error.message });
          } else {
            results.added.push(shopId);
          }
        } catch (error) {
          results.failed.push({
            shopId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Process removals
      for (const shopId of remove || []) {
        try {
          const { error } = await this.supabase
            .from('user_favorites')
            .delete()
            .eq('user_id', userId)
            .eq('shop_id', shopId);

          if (error) {
            results.failed.push({ shopId, error: error.message });
          } else {
            results.removed.push(shopId);
          }
        } catch (error) {
          results.failed.push({
            shopId,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Get updated favorites list
      const { data: updatedFavorites } = await this.supabase
        .from('user_favorites')
        .select('shop_id')
        .eq('user_id', userId);

      results.favoriteIds = updatedFavorites?.map(f => f.shop_id) || [];
      results.count = results.favoriteIds.length;

      logger.info('FavoritesService.batchToggleFavorites: Completed', {
        userId,
        added: results.added.length,
        removed: results.removed.length,
        failed: results.failed.length,
        totalFavorites: results.count
      });

      return results;

    } catch (error) {
      logger.error('FavoritesService.batchToggleFavorites: Unexpected error', { userId, error });
      return {
        success: false,
        added: [],
        removed: [],
        failed: [...(add || []), ...(remove || [])].map(shopId => ({
          shopId,
          error: 'An unexpected error occurred'
        })),
        favoriteIds: [],
        count: 0,
        message: 'An unexpected error occurred'
      };
    }
  }
}

export const favoritesService = new FavoritesService();
