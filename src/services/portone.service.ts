/**
 * PortOne Payment Service
 *
 * Comprehensive service for PortOne V2 API integration including:
 * - Payment initialization and preparation
 * - Payment confirmation and verification
 * - Webhook handling for status updates
 * - Error handling and retry mechanisms
 * - Fraud detection and security monitoring
 */

import { PortOneClient, Payment, Common, Webhook } from '@portone/server-sdk';
import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import { PaymentMethod, PaymentStatus, PortOnePaymentStatus, PortOnePaymentMethod } from '../types/database.types';

// PortOne V2 API types
export interface PortOnePaymentRequest {
  storeId: string;
  channelKey: string;
  paymentId: string;
  orderName: string;
  totalAmount: number;
  currency: string;
  payMethod: string;
  customer: {
    customerId?: string;
    fullName: string;
    firstName?: string;
    lastName?: string;
    phoneNumber: string;
    email: string;
    address?: {
      country: string;
      addressLine1: string;
      addressLine2?: string;
      city: string;
      province: string;
      postalCode: string;
    };
  };
  customData?: Record<string, any>;
  windowType?: {
    pc?: 'IFRAME' | 'REDIRECTION' | 'POPUP';
    mobile?: 'IFRAME' | 'REDIRECTION' | 'POPUP';
  };
  redirectUrl?: string;
  noticeUrls?: string[];
  confirmUrl?: string;
  appScheme?: string;
  locale?: string;
  offerPeriod?: {
    range?: {
      from: string;
      to: string;
    };
    interval?: string;
  };
  products?: Array<{
    id: string;
    name: string;
    tag?: string;
    code?: string;
    amount: number;
    quantity: number;
  }>;
}

export interface PortOnePaymentResponse {
  code: string;
  message: string;
  payment?: {
    status: string;
    id: string;
    transactionId: string;
    merchantId: string;
    storeId: string;
    method: {
      type: string;
      provider?: string;
      easyPayProvider?: string;
    };
    channel: {
      type: string;
      id: string;
      key: string;
      name: string;
      pgProvider: string;
      pgMerchantId: string;
    };
    version: string;
    scheduleId?: string;
    billingKey?: string;
    webhookUrl?: string;
    requestedAt: string;
    updatedAt: string;
    statusChangedAt: string;
    orderName: string;
    amount: {
      total: number;
      taxFree?: number;
      vat?: number;
      supply?: number;
      discount?: number;
      paid?: number;
      cancelled?: number;
      cancelledTaxFree?: number;
    };
    currency: string;
    customer: {
      id?: string;
      name?: string;
      firstName?: string;
      lastName?: string;
      phoneNumber?: string;
      email?: string;
      address?: {
        country?: string;
        addressLine1?: string;
        addressLine2?: string;
        city?: string;
        province?: string;
        postalCode?: string;
      };
    };
    promotionId?: string;
    isCulturalExpense?: boolean;
    escrow?: {
      status?: string;
      company?: string;
      invoiceNumber?: string;
      isAutomaticallyCancelledOnConfirmed?: boolean;
    };
    products?: Array<{
      id: string;
      name: string;
      tag?: string;
      code?: string;
      amount: number;
      quantity: number;
    }>;
    productCount?: number;
    customData?: string;
    country?: string;
    paidAt?: string;
    pgTxId?: string;
    receiptUrl?: string;
    cashReceipt?: {
      type?: string;
      pgReceiptId?: string;
      issueNumber?: string;
      totalAmount?: number;
      taxFreeAmount?: number;
      currency?: string;
      url?: string;
      issuedAt?: string;
      cancelledAt?: string;
    };
    separator?: string;
  };
}

export interface PortOneConfirmRequest {
  storeId: string;
  paymentId: string;
  amount: number;
  currency?: string;
}

export interface PortOneCancelRequest {
  storeId: string;
  paymentId: string;
  amount?: number;
  taxFreeAmount?: number;
  vatAmount?: number;
  reason: string;
  requester?: string;
  currentCancellableAmount?: number;
  refundAccount?: {
    bank: string;
    number: string;
    holderName: string;
  };
}

export interface PortOneWebhookPayload {
  type: string;
  timestamp: string;
  data: {
    paymentId: string;
    storeId: string;
    transactionId: string;
    status: string;
    statusChangedAt: string;
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

export class PortOneService {
  private supabase = getSupabaseClient();
  private client: ReturnType<typeof PortOneClient>;
  private readonly storeId: string | undefined;
  private readonly channelKey: string | undefined;
  private readonly webhookSecret: string | undefined;

  constructor() {
    // Use new V2 environment variables with proper SDK initialization
    this.storeId = config.payments.portone.v2.storeId;
    this.channelKey = config.payments.portone.v2.channelKey;
    this.webhookSecret = config.payments.portone.v2.webhookSecret;

    // Initialize official PortOne SDK client only if API secret is available
    if (config.payments.portone.v2.apiSecret) {
      this.client = PortOneClient({
        secret: config.payments.portone.v2.apiSecret
      });
    } else {
      logger.warn('PortOne V2 API secret not configured. SDK initialization skipped for development.');
      // Create a mock client for development
      this.client = null as any;
    }

    if (!this.storeId || !this.channelKey) {
      logger.warn('PortOne V2 configuration is incomplete. Payment processing may fail.');
    }
  }

  /**
   * Initialize payment with PortOne
   */
  async initializePayment(request: PaymentInitiationRequest): Promise<PaymentInitiationResponse> {
    try {
      logger.info('Initializing PortOne payment', {
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.amount,
        isDeposit: request.isDeposit
      });

      // Generate unique payment ID with stage distinction
      const paymentId = this.generatePaymentId(request.reservationId, request.isDeposit, request.paymentStage);

      // Create payment record in database
      const dbPaymentId = await this.createPaymentRecord({
        reservationId: request.reservationId,
        userId: request.userId,
        amount: request.amount,
        isDeposit: request.isDeposit,
        orderId: paymentId,
        paymentStage: request.paymentStage || (request.isDeposit ? 'deposit' : 'single')
      });

      // Prepare PortOne request with stage-specific order name
      const orderName = this.generateOrderName(request.paymentStage || (request.isDeposit ? 'deposit' : 'single'));

      const portoneRequest: PortOnePaymentRequest = {
        storeId: this.storeId,
        channelKey: this.channelKey,
        paymentId,
        orderName,
        totalAmount: request.amount,
        currency: 'KRW',
        payMethod: 'CARD',
        customer: {
          fullName: request.customerName,
          email: request.customerEmail,
          phoneNumber: request.customerPhone || '',
        },
        customData: {
          reservationId: request.reservationId,
          userId: request.userId,
          paymentId: dbPaymentId,
          isDeposit: request.isDeposit
        },
        windowType: {
          pc: 'IFRAME',
          mobile: 'REDIRECTION'
        },
        redirectUrl: request.successUrl || `http://localhost:${config.server.port}/api/payments/success`,
        noticeUrls: [`http://localhost:${config.server.port}/api/webhooks/portone`],
        confirmUrl: `http://localhost:${config.server.port}/api/payments/confirm`
      };

      // This method now primarily creates database records; actual payment initialization
      // should be handled on the client side with PortOne V2 checkout

      // Update payment record with order information
      await this.updatePaymentRecord(dbPaymentId, {
        provider_order_id: paymentId,
        metadata: {
          ...portoneRequest.customData,
          orderName: orderName,
          channelKey: this.channelKey,
          storeId: this.storeId
        }
      });

      logger.info('PortOne payment record created successfully', {
        paymentId: dbPaymentId,
        orderId: paymentId,
        channelKey: this.channelKey
      });

      return {
        paymentKey: paymentId, // Use orderId as paymentKey for now
        orderId: paymentId,
        checkoutUrl: '', // Client-side checkout URL will be generated
        paymentId: dbPaymentId
      };

    } catch (error) {
      logger.error('Failed to initialize PortOne payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get payment information using official SDK
   */
  async getPaymentInfo(paymentId: string): Promise<any> {
    try {
      const payment = await this.client.payment.getPayment({ paymentId });

      logger.info('PortOne payment retrieved via SDK', {
        paymentId,
        status: payment.status,
        amount: (payment as any).amount?.total
      });

      return payment;
    } catch (error) {
      logger.error('PortOne SDK API error', {
        paymentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`PortOne API Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Verify payment completion using official SDK
   */
  async verifyPayment(paymentId: string, expectedAmount: number, expectedOrderName: string): Promise<any> {
    try {
      const payment = await this.getPaymentInfo(paymentId);

      // Check payment status
      if (payment.status !== 'PAID') {
        throw new Error(`Payment not completed. Status: ${payment.status}`);
      }

      // Verify amount
      const paymentAmount = (payment as any).amount?.total;
      if (paymentAmount !== expectedAmount) {
        logger.warn('Payment amount mismatch', {
          paymentId,
          expected: expectedAmount,
          actual: paymentAmount
        });
        throw new Error('Payment amount mismatch');
      }

      // Verify order name
      if (payment.orderName !== expectedOrderName) {
        logger.warn('Payment order name mismatch', {
          paymentId,
          expected: expectedOrderName,
          actual: payment.orderName
        });
        throw new Error('Order name mismatch');
      }

      // Verify this is not a test payment in production
      if (config.server.isProduction && payment.channel.type !== 'LIVE') {
        throw new Error('Test payment detected in production');
      }

      logger.info('Payment verification successful via SDK', {
        paymentId,
        amount: payment.amount.total,
        orderName: payment.orderName
      });

      return payment;
    } catch (error) {
      logger.error('Payment verification failed', {
        paymentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw error;
    }
  }

  /**
   * Confirm payment with PortOne using official SDK
   */
  async confirmPayment(request: PaymentConfirmationRequest): Promise<PaymentConfirmationResponse> {
    try {
      logger.info('Confirming PortOne payment via SDK', {
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

      // Get payment info using SDK
      const payment = await this.verifyPayment(request.paymentKey, request.amount, paymentRecord.metadata?.orderName);

      // Update payment record
      const updatedPayment = await this.updatePaymentRecord(paymentRecord.id, {
        payment_status: this.mapPortOneStatusToPaymentStatus(payment.status),
        provider_transaction_id: payment.transactionId,
        paid_at: new Date().toISOString(),
        metadata: {
          ...paymentRecord.metadata,
          confirmedAt: payment.paidAt,
          method: payment.method?.type,
          receiptUrl: payment.receiptUrl
        }
      });

      logger.info('PortOne payment confirmed successfully via SDK', {
        paymentId: paymentRecord.id,
        status: payment.status,
        transactionId: payment.transactionId
      });

      return {
        paymentId: paymentRecord.id,
        status: this.mapPortOneStatusToPaymentStatus(payment.status),
        transactionId: payment.transactionId || '',
        approvedAt: payment.paidAt || new Date().toISOString(),
        receiptUrl: payment.receiptUrl
      };

    } catch (error) {
      logger.error('Failed to confirm PortOne payment', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Verify webhook using official SDK
   */
  async verifyWebhook(body: string, headers: Record<string, string>): Promise<any> {
    try {
      const webhook = await Webhook.verify(
        this.webhookSecret,
        body,
        headers
      );

      logger.info('Webhook verified successfully via SDK', {
        type: webhook.type
      });

      return webhook;
    } catch (error) {
      if (error instanceof Webhook.WebhookVerificationError) {
        logger.warn('Webhook verification failed via SDK', {
          error: error.message
        });
        throw new Error('Webhook signature verification failed');
      }
      throw error;
    }
  }

  /**
   * Process webhook from PortOne using official SDK
   */
  async processWebhook(body: string, headers: Record<string, string>): Promise<void> {
    try {
      // Verify webhook signature using official SDK
      const webhook = await this.verifyWebhook(body, headers);

      if (!('data' in webhook) || !('paymentId' in webhook.data)) {
        logger.warn('Invalid webhook format - missing payment data');
        return;
      }

      const webhookId = `webhook_${webhook.data.paymentId}_${Date.now()}`;

      logger.info('Processing PortOne webhook via SDK', {
        webhookId,
        paymentId: webhook.data.paymentId,
        type: webhook.type
      });

      // Sync payment status using SDK
      const payment = await this.getPaymentInfo(webhook.data.paymentId);

      // Get payment record from database
      const paymentRecord = await this.getPaymentByProviderId(webhook.data.paymentId);
      if (!paymentRecord) {
        logger.warn('Payment record not found, creating webhook log only', {
          paymentId: webhook.data.paymentId
        });
      } else {
        // Update payment status
        const newStatus = this.mapPortOneStatusToPaymentStatus(payment.status);
        await this.updatePaymentRecord(paymentRecord.id, {
          payment_status: newStatus,
          provider_transaction_id: payment.transactionId,
          metadata: {
            ...paymentRecord.metadata,
            webhookReceivedAt: new Date().toISOString(),
            webhookStatus: payment.status,
            webhookType: webhook.type
          }
        });
      }

      // Log webhook processing
      await this.supabase
        .from('webhook_logs')
        .insert({
          webhook_id: webhookId,
          payment_key: webhook.data.paymentId,
          status: 'processed',
          payload: webhook,
          processed_at: new Date().toISOString()
        });

      logger.info('PortOne webhook processed successfully via SDK', {
        webhookId,
        paymentId: paymentRecord?.id,
        status: payment.status
      });

    } catch (error) {
      logger.error('Failed to process PortOne webhook', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Cancel payment with PortOne using official SDK
   */
  async cancelPayment(paymentId: string, reason: string, amount?: number): Promise<void> {
    try {
      logger.info('Canceling PortOne payment via SDK', {
        paymentId,
        reason,
        amount
      });

      const paymentRecord = await this.getPaymentById(paymentId);
      if (!paymentRecord) {
        throw new Error(`Payment record not found: ${paymentId}`);
      }

      if (!paymentRecord.provider_order_id) {
        throw new Error('Payment has not been initialized yet');
      }

      // Use official SDK to cancel payment
      const cancelRequest: any = {
        paymentId: paymentRecord.provider_order_id,
        reason: reason || 'User requested cancellation'
      };

      if (amount) {
        cancelRequest.amount = amount;
      }

      const result = await this.client.payment.cancelPayment(cancelRequest);

      // Update payment record
      const refundAmount = amount || paymentRecord.amount;
      const newStatus = refundAmount >= paymentRecord.amount ? 'refunded' : 'partially_refunded';

      await this.updatePaymentRecord(paymentId, {
        payment_status: newStatus as PaymentStatus,
        refunded_at: new Date().toISOString(),
        refund_amount: refundAmount,
        metadata: {
          ...paymentRecord.metadata,
          cancelReason: reason,
          canceledAt: new Date().toISOString(),
          cancelResult: result
        }
      });

      logger.info('PortOne payment canceled successfully via SDK', {
        paymentId,
        refundAmount,
        newStatus,
        cancelledAmount: (result as any)?.cancelledAmount
      });

    } catch (error) {
      // Handle PortOne SDK errors
      logger.error('PortOne SDK cancel error', {
        paymentId,
        error: error instanceof Error ? error.message : String(error)
      });
      throw new Error(`Failed to cancel payment: ${error instanceof Error ? error.message : 'Unknown error'}`);

      logger.error('Failed to cancel PortOne payment', {
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
   * Get payment by provider payment ID
   */
  async getPaymentByProviderId(providerId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .or(`provider_order_id.eq.${providerId},metadata->paymentKey.eq.${providerId}`)
      .single();

    if (error) {
      logger.error('Error fetching payment by provider ID:', { error: error.message, providerId });
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
        payment_method: 'portone' as PaymentMethod,
        payment_status: 'pending' as PaymentStatus,
        amount: paymentData.amount,
        currency: 'KRW',
        payment_provider: 'portone',
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
   * Generate unique payment ID with stage distinction
   */
  private generatePaymentId(reservationId: string, isDeposit: boolean, paymentStage?: 'deposit' | 'final' | 'single'): string {
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substr(2, 4);

    let stageType: string;
    if (paymentStage) {
      stageType = paymentStage;
    } else {
      stageType = isDeposit ? 'deposit' : 'single';
    }

    return `pay_${reservationId}_${stageType}_${timestamp}_${randomSuffix}`;
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
   * Map PortOne V2 status to internal payment status using official enums
   */
  private mapPortOneStatusToPaymentStatus(portoneStatus?: string): PaymentStatus {
    const statusMap: Record<PortOnePaymentStatus, PaymentStatus> = {
      'READY': 'pending',
      'PAID': 'fully_paid',
      'FAILED': 'failed',
      'CANCELLED': 'refunded',
      'PARTIAL_CANCELLED': 'partially_refunded',
      'PAY_PENDING': 'pending',
      'VIRTUAL_ACCOUNT_ISSUED': 'pending'
    };

    if (portoneStatus && portoneStatus in statusMap) {
      return statusMap[portoneStatus as PortOnePaymentStatus];
    }

    logger.warn('Unknown PortOne payment status', { portoneStatus });
    return 'pending';
  }

  /**
   * Map PortOne V2 payment method to internal method using official enums
   */
  private mapPortOneMethodToPaymentMethod(portoneMethod?: string): PaymentMethod {
    const methodMap: Record<PortOnePaymentMethod, PaymentMethod> = {
      'CARD': 'card',
      'TRANSFER': 'bank_transfer',
      'VIRTUAL_ACCOUNT': 'virtual_account',
      'GIFT_CERTIFICATE': 'gift_certificate',
      'MOBILE': 'mobile',
      'EASY_PAY': 'easy_pay',
      'CONVENIENCE_STORE': 'convenience_store',
      'POINT': 'point'
    };

    if (portoneMethod && portoneMethod in methodMap) {
      return methodMap[portoneMethod as PortOnePaymentMethod];
    }

    logger.warn('Unknown PortOne payment method', { portoneMethod });
    return 'card';
  }

}

// Export singleton instance
export const portOneService = new PortOneService();