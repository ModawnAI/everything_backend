/**
 * Admin User Management Service Unit Tests
 * 
 * Comprehensive test suite for admin user management functionality
 * including user status changes, role updates, and notification integration
 */

import { AdminUserManagementService } from '../../src/services/admin-user-management.service';
import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    broadcastUserStatusChange: jest.fn(),
    broadcastUserRoleChange: jest.fn()
  }
}));

describe('AdminUserManagementService', () => {
  let adminUserManagementService: AdminUserManagementService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock Supabase client with proper chaining
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
      select: jest.fn(() => mockChain)
    };

    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => mockChain),
        insert: jest.fn(() => mockChain),
        update: jest.fn(() => mockChain),
        delete: jest.fn(() => mockChain)
      }))
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    adminUserManagementService = new (AdminUserManagementService as any)();
  });

  describe('User Status Management', () => {
    describe('updateUserStatus', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_status: 'active'
      };

      const mockUpdatedUser = {
        ...mockUser,
        user_status: 'suspended',
        updated_at: new Date().toISOString()
      };

      beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();

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

        // Mock notification service
        jest.spyOn(adminUserManagementService as any, 'sendUserStatusChangeNotification')
          .mockResolvedValue(undefined);
      });

      it('should update user status successfully', async () => {
        const request = {
          status: 'suspended' as const,
          reason: 'Terms of service violation',
          adminNotes: 'Multiple complaints received',
          notifyUser: true
        };

        const result = await adminUserManagementService.updateUserStatus(
          'user-123',
          request,
          'admin-456'
        );

        expect(result.success).toBe(true);
        expect(result.user.previousStatus).toBe('active');
        expect(result.user.newStatus).toBe('suspended');
        expect(result.action.type).toBe('status_update');
        expect(result.action.reason).toBe(request.reason);

        // Verify database calls
        expect(mockSupabase.from).toHaveBeenCalledWith('users');
        expect(mockSupabase.from().update).toHaveBeenCalled();
        expect(mockSupabase.from().insert).toHaveBeenCalled();
      });

      it('should handle user not found error', async () => {
        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: null,
          error: { message: 'User not found' }
        });

        const request = {
          status: 'suspended' as const,
          reason: 'Test reason',
          adminNotes: 'Test notes',
          notifyUser: false
        };

        await expect(
          adminUserManagementService.updateUserStatus('invalid-user', request, 'admin-456')
        ).rejects.toThrow('User not found');
      });

      it('should handle database update errors', async () => {
        mockSupabase.from().update().eq().mockResolvedValueOnce({
          error: { message: 'Update failed' }
        });

        const request = {
          status: 'suspended' as const,
          reason: 'Test reason',
          adminNotes: 'Test notes',
          notifyUser: false
        };

        await expect(
          adminUserManagementService.updateUserStatus('user-123', request, 'admin-456')
        ).rejects.toThrow('Failed to update user status');
      });

      it('should send notification when notifyUser is true', async () => {
        const request = {
          status: 'suspended' as const,
          reason: 'Terms violation',
          adminNotes: 'Test notes',
          notifyUser: true
        };

        await adminUserManagementService.updateUserStatus('user-123', request, 'admin-456');

        expect(adminUserManagementService['sendUserStatusChangeNotification'])
          .toHaveBeenCalledWith('user-123', 'active', 'suspended', 'Terms violation');
      });

      it('should not send notification when notifyUser is false', async () => {
        const request = {
          status: 'suspended' as const,
          reason: 'Terms violation',
          adminNotes: 'Test notes',
          notifyUser: false
        };

        await adminUserManagementService.updateUserStatus('user-123', request, 'admin-456');

        expect(adminUserManagementService['sendUserStatusChangeNotification'])
          .not.toHaveBeenCalled();
      });
    });
  });

  describe('User Role Management', () => {
    describe('updateUserRole', () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'user'
      };

      beforeEach(() => {
        // Mock user lookup
        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: mockUser,
          error: null
        });

        // Mock user update
        mockSupabase.from().update().eq().mockResolvedValueOnce({
          error: null
        });

        // Mock admin lookup for websocket broadcast
        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: { name: 'Admin User' },
          error: null
        });

        // Mock role history insertion
        mockSupabase.from().insert().mockResolvedValueOnce({
          error: null
        });

        // Mock notification service
        jest.spyOn(adminUserManagementService as any, 'sendUserRoleChangeNotification')
          .mockResolvedValue(undefined);

        // Mock admin action logging
        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);
      });

      it('should update user role successfully', async () => {
        const request = {
          role: 'shop_owner' as const,
          reason: 'Business verification completed',
          adminNotes: 'All documents verified'
        };

        const result = await adminUserManagementService.updateUserRole(
          'user-123',
          request,
          'admin-456'
        );

        expect(result.success).toBe(true);
        expect(result.user.previousRole).toBe('user');
        expect(result.user.newRole).toBe('shop_owner');
        expect(result.action.type).toBe('role_update');
        expect(result.action.reason).toBe(request.reason);

        // Verify database calls
        expect(mockSupabase.from).toHaveBeenCalledWith('users');
        expect(mockSupabase.from().update).toHaveBeenCalled();
      });

      it('should prevent self-role modification for admins', async () => {
        const adminUser = {
          ...mockUser,
          id: 'admin-456',
          user_role: 'admin'
        };

        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: adminUser,
          error: null
        });

        const request = {
          role: 'user' as const,
          reason: 'Test reason',
          adminNotes: 'Test notes'
        };

        await expect(
          adminUserManagementService.updateUserRole('admin-456', request, 'admin-456')
        ).rejects.toThrow('Cannot remove admin role from yourself');
      });

      it('should send role change notification for upgrades', async () => {
        const request = {
          role: 'shop_owner' as const,
          reason: 'Business verification',
          adminNotes: 'Verified'
        };

        await adminUserManagementService.updateUserRole('user-123', request, 'admin-456');

        expect(adminUserManagementService['sendUserRoleChangeNotification'])
          .toHaveBeenCalledWith('user-123', 'user', 'shop_owner', 'Business verification');
      });
    });
  });

  describe('User Search and Filtering', () => {
    describe('getUsers', () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User One',
          user_role: 'user',
          user_status: 'active',
          created_at: new Date().toISOString()
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User Two',
          user_role: 'shop_owner',
          user_status: 'active',
          created_at: new Date().toISOString()
        }
      ];

      beforeEach(() => {
        // Mock user count query
        mockSupabase.from().select().mockResolvedValueOnce({
          data: [{ count: 2 }],
          error: null
        });

        // Mock user data query
        mockSupabase.from().select().order().limit().mockResolvedValueOnce({
          data: mockUsers,
          error: null
        });
      });

      it('should retrieve users with default filters', async () => {
        const result = await adminUserManagementService.getUsers({}, 'admin-456');

        expect(result.success).toBe(true);
        expect(result.data.users).toHaveLength(2);
        expect(result.data.totalCount).toBe(2);
        expect(result.data.currentPage).toBe(1);
      });

      it('should apply search filter', async () => {
        const filters = {
          search: 'user1@example.com'
        };

        await adminUserManagementService.getUsers(filters, 'admin-456');

        // Verify that search filter was applied
        expect(mockSupabase.from().select).toHaveBeenCalled();
      });

      it('should apply role filter', async () => {
        const filters = {
          role: ['shop_owner'] as const
        };

        await adminUserManagementService.getUsers(filters, 'admin-456');

        expect(mockSupabase.from().select).toHaveBeenCalled();
      });

      it('should apply status filter', async () => {
        const filters = {
          status: ['active'] as const
        };

        await adminUserManagementService.getUsers(filters, 'admin-456');

        expect(mockSupabase.from().select).toHaveBeenCalled();
      });

      it('should handle pagination', async () => {
        const filters = {
          page: 2,
          limit: 10
        };

        await adminUserManagementService.getUsers(filters, 'admin-456');

        expect(mockSupabase.from().select().order().limit).toHaveBeenCalled();
      });

      it('should handle database errors', async () => {
        mockSupabase.from().select().mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' }
        });

        await expect(
          adminUserManagementService.getUsers({}, 'admin-456')
        ).rejects.toThrow('Failed to fetch users');
      });
    });

    describe('getUserDetails', () => {
      const mockUserDetails = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_role: 'user',
        user_status: 'active',
        total_points: 1500,
        available_points: 1200,
        created_at: new Date().toISOString()
      };

      beforeEach(() => {
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: mockUserDetails,
          error: null
        });
      });

      it('should retrieve user details successfully', async () => {
        const result = await adminUserManagementService.getUserDetails('user-123', 'admin-456');

        expect(result.success).toBe(true);
        expect(result.data.id).toBe('user-123');
        expect(result.data.email).toBe('test@example.com');
      });

      it('should handle user not found', async () => {
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { message: 'User not found' }
        });

        await expect(
          adminUserManagementService.getUserDetails('invalid-user', 'admin-456')
        ).rejects.toThrow('User not found');
      });
    });
  });

  describe('Notification Integration', () => {
    describe('sendWelcomeNotification', () => {
      beforeEach(() => {
        // Mock notification service
        jest.spyOn(adminUserManagementService['notificationService'], 'sendUserManagementNotification')
          .mockResolvedValue({ id: 'notification-123' } as any);
      });

      it('should send welcome notification successfully', async () => {
        await adminUserManagementService.sendWelcomeNotification('user-123', 'Test User');

        expect(adminUserManagementService['notificationService'].sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'welcome',
            { userName: 'Test User' },
            { relatedId: 'user-123' }
          );
      });

      it('should handle notification errors gracefully', async () => {
        jest.spyOn(adminUserManagementService['notificationService'], 'sendUserManagementNotification')
          .mockRejectedValue(new Error('Notification failed'));

        // Should not throw error
        await expect(
          adminUserManagementService.sendWelcomeNotification('user-123', 'Test User')
        ).resolves.not.toThrow();

        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('sendProfileUpdateNotification', () => {
      beforeEach(() => {
        jest.spyOn(adminUserManagementService['notificationService'], 'sendUserManagementNotification')
          .mockResolvedValue({ id: 'notification-123' } as any);
      });

      it('should send profile update notification', async () => {
        await adminUserManagementService.sendProfileUpdateNotification(
          'user-123',
          ['name', 'email']
        );

        expect(adminUserManagementService['notificationService'].sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'profile_update_success',
            { updatedFields: 'name, email' },
            { relatedId: 'user-123' }
          );
      });
    });

    describe('sendSecurityAlertNotification', () => {
      beforeEach(() => {
        jest.spyOn(adminUserManagementService['notificationService'], 'sendUserManagementNotification')
          .mockResolvedValue({ id: 'notification-123' } as any);
      });

      it('should send password change alert', async () => {
        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'password_change',
          { device: 'iPhone 12' }
        );

        expect(adminUserManagementService['notificationService'].sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'password_changed',
            { device: 'iPhone 12' },
            { relatedId: 'user-123' }
          );
      });

      it('should send new device login alert', async () => {
        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'new_device_login',
          { device: 'Chrome on Windows' }
        );

        expect(adminUserManagementService['notificationService'].sendUserManagementNotification)
          .toHaveBeenCalledWith(
            'user-123',
            'login_from_new_device',
            { device: 'Chrome on Windows' },
            { relatedId: 'user-123' }
          );
      });

      it('should ignore unknown alert types', async () => {
        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'unknown_alert' as any
        );

        expect(adminUserManagementService['notificationService'].sendUserManagementNotification)
          .not.toHaveBeenCalled();
      });
    });
  });

  describe('Helper Methods', () => {
    describe('getRoleDisplayName', () => {
      it('should return Korean display names for roles', () => {
        expect(adminUserManagementService['getRoleDisplayName']('user')).toBe('일반 사용자');
        expect(adminUserManagementService['getRoleDisplayName']('shop_owner')).toBe('샵 운영자');
        expect(adminUserManagementService['getRoleDisplayName']('admin')).toBe('관리자');
        expect(adminUserManagementService['getRoleDisplayName']('influencer')).toBe('인플루언서');
      });

      it('should return original role for unknown roles', () => {
        expect(adminUserManagementService['getRoleDisplayName']('unknown_role')).toBe('unknown_role');
      });
    });
  });

  describe('Error Handling and Logging', () => {
    it('should log admin actions appropriately', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        name: 'Test User',
        user_status: 'active'
      };

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: mockUser,
        error: null
      });

      mockSupabase.from().update().eq().mockResolvedValue({
        error: null
      });

      mockSupabase.from().select().eq().single.mockResolvedValue({
        data: { name: 'Admin User' },
        error: null
      });

      mockSupabase.from().insert().mockResolvedValue({
        error: null
      });

      jest.spyOn(adminUserManagementService as any, 'sendUserStatusChangeNotification')
        .mockResolvedValue(undefined);

      const request = {
        status: 'suspended' as const,
        reason: 'Test reason',
        adminNotes: 'Test notes',
        notifyUser: false
      };

      await adminUserManagementService.updateUserStatus('user-123', request, 'admin-456');

      expect(logger.info).toHaveBeenCalledWith(
        'Admin updating user status',
        expect.objectContaining({
          adminId: 'admin-456',
          userId: 'user-123',
          request
        })
      );
    });

    it('should handle and log errors appropriately', async () => {
      mockSupabase.from().select().eq().single.mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = {
        status: 'suspended' as const,
        reason: 'Test reason',
        adminNotes: 'Test notes',
        notifyUser: false
      };

      await expect(
        adminUserManagementService.updateUserStatus('user-123', request, 'admin-456')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
