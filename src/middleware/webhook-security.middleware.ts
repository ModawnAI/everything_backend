/**
 * Webhook Security Middleware
 * 
 * Express middleware for comprehensive webhook security validation including:
 * - Request validation and sanitization
 * - Security header checks
 * - Rate limiting integration
 * - Request body preservation for signature verification
 */

import { Request, Response, NextFunction } from 'express';
import { webhookSecurityService, WebhookSecurityConfig } from '../services/webhook-security.service';
import { logger } from '../utils/logger';

export interface WebhookSecurityOptions {
  provider: 'portone' | 'generic';
  secretKey?: string;
  allowedIPs?: string[];
  timestampTolerance?: number;
  rateLimitWindow?: number;
  rateLimitMaxRequests?: number;
  enableReplayProtection?: boolean;
  enableIPWhitelist?: boolean;
  requireHTTPS?: boolean;
  maxPayloadSize?: number;
}

export interface SecureWebhookRequest extends Request {
  webhookId?: string;
  securityValidated?: boolean;
  securityEvents?: any[];
}

/**
 * Create webhook security middleware with configuration
 */
export function createWebhookSecurityMiddleware(options: WebhookSecurityOptions) {
  return async (req: SecureWebhookRequest, res: Response, next: NextFunction): Promise<void> => {
    const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    req.webhookId = webhookId;

    const startTime = Date.now();
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';

    try {
      logger.info('Webhook security validation started', {
        webhookId,
        provider: options.provider,
        ipAddress,
        userAgent,
        path: req.path,
        method: req.method
      });

      // 1. Basic request validation
      const basicValidation = validateBasicRequest(req, options);
      if (!basicValidation.isValid) {
        logger.warn('Basic webhook validation failed', {
          webhookId,
          reason: basicValidation.reason,
          ipAddress
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: 'WEBHOOK_VALIDATION_FAILED',
            message: basicValidation.reason || '웹훅 요청이 유효하지 않습니다.',
            webhookId
          }
        });
        return;
      }

      // 2. HTTPS requirement check
      if (options.requireHTTPS && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
        logger.warn('Webhook received over insecure connection', {
          webhookId,
          ipAddress,
          protocol: req.protocol
        });
        
        res.status(400).json({
          success: false,
          error: {
            code: 'HTTPS_REQUIRED',
            message: 'HTTPS 연결이 필요합니다.',
            webhookId
          }
        });
        return;
      }

      // 3. Payload size check
      if (options.maxPayloadSize && req.get('Content-Length')) {
        const contentLength = parseInt(req.get('Content-Length') || '0', 10);
        if (contentLength > options.maxPayloadSize) {
          logger.warn('Webhook payload too large', {
            webhookId,
            contentLength,
            maxAllowed: options.maxPayloadSize,
            ipAddress
          });
          
          res.status(413).json({
            success: false,
            error: {
              code: 'PAYLOAD_TOO_LARGE',
              message: '요청 크기가 너무 큽니다.',
              webhookId
            }
          });
          return;
        }
      }

      // 4. Comprehensive security validation
      const config: WebhookSecurityConfig = {
        secretKey: options.secretKey || process.env.TOSS_PAYMENTS_WEBHOOK_SECRET || '',
        allowedIPs: options.allowedIPs || process.env.TOSS_PAYMENTS_ALLOWED_IPS?.split(','),
        timestampTolerance: options.timestampTolerance || 300,
        rateLimitWindow: options.rateLimitWindow || 60,
        rateLimitMaxRequests: options.rateLimitMaxRequests || 100,
        enableReplayProtection: options.enableReplayProtection !== false,
        enableIPWhitelist: options.enableIPWhitelist !== false
      };

      const validationResult = await webhookSecurityService.validateWebhook(req, req.body, config);

      // 5. Log security validation result
      await webhookSecurityService.logWebhookEvent(
        webhookId,
        req,
        req.body,
        validationResult,
        false // Not processed yet
      );

      if (!validationResult.isValid) {
        const duration = Date.now() - startTime;
        
        logger.warn('Webhook security validation failed', {
          webhookId,
          reason: validationResult.reason,
          securityEvents: validationResult.securityEvents,
          ipAddress,
          userAgent,
          duration
        });

        // Determine appropriate HTTP status code based on failure reason
        let statusCode = 403;
        let errorCode = 'WEBHOOK_SECURITY_FAILED';

        if (validationResult.reason?.includes('Rate limit')) {
          statusCode = 429;
          errorCode = 'RATE_LIMIT_EXCEEDED';
        } else if (validationResult.reason?.includes('IP')) {
          statusCode = 403;
          errorCode = 'IP_NOT_ALLOWED';
        } else if (validationResult.reason?.includes('signature')) {
          statusCode = 401;
          errorCode = 'INVALID_SIGNATURE';
        } else if (validationResult.reason?.includes('timestamp') || validationResult.reason?.includes('replay')) {
          statusCode = 400;
          errorCode = 'REPLAY_ATTACK_DETECTED';
        }

        res.status(statusCode).json({
          success: false,
          error: {
            code: errorCode,
            message: getLocalizedErrorMessage(validationResult.reason || 'Security validation failed'),
            webhookId
          }
        });
        return;
      }

      // 6. Security validation passed
      req.securityValidated = true;
      req.securityEvents = validationResult.securityEvents;

      const duration = Date.now() - startTime;
      logger.info('Webhook security validation passed', {
        webhookId,
        ipAddress,
        userAgent,
        duration,
        securityEventsCount: validationResult.securityEvents?.length || 0
      });

      next();

    } catch (error) {
      const duration = Date.now() - startTime;
      
      logger.error('Error in webhook security middleware', {
        webhookId,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ipAddress,
        userAgent,
        duration
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'WEBHOOK_SECURITY_ERROR',
          message: '웹훅 보안 검증 중 오류가 발생했습니다.',
          webhookId
        }
      });
    }
  };
}

/**
 * Validate basic request structure and headers
 */
function validateBasicRequest(req: Request, options: WebhookSecurityOptions): { isValid: boolean; reason?: string } {
  // Check HTTP method
  if (req.method !== 'POST') {
    return { isValid: false, reason: 'Only POST method allowed for webhooks' };
  }

  // Check Content-Type
  const contentType = req.get('Content-Type');
  if (!contentType || !contentType.includes('application/json')) {
    return { isValid: false, reason: 'Content-Type must be application/json' };
  }

  // Check for required headers based on provider
  if (options.provider === 'portone') {
    // PortOne specific header validation
    const userAgent = req.get('User-Agent');
    if (!userAgent || !userAgent.toLowerCase().includes('portone')) {
      logger.warn('Suspicious User-Agent for PortOne webhook', {
        userAgent,
        ipAddress: req.ip
      });
      // Don't fail on User-Agent alone, but log it
    }
  }

  // Check for request body
  if (!req.body || typeof req.body !== 'object') {
    return { isValid: false, reason: 'Request body is required and must be valid JSON' };
  }

  // Provider-specific payload validation for PortOne V2
  if (options.provider === 'portone') {
    // PortOne V2 webhook format validation
    if (req.body.type && req.body.data) {
      // New V2 webhook format with type and data fields
      const requiredDataFields = ['paymentId'];
      if (req.body.data) {
        for (const field of requiredDataFields) {
          if (!req.body.data[field]) {
            return { isValid: false, reason: `Missing required data field: ${field}` };
          }
        }
      }
    } else {
      // Legacy V1 format compatibility
      const requiredFields = ['imp_uid', 'merchant_uid', 'status'];
      for (const field of requiredFields) {
        if (!req.body[field]) {
          return { isValid: false, reason: `Missing required field: ${field}` };
        }
      }
    }
  }

  return { isValid: true };
}

/**
 * Get localized error message
 */
function getLocalizedErrorMessage(reason: string): string {
  const errorMessages: Record<string, string> = {
    'Invalid signature': '유효하지 않은 서명입니다.',
    'IP address not whitelisted': '허용되지 않은 IP 주소입니다.',
    'Rate limit exceeded': '요청 한도를 초과했습니다.',
    'Timestamp expired or invalid': '타임스탬프가 만료되었거나 유효하지 않습니다.',
    'Replay attack detected': '재전송 공격이 감지되었습니다.',
    'Security validation failed': '보안 검증에 실패했습니다.'
  };

  return errorMessages[reason] || '웹훅 보안 검증에 실패했습니다.';
}

/**
 * PortOne V2 webhook middleware (simplified for SDK verification)
 * The official SDK handles signature verification, so this just provides basic security
 */
export function portOneV2WebhookSecurity(req: Request, res: Response, next: NextFunction): void {
  const webhookId = `webhook_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();

  try {
    // Basic security checks
    if (req.method !== 'POST') {
      res.status(405).json({
        success: false,
        error: {
          code: 'METHOD_NOT_ALLOWED',
          message: 'Only POST method allowed',
          webhookId
        }
      });
      return;
    }

    const contentType = req.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_CONTENT_TYPE',
          message: 'Content-Type must be application/json',
          webhookId
        }
      });
      return;
    }

    // HTTPS requirement in production
    if (process.env.NODE_ENV === 'production' && !req.secure && req.get('X-Forwarded-Proto') !== 'https') {
      res.status(400).json({
        success: false,
        error: {
          code: 'HTTPS_REQUIRED',
          message: 'HTTPS required in production',
          webhookId
        }
      });
      return;
    }

    // Basic payload validation
    if (!req.body || typeof req.body !== 'object') {
      res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYLOAD',
          message: 'Invalid JSON payload',
          webhookId
        }
      });
      return;
    }

    const duration = Date.now() - startTime;
    logger.info('PortOne V2 webhook basic validation passed', {
      webhookId,
      duration,
      path: req.path,
      method: req.method
    });

    // Note: Signature verification is handled by the PortOne SDK in the service layer
    next();

  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('Error in PortOne V2 webhook middleware', {
      webhookId,
      error: error instanceof Error ? error.message : 'Unknown error',
      duration
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'WEBHOOK_MIDDLEWARE_ERROR',
        message: 'Internal server error',
        webhookId
      }
    });
  }
}

/**
 * PortOne webhook security middleware (legacy, pre-configured)
 */
export const portOneWebhookSecurity = createWebhookSecurityMiddleware({
  provider: 'portone',
  requireHTTPS: process.env.NODE_ENV === 'production',
  maxPayloadSize: 1024 * 1024, // 1MB
  enableReplayProtection: true,
  enableIPWhitelist: process.env.NODE_ENV === 'production',
  timestampTolerance: 300, // 5 minutes
  rateLimitWindow: 60, // 1 minute
  rateLimitMaxRequests: 100 // 100 requests per minute per IP
});

/**
 * Generic webhook security middleware
 */
export const genericWebhookSecurity = (secretKey: string, options?: Partial<WebhookSecurityOptions>) =>
  createWebhookSecurityMiddleware({
    provider: 'generic',
    secretKey,
    requireHTTPS: process.env.NODE_ENV === 'production',
    maxPayloadSize: 1024 * 1024, // 1MB
    enableReplayProtection: true,
    enableIPWhitelist: false, // Disabled by default for generic webhooks
    timestampTolerance: 300,
    rateLimitWindow: 60,
    rateLimitMaxRequests: 50,
    ...options
  });

