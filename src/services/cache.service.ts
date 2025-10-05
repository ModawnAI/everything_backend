import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

// =============================================
// CACHE TYPES
// =============================================

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string; // Cache key prefix
  tags?: string[]; // Cache tags for invalidation
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags?: string[];
}

export interface CacheStats {
  hits: number;
  misses: number;
  keys: number;
  memory: number;
  hitRate: number;
}

export interface CacheKey {
  prefix: string;
  key: string;
  tags?: string[];
}

// =============================================
// CACHE SERVICE
// =============================================

export class CacheService {
  private client: Redis | null = null;
  private readonly defaultTTL = 3600; // 1 hour
  private readonly defaultPrefix = 'cache';
  private stats = {
    hits: 0,
    misses: 0,
  };

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    // Check if Redis is enabled
    if (!config.redis.enabled) {
      logger.info("Redis cache service is disabled");
      this.client = null;
      return;
    }

    try {
      const redisUrl = config.redis.url;
      const redisConfig: any = {
        host: redisUrl.replace('redis://', '').split(':')[0] || 'localhost',
        port: parseInt(redisUrl.split(':')[2] || '6379'),
        db: config.redis.db,
        retryDelayOnFailover: 100,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
        keepAlive: 30000,
        connectTimeout: 10000,
        commandTimeout: 5000,
      };

      if (config.redis.password) {
        redisConfig.password = config.redis.password;
      }

      this.client = new Redis(redisConfig);

      this.client.on('connect', () => {
        logger.info('Redis cache service connected');
      });

      this.client.on('error', (error) => {
        logger.error('Redis cache service error', { error: error.message });
      });

      this.client.on('close', () => {
        logger.warn('Redis cache service disconnected');
      });

      await this.client.connect();
      logger.info('Redis cache service initialized');
    } catch (error) {
      logger.error('Failed to initialize Redis cache service', { error: (error as Error).message });
      this.client = null;
    }
  }

  /**
   * Generate cache key
   */
  private generateKey(key: string, prefix?: string): string {
    const keyPrefix = prefix || this.defaultPrefix;
    return `${keyPrefix}:${key}`;
  }

  /**
   * Set cache entry
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {}
  ): Promise<void> {
    if (!this.client) {
      logger.warn('Redis cache not available, skipping cache set');
      return;
    }

    try {
      const { ttl = this.defaultTTL, prefix, tags = [] } = options;
      const cacheKey = this.generateKey(key, prefix);
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        ttl,
        tags,
      };

      const serialized = JSON.stringify(entry);
      await this.client.setex(cacheKey, ttl, serialized);

      // Store tags for invalidation
      if (tags.length > 0) {
        await this.storeTags(cacheKey, tags);
      }

      logger.debug('Cache set', { key: cacheKey, ttl, tags });
    } catch (error) {
      logger.error('Cache set failed', { key, error: (error as Error).message });
    }
  }

  /**
   * Get cache entry
   */
  async get<T>(key: string, prefix?: string): Promise<T | null> {
    if (!this.client) {
      logger.warn('Redis cache not available, skipping cache get');
      return null;
    }

    try {
      const cacheKey = this.generateKey(key, prefix);
      const serialized = await this.client.get(cacheKey);

      if (!serialized) {
        this.stats.misses++;
        return null;
      }

      const entry: CacheEntry<T> = JSON.parse(serialized);
      const now = Date.now();

      // Check if entry is expired
      if (now - entry.timestamp > entry.ttl * 1000) {
        await this.client.del(cacheKey);
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      logger.debug('Cache hit', { key: cacheKey });
      return entry.data;
    } catch (error) {
      logger.error('Cache get failed', { key, error: (error as Error).message });
      this.stats.misses++;
      return null;
    }
  }

  /**
   * Delete cache entry
   */
  async delete(key: string, prefix?: string): Promise<void> {
    if (!this.client) {
      logger.warn('Redis cache not available, skipping cache delete');
      return;
    }

    try {
      const cacheKey = this.generateKey(key, prefix);
      await this.client.del(cacheKey);
      await this.removeTags(cacheKey);

      logger.debug('Cache deleted', { key: cacheKey });
    } catch (error) {
      logger.error('Cache delete failed', { key, error: (error as Error).message });
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    if (!this.client) {
      logger.warn('Redis cache not available, skipping cache invalidation');
      return;
    }

    try {
      const keysToDelete: string[] = [];

      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        const keys = await this.client.smembers(tagKey);
        keysToDelete.push(...keys);
        await this.client.del(tagKey);
      }

      if (keysToDelete.length > 0) {
        await this.client.del(...keysToDelete);
        logger.info('Cache invalidated by tags', { tags, keysDeleted: keysToDelete.length });
      }
    } catch (error) {
      logger.error('Cache invalidation failed', { tags, error: (error as Error).message });
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    if (!this.client) {
      logger.warn('Redis cache not available, skipping cache clear');
      return;
    }

    try {
      const keys = await this.client.keys(`${this.defaultPrefix}:*`);
      if (keys.length > 0) {
        await this.client.del(...keys);
      }

      // Clear tag sets
      const tagKeys = await this.client.keys('tags:*');
      if (tagKeys.length > 0) {
        await this.client.del(...tagKeys);
      }

      logger.info('Cache cleared', { keysDeleted: keys.length });
    } catch (error) {
      logger.error('Cache clear failed', { error: (error as Error).message });
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<CacheStats> {
    if (!this.client) {
      return {
        hits: 0,
        misses: 0,
        keys: 0,
        memory: 0,
        hitRate: 0,
      };
    }

    try {
      const keys = await this.client.keys(`${this.defaultPrefix}:*`);
      const info = await this.client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(\d+)/);
      const memory = memoryMatch ? parseInt(memoryMatch[1] || '0') : 0;

      const total = this.stats.hits + this.stats.misses;
      const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;

      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: keys.length,
        memory,
        hitRate,
      };
    } catch (error) {
      logger.error('Failed to get cache stats', { error: (error as Error).message });
      return {
        hits: this.stats.hits,
        misses: this.stats.misses,
        keys: 0,
        memory: 0,
        hitRate: 0,
      };
    }
  }

  /**
   * Store cache tags
   */
  private async storeTags(cacheKey: string, tags: string[]): Promise<void> {
    if (!this.client) return;

    try {
      for (const tag of tags) {
        const tagKey = `tags:${tag}`;
        await this.client.sadd(tagKey, cacheKey);
        await this.client.expire(tagKey, this.defaultTTL);
      }
    } catch (error) {
      logger.error('Failed to store cache tags', { cacheKey, tags, error: (error as Error).message });
    }
  }

  /**
   * Remove cache tags
   */
  private async removeTags(cacheKey: string): Promise<void> {
    if (!this.client) return;

    try {
      const tagKeys = await this.client.keys('tags:*');
      for (const tagKey of tagKeys) {
        await this.client.srem(tagKey, cacheKey);
      }
    } catch (error) {
      logger.error('Failed to remove cache tags', { cacheKey, error: (error as Error).message });
    }
  }

  /**
   * Acquire distributed lock
   */
  async acquireLock(key: string, ttl: number = 30): Promise<string | null> {
    if (!this.client) return null;

    try {
      const lockKey = `lock:${key}`;
      const lockValue = `${Date.now()}-${Math.random()}`;
      
      const result = await this.client.set(lockKey, lockValue, 'PX', ttl * 1000, 'NX');
      
      if (result === 'OK') {
        return lockValue;
      }
      
      return null;
    } catch (error) {
      logger.error('Failed to acquire lock', { key, error: (error as Error).message });
      return null;
    }
  }

  /**
   * Release distributed lock
   */
  async releaseLock(key: string, lockValue: string): Promise<boolean> {
    if (!this.client) return false;

    try {
      const lockKey = `lock:${key}`;
      const script = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
          return redis.call("del", KEYS[1])
        else
          return 0
        end
      `;
      
      const result = await this.client.eval(script, 1, lockKey, lockValue);
      return result === 1;
    } catch (error) {
      logger.error('Failed to release lock', { key, error: (error as Error).message });
      return false;
    }
  }

  /**
   * Cache warming for frequently accessed data
   */
  async warmCache<T>(
    key: string,
    dataProvider: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<void> {
    try {
      const data = await dataProvider();
      await this.set(key, data, options);
      logger.info('Cache warmed', { key });
    } catch (error) {
      logger.error('Cache warming failed', { key, error: (error as Error).message });
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      logger.info('Redis cache service connection closed');
    }
  }
}

// =============================================
// CACHE MIDDLEWARE
// =============================================

export function cacheMiddleware(options: CacheOptions = {}) {
  return async (req: any, res: any, next: any) => {
    const cacheKey = `${req.method}:${req.originalUrl}`;
    const cacheService = new CacheService();

    try {
      // Try to get from cache
      const cached = await cacheService.get(cacheKey, 'api');
      
      if (cached) {
        return res.json(cached);
      }

      // Store original send method
      const originalSend = res.json;

      // Override send method to cache response
      res.json = function(data: any) {
        cacheService.set(cacheKey, data, { ...options, prefix: 'api' });
        return originalSend.call(this, data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error: (error as Error).message });
      next();
    }
  };
}

// Global cache service instance
export const cacheService = new CacheService(); 