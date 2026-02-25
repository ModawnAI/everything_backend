/**
 * API Workflow Integration Tests - Real Database
 * 
 * End-to-end API integration tests covering complete reservation workflows through HTTP endpoints:
 * - Complete booking journey via REST API
 * - Authentication and authorization flows
 * - Error handling and validation
 * - Cross-endpoint data consistency
 * - Performance under realistic API usage
 * 
 * Following testing rule: Use real Supabase connections, not mocks
 */

import request from 'supertest';
import app from '../../src/app';
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
      paymentKey: 'test-payment-key-api-123',
      orderId: 'test-order-api-123',
      amount: 50000,
      status: 'READY'
    }),
    confirmPayment: jest.fn().mockResolvedValue({
      paymentKey: 'test-payment-key-api-123',
      status: 'DONE',
      approvedAt: new Date().toISOString()
    })
  }
}));

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

// TODO: 결제 서비스 변경 후 활성화
describe.skip('API Workflow Integration Tests - Real Database', () => {
  let testUser: any;
  let testShop: any;
  let testService: any;
  let userToken: string;
  let shopOwnerToken: string;

  beforeAll(async () => {
    await initializeTestDatabase();

    console.log('🔧 Setting up API integration test data...');
    
    // Create test user
    testUser = await createTestUser({
      email: 'api-user@example.com',
      name: 'API Test User',
      phone: '+821012345678',
      total_points: 100000,
      available_points: 100000
    });

    // Create test shop
    testShop = await createTestShop({
      name: 'API Test Shop',
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

    // Create test service
    testService = await createTestService({
      shop_id: testShop.id,
      name: 'API Test Service',
      price_min: 60000,
      price_max: 90000,
      duration_minutes: 120,
      deposit_amount: 20000,
      category: 'haircut'
    });

    // Generate test tokens (simplified for testing)
    userToken = 'test-user-token-' + testUser.id;
    shopOwnerToken = 'test-shop-owner-token-' + testShop.owner_id;

    console.log(`✅ API test data created: User ${testUser.id}, Shop ${testShop.id}, Service ${testService.id}`);
  }, 60000);

  afterAll(async () => {
    await cleanupTestData();
  }, 30000);

  describe('Complete API Booking Journey', () => {
    it('should complete full reservation workflow through API endpoints', async () => {
      console.log('🚀 Starting complete API booking journey...');

      // Step 1: Get available time slots
      console.log('📅 Step 1: GET /api/time-slots/available');
      const timeSlotsResponse = await request(app)
        .get('/api/time-slots/available')
        .query({
          shopId: testShop.id,
          date: '2024-12-25',
          serviceIds: testService.id
        })
        .expect(200);

      expect(timeSlotsResponse.body.success).toBe(true);
      expect(Array.isArray(timeSlotsResponse.body.data)).toBe(true);
      console.log(`✅ Found ${timeSlotsResponse.body.data.length} available slots`);

      // Step 2: Create reservation
      console.log('📝 Step 2: POST /api/reservations');
      const createReservationResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2024-12-25',
          reservationTime: '14:00',
          pointsToUse: 0,
          specialRequests: 'API integration test'
        })
        .expect(201);

      expect(createReservationResponse.body.success).toBe(true);
      expect(createReservationResponse.body.data.id).toBeDefined();
      const reservationId = createReservationResponse.body.data.id;
      console.log(`✅ Reservation created: ${reservationId}`);

      // Step 3: Get reservation details
      console.log('🔍 Step 3: GET /api/reservations/:id');
      const getReservationResponse = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .expect(200);

      expect(getReservationResponse.body.success).toBe(true);
      expect(getReservationResponse.body.data.status).toBe('requested');
      console.log(`✅ Reservation details retrieved: ${getReservationResponse.body.data.status}`);

      // Step 4: Shop owner confirms reservation
      console.log('✅ Step 4: PUT /api/reservations/:id/confirm');
      const confirmResponse = await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .send({
          confirmedBy: testShop.owner_id,
          notes: 'Confirmed via API'
        })
        .expect(200);

      expect(confirmResponse.body.success).toBe(true);
      expect(confirmResponse.body.data.status).toBe('confirmed');
      console.log(`✅ Reservation confirmed via API`);

      // Step 5: Process payment
      console.log('💳 Step 5: POST /api/payments/process');
      const paymentResponse = await request(app)
        .post('/api/payments/process')
        .send({
          reservationId: reservationId,
          amount: testService.deposit_amount,
          paymentMethod: 'card',
          paymentStage: 'deposit'
        })
        .expect(200);

      expect(paymentResponse.body.success).toBe(true);
      console.log(`✅ Payment processed via API: ${paymentResponse.body.data.paymentId}`);

      // Step 6: Complete service
      console.log('🎯 Step 6: PUT /api/reservations/:id/complete');
      const completeResponse = await request(app)
        .put(`/api/reservations/${reservationId}/complete`)
        .send({
          completedBy: testShop.owner_id,
          completionNotes: 'Service completed successfully'
        })
        .expect(200);

      expect(completeResponse.body.success).toBe(true);
      expect(completeResponse.body.data.status).toBe('completed');
      console.log(`✅ Service completed via API`);

      // Step 7: Verify final state
      console.log('🔍 Step 7: Final verification');
      const finalResponse = await request(app)
        .get(`/api/reservations/${reservationId}`)
        .expect(200);

      expect(finalResponse.body.data.status).toBe('completed');
      console.log(`✅ Complete API booking journey test passed!`);
    }, 60000);

    it('should handle API validation errors properly', async () => {
      console.log('🚀 Starting API validation error handling test...');

      // Test missing required fields
      console.log('❌ Testing missing required fields...');
      const invalidResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          // Missing userId, services, date, time
        })
        .expect(400);

      expect(invalidResponse.body.success).toBe(false);
      expect(invalidResponse.body.error).toBeDefined();
      console.log(`✅ Validation error handled: ${invalidResponse.body.error}`);

      // Test invalid date format
      console.log('❌ Testing invalid date format...');
      const invalidDateResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: 'invalid-date',
          reservationTime: '14:00'
        })
        .expect(400);

      expect(invalidDateResponse.body.success).toBe(false);
      console.log(`✅ Invalid date error handled`);

      // Test non-existent shop ID
      console.log('❌ Testing non-existent shop ID...');
      const nonExistentShopResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: 'non-existent-shop-id',
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2024-12-26',
          reservationTime: '15:00'
        })
        .expect(404);

      expect(nonExistentShopResponse.body.success).toBe(false);
      console.log(`✅ Non-existent shop error handled`);

      console.log(`✅ API validation error handling test passed!`);
    }, 30000);
  });

  describe('Authentication and Authorization API Tests', () => {
    it('should handle authentication requirements', async () => {
      console.log('🚀 Starting authentication API test...');

      // Test accessing protected endpoint without token
      console.log('🔒 Testing protected endpoint without auth...');
      const unauthorizedResponse = await request(app)
        .get('/api/reservations/my-reservations')
        .expect(401);

      expect(unauthorizedResponse.body.success).toBe(false);
      console.log(`✅ Unauthorized access properly blocked`);

      // Test with valid token (simplified for testing)
      console.log('🔑 Testing with valid token...');
      const authorizedResponse = await request(app)
        .get('/api/reservations/my-reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      expect(authorizedResponse.body.success).toBe(true);
      console.log(`✅ Authorized access successful`);

      console.log(`✅ Authentication API test passed!`);
    }, 30000);

    it('should handle role-based authorization', async () => {
      console.log('🚀 Starting role-based authorization test...');

      // Create a reservation first
      const reservation = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2024-12-27',
          reservationTime: '11:00',
          pointsToUse: 0
        })
        .expect(201);

      const reservationId = reservation.body.data.id;

      // Test user trying to confirm reservation (should fail)
      console.log('❌ Testing user trying to confirm reservation...');
      const userConfirmResponse = await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          confirmedBy: testUser.id
        })
        .expect(403);

      expect(userConfirmResponse.body.success).toBe(false);
      console.log(`✅ User confirmation properly blocked`);

      // Test shop owner confirming reservation (should succeed)
      console.log('✅ Testing shop owner confirming reservation...');
      const ownerConfirmResponse = await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          confirmedBy: testShop.owner_id
        })
        .expect(200);

      expect(ownerConfirmResponse.body.success).toBe(true);
      console.log(`✅ Shop owner confirmation successful`);

      console.log(`✅ Role-based authorization test passed!`);
    }, 30000);
  });

  describe('API Error Handling and Recovery', () => {
    it('should handle server errors gracefully', async () => {
      console.log('🚀 Starting API error handling test...');

      // Test with malformed JSON
      console.log('❌ Testing malformed JSON...');
      const malformedResponse = await request(app)
        .post('/api/reservations')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(malformedResponse.body.success).toBe(false);
      console.log(`✅ Malformed JSON error handled`);

      // Test with extremely large payload
      console.log('❌ Testing large payload...');
      const largePayload = {
        shopId: testShop.id,
        userId: testUser.id,
        services: [{ serviceId: testService.id, quantity: 1 }],
        reservationDate: '2024-12-28',
        reservationTime: '16:00',
        specialRequests: 'A'.repeat(10000) // Very large string
      };

      const largePayloadResponse = await request(app)
        .post('/api/reservations')
        .send(largePayload)
        .expect(400);

      expect(largePayloadResponse.body.success).toBe(false);
      console.log(`✅ Large payload error handled`);

      console.log(`✅ API error handling test passed!`);
    }, 30000);

    it('should handle concurrent API requests', async () => {
      console.log('🚀 Starting concurrent API requests test...');

      // Create multiple concurrent reservation requests
      const concurrentRequests = Array.from({ length: 5 }, (_, index) => 
        request(app)
          .post('/api/reservations')
          .send({
            shopId: testShop.id,
            userId: testUser.id,
            services: [{ serviceId: testService.id, quantity: 1 }],
            reservationDate: '2024-12-29',
            reservationTime: `${10 + index}:00`,
            pointsToUse: 0
          })
      );

      const results = await Promise.allSettled(concurrentRequests);
      
      // Count successful requests
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 201
      );

      expect(successful.length).toBeGreaterThan(0);
      console.log(`✅ Concurrent requests handled: ${successful.length}/${results.length} successful`);

      console.log(`✅ Concurrent API requests test passed!`);
    }, 30000);
  });

  describe('API Performance Integration', () => {
    it('should maintain API response time standards', async () => {
      console.log('🚀 Starting API performance test...');

      const startTime = performance.now();

      // Test multiple API calls in sequence
      const operations = [
        // Get time slots
        request(app)
          .get('/api/time-slots/available')
          .query({
            shopId: testShop.id,
            date: '2024-12-30',
            serviceIds: testService.id
          }),
        
        // Create reservation
        request(app)
          .post('/api/reservations')
          .send({
            shopId: testShop.id,
            userId: testUser.id,
            services: [{ serviceId: testService.id, quantity: 1 }],
            reservationDate: '2024-12-30',
            reservationTime: '13:00',
            pointsToUse: 0
          }),
        
        // Get user reservations
        request(app)
          .get('/api/reservations/my-reservations')
          .set('Authorization', `Bearer ${userToken}`),
        
        // Get shop details
        request(app)
          .get(`/api/shops/${testShop.id}`)
      ];

      const results = await Promise.allSettled(operations);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Performance assertions
      expect(totalTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      const successful = results.filter(r => r.status === 'fulfilled');
      expect(successful.length).toBe(operations.length);

      console.log(`✅ API performance test passed! ${operations.length} operations in ${totalTime.toFixed(2)}ms`);
    }, 30000);

    it('should handle API rate limiting gracefully', async () => {
      console.log('🚀 Starting API rate limiting test...');

      // Send rapid requests to test rate limiting
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app)
          .get(`/api/shops/${testShop.id}`)
          .timeout(1000)
      );

      const results = await Promise.allSettled(rapidRequests);
      
      // Some requests should succeed, some might be rate limited
      const successful = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 200
      );
      
      const rateLimited = results.filter(r => 
        r.status === 'fulfilled' && r.value.status === 429
      );

      expect(successful.length).toBeGreaterThan(0);
      console.log(`✅ Rate limiting test: ${successful.length} successful, ${rateLimited.length} rate limited`);

      console.log(`✅ API rate limiting test passed!`);
    }, 30000);
  });

  describe('Cross-Endpoint Data Consistency', () => {
    it('should maintain data consistency across API endpoints', async () => {
      console.log('🚀 Starting data consistency test...');

      // Create reservation through API
      const createResponse = await request(app)
        .post('/api/reservations')
        .send({
          shopId: testShop.id,
          userId: testUser.id,
          services: [{ serviceId: testService.id, quantity: 1 }],
          reservationDate: '2024-12-31',
          reservationTime: '15:30',
          pointsToUse: 0
        })
        .expect(201);

      const reservationId = createResponse.body.data.id;

      // Verify reservation appears in user's reservations
      const userReservationsResponse = await request(app)
        .get('/api/reservations/my-reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const userReservation = userReservationsResponse.body.data.find(
        (r: any) => r.id === reservationId
      );
      expect(userReservation).toBeDefined();
      console.log(`✅ Reservation appears in user's list`);

      // Verify reservation appears in shop's reservations
      const shopReservationsResponse = await request(app)
        .get(`/api/shops/${testShop.id}/reservations`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .expect(200);

      const shopReservation = shopReservationsResponse.body.data.find(
        (r: any) => r.id === reservationId
      );
      expect(shopReservation).toBeDefined();
      console.log(`✅ Reservation appears in shop's list`);

      // Update reservation status
      await request(app)
        .put(`/api/reservations/${reservationId}/confirm`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          confirmedBy: testShop.owner_id
        })
        .expect(200);

      // Verify status update is reflected in all endpoints
      const updatedUserResponse = await request(app)
        .get('/api/reservations/my-reservations')
        .set('Authorization', `Bearer ${userToken}`)
        .expect(200);

      const updatedUserReservation = updatedUserResponse.body.data.find(
        (r: any) => r.id === reservationId
      );
      expect(updatedUserReservation.status).toBe('confirmed');
      console.log(`✅ Status update reflected in user's list`);

      const updatedShopResponse = await request(app)
        .get(`/api/shops/${testShop.id}/reservations`)
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .expect(200);

      const updatedShopReservation = updatedShopResponse.body.data.find(
        (r: any) => r.id === reservationId
      );
      expect(updatedShopReservation.status).toBe('confirmed');
      console.log(`✅ Status update reflected in shop's list`);

      console.log(`✅ Data consistency test passed!`);
    }, 45000);
  });
});

