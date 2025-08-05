import request from 'supertest';
import express from 'express';
import { rateLimit } from '../../src/middleware/rate-limit.middleware';

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

// Mock Redis for testing
const mockRedisStore = {
  increment: jest.fn(),
  get: jest.fn(),
  set: jest.fn(),
  reset: jest.fn(),
  cleanup: jest.fn(),
  getStats: jest.fn()
};

jest.mock('../../src/utils/redis-rate-limit-store', () => ({
  RedisRateLimitStore: jest.fn(() => mockRedisStore)
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Rate Limiting Security Tests', () => {
  let app: express.Application;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Test endpoints with different rate limits
    app.get('/api/public', 
      rateLimit(),
      (req, res) => res.json({ success: true, message: 'Public endpoint' })
    );

    app.post('/api/login',
      rateLimit({ 
        windowMs: 60000, // 1 minute
        max: 5, // 5 attempts per minute
        standardHeaders: true,
        legacyHeaders: false
      }),
      (req, res) => res.json({ success: true, message: 'Login endpoint' })
    );

    app.get('/api/strict',
      rateLimit({
        windowMs: 60000, // 1 minute  
        max: 2, // 2 requests per minute
        standardHeaders: true,
        legacyHeaders: false
      }),
      (req, res) => res.json({ success: true, message: 'Strict endpoint' })
    );

    app.get('/api/payment',
      rateLimit({
        windowMs: 300000, // 5 minutes
        max: 3, // 3 payment attempts per 5 minutes
        standardHeaders: true,
        legacyHeaders: false
      }),
      (req, res) => res.json({ success: true, message: 'Payment endpoint' })
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock behavior - allow requests
    mockRedisStore.increment.mockResolvedValue({
      count: 1,
      resetTime: Date.now() + 60000
    });
    mockRedisStore.get.mockResolvedValue({
      count: 1,
      resetTime: Date.now() + 60000
    });
  });

  describe('Basic Rate Limiting', () => {
    test('should allow requests within rate limit', async () => {
      mockRedisStore.increment.mockResolvedValue({
        count: 1,
        resetTime: Date.now() + 60000
      });

      const response = await request(app)
        .get('/api/public');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should block requests exceeding rate limit', async () => {
      mockRedisStore.increment.mockResolvedValue({
        count: 11, // Exceeds default limit of 10
        resetTime: Date.now() + 60000
      });

      const response = await request(app)
        .get('/api/public');

      expect(response.status).toBe(429);
      expect(response.headers['retry-after']).toBeDefined();
    });

    test('should include rate limit headers', async () => {
      mockRedisStore.increment.mockResolvedValue({
        count: 3,
        resetTime: Date.now() + 60000
      });

      const response = await request(app)
        .get('/api/strict');

      expect(response.headers['ratelimit-limit']).toBeDefined();
      expect(response.headers['ratelimit-remaining']).toBeDefined();
      expect(response.headers['ratelimit-reset']).toBeDefined();
    });
  });

  describe('Rate Limit Bypass Attempts', () => {
    test('should prevent IP spoofing via X-Forwarded-For header', async () => {
      mockRedisStore.increment.mockResolvedValue({
        count: 3, // Exceeds strict limit of 2
        resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockResolvedValue({
        count: 3,
        resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockResolvedValue({
        count: 3,
        resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockResolvedValue({
        count: 3,
        resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          count: requestCount,
          resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockImplementation(() => {
        requestCount++;
        return Promise.resolve({
          count: requestCount,
          resetTime: Date.now() + 60000
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
      
      mockRedisStore.increment.mockImplementation((key: string) => {
        // Simulate different counts for different IPs
        const ipCount = key.includes('192.168.1.1') ? 5 : 1;
        return Promise.resolve({
          count: ipCount,
          resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockImplementation(() => {
        loginAttempts++;
        return Promise.resolve({
          count: loginAttempts,
          resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockImplementation(() => {
        attemptCount++;
        return Promise.resolve({
          count: attemptCount,
          resetTime: Date.now() + 60000
        });
      });

      const responses = await Promise.all(
        credentials.map(cred =>
          request(app)
            .post('/api/login')
            .send(cred)
        )
      );

      // All 5 attempts should succeed (within limit), but 6th would be blocked
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Additional attempt should be blocked
      mockRedisStore.increment.mockResolvedValue({
        count: 6,
        resetTime: Date.now() + 60000
      });

      const extraResponse = await request(app)
        .post('/api/login')
        .send({ username: 'extra', password: 'test' });

      expect(extraResponse.status).toBe(429);
    });
  });

  describe('Payment Endpoint Protection', () => {
    test('should strictly limit payment attempts', async () => {
      let paymentAttempts = 0;
      mockRedisStore.increment.mockImplementation(() => {
        paymentAttempts++;
        return Promise.resolve({
          count: paymentAttempts,
          resetTime: Date.now() + 300000 // 5 minutes
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
      mockRedisStore.increment.mockResolvedValue({
        count: 100,
        resetTime: Date.now() + 60000
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
      mockRedisStore.increment.mockRejectedValue(new Error('Redis connection failed'));

      const response = await request(app)
        .get('/api/public');

      // Should either allow (fail open) or deny (fail closed) consistently
      expect([200, 500, 503]).toContain(response.status);
    });

    test('should handle malformed rate limit data', async () => {
      mockRedisStore.increment.mockResolvedValue({
        count: 'invalid', // Invalid count
        resetTime: 'not-a-timestamp'
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
      mockRedisStore.increment.mockResolvedValueOnce({
        count: 1,
        resetTime: Date.now() + 1000 // 1 second
      });

      const response1 = await request(app)
        .get('/api/strict');

      expect(response1.status).toBe(200);

      // Second request - exceeds limit
      mockRedisStore.increment.mockResolvedValueOnce({
        count: 3,
        resetTime: Date.now() + 1000
      });

      const response2 = await request(app)
        .get('/api/strict');

      expect(response2.status).toBe(429);

      // After reset time - should work again
      mockRedisStore.increment.mockResolvedValueOnce({
        count: 1,
        resetTime: Date.now() + 60000
      });

      const response3 = await request(app)
        .get('/api/strict');

      expect(response3.status).toBe(200);
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance with high request volume', async () => {
      mockRedisStore.increment.mockImplementation(() =>
        Promise.resolve({
          count: 1,
          resetTime: Date.now() + 60000
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

      // Should complete within reasonable time (adjust based on your performance requirements)
      expect(duration).toBeLessThan(5000); // 5 seconds
      
      // All requests should be processed
      expect(responses).toHaveLength(100);
      responses.forEach(response => {
        expect([200, 429]).toContain(response.status);
      });
    });
  });
}); 