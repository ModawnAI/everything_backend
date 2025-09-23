/**
 * Unified Validation Middleware
 * 
 * Consolidates all validation systems into a single, comprehensive middleware
 * that handles security, input validation, and sanitization in one place.
 */

import { Request, Response, NextFunction } from 'express';
import * as Joi from 'joi';
import { logger } from '../utils/logger';

export interface ValidationOptions {
  target: 'body' | 'query' | 'params';
  schema: Joi.Schema;
  security?: {
    enableXSSProtection?: boolean;
    enableSQLInjectionProtection?: boolean;
    enableInputSanitization?: boolean;
    maxThreatLevel?: number;
  };
  sanitization?: {
    trimStrings?: boolean;
    normalizeEmail?: boolean;
    sanitizeHtml?: boolean;
  };
  logging?: {
    logValidationFailures?: boolean;
    logSecurityViolations?: boolean;
  };
}

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
  code?: string;
}

export interface SecurityViolation {
  type: 'xss' | 'sql_injection' | 'malicious_input';
  severity: 'low' | 'medium' | 'high' | 'critical';
  pattern: string;
  field: string;
  value: string;
}

export class UnifiedValidationMiddleware {
  /**
   * Create validation middleware with comprehensive options
   */
  static validate(options: ValidationOptions) {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      const startTime = Date.now();
      const requestId = req.headers['x-request-id'] as string || `req_${Date.now()}`;

      try {
        // Get data to validate
        const dataToValidate = UnifiedValidationMiddleware.getDataToValidate(req, options.target);
        
        // Security checks first
        if (options.security?.enableXSSProtection || options.security?.enableSQLInjectionProtection) {
          const securityResult = await UnifiedValidationMiddleware.performSecurityChecks(
            dataToValidate,
            options.security,
            req
          );
          
          if (!securityResult.isValid) {
            UnifiedValidationMiddleware.handleSecurityViolations(
              securityResult.violations,
              res,
              requestId,
              options.logging?.logSecurityViolations
            );
            return;
          }
        }

        // Input sanitization
        let sanitizedData = dataToValidate;
        if (options.sanitization) {
          sanitizedData = UnifiedValidationMiddleware.sanitizeInput(dataToValidate, options.sanitization);
        }

        // Joi schema validation
        const { error, value } = options.schema.validate(sanitizedData, {
          abortEarly: false,
          stripUnknown: true,
          allowUnknown: false
        });

        if (error) {
          const validationErrors: ValidationError[] = error.details.map(detail => ({
            field: detail.path.join('.'),
            message: detail.message,
            value: detail.context?.value,
            code: detail.type
          }));

          if (options.logging?.logValidationFailures) {
            logger.warn('Unified validation failed', {
              errors: validationErrors,
              endpoint: req.path,
              method: req.method,
              ip: req.ip,
              userId: (req as any).user?.id,
              requestId,
              duration: Date.now() - startTime
            });
          }

          res.status(400).json({
            success: false,
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Input validation failed',
              details: validationErrors,
              timestamp: new Date().toISOString(),
              requestId
            }
          });
          return;
        }

        // Update request with validated data
        UnifiedValidationMiddleware.setValidatedData(req, options.target, value);

        // Log successful validation
        logger.debug('Unified validation passed', {
          endpoint: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          requestId,
          duration: Date.now() - startTime
        });

        next();

      } catch (error) {
        logger.error('Unified validation middleware error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          endpoint: req.path,
          method: req.method,
          requestId,
          duration: Date.now() - startTime
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'VALIDATION_SYSTEM_ERROR',
            message: 'Validation system error occurred',
            timestamp: new Date().toISOString(),
            requestId
          }
        });
      }
    };
  }

  /**
   * Convenience methods for common validation patterns
   */
  static body(schema: Joi.Schema, options: Partial<ValidationOptions> = {}) {
    return UnifiedValidationMiddleware.validate({
      target: 'body',
      schema,
      security: { enableXSSProtection: true, enableSQLInjectionProtection: true },
      sanitization: { trimStrings: true },
      logging: { logValidationFailures: true, logSecurityViolations: true },
      ...options
    });
  }

  static query(schema: Joi.Schema, options: Partial<ValidationOptions> = {}) {
    return UnifiedValidationMiddleware.validate({
      target: 'query',
      schema,
      security: { enableSQLInjectionProtection: true },
      sanitization: { trimStrings: true },
      logging: { logValidationFailures: true },
      ...options
    });
  }

  static params(schema: Joi.Schema, options: Partial<ValidationOptions> = {}) {
    return UnifiedValidationMiddleware.validate({
      target: 'params',
      schema,
      security: { enableSQLInjectionProtection: true },
      logging: { logValidationFailures: true },
      ...options
    });
  }

  /**
   * Secure validation for sensitive endpoints
   */
  static secure(schema: Joi.Schema, target: 'body' | 'query' | 'params' = 'body') {
    return UnifiedValidationMiddleware.validate({
      target,
      schema,
      security: {
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        enableInputSanitization: true,
        maxThreatLevel: 0
      },
      sanitization: {
        trimStrings: true,
        normalizeEmail: true,
        sanitizeHtml: true
      },
      logging: {
        logValidationFailures: true,
        logSecurityViolations: true
      }
    });
  }

  /**
   * Helper methods
   */
  private static getDataToValidate(req: Request, target: 'body' | 'query' | 'params'): any {
    switch (target) {
      case 'body': return req.body;
      case 'query': return req.query;
      case 'params': return req.params;
      default: return req.body;
    }
  }

  private static setValidatedData(req: Request, target: 'body' | 'query' | 'params', data: any): void {
    switch (target) {
      case 'body': req.body = data; break;
      case 'query': req.query = data; break;
      case 'params': req.params = data; break;
    }
  }

  private static async performSecurityChecks(
    data: any,
    securityOptions: NonNullable<ValidationOptions['security']>,
    req: Request
  ): Promise<{ isValid: boolean; violations: SecurityViolation[] }> {
    const violations: SecurityViolation[] = [];

    // XSS Protection
    if (securityOptions.enableXSSProtection) {
      const xssViolations = this.checkForXSS(data);
      violations.push(...xssViolations);
    }

    // SQL Injection Protection
    if (securityOptions.enableSQLInjectionProtection) {
      const sqlViolations = this.checkForSQLInjection(data);
      violations.push(...sqlViolations);
    }

    // Check threat level
    const criticalViolations = violations.filter(v => v.severity === 'critical' || v.severity === 'high');
    const maxThreatLevel = securityOptions.maxThreatLevel || 2;

    return {
      isValid: criticalViolations.length <= maxThreatLevel,
      violations
    };
  }

  private static checkForXSS(data: any): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    const xssPatterns = [
      { pattern: /<script[^>]*>.*?<\/script>/gi, severity: 'critical' as const },
      { pattern: /on\w+\s*=/gi, severity: 'high' as const },
      { pattern: /javascript:/gi, severity: 'high' as const }
    ];

    this.scanForPatterns(data, xssPatterns, 'xss', violations);
    return violations;
  }

  private static checkForSQLInjection(data: any): SecurityViolation[] {
    const violations: SecurityViolation[] = [];
    const sqlPatterns = [
      { pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/i, severity: 'critical' as const },
      { pattern: /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i, severity: 'high' as const },
      { pattern: /(;|\-\-|\/\*|\*\/)/i, severity: 'medium' as const }
    ];

    this.scanForPatterns(data, sqlPatterns, 'sql_injection', violations);
    return violations;
  }

  private static scanForPatterns(
    data: any,
    patterns: Array<{ pattern: RegExp; severity: SecurityViolation['severity'] }>,
    type: SecurityViolation['type'],
    violations: SecurityViolation[]
  ): void {
    const scanValue = (value: any, field: string) => {
      if (typeof value === 'string') {
        patterns.forEach(({ pattern, severity }) => {
          if (pattern.test(value)) {
            violations.push({
              type,
              severity,
              pattern: pattern.source,
              field,
              value: value.substring(0, 100) // Truncate for logging
            });
          }
        });
      } else if (typeof value === 'object' && value !== null) {
        Object.entries(value).forEach(([key, val]) => {
          scanValue(val, `${field}.${key}`);
        });
      }
    };

    if (typeof data === 'object' && data !== null) {
      Object.entries(data).forEach(([key, value]) => {
        scanValue(value, key);
      });
    }
  }

  private static sanitizeInput(data: any, options: NonNullable<ValidationOptions['sanitization']>): any {
    const sanitize = (value: any): any => {
      if (typeof value === 'string') {
        let sanitized = value;
        
        if (options.trimStrings) {
          sanitized = sanitized.trim();
        }
        
        if (options.normalizeEmail && sanitized.includes('@')) {
          sanitized = sanitized.toLowerCase();
        }
        
        if (options.sanitizeHtml) {
          // Basic HTML sanitization
          sanitized = sanitized
            .replace(/<script[^>]*>.*?<\/script>/gi, '')
            .replace(/<[^>]*>/g, '')
            .replace(/javascript:/gi, '');
        }
        
        return sanitized;
      } else if (typeof value === 'object' && value !== null) {
        const sanitizedObj: any = {};
        Object.entries(value).forEach(([key, val]) => {
          sanitizedObj[key] = sanitize(val);
        });
        return sanitizedObj;
      }
      
      return value;
    };

    return sanitize(data);
  }

  private static handleSecurityViolations(
    violations: SecurityViolation[],
    res: Response,
    requestId: string,
    logViolations: boolean = true
  ): void {
    if (logViolations) {
      logger.warn('Security violations detected', {
        violations: violations.map(v => ({
          type: v.type,
          severity: v.severity,
          field: v.field
        })),
        requestId
      });
    }

    const criticalViolations = violations.filter(v => v.severity === 'critical');
    const highViolations = violations.filter(v => v.severity === 'high');

    if (criticalViolations.length > 0) {
      res.status(403).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION_CRITICAL',
          message: 'Request contains critical security violations',
          details: criticalViolations.map(v => ({
            type: v.type,
            field: v.field,
            severity: v.severity
          })),
          timestamp: new Date().toISOString(),
          requestId
        }
      });
    } else if (highViolations.length > 0) {
      res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION_HIGH',
          message: 'Request contains high-risk security violations',
          details: highViolations.map(v => ({
            type: v.type,
            field: v.field,
            severity: v.severity
          })),
          timestamp: new Date().toISOString(),
          requestId
        }
      });
    } else {
      res.status(400).json({
        success: false,
        error: {
          code: 'SECURITY_VIOLATION',
          message: 'Request contains potential security violations',
          timestamp: new Date().toISOString(),
          requestId
        }
      });
    }
  }
}

/**
 * Common validation schemas that can be reused
 */
export const CommonSchemas = {
  uuid: Joi.string().uuid().required(),
  optionalUuid: Joi.string().uuid().optional(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20)
  }),
  dateRange: Joi.object({
    startDate: Joi.date().iso().optional(),
    endDate: Joi.date().iso().optional()
  }),
  status: Joi.string().valid('active', 'inactive', 'pending', 'deleted').required(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  koreanText: Joi.string().pattern(/^[가-힣\s]+$/).min(1).max(100),
  amount: Joi.number().positive().precision(2).required()
};

/**
 * Convenience functions for common validation patterns
 */
export const validate = {
  // Standard validations
  body: (schema: Joi.Schema) => UnifiedValidationMiddleware.validate({
    target: 'body',
    schema,
    security: { enableXSSProtection: true, enableSQLInjectionProtection: true },
    sanitization: { trimStrings: true },
    logging: { logValidationFailures: true }
  }),

  query: (schema: Joi.Schema) => UnifiedValidationMiddleware.validate({
    target: 'query',
    schema,
    security: { enableSQLInjectionProtection: true },
    sanitization: { trimStrings: true },
    logging: { logValidationFailures: true }
  }),

  params: (schema: Joi.Schema) => UnifiedValidationMiddleware.validate({
    target: 'params',
    schema,
    security: { enableSQLInjectionProtection: true },
    logging: { logValidationFailures: true }
  }),

  // Secure validation for sensitive endpoints
  secure: {
    body: (schema: Joi.Schema) => UnifiedValidationMiddleware.validate({
      target: 'body',
      schema,
      security: {
        enableXSSProtection: true,
        enableSQLInjectionProtection: true,
        enableInputSanitization: true,
        maxThreatLevel: 0
      },
      sanitization: {
        trimStrings: true,
        normalizeEmail: true,
        sanitizeHtml: true
      },
      logging: {
        logValidationFailures: true,
        logSecurityViolations: true
      }
    }),

    query: (schema: Joi.Schema) => UnifiedValidationMiddleware.validate({
      target: 'query',
      schema,
      security: {
        enableSQLInjectionProtection: true,
        maxThreatLevel: 0
      },
      sanitization: { trimStrings: true },
      logging: { logValidationFailures: true, logSecurityViolations: true }
    })
  },

  // Quick validations for common patterns
  id: () => validate.params(Joi.object({ id: CommonSchemas.uuid })),
  pagination: () => validate.query(CommonSchemas.pagination),
  dateRange: () => validate.query(CommonSchemas.dateRange)
};
