/**
 * Feed Ranking Cache Service
 *
 * Implements intelligent caching strategies for expensive feed ranking calculations.
 * Supports multiple cache layers, TTL management, cache warming, and invalidation.
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';
import { feedRankingPerformanceMonitor } from './feed-ranking-performance';

export interface CacheOptions {
  ttl?: number;          // Time to live in seconds
  prefix?: string;       // Cache key prefix
  enableWarming?: boolean; // Whether to warm cache proactively
}

export interface CacheStats {
  totalHits: number;
  totalMisses: number;
  hitRate: number;
  avgGetTime: number;
  avgSetTime: number;
  totalKeys: number;
  memoryUsed: string;
}

export class FeedRankingCacheService {
  private redis: RedisClientType;
  private connected: boolean = false;
  private stats = {
    hits: 0,
    misses: 0,
    getTimes: [] as number[],
    setTimes: [] as number[]
  };

  // Default TTLs for different data types
  private readonly DEFAULT_TTLS = {
    userPreferences: 60 * 60,      // 1 hour
    contentMetrics: 30 * 60,       // 30 minutes
    feedRankings: 15 * 60,         // 15 minutes
    trendingContent: 10 * 60,      // 10 minutes
    analyticsData: 5 * 60,         // 5 minutes
    userFeed: 5 * 60               // 5 minutes (user-specific feed)
  };

  constructor() {
    this.redis = createClient({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      socket: {
        connectTimeout: 5000,
        reconnectStrategy: (retries) => {
          if (retries > 10) {
            logger.error('Redis reconnection failed after 10 attempts');
            return new Error('Max reconnection attempts reached');
          }
          return Math.min(retries * 100, 3000);
        }
      }
    }) as RedisClientType;

    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    try {
      this.redis.on('error', (err) => {
        logger.error('Redis connection error', { error: err });
        this.connected = false;
      });

      this.redis.on('connect', () => {
        logger.info('Redis connected for feed ranking cache');
        this.connected = true;
      });

      await this.redis.connect();
    } catch (error) {
      logger.error('Failed to initialize Redis for feed ranking', { error });
      this.connected = false;
    }
  }

  /**
   * Get cached data with performance tracking
   */
  async get<T>(key: string, options?: CacheOptions): Promise<T | null> {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping cache get');
      return null;
    }

    const startTime = Date.now();

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const cached = await this.redis.get(fullKey);

      const getTime = Date.now() - startTime;
      this.stats.getTimes.push(getTime);

      if (cached) {
        this.stats.hits++;
        logger.debug('Cache hit', { key: fullKey, getTime: `${getTime}ms` });
        return JSON.parse(cached) as T;
      } else {
        this.stats.misses++;
        logger.debug('Cache miss', { key: fullKey, getTime: `${getTime}ms` });
        return null;
      }
    } catch (error) {
      logger.error('Cache get error', { error, key });
      return null;
    }
  }

  /**
   * Set cached data with automatic TTL and performance tracking
   */
  async set<T>(key: string, value: T, options?: CacheOptions): Promise<void> {
    if (!this.connected) {
      logger.warn('Redis not connected, skipping cache set');
      return;
    }

    const startTime = Date.now();

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const ttl = options?.ttl || this.DEFAULT_TTLS.feedRankings;

      await this.redis.setEx(fullKey, ttl, JSON.stringify(value));

      const setTime = Date.now() - startTime;
      this.stats.setTimes.push(setTime);

      logger.debug('Cache set', {
        key: fullKey,
        ttl: `${ttl}s`,
        setTime: `${setTime}ms`
      });
    } catch (error) {
      logger.error('Cache set error', { error, key });
    }
  }

  /**
   * Delete cached entry
   */
  async delete(key: string, options?: CacheOptions): Promise<void> {
    if (!this.connected) return;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      await this.redis.del(fullKey);
      logger.debug('Cache deleted', { key: fullKey });
    } catch (error) {
      logger.error('Cache delete error', { error, key });
    }
  }

  /**
   * Delete multiple cached entries by pattern
   */
  async deletePattern(pattern: string): Promise<number> {
    if (!this.connected) return 0;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length === 0) return 0;

      await this.redis.del(keys);
      logger.info('Cache pattern deleted', { pattern, count: keys.length });
      return keys.length;
    } catch (error) {
      logger.error('Cache pattern delete error', { error, pattern });
      return 0;
    }
  }

  /**
   * Get or set with automatic caching (cache-aside pattern)
   */
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    options?: CacheOptions
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key, options);

    if (cached !== null) {
      return cached;
    }

    // Cache miss - fetch data and cache it
    return await feedRankingPerformanceMonitor.trackExecution(
      `getOrSet:${key}`,
      async () => {
        const data = await fetchFn();
        await this.set(key, data, options);
        return data;
      },
      false // Not a cache hit
    );
  }

  /**
   * Warm cache by pre-loading frequently accessed data
   */
  async warmCache(userId: string): Promise<void> {
    if (!this.connected) return;

    logger.info('Starting cache warming for user', { userId });

    // This would be called in background jobs or during low-traffic periods
    // Implementation depends on your specific warming strategy
    try {
      // Example: Pre-calculate and cache user feed
      // await this.warmUserFeed(userId);

      // Example: Pre-cache trending content
      // await this.warmTrendingContent();

      logger.info('Cache warming completed', { userId });
    } catch (error) {
      logger.error('Cache warming failed', { error, userId });
    }
  }

  /**
   * Invalidate user-specific caches
   */
  async invalidateUserCache(userId: string): Promise<void> {
    const patterns = [
      `feed:user:${userId}:*`,
      `analytics:user:${userId}:*`,
      `preferences:user:${userId}:*`
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const count = await this.deletePattern(pattern);
      totalDeleted += count;
    }

    logger.info('User cache invalidated', { userId, totalDeleted });
  }

  /**
   * Invalidate global caches (e.g., trending content)
   */
  async invalidateGlobalCache(): Promise<void> {
    const patterns = [
      'trending:*',
      'global:feed:*'
    ];

    let totalDeleted = 0;
    for (const pattern of patterns) {
      const count = await this.deletePattern(pattern);
      totalDeleted += count;
    }

    logger.info('Global cache invalidated', { totalDeleted });
  }

  /**
   * Build full cache key with prefix
   */
  private buildKey(key: string, prefix?: string): string {
    const actualPrefix = prefix || 'feed';
    return `${actualPrefix}:${key}`;
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? this.stats.hits / (this.stats.hits + this.stats.misses)
      : 0;

    const avgGetTime = this.stats.getTimes.length > 0
      ? this.stats.getTimes.reduce((a, b) => a + b, 0) / this.stats.getTimes.length
      : 0;

    const avgSetTime = this.stats.setTimes.length > 0
      ? this.stats.setTimes.reduce((a, b) => a + b, 0) / this.stats.setTimes.length
      : 0;

    let totalKeys = 0;
    let memoryUsed = 'N/A';

    if (this.connected) {
      try {
        const keys = await this.redis.keys('feed:*');
        totalKeys = keys.length;

        const info = await this.redis.info('memory');
        const match = info.match(/used_memory_human:(.*)/);
        if (match) {
          memoryUsed = match[1].trim();
        }
      } catch (error) {
        logger.error('Failed to get cache stats', { error });
      }
    }

    return {
      totalHits: this.stats.hits,
      totalMisses: this.stats.misses,
      hitRate,
      avgGetTime,
      avgSetTime,
      totalKeys,
      memoryUsed
    };
  }

  /**
   * Reset statistics (useful for testing or monitoring resets)
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      getTimes: [],
      setTimes: []
    };
    logger.info('Cache statistics reset');
  }

  /**
   * Check if Redis is connected
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Gracefully close Redis connection
   */
  async close(): Promise<void> {
    if (this.connected) {
      await this.redis.quit();
      this.connected = false;
      logger.info('Redis connection closed for feed ranking cache');
    }
  }

  /**
   * Batch get multiple keys
   */
  async mget<T>(keys: string[], options?: CacheOptions): Promise<(T | null)[]> {
    if (!this.connected || keys.length === 0) {
      return keys.map(() => null);
    }

    try {
      const fullKeys = keys.map(k => this.buildKey(k, options?.prefix));
      const results = await this.redis.mGet(fullKeys);

      return results.map((result, index) => {
        if (result) {
          this.stats.hits++;
          return JSON.parse(result) as T;
        } else {
          this.stats.misses++;
          return null;
        }
      });
    } catch (error) {
      logger.error('Batch cache get error', { error, keyCount: keys.length });
      return keys.map(() => null);
    }
  }

  /**
   * Batch set multiple keys
   */
  async mset<T>(entries: Array<{ key: string; value: T }>, options?: CacheOptions): Promise<void> {
    if (!this.connected || entries.length === 0) return;

    try {
      const ttl = options?.ttl || this.DEFAULT_TTLS.feedRankings;

      // Redis mset doesn't support TTL, so we do individual sets with pipelining
      const pipeline = this.redis.multi();

      for (const entry of entries) {
        const fullKey = this.buildKey(entry.key, options?.prefix);
        pipeline.setEx(fullKey, ttl, JSON.stringify(entry.value));
      }

      await pipeline.exec();

      logger.debug('Batch cache set completed', { count: entries.length, ttl: `${ttl}s` });
    } catch (error) {
      logger.error('Batch cache set error', { error, entryCount: entries.length });
    }
  }

  /**
   * Get cache key TTL (time remaining)
   */
  async getTTL(key: string, options?: CacheOptions): Promise<number> {
    if (!this.connected) return -1;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      return await this.redis.ttl(fullKey);
    } catch (error) {
      logger.error('Get TTL error', { error, key });
      return -1;
    }
  }

  /**
   * Extend TTL for existing key
   */
  async extendTTL(key: string, additionalSeconds: number, options?: CacheOptions): Promise<void> {
    if (!this.connected) return;

    try {
      const fullKey = this.buildKey(key, options?.prefix);
      const currentTTL = await this.redis.ttl(fullKey);

      if (currentTTL > 0) {
        await this.redis.expire(fullKey, currentTTL + additionalSeconds);
        logger.debug('TTL extended', { key: fullKey, additionalSeconds });
      }
    } catch (error) {
      logger.error('Extend TTL error', { error, key });
    }
  }
}

// Singleton instance
export const feedRankingCache = new FeedRankingCacheService();
