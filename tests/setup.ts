// Jest test setup file
// This file is run before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';

// Disable CSRF protection for tests
process.env.DISABLE_CSRF = 'true';

// Disable rate limiting for tests
process.env.DISABLE_RATE_LIMIT = 'true';

// Mock Redis for tests to avoid connection issues
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

// Only set fallback values if environment variables are not already set
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
}
if (!process.env.SUPABASE_URL) {
  process.env.SUPABASE_URL = 'https://test.supabase.co';
}
if (!process.env.SUPABASE_ANON_KEY) {
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
}
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
}
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = 'redis://localhost:6379';
}
if (!process.env.TOSS_PAYMENTS_SECRET_KEY) {
  process.env.TOSS_PAYMENTS_SECRET_KEY = 'test-toss-secret';
}
if (!process.env.TOSS_PAYMENTS_CLIENT_KEY) {
  process.env.TOSS_PAYMENTS_CLIENT_KEY = 'test-toss-client';
}
if (!process.env.FCM_SERVER_KEY) {
  process.env.FCM_SERVER_KEY = 'test-fcm-key';
}
if (!process.env.FCM_PROJECT_ID) {
  process.env.FCM_PROJECT_ID = 'test-project';
}

// Global test setup
beforeAll(async () => {
  // Initialize database for tests
  try {
    const { initializeDatabase } = require('../src/config/database');
    initializeDatabase();
  } catch (error) {
    // Ignore database initialization errors in tests
    console.log('Database initialization skipped in test environment');
  }
});

afterAll(async () => {
  // Global cleanup after all tests
});

beforeEach(() => {
  // Setup before each test
  // Clear any test-specific state
});

afterEach(() => {
  // Cleanup after each test
  // Reset any mocks or test data
}); 