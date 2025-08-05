// Jest test setup file
// This file is run before each test file

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-purposes-only';
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.TOSS_PAYMENTS_SECRET_KEY = 'test-toss-secret';
process.env.TOSS_PAYMENTS_CLIENT_KEY = 'test-toss-client';
process.env.FCM_SERVER_KEY = 'test-fcm-key';
process.env.FCM_PROJECT_ID = 'test-project';

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