/**
 * Security Headers Types
 * 
 * Comprehensive type definitions for security headers middleware
 * including Content Security Policy, CORS, and various security configurations
 */

import { CorsOptions } from 'cors';

// Content Security Policy (CSP) configuration
export interface CSPDirectives {
  'default-src'?: string[];
  'script-src'?: string[];
  'style-src'?: string[];
  'img-src'?: string[];
  'font-src'?: string[];
  'connect-src'?: string[];
  'media-src'?: string[];
  'object-src'?: string[];
  'child-src'?: string[];
  'frame-src'?: string[];
  'worker-src'?: string[];
  'manifest-src'?: string[];
  'prefetch-src'?: string[];
  'form-action'?: string[];
  'frame-ancestors'?: string[];
  'base-uri'?: string[];
  'report-uri'?: string[];
  'report-to'?: string[];
  'upgrade-insecure-requests'?: boolean;
  'block-all-mixed-content'?: boolean;
  'require-sri-for'?: string[];
  'trusted-types'?: string[];
  'require-trusted-types-for'?: string[];
  'sandbox'?: string[];
}

export interface CSPConfig {
  directives: CSPDirectives;
  reportOnly?: boolean;
  setAllHeaders?: boolean;
  disableAndroid?: boolean;
  nonce?: boolean;
  reportUri?: string;
  useDefaults?: boolean;
}

// HSTS (HTTP Strict Transport Security) configuration
export interface HSTSConfig {
  maxAge: number;
  includeSubDomains?: boolean;
  preload?: boolean;
  force?: boolean;
}

// X-Frame-Options configuration
export type FrameOptionsValue = 'DENY' | 'SAMEORIGIN' | { action: 'ALLOW-FROM'; domain: string };

// Referrer Policy configuration
export type ReferrerPolicyValue = 
  | 'no-referrer'
  | 'no-referrer-when-downgrade'
  | 'origin'
  | 'origin-when-cross-origin'
  | 'same-origin'
  | 'strict-origin'
  | 'strict-origin-when-cross-origin'
  | 'unsafe-url';

// Permissions Policy (formerly Feature Policy) configuration
export interface PermissionsPolicyDirectives {
  accelerometer?: string[];
  'ambient-light-sensor'?: string[];
  autoplay?: string[];
  battery?: string[];
  camera?: string[];
  'cross-origin-isolated'?: string[];
  'display-capture'?: string[];
  'document-domain'?: string[];
  'encrypted-media'?: string[];
  'execution-while-not-rendered'?: string[];
  'execution-while-out-of-viewport'?: string[];
  fullscreen?: string[];
  geolocation?: string[];
  gyroscope?: string[];
  'hid'?: string[];
  'idle-detection'?: string[];
  'local-fonts'?: string[];
  magnetometer?: string[];
  microphone?: string[];
  midi?: string[];
  'navigation-override'?: string[];
  'otp-credentials'?: string[];
  payment?: string[];
  'picture-in-picture'?: string[];
  'publickey-credentials-get'?: string[];
  'screen-wake-lock'?: string[];
  serial?: string[];
  'speaker-selection'?: string[];
  'storage-access'?: string[];
  usb?: string[];
  'web-share'?: string[];
  'xr-spatial-tracking'?: string[];
}

// Cross-Origin configuration
export interface CrossOriginConfig {
  embedderPolicy?: 'require-corp' | 'credentialless';
  openerPolicy?: 'same-origin' | 'same-origin-allow-popups' | 'unsafe-none';
  resourcePolicy?: 'same-site' | 'same-origin' | 'cross-origin';
}

// Comprehensive security headers configuration
export interface SecurityHeadersConfig {
  // Content Security Policy
  csp?: CSPConfig;
  
  // CORS configuration
  cors?: CorsOptions;
  
  // HTTP Strict Transport Security
  hsts?: HSTSConfig;
  
  // X-Frame-Options
  frameOptions?: FrameOptionsValue;
  
  // X-Content-Type-Options
  noSniff?: boolean;
  
  // Referrer-Policy
  referrerPolicy?: ReferrerPolicyValue | ReferrerPolicyValue[];
  
  // Permissions-Policy
  permissionsPolicy?: PermissionsPolicyDirectives;
  
  // X-XSS-Protection (deprecated but still useful for older browsers)
  xssFilter?: boolean | { mode?: 'block'; reportUri?: string };
  
  // Cross-Origin policies
  crossOrigin?: CrossOriginConfig;
  
  // X-Powered-By header removal
  hidePoweredBy?: boolean;
  
  // X-Download-Options
  ieNoOpen?: boolean;
  
  // X-DNS-Prefetch-Control
  dnsPrefetchControl?: boolean | { allow: boolean };
  
  // Expect-CT header
  expectCt?: {
    maxAge: number;
    enforce?: boolean;
    reportUri?: string;
  };
  
  // Custom headers
  customHeaders?: Record<string, string>;
}

// Environment-specific security configurations
export interface EnvironmentSecurityConfig {
  development: SecurityHeadersConfig;
  staging: SecurityHeadersConfig;
  production: SecurityHeadersConfig;
}

// Security headers middleware options
export interface SecurityMiddlewareOptions {
  config?: SecurityHeadersConfig;
  environment?: 'development' | 'staging' | 'production';
  customConfig?: Partial<SecurityHeadersConfig>;
  enableCSPReporting?: boolean;
  cspReportEndpoint?: string;
  enableSecurityLogging?: boolean;
  trustedDomains?: string[];
  apiOrigins?: string[];
}

// CSP violation report structure
export interface CSPViolationReport {
  'document-uri': string;
  referrer: string;
  'violated-directive': string;
  'effective-directive': string;
  'original-policy': string;
  disposition: 'enforce' | 'report';
  'blocked-uri': string;
  'line-number'?: number;
  'column-number'?: number;
  'source-file'?: string;
  'status-code': number;
  'script-sample'?: string;
}

// Security headers validation result
export interface SecurityValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
  recommendations: string[];
  score: number; // Security score out of 100
}

// Security audit log entry
export interface SecurityAuditLog {
  timestamp: Date;
  ip: string;
  userAgent?: string;
  userId?: string;
  violation: {
    type: 'csp' | 'cors' | 'frame-options' | 'mixed-content' | 'other';
    description: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    blockedUri?: string;
    violatedDirective?: string;
  };
  headers: Record<string, string>;
  url: string;
  method: string;
}

// CORS preflight cache configuration
export interface CORSPreflightConfig {
  maxAge: number;
  methods: string[];
  headers: string[];
  exposedHeaders?: string[];
  credentials: boolean;
}

// Security headers reporting configuration
export interface SecurityReportingConfig {
  endpoint: string;
  includeSubdomains?: boolean;
  reportTo?: string;
  maxAge?: number;
  failureReportingEnabled?: boolean;
}

// Trusted sources configuration
export interface TrustedSourcesConfig {
  scripts: string[];
  styles: string[];
  images: string[];
  fonts: string[];
  connections: string[];
  media: string[];
  objects: string[];
  frames: string[];
  workers: string[];
}

// Security policy templates
export type SecurityPolicyTemplate = 'strict' | 'moderate' | 'relaxed' | 'api-only' | 'custom';

// Security headers response
export interface SecurityHeadersResponse {
  headers: Record<string, string>;
  violations: CSPViolationReport[];
  auditLog: SecurityAuditLog[];
  validationResult: SecurityValidationResult;
}

// Error types
export class SecurityConfigError extends Error {
  constructor(message: string, public configKey?: string) {
    super(message);
    this.name = 'SecurityConfigError';
  }
}

export class CSPViolationError extends Error {
  constructor(
    message: string,
    public violation: CSPViolationReport,
    public severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'
  ) {
    super(message);
    this.name = 'CSPViolationError';
  }
}

export class CORSViolationError extends Error {
  constructor(
    message: string,
    public origin: string,
    public method: string,
    public headers?: string[]
  ) {
    super(message);
    this.name = 'CORSViolationError';
  }
}

// Security metrics
export interface SecurityMetrics {
  totalRequests: number;
  blockedRequests: number;
  cspViolations: number;
  corsViolations: number;
  frameOptionsBlocks: number;
  mixedContentBlocks: number;
  securityScore: number;
  lastUpdated: Date;
  topViolatingDomains: Array<{
    domain: string;
    violations: number;
    lastViolation: Date;
  }>;
}

// Browser compatibility configuration
export interface BrowserCompatConfig {
  supportLegacyBrowsers: boolean;
  minimumTLSVersion: '1.2' | '1.3';
  enableLegacyCSP: boolean;
  enableXSSProtection: boolean;
  enableFrameOptions: boolean;
}

// Dynamic security configuration
export interface DynamicSecurityConfig {
  enableAdaptiveCSP: boolean;
  enableThreatDetection: boolean;
  autoBlockSuspiciousDomains: boolean;
  adaptiveHSTSMaxAge: boolean;
  enableGeoBlocking: boolean;
  geoBlockedCountries?: string[];
} 