/**
 * Automatic State Progression Controller
 * 
 * REST API endpoints for monitoring and managing automatic reservation state transitions
 */

import { Request, Response } from 'express';
import { automaticStateProgressionService } from '../services/automatic-state-progression.service';
import { logger } from '../utils/logger';

export class AutomaticStateProgressionController {
  /**
   * GET /api/admin/state-progression/status
   * Get current status and metrics of automatic state progression
   */
  async getStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = automaticStateProgressionService.getStatus();
      const metrics = automaticStateProgressionService.getMetrics();
      const healthCheck = await automaticStateProgressionService.healthCheck();

      res.json({
        success: true,
        data: {
          status,
          metrics,
          health: healthCheck
        }
      });

    } catch (error) {
      logger.error('Failed to get automatic state progression status', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'STATUS_FETCH_FAILED',
          message: 'Failed to fetch automatic state progression status',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * POST /api/admin/state-progression/run
   * Manually trigger automatic state progression
   */
  async manualRun(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Manual automatic state progression triggered', {
        triggeredBy: (req as any).user?.id || 'unknown'
      });

      const result = await automaticStateProgressionService.processWithRetry();

      res.json({
        success: true,
        data: result,
        message: 'Automatic state progression completed successfully'
      });

    } catch (error) {
      logger.error('Manual automatic state progression failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        triggeredBy: (req as any).user?.id || 'unknown'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'MANUAL_RUN_FAILED',
          message: 'Manual automatic state progression failed',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/state-progression/metrics
   * Get detailed metrics and performance data
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = automaticStateProgressionService.getMetrics();
      const healthCheck = await automaticStateProgressionService.healthCheck();

      res.json({
        success: true,
        data: {
          metrics,
          health: healthCheck,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to get automatic state progression metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_FETCH_FAILED',
          message: 'Failed to fetch automatic state progression metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * PUT /api/admin/state-progression/config
   * Update automatic state progression configuration
   */
  async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const { config } = req.body;

      if (!config || typeof config !== 'object') {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_CONFIG',
            message: 'Valid configuration object is required',
            details: 'Request body must contain a config object'
          }
        });
        return;
      }

      automaticStateProgressionService.updateConfig(config);

      logger.info('Automatic state progression configuration updated', {
        updatedBy: (req as any).user?.id || 'unknown',
        config
      });

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: {
          updatedConfig: config,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to update automatic state progression configuration', {
        error: error instanceof Error ? error.message : 'Unknown error',
        updatedBy: (req as any).user?.id || 'unknown'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'CONFIG_UPDATE_FAILED',
          message: 'Failed to update configuration',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * POST /api/admin/state-progression/reset-metrics
   * Reset daily metrics (admin only)
   */
  async resetMetrics(req: Request, res: Response): Promise<void> {
    try {
      automaticStateProgressionService.resetDailyMetrics();

      logger.info('Daily metrics reset manually', {
        resetBy: (req as any).user?.id || 'unknown'
      });

      res.json({
        success: true,
        message: 'Daily metrics reset successfully',
        data: {
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to reset daily metrics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        resetBy: (req as any).user?.id || 'unknown'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'METRICS_RESET_FAILED',
          message: 'Failed to reset daily metrics',
          details: error instanceof Error ? error.message : 'Unknown error'
        }
      });
    }
  }

  /**
   * GET /api/admin/state-progression/health
   * Health check endpoint for monitoring systems
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthCheck = await automaticStateProgressionService.healthCheck();

      // Set appropriate HTTP status based on health
      const statusCode = healthCheck.status === 'healthy' ? 200 : 
                        healthCheck.status === 'degraded' ? 200 : 503;

      res.status(statusCode).json({
        success: healthCheck.status !== 'unhealthy',
        data: healthCheck,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Health check failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(503).json({
        success: false,
        data: {
          status: 'unhealthy',
          details: {
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        },
        timestamp: new Date().toISOString()
      });
    }
  }
}

// Export singleton instance
export const automaticStateProgressionController = new AutomaticStateProgressionController();
