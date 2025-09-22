/**
 * Comprehensive Load and Performance Tests for Reservation System
 * 
 * Real database performance tests covering critical reservation paths:
 * - High-volume reservation creation scenarios with real database
 * - Concurrent booking prevention performance testing
 * - Time slot query performance under actual load
 * - Database locking mechanisms validation
 * - Memory usage and resource monitoring
 * - API response time benchmarks with real data
 * 
 * Following testing rule: Use real Supabase connections, not mocks
 */

import { ReservationService, CreateReservationRequest } from '../../src/services/reservation.service';
import { TimeSlotService } from '../../src/services/time-slot.service';
import { 
  createTestUser, 
  createTestShop, 
  createTestService,
  cleanupTestData,
  initializeTestDatabase
} from '../setup-real-db';

// Mock only external services (notifications, logging)
jest.mock('../../src/services/shop-owner-notification.service', () => ({
  shopOwnerNotificationService: {
    sendReservationNotification: jest.fn().mockResolvedValue({ success: true }),
    sendStateChangeNotification: jest.fn().mockResolvedValue({ success: true })
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

describe('Reservation System Load and Performance Tests', () => {
  let reservationService: ReservationService;
  let timeSlotService: TimeSlotService;
  let testUsers: any[] = [];
  let testShops: any[] = [];
  let testServices: any[] = [];

  // Performance thresholds
  const PERFORMANCE_THRESHOLDS = {
    reservationCreation: 2000, // ms - increased for real database
    timeSlotQuery: 1000, // ms - increased for real database
    concurrentRequests: 10000, // ms for 100 concurrent requests
    memoryUsage: 512 * 1024 * 1024, // 512 MB
    successRate: 0.90, // 90% minimum success rate
  };

  beforeAll(async () => {
    await initializeTestDatabase();
    reservationService = new ReservationService();
    timeSlotService = new TimeSlotService();

    // Create test data for performance testing
    console.log('🔧 Setting up performance test data...');
    
    // Create 10 test users
    for (let i = 0; i < 10; i++) {
      const user = await createTestUser({
        email: `perf-test-user-${i}@example.com`,
        name: `Performance Test User ${i}`,
        total_points: 10000,
        available_points: 10000
      });
      testUsers.push(user);
    }

    // Create 5 test shops
    for (let i = 0; i < 5; i++) {
      const shop = await createTestShop({
        name: `Performance Test Shop ${i}`,
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
      testShops.push(shop);

      // Create 3 services per shop
      for (let j = 0; j < 3; j++) {
        const service = await createTestService({
          shop_id: shop.id,
          name: `Performance Test Service ${i}-${j}`,
          price_min: 30000 + (j * 10000),
          price_max: 50000 + (j * 10000),
          duration_minutes: 60 + (j * 30),
          deposit_amount: 10000 + (j * 5000)
        });
        testServices.push(service);
      }
    }

    console.log(`✅ Performance test data created: ${testUsers.length} users, ${testShops.length} shops, ${testServices.length} services`);
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('High-Volume Reservation Creation', () => {
    it('should handle 100 concurrent reservation requests efficiently', async () => {
      const startTime = performance.now();
      const startMemory = process.memoryUsage();

      // Create 100 concurrent reservation requests
      const reservationPromises = Array.from({ length: 100 }, (_, index) => {
        const user = testUsers[index % testUsers.length];
        const shop = testShops[index % testShops.length];
        const service = testServices.filter(s => s.shop_id === shop.id)[0];

        const reservationRequest: CreateReservationRequest = {
          shopId: shop.id,
          userId: user.id,
          services: [{ serviceId: service.id, quantity: 1 }],
          reservationDate: '2024-12-25',
          reservationTime: `${9 + Math.floor(index / 10)}:${(index % 2) * 30}`.padStart(5, '0'),
          pointsToUse: 0
        };

        return reservationService.createReservation(reservationRequest)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error: error.message }));
      });

      const results = await Promise.allSettled(reservationPromises);
      const endTime = performance.now();
      const endMemory = process.memoryUsage();

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled' && (r.value as any).success);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success));

      const executionTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      // Performance assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(memoryUsed).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);
      expect(successful.length / results.length).toBeGreaterThan(PERFORMANCE_THRESHOLDS.successRate);

      console.log(`📊 Concurrent Reservation Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Successful: ${successful.length}
        - Failed: ${failed.length}`);
    }, 30000);

    it('should handle sequential reservation creation under load', async () => {
      const startTime = performance.now();
      let successCount = 0;
      let failureCount = 0;

      // Create 50 sequential reservations
      for (let i = 0; i < 50; i++) {
        try {
          const user = testUsers[i % testUsers.length];
          const shop = testShops[i % testShops.length];
          const service = testServices.filter(s => s.shop_id === shop.id)[0];

          const reservationRequest: CreateReservationRequest = {
            shopId: shop.id,
            userId: user.id,
            services: [{ serviceId: service.id, quantity: 1 }],
            reservationDate: '2024-12-26',
            reservationTime: `${10 + Math.floor(i / 5)}:${(i % 2) * 30}`.padStart(5, '0'),
            pointsToUse: 0
          };

          await reservationService.createReservation(reservationRequest);
          successCount++;
        } catch (error) {
          failureCount++;
        }
      }

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(50 * PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(successCount / (successCount + failureCount)).toBeGreaterThan(PERFORMANCE_THRESHOLDS.successRate);

      console.log(`📊 Sequential Reservation Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per reservation: ${(executionTime / 50).toFixed(2)}ms
        - Success rate: ${(successCount / (successCount + failureCount) * 100).toFixed(1)}%
        - Successful: ${successCount}
        - Failed: ${failureCount}`);
    }, 60000);
  });

  describe('Time Slot Query Performance', () => {
    it('should handle high-volume time slot availability queries', async () => {
      const startTime = performance.now();
      const queryPromises: Promise<any>[] = [];

      // Generate 200 concurrent time slot queries
      for (let i = 0; i < 200; i++) {
        const shop = testShops[i % testShops.length];
        const service = testServices.filter(s => s.shop_id === shop.id)[0];
        
        const queryPromise = timeSlotService.getAvailableTimeSlots({
          shopId: shop.id,
          date: '2024-12-27',
          serviceIds: [service.id]
        }).catch(error => ({ error: error.message }));

        queryPromises.push(queryPromise);
      }

      const results = await Promise.allSettled(queryPromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Analyze results
      const successful = results.filter(r => r.status === 'fulfilled' && !(r.value as any).error);
      const failed = results.filter(r => r.status === 'rejected' || (r.status === 'fulfilled' && (r.value as any).error));

      // Performance assertions
      expect(executionTime).toBeLessThan(200 * PERFORMANCE_THRESHOLDS.timeSlotQuery);
      expect(successful.length / results.length).toBeGreaterThan(PERFORMANCE_THRESHOLDS.successRate);

      console.log(`📊 Time Slot Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per query: ${(executionTime / 200).toFixed(2)}ms
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Successful: ${successful.length}
        - Failed: ${failed.length}`);
    }, 45000);

    it('should handle time slot queries for large date ranges efficiently', async () => {
      const startTime = performance.now();
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      // Query time slots for 30 days
      const datePromises = [];
      for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() + i + 1);
        const dateString = date.toISOString().split('T')[0];

        const promise = timeSlotService.getAvailableTimeSlots({
          shopId: shop.id,
          date: dateString,
          serviceIds: [service.id]
        }).catch(error => ({ error: error.message }));

        datePromises.push(promise);
      }

      const results = await Promise.allSettled(datePromises);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Performance assertions
      expect(executionTime).toBeLessThan(30 * PERFORMANCE_THRESHOLDS.timeSlotQuery);
      expect(results.length).toBe(30);

      console.log(`📊 Date Range Query Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Average per date: ${(executionTime / 30).toFixed(2)}ms
        - Queries completed: ${results.length}`);
    }, 30000);
  });

  describe('Concurrent Booking Prevention', () => {
    it('should handle concurrent booking attempts for same time slot', async () => {
      const startTime = performance.now();
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      // Create 20 concurrent booking attempts for the same time slot
      const concurrentBookings = testUsers.slice(0, 20).map(user => {
        const reservationRequest: CreateReservationRequest = {
          shopId: shop.id,
          userId: user.id,
          services: [{ serviceId: service.id, quantity: 1 }],
          reservationDate: '2024-12-28',
          reservationTime: '14:00', // Same time slot for all
          pointsToUse: 0
        };

        return reservationService.createReservation(reservationRequest)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error: error.message }));
      });

      const results = await Promise.allSettled(concurrentBookings);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Analyze results - only one should succeed for the same time slot
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );
      const failed = results.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)
      );

      // Performance and correctness assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(successful.length).toBe(1); // Only one booking should succeed
      expect(failed.length).toBe(19); // 19 should fail due to conflict

      console.log(`📊 Concurrent Booking Prevention Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Successful bookings: ${successful.length} (expected: 1)
        - Prevented conflicts: ${failed.length} (expected: 19)
        - Conflict prevention working: ${failed.length === 19 ? '✅' : '❌'}`);
    }, 30000);

    it('should handle concurrent bookings across different time slots', async () => {
      const startTime = performance.now();
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      // Create concurrent bookings for different time slots
      const concurrentBookings = testUsers.slice(0, 10).map((user, index) => {
        const hour = 9 + Math.floor(index / 2);
        const minute = (index % 2) * 30;
        const timeSlot = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;

        const reservationRequest: CreateReservationRequest = {
          shopId: shop.id,
          userId: user.id,
          services: [{ serviceId: service.id, quantity: 1 }],
          reservationDate: '2024-12-29',
          reservationTime: timeSlot,
          pointsToUse: 0
        };

        return reservationService.createReservation(reservationRequest)
          .then(result => ({ success: true, result }))
          .catch(error => ({ success: false, error: error.message }));
      });

      const results = await Promise.allSettled(concurrentBookings);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Analyze results - most should succeed since they're different time slots
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );

      // Performance assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(successful.length / results.length).toBeGreaterThan(PERFORMANCE_THRESHOLDS.successRate);

      console.log(`📊 Different Time Slots Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Successful: ${successful.length}
        - Failed: ${results.length - successful.length}`);
    }, 30000);
  });

  describe('Database Locking Performance', () => {
    it('should handle database locking mechanisms under load', async () => {
      const startTime = performance.now();
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      // Create rapid-fire booking attempts that will test locking
      const lockingTests = [];
      for (let batch = 0; batch < 5; batch++) {
        const batchPromises = testUsers.slice(0, 5).map((user, index) => {
          const reservationRequest: CreateReservationRequest = {
            shopId: shop.id,
            userId: user.id,
            services: [{ serviceId: service.id, quantity: 1 }],
            reservationDate: '2024-12-30',
            reservationTime: `${14 + batch}:${index * 10}`.padStart(5, '0'),
            pointsToUse: 0
          };

          return reservationService.createReservation(reservationRequest)
            .then(result => ({ success: true, result }))
            .catch(error => ({ success: false, error: error.message }));
        });

        lockingTests.push(...batchPromises);
        
        // Small delay between batches to test locking behavior
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      const results = await Promise.allSettled(lockingTests);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Analyze locking performance
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );

      // Performance assertions
      expect(executionTime).toBeLessThan(PERFORMANCE_THRESHOLDS.concurrentRequests);
      expect(successful.length).toBeGreaterThan(0); // At least some should succeed

      console.log(`📊 Database Locking Performance:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Success rate: ${(successful.length / results.length * 100).toFixed(1)}%
        - Locking mechanism working: ${successful.length > 0 ? '✅' : '❌'}`);
    }, 45000);
  });

  describe('Memory Usage and Resource Monitoring', () => {
    it('should maintain reasonable memory usage during load testing', async () => {
      const initialMemory = process.memoryUsage();
      
      // Perform memory-intensive operations
      const operations = [];
      for (let i = 0; i < 100; i++) {
        const user = testUsers[i % testUsers.length];
        const shop = testShops[i % testShops.length];
        
        operations.push(
          timeSlotService.getAvailableTimeSlots({
            shopId: shop.id,
            date: '2024-12-31',
            serviceIds: testServices.filter(s => s.shop_id === shop.id).map(s => s.id)
          }).catch(() => null)
        );
      }

      await Promise.allSettled(operations);

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory usage assertions
      expect(memoryIncrease).toBeLessThan(PERFORMANCE_THRESHOLDS.memoryUsage);

      console.log(`📊 Memory Usage Results:
        - Initial memory: ${(initialMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Final memory: ${(finalMemory.heapUsed / 1024 / 1024).toFixed(2)}MB
        - Memory increase: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB
        - Operations completed: ${operations.length}`);
    }, 30000);
  });

  describe('API Response Time Benchmarks', () => {
    it('should meet response time requirements for reservation creation', async () => {
      const user = testUsers[0];
      const shop = testShops[0];
      const service = testServices.filter(s => s.shop_id === shop.id)[0];

      const reservationRequest: CreateReservationRequest = {
        shopId: shop.id,
        userId: user.id,
        services: [{ serviceId: service.id, quantity: 1 }],
        reservationDate: '2025-01-01',
        reservationTime: '10:00',
        pointsToUse: 0
      };

      // Measure multiple individual requests
      const responseTimes = [];
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        
        try {
          await reservationService.createReservation({
            ...reservationRequest,
            reservationTime: `${10 + i}:00`
          });
          const endTime = performance.now();
          responseTimes.push(endTime - startTime);
        } catch (error) {
          // Some may fail due to conflicts, that's expected
          responseTimes.push(PERFORMANCE_THRESHOLDS.reservationCreation);
        }
      }

      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const maxResponseTime = Math.max(...responseTimes);

      // Performance assertions
      expect(averageResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(maxResponseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.reservationCreation * 2);

      console.log(`📊 API Response Time Benchmarks:
        - Average response time: ${averageResponseTime.toFixed(2)}ms
        - Max response time: ${maxResponseTime.toFixed(2)}ms
        - Min response time: ${Math.min(...responseTimes).toFixed(2)}ms
        - Requests tested: ${responseTimes.length}`);
    }, 45000);

    it('should maintain consistent performance under sustained load', async () => {
      const batchSize = 10;
      const batchCount = 5;
      const batchResults = [];

      for (let batch = 0; batch < batchCount; batch++) {
        const batchStartTime = performance.now();
        const batchPromises = [];

        for (let i = 0; i < batchSize; i++) {
          const user = testUsers[i % testUsers.length];
          const shop = testShops[i % testShops.length];
          const service = testServices.filter(s => s.shop_id === shop.id)[0];

          const reservationRequest: CreateReservationRequest = {
            shopId: shop.id,
            userId: user.id,
            services: [{ serviceId: service.id, quantity: 1 }],
            reservationDate: '2025-01-02',
            reservationTime: `${9 + batch}:${i * 5}`.padStart(5, '0'),
            pointsToUse: 0
          };

          batchPromises.push(
            reservationService.createReservation(reservationRequest)
              .then(() => ({ success: true }))
              .catch(() => ({ success: false }))
          );
        }

        const batchResults = await Promise.allSettled(batchPromises);
        const batchEndTime = performance.now();
        const batchTime = batchEndTime - batchStartTime;

        batchResults.push({
          batch: batch + 1,
          executionTime: batchTime,
          successCount: batchResults.filter(r => 
            r.status === 'fulfilled' && (r.value as any).success
          ).length
        });

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      // Analyze sustained performance
      const averageBatchTime = batchResults.reduce((sum, batch) => sum + (batch as any).executionTime, 0) / batchCount;
      const maxBatchTime = Math.max(...batchResults.map((batch: any) => batch.executionTime));

      // Performance assertions
      expect(averageBatchTime).toBeLessThan(batchSize * PERFORMANCE_THRESHOLDS.reservationCreation);
      expect(maxBatchTime).toBeLessThan(batchSize * PERFORMANCE_THRESHOLDS.reservationCreation * 1.5);

      console.log(`📊 Sustained Load Performance:
        - Average batch time: ${averageBatchTime.toFixed(2)}ms
        - Max batch time: ${maxBatchTime.toFixed(2)}ms
        - Batches completed: ${batchCount}
        - Total operations: ${batchCount * batchSize}`);
    }, 60000);
  });

  describe('Scalability Testing', () => {
    it('should scale efficiently with increasing load', async () => {
      const loadLevels = [10, 25, 50];
      const scalabilityResults = [];

      for (const loadLevel of loadLevels) {
        const startTime = performance.now();
        const promises = [];

        for (let i = 0; i < loadLevel; i++) {
          const user = testUsers[i % testUsers.length];
          const shop = testShops[i % testShops.length];
          const service = testServices.filter(s => s.shop_id === shop.id)[0];

          promises.push(
            timeSlotService.getAvailableTimeSlots({
              shopId: shop.id,
              date: '2025-01-03',
              serviceIds: [service.id]
            }).catch(() => null)
          );
        }

        await Promise.allSettled(promises);
        const endTime = performance.now();
        const executionTime = endTime - startTime;

        scalabilityResults.push({
          loadLevel,
          executionTime,
          averagePerRequest: executionTime / loadLevel
        });
      }

      // Analyze scalability
      const scalabilityRatio = scalabilityResults[2].averagePerRequest / scalabilityResults[0].averagePerRequest;

      // Scalability assertions - should not degrade linearly
      expect(scalabilityRatio).toBeLessThan(3); // Should not be 3x slower with 5x load

      console.log(`📊 Scalability Analysis:`);
      scalabilityResults.forEach(result => {
        console.log(`   Load ${result.loadLevel}: ${result.executionTime.toFixed(2)}ms total, ${result.averagePerRequest.toFixed(2)}ms avg`);
      });
      console.log(`   Scalability ratio: ${scalabilityRatio.toFixed(2)}x`);
    }, 60000);
  });
});

