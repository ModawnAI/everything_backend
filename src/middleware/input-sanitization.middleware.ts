/**
 * Input Sanitization Middleware
 * 
 * Comprehensive input sanitization for preventing XSS attacks, SQL injection,
 * and other malicious inputs across all user profile endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

/**
 * Create DOMPurify instance for server-side sanitization
 */
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

/**
 * Sanitization options for different input types
 */
interface SanitizationOptions {
  allowHtml: boolean;
  maxLength?: number;
  preserveWhitespace: boolean;
  allowedTags?: string[];
  allowedAttributes?: string[];
}

/**
 * Default sanitization configurations for different field types
 */
const SANITIZATION_CONFIGS = {
  // Text fields with Korean character support
  text: {
    allowHtml: false,
    preserveWhitespace: false,
    maxLength: 1000
  },
  
  // Name fields (Korean + English only)
  name: {
    allowHtml: false,
    preserveWhitespace: false,
    maxLength: 100,
    allowedChars: /^[가-힣a-zA-Z\s]+$/
  },
  
  // Nickname fields (Korean + English + numbers + safe symbols)
  nickname: {
    allowHtml: false,
    preserveWhitespace: false,
    maxLength: 50,
    allowedChars: /^[가-힣a-zA-Z0-9_-]+$/
  },
  
  // Description fields (limited HTML allowed)
  description: {
    allowHtml: true,
    preserveWhitespace: true,
    maxLength: 2000,
    allowedTags: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li'],
    allowedAttributes: ['class']
  },
  
  // URL fields
  url: {
    allowHtml: false,
    preserveWhitespace: false,
    maxLength: 2048,
    allowedChars: /^[a-zA-Z0-9:/?#[\]@!$&'()*+,;=._~%-]+$/
  }
};

/**
 * Sanitize a single value based on its type and configuration
 */
function sanitizeValue(
  value: any, 
  config: SanitizationOptions, 
  fieldName: string
): any {
  if (value === null || value === undefined) {
    return value;
  }

  // Convert to string for processing
  let stringValue = String(value);

  // Apply length limit
  if (config.maxLength && stringValue.length > config.maxLength) {
    stringValue = stringValue.substring(0, config.maxLength);
    logger.warn('Input truncated due to length limit', {
      fieldName,
      originalLength: String(value).length,
      maxLength: config.maxLength
    });
  }

  // Trim whitespace unless preserving it
  if (!config.preserveWhitespace) {
    stringValue = stringValue.trim();
  }

  // Handle HTML content
  if (config.allowHtml) {
    // Use DOMPurify for HTML sanitization
    const cleanHtml = purify.sanitize(stringValue, {
      ALLOWED_TAGS: config.allowedTags || [],
      ALLOWED_ATTR: config.allowedAttributes || [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });
    stringValue = cleanHtml;
  } else {
    // Remove all HTML tags and dangerous content
    stringValue = purify.sanitize(stringValue, {
      ALLOWED_TAGS: [],
      ALLOWED_ATTR: [],
      KEEP_CONTENT: true,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
    });

    // Additional XSS protection for plain text
    stringValue = stringValue
      .replace(/javascript:/gi, '')
      .replace(/vbscript:/gi, '')
      .replace(/data:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
      .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '')
      .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, '')
      .replace(/<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi, '');
  }

  // Normalize whitespace
  if (!config.preserveWhitespace) {
    stringValue = stringValue.replace(/\s+/g, ' ');
  }

  return stringValue;
}

/**
 * Sanitize an object recursively
 */
function sanitizeObject(obj: any, fieldConfigs: Record<string, SanitizationOptions>): any {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeObject(item, fieldConfigs));
  }

  const sanitized: any = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const config = fieldConfigs[key] || SANITIZATION_CONFIGS.text;
    sanitized[key] = sanitizeObject(value, fieldConfigs);
    
    if (typeof value === 'string') {
      sanitized[key] = sanitizeValue(value, config, key);
    }
  }

  return sanitized;
}

/**
 * Comprehensive sanitization middleware for user profile data
 */
export function sanitizeProfileInput() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Define sanitization configurations for profile fields
      const profileFieldConfigs: Record<string, SanitizationOptions> = {
        name: SANITIZATION_CONFIGS.name,
        nickname: SANITIZATION_CONFIGS.nickname,
        bio: SANITIZATION_CONFIGS.description,
        profile_image_url: SANITIZATION_CONFIGS.url,
        reason: SANITIZATION_CONFIGS.text,
        marketing_consent: {
          allowHtml: false,
          preserveWhitespace: false
        },
        privacy_settings: {
          allowHtml: false,
          preserveWhitespace: false
        }
      };

      // Sanitize the request body
      const originalBody = JSON.parse(JSON.stringify(req.body));
      req.body = sanitizeObject(req.body, profileFieldConfigs);

      // Log sanitization if changes were made
      const hasChanges = JSON.stringify(originalBody) !== JSON.stringify(req.body);
      if (hasChanges) {
        logger.info('Input sanitization applied', {
          endpoint: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          changesDetected: true
        });
      }

      next();
    } catch (error) {
      logger.error('Error in input sanitization middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path,
        method: req.method,
        userId: (req as any).user?.id
      });
      
      res.status(400).json({
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Input sanitization failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Sanitization middleware for privacy settings
 */
export function sanitizePrivacySettingsInput() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Define sanitization configurations for privacy settings
      const privacyFieldConfigs: Record<string, SanitizationOptions> = {
        profile_visibility: {
          allowHtml: false,
          preserveWhitespace: false
        },
        email_visibility: {
          allowHtml: false,
          preserveWhitespace: false
        },
        phone_visibility: {
          allowHtml: false,
          preserveWhitespace: false
        },
        marketing_consent: {
          allowHtml: false,
          preserveWhitespace: false
        },
        data_sharing_consent: {
          allowHtml: false,
          preserveWhitespace: false
        }
      };

      // Sanitize the request body
      const originalBody = JSON.parse(JSON.stringify(req.body));
      req.body = sanitizeObject(req.body, privacyFieldConfigs);

      // Log sanitization if changes were made
      const hasChanges = JSON.stringify(originalBody) !== JSON.stringify(req.body);
      if (hasChanges) {
        logger.info('Privacy settings sanitization applied', {
          endpoint: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          changesDetected: true
        });
      }

      next();
    } catch (error) {
      logger.error('Error in privacy settings sanitization middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path,
        method: req.method,
        userId: (req as any).user?.id
      });
      
      res.status(400).json({
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Privacy settings sanitization failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Enhanced sanitization for account deletion reason
 */
export function sanitizeAccountDeletionInput() {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Special configuration for account deletion
      const deletionFieldConfigs: Record<string, SanitizationOptions> = {
        reason: {
          allowHtml: false,
          preserveWhitespace: false,
          maxLength: 500
        },
        password: {
          allowHtml: false,
          preserveWhitespace: false
        }
      };

      // Sanitize the request body
      const originalBody = JSON.parse(JSON.stringify(req.body));
      req.body = sanitizeObject(req.body, deletionFieldConfigs);

      // Additional validation for account deletion reason
      if (req.body.reason) {
        // Remove any potential sensitive information patterns
        req.body.reason = req.body.reason
          .replace(/\b\d{3}-\d{3}-\d{4}\b/g, '[PHONE]') // Phone numbers
          .replace(/\b\d{6}-\d{7}\b/g, '[PHONE]') // Korean phone format
          .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]') // Email addresses
          .replace(/\b\d{4}-\d{2}-\d{2}\b/g, '[DATE]') // Dates
          .replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATE]'); // Date formats
      }

      // Log sanitization if changes were made
      const hasChanges = JSON.stringify(originalBody) !== JSON.stringify(req.body);
      if (hasChanges) {
        logger.info('Account deletion input sanitization applied', {
          endpoint: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          changesDetected: true
        });
      }

      next();
    } catch (error) {
      logger.error('Error in account deletion sanitization middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path,
        method: req.method,
        userId: (req as any).user?.id
      });
      
      res.status(400).json({
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Account deletion input sanitization failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Generic sanitization middleware for any endpoint
 */
export function sanitizeInput(fieldConfigs: Record<string, SanitizationOptions>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      if (!req.body || typeof req.body !== 'object') {
        return next();
      }

      // Sanitize the request body
      const originalBody = JSON.parse(JSON.stringify(req.body));
      req.body = sanitizeObject(req.body, fieldConfigs);

      // Log sanitization if changes were made
      const hasChanges = JSON.stringify(originalBody) !== JSON.stringify(req.body);
      if (hasChanges) {
        logger.info('Generic input sanitization applied', {
          endpoint: req.path,
          method: req.method,
          userId: (req as any).user?.id,
          changesDetected: true
        });
      }

      next();
    } catch (error) {
      logger.error('Error in generic input sanitization middleware', {
        error: error instanceof Error ? error.message : 'Unknown error',
        endpoint: req.path,
        method: req.method,
        userId: (req as any).user?.id
      });
      
      res.status(400).json({
        error: {
          code: 'SANITIZATION_ERROR',
          message: 'Input sanitization failed',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Validate and sanitize Korean text input
 */
export function validateKoreanText(text: string, fieldName: string, maxLength: number = 100): string {
  if (!text) return text;

  // Remove dangerous characters while preserving Korean characters
  let sanitized = text
    .replace(/[<>\"']/g, '') // Remove HTML/script characters
    .replace(/javascript:/gi, '')
    .replace(/on\w+\s*=/gi, '')
    .trim();

  // Validate Korean character patterns for name fields
  if (fieldName === 'name' && !/^[가-힣a-zA-Z\s]+$/.test(sanitized)) {
    throw new Error('이름은 한글, 영문, 공백만 입력 가능합니다.');
  }

  // Validate Korean character patterns for nickname fields
  if (fieldName === 'nickname' && !/^[가-힣a-zA-Z0-9_-]+$/.test(sanitized)) {
    throw new Error('닉네임은 한글, 영문, 숫자, _, - 만 입력 가능합니다.');
  }

  // Check length
  if (sanitized.length > maxLength) {
    throw new Error(`${fieldName}은(는) ${maxLength}자 이하여야 합니다.`);
  }

  return sanitized;
}

export default {
  sanitizeProfileInput,
  sanitizePrivacySettingsInput,
  sanitizeAccountDeletionInput,
  sanitizeInput,
  validateKoreanText,
  SANITIZATION_CONFIGS
};
