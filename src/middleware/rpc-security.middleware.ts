import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { validateRPCParameters } from '../utils/secure-query-builder';
import { AuthenticatedRequest } from './auth.middleware';
import { logRPCSecurityEvent } from './security-event-logging.middleware';

/**
 * RPC Security Middleware
 * Validates and sanitizes RPC function calls to prevent SQL injection
 */

export interface RPCSecurityContext {
  functionName: string;
  parameters: Record<string, any>;
  userId?: string;
  ip: string;
  userAgent?: string;
  timestamp: Date;
}

export interface RPCSecurityViolation {
  type: 'rpc_security_violation';
  functionName: string;
  parameter: string;
  value: string;
  reason: string;
  context: RPCSecurityContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

class RPCSecurityService {
  private violationHistory: RPCSecurityViolation[] = [];
  private readonly maxHistorySize = 1000;
  private readonly maxViolationsPerFunction = 5;

  /**
   * Validate RPC function name
   */
  private validateFunctionName(functionName: string): boolean {
    // Allow only alphanumeric characters, underscores, and hyphens
    const functionNamePattern = /^[a-zA-Z0-9_-]+$/;
    return functionNamePattern.test(functionName);
  }

  /**
   * Check if function is in allowed list
   */
  private isAllowedFunction(functionName: string): boolean {
    const allowedFunctions = [
      'execute_sql',
      'create_reservation_with_lock',
      'reschedule_reservation',
      'increment_user_referral_count',
      'increment_points',
      'increment_referrals',
      'set_transaction_isolation_level',
      'begin_transaction',
      'commit_transaction',
      'rollback_transaction',
      'create_split_payment_plan',
      'create_payment_retry_queue_item',
      'update_payment_with_audit'
    ];
    
    return allowedFunctions.includes(functionName);
  }

  /**
   * Validate RPC parameters
   */
  validateRPC(functionName: string, parameters: Record<string, any>, req: any): {
    isValid: boolean;
    violations: RPCSecurityViolation[];
    sanitizedParameters: Record<string, any>;
  } {
    const violations: RPCSecurityViolation[] = [];
    const context: RPCSecurityContext = {
      functionName,
      parameters,
      ip: req.ip || 'unknown',
      timestamp: new Date()
    };

    // Validate function name
    if (!this.validateFunctionName(functionName)) {
      violations.push({
        type: 'rpc_security_violation',
        functionName,
        parameter: 'function_name',
        value: functionName,
        reason: 'Invalid function name format',
        context,
        severity: 'high',
        blocked: true
      });
    }

    // Check if function is allowed
    if (!this.isAllowedFunction(functionName)) {
      violations.push({
        type: 'rpc_security_violation',
        functionName,
        parameter: 'function_name',
        value: functionName,
        reason: 'Function not in allowed list',
        context,
        severity: 'critical',
        blocked: true
      });
    }

    // Validate parameters
    const sanitizedParameters = validateRPCParameters(functionName, parameters);
    
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string') {
        // Check for SQL injection patterns
        const sqlPatterns = [
          /union\s+select/gi,
          /drop\s+table/gi,
          /delete\s+from/gi,
          /insert\s+into/gi,
          /update\s+set/gi,
          /truncate\s+table/gi,
          /exec\s*\(/gi,
          /execute\s*\(/gi,
          /xp_cmdshell/gi,
          /sp_executesql/gi,
          /';/gi,
          /--/gi,
          /\/\*/gi,
          /\*\//gi
        ];

        for (const pattern of sqlPatterns) {
          if (pattern.test(value)) {
            violations.push({
              type: 'rpc_security_violation',
              functionName,
              parameter: key,
              value: value.substring(0, 100),
              reason: 'SQL injection pattern detected',
              context,
              severity: 'critical',
              blocked: true
            });
          }
        }

        // Check for suspicious length
        if (value.length > 10000) {
          violations.push({
            type: 'rpc_security_violation',
            functionName,
            parameter: key,
            value: value.substring(0, 100),
            reason: 'Parameter value too long',
            context,
            severity: 'medium',
            blocked: true
          });
        }
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
      sanitizedParameters
    };
  }

  /**
   * Log RPC security violation
   */
  private logViolation(violation: RPCSecurityViolation): void {
    // Add to history
    this.violationHistory.unshift(violation);
    if (this.violationHistory.length > this.maxHistorySize) {
      this.violationHistory = this.violationHistory.slice(0, this.maxHistorySize);
    }

    // Log the violation
    logger.warn('RPC security violation detected', {
      type: violation.type,
      functionName: violation.functionName,
      parameter: violation.parameter,
      value: violation.value.substring(0, 100),
      reason: violation.reason,
      severity: violation.severity,
      blocked: violation.blocked,
      context: {
        ip: violation.context.ip,
        userId: violation.context.userId,
        userAgent: violation.context.userAgent,
        timestamp: violation.context.timestamp
      }
    });
  }

  /**
   * Check if function should be blocked due to repeated violations
   */
  private shouldBlockFunction(functionName: string): boolean {
    const functionViolations = this.violationHistory.filter(
      v => v.functionName === functionName && v.blocked
    );
    return functionViolations.length >= this.maxViolationsPerFunction;
  }

  /**
   * Get RPC security statistics
   */
  getStats(): {
    totalViolations: number;
    blockedViolations: number;
    functionsWithViolations: string[];
    recentViolations: RPCSecurityViolation[];
  } {
    const totalViolations = this.violationHistory.length;
    const blockedViolations = this.violationHistory.filter(v => v.blocked).length;
    
    const functionsWithViolations = [...new Set(
      this.violationHistory.map(v => v.functionName)
    )];

    return {
      totalViolations,
      blockedViolations,
      functionsWithViolations,
      recentViolations: this.violationHistory.slice(0, 20)
    };
  }

  /**
   * Reset violation history (admin function)
   */
  resetHistory(): void {
    this.violationHistory = [];
    logger.info('RPC security violation history reset');
  }
}

// Global service instance
const rpcSecurityService = new RPCSecurityService();

/**
 * RPC Security Middleware
 * Intercepts RPC calls and validates them for security
 */
export function rpcSecurityMiddleware() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check if this is an RPC call
      if (req.body && typeof req.body === 'object' && req.body.function_name) {
        const { function_name, parameters = {} } = req.body;
        
        // Add context information
        const context: RPCSecurityContext = {
          functionName: function_name,
          parameters,
          userId: (req as AuthenticatedRequest).user?.id,
          ip: req.ip || req.connection.remoteAddress || 'unknown',
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        };

        // Validate the RPC call
        const validation = rpcSecurityService.validateRPC(function_name, parameters, req);

        if (!validation.isValid) {
          // Log all violations
          validation.violations.forEach(violation => {
            rpcSecurityService['logViolation'](violation);
          });

          // Log to comprehensive security logging service
          await logRPCSecurityEvent(req, validation.violations, true);

          // Check if function should be blocked
          if (rpcSecurityService['shouldBlockFunction'](function_name)) {
            logger.error('RPC function blocked due to repeated violations', {
              functionName: function_name,
              violations: validation.violations.length
            });

            res.status(403).json({
              error: {
                code: 'RPC_FUNCTION_BLOCKED',
                message: 'This RPC function has been blocked due to repeated security violations.',
                functionName: function_name
              }
            });
            return;
          }

          // Block the request
          res.status(400).json({
            error: {
              code: 'RPC_SECURITY_VIOLATION',
              message: 'RPC call contains security violations.',
              details: validation.violations.map(v => ({
                parameter: v.parameter,
                reason: v.reason,
                severity: v.severity
              }))
            }
          });
          return;
        }

        // Replace parameters with sanitized versions
        req.body.parameters = validation.sanitizedParameters;
      }

      next();
    } catch (error) {
      logger.error('RPC security middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        endpoint: req.path
      });
      next();
    }
  };
}

/**
 * Get RPC security statistics (admin function)
 */
export function getRPCSecurityStats() {
  return rpcSecurityService.getStats();
}

/**
 * Reset RPC security history (admin function)
 */
export function resetRPCSecurityHistory() {
  rpcSecurityService.resetHistory();
}

export default {
  rpcSecurityMiddleware,
  getRPCSecurityStats,
  resetRPCSecurityHistory
};
