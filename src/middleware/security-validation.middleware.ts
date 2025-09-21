/**
 * Security Validation Middleware
 * 
 * Enhanced validation middleware with security-specific checks
 * including threat detection, security event logging, and
 * comprehensive input sanitization
 */

import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';
import { 
  securitySafeStringSchema, 
  passwordStrengthSchema,
  securityEventSchema,
  SECURITY_PATTERNS 
} from '../validators/security.validators';
import { ValidationError } from './validation.middleware';

/**
 * Security threat levels
 */
export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Security event types
 */
export enum SecurityEventType {
  VALIDATION_FAILED = 'validation_failed',
  SQL_INJECTION_ATTEMPT = 'sql_injection_attempt',
  XSS_ATTEMPT = 'xss_attempt',
  CSRF_ATTEMPT = 'csrf_attempt',
  PATH_TRAVERSAL_ATTEMPT = 'path_traversal_attempt',
  COMMAND_INJECTION_ATTEMPT = 'command_injection_attempt',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded'
}

/**
 * Security validation context
 */
export interface SecurityValidationContext {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  method: string;
  timestamp: Date;
  threatLevel: ThreatLevel;
  eventType: SecurityEventType;
  details?: Record<string, any>;
}

/**
 * Security validation result
 */
export interface SecurityValidationResult {
  isValid: boolean;
  sanitizedData?: any;
  threats?: string[];
  threatLevel: ThreatLevel;
  shouldBlock: boolean;
}

/**
 * Security validation configuration
 */
export interface SecurityValidationConfig {
  enableThreatDetection: boolean;
  enableSecurityLogging: boolean;
  enableInputSanitization: boolean;
  enableRateLimiting: boolean;
  maxThreatsPerRequest: number;
  blockOnHighThreat: boolean;
  logAllValidationFailures: boolean;
}

/**
 * Default security validation configuration
 */
const DEFAULT_CONFIG: SecurityValidationConfig = {
  enableThreatDetection: true,
  enableSecurityLogging: true,
  enableInputSanitization: true,
  enableRateLimiting: true,
  maxThreatsPerRequest: 3,
  blockOnHighThreat: true,
  logAllValidationFailures: true
};

/**
 * Security Validation Middleware Class
 */
export class SecurityValidationMiddleware {
  private config: SecurityValidationConfig;
  private threatCounts: Map<string, number> = new Map();
  private blockedIPs: Set<string> = new Set();

  constructor(config: Partial<SecurityValidationConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Create security validation context from request
   */
  private createSecurityContext(req: Request): SecurityValidationContext {
    return {
      userId: (req as any).user?.id,
      ipAddress: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent') || 'unknown',
      endpoint: req.route?.path || req.path,
      method: req.method,
      timestamp: new Date(),
      threatLevel: ThreatLevel.LOW,
      eventType: SecurityEventType.VALIDATION_FAILED,
      details: {}
    };
  }

  /**
   * Detect security threats in input data
   */
  private detectThreats(data: any, context: SecurityValidationContext): string[] {
    const threats: string[] = [];
    const dataString = JSON.stringify(data);

    // Check for SQL injection patterns
    if (SECURITY_PATTERNS.SQL_INJECTION.test(dataString)) {
      threats.push('SQL_INJECTION');
      context.eventType = SecurityEventType.SQL_INJECTION_ATTEMPT;
      context.threatLevel = ThreatLevel.HIGH;
    }

    // Check for XSS patterns
    if (SECURITY_PATTERNS.XSS_SCRIPT.test(dataString) ||
        SECURITY_PATTERNS.XSS_EVENT_HANDLERS.test(dataString) ||
        SECURITY_PATTERNS.XSS_JAVASCRIPT.test(dataString)) {
      threats.push('XSS');
      context.eventType = SecurityEventType.XSS_ATTEMPT;
      context.threatLevel = ThreatLevel.HIGH;
    }

    // Check for path traversal patterns
    if (SECURITY_PATTERNS.PATH_TRAVERSAL.test(dataString)) {
      threats.push('PATH_TRAVERSAL');
      context.eventType = SecurityEventType.PATH_TRAVERSAL_ATTEMPT;
      context.threatLevel = ThreatLevel.MEDIUM;
    }

    // Check for command injection patterns
    if (SECURITY_PATTERNS.COMMAND_INJECTION.test(dataString)) {
      threats.push('COMMAND_INJECTION');
      context.eventType = SecurityEventType.COMMAND_INJECTION_ATTEMPT;
      context.threatLevel = ThreatLevel.HIGH;
    }

    // Check for NoSQL injection patterns
    if (SECURITY_PATTERNS.NOSQL_INJECTION.test(dataString)) {
      threats.push('NOSQL_INJECTION');
      context.eventType = SecurityEventType.SQL_INJECTION_ATTEMPT;
      context.threatLevel = ThreatLevel.HIGH;
    }

    // Check for suspicious patterns
    if (this.detectSuspiciousPatterns(dataString)) {
      threats.push('SUSPICIOUS_PATTERN');
      context.eventType = SecurityEventType.SUSPICIOUS_ACTIVITY;
      context.threatLevel = ThreatLevel.MEDIUM;
    }

    return threats;
  }

  /**
   * Detect suspicious patterns in input
   */
  private detectSuspiciousPatterns(input: string): boolean {
    const suspiciousPatterns = [
      /admin/i,
      /root/i,
      /system/i,
      /config/i,
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /\.\./g,
      /\/etc\/passwd/i,
      /\/etc\/shadow/i,
      /\/windows\/system32/i,
      /cmd\.exe/i,
      /powershell/i,
      /bash/i,
      /sh\.exe/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Sanitize input data
   */
  private sanitizeInput(data: any): any {
    if (typeof data === 'string') {
      return data
        .replace(/[<>]/g, '')
        .replace(/['"]/g, '')
        .replace(/[;]/g, '')
        .replace(/[&]/g, '&amp;')
        .trim();
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeInput(item));
    }

    if (typeof data === 'object' && data !== null) {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(data)) {
        sanitized[key] = this.sanitizeInput(value);
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(context: SecurityValidationContext, threats: string[]): Promise<void> {
    try {
      const securityEvent = {
        eventType: context.eventType,
        severity: context.threatLevel,
        userId: context.userId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        endpoint: context.endpoint,
        method: context.method,
        details: {
          threats,
          reason: `Security validation failed: ${threats.join(', ')}`,
          additionalData: context.details
        },
        timestamp: context.timestamp
      };

      // Log to application logs
      logger.warn('Security validation failed', securityEvent);

      // Here you could also send to external security monitoring system
      // await securityMonitoringService.logEvent(securityEvent);

    } catch (error) {
      logger.error('Failed to log security event', {
        error: error instanceof Error ? error.message : 'Unknown error',
        context
      });
    }
  }

  /**
   * Check if IP should be blocked
   */
  private shouldBlockIP(ipAddress: string, threatLevel: ThreatLevel): boolean {
    if (this.blockedIPs.has(ipAddress)) {
      return true;
    }

    const threatCount = this.threatCounts.get(ipAddress) || 0;
    if (threatCount >= this.config.maxThreatsPerRequest) {
      this.blockedIPs.add(ipAddress);
      return true;
    }

    if (this.config.blockOnHighThreat && threatLevel === ThreatLevel.HIGH) {
      this.blockedIPs.add(ipAddress);
      return true;
    }

    return false;
  }

  /**
   * Update threat count for IP
   */
  private updateThreatCount(ipAddress: string): void {
    const currentCount = this.threatCounts.get(ipAddress) || 0;
    this.threatCounts.set(ipAddress, currentCount + 1);
  }

  /**
   * Security-enhanced request body validation
   */
  public validateRequestBody(schema: Joi.Schema) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = this.createSecurityContext(req);
        
        // Detect threats in request body
        if (this.config.enableThreatDetection) {
          const threats = this.detectThreats(req.body, context);
          
          if (threats.length > 0) {
            // Update threat count
            this.updateThreatCount(context.ipAddress);
            
            // Log security event
            if (this.config.enableSecurityLogging) {
              await this.logSecurityEvent(context, threats);
            }
            
            // Check if IP should be blocked
            if (this.shouldBlockIP(context.ipAddress, context.threatLevel)) {
              logger.error('IP blocked due to security threats', {
                ip: context.ipAddress,
                threats,
                threatLevel: context.threatLevel
              });
              
              res.status(403).json({
                success: false,
                error: {
                  code: 'IP_BLOCKED',
                  message: 'Your IP has been blocked due to suspicious activity.',
                  timestamp: new Date().toISOString()
                }
              });
              return;
            }
            
            // Return security error
            res.status(400).json({
              success: false,
              error: {
                code: 'SECURITY_VIOLATION',
                message: 'Security threat detected in request.',
                threats,
                threatLevel: context.threatLevel,
                timestamp: new Date().toISOString()
              }
            });
            return;
          }
        }

        // Perform normal Joi validation
        const { error, value } = schema.validate(req.body, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false
        });

        if (error) {
          const validationErrors: ValidationError[] = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          // Log validation failure if configured
          if (this.config.logAllValidationFailures) {
            logger.warn('Request body validation failed', {
              errors: validationErrors,
              path: req.path,
              method: req.method,
              ip: req.ip,
              userId: context.userId
            });
          }

          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Request validation failed',
              details: validationErrors,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Sanitize input if enabled
        if (this.config.enableInputSanitization) {
          req.body = this.sanitizeInput(value);
        } else {
          req.body = value;
        }

        next();

      } catch (error) {
        logger.error('Security validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Security validation error occurred',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Security-enhanced query parameters validation
   */
  public validateQueryParams(schema: Joi.Schema) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const context = this.createSecurityContext(req);
        
        // Detect threats in query parameters
        if (this.config.enableThreatDetection) {
          const threats = this.detectThreats(req.query, context);
          
          if (threats.length > 0) {
            this.updateThreatCount(context.ipAddress);
            
            if (this.config.enableSecurityLogging) {
              await this.logSecurityEvent(context, threats);
            }
            
            if (this.shouldBlockIP(context.ipAddress, context.threatLevel)) {
              res.status(403).json({
                success: false,
                error: {
                  code: 'IP_BLOCKED',
                  message: 'Your IP has been blocked due to suspicious activity.',
                  timestamp: new Date().toISOString()
                }
              });
              return;
            }
            
            res.status(400).json({
              success: false,
              error: {
                code: 'SECURITY_VIOLATION',
                message: 'Security threat detected in query parameters.',
                threats,
                threatLevel: context.threatLevel,
                timestamp: new Date().toISOString()
              }
            });
            return;
          }
        }

        // Perform normal Joi validation
        const { error, value } = schema.validate(req.query, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false
        });

        if (error) {
          const validationErrors: ValidationError[] = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value
          }));

          if (this.config.logAllValidationFailures) {
            logger.warn('Query parameters validation failed', {
              errors: validationErrors,
              path: req.path,
              method: req.method,
              ip: req.ip,
              userId: context.userId
            });
          }

          res.status(400).json({
            success: false,
            error: {
              code: 'QUERY_VALIDATION_ERROR',
              message: 'Query parameters validation failed',
              details: validationErrors,
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Sanitize input if enabled
        if (this.config.enableInputSanitization) {
          req.query = this.sanitizeInput(value);
        } else {
          req.query = value;
        }

        next();

      } catch (error) {
        logger.error('Security query validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Security query validation error occurred',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Get security statistics
   */
  public getSecurityStats(): {
    blockedIPs: number;
    threatCounts: Record<string, number>;
    config: SecurityValidationConfig;
  } {
    return {
      blockedIPs: this.blockedIPs.size,
      threatCounts: Object.fromEntries(this.threatCounts),
      config: this.config
    };
  }

  /**
   * Clear blocked IPs (admin function)
   */
  public clearBlockedIPs(): void {
    this.blockedIPs.clear();
    this.threatCounts.clear();
    logger.info('Security validation: Cleared blocked IPs and threat counts');
  }

  /**
   * Unblock specific IP (admin function)
   */
  public unblockIP(ipAddress: string): boolean {
    const wasBlocked = this.blockedIPs.has(ipAddress);
    this.blockedIPs.delete(ipAddress);
    this.threatCounts.delete(ipAddress);
    
    if (wasBlocked) {
      logger.info('Security validation: Unblocked IP', { ipAddress });
    }
    
    return wasBlocked;
  }
}

// Global security validation middleware instance
const securityValidationMiddleware = new SecurityValidationMiddleware();

/**
 * Export security validation functions
 */
export const secureValidateRequestBody = securityValidationMiddleware.validateRequestBody.bind(securityValidationMiddleware);
export const secureValidateQueryParams = securityValidationMiddleware.validateQueryParams.bind(securityValidationMiddleware);

/**
 * Export security validation utilities
 */
export const getSecurityStats = securityValidationMiddleware.getSecurityStats.bind(securityValidationMiddleware);
export const clearBlockedIPs = securityValidationMiddleware.clearBlockedIPs.bind(securityValidationMiddleware);
export const unblockIP = securityValidationMiddleware.unblockIP.bind(securityValidationMiddleware);

export default {
  SecurityValidationMiddleware,
  secureValidateRequestBody,
  secureValidateQueryParams,
  getSecurityStats,
  clearBlockedIPs,
  unblockIP,
  ThreatLevel,
  SecurityEventType
};
