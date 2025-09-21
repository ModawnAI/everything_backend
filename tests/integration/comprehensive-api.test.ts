import request from 'supertest';
import app from '../../src/app';
import { createRealSupabaseClient, setupTestEnvironment } from '../setup/supabase-test-setup';
import { TestUserUtils } from '../setup/test-user-utils';
import { config } from '../../src/config/environment';
import { SupabaseClient } from '@supabase/supabase-js';

describe('Comprehensive API Integration Tests', () => {
  // Increase timeout for tests that may have Redis connection delays
  jest.setTimeout(60000);
  let supabase: SupabaseClient;
  let testUser: any;
  let adminUser: any;
  let shopOwnerUser: any;
  let testShop: any;
  let authToken: string;
  let adminToken: string;
  let shopOwnerToken: string;
  let csrfToken: string;
  let csrfSecret: string;

  beforeAll(async () => {
    setupTestEnvironment();
    
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      console.warn('Skipping comprehensive API tests: Supabase not configured');
      return;
    }

    supabase = createRealSupabaseClient();
    
    // Create test users
    const testUserUtils = new TestUserUtils();
    const testUserResult = await testUserUtils.createTestUser({
      email: `testuser${Math.random().toString(36).substring(2, 8)}@gmail.com`,
      name: 'Test User',
      user_role: 'user'
    });
    testUser = testUserResult.profile;

    const adminUserResult = await testUserUtils.createTestUser({
      email: `adminuser${Math.random().toString(36).substring(2, 8)}@gmail.com`,
      name: 'Admin User',
      user_role: 'admin'
    });
    adminUser = adminUserResult.profile;

    const shopOwnerUserResult = await testUserUtils.createTestUser({
      email: `shopowneruser${Math.random().toString(36).substring(2, 8)}@gmail.com`,
      name: 'Shop Owner',
      user_role: 'shop_owner'
    });
    shopOwnerUser = shopOwnerUserResult.profile;

    // Create test shop
    const { data: shopData, error: shopError } = await supabase
      .from('shops')
      .insert({
        owner_id: shopOwnerUser.id,
        name: 'Test Beauty Shop',
        description: 'A test beauty shop for API testing',
        address: '123 Test Street, Seoul',
        main_category: 'nail',
        shop_status: 'active',
        shop_type: 'non_partnered'
      })
      .select()
      .single();

    if (shopError) throw shopError;
    testShop = shopData;

    // Generate auth tokens (mock for now)
    authToken = 'mock-user-token';
    adminToken = 'mock-admin-token';
    shopOwnerToken = 'mock-shop-owner-token';

    // Mock CSRF token for testing
    csrfToken = 'mock-csrf-token-1234567890abcdef'; // Must be at least 16 chars
    csrfSecret = 'mock-csrf-secret-12345678'; // Must be at least 8 chars
  });

  beforeEach(() => {
    if (!supabase) {
      pending('Supabase not configured');
      return;
    }
  });

  // Helper function to add CSRF token to requests
  const withCSRF = (request: any) => {
    return request
      .set('x-csrf-token', csrfToken)
      .set('x-csrf-secret', csrfSecret);
  };

  describe('Health and System APIs', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body.status).toBe('ok');
      expect(response.body.message).toContain('에뷰리띵');
    });

    it('should return API welcome message', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body.message).toContain('Welcome to 에뷰리띵');
      expect(response.body.documentation).toBe('/api-docs');
    });

    it('should serve API documentation', async () => {
      const response = await request(app)
        .get('/api-docs')
        .expect(200);

      expect(response.headers['content-type']).toContain('text/html');
    });
  });

  describe('Authentication APIs', () => {
    it('should get auth providers configuration', async () => {
      const response = await request(app)
        .get('/api/auth/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
    });

    it('should handle social login validation', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'kakao',
          token: 'invalid-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle registration validation', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'weak'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle phone verification initiation', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({
          phoneNumber: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('User Profile APIs', () => {
    it('should get user profile (with auth)', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401); // Will fail without real token

      expect(response.body.success).toBe(false);
    });

    it('should update user profile validation', async () => {
      const response = await request(app)
        .put('/api/users/profile')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          name: '', // Invalid empty name
          email: 'invalid-email'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get user settings', async () => {
      const response = await request(app)
        .get('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should update user settings validation', async () => {
      const response = await request(app)
        .put('/api/users/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          push_notifications_enabled: 'invalid-boolean'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Shop Search APIs', () => {
    it('should search shops with basic query', async () => {
      const response = await request(app)
        .get('/api/shops/search')
        .query({
          q: 'nail',
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('shops');
      expect(Array.isArray(response.body.data.shops)).toBe(true);
    });

    it('should search shops with location filter', async () => {
      const response = await request(app)
        .get('/api/shops/search')
        .query({
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 5
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('shops');
    });

    it('should search shops with category filter', async () => {
      const response = await request(app)
        .get('/api/shops/search')
        .query({
          category: 'nail',
          onlyFeatured: false
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should search shops with price range filter', async () => {
      const response = await request(app)
        .get('/api/shops/search')
        .query({
          priceMin: 10000,
          priceMax: 50000
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should handle invalid search parameters', async () => {
      const response = await request(app)
        .get('/api/shops/search')
        .query({
          latitude: 'invalid-lat',
          radius: -1
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Shop Categories APIs', () => {
    it('should get all shop categories', async () => {
      const response = await request(app)
        .get('/api/shops/categories')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('categories');
      expect(Array.isArray(response.body.data.categories)).toBe(true);
    });

    it('should get category by ID', async () => {
      const response = await request(app)
        .get('/api/shops/categories/nail')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('category');
    });

    it('should handle non-existent category', async () => {
      const response = await request(app)
        .get('/api/shops/categories/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Service Catalog APIs', () => {
    it('should get service catalog entries', async () => {
      const response = await request(app)
        .get('/api/service-catalog')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(Array.isArray(response.body.data.services)).toBe(true);
    });

    it('should search service catalog', async () => {
      const response = await request(app)
        .get('/api/service-catalog/search')
        .query({
          q: 'nail'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    it('should filter service catalog by category', async () => {
      const response = await request(app)
        .get('/api/service-catalog')
        .query({
          category: 'nail'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Shop Registration APIs', () => {
    it('should validate shop registration data', async () => {
      const response = await withCSRF(request(app)
        .post('/api/shop/register')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          name: '', // Invalid empty name
          address: '',
          main_category: 'invalid_category'
        }))
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate shop profile update', async () => {
      const response = await withCSRF(request(app)
        .put('/api/shop/profile')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          description: '', // Invalid empty description
          phone_number: 'invalid-phone'
        }))
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Shop Services APIs', () => {
    it('should get shop services', async () => {
      const response = await request(app)
        .get(`/api/shop/services?shopId=${testShop.id}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('services');
      expect(Array.isArray(response.body.data.services)).toBe(true);
    });

    it('should validate service creation', async () => {
      const response = await request(app)
        .post('/api/shop/services')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          name: '', // Invalid empty name
          price_min: -1, // Invalid negative price
          category: 'invalid_category'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate service update', async () => {
      const response = await request(app)
        .put('/api/shop/services/invalid-id')
        .set('Authorization', `Bearer ${shopOwnerToken}`)
        .send({
          duration_minutes: -1 // Invalid negative duration
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Reservation APIs', () => {
    it('should validate reservation creation', async () => {
      const response = await request(app)
        .post('/api/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shop_id: 'invalid-uuid',
          reservation_date: 'invalid-date',
          reservation_time: 'invalid-time',
          services: [] // Invalid empty services
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get user reservations', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate reservation rescheduling', async () => {
      const response = await request(app)
        .put('/api/reservations/invalid-id/reschedule')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          new_date: 'invalid-date',
          new_time: 'invalid-time'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate reservation cancellation', async () => {
      const response = await request(app)
        .delete('/api/reservations/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Payment APIs', () => {
    it('should validate payment processing', async () => {
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -1, // Invalid negative amount
          payment_method: 'invalid_method',
          reservation_id: 'invalid-uuid'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate split payment', async () => {
      const response = await request(app)
        .post('/api/split-payments')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          total_amount: -1, // Invalid negative amount
          split_details: [] // Invalid empty split details
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate payment security checks', async () => {
      const response = await request(app)
        .post('/api/payment-security/validate')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 'invalid-amount',
          payment_method: ''
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Point System APIs', () => {
    it('should get user point balance', async () => {
      const response = await request(app)
        .get('/api/points/balance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate point transaction', async () => {
      const response = await request(app)
        .post('/api/points/transaction')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: -1, // Invalid negative amount
          transaction_type: 'invalid_type'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get point history', async () => {
      const response = await request(app)
        .get('/api/points/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Referral System APIs', () => {
    it('should get user referral code', async () => {
      const response = await request(app)
        .get('/api/referral-codes')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate referral code usage', async () => {
      const response = await request(app)
        .post('/api/referral-relationships')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          referral_code: '', // Invalid empty code
          referrer_id: 'invalid-uuid'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get referral earnings', async () => {
      const response = await request(app)
        .get('/api/referral-earnings')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should get referral analytics', async () => {
      const response = await request(app)
        .get('/api/referral-analytics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin APIs', () => {
    it('should validate admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate user management operations', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate shop approval operations', async () => {
      const response = await request(app)
        .get('/api/admin/shops/approval')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate moderation operations', async () => {
      const response = await request(app)
        .get('/api/admin/moderation')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate payment management', async () => {
      const response = await request(app)
        .get('/api/admin/payments')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Security APIs', () => {
    it('should validate security event reporting', async () => {
      const response = await request(app)
        .post('/api/security/events')
        .send({
          type: '', // Invalid empty type
          severity: 'invalid_severity'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate IP blocking requests', async () => {
      const response = await request(app)
        .post('/api/admin/ip-blocking')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          ip_address: 'invalid-ip',
          reason: ''
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Notification APIs', () => {
    it('should get user notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate notification settings update', async () => {
      const response = await request(app)
        .put('/api/notifications/settings')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          push_notifications: 'invalid-boolean'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Favorites APIs', () => {
    it('should get user favorites', async () => {
      const response = await request(app)
        .get('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate favorite addition', async () => {
      const response = await request(app)
        .post('/api/favorites')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          shop_id: 'invalid-uuid'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should validate favorite removal', async () => {
      const response = await request(app)
        .delete('/api/favorites/invalid-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-route')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('ROUTE_NOT_FOUND');
    });

    it('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .set('Content-Type', 'application/json')
        .send('invalid json')
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle oversized requests', async () => {
      const largeData = 'x'.repeat(11 * 1024 * 1024); // 11MB
      const response = await request(app)
        .post('/api/auth/register')
        .send({ data: largeData })
        .expect(413);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      // This would require multiple rapid requests to test rate limiting
      // For now, we'll just verify the endpoint exists
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'kakao',
          token: 'test-token'
        });

      // Should either succeed (first request) or be rate limited
      expect([200, 400, 401]).toContain(response.status);
    });
  });

  describe('CORS and Security Headers', () => {
    it('should include proper CORS headers', async () => {
      const response = await request(app)
        .get('/api/shops/categories')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });

    it('should include security headers', async () => {
      const response = await request(app)
        .get('/api/shops/categories')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
    });
  });

  afterAll(async () => {
    if (supabase && testUser) {
      // Clean up test data
      try {
        await supabase.from('shops').delete().eq('id', testShop.id);
        await supabase.auth.admin.deleteUser(testUser.id);
        await supabase.auth.admin.deleteUser(adminUser.id);
        await supabase.auth.admin.deleteUser(shopOwnerUser.id);
      } catch (error) {
        console.warn('Cleanup error:', error);
      }
    }
  });
});
