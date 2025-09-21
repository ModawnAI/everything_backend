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
  userManagementAlerts: boolean;
  securityAlerts: boolean;
  profileUpdateConfirmations: boolean;
  adminActionNotifications: boolean;
  updatedAt: string;
}

export interface UserManagementNotificationPayload extends NotificationPayload {
  notificationType: 'welcome' | 'profile_update' | 'security_alert' | 'admin_action' | 'account_status' | 'role_change';
  userId: string;
  relatedId?: string;
  actionUrl?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  metadata?: Record<string, any>;
}

export interface NotificationTemplate {
  id: string;
  type: string;
  title: string;
  body: string;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  category: 'user_management' | 'system' | 'security' | 'general';
}

export interface FCMTokenInfo {
  id: string;
  userId: string;
  token: string;
  platform: 'ios' | 'android' | 'web';
  isActive: boolean;
  lastUsedAt: string;
  createdAt: string;
  deviceInfo?: {
    model?: string;
    osVersion?: string;
    appVersion?: string;
  };
}

export interface NotificationDeliveryStatus {
  notificationId: string;
  userId: string;
  status: 'pending' | 'sent' | 'delivered' | 'failed' | 'expired';
  deliveryAttempts: number;
  lastAttemptAt?: string;
  errorMessage?: string;
  fcmMessageId?: string;
  deliveredAt?: string;
}

export class NotificationService {
  private supabase = getSupabaseClient();
  private firebaseApp: admin.app.App;

  // User Management Notification Templates
  private readonly USER_MANAGEMENT_TEMPLATES: Record<string, NotificationTemplate> = {
    welcome: {
      id: 'welcome',
      type: 'welcome',
      title: '에브리띵에 오신 것을 환영합니다! 🎉',
      body: '회원가입이 완료되었습니다. 다양한 서비스를 이용해보세요!',
      priority: 'medium',
      category: 'user_management',
      clickAction: '/onboarding',
      data: {
        type: 'welcome',
        action: 'onboarding'
      }
    },
    profile_update_success: {
      id: 'profile_update_success',
      type: 'profile_update',
      title: '프로필이 업데이트되었습니다 ✅',
      body: '프로필 정보가 성공적으로 변경되었습니다.',
      priority: 'low',
      category: 'user_management',
      clickAction: '/profile',
      data: {
        type: 'profile_update',
        action: 'view_profile'
      }
    },
    password_changed: {
      id: 'password_changed',
      type: 'security_alert',
      title: '비밀번호가 변경되었습니다 🔐',
      body: '계정 보안을 위해 비밀번호가 변경되었습니다. 본인이 아닌 경우 즉시 고객센터에 문의하세요.',
      priority: 'high',
      category: 'security',
      clickAction: '/security',
      data: {
        type: 'security_alert',
        action: 'password_change'
      }
    },
    account_suspended: {
      id: 'account_suspended',
      type: 'admin_action',
      title: '계정이 일시 정지되었습니다 ⚠️',
      body: '서비스 이용 규정 위반으로 계정이 일시 정지되었습니다. 자세한 내용은 고객센터에 문의하세요.',
      priority: 'critical',
      category: 'user_management',
      clickAction: '/support',
      data: {
        type: 'admin_action',
        action: 'account_suspended'
      }
    },
    account_reactivated: {
      id: 'account_reactivated',
      type: 'admin_action',
      title: '계정이 다시 활성화되었습니다 ✅',
      body: '계정 정지가 해제되어 정상적으로 서비스를 이용하실 수 있습니다.',
      priority: 'high',
      category: 'user_management',
      clickAction: '/dashboard',
      data: {
        type: 'admin_action',
        action: 'account_reactivated'
      }
    },
    role_upgraded: {
      id: 'role_upgraded',
      type: 'role_change',
      title: '권한이 업그레이드되었습니다 🎊',
      body: '새로운 권한이 부여되었습니다. 추가 기능을 확인해보세요!',
      priority: 'medium',
      category: 'user_management',
      clickAction: '/dashboard',
      data: {
        type: 'role_change',
        action: 'role_upgraded'
      }
    },
    login_from_new_device: {
      id: 'login_from_new_device',
      type: 'security_alert',
      title: '새로운 기기에서 로그인되었습니다 📱',
      body: '새로운 기기에서 계정에 로그인했습니다. 본인이 아닌 경우 즉시 비밀번호를 변경하세요.',
      priority: 'high',
      category: 'security',
      clickAction: '/security',
      data: {
        type: 'security_alert',
        action: 'new_device_login'
      }
    },
    email_verification_required: {
      id: 'email_verification_required',
      type: 'account_status',
      title: '이메일 인증이 필요합니다 📧',
      body: '계정 보안을 위해 이메일 인증을 완료해주세요.',
      priority: 'medium',
      category: 'user_management',
      clickAction: '/verify-email',
      data: {
        type: 'account_status',
        action: 'verify_email'
      }
    },
    phone_verification_required: {
      id: 'phone_verification_required',
      type: 'account_status',
      title: '휴대폰 인증이 필요합니다 📱',
      body: '서비스 이용을 위해 휴대폰 인증을 완료해주세요.',
      priority: 'medium',
      category: 'user_management',
      clickAction: '/verify-phone',
      data: {
        type: 'account_status',
        action: 'verify_phone'
      }
    },
    account_deletion_scheduled: {
      id: 'account_deletion_scheduled',
      type: 'account_status',
      title: '계정 삭제가 예정되었습니다 ⚠️',
      body: '7일 후 계정이 영구 삭제됩니다. 취소하려면 로그인하세요.',
      priority: 'critical',
      category: 'user_management',
      clickAction: '/account/cancel-deletion',
      data: {
        type: 'account_status',
        action: 'deletion_scheduled'
      }
    },
    data_export_ready: {
      id: 'data_export_ready',
      type: 'account_status',
      title: '개인정보 다운로드 준비 완료 📄',
      body: '요청하신 개인정보 파일이 준비되었습니다. 7일 내에 다운로드하세요.',
      priority: 'medium',
      category: 'user_management',
      clickAction: '/account/data-export',
      data: {
        type: 'account_status',
        action: 'data_export_ready'
      }
    }
  };

  // Shop Management Notification Templates
  private readonly SHOP_MANAGEMENT_TEMPLATES: Record<string, NotificationTemplate> = {
    shop_approved: {
      id: 'shop_approved',
      type: 'shop_approved',
      title: '🎉 매장 승인이 완료되었습니다!',
      body: '축하합니다! 매장 등록이 승인되어 이제 고객 예약을 받을 수 있습니다. 매장 관리 페이지에서 서비스를 설정해보세요.',
      priority: 'high',
        category: 'user_management',
      clickAction: '/shop/dashboard',
      data: {
        type: 'shop_approved',
        action: 'view_dashboard'
      }
    },
    shop_rejected: {
      id: 'shop_rejected',
      type: 'shop_rejected',
      title: '매장 등록 검토 결과 안내',
      body: '매장 등록 신청이 승인되지 않았습니다. 거부 사유를 확인하시고 필요한 서류를 보완하여 다시 신청해주세요.',
      priority: 'high',
        category: 'user_management',
      clickAction: '/shop/registration/status',
      data: {
        type: 'shop_rejected',
        action: 'view_rejection_reason'
      }
    },
    shop_verification_pending: {
      id: 'shop_verification_pending',
      type: 'shop_verification',
      title: '매장 등록 신청이 접수되었습니다',
      body: '매장 등록 신청이 성공적으로 접수되었습니다. 검토 완료까지 1-3일 소요됩니다.',
      priority: 'medium',
        category: 'user_management',
      clickAction: '/shop/registration/status',
      data: {
        type: 'shop_verification_pending',
        action: 'view_status'
      }
    },
    shop_documents_required: {
      id: 'shop_documents_required',
      type: 'shop_verification',
      title: '추가 서류 제출이 필요합니다',
      body: '매장 등록을 위해 추가 서류 제출이 필요합니다. 빠른 승인을 위해 서류를 업로드해주세요.',
      priority: 'medium',
        category: 'user_management',
      clickAction: '/shop/registration/documents',
      data: {
        type: 'shop_documents_required',
        action: 'upload_documents'
      }
    },
    shop_activated: {
      id: 'shop_activated',
      type: 'shop_status',
      title: '매장이 활성화되었습니다! 🚀',
      body: '매장이 활성화되어 고객들이 예약할 수 있습니다. 첫 예약을 기다려보세요!',
      priority: 'high',
        category: 'user_management',
      clickAction: '/shop/reservations',
      data: {
        type: 'shop_activated',
        action: 'view_reservations'
      }
    }
  };

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
   * Register a device token for a user with enhanced metadata
   */
  async registerDeviceToken(
    userId: string,
    token: string,
    platform: 'android' | 'ios' | 'web',
    deviceInfo?: {
      model?: string;
      osVersion?: string;
      appVersion?: string;
    }
  ): Promise<FCMTokenInfo> {
    try {
      // Validate FCM token format
      if (!this.isValidFCMToken(token)) {
        throw new Error('Invalid FCM token format');
      }

      // Check if token already exists
      const { data: existingToken } = await this.supabase
        .from('push_tokens')
        .select('*')
        .eq('token', token)
        .single();

      let tokenData: FCMTokenInfo;

      if (existingToken) {
        // Update existing token
        const { data: updatedToken, error } = await this.supabase
          .from('push_tokens')
          .update({
            user_id: userId,
            platform,
            is_active: true,
            last_used_at: new Date().toISOString()
          })
          .eq('token', token)
          .select('*')
          .single();

        if (error) throw error;
        tokenData = this.mapTokenFromDB(updatedToken);
      } else {
        // Insert new token
        const { data: newToken, error } = await this.supabase
          .from('push_tokens')
          .insert({
            user_id: userId,
            token,
            platform,
            is_active: true,
            last_used_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
          .select('*')
          .single();

        if (error) throw error;
        tokenData = this.mapTokenFromDB(newToken);
      }

      // Store device info if provided
      if (deviceInfo) {
        tokenData.deviceInfo = deviceInfo;
        // You could store this in a separate device_info table if needed
      }

      // Deactivate old tokens for this user on the same platform (optional)
      await this.deactivateOldTokensForUser(userId, platform, token);

      logger.info(`FCM token registered for user ${userId}`, { 
        userId, 
        platform, 
        tokenId: tokenData.id,
        deviceInfo 
      });

      return tokenData;
    } catch (error) {
      logger.error('Failed to register FCM token', { error, userId, token: token.substring(0, 20) + '...' });
      throw new Error('Failed to register FCM token');
    }
  }

  /**
   * Validate FCM token format
   */
  private isValidFCMToken(token: string): boolean {
    // Basic FCM token validation
    return token && token.length > 100 && /^[A-Za-z0-9_-]+$/.test(token);
  }

  /**
   * Map database token to FCMTokenInfo
   */
  private mapTokenFromDB(dbToken: any): FCMTokenInfo {
    return {
      id: dbToken.id,
      userId: dbToken.user_id,
      token: dbToken.token,
      platform: dbToken.platform,
      isActive: dbToken.is_active,
      lastUsedAt: dbToken.last_used_at,
      createdAt: dbToken.created_at
    };
  }

  /**
   * Deactivate old tokens for user on same platform
   */
  private async deactivateOldTokensForUser(
    userId: string, 
    platform: string, 
    currentToken: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('push_tokens')
        .update({ is_active: false })
        .eq('user_id', userId)
        .eq('platform', platform)
        .neq('token', currentToken);
    } catch (error) {
      logger.warn('Failed to deactivate old tokens', { error, userId, platform });
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(token: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('push_tokens')
        .update({
          is_active: false,
          last_used_at: new Date().toISOString()
        })
        .eq('token', token);

      if (error) throw error;

      logger.info(`FCM token unregistered`, { token: token.substring(0, 20) + '...' });
    } catch (error) {
      logger.error('Failed to unregister FCM token', { error, token: token.substring(0, 20) + '...' });
      throw new Error('Failed to unregister FCM token');
    }
  }

  /**
   * Get all active FCM tokens for a user
   */
  async getUserDeviceTokens(userId: string): Promise<DeviceToken[]> {
    try {
      const { data: tokens, error } = await this.supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;
      
      // Map to legacy DeviceToken format for backward compatibility
      return (tokens || []).map(token => ({
        id: token.id,
        userId: token.user_id,
        token: token.token,
        deviceType: token.platform,
        isActive: token.is_active,
        createdAt: token.created_at,
        updatedAt: token.last_used_at
      }));
    } catch (error) {
      logger.error('Failed to get user FCM tokens', { error, userId });
      throw new Error('Failed to get user FCM tokens');
    }
  }

  /**
   * Get enhanced FCM token information for a user
   */
  async getUserFCMTokens(userId: string, platform?: 'ios' | 'android' | 'web'): Promise<FCMTokenInfo[]> {
    try {
      let query = this.supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (platform) {
        query = query.eq('platform', platform);
      }

      const { data: tokens, error } = await query;
      if (error) throw error;

      return (tokens || []).map(token => this.mapTokenFromDB(token));
    } catch (error) {
      logger.error('Failed to get user FCM tokens', { error, userId, platform });
      throw new Error('Failed to get user FCM tokens');
    }
  }

  /**
   * Update FCM token last used timestamp
   */
  async updateTokenLastUsed(token: string): Promise<void> {
    try {
      await this.supabase
        .from('push_tokens')
        .update({ last_used_at: new Date().toISOString() })
        .eq('token', token);
    } catch (error) {
      logger.warn('Failed to update token last used', { error, token: token.substring(0, 20) + '...' });
    }
  }

  /**
   * Clean up expired or invalid FCM tokens
   */
  async cleanupExpiredTokens(daysOld: number = 30): Promise<number> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const { data: expiredTokens, error } = await this.supabase
        .from('push_tokens')
        .delete()
        .lt('last_used_at', cutoffDate.toISOString())
        .select('id');

      if (error) throw error;

      const cleanedCount = expiredTokens?.length || 0;
      logger.info(`Cleaned up ${cleanedCount} expired FCM tokens`);
      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired FCM tokens', { error });
      throw new Error('Failed to cleanup expired FCM tokens');
    }
  }

  /**
   * Get FCM token statistics for a user
   */
  async getUserTokenStats(userId: string): Promise<{
    totalTokens: number;
    activeTokens: number;
    platformBreakdown: Record<string, number>;
    lastActivity: string | null;
  }> {
    try {
      const { data: tokens, error } = await this.supabase
        .from('push_tokens')
        .select('platform, is_active, last_used_at')
        .eq('user_id', userId);

      if (error) throw error;

      const stats = {
        totalTokens: tokens?.length || 0,
        activeTokens: tokens?.filter(t => t.is_active).length || 0,
        platformBreakdown: {} as Record<string, number>,
        lastActivity: null as string | null
      };

      if (tokens) {
        // Platform breakdown
        tokens.forEach(token => {
          stats.platformBreakdown[token.platform] = (stats.platformBreakdown[token.platform] || 0) + 1;
        });

        // Last activity
        const lastUsed = tokens
          .filter(t => t.last_used_at)
          .sort((a, b) => new Date(b.last_used_at).getTime() - new Date(a.last_used_at).getTime())[0];
        
        stats.lastActivity = lastUsed?.last_used_at || null;
      }

      return stats;
    } catch (error) {
      logger.error('Failed to get user token stats', { error, userId });
      throw new Error('Failed to get user token stats');
    }
  }

  /**
   * Get notification template by ID
   */
  getTemplate(templateId: string): NotificationTemplate | null {
    return this.USER_MANAGEMENT_TEMPLATES[templateId] || 
           this.SHOP_MANAGEMENT_TEMPLATES[templateId] || 
           null;
  }

  /**
   * Get all available templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return [
      ...Object.values(this.USER_MANAGEMENT_TEMPLATES),
      ...Object.values(this.SHOP_MANAGEMENT_TEMPLATES)
    ];
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: 'user_management' | 'system' | 'security' | 'general' | 'shop_management'): NotificationTemplate[] {
    const allTemplates = [
      ...Object.values(this.USER_MANAGEMENT_TEMPLATES),
      ...Object.values(this.SHOP_MANAGEMENT_TEMPLATES)
    ];
    return allTemplates.filter(template => template.category === category);
  }

  /**
   * Create notification payload from template with dynamic data
   */
  createNotificationFromTemplate(
    templateId: string,
    dynamicData?: Record<string, string>,
    customizations?: {
      title?: string;
      body?: string;
      imageUrl?: string;
      clickAction?: string;
    }
  ): UserManagementNotificationPayload | null {
    const template = this.getTemplate(templateId);
    if (!template) {
      logger.error('Template not found', { templateId });
      return null;
    }

    // Replace placeholders in title and body
    let title = customizations?.title || template.title;
    let body = customizations?.body || template.body;

    if (dynamicData) {
      Object.entries(dynamicData).forEach(([key, value]) => {
        const placeholder = `{{${key}}}`;
        title = title.replace(new RegExp(placeholder, 'g'), value);
        body = body.replace(new RegExp(placeholder, 'g'), value);
      });
    }

    return {
      title,
      body,
      data: {
        ...template.data,
        ...dynamicData
      },
      imageUrl: customizations?.imageUrl || template.imageUrl,
      clickAction: customizations?.clickAction || template.clickAction,
      notificationType: template.type as any,
      userId: '', // Will be set by caller
      priority: template.priority,
      metadata: dynamicData
    };
  }

  /**
   * Send user management notification using template
   */
  async sendUserManagementNotification(
    userId: string,
    templateId: string,
    dynamicData?: Record<string, string>,
    customizations?: {
      title?: string;
      body?: string;
      imageUrl?: string;
      clickAction?: string;
      relatedId?: string;
    }
  ): Promise<NotificationHistory | null> {
    try {
      const payload = this.createNotificationFromTemplate(templateId, dynamicData, customizations);
      if (!payload) {
        throw new Error(`Template ${templateId} not found`);
      }

      payload.userId = userId;
      payload.relatedId = customizations?.relatedId;

      // Check user notification preferences before sending
      const canSend = await this.checkUserNotificationPreferences(userId, payload.notificationType);
      if (!canSend) {
        logger.info('Notification blocked by user preferences', { userId, templateId, type: payload.notificationType });
        return null;
      }

      // Send the notification
      const history = await this.sendNotificationToUser(userId, payload);

      // Log the user management notification
      await this.logUserManagementNotification(userId, templateId, payload, history.id);

      logger.info('User management notification sent', {
        userId,
        templateId,
        notificationType: payload.notificationType,
        priority: payload.priority,
        historyId: history.id
      });

      return history;
    } catch (error) {
      logger.error('Failed to send user management notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        templateId
      });
      return null;
    }
  }

  /**
   * Send bulk user management notifications with preference filtering
   */
  async sendBulkUserManagementNotifications(
    userIds: string[],
    templateId: string,
    dynamicDataPerUser?: Record<string, Record<string, string>>,
    customizations?: {
      title?: string;
      body?: string;
      imageUrl?: string;
      clickAction?: string;
    }
  ): Promise<{
    successful: number;
    failed: number;
    blocked: number;
    results: Array<{
      userId: string;
      success: boolean;
      historyId?: string;
      error?: string;
      blocked?: boolean;
    }>;
  }> {
    try {
      // Get template to determine notification type
      const template = this.getTemplate(templateId);
      if (!template) {
        throw new Error(`Template ${templateId} not found`);
      }

      // Filter users by notification preferences
      const { allowedUsers, blockedUsers, preferencesMap } = await this.filterUsersByNotificationPreferences(
        userIds,
        template.type
      );

      const results = [];
      let successful = 0;
      let failed = 0;
      let blocked = 0;

      // Add blocked users to results
      blockedUsers.forEach(userId => {
        results.push({
          userId,
          success: false,
          blocked: true,
          error: 'Notification blocked by user preferences'
        });
        blocked++;
      });

      // Send notifications to allowed users
      for (const userId of allowedUsers) {
        try {
          const dynamicData = dynamicDataPerUser?.[userId];
          const history = await this.sendUserManagementNotification(
            userId,
            templateId,
            dynamicData,
            customizations
          );

          if (history) {
            results.push({
              userId,
              success: true,
              historyId: history.id
            });
            successful++;
          } else {
            results.push({
              userId,
              success: false,
              error: 'Failed to send notification'
            });
            failed++;
          }
        } catch (error) {
          results.push({
            userId,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
          failed++;
        }
      }

      logger.info('Bulk user management notifications completed', {
        templateId,
        totalUsers: userIds.length,
        allowedUsers: allowedUsers.length,
        successful,
        failed,
        blocked
      });

      return { successful, failed, blocked, results };
    } catch (error) {
      logger.error('Failed to send bulk user management notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        templateId,
        userCount: userIds.length
      });

      // Return failed results for all users
      const results = userIds.map(userId => ({
        userId,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }));

      return {
        successful: 0,
        failed: userIds.length,
        blocked: 0,
        results
      };
    }
  }

  /**
   * Get comprehensive notification preferences for a user
   */
  async getUserNotificationPreferences(userId: string): Promise<NotificationSettings | null> {
    try {
      const { data: settings, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !settings) {
        logger.warn('User notification settings not found, using defaults', { userId, error });
        return null;
      }

      return {
        userId,
        pushEnabled: settings.push_notifications_enabled,
        emailEnabled: true, // Not stored in user_settings yet
        smsEnabled: false, // Not stored in user_settings yet
        reservationUpdates: settings.reservation_notifications,
        paymentNotifications: true, // Always enabled for important notifications
        promotionalMessages: settings.marketing_notifications,
        systemAlerts: true, // Always enabled for system notifications
        userManagementAlerts: true, // Always enabled for user management
        securityAlerts: true, // Always enabled for security
        profileUpdateConfirmations: settings.event_notifications,
        adminActionNotifications: true, // Always enabled for admin actions
        updatedAt: settings.updated_at
      };
    } catch (error) {
      logger.error('Failed to get user notification preferences', { error, userId });
      return null;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserNotificationPreferences(
    userId: string,
    preferences: Partial<NotificationSettings>
  ): Promise<NotificationSettings | null> {
    try {
      // Map NotificationSettings to user_settings table fields
      const updateData: any = {};
      
      if (preferences.pushEnabled !== undefined) {
        updateData.push_notifications_enabled = preferences.pushEnabled;
      }
      if (preferences.reservationUpdates !== undefined) {
        updateData.reservation_notifications = preferences.reservationUpdates;
      }
      if (preferences.promotionalMessages !== undefined) {
        updateData.marketing_notifications = preferences.promotionalMessages;
      }
      if (preferences.profileUpdateConfirmations !== undefined) {
        updateData.event_notifications = preferences.profileUpdateConfirmations;
      }

      const { data: updatedSettings, error } = await this.supabase
        .from('user_settings')
        .update(updateData)
        .eq('user_id', userId)
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to update notification preferences: ${error.message}`);
      }

      logger.info('User notification preferences updated', { userId, preferences });

      // Return updated preferences
      return await this.getUserNotificationPreferences(userId);
    } catch (error) {
      logger.error('Failed to update user notification preferences', { error, userId, preferences });
      return null;
    }
  }

  /**
   * Check if user allows this type of notification (enhanced version)
   */
  private async checkUserNotificationPreferences(
    userId: string,
    notificationType: string
  ): Promise<boolean> {
    try {
      const preferences = await this.getUserNotificationPreferences(userId);
      
      if (!preferences) {
        // Default to allowing notifications if settings not found
        return true;
      }

      // Check global push notification setting
      if (!preferences.pushEnabled) {
        return false;
      }

      // Check specific notification type preferences
      switch (notificationType) {
        case 'welcome':
          return true; // Always allow welcome notifications
        case 'profile_update':
          return preferences.profileUpdateConfirmations;
        case 'account_status':
        case 'role_change':
          return preferences.userManagementAlerts;
        case 'security_alert':
          return preferences.securityAlerts;
        case 'admin_action':
          return preferences.adminActionNotifications;
        default:
          return preferences.systemAlerts; // Default to system alerts setting
      }
    } catch (error) {
      logger.error('Failed to check notification preferences', { error, userId });
      return true; // Default to allowing notifications on error
    }
  }

  /**
   * Get notification preferences summary for multiple users
   */
  async getBulkUserNotificationPreferences(
    userIds: string[]
  ): Promise<Record<string, NotificationSettings | null>> {
    try {
      const { data: settingsData, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .in('user_id', userIds);

      if (error) {
        throw new Error(`Failed to get bulk notification preferences: ${error.message}`);
      }

      const preferences: Record<string, NotificationSettings | null> = {};

      // Initialize all users with null
      userIds.forEach(userId => {
        preferences[userId] = null;
      });

      // Map settings data to preferences
      (settingsData || []).forEach(settings => {
        preferences[settings.user_id] = {
          userId: settings.user_id,
          pushEnabled: settings.push_notifications_enabled,
          emailEnabled: true,
          smsEnabled: false,
          reservationUpdates: settings.reservation_notifications,
          paymentNotifications: true,
          promotionalMessages: settings.marketing_notifications,
          systemAlerts: true,
          userManagementAlerts: true,
          securityAlerts: true,
          profileUpdateConfirmations: settings.event_notifications,
          adminActionNotifications: true,
          updatedAt: settings.updated_at
        };
      });

      return preferences;
    } catch (error) {
      logger.error('Failed to get bulk notification preferences', { error, userIds });
      return {};
    }
  }

  /**
   * Filter users based on notification preferences for bulk sending
   */
  async filterUsersByNotificationPreferences(
    userIds: string[],
    notificationType: string
  ): Promise<{
    allowedUsers: string[];
    blockedUsers: string[];
    preferencesMap: Record<string, NotificationSettings | null>;
  }> {
    try {
      const preferencesMap = await this.getBulkUserNotificationPreferences(userIds);
      const allowedUsers: string[] = [];
      const blockedUsers: string[] = [];

      for (const userId of userIds) {
        const preferences = preferencesMap[userId];
        
        if (!preferences) {
          // Default to allowing if no preferences found
          allowedUsers.push(userId);
          continue;
        }

        // Check if user allows this notification type
        let allowed = false;

        if (!preferences.pushEnabled) {
          allowed = false;
        } else {
          switch (notificationType) {
            case 'welcome':
              allowed = true;
              break;
            case 'profile_update':
              allowed = preferences.profileUpdateConfirmations;
              break;
            case 'account_status':
            case 'role_change':
              allowed = preferences.userManagementAlerts;
              break;
            case 'security_alert':
              allowed = preferences.securityAlerts;
              break;
            case 'admin_action':
              allowed = preferences.adminActionNotifications;
              break;
            default:
              allowed = preferences.systemAlerts;
              break;
          }
        }

        if (allowed) {
          allowedUsers.push(userId);
        } else {
          blockedUsers.push(userId);
        }
      }

      logger.info('Users filtered by notification preferences', {
        notificationType,
        totalUsers: userIds.length,
        allowedUsers: allowedUsers.length,
        blockedUsers: blockedUsers.length
      });

      return {
        allowedUsers,
        blockedUsers,
        preferencesMap
      };
    } catch (error) {
      logger.error('Failed to filter users by notification preferences', { error, userIds, notificationType });
      return {
        allowedUsers: userIds, // Default to allowing all users on error
        blockedUsers: [],
        preferencesMap: {}
      };
    }
  }

  /**
   * Create default notification settings for a new user
   */
  async createDefaultNotificationSettings(userId: string): Promise<NotificationSettings | null> {
    try {
      const { data: existingSettings } = await this.supabase
        .from('user_settings')
        .select('user_id')
        .eq('user_id', userId)
        .single();

      if (existingSettings) {
        logger.info('User settings already exist', { userId });
        return await this.getUserNotificationPreferences(userId);
      }

      // Create default settings
      const { data: newSettings, error } = await this.supabase
        .from('user_settings')
        .insert({
          user_id: userId,
          push_notifications_enabled: true,
          reservation_notifications: true,
          event_notifications: true,
          marketing_notifications: false, // Default to false for marketing
          location_tracking_enabled: true,
          language_preference: 'ko',
          currency_preference: 'KRW',
          theme_preference: 'light'
        })
        .select('*')
        .single();

      if (error) {
        throw new Error(`Failed to create default notification settings: ${error.message}`);
      }

      logger.info('Default notification settings created', { userId });

      return await this.getUserNotificationPreferences(userId);
    } catch (error) {
      logger.error('Failed to create default notification settings', { error, userId });
      return null;
    }
  }

  /**
   * Log user management notification for audit purposes
   */
  private async logUserManagementNotification(
    userId: string,
    templateId: string,
    payload: UserManagementNotificationPayload,
    historyId: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: payload.notificationType,
          title: payload.title,
          message: payload.body,
          status: 'unread',
          related_id: payload.relatedId,
          action_url: payload.clickAction,
          sent_at: new Date().toISOString(),
          created_at: new Date().toISOString()
        });

      logger.debug('User management notification logged', {
        userId,
        templateId,
        historyId,
        type: payload.notificationType
      });
    } catch (error) {
      logger.error('Failed to log user management notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        templateId,
        historyId
      });
    }
  }

  /**
   * Send push notification to a single user with delivery tracking
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

      // Create initial delivery status record
      const deliveryStatus = await this.createDeliveryStatus(userId, payload);

      const results = await Promise.allSettled(
        tokens.map(token => this.sendToDevice(token.token, payload))
      );

      // Log notification history
      const history = await this.logNotificationHistory(userId, payload, results);

      // Update delivery status based on results
      await this.updateDeliveryStatus(deliveryStatus.notificationId, results);

      // Check if any notifications were sent successfully
      const successfulResults = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      );

      if (successfulResults.length === 0) {
        await this.markDeliveryAsFailed(deliveryStatus.notificationId, 'Failed to send to any device');
        throw new Error('Failed to send notification to any device');
      }

      // Update token last used timestamps for successful sends
      await Promise.allSettled(
        tokens.map((token, index) => {
          const result = results[index];
          if (result.status === 'fulfilled' && result.value.success) {
            return this.updateTokenLastUsed(token.token);
          }
          return Promise.resolve();
        })
      );

      logger.info(`Notification sent to user ${userId}`, {
        userId,
        title: payload.title,
        successfulDevices: successfulResults.length,
        totalDevices: tokens.length,
        deliveryId: deliveryStatus.notificationId
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
   * Create initial delivery status record
   */
  private async createDeliveryStatus(userId: string, payload: NotificationPayload): Promise<NotificationDeliveryStatus> {
    const notificationId = `notif_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const deliveryStatus: NotificationDeliveryStatus = {
      notificationId,
      userId,
      status: 'pending',
      deliveryAttempts: 0,
      lastAttemptAt: new Date().toISOString()
    };

    // Store in memory or database - for now we'll return the object
    // In a production system, you might want to store this in a delivery_status table
    logger.debug('Created delivery status record', { notificationId, userId });
    
    return deliveryStatus;
  }

  /**
   * Update delivery status based on FCM results
   */
  private async updateDeliveryStatus(
    notificationId: string,
    results: PromiseSettledResult<{ success: boolean; messageId?: string; error?: string }>[]
  ): Promise<void> {
    try {
      const successfulResults = results.filter(
        result => result.status === 'fulfilled' && result.value.success
      );
      
      const failedResults = results.filter(
        result => result.status === 'rejected' || (result.status === 'fulfilled' && !result.value.success)
      );

      let status: NotificationDeliveryStatus['status'] = 'failed';
      let fcmMessageId: string | undefined;
      let errorMessage: string | undefined;

      if (successfulResults.length > 0) {
        status = 'sent';
        // Get the first successful message ID
        const firstSuccess = successfulResults[0];
        if (firstSuccess.status === 'fulfilled') {
          fcmMessageId = firstSuccess.value.messageId;
        }
      }

      if (failedResults.length > 0) {
        const errors = failedResults.map(result => {
          if (result.status === 'rejected') {
            return result.reason?.message || 'Unknown error';
          } else if (result.status === 'fulfilled') {
            return result.value.error || 'Send failed';
          }
          return 'Unknown error';
        });
        errorMessage = errors.join('; ');
      }

      // In a production system, you would update the database record here
      logger.debug('Updated delivery status', {
        notificationId,
        status,
        successfulDeliveries: successfulResults.length,
        failedDeliveries: failedResults.length,
        fcmMessageId,
        errorMessage
      });

    } catch (error) {
      logger.error('Failed to update delivery status', { error, notificationId });
    }
  }

  /**
   * Mark delivery as failed
   */
  private async markDeliveryAsFailed(notificationId: string, errorMessage: string): Promise<void> {
    try {
      // In a production system, you would update the database record here
      logger.debug('Marked delivery as failed', { notificationId, errorMessage });
    } catch (error) {
      logger.error('Failed to mark delivery as failed', { error, notificationId });
    }
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(notificationId: string): Promise<NotificationDeliveryStatus | null> {
    try {
      // In a production system, you would query the database here
      // For now, return null as we're not persisting delivery status
      logger.debug('Getting delivery status', { notificationId });
      return null;
    } catch (error) {
      logger.error('Failed to get delivery status', { error, notificationId });
      return null;
    }
  }

  /**
   * Get delivery statistics for a user
   */
  async getUserDeliveryStats(userId: string, dateRange?: { startDate: string; endDate: string }): Promise<{
    totalNotifications: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    pendingDeliveries: number;
    deliveryRate: number;
    averageDeliveryTime?: number;
  }> {
    try {
      // In a production system, you would query the delivery_status table here
      // For now, return mock data based on notification history
      
      let query = this.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', userId);

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.startDate)
          .lte('created_at', dateRange.endDate);
      }

      const { data: notifications, error } = await query;
      
      if (error) {
        throw new Error(`Failed to get delivery stats: ${error.message}`);
      }

      const totalNotifications = notifications?.length || 0;
      const successfulDeliveries = notifications?.filter(n => n.sent_at).length || 0;
      const failedDeliveries = totalNotifications - successfulDeliveries;
      const pendingDeliveries = 0; // Assuming all are processed
      const deliveryRate = totalNotifications > 0 ? (successfulDeliveries / totalNotifications) * 100 : 0;

      return {
        totalNotifications,
        successfulDeliveries,
        failedDeliveries,
        pendingDeliveries,
        deliveryRate
      };
    } catch (error) {
      logger.error('Failed to get user delivery stats', { error, userId });
      return {
        totalNotifications: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        pendingDeliveries: 0,
        deliveryRate: 0
      };
    }
  }

  /**
   * Get system-wide delivery statistics
   */
  async getSystemDeliveryStats(dateRange?: { startDate: string; endDate: string }): Promise<{
    totalNotifications: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    deliveryRate: number;
    topFailureReasons: Array<{ reason: string; count: number }>;
    deliveryTrends: Array<{ date: string; sent: number; failed: number }>;
  }> {
    try {
      let query = this.supabase
        .from('notifications')
        .select('*');

      if (dateRange) {
        query = query
          .gte('created_at', dateRange.startDate)
          .lte('created_at', dateRange.endDate);
      }

      const { data: notifications, error } = await query;
      
      if (error) {
        throw new Error(`Failed to get system delivery stats: ${error.message}`);
      }

      const totalNotifications = notifications?.length || 0;
      const successfulDeliveries = notifications?.filter(n => n.sent_at).length || 0;
      const failedDeliveries = totalNotifications - successfulDeliveries;
      const deliveryRate = totalNotifications > 0 ? (successfulDeliveries / totalNotifications) * 100 : 0;

      // Mock data for failure reasons and trends
      const topFailureReasons = [
        { reason: 'Invalid FCM token', count: Math.floor(failedDeliveries * 0.4) },
        { reason: 'User uninstalled app', count: Math.floor(failedDeliveries * 0.3) },
        { reason: 'Network timeout', count: Math.floor(failedDeliveries * 0.2) },
        { reason: 'Other', count: Math.floor(failedDeliveries * 0.1) }
      ];

      const deliveryTrends = []; // Would be populated with daily stats in production

      return {
        totalNotifications,
        successfulDeliveries,
        failedDeliveries,
        deliveryRate,
        topFailureReasons,
        deliveryTrends
      };
    } catch (error) {
      logger.error('Failed to get system delivery stats', { error });
      return {
        totalNotifications: 0,
        successfulDeliveries: 0,
        failedDeliveries: 0,
        deliveryRate: 0,
        topFailureReasons: [],
        deliveryTrends: []
      };
    }
  }

  /**
   * Retry failed notification delivery
   */
  async retryFailedDelivery(notificationId: string): Promise<boolean> {
    try {
      // In a production system, you would:
      // 1. Get the original notification details from delivery_status table
      // 2. Check if retry limit hasn't been exceeded
      // 3. Attempt to resend the notification
      // 4. Update delivery status with new attempt
      
      logger.info('Retrying failed notification delivery', { notificationId });
      
      // For now, return false as we don't have persistent delivery status
      return false;
    } catch (error) {
      logger.error('Failed to retry notification delivery', { error, notificationId });
      return false;
    }
  }

  /**
   * Clean up old delivery status records
   */
  async cleanupOldDeliveryRecords(daysOld: number = 30): Promise<number> {
    try {
      // In a production system, you would delete old delivery_status records
      logger.info('Cleaning up old delivery records', { daysOld });
      return 0; // No records to clean up in current implementation
    } catch (error) {
      logger.error('Failed to cleanup old delivery records', { error });
      return 0;
    }
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    const legacyTemplates: NotificationTemplate[] = [
      {
        id: 'reservation_confirmed',
        type: 'reservation_confirmed',
        title: '예약이 확인되었습니다',
        body: '예약이 성공적으로 확인되었습니다. 예약 시간을 확인해주세요.',
        clickAction: 'OPEN_RESERVATION',
        data: { type: 'reservation_confirmed' },
        priority: 'medium',
        category: 'general'
      },
      {
        id: 'reservation_cancelled',
        type: 'reservation_cancelled',
        title: '예약이 취소되었습니다',
        body: '예약이 취소되었습니다. 자세한 내용을 확인해주세요.',
        clickAction: 'OPEN_RESERVATION',
        data: { type: 'reservation_cancelled' },
        priority: 'medium',
        category: 'general'
      },
      {
        id: 'payment_success',
        type: 'payment_success',
        title: '결제가 완료되었습니다',
        body: '결제가 성공적으로 완료되었습니다.',
        clickAction: 'OPEN_PAYMENT',
        data: { type: 'payment_success' },
        priority: 'high',
        category: 'general'
      },
      {
        id: 'payment_failed',
        type: 'payment_failed',
        title: '결제 실패',
        body: '결제 처리 중 오류가 발생했습니다. 다시 시도해주세요.',
        clickAction: 'OPEN_PAYMENT',
        data: { type: 'payment_failed' },
        priority: 'high',
        category: 'general'
      },
      {
        id: 'referral_bonus',
        type: 'referral_bonus',
        title: '추천 보너스 지급',
        body: '추천인 보너스가 지급되었습니다!',
        clickAction: 'OPEN_REFERRAL',
        data: { type: 'referral_bonus' },
        priority: 'medium',
        category: 'general'
      },
      {
        id: 'shop_approved',
        type: 'shop_approved',
        title: '🎉 매장 승인이 완료되었습니다!',
        body: '축하합니다! 매장 등록이 승인되어 이제 고객 예약을 받을 수 있습니다. 매장 관리 페이지에서 서비스를 설정해보세요.',
        clickAction: '/shop/dashboard',
        data: { 
          type: 'shop_approved',
          action: 'view_dashboard',
          category: 'user_management'
        },
        priority: 'high',
        category: 'user_management'
      },
      {
        id: 'shop_rejected',
        type: 'shop_rejected',
        title: '매장 등록 검토 결과 안내',
        body: '매장 등록 신청이 승인되지 않았습니다. 거부 사유를 확인하시고 필요한 서류를 보완하여 다시 신청해주세요.',
        clickAction: '/shop/registration/status',
        data: { 
          type: 'shop_rejected',
          action: 'view_rejection_reason',
          category: 'user_management'
        },
        priority: 'high',
        category: 'user_management'
      },
      {
        id: 'system_maintenance',
        type: 'system_maintenance',
        title: '시스템 점검 안내',
        body: '시스템 점검이 예정되어 있습니다. 불편을 드려 죄송합니다.',
        clickAction: 'OPEN_MAINTENANCE',
        data: { type: 'system_maintenance' },
        priority: 'medium',
        category: 'system'
      }
    ];

    // Combine legacy templates with user management templates
    return [...legacyTemplates, ...this.getAllTemplates()];
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