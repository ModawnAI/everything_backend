/**
 * Webhook Security Service Tests
 * 
 * Comprehensive tests for webhook security implementation including:
 * - HMAC-SHA256 signature verification
 * - Timestamp validation and replay attack prevention
 * - Rate limiting and IP whitelisting
 * - Idempotency checks
 * - Security event logging
 */

import { webhookSecurityService } from '../../src/services/webhook-security.service';
import { createWebhookSecurityMiddleware } from '../../src/middleware/webhook-security.middleware';
import { Request, Response } from 'express';
import crypto from 'crypto';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/utils/logger');

describe('Webhook Security Service', () => {
  let mockSupabase: any;

  const createMockSupabase = () => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ data: null, error: null })),
          gte: jest.fn(() => Promise.resolve({ data: [], error: null })),
          order: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ data: null, error: { code: 'PGRST116' } }))
            }))
          }))
        }))
      })),
      insert: jest.fn(() => Promise.resolve({ error: null })),
      update: jest.fn(() => ({
        eq: jest.fn(() => Promise.resolve({ error: null }))
      }))
    }))
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase = createMockSupabase();
    const { getSupabaseClient } = require('../../src/config/database');
    getSupabaseClient.mockReturnValue(mockSupabase);
  });

  describe('Signature Verification', () => {
    it('should verify valid HMAC-SHA256 signature', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString()
      };

      // Generate valid signature
      const canonicalPayload = 'approvedAt=' + payload.approvedAt + 
        '&orderId=' + payload.orderId + 
        '&paymentKey=' + payload.paymentKey + 
        '&status=' + payload.status + 
        '&totalAmount=' + payload.totalAmount;
      
      const validSignature = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPayload)
        .digest('hex');

      payload.secret = validSignature;

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: false
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(true);
      expect(result.securityEvents).toHaveLength(0);
    });

    it('should reject invalid signature', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        secret: 'invalid-signature'
      };

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: false
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
      expect(result.securityEvents).toHaveLength(1);
      expect(result.securityEvents![0].type).toBe('signature_invalid');
    });

    it('should reject payload without signature', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString()
      };

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: false
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Invalid signature');
    });
  });

  describe('Timestamp Validation', () => {
    it('should accept recent timestamp', async () => {
      const secretKey = 'test-secret-key';
      const recentTimestamp = new Date().toISOString();
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: recentTimestamp,
        requestedAt: recentTimestamp
      };

      // Generate valid signature
      const canonicalPayload = 'approvedAt=' + payload.approvedAt + 
        '&orderId=' + payload.orderId + 
        '&paymentKey=' + payload.paymentKey + 
        '&requestedAt=' + payload.requestedAt +
        '&status=' + payload.status + 
        '&totalAmount=' + payload.totalAmount;
      
      payload.secret = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPayload)
        .digest('hex');

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: true,
        enableIPWhitelist: false,
        timestampTolerance: 300 // 5 minutes
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(true);
    });

    it('should reject expired timestamp', async () => {
      const secretKey = 'test-secret-key';
      const expiredTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: expiredTimestamp,
        requestedAt: expiredTimestamp
      };

      // Generate valid signature
      const canonicalPayload = 'approvedAt=' + payload.approvedAt + 
        '&orderId=' + payload.orderId + 
        '&paymentKey=' + payload.paymentKey + 
        '&requestedAt=' + payload.requestedAt +
        '&status=' + payload.status + 
        '&totalAmount=' + payload.totalAmount;
      
      payload.secret = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPayload)
        .digest('hex');

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: true,
        enableIPWhitelist: false,
        timestampTolerance: 300 // 5 minutes
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Timestamp expired or invalid');
      expect(result.securityEvents![0].type).toBe('timestamp_expired');
    });
  });

  describe('IP Whitelisting', () => {
    it('should accept whitelisted IP', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        secret: 'dummy-signature'
      };

      const mockReq = {
        ip: '192.168.1.100',
        connection: { remoteAddress: '192.168.1.100' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: true,
        allowedIPs: ['192.168.1.100', '10.0.0.1']
      };

      // Mock signature verification to pass
      jest.spyOn(webhookSecurityService as any, 'verifySignature').mockReturnValue(true);

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(true);
    });

    it('should reject non-whitelisted IP', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        secret: 'dummy-signature'
      };

      const mockReq = {
        ip: '192.168.1.200',
        connection: { remoteAddress: '192.168.1.200' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: true,
        allowedIPs: ['192.168.1.100', '10.0.0.1']
      };

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('IP address not whitelisted');
      expect(result.securityEvents![0].type).toBe('ip_blocked');
    });
  });

  describe('Rate Limiting', () => {
    it('should allow requests within rate limit', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        secret: 'dummy-signature'
      };

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: false,
        rateLimitWindow: 60,
        rateLimitMaxRequests: 10
      };

      // Mock signature verification to pass
      jest.spyOn(webhookSecurityService as any, 'verifySignature').mockReturnValue(true);

      // Make multiple requests within limit
      for (let i = 0; i < 5; i++) {
        const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
        expect(result.isValid).toBe(true);
      }
    });

    it('should reject requests exceeding rate limit', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        secret: 'dummy-signature'
      };

      const mockReq = {
        ip: '127.0.0.2',
        connection: { remoteAddress: '127.0.0.2' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: false,
        enableIPWhitelist: false,
        rateLimitWindow: 60,
        rateLimitMaxRequests: 3
      };

      // Mock signature verification to pass
      jest.spyOn(webhookSecurityService as any, 'verifySignature').mockReturnValue(true);

      // Make requests up to limit
      for (let i = 0; i < 3; i++) {
        const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
        expect(result.isValid).toBe(true);
      }

      // Next request should be rate limited
      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Rate limit exceeded');
      expect(result.securityEvents![0].type).toBe('rate_limit_exceeded');
    });
  });

  describe('Replay Attack Detection', () => {
    it('should detect replay attack', async () => {
      const secretKey = 'test-secret-key';
      const payload = {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE',
        totalAmount: 50000,
        approvedAt: new Date().toISOString(),
        requestedAt: new Date().toISOString()
      };

      // Generate valid signature
      const canonicalPayload = 'approvedAt=' + payload.approvedAt + 
        '&orderId=' + payload.orderId + 
        '&paymentKey=' + payload.paymentKey + 
        '&requestedAt=' + payload.requestedAt +
        '&status=' + payload.status + 
        '&totalAmount=' + payload.totalAmount;
      
      payload.secret = crypto
        .createHmac('sha256', secretKey)
        .update(canonicalPayload)
        .digest('hex');

      const mockReq = {
        ip: '127.0.0.1',
        connection: { remoteAddress: '127.0.0.1' },
        get: jest.fn(() => 'TossPayments-Webhook')
      } as any;

      const config = {
        secretKey,
        enableReplayProtection: true,
        enableIPWhitelist: false,
        timestampTolerance: 300
      };

      // Mock existing webhook in database (replay detected)
      const mockDetectReplayAttack = jest.spyOn(webhookSecurityService as any, 'detectReplayAttack');
      mockDetectReplayAttack.mockResolvedValue(true);

      const result = await webhookSecurityService.validateWebhook(mockReq, payload, config);
      expect(result.isValid).toBe(false);
      expect(result.reason).toBe('Replay attack detected');
      expect(result.securityEvents![0].type).toBe('replay_attack');
    });
  });

  describe('Idempotency Checks', () => {
    it('should detect duplicate webhook', async () => {
      const paymentKey = 'test-payment-key';
      const status = 'DONE';
      const webhookId = 'test-webhook-123';

      // Mock existing processed webhook
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: { 
                    webhook_id: 'existing-webhook',
                    processed_at: new Date().toISOString(),
                    processed: true
                  }, 
                  error: null 
                }))
              }))
            }))
          }))
        }))
      });

      const isDuplicate = await webhookSecurityService.checkIdempotency(paymentKey, status, webhookId);
      expect(isDuplicate).toBe(true);
    });

    it('should allow new webhook', async () => {
      const paymentKey = 'test-payment-key';
      const status = 'DONE';
      const webhookId = 'test-webhook-123';

      // Mock no existing webhook
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              limit: jest.fn(() => ({
                single: jest.fn(() => Promise.resolve({ 
                  data: null, 
                  error: { code: 'PGRST116' } // No rows returned
                }))
              }))
            }))
          }))
        }))
      });

      const isDuplicate = await webhookSecurityService.checkIdempotency(paymentKey, status, webhookId);
      expect(isDuplicate).toBe(false);
    });
  });

  describe('Security Statistics', () => {
    it('should calculate security statistics', async () => {
      // Mock webhook logs data
      const mockLogs = [
        { signature_valid: true, security_events: null },
        { signature_valid: false, security_events: [{ type: 'signature_invalid' }] },
        { signature_valid: true, security_events: [{ type: 'rate_limit_exceeded' }] },
        { signature_valid: true, security_events: [{ type: 'replay_attack' }] },
        { signature_valid: true, security_events: [{ type: 'ip_blocked' }] }
      ];

      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          gte: jest.fn(() => Promise.resolve({ 
            data: mockLogs, 
            error: null 
          }))
        }))
      });

      const stats = await webhookSecurityService.getSecurityStats(24);
      
      expect(stats.totalWebhooks).toBe(5);
      expect(stats.validWebhooks).toBe(4);
      expect(stats.invalidSignatures).toBe(1);
      expect(stats.replayAttacks).toBe(1);
      expect(stats.rateLimitExceeded).toBe(1);
      expect(stats.ipBlocked).toBe(1);
    });
  });
});

describe('Webhook Security Middleware', () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let mockNext: jest.Mock;

  beforeEach(() => {
    mockReq = {
      method: 'POST',
      path: '/webhooks/toss-payments',
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
      get: jest.fn((header) => {
        if (header === 'Content-Type') return 'application/json';
        if (header === 'User-Agent') return 'TossPayments-Webhook';
        return undefined;
      }),
      body: {
        paymentKey: 'test-payment-key',
        orderId: 'test-order-123',
        status: 'DONE'
      },
      secure: true
    };

    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    mockNext = jest.fn();
  });

  it('should pass valid webhook through middleware', async () => {
    const middleware = createWebhookSecurityMiddleware({
      provider: 'toss-payments',
      secretKey: 'test-secret',
      enableIPWhitelist: false,
      enableReplayProtection: false
    });

    // Mock successful validation
    jest.spyOn(webhookSecurityService, 'validateWebhook').mockResolvedValue({
      isValid: true,
      securityEvents: []
    });

    jest.spyOn(webhookSecurityService, 'logWebhookEvent').mockResolvedValue();

    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.securityValidated).toBe(true);
    expect(mockReq.webhookId).toBeDefined();
  });

  it('should reject invalid webhook', async () => {
    const middleware = createWebhookSecurityMiddleware({
      provider: 'toss-payments',
      secretKey: 'test-secret',
      enableIPWhitelist: false,
      enableReplayProtection: false
    });

    // Mock failed validation
    jest.spyOn(webhookSecurityService, 'validateWebhook').mockResolvedValue({
      isValid: false,
      reason: 'Invalid signature',
      securityEvents: [{ 
        type: 'signature_invalid', 
        severity: 'critical', 
        details: {}, 
        timestamp: new Date().toISOString() 
      }]
    });

    jest.spyOn(webhookSecurityService, 'logWebhookEvent').mockResolvedValue();

    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'INVALID_SIGNATURE',
        message: '유효하지 않은 서명입니다.',
        webhookId: expect.any(String)
      }
    });
  });

  it('should enforce HTTPS in production', async () => {
    const middleware = createWebhookSecurityMiddleware({
      provider: 'toss-payments',
      secretKey: 'test-secret',
      requireHTTPS: true
    });

    mockReq.secure = false;
    mockReq.get = jest.fn((header) => {
      if (header === 'Content-Type') return 'application/json';
      if (header === 'User-Agent') return 'TossPayments-Webhook';
      if (header === 'X-Forwarded-Proto') return undefined;
      return undefined;
    });

    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(400);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'HTTPS_REQUIRED',
        message: 'HTTPS 연결이 필요합니다.',
        webhookId: expect.any(String)
      }
    });
  });

  it('should enforce payload size limits', async () => {
    const middleware = createWebhookSecurityMiddleware({
      provider: 'toss-payments',
      secretKey: 'test-secret',
      maxPayloadSize: 1000 // 1KB
    });

    mockReq.get = jest.fn((header) => {
      if (header === 'Content-Length') return '2000'; // 2KB
      if (header === 'Content-Type') return 'application/json';
      if (header === 'User-Agent') return 'TossPayments-Webhook';
      if (header === 'X-Forwarded-Proto') return undefined;
      return undefined;
    });

    await middleware(mockReq as any, mockRes as any, mockNext);

    expect(mockNext).not.toHaveBeenCalled();
    expect(mockRes.status).toHaveBeenCalledWith(413);
    expect(mockRes.json).toHaveBeenCalledWith({
      success: false,
      error: {
        code: 'PAYLOAD_TOO_LARGE',
        message: '요청 크기가 너무 큽니다.',
        webhookId: expect.any(String)
      }
    });
  });
});
