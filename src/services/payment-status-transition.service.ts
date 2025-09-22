/**
 * Payment Status Transition Service
 * 
 * Handles validation and management of payment status transitions
 * for the two-stage payment system.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { PaymentStatus, Payment } from '../types/database.types';

export type PaymentStage = 'deposit' | 'final' | 'single';
export type PaymentStatusTransition = {
  from: PaymentStatus;
  to: PaymentStatus;
  stage: PaymentStage;
  isValid: boolean;
  reason?: string;
};

export interface PaymentTransitionResult {
  success: boolean;
  newStatus: PaymentStatus;
  warnings: string[];
  errors: string[];
  metadata?: Record<string, any>;
}

export class PaymentStatusTransitionService {
  private supabase = getSupabaseClient();

  // Valid status transitions for each payment stage
  private readonly validTransitions: Record<PaymentStage, Array<{from: PaymentStatus, to: PaymentStatus, reason?: string}>> = {
    deposit: [
      { from: 'pending', to: 'deposit_paid', reason: 'Deposit payment completed successfully' },
      { from: 'pending', to: 'failed', reason: 'Deposit payment failed' },
      { from: 'deposit_paid', to: 'deposit_refunded', reason: 'Deposit refunded due to cancellation' },
      { from: 'deposit_paid', to: 'final_payment_pending', reason: 'Deposit paid, final payment now pending' },
      { from: 'failed', to: 'pending', reason: 'Retry failed deposit payment' }
    ],
    final: [
      { from: 'pending', to: 'fully_paid', reason: 'Final payment completed successfully' },
      { from: 'pending', to: 'failed', reason: 'Final payment failed' },
      { from: 'final_payment_pending', to: 'fully_paid', reason: 'Final payment completed after deposit' },
      { from: 'final_payment_pending', to: 'overdue', reason: 'Final payment is now overdue' },
      { from: 'fully_paid', to: 'final_payment_refunded', reason: 'Final payment refunded' },
      { from: 'overdue', to: 'fully_paid', reason: 'Overdue payment completed' },
      { from: 'failed', to: 'pending', reason: 'Retry failed final payment' }
    ],
    single: [
      { from: 'pending', to: 'fully_paid', reason: 'Single payment completed successfully' },
      { from: 'pending', to: 'failed', reason: 'Single payment failed' },
      { from: 'fully_paid', to: 'refunded', reason: 'Full refund processed' },
      { from: 'fully_paid', to: 'partially_refunded', reason: 'Partial refund processed' },
      { from: 'failed', to: 'pending', reason: 'Retry failed single payment' }
    ]
  };

  /**
   * Validates if a payment status transition is allowed
   */
  public validateTransition(
    currentStatus: PaymentStatus,
    newStatus: PaymentStatus,
    paymentStage: PaymentStage,
    context?: Record<string, any>
  ): PaymentTransitionResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    // Check if transition is valid for the payment stage
    const validTransition = this.validTransitions[paymentStage].find(
      transition => transition.from === currentStatus && transition.to === newStatus
    );

    if (!validTransition) {
      errors.push(`Invalid transition from ${currentStatus} to ${newStatus} for ${paymentStage} payment stage`);
      return {
        success: false,
        newStatus: currentStatus,
        warnings,
        errors
      };
    }

    // Additional business logic validations
    if (newStatus === 'overdue' && paymentStage === 'final') {
      const dueDate = context?.dueDate;
      if (!dueDate) {
        errors.push('Cannot mark payment as overdue without a due date');
        return {
          success: false,
          newStatus: currentStatus,
          warnings,
          errors
        };
      }

      const dueDateObj = new Date(dueDate);
      const now = new Date();
      if (dueDateObj > now) {
        warnings.push('Payment is being marked as overdue before the due date');
      }
    }

    // Validate refund transitions
    if (['deposit_refunded', 'final_payment_refunded', 'refunded', 'partially_refunded'].includes(newStatus)) {
      if (!context?.refundAmount || context.refundAmount <= 0) {
        errors.push('Refund amount must be specified and greater than 0');
        return {
          success: false,
          newStatus: currentStatus,
          warnings,
          errors
        };
      }

      if (newStatus === 'partially_refunded' && context.refundAmount >= context.originalAmount) {
        warnings.push('Partial refund amount is equal to or greater than original amount, consider using full refund');
      }
    }

    // Validate payment completion transitions
    if (['deposit_paid', 'fully_paid'].includes(newStatus)) {
      if (!context?.paymentAmount || context.paymentAmount <= 0) {
        errors.push('Payment amount must be specified and greater than 0');
        return {
          success: false,
          newStatus: currentStatus,
          warnings,
          errors
        };
      }
    }

    return {
      success: true,
      newStatus,
      warnings,
      errors,
      metadata: {
        transitionReason: validTransition.reason,
        validatedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Executes a payment status transition with validation
   */
  public async executeTransition(
    paymentId: string,
    newStatus: PaymentStatus,
    paymentStage: PaymentStage,
    context?: Record<string, any>
  ): Promise<PaymentTransitionResult> {
    try {
      // Get current payment record
      const { data: currentPayment, error: fetchError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (fetchError || !currentPayment) {
        return {
          success: false,
          newStatus: currentPayment?.payment_status || 'pending',
          errors: [`Failed to fetch payment: ${fetchError?.message || 'Payment not found'}`],
          warnings: []
        };
      }

      // Validate the transition
      const validationResult = this.validateTransition(
        currentPayment.payment_status as PaymentStatus,
        newStatus,
        paymentStage,
        context
      );

      if (!validationResult.success) {
        return validationResult;
      }

      // Execute the transition
      const updateData: any = {
        payment_status: newStatus,
        updated_at: new Date().toISOString(),
        version: currentPayment.version + 1
      };

      // Set due date for deposit payments
      if (paymentStage === 'deposit' && newStatus === 'deposit_paid') {
        const gracePeriodHours = context?.gracePeriodHours || 168; // 7 days default
        updateData.due_date = new Date(Date.now() + gracePeriodHours * 60 * 60 * 1000).toISOString();
      }

      // Clear due date for completed payments
      if (newStatus === 'fully_paid') {
        updateData.due_date = null;
      }

      // Update payment record
      const { data: updatedPayment, error: updateError } = await this.supabase
        .from('payments')
        .update(updateData)
        .eq('id', paymentId)
        .eq('version', currentPayment.version) // Optimistic locking
        .select()
        .single();

      if (updateError) {
        if (updateError.code === 'PGRST301') {
          return {
            success: false,
            newStatus: currentPayment.payment_status as PaymentStatus,
            errors: ['Payment was modified by another process, please retry'],
            warnings: []
          };
        }

        return {
          success: false,
          newStatus: currentPayment.payment_status as PaymentStatus,
          errors: [`Failed to update payment: ${updateError.message}`],
          warnings: []
        };
      }

      logger.info('Payment status transition executed successfully', {
        paymentId,
        from: currentPayment.payment_status,
        to: newStatus,
        stage: paymentStage,
        warnings: validationResult.warnings
      });

      return {
        success: true,
        newStatus,
        warnings: validationResult.warnings,
        errors: [],
        metadata: {
          ...validationResult.metadata,
          updatedPayment,
          transitionExecutedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      logger.error('Error executing payment status transition', {
        paymentId,
        newStatus,
        paymentStage,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        success: false,
        newStatus: 'failed',
        errors: [error instanceof Error ? error.message : 'Unknown error occurred'],
        warnings: []
      };
    }
  }

  /**
   * Gets the current payment status summary for a reservation
   */
  public async getReservationPaymentSummary(reservationId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_reservation_payment_summary', {
        p_reservation_id: reservationId
      });

      if (error) {
        throw new Error(`Failed to get payment summary: ${error.message}`);
      }

      return data?.[0] || null;
    } catch (error) {
      logger.error('Error getting reservation payment summary', {
        reservationId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Gets all valid transitions for a given payment status and stage
   */
  public getValidTransitions(currentStatus: PaymentStatus, paymentStage: PaymentStage): PaymentStatusTransition[] {
    const transitions = this.validTransitions[paymentStage]
      .filter(transition => transition.from === currentStatus)
      .map(transition => ({
        from: transition.from,
        to: transition.to,
        stage: paymentStage,
        isValid: true,
        reason: transition.reason
      }));

    return transitions;
  }

  /**
   * Checks if a payment is overdue
   */
  public async checkOverduePayments(): Promise<Payment[]> {
    try {
      const { data, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('payment_stage', 'final')
        .eq('payment_status', 'final_payment_pending')
        .lt('due_date', new Date().toISOString())
        .is('refunded_at', null);

      if (error) {
        throw new Error(`Failed to fetch overdue payments: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error checking overdue payments', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Marks overdue payments as overdue
   */
  public async markOverduePayments(): Promise<{ updated: number; errors: string[] }> {
    try {
      const overduePayments = await this.checkOverduePayments();
      let updated = 0;
      const errors: string[] = [];

      for (const payment of overduePayments) {
        const result = await this.executeTransition(
          payment.id,
          'overdue',
          'final' as PaymentStage,
          {
            dueDate: payment.due_date,
            originalAmount: payment.amount
          }
        );

        if (result.success) {
          updated++;
        } else {
          errors.push(`Failed to mark payment ${payment.id} as overdue: ${result.errors.join(', ')}`);
        }
      }

      logger.info('Overdue payment marking completed', {
        totalOverdue: overduePayments.length,
        updated,
        errors: errors.length
      });

      return { updated, errors };
    } catch (error) {
      logger.error('Error marking overdue payments', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

// Export singleton instance
export const paymentStatusTransitionService = new PaymentStatusTransitionService();
