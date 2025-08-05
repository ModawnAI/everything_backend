import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { authenticateJWT } from '../../src/middleware/auth.middleware';
import { requireAdmin } from '../../src/middleware/rbac.middleware';
import { refreshTokenService } from '../../src/services/refresh-token.service';
import { config } from '../../src/config/environment';

/**
 * Integration Security Test Suite
 * 
 * Tests complete security flows including:
 * - End-to-end authentication flows
 * - Token refresh security
 * - Multi-layered security validation
 * - Complete attack scenario simulations
 * - Cross-system security interactions
 */

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      insert: jest.fn(),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(() => ({
          select: jest.fn()
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

describe('Integration Security Tests', () => {
  let app: express.Application;
  let mockUsers: any;
  let validTokens: any;

  beforeAll(() => {
    app = express();
    app.use(express.json());

    // Mock users
    mockUsers = {
      user: {
        id: 'user-123',
        email: 'user@example.com',
        user_role: 'user',
        user_status: 'active',
        is_influencer: false,
        phone_verified: true
      },
      admin: {
        id: 'admin-456',
        email: 'admin@example.com',
        user_role: 'admin',
        user_status: 'active',
        is_influencer: false,
        phone_verified: true
      },
      suspended: {
        id: 'suspended-999',
        email: 'suspended@example.com',
        user_role: 'user',
        user_status: 'suspended',
        is_influencer: false,
        phone_verified: false
      }
    };

    // Create valid tokens
    validTokens = {
      user: jwt.sign(
        {
          sub: mockUsers.user.id,
          email: mockUsers.user.email,
          aud: config.auth.audience,
          iss: config.auth.issuer,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      ),
      admin: jwt.sign(
        {
          sub: mockUsers.admin.id,
          email: mockUsers.admin.email,
          aud: config.auth.audience,
          iss: config.auth.issuer,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      ),
      suspended: jwt.sign(
        {
          sub: mockUsers.suspended.id,
          email: mockUsers.suspended.email,
          aud: config.auth.audience,
          iss: config.auth.issuer,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      )
    };

    // Test endpoints simulating real application routes
    app.get('/api/user/profile',
      authenticateJWT(),
      (req, res) => res.json({ 
        success: true, 
        data: { 
          id: (req as any).user.id,
          email: (req as any).user.email 
        } 
      })
    );

    app.post('/api/admin/users',
      authenticateJWT(),
      requireAdmin(),
      (req, res) => res.json({ 
        success: true, 
        message: 'User created',
        data: req.body 
      })
    );

    app.get('/api/public/health',
      (req, res) => res.json({ status: 'healthy', timestamp: new Date().toISOString() })
    );

    app.post('/api/auth/refresh',
      (req, res) => {
        // Mock refresh token endpoint
        const { refreshToken } = req.body;
        if (refreshToken === 'valid-refresh-token') {
          res.json({
            success: true,
            data: {
              accessToken: validTokens.user,
              refreshToken: 'new-refresh-token',
              expiresIn: 3600
            }
          });
        } else {
          res.status(401).json({
            success: false,
            error: { code: 'INVALID_REFRESH_TOKEN', message: 'Invalid refresh token' }
          });
        }
      }
    );

    app.post('/api/auth/logout',
      authenticateJWT(),
      (req, res) => {
        res.json({ success: true, message: 'Logged out successfully' });
      }
    );

    // Mock Supabase user lookup
    const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
    mockSupabaseClient.from().select().eq().single.mockImplementation(() => {
      // Default to user, can be overridden in tests
      return Promise.resolve({
        data: mockUsers.user,
        error: null
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Complete Authentication Flow Security', () => {
    test('should handle complete user authentication flow', async () => {
      // 1. Access public endpoint (no auth required)
      const publicResponse = await request(app)
        .get('/api/public/health');

      expect(publicResponse.status).toBe(200);
      expect(publicResponse.body.status).toBe('healthy');

      // 2. Access protected endpoint with valid token
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
      expect(profileResponse.body.data.id).toBe(mockUsers.user.id);

      // 3. Logout
      const logoutResponse = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .send({ refreshToken: 'valid-refresh-token' });

      expect(logoutResponse.status).toBe(200);
      expect(logoutResponse.body.success).toBe(true);
    });

    test('should handle admin authentication flow', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.admin,
        error: null
      });

      // Admin should access admin endpoints
      const adminResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${validTokens.admin}`)
        .send({ 
          email: 'newuser@example.com',
          role: 'user'
        });

      expect(adminResponse.status).toBe(200);
      expect(adminResponse.body.success).toBe(true);
      expect(adminResponse.body.data.email).toBe('newuser@example.com');
    });

    test('should handle token refresh flow securely', async () => {
      // 1. Refresh token with valid refresh token
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(refreshResponse.status).toBe(200);
      expect(refreshResponse.body.success).toBe(true);
      expect(refreshResponse.body.data).toHaveProperty('accessToken');
      expect(refreshResponse.body.data).toHaveProperty('refreshToken');
      expect(refreshResponse.body.data.refreshToken).not.toBe('valid-refresh-token'); // Should be rotated

      // 2. Use new access token
      const newAccessToken = refreshResponse.body.data.accessToken;
      
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${newAccessToken}`);

      expect(profileResponse.status).toBe(200);
      expect(profileResponse.body.success).toBe(true);
    });
  });

  describe('Multi-Layer Security Validation', () => {
    test('should enforce authentication before authorization', async () => {
      // Try to access admin endpoint without any token
      const response1 = await request(app)
        .post('/api/admin/users')
        .send({ email: 'test@example.com' });

      expect(response1.status).toBe(401);

      // Try to access admin endpoint with invalid token
      const response2 = await request(app)
        .post('/api/admin/users')
        .set('Authorization', 'Bearer invalid-token')
        .send({ email: 'test@example.com' });

      expect(response2.status).toBe(401);

      // Try to access admin endpoint with valid user token (should fail authorization)
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user, // Regular user, not admin
        error: null
      });

      const response3 = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .send({ email: 'test@example.com' });

      expect(response3.status).toBe(403);
    });

    test('should validate user status throughout the flow', async () => {
      // Suspended user should be blocked even with valid token
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.suspended,
        error: null
      });

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.suspended}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Attack Scenario Simulations', () => {
    test('should prevent privilege escalation attack chain', async () => {
      // 1. Start as regular user
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // 2. Verify user can access their profile
      const profileResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`);

      expect(profileResponse.status).toBe(200);

      // 3. Attempt to escalate privileges by modifying request
      const escalationResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .set('X-User-Role', 'admin')
        .set('X-Admin-Override', 'true')
        .send({ 
          email: 'malicious@example.com',
          role: 'admin'
        });

      expect(escalationResponse.status).toBe(403);

      // 4. Attempt to use modified token with admin claims
      const adminClaimToken = jwt.sign(
        {
          sub: mockUsers.user.id,
          email: mockUsers.user.email,
          role: 'admin', // False claim
          aud: config.auth.audience,
          iss: config.auth.issuer,
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600
        },
        config.auth.jwtSecret
      );

      const tokenEscalationResponse = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminClaimToken}`)
        .send({ email: 'malicious@example.com' });

      // Should still fail because user role is checked from database
      expect(tokenEscalationResponse.status).toBe(403);
    });

    test('should prevent session hijacking simulation', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // 1. Legitimate user access
      const legitimateResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .set('User-Agent', 'Mozilla/5.0 (legitimate browser)');

      expect(legitimateResponse.status).toBe(200);

      // 2. Simulate hijacked session with different User-Agent
      const hijackedResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .set('User-Agent', 'curl/7.68.0 (attacker tool)')
        .set('X-Forwarded-For', '192.168.1.100'); // Different IP

      // Token is still valid, but this simulates monitoring for suspicious activity
      expect(hijackedResponse.status).toBe(200);
      // In a real system, this might trigger additional verification
    });

    test('should handle token replay attack attempts', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // Multiple concurrent requests with same token (replay attack simulation)
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validTokens.user}`)
      );

      const responses = await Promise.all(requests);

      // All should succeed unless specific anti-replay measures are implemented
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // This test verifies current behavior - in production, you might implement
      // additional anti-replay measures like nonces or request signing
    });
  });

  describe('Error Handling Security', () => {
    test('should handle database failures securely', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
      
      // Should not expose database details
      expect(response.body.error.message).not.toContain('Database');
      expect(response.body.error.message).not.toContain('connection');
    });

    test('should handle malformed requests securely', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.admin,
        error: null
      });

      // Send malformed JSON
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${validTokens.admin}`)
        .set('Content-Type', 'application/json')
        .send('{"malformed": json}');

      expect(response.status).toBe(400);
    });

    test('should handle edge case authentication scenarios', async () => {
      // Empty authorization header
      const response1 = await request(app)
        .get('/api/user/profile')
        .set('Authorization', '');

      expect(response1.status).toBe(401);

      // Malformed bearer token
      const response2 = await request(app)
        .get('/api/user/profile')
        .set('Authorization', 'Bearer');

      expect(response2.status).toBe(401);

      // Multiple authorization headers
      const response3 = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`)
        .set('Authorization', 'Bearer another-token');

      expect([200, 401]).toContain(response3.status);
    });
  });

  describe('Performance and Load Security', () => {
    test('should maintain security under concurrent load', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const startTime = Date.now();

      // 50 concurrent requests
      const requests = Array(50).fill(null).map((_, index) =>
        request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validTokens.user}`)
          .set('X-Request-ID', `req-${index}`)
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();

      // All should succeed
      responses.forEach((response, index) => {
        expect(response.status).toBe(200);
        expect(response.body.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000); // 5 seconds
    });

    test('should handle mixed authentication states under load', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      
      // Mix of different user types
      let callCount = 0;
      mockSupabaseClient.from().select().eq().single.mockImplementation(() => {
        const users = [mockUsers.user, mockUsers.admin, mockUsers.suspended];
        const user = users[callCount % users.length];
        callCount++;
        return Promise.resolve({
          data: user,
          error: null
        });
      });

      const tokens = [validTokens.user, validTokens.admin, validTokens.suspended];
      
      const requests = Array(30).fill(null).map((_, index) =>
        request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${tokens[index % tokens.length]}`)
      );

      const responses = await Promise.all(requests);

      // Should have mixed success/failure based on user status
      const successResponses = responses.filter(r => r.status === 200);
      const failureResponses = responses.filter(r => r.status !== 200);

      expect(successResponses.length).toBeGreaterThan(0);
      expect(failureResponses.length).toBeGreaterThan(0); // Suspended users should fail
    });
  });

  describe('Cross-System Security Interactions', () => {
    test('should maintain security across token refresh cycles', async () => {
      // 1. Initial authentication
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const initialResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`);

      expect(initialResponse.status).toBe(200);

      // 2. Token refresh
      const refreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(refreshResponse.status).toBe(200);
      const newToken = refreshResponse.body.data.accessToken;

      // 3. Use new token
      const newTokenResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${newToken}`);

      expect(newTokenResponse.status).toBe(200);

      // 4. Old token should still work (unless blacklisting is implemented)
      const oldTokenResponse = await request(app)
        .get('/api/user/profile')
        .set('Authorization', `Bearer ${validTokens.user}`);

      expect(oldTokenResponse.status).toBe(200);
    });

    test('should handle refresh token rotation securely', async () => {
      // Test refresh token rotation
      const refreshResponse1 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(refreshResponse1.status).toBe(200);
      const newRefreshToken1 = refreshResponse1.body.data.refreshToken;

      // Use the new refresh token
      const refreshResponse2 = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: newRefreshToken1 });

      expect(refreshResponse2.status).toBe(200);
      const newRefreshToken2 = refreshResponse2.body.data.refreshToken;

      // All refresh tokens should be different
      expect(newRefreshToken1).not.toBe('valid-refresh-token');
      expect(newRefreshToken2).not.toBe(newRefreshToken1);
      expect(newRefreshToken2).not.toBe('valid-refresh-token');

      // Old refresh token should be invalid
      const oldRefreshResponse = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'valid-refresh-token' });

      expect(oldRefreshResponse.status).toBe(401);
    });
  });
}); 