/**
 * Payment Confirmation Service
 * 
 * Enhanced payment confirmation and verification service including:
 * - Payment verification with TossPayments
 * - Atomic database operations
 * - Customer notification system
 * - Payment receipt generation and delivery
 * - Reservation status updates
 * - Transaction audit logging
 */

import { getSupabaseClient } from '../config/database';
import { tossPaymentsService, PaymentConfirmationRequest, PaymentConfirmationResponse } from './toss-payments.service';
import { logger } from '../utils/logger';
import { PaymentStatus, ReservationStatus } from '../types/database.types';

export interface EnhancedPaymentConfirmationRequest extends PaymentConfirmationRequest {
  userId: string;
  sendNotification?: boolean;
  generateReceipt?: boolean;
}

export interface EnhancedPaymentConfirmationResponse extends PaymentConfirmationResponse {
  reservationStatus?: ReservationStatus | undefined;
  notificationSent?: boolean | undefined;
  receiptGenerated?: boolean | undefined;
  auditLogId?: string | undefined;
}

export interface PaymentReceipt {
  receiptId: string;
  paymentId: string;
  reservationId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  customerName: string;
  customerEmail: string;
  shopName: string;
  serviceDetails: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  paymentDate: string;
  receiptUrl: string;
  metadata: Record<string, any>;
}

export interface CustomerNotification {
  userId: string;
  type: 'payment_success' | 'payment_failed' | 'payment_refunded';
  title: string;
  message: string;
  data: Record<string, any>;
  priority: 'high' | 'normal' | 'low';
}

export class PaymentConfirmationService {
  private supabase = getSupabaseClient();

  /**
   * Enhanced payment confirmation with comprehensive verification and processing
   */
  async confirmPaymentWithVerification(
    request: EnhancedPaymentConfirmationRequest
  ): Promise<EnhancedPaymentConfirmationResponse> {
    const transactionId = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Starting enhanced payment confirmation', {
        transactionId,
        orderId: request.orderId,
        userId: request.userId
      });

      // Step 1: Verify payment record and ownership
      const paymentRecord = await this.verifyPaymentOwnership(request.orderId, request.userId);
      
      // Step 2: Validate payment amount
      this.validatePaymentAmount(paymentRecord, request.amount);
      
      // Step 3: Check for duplicate confirmation
      await this.checkDuplicateConfirmation(paymentRecord.id);
      
      // Step 4: Confirm payment with TossPayments
      const confirmRequest: PaymentConfirmationRequest = {
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amount
      };

      const confirmResponse = await tossPaymentsService.confirmPayment(confirmRequest);
      
      // Step 5: Perform atomic database operations
      const dbResult = await this.performAtomicPaymentUpdate(
        paymentRecord,
        confirmResponse,
        transactionId
      );

      // Step 6: Update reservation status if needed
      const reservationStatus = await this.updateReservationStatus(
        paymentRecord.reservation_id,
        confirmResponse.status
      );

      // Step 7: Send customer notification
      let notificationSent = false;
      if (request.sendNotification !== false) {
        notificationSent = await this.sendPaymentNotification(
          request.userId,
          confirmResponse,
          paymentRecord
        );
      }

      // Step 8: Generate and deliver receipt
      let receiptGenerated = false;
      if (request.generateReceipt !== false) {
        receiptGenerated = await this.generateAndDeliverReceipt(
          confirmResponse.paymentId,
          paymentRecord
        );
      }

      // Step 9: Create audit log
      const auditLogId = await this.createAuditLog(
        transactionId,
        'payment_confirmation',
        {
          paymentId: confirmResponse.paymentId,
          orderId: request.orderId,
          userId: request.userId,
          amount: request.amount,
          status: confirmResponse.status,
          notificationSent,
          receiptGenerated
        }
      );

      logger.info('Enhanced payment confirmation completed successfully', {
        transactionId,
        paymentId: confirmResponse.paymentId,
        status: confirmResponse.status,
        notificationSent,
        receiptGenerated
      });

      return {
        ...confirmResponse,
        reservationStatus,
        notificationSent,
        receiptGenerated,
        auditLogId
      };

    } catch (error) {
      logger.error('Enhanced payment confirmation failed', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });

      // Create failure audit log
      await this.createAuditLog(
        transactionId,
        'payment_confirmation_failed',
        {
          orderId: request.orderId,
          userId: request.userId,
          amount: request.amount,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
      );

      throw error;
    }
  }

  /**
   * Verify payment record ownership
   */
  private async verifyPaymentOwnership(orderId: string, userId: string): Promise<any> {
    const { data: payment, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        reservations!inner(
          id,
          user_id,
          total_amount,
          deposit_amount,
          status,
          shops!inner(name, address)
        )
      `)
      .eq('provider_order_id', orderId)
      .eq('user_id', userId)
      .single();

    if (error || !payment) {
      throw new Error(`Payment record not found or access denied for order ID: ${orderId}`);
    }

    return payment;
  }

  /**
   * Validate payment amount against original request
   */
  private validatePaymentAmount(paymentRecord: any, amount: number): void {
    if (paymentRecord.amount !== amount) {
      throw new Error(`Amount mismatch. Expected: ${paymentRecord.amount}, Received: ${amount}`);
    }
  }

  /**
   * Check for duplicate confirmation attempts
   */
  private async checkDuplicateConfirmation(paymentId: string): Promise<void> {
    const { data: existingConfirmation } = await this.supabase
      .from('payment_audit_logs')
      .select('*')
      .eq('payment_id', paymentId)
      .eq('action', 'payment_confirmation')
      .eq('status', 'success')
      .single();

    if (existingConfirmation) {
      throw new Error(`Payment already confirmed. Payment ID: ${paymentId}`);
    }
  }

  /**
   * Perform atomic database operations for payment update
   */
  private async performAtomicPaymentUpdate(
    paymentRecord: any,
    confirmResponse: PaymentConfirmationResponse,
    transactionId: string
  ): Promise<any> {
    // Use database transaction for atomicity
    const { data, error } = await this.supabase.rpc('update_payment_with_audit', {
      p_payment_id: paymentRecord.id,
      p_payment_status: confirmResponse.status,
      p_provider_transaction_id: confirmResponse.transactionId,
      p_paid_at: confirmResponse.approvedAt,
      p_metadata: {
        ...paymentRecord.metadata,
        confirmedAt: confirmResponse.approvedAt,
        method: confirmResponse.receiptUrl ? 'card' : 'unknown',
        receiptUrl: confirmResponse.receiptUrl,
        transactionId: confirmResponse.transactionId,
        auditTransactionId: transactionId
      }
    });

    if (error) {
      throw new Error(`Failed to update payment record: ${error.message}`);
    }

    return data;
  }

  /**
   * Update reservation status based on payment status
   */
  private async updateReservationStatus(
    reservationId: string,
    paymentStatus: PaymentStatus
  ): Promise<ReservationStatus | undefined> {
    let newReservationStatus: ReservationStatus | undefined;

    // Update reservation status based on payment type and status
    if (paymentStatus === 'deposit_paid') {
      newReservationStatus = 'confirmed';
    } else if (paymentStatus === 'fully_paid') {
      newReservationStatus = 'confirmed';
    }

    if (newReservationStatus) {
      const { error } = await this.supabase
        .from('reservations')
        .update({
          status: newReservationStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (error) {
        logger.error('Failed to update reservation status', {
          reservationId,
          newStatus: newReservationStatus,
          error: error.message
        });
        // Don't throw error as payment is still successful
      }
    }

    return newReservationStatus;
  }

  /**
   * Send payment notification to customer
   */
  private async sendPaymentNotification(
    userId: string,
    confirmResponse: PaymentConfirmationResponse,
    paymentRecord: any
  ): Promise<boolean> {
    try {
      const notification: CustomerNotification = {
        userId,
        type: 'payment_success',
        title: '결제가 완료되었습니다',
        message: `결제 금액 ${paymentRecord.amount.toLocaleString()}원이 성공적으로 처리되었습니다.`,
        data: {
          paymentId: confirmResponse.paymentId,
          amount: paymentRecord.amount,
          paymentMethod: paymentRecord.payment_method,
          reservationId: paymentRecord.reservation_id,
          receiptUrl: confirmResponse.receiptUrl
        },
        priority: 'high'
      };

      // Insert notification into database
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: notification.type,
          title: notification.title,
          message: notification.message,
          data: notification.data,
          priority: notification.priority,
          status: 'unread'
        });

      if (error) {
        logger.error('Failed to create payment notification', {
          userId,
          paymentId: confirmResponse.paymentId,
          error: error.message
        });
        return false;
      }

      // TODO: Send push notification via FCM
      // await this.sendPushNotification(notification);

      logger.info('Payment notification sent successfully', {
        userId,
        paymentId: confirmResponse.paymentId
      });

      return true;

    } catch (error) {
      logger.error('Failed to send payment notification', {
        userId,
        paymentId: confirmResponse.paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Generate and deliver payment receipt
   */
  private async generateAndDeliverReceipt(
    paymentId: string,
    paymentRecord: any
  ): Promise<boolean> {
    try {
      // Get complete payment and reservation details
      const { data: paymentDetails } = await this.supabase
        .from('payments')
        .select(`
          *,
          reservations!inner(
            id,
            reservation_date,
            reservation_time,
            total_amount,
            deposit_amount,
            special_requests,
            users!inner(name, email),
            shops!inner(name, address),
            reservation_services!inner(
              quantity,
              unit_price,
              total_price,
              shop_services!inner(name)
            )
          )
        `)
        .eq('id', paymentId)
        .single();

      if (!paymentDetails) {
        throw new Error(`Payment details not found: ${paymentId}`);
      }

      // Generate receipt data
      const receipt: PaymentReceipt = {
        receiptId: `receipt_${paymentId}_${Date.now()}`,
        paymentId,
        reservationId: paymentDetails.reservations.id,
        amount: paymentDetails.amount,
        currency: paymentDetails.currency,
        paymentMethod: paymentDetails.payment_method,
        customerName: paymentDetails.reservations.users.name,
        customerEmail: paymentDetails.reservations.users.email,
        shopName: paymentDetails.reservations.shops.name,
        serviceDetails: paymentDetails.reservations.reservation_services.map((rs: any) => ({
          name: rs.shop_services.name,
          quantity: rs.quantity,
          unitPrice: rs.unit_price,
          totalPrice: rs.total_price
        })),
        paymentDate: paymentDetails.paid_at || new Date().toISOString(),
        receiptUrl: paymentDetails.metadata?.receiptUrl || '',
        metadata: {
          reservationDate: paymentDetails.reservations.reservation_date,
          reservationTime: paymentDetails.reservations.reservation_time,
          specialRequests: paymentDetails.reservations.special_requests,
          shopAddress: paymentDetails.reservations.shops.address
        }
      };

      // Store receipt in database
      const { error: receiptError } = await this.supabase
        .from('payment_receipts')
        .insert({
          receipt_id: receipt.receiptId,
          payment_id: paymentId,
          reservation_id: receipt.reservationId,
          amount: receipt.amount,
          currency: receipt.currency,
          payment_method: receipt.paymentMethod,
          customer_name: receipt.customerName,
          customer_email: receipt.customerEmail,
          shop_name: receipt.shopName,
          service_details: receipt.serviceDetails,
          payment_date: receipt.paymentDate,
          receipt_url: receipt.receiptUrl,
          metadata: receipt.metadata
        });

      if (receiptError) {
        logger.error('Failed to store payment receipt', {
          paymentId,
          error: receiptError.message
        });
        return false;
      }

      // TODO: Generate PDF receipt and upload to storage
      // const pdfReceipt = await this.generatePDFReceipt(receipt);
      // const uploadedUrl = await this.uploadReceiptToStorage(pdfReceipt, receipt.receiptId);

      // TODO: Send receipt via email
      // await this.sendReceiptEmail(receipt);

      logger.info('Payment receipt generated and stored successfully', {
        paymentId,
        receiptId: receipt.receiptId
      });

      return true;

    } catch (error) {
      logger.error('Failed to generate payment receipt', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Create audit log entry
   */
  private async createAuditLog(
    transactionId: string,
    action: string,
    data: Record<string, any>
  ): Promise<string> {
    const auditLogId = `audit_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const { error } = await this.supabase
      .from('payment_audit_logs')
      .insert({
        audit_log_id: auditLogId,
        transaction_id: transactionId,
        action,
        data,
        timestamp: new Date().toISOString(),
        status: 'completed'
      });

    if (error) {
      logger.error('Failed to create audit log', {
        transactionId,
        action,
        error: error.message
      });
      // Don't throw error as this is not critical for payment processing
    }

    return auditLogId;
  }

  /**
   * Get payment receipt by payment ID
   */
  async getPaymentReceipt(paymentId: string): Promise<PaymentReceipt | null> {
    const { data, error } = await this.supabase
      .from('payment_receipts')
      .select('*')
      .eq('payment_id', paymentId)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      receiptId: data.receipt_id,
      paymentId: data.payment_id,
      reservationId: data.reservation_id,
      amount: data.amount,
      currency: data.currency,
      paymentMethod: data.payment_method,
      customerName: data.customer_name,
      customerEmail: data.customer_email,
      shopName: data.shop_name,
      serviceDetails: data.service_details,
      paymentDate: data.payment_date,
      receiptUrl: data.receipt_url,
      metadata: data.metadata
    };
  }

  /**
   * Get payment audit logs
   */
  async getPaymentAuditLogs(paymentId: string): Promise<any[]> {
    const { data, error } = await this.supabase
      .from('payment_audit_logs')
      .select('*')
      .eq('data->paymentId', paymentId)
      .order('timestamp', { ascending: false });

    if (error) {
      logger.error('Failed to fetch payment audit logs', {
        paymentId,
        error: error.message
      });
      return [];
    }

    return data || [];
  }
}

// Export singleton instance
export const paymentConfirmationService = new PaymentConfirmationService(); 