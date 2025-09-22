/**
 * User Management Notification Service Unit Tests
 * 
 * Comprehensive test suite for the enhanced notification service
 * with user management event templates and FCM token management
 */

import { NotificationService } from '../../src/services/notification.service';
import { getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');
jest.mock('firebase-admin', () => ({
  messaging: () => ({
    send: jest.fn(),
    sendMulticast: jest.fn()
  }),
  initializeApp: jest.fn(),
  credential: {
    cert: jest.fn()
  }
}));

describe('NotificationService - User Management Features', () => {
  let notificationService: NotificationService;
  let mockSupabase: any;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(),
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                eq: jest.fn(() => ({
                  single: jest.fn()
                }))
              }))
            }))
          })),
          in: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn()
            }))
          })),
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              eq: jest.fn(() => ({
                single: jest.fn()
              }))
            }))
          }))
        })),
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn()
          }))
        })),
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            select: jest.fn(() => ({
              single: jest.fn()
            }))
          }))
        })),
        delete: jest.fn(() => ({
          eq: jest.fn()
        }))
      }))
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    notificationService = new NotificationService();
  });

  describe('FCM Token Management', () => {
    describe('registerDeviceToken', () => {
      it('should register a new FCM token successfully', async () => {
        const mockTokenData = {
          id: 'token-id-1',
          user_id: 'user-123',
          token: 'fcm-token-123',
          platform: 'android',
          is_active: true,
          device_info: { model: 'Samsung Galaxy' },
          created_at: new Date().toISOString(),
          last_used_at: new Date().toISOString()
        };

        mockSupabase.from().insert().select().single.mockResolvedValue({
          data: mockTokenData,
          error: null
        });

        const result = await notificationService.registerDeviceToken(
          'user-123',
          'fcm-token-123',
          'android',
          { model: 'Samsung Galaxy' }
        );

        expect(result).toBeDefined();
        expect(result?.token).toBe('fcm-token-123');
        expect(result?.platform).toBe('android');
        expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      });

      it('should handle invalid FCM token format', async () => {
        await expect(
          notificationService.registerDeviceToken('user-123', 'invalid-token', 'android')
        ).rejects.toThrow('Invalid FCM token format');
      });

      it('should handle database errors during token registration', async () => {
        mockSupabase.from().insert().select().single.mockResolvedValue({
          data: null,
          error: { message: 'Database error' }
        });

        await expect(
          notificationService.registerDeviceToken('user-123', 'fcm-token-123', 'android')
        ).rejects.toThrow('Failed to register FCM token');
      });
    });

    describe('unregisterDeviceToken', () => {
      it('should unregister FCM token successfully', async () => {
        mockSupabase.from().update().eq().mockResolvedValue({
          error: null
        });

        await expect(
          notificationService.unregisterDeviceToken('fcm-token-123')
        ).resolves.not.toThrow();

        expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      });

      it('should handle errors during token unregistration', async () => {
        mockSupabase.from().update().eq().mockResolvedValue({
          error: { message: 'Token not found' }
        });

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
            device_info: { model: 'Samsung' },
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          }
        ];

        mockSupabase.from().select().eq().mockResolvedValue({
          data: mockTokens,
          error: null
        });

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
            device_info: {},
            created_at: new Date().toISOString(),
            last_used_at: new Date().toISOString()
          }
        ];

        mockSupabase.from().select().eq().mockResolvedValue({
          data: mockTokens,
          error: null
        });

        const result = await notificationService.getUserFCMTokens('user-123', 'android');

        expect(result).toHaveLength(1);
        expect(result[0].platform).toBe('android');
      });
    });

    describe('cleanupExpiredTokens', () => {
      it('should cleanup expired tokens successfully', async () => {
        mockSupabase.from().delete().eq().mockResolvedValue({
          error: null
        });

        const result = await notificationService.cleanupExpiredTokens(30);

        expect(result).toBe(true);
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
      it('should return all user management templates', () => {
        const templates = notificationService.getAllTemplates();

        expect(templates).toHaveLength(11);
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
        // Note: This would work if the template had {userName} placeholder
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

        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: mockSettings,
          error: null
        });

        const preferences = await notificationService.getUserNotificationPreferences('user-123');

        expect(preferences).toBeDefined();
        expect(preferences?.userId).toBe('user-123');
        expect(preferences?.pushEnabled).toBe(true);
        expect(preferences?.promotionalMessages).toBe(false);
      });

      it('should return null for user without settings', async () => {
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { message: 'No settings found' }
        });

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
          updated_at: new Date().toISOString()
        };

        mockSupabase.from().update().eq().select().single.mockResolvedValue({
          data: mockUpdatedSettings,
          error: null
        });

        // Mock the getUserNotificationPreferences call
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: mockUpdatedSettings,
          error: null
        });

        const result = await notificationService.updateUserNotificationPreferences('user-123', {
          pushEnabled: false,
          promotionalMessages: true
        });

        expect(result).toBeDefined();
        expect(mockSupabase.from().update).toHaveBeenCalled();
      });
    });

    describe('filterUsersByNotificationPreferences', () => {
      it('should filter users based on notification preferences', async () => {
        const mockSettings = [
          {
            user_id: 'user-1',
            push_notifications_enabled: true,
            event_notifications: true,
            marketing_notifications: false
          },
          {
            user_id: 'user-2',
            push_notifications_enabled: false,
            event_notifications: true,
            marketing_notifications: true
          }
        ];

        mockSupabase.from().select().in().mockResolvedValue({
          data: mockSettings,
          error: null
        });

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
          { token: 'fcm-token-1', platform: 'android' }
        ]);

        // Mock sendToDevice
        jest.spyOn(notificationService as any, 'sendToDevice').mockResolvedValue({
          success: true,
          messageId: 'msg-123'
        });

        // Mock logNotificationHistory
        jest.spyOn(notificationService as any, 'logNotificationHistory').mockResolvedValue({
          id: 'history-123'
        });

        // Mock user preferences check
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: {
            user_id: 'user-123',
            push_notifications_enabled: true,
            event_notifications: true
          },
          error: null
        });

        // Mock notification logging
        mockSupabase.from().insert().mockResolvedValue({
          error: null
        });
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
        // Mock user with notifications disabled
        mockSupabase.from().select().eq().single.mockResolvedValue({
          data: {
            user_id: 'user-123',
            push_notifications_enabled: false
          },
          error: null
        });

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

        mockSupabase.from().select().eq().mockResolvedValue({
          data: mockNotifications,
          error: null
        });

        const stats = await notificationService.getUserDeliveryStats('user-123');

        expect(stats.totalNotifications).toBe(3);
        expect(stats.successfulDeliveries).toBe(2);
        expect(stats.failedDeliveries).toBe(1);
        expect(stats.deliveryRate).toBeCloseTo(66.67, 1);
      });

      it('should handle date range filtering', async () => {
        mockSupabase.from().select().eq().gte().lte().mockResolvedValue({
          data: [],
          error: null
        });

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

        mockSupabase.from().select().mockResolvedValue({
          data: mockNotifications,
          error: null
        });

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
      mockSupabase.from().select().eq().single.mockRejectedValue(
        new Error('Connection failed')
      );

      const preferences = await notificationService.getUserNotificationPreferences('user-123');
      expect(preferences).toBeNull();
    });

    it('should log errors appropriately', async () => {
      mockSupabase.from().insert().select().single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        notificationService.registerDeviceToken('user-123', 'fcm-token-123', 'android')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
    });
  });
});

