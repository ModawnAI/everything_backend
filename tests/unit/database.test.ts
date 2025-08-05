import { database, initializeDatabase, getSupabaseClient } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Database Configuration Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize database configuration successfully', () => {
    const dbConfig = initializeDatabase();
    
    expect(dbConfig).toBeDefined();
    expect(dbConfig.client).toBeDefined();
    expect(dbConfig.healthCheck).toBeDefined();
    expect(dbConfig.disconnect).toBeDefined();
    expect(typeof dbConfig.healthCheck).toBe('function');
    expect(typeof dbConfig.disconnect).toBe('function');
  });

  test('should return same instance on multiple initializations', () => {
    const dbConfig1 = initializeDatabase();
    const dbConfig2 = initializeDatabase();
    
    expect(dbConfig1).toBe(dbConfig2);
  });

  test('should get Supabase client directly', () => {
    const client = getSupabaseClient();
    
    expect(client).toBeDefined();
    expect(client.from).toBeDefined();
    expect(typeof client.from).toBe('function');
  });

  test('should have database utility functions', () => {
    expect(database.initialize).toBeDefined();
    expect(database.getInstance).toBeDefined();
    expect(database.getClient).toBeDefined();
    expect(database.withRetry).toBeDefined();
    expect(database.isHealthy).toBeDefined();
    expect(database.getMonitorStatus).toBeDefined();
  });

  test('should handle retry logic', async () => {
    const mockOperation = jest.fn()
      .mockRejectedValueOnce(new Error('First failure'))
      .mockRejectedValueOnce(new Error('Second failure'))
      .mockResolvedValueOnce('Success');

    const result = await database.withRetry(mockOperation, 'test-operation');

    expect(result).toBe('Success');
    expect(mockOperation).toHaveBeenCalledTimes(3);
  });

  test('should have working database utilities', async () => {
    const isHealthy = await database.isHealthy();
    const monitorStatus = database.getMonitorStatus();
    
    // These should be callable without throwing errors
    expect(typeof isHealthy).toBe('boolean');
    expect(typeof monitorStatus).toBe('boolean');
  });
}); 