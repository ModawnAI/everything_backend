/**
 * Session Repository Integration Tests
 */

import { SessionRepository } from '../../src/repositories/session.repository';
import { CreateSessionInput, UserRole } from '../../src/types/unified-auth.types';
import { getSupabaseClient } from '../../src/config/database';
import { v4 as uuidv4 } from 'uuid';

describe('SessionRepository', () => {
  let sessionRepo: SessionRepository;
  let supabase: any;
  let testUserId: string;
  const testEmail = `session-test-${Date.now()}@example.com`;
  const testPassword = 'TestPassword123!';

  beforeAll(async () => {
    sessionRepo = new SessionRepository();
    supabase = getSupabaseClient();

    // Generate a test user ID
    testUserId = uuidv4();
    console.log('Creating test user with ID:', testUserId, 'and email:', testEmail);

    // Create user directly in users table (bypassing Supabase Auth for testing)
    const { error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: testEmail,
        name: 'Test User',
        user_role: 'user',
        user_status: 'active'
      });

    if (userError) {
      console.error('User creation error:', JSON.stringify(userError, null, 2));
      throw new Error(`Failed to create user record: ${userError.message}`);
    }

    console.log('Test user created successfully');
  });

  afterAll(async () => {
    // Cleanup: Delete all sessions for test user
    await supabase
      .from('sessions')
      .delete()
      .eq('user_id', testUserId);

    // Cleanup: Delete user from users table
    await supabase
      .from('users')
      .delete()
      .eq('id', testUserId);

    console.log('Test cleanup completed');
  });
  const testToken = 'test_access_token_' + Date.now();
  const testRefreshToken = 'test_refresh_token_' + Date.now();

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1',
        user_agent: 'Test User Agent',
        device_id: 'test-device-1',
        device_name: 'Test Device'
      };

      const session = await sessionRepo.createSession(
        sessionInput,
        testToken,
        testRefreshToken
      );

      expect(session).toBeDefined();
      expect(session.user_id).toBe(testUserId);
      expect(session.token).toBe(testToken);
      expect(session.refresh_token).toBe(testRefreshToken);
      expect(session.is_active).toBe(true);
      expect(session.user_role).toBe('customer');
    });

    it('should set expiration times correctly', async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'admin',
        ip_address: '127.0.0.1'
      };

      const session = await sessionRepo.createSession(
        sessionInput,
        testToken + '_exp',
        testRefreshToken + '_exp'
      );

      const now = new Date();
      const expiresAt = new Date(session.expires_at);
      const refreshExpiresAt = new Date(session.refresh_expires_at!);

      // Access token should expire in ~24 hours
      const hoursDiff = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);

      // Refresh token should expire in ~7 days
      const daysDiff = (refreshExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6);
      expect(daysDiff).toBeLessThan(8);
    });
  });

  describe('findByToken', () => {
    let createdSession: any;

    beforeAll(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      createdSession = await sessionRepo.createSession(
        sessionInput,
        'find_by_token_test',
        'refresh_token_test'
      );
    });

    it('should find session by token', async () => {
      const session = await sessionRepo.findByToken('find_by_token_test');

      expect(session).toBeDefined();
      expect(session?.id).toBe(createdSession.id);
      expect(session?.token).toBe('find_by_token_test');
    });

    it('should return null for non-existent token', async () => {
      const session = await sessionRepo.findByToken('non_existent_token');

      expect(session).toBeNull();
    });

    it('should not find inactive sessions', async () => {
      // Revoke the session
      await sessionRepo.revokeSession(createdSession.id);

      const session = await sessionRepo.findByToken('find_by_token_test');

      expect(session).toBeNull();
    });
  });

  describe('findByRefreshToken', () => {
    let createdSession: any;

    beforeAll(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      createdSession = await sessionRepo.createSession(
        sessionInput,
        'access_for_refresh_test',
        'find_by_refresh_token_test'
      );
    });

    it('should find session by refresh token', async () => {
      const session = await sessionRepo.findByRefreshToken('find_by_refresh_token_test');

      expect(session).toBeDefined();
      expect(session?.id).toBe(createdSession.id);
      expect(session?.refresh_token).toBe('find_by_refresh_token_test');
    });

    it('should return null for non-existent refresh token', async () => {
      const session = await sessionRepo.findByRefreshToken('non_existent_refresh_token');

      expect(session).toBeNull();
    });
  });

  describe('findByUserId', () => {
    beforeAll(async () => {
      // Create multiple sessions for the user
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      await sessionRepo.createSession(sessionInput, 'token1', 'refresh1');
      await sessionRepo.createSession(sessionInput, 'token2', 'refresh2');
    });

    it('should find all active sessions for user', async () => {
      const sessions = await sessionRepo.findByUserId(testUserId, 'customer');

      expect(sessions).toBeDefined();
      expect(sessions.length).toBeGreaterThanOrEqual(2);
      expect(sessions.every(s => s.user_id === testUserId)).toBe(true);
      expect(sessions.every(s => s.is_active)).toBe(true);
    });
  });

  describe('updateLastActivity', () => {
    let sessionId: string;

    beforeAll(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      const session = await sessionRepo.createSession(
        sessionInput,
        'activity_test_token',
        'activity_test_refresh'
      );
      sessionId = session.id;
    });

    it('should update last activity timestamp', async () => {
      const originalSession = await sessionRepo.findById(sessionId);

      // Wait a bit
      await new Promise(resolve => setTimeout(resolve, 1000));

      await sessionRepo.updateLastActivity(sessionId);

      const updatedSession = await sessionRepo.findById(sessionId);

      expect(updatedSession).toBeDefined();
      expect(new Date(updatedSession!.last_activity_at).getTime())
        .toBeGreaterThan(new Date(originalSession!.last_activity_at).getTime());
    });
  });

  describe('revokeSession', () => {
    let sessionId: string;

    beforeEach(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      const session = await sessionRepo.createSession(
        sessionInput,
        'revoke_test_token_' + Date.now(),
        'revoke_test_refresh_' + Date.now()
      );
      sessionId = session.id;
    });

    it('should revoke session successfully', async () => {
      await sessionRepo.revokeSession(sessionId, testUserId, 'test_reason');

      const session = await sessionRepo.findById(sessionId);

      expect(session).toBeDefined();
      expect(session?.is_active).toBe(false);
      expect(session?.revoked_at).toBeDefined();
      expect(session?.revoked_by).toBe(testUserId);
      expect(session?.revocation_reason).toBe('test_reason');
    });
  });

  describe('revokeAllUserSessions', () => {
    beforeEach(async () => {
      // Create multiple active sessions
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      await sessionRepo.createSession(
        sessionInput,
        'revoke_all_1_' + Date.now(),
        'refresh_all_1_' + Date.now()
      );
      await sessionRepo.createSession(
        sessionInput,
        'revoke_all_2_' + Date.now(),
        'refresh_all_2_' + Date.now()
      );
    });

    it('should revoke all user sessions', async () => {
      const count = await sessionRepo.revokeAllUserSessions(
        testUserId,
        'customer',
        testUserId,
        'logout_all'
      );

      expect(count).toBeGreaterThanOrEqual(2);

      const sessions = await sessionRepo.findByUserId(testUserId, 'customer');
      expect(sessions.length).toBe(0); // No active sessions
    });
  });

  describe('isSessionValid', () => {
    let activeSessionId: string;
    let revokedSessionId: string;

    beforeAll(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      // Active session
      const activeSession = await sessionRepo.createSession(
        sessionInput,
        'valid_check_active_' + Date.now(),
        'refresh_valid_active_' + Date.now()
      );
      activeSessionId = activeSession.id;

      // Revoked session
      const revokedSession = await sessionRepo.createSession(
        sessionInput,
        'valid_check_revoked_' + Date.now(),
        'refresh_valid_revoked_' + Date.now()
      );
      revokedSessionId = revokedSession.id;
      await sessionRepo.revokeSession(revokedSessionId);
    });

    it('should validate active session', async () => {
      const validation = await sessionRepo.isSessionValid(activeSessionId);

      expect(validation.isValid).toBe(true);
    });

    it('should invalidate revoked session', async () => {
      const validation = await sessionRepo.isSessionValid(revokedSessionId);

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('session_inactive');
    });

    it('should invalidate non-existent session', async () => {
      const validation = await sessionRepo.isSessionValid('non-existent-id');

      expect(validation.isValid).toBe(false);
      expect(validation.reason).toBe('session_not_found');
    });
  });

  describe('getActiveSessionCount', () => {
    beforeAll(async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1'
      };

      await sessionRepo.createSession(
        sessionInput,
        'count_test_1_' + Date.now(),
        'refresh_count_1_' + Date.now()
      );
      await sessionRepo.createSession(
        sessionInput,
        'count_test_2_' + Date.now(),
        'refresh_count_2_' + Date.now()
      );
    });

    it('should count active sessions', async () => {
      const count = await sessionRepo.getActiveSessionCount(testUserId, 'customer');

      expect(count).toBeGreaterThanOrEqual(2);
    });
  });
});
