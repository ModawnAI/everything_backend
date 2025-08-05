/**
 * No-Show Detection Service
 * 
 * Comprehensive system for detecting and handling no-show reservations with:
 * - Scheduled job to check for no-show reservations (30 minutes after reservation time)
 * - Configurable grace periods for different service types
 * - Automatic status updates and notification triggers
 * - No-show penalty system with point deductions
 * - Manual override capabilities for staff
 * - Audit logging for all no-show actions
 */

import { getSupabaseClient } from '../config/database';
import { ReservationStatus, Reservation, ShopService, User } from '../types/database.types';
import { logger } from '../utils/logger';
import { ReservationStateMachine } from './reservation-state-machine.service';

// Extended reservation type with service information
interface ReservationWithServices extends Reservation {
  reservation_services?: Array<{
    service_id: string;
    shop_services?: {
      category: string;
    };
  }>;
}

// No-show detection configuration
export interface NoShowConfig {
  defaultGracePeriod: number; // minutes
  serviceTypeGracePeriods: Record<string, number>; // service category -> minutes
  penaltyPoints: number;
  maxPenaltyPoints: number;
  notificationDelay: number; // minutes before sending notification
  autoDetectionEnabled: boolean;
  manualOverrideEnabled: boolean;
}

// No-show detection result
export interface NoShowDetectionResult {
  reservationId: string;
  userId: string;
  shopId: string;
  reservationTime: string;
  gracePeriod: number;
  isNoShow: boolean;
  reason?: string;
  penaltyApplied: number;
  notificationSent: boolean;
}

// Manual override request
export interface ManualOverrideRequest {
  reservationId: string;
  overrideBy: 'shop' | 'admin';
  overrideById: string;
  reason: string;
  action: 'mark_attended' | 'mark_no_show' | 'extend_grace_period';
  extendedGracePeriod?: number; // minutes
}

// No-show statistics
export interface NoShowStatistics {
  totalReservations: number;
  noShowCount: number;
  noShowRate: number;
  averageGracePeriod: number;
  totalPenaltyPoints: number;
  period: {
    start: string;
    end: string;
  };
}

export class NoShowDetectionService {
  private supabase = getSupabaseClient();
  private stateMachine = new ReservationStateMachine();

  // Default configuration
  private readonly defaultConfig: NoShowConfig = {
    defaultGracePeriod: 30, // 30 minutes default
    serviceTypeGracePeriods: {
      nail: 45, // Nail services get 45 minutes
      eyelash: 60, // Eyelash services get 60 minutes
      waxing: 30, // Waxing services get 30 minutes
      eyebrow_tattoo: 60, // Tattoo services get 60 minutes
      hair: 45, // Hair services get 45 minutes
    },
    penaltyPoints: 50, // 50 points penalty for no-show
    maxPenaltyPoints: 200, // Maximum penalty points per user
    notificationDelay: 15, // Send notification 15 minutes after reservation time
    autoDetectionEnabled: true,
    manualOverrideEnabled: true,
  };

  /**
   * Get grace period for a specific service type
   */
  private getGracePeriodForService(serviceCategory: string): number {
    return this.defaultConfig.serviceTypeGracePeriods[serviceCategory] || 
           this.defaultConfig.defaultGracePeriod;
  }

  /**
   * Check if a reservation should be marked as no-show
   */
  private async shouldMarkAsNoShow(
    reservation: Reservation,
    gracePeriod: number
  ): Promise<boolean> {
    const reservationTime = new Date(reservation.reservation_datetime);
    const currentTime = new Date();
    const timeDifference = currentTime.getTime() - reservationTime.getTime();
    const gracePeriodMs = gracePeriod * 60 * 1000; // Convert to milliseconds

    // Check if reservation is confirmed and past the grace period
    return reservation.status === 'confirmed' && timeDifference > gracePeriodMs;
  }

  /**
   * Get reservations that need no-show detection
   */
  private async getReservationsForNoShowDetection(): Promise<ReservationWithServices[]> {
    const now = new Date();
    const thirtyMinutesAgo = new Date(now.getTime() - 30 * 60 * 1000);
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

    const { data: reservations, error } = await this.supabase
      .from('reservations')
      .select(`
        *,
        reservation_services!inner(
          service_id,
          shop_services!inner(
            category
          )
        )
      `)
      .eq('status', 'confirmed')
      .gte('reservation_datetime', twoHoursAgo.toISOString())
      .lte('reservation_datetime', thirtyMinutesAgo.toISOString())
      .order('reservation_datetime', { ascending: true });

    if (error) {
      logger.error('Error fetching reservations for no-show detection:', error);
      return [];
    }

    return reservations || [];
  }

  /**
   * Apply no-show penalty to user
   */
  private async applyNoShowPenalty(
    userId: string,
    penaltyPoints: number
  ): Promise<{
    success: boolean;
    penaltyApplied: number;
    errors: string[];
  }> {
    try {
      // Get current user points
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('available_points, total_points')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        return {
          success: false,
          penaltyApplied: 0,
          errors: ['User not found or error fetching user data']
        };
      }

      // Calculate penalty (don't go below 0)
      const currentPoints = user.available_points || 0;
      const penaltyToApply = Math.min(penaltyPoints, currentPoints);
      const newPoints = Math.max(0, currentPoints - penaltyToApply);

      // Update user points
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          available_points: newPoints,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        return {
          success: false,
          penaltyApplied: 0,
          errors: ['Error updating user points']
        };
      }

      // Log point transaction
      const { error: transactionError } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          transaction_type: 'adjusted',
          amount: -penaltyToApply,
          description: 'No-show penalty deduction',
          status: 'available',
          metadata: {
            reason: 'no_show_penalty',
            penalty_type: 'automatic'
          }
        });

      if (transactionError) {
        logger.error('Error logging point transaction:', transactionError);
        // Don't fail the whole operation for transaction logging error
      }

      return {
        success: true,
        penaltyApplied: penaltyToApply,
        errors: []
      };
    } catch (error) {
      logger.error('Error applying no-show penalty:', error);
      return {
        success: false,
        penaltyApplied: 0,
        errors: ['Unexpected error applying penalty']
      };
    }
  }

  /**
   * Send no-show notification to user
   */
  private async sendNoShowNotification(
    reservation: Reservation,
    penaltyApplied: number
  ): Promise<boolean> {
    try {
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: reservation.user_id,
          notification_type: 'system',
          title: 'No-Show Reservation',
          message: `Your reservation on ${new Date(reservation.reservation_datetime).toLocaleDateString()} at ${new Date(reservation.reservation_datetime).toLocaleTimeString()} has been marked as no-show. ${penaltyApplied > 0 ? `${penaltyApplied} points have been deducted as penalty.` : ''}`,
          status: 'unread',
          related_id: reservation.id,
          metadata: {
            type: 'no_show_notification',
            penalty_applied: penaltyApplied
          }
        });

      if (error) {
        logger.error('Error sending no-show notification:', error);
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error sending no-show notification:', error);
      return false;
    }
  }

  /**
   * Log no-show detection action
   */
  private async logNoShowAction(
    reservationId: string,
    action: 'automatic_detection' | 'manual_override',
    details: Record<string, any>
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('reservation_status_logs')
        .insert({
          reservation_id: reservationId,
          from_status: 'confirmed',
          to_status: 'no_show',
          changed_by: action === 'automatic_detection' ? 'system' : 'shop',
          changed_by_id: action === 'automatic_detection' ? 'system' : details.overrideById,
          reason: details.reason || 'No-show detected',
          metadata: {
            action_type: action,
            grace_period: details.gracePeriod,
            penalty_applied: details.penaltyApplied,
            notification_sent: details.notificationSent,
            ...details
          }
        });

      if (error) {
        logger.error('Error logging no-show action:', error);
      }
    } catch (error) {
      logger.error('Error logging no-show action:', error);
    }
  }

  /**
   * Process automatic no-show detection
   */
  async processAutomaticNoShowDetection(): Promise<{
    processed: number;
    noShowsDetected: number;
    errors: string[];
    results: NoShowDetectionResult[];
  }> {
    if (!this.defaultConfig.autoDetectionEnabled) {
      logger.info('Automatic no-show detection is disabled');
      return {
        processed: 0,
        noShowsDetected: 0,
        errors: [],
        results: []
      };
    }

    logger.info('Starting automatic no-show detection...');

    const reservations = await this.getReservationsForNoShowDetection();
    const results: NoShowDetectionResult[] = [];
    const errors: string[] = [];
    let noShowsDetected = 0;

    for (const reservation of reservations) {
      try {
        // Get service category for grace period calculation
        const serviceCategory = reservation.reservation_services?.[0]?.shop_services?.category || 'nail';
        const gracePeriod = this.getGracePeriodForService(serviceCategory);

        // Check if should be marked as no-show
        const isNoShow = await this.shouldMarkAsNoShow(reservation, gracePeriod);

        if (isNoShow) {
          // Apply penalty
          const penaltyResult = await this.applyNoShowPenalty(
            reservation.user_id,
            this.defaultConfig.penaltyPoints
          );

          // Send notification
          const notificationSent = await this.sendNoShowNotification(
            reservation,
            penaltyResult.penaltyApplied
          );

          // Update reservation status
          const transitionResult = await this.stateMachine.executeTransition(
            reservation.id,
            'no_show',
            'system',
            'system',
            'Automatic no-show detection'
          );

          if (transitionResult.success) {
            // Log the action
            await this.logNoShowAction(reservation.id, 'automatic_detection', {
              gracePeriod,
              penaltyApplied: penaltyResult.penaltyApplied,
              notificationSent,
              serviceCategory
            });

            noShowsDetected++;
            results.push({
              reservationId: reservation.id,
              userId: reservation.user_id,
              shopId: reservation.shop_id,
              reservationTime: reservation.reservation_datetime,
              gracePeriod,
              isNoShow: true,
              reason: 'Automatic no-show detection',
              penaltyApplied: penaltyResult.penaltyApplied,
              notificationSent
            });

            logger.info(`No-show detected for reservation ${reservation.id}, penalty: ${penaltyResult.penaltyApplied} points`);
          } else {
            errors.push(`Failed to update reservation ${reservation.id}: ${transitionResult.errors.join(', ')}`);
          }
        } else {
          results.push({
            reservationId: reservation.id,
            userId: reservation.user_id,
            shopId: reservation.shop_id,
            reservationTime: reservation.reservation_datetime,
            gracePeriod,
            isNoShow: false,
            penaltyApplied: 0,
            notificationSent: false
          });
        }
      } catch (error) {
        const errorMsg = `Error processing reservation ${reservation.id}: ${error}`;
        logger.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    logger.info(`No-show detection completed: ${reservations.length} processed, ${noShowsDetected} no-shows detected`);

    return {
      processed: reservations.length,
      noShowsDetected,
      errors,
      results
    };
  }

  /**
   * Manual override for no-show detection
   */
  async manualOverride(request: ManualOverrideRequest): Promise<{
    success: boolean;
    reservation?: Reservation;
    errors: string[];
  }> {
    if (!this.defaultConfig.manualOverrideEnabled) {
      return {
        success: false,
        errors: ['Manual override is disabled']
      };
    }

    try {
      // Validate the reservation exists and is in confirmed status
      const { data: reservation, error: fetchError } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('id', request.reservationId)
        .eq('status', 'confirmed')
        .single();

      if (fetchError || !reservation) {
        return {
          success: false,
          errors: ['Reservation not found or not in confirmed status']
        };
      }

      let targetStatus: ReservationStatus;
      let reason: string;

      switch (request.action) {
        case 'mark_attended':
          targetStatus = 'completed';
          reason = `Marked as attended by ${request.overrideBy}`;
          break;
        case 'mark_no_show':
          targetStatus = 'no_show';
          reason = `Manually marked as no-show by ${request.overrideBy}`;
          break;
        case 'extend_grace_period':
          // For extend grace period, we don't change status but log the action
          await this.logNoShowAction(request.reservationId, 'manual_override', {
            action: 'extend_grace_period',
            extendedGracePeriod: request.extendedGracePeriod,
            reason: request.reason,
            overrideBy: request.overrideBy,
            overrideById: request.overrideById
          });
          return {
            success: true,
            errors: []
          };
        default:
          return {
            success: false,
            errors: ['Invalid action specified']
          };
      }

      // Execute the transition
      const transitionResult = await this.stateMachine.executeTransition(
        request.reservationId,
        targetStatus,
        request.overrideBy,
        request.overrideById,
        reason
      );

      if (transitionResult.success) {
        // Log the manual override
        await this.logNoShowAction(request.reservationId, 'manual_override', {
          action: request.action,
          reason: request.reason,
          overrideBy: request.overrideBy,
          overrideById: request.overrideById,
          extendedGracePeriod: request.extendedGracePeriod
        });

        const result: {
          success: boolean;
          reservation?: Reservation;
          errors: string[];
        } = {
          success: true,
          errors: []
        };
        
        if (transitionResult.reservation) {
          result.reservation = transitionResult.reservation;
        }
        
        return result;
      } else {
        return {
          success: false,
          errors: transitionResult.errors
        };
      }
    } catch (error) {
      logger.error('Error in manual override:', error);
      return {
        success: false,
        errors: [`Unexpected error: ${error}`]
      };
    }
  }

  /**
   * Get no-show statistics for a period
   */
  async getNoShowStatistics(
    startDate: string,
    endDate: string,
    shopId?: string
  ): Promise<NoShowStatistics> {
    try {
      let query = this.supabase
        .from('reservations')
        .select('*')
        .gte('reservation_datetime', startDate)
        .lte('reservation_datetime', endDate);

      if (shopId) {
        query = query.eq('shop_id', shopId);
      }

      const { data: reservations, error } = await query;

      if (error) {
        logger.error('Error fetching reservations for statistics:', error);
        throw error;
      }

      const totalReservations = reservations?.length || 0;
      const noShowReservations = reservations?.filter(r => r.status === 'no_show') || [];
      const noShowCount = noShowReservations.length;
      const noShowRate = totalReservations > 0 ? (noShowCount / totalReservations) * 100 : 0;

      // Calculate average grace period (this would need to be stored in logs)
      const averageGracePeriod = this.defaultConfig.defaultGracePeriod; // Default for now

      // Calculate total penalty points
      const totalPenaltyPoints = noShowCount * this.defaultConfig.penaltyPoints;

      return {
        totalReservations,
        noShowCount,
        noShowRate,
        averageGracePeriod,
        totalPenaltyPoints,
        period: {
          start: startDate,
          end: endDate
        }
      };
    } catch (error) {
      logger.error('Error calculating no-show statistics:', error);
      throw error;
    }
  }

  /**
   * Update no-show detection configuration
   */
  async updateConfiguration(config: Partial<NoShowConfig>): Promise<{
    success: boolean;
    errors: string[];
  }> {
    try {
      // Validate configuration
      if (config.defaultGracePeriod && config.defaultGracePeriod < 0) {
        return {
          success: false,
          errors: ['Default grace period must be positive']
        };
      }

      if (config.penaltyPoints && config.penaltyPoints < 0) {
        return {
          success: false,
          errors: ['Penalty points must be positive']
        };
      }

      // Update configuration (in a real implementation, this would be stored in database)
      Object.assign(this.defaultConfig, config);

      logger.info('No-show detection configuration updated:', config);

      return {
        success: true,
        errors: []
      };
    } catch (error) {
      logger.error('Error updating no-show configuration:', error);
      return {
        success: false,
        errors: [`Unexpected error: ${error}`]
      };
    }
  }

  /**
   * Get current configuration
   */
  getConfiguration(): NoShowConfig {
    return { ...this.defaultConfig };
  }
}

// Export singleton instance
export const noShowDetectionService = new NoShowDetectionService(); 