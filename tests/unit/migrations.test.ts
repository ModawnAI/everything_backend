import { 
  createExtensions, 
  createEnums, 
  createCoreTables,
  createRelationshipTables,
  runCoreMigrations,
  runRelationshipMigrations,
  runFullMigrations,
  verifyCoreTables,
  verifyRelationshipTables,
  verifyAllTables
} from '../../src/config/migrations';
import { initializeDatabase } from '../../src/config/database';
import { logger } from '../../src/utils/logger';

// Mock logger to avoid console output during tests
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock Supabase client methods
const mockRpc = jest.fn();
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockEq1 = jest.fn();
const mockEq2 = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../src/config/database', () => ({
  initializeDatabase: jest.fn(),
  getSupabaseClient: jest.fn(() => ({
    rpc: mockRpc,
    from: mockFrom,
  })),
}));

describe('Database Migrations Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup mock chain for table existence check
    mockSingle.mockResolvedValue({ data: null, error: null });
    mockEq2.mockReturnValue({ single: mockSingle });
    mockEq1.mockReturnValue({ eq: mockEq2 });
    mockSelect.mockReturnValue({ eq: mockEq1 });
    mockFrom.mockReturnValue({ select: mockSelect });
    
    // Setup mock for RPC calls
    mockRpc.mockResolvedValue({ data: true, error: null });
  });

  test('should have migration functions defined', () => {
    expect(createExtensions).toBeDefined();
    expect(createEnums).toBeDefined();
    expect(createCoreTables).toBeDefined();
    expect(createRelationshipTables).toBeDefined();
    expect(runCoreMigrations).toBeDefined();
    expect(runRelationshipMigrations).toBeDefined();
    expect(runFullMigrations).toBeDefined();
    expect(verifyCoreTables).toBeDefined();
    expect(verifyRelationshipTables).toBeDefined();
    expect(verifyAllTables).toBeDefined();
  });

  test('should execute extension creation successfully', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await createExtensions();
    
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
      })
    );
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE EXTENSION IF NOT EXISTS "postgis"')
      })
    );
  });

  test('should execute enum creation successfully', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await createEnums();
    
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE TYPE user_gender AS ENUM')
      })
    );
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE TYPE shop_status AS ENUM')
      })
    );
  });

  test('should handle extension creation failure', async () => {
    mockRpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'Extension creation failed' } 
    });
    
    const result = await createExtensions();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to execute'),
      expect.any(Object)
    );
  });

  test('should handle enum creation failure', async () => {
    mockRpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'Enum creation failed' } 
    });
    
    const result = await createEnums();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to execute'),
      expect.any(Object)
    );
  });

  test('should execute full migration pipeline', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await runCoreMigrations();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Starting core table migrations...');
    expect(logger.info).toHaveBeenCalledWith('Core table migrations completed successfully');
  });

  test('should verify core tables exist', async () => {
    // Mock successful table existence checks
    mockSingle.mockResolvedValue({ data: { table_name: 'users' }, error: null });
    
    const result = await verifyCoreTables();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Verifying core tables...');
    expect(logger.info).toHaveBeenCalledWith('All core tables verified successfully');
  });

  test('should fail verification if table missing', async () => {
    // Mock table not found
    mockSingle.mockResolvedValue({ data: null, error: { message: 'Not found' } });
    
    const result = await verifyCoreTables();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Required table')
    );
  });

  test('should handle migration pipeline failure at extensions step', async () => {
    // Mock extension creation failure
    mockRpc.mockImplementation((funcName) => {
      if (funcName === 'execute_sql') {
        return Promise.resolve({ 
          data: null, 
          error: { message: 'Extension creation failed' } 
        });
      }
      return Promise.resolve({ data: true, error: null });
    });
    
    const result = await runCoreMigrations();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Failed to create database extensions');
  });

  test('should handle migration pipeline failure at enum step', async () => {
    // Mock enum creation failure
    let callCount = 0;
    mockRpc.mockImplementation((funcName) => {
      if (funcName === 'execute_sql') {
        callCount++;
        if (callCount > 2) { // Fail after extensions succeed
          return Promise.resolve({ 
            data: null, 
            error: { message: 'Enum creation failed' } 
          });
        }
      }
      return Promise.resolve({ data: true, error: null });
    });
    
    const result = await runCoreMigrations();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith('Failed to create enum types');
  });

  test('should execute relationship table creation successfully', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await createRelationshipTables();
    
    expect(result).toBe(true);
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE TABLE public.reservations')
      })
    );
    expect(mockRpc).toHaveBeenCalledWith('execute_sql', 
      expect.objectContaining({
        sql_query: expect.stringContaining('CREATE TABLE public.payments')
      })
    );
  });

  test('should execute relationship migrations successfully', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await runRelationshipMigrations();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Starting relationship table migrations...');
    expect(logger.info).toHaveBeenCalledWith('Relationship table migrations completed successfully');
  });

  test('should execute full migrations successfully', async () => {
    mockRpc.mockResolvedValue({ data: true, error: null });
    
    const result = await runFullMigrations();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Starting full database migrations...');
    expect(logger.info).toHaveBeenCalledWith('Full database migrations completed successfully');
  });

  test('should verify relationship tables exist', async () => {
    // Mock successful table existence checks
    mockSingle.mockResolvedValue({ data: { table_name: 'reservations' }, error: null });
    
    const result = await verifyRelationshipTables();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Verifying relationship tables...');
    expect(logger.info).toHaveBeenCalledWith('All relationship tables verified successfully');
  });

  test('should verify all tables exist', async () => {
    // Mock successful table existence checks
    mockSingle.mockResolvedValue({ data: { table_name: 'users' }, error: null });
    
    const result = await verifyAllTables();
    
    expect(result).toBe(true);
    expect(logger.info).toHaveBeenCalledWith('Verifying all database tables...');
    expect(logger.info).toHaveBeenCalledWith('All database tables verified successfully');
  });

  test('should handle relationship table creation failure', async () => {
    mockRpc.mockResolvedValue({ 
      data: null, 
      error: { message: 'Table creation failed' } 
    });
    
    const result = await createRelationshipTables();
    
    expect(result).toBe(false);
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to execute'),
      expect.any(Object)
    );
  });
}); 