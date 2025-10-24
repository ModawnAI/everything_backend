/**
 * Feed Rate Limiting Middleware
 *
 * Standardized rate limiting configuration for feed operations
 * Used by both /api/feed and /api/user/feed routes
 */

import rateLimit from 'express-rate-limit';

/**
 * Rate limiter for post creation
 * Prevents spam by limiting posts to 5 per hour per user
 */
export const createPostLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,  // 1 hour window
  max: 5,                     // 5 posts per hour
  message: 'Too many posts created. Please try again later.',
  standardHeaders: true,      // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false,       // Disable `X-RateLimit-*` headers
  skipSuccessfulRequests: false,
  skipFailedRequests: true,   // Don't count failed requests
  keyGenerator: (req) => {
    // Use user ID for authenticated users, IP for anonymous
    return (req as any).user?.id || req.ip || 'anonymous';
  }
});

/**
 * Rate limiter for interactions (likes, comments)
 * Allows more frequent interactions but still prevents abuse
 */
export const interactionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,   // 5 minute window
  max: 100,                   // 100 interactions per 5 minutes
  message: 'Too many interactions. Please slow down.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true,
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip || 'anonymous';
  }
});

/**
 * General rate limiter for feed read operations
 * Prevents excessive requests to feed endpoints
 */
export const generalFeedLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minute window
  max: 200,                   // 200 requests per 15 minutes
  message: 'Too many requests. Please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: false,
  skipFailedRequests: true,
  keyGenerator: (req) => {
    return (req as any).user?.id || req.ip || 'anonymous';
  }
});
