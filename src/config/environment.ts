import * as dotenv from 'dotenv';
import Joi from 'joi';

// Load environment variables
dotenv.config();

// Environment variables schema for validation
const envSchema = Joi.object({
  // Server Configuration
  NODE_ENV: Joi.string().valid('development', 'staging', 'production', 'test').default('development'),
  PORT: Joi.number().default(3000),
  API_VERSION: Joi.string().default('v1'),

  // Database Configuration (Supabase)
  SUPABASE_URL: Joi.string().uri().required(),
  SUPABASE_ANON_KEY: Joi.string().required(),
  SUPABASE_SERVICE_ROLE_KEY: Joi.string().required(),

  // Authentication & Security
  JWT_SECRET: Joi.string().min(32).required(),
  JWT_EXPIRES_IN: Joi.string().default('7d'),
  JWT_REFRESH_EXPIRES_IN: Joi.string().default('30d'),
  BCRYPT_SALT_ROUNDS: Joi.number().default(12),

  // Redis Configuration
  REDIS_URL: Joi.string().default('redis://localhost:6379'),
  REDIS_PASSWORD: Joi.string().allow('').optional(),
  REDIS_DB: Joi.number().default(0),

  // Payment Integration (TossPayments)
  TOSS_PAYMENTS_SECRET_KEY: Joi.string().required(),
  TOSS_PAYMENTS_CLIENT_KEY: Joi.string().required(),
  TOSS_PAYMENTS_BASE_URL: Joi.string().uri().default('https://api.tosspayments.com'),

  // Push Notifications (Firebase FCM)
  FCM_SERVER_KEY: Joi.string().required(),
  FCM_PROJECT_ID: Joi.string().required(),
  FIREBASE_ADMIN_SDK_PATH: Joi.string().default('./config/firebase-admin-sdk.json'),

  // Social Login Configuration
  KAKAO_CLIENT_ID: Joi.string().optional(),
  KAKAO_CLIENT_SECRET: Joi.string().optional(),
  APPLE_CLIENT_ID: Joi.string().optional(),
  APPLE_TEAM_ID: Joi.string().optional(),
  APPLE_KEY_ID: Joi.string().optional(),
  APPLE_PRIVATE_KEY_PATH: Joi.string().optional(),
  GOOGLE_CLIENT_ID: Joi.string().optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().optional(),

  // File Storage & CDN
  SUPABASE_STORAGE_BUCKET: Joi.string().default('shop-images'),
  MAX_FILE_SIZE: Joi.number().default(5242880), // 5MB
  ALLOWED_FILE_TYPES: Joi.string().default('image/jpeg,image/png,image/webp'),

  // Email & SMS Configuration
  SMTP_HOST: Joi.string().optional(),
  SMTP_PORT: Joi.number().optional(),
  SMTP_USER: Joi.string().optional(),
  SMTP_PASS: Joi.string().optional(),
  SMS_API_KEY: Joi.string().optional(),
  SMS_SENDER_NUMBER: Joi.string().optional(),

  // Logging Configuration
  LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
  LOG_FILE_PATH: Joi.string().default('./logs'),
  MAX_LOG_SIZE: Joi.string().default('20m'),
  MAX_LOG_FILES: Joi.string().default('14d'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: Joi.number().default(900000), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: Joi.number().default(100),
  RATE_LIMIT_LOGIN_MAX: Joi.number().default(5),

  // Webhook & External API
  WEBHOOK_SECRET: Joi.string().optional(),
  EXTERNAL_API_TIMEOUT: Joi.number().default(30000),

  // Development & Testing
  DEBUG_MODE: Joi.boolean().default(false),
  SWAGGER_ENABLED: Joi.boolean().default(true),
  MOCK_PAYMENTS: Joi.boolean().default(false),
  MOCK_SMS: Joi.boolean().default(false),

  // Monitoring & Analytics
  SENTRY_DSN: Joi.string().optional(),
  ANALYTICS_API_KEY: Joi.string().optional(),

  // Business Logic Configuration
  POINT_EXPIRY_DAYS: Joi.number().default(365),
  POINT_PENDING_DAYS: Joi.number().default(7),
  DEFAULT_COMMISSION_RATE: Joi.number().default(10.0),
  RESERVATION_TIMEOUT_MINUTES: Joi.number().default(30),
  MAX_CONCURRENT_BOOKINGS: Joi.number().default(1),

  // Security Configuration
  CORS_ORIGIN: Joi.string().default('http://localhost:3000'),
  TRUSTED_PROXIES: Joi.string().default('127.0.0.1,::1'),
  SESSION_SECRET: Joi.string().optional(),
  ENCRYPTION_KEY: Joi.string().optional(),
}).unknown();

// Validate environment variables
const { error, value: envVars } = envSchema.validate(process.env);

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

// Export validated configuration
export const config = {
  server: {
    env: envVars.NODE_ENV as string,
    port: envVars.PORT as number,
    apiVersion: envVars.API_VERSION as string,
    isDevelopment: envVars.NODE_ENV === 'development',
    isProduction: envVars.NODE_ENV === 'production',
  },

  database: {
    supabaseUrl: envVars.SUPABASE_URL as string,
    supabaseAnonKey: envVars.SUPABASE_ANON_KEY as string,
    supabaseServiceRoleKey: envVars.SUPABASE_SERVICE_ROLE_KEY as string,
  },

  auth: {
    jwtSecret: envVars.JWT_SECRET as string,
    jwtExpiresIn: envVars.JWT_EXPIRES_IN as string,
    jwtRefreshExpiresIn: envVars.JWT_REFRESH_EXPIRES_IN as string,
    bcryptSaltRounds: envVars.BCRYPT_SALT_ROUNDS as number,
    issuer: envVars.SUPABASE_URL as string || 'supabase',
    audience: 'authenticated',
  },

  redis: {
    url: envVars.REDIS_URL as string,
    password: envVars.REDIS_PASSWORD as string,
    db: envVars.REDIS_DB as number,
  },

  payments: {
    tossPayments: {
      secretKey: envVars.TOSS_PAYMENTS_SECRET_KEY as string,
      clientKey: envVars.TOSS_PAYMENTS_CLIENT_KEY as string,
      baseUrl: envVars.TOSS_PAYMENTS_BASE_URL as string,
    },
  },

  notifications: {
    fcm: {
      serverKey: envVars.FCM_SERVER_KEY as string,
      projectId: envVars.FCM_PROJECT_ID as string,
      adminSdkPath: envVars.FIREBASE_ADMIN_SDK_PATH as string,
    },
  },

  socialLogin: {
    kakao: {
      clientId: envVars.KAKAO_CLIENT_ID as string,
      clientSecret: envVars.KAKAO_CLIENT_SECRET as string,
    },
    apple: {
      clientId: envVars.APPLE_CLIENT_ID as string,
      teamId: envVars.APPLE_TEAM_ID as string,
      keyId: envVars.APPLE_KEY_ID as string,
      privateKeyPath: envVars.APPLE_PRIVATE_KEY_PATH as string,
    },
    google: {
      clientId: envVars.GOOGLE_CLIENT_ID as string,
      clientSecret: envVars.GOOGLE_CLIENT_SECRET as string,
    },
  },

  storage: {
    bucket: envVars.SUPABASE_STORAGE_BUCKET as string,
    maxFileSize: envVars.MAX_FILE_SIZE as number,
    allowedFileTypes: (envVars.ALLOWED_FILE_TYPES as string).split(','),
  },

  email: {
    smtp: {
      host: envVars.SMTP_HOST as string,
      port: envVars.SMTP_PORT as number,
      user: envVars.SMTP_USER as string,
      pass: envVars.SMTP_PASS as string,
    },
  },

  sms: {
    apiKey: envVars.SMS_API_KEY as string,
    senderNumber: envVars.SMS_SENDER_NUMBER as string,
  },

  logging: {
    level: envVars.LOG_LEVEL as string,
    filePath: envVars.LOG_FILE_PATH as string,
    maxSize: envVars.MAX_LOG_SIZE as string,
    maxFiles: envVars.MAX_LOG_FILES as string,
  },

  rateLimiting: {
    windowMs: envVars.RATE_LIMIT_WINDOW_MS as number,
    maxRequests: envVars.RATE_LIMIT_MAX_REQUESTS as number,
    loginMax: envVars.RATE_LIMIT_LOGIN_MAX as number,
  },

  business: {
    pointExpiryDays: envVars.POINT_EXPIRY_DAYS as number,
    pointPendingDays: envVars.POINT_PENDING_DAYS as number,
    defaultCommissionRate: envVars.DEFAULT_COMMISSION_RATE as number,
    reservationTimeoutMinutes: envVars.RESERVATION_TIMEOUT_MINUTES as number,
    maxConcurrentBookings: envVars.MAX_CONCURRENT_BOOKINGS as number,
  },

  security: {
    corsOrigin: (envVars.CORS_ORIGIN as string).split(','),
    trustedProxies: (envVars.TRUSTED_PROXIES as string).split(','),
    sessionSecret: envVars.SESSION_SECRET as string,
    encryptionKey: envVars.ENCRYPTION_KEY as string,
  },

  development: {
    debugMode: envVars.DEBUG_MODE as boolean,
    swaggerEnabled: envVars.SWAGGER_ENABLED as boolean,
    mockPayments: envVars.MOCK_PAYMENTS as boolean,
    mockSms: envVars.MOCK_SMS as boolean,
  },

  monitoring: {
    sentryDsn: envVars.SENTRY_DSN as string,
    analyticsApiKey: envVars.ANALYTICS_API_KEY as string,
  },
};

export default config;
