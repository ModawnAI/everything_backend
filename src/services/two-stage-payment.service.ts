/**
 * Two-Stage Payment Service
 * 
 * Comprehensive service for managing two-stage payment flows:
 * - Deposit payment (20-30% of total amount)
 * - Final payment (remaining amount after service completion)
 * - Reservation status management throughout payment lifecycle
 * - Automatic payment triggers and reminders
 * - Payment flow validation and business rule enforcement
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { tossPaymentsService, PaymentInitiationRequest } from './toss-payments.service';
import { notificationService } from './notification.service';
import { PaymentStatus, ReservationStatus } from '../types/database.types';

export interface DepositPaymentRequest {
  reservationId: string;
  userId: string;
  depositAmount: number;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl?: string;
  failUrl?: string;
}

export interface FinalPaymentRequest {
  reservationId: string;
  userId: string;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl?: string;
  failUrl?: string;
}

export interface PaymentFlowResponse {
  success: boolean;
  paymentId: string;
  paymentKey: string;
  orderId: string;
  checkoutUrl: string;
  amount: number;
  paymentStage: 'deposit' | 'final';
  reservationStatus: ReservationStatus;
  message: string;
}

export interface PaymentStatusSummary {
  reservationId: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositStatus: PaymentStatus;
  finalPaymentStatus: PaymentStatus;
  overallStatus: string;
  isOverdue: boolean;
  daysUntilDue?: number;
  nextAction: string;
}

export interface AutoTriggerResult {
  triggered: boolean;
  paymentId?: string;
  message: string;
  error?: string;
}

export class TwoStagePaymentService {
  private supabase = getSupabaseClient();

  /**
   * Prepare deposit payment (20-30% of total amount)
   */
  async prepareDepositPayment(request: DepositPaymentRequest): Promise<PaymentFlowResponse> {
    try {
      logger.info('Preparing deposit payment', {
        reservationId: request.reservationId,
        userId: request.userId,
        depositAmount: request.depositAmount
      });

      // Get reservation details and validate
      const reservation = await this.getAndValidateReservation(
        request.reservationId, 
        request.userId
      );

      // Validate deposit amount (20-30% of total)
      this.validateDepositAmount(request.depositAmount, reservation.total_amount);

      // Check if deposit payment already exists
      await this.checkExistingPayment(request.reservationId, 'deposit');

      // Calculate remaining amount for final payment
      const remainingAmount = reservation.total_amount - request.depositAmount;

      // Update reservation with deposit information
      await this.updateReservationDepositInfo(
        request.reservationId,
        request.depositAmount,
        remainingAmount
      );

      // Prepare payment initiation request
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.depositAmount,
        isDeposit: true,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        successUrl: request.successUrl,
        failUrl: request.failUrl,
        paymentStage: 'deposit'
      };

      // Initialize payment with TossPayments
      const paymentResponse = await tossPaymentsService.initializePayment(paymentRequest);

      // Update reservation status to 'requested' (awaiting deposit payment)
      await this.updateReservationStatus(request.reservationId, 'requested');

      logger.info('Deposit payment prepared successfully', {
        reservationId: request.reservationId,
        paymentId: paymentResponse.paymentId,
        depositAmount: request.depositAmount,
        remainingAmount
      });

      return {
        success: true,
        paymentId: paymentResponse.paymentId,
        paymentKey: paymentResponse.paymentKey,
        orderId: paymentResponse.orderId,
        checkoutUrl: paymentResponse.checkoutUrl,
        amount: request.depositAmount,
        paymentStage: 'deposit',
        reservationStatus: 'requested',
        message: `예약금 ${request.depositAmount.toLocaleString()}원 결제를 진행해주세요.`
      };

    } catch (error) {
      logger.error('Error preparing deposit payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Prepare final payment (remaining amount after service completion)
   */
  async prepareFinalPayment(request: FinalPaymentRequest): Promise<PaymentFlowResponse> {
    try {
      logger.info('Preparing final payment', {
        reservationId: request.reservationId,
        userId: request.userId
      });

      // Get reservation details and validate
      const reservation = await this.getAndValidateReservation(
        request.reservationId, 
        request.userId
      );

      // Validate that service is completed
      if (reservation.status !== 'completed') {
        throw new Error(`서비스가 완료되지 않았습니다. 현재 상태: ${reservation.status}`);
      }

      // Validate that deposit was paid
      await this.validateDepositPaid(request.reservationId);

      // Check if final payment already exists
      await this.checkExistingPayment(request.reservationId, 'final');

      // Calculate final payment amount
      const finalAmount = reservation.remaining_amount || 
        (reservation.total_amount - (reservation.deposit_amount || 0));

      if (finalAmount <= 0) {
        throw new Error('잔금이 없습니다. 이미 전액 결제가 완료되었습니다.');
      }

      // Prepare payment initiation request
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: request.reservationId,
        userId: request.userId,
        amount: finalAmount,
        isDeposit: false,
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        customerPhone: request.customerPhone,
        successUrl: request.successUrl,
        failUrl: request.failUrl,
        paymentStage: 'final'
      };

      // Initialize payment with TossPayments
      const paymentResponse = await tossPaymentsService.initializePayment(paymentRequest);

      logger.info('Final payment prepared successfully', {
        reservationId: request.reservationId,
        paymentId: paymentResponse.paymentId,
        finalAmount
      });

      return {
        success: true,
        paymentId: paymentResponse.paymentId,
        paymentKey: paymentResponse.paymentKey,
        orderId: paymentResponse.orderId,
        checkoutUrl: paymentResponse.checkoutUrl,
        amount: finalAmount,
        paymentStage: 'final',
        reservationStatus: reservation.status,
        message: `잔금 ${finalAmount.toLocaleString()}원 결제를 진행해주세요.`
      };

    } catch (error) {
      logger.error('Error preparing final payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get comprehensive payment status summary for a reservation
   */
  async getPaymentStatusSummary(reservationId: string): Promise<PaymentStatusSummary> {
    try {
      logger.info('Getting payment status summary', { reservationId });

      // Use the database function to get payment summary
      const { data: summaryData, error } = await this.supabase
        .rpc('get_reservation_payment_summary', {
          p_reservation_id: reservationId
        });

      if (error) {
        throw new Error(`Failed to get payment summary: ${error.message}`);
      }

      if (!summaryData || summaryData.length === 0) {
        throw new Error('Reservation not found');
      }

      const summary = summaryData[0];

      // Determine next action based on current status
      const nextAction = this.determineNextAction(
        summary.deposit_status,
        summary.final_payment_status,
        summary.overall_status,
        summary.is_overdue
      );

      return {
        reservationId,
        totalAmount: summary.total_amount,
        depositAmount: summary.deposit_amount,
        remainingAmount: summary.remaining_amount,
        depositStatus: summary.deposit_status,
        finalPaymentStatus: summary.final_payment_status,
        overallStatus: summary.overall_status,
        isOverdue: summary.is_overdue,
        daysUntilDue: summary.days_until_due,
        nextAction
      };

    } catch (error) {
      logger.error('Error getting payment status summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      throw error;
    }
  }

  /**
   * Automatically trigger final payment after service completion
   */
  async triggerFinalPaymentAfterCompletion(reservationId: string): Promise<AutoTriggerResult> {
    try {
      logger.info('Triggering final payment after service completion', { reservationId });

      // Get reservation details
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select(`
          *,
          users!inner(name, email, phone_number)
        `)
        .eq('id', reservationId)
        .single();

      if (reservationError || !reservation) {
        return {
          triggered: false,
          message: 'Reservation not found',
          error: reservationError?.message
        };
      }

      // Check if service is completed
      if (reservation.status !== 'completed') {
        return {
          triggered: false,
          message: `Service not completed. Current status: ${reservation.status}`
        };
      }

      // Check if deposit was paid
      const { data: depositPayment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('payment_stage', 'deposit')
        .eq('payment_status', 'deposit_paid')
        .single();

      if (!depositPayment) {
        return {
          triggered: false,
          message: 'Deposit payment not found or not completed'
        };
      }

      // Check if final payment already exists
      const { data: existingFinalPayment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .eq('payment_stage', 'final')
        .single();

      if (existingFinalPayment) {
        return {
          triggered: false,
          message: 'Final payment already exists'
        };
      }

      // Calculate final payment amount
      const finalAmount = reservation.remaining_amount || 
        (reservation.total_amount - (reservation.deposit_amount || 0));

      if (finalAmount <= 0) {
        return {
          triggered: false,
          message: 'No remaining amount to pay'
        };
      }

      // Create final payment record with pending status
      const { data: finalPayment, error: paymentError } = await this.supabase
        .from('payments')
        .insert({
          reservation_id: reservationId,
          user_id: reservation.user_id,
          payment_method: 'toss_payments',
          payment_status: 'final_payment_pending',
          payment_stage: 'final',
          amount: finalAmount,
          is_deposit: false,
          due_date: new Date(Date.now() + 72 * 60 * 60 * 1000), // 72 hours from now
          metadata: {
            auto_triggered: true,
            triggered_at: new Date().toISOString(),
            service_completed_at: reservation.updated_at
          }
        })
        .select()
        .single();

      if (paymentError) {
        return {
          triggered: false,
          message: 'Failed to create final payment record',
          error: paymentError.message
        };
      }

      // Send notification to user about final payment
      await this.sendFinalPaymentNotification(reservation, finalAmount);

      logger.info('Final payment triggered successfully', {
        reservationId,
        paymentId: finalPayment.id,
        finalAmount
      });

      return {
        triggered: true,
        paymentId: finalPayment.id,
        message: `Final payment of ${finalAmount.toLocaleString()}원 has been triggered`
      };

    } catch (error) {
      logger.error('Error triggering final payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      return {
        triggered: false,
        message: 'Error triggering final payment',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process deposit payment confirmation
   */
  async processDepositPaymentConfirmation(reservationId: string): Promise<void> {
    try {
      logger.info('Processing deposit payment confirmation', { reservationId });

      // Update reservation status to 'confirmed' after deposit payment
      await this.updateReservationStatus(reservationId, 'confirmed');

      // Send confirmation notifications
      await this.sendDepositConfirmationNotifications(reservationId);

      logger.info('Deposit payment confirmation processed', { reservationId });

    } catch (error) {
      logger.error('Error processing deposit payment confirmation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      throw error;
    }
  }

  /**
   * Process final payment confirmation
   */
  async processFinalPaymentConfirmation(reservationId: string): Promise<void> {
    try {
      logger.info('Processing final payment confirmation', { reservationId });

      // Update payment status to fully_paid
      await this.supabase
        .from('payments')
        .update({
          payment_status: 'fully_paid',
          paid_at: new Date().toISOString()
        })
        .eq('reservation_id', reservationId)
        .eq('payment_stage', 'final');

      // Send completion notifications
      await this.sendFinalPaymentConfirmationNotifications(reservationId);

      logger.info('Final payment confirmation processed', { reservationId });

    } catch (error) {
      logger.error('Error processing final payment confirmation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private async getAndValidateReservation(reservationId: string, userId: string) {
    const { data: reservation, error } = await this.supabase
      .from('reservations')
      .select('*')
      .eq('id', reservationId)
      .eq('user_id', userId)
      .single();

    if (error || !reservation) {
      throw new Error('예약을 찾을 수 없습니다.');
    }

    return reservation;
  }

  private validateDepositAmount(depositAmount: number, totalAmount: number): void {
    const minDeposit = Math.floor(totalAmount * 0.2); // 20%
    const maxDeposit = Math.floor(totalAmount * 0.3); // 30%

    if (depositAmount < minDeposit || depositAmount > maxDeposit) {
      throw new Error(
        `예약금은 총 금액의 20-30% 사이여야 합니다. ` +
        `허용 범위: ${minDeposit.toLocaleString()}원 - ${maxDeposit.toLocaleString()}원`
      );
    }
  }

  private async checkExistingPayment(reservationId: string, stage: 'deposit' | 'final'): Promise<void> {
    const { data: existingPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('payment_stage', stage)
      .eq('payment_status', 'pending')
      .single();

    if (existingPayment) {
      throw new Error(`이미 진행 중인 ${stage === 'deposit' ? '예약금' : '잔금'} 결제가 있습니다.`);
    }
  }

  private async validateDepositPaid(reservationId: string): Promise<void> {
    const { data: depositPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', reservationId)
      .eq('payment_stage', 'deposit')
      .eq('payment_status', 'deposit_paid')
      .single();

    if (!depositPayment) {
      throw new Error('예약금이 결제되지 않았습니다.');
    }
  }

  private async updateReservationDepositInfo(
    reservationId: string,
    depositAmount: number,
    remainingAmount: number
  ): Promise<void> {
    const { error } = await this.supabase
      .from('reservations')
      .update({
        deposit_amount: depositAmount,
        remaining_amount: remainingAmount,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (error) {
      throw new Error(`Failed to update reservation deposit info: ${error.message}`);
    }
  }

  private async updateReservationStatus(
    reservationId: string,
    status: ReservationStatus
  ): Promise<void> {
    const { error } = await this.supabase
      .from('reservations')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (error) {
      throw new Error(`Failed to update reservation status: ${error.message}`);
    }
  }

  private determineNextAction(
    depositStatus: PaymentStatus,
    finalPaymentStatus: PaymentStatus,
    overallStatus: string,
    isOverdue: boolean
  ): string {
    if (overallStatus === 'fully_paid') {
      return '결제 완료';
    }

    if (depositStatus === 'pending') {
      return '예약금 결제 필요';
    }

    if (depositStatus === 'deposit_paid' && finalPaymentStatus === 'pending') {
      return '서비스 완료 대기 중';
    }

    if (finalPaymentStatus === 'final_payment_pending') {
      return isOverdue ? '잔금 결제 연체' : '잔금 결제 필요';
    }

    return '상태 확인 필요';
  }

  private async sendFinalPaymentNotification(reservation: any, finalAmount: number): Promise<void> {
    try {
      await notificationService.sendNotificationToUser(reservation.user_id, {
        title: '잔금 결제 안내',
        body: `서비스가 완료되었습니다. 잔금 ${finalAmount.toLocaleString()}원을 72시간 내에 결제해주세요.`,
        data: {
          type: 'final_payment_required',
          reservationId: reservation.id,
          amount: finalAmount.toString()
        }
      });
    } catch (error) {
      logger.error('Failed to send final payment notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: reservation.id
      });
    }
  }

  private async sendDepositConfirmationNotifications(reservationId: string): Promise<void> {
    // Implementation for deposit confirmation notifications
    logger.info('Sending deposit confirmation notifications', { reservationId });
  }

  private async sendFinalPaymentConfirmationNotifications(reservationId: string): Promise<void> {
    // Implementation for final payment confirmation notifications
    logger.info('Sending final payment confirmation notifications', { reservationId });
  }
}

export const twoStagePaymentService = new TwoStagePaymentService();
