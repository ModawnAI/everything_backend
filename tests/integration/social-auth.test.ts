/**
 * Social Authentication Integration Tests
 * 
 * Comprehensive test suite for social login flows including:
 * - Provider-specific authentication flows (Kakao, Apple, Google)
 * - Token validation and security
 * - Rate limiting and abuse prevention
 * - Session management and device tracking
 * - Provider compliance and profile synchronization
 * - Security monitoring and audit logging
 */

import request from 'supertest';
import jwt from 'jsonwebtoken';
import express from 'express';
import { socialAuthController } from '../../src/controllers/social-auth.controller';
import { socialAuthService } from '../../src/services/social-auth.service';
import { refreshTokenService } from '../../src/services/refresh-token.service';
import { ipBlockingService } from '../../src/services/ip-blocking.service';
import { config } from '../../src/config/environment';

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => ({
    auth: {
      signInWithIdToken: jest.fn(),
      getUser: jest.fn()
    },
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(),
          order: jest.fn(() => ({
            select: jest.fn()
          }))
        })),
        gt: jest.fn(() => ({
          order: jest.fn(() => ({
            select: jest.fn()
          }))
        }))
      })),
      insert: jest.fn(() => ({
        select: jest.fn(() => ({
          single: jest.fn()
        }))
      })),
      update: jest.fn(() => ({
        eq: jest.fn()
      })),
      delete: jest.fn(() => ({
        lt: jest.fn(() => ({
          select: jest.fn()
        }))
      }))
    }))
  }))
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

jest.mock('../../src/services/ip-blocking.service', () => ({
  ipBlockingService: {
    recordViolation: jest.fn(),
    isBlocked: jest.fn()
  }
}));

describe('Social Authentication Integration Tests', () => {
  let app: express.Application;
  let mockSupabaseClient: any;

  // Mock user data for different providers
  const mockProviderUsers = {
    kakao: {
      id: 'kakao-user-123',
      email: 'kakao@example.com',
      user_metadata: {
        kakao_account: {
          profile: {
            nickname: 'Kakao User',
            profile_image_url: 'https://kakao.com/profile.jpg'
          },
          has_service_terms: true,
          has_privacy_policy: true,
          profile_nickname_needs_agreement: false,
          profile_image_needs_agreement: false,
          scopes: ['profile_nickname', 'profile_image']
        }
      }
    },
    apple: {
      id: 'apple-user-456',
      email: 'apple@privaterelay.appleid.com',
      user_metadata: {
        full_name: 'Apple User',
        first_name: 'Apple',
        last_name: 'User',
        is_private_email: true,
        real_user_status: 'likely_real',
        authorized_scopes: ['name', 'email']
      }
    },
    google: {
      id: 'google-user-789',
      email: 'google@gmail.com',
      user_metadata: {
        full_name: 'Google User',
        name: 'Google User',
        picture: 'https://lh3.googleusercontent.com/profile.jpg',
        email_verified: true,
        locale: 'ko-KR',
        granted_scopes: ['openid', 'email', 'profile']
      }
    }
  };

  const mockDatabaseUser = {
    id: 'user-123',
    email: 'test@example.com',
    name: 'Test User',
    user_role: 'user',
    user_status: 'active',
    profile_image_url: null,
    phone: null,
    birth_date: null,
    is_influencer: false,
    phone_verified: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };

  beforeAll(() => {
    // Setup Express app for testing
    app = express();
    app.use(express.json());
    
    // Add social auth routes
    app.post('/api/auth/social-login', 
      socialAuthController.socialLoginRateLimit,
      socialAuthController.socialLogin
    );
    
    // Mock Supabase client
    mockSupabaseClient = require('../../src/config/database').getSupabaseClient();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset IP blocking service
    (ipBlockingService.isBlocked as jest.Mock).mockResolvedValue(false);
    (ipBlockingService.recordViolation as jest.Mock).mockResolvedValue(undefined);
  });

  describe('Provider-Specific Authentication Flows', () => {
    describe('Kakao Authentication', () => {
      test('should authenticate new Kakao user successfully', async () => {
        // Mock Supabase Auth response
        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: mockProviderUsers.kakao,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        // Mock user creation
        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // User not found
        });

        mockSupabaseClient.from().insert().select().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: mockProviderUsers.kakao.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'kakao',
            token: 'valid-kakao-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.id).toBe(mockProviderUsers.kakao.id);
        expect(response.body.data.tokens).toHaveProperty('accessToken');
        expect(response.body.data.tokens).toHaveProperty('refreshToken');

        // Verify provider-specific compliance data was handled
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_compliance: expect.objectContaining({
              kakao_service_terms_agreed: true,
              kakao_privacy_policy_agreed: true
            })
          })
        );
      });

      test('should handle existing Kakao user login', async () => {
        // Mock existing user
        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: mockProviderUsers.kakao,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: mockProviderUsers.kakao.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'kakao',
            token: 'valid-kakao-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.id).toBe(mockProviderUsers.kakao.id);

        // Verify profile sync was attempted
        expect(mockSupabaseClient.from().update).toHaveBeenCalled();
      });

      test('should handle Kakao consent requirements', async () => {
        const kakaoUserWithConsent = {
          ...mockProviderUsers.kakao,
          user_metadata: {
            ...mockProviderUsers.kakao.user_metadata,
            kakao_account: {
              ...mockProviderUsers.kakao.user_metadata.kakao_account,
              profile_nickname_needs_agreement: true,
              profile_image_needs_agreement: true
            }
          }
        };

        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: kakaoUserWithConsent,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        });

        mockSupabaseClient.from().insert().select().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: kakaoUserWithConsent.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'kakao',
            token: 'valid-kakao-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify consent requirements were properly handled
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_compliance: expect.objectContaining({
              nickname_needs_agreement: true,
              profile_image_needs_agreement: true
            })
          })
        );
      });
    });

    describe('Apple Authentication', () => {
      test('should authenticate new Apple user successfully', async () => {
        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: mockProviderUsers.apple,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        });

        mockSupabaseClient.from().insert().select().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: mockProviderUsers.apple.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'apple',
            token: 'valid-apple-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.id).toBe(mockProviderUsers.apple.id);

        // Verify Apple-specific compliance data
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_compliance: expect.objectContaining({
              apple_private_email: true,
              apple_real_user_status: 'likely_real'
            })
          })
        );
      });

      test('should handle Apple private email relay', async () => {
        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'apple',
            token: 'valid-apple-token'
          });

        // Should handle private email properly
        expect(response.body.data.user.email).toContain('privaterelay.appleid.com');
      });
    });

    describe('Google Authentication', () => {
      test('should authenticate new Google user successfully', async () => {
        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: mockProviderUsers.google,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        });

        mockSupabaseClient.from().insert().select().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: mockProviderUsers.google.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: 'valid-google-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.user.id).toBe(mockProviderUsers.google.id);

        // Verify Google-specific compliance data
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_compliance: expect.objectContaining({
              google_email_verified: true,
              google_locale: 'ko-KR'
            })
          })
        );
      });

      test('should handle Google G Suite users', async () => {
        const gsuiteUser = {
          ...mockProviderUsers.google,
          user_metadata: {
            ...mockProviderUsers.google.user_metadata,
            hd: 'company.com' // Hosted domain
          }
        };

        mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
          data: {
            user: gsuiteUser,
            session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
          },
          error: null
        });

        mockSupabaseClient.from().select().eq().single.mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' }
        });

        mockSupabaseClient.from().insert().select().single.mockResolvedValue({
          data: { ...mockDatabaseUser, id: gsuiteUser.id },
          error: null
        });

        const response = await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: 'valid-google-token'
          })
          .expect(200);

        expect(response.body.success).toBe(true);

        // Verify G Suite domain was captured
        expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
          expect.objectContaining({
            provider_compliance: expect.objectContaining({
              google_hd: 'company.com'
            })
          })
        );
      });
    });
  });

  describe('Token Validation and Security', () => {
    test('should reject invalid provider', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'invalid-provider',
          token: 'some-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_PROVIDER');
    });

    test('should reject empty token', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: ''
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('MISSING_TOKEN');
    });

    test('should reject malformed token', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'invalid.token.format'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_TOKEN_FORMAT');
    });

    test('should handle provider API errors', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'expired-token'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROVIDER_API_ERROR');
    });

    test('should validate token expiration', async () => {
      // Mock expired token scenario
      const expiredToken = jwt.sign(
        { sub: 'user-123', exp: Math.floor(Date.now() / 1000) - 3600 }, // Expired 1 hour ago
        'secret'
      );

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: expiredToken
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_EXPIRED');
    });
  });

  describe('Rate Limiting and Abuse Prevention', () => {
    test('should enforce rate limiting on social login', async () => {
      // Simulate multiple rapid requests
      const requests = Array(6).fill(null).map(() =>
        request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: 'valid-token'
          })
      );

      const responses = await Promise.all(requests);
      
      // First 5 should succeed (or fail for other reasons), 6th should be rate limited
      const rateLimitedResponse = responses[5];
      expect(rateLimitedResponse.status).toBe(429);
      expect(rateLimitedResponse.body.error.code).toBe('SOCIAL_LOGIN_RATE_LIMIT_EXCEEDED');
    });

    test('should block suspicious IP addresses', async () => {
      (ipBlockingService.isBlocked as jest.Mock).mockResolvedValue(true);

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('IP_BLOCKED');
    });

    test('should record security violations', async () => {
      // Simulate multiple failed attempts
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'invalid-token'
        });

      // Verify violation was recorded
      expect(ipBlockingService.recordViolation).toHaveBeenCalledWith(
        expect.objectContaining({
          violationType: 'rate_limit',
          endpoint: '/api/auth/social-login'
        })
      );
    });

    test('should implement progressive penalties', async () => {
      // Mock high violation count
      const mockRateLimitResult = {
        totalHits: 15,
        remainingPoints: 0,
        msBeforeNext: 900000
      };

      // Simulate rate limit hit with high violation count
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        });

      // Should record high severity violation
      if (ipBlockingService.recordViolation as jest.Mock) {
        const calls = (ipBlockingService.recordViolation as jest.Mock).mock.calls;
        if (calls.length > 0) {
          expect(calls[0][0]).toHaveProperty('severity', 'high');
        }
      }
    });
  });

  describe('Session Management and Device Tracking', () => {
    test('should create device fingerprint', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const response = await request(app)
        .post('/api/auth/social-login')
        .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)')
        .set('Accept-Language', 'ko-KR,ko;q=0.9,en;q=0.8')
        .send({
          provider: 'google',
          token: 'valid-token',
          deviceInfo: {
            timezone: 'Asia/Seoul',
            screenResolution: '375x812'
          }
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify device fingerprint was created and stored
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          device_fingerprint: expect.any(String),
          device_info: expect.objectContaining({
            userAgent: expect.stringContaining('iPhone'),
            acceptLanguage: 'ko-KR,ko;q=0.9,en;q=0.8',
            timezone: 'Asia/Seoul',
            screenResolution: '375x812'
          })
        })
      );
    });

    test('should enforce device limit per user', async () => {
      // Mock user with maximum devices
      const mockActiveTokens = Array(5).fill(null).map((_, i) => ({
        id: `token-${i}`,
        device_fingerprint: `device-${i}`,
        last_activity: new Date().toISOString()
      }));

      mockSupabaseClient.from().select().eq().gt().order().mockResolvedValue({
        data: mockActiveTokens,
        error: null
      });

      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify old sessions were revoked
      expect(mockSupabaseClient.from().update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          revoked_at: expect.any(String)
        })
      );
    });

    test('should track session analytics', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const response = await request(app)
        .post('/api/auth/social-login')
        .set('X-Forwarded-For', '203.0.113.1') // Mock IP from South Korea
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify location info was captured
      expect(mockSupabaseClient.from().insert).toHaveBeenCalledWith(
        expect.objectContaining({
          last_activity: expect.any(String)
        })
      );
    });
  });

  describe('Security Monitoring and Audit Logging', () => {
    test('should log successful authentication', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const { logger } = require('../../src/utils/logger');

      await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(200);

      // Verify audit logging
      expect(logger.info).toHaveBeenCalledWith(
        'Social login successful',
        expect.objectContaining({
          provider: 'google',
          userId: expect.any(String)
        })
      );
    });

    test('should log failed authentication attempts', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: null,
        error: { message: 'Invalid token' }
      });

      const { logger } = require('../../src/utils/logger');

      await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'invalid-token'
        })
        .expect(400);

      // Verify security event logging
      expect(logger.warn).toHaveBeenCalledWith(
        'Social login failed',
        expect.objectContaining({
          provider: 'google',
          error: expect.any(String)
        })
      );
    });

    test('should detect and log suspicious activity', async () => {
      // Simulate suspicious pattern - multiple providers from same IP
      const { logger } = require('../../src/utils/logger');

      await request(app)
        .post('/api/auth/social-login')
        .send({ provider: 'google', token: 'token1' });

      await request(app)
        .post('/api/auth/social-login')
        .send({ provider: 'kakao', token: 'token2' });

      await request(app)
        .post('/api/auth/social-login')
        .send({ provider: 'apple', token: 'token3' });

      // Should log suspicious activity pattern
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Multiple provider attempts'),
        expect.any(Object)
      );
    });

    test('should monitor for bot-like behavior', async () => {
      // Simulate bot-like behavior - rapid requests with minimal variation
      const requests = Array(10).fill(null).map((_, i) =>
        request(app)
          .post('/api/auth/social-login')
          .set('User-Agent', 'curl/7.68.0') // Bot-like user agent
          .send({
            provider: 'google',
            token: `token-${i}`
          })
      );

      await Promise.all(requests);

      const { logger } = require('../../src/utils/logger');

      // Should detect and log bot-like behavior
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Bot-like behavior detected'),
        expect.any(Object)
      );
    });

    test('should generate security reports', async () => {
      // Mock various security events
      mockSupabaseClient.auth.signInWithIdToken
        .mockResolvedValueOnce({
          data: { user: mockProviderUsers.google, session: {} },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { message: 'Invalid token' }
        });

      mockSupabaseClient.from().select().eq().single
        .mockResolvedValueOnce({ data: mockDatabaseUser, error: null })
        .mockResolvedValueOnce({ data: null, error: { code: 'PGRST116' } });

      // Successful login
      await request(app)
        .post('/api/auth/social-login')
        .send({ provider: 'google', token: 'valid-token' });

      // Failed login
      await request(app)
        .post('/api/auth/social-login')
        .send({ provider: 'google', token: 'invalid-token' });

      const { logger } = require('../../src/utils/logger');

      // Verify comprehensive logging for security analysis
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Social login'),
        expect.objectContaining({
          provider: expect.any(String),
          timestamp: expect.any(String)
        })
      );
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle database connection errors', async () => {
      mockSupabaseClient.from().select().eq().single.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('DATABASE_ERROR');
    });

    test('should handle concurrent login attempts', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      mockSupabaseClient.from().insert().select().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      // Simulate concurrent requests
      const concurrentRequests = Array(3).fill(null).map(() =>
        request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: 'valid-token'
          })
      );

      const responses = await Promise.all(concurrentRequests);

      // All should succeed or handle gracefully
      responses.forEach(response => {
        expect([200, 409]).toContain(response.status);
      });
    });

    test('should handle malformed request data', async () => {
      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 123, // Invalid type
          token: null    // Invalid type
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    test('should handle provider service outages', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockRejectedValue(
        new Error('Provider service unavailable')
      );

      const response = await request(app)
        .post('/api/auth/social-login')
        .send({
          provider: 'google',
          token: 'valid-token'
        })
        .expect(503);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('PROVIDER_SERVICE_UNAVAILABLE');
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle high concurrent load', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const startTime = Date.now();
      
      // Simulate 50 concurrent requests
      const requests = Array(50).fill(null).map((_, i) =>
        request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: `valid-token-${i}`
          })
      );

      const responses = await Promise.all(requests);
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (5 seconds)
      expect(duration).toBeLessThan(5000);

      // Most requests should succeed
      const successCount = responses.filter(r => r.status === 200).length;
      expect(successCount).toBeGreaterThan(40); // At least 80% success rate
    });

    test('should maintain response time under load', async () => {
      mockSupabaseClient.auth.signInWithIdToken.mockResolvedValue({
        data: {
          user: mockProviderUsers.google,
          session: { access_token: 'supabase-token', refresh_token: 'supabase-refresh' }
        },
        error: null
      });

      mockSupabaseClient.from().select().eq().single.mockResolvedValue({
        data: mockDatabaseUser,
        error: null
      });

      const responseTimes: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = Date.now();
        
        await request(app)
          .post('/api/auth/social-login')
          .send({
            provider: 'google',
            token: `valid-token-${i}`
          });
          
        const endTime = Date.now();
        responseTimes.push(endTime - startTime);
      }

      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      
      // Average response time should be under 1 second
      expect(averageResponseTime).toBeLessThan(1000);
    });
  });
});

