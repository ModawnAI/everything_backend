/**
 * Rate Limiting Configuration
 * 
 * Comprehensive rate limiting setup for the beauty service platform
 * with user role-based limits, endpoint-specific controls, and Redis backend
 */

import { config } from './environment';
import {
  RateLimitConfig,
  UserRoleLimits,
  EndpointLimits,
  RedisRateLimitConfig,
  RateLimitStrategy,
  RateLimitScope
} from '../types/rate-limit.types';

/**
 * Default Rate Limiting Strategy
 */
export const DEFAULT_STRATEGY: RateLimitStrategy = 'sliding_window';

/**
 * Rate Limit Time Windows (in milliseconds)
 */
export const TIME_WINDOWS = {
  ONE_MINUTE: 60 * 1000,
  FIVE_MINUTES: 5 * 60 * 1000,
  FIFTEEN_MINUTES: 15 * 60 * 1000,
  ONE_HOUR: 60 * 60 * 1000,
  ONE_DAY: 24 * 60 * 60 * 1000
} as const;

/**
 * Base Rate Limit Configuration Template
 */
const createBaseConfig = (
  max: number,
  windowMs: number = TIME_WINDOWS.FIFTEEN_MINUTES,
  strategy: RateLimitStrategy = DEFAULT_STRATEGY,
  scope: RateLimitScope = 'user'
): RateLimitConfig => ({
  max,
  windowMs,
  strategy,
  scope,
  enableHeaders: true,
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
  message: {
    error: 'Too many requests',
    code: 'RATE_LIMIT_EXCEEDED',
    retryAfter: Math.ceil(windowMs / 1000)
  }
});

/**
 * User Role-Based Rate Limits
 * Progressive limits based on user trust and subscription level
 */
export const USER_ROLE_LIMITS: UserRoleLimits = {
  // Guest users (unauthenticated) - most restrictive
  guest: createBaseConfig(
    50,  // 50 requests per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'ip'
  ),

  // Regular authenticated users - standard limits
  user: createBaseConfig(
    200, // 200 requests per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'user'
  ),

  // Shop owners - higher limits for business operations
  shop_owner: createBaseConfig(
    500, // 500 requests per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'user'
  ),

  // Influencers - enhanced limits for content creation
  influencer: createBaseConfig(
    400, // 400 requests per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'user'
  ),

  // Administrators - highest limits
  admin: createBaseConfig(
    1000, // 1000 requests per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'user'
  )
};

/**
 * Endpoint-Specific Rate Limits
 * Stricter limits for sensitive operations
 */
export const ENDPOINT_LIMITS: EndpointLimits = {
  // Authentication endpoints - strict limits to prevent brute force
  login: createBaseConfig(
    5,   // 5 login attempts per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'fixed_window',
    'ip'
  ),

  register: createBaseConfig(
    3,   // 3 registration attempts per hour
    TIME_WINDOWS.ONE_HOUR,
    'fixed_window',
    'ip'
  ),

  forgot_password: createBaseConfig(
    3,   // 3 password reset requests per hour
    TIME_WINDOWS.ONE_HOUR,
    'fixed_window',
    'ip'
  ),

  verify_email: createBaseConfig(
    10,  // 10 verification attempts per hour
    TIME_WINDOWS.ONE_HOUR,
    'fixed_window',
    'user'
  ),

  // Payment operations - strict limits for financial security
  payment_process: createBaseConfig(
    10,  // 10 payment attempts per hour
    TIME_WINDOWS.ONE_HOUR,
    'sliding_window',
    'user'
  ),

  // Reservation system - prevent booking spam
  reservation_create: createBaseConfig(
    20,  // 20 reservation attempts per hour
    TIME_WINDOWS.ONE_HOUR,
    'sliding_window',
    'user'
  ),

  // Review system - prevent review spam
  review_create: createBaseConfig(
    5,   // 5 reviews per hour
    TIME_WINDOWS.ONE_HOUR,
    'sliding_window',
    'user'
  ),

  // File upload - prevent resource abuse
  file_upload: createBaseConfig(
    20,  // 20 file uploads per hour
    TIME_WINDOWS.ONE_HOUR,
    'token_bucket',
    'user'
  ),

  // Search operations - prevent scraping
  search: createBaseConfig(
    100, // 100 searches per 15 minutes
    TIME_WINDOWS.FIFTEEN_MINUTES,
    'sliding_window',
    'user'
  ),

  // Analytics - prevent data mining
  analytics: createBaseConfig(
    50,  // 50 analytics requests per hour
    TIME_WINDOWS.ONE_HOUR,
    'sliding_window',
    'user'
  )
};

/**
 * Redis Configuration for Rate Limiting
 */
export const REDIS_RATE_LIMIT_CONFIG: RedisRateLimitConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  ...(process.env.REDIS_PASSWORD && { password: process.env.REDIS_PASSWORD }),
  db: parseInt(process.env.REDIS_RATE_LIMIT_DB || '1'), // Separate DB for rate limiting
  keyPrefix: 'rl:', // Rate limit key prefix
  maxRetriesPerRequest: 3,
  connectTimeout: 5000,
  lazyConnect: true,
  maxmemoryPolicy: 'allkeys-lru'
};

/**
 * Burst Rate Limits
 * Allow short bursts for better user experience
 */
export const BURST_LIMITS = {
  MULTIPLIER: 2,     // 2x normal limit for burst
  DURATION: 60000,   // 1 minute burst window
  ENABLED: true
};

/**
 * Rate Limit Messages
 */
export const RATE_LIMIT_MESSAGES = {
  GENERIC: {
    error: 'Too many requests. Please try again later.',
    code: 'RATE_LIMIT_EXCEEDED'
  },
  LOGIN: {
    error: 'Too many login attempts. Please try again in 15 minutes.',
    code: 'LOGIN_RATE_LIMIT_EXCEEDED'
  },
  PAYMENT: {
    error: 'Too many payment attempts. Please try again in an hour.',
    code: 'PAYMENT_RATE_LIMIT_EXCEEDED'
  },
  REGISTRATION: {
    error: 'Too many registration attempts. Please try again in an hour.',
    code: 'REGISTRATION_RATE_LIMIT_EXCEEDED'
  },
  FILE_UPLOAD: {
    error: 'Too many file uploads. Please try again in an hour.',
    code: 'UPLOAD_RATE_LIMIT_EXCEEDED'
  }
};

/**
 * Whitelist Configuration
 * IPs and users that bypass rate limiting
 */
export const RATE_LIMIT_WHITELIST = {
  IPS: process.env.RATE_LIMIT_WHITELIST_IPS?.split(',') || [],
  USER_IDS: process.env.RATE_LIMIT_WHITELIST_USERS?.split(',') || [],
  ENABLED: process.env.RATE_LIMIT_WHITELIST_ENABLED === 'true'
};

/**
 * Blacklist Configuration
 * IPs and users with stricter limits
 */
export const RATE_LIMIT_BLACKLIST = {
  IPS: process.env.RATE_LIMIT_BLACKLIST_IPS?.split(',') || [],
  USER_IDS: process.env.RATE_LIMIT_BLACKLIST_USERS?.split(',') || [],
  ENABLED: process.env.RATE_LIMIT_BLACKLIST_ENABLED === 'true',
  PENALTY_MULTIPLIER: 0.1 // 10x stricter limits
};

/**
 * Adaptive Rate Limiting Configuration
 */
export const ADAPTIVE_RATE_LIMITING = {
  ENABLED: process.env.ADAPTIVE_RATE_LIMITING === 'true',
  CPU_THRESHOLD: 70,    // Reduce limits when CPU > 70%
  MEMORY_THRESHOLD: 80, // Reduce limits when memory > 80%
  REDUCTION_FACTOR: 0.5 // Reduce limits by 50% under load
};

/**
 * Rate Limit Headers Configuration
 */
export const RATE_LIMIT_HEADERS = {
  LIMIT: 'X-RateLimit-Limit',
  REMAINING: 'X-RateLimit-Remaining',
  RESET: 'X-RateLimit-Reset',
  USED: 'X-RateLimit-Used',
  RETRY_AFTER: 'Retry-After'
};

/**
 * Get rate limit configuration for a specific user role
 */
export function getRoleLimitConfig(role: string): RateLimitConfig {
  return USER_ROLE_LIMITS[role] || USER_ROLE_LIMITS.guest;
}

/**
 * Get rate limit configuration for a specific endpoint
 */
export function getEndpointLimitConfig(endpoint: string): RateLimitConfig | null {
  return ENDPOINT_LIMITS[endpoint as keyof EndpointLimits] || null;
}

/**
 * Check if IP is whitelisted
 */
export function isWhitelistedIP(ip: string): boolean {
  return RATE_LIMIT_WHITELIST.ENABLED && RATE_LIMIT_WHITELIST.IPS.includes(ip);
}

/**
 * Check if user is whitelisted
 */
export function isWhitelistedUser(userId: string): boolean {
  return RATE_LIMIT_WHITELIST.ENABLED && RATE_LIMIT_WHITELIST.USER_IDS.includes(userId);
}

/**
 * Check if IP is blacklisted
 */
export function isBlacklistedIP(ip: string): boolean {
  return RATE_LIMIT_BLACKLIST.ENABLED && RATE_LIMIT_BLACKLIST.IPS.includes(ip);
}

/**
 * Check if user is blacklisted
 */
export function isBlacklistedUser(userId: string): boolean {
  return RATE_LIMIT_BLACKLIST.ENABLED && RATE_LIMIT_BLACKLIST.USER_IDS.includes(userId);
}

/**
 * Apply blacklist penalty to rate limit
 */
export function applyBlacklistPenalty(config: RateLimitConfig): RateLimitConfig {
  return {
    ...config,
    max: Math.floor(config.max * RATE_LIMIT_BLACKLIST.PENALTY_MULTIPLIER)
  };
}

/**
 * Apply adaptive rate limiting based on system load
 */
export function applyAdaptiveRateLimit(
  config: RateLimitConfig,
  cpuUsage: number,
  memoryUsage: number
): RateLimitConfig {
  if (!ADAPTIVE_RATE_LIMITING.ENABLED) {
    return config;
  }

  if (cpuUsage > ADAPTIVE_RATE_LIMITING.CPU_THRESHOLD || 
      memoryUsage > ADAPTIVE_RATE_LIMITING.MEMORY_THRESHOLD) {
    return {
      ...config,
      max: Math.floor(config.max * ADAPTIVE_RATE_LIMITING.REDUCTION_FACTOR)
    };
  }

  return config;
}

/**
 * Generate rate limit key for Redis storage
 */
export function generateRateLimitKey(
  prefix: string,
  identifier: string,
  endpoint?: string
): string {
  const base = `${REDIS_RATE_LIMIT_CONFIG.keyPrefix}${prefix}:${identifier}`;
  return endpoint ? `${base}:${endpoint}` : base;
}

export default {
  USER_ROLE_LIMITS,
  ENDPOINT_LIMITS,
  REDIS_RATE_LIMIT_CONFIG,
  BURST_LIMITS,
  RATE_LIMIT_MESSAGES,
  RATE_LIMIT_WHITELIST,
  RATE_LIMIT_BLACKLIST,
  ADAPTIVE_RATE_LIMITING,
  RATE_LIMIT_HEADERS,
  getRoleLimitConfig,
  getEndpointLimitConfig,
  isWhitelistedIP,
  isWhitelistedUser,
  isBlacklistedIP,
  isBlacklistedUser,
  applyBlacklistPenalty,
  applyAdaptiveRateLimit,
  generateRateLimitKey
}; 