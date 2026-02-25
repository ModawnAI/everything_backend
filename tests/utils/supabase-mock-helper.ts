/**
 * Shared Supabase Mock Helper
 *
 * Provides a deeply chainable mock Supabase client for unit tests.
 * All query methods return the mock itself, enabling chains like:
 *   supabase.from('table').select('*').eq('id', '1').single()
 *
 * Usage in test files:
 *   import { createMockSupabase, createDatabaseMock } from '../utils/supabase-mock-helper';
 *
 *   const mockSupabase = createMockSupabase();
 *   jest.mock('../../src/config/database', () => createDatabaseMock(mockSupabase));
 */

/**
 * Create a deeply chainable query builder mock.
 * Every method returns the same object, allowing any chain order.
 */
export function createQueryMock(resolvedValue: { data: any; error: any; count?: any } = { data: null, error: null }) {
  const queryMock: any = {
    _resolvedValue: resolvedValue,
  };

  const chainMethods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'not',
    'contains', 'containedBy', 'overlaps',
    'filter', 'match', 'or', 'and',
    'order', 'limit', 'range', 'offset', 'count',
    'single', 'maybeSingle',
    'csv', 'returns',
    'textSearch',
    'throwOnError',
  ];

  for (const method of chainMethods) {
    queryMock[method] = jest.fn(() => queryMock);
  }

  // Make the mock thenable so await works
  queryMock.then = (resolve: any) => resolve(queryMock._resolvedValue);

  return queryMock;
}

/**
 * Create a mock Supabase client with from(), auth, storage, rpc
 */
export function createMockSupabase() {
  const mockSupabase: any = {
    from: jest.fn(() => createQueryMock()),
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
      signUp: jest.fn().mockResolvedValue({ data: null, error: null }),
      signInWithPassword: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue({ error: null }),
      refreshSession: jest.fn().mockResolvedValue({ data: null, error: null }),
      admin: {
        getUserById: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
        listUsers: jest.fn().mockResolvedValue({ data: { users: [] }, error: null }),
        deleteUser: jest.fn().mockResolvedValue({ data: null, error: null }),
      },
    },
    storage: {
      from: jest.fn(() => ({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        download: jest.fn().mockResolvedValue({ data: null, error: null }),
        remove: jest.fn().mockResolvedValue({ data: null, error: null }),
        list: jest.fn().mockResolvedValue({ data: [], error: null }),
        createSignedUrl: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: '' } }),
      })),
    },
    rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
  };

  return mockSupabase;
}

/**
 * Create a database module mock factory.
 * Use with jest.mock('../../src/config/database', () => createDatabaseMock(mockSupabase))
 *
 * IMPORTANT: Due to jest.mock hoisting, you must use a variable that jest can access.
 * Pattern:
 *   // At top level (before any imports)
 *   const mockSupabase = createMockSupabase();
 *   jest.mock('../../src/config/database', () => ({
 *     getSupabaseClient: jest.fn(() => mockSupabase),
 *     initializeDatabase: jest.fn(),
 *     getDatabase: jest.fn(() => ({ client: mockSupabase })),
 *     database: { getClient: jest.fn(() => mockSupabase) },
 *   }));
 */
export function createDatabaseMock(mockClient: any) {
  return {
    getSupabaseClient: jest.fn(() => mockClient),
    initializeDatabase: jest.fn(() => ({ client: mockClient, healthCheck: jest.fn(), disconnect: jest.fn() })),
    getDatabase: jest.fn(() => ({ client: mockClient, healthCheck: jest.fn(), disconnect: jest.fn() })),
    database: {
      initialize: jest.fn(),
      getInstance: jest.fn(),
      getClient: jest.fn(() => mockClient),
      withRetry: jest.fn((op: any) => op()),
      isHealthy: jest.fn().mockResolvedValue(true),
      getMonitorStatus: jest.fn().mockReturnValue(true),
    },
  };
}

/**
 * Helper to setup mock response for a specific table query.
 *
 * Usage:
 *   setupMockQuery(mockSupabase, 'users', { data: [{ id: '1' }], error: null });
 */
export function setupMockQuery(
  mockSupabase: any,
  _tableName: string,
  resolvedValue: { data: any; error: any; count?: any }
) {
  const queryMock = createQueryMock(resolvedValue);
  mockSupabase.from.mockReturnValue(queryMock);
  return queryMock;
}
