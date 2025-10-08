/**
 * Webhook Security Service
 * 
 * Comprehensive security implementation for webhook endpoints including:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation for replay attack prevention
 * - Rate limiting and IP whitelisting
 * - Idempotency checks
 * - Security event logging and monitoring
 */

import crypto from 'crypto';
import { Request } from 'express';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface WebhookSecurityConfig {
  secretKey: string;
  allowedIPs?: string[];
  timestampTolerance?: number; // seconds
  rateLimitWindow?: number; // seconds
  rateLimitMaxRequests?: number;
  enableReplayProtection?: boolean;
  enableIPWhitelist?: boolean;
}

export interface WebhookValidationResult {
  isValid: boolean;
  reason?: string;
  securityEvents?: SecurityEvent[];
}

export interface SecurityEvent {
  type: 'signature_invalid' | 'timestamp_expired' | 'replay_attack' | 'rate_limit_exceeded' | 'ip_blocked' | 'suspicious_activity';
  severity: 'low' | 'medium' | 'high' | 'critical';
  details: Record<string, any>;
  timestamp: string;
}

export interface WebhookLogEntry {
  webhook_id: string;
  payment_key?: string;
  order_id?: string;
  status?: string;
  ip_address: string;
  user_agent: string;
  signature_valid: boolean;
  timestamp_valid: boolean;
  idempotency_check: boolean;
  processed: boolean;
  security_events?: SecurityEvent[];
  payload_hash: string;
  received_at: string;
  processed_at?: string;
  processing_duration?: number;
  error_message?: string;
}

export class WebhookSecurityService {
  private supabase = getSupabaseClient();
  private rateLimitCache = new Map<string, { count: number; resetTime: number }>();

  /**
   * Comprehensive webhook validation
   */
  async validateWebhook(
    req: Request,
    payload: any,
    config: WebhookSecurityConfig
  ): Promise<WebhookValidationResult> {
    const securityEvents: SecurityEvent[] = [];
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || 'unknown';
    const timestamp = new Date().toISOString();

    try {
      // 1. IP Whitelist Check
      if (config.enableIPWhitelist && config.allowedIPs?.length) {
        const ipValid = this.validateIPAddress(ipAddress, config.allowedIPs);
        if (!ipValid) {
          securityEvents.push({
            type: 'ip_blocked',
            severity: 'high',
            details: { ipAddress, userAgent },
            timestamp
          });
          return { isValid: false, reason: 'IP address not whitelisted', securityEvents };
        }
      }

      // 2. Rate Limiting Check
      const rateLimitValid = await this.checkRateLimit(
        ipAddress,
        config.rateLimitWindow || 60,
        config.rateLimitMaxRequests || 100
      );
      if (!rateLimitValid) {
        securityEvents.push({
          type: 'rate_limit_exceeded',
          severity: 'medium',
          details: { ipAddress, userAgent },
          timestamp
        });
        return { isValid: false, reason: 'Rate limit exceeded', securityEvents };
      }

      // 3. Signature Verification
      const signatureValid = this.verifySignature(payload, config.secretKey);
      if (!signatureValid) {
        securityEvents.push({
          type: 'signature_invalid',
          severity: 'critical',
          details: { 
            ipAddress, 
            userAgent, 
            paymentKey: payload.paymentKey,
            orderId: payload.orderId 
          },
          timestamp
        });
        return { isValid: false, reason: 'Invalid signature', securityEvents };
      }

      // 4. Timestamp Validation (Replay Attack Prevention)
      if (config.enableReplayProtection) {
        const timestampValid = this.validateTimestamp(
          payload.requestedAt || payload.approvedAt,
          config.timestampTolerance || 300 // 5 minutes default
        );
        if (!timestampValid) {
          securityEvents.push({
            type: 'timestamp_expired',
            severity: 'high',
            details: { 
              ipAddress, 
              userAgent,
              paymentKey: payload.paymentKey,
              requestedAt: payload.requestedAt,
              approvedAt: payload.approvedAt
            },
            timestamp
          });
          return { isValid: false, reason: 'Timestamp expired or invalid', securityEvents };
        }
      }

      // 5. Replay Attack Detection
      if (config.enableReplayProtection) {
        const replayDetected = await this.detectReplayAttack(payload);
        if (replayDetected) {
          securityEvents.push({
            type: 'replay_attack',
            severity: 'critical',
            details: { 
              ipAddress, 
              userAgent,
              paymentKey: payload.paymentKey,
              orderId: payload.orderId
            },
            timestamp
          });
          return { isValid: false, reason: 'Replay attack detected', securityEvents };
        }
      }

      return { isValid: true, securityEvents };

    } catch (error) {
      logger.error('Error during webhook validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress,
        userAgent,
        paymentKey: payload?.paymentKey
      });

      securityEvents.push({
        type: 'suspicious_activity',
        severity: 'high',
        details: { 
          error: error instanceof Error ? error.message : 'Unknown error',
          ipAddress,
          userAgent
        },
        timestamp
      });

      return { isValid: false, reason: 'Validation error', securityEvents };
    }
  }

  /**
   * Enhanced HMAC-SHA256 signature verification
   */
  private verifySignature(payload: any, secretKey: string): boolean {
    try {
      if (!secretKey) {
        logger.warn('Webhook secret key not configured');
        return false; // Fail secure - require secret key
      }

      // Extract signature from payload
      const receivedSignature = payload.secret;
      if (!receivedSignature) {
        logger.warn('No signature found in webhook payload');
        return false;
      }

      // Create canonical payload for signature verification
      const canonicalPayload = this.createCanonicalPayload(payload);
      
      // Generate expected signature
      const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPayload)
        .digest('hex');

      // Secure comparison to prevent timing attacks
      const isValid = this.secureCompare(receivedSignature, expectedSignature);

      if (!isValid) {
        logger.warn('Webhook signature verification failed', {
          paymentKey: payload.paymentKey,
          orderId: payload.orderId,
          expectedLength: expectedSignature.length,
          receivedLength: receivedSignature.length
        });
      }

      return isValid;
    } catch (error) {
      logger.error('Error verifying webhook signature', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentKey: payload?.paymentKey
      });
      return false;
    }
  }

  /**
   * Create canonical payload string for consistent signature generation
   */
  private createCanonicalPayload(payload: any): string {
    // Define the fields that should be included in signature verification
    const signatureFields = [
      'paymentKey',
      'orderId',
      'status',
      'totalAmount',
      'suppliedAmount',
      'vat',
      'approvedAt',
      'useEscrow',
      'currency',
      'method',
      'type',
      'country',
      'isPartialCancelable',
      'totalCancelAmount',
      'balanceAmount',
      'taxFreeAmount',
      'requestedAt'
    ];

    // Extract and sort fields for consistent ordering
    const canonicalData: Record<string, any> = {};
    signatureFields.forEach(field => {
      if (payload[field] !== undefined && payload[field] !== null) {
        canonicalData[field] = payload[field];
      }
    });

    // Sort keys and create query string
    const sortedKeys = Object.keys(canonicalData).sort();
    const queryString = sortedKeys
      .map(key => `${key}=${canonicalData[key]}`)
      .join('&');

    return queryString;
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    let result = 0;
    for (let i = 0; i < a.length; i++) {
      result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }

    return result === 0;
  }

  /**
   * Validate timestamp to prevent replay attacks
   */
  private validateTimestamp(timestamp: string, toleranceSeconds: number): boolean {
    try {
      if (!timestamp) {
        return false;
      }

      const webhookTime = new Date(timestamp).getTime();
      const currentTime = Date.now();
      const timeDifference = Math.abs(currentTime - webhookTime) / 1000;

      return timeDifference <= toleranceSeconds;
    } catch (error) {
      logger.warn('Invalid timestamp format in webhook', { timestamp });
      return false;
    }
  }

  /**
   * Detect replay attacks by checking for duplicate webhook signatures
   */
  private async detectReplayAttack(payload: any): Promise<boolean> {
    try {
      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      // Check if we've seen this exact payload before
      const { data: existingWebhook } = await this.supabase
        .from('webhook_logs')
        .select('id')
        .eq('payload_hash', payloadHash)
        .eq('payment_key', payload.paymentKey)
        .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()) // Last 24 hours
        .single();

      return !!existingWebhook;
    } catch (error) {
      // If table doesn't exist or other error, assume not a replay
      return false;
    }
  }

  /**
   * Validate IP address against whitelist
   */
  private validateIPAddress(ipAddress: string, allowedIPs: string[]): boolean {
    return allowedIPs.some(allowedIP => {
      // Support CIDR notation and exact matches
      if (allowedIP.includes('/')) {
        // CIDR notation - simplified implementation
        // For production, use a proper CIDR library
        const [network, prefixLength] = allowedIP.split('/');
        return ipAddress.startsWith(network.split('.').slice(0, Math.floor(parseInt(prefixLength) / 8)).join('.'));
      } else {
        // Exact match
        return ipAddress === allowedIP.trim();
      }
    });
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(
    identifier: string,
    windowSeconds: number,
    maxRequests: number
  ): Promise<boolean> {
    const now = Date.now();
    const windowStart = now - (windowSeconds * 1000);

    // Clean up expired entries
    for (const [key, value] of this.rateLimitCache.entries()) {
      if (value.resetTime < now) {
        this.rateLimitCache.delete(key);
      }
    }

    // Check current rate limit
    const current = this.rateLimitCache.get(identifier);
    if (!current) {
      // First request in window
      this.rateLimitCache.set(identifier, {
        count: 1,
        resetTime: now + (windowSeconds * 1000)
      });
      return true;
    }

    if (current.count >= maxRequests) {
      return false;
    }

    // Increment counter
    current.count++;
    return true;
  }

  /**
   * Log webhook security event
   */
  async logWebhookEvent(
    webhookId: string,
    req: Request,
    payload: any,
    validationResult: WebhookValidationResult,
    processed: boolean = false,
    error?: Error
  ): Promise<void> {
    try {
      const payloadHash = crypto
        .createHash('sha256')
        .update(JSON.stringify(payload))
        .digest('hex');

      const logEntry: Partial<WebhookLogEntry> = {
        webhook_id: webhookId,
        payment_key: payload.paymentKey,
        order_id: payload.orderId,
        status: payload.status,
        ip_address: req.ip || req.connection.remoteAddress || 'unknown',
        user_agent: req.get('User-Agent') || 'unknown',
        signature_valid: validationResult.isValid,
        timestamp_valid: !validationResult.securityEvents?.some(e => e.type === 'timestamp_expired'),
        idempotency_check: true, // Will be updated by idempotency check
        processed,
        security_events: validationResult.securityEvents,
        payload_hash: payloadHash,
        received_at: new Date().toISOString(),
        error_message: error?.message
      };

      await this.supabase
        .from('webhook_logs')
        .insert(logEntry);

      // Log security events separately for monitoring
      if (validationResult.securityEvents?.length) {
        for (const event of validationResult.securityEvents) {
          logger.warn(`Webhook security event: ${event.type}`, {
            webhookId,
            severity: event.severity,
            details: event.details
          });
        }
      }

    } catch (logError) {
      logger.error('Failed to log webhook security event', {
        webhookId,
        error: logError instanceof Error ? logError.message : 'Unknown error'
      });
    }
  }

  /**
   * Enhanced idempotency check with better logging
   */
  async checkIdempotency(paymentKey: string, status: string, webhookId: string): Promise<boolean> {
    try {
      const { data: existingWebhook, error } = await this.supabase
        .from('webhook_logs')
        .select('webhook_id, processed_at, processed')
        .eq('payment_key', paymentKey)
        .eq('status', status)
        .eq('processed', true)
        .order('received_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        logger.warn('Error checking webhook idempotency', {
          error: error.message,
          paymentKey,
          status,
          webhookId
        });
        return false; // Assume not duplicate on error
      }

      if (existingWebhook) {
        logger.info('Duplicate webhook detected', {
          webhookId,
          existingWebhookId: existingWebhook.webhook_id,
          paymentKey,
          status,
          existingProcessedAt: existingWebhook.processed_at
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.error('Error in idempotency check', {
        error: error instanceof Error ? error.message : 'Unknown error',
        paymentKey,
        status,
        webhookId
      });
      return false;
    }
  }

  /**
   * Mark webhook as processed with enhanced logging
   */
  async markAsProcessed(
    paymentKey: string,
    status: string,
    webhookId: string,
    processingDuration: number
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('webhook_logs')
        .update({
          processed: true,
          processed_at: new Date().toISOString(),
          processing_duration: processingDuration
        })
        .eq('webhook_id', webhookId);

      if (error) {
        logger.error('Failed to mark webhook as processed', {
          error: error.message,
          webhookId,
          paymentKey,
          status
        });
      } else {
        logger.info('Webhook marked as processed', {
          webhookId,
          paymentKey,
          status,
          processingDuration
        });
      }
    } catch (error) {
      logger.error('Error marking webhook as processed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        webhookId,
        paymentKey,
        status
      });
    }
  }

  /**
   * Get security statistics for monitoring
   */
  async getSecurityStats(hours: number = 24): Promise<{
    totalWebhooks: number;
    validWebhooks: number;
    invalidSignatures: number;
    replayAttacks: number;
    rateLimitExceeded: number;
    ipBlocked: number;
  }> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

      const { data: logs } = await this.supabase
        .from('webhook_logs')
        .select('signature_valid, security_events')
        .gte('received_at', since);

      if (!logs) {
        return {
          totalWebhooks: 0,
          validWebhooks: 0,
          invalidSignatures: 0,
          replayAttacks: 0,
          rateLimitExceeded: 0,
          ipBlocked: 0
        };
      }

      const stats = {
        totalWebhooks: logs.length,
        validWebhooks: logs.filter(log => log.signature_valid).length,
        invalidSignatures: logs.filter(log => !log.signature_valid).length,
        replayAttacks: 0,
        rateLimitExceeded: 0,
        ipBlocked: 0
      };

      // Count security events
      logs.forEach(log => {
        if (log.security_events) {
          const events = Array.isArray(log.security_events) ? log.security_events : [log.security_events];
          events.forEach((event: SecurityEvent) => {
            switch (event.type) {
              case 'replay_attack':
                stats.replayAttacks++;
                break;
              case 'rate_limit_exceeded':
                stats.rateLimitExceeded++;
                break;
              case 'ip_blocked':
                stats.ipBlocked++;
                break;
            }
          });
        }
      });

      return stats;
    } catch (error) {
      logger.error('Error getting security stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return {
        totalWebhooks: 0,
        validWebhooks: 0,
        invalidSignatures: 0,
        replayAttacks: 0,
        rateLimitExceeded: 0,
        ipBlocked: 0
      };
    }
  }

  /**
   * Retry a failed webhook
   */
  async retryWebhook(webhook: any): Promise<any> {
    try {
      logger.info('Retrying webhook', {
        webhookId: webhook.id,
        paymentKey: webhook.payment_key,
        originalStatus: webhook.status
      });

      // Parse webhook payload
      let payload: any;
      try {
        payload = typeof webhook.payload === 'string'
          ? JSON.parse(webhook.payload)
          : webhook.payload;
      } catch (error) {
        logger.error('Failed to parse webhook payload', {
          webhookId: webhook.id,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
        return {
          success: false,
          error: 'Invalid payload format'
        };
      }

      // Import PortOne service to reprocess webhook
      const { portOneService } = await import('./portone.service');

      // Reprocess the webhook (headers may not be available for retry)
      const webhookHeaders = webhook.headers ? JSON.parse(webhook.headers) : {};
      await portOneService.processWebhook(JSON.stringify(payload), webhookHeaders);

      // Update webhook log
      const { error: updateError } = await this.supabase
        .from('webhook_logs')
        .update({
          status: 'retried',
          retried_at: new Date().toISOString(),
          retry_success: true
        })
        .eq('id', webhook.id);

      if (updateError) {
        logger.error('Failed to update webhook log after retry', {
          webhookId: webhook.id,
          error: updateError.message
        });
      }

      return {
        success: true,
        webhookId: webhook.id,
        message: 'Webhook retried successfully'
      };

    } catch (error) {
      logger.error('Failed to retry webhook', {
        webhookId: webhook.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      // Update webhook log with failure
      await this.supabase
        .from('webhook_logs')
        .update({
          status: 'retry_failed',
          retried_at: new Date().toISOString(),
          retry_success: false,
          retry_error: error instanceof Error ? error.message : 'Unknown error'
        })
        .eq('id', webhook.id);

      return {
        success: false,
        webhookId: webhook.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
}

// Export singleton instance
export const webhookSecurityService = new WebhookSecurityService();

