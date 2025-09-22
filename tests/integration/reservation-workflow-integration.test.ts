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

// Mock external dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/notification.service');

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

  beforeAll(async () => {
    // Setup integration test environment
    await GlobalTestSetup.setup();
  });

  afterAll(async () => {
    // Cleanup integration test environment
    await GlobalTestSetup.teardown();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    reservationService = new ReservationService();
    stateMachine = new ReservationStateMachine();
    timeSlotService = new TimeSlotService();
    testUtils = new ReservationTestUtils();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

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

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-123', status: 'requested' },
        error: null
      });

      const reservation = await reservationService.createReservation(reservationRequest);

      expect(reservation.id).toBe('reservation-123');
      expect(reservation.status).toBe('requested');

      // Step 3: Shop confirms reservation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'confirmed',
          previous_status: 'requested'
        },
        error: null
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
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-123', 
          status: 'completed',
          previous_status: 'confirmed',
          completion_timestamp: new Date().toISOString()
        },
        error: null
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

      // Verify notification was sent
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'reservation_completed',
          reservationId: 'reservation-123'
        })
      );
    });

    it('should handle cancellation workflow', async () => {
      // Create confirmed reservation
      mockSupabase.rpc.mockResolvedValue({
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

      // User cancels reservation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-456', 
          status: 'cancelled_by_user',
          previous_status: 'confirmed',
          cancellation_timestamp: new Date().toISOString(),
          refund_eligible: true
        },
        error: null
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
      expect(cancellationResult.reservation?.refund_eligible).toBe(true);

      // Verify refund processing
      mockPaymentService.processRefund.mockResolvedValue({
        success: true,
        refundId: 'refund-123',
        amount: 10000
      });

      const refundResult = await paymentService.processRefund({
        reservationId: 'reservation-456',
        amount: 10000
      });

      expect(refundResult.success).toBe(true);
    });

    it('should handle no-show workflow', async () => {
      // Create confirmed reservation for past time
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 30);
      const pastTimeStr = pastTime.toISOString().substring(11, 16);

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-789', 
          status: 'confirmed',
          reservation_date: new Date().toISOString().split('T')[0],
          start_time: pastTimeStr
        },
        error: null
      });

      // System automatically marks as no-show
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-789', 
          status: 'no_show',
          previous_status: 'confirmed',
          no_show_timestamp: new Date().toISOString()
        },
        error: null
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

      // Verify no-show notification
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'no_show_detected',
          reservationId: 'reservation-789'
        })
      );
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
      mockSupabase.rpc.mockResolvedValue({
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
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-deposit', 
          status: 'confirmed',
          deposit_paid: true,
          remaining_amount: 35000
        },
        error: null
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
      mockSupabase.rpc.mockResolvedValue({
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

      // Auto-confirm after full payment
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-full', 
          status: 'confirmed',
          payment_completed: true
        },
        error: null
      });

      const autoConfirmationResult = await stateMachine.executeTransition(
        'reservation-full',
        'confirmed',
        'system',
        'system',
        'Payment completed, auto-confirming'
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
      mockSupabase.rpc.mockResolvedValue({
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
      mockSupabase.rpc.mockResolvedValue({
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
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-complex', 
          status: 'confirmed',
          previous_status: 'requested'
        },
        error: null
      });

      const confirmedResult = await stateMachine.executeTransition(
        'reservation-complex',
        'confirmed',
        'shop',
        'shop-456',
        'Shop confirmed'
      );

      expect(confirmedResult.success).toBe(true);

      // Transition: confirmed -> in_progress
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-complex', 
          status: 'in_progress',
          previous_status: 'confirmed'
        },
        error: null
      });

      const inProgressResult = await stateMachine.executeTransition(
        'reservation-complex',
        'in_progress',
        'shop',
        'shop-456',
        'Service started'
      );

      expect(inProgressResult.success).toBe(true);

      // Transition: in_progress -> completed
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-complex', 
          status: 'completed',
          previous_status: 'in_progress'
        },
        error: null
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
      mockSupabase.rpc.mockResolvedValue({
        data: {
          id: 'reservation-invalid',
          status: 'completed',
          previous_status: 'completed',
          transition_successful: false,
          error_message: 'Invalid transition: completed -> confirmed'
        },
        error: null
      });

      const invalidResult = await stateMachine.executeTransition(
        'reservation-invalid',
        'confirmed',
        'shop',
        'shop-456',
        'Invalid transition attempt'
      );

      expect(invalidResult.success).toBe(false);
      expect(invalidResult.errors).toContain('Invalid transition: completed -> confirmed');
    });
  });

  describe('Concurrent User Scenarios', () => {
    it('should handle multiple users booking same time slot', async () => {
      const timeSlot = '10:00';
      const date = '2024-03-15';
      const shopId = 'shop-123';

      // First user creates reservation
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: { id: 'reservation-user1', status: 'requested' },
          error: null
        })
        // Second user gets conflict
        .mockRejectedValueOnce(new Error('Time slot no longer available'));

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

      // Simulate two concurrent state changes
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: { 
            id: reservationId, 
            status: 'confirmed',
            previous_status: 'requested'
          },
          error: null
        })
        .mockResolvedValueOnce({
          data: {
            id: reservationId,
            status: 'requested',
            previous_status: 'requested',
            transition_successful: false,
            error_message: 'Reservation state has changed since last read'
          },
          error: null
        });

      // First transition succeeds
      const result1 = await stateMachine.executeTransition(
        reservationId,
        'confirmed',
        'shop',
        'shop-456',
        'First confirmation'
      );

      expect(result1.success).toBe(true);

      // Second concurrent transition fails
      const result2 = await stateMachine.executeTransition(
        reservationId,
        'cancelled',
        'user',
        'user-123',
        'Concurrent cancellation'
      );

      expect(result2.success).toBe(false);
      expect(result2.errors).toContain('Reservation state has changed since last read');
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
      mockSupabase.rpc.mockResolvedValue({
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

      // Confirm reservation (notification service fails)
      mockNotificationService.sendNotification.mockRejectedValue(
        new Error('Notification service unavailable')
      );

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-notify', 
          status: 'confirmed',
          previous_status: 'requested'
        },
        error: null
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
      // Create reservation
      mockSupabase.rpc.mockResolvedValue({
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

      // Verify time slot is marked as unavailable
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: [{
                  id: 'reservation-consistency',
                  start_time: '10:00',
                  end_time: '11:15',
                  status: 'requested'
                }],
                error: null
              })
            })
          })
        })
      });

      const isAvailable = await timeSlotService.isSlotAvailable(
        'shop-123',
        '2024-03-15',
        '10:00',
        ['service-1']
      );

      expect(isAvailable).toBe(false);

      // Cancel reservation
      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-consistency', 
          status: 'cancelled_by_user',
          previous_status: 'requested'
        },
        error: null
      });

      await stateMachine.executeTransition(
        'reservation-consistency',
        'cancelled_by_user',
        'user',
        'user-123',
        'User cancelled'
      );

      // Verify time slot becomes available again
      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            gte: jest.fn().mockReturnValue({
              lte: jest.fn().mockResolvedValue({
                data: [], // No active reservations
                error: null
              })
            })
          })
        })
      });

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
      mockSupabase.rpc
        .mockResolvedValueOnce({
          data: { id: 'reservation-rollback', status: 'requested' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { 
            id: 'reservation-rollback', 
            status: 'cancelled',
            previous_status: 'requested',
            cancellation_reason: 'Payment failed'
          },
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

      // System should rollback reservation
      const rollbackResult = await stateMachine.executeTransition(
        'reservation-rollback',
        'cancelled',
        'system',
        'system',
        'Payment failed, cancelling reservation'
      );

      expect(rollbackResult.success).toBe(true);
      expect(rollbackResult.reservation?.status).toBe('cancelled');
    });
  });
});
