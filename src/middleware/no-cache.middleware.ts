import { Request, Response, NextFunction } from 'express';

/**
 * No-Cache Middleware
 *
 * Disables HTTP caching for all responses to ensure fresh data on every request.
 * This is particularly important for admin endpoints where data freshness is critical.
 *
 * Sets the following headers:
 * - Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
 * - Pragma: no-cache (for HTTP/1.0 compatibility)
 * - Expires: 0 (immediate expiration)
 * - Surrogate-Control: no-store (for CDN/proxy compatibility)
 */
export function noCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent all caching
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store'
  });

  next();
}

/**
 * Admin No-Cache Middleware
 *
 * Specialized version for admin endpoints with additional security headers
 */
export function adminNoCacheMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Prevent all caching
  res.set({
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, private',
    'Pragma': 'no-cache',
    'Expires': '0',
    'Surrogate-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });

  next();
}

export default noCacheMiddleware;
