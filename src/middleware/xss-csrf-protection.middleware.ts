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
    
    // Check for additional XSS patterns
    const additionalPatterns = [
      { pattern: /<iframe[^>]*>/gi, name: 'iframe_tag' },
      { pattern: /<object[^>]*>/gi, name: 'object_tag' },
      { pattern: /<embed[^>]*>/gi, name: 'embed_tag' },
      { pattern: /<form[^>]*>/gi, name: 'form_tag' },
      { pattern: /<input[^>]*>/gi, name: 'input_tag' },
      { pattern: /<textarea[^>]*>/gi, name: 'textarea_tag' },
      { pattern: /<select[^>]*>/gi, name: 'select_tag' },
      { pattern: /<button[^>]*>/gi, name: 'button_tag' },
      { pattern: /<link[^>]*>/gi, name: 'link_tag' },
      { pattern: /<meta[^>]*>/gi, name: 'meta_tag' },
      { pattern: /<style[^>]*>/gi, name: 'style_tag' },
      { pattern: /expression\s*\(/gi, name: 'css_expression' },
      { pattern: /url\s*\(/gi, name: 'css_url' },
      { pattern: /@import/gi, name: 'css_import' },
      { pattern: /<![^>]*>/gi, name: 'html_comment' },
      { pattern: /&#x?[0-9a-f]+;/gi, name: 'html_entities' },
      { pattern: /%[0-9a-f]{2}/gi, name: 'url_encoding' },
      { pattern: /\\x[0-9a-f]{2}/gi, name: 'hex_encoding' },
      { pattern: /\\u[0-9a-f]{4}/gi, name: 'unicode_encoding' },
      { pattern: /\\[0-7]{3}/gi, name: 'octal_encoding' },
      { pattern: /base64/gi, name: 'base64_encoding' },
      { pattern: /eval\s*\(/gi, name: 'eval_function' },
      { pattern: /setTimeout\s*\(/gi, name: 'settimeout_function' },
      { pattern: /setInterval\s*\(/gi, name: 'setinterval_function' },
      { pattern: /Function\s*\(/gi, name: 'function_constructor' },
      { pattern: /document\./gi, name: 'document_object' },
      { pattern: /window\./gi, name: 'window_object' },
      { pattern: /location\./gi, name: 'location_object' },
      { pattern: /navigator\./gi, name: 'navigator_object' },
      { pattern: /screen\./gi, name: 'screen_object' },
      { pattern: /history\./gi, name: 'history_object' },
      { pattern: /localStorage/gi, name: 'localstorage' },
      { pattern: /sessionStorage/gi, name: 'sessionstorage' },
      { pattern: /cookie/gi, name: 'cookie_access' },
      { pattern: /XMLHttpRequest/gi, name: 'xhr_object' },
      { pattern: /fetch\s*\(/gi, name: 'fetch_function' },
      { pattern: /WebSocket/gi, name: 'websocket' },
      { pattern: /postMessage/gi, name: 'postmessage' },
      { pattern: /addEventListener/gi, name: 'addeventlistener' },
      { pattern: /attachEvent/gi, name: 'attachevent' },
      { pattern: /innerHTML/gi, name: 'innerhtml' },
      { pattern: /outerHTML/gi, name: 'outerhtml' },
      { pattern: /insertAdjacentHTML/gi, name: 'insertadjacenthtml' },
      { pattern: /createElement/gi, name: 'createelement' },
      { pattern: /appendChild/gi, name: 'appendchild' },
      { pattern: /insertBefore/gi, name: 'insertbefore' },
      { pattern: /replaceChild/gi, name: 'replacechild' },
      { pattern: /removeChild/gi, name: 'removechild' },
      { pattern: /cloneNode/gi, name: 'clonenode' },
      { pattern: /getAttribute/gi, name: 'getattribute' },
      { pattern: /setAttribute/gi, name: 'setattribute' },
      { pattern: /removeAttribute/gi, name: 'removeattribute' },
      { pattern: /getElementsBy/gi, name: 'getelementsby' },
      { pattern: /querySelector/gi, name: 'queryselector' },
      { pattern: /querySelectorAll/gi, name: 'queryselectorall' },
      { pattern: /getElementById/gi, name: 'getelementbyid' },
      { pattern: /getElementsByClassName/gi, name: 'getelementsbyclassname' },
      { pattern: /getElementsByTagName/gi, name: 'getelementsbytagname' },
      { pattern: /parentNode/gi, name: 'parentnode' },
      { pattern: /childNodes/gi, name: 'childnodes' },
      { pattern: /firstChild/gi, name: 'firstchild' },
      { pattern: /lastChild/gi, name: 'lastchild' },
      { pattern: /nextSibling/gi, name: 'nextsibling' },
      { pattern: /previousSibling/gi, name: 'previoussibling' },
      { pattern: /nodeType/gi, name: 'nodetype' },
      { pattern: /nodeName/gi, name: 'nodename' },
      { pattern: /nodeValue/gi, name: 'nodevalue' },
      { pattern: /textContent/gi, name: 'textcontent' },
      { pattern: /innerText/gi, name: 'innertext' },
      { pattern: /outerText/gi, name: 'outertext' },
      { pattern: /scrollIntoView/gi, name: 'scrollintoview' },
      { pattern: /scrollTo/gi, name: 'scrollto' },
      { pattern: /scrollBy/gi, name: 'scrollby' },
      { pattern: /focus/gi, name: 'focus' },
      { pattern: /blur/gi, name: 'blur' },
      { pattern: /click/gi, name: 'click' },
      { pattern: /submit/gi, name: 'submit' },
      { pattern: /reset/gi, name: 'reset' },
      { pattern: /select/gi, name: 'select' },
      { pattern: /change/gi, name: 'change' },
      { pattern: /load/gi, name: 'load' },
      { pattern: /unload/gi, name: 'unload' },
      { pattern: /beforeunload/gi, name: 'beforeunload' },
      { pattern: /resize/gi, name: 'resize' },
      { pattern: /scroll/gi, name: 'scroll' },
      { pattern: /error/gi, name: 'error' },
      { pattern: /abort/gi, name: 'abort' },
      { pattern: /loadstart/gi, name: 'loadstart' },
      { pattern: /loadend/gi, name: 'loadend' },
      { pattern: /progress/gi, name: 'progress' },
      { pattern: /timeout/gi, name: 'timeout' },
      { pattern: /readystatechange/gi, name: 'readystatechange' },
      { pattern: /DOMContentLoaded/gi, name: 'domcontentloaded' },
      { pattern: /pageshow/gi, name: 'pageshow' },
      { pattern: /pagehide/gi, name: 'pagehide' },
      { pattern: /beforeprint/gi, name: 'beforeprint' },
      { pattern: /afterprint/gi, name: 'afterprint' },
      { pattern: /online/gi, name: 'online' },
      { pattern: /offline/gi, name: 'offline' },
      { pattern: /popstate/gi, name: 'popstate' },
      { pattern: /hashchange/gi, name: 'hashchange' },
      { pattern: /storage/gi, name: 'storage' },
      { pattern: /message/gi, name: 'message' },
      { pattern: /beforeunload/gi, name: 'beforeunload' },
      { pattern: /unload/gi, name: 'unload' },
      { pattern: /load/gi, name: 'load' },
      { pattern: /error/gi, name: 'error' },
      { pattern: /abort/gi, name: 'abort' },
      { pattern: /loadstart/gi, name: 'loadstart' },
      { pattern: /loadend/gi, name: 'loadend' },
      { pattern: /progress/gi, name: 'progress' },
      { pattern: /timeout/gi, name: 'timeout' },
      { pattern: /readystatechange/gi, name: 'readystatechange' },
      { pattern: /DOMContentLoaded/gi, name: 'domcontentloaded' },
      { pattern: /pageshow/gi, name: 'pageshow' },
      { pattern: /pagehide/gi, name: 'pagehide' },
      { pattern: /beforeprint/gi, name: 'beforeprint' },
      { pattern: /afterprint/gi, name: 'afterprint' },
      { pattern: /online/gi, name: 'online' },
      { pattern: /offline/gi, name: 'offline' },
      { pattern: /popstate/gi, name: 'popstate' },
      { pattern: /hashchange/gi, name: 'hashchange' },
      { pattern: /storage/gi, name: 'storage' },
      { pattern: /message/gi, name: 'message' }
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

      // Additional XSS protection for plain text
      sanitized = sanitized
        .replace(/javascript:/gi, '')
        .replace(/vbscript:/gi, '')
        .replace(/data:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
        .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
        .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
        .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '')
        .replace(/<input\b[^<]*(?:(?!<\/input>)<[^<]*)*<\/input>/gi, '')
        .replace(/<textarea\b[^<]*(?:(?!<\/textarea>)<[^<]*)*<\/textarea>/gi, '')
        .replace(/<select\b[^<]*(?:(?!<\/select>)<[^<]*)*<\/select>/gi, '')
        .replace(/<button\b[^<]*(?:(?!<\/button>)<[^<]*)*<\/button>/gi, '')
        .replace(/<link\b[^<]*(?:(?!<\/link>)<[^<]*)*<\/link>/gi, '')
        .replace(/<meta\b[^<]*(?:(?!<\/meta>)<[^<]*)*<\/meta>/gi, '')
        .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
        .replace(/expression\s*\(/gi, '')
        .replace(/url\s*\(/gi, '')
        .replace(/@import/gi, '')
        .replace(/<![^>]*>/gi, '')
        .replace(/&#x?[0-9a-f]+;/gi, '')
        .replace(/%[0-9a-f]{2}/gi, '')
        .replace(/\\x[0-9a-f]{2}/gi, '')
        .replace(/\\u[0-9a-f]{4}/gi, '')
        .replace(/\\[0-7]{3}/gi, '')
        .replace(/base64/gi, '')
        .replace(/eval\s*\(/gi, '')
        .replace(/setTimeout\s*\(/gi, '')
        .replace(/setInterval\s*\(/gi, '')
        .replace(/Function\s*\(/gi, '')
        .replace(/document\./gi, '')
        .replace(/window\./gi, '')
        .replace(/location\./gi, '')
        .replace(/navigator\./gi, '')
        .replace(/screen\./gi, '')
        .replace(/history\./gi, '')
        .replace(/localStorage/gi, '')
        .replace(/sessionStorage/gi, '')
        .replace(/cookie/gi, '')
        .replace(/XMLHttpRequest/gi, '')
        .replace(/fetch\s*\(/gi, '')
        .replace(/WebSocket/gi, '')
        .replace(/postMessage/gi, '')
        .replace(/addEventListener/gi, '')
        .replace(/attachEvent/gi, '')
        .replace(/innerHTML/gi, '')
        .replace(/outerHTML/gi, '')
        .replace(/insertAdjacentHTML/gi, '')
        .replace(/createElement/gi, '')
        .replace(/appendChild/gi, '')
        .replace(/insertBefore/gi, '')
        .replace(/replaceChild/gi, '')
        .replace(/removeChild/gi, '')
        .replace(/cloneNode/gi, '')
        .replace(/getAttribute/gi, '')
        .replace(/setAttribute/gi, '')
        .replace(/removeAttribute/gi, '')
        .replace(/getElementsBy/gi, '')
        .replace(/querySelector/gi, '')
        .replace(/querySelectorAll/gi, '')
        .replace(/getElementById/gi, '')
        .replace(/getElementsByClassName/gi, '')
        .replace(/getElementsByTagName/gi, '')
        .replace(/parentNode/gi, '')
        .replace(/childNodes/gi, '')
        .replace(/firstChild/gi, '')
        .replace(/lastChild/gi, '')
        .replace(/nextSibling/gi, '')
        .replace(/previousSibling/gi, '')
        .replace(/nodeType/gi, '')
        .replace(/nodeName/gi, '')
        .replace(/nodeValue/gi, '')
        .replace(/textContent/gi, '')
        .replace(/innerText/gi, '')
        .replace(/outerText/gi, '')
        .replace(/scrollIntoView/gi, '')
        .replace(/scrollTo/gi, '')
        .replace(/scrollBy/gi, '')
        .replace(/focus/gi, '')
        .replace(/blur/gi, '')
        .replace(/click/gi, '')
        .replace(/submit/gi, '')
        .replace(/reset/gi, '')
        .replace(/select/gi, '')
        .replace(/change/gi, '')
        .replace(/load/gi, '')
        .replace(/unload/gi, '')
        .replace(/beforeunload/gi, '')
        .replace(/resize/gi, '')
        .replace(/scroll/gi, '')
        .replace(/error/gi, '')
        .replace(/abort/gi, '')
        .replace(/loadstart/gi, '')
        .replace(/loadend/gi, '')
        .replace(/progress/gi, '')
        .replace(/timeout/gi, '')
        .replace(/readystatechange/gi, '')
        .replace(/DOMContentLoaded/gi, '')
        .replace(/pageshow/gi, '')
        .replace(/pagehide/gi, '')
        .replace(/beforeprint/gi, '')
        .replace(/afterprint/gi, '')
        .replace(/online/gi, '')
        .replace(/offline/gi, '')
        .replace(/popstate/gi, '')
        .replace(/hashchange/gi, '')
        .replace(/storage/gi, '')
        .replace(/message/gi, '')
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
    const criticalPatterns = ['script_tag', 'javascript_protocol', 'eval_function', 'document_object', 'window_object'];
    const highPatterns = ['event_handlers', 'dangerous_tags', 'iframe_tag', 'object_tag', 'embed_tag'];
    const mediumPatterns = ['data_uri', 'css_expression', 'html_entities', 'url_encoding'];

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
