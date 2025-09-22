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
  paymentStage?: 'deposit' | 'final' | 'single';
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

      // Generate unique order ID with payment stage distinction
      const orderId = this.generateOrderId(request.reservationId, request.isDeposit, request.paymentStage);
      
      // Create payment record in database
      const paymentId = await this.createPaymentRecord({
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.amount,
        isDeposit: request.isDeposit,
        orderId,
        paymentStage: request.paymentStage || (request.isDeposit ? 'deposit' : 'single')
      });

      // Prepare TossPayments request with stage-specific order name
      const orderName = this.generateOrderName(request.paymentStage || (request.isDeposit ? 'deposit' : 'single'));
      
      const tossRequest: TossPaymentRequest = {
        amount: request.amount,
        orderId,
        orderName,
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

      // Validate payment stage for final payments
      if (paymentRecord.payment_stage === 'final') {
        await this.validateFinalPaymentConditions(paymentRecord);
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

      // v3.1 Flow: Do not automatically update reservation status after payment
      // Reservations remain in 'requested' status until shop owner confirms
      logger.info('Payment confirmed - reservation remains in requested status (v3.1 flow)', {
        reservationId: paymentRecord.reservation_id,
        isDeposit: paymentRecord.is_deposit,
        note: 'Reservation status unchanged - will be confirmed by shop owner action'
      });

      // Note: If future changes require automatic status updates after payment confirmation,
      // they should use the state machine validation to ensure proper business rules:
      // const { reservationStateMachine } = await import('./reservation-state-machine.service');
      // const result = await reservationStateMachine.executeTransition(
      //   paymentRecord.reservation_id,
      //   newStatus,
      //   'system',
      //   'payment-system',
      //   'Automatic status update after payment confirmation',
      //   { paymentStatus: newStatus, paymentId: paymentRecord.id }
      // );

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
    const startTime = Date.now();
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
      const isDuplicate = await this.checkWebhookIdempotency(payload.paymentKey, payload.status, webhookId);
      if (isDuplicate) {
        logger.info('Webhook already processed, skipping duplicate', {
          webhookId,
          paymentKey: payload.paymentKey,
          status: payload.status
        });
        return;
      }

      // Get payment record with reservation details
      const paymentRecord = await this.getPaymentByOrderIdWithDetails(payload.orderId);
      if (!paymentRecord) {
        throw new Error(`Payment record not found for order ID: ${payload.orderId}`);
      }

      // Log payment stage information
      logger.info('Processing webhook for payment stage', {
        webhookId,
        paymentStage: paymentRecord.payment_stage,
        isDeposit: paymentRecord.is_deposit,
        reservationId: paymentRecord.reservation_id,
        reservationStatus: paymentRecord.reservations?.status
      });

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

        // Process payment stage-specific webhook logic
        await this.processPaymentStageWebhook(paymentRecord, payload, webhookId, attempt);

        // v3.1 Flow: Do not automatically update reservation status after webhook payment confirmation
        // Reservations remain in 'requested' status until shop owner confirms
        logger.info('Webhook payment processed - reservation remains in requested status (v3.1 flow)', {
          reservationId: paymentRecord.reservation_id,
          isDeposit: paymentRecord.is_deposit,
          paymentStage: paymentRecord.payment_stage,
          paymentStatus: newStatus,
          note: 'Reservation status unchanged - will be confirmed by shop owner action'
        });

        // Note: If future changes require automatic status updates after webhook processing,
        // they should use the state machine validation to ensure proper business rules:
        // const { reservationStateMachine } = await import('./reservation-state-machine.service');
        // const result = await reservationStateMachine.executeTransition(
        //   paymentRecord.reservation_id,
        //   newStatus,
        //   'system',
        //   'webhook-system',
        //   'Automatic status update after webhook payment processing',
        //   { paymentStatus: newStatus, webhookId, attempt }
        // );

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
   * Check for webhook idempotency using enhanced security service
   */
  private async checkWebhookIdempotency(paymentKey: string, status: string, webhookId?: string): Promise<boolean> {
    try {
      const { webhookSecurityService } = require('./webhook-security.service');
      return await webhookSecurityService.checkIdempotency(paymentKey, status, webhookId || 'unknown');
    } catch (error) {
      logger.error('Error checking webhook idempotency', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentKey,
        status
      });
      // If error, assume not duplicate to allow processing
      return false;
    }
  }

  /**
   * Mark webhook as processed using enhanced security service
   */
  private async markWebhookAsProcessed(paymentKey: string, status: string, webhookId: string, processingDuration?: number): Promise<void> {
    try {
      const { webhookSecurityService } = require('./webhook-security.service');
      await webhookSecurityService.markAsProcessed(paymentKey, status, webhookId, processingDuration || 0);
    } catch (error) {
      logger.warn('Failed to mark webhook as processed', {
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
   * Cancel payment with enhanced two-stage payment support
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

      // Handle two-stage payment cancellation scenarios
      await this.processTwoStagePaymentCancellation(paymentRecord, reason, amount);

      const cancelRequest: TossPaymentCancelRequest = {
        cancelReason: reason,
        cancelAmount: amount || paymentRecord.amount
      };

      await this.callTossPaymentsAPI(
        `/v1/payments/${paymentRecord.provider_transaction_id}/cancel`,
        'POST',
        cancelRequest
      );

      // Update payment record with enhanced status tracking
      const refundAmount = amount || paymentRecord.amount;
      const newStatus = this.determineRefundStatus(paymentRecord, refundAmount);

      await this.updatePaymentRecord(paymentId, {
        payment_status: newStatus,
        refunded_at: new Date().toISOString(),
        refund_amount: refundAmount,
        metadata: {
          ...paymentRecord.metadata,
          cancelReason: reason,
          canceledAt: new Date().toISOString(),
          paymentStage: paymentRecord.payment_stage,
          twoStageCancellation: true
        }
      });

      logger.info('TossPayments payment canceled successfully', {
        paymentId,
        paymentStage: paymentRecord.payment_stage,
        refundAmount,
        newStatus
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
   * Get payment by order ID with reservation details
   */
  async getPaymentByOrderIdWithDetails(orderId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select(`
        *,
        reservations!inner(*)
      `)
      .eq('provider_order_id', orderId)
      .single();

    if (error) {
      logger.error('Error fetching payment with details by order ID:', { error: error.message, orderId });
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
    paymentStage?: 'deposit' | 'final' | 'single';
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
        payment_stage: paymentData.paymentStage || (paymentData.isDeposit ? 'deposit' : 'single'),
        metadata: {
          createdAt: new Date().toISOString(),
          isDeposit: paymentData.isDeposit,
          paymentStage: paymentData.paymentStage || (paymentData.isDeposit ? 'deposit' : 'single')
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
   * Generate unique order ID with payment stage distinction
   */
  private generateOrderId(reservationId: string, isDeposit: boolean, paymentStage?: 'deposit' | 'final' | 'single'): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 4);
    
    // Determine stage type based on paymentStage parameter or isDeposit flag
    let stageType: string;
    if (paymentStage) {
      stageType = paymentStage;
    } else {
      stageType = isDeposit ? 'deposit' : 'single';
    }
    
    return `order_${reservationId}_${stageType}_${timestamp}_${randomSuffix}`;
  }

  /**
   * Generate descriptive order name based on payment stage
   */
  private generateOrderName(paymentStage: 'deposit' | 'final' | 'single'): string {
    switch (paymentStage) {
      case 'deposit':
        return '에뷰리띵 예약금 결제';
      case 'final':
        return '에뷰리띵 최종 결제';
      case 'single':
        return '에뷰리띵 전체 결제';
      default:
        return '에뷰리띵 결제';
    }
  }

  /**
   * Validate conditions for final payment processing
   */
  private async validateFinalPaymentConditions(paymentRecord: any): Promise<void> {
    try {
      // Get reservation details
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('status, total_price, deposit_amount')
        .eq('id', paymentRecord.reservation_id)
        .single();

      if (reservationError || !reservation) {
        throw new Error(`Reservation not found for payment: ${paymentRecord.id}`);
      }

      // Check if service is completed
      if (reservation.status !== 'completed') {
        throw new Error(`Final payment can only be processed after service completion. Current status: ${reservation.status}`);
      }

      // Check if deposit was paid
      const { data: depositPayment } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', paymentRecord.reservation_id)
        .eq('payment_stage', 'deposit')
        .eq('payment_status', 'deposit_paid')
        .single();

      if (!depositPayment) {
        throw new Error('Final payment requires successful deposit payment');
      }

      // Validate final payment amount (should be total_price - deposit_amount)
      const expectedFinalAmount = reservation.total_price - reservation.deposit_amount;
      if (paymentRecord.amount !== expectedFinalAmount) {
        throw new Error(`Final payment amount mismatch. Expected: ${expectedFinalAmount}, Received: ${paymentRecord.amount}`);
      }

      logger.info('Final payment conditions validated successfully', {
        paymentId: paymentRecord.id,
        reservationId: paymentRecord.reservation_id,
        finalAmount: paymentRecord.amount,
        expectedAmount: expectedFinalAmount
      });

    } catch (error) {
      logger.error('Final payment validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: paymentRecord.id,
        reservationId: paymentRecord.reservation_id
      });
      throw error;
    }
  }

  /**
   * Process payment stage-specific webhook logic
   */
  private async processPaymentStageWebhook(
    paymentRecord: any,
    payload: TossWebhookPayload,
    webhookId: string,
    attempt: number
  ): Promise<void> {
    try {
      const paymentStage = paymentRecord.payment_stage || (paymentRecord.is_deposit ? 'deposit' : 'single');
      
      logger.info('Processing payment stage webhook', {
        paymentStage,
        paymentId: paymentRecord.id,
        reservationId: paymentRecord.reservation_id,
        webhookId,
        attempt,
        status: payload.status
      });

      switch (paymentStage) {
        case 'deposit':
          await this.processDepositPaymentWebhook(paymentRecord, payload, webhookId);
          break;
        case 'final':
          await this.processFinalPaymentWebhook(paymentRecord, payload, webhookId);
          break;
        case 'single':
          await this.processSinglePaymentWebhook(paymentRecord, payload, webhookId);
          break;
        default:
          logger.warn('Unknown payment stage in webhook processing', {
            paymentStage,
            paymentId: paymentRecord.id,
            webhookId
          });
      }
    } catch (error) {
      logger.error('Error processing payment stage webhook', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: paymentRecord.id,
        paymentStage: paymentRecord.payment_stage,
        webhookId,
        attempt
      });
      throw error;
    }
  }

  /**
   * Process deposit payment webhook
   */
  private async processDepositPaymentWebhook(
    paymentRecord: any,
    payload: TossWebhookPayload,
    webhookId: string
  ): Promise<void> {
    logger.info('Processing deposit payment webhook', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      webhookId,
      amount: payload.totalAmount
    });

    // Additional deposit-specific logic can be added here
    // For example, triggering deposit confirmation notifications
  }

  /**
   * Process final payment webhook
   */
  private async processFinalPaymentWebhook(
    paymentRecord: any,
    payload: TossWebhookPayload,
    webhookId: string
  ): Promise<void> {
    logger.info('Processing final payment webhook', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      webhookId,
      amount: payload.totalAmount
    });

    // Additional final payment-specific logic can be added here
    // For example, triggering final payment completion notifications
  }

  /**
   * Process single payment webhook
   */
  private async processSinglePaymentWebhook(
    paymentRecord: any,
    payload: TossWebhookPayload,
    webhookId: string
  ): Promise<void> {
    logger.info('Processing single payment webhook', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      webhookId,
      amount: payload.totalAmount
    });

    // Additional single payment-specific logic can be added here
  }

  /**
   * Process two-stage payment cancellation scenarios
   */
  private async processTwoStagePaymentCancellation(
    paymentRecord: any,
    reason: string,
    amount?: number
  ): Promise<void> {
    try {
      const paymentStage = paymentRecord.payment_stage || (paymentRecord.is_deposit ? 'deposit' : 'single');
      
      logger.info('Processing two-stage payment cancellation', {
        paymentId: paymentRecord.id,
        paymentStage,
        reservationId: paymentRecord.reservation_id,
        reason,
        amount
      });

      // Get reservation details for context
      const { data: reservation, error: reservationError } = await this.supabase
        .from('reservations')
        .select('status, total_price, deposit_amount')
        .eq('id', paymentRecord.reservation_id)
        .single();

      if (reservationError || !reservation) {
        logger.warn('Reservation not found for payment cancellation', {
          paymentId: paymentRecord.id,
          reservationId: paymentRecord.reservation_id
        });
        return;
      }

      // Handle different cancellation scenarios based on payment stage
      switch (paymentStage) {
        case 'deposit':
          await this.handleDepositPaymentCancellation(paymentRecord, reservation, reason, amount);
          break;
        case 'final':
          await this.handleFinalPaymentCancellation(paymentRecord, reservation, reason, amount);
          break;
        case 'single':
          await this.handleSinglePaymentCancellation(paymentRecord, reservation, reason, amount);
          break;
        default:
          logger.warn('Unknown payment stage in cancellation', {
            paymentId: paymentRecord.id,
            paymentStage
          });
      }

    } catch (error) {
      logger.error('Error processing two-stage payment cancellation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: paymentRecord.id,
        reservationId: paymentRecord.reservation_id
      });
      throw error;
    }
  }

  /**
   * Handle deposit payment cancellation
   */
  private async handleDepositPaymentCancellation(
    paymentRecord: any,
    reservation: any,
    reason: string,
    amount?: number
  ): Promise<void> {
    logger.info('Handling deposit payment cancellation', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      depositAmount: paymentRecord.amount,
      reason
    });

    // Check if final payment exists and needs to be cancelled too
    const { data: finalPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', paymentRecord.reservation_id)
      .eq('payment_stage', 'final')
      .eq('payment_status', 'final_payment_paid')
      .single();

    if (finalPayment) {
      logger.info('Final payment exists - processing full cancellation', {
        depositPaymentId: paymentRecord.id,
        finalPaymentId: finalPayment.id,
        totalRefund: paymentRecord.amount + finalPayment.amount
      });

      // Cancel final payment as well for full refund
      await this.cancelPayment(finalPayment.id, `Full cancellation due to deposit refund: ${reason}`);
    }

    // Apply cancellation policy based on timing
    const refundAmount = await this.calculateCancellationRefund(
      paymentRecord,
      reservation,
      'deposit_cancellation'
    );

    logger.info('Deposit cancellation processed', {
      paymentId: paymentRecord.id,
      originalAmount: paymentRecord.amount,
      refundAmount,
      reason
    });
  }

  /**
   * Handle final payment cancellation
   */
  private async handleFinalPaymentCancellation(
    paymentRecord: any,
    reservation: any,
    reason: string,
    amount?: number
  ): Promise<void> {
    logger.info('Handling final payment cancellation', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      finalAmount: paymentRecord.amount,
      reason
    });

    // Check if deposit was already paid
    const { data: depositPayment } = await this.supabase
      .from('payments')
      .select('*')
      .eq('reservation_id', paymentRecord.reservation_id)
      .eq('payment_stage', 'deposit')
      .eq('payment_status', 'deposit_paid')
      .single();

    if (depositPayment) {
      logger.info('Deposit payment exists - processing partial refund', {
        depositPaymentId: depositPayment.id,
        finalPaymentId: paymentRecord.id,
        totalRefund: amount || paymentRecord.amount
      });
    }

    // Apply cancellation policy based on timing and service completion
    const refundAmount = await this.calculateCancellationRefund(
      paymentRecord,
      reservation,
      'final_payment_cancellation'
    );

    logger.info('Final payment cancellation processed', {
      paymentId: paymentRecord.id,
      originalAmount: paymentRecord.amount,
      refundAmount,
      reason
    });
  }

  /**
   * Handle single payment cancellation
   */
  private async handleSinglePaymentCancellation(
    paymentRecord: any,
    reservation: any,
    reason: string,
    amount?: number
  ): Promise<void> {
    logger.info('Handling single payment cancellation', {
      paymentId: paymentRecord.id,
      reservationId: paymentRecord.reservation_id,
      totalAmount: paymentRecord.amount,
      reason
    });

    // Apply cancellation policy based on timing
    const refundAmount = await this.calculateCancellationRefund(
      paymentRecord,
      reservation,
      'single_payment_cancellation'
    );

    logger.info('Single payment cancellation processed', {
      paymentId: paymentRecord.id,
      originalAmount: paymentRecord.amount,
      refundAmount,
      reason
    });
  }

  /**
   * Calculate refund amount based on cancellation policy and timing
   */
  private async calculateCancellationRefund(
    paymentRecord: any,
    reservation: any,
    cancellationType: 'deposit_cancellation' | 'final_payment_cancellation' | 'single_payment_cancellation'
  ): Promise<number> {
    try {
      const paymentDate = new Date(paymentRecord.paid_at || paymentRecord.created_at);
      const now = new Date();
      const hoursSincePayment = Math.floor((now.getTime() - paymentDate.getTime()) / (1000 * 60 * 60));

      // Get reservation date for timing calculations
      const reservationDate = new Date(reservation.reservation_date);
      const hoursUntilReservation = Math.floor((reservationDate.getTime() - now.getTime()) / (1000 * 60 * 60));

      let refundPercentage = 100; // Default full refund

      // Apply 24-hour rule for cancellations
      if (hoursUntilReservation < 24) {
        refundPercentage = 50; // 50% refund if cancelled within 24 hours
        logger.info('Applying 24-hour cancellation policy', {
          hoursUntilReservation,
          refundPercentage,
          cancellationType
        });
      }

      // Apply cancellation type-specific rules
      switch (cancellationType) {
        case 'deposit_cancellation':
          // Deposits generally have more lenient refund policies
          if (hoursUntilReservation >= 48) {
            refundPercentage = 100;
          } else if (hoursUntilReservation >= 24) {
            refundPercentage = 80;
          }
          break;
        case 'final_payment_cancellation':
          // Final payments may have stricter policies if service was completed
          if (reservation.status === 'completed') {
            refundPercentage = 0; // No refund after service completion
          }
          break;
        case 'single_payment_cancellation':
          // Standard cancellation policy
          break;
      }

      const refundAmount = Math.round((paymentRecord.amount * refundPercentage) / 100);

      logger.info('Cancellation refund calculated', {
        paymentId: paymentRecord.id,
        originalAmount: paymentRecord.amount,
        refundPercentage,
        refundAmount,
        hoursSincePayment,
        hoursUntilReservation,
        cancellationType
      });

      return refundAmount;

    } catch (error) {
      logger.error('Error calculating cancellation refund', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentId: paymentRecord.id
      });
      return paymentRecord.amount; // Default to full refund on error
    }
  }

  /**
   * Determine refund status based on payment stage and amount
   */
  private determineRefundStatus(paymentRecord: any, refundAmount: number): PaymentStatus {
    const paymentStage = paymentRecord.payment_stage || (paymentRecord.is_deposit ? 'deposit' : 'single');
    const originalAmount = paymentRecord.amount;

    if (refundAmount >= originalAmount) {
      // Full refund
      switch (paymentStage) {
        case 'deposit':
          return 'deposit_refunded';
        case 'final':
          return 'final_payment_refunded';
        case 'single':
          return 'refunded';
        default:
          return 'refunded';
      }
    } else if (refundAmount > 0) {
      // Partial refund
      switch (paymentStage) {
        case 'deposit':
          return 'partially_refunded';
        case 'final':
          return 'partially_refunded';
        case 'single':
          return 'partially_refunded';
        default:
          return 'partially_refunded';
      }
    } else {
      // No refund
      return paymentRecord.payment_status; // Keep original status
    }
  }

  /**
   * Cancel all payments for a reservation with refund processing
   */
  async cancelReservationPayments(reservationId: string, reason: string): Promise<{
    totalRefundAmount: number;
    refundedPayments: Array<{
      paymentId: string;
      paymentStage: string;
      refundAmount: number;
      refundStatus: PaymentStatus;
    }>;
  }> {
    try {
      logger.info('Canceling all payments for reservation', {
        reservationId,
        reason
      });

      // Get all paid payments for the reservation
      const { data: payments, error: paymentsError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', reservationId)
        .in('payment_status', ['deposit_paid', 'final_payment_paid', 'fully_paid'])
        .order('created_at', { ascending: true });

      if (paymentsError) {
        throw new Error(`Failed to fetch payments: ${paymentsError.message}`);
      }

      if (!payments || payments.length === 0) {
        logger.info('No paid payments found for reservation', { reservationId });
        return {
          totalRefundAmount: 0,
          refundedPayments: []
        };
      }

      const refundedPayments = [];
      let totalRefundAmount = 0;

      // Process each payment for cancellation
      for (const payment of payments) {
        try {
          // Calculate refund amount based on cancellation policy
          const refundAmount = await this.calculateCancellationRefund(
            payment,
            { status: 'cancelled' }, // Simplified reservation object
            payment.payment_stage === 'deposit' ? 'deposit_cancellation' : 
            payment.payment_stage === 'final' ? 'final_payment_cancellation' : 'single_payment_cancellation'
          );

          if (refundAmount > 0) {
            // Cancel the payment
            await this.cancelPayment(payment.id, reason, refundAmount);
            
            const refundStatus = this.determineRefundStatus(payment, refundAmount);
            
            refundedPayments.push({
              paymentId: payment.id,
              paymentStage: payment.payment_stage || 'single',
              refundAmount,
              refundStatus
            });

            totalRefundAmount += refundAmount;

            logger.info('Payment cancelled successfully', {
              paymentId: payment.id,
              paymentStage: payment.payment_stage,
              originalAmount: payment.amount,
              refundAmount,
              refundStatus
            });
          }
        } catch (error) {
          logger.error('Failed to cancel individual payment', {
            error: error instanceof Error ? error.message : 'Unknown error',
            paymentId: payment.id,
            reservationId
          });
          // Continue with other payments even if one fails
        }
      }

      logger.info('Reservation payment cancellation completed', {
        reservationId,
        totalPayments: payments.length,
        refundedPayments: refundedPayments.length,
        totalRefundAmount
      });

      return {
        totalRefundAmount,
        refundedPayments
      };

    } catch (error) {
      logger.error('Failed to cancel reservation payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId,
        reason
      });
      throw error;
    }
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