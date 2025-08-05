import { NotificationService, NotificationPayload } from '../../src/services/notification.service';
import { getSupabaseClient } from '../../src/config/database';

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
    applicationDefault: jest.fn(() => 'mock-credential')
  },
  apps: {
    length: 0
  }
}));

// Mock Supabase
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('NotificationService', () => {
  let notificationService: NotificationService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      upsert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis()
    };

    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);
    notificationService = new NotificationService();
  });

  describe('registerDeviceToken', () => {
    it('should register a new device token', async () => {
      const userId = 'user-123';
      const token = 'firebase-token-123';
      const deviceType = 'android';

      mockSupabase.single.mockResolvedValue({ data: null, error: null });
      mockSupabase.insert.mockResolvedValue({ data: null, error: null });

      await notificationService.registerDeviceToken(userId, token, deviceType);

      expect(mockSupabase.from).toHaveBeenCalledWith('device_tokens');
      expect(mockSupabase.select).toHaveBeenCalledWith('id');
      expect(mockSupabase.eq).toHaveBeenCalledWith('token', token);
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        userId,
        token,
        deviceType,
        isActive: true,
        createdAt: expect.any(String),
        updatedAt: expect.any(String)
      });
    });

    it('should update existing device token', async () => {
      const userId = 'user-123';
      const token = 'firebase-token-123';
      const deviceType = 'ios';

      mockSupabase.single.mockResolvedValue({ 
        data: { id: 'existing-token-id' }, 
        error: null 
      });
      mockSupabase.update.mockResolvedValue({ data: null, error: null });

      await notificationService.registerDeviceToken(userId, token, deviceType);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        userId,
        deviceType,
        isActive: true,
        updatedAt: expect.any(String)
      });
    });

    it('should throw error on database error', async () => {
      const userId = 'user-123';
      const token = 'firebase-token-123';
      const deviceType = 'web';

      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { message: 'Database error' } 
      });

      await expect(
        notificationService.registerDeviceToken(userId, token, deviceType)
      ).rejects.toThrow('Failed to register device token');
    });
  });

  describe('unregisterDeviceToken', () => {
    it('should unregister a device token', async () => {
      const token = 'firebase-token-123';

      mockSupabase.update.mockResolvedValue({ data: null, error: null });

      await notificationService.unregisterDeviceToken(token);

      expect(mockSupabase.from).toHaveBeenCalledWith('device_tokens');
      expect(mockSupabase.update).toHaveBeenCalledWith({
        isActive: false,
        updatedAt: expect.any(String)
      });
      expect(mockSupabase.eq).toHaveBeenCalledWith('token', token);
    });
  });

  describe('getUserDeviceTokens', () => {
    it('should return user device tokens', async () => {
      const userId = 'user-123';
      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'firebase-token-1',
          deviceType: 'android',
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.eq.mockResolvedValue({ data: mockTokens, error: null });

      const result = await notificationService.getUserDeviceTokens(userId);

      expect(result).toEqual(mockTokens);
      expect(mockSupabase.from).toHaveBeenCalledWith('device_tokens');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('userId', userId);
      expect(mockSupabase.eq).toHaveBeenCalledWith('isActive', true);
    });

    it('should return empty array when no tokens found', async () => {
      const userId = 'user-123';

      mockSupabase.eq.mockResolvedValue({ data: null, error: null });

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
    it('should send template notification successfully', async () => {
      const userId = 'user-123';
      const templateId = 'reservation_confirmed';
      const customData = { reservationId: 'res-123' };

      // Mock getUserDeviceTokens
      const mockTokens = [
        {
          id: 'token-1',
          userId,
          token: 'firebase-token-1',
          deviceType: 'android',
          isActive: true,
          createdAt: '2023-01-01T00:00:00Z',
          updatedAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.eq.mockResolvedValue({ data: mockTokens, error: null });
      mockSupabase.insert.mockResolvedValue({ 
        data: { id: 'history-123' }, 
        error: null 
      });

      const result = await notificationService.sendTemplateNotification(userId, templateId, customData);

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('userId', userId);
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('body');
      expect(result).toHaveProperty('status');
    });

    it('should throw error for invalid template', async () => {
      const userId = 'user-123';
      const templateId = 'invalid_template';

      await expect(
        notificationService.sendTemplateNotification(userId, templateId)
      ).rejects.toThrow('Notification template not found: invalid_template');
    });
  });

  describe('getUserNotificationSettings', () => {
    it('should return user notification settings', async () => {
      const userId = 'user-123';
      const mockSettings = {
        userId,
        pushEnabled: true,
        emailEnabled: true,
        smsEnabled: false,
        reservationUpdates: true,
        paymentNotifications: true,
        promotionalMessages: false,
        systemAlerts: true,
        updatedAt: '2023-01-01T00:00:00Z'
      };

      mockSupabase.single.mockResolvedValue({ data: mockSettings, error: null });

      const result = await notificationService.getUserNotificationSettings(userId);

      expect(result).toEqual(mockSettings);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_settings');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('userId', userId);
    });

    it('should return null when no settings found', async () => {
      const userId = 'user-123';

      mockSupabase.single.mockResolvedValue({ 
        data: null, 
        error: { code: 'PGRST116' } 
      });

      const result = await notificationService.getUserNotificationSettings(userId);

      expect(result).toBeNull();
    });
  });

  describe('updateUserNotificationSettings', () => {
    it('should update user notification settings', async () => {
      const userId = 'user-123';
      const settings = {
        pushEnabled: false,
        emailEnabled: true,
        smsEnabled: true
      };

      const mockUpdatedSettings = {
        userId,
        ...settings,
        updatedAt: '2023-01-01T00:00:00Z'
      };

      mockSupabase.upsert.mockResolvedValue({ 
        data: mockUpdatedSettings, 
        error: null 
      });

      const result = await notificationService.updateUserNotificationSettings(userId, settings);

      expect(result).toEqual(mockUpdatedSettings);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_settings');
      expect(mockSupabase.upsert).toHaveBeenCalledWith({
        userId,
        ...settings,
        updatedAt: expect.any(String)
      });
    });
  });

  describe('getUserNotificationHistory', () => {
    it('should return user notification history', async () => {
      const userId = 'user-123';
      const limit = 10;
      const offset = 0;

      const mockHistory = [
        {
          id: 'history-1',
          userId,
          title: 'Test Notification',
          body: 'Test body',
          status: 'sent',
          createdAt: '2023-01-01T00:00:00Z'
        }
      ];

      mockSupabase.eq.mockResolvedValue({ data: mockHistory, error: null });

      const result = await notificationService.getUserNotificationHistory(userId, limit, offset);

      expect(result).toEqual(mockHistory);
      expect(mockSupabase.from).toHaveBeenCalledWith('notification_history');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('userId', userId);
      expect(mockSupabase.order).toHaveBeenCalledWith('createdAt', { ascending: false });
      expect(mockSupabase.range).toHaveBeenCalledWith(offset, offset + limit - 1);
    });
  });

  describe('cleanupInvalidTokens', () => {
    it('should cleanup invalid tokens', async () => {
      mockSupabase.update.mockResolvedValue({ data: { length: 5 }, error: null });

      const result = await notificationService.cleanupInvalidTokens();

      expect(result).toEqual({ removed: 5 });
      expect(mockSupabase.from).toHaveBeenCalledWith('device_tokens');
      expect(mockSupabase.update).toHaveBeenCalledWith({ isActive: false });
      expect(mockSupabase.lt).toHaveBeenCalledWith('updatedAt', expect.any(String));
      expect(mockSupabase.eq).toHaveBeenCalledWith('isActive', true);
    });
  });
}); 