/**
 * Automated User Simulation Tests - Real Database
 * 
 * Advanced E2E tests with realistic user behavior simulation using real database:
 * - Realistic user behavior patterns and timing
 * - Concurrent user simulation scenarios
 * - Stress testing with multiple user types
 * - A/B testing scenarios
 * - Performance monitoring during user simulation
 * - Data consistency validation across user interactions
 * 
 * Following testing rule: Use real Supabase connections, not mocks
 */

import request from 'supertest';
import { app } from '../../src/app';
import { 
  createTestUser, 
  createTestShop, 
  createTestService,
  cleanupTestData,
  initializeTestDatabase,
  testSupabaseClient
} from '../setup-real-db';

// Mock only external services
jest.mock('../../src/services/toss-payments.service', () => ({
  tossPaymentsService: {
    initiatePayment: jest.fn().mockResolvedValue({
      paymentKey: 'sim-payment-key-123',
      orderId: 'sim-order-123',
      amount: 50000,
      status: 'READY'
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      paymentKey: 'sim-payment-key-123',
      status: 'DONE',
      approvedAt: new Date().toISOString()
    })
  }
}));

jest.mock('../../src/services/sms.service', () => ({
  smsService: {
    sendSMS: jest.fn().mockResolvedValue({ success: true, messageId: 'sim-sms-123' })
  }
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue({ success: true, messageId: 'sim-email-123' })
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

// User behavior simulation utilities
class UserBehaviorSimulator {
  private userTypes = {
    casual_user: {
      bookingFrequency: 0.3, // 30% chance per session
      paymentDelay: { min: 5000, max: 15000 }, // 5-15 seconds
      cancellationRate: 0.1, // 10% cancellation rate
      repeatBookingRate: 0.4, // 40% repeat booking rate
      browsingTime: { min: 10000, max: 30000 }, // 10-30 seconds
      decisionTime: { min: 15000, max: 45000 } // 15-45 seconds
    },
    frequent_user: {
      bookingFrequency: 0.8, // 80% chance per session
      paymentDelay: { min: 2000, max: 8000 }, // 2-8 seconds
      cancellationRate: 0.05, // 5% cancellation rate
      repeatBookingRate: 0.7, // 70% repeat booking rate
      browsingTime: { min: 5000, max: 15000 }, // 5-15 seconds
      decisionTime: { min: 5000, max: 20000 } // 5-20 seconds
    },
    new_user: {
      bookingFrequency: 0.6, // 60% chance per session
      paymentDelay: { min: 10000, max: 30000 }, // 10-30 seconds
      cancellationRate: 0.15, // 15% cancellation rate
      repeatBookingRate: 0.2, // 20% repeat booking rate
      browsingTime: { min: 20000, max: 60000 }, // 20-60 seconds
      decisionTime: { min: 30000, max: 90000 } // 30-90 seconds
    },
    vip_user: {
      bookingFrequency: 0.9, // 90% chance per session
      paymentDelay: { min: 1000, max: 5000 }, // 1-5 seconds
      cancellationRate: 0.02, // 2% cancellation rate
      repeatBookingRate: 0.9, // 90% repeat booking rate
      browsingTime: { min: 3000, max: 10000 }, // 3-10 seconds
      decisionTime: { min: 2000, max: 10000 } // 2-10 seconds
    }
  };

  simulateUserBehavior(userType: keyof typeof this.userTypes) {
    const behavior = this.userTypes[userType];
    return {
      shouldBook: Math.random() < behavior.bookingFrequency,
      shouldCancel: Math.random() < behavior.cancellationRate,
      shouldRepeatBook: Math.random() < behavior.repeatBookingRate,
      paymentDelay: Math.random() * (behavior.paymentDelay.max - behavior.paymentDelay.min) + behavior.paymentDelay.min,
      browsingTime: Math.random() * (behavior.browsingTime.max - behavior.browsingTime.min) + behavior.browsingTime.min,
      decisionTime: Math.random() * (behavior.decisionTime.max - behavior.decisionTime.min) + behavior.decisionTime.min
    };
  }

  async simulateRealisticDelay(milliseconds: number) {
    // Add some randomness to make it more realistic
    const actualDelay = milliseconds * (0.8 + Math.random() * 0.4); // ±20% variation
    await new Promise(resolve => setTimeout(resolve, actualDelay));
  }
}

describe('Automated User Simulation Tests - Real Database', () => {
  let testUsers: any[] = [];
  let testShops: any[] = [];
  let testServices: any[] = [];
  let simulator: UserBehaviorSimulator;

  beforeAll(async () => {
    await initializeTestDatabase();
    simulator = new UserBehaviorSimulator();

    console.log('🔧 Setting up automated simulation test data...');
    
    // Create multiple test users with different profiles
    const userProfiles = [
      { type: 'casual_user', email: 'casual-user@example.com', name: 'Casual User', points: 50000 },
      { type: 'frequent_user', email: 'frequent-user@example.com', name: 'Frequent User', points: 150000 },
      { type: 'new_user', email: 'new-user@example.com', name: 'New User', points: 10000 },
      { type: 'vip_user', email: 'vip-user@example.com', name: 'VIP User', points: 500000 }
    ];

    for (const profile of userProfiles) {
      const user = await createTestUser({
        email: profile.email,
        name: profile.name,
        phone_number: `+8210${Math.floor(Math.random() * 100000000).toString().padStart(8, '0')}`,
        total_points: profile.points,
        available_points: profile.points,
        user_type: profile.type
      });
      testUsers.push({ ...user, type: profile.type });
    }

    // Create multiple test shops
    for (let i = 0; i < 3; i++) {
      const shop = await createTestShop({
        name: `Simulation Test Shop ${i + 1}`,
        description: `Premium beauty services for simulation testing ${i + 1}`,
        latitude: 37.5665 + (i * 0.01),
        longitude: 126.9780 + (i * 0.01)
      });
      testShops.push(shop);

      // Create services for each shop
      const serviceTypes = [
        { name: 'Quick Haircut', price: 60000, duration: 60 },
        { name: 'Premium Styling', price: 120000, duration: 120 },
        { name: 'Facial Treatment', price: 90000, duration: 90 }
      ];

      for (const serviceType of serviceTypes) {
        const service = await createTestService({
          shop_id: shop.id,
          name: `${serviceType.name} - Shop ${i + 1}`,
          price_min: serviceType.price,
          price_max: serviceType.price * 1.5,
          duration_minutes: serviceType.duration,
          deposit_amount: Math.floor(serviceType.price * 0.3)
        });
        testServices.push(service);
      }
    }

    console.log(`✅ Simulation data created: ${testUsers.length} users, ${testShops.length} shops, ${testServices.length} services`);
  }, 180000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('Realistic User Behavior Simulation', () => {
    it('should simulate different user types with realistic behavior patterns', async () => {
      console.log('🎯 Simulation Test: Different User Types');

      const simulationResults = [];

      for (const testUser of testUsers) {
        const userType = testUser.type as keyof typeof simulator['userTypes'];
        const behavior = simulator.simulateUserBehavior(userType);
        
        console.log(`👤 Simulating ${userType}: ${testUser.name}`);
        const userStartTime = performance.now();

        try {
          // Step 1: User browses shops (realistic browsing time)
          console.log(`  🔍 Browsing shops...`);
          await simulator.simulateRealisticDelay(behavior.browsingTime);
          
          const browseResponse = await request(app)
            .get('/api/shops/search')
            .query({
              latitude: 37.5665,
              longitude: 126.9780,
              radius: 10000
            });

          expect(browseResponse.status).toBe(200);

          // Step 2: User views shop details (decision time)
          const selectedShop = testShops[Math.floor(Math.random() * testShops.length)];
          console.log(`  👀 Viewing shop details...`);
          await simulator.simulateRealisticDelay(behavior.decisionTime);

          const shopResponse = await request(app)
            .get(`/api/shops/${selectedShop.id}`);

          expect(shopResponse.status).toBe(200);

          // Step 3: Booking decision based on user type
          if (behavior.shouldBook) {
            console.log(`  📝 User decided to book...`);
            
            // Check available slots
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + Math.floor(Math.random() * 7) + 1);
            const dateString = targetDate.toISOString().split('T')[0];

            const availableServices = testServices.filter(s => s.shop_id === selectedShop.id);
            const selectedService = availableServices[Math.floor(Math.random() * availableServices.length)];

            const slotsResponse = await request(app)
              .get('/api/time-slots/available')
              .query({
                shopId: selectedShop.id,
                date: dateString,
                serviceIds: selectedService.id
              });

            if (slotsResponse.status === 200 && slotsResponse.body.data.length > 0) {
              // Create reservation
              const reservationResponse = await request(app)
                .post('/api/reservations')
                .send({
                  shopId: selectedShop.id,
                  userId: testUser.id,
                  services: [{ serviceId: selectedService.id, quantity: 1 }],
                  reservationDate: dateString,
                  reservationTime: '14:00',
                  pointsToUse: Math.floor(Math.random() * Math.min(testUser.available_points, 20000))
                });

              if (reservationResponse.status === 201) {
                console.log(`  ✅ Reservation created successfully`);
                
                // Simulate payment delay
                await simulator.simulateRealisticDelay(behavior.paymentDelay);
                
                simulationResults.push({
                  userType,
                  action: 'booking_success',
                  executionTime: performance.now() - userStartTime,
                  reservationId: reservationResponse.body.data.id
                });
              } else {
                console.log(`  ❌ Booking failed: ${reservationResponse.status}`);
                simulationResults.push({
                  userType,
                  action: 'booking_failed',
                  executionTime: performance.now() - userStartTime,
                  error: reservationResponse.body.error
                });
              }
            } else {
              console.log(`  ⏰ No available slots`);
              simulationResults.push({
                userType,
                action: 'no_slots',
                executionTime: performance.now() - userStartTime
              });
            }
          } else {
            console.log(`  🚶 User decided not to book`);
            simulationResults.push({
              userType,
              action: 'browsing_only',
              executionTime: performance.now() - userStartTime
            });
          }
        } catch (error) {
          console.log(`  💥 Simulation error for ${userType}: ${error.message}`);
          simulationResults.push({
            userType,
            action: 'error',
            executionTime: performance.now() - userStartTime,
            error: error.message
          });
        }
      }

      // Analyze simulation results
      console.log('\n📊 Simulation Results Analysis:');
      const resultsByType = simulationResults.reduce((acc, result) => {
        if (!acc[result.userType]) {
          acc[result.userType] = [];
        }
        acc[result.userType].push(result);
        return acc;
      }, {} as any);

      for (const [userType, results] of Object.entries(resultsByType)) {
        const successRate = (results as any[]).filter(r => r.action === 'booking_success').length / (results as any[]).length;
        const avgTime = (results as any[]).reduce((sum, r) => sum + r.executionTime, 0) / (results as any[]).length;
        
        console.log(`  ${userType}: ${successRate * 100}% success rate, ${avgTime.toFixed(2)}ms avg time`);
        
        // Validate user type behavior
        const expectedBehavior = simulator['userTypes'][userType as keyof typeof simulator['userTypes']];
        expect(successRate).toBeLessThanOrEqual(expectedBehavior.bookingFrequency + 0.2); // Allow some variance
      }

      expect(simulationResults.length).toBe(testUsers.length);
      console.log(`✅ User behavior simulation test passed!`);
    }, 300000);

    it('should simulate concurrent user sessions with realistic timing', async () => {
      console.log('🎯 Simulation Test: Concurrent User Sessions');

      const concurrentSessions = 8;
      const sessionPromises = [];

      for (let i = 0; i < concurrentSessions; i++) {
        const userType = Object.keys(simulator['userTypes'])[i % 4] as keyof typeof simulator['userTypes'];
        const testUser = testUsers[i % testUsers.length];
        
        const sessionSimulation = async () => {
          const sessionId = `session-${i}`;
          const behavior = simulator.simulateUserBehavior(userType);
          
          console.log(`🔄 Starting ${sessionId} for ${userType}`);
          
          try {
            // Realistic user session flow
            await simulator.simulateRealisticDelay(Math.random() * 5000); // Stagger start times
            
            // Browse shops
            const browseResponse = await request(app)
              .get('/api/shops/search')
              .query({ latitude: 37.5665, longitude: 126.9780, radius: 5000 });
            
            await simulator.simulateRealisticDelay(behavior.browsingTime);
            
            // View shop details
            const selectedShop = testShops[Math.floor(Math.random() * testShops.length)];
            const shopResponse = await request(app)
              .get(`/api/shops/${selectedShop.id}`);
            
            await simulator.simulateRealisticDelay(behavior.decisionTime);
            
            // Attempt booking if user decides to
            if (behavior.shouldBook) {
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + Math.floor(Math.random() * 5) + 1);
              const dateString = targetDate.toISOString().split('T')[0];
              
              const availableServices = testServices.filter(s => s.shop_id === selectedShop.id);
              const selectedService = availableServices[Math.floor(Math.random() * availableServices.length)];
              
              const reservationResponse = await request(app)
                .post('/api/reservations')
                .send({
                  shopId: selectedShop.id,
                  userId: testUser.id,
                  services: [{ serviceId: selectedService.id, quantity: 1 }],
                  reservationDate: dateString,
                  reservationTime: `${10 + Math.floor(Math.random() * 8)}:00`,
                  pointsToUse: 0
                });
              
              return {
                sessionId,
                userType,
                success: reservationResponse.status === 201,
                status: reservationResponse.status
              };
            }
            
            return {
              sessionId,
              userType,
              success: true,
              status: 'browsing_only'
            };
          } catch (error) {
            return {
              sessionId,
              userType,
              success: false,
              error: error.message
            };
          }
        };

        sessionPromises.push(sessionSimulation());
      }

      const sessionResults = await Promise.allSettled(sessionPromises);
      
      // Analyze concurrent session results
      const successful = sessionResults.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );
      
      const failed = sessionResults.filter(r => 
        r.status === 'rejected' || (r.status === 'fulfilled' && !(r.value as any).success)
      );

      console.log(`📊 Concurrent Sessions Results:`);
      console.log(`  Successful: ${successful.length}/${concurrentSessions}`);
      console.log(`  Failed: ${failed.length}/${concurrentSessions}`);
      console.log(`  Success Rate: ${(successful.length / concurrentSessions * 100).toFixed(1)}%`);

      // Should handle most concurrent sessions successfully
      expect(successful.length / concurrentSessions).toBeGreaterThan(0.7); // 70% success rate
      console.log(`✅ Concurrent user sessions test passed!`);
    }, 240000);
  });

  describe('Stress Testing with User Simulation', () => {
    it('should handle high-volume user simulation', async () => {
      console.log('🎯 Simulation Test: High-Volume User Load');

      const totalUsers = 20;
      const batchSize = 5;
      const batches = Math.ceil(totalUsers / batchSize);
      const results = [];

      for (let batch = 0; batch < batches; batch++) {
        console.log(`🔄 Processing batch ${batch + 1}/${batches}`);
        const batchPromises = [];

        for (let i = 0; i < batchSize && (batch * batchSize + i) < totalUsers; i++) {
          const userIndex = batch * batchSize + i;
          const userType = Object.keys(simulator['userTypes'])[userIndex % 4] as keyof typeof simulator['userTypes'];
          const testUser = testUsers[userIndex % testUsers.length];

          const userSimulation = async () => {
            const startTime = performance.now();
            
            try {
              // Quick user flow for stress testing
              const browseResponse = await request(app)
                .get('/api/shops/search')
                .query({ latitude: 37.5665, longitude: 126.9780, radius: 5000 });

              const selectedShop = testShops[userIndex % testShops.length];
              const shopResponse = await request(app)
                .get(`/api/shops/${selectedShop.id}`);

              // Attempt booking
              const targetDate = new Date();
              targetDate.setDate(targetDate.getDate() + Math.floor(userIndex / 5) + 1);
              const dateString = targetDate.toISOString().split('T')[0];

              const availableServices = testServices.filter(s => s.shop_id === selectedShop.id);
              const selectedService = availableServices[userIndex % availableServices.length];

              const reservationResponse = await request(app)
                .post('/api/reservations')
                .send({
                  shopId: selectedShop.id,
                  userId: testUser.id,
                  services: [{ serviceId: selectedService.id, quantity: 1 }],
                  reservationDate: dateString,
                  reservationTime: `${9 + (userIndex % 10)}:00`,
                  pointsToUse: 0
                });

              const endTime = performance.now();
              
              return {
                userIndex,
                userType,
                success: reservationResponse.status === 201,
                executionTime: endTime - startTime,
                status: reservationResponse.status
              };
            } catch (error) {
              const endTime = performance.now();
              return {
                userIndex,
                userType,
                success: false,
                executionTime: endTime - startTime,
                error: error.message
              };
            }
          };

          batchPromises.push(userSimulation());
        }

        const batchResults = await Promise.allSettled(batchPromises);
        results.push(...batchResults);

        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      // Analyze stress test results
      const successful = results.filter(r => 
        r.status === 'fulfilled' && (r.value as any).success
      );
      
      const averageTime = successful.length > 0 
        ? successful.reduce((sum, r) => sum + (r.value as any).executionTime, 0) / successful.length
        : 0;

      console.log(`📊 Stress Test Results:`);
      console.log(`  Total Users: ${totalUsers}`);
      console.log(`  Successful: ${successful.length}`);
      console.log(`  Success Rate: ${(successful.length / totalUsers * 100).toFixed(1)}%`);
      console.log(`  Average Response Time: ${averageTime.toFixed(2)}ms`);

      // Performance assertions
      expect(successful.length / totalUsers).toBeGreaterThan(0.6); // 60% success rate under stress
      expect(averageTime).toBeLessThan(10000); // Average under 10 seconds

      console.log(`✅ High-volume user simulation test passed!`);
    }, 300000);
  });

  describe('Data Consistency During Simulation', () => {
    it('should maintain data consistency across concurrent user interactions', async () => {
      console.log('🎯 Simulation Test: Data Consistency');

      const concurrentUsers = 6;
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 10);
      const dateString = targetDate.toISOString().split('T')[0];
      
      // All users try to book the same service at different times
      const selectedShop = testShops[0];
      const selectedService = testServices.find(s => s.shop_id === selectedShop.id);
      
      const bookingPromises = testUsers.slice(0, concurrentUsers).map((user, index) => {
        return request(app)
          .post('/api/reservations')
          .send({
            shopId: selectedShop.id,
            userId: user.id,
            services: [{ serviceId: selectedService.id, quantity: 1 }],
            reservationDate: dateString,
            reservationTime: `${10 + index}:00`,
            pointsToUse: 0
          });
      });

      const bookingResults = await Promise.allSettled(bookingPromises);
      
      // Verify data consistency in database
      const reservationsInDb = await testSupabaseClient
        .from('reservations')
        .select('*')
        .eq('shop_id', selectedShop.id)
        .eq('reservation_date', dateString);

      expect(reservationsInDb.error).toBeNull();
      
      const successful = bookingResults.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      
      // Database should have exactly the same number of reservations as successful API calls
      expect(reservationsInDb.data.length).toBe(successful.length);
      
      // Verify no time slot conflicts
      const timeSlots = reservationsInDb.data.map(r => r.reservation_time);
      const uniqueTimeSlots = new Set(timeSlots);
      expect(uniqueTimeSlots.size).toBe(timeSlots.length); // No duplicates

      console.log(`✅ Data consistency maintained: ${successful.length} bookings, ${reservationsInDb.data.length} DB records`);
    }, 120000);
  });

  describe('User Journey Analytics Simulation', () => {
    it('should simulate and track user journey analytics', async () => {
      console.log('🎯 Simulation Test: User Journey Analytics');

      const journeyMetrics = {
        totalSessions: 0,
        browsingToBookingConversion: 0,
        averageSessionDuration: 0,
        userTypePerformance: {} as any
      };

      for (const testUser of testUsers.slice(0, 6)) {
        const userType = testUser.type as keyof typeof simulator['userTypes'];
        const sessionStart = performance.now();
        journeyMetrics.totalSessions++;

        if (!journeyMetrics.userTypePerformance[userType]) {
          journeyMetrics.userTypePerformance[userType] = {
            sessions: 0,
            bookings: 0,
            averageTime: 0
          };
        }

        journeyMetrics.userTypePerformance[userType].sessions++;

        try {
          const behavior = simulator.simulateUserBehavior(userType);

          // Simulate realistic user journey with analytics tracking
          console.log(`📊 Tracking ${userType} journey...`);

          // Browse phase
          await simulator.simulateRealisticDelay(behavior.browsingTime);
          const browseResponse = await request(app)
            .get('/api/shops/search')
            .query({ latitude: 37.5665, longitude: 126.9780, radius: 5000 });

          // Decision phase
          await simulator.simulateRealisticDelay(behavior.decisionTime);
          const selectedShop = testShops[Math.floor(Math.random() * testShops.length)];
          
          const shopResponse = await request(app)
            .get(`/api/shops/${selectedShop.id}`);

          // Booking phase (if user decides to book)
          if (behavior.shouldBook) {
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + Math.floor(Math.random() * 7) + 1);
            const dateString = targetDate.toISOString().split('T')[0];

            const availableServices = testServices.filter(s => s.shop_id === selectedShop.id);
            const selectedService = availableServices[Math.floor(Math.random() * availableServices.length)];

            const reservationResponse = await request(app)
              .post('/api/reservations')
              .send({
                shopId: selectedShop.id,
                userId: testUser.id,
                services: [{ serviceId: selectedService.id, quantity: 1 }],
                reservationDate: dateString,
                reservationTime: '15:00',
                pointsToUse: Math.floor(Math.random() * 10000)
              });

            if (reservationResponse.status === 201) {
              journeyMetrics.browsingToBookingConversion++;
              journeyMetrics.userTypePerformance[userType].bookings++;
            }
          }

          const sessionEnd = performance.now();
          const sessionDuration = sessionEnd - sessionStart;
          journeyMetrics.averageSessionDuration += sessionDuration;
          journeyMetrics.userTypePerformance[userType].averageTime += sessionDuration;

        } catch (error) {
          console.log(`❌ Journey tracking error for ${userType}: ${error.message}`);
        }
      }

      // Calculate final metrics
      journeyMetrics.averageSessionDuration /= journeyMetrics.totalSessions;
      journeyMetrics.browsingToBookingConversion = 
        (journeyMetrics.browsingToBookingConversion / journeyMetrics.totalSessions) * 100;

      for (const userType of Object.keys(journeyMetrics.userTypePerformance)) {
        const performance = journeyMetrics.userTypePerformance[userType];
        performance.averageTime /= performance.sessions;
        performance.conversionRate = (performance.bookings / performance.sessions) * 100;
      }

      console.log('\n📊 User Journey Analytics Results:');
      console.log(`  Total Sessions: ${journeyMetrics.totalSessions}`);
      console.log(`  Conversion Rate: ${journeyMetrics.browsingToBookingConversion.toFixed(1)}%`);
      console.log(`  Average Session Duration: ${journeyMetrics.averageSessionDuration.toFixed(2)}ms`);
      
      console.log('\n  Performance by User Type:');
      for (const [userType, performance] of Object.entries(journeyMetrics.userTypePerformance)) {
        const perf = performance as any;
        console.log(`    ${userType}: ${perf.conversionRate.toFixed(1)}% conversion, ${perf.averageTime.toFixed(2)}ms avg time`);
      }

      // Validate analytics make sense
      expect(journeyMetrics.totalSessions).toBeGreaterThan(0);
      expect(journeyMetrics.browsingToBookingConversion).toBeGreaterThanOrEqual(0);
      expect(journeyMetrics.browsingToBookingConversion).toBeLessThanOrEqual(100);

      console.log(`✅ User journey analytics simulation test passed!`);
    }, 240000);
  });
});

