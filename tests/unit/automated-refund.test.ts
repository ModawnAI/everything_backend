/**
 * Automated Refund Service Unit Tests
 * 
 * Tests the comprehensive refund automation system:
 * - Automated refund processing for TossPayments
 * - Point adjustment logic (reverse earned points, restore used points)
 * - Partial refund capabilities with proportional point adjustments
 * - Refund business rules validation
 * - Automated refund triggers for no-show cases
 * - Comprehensive refund audit trail
 */

import { automatedRefundService } from '../../src/services/automated-refund.service';
import { pointService } from '../../src/services/point.service';
import { tossPaymentsService } from '../../src/services/toss-payments.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/point.service');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/utils/logger');

// Create mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn()
        })),
        neq: jest.fn(() => ({
          order: jest.fn()
        })),
        in: jest.fn(() => ({
          order: jest.fn()
        })),
        lt: jest.fn(() => ({
          toISOString: jest.fn()
        }))
      })),
      gte: jest.fn(() => ({
        lt: jest.fn()
      })),
      in: jest.fn(() => ({
        order: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  rpc: jest.fn()
};

// Mock the database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase
}));

// Mock services
const mockPointService = {
  addPoints: jest.fn(),
  deductPoints: jest.fn()
};
(pointService as any) = mockPointService;

const mockTossPaymentsService = {
  cancelPayment: jest.fn()
};
(tossPaymentsService as any) = mockTossPaymentsService;

// TODO: 결제 서비스 변경 후 활성화
describe.skip('AutomatedRefundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('processAutomatedRefund', () => {
    const mockReservationData = {
      id: 'reservation-id',
      user_id: 'user-id',
      total_amount: 100000,
      reservation_date: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(), // 48 hours from now
      status: 'confirmed',
      created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // 24 hours ago
      payments: [
        {
          id: 'payment-id',
          amount: 100000,
          paid_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
        }
      ],
      shops: {
        refund_policy: {},
        no_show_refund_percentage: 0,
        auto_refund_enabled: true
      }
    };

    it('should process full refund successfully', async () => {
      // Mock reservation data retrieval
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockReservationData,
        error: null
      });

      // Mock point transactions (no earned or used points)
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValueOnce({
        data: [],
        error: null
      });
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock TossPayments refund
      mockTossPaymentsService.cancelPayment.mockResolvedValueOnce({
        transactionId: 'toss-refund-id',
        success: true
      });

      // Mock refund record creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      // Mock reservation status update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'full' as const,
        refundReason: 'Customer cancellation',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.originalAmount).toBe(100000);
      expect(result.refundedAmount).toBe(100000); // Full refund (48+ hours notice)
      expect(result.businessRuleValidation.canRefund).toBe(true);
      expect(result.businessRuleValidation.refundPercentage).toBe(100);
      expect(result.tossPaymentsRefundId).toBe('toss-refund-id');
      expect(result.auditTrail.length).toBeGreaterThan(0);
    });

    it('should process partial refund with point adjustments', async () => {
      // Mock reservation data with earned and used points
      const reservationWithPoints = {
        ...mockReservationData,
        reservation_date: new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString() // 12 hours from now (partial refund)
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: reservationWithPoints,
        error: null
      });

      // Mock earned point transactions
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValueOnce({
        data: [
          {
            id: 'earned-transaction-id',
            amount: 2500, // 2,500 points earned
            transaction_type: 'earned_service'
          }
        ],
        error: null
      });

      // Mock used point transactions
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValueOnce({
        data: [
          {
            id: 'used-transaction-id',
            amount: -1000, // 1,000 points used
            transaction_type: 'used_service'
          }
        ],
        error: null
      });

      // Mock point service calls
      mockPointService.deductPoints.mockResolvedValueOnce({
        id: 'reversal-transaction-id',
        amount: -1250 // Reverse 50% of earned points
      });
      mockPointService.addPoints.mockResolvedValueOnce({
        id: 'restoration-transaction-id',
        amount: 500 // Restore 50% of used points
      });

      // Mock TossPayments refund
      mockTossPaymentsService.cancelPayment.mockResolvedValueOnce({
        transactionId: 'toss-refund-id',
        success: true
      });

      // Mock refund record creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      // Mock reservation status update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'partial' as const,
        refundReason: 'Late cancellation',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(50000); // 50% refund (12-24 hours notice)
      expect(result.pointAdjustments.earnedPointsToReverse).toBe(1250); // 50% of 2,500
      expect(result.pointAdjustments.usedPointsToRestore).toBe(500); // 50% of 1,000
      expect(result.pointAdjustments.proportionalFactor).toBe(0.5);
      expect(mockPointService.deductPoints).toHaveBeenCalledWith(
        'user-id',
        1250,
        'adjusted',
        'refund_reversal',
        expect.stringContaining('환불로 인한 적립 포인트 차감'),
        'reservation-id'
      );
      expect(mockPointService.addPoints).toHaveBeenCalledWith(
        'user-id',
        500,
        'adjusted',
        'refund_restoration',
        expect.stringContaining('환불로 인한 사용 포인트 복원'),
        'reservation-id'
      );
    });

    it('should reject refund for late cancellation', async () => {
      // Mock reservation data with very late cancellation
      const lateReservation = {
        ...mockReservationData,
        reservation_date: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hour from now
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: lateReservation,
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'cancellation' as const,
        refundReason: 'Very late cancellation',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(false);
      expect(result.businessRuleValidation.canRefund).toBe(false);
      expect(result.businessRuleValidation.policyViolations).toContain(
        'Cancellation too close to reservation time'
      );
      expect(result.error).toContain('Refund not allowed');
    });

    it('should process no-show refund with zero amount', async () => {
      // Mock reservation data for no-show
      const noShowReservation = {
        ...mockReservationData,
        reservation_date: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        status: 'confirmed'
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: noShowReservation,
        error: null
      });

      // Mock no point transactions
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValueOnce({
        data: [],
        error: null
      });
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock refund record creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      // Mock reservation status update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'no_show' as const,
        refundReason: 'Customer no-show',
        triggeredBy: 'system' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(0); // No refund for no-show
      expect(result.businessRuleValidation.refundPercentage).toBe(0);
    });

    it('should handle admin override for business rule violations', async () => {
      // Mock reservation data with late cancellation
      const lateReservation = {
        ...mockReservationData,
        reservation_date: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString() // 1 hour from now
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: lateReservation,
        error: null
      });

      // Mock no point transactions
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValueOnce({
        data: [],
        error: null
      });
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValueOnce({
        data: [],
        error: null
      });

      // Mock TossPayments refund
      mockTossPaymentsService.cancelPayment.mockResolvedValueOnce({
        transactionId: 'admin-override-refund-id',
        success: true
      });

      // Mock refund record creation
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      // Mock reservation status update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'cancellation' as const,
        refundReason: 'Admin override for special circumstances',
        triggeredBy: 'admin' as const,
        adminId: 'admin-id',
        businessRuleOverride: true
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.businessRuleValidation.canRefund).toBe(false); // Rules still say no
      expect(result.businessRuleValidation.policyViolations.length).toBeGreaterThan(0);
      expect(result.tossPaymentsRefundId).toBe('admin-override-refund-id');
    });
  });

  describe('processNoShowRefunds', () => {
    it('should process eligible no-show reservations', async () => {
      const pastTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago

      // Mock eligible no-show reservations
      mockSupabase.from().select().eq().lt().eq.mockResolvedValueOnce({
        data: [
          {
            id: 'reservation-1',
            user_id: 'user-1',
            reservation_date: pastTime.toISOString(),
            total_amount: 50000,
            status: 'confirmed',
            payments: [{ id: 'payment-1', amount: 50000 }],
            shops: { auto_refund_enabled: true, no_show_refund_percentage: 0 }
          },
          {
            id: 'reservation-2',
            user_id: 'user-2',
            reservation_date: pastTime.toISOString(),
            total_amount: 75000,
            status: 'confirmed',
            payments: [{ id: 'payment-2', amount: 75000 }],
            shops: { auto_refund_enabled: true, no_show_refund_percentage: 0 }
          }
        ],
        error: null
      });

      // Mock successful processing for each reservation
      jest.spyOn(automatedRefundService, 'processAutomatedRefund')
        .mockResolvedValueOnce({
          success: true,
          refundId: 'refund-1',
          originalAmount: 50000,
          refundedAmount: 0,
          pointAdjustments: {
            userId: 'user-1',
            reservationId: 'reservation-1',
            earnedPointsToReverse: 0,
            usedPointsToRestore: 0,
            adjustmentReason: 'No-show refund',
            proportionalFactor: 0,
            transactions: []
          },
          businessRuleValidation: {
            isValid: true,
            canRefund: true,
            refundPercentage: 0,
            maxRefundAmount: 0,
            timeBasedRestrictions: {
              hoursUntilReservation: -3,
              hoursSincePayment: 24,
              withinCancellationWindow: false,
              penaltyApplied: false
            },
            policyViolations: [],
            appliedRules: []
          },
          processingTime: 1000,
          auditTrail: []
        })
        .mockResolvedValueOnce({
          success: true,
          refundId: 'refund-2',
          originalAmount: 75000,
          refundedAmount: 0,
          pointAdjustments: {
            userId: 'user-2',
            reservationId: 'reservation-2',
            earnedPointsToReverse: 0,
            usedPointsToRestore: 0,
            adjustmentReason: 'No-show refund',
            proportionalFactor: 0,
            transactions: []
          },
          businessRuleValidation: {
            isValid: true,
            canRefund: true,
            refundPercentage: 0,
            maxRefundAmount: 0,
            timeBasedRestrictions: {
              hoursUntilReservation: -3,
              hoursSincePayment: 24,
              withinCancellationWindow: false,
              penaltyApplied: false
            },
            policyViolations: [],
            appliedRules: []
          },
          processingTime: 1200,
          auditTrail: []
        });

      await automatedRefundService.processNoShowRefunds();

      expect(automatedRefundService.processAutomatedRefund).toHaveBeenCalledTimes(2);
      expect(automatedRefundService.processAutomatedRefund).toHaveBeenCalledWith({
        reservationId: 'reservation-1',
        userId: 'user-1',
        refundType: 'no_show',
        refundReason: 'Automated no-show refund processing',
        triggeredBy: 'system',
        triggerReason: 'No-show detected after grace period'
      });
    });

    it('should handle no eligible reservations', async () => {
      // Mock no eligible reservations
      mockSupabase.from().select().eq().lt().eq.mockResolvedValueOnce({
        data: [],
        error: null
      });

      await automatedRefundService.processNoShowRefunds();

      expect(automatedRefundService.processAutomatedRefund).not.toHaveBeenCalled();
    });

    it('should handle processing errors gracefully', async () => {
      // Mock eligible reservation
      mockSupabase.from().select().eq().lt().eq.mockResolvedValueOnce({
        data: [
          {
            id: 'reservation-error',
            user_id: 'user-error',
            reservation_date: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            total_amount: 50000,
            status: 'confirmed',
            payments: [{ id: 'payment-error', amount: 50000 }],
            shops: { auto_refund_enabled: true, no_show_refund_percentage: 0 }
          }
        ],
        error: null
      });

      // Mock processing failure
      jest.spyOn(automatedRefundService, 'processAutomatedRefund')
        .mockRejectedValueOnce(new Error('Processing failed'));

      // Should not throw error - should handle gracefully
      await expect(automatedRefundService.processNoShowRefunds()).resolves.not.toThrow();
    });
  });

  describe('Business Rule Validation', () => {
    it('should validate time-based cancellation rules', async () => {
      const mockReservation = {
        id: 'reservation-id',
        user_id: 'user-id',
        total_amount: 100000,
        status: 'confirmed',
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      // Test full refund window (48+ hours)
      const fullRefundReservation = {
        ...mockReservation,
        reservation_date: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString()
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: fullRefundReservation,
        error: null
      });

      const fullRefundRequest = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'cancellation' as const,
        refundReason: 'Early cancellation',
        triggeredBy: 'user' as const
      };

      // Mock other required calls
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValue({ data: [], error: null });
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValue({ data: [], error: null });
      mockSupabase.from().insert.mockResolvedValue({ error: null });
      mockSupabase.from().update().eq.mockResolvedValue({ error: null });

      const fullRefundResult = await automatedRefundService.processAutomatedRefund(fullRefundRequest);

      expect(fullRefundResult.businessRuleValidation.refundPercentage).toBe(100);
      expect(fullRefundResult.businessRuleValidation.appliedRules).toContainEqual(
        expect.objectContaining({
          ruleName: 'full_refund_window',
          ruleType: 'time_based'
        })
      );
    });

    it('should validate status-based rules', async () => {
      const completedReservation = {
        id: 'reservation-id',
        user_id: 'user-id',
        total_amount: 100000,
        status: 'completed',
        reservation_date: new Date(Date.now() + 50 * 60 * 60 * 1000).toISOString(),
        created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      };

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: completedReservation,
        error: null
      });

      const request = {
        reservationId: 'reservation-id',
        userId: 'user-id',
        refundType: 'cancellation' as const,
        refundReason: 'Refund after completion',
        triggeredBy: 'user' as const
      };

      // Mock other required calls
      mockSupabase.from().select().eq().eq().in().neq.mockResolvedValue({ data: [], error: null });
      mockSupabase.from().select().eq().eq().eq().eq.mockResolvedValue({ data: [], error: null });
      mockSupabase.from().insert.mockResolvedValue({ error: null });
      mockSupabase.from().update().eq.mockResolvedValue({ error: null });

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.businessRuleValidation.refundPercentage).toBeLessThanOrEqual(50);
      expect(result.businessRuleValidation.appliedRules).toContainEqual(
        expect.objectContaining({
          ruleName: 'completed_service_penalty',
          ruleType: 'status_based'
        })
      );
    });
  });
});

