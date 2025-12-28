/**
 * Popup Controller
 * Handles popup-related endpoints for both users and admin
 */

import { Request, Response } from 'express';
import { popupService } from '../services/popup.service';
import { logger } from '../utils/logger';
import { PopupDismissType } from '../types/popup.types';

export class PopupController {
  /**
   * GET /api/popups/active
   * Get active popups for the current user/device
   */
  async getActivePopups(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { device_id, is_new_user } = req.query;

      const popups = await popupService.getActivePopups({
        userId: user?.id,
        deviceId: device_id as string | undefined,
        isNewUser: is_new_user === 'true',
      });

      res.json({
        success: true,
        data: {
          popups,
          total: popups.length,
        },
      });
    } catch (error) {
      logger.error('Failed to get active popups', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get active popups',
      });
    }
  }

  /**
   * POST /api/popups/:id/dismiss
   * Dismiss a popup (close or never show again)
   */
  async dismissPopup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const user = (req as any).user;
      const { dismiss_type, device_id } = req.body;

      // Validate dismiss type
      if (!dismiss_type || !['close', 'never_show'].includes(dismiss_type)) {
        res.status(400).json({
          success: false,
          error: 'Invalid dismiss_type. Must be "close" or "never_show"',
        });
        return;
      }

      // Require either user_id or device_id
      if (!user?.id && !device_id) {
        res.status(400).json({
          success: false,
          error: 'Either authenticated user or device_id is required',
        });
        return;
      }

      const success = await popupService.dismissPopup({
        popupId: id,
        dismissType: dismiss_type as PopupDismissType,
        userId: user?.id,
        deviceId: device_id,
      });

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to dismiss popup',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Popup dismissed successfully',
      });
    } catch (error) {
      logger.error('Failed to dismiss popup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        popupId: req.params.id,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to dismiss popup',
      });
    }
  }

  /**
   * POST /api/popups/:id/click
   * Record a click on a popup
   */
  async recordClick(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const success = await popupService.recordClick(id);

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to record popup click',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Click recorded successfully',
      });
    } catch (error) {
      logger.error('Failed to record popup click', {
        error: error instanceof Error ? error.message : 'Unknown error',
        popupId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to record popup click',
      });
    }
  }

  // =============================================
  // ADMIN METHODS
  // =============================================

  /**
   * GET /api/admin/popups
   * List all popups (admin)
   */
  async listPopups(req: Request, res: Response): Promise<void> {
    try {
      const { page, limit, active, sort_by, sort_order } = req.query;

      const result = await popupService.listPopups({
        page: page ? parseInt(page as string, 10) : undefined,
        limit: limit ? parseInt(limit as string, 10) : undefined,
        active: active !== undefined ? active === 'true' : undefined,
        sortBy: sort_by as any,
        sortOrder: sort_order as 'asc' | 'desc',
      });

      res.json({
        success: true,
        data: result,
      });
    } catch (error) {
      logger.error('Failed to list popups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to list popups',
      });
    }
  }

  /**
   * GET /api/admin/popups/:id
   * Get a single popup by ID (admin)
   */
  async getPopup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const popup = await popupService.getPopupById(id);

      if (!popup) {
        res.status(404).json({
          success: false,
          error: 'Popup not found',
        });
        return;
      }

      res.json({
        success: true,
        data: popup,
      });
    } catch (error) {
      logger.error('Failed to get popup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        popupId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get popup',
      });
    }
  }

  /**
   * POST /api/admin/popups
   * Create a new popup (admin)
   */
  async createPopup(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const {
        title,
        image_url,
        link_url,
        link_type,
        display_order,
        active,
        start_date,
        end_date,
        target_audience,
      } = req.body;

      // Validate required fields
      if (!title || !image_url) {
        res.status(400).json({
          success: false,
          error: 'Title and image_url are required',
        });
        return;
      }

      const popup = await popupService.createPopup(
        {
          title,
          imageUrl: image_url,
          linkUrl: link_url,
          linkType: link_type,
          displayOrder: display_order,
          active,
          startDate: start_date,
          endDate: end_date,
          targetAudience: target_audience,
        },
        user?.id
      );

      if (!popup) {
        res.status(500).json({
          success: false,
          error: 'Failed to create popup',
        });
        return;
      }

      res.status(201).json({
        success: true,
        data: popup,
      });
    } catch (error) {
      logger.error('Failed to create popup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create popup',
      });
    }
  }

  /**
   * PUT /api/admin/popups/:id
   * Update an existing popup (admin)
   */
  async updatePopup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const {
        title,
        image_url,
        link_url,
        link_type,
        display_order,
        active,
        start_date,
        end_date,
        target_audience,
      } = req.body;

      const popup = await popupService.updatePopup(id, {
        title,
        imageUrl: image_url,
        linkUrl: link_url,
        linkType: link_type,
        displayOrder: display_order,
        active,
        startDate: start_date,
        endDate: end_date,
        targetAudience: target_audience,
      });

      if (!popup) {
        res.status(404).json({
          success: false,
          error: 'Popup not found or update failed',
        });
        return;
      }

      res.json({
        success: true,
        data: popup,
      });
    } catch (error) {
      logger.error('Failed to update popup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        popupId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update popup',
      });
    }
  }

  /**
   * DELETE /api/admin/popups/:id
   * Delete a popup (admin)
   */
  async deletePopup(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const success = await popupService.deletePopup(id);

      if (!success) {
        res.status(404).json({
          success: false,
          error: 'Popup not found or delete failed',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Popup deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete popup', {
        error: error instanceof Error ? error.message : 'Unknown error',
        popupId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete popup',
      });
    }
  }

  /**
   * PUT /api/admin/popups/reorder
   * Reorder popups (admin)
   */
  async reorderPopups(req: Request, res: Response): Promise<void> {
    try {
      const { orders } = req.body;

      if (!orders || !Array.isArray(orders)) {
        res.status(400).json({
          success: false,
          error: 'orders array is required',
        });
        return;
      }

      // Validate orders format
      const isValid = orders.every(
        (o: any) =>
          o.id && typeof o.id === 'string' && typeof o.display_order === 'number'
      );

      if (!isValid) {
        res.status(400).json({
          success: false,
          error: 'Each order must have id (string) and display_order (number)',
        });
        return;
      }

      const success = await popupService.reorderPopups(
        orders.map((o: any) => ({
          id: o.id,
          displayOrder: o.display_order,
        }))
      );

      if (!success) {
        res.status(500).json({
          success: false,
          error: 'Failed to reorder popups',
        });
        return;
      }

      res.json({
        success: true,
        message: 'Popups reordered successfully',
      });
    } catch (error) {
      logger.error('Failed to reorder popups', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reorder popups',
      });
    }
  }

  /**
   * GET /api/admin/popups/statistics
   * Get popup statistics (admin)
   */
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const stats = await popupService.getStatistics();

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      logger.error('Failed to get popup statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get popup statistics',
      });
    }
  }
}

export const popupController = new PopupController();
export default popupController;
