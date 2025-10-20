/**
 * Unified Authentication Integration Tests
 * Tests the complete authentication flow with real database operations
 */

import request from 'supertest';
import { app } from '../../src/app';
import { UnifiedAuthService } from '../../src/services/unified-auth.service';
import { SessionRepository, LoginAttemptRepository, AccountSecurityRepository } from '../../src/repositories';
import { getSupabaseClient } from '../../src/config/database';

describe('Unified Authentication Integration Tests', () => {
  let authService: UnifiedAuthService;
  let sessionRepo: SessionRepository;
  let loginAttemptRepo: LoginAttemptRepository;
  let accountSecurityRepo: AccountSecurityRepository;
  let supabase: any;

  // Test user data
  const testAdmin = {
    email: 'admin@test.com',
    password: 'TestPassword123!',
    role: 'admin' as const
  };

  const testShopOwner = {
    email: 'shopowner@test.com',
    password: 'TestPassword123!',
    role: 'shop_owner' as const
  };

  const testCustomer = {
    email: 'customer@test.com',
    password: 'TestPassword123!',
    role: 'customer' as const
  };

  beforeAll(async () => {
    authService = new UnifiedAuthService();
    sessionRepo = new SessionRepository();
    loginAttemptRepo = new LoginAttemptRepository();
    accountSecurityRepo = new AccountSecurityRepository();
    supabase = getSupabaseClient();

    // Create test users in Supabase Auth and users table
    await createTestUser(testAdmin);
    await createTestUser(testShopOwner);
    await createTestUser(testCustomer);
  });

  afterAll(async () => {
    // Cleanup test users
    await cleanupTestUser(testAdmin.email);
    await cleanupTestUser(testShopOwner.email);
    await cleanupTestUser(testCustomer.email);
  });

  describe('POST /api/v2/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('refreshToken');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.email).toBe(testCustomer.email);
      expect(response.body.data.user.role).toBe(testCustomer.role);
    });

    it('should fail with invalid password', async () => {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: 'WrongPassword123!',
          role: testCustomer.role
        })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('LOGIN_FAILED');
    });

    it('should fail with invalid role', async () => {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: 'invalid_role'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_ROLE');
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email
          // Missing password and role
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should lock account after 5 failed attempts', async () => {
      const testEmail = 'locktest@test.com';
      const testPassword = 'TestPassword123!';

      // Create test user
      const userId = await createTestUser({
        email: testEmail,
        password: testPassword,
        role: 'customer'
      });

      // Make 5 failed login attempts
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/v2/auth/login')
          .send({
            email: testEmail,
            password: 'WrongPassword',
            role: 'customer'
          })
          .expect(401);
      }

      // 6th attempt should be blocked
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testEmail,
          password: testPassword,
          role: 'customer'
        })
        .expect(401);

      expect(response.body.error.message).toContain('locked');

      // Cleanup
      await cleanupTestUser(testEmail);
    });

    it('should record login attempt for successful login', async () => {
      // Login
      await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        })
        .expect(200);

      // Check login attempts were recorded
      const user = await getUserByEmail(testCustomer.email);
      const attempts = await loginAttemptRepo.getRecentAttempts(
        testCustomer.email,
        testCustomer.role,
        5
      );

      expect(attempts.length).toBeGreaterThan(0);
      const successAttempt = attempts.find(a => a.attempt_result === 'success');
      expect(successAttempt).toBeDefined();
    });
  });

  describe('POST /api/v2/auth/logout', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        });

      accessToken = response.body.data.accessToken;
    });

    it('should logout successfully', async () => {
      const response = await request(app)
        .post('/api/v2/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('Logged out');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .post('/api/v2/auth/logout')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });

    it('should invalidate session after logout', async () => {
      // Logout
      await request(app)
        .post('/api/v2/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      // Try to use token after logout
      const response = await request(app)
        .get('/api/v2/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v2/auth/refresh', () => {
    let refreshToken: string;

    beforeEach(async () => {
      // Login to get refresh token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        });

      refreshToken = response.body.data.refreshToken;
    });

    it('should refresh token successfully', async () => {
      const response = await request(app)
        .post('/api/v2/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('expiresIn');
    });

    it('should fail with invalid refresh token', async () => {
      const response = await request(app)
        .post('/api/v2/auth/refresh')
        .send({ refreshToken: 'invalid_token' })
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('TOKEN_REFRESH_FAILED');
    });

    it('should fail without refresh token', async () => {
      const response = await request(app)
        .post('/api/v2/auth/refresh')
        .send({})
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v2/auth/validate', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        });

      accessToken = response.body.data.accessToken;
    });

    it('should validate active session', async () => {
      const response = await request(app)
        .get('/api/v2/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.isValid).toBe(true);
      expect(response.body.data).toHaveProperty('userId');
      expect(response.body.data).toHaveProperty('role');
    });

    it('should fail without token', async () => {
      const response = await request(app)
        .get('/api/v2/auth/validate')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('GET /api/v2/auth/sessions', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role,
          device_id: 'test-device',
          device_name: 'Test Device'
        });

      accessToken = response.body.data.accessToken;
    });

    it('should get active sessions', async () => {
      const response = await request(app)
        .get('/api/v2/auth/sessions')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sessions).toBeInstanceOf(Array);
      expect(response.body.data.sessions.length).toBeGreaterThan(0);
    });

    it('should fail without authentication', async () => {
      const response = await request(app)
        .get('/api/v2/auth/sessions')
        .expect(401);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/v2/auth/logout-all', () => {
    let accessToken1: string;
    let accessToken2: string;

    beforeEach(async () => {
      // Create multiple sessions
      const response1 = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role,
          device_id: 'device-1'
        });

      const response2 = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role,
          device_id: 'device-2'
        });

      accessToken1 = response1.body.data.accessToken;
      accessToken2 = response2.body.data.accessToken;
    });

    it('should logout from all devices', async () => {
      const response = await request(app)
        .post('/api/v2/auth/logout-all')
        .set('Authorization', `Bearer ${accessToken1}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.count).toBeGreaterThanOrEqual(2);

      // Both tokens should be invalid now
      await request(app)
        .get('/api/v2/auth/validate')
        .set('Authorization', `Bearer ${accessToken1}`)
        .expect(401);

      await request(app)
        .get('/api/v2/auth/validate')
        .set('Authorization', `Bearer ${accessToken2}`)
        .expect(401);
    });
  });

  describe('POST /api/v2/auth/change-password', () => {
    let accessToken: string;
    const testUser = {
      email: 'pwchange@test.com',
      password: 'OldPassword123!',
      role: 'customer' as const
    };

    beforeAll(async () => {
      await createTestUser(testUser);
    });

    afterAll(async () => {
      await cleanupTestUser(testUser.email);
    });

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
          role: testUser.role
        });

      accessToken = response.body.data.accessToken;
    });

    it('should change password successfully', async () => {
      const response = await request(app)
        .post('/api/v2/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'NewPassword123!'
        })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Old token should be invalid
      await request(app)
        .get('/api/v2/auth/validate')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(401);

      // Should be able to login with new password
      const loginResponse = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testUser.email,
          password: 'NewPassword123!',
          role: testUser.role
        })
        .expect(200);

      expect(loginResponse.body.success).toBe(true);

      // Reset password for future tests
      testUser.password = 'NewPassword123!';
    });

    it('should fail with wrong current password', async () => {
      const response = await request(app)
        .post('/api/v2/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: 'WrongPassword',
          newPassword: 'NewPassword123!'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });

    it('should fail with weak new password', async () => {
      const response = await request(app)
        .post('/api/v2/auth/change-password')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({
          currentPassword: testUser.password,
          newPassword: 'weak'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('WEAK_PASSWORD');
    });
  });

  describe('GET /api/v2/auth/login-statistics', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        });

      accessToken = response.body.data.accessToken;
    });

    it('should get login statistics', async () => {
      const response = await request(app)
        .get('/api/v2/auth/login-statistics')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('totalAttempts');
      expect(response.body.data).toHaveProperty('successfulLogins');
      expect(response.body.data).toHaveProperty('failedAttempts');
    });
  });

  describe('GET /api/v2/auth/security-logs', () => {
    let accessToken: string;

    beforeEach(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/v2/auth/login')
        .send({
          email: testCustomer.email,
          password: testCustomer.password,
          role: testCustomer.role
        });

      accessToken = response.body.data.accessToken;
    });

    it('should get security logs', async () => {
      const response = await request(app)
        .get('/api/v2/auth/security-logs')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs).toBeInstanceOf(Array);
    });

    it('should respect limit parameter', async () => {
      const response = await request(app)
        .get('/api/v2/auth/security-logs?limit=5')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.logs.length).toBeLessThanOrEqual(5);
    });
  });

  // Helper functions
  async function createTestUser(userData: { email: string; password: string; role: string }): Promise<string> {
    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: userData.email,
      password: userData.password,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // Map role to database format
    const dbRole = userData.role === 'customer' ? 'user' : userData.role;

    // Create user in users table
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: authData.user.id,
        email: userData.email,
        name: `Test ${userData.role}`,
        user_role: dbRole,
        user_status: 'active'
      });

    if (userError) {
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    return authData.user.id;
  }

  async function cleanupTestUser(email: string): Promise<void> {
    // Get user by email
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();

    if (user) {
      // Delete from users table
      await supabase.from('users').delete().eq('id', user.id);

      // Delete from auth
      await supabase.auth.admin.deleteUser(user.id);
    }
  }

  async function getUserByEmail(email: string): Promise<any> {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('email', email)
      .single();

    return data;
  }
});
