/**
 * No-Show Detection Controller
 * 
 * Provides API endpoints for:
 * - Manual override of no-show detection
 * - No-show statistics and reporting
 * - Configuration management
 * - Manual trigger of no-show detection
 */

import { Request, Response } from 'express';
import { noShowDetectionService, ManualOverrideRequest, NoShowStatistics } from '../services/no-show-detection.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

export class NoShowDetectionController {
  /**
   * Manual override for no-show detection
   * POST /api/admin/no-show/override
   */
  async manualOverride(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (only shop owners and admins can override)
      const userRole = req.user?.role;
      if (!userRole || (userRole !== 'shop_owner' && userRole !== 'admin')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only shop owners and admins can override no-show detection.'
        });
        return;
      }

      const {
        reservationId,
        reason,
        action,
        extendedGracePeriod
      } = req.body;

      // Validate required fields
      if (!reservationId || !reason || !action) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: reservationId, reason, action'
        });
        return;
      }

      // Validate action
      const validActions = ['mark_attended', 'mark_no_show', 'extend_grace_period'];
      if (!validActions.includes(action)) {
        res.status(400).json({
          success: false,
          error: `Invalid action. Must be one of: ${validActions.join(', ')}`
        });
        return;
      }

      // Validate extended grace period if provided
      if (action === 'extend_grace_period' && (!extendedGracePeriod || extendedGracePeriod <= 0)) {
        res.status(400).json({
          success: false,
          error: 'extendedGracePeriod must be a positive number when action is extend_grace_period'
        });
        return;
      }

      const overrideRequest: ManualOverrideRequest = {
        reservationId,
        overrideBy: userRole === 'admin' ? 'admin' : 'shop',
        overrideById: req.user?.id || '',
        reason,
        action,
        extendedGracePeriod
      };

      const result = await noShowDetectionService.manualOverride(overrideRequest);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'No-show override applied successfully',
          reservation: result.reservation
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to apply no-show override',
          details: result.errors
        });
      }
    } catch (error) {
      logger.error('Error in manual override:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error during manual override'
      });
    }
  }

  /**
   * Get no-show statistics
   * GET /api/admin/no-show/statistics
   */
  async getStatistics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (only shop owners and admins can view statistics)
      const userRole = req.user?.role;
      if (!userRole || (userRole !== 'shop_owner' && userRole !== 'admin')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only shop owners and admins can view no-show statistics.'
        });
        return;
      }

      const { startDate, endDate, shopId } = req.query;

      // Validate required parameters
      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Missing required parameters: startDate, endDate'
        });
        return;
      }

      // Validate date format
      const startDateStr = startDate as string;
      const endDateStr = endDate as string;
      const shopIdStr = shopId as string;

      if (!this.isValidDate(startDateStr) || !this.isValidDate(endDateStr)) {
        res.status(400).json({
          success: false,
          error: 'Invalid date format. Use ISO 8601 format (YYYY-MM-DD)'
        });
        return;
      }

      // If shop owner, restrict to their shop (shop_id would be in user_metadata)
      const effectiveShopId = userRole === 'shop_owner' ? req.user?.user_metadata?.shop_id : shopIdStr;

      const statistics = await noShowDetectionService.getNoShowStatistics(
        startDateStr,
        endDateStr,
        effectiveShopId
      );

      res.status(200).json({
        success: true,
        statistics
      });
    } catch (error) {
      logger.error('Error getting no-show statistics:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching statistics'
      });
    }
  }

  /**
   * Get current no-show detection configuration
   * GET /api/admin/no-show/config
   */
  async getConfiguration(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (only admins can view configuration)
      const userRole = req.user?.role;
      if (!userRole || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only admins can view no-show configuration.'
        });
        return;
      }

      const config = noShowDetectionService.getConfiguration();

      res.status(200).json({
        success: true,
        config
      });
    } catch (error) {
      logger.error('Error getting no-show configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching configuration'
      });
    }
  }

  /**
   * Update no-show detection configuration
   * PUT /api/admin/no-show/config
   */
  async updateConfiguration(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (only admins can update configuration)
      const userRole = req.user?.role;
      if (!userRole || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only admins can update no-show configuration.'
        });
        return;
      }

      const config = req.body;

      // Validate configuration
      if (config.defaultGracePeriod !== undefined && config.defaultGracePeriod < 0) {
        res.status(400).json({
          success: false,
          error: 'defaultGracePeriod must be a positive number'
        });
        return;
      }

      if (config.penaltyPoints !== undefined && config.penaltyPoints < 0) {
        res.status(400).json({
          success: false,
          error: 'penaltyPoints must be a positive number'
        });
        return;
      }

      const result = await noShowDetectionService.updateConfiguration(config);

      if (result.success) {
        res.status(200).json({
          success: true,
          message: 'Configuration updated successfully'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'Failed to update configuration',
          details: result.errors
        });
      }
    } catch (error) {
      logger.error('Error updating no-show configuration:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while updating configuration'
      });
    }
  }

  /**
   * Manually trigger no-show detection
   * POST /api/admin/no-show/trigger
   */
  async triggerDetection(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (only admins can trigger detection)
      const userRole = req.user?.role;
      if (!userRole || userRole !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only admins can trigger no-show detection.'
        });
        return;
      }

      const result = await noShowDetectionService.processAutomaticNoShowDetection();

      res.status(200).json({
        success: true,
        message: 'No-show detection triggered successfully',
        result: {
          processed: result.processed,
          noShowsDetected: result.noShowsDetected,
          errors: result.errors
        }
      });
    } catch (error) {
      logger.error('Error triggering no-show detection:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while triggering detection'
      });
    }
  }

  /**
   * Get no-show detection status for a specific reservation
   * GET /api/admin/no-show/reservation/:reservationId
   */
  async getReservationStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate user role (shop owners and admins can view reservation status)
      const userRole = req.user?.role;
      if (!userRole || (userRole !== 'shop_owner' && userRole !== 'admin')) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. Only shop owners and admins can view reservation status.'
        });
        return;
      }

      const { reservationId } = req.params;

      if (!reservationId) {
        res.status(400).json({
          success: false,
          error: 'Missing reservation ID'
        });
        return;
      }

      // Get reservation details
      const { getSupabaseClient } = require('../config/database');
      const supabase = getSupabaseClient();

      const { data: reservation, error } = await supabase
        .from('reservations')
        .select('*')
        .eq('id', reservationId)
        .single();

      if (error || !reservation) {
        res.status(404).json({
          success: false,
          error: 'Reservation not found'
        });
        return;
      }

      // If shop owner, verify they own the shop
      if (userRole === 'shop_owner' && reservation.shop_id !== req.user?.user_metadata?.shop_id) {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions. You can only view reservations for your own shop.'
        });
        return;
      }

      // Calculate if reservation is eligible for no-show detection
      const now = new Date();
      const reservationTime = new Date(reservation.reservation_datetime);
      const timeDifference = now.getTime() - reservationTime.getTime();
      const gracePeriod = 30 * 60 * 1000; // 30 minutes in milliseconds

      const isEligibleForNoShow = 
        reservation.status === 'confirmed' && 
        timeDifference > gracePeriod;

      res.status(200).json({
        success: true,
        reservation: {
          id: reservation.id,
          status: reservation.status,
          reservation_datetime: reservation.reservation_datetime,
          isEligibleForNoShow,
          timeSinceReservation: Math.floor(timeDifference / (1000 * 60)), // minutes
          gracePeriod: 30 // minutes
        }
      });
    } catch (error) {
      logger.error('Error getting reservation status:', error);
      res.status(500).json({
        success: false,
        error: 'Internal server error while fetching reservation status'
      });
    }
  }

  /**
   * Helper method to validate date format
   */
  private isValidDate(dateString: string): boolean {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date.getTime());
  }
}

// Export singleton instance
export const noShowDetectionController = new NoShowDetectionController(); 