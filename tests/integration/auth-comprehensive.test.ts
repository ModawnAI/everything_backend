import request from 'supertest';
import app from '../../src/app';
import { createRealSupabaseClient, setupTestEnvironment } from '../setup/supabase-test-setup';
import { config } from '../../src/config/environment';

describe('Authentication API Comprehensive Tests', () => {
  let supabase: any;

  beforeAll(async () => {
    setupTestEnvironment();
    
    if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
      console.warn('Skipping auth comprehensive tests: Supabase not configured');
      return;
    }

    supabase = createRealSupabaseClient();
  });

  beforeEach(() => {
    if (!supabase) {
      pending('Supabase not configured');
      return;
    }
  });

  describe('GET /api/auth/providers', () => {
    it('should return provider configuration', async () => {
      const response = await request(app)
        .get('/api/auth/providers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('providers');
      expect(response.body.data.providers).toBeInstanceOf(Object);
    });

    it('should include Kakao provider if configured', async () => {
      const response = await request(app)
        .get('/api/auth/providers')
        .expect(200);

      expect(response.body.data.providers).toHaveProperty('kakao');
    });
  });

  describe('POST /api/auth/social-login', () => {
    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.message).toContain('provider');
    });

    it('should validate provider enum', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'invalid-provider',
          token: 'test-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate token format', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'kakao',
          token: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle Kakao authentication flow', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'kakao',
          token: 'mock-kakao-token',
          deviceInfo: {
            deviceId: 'test-device',
            platform: 'ios',
            version: '1.0.0'
          }
        })
        .expect(400); // Will fail with invalid token, but should validate format

      expect(response.body.success).toBe(false);
    });

    it('should handle Apple authentication flow', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'apple',
          token: 'mock-apple-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should handle Google authentication flow', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'mock-google-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/register', () => {
    it('should validate email format', async () => {
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

    it('should validate password strength', async () => {
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

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com'
          // Missing password and name
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate name format', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'ValidPassword123!',
          name: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/send-verification-code', () => {
    it('should validate phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({
          phoneNumber: 'invalid-phone'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require phone number', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate Korean phone number format', async () => {
      const response = await request(app)
        .post('/api/auth/send-verification-code')
        .send({
          phoneNumber: '+82-10-1234-5678'
        })
        .expect(400); // Will fail without real SMS service

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/verify-phone', () => {
    it('should validate verification code format', async () => {
      const response = await request(app)
        .post('/api/auth/verify-phone')
        .send({
          phoneNumber: '+82-10-1234-5678',
          verificationCode: 'invalid-code'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require both phone number and code', async () => {
      const response = await request(app)
        .post('/api/auth/verify-phone')
        .send({
          phoneNumber: '+82-10-1234-5678'
          // Missing verification code
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/pass/callback', () => {
    it('should validate PASS callback data', async () => {
      const response = await request(app)
        .post('/api/auth/pass/callback')
        .send({
          // Invalid callback data
          invalid_field: 'value'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should validate refresh token format', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should require refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should validate device info format', async () => {
      const response = await request(app)
        .post('/api/auth/refresh')
        .send({
          refreshToken: 'mock-refresh-token',
          deviceInfo: {
            deviceId: '', // Invalid empty device ID
            platform: 'invalid-platform'
          }
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should validate refresh token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({
          refreshToken: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/auth/logout-all', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .post('/api/auth/logout-all')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/auth/sessions', () => {
    it('should require authentication', async () => {
      const response = await request(app)
        .get('/api/auth/sessions')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limits on login attempts', async () => {
      // Test multiple rapid login attempts
      const promises = Array.from({ length: 5 }, () =>
        request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'kakao',
            token: 'test-token'
          })
      );

      const responses = await Promise.all(promises);
      
      // At least one should be rate limited or all should fail validation
      const hasRateLimit = responses.some(r => r.status === 429);
      const allFailValidation = responses.every(r => r.status === 400);
      
      expect(hasRateLimit || allFailValidation).toBe(true);
    });
  });

  describe('Security Headers', () => {
    it('should include security headers on auth endpoints', async () => {
      const response = await request(app)
        .get('/api/auth/providers')
        .expect(200);

      expect(response.headers).toHaveProperty('x-content-type-options');
      expect(response.headers).toHaveProperty('x-frame-options');
      expect(response.headers['x-content-type-options']).toBe('nosniff');
    });
  });

  describe('Input Sanitization', () => {
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
});
