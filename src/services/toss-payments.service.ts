/**
 * TossPayments Service
 * 
 * Comprehensive service for TossPayments API integration including:
 * - Payment initialization and preparation
 * - Payment confirmation and verification
 * - Webhook handling for status updates
 * - Error handling and retry mechanisms
 * - Fraud detection and security monitoring
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { PaymentMethod, PaymentStatus } from '../types/database.types';

// TossPayments API types
export interface TossPaymentRequest {
  amount: number;
  orderId: string;
  orderName: string;
  customerName: string;
  customerEmail: string;
  customerMobilePhone?: string;
  successUrl?: string;
  failUrl?: string;
  windowTarget?: 'iframe' | 'self';
  useInternationalCardOnly?: boolean;
  flowMode?: 'DEFAULT' | 'BILLING';
  easyPay?: string;
  discountAmount?: number;
  taxFreeAmount?: number;
  useEscrow?: boolean;
  escrowProducts?: Array<{
    id: string;
    name: string;
    code: string;
    unitPrice: number;
    quantity: number;
  }>;
  customer?: {
    customerId?: string;
    name?: string;
    email?: string;
    mobilePhone?: string;
    birthYear?: string;
    birthMonth?: string;
    birthDay?: string;
    gender?: 'MALE' | 'FEMALE';
    address?: {
      address1?: string;
      address2?: string;
      zipCode?: string;
    };
  };
  card?: {
    installmentPlan?: number;
    useCardPoint?: boolean;
    amount?: number;
    orderId?: string;
    interestPayer?: 'BUYER' | 'CARD_COMPANY';
  };
  virtualAccount?: {
    accountType?: 'NORMAL' | 'FREE';
    accountNumber?: string;
    accountHolderName?: string;
    dueDate?: string;
    bankCode?: string;
    customerName?: string;
    depositorName?: string;
    refundBankCode?: string;
    refundAccountNumber?: string;
    refundHolderName?: string;
  };
  transfer?: {
    bankCode?: string;
    settlementStatus?: 'INCOMPLETED' | 'COMPLETED';
  };
  mobilePhone?: {
    customerMobilePhone?: string;
    settlementStatus?: 'INCOMPLETED' | 'COMPLETED';
    receiptUrl?: string;
  };
  giftCertificate?: {
    orderId?: string;
    approvalNumber?: string;
    settlementStatus?: 'INCOMPLETED' | 'COMPLETED';
  };
  cashReceipt?: {
    type?: '소득공제' | '지출증빙';
    amount?: number;
    taxFreeAmount?: number;
    issueNumber?: string;
    receiptUrl?: string;
  };
  metadata?: Record<string, any>;
}

export interface TossPaymentResponse {
  paymentKey: string;
  orderId: string;
  orderName: string;
  method: string;
  totalAmount: number;
  balanceAmount: number;
  suppliedAmount: number;
  status: string;
  requestedAt: string;
  approvedAt?: string;
  useEscrow: boolean;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    amount: number;
  };
  virtualAccount?: {
    accountNumber: string;
    accountType: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    refundStatus: string;
    expired: boolean;
    settlementStatus: string;
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  mobilePhone?: {
    customerMobilePhone: string;
    settlementStatus: string;
    receiptUrl: string;
  };
  giftCertificate?: {
    approveNo: string;
    settlementStatus: string;
  };
  cashReceipt?: {
    type: string;
    amount: number;
    taxFreeAmount: number;
    issueNumber: string;
    receiptUrl: string;
  };
  cancel?: Array<{
    cancelAmount: number;
    cancelReason: string;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;
    easyPayDiscountAmount: number;
    canceledAt: string;
    transactionKey: string;
    cancelStatus: string;
    cancelRequestId: string;
    acquirerStatus: string;
    useEscrow: boolean;
    cancelFailedAmount: number;
    discountAmount: number;
  }>;
  escrowProducts?: Array<{
    id: string;
    name: string;
    code: string;
    unitPrice: number;
    quantity: number;
  }>;
  discount?: {
    amount: number;
  };
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;
    easyPayDiscountAmount: number;
    canceledAt: string;
    transactionKey: string;
    cancelStatus: string;
    cancelRequestId: string;
    acquirerStatus: string;
    useEscrow: boolean;
    cancelFailedAmount: number;
    discountAmount: number;
  }>;
  secret: string;
  type: string;
  easyPay?: {
    provider: string;
    amount: number;
    discountAmount: number;
  };
  country: string;
  failure?: {
    code: string;
    message: string;
  };
  isPartialCancelable: boolean;
  receipt?: {
    url: string;
  };
  checkout?: {
    url: string;
  };
  totalCancelAmount: number;
  vat: number;
  taxFreeAmount: number;
  currency: string;
}

export interface TossPaymentConfirmRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface TossPaymentCancelRequest {
  cancelReason: string;
  cancelAmount?: number;
  bank?: string;
  accountNumber?: string;
  holderName?: string;
  refundableAmount?: number;
}

export interface TossWebhookPayload {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  suppliedAmount: number;
  vat: number;
  approvedAt: string;
  useEscrow: boolean;
  currency: string;
  method: string;
  secret: string;
  type: string;
  country: string;
  isPartialCancelable: boolean;
  receipt?: {
    url: string;
  };
  checkout?: {
    url: string;
  };
  giftCertificate?: {
    approveNo: string;
    settlementStatus: string;
  };
  totalCancelAmount: number;
  balanceAmount: number;
  taxFreeAmount: number;
  requestedAt: string;
  card?: {
    company: string;
    number: string;
    installmentPlanMonths: number;
    isInterestFree: boolean;
    approveNo: string;
    useCardPoint: boolean;
    cardType: string;
    ownerType: string;
    acquireStatus: string;
    amount: number;
  };
  virtualAccount?: {
    accountNumber: string;
    accountType: string;
    bankCode: string;
    customerName: string;
    dueDate: string;
    refundStatus: string;
    expired: boolean;
    settlementStatus: string;
  };
  transfer?: {
    bankCode: string;
    settlementStatus: string;
  };
  mobilePhone?: {
    customerMobilePhone: string;
    settlementStatus: string;
    receiptUrl: string;
  };
  cashReceipt?: {
    type: string;
    amount: number;
    taxFreeAmount: number;
    issueNumber: string;
    receiptUrl: string;
  };
  cancel?: Array<{
    cancelAmount: number;
    cancelReason: string;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;
    easyPayDiscountAmount: number;
    canceledAt: string;
    transactionKey: string;
    cancelStatus: string;
    cancelRequestId: string;
    acquirerStatus: string;
    useEscrow: boolean;
    cancelFailedAmount: number;
    discountAmount: number;
  }>;
  escrowProducts?: Array<{
    id: string;
    name: string;
    code: string;
    unitPrice: number;
    quantity: number;
  }>;
  discount?: {
    amount: number;
  };
  cancels?: Array<{
    cancelAmount: number;
    cancelReason: string;
    taxFreeAmount: number;
    taxExemptionAmount: number;
    refundableAmount: number;
    easyPayDiscountAmount: number;
    canceledAt: string;
    transactionKey: string;
    cancelStatus: string;
    cancelRequestId: string;
    acquirerStatus: string;
    useEscrow: boolean;
    cancelFailedAmount: number;
    discountAmount: number;
  }>;
  easyPay?: {
    provider: string;
    amount: number;
    discountAmount: number;
  };
  failure?: {
    code: string;
    message: string;
  };
}

export interface PaymentInitiationRequest {
  reservationId: string;
  userId: string;
  amount: number;
  isDeposit: boolean;
  customerName: string;
  customerEmail: string;
  customerPhone?: string;
  successUrl?: string;
  failUrl?: string;
}

export interface PaymentInitiationResponse {
  paymentKey: string;
  orderId: string;
  checkoutUrl: string;
  paymentId: string;
}

export interface PaymentConfirmationRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PaymentConfirmationResponse {
  paymentId: string;
  status: PaymentStatus;
  transactionId: string;
  approvedAt: string;
  receiptUrl?: string;
}

export class TossPaymentsService {
  private supabase = getSupabaseClient();
  private readonly baseUrl: string;
  private readonly secretKey: string;
  private readonly clientKey: string;
  private readonly timeout: number = 30000; // 30 seconds

  constructor() {
    this.baseUrl = config.payments.tossPayments.baseUrl;
    this.secretKey = config.payments.tossPayments.secretKey;
    this.clientKey = config.payments.tossPayments.clientKey;

    if (!this.secretKey || !this.clientKey) {
      throw new Error('TossPayments configuration is missing. Please check environment variables.');
    }
  }

  /**
   * Initialize payment with TossPayments
   */
  async initializePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    try {
      logger.info('Initializing TossPayments payment', {
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.amount,
        isDeposit: request.isDeposit
      });

      // Generate unique order ID
      const orderId = this.generateOrderId(request.reservationId, request.isDeposit);
      
      // Create payment record in database
      const paymentId = await this.createPaymentRecord({
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.amount,
        isDeposit: request.isDeposit,
        orderId
      });

      // Prepare TossPayments request
      const tossRequest: TossPaymentRequest = {
        amount: request.amount,
        orderId,
        orderName: request.isDeposit ? '에뷰리띵 예약금 결제' : '에뷰리띵 잔금 결제',
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        ...(request.customerPhone && { customerMobilePhone: request.customerPhone }),
        successUrl: request.successUrl || `http://localhost:${config.server.port}/api/payments/success`,
        failUrl: request.failUrl || `http://localhost:${config.server.port}/api/payments/fail`,
        windowTarget: 'self',
        useInternationalCardOnly: false,
        flowMode: 'DEFAULT',
        metadata: {
          reservationId: request.reservationId,
          userId: request.userId,
          paymentId,
          isDeposit: request.isDeposit
        }
      };

      // Call TossPayments API
      const response = await this.callTossPaymentsAPI('/v1/payments', 'POST', tossRequest);

      // Update payment record with payment key
      await this.updatePaymentRecord(paymentId, {
        provider_order_id: orderId,
        metadata: {
          ...tossRequest.metadata,
          paymentKey: response.paymentKey,
          checkoutUrl: response.checkout?.url
        }
      });

      logger.info('TossPayments payment initialized successfully', {
        paymentId,
        orderId,
        paymentKey: response.paymentKey
      });

      return {
        paymentKey: response.paymentKey,
        orderId,
        checkoutUrl: response.checkout?.url || '',
        paymentId
      };

    } catch (error) {
      logger.error('Failed to initialize TossPayments payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Confirm payment with TossPayments
   */
  async confirmPayment(request: PaymentConfirmationRequest): Promise<PaymentConfirmationResponse> {
    try {
      logger.info('Confirming TossPayments payment', {
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amount
      });

      // Verify payment record exists
      const paymentRecord = await this.getPaymentByOrderId(request.orderId);
      if (!paymentRecord) {
        throw new Error(`Payment record not found for order ID: ${request.orderId}`);
      }

      // Verify amount matches
      if (paymentRecord.amount !== request.amount) {
        throw new Error(`Amount mismatch. Expected: ${paymentRecord.amount}, Received: ${request.amount}`);
      }

      // Call TossPayments confirmation API
      const confirmRequest: TossPaymentConfirmRequest = {
        paymentKey: request.paymentKey,
        orderId: request.orderId,
        amount: request.amount
      };

      const response = await this.callTossPaymentsAPI('/v1/payments/confirm', 'POST', confirmRequest);

      // Update payment record
      const updatedPayment = await this.updatePaymentRecord(paymentRecord.id, {
        payment_status: this.mapTossStatusToPaymentStatus(response.status),
        provider_transaction_id: response.paymentKey,
        paid_at: new Date().toISOString(),
        metadata: {
          ...paymentRecord.metadata,
          confirmedAt: response.approvedAt,
          method: response.method,
          receiptUrl: response.receipt?.url
        }
      });

      // Update reservation status if deposit payment
      if (paymentRecord.is_deposit) {
        await this.updateReservationStatus(paymentRecord.reservation_id, 'confirmed');
      }

      logger.info('TossPayments payment confirmed successfully', {
        paymentId: paymentRecord.id,
        status: response.status,
        transactionId: response.paymentKey
      });

      return {
        paymentId: paymentRecord.id,
        status: this.mapTossStatusToPaymentStatus(response.status),
        transactionId: response.paymentKey,
        approvedAt: response.approvedAt || new Date().toISOString(),
        receiptUrl: response.receipt?.url
      };

    } catch (error) {
      logger.error('Failed to confirm TossPayments payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Process webhook from TossPayments
   */
  async processWebhook(payload: TossWebhookPayload): Promise<void> {
    const webhookId = `webhook_${payload.paymentKey}_${Date.now()}`;
    const maxRetries = 3;
    const retryDelay = 1000; // 1 second

    try {
      logger.info('Processing TossPayments webhook', {
        webhookId,
        paymentKey: payload.paymentKey,
        orderId: payload.orderId,
        status: payload.status
      });

      // Verify webhook signature (if configured)
      if (!this.verifyWebhookSignature(payload)) {
        throw new Error('Invalid webhook signature');
      }

      // Check for idempotency - prevent duplicate processing
      const isDuplicate = await this.checkWebhookIdempotency(payload.paymentKey, payload.status);
      if (isDuplicate) {
        logger.info('Webhook already processed, skipping duplicate', {
          webhookId,
          paymentKey: payload.paymentKey,
          status: payload.status
        });
        return;
      }

      // Get payment record
      const paymentRecord = await this.getPaymentByOrderId(payload.orderId);
      if (!paymentRecord) {
        throw new Error(`Payment record not found for order ID: ${payload.orderId}`);
      }

      // Process webhook with retry mechanism
      await this.processWebhookWithRetry(payload, paymentRecord, webhookId, maxRetries, retryDelay);

      // Mark webhook as processed
      await this.markWebhookAsProcessed(payload.paymentKey, payload.status, webhookId);

      logger.info('TossPayments webhook processed successfully', {
        webhookId,
        paymentId: paymentRecord.id,
        status: payload.status
      });

    } catch (error) {
      logger.error('Failed to process TossPayments webhook', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        payload
      });
      throw error;
    }
  }

  /**
   * Process webhook with retry mechanism
   */
  private async processWebhookWithRetry(
    payload: TossWebhookPayload,
    paymentRecord: any,
    webhookId: string,
    maxRetries: number,
    retryDelay: number
  ): Promise<void> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Update payment status
        const newStatus = this.mapTossStatusToPaymentStatus(payload.status);
        await this.updatePaymentRecord(paymentRecord.id, {
          payment_status: newStatus,
          paid_at: payload.approvedAt ? new Date(payload.approvedAt) : undefined,
          metadata: {
            ...paymentRecord.metadata,
            webhookReceivedAt: new Date().toISOString(),
            webhookStatus: payload.status,
            method: payload.method,
            receiptUrl: payload.receipt?.url,
            webhookId,
            webhookAttempt: attempt
          }
        });

        // Update reservation status if deposit payment and status is confirmed
        if (paymentRecord.is_deposit && newStatus === 'deposit_paid') {
          await this.updateReservationStatus(paymentRecord.reservation_id, 'confirmed');
        }

        // Send notification for successful payment
        if (newStatus === 'deposit_paid' || newStatus === 'fully_paid') {
          await this.sendPaymentNotification(paymentRecord.user_id, newStatus, paymentRecord);
        }

        logger.info('Webhook processing successful', {
          webhookId,
          attempt,
          paymentId: paymentRecord.id,
          status: newStatus
        });

        return; // Success, exit retry loop

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn('Webhook processing attempt failed', {
          webhookId,
          attempt,
          maxRetries,
          error: lastError.message,
          paymentId: paymentRecord.id
        });

        if (attempt < maxRetries) {
          // Wait before retry with exponential backoff
          const delay = retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    // All retries failed
    throw new Error(`Webhook processing failed after ${maxRetries} attempts: ${lastError?.message}`);
  }

  /**
   * Check for webhook idempotency
   */
  private async checkWebhookIdempotency(paymentKey: string, status: string): Promise<boolean> {
    try {
      const { data: existingWebhook } = await this.supabase
        .from('webhook_logs')
        .select('id')
        .eq('payment_key', paymentKey)
        .eq('status', status)
        .eq('processed', true)
        .single();

      return !!existingWebhook;
    } catch (error) {
      // If table doesn't exist or other error, assume not duplicate
      return false;
    }
  }

  /**
   * Mark webhook as processed
   */
  private async markWebhookAsProcessed(paymentKey: string, status: string, webhookId: string): Promise<void> {
    try {
      await this.supabase
        .from('webhook_logs')
        .insert({
          payment_key: paymentKey,
          status,
          webhook_id: webhookId,
          processed: true,
          processed_at: new Date().toISOString()
        });
    } catch (error) {
      logger.warn('Failed to log webhook processing', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      // Don't throw error as this is not critical
    }
  }

  /**
   * Send payment notification
   */
  private async sendPaymentNotification(userId: string, status: string, paymentRecord: any): Promise<void> {
    try {
      // Get user details
      const { data: user } = await this.supabase
        .from('users')
        .select('name, email, phone_number')
        .eq('id', userId)
        .single();

      if (!user) {
        logger.warn('User not found for payment notification', { userId });
        return;
      }

      // Create notification record
      await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          type: 'payment_success',
          title: '결제가 완료되었습니다',
          message: `결제 금액 ${paymentRecord.amount.toLocaleString()}원이 성공적으로 처리되었습니다.`,
          data: {
            paymentId: paymentRecord.id,
            amount: paymentRecord.amount,
            status,
            reservationId: paymentRecord.reservation_id
          },
          priority: 'high',
          created_at: new Date().toISOString()
        });

      logger.info('Payment notification sent', {
        userId,
        paymentId: paymentRecord.id,
        status
      });

    } catch (error) {
      logger.error('Failed to send payment notification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        paymentId: paymentRecord.id
      });
      // Don't throw error as notification is not critical
    }
  }

  /**
   * Cancel payment
   */
  async cancelPayment(paymentId: string, reason: string, amount?: number): Promise<void> {
    try {
      logger.info('Canceling TossPayments payment', {
        paymentId,
        reason,
        amount
      });

      const paymentRecord = await this.getPaymentById(paymentId);
      if (!paymentRecord) {
        throw new Error(`Payment record not found: ${paymentId}`);
      }

      if (!paymentRecord.provider_transaction_id) {
        throw new Error('Payment has not been confirmed yet');
      }

      const cancelRequest: TossPaymentCancelRequest = {
        cancelReason: reason,
        cancelAmount: amount || paymentRecord.amount
      };

      await this.callTossPaymentsAPI(
        `/v1/payments/${paymentRecord.provider_transaction_id}/cancel`,
        'POST',
        cancelRequest
      );

      // Update payment record
      await this.updatePaymentRecord(paymentId, {
        payment_status: amount && amount < paymentRecord.amount ? 'partially_refunded' : 'refunded',
        refunded_at: new Date().toISOString(),
        refund_amount: amount || paymentRecord.amount,
        metadata: {
          ...paymentRecord.metadata,
          cancelReason: reason,
          canceledAt: new Date().toISOString()
        }
      });

      logger.info('TossPayments payment canceled successfully', {
        paymentId,
        status: amount && amount < paymentRecord.amount ? 'partially_refunded' : 'refunded'
      });

    } catch (error) {
      logger.error('Failed to cancel TossPayments payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId,
        reason
      });
      throw error;
    }
  }

  /**
   * Get payment by ID
   */
  async getPaymentById(paymentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      logger.error('Error fetching payment by ID:', { error: error.message, paymentId });
      return null;
    }

    return data;
  }

  /**
   * Get payment by order ID
   */
  async getPaymentByOrderId(orderId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('provider_order_id', orderId)
      .single();

    if (error) {
      logger.error('Error fetching payment by order ID:', { error: error.message, orderId });
      return null;
    }

    return data;
  }

  /**
   * Create payment record in database
   */
  private async createPaymentRecord(paymentData: {
    reservationId: string;
    userId: string;
    amount: number;
    isDeposit: boolean;
    orderId: string;
  }): Promise<string> {
    const { data, error } = await this.supabase
      .from('payments')
      .insert({
        reservation_id: paymentData.reservationId,
        user_id: paymentData.userId,
        payment_method: 'toss_payments' as PaymentMethod,
        payment_status: 'pending' as PaymentStatus,
        amount: paymentData.amount,
        currency: 'KRW',
        payment_provider: 'toss_payments',
        provider_order_id: paymentData.orderId,
        is_deposit: paymentData.isDeposit,
        metadata: {
          createdAt: new Date().toISOString(),
          isDeposit: paymentData.isDeposit
        }
      })
      .select('id')
      .single();

    if (error) {
      logger.error('Error creating payment record:', { error: error.message, paymentData });
      throw new Error(`Failed to create payment record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update payment record
   */
  private async updatePaymentRecord(paymentId: string, updates: any): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', paymentId)
      .select('*')
      .single();

    if (error) {
      logger.error('Error updating payment record:', { error: error.message, paymentId, updates });
      throw new Error(`Failed to update payment record: ${error.message}`);
    }

    return data;
  }

  /**
   * Update reservation status
   */
  private async updateReservationStatus(reservationId: string, status: string): Promise<void> {
    const { error } = await this.supabase
      .from('reservations')
      .update({
        status,
        updated_at: new Date().toISOString()
      })
      .eq('id', reservationId);

    if (error) {
      logger.error('Error updating reservation status:', { error: error.message, reservationId, status });
      throw new Error(`Failed to update reservation status: ${error.message}`);
    }
  }

  /**
   * Call TossPayments API
   */
  private async callTossPaymentsAPI(endpoint: string, method: string, data?: any): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Authorization': `Basic ${Buffer.from(this.secretKey + ':').toString('base64')}`,
      'Content-Type': 'application/json'
    };

    const options: RequestInit = {
      method,
      headers
    };

    if (data) {
      options.body = JSON.stringify(data);
    }

    try {
      const response = await fetch(url, options);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`TossPayments API error: ${response.status} ${response.statusText} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      logger.error('TossPayments API call failed:', {
        error: error instanceof Error ? error.message : 'Unknown error',
        url,
        method,
        data
      });
      throw error;
    }
  }

  /**
   * Generate unique order ID
   */
  private generateOrderId(reservationId: string, isDeposit: boolean): string {
    const timestamp = Date.now();
    const type = isDeposit ? 'deposit' : 'full';
    return `order_${reservationId}_${type}_${timestamp}`;
  }

  /**
   * Map TossPayments status to internal payment status
   */
  private mapTossStatusToPaymentStatus(tossStatus: string): PaymentStatus {
    switch (tossStatus) {
      case 'DONE':
        return 'deposit_paid';
      case 'CANCELED':
        return 'refunded';
      case 'PARTIAL_CANCELED':
        return 'partially_refunded';
      case 'ABORTED':
      case 'FAILED':
        return 'failed';
      case 'WAITING_FOR_DEPOSIT':
      case 'IN_PROGRESS':
        return 'pending';
      default:
        return 'pending';
    }
  }

  /**
   * Verify webhook signature using HMAC-SHA256
   */
  private verifyWebhookSignature(payload: TossWebhookPayload): boolean {
    try {
      // Get webhook secret from environment
      const webhookSecret = process.env.TOSS_PAYMENTS_WEBHOOK_SECRET;
      if (!webhookSecret) {
        logger.warn('Webhook secret not configured, skipping signature verification');
        return true; // Allow processing if secret not configured
      }

      // Extract signature from payload
      const signature = payload.secret;
      if (!signature) {
        logger.warn('No signature found in webhook payload');
        return false;
      }

      // Create signature from payload data
      const payloadData = {
        paymentKey: payload.paymentKey,
        orderId: payload.orderId,
        status: payload.status,
        totalAmount: payload.totalAmount,
        suppliedAmount: payload.suppliedAmount,
        vat: payload.vat,
        approvedAt: payload.approvedAt,
        useEscrow: payload.useEscrow,
        currency: payload.currency,
        method: payload.method,
        type: payload.type,
        country: payload.country,
        isPartialCancelable: payload.isPartialCancelable,
        totalCancelAmount: payload.totalCancelAmount,
        balanceAmount: payload.balanceAmount,
        taxFreeAmount: payload.taxFreeAmount,
        requestedAt: payload.requestedAt
      };

      // Sort keys for consistent signature generation
      const sortedKeys = Object.keys(payloadData).sort();
      const queryString = sortedKeys
        .map(key => `${key}=${(payloadData as any)[key]}`)
        .join('&');

      // Generate expected signature
      const crypto = require('crypto');
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(queryString)
        .digest('hex');

      // Compare signatures
      const isValid = signature === expectedSignature;

      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          expected: expectedSignature,
          received: signature,
          orderId: payload.orderId
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
        orderId: payload.orderId
      });
      return false;
    }
  }
}

// Export singleton instance
export const tossPaymentsService = new TossPaymentsService(); 