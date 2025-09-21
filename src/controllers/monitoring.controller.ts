/**
 * Monitoring Controller
 * 
 * Provides endpoints for system monitoring, health checks, and alerting
 */

import { Request, Response } from 'express';
import { monitoringService } from '../services/monitoring.service';
import { timeSlotService } from '../services/time-slot.service';
import { conflictResolutionService } from '../services/conflict-resolution.service';
import { logger } from '../utils/logger';

export class MonitoringController {
  /**
   * Get system health metrics
   */
  async getSystemHealth(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      const timeRange = startDate && endDate ? {
        start: startDate as string,
        end: endDate as string
      } : undefined;

      const healthMetrics = await monitoringService.getSystemHealthMetrics(
        shopId,
        timeRange
      );

      res.status(200).json({
        success: true,
        data: healthMetrics,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting system health:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get system health metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get active alerts
   */
  async getActiveAlerts(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.query;
      const { severity } = req.query;

      let alerts = monitoringService.getActiveAlerts(shopId as string);

      // Filter by severity if specified
      if (severity) {
        alerts = alerts.filter(alert => alert.severity === severity);
      }

      res.status(200).json({
        success: true,
        data: {
          alerts,
          count: alerts.length
        },
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting active alerts:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get active alerts',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(req: Request, res: Response): Promise<void> {
    try {
      const { alertId } = req.params;
      const { resolvedBy } = req.body;

      if (!resolvedBy) {
        res.status(400).json({
          success: false,
          error: 'resolvedBy is required'
        });
        return;
      }

      monitoringService.resolveAlert(alertId, resolvedBy);

      res.status(200).json({
        success: true,
        message: 'Alert resolved successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error resolving alert:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to resolve alert',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get monitoring configuration
   */
  async getMonitoringConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = monitoringService.getConfig();

      res.status(200).json({
        success: true,
        data: config,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting monitoring config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get monitoring configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Update monitoring configuration
   */
  async updateMonitoringConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = req.body;

      // Validate configuration
      if (!config || typeof config !== 'object') {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration format'
        });
        return;
      }

      monitoringService.updateConfig(config);

      res.status(200).json({
        success: true,
        message: 'Monitoring configuration updated successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error updating monitoring config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update monitoring configuration',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Health check endpoint
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        services: {
          timeSlotService: 'operational',
          conflictResolutionService: 'operational',
          monitoringService: 'operational'
        },
        version: process.env.npm_package_version || '1.0.0'
      };

      res.status(200).json(healthStatus);

    } catch (error) {
      logger.error('Health check failed:', { error: (error as Error).message });
      
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: 'Service unavailable',
        version: process.env.npm_package_version || '1.0.0'
      });
    }
  }

  /**
   * Get time slot system metrics
   */
  async getTimeSlotMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const stats = await timeSlotService.getTimeSlotStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting time slot metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get time slot metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Get conflict resolution metrics
   */
  async getConflictMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const stats = await conflictResolutionService.getConflictStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.status(200).json({
        success: true,
        data: stats,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error getting conflict metrics:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get conflict metrics',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Trigger manual conflict detection
   */
  async triggerConflictDetection(req: Request, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { reservationId, startDate, endDate } = req.body;

      const dateRange = startDate && endDate ? { startDate, endDate } : undefined;

      const result = await conflictResolutionService.detectConflicts(
        shopId,
        reservationId,
        dateRange
      );

      res.status(200).json({
        success: true,
        data: result,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Error triggering conflict detection:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to trigger conflict detection',
        timestamp: new Date().toISOString()
      });
    }
  }
}

export const monitoringController = new MonitoringController();
