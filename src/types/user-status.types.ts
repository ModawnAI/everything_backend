/**
 * User Status Validation Types
 * 
 * Comprehensive type definitions for user account status validation,
 * including status checks, business rules, and middleware configurations
 */

import { Request } from 'express';

// User account status enumeration
export type UserAccountStatus = 
  | 'active'
  | 'suspended'
  | 'banned'
  | 'pending_verification'
  | 'deactivated'
  | 'locked'
  | 'inactive'
  | 'pending_approval';

// User verification status
export type UserVerificationStatus = 
  | 'verified'
  | 'pending'
  | 'rejected'
  | 'expired'
  | 'none';

// Shop verification status (for shop owners)
export type ShopVerificationStatus = 
  | 'approved'
  | 'pending'
  | 'rejected'
  | 'suspended'
  | 'under_review';

// Business rule types
export type StatusCheckRule = 
  | 'require_active'
  | 'require_verified'
  | 'allow_pending_verification'
  | 'require_shop_approved'
  | 'allow_inactive'
  | 'require_complete_profile'
  | 'require_payment_verified';

// User status validation context
export interface UserStatusContext {
  userId: string;
  accountStatus: UserAccountStatus;
  verificationStatus: UserVerificationStatus;
  emailVerifiedAt?: Date;
  phoneVerifiedAt?: Date;
  lastLoginAt?: Date;
  suspendedAt?: Date;
  suspendedUntil?: Date;
  suspensionReason?: string;
  bannedAt?: Date;
  banReason?: string;
  profileCompleteness: number; // 0-100 percentage
  paymentMethodVerified: boolean;
  shopVerificationStatus?: ShopVerificationStatus;
  influencerTier?: string;
  riskScore: number; // 0-100, higher = more risky
  lastStatusCheck: Date;
  consecutiveFailedLogins: number;
  requiresPasswordReset: boolean;
  agreedToTermsAt?: Date;
  agreedToPrivacyAt?: Date;
}

// Status validation result
export interface StatusValidationResult {
  isValid: boolean;
  status: UserAccountStatus;
  verificationStatus: UserVerificationStatus;
  canAccess: boolean;
  requiresAction: boolean;
  blockedReason?: string;
  actionRequired?: StatusAction;
  expiresAt?: Date;
  warnings: string[];
  recommendations: string[];
  nextCheckTime: Date;
}

// Required status action
export interface StatusAction {
  type: 'verify_email' | 'verify_phone' | 'complete_profile' | 'accept_terms' | 'reset_password' | 'contact_support' | 'wait_approval';
  message: string;
  actionUrl?: string;
  deadline?: Date;
  priority: 'low' | 'medium' | 'high' | 'critical';
}

// Status check configuration
export interface StatusCheckConfig {
  rules: StatusCheckRule[];
  allowedStatuses: UserAccountStatus[];
  requiredVerifications: UserVerificationStatus[];
  minProfileCompleteness?: number;
  maxRiskScore?: number;
  requirePaymentVerification?: boolean;
  requireShopApproval?: boolean;
  checkSuspensionExpiry?: boolean;
  gracePeriodMinutes?: number;
  enableWarnings?: boolean;
  logFailures?: boolean;
}

// User status middleware options
export interface UserStatusMiddlewareOptions {
  config?: StatusCheckConfig;
  customRules?: ((context: UserStatusContext) => boolean)[];
  skipStatusCheck?: boolean;
  cacheTimeout?: number; // in seconds
  onStatusFailure?: (req: Request, result: StatusValidationResult) => void;
  onSuspendedUser?: (req: Request, context: UserStatusContext) => void;
  onBannedUser?: (req: Request, context: UserStatusContext) => void;
  enableRealTimeCheck?: boolean;
  gracefulDegradation?: boolean;
}

// Status check presets for different endpoint types
export interface StatusCheckPresets {
  basic: StatusCheckConfig;
  verified: StatusCheckConfig;
  shopOwner: StatusCheckConfig;
  influencer: StatusCheckConfig;
  payment: StatusCheckConfig;
  admin: StatusCheckConfig;
  sensitive: StatusCheckConfig;
}

// User status cache entry
export interface UserStatusCacheEntry {
  userId: string;
  context: UserStatusContext;
  validationResult: StatusValidationResult;
  cachedAt: Date;
  expiresAt: Date;
  checkCount: number;
}

// Status audit log entry
export interface StatusAuditLog {
  userId: string;
  timestamp: Date;
  previousStatus: UserAccountStatus;
  newStatus: UserAccountStatus;
  reason: string;
  triggeredBy: 'system' | 'admin' | 'user' | 'automated_rule';
  triggeredById?: string;
  metadata: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  endpoint?: string;
}

// Suspension details
export interface SuspensionDetails {
  reason: string;
  suspendedBy: string;
  suspendedAt: Date;
  suspendedUntil?: Date;
  isPermanent: boolean;
  canAppeal: boolean;
  appealDeadline?: Date;
  internalNotes?: string;
  publicMessage: string;
  severity: 'warning' | 'temporary' | 'indefinite' | 'permanent';
}

// Ban details
export interface BanDetails {
  reason: string;
  bannedBy: string;
  bannedAt: Date;
  isPermanent: boolean;
  banScope: 'platform' | 'shop_services' | 'payments' | 'messaging' | 'reviews';
  canAppeal: boolean;
  appealDeadline?: Date;
  relatedViolations: string[];
  internalNotes?: string;
  publicMessage: string;
}

// Status transition rules
export interface StatusTransitionRule {
  fromStatus: UserAccountStatus;
  toStatus: UserAccountStatus;
  conditions: Array<{
    field: keyof UserStatusContext;
    operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'exists' | 'not_exists';
    value: any;
  }>;
  requiresApproval: boolean;
  automaticTransition: boolean;
  notificationRequired: boolean;
  logLevel: 'info' | 'warn' | 'error';
}

// Status monitoring configuration
export interface StatusMonitoringConfig {
  enableRealTimeMonitoring: boolean;
  checkIntervalSeconds: number;
  alertThresholds: {
    suspensionRate: number; // per hour
    banRate: number; // per hour
    failedStatusChecks: number; // per minute
  };
  enableStatusMetrics: boolean;
  enableStatusReporting: boolean;
  reportingIntervalHours: number;
}

// Status metrics
export interface StatusMetrics {
  totalUsers: number;
  activeUsers: number;
  suspendedUsers: number;
  bannedUsers: number;
  pendingVerificationUsers: number;
  verifiedUsers: number;
  statusChecksToday: number;
  failedStatusChecks: number;
  suspensionsToday: number;
  bansToday: number;
  averageProfileCompleteness: number;
  riskScoreDistribution: Record<string, number>;
  lastUpdated: Date;
}

// Request with user status context
export interface UserStatusRequest extends Request {
  userStatus?: UserStatusContext;
  statusValidation?: StatusValidationResult;
}

// Error types for user status validation
export class UserStatusError extends Error {
  constructor(
    message: string,
    public statusCode: number = 403,
    public userStatus: UserAccountStatus,
    public actionRequired?: StatusAction
  ) {
    super(message);
    this.name = 'UserStatusError';
  }
}

export class UserSuspendedError extends UserStatusError {
  constructor(
    message: string,
    public suspensionDetails: SuspensionDetails,
    public override userStatus: UserAccountStatus = 'suspended'
  ) {
    super(message, 403, userStatus);
    this.name = 'UserSuspendedError';
  }
}

export class UserBannedError extends UserStatusError {
  constructor(
    message: string,
    public banDetails: BanDetails,
    public override userStatus: UserAccountStatus = 'banned'
  ) {
    super(message, 403, userStatus);
    this.name = 'UserBannedError';
  }
}

export class UserVerificationRequiredError extends UserStatusError {
  constructor(
    message: string,
    public verificationType: 'email' | 'phone' | 'identity' | 'payment',
    public override userStatus: UserAccountStatus = 'pending_verification'
  ) {
    super(message, 403, userStatus, {
      type: verificationType === 'email' ? 'verify_email' : 
           verificationType === 'phone' ? 'verify_phone' :
           'complete_profile',
      message,
      priority: 'high'
    });
    this.name = 'UserVerificationRequiredError';
  }
}

export class InsufficientProfileError extends UserStatusError {
  constructor(
    message: string,
    public completeness: number,
    public required: number,
    public override userStatus: UserAccountStatus = 'active'
  ) {
    super(message, 403, userStatus, {
      type: 'complete_profile',
      message,
      priority: 'medium'
    });
    this.name = 'InsufficientProfileError';
  }
}

// Business rule functions type
export type StatusBusinessRule = (context: UserStatusContext) => {
  isValid: boolean;
  reason?: string;
  actionRequired?: StatusAction;
};

// Status check result with detailed information
export interface DetailedStatusResult extends StatusValidationResult {
  context: UserStatusContext;
  appliedRules: string[];
  businessRuleResults: Array<{
    rule: string;
    passed: boolean;
    reason?: string;
  }>;
  performanceMetrics: {
    checkDurationMs: number;
    cacheHit: boolean;
    databaseQueries: number;
  };
}

// Configuration for status-based feature flags
export interface StatusFeatureFlags {
  userId: string;
  enabledFeatures: string[];
  disabledFeatures: string[];
  experimentalFeatures: string[];
  betaFeatures: string[];
  basedOnStatus: UserAccountStatus;
  basedOnVerification: UserVerificationStatus;
  lastUpdated: Date;
}

// Bulk status operation
export interface BulkStatusOperation {
  userIds: string[];
  operation: 'suspend' | 'unsuspend' | 'ban' | 'unban' | 'verify' | 'activate' | 'deactivate';
  reason: string;
  operatedBy: string;
  scheduledFor?: Date;
  batchSize: number;
  results?: Array<{
    userId: string;
    success: boolean;
    error?: string;
  }>;
} 