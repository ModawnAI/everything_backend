import { Request, Response, NextFunction } from 'express';
import {
  USER_ROLE_LIMITS,
  ENDPOINT_LIMITS,
  getRoleLimitConfig,
  getEndpointLimitConfig
} from '../../src/config/rate-limit.config';
import { AuthenticatedRequest } from '../../src/middleware/auth.middleware';

// Mock dependencies
jest.mock('../../src/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock the flexible rate limiter service using singleton-inside-factory pattern
// (jest.mock is hoisted above const declarations, so we create the mock inside the factory)
jest.mock('../../src/services/rate-limiter-flexible.service', () => {
  const singletonFlexibleService = {
    checkRateLimit: jest.fn(),
    getRateLimitStatus: jest.fn(),
    resetRateLimit: jest.fn(),
    penalizeUser: jest.fn()
  };
  return {
    getRateLimiterFlexibleService: jest.fn(() => singletonFlexibleService),
    RateLimiterFlexibleService: jest.fn(() => singletonFlexibleService),
    __mockFlexibleService: singletonFlexibleService
  };
});

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

// Mock ip-blocking service
jest.mock('../../src/services/ip-blocking.service', () => ({
  ipBlockingService: {
    isIPBlocked: jest.fn().mockResolvedValue(null),
    recordViolation: jest.fn().mockResolvedValue(undefined)
  }
}));

describe('Rate Limiting Middleware Tests', () => {
  let mockRequest: Partial<AuthenticatedRequest>;
  let mockResponse: Partial<Response>;
  let mockNext: NextFunction;
  let mockFlexibleService: any;

  // Save and restore NODE_ENV to bypass the test-environment skip
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    // Set NODE_ENV to 'development' so rate limiting is not skipped
    process.env.NODE_ENV = 'development';
    process.env.DISABLE_RATE_LIMIT = 'false';
    process.env.DISABLE_IP_BLOCKING = 'true'; // Skip IP blocking checks in tests

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

    // Retrieve the singleton mock flexible service
    const flexMod = require('../../src/services/rate-limiter-flexible.service');
    mockFlexibleService = flexMod.__mockFlexibleService;
    
    // Default flexible service mock - allow requests
    mockFlexibleService.checkRateLimit.mockResolvedValue({
      allowed: true,
      totalHits: 1,
      remainingRequests: 99,
      resetTime: new Date(Date.now() + 900000)
    });
    mockFlexibleService.getRateLimitStatus.mockResolvedValue({
      allowed: true,
      totalHits: 1,
      remainingRequests: 99,
      resetTime: new Date(Date.now() + 900000)
    });
    mockFlexibleService.resetRateLimit.mockResolvedValue(true);
  });

  afterEach(() => {
    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  // Import after mocks are set up (dynamic require to ensure mocks are active)
  function getMiddlewares() {
    return require('../../src/middleware/rate-limit.middleware');
  }

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
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 99,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimit } = getMiddlewares();
      const middleware = rateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockResponse.status).not.toHaveBeenCalledWith(429);
    });

    test('should block requests over limit', async () => {
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 1001,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 900000),
        retryAfter: 900
      });

      const { rateLimit } = getMiddlewares();
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
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 99,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimit } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 999,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimit } = getMiddlewares();
      const middleware = rateLimit();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    test('should handle Redis errors gracefully', async () => {
      // When flexibleService throws, RateLimitService catches and returns allowed: true
      mockFlexibleService.checkRateLimit.mockRejectedValue(new Error('Redis error'));

      const { rateLimit } = getMiddlewares();
      const middleware = rateLimit();
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      // Should allow request on Redis failure (graceful degradation)
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Endpoint-Specific Rate Limiting', () => {
    test('should apply login rate limits', async () => {
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 6,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 900000),
        retryAfter: 900
      });

      const { loginRateLimit } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 11,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 3600000),
        retryAfter: 3600
      });

      const { paymentRateLimit } = getMiddlewares();
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
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 4,
        resetTime: new Date(Date.now() + 900000)
      });

      const { endpointRateLimit } = getMiddlewares();
      const middleware = endpointRateLimit('login');
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Strict Rate Limiting', () => {
    test('should apply strict limits', async () => {
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 4,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 900000),
        retryAfter: 900
      });

      const { strictRateLimit } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 9,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimitService } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 4,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimitService } = getMiddlewares();
      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(true);
      expect(result.totalHits).toBe(1);
      expect(mockFlexibleService.checkRateLimit).toHaveBeenCalled();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 4,
        remainingRequests: 1,
        resetTime: new Date(Date.now() + 450000)
      });

      const { rateLimitService } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 6,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 450000),
        retryAfter: 450
      });

      const { rateLimitService } = getMiddlewares();
      const result = await rateLimitService.checkRateLimit(context, config);

      expect(result.allowed).toBe(false);
      expect(result.totalHits).toBe(6);
      expect(result.remainingRequests).toBe(0);
      expect(result.retryAfter).toBeGreaterThan(0);
    });
  });

  describe('Utility Functions', () => {
    test('should get rate limit status', async () => {
      mockFlexibleService.getRateLimitStatus.mockResolvedValue({
        allowed: true,
        totalHits: 3,
        remainingRequests: 197,
        resetTime: new Date(Date.now() + 900000)
      });

      const { getRateLimitStatus } = getMiddlewares();
      const status = await getRateLimitStatus('user-123', '127.0.0.1', '/api/test');

      expect(status).toBeDefined();
      expect(status?.allowed).toBe(true);
    });

    test('should reset rate limits', async () => {
      mockFlexibleService.resetRateLimit.mockResolvedValue(true);

      const { resetRateLimit } = getMiddlewares();
      const result = await resetRateLimit('user-123', '127.0.0.1', '/api/test');

      expect(result).toBe(true);
      expect(mockFlexibleService.resetRateLimit).toHaveBeenCalled();
    });

    test('should handle reset errors gracefully', async () => {
      mockFlexibleService.resetRateLimit.mockRejectedValue(new Error('Reset failed'));

      const { resetRateLimit } = getMiddlewares();
      const result = await resetRateLimit('user-123', '127.0.0.1', '/api/test');

      expect(result).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('should handle middleware errors gracefully', async () => {
      // When flexibleService throws, RateLimitService.checkRateLimit catches it
      // and logs 'Rate limit check failed' with the error message, then returns allowed: true
      mockFlexibleService.checkRateLimit.mockRejectedValue(new Error('Store error'));

      const { rateLimit } = getMiddlewares();
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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 49,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimit } = getMiddlewares();
      const middleware = rateLimit();
      await middleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);

      // Should default to guest limits
      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('Custom Handlers', () => {
    test('should call custom onLimitReached handler', async () => {
      const customHandler = jest.fn();
      
      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 101,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 900000),
        retryAfter: 900
      });

      const { rateLimit } = getMiddlewares();
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
      mockFlexibleService.checkRateLimit
        .mockResolvedValueOnce({
          allowed: true,
          totalHits: 1,
          remainingRequests: 4,
          resetTime: new Date(Date.now() + 900000)
        })
        .mockResolvedValueOnce({
          allowed: true,
          totalHits: 2,
          remainingRequests: 3,
          resetTime: new Date(Date.now() + 900000)
        });

      const { rateLimit } = getMiddlewares();
      const middleware = rateLimit({
        config: { max: 5, windowMs: 900000, strategy: 'sliding_window', scope: 'ip' }
      });

      // First request
      await middleware(mockRequest as Request, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalledTimes(1);

      // Reset only next and response mocks for second request
      (mockNext as jest.Mock).mockClear();

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

      mockFlexibleService.checkRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 99,
        resetTime: new Date(Date.now() + 900000)
      });

      const { rateLimit } = getMiddlewares();
      // Test user scope
      const userScopeMiddleware = rateLimit({
        config: { max: 100, windowMs: 900000, strategy: 'sliding_window', scope: 'user' }
      });

      await userScopeMiddleware(mockRequest as AuthenticatedRequest, mockResponse as Response, mockNext);
      expect(mockNext).toHaveBeenCalled();
    });
  });
});
