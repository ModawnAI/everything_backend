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

  constructor() {
    this.initializeRedis();
  }

  /**
   * Initialize Redis connection
   */
  private async initializeRedis(): Promise<void> {
    // Check if Redis is enabled
    if (!config.redis.enabled) {
      logger.info("Redis rate limiter is disabled, using in-memory fallback");
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
        maxRetriesPerRequest: REDIS_RATE_LIMIT_CONFIG.maxRetriesPerRequest,
        connectTimeout: REDIS_RATE_LIMIT_CONFIG.connectTimeout,
        lazyConnect: REDIS_RATE_LIMIT_CONFIG.lazyConnect,
        keyPrefix: REDIS_RATE_LIMIT_CONFIG.keyPrefix
      });

      this.redisClient.on('error', (error) => {
        logger.error('Redis rate limiter connection error', {
          error: error.message,
          stack: error.stack
        });
        this.isConnected = false;
        this.fallbackMode = true;
      });

      this.redisClient.on('connect', () => {
        logger.info('Redis rate limiter connected');
        this.isConnected = true;
        this.fallbackMode = false;
      });

      this.redisClient.on('disconnect', () => {
        logger.warn('Redis rate limiter disconnected');
        this.isConnected = false;
        this.fallbackMode = true;
      });

      // Test connection
      await this.redisClient.ping();
      this.isConnected = true;

    } catch (error) {
      logger.error('Failed to initialize Redis for rate limiting', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      this.fallbackMode = true;
    }
  }

  /**
   * Get or create rate limiter for a specific configuration
   */
  private getRateLimiter(config: RateLimitConfig, context: RateLimitContext): RateLimiterRedis | RateLimiterMemory {
    const key = this.generateLimiterKey(config, context);
    
    if (this.rateLimiters.has(key)) {
      return this.rateLimiters.get(key)!;
    }

    const limiterConfig = this.mapConfigToRateLimiterFlexible(config, context);
    
    let limiter: RateLimiterRedis | RateLimiterMemory;
    
    if (this.fallbackMode || !this.isConnected) {
      // Use memory-based limiter as fallback
      limiter = new RateLimiterMemory(limiterConfig);
      logger.warn('Using memory-based rate limiter due to Redis unavailability', { key });
    } else {
      // Use Redis-based limiter
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
      const limiter = this.getRateLimiter(config, context);
      const key = this.generateKeyPrefix(config, context);
      
      const result = await limiter.consume(key);
      
      return this.mapRateLimiterResult(result, config);

    } catch (error) {
      logger.error('Rate limit check failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context,
        config
      });

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
      logger.error('Failed to get rate limit status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });

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
      
      logger.info('Rate limit reset', { key, context });
      return true;

    } catch (error) {
      logger.error('Failed to reset rate limit', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
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
      
      logger.warn('User penalized for rate limit violations', {
        key,
        penaltyPoints,
        context
      });

    } catch (error) {
      logger.error('Failed to penalize user', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
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
      
      logger.info('Rate limiter flexible service cleaned up');

    } catch (error) {
      logger.error('Error during rate limiter cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
      logger.error('Redis connection test failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
