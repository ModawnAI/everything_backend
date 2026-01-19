/**
 * Comprehensive Payment Workflow Integration Tests
 * 
 * Integration tests covering payment processing workflows:
 * - Deposit and remaining payment processing
 * - Refund processing and reconciliation
 * - Payment failure handling and retry logic
 * - Payment status synchronization
 * - Integration with external payment gateways
 * - Concurrent payment scenarios
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import services for payment integration testing
import { PaymentService } from '../../src/services/payment.service';
import { PaymentCalculationService } from '../../src/services/payment-calculation.service';
import { PaymentStatusTransitionService } from '../../src/services/payment-status-transition.service';
import { RefundService } from '../../src/services/refund.service';
import { ReservationService } from '../../src/services/reservation.service';

// Mock external dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { tossPaymentsService } from '../../src/services/toss-payments.service';
import { logger } from '../../src/utils/logger';

// TODO: 결제 서비스 변경 후 활성화
describe.skip('Payment Workflow Integration Tests', () => {
  let paymentService: PaymentService;
  let paymentCalculationService: PaymentCalculationService;
  let paymentStatusTransitionService: PaymentStatusTransitionService;
  let refundService: RefundService;
  let reservationService: ReservationService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockTossPaymentsService: jest.Mocked<typeof tossPaymentsService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    paymentService = new PaymentService();
    paymentCalculationService = new PaymentCalculationService();
    paymentStatusTransitionService = new PaymentStatusTransitionService();
    refundService = new RefundService();
    reservationService = new ReservationService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockTossPaymentsService = tossPaymentsService as jest.Mocked<typeof tossPaymentsService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Deposit and Remaining Payment Processing', () => {
    it('should process deposit payment successfully', async () => {
      const paymentRequest = {
        reservationId: 'reservation-123',
        amount: 15000,
        paymentMethod: 'card',
        isDeposit: true,
        customerInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '010-1234-5678'
        }
      };

      // Mock Toss Payments API response
      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-key-123',
        orderId: 'order-123',
        amount: 15000,
        status: 'READY'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-123',
          reservation_id: 'reservation-123',
          amount: 15000,
          payment_status: 'pending',
          payment_key: 'payment-key-123'
        },
        error: null
      });

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('payment-123');
      expect(result.amount).toBe(15000);
      expect(mockTossPaymentsService.createPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 15000,
          orderId: expect.stringContaining('reservation-123')
        })
      );
    });

    it('should process remaining payment after deposit', async () => {
      const paymentRequest = {
        reservationId: 'reservation-123',
        amount: 35000,
        paymentMethod: 'card',
        isDeposit: false,
        customerInfo: {
          name: 'John Doe',
          email: 'john@example.com',
          phone: '010-1234-5678'
        }
      };

      // Mock Toss Payments API response
      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-key-456',
        orderId: 'order-456',
        amount: 35000,
        status: 'READY'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-456',
          reservation_id: 'reservation-123',
          amount: 35000,
          payment_status: 'pending',
          payment_key: 'payment-key-456'
        },
        error: null
      });

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('payment-456');
      expect(result.amount).toBe(35000);
    });

    it('should handle full payment without deposit', async () => {
      const paymentRequest = {
        reservationId: 'reservation-456',
        amount: 50000,
        paymentMethod: 'card',
        isDeposit: false,
        customerInfo: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '010-9876-5432'
        }
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-key-789',
        orderId: 'order-789',
        amount: 50000,
        status: 'DONE'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-789',
          reservation_id: 'reservation-456',
          amount: 50000,
          payment_status: 'completed',
          payment_key: 'payment-key-789'
        },
        error: null
      });

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('payment-789');
      expect(result.amount).toBe(50000);
    });
  });

  describe('Payment Status Synchronization', () => {
    it('should handle payment status updates from webhook', async () => {
      const webhookData = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: {
          paymentKey: 'payment-key-123',
          status: 'DONE',
          approvedAt: '2024-03-15T10:30:00Z',
          amount: 15000
        }
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-123',
          reservation_id: 'reservation-123',
          payment_status: 'completed',
          updated_at: '2024-03-15T10:30:00Z'
        },
        error: null
      });

      const result = await paymentService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('completed');
    });

    it('should handle payment failure webhook', async () => {
      const webhookData = {
        eventType: 'PAYMENT_STATUS_CHANGED',
        data: {
          paymentKey: 'payment-key-456',
          status: 'CANCELED',
          canceledAt: '2024-03-15T10:35:00Z',
          cancelReason: 'INSUFFICIENT_FUNDS'
        }
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-456',
          reservation_id: 'reservation-456',
          payment_status: 'failed',
          failure_reason: 'INSUFFICIENT_FUNDS',
          updated_at: '2024-03-15T10:35:00Z'
        },
        error: null
      });

      const result = await paymentService.handleWebhook(webhookData);

      expect(result.success).toBe(true);
      expect(result.paymentStatus).toBe('failed');
      expect(result.failureReason).toBe('INSUFFICIENT_FUNDS');
    });

    it('should synchronize payment status with reservation', async () => {
      const reservationId = 'reservation-123';
      
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          reservation_id: reservationId,
          payment_status: 'completed',
          total_amount: 50000,
          paid_amount: 50000,
          remaining_amount: 0
        },
        error: null
      });

      const result = await paymentService.synchronizePaymentStatus(reservationId);

      expect(result.success).toBe(true);
      expect(result.reservationId).toBe(reservationId);
      expect(result.paymentStatus).toBe('completed');
      expect(result.remainingAmount).toBe(0);
    });
  });

  describe('Refund Processing', () => {
    it('should process full refund successfully', async () => {
      const refundRequest = {
        reservationId: 'reservation-123',
        amount: 50000,
        reason: 'Customer requested cancellation',
        refundType: 'full'
      };

      mockTossPaymentsService.cancelPayment.mockResolvedValue({
        success: true,
        cancelAmount: 50000,
        cancelReason: 'Customer requested cancellation',
        canceledAt: '2024-03-15T11:00:00Z'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'refund-123',
          reservation_id: 'reservation-123',
          amount: 50000,
          refund_status: 'completed',
          refund_reason: 'Customer requested cancellation'
        },
        error: null
      });

      const result = await refundService.processRefund(refundRequest);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('refund-123');
      expect(result.amount).toBe(50000);
      expect(mockTossPaymentsService.cancelPayment).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 50000,
          cancelReason: 'Customer requested cancellation'
        })
      );
    });

    it('should process partial refund for deposit', async () => {
      const refundRequest = {
        reservationId: 'reservation-456',
        amount: 15000,
        reason: 'Cancellation within 24 hours - deposit only',
        refundType: 'partial'
      };

      mockTossPaymentsService.cancelPayment.mockResolvedValue({
        success: true,
        cancelAmount: 15000,
        cancelReason: 'Cancellation within 24 hours - deposit only',
        canceledAt: '2024-03-15T11:30:00Z'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'refund-456',
          reservation_id: 'reservation-456',
          amount: 15000,
          refund_status: 'completed',
          refund_reason: 'Cancellation within 24 hours - deposit only'
        },
        error: null
      });

      const result = await refundService.processRefund(refundRequest);

      expect(result.success).toBe(true);
      expect(result.refundId).toBe('refund-456');
      expect(result.amount).toBe(15000);
    });

    it('should handle refund failure scenarios', async () => {
      const refundRequest = {
        reservationId: 'reservation-789',
        amount: 50000,
        reason: 'Service not provided',
        refundType: 'full'
      };

      mockTossPaymentsService.cancelPayment.mockResolvedValue({
        success: false,
        error: 'Payment already refunded'
      });

      const result = await refundService.processRefund(refundRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Payment already refunded');
    });

    it('should calculate refund amounts based on cancellation policy', async () => {
      const reservationId = 'reservation-policy';
      
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: reservationId,
                total_amount: 50000,
                paid_amount: 15000,
                reservation_date: '2024-03-20',
                start_time: '10:00',
                cancellation_policy: '24_hours'
              },
              error: null
            })
          })
        })
      });

      const refundCalculation = await refundService.calculateRefundAmount(reservationId);

      expect(refundCalculation.eligibleForRefund).toBe(true);
      expect(refundCalculation.refundAmount).toBeGreaterThan(0);
      expect(refundCalculation.refundPercentage).toBeDefined();
    });
  });

  describe('Payment Calculation Integration', () => {
    it('should calculate total amount with service pricing', async () => {
      const calculationRequest = {
        shopId: 'shop-123',
        services: [
          { serviceId: 'service-1', quantity: 1 },
          { serviceId: 'service-2', quantity: 2 }
        ],
        pointsToUse: 5000,
        discountCode: 'SAVE10'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          subtotal: 60000,
          serviceDiscounts: 10000,
          pointsDiscount: 5000,
          codeDiscount: 6000,
          totalAmount: 39000,
          breakdown: {
            services: [
              { serviceId: 'service-1', price: 20000, quantity: 1, total: 20000 },
              { serviceId: 'service-2', price: 20000, quantity: 2, total: 40000 }
            ],
            discounts: [
              { type: 'service_bundle', amount: 10000 },
              { type: 'points', amount: 5000 },
              { type: 'promo_code', amount: 6000 }
            ]
          }
        },
        error: null
      });

      const result = await paymentCalculationService.calculateTotal(calculationRequest);

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(39000);
      expect(result.subtotal).toBe(60000);
      expect(result.discounts).toHaveLength(3);
    });

    it('should calculate deposit amounts based on service type', async () => {
      const depositRequest = {
        shopId: 'shop-123',
        services: [
          { serviceId: 'service-premium', quantity: 1 }
        ],
        totalAmount: 100000
      };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          depositAmount: 30000,
          depositPercentage: 30,
          remainingAmount: 70000,
          depositRequired: true,
          depositPolicy: 'premium_service_30_percent'
        },
        error: null
      });

      const result = await paymentCalculationService.calculateDeposit(depositRequest);

      expect(result.success).toBe(true);
      expect(result.depositAmount).toBe(30000);
      expect(result.depositPercentage).toBe(30);
      expect(result.remainingAmount).toBe(70000);
    });

    it('should handle complex pricing scenarios with multiple discounts', async () => {
      const complexRequest = {
        shopId: 'shop-123',
        services: [
          { serviceId: 'service-1', quantity: 1 },
          { serviceId: 'service-2', quantity: 1 }
        ],
        pointsToUse: 10000,
        discountCode: 'VIP20',
        userTier: 'vip',
        isFirstTimeCustomer: true
      };

      mockSupabase.rpc.mockResolvedValue({
        data: {
          subtotal: 80000,
          discounts: [
            { type: 'first_time_customer', amount: 8000 },
            { type: 'vip_tier', amount: 8000 },
            { type: 'points', amount: 10000 },
            { type: 'promo_code', amount: 16000 }
          ],
          totalAmount: 38000,
          maximumDiscountReached: false
        },
        error: null
      });

      const result = await paymentCalculationService.calculateTotal(complexRequest);

      expect(result.success).toBe(true);
      expect(result.totalAmount).toBe(38000);
      expect(result.discounts).toHaveLength(4);
      expect(result.maximumDiscountReached).toBe(false);
    });
  });

  describe('Payment Failure Handling', () => {
    it('should handle insufficient funds error', async () => {
      const paymentRequest = {
        reservationId: 'reservation-123',
        amount: 50000,
        paymentMethod: 'card'
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: false,
        error: 'INSUFFICIENT_FUNDS',
        errorCode: 'PAY_INSUFFICIENT_FUNDS'
      });

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('INSUFFICIENT_FUNDS');
      expect(result.errorCode).toBe('PAY_INSUFFICIENT_FUNDS');
    });

    it('should handle expired card error', async () => {
      const paymentRequest = {
        reservationId: 'reservation-456',
        amount: 30000,
        paymentMethod: 'card'
      };

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: false,
        error: 'CARD_EXPIRED',
        errorCode: 'PAY_CARD_EXPIRED'
      });

      const result = await paymentService.processPayment(paymentRequest);

      expect(result.success).toBe(false);
      expect(result.error).toBe('CARD_EXPIRED');
      expect(result.errorCode).toBe('PAY_CARD_EXPIRED');
    });

    it('should retry failed payments with exponential backoff', async () => {
      const paymentRequest = {
        reservationId: 'reservation-789',
        amount: 25000,
        paymentMethod: 'card',
        retryAttempts: 3
      };

      // First two attempts fail, third succeeds
      mockTossPaymentsService.createPayment
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Temporary service unavailable'))
        .mockResolvedValueOnce({
          success: true,
          paymentKey: 'payment-key-retry',
          orderId: 'order-retry',
          amount: 25000,
          status: 'DONE'
        });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'payment-retry',
          reservation_id: 'reservation-789',
          amount: 25000,
          payment_status: 'completed'
        },
        error: null
      });

      const result = await paymentService.processPaymentWithRetry(paymentRequest);

      expect(result.success).toBe(true);
      expect(result.transactionId).toBe('payment-retry');
      expect(mockTossPaymentsService.createPayment).toHaveBeenCalledTimes(3);
    });
  });

  describe('Concurrent Payment Scenarios', () => {
    it('should handle multiple concurrent payment requests', async () => {
      const paymentRequests = Array(10).fill(0).map((_, index) => ({
        reservationId: `reservation-${index}`,
        amount: 50000,
        paymentMethod: 'card'
      }));

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: `payment-key-${Math.random()}`,
        orderId: `order-${Math.random()}`,
        amount: 50000,
        status: 'DONE'
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: `payment-${Math.random()}`,
          reservation_id: `reservation-${Math.random()}`,
          amount: 50000,
          payment_status: 'completed'
        },
        error: null
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        paymentRequests.map(request => paymentService.processPayment(request))
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful).toHaveLength(10);
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should prevent duplicate payment processing', async () => {
      const paymentRequest = {
        reservationId: 'reservation-duplicate',
        amount: 40000,
        paymentMethod: 'card'
      };

      // First payment succeeds
      mockTossPaymentsService.createPayment.mockResolvedValueOnce({
        success: true,
        paymentKey: 'payment-key-duplicate',
        orderId: 'order-duplicate',
        amount: 40000,
        status: 'DONE'
      });

      // Second payment attempt should be rejected
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { 
          id: 'payment-duplicate',
          reservation_id: 'reservation-duplicate',
          amount: 40000,
          payment_status: 'completed'
        },
        error: null
      }).mockResolvedValueOnce({
        data: null,
        error: { message: 'Payment already processed for this reservation' }
      });

      const result1 = await paymentService.processPayment(paymentRequest);
      const result2 = await paymentService.processPayment(paymentRequest);

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(false);
      expect(result2.error).toBe('Payment already processed for this reservation');
    });
  });

  describe('Payment Reconciliation', () => {
    it('should reconcile payments with external gateway', async () => {
      const reconciliationDate = '2024-03-15';

      mockTossPaymentsService.getPaymentsByDate.mockResolvedValue({
        success: true,
        payments: [
          {
            paymentKey: 'payment-key-1',
            orderId: 'order-1',
            amount: 50000,
            status: 'DONE',
            approvedAt: '2024-03-15T10:00:00Z'
          },
          {
            paymentKey: 'payment-key-2',
            orderId: 'order-2',
            amount: 30000,
            status: 'CANCELED',
            canceledAt: '2024-03-15T11:00:00Z'
          }
        ]
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          reconciled: 2,
          discrepancies: 0,
          totalAmount: 80000
        },
        error: null
      });

      const result = await paymentService.reconcilePayments(reconciliationDate);

      expect(result.success).toBe(true);
      expect(result.reconciled).toBe(2);
      expect(result.discrepancies).toBe(0);
      expect(result.totalAmount).toBe(80000);
    });

    it('should identify and handle payment discrepancies', async () => {
      const reconciliationDate = '2024-03-16';

      mockTossPaymentsService.getPaymentsByDate.mockResolvedValue({
        success: true,
        payments: [
          {
            paymentKey: 'payment-key-discrepancy',
            orderId: 'order-discrepancy',
            amount: 50000,
            status: 'DONE',
            approvedAt: '2024-03-16T10:00:00Z'
          }
        ]
      });

      mockSupabase.rpc.mockResolvedValue({
        data: {
          reconciled: 0,
          discrepancies: 1,
          discrepancyDetails: [
            {
              paymentKey: 'payment-key-discrepancy',
              externalAmount: 50000,
              internalAmount: 45000,
              difference: 5000
            }
          ]
        },
        error: null
      });

      const result = await paymentService.reconcilePayments(reconciliationDate);

      expect(result.success).toBe(true);
      expect(result.reconciled).toBe(0);
      expect(result.discrepancies).toBe(1);
      expect(result.discrepancyDetails).toHaveLength(1);
      expect(result.discrepancyDetails[0].difference).toBe(5000);
    });
  });
});
