/**
 * CSRF Protection and Input Sanitization Integration Middleware
 * 
 * Comprehensive security middleware that integrates CSRF protection with advanced
 * input sanitization for social feed content. Provides multi-layered protection
 * against CSRF attacks, XSS, injection attacks, and malicious content.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { xssProtection, csrfProtection } from './xss-csrf-protection.middleware';
import { AuthenticatedRequest } from './auth.middleware';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import crypto from 'crypto';

// Create DOMPurify instance for server-side sanitization
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

export interface CSRFSanitizationConfig {
  enableCSRFProtection: boolean;
  enableInputSanitization: boolean;
  enableContentValidation: boolean;
  enableSecurityHeaders: boolean;
  
  // CSRF Configuration
  csrfTokenExpiry: number; // in milliseconds
  csrfSecretRotationInterval: number; // in milliseconds
  trustedOrigins: string[];
  
  // Sanitization Configuration
  contentTypes: {
    [key: string]: {
      allowHtml: boolean;
      maxLength: number;
      allowedTags?: string[];
      allowedAttributes?: string[];
      customSanitizers?: ((input: string) => string)[];
    };
  };
  
  // Security Configuration
  enableRateLimitBypass: boolean;
  enableSecurityLogging: boolean;
  blockSuspiciousRequests: boolean;
}

export interface SecurityContext {
  userId: string;
  userRole: string;
  requestId: string;
  timestamp: Date;
  ipAddress: string;
  userAgent: string;
  contentType?: string;
  sanitizationApplied: string[];
  securityChecks: string[];
}

export interface SanitizationResult {
  originalContent: string;
  sanitizedContent: string;
  violationsDetected: string[];
  sanitizersApplied: string[];
  securityScore: number; // 0-100, higher is more secure
}

class CSRFSanitizationIntegration {
  private config: CSRFSanitizationConfig;
  private csrfSecrets: Map<string, { secret: string; createdAt: Date }> = new Map();
  private lastSecretRotation = Date.now();

  constructor(config?: Partial<CSRFSanitizationConfig>) {
    this.config = {
      enableCSRFProtection: true,
      enableInputSanitization: true,
      enableContentValidation: true,
      enableSecurityHeaders: true,
      csrfTokenExpiry: 60 * 60 * 1000, // 1 hour
      csrfSecretRotationInterval: 24 * 60 * 60 * 1000, // 24 hours
      trustedOrigins: ['http://localhost:3000', 'https://yourdomain.com'],
      contentTypes: {
        post: {
          allowHtml: false,
          maxLength: 2000,
          customSanitizers: [
            (input: string) => this.sanitizeHashtags(input),
            (input: string) => this.sanitizeMentions(input),
            (input: string) => this.sanitizeUrls(input)
          ]
        },
        comment: {
          allowHtml: false,
          maxLength: 500,
          customSanitizers: [
            (input: string) => this.sanitizeHashtags(input),
            (input: string) => this.sanitizeMentions(input)
          ]
        },
        report: {
          allowHtml: false,
          maxLength: 1000,
          customSanitizers: [
            (input: string) => this.sanitizeReportContent(input)
          ]
        },
        upload: {
          allowHtml: false,
          maxLength: 200, // For alt text and descriptions
          customSanitizers: []
        }
      },
      enableRateLimitBypass: false,
      enableSecurityLogging: true,
      blockSuspiciousRequests: true,
      ...config
    };

    // Initialize CSRF secret rotation
    this.startSecretRotation();
  }

  /**
   * Main middleware function for CSRF protection and input sanitization
   */
  public middleware(contentType: string = 'general') {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        const userId = (req as AuthenticatedRequest).user?.id;
        if (!userId) {
          res.status(401).json({
            success: false,
            error: {
              code: 'AUTHENTICATION_REQUIRED',
              message: 'Authentication required for security validation',
              timestamp: new Date().toISOString()
            }
          });
          return;
        }

        // Create security context
        const securityContext: SecurityContext = {
          userId,
          userRole: (req as AuthenticatedRequest).user!.role,
          requestId: crypto.randomUUID(),
          timestamp: new Date(),
          ipAddress: req.ip || 'unknown',
          userAgent: req.get('User-Agent') || 'unknown',
          contentType,
          sanitizationApplied: [],
          securityChecks: []
        };

        // 1. Apply security headers
        if (this.config.enableSecurityHeaders) {
          this.applySecurityHeaders(res);
          securityContext.securityChecks.push('security_headers');
        }

        // 2. CSRF Protection
        if (this.config.enableCSRFProtection && this.requiresCSRFProtection(req)) {
          const csrfResult = await this.validateCSRFToken(req, securityContext);
          if (!csrfResult.valid) {
            this.handleCSRFViolation(res, csrfResult, securityContext);
            return;
          }
          securityContext.securityChecks.push('csrf_validation');
        }

        // 3. Input Sanitization
        if (this.config.enableInputSanitization && req.body) {
          const sanitizationResult = await this.sanitizeRequestContent(
            req, 
            contentType, 
            securityContext
          );
          
          if (sanitizationResult.securityScore < 50) {
            this.handleSuspiciousContent(res, sanitizationResult, securityContext);
            return;
          }
          
          securityContext.sanitizationApplied = sanitizationResult.sanitizersApplied;
        }

        // 4. Content Validation Integration
        if (this.config.enableContentValidation) {
          const validationResult = await this.performContentValidation(req, securityContext);
          if (!validationResult.passed) {
            this.handleContentValidationFailure(res, validationResult, securityContext);
            return;
          }
          securityContext.securityChecks.push('content_validation');
        }

        // Add security context to request for downstream middleware
        (req as any).securityContext = securityContext;

        // Log successful security validation
        if (this.config.enableSecurityLogging) {
          this.logSecurityEvent('security_validation_passed', securityContext);
        }

        next();

      } catch (error) {
        logger.error('CSRF sanitization integration error', {
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
          userId: (req as AuthenticatedRequest).user?.id,
          path: req.path,
          method: req.method,
          contentType
        });

        res.status(500).json({
          success: false,
          error: {
            code: 'SECURITY_VALIDATION_FAILED',
            message: 'Security validation failed. Please try again later.',
            timestamp: new Date().toISOString()
          }
        });
      }
    };
  }

  /**
   * Apply comprehensive security headers
   */
  private applySecurityHeaders(res: Response): void {
    // CSRF Protection Headers
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    
    // Content Security Policy for feed content
    res.setHeader('Content-Security-Policy', [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self'",
      "connect-src 'self'",
      "media-src 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'"
    ].join('; '));

    // Additional security headers
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  }

  /**
   * Check if request requires CSRF protection
   */
  private requiresCSRFProtection(req: Request): boolean {
    // CSRF protection required for state-changing operations
    const protectedMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
    return protectedMethods.includes(req.method);
  }

  /**
   * Validate CSRF token
   */
  private async validateCSRFToken(
    req: Request, 
    context: SecurityContext
  ): Promise<{ valid: boolean; reason?: string; token?: string }> {
    try {
      // Get CSRF token from header or body
      const token = req.get('X-CSRF-Token') || req.body._csrf;
      
      if (!token) {
        return { valid: false, reason: 'CSRF token missing' };
      }

      // Validate token format and signature
      const tokenParts = token.split('.');
      if (tokenParts.length !== 3) {
        return { valid: false, reason: 'Invalid CSRF token format' };
      }

      const [timestamp, userId, signature] = tokenParts;
      
      // Check token expiry
      const tokenTime = parseInt(timestamp, 10);
      if (Date.now() - tokenTime > this.config.csrfTokenExpiry) {
        return { valid: false, reason: 'CSRF token expired' };
      }

      // Verify user ID matches
      if (userId !== context.userId) {
        return { valid: false, reason: 'CSRF token user mismatch' };
      }

      // Validate signature
      const secret = this.getCurrentCSRFSecret();
      const expectedSignature = this.generateCSRFSignature(timestamp, userId, secret);
      
      if (signature !== expectedSignature) {
        return { valid: false, reason: 'Invalid CSRF token signature' };
      }

      return { valid: true, token };

    } catch (error) {
      logger.warn('CSRF token validation error', { error, userId: context.userId });
      return { valid: false, reason: 'CSRF validation failed' };
    }
  }

  /**
   * Generate CSRF token for user
   */
  public generateCSRFToken(userId: string): string {
    const timestamp = Date.now().toString();
    const secret = this.getCurrentCSRFSecret();
    const signature = this.generateCSRFSignature(timestamp, userId, secret);
    
    return `${timestamp}.${userId}.${signature}`;
  }

  /**
   * Generate CSRF signature
   */
  private generateCSRFSignature(timestamp: string, userId: string, secret: string): string {
    return crypto
      .createHmac('sha256', secret)
      .update(`${timestamp}.${userId}`)
      .digest('hex');
  }

  /**
   * Get current CSRF secret with rotation
   */
  private getCurrentCSRFSecret(): string {
    const now = Date.now();
    
    // Rotate secret if needed
    if (now - this.lastSecretRotation > this.config.csrfSecretRotationInterval) {
      this.rotateCSRFSecret();
    }

    // Return the most recent secret
    const secrets = Array.from(this.csrfSecrets.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return secrets[0]?.secret || this.createNewCSRFSecret();
  }

  /**
   * Rotate CSRF secret
   */
  private rotateCSRFSecret(): void {
    const newSecret = this.createNewCSRFSecret();
    this.lastSecretRotation = Date.now();
    
    // Clean up old secrets (keep last 2 for grace period)
    const secrets = Array.from(this.csrfSecrets.entries())
      .sort((a, b) => b[1].createdAt.getTime() - a[1].createdAt.getTime())
      .slice(2);
    
    secrets.forEach(([key]) => this.csrfSecrets.delete(key));
    
    logger.info('CSRF secret rotated', { secretCount: this.csrfSecrets.size });
  }

  /**
   * Create new CSRF secret
   */
  private createNewCSRFSecret(): string {
    const secret = crypto.randomBytes(32).toString('hex');
    const key = crypto.randomUUID();
    
    this.csrfSecrets.set(key, {
      secret,
      createdAt: new Date()
    });
    
    return secret;
  }

  /**
   * Start automatic secret rotation
   */
  private startSecretRotation(): void {
    // Initial secret
    this.createNewCSRFSecret();
    
    // Set up rotation interval
    setInterval(() => {
      this.rotateCSRFSecret();
    }, this.config.csrfSecretRotationInterval);
  }

  /**
   * Sanitize request content based on content type
   */
  private async sanitizeRequestContent(
    req: Request,
    contentType: string,
    context: SecurityContext
  ): Promise<SanitizationResult> {
    const config = this.config.contentTypes[contentType] || this.config.contentTypes.post;
    const violations: string[] = [];
    const sanitizersApplied: string[] = [];
    let securityScore = 100;

    // Deep clone request body for processing
    const originalBody = JSON.stringify(req.body);
    let processedBody = { ...req.body };

    // Apply base sanitization
    processedBody = this.sanitizeObject(processedBody, config, violations, sanitizersApplied);
    
    // Apply custom sanitizers
    if (config.customSanitizers) {
      for (const sanitizer of config.customSanitizers) {
        if (processedBody.content) {
          const before = processedBody.content;
          processedBody.content = sanitizer(processedBody.content);
          if (before !== processedBody.content) {
            sanitizersApplied.push(sanitizer.name || 'custom_sanitizer');
          }
        }
      }
    }

    // Calculate security score based on violations
    securityScore = Math.max(0, 100 - (violations.length * 10));

    // Update request body with sanitized content
    req.body = processedBody;

    return {
      originalContent: originalBody,
      sanitizedContent: JSON.stringify(processedBody),
      violationsDetected: violations,
      sanitizersApplied,
      securityScore
    };
  }

  /**
   * Recursively sanitize object properties
   */
  private sanitizeObject(
    obj: any,
    config: any,
    violations: string[],
    sanitizersApplied: string[]
  ): any {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }

    const sanitized: any = Array.isArray(obj) ? [] : {};

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const originalValue = value;
        let sanitizedValue = value;

        // Apply length limits
        if (config.maxLength && sanitizedValue.length > config.maxLength) {
          sanitizedValue = sanitizedValue.substring(0, config.maxLength);
          violations.push(`length_exceeded_${key}`);
          sanitizersApplied.push('length_limiter');
        }

        // Apply HTML sanitization
        if (config.allowHtml) {
          sanitizedValue = purify.sanitize(sanitizedValue, {
            ALLOWED_TAGS: config.allowedTags || [],
            ALLOWED_ATTR: config.allowedAttributes || [],
            KEEP_CONTENT: true
          });
        } else {
          sanitizedValue = purify.sanitize(sanitizedValue, {
            ALLOWED_TAGS: [],
            ALLOWED_ATTR: [],
            KEEP_CONTENT: true
          });
        }

        // Check for violations
        if (originalValue !== sanitizedValue) {
          violations.push(`content_sanitized_${key}`);
          sanitizersApplied.push('html_sanitizer');
        }

        sanitized[key] = sanitizedValue;
      } else if (typeof value === 'object') {
        sanitized[key] = this.sanitizeObject(value, config, violations, sanitizersApplied);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Custom sanitizer for hashtags
   */
  private sanitizeHashtags(input: string): string {
    return input.replace(/#[^\s#]+/g, (match) => {
      // Remove potentially dangerous characters from hashtags
      return match.replace(/[<>'"&]/g, '');
    });
  }

  /**
   * Custom sanitizer for mentions
   */
  private sanitizeMentions(input: string): string {
    return input.replace(/@[^\s@]+/g, (match) => {
      // Remove potentially dangerous characters from mentions
      return match.replace(/[<>'"&]/g, '');
    });
  }

  /**
   * Custom sanitizer for URLs
   */
  private sanitizeUrls(input: string): string {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return input.replace(urlRegex, (match) => {
      try {
        const url = new URL(match);
        // Only allow http and https protocols
        if (url.protocol === 'http:' || url.protocol === 'https:') {
          return url.toString();
        }
        return '[removed-unsafe-url]';
      } catch {
        return '[invalid-url]';
      }
    });
  }

  /**
   * Custom sanitizer for report content
   */
  private sanitizeReportContent(input: string): string {
    // Remove potentially sensitive information from reports
    return input
      .replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '[REDACTED-CARD]')
      .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[REDACTED-SSN]')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[REDACTED-EMAIL]');
  }

  /**
   * Perform additional content validation
   */
  private async performContentValidation(
    req: Request,
    context: SecurityContext
  ): Promise<{ passed: boolean; violations: string[] }> {
    const violations: string[] = [];

    // Check for suspicious patterns
    if (req.body.content) {
      const content = req.body.content.toLowerCase();
      
      // Check for potential spam patterns
      if (content.includes('click here') || content.includes('buy now')) {
        violations.push('potential_spam');
      }
      
      // Check for excessive repetition
      const words = content.split(/\s+/);
      const wordCount = new Map<string, number>();
      words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      });
      
      const maxRepeats = Math.max(...wordCount.values());
      if (maxRepeats > words.length * 0.3) {
        violations.push('excessive_repetition');
      }
    }

    return {
      passed: violations.length === 0,
      violations
    };
  }

  /**
   * Handle CSRF violation
   */
  private handleCSRFViolation(
    res: Response,
    csrfResult: { valid: boolean; reason?: string },
    context: SecurityContext
  ): void {
    this.logSecurityEvent('csrf_violation', context, { reason: csrfResult.reason });

    res.status(403).json({
      success: false,
      error: {
        code: 'CSRF_VALIDATION_FAILED',
        message: 'CSRF token validation failed. Please refresh and try again.',
        reason: csrfResult.reason,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle suspicious content
   */
  private handleSuspiciousContent(
    res: Response,
    sanitizationResult: SanitizationResult,
    context: SecurityContext
  ): void {
    this.logSecurityEvent('suspicious_content', context, {
      violations: sanitizationResult.violationsDetected,
      securityScore: sanitizationResult.securityScore
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'CONTENT_SECURITY_VIOLATION',
        message: 'Content contains potentially malicious or suspicious elements.',
        violations: sanitizationResult.violationsDetected,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Handle content validation failure
   */
  private handleContentValidationFailure(
    res: Response,
    validationResult: { passed: boolean; violations: string[] },
    context: SecurityContext
  ): void {
    this.logSecurityEvent('content_validation_failed', context, {
      violations: validationResult.violations
    });

    res.status(400).json({
      success: false,
      error: {
        code: 'CONTENT_VALIDATION_FAILED',
        message: 'Content failed validation checks.',
        violations: validationResult.violations,
        timestamp: new Date().toISOString()
      }
    });
  }

  /**
   * Log security events
   */
  private logSecurityEvent(
    eventType: string,
    context: SecurityContext,
    additionalData?: any
  ): void {
    if (!this.config.enableSecurityLogging) return;

    logger.warn(`Security event: ${eventType}`, {
      eventType,
      requestId: context.requestId,
      userId: context.userId,
      userRole: context.userRole,
      ipAddress: context.ipAddress,
      userAgent: context.userAgent,
      contentType: context.contentType,
      timestamp: context.timestamp.toISOString(),
      sanitizationApplied: context.sanitizationApplied,
      securityChecks: context.securityChecks,
      ...additionalData
    });
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<CSRFSanitizationConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Get CSRF token for client
   */
  getCSRFTokenForUser(userId: string): string {
    return this.generateCSRFToken(userId);
  }
}

// Export singleton instance
export const csrfSanitizationIntegration = new CSRFSanitizationIntegration();

// Export convenience functions for different content types
export function createPostCSRFSanitization(config?: Partial<CSRFSanitizationConfig>) {
  const middleware = new CSRFSanitizationIntegration(config);
  return middleware.middleware('post');
}

export function createCommentCSRFSanitization(config?: Partial<CSRFSanitizationConfig>) {
  const middleware = new CSRFSanitizationIntegration(config);
  return middleware.middleware('comment');
}

export function createReportCSRFSanitization(config?: Partial<CSRFSanitizationConfig>) {
  const middleware = new CSRFSanitizationIntegration(config);
  return middleware.middleware('report');
}

export function createUploadCSRFSanitization(config?: Partial<CSRFSanitizationConfig>) {
  const middleware = new CSRFSanitizationIntegration(config);
  return middleware.middleware('upload');
}

export { CSRFSanitizationIntegration };

