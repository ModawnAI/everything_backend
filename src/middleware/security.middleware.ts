/**
 * Security Headers Middleware
 * 
 * Comprehensive security middleware that applies all security headers
 * including CSP, CORS, HSTS, frame options, and other security policies
 */

import { Request, Response, NextFunction } from 'express';
import helmet, { HelmetOptions } from 'helmet';
import cors from 'cors';
import Tokens from 'csrf';
import { logger } from '../utils/logger';
import {
  SecurityHeadersConfig,
  SecurityMiddlewareOptions,
  CSPViolationReport,
  SecurityAuditLog,
  SecurityConfigError,
  CSPViolationError,
  CORSViolationError,
  SecurityValidationResult
} from '../types/security.types';
import {
  getSecurityConfig,
  getSecurityConfigForEnvironment,
  getSecurityPolicyTemplate,
  VALIDATION_RULES
} from '../config/security.config';

/**
 * Security Headers Service
 */
export class SecurityHeadersService {
  private config: SecurityHeadersConfig;

  constructor(config?: SecurityHeadersConfig) {
    this.config = config || getSecurityConfig();
  }

  /**
   * Generate Content Security Policy string
   */
  generateCSPString(): string {
    if (!this.config.csp) {
      return '';
    }

    const directives: string[] = [];
    const cspDirectives = this.config.csp.directives;

    Object.entries(cspDirectives).forEach(([directive, values]) => {
      if (Array.isArray(values)) {
        directives.push(`${directive} ${values.join(' ')}`);
      } else if (typeof values === 'boolean' && values) {
        directives.push(directive);
      }
    });

    return directives.join('; ');
  }

  /**
   * Generate Permissions Policy string
   */
  generatePermissionsPolicyString(): string {
    if (!this.config.permissionsPolicy) {
      return '';
    }

    const policies: string[] = [];

    Object.entries(this.config.permissionsPolicy).forEach(([feature, allowlist]) => {
      if (allowlist && allowlist.length > 0) {
        const origins = allowlist.map(origin => 
          origin === "'none'" ? '*' : origin
        ).join(' ');
        policies.push(`${feature}=(${origins})`);
      }
    });

    return policies.join(', ');
  }

  /**
   * Validate security configuration
   */
  validateConfig(): SecurityValidationResult {
    const warnings: string[] = [];
    const errors: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Validate CSP
    if (!this.config.csp) {
      errors.push('Content Security Policy not configured');
      score -= 30;
    } else {
      const csp = this.config.csp;
      
      // Check required directives
      VALIDATION_RULES.requiredCSPDirectives.forEach(directive => {
        if (!csp.directives[directive as keyof typeof csp.directives]) {
          warnings.push(`Missing CSP directive: ${directive}`);
          score -= 5;
        }
      });

      // Check for unsafe sources
      Object.entries(csp.directives).forEach(([directive, values]) => {
        if (Array.isArray(values)) {
          VALIDATION_RULES.forbiddenCSPSources.forEach(forbiddenSource => {
            if (values.includes(forbiddenSource)) {
              warnings.push(`Unsafe CSP source '${forbiddenSource}' in ${directive}`);
              score -= 10;
            }
          });
        }
      });

      // Production-specific checks
      if (process.env.NODE_ENV === 'production') {
        if (csp.reportOnly) {
          warnings.push('CSP is in report-only mode in production');
          score -= 15;
        }
        
        if (csp.directives['script-src']?.includes("'unsafe-inline'")) {
          errors.push("'unsafe-inline' in script-src is not allowed in production");
          score -= 25;
        }
      }
    }

    // Validate HSTS
    if (!this.config.hsts) {
      warnings.push('HTTP Strict Transport Security not configured');
      score -= 10;
    } else {
      const hsts = this.config.hsts;
      if (hsts.maxAge < VALIDATION_RULES.minHSTSMaxAge) {
        warnings.push(`HSTS maxAge too low: ${hsts.maxAge}s (minimum: ${VALIDATION_RULES.minHSTSMaxAge}s)`);
        score -= 5;
      }
      if (hsts.maxAge > VALIDATION_RULES.maxHSTSMaxAge) {
        warnings.push(`HSTS maxAge too high: ${hsts.maxAge}s (maximum: ${VALIDATION_RULES.maxHSTSMaxAge}s)`);
        score -= 2;
      }
    }

    // Validate Frame Options
    if (!this.config.frameOptions) {
      warnings.push('X-Frame-Options not configured');
      score -= 5;
    }

    // Validate other headers
    if (!this.config.noSniff) {
      warnings.push('X-Content-Type-Options: nosniff not enabled');
      score -= 5;
    }

    if (!this.config.referrerPolicy) {
      warnings.push('Referrer-Policy not configured');
      score -= 5;
    }

    // Generate recommendations
    if (score < 80) {
      recommendations.push('Consider using a stricter security policy template');
    }
    if (!this.config.csp?.directives['upgrade-insecure-requests']) {
      recommendations.push('Enable upgrade-insecure-requests for HTTPS enforcement');
    }
    if (!this.config.hsts?.includeSubDomains) {
      recommendations.push('Enable includeSubDomains for HSTS');
    }

    return {
      isValid: errors.length === 0,
      warnings,
      errors,
      recommendations,
      score: Math.max(0, score)
    };
  }

  /**
   * Log security violation
   */
  async logSecurityViolation(
    req: Request,
    violation: Partial<SecurityAuditLog['violation']>
  ): Promise<void> {
    try {
      const auditLog: SecurityAuditLog = {
        timestamp: new Date(),
        ip: req.ip || req.connection.remoteAddress || 'unknown',
        userAgent: req.get('User-Agent'),
        userId: (req as any).user?.id,
        violation: {
          type: violation.type || 'other',
          description: violation.description || 'Unknown security violation',
          severity: violation.severity || 'medium',
          blockedUri: violation.blockedUri,
          violatedDirective: violation.violatedDirective
        },
        headers: req.headers as Record<string, string>,
        url: req.url,
        method: req.method
      };

      logger.warn('Security violation detected', auditLog);

      // In production, you might want to store this in a database
      // await storeSecurityAuditLog(auditLog);

    } catch (error) {
      logger.error('Failed to log security violation', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

/**
 * Create Helmet configuration from security config
 */
function createHelmetConfig(config: SecurityHeadersConfig): HelmetOptions {
  const helmetConfig: HelmetOptions = {};

  // Content Security Policy
  if (config.csp) {
    const directives = { ...config.csp.directives };
    
    // Handle boolean directives properly for helmet
    if (directives['upgrade-insecure-requests']) {
      directives['upgradeInsecureRequests'] = [];
      delete directives['upgrade-insecure-requests'];
    }
    if (directives['block-all-mixed-content']) {
      directives['blockAllMixedContent'] = [];
      delete directives['block-all-mixed-content'];
    }
    
    helmetConfig.contentSecurityPolicy = {
      directives: directives as any,
      reportOnly: config.csp.reportOnly || false,
      useDefaults: config.csp.useDefaults || false
    };
  }

  // HSTS
  if (config.hsts) {
    helmetConfig.hsts = {
      maxAge: config.hsts.maxAge,
      includeSubDomains: config.hsts.includeSubDomains,
      preload: config.hsts.preload
    };
  }

  // X-Frame-Options
  if (config.frameOptions) {
    if (typeof config.frameOptions === 'string') {
      helmetConfig.frameguard = { action: config.frameOptions.toLowerCase() as any };
    } else {
      helmetConfig.frameguard = {
        action: 'allow-from' as any
        // domain: config.frameOptions.domain // Property not supported in this version
      };
    }
  }

  // X-Content-Type-Options
  if (config.noSniff) {
    helmetConfig.noSniff = true;
  }

  // Referrer-Policy
  if (config.referrerPolicy) {
    helmetConfig.referrerPolicy = {
      policy: Array.isArray(config.referrerPolicy) 
        ? config.referrerPolicy as any
        : [config.referrerPolicy as any]
    };
  }

  // X-XSS-Protection
  // Note: helmet's xssFilter option is deprecated as of v5+
  // X-XSS-Protection header is manually set in other middlewares (response-standardization, csrf-sanitization)
  // Disabling helmet's xssFilter to avoid deprecation warnings
  helmetConfig.xssFilter = false;

  // Cross-Origin policies
  if (config.crossOrigin) {
    helmetConfig.crossOriginEmbedderPolicy = config.crossOrigin.embedderPolicy ? {
      policy: config.crossOrigin.embedderPolicy
    } : false;
    
    helmetConfig.crossOriginOpenerPolicy = config.crossOrigin.openerPolicy ? {
      policy: config.crossOrigin.openerPolicy
    } : false;
    
    helmetConfig.crossOriginResourcePolicy = config.crossOrigin.resourcePolicy ? {
      policy: config.crossOrigin.resourcePolicy
    } : false;
  }

  // Hide X-Powered-By
  if (config.hidePoweredBy) {
    helmetConfig.hidePoweredBy = true;
  }

  // IE-specific headers
  if (config.ieNoOpen) {
    helmetConfig.ieNoOpen = true;
  }

  // DNS Prefetch Control
  if (config.dnsPrefetchControl) {
    if (typeof config.dnsPrefetchControl === 'boolean') {
      helmetConfig.dnsPrefetchControl = { allow: config.dnsPrefetchControl };
    } else {
      helmetConfig.dnsPrefetchControl = config.dnsPrefetchControl;
    }
  }

  // Expect-CT
  if (config.expectCt) {
    (helmetConfig as any).expectCt = {
      maxAge: config.expectCt.maxAge,
      enforce: config.expectCt.enforce,
      reportUri: config.expectCt.reportUri
    };
  }

  return helmetConfig;
}

/**
 * CSP Violation Report Handler
 */
export function cspViolationHandler() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const report = req.body as CSPViolationReport;
      
      if (!report || !report['violated-directive']) {
        res.status(400).json({ error: 'Invalid CSP report' });
        return;
      }

      const violation = new CSPViolationError(
        `CSP violation: ${report['violated-directive']}`,
        report,
        'medium'
      );

      logger.warn('CSP violation reported', {
        violation: report,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });

      // Log to security audit
      const securityService = new SecurityHeadersService();
      securityService.logSecurityViolation(req, {
        type: 'csp',
        description: `CSP violation: ${report['violated-directive']}`,
        severity: 'medium',
        blockedUri: report['blocked-uri'],
        violatedDirective: report['violated-directive']
      });

      res.status(204).send();
    } catch (error) {
      logger.error('Failed to process CSP violation report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      res.status(500).json({ error: 'Failed to process report' });
    }
  };
}

/**
 * Main Security Headers Middleware
 */
export function securityHeaders(options: SecurityMiddlewareOptions = {}) {
  const config = options.config || 
    (options.environment ? getSecurityConfigForEnvironment(options.environment) : getSecurityConfig());

  // Apply custom configuration overrides
  const finalConfig = options.customConfig ? {
    ...config,
    ...options.customConfig
  } : config;

  const securityService = new SecurityHeadersService(finalConfig);
  
  // Validate configuration
  const validation = securityService.validateConfig();
  if (!validation.isValid) {
    logger.error('Invalid security configuration', validation);
    if (process.env.NODE_ENV === 'production') {
      throw new SecurityConfigError('Invalid security configuration in production');
    }
  }

  if (validation.warnings.length > 0) {
    logger.warn('Security configuration warnings', validation.warnings);
  }

  // Create middleware stack
  const middlewares: Array<(req: Request, res: Response, next: NextFunction) => void> = [];

  // CORS middleware
  if (finalConfig.cors) {
    middlewares.push(cors(finalConfig.cors));
  }

  // CSRF protection middleware
  if (finalConfig.csrf && finalConfig.csrf.enabled) {
    const tokens = new Tokens({
      secretLength: finalConfig.csrf.secretLength || 18,
      saltLength: finalConfig.csrf.saltLength || 8
    });

    middlewares.push((req: Request, res: Response, next: NextFunction) => {
      // Skip CSRF for GET requests and API endpoints that don't need it
      if (req.method === 'GET' || req.path.startsWith('/api/health') || req.path.startsWith('/api/security/csp-report')) {
        return next();
      }

      try {
        const token = req.headers['x-csrf-token'] as string;
        const secret = req.headers['x-csrf-secret'] as string;

        if (!token || !secret) {
          logger.warn('CSRF token missing', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          });
          return res.status(403).json({ 
            error: 'CSRF token required',
            code: 'CSRF_TOKEN_MISSING'
          });
        }

        if (!tokens.verify(secret, token)) {
          logger.warn('CSRF token verification failed', {
            ip: req.ip,
            userAgent: req.get('User-Agent'),
            path: req.path
          });
          return res.status(403).json({ 
            error: 'Invalid CSRF token',
            code: 'CSRF_TOKEN_INVALID'
          });
        }

        next();
      } catch (error) {
        logger.error('CSRF verification error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          ip: req.ip,
          path: req.path
        });
        return res.status(500).json({ 
          error: 'CSRF verification failed',
          code: 'CSRF_VERIFICATION_ERROR'
        });
      }
    });
  }

  // Helmet middleware
  const helmetConfig = createHelmetConfig(finalConfig);
  middlewares.push(helmet(helmetConfig));

  // Custom headers middleware
  middlewares.push((req: Request, res: Response, next: NextFunction) => {
    try {
      // Set Permissions-Policy header
      if (finalConfig.permissionsPolicy) {
        const permissionsPolicy = securityService.generatePermissionsPolicyString();
        if (permissionsPolicy) {
          res.set('Permissions-Policy', permissionsPolicy);
        }
      }

      // Set custom headers
      if (finalConfig.customHeaders) {
        Object.entries(finalConfig.customHeaders).forEach(([name, value]) => {
          try {
            res.set(name, value);
          } catch (headerError) {
            logger.error('Failed to set custom header', {
              header: name,
              value: value,
              error: headerError instanceof Error ? headerError.message : 'Unknown error'
            });
            // Continue processing other headers instead of failing
          }
        });
      }

      // Security logging
      if (options.enableSecurityLogging) {
        res.on('finish', () => {
          if (res.statusCode >= 400) {
            securityService.logSecurityViolation(req, {
              type: 'other',
              description: `HTTP ${res.statusCode} response`,
              severity: res.statusCode >= 500 ? 'high' : 'medium'
            });
          }
        });
      }

      next();
    } catch (error) {
      logger.error('Security headers middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      next(error);
    }
  });

  // Return composed middleware
  return (req: Request, res: Response, next: NextFunction) => {
    let index = 0;

    function runNextMiddleware(): void {
      if (index >= middlewares.length) {
        return next();
      }

      const middleware = middlewares[index++];
      middleware(req, res, (err?: any) => {
        if (err) {
          return next(err);
        }
        runNextMiddleware();
      });
    }

    runNextMiddleware();
  };
}

/**
 * Strict Security Headers for Production
 */
export function strictSecurityHeaders() {
  return securityHeaders({
    config: getSecurityPolicyTemplate('strict'),
    enableSecurityLogging: true
  });
}

/**
 * API-only Security Headers
 */
export function apiSecurityHeaders() {
  return securityHeaders({
    config: getSecurityPolicyTemplate('api-only'),
    enableSecurityLogging: true
  });
}

/**
 * Development Security Headers
 */
export function developmentSecurityHeaders() {
  return securityHeaders({
    environment: 'development',
    enableSecurityLogging: false
  });
}

/**
 * Security Headers Validation Middleware
 */
export function validateSecurityHeaders() {
  return (req: Request, res: Response, next: NextFunction): void => {
    const securityService = new SecurityHeadersService();
    const validation = securityService.validateConfig();

    if (validation.score < 70) {
      logger.warn('Low security score detected', {
        score: validation.score,
        warnings: validation.warnings,
        recommendations: validation.recommendations
      });
    }

    next();
  };
}

/**
 * Security Metrics Middleware
 */
export function securityMetrics() {
  const metrics = {
    totalRequests: 0,
    secureRequests: 0,
    violations: 0
  };

  return (req: Request, res: Response, next: NextFunction): void => {
    metrics.totalRequests++;

    if (req.secure || req.headers['x-forwarded-proto'] === 'https') {
      metrics.secureRequests++;
    }

    // Log metrics periodically
    if (metrics.totalRequests % 1000 === 0) {
      logger.info('Security metrics', {
        ...metrics,
        securePercentage: (metrics.secureRequests / metrics.totalRequests) * 100
      });
    }

    next();
  };
}

export {
  createHelmetConfig
};

export default {
  securityHeaders,
  strictSecurityHeaders,
  apiSecurityHeaders,
  developmentSecurityHeaders,
  validateSecurityHeaders,
  securityMetrics,
  cspViolationHandler,
  SecurityHeadersService
}; 