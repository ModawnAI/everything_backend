/**
 * Comprehensive Mock Utilities for Testing
 * 
 * This file provides reusable mock utilities for consistent testing across the application.
 */

import { jest } from '@jest/globals';

/**
 * Creates a comprehensive Supabase mock
 */
export const createSupabaseMock = () => {
  const mockQuery = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    neq: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    lt: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    like: jest.fn().mockReturnThis(),
    ilike: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    contains: jest.fn().mockReturnThis(),
    containedBy: jest.fn().mockReturnThis(),
    rangeGt: jest.fn().mockReturnThis(),
    rangeGte: jest.fn().mockReturnThis(),
    rangeLt: jest.fn().mockReturnThis(),
    rangeLte: jest.fn().mockReturnThis(),
    rangeAdjacent: jest.fn().mockReturnThis(),
    overlaps: jest.fn().mockReturnThis(),
    textSearch: jest.fn().mockReturnThis(),
    match: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    filter: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    range: jest.fn().mockReturnThis(),
    abortSignal: jest.fn().mockReturnThis(),
    single: jest.fn(),
    maybeSingle: jest.fn(),
    csv: jest.fn(),
    geojson: jest.fn(),
    explain: jest.fn(),
    rollback: jest.fn(),
    returns: jest.fn().mockReturnThis(),
    then: jest.fn(),
    catch: jest.fn(),
    finally: jest.fn()
  };

  return {
    from: jest.fn().mockReturnValue(mockQuery),
    rpc: jest.fn(),
    auth: {
      getUser: jest.fn(),
      signUp: jest.fn(),
      signInWithPassword: jest.fn(),
      signInWithOAuth: jest.fn(),
      signOut: jest.fn(),
      resetPasswordForEmail: jest.fn(),
      updateUser: jest.fn(),
      admin: {
        listUsers: jest.fn(),
        getUserById: jest.fn(),
        createUser: jest.fn(),
        updateUserById: jest.fn(),
        deleteUser: jest.fn()
      }
    },
    storage: {
      from: jest.fn().mockReturnValue({
        upload: jest.fn(),
        download: jest.fn(),
        remove: jest.fn(),
        list: jest.fn(),
        getPublicUrl: jest.fn(),
        createSignedUrl: jest.fn(),
        createSignedUrls: jest.fn(),
        update: jest.fn(),
        move: jest.fn(),
        copy: jest.fn()
      })
    },
    realtime: {
      channel: jest.fn().mockReturnValue({
        on: jest.fn().mockReturnThis(),
        subscribe: jest.fn(),
        unsubscribe: jest.fn()
      })
    }
  };
};

/**
 * Creates a comprehensive logger mock
 */
export const createLoggerMock = () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn()
});

/**
 * Creates a comprehensive config mock
 */
export const createConfigMock = () => ({
  database: {
    supabase: {
      url: 'https://test.supabase.co',
      anonKey: 'test-anon-key',
      serviceRoleKey: 'test-service-role-key'
    }
  },
  redis: {
    url: 'redis://localhost:6379',
    password: 'test-password',
    db: 1
  },
  payments: {
    tossPayments: {
      secretKey: 'test-secret-key',
      clientKey: 'test-client-key',
      baseUrl: 'https://api.tosspayments.com'
    }
  },
  firebase: {
    projectId: 'test-project-id',
    privateKey: 'test-private-key',
    clientEmail: 'test@test.com'
  },
  jwt: {
    secret: 'test-jwt-secret-key-for-testing-only',
    expiresIn: '1h',
    refreshExpiresIn: '7d'
  },
  server: {
    port: 3001,
    nodeEnv: 'test'
  },
  logging: {
    level: 'error'
  },
  rateLimit: {
    windowMs: 60000,
    max: 100
  }
});

/**
 * Creates a comprehensive fetch mock
 */
export const createFetchMock = () => {
  const mockFetch = jest.fn();
  
  // Default successful response
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Map(),
    json: jest.fn().mockResolvedValue({}),
    text: jest.fn().mockResolvedValue(''),
    blob: jest.fn().mockResolvedValue(new Blob()),
    arrayBuffer: jest.fn().mockResolvedValue(new ArrayBuffer(0)),
    formData: jest.fn().mockResolvedValue(new FormData()),
    clone: jest.fn().mockReturnThis()
  });
  
  return mockFetch;
};

/**
 * Creates a comprehensive crypto mock
 */
export const createCryptoMock = () => ({
  createHmac: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('mock-signature')
  }),
  randomBytes: jest.fn().mockReturnValue(Buffer.from('mock-random-bytes')),
  randomUUID: jest.fn().mockReturnValue('mock-uuid')
});

/**
 * Sets up global test mocks
 */
export const setupGlobalMocks = () => {
  // Mock global fetch
  global.fetch = createFetchMock();
  
  // Mock global crypto
  global.crypto = createCryptoMock();
  
  // Mock process.env
  process.env.NODE_ENV = 'test';
  process.env.SUPABASE_URL = 'https://test.supabase.co';
  process.env.SUPABASE_ANON_KEY = 'test-anon-key';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key';
  process.env.JWT_SECRET = 'test-jwt-secret-key-for-testing-only';
  process.env.TOSS_PAYMENTS_SECRET_KEY = 'test-secret-key';
  process.env.TOSS_PAYMENTS_CLIENT_KEY = 'test-client-key';
  process.env.FIREBASE_PROJECT_ID = 'test-project-id';
  process.env.FIREBASE_PRIVATE_KEY = 'test-private-key';
  process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
};

/**
 * Resets all mocks
 */
export const resetAllMocks = () => {
  jest.clearAllMocks();
  jest.resetAllMocks();
  jest.restoreAllMocks();
};

/**
 * Common test data factories
 */
export const testDataFactories = {
  createUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    phone: '+821012345678',
    role: 'user',
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  createShop: (overrides = {}) => ({
    id: 'test-shop-id',
    name: 'Test Shop',
    description: 'Test shop description',
    address: 'Test Address',
    latitude: 37.5665,
    longitude: 126.9780,
    phone: '+821012345678',
    isVerified: true,
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  createReservation: (overrides = {}) => ({
    id: 'test-reservation-id',
    userId: 'test-user-id',
    shopId: 'test-shop-id',
    status: 'pending',
    reservationDate: '2024-12-25',
    reservationTime: '14:00',
    totalAmount: 50000,
    depositAmount: 10000,
    pointsUsed: 0,
    specialRequests: 'Test request',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  }),
  
  createPayment: (overrides = {}) => ({
    id: 'test-payment-id',
    reservationId: 'test-reservation-id',
    userId: 'test-user-id',
    amount: 50000,
    currency: 'KRW',
    status: 'pending',
    paymentMethod: 'card',
    paymentKey: 'test-payment-key',
    orderId: 'test-order-id',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides
  })
};

export default {
  createSupabaseMock,
  createLoggerMock,
  createConfigMock,
  createFetchMock,
  createCryptoMock,
  setupGlobalMocks,
  resetAllMocks,
  testDataFactories
};
