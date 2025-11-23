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

  // Korean Reservation Notification Templates
  private readonly RESERVATION_NOTIFICATION_TEMPLATES: Record<string, NotificationTemplate> = {
    reservation_requested: {
      id: 'reservation_requested',
      type: 'reservation_requested',
      title: '새로운 예약 요청이 접수되었습니다 📝',
      body: '새로운 예약 요청이 들어왔습니다. 확인 후 승인해주세요.',
      priority: 'high',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_requested',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_requested_user: {
      id: 'reservation_requested_user',
      type: 'reservation_requested',
      title: '예약 요청이 접수되었습니다 ✅',
      body: '예약 요청이 성공적으로 접수되었습니다. 승인 대기 중입니다.',
      priority: 'medium',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_requested',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_confirmed: {
      id: 'reservation_confirmed',
      type: 'reservation_confirmed',
      title: '예약이 확정되었습니다 🎉',
      body: '예약이 성공적으로 확정되었습니다. 예약 시간을 확인해주세요.',
      priority: 'high',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_confirmed',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_confirmed_shop: {
      id: 'reservation_confirmed_shop',
      type: 'reservation_confirmed',
      title: '예약을 확정했습니다 ✅',
      body: '예약이 성공적으로 확정되었습니다.',
      priority: 'medium',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_confirmed',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_rejected: {
      id: 'reservation_rejected',
      type: 'reservation_rejected',
      title: '예약이 거절되었습니다 ❌',
      body: '죄송합니다. 예약이 거절되었습니다. 다른 시간을 선택해주세요.',
      priority: 'high',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_rejected',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_rejected_shop: {
      id: 'reservation_rejected_shop',
      type: 'reservation_rejected',
      title: '예약을 거절했습니다 ❌',
      body: '예약이 거절되었습니다.',
      priority: 'medium',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_rejected',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_completed: {
      id: 'reservation_completed',
      type: 'reservation_completed',
      title: '서비스가 완료되었습니다 ✨',
      body: '서비스가 성공적으로 완료되었습니다. 만족도 평가를 남겨주세요.',
      priority: 'medium',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_completed',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_completed_shop: {
      id: 'reservation_completed_shop',
      type: 'reservation_completed',
      title: '서비스를 완료했습니다 ✨',
      body: '서비스가 완료되었습니다.',
      priority: 'low',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_completed',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_cancelled_user: {
      id: 'reservation_cancelled_user',
      type: 'reservation_cancelled',
      title: '예약이 취소되었습니다 🚫',
      body: '예약이 취소되었습니다. 환불 정보를 확인해주세요.',
      priority: 'high',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_cancelled',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_cancelled_shop: {
      id: 'reservation_cancelled_shop',
      type: 'reservation_cancelled',
      title: '예약이 취소되었습니다 🚫',
      body: '예약이 취소되었습니다. 자세한 내용을 확인해주세요.',
      priority: 'high',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_cancelled',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_no_show: {
      id: 'reservation_no_show',
      type: 'reservation_no_show',
      title: '예약 시간에 방문하지 않으셨습니다 ⏰',
      body: '예약 시간에 방문하지 않으셨습니다. 예약 정책을 확인해주세요.',
      priority: 'medium',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_no_show',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_no_show_shop: {
      id: 'reservation_no_show_shop',
      type: 'reservation_no_show',
      title: '고객이 방문하지 않았습니다 ⏰',
      body: '예약 시간에 고객이 방문하지 않았습니다.',
      priority: 'medium',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_no_show',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_reminder: {
      id: 'reservation_reminder',
      type: 'reservation_reminder',
      title: '예약 시간이 다가옵니다 ⏰',
      body: '예약 시간이 1시간 남았습니다. 시간을 확인해주세요.',
      priority: 'medium',
      category: 'general',
      clickAction: '/reservations',
      data: {
        type: 'reservation_reminder',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    },
    reservation_reminder_shop: {
      id: 'reservation_reminder_shop',
      type: 'reservation_reminder',
      title: '예약 시간이 다가옵니다 ⏰',
      body: '예약 시간이 1시간 남았습니다.',
      priority: 'medium',
      category: 'general',
      clickAction: '/shop/reservations',
      data: {
        type: 'reservation_reminder',
        action: 'view_reservation',
        notification_type: 'reservation'
      }
    }
  };

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
      try {
        const initMethod = process.env.FIREBASE_AUTH_METHOD || 'auto';

        if (initMethod === 'service_account' || initMethod === 'auto') {
          // Try to load service account file
          const serviceAccountPath = process.env.FIREBASE_ADMIN_SDK_PATH || './config/firebase-admin-sdk.json';
          const fs = require('fs');
          const path = require('path');
          const fullPath = path.resolve(serviceAccountPath);

          if (fs.existsSync(fullPath)) {
            const serviceAccount = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

            this.firebaseApp = admin.initializeApp({
              credential: admin.credential.cert(serviceAccount),
              projectId: serviceAccount.project_id || process.env.FCM_PROJECT_ID
            });

            logger.info('Firebase Admin SDK initialized with service account file', {
              projectId: serviceAccount.project_id,
              method: 'service_account'
            });
            return;
          }
        }

        if (initMethod === 'refresh_token') {
          // Method 2: Use refresh token (for environments where service account keys are restricted)
          const refreshToken = process.env.FIREBASE_REFRESH_TOKEN;

          if (refreshToken) {
            this.firebaseApp = admin.initializeApp({
              credential: admin.credential.refreshToken(refreshToken),
              projectId: process.env.FCM_PROJECT_ID
            });

            logger.info('Firebase Admin SDK initialized with refresh token', {
              projectId: process.env.FCM_PROJECT_ID,
              method: 'refresh_token'
            });
            return;
          }
        }

        // Method 3: Application Default Credentials (fallback)
        logger.info('Using Application Default Credentials for Firebase', {
          projectId: process.env.FCM_PROJECT_ID,
          method: 'application_default'
        });

        this.firebaseApp = admin.initializeApp({
          credential: admin.credential.applicationDefault(),
          projectId: process.env.FCM_PROJECT_ID || 'e-beautything'
        });

        logger.info('Firebase Admin SDK initialized successfully', {
          projectId: process.env.FCM_PROJECT_ID
        });

      } catch (error) {
        logger.error('Failed to initialize Firebase Admin SDK', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined
        });
        throw new Error('Firebase Admin SDK initialization failed');
      }
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
    payload: NotificationPayload & {
      fcmPriority?: 'normal' | 'high';
      androidConfig?: any;
      apnsConfig?: any;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Base message configuration
      const message: admin.messaging.Message = {
        token,
        notification: {
          title: payload.title,
          body: payload.body,
          ...(payload.imageUrl && { imageUrl: payload.imageUrl })
        },
        ...(payload.data && { data: payload.data })
      };

      // Android configuration with priority support
      const androidConfig = payload.androidConfig || {};
      message.android = {
        priority: payload.fcmPriority || 'normal',
        notification: {
          ...(payload.clickAction && { clickAction: payload.clickAction }),
          icon: androidConfig.icon || 'ic_notification',
          color: androidConfig.color || '#FF5C00',
          ...(androidConfig.sound && { sound: androidConfig.sound }),
          ...(androidConfig.channel_id && { channelId: androidConfig.channel_id }),
          ...(androidConfig.priority && { priority: androidConfig.priority }),
          ...(androidConfig.visibility && { visibility: androidConfig.visibility })
        }
      };

      // iOS configuration with priority support
      const apnsConfig = payload.apnsConfig || {};
      message.apns = {
        headers: {
          'apns-priority': '10',  // Always use high priority for notifications
          'apns-push-type': 'alert'  // Specify alert type for visible notifications
        },
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body
            },
            badge: apnsConfig.badge || 1,
            sound: apnsConfig.sound || 'default',
            'content-available': 1,  // Enable background updates
            ...(apnsConfig.mutableContent && { 'mutable-content': apnsConfig.mutableContent })
          }
        }
      };

      // Add webpush configuration for web clients
      message.webpush = {
        notification: {
          title: payload.title,
          body: payload.body,
          icon: '/icon-192x192.png',
          badge: '/badge-72x72.png',
          ...(payload.clickAction && {
            actions: [
              {
                action: 'open',
                title: '열기'
              }
            ]
          })
        },
        ...(payload.clickAction && {
          fcmOptions: {
            link: payload.clickAction
          }
        })
      };

      const response = await this.firebaseApp.messaging().send(message);

      logger.info('FCM notification sent successfully', {
        messageId: response,
        token: token.substring(0, 20) + '...',
        title: payload.title
      });

      return {
        success: true,
        messageId: response
      };
    } catch (error) {
      logger.error('Failed to send notification to device', {
        error: error instanceof Error ? error.message : 'Unknown error',
        errorCode: (error as any)?.errorInfo?.code,
        token: token.substring(0, 20) + '...',
        title: payload.title
      });
      
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
          user_id: userId,
          title: payload.title,
          body: payload.body,
          data: payload.data,
          status,
          sent_at: status === 'sent' ? new Date().toISOString() : undefined,
          error_message: errorMessage,
          created_at: new Date().toISOString()
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
   * Get reservation notification template by type and recipient
   */
  getReservationNotificationTemplate(
    type: string, 
    recipient: 'user' | 'shop' = 'user'
  ): NotificationTemplate | null {
    const templateKey = recipient === 'shop' ? `${type}_shop` : type;
    return this.RESERVATION_NOTIFICATION_TEMPLATES[templateKey] || 
           this.RESERVATION_NOTIFICATION_TEMPLATES[type] || null;
  }

  /**
   * Get all reservation notification templates
   */
  getAllReservationNotificationTemplates(): NotificationTemplate[] {
    return Object.values(this.RESERVATION_NOTIFICATION_TEMPLATES);
  }

  /**
   * Send reservation notification with enhanced FCM integration
   */
  async sendReservationNotification(
    userId: string,
    templateType: string,
    recipient: 'user' | 'shop' = 'user',
    reservationData?: Record<string, any>
  ): Promise<NotificationHistory> {
    try {
      const template = this.getReservationNotificationTemplate(templateType, recipient);
      if (!template) {
        throw new Error(`Reservation notification template not found: ${templateType}`);
      }

      // Customize template with reservation data if provided
      const customizedTemplate = this.customizeReservationTemplate(template, reservationData);

      // Enhance payload with reservation-specific metadata for FCM
      const enhancedPayload: NotificationPayload = {
        title: customizedTemplate.title,
        body: customizedTemplate.body,
        data: {
          ...customizedTemplate.data,
          notificationType: templateType,
          recipient: recipient,
          reservationId: reservationData?.reservationId || '',
          shopId: reservationData?.shopId || '',
          priority: customizedTemplate.priority,
          category: customizedTemplate.category,
          clickAction: customizedTemplate.clickAction || '',
          timestamp: new Date().toISOString()
        },
        clickAction: customizedTemplate.clickAction
      };

      // Send notification with enhanced FCM payload
      return await this.sendNotificationToUser(userId, enhancedPayload);

    } catch (error) {
      logger.error('Failed to send reservation notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        templateType,
        recipient
      });

      return {
        id: `error_${Date.now()}`,
        userId,
        title: 'Notification Error',
        body: 'Failed to send notification',
        status: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date().toISOString()
      };
    }
  }

  /**
   * Send reservation notification with priority-based FCM configuration
   */
  async sendReservationNotificationWithPriority(
    userId: string,
    templateType: string,
    recipient: 'user' | 'shop' = 'user',
    reservationData?: Record<string, any>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<NotificationHistory> {
    try {
      const template = this.getReservationNotificationTemplate(templateType, recipient);
      if (!template) {
        throw new Error(`Reservation notification template not found: ${templateType}`);
      }

      // Customize template with reservation data if provided
      const customizedTemplate = this.customizeReservationTemplate(template, reservationData);

      // Determine FCM priority based on notification priority
      const fcmPriority = this.mapPriorityToFCM(priority);

      // Create enhanced payload with priority configuration
      const enhancedPayload: NotificationPayload & { 
        fcmPriority?: 'normal' | 'high';
        androidConfig?: any;
        apnsConfig?: any;
      } = {
        title: customizedTemplate.title,
        body: customizedTemplate.body,
        data: {
          ...customizedTemplate.data,
          notificationType: templateType,
          recipient: recipient,
          reservationId: reservationData?.reservationId || '',
          shopId: reservationData?.shopId || '',
          priority: priority,
          category: customizedTemplate.category,
          clickAction: customizedTemplate.clickAction || '',
          timestamp: new Date().toISOString()
        },
        clickAction: customizedTemplate.clickAction,
        fcmPriority: fcmPriority
      };

      // Add platform-specific configurations for high priority notifications
      if (priority === 'high' || priority === 'critical') {
        enhancedPayload.androidConfig = {
          priority: 'high',
          notification: {
            sound: 'default',
            channel_id: 'reservation_notifications',
            priority: 'high',
            visibility: 'public'
          }
        };

        enhancedPayload.apnsConfig = {
          payload: {
            aps: {
              'content-available': 1,
              'mutable-content': 1,
              sound: 'default',
              badge: 1
            }
          }
        };
      }

      // Send notification with priority configuration
      return await this.sendNotificationToUser(userId, enhancedPayload);

    } catch (error) {
      logger.error('Failed to send priority reservation notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        templateType,
        recipient,
        priority
      });

      return {
        id: `error_${Date.now()}`,
        userId,
        title: 'Notification Error',
        body: 'Failed to send notification',
        status: 'failed' as const,
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        createdAt: new Date().toISOString()
      };
    }
  }

  /**
   * Map notification priority to FCM priority
   */
  private mapPriorityToFCM(priority: 'low' | 'medium' | 'high' | 'critical'): 'normal' | 'high' {
    switch (priority) {
      case 'high':
      case 'critical':
        return 'high';
      case 'low':
      case 'medium':
      default:
        return 'normal';
    }
  }

  /**
   * Enhanced device token management for reservation notifications
   */
  async registerDeviceTokenForReservations(
    userId: string,
    token: string,
    deviceInfo: {
      platform: 'ios' | 'android' | 'web';
      deviceModel?: string;
      appVersion?: string;
      osVersion?: string;
    }
  ): Promise<boolean> {
    try {
      const { data, error } = await this.supabase
        .from('user_device_tokens')
        .upsert({
          user_id: userId,
          token: token,
          platform: deviceInfo.platform,
          device_model: deviceInfo.deviceModel,
          app_version: deviceInfo.appVersion,
          os_version: deviceInfo.osVersion,
          is_active: true,
          last_used_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'user_id,token'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to register device token for reservations', { error, userId, token });
        return false;
      }

      logger.info('Device token registered for reservation notifications', {
        userId,
        token: token.substring(0, 10) + '...',
        platform: deviceInfo.platform
      });

      return true;
    } catch (error) {
      logger.error('Failed to register device token for reservations', { error, userId });
      return false;
    }
  }

  /**
   * Get active device tokens for reservation notifications with filtering
   */
  async getActiveDeviceTokensForReservations(userId: string): Promise<Array<{
    token: string;
    platform: string;
    lastUsedAt: string;
    deviceModel?: string;
  }>> {
    try {
      const { data, error } = await this.supabase
        .from('user_device_tokens')
        .select('token, platform, last_used_at, device_model')
        .eq('user_id', userId)
        .eq('is_active', true)
        .order('last_used_at', { ascending: false });

      if (error) {
        logger.error('Failed to get active device tokens for reservations', { error, userId });
        return [];
      }

      return data.map(token => ({
        token: token.token,
        platform: token.platform,
        lastUsedAt: token.last_used_at,
        deviceModel: token.device_model
      }));
    } catch (error) {
      logger.error('Failed to get active device tokens for reservations', { error, userId });
      return [];
    }
  }

  /**
   * Fallback notification delivery system with multiple channels
   */
  async sendReservationNotificationWithFallback(
    userId: string,
    templateType: string,
    recipient: 'user' | 'shop' = 'user',
    reservationData?: Record<string, any>,
    options: {
      priority?: 'low' | 'medium' | 'high' | 'critical';
      fallbackChannels?: ('websocket' | 'push' | 'email' | 'sms')[];
      maxRetries?: number;
      retryDelayMs?: number;
      requireConfirmation?: boolean;
    } = {}
  ): Promise<{
    success: boolean;
    deliveryResults: Array<{
      channel: string;
      success: boolean;
      messageId?: string;
      error?: string;
      attemptNumber: number;
      deliveredAt?: string;
    }>;
    finalStatus: 'delivered' | 'partially_delivered' | 'failed';
  }> {
    const {
      priority = 'medium',
      fallbackChannels = ['websocket', 'push', 'email'],
      maxRetries = 3,
      retryDelayMs = 1000,
      requireConfirmation = false
    } = options;

    const deliveryResults: Array<{
      channel: string;
      success: boolean;
      messageId?: string;
      error?: string;
      attemptNumber: number;
      deliveredAt?: string;
    }> = [];

    let finalStatus: 'delivered' | 'partially_delivered' | 'failed' = 'failed';

    try {
      // Create initial delivery status
      const template = this.getReservationNotificationTemplate(templateType, recipient);
      if (!template) {
        throw new Error(`Reservation notification template not found: ${templateType}`);
      }

      const customizedTemplate = this.customizeReservationTemplate(template, reservationData);
      const deliveryStatus = await this.createDeliveryStatus(userId, customizedTemplate);

      // Try each fallback channel in order
      for (const channel of fallbackChannels) {
        let channelSuccess = false;
        let lastError: string | undefined;

        // Retry mechanism for each channel
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
          try {
            const result = await this.deliverViaChannel(
              channel,
              userId,
              customizedTemplate,
              reservationData,
              priority
            );

            if (result.success) {
              deliveryResults.push({
                channel,
                success: true,
                messageId: result.messageId,
                attemptNumber: attempt,
                deliveredAt: new Date().toISOString()
              });

              channelSuccess = true;
              break; // Success, no need to retry this channel
            } else {
              lastError = result.error;
            }
          } catch (error) {
            lastError = error instanceof Error ? error.message : 'Unknown error';
          }

          // Wait before retry (exponential backoff)
          if (attempt < maxRetries) {
            const delay = retryDelayMs * Math.pow(2, attempt - 1);
            await this.sleep(delay);
          }
        }

        // If channel failed after all retries
        if (!channelSuccess) {
          deliveryResults.push({
            channel,
            success: false,
            error: lastError,
            attemptNumber: maxRetries
          });
        }

        // If we have successful delivery and don't require confirmation, we can stop
        if (channelSuccess && !requireConfirmation) {
          finalStatus = 'delivered';
          break;
        }
      }

      // Determine final status
      const successfulDeliveries = deliveryResults.filter(r => r.success).length;
      if (successfulDeliveries === fallbackChannels.length) {
        finalStatus = 'delivered';
      } else if (successfulDeliveries > 0) {
        finalStatus = 'partially_delivered';
      }

      // Update delivery status
      await this.updateDeliveryStatusWithFallback(
        deliveryStatus.notificationId,
        deliveryResults,
        finalStatus
      );

      // Track delivery for analytics
      await this.trackReservationNotificationDelivery(
        deliveryStatus.notificationId,
        userId,
        templateType,
        deliveryResults.map(r => ({
          success: r.success,
          messageId: r.messageId,
          error: r.error
        }))
      );

      logger.info('Fallback notification delivery completed', {
        userId,
        templateType,
        recipient,
        finalStatus,
        successfulChannels: deliveryResults.filter(r => r.success).length,
        totalChannels: fallbackChannels.length
      });

      return {
        success: finalStatus !== 'failed',
        deliveryResults,
        finalStatus
      };

    } catch (error) {
      logger.error('Fallback notification delivery failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        templateType,
        recipient
      });

      return {
        success: false,
        deliveryResults,
        finalStatus: 'failed'
      };
    }
  }

  /**
   * Deliver notification via specific channel
   */
  private async deliverViaChannel(
    channel: 'websocket' | 'push' | 'email' | 'sms',
    userId: string,
    template: NotificationTemplate,
    reservationData?: Record<string, any>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      switch (channel) {
        case 'websocket':
          return await this.deliverViaWebSocket(userId, template, reservationData);
        
        case 'push':
          return await this.deliverViaPushNotification(userId, template, reservationData, priority);
        
        case 'email':
          return await this.deliverViaEmail(userId, template, reservationData);
        
        case 'sms':
          return await this.deliverViaSMS(userId, template, reservationData);
        
        default:
          throw new Error(`Unsupported delivery channel: ${channel}`);
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Deliver via WebSocket
   */
  private async deliverViaWebSocket(
    userId: string,
    template: NotificationTemplate,
    reservationData?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const { websocketService } = await import('./websocket.service');
      
      const wsMessage = {
        type: 'reservation_notification',
        title: template.title,
        body: template.body,
        data: {
          ...template.data,
          ...reservationData,
          timestamp: new Date().toISOString()
        }
      };

      await websocketService.sendToUser(userId, 'reservation_notification', wsMessage);

      return {
        success: true,
        messageId: `ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'WebSocket delivery failed'
      };
    }
  }

  /**
   * Deliver via Push Notification (FCM)
   */
  private async deliverViaPushNotification(
    userId: string,
    template: NotificationTemplate,
    reservationData?: Record<string, any>,
    priority: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.sendNotificationToUser(userId, template);
      
      return {
        success: result.status !== 'failed',
        messageId: result.id,
        error: result.errorMessage
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Push notification delivery failed'
      };
    }
  }

  /**
   * Deliver via Email (placeholder implementation)
   */
  private async deliverViaEmail(
    userId: string,
    template: NotificationTemplate,
    reservationData?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // TODO: Implement email delivery service
      // For now, return success as placeholder
      logger.info('Email delivery placeholder', { userId, templateId: template.id });
      
      return {
        success: true,
        messageId: `email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Email delivery failed'
      };
    }
  }

  /**
   * Deliver via SMS (placeholder implementation)
   */
  private async deliverViaSMS(
    userId: string,
    template: NotificationTemplate,
    reservationData?: Record<string, any>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // TODO: Implement SMS delivery service
      // For now, return success as placeholder
      logger.info('SMS delivery placeholder', { userId, templateId: template.id });
      
      return {
        success: true,
        messageId: `sms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SMS delivery failed'
      };
    }
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Update delivery status with fallback results
   */
  private async updateDeliveryStatusWithFallback(
    notificationId: string,
    deliveryResults: Array<{
      channel: string;
      success: boolean;
      messageId?: string;
      error?: string;
      attemptNumber: number;
      deliveredAt?: string;
    }>,
    finalStatus: 'delivered' | 'partially_delivered' | 'failed'
  ): Promise<void> {
    try {
      const successfulChannels = deliveryResults.filter(r => r.success);
      const failedChannels = deliveryResults.filter(r => !r.success);

      // Update delivery status in database
      await this.supabase
        .from('notification_delivery_status')
        .update({
          status: finalStatus === 'delivered' ? 'delivered' : 
                  finalStatus === 'partially_delivered' ? 'sent' : 'failed',
          delivery_attempts: deliveryResults.length,
          successful_deliveries: successfulChannels.length,
          failed_deliveries: failedChannels.length,
          delivery_details: JSON.stringify(deliveryResults),
          last_attempt_at: new Date().toISOString(),
          delivered_at: successfulChannels.length > 0 ? new Date().toISOString() : null,
          error_message: failedChannels.length > 0 ? 
            `Failed channels: ${failedChannels.map(c => c.channel).join(', ')}` : null
        })
        .eq('notification_id', notificationId);

      logger.info('Delivery status updated with fallback results', {
        notificationId,
        finalStatus,
        successfulChannels: successfulChannels.length,
        failedChannels: failedChannels.length
      });

    } catch (error) {
      logger.error('Failed to update delivery status with fallback results', {
        error,
        notificationId
      });
    }
  }

  /**
   * Monitoring system for delivery success rates and analytics
   */
  async getNotificationDeliveryAnalytics(
    options: {
      startDate?: string;
      endDate?: string;
      templateType?: string;
      userId?: string;
      channel?: 'websocket' | 'push' | 'email' | 'sms';
    } = {}
  ): Promise<{
    totalNotifications: number;
    deliveryStats: {
      delivered: number;
      partiallyDelivered: number;
      failed: number;
      pending: number;
    };
    channelStats: Array<{
      channel: string;
      totalAttempts: number;
      successRate: number;
      averageRetries: number;
      commonErrors: Array<{ error: string; count: number }>;
    }>;
    templateStats: Array<{
      templateType: string;
      totalSent: number;
      successRate: number;
      averageDeliveryTime: number;
    }>;
    timeSeriesData: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  }> {
    try {
      const { startDate, endDate, templateType, userId, channel } = options;

      // Build query filters
      let query = this.supabase
        .from('reservation_notification_delivery_log')
        .select('*');

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      if (templateType) {
        query = query.eq('template_type', templateType);
      }
      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: deliveryLogs, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch delivery analytics: ${error.message}`);
      }

      // Calculate overall stats
      const totalNotifications = deliveryLogs?.length || 0;
      const deliveryStats = {
        delivered: deliveryLogs?.filter(log => log.successful_deliveries > 0 && log.failed_deliveries === 0).length || 0,
        partiallyDelivered: deliveryLogs?.filter(log => log.successful_deliveries > 0 && log.failed_deliveries > 0).length || 0,
        failed: deliveryLogs?.filter(log => log.successful_deliveries === 0).length || 0,
        pending: 0 // TODO: Implement pending status tracking
      };

      // Calculate channel stats
      const channelStats = await this.calculateChannelStats(deliveryLogs);

      // Calculate template stats
      const templateStats = await this.calculateTemplateStats(deliveryLogs);

      // Calculate time series data
      const timeSeriesData = await this.calculateTimeSeriesData(deliveryLogs);

      logger.info('Notification delivery analytics calculated', {
        totalNotifications,
        deliveryStats,
        channelCount: channelStats.length,
        templateCount: templateStats.length
      });

      return {
        totalNotifications,
        deliveryStats,
        channelStats,
        templateStats,
        timeSeriesData
      };

    } catch (error) {
      logger.error('Failed to get notification delivery analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        options
      });

      return {
        totalNotifications: 0,
        deliveryStats: { delivered: 0, partiallyDelivered: 0, failed: 0, pending: 0 },
        channelStats: [],
        templateStats: [],
        timeSeriesData: []
      };
    }
  }

  /**
   * Calculate channel-specific statistics
   */
  private async calculateChannelStats(deliveryLogs: any[]): Promise<Array<{
    channel: string;
    totalAttempts: number;
    successRate: number;
    averageRetries: number;
    commonErrors: Array<{ error: string; count: number }>;
  }>> {
    const channelMap = new Map<string, {
      totalAttempts: number;
      successfulAttempts: number;
      totalRetries: number;
      errorCounts: Map<string, number>;
    }>();

    // Process delivery logs
    for (const log of deliveryLogs || []) {
      if (log.delivery_results) {
        try {
          const results = JSON.parse(log.delivery_results);
          for (const result of results) {
            const channel = result.channel || 'unknown';
            if (!channelMap.has(channel)) {
              channelMap.set(channel, {
                totalAttempts: 0,
                successfulAttempts: 0,
                totalRetries: 0,
                errorCounts: new Map()
              });
            }

            const channelData = channelMap.get(channel)!;
            channelData.totalAttempts++;
            channelData.totalRetries += result.attemptNumber || 1;

            if (result.success) {
              channelData.successfulAttempts++;
            } else if (result.error) {
              const errorCount = channelData.errorCounts.get(result.error) || 0;
              channelData.errorCounts.set(result.error, errorCount + 1);
            }
          }
        } catch (error) {
          logger.warn('Failed to parse delivery results', { logId: log.id, error });
        }
      }
    }

    // Convert to response format
    return Array.from(channelMap.entries()).map(([channel, data]) => ({
      channel,
      totalAttempts: data.totalAttempts,
      successRate: data.totalAttempts > 0 ? (data.successfulAttempts / data.totalAttempts) * 100 : 0,
      averageRetries: data.totalAttempts > 0 ? data.totalRetries / data.totalAttempts : 0,
      commonErrors: Array.from(data.errorCounts.entries())
        .map(([error, count]) => ({ error, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5) // Top 5 errors
    }));
  }

  /**
   * Calculate template-specific statistics
   */
  private async calculateTemplateStats(deliveryLogs: any[]): Promise<Array<{
    templateType: string;
    totalSent: number;
    successRate: number;
    averageDeliveryTime: number;
  }>> {
    const templateMap = new Map<string, {
      totalSent: number;
      successfulSent: number;
      totalDeliveryTime: number;
    }>();

    // Process delivery logs
    for (const log of deliveryLogs || []) {
      const templateType = log.template_type || 'unknown';
      if (!templateMap.has(templateType)) {
        templateMap.set(templateType, {
          totalSent: 0,
          successfulSent: 0,
          totalDeliveryTime: 0
        });
      }

      const templateData = templateMap.get(templateType)!;
      templateData.totalSent++;
      
      if (log.successful_deliveries > 0) {
        templateData.successfulSent++;
      }

      // Calculate delivery time (placeholder - would need actual timestamps)
      templateData.totalDeliveryTime += 1000; // 1 second placeholder
    }

    // Convert to response format
    return Array.from(templateMap.entries()).map(([templateType, data]) => ({
      templateType,
      totalSent: data.totalSent,
      successRate: data.totalSent > 0 ? (data.successfulSent / data.totalSent) * 100 : 0,
      averageDeliveryTime: data.totalSent > 0 ? data.totalDeliveryTime / data.totalSent : 0
    }));
  }

  /**
   * Calculate time series data for analytics
   */
  private async calculateTimeSeriesData(deliveryLogs: any[]): Promise<Array<{
    date: string;
    sent: number;
    delivered: number;
    failed: number;
  }>> {
    const dateMap = new Map<string, { sent: number; delivered: number; failed: number }>();

    // Process delivery logs
    for (const log of deliveryLogs || []) {
      const date = new Date(log.created_at).toISOString().split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { sent: 0, delivered: 0, failed: 0 });
      }

      const dateData = dateMap.get(date)!;
      dateData.sent++;
      
      if (log.successful_deliveries > 0) {
        dateData.delivered++;
      } else {
        dateData.failed++;
      }
    }

    // Convert to response format and sort by date
    return Array.from(dateMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Get shop reservation notifications with filtering
   */
  async getShopReservationNotifications(
    shopId: string,
    options: {
      status?: string;
      templateType?: string;
      limit?: number;
      offset?: number;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<Array<{
    id: string;
    templateType: string;
    title: string;
    body: string;
    data: any;
    status: string;
    recipientUserId: string;
    recipientType: 'user' | 'shop';
    deliveryAttempts: number;
    successfulDeliveries: number;
    failedDeliveries: number;
    createdAt: string;
    updatedAt: string;
  }>> {
    try {
      const { status, templateType, limit = 20, offset = 0, startDate, endDate } = options;

      let query = this.supabase
        .from('reservation_notification_delivery_log')
        .select(`
          id,
          template_type,
          user_id,
          delivery_results,
          successful_deliveries,
          failed_deliveries,
          created_at,
          updated_at
        `)
        .eq('shop_id', shopId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      if (templateType) {
        query = query.eq('template_type', templateType);
      }

      const { data: logs, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch shop reservation notifications: ${error.message}`);
      }

      // Transform the data to include template information
      const notifications = [];
      for (const log of logs || []) {
        const template = this.getReservationNotificationTemplate(log.template_type, 'shop');
        if (template) {
          notifications.push({
            id: log.id,
            templateType: log.template_type,
            title: template.title,
            body: template.body,
            data: template.data,
            status: status || 'unread', // TODO: Implement proper status tracking
            recipientUserId: log.user_id,
            recipientType: 'shop' as const,
            deliveryAttempts: (log.successful_deliveries || 0) + (log.failed_deliveries || 0),
            successfulDeliveries: log.successful_deliveries || 0,
            failedDeliveries: log.failed_deliveries || 0,
            createdAt: log.created_at,
            updatedAt: log.updated_at
          });
        }
      }

      logger.info('Shop reservation notifications retrieved', {
        shopId,
        count: notifications.length,
        options
      });

      return notifications;

    } catch (error) {
      logger.error('Failed to get shop reservation notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        options
      });
      return [];
    }
  }

  /**
   * Get shop owner notification preferences
   */
  async getShopOwnerNotificationPreferences(shopId: string, userId: string): Promise<{
    reservationNotifications: {
      newRequest: boolean;
      confirmed: boolean;
      cancelled: boolean;
      completed: boolean;
      noShow: boolean;
      reminder: boolean;
    };
    deliveryPreferences: {
      websocket: boolean;
      push: boolean;
      email: boolean;
      sms: boolean;
    };
    timingPreferences: {
      reminderHoursBefore: number;
      quietHoursStart: string;
      quietHoursEnd: string;
    };
    prioritySettings: {
      newRequest: 'low' | 'medium' | 'high' | 'critical';
      confirmed: 'low' | 'medium' | 'high' | 'critical';
      cancelled: 'low' | 'medium' | 'high' | 'critical';
      completed: 'low' | 'medium' | 'high' | 'critical';
      noShow: 'low' | 'medium' | 'high' | 'critical';
      reminder: 'low' | 'medium' | 'high' | 'critical';
    };
  }> {
    try {
      const { data: preferences, error } = await this.supabase
        .from('shop_owner_notification_preferences')
        .select('*')
        .eq('shop_id', shopId)
        .eq('user_id', userId)
        .single();

      if (error && error.code !== 'PGRST116') { // Not found error
        throw new Error(`Failed to fetch shop owner notification preferences: ${error.message}`);
      }

      // Return default preferences if none exist
      if (!preferences) {
        return {
          reservationNotifications: {
            newRequest: true,
            confirmed: true,
            cancelled: true,
            completed: true,
            noShow: true,
            reminder: true
          },
          deliveryPreferences: {
            websocket: true,
            push: true,
            email: false,
            sms: false
          },
          timingPreferences: {
            reminderHoursBefore: 24,
            quietHoursStart: '22:00',
            quietHoursEnd: '08:00'
          },
          prioritySettings: {
            newRequest: 'high',
            confirmed: 'medium',
            cancelled: 'high',
            completed: 'medium',
            noShow: 'high',
            reminder: 'medium'
          }
        };
      }

      return preferences.preferences || {
        reservationNotifications: {
          newRequest: true,
          confirmed: true,
          cancelled: true,
          completed: true,
          noShow: true,
          reminder: true
        },
        deliveryPreferences: {
          websocket: true,
          push: true,
          email: false,
          sms: false
        },
        timingPreferences: {
          reminderHoursBefore: 24,
          quietHoursStart: '22:00',
          quietHoursEnd: '08:00'
        },
        prioritySettings: {
          newRequest: 'high',
          confirmed: 'medium',
          cancelled: 'high',
          completed: 'medium',
          noShow: 'high',
          reminder: 'medium'
        }
      };

    } catch (error) {
      logger.error('Failed to get shop owner notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        userId
      });
      throw error;
    }
  }

  /**
   * Update shop owner notification preferences
   */
  async updateShopOwnerNotificationPreferences(
    shopId: string,
    userId: string,
    preferences: any
  ): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('shop_owner_notification_preferences')
        .upsert({
          shop_id: shopId,
          user_id: userId,
          preferences,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to update shop owner notification preferences: ${error.message}`);
      }

      logger.info('Shop owner notification preferences updated', {
        shopId,
        userId,
        preferences
      });

      return data.preferences;

    } catch (error) {
      logger.error('Failed to update shop owner notification preferences', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        userId
      });
      throw error;
    }
  }

  /**
   * Get shop notification delivery analytics
   */
  async getShopNotificationAnalytics(
    shopId: string,
    options: {
      startDate?: string;
      endDate?: string;
      templateType?: string;
    } = {}
  ): Promise<{
    totalNotifications: number;
    deliveryStats: {
      delivered: number;
      partiallyDelivered: number;
      failed: number;
      pending: number;
    };
    templateStats: Array<{
      templateType: string;
      totalSent: number;
      successRate: number;
      averageDeliveryTime: number;
    }>;
    timeSeriesData: Array<{
      date: string;
      sent: number;
      delivered: number;
      failed: number;
    }>;
  }> {
    try {
      const { startDate, endDate, templateType } = options;

      // Build query filters for shop-specific notifications
      let query = this.supabase
        .from('reservation_notification_delivery_log')
        .select('*')
        .eq('shop_id', shopId);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }
      if (endDate) {
        query = query.lte('created_at', endDate);
      }
      if (templateType) {
        query = query.eq('template_type', templateType);
      }

      const { data: deliveryLogs, error } = await query;
      if (error) {
        throw new Error(`Failed to fetch shop notification analytics: ${error.message}`);
      }

      // Calculate shop-specific stats
      const totalNotifications = deliveryLogs?.length || 0;
      const deliveryStats = {
        delivered: deliveryLogs?.filter(log => log.successful_deliveries > 0 && log.failed_deliveries === 0).length || 0,
        partiallyDelivered: deliveryLogs?.filter(log => log.successful_deliveries > 0 && log.failed_deliveries > 0).length || 0,
        failed: deliveryLogs?.filter(log => log.successful_deliveries === 0).length || 0,
        pending: 0 // TODO: Implement pending status tracking
      };

      // Calculate template stats for shop
      const templateStats = await this.calculateTemplateStats(deliveryLogs);

      // Calculate time series data for shop
      const timeSeriesData = await this.calculateTimeSeriesData(deliveryLogs);

      logger.info('Shop notification analytics calculated', {
        shopId,
        totalNotifications,
        deliveryStats,
        templateCount: templateStats.length
      });

      return {
        totalNotifications,
        deliveryStats,
        templateStats,
        timeSeriesData
      };

    } catch (error) {
      logger.error('Failed to get shop notification analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        options
      });

      return {
        totalNotifications: 0,
        deliveryStats: { delivered: 0, partiallyDelivered: 0, failed: 0, pending: 0 },
        templateStats: [],
        timeSeriesData: []
      };
    }
  }

  /**
   * Enhanced delivery tracking for reservation notifications
   */
  async trackReservationNotificationDelivery(
    notificationId: string,
    userId: string,
    templateType: string,
    deliveryResults: Array<{ success: boolean; messageId?: string; error?: string }>
  ): Promise<void> {
    try {
      const successCount = deliveryResults.filter(result => result.success).length;
      const failureCount = deliveryResults.length - successCount;

      // Update notification history with delivery tracking
      await this.supabase
        .from('notification_history')
        .update({
          delivery_attempts: deliveryResults.length,
          successful_deliveries: successCount,
          failed_deliveries: failureCount,
          delivery_details: JSON.stringify(deliveryResults),
          updated_at: new Date().toISOString()
        })
        .eq('id', notificationId);

      // Log delivery tracking for analytics
      await this.supabase
        .from('reservation_notification_delivery_log')
        .insert({
          notification_id: notificationId,
          user_id: userId,
          template_type: templateType,
          total_devices: deliveryResults.length,
          successful_deliveries: successCount,
          failed_deliveries: failureCount,
          delivery_results: deliveryResults,
          created_at: new Date().toISOString()
        });

      logger.info('Reservation notification delivery tracked', {
        notificationId,
        userId,
        templateType,
        successCount,
        failureCount
      });

    } catch (error) {
      logger.error('Failed to track reservation notification delivery', {
        error,
        notificationId,
        userId
      });
    }
  }

  /**
   * Customize reservation template with dynamic data
   */
  private customizeReservationTemplate(
    template: NotificationTemplate,
    reservationData?: Record<string, any>
  ): NotificationTemplate {
    if (!reservationData) {
      return template;
    }

    let customizedTitle = template.title;
    let customizedBody = template.body;

    // Replace placeholders in title and body
    if (reservationData.shopName) {
      customizedTitle = customizedTitle.replace('{shopName}', reservationData.shopName);
      customizedBody = customizedBody.replace('{shopName}', reservationData.shopName);
    }

    if (reservationData.serviceName) {
      customizedTitle = customizedTitle.replace('{serviceName}', reservationData.serviceName);
      customizedBody = customizedBody.replace('{serviceName}', reservationData.serviceName);
    }

    if (reservationData.reservationTime) {
      customizedTitle = customizedTitle.replace('{reservationTime}', reservationData.reservationTime);
      customizedBody = customizedBody.replace('{reservationTime}', reservationData.reservationTime);
    }

    if (reservationData.refundAmount) {
      customizedTitle = customizedTitle.replace('{refundAmount}', reservationData.refundAmount);
      customizedBody = customizedBody.replace('{refundAmount}', reservationData.refundAmount);
    }

    return {
      ...template,
      title: customizedTitle,
      body: customizedBody,
      data: {
        ...template.data,
        ...reservationData
      }
    };
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    // Get reservation templates
    const reservationTemplates = this.getAllReservationNotificationTemplates();
    
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
    return [...legacyTemplates, ...reservationTemplates, ...this.getAllTemplates()];
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
      // Get settings from user_settings table
      const { data: userSettings, error } = await this.supabase
        .from('user_settings')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No settings found, return defaults
          return {
            userId,
            pushEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
            reservationUpdates: true,
            paymentNotifications: true,
            promotionalMessages: false,
            systemAlerts: true,
            userManagementAlerts: true,
            securityAlerts: true,
            profileUpdateConfirmations: true,
            adminActionNotifications: true,
            updatedAt: new Date().toISOString()
          };
        }
        throw error;
      }

      // Map user_settings fields to NotificationSettings interface
      const settings: NotificationSettings = {
        userId,
        pushEnabled: userSettings.push_notifications_enabled ?? true,
        emailEnabled: true, // Not stored in user_settings yet
        smsEnabled: false, // Not stored in user_settings yet
        reservationUpdates: userSettings.reservation_notifications ?? true,
        paymentNotifications: true, // Not stored in user_settings yet
        promotionalMessages: userSettings.marketing_notifications ?? false,
        systemAlerts: userSettings.event_notifications ?? true,
        userManagementAlerts: true, // Not stored in user_settings yet
        securityAlerts: true, // Not stored in user_settings yet
        profileUpdateConfirmations: true, // Not stored in user_settings yet
        adminActionNotifications: true, // Not stored in user_settings yet
        updatedAt: userSettings.updated_at || new Date().toISOString()
      };

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
      // Map NotificationSettings to user_settings table fields
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (settings.pushEnabled !== undefined) {
        updateData.push_notifications_enabled = settings.pushEnabled;
      }
      if (settings.reservationUpdates !== undefined) {
        updateData.reservation_notifications = settings.reservationUpdates;
      }
      if (settings.promotionalMessages !== undefined) {
        updateData.marketing_notifications = settings.promotionalMessages;
      }
      if (settings.systemAlerts !== undefined) {
        updateData.event_notifications = settings.systemAlerts;
      }

      // Upsert user settings (insert if doesn't exist, update if exists)
      const { data: updatedData, error } = await this.supabase
        .from('user_settings')
        .upsert({
          user_id: userId,
          ...updateData
        }, {
          onConflict: 'user_id'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to update user notification settings in database', { error, userId });
        throw error;
      }

      // Return the updated settings
      return this.getUserNotificationSettings(userId) as Promise<NotificationSettings>;
    } catch (error) {
      logger.error('Failed to update user notification settings', { error, userId });
      throw error;
    }
  }

  /**
   * Get notification history for a user with pagination
   */
  async getUserNotificationHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    status?: string
  ): Promise<{
    notifications: NotificationHistory[];
    totalCount: number;
    currentPage: number;
    totalPages: number;
  }> {
    try {
      const offset = (page - 1) * limit;

      let query = this.supabase
        .from('notification_history')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Filter by status if provided
      if (status) {
        query = query.eq('status', status);
      }

      const { data: history, error, count } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        notifications: history || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      logger.error('Failed to get user notification history', { error, userId });
      throw error;
    }
  }

  /**
   * Mark notification as read
   */
  async markNotificationAsRead(notificationId: string, userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId);

      if (error) throw error;

      logger.info('Notification marked as read', {
        notificationId,
        userId
      });
    } catch (error) {
      logger.error('Failed to mark notification as read', {
        error,
        notificationId,
        userId
      });
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
        .from('push_tokens')
        .update({ is_active: false })
        .lt('last_used_at', thirtyDaysAgo.toISOString())
        .eq('is_active', true);

      if (error) throw error;

      const removedCount = result ? ((result as any)?.length ?? 0) : 0;
      logger.info('Cleaned up invalid device tokens', { removed: removedCount });
      return { removed: removedCount };
    } catch (error) {
      logger.error('Failed to cleanup invalid tokens', { error });
      throw error;
    }
  }

  /**
   * Simple notification sender that returns success/error format
   * This is a wrapper around the existing notification system
   */
  private async sendSimpleNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: Record<string, string>;
    }
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Store in notification history
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.data?.action || 'general',
          title: notification.title,
          message: notification.body,
          metadata: notification.data || {}
        });

      if (error) {
        logger.error('Failed to store notification', { error, userId });
        return { success: false, error: 'Failed to store notification' };
      }

      // Here you would typically send push notification via FCM
      // For now, we'll just log and return success
      logger.info('Notification sent', {
        userId,
        title: notification.title,
        type: notification.data?.action || 'general'
      });

      return { success: true };

    } catch (error) {
      logger.error('Failed to send notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send content moderation notification to user
   */
  async sendModerationNotification(
    userId: string,
    action: 'flagged' | 'hidden' | 'removed' | 'approved' | 'warned',
    contentType: 'post' | 'comment',
    contentId: string,
    reason?: string,
    adminNote?: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const templates = {
        flagged: {
          title: `Your ${contentType} has been flagged`,
          body: `Your ${contentType} has been flagged for review. ${reason ? `Reason: ${reason}` : 'Our team will review it shortly.'}`,
          data: { action: 'flagged', contentType, contentId, severity: 'medium' }
        },
        hidden: {
          title: `Your ${contentType} has been hidden`,
          body: `Your ${contentType} has been temporarily hidden. ${reason ? `Reason: ${reason}` : 'Please review our community guidelines.'}`,
          data: { action: 'hidden', contentType, contentId, severity: 'high' }
        },
        removed: {
          title: `Your ${contentType} has been removed`,
          body: `Your ${contentType} has been removed for violating our guidelines. ${reason ? `Reason: ${reason}` : 'Please review our community standards.'}`,
          data: { action: 'removed', contentType, contentId, severity: 'critical' }
        },
        approved: {
          title: `Your ${contentType} has been approved`,
          body: `Your ${contentType} has been reviewed and approved. Thank you for following our community guidelines.`,
          data: { action: 'approved', contentType, contentId, severity: 'low' }
        },
        warned: {
          title: 'Community Guidelines Warning',
          body: `Your ${contentType} violates our community guidelines. ${reason ? `Reason: ${reason}` : 'Please review our policies to avoid future violations.'}`,
          data: { action: 'warned', contentType, contentId, severity: 'medium' }
        }
      };

      const template = templates[action];
      if (adminNote) {
        template.body += ` Admin note: ${adminNote}`;
      }

      // Send push notification
      const pushResult = await this.sendSimpleNotification(userId, template);

      // Store in notification history
      await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'content_moderation',
          title: template.title,
          message: template.body,
          metadata: {
            ...template.data,
            reason,
            adminNote,
            timestamp: new Date().toISOString()
          }
        });

      logger.info('Moderation notification sent', {
        userId,
        action,
        contentType,
        contentId,
        success: pushResult.success
      });

      return pushResult;

    } catch (error) {
      logger.error('Failed to send moderation notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        action,
        contentType,
        contentId
      });
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send bulk moderation notifications for mass actions
   */
  async sendBulkModerationNotifications(
    notifications: Array<{
      userId: string;
      action: 'flagged' | 'hidden' | 'removed' | 'approved' | 'warned';
      contentType: 'post' | 'comment';
      contentId: string;
      reason?: string;
      adminNote?: string;
    }>
  ): Promise<{ success: boolean; results: Array<{ userId: string; success: boolean; error?: string }> }> {
    try {
      const results = await Promise.allSettled(
        notifications.map(notification =>
          this.sendModerationNotification(
            notification.userId,
            notification.action,
            notification.contentType,
            notification.contentId,
            notification.reason,
            notification.adminNote
          ).then(result => ({ userId: notification.userId, ...result }))
        )
      );

      const processedResults = results.map((result, index) => {
        if (result.status === 'fulfilled') {
          return result.value;
        } else {
          return {
            userId: notifications[index].userId,
            success: false,
            error: result.reason instanceof Error ? result.reason.message : 'Unknown error'
          };
        }
      });

      const successCount = processedResults.filter(r => r.success).length;
      const totalCount = processedResults.length;

      logger.info('Bulk moderation notifications processed', {
        total: totalCount,
        successful: successCount,
        failed: totalCount - successCount
      });

      return {
        success: successCount > 0,
        results: processedResults
      };

    } catch (error) {
      logger.error('Failed to send bulk moderation notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        count: notifications.length
      });
      return {
        success: false,
        results: notifications.map(n => ({
          userId: n.userId,
          success: false,
          error: 'Bulk operation failed'
        }))
      };
    }
  }

  /**
   * Send report acknowledgment notification to reporter
   */
  async sendReportAcknowledgment(
    reporterId: string,
    contentType: 'post' | 'comment',
    contentId: string,
    reportReason: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const notification = {
        title: 'Report Received',
        body: `Thank you for reporting ${contentType === 'post' ? 'a post' : 'a comment'}. We've received your report and will review it according to our community guidelines.`,
        data: {
          action: 'report_acknowledged',
          contentType,
          contentId,
          reportReason,
          severity: 'low'
        }
      };

      const result = await this.sendSimpleNotification(reporterId, notification);

      // Store in notification history
      await this.supabase
        .from('notifications')
        .insert({
          user_id: reporterId,
          type: 'report_acknowledgment',
          title: notification.title,
          message: notification.body,
          metadata: {
            ...notification.data,
            timestamp: new Date().toISOString()
          }
        });

      logger.info('Report acknowledgment sent', {
        reporterId,
        contentType,
        contentId,
        success: result.success
      });

      return result;

    } catch (error) {
      logger.error('Failed to send report acknowledgment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reporterId,
        contentType,
        contentId
      });
      return { success: false, error: 'Failed to send notification' };
    }
  }

  /**
   * Send admin alert for high-priority content that needs immediate attention
   */
  async sendAdminModerationAlert(
    contentType: 'post' | 'comment',
    contentId: string,
    priority: 'high' | 'critical',
    reason: string,
    reportCount: number,
    authorId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get admin users (you may need to adjust this query based on your admin role system)
      const { data: admins, error: adminError } = await this.supabase
        .from('users')
        .select('id')
        .eq('role', 'admin')
        .eq('is_active', true);

      if (adminError || !admins || admins.length === 0) {
        logger.warn('No admin users found for moderation alert');
        return { success: false, error: 'No admin users available' };
      }

      const notification = {
        title: `${priority.toUpperCase()}: Content Moderation Alert`,
        body: `A ${contentType} requires immediate attention. ${reportCount} reports received. Reason: ${reason}`,
        data: {
          action: 'admin_alert',
          contentType,
          contentId,
          priority,
          reportCount: reportCount.toString(),
          authorId,
          severity: priority === 'critical' ? 'critical' : 'high'
        }
      };

      // Send to all admins
      const results = await Promise.allSettled(
        admins.map(admin =>
          this.sendSimpleNotification(admin.id, notification)
        )
      );

      const successCount = results.filter(r => r.status === 'fulfilled' && r.value.success).length;

      // Store admin alert in notifications
      await Promise.all(
        admins.map(admin =>
          this.supabase
            .from('notifications')
            .insert({
              user_id: admin.id,
              type: 'admin_moderation_alert',
              title: notification.title,
              message: notification.body,
              metadata: {
                ...notification.data,
                timestamp: new Date().toISOString()
              }
            })
        )
      );

      logger.info('Admin moderation alert sent', {
        contentType,
        contentId,
        priority,
        reportCount,
        adminCount: admins.length,
        successCount
      });

      return {
        success: successCount > 0,
        error: successCount === 0 ? 'Failed to notify any admins' : undefined
      };

    } catch (error) {
      logger.error('Failed to send admin moderation alert', {
        error: error instanceof Error ? error.message : 'Unknown error',
        contentType,
        contentId,
        priority
      });
      return { success: false, error: 'Failed to send admin alert' };
    }
  }
}

// Export singleton instance
export const notificationService = new NotificationService(); 