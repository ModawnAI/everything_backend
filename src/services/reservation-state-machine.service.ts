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
   * Execute a state transition
   */
  async executeTransition(
    reservationId: string,
    toStatus: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string
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

      // Execute the transition
      const updatedReservation = await this.updateReservationStatus(
        reservationId,
        toStatus,
        changedBy,
        changedById,
        reason
      );

      // Log the state change
      await this.logStateChange(
        reservationId,
        reservation.status,
        toStatus,
        changedBy,
        changedById,
        reason
      );

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
   * Process automatic transitions based on time
   */
  async processAutomaticTransitions(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get reservations that need automatic transitions
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select('*')
        .in('status', ['confirmed'])
        .lt('reservation_datetime', new Date(Date.now() - 30 * 60 * 1000).toISOString()); // 30 minutes ago

      if (error) {
        throw error;
      }

      for (const reservation of reservations || []) {
        try {
          // Auto-complete confirmed reservations that are 30+ minutes old
          const result = await this.executeTransition(
            reservation.id,
            'completed',
            'system',
            'system',
            'Automatic completion after service time'
          );

          if (result.success) {
            processed++;
          } else {
            errors.push(`Failed to auto-complete reservation ${reservation.id}: ${result.errors.join(', ')}`);
          }
        } catch (error) {
          errors.push(`Error processing reservation ${reservation.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      // Process no-show transitions
      const noShowResult = await this.processNoShowTransitions();
      processed += noShowResult.processed;
      errors.push(...noShowResult.errors);

    } catch (error) {
      errors.push(`Failed to process automatic transitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { processed, errors };
  }

  /**
   * Process no-show transitions
   */
  private async processNoShowTransitions(): Promise<{
    processed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get confirmed reservations that are 30+ minutes old and haven't been completed
      const { data: reservations, error } = await this.supabase
        .from('reservations')
        .select('*')
        .eq('status', 'confirmed')
        .lt('reservation_datetime', new Date(Date.now() - 30 * 60 * 1000).toISOString());

      if (error) {
        throw error;
      }

      for (const reservation of reservations || []) {
        try {
          // Check if this reservation should be marked as no-show
          const shouldMarkAsNoShow = await this.shouldMarkAsNoShow(reservation.id);
          
          if (shouldMarkAsNoShow) {
            const result = await this.executeTransition(
              reservation.id,
              'no_show',
              'system',
              'system',
              'Automatic no-show detection'
            );

            if (result.success) {
              processed++;
            } else {
              errors.push(`Failed to mark reservation ${reservation.id} as no-show: ${result.errors.join(', ')}`);
            }
          }
        } catch (error) {
          errors.push(`Error processing no-show for reservation ${reservation.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (error) {
      errors.push(`Failed to process no-show transitions: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    return { processed, errors };
  }

  /**
   * Check if a reservation should be marked as no-show
   */
  private async shouldMarkAsNoShow(reservationId: string): Promise<boolean> {
    // This would implement business logic to determine if a reservation should be marked as no-show
    // For now, we'll use a simple time-based check
    const reservation = await this.getReservationById(reservationId);
    if (!reservation) return false;

    const reservationTime = new Date(reservation.reservation_datetime);
    const now = new Date();
    const timeDiff = now.getTime() - reservationTime.getTime();
    const minutesDiff = timeDiff / (1000 * 60);

    // Mark as no-show if 30+ minutes have passed since reservation time
    return minutesDiff >= 30;
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
   * Update reservation status in database
   */
  private async updateReservationStatus(
    reservationId: string,
    status: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string
  ): Promise<Reservation> {
    const updateData: any = {
      status,
      updated_at: new Date().toISOString()
    };

    // Set appropriate timestamp based on status
    switch (status) {
      case 'confirmed':
        updateData.confirmed_at = new Date().toISOString();
        break;
      case 'completed':
        updateData.completed_at = new Date().toISOString();
        break;
      case 'cancelled_by_user':
      case 'cancelled_by_shop':
        updateData.cancelled_at = new Date().toISOString();
        updateData.cancellation_reason = reason;
        break;
      case 'no_show':
        updateData.no_show_reason = reason || 'No-show detected automatically';
        break;
    }

    const { data, error } = await this.supabase
      .from('reservations')
      .update(updateData)
      .eq('id', reservationId)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update reservation status: ${error.message}`);
    }

    return data as Reservation;
  }

  /**
   * Log state change for audit trail
   */
  private async logStateChange(
    reservationId: string,
    fromStatus: ReservationStatus,
    toStatus: ReservationStatus,
    changedBy: 'user' | 'shop' | 'system' | 'admin',
    changedById: string,
    reason?: string
  ): Promise<void> {
    const logEntry = {
      reservation_id: reservationId,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedBy,
      changed_by_id: changedById,
      reason,
      timestamp: new Date().toISOString()
    };

    const { error } = await this.supabase
      .from('reservation_status_logs')
      .insert(logEntry);

    if (error) {
      logger.error('Failed to log state change', {
        reservationId,
        fromStatus,
        toStatus,
        error: error.message
      });
    }
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
   * Get state change history for a reservation
   */
  async getStateChangeHistory(reservationId: string): Promise<StateChangeLog[]> {
    const { data, error } = await this.supabase
      .from('reservation_status_logs')
      .select('*')
      .eq('reservation_id', reservationId)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error('Failed to get state change history', { reservationId, error: error.message });
      return [];
    }

    return data as StateChangeLog[];
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
        `Rollback: ${reason}`
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