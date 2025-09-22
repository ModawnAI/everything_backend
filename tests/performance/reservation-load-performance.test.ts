/**
 * Comprehensive Load and Performance Tests for Reservation System
 * 
 * Performance and load tests covering critical reservation paths:
 * - High-volume reservation creation scenarios
 * - Concurrent booking prevention performance
 * - Time slot query performance under load
 * - Database query optimization validation
 * - Memory usage and resource monitoring
 * - API response time benchmarks
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import services for performance testing
import { ReservationService } from '../../src/services/reservation.service';
import { TimeSlotService } from '../../src/services/time-slot.service';
import { ReservationStateMachine } from '../../src/services/reservation-state-machine.service';
import { PaymentService } from '../../src/services/payment.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/time-slot.service');
jest.mock('../../src/services/payment.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { timeSlotService } from '../../src/services/time-slot.service';
import { paymentService } from '../../src/services/payment.service';
import { logger } from '../../src/utils/logger';

describe('Reservation System Load and Performance Tests', () => {
  let reservationService: ReservationService;
  let timeSlotService: TimeSlotService;
  let stateMachine: ReservationStateMachine;
  let paymentService: PaymentService;
  let testUtils: ReservationTestUtils;
  let mockSupabase: any;
  let mockTimeSlotService: jest.Mocked<typeof timeSlotService>;
  let mockPaymentService: jest.Mocked<typeof paymentService>;
  let mockLogger: jest.Mocked<typeof logger>;

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    reservationCreation: 1000, // ms
    timeSlotQuery: 500, // ms
    stateTransition: 200, // ms
    paymentProcessing: 2000, // ms
    concurrentRequests: 5000, // ms for 100 concurrent requests
    memoryUsage: 100 * 1024 * 1024, // 100MB
    cpuUsage: 80 // percentage
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    reservationService = new ReservationService();
    timeSlotService = new TimeSlotService();
    stateMachine = new ReservationStateMachine();
    paymentService = new PaymentService();
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

    mockTimeSlotService = timeSlotService as jest.Mocked<typeof timeSlotService>;
    mockPaymentService = paymentService as jest.Mocked<typeof paymentService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('High-Volume Reservation Creation', () => {
    it('should handle 1000 concurrent reservation requests efficiently', async () => {
      const reservations = Array(1000).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 8)}:00`, // Distribute across 8 time slots
        specialRequests: `Load test reservation ${index}`
      }));

      // Mock successful responses
      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-success', status: 'requested' },
        error: null
      });

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      
      const results = await Promise.allSettled(
        reservations.map(request => reservationService.createReservation(request))
      );

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const executionTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Performance assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(memoryUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);
      expect(successful.length).toBeGreaterThan(800); // At least 80% success rate
      expect(failed.length).toBeLessThan(200); // Less than 20% failure rate

      console.log(`Performance Results:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB
        - Success rate: ${(successful.length / 1000 * 100).toFixed(2)}%
        - Average time per request: ${(executionTime / 1000).toFixed(2)}ms`);
    });

    it('should handle 5000 sequential reservation requests', async () => {
      const reservations = Array(5000).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 8)}:00`,
        specialRequests: `Sequential test reservation ${index}`
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-sequential', status: 'requested' },
        error: null
      });

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      const startTime = performance.now();
      
      // Process sequentially to test individual request performance
      const results = [];
      for (const request of reservations) {
        const requestStart = performance.now();
        const result = await reservationService.createReservation(request);
        const requestEnd = performance.now();
        
        results.push({
          result,
          executionTime: requestEnd - requestStart
        });
      }

      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;
      const averageRequestTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length;

      // Performance assertions
      expect(averageRequestTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(totalExecutionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(results).toHaveLength(5000);

      console.log(`Sequential Performance Results:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Average request time: ${averageRequestTime.toFixed(2)}ms
        - Requests per second: ${(5000 / (totalExecutionTime / 1000)).toFixed(2)}`);
    });

    it('should handle mixed success/failure scenarios under load', async () => {
      const reservations = Array(1000).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 3)}:00`, // Only 3 time slots to create conflicts
        specialRequests: `Mixed scenario reservation ${index}`
      }));

      // Mock mixed responses - some succeed, some fail due to conflicts
      let successCount = 0;
      mockSupabase.rpc.mockImplementation(() => {
        successCount++;
        if (successCount <= 300) {
          return Promise.resolve({
            data: { id: `reservation-${successCount}`, status: 'requested' },
            error: null
          });
        } else {
          return Promise.reject(new Error('Time slot no longer available'));
        }
      });

      mockTimeSlotService.validateSlotAvailability.mockImplementation(() => {
        const available = Math.random() > 0.3; // 70% availability
        return Promise.resolve({
          available,
          conflictReason: available ? null : 'Time slot already booked',
          conflictingReservations: available ? [] : ['existing-reservation']
        });
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        reservations.map(request => reservationService.createReservation(request))
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');

      // Performance assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(successful.length + failed.length).toBe(1000);
      expect(successful.length).toBeGreaterThan(200);
      expect(failed.length).toBeGreaterThan(200);

      console.log(`Mixed Scenario Results:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Successful: ${successful.length}
        - Failed: ${failed.length}
        - Success rate: ${(successful.length / 1000 * 100).toFixed(2)}%`);
    });
  });

  describe('Time Slot Query Performance', () => {
    it('should handle high-frequency time slot availability checks', async () => {
      const timeSlotRequests = Array(2000).fill(0).map((_, index) => ({
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
      const averageQueryTime = executionTime / timeSlotRequests.length;

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(averageQueryTime).toBeLessThan(PERFORMANCE_THRESHOLDS.timeSlotQuery);
      expect(results).toHaveLength(2000);

      console.log(`Time Slot Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average query time: ${averageQueryTime.toFixed(2)}ms
        - Queries per second: ${(2000 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle time slot generation for large date ranges', async () => {
      const dateRange = Array(30).fill(0).map((_, index) => {
        const date = new Date('2024-03-01');
        date.setDate(date.getDate() + index);
        return date.toISOString().split('T')[0];
      });

      const timeSlotRequests = dateRange.map(date => ({
        shopId: 'shop-123',
        date,
        serviceIds: ['service-1'],
        duration: { duration: 60, bufferTime: 15 }
      }));

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'shop-123',
                opening_time: '09:00',
                closing_time: '18:00',
                break_start: '12:00',
                break_end: '13:00',
                time_slot_interval: 60
              },
              error: null
            })
          })
        })
      });

      const startTime = performance.now();
      
      const results = await Promise.all(
        timeSlotRequests.map(request => 
          timeSlotService.getAvailableTimeSlots(request)
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(3000); // Should complete within 3 seconds
      expect(results).toHaveLength(30);
      expect(results.every(r => Array.isArray(r))).toBe(true);

      console.log(`Date Range Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average time per date: ${(executionTime / 30).toFixed(2)}ms
        - Total time slots generated: ${results.reduce((sum, slots) => sum + slots.length, 0)}`);
    });

    it('should optimize database queries for time slot availability', async () => {
      const shopId = 'shop-123';
      const date = '2024-03-15';

      // Mock database query performance
      let queryCount = 0;
      mockSupabase.from.mockImplementation(() => {
        queryCount++;
        return {
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
        };
      });

      const startTime = performance.now();
      
      // Check availability for multiple time slots
      const timeSlots = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];
      await Promise.all(
        timeSlots.map(time => 
          timeSlotService.isSlotAvailable(shopId, date, time, ['service-1'])
        )
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(1000); // Should complete within 1 second
      expect(queryCount).toBeLessThanOrEqual(2); // Should use efficient batching

      console.log(`Database Optimization Results:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Database queries executed: ${queryCount}
        - Average time per query: ${(executionTime / queryCount).toFixed(2)}ms`);
    });
  });

  describe('State Transition Performance', () => {
    it('should handle bulk state transitions efficiently', async () => {
      const transitions = Array(500).fill(0).map((_, index) => ({
        reservationId: `reservation-${index}`,
        newStatus: 'confirmed' as const,
        changedBy: 'shop' as const,
        changedById: 'shop-123',
        reason: `Bulk confirmation ${index}`
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
      const averageTransitionTime = executionTime / transitions.length;

      const successful = results.filter(r => r.status === 'fulfilled');

      // Performance assertions
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(averageTransitionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.stateTransition);
      expect(successful.length).toBe(500);

      console.log(`State Transition Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average transition time: ${averageTransitionTime.toFixed(2)}ms
        - Transitions per second: ${(500 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle automatic state progression efficiently', async () => {
      const pastTime = new Date();
      pastTime.setMinutes(pastTime.getMinutes() - 30);
      const pastTimeStr = pastTime.toISOString().substring(11, 16);

      // Mock 100 reservations that need automatic progression
      const overdueReservations = Array(100).fill(0).map((_, index) => ({
        id: `reservation-auto-${index}`,
        status: 'confirmed',
        reservation_date: new Date().toISOString().split('T')[0],
        start_time: pastTimeStr
      }));

      mockSupabase.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            lt: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockResolvedValue({
                  data: overdueReservations,
                  error: null
                })
              })
            })
          })
        })
      });

      mockSupabase.rpc.mockResolvedValue({
        data: { 
          id: 'reservation-auto', 
          status: 'no_show',
          updated_at: new Date().toISOString()
        },
        error: null
      });

      const startTime = performance.now();
      
      const result = await stateMachine.processAutomaticTransitions();

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(2000); // Should complete within 2 seconds
      expect(result.processedCount).toBe(100);

      console.log(`Automatic Progression Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Reservations processed: ${result.processedCount}
        - Average time per reservation: ${(executionTime / 100).toFixed(2)}ms`);
    });
  });

  describe('Payment Processing Performance', () => {
    it('should handle concurrent payment processing', async () => {
      const payments = Array(200).fill(0).map((_, index) => ({
        reservationId: `reservation-${index}`,
        amount: 50000,
        paymentMethod: 'card',
        customerInfo: {
          name: `Customer ${index}`,
          email: `customer${index}@example.com`,
          phone: '010-1234-5678'
        }
      }));

      mockPaymentService.processPayment.mockResolvedValue({
        success: true,
        transactionId: `payment-${Math.random()}`,
        amount: 50000
      });

      const startTime = performance.now();
      
      const results = await Promise.allSettled(
        payments.map(payment => paymentService.processPayment(payment))
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;
      const averagePaymentTime = executionTime / payments.length;

      const successful = results.filter(r => r.status === 'fulfilled');

      // Performance assertions
      expect(executionTime).toBeLessThan(10000); // Should complete within 10 seconds
      expect(averagePaymentTime).toBeLessThan(PERFORMANCE_THRESHOLDS.paymentProcessing);
      expect(successful.length).toBe(200);

      console.log(`Payment Processing Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average payment time: ${averagePaymentTime.toFixed(2)}ms
        - Payments per second: ${(200 / (executionTime / 1000)).toFixed(2)}`);
    });

    it('should handle payment retry scenarios efficiently', async () => {
      const paymentRequest = {
        reservationId: 'reservation-retry',
        amount: 50000,
        paymentMethod: 'card',
        retryAttempts: 3
      };

      // Mock retry scenario: first two attempts fail, third succeeds
      mockPaymentService.processPayment
        .mockRejectedValueOnce(new Error('Network timeout'))
        .mockRejectedValueOnce(new Error('Temporary service unavailable'))
        .mockResolvedValueOnce({
          success: true,
          transactionId: 'payment-retry-success',
          amount: 50000
        });

      const startTime = performance.now();
      
      const result = await paymentService.processPaymentWithRetry(paymentRequest);

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(result.success).toBe(true);
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds with retries

      console.log(`Payment Retry Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Retry attempts: 3
        - Final result: ${result.success ? 'Success' : 'Failed'}`);
    });
  });

  describe('Memory Usage and Resource Monitoring', () => {
    it('should monitor memory usage during high load', async () => {
      const initialMemory = process.memoryUsage();
      
      // Create large number of reservations to test memory usage
      const reservations = Array(5000).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 8)}:00`
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-memory', status: 'requested' },
        error: null
      });

      const peakMemory = { heapUsed: 0 };
      const memoryMonitor = setInterval(() => {
        const currentMemory = process.memoryUsage();
        if (currentMemory.heapUsed > peakMemory.heapUsed) {
          peakMemory.heapUsed = currentMemory.heapUsed;
        }
      }, 100);

      const results = await Promise.allSettled(
        reservations.map(request => reservationService.createReservation(request))
      );

      clearInterval(memoryMonitor);

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;
      const peakMemoryIncrease = peakMemory.heapUsed - initialMemory.heapUsed;

      // Memory usage assertions
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);
      expect(peakMemoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage * 1.5);

      console.log(`Memory Usage Results:
        - Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Peak memory: ${(peakMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB
        - Peak increase: ${(peakMemoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });

    it('should handle memory cleanup after operations', async () => {
      const initialMemory = process.memoryUsage();

      // Perform memory-intensive operations
      const operations = Array(1000).fill(0).map(async (_, index) => {
        const largeData = Array(1000).fill(0).map((_, i) => ({
          id: `item-${index}-${i}`,
          data: `Large data string ${i}`.repeat(100)
        }));
        
        // Simulate processing
        await new Promise(resolve => setTimeout(resolve, 1));
        
        // Explicit cleanup
        largeData.length = 0;
        return largeData;
      });

      await Promise.all(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory should not increase significantly after cleanup
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // Less than 50MB

      console.log(`Memory Cleanup Results:
        - Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`);
    });
  });

  describe('API Response Time Benchmarks', () => {
    it('should meet response time requirements for reservation creation', async () => {
      const reservationRequest = {
        shopId: 'shop-123',
        userId: 'user-benchmark',
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: '10:00'
      };

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-benchmark', status: 'requested' },
        error: null
      });

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      const responseTimes = [];
      
      // Measure response time over 100 requests
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();
        await reservationService.createReservation(reservationRequest);
        const endTime = performance.now();
        
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      const p99ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.99)];

      // Response time assertions
      expect(averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(p95ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation * 1.5);
      expect(p99ResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation * 2);

      console.log(`Response Time Benchmarks:
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - P95 response time: ${p95ResponseTime.toFixed(2)}ms
        - P99 response time: ${p99ResponseTime.toFixed(2)}ms
        - Max response time: ${Math.max(...responseTimes).toFixed(2)}ms`);
    });

    it('should maintain consistent performance under sustained load', async () => {
      const sustainedLoadRequests = Array(500).fill(0).map((_, index) => ({
        shopId: 'shop-123',
        userId: `user-sustained-${index}`,
        services: [{ serviceId: 'service-1', quantity: 1 }],
        reservationDate: '2024-03-15',
        reservationTime: `${9 + (index % 8)}:00`
      }));

      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'reservation-sustained', status: 'requested' },
        error: null
      });

      mockTimeSlotService.validateSlotAvailability.mockResolvedValue({
        available: true,
        conflictReason: null,
        conflictingReservations: []
      });

      const responseTimes = [];
      const startTime = performance.now();

      // Process requests in batches to simulate sustained load
      const batchSize = 50;
      for (let i = 0; i < sustainedLoadRequests.length; i += batchSize) {
        const batch = sustainedLoadRequests.slice(i, i + batchSize);
        
        const batchStartTime = performance.now();
        await Promise.all(
          batch.map(async (request) => {
            const requestStartTime = performance.now();
            await reservationService.createReservation(request);
            const requestEndTime = performance.now();
            responseTimes.push(requestEndTime - requestStartTime);
          })
        );
        const batchEndTime = performance.now();
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 10));
        
        console.log(`Batch ${Math.floor(i / batchSize) + 1} completed in ${(batchEndTime - batchStartTime).toFixed(2)}ms`);
      }

      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;

      // Performance consistency assertions
      const averageResponseTime = responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
      const responseTimeVariance = responseTimes.reduce((sum, time) => sum + Math.pow(time - averageResponseTime, 2), 0) / responseTimes.length;
      const responseTimeStdDev = Math.sqrt(responseTimeVariance);

      expect(averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(responseTimeStdDev).toBeLessThan(averageResponseTime * 0.5); // Standard deviation should be less than 50% of average

      console.log(`Sustained Load Performance:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Response time std dev: ${responseTimeStdDev.toFixed(2)}ms
        - Coefficient of variation: ${(responseTimeStdDev / averageResponseTime * 100).toFixed(2)}%`);
    });
  });
});
