import { createMockSupabase, createQueryMock, setupMockQuery, createDatabaseMock } from '../utils/supabase-mock-helper';

const mockSupabase = createMockSupabase();

// Mock Firebase Admin
jest.mock('firebase-admin', () => ({
  initializeApp: jest.fn(() => ({
    messaging: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('mock-message-id')
    }))
  })),
  app: jest.fn(() => ({
    messaging: jest.fn(() => ({
      send: jest.fn().mockResolvedValue('mock-message-id')
    }))
  })),
  credential: {
    applicationDefault: jest.fn(() => 'mock-credential'),
    cert: jest.fn(() => 'mock-cert'),
    refreshToken: jest.fn(() => 'mock-refresh-token')
  },
  apps: []
}));

// Mock Supabase
jest.mock('../../src/config/database', () => createDatabaseMock(mockSupabase));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

import { NotificationService } from '../../src/services/notification.service';

describe('NotificationService', () => {
  let notificationService: NotificationService;

  beforeEach(() => {
    jest.clearAllMocks();
    notificationService = new NotificationService();
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const userId = 'user-123';
      // Token must be >100 chars and alphanumeric+dash+underscore to pass isValidFCMToken
      const token = 'a'.repeat(150);
      const platform = 'android';

      // First query: check if token exists (returns null = new token)
      const checkQueryMock = createQueryMock({ data: null, error: { code: 'PGRST116', message: 'No rows found' } });
      // Second query: insert new token
      const insertedToken = { id: 'new-token-id', user_id: userId, token, platform, is_active: true, last_used_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z' };
      const insertQueryMock = createQueryMock({ data: insertedToken, error: null });
      // Third query: deactivateOldTokensForUser
      const deactivateQueryMock = createQueryMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkQueryMock;
        if (callCount === 2) return insertQueryMock;
        return deactivateQueryMock;
      });

      const result = await notificationService.registerDeviceToken(userId, token, platform);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.token).toBe(token);
      expect(result.platform).toBe(platform);
      expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
    });

    it('should update existing device token', async () => {
      const userId = 'user-123';
      const token = 'b'.repeat(150);
      const platform: 'ios' = 'ios';

      // First query: check if token exists (returns existing token)
      const existingToken = { id: 'existing-id', user_id: 'old-user', token, platform: 'android', is_active: true, last_used_at: '2024-01-01T00:00:00Z', created_at: '2024-01-01T00:00:00Z' };
      const checkQueryMock = createQueryMock({ data: existingToken, error: null });
      // Second query: update existing token
      const updatedToken = { id: 'existing-id', user_id: userId, token, platform, is_active: true, last_used_at: '2024-01-02T00:00:00Z', created_at: '2024-01-01T00:00:00Z' };
      const updateQueryMock = createQueryMock({ data: updatedToken, error: null });
      // Third query: deactivateOldTokensForUser
      const deactivateQueryMock = createQueryMock({ data: null, error: null });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return checkQueryMock;
        if (callCount === 2) return updateQueryMock;
        return deactivateQueryMock;
      });

      const result = await notificationService.registerDeviceToken(userId, token, platform);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
    });

    it('should throw error on invalid token format', async () => {
      const userId = 'user-123';
      const token = 'short-token'; // Too short (<100 chars)
      const platform: 'web' = 'web';

      await expect(
        notificationService.registerDeviceToken(userId, token, platform)
      ).rejects.toThrow('Failed to register FCM token');
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister a device token', async () => {
      const token = 'c'.repeat(150);

      const queryMock = createQueryMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryMock);

      await notificationService.unregisterDeviceToken(token);

      expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      expect(queryMock.update).toHaveBeenCalledWith({
        is_active: false,
        last_used_at: expect.any(String)
      });
      expect(queryMock.eq).toHaveBeenCalledWith('token', token);
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return user device tokens', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          user_id: userId,
          token: 'firebase-token-1',
          platform: 'android',
          is_active: true,
          created_at: '2023-01-01T00:00:00Z',
          last_used_at: '2023-01-01T00:00:00Z'
        }
      ];

      const queryMock = createQueryMock({ data: mockTokens, error: null });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await notificationService.getUserDeviceTokens(userId);

      // The service maps DB fields to legacy DeviceToken format
      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe(userId);
      expect(result[0].deviceType).toBe('android');
      expect(result[0].isActive).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      expect(queryMock.select).toHaveBeenCalledWith('*');
      expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
      expect(queryMock.eq).toHaveBeenCalledWith('is_active', true);
    });

    it('should return empty array when no tokens found', async () => {
      const userId = 'user-123';

      const queryMock = createQueryMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await notificationService.getUserDeviceTokens(userId);

      expect(result).toEqual([]);
    });
  });

  describe('getNotificationTemplates', () => {
    it('should return notification templates', async () => {
      const templates = await notificationService.getNotificationTemplates();

      expect(templates).toBeInstanceOf(Array);
      expect(templates.length).toBeGreaterThan(0);

      // Check for specific templates
      const templateIds = templates.map(t => t.id);
      expect(templateIds).toContain('reservation_confirmed');
      expect(templateIds).toContain('payment_success');
      expect(templateIds).toContain('referral_bonus');

      // Check template structure
      const firstTemplate = templates[0];
      expect(firstTemplate).toHaveProperty('id');
      expect(firstTemplate).toHaveProperty('title');
      expect(firstTemplate).toHaveProperty('body');
      expect(firstTemplate).toHaveProperty('data');
    });
  });

  describe('sendTemplateNotification', () => {
    it('should throw error for invalid template', async () => {
      const userId = 'user-123';
      const templateId = 'invalid_template';

      await expect(
        notificationService.sendTemplateNotification(userId, templateId)
      ).rejects.toThrow('Notification template not found: invalid_template');
    });
  });

  describe('getUserNotificationSettings', () => {
    it('should return user notification settings from database', async () => {
      const userId = 'user-123';
      const mockUserSettings = {
        user_id: userId,
        push_notifications_enabled: true,
        reservation_notifications: true,
        marketing_notifications: false,
        event_notifications: true,
        updated_at: '2023-01-01T00:00:00Z'
      };

      const queryMock = createQueryMock({ data: mockUserSettings, error: null });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await notificationService.getUserNotificationSettings(userId);

      expect(result).toBeDefined();
      expect(result!.userId).toBe(userId);
      expect(result!.pushEnabled).toBe(true);
      expect(result!.reservationUpdates).toBe(true);
      expect(result!.promotionalMessages).toBe(false);
      expect(result!.systemAlerts).toBe(true);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
      expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
    });

    it('should return defaults when no settings found (PGRST116)', async () => {
      const userId = 'user-123';

      const queryMock = createQueryMock({
        data: null,
        error: { code: 'PGRST116', message: 'No rows found' }
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await notificationService.getUserNotificationSettings(userId);

      // The service returns default settings on PGRST116
      expect(result).toBeDefined();
      expect(result!.userId).toBe(userId);
      expect(result!.pushEnabled).toBe(true);
      expect(result!.emailEnabled).toBe(true);
      expect(result!.smsEnabled).toBe(false);
      expect(result!.systemAlerts).toBe(true);
    });
  });

  describe('updateUserNotificationSettings', () => {
    it('should update user notification settings', async () => {
      const userId = 'user-123';
      const settings = {
        pushEnabled: false,
        reservationUpdates: true,
        promotionalMessages: true
      };

      // First call: upsert (chained .upsert().select().single())
      const upsertQueryMock = createQueryMock({ data: { user_id: userId, push_notifications_enabled: false }, error: null });
      // Second call: getUserNotificationSettings (called internally after update)
      const getQueryMock = createQueryMock({
        data: {
          user_id: userId,
          push_notifications_enabled: false,
          reservation_notifications: true,
          marketing_notifications: true,
          event_notifications: true,
          updated_at: '2023-01-02T00:00:00Z'
        },
        error: null
      });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return upsertQueryMock;
        return getQueryMock;
      });

      const result = await notificationService.updateUserNotificationSettings(userId, settings);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.pushEnabled).toBe(false);
      expect(mockSupabase.from).toHaveBeenCalledWith('user_settings');
    });
  });

  describe('getUserNotificationHistory', () => {
    it('should return user notification history', async () => {
      const userId = 'user-123';

      const mockHistory = [
        {
          id: 'history-1',
          user_id: userId,
          title: 'Test Notification',
          body: 'Test body',
          status: 'sent',
          created_at: '2023-01-01T00:00:00Z'
        }
      ];

      const queryMock = createQueryMock({ data: mockHistory, error: null, count: 1 });
      mockSupabase.from.mockReturnValue(queryMock);

      // Note: The actual signature is (userId, page, limit, status?)
      const result = await notificationService.getUserNotificationHistory(userId, 1, 10);

      expect(result.notifications).toEqual(mockHistory);
      expect(result.totalCount).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_history');
      expect(queryMock.select).toHaveBeenCalledWith('*', { count: 'exact' });
      expect(queryMock.eq).toHaveBeenCalledWith('user_id', userId);
      expect(queryMock.order).toHaveBeenCalledWith('created_at', { ascending: false });
    });
  });

  describe('cleanupInvalidTokens', () => {
    it('should cleanup invalid tokens', async () => {
      const mockResult = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }];
      const queryMock = createQueryMock({ data: mockResult, error: null });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await notificationService.cleanupInvalidTokens();

      expect(result).toEqual({ removed: 5 });
      expect(mockSupabase.from).toHaveBeenCalledWith('push_tokens');
      expect(queryMock.update).toHaveBeenCalledWith({ is_active: false });
      expect(queryMock.lt).toHaveBeenCalledWith('last_used_at', expect.any(String));
      expect(queryMock.eq).toHaveBeenCalledWith('is_active', true);
    });
  });
});
