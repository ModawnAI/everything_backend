/**
 * User Status Validation Middleware
 * 
 * Comprehensive middleware for validating user account status,
 * handling suspensions, verifications, and business rule enforcement
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';
import { AuthenticatedRequest } from './auth.middleware';
import {
  UserStatusContext,
  StatusValidationResult,
  UserStatusMiddlewareOptions,
  StatusCheckConfig,
  UserStatusRequest,
  UserStatusError,
  UserSuspendedError,
  UserBannedError,
  UserVerificationRequiredError,
  InsufficientProfileError,
  UserStatusCacheEntry,
  StatusAuditLog,
  DetailedStatusResult,
  UserAccountStatus,
  UserVerificationStatus,
  StatusMetrics,
  StatusAction
} from '../types/user-status.types';
import {
  STATUS_CHECK_PRESETS,
  BUSINESS_RULES,
  STATUS_CACHE_CONFIG,
  getStatusCheckPreset,
  calculateStatusScore,
  getNextCheckTime
} from '../config/user-status.config';

/**
 * In-memory cache for user status (in production, use Redis)
 */
class UserStatusCache {
  private cache = new Map<string, UserStatusCacheEntry>();
  private readonly maxSize = STATUS_CACHE_CONFIG.maxCacheSize;
  private readonly defaultTTL = STATUS_CACHE_CONFIG.defaultTTL * 1000; // Convert to ms

  set(userId: string, context: UserStatusContext, result: StatusValidationResult): void {
    // Remove oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    const entry: UserStatusCacheEntry = {
      userId,
      context,
      validationResult: result,
      cachedAt: new Date(),
      expiresAt: new Date(Date.now() + this.defaultTTL),
      checkCount: 1
    };

    this.cache.set(userId, entry);
  }

  get(userId: string): UserStatusCacheEntry | null {
    const entry = this.cache.get(userId);
    
    if (!entry) {
      return null;
    }

    // Check if expired
    if (entry.expiresAt < new Date()) {
      this.cache.delete(userId);
      return null;
    }

    // Update check count
    entry.checkCount++;
    return entry;
  }

  delete(userId: string): void {
    this.cache.delete(userId);
  }

  clear(): void {
    this.cache.clear();
  }

  getStats(): { size: number; hitRate: number } {
    return {
      size: this.cache.size,
      hitRate: 0 // TODO: Implement hit rate tracking
    };
  }
}

/**
 * User Status Service
 */
export class UserStatusService {
  private cache = new UserStatusCache();
  private metrics: StatusMetrics = {
    totalUsers: 0,
    activeUsers: 0,
    suspendedUsers: 0,
    bannedUsers: 0,
    pendingVerificationUsers: 0,
    verifiedUsers: 0,
    statusChecksToday: 0,
    failedStatusChecks: 0,
    suspensionsToday: 0,
    bansToday: 0,
    averageProfileCompleteness: 0,
    riskScoreDistribution: {},
    lastUpdated: new Date()
  };

  /**
   * Get user status context from database
   */
  async getUserStatusContext(userId: string): Promise<UserStatusContext> {
    try {
      const supabase = getSupabaseClient();
      
      const { data: user, error } = await supabase
        .from('users')
        .select(`
          id,
          status,
          email_verified_at,
          phone_verified_at,
          last_login_at,
          suspended_at,
          suspended_until,
          suspension_reason,
          banned_at,
          ban_reason,
          profile_completeness,
          payment_method_verified,
          influencer_tier,
          risk_score,
          consecutive_failed_logins,
          requires_password_reset,
          agreed_to_terms_at,
          agreed_to_privacy_at,
          verification_status,
          user_settings!inner(*)
        `)
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error(`Failed to fetch user status: ${error?.message || 'User not found'}`);
      }

      // Get shop verification status if user is a shop owner
      let shopVerificationStatus = undefined;
      const { data: shop } = await supabase
        .from('shops')
        .select('verification_status')
        .eq('owner_id', userId)
        .single();
      
      if (shop) {
        shopVerificationStatus = shop.verification_status as any;
      }

      const context: UserStatusContext = {
        userId,
        accountStatus: user.status as UserAccountStatus,
        verificationStatus: user.verification_status as UserVerificationStatus,
        profileCompleteness: user.profile_completeness || 0,
        paymentMethodVerified: user.payment_method_verified || false,
        shopVerificationStatus,
        influencerTier: user.influencer_tier,
        riskScore: user.risk_score || 0,
        lastStatusCheck: new Date(),
        consecutiveFailedLogins: user.consecutive_failed_logins || 0,
        requiresPasswordReset: user.requires_password_reset || false
      };

      // Conditionally add optional Date properties
      if (user.email_verified_at) {
        context.emailVerifiedAt = new Date(user.email_verified_at);
      }
      if (user.phone_verified_at) {
        context.phoneVerifiedAt = new Date(user.phone_verified_at);
      }
      if (user.last_login_at) {
        context.lastLoginAt = new Date(user.last_login_at);
      }
      if (user.suspended_at) {
        context.suspendedAt = new Date(user.suspended_at);
      }
      if (user.suspended_until) {
        context.suspendedUntil = new Date(user.suspended_until);
      }
      if (user.suspension_reason) {
        context.suspensionReason = user.suspension_reason;
      }
      if (user.banned_at) {
        context.bannedAt = new Date(user.banned_at);
      }
      if (user.ban_reason) {
        context.banReason = user.ban_reason;
      }
      if (user.agreed_to_terms_at) {
        context.agreedToTermsAt = new Date(user.agreed_to_terms_at);
      }
      if (user.agreed_to_privacy_at) {
        context.agreedToPrivacyAt = new Date(user.agreed_to_privacy_at);
      }

      return context;
    } catch (error) {
      logger.error('Failed to get user status context', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate user status against configuration
   */
  async validateUserStatus(
    context: UserStatusContext,
    config: StatusCheckConfig
  ): Promise<DetailedStatusResult> {
    const startTime = Date.now();
    const appliedRules: string[] = [];
    const businessRuleResults: Array<{ rule: string; passed: boolean; reason?: string }> = [];
    
    let isValid = true;
    let blockedReason: string | undefined;
    let actionRequired: StatusAction | undefined;
    const warnings: string[] = [];
    const recommendations: string[] = [];

    try {
      // Check basic status allowlist
      if (!config.allowedStatuses.includes(context.accountStatus)) {
        isValid = false;
        blockedReason = `Account status '${context.accountStatus}' is not allowed`;
      }

      // Check verification status requirements
      if (isValid && !config.requiredVerifications.includes(context.verificationStatus)) {
        isValid = false;
        blockedReason = `Verification status '${context.verificationStatus}' does not meet requirements`;
        actionRequired = {
          type: 'verify_email',
          message: 'Account verification required',
          priority: 'high'
        };
      }

      // Apply business rules
      for (const rule of config.rules) {
        appliedRules.push(rule);
        const businessRule = BUSINESS_RULES[rule];
        
        if (businessRule) {
          const result = businessRule(context);
          const businessRuleResult: { rule: string; passed: boolean; reason?: string } = {
            rule,
            passed: result.isValid
          };
          
          if (result.reason) {
            businessRuleResult.reason = result.reason;
          }
          
          businessRuleResults.push(businessRuleResult);

          if (!result.isValid && isValid) {
            isValid = false;
            blockedReason = result.reason;
            actionRequired = result.actionRequired;
          }
        }
      }

      // Check profile completeness
      if (isValid && config.minProfileCompleteness && context.profileCompleteness < config.minProfileCompleteness) {
        isValid = false;
        blockedReason = `Profile completeness ${context.profileCompleteness}% below required ${config.minProfileCompleteness}%`;
        actionRequired = {
          type: 'complete_profile',
          message: `Please complete your profile (${context.profileCompleteness}% completed)`,
          priority: 'medium'
        };
      }

      // Check risk score
      if (isValid && config.maxRiskScore && context.riskScore > config.maxRiskScore) {
        isValid = false;
        blockedReason = `Risk score ${context.riskScore} exceeds maximum ${config.maxRiskScore}`;
        actionRequired = {
          type: 'contact_support',
          message: 'Account requires additional verification',
          priority: 'high'
        };
      }

      // Check payment verification requirement
      if (isValid && config.requirePaymentVerification && !context.paymentMethodVerified) {
        isValid = false;
        blockedReason = 'Payment method verification required';
        actionRequired = {
          type: 'complete_profile',
          message: 'Please add and verify a payment method',
          priority: 'medium'
        };
      }

      // Check shop approval requirement
      if (isValid && config.requireShopApproval && context.shopVerificationStatus !== 'approved') {
        isValid = false;
        blockedReason = `Shop verification required (status: ${context.shopVerificationStatus || 'none'})`;
        actionRequired = {
          type: context.shopVerificationStatus === 'pending' ? 'wait_approval' : 'complete_profile',
          message: context.shopVerificationStatus === 'pending' 
            ? 'Shop approval pending' 
            : 'Please submit shop for verification',
          priority: 'high'
        };
      }

      // Generate warnings
      if (config.enableWarnings) {
        if (context.riskScore > 50) {
          warnings.push(`High risk score: ${context.riskScore}`);
        }
        if (context.consecutiveFailedLogins > 2) {
          warnings.push(`Multiple failed login attempts: ${context.consecutiveFailedLogins}`);
        }
        if (context.profileCompleteness < 70) {
          recommendations.push('Complete your profile to improve account standing');
        }
      }

      const nextCheckTime = getNextCheckTime(context, config);
      const canAccess = isValid;
      const requiresAction = !isValid && !!actionRequired;

      const result: StatusValidationResult = {
        isValid,
        status: context.accountStatus,
        verificationStatus: context.verificationStatus,
        canAccess,
        requiresAction,
        warnings,
        recommendations,
        nextCheckTime
      };

      // Conditionally add optional properties
      if (blockedReason) {
        result.blockedReason = blockedReason;
      }
      if (actionRequired) {
        result.actionRequired = actionRequired;
      }

      const detailedResult: DetailedStatusResult = {
        ...result,
        context,
        appliedRules,
        businessRuleResults,
        performanceMetrics: {
          checkDurationMs: Date.now() - startTime,
          cacheHit: false, // Will be set by caller
          databaseQueries: 1 // Assuming one query for user data
        }
      };

      // Update metrics
      this.metrics.statusChecksToday++;
      if (!isValid) {
        this.metrics.failedStatusChecks++;
      }

      return detailedResult;
    } catch (error) {
      logger.error('Status validation failed', {
        userId: context.userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      
      this.metrics.failedStatusChecks++;
      throw error;
    }
  }

  /**
   * Check user status with caching
   */
  async checkUserStatus(
    userId: string,
    config: StatusCheckConfig,
    useCache: boolean = true
  ): Promise<DetailedStatusResult> {
    try {
      // Check cache first
      if (useCache && STATUS_CACHE_CONFIG.enableCache) {
        const cached = this.cache.get(userId);
        if (cached) {
          logger.debug('User status cache hit', { userId });
          const result = await this.validateUserStatus(cached.context, config);
          result.performanceMetrics.cacheHit = true;
          return result;
        }
      }

      // Fetch fresh data
      const context = await this.getUserStatusContext(userId);
      const result = await this.validateUserStatus(context, config);
      
      // Cache the result
      if (useCache && STATUS_CACHE_CONFIG.enableCache) {
        this.cache.set(userId, context, result);
      }

      result.performanceMetrics.cacheHit = false;
      return result;
    } catch (error) {
      logger.error('User status check failed', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Log status audit entry
   */
  async logStatusAudit(auditLog: StatusAuditLog): Promise<void> {
    try {
      const supabase = getSupabaseClient();
      
      const { error } = await supabase
        .from('user_status_audit_logs')
        .insert({
          user_id: auditLog.userId,
          previous_status: auditLog.previousStatus,
          new_status: auditLog.newStatus,
          reason: auditLog.reason,
          triggered_by: auditLog.triggeredBy,
          triggered_by_id: auditLog.triggeredById,
          metadata: auditLog.metadata,
          ip_address: auditLog.ipAddress,
          user_agent: auditLog.userAgent,
          endpoint: auditLog.endpoint,
          created_at: auditLog.timestamp.toISOString()
        });

      if (error) {
        logger.error('Failed to log status audit', { error: error.message });
      }
    } catch (error) {
      logger.error('Status audit logging failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Invalidate user status cache
   */
  invalidateUserCache(userId: string): void {
    this.cache.delete(userId);
    logger.debug('User status cache invalidated', { userId });
  }

  /**
   * Get service metrics
   */
  getMetrics(): StatusMetrics {
    return { ...this.metrics, lastUpdated: new Date() };
  }

  /**
   * Clear all caches (for testing)
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Service singleton
export const userStatusService = new UserStatusService();

/**
 * Main user status validation middleware
 */
export function validateUserStatus(options: UserStatusMiddlewareOptions = {}) {
  const config = options.config || getStatusCheckPreset('basic');
  const cacheTimeout = options.cacheTimeout || STATUS_CACHE_CONFIG.defaultTTL;
  const enableRealTimeCheck = options.enableRealTimeCheck !== false;

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const statusReq = req as UserStatusRequest;

      // Skip if not authenticated
      if (!authReq.user) {
        return next();
      }

      const userId = authReq.user.id;

      // Skip status check if configured
      if (options.skipStatusCheck) {
        return next();
      }

      // Check user status
      const result = await userStatusService.checkUserStatus(
        userId,
        config,
        enableRealTimeCheck
      );

      // Attach status to request
      statusReq.userStatus = result.context;
      statusReq.statusValidation = result;

      // Handle status validation failure
      if (!result.isValid) {
        const blockedReason = result.blockedReason || 'Access denied';
        
        // Call custom failure handler
        if (options.onStatusFailure) {
          options.onStatusFailure(req, result);
        }

        // Log the failure
        if (config.logFailures) {
          logger.warn('User status validation failed', {
            userId,
            status: result.status,
            reason: blockedReason,
            endpoint: req.path,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        }

        // Handle specific error types
        switch (result.status) {
          case 'suspended':
            if (options.onSuspendedUser) {
              options.onSuspendedUser(req, result.context);
            }
            
            const suspensionDetails: any = {
              reason: result.context.suspensionReason || 'Violation of terms',
              suspendedBy: 'system',
              suspendedAt: result.context.suspendedAt || new Date(),
              isPermanent: !result.context.suspendedUntil,
              canAppeal: true,
              publicMessage: result.actionRequired?.message || 'Account suspended',
              severity: 'temporary' as const
            };
            
            if (result.context.suspendedUntil) {
              suspensionDetails.suspendedUntil = result.context.suspendedUntil;
            }
            
            throw new UserSuspendedError(blockedReason, suspensionDetails);

          case 'banned':
            if (options.onBannedUser) {
              options.onBannedUser(req, result.context);
            }
            
            const banDetails = {
              reason: result.context.banReason || 'Violation of terms',
              bannedBy: 'system',
              bannedAt: result.context.bannedAt || new Date(),
              isPermanent: true,
              banScope: 'platform' as const,
              canAppeal: false,
              relatedViolations: [],
              publicMessage: result.actionRequired?.message || 'Account banned'
            };
            
            throw new UserBannedError(blockedReason, banDetails);

          case 'pending_verification':
            const verificationType = result.context.emailVerifiedAt ? 'phone' : 'email';
            throw new UserVerificationRequiredError(blockedReason, verificationType);

          default:
            if (result.actionRequired?.type === 'complete_profile') {
              throw new InsufficientProfileError(
                blockedReason,
                result.context.profileCompleteness,
                config.minProfileCompleteness || 80
              );
            }
            
            throw new UserStatusError(blockedReason, 403, result.status, result.actionRequired);
        }
      }

      // Log warnings if any
      if (result.warnings.length > 0 && config.enableWarnings) {
        logger.warn('User status warnings', {
          userId,
          warnings: result.warnings,
          recommendations: result.recommendations
        });
      }

      next();
    } catch (error) {
      if (options.gracefulDegradation && !(error instanceof UserStatusError)) {
        logger.error('User status validation error, allowing graceful degradation', {
          userId: (req as AuthenticatedRequest).user?.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return next();
      }
      
      next(error);
    }
  };
}

/**
 * Preset middleware functions
 */
export const basicStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('basic') 
});

export const verifiedStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('verified') 
});

export const shopOwnerStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('shopOwner') 
});

export const influencerStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('influencer') 
});

export const paymentStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('payment') 
});

export const adminStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('admin') 
});

export const sensitiveStatusCheck = () => validateUserStatus({ 
  config: getStatusCheckPreset('sensitive') 
});

/**
 * Custom status check with specific requirements
 */
export const customStatusCheck = (
  preset: keyof typeof STATUS_CHECK_PRESETS,
  overrides: Partial<StatusCheckConfig> = {}
) => {
  const baseConfig = getStatusCheckPreset(preset);
  const customConfig = { ...baseConfig, ...overrides };
  return validateUserStatus({ config: customConfig });
};

/**
 * User status metrics middleware
 */
export function userStatusMetrics() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const statusReq = req as UserStatusRequest;
    
    // Collect metrics if status validation was performed
    if (statusReq.statusValidation) {
      const detailedResult = statusReq.statusValidation as DetailedStatusResult;
      
      if (detailedResult.context && detailedResult.performanceMetrics) {
        const { context, performanceMetrics } = detailedResult;
        
        logger.debug('User status metrics', {
          userId: context.userId,
          status: context.accountStatus,
          verificationStatus: context.verificationStatus,
          profileCompleteness: context.profileCompleteness,
          riskScore: context.riskScore,
          checkDuration: performanceMetrics.checkDurationMs,
          cacheHit: performanceMetrics.cacheHit
        });
      }
    }
    
    next();
  };
}

/**
 * Utility functions
 */
export const getUserStatusFromRequest = (req: Request): UserStatusContext | undefined => {
  return (req as UserStatusRequest).userStatus;
};

export const getStatusValidationFromRequest = (req: Request): StatusValidationResult | undefined => {
  return (req as UserStatusRequest).statusValidation;
};

export default {
  validateUserStatus,
  basicStatusCheck,
  verifiedStatusCheck,
  shopOwnerStatusCheck,
  influencerStatusCheck,
  paymentStatusCheck,
  adminStatusCheck,
  sensitiveStatusCheck,
  customStatusCheck,
  userStatusMetrics,
  userStatusService,
  UserStatusService,
  getUserStatusFromRequest,
  getStatusValidationFromRequest
}; 