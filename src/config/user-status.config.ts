/**
 * User Status Validation Configuration
 * 
 * Comprehensive configuration for user account status validation
 * including business rules, presets, and validation logic
 */

import {
  StatusCheckConfig,
  StatusCheckPresets,
  UserAccountStatus,
  UserVerificationStatus,
  StatusCheckRule,
  UserStatusContext,
  StatusBusinessRule,
  StatusTransitionRule,
  StatusMonitoringConfig
} from '../types/user-status.types';

/**
 * Default Status Check Configurations for Different Use Cases
 */

// Basic access - minimal requirements
const BASIC_CONFIG: StatusCheckConfig = {
  rules: ['require_active'],
  allowedStatuses: ['active', 'pending_verification'],
  requiredVerifications: ['none', 'pending', 'verified'],
  gracePeriodMinutes: 5,
  enableWarnings: true,
  logFailures: false
};

// Verified users only
const VERIFIED_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 70,
  maxRiskScore: 70,
  gracePeriodMinutes: 2,
  enableWarnings: true,
  logFailures: true
};

// Shop owner requirements
const SHOP_OWNER_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified', 'require_shop_approved'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 85,
  maxRiskScore: 50,
  requireShopApproval: true,
  requirePaymentVerification: true,
  checkSuspensionExpiry: true,
  gracePeriodMinutes: 1,
  enableWarnings: true,
  logFailures: true
};

// Influencer requirements
const INFLUENCER_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified', 'require_complete_profile'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 90,
  maxRiskScore: 30,
  gracePeriodMinutes: 1,
  enableWarnings: true,
  logFailures: true
};

// Payment operations
const PAYMENT_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified', 'require_payment_verified'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 80,
  maxRiskScore: 40,
  requirePaymentVerification: true,
  checkSuspensionExpiry: true,
  gracePeriodMinutes: 0, // No grace period for payments
  enableWarnings: true,
  logFailures: true
};

// Admin operations
const ADMIN_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 100,
  maxRiskScore: 10,
  checkSuspensionExpiry: true,
  gracePeriodMinutes: 0,
  enableWarnings: true,
  logFailures: true
};

// Sensitive operations (data export, account deletion, etc.)
const SENSITIVE_CONFIG: StatusCheckConfig = {
  rules: ['require_active', 'require_verified', 'require_complete_profile'],
  allowedStatuses: ['active'],
  requiredVerifications: ['verified'],
  minProfileCompleteness: 95,
  maxRiskScore: 20,
  requirePaymentVerification: false,
  checkSuspensionExpiry: true,
  gracePeriodMinutes: 0,
  enableWarnings: true,
  logFailures: true
};

/**
 * Status Check Presets
 */
export const STATUS_CHECK_PRESETS: StatusCheckPresets = {
  basic: BASIC_CONFIG,
  verified: VERIFIED_CONFIG,
  shopOwner: SHOP_OWNER_CONFIG,
  influencer: INFLUENCER_CONFIG,
  payment: PAYMENT_CONFIG,
  admin: ADMIN_CONFIG,
  sensitive: SENSITIVE_CONFIG
};

/**
 * Business Rules for Status Validation
 */

// Check if user account is active
export const requireActiveStatus: StatusBusinessRule = (context: UserStatusContext) => {
  if (context.accountStatus !== 'active') {
    return {
      isValid: false,
      reason: `Account status is ${context.accountStatus}`,
      actionRequired: context.accountStatus === 'pending_verification' ? {
        type: 'verify_email',
        message: 'Please verify your email address to activate your account',
        priority: 'high'
      } : context.accountStatus === 'suspended' ? {
        type: 'contact_support',
        message: 'Your account is suspended. Please contact support.',
        priority: 'critical'
      } : {
        type: 'contact_support',
        message: 'Your account is not active. Please contact support.',
        priority: 'high'
      }
    };
  }
  return { isValid: true };
};

// Check if user is verified
export const requireVerifiedStatus: StatusBusinessRule = (context: UserStatusContext) => {
  if (context.verificationStatus !== 'verified') {
    return {
      isValid: false,
      reason: `User verification status is ${context.verificationStatus}`,
      actionRequired: {
        type: context.emailVerifiedAt ? 'verify_phone' : 'verify_email',
        message: context.emailVerifiedAt 
          ? 'Please verify your phone number to complete account verification'
          : 'Please verify your email address to access this feature',
        priority: 'high'
      }
    };
  }
  return { isValid: true };
};

// Check profile completeness
export const requireCompleteProfile: StatusBusinessRule = (context: UserStatusContext) => {
  const minCompleteness = 80; // Default minimum
  if (context.profileCompleteness < minCompleteness) {
    return {
      isValid: false,
      reason: `Profile completeness is ${context.profileCompleteness}%, minimum required is ${minCompleteness}%`,
      actionRequired: {
        type: 'complete_profile',
        message: `Please complete your profile (${context.profileCompleteness}% completed)`,
        priority: 'medium'
      }
    };
  }
  return { isValid: true };
};

// Check payment verification
export const requirePaymentVerification: StatusBusinessRule = (context: UserStatusContext) => {
  if (!context.paymentMethodVerified) {
    return {
      isValid: false,
      reason: 'Payment method not verified',
      actionRequired: {
        type: 'complete_profile',
        message: 'Please add and verify a payment method',
        priority: 'medium'
      }
    };
  }
  return { isValid: true };
};

// Check shop approval (for shop owners)
export const requireShopApproval: StatusBusinessRule = (context: UserStatusContext) => {
  if (context.shopVerificationStatus !== 'approved') {
    return {
      isValid: false,
      reason: `Shop verification status is ${context.shopVerificationStatus || 'none'}`,
      actionRequired: {
        type: context.shopVerificationStatus === 'pending' ? 'wait_approval' : 'complete_profile',
        message: context.shopVerificationStatus === 'pending' 
          ? 'Your shop is pending approval. Please wait for verification.'
          : 'Please submit your shop for verification',
        priority: 'high'
      }
    };
  }
  return { isValid: true };
};

// Check risk score
export const validateRiskScore: StatusBusinessRule = (context: UserStatusContext) => {
  const maxRiskScore = 70; // Default maximum
  if (context.riskScore > maxRiskScore) {
    return {
      isValid: false,
      reason: `Risk score ${context.riskScore} exceeds maximum allowed ${maxRiskScore}`,
      actionRequired: {
        type: 'contact_support',
        message: 'Your account requires additional verification. Please contact support.',
        priority: 'high'
      }
    };
  }
  return { isValid: true };
};

// Check suspension status and expiry
export const checkSuspensionExpiry: StatusBusinessRule = (context: UserStatusContext) => {
  if (context.accountStatus === 'suspended') {
    if (context.suspendedUntil && context.suspendedUntil > new Date()) {
      return {
        isValid: false,
        reason: `Account suspended until ${context.suspendedUntil.toISOString()}`,
        actionRequired: {
          type: 'wait_approval',
          message: `Your account is suspended until ${context.suspendedUntil.toLocaleDateString()}. Reason: ${context.suspensionReason || 'Violation of terms'}`,
          deadline: context.suspendedUntil,
          priority: 'critical'
        }
      };
    } else if (!context.suspendedUntil) {
      // Permanent suspension
      return {
        isValid: false,
        reason: 'Account permanently suspended',
        actionRequired: {
          type: 'contact_support',
          message: `Your account has been permanently suspended. Reason: ${context.suspensionReason || 'Violation of terms'}`,
          priority: 'critical'
        }
      };
    }
  }
  return { isValid: true };
};

// Check consecutive failed logins
export const validateLoginSecurity: StatusBusinessRule = (context: UserStatusContext) => {
  const maxFailedLogins = 5;
  if (context.consecutiveFailedLogins >= maxFailedLogins) {
    return {
      isValid: false,
      reason: `Too many failed login attempts: ${context.consecutiveFailedLogins}`,
      actionRequired: {
        type: 'reset_password',
        message: 'Too many failed login attempts. Please reset your password.',
        priority: 'high'
      }
    };
  }
  return { isValid: true };
};

// Check terms and privacy agreement
export const validateTermsAgreement: StatusBusinessRule = (context: UserStatusContext) => {
  const requiresTermsUpdate = !context.agreedToTermsAt || 
    (new Date().getTime() - context.agreedToTermsAt.getTime()) > 365 * 24 * 60 * 60 * 1000; // 1 year

  if (requiresTermsUpdate) {
    return {
      isValid: false,
      reason: 'Terms of service agreement required or expired',
      actionRequired: {
        type: 'accept_terms',
        message: 'Please review and accept the updated terms of service',
        priority: 'medium'
      }
    };
  }
  return { isValid: true };
};

/**
 * Business Rules Registry
 */
export const BUSINESS_RULES: Record<StatusCheckRule, StatusBusinessRule> = {
  require_active: requireActiveStatus,
  require_verified: requireVerifiedStatus,
  allow_pending_verification: () => ({ isValid: true }), // Always allows
  require_shop_approved: requireShopApproval,
  allow_inactive: () => ({ isValid: true }), // Always allows
  require_complete_profile: requireCompleteProfile,
  require_payment_verified: requirePaymentVerification
};

/**
 * Status Transition Rules
 */
export const STATUS_TRANSITION_RULES: StatusTransitionRule[] = [
  {
    fromStatus: 'pending_verification',
    toStatus: 'active',
    conditions: [
      { field: 'verificationStatus', operator: 'equals', value: 'verified' }
    ],
    requiresApproval: false,
    automaticTransition: true,
    notificationRequired: true,
    logLevel: 'info'
  },
  {
    fromStatus: 'active',
    toStatus: 'suspended',
    conditions: [
      { field: 'riskScore', operator: 'greater_than', value: 80 }
    ],
    requiresApproval: true,
    automaticTransition: false,
    notificationRequired: true,
    logLevel: 'warn'
  },
  {
    fromStatus: 'suspended',
    toStatus: 'active',
    conditions: [
      { field: 'suspendedUntil', operator: 'less_than', value: new Date() }
    ],
    requiresApproval: false,
    automaticTransition: true,
    notificationRequired: true,
    logLevel: 'info'
  },
  {
    fromStatus: 'inactive',
    toStatus: 'active',
    conditions: [
      { field: 'lastLoginAt', operator: 'exists', value: true },
      { field: 'verificationStatus', operator: 'equals', value: 'verified' }
    ],
    requiresApproval: false,
    automaticTransition: true,
    notificationRequired: false,
    logLevel: 'info'
  }
];

/**
 * Status Monitoring Configuration
 */
export const STATUS_MONITORING_CONFIG: StatusMonitoringConfig = {
  enableRealTimeMonitoring: true,
  checkIntervalSeconds: 300, // 5 minutes
  alertThresholds: {
    suspensionRate: 10, // per hour
    banRate: 5, // per hour
    failedStatusChecks: 100 // per minute
  },
  enableStatusMetrics: true,
  enableStatusReporting: true,
  reportingIntervalHours: 24
};

/**
 * Cache Configuration
 */
export const STATUS_CACHE_CONFIG = {
  defaultTTL: 300, // 5 minutes
  checkTTL: 60, // 1 minute for status checks
  maxCacheSize: 10000,
  enableCache: true
};

/**
 * Helper Functions
 */

/**
 * Get status check configuration by preset name
 */
export function getStatusCheckPreset(preset: keyof StatusCheckPresets): StatusCheckConfig {
  return STATUS_CHECK_PRESETS[preset];
}

/**
 * Create custom status check configuration
 */
export function createStatusCheckConfig(
  basePreset: keyof StatusCheckPresets,
  overrides: Partial<StatusCheckConfig>
): StatusCheckConfig {
  const baseConfig = getStatusCheckPreset(basePreset);
  return {
    ...baseConfig,
    ...overrides,
    rules: overrides.rules || baseConfig.rules,
    allowedStatuses: overrides.allowedStatuses || baseConfig.allowedStatuses,
    requiredVerifications: overrides.requiredVerifications || baseConfig.requiredVerifications
  };
}

/**
 * Validate if a status is allowed in configuration
 */
export function isStatusAllowed(
  status: UserAccountStatus,
  config: StatusCheckConfig
): boolean {
  return config.allowedStatuses.includes(status);
}

/**
 * Validate if verification status meets requirements
 */
export function isVerificationStatusValid(
  status: UserVerificationStatus,
  config: StatusCheckConfig
): boolean {
  return config.requiredVerifications.includes(status);
}

/**
 * Get next check time based on status and configuration
 */
export function getNextCheckTime(
  context: UserStatusContext,
  config: StatusCheckConfig
): Date {
  const baseInterval = STATUS_CACHE_CONFIG.checkTTL * 1000; // Convert to milliseconds
  let interval = baseInterval;

  // Adjust interval based on status
  switch (context.accountStatus) {
    case 'active':
      interval = baseInterval * 2; // Less frequent for active users
      break;
    case 'suspended':
      interval = baseInterval / 2; // More frequent for suspended users
      break;
    case 'pending_verification':
      interval = baseInterval / 4; // Very frequent for pending users
      break;
    default:
      interval = baseInterval;
  }

  // Adjust based on risk score
  if (context.riskScore > 70) {
    interval = interval / 2; // More frequent for high-risk users
  }

  return new Date(Date.now() + interval);
}

/**
 * Calculate status validation score (0-100)
 */
export function calculateStatusScore(context: UserStatusContext): number {
  let score = 100;

  // Account status impact
  switch (context.accountStatus) {
    case 'active':
      break; // No penalty
    case 'pending_verification':
      score -= 20;
      break;
    case 'suspended':
      score -= 60;
      break;
    case 'banned':
      score = 0;
      return score;
    default:
      score -= 30;
  }

  // Verification status impact
  switch (context.verificationStatus) {
    case 'verified':
      break; // No penalty
    case 'pending':
      score -= 10;
      break;
    case 'rejected':
      score -= 30;
      break;
    case 'expired':
      score -= 20;
      break;
    default:
      score -= 15;
  }

  // Profile completeness impact
  score -= (100 - context.profileCompleteness) * 0.3;

  // Risk score impact
  score -= context.riskScore * 0.5;

  // Payment verification impact
  if (!context.paymentMethodVerified) {
    score -= 10;
  }

  // Failed logins impact
  score -= context.consecutiveFailedLogins * 5;

  return Math.max(0, Math.min(100, score));
}

export default {
  STATUS_CHECK_PRESETS,
  BUSINESS_RULES,
  STATUS_TRANSITION_RULES,
  STATUS_MONITORING_CONFIG,
  STATUS_CACHE_CONFIG,
  getStatusCheckPreset,
  createStatusCheckConfig,
  isStatusAllowed,
  isVerificationStatusValid,
  getNextCheckTime,
  calculateStatusScore
}; 