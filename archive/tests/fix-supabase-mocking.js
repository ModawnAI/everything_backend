const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Supabase Mocking Issues...');

const projectRoot = path.join(__dirname, '..');

// 1. Create a comprehensive test setup that properly mocks Supabase
const testSetupPath = path.join(projectRoot, 'tests', 'setup-supabase-mock.ts');
const testSetupContent = `// Comprehensive Supabase mock setup for tests
import { jest } from '@jest/globals';

// Create a simple but effective mock that works with Jest
const createMockQuery = () => {
  const mockFn = jest.fn();
  
  // Chainable methods that return the mock function
  const chainMethods = [
    'select', 'insert', 'update', 'delete', 'upsert',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte', 
    'like', 'ilike', 'is', 'in', 'contains', 'containedBy',
    'rangeGt', 'rangeGte', 'rangeLt', 'rangeLte', 
    'rangeAdjacent', 'overlaps', 'textSearch', 'match', 
    'not', 'or', 'filter', 'order', 'limit', 'range', 
    'abortSignal', 'csv', 'geojson', 'explain', 'rollback', 'returns'
  ];
  
  chainMethods.forEach(method => {
    mockFn[method] = jest.fn().mockReturnValue(mockFn);
  });
  
  // Methods that return promises
  mockFn.single = jest.fn().mockResolvedValue({ data: {}, error: null });
  mockFn.maybeSingle = jest.fn().mockResolvedValue({ data: {}, error: null });
  
  // Jest mock methods
  mockFn.mockResolvedValue = jest.fn().mockReturnValue(mockFn);
  mockFn.mockResolvedValueOnce = jest.fn().mockReturnValue(mockFn);
  mockFn.mockRejectedValue = jest.fn().mockReturnValue(mockFn);
  mockFn.mockRejectedValueOnce = jest.fn().mockReturnValue(mockFn);
  
  return mockFn;
};

// Global Supabase mock
const globalSupabaseMock = {
  from: jest.fn(() => createMockQuery()),
  rpc: jest.fn().mockResolvedValue({ data: {}, error: null }),
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
    signUp: jest.fn().mockResolvedValue({ data: {}, error: null }),
    signInWithPassword: jest.fn().mockResolvedValue({ data: {}, error: null }),
    signOut: jest.fn().mockResolvedValue({ data: {}, error: null }),
    onAuthStateChange: jest.fn().mockReturnValue({ data: { subscription: {} } }),
    updateUser: jest.fn().mockResolvedValue({ data: {}, error: null }),
    verifyJWT: jest.fn().mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'test@example.com'
      }
    })
  },
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
      download: jest.fn().mockResolvedValue({ data: {}, error: null }),
      remove: jest.fn().mockResolvedValue({ data: {}, error: null }),
      list: jest.fn().mockResolvedValue({ data: [], error: null }),
      getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'test-url' } })
    }))
  },
  channel: jest.fn(() => ({
    on: jest.fn().mockReturnThis(),
    subscribe: jest.fn().mockReturnThis(),
    unsubscribe: jest.fn().mockReturnThis()
  }))
};

// Mock the getSupabaseClient function
jest.mock('../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => globalSupabaseMock),
}));

// Make the mock available globally for tests
(global as any).mockSupabase = globalSupabaseMock;

export { globalSupabaseMock as mockSupabase };
`;

fs.writeFileSync(testSetupPath, testSetupContent);
console.log('✅ Created comprehensive Supabase mock setup');

// 2. Update Jest configuration to use the new setup
const jestConfigPath = path.join(projectRoot, 'jest.config.js');
let jestConfigContent = fs.readFileSync(jestConfigPath, 'utf8');

// Add the new setup file
jestConfigContent = jestConfigContent.replace(
  "setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/setup-comprehensive.ts'],",
  "setupFilesAfterEnv: ['<rootDir>/tests/setup.ts', '<rootDir>/tests/setup-comprehensive.ts', '<rootDir>/tests/setup-supabase-mock.ts'],"
);

fs.writeFileSync(jestConfigPath, jestConfigContent);
console.log('✅ Updated Jest configuration');

console.log('🎉 Supabase mocking fixes completed!');
