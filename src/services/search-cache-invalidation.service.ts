import { logger } from '../utils/logger';
import { shopSearchService } from './shop-search.service';

/**
 * Service for managing search cache invalidation
 * This service should be called whenever shop data changes
 */
export class SearchCacheInvalidationService {
  /**
   * Invalidate cache when a shop is created, updated, or deleted
   */
  async onShopDataChange(shopId: string, changeType: 'create' | 'update' | 'delete'): Promise<void> {
    try {
      logger.info('Shop data changed, invalidating search cache', { shopId, changeType });
      
      // Invalidate all search caches since shop data affects search results
      await shopSearchService.invalidateShopCache(shopId);
      
      // If location changed, also invalidate location-based caches
      if (changeType === 'update') {
        await shopSearchService.invalidateLocationCache();
      }
      
      logger.info('Search cache invalidated successfully', { shopId, changeType });
    } catch (error) {
      logger.error('Failed to invalidate search cache on shop data change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        changeType
      });
    }
  }

  /**
   * Invalidate cache when shop status changes (approval, suspension, etc.)
   */
  async onShopStatusChange(shopId: string, oldStatus: string, newStatus: string): Promise<void> {
    try {
      logger.info('Shop status changed, invalidating search cache', { 
        shopId, 
        oldStatus, 
        newStatus 
      });
      
      // Status changes affect search results visibility
      await shopSearchService.invalidateShopCache(shopId);
      
      logger.info('Search cache invalidated for status change', { shopId, oldStatus, newStatus });
    } catch (error) {
      logger.error('Failed to invalidate search cache on status change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        oldStatus,
        newStatus
      });
    }
  }

  /**
   * Invalidate cache when shop services are updated
   */
  async onShopServicesChange(shopId: string): Promise<void> {
    try {
      logger.info('Shop services changed, invalidating search cache', { shopId });
      
      // Service changes affect category and service-based searches
      await shopSearchService.invalidateShopCache(shopId);
      
      logger.info('Search cache invalidated for services change', { shopId });
    } catch (error) {
      logger.error('Failed to invalidate search cache on services change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
    }
  }

  /**
   * Invalidate cache when shop images are updated
   */
  async onShopImagesChange(shopId: string): Promise<void> {
    try {
      logger.info('Shop images changed, invalidating search cache', { shopId });
      
      // Image changes affect hasImages filter results
      await shopSearchService.invalidateShopCache(shopId);
      
      logger.info('Search cache invalidated for images change', { shopId });
    } catch (error) {
      logger.error('Failed to invalidate search cache on images change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId
      });
    }
  }

  /**
   * Invalidate cache when featured shop status changes
   */
  async onFeaturedStatusChange(shopId: string, isFeatured: boolean): Promise<void> {
    try {
      logger.info('Shop featured status changed, invalidating search cache', { 
        shopId, 
        isFeatured 
      });
      
      // Featured status affects search result ordering
      await shopSearchService.invalidateShopCache(shopId);
      
      logger.info('Search cache invalidated for featured status change', { shopId, isFeatured });
    } catch (error) {
      logger.error('Failed to invalidate search cache on featured status change', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        isFeatured
      });
    }
  }

  /**
   * Bulk invalidate cache (for maintenance or major updates)
   */
  async invalidateAllSearchCache(): Promise<void> {
    try {
      logger.info('Bulk invalidating all search cache');
      
      await shopSearchService.invalidateShopCache();
      
      logger.info('All search cache invalidated successfully');
    } catch (error) {
      logger.error('Failed to bulk invalidate search cache', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get cache performance statistics
   */
  async getCachePerformanceStats(): Promise<{
    hits: number;
    misses: number;
    hitRate: number;
  }> {
    try {
      return await shopSearchService.getCacheStats();
    } catch (error) {
      logger.error('Failed to get cache performance stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return { hits: 0, misses: 0, hitRate: 0 };
    }
  }
}

// Export singleton instance
export const searchCacheInvalidationService = new SearchCacheInvalidationService();
