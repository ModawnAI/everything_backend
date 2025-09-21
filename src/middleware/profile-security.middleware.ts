/**
 * Profile Security Middleware
 * 
 * Enhanced security middleware specifically for user profile operations
 * including sensitive operations like account deletion and settings updates
 */

import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth.middleware';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

/**
 * Enhanced session validation for sensitive operations
 */
export interface SensitiveOperationContext {
  operation: 'account_deletion' | 'settings_update' | 'profile_update' | 'image_upload';
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  requiresRecentAuth?: boolean;
  requiresDeviceVerification?: boolean;
  requiresPasswordConfirmation?: boolean;
}

/**
 * Enhanced authentication middleware for sensitive profile operations
 */
export function requireEnhancedAuth(context: SensitiveOperationContext) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        await securityMonitoringService.logSecurityEvent({
          event_type: 'auth_failure',
          source_ip: req.ip || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          endpoint: req.path,
          severity: 'medium',
          details: {
            operation: context.operation,
            riskLevel: context.riskLevel,
            reason: 'no_user_context'
          }
        });

        res.status(401).json({
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required for this operation',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Check if user account is active
      if (req.user?.status !== 'active') {
        await securityMonitoringService.logSecurityEvent({
          event_type: 'suspicious_activity',
          user_id: userId,
          source_ip: req.ip || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          endpoint: req.path,
          severity: 'high',
          details: {
            operation: context.operation,
            riskLevel: context.riskLevel,
            userStatus: req.user?.status,
            reason: 'inactive_account_access'
          }
        });

        res.status(403).json({
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is not active',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Enhanced session validation
      const sessionValidation = await validateEnhancedSession(req, context);
      if (!sessionValidation.valid) {
        await securityMonitoringService.logSecurityEvent({
          event_type: 'suspicious_activity',
          user_id: userId,
          source_ip: req.ip || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          endpoint: req.path,
          severity: sessionValidation.severity,
          details: {
            operation: context.operation,
            riskLevel: context.riskLevel,
            reason: sessionValidation.reason,
            sessionInfo: {
              isNewDevice: req.session?.isNewDevice,
              deviceFingerprint: req.session?.deviceFingerprint,
              lastActivity: req.session?.lastActivity
            }
          }
        });

        res.status(403).json({
          error: {
            code: sessionValidation.errorCode,
            message: sessionValidation.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Log successful authentication for sensitive operation
      await securityMonitoringService.logSecurityEvent({
        event_type: 'auth_success',
        user_id: userId,
        source_ip: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.path,
        severity: 'low',
        details: {
          operation: context.operation,
          riskLevel: context.riskLevel,
          sessionId: req.session?.id,
          deviceFingerprint: req.session?.deviceFingerprint,
          isNewDevice: req.session?.isNewDevice
        }
      });

      // Add profile security context to request
      req.profileSecurityContext = {
        operation: context.operation,
        riskLevel: context.riskLevel,
        sessionValidated: true,
        validationTimestamp: new Date()
      };

      next();
    } catch (error) {
      logger.error('Enhanced authentication middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operation: context.operation,
        userId: req.user?.id,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Validate enhanced session for sensitive operations
 */
async function validateEnhancedSession(
  req: AuthenticatedRequest, 
  context: SensitiveOperationContext
): Promise<{
  valid: boolean;
  reason?: string;
  errorCode?: string;
  message?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> {
  const userId = req.user?.id;
  if (!userId) {
    return {
      valid: false,
      reason: 'no_user_id',
      errorCode: 'AUTHENTICATION_REQUIRED',
      message: 'User ID not found',
      severity: 'medium'
    };
  }

  // Check for new device access to sensitive operations
  if (req.session?.isNewDevice && context.riskLevel === 'critical') {
    return {
      valid: false,
      reason: 'new_device_critical_operation',
      errorCode: 'NEW_DEVICE_RESTRICTION',
      message: 'New device detected. Please verify your identity before performing this operation.',
      severity: 'high'
    };
  }

  // Check session age for critical operations
  if (context.requiresRecentAuth && req.session?.lastActivity) {
    const sessionAge = Date.now() - req.session.lastActivity.getTime();
    const maxAge = 30 * 60 * 1000; // 30 minutes

    if (sessionAge > maxAge) {
      return {
        valid: false,
        reason: 'session_too_old',
        errorCode: 'SESSION_EXPIRED',
        message: 'Session is too old. Please re-authenticate.',
        severity: 'medium'
      };
    }
  }

  // Check for suspicious activity patterns
  const suspiciousActivity = await checkSuspiciousActivity(req, userId);
  if (suspiciousActivity.detected) {
    return {
      valid: false,
      reason: suspiciousActivity.reason,
      errorCode: 'SUSPICIOUS_ACTIVITY',
      message: suspiciousActivity.message,
      severity: suspiciousActivity.severity
    };
  }

  return { valid: true, severity: 'low' };
}

/**
 * Check for suspicious activity patterns
 */
async function checkSuspiciousActivity(
  req: AuthenticatedRequest,
  userId: string
): Promise<{
  detected: boolean;
  reason?: string;
  message?: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}> {
  try {
    const supabase = getSupabaseClient();

    // Check recent failed attempts
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const { data: recentFailures } = await supabase
      .from('security_events')
      .select('event_type')
      .eq('user_id', userId)
      .eq('event_type', 'auth_failure')
      .gte('created_at', oneHourAgo.toISOString())
      .limit(5);

    if (recentFailures && recentFailures.length >= 3) {
      return {
        detected: true,
        reason: 'multiple_recent_failures',
        message: 'Multiple recent authentication failures detected',
        severity: 'high'
      };
    }

    // Check for unusual IP patterns
    const { data: recentIPs } = await supabase
      .from('security_events')
      .select('source_ip')
      .eq('user_id', userId)
      .gte('created_at', oneHourAgo.toISOString())
      .limit(10);

    if (recentIPs && recentIPs.length >= 3) {
      const uniqueIPs = new Set(recentIPs.map(event => event.source_ip));
      if (uniqueIPs.size >= 3) {
        return {
          detected: true,
          reason: 'multiple_ip_addresses',
          message: 'Multiple IP addresses detected in short time',
          severity: 'medium'
        };
      }
    }

    return { detected: false, severity: 'low' };
  } catch (error) {
    logger.error('Failed to check suspicious activity', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId
    });
    return { detected: false, severity: 'low' };
  }
}

/**
 * Rate limiting middleware for sensitive operations
 */
export function sensitiveOperationRateLimit(operation: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    // Implement rate limiting logic based on operation type
    const limits = {
      account_deletion: { maxAttempts: 3, windowMs: 24 * 60 * 60 * 1000 }, // 3 attempts per day
      settings_update: { maxAttempts: 10, windowMs: 60 * 60 * 1000 }, // 10 attempts per hour
      profile_update: { maxAttempts: 20, windowMs: 60 * 60 * 1000 }, // 20 attempts per hour
      image_upload: { maxAttempts: 5, windowMs: 60 * 60 * 1000 } // 5 attempts per hour
    };

    const limit = limits[operation as keyof typeof limits];
    if (!limit) {
      next();
      return;
    }

    // For now, we'll rely on the existing rate-limit middleware
    // In a production environment, you might want to implement more sophisticated
    // rate limiting with Redis or similar
    next();
  };
}

/**
 * Security event logging for profile operations
 */
export async function logProfileSecurityEvent(
  req: AuthenticatedRequest,
  operation: string,
  success: boolean,
  additionalDetails?: Record<string, any>
): Promise<void> {
  try {
    await securityMonitoringService.logSecurityEvent({
      event_type: success ? 'profile_operation_success' : 'profile_operation_failure',
      user_id: req.user?.id,
      source_ip: req.ip || 'unknown',
      user_agent: req.headers['user-agent'] || 'unknown',
      endpoint: req.path,
      severity: success ? 'low' : 'medium',
      details: {
        operation,
        method: req.method,
        sessionId: req.session?.id,
        deviceFingerprint: req.session?.deviceFingerprint,
        isNewDevice: req.session?.isNewDevice,
        ...additionalDetails
      }
    });
  } catch (error) {
    logger.error('Failed to log profile security event', {
      error: error instanceof Error ? error.message : 'Unknown error',
      operation,
      userId: req.user?.id
    });
  }
}

// Extend the AuthenticatedRequest interface
declare global {
  namespace Express {
    interface Request {
      profileSecurityContext?: {
        operation: string;
        riskLevel: string;
        sessionValidated: boolean;
        validationTimestamp: Date;
      };
    }
  }
}

export default {
  requireEnhancedAuth,
  sensitiveOperationRateLimit,
  logProfileSecurityEvent
};
