/**
 * Admin User Management Service Unit Tests
 *
 * Tests for admin user management functionality including
 * user status changes, role updates, and notification integration
 */

// Persistent mock object
const mockSupabase: any = {};

/**
 * Create a sequential from() mock.
 * Each call to from() resolves to the next result in the array.
 */
function createSequentialFromMock(results: any[]) {
  let callIndex = 0;
  return jest.fn(() => {
    const result = results[callIndex] || { data: null, error: null };
    callIndex++;
    const chain: any = {};
    ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
     'like','ilike','is','in','not','contains','containedBy','overlaps',
     'filter','match','or','and','order','limit','range','offset','count',
     'single','maybeSingle','csv','returns','textSearch','throwOnError'
    ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then = (resolve: any) => resolve(result);
    return chain;
  });
}

/**
 * Create a table-aware from() mock.
 */
function createTableAwareFromMock(tableOverrides: Record<string, any> = {}) {
  const defaultResult = { data: null, error: null };
  return jest.fn((tableName: string) => {
    const result = tableOverrides[tableName] || defaultResult;
    const chain: any = {};
    ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
     'like','ilike','is','in','not','contains','containedBy','overlaps',
     'filter','match','or','and','order','limit','range','offset','count',
     'single','maybeSingle','csv','returns','textSearch','throwOnError'
    ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
    chain.then = (resolve: any) => resolve(result);
    return chain;
  });
}

function resetMockSupabase() {
  mockSupabase.from = createTableAwareFromMock();
  mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  mockSupabase.auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: { getUserById: jest.fn(), listUsers: jest.fn(), deleteUser: jest.fn() },
  };
  mockSupabase.storage = { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) };
}
resetMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  initializeDatabase: jest.fn(() => ({ client: mockSupabase })),
  getDatabase: jest.fn(() => ({ client: mockSupabase })),
  database: { getClient: jest.fn(() => mockSupabase) },
}));

jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    broadcastUserStatusChange: jest.fn(),
    broadcastUserRoleChange: jest.fn()
  }
}));

jest.mock('../../src/services/notification.service', () => ({
  NotificationService: jest.fn().mockImplementation(() => ({
    sendUserManagementNotification: jest.fn().mockResolvedValue({ id: 'notification-123' }),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  }))
}));

import { AdminUserManagementService } from '../../src/services/admin-user-management.service';
import { logger } from '../../src/utils/logger';

describe('AdminUserManagementService', () => {
  let adminUserManagementService: AdminUserManagementService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
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

      it('should update user status successfully', async () => {
        // updateUserStatus makes these sequential from() calls:
        // 1. from('users').select('*').eq('id', userId).single() → get user
        // 2. from('users').update({...}).eq('id', userId) → update user
        // 3. from('admin_audit_logs').insert({...}) → log admin action (inside logAdminAction)
        // 4. from('user_status_history').insert({...}) → create history
        // 5. from('users').select('name').eq('id', adminId).single() → get admin name
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },        // get user
          { error: null },                        // update user
          { error: null },                        // log admin action
          { error: null },                        // create status history
          { data: { name: 'Admin User' }, error: null }, // get admin name
        ]);

        jest.spyOn(adminUserManagementService as any, 'sendUserStatusChangeNotification')
          .mockResolvedValue(undefined);

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
      });

      it('should handle user not found error', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: null, error: { message: 'User not found' } }, // get user fails
        ]);

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
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },        // get user succeeds
          { error: { message: 'Update failed' } }, // update fails
        ]);

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
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },
          { error: null },
          { error: null },
          { error: null },
          { data: { name: 'Admin User' }, error: null },
        ]);

        const spy = jest.spyOn(adminUserManagementService as any, 'sendUserStatusChangeNotification')
          .mockResolvedValue(undefined);

        const request = {
          status: 'suspended' as const,
          reason: 'Terms violation',
          adminNotes: 'Test notes',
          notifyUser: true
        };

        await adminUserManagementService.updateUserStatus('user-123', request, 'admin-456');

        expect(spy).toHaveBeenCalledWith('user-123', 'active', 'suspended', 'Terms violation');
      });

      it('should not send notification when notifyUser is false', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },
          { error: null },
          { error: null },
          { error: null },
          { data: { name: 'Admin User' }, error: null },
        ]);

        const spy = jest.spyOn(adminUserManagementService as any, 'sendUserStatusChangeNotification')
          .mockResolvedValue(undefined);

        const request = {
          status: 'suspended' as const,
          reason: 'Terms violation',
          adminNotes: 'Test notes',
          notifyUser: false
        };

        await adminUserManagementService.updateUserStatus('user-123', request, 'admin-456');

        expect(spy).not.toHaveBeenCalled();
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

      it('should update user role successfully', async () => {
        // updateUserRole makes these sequential from() calls:
        // 1. from('users').select('*').eq('id', userId).single() → get user
        // 2. from('users').update({...}).eq('id', userId) → update role
        // 3. from('admin_audit_logs').insert({...}) → log admin action
        // 4. from('user_role_history').insert({...}) → create history
        // 5. from('users').select('name').eq('id', adminId).single() → get admin name (for ws broadcast)
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },
          { error: null },
          { error: null },
          { error: null },
          { data: { name: 'Admin User' }, error: null },
        ]);

        jest.spyOn(adminUserManagementService as any, 'sendUserRoleChangeNotification')
          .mockResolvedValue(undefined);
        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

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
      });

      it('should prevent self-role modification for admins', async () => {
        const adminUser = {
          id: 'admin-456',
          email: 'admin@example.com',
          name: 'Admin User',
          user_role: 'admin'
        };

        mockSupabase.from = createSequentialFromMock([
          { data: adminUser, error: null }, // get user returns admin user
        ]);

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
        mockSupabase.from = createSequentialFromMock([
          { data: mockUser, error: null },
          { error: null },
          { error: null },
          { error: null },
          { data: { name: 'Admin User' }, error: null },
        ]);

        const spy = jest.spyOn(adminUserManagementService as any, 'sendUserRoleChangeNotification')
          .mockResolvedValue(undefined);
        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const request = {
          role: 'shop_owner' as const,
          reason: 'Business verification',
          adminNotes: 'Verified'
        };

        await adminUserManagementService.updateUserRole('user-123', request, 'admin-456');

        expect(spy).toHaveBeenCalledWith('user-123', 'user', 'shop_owner', 'Business verification');
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
          phone_number: '010-1234-5678',
          phone_verified: true,
          nickname: null,
          gender: null,
          birth_date: null,
          is_influencer: false,
          influencer_qualified_at: null,
          social_provider: null,
          referral_code: 'ABC123',
          referred_by_code: null,
          total_points: 100,
          available_points: 100,
          total_referrals: 0,
          successful_referrals: 0,
          last_login_at: null,
          last_login_ip: null,
          terms_accepted_at: null,
          privacy_accepted_at: null,
          marketing_consent: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        },
        {
          id: 'user-2',
          email: 'user2@example.com',
          name: 'User Two',
          user_role: 'shop_owner',
          user_status: 'active',
          phone_number: '010-9876-5432',
          phone_verified: true,
          nickname: null,
          gender: null,
          birth_date: null,
          is_influencer: false,
          influencer_qualified_at: null,
          social_provider: null,
          referral_code: 'DEF456',
          referred_by_code: null,
          total_points: 200,
          available_points: 200,
          total_referrals: 0,
          successful_referrals: 0,
          last_login_at: null,
          last_login_ip: null,
          terms_accepted_at: null,
          privacy_accepted_at: null,
          marketing_consent: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      ];

      it('should retrieve users with default filters', async () => {
        // getUsers: first await gets count, second await gets data (same chain, same result)
        // Then logAdminAction does another from() call
        mockSupabase.from = createSequentialFromMock([
          { data: mockUsers, error: null, count: 2 }, // users query (count + data from same chain)
          { error: null }, // logAdminAction
        ]);

        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const result = await adminUserManagementService.getUsers({}, 'admin-456');

        // getUsers returns UserManagementResponse directly (no success/data wrapper)
        expect(result.users).toHaveLength(2);
        expect(result.totalCount).toBe(2);
        expect(result.currentPage).toBe(1);
      });

      it('should apply search filter', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: mockUsers, error: null, count: 2 },
          { error: null },
        ]);

        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const filters = {
          search: 'user1@example.com'
        };

        const result = await adminUserManagementService.getUsers(filters, 'admin-456');
        expect(result.users).toBeDefined();
      });

      it('should apply role filter', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: mockUsers, error: null, count: 2 },
          { error: null },
        ]);

        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const filters = {
          role: 'shop_owner' as const
        };

        const result = await adminUserManagementService.getUsers(filters, 'admin-456');
        expect(result.users).toBeDefined();
      });

      it('should apply status filter', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: mockUsers, error: null, count: 2 },
          { error: null },
        ]);

        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const filters = {
          status: 'active' as const
        };

        const result = await adminUserManagementService.getUsers(filters, 'admin-456');
        expect(result.users).toBeDefined();
      });

      it('should handle pagination', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: mockUsers, error: null, count: 2 },
          { error: null },
        ]);

        jest.spyOn(adminUserManagementService as any, 'logAdminAction')
          .mockResolvedValue(undefined);

        const filters = {
          page: 2,
          limit: 10
        };

        const result = await adminUserManagementService.getUsers(filters, 'admin-456');
        expect(result.currentPage).toBe(2);
      });

      it('should handle database errors', async () => {
        mockSupabase.from = createSequentialFromMock([
          { data: null, error: { message: 'Database error' }, count: null },
        ]);

        await expect(
          adminUserManagementService.getUsers({}, 'admin-456')
        ).rejects.toThrow();
      });
    });
  });

  describe('Notification Integration', () => {
    describe('sendWelcomeNotification', () => {
      it('should send welcome notification successfully', async () => {
        const notificationSpy = jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockResolvedValue({ id: 'notification-123' } as any);

        await adminUserManagementService.sendWelcomeNotification('user-123', 'Test User');

        expect(notificationSpy).toHaveBeenCalledWith(
          'user-123',
          'welcome',
          { userName: 'Test User' },
          { relatedId: 'user-123' }
        );
      });

      it('should handle notification errors gracefully', async () => {
        jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockRejectedValue(new Error('Notification failed'));

        // Should not throw error
        await expect(
          adminUserManagementService.sendWelcomeNotification('user-123', 'Test User')
        ).resolves.not.toThrow();

        expect(logger.error).toHaveBeenCalled();
      });
    });

    describe('sendProfileUpdateNotification', () => {
      it('should send profile update notification', async () => {
        const notificationSpy = jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockResolvedValue({ id: 'notification-123' } as any);

        await adminUserManagementService.sendProfileUpdateNotification(
          'user-123',
          ['name', 'email']
        );

        expect(notificationSpy).toHaveBeenCalledWith(
          'user-123',
          'profile_update_success',
          { updatedFields: 'name, email' },
          { relatedId: 'user-123' }
        );
      });
    });

    describe('sendSecurityAlertNotification', () => {
      it('should send password change alert', async () => {
        const notificationSpy = jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockResolvedValue({ id: 'notification-123' } as any);

        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'password_change',
          { device: 'iPhone 12' }
        );

        expect(notificationSpy).toHaveBeenCalledWith(
          'user-123',
          'password_changed',
          { device: 'iPhone 12' },
          { relatedId: 'user-123' }
        );
      });

      it('should send new device login alert', async () => {
        const notificationSpy = jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockResolvedValue({ id: 'notification-123' } as any);

        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'new_device_login',
          { device: 'Chrome on Windows' }
        );

        expect(notificationSpy).toHaveBeenCalledWith(
          'user-123',
          'login_from_new_device',
          { device: 'Chrome on Windows' },
          { relatedId: 'user-123' }
        );
      });

      it('should ignore unknown alert types', async () => {
        const notificationSpy = jest.spyOn(
          adminUserManagementService['notificationService'],
          'sendUserManagementNotification'
        ).mockResolvedValue({ id: 'notification-123' } as any);

        await adminUserManagementService.sendSecurityAlertNotification(
          'user-123',
          'unknown_alert' as any
        );

        expect(notificationSpy).not.toHaveBeenCalled();
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

      mockSupabase.from = createSequentialFromMock([
        { data: mockUser, error: null },
        { error: null },
        { error: null },
        { error: null },
        { data: { name: 'Admin User' }, error: null },
      ]);

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
      // Make the first from() call throw
      mockSupabase.from = jest.fn(() => {
        throw new Error('Database connection failed');
      });

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
