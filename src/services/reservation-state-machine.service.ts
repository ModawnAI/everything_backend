/**
 * Reservation State Machine Service
 * 
 * Comprehensive state machine for managing reservation lifecycle with:
 * - State transition validation with business rules
 * - Automatic state progression based on time and events
 * - State change audit logging with timestamps and reasons
 * - Rollback mechanisms for invalid state transitions
 * - Business rule enforcement for each transition
 */

import { getSupabaseClient } from '../config/database';
import { ReservationStatus, Reservation } from '../types/database.types';
import { logger } from '../utils/logger';

// State transition interface
export interface StateTransition {
  from: ReservationStatus;
  to: ReservationStatus;
  allowedBy: 'user' | 'shop' | 'system' | 'admin';
  requiresReason: boolean;
  requiresApproval: boolean;
  autoTransition?: boolean;
  conditions?: {
    timeThreshold?: number; // minutes
    paymentRequired?: boolean;
    maxTimeBeforeReservation?: number; // hours
    minTimeBeforeReservation?: number; // hours
  };
  businessRules?: string[];
  notifications?: {
    user?: boolean;
    shop?: boolean;
    admin?: boolean;
  };
}

// State change audit log interface
export interface StateChangeLog {
  id: string;
  reservationId: string;
  fromStatus: ReservationStatus;
  toStatus: ReservationStatus;
  changedBy: 'user' | 'shop' | 'system' | 'admin';
  changedById: string;
  reason?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// State machine configuration
export class ReservationStateMachine {
  private supabase = getSupabaseClient();

  // State transition rules
  private readonly stateTransitions: StateTransition[] = [
    // Requested -> Confirmed (Shop confirms reservation)
    {
      from: 'requested',
      to: 'confirmed',
      allowedBy: 'shop',
      requiresReason: false,
      requiresApproval: false,
      conditions: {
        paymentRequired: true,
        maxTimeBeforeReservation: 24, // Must confirm at least 24 hours before
      },
      businessRules: [
        'Payment must be completed before confirmation',
        'Shop must confirm within 24 hours of reservation time',
        'Time slot must still be available'
      ],
      notifications: {
        user: true,
        shop: false,
        admin: false
      }
    },

    // Requested -> Cancelled by User
    {
      from: 'requested',
      to: 'cancelled_by_user',
      allowedBy: 'user',
      requiresReason: true,
      requiresApproval: false,
      conditions: {
        minTimeBeforeReservation: 2, // Must cancel at least 2 hours before
      },
      businessRules: [
        'User can cancel up to 2 hours before reservation time',
        'Refund policy applies based on cancellation time',
        'Points used will be refunded'
      ],
      notifications: {
        user: false,
        shop: true,
        admin: false
      }
    },

    // Requested -> Cancelled by Shop
    {
      from: 'requested',
      to: 'cancelled_by_shop',
      allowedBy: 'shop',
      requiresReason: true,
      requiresApproval: false,
      conditions: {
        minTimeBeforeReservation: 1, // Must cancel at least 1 hour before
      },
      businessRules: [
        'Shop must provide valid reason for cancellation',
        'Full refund must be processed',
        'User must be notified immediately'
      ],
      notifications: {
        user: true,
        shop: false,
        admin: true
      }
    },

    // Confirmed -> Completed (Automatic or manual)
    {
      from: 'confirmed',
      to: 'completed',
      allowedBy: 'shop',
      requiresReason: false,
      requiresApproval: false,
      autoTransition: true,
      conditions: {
        timeThreshold: 30, // Auto-complete 30 minutes after reservation time
      },
      businessRules: [
        'Service must be completed',
        'Points will be earned based on service amount',
        'Review can be requested'
      ],
      notifications: {
        user: true,
        shop: false,
        admin: false
      }
    },

    // Confirmed -> No Show (Automatic)
    {
      from: 'confirmed',
      to: 'no_show',
      allowedBy: 'system',
      requiresReason: false,
      requiresApproval: false,
      autoTransition: true,
      conditions: {
        timeThreshold: 30, // Mark as no-show 30 minutes after reservation time
      },
      businessRules: [
        'User did not show up for appointment',
        'No refund will be provided',
        'User may be charged no-show fee',
        'Points used will not be refunded'
      ],
      notifications: {
        user: true,
        shop: true,
        admin: true
      }
    },

    // Confirmed -> Cancelled by User
    {
      from: 'confirmed',
      to: 'cancelled_by_user',
      allowedBy: 'user',
      requiresReason: true,
      requiresApproval: false,
      conditions: {
        minTimeBeforeReservation: 2, // Must cancel at least 2 hours before
      },
      businessRules: [
        'User can cancel up to 2 hours before reservation time',
        'Partial refund may apply based on cancellation time',
        'Cancellation fee may apply'
      ],
      notifications: {
        user: false,
        shop: true,
        admin: false
      }
    },

    // Confirmed -> Cancelled by Shop
    {
      from: 'confirmed',
      to: 'cancelled_by_shop',
      allowedBy: 'shop',
      requiresReason: true,
      requiresApproval: false,
      conditions: {
        minTimeBeforeReservation: 1, // Must cancel at least 1 hour before
      },
      businessRules: [
        'Shop must provide valid reason for cancellation',
        'Full refund must be processed',
        'User must be notified immediately'
      ],
      notifications: {
        user: true,
        shop: false,
        admin: true
      }
    },

    // Completed -> No Show (Manual override)
    {
      from: 'completed',
      to: 'no_show',
      allowedBy: 'admin',
      requiresReason: true,
      requiresApproval: true,
      businessRules: [
        'Admin override only',
        'Requires investigation and approval',
        'May affect user account status'
      ],
      notifications: {
        user: true,
        shop: true,
        admin: true
      }
    },

    // No Show -> Completed (Manual override)
    {
      from: 'no_show',
      to: 'completed',
      allowedBy: 'admin',
      requiresReason: true,
      requiresApproval: true,
      businessRules: [
        'Admin override only',
        'Requires investigation and approval',
        'May restore user benefits'
      ],
      notifications: {
        user: true,
        shop: true,
        admin: true
      }
    }
  ];

  /**
   * Validate if a state transition is allowed
   */
  async validateTransition(
    reservationId: string,
    fromStatus: ReservationStatus,
    toStatus: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    businessRules: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const businessRules: string[] = [];

    // Find the transition rule
    const transition = this.stateTransitions.find(
      t => t.from === fromStatus && t.to === toStatus
    );

    if (!transition) {
      errors.push(`Invalid transition from ${fromStatus} to ${toStatus}`);
      return { isValid: false, errors, warnings, businessRules };
    }

    // Check if the user is allowed to make this transition
    if (transition.allowedBy !== changedBy && transition.allowedBy !== 'system') {
      errors.push(`${changedBy} is not allowed to transition from ${fromStatus} to ${toStatus}`);
    }

    // Check if reason is required
    if (transition.requiresReason && !reason) {
      errors.push('Reason is required for this transition');
    }

    // Get reservation details for business rule validation
    const reservation = await this.getReservationById(reservationId);
    if (!reservation) {
      errors.push('Reservation not found');
      return { isValid: false, errors, warnings, businessRules };
    }

    // Validate business rules
    const ruleValidation = await this.validateBusinessRules(transition, reservation, changedBy, changedById);
    errors.push(...ruleValidation.errors);
    warnings.push(...ruleValidation.warnings);
    businessRules.push(...transition.businessRules || []);

    // Check time-based conditions
    const timeValidation = await this.validateTimeConditions(transition, reservation);
    errors.push(...timeValidation.errors);
    warnings.push(...timeValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      businessRules
    };
  }

  /**
   * Execute a state transition using atomic database functions
   */
  async executeTransition(
    reservationId: string,
    toStatus: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    reservation?: Reservation;
    errors: string[];
    warnings: string[];
  }> {
    try {
      // Get current reservation
      const reservation = await this.getReservationById(reservationId);
      if (!reservation) {
        return {
          success: false,
          errors: ['Reservation not found'],
          warnings: []
        };
      }

      // Validate transition
      const validation = await this.validateTransition(
        reservationId,
        reservation.status,
        toStatus,
        changedBy,
        changedById,
        reason
      );

      if (!validation.isValid) {
        return {
          success: false,
          errors: validation.errors,
          warnings: validation.warnings
        };
      }

      // Use atomic database function for state transition
      const { data: transitionResult, error: transitionError } = await this.supabase.rpc(
        'transition_reservation_status_enhanced',
        {
          p_reservation_id: reservationId,
          p_to_status: toStatus,
          p_changed_by: changedBy,
          p_changed_by_id: changedById,
          p_reason: reason || null,
          p_metadata: metadata || {},
          p_business_context: {
            business_rules: validation.businessRules,
            validation_warnings: validation.warnings
          },
          p_system_context: {
            user_agent: 'reservation-state-machine',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
          }
        }
      );

      if (transitionError) {
        logger.error('Database state transition failed', {
          reservationId,
          toStatus,
          changedBy,
          changedById,
          error: transitionError.message
        });

        return {
          success: false,
          errors: ['Database state transition failed'],
          warnings: validation.warnings
        };
      }

      // Get updated reservation
      const updatedReservation = await this.getReservationById(reservationId);

      // Send notifications
      await this.sendNotifications(validation.businessRules, updatedReservation, changedBy);

      return {
        success: true,
        reservation: updatedReservation,
        errors: [],
        warnings: validation.warnings
      };

    } catch (error) {
      logger.error('Failed to execute state transition', {
        reservationId,
        toStatus,
        changedBy,
        changedById,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        errors: ['Failed to execute state transition'],
        warnings: []
      };
    }
  }

  /**
   * Get all possible transitions for a reservation
   */
  async getAvailableTransitions(
    reservationId: string,
    userRole: 'user' | 'shop' | 'admin'
  ): Promise<{
    transitions: StateTransition[];
    currentStatus: ReservationStatus;
  }> {
    const reservation = await this.getReservationById(reservationId);
    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const availableTransitions = this.stateTransitions.filter(
      transition => transition.from === reservation.status && 
                  (transition.allowedBy === userRole || transition.allowedBy === 'system')
    );

    return {
      transitions: availableTransitions,
      currentStatus: reservation.status
    };
  }

  /**
   * Process automatic transitions based on time using database functions
   */
  async processAutomaticTransitions(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Use the comprehensive cleanup function from the database
      const { data: cleanupResult, error: cleanupError } = await this.supabase.rpc(
        'comprehensive_reservation_cleanup'
      );

      if (cleanupError) {
        errors.push(`Failed to run comprehensive cleanup: ${cleanupError.message}`);
        return { processed, errors };
      }

      // Extract results from cleanup
      const noShowCount = cleanupResult?.no_show_detection?.no_show_count || 0;
      const expiredCount = cleanupResult?.expired_cleanup?.expired_count || 0;
      
      processed = noShowCount + expiredCount;

      logger.info('Automatic transitions processed', {
        noShowCount,
        expiredCount,
        totalProcessed: processed
      });

    } catch (error) {
      errors.push(`Failed to process automatic transitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { processed, errors };
  }


  /**
   * Validate business rules for a transition
   */
  private async validateBusinessRules(
    transition: StateTransition,
    reservation: Reservation,
    changedBy: string,
    changedById: string
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check payment requirements
    if (transition.conditions?.paymentRequired) {
      const paymentStatus = await this.getPaymentStatus(reservation.id);
      if (paymentStatus !== 'fully_paid' && paymentStatus !== 'deposit_paid') {
        errors.push('Payment must be completed before this transition');
      }
    }

    // Check if user has permission to make this change
    if (changedBy === 'user' && reservation.user_id !== changedById) {
      errors.push('User can only modify their own reservations');
    }

    if (changedBy === 'shop') {
      const shopOwnership = await this.validateShopOwnership(reservation.shop_id, changedById);
      if (!shopOwnership) {
        errors.push('Shop can only modify their own reservations');
      }
    }

    return { errors, warnings };
  }

  /**
   * Validate time-based conditions
   */
  private async validateTimeConditions(
    transition: StateTransition,
    reservation: Reservation
  ): Promise<{
    errors: string[];
    warnings: string[];
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const reservationTime = new Date(reservation.reservation_datetime);
    const now = new Date();
    const timeDiff = reservationTime.getTime() - now.getTime();
    const hoursDiff = timeDiff / (1000 * 60 * 60);
    const minutesDiff = timeDiff / (1000 * 60);

    // Check minimum time before reservation
    if (transition.conditions?.minTimeBeforeReservation) {
      if (hoursDiff < transition.conditions.minTimeBeforeReservation) {
        errors.push(`Must cancel at least ${transition.conditions.minTimeBeforeReservation} hours before reservation time`);
      }
    }

    // Check maximum time before reservation
    if (transition.conditions?.maxTimeBeforeReservation) {
      if (hoursDiff > transition.conditions.maxTimeBeforeReservation) {
        errors.push(`Must confirm within ${transition.conditions.maxTimeBeforeReservation} hours of reservation time`);
      }
    }

    return { errors, warnings };
  }


  /**
   * Send notifications based on transition
   */
  private async sendNotifications(
    businessRules: string[],
    reservation: Reservation,
    changedBy: 'user' | 'shop' | 'system' | 'admin'
  ): Promise<void> {
    // This would integrate with the notification service
    // For now, we'll just log the notification
    logger.info('Sending notifications for state change', {
      reservationId: reservation.id,
      status: reservation.status,
      changedBy,
      businessRules
    });
  }

  /**
   * Get reservation by ID
   */
  private async getReservationById(reservationId: string): Promise<Reservation | null> {
    const { data, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .single();

    if (error) {
      logger.error('Failed to get reservation', { reservationId, error: error.message });
      return null;
    }

    return data as Reservation;
  }

  /**
   * Get payment status for a reservation
   */
  private async getPaymentStatus(reservationId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('payment_status')
      .eq('reservation_id', reservationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return 'pending';
    }

    return data.payment_status;
  }

  /**
   * Validate shop ownership
   */
  private async validateShopOwnership(shopId: string, userId: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('shops')
      .select('owner_id')
      .eq('id', shopId)
      .single();

    if (error || !data) {
      return false;
    }

    return data.owner_id === userId;
  }

  /**
   * Get comprehensive state change history for a reservation using enhanced audit trail
   */
  async getStateChangeHistory(reservationId: string): Promise<StateChangeLog[]> {
    const { data, error } = await this.supabase.rpc(
      'get_reservation_audit_trail',
      {
        p_reservation_id: reservationId
      }
    );

    if (error) {
      logger.error('Failed to get state change history', { reservationId, error: error.message });
      return [];
    }

    return data as StateChangeLog[];
  }

  /**
   * Get state transition statistics
   */
  async getStateTransitionStatistics(
    dateFrom?: string,
    dateTo?: string,
    shopId?: string,
    changedBy?: string
  ): Promise<any[]> {
    const { data, error } = await this.supabase.rpc(
      'get_state_transition_statistics',
      {
        p_date_from: dateFrom || null,
        p_date_to: dateTo || null,
        p_shop_id: shopId || null,
        p_changed_by: changedBy || null
      }
    );

    if (error) {
      logger.error('Failed to get state transition statistics', { error: error.message });
      return [];
    }

    return data || [];
  }

  /**
   * Execute bulk state transitions using database functions
   */
  async bulkTransitionReservations(
    reservationIds: string[],
    toStatus: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string,
    metadata?: Record<string, any>
  ): Promise<{
    success: boolean;
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    failures: any[];
    errors: string[];
  }> {
    try {
      const { data: bulkResult, error: bulkError } = await this.supabase.rpc(
        'bulk_transition_reservations',
        {
          p_reservation_ids: reservationIds,
          p_to_status: toStatus,
          p_changed_by: changedBy,
          p_changed_by_id: changedById,
          p_reason: reason || null,
          p_metadata: metadata || {}
        }
      );

      if (bulkError) {
        return {
          success: false,
          totalProcessed: 0,
          successCount: 0,
          failureCount: 0,
          failures: [],
          errors: [`Bulk transition failed: ${bulkError.message}`]
        };
      }

      return {
        success: true,
        totalProcessed: bulkResult.total_processed,
        successCount: bulkResult.success_count,
        failureCount: bulkResult.failure_count,
        failures: bulkResult.failures,
        errors: []
      };

    } catch (error) {
      return {
        success: false,
        totalProcessed: 0,
        successCount: 0,
        failureCount: 0,
        failures: [],
        errors: [`Bulk transition failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Rollback a state change (admin only)
   */
  async rollbackStateChange(
    reservationId: string,
    targetStatus: ReservationStatus,
    adminId: string,
    reason: string
  ): Promise<{
    success: boolean;
    reservation?: Reservation;
    errors: string[];
  }> {
    try {
      const reservation = await this.getReservationById(reservationId);
      if (!reservation) {
        return {
          success: false,
          errors: ['Reservation not found']
        };
      }

      // Only allow rollback to previous states
      const allowedRollbackStates: ReservationStatus[] = ['requested', 'confirmed'];
      if (!allowedRollbackStates.includes(targetStatus)) {
        return {
          success: false,
          errors: [`Cannot rollback to status: ${targetStatus}`]
        };
      }

      const result = await this.executeTransition(
        reservationId,
        targetStatus,
        'admin',
        adminId,
        `Rollback: ${reason}`,
        {
          rollback: true,
          original_status: reservation.status,
          rollback_reason: reason
        }
      );

      return result;
    } catch (error) {
      return {
        success: false,
        errors: [`Rollback failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }
}

// Export singleton instance
export const reservationStateMachine = new ReservationStateMachine(); 