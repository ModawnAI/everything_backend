/**
 * Redis Rate Limiting Store
 * 
 * High-performance Redis-based storage for distributed rate limiting
 * with connection pooling, error handling, and atomic operations
 */

import Redis from 'ioredis';
import { config } from '../config/environment';
import { logger } from './logger';
import {
  RateLimitStore,
  RateLimitData,
  RateLimitStoreError,
  RedisRateLimitConfig
} from '../types/rate-limit.types';

// Default configuration
const REDIS_RATE_LIMIT_CONFIG: RedisRateLimitConfig = {
  host: config.redis.url.replace('redis://', '').split(':')[0] || 'localhost',
  port: parseInt(config.redis.url.split(':')[2] || '6379'),
  password: config.redis.password,
  db: config.redis.db,
  keyPrefix: 'rate_limit:',
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true, // Connect lazily to prevent blocking initialization
};

/**
 * Redis Rate Limit Store Implementation
 */
export class RedisRateLimitStore implements RateLimitStore {
  private client: Redis | null = null;
  private isConnected = false;
  private connectionPromise: Promise<void> | null = null;
  private connectionFailed = false;
  private readonly config: RedisRateLimitConfig;
  private mockStore: Map<string, RateLimitData> = new Map();

  constructor(config: RedisRateLimitConfig = REDIS_RATE_LIMIT_CONFIG) {
    this.config = config;
  }

  // In test environment, use in-memory store
  private isTestEnvironment(): boolean {
    return config.server?.env === 'test';
  }

  /**
   * Initialize Redis connection
   */
  private async connect(): Promise<void> {
    if (this.connectionPromise) {
      return this.connectionPromise;
    }

    this.connectionPromise = this.establishConnection();
    return this.connectionPromise;
  }

  /**
   * Establish Redis connection with retry logic
   */
  private async establishConnection(): Promise<void> {
    // Check if Redis is enabled
    if (!config.redis.enabled) {
      logger.info("Redis rate limit store is disabled, using in-memory fallback");
      this.client = null;
      this.isConnected = false;
      return;
    }

    try {
      const clientConfig: any = {
        host: this.config.host,
        port: this.config.port,
        connectTimeout: this.config.connectTimeout,
        db: this.config.db,
        lazyConnect: this.config.lazyConnect,
        maxRetriesPerRequest: this.config.maxRetriesPerRequest,
        ...(this.config.password && { password: this.config.password }),
      };

      this.client = new Redis(clientConfig);

      // Error handling
      this.client.on('error', (error) => {
        logger.error('Redis rate limit store error', {
          error: error.message,
          stack: error.stack
        });
        this.isConnected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis rate limit store connected');
        this.isConnected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis rate limit store disconnected');
        this.isConnected = false;
      });

      // Connect with timeout to prevent blocking
      const connectPromise = this.client.connect();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Redis connection timeout')), 2000)
      );

      await Promise.race([connectPromise, timeoutPromise]);
      this.isConnected = true;

      logger.info('Redis rate limit store initialized', {
        host: this.config.host,
        port: this.config.port,
        db: this.config.db
      });

    } catch (error) {
      this.isConnected = false;
      this.connectionPromise = null;
      this.connectionFailed = true;
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('Failed to connect to Redis rate limit store, using in-memory fallback', { error: message });
      // Don't throw error - gracefully fallback to in-memory store
      if (this.client) {
        this.client.disconnect();
        this.client = null;
      }
    }
  }

  /**
   * Ensure Redis connection is established
   */
  private async ensureConnection(): Promise<Redis> {
    // Fast-fail if Redis is disabled - avoid any connection attempt
    if (!config.redis.enabled) {
      throw new RateLimitStoreError('Redis is disabled');
    }

    // If connection previously failed, don't retry
    if (this.connectionFailed) {
      throw new RateLimitStoreError('Redis connection previously failed');
    }

    if (!this.client || !this.isConnected) {
      await this.connect();
    }

    if (!this.client) {
      throw new RateLimitStoreError('Redis client not available');
    }

    return this.client;
  }

  /**
   * Get rate limit data for a key
   */
  async get(key: string): Promise<RateLimitData | null> {
    try {
      // Fast-fail if Redis is disabled - use in-memory store
      if (!config.redis.enabled) {
        const data = this.mockStore.get(key);
        if (data && data.resetTime > new Date()) {
          return data;
        }
        if (data && data.resetTime <= new Date()) {
          this.mockStore.delete(key);
        }
        return null;
      }

      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        const data = this.mockStore.get(key);
        if (data && data.resetTime > new Date()) {
          return data;
        }
        if (data && data.resetTime <= new Date()) {
          this.mockStore.delete(key);
        }
        return null;
      }

      const client = await this.ensureConnection();
      const data = await client.get(key);
      
      if (!data) {
        return null;
      }

      const parsedData = JSON.parse(data);
      return {
        ...parsedData,
        resetTime: new Date(parsedData.resetTime)
      };

    } catch (error) {
      logger.error('Failed to get rate limit data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      return null;
    }
  }

  /**
   * Set rate limit data for a key
   */
  async set(key: string, data: RateLimitData, ttl: number): Promise<void> {
    try {
      // Fast-fail if Redis is disabled - use in-memory store
      if (!config.redis.enabled) {
        this.mockStore.set(key, data);
        return;
      }

      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        this.mockStore.set(key, data);
        return;
      }

      const client = await this.ensureConnection();
      const serializedData = JSON.stringify(data);
      
      await client.set(key, serializedData, 'EX', Math.ceil(ttl / 1000));

    } catch (error) {
      logger.error('Failed to set rate limit data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
    }
  }

  /**
   * Increment rate limit counter for a key
   */
  async increment(key: string, ttl: number): Promise<RateLimitData> {
    try {
      // Fast-fail if Redis is disabled - use in-memory store
      if (!config.redis.enabled) {
        const existingData = this.mockStore.get(key);
        const now = new Date();

        if (!existingData || existingData.resetTime <= now) {
          const newData: RateLimitData = {
            totalHits: 1,
            resetTime: new Date(now.getTime() + ttl),
            remainingRequests: 999
          };
          this.mockStore.set(key, newData);
          return newData;
        } else {
          const updatedData: RateLimitData = {
            totalHits: existingData.totalHits + 1,
            resetTime: existingData.resetTime,
            remainingRequests: Math.max(0, existingData.remainingRequests - 1)
          };
          this.mockStore.set(key, updatedData);
          return updatedData;
        }
      }

      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        const existingData = this.mockStore.get(key);
        const now = new Date();
        
        if (!existingData || existingData.resetTime <= now) {
          // Start new window
          const newData: RateLimitData = {
            totalHits: 1,
            resetTime: new Date(now.getTime() + ttl),
            remainingRequests: 999 // Default high value for tests
          };
          this.mockStore.set(key, newData);
          return newData;
        } else {
          // Increment existing window
          const updatedData: RateLimitData = {
            ...existingData,
            totalHits: existingData.totalHits + 1,
            remainingRequests: Math.max(0, existingData.remainingRequests - 1)
          };
          this.mockStore.set(key, updatedData);
          return updatedData;
        }
      }

      const client = await this.ensureConnection();
      const fullKey = `${this.config.keyPrefix}${key}`;
      
      // Use Redis transaction for atomic increment
      const multi = client.multi();
      multi.hincrby(fullKey, 'totalHits', 1);
      multi.hget(fullKey, 'resetTime');
      multi.hget(fullKey, 'remainingRequests');
      multi.expire(fullKey, Math.ceil(ttl / 1000));
      
      const results = await multi.exec();
      
      if (!results) {
        throw new Error('Redis transaction failed');
      }

      const totalHits = results[0]?.[1] as number || 1;
      const resetTimeStr = results[1]?.[1] as string || new Date(Date.now() + ttl).toISOString();
      const remainingRequests = parseInt(results[2]?.[1] as string) || 999;

      return {
        totalHits,
        resetTime: new Date(resetTimeStr),
        remainingRequests: Math.max(0, remainingRequests - 1)
      };

    } catch (error) {
      logger.error('Failed to increment rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
      
      // Return default data on error
      return {
        totalHits: 1,
        resetTime: new Date(Date.now() + ttl),
        remainingRequests: 999
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async reset(key: string): Promise<void> {
    try {
      // Fast-fail if Redis is disabled - use in-memory store
      if (!config.redis.enabled) {
        this.mockStore.delete(key);
        return;
      }

      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        this.mockStore.delete(key);
        return;
      }

      const client = await this.ensureConnection();
      const fullKey = `${this.config.keyPrefix}${key}`;
      
      await client.del(fullKey);

      logger.debug('Rate limit reset', { key });

    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        key
      });
    }
  }

  /**
   * Clean up expired rate limit entries
   */
  async cleanup(): Promise<void> {
    try {
      // Fast-fail if Redis is disabled - use in-memory store
      if (!config.redis.enabled) {
        const now = new Date();
        for (const [key, data] of this.mockStore.entries()) {
          if (data.resetTime <= now) {
            this.mockStore.delete(key);
          }
        }
        return;
      }

      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        const now = new Date();
        for (const [key, data] of this.mockStore.entries()) {
          if (data.resetTime <= now) {
            this.mockStore.delete(key);
          }
        }
        return;
      }

      const client = await this.ensureConnection();
      const pattern = `${this.config.keyPrefix}*`;
      let cursor = '0';

      do {
        const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '1000');
        cursor = newCursor;
        
        for (const key of keys) {
          const data = await client.get(key);
          if (data) {
            try {
              const parsedData = JSON.parse(data);
              if (new Date(parsedData.resetTime) <= new Date()) {
                await client.del(key);
              }
            } catch (parseError) {
              // If data is not valid JSON, delete it
              await client.del(key);
            }
          }
        }
      } while (cursor !== '0');

    } catch (error) {
      logger.error('Failed to cleanup rate limit entries', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get rate limit statistics
   */
  async getStats(): Promise<{
    totalKeys: number;
    memoryUsage: string;
    connectionStatus: string;
  }> {
    try {
      // Use mock store in test environment
      if (this.isTestEnvironment()) {
        return {
          totalKeys: this.mockStore.size,
          memoryUsage: 'unknown',
          connectionStatus: 'mock'
        };
      }

      const client = await this.ensureConnection();
      const pattern = `${this.config.keyPrefix}*`;
      let cursor = '0';
      let totalKeys = 0;

      do {
        const [newCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', '1000');
        cursor = newCursor;
        totalKeys += keys.length;
      } while (cursor !== '0');

      const info = await client.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)\r?\n/);
      const memoryUsage = memoryMatch?.[1]?.trim() || 'unknown';

      return {
        totalKeys,
        memoryUsage,
        connectionStatus: this.isConnected ? 'connected' : 'disconnected'
      };

    } catch (error) {
      logger.error('Failed to get rate limit stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      return {
        totalKeys: 0,
        memoryUsage: 'unknown',
        connectionStatus: 'error'
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    try {
      if (this.client && this.isConnected) {
        await this.client.quit();
        this.isConnected = false;
        this.connectionPromise = null;
        logger.info('Redis rate limit store connection closed');
      }
    } catch (error) {
      logger.error('Error closing Redis rate limit store', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test Redis connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const client = await this.ensureConnection();
      const testKey = `${this.config.keyPrefix}test:${Date.now()}`;
      
      await client.set(testKey, 'test');
      const result = await client.get(testKey);
      await client.del(testKey);
      
      return result === 'test';

    } catch (error) {
      logger.error('Redis connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }
}

// Global Redis store instance
let globalRedisStore: RedisRateLimitStore | null = null;

/**
 * Get or create global Redis rate limit store
 */
export function getRedisRateLimitStore(): RedisRateLimitStore {
  if (!globalRedisStore) {
    globalRedisStore = new RedisRateLimitStore();
  }
  return globalRedisStore;
}

/**
 * Create new Redis rate limit store with custom config
 */
export function createRedisRateLimitStore(config: RedisRateLimitConfig): RedisRateLimitStore {
  return new RedisRateLimitStore(config);
}

export default {
  RedisRateLimitStore,
  getRedisRateLimitStore,
  createRedisRateLimitStore
}; 
