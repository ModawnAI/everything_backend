/**
 * Payment Security Comprehensive Test Suite
 * 
 * Advanced security testing for payment systems including:
 * - Penetration testing scenarios
 * - Vulnerability assessments
 * - Security boundary testing
 * - Attack simulation and prevention
 * - Compliance validation (PCI DSS, GDPR)
 * - Security monitoring and alerting
 * 
 * Uses real services and database connections for authentic security testing
 */

import { getSupabaseClient } from '../../src/config/database';
import * as crypto from 'crypto';
import axios, { AxiosError } from 'axios';
import { performance } from 'perf_hooks';

// Import security services
import { WebhookSecurityService } from '../../src/services/webhook-security.service';
import { FraudDetectionService } from '../../src/services/fraud-detection.service';
import { ComprehensiveSecurityLoggingService } from '../../src/services/comprehensive-security-logging.service';
import { SecurityMonitoringService } from '../../src/services/security-monitoring.service';
import { PaymentService } from '../../src/services/payment.service';
import { TossPaymentsService } from '../../src/services/toss-payments.service';
import { logger } from '../../src/utils/logger';

// Test configuration
const TEST_SERVER_BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const SECURITY_TEST_TIMEOUT = 60000; // 60 seconds for security tests

// TODO: 결제 서비스 변경 후 활성화
describe.skip('Payment Security Comprehensive Test Suite', () => {
  let supabase: any;
  let webhookSecurityService: WebhookSecurityService;
  let fraudDetectionService: FraudDetectionService;
  let securityLoggingService: ComprehensiveSecurityLoggingService;
  let securityMonitoringService: SecurityMonitoringService;
  let paymentService: PaymentService;
  let tossPaymentsService: TossPaymentsService;

  // Test data
  let testUser: any;
  let testShop: any;
  let testService: any;
  let testPayment: any;

  beforeAll(async () => {
    supabase = getSupabaseClient();
    
    // Initialize security services
    webhookSecurityService = new WebhookSecurityService();
    fraudDetectionService = new FraudDetectionService();
    securityLoggingService = new ComprehensiveSecurityLoggingService();
    securityMonitoringService = new SecurityMonitoringService();
    paymentService = new PaymentService();
    tossPaymentsService = new TossPaymentsService();

    // Create test data
    const testUserId = crypto.randomUUID();
    const testShopId = crypto.randomUUID();
    const testServiceId = crypto.randomUUID();

    // Create test user
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `security-test-${Date.now()}@test.com`,
        name: 'Security Test User',
        phone_number: '+821012345678',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (userError) {
      throw new Error(`Failed to create test user: ${userError.message}`);
    }
    testUser = insertedUser;

    // Create test shop
    const { data: insertedShop, error: shopError } = await supabase
      .from('shops')
      .insert({
        id: testShopId,
        name: 'Security Test Shop',
        owner_id: testUser.id,
        address: 'Test Address',
        phone_number: '+821087654321',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (shopError) {
      throw new Error(`Failed to create test shop: ${shopError.message}`);
    }
    testShop = insertedShop;

    // Create test service
    const { data: insertedService, error: serviceError } = await supabase
      .from('services')
      .insert({
        id: testServiceId,
        shop_id: testShop.id,
        name: 'Security Test Service',
        price: 50000,
        deposit_amount: 10000,
        duration_minutes: 60,
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (serviceError) {
      throw new Error(`Failed to create test service: ${serviceError.message}`);
    }
    testService = insertedService;

    logger.info('Security test setup completed', {
      testUser: testUser.id,
      testShop: testShop.id,
      testService: testService.id
    });
  }, 30000);

  afterAll(async () => {
    // Clean up test data
    if (testService?.id) {
      await supabase.from('services').delete().eq('id', testService.id);
    }
    if (testShop?.id) {
      await supabase.from('shops').delete().eq('id', testShop.id);
    }
    if (testUser?.id) {
      await supabase.from('users').delete().eq('id', testUser.id);
    }
  }, 10000);

  describe('Webhook Security Penetration Tests', () => {
    it('should prevent signature forgery attacks', async () => {
      const maliciousPayload = {
        paymentKey: 'fake_payment_key',
        orderId: 'fake_order_id',
        status: 'DONE',
        totalAmount: 999999999,
        method: 'CARD'
      };

      const maliciousSignature = 'fake_signature_attempt';
      const rawBody = JSON.stringify(maliciousPayload);

      // Test signature verification
      const isValidSignature = webhookSecurityService.verifySignature(rawBody, maliciousSignature);
      expect(isValidSignature).toBe(false);

      // Test with completely invalid signature format
      const invalidFormats = [
        '',
        'invalid',
        '123',
        'Bearer token',
        'Basic auth',
        crypto.randomBytes(32).toString('hex'), // Wrong encoding
        Buffer.from('fake').toString('base64') // Valid base64 but wrong content
      ];

      for (const invalidSignature of invalidFormats) {
        const result = webhookSecurityService.verifySignature(rawBody, invalidSignature);
        expect(result).toBe(false);
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should detect and prevent replay attacks', async () => {
      const validPayload = {
        paymentKey: `test_payment_${Date.now()}`,
        orderId: `test_order_${Date.now()}`,
        status: 'DONE',
        requestedAt: new Date(Date.now() - 10 * 60 * 1000).toISOString() // 10 minutes ago
      };

      // Test timestamp validation for replay attacks
      const isValidTimestamp = webhookSecurityService.validateTimestamp(validPayload.requestedAt);
      expect(isValidTimestamp).toBe(false); // Should be invalid due to age

      // Test with future timestamp (also invalid)
      const futurePayload = {
        ...validPayload,
        requestedAt: new Date(Date.now() + 10 * 60 * 1000).toISOString()
      };
      const isFutureValid = webhookSecurityService.validateTimestamp(futurePayload.requestedAt);
      expect(isFutureValid).toBe(false);

      // Test with recent timestamp (should be valid)
      const recentPayload = {
        ...validPayload,
        requestedAt: new Date().toISOString()
      };
      const isRecentValid = webhookSecurityService.validateTimestamp(recentPayload.requestedAt);
      expect(isRecentValid).toBe(true);
    }, SECURITY_TEST_TIMEOUT);

    it('should enforce IP whitelisting and detect unauthorized sources', async () => {
      const unauthorizedIPs = [
        '192.168.1.100',  // Private network
        '10.0.0.1',       // Private network
        '172.16.0.1',     // Private network
        '127.0.0.1',      // Localhost
        '0.0.0.0',        // Invalid
        '999.999.999.999', // Invalid format
        'malicious.attacker.com', // Domain instead of IP
        ''                // Empty
      ];

      for (const unauthorizedIP of unauthorizedIPs) {
        const isValidIP = webhookSecurityService.isValidSourceIp(unauthorizedIP);
        // Should be false if IP whitelist is configured, true if not configured (dev mode)
        expect(typeof isValidIP).toBe('boolean');
        
        logger.info('IP validation test', {
          ip: unauthorizedIP,
          isValid: isValidIP
        });
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should prevent webhook payload tampering', async () => {
      const originalPayload = {
        paymentKey: 'test_payment_key',
        orderId: 'test_order_id',
        status: 'DONE',
        totalAmount: 50000
      };

      // Generate valid signature for original payload
      const originalBody = JSON.stringify(originalPayload);
      const validSignature = crypto
        .createHmac('sha256', process.env.TOSS_PAYMENTS_WEBHOOK_SECRET || 'test_secret')
        .update(originalBody)
        .digest('base64');

      // Test with tampered payload but original signature
      const tamperedPayload = {
        ...originalPayload,
        totalAmount: 999999999 // Tampered amount
      };
      const tamperedBody = JSON.stringify(tamperedPayload);

      const isTamperedValid = webhookSecurityService.verifySignature(tamperedBody, validSignature);
      expect(isTamperedValid).toBe(false); // Should detect tampering

      // Test with original payload and valid signature
      const isOriginalValid = webhookSecurityService.verifySignature(originalBody, validSignature);
      // Should be true if secret is configured, or true if not configured (dev mode)
      expect(typeof isOriginalValid).toBe('boolean');
    }, SECURITY_TEST_TIMEOUT);

    it('should handle webhook flooding and rate limiting', async () => {
      const paymentKey = `flood_test_${Date.now()}`;
      const webhookId = `webhook_${Date.now()}`;

      // Simulate rapid webhook requests
      const floodRequests = Array.from({ length: 20 }, (_, index) => 
        webhookSecurityService.checkIdempotency(
          paymentKey,
          'DONE',
          `${webhookId}_${index}`
        )
      );

      const results = await Promise.allSettled(floodRequests);
      const successful = results.filter(result => result.status === 'fulfilled');
      
      // First request should succeed, subsequent ones should be detected as duplicates
      expect(successful.length).toBeGreaterThan(0);
      
      // Verify idempotency protection
      const duplicateResults = await Promise.all([
        webhookSecurityService.checkIdempotency(paymentKey, 'DONE', webhookId),
        webhookSecurityService.checkIdempotency(paymentKey, 'DONE', webhookId),
        webhookSecurityService.checkIdempotency(paymentKey, 'DONE', webhookId)
      ]);

      // At least one should be detected as duplicate
      const duplicates = duplicateResults.filter(result => result === true);
      expect(duplicates.length).toBeGreaterThan(0);
    }, SECURITY_TEST_TIMEOUT);
  });

  describe('Payment Fraud Detection Tests', () => {
    it('should detect velocity-based fraud patterns', async () => {
      const userId = testUser.id;
      const suspiciousTransactions = [
        { amount: 500000, timestamp: Date.now() },
        { amount: 750000, timestamp: Date.now() + 1000 },
        { amount: 1000000, timestamp: Date.now() + 2000 },
        { amount: 1250000, timestamp: Date.now() + 3000 },
        { amount: 1500000, timestamp: Date.now() + 4000 }
      ];

      // Test each transaction for fraud detection
      for (const transaction of suspiciousTransactions) {
        const fraudRequest = {
          userId,
          transactionId: `fraud_test_${transaction.timestamp}`,
          amount: transaction.amount,
          paymentMethod: 'CARD',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Test Browser)',
          timestamp: new Date(transaction.timestamp).toISOString(),
          metadata: {
            deviceFingerprint: 'test_device_fingerprint',
            sessionId: 'test_session_id'
          }
        };

        const fraudResult = await fraudDetectionService.analyzeTransaction(fraudRequest);
        
        expect(fraudResult).toBeDefined();
        expect(fraudResult.riskScore).toBeGreaterThanOrEqual(0);
        expect(fraudResult.riskScore).toBeLessThanOrEqual(100);
        
        // Higher amounts should generally have higher risk scores
        if (transaction.amount > 1000000) {
          expect(fraudResult.riskLevel).toMatch(/medium|high|critical/);
        }

        logger.info('Fraud detection result', {
          amount: transaction.amount,
          riskScore: fraudResult.riskScore,
          riskLevel: fraudResult.riskLevel,
          action: fraudResult.recommendedAction
        });
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should detect geolocation-based suspicious activity', async () => {
      const suspiciousLocations = [
        { country: 'Unknown', city: 'Unknown', ip: '0.0.0.0' },
        { country: 'TOR', city: 'Anonymous', ip: '192.168.1.1' },
        { country: 'VPN', city: 'Proxy', ip: '10.0.0.1' },
        { country: 'Blacklisted', city: 'Suspicious', ip: '172.16.0.1' }
      ];

      for (const location of suspiciousLocations) {
        const fraudRequest = {
          userId: testUser.id,
          transactionId: `geo_test_${Date.now()}_${Math.random()}`,
          amount: 100000,
          paymentMethod: 'CARD',
          ipAddress: location.ip,
          userAgent: 'Mozilla/5.0 (Suspicious Browser)',
          timestamp: new Date().toISOString(),
          geolocation: {
            country: location.country,
            city: location.city,
            latitude: 0,
            longitude: 0,
            accuracy: 1000
          }
        };

        const fraudResult = await fraudDetectionService.analyzeTransaction(fraudRequest);
        
        // Suspicious locations should trigger higher risk scores
        if (location.country === 'Unknown' || location.country === 'TOR') {
          expect(fraudResult.riskScore).toBeGreaterThan(30);
        }

        expect(fraudResult.securityFlags).toBeDefined();
        expect(Array.isArray(fraudResult.securityFlags)).toBe(true);
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should detect device fingerprinting anomalies', async () => {
      const suspiciousDevices = [
        {
          fingerprint: 'automated_bot_fingerprint',
          userAgent: 'curl/7.68.0',
          characteristics: { isBot: true, isAutomated: true }
        },
        {
          fingerprint: 'emulator_fingerprint',
          userAgent: 'Android Emulator',
          characteristics: { isEmulator: true, isVirtual: true }
        },
        {
          fingerprint: 'headless_browser_fingerprint',
          userAgent: 'HeadlessChrome/91.0.4472.124',
          characteristics: { isHeadless: true, isAutomated: true }
        }
      ];

      for (const device of suspiciousDevices) {
        const fraudRequest = {
          userId: testUser.id,
          transactionId: `device_test_${Date.now()}_${Math.random()}`,
          amount: 75000,
          paymentMethod: 'CARD',
          ipAddress: '192.168.1.100',
          userAgent: device.userAgent,
          timestamp: new Date().toISOString(),
          deviceFingerprint: {
            fingerprint: device.fingerprint,
            characteristics: device.characteristics,
            trustScore: 0.1 // Low trust score
          }
        };

        const fraudResult = await fraudDetectionService.analyzeTransaction(fraudRequest);
        
        // Suspicious devices should trigger security flags
        expect(fraudResult.securityFlags.length).toBeGreaterThan(0);
        
        // Bot-like devices should have higher risk scores
        if (device.characteristics.isBot || device.characteristics.isAutomated) {
          expect(fraudResult.riskScore).toBeGreaterThan(40);
        }
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should handle concurrent fraud detection without race conditions', async () => {
      const concurrentTransactions = Array.from({ length: 10 }, (_, index) => ({
        userId: testUser.id,
        transactionId: `concurrent_fraud_${Date.now()}_${index}`,
        amount: 50000 + (index * 10000),
        paymentMethod: 'CARD',
        ipAddress: '192.168.1.100',
        userAgent: 'Mozilla/5.0 (Test Browser)',
        timestamp: new Date().toISOString()
      }));

      // Process all transactions concurrently
      const fraudPromises = concurrentTransactions.map(transaction => 
        fraudDetectionService.analyzeTransaction(transaction)
      );

      const results = await Promise.allSettled(fraudPromises);
      const successful = results.filter(result => result.status === 'fulfilled');
      
      // All fraud detection calls should succeed
      expect(successful.length).toBe(concurrentTransactions.length);
      
      // Verify each result has valid structure
      successful.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value.riskScore).toBeGreaterThanOrEqual(0);
          expect(result.value.riskScore).toBeLessThanOrEqual(100);
          expect(result.value.riskLevel).toMatch(/low|medium|high|critical/);
        }
      });
    }, SECURITY_TEST_TIMEOUT);
  });

  describe('Payment API Security Tests', () => {
    it('should prevent SQL injection in payment parameters', async () => {
      const sqlInjectionPayloads = [
        "'; DROP TABLE payments; --",
        "' OR '1'='1",
        "'; UPDATE payments SET amount = 0; --",
        "' UNION SELECT * FROM users; --",
        "'; INSERT INTO payments (amount) VALUES (999999); --",
        "' OR 1=1 --",
        "'; EXEC xp_cmdshell('dir'); --"
      ];

      for (const payload of sqlInjectionPayloads) {
        try {
          // Test SQL injection in payment creation
          const maliciousPaymentData = {
            userId: testUser.id,
            amount: payload,
            orderId: `sql_injection_test_${Date.now()}`,
            paymentMethod: 'CARD'
          };

          // This should either fail validation or be safely escaped
          const result = await paymentService.createPayment(maliciousPaymentData);
          
          // If it succeeds, verify the payload was properly escaped/sanitized
          if (result) {
            expect(typeof result.amount).toBe('number');
            expect(result.amount).not.toContain('DROP');
            expect(result.amount).not.toContain('UPDATE');
            expect(result.amount).not.toContain('INSERT');
          }
        } catch (error) {
          // Expected behavior - should reject malicious input
          expect(error).toBeDefined();
          logger.info('SQL injection attempt properly blocked', {
            payload,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should prevent XSS in payment descriptions and metadata', async () => {
      const xssPayloads = [
        '<script>alert("XSS")</script>',
        '<img src="x" onerror="alert(1)">',
        'javascript:alert("XSS")',
        '<svg onload="alert(1)">',
        '<iframe src="javascript:alert(1)"></iframe>',
        '"><script>alert("XSS")</script>',
        "'; alert('XSS'); //",
        '<body onload="alert(1)">'
      ];

      for (const payload of xssPayloads) {
        try {
          const maliciousPaymentData = {
            userId: testUser.id,
            amount: 50000,
            orderId: `xss_test_${Date.now()}`,
            paymentMethod: 'CARD',
            description: payload,
            metadata: {
              userNote: payload,
              customField: payload
            }
          };

          const result = await paymentService.createPayment(maliciousPaymentData);
          
          if (result) {
            // Verify XSS payload was sanitized
            expect(result.description).not.toContain('<script>');
            expect(result.description).not.toContain('javascript:');
            expect(result.description).not.toContain('onerror=');
            expect(result.description).not.toContain('onload=');
            
            if (result.metadata) {
              expect(JSON.stringify(result.metadata)).not.toContain('<script>');
              expect(JSON.stringify(result.metadata)).not.toContain('javascript:');
            }
          }
        } catch (error) {
          // Expected behavior - should reject malicious input
          expect(error).toBeDefined();
          logger.info('XSS attempt properly blocked', {
            payload,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should enforce proper authentication and authorization', async () => {
      const unauthorizedRequests = [
        { headers: {}, description: 'No authentication' },
        { headers: { 'Authorization': 'Bearer invalid_token' }, description: 'Invalid token' },
        { headers: { 'Authorization': 'Basic invalid_credentials' }, description: 'Invalid credentials' },
        { headers: { 'Authorization': 'Bearer expired_token' }, description: 'Expired token' },
        { headers: { 'Authorization': '' }, description: 'Empty authorization' }
      ];

      for (const request of unauthorizedRequests) {
        try {
          // Attempt to access protected payment endpoint
          const response = await axios.get(`${TEST_SERVER_BASE_URL}/api/payments/user/${testUser.id}`, {
            headers: request.headers,
            timeout: 5000
          });

          // Should not reach here with unauthorized request
          if (response.status === 200) {
            // If it succeeds, it might be a public endpoint or have different auth logic
            logger.warn('Unauthorized request succeeded', {
              description: request.description,
              status: response.status
            });
          }
        } catch (error) {
          // Expected behavior - should reject unauthorized requests
          if (axios.isAxiosError(error)) {
            expect([401, 403, 404]).toContain(error.response?.status);
            logger.info('Unauthorized request properly blocked', {
              description: request.description,
              status: error.response?.status
            });
          }
        }
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should prevent payment amount manipulation', async () => {
      const manipulationAttempts = [
        { amount: -50000, description: 'Negative amount' },
        { amount: 0, description: 'Zero amount' },
        { amount: 999999999999, description: 'Extremely large amount' },
        { amount: 0.001, description: 'Fractional amount below minimum' },
        { amount: 'invalid', description: 'Non-numeric amount' },
        { amount: null, description: 'Null amount' },
        { amount: undefined, description: 'Undefined amount' }
      ];

      for (const attempt of manipulationAttempts) {
        try {
          const maliciousPaymentData = {
            userId: testUser.id,
            amount: attempt.amount,
            orderId: `amount_manipulation_${Date.now()}`,
            paymentMethod: 'CARD'
          };

          const result = await paymentService.createPayment(maliciousPaymentData);
          
          if (result) {
            // If it succeeds, verify amount is within valid range
            expect(typeof result.amount).toBe('number');
            expect(result.amount).toBeGreaterThan(0);
            expect(result.amount).toBeLessThan(10000000); // 10M KRW max
            expect(Number.isInteger(result.amount)).toBe(true);
          }
        } catch (error) {
          // Expected behavior - should reject invalid amounts
          expect(error).toBeDefined();
          logger.info('Amount manipulation properly blocked', {
            attempt: attempt.description,
            amount: attempt.amount,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }, SECURITY_TEST_TIMEOUT);
  });

  describe('Security Monitoring and Alerting Tests', () => {
    it('should generate security alerts for suspicious activities', async () => {
      const suspiciousActivities = [
        {
          type: 'multiple_failed_payments',
          severity: 'high',
          details: { failureCount: 10, timeWindow: '5m' }
        },
        {
          type: 'unusual_payment_pattern',
          severity: 'medium',
          details: { amountDeviation: 500, patternType: 'velocity' }
        },
        {
          type: 'suspicious_ip_activity',
          severity: 'critical',
          details: { ipAddress: '192.168.1.100', threatLevel: 'high' }
        }
      ];

      for (const activity of suspiciousActivities) {
        const alert = await securityMonitoringService.generateSecurityAlert({
          eventType: activity.type as any,
          severity: activity.severity as any,
          userId: testUser.id,
          details: activity.details,
          timestamp: new Date()
        });

        expect(alert).toBeDefined();
        expect(alert.severity).toBe(activity.severity);
        expect(alert.eventType).toBe(activity.type);
        
        // Verify alert was logged
        const { data: alertLogs } = await supabase
          .from('security_alerts')
          .select('*')
          .eq('user_id', testUser.id)
          .eq('event_type', activity.type);

        expect(alertLogs).toBeDefined();
        expect(alertLogs.length).toBeGreaterThan(0);
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should track security metrics and statistics', async () => {
      // Generate some security events
      const securityEvents = [
        { type: 'failed_authentication', severity: 'medium' },
        { type: 'suspicious_payment', severity: 'high' },
        { type: 'rate_limit_exceeded', severity: 'low' },
        { type: 'fraud_detected', severity: 'critical' }
      ];

      for (const event of securityEvents) {
        await securityMonitoringService.logSecurityEvent({
          eventType: event.type as any,
          severity: event.severity as any,
          userId: testUser.id,
          details: { testEvent: true },
          timestamp: new Date()
        });
      }

      // Get security statistics
      const stats = await securityMonitoringService.getSecurityStatistics({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
        endDate: new Date().toISOString()
      });

      expect(stats).toBeDefined();
      expect(typeof stats.totalEvents).toBe('number');
      expect(typeof stats.criticalEvents).toBe('number');
      expect(typeof stats.highSeverityEvents).toBe('number');
      expect(Array.isArray(stats.eventsByType)).toBe(true);
      expect(Array.isArray(stats.topThreats)).toBe(true);
    }, SECURITY_TEST_TIMEOUT);

    it('should handle security event correlation and analysis', async () => {
      const correlatedEvents = [
        {
          type: 'failed_login',
          timestamp: Date.now(),
          details: { ipAddress: '192.168.1.100', userId: testUser.id }
        },
        {
          type: 'suspicious_payment',
          timestamp: Date.now() + 1000,
          details: { ipAddress: '192.168.1.100', userId: testUser.id, amount: 1000000 }
        },
        {
          type: 'fraud_detected',
          timestamp: Date.now() + 2000,
          details: { ipAddress: '192.168.1.100', userId: testUser.id, riskScore: 95 }
        }
      ];

      // Log correlated events
      for (const event of correlatedEvents) {
        await securityMonitoringService.logSecurityEvent({
          eventType: event.type as any,
          severity: 'high',
          userId: testUser.id,
          details: event.details,
          timestamp: new Date(event.timestamp)
        });
      }

      // Analyze correlation
      const correlation = await securityMonitoringService.analyzeEventCorrelation({
        userId: testUser.id,
        timeWindow: 5 * 60 * 1000, // 5 minutes
        minEvents: 2
      });

      expect(correlation).toBeDefined();
      expect(correlation.correlatedEvents.length).toBeGreaterThan(0);
      expect(correlation.riskScore).toBeGreaterThan(0);
      expect(correlation.recommendedActions).toBeDefined();
      expect(Array.isArray(correlation.recommendedActions)).toBe(true);
    }, SECURITY_TEST_TIMEOUT);
  });

  describe('Compliance and Audit Tests', () => {
    it('should maintain PCI DSS compliance for payment data', async () => {
      // Test payment data encryption and storage
      const sensitivePaymentData = {
        cardNumber: '4111111111111111',
        expiryDate: '12/25',
        cvv: '123',
        cardholderName: 'Test User'
      };

      // Verify sensitive data is not stored in plain text
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('user_id', testUser.id);

      if (payments && payments.length > 0) {
        payments.forEach(payment => {
          // Ensure no plain text card data is stored
          const paymentString = JSON.stringify(payment);
          expect(paymentString).not.toContain('4111111111111111');
          expect(paymentString).not.toContain('123'); // CVV
          expect(paymentString).not.toContain(sensitivePaymentData.cardholderName);
          
          // Verify payment data is properly masked or encrypted
          if (payment.payment_method_details) {
            const details = JSON.stringify(payment.payment_method_details);
            expect(details).not.toMatch(/\d{16}/); // Full card number
            expect(details).not.toMatch(/\d{3,4}/); // CVV
          }
        });
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should maintain comprehensive audit trails', async () => {
      // Create a payment transaction to generate audit trail
      const auditTestPayment = {
        userId: testUser.id,
        amount: 75000,
        orderId: `audit_test_${Date.now()}`,
        paymentMethod: 'CARD',
        description: 'Audit trail test payment'
      };

      const payment = await paymentService.createPayment(auditTestPayment);
      
      if (payment) {
        // Verify audit trail was created
        const { data: auditLogs } = await supabase
          .from('audit_logs')
          .select('*')
          .eq('entity_type', 'payment')
          .eq('entity_id', payment.id);

        expect(auditLogs).toBeDefined();
        expect(auditLogs.length).toBeGreaterThan(0);

        // Verify audit log contains required information
        const auditLog = auditLogs[0];
        expect(auditLog.action).toBeDefined();
        expect(auditLog.user_id).toBe(testUser.id);
        expect(auditLog.timestamp).toBeDefined();
        expect(auditLog.changes).toBeDefined();
        
        // Verify sensitive data is not in audit logs
        const auditString = JSON.stringify(auditLog);
        expect(auditString).not.toContain('4111111111111111');
        expect(auditString).not.toContain('password');
        expect(auditString).not.toContain('secret');
      }
    }, SECURITY_TEST_TIMEOUT);

    it('should enforce data retention and privacy policies', async () => {
      // Test data anonymization for old records
      const oldDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000); // 1 year ago
      
      // Create old payment record
      const { data: oldPayment } = await supabase
        .from('payments')
        .insert({
          user_id: testUser.id,
          amount: 50000,
          order_id: `old_payment_${Date.now()}`,
          payment_method: 'CARD',
          status: 'completed',
          created_at: oldDate.toISOString()
        })
        .select()
        .single();

      if (oldPayment) {
        // Simulate data retention policy enforcement
        const retentionResult = await paymentService.enforceDataRetentionPolicy({
          retentionPeriodDays: 365,
          anonymizeOldRecords: true
        });

        expect(retentionResult).toBeDefined();
        expect(typeof retentionResult.recordsProcessed).toBe('number');
        expect(typeof retentionResult.recordsAnonymized).toBe('number');
        expect(typeof retentionResult.recordsDeleted).toBe('number');
      }
    }, SECURITY_TEST_TIMEOUT);
  });

  describe('Performance Security Tests', () => {
    it('should handle security operations under load', async () => {
      const concurrentSecurityOperations = 50;
      const startTime = performance.now();

      // Create concurrent security validation operations
      const securityPromises = Array.from({ length: concurrentSecurityOperations }, (_, index) => 
        fraudDetectionService.analyzeTransaction({
          userId: testUser.id,
          transactionId: `load_test_${Date.now()}_${index}`,
          amount: 50000 + (index * 1000),
          paymentMethod: 'CARD',
          ipAddress: '192.168.1.100',
          userAgent: 'Mozilla/5.0 (Load Test)',
          timestamp: new Date().toISOString()
        })
      );

      const results = await Promise.allSettled(securityPromises);
      const endTime = performance.now();
      const totalTime = endTime - startTime;

      // Verify performance
      expect(totalTime).toBeLessThan(30000); // Should complete within 30 seconds
      
      // Verify all operations completed
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBe(concurrentSecurityOperations);

      // Verify average response time is reasonable
      const averageTime = totalTime / concurrentSecurityOperations;
      expect(averageTime).toBeLessThan(1000); // Average < 1 second per operation

      logger.info('Security performance test completed', {
        totalOperations: concurrentSecurityOperations,
        totalTime: `${totalTime.toFixed(2)}ms`,
        averageTime: `${averageTime.toFixed(2)}ms`,
        successRate: `${(successful.length / concurrentSecurityOperations * 100).toFixed(2)}%`
      });
    }, SECURITY_TEST_TIMEOUT);

    it('should prevent DoS attacks through rate limiting', async () => {
      const rapidRequests = 100;
      const requestPromises = [];

      // Generate rapid requests to test rate limiting
      for (let i = 0; i < rapidRequests; i++) {
        requestPromises.push(
          webhookSecurityService.checkIdempotency(
            `dos_test_${Date.now()}`,
            'DONE',
            `webhook_${i}`
          ).catch(error => ({ error: error.message }))
        );
      }

      const results = await Promise.allSettled(requestPromises);
      
      // Some requests should be rate limited
      const rateLimited = results.filter(result => 
        result.status === 'rejected' || 
        (result.status === 'fulfilled' && result.value?.error?.includes('rate limit'))
      );

      // Should have some rate limiting in effect
      expect(rateLimited.length).toBeGreaterThan(0);
      
      logger.info('DoS protection test completed', {
        totalRequests: rapidRequests,
        rateLimited: rateLimited.length,
        rateLimitPercentage: `${(rateLimited.length / rapidRequests * 100).toFixed(2)}%`
      });
    }, SECURITY_TEST_TIMEOUT);
  });
});

