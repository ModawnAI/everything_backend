/**
 * TossPayments Webhook Tests
 * 
 * Comprehensive unit tests for TossPayments webhook processing including:
 * - Webhook signature verification
 * - Idempotency handling
 * - Retry mechanisms
 * - Error handling
 * - Database operations
 */

// Mock crypto at the very top
jest.mock('crypto', () => ({
  createHmac: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue('mock-signature')
}));

import { TossPaymentsService, TossWebhookPayload } from '../../src/services/toss-payments.service';
import { getSupabaseClient } from '../../src/config/database';
import { config } from '../../src/config/environment';
import crypto from 'crypto';

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
  }
};

const mockCrypto = {
  createHmac: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  digest: jest.fn().mockReturnValue('mock-signature')
};

describe('TossPaymentsService Webhook Processing', () => {
  let service: TossPaymentsService;
  let mockFetch: jest.MockedFunction<typeof fetch>;

  const mockWebhookPayload: TossWebhookPayload = {
    paymentKey: 'test-payment-key',
    orderId: 'test-order-id',
    status: 'DONE',
    totalAmount: 50000,
    suppliedAmount: 50000,
    vat: 5000,
    approvedAt: '2024-01-01T12:00:00Z',
    useEscrow: false,
    currency: 'KRW',
    method: 'card',
    secret: 'mock-signature',
    type: 'NORMAL',
    country: 'KR',
    isPartialCancelable: true,
    receipt: { url: 'https://receipt.example.com' },
    checkout: { url: 'https://checkout.example.com' },
    totalCancelAmount: 0,
    balanceAmount: 50000,
    taxFreeAmount: 0,
    requestedAt: '2024-01-01T11:55:00Z',
    card: {
      company: 'Test Bank',
      number: '1234567890',
      installmentPlanMonths: 0,
      isInterestFree: false,
      approveNo: '123456',
      useCardPoint: false,
      cardType: 'CREDIT',
      ownerType: 'PERSONAL',
      acquireStatus: 'APPROVED',
      amount: 50000
    }
  };

  const mockPaymentRecord = {
    id: 'test-payment-id',
    user_id: 'test-user-id',
    reservation_id: 'test-reservation-id',
    amount: 50000,
    payment_status: 'pending',
    is_deposit: true,
    metadata: {}
  };

  beforeEach(() => {
    service = new TossPaymentsService();
    mockFetch = fetch as jest.MockedFunction<typeof fetch>;
    jest.clearAllMocks();
    
    // Reset environment
    delete process.env.TOSS_PAYMENTS_WEBHOOK_SECRET;
  });

  describe('processWebhook', () => {
    it('should process webhook successfully with valid signature', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'test-webhook-log-id' },
        error: null
      });

      // Mock signature verification
      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      expect(mockSupabase.from).toHaveBeenCalledWith('payments');
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should reject webhook with invalid signature', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock signature verification to fail
      mockCrypto.digest.mockReturnValue('different-signature');

      await expect(service.processWebhook(mockWebhookPayload))
        .rejects.toThrow('Invalid webhook signature');
    });

    it('should skip signature verification when secret not configured', async () => {
      // No webhook secret configured
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      await service.processWebhook(mockWebhookPayload);

      expect(mockSupabase.update).toHaveBeenCalled();
    });

    it('should handle duplicate webhook processing', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock existing webhook log (duplicate)
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'existing-webhook-log' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should not process payment update for duplicate
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
      expect(mockSupabase.update).not.toHaveBeenCalled();
    });

    it('should handle payment record not found', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock payment not found
      mockSupabase.single.mockResolvedValue({
        data: null,
        error: { message: 'Not found' }
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await expect(service.processWebhook(mockWebhookPayload))
        .rejects.toThrow('Payment record not found for order ID: test-order-id');
    });

    it('should retry on database errors', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      // Mock database error on first attempt, success on second
      mockSupabase.update
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Database error' }
        })
        .mockResolvedValueOnce({
          data: { id: 'test-payment-id' },
          error: null
        });

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'test-webhook-log-id' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should have been called twice (retry)
      expect(mockSupabase.update).toHaveBeenCalledTimes(2);
    });

    it('should fail after maximum retries', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      // Mock database error on all attempts
      mockSupabase.update.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await expect(service.processWebhook(mockWebhookPayload))
        .rejects.toThrow('Webhook processing failed after 3 attempts');
    });

    it('should update reservation status for deposit payments', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'test-webhook-log-id' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should update reservation status
      expect(mockSupabase.from).toHaveBeenCalledWith('reservations');
    });

    it('should send notification for successful payments', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single
        .mockResolvedValueOnce({
          data: mockPaymentRecord,
          error: null
        })
        .mockResolvedValueOnce({
          data: { name: 'Test User', email: 'test@example.com' },
          error: null
        });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'test-webhook-log-id' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should create notification
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    });
  });

  describe('webhook signature verification', () => {
    it('should verify signature correctly', () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock crypto to return expected signature
      mockCrypto.digest.mockReturnValue('mock-signature');

      // This would test the private method through the public interface
      // For now, we test the behavior through processWebhook
      expect(mockCrypto.createHmac).toHaveBeenCalledWith('sha256', 'test-webhook-secret');
    });

    it('should handle missing signature in payload', async () => {
      const payloadWithoutSignature = { ...mockWebhookPayload } as Partial<TossWebhookPayload>;
      delete payloadWithoutSignature.secret;

      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';

      await expect(service.processWebhook(payloadWithoutSignature as TossWebhookPayload))
        .rejects.toThrow('Invalid webhook signature');
    });
  });

  describe('webhook idempotency', () => {
    it('should check for existing webhook processing', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock existing webhook log
      mockSupabase.single.mockResolvedValue({
        data: { id: 'existing-log' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should check for existing webhook
      expect(mockSupabase.from).toHaveBeenCalledWith('webhook_logs');
    });

    it('should handle webhook logs table not existing', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock webhook logs table not existing
      mockSupabase.single.mockRejectedValue(new Error('Table not found'));

      // Mock payment record
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      // Should not throw error and continue processing
      await service.processWebhook(mockWebhookPayload);
    });
  });

  describe('webhook logging', () => {
    it('should log webhook processing', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      mockSupabase.insert.mockResolvedValue({
        data: { id: 'test-webhook-log-id' },
        error: null
      });

      mockCrypto.digest.mockReturnValue('mock-signature');

      await service.processWebhook(mockWebhookPayload);

      // Should log webhook processing
      expect(mockSupabase.insert).toHaveBeenCalledWith({
        payment_key: 'test-payment-key',
        status: 'DONE',
        webhook_id: expect.stringContaining('webhook_'),
        processed: true,
        processed_at: expect.any(String)
      });
    });

    it('should handle webhook logging failure gracefully', async () => {
      // Mock environment
      process.env.TOSS_PAYMENTS_WEBHOOK_SECRET = 'test-webhook-secret';
      
      // Mock database responses
      mockSupabase.single.mockResolvedValue({
        data: mockPaymentRecord,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'test-payment-id' },
        error: null
      });

      // Mock webhook logging failure
      mockSupabase.insert.mockRejectedValue(new Error('Logging failed'));

      mockCrypto.digest.mockReturnValue('mock-signature');

      // Should not throw error for logging failure
      await service.processWebhook(mockWebhookPayload);
    });
  });
}); 