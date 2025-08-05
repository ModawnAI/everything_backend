import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { authenticateJWT } from '../../src/middleware/auth.middleware';
import { requirePermission, requireAdmin } from '../../src/middleware/rbac.middleware';
import { config } from '../../src/config/environment';

/**
 * RBAC Security Test Suite
 * 
 * Tests authorization security vulnerabilities including:
 * - Privilege escalation attempts
 * - Role-based access control bypasses
 * - Permission manipulation attacks
 * - Resource ownership bypasses
 * - Admin privilege escalation
 */

// Simple role check middleware for testing
const requireRole = (allowedRoles: string[]) => {
  return (req: any, res: any, next: any) => {
    const user = req.user;
    if (!user || !allowedRoles.includes(user.user_role)) {
      return res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions',
          timestamp: new Date().toISOString()
        }
      });
    }
    next();
  };
};

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

describe('RBAC Security Tests', () => {
  let app: express.Application;
  let userToken: string;
  let adminToken: string;
  let shopOwnerToken: string;
  let suspendedUserToken: string;
  let mockUsers: any;

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
        is_influencer: false
      },
      admin: {
        id: 'admin-456',
        email: 'admin@example.com',
        user_role: 'admin',
        user_status: 'active',
        is_influencer: false
      },
      shopOwner: {
        id: 'shop-789',
        email: 'shop@example.com',
        user_role: 'shop_owner',
        user_status: 'active',
        is_influencer: false
      },
      suspended: {
        id: 'suspended-999',
        email: 'suspended@example.com',
        user_role: 'user',
        user_status: 'suspended',
        is_influencer: false
      }
    };

    // Create test tokens
    userToken = jwt.sign(
      {
        sub: mockUsers.user.id,
        email: mockUsers.user.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      config.auth.jwtSecret
    );

    adminToken = jwt.sign(
      {
        sub: mockUsers.admin.id,
        email: mockUsers.admin.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      config.auth.jwtSecret
    );

    shopOwnerToken = jwt.sign(
      {
        sub: mockUsers.shopOwner.id,
        email: mockUsers.shopOwner.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      config.auth.jwtSecret
    );

    suspendedUserToken = jwt.sign(
      {
        sub: mockUsers.suspended.id,
        email: mockUsers.suspended.email,
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      },
      config.auth.jwtSecret
    );

    // Test endpoints with different permission requirements
    app.get('/admin-only', 
      authenticateJWT(), 
      requireAdmin(),
      (req, res) => res.json({ success: true, message: 'Admin access granted' })
    );

    app.get('/shop-owners-only',
      authenticateJWT(),
      requireRole(['shop_owner', 'admin']),
      (req, res) => res.json({ success: true, message: 'Shop owner access granted' })
    );

    app.get('/users-read-profile',
      authenticateJWT(),
      requirePermission({ resource: 'user_profile', action: 'read' }),
      (req, res) => res.json({ success: true, message: 'Profile read access granted' })
    );

    app.post('/users-write-profile',
      authenticateJWT(),
      requirePermission({ resource: 'user_profile', action: 'write' }),
      (req, res) => res.json({ success: true, message: 'Profile write access granted' })
    );

    app.delete('/admin-delete-user',
      authenticateJWT(),
      requirePermission({ resource: 'user_management', action: 'delete' }),
      (req, res) => res.json({ success: true, message: 'User deletion access granted' })
    );

    // Mock Supabase user lookup
    const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
    mockSupabaseClient.from().select().eq().single.mockImplementation((userId: string) => {
      const user = Object.values(mockUsers).find((u: any) => u.id === userId);
      return Promise.resolve({
        data: user || null,
        error: user ? null : { message: 'User not found' }
      });
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Set up default mock behavior
    const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
    mockSupabaseClient.from().select().eq().single.mockImplementation(() => {
      // Default to returning user data
      return Promise.resolve({
        data: mockUsers.user,
        error: null
      });
    });
  });

  describe('Role-Based Access Control Bypasses', () => {
    test('should prevent user from accessing admin endpoints', async () => {
      // Mock user lookup
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error.code).toBe('INSUFFICIENT_PERMISSIONS');
    });

    test('should prevent user from accessing shop owner endpoints', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const response = await request(app)
        .get('/shop-owners-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should allow admin to access admin endpoints', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.admin,
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should allow shop owner to access shop owner endpoints', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.shopOwner,
        error: null
      });

      const response = await request(app)
        .get('/shop-owners-only')
        .set('Authorization', `Bearer ${shopOwnerToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Privilege Escalation Attempts', () => {
    test('should prevent token manipulation to escalate privileges', async () => {
      // Create a token with modified payload claiming admin role
      const escalatedPayload = {
        sub: mockUsers.user.id,
        email: mockUsers.user.email,
        role: 'admin', // Attempt to claim admin role in token
        aud: config.auth.audience,
        iss: config.auth.issuer,
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600
      };

      const escalatedToken = jwt.sign(escalatedPayload, config.auth.jwtSecret);

      // Mock database still returns user role
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user, // Database says user role
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${escalatedToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should prevent request parameter manipulation for privilege escalation', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // Try to send admin role in request body/headers
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-User-Role', 'admin')
        .send({ role: 'admin', user_role: 'admin' });

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should prevent suspended user from accessing any protected resources', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.suspended,
        error: null
      });

      const response = await request(app)
        .get('/users-read-profile')
        .set('Authorization', `Bearer ${suspendedUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Permission System Security', () => {
    test('should prevent access with invalid permission claims', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const response = await request(app)
        .delete('/admin-delete-user')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should allow admin to perform user management actions', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.admin,
        error: null
      });

      const response = await request(app)
        .delete('/admin-delete-user')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle permission checks with malformed permission data', async () => {
      // Mock corrupted permission data
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: { ...mockUsers.user, user_role: null }, // Corrupted role data
        error: null
      });

      const response = await request(app)
        .get('/users-read-profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Resource Ownership Security', () => {
    test('should prevent access to resources owned by other users', async () => {
      // This test would be more relevant with actual resource endpoints
      // For now, test the general principle
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // User should not be able to access admin-level resources
      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
    });

    test('should allow resource owners to access their own resources', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // User should be able to read their own profile
      const response = await request(app)
        .get('/users-read-profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('Role Hierarchy Security', () => {
    test('should respect role hierarchy (admin > shop_owner > user)', async () => {
      // Test admin can access shop owner endpoints
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.admin,
        error: null
      });

      const response = await request(app)
        .get('/shop-owners-only')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should prevent lower roles from accessing higher role endpoints', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.shopOwner,
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${shopOwnerToken}`);

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Concurrent Access Security', () => {
    test('should handle concurrent permission checks securely', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      // Make multiple concurrent requests
      const requests = Array(10).fill(null).map(() =>
        request(app)
          .get('/admin-only')
          .set('Authorization', `Bearer ${userToken}`)
      );

      const responses = await Promise.all(requests);

      // All should be rejected consistently
      responses.forEach(response => {
        expect(response.status).toBe(403);
        expect(response.body).toHaveProperty('error');
      });
    });

    test('should handle race conditions in permission evaluation', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      
      // Simulate race condition with different user data
      let callCount = 0;
      mockSupabaseClient.from().select().eq().single.mockImplementation(() => {
        callCount++;
        // Return admin for first call, user for subsequent calls
        const userData = callCount === 1 ? mockUsers.admin : mockUsers.user;
        return Promise.resolve({
          data: userData,
          error: null
        });
      });

      const requests = [
        request(app).get('/admin-only').set('Authorization', `Bearer ${adminToken}`),
        request(app).get('/admin-only').set('Authorization', `Bearer ${userToken}`)
      ];

      const responses = await Promise.all(requests);

      // First should succeed (admin), second should fail (user)
      expect(responses[0].status).toBe(200);
      expect(responses[1].status).toBe(403);
    });
  });

  describe('Error Handling Security', () => {
    test('should not expose role information in error messages', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).not.toContain('admin');
      expect(response.body.error.message).not.toContain('user_role');
      expect(response.body.error.message).not.toContain('permission');
    });

    test('should handle database errors during permission checks gracefully', async () => {
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { message: 'Database connection failed' }
      });

      const response = await request(app)
        .get('/users-read-profile')
        .set('Authorization', `Bearer ${userToken}`);

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });

  describe('Permission Bypass Attempts', () => {
    test('should prevent middleware bypass through request manipulation', async () => {
      // Attempt to bypass middleware by manipulating request
      const mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockUsers.user,
        error: null
      });

      const response = await request(app)
        .get('/admin-only')
        .set('Authorization', `Bearer ${userToken}`)
        .set('X-Skip-Auth', 'true')
        .set('X-Admin-Override', 'true');

      expect(response.status).toBe(403);
      expect(response.body).toHaveProperty('error');
    });

    test('should prevent direct endpoint access without authentication', async () => {
      const response = await request(app)
        .get('/admin-only');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('error');
    });
  });
}); 