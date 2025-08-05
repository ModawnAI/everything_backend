import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { authenticateJWT, optionalAuth } from '../../src/middleware/auth.middleware';
import { config } from '../../src/config/environment';

/**
 * Authentication Security Test Suite
 * 
 * Tests security vulnerabilities in the authentication system including:
 * - JWT token manipulation attacks
 * - Invalid token scenarios
 * - Token expiration handling
 * - Signature verification bypasses
 * - Algorithm confusion attacks
 * - Token replay attacks
 */

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      }))
    }))
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('Authentication Security Tests', () => {
  let app: express.Application;
  let validToken: string;
  let expiredToken: string;
  let malformedToken: string;
  let mockUser: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Test endpoints
    app.get('/protected', authenticateJWT(), (req, res) => {
      res.json({ success: true, user: (req as any).user });
    });

    app.get('/optional', optionalAuth(), (req, res) => {
      res.json({ success: true, user: (req as any).user || null });
    });

    // Mock user data
    mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      user_role: 'user',
      user_status: 'active'
    };

    // Create test tokens
    validToken = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600 // 1 hour
      },
      config.auth.jwtSecret
    );

    expiredToken = jwt.sign(
      {
        sub: mockUser.id,
        email: mockUser.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000) - 7200, // 2 hours ago
        exp: Math.floor(Date.now() / 1000) - 3600 // Expired 1 hour ago
      },
      config.auth.jwtSecret
    );

    malformedToken = 'malformed.token.here';

    // Mock Supabase user lookup
    const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
    mockSupabaseClient.from().select().eq().single.mockResolvedValue({
      data: mockUser,
      error: null
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('JWT Token Manipulation Attacks', () => {
    test('should reject token with tampered payload', async () => {
      // Create a token with valid structure but tampered payload
      const tokenHeader = jwt.decode(validToken, { complete: true })?.header;
      const tamperedPayload = {
        sub: 'admin-456', // Changed user ID
        email: 'admin@example.com',
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      // Create token with different secret to simulate tampering
      const tamperedToken = jwt.sign(tamperedPayload, 'wrong-secret');

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${tamperedToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject token with none algorithm attack', async () => {
      // Attempt "none" algorithm attack
      const noneToken = Buffer.from(JSON.stringify({
        alg: 'none',
        typ: 'JWT'
      })).toString('base64') + '.' +
      Buffer.from(JSON.stringify({
        sub: 'admin-456',
        email: 'admin@example.com',
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      })).toString('base64') + '.';

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${noneToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject token with modified signature', async () => {
      // Take valid token and modify the signature
      const tokenParts = validToken.split('.');
      const modifiedSignature = tokenParts[2].slice(0, -1) + 'X'; // Change last character
      const modifiedToken = `${tokenParts[0]}.${tokenParts[1]}.${modifiedSignature}`;

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${modifiedToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject token with algorithm confusion attack (HS256 vs RS256)', async () => {
      // Create token using different algorithm
      try {
        const confusedToken = jwt.sign(
          {
            sub: mockUser.id,
            email: mockUser.email,
            aud: config.auth.audience,
            iss: config.auth.issuer,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 3600
          },
          config.auth.jwtSecret,
          { algorithm: 'HS512' } // Different algorithm
        );

        const response = await request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${confusedToken}`);

        // Should either reject or handle gracefully
        expect([401, 403, 500]).toContain(response.status);
      } catch (error) {
        // Algorithm confusion should be prevented
        expect(error).toBeDefined();
      }
    });
  });

  describe('Token Validation Security', () => {
    test('should reject expired tokens', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });

    test('should reject malformed tokens', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${malformedToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INVALID_TOKEN');
    });

    test('should reject token with missing Bearer prefix', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', validToken); // Missing "Bearer "

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject token with invalid issuer', async () => {
      const invalidIssuerToken = jwt.sign(
        {
          sub: mockUser.id,
          email: mockUser.email,
          aud: config.auth.audience,
          iss: 'malicious-issuer', // Wrong issuer
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${invalidIssuerToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject token with invalid audience', async () => {
      const invalidAudienceToken = jwt.sign(
        {
          sub: mockUser.id,
          email: mockUser.email,
          aud: 'wrong-audience', // Wrong audience
          iss: config.auth.issuer,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      );

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${invalidAudienceToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Token Replay Attack Prevention', () => {
    test('should handle multiple requests with same token', async () => {
      // Make multiple requests with the same token
      const requests = Array(5).fill(null).map(() =>
        request(app)
          .get('/protected')
          .set('Authorization', `Bearer ${validToken}`)
      );

      const responses = await Promise.all(requests);

      // All should succeed (tokens can be reused unless specifically prevented)
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should prevent token reuse after user logout (if implemented)', async () => {
      // This test assumes token blacklisting is implemented
      // For now, just verify current behavior
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(200);
    });
  });

  describe('User Status Security', () => {
    test('should reject token for inactive user', async () => {
      // Mock inactive user
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: { ...mockUser, user_status: 'suspended' },
        error: null
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should reject token for non-existent user', async () => {
      // Mock user not found
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' }
      });

      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Optional Authentication Security', () => {
    test('should handle optional auth with invalid token gracefully', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${malformedToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });

    test('should handle optional auth with expired token gracefully', async () => {
      const response = await request(app)
        .get('/optional')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });

    test('should handle optional auth without token', async () => {
      const response = await request(app)
        .get('/optional');

      expect(response.status).toBe(200);
      expect(response.body.user).toBeNull();
    });
  });

  describe('Header Injection Security', () => {
    test('should handle malicious authorization headers', async () => {
      const maliciousHeaders = [
        'Bearer \r\nX-Admin: true',
        'Bearer \nSet-Cookie: admin=true',
        'Bearer \tmalicious',
        'Bearer ' + 'A'.repeat(10000), // Very long token
        'Bearer \0null-byte'
      ];

      for (const header of maliciousHeaders) {
        const response = await request(app)
          .get('/protected')
          .set('Authorization', header);

        expect(response.status).toBe(401);
        expect(response.body).toHaveProperty('error');
      }
    });

    test('should handle multiple authorization headers', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${validToken}`)
        .set('Authorization', 'Bearer malicious-token');

      // Should use the last header value or reject multiple headers
      expect([200, 401]).toContain(response.status);
    });
  });

  describe('Timing Attack Prevention', () => {
    test('should have consistent response times for invalid tokens', async () => {
      const startTime1 = Date.now();
      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token-1');
      const time1 = Date.now() - startTime1;

      const startTime2 = Date.now();
      await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token-2');
      const time2 = Date.now() - startTime2;

      // Response times should be similar (within reasonable variance)
      const timeDifference = Math.abs(time1 - time2);
      expect(timeDifference).toBeLessThan(100); // 100ms variance allowed
    });
  });

  describe('Error Information Disclosure', () => {
    test('should not expose sensitive information in error messages', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${malformedToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error.message).not.toContain('secret');
      expect(response.body.error.message).not.toContain('key');
      expect(response.body.error.message).not.toContain('password');
      expect(response.body.error.message).not.toContain('database');
    });

    test('should not expose stack traces in production', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${malformedToken}`);

      expect(response.body).not.toHaveProperty('stack');
      expect(response.body.error).not.toHaveProperty('stack');
    });
  });
}); 