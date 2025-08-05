import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
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
} 