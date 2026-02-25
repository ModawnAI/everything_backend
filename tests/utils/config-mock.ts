// Mock configuration for testing
// Uses environment variables when available (integration tests), falls back to test defaults (unit tests)
export const config = {
  database: {
    supabaseUrl: process.env.SUPABASE_URL || 'http://localhost:54321',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',
    timeoutMs: 30000,
  },
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    db: 0
  },
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    anonKey: process.env.SUPABASE_ANON_KEY || 'test-anon-key',
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key',
  },
  firebase: {
    projectId: process.env.FCM_PROJECT_ID || 'test-project',
    privateKey: 'test-private-key',
    clientEmail: 'test@example.com'
  },
  payments: {
    tossPayments: {
      secretKey: 'test-secret',
      clientKey: 'test-client',
      baseUrl: 'https://api.tosspayments.com'
    },
    portone: {
      enabled: process.env.PORTONE_ENABLED === 'true',
      apiKey: process.env.PORTONE_API_KEY || 'test-api-key',
      storeId: process.env.PORTONE_V2_STORE_ID || 'test-store-id',
      channelKey: process.env.PORTONE_V2_CHANNEL_KEY || 'test-channel-key',
      apiSecret: process.env.PORTONE_V2_API_SECRET || 'test-secret',
    }
  },
  server: {
    port: parseInt(process.env.PORT || '3001', 10),
    nodeEnv: process.env.NODE_ENV || 'test',
    isProduction: false,
    isDevelopment: false,
    isTest: true,
  },
  auth: {
    jwtSecret: process.env.JWT_SECRET || 'test-jwt-secret',
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
    bcryptSaltRounds: 12,
  },
  logging: {
    level: process.env.LOG_LEVEL || 'error'
  },
  security: {
    corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    rateLimitWindowMs: 900000,
    rateLimitMaxRequests: 1000,
    disableRateLimit: process.env.DISABLE_RATE_LIMIT === 'true',
    disableIpBlocking: process.env.DISABLE_IP_BLOCKING === 'true',
  },
  business: {
    pointExpiryDays: 365,
    pointPendingDays: 7,
    defaultCommissionRate: 10.0,
    reservationTimeoutMinutes: 30,
    maxConcurrentBookings: 1,
  }
};
