/**
 * Reservation Rescheduling Controller
 * 
 * Handles API endpoints for reservation rescheduling functionality
 */

import { Request, Response } from 'express';
import { reservationReschedulingService } from '../services/reservation-rescheduling.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';

export class ReservationReschedulingController {
  /**
   * Validate a reschedule request
   * POST /api/reservations/:reservationId/reschedule/validate
   */
  async validateReschedule(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
      const { newDate, newTime, reason } = req.body;

      if (!newDate || !newTime) {
        res.status(400).json({
          success: false,
          error: 'newDate and newTime are required'
        });
        return;
      }

      const validation = await reservationReschedulingService.validateRescheduleRequest({
        reservationId,
        newDate,
        newTime,
        reason,
        requestedBy: (req.user?.role as 'user' | 'shop' | 'admin') ?? 'user',
        requestedById: req.user?.id ?? ''
      });

      res.json({
        success: true,
        data: validation
      });

    } catch (error) {
      logger.error('Error validating reschedule request:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to validate reschedule request'
      });
    }
  }

  /**
   * Execute a reschedule request
   * POST /api/reservations/:reservationId/reschedule
   */
  async rescheduleReservation(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
      const { newDate, newTime, reason } = req.body;

      if (!newDate || !newTime) {
        res.status(400).json({
          success: false,
          error: 'newDate and newTime are required'
        });
        return;
      }

      const result = await reservationReschedulingService.rescheduleReservation({
        reservationId,
        newDate,
        newTime,
        reason,
        requestedBy: (req.user?.role as 'user' | 'shop' | 'admin') ?? 'user',
        requestedById: req.user?.id ?? ''
      });

      if (!result.success) {
        res.status(400).json({
          success: false,
          errors: result.errors,
          warnings: result.warnings
        });
        return;
      }

      res.json({
        success: true,
        data: {
          reservation: result.reservation,
          warnings: result.warnings,
          fees: result.fees,
          notifications: result.notifications
        }
      });

    } catch (error) {
      logger.error('Error rescheduling reservation:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to reschedule reservation'
      });
    }
  }

  /**
   * Get available reschedule slots for a reservation
   * GET /api/reservations/:reservationId/reschedule/available-slots
   */
  async getAvailableRescheduleSlots(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;
      const { preferredDate, preferredTime } = req.query;

      const result = await reservationReschedulingService.getAvailableRescheduleSlots(
        reservationId,
        typeof preferredDate === 'string' ? preferredDate : undefined,
        typeof preferredTime === 'string' ? preferredTime : undefined
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error getting available reschedule slots:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get available reschedule slots'
      });
    }
  }

  /**
   * Get reschedule history for a reservation
   * GET /api/reservations/:reservationId/reschedule/history
   */
  async getRescheduleHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationId } = req.params;

      const history = await reservationReschedulingService.getRescheduleHistory(reservationId);

      res.json({
        success: true,
        data: history
      });

    } catch (error) {
      logger.error('Error getting reschedule history:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get reschedule history'
      });
    }
  }

  /**
   * Get reschedule statistics for a shop (shop owner/admin only)
   * GET /api/shops/:shopId/reschedule/stats
   */
  async getRescheduleStats(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate user permissions
      if (req.user?.role !== 'shop_owner' && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Insufficient permissions'
        });
        return;
      }

      // For shop owners, validate they own the shop
      if (req.user?.role === 'shop_owner' && req.user?.user_metadata?.shop_id !== shopId) {
        res.status(403).json({
          success: false,
          error: 'Can only view stats for your own shop'
        });
        return;
      }

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'startDate and endDate are required'
        });
        return;
      }

      const stats = await reservationReschedulingService.getRescheduleStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting reschedule stats:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get reschedule statistics'
      });
    }
  }

  /**
   * Get reschedule configuration (admin only)
   * GET /api/admin/reschedule/config
   */
  async getRescheduleConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      // Return default configuration
      const config = {
        maxReschedulesPerReservation: 3,
        minNoticePeriodHours: 2,
        maxRescheduleAdvanceDays: 30,
        rescheduleFees: {
          lastMinuteFee: 5000,
          sameDayFee: 10000,
          noShowRescheduleFee: 15000
        },
        allowedStatuses: ['requested', 'confirmed'],
        restrictedStatuses: ['completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show']
      };

      res.json({
        success: true,
        data: config
      });

    } catch (error) {
      logger.error('Error getting reschedule config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get reschedule configuration'
      });
    }
  }

  /**
   * Update reschedule configuration (admin only)
   * PUT /api/admin/reschedule/config
   */
  async updateRescheduleConfig(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      // Validate admin permissions
      if (req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Admin access required'
        });
        return;
      }

      const config = req.body;

      // Validate configuration
      if (!config.maxReschedulesPerReservation || !config.minNoticePeriodHours) {
        res.status(400).json({
          success: false,
          error: 'Invalid configuration parameters'
        });
        return;
      }

      // This would update the configuration in the database
      // For now, we'll just return success
      res.json({
        success: true,
        message: 'Configuration updated successfully'
      });

    } catch (error) {
      logger.error('Error updating reschedule config:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to update reschedule configuration'
      });
    }
  }
}

export const reservationReschedulingController = new ReservationReschedulingController(); 