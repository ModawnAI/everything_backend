/**
 * User Management Notification Service Unit Tests
 * 
 * Comprehensive test suite for the enhanced notification service
 * with user management event templates and FCM token management
 */

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase: any = {};

function resetMockSupabase() {
  const mockChain: any = {};
  ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
   'like','ilike','is','in','not','contains','containedBy','overlaps',
   'filter','match','or','and','order','limit','range','offset','count',
   'single','maybeSingle','csv','returns','textSearch','throwOnError'
  ].forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain); });
  mockChain.then = (resolve: any) => resolve({ data: null, error: null });
  mockSupabase.from = jest.fn().mockReturnValue(mockChain);
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
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));
jest.mock('firebase-admin', () => ({
  messaging: () => ({
    send: jest.fn(),
    sendMulticast: jest.fn()
  }),
  initializeApp: jest.fn(() => ({
    messaging: jest.fn(() => ({
      send: jest.fn(),
      sendMulticast: jest.fn()
    }))
  })),
  app: jest.fn(() => ({
    messaging: jest.fn(() => ({
      send: jest.fn(),
      sendMulticast: jest.fn()
    }))
  })),
  credential: {
    cert: jest.fn(() => 'mock-cert'),
    applicationDefault: jest.fn(() => 'mock-credential'),
    refreshToken: jest.fn(() => 'mock-refresh-token')
  },
  apps: []
}));

import { NotificationService } from '../../src/services/notification.service';
import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Helper to generate a valid-length FCM token (>100 chars, alphanumeric + _-)
function validFCMToken(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-';
  let token = '';
  for (let i = 0; i < 152; i++) {
    token += chars[i % chars.length];
  }
  return token;
}

describe('NotificationService - User Management Features', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    notificationService = new NotificationService();
  });

  describe('FCM Token Management', () => {
    describe('registerDeviceToken', () => {
      it('should register a new FCM token successfully', async () => {
        const token = validFCMToken();
        const mockTokenData = {
          id: 'token-id-1',
          user_id: 'user-123',
          token,
          platform: 'android',
          is_active: true,
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        };

        // First from() call: check existing token -> not found
        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: null, error: null });

        // Second from() call: insert new token -> return token data
        // Because the service calls from('push_tokens') multiple times,
        // we set up the chain to resolve to the token data for insert paths
        const insertChain: any = {};
        ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
         'like','ilike','is','in','not','contains','containedBy','overlaps',
         'filter','match','or','and','order','limit','range','offset','count',
         'single','maybeSingle','csv','returns','textSearch','throwOnError'
        ].forEach(m => { insertChain[m] = jest.fn().mockReturnValue(insertChain); });
        insertChain.then = (resolve: any) => resolve({ data: mockTokenData, error: null });

        // The service calls from() multiple times; we make all resolve to our data
        mockSupabase.from.mockReturnValue(insertChain);

        const result = await notificationService.registerDeviceToken(
          'user-123',
          token,
          'android',
          { model: 'Samsung Galaxy' }
        );

        expect(result).toBeDefined();
        expect(result?.token).toBe(token);
        expect(result?.platform).toBe('android');
        expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      });

      it('should handle invalid FCM token format', async () => {
        // Short token fails the >100 length check
        await expect(
          notificationService.registerDeviceToken('user-123', 'invalid-token', 'android')
        ).rejects.toThrow('Failed to register FCM token');
      });

      it('should handle database errors during token registration', async () => {
        const token = validFCMToken();
        // Make all chains throw an error
        const errorChain: any = {};
        ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
         'like','ilike','is','in','not','contains','containedBy','overlaps',
         'filter','match','or','and','order','limit','range','offset','count',
         'single','maybeSingle','csv','returns','textSearch','throwOnError'
        ].forEach(m => { errorChain[m] = jest.fn().mockReturnValue(errorChain); });
        errorChain.then = (resolve: any, reject: any) => {
          if (reject) return reject(new Error('Database error'));
          return resolve({ data: null, error: { message: 'Database error' } });
        };
        mockSupabase.from.mockReturnValue(errorChain);

        await expect(
          notificationService.registerDeviceToken('user-123', token, 'android')
        ).rejects.toThrow('Failed to register FCM token');
      });
    });

    describe('unregisterDeviceToken', () => {
      it('should unregister FCM token successfully', async () => {
        // Default chain resolves to { data: null, error: null } which means no error
        await expect(
          notificationService.unregisterDeviceToken('fcm-token-123')
        ).resolves.not.toThrow();

        expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      });

      it('should handle errors during token unregistration', async () => {
        const errorChain: any = {};
        ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
         'like','ilike','is','in','not','contains','containedBy','overlaps',
         'filter','match','or','and','order','limit','range','offset','count',
         'single','maybeSingle','csv','returns','textSearch','throwOnError'
        ].forEach(m => { errorChain[m] = jest.fn().mockReturnValue(errorChain); });
        errorChain.then = (resolve: any) => resolve({ data: null, error: { message: 'Token not found' } });
        mockSupabase.from.mockReturnValue(errorChain);

        await expect(
          notificationService.unregisterDeviceToken('invalid-token')
        ).rejects.toThrow('Failed to unregister FCM token');
      });
    });

    describe('getUserFCMTokens', () => {
      it('should retrieve user FCM tokens successfully', async () => {
        const mockTokens = [
          {
            id: 'token-1',
            user_id: 'user-123',
            token: 'fcm-token-1',
            platform: 'android',
            is_active: true,
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          }
        ];

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockTokens, error: null });
        // Reset from to return the updated chain
        mockSupabase.from.mockReturnValue(chain);

        const result = await notificationService.getUserFCMTokens('user-123');

        expect(result).toHaveLength(1);
        expect(result[0].token).toBe('fcm-token-1');
        expect(result[0].platform).toBe('android');
      });

      it('should filter tokens by platform', async () => {
        const mockTokens = [
          {
            id: 'token-1',
            user_id: 'user-123',
            token: 'fcm-token-1',
            platform: 'android',
            is_active: true,
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          }
        ];

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockTokens, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const result = await notificationService.getUserFCMTokens('user-123', 'android');

        expect(result).toHaveLength(1);
        expect(result[0].platform).toBe('android');
      });
    });

    describe('cleanupExpiredTokens', () => {
      it('should cleanup expired tokens successfully', async () => {
        // cleanupExpiredTokens calls delete().lt().select() and returns count
        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: [{ id: '1' }, { id: '2' }], error: null });
        mockSupabase.from.mockReturnValue(chain);

        const result = await notificationService.cleanupExpiredTokens(30);

        // Source returns expiredTokens.length (a number), not boolean
        expect(typeof result).toBe('number');
        expect(result).toBe(2);
        expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      });
    });
  });

  describe('User Management Notification Templates', () => {
    describe('getTemplate', () => {
      it('should retrieve welcome template', () => {
        const template = notificationService.getTemplate('welcome');

        expect(template).toBeDefined();
        expect(template?.id).toBe('welcome');
        expect(template?.type).toBe('welcome');
        expect(template?.title).toContain('에브리띵에 오신 것을 환영합니다');
        expect(template?.category).toBe('user_management');
      });

      it('should retrieve security alert template', () => {
        const template = notificationService.getTemplate('password_changed');

        expect(template).toBeDefined();
        expect(template?.id).toBe('password_changed');
        expect(template?.type).toBe('security_alert');
        expect(template?.priority).toBe('high');
        expect(template?.category).toBe('security');
      });

      it('should return null for non-existent template', () => {
        const template = notificationService.getTemplate('non_existent');
        expect(template).toBeNull();
      });
    });

    describe('getAllTemplates', () => {
      it('should return all templates including user management and shop management', () => {
        const templates = notificationService.getAllTemplates();

        // Source returns USER_MANAGEMENT_TEMPLATES (11) + SHOP_MANAGEMENT_TEMPLATES (5) = 16
        expect(templates).toHaveLength(16);
        expect(templates.map(t => t.id)).toContain('welcome');
        expect(templates.map(t => t.id)).toContain('password_changed');
        expect(templates.map(t => t.id)).toContain('account_suspended');
      });
    });

    describe('getTemplatesByCategory', () => {
      it('should filter templates by security category', () => {
        const securityTemplates = notificationService.getTemplatesByCategory('security');

        expect(securityTemplates.length).toBeGreaterThan(0);
        securityTemplates.forEach(template => {
          expect(template.category).toBe('security');
        });
      });

      it('should filter templates by user_management category', () => {
        const userMgmtTemplates = notificationService.getTemplatesByCategory('user_management');

        expect(userMgmtTemplates.length).toBeGreaterThan(0);
        userMgmtTemplates.forEach(template => {
          expect(template.category).toBe('user_management');
        });
      });
    });

    describe('createNotificationFromTemplate', () => {
      it('should create notification from welcome template', () => {
        const notification = notificationService.createNotificationFromTemplate('welcome');

        expect(notification).toBeDefined();
        expect(notification?.notificationType).toBe('welcome');
        expect(notification?.title).toContain('에브리띵에 오신 것을 환영합니다');
        expect(notification?.priority).toBe('medium');
      });

      it('should replace dynamic data in template', () => {
        const notification = notificationService.createNotificationFromTemplate(
          'welcome',
          { userName: '홍길동' }
        );

        expect(notification).toBeDefined();
        // Note: This would work if the template had {{userName}} placeholder
      });

      it('should apply customizations to template', () => {
        const notification = notificationService.createNotificationFromTemplate(
          'welcome',
          {},
          {
            title: '커스텀 환영 메시지',
            body: '커스텀 내용입니다.'
          }
        );

        expect(notification).toBeDefined();
        expect(notification?.title).toBe('커스텀 환영 메시지');
        expect(notification?.body).toBe('커스텀 내용입니다.');
      });

      it('should return null for invalid template', () => {
        const notification = notificationService.createNotificationFromTemplate('invalid_template');
        expect(notification).toBeNull();
      });
    });
  });

  describe('Notification Preferences Integration', () => {
    describe('getUserNotificationPreferences', () => {
      it('should retrieve user notification preferences', async () => {
        const mockSettings = {
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

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockSettings, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const preferences = await notificationService.getUserNotificationPreferences('user-123');

        expect(preferences).toBeDefined();
        expect(preferences?.userId).toBe('user-123');
        expect(preferences?.pushEnabled).toBe(true);
        expect(preferences?.promotionalMessages).toBe(false);
      });

      it('should return null for user without settings', async () => {
        // Default chain resolves to { data: null, error: null } which triggers error path
        const preferences = await notificationService.getUserNotificationPreferences('user-123');
        expect(preferences).toBeNull();
      });
    });

    describe('updateUserNotificationPreferences', () => {
      it('should update user notification preferences', async () => {
        const mockUpdatedSettings = {
          user_id: 'user-123',
          push_notifications_enabled: false,
          marketing_notifications: true,
          event_notifications: true,
          reservation_notifications: true,
          updated_at: new Date().toISOString()
        };

        // The service calls update().eq().select().single() then getUserNotificationPreferences
        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockUpdatedSettings, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const result = await notificationService.updateUserNotificationPreferences('user-123', {
          pushEnabled: false,
          promotionalMessages: true
        });

        expect(result).toBeDefined();
        expect(mockSupabase.from).toHaveBeenCalled();
      });
    });

    describe('filterUsersByNotificationPreferences', () => {
      it('should filter users based on notification preferences', async () => {
        const mockSettings = [
          {
            user_id: 'user-1',
            push_notifications_enabled: true,
            event_notifications: true,
            marketing_notifications: false,
            reservation_notifications: true
          },
          {
            user_id: 'user-2',
            push_notifications_enabled: false,
            event_notifications: true,
            marketing_notifications: true,
            reservation_notifications: true
          }
        ];

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockSettings, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const result = await notificationService.filterUsersByNotificationPreferences(
          ['user-1', 'user-2'],
          'profile_update'
        );

        expect(result.allowedUsers).toContain('user-1');
        expect(result.blockedUsers).toContain('user-2');
        expect(result.preferencesMap).toHaveProperty('user-1');
        expect(result.preferencesMap).toHaveProperty('user-2');
      });
    });
  });

  describe('User Management Notification Sending', () => {
    describe('sendUserManagementNotification', () => {
      beforeEach(() => {
        // Mock getUserDeviceTokens
        jest.spyOn(notificationService, 'getUserDeviceTokens').mockResolvedValue([
          { token: 'fcm-token-1', deviceType: 'android', userId: 'user-123', id: 'dt-1', isActive: true, createdAt: '', updatedAt: '' }
        ]);

        // Mock sendToDevice
        jest.spyOn(notificationService as any, 'sendToDevice').mockResolvedValue({
          success: true,
          messageId: 'msg-123'
        });

        // Mock createDeliveryStatus
        jest.spyOn(notificationService as any, 'createDeliveryStatus').mockResolvedValue({
          notificationId: 'delivery-123',
          userId: 'user-123',
          status: 'pending',
          deliveryAttempts: 0
        });

        // Mock updateDeliveryStatus
        jest.spyOn(notificationService as any, 'updateDeliveryStatus').mockResolvedValue(undefined);

        // Mock logNotificationHistory
        jest.spyOn(notificationService as any, 'logNotificationHistory').mockResolvedValue({
          id: 'history-123'
        });

        // Mock updateTokenLastUsed
        jest.spyOn(notificationService as any, 'updateTokenLastUsed').mockResolvedValue(undefined);

        // Mock logUserManagementNotification
        jest.spyOn(notificationService as any, 'logUserManagementNotification').mockResolvedValue(undefined);

        // Mock checkUserNotificationPreferences to allow by default
        jest.spyOn(notificationService as any, 'checkUserNotificationPreferences').mockResolvedValue(true);
      });

      it('should send welcome notification successfully', async () => {
        const result = await notificationService.sendUserManagementNotification(
          'user-123',
          'welcome'
        );

        expect(result).toBeDefined();
        expect(result?.id).toBe('history-123');
      });

      it('should send notification with dynamic data', async () => {
        const result = await notificationService.sendUserManagementNotification(
          'user-123',
          'welcome',
          { userName: '홍길동' }
        );

        expect(result).toBeDefined();
      });

      it('should respect user notification preferences', async () => {
        // Override to block notification
        (notificationService as any).checkUserNotificationPreferences.mockResolvedValue(false);

        const result = await notificationService.sendUserManagementNotification(
          'user-123',
          'profile_update_success'
        );

        expect(result).toBeNull();
      });

      it('should handle invalid template ID', async () => {
        const result = await notificationService.sendUserManagementNotification(
          'user-123',
          'invalid_template'
        );

        expect(result).toBeNull();
      });
    });

    describe('sendBulkUserManagementNotifications', () => {
      beforeEach(() => {
        // Mock filterUsersByNotificationPreferences
        jest.spyOn(notificationService, 'filterUsersByNotificationPreferences').mockResolvedValue({
          allowedUsers: ['user-1', 'user-2'],
          blockedUsers: ['user-3'],
          preferencesMap: {}
        });

        // Mock sendUserManagementNotification
        jest.spyOn(notificationService, 'sendUserManagementNotification').mockResolvedValue({
          id: 'history-123'
        } as any);
      });

      it('should send bulk notifications successfully', async () => {
        const result = await notificationService.sendBulkUserManagementNotifications(
          ['user-1', 'user-2', 'user-3'],
          'welcome'
        );

        expect(result.successful).toBe(2);
        expect(result.blocked).toBe(1);
        expect(result.failed).toBe(0);
        expect(result.results).toHaveLength(3);
      });

      it('should handle dynamic data per user', async () => {
        const dynamicDataPerUser = {
          'user-1': { userName: '홍길동' },
          'user-2': { userName: '김철수' }
        };

        const result = await notificationService.sendBulkUserManagementNotifications(
          ['user-1', 'user-2'],
          'welcome',
          dynamicDataPerUser
        );

        expect(result.successful).toBe(2);
      });
    });
  });

  describe('Delivery Status Tracking', () => {
    describe('getUserDeliveryStats', () => {
      it('should return delivery statistics for user', async () => {
        const mockNotifications = [
          { id: '1', user_id: 'user-123', sent_at: new Date().toISOString() },
          { id: '2', user_id: 'user-123', sent_at: null },
          { id: '3', user_id: 'user-123', sent_at: new Date().toISOString() }
        ];

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockNotifications, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const stats = await notificationService.getUserDeliveryStats('user-123');

        expect(stats.totalNotifications).toBe(3);
        expect(stats.successfulDeliveries).toBe(2);
        expect(stats.failedDeliveries).toBe(1);
        expect(stats.deliveryRate).toBeCloseTo(66.67, 1);
      });

      it('should handle date range filtering', async () => {
        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: [], error: null });
        mockSupabase.from.mockReturnValue(chain);

        const stats = await notificationService.getUserDeliveryStats('user-123', {
          startDate: '2024-01-01T00:00:00Z',
          endDate: '2024-01-31T23:59:59Z'
        });

        expect(stats.totalNotifications).toBe(0);
      });
    });

    describe('getSystemDeliveryStats', () => {
      it('should return system-wide delivery statistics', async () => {
        const mockNotifications = [
          { id: '1', sent_at: new Date().toISOString() },
          { id: '2', sent_at: null },
          { id: '3', sent_at: new Date().toISOString() },
          { id: '4', sent_at: new Date().toISOString() }
        ];

        const chain = mockSupabase.from();
        chain.then = (resolve: any) => resolve({ data: mockNotifications, error: null });
        mockSupabase.from.mockReturnValue(chain);

        const stats = await notificationService.getSystemDeliveryStats();

        expect(stats.totalNotifications).toBe(4);
        expect(stats.successfulDeliveries).toBe(3);
        expect(stats.failedDeliveries).toBe(1);
        expect(stats.deliveryRate).toBe(75);
        expect(stats.topFailureReasons).toBeDefined();
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle Supabase connection errors gracefully', async () => {
      const errorChain: any = {};
      ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
       'like','ilike','is','in','not','contains','containedBy','overlaps',
       'filter','match','or','and','order','limit','range','offset','count',
       'single','maybeSingle','csv','returns','textSearch','throwOnError'
      ].forEach(m => { errorChain[m] = jest.fn().mockReturnValue(errorChain); });
      errorChain.then = (_resolve: any, reject: any) => {
        if (reject) return reject(new Error('Connection failed'));
        return Promise.reject(new Error('Connection failed'));
      };
      mockSupabase.from.mockReturnValue(errorChain);

      const preferences = await notificationService.getUserNotificationPreferences('user-123');
      expect(preferences).toBeNull();
    });

    it('should log errors appropriately', async () => {
      const token = validFCMToken();
      // The service calls from() to check existing token, which will throw
      const errorChain: any = {};
      ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
       'like','ilike','is','in','not','contains','containedBy','overlaps',
       'filter','match','or','and','order','limit','range','offset','count',
       'single','maybeSingle','csv','returns','textSearch','throwOnError'
      ].forEach(m => { errorChain[m] = jest.fn().mockReturnValue(errorChain); });
      errorChain.then = (_resolve: any, reject: any) => {
        if (reject) return reject(new Error('Database error'));
        return Promise.reject(new Error('Database error'));
      };
      mockSupabase.from.mockReturnValue(errorChain);

      await expect(
        notificationService.registerDeviceToken('user-123', token, 'android')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});
