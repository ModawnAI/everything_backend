// Comprehensive Supabase mock for testing
import { jest } from '@jest/globals';

// Create a chainable mock that supports all Jest methods
const createChainableMock = () => {
  const mock = jest.fn();
  
  // Add Jest mock methods
  mock.mockReturnThis = jest.fn().mockReturnValue(mock);
  mock.mockReturnValue = jest.fn().mockReturnValue(mock);
  mock.mockResolvedValue = jest.fn().mockReturnValue(mock);
  mock.mockResolvedValueOnce = jest.fn().mockReturnValue(mock);
  mock.mockRejectedValue = jest.fn().mockReturnValue(mock);
  mock.mockRejectedValueOnce = jest.fn().mockReturnValue(mock);
  mock.mockImplementation = jest.fn().mockReturnValue(mock);
  mock.mockImplementationOnce = jest.fn().mockReturnValue(mock);
  
  // Add all query methods
  const queryMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'like', 'ilike', 'is', 'in',
    'contains', 'containedBy', 'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte',
    'rangeAdjacent', 'overlaps', 'textSearch', 'match', 'not', 'or',
    'filter', 'order', 'limit', 'range', 'abortSignal',
    'csv', 'geojson', 'explain', 'rollback', 'returns'
  ];
  
  queryMethods.forEach(method => {
    mock[method] = createChainableMock();
  });
  
  // Add special methods that return proper promises
  mock.single = jest.fn().mockResolvedValue({ data: {}, error: null });
  mock.maybeSingle = jest.fn().mockResolvedValue({ data: {}, error: null });
  
  // Add promise-like behavior for chaining
  mock.then = jest.fn((onResolve) => {
    return Promise.resolve({ data: [], error: null }).then(onResolve);
  });
  mock.catch = jest.fn((onReject) => {
    return Promise.resolve({ data: [], error: null }).catch(onReject);
  });
  
  return mock;
};

export const mockSupabase = {
  from: jest.fn(() => createChainableMock()),
  rpc: jest.fn().mockReturnThis(),
  auth: {
    getUser: jest.fn().mockResolvedValue({
      data: {
        user: {
          id: 'user-123',
          email: 'test@example.com',
          user_metadata: {},
          app_metadata: {}
        }
      },
      error: null
    }),
    signUp: jest.fn().mockReturnThis(),
    signInWithPassword: jest.fn().mockReturnThis(),
    signOut: jest.fn().mockReturnThis(),
    onAuthStateChange: jest.fn().mockReturnThis(),
    updateUser: jest.fn().mockReturnThis(),
    verifyJWT: jest.fn().mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    })
  },
  storage: {
    from: jest.fn().mockReturnValue({
      upload: jest.fn().mockReturnThis(),
      download: jest.fn().mockReturnThis(),
      remove: jest.fn().mockReturnThis(),
      list: jest.fn().mockReturnThis(),
      getPublicUrl: jest.fn().mockReturnThis()
    })
  },
  channel: jest.fn().mockReturnValue({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn().mockReturnThis()
  })
};

// Export the getSupabaseClient function
export const getSupabaseClient = jest.fn(() => mockSupabase);

// Mock the entire database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
}));

export default mockSupabase;
