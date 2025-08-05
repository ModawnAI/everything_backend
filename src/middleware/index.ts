/**
 * Middleware Index
 * 
 * Central export point for all middleware functions
 */

// Authentication middleware
export {
  authenticateJWT,
  optionalAuth,
  requireRole,
  requireVerification,
  extractTokenFromHeader,
  verifySupabaseToken,
  getUserFromToken,
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
  UserNotFoundError,
  default as authMiddleware
} from './auth.middleware';
export type { AuthenticatedRequest } from './auth.middleware';

// RBAC middleware
export {
  requirePermission,
  requireAnyPermission,
  requireResourceOwnership,
  requireShopOwnership,
  requireAdmin,
  PermissionService,
  permissionService,
  default as rbacMiddleware
} from './rbac.middleware';

// Rate limiting middleware
export {
  rateLimit,
  endpointRateLimit,
  roleBasedRateLimit,
  strictRateLimit,
  loginRateLimit,
  paymentRateLimit,
  uploadRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  rateLimitService,
  default as rateLimitMiddleware
} from './rate-limit.middleware';

// Security headers middleware
export {
  securityHeaders,
  strictSecurityHeaders,
  apiSecurityHeaders,
  developmentSecurityHeaders,
  validateSecurityHeaders,
  securityMetrics,
  cspViolationHandler,
  SecurityHeadersService,
  default as securityMiddleware
} from './security.middleware';

// Validation middleware
export {
  validateRequestBody,
  validateQueryParams,
  validateHeaders,
  customValidation,
  RequestValidationError
} from './validation.middleware';

// Re-export for backward compatibility
export * as auth from './auth.middleware';
export * as rbac from './rbac.middleware';
export * as security from './security.middleware';
