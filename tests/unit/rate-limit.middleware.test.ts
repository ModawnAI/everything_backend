import { Request, Response, NextFunction } from 'express';
import {
  rateLimit,
  endpointRateLimit,
  loginRateLimit,
  paymentRateLimit,
  strictRateLimit,
  getRateLimitStatus,
  resetRateLimit,
  rateLimitService
} from '../../src/middleware/rate-limit.middleware';
import { AuthenticatedRequest } from '../../src/middleware/auth.middleware';
import {
  USER_ROLE_LIMITS,
  ENDPOINT_LIMITS,
  getRoleLimitConfig,
  getEndpointLimitConfig
} from '../../src/config/rate-limit.config';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('../../src/utils/redis-rate-limit-store', () => {
  const mockStore = {
    get: jest.fn(),
    set: jest.fn(),
    increment: jest.fn(),
    reset: jest.fn(),
    cleanup: jest.fn()
  };

  return {
    getRedisRateLimitStore: jest.fn(() => mockStore),
    RedisRateLimitStore: jest.fn(() => mockStore)
  };
});

describe('Rate Limiting Middleware Tests', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockStore: any;

  beforeEach(() => {
    mockRequest = {
      ip: '127.0.0.1',
      path: '/api/test',
      method: 'GET',
      route: { path: '/api/test' },
      get: jest.fn((header: string) => {
        if (header === 'User-Agent') return 'test-user-agent';
        return undefined;
      }),
      connection: {
        remoteAddress: '127.0.0.1'
      } as any
    };
    
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();

    // Reset mocks
    jest.clearAllMocks();
    
    // Setup store mock
    const { getRedisRateLimitStore } = require('../../src/utils/redis-rate-limit-store');
    mockStore = getRedisRateLimitStore();
  });

  describe('Rate Limit Configuration', () => {
    test('should have user role limits defined', () => {
      expect(USER_ROLE_LIMITS.guest).toBeDefined();
      expect(USER_ROLE_LIMITS.user).toBeDefined();
      expect(USER_ROLE_LIMITS.shop_owner).toBeDefined();
      expect(USER_ROLE_LIMITS.influencer).toBeDefined();
      expect(USER_ROLE_LIMITS.admin).toBeDefined();
    });

    test('should have endpoint-specific limits', () => {
      expect(ENDPOINT_LIMITS.login).toBeDefined();
      expect(ENDPOINT_LIMITS.payment_process).toBeDefined();
      expect(ENDPOINT_LIMITS.file_upload).toBeDefined();
    });

    test('should have progressive limits by role', () => {
      const guestLimit = getRoleLimitConfig('guest').max;
      const userLimit = getRoleLimitConfig('user').max;
      const shopOwnerLimit = getRoleLimitConfig('shop_owner').max;
      const adminLimit = getRoleLimitConfig('admin').max;

      expect(userLimit).toBeGreaterThan(guestLimit);
      expect(shopOwnerLimit).toBeGreaterThan(userLimit);
      expect(adminLimit).toBeGreaterThan(shopOwnerLimit);
    });

    test('should have stricter limits for sensitive endpoints', () => {
      const generalLimit = getRoleLimitConfig('user').max;
      const loginLimit = getEndpointLimitConfig('login')?.max || 0;
      const paymentLimit = getEndpointLimitConfig('payment_process')?.max || 0;

      expect(loginLimit).toBeLessThan(generalLimit);
      expect(paymentLimit).toBeLessThan(generalLimit);
    });
  });

  describe('Basic Rate Limiting Middleware', () => {
    test('should allow requests within limit', async () => {
      // Mock Redis to return data within limits
      mockStore.get.mockResolvedValue(null); // New window
      mockStore.set.mockResolvedValue(undefined);

      const middleware = rateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(429);
    });

    test('should block requests over limit', async () => {
      // Mock Redis to return data over limits
      mockStore.get.mockResolvedValue({
        totalHits: 1000,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 1001,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });

      const middleware = rateLimit({
        config: { max: 10, windowMs: 900000, strategy: 'sliding_window', scope: 'ip' }
      });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.objectContaining({
            limit: expect.any(Number),
            remaining: expect.any(Number)
          })
        })
      );
    });

    test('should set rate limit headers', async () => {
      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      const middleware = rateLimit({
        config: { 
          max: 100, 
          windowMs: 900000, 
          strategy: 'sliding_window', 
          scope: 'ip',
          enableHeaders: true
        }
      });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Limit', '100');
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Remaining', expect.any(String));
      expect(mockResponse.set).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(String));
    });

    test('should use role-based limits for authenticated users', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'admin',
        status: 'active'
      };

      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      const middleware = rateLimit();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Redis error'));

      const middleware = rateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should allow request on Redis failure (graceful degradation)
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    test('should apply login rate limits', async () => {
      mockStore.get.mockResolvedValue({
        totalHits: 5,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 6,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });

      const middleware = loginRateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });

    test('should apply payment rate limits with enhanced logging', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active'
      };

      mockStore.get.mockResolvedValue({
        totalHits: 10,
        resetTime: new Date(Date.now() + 3600000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 11,
        resetTime: new Date(Date.now() + 3600000),
        remainingRequests: 0
      });

      const middleware = paymentRateLimit();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(429);
      
      const { logger } = require('../../src/utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Payment rate limit exceeded - potential abuse',
        expect.objectContaining({
          ip: '127.0.0.1',
          userId: 'user-123'
        })
      );
    });

    test('should use endpoint-specific configuration', async () => {
      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      const middleware = endpointRateLimit('login');
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Strict Rate Limiting', () => {
    test('should apply strict limits', async () => {
      mockStore.get.mockResolvedValue({
        totalHits: 3,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 4,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });

      const middleware = strictRateLimit(3); // 3 requests max
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).not.toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(429);
    });
  });

  describe('Rate Limit Service', () => {
    test('should check rate limits correctly', async () => {
      const context = {
        req: mockRequest as Request,
        ip: '127.0.0.1',
        endpoint: '/api/test',
        method: 'GET'
      };

      const config = {
        max: 10,
        windowMs: 900000,
        strategy: 'sliding_window' as const,
        scope: 'ip' as const
      };

      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(1);
      expect(result.remainingRequests).toBe(9);
    });

    test('should handle new window correctly', async () => {
      const context = {
        req: mockRequest as Request,
        ip: '127.0.0.1',
        endpoint: '/api/test',
        method: 'GET'
      };

      const config = {
        max: 5,
        windowMs: 900000,
        strategy: 'sliding_window' as const,
        scope: 'ip' as const
      };

      mockStore.get.mockResolvedValue(null); // No previous data
      mockStore.set.mockResolvedValue(undefined);

      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(1);
      expect(mockStore.set).toHaveBeenCalled();
    });

    test('should handle existing window correctly', async () => {
      const context = {
        req: mockRequest as Request,
        ip: '127.0.0.1',
        endpoint: '/api/test',
        method: 'GET'
      };

      const config = {
        max: 5,
        windowMs: 900000,
        strategy: 'sliding_window' as const,
        scope: 'ip' as const
      };

      mockStore.get.mockResolvedValue({
        totalHits: 3,
        resetTime: new Date(Date.now() + 450000), // 7.5 minutes from now
        remainingRequests: 2
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 4,
        resetTime: new Date(Date.now() + 450000),
        remainingRequests: 1
      });

      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(4);
      expect(result.remainingRequests).toBe(1);
    });

    test('should deny requests over limit', async () => {
      const context = {
        req: mockRequest as Request,
        ip: '127.0.0.1',
        endpoint: '/api/test',
        method: 'GET'
      };

      const config = {
        max: 5,
        windowMs: 900000,
        strategy: 'sliding_window' as const,
        scope: 'ip' as const
      };

      mockStore.get.mockResolvedValue({
        totalHits: 5,
        resetTime: new Date(Date.now() + 450000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 6,
        resetTime: new Date(Date.now() + 450000),
        remainingRequests: 0
      });

      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(false);
      expect(result.totalHits).toBe(6);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    test('should get rate limit status', async () => {
      mockStore.get.mockResolvedValue({
        totalHits: 3,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 197
      });

      const status = await getRateLimitStatus('user-123', '127.0.0.1', '/api/test');

      expect(status).toBeDefined();
      expect(status?.allowed).toBe(true);
    });

    test('should reset rate limits', async () => {
      mockStore.reset.mockResolvedValue(undefined);

      const result = await resetRateLimit('user-123', '127.0.0.1', '/api/test');

      expect(result).toBe(true);
      expect(mockStore.reset).toHaveBeenCalled();
    });

    test('should handle reset errors gracefully', async () => {
      mockStore.reset.mockRejectedValue(new Error('Reset failed'));

      const result = await resetRateLimit('user-123', '127.0.0.1', '/api/test');

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle middleware errors gracefully', async () => {
      mockStore.get.mockRejectedValue(new Error('Store error'));

      const middleware = rateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should allow request on error (graceful degradation)
      expect(mockNext).toHaveBeenCalled();
      
      const { logger } = require('../../src/utils/logger');
      expect(logger.error).toHaveBeenCalledWith(
        'Rate limit check failed',
        expect.objectContaining({
          error: 'Store error'
        })
      );
    });

    test('should handle invalid user role gracefully', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'invalid_role' as any,
        status: 'active'
      };

      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      const middleware = rateLimit();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Should default to guest limits
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Custom Handlers', () => {
    test('should call custom onLimitReached handler', async () => {
      const customHandler = jest.fn();
      
      mockStore.get.mockResolvedValue({
        totalHits: 100,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });
      mockStore.increment.mockResolvedValue({
        totalHits: 101,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 0
      });

      const middleware = rateLimit({
        config: { max: 10, windowMs: 900000, strategy: 'sliding_window', scope: 'ip' },
        onLimitReached: customHandler
      });
      
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(customHandler).toHaveBeenCalledWith(
        mockRequest,
        mockResponse,
        expect.objectContaining({
          allowed: false,
          totalHits: 101
        })
      );
    });
  });

  describe('Integration Tests', () => {
    test('should handle complete rate limiting flow', async () => {
      // Simulate multiple requests within window
      mockStore.get
        .mockResolvedValueOnce(null) // First request - new window
        .mockResolvedValueOnce({     // Second request - within window
          totalHits: 1,
          resetTime: new Date(Date.now() + 900000),
          remainingRequests: 4
        });

      mockStore.set.mockResolvedValue(undefined);
      mockStore.increment.mockResolvedValue({
        totalHits: 2,
        resetTime: new Date(Date.now() + 900000),
        remainingRequests: 3
      });

      const middleware = rateLimit({
        config: { max: 5, windowMs: 900000, strategy: 'sliding_window', scope: 'ip' }
      });

      // First request
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset mocks for second request
      jest.clearAllMocks();

      // Second request
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);
    });

    test('should work with different rate limit scopes', async () => {
      mockRequest.user = {
        id: 'user-123',
        role: 'user',
        status: 'active'
      };

      mockStore.get.mockResolvedValue(null);
      mockStore.set.mockResolvedValue(undefined);

      // Test user scope
      const userScopeMiddleware = rateLimit({
        config: { max: 100, windowMs: 900000, strategy: 'sliding_window', scope: 'user' }
      });

      await userScopeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 