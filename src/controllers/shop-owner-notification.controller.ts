/**
 * Shop Owner Notification Controller
 * Handles shop owner viewing and managing notifications
 */

import { Request, Response } from 'express';
import { shopNotificationService } from '../services/shop-notification.service';
import { logger } from '../utils/logger';

export class ShopOwnerNotificationController {
  /**
   * GET /api/shop-owner/notifications
   * Get notifications for the shop owner's shop
   */
  async getNotifications(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      const { page, limit, unreadOnly } = req.query;

      const result = await shopNotificationService.getShopNotifications(shop.id, {
        page: page ? parseInt(page as string) : undefined,
        limit: limit ? parseInt(limit as string) : undefined,
        unreadOnly: unreadOnly === 'true',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to get shop notifications', {
        error: errorMessage,
        shopId: (req as any).shop?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get notifications',
      });
    }
  }

  /**
   * POST /api/shop-owner/notifications/:id/read
   * Mark a notification as read
   */
  async markAsRead(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;
      const { id } = req.params;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      await shopNotificationService.markAsRead(shop.id, id);

      res.json({
        success: true,
        message: 'Notification marked as read',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to mark notification as read', {
        error: errorMessage,
        receiptId: req.params.id,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }

  /**
   * POST /api/shop-owner/notifications/read-all
   * Mark all notifications as read
   */
  async markAllAsRead(req: Request, res: Response): Promise<void> {
    try {
      const shop = (req as any).shop;

      if (!shop) {
        res.status(404).json({
          success: false,
          error: 'Shop not found',
        });
        return;
      }

      await shopNotificationService.markAllAsRead(shop.id);

      res.json({
        success: true,
        message: 'All notifications marked as read',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      logger.error('Failed to mark all notifications as read', {
        error: errorMessage,
        shopId: (req as any).shop?.id,
      });

      res.status(400).json({
        success: false,
        error: errorMessage,
      });
    }
  }
}

export const shopOwnerNotificationController = new ShopOwnerNotificationController();
