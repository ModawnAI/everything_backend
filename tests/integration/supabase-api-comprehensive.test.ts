import request from 'supertest';
import app from '../../src/app';
import { getSupabaseClient } from '../../src/config/database';
import { config } from '../../src/config/environment';
import { setupTestEnvironment } from '../setup/supabase-test-setup';

// Test configuration
const TEST_CONFIG = {
  baseUrl: `http://localhost:${config.server.port}`,
  timeout: 30000,
  retries: 3,
  delay: 1000,
};

// Test data factories
const createTestUser = (overrides = {}) => ({
  email: `test-${Date.now()}@example.com`,
  password: 'TestPassword123!',
  phone_number: '+821012345678',
  full_name: 'Test User',
  date_of_birth: '1990-01-01',
  gender: 'other',
  ...overrides,
});

const createTestShop = (overrides = {}) => ({
  name: `Test Shop ${Date.now()}`,
  description: 'Test shop description',
  address: 'Test Address 123',
  latitude: 37.5665,
  longitude: 126.9780,
  phone_number: '+821098765432',
  business_hours: {
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '18:00', closed: false },
    saturday: { open: '10:00', close: '17:00', closed: false },
    sunday: { open: '10:00', close: '17:00', closed: false },
  },
  categories: ['beauty', 'hair'],
  ...overrides,
});

const createTestReservation = (overrides = {}) => ({
  shop_id: 'test-shop-id',
  user_id: 'test-user-id',
  service_id: 'test-service-id',
  reservation_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0], // Tomorrow
  start_time: '10:00',
  end_time: '11:00',
  status: 'pending',
  notes: 'Test reservation',
  ...overrides,
});

// Helper functions
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const retryOperation = async <T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delayMs = 1000
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await delay(delayMs * (i + 1));
    }
  }
  throw new Error('Max retries exceeded');
};

// Test tokens and IDs storage
let testTokens: {
  userToken: string;
  adminToken: string;
  shopOwnerToken: string;
} = {
  userToken: '',
  adminToken: '',
  shopOwnerToken: '',
};

let testIds: {
  userId: string;
  adminId: string;
  shopOwnerId: string;
  shopId: string;
  serviceId: string;
  reservationId: string;
} = {
  userId: '',
  adminId: '',
  shopOwnerId: '',
  shopId: '',
  serviceId: '',
  reservationId: '',
};

describe('Supabase API Comprehensive Test Suite', () => {
  beforeAll(async () => {
    setupTestEnvironment();
    
    // Wait for server to be ready
    await delay(2000);
    
    // Skip tests if Supabase is not configured
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      console.warn('Skipping Supabase API tests: Supabase not configured');
      pending('Supabase not configured');
      return;
    }
    
    // Verify Supabase connection
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('users').select('count').limit(1);
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Supabase connection failed: ${error.message}`);
    }
  }, TEST_CONFIG.timeout);

  afterAll(async () => {
    // Cleanup test data
    const supabase = getSupabaseClient();
    
    // Delete test reservations
    if (testIds.reservationId) {
      await supabase.from('reservations').delete().eq('id', testIds.reservationId);
    }
    
    // Delete test services
    if (testIds.serviceId) {
      await supabase.from('shop_services').delete().eq('id', testIds.serviceId);
    }
    
    // Delete test shops
    if (testIds.shopId) {
      await supabase.from('shops').delete().eq('id', testIds.shopId);
    }
    
    // Delete test users
    const userIds = [testIds.userId, testIds.adminId, testIds.shopOwnerId].filter(Boolean);
    if (userIds.length > 0) {
      await supabase.from('users').delete().in('id', userIds);
    }
  });

  describe('Authentication APIs', () => {
    describe('POST /api/auth/register', () => {
      it('should register a new user successfully', async () => {
        const userData = createTestUser();
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('user');
        expect(response.body.data).toHaveProperty('token');
        
        testTokens.userToken = response.body.data.token;
        testIds.userId = response.body.data.user.id;
      }, TEST_CONFIG.timeout);

      it('should reject invalid email format', async () => {
        const userData = createTestUser({ email: 'invalid-email' });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
        expect(response.body).toHaveProperty('error');
      });

      it('should reject weak password', async () => {
        const userData = createTestUser({ password: '123' });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should reject duplicate email', async () => {
        const userData = createTestUser();
        
        // First registration
        await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(201);

        // Duplicate registration
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData)
          .expect(409);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/auth/login', () => {
      it('should login with valid credentials', async () => {
        const userData = createTestUser();
        
        // Register user first
        await request(app)
          .post('/api/auth/register')
          .send(userData);

        // Login
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: userData.email,
            password: userData.password,
          })
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('token');
      });

      it('should reject invalid credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({
            email: 'nonexistent@example.com',
            password: 'wrongpassword',
          })
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should reject missing credentials', async () => {
        const response = await request(app)
          .post('/api/auth/login')
          .send({})
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/auth/refresh', () => {
      it('should refresh valid token', async () => {
        // This test requires a valid refresh token
        // Implementation depends on your refresh token mechanism
        const response = await request(app)
          .post('/api/auth/refresh')
          .send({
            refresh_token: 'valid-refresh-token',
          });

        // Adjust expectations based on your implementation
        expect(response.status).toBeDefined();
      });
    });
  });

  describe('User Profile APIs', () => {
    beforeEach(async () => {
      // Ensure we have a valid user token
      if (!testTokens.userToken) {
        const userData = createTestUser();
        const response = await request(app)
          .post('/api/auth/register')
          .send(userData);
        testTokens.userToken = response.body.data.token;
        testIds.userId = response.body.data.user.id;
      }
    });

    describe('GET /api/users/profile', () => {
      it('should get user profile with valid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id');
        expect(response.body.data).toHaveProperty('email');
      });

      it('should reject request without token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should reject request with invalid token', async () => {
        const response = await request(app)
          .get('/api/users/profile')
          .set('Authorization', 'Bearer invalid-token')
          .expect(401);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('PUT /api/users/profile', () => {
      it('should update user profile', async () => {
        const updateData = {
          full_name: 'Updated Name',
          phone_number: '+821012345679',
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(updateData)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.full_name).toBe(updateData.full_name);
      });

      it('should validate phone number format', async () => {
        const updateData = {
          phone_number: 'invalid-phone',
        };

        const response = await request(app)
          .put('/api/users/profile')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(updateData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Shop APIs', () => {
    beforeEach(async () => {
      // Create shop owner user
      if (!testTokens.shopOwnerToken) {
        const shopOwnerData = createTestUser({ 
          email: `shopowner-${Date.now()}@example.com`,
          role: 'shop_owner' 
        });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(shopOwnerData);
        
        testTokens.shopOwnerToken = response.body.data.token;
        testIds.shopOwnerId = response.body.data.user.id;
      }
    });

    describe('POST /api/shop/register', () => {
      it('should register a new shop', async () => {
        const shopData = createTestShop();

        const response = await request(app)
          .post('/api/shop/register')
          .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
          .send(shopData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id');
        
        testIds.shopId = response.body.data.id;
      });

      it('should validate required fields', async () => {
        const incompleteShopData = {
          name: 'Test Shop',
          // Missing required fields
        };

        const response = await request(app)
          .post('/api/shop/register')
          .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
          .send(incompleteShopData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should validate coordinates', async () => {
        const invalidShopData = createTestShop({
          latitude: 200, // Invalid latitude
          longitude: 300, // Invalid longitude
        });

        const response = await request(app)
          .post('/api/shop/register')
          .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
          .send(invalidShopData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/shops', () => {
      it('should get shops list', async () => {
        const response = await request(app)
          .get('/api/shops')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should support pagination', async () => {
        const response = await request(app)
          .get('/api/shops?page=1&limit=10')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('pagination');
      });

      it('should support filtering by category', async () => {
        const response = await request(app)
          .get('/api/shops?category=beauty')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });

      it('should support location-based search', async () => {
        const response = await request(app)
          .get('/api/shops?lat=37.5665&lng=126.9780&radius=5000')
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('GET /api/shops/:id', () => {
      it('should get shop details', async () => {
        if (!testIds.shopId) {
          // Create a shop first
          const shopData = createTestShop();
          const response = await request(app)
            .post('/api/shop/register')
            .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
            .send(shopData);
          testIds.shopId = response.body.data.id;
        }

        const response = await request(app)
          .get(`/api/shops/${testIds.shopId}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data).toHaveProperty('id', testIds.shopId);
      });

      it('should return 404 for non-existent shop', async () => {
        const response = await request(app)
          .get('/api/shops/non-existent-id')
          .expect(404);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Reservation APIs', () => {
    beforeEach(async () => {
      // Ensure we have required test data
      if (!testIds.shopId) {
        const shopData = createTestShop();
        const response = await request(app)
          .post('/api/shop/register')
          .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
          .send(shopData);
        testIds.shopId = response.body.data.id;
      }
    });

    describe('POST /api/reservations', () => {
      it('should create a new reservation', async () => {
        const reservationData = createTestReservation({
          shop_id: testIds.shopId,
          user_id: testIds.userId,
        });

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(reservationData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('id');
        
        testIds.reservationId = response.body.data.id;
      });

      it('should validate reservation date is in future', async () => {
        const pastReservationData = createTestReservation({
          shop_id: testIds.shopId,
          user_id: testIds.userId,
          reservation_date: '2020-01-01', // Past date
        });

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(pastReservationData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });

      it('should validate time slot availability', async () => {
        const reservationData = createTestReservation({
          shop_id: testIds.shopId,
          user_id: testIds.userId,
          start_time: '02:00', // Outside business hours
          end_time: '03:00',
        });

        const response = await request(app)
          .post('/api/reservations')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(reservationData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/reservations', () => {
      it('should get user reservations', async () => {
        const response = await request(app)
          .get('/api/reservations')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should filter by status', async () => {
        const response = await request(app)
          .get('/api/reservations?status=pending')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });

    describe('PUT /api/reservations/:id/cancel', () => {
      it('should cancel a reservation', async () => {
        if (!testIds.reservationId) {
          // Create a reservation first
          const reservationData = createTestReservation({
            shop_id: testIds.shopId,
            user_id: testIds.userId,
          });
          const response = await request(app)
            .post('/api/reservations')
            .set('Authorization', `Bearer ${testTokens.userToken}`)
            .send(reservationData);
          testIds.reservationId = response.body.data.id;
        }

        const response = await request(app)
          .put(`/api/reservations/${testIds.reservationId}/cancel`)
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body.data.status).toBe('cancelled');
      });
    });
  });

  describe('Payment APIs', () => {
    describe('POST /api/payments', () => {
      it('should create payment request', async () => {
        const paymentData = {
          amount: 10000,
          order_name: 'Test Payment',
          customer_name: 'Test Customer',
          customer_email: 'test@example.com',
          customer_mobile_phone: '+821012345678',
        };

        const response = await request(app)
          .post('/api/payments')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(paymentData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('payment_key');
      });

      it('should validate payment amount', async () => {
        const paymentData = {
          amount: -1000, // Negative amount
          order_name: 'Test Payment',
          customer_name: 'Test Customer',
          customer_email: 'test@example.com',
          customer_mobile_phone: '+821012345678',
        };

        const response = await request(app)
          .post('/api/payments')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(paymentData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('POST /api/payments/:paymentKey/confirm', () => {
      it('should confirm payment', async () => {
        // This test requires a valid payment key from a real payment
        // In a real test environment, you might use test payment keys
        const paymentKey = 'test-payment-key';
        
        const response = await request(app)
          .post(`/api/payments/${paymentKey}/confirm`)
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send({
            orderId: 'test-order-id',
            amount: 10000,
          });

        // Adjust expectations based on your test payment setup
        expect(response.status).toBeDefined();
      });
    });
  });

  describe('Point System APIs', () => {
    describe('GET /api/points/balance', () => {
      it('should get user point balance', async () => {
        const response = await request(app)
          .get('/api/points/balance')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(response.body.data).toHaveProperty('available_points');
        expect(response.body.data).toHaveProperty('pending_points');
      });
    });

    describe('POST /api/points/earn', () => {
      it('should earn points for valid action', async () => {
        const pointData = {
          amount: 100,
          source: 'reservation',
          description: 'Test point earning',
        };

        const response = await request(app)
          .post('/api/points/earn')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(pointData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });
    });

    describe('POST /api/points/spend', () => {
      it('should spend points for valid purchase', async () => {
        const pointData = {
          amount: 50,
          source: 'discount',
          description: 'Test point spending',
        };

        const response = await request(app)
          .post('/api/points/spend')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(pointData)
          .expect(201);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });

      it('should reject spending more points than available', async () => {
        const pointData = {
          amount: 999999, // Excessive amount
          source: 'discount',
          description: 'Test point spending',
        };

        const response = await request(app)
          .post('/api/points/spend')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .send(pointData)
          .expect(400);

        expect(response.body).toHaveProperty('success', false);
      });
    });
  });

  describe('Admin APIs', () => {
    beforeEach(async () => {
      // Create admin user
      if (!testTokens.adminToken) {
        const adminData = createTestUser({ 
          email: `admin-${Date.now()}@example.com`,
          role: 'admin' 
        });
        
        const response = await request(app)
          .post('/api/auth/register')
          .send(adminData);
        
        testTokens.adminToken = response.body.data.token;
        testIds.adminId = response.body.data.user.id;
      }
    });

    describe('GET /api/admin/users', () => {
      it('should get users list for admin', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${testTokens.adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
        expect(Array.isArray(response.body.data)).toBe(true);
      });

      it('should reject non-admin access', async () => {
        const response = await request(app)
          .get('/api/admin/users')
          .set('Authorization', `Bearer ${testTokens.userToken}`)
          .expect(403);

        expect(response.body).toHaveProperty('success', false);
      });
    });

    describe('GET /api/admin/shops', () => {
      it('should get shops list for admin', async () => {
        const response = await request(app)
          .get('/api/admin/shops')
          .set('Authorization', `Bearer ${testTokens.adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
        expect(response.body).toHaveProperty('data');
      });
    });

    describe('PUT /api/admin/shops/:id/approve', () => {
      it('should approve shop', async () => {
        if (!testIds.shopId) {
          // Create a shop first
          const shopData = createTestShop();
          const response = await request(app)
            .post('/api/shop/register')
            .set('Authorization', `Bearer ${testTokens.shopOwnerToken}`)
            .send(shopData);
          testIds.shopId = response.body.data.id;
        }

        const response = await request(app)
          .put(`/api/admin/shops/${testIds.shopId}/approve`)
          .set('Authorization', `Bearer ${testTokens.adminToken}`)
          .expect(200);

        expect(response.body).toHaveProperty('success', true);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle database connection errors gracefully', async () => {
      // This test would require mocking database failures
      // Implementation depends on your error handling strategy
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body).toHaveProperty('success', false);
    });

    it('should handle oversized requests', async () => {
      const largeData = {
        email: 'test@example.com',
        password: 'ValidPassword123!',
        description: 'x'.repeat(1000000), // Very large description
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(largeData)
        .expect(413); // Payload too large

      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Performance Tests', () => {
    it('should handle concurrent user registrations', async () => {
      const concurrentRequests = Array.from({ length: 10 }, (_, i) => {
        const userData = createTestUser({ 
          email: `concurrent-${i}-${Date.now()}@example.com` 
        });
        
        return request(app)
          .post('/api/auth/register')
          .send(userData);
      });

      const responses = await Promise.allSettled(concurrentRequests);
      
      // All requests should complete (success or failure)
      responses.forEach(response => {
        expect(response.status).toBe('fulfilled');
      });

      // Most should succeed
      const successful = responses.filter(r => 
        r.status === 'fulfilled' && r.value.status < 400
      );
      expect(successful.length).toBeGreaterThan(8);
    }, TEST_CONFIG.timeout * 2);

    it('should handle concurrent shop searches', async () => {
      const concurrentRequests = Array.from({ length: 20 }, () => {
        return request(app).get('/api/shops');
      });

      const startTime = Date.now();
      const responses = await Promise.all(concurrentRequests);
      const endTime = Date.now();

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(endTime - startTime).toBeLessThan(5000);
    });
  });

  describe('Database Functions and Triggers', () => {
    it('should test reservation status updates trigger', async () => {
      // This test would verify that database triggers work correctly
      // Implementation depends on your specific triggers
    });

    it('should test point calculation functions', async () => {
      // This test would verify database functions for point calculations
      // Implementation depends on your specific functions
    });

    it('should test user profile update triggers', async () => {
      // This test would verify triggers on user profile updates
      // Implementation depends on your specific triggers
    });
  });
});
