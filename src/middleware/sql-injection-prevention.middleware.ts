import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';
import { 
  sqlInjectionSafeSchema,
  sanitizedInputSchema 
} from '../validators/security.validators';
import { SECURITY_PATTERNS } from '../validators/security.validators';
import { logSQLInjectionEvent } from './security-event-logging.middleware';

/**
 * SQL Injection Prevention Middleware
 * Provides comprehensive protection against SQL injection attacks
 */

export interface SQLInjectionContext {
  req: Request;
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

export interface SQLInjectionViolation {
  type: 'sql_injection_attempt';
  pattern: string;
  input: string;
  context: SQLInjectionContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

export interface SQLInjectionStats {
  totalAttempts: number;
  blockedAttempts: number;
  patternsDetected: string[];
  topSources: Array<{ ip: string; count: number }>;
  recentAttempts: SQLInjectionViolation[];
}

class SQLInjectionPreventionService {
  private violationHistory: SQLInjectionViolation[] = [];
  private ipAttemptCounts: Map<string, number> = new Map();
  private readonly maxViolationsPerIP = 10;
  private readonly maxHistorySize = 1000;

  // Common database column names that should NOT be sanitized
  private readonly safeColumnNames = new Set([
    'created_at', 'updated_at', 'deleted_at',
    'created-at', 'updated-at', 'deleted-at', // kebab-case variants
    'name', 'email', 'status', 'role', 'price', 'user_role',
    'shop_id', 'user_id', 'service_id', 'reservation_id',
    'start_time', 'end_time', 'duration', 'total_amount',
    'deposit_amount', 'display_order', 'booking_advance_days',
    'cancellation_hours', 'is_available', 'is_active'
  ]);

  /**
   * Check if input is a safe column name
   */
  private isSafeColumnName(input: string): boolean {
    const normalized = input.toLowerCase().trim();
    return this.safeColumnNames.has(normalized);
  }

  /**
   * Sanitize input to prevent SQL injection
   */
  sanitizeInput(input: string): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    // Don't sanitize safe column names
    if (this.isSafeColumnName(input)) {
      return input;
    }

    // Remove or escape dangerous characters
    return input
      .replace(/['"`;\\]/g, '') // Remove quotes and semicolons
      .replace(/--/g, '') // Remove SQL comments
      .replace(/\/\*/g, '') // Remove block comment starts
      .replace(/\*\//g, '') // Remove block comment ends
      .replace(/xp_/gi, '') // Remove xp_ functions
      .replace(/sp_/gi, '') // Remove sp_ functions
      .replace(/exec/gi, '') // Remove exec commands
      .replace(/execute/gi, '') // Remove execute commands
      .replace(/union/gi, '') // Remove union statements
      .replace(/select/gi, '') // Remove select statements
      .replace(/insert/gi, '') // Remove insert statements
      .replace(/update/gi, '') // Remove update statements
      .replace(/delete/gi, '') // Remove delete statements
      .replace(/drop/gi, '') // Remove drop statements
      .replace(/create/gi, '') // Remove create statements
      .replace(/alter/gi, '') // Remove alter statements
      .replace(/grant/gi, '') // Remove grant statements
      .replace(/revoke/gi, '') // Remove revoke statements
      .replace(/truncate/gi, '') // Remove truncate statements
      .replace(/declare/gi, '') // Remove declare statements
      .replace(/cast/gi, '') // Remove cast functions
      .replace(/convert/gi, '') // Remove convert functions
      .replace(/waitfor/gi, '') // Remove waitfor statements
      .replace(/delay/gi, '') // Remove delay statements
      .replace(/benchmark/gi, '') // Remove benchmark functions
      .replace(/sleep/gi, '') // Remove sleep functions
      .replace(/load_file/gi, '') // Remove load_file functions
      .replace(/into outfile/gi, '') // Remove into outfile
      .replace(/into dumpfile/gi, '') // Remove into dumpfile
      .replace(/char\(/gi, '') // Remove char functions
      .replace(/ascii\(/gi, '') // Remove ascii functions
      .replace(/substring/gi, '') // Remove substring functions
      .replace(/concat/gi, '') // Remove concat functions
      .replace(/hex/gi, '') // Remove hex functions
      .replace(/unhex/gi, '') // Remove unhex functions
      .replace(/ord/gi, '') // Remove ord functions
      .replace(/mid/gi, '') // Remove mid functions
      .replace(/left/gi, '') // Remove left functions
      .replace(/right/gi, '') // Remove right functions
      .replace(/length/gi, '') // Remove length functions
      .replace(/database\(/gi, '') // Remove database functions
      .replace(/version\(/gi, '') // Remove version functions
      .replace(/user\(/gi, '') // Remove user functions
      .replace(/current_user/gi, '') // Remove current_user
      .replace(/session_user/gi, '') // Remove session_user
      .replace(/system_user/gi, '') // Remove system_user
      .replace(/@@version/gi, '') // Remove version variables
      .replace(/@@hostname/gi, '') // Remove hostname variables
      .replace(/@@datadir/gi, '') // Remove datadir variables
      .replace(/@@basedir/gi, '') // Remove basedir variables
      .replace(/@@tmpdir/gi, '') // Remove tmpdir variables
      .replace(/@@pid/gi, '') // Remove pid variables
      .replace(/@@port/gi, '') // Remove port variables
      .replace(/@@socket/gi, '') // Remove socket variables
      .replace(/@@server_id/gi, '') // Remove server_id variables
      .replace(/@@log_bin/gi, '') // Remove log_bin variables
      .replace(/@@log_bin_index/gi, '') // Remove log_bin_index variables
      .replace(/@@log_bin_basename/gi, '') // Remove log_bin_basename variables
      .replace(/@@log_bin_use_v1_row_events/gi, '') // Remove log_bin_use_v1_row_events variables
      .replace(/@@binlog_format/gi, '') // Remove binlog_format variables
      .replace(/@@binlog_row_image/gi, '') // Remove binlog_row_image variables
      .replace(/@@binlog_row_value_options/gi, '') // Remove binlog_row_value_options variables
      .replace(/@@binlog_transaction_dependency_tracking/gi, '') // Remove binlog_transaction_dependency_tracking variables
      .replace(/@@binlog_transaction_dependency_history_size/gi, '') // Remove binlog_transaction_dependency_history_size variables
      .replace(/@@binlog_transaction_compression/gi, '') // Remove binlog_transaction_compression variables
      .replace(/@@binlog_transaction_compression_level_zstd/gi, '') // Remove binlog_transaction_compression_level_zstd variables
      .replace(/@@binlog_transaction_compression_algorithm/gi, '') // Remove binlog_transaction_compression_algorithm variables
      .replace(/@@binlog_transaction_compression_min_send_size/gi, '') // Remove binlog_transaction_compression_min_send_size variables
      .replace(/@@binlog_transaction_compression_max_send_size/gi, '') // Remove binlog_transaction_compression_max_send_size variables
      .replace(/@@binlog_transaction_compression_send_size_threshold/gi, '') // Remove binlog_transaction_compression_send_size_threshold variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_kb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_kb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_mb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_mb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_gb/gi, '') // Remove binlog_transaction_compression_send_size_threshold_gb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_tb/gi, '') // Remove binlog_transaction_compression_send_size_tb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_pb/gi, '') // Remove binlog_transaction_compression_send_size_pb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_eb/gi, '') // Remove binlog_transaction_compression_send_size_eb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_zb/gi, '') // Remove binlog_transaction_compression_send_size_zb variables
      .replace(/@@binlog_transaction_compression_send_size_threshold_yb/gi, '') // Remove binlog_transaction_compression_send_size_yb variables
      .trim();
  }

  /**
   * Validate input against SQL injection patterns
   */
  validateInput(input: string): { isValid: boolean; patterns: string[] } {
    const patterns: string[] = [];
    
    for (const [patternName, pattern] of Object.entries(SECURITY_PATTERNS.SQL_INJECTION)) {
      if (pattern.test(input)) {
        patterns.push(patternName);
      }
    }
    
    return {
      isValid: patterns.length === 0,
      patterns
    };
  }

  /**
   * Check for SQL injection in request data
   */
  checkRequestForSQLInjection(req: Request): SQLInjectionViolation[] {
    const violations: SQLInjectionViolation[] = [];
    const context: SQLInjectionContext = {
      req,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      endpoint: req.route?.path || req.path,
      method: req.method,
      timestamp: new Date()
    };

    // Check query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          const validation = this.validateInput(value);
          if (!validation.isValid) {
            violations.push({
              type: 'sql_injection_attempt',
              pattern: validation.patterns.join(', '),
              input: value,
              context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
              severity: this.determineSeverity(validation.patterns),
              blocked: true
            });
          }
        }
      }
    }

    // Check body parameters
    if (req.body && typeof req.body === 'object') {
      const checkObject = (obj: any, path: string = '') => {
        for (const [key, value] of Object.entries(obj)) {
          const currentPath = path ? `${path}.${key}` : key;
          
          if (typeof value === 'string') {
            const validation = this.validateInput(value);
            if (!validation.isValid) {
              violations.push({
                type: 'sql_injection_attempt',
                pattern: validation.patterns.join(', '),
                input: value,
                context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
                severity: this.determineSeverity(validation.patterns),
                blocked: true
              });
            }
          } else if (typeof value === 'object' && value !== null) {
            checkObject(value, currentPath);
          }
        }
      };
      
      checkObject(req.body);
    }

    // Check headers
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip', 'x-remote-addr'];
    for (const header of suspiciousHeaders) {
      const value = req.get(header);
      if (value) {
        const validation = this.validateInput(value);
        if (!validation.isValid) {
          violations.push({
            type: 'sql_injection_attempt',
            pattern: validation.patterns.join(', '),
            input: value,
            context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
            severity: this.determineSeverity(validation.patterns),
            blocked: true
          });
        }
      }
    }

    return violations;
  }

  /**
   * Determine severity based on detected patterns
   */
  private determineSeverity(patterns: string[]): 'low' | 'medium' | 'high' | 'critical' {
    const criticalPatterns = ['union_select', 'drop_table', 'truncate_table', 'exec_command'];
    const highPatterns = ['insert_into', 'update_set', 'delete_from', 'create_table'];
    const mediumPatterns = ['select_from', 'or_1_equals_1', 'and_1_equals_1'];

    if (patterns.some(p => criticalPatterns.includes(p))) {
      return 'critical';
    }
    if (patterns.some(p => highPatterns.includes(p))) {
      return 'high';
    }
    if (patterns.some(p => mediumPatterns.includes(p))) {
      return 'medium';
    }
    return 'low';
  }

  /**
   * Log SQL injection violation
   */
  private logViolation(violation: SQLInjectionViolation): void {
    // Add to history
    this.violationHistory.unshift(violation);
    if (this.violationHistory.length > this.maxHistorySize) {
      this.violationHistory = this.violationHistory.slice(0, this.maxHistorySize);
    }

    // Track IP attempts
    const ip = violation.context.ip;
    const currentCount = this.ipAttemptCounts.get(ip) || 0;
    this.ipAttemptCounts.set(ip, currentCount + 1);

    // Log the violation
    logger.warn('SQL injection attempt detected', {
      type: violation.type,
      pattern: violation.pattern,
      input: violation.input.substring(0, 100), // Truncate for logging
      context: {
        ip: violation.context.ip,
        userId: violation.context.userId,
        endpoint: violation.context.endpoint,
        method: violation.context.method,
        userAgent: violation.context.userAgent
      },
      severity: violation.severity,
      blocked: violation.blocked,
      timestamp: violation.context.timestamp
    });
  }

  /**
   * Check if IP should be blocked due to repeated violations
   */
  private shouldBlockIP(ip: string): boolean {
    const attempts = this.ipAttemptCounts.get(ip) || 0;
    return attempts >= this.maxViolationsPerIP;
  }

  /**
   * Get SQL injection statistics
   */
  getStats(): SQLInjectionStats {
    const totalAttempts = this.violationHistory.length;
    const blockedAttempts = this.violationHistory.filter(v => v.blocked).length;
    
    const patternsDetected = [...new Set(
      this.violationHistory.map(v => v.pattern).flatMap(p => p.split(', '))
    )];

    const ipCounts = new Map<string, number>();
    this.violationHistory.forEach(v => {
      const ip = v.context.ip;
      ipCounts.set(ip, (ipCounts.get(ip) || 0) + 1);
    });

    const topSources = Array.from(ipCounts.entries())
      .map(([ip, count]) => ({ ip, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalAttempts,
      blockedAttempts,
      patternsDetected,
      topSources,
      recentAttempts: this.violationHistory.slice(0, 20)
    };
  }

  /**
   * Reset violation history (admin function)
   */
  resetHistory(): void {
    this.violationHistory = [];
    this.ipAttemptCounts.clear();
    logger.info('SQL injection violation history reset');
  }
}

// Global service instance
const sqlInjectionService = new SQLInjectionPreventionService();

/**
 * Main SQL injection prevention middleware
 */
export function sqlInjectionPrevention() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for SQL injection patterns
      const violations = sqlInjectionService.checkRequestForSQLInjection(req);

      if (violations.length > 0) {
        // Log all violations
        violations.forEach(violation => {
          sqlInjectionService['logViolation'](violation);
        });

        // Log to comprehensive security logging service
        await logSQLInjectionEvent(req, violations, true);

        // Check if IP should be blocked
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (sqlInjectionService['shouldBlockIP'](ip)) {
          logger.error('IP blocked due to repeated SQL injection attempts', {
            ip,
            attempts: sqlInjectionService['ipAttemptCounts'].get(ip) || 0
          });

          res.status(403).json({
            error: {
              code: 'IP_BLOCKED',
              message: 'Your IP address has been blocked due to repeated security violations.',
              reason: 'SQL injection attempts detected'
            }
          });
          return;
        }

        // Block the request
        res.status(400).json({
          error: {
            code: 'SQL_INJECTION_DETECTED',
            message: 'Request contains potentially malicious SQL patterns.',
            details: violations.map(v => ({
              pattern: v.pattern,
              severity: v.severity
            }))
          }
        });
        return;
      }

      // Sanitize request data
      if (req.query) {
        for (const [key, value] of Object.entries(req.query)) {
          if (typeof value === 'string') {
            (req.query as any)[key] = sqlInjectionService.sanitizeInput(value);
          }
        }
      }

      if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj: any) => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
              (obj as any)[key] = sqlInjectionService.sanitizeInput(value);
            } else if (typeof value === 'object' && value !== null) {
              sanitizeObject(value);
            }
          }
        };
        sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      logger.error('SQL injection prevention middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        endpoint: req.path
      });
      next();
    }
  };
}

/**
 * Validate RPC function parameters
 */
export function validateRPCParameters(functionName: string, parameters: Record<string, any>): boolean {
  try {
    // Validate each parameter
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string') {
        const validation = sqlInjectionService.validateInput(value);
        if (!validation.isValid) {
          logger.warn('SQL injection detected in RPC parameters', {
            functionName,
            parameter: key,
            value: value.substring(0, 100),
            patterns: validation.patterns
          });
          return false;
        }
      }
    }
    return true;
  } catch (error) {
    logger.error('RPC parameter validation error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      functionName
    });
    return false;
  }
}

/**
 * Sanitize SQL query parameters
 */
export function sanitizeSQLParameters(parameters: (string | number)[]): (string | number)[] {
  return parameters.map(param => {
    if (typeof param === 'string') {
      return sqlInjectionService.sanitizeInput(param);
    }
    return param;
  });
}

/**
 * Get SQL injection statistics (admin function)
 */
export function getSQLInjectionStats(): SQLInjectionStats {
  return sqlInjectionService.getStats();
}

/**
 * Reset SQL injection history (admin function)
 */
export function resetSQLInjectionHistory(): void {
  sqlInjectionService.resetHistory();
}

export default {
  sqlInjectionPrevention,
  validateRPCParameters,
  sanitizeSQLParameters,
  getSQLInjectionStats,
  resetSQLInjectionHistory
};
