import { Request, Response } from 'express';
import { adminAnnouncementService } from '../services/admin-announcement.service';
import { logger } from '../utils/logger';

export class AdminAnnouncementController {
  /**
   * GET /api/admin/announcements
   * Get all announcements with filtering
   */
  async getAnnouncements(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { page = '1', limit = '20', isActive, isImportant } = req.query;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const filters = {
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        isImportant: isImportant === 'true' ? true : isImportant === 'false' ? false : undefined
      };

      const result = await adminAnnouncementService.getAnnouncements(
        parseInt(page as string, 10),
        parseInt(limit as string, 10),
        filters,
        user.id
      );

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get announcements failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get announcements'
      });
    }
  }

  /**
   * GET /api/admin/announcements/:id
   * Get announcement by ID
   */
  async getAnnouncementById(req: Request, res: Response): Promise<void> {
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
          error: 'Announcement ID is required'
        });
        return;
      }

      const result = await adminAnnouncementService.getAnnouncementById(id, user.id);

      if (!result.announcement) {
        res.status(404).json({
          success: false,
          error: 'Announcement not found'
        });
        return;
      }

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Get announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        announcementId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get announcement'
      });
    }
  }

  /**
   * POST /api/admin/announcements
   * Create new announcement
   */
  async createAnnouncement(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required'
        });
        return;
      }

      const { title, content, isImportant, isActive, targetUserType, startsAt, endsAt } = req.body;

      // Validate required fields
      if (!title || !content) {
        res.status(400).json({
          success: false,
          error: 'Title and content are required'
        });
        return;
      }

      const result = await adminAnnouncementService.createAnnouncement(
        {
          title,
          content,
          isImportant,
          isActive,
          targetUserType,
          startsAt,
          endsAt
        },
        user.id
      );

      res.status(201).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Create announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to create announcement'
      });
    }
  }

  /**
   * PUT /api/admin/announcements/:id
   * Update announcement
   */
  async updateAnnouncement(req: Request, res: Response): Promise<void> {
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
          error: 'Announcement ID is required'
        });
        return;
      }

      const result = await adminAnnouncementService.updateAnnouncement(id, req.body, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Update announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        announcementId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update announcement'
      });
    }
  }

  /**
   * DELETE /api/admin/announcements/:id
   * Delete announcement
   */
  async deleteAnnouncement(req: Request, res: Response): Promise<void> {
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
          error: 'Announcement ID is required'
        });
        return;
      }

      const result = await adminAnnouncementService.deleteAnnouncement(id, user.id);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Delete announcement failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        announcementId: req.params.id,
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to delete announcement'
      });
    }
  }
}

export const adminAnnouncementController = new AdminAnnouncementController();
