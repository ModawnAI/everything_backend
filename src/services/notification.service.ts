import * as admin from 'firebase-admin';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

// Notification types and templates
export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export interface NotificationTemplate {
  id: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

export interface DeviceToken {
  id: string;
  userId: string;
  token: string;
  deviceType: 'android' | 'ios' | 'web';
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NotificationHistory {
  id: string;
  userId: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  status: 'sent' | 'failed' | 'pending';
  sentAt?: string;
  errorMessage?: string;
  createdAt: string;
}

export interface NotificationSettings {
  userId: string;
  pushEnabled: boolean;
  emailEnabled: boolean;
  smsEnabled: boolean;
  reservationUpdates: boolean;
  paymentNotifications: boolean;
  promotionalMessages: boolean;
  systemAlerts: boolean;
  updatedAt: string;
}

export class NotificationService {
  private supabase = getSupabaseClient();
  private firebaseApp: admin.app.App;

  constructor() {
    // Initialize Firebase Admin SDK
    if (!admin.apps.length) {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'your-project-id'
      });
    } else {
      this.firebaseApp = admin.app();
    }
  }

  /**
   * Register a device token for a user
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    deviceType: 'android' | 'ios' | 'web'
  ): Promise<void> {
    try {
      // Check if token already exists
      const { data: existingToken } = await this.supabase
        .from('device_tokens')
        .select('id')
        .eq('token', token)
        .single();

      if (existingToken) {
        // Update existing token
        await this.supabase
          .from('device_tokens')
          .update({
            userId,
            deviceType,
            isActive: true,
            updatedAt: new Date().toISOString()
          })
          .eq('token', token);
      } else {
        // Insert new token
        await this.supabase
          .from('device_tokens')
          .insert({
            userId,
            token,
            deviceType,
            isActive: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
      }

      logger.info(`Device token registered for user ${userId}`, { userId, deviceType });
    } catch (error) {
      logger.error('Failed to register device token', { error, userId, token });
      throw new Error('Failed to register device token');
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      await this.supabase
        .from('device_tokens')
        .update({
          isActive: false,
          updatedAt: new Date().toISOString()
        })
        .eq('token', token);

      logger.info(`Device token unregistered`, { token });
    } catch (error) {
      logger.error('Failed to unregister device token', { error, token });
      throw new Error('Failed to unregister device token');
    }
  }

  /**
   * Get all active device tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      const { data: tokens, error } = await this.supabase
        .from('device_tokens')
        .select('*')
        .eq('userId', userId)
        .eq('isActive', true);

      if (error) throw error;
      return tokens || [];
    } catch (error) {
      logger.error('Failed to get user device tokens', { error, userId });
      throw new Error('Failed to get user device tokens');
    }
  }

  /**
   * Send push notification to a single user
   */
  async sendNotificationToUser(
    userId: string,
    payload: NotificationPayload
  ): Promise<NotificationHistory> {
    try {
      const tokens = await this.getUserDeviceTokens(userId);
      if (tokens.length === 0) {
        throw new Error('No active device tokens found for user');
      }

      const results = await Promise.allSettled(
        tokens.map(token => this.sendToDevice(token.token, payload))
      );

      // Log notification history
      const history = await this.logNotificationHistory(userId, payload, results);

      // Check if any notifications were sent successfully
      const successfulResults = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      );

      if (successfulResults.length === 0) {
        throw new Error('Failed to send notification to any device');
      }

      logger.info(`Notification sent to user ${userId}`, {
        userId,
        title: payload.title,
        successfulDevices: successfulResults.length,
        totalDevices: tokens.length
      });

      return history;
    } catch (error) {
      logger.error('Failed to send notification to user', { error, userId });
      throw error;
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendNotificationToUsers(
    userIds: string[],
    payload: NotificationPayload
  ): Promise<NotificationHistory[]> {
    try {
      const results = await Promise.allSettled(
        userIds.map(userId => this.sendNotificationToUser(userId, payload))
      );

      const histories: NotificationHistory[] = [];
      for (let i = 0; i < results.length; i++) {
        const result = results[i];
        if (result && result.status === 'fulfilled') {
          histories.push(result.value);
        } else if (result && result.status === 'rejected') {
          const errorMessage = (result.reason as any)?.message || 'Unknown error';
          await this.logNotificationHistory(userIds[i], payload, [errorMessage]);
        }
      }

      logger.info(`Bulk notification sent to ${userIds.length} users`, {
        successfulUsers: histories.length,
        totalUsers: userIds.length
      });

      return histories;
    } catch (error) {
      logger.error('Failed to send bulk notification', { error, userIds });
      throw error;
    }
  }

  /**
   * Send notification to all users (broadcast)
   */
  async sendBroadcastNotification(
    payload: NotificationPayload,
    filters?: {
      userStatus?: string;
      userType?: string;
      hasActiveTokens?: boolean;
    }
  ): Promise<{ totalUsers: number; successfulUsers: number }> {
    try {
      let query = this.supabase
        .from('users')
        .select('id');

      if (filters?.userStatus) {
        query = query.eq('status', filters.userStatus);
      }

      if (filters?.userType) {
        query = query.eq('user_type', filters.userType);
      }

      const { data: users, error } = await query;
      if (error) throw error;

      if (!users || users.length === 0) {
        return { totalUsers: 0, successfulUsers: 0 };
      }

      const userIds = users.map(user => user.id);
      const histories = await this.sendNotificationToUsers(userIds, payload);

      return {
        totalUsers: userIds.length,
        successfulUsers: histories.length
      };
    } catch (error) {
      logger.error('Failed to send broadcast notification', { error });
      throw error;
    }
  }

  /**
   * Send notification to a specific device
   */
  private async sendToDevice(
    token: string,
    payload: NotificationPayload
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl })
        },
        ...(payload.data && { data: payload.data }),
        android: {
          notification: {
            ...(payload.clickAction && { clickAction: payload.clickAction }),
            icon: 'ic_notification',
            color: '#FF5C00'
          }
        },
        apns: {
          payload: {
            aps: {
              alert: {
                title: payload.title,
                body: payload.body
              },
              badge: 1,
              sound: 'default'
            }
          }
        }
      };

      const response = await this.firebaseApp.messaging().send(message);
      
      return {
        success: true,
        messageId: response
      };
    } catch (error) {
      logger.error('Failed to send notification to device', { error, token });
      
      // Handle specific Firebase errors
      // if (error instanceof admin.messaging.UnregisteredError) {
      //   // Token is invalid, mark as inactive
      //   await this.unregisterDeviceToken(token);
      // }

      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Log notification history
   */
  private async logNotificationHistory(
    userId: string,
    payload: NotificationPayload,
    results: PromiseSettledResult<{ success: boolean; messageId?: string; error?: string }>[]
  ): Promise<NotificationHistory> {
    try {
      const successfulResults = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      );

      const failedResults = results.filter(
        result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)
      );

      const status = successfulResults.length > 0 ? 'sent' : 'failed';
      const errorMessage = failedResults.length > 0 
        ? failedResults.map(r => r.status === 'rejected' ? r.reason : r.value.error).join(', ')
        : undefined;

      const { data: history, error } = await this.supabase
        .from('notification_history')
        .insert({
          userId,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          status,
          sentAt: status === 'sent' ? new Date().toISOString() : undefined,
          errorMessage,
          createdAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return history;
    } catch (error) {
      logger.error('Failed to log notification history', { error, userId });
      throw error;
    }
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const templates: NotificationTemplate[] = [
      {
        id: 'reservation_confirmed',
        title: '예약이 확인되었습니다',
        body: '예약이 성공적으로 확인되었습니다. 예약 시간을 확인해주세요.',
        clickAction: 'OPEN_RESERVATION',
        data: { type: 'reservation_confirmed' }
      },
      {
        id: 'reservation_cancelled',
        title: '예약이 취소되었습니다',
        body: '예약이 취소되었습니다. 자세한 내용을 확인해주세요.',
        clickAction: 'OPEN_RESERVATION',
        data: { type: 'reservation_cancelled' }
      },
      {
        id: 'payment_success',
        title: '결제가 완료되었습니다',
        body: '결제가 성공적으로 완료되었습니다.',
        clickAction: 'OPEN_PAYMENT',
        data: { type: 'payment_success' }
      },
      {
        id: 'payment_failed',
        title: '결제 실패',
        body: '결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        clickAction: 'OPEN_PAYMENT',
        data: { type: 'payment_failed' }
      },
      {
        id: 'referral_bonus',
        title: '추천 보너스 지급',
        body: '추천인 보너스가 지급되었습니다!',
        clickAction: 'OPEN_REFERRAL',
        data: { type: 'referral_bonus' }
      },
      {
        id: 'shop_approved',
        title: '매장 승인이 완료되었습니다',
        body: '매장 등록이 승인되었습니다. 이제 예약을 받을 수 있습니다.',
        clickAction: 'OPEN_SHOP',
        data: { type: 'shop_approved' }
      },
      {
        id: 'shop_rejected',
        title: '매장 등록이 거부되었습니다',
        body: '매장 등록이 거부되었습니다. 자세한 내용을 확인해주세요.',
        clickAction: 'OPEN_SHOP',
        data: { type: 'shop_rejected' }
      },
      {
        id: 'system_maintenance',
        title: '시스템 점검 안내',
        body: '시스템 점검이 예정되어 있습니다. 불편을 드려 죄송합니다.',
        clickAction: 'OPEN_MAINTENANCE',
        data: { type: 'system_maintenance' }
      }
    ];

    return templates;
  }

  /**
   * Send notification using template
   */
  async sendTemplateNotification(
    userId: string,
    templateId: string,
    customData?: Record<string, string>
  ): Promise<NotificationHistory> {
    try {
      const templates = await this.getNotificationTemplates();
      const template = templates.find(t => t.id === templateId);

      if (!template) {
        throw new Error(`Notification template not found: ${templateId}`);
      }

      const payload: NotificationPayload = {
        title: template.title,
        body: template.body,
        data: { ...template.data, ...customData },
        imageUrl: template.imageUrl,
        clickAction: template.clickAction
      };

      return await this.sendNotificationToUser(userId, payload);
    } catch (error) {
      logger.error('Failed to send template notification', { error, userId, templateId });
      throw error;
    }
  }

  /**
   * Get user notification settings
   */
  async getUserNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const { data: settings, error } = await this.supabase
        .from('notification_settings')
        .select('*')
        .eq('userId', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows returned
      return settings;
    } catch (error) {
      logger.error('Failed to get user notification settings', { error, userId });
      throw error;
    }
  }

  /**
   * Update user notification settings
   */
  async updateUserNotificationSettings(
    userId: string,
    settings: Partial<NotificationSettings>
  ): Promise<NotificationSettings> {
    try {
      const { data: updatedSettings, error } = await this.supabase
        .from('notification_settings')
        .upsert({
          userId,
          ...settings,
          updatedAt: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return updatedSettings;
    } catch (error) {
      logger.error('Failed to update user notification settings', { error, userId });
      throw error;
    }
  }

  /**
   * Get notification history for a user
   */
  async getUserNotificationHistory(
    userId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<NotificationHistory[]> {
    try {
      const { data: history, error } = await this.supabase
        .from('notification_history')
        .select('*')
        .eq('userId', userId)
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return history || [];
    } catch (error) {
      logger.error('Failed to get user notification history', { error, userId });
      throw error;
    }
  }

  /**
   * Clean up invalid device tokens
   */
  async cleanupInvalidTokens(): Promise<{ removed: number }> {
    try {
      // This would typically be done by checking with Firebase
      // For now, we'll just mark tokens that haven't been updated recently as inactive
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { data: result, error } = await this.supabase
        .from('device_tokens')
        .update({ isActive: false })
        .lt('updatedAt', thirtyDaysAgo.toISOString())
        .eq('isActive', true);

      if (error) throw error;

      const removedCount = result ? ((result as any)?.length ?? 0) : 0;
      logger.info('Cleaned up invalid device tokens', { removed: removedCount });
      return { removed: removedCount };
    } catch (error) {
      logger.error('Failed to cleanup invalid tokens', { error });
      throw error;
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService(); 