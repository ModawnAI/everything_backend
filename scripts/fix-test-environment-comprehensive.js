const fs = require('fs');
const path = require('path');

console.log('🔧 Comprehensive Test Environment Fix...');

const projectRoot = path.join(__dirname, '..');

// 1. Create a comprehensive Faker mock
const fakerMockPath = path.join(projectRoot, 'tests', 'utils', 'faker-comprehensive-mock.ts');
const fakerMockContent = `// Comprehensive Faker mock for testing
export const faker = {
  datatype: { 
    uuid: () => 'test-uuid-' + Math.random().toString(36).substr(2, 9),
    number: (options = {}) => options.min ? Math.floor(Math.random() * (options.max - options.min + 1)) + options.min : Math.floor(Math.random() * 1000),
    boolean: () => Math.random() > 0.5,
    float: (options = {}) => options.min ? Math.random() * (options.max - options.min) + options.min : Math.random() * 100,
    datetime: () => new Date()
  },
  date: { 
    future: () => new Date(Date.now() + 86400000),
    recent: () => new Date(Date.now() - 86400000),
    past: () => new Date(Date.now() - 172800000),
    between: () => new Date(Date.now() - 86400000),
    soon: () => new Date(Date.now() + 3600000)
  },
  lorem: { 
    words: (count = 3) => Array(count).fill(0).map(() => 'test').join(' '),
    sentence: () => 'This is a test sentence.',
    paragraph: () => 'This is a test paragraph with multiple sentences.'
  },
  internet: { 
    email: () => 'test@example.com',
    url: () => 'https://example.com',
    ip: () => '192.168.1.1'
  },
  name: { 
    firstName: () => 'Test', 
    lastName: () => 'User',
    fullName: () => 'Test User',
    findName: () => 'Test User'
  },
  phone: { 
    number: () => '010-1234-5678',
    phoneNumber: () => '010-1234-5678'
  },
  address: {
    city: () => 'Seoul',
    streetAddress: () => '123 Test St',
    zipCode: () => '12345'
  },
  company: {
    name: () => 'Test Company'
  },
  commerce: {
    productName: () => 'Test Product',
    price: () => 10000
  }
};

export default faker;
`;

fs.writeFileSync(fakerMockPath, fakerMockContent);
console.log('✅ Created comprehensive Faker mock');

// 2. Create a comprehensive Supabase mock
const supabaseMockPath = path.join(projectRoot, 'tests', 'utils', 'supabase-comprehensive-mock.ts');
const supabaseMockContent = `// Comprehensive Supabase mock for testing
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
  
  // Add special methods
  mock.single = jest.fn().mockResolvedValue({ data: {}, error: null });
  mock.maybeSingle = jest.fn().mockResolvedValue({ data: {}, error: null });
  
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
`;

fs.writeFileSync(supabaseMockPath, supabaseMockContent);
console.log('✅ Created comprehensive Supabase mock');

// 3. Update Jest configuration
const jestConfigPath = path.join(projectRoot, 'jest.config.js');
let jestConfigContent = fs.readFileSync(jestConfigPath, 'utf8');

// Add setup files
if (!jestConfigContent.includes('faker-comprehensive-mock.ts')) {
  jestConfigContent = jestConfigContent.replace(
    /(setupFiles:\s*\[[^\]]*)(\]\s*,)/,
    `$1, '<rootDir>/tests/utils/faker-comprehensive-mock.ts'$2`
  );
}

if (!jestConfigContent.includes('supabase-comprehensive-mock.ts')) {
  jestConfigContent = jestConfigContent.replace(
    /(setupFiles:\s*\[[^\]]*)(\]\s*,)/,
    `$1, '<rootDir>/tests/utils/supabase-comprehensive-mock.ts'$2`
  );
}

// Add module mapping
if (!jestConfigContent.includes('faker-comprehensive-mock')) {
  jestConfigContent = jestConfigContent.replace(
    /(moduleNameMapper:\s*{[^}]+)(}\s*,)/,
    `$1,
    '^@faker-js/faker$': '<rootDir>/tests/utils/faker-comprehensive-mock.ts',
    '^../../src/config/database$': '<rootDir>/tests/utils/supabase-comprehensive-mock.ts'$2`
  );
}

fs.writeFileSync(jestConfigPath, jestConfigContent);
console.log('✅ Updated Jest configuration');

// 4. Create a test environment setup
const testEnvSetupPath = path.join(projectRoot, 'tests', 'setup-comprehensive.ts');
const testEnvSetupContent = `// Comprehensive test environment setup
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
`;

fs.writeFileSync(testEnvSetupPath, testEnvSetupContent);
console.log('✅ Created comprehensive test environment setup');

// 5. Update package.json test scripts
const packageJsonPath = path.join(projectRoot, 'package.json');
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));

// Add comprehensive test script
if (!packageJson.scripts['test:comprehensive:fixed']) {
  packageJson.scripts['test:comprehensive:fixed'] = 'jest tests/unit --setupFilesAfterEnv tests/setup-comprehensive.ts --maxWorkers=1 --testTimeout=30000';
}

fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
console.log('✅ Updated package.json test scripts');

console.log('🎉 Comprehensive test environment fix completed!');
console.log('Run: npm run test:comprehensive:fixed');
