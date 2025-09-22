// Comprehensive test environment setup
import { jest } from '@jest/globals';

// Set up environment variables
process.env.NODE_ENV = 'test';
process.env.SUPABASE_URL = 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = 'test-key';
process.env.REDIS_URL = 'redis://localhost:6379';
process.env.REDIS_PASSWORD = '';
process.env.REDIS_DB = '0';
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
process.env.FIREBASE_CLIENT_EMAIL = 'test@example.com';
process.env.TOSS_PAYMENTS_SECRET_KEY = 'test-secret';
process.env.TOSS_PAYMENTS_CLIENT_KEY = 'test-client';
process.env.TOSS_PAYMENTS_BASE_URL = 'https://api.tosspayments.com';

// Global test timeout
jest.setTimeout(30000);

// Mock console methods to reduce noise
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

console.log('🧪 Comprehensive test environment setup complete');
