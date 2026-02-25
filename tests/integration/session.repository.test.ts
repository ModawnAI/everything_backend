/**
 * Session Repository Integration Tests
 */

// --- Mock setup: must be before any imports that use the mocked modules ---
const mockChain = {
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  neq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  gt: jest.fn().mockReturnThis(),
  lt: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn().mockResolvedValue({ data: null, error: null }),
  maybeSingle: jest.fn().mockResolvedValue({ data: null, error: null }),
};
const mockSupabase = {
  from: jest.fn().mockReturnValue(mockChain),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  auth: { admin: { createUser: jest.fn() } },
} as any;

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  getSupabaseAdmin: jest.fn(() => mockSupabase),
  supabase: mockSupabase,
}));

jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

import { SessionRepository } from '../../src/repositories/session.repository';
import { CreateSessionInput } from '../../src/types/unified-auth.types';
import { v4 as uuidv4 } from 'uuid';

describe('SessionRepository', () => {
  let sessionRepo: SessionRepository;
  let testUserId: string;

  beforeAll(() => {
    testUserId = uuidv4();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Re-establish mock chain after clearAllMocks
    Object.keys(mockChain).forEach(key => {
      if (key === 'single' || key === 'maybeSingle') {
        (mockChain as any)[key].mockResolvedValue({ data: null, error: null });
      } else {
        (mockChain as any)[key].mockReturnValue(mockChain);
      }
    });
    mockSupabase.from.mockReturnValue(mockChain);
    mockSupabase.rpc.mockResolvedValue({ data: null, error: null });

    // Re-establish getSupabaseClient mock (cleared by clearAllMocks)
    const db = require('../../src/config/database');
    db.getSupabaseClient.mockReturnValue(mockSupabase);
    db.getSupabaseAdmin?.mockReturnValue?.(mockSupabase);

    sessionRepo = new SessionRepository();
  });

  describe('createSession', () => {
    it('should create a new session', async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'customer',
        ip_address: '127.0.0.1',
        user_agent: 'Test User Agent',
        device_id: 'test-device-1',
        device_name: 'Test Device',
      };

      const mockSession = {
        id: uuidv4(),
        user_id: testUserId,
        user_role: 'customer',
        token: 'test_access_token',
        refresh_token: 'test_refresh_token',
        is_active: true,
        ip_address: '127.0.0.1',
        user_agent: 'Test User Agent',
        device_id: 'test-device-1',
        device_name: 'Test Device',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        refresh_expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        last_activity_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockSession, error: null });

      const session = await sessionRepo.createSession(
        sessionInput,
        'test_access_token',
        'test_refresh_token'
      );

      expect(session).toBeDefined();
      expect(session.user_id).toBe(testUserId);
      expect(session.token).toBe('test_access_token');
      expect(session.refresh_token).toBe('test_refresh_token');
      expect(session.is_active).toBe(true);
      expect(session.user_role).toBe('customer');
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockChain.insert).toHaveBeenCalled();
    });

    it('should set expiration times correctly', async () => {
      const sessionInput: CreateSessionInput = {
        user_id: testUserId,
        user_role: 'admin',
        ip_address: '127.0.0.1',
      };

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000);
      const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockSession = {
        id: uuidv4(),
        user_id: testUserId,
        user_role: 'admin',
        token: 'test_token_exp',
        refresh_token: 'test_refresh_exp',
        is_active: true,
        expires_at: expiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt.toISOString(),
        last_activity_at: now.toISOString(),
        created_at: now.toISOString(),
      };

      mockChain.single.mockResolvedValue({ data: mockSession, error: null });

      const session = await sessionRepo.createSession(
        sessionInput,
        'test_token_exp',
        'test_refresh_exp'
      );

      const sessionExpiresAt = new Date(session.expires_at);
      const sessionRefreshExpiresAt = new Date(session.refresh_expires_at!);

      // Access token should expire in ~24 hours
      const hoursDiff = (sessionExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);
      expect(hoursDiff).toBeGreaterThan(23);
      expect(hoursDiff).toBeLessThan(25);

      // Refresh token should expire in ~7 days
      const daysDiff = (sessionRefreshExpiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      expect(daysDiff).toBeGreaterThan(6);
      expect(daysDiff).toBeLessThan(8);
    });
  });

  describe('findByToken', () => {
    it('should find session by token', async () => {
      const mockSession = {
        id: uuidv4(),
        user_id: testUserId,
        token: 'find_by_token_test',
        is_active: true,
      };

      mockChain.single.mockResolvedValue({ data: mockSession, error: null });

      const session = await sessionRepo.findByToken('find_by_token_test');

      expect(session).toBeDefined();
      expect(session?.token).toBe('find_by_token_test');
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    });

    it('should return null for non-existent token', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      const session = await sessionRepo.findByToken('non_existent_token');
      expect(session).toBeNull();
    });

    it('should not find inactive sessions', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      const session = await sessionRepo.findByToken('find_by_token_test');
      expect(session).toBeNull();
    });
  });

  describe('findByRefreshToken', () => {
    it('should find session by refresh token', async () => {
      const mockSession = {
        id: uuidv4(),
        user_id: testUserId,
        refresh_token: 'find_by_refresh_token_test',
        is_active: true,
      };

      mockChain.single.mockResolvedValue({ data: mockSession, error: null });

      const session = await sessionRepo.findByRefreshToken('find_by_refresh_token_test');

      expect(session).toBeDefined();
      expect(session?.refresh_token).toBe('find_by_refresh_token_test');
    });

    it('should return null for non-existent refresh token', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      const session = await sessionRepo.findByRefreshToken('non_existent_refresh_token');
      expect(session).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should find all active sessions for user', async () => {
      const mockSessions = [
        { id: uuidv4(), user_id: testUserId, user_role: 'customer', is_active: true },
        { id: uuidv4(), user_id: testUserId, user_role: 'customer', is_active: true },
      ];

      // For findByUserId, the chain ends at order() (no single()), so order must resolve
      mockChain.order.mockResolvedValue({ data: mockSessions, error: null });

      const sessions = await sessionRepo.findByUserId(testUserId, 'customer');

      expect(sessions).toBeDefined();
      expect(sessions.length).toBe(2);
      expect(sessions.every((s: any) => s.user_id === testUserId)).toBe(true);
      expect(sessions.every((s: any) => s.is_active)).toBe(true);
    });
  });

  describe('updateLastActivity', () => {
    it('should update last activity timestamp', async () => {
      // update -> eq returns { error: null }
      mockChain.eq.mockResolvedValue({ error: null });

      await expect(sessionRepo.updateLastActivity(uuidv4())).resolves.not.toThrow();
      expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({ last_activity_at: expect.any(String) })
      );
    });
  });

  describe('revokeSession', () => {
    it('should revoke session successfully', async () => {
      mockChain.eq.mockResolvedValue({ error: null });

      await expect(
        sessionRepo.revokeSession(uuidv4(), testUserId, 'test_reason')
      ).resolves.not.toThrow();

      expect(mockChain.update).toHaveBeenCalledWith(
        expect.objectContaining({
          is_active: false,
          revoked_at: expect.any(String),
          revoked_by: testUserId,
          revocation_reason: 'test_reason',
        })
      );
    });
  });

  describe('revokeAllUserSessions', () => {
    it('should revoke all user sessions', async () => {
      const revokedSessions = [{ id: uuidv4() }, { id: uuidv4() }, { id: uuidv4() }];

      // revokeAllUserSessions: update -> eq -> eq -> eq -> select
      mockChain.select.mockResolvedValue({ data: revokedSessions, error: null });

      const count = await sessionRepo.revokeAllUserSessions(
        testUserId,
        'customer',
        testUserId,
        'logout_all'
      );

      expect(count).toBe(3);
    });
  });

  describe('isSessionValid', () => {
    it('should validate active session', async () => {
      const futureExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      mockChain.single.mockResolvedValue({
        data: {
          id: uuidv4(),
          is_active: true,
          expires_at: futureExpiry,
        },
        error: null,
      });

      const isValid = await sessionRepo.isSessionValid(uuidv4());
      expect(isValid).toBe(true);
    });

    it('should invalidate revoked session', async () => {
      mockChain.single.mockResolvedValue({
        data: {
          id: uuidv4(),
          is_active: false,
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        },
        error: null,
      });

      const isValid = await sessionRepo.isSessionValid(uuidv4());
      expect(isValid).toBe(false);
    });

    it('should invalidate non-existent session', async () => {
      mockChain.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'No rows returned' },
      });

      const isValid = await sessionRepo.isSessionValid('non-existent-id');
      expect(isValid).toBe(false);
    });
  });

  describe('getActiveSessionCount', () => {
    it('should count active sessions', async () => {
      // getActiveSessionCount uses select with { count: 'exact', head: true }
      // The chain: from -> select -> eq('user_id') -> eq('user_role') -> eq('is_active')
      // First two eq() calls must return the chain; the last one resolves with count
      mockChain.eq
        .mockReturnValueOnce(mockChain)   // .eq('user_id', userId)
        .mockReturnValueOnce(mockChain)   // .eq('user_role', role)
        .mockResolvedValueOnce({ count: 5, error: null }); // .eq('is_active', true)

      const count = await sessionRepo.getActiveSessionCount(testUserId, 'customer');
      expect(count).toBe(5);
    });
  });
});
