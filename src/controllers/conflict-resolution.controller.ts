/**
 * Conflict Resolution Controller
 * 
 * Handles API endpoints for conflict detection and resolution functionality
 */

import { Request, Response } from 'express';
import { conflictResolutionService } from '../services/conflict-resolution.service';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { ResolutionMethod } from '../services/conflict-resolution.service';

export class ConflictResolutionController {
  private supabase = getSupabaseClient();
  /**
   * Detect conflicts for a shop
   * GET /api/shops/:shopId/conflicts/detect
   */
  async detectConflicts(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate, reservationId } = req.query;

      // Validate shop access
      if (req.user?.user_metadata?.shop_id !== shopId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const dateRange = startDate && endDate ? {
        startDate: startDate as string,
        endDate: endDate as string
      } : undefined;

      const result = await conflictResolutionService.detectConflicts(
        shopId,
        reservationId as string || undefined,
        dateRange
      );

      res.json({
        success: true,
        data: result
      });

    } catch (error) {
      logger.error('Error detecting conflicts:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to detect conflicts'
      });
    }
  }

  /**
   * Resolve a specific conflict
   * POST /api/conflicts/:conflictId/resolve
   */
  async resolveConflict(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { conflictId } = req.params;
      const { resolutionMethod, notes, compensation, affectedReservations } = req.body;

      if (!resolutionMethod || !affectedReservations) {
        res.status(400).json({
          success: false,
          error: 'resolutionMethod and affectedReservations are required'
        });
        return;
      }

      const result = await conflictResolutionService.resolveConflict({
        conflictId,
        resolutionMethod,
        resolvedBy: req.user?.id || '',
        resolvedByRole: (req.user?.role as 'user' | 'shop_owner' | 'admin') ?? 'user',
        notes,
        compensation,
        affectedReservations
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
          conflictId: result.conflictId,
          resolutionMethod: result.resolutionMethod,
          affectedReservations: result.affectedReservations,
          notifications: result.notifications,
          compensation: result.compensation,
          warnings: result.warnings
        }
      });

    } catch (error) {
      logger.error('Error resolving conflict:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to resolve conflict'
      });
    }
  }

  /**
   * Calculate priority scores for conflicting reservations
   * POST /api/conflicts/priority-scores
   */
  async calculatePriorityScores(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { reservationIds } = req.body;

      if (!reservationIds || !Array.isArray(reservationIds)) {
        res.status(400).json({
          success: false,
          error: 'reservationIds array is required'
        });
        return;
      }

      const scores = await conflictResolutionService.calculatePriorityScores(reservationIds);

      res.json({
        success: true,
        data: scores
      });

    } catch (error) {
      logger.error('Error calculating priority scores:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to calculate priority scores'
      });
    }
  }

  /**
   * Get conflict history for a shop
   * GET /api/shops/:shopId/conflicts/history
   */
  async getConflictHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate } = req.query;

      // Validate shop access
      if (req.user?.user_metadata?.shop_id !== shopId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const conflicts = await conflictResolutionService.getConflictHistory(
        shopId,
        startDate as string || undefined,
        endDate as string || undefined
      );

      res.json({
        success: true,
        data: conflicts
      });

    } catch (error) {
      logger.error('Error getting conflict history:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get conflict history'
      });
    }
  }

  /**
   * Get conflict statistics for a shop
   * GET /api/shops/:shopId/conflicts/stats
   */
  async getConflictStats(req: AuthenticatedRequest, res: Response): Promise<void> {
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

      // Validate shop access
      if (req.user?.user_metadata?.shop_id !== shopId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      const stats = await conflictResolutionService.getConflictStats(
        shopId,
        startDate as string,
        endDate as string
      );

      res.json({
        success: true,
        data: stats
      });

    } catch (error) {
      logger.error('Error getting conflict stats:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get conflict stats'
      });
    }
  }

  /**
   * Get manual conflict resolution interface data
   * GET /api/shops/:shopId/conflicts/manual-interface
   */
  async getManualInterfaceData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { date } = req.query;

      if (!date) {
        res.status(400).json({
          success: false,
          error: 'date parameter is required'
        });
        return;
      }

      // Validate shop access
      if (req.user?.user_metadata?.shop_id !== shopId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      // Get conflicts for the specific date
      const conflicts = await conflictResolutionService.detectConflicts(
        shopId,
        undefined,
        { startDate: date as string, endDate: date as string }
      );

      // Get all reservations for the date to show in the interface
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select(`
          *,
          users(name, email, phone_number, user_role),
          shop_services(name, duration_minutes)
        `)
        .eq('shop_id', shopId)
        .eq('reservation_date', date)
        .in('status', ['requested', 'confirmed'])
        .order('reservation_time');

      if (error) {
        logger.error('Error getting reservations for manual interface:', { error: error.message });
        res.status(500).json({
          success: false,
          error: 'Failed to get reservation data'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          conflicts: conflicts.conflicts,
          reservations: reservations || [],
          date: date
        }
      });

    } catch (error) {
      logger.error('Error getting manual interface data:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to get manual interface data'
      });
    }
  }

  /**
   * Apply automatic conflict prevention
   * POST /api/shops/:shopId/conflicts/prevent
   */
  async applyConflictPrevention(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { dateRange, preventionRules } = req.body;

      // Validate shop access
      if (req.user?.user_metadata?.shop_id !== shopId && req.user?.role !== 'admin') {
        res.status(403).json({
          success: false,
          error: 'Access denied to this shop'
        });
        return;
      }

      // Detect conflicts first
      const conflicts = await conflictResolutionService.detectConflicts(
        shopId,
        undefined,
        dateRange
      );

      if (!conflicts.hasConflicts) {
        res.json({
          success: true,
          data: {
            message: 'No conflicts detected. Prevention not needed.',
            conflictsDetected: 0,
            conflictsResolved: 0
          }
        });
        return;
      }

      // Apply automatic resolution based on prevention rules
      let resolvedCount = 0;
      const errors: string[] = [];
      const warnings: string[] = [];

      for (const conflict of conflicts.conflicts) {
        try {
          // Determine resolution method based on conflict type and prevention rules
          const resolutionMethod = this.determineAutomaticResolutionMethod(conflict, preventionRules);
          
          if (resolutionMethod) {
            const result = await conflictResolutionService.resolveConflict({
              conflictId: conflict.id,
              resolutionMethod,
              resolvedBy: 'system',
              resolvedByRole: 'admin',
              notes: 'Automatic conflict prevention',
              affectedReservations: conflict.affectedReservations.map(id => ({
                reservationId: id,
                action: 'reschedule'
              }))
            });

            if (result.success) {
              resolvedCount++;
            } else {
              errors.push(`Failed to resolve conflict ${conflict.id}: ${result.errors.join(', ')}`);
            }
          }
        } catch (error) {
          errors.push(`Error resolving conflict ${conflict.id}: ${(error as Error).message}`);
        }
      }

      res.json({
        success: errors.length === 0,
        data: {
          conflictsDetected: conflicts.conflicts.length,
          conflictsResolved: resolvedCount,
          errors,
          warnings
        }
      });

    } catch (error) {
      logger.error('Error applying conflict prevention:', { error: (error as Error).message });
      res.status(500).json({
        success: false,
        error: 'Failed to apply conflict prevention'
      });
    }
  }

  // Private helper methods

  private determineAutomaticResolutionMethod(
    conflict: any,
    preventionRules: any
  ): ResolutionMethod | null {
    // Simple logic for automatic resolution
    // In a real implementation, this would be more sophisticated
    switch (conflict.type) {
      case 'time_overlap':
        return 'automatic_reschedule';
      case 'resource_shortage':
        return 'resource_reallocation';
      case 'capacity_exceeded':
        return 'cancellation';
      default:
        return null;
    }
  }
}

export const conflictResolutionController = new ConflictResolutionController(); 