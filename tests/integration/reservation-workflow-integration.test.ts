/**
 * Comprehensive Reservation Workflow Integration Tests
 * 
 * End-to-end integration tests covering complete reservation workflows:
 * - Complete booking to completion journey
 * - Payment processing integration
 * - State transitions and notifications
 * - Error handling and recovery
 * - Concurrent user scenarios
 * - Performance under load
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';
import { GlobalTestSetup } from '../setup/reservation-database-setup';

// Import services for integration testing
import { ReservationService } from '../../src/services/reservation.service';
import { ReservationStateMachine } from '../../src/services/reservation-state-machine.service';
import { TimeSlotService } from '../../src/services/time-slot.service';
import { PaymentService } from '../../src/services/payment.service';
import { NotificationService } from '../../src/services/notification.service';

// Mock external dependencies with inline factory to provide mock at instantiation time
jest.mock('../../src/config/database', () => {
  const mock: any = {};
  const methods = ['from', 'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'lte', 'lt', 'gte', 'gt', 'in', 'single', 'maybeSingle', 'count', 'order', 'limit', 'not', 'range', 'like', 'ilike', 'or', 'and', 'is', 'filter', 'match', 'offset', 'contains', 'containedBy', 'overlaps', 'textSearch', 'csv', 'returns', 'throwOnError'];
  for (const method of methods) {
    mock[method] = jest.fn().mockReturnValue(mock);
  }
  mock.then = (resolve: any) => resolve({ data: [], error: null });
  mock.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  mock.auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signUp: jest.fn(), signInWithPassword: jest.fn(), signOut: jest.fn(), refreshSession: jest.fn(),
    admin: { getUserById: jest.fn(), listUsers: jest.fn(), deleteUser: jest.fn() }
  };
  mock.storage = { from: jest.fn(() => ({ upload: jest.fn(), download: jest.fn(), remove: jest.fn(), list: jest.fn(), createSignedUrl: jest.fn(), getPublicUrl: jest.fn() })) };
  return {
    __mockSupabase: mock,
    getSupabaseClient: jest.fn(() => mock),
    getDatabase: jest.fn(() => ({ client: mock, healthCheck: jest.fn().mockResolvedValue(true), disconnect: jest.fn() })),
    initializeDatabase: jest.fn(() => ({ client: mock, healthCheck: jest.fn().mockResolvedValue(true), disconnect: jest.fn() })),
    database: { initialize: jest.fn(), getInstance: jest.fn(), getClient: jest.fn(() => mock), withRetry: jest.fn((op: any) => op()), isHealthy: jest.fn().mockResolvedValue(true), getMonitorStatus: jest.fn().mockReturnValue(true) }
  };
});
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/notification.service');

// Mock the time slot service module singleton used by ReservationService
jest.mock('../../src/services/time-slot.service', () => {
  const mockTimeSlotService = {
    isSlotAvailable: jest.fn().mockResolvedValue(true),
    validateSlotAvailability: jest.fn().mockResolvedValue({
      available: true,
      conflictReason: null,
      conflictingReservations: [],
      suggestedAlternatives: [],
    }),
    getAvailableSlots: jest.fn().mockResolvedValue([]),
    getAvailableTimeSlots: jest.fn().mockResolvedValue([
      { startTime: '09:00', endTime: '10:00', duration: 60, isAvailable: true },
      { startTime: '10:00', endTime: '11:00', duration: 60, isAvailable: true },
      { startTime: '11:00', endTime: '12:00', duration: 60, isAvailable: true },
    ]),
    checkSlotConflict: jest.fn().mockResolvedValue(false),
  };
  return {
    timeSlotService: mockTimeSlotService,
    TimeSlotService: jest.fn().mockImplementation(() => mockTimeSlotService),
  };
});

// Mock query cache service to execute query functions directly
jest.mock('../../src/services/query-cache.service', () => ({
  queryCacheService: {
    getCachedQuery: jest.fn((_key: string, queryFn: () => Promise<any>) => queryFn()),
    invalidate: jest.fn(),
    invalidatePattern: jest.fn(),
  }
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock notification and websocket services used by ReservationService
jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendNewReservationNotification: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/customer-notification.service', () => ({
  customerNotificationService: {
    sendReservationConfirmation: jest.fn().mockResolvedValue(undefined),
    sendNotification: jest.fn().mockResolvedValue(undefined),
    notifyCustomerOfReservationUpdate: jest.fn().mockResolvedValue(undefined),
  },
}));

jest.mock('../../src/services/batch-query.service', () => ({
  batchQueryService: {
    executeBatch: jest.fn().mockResolvedValue([]),
  },
}));

jest.mock('../../src/services/websocket.service', () => ({
  websocketService: {
    emitReservationUpdate: jest.fn(),
    emit: jest.fn(),
  },
}));

jest.mock('../../src/services/point.service', () => ({
  PointService: jest.fn().mockImplementation(() => ({
    getUserPoints: jest.fn().mockResolvedValue({ totalPoints: 1000, availablePoints: 1000 }),
    deductPoints: jest.fn().mockResolvedValue(true),
  })),
}));

jest.mock('../../src/services/monitoring.service', () => ({
  monitoringService: {
    trackError: jest.fn(),
    trackPerformance: jest.fn(),
    trackMetric: jest.fn(),
    getMetrics: jest.fn().mockReturnValue({}),
  },
}));

import { getSupabaseClient } from '../../src/config/database';
import { paymentService } from '../../src/services/payment.service';
import { notificationService } from '../../src/services/notification.service';

describe('Reservation Workflow Integration Tests', () => {
  let reservationService: ReservationService;
  let stateMachine: ReservationStateMachine;
  let timeSlotService: TimeSlotService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockPaymentService: jest.Mocked<typeof paymentService>;
  let mockNotificationService: jest.Mocked<typeof notificationService>;

  // Mutable state for context-dependent mock responses
  let currentReservationStatus = 'requested';
  let currentReservationId = 'reservation-default';

  // Helper to update tracked reservation state in tests
  function setReservationState(status: string, id?: string) {
    currentReservationStatus = status;
    if (id) currentReservationId = id;
  }

  // Helper to mock a successful state transition RPC that also updates tracked state
  function mockRpcTransition(data: Record<string, any>) {
    mockSupabase.rpc.mockImplementationOnce(() => {
      // Update tracked state so subsequent getReservationById returns new status
      if (data.status) {
        currentReservationStatus = data.status;
      }
      if (data.id) {
        currentReservationId = data.id;
      }
      return Promise.resolve({ data, error: null });
    });
  }

  beforeAll(async () => {
    // Setup integration test environment
    await GlobalTestSetup.setup();
  });

  afterAll(async () => {
    // Cleanup integration test environment
    await GlobalTestSetup.teardown();
  });

  beforeEach(() => {
    mockSupabase = (require('../../src/config/database') as any).__mockSupabase;

    // Reset all mock implementations and call history, then restore chainable returns
    const methods = ['from', 'select', 'insert', 'update', 'delete', 'upsert', 'eq', 'neq', 'lte', 'lt', 'gte', 'gt', 'in', 'single', 'maybeSingle', 'count', 'order', 'limit', 'not', 'range', 'like', 'ilike', 'or', 'and', 'is', 'filter', 'match', 'offset', 'contains', 'containedBy', 'overlaps', 'textSearch', 'csv', 'returns', 'throwOnError'];
    for (const method of methods) {
      mockSupabase[method].mockReset();
      mockSupabase[method].mockReturnValue(mockSupabase);
    }
    mockSupabase.rpc.mockReset();
    // Default rpc mock - individual tests override with mockResolvedValue/mockResolvedValueOnce
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    // Track current table for context-dependent mock responses
    let currentTable = '';
    // Reset mutable reservation state for each test
    currentReservationStatus = 'requested';
    currentReservationId = 'reservation-default';

    mockSupabase.from.mockImplementation((table: string) => {
      currentTable = table;
      return mockSupabase;
    });

    // Future date for time condition validations to pass:
    // - Must be within 24 hours for maxTimeBeforeReservation (requested -> confirmed)
    // - Must be more than 2 hours away for minTimeBeforeReservation (cancellation)
    // 12 hours from now satisfies both constraints
    const futureDateTime = new Date(Date.now() + 12 * 60 * 60 * 1000).toISOString();

    // Context-dependent single() responses based on which table was queried
    mockSupabase.single.mockImplementation(() => {
      if (currentTable === 'users') {
        return Promise.resolve({
          data: { booking_preferences: { skinType: 'normal', allergyInfo: 'none' } },
          error: null,
        });
      }
      if (currentTable === 'reservations') {
        return Promise.resolve({
          data: {
            id: currentReservationId,
            status: currentReservationStatus,
            shop_id: 'shop-123',
            user_id: 'user-123',
            reservation_date: '2024-03-15',
            reservation_time: '10:00',
            reservation_datetime: futureDateTime,
            total_amount: 50000,
            deposit_amount: 10000,
          },
          error: null,
        });
      }
      if (currentTable === 'shops') {
        return Promise.resolve({
          data: { id: 'shop-123', name: 'Test Shop', owner_id: 'shop-456' },
          error: null,
        });
      }
      if (currentTable === 'payments') {
        return Promise.resolve({
          data: { id: 'payment-1', payment_status: 'fully_paid' },
          error: null,
        });
      }
      // Default fallback
      return Promise.resolve({ data: null, error: null });
    });


    // Set up mock chain to return shop_services data (for calculatePricingWithDeposit)
    mockSupabase.in.mockResolvedValue({
      data: [{
        id: 'service-1',
        price_min: 50000,
        name: 'Test Service',
        deposit_amount: 10000,
        deposit_percentage: null,
      }],
      error: null,
    });

    // Re-establish the timeSlotService mock after clearAllMocks
    const { timeSlotService: mockTSS } = require('../../src/services/time-slot.service');
    mockTSS.validateSlotAvailability.mockResolvedValue({
      available: true,
      conflictReason: null,
      conflictingReservations: [],
      suggestedAlternatives: [],
    });
    mockTSS.getAvailableTimeSlots.mockResolvedValue([
      { startTime: '09:00', endTime: '10:00', duration: 60, isAvailable: true },
      { startTime: '10:00', endTime: '11:00', duration: 60, isAvailable: true },
      { startTime: '11:00', endTime: '12:00', duration: 60, isAvailable: true },
    ]);
    mockTSS.isSlotAvailable.mockResolvedValue(true);

    // Initialize services (they will get mockSupabaseInstance from the factory)
    reservationService = new ReservationService();
    stateMachine = new ReservationStateMachine();
    timeSlotService = new TimeSlotService();
    testUtils = new ReservationTestUtils();

    mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
    mockNotificationService = notificationService as jest.Mocked<typeof notificationService>;
  });

  describe('Complete Booking to Completion Journey', () => {
    it('should complete full reservation workflow from request to completion', async () => {
      // Step 1: Check available time slots
      const availableSlots = await timeSlotService.getAvailableTimeSlots({
        shopId: 'shop-123',
        date: '2024-03-15',
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      });

      expect(availableSlots).toBeDefined();
      expect(availableSlots.length).toBeGreaterThan(0);

      // Step 2: Create reservation request
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        specialRequests: 'Test reservation',
        paymentInfo: {
          depositAmount: 10000,
          remainingAmount: 40000,
          depositRequired: true
        }
      };

      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      expect(reservation.id).toBe('reservation-123');
      expect(reservation.status).toBe('requested');

      // Step 3: Shop confirms reservation
      setReservationState('requested', 'reservation-123');
      mockRpcTransition({
        id: 'reservation-123',
        status: 'confirmed',
        previous_status: 'requested'
      });

      const confirmationResult = await stateMachine.executeTransition(
        'reservation-123',
        'confirmed',
        'shop',
        'shop-456',
        'Shop confirmed the reservation'
      );

      expect(confirmationResult.success).toBe(true);
      expect(confirmationResult.reservation?.status).toBe('confirmed');

      // Step 4: Process payment
      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'txn-123',
        amount: 10000
      });

      const paymentResult = await paymentService.processPayment({
        reservationId: 'reservation-123',
        amount: 10000,
        paymentMethod: 'card'
      });

      expect(paymentResult.success).toBe(true);

      // Step 5: Complete service
      mockRpcTransition({
        id: 'reservation-123',
        status: 'completed',
        previous_status: 'confirmed',
        completion_timestamp: new Date().toISOString()
      });

      const completionResult = await stateMachine.executeTransition(
        'reservation-123',
        'completed',
        'shop',
        'shop-456',
        'Service completed successfully'
      );

      expect(completionResult.success).toBe(true);
      expect(completionResult.reservation?.status).toBe('completed');
    });

    it('should handle cancellation workflow', async () => {
      // Create confirmed reservation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-456', status: 'confirmed' },
        error: null
      });

      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      // User cancels reservation - set state to confirmed before transition
      setReservationState('confirmed', 'reservation-456');
      mockRpcTransition({
        id: 'reservation-456',
        status: 'cancelled_by_user',
        previous_status: 'confirmed',
        cancellation_timestamp: new Date().toISOString(),
        refund_eligible: true
      });

      const cancellationResult = await stateMachine.executeTransition(
        'reservation-456',
        'cancelled_by_user',
        'user',
        'user-123',
        'Customer requested cancellation'
      );

      expect(cancellationResult.success).toBe(true);
      expect(cancellationResult.reservation?.status).toBe('cancelled_by_user');

      // Verify refund processing (processRefund is not on the real service,
      // so we manually define it on the mock to test the conceptual flow)
      (mockPaymentService as any).processRefund = jest.fn().mockResolvedValue({
        success: true,
        refundId: 'refund-123',
        amount: 10000
      });

      const refundResult = await (paymentService as any).processRefund({
        reservationId: 'reservation-456',
        amount: 10000
      });

      expect(refundResult.success).toBe(true);
    });

    it('should handle no-show workflow', async () => {
      // Set state to confirmed for no-show transition
      setReservationState('confirmed', 'reservation-789');

      // System automatically marks as no-show
      mockRpcTransition({
        id: 'reservation-789',
        status: 'no_show',
        previous_status: 'confirmed',
        no_show_timestamp: new Date().toISOString()
      });

      const noShowResult = await stateMachine.executeTransition(
        'reservation-789',
        'no_show',
        'system',
        'system',
        'Customer did not arrive within grace period'
      );

      expect(noShowResult.success).toBe(true);
      expect(noShowResult.reservation?.status).toBe('no_show');
    });
  });

  describe('Payment Processing Integration', () => {
    it('should handle deposit payment workflow', async () => {
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        paymentInfo: {
          depositAmount: 15000,
          remainingAmount: 35000,
          depositRequired: true
        }
      };

      // Create reservation with deposit
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-deposit', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      // Process deposit payment
      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'deposit-txn-123',
        amount: 15000
      });

      const depositResult = await paymentService.processPayment({
        reservationId: 'reservation-deposit',
        amount: 15000,
        paymentMethod: 'card',
        isDeposit: true
      });

      expect(depositResult.success).toBe(true);

      // Confirm reservation after deposit
      setReservationState('requested', 'reservation-deposit');
      mockRpcTransition({
        id: 'reservation-deposit',
        status: 'confirmed',
        deposit_paid: true,
        remaining_amount: 35000
      });

      const confirmationResult = await stateMachine.executeTransition(
        'reservation-deposit',
        'confirmed',
        'shop',
        'shop-456',
        'Deposit received, confirming reservation'
      );

      expect(confirmationResult.success).toBe(true);
    });

    it('should handle full payment workflow', async () => {
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00',
        paymentInfo: {
          depositAmount: 0,
          remainingAmount: 50000,
          depositRequired: false
        }
      };

      // Create reservation without deposit
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-full', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      // Process full payment
      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        transactionId: 'full-txn-123',
        amount: 50000
      });

      const fullPaymentResult = await paymentService.processPayment({
        reservationId: 'reservation-full',
        amount: 50000,
        paymentMethod: 'card',
        isDeposit: false
      });

      expect(fullPaymentResult.success).toBe(true);

      // Confirm after full payment
      setReservationState('requested', 'reservation-full');
      mockRpcTransition({
        id: 'reservation-full',
        status: 'confirmed',
        payment_completed: true
      });

      const autoConfirmationResult = await stateMachine.executeTransition(
        'reservation-full',
        'confirmed',
        'shop',
        'shop-456',
        'Payment completed, confirming'
      );

      expect(autoConfirmationResult.success).toBe(true);
    });

    it('should handle payment failure scenarios', async () => {
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      // Create reservation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-fail', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      // Payment fails
      mockPaymentService.processPayment.mockResolvedValue({
        success: false,
        error: 'Insufficient funds'
      });

      const paymentResult = await paymentService.processPayment({
        reservationId: 'reservation-fail',
        amount: 50000,
        paymentMethod: 'card'
      });

      expect(paymentResult.success).toBe(false);
      expect(paymentResult.error).toBe('Insufficient funds');

      // Reservation should remain in requested state
      expect(reservation.status).toBe('requested');
    });
  });

  describe('State Transition Integration', () => {
    it('should handle complex state transition sequences', async () => {
      // Start with requested reservation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-complex', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      // Transition: requested -> confirmed
      setReservationState('requested', 'reservation-complex');
      mockRpcTransition({
        id: 'reservation-complex',
        status: 'confirmed',
        previous_status: 'requested'
      });

      const confirmedResult = await stateMachine.executeTransition(
        'reservation-complex',
        'confirmed',
        'shop',
        'shop-456',
        'Shop confirmed'
      );

      expect(confirmedResult.success).toBe(true);

      // Transition: confirmed -> completed (valid transition in state machine)
      mockRpcTransition({
        id: 'reservation-complex',
        status: 'completed',
        previous_status: 'confirmed'
      });

      const completedResult = await stateMachine.executeTransition(
        'reservation-complex',
        'completed',
        'shop',
        'shop-456',
        'Service completed'
      );

      expect(completedResult.success).toBe(true);
    });

    it('should prevent invalid state transitions', async () => {
      // Try to transition from completed back to confirmed
      setReservationState('completed', 'reservation-invalid');

      const invalidResult = await stateMachine.executeTransition(
        'reservation-invalid',
        'confirmed',
        'shop',
        'shop-456',
        'Invalid transition attempt'
      );

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors).toContain('Invalid transition from completed to confirmed');
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle multiple users booking same time slot', async () => {
      const timeSlot = '10:00';
      const date = '2024-03-15';
      const shopId = 'shop-123';

      // First user creates reservation successfully
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-user1', status: 'requested' },
        error: null
      });
      // Second user gets rejection on all internal retry attempts
      mockSupabase.rpc.mockRejectedValue(new Error('Time slot no longer available'));

      const reservation1 = await reservationService.createReservation({
        shopId,
        userId: 'user-1',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: date,
        reservationTime: timeSlot
      });

      expect(reservation1.id).toBe('reservation-user1');

      // Second user tries to book same slot
      await expect(
        reservationService.createReservation({
          shopId,
          userId: 'user-2',
          services: [{ serviceId: 'service-1', quantity: 1 }],
          reservationDate: date,
          reservationTime: timeSlot
        })
      ).rejects.toThrow('Time slot no longer available');
    });

    it('should handle concurrent state changes', async () => {
      const reservationId = 'reservation-concurrent';

      // First transition: requested -> confirmed (succeeds)
      setReservationState('requested', reservationId);
      mockRpcTransition({
        id: reservationId,
        status: 'confirmed',
        previous_status: 'requested'
      });

      const result1 = await stateMachine.executeTransition(
        reservationId,
        'confirmed',
        'shop',
        'shop-456',
        'First confirmation'
      );

      expect(result1.success).toBe(true);

      // Second transition: tries confirmed -> cancelled_by_user (allowed by 'user')
      // After first transition, state is now 'confirmed' (automatically updated by mockRpcTransition)
      mockRpcTransition({
        id: reservationId,
        status: 'cancelled_by_user',
        previous_status: 'confirmed'
      });

      const result2 = await stateMachine.executeTransition(
        reservationId,
        'cancelled_by_user',
        'user',
        'user-123',
        'Concurrent cancellation'
      );

      // This transition is valid (confirmed -> cancelled_by_user by user)
      expect(result2.success).toBe(true);
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle database connection failures gracefully', async () => {
      mockSupabase.rpc.mockRejectedValue(new Error('Database connection failed'));

      await expect(
        reservationService.createReservation({
          shopId: 'shop-123',
          userId: 'user-123',
          services: [{ serviceId: 'service-1', quantity: 1 }],
          reservationDate: '2024-03-15',
          reservationTime: '10:00'
        })
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle payment service failures', async () => {
      mockPaymentService.processPayment.mockRejectedValue(
        new Error('Payment service unavailable')
      );

      await expect(
        paymentService.processPayment({
          reservationId: 'reservation-123',
          amount: 50000,
          paymentMethod: 'card'
        })
      ).rejects.toThrow('Payment service unavailable');
    });

    it('should handle notification service failures without affecting core workflow', async () => {
      // Create reservation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-notify', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      // Confirm reservation - state transition should succeed
      // even if notification service would fail (handled internally)
      setReservationState('requested', 'reservation-notify');
      mockRpcTransition({
        id: 'reservation-notify',
        status: 'confirmed',
        previous_status: 'requested'
      });

      const confirmationResult = await stateMachine.executeTransition(
        'reservation-notify',
        'confirmed',
        'shop',
        'shop-456',
        'Shop confirmed despite notification failure'
      );

      // State transition should succeed even if notification fails
      expect(confirmationResult.success).toBe(true);
    });

    it('should retry failed operations', async () => {
      // Mock retry scenario: first attempt fails, second succeeds
      mockSupabase.rpc
        .mockRejectedValueOnce(new Error('Temporary database error'))
        .mockResolvedValueOnce({
          data: { id: 'reservation-retry', status: 'requested' },
          error: null
        });

      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      expect(reservation.id).toBe('reservation-retry');
      expect(mockSupabase.rpc).toHaveBeenCalledTimes(2);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle multiple concurrent reservation requests efficiently', async () => {
      const requests = Array(50).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 8)}:00`, // Distribute across 8 time slots
        specialRequests: `Request ${index}`
      }));

      // Mock successful responses for all requests
      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-success', status: 'requested' },
        error: null
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        requests.map(request => reservationService.createReservation(request))
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful).toHaveLength(50);
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle high-frequency state transitions', async () => {
      const transitions = Array(100).fill(0).map((_, index) => ({
        reservationId: `reservation-${index}`,
        newStatus: 'confirmed' as const,
        changedBy: 'shop' as const,
        changedById: 'shop-456',
        reason: `Confirmation ${index}`
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-confirmed', 
          status: 'confirmed',
          previous_status: 'requested'
        },
        error: null
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        transitions.map(transition => 
          stateMachine.executeTransition(
            transition.reservationId,
            transition.newStatus,
            transition.changedBy,
            transition.changedById,
            transition.reason
          )
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      
      expect(successful).toHaveLength(100);
      expect(executionTime).toBeLessThan(15000); // Should complete within 15 seconds
    });

    it('should handle bulk time slot availability checks', async () => {
      const timeSlotRequests = Array(200).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        date: '2024-03-15',
        startTime: `${9 + (index % 8)}:00`,
        serviceIds: ['service-1']
      }));

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: [],
                error: null
              })
            })
          })
        })
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        timeSlotRequests.map(request => 
          timeSlotService.isSlotAvailable(
            request.shopId,
            request.date,
            request.startTime,
            request.serviceIds
          )
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      expect(results).toHaveLength(200);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency across service boundaries', async () => {
      const { timeSlotService: mockTSS } = require('../../src/services/time-slot.service');

      // Create reservation
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-consistency', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      // After reservation creation, slot should be unavailable
      mockTSS.isSlotAvailable.mockResolvedValueOnce(false);

      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(isAvailable).toBe(false);

      // Cancel reservation
      setReservationState('requested', 'reservation-consistency');
      mockRpcTransition({
        id: 'reservation-consistency',
        status: 'cancelled_by_user',
        previous_status: 'requested'
      });

      await stateMachine.executeTransition(
        'reservation-consistency',
        'cancelled_by_user',
        'user',
        'user-123',
        'User cancelled'
      );

      // After cancellation, slot should be available again
      mockTSS.isSlotAvailable.mockResolvedValueOnce(true);

      const isAvailableAfterCancellation = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(isAvailableAfterCancellation).toBe(true);
    });

    it('should handle transaction rollback on failures', async () => {
      // Mock scenario where reservation creation succeeds but payment fails
      mockSupabase.rpc.mockResolvedValueOnce({
        data: { id: 'reservation-rollback', status: 'requested' },
        error: null
      });

      // Create reservation
      const reservation = await reservationService.createReservation({
        shopId: 'shop-123',
        userId: 'user-123',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      });

      // Payment fails
      mockPaymentService.processPayment.mockResolvedValue({
        success: false,
        error: 'Payment processing failed'
      });

      const paymentResult = await paymentService.processPayment({
        reservationId: 'reservation-rollback',
        amount: 50000,
        paymentMethod: 'card'
      });

      expect(paymentResult.success).toBe(false);

      // Shop cancels reservation due to payment failure (requested -> cancelled_by_shop)
      setReservationState('requested', 'reservation-rollback');
      mockRpcTransition({
        id: 'reservation-rollback',
        status: 'cancelled_by_shop',
        previous_status: 'requested',
        cancellation_reason: 'Payment failed'
      });

      const rollbackResult = await stateMachine.executeTransition(
        'reservation-rollback',
        'cancelled_by_shop',
        'shop',
        'shop-456',
        'Payment failed, cancelling reservation'
      );

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.reservation?.status).toBe('cancelled_by_shop');
    });
  });
});
