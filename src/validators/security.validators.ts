/**
 * Security Validation Schemas
 * 
 * Comprehensive Joi validation schemas for security-related operations
 * including SQL injection prevention, XSS protection, CSRF validation,
 * and security event monitoring
 */

import Joi from 'joi';

/**
 * Common security patterns and constants
 */
const SECURITY_PATTERNS = {
  // SQL injection prevention patterns
  SQL_INJECTION: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)|(\b(OR|AND)\s+\d+\s*=\s*\d+)|(\b(OR|AND)\s+['"]\s*=\s*['"])|(;|\-\-|\/\*|\*\/)/i,
  
  // XSS prevention patterns
  XSS_SCRIPT: /<script[^>]*>.*?<\/script>/gi,
  XSS_EVENT_HANDLERS: /on\w+\s*=/gi,
  XSS_JAVASCRIPT: /javascript:/gi,
  XSS_DATA_URI: /data:text\/html/gi,
  
  // Dangerous HTML tags
  DANGEROUS_TAGS: /<(iframe|object|embed|form|input|textarea|select|button|link|meta|style|script)[^>]*>/gi,
  
  // Path traversal patterns
  PATH_TRAVERSAL: /\.\.\/|\.\.\\|\.\.%2f|\.\.%5c/gi,
  
  // Command injection patterns
  COMMAND_INJECTION: /[;&|`$(){}[\]]/g,
  
  // NoSQL injection patterns
  NOSQL_INJECTION: /\$where|\$ne|\$gt|\$lt|\$regex|\$exists|\$in|\$nin/gi,
  
  // LDAP injection patterns
  LDAP_INJECTION: /[()=*!&|]/g,
  
  // XML/XXE injection patterns
  XXE_INJECTION: /<!DOCTYPE|<!ENTITY|SYSTEM|PUBLIC/gi
};

/**
 * Password strength validation
 */
export const passwordStrengthSchema = Joi.string()
  .min(8)
  .max(128)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/)
  .custom((value, helpers) => {
    // Check for common weak passwords
    const weakPasswords = [
      'password', '123456', '123456789', 'qwerty', 'abc123',
      'password123', 'admin', 'letmein', 'welcome', 'monkey',
      'dragon', 'master', 'hello', 'login', 'princess',
      'rockyou', '1234567890', 'dragon', 'password1'
    ];
    
    if (weakPasswords.includes(value.toLowerCase())) {
      return helpers.error('password.weak');
    }
    
    // Check for repeated characters
    if (/(.)\1{2,}/.test(value)) {
      return helpers.error('password.repeated');
    }
    
    // Check for sequential characters
    if (/(abc|bcd|cde|def|efg|fgh|ghi|hij|ijk|jkl|klm|lmn|mno|nop|opq|pqr|qrs|rst|stu|tuv|uvw|vwx|wxy|xyz|123|234|345|456|567|678|789|890)/i.test(value)) {
      return helpers.error('password.sequential');
    }
    
    return value;
  })
  .messages({
    'string.min': '비밀번호는 최소 8자 이상이어야 합니다.',
    'string.max': '비밀번호는 최대 128자까지 가능합니다.',
    'string.pattern.base': '비밀번호는 대문자, 소문자, 숫자, 특수문자를 포함해야 합니다.',
    'password.weak': '너무 일반적인 비밀번호입니다. 더 강력한 비밀번호를 사용해주세요.',
    'password.repeated': '반복되는 문자는 사용할 수 없습니다.',
    'password.sequential': '순차적인 문자는 사용할 수 없습니다.'
  });

/**
 * SQL injection prevention validation
 */
export const sqlInjectionSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.SQL_INJECTION.test(value)) {
      return helpers.error('string.sql_injection');
    }
    return value;
  })
  .messages({
    'string.sql_injection': '잘못된 입력 형식입니다. SQL 인젝션 패턴이 감지되었습니다.'
  });

/**
 * XSS prevention validation
 */
export const xssSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.XSS_SCRIPT.test(value) ||
        SECURITY_PATTERNS.XSS_EVENT_HANDLERS.test(value) ||
        SECURITY_PATTERNS.XSS_JAVASCRIPT.test(value) ||
        SECURITY_PATTERNS.XSS_DATA_URI.test(value) ||
        SECURITY_PATTERNS.DANGEROUS_TAGS.test(value)) {
      return helpers.error('string.xss_detected');
    }
    return value;
  })
  .messages({
    'string.xss_detected': '잘못된 입력 형식입니다. XSS 공격 패턴이 감지되었습니다.'
  });

/**
 * Path traversal prevention validation
 */
export const pathTraversalSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.PATH_TRAVERSAL.test(value)) {
      return helpers.error('string.path_traversal');
    }
    return value;
  })
  .messages({
    'string.path_traversal': '잘못된 경로 형식입니다. 경로 탐색 공격 패턴이 감지되었습니다.'
  });

/**
 * Command injection prevention validation
 */
export const commandInjectionSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.COMMAND_INJECTION.test(value)) {
      return helpers.error('string.command_injection');
    }
    return value;
  })
  .messages({
    'string.command_injection': '잘못된 입력 형식입니다. 명령어 인젝션 패턴이 감지되었습니다.'
  });

/**
 * NoSQL injection prevention validation
 */
export const noSqlInjectionSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.NOSQL_INJECTION.test(value)) {
      return helpers.error('string.nosql_injection');
    }
    return value;
  })
  .messages({
    'string.nosql_injection': '잘못된 입력 형식입니다. NoSQL 인젝션 패턴이 감지되었습니다.'
  });

/**
 * LDAP injection prevention validation
 */
export const ldapInjectionSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.LDAP_INJECTION.test(value)) {
      return helpers.error('string.ldap_injection');
    }
    return value;
  })
  .messages({
    'string.ldap_injection': '잘못된 입력 형식입니다. LDAP 인젝션 패턴이 감지되었습니다.'
  });

/**
 * XXE injection prevention validation
 */
export const xxeInjectionSafeSchema = Joi.string()
  .custom((value, helpers) => {
    if (SECURITY_PATTERNS.XXE_INJECTION.test(value)) {
      return helpers.error('string.xxe_injection');
    }
    return value;
  })
  .messages({
    'string.xxe_injection': '잘못된 입력 형식입니다. XXE 인젝션 패턴이 감지되었습니다.'
  });

/**
 * Comprehensive security validation schema
 */
export const securitySafeStringSchema = Joi.string()
  .custom((value, helpers) => {
    // Check for all security patterns
    const securityChecks = [
      { pattern: SECURITY_PATTERNS.SQL_INJECTION, error: 'sql_injection' },
      { pattern: SECURITY_PATTERNS.XSS_SCRIPT, error: 'xss_script' },
      { pattern: SECURITY_PATTERNS.XSS_EVENT_HANDLERS, error: 'xss_event_handlers' },
      { pattern: SECURITY_PATTERNS.XSS_JAVASCRIPT, error: 'xss_javascript' },
      { pattern: SECURITY_PATTERNS.XSS_DATA_URI, error: 'xss_data_uri' },
      { pattern: SECURITY_PATTERNS.DANGEROUS_TAGS, error: 'dangerous_tags' },
      { pattern: SECURITY_PATTERNS.PATH_TRAVERSAL, error: 'path_traversal' },
      { pattern: SECURITY_PATTERNS.COMMAND_INJECTION, error: 'command_injection' },
      { pattern: SECURITY_PATTERNS.NOSQL_INJECTION, error: 'nosql_injection' },
      { pattern: SECURITY_PATTERNS.LDAP_INJECTION, error: 'ldap_injection' },
      { pattern: SECURITY_PATTERNS.XXE_INJECTION, error: 'xxe_injection' }
    ];
    
    for (const check of securityChecks) {
      if (check.pattern.test(value)) {
        return helpers.error(`string.${check.error}`);
      }
    }
    
    return value;
  })
  .messages({
    'string.sql_injection': 'SQL 인젝션 공격 패턴이 감지되었습니다.',
    'string.xss_script': 'XSS 스크립트 태그가 감지되었습니다.',
    'string.xss_event_handlers': 'XSS 이벤트 핸들러가 감지되었습니다.',
    'string.xss_javascript': 'JavaScript 프로토콜이 감지되었습니다.',
    'string.xss_data_uri': '위험한 데이터 URI가 감지되었습니다.',
    'string.dangerous_tags': '위험한 HTML 태그가 감지되었습니다.',
    'string.path_traversal': '경로 탐색 공격 패턴이 감지되었습니다.',
    'string.command_injection': '명령어 인젝션 패턴이 감지되었습니다.',
    'string.nosql_injection': 'NoSQL 인젝션 패턴이 감지되었습니다.',
    'string.ldap_injection': 'LDAP 인젝션 패턴이 감지되었습니다.',
    'string.xxe_injection': 'XXE 인젝션 패턴이 감지되었습니다.'
  });

/**
 * Login attempt validation schema with security enhancements
 */
export const secureLoginSchema = Joi.object({
  email: Joi.string()
    .email()
    .max(255)
    .custom((value, helpers) => {
      // Additional email security checks
      if (value.includes('..') || value.startsWith('.') || value.endsWith('.')) {
        return helpers.error('email.invalid_format');
      }
      return value;
    })
    .messages({
      'string.email': '올바른 이메일 형식이 아닙니다.',
      'string.max': '이메일은 최대 255자까지 가능합니다.',
      'email.invalid_format': '잘못된 이메일 형식입니다.'
    }),

  password: passwordStrengthSchema,

  deviceInfo: Joi.object({
    deviceId: Joi.string().max(255).optional(),
    platform: Joi.string().valid('ios', 'android', 'web').optional(),
    userAgent: Joi.string().max(1000).optional(),
    ipAddress: Joi.string().ip().optional()
  }).optional(),

  captchaToken: Joi.string().optional(),
  rememberMe: Joi.boolean().default(false)
});

/**
 * Registration validation schema with security enhancements
 */
export const secureRegistrationSchema = Joi.object({
  name: Joi.string()
    .trim()
    .min(2)
    .max(50)
    .pattern(/^[가-힣a-zA-Z\s]+$/)
    .custom((value, helpers) => {
      // Check for suspicious patterns in names
      if (value.toLowerCase().includes('admin') || 
          value.toLowerCase().includes('test') ||
          value.toLowerCase().includes('user')) {
        return helpers.error('name.suspicious');
      }
      return value;
    })
    .messages({
      'string.min': '이름은 최소 2자 이상이어야 합니다.',
      'string.max': '이름은 최대 50자까지 가능합니다.',
      'string.pattern.base': '이름은 한글, 영문자, 공백만 가능합니다.',
      'name.suspicious': '의심스러운 이름 패턴이 감지되었습니다.'
    }),

  email: Joi.string()
    .email()
    .max(255)
    .custom((value, helpers) => {
      // Check for disposable email domains
      const disposableDomains = [
        '10minutemail.com', 'tempmail.org', 'guerrillamail.com',
        'mailinator.com', 'temp-mail.org', 'throwaway.email'
      ];
      const domain = value.split('@')[1]?.toLowerCase();
      if (disposableDomains.includes(domain)) {
        return helpers.error('email.disposable');
      }
      return value;
    })
    .messages({
      'string.email': '올바른 이메일 형식이 아닙니다.',
      'string.max': '이메일은 최대 255자까지 가능합니다.',
      'email.disposable': '일회용 이메일은 사용할 수 없습니다.'
    }),

  password: passwordStrengthSchema,

  phoneNumber: Joi.string()
    .pattern(/^010[-.]?[0-9]{4}[-.]?[0-9]{4}$/)
    .required()
    .messages({
      'string.pattern.base': '올바른 휴대폰 번호 형식이 아닙니다. (010-XXXX-XXXX)',
      'any.required': '휴대폰 번호는 필수입니다.'
    }),

  birthDate: Joi.date()
    .max('now')
    .min(new Date(new Date().getFullYear() - 100, 0, 1))
    .required()
    .custom((value, helpers) => {
      const today = new Date();
      const birthDate = new Date(value);
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      
      if (age < 14) {
        return helpers.error('date.min_age');
      }
      
      return value;
    })
    .messages({
      'date.base': '올바른 생년월일 형식이 아닙니다.',
      'date.max': '생년월일은 오늘 이전이어야 합니다.',
      'date.min': '생년월일이 너무 오래되었습니다.',
      'date.min_age': '14세 이상만 가입할 수 있습니다.',
      'any.required': '생년월일은 필수입니다.'
    }),

  termsAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': '이용약관 동의는 필수입니다.',
      'any.required': '이용약관 동의는 필수입니다.'
    }),

  privacyAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      'any.only': '개인정보처리방침 동의는 필수입니다.',
      'any.required': '개인정보처리방침 동의는 필수입니다.'
    }),

  captchaToken: Joi.string().optional(),
  deviceInfo: Joi.object({
    deviceId: Joi.string().max(255).optional(),
    platform: Joi.string().valid('ios', 'android', 'web').optional(),
    userAgent: Joi.string().max(1000).optional(),
    ipAddress: Joi.string().ip().optional()
  }).optional()
});

/**
 * CSRF token validation schema
 */
export const csrfTokenSchema = Joi.object({
  csrfToken: Joi.string()
    .alphanum()
    .length(32)
    .required()
    .messages({
      'string.alphanum': 'CSRF 토큰은 영문자와 숫자만 가능합니다.',
      'string.length': 'CSRF 토큰은 32자여야 합니다.',
      'any.required': 'CSRF 토큰은 필수입니다.'
    })
});

/**
 * Security event validation schema
 */
export const securityEventSchema = Joi.object({
  eventType: Joi.string()
    .valid(
      'login_attempt', 'login_success', 'login_failure',
      'registration_attempt', 'registration_success', 'registration_failure',
      'password_change', 'password_reset', 'account_locked',
      'suspicious_activity', 'rate_limit_exceeded', 'validation_failed',
      'sql_injection_attempt', 'xss_attempt', 'csrf_attempt',
      'file_upload_attempt', 'admin_action', 'data_access'
    )
    .required()
    .messages({
      'any.only': '유효하지 않은 보안 이벤트 타입입니다.',
      'any.required': '보안 이벤트 타입은 필수입니다.'
    }),

  severity: Joi.string()
    .valid('low', 'medium', 'high', 'critical')
    .required()
    .messages({
      'any.only': '심각도는 low, medium, high, critical 중 하나여야 합니다.',
      'any.required': '심각도는 필수입니다.'
    }),

  userId: Joi.string().uuid().optional(),
  ipAddress: Joi.string().ip().required(),
  userAgent: Joi.string().max(1000).required(),
  endpoint: Joi.string().max(500).required(),
  method: Joi.string().valid('GET', 'POST', 'PUT', 'DELETE', 'PATCH').required(),
  
  details: Joi.object({
    reason: Joi.string().max(1000).optional(),
    additionalData: Joi.object().optional(),
    threatLevel: Joi.number().min(0).max(10).optional()
  }).optional(),

  timestamp: Joi.date().default(() => new Date())
});

/**
 * File upload security validation schema
 */
export const secureFileUploadSchema = Joi.object({
  file: Joi.object({
    fieldname: Joi.string().required(),
    originalname: Joi.string()
      .max(255)
      .custom((value, helpers) => {
        // Check for dangerous file extensions
        const dangerousExtensions = ['.exe', '.bat', '.cmd', '.com', '.pif', '.scr', '.vbs', '.js', '.jar', '.php', '.asp', '.jsp'];
        const extension = value.toLowerCase().substring(value.lastIndexOf('.'));
        if (dangerousExtensions.includes(extension)) {
          return helpers.error('file.dangerous_extension');
        }
        return value;
      })
      .messages({
        'string.max': '파일명은 최대 255자까지 가능합니다.',
        'file.dangerous_extension': '위험한 파일 확장자입니다.'
      }),

    mimetype: Joi.string()
      .valid(
        'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      )
      .required()
      .messages({
        'any.only': '허용되지 않는 파일 형식입니다.',
        'any.required': '파일 형식은 필수입니다.'
      }),

    size: Joi.number()
      .max(10 * 1024 * 1024) // 10MB
      .required()
      .messages({
        'number.max': '파일 크기는 10MB 이하여야 합니다.',
        'any.required': '파일 크기는 필수입니다.'
      }),

    buffer: Joi.binary().required()
  }).required()
});

/**
 * Security headers validation schema
 */
export const securityHeadersSchema = Joi.object({
  'content-security-policy': Joi.string().optional(),
  'x-frame-options': Joi.string().valid('DENY', 'SAMEORIGIN').optional(),
  'x-content-type-options': Joi.string().valid('nosniff').optional(),
  'x-xss-protection': Joi.string().valid('1', '0').optional(),
  'strict-transport-security': Joi.string().optional(),
  'referrer-policy': Joi.string().optional()
});

/**
 * Input sanitization validation schema
 */
export const sanitizedInputSchema = Joi.string()
  .custom((value, helpers) => {
    // Remove or escape dangerous characters
    let sanitized = value
      .replace(/[<>]/g, '') // Remove < and >
      .replace(/['"]/g, '') // Remove quotes
      .replace(/[;]/g, '') // Remove semicolons
      .replace(/[&]/g, '&amp;') // Escape ampersands
      .trim();
    
    // Check if sanitization changed the value significantly
    if (sanitized.length < value.length * 0.8) {
      return helpers.error('string.heavily_sanitized');
    }
    
    return sanitized;
  })
  .messages({
    'string.heavily_sanitized': '입력값에 위험한 문자가 많이 포함되어 있습니다.'
  });

/**
 * Rate limiting validation schema
 */
export const rateLimitValidationSchema = Joi.object({
  endpoint: Joi.string().max(500).required(),
  maxRequests: Joi.number().integer().min(1).max(10000).required(),
  windowMs: Joi.number().integer().min(1000).max(3600000).required(), // 1 second to 1 hour
  blockDuration: Joi.number().integer().min(1000).max(86400000).optional(), // 1 second to 24 hours
  keyGenerator: Joi.string().max(100).optional()
});

/**
 * Security configuration validation schema
 */
export const securityConfigSchema = Joi.object({
  enableCSP: Joi.boolean().default(true),
  enableHSTS: Joi.boolean().default(true),
  enableXSSProtection: Joi.boolean().default(true),
  enableCSRFProtection: Joi.boolean().default(true),
  enableRateLimiting: Joi.boolean().default(true),
  enableInputSanitization: Joi.boolean().default(true),
  enableSQLInjectionProtection: Joi.boolean().default(true),
  enablePathTraversalProtection: Joi.boolean().default(true),
  enableCommandInjectionProtection: Joi.boolean().default(true),
  enableNoSQLInjectionProtection: Joi.boolean().default(true),
  enableLDAPInjectionProtection: Joi.boolean().default(true),
  enableXXEInjectionProtection: Joi.boolean().default(true),
  
  passwordPolicy: Joi.object({
    minLength: Joi.number().integer().min(8).max(128).default(8),
    requireUppercase: Joi.boolean().default(true),
    requireLowercase: Joi.boolean().default(true),
    requireNumbers: Joi.boolean().default(true),
    requireSpecialChars: Joi.boolean().default(true),
    maxAge: Joi.number().integer().min(30).max(365).default(90) // days
  }).default(),
  
  sessionPolicy: Joi.object({
    maxAge: Joi.number().integer().min(300).max(86400).default(3600), // seconds
    secure: Joi.boolean().default(true),
    httpOnly: Joi.boolean().default(true),
    sameSite: Joi.string().valid('strict', 'lax', 'none').default('strict')
  }).default()
});

export { SECURITY_PATTERNS };

export default {
  passwordStrengthSchema,
  sqlInjectionSafeSchema,
  xssSafeSchema,
  pathTraversalSafeSchema,
  commandInjectionSafeSchema,
  noSqlInjectionSafeSchema,
  ldapInjectionSafeSchema,
  xxeInjectionSafeSchema,
  securitySafeStringSchema,
  secureLoginSchema,
  secureRegistrationSchema,
  csrfTokenSchema,
  securityEventSchema,
  secureFileUploadSchema,
  securityHeadersSchema,
  sanitizedInputSchema,
  rateLimitValidationSchema,
  securityConfigSchema
};
