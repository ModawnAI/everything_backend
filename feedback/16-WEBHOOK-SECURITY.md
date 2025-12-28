# Implementation Plan: Webhook Security

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P1 - High |
| **Estimated Effort** | 4-6 hours |
| **Risk Level** | High (Payment security) |
| **Components Affected** | Backend only |
| **Dependencies** | PortOne V2 Webhook documentation |

## Problem Statement

Webhook signature validation is incomplete:

```typescript
// Backend: Webhook signature validation incomplete
// Risk of accepting forged payment callbacks
// Missing replay attack protection
// Incomplete error handling
```

**Current State:**
- PortOne V2 webhooks are received
- Basic signature validation may exist
- No timestamp validation (replay protection)
- No webhook logging for debugging
- Error responses may leak information

**Impact:**
1. **Critical**: Potential for payment fraud
2. **Critical**: Forged payment confirmations
3. **High**: Replay attacks possible
4. **Medium**: Debugging difficulties

---

## Webhook Security Requirements

### 1. Signature Validation

| Requirement | Description |
|-------------|-------------|
| **HMAC Verification** | Validate PortOne signature header |
| **Timestamp Check** | Reject webhooks older than 5 minutes |
| **Body Integrity** | Ensure payload hasn't been modified |

### 2. Replay Protection

| Mechanism | Implementation |
|-----------|----------------|
| **Timestamp Window** | Accept only recent webhooks |
| **Idempotency Key** | Track processed webhook IDs |
| **Deduplication** | Ignore duplicate webhooks |

### 3. Logging & Monitoring

| Feature | Purpose |
|---------|---------|
| **Full Request Logging** | Debug and audit trail |
| **Signature Failure Alerts** | Detect attack attempts |
| **Processing Status** | Track successful/failed webhooks |

---

## Backend Implementation

### Step 1: Create Webhook Types

**File:** `src/types/webhook.types.ts`

```typescript
/**
 * Webhook Type Definitions
 */

// Webhook source
export type WebhookSource = 'portone' | 'kakao' | 'firebase' | 'internal';

// Webhook status
export type WebhookStatus = 'received' | 'validated' | 'processed' | 'failed' | 'duplicate' | 'expired';

// Webhook log entry
export interface WebhookLog {
  id: string;
  source: WebhookSource;
  eventType: string;
  idempotencyKey: string | null;
  signature: string | null;
  signatureValid: boolean;
  timestamp: string;
  timestampValid: boolean;
  status: WebhookStatus;
  requestHeaders: Record<string, string>;
  requestBody: Record<string, any>;
  responseStatus: number;
  responseBody: Record<string, any> | null;
  processingTimeMs: number;
  errorMessage: string | null;
  createdAt: string;
}

// PortOne webhook payload
export interface PortOneWebhookPayload {
  type: string; // 'Transaction.Paid', 'Transaction.Cancelled', etc.
  timestamp: string; // ISO 8601
  data: {
    transactionId?: string;
    paymentId?: string;
    storeId: string;
    status?: string;
    amount?: {
      total: number;
      taxFree?: number;
    };
    method?: string;
    [key: string]: any;
  };
}

// Signature verification result
export interface SignatureVerificationResult {
  valid: boolean;
  reason?: string;
  timestamp?: Date;
  signatureHeader?: string;
}
```

### Step 2: Create Webhook Security Service

**File:** `src/services/webhook-security.service.ts`

```typescript
/**
 * Webhook Security Service
 * Handles signature validation, replay protection, and logging
 */

import crypto from 'crypto';
import { supabase } from '@/config/supabase';
import { config } from '@/config/environment';
import {
  WebhookSource,
  WebhookStatus,
  WebhookLog,
  PortOneWebhookPayload,
  SignatureVerificationResult,
} from '@/types/webhook.types';

// Configuration
const TIMESTAMP_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes
const IDEMPOTENCY_WINDOW_HOURS = 24;

export class WebhookSecurityService {
  private readonly portoneWebhookSecret: string;

  constructor() {
    this.portoneWebhookSecret = config.portone?.webhookSecret || '';

    if (!this.portoneWebhookSecret) {
      console.warn('⚠️ PORTONE_WEBHOOK_SECRET not configured - webhook validation disabled');
    }
  }

  /**
   * Validate PortOne webhook signature
   */
  validatePortOneSignature(
    headers: Record<string, string>,
    rawBody: string
  ): SignatureVerificationResult {
    // Get signature header
    const signatureHeader = headers['webhook-signature'] || headers['x-portone-signature'];

    if (!signatureHeader) {
      return { valid: false, reason: 'Missing signature header' };
    }

    // Parse signature parts (format: t=timestamp,v1=signature)
    const parts = signatureHeader.split(',').reduce((acc, part) => {
      const [key, value] = part.split('=');
      acc[key] = value;
      return acc;
    }, {} as Record<string, string>);

    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp || !signature) {
      return { valid: false, reason: 'Invalid signature format', signatureHeader };
    }

    // Validate timestamp (replay protection)
    const webhookTime = parseInt(timestamp, 10) * 1000; // Convert to ms
    const now = Date.now();

    if (isNaN(webhookTime)) {
      return { valid: false, reason: 'Invalid timestamp', signatureHeader };
    }

    if (now - webhookTime > TIMESTAMP_TOLERANCE_MS) {
      return {
        valid: false,
        reason: 'Webhook expired (timestamp too old)',
        timestamp: new Date(webhookTime),
        signatureHeader,
      };
    }

    if (webhookTime > now + 60000) {
      return {
        valid: false,
        reason: 'Invalid timestamp (future)',
        timestamp: new Date(webhookTime),
        signatureHeader,
      };
    }

    // Compute expected signature
    const signedPayload = `${timestamp}.${rawBody}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.portoneWebhookSecret)
      .update(signedPayload)
      .digest('hex');

    // Compare signatures (timing-safe)
    const isValid = crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );

    if (!isValid) {
      return {
        valid: false,
        reason: 'Signature mismatch',
        timestamp: new Date(webhookTime),
        signatureHeader,
      };
    }

    return {
      valid: true,
      timestamp: new Date(webhookTime),
      signatureHeader,
    };
  }

  /**
   * Check for duplicate webhook (idempotency)
   */
  async isDuplicateWebhook(
    source: WebhookSource,
    idempotencyKey: string
  ): Promise<boolean> {
    // Check if webhook was already processed
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - IDEMPOTENCY_WINDOW_HOURS);

    const { data, error } = await supabase
      .from('webhook_logs')
      .select('id')
      .eq('source', source)
      .eq('idempotency_key', idempotencyKey)
      .eq('status', 'processed')
      .gte('created_at', cutoffTime.toISOString())
      .limit(1);

    if (error) {
      console.error('Error checking duplicate webhook:', error);
      return false; // Fail open for availability
    }

    return (data?.length || 0) > 0;
  }

  /**
   * Log webhook request
   */
  async logWebhook(
    source: WebhookSource,
    eventType: string,
    headers: Record<string, string>,
    body: Record<string, any>,
    signatureResult: SignatureVerificationResult,
    status: WebhookStatus,
    responseStatus: number,
    responseBody?: Record<string, any>,
    errorMessage?: string,
    processingTimeMs?: number
  ): Promise<string> {
    // Extract idempotency key
    const idempotencyKey = this.extractIdempotencyKey(source, body);

    // Sanitize headers (remove sensitive data)
    const sanitizedHeaders = this.sanitizeHeaders(headers);

    // Sanitize body (mask sensitive fields)
    const sanitizedBody = this.sanitizeBody(body);

    const { data, error } = await supabase
      .from('webhook_logs')
      .insert({
        source,
        event_type: eventType,
        idempotency_key: idempotencyKey,
        signature: signatureResult.signatureHeader,
        signature_valid: signatureResult.valid,
        timestamp: signatureResult.timestamp?.toISOString(),
        timestamp_valid: signatureResult.valid && signatureResult.timestamp != null,
        status,
        request_headers: sanitizedHeaders,
        request_body: sanitizedBody,
        response_status: responseStatus,
        response_body: responseBody,
        processing_time_ms: processingTimeMs || 0,
        error_message: errorMessage,
        created_at: new Date().toISOString(),
      })
      .select('id')
      .single();

    if (error) {
      console.error('Failed to log webhook:', error);
      return 'unknown';
    }

    return data.id;
  }

  /**
   * Extract idempotency key from webhook body
   */
  private extractIdempotencyKey(source: WebhookSource, body: Record<string, any>): string | null {
    switch (source) {
      case 'portone':
        // Use paymentId or transactionId as idempotency key
        return body.data?.paymentId || body.data?.transactionId || null;

      case 'kakao':
        return body.bot_event_id || null;

      default:
        return body.id || body.eventId || null;
    }
  }

  /**
   * Sanitize headers (remove sensitive data)
   */
  private sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
    const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(headers)) {
      if (sensitiveHeaders.includes(key.toLowerCase())) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize body (mask sensitive fields)
   */
  private sanitizeBody(body: Record<string, any>): Record<string, any> {
    const sensitiveFields = ['cardNumber', 'cvv', 'password', 'secret'];

    const sanitize = (obj: any): any => {
      if (typeof obj !== 'object' || obj === null) {
        return obj;
      }

      if (Array.isArray(obj)) {
        return obj.map(sanitize);
      }

      const result: Record<string, any> = {};
      for (const [key, value] of Object.entries(obj)) {
        if (sensitiveFields.some((f) => key.toLowerCase().includes(f.toLowerCase()))) {
          result[key] = '[REDACTED]';
        } else {
          result[key] = sanitize(value);
        }
      }
      return result;
    };

    return sanitize(body);
  }

  /**
   * Update webhook status
   */
  async updateWebhookStatus(
    logId: string,
    status: WebhookStatus,
    responseStatus?: number,
    responseBody?: Record<string, any>,
    errorMessage?: string,
    processingTimeMs?: number
  ): Promise<void> {
    await supabase
      .from('webhook_logs')
      .update({
        status,
        response_status: responseStatus,
        response_body: responseBody,
        error_message: errorMessage,
        processing_time_ms: processingTimeMs,
      })
      .eq('id', logId);
  }

  /**
   * Get recent webhook logs
   */
  async getRecentWebhooks(
    source?: WebhookSource,
    limit = 50
  ): Promise<WebhookLog[]> {
    let query = supabase
      .from('webhook_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (source) {
      query = query.eq('source', source);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch webhook logs: ${error.message}`);
    }

    return (data || []).map((log) => ({
      id: log.id,
      source: log.source,
      eventType: log.event_type,
      idempotencyKey: log.idempotency_key,
      signature: log.signature,
      signatureValid: log.signature_valid,
      timestamp: log.timestamp,
      timestampValid: log.timestamp_valid,
      status: log.status,
      requestHeaders: log.request_headers,
      requestBody: log.request_body,
      responseStatus: log.response_status,
      responseBody: log.response_body,
      processingTimeMs: log.processing_time_ms,
      errorMessage: log.error_message,
      createdAt: log.created_at,
    }));
  }
}

export const webhookSecurityService = new WebhookSecurityService();
```

### Step 3: Create Webhook Middleware

**File:** `src/middleware/webhook.middleware.ts`

```typescript
/**
 * Webhook Validation Middleware
 * Validates webhook signatures and prevents replay attacks
 */

import { Request, Response, NextFunction } from 'express';
import { webhookSecurityService } from '@/services/webhook-security.service';
import { WebhookSource } from '@/types/webhook.types';

// Store raw body for signature validation
export function captureRawBody(req: Request, res: Response, buf: Buffer) {
  req.rawBody = buf.toString();
}

// Extend Request type
declare global {
  namespace Express {
    interface Request {
      rawBody?: string;
      webhookLogId?: string;
    }
  }
}

/**
 * PortOne webhook validation middleware
 */
export async function validatePortOneWebhook(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const startTime = Date.now();
  const source: WebhookSource = 'portone';
  const eventType = req.body?.type || 'unknown';

  try {
    // Get raw body for signature validation
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Validate signature
    const signatureResult = webhookSecurityService.validatePortOneSignature(
      req.headers as Record<string, string>,
      rawBody
    );

    if (!signatureResult.valid) {
      // Log failed validation
      await webhookSecurityService.logWebhook(
        source,
        eventType,
        req.headers as Record<string, string>,
        req.body,
        signatureResult,
        'failed',
        401,
        { error: signatureResult.reason },
        signatureResult.reason,
        Date.now() - startTime
      );

      // Don't reveal validation details to potential attackers
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    // Check for duplicate (idempotency)
    const idempotencyKey = req.body?.data?.paymentId || req.body?.data?.transactionId;

    if (idempotencyKey) {
      const isDuplicate = await webhookSecurityService.isDuplicateWebhook(source, idempotencyKey);

      if (isDuplicate) {
        // Log duplicate
        await webhookSecurityService.logWebhook(
          source,
          eventType,
          req.headers as Record<string, string>,
          req.body,
          signatureResult,
          'duplicate',
          200,
          { message: 'Duplicate webhook ignored' },
          undefined,
          Date.now() - startTime
        );

        // Return success (idempotent behavior)
        res.status(200).json({ message: 'OK' });
        return;
      }
    }

    // Log valid webhook (status will be updated after processing)
    const logId = await webhookSecurityService.logWebhook(
      source,
      eventType,
      req.headers as Record<string, string>,
      req.body,
      signatureResult,
      'validated',
      0, // Will be updated
      undefined,
      undefined,
      Date.now() - startTime
    );

    // Attach log ID to request for later update
    req.webhookLogId = logId;

    next();
  } catch (error) {
    console.error('Webhook validation error:', error);

    // Log error
    await webhookSecurityService.logWebhook(
      source,
      eventType,
      req.headers as Record<string, string>,
      req.body,
      { valid: false, reason: 'Validation error' },
      'failed',
      500,
      { error: 'Internal error' },
      error instanceof Error ? error.message : 'Unknown error',
      Date.now() - startTime
    );

    res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Webhook response logger middleware
 * Call this after processing to update log status
 */
export async function logWebhookResponse(
  logId: string,
  status: 'processed' | 'failed',
  responseStatus: number,
  responseBody?: Record<string, any>,
  errorMessage?: string,
  processingTimeMs?: number
): Promise<void> {
  await webhookSecurityService.updateWebhookStatus(
    logId,
    status,
    responseStatus,
    responseBody,
    errorMessage,
    processingTimeMs
  );
}
```

### Step 4: Update Payment Webhook Controller

**File:** `src/controllers/payment-webhook.controller.ts` (update)

```typescript
/**
 * Payment Webhook Controller
 * Handles PortOne V2 payment webhooks with security validation
 */

import { Request, Response } from 'express';
import { paymentService } from '@/services/payment.service';
import { logWebhookResponse } from '@/middleware/webhook.middleware';
import { PortOneWebhookPayload } from '@/types/webhook.types';

export class PaymentWebhookController {
  /**
   * Handle PortOne webhook
   */
  async handlePortOneWebhook(req: Request, res: Response): Promise<void> {
    const startTime = Date.now();
    const logId = req.webhookLogId;

    try {
      const payload = req.body as PortOneWebhookPayload;

      // Process based on event type
      switch (payload.type) {
        case 'Transaction.Paid':
          await this.handlePaymentPaid(payload);
          break;

        case 'Transaction.Cancelled':
          await this.handlePaymentCancelled(payload);
          break;

        case 'Transaction.PartialCancelled':
          await this.handlePartialCancellation(payload);
          break;

        case 'Transaction.Failed':
          await this.handlePaymentFailed(payload);
          break;

        case 'Transaction.PayPending':
          await this.handlePaymentPending(payload);
          break;

        default:
          console.log(`Unhandled webhook type: ${payload.type}`);
      }

      // Log successful processing
      if (logId) {
        await logWebhookResponse(
          logId,
          'processed',
          200,
          { success: true, type: payload.type },
          undefined,
          Date.now() - startTime
        );
      }

      res.status(200).json({ success: true });
    } catch (error) {
      console.error('Webhook processing error:', error);

      // Log failed processing
      if (logId) {
        await logWebhookResponse(
          logId,
          'failed',
          500,
          { error: 'Processing failed' },
          error instanceof Error ? error.message : 'Unknown error',
          Date.now() - startTime
        );
      }

      // Return 200 to prevent retries for unrecoverable errors
      // PortOne will retry on non-2xx responses
      res.status(200).json({ success: false, error: 'Processing failed' });
    }
  }

  private async handlePaymentPaid(payload: PortOneWebhookPayload): Promise<void> {
    const { paymentId, transactionId } = payload.data;

    if (!paymentId) {
      throw new Error('Missing paymentId in webhook payload');
    }

    await paymentService.confirmPayment(paymentId);
  }

  private async handlePaymentCancelled(payload: PortOneWebhookPayload): Promise<void> {
    const { paymentId } = payload.data;

    if (!paymentId) {
      throw new Error('Missing paymentId in webhook payload');
    }

    await paymentService.handleCancellation(paymentId);
  }

  private async handlePartialCancellation(payload: PortOneWebhookPayload): Promise<void> {
    const { paymentId, amount } = payload.data;

    if (!paymentId) {
      throw new Error('Missing paymentId in webhook payload');
    }

    await paymentService.handlePartialCancellation(paymentId, amount?.total || 0);
  }

  private async handlePaymentFailed(payload: PortOneWebhookPayload): Promise<void> {
    const { paymentId } = payload.data;

    if (!paymentId) {
      throw new Error('Missing paymentId in webhook payload');
    }

    await paymentService.handleFailure(paymentId);
  }

  private async handlePaymentPending(payload: PortOneWebhookPayload): Promise<void> {
    // Log pending status, no action needed
    console.log('Payment pending:', payload.data.paymentId);
  }
}

export const paymentWebhookController = new PaymentWebhookController();
```

### Step 5: Update Routes

**File:** `src/routes/webhook.routes.ts` (update)

```typescript
/**
 * Webhook Routes with Security
 */

import { Router, json } from 'express';
import { paymentWebhookController } from '@/controllers/payment-webhook.controller';
import { validatePortOneWebhook, captureRawBody } from '@/middleware/webhook.middleware';

const router = Router();

// Use raw body parser for signature validation
router.use(
  '/portone',
  json({
    verify: captureRawBody,
  })
);

/**
 * POST /api/webhooks/portone
 * PortOne payment webhook endpoint
 */
router.post(
  '/portone',
  validatePortOneWebhook,
  (req, res) => paymentWebhookController.handlePortOneWebhook(req, res)
);

export default router;
```

### Step 6: Create Database Migration

**File:** `src/migrations/XXX_create_webhook_logs.sql`

```sql
-- Migration: Create webhook logs table
-- For tracking and debugging webhook processing

CREATE TABLE IF NOT EXISTS webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Source and event
  source VARCHAR(50) NOT NULL,
  event_type VARCHAR(100) NOT NULL,
  idempotency_key VARCHAR(255),

  -- Signature validation
  signature TEXT,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  timestamp TIMESTAMPTZ,
  timestamp_valid BOOLEAN NOT NULL DEFAULT FALSE,

  -- Processing status
  status VARCHAR(20) NOT NULL DEFAULT 'received',

  -- Request data
  request_headers JSONB NOT NULL DEFAULT '{}',
  request_body JSONB NOT NULL DEFAULT '{}',

  -- Response data
  response_status INTEGER,
  response_body JSONB,

  -- Metrics
  processing_time_ms INTEGER DEFAULT 0,

  -- Error info
  error_message TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_webhook_logs_source ON webhook_logs(source);
CREATE INDEX idx_webhook_logs_status ON webhook_logs(status);
CREATE INDEX idx_webhook_logs_idempotency ON webhook_logs(source, idempotency_key);
CREATE INDEX idx_webhook_logs_created_at ON webhook_logs(created_at DESC);

-- Retention: Delete logs older than 90 days (run periodically)
-- DELETE FROM webhook_logs WHERE created_at < NOW() - INTERVAL '90 days';
```

### Step 7: Add Environment Variable

**File:** `.env`

```bash
# PortOne Webhook Secret
# Get this from PortOne dashboard > Webhooks > Secret
PORTONE_WEBHOOK_SECRET=your_webhook_secret_here
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/migrations/XXX_create_webhook_logs.sql` | **CREATE** | Database migration |
| `src/types/webhook.types.ts` | **CREATE** | TypeScript types |
| `src/services/webhook-security.service.ts` | **CREATE** | Security service |
| `src/middleware/webhook.middleware.ts` | **CREATE** | Validation middleware |
| `src/controllers/payment-webhook.controller.ts` | **MODIFY** | Add logging |
| `src/routes/webhook.routes.ts` | **MODIFY** | Add middleware |
| `src/config/environment.ts` | **MODIFY** | Add webhook secret |
| `.env` | **MODIFY** | Add secret variable |

---

## Testing Plan

### Security Tests

- [ ] Valid signature passes validation
- [ ] Invalid signature returns 401
- [ ] Expired timestamp returns 401
- [ ] Future timestamp returns 401
- [ ] Duplicate webhook returns 200 (idempotent)
- [ ] Missing signature header returns 401

### Integration Tests

- [ ] Payment confirmation webhook processes correctly
- [ ] Cancellation webhook processes correctly
- [ ] Failed payment webhook logs correctly
- [ ] Webhook logs are created

---

## Deployment Checklist

- [ ] Run database migration
- [ ] Add PORTONE_WEBHOOK_SECRET to environment
- [ ] Deploy backend changes
- [ ] Test webhook endpoint
- [ ] Monitor webhook logs
- [ ] Set up alerts for failed validations
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Signature validation accuracy | 100% |
| False rejection rate | 0% |
| Duplicate prevention | 100% |
| Log completeness | 100% |
