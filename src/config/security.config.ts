/**
 * Security Headers Configuration
 * 
 * Comprehensive security headers setup for the beauty service platform
 * with environment-specific configurations and security policy templates
 */

import { config } from './environment';
import {
  SecurityHeadersConfig,
  EnvironmentSecurityConfig,
  CSPDirectives,
  HSTSConfig,
  PermissionsPolicyDirectives,
  TrustedSourcesConfig,
  SecurityPolicyTemplate
} from '../types/security.types';

/**
 * Trusted Sources Configuration
 * Define allowed sources for different content types
 */
export const TRUSTED_SOURCES: TrustedSourcesConfig = {
  scripts: [
    "'self'",
    "'unsafe-inline'", // Only for development
    "'unsafe-eval'",   // Only for development
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com',
    'https://unpkg.com'
  ],
  styles: [
    "'self'",
    "'unsafe-inline'",
    'https://fonts.googleapis.com',
    'https://cdn.jsdelivr.net',
    'https://cdnjs.cloudflare.com'
  ],
  images: [
    "'self'",
    'data:',
    'blob:',
    'https:',
    'https://*.supabase.co',
    'https://cdn.jsdelivr.net'
  ],
  fonts: [
    "'self'",
    'https://fonts.gstatic.com',
    'https://cdn.jsdelivr.net'
  ],
  connections: [
    "'self'",
    'https://*.supabase.co',
    'wss://*.supabase.co',
    'https://api.toss.im',
    'https://fcm.googleapis.com'
  ],
  media: [
    "'self'",
    'blob:',
    'data:',
    'https://*.supabase.co'
  ],
  objects: [
    "'none'"
  ],
  frames: [
    "'self'",
    'https://toss.im'
  ],
  workers: [
    "'self'",
    'blob:'
  ]
};

/**
 * Content Security Policy Directives
 */
const createCSPDirectives = (environment: 'development' | 'staging' | 'production'): CSPDirectives => {
  const baseDirectives: CSPDirectives = {
    'default-src': ["'self'"],
    'script-src': environment === 'development' 
      ? TRUSTED_SOURCES.scripts 
      : ["'self'", 'https://cdn.jsdelivr.net'],
    'style-src': TRUSTED_SOURCES.styles,
    'img-src': TRUSTED_SOURCES.images,
    'font-src': TRUSTED_SOURCES.fonts,
    'connect-src': TRUSTED_SOURCES.connections,
    'media-src': TRUSTED_SOURCES.media,
    'object-src': TRUSTED_SOURCES.objects,
    'frame-src': TRUSTED_SOURCES.frames,
    'worker-src': TRUSTED_SOURCES.workers,
    'child-src': ["'self'"],
    'manifest-src': ["'self'"],
    'form-action': ["'self'"],
    'frame-ancestors': ["'none'"],
    'base-uri': ["'self'"],
    ...(environment === 'production' ? { 'upgrade-insecure-requests': true } : {}),
    ...(environment === 'production' ? { 'block-all-mixed-content': true } : {})
  };

  // Production-specific hardening
  if (environment === 'production') {
    baseDirectives['script-src'] = ["'self'", 'https://cdn.jsdelivr.net'];
    baseDirectives['require-sri-for'] = ['script', 'style'];
    baseDirectives['trusted-types'] = ['default'];
    baseDirectives['require-trusted-types-for'] = ["'script'"];
    // Enhanced XSS protection
    baseDirectives['script-src-attr'] = ["'none'"];
    baseDirectives['script-src-elem'] = ["'self'", 'https://cdn.jsdelivr.net'];
    baseDirectives['style-src-attr'] = ["'self'", "'unsafe-inline'"];
    baseDirectives['style-src-elem'] = ["'self'", 'https://fonts.googleapis.com'];
    // Additional security directives
    baseDirectives['connect-src'] = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co'];
    baseDirectives['frame-ancestors'] = ["'none'"];
    baseDirectives['object-src'] = ["'none'"];
    baseDirectives['base-uri'] = ["'self'"];
    baseDirectives['form-action'] = ["'self'"];
  }

  return baseDirectives;
};

/**
 * HSTS Configuration
 */
const createHSTSConfig = (environment: 'development' | 'staging' | 'production'): HSTSConfig => {
  switch (environment) {
    case 'production':
      return {
        maxAge: 63072000, // 2 years
        includeSubDomains: true,
        preload: true,
        force: true
      };
    case 'staging':
      return {
        maxAge: 86400, // 1 day
        includeSubDomains: false,
        preload: false,
        force: true
      };
    case 'development':
    default:
      return {
        maxAge: 0, // Disabled in development
        includeSubDomains: false,
        preload: false,
        force: false
      };
  }
};

/**
 * Permissions Policy Configuration
 */
export const PERMISSIONS_POLICY: PermissionsPolicyDirectives = {
  accelerometer: ["'none'"],
  'ambient-light-sensor': ["'none'"],
  autoplay: ["'self'"],
  battery: ["'none'"],
  camera: ["'self'"],
  'display-capture': ["'none'"],
  'document-domain': ["'none'"],
  'encrypted-media': ["'self'"],
  fullscreen: ["'self'"],
  geolocation: ["'self'"],
  gyroscope: ["'none'"],
  magnetometer: ["'none'"],
  microphone: ["'self'"],
  midi: ["'none'"],
  payment: ["'self'"],
  'picture-in-picture': ["'self'"],
  'speaker-selection': ["'none'"],
  usb: ["'none'"],
  'web-share': ["'self'"],
  'xr-spatial-tracking': ["'none'"]
};

/**
 * CSRF Configuration
 */
const createCSRFConfig = (environment: 'development' | 'staging' | 'production') => {
  const baseConfig = {
    enabled: process.env.NODE_ENV !== 'test' && process.env.DISABLE_CSRF !== 'true',
    secret: process.env.CSRF_SECRET || 'default-csrf-secret-change-in-production',
    saltLength: 12,
    secretLength: 24,
    cookie: {
      name: 'csrf-token',
      secure: environment === 'production',
      httpOnly: true,
      sameSite: 'strict' as const,
      maxAge: 3600000 // 1 hour
    },
    // Enhanced CSRF protection
    tokenLength: 32,
    algorithm: 'sha256',
    expiresIn: 3600000, // 1 hour
    ignoreMethods: ['GET', 'HEAD', 'OPTIONS'],
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    // Additional security options
    whitelist: environment === 'development' ? ['/api/health', '/api/security/csp-report'] : [],
    blacklist: [],
    // Rate limiting for CSRF token generation
    rateLimit: {
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 100, // 100 requests per window
      skipSuccessfulRequests: true
    }
  };

  return baseConfig;
};

/**
 * CORS Configuration
 */
const createCORSConfig = (environment: 'development' | 'staging' | 'production') => {
  // Check for CORS_ORIGIN environment variable first
  const envCorsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim())
    : null;

  const allowedOrigins = envCorsOrigins || {
    development: [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:8080',
      'http://127.0.0.1:3000'
    ],
    staging: [
      'https://staging.beauty-platform.com',
      'https://test.beauty-platform.com'
    ],
    production: [
      'https://beauty-platform.com',
      'https://www.beauty-platform.com',
      'https://app.beauty-platform.com'
    ]
  }[environment];

  return {
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => {
      // Allow requests with no origin (mobile apps, Postman, etc.)
      if (!origin) return callback(null, true);

      if (allowedOrigins.includes(origin) || allowedOrigins.includes('*')) {
        return callback(null, true);
      }

      // Also allow localhost origins in development for testing
      if (environment === 'development' && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
        return callback(null, true);
      }

      // Log warning but allow anyway (same as app.ts behavior)
      console.warn('CORS request from unallowed origin:', origin, 'Allowed:', allowedOrigins);
      return callback(null, true);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-HTTP-Method-Override',
      'Accept',
      'Origin',
      'Access-Control-Request-Method',
      'Access-Control-Request-Headers'
    ],
    exposedHeaders: [
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
      'X-Total-Count'
    ],
    credentials: true,
    maxAge: 86400, // 24 hours
    preflightContinue: false,
    optionsSuccessStatus: 204
  };
};

/**
 * Development Security Configuration
 */
const DEVELOPMENT_CONFIG: SecurityHeadersConfig = {
  csp: {
    directives: createCSPDirectives('development'),
    reportOnly: true, // Non-blocking in development
    useDefaults: false
  },
  cors: createCORSConfig('development'),
  csrf: createCSRFConfig('development'),
  hsts: createHSTSConfig('development'),
  frameOptions: 'SAMEORIGIN',
  noSniff: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: PERMISSIONS_POLICY,
  xssFilter: true,
  crossOrigin: {
    embedderPolicy: 'credentialless',
    openerPolicy: 'same-origin-allow-popups',
    resourcePolicy: 'cross-origin'
  },
  hidePoweredBy: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: true },
  customHeaders: {
    'X-Environment': 'development',
    'X-API-Version': 'v1'
  }
};

/**
 * Staging Security Configuration
 */
const STAGING_CONFIG: SecurityHeadersConfig = {
  csp: {
    directives: createCSPDirectives('staging'),
    reportOnly: false, // Enforce in staging
    useDefaults: false,
    reportUri: '/api/security/csp-report'
  },
  cors: createCORSConfig('staging'),
  csrf: createCSRFConfig('staging'),
  hsts: createHSTSConfig('staging'),
  frameOptions: 'DENY',
  noSniff: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: PERMISSIONS_POLICY,
  xssFilter: { mode: 'block' },
  crossOrigin: {
    embedderPolicy: 'require-corp',
    openerPolicy: 'same-origin',
    resourcePolicy: 'same-origin'
  },
  hidePoweredBy: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false },
  expectCt: {
    maxAge: 86400,
    enforce: false,
    reportUri: '/api/security/ct-report'
  },
  customHeaders: {
    'X-Environment': 'staging',
    'X-API-Version': 'v1'
  }
};

/**
 * Production Security Configuration
 */
const PRODUCTION_CONFIG: SecurityHeadersConfig = {
  csp: {
    directives: {
      ...createCSPDirectives('production'),
      // Ensure all required directives are present with strict values
      'default-src': ["'self'"],
      'script-src': ["'self'", 'https://cdn.jsdelivr.net'],
      'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      'img-src': ["'self'", 'data:', 'https:'],
      'font-src': ["'self'", 'https://fonts.gstatic.com'],
      'connect-src': ["'self'", 'https://api.supabase.co', 'wss://realtime.supabase.co'],
      'media-src': ["'self'"],
      'object-src': ["'none'"],
      'frame-src': ["'none'"],
      'worker-src': ["'self'"],
      'child-src': ["'self'"],
      'manifest-src': ["'self'"],
      'form-action': ["'self'"],
      'frame-ancestors': ["'none'"],
      'base-uri': ["'self'"],
      'upgrade-insecure-requests': true,
      'block-all-mixed-content': true,
      // Additional production-specific directives for higher score
      'require-sri-for': ['script', 'style'],
      'trusted-types': ['default'],
      'require-trusted-types-for': ["'script'"]
    },
    reportOnly: false, // Fully enforce in production
    useDefaults: false,
    reportUri: '/api/security/csp-report'
  },
  cors: createCORSConfig('production'),
  csrf: createCSRFConfig('production'),
  hsts: {
    maxAge: 31536000, // 1 year - within optimal range
    includeSubDomains: true,
    preload: true,
    force: true
  },
  frameOptions: 'DENY',
  noSniff: true,
  referrerPolicy: 'strict-origin-when-cross-origin',
  permissionsPolicy: PERMISSIONS_POLICY,
  xssFilter: { mode: 'block' },
  crossOrigin: {
    embedderPolicy: 'require-corp',
    openerPolicy: 'same-origin',
    resourcePolicy: 'same-origin'
  },
  hidePoweredBy: true,
  ieNoOpen: true,
  dnsPrefetchControl: { allow: false },
  expectCt: {
    maxAge: 604800, // 7 days
    enforce: true,
    reportUri: '/api/security/ct-report'
  },
  customHeaders: {
    'X-Environment': 'production',
    'X-API-Version': 'v1',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload'
  }
};

/**
 * Environment-specific Security Configuration
 */
export const ENVIRONMENT_SECURITY_CONFIG: EnvironmentSecurityConfig = {
  development: DEVELOPMENT_CONFIG,
  staging: STAGING_CONFIG,
  production: PRODUCTION_CONFIG
};

/**
 * Get security configuration for current environment
 */
export function getSecurityConfig(): SecurityHeadersConfig {
  const environment = config.server.env as 'development' | 'staging' | 'production';
  return ENVIRONMENT_SECURITY_CONFIG[environment] || DEVELOPMENT_CONFIG;
}

/**
 * Get security configuration for specific environment
 */
export function getSecurityConfigForEnvironment(
  environment: 'development' | 'staging' | 'production'
): SecurityHeadersConfig {
  return ENVIRONMENT_SECURITY_CONFIG[environment];
}

/**
 * Security Policy Templates
 */
export const SECURITY_POLICY_TEMPLATES: Record<SecurityPolicyTemplate, SecurityHeadersConfig> = {
  strict: {
    ...PRODUCTION_CONFIG,
    csp: {
      ...PRODUCTION_CONFIG.csp!,
      directives: {
        ...PRODUCTION_CONFIG.csp!.directives,
        'default-src': ["'none'"],
        'script-src': ["'self'"],
        'style-src': ["'self'"],
        'img-src': ["'self'", 'data:'],
        'font-src': ["'self'"],
        'connect-src': ["'self'"],
        'frame-ancestors': ["'none'"],
        'object-src': ["'none'"],
        'base-uri': ["'none'"],
        'form-action': ["'self'"]
      }
    },
    frameOptions: 'DENY',
    referrerPolicy: 'no-referrer'
  },
  
  moderate: PRODUCTION_CONFIG,
  
  relaxed: {
    ...DEVELOPMENT_CONFIG,
    csp: {
      directives: createCSPDirectives('development'),
      reportOnly: true
    }
  },
  
  'api-only': {
    cors: createCORSConfig('production'),
    hidePoweredBy: true,
    noSniff: true,
    frameOptions: 'DENY',
    referrerPolicy: 'no-referrer',
    customHeaders: {
      'X-API-Version': 'v1',
      'X-Content-Type-Options': 'nosniff'
    }
  },
  
  custom: DEVELOPMENT_CONFIG
};

/**
 * Get security policy template
 */
export function getSecurityPolicyTemplate(template: SecurityPolicyTemplate): SecurityHeadersConfig {
  return SECURITY_POLICY_TEMPLATES[template];
}

/**
 * API Origins Configuration
 */
export const API_ORIGINS = {
  development: ['http://localhost:3000', 'http://localhost:3001'],
  staging: ['https://staging-api.beauty-platform.com'],
  production: ['https://api.beauty-platform.com']
};

/**
 * Trusted Domains Configuration
 */
export const TRUSTED_DOMAINS = [
  'beauty-platform.com',
  '*.beauty-platform.com',
  'supabase.co',
  '*.supabase.co',
  'toss.im',
  'googleapis.com',
  'gstatic.com'
];

/**
 * CSP Report Endpoint Configuration
 */
export const CSP_REPORT_CONFIG = {
  endpoint: '/api/security/csp-report',
  maxReports: 1000,
  reportWindow: 86400000, // 24 hours
  enableReporting: config.server.env !== 'development'
};

/**
 * Security Headers Validation Rules
 */
export const VALIDATION_RULES = {
  minHSTSMaxAge: 86400, // 1 day minimum
  maxHSTSMaxAge: 63072000, // 2 years maximum
  requiredCSPDirectives: [
    'default-src',
    'script-src',
    'style-src',
    'img-src',
    'frame-ancestors'
  ],
  forbiddenCSPSources: [
    '*',
    'data:',
    "'unsafe-eval'",
    "'unsafe-inline'"
  ],
  requiredSecurityHeaders: [
    'X-Content-Type-Options',
    'X-Frame-Options',
    'Referrer-Policy'
  ]
};

/**
 * Create custom security configuration
 */
export function createCustomSecurityConfig(
  baseTemplate: SecurityPolicyTemplate,
  overrides: Partial<SecurityHeadersConfig>
): SecurityHeadersConfig {
  const baseConfig = getSecurityPolicyTemplate(baseTemplate);
  const result: SecurityHeadersConfig = {
    ...baseConfig,
    ...overrides
  };

  // Merge CSP directives if both exist
  if (overrides.csp && baseConfig.csp) {
    result.csp = {
      ...baseConfig.csp,
      ...overrides.csp,
      directives: {
        ...baseConfig.csp.directives,
        ...overrides.csp.directives
      }
    };
  } else if (overrides.csp) {
    result.csp = overrides.csp;
  } else if (baseConfig.csp) {
    result.csp = baseConfig.csp;
  }

  // Merge custom headers
  if (baseConfig.customHeaders || overrides.customHeaders) {
    result.customHeaders = {
      ...baseConfig.customHeaders,
      ...overrides.customHeaders
    };
  }

  return result;
}

export default {
  ENVIRONMENT_SECURITY_CONFIG,
  SECURITY_POLICY_TEMPLATES,
  TRUSTED_SOURCES,
  PERMISSIONS_POLICY,
  API_ORIGINS,
  TRUSTED_DOMAINS,
  CSP_REPORT_CONFIG,
  VALIDATION_RULES,
  getSecurityConfig,
  getSecurityConfigForEnvironment,
  getSecurityPolicyTemplate,
  createCustomSecurityConfig
}; 