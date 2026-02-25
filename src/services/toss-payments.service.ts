/**
 * TossPayments Service Stub
 *
 * Minimal stub module so that test files can import and mock this module.
 * The actual TossPayments integration is planned but not yet implemented.
 * All test suites that reference this module mock it entirely, so the
 * runtime implementations here are intentionally placeholder / no-op.
 *
 * TODO: Replace stubs with real TossPayments API integration.
 */

import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaymentInitiationRequest {
  reservationId: string;
  userId: string;
  amount: number;
  customerName: string;
  customerEmail: string;
  customerMobilePhone: string;
  isDeposit: boolean;
}

export interface PaymentInitiationResponse {
  paymentKey: string;
  orderId: string;
  amount: number;
  status: string;
  checkoutUrl?: string;
}

export interface PaymentConfirmationRequest {
  paymentKey: string;
  orderId: string;
  amount: number;
}

export interface PaymentConfirmationResponse {
  success: boolean;
  paymentKey: string;
  status: string;
  approvedAt?: string;
  receipt?: { url: string };
}

export interface PaymentCancellationRequest {
  paymentKey?: string;
  orderId?: string;
  amount: number;
  cancelReason: string;
}

export interface PaymentCancellationResponse {
  success: boolean;
  cancelAmount: number;
  cancelReason: string;
  canceledAt: string;
}

export interface TossWebhookPayload {
  paymentKey: string;
  orderId: string;
  status: string;
  totalAmount: number;
  approvedAt: string;
  method: string;
  suppliedAmount?: number;
  vat?: number;
  useEscrow?: boolean;
  currency?: string;
  secret?: string;
  type?: string;
  country?: string;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class TossPaymentsService {
  /**
   * Initiate a payment via TossPayments API.
   * Stub -- throws until a real implementation is provided.
   */
  async initiatePayment(
    request: PaymentInitiationRequest,
  ): Promise<PaymentInitiationResponse> {
    logger.warn('TossPaymentsService.initiatePayment called but not yet implemented');
    throw new Error('TossPaymentsService.initiatePayment is not yet implemented');
  }

  /**
   * Confirm a previously initiated payment.
   * Stub -- throws until a real implementation is provided.
   */
  async confirmPayment(
    request: PaymentConfirmationRequest,
  ): Promise<PaymentConfirmationResponse> {
    logger.warn('TossPaymentsService.confirmPayment called but not yet implemented');
    throw new Error('TossPaymentsService.confirmPayment is not yet implemented');
  }

  /**
   * Cancel / refund a payment.
   * Stub -- throws until a real implementation is provided.
   */
  async cancelPayment(
    request: PaymentCancellationRequest,
  ): Promise<PaymentCancellationResponse> {
    logger.warn('TossPaymentsService.cancelPayment called but not yet implemented');
    throw new Error('TossPaymentsService.cancelPayment is not yet implemented');
  }

  /**
   * Query the current status of a payment.
   * Stub -- throws until a real implementation is provided.
   */
  async getPaymentStatus(paymentKey: string): Promise<any> {
    logger.warn('TossPaymentsService.getPaymentStatus called but not yet implemented');
    throw new Error('TossPaymentsService.getPaymentStatus is not yet implemented');
  }

  /**
   * Process an incoming TossPayments webhook payload.
   * Stub -- throws until a real implementation is provided.
   */
  async processWebhook(payload: TossWebhookPayload): Promise<void> {
    logger.warn('TossPaymentsService.processWebhook called but not yet implemented');
    throw new Error('TossPaymentsService.processWebhook is not yet implemented');
  }

  /**
   * Verify the HMAC signature of a webhook payload.
   * Stub -- returns false until a real implementation is provided.
   */
  verifyWebhookSignature(payload: any): boolean {
    logger.warn('TossPaymentsService.verifyWebhookSignature called but not yet implemented');
    return false;
  }
}

// Singleton instance for modules that import { tossPaymentsService }
export const tossPaymentsService = new TossPaymentsService();
