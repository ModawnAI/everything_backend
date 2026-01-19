/**
 * End-to-End User Journey Tests - Real Database
 * 
 * Comprehensive E2E tests simulating real user interactions with actual database:
 * - Complete reservation booking flow from discovery to completion
 * - User authentication and profile management
 * - Payment processing and refund scenarios
 * - Shop owner management workflows
 * - Real-time system behavior validation
 * - Cross-service data consistency
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

// Mock only external services (payment gateways, notifications)
jest.mock('../../src/services/toss-payments.service', () => ({
  tossPaymentsService: {
    initiatePayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-e2e-payment-key-123',
      orderId: 'test-e2e-order-123',
      amount: 50000,
      status: 'READY',
      checkoutUrl: 'https://test-checkout.toss.im/test'
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-e2e-payment-key-123',
      status: 'DONE',
      approvedAt: new Date().toISOString(),
      receipt: { url: 'https://test-receipt.toss.im/test' }
    }),
    cancelPayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-e2e-payment-key-123',
      status: 'CANCELED',
      canceledAt: new Date().toISOString()
    })
  }
}));

jest.mock('../../src/services/sms.service', () => ({
  smsService: {
    sendSMS: jest.fn().mockResolvedValue({ 
      success: true, 
      messageId: 'test-sms-123',
      status: 'sent'
    })
  }
}));

jest.mock('../../src/services/email.service', () => ({
  emailService: {
    sendEmail: jest.fn().mockResolvedValue({ 
      success: true, 
      messageId: 'test-email-123',
      status: 'sent'
    })
  }
}));

jest.mock('../../src/services/push-notification.service', () => ({
  pushNotificationService: {
    sendPushNotification: jest.fn().mockResolvedValue({ 
      success: true, 
      messageId: 'test-push-123',
      status: 'sent'
    })
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
describe.skip('End-to-End User Journey Tests - Real Database', () => {
  let testUser: any;
  let testShop: any;
  let testServices: any[] = [];
  let userToken: string;
  let shopOwnerToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    console.log('🔧 Setting up E2E test data...');
    
    // Create test user (customer)
    testUser = await createTestUser({
      email: 'e2e-customer@example.com',
      name: 'E2E Test Customer',
      phone_number: '+821012345678',
      total_points: 200000,
      available_points: 200000
    });

    // Create test shop
    testShop = await createTestShop({
      name: 'E2E Test Beauty Shop',
      description: 'Premium beauty services for E2E testing',
      phone_number: '+821087654321',
      address: 'E2E Test Address 123, Seoul',
      latitude: 37.5665,
      longitude: 126.9780,
      operating_hours: {
        monday: { open: '09:00', close: '20:00', closed: false },
        tuesday: { open: '09:00', close: '20:00', closed: false },
        wednesday: { open: '09:00', close: '20:00', closed: false },
        thursday: { open: '09:00', close: '20:00', closed: false },
        friday: { open: '09:00', close: '20:00', closed: false },
        saturday: { open: '09:00', close: '19:00', closed: false },
        sunday: { open: '10:00', close: '18:00', closed: false }
      }
    });

    // Create multiple test services
    const serviceCategories = [
      { name: 'Premium Haircut', category: 'haircut', price_min: 80000, price_max: 120000, duration: 90 },
      { name: 'Hair Coloring', category: 'coloring', price_min: 150000, price_max: 250000, duration: 180 },
      { name: 'Facial Treatment', category: 'facial', price_min: 100000, price_max: 180000, duration: 120 },
      { name: 'Nail Art', category: 'nail_art', price_min: 60000, price_max: 100000, duration: 60 }
    ];

    for (const serviceData of serviceCategories) {
      const service = await createTestService({
        shop_id: testShop.id,
        name: serviceData.name,
        category: serviceData.category,
        price_min: serviceData.price_min,
        price_max: serviceData.price_max,
        duration_minutes: serviceData.duration,
        deposit_amount: Math.floor(serviceData.price_min * 0.3)
      });
      testServices.push(service);
    }

    // Generate test tokens (simplified for E2E testing)
    userToken = 'e2e-user-token-' + testUser.id;
    shopOwnerToken = 'e2e-shop-owner-token-' + testShop.owner_id;

    console.log(`✅ E2E test data created: User ${testUser.id}, Shop ${testShop.id}, ${testServices.length} services`);
  }, 120000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('Complete User Booking Journey', () => {
    it('should simulate complete user booking flow from discovery to completion', async () => {
      console.log('🎯 E2E Test: Complete User Booking Journey');
      
      // Step 1: User discovers shops (search/browse)
      console.log('🔍 Step 1: User discovers shops...');
      const discoverResponse = await request(app)
        .get('/api/shops/search')
        .query({
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 5000,
          category: 'beauty'
        })
        .expect(200);

      expect(discoverResponse.body.success).toBe(true);
      expect(discoverResponse.body.data.length).toBeGreaterThan(0);
      
      const discoveredShop = discoverResponse.body.data.find((shop: any) => shop.id === testShop.id);
      expect(discoveredShop).toBeDefined();
      console.log(`✅ Discovered ${discoverResponse.body.data.length} shops including target shop`);

      // Step 2: User views shop details
      console.log('👀 Step 2: User views shop details...');
      const shopDetailsResponse = await request(app)
        .get(`/api/shops/${testShop.id}`)
        .expect(200);

      expect(shopDetailsResponse.body.success).toBe(true);
      expect(shopDetailsResponse.body.data.id).toBe(testShop.id);
      expect(shopDetailsResponse.body.data.services).toBeDefined();
      console.log(`✅ Viewed shop details with ${shopDetailsResponse.body.data.services.length} services`);

      // Step 3: User checks available time slots
      console.log('📅 Step 3: User checks available time slots...');
      const selectedService = testServices[0]; // Premium Haircut
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 3); // 3 days from now
      const dateString = targetDate.toISOString().split('T')[0];

      const timeSlotsResponse = await request(app)
        .get('/api/time-slots/available')
        .query({
          shopId: testShop.id,
          date: dateString,
          serviceIds: selectedService.id
        })
        .expect(200);

      expect(timeSlotsResponse.body.success).toBe(true);
      expect(Array.isArray(timeSlotsResponse.body.data)).toBe(true);
      console.log(`✅ Found ${timeSlotsResponse.body.data.length} available time slots`);

      // Step 4: User creates reservation
      console.log('📝 Step 4: User creates reservation...');
      const reservationData = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: selectedService.id, quantity: 1 }],
        reservationDate: dateString,
        reservationTime: '14:00',
        pointsToUse: 10000,
        specialRequests: 'E2E test reservation - please handle with care'
      };

      const createReservationResponse = await request(app)
        .post('/api/reservations')
        .send(reservationData)
        .expect(201);

      expect(createReservationResponse.body.success).toBe(true);
      expect(createReservationResponse.body.data.id).toBeDefined();
      const reservationId = createReservationResponse.body.data.id;
      console.log(`✅ Reservation created: ${reservationId}`);

      // Step 5: User views reservation details
      console.log('🔍 Step 5: User views reservation details...');
      const reservationDetailsResponse = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .expect(200);

      expect(reservationDetailsResponse.body.success).toBe(true);
      expect(reservationDetailsResponse.body.data.status).toBe('requested');
      expect(reservationDetailsResponse.body.data.total_amount).toBeDefined();
      console.log(`✅ Reservation details viewed: Status ${reservationDetailsResponse.body.data.status}`);

      // Step 6: Shop owner receives and confirms reservation
      console.log('✅ Step 6: Shop owner confirms reservation...');
      const confirmResponse = await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          confirmedBy: testShop.owner_id,
          notes: 'E2E test confirmation - ready to serve'
        })
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      expect(confirmResponse.body.data.status).toBe('confirmed');
      console.log(`✅ Reservation confirmed by shop owner`);

      // Step 7: User processes payment
      console.log('💳 Step 7: User processes payment...');
      const paymentAmount = selectedService.deposit_amount;
      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reservationId: reservationId,
          amount: paymentAmount,
          paymentMethod: 'card',
          paymentStage: 'deposit'
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      expect(paymentResponse.body.data.paymentId).toBeDefined();
      console.log(`✅ Payment processed: ${paymentResponse.body.data.paymentId}`);

      // Step 8: User arrives and service is completed
      console.log('🎯 Step 8: Service completion...');
      const completeResponse = await request(app)
        .put(`/api/reservations/${reservationId}/complete`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          completedBy: testShop.owner_id,
          completionNotes: 'E2E test service completed successfully',
          serviceRating: 5
        })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.data.status).toBe('completed');
      console.log(`✅ Service completed successfully`);

      // Step 9: User views final reservation state
      console.log('🔍 Step 9: Final verification...');
      const finalResponse = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .expect(200);

      expect(finalResponse.body.data.status).toBe('completed');
      expect(finalResponse.body.data.completed_at).toBeDefined();
      console.log(`✅ Complete E2E user journey test passed!`);

      // Step 10: Verify points were awarded
      console.log('🎁 Step 10: Verify points awarded...');
      const userPointsResponse = await request(app)
        .get(`/api/users/${testUser.id}/points`)
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(userPointsResponse.body.success).toBe(true);
      expect(userPointsResponse.body.data.total_points).toBeGreaterThan(testUser.total_points);
      console.log(`✅ Points awarded: ${userPointsResponse.body.data.total_points - testUser.total_points} new points`);
    }, 120000);

    it('should handle user cancellation journey', async () => {
      console.log('🎯 E2E Test: User Cancellation Journey');

      // Create a reservation
      const selectedService = testServices[1]; // Hair Coloring
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 5);
      const dateString = targetDate.toISOString().split('T')[0];

      const createResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: selectedService.id, quantity: 1 }],
          reservationDate: dateString,
          reservationTime: '16:00',
          pointsToUse: 0
        })
        .expect(201);

      const reservationId = createResponse.body.data.id;
      console.log(`📝 Created reservation for cancellation test: ${reservationId}`);

      // Confirm reservation
      await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ confirmedBy: testShop.owner_id })
        .expect(200);

      // User cancels reservation
      console.log('❌ User cancelling reservation...');
      const cancelResponse = await request(app)
        .put(`/api/reservations/${reservationId}/cancel`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          cancellationReason: 'E2E test cancellation - schedule conflict',
          cancelledBy: testUser.id
        })
        .expect(200);

      expect(cancelResponse.body.success).toBe(true);
      expect(cancelResponse.body.data.status).toBe('cancelled_by_user');
      console.log(`✅ User cancellation journey test passed!`);
    }, 60000);
  });

  describe('Shop Owner Management Journey', () => {
    it('should simulate shop owner daily management workflow', async () => {
      console.log('🎯 E2E Test: Shop Owner Management Journey');

      // Step 1: Shop owner views pending reservations
      console.log('📋 Step 1: Shop owner views pending reservations...');
      const pendingResponse = await request(app)
        .get(`/api/shops/${testShop.id}/reservations`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ status: 'requested' })
        .expect(200);

      expect(pendingResponse.body.success).toBe(true);
      console.log(`✅ Found ${pendingResponse.body.data.length} pending reservations`);

      // Step 2: Create a new reservation to manage
      const selectedService = testServices[2]; // Facial Treatment
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 2);
      const dateString = targetDate.toISOString().split('T')[0];

      const newReservation = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: selectedService.id, quantity: 1 }],
          reservationDate: dateString,
          reservationTime: '11:00',
          pointsToUse: 5000
        })
        .expect(201);

      const reservationId = newReservation.body.data.id;
      console.log(`📝 Created new reservation for management: ${reservationId}`);

      // Step 3: Shop owner confirms reservation
      console.log('✅ Step 3: Shop owner confirms reservation...');
      const confirmResponse = await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          confirmedBy: testShop.owner_id,
          notes: 'Confirmed for E2E management test'
        })
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      console.log(`✅ Reservation confirmed by shop owner`);

      // Step 4: Shop owner views today's schedule
      console.log('📅 Step 4: Shop owner views schedule...');
      const scheduleResponse = await request(app)
        .get(`/api/shops/${testShop.id}/schedule`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .query({ date: dateString })
        .expect(200);

      expect(scheduleResponse.body.success).toBe(true);
      console.log(`✅ Schedule viewed for ${dateString}`);

      // Step 5: Shop owner updates shop settings
      console.log('⚙️ Step 5: Shop owner updates settings...');
      const updateResponse = await request(app)
        .put(`/api/shops/${testShop.id}`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          description: 'Updated description for E2E test - Premium beauty services with excellent customer care'
        })
        .expect(200);

      expect(updateResponse.body.success).toBe(true);
      console.log(`✅ Shop settings updated successfully`);

      console.log(`✅ Shop owner management journey test passed!`);
    }, 90000);

    it('should handle shop owner emergency closure scenario', async () => {
      console.log('🎯 E2E Test: Emergency Closure Scenario');

      // Create multiple reservations for today
      const today = new Date().toISOString().split('T')[0];
      const reservationIds = [];

      for (let i = 0; i < 3; i++) {
        const service = testServices[i % testServices.length];
        const time = `${10 + i * 2}:00`;

        const reservation = await request(app)
          .post('/api/reservations')
          .send({
            shopId: testShop.id,
            userId: testUser.id,
            services: [{ serviceId: service.id, quantity: 1 }],
            reservationDate: today,
            reservationTime: time,
            pointsToUse: 0
          })
          .expect(201);

        reservationIds.push(reservation.body.data.id);
        
        // Confirm each reservation
        await request(app)
          .put(`/api/reservations/${reservation.body.data.id}/confirm`)
          .set('Authorization', `Bearer ${shopOwnerToken}`)
          .send({ confirmedBy: testShop.owner_id })
          .expect(200);
      }

      console.log(`📝 Created ${reservationIds.length} reservations for emergency closure test`);

      // Shop owner cancels all reservations due to emergency
      console.log('🚨 Emergency closure - cancelling all reservations...');
      for (const reservationId of reservationIds) {
        const cancelResponse = await request(app)
          .put(`/api/reservations/${reservationId}/cancel`)
          .set('Authorization', `Bearer ${shopOwnerToken}`)
          .send({
            cancellationReason: 'Emergency closure - family emergency',
            cancelledBy: testShop.owner_id
          })
          .expect(200);

        expect(cancelResponse.body.data.status).toBe('cancelled_by_shop');
      }

      console.log(`✅ Emergency closure scenario test passed!`);
    }, 90000);
  });

  describe('Multi-Service Booking Journey', () => {
    it('should handle complex multi-service reservation', async () => {
      console.log('🎯 E2E Test: Multi-Service Booking Journey');

      // User books multiple services in one reservation
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 7);
      const dateString = targetDate.toISOString().split('T')[0];

      const multiServiceData = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [
          { serviceId: testServices[0].id, quantity: 1 }, // Premium Haircut
          { serviceId: testServices[3].id, quantity: 1 }  // Nail Art
        ],
        reservationDate: dateString,
        reservationTime: '13:00',
        pointsToUse: 15000,
        specialRequests: 'E2E multi-service test - please coordinate timing'
      };

      console.log('📝 Creating multi-service reservation...');
      const createResponse = await request(app)
        .post('/api/reservations')
        .send(multiServiceData)
        .expect(201);

      const reservationId = createResponse.body.data.id;
      expect(createResponse.body.data.services.length).toBe(2);
      console.log(`✅ Multi-service reservation created: ${reservationId}`);

      // Confirm reservation
      await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ confirmedBy: testShop.owner_id })
        .expect(200);

      // Process payment for total amount
      const totalAmount = createResponse.body.data.total_amount;
      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reservationId: reservationId,
          amount: totalAmount,
          paymentMethod: 'card',
          paymentStage: 'full'
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      console.log(`💳 Multi-service payment processed: ${totalAmount}`);

      // Complete services
      await request(app)
        .put(`/api/reservations/${reservationId}/complete`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          completedBy: testShop.owner_id,
          completionNotes: 'All services completed successfully'
        })
        .expect(200);

      console.log(`✅ Multi-service booking journey test passed!`);
    }, 90000);
  });

  describe('Error Recovery and Resilience', () => {
    it('should handle payment failure and recovery', async () => {
      console.log('🎯 E2E Test: Payment Failure Recovery');

      // Create and confirm reservation
      const selectedService = testServices[0];
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 4);
      const dateString = targetDate.toISOString().split('T')[0];

      const reservation = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: selectedService.id, quantity: 1 }],
          reservationDate: dateString,
          reservationTime: '15:30',
          pointsToUse: 0
        })
        .expect(201);

      const reservationId = reservation.body.data.id;
      
      await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({ confirmedBy: testShop.owner_id })
        .expect(200);

      // Simulate payment failure
      console.log('❌ Simulating payment failure...');
      
      // Mock payment service to fail once
      const { tossPaymentsService } = require('../../src/services/toss-payments.service');
      tossPaymentsService.initiatePayment.mockRejectedValueOnce(new Error('Payment gateway timeout'));

      const failedPaymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reservationId: reservationId,
          amount: selectedService.deposit_amount,
          paymentMethod: 'card',
          paymentStage: 'deposit'
        })
        .expect(500);

      expect(failedPaymentResponse.body.success).toBe(false);
      console.log(`✅ Payment failure handled correctly`);

      // Reset mock and retry payment
      console.log('🔄 Retrying payment...');
      tossPaymentsService.initiatePayment.mockResolvedValueOnce({
        paymentKey: 'retry-payment-key-123',
        orderId: 'retry-order-123',
        amount: selectedService.deposit_amount,
        status: 'READY'
      });

      const retryPaymentResponse = await request(app)
        .post('/api/payments/process')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          reservationId: reservationId,
          amount: selectedService.deposit_amount,
          paymentMethod: 'card',
          paymentStage: 'deposit'
        })
        .expect(200);

      expect(retryPaymentResponse.body.success).toBe(true);
      console.log(`✅ Payment recovery test passed!`);
    }, 90000);

    it('should handle concurrent booking conflicts', async () => {
      console.log('🎯 E2E Test: Concurrent Booking Conflicts');

      const selectedService = testServices[1];
      const targetDate = new Date();
      targetDate.setDate(targetDate.getDate() + 6);
      const dateString = targetDate.toISOString().split('T')[0];
      const timeSlot = '12:00';

      // Create two concurrent booking requests for the same time slot
      const bookingData = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: selectedService.id, quantity: 1 }],
        reservationDate: dateString,
        reservationTime: timeSlot,
        pointsToUse: 0
      };

      console.log('⚡ Creating concurrent booking requests...');
      const [response1, response2] = await Promise.allSettled([
        request(app).post('/api/reservations').send(bookingData),
        request(app).post('/api/reservations').send(bookingData)
      ]);

      // One should succeed, one should fail
      const successful = [response1, response2].filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );
      const failed = [response1, response2].filter(r => 
        r.status === 'fulfilled' && r.value.status !== 201
      );

      expect(successful.length).toBe(1);
      expect(failed.length).toBe(1);
      console.log(`✅ Concurrent booking conflict handled: 1 success, 1 conflict`);
    }, 60000);
  });

  describe('System Performance Under Load', () => {
    it('should maintain performance with multiple concurrent users', async () => {
      console.log('🎯 E2E Test: Multiple Concurrent Users');

      const startTime = performance.now();
      const concurrentUsers = 10;
      const userRequests = [];

      // Simulate multiple users browsing and booking simultaneously
      for (let i = 0; i < concurrentUsers; i++) {
        const userFlow = async () => {
          // Browse shops
          await request(app)
            .get('/api/shops/search')
            .query({ latitude: 37.5665, longitude: 126.9780, radius: 5000 });

          // View shop details
          await request(app)
            .get(`/api/shops/${testShop.id}`);

          // Check time slots
          const futureDate = new Date();
          futureDate.setDate(futureDate.getDate() + 8 + i);
          const dateString = futureDate.toISOString().split('T')[0];

          await request(app)
            .get('/api/time-slots/available')
            .query({
              shopId: testShop.id,
              date: dateString,
              serviceIds: testServices[i % testServices.length].id
            });

          // Create reservation
          return request(app)
            .post('/api/reservations')
            .send({
              shopId: testShop.id,
              userId: testUser.id,
              services: [{ serviceId: testServices[i % testServices.length].id, quantity: 1 }],
              reservationDate: dateString,
              reservationTime: `${10 + (i % 8)}:00`,
              pointsToUse: 0
            });
        };

        userRequests.push(userFlow());
      }

      const results = await Promise.allSettled(userRequests);
      const endTime = performance.now();
      const executionTime = endTime - startTime;

      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );

      // Performance assertions
      expect(executionTime).toBeLessThan(30000); // Should complete within 30 seconds
      expect(successful.length).toBeGreaterThan(concurrentUsers * 0.8); // 80% success rate

      console.log(`✅ Concurrent users test: ${successful.length}/${concurrentUsers} successful in ${executionTime.toFixed(2)}ms`);
    }, 60000);
  });
});

