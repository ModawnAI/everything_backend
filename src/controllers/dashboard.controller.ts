import { Request, Response } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { logger } from '../utils/logger';
import { adminAuthService } from '../services/admin-auth.service';

export class DashboardController {
  /**
   * GET /api/admin/dashboard/overview
   * Get dashboard overview statistics
   */
  async getDashboardOverview(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      // Validate admin session
      const validation = await adminAuthService.validateAdminSession(token, ipAddress);
      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid admin session'
        });
        return;
      }

      const { period = '30d' } = req.query;

      // Validate period parameter
      if (!['7d', '30d', '90d'].includes(period as string)) {
        res.status(400).json({
          success: false,
          error: 'Invalid period. Must be one of: 7d, 30d, 90d'
        });
        return;
      }

      const overview = await dashboardService.getDashboardOverview(period as '7d' | '30d' | '90d');

      res.json({
        success: true,
        data: overview
      });
    } catch (error) {
      logger.error('Dashboard overview failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get dashboard overview'
      });
    }
  }
}

export const dashboardController = new DashboardController();
