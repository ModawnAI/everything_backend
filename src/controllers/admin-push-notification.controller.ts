import { Request, Response } from 'express';
import { adminPushNotificationService } from '../services/admin-push-notification.service';
import { logger } from '../utils/logger';

export class AdminPushNotificationController {
  /**
   * POST /api/admin/push/send
   * Send push notification to users
   */
  async sendPushNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { title, body, targetUserType, targetUserIds, data, imageUrl, schedule } = req.body;

      // Validate required fields
      if (!title || !body) {
        res.status(400).json({
          success: false,
          error: 'Title and body are required'
        });
        return;
      }

      const result = await adminPushNotificationService.sendPushNotification(
        {
          title,
          body,
          targetUserType,
          targetUserIds,
          data,
          imageUrl,
          schedule
        },
        user.id
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Send push notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to send push notification'
      });
    }
  }

  /**
   * GET /api/admin/push/history
   * Get push notification history
   */
  async getPushHistory(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { page = '1', limit = '20', status } = req.query;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const result = await adminPushNotificationService.getPushHistory(
        parseInt(page as string, 10),
        parseInt(limit as string, 10),
        status as string | undefined,
        user.id
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get push history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get push history'
      });
    }
  }

  /**
   * GET /api/admin/push/:id
   * Get push notification details
   */
  async getPushNotificationById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Notification ID is required'
        });
        return;
      }

      const result = await adminPushNotificationService.getPushNotificationById(id, user.id);

      if (!result.notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get push notification failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        notificationId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get push notification'
      });
    }
  }
}

export const adminPushNotificationController = new AdminPushNotificationController();
