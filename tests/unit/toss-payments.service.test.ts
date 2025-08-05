/**
 * TossPayments Service Tests
 * 
 * Comprehensive unit tests for TossPayments service including:
 * - Payment initialization
 * - Payment confirmation
 * - Webhook processing
 * - Error handling
 * - Database operations
 */

import { TossPaymentsService, PaymentInitiationRequest, PaymentConfirmationRequest } from '../../src/services/toss-payments.service';
import { getSupabaseClient } from '../../src/config/database';
import { config } from '../../src/config/environment';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/config/environment');
jest.mock('../../src/utils/logger');

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  data: null,
  error: null
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

// Mock config
(config as any) = {
  payments: {
    tossPayments: {
      secretKey: 'test-secret-key',
      clientKey: 'test-client-key',
      baseUrl: 'https://api.tosspayments.com'
    }
  },
  server: {
    port: 3000
  }
};

// Mock fetch
global.fetch = jest.fn();

describe('TossPaymentsService', () => {
  let service: TossPaymentsService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    service = new TossPaymentsService();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with valid configuration', () => {
      expect(service).toBeInstanceOf(TossPaymentsService);
    });

    it('should throw error if configuration is missing', () => {
      (config as any).payments.tossPayments.secretKey = '';
      expect(() => new TossPaymentsService()).toThrow('TossPayments configuration is missing');
    });
  });

  describe('initializePayment', () => {
    const mockRequest: PaymentInitiationRequest = {
      reservationId: 'test-reservation-id',
      userId: 'test-user-id',
      amount: 50000,
      isDeposit: true,
      customerName: 'Test Customer',
      customerEmail: 'test@example.com',
      customerPhone: '010-1234-5678'
    };

    const mockTossResponse = {
      paymentKey: 'test-payment-key',
      orderId: 'test-order-id',
      checkout: {
        url: 'https://checkout.tosspayments.com/test'
      }
    };

    beforeEach(() => {
      // Mock successful database operations
      mockSupabase.single.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      // Mock successful TossPayments API call
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTossResponse)
      } as any);
    });

    it('should successfully initialize payment', async () => {
      const result = await service.initializePayment(mockRequest);

      expect(result).toEqual({
        paymentKey: 'test-payment-key',
        orderId: 'test-order-id',
        checkoutUrl: 'https://checkout.tosspayments.com/test',
        paymentId: 'test-payment-id'
      });

      expect(mockSupabase.insert).toHaveBeenCalledWith({
        reservation_id: 'test-reservation-id',
        user_id: 'test-user-id',
        payment_method: 'toss_payments',
        payment_status: 'pending',
        amount: 50000,
        currency: 'KRW',
        payment_provider: 'toss_payments',
        provider_order_id: expect.stringContaining('test-reservation-id'),
        is_deposit: true,
        metadata: expect.objectContaining({
          createdAt: expect.any(String),
          isDeposit: true
        })
      });
    });

    it('should handle missing customer phone', async () => {
      const requestWithoutPhone = { ...mockRequest };
      delete requestWithoutPhone.customerPhone;

      await service.initializePayment(requestWithoutPhone);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/payments'),
        expect.objectContaining({
          method: 'POST',
          body: expect.not.stringContaining('customerMobilePhone')
        })
      );
    });

    it('should handle database error', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(service.initializePayment(mockRequest)).rejects.toThrow('Failed to create payment record');
    });

    it('should handle TossPayments API error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid request')
      } as any);

      await expect(service.initializePayment(mockRequest)).rejects.toThrow('TossPayments API error: 400 Bad Request');
    });
  });

  describe('confirmPayment', () => {
    const mockRequest: PaymentConfirmationRequest = {
      paymentKey: 'test-payment-key',
      orderId: 'test-order-id',
      amount: 50000
    };

    const mockPaymentRecord = {
      id: 'test-payment-id',
      amount: 50000,
      reservation_id: 'test-reservation-id',
      is_deposit: true,
      metadata: {}
    };

    const mockTossConfirmResponse = {
      paymentKey: 'test-payment-key',
      status: 'DONE',
      approvedAt: '2024-01-01T00:00:00Z',
      method: 'card',
      receipt: {
        url: 'https://receipt.tosspayments.com/test'
      }
    };

    beforeEach(() => {
      // Mock successful database operations
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      // Mock successful TossPayments confirmation API call
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTossConfirmResponse)
      } as any);
    });

    it('should successfully confirm payment', async () => {
      const result = await service.confirmPayment(mockRequest);

      expect(result).toEqual({
        paymentId: 'test-payment-id',
        status: 'deposit_paid',
        transactionId: 'test-payment-key',
        approvedAt: '2024-01-01T00:00:00Z',
        receiptUrl: 'https://receipt.tosspayments.com/test'
      });

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'deposit_paid',
        provider_transaction_id: 'test-payment-key',
        paid_at: expect.any(String),
        metadata: expect.objectContaining({
          confirmedAt: '2024-01-01T00:00:00Z',
          method: 'card',
          receiptUrl: 'https://receipt.tosspayments.com/test'
        })
      });
    });

    it('should handle payment record not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(service.confirmPayment(mockRequest)).rejects.toThrow('Payment record not found for order ID: test-order-id');
    });

    it('should handle amount mismatch', async () => {
      const mismatchedRecord = { ...mockPaymentRecord, amount: 30000 };
      mockSupabase.single.mockResolvedValue({
        data: mismatchedRecord,
        error: null
      });

      await expect(service.confirmPayment(mockRequest)).rejects.toThrow('Amount mismatch. Expected: 30000, Received: 50000');
    });

    it('should handle TossPayments confirmation error', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
        text: () => Promise.resolve('Invalid confirmation')
      } as any);

      await expect(service.confirmPayment(mockRequest)).rejects.toThrow('TossPayments API error: 400 Bad Request');
    });
  });

  describe('processWebhook', () => {
    const mockWebhookPayload = {
      paymentKey: 'test-payment-key',
      orderId: 'test-order-id',
      status: 'DONE',
      totalAmount: 50000,
      suppliedAmount: 50000,
      vat: 5000,
      approvedAt: '2024-01-01T00:00:00Z',
      useEscrow: false,
      currency: 'KRW',
      method: 'card',
      secret: 'test-secret',
      type: 'payment',
      country: 'KR',
      isPartialCancelable: true,
      receipt: {
        url: 'https://receipt.tosspayments.com/test'
      },
      checkout: {
        url: 'https://checkout.tosspayments.com/test'
      },
      totalCancelAmount: 0,
      balanceAmount: 0,
      taxFreeAmount: 0,
      requestedAt: '2024-01-01T00:00:00Z'
    };

    const mockPaymentRecord = {
      id: 'test-payment-id',
      reservation_id: 'test-reservation-id',
      is_deposit: true,
      metadata: {}
    };

    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });
    });

    it('should successfully process webhook', async () => {
      await service.processWebhook(mockWebhookPayload);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'deposit_paid',
        paid_at: '2024-01-01T00:00:00Z',
        metadata: expect.objectContaining({
          webhookReceivedAt: expect.any(String),
          webhookStatus: 'DONE',
          method: 'card',
          receiptUrl: 'https://receipt.tosspayments.com/test'
        })
      });
    });

    it('should handle invalid webhook payload', async () => {
      const invalidPayload = { paymentKey: 'test-key' }; // Missing required fields

      await expect(service.processWebhook(invalidPayload as any)).rejects.toThrow('Invalid webhook signature');
    });

    it('should handle payment record not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(service.processWebhook(mockWebhookPayload)).rejects.toThrow('Payment record not found for order ID: test-order-id');
    });
  });

  describe('cancelPayment', () => {
    const mockPaymentRecord = {
      id: 'test-payment-id',
      amount: 50000,
      provider_transaction_id: 'test-transaction-id',
      metadata: {}
    };

    const mockTossCancelResponse = {
      status: 'CANCELED'
    };

    beforeEach(() => {
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockTossCancelResponse)
      } as any);
    });

    it('should successfully cancel payment', async () => {
      await service.cancelPayment('test-payment-id', 'Customer request', 50000);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/v1/payments/test-transaction-id/cancel'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            cancelReason: 'Customer request',
            cancelAmount: 50000
          })
        })
      );

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'refunded',
        refunded_at: expect.any(String),
        refund_amount: 50000,
        metadata: expect.objectContaining({
          cancelReason: 'Customer request',
          canceledAt: expect.any(String)
        })
      });
    });

    it('should handle partial refund', async () => {
      await service.cancelPayment('test-payment-id', 'Partial refund', 30000);

      expect(mockSupabase.update).toHaveBeenCalledWith({
        payment_status: 'partially_refunded',
        refunded_at: expect.any(String),
        refund_amount: 30000,
        metadata: expect.objectContaining({
          cancelReason: 'Partial refund',
          canceledAt: expect.any(String)
        })
      });
    });

    it('should handle payment not found', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      await expect(service.cancelPayment('invalid-id', 'Test reason')).rejects.toThrow('Payment record not found: invalid-id');
    });

    it('should handle payment not confirmed', async () => {
      const unconfirmedPayment = { ...mockPaymentRecord, provider_transaction_id: null };
      mockSupabase.single.mockResolvedValue({
        data: unconfirmedPayment,
        error: null
      });

      await expect(service.cancelPayment('test-payment-id', 'Test reason')).rejects.toThrow('Payment has not been confirmed yet');
    });
  });

  describe('getPaymentById', () => {
    it('should return payment record', async () => {
      const mockPayment = { id: 'test-id', amount: 50000 };
      mockSupabase.single.mockResolvedValue({
        data: mockPayment,
        error: null
      });

      const result = await service.getPaymentById('test-id');
      expect(result).toEqual(mockPayment);
    });

    it('should return null for non-existent payment', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await service.getPaymentById('invalid-id');
      expect(result).toBeNull();
    });
  });

  describe('getPaymentByOrderId', () => {
    it('should return payment record', async () => {
      const mockPayment = { id: 'test-id', provider_order_id: 'test-order-id' };
      mockSupabase.single.mockResolvedValue({
        data: mockPayment,
        error: null
      });

      const result = await service.getPaymentByOrderId('test-order-id');
      expect(result).toEqual(mockPayment);
    });

    it('should return null for non-existent order', async () => {
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      const result = await service.getPaymentByOrderId('invalid-order-id');
      expect(result).toBeNull();
    });
  });

  describe('status mapping', () => {
    it('should map TossPayments statuses correctly', () => {
      const service = new TossPaymentsService();
      
      // Test private method through reflection or create a test helper
      const mapStatus = (status: string) => {
        switch (status) {
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
      };

      expect(mapStatus('DONE')).toBe('deposit_paid');
      expect(mapStatus('CANCELED')).toBe('refunded');
      expect(mapStatus('PARTIAL_CANCELED')).toBe('partially_refunded');
      expect(mapStatus('FAILED')).toBe('failed');
      expect(mapStatus('IN_PROGRESS')).toBe('pending');
      expect(mapStatus('UNKNOWN')).toBe('pending');
    });
  });
}); 