import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { SECURITY_PATTERNS } from '../validators/security.validators';
import { logXSSEvent, logCSRFEvent } from './security-event-logging.middleware';

/**
 * Enhanced XSS and CSRF Protection Middleware
 * Provides comprehensive protection against XSS attacks and CSRF vulnerabilities
 */

export interface XSSProtectionContext {
  req: Request;
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

export interface XSSViolation {
  type: 'xss_attempt';
  pattern: string;
  input: string;
  context: XSSProtectionContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  blocked: boolean;
}

export interface CSRFProtectionContext {
  req: Request;
  userId?: string;
  ip: string;
  userAgent?: string;
  endpoint: string;
  method: string;
  timestamp: Date;
}

export interface CSRFViolation {
  type: 'csrf_violation';
  reason: string;
  context: CSRFProtectionContext;
  severity: 'medium' | 'high' | 'critical';
  blocked: boolean;
}

// Create DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

class XSSProtectionService {
  private violationHistory: XSSViolation[] = [];
  private readonly maxHistorySize = 1000;
  private readonly maxViolationsPerIP = 5;

  /**
   * Detect XSS patterns in input
   */
  private detectXSSPatterns(input: string): string[] {
    const patterns: string[] = [];
    
    // Check for script tags
    if (SECURITY_PATTERNS.XSS_SCRIPT.test(input)) {
      patterns.push('script_tag');
    }
    
    // Check for event handlers
    if (SECURITY_PATTERNS.XSS_EVENT_HANDLERS.test(input)) {
      patterns.push('event_handlers');
    }
    
    // Check for javascript: protocols
    if (SECURITY_PATTERNS.XSS_JAVASCRIPT.test(input)) {
      patterns.push('javascript_protocol');
    }
    
    // Check for data: URIs
    if (SECURITY_PATTERNS.XSS_DATA_URI.test(input)) {
      patterns.push('data_uri');
    }
    
    // Check for dangerous HTML tags
    if (SECURITY_PATTERNS.DANGEROUS_TAGS.test(input)) {
      patterns.push('dangerous_tags');
    }
    
    // Check for CRITICAL XSS patterns only (removed common words that cause false positives)
    const additionalPatterns = [
      // Dangerous HTML tags
      { pattern: /<iframe[^>]*>/gi, name: 'iframe_tag' },
      { pattern: /<object[^>]*>/gi, name: 'object_tag' },
      { pattern: /<embed[^>]*>/gi, name: 'embed_tag' },

      // Dangerous functions (must have context to avoid false positives)
      { pattern: /\beval\s*\(/gi, name: 'eval_function' },
      { pattern: /\bsetTimeout\s*\(\s*["'`]/gi, name: 'settimeout_with_string' }, // Only if passing strings
      { pattern: /\bsetInterval\s*\(\s*["'`]/gi, name: 'setinterval_with_string' },
      { pattern: /\bFunction\s*\(\s*["'`]/gi, name: 'function_constructor' },

      // Direct DOM manipulation with HTML strings (high risk)
      { pattern: /\.innerHTML\s*=\s*["'`]/gi, name: 'innerhtml_assignment' },
      { pattern: /\.outerHTML\s*=\s*["'`]/gi, name: 'outerhtml_assignment' },
      { pattern: /\.insertAdjacentHTML\s*\(/gi, name: 'insertadjacenthtml' }
    ];
    
    additionalPatterns.forEach(({ pattern, name }) => {
      if (pattern.test(input)) {
        patterns.push(name);
      }
    });
    
    return patterns;
  }

  /**
   * Sanitize input to prevent XSS
   */
  sanitizeInput(input: string, options: {
    allowHtml?: boolean;
    allowedTags?: string[];
    allowedAttributes?: string[];
    maxLength?: number;
  } = {}): string {
    if (typeof input !== 'string') {
      return String(input);
    }

    const {
      allowHtml = false,
      allowedTags = [],
      allowedAttributes = [],
      maxLength = 10000
    } = options;

    // Truncate if too long
    let sanitized = input.length > maxLength ? input.substring(0, maxLength) : input;

    if (allowHtml) {
      // Use DOMPurify for HTML sanitization
      sanitized = purify.sanitize(sanitized, {
        ALLOWED_TAGS: allowedTags,
        ALLOWED_ATTR: allowedAttributes,
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        SANITIZE_DOM: true
      });
    } else {
      // Remove all HTML and dangerous content
      sanitized = purify.sanitize(sanitized, {
        ALLOWED_TAGS: [],
        ALLOWED_ATTR: [],
        KEEP_CONTENT: true,
        RETURN_DOM: false,
        RETURN_DOM_FRAGMENT: false,
        SANITIZE_DOM: true
      });

      // Additional XSS protection for plain text (only critical patterns)
      sanitized = sanitized
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:text\/html/gi, '') // Allow data: URLs for images but not HTML
        .replace(/on\w+\s*=/gi, '') // Remove event handlers
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/@import/gi, '')
        .replace(/<![^>]*>/gi, '')
        .replace(/\beval\s*\(/gi, '')
        .trim();
    }

    return sanitized;
  }

  /**
   * Check for XSS in request data
   */
  checkRequestForXSS(req: Request): XSSViolation[] {
    const violations: XSSViolation[] = [];
    const context: XSSProtectionContext = {
      req,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      endpoint: req.route?.path || req.path,
      method: req.method,
      timestamp: new Date()
    };

    // Skip XSS detection in development mode
    if (process.env.NODE_ENV === 'development') {
      return violations;
    }

    // Skip XSS detection for authenticated admin endpoints
    const isAdminEndpoint = req.path.startsWith('/api/admin/');
    const hasAdminAuth = req.headers.authorization?.startsWith('Bearer ');
    if (isAdminEndpoint && hasAdminAuth) {
      return violations; // Allow admin operations without XSS filtering
    }

    // Check query parameters
    if (req.query) {
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') {
          const patterns = this.detectXSSPatterns(value);
          if (patterns.length > 0) {
            violations.push({
              type: 'xss_attempt',
              pattern: patterns.join(', '),
              input: value,
              context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
              severity: this.determineSeverity(patterns),
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
            const patterns = this.detectXSSPatterns(value);
            if (patterns.length > 0) {
              violations.push({
                type: 'xss_attempt',
                pattern: patterns.join(', '),
                input: value,
                context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
                severity: this.determineSeverity(patterns),
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
    const suspiciousHeaders = ['x-forwarded-for', 'x-real-ip', 'x-originating-ip', 'x-remote-ip', 'x-remote-addr', 'referer', 'origin'];
    for (const header of suspiciousHeaders) {
      const value = req.get(header);
      if (value) {
        const patterns = this.detectXSSPatterns(value);
        if (patterns.length > 0) {
          violations.push({
            type: 'xss_attempt',
            pattern: patterns.join(', '),
            input: value,
            context: { ...context, userId: (req as AuthenticatedRequest).user?.id },
            severity: this.determineSeverity(patterns),
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
    const criticalPatterns = [
      'script_tag',
      'javascript_protocol',
      'eval_function',
      'innerhtml_assignment',
      'outerhtml_assignment',
      'function_constructor'
    ];
    const highPatterns = [
      'event_handlers',
      'dangerous_tags',
      'iframe_tag',
      'object_tag',
      'embed_tag',
      'settimeout_with_string',
      'setinterval_with_string',
      'insertadjacenthtml'
    ];
    const mediumPatterns = [
      'data_uri',
      'css_expression'
    ];

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
   * Log XSS violation
   */
  private logViolation(violation: XSSViolation): void {
    // Add to history
    this.violationHistory.unshift(violation);
    if (this.violationHistory.length > this.maxHistorySize) {
      this.violationHistory = this.violationHistory.slice(0, this.maxHistorySize);
    }

    // Log the violation
    logger.warn('XSS attempt detected', {
      type: violation.type,
      pattern: violation.pattern,
      input: violation.input.substring(0, 100),
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
  private shouldBlockIP(ip: string, req?: Request): boolean {
    // Don't block authenticated admin users
    const isAdminEndpoint = req?.path.startsWith('/api/admin/');
    const hasAdminAuth = req?.headers.authorization?.startsWith('Bearer ');
    if (isAdminEndpoint && hasAdminAuth) {
      return false; // Never block authenticated admins
    }

    const attempts = this.violationHistory.filter(v => v.context.ip === ip).length;
    return attempts >= this.maxViolationsPerIP;
  }

  /**
   * Get XSS protection statistics
   */
  getStats(): {
    totalViolations: number;
    blockedViolations: number;
    patternsDetected: string[];
    topSources: Array<{ ip: string; count: number }>;
    recentViolations: XSSViolation[];
  } {
    const totalViolations = this.violationHistory.length;
    const blockedViolations = this.violationHistory.filter(v => v.blocked).length;
    
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
      totalViolations,
      blockedViolations,
      patternsDetected,
      topSources,
      recentViolations: this.violationHistory.slice(0, 20)
    };
  }

  /**
   * Reset violation history (admin function)
   */
  resetHistory(): void {
    this.violationHistory = [];
    logger.info('XSS violation history reset');
  }
}

class CSRFProtectionService {
  private violationHistory: CSRFViolation[] = [];
  private readonly maxHistorySize = 1000;
  private readonly maxViolationsPerIP = 3;

  /**
   * Validate CSRF token
   */
  validateCSRFToken(req: Request): {
    isValid: boolean;
    violation?: CSRFViolation;
  } {
    const context: CSRFProtectionContext = {
      req,
      userId: (req as AuthenticatedRequest).user?.id,
      ip: req.ip || req.connection.remoteAddress || 'unknown',
      userAgent: req.get('User-Agent'),
      endpoint: req.route?.path || req.path,
      method: req.method,
      timestamp: new Date()
    };

    // Skip CSRF for GET requests and safe endpoints
    if (req.method === 'GET' ||
        req.path.startsWith('/api/health') ||
        req.path.startsWith('/api/admin/auth') ||
        req.path.startsWith('/api/security/csp-report') ||
        req.path.startsWith('/api/security/ct-report') ||
        process.env.NODE_ENV === 'test' ||
        process.env.DISABLE_CSRF === 'true') {
      return { isValid: true };
    }

    // Check for CSRF token in headers
    const token = req.headers['x-csrf-token'] as string;
    const secret = req.headers['x-csrf-secret'] as string;

    if (!token || !secret) {
      const violation: CSRFViolation = {
        type: 'csrf_violation',
        reason: 'CSRF token missing',
        context,
        severity: 'high',
        blocked: true
      };
      return { isValid: false, violation };
    }

    // Validate token format
    if (!/^[a-zA-Z0-9_-]+$/.test(token) || !/^[a-zA-Z0-9_-]+$/.test(secret)) {
      const violation: CSRFViolation = {
        type: 'csrf_violation',
        reason: 'Invalid CSRF token format',
        context,
        severity: 'high',
        blocked: true
      };
      return { isValid: false, violation };
    }

    // Check token length
    if (token.length < 16 || secret.length < 8) {
      const violation: CSRFViolation = {
        type: 'csrf_violation',
        reason: 'CSRF token too short',
        context,
        severity: 'medium',
        blocked: true
      };
      return { isValid: false, violation };
    }

    // Check for suspicious patterns
    if (token === secret || token.includes(secret) || secret.includes(token)) {
      const violation: CSRFViolation = {
        type: 'csrf_violation',
        reason: 'Suspicious CSRF token relationship',
        context,
        severity: 'critical',
        blocked: true
      };
      return { isValid: false, violation };
    }

    return { isValid: true };
  }

  /**
   * Log CSRF violation
   */
  private logViolation(violation: CSRFViolation): void {
    // Add to history
    this.violationHistory.unshift(violation);
    if (this.violationHistory.length > this.maxHistorySize) {
      this.violationHistory = this.violationHistory.slice(0, this.maxHistorySize);
    }

    // Log the violation
    logger.warn('CSRF violation detected', {
      type: violation.type,
      reason: violation.reason,
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
  private shouldBlockIP(ip: string, req?: Request): boolean {
    // Don't block authenticated admin users
    const isAdminEndpoint = req?.path.startsWith('/api/admin/');
    const hasAdminAuth = req?.headers.authorization?.startsWith('Bearer ');
    if (isAdminEndpoint && hasAdminAuth) {
      return false; // Never block authenticated admins
    }

    const attempts = this.violationHistory.filter(v => v.context.ip === ip).length;
    return attempts >= this.maxViolationsPerIP;
  }

  /**
   * Get CSRF protection statistics
   */
  getStats(): {
    totalViolations: number;
    blockedViolations: number;
    reasons: string[];
    topSources: Array<{ ip: string; count: number }>;
    recentViolations: CSRFViolation[];
  } {
    const totalViolations = this.violationHistory.length;
    const blockedViolations = this.violationHistory.filter(v => v.blocked).length;
    
    const reasons = [...new Set(this.violationHistory.map(v => v.reason))];

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
      totalViolations,
      blockedViolations,
      reasons,
      topSources,
      recentViolations: this.violationHistory.slice(0, 20)
    };
  }

  /**
   * Reset violation history (admin function)
   */
  resetHistory(): void {
    this.violationHistory = [];
    logger.info('CSRF violation history reset');
  }
}

// Global service instances
const xssProtectionService = new XSSProtectionService();
const csrfProtectionService = new CSRFProtectionService();

/**
 * XSS Protection Middleware
 */
export function xssProtection() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Check for XSS patterns
      const violations = xssProtectionService.checkRequestForXSS(req);

      if (violations.length > 0) {
        // Log all violations
        violations.forEach(violation => {
          xssProtectionService['logViolation'](violation);
        });

        // Log to comprehensive security logging service
        await logXSSEvent(req, violations, true);

        // Check if IP should be blocked
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (xssProtectionService['shouldBlockIP'](ip, req)) {
          logger.error('IP blocked due to repeated XSS attempts', {
            ip,
            attempts: violations.length
          });

          res.status(403).json({
            error: {
              code: 'IP_BLOCKED',
              message: 'Your IP address has been blocked due to repeated security violations.',
              reason: 'XSS attempts detected'
            }
          });
          return;
        }

        // Block the request
        res.status(400).json({
          error: {
            code: 'XSS_DETECTED',
            message: 'Request contains potentially malicious content.',
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
            (req.query as any)[key] = xssProtectionService.sanitizeInput(value);
          }
        }
      }

      if (req.body && typeof req.body === 'object') {
        const sanitizeObject = (obj: any) => {
          for (const [key, value] of Object.entries(obj)) {
            if (typeof value === 'string') {
              (obj as any)[key] = xssProtectionService.sanitizeInput(value);
            } else if (typeof value === 'object' && value !== null) {
              sanitizeObject(value);
            }
          }
        };
        sanitizeObject(req.body);
      }

      next();
    } catch (error) {
      logger.error('XSS protection middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        endpoint: req.path
      });
      next();
    }
  };
}

/**
 * CSRF Protection Middleware
 */
export function csrfProtection() {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate CSRF token
      const validation = csrfProtectionService.validateCSRFToken(req);

      if (!validation.isValid && validation.violation) {
        // Log violation
        csrfProtectionService['logViolation'](validation.violation);

        // Log to comprehensive security logging service
        await logCSRFEvent(req, validation.violation, true);

        // Check if IP should be blocked
        const ip = req.ip || req.connection.remoteAddress || 'unknown';
        if (csrfProtectionService['shouldBlockIP'](ip, req)) {
          logger.error('IP blocked due to repeated CSRF violations', {
            ip,
            attempts: csrfProtectionService['violationHistory'].filter(v => v.context.ip === ip).length
          });

          res.status(403).json({
            error: {
              code: 'IP_BLOCKED',
              message: 'Your IP address has been blocked due to repeated security violations.',
              reason: 'CSRF violations detected'
            }
          });
          return;
        }

        // Block the request
        res.status(403).json({
          error: {
            code: 'CSRF_VIOLATION',
            message: 'CSRF token validation failed.',
            reason: validation.violation.reason
          }
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('CSRF protection middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip,
        endpoint: req.path
      });
      next();
    }
  };
}

/**
 * Get XSS protection statistics (admin function)
 */
export function getXSSProtectionStats() {
  return xssProtectionService.getStats();
}

/**
 * Get CSRF protection statistics (admin function)
 */
export function getCSRFProtectionStats() {
  return csrfProtectionService.getStats();
}

/**
 * Reset XSS protection history (admin function)
 */
export function resetXSSProtectionHistory() {
  xssProtectionService.resetHistory();
}

/**
 * Reset CSRF protection history (admin function)
 */
export function resetCSRFProtectionHistory() {
  csrfProtectionService.resetHistory();
}

export default {
  xssProtection,
  csrfProtection,
  getXSSProtectionStats,
  getCSRFProtectionStats,
  resetXSSProtectionHistory,
  resetCSRFProtectionHistory
};
