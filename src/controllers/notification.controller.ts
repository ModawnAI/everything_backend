import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { ShopOwnerRequest } from '../middleware/shop-owner-auth.middleware';
import { notificationService, NotificationPayload } from '../services/notification.service';
import { logger } from '../utils/logger';

export default class NotificationController {
  /**
   * Register a device token for push notifications
   */
  async registerDeviceToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { token, deviceType } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!token || !deviceType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '디바이스 토큰과 타입이 필요합니다.'
          }
        });
        return;
      }

      if (!['android', 'ios', 'web'].includes(deviceType)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_DEVICE_TYPE',
            message: '유효하지 않은 디바이스 타입입니다.'
          }
        });
        return;
      }

      await notificationService.registerDeviceToken(userId, token, deviceType);

      res.status(200).json({
        success: true,
        message: '디바이스 토큰이 등록되었습니다.',
        data: {
          userId,
          deviceType,
          registeredAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to register device token', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '디바이스 토큰 등록 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Unregister a device token
   */
  async unregisterDeviceToken(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { token } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!token) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '디바이스 토큰이 필요합니다.'
          }
        });
        return;
      }

      await notificationService.unregisterDeviceToken(token);

      res.status(200).json({
        success: true,
        message: '디바이스 토큰이 해제되었습니다.',
        data: {
          userId,
          unregisteredAt: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to unregister device token', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '디바이스 토큰 해제 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send notification to current user (for testing)
   */
  async sendNotificationToSelf(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { title, body, data } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!title || !body) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '제목과 내용이 필요합니다.'
          }
        });
        return;
      }

      const payload: NotificationPayload = {
        title,
        body,
        data
      };

      const history = await notificationService.sendNotificationToUser(userId, payload);

      res.status(200).json({
        success: true,
        message: '알림이 전송되었습니다.',
        data: {
          notificationId: history.id,
          status: history.status,
          sentAt: history.sentAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send notification to self', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send template notification to current user
   */
  async sendTemplateNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { templateId, customData } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!templateId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '템플릿 ID가 필요합니다.'
          }
        });
        return;
      }

      const history = await notificationService.sendTemplateNotification(userId, templateId, customData);

      res.status(200).json({
        success: true,
        message: '템플릿 알림이 전송되었습니다.',
        data: {
          notificationId: history.id,
          templateId,
          status: history.status,
          sentAt: history.sentAt
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to send template notification', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '템플릿 알림 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get notification templates
   */
  async getNotificationTemplates(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const templates = await notificationService.getNotificationTemplates();

      res.status(200).json({
        success: true,
        message: '알림 템플릿을 조회했습니다.',
        data: {
          templates,
          totalCount: templates.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get notification templates', { error });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 템플릿 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get user notification settings
   */
  async getUserNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const settings = await notificationService.getUserNotificationSettings(userId);

      res.status(200).json({
        success: true,
        message: '알림 설정을 조회했습니다.',
        data: {
          settings: settings || {
            userId,
            pushEnabled: true,
            emailEnabled: true,
            smsEnabled: false,
            reservationUpdates: true,
            paymentNotifications: true,
            promotionalMessages: false,
            systemAlerts: true,
            updatedAt: new Date().toISOString()
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user notification settings', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 설정 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Update user notification settings
   */
  async updateUserNotificationSettings(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const settings = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const updatedSettings = await notificationService.updateUserNotificationSettings(userId, settings);

      res.status(200).json({
        success: true,
        message: '알림 설정이 업데이트되었습니다.',
        data: {
          settings: updatedSettings
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to update user notification settings', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 설정 업데이트 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get user notification history
   */
  async getUserNotificationHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const limit = parseInt(req.query.limit as string) || 50;
      const offset = parseInt(req.query.offset as string) || 0;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const history = await notificationService.getUserNotificationHistory(userId, limit, offset);

      res.status(200).json({
        success: true,
        message: '알림 히스토리를 조회했습니다.',
        data: {
          history,
          pagination: {
            limit,
            offset,
            total: history.length
          }
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user notification history', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 히스토리 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get user device tokens
   */
  async getUserDeviceTokens(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const tokens = await notificationService.getUserDeviceTokens(userId);

      res.status(200).json({
        success: true,
        message: '디바이스 토큰을 조회했습니다.',
        data: {
          tokens,
          totalCount: tokens.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get user device tokens', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '디바이스 토큰 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  // ===== USER NOTIFICATION INBOX ENDPOINTS =====

  /**
   * Get single notification by ID
   */
  async getNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      const { data: notification, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', notificationId)
        .eq('user_id', userId)
        .neq('status', 'deleted')
        .single();

      if (error || !notification) {
        res.status(404).json({
          success: false,
          error: {
            code: 'NOTIFICATION_NOT_FOUND',
            message: '알림을 찾을 수 없습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '알림을 조회했습니다.',
        data: notification,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get notification', { error, userId: req.user?.id, notificationId: req.params.notificationId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get unread notification count
   */
  async getUnreadCount(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'unread');

      if (error) {
        throw error;
      }

      res.status(200).json({
        success: true,
        message: '읽지 않은 알림 수를 조회했습니다.',
        data: { count: count || 0 },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to get unread count', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '읽지 않은 알림 수 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Mark single notification as read
   */
  async markAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '알림 읽음 처리에 실패했습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '알림을 읽음으로 표시했습니다.',
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to mark notification as read', { error, userId: req.user?.id, notificationId: req.params.notificationId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 읽음 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Mark all notifications as read
   */
  async markAllAsRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('notifications')
        .update({
          status: 'read',
          read_at: new Date().toISOString()
        })
        .eq('user_id', userId)
        .eq('status', 'unread')
        .select();

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UPDATE_FAILED',
            message: '모든 알림 읽음 처리에 실패했습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `${data.length}개의 알림을 읽음으로 표시했습니다.`,
        data: {
          updatedCount: data.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to mark all notifications as read', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '모든 알림 읽음 처리 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Delete single notification (soft delete)
   */
  async deleteNotification(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { notificationId } = req.params;
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      // Soft delete - update status to 'deleted'
      const { data, error } = await supabase
        .from('notifications')
        .update({ status: 'deleted' })
        .eq('id', notificationId)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: '알림 삭제에 실패했습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: '알림이 삭제되었습니다.',
        data,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to delete notification', { error, userId: req.user?.id, notificationId: req.params.notificationId });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '알림 삭제 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Delete all read notifications (soft delete)
   */
  async deleteAllRead(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '사용자 인증이 필요합니다.'
          }
        });
        return;
      }

      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();

      const { data, error } = await supabase
        .from('notifications')
        .update({ status: 'deleted' })
        .eq('user_id', userId)
        .eq('status', 'read')
        .select();

      if (error) {
        res.status(400).json({
          success: false,
          error: {
            code: 'DELETE_FAILED',
            message: '읽은 알림 삭제에 실패했습니다.'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: `${data.length}개의 읽은 알림이 삭제되었습니다.`,
        data: {
          deletedCount: data.length
        },
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to delete all read notifications', { error, userId: req.user?.id });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '읽은 알림 삭제 중 오류가 발생했습니다.'
        }
      });
    }
  }

  // ===== SHOP OWNER NOTIFICATION ENDPOINTS =====

  /**
   * Get shop reservation notifications for shop owner
   */
  async getShopReservationNotifications(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const shopId = req.shop?.id;
      const { 
        status = 'unread',
        templateType,
        limit = 20,
        offset = 0,
        startDate,
        endDate
      } = req.query;

      if (!userId || !shopId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '샵 운영자 인증이 필요합니다.'
          }
        });
        return;
      }

      const notifications = await notificationService.getShopReservationNotifications(
        shopId,
        {
          status: status as string,
          templateType: templateType as string,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
          startDate: startDate as string,
          endDate: endDate as string
        }
      );

      res.status(200).json({
        success: true,
        message: '샵 예약 알림을 조회했습니다.',
        data: {
          shopId,
          notifications,
          total: notifications.length,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get shop reservation notifications', { 
        error, 
        userId: req.user?.id,
        shopId: req.shop?.id 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '샵 예약 알림 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Send reservation notification to customer from shop owner
   */
  async sendReservationNotificationToCustomer(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const shopId = req.shop?.id;
      const { 
        reservationId, 
        notificationType, 
        customMessage,
        priority = 'medium',
        useFallback = true
      } = req.body;

      if (!userId || !shopId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '샵 운영자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!reservationId || !notificationType) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '예약 ID와 알림 유형이 필요합니다.'
          }
        });
        return;
      }

      // Validate that the reservation belongs to this shop
      const { getSupabaseClient } = await import('../config/database');
      const supabase = getSupabaseClient();
      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('id, user_id, shop_id, status')
        .eq('id', reservationId)
        .eq('shop_id', shopId)
        .single();

      if (error || !reservation) {
        res.status(404).json({
          success: false,
          error: {
            code: 'RESERVATION_NOT_FOUND',
            message: '예약을 찾을 수 없거나 권한이 없습니다.'
          }
        });
        return;
      }

      let result;
      if (useFallback) {
        // Use fallback delivery system
        result = await notificationService.sendReservationNotificationWithFallback(
          reservation.user_id,
          notificationType,
          'user',
          {
            reservationId,
            shopId,
            shopName: req.shop?.name,
            customMessage
          },
          {
            priority: priority as 'low' | 'medium' | 'high' | 'critical',
            fallbackChannels: ['websocket', 'push', 'email'],
            maxRetries: 3,
            requireConfirmation: false
          }
        );
      } else {
        // Use standard notification system
        const history = await notificationService.sendReservationNotification(
          reservation.user_id,
          notificationType,
          'user',
          {
            reservationId,
            shopId,
            shopName: req.shop?.name,
            customMessage
          }
        );
        result = {
          success: history.status !== 'failed',
          deliveryResults: [{
            channel: 'push',
            success: history.status !== 'failed',
            messageId: history.id,
            error: history.errorMessage,
            attemptNumber: 1,
            deliveredAt: history.status !== 'failed' ? new Date().toISOString() : undefined
          }],
          finalStatus: history.status !== 'failed' ? 'delivered' : 'failed'
        };
      }

      // Log the notification for shop owner audit trail
      await supabase
        .from('shop_owner_notification_log')
        .insert({
          shop_id: shopId,
          shop_owner_id: userId,
          reservation_id: reservationId,
          notification_type: notificationType,
          recipient_user_id: reservation.user_id,
          priority,
          success: result.success,
          delivery_method: useFallback ? 'fallback' : 'standard',
          delivery_details: JSON.stringify(result.deliveryResults),
          custom_message: customMessage,
          created_at: new Date().toISOString()
        });

      res.status(200).json({
        success: true,
        message: '예약 알림이 고객에게 전송되었습니다.',
        data: {
          reservationId,
          customerId: reservation.user_id,
          notificationType,
          priority,
          deliveryMethod: useFallback ? 'fallback' : 'standard',
          result,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to send reservation notification to customer', { 
        error, 
        userId: req.user?.id,
        shopId: req.shop?.id,
        reservationId: req.body?.reservationId 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '고객 알림 전송 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get shop owner notification preferences
   */
  async getShopOwnerNotificationPreferences(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const shopId = req.shop?.id;

      if (!userId || !shopId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '샵 운영자 인증이 필요합니다.'
          }
        });
        return;
      }

      const preferences = await notificationService.getShopOwnerNotificationPreferences(shopId, userId);

      res.status(200).json({
        success: true,
        message: '샵 운영자 알림 설정을 조회했습니다.',
        data: {
          shopId,
          preferences,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get shop owner notification preferences', { 
        error, 
        userId: req.user?.id,
        shopId: req.shop?.id 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '샵 운영자 알림 설정 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Update shop owner notification preferences
   */
  async updateShopOwnerNotificationPreferences(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const shopId = req.shop?.id;
      const { preferences } = req.body;

      if (!userId || !shopId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '샵 운영자 인증이 필요합니다.'
          }
        });
        return;
      }

      if (!preferences) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: '알림 설정이 필요합니다.'
          }
        });
        return;
      }

      const updatedPreferences = await notificationService.updateShopOwnerNotificationPreferences(
        shopId, 
        userId, 
        preferences
      );

      res.status(200).json({
        success: true,
        message: '샵 운영자 알림 설정이 업데이트되었습니다.',
        data: {
          shopId,
          preferences: updatedPreferences,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to update shop owner notification preferences', { 
        error, 
        userId: req.user?.id,
        shopId: req.shop?.id 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '샵 운영자 알림 설정 업데이트 중 오류가 발생했습니다.'
        }
      });
    }
  }

  /**
   * Get shop notification delivery analytics
   */
  async getShopNotificationAnalytics(req: ShopOwnerRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const shopId = req.shop?.id;
      const { 
        startDate,
        endDate,
        templateType
      } = req.query;

      if (!userId || !shopId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: '샵 운영자 인증이 필요합니다.'
          }
        });
        return;
      }

      const analytics = await notificationService.getShopNotificationAnalytics(
        shopId,
        {
          startDate: startDate as string,
          endDate: endDate as string,
          templateType: templateType as string
        }
      );

      res.status(200).json({
        success: true,
        message: '샵 알림 분석 데이터를 조회했습니다.',
        data: {
          shopId,
          analytics,
          timestamp: new Date().toISOString()
        }
      });
    } catch (error) {
      logger.error('Failed to get shop notification analytics', { 
        error, 
        userId: req.user?.id,
        shopId: req.shop?.id 
      });
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: '샵 알림 분석 데이터 조회 중 오류가 발생했습니다.'
        }
      });
    }
  }
} 