import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../../src/config/environment';

// Mock Supabase client for testing
export function createMockSupabaseClient(): SupabaseClient {
  const mockQueryBuilder = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    then: jest.fn().mockResolvedValue({ data: [], error: null })
  };

  const mockFrom = jest.fn().mockReturnValue(mockQueryBuilder);

  const mockClient = {
    from: mockFrom,
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      refreshSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null })
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } })
      })
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null })
  };

  return mockClient as any;
}

// Real Supabase client for integration tests
export function createRealSupabaseClient(): SupabaseClient {
  if (!config.database.supabaseUrl || !config.database.supabaseServiceRoleKey) {
    throw new Error('Supabase configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.');
  }

  return createClient(
    config.database.supabaseUrl,
    config.database.supabaseServiceRoleKey,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      }
    }
  );
}

// Test environment detection
export function isTestEnvironment(): boolean {
  return config.server.env === 'test' || process.env.NODE_ENV === 'test';
}

// Setup function for tests
export function setupTestEnvironment() {
  // Set test environment
  process.env.NODE_ENV = 'test';
  
  // Mock console methods to reduce noise during tests
  if (process.env.NODE_ENV === 'test') {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  }
}

// Cleanup function for tests
export function cleanupTestEnvironment() {
  // Restore console methods
  if (process.env.NODE_ENV === 'test') {
    jest.restoreAllMocks();
  }
}
