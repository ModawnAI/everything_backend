/**
 * Refund Automation Integration Tests
 * 
 * Tests the complete refund automation system with real database connections:
 * - End-to-end automated refund processing
 * - Point adjustment integration with real transactions
 * - TossPayments integration (mocked for safety)
 * - Business rule validation with database functions
 * - No-show refund queue processing
 * - Audit trail generation and retrieval
 */

import { createClient } from '@supabase/supabase-js';
import { automatedRefundService } from '../../src/services/automated-refund.service';
import { refundService } from '../../src/services/refund.service';
import { pointService } from '../../src/services/point.service';
import { tossPaymentsService } from '../../src/services/toss-payments.service';

// Mock TossPayments service for safety (don't want real refunds in tests)
jest.mock('../../src/services/toss-payments.service');

const mockTossPaymentsService = tossPaymentsService as jest.Mocked<typeof tossPaymentsService>;

// TODO: 결제 서비스 변경 후 활성화
describe.skip('Refund Automation Integration Tests', () => {
  let supabase: any;
  let testUserId: string;
  let testShopId: string;
  let testServiceId: string;
  let testReservationId: string;
  let testPaymentId: string;

  beforeAll(async () => {
    // Initialize real Supabase client
    supabase = createClient(
      process.env.SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Create test data
    await createTestData();
  });

  afterAll(async () => {
    // Clean up test data
    await cleanupTestData();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Mock TossPayments service responses
    mockTossPaymentsService.cancelPayment.mockResolvedValue({
      transactionId: 'mock-toss-refund-id',
      success: true,
      refundAmount: 50000,
      message: 'Refund processed successfully'
    });
  });

  async function createTestData() {
    // Create test user
    const testUser = {
      id: crypto.randomUUID(),
      email: `test-refund-${Date.now()}@example.com`,
      name: 'Test Refund User',
      phone_number: '010-1234-5678',
      available_points: 5000,
      total_points_earned: 10000,
      user_role: 'customer'
    };

    const { error: userError } = await supabase
      .from('users')
      .insert(testUser);

    if (userError) throw new Error(`Failed to create test user: ${userError.message}`);
    testUserId = testUser.id;

    // Create test shop
    const testShop = {
      id: crypto.randomUUID(),
      owner_id: testUserId,
      name: 'Test Refund Shop',
      business_registration_number: '123-45-67890',
      phone_number: '02-1234-5678',
      address: 'Test Address',
      auto_refund_enabled: true,
      no_show_refund_percentage: 0,
      refund_grace_period_hours: 48
    };

    const { error: shopError } = await supabase
      .from('shops')
      .insert(testShop);

    if (shopError) throw new Error(`Failed to create test shop: ${shopError.message}`);
    testShopId = testShop.id;

    // Create test service
    const testService = {
      id: crypto.randomUUID(),
      shop_id: testShopId,
      name: 'Test Refund Service',
      description: 'Service for refund testing',
      price: 100000,
      duration_minutes: 60,
      category: 'beauty'
    };

    const { error: serviceError } = await supabase
      .from('services')
      .insert(testService);

    if (serviceError) throw new Error(`Failed to create test service: ${serviceError.message}`);
    testServiceId = testService.id;

    // Create test reservation
    const reservationDate = new Date();
    reservationDate.setHours(reservationDate.getHours() + 48); // 48 hours from now

    const testReservation = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      shop_id: testShopId,
      service_id: testServiceId,
      reservation_date: reservationDate.toISOString(),
      total_price: 100000,
      status: 'confirmed',
      payment_status: 'fully_paid'
    };

    const { error: reservationError } = await supabase
      .from('reservations')
      .insert(testReservation);

    if (reservationError) throw new Error(`Failed to create test reservation: ${reservationError.message}`);
    testReservationId = testReservation.id;

    // Create test payment
    const testPayment = {
      id: crypto.randomUUID(),
      reservation_id: testReservationId,
      user_id: testUserId,
      amount: 100000,
      payment_method: 'card',
      payment_status: 'fully_paid',
      payment_stage: 'single',
      is_deposit: false,
      paid_at: new Date().toISOString()
    };

    const { error: paymentError } = await supabase
      .from('payments')
      .insert(testPayment);

    if (paymentError) throw new Error(`Failed to create test payment: ${paymentError.message}`);
    testPaymentId = testPayment.id;

    // Create test point transactions (earned and used)
    const earnedTransaction = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      reservation_id: testReservationId,
      transaction_type: 'earned_service',
      amount: 2500, // 2.5% of 100,000
      description: 'Service completion points',
      status: 'available',
      available_from: new Date().toISOString(),
      expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
    };

    const usedTransaction = {
      id: crypto.randomUUID(),
      user_id: testUserId,
      reservation_id: testReservationId,
      transaction_type: 'used_service',
      amount: -1000, // Used 1,000 points
      description: 'Points used for service discount',
      status: 'used'
    };

    const { error: pointError } = await supabase
      .from('point_transactions')
      .insert([earnedTransaction, usedTransaction]);

    if (pointError) throw new Error(`Failed to create test point transactions: ${pointError.message}`);
  }

  async function cleanupTestData() {
    if (testReservationId) {
      await supabase.from('point_transactions').delete().eq('reservation_id', testReservationId);
      await supabase.from('refund_point_adjustments').delete().eq('reservation_id', testReservationId);
      await supabase.from('refund_audit_logs').delete().eq('reservation_id', testReservationId);
      await supabase.from('refunds').delete().eq('reservation_id', testReservationId);
      await supabase.from('payments').delete().eq('reservation_id', testReservationId);
      await supabase.from('reservations').delete().eq('id', testReservationId);
    }
    if (testServiceId) {
      await supabase.from('services').delete().eq('id', testServiceId);
    }
    if (testShopId) {
      await supabase.from('shops').delete().eq('id', testShopId);
    }
    if (testUserId) {
      await supabase.from('users').delete().eq('id', testUserId);
    }
  }

  describe('End-to-End Automated Refund Processing', () => {
    it('should process full refund with point adjustments', async () => {
      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'full' as const,
        refundReason: 'Customer cancellation - early notice',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.originalAmount).toBe(100000);
      expect(result.refundedAmount).toBe(100000); // Full refund (48+ hours notice)
      expect(result.businessRuleValidation.canRefund).toBe(true);
      expect(result.businessRuleValidation.refundPercentage).toBe(100);
      expect(result.tossPaymentsRefundId).toBe('mock-toss-refund-id');

      // Verify point adjustments
      expect(result.pointAdjustments.earnedPointsToReverse).toBe(2500); // All earned points reversed
      expect(result.pointAdjustments.usedPointsToRestore).toBe(1000); // All used points restored
      expect(result.pointAdjustments.proportionalFactor).toBe(1.0); // Full refund

      // Verify audit trail
      expect(result.auditTrail.length).toBeGreaterThan(0);
      expect(result.auditTrail[0].action).toBe('refund_initiated');
      expect(result.auditTrail[result.auditTrail.length - 1].action).toBe('refund_completed');

      // Verify TossPayments was called
      expect(mockTossPaymentsService.cancelPayment).toHaveBeenCalledWith(
        testPaymentId,
        'Customer cancellation - early notice',
        100000
      );

      // Verify database records were created
      const { data: refundRecord } = await supabase
        .from('refunds')
        .select('*')
        .eq('id', result.refundId)
        .single();

      expect(refundRecord).toBeTruthy();
      expect(refundRecord.reservation_id).toBe(testReservationId);
      expect(refundRecord.refunded_amount).toBe(100000);
      expect(refundRecord.triggered_by).toBe('user');

      // Verify point adjustment records
      const { data: pointAdjustments } = await supabase
        .from('refund_point_adjustments')
        .select('*')
        .eq('refund_id', result.refundId);

      expect(pointAdjustments.length).toBe(2); // One for earned, one for used
      
      const earnedAdjustment = pointAdjustments.find(adj => adj.adjustment_type === 'reverse_earned');
      const usedAdjustment = pointAdjustments.find(adj => adj.adjustment_type === 'restore_used');
      
      expect(earnedAdjustment).toBeTruthy();
      expect(earnedAdjustment.adjusted_amount).toBe(2500);
      expect(usedAdjustment).toBeTruthy();
      expect(usedAdjustment.adjusted_amount).toBe(1000);

      // Verify audit logs
      const { data: auditLogs } = await supabase
        .from('refund_audit_logs')
        .select('*')
        .eq('refund_id', result.refundId)
        .order('created_at', { ascending: true });

      expect(auditLogs.length).toBeGreaterThan(0);
      expect(auditLogs[0].action).toBe('refund_initiated');
    });

    it('should process partial refund with proportional point adjustments', async () => {
      // Update reservation to be within partial refund window (12 hours from now)
      const partialRefundDate = new Date();
      partialRefundDate.setHours(partialRefundDate.getHours() + 12);

      await supabase
        .from('reservations')
        .update({ reservation_date: partialRefundDate.toISOString() })
        .eq('id', testReservationId);

      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'cancellation' as const,
        refundReason: 'Customer cancellation - late notice',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(true);
      expect(result.refundedAmount).toBe(50000); // 50% refund (12-24 hours notice)
      expect(result.businessRuleValidation.refundPercentage).toBe(50);

      // Verify proportional point adjustments
      expect(result.pointAdjustments.earnedPointsToReverse).toBe(1250); // 50% of 2,500
      expect(result.pointAdjustments.usedPointsToRestore).toBe(500); // 50% of 1,000
      expect(result.pointAdjustments.proportionalFactor).toBe(0.5);

      // Verify TossPayments was called with partial amount
      expect(mockTossPaymentsService.cancelPayment).toHaveBeenCalledWith(
        testPaymentId,
        'Customer cancellation - late notice',
        50000
      );
    });

    it('should reject refund for very late cancellation', async () => {
      // Update reservation to be within no-refund window (1 hour from now)
      const noRefundDate = new Date();
      noRefundDate.setHours(noRefundDate.getHours() + 1);

      await supabase
        .from('reservations')
        .update({ reservation_date: noRefundDate.toISOString() })
        .eq('id', testReservationId);

      const request = {
        reservationId: testReservationId,
        userId: testUserId,
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

      // Verify no TossPayments call was made
      expect(mockTossPaymentsService.cancelPayment).not.toHaveBeenCalled();
    });
  });

  describe('Business Rule Validation Integration', () => {
    it('should validate refund business rules using database function', async () => {
      const validation = await refundService.validateRefundBusinessRules(
        testReservationId,
        'cancellation',
        50000
      );

      expect(validation.can_refund).toBe(true);
      expect(validation.refund_percentage).toBeGreaterThan(0);
      expect(validation.max_refund_amount).toBeGreaterThan(0);
      expect(validation.applied_rules).toBeDefined();
      expect(Array.isArray(validation.applied_rules)).toBe(true);
    });

    it('should process point adjustments using database function', async () => {
      // First create a refund record
      const refundId = crypto.randomUUID();
      await supabase.from('refunds').insert({
        id: refundId,
        reservation_id: testReservationId,
        user_id: testUserId,
        payment_id: testPaymentId,
        refund_type: 'partial',
        refund_reason: 'Test point adjustments',
        requested_amount: 100000,
        approved_amount: 50000,
        refunded_amount: 50000,
        refund_status: 'completed',
        triggered_by: 'user'
      });

      const adjustments = await refundService.processRefundPointAdjustments(
        refundId,
        testReservationId,
        testUserId,
        50000,
        100000
      );

      expect(adjustments.earned_points_reversed).toBe(1250); // 50% of 2,500
      expect(adjustments.used_points_restored).toBe(500); // 50% of 1,000
      expect(adjustments.adjustment_count).toBe(2);

      // Verify adjustment records were created
      const { data: adjustmentRecords } = await supabase
        .from('refund_point_adjustments')
        .select('*')
        .eq('refund_id', refundId);

      expect(adjustmentRecords.length).toBe(2);

      // Verify new point transactions were created
      const { data: newTransactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUserId)
        .eq('transaction_type', 'adjusted')
        .contains('metadata', { refund_id: refundId });

      expect(newTransactions.length).toBe(2); // One reversal, one restoration
    });
  });

  describe('No-Show Refund Queue Integration', () => {
    it('should queue reservation for no-show processing', async () => {
      const queued = await refundService.queueNoShowRefund(testReservationId);

      expect(queued).toBe(true);

      // Verify queue record was created
      const { data: queueRecord } = await supabase
        .from('no_show_refund_queue')
        .select('*')
        .eq('reservation_id', testReservationId)
        .single();

      expect(queueRecord).toBeTruthy();
      expect(queueRecord.user_id).toBe(testUserId);
      expect(queueRecord.processing_status).toBe('pending');
      expect(queueRecord.auto_refund_enabled).toBe(true);
    });

    it('should retrieve no-show refund queue', async () => {
      // Ensure there's a queue item
      await refundService.queueNoShowRefund(testReservationId);

      const queue = await refundService.getNoShowRefundQueue(10);

      expect(Array.isArray(queue)).toBe(true);
      
      const queueItem = queue.find(item => item.reservation_id === testReservationId);
      if (queueItem) {
        expect(queueItem.processing_status).toBe('pending');
        expect(queueItem.reservations).toBeDefined();
        expect(queueItem.reservations.users).toBeDefined();
      }
    });
  });

  describe('Audit Trail Integration', () => {
    it('should create and retrieve comprehensive audit trail', async () => {
      // Process a refund to generate audit trail
      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'full' as const,
        refundReason: 'Audit trail test',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);
      expect(result.success).toBe(true);

      // Retrieve audit trail
      const auditTrail = await refundService.getRefundAuditTrail(result.refundId);

      expect(auditTrail.length).toBeGreaterThan(0);
      expect(auditTrail[0].action).toBe('refund_initiated');
      expect(auditTrail[0].actor).toBe('user');
      expect(auditTrail[0].result).toBe('success');

      // Verify chronological order
      for (let i = 1; i < auditTrail.length; i++) {
        const prevTime = new Date(auditTrail[i - 1].created_at);
        const currTime = new Date(auditTrail[i].created_at);
        expect(currTime.getTime()).toBeGreaterThanOrEqual(prevTime.getTime());
      }
    });

    it('should retrieve point adjustments summary', async () => {
      // Process a refund to generate point adjustments
      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'partial' as const,
        refundReason: 'Point adjustments test',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);
      expect(result.success).toBe(true);

      // Retrieve point adjustments
      const adjustments = await refundService.getRefundPointAdjustments(result.refundId);

      expect(adjustments.length).toBe(2); // Earned reversal + used restoration
      
      const earnedAdjustment = adjustments.find(adj => adj.adjustment_type === 'reverse_earned');
      const usedAdjustment = adjustments.find(adj => adj.adjustment_type === 'restore_used');

      expect(earnedAdjustment).toBeTruthy();
      expect(earnedAdjustment.adjusted_amount).toBeGreaterThan(0);
      expect(usedAdjustment).toBeTruthy();
      expect(usedAdjustment.adjusted_amount).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    it('should handle non-existent reservation gracefully', async () => {
      const request = {
        reservationId: 'non-existent-id',
        userId: testUserId,
        refundType: 'full' as const,
        refundReason: 'Non-existent reservation test',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Reservation not found');
      expect(result.auditTrail.length).toBeGreaterThan(0);
      expect(result.auditTrail[result.auditTrail.length - 1].result).toBe('failure');
    });

    it('should handle TossPayments failure gracefully', async () => {
      // Mock TossPayments failure
      mockTossPaymentsService.cancelPayment.mockRejectedValueOnce(
        new Error('TossPayments API error')
      );

      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'full' as const,
        refundReason: 'TossPayments failure test',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(false);
      expect(result.error).toContain('TossPayments API error');
      expect(result.auditTrail.some(entry => entry.result === 'failure')).toBe(true);
    });

    it('should handle already cancelled reservation', async () => {
      // Update reservation status to cancelled
      await supabase
        .from('reservations')
        .update({ status: 'cancelled' })
        .eq('id', testReservationId);

      const request = {
        reservationId: testReservationId,
        userId: testUserId,
        refundType: 'full' as const,
        refundReason: 'Already cancelled test',
        triggeredBy: 'user' as const
      };

      const result = await automatedRefundService.processAutomatedRefund(request);

      expect(result.success).toBe(false);
      expect(result.businessRuleValidation.policyViolations).toContain(
        'Reservation already cancelled'
      );

      // Reset status for other tests
      await supabase
        .from('reservations')
        .update({ status: 'confirmed' })
        .eq('id', testReservationId);
    });
  });
});

