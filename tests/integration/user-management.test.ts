/**
 * User Management Integration Tests
 * 
 * Comprehensive integration test suite for user management features including:
 * - Admin user management operations
 * - User profile management
 * - User settings management
 * - Notification system integration
 * - Response standardization
 * - Security and authorization
 */

import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '../../src/config/database';
import { applyResponseStandardization } from '../../src/middleware/response-standardization.middleware';
import { errorHandler } from '../../src/middleware/error-handling.middleware';
import { authenticateJWT } from '../../src/middleware/auth.middleware';
import { requireAdmin } from '../../src/middleware/rbac.middleware';
import { adminUserManagementController } from '../../src/controllers/admin-user-management.controller';
import { userProfileController } from '../../src/controllers/user-profile.controller';
import { userSettingsController } from '../../src/controllers/user-settings.controller';
import { NotificationService } from '../../src/services/notification.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('User Management Integration Tests', () => {
  let app: express.Application;
  let mockSupabase: any;
  let mockNotificationService: jest.Mocked<NotificationService>;

  // Test data
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
    nickname: 'testuser',
    user_role: 'user',
    user_status: 'active',
    phone_number: '+82-10-1234-5678',
    phone_verified: true,
    birth_date: '1990-01-01',
    gender: 'female',
    total_points: 1500,
    available_points: 1200,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  const mockUserSettings = {
    user_id: 'user-123',
    push_notifications_enabled: true,
    reservation_notifications: true,
    event_notifications: true,
    marketing_notifications: false,
    location_tracking_enabled: true,
    language_preference: 'ko',
    currency_preference: 'KRW',
    theme_preference: 'light',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeAll(() => {
    // Create Express app with middleware
    app = express();
    app.use(express.json());
    app.use(applyResponseStandardization());

    // Mock authentication middleware
    app.use('/api/admin/*', (req: any, res, next) => {
      req.user = mockAdmin;
      next();
    });

    app.use('/api/user/*', (req: any, res, next) => {
      req.user = mockUser;
      next();
    });

    // Admin routes
    app.get('/api/admin/users', adminUserManagementController.getUsers);
    app.get('/api/admin/users/:id', adminUserManagementController.getUserDetails);
    app.put('/api/admin/users/:id/status', adminUserManagementController.updateUserStatus);
    app.put('/api/admin/users/:id/role', adminUserManagementController.updateUserRole);
    app.get('/api/admin/users/statistics', adminUserManagementController.getUserStatistics);

    // User routes
    app.get('/api/user/profile', userProfileController.getProfile);
    app.put('/api/user/profile', userProfileController.updateProfile);
    app.get('/api/user/settings', userSettingsController.getSettings);
    app.put('/api/user/settings', userSettingsController.updateSettings);

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
      in: jest.fn(() => mockChain),
      gte: jest.fn(() => mockChain),
      lte: jest.fn(() => mockChain),
      ilike: jest.fn(() => mockChain),
      or: jest.fn(() => mockChain),
      select: jest.fn(() => mockChain),
      insert: jest.fn(() => mockChain),
      update: jest.fn(() => mockChain),
      delete: jest.fn(() => mockChain)
    };

    mockSupabase = {
      from: jest.fn(() => mockChain)
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    // Mock notification service
    mockNotificationService = {
      sendUserManagementNotification: jest.fn(),
      sendBulkUserManagementNotifications: jest.fn(),
      registerDeviceToken: jest.fn(),
      unregisterDeviceToken: jest.fn(),
      getUserNotificationPreferences: jest.fn(),
      updateUserNotificationPreferences: jest.fn()
    } as any;

    (NotificationService as jest.Mock).mockImplementation(() => mockNotificationService);
  });

  describe('Admin User Management', () => {
    describe('GET /api/admin/users', () => {
      beforeEach(() => {
        // Mock user count query
        mockSupabase.from().select.mockReturnValueOnce({
          single: jest.fn().mockResolvedValue({
            data: { count: 2 },
            error: null
          })
        });

        // Mock user data query
        mockSupabase.from().select().order().limit.mockReturnValueOnce({
          mockResolvedValue: jest.fn().mockResolvedValue({
            data: [mockUser, { ...mockUser, id: 'user-456', email: 'user2@example.com' }],
            error: null
          })
        });
      });

      it('should return standardized response with user list', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            users: expect.any(Array),
            totalCount: expect.any(Number),
            currentPage: expect.any(Number)
          }),
          timestamp: expect.any(String)
        });

        expect(response.headers['x-api-version']).toBeDefined();
        expect(response.headers['x-request-id']).toBeDefined();
      });

      it('should apply search filters', async () => {
        await request(app)
          .get('/api/admin/users?search=test@example.com')
          .expect(200);

        expect(mockSupabase.from).toHaveBeenCalledWith('users');
      });

      it('should apply role filters', async () => {
        await request(app)
          .get('/api/admin/users?role=shop_owner')
          .expect(200);

        expect(mockSupabase.from).toHaveBeenCalledWith('users');
      });

      it('should handle pagination', async () => {
        await request(app)
          .get('/api/admin/users?page=2&limit=10')
          .expect(200);

        expect(mockSupabase.from).toHaveBeenCalledWith('users');
      });
    });

    describe('GET /api/admin/users/:id', () => {
      beforeEach(() => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });
      });

      it('should return user details with standardized response', async () => {
        const response = await request(app)
          .get('/api/admin/users/user-123')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User'
          }),
          timestamp: expect.any(String)
        });
      });

      it('should return 404 for non-existent user', async () => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'User not found' }
          })
        });

        const response = await request(app)
          .get('/api/admin/users/invalid-user')
          .expect(404);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: expect.any(String),
            message: expect.any(String)
          })
        });
      });
    });

    describe('PUT /api/admin/users/:id/status', () => {
      beforeEach(() => {
        // Mock user lookup
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        // Mock user update
        mockSupabase.from().update().eq.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });

        // Mock status history insertion
        mockSupabase.from().insert.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });
      });

      it('should update user status successfully', async () => {
        const statusUpdate = {
          status: 'suspended',
          reason: 'Terms of service violation',
          adminNotes: 'Multiple complaints received',
          notifyUser: true
        };

        const response = await request(app)
          .put('/api/admin/users/user-123/status')
          .send(statusUpdate)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 'user-123',
              previousStatus: 'active',
              newStatus: 'suspended'
            }),
            action: expect.objectContaining({
              type: 'status_update',
              reason: statusUpdate.reason
            })
          })
        });
      });

      it('should send notification when notifyUser is true', async () => {
        const statusUpdate = {
          status: 'suspended',
          reason: 'Terms violation',
          adminNotes: 'Test notes',
          notifyUser: true
        };

        await request(app)
          .put('/api/admin/users/user-123/status')
          .send(statusUpdate)
          .expect(200);

        expect(mockNotificationService.sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'account_suspended',
            expect.any(Object),
            expect.any(Object)
          );
      });

      it('should validate request body', async () => {
        const invalidUpdate = {
          status: 'invalid_status',
          reason: 'Too short'
        };

        const response = await request(app)
          .put('/api/admin/users/user-123/status')
          .send(invalidUpdate)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        });
      });
    });

    describe('PUT /api/admin/users/:id/role', () => {
      beforeEach(() => {
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

        mockSupabase.from().insert.mockReturnValue({
          mockResolvedValue: jest.fn().mockResolvedValue({
            error: null
          })
        });
      });

      it('should update user role successfully', async () => {
        const roleUpdate = {
          role: 'shop_owner',
          reason: 'Business verification completed',
          adminNotes: 'All documents verified'
        };

        const response = await request(app)
          .put('/api/admin/users/user-123/role')
          .send(roleUpdate)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            user: expect.objectContaining({
              id: 'user-123',
              previousRole: 'user',
              newRole: 'shop_owner'
            }),
            action: expect.objectContaining({
              type: 'role_update',
              reason: roleUpdate.reason
            })
          })
        });
      });

      it('should send role upgrade notification', async () => {
        const roleUpdate = {
          role: 'shop_owner',
          reason: 'Business verification',
          adminNotes: 'Verified'
        };

        await request(app)
          .put('/api/admin/users/user-123/role')
          .send(roleUpdate)
          .expect(200);

        expect(mockNotificationService.sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'role_upgraded',
            expect.any(Object),
            expect.any(Object)
          );
      });
    });

    describe('GET /api/admin/users/statistics', () => {
      beforeEach(() => {
        // Mock statistics queries
        mockSupabase.from().select.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: {
              total_users: 100,
              active_users: 85,
              new_users_today: 5,
              new_users_week: 25,
              new_users_month: 80
            },
            error: null
          })
        });
      });

      it('should return user statistics', async () => {
        const response = await request(app)
          .get('/api/admin/users/statistics')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            totalUsers: expect.any(Number),
            activeUsers: expect.any(Number),
            newUsersToday: expect.any(Number)
          })
        });
      });

      it('should handle period parameter', async () => {
        await request(app)
          .get('/api/admin/users/statistics?period=7d')
          .expect(200);

        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });
  });

  describe('User Profile Management', () => {
    describe('GET /api/user/profile', () => {
      beforeEach(() => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });
      });

      it('should return user profile with standardized response', async () => {
        const response = await request(app)
          .get('/api/user/profile')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            id: 'user-123',
            email: 'user@example.com',
            name: 'Test User'
          }),
          timestamp: expect.any(String)
        });
      });
    });

    describe('PUT /api/user/profile', () => {
      beforeEach(() => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUser,
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockUser, name: 'Updated Name' },
              error: null
            })
          })
        });
      });

      it('should update user profile successfully', async () => {
        const profileUpdate = {
          name: 'Updated Name',
          nickname: 'updated_user',
          marketingConsent: false
        };

        const response = await request(app)
          .put('/api/user/profile')
          .send(profileUpdate)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            name: 'Updated Name'
          }),
          message: expect.any(String)
        });
      });

      it('should send profile update notification', async () => {
        const profileUpdate = {
          name: 'Updated Name',
          email: 'newemail@example.com'
        };

        await request(app)
          .put('/api/user/profile')
          .send(profileUpdate)
          .expect(200);

        expect(mockNotificationService.sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'profile_update_success',
            expect.any(Object),
            expect.any(Object)
          );
      });

      it('should validate profile data', async () => {
        const invalidUpdate = {
          email: 'invalid-email',
          name: 'A' // Too short
        };

        const response = await request(app)
          .put('/api/user/profile')
          .send(invalidUpdate)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        });
      });
    });
  });

  describe('User Settings Management', () => {
    describe('GET /api/user/settings', () => {
      beforeEach(() => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUserSettings,
            error: null
          })
        });
      });

      it('should return user settings with standardized response', async () => {
        const response = await request(app)
          .get('/api/user/settings')
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            userId: 'user-123',
            pushNotificationsEnabled: true,
            languagePreference: 'ko'
          }),
          timestamp: expect.any(String)
        });
      });
    });

    describe('PUT /api/user/settings', () => {
      beforeEach(() => {
        mockSupabase.from().select().eq.mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: mockUserSettings,
            error: null
          })
        });

        mockSupabase.from().update().eq.mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: { ...mockUserSettings, push_notifications_enabled: false },
              error: null
            })
          })
        });
      });

      it('should update user settings successfully', async () => {
        const settingsUpdate = {
          pushNotificationsEnabled: false,
          marketingNotifications: true,
          themePreference: 'dark'
        };

        const response = await request(app)
          .put('/api/user/settings')
          .send(settingsUpdate)
          .expect(200);

        expect(response.body).toMatchObject({
          success: true,
          data: expect.objectContaining({
            pushNotificationsEnabled: false
          }),
          message: expect.any(String)
        });
      });

      it('should validate settings data', async () => {
        const invalidUpdate = {
          languagePreference: 'invalid_language',
          themePreference: 'invalid_theme'
        };

        const response = await request(app)
          .put('/api/user/settings')
          .send(invalidUpdate)
          .expect(400);

        expect(response.body).toMatchObject({
          success: false,
          error: expect.objectContaining({
            code: 'VALIDATION_ERROR'
          })
        });
      });
    });
  });

  describe('Response Standardization', () => {
    it('should include standard headers in all responses', async () => {
      const response = await request(app)
        .get('/api/user/profile')
        .expect(200);

      expect(response.headers['x-api-version']).toBeDefined();
      expect(response.headers['x-request-id']).toBeDefined();
      expect(response.headers['content-type']).toContain('application/json');
    });

    it('should include execution time in metadata', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(200);

      if (response.body.meta) {
        expect(response.body.meta.executionTime).toBeGreaterThanOrEqual(0);
        expect(response.body.meta.version).toBe('1.0.0');
      }
    });

    it('should handle errors with standardized format', async () => {
      // Force an error by mocking database failure
      mockSupabase.from().select().eq.mockReturnValue({
        single: jest.fn().mockRejectedValue(new Error('Database error'))
      });

      const response = await request(app)
        .get('/api/user/profile')
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: expect.any(String),
          message: expect.any(String),
          timestamp: expect.any(String)
        })
      });
    });
  });

  describe('Security and Authorization', () => {
    it('should require authentication for protected routes', async () => {
      // Create app without auth middleware
      const unauthedApp = express();
      unauthedApp.use(express.json());
      unauthedApp.use(applyResponseStandardization());
      unauthedApp.get('/api/user/profile', userProfileController.getProfile);
      unauthedApp.use(errorHandler);

      const response = await request(unauthedApp)
        .get('/api/user/profile')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'UNAUTHORIZED'
        })
      });
    });

    it('should require admin role for admin routes', async () => {
      // Create app with user auth instead of admin
      const userApp = express();
      userApp.use(express.json());
      userApp.use(applyResponseStandardization());
      userApp.use('/api/admin/*', (req: any, res, next) => {
        req.user = { ...mockUser, user_role: 'user' }; // Regular user, not admin
        next();
      });
      userApp.get('/api/admin/users', adminUserManagementController.getUsers);
      userApp.use(errorHandler);

      const response = await request(userApp)
        .get('/api/admin/users')
        .expect(403);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.objectContaining({
          code: 'FORBIDDEN'
        })
      });
    });
  });

  describe('Notification Integration', () => {
    it('should integrate with notification service for user events', async () => {
      mockSupabase.from().select().eq.mockReturnValue({
        single: jest.fn().mockResolvedValue({
          data: mockUser,
          error: null
        })
      });

      mockSupabase.from().update().eq.mockReturnValue({
        select: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({
            data: { ...mockUser, name: 'Updated Name' },
            error: null
          })
        })
      });

      await request(app)
        .put('/api/user/profile')
        .send({ name: 'Updated Name' })
        .expect(200);

      expect(mockNotificationService.sendUserManagementNotification)
        .toHaveBeenCalled();
    });

    it('should handle notification service failures gracefully', async () => {
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

      // Mock notification service failure
      mockNotificationService.sendUserManagementNotification.mockRejectedValue(
        new Error('Notification service unavailable')
      );

      // The main operation should still succeed
      const response = await request(app)
        .put('/api/admin/users/user-123/status')
        .send({
          status: 'suspended',
          reason: 'Test reason',
          adminNotes: 'Test notes',
          notifyUser: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });
});
