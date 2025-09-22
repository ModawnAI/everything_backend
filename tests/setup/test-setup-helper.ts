/**
 * Test Setup Helper
 * 
 * This file provides common setup functions for tests to ensure consistent
 * test environment across all test files.
 */

import { setupGlobalMocks, createSupabaseMock, createLoggerMock, createConfigMock } from '../utils/mock-utils';

/**
 * Sets up common mocks for all tests
 */
export const setupCommonMocks = () => {
  // Setup global mocks
  setupGlobalMocks();
  
  // Mock database
  jest.mock('../../src/config/database', () => ({
    getSupabaseClient: jest.fn(() => createSupabaseMock()),
    initializeDatabase: jest.fn(() => Promise.resolve({
      client: createSupabaseMock(),
      healthCheck: jest.fn(() => Promise.resolve(true)),
      disconnect: jest.fn(() => Promise.resolve())
    }))
  }));
  
  // Mock logger
  jest.mock('../../src/utils/logger', () => ({
    logger: createLoggerMock()
  }));
  
  // Mock config
  jest.mock('../../src/config/environment', () => ({
    config: createConfigMock()
  }));
  
  // Mock Firebase Admin
  jest.mock('firebase-admin', () => ({
    initializeApp: jest.fn(),
    credential: {
      applicationDefault: jest.fn()
    },
    apps: []
  }));
  
  // Mock Redis
  jest.mock('redis', () => ({
    createClient: jest.fn(() => ({
      connect: jest.fn(),
      disconnect: jest.fn(),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      exists: jest.fn(),
      expire: jest.fn(),
      on: jest.fn()
    }))
  }));
  
  // Mock rate limiter
  jest.mock('rate-limiter-flexible', () => ({
    RateLimiterRedis: jest.fn().mockImplementation(() => ({
      consume: jest.fn().mockResolvedValue({ remainingPoints: 100, msBeforeNext: 0 }),
      penalty: jest.fn(),
      reward: jest.fn(),
      block: jest.fn(),
      get: jest.fn().mockResolvedValue({ remainingPoints: 100, msBeforeNext: 0 }),
      delete: jest.fn()
    }))
  }));
};

/**
 * Cleans up after tests
 */
export const cleanupAfterTests = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};

export default {
  setupCommonMocks,
  cleanupAfterTests
};
