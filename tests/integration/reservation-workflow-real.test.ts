/**
 * Complete Reservation Workflow Integration Tests - Real Database
 * 
 * End-to-end integration tests covering complete reservation workflows using real database:
 * - Complete user booking journey from request to completion
 * - Shop owner confirmation and management processes
 * - Payment processing integration throughout workflow
 * - Notification delivery across all workflow stages
 * - State transitions and cross-service interactions
 * - Error handling and recovery scenarios
 * 
 * Following testing rule: Use real Supabase connections, not mocks
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { ReservationStateMachine } from '../../src/services/reservation-state-machine.service';
import { TimeSlotService } from '../../src/services/time-slot.service';
import { PaymentService } from '../../src/services/payment.service';
import { NotificationService } from '../../src/services/notification.service';
import { 
  createTestUser, 
  createTestShop, 
  createTestService,
  createTestReservation,
  cleanupTestData,
  initializeTestDatabase,
  testSupabaseClient
} from '../setup-real-db';

// Mock only external services (payment gateways, SMS, email)
jest.mock('../../src/services/toss-payments.service', () => ({
  tossPaymentsService: {
    initiatePayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-payment-key-123',
      orderId: 'test-order-123',
      amount: 50000,
      status: 'READY'
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-payment-key-123',
      status: 'DONE',
      approvedAt: new Date().toISOString()
    }),
    cancelPayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-payment-key-123',
      status: 'CANCELED'
    })
  }
}));

jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendReservationNotification: jest.fn().mockResolvedValue({ success: true }),
    sendStateChangeNotification: jest.fn().mockResolvedValue({ success: true }),
    sendPaymentNotification: jest.fn().mockResolvedValue({ success: true })
  }
}));

jest.mock('../../src/services/sms.service', () => ({
  smsService: {
    sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'test-msg-123' })
  }
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'test-email-123' })
  }
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

// TODO: 결제 서비스 변경 후 활성화
describe.skip('Complete Reservation Workflow Integration Tests - Real Database', () => {
  let reservationService: ReservationService;
  let stateMachine: ReservationStateMachine;
  let timeSlotService: TimeSlotService;
  let paymentService: PaymentService;
  let notificationService: NotificationService;
  
  let testUser: any;
  let testShop: any;
  let testService: any;

  beforeAll(async () => {
    await initializeTestDatabase();
    
    // Initialize services
    reservationService = new ReservationService();
    stateMachine = new ReservationStateMachine();
    timeSlotService = new TimeSlotService();
    paymentService = new PaymentService();
    notificationService = new NotificationService();

    // Create test data
    console.log('🔧 Setting up integration test data...');
    
    testUser = await createTestUser({
      email: 'integration-user@example.com',
      name: 'Integration Test User',
      phone: '+821012345678',
      total_points: 50000,
      available_points: 50000
    });

    testShop = await createTestShop({
      name: 'Integration Test Shop',
      phone: '+821087654321',
      operating_hours: {
        monday: { open: '09:00', close: '18:00', closed: false },
        tuesday: { open: '09:00', close: '18:00', closed: false },
        wednesday: { open: '09:00', close: '18:00', closed: false },
        thursday: { open: '09:00', close: '18:00', closed: false },
        friday: { open: '09:00', close: '18:00', closed: false },
        saturday: { open: '09:00', close: '17:00', closed: false },
        sunday: { open: '10:00', close: '16:00', closed: false }
      }
    });

    testService = await createTestService({
      shop_id: testShop.id,
      name: 'Integration Test Service',
      price_min: 50000,
      price_max: 80000,
      duration_minutes: 90,
      deposit_amount: 15000,
      category: 'haircut'
    });

    console.log(`✅ Integration test data created: User ${testUser.id}, Shop ${testShop.id}, Service ${testService.id}`);
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('Complete User Booking Journey', () => {
    it('should complete full reservation workflow from request to completion', async () => {
      console.log('🚀 Starting complete booking journey test...');

      // Step 1: Check available time slots
      console.log('📅 Step 1: Checking available time slots...');
      const availableSlots = await timeSlotService.getAvailableTimeSlots({
        shopId: testShop.id,
        date: '2024-12-25',
        serviceIds: [testService.id]
      });

      expect(availableSlots).toBeDefined();
      expect(Array.isArray(availableSlots)).toBe(true);
      console.log(`✅ Found ${availableSlots.length} available time slots`);

      // Step 2: Create reservation request
      console.log('📝 Step 2: Creating reservation request...');
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-25',
        reservationTime: '14:00',
        pointsToUse: 0,
        specialRequests: 'Integration test reservation'
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      expect(reservation).toBeDefined();
      expect(reservation.id).toBeDefined();
      expect(reservation.status).toBe('requested');
      console.log(`✅ Reservation created with ID: ${reservation.id}`);

      // Step 3: Shop owner confirms reservation
      console.log('✅ Step 3: Shop owner confirming reservation...');
      const confirmedReservation = await stateMachine.transitionState(
        reservation.id,
        'confirmed',
        { confirmedBy: testShop.owner_id, confirmedAt: new Date() }
      );

      expect(confirmedReservation.status).toBe('confirmed');
      console.log(`✅ Reservation confirmed: ${confirmedReservation.id}`);

      // Step 4: Process payment
      console.log('💳 Step 4: Processing payment...');
      const paymentResult = await paymentService.processPayment({
        reservationId: reservation.id,
        amount: testService.price_min,
        paymentMethod: 'card',
        paymentStage: 'deposit'
      });

      expect(paymentResult).toBeDefined();
      expect(paymentResult.success).toBe(true);
      console.log(`✅ Payment processed successfully`);

      // Step 5: Complete service
      console.log('🎯 Step 5: Completing service...');
      const completedReservation = await stateMachine.transitionState(
        reservation.id,
        'completed',
        { completedAt: new Date(), completedBy: testShop.owner_id }
      );

      expect(completedReservation.status).toBe('completed');
      console.log(`✅ Service completed: ${completedReservation.id}`);

      // Step 6: Verify final state
      console.log('🔍 Step 6: Verifying final reservation state...');
      const finalReservation = await testSupabaseClient
        .from('reservations')
        .select('*')
        .eq('id', reservation.id)
        .single();

      expect(finalReservation.error).toBeNull();
      expect(finalReservation.data.status).toBe('completed');
      console.log(`✅ Complete booking journey test passed!`);
    }, 45000);

    it('should handle booking cancellation workflow', async () => {
      console.log('🚀 Starting booking cancellation workflow test...');

      // Create a reservation
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-26',
        reservationTime: '15:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      console.log(`📝 Created reservation for cancellation test: ${reservation.id}`);

      // Confirm the reservation
      await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Cancel by user
      console.log('❌ Cancelling reservation by user...');
      const cancelledReservation = await stateMachine.transitionState(
        reservation.id,
        'cancelled_by_user',
        { 
          cancelledAt: new Date(),
          cancellationReason: 'User requested cancellation',
          cancelledBy: testUser.id
        }
      );

      expect(cancelledReservation.status).toBe('cancelled_by_user');
      console.log(`✅ Reservation cancelled successfully: ${cancelledReservation.id}`);

      // Verify cancellation in database
      const cancelledData = await testSupabaseClient
        .from('reservations')
        .select('*')
        .eq('id', reservation.id)
        .single();

      expect(cancelledData.error).toBeNull();
      expect(cancelledData.data.status).toBe('cancelled_by_user');
      console.log(`✅ Cancellation workflow test passed!`);
    }, 30000);
  });

  describe('Shop Owner Workflow Tests', () => {
    it('should handle shop owner confirmation process', async () => {
      console.log('🚀 Starting shop owner confirmation workflow test...');

      // Create reservation
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-27',
        reservationTime: '11:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      console.log(`📝 Created reservation: ${reservation.id}`);

      // Shop owner views pending reservations
      console.log('👀 Shop owner viewing pending reservations...');
      const pendingReservations = await testSupabaseClient
        .from('reservations')
        .select('*')
        .eq('shop_id', testShop.id)
        .eq('status', 'requested');

      expect(pendingReservations.error).toBeNull();
      expect(pendingReservations.data.length).toBeGreaterThan(0);
      console.log(`✅ Found ${pendingReservations.data.length} pending reservations`);

      // Shop owner confirms reservation
      console.log('✅ Shop owner confirming reservation...');
      const confirmedReservation = await stateMachine.transitionState(
        reservation.id,
        'confirmed',
        { 
          confirmedBy: testShop.owner_id,
          confirmedAt: new Date(),
          notes: 'Confirmed by shop owner'
        }
      );

      expect(confirmedReservation.status).toBe('confirmed');
      console.log(`✅ Shop owner confirmation workflow test passed!`);
    }, 30000);

    it('should handle shop owner cancellation process', async () => {
      console.log('🚀 Starting shop owner cancellation workflow test...');

      // Create and confirm reservation
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-28',
        reservationTime: '16:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Shop owner cancels reservation
      console.log('❌ Shop owner cancelling reservation...');
      const cancelledReservation = await stateMachine.transitionState(
        reservation.id,
        'cancelled_by_shop',
        { 
          cancelledAt: new Date(),
          cancellationReason: 'Shop emergency closure',
          cancelledBy: testShop.owner_id
        }
      );

      expect(cancelledReservation.status).toBe('cancelled_by_shop');
      console.log(`✅ Shop owner cancellation workflow test passed!`);
    }, 30000);
  });

  describe('Payment Integration Workflow', () => {
    it('should handle complete payment workflow', async () => {
      console.log('🚀 Starting complete payment workflow test...');

      // Create and confirm reservation
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-29',
        reservationTime: '13:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Process deposit payment
      console.log('💳 Processing deposit payment...');
      const depositResult = await paymentService.processPayment({
        reservationId: reservation.id,
        amount: testService.deposit_amount,
        paymentMethod: 'card',
        paymentStage: 'deposit'
      });

      expect(depositResult.success).toBe(true);
      console.log(`✅ Deposit payment processed: ${depositResult.paymentId}`);

      // Process remaining payment
      console.log('💳 Processing remaining payment...');
      const remainingAmount = testService.price_min - testService.deposit_amount;
      const remainingResult = await paymentService.processPayment({
        reservationId: reservation.id,
        amount: remainingAmount,
        paymentMethod: 'card',
        paymentStage: 'final'
      });

      expect(remainingResult.success).toBe(true);
      console.log(`✅ Remaining payment processed: ${remainingResult.paymentId}`);

      // Verify payment records
      const payments = await testSupabaseClient
        .from('payments')
        .select('*')
        .eq('reservation_id', reservation.id);

      expect(payments.error).toBeNull();
      expect(payments.data.length).toBeGreaterThan(0);
      console.log(`✅ Payment workflow test passed! ${payments.data.length} payments recorded`);
    }, 30000);

    it('should handle payment failure and retry', async () => {
      console.log('🚀 Starting payment failure and retry workflow test...');

      // Create and confirm reservation
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-30',
        reservationTime: '10:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Simulate payment failure (by using invalid payment method)
      console.log('❌ Simulating payment failure...');
      try {
        await paymentService.processPayment({
          reservationId: reservation.id,
          amount: testService.deposit_amount,
          paymentMethod: 'invalid_method' as any,
          paymentStage: 'deposit'
        });
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Payment failure handled correctly: ${error.message}`);
      }

      // Retry with valid payment method
      console.log('🔄 Retrying payment with valid method...');
      const retryResult = await paymentService.processPayment({
        reservationId: reservation.id,
        amount: testService.deposit_amount,
        paymentMethod: 'card',
        paymentStage: 'deposit'
      });

      expect(retryResult.success).toBe(true);
      console.log(`✅ Payment retry workflow test passed!`);
    }, 30000);
  });

  describe('Notification Integration Workflow', () => {
    it('should send notifications throughout reservation lifecycle', async () => {
      console.log('🚀 Starting notification integration workflow test...');

      // Create reservation (should trigger notification)
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-31',
        reservationTime: '14:30',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);
      console.log(`📝 Created reservation: ${reservation.id}`);

      // Confirm reservation (should trigger notification)
      await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Complete reservation (should trigger notification)
      await stateMachine.transitionState(reservation.id, 'completed', {
        completedBy: testShop.owner_id,
        completedAt: new Date()
      });

      // Verify notifications were sent (mocked)
      const { shopOwnerNotificationService } = require('../../src/services/shop-owner-notification.service');
      expect(shopOwnerNotificationService.sendReservationNotification).toHaveBeenCalled();
      expect(shopOwnerNotificationService.sendStateChangeNotification).toHaveBeenCalled();

      console.log(`✅ Notification integration workflow test passed!`);
    }, 30000);
  });

  describe('State Transition Integration', () => {
    it('should handle all valid state transitions', async () => {
      console.log('🚀 Starting state transition integration test...');

      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2025-01-01',
        reservationTime: '09:00',
        pointsToUse: 0
      };

      // Create reservation (requested state)
      const reservation = await reservationService.createReservation(reservationRequest);
      expect(reservation.status).toBe('requested');
      console.log(`✅ State: requested → ${reservation.id}`);

      // Transition to confirmed
      const confirmed = await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });
      expect(confirmed.status).toBe('confirmed');
      console.log(`✅ State: confirmed → ${confirmed.id}`);

      // Transition to completed
      const completed = await stateMachine.transitionState(reservation.id, 'completed', {
        completedBy: testShop.owner_id,
        completedAt: new Date()
      });
      expect(completed.status).toBe('completed');
      console.log(`✅ State: completed → ${completed.id}`);

      console.log(`✅ All state transitions test passed!`);
    }, 30000);

    it('should prevent invalid state transitions', async () => {
      console.log('🚀 Starting invalid state transition test...');

      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2025-01-02',
        reservationTime: '11:30',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);

      // Try invalid transition (requested → completed without confirmation)
      try {
        await stateMachine.transitionState(reservation.id, 'completed', {
          completedBy: testShop.owner_id
        });
        fail('Should have thrown error for invalid state transition');
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Invalid state transition correctly prevented: ${error.message}`);
      }

      console.log(`✅ Invalid state transition prevention test passed!`);
    }, 30000);
  });

  describe('Cross-Service Integration', () => {
    it('should handle interactions between all services', async () => {
      console.log('🚀 Starting cross-service integration test...');

      // Test time slot service integration
      const availableSlots = await timeSlotService.getAvailableTimeSlots({
        shopId: testShop.id,
        date: '2025-01-03',
        serviceIds: [testService.id]
      });
      expect(availableSlots).toBeDefined();

      // Test reservation service integration
      const reservationRequest: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2025-01-03',
        reservationTime: '15:00',
        pointsToUse: 0
      };

      const reservation = await reservationService.createReservation(reservationRequest);

      // Test state machine integration
      const confirmed = await stateMachine.transitionState(reservation.id, 'confirmed', {
        confirmedBy: testShop.owner_id
      });

      // Test payment service integration
      const paymentResult = await paymentService.processPayment({
        reservationId: reservation.id,
        amount: testService.deposit_amount,
        paymentMethod: 'card',
        paymentStage: 'deposit'
      });

      // Test notification service integration
      await notificationService.sendNotificationToUser(testUser.id, {
        title: 'Integration Test',
        body: 'Cross-service integration test notification',
        data: { reservationId: reservation.id }
      });

      expect(reservation).toBeDefined();
      expect(confirmed.status).toBe('confirmed');
      expect(paymentResult.success).toBe(true);

      console.log(`✅ Cross-service integration test passed!`);
    }, 30000);
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection errors gracefully', async () => {
      console.log('🚀 Starting error handling and recovery test...');

      // Test with invalid shop ID
      try {
        const invalidRequest: CreateReservationRequest = {
          shopId: 'invalid-shop-id',
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2025-01-04',
          reservationTime: '12:00',
          pointsToUse: 0
        };

        await reservationService.createReservation(invalidRequest);
        fail('Should have thrown error for invalid shop ID');
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Invalid shop ID error handled: ${error.message}`);
      }

      // Test with invalid user ID
      try {
        const invalidRequest: CreateReservationRequest = {
          shopId: testShop.id,
          userId: 'invalid-user-id',
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2025-01-04',
          reservationTime: '13:00',
          pointsToUse: 0
        };

        await reservationService.createReservation(invalidRequest);
        fail('Should have thrown error for invalid user ID');
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Invalid user ID error handled: ${error.message}`);
      }

      console.log(`✅ Error handling and recovery test passed!`);
    }, 30000);

    it('should handle concurrent booking conflicts', async () => {
      console.log('🚀 Starting concurrent booking conflict test...');

      const reservationRequest1: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2025-01-05',
        reservationTime: '14:00',
        pointsToUse: 0
      };

      const reservationRequest2: CreateReservationRequest = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2025-01-05',
        reservationTime: '14:00', // Same time slot
        pointsToUse: 0
      };

      // Create first reservation
      const reservation1 = await reservationService.createReservation(reservationRequest1);
      expect(reservation1).toBeDefined();
      console.log(`✅ First reservation created: ${reservation1.id}`);

      // Try to create conflicting reservation
      try {
        await reservationService.createReservation(reservationRequest2);
        fail('Should have thrown error for conflicting time slot');
      } catch (error) {
        expect(error).toBeDefined();
        console.log(`✅ Concurrent booking conflict handled: ${error.message}`);
      }

      console.log(`✅ Concurrent booking conflict test passed!`);
    }, 30000);
  });

  describe('Performance Integration', () => {
    it('should maintain performance standards in integration scenarios', async () => {
      console.log('🚀 Starting performance integration test...');

      const startTime = performance.now();

      // Create multiple reservations sequentially
      const reservations = [];
      for (let i = 0; i < 5; i++) {
        const reservationRequest: CreateReservationRequest = {
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2025-01-06',
          reservationTime: `${10 + i}:00`,
          pointsToUse: 0
        };

        const reservation = await reservationService.createReservation(reservationRequest);
        reservations.push(reservation);
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(reservations.length).toBe(5);

      console.log(`✅ Performance integration test passed! Created ${reservations.length} reservations in ${executionTime.toFixed(2)}ms`);
    }, 30000);
  });
});

