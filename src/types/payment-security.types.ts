/**
 * Payment Security Types
 * 
 * Comprehensive type definitions for payment security, fraud detection,
 * and monitoring systems for the beauty service platform.
 */

// =============================================
// FRAUD DETECTION TYPES
// =============================================

export type FraudRiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type FraudDetectionType = 
  | 'velocity_check' 
  | 'amount_limit' 
  | 'geolocation_mismatch' 
  | 'device_fingerprint' 
  | 'behavioral_analysis' 
  | 'ip_reputation' 
  | 'card_velocity' 
  | 'user_pattern' 
  | 'time_anomaly' 
  | 'amount_anomaly';

export type FraudAction = 
  | 'allow' 
  | 'block' 
  | 'review' 
  | 'challenge' 
  | 'limit' 
  | 'monitor';

export type SecurityAlertType = 
  | 'fraud_detected' 
  | 'suspicious_activity' 
  | 'rate_limit_exceeded' 
  | 'geolocation_violation' 
  | 'device_mismatch' 
  | 'ip_blacklisted' 
  | 'user_suspended' 
  | 'payment_failed' 
  | 'webhook_failure' 
  | 'system_error';

export type SecurityAlertSeverity = 'info' | 'warning' | 'error' | 'critical';

export interface FraudDetectionRule {
  id: string;
  name: string;
  description: string;
  detectionType: FraudDetectionType;
  conditions: FraudDetectionCondition[];
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  isActive: boolean;
  priority: number;
  createdAt: string;
  updatedAt: string;
}

export interface FraudDetectionCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'regex';
  value: any;
  timeWindow?: number; // in minutes
  threshold?: number;
}

export interface FraudDetectionResult {
  ruleId: string;
  ruleName: string;
  detectionType: FraudDetectionType;
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  confidence: number; // 0-100
  triggeredAt: string;
  details: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface SecurityAlert {
  id: string;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  title: string;
  message: string;
  userId?: string;
  paymentId?: string;
  reservationId?: string;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: {
    country: string;
    region: string;
    city: string;
    latitude: number;
    longitude: number;
  };
  metadata?: Record<string, any>;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// VELOCITY CHECKING TYPES
// =============================================

export interface VelocityCheck {
  id: string;
  userId?: string;
  ipAddress?: string;
  deviceId?: string;
  cardHash?: string;
  checkType: 'payment_amount' | 'payment_count' | 'login_attempts' | 'failed_payments' | 'refund_requests';
  timeWindow: number; // in minutes
  threshold: number;
  currentCount: number;
  isExceeded: boolean;
  lastUpdated: string;
  createdAt: string;
}

export interface VelocityRule {
  id: string;
  name: string;
  checkType: 'payment_amount' | 'payment_count' | 'login_attempts' | 'failed_payments' | 'refund_requests';
  timeWindow: number; // in minutes
  threshold: number;
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  isActive: boolean;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// GEOLOCATION SECURITY TYPES
// =============================================

export interface GeolocationData {
  ipAddress: string;
  country: string;
  region: string;
  city: string;
  latitude: number;
  longitude: number;
  timezone: string;
  isp: string;
  organization: string;
  asn: string;
  isProxy: boolean;
  isVpn: boolean;
  isTor: boolean;
  riskScore: number; // 0-100
  lastUpdated: string;
}

export interface GeolocationRule {
  id: string;
  name: string;
  description: string;
  allowedCountries: string[];
  blockedCountries: string[];
  allowedRegions?: string[];
  blockedRegions?: string[];
  maxDistanceKm?: number; // Maximum distance from user's usual location
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// DEVICE FINGERPRINTING TYPES
// =============================================

export interface DeviceFingerprint {
  id: string;
  userId?: string;
  fingerprint: string;
  userAgent: string;
  screenResolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: boolean;
  canvasFingerprint?: string;
  webglFingerprint?: string;
  audioFingerprint?: string;
  fontList?: string[];
  plugins?: string[];
  riskScore: number; // 0-100
  isSuspicious: boolean;
  lastSeen: string;
  createdAt: string;
  updatedAt: string;
}

export interface DeviceRule {
  id: string;
  name: string;
  description: string;
  maxDevicesPerUser: number;
  suspiciousPatterns: string[];
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// =============================================
// PAYMENT SECURITY MONITORING TYPES
// =============================================

export interface PaymentSecurityEvent {
  id: string;
  eventType: 'payment_initiated' | 'payment_confirmed' | 'payment_failed' | 'payment_refunded' | 'fraud_detected' | 'security_alert';
  paymentId?: string;
  userId?: string;
  reservationId?: string;
  amount?: number;
  currency?: string;
  paymentMethod?: string;
  ipAddress?: string;
  userAgent?: string;
  geolocation?: GeolocationData;
  deviceFingerprint?: string;
  riskScore: number; // 0-100
  fraudDetected: boolean;
  securityAlerts: SecurityAlert[];
  metadata?: Record<string, any>;
  timestamp: string;
}

export interface SecurityMonitoringConfig {
  id: string;
  name: string;
  description: string;
  isEnabled: boolean;
  alertThreshold: number; // Risk score threshold for alerts
  autoBlockThreshold: number; // Risk score threshold for auto-blocking
  monitoringInterval: number; // in minutes
  retentionDays: number; // How long to keep monitoring data
  notificationChannels: string[]; // email, slack, webhook, etc.
  createdAt: string;
  updatedAt: string;
}

export interface SecurityMetrics {
  totalPayments: number;
  totalFraudDetected: number;
  totalSecurityAlerts: number;
  averageRiskScore: number;
  fraudRate: number; // percentage
  topRiskFactors: Array<{
    factor: string;
    count: number;
    percentage: number;
  }>;
  topBlockedCountries: Array<{
    country: string;
    count: number;
    percentage: number;
  }>;
  topSuspiciousIPs: Array<{
    ipAddress: string;
    count: number;
    riskScore: number;
  }>;
  timeRange: {
    start: string;
    end: string;
  };
}

// =============================================
// ERROR HANDLING TYPES
// =============================================

export type PaymentErrorType = 
  | 'network_error' 
  | 'api_error' 
  | 'validation_error' 
  | 'authentication_error' 
  | 'authorization_error' 
  | 'rate_limit_error' 
  | 'fraud_detection_error' 
  | 'system_error' 
  | 'timeout_error' 
  | 'webhook_error';

export interface PaymentError {
  id: string;
  errorType: PaymentErrorType;
  errorCode: string;
  errorMessage: string;
  errorDetails?: string;
  paymentId?: string;
  userId?: string;
  reservationId?: string;
  requestData?: Record<string, any>;
  responseData?: Record<string, any>;
  stackTrace?: string;
  isResolved: boolean;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ErrorHandlingConfig {
  id: string;
  errorType: PaymentErrorType;
  retryEnabled: boolean;
  maxRetries: number;
  retryDelay: number; // in seconds
  exponentialBackoff: boolean;
  alertOnFailure: boolean;
  autoResolve: boolean;
  autoResolveAfter: number; // in minutes
  createdAt: string;
  updatedAt: string;
}

// =============================================
// COMPLIANCE AND AUDIT TYPES
// =============================================

export interface ComplianceReport {
  id: string;
  reportType: 'fraud_summary' | 'security_audit' | 'compliance_check' | 'risk_assessment';
  timeRange: {
    start: string;
    end: string;
  };
  summary: {
    totalTransactions: number;
    totalFraudDetected: number;
    totalSecurityAlerts: number;
    averageRiskScore: number;
    complianceScore: number; // 0-100
  };
  details: Record<string, any>;
  recommendations: string[];
  generatedBy: string;
  createdAt: string;
}

export interface AuditLog {
  id: string;
  action: string;
  resourceType: 'payment' | 'user' | 'fraud_rule' | 'security_alert' | 'compliance_report';
  resourceId: string;
  userId?: string;
  adminId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

// =============================================
// API REQUEST/RESPONSE TYPES
// =============================================

export interface FraudDetectionRequest {
  paymentId: string;
  userId: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  ipAddress: string;
  userAgent: string;
  geolocation?: GeolocationData;
  deviceFingerprint?: string;
  metadata?: Record<string, any>;
}

export interface FraudDetectionResponse {
  isAllowed: boolean;
  riskScore: number; // 0-100
  riskLevel: FraudRiskLevel;
  action: FraudAction;
  detectedRules: FraudDetectionResult[];
  securityAlerts: SecurityAlert[];
  recommendations: string[];
  metadata?: Record<string, any>;
}

export interface SecurityMonitoringRequest {
  eventType: string;
  paymentId?: string;
  userId?: string;
  data: Record<string, any>;
}

export interface SecurityMonitoringResponse {
  success: boolean;
  alertsGenerated: number;
  riskScore: number;
  recommendations: string[];
}

// =============================================
// DATABASE TABLE INTERFACES
// =============================================

export interface FraudDetectionRuleRecord {
  id: string;
  name: string;
  description: string;
  detection_type: FraudDetectionType;
  conditions: Record<string, any>; // JSONB
  risk_level: FraudRiskLevel;
  action: FraudAction;
  is_active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}

export interface SecurityAlertRecord {
  id: string;
  type: SecurityAlertType;
  severity: SecurityAlertSeverity;
  title: string;
  message: string;
  user_id?: string;
  payment_id?: string;
  reservation_id?: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: Record<string, any>; // JSONB
  metadata?: Record<string, any>; // JSONB
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  created_at: string;
  updated_at: string;
}

export interface VelocityCheckRecord {
  id: string;
  user_id?: string;
  ip_address?: string;
  device_id?: string;
  card_hash?: string;
  check_type: string;
  time_window: number;
  threshold: number;
  current_count: number;
  is_exceeded: boolean;
  last_updated: string;
  created_at: string;
}

export interface DeviceFingerprintRecord {
  id: string;
  user_id?: string;
  fingerprint: string;
  user_agent: string;
  screen_resolution: string;
  timezone: string;
  language: string;
  platform: string;
  cookie_enabled: boolean;
  do_not_track: boolean;
  canvas_fingerprint?: string;
  webgl_fingerprint?: string;
  audio_fingerprint?: string;
  font_list?: string[];
  plugins?: string[];
  risk_score: number;
  is_suspicious: boolean;
  last_seen: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentSecurityEventRecord {
  id: string;
  event_type: string;
  payment_id?: string;
  user_id?: string;
  reservation_id?: string;
  amount?: number;
  currency?: string;
  payment_method?: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: Record<string, any>; // JSONB
  device_fingerprint?: string;
  risk_score: number;
  fraud_detected: boolean;
  security_alerts: Record<string, any>[]; // JSONB
  metadata?: Record<string, any>; // JSONB
  timestamp: string;
}

export interface PaymentErrorRecord {
  id: string;
  error_type: PaymentErrorType;
  error_code: string;
  error_message: string;
  error_details?: string;
  payment_id?: string;
  user_id?: string;
  reservation_id?: string;
  request_data?: Record<string, any>; // JSONB
  response_data?: Record<string, any>; // JSONB
  stack_trace?: string;
  is_resolved: boolean;
  resolved_at?: string;
  resolved_by?: string;
  resolution_notes?: string;
  created_at: string;
  updated_at: string;
}

export interface ComplianceReportRecord {
  id: string;
  report_type: string;
  time_range: Record<string, any>; // JSONB
  summary: Record<string, any>; // JSONB
  details: Record<string, any>; // JSONB
  recommendations: string[];
  generated_by: string;
  created_at: string;
}

export interface AuditLogRecord {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  user_id?: string;
  admin_id?: string;
  old_values?: Record<string, any>; // JSONB
  new_values?: Record<string, any>; // JSONB
  ip_address?: string;
  user_agent?: string;
  metadata?: Record<string, any>; // JSONB
  timestamp: string;
} 