/**
 * Rate Limiter Flexible Service
 * 
 * Integration service for rate-limiter-flexible library with Redis backend
 * Provides high-performance rate limiting with progressive penalties and
 * comprehensive error handling
 */

import { RateLimiterRedis, RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import {
  RateLimitConfig,
  RateLimitResult,
  RateLimitContext,
  RateLimitStrategy,
  RateLimitScope
} from '../types/rate-limit.types';
import { REDIS_RATE_LIMIT_CONFIG } from '../config/rate-limit.config';

/**
 * Rate Limiter Flexible Service
 * Manages multiple rate limiters for different endpoints and strategies
 */
export class RateLimiterFlexibleService {
  private redisClient: Redis | null = null;
  private rateLimiters: Map<string, RateLimiterRedis | RateLimiterMemory> = new Map();
  private isConnected = false;
  private fallbackMode = false;
  private redisErrorLogged = false; // 에러 로그 중복 방지
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    // Check if rate limiting is disabled
    if (process.env.DISABLE_RATE_LIMIT === 'true') {
      this.redisClient = null;
      this.fallbackMode = true;
      return;
    }

    // Check if Redis is enabled
    if (!config.redis.enabled) {
      this.redisClient = null;
      this.fallbackMode = true;
      return;
    }

    try {
      this.redisClient = new Redis({
        host: REDIS_RATE_LIMIT_CONFIG.host,
        port: REDIS_RATE_LIMIT_CONFIG.port,
        password: REDIS_RATE_LIMIT_CONFIG.password,
        db: REDIS_RATE_LIMIT_CONFIG.db,
        maxRetriesPerRequest: 1, // Reduced to minimize blocking
        retryStrategy: (times) => {
          // Stop retrying immediately to prevent blocking
          if (times > 1) {
            return null; // Stop retrying
          }
          return 100; // Wait 100ms once
        },
        connectTimeout: 1000, // Reduced to 1 second
        lazyConnect: true, // Use lazy connect to manually control connection
        keyPrefix: REDIS_RATE_LIMIT_CONFIG.keyPrefix,
        enableOfflineQueue: false, // Don't queue commands when disconnected
        commandTimeout: 500, // 500ms timeout for commands
      });

      this.redisClient.on('error', () => {
        this.isConnected = false;
        this.fallbackMode = true;
      });

      this.redisClient.on('disconnect', () => {
        this.isConnected = false;
        this.fallbackMode = true;
      });

      // Try to connect with timeout
      try {
        await Promise.race([
          this.redisClient.connect(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Connection timeout')), 1000)
          )
        ]);

        // Test connection with ping (also with timeout)
        await Promise.race([
          this.redisClient.ping(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Ping timeout')), 500)
          )
        ]);

        this.isConnected = true;
        this.fallbackMode = false;
      } catch (connectError) {
        this.fallbackMode = true;
        this.isConnected = false;
        if (this.redisClient) {
          try {
            this.redisClient.disconnect();
          } catch (e) {
            // Ignore disconnect errors
          }
          this.redisClient = null;
        }
      }

    } catch (error) {
      this.fallbackMode = true;
      this.isConnected = false;
      // Close the failed client
      if (this.redisClient) {
        this.redisClient.disconnect();
        this.redisClient = null;
      }
    }
  }

  /**
   * Check if Redis is actually ready for commands
   */
  private isRedisReady(): boolean {
    if (this.fallbackMode || !this.isConnected || !this.redisClient) {
      return false;
    }
    // Only use Redis when status is 'ready'
    const status = this.redisClient.status;
    return status === 'ready';
  }

  /**
   * Get or create rate limiter for a specific configuration
   */
  private getRateLimiter(config: RateLimitConfig, context: RateLimitContext): RateLimiterRedis | RateLimiterMemory {
    const key = this.generateLimiterKey(config, context);
    const useRedis = this.isRedisReady();

    // If we have a cached limiter, check if it's still valid
    if (this.rateLimiters.has(key)) {
      const cached = this.rateLimiters.get(key)!;
      const isRedisBased = cached instanceof RateLimiterRedis;

      // If Redis is not ready but we have a Redis limiter, create a new memory limiter
      if (!useRedis && isRedisBased) {
        const limiterConfig = this.mapConfigToRateLimiterFlexible(config, context);
        const memoryLimiter = new RateLimiterMemory(limiterConfig);
        this.rateLimiters.set(key, memoryLimiter);
        return memoryLimiter;
      }

      return cached;
    }

    const limiterConfig = this.mapConfigToRateLimiterFlexible(config, context);

    let limiter: RateLimiterRedis | RateLimiterMemory;

    // Use memory-based limiter unless Redis is confirmed ready
    if (!useRedis) {
      limiter = new RateLimiterMemory(limiterConfig);
    } else {
      // Use Redis-based limiter only when confirmed ready
      limiter = new RateLimiterRedis({
        ...limiterConfig,
        storeClient: this.redisClient!,
        keyPrefix: REDIS_RATE_LIMIT_CONFIG.keyPrefix
      });
    }

    this.rateLimiters.set(key, limiter);
    return limiter;
  }

  /**
   * Map our configuration to rate-limiter-flexible format
   */
  private mapConfigToRateLimiterFlexible(config: RateLimitConfig, context: RateLimitContext) {
    const baseConfig = {
      keyPrefix: this.generateKeyPrefix(config, context),
      points: config.max,
      duration: Math.floor(config.windowMs / 1000), // Convert to seconds
      blockDuration: this.calculateBlockDuration(config),
      execEvenly: config.strategy === 'sliding_window',
      useRedisPackage: true
    };

    // Add strategy-specific configurations
    switch (config.strategy) {
      case 'token_bucket':
        return {
          ...baseConfig,
          execEvenly: false,
          useRedisPackage: true
        };
      case 'fixed_window':
        return {
          ...baseConfig,
          execEvenly: false,
          useRedisPackage: true
        };
      case 'sliding_window':
      default:
        return {
          ...baseConfig,
          execEvenly: true,
          useRedisPackage: true
        };
    }
  }

  /**
   * Calculate block duration based on violation severity
   */
  private calculateBlockDuration(config: RateLimitConfig): number {
    // Progressive penalties: 1x, 2x, 4x, 8x window duration
    const baseDuration = Math.floor(config.windowMs / 1000);
    return baseDuration * 2; // 2x window duration as block time
  }

  /**
   * Generate unique key for rate limiter instance
   */
  private generateLimiterKey(config: RateLimitConfig, context: RateLimitContext): string {
    return `${config.strategy}_${config.scope}_${config.max}_${config.windowMs}`;
  }

  /**
   * Generate key prefix for rate limiter
   */
  private generateKeyPrefix(config: RateLimitConfig, context: RateLimitContext): string {
    const { userRole, userId, ip, endpoint } = context;
    
    switch (config.scope) {
      case 'user':
        return `user:${userId || ip}`;
      case 'ip':
        return `ip:${ip}`;
      case 'endpoint':
        return `endpoint:${endpoint}`;
      case 'user_endpoint':
        return `user_endpoint:${userId || ip}:${endpoint}`;
      case 'global':
      default:
        return `global:${endpoint}`;
    }
  }

  /**
   * Check rate limit for a request
   */
  async checkRateLimit(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      // 초기화 완료 대기
      if (this.initPromise) {
        await this.initPromise;
      }

      const limiter = this.getRateLimiter(config, context);
      const key = this.generateKeyPrefix(config, context);

      const result = await limiter.consume(key);

      return this.mapRateLimiterResult(result, config);

    } catch (error) {
      // RateLimiterRes rejection (limit exceeded)인 경우 정상 처리
      if (error && typeof error === 'object' && 'remainingPoints' in error) {
        return this.mapRateLimiterResult(error as RateLimiterRes, config);
      }

      // Graceful degradation - allow request if rate limiting fails
      return {
        allowed: true,
        totalHits: 0,
        remainingRequests: 999,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  /**
   * Map rate-limiter-flexible result to our format
   */
  private mapRateLimiterResult(result: RateLimiterRes, config: RateLimitConfig): RateLimitResult {
    const now = new Date();
    const resetTime = new Date(now.getTime() + (result.msBeforeNext || config.windowMs));
    
    return {
      allowed: result.remainingPoints >= 0,
      totalHits: config.max - result.remainingPoints,
      remainingRequests: Math.max(0, result.remainingPoints),
      resetTime,
      retryAfter: result.remainingPoints < 0 ? Math.ceil((result.msBeforeNext || 0) / 1000) : undefined
    };
  }

  /**
   * Get rate limit status without consuming points
   */
  async getRateLimitStatus(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<RateLimitResult> {
    try {
      const limiter = this.getRateLimiter(config, context);
      const key = this.generateKeyPrefix(config, context);
      
      const result = await limiter.get(key);
      
      if (!result) {
        return {
          allowed: true,
          totalHits: 0,
          remainingRequests: config.max,
          resetTime: new Date(Date.now() + config.windowMs)
        };
      }

      return this.mapRateLimiterResult(result, config);

    } catch (error) {
      return {
        allowed: true,
        totalHits: 0,
        remainingRequests: 999,
        resetTime: new Date(Date.now() + config.windowMs)
      };
    }
  }

  /**
   * Reset rate limit for a key
   */
  async resetRateLimit(
    context: RateLimitContext,
    config: RateLimitConfig
  ): Promise<boolean> {
    try {
      const limiter = this.getRateLimiter(config, context);
      const key = this.generateKeyPrefix(config, context);
      
      await limiter.delete(key);
      return true;

    } catch (error) {
      return false;
    }
  }

  /**
   * Penalize user for violations (progressive penalties)
   */
  async penalizeUser(
    context: RateLimitContext,
    config: RateLimitConfig,
    penaltyMultiplier: number = 2
  ): Promise<void> {
    try {
      const limiter = this.getRateLimiter(config, context);
      const key = this.generateKeyPrefix(config, context);
      
      // Add penalty points
      const penaltyPoints = Math.floor(config.max * penaltyMultiplier);
      await limiter.penalty(key, penaltyPoints);

    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Get service statistics
   */
  async getStats(): Promise<{
    totalLimiters: number;
    isConnected: boolean;
    fallbackMode: boolean;
    redisStatus: string;
  }> {
    return {
      totalLimiters: this.rateLimiters.size,
      isConnected: this.isConnected,
      fallbackMode: this.fallbackMode,
      redisStatus: this.isConnected ? 'connected' : 'disconnected'
    };
  }

  /**
   * Clean up resources
   */
  async cleanup(): Promise<void> {
    try {
      // Clear all rate limiters
      this.rateLimiters.clear();
      
      // Close Redis connection
      if (this.redisClient) {
        await this.redisClient.quit();
        this.redisClient = null;
      }
      
      this.isConnected = false;
      this.fallbackMode = false;

    } catch (error) {
      // Silently fail
    }
  }

  /**
   * Test Redis connection
   */
  async testConnection(): Promise<boolean> {
    try {
      if (!this.redisClient) {
        return false;
      }

      const result = await this.redisClient.ping();
      return result === 'PONG';

    } catch (error) {
      return false;
    }
  }
}

// Global service instance
let globalRateLimiterService: RateLimiterFlexibleService | null = null;

/**
 * Get or create global rate limiter service
 */
export function getRateLimiterFlexibleService(): RateLimiterFlexibleService {
  if (!globalRateLimiterService) {
    globalRateLimiterService = new RateLimiterFlexibleService();
  }
  return globalRateLimiterService;
}

/**
 * Create new rate limiter service instance
 */
export function createRateLimiterFlexibleService(): RateLimiterFlexibleService {
  return new RateLimiterFlexibleService();
}

export default {
  RateLimiterFlexibleService,
  getRateLimiterFlexibleService,
  createRateLimiterFlexibleService
};
