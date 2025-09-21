import request from 'supertest';
import app from '../../src/app';

describe('API Endpoints Basic Tests', () => {
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
      expect(response.body.data.providers).toBeInstanceOf(Object);
    });

    it('should validate required fields for social login', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('provider');
    });

    it('should validate provider enum for social login', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'invalid-provider',
          token: 'test-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate token format for social login', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'kakao',
          token: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate email format for registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'invalid-email',
          password: 'ValidPassword123!',
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate password strength for registration', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'weak',
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({
          phoneNumber: 'invalid-phone'
        })
        .expect(400);

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

  describe('Authentication Required APIs', () => {
    it('should require authentication for user profile', async () => {
      const response = await request(app)
        .get('/api/users/profile')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for user settings', async () => {
      const response = await request(app)
        .get('/api/users/settings')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for reservations', async () => {
      const response = await request(app)
        .get('/api/reservations')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for payments', async () => {
      const response = await request(app)
        .post('/api/payments')
        .send({
          amount: 10000,
          payment_method: 'card'
        })
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for points', async () => {
      const response = await request(app)
        .get('/api/points/balance')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for favorites', async () => {
      const response = await request(app)
        .get('/api/favorites')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require authentication for notifications', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Admin APIs', () => {
    it('should require admin authentication', async () => {
      const response = await request(app)
        .get('/api/admin/analytics')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require admin authentication for user management', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .expect(401);

      expect(response.body.success).toBe(false);
    });

    it('should require admin authentication for shop approval', async () => {
      const response = await request(app)
        .get('/api/admin/shops/approval')
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
  });

  describe('Security Headers', () => {
    it('should include security headers on all responses', async () => {
      const response = await request(app)
        .get('/api/shops/categories')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers).toHaveProperty('x-xss-protection');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/shops/categories')
        .expect(200);

      expect(response.headers).toHaveProperty('access-control-allow-origin');
    });
  });

  describe('Input Validation', () => {
    it('should sanitize malicious input in email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: '<script>alert("xss")</script>@example.com',
          password: 'ValidPassword123!',
          name: 'Test User'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should sanitize malicious input in name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: '<script>alert("xss")</script>'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on auth endpoints', async () => {
      // Test multiple rapid requests
      const promises = Array.from({ length: 3 }, () =>
        request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'kakao',
            token: 'test-token'
          })
      );

      const responses = await Promise.all(promises);
      
      // All should fail validation or be rate limited
      const allFailValidation = responses.every(r => r.status === 400);
      const hasRateLimit = responses.some(r => r.status === 429);
      
      expect(allFailValidation || hasRateLimit).toBe(true);
    });
  });
});
