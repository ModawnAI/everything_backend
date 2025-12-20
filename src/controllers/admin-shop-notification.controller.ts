/**
 * Admin Shop Notification Controller
 * Handles super admin management of shop notifications
 */

import { Request, Response } from 'express';
import { shopNotificationService } from '../services/shop-notification.service';
import { logger } from '../utils/logger';

export class AdminShopNotificationController {
  /**
   * GET /api/admin/shop-notifications
   * Get all shop notifications with stats
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const { page, limit, type } = req.query;

      const result = await shopNotificationService.getNotifications({
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        type: type as string,
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get shop notifications', {
        error: errorMessage,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop notifications',
      });
    }
  }

  /**
   * GET /api/admin/shop-notifications/:id
   * Get a single notification by ID
   */
  async getNotificationById(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const notification = await shopNotificationService.getNotificationById(id);

      if (!notification) {
        res.status(404).json({
          success: false,
          error: 'Notification not found',
        });
        return;
      }

      res.json({
        success: true,
        data: notification,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get notification', {
        error: errorMessage,
        notificationId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get notification',
      });
    }
  }

  /**
   * POST /api/admin/shop-notifications
   * Create a new shop notification
   */
  async createNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const {
        title,
        content,
        notificationType,
        priority,
        targetCategories,
        sendPush,
        sendInApp,
        scheduledAt,
      } = req.body;

      if (!title || !content) {
        res.status(400).json({
          success: false,
          error: 'Title and content are required',
        });
        return;
      }

      const notification = await shopNotificationService.createNotification(user.id, {
        title,
        content,
        notificationType,
        priority,
        targetCategories,
        sendPush,
        sendInApp,
        scheduledAt,
      });

      res.status(201).json({
        success: true,
        data: notification,
        message: 'Notification created and sent successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to create shop notification', {
        error: errorMessage,
        userId: (req as any).user?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * POST /api/admin/shop-notifications/:id/send
   * Send a scheduled notification
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const result = await shopNotificationService.sendNotification(id);

      res.json({
        success: true,
        message: 'Notification sent successfully',
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to send notification', {
        error: errorMessage,
        notificationId: req.params.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * DELETE /api/admin/shop-notifications/:id
   * Delete a notification
   */
  async deleteNotification(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      await shopNotificationService.deleteNotification(id);

      res.json({
        success: true,
        message: 'Notification deleted successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to delete notification', {
        error: errorMessage,
        notificationId: req.params.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}

export const adminShopNotificationController = new AdminShopNotificationController();
