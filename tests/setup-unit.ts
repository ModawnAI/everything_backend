/**
 * Unit Test Setup
 * Optimized setup for unit tests with proper mocking
 */

import { jest } from '@jest/globals';

// Set test environment
process.env.NODE_ENV = 'test';
process.env.DISABLE_CSRF = 'true';
process.env.DISABLE_RATE_LIMIT = 'true';

// Mock environment variables
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TOSS_PAYMENTS_SECRET_KEY = 'test-toss-secret';
process.env.TOSS_PAYMENTS_CLIENT_KEY = 'test-toss-client';
process.env.FCM_SERVER_KEY = 'test-fcm-key';
process.env.FCM_PROJECT_ID = 'test-project';

// Mock Redis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(-1),
    exists: jest.fn().mockResolvedValue(0),
    hget: jest.fn().mockResolvedValue(null),
    hset: jest.fn().mockResolvedValue(1),
    hdel: jest.fn().mockResolvedValue(1),
    hgetall: jest.fn().mockResolvedValue({}),
    zadd: jest.fn().mockResolvedValue(1),
    zrem: jest.fn().mockResolvedValue(1),
    zrange: jest.fn().mockResolvedValue([]),
    zcard: jest.fn().mockResolvedValue(0),
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
    off: jest.fn(),
    removeAllListeners: jest.fn()
  }));
});

// Mock Firebase Admin
const mockFirebaseAdmin = {
  apps: [],
  initializeApp: jest.fn().mockReturnValue({
    auth: jest.fn(),
    messaging: jest.fn()
  }),
  credential: {
    applicationDefault: jest.fn().mockReturnValue({}),
    cert: jest.fn().mockReturnValue({})
  },
  auth: jest.fn(() => ({
    verifyIdToken: jest.fn().mockResolvedValue({
      uid: 'test-user-id',
      email: 'test@example.com'
    }),
    createCustomToken: jest.fn().mockResolvedValue('test-custom-token'),
    setCustomUserClaims: jest.fn().mockResolvedValue(undefined),
    getUser: jest.fn().mockResolvedValue({
      uid: 'test-user-id',
      email: 'test@example.com'
    })
  })),
  messaging: jest.fn(() => ({
    send: jest.fn().mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true, messageId: 'test-message-id' }]
    })
  }))
};

jest.mock('firebase-admin', () => mockFirebaseAdmin);

// Global test configuration
jest.setTimeout(30000);

// Mock console methods to reduce noise in unit tests
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: originalConsole.warn, // Keep warnings for debugging
  error: originalConsole.error, // Keep errors for debugging
};

console.log('🧪 Unit test environment setup complete');
