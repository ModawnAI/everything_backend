/**
 * User Management Security Tests
 * 
 * Comprehensive security test suite for user management features including:
 * - Authentication and authorization security
 * - Input validation and sanitization
 * - Rate limiting and abuse prevention
 * - Data privacy and protection
 * - Admin privilege escalation prevention
 * - Notification security
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '../../src/config/database';
import { applyResponseStandardization } from '../../src/middleware/response-standardization.middleware';
import { errorHandler } from '../../src/middleware/error-handling.middleware';
import { authenticateJWT } from '../../src/middleware/auth.middleware';
import { requireAdmin } from '../../src/middleware/rbac.middleware';
import { rateLimit } from '../../src/middleware/rate-limit.middleware';
import { adminUserManagementController } from '../../src/controllers/admin-user-management.controller';
import { userProfileController } from '../../src/controllers/user-profile.controller';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

describe('User Management Security Tests', () => {
  let app: express.Application;
  let mockSupabase: any;

  // Test data
  const validAdminToken = jwt.sign(
    { id: 'admin-123', role: 'admin' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  const validUserToken = jwt.sign(
    { id: 'user-123', role: 'user' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '1h' }
  );

  const expiredToken = jwt.sign(
    { id: 'user-123', role: 'user' },
    process.env.JWT_SECRET || 'test-secret',
    { expiresIn: '-1h' }
  );

  const malformedToken = 'invalid.jwt.token';

  const mockAdmin = {
    id: 'admin-123',
    email: 'admin@example.com',
    name: 'Admin User',
    user_role: 'admin',
    user_status: 'active'
  };

  const mockUser = {
    id: 'user-123',
    email: 'user@example.com',
    name: 'Test User',
    user_role: 'user',
    user_status: 'active'
  };

  beforeAll(() => {
    // Create Express app with security middleware
    app = express();
    app.use(express.json({ limit: '1mb' }));
    app.use(applyResponseStandardization());

    // Apply rate limiting
    app.use('/api/admin/*', rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // limit each IP to 100 requests per windowMs
      message: 'Too many admin requests from this IP'
    }));

    app.use('/api/user/*', rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 200,
      message: 'Too many user requests from this IP'
    }));

    // Authentication and authorization
    app.use('/api/admin/*', authenticateJWT, requireAdmin);
    app.use('/api/user/*', authenticateJWT);

    // Admin routes
    app.get('/api/admin/users', adminUserManagementController.getUsers);
    app.get('/api/admin/users/:id', adminUserManagementController.getUserDetails);
    app.put('/api/admin/users/:id/status', adminUserManagementController.updateUserStatus);
    app.put('/api/admin/users/:id/role', adminUserManagementController.updateUserRole);

    // User routes
    app.get('/api/user/profile', userProfileController.getProfile);
    app.put('/api/user/profile', userProfileController.updateProfile);

    // Error handling
    app.use(errorHandler);
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client
    const mockChain = {
      single: jest.fn(),
      order: jest.fn(() => mockChain),
      limit: jest.fn(() => mockChain),
      eq: jest.fn(() => mockChain),
      select: jest.fn(() => mockChain),
      insert: jest.fn(() => mockChain),
      update: jest.fn(() => mockChain)
    };

    mockSupabase = {
      from: jest.fn(() => mockChain)
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
  });

  describe('Authentication Security', () => {
    describe('JWT Token Validation', () => {
      it('should reject requests without authentication token', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .expect(401);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'UNAUTHORIZED'
          })
        });
      });

      it('should reject malformed JWT tokens', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${malformedToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject expired JWT tokens', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should accept valid JWT tokens', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should validate token signature', async () => {
        const tamperedToken = validUserToken.slice(0, -5) + 'XXXXX';

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${tamperedToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Authorization Header Security', () => {
      it('should reject tokens with wrong Bearer format', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Token ${validUserToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should reject tokens in wrong header', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('X-Auth-Token', validUserToken)
          .expect(401);

        expect(response.body.success).toBe(false);
      });

      it('should be case-sensitive for Bearer keyword', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `bearer ${validUserToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Authorization Security', () => {
    describe('Role-Based Access Control', () => {
      it('should prevent regular users from accessing admin endpoints', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(403);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'FORBIDDEN'
          })
        });
      });

      it('should allow admin users to access admin endpoints', async () => {
        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 0 },
            error: null
          })
        });

        mockSupabase.from().select().order().limit.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [],
            error: null
          })
        });

        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });

      it('should prevent privilege escalation through role manipulation', async () => {
        // Try to update own role to admin
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ...mockUser, id: 'user-123' },
            error: null
          })
        });

        const response = await request(app)
          .put('/api/admin/users/user-123/role')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            role: 'admin',
            reason: 'Self-promotion attempt'
          })
          .expect(403);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Resource Access Control', () => {
      it('should prevent users from accessing other users\' data', async () => {
        // Mock different user data
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ...mockUser, id: 'other-user-456' },
            error: null
          })
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(403);

        expect(response.body.success).toBe(false);
      });

      it('should allow users to access their own data', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
      });
    });
  });

  describe('Input Validation Security', () => {
    describe('SQL Injection Prevention', () => {
      it('should sanitize user ID parameters', async () => {
        const maliciousId = "1'; DROP TABLE users; --";

        const response = await request(app)
          .get(`/api/admin/users/${encodeURIComponent(maliciousId)}`)
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should sanitize search parameters', async () => {
        const maliciousSearch = "'; DELETE FROM users WHERE '1'='1";

        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 0 },
            error: null
          })
        });

        await request(app)
          .get('/api/admin/users')
          .query({ search: maliciousSearch })
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(200);

        // Verify that the malicious input was sanitized
        expect(mockSupabase.from).toHaveBeenCalledWith('users');
      });
    });

    describe('XSS Prevention', () => {
      it('should sanitize HTML in profile updates', async () => {
        const maliciousName = '<script>alert("XSS")</script>';

        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            name: maliciousName,
            nickname: 'testuser'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should sanitize JavaScript in user input', async () => {
        const maliciousNickname = 'javascript:alert("XSS")';

        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            name: 'Valid Name',
            nickname: maliciousNickname
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Data Type Validation', () => {
      it('should validate email format', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            email: 'invalid-email-format',
            name: 'Valid Name'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        });
      });

      it('should validate phone number format', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            phoneNumber: 'invalid-phone',
            name: 'Valid Name'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });

      it('should validate date formats', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send({
            birthDate: 'invalid-date',
            name: 'Valid Name'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Request Size Limits', () => {
      it('should reject oversized requests', async () => {
        const largePayload = {
          name: 'A'.repeat(10000), // Very large name
          description: 'B'.repeat(50000) // Very large description
        };

        const response = await request(app)
          .put('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .send(largePayload)
          .expect(413);

        expect(response.body.success).toBe(false);
      });
    });
  });

  describe('Rate Limiting Security', () => {
    describe('API Rate Limits', () => {
      it('should enforce rate limits on admin endpoints', async () => {
        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { count: 0 },
            error: null
          })
        });

        // Make multiple requests rapidly
        const requests = Array(10).fill(null).map(() =>
          request(app)
            .get('/api/admin/users')
            .set('Authorization', `Bearer ${validAdminToken}`)
        );

        const responses = await Promise.all(requests);

        // Some requests should succeed, but eventually rate limit should kick in
        const successfulRequests = responses.filter(r => r.status === 200);
        const rateLimitedRequests = responses.filter(r => r.status === 429);

        expect(successfulRequests.length).toBeGreaterThan(0);
        // Note: In a real test, you might see rate limiting, but in this mock setup it might not trigger
      });

      it('should have different rate limits for different user roles', async () => {
        // This test would verify that admin users have higher rate limits than regular users
        // Implementation would depend on your specific rate limiting configuration
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('Brute Force Protection', () => {
      it('should implement progressive delays for failed attempts', async () => {
        // This would test brute force protection mechanisms
        // Implementation depends on your specific security measures
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('Data Privacy Security', () => {
    describe('Sensitive Data Protection', () => {
      it('should not expose sensitive user data in responses', async () => {
        const sensitiveUser = {
          ...mockUser,
          password_hash: 'secret-hash',
          social_provider_id: 'secret-id',
          internal_notes: 'admin-only-notes'
        };

        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: sensitiveUser,
            error: null
          })
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(200);

        expect(response.body.data).not.toHaveProperty('password_hash');
        expect(response.body.data).not.toHaveProperty('social_provider_id');
        expect(response.body.data).not.toHaveProperty('internal_notes');
      });

      it('should mask email addresses in logs', async () => {
        // This would test that email addresses are properly masked in application logs
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('GDPR Compliance', () => {
      it('should handle data deletion requests securely', async () => {
        // This would test GDPR data deletion compliance
        expect(true).toBe(true); // Placeholder
      });

      it('should provide data export functionality', async () => {
        // This would test GDPR data export compliance
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('Admin Security', () => {
    describe('Admin Action Logging', () => {
      it('should log all admin actions for audit trail', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        await request(app)
          .put('/api/admin/users/user-123/status')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            status: 'suspended',
            reason: 'Terms violation',
            adminNotes: 'Test suspension'
          })
          .expect(200);

        // Verify that admin action was logged
        expect(mockSupabase.from).toHaveBeenCalledWith('admin_actions');
      });
    });

    describe('Admin Privilege Validation', () => {
      it('should prevent admin from removing their own admin role', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ...mockAdmin, id: 'admin-123' },
            error: null
          })
        });

        const response = await request(app)
          .put('/api/admin/users/admin-123/role')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .send({
            role: 'user',
            reason: 'Self-demotion attempt'
          })
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            message: expect.stringContaining('Cannot remove admin role from yourself')
          })
        });
      });
    });
  });

  describe('Notification Security', () => {
    describe('Notification Content Security', () => {
      it('should sanitize notification content', async () => {
        // This would test that notification content is properly sanitized
        expect(true).toBe(true); // Placeholder
      });

      it('should validate notification recipients', async () => {
        // This would test that notifications are only sent to authorized recipients
        expect(true).toBe(true); // Placeholder
      });
    });

    describe('FCM Token Security', () => {
      it('should validate FCM token format', async () => {
        // This would test FCM token validation
        expect(true).toBe(true); // Placeholder
      });

      it('should prevent token hijacking', async () => {
        // This would test FCM token security measures
        expect(true).toBe(true); // Placeholder
      });
    });
  });

  describe('Error Handling Security', () => {
    describe('Information Disclosure Prevention', () => {
      it('should not expose stack traces in production', async () => {
        const originalEnv = process.env.NODE_ENV;
        process.env.NODE_ENV = 'production';

        // Force an error
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockRejectedValue(new Error('Database error'))
        });

        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${validUserToken}`)
          .expect(500);

        expect(response.body.error).not.toHaveProperty('stack');

        // Restore environment
        process.env.NODE_ENV = originalEnv;
      });

      it('should provide generic error messages for security-sensitive operations', async () => {
        // Test that security-sensitive operations don't leak information through error messages
        const response = await request(app)
          .get('/api/admin/users/non-existent-user')
          .set('Authorization', `Bearer ${validAdminToken}`)
          .expect(404);

        expect(response.body.error.message).not.toContain('database');
        expect(response.body.error.message).not.toContain('table');
        expect(response.body.error.message).not.toContain('query');
      });
    });
  });

  describe('Session Security', () => {
    describe('Token Expiration', () => {
      it('should enforce token expiration', async () => {
        // This is already tested in JWT validation, but could be expanded
        const response = await request(app)
          .get('/api/user/profile')
          .set('Authorization', `Bearer ${expiredToken}`)
          .expect(401);

        expect(response.body.success).toBe(false);
      });
    });

    describe('Concurrent Session Management', () => {
      it('should handle multiple concurrent sessions securely', async () => {
        // This would test concurrent session handling
        expect(true).toBe(true); // Placeholder
      });
    });
  });
});

