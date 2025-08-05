/**
 * Rate Limiting Types
 * 
 * Comprehensive type definitions for rate limiting system
 * supporting user-based, endpoint-specific, and distributed rate limiting
 */

import { Request, Response } from 'express';
import { UserRole } from './permissions.types';

// Rate limit strategy types
export type RateLimitStrategy = 'fixed_window' | 'sliding_window' | 'token_bucket' | 'leaky_bucket';

// Rate limit scope types
export type RateLimitScope = 'global' | 'user' | 'ip' | 'endpoint' | 'user_endpoint';

// Rate limit configuration
export interface RateLimitConfig {
  windowMs: number;           // Time window in milliseconds
  max: number;               // Maximum requests per window
  strategy: RateLimitStrategy;
  scope: RateLimitScope;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  enableHeaders?: boolean;
  message?: string | object;
  onLimitReached?: (req: Request, res: Response) => void;
}

// User role-based rate limits
export interface UserRoleLimits {
  [key: string]: RateLimitConfig;
  guest: RateLimitConfig;      // Unauthenticated users
  user: RateLimitConfig;       // Regular authenticated users
  shop_owner: RateLimitConfig; // Shop owners
  influencer: RateLimitConfig; // Influencers
  admin: RateLimitConfig;      // Administrators
}

// Endpoint-specific rate limits
export interface EndpointLimits {
  login: RateLimitConfig;
  register: RateLimitConfig;
  forgot_password: RateLimitConfig;
  verify_email: RateLimitConfig;
  payment_process: RateLimitConfig;
  reservation_create: RateLimitConfig;
  review_create: RateLimitConfig;
  file_upload: RateLimitConfig;
  search: RateLimitConfig;
  analytics: RateLimitConfig;
}

// Rate limit store interface
export interface RateLimitStore {
  get(key: string): Promise<RateLimitData | null>;
  set(key: string, data: RateLimitData, ttl: number): Promise<void>;
  increment(key: string, ttl: number): Promise<RateLimitData>;
  reset(key: string): Promise<void>;
  cleanup(): Promise<void>;
}

// Rate limit data structure
export interface RateLimitData {
  totalHits: number;
  totalTokens?: number;      // For token bucket strategy
  resetTime: Date;
  remainingRequests: number;
}

// Rate limit result
export interface RateLimitResult {
  allowed: boolean;
  totalHits: number;
  remainingRequests: number;
  resetTime: Date;
  retryAfter?: number;       // Seconds until next request allowed
}

// Rate limit middleware options
export interface RateLimitMiddlewareOptions {
  config?: Partial<RateLimitConfig>;
  userLimits?: Partial<UserRoleLimits>;
  endpointLimits?: Partial<EndpointLimits>;
  store?: RateLimitStore;
  onLimitReached?: (req: Request, res: Response, result: RateLimitResult) => void;
  customKeyGenerator?: (req: Request) => string;
  enableBurst?: boolean;      // Allow short bursts above limit
  burstMultiplier?: number;   // Burst limit multiplier
}

// Rate limit headers
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'X-RateLimit-Used': string;
  'Retry-After'?: string;
}

// Redis configuration for rate limiting
export interface RedisRateLimitConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  keyPrefix: string;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  lazyConnect: boolean;
  maxmemoryPolicy?: string;
}

// Rate limit violation event
export interface RateLimitViolation {
  key: string;
  limit: number;
  current: number;
  resetTime: Date;
  ip: string;
  userAgent?: string;
  userId?: string;
  userRole?: UserRole;
  endpoint: string;
  method: string;
  timestamp: Date;
}

// Rate limit metrics
export interface RateLimitMetrics {
  totalRequests: number;
  limitedRequests: number;
  limitationRate: number;
  averageRequestsPerWindow: number;
  peakRequestsPerWindow: number;
  activeUsers: number;
  topViolators: Array<{
    identifier: string;
    violations: number;
    lastViolation: Date;
  }>;
}

// Advanced rate limiting options
export interface AdvancedRateLimitOptions {
  enableAdaptiveLimiting?: boolean;  // Adjust limits based on system load
  enableWhitelist?: boolean;         // IP/user whitelist
  enableBlacklist?: boolean;         // IP/user blacklist
  whitelistKeys?: string[];
  blacklistKeys?: string[];
  enableGeoLimiting?: boolean;       // Different limits by country
  geoLimits?: Record<string, RateLimitConfig>;
  enableTimeBasedLimiting?: boolean; // Different limits by time of day
  timeBasedLimits?: Record<string, RateLimitConfig>;
}

// Rate limit context for advanced features
export interface RateLimitContext {
  req: Request;
  userRole?: UserRole;
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  systemLoad?: number;
  country?: string;
  timeOfDay?: string;
}

// Error types
export class RateLimitError extends Error {
  constructor(
    message: string,
    public statusCode: number = 429,
    public code: string = 'RATE_LIMIT_EXCEEDED',
    public retryAfter?: number,
    public limit?: number,
    public remaining?: number
  ) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class RateLimitStoreError extends Error {
  constructor(message: string, public originalError?: Error) {
    super(message);
    this.name = 'RateLimitStoreError';
  }
}

// Rate limit configuration validation
export interface RateLimitConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

// Rate limit strategy factory
export type RateLimitStrategyFactory = (config: RateLimitConfig) => {
  checkLimit: (key: string, store: RateLimitStore) => Promise<RateLimitResult>;
  resetLimit: (key: string, store: RateLimitStore) => Promise<void>;
}; 