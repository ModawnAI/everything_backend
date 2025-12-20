/**
 * Home Controller
 * Handles home page data endpoints
 */

import { Request, Response } from 'express';
import { homeService } from '../services/home.service';
import { logger } from '../utils/logger';

export class HomeController {
  /**
   * GET /api/home/sections
   * Get all home page sections
   */
  async getSections(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { lat, lng } = req.query;

      const latitude = lat ? parseFloat(lat as string) : undefined;
      const longitude = lng ? parseFloat(lng as string) : undefined;

      // Validate coordinates if provided
      if ((latitude !== undefined && isNaN(latitude)) ||
          (longitude !== undefined && isNaN(longitude))) {
        res.status(400).json({
          success: false,
          error: 'Invalid coordinates provided',
        });
        return;
      }

      const sections = await homeService.getAllSections(
        user?.id,
        latitude,
        longitude
      );

      res.json({
        success: true,
        data: sections,
      });
    } catch (error) {
      logger.error('Failed to get home sections', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get home sections',
      });
    }
  }

  /**
   * GET /api/home/nearby
   * Get nearby nail shops
   */
  async getNearbyShops(req: Request, res: Response): Promise<void> {
    try {
      const { lat, lng, limit = '10', radius = '5' } = req.query;

      if (!lat || !lng) {
        res.status(400).json({
          success: false,
          error: 'Latitude and longitude are required',
        });
        return;
      }

      const latitude = parseFloat(lat as string);
      const longitude = parseFloat(lng as string);

      if (isNaN(latitude) || isNaN(longitude)) {
        res.status(400).json({
          success: false,
          error: 'Invalid coordinates provided',
        });
        return;
      }

      const shops = await homeService.getNearbyNailShops(
        latitude,
        longitude,
        parseInt(limit as string, 10),
        parseFloat(radius as string)
      );

      res.json({
        success: true,
        data: shops,
      });
    } catch (error) {
      logger.error('Failed to get nearby shops', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get nearby shops',
      });
    }
  }

  /**
   * GET /api/home/frequently-visited
   * Get frequently visited shops for authenticated user
   */
  async getFrequentlyVisited(req: Request, res: Response): Promise<void> {
    try {
      const user = (req as any).user;
      const { limit = '10' } = req.query;

      if (!user) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
        return;
      }

      const shops = await homeService.getFrequentlyVisited(
        user.id,
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: shops,
      });
    } catch (error) {
      logger.error('Failed to get frequently visited shops', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id,
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get frequently visited shops',
      });
    }
  }

  /**
   * GET /api/home/best-recommended
   * Get best recommended shops
   */
  async getBestRecommended(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '10' } = req.query;

      const shops = await homeService.getBestRecommended(
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: shops,
      });
    } catch (error) {
      logger.error('Failed to get best recommended shops', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get best recommended shops',
      });
    }
  }

  /**
   * GET /api/home/editor-picks
   * Get editor's picks
   */
  async getEditorPicks(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '10' } = req.query;

      const picks = await homeService.getEditorPicks(
        parseInt(limit as string, 10)
      );

      res.json({
        success: true,
        data: picks,
      });
    } catch (error) {
      logger.error('Failed to get editor picks', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get editor picks',
      });
    }
  }
}

export const homeController = new HomeController();
export default homeController;
