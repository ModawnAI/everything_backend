/**
 * Query Result Caching Service
 *
 * High-performance caching layer for database queries
 * - Redis-based distributed caching
 * - Automatic cache invalidation
 * - TTL-based expiration
 * - Cache key namespacing
 * - Graceful fallback to database
 */

import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  namespace?: string; // Cache key namespace
  tags?: string[]; // Tags for grouped invalidation
  version?: string; // Cache version for invalidation
}

export interface CacheStats {
  hits: number;
  misses: number;
  hitRate: number;
  keys: number;
}

/**
 * Query Cache Service
 * Provides distributed caching for database query results
 */
export class QueryCacheService {
  private redis: Redis | null = null;
  private isEnabled = false;
  private stats = {
    hits: 0,
    misses: 0,
  };

  // Cache TTL presets (in seconds)
  private readonly TTL_PRESETS = {
    SHORT: 300, // 5 minutes
    MEDIUM: 1800, // 30 minutes
    LONG: 3600, // 1 hour
    VERY_LONG: 86400, // 24 hours
  };

  // Default cache namespaces
  private readonly NAMESPACES = {
    SHOP: 'shop',
    USER: 'user',
    RESERVATION: 'reservation',
    PAYMENT: 'payment',
    SERVICE: 'service',
    ANALYTICS: 'analytics',
    FAVORITES: 'favorites',
  };

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection for caching
   */
  private async initializeRedis(): Promise<void> {
    // Check if caching is disabled
    if (process.env.DISABLE_QUERY_CACHE === 'true') {
      logger.info('Query caching is disabled');
      return;
    }

    // Check if Redis is enabled
    if (!config.redis.enabled) {
      logger.info('Redis is disabled, query caching unavailable');
      return;
    }

    try {
      // Parse Redis URL or use individual config
      const redisOptions: any = {
        password: config.redis.password || undefined,
        db: config.redis.db,
        maxRetriesPerRequest: 2,
        retryStrategy: (times) => {
          if (times > 2) {
            logger.error('Redis query cache connection failed after retries');
            return null;
          }
          return Math.min(times * 100, 500);
        },
        connectTimeout: 2000,
        lazyConnect: false,
        keyPrefix: 'qc:', // Query cache prefix
        enableOfflineQueue: false,
      };

      // Use URL if provided, otherwise fall back to localhost
      this.redis = config.redis.url
        ? new Redis(config.redis.url, redisOptions)
        : new Redis(redisOptions);

      this.redis.on('error', (error) => {
        logger.error('Redis query cache error', { error: error.message });
        this.isEnabled = false;
      });

      this.redis.on('connect', () => {
        logger.info('Redis query cache connected');
        this.isEnabled = true;
      });

      this.redis.on('disconnect', () => {
        logger.warn('Redis query cache disconnected');
        this.isEnabled = false;
      });
    } catch (error) {
      logger.error('Failed to initialize Redis query cache', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Get cached query result or execute query and cache it
   */
  async getCachedQuery<T>(
    key: string,
    queryFn: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    const {
      ttl = this.TTL_PRESETS.MEDIUM,
      namespace = '',
      version = '1',
    } = options;

    const fullKey = this.buildCacheKey(key, namespace, version);

    // Try to get from cache
    const cached = await this.get<T>(fullKey);
    if (cached !== null) {
      this.stats.hits++;
      return cached;
    }

    // Cache miss - execute query
    this.stats.misses++;
    const result = await queryFn();

    // Cache the result (fire and forget)
    this.set(fullKey, result, ttl).catch((error) => {
      logger.warn('Failed to cache query result', {
        key: fullKey,
        error: error.message,
      });
    });

    return result;
  }

  /**
   * Get value from cache
   */
  private async get<T>(key: string): Promise<T | null> {
    if (!this.isEnabled || !this.redis) {
      return null;
    }

    try {
      const value = await this.redis.get(key);
      if (!value) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error) {
      logger.error('Cache get error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  private async set<T>(key: string, value: T, ttl: number): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);
      await this.redis.setex(key, ttl, serialized);
    } catch (error) {
      logger.error('Cache set error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete specific cache key
   */
  async invalidate(key: string, namespace = ''): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      const fullKey = namespace ? `${namespace}:${key}` : key;
      await this.redis.del(fullKey);
      logger.debug('Cache invalidated', { key: fullKey });
    } catch (error) {
      logger.error('Cache invalidation error', {
        key,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Delete all cache keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      logger.info('[CACHE] invalidatePattern skipped - cache not enabled', { pattern, isEnabled: this.isEnabled, hasRedis: !!this.redis });
      return;
    }

    try {
      logger.info('[CACHE] invalidatePattern called', { pattern });
      const keys = await this.redis.keys(pattern);
      logger.info('[CACHE] Found keys to invalidate', { pattern, keysFound: keys.length, keys: keys.slice(0, 5) }); // Log first 5 keys
      if (keys.length > 0) {
        // ioredis keyPrefix 이중 적용 문제 해결:
        // - keys() 결과에는 keyPrefix('qc:')가 포함되어 반환됨
        // - del()에 전달 시 keyPrefix가 다시 추가되어 'qc:qc:...' 가 됨
        // - 따라서 keys 결과에서 keyPrefix를 제거한 후 del 호출
        const keyPrefix = 'qc:';
        const keysWithoutPrefix = keys.map(key =>
          key.startsWith(keyPrefix) ? key.slice(keyPrefix.length) : key
        );
        logger.info('[CACHE] Keys after removing prefix for del', {
          originalKeys: keys.slice(0, 3),
          keysWithoutPrefix: keysWithoutPrefix.slice(0, 3)
        });
        await this.redis.del(...keysWithoutPrefix);
        logger.info('[CACHE] Cache pattern invalidated successfully', { pattern, count: keys.length });
      } else {
        logger.info('[CACHE] No keys found for pattern', { pattern });
      }
    } catch (error) {
      logger.error('[CACHE] Cache pattern invalidation error', {
        pattern,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Invalidate all cache keys in a namespace
   */
  async invalidateNamespace(namespace: string): Promise<void> {
    await this.invalidatePattern(`${namespace}:*`);
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.isEnabled || !this.redis) {
      return;
    }

    try {
      await this.redis.flushdb();
      logger.info('Query cache cleared');
    } catch (error) {
      logger.error('Cache clear error', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Build full cache key with namespace and version
   */
  private buildCacheKey(key: string, namespace: string, version: string): string {
    const parts = [];
    if (namespace) parts.push(namespace);
    if (version) parts.push(`v${version}`);
    parts.push(key);
    return parts.join(':');
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: parseFloat(hitRate.toFixed(2)),
      keys: 0, // TODO: Implement key counting if needed
    };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats.hits = 0;
    this.stats.misses = 0;
  }

  /**
   * Check if caching is enabled
   */
  isReady(): boolean {
    return this.isEnabled;
  }

  /**
   * Get TTL presets
   */
  getTTLPresets() {
    return { ...this.TTL_PRESETS };
  }

  /**
   * Get namespace constants
   */
  getNamespaces() {
    return { ...this.NAMESPACES };
  }

  /**
   * Gracefully close Redis connection
   */
  async disconnect(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      logger.info('Redis query cache disconnected');
    }
  }
}

// Export singleton instance
export const queryCacheService = new QueryCacheService();

// Export for testing
export default QueryCacheService;
