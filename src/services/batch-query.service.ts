/**
 * Batch Query Service
 *
 * Eliminates N+1 query problems by batching database operations
 * - Batch loading of related entities
 * - DataLoader-style request coalescing
 * - Automatic query deduplication
 * - Efficient bulk operations
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { queryCacheService } from './query-cache.service';

/**
 * Batch Query Service
 * Provides utilities to batch database queries and prevent N+1 problems
 */
export class BatchQueryService {
  private supabase = getSupabaseClient();

  /**
   * Batch get shops by IDs
   * Returns a Map for O(1) lookups
   */
  async batchGetShops(shopIds: string[]): Promise<Map<string, any>> {
    if (shopIds.length === 0) {
      return new Map();
    }

    // Deduplicate IDs
    const uniqueIds = [...new Set(shopIds)];

    // Try cache first
    const cacheKey = `batch:shops:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('shops')
          .select('*')
          .in('id', uniqueIds);

        if (error) {
          logger.error('Batch get shops failed', { error: error.message, shopIds: uniqueIds });
          throw new Error(`Failed to batch get shops: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'shop',
        ttl: 1800, // 30 minutes
      }
    );

    // Convert to Map for fast lookup
    return new Map(cached.map((shop) => [shop.id, shop]));
  }

  /**
   * Batch get users by IDs
   */
  async batchGetUsers(userIds: string[]): Promise<Map<string, any>> {
    if (userIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(userIds)];

    const cacheKey = `batch:users:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('users')
          .select('id, email, name, nickname, profile_image_url, user_status')
          .in('id', uniqueIds);

        if (error) {
          logger.error('Batch get users failed', { error: error.message });
          throw new Error(`Failed to batch get users: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'user',
        ttl: 900, // 15 minutes
      }
    );

    return new Map(cached.map((user) => [user.id, user]));
  }

  /**
   * Batch check if shops are favorited by a user
   * Returns Set of favorited shop IDs
   */
  async batchCheckFavorites(userId: string, shopIds: string[]): Promise<Set<string>> {
    if (shopIds.length === 0) {
      return new Set();
    }

    const uniqueIds = [...new Set(shopIds)];

    const cacheKey = `favorites:${userId}:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('user_favorites')
          .select('shop_id')
          .eq('user_id', userId)
          .in('shop_id', uniqueIds);

        if (error) {
          logger.error('Batch check favorites failed', { error: error.message });
          throw new Error(`Failed to batch check favorites: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'favorites',
        ttl: 300, // 5 minutes
      }
    );

    return new Set(cached.map((fav) => fav.shop_id));
  }

  /**
   * Batch get shop services by shop IDs
   * Returns Map<shopId, services[]>
   */
  async batchGetShopServices(shopIds: string[]): Promise<Map<string, any[]>> {
    if (shopIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(shopIds)];

    const cacheKey = `batch:services:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('shop_services')
          .select('*')
          .in('shop_id', uniqueIds)
          .eq('is_available', true);

        if (error) {
          logger.error('Batch get shop services failed', { error: error.message });
          throw new Error(`Failed to batch get shop services: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'service',
        ttl: 1800, // 30 minutes
      }
    );

    // Group services by shop_id
    const servicesMap = new Map<string, any[]>();
    for (const service of cached) {
      const shopId = service.shop_id;
      if (!servicesMap.has(shopId)) {
        servicesMap.set(shopId, []);
      }
      servicesMap.get(shopId)!.push(service);
    }

    return servicesMap;
  }

  /**
   * Batch get reservations by IDs
   */
  async batchGetReservations(reservationIds: string[]): Promise<Map<string, any>> {
    if (reservationIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(reservationIds)];

    const cacheKey = `batch:reservations:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('reservations')
          .select('*')
          .in('id', uniqueIds);

        if (error) {
          logger.error('Batch get reservations failed', { error: error.message });
          throw new Error(`Failed to batch get reservations: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'reservation',
        ttl: 600, // 10 minutes
      }
    );

    return new Map(cached.map((res) => [res.id, res]));
  }

  /**
   * Batch get payments by reservation IDs
   * Returns Map<reservationId, payment>
   */
  async batchGetPaymentsByReservationIds(reservationIds: string[]): Promise<Map<string, any>> {
    if (reservationIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(reservationIds)];

    const cacheKey = `batch:payments:reservations:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('payments')
          .select('*')
          .in('reservation_id', uniqueIds);

        if (error) {
          logger.error('Batch get payments by reservations failed', { error: error.message });
          throw new Error(`Failed to batch get payments: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'payment',
        ttl: 300, // 5 minutes
      }
    );

    return new Map(cached.map((payment) => [payment.reservation_id, payment]));
  }

  /**
   * Batch get service images by service IDs
   * Returns Map<serviceId, images[]>
   */
  async batchGetServiceImages(serviceIds: string[]): Promise<Map<string, any[]>> {
    if (serviceIds.length === 0) {
      return new Map();
    }

    const uniqueIds = [...new Set(serviceIds)];

    const cacheKey = `batch:images:${uniqueIds.sort().join(',')}`;
    const cached = await queryCacheService.getCachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await this.supabase
          .from('service_images')
          .select('*')
          .in('service_id', uniqueIds)
          .order('display_order', { ascending: true });

        if (error) {
          logger.error('Batch get service images failed', { error: error.message });
          throw new Error(`Failed to batch get service images: ${error.message}`);
        }

        return data || [];
      },
      {
        namespace: 'service',
        ttl: 3600, // 1 hour (images change rarely)
      }
    );

    // Group images by service_id
    const imagesMap = new Map<string, any[]>();
    for (const image of cached) {
      const serviceId = image.service_id;
      if (!imagesMap.has(serviceId)) {
        imagesMap.set(serviceId, []);
      }
      imagesMap.get(serviceId)!.push(image);
    }

    return imagesMap;
  }

  /**
   * Batch insert operations with error handling
   */
  async batchInsert<T>(table: string, records: T[]): Promise<{ success: T[]; failed: Array<{ record: T; error: string }> }> {
    if (records.length === 0) {
      return { success: [], failed: [] };
    }

    try {
      const { data, error } = await this.supabase.from(table).insert(records).select();

      if (error) {
        logger.error('Batch insert failed', {
          table,
          count: records.length,
          error: error.message,
        });

        // Return all as failed
        return {
          success: [],
          failed: records.map((record) => ({
            record,
            error: error.message,
          })),
        };
      }

      return {
        success: (data || []) as T[],
        failed: [],
      };
    } catch (error) {
      logger.error('Batch insert exception', {
        table,
        count: records.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return {
        success: [],
        failed: records.map((record) => ({
          record,
          error: error instanceof Error ? error.message : 'Unknown error',
        })),
      };
    }
  }

  /**
   * Batch update operations
   */
  async batchUpdate<T extends { id: string }>(
    table: string,
    records: T[]
  ): Promise<{ success: number; failed: number }> {
    if (records.length === 0) {
      return { success: 0, failed: 0 };
    }

    let successCount = 0;
    let failedCount = 0;

    // Update each record individually (Supabase doesn't support bulk updates with different values)
    for (const record of records) {
      try {
        const { id, ...updates } = record;
        const { error } = await this.supabase.from(table).update(updates).eq('id', id);

        if (error) {
          failedCount++;
          logger.warn('Batch update single record failed', {
            table,
            id,
            error: error.message,
          });
        } else {
          successCount++;
        }
      } catch (error) {
        failedCount++;
        logger.error('Batch update exception', {
          table,
          id: record.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    logger.info('Batch update completed', { table, success: successCount, failed: failedCount });

    return { success: successCount, failed: failedCount };
  }

  /**
   * Batch delete by IDs
   */
  async batchDelete(table: string, ids: string[]): Promise<{ success: boolean; deletedCount: number }> {
    if (ids.length === 0) {
      return { success: true, deletedCount: 0 };
    }

    try {
      const { error, count } = await this.supabase.from(table).delete().in('id', ids);

      if (error) {
        logger.error('Batch delete failed', {
          table,
          count: ids.length,
          error: error.message,
        });
        return { success: false, deletedCount: 0 };
      }

      return { success: true, deletedCount: count || 0 };
    } catch (error) {
      logger.error('Batch delete exception', {
        table,
        count: ids.length,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return { success: false, deletedCount: 0 };
    }
  }
}

// Export singleton instance
export const batchQueryService = new BatchQueryService();

// Export for testing
export default BatchQueryService;
