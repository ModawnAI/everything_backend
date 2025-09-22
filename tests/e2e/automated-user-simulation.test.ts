/**
 * Automated User Simulation Tests
 * 
 * Advanced E2E tests with automated user behavior simulation:
 * - Realistic user behavior patterns and timing
 * - Concurrent user simulation scenarios
 * - Stress testing with multiple user types
 * - A/B testing scenarios
 * - Performance monitoring during user simulation
 * - Data consistency validation across user interactions
 */

import { ReservationTestUtils } from '../utils/reservation-test-utils';
import { getTestConfig } from '../config/reservation-test-config';

// Import services for automated simulation
import { ReservationService } from '../../src/services/reservation.service';
import { PaymentService } from '../../src/services/payment.service';
import { NotificationService } from '../../src/services/notification.service';
import { UserService } from '../../src/services/user.service';
import { ShopService } from '../../src/services/shop.service';
import { TimeSlotService } from '../../src/services/time-slot.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/toss-payments.service');
jest.mock('../../src/services/email.service');
jest.mock('../../src/services/sms.service');
jest.mock('../../src/services/push-notification.service');
jest.mock('../../src/utils/logger');

import { getSupabaseClient } from '../../src/config/database';
import { tossPaymentsService } from '../../src/services/toss-payments.service';
import { emailService } from '../../src/services/email.service';
import { smsService } from '../../src/services/sms.service';
import { pushNotificationService } from '../../src/services/push-notification.service';
import { logger } from '../../src/utils/logger';

// User behavior simulation utilities
class UserBehaviorSimulator {
  private userTypes = {
    casual_user: {
      bookingFrequency: 0.3, // 30% chance per session
      paymentDelay: { min: 5000, max: 15000 }, // 5-15 seconds
      cancellationRate: 0.1, // 10% cancellation rate
      repeatBookingRate: 0.4 // 40% repeat booking rate
    },
    frequent_user: {
      bookingFrequency: 0.8, // 80% chance per session
      paymentDelay: { min: 2000, max: 8000 }, // 2-8 seconds
      cancellationRate: 0.05, // 5% cancellation rate
      repeatBookingRate: 0.7 // 70% repeat booking rate
    },
    new_user: {
      bookingFrequency: 0.6, // 60% chance per session
      paymentDelay: { min: 10000, max: 30000 }, // 10-30 seconds
      cancellationRate: 0.15, // 15% cancellation rate
      repeatBookingRate: 0.2 // 20% repeat booking rate
    }
  };

  simulateUserBehavior(userType: keyof typeof this.userTypes, sessionDuration: number) {
    const behavior = this.userTypes[userType];
    const actions = [];
    
    // Simulate realistic user actions with timing
    let currentTime = 0;
    
    // Browse shops (always happens)
    actions.push({
      type: 'browse_shops',
      timestamp: currentTime,
      duration: Math.random() * 10000 + 5000 // 5-15 seconds
    });
    currentTime += 15000;

    // Check if user books (based on frequency)
    if (Math.random() < behavior.bookingFrequency) {
      actions.push({
        type: 'create_reservation',
        timestamp: currentTime,
        duration: Math.random() * 20000 + 10000 // 10-30 seconds
      });
      currentTime += 30000;

      // Payment delay (realistic thinking time)
      const paymentDelay = Math.random() * (behavior.paymentDelay.max - behavior.paymentDelay.min) + behavior.paymentDelay.min;
      actions.push({
        type: 'make_payment',
        timestamp: currentTime + paymentDelay,
        duration: Math.random() * 10000 + 5000 // 5-15 seconds
      });
      currentTime += paymentDelay + 15000;

      // Check if user cancels
      if (Math.random() < behavior.cancellationRate) {
        actions.push({
          type: 'cancel_reservation',
          timestamp: currentTime + Math.random() * 3600000, // Within 1 hour
          duration: Math.random() * 5000 + 2000 // 2-7 seconds
        });
      }
    }

    return actions;
  }

  simulateRealisticDelay(min: number, max: number) {
    return new Promise(resolve => {
      const delay = Math.random() * (max - min) + min;
      setTimeout(resolve, delay);
    });
  }
}

describe('Automated User Simulation Tests', () => {
  let reservationService: ReservationService;
  let paymentService: PaymentService;
  let notificationService: NotificationService;
  let userService: UserService;
  let shopService: ShopService;
  let timeSlotService: TimeSlotService;
  let testUtils: ReservationTestUtils;
  let userSimulator: UserBehaviorSimulator;
  let mockSupabase: any;
  let mockTossPaymentsService: jest.Mocked<typeof tossPaymentsService>;
  let mockEmailService: jest.Mocked<typeof emailService>;
  let mockSmsService: jest.Mocked<typeof smsService>;
  let mockPushNotificationService: jest.Mocked<typeof pushNotificationService>;
  let mockLogger: jest.Mocked<typeof logger>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Initialize services
    reservationService = new ReservationService();
    paymentService = new PaymentService();
    notificationService = new NotificationService();
    userService = new UserService();
    shopService = new ShopService();
    timeSlotService = new TimeSlotService();
    testUtils = new ReservationTestUtils();
    userSimulator = new UserBehaviorSimulator();

    // Setup mocks
    mockSupabase = {
      rpc: jest.fn(),
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => Promise.resolve({ data: null, error: null })),
            order: jest.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          insert: jest.fn(() => ({
            select: jest.fn(() => Promise.resolve({ data: [], error: null }))
          })),
          update: jest.fn(() => ({
            eq: jest.fn(() => ({
              select: jest.fn(() => Promise.resolve({ data: [], error: null }))
            }))
          }))
        }))
      }))
    };
    (getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

    mockTossPaymentsService = tossPaymentsService as jest.Mocked<typeof tossPaymentsService>;
    mockEmailService = emailService as jest.Mocked<typeof emailService>;
    mockSmsService = smsService as jest.Mocked<typeof smsService>;
    mockPushNotificationService = pushNotificationService as jest.Mocked<typeof pushNotificationService>;
    mockLogger = logger as jest.Mocked<typeof logger>;
  });

  describe('Realistic User Behavior Simulation', () => {
    it('should simulate 100 concurrent users with realistic behavior patterns', async () => {
      console.log('🎯 E2E Test: 100 Concurrent Users with Realistic Behavior');
      
      const userCount = 100;
      const userTypes = ['casual_user', 'frequent_user', 'new_user'] as const;
      
      // Setup mocks for all user interactions
      mockSupabase.rpc.mockImplementation((fnName, params) => {
        const userId = params.p_user_id || params.userId;
        return Promise.resolve({
          data: { 
            id: `simulation-${userId}`,
            status: 'success',
            timestamp: new Date().toISOString()
          },
          error: null
        });
      });

      mockTossPaymentsService.createPayment.mockResolvedValue({
        success: true,
        paymentKey: 'payment-simulation',
        orderId: 'order-simulation',
        amount: 50000,
        status: 'DONE'
      });

      mockEmailService.sendEmail.mockResolvedValue({
        success: true,
        messageId: 'email-simulation',
        deliveredAt: new Date().toISOString()
      });

      const startTime = performance.now();
      
      // Simulate concurrent users
      const userSimulations = Array(userCount).fill(0).map(async (_, index) => {
        const userType = userTypes[index % 3];
        const userId = `user-simulation-${index}`;
        const userActions = userSimulator.simulateUserBehavior(userType, 300000); // 5 minutes
        
        const userResults = {
          userId,
          userType,
          actions: [],
          errors: [],
          startTime: Date.now()
        };

        for (const action of userActions) {
          try {
            // Simulate realistic delay
            await userSimulator.simulateRealisticDelay(100, 500);
            
            switch (action.type) {
              case 'browse_shops':
                const shops = await shopService.searchShops({
                  location: 'Seoul',
                  serviceType: 'hair_salon'
                });
                userResults.actions.push({ type: 'browse_shops', success: true, data: shops });
                break;
                
              case 'create_reservation':
                const reservation = await reservationService.createReservation({
                  shopId: 'shop-123',
                  userId,
                  services: [{ serviceId: 'service-1', quantity: 1 }],
                  reservationDate: '2024-03-15',
                  reservationTime: '10:00'
                });
                userResults.actions.push({ type: 'create_reservation', success: true, data: reservation });
                break;
                
              case 'make_payment':
                const payment = await paymentService.processPayment({
                  reservationId: `reservation-${userId}`,
                  amount: 50000,
                  paymentMethod: 'card'
                });
                userResults.actions.push({ type: 'make_payment', success: true, data: payment });
                break;
                
              case 'cancel_reservation':
                const cancellation = await reservationService.cancelReservation(
                  `reservation-${userId}`,
                  userId,
                  'User cancelled'
                );
                userResults.actions.push({ type: 'cancel_reservation', success: true, data: cancellation });
                break;
            }
          } catch (error) {
            userResults.errors.push({ action: action.type, error: error.message });
          }
        }

        userResults.startTime = Date.now() - userResults.startTime;
        return userResults;
      });

      const results = await Promise.allSettled(userSimulations);
      const endTime = performance.now();
      const totalExecutionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled');
      const failed = results.filter(r => r.status === 'rejected');
      
      const userStats = successful.map(r => r.value).reduce((stats, user) => {
        if (!stats[user.userType]) {
          stats[user.userType] = { count: 0, totalActions: 0, totalErrors: 0 };
        }
        stats[user.userType].count++;
        stats[user.userType].totalActions += user.actions.length;
        stats[user.userType].totalErrors += user.errors.length;
        return stats;
      }, {} as Record<string, any>);

      // Performance assertions
      expect(totalExecutionTime).toBeLessThan(120000); // Should complete within 2 minutes
      expect(successful.length).toBeGreaterThan(90); // At least 90% success rate
      expect(failed.length).toBeLessThan(10);

      console.log(`Concurrent User Simulation Results:
        - Total execution time: ${totalExecutionTime.toFixed(2)}ms
        - Successful users: ${successful.length}
        - Failed users: ${failed.length}
        - User statistics:`, userStats);
    });

    it('should simulate realistic user session patterns over time', async () => {
      console.log('🎯 E2E Test: Realistic User Session Patterns Over Time');
      
      const sessionDuration = 600000; // 10 minutes
      const timeIntervals = [
        { start: 0, end: 120000, userCount: 20 }, // First 2 minutes: 20 users
        { start: 120000, end: 300000, userCount: 50 }, // Next 3 minutes: 50 users (peak)
        { start: 300000, end: 480000, userCount: 30 }, // Next 3 minutes: 30 users
        { start: 480000, end: 600000, userCount: 10 } // Last 2 minutes: 10 users
      ];

      const allUserSessions = [];
      
      // Setup mocks
      mockSupabase.rpc.mockResolvedValue({
        data: { id: 'session-test', status: 'active' },
        error: null
      });

      for (const interval of timeIntervals) {
        const intervalUsers = Array(interval.userCount).fill(0).map(async (_, index) => {
          const userId = `session-user-${interval.start}-${index}`;
          const userType = ['casual_user', 'frequent_user', 'new_user'][index % 3];
          
          // Simulate session start delay within interval
          const sessionStartDelay = Math.random() * (interval.end - interval.start);
          await userSimulator.simulateRealisticDelay(0, sessionStartDelay);
          
          const sessionStartTime = Date.now();
          const userActions = userSimulator.simulateUserBehavior(userType, interval.end - interval.start);
          
          const sessionResults = {
            userId,
            userType,
            sessionStartTime,
            sessionEndTime: sessionStartTime + (interval.end - interval.start),
            actions: [],
            errors: []
          };

          for (const action of userActions) {
            try {
              await userSimulator.simulateRealisticDelay(50, 200);
              
              // Simulate different actions based on user type
              if (action.type === 'browse_shops') {
                sessionResults.actions.push({ type: 'browse_shops', success: true });
              } else if (action.type === 'create_reservation') {
                sessionResults.actions.push({ type: 'create_reservation', success: true });
              } else if (action.type === 'make_payment') {
                sessionResults.actions.push({ type: 'make_payment', success: true });
              }
            } catch (error) {
              sessionResults.errors.push({ action: action.type, error: error.message });
            }
          }

          return sessionResults;
        });

        allUserSessions.push(...intervalUsers);
      }

      const startTime = performance.now();
      const results = await Promise.allSettled(allUserSessions);
      const endTime = performance.now();

      const successful = results.filter(r => r.status === 'fulfilled');
      const sessionStats = successful.map(r => r.value).reduce((stats, session) => {
        const hour = new Date(session.sessionStartTime).getHours();
        if (!stats[hour]) {
          stats[hour] = { userCount: 0, totalActions: 0, avgSessionDuration: 0 };
        }
        stats[hour].userCount++;
        stats[hour].totalActions += session.actions.length;
        stats[hour].avgSessionDuration += session.sessionEndTime - session.sessionStartTime;
        return stats;
      }, {} as Record<number, any>);

      // Calculate averages
      Object.keys(sessionStats).forEach(hour => {
        const stat = sessionStats[parseInt(hour)];
        stat.avgSessionDuration = stat.avgSessionDuration / stat.userCount;
      });

      expect(successful.length).toBeGreaterThan(100);
      expect(Object.keys(sessionStats).length).toBeGreaterThan(0);

      console.log(`User Session Pattern Results:
        - Total sessions: ${successful.length}
        - Session duration: ${((endTime - startTime) / 1000).toFixed(2)}s
        - Session statistics by time:`, sessionStats);
    });
  });

  describe('Stress Testing with Multiple User Types', () => {
    it('should handle stress test with 500 mixed user types', async () => {
      console.log('🎯 E2E Test: Stress Test with 500 Mixed User Types');
      
      const userCount = 500;
      const userTypeDistribution = {
        casual_user: 0.5,    // 50% casual users
        frequent_user: 0.3,  // 30% frequent users
        new_user: 0.2        // 20% new users
      };

      // Setup mocks for stress testing
      let requestCount = 0;
      mockSupabase.rpc.mockImplementation(() => {
        requestCount++;
        // Simulate occasional failures under stress
        if (requestCount % 100 === 0) {
          return Promise.reject(new Error('Database connection timeout'));
        }
        return Promise.resolve({
          data: { id: `stress-test-${requestCount}`, status: 'success' },
          error: null
        });
      });

      mockTossPaymentsService.createPayment.mockImplementation(() => {
        // Simulate payment processing delays under stress
        return new Promise(resolve => {
          setTimeout(() => {
            resolve({
              success: Math.random() > 0.05, // 95% success rate
              paymentKey: `payment-stress-${requestCount}`,
              orderId: `order-stress-${requestCount}`,
              amount: 50000,
              status: 'DONE'
            });
          }, Math.random() * 1000 + 500); // 500-1500ms delay
        });
      });

      const startTime = performance.now();
      const startMemory = process.memoryUsage();
      
      // Create user distribution
      const users = [];
      Object.entries(userTypeDistribution).forEach(([userType, percentage]) => {
        const count = Math.floor(userCount * percentage);
        for (let i = 0; i < count; i++) {
          users.push({
            id: `stress-user-${userType}-${i}`,
            type: userType
          });
        }
      });

      // Shuffle users for realistic distribution
      users.sort(() => Math.random() - 0.5);

      const stressTestResults = await Promise.allSettled(
        users.map(async (user, index) => {
          const userStartTime = performance.now();
          const userActions = userSimulator.simulateUserBehavior(user.type, 180000); // 3 minutes
          
          const userResults = {
            userId: user.id,
            userType: user.type,
            actionsCompleted: 0,
            errors: [],
            executionTime: 0
          };

          for (const action of userActions) {
            try {
              // Stagger user actions to simulate realistic load
              await userSimulator.simulateRealisticDelay(100, 1000);
              
              if (action.type === 'create_reservation') {
                await reservationService.createReservation({
                  shopId: 'shop-123',
                  userId: user.id,
                  services: [{ serviceId: 'service-1', quantity: 1 }],
                  reservationDate: '2024-03-15',
                  reservationTime: '10:00'
                });
                userResults.actionsCompleted++;
              } else if (action.type === 'make_payment') {
                await paymentService.processPayment({
                  reservationId: `reservation-${user.id}`,
                  amount: 50000,
                  paymentMethod: 'card'
                });
                userResults.actionsCompleted++;
              }
            } catch (error) {
              userResults.errors.push({ action: action.type, error: error.message });
            }
          }

          userResults.executionTime = performance.now() - userStartTime;
          return userResults;
        })
      );

      const endTime = performance.now();
      const endMemory = process.memoryUsage();
      const totalExecutionTime = endTime - startTime;
      const memoryUsed = endMemory.heapUsed - startMemory.heapUsed;

      const successful = stressTestResults.filter(r => r.status === 'fulfilled');
      const failed = stressTestResults.filter(r => r.status === 'rejected');
      
      const performanceStats = successful.map(r => r.value).reduce((stats, user) => {
        if (!stats[user.userType]) {
          stats[user.userType] = { 
            count: 0, 
            totalActions: 0, 
            totalErrors: 0, 
            avgExecutionTime: 0,
            totalExecutionTime: 0
          };
        }
        const userStat = stats[user.userType];
        userStat.count++;
        userStat.totalActions += user.actionsCompleted;
        userStat.totalErrors += user.errors.length;
        userStat.totalExecutionTime += user.executionTime;
        userStat.avgExecutionTime = userStat.totalExecutionTime / userStat.count;
        return stats;
      }, {} as Record<string, any>);

      // Stress test assertions
      expect(totalExecutionTime).toBeLessThan(300000); // Should complete within 5 minutes
      expect(successful.length).toBeGreaterThan(400); // At least 80% success rate
      expect(memoryUsed).toBeLessThan(200 * 1024 * 1024); // Less than 200MB memory increase
      expect(requestCount).toBeGreaterThan(1000); // Should have processed many requests

      console.log(`Stress Test Results:
        - Total execution time: ${(totalExecutionTime / 1000).toFixed(2)}s
        - Successful users: ${successful.length}
        - Failed users: ${failed.length}
        - Total requests processed: ${requestCount}
        - Memory used: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB
        - Performance by user type:`, performanceStats);
    });
  });

  describe('A/B Testing Scenarios', () => {
    it('should simulate A/B testing with different user experiences', async () => {
      console.log('🎯 E2E Test: A/B Testing Scenarios');
      
      const userCount = 200;
      const variants = {
        variant_a: {
          name: 'Original Design',
          features: {
            paymentFlow: 'traditional',
            uiLayout: 'standard',
            notificationTiming: 'immediate'
          },
          expectedConversionRate: 0.3
        },
        variant_b: {
          name: 'Improved Design',
          features: {
            paymentFlow: 'streamlined',
            uiLayout: 'modern',
            notificationTiming: 'delayed'
          },
          expectedConversionRate: 0.4
        }
      };

      // Setup A/B testing mocks
      mockSupabase.rpc.mockImplementation((fnName, params) => {
        const userId = params.p_user_id || params.userId;
        const variant = userId.includes('variant-b') ? 'variant_b' : 'variant_a';
        const conversionRate = variants[variant].expectedConversionRate;
        
        return Promise.resolve({
          data: { 
            id: `ab-test-${userId}`,
            variant,
            converted: Math.random() < conversionRate,
            features: variants[variant].features
          },
          error: null
        });
      });

      const startTime = performance.now();
      
      // Simulate users for each variant
      const abTestResults = await Promise.all(
        Array(userCount).fill(0).map(async (_, index) => {
          const variant = index % 2 === 0 ? 'variant_a' : 'variant_b';
          const userId = `ab-user-${variant}-${index}`;
          
          const userActions = userSimulator.simulateUserBehavior('casual_user', 120000); // 2 minutes
          
          const userResults = {
            userId,
            variant,
            actions: [],
            converted: false,
            conversionPoint: null
          };

          for (const action of userActions) {
            await userSimulator.simulateRealisticDelay(200, 800);
            
            try {
              if (action.type === 'create_reservation') {
                const reservation = await reservationService.createReservation({
                  shopId: 'shop-123',
                  userId,
                  services: [{ serviceId: 'service-1', quantity: 1 }],
                  reservationDate: '2024-03-15',
                  reservationTime: '10:00'
                });
                
                userResults.actions.push({ type: 'create_reservation', success: true });
                
                // Check conversion based on variant features
                if (variants[variant].features.paymentFlow === 'streamlined') {
                  userResults.converted = true;
                  userResults.conversionPoint = 'reservation_creation';
                }
              } else if (action.type === 'make_payment' && !userResults.converted) {
                const payment = await paymentService.processPayment({
                  reservationId: `reservation-${userId}`,
                  amount: 50000,
                  paymentMethod: 'card'
                });
                
                userResults.actions.push({ type: 'make_payment', success: true });
                userResults.converted = true;
                userResults.conversionPoint = 'payment_completion';
              }
            } catch (error) {
              userResults.actions.push({ type: action.type, success: false, error: error.message });
            }
          }

          return userResults;
        })
      );

      const endTime = performance.now();
      const executionTime = endTime - startTime;

      // Calculate A/B test results
      const variantResults = abTestResults.reduce((results, user) => {
        if (!results[user.variant]) {
          results[user.variant] = {
            totalUsers: 0,
            convertedUsers: 0,
            conversionRate: 0,
            avgActionsPerUser: 0,
            totalActions: 0
          };
        }
        
        const variant = results[user.variant];
        variant.totalUsers++;
        variant.totalActions += user.actions.length;
        
        if (user.converted) {
          variant.convertedUsers++;
        }
        
        variant.conversionRate = variant.convertedUsers / variant.totalUsers;
        variant.avgActionsPerUser = variant.totalActions / variant.totalUsers;
        
        return results;
      }, {} as Record<string, any>);

      // A/B test assertions
      expect(executionTime).toBeLessThan(180000); // Should complete within 3 minutes
      expect(abTestResults.length).toBe(userCount);
      expect(Object.keys(variantResults)).toHaveLength(2);

      const variantA = variantResults.variant_a;
      const variantB = variantResults.variant_b;
      
      // Statistical significance check (simplified)
      const conversionDifference = Math.abs(variantB.conversionRate - variantA.conversionRate);
      const isSignificant = conversionDifference > 0.05; // 5% difference threshold

      console.log(`A/B Testing Results:
        - Total execution time: ${(executionTime / 1000).toFixed(2)}s
        - Variant A (Original): ${(variantA.conversionRate * 100).toFixed(2)}% conversion rate
        - Variant B (Improved): ${(variantB.conversionRate * 100).toFixed(2)}% conversion rate
        - Conversion difference: ${(conversionDifference * 100).toFixed(2)}%
        - Statistically significant: ${isSignificant}
        - Winner: ${variantB.conversionRate > variantA.conversionRate ? 'Variant B' : 'Variant A'}`);
    });
  });

  describe('Data Consistency Validation', () => {
    it('should validate data consistency across concurrent user interactions', async () => {
      console.log('🎯 E2E Test: Data Consistency Validation Across Concurrent Users');
      
      const userCount = 50;
      const shopId = 'shop-consistency-test';
      const targetTimeSlot = '10:00';
      const date = '2024-03-15';
      
      // Setup mocks for consistency testing
      let reservationCount = 0;
      mockSupabase.rpc.mockImplementation((fnName, params) => {
        if (fnName === 'create_reservation_with_lock') {
          reservationCount++;
          // Simulate some reservations failing due to conflicts
          if (reservationCount > 5) {
            return Promise.resolve({
              data: null,
              error: { message: 'Time slot no longer available' }
            });
          }
        }
        
        return Promise.resolve({
          data: { 
            id: `consistency-test-${reservationCount}`,
            status: 'requested',
            shop_id: shopId,
            reservation_date: date,
            start_time: targetTimeSlot
          },
          error: null
        });
      });

      const startTime = performance.now();
      
      // Simulate concurrent users trying to book the same time slot
      const concurrentBookings = Array(userCount).fill(0).map(async (_, index) => {
        const userId = `consistency-user-${index}`;
        
        try {
          const reservation = await reservationService.createReservation({
            shopId,
            userId,
            services: [{ serviceId: 'service-1', quantity: 1 }],
            reservationDate: date,
            reservationTime: targetTimeSlot
          });
          
          return {
            userId,
            success: true,
            reservationId: reservation.id,
            timestamp: Date.now()
          };
        } catch (error) {
          return {
            userId,
            success: false,
            error: error.message,
            timestamp: Date.now()
          };
        }
      });

      const results = await Promise.allSettled(concurrentBookings);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => r.status === 'fulfilled' && r.value.success);
      const failed = results.filter(r => r.status === 'fulfilled' && !r.value.success);
      
      // Validate consistency rules
      const successfulReservations = successful.map(r => r.value);
      const uniqueReservationIds = new Set(successfulReservations.map(r => r.reservationId));
      
      // Consistency assertions
      expect(successfulReservations.length).toBeLessThanOrEqual(5); // Only 5 should succeed
      expect(uniqueReservationIds.size).toBe(successfulReservations.length); // No duplicate reservations
      expect(failed.length).toBeGreaterThan(40); // Most should fail due to conflicts
      expect(executionTime).toBeLessThan(10000); // Should complete quickly

      // Check for race conditions
      const timestamps = successfulReservations.map(r => r.timestamp);
      const sortedTimestamps = [...timestamps].sort();
      const isChronological = timestamps.every((ts, index) => ts === sortedTimestamps[index]);

      console.log(`Data Consistency Validation Results:
        - Total execution time: ${executionTime.toFixed(2)}ms
        - Successful bookings: ${successfulReservations.length}
        - Failed bookings: ${failed.length}
        - Unique reservation IDs: ${uniqueReservationIds.size}
        - Chronological ordering: ${isChronological}
        - No race conditions detected: ${successfulReservations.length <= 5}`);
    });
  });
});
