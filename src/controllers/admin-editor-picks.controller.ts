/**
 * Admin Editor Picks Controller
 * Handles admin management of editor's picks
 */

import { Request, Response } from 'express';
import { adminEditorPicksService } from '../services/admin-editor-picks.service';
import { logger } from '../utils/logger';

export class AdminEditorPicksController {
  /**
   * GET /api/admin/editor-picks
   * Get all editor picks
   */
  async getAll(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const picks = await adminEditorPicksService.getAll();

      res.json({
        success: true,
        data: picks,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Check if table doesn't exist
      if (errorMessage.includes('not found') || errorMessage.includes('does not exist')) {
        res.status(503).json({
          success: false,
          error: 'Editor picks feature not yet available. Please run database migration.',
        });
        return;
      }

      logger.error('Failed to get editor picks', {
        error: errorMessage,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get editor picks',
      });
    }
  }

  /**
   * GET /api/admin/editor-picks/:id
   * Get a single editor pick by ID
   */
  async getById(req: Request, res: Response): Promise<void> {
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

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Editor pick ID is required',
        });
        return;
      }

      const pick = await adminEditorPicksService.getById(id);

      if (!pick) {
        res.status(404).json({
          success: false,
          error: 'Editor pick not found',
        });
        return;
      }

      res.json({
        success: true,
        data: pick,
      });
    } catch (error) {
      logger.error('Failed to get editor pick', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pickId: req.params.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get editor pick',
      });
    }
  }

  /**
   * POST /api/admin/editor-picks
   * Create a new editor pick
   */
  async create(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { shopId, title, description, displayOrder, startDate, endDate } = req.body;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!shopId) {
        res.status(400).json({
          success: false,
          error: 'Shop ID is required',
        });
        return;
      }

      const pick = await adminEditorPicksService.create(
        {
          shopId,
          title,
          description,
          displayOrder,
          startDate,
          endDate,
        },
        user.id
      );

      res.status(201).json({
        success: true,
        data: pick,
        message: 'Editor pick created successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Shop not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      logger.error('Failed to create editor pick', {
        error: errorMessage,
        userId: (req as any).user?.id,
        shopId: req.body.shopId,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create editor pick',
      });
    }
  }

  /**
   * PUT /api/admin/editor-picks/:id
   * Update an editor pick
   */
  async update(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { id } = req.params;
      const { shopId, title, description, displayOrder, startDate, endDate, active } = req.body;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Editor pick ID is required',
        });
        return;
      }

      const pick = await adminEditorPicksService.update(id, {
        shopId,
        title,
        description,
        displayOrder,
        startDate,
        endDate,
        active,
      });

      res.json({
        success: true,
        data: pick,
        message: 'Editor pick updated successfully',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (errorMessage.includes('Shop not found')) {
        res.status(404).json({
          success: false,
          error: errorMessage,
        });
        return;
      }

      logger.error('Failed to update editor pick', {
        error: errorMessage,
        pickId: req.params.id,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update editor pick',
      });
    }
  }

  /**
   * DELETE /api/admin/editor-picks/:id
   * Delete an editor pick
   */
  async delete(req: Request, res: Response): Promise<void> {
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

      if (!id) {
        res.status(400).json({
          success: false,
          error: 'Editor pick ID is required',
        });
        return;
      }

      await adminEditorPicksService.delete(id);

      res.json({
        success: true,
        message: 'Editor pick deleted successfully',
      });
    } catch (error) {
      logger.error('Failed to delete editor pick', {
        error: error instanceof Error ? error.message : 'Unknown error',
        pickId: req.params.id,
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete editor pick',
      });
    }
  }

  /**
   * POST /api/admin/editor-picks/reorder
   * Reorder editor picks
   */
  async reorder(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { picks } = req.body;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!picks || !Array.isArray(picks)) {
        res.status(400).json({
          success: false,
          error: 'Picks array is required',
        });
        return;
      }

      await adminEditorPicksService.reorder(picks);

      res.json({
        success: true,
        message: 'Editor picks reordered successfully',
      });
    } catch (error) {
      logger.error('Failed to reorder editor picks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to reorder editor picks',
      });
    }
  }

  /**
   * GET /api/admin/editor-picks/search-shops
   * Search shops for adding to editor picks
   */
  async searchShops(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { query, limit = '20' } = req.query;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      if (!query || typeof query !== 'string') {
        res.status(400).json({
          success: false,
          error: 'Search query is required',
        });
        return;
      }

      const shops = await adminEditorPicksService.searchShops(
        query,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: shops,
      });
    } catch (error) {
      logger.error('Failed to search shops', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query.query,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to search shops',
      });
    }
  }
}

export const adminEditorPicksController = new AdminEditorPicksController();
export default adminEditorPicksController;
