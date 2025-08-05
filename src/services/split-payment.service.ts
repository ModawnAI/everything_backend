/**
 * Split Payment Service
 * 
 * Comprehensive service for split payment functionality including:
 * - Split payment plan creation and management
 * - Deposit and remaining balance payment processing
 * - Payment installment tracking and validation
 * - Automatic reminder scheduling and notifications
 * - Payment due date management and validation
 */

import { getSupabaseClient } from '../config/database';
import { tossPaymentsService, PaymentInitiationRequest } from './toss-payments.service';
import { paymentConfirmationService, EnhancedPaymentConfirmationRequest } from './payment-confirmation.service';
import { logger } from '../utils/logger';
import { 
  SplitPaymentPlan, 
  PaymentInstallment, 
  PaymentReminder,
  SplitPaymentStatus,
  InstallmentType,
  InstallmentStatus,
  ReminderType,
  ReminderStatus,
  PaymentStatus
} from '../types/database.types';

export interface CreateSplitPaymentPlanRequest {
  reservationId: string;
  userId: string;
  totalAmount: number;
  depositAmount: number;
  remainingDueDate: string; // ISO date string
}

export interface SplitPaymentPlanResponse {
  planId: string;
  depositInstallmentId: string;
  remainingInstallmentId: string;
  depositAmount: number;
  remainingAmount: number;
  remainingDueDate: string;
  status: SplitPaymentStatus;
}

export interface ProcessSplitPaymentRequest {
  planId: string;
  installmentId: string;
  paymentKey: string;
  orderId: string;
  amount: number;
  userId: string;
}

export interface SplitPaymentStatusResponse {
  planId: string;
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositStatus: InstallmentStatus;
  remainingStatus: InstallmentStatus;
  overallStatus: SplitPaymentStatus;
  depositPaidAt?: string | undefined;
  remainingPaidAt?: string | undefined;
  remainingDueDate: string;
  isOverdue: boolean;
  daysUntilDue: number;
}

export interface PaymentReminderSchedule {
  installmentId: string;
  userId: string;
  reminderType: ReminderType;
  scheduledAt: string;
  amount: number;
  dueDate: string;
}

export class SplitPaymentService {
  private supabase = getSupabaseClient();

  /**
   * Create a new split payment plan for a reservation
   */
  async createSplitPaymentPlan(request: CreateSplitPaymentPlanRequest): Promise<SplitPaymentPlanResponse> {
    const transactionId = `split_plan_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Creating split payment plan', {
        transactionId,
        reservationId: request.reservationId,
        userId: request.userId,
        totalAmount: request.totalAmount,
        depositAmount: request.depositAmount
      });

      // Validate amounts
      this.validateSplitPaymentAmounts(request.totalAmount, request.depositAmount);
      
      // Validate due date
      this.validateDueDate(request.remainingDueDate);

      // Check if split payment plan already exists for this reservation
      const existingPlan = await this.getSplitPaymentPlanByReservation(request.reservationId);
      if (existingPlan) {
        throw new Error('Split payment plan already exists for this reservation');
      }

      // Calculate remaining amount
      const remainingAmount = request.totalAmount - request.depositAmount;

      // Create split payment plan using database function
      const { data: planId, error: planError } = await this.supabase.rpc('create_split_payment_plan', {
        p_reservation_id: request.reservationId,
        p_user_id: request.userId,
        p_total_amount: request.totalAmount,
        p_deposit_amount: request.depositAmount,
        p_remaining_due_date: request.remainingDueDate
      });

      if (planError) {
        logger.error('Failed to create split payment plan', {
          transactionId,
          error: planError
        });
        throw new Error(`Failed to create split payment plan: ${planError.message}`);
      }

      // Get the created plan and installments
      const plan = await this.getSplitPaymentPlanById(planId);
      if (!plan) {
        throw new Error('Failed to create split payment plan');
      }
      
      const installments = await this.getInstallmentsByPlanId(planId);

      const depositInstallment = installments.find(i => i.installment_type === 'deposit');
      const remainingInstallment = installments.find(i => i.installment_type === 'remaining');

      if (!depositInstallment || !remainingInstallment) {
        throw new Error('Failed to create payment installments');
      }

      // Schedule payment reminders
      await this.schedulePaymentReminders(remainingInstallment.id, request.userId, remainingAmount, request.remainingDueDate);

      logger.info('Split payment plan created successfully', {
        transactionId,
        planId,
        depositInstallmentId: depositInstallment.id,
        remainingInstallmentId: remainingInstallment.id
      });

      return {
        planId,
        depositInstallmentId: depositInstallment.id,
        remainingInstallmentId: remainingInstallment.id,
        depositAmount: request.depositAmount,
        remainingAmount,
        remainingDueDate: request.remainingDueDate,
        status: plan.status
      };

    } catch (error) {
      logger.error('Error creating split payment plan', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process a payment for a specific installment
   */
  async processSplitPayment(request: ProcessSplitPaymentRequest): Promise<any> {
    const transactionId = `split_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Processing split payment', {
        transactionId,
        planId: request.planId,
        installmentId: request.installmentId,
        amount: request.amount
      });

      // Get the installment details
      const installment = await this.getInstallmentById(request.installmentId);
      if (!installment) {
        throw new Error('Installment not found');
      }

      // Validate installment ownership
      const plan = await this.getSplitPaymentPlanById(request.planId);
      if (!plan || plan.user_id !== request.userId) {
        throw new Error('Unauthorized access to installment');
      }

      // Validate amount
      if (installment.amount !== request.amount) {
        throw new Error('Payment amount does not match installment amount');
      }

      // Check if installment is already paid
      if (installment.status === 'paid') {
        throw new Error('Installment is already paid');
      }

      // Confirm payment with TossPayments
      const confirmRequest: EnhancedPaymentConfirmationRequest = {
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amount,
        userId: request.userId,
        sendNotification: true,
        generateReceipt: true
      };

      const confirmResponse = await paymentConfirmationService.confirmPaymentWithVerification(confirmRequest);

      // Update installment with payment information
      await this.updateInstallmentPayment(installment.id, confirmResponse.paymentId, confirmResponse.approvedAt);

      // Update split payment plan status
      await this.updateSplitPaymentPlanStatus(request.planId);

      // Cancel any pending reminders for this installment
      await this.cancelInstallmentReminders(installment.id);

      logger.info('Split payment processed successfully', {
        transactionId,
        installmentId: request.installmentId,
        paymentId: confirmResponse.paymentId
      });

      return {
        success: true,
        paymentId: confirmResponse.paymentId,
        installmentId: request.installmentId,
        status: confirmResponse.status
      };

    } catch (error) {
      logger.error('Error processing split payment', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get split payment status for a reservation
   */
  async getSplitPaymentStatus(reservationId: string, userId: string): Promise<SplitPaymentStatusResponse> {
    try {
      const plan = await this.getSplitPaymentPlanByReservation(reservationId);
      if (!plan || plan.user_id !== userId) {
        throw new Error('Split payment plan not found or unauthorized');
      }

      const installments = await this.getInstallmentsByPlanId(plan.id);
      const depositInstallment = installments.find(i => i.installment_type === 'deposit');
      const remainingInstallment = installments.find(i => i.installment_type === 'remaining');

      if (!depositInstallment || !remainingInstallment) {
        throw new Error('Installments not found');
      }

      const now = new Date();
      const dueDate = new Date(plan.remaining_due_date);
      const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      const isOverdue = remainingInstallment.status === 'overdue' || (daysUntilDue < 0 && remainingInstallment.status === 'pending');

      return {
        planId: plan.id,
        reservationId: plan.reservation_id,
        totalAmount: plan.total_amount,
        depositAmount: plan.deposit_amount,
        remainingAmount: plan.remaining_amount,
        depositStatus: depositInstallment.status,
        remainingStatus: remainingInstallment.status,
        overallStatus: plan.status,
        depositPaidAt: plan.deposit_paid_at,
        remainingPaidAt: plan.remaining_paid_at,
        remainingDueDate: plan.remaining_due_date,
        isOverdue,
        daysUntilDue
      };

    } catch (error) {
      logger.error('Error getting split payment status', {
        reservationId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Schedule payment reminders for an installment
   */
  async schedulePaymentReminders(
    installmentId: string, 
    userId: string, 
    amount: number, 
    dueDate: string
  ): Promise<void> {
    try {
      const dueDateTime = new Date(dueDate);
      const now = new Date();

      // Schedule reminders at different intervals
      const reminders: PaymentReminderSchedule[] = [
        {
          installmentId,
          userId,
          reminderType: 'upcoming',
          scheduledAt: new Date(dueDateTime.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days before
          amount,
          dueDate
        },
        {
          installmentId,
          userId,
          reminderType: 'due',
          scheduledAt: dueDateTime.toISOString(), // On due date
          amount,
          dueDate
        },
        {
          installmentId,
          userId,
          reminderType: 'overdue',
          scheduledAt: new Date(dueDateTime.getTime() + 24 * 60 * 60 * 1000).toISOString(), // 1 day after
          amount,
          dueDate
        },
        {
          installmentId,
          userId,
          reminderType: 'final',
          scheduledAt: new Date(dueDateTime.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days after
          amount,
          dueDate
        }
      ];

      // Only schedule reminders that are in the future
      const futureReminders = reminders.filter(r => new Date(r.scheduledAt) > now);

      for (const reminder of futureReminders) {
        await this.createPaymentReminder(reminder);
      }

      logger.info('Payment reminders scheduled', {
        installmentId,
        userId,
        remindersCount: futureReminders.length
      });

    } catch (error) {
      logger.error('Error scheduling payment reminders', {
        installmentId,
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get overdue installments
   */
  async getOverdueInstallments(): Promise<PaymentInstallment[]> {
    try {
      const { data, error } = await this.supabase
        .from('payment_installments')
        .select(`
          *,
          split_payment_plans!inner(
            reservation_id,
            user_id,
            total_amount,
            remaining_due_date
          )
        `)
        .eq('status', 'pending')
        .lt('due_date', new Date().toISOString());

      if (error) {
        throw new Error(`Failed to get overdue installments: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting overdue installments', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update installment status to overdue
   */
  async updateOverdueInstallments(): Promise<void> {
    try {
      const overdueInstallments = await this.getOverdueInstallments();
      
      for (const installment of overdueInstallments) {
        await this.updateInstallmentStatus(installment.id, 'overdue');
      }

      logger.info('Updated overdue installments', {
        count: overdueInstallments.length
      });
    } catch (error) {
      logger.error('Error updating overdue installments', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private validateSplitPaymentAmounts(totalAmount: number, depositAmount: number): void {
    if (totalAmount <= 0) {
      throw new Error('Total amount must be greater than 0');
    }
    if (depositAmount <= 0) {
      throw new Error('Deposit amount must be greater than 0');
    }
    if (depositAmount >= totalAmount) {
      throw new Error('Deposit amount must be less than total amount');
    }
  }

  private validateDueDate(dueDate: string): void {
    const due = new Date(dueDate);
    const now = new Date();
    
    if (due <= now) {
      throw new Error('Due date must be in the future');
    }
  }

  private async getSplitPaymentPlanById(planId: string): Promise<SplitPaymentPlan | null> {
    const { data, error } = await this.supabase
      .from('split_payment_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (error) {
      throw new Error(`Failed to get split payment plan: ${error.message}`);
    }

    return data;
  }

  private async getSplitPaymentPlanByReservation(reservationId: string): Promise<SplitPaymentPlan | null> {
    const { data, error } = await this.supabase
      .from('split_payment_plans')
      .select('*')
      .eq('reservation_id', reservationId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
      throw new Error(`Failed to get split payment plan: ${error.message}`);
    }

    return data;
  }

  private async getInstallmentsByPlanId(planId: string): Promise<PaymentInstallment[]> {
    const { data, error } = await this.supabase
      .from('payment_installments')
      .select('*')
      .eq('split_payment_plan_id', planId)
      .order('installment_number');

    if (error) {
      throw new Error(`Failed to get installments: ${error.message}`);
    }

    return data || [];
  }

  private async getInstallmentById(installmentId: string): Promise<PaymentInstallment | null> {
    const { data, error } = await this.supabase
      .from('payment_installments')
      .select('*')
      .eq('id', installmentId)
      .single();

    if (error) {
      throw new Error(`Failed to get installment: ${error.message}`);
    }

    return data;
  }

  private async updateInstallmentPayment(
    installmentId: string, 
    paymentId: string, 
    paidAt: string
  ): Promise<void> {
    const { error } = await this.supabase
      .from('payment_installments')
      .update({
        payment_id: paymentId,
        paid_at: paidAt,
        status: 'paid',
        updated_at: new Date().toISOString()
      })
      .eq('id', installmentId);

    if (error) {
      throw new Error(`Failed to update installment: ${error.message}`);
    }
  }

  private async updateInstallmentStatus(installmentId: string, status: InstallmentStatus): Promise<void> {
    const { error } = await this.supabase
      .from('payment_installments')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', installmentId);

    if (error) {
      throw new Error(`Failed to update installment status: ${error.message}`);
    }
  }

  private async updateSplitPaymentPlanStatus(planId: string): Promise<void> {
    // This will be handled by the database trigger, but we can also update manually if needed
    const { error } = await this.supabase
      .from('split_payment_plans')
      .update({
        updated_at: new Date().toISOString()
      })
      .eq('id', planId);

    if (error) {
      throw new Error(`Failed to update split payment plan: ${error.message}`);
    }
  }

  private async createPaymentReminder(reminder: PaymentReminderSchedule): Promise<void> {
    const { error } = await this.supabase
      .from('payment_reminders')
      .insert({
        installment_id: reminder.installmentId,
        user_id: reminder.userId,
        reminder_type: reminder.reminderType,
        scheduled_at: reminder.scheduledAt,
        status: 'scheduled'
      });

    if (error) {
      throw new Error(`Failed to create payment reminder: ${error.message}`);
    }
  }

  private async cancelInstallmentReminders(installmentId: string): Promise<void> {
    const { error } = await this.supabase
      .from('payment_reminders')
      .update({
        status: 'cancelled'
      })
      .eq('installment_id', installmentId)
      .eq('status', 'scheduled');

    if (error) {
      throw new Error(`Failed to cancel reminders: ${error.message}`);
    }
  }
}

// Export singleton instance
export const splitPaymentService = new SplitPaymentService(); 