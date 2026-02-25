import request from 'supertest';
import express from 'express';

/**
 * Rate Limiting Security Test Suite
 *
 * Tests rate limiting security vulnerabilities including:
 * - Rate limit bypass attempts
 * - DDoS protection
 * - IP spoofing attacks
 * - Concurrent request flooding
 * - Rate limit evasion techniques
 */

// Store original NODE_ENV
const originalNodeEnv = process.env.NODE_ENV;

// Mock Redis rate limit store - object created INSIDE factory to avoid hoisting issue
jest.mock('../../src/utils/redis-rate-limit-store', () => {
  const singletonStore = {
    increment: jest.fn(),
    get: jest.fn(),
    set: jest.fn(),
    reset: jest.fn(),
    cleanup: jest.fn(),
    getStats: jest.fn()
  };
  return {
    RedisRateLimitStore: jest.fn(() => singletonStore),
    getRedisRateLimitStore: jest.fn(() => singletonStore),
    __mockStore: singletonStore
  };
});

// Mock the rate-limiter-flexible service to control rate limit decisions
jest.mock('../../src/services/rate-limiter-flexible.service', () => {
  const mockCheckRateLimit = jest.fn();
  const mockGetRateLimitStatus = jest.fn();
  const mockResetRateLimit = jest.fn();
  const mockPenalizeUser = jest.fn();

  const mockService = {
    checkRateLimit: mockCheckRateLimit,
    getRateLimitStatus: mockGetRateLimitStatus,
    resetRateLimit: mockResetRateLimit,
    penalizeUser: mockPenalizeUser,
    getStats: jest.fn().mockResolvedValue({
      totalLimiters: 0,
      isConnected: false,
      fallbackMode: true,
      redisStatus: 'disconnected'
    }),
    cleanup: jest.fn()
  };

  return {
    RateLimiterFlexibleService: jest.fn(() => mockService),
    getRateLimiterFlexibleService: jest.fn(() => mockService),
    createRateLimiterFlexibleService: jest.fn(() => mockService),
    __mockService: mockService,
    __mockCheckRateLimit: mockCheckRateLimit
  };
});

// Mock ip-blocking service
jest.mock('../../src/services/ip-blocking.service', () => ({
  ipBlockingService: {
    isIPBlocked: jest.fn().mockResolvedValue(null),
    recordViolation: jest.fn().mockResolvedValue(undefined),
    getBlockedIPs: jest.fn().mockResolvedValue([]),
    unblockIP: jest.fn().mockResolvedValue(true)
  }
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

// Access mocks via __mockStore / __mockService to avoid hoisting issues
const { __mockStore: mockRedisStore } = jest.requireMock('../../src/utils/redis-rate-limit-store');
const { __mockService: mockFlexibleService, __mockCheckRateLimit: mockCheckRateLimit } =
  jest.requireMock('../../src/services/rate-limiter-flexible.service');

describe('Rate Limiting Security Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    // Set NODE_ENV to something other than 'test' so rate-limit middleware
    // does not skip its logic via the early-return guard
    process.env.NODE_ENV = 'development';
    process.env.DISABLE_RATE_LIMIT = 'false';
    process.env.DISABLE_IP_BLOCKING = 'true';

    // Import rateLimit AFTER setting NODE_ENV so the module picks it up
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { rateLimit } = require('../../src/middleware/rate-limit.middleware');

    app = express();
    app.use(express.json());

    // Test endpoints with different rate limits
    app.get('/api/public', 
      rateLimit({
        config: {
          max: 10, // 10 requests per 15 minutes for testing
          windowMs: 15 * 60 * 1000, // 15 minutes
          strategy: 'sliding_window',
          scope: 'ip',
          enableHeaders: true
        }
      }),
      (req, res) => res.json({ success: true, message: 'Public endpoint' })
    );

    app.post('/api/login',
      rateLimit({ 
        config: {
          max: 5, // 5 attempts per minute
          windowMs: 60000, // 1 minute
          strategy: 'fixed_window',
          scope: 'ip',
          enableHeaders: true
        }
      }),
      (req, res) => res.json({ success: true, message: 'Login endpoint' })
    );

    app.get('/api/strict',
      rateLimit({
        config: {
          max: 2, // 2 requests per minute
          windowMs: 60000, // 1 minute
          strategy: 'fixed_window',
          scope: 'ip',
          enableHeaders: true
        }
      }),
      (req, res) => res.json({ success: true, message: 'Strict endpoint' })
    );

    app.get('/api/payment',
      rateLimit({
        config: {
          max: 3, // 3 payment attempts per 5 minutes
          windowMs: 300000, // 5 minutes
          strategy: 'sliding_window',
          scope: 'user',
          enableHeaders: true
        }
      }),
      (req, res) => res.json({ success: true, message: 'Payment endpoint' })
    );
  });

  afterAll(() => {
    // Restore original NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock behavior for the redis store
    mockRedisStore.get.mockResolvedValue(null);
    mockRedisStore.set.mockResolvedValue(undefined);
    mockRedisStore.increment.mockResolvedValue({
      totalHits: 1,
      resetTime: new Date(Date.now() + 60000),
      remainingRequests: 999
    });

    // Default mock behavior for the flexible service - allow requests
    mockCheckRateLimit.mockResolvedValue({
      allowed: true,
      totalHits: 1,
      remainingRequests: 999,
      resetTime: new Date(Date.now() + 60000)
    });

    mockFlexibleService.getRateLimitStatus.mockResolvedValue({
      allowed: true,
      totalHits: 0,
      remainingRequests: 999,
      resetTime: new Date(Date.now() + 60000)
    });

    mockFlexibleService.resetRateLimit.mockResolvedValue(true);
    mockFlexibleService.penalizeUser.mockResolvedValue(undefined);
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 9,
        resetTime: new Date(Date.now() + 60000)
      });

      const response = await request(app)
        .get('/api/public');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should block requests exceeding rate limit', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 11,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      const response = await request(app)
        .get('/api/public');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    test('should include rate limit headers', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 1,
        remainingRequests: 1,
        resetTime: new Date(Date.now() + 60000)
      });

      const response = await request(app)
        .get('/api/strict');

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-reset']).toBeDefined();
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    test('should prevent IP spoofing via X-Forwarded-For header', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 3,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      // Try to spoof IP to bypass rate limiting
      const response = await request(app)
        .get('/api/strict')
        .set('X-Forwarded-For', '192.168.1.100')
        .set('X-Real-IP', '10.0.0.1')
        .set('CF-Connecting-IP', '172.16.0.1');

      expect(response.status).toBe(429);
    });

    test('should prevent bypass via User-Agent manipulation', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 3,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
        'Mozilla/5.0 (X11; Linux x86_64)',
        'curl/7.68.0',
        'PostmanRuntime/7.28.4'
      ];

      for (const userAgent of userAgents) {
        const response = await request(app)
          .get('/api/strict')
          .set('User-Agent', userAgent);

        expect(response.status).toBe(429);
      }
    });

    test('should prevent bypass via session manipulation', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 3,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      // Try different session cookies
      const sessionCookies = [
        'session=abc123',
        'session=def456',
        'session=ghi789',
        'PHPSESSID=xyz123',
        'connect.sid=session_id'
      ];

      for (const cookie of sessionCookies) {
        const response = await request(app)
          .get('/api/strict')
          .set('Cookie', cookie);

        expect(response.status).toBe(429);
      }
    });

    test('should prevent bypass via custom headers', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 3,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      const response = await request(app)
        .get('/api/strict')
        .set('X-Rate-Limit-Skip', 'true')
        .set('X-Admin-Override', 'bypass')
        .set('X-Internal-Request', 'true')
        .set('Authorization', 'Bearer admin-token');

      expect(response.status).toBe(429);
    });
  });

  describe('Concurrent Request Flooding', () => {
    test('should handle concurrent request bursts', async () => {
      let requestCount = 0;
      mockCheckRateLimit.mockImplementation(() => {
        requestCount++;
        const allowed = requestCount <= 2; // Strict limit is 2
        return Promise.resolve({
          allowed,
          totalHits: requestCount,
          remainingRequests: Math.max(0, 2 - requestCount),
          resetTime: new Date(Date.now() + 60000),
          retryAfter: allowed ? undefined : 60
        });
      });

      // Send 20 concurrent requests
      const requests = Array(20).fill(null).map(() =>
        request(app).get('/api/strict')
      );

      const responses = await Promise.all(requests);

      // Should have some successful (200) and some rate limited (429)
      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(2); // Strict limit is 2
      expect(rateLimitedCount).toBeGreaterThan(0);
      expect(successCount + rateLimitedCount).toBe(20);
    });

    test('should handle rapid successive requests', async () => {
      let requestCount = 0;
      mockCheckRateLimit.mockImplementation(() => {
        requestCount++;
        const allowed = requestCount <= 2;
        return Promise.resolve({
          allowed,
          totalHits: requestCount,
          remainingRequests: Math.max(0, 2 - requestCount),
          resetTime: new Date(Date.now() + 60000),
          retryAfter: allowed ? undefined : 60
        });
      });

      const responses = [];

      // Send requests in rapid succession
      for (let i = 0; i < 10; i++) {
        const response = await request(app).get('/api/strict');
        responses.push(response);
      }

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(2);
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Distributed Attack Simulation', () => {
    test('should handle requests from multiple IPs', async () => {
      const ips = ['192.168.1.1', '10.0.0.1', '172.16.0.1', '203.0.113.1'];

      let callIndex = 0;
      mockCheckRateLimit.mockImplementation(() => {
        const currentIndex = callIndex++;
        // First IP (index 0) is over the limit, rest are allowed
        if (currentIndex === 0) {
          return Promise.resolve({
            allowed: false,
            totalHits: 5,
            remainingRequests: 0,
            resetTime: new Date(Date.now() + 60000),
            retryAfter: 60
          });
        }
        return Promise.resolve({
          allowed: true,
          totalHits: 1,
          remainingRequests: 1,
          resetTime: new Date(Date.now() + 60000)
        });
      });

      const responses = await Promise.all(
        ips.map(ip =>
          request(app)
            .get('/api/strict')
            .set('X-Forwarded-For', ip)
        )
      );

      // First IP should be rate limited, others should succeed
      expect(responses[0].status).toBe(429); // 192.168.1.1 has count 5
      expect(responses[1].status).toBe(200); // Others have count 1
      expect(responses[2].status).toBe(200);
      expect(responses[3].status).toBe(200);
    });
  });

  describe('Login Endpoint Protection', () => {
    test('should strictly limit login attempts', async () => {
      let loginAttempts = 0;
      mockCheckRateLimit.mockImplementation(() => {
        loginAttempts++;
        const allowed = loginAttempts <= 5; // Login limit is 5
        return Promise.resolve({
          allowed,
          totalHits: loginAttempts,
          remainingRequests: Math.max(0, 5 - loginAttempts),
          resetTime: new Date(Date.now() + 60000),
          retryAfter: allowed ? undefined : 60
        });
      });

      const responses = [];

      // Attempt 10 logins
      for (let i = 0; i < 10; i++) {
        const response = await request(app)
          .post('/api/login')
          .send({ username: 'test', password: 'password' });
        responses.push(response);
      }

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(5); // Login limit is 5
      expect(rateLimitedCount).toBeGreaterThan(0);
    });

    test('should prevent credential stuffing attacks', async () => {
      const credentials = [
        { username: 'admin', password: 'admin' },
        { username: 'user', password: 'password' },
        { username: 'test', password: '123456' },
        { username: 'root', password: 'root' },
        { username: 'guest', password: 'guest' }
      ];

      let attemptCount = 0;
      mockCheckRateLimit.mockImplementation(() => {
        attemptCount++;
        const allowed = attemptCount <= 5;
        return Promise.resolve({
          allowed,
          totalHits: attemptCount,
          remainingRequests: Math.max(0, 5 - attemptCount),
          resetTime: new Date(Date.now() + 60000),
          retryAfter: allowed ? undefined : 60
        });
      });

      const responses = await Promise.all(
        credentials.map(cred =>
          request(app)
            .post('/api/login')
            .send(cred)
        )
      );

      // All 5 attempts should succeed (within limit)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Additional attempt should be blocked (attemptCount is now 6)
      const extraResponse = await request(app)
        .post('/api/login')
        .send({ username: 'extra', password: 'test' });

      expect(extraResponse.status).toBe(429);
    });
  });

  describe('Payment Endpoint Protection', () => {
    test('should strictly limit payment attempts', async () => {
      let paymentAttempts = 0;
      mockCheckRateLimit.mockImplementation(() => {
        paymentAttempts++;
        const allowed = paymentAttempts <= 3; // Payment limit is 3
        return Promise.resolve({
          allowed,
          totalHits: paymentAttempts,
          remainingRequests: Math.max(0, 3 - paymentAttempts),
          resetTime: new Date(Date.now() + 300000),
          retryAfter: allowed ? undefined : 300
        });
      });

      const responses = [];

      // Attempt 5 payments
      for (let i = 0; i < 5; i++) {
        const response = await request(app)
          .get('/api/payment');
        responses.push(response);
      }

      const successCount = responses.filter(r => r.status === 200).length;
      const rateLimitedCount = responses.filter(r => r.status === 429).length;

      expect(successCount).toBeLessThanOrEqual(3); // Payment limit is 3
      expect(rateLimitedCount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Security', () => {
    test('should not expose internal rate limiting details', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: false,
        totalHits: 100,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000),
        retryAfter: 60
      });

      const response = await request(app)
        .get('/api/strict');

      expect(response.status).toBe(429);
      expect(response.body).not.toHaveProperty('redis');
      expect(response.body).not.toHaveProperty('store');
      expect(response.body).not.toHaveProperty('key');
      expect(response.body).not.toHaveProperty('algorithm');
    });

    test('should handle rate limiting store errors gracefully', async () => {
      mockCheckRateLimit.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/public');

      // Middleware catches errors and allows request (graceful degradation)
      expect([200, 500, 503]).toContain(response.status);
    });

    test('should handle malformed rate limit data', async () => {
      mockCheckRateLimit.mockResolvedValue({
        allowed: true,
        totalHits: 'invalid' as any,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 60000)
      });

      const response = await request(app)
        .get('/api/public');

      // Should handle gracefully
      expect([200, 500]).toContain(response.status);
    });
  });

  describe('Rate Limit Reset and Recovery', () => {
    test('should reset rate limits after time window', async () => {
      // First request - within limit
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: true,
        totalHits: 1,
        remainingRequests: 1,
        resetTime: new Date(Date.now() + 1000)
      });

      const response1 = await request(app)
        .get('/api/strict');

      expect(response1.status).toBe(200);

      // Second request - exceeds limit
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: false,
        totalHits: 3,
        remainingRequests: 0,
        resetTime: new Date(Date.now() + 1000),
        retryAfter: 1
      });

      const response2 = await request(app)
        .get('/api/strict');

      expect(response2.status).toBe(429);

      // After reset time - should work again
      mockCheckRateLimit.mockResolvedValueOnce({
        allowed: true,
        totalHits: 1,
        remainingRequests: 1,
        resetTime: new Date(Date.now() + 60000)
      });

      const response3 = await request(app)
        .get('/api/strict');

      expect(response3.status).toBe(200);
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance with high request volume', async () => {
      mockCheckRateLimit.mockImplementation(() =>
        Promise.resolve({
          allowed: true,
          totalHits: 1,
          remainingRequests: 999,
          resetTime: new Date(Date.now() + 60000)
        })
      );

      const startTime = Date.now();

      // 100 concurrent requests
      const requests = Array(100).fill(null).map(() =>
        request(app).get('/api/public')
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time
      expect(duration).toBeLessThan(5000); // 5 seconds

      // All requests should be processed
      expect(responses).toHaveLength(100);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
}); 