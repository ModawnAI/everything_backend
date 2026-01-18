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
      return;
    }

    // Check if Redis is enabled
    if (!config.redis.enabled) {
      return;
    }

    try {
      // Parse Redis URL or use individual config
      const redisOptions: any = {
        password: config.redis.password || undefined,
        db: config.redis.db,
        maxRetriesPerRequest: 1,    // 2 → 1: 빠른 fallback
        retryStrategy: (times) => {
          if (times > 1) {
            return null;
          }
          return 100;
        },
        connectTimeout: 1000,       // 2000 → 1000: 1초 타임아웃
        lazyConnect: false,
        keyPrefix: 'qc:', // Query cache prefix
        enableOfflineQueue: false,
        commandTimeout: 500,        // 500ms 명령 타임아웃 추가
      };

      // Use URL if provided, otherwise fall back to localhost
      this.redis = config.redis.url
        ? new Redis(config.redis.url, redisOptions)
        : new Redis(redisOptions);

      this.redis.on('error', () => {
        this.isEnabled = false;
      });

      this.redis.on('connect', () => {
        this.isEnabled = true;
      });

      this.redis.on('disconnect', () => {
        this.isEnabled = false;
      });
    } catch (error) {
      // Silently fail - cache is not critical
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
    this.set(fullKey, result, ttl).catch(() => {});

    return result;
  }

  /**
   * Check if Redis is actually ready for commands
   */
  private isRedisReady(): boolean {
    if (!this.isEnabled || !this.redis) {
      return false;
    }
    // Only allow commands when Redis is in 'ready' state
    // Other states like 'reconnecting', 'connecting' can cause blocking
    const status = this.redis.status;
    return status === 'ready';
  }

  /**
   * Get value from cache with timeout
   */
  private async get<T>(key: string): Promise<T | null> {
    // Strict check: only proceed if Redis is actually ready
    if (!this.isRedisReady()) {
      return null;
    }

    try {
      // Add 500ms timeout to prevent blocking (reduced from 2s for faster fallback)
      const timeoutPromise = new Promise<null>((resolve) => {
        setTimeout(() => resolve(null), 500);
      });

      const getPromise = this.redis!.get(key).then(value => {
        if (!value) return null;
        return JSON.parse(value) as T;
      });

      const result = await Promise.race([getPromise, timeoutPromise]);
      return result;
    } catch (error) {
      return null;
    }
  }

  /**
   * Set value in cache with timeout (fire and forget with safety)
   */
  private async set<T>(key: string, value: T, ttl: number): Promise<void> {
    // Strict check: only proceed if Redis is actually ready
    if (!this.isRedisReady()) {
      return;
    }

    try {
      const serialized = JSON.stringify(value);

      // Add 500ms timeout to prevent blocking (reduced from 2s for faster fallback)
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      const setPromise = this.redis!.setex(key, ttl, serialized).then(() => {});

      await Promise.race([setPromise, timeoutPromise]);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Delete specific cache key
   */
  async invalidate(key: string, namespace = ''): Promise<void> {
    // Strict check: only proceed if Redis is actually ready
    if (!this.isRedisReady()) {
      return;
    }

    try {
      const fullKey = namespace ? `${namespace}:${key}` : key;

      // Add timeout to prevent blocking
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      const delPromise = this.redis!.del(fullKey).then(() => {});
      await Promise.race([delPromise, timeoutPromise]);
    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Delete all cache keys matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<void> {
    // Strict check: only proceed if Redis is actually ready
    if (!this.isRedisReady()) {
      return;
    }

    try {
      const fullPattern = `qc:${pattern}`;

      // Add timeout to prevent blocking
      const timeoutPromise = new Promise<string[]>((resolve) => {
        setTimeout(() => resolve([]), 500);
      });

      const keysPromise = this.redis!.call('KEYS', fullPattern) as Promise<string[]>;
      const keysRaw = await Promise.race([keysPromise, timeoutPromise]);

      if (keysRaw && keysRaw.length > 0) {
        // Add timeout for DEL command
        const delTimeoutPromise = new Promise<void>((resolve) => {
          setTimeout(() => resolve(), 500);
        });

        const delPromise = (this.redis!.call('DEL', ...keysRaw) as Promise<number>).then(() => {});
        await Promise.race([delPromise, delTimeoutPromise]);
      }
    } catch (error) {
      // Silently fail
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
    // Strict check: only proceed if Redis is actually ready
    if (!this.isRedisReady()) {
      return;
    }

    try {
      // Add timeout to prevent blocking
      const timeoutPromise = new Promise<void>((resolve) => {
        setTimeout(() => resolve(), 500);
      });

      const flushPromise = this.redis!.flushdb().then(() => {});
      await Promise.race([flushPromise, timeoutPromise]);
    } catch (error) {
      // Silently fail
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
   * Check if caching is enabled and Redis is ready
   */
  isReady(): boolean {
    return this.isRedisReady();
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
    }
  }
}

// Export singleton instance
export const queryCacheService = new QueryCacheService();

// Export for testing
export default QueryCacheService;
