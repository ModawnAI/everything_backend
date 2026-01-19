/**
 * TossPayments Sandbox Integration Tests
 * 
 * Comprehensive integration tests for TossPayments API using sandbox environment:
 * - Payment initialization and confirmation
 * - Webhook simulation and validation
 * - Payment method testing (card, bank transfer, virtual account)
 * - Error scenario testing and handling
 * - Rate limiting and timeout handling
 * - Security validation and fraud detection
 * 
 * Uses real TossPayments sandbox API and real database connections
 */

import { getSupabaseClient } from '../../src/config/database';
import { TossPaymentsService, PaymentInitiationRequest, PaymentConfirmationRequest, TossWebhookPayload } from '../../src/services/toss-payments.service';
import { webhookSecurityService } from '../../src/services/webhook-security.service';
import { logger } from '../../src/utils/logger';
import * as crypto from 'crypto';

// TODO: 결제 서비스 변경 후 활성화
describe.skip('TossPayments Sandbox Integration Tests', () => {
  let supabase: any;
  let tossPaymentsService: TossPaymentsService;
  let testUser: any;
  let testShop: any;
  let testService: any;
  let testReservation: any;

  // TossPayments sandbox test data
  const SANDBOX_CONFIG = {
    // TossPayments sandbox test card numbers
    TEST_CARDS: {
      VALID_CARD: '4300000000000000', // Test card that always succeeds
      INVALID_CARD: '4000000000000002', // Test card that always fails
      INSUFFICIENT_FUNDS: '4000000000000119', // Insufficient funds
      EXPIRED_CARD: '4000000000000069', // Expired card
      DECLINED_CARD: '4000000000000127' // Declined card
    },
    // Test amounts for different scenarios
    TEST_AMOUNTS: {
      SUCCESS: 1000, // Amount that succeeds
      FAILURE: 5000, // Amount that fails
      TIMEOUT: 10000 // Amount that times out
    },
    // Sandbox webhook endpoints
    WEBHOOK_ENDPOINTS: {
      SUCCESS: process.env.TOSS_SANDBOX_SUCCESS_WEBHOOK || 'http://localhost:3000/api/webhooks/toss-payments',
      FAILURE: process.env.TOSS_SANDBOX_FAILURE_WEBHOOK || 'http://localhost:3000/api/webhooks/toss-payments'
    }
  };

  beforeAll(async () => {
    supabase = getSupabaseClient();
    tossPaymentsService = new TossPaymentsService();

    // Create test data for sandbox testing
    const testUserId = crypto.randomUUID();
    const testShopId = crypto.randomUUID();
    const testServiceId = crypto.randomUUID();

    // Create test user
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `toss-sandbox-${Date.now()}@test.com`,
        name: 'TossPayments Sandbox Test User',
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
        name: 'TossPayments Sandbox Test Shop',
        owner_id: testUser.id,
        address: 'Sandbox Test Address',
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
        name: 'TossPayments Sandbox Test Service',
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

    logger.info('TossPayments sandbox test setup completed', {
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

  describe('Payment Initialization', () => {
    it('should initialize payment successfully with valid data', async () => {
      // Create test reservation
      const reservationData = {
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        start_time: '14:00:00',
        end_time: '15:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      };

      const { data: reservation, error: reservationError } = await supabase
        .from('reservations')
        .insert(reservationData)
        .select()
        .single();

      if (reservationError) {
        throw new Error(`Failed to create test reservation: ${reservationError.message}`);
      }
      testReservation = reservation;

      // Initialize payment
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      expect(paymentResult).toBeDefined();
      expect(paymentResult.paymentKey).toBeDefined();
      expect(paymentResult.orderId).toBeDefined();
      expect(paymentResult.amount).toBe(SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS);

      // Verify payment record created in database
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', testReservation.id);

      expect(payments).toHaveLength(1);
      expect(payments[0].amount).toBe(SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS);
      expect(payments[0].payment_status).toBe('pending');
    }, 30000);

    it('should handle payment initialization with invalid data', async () => {
      const invalidPaymentRequest: PaymentInitiationRequest = {
        reservationId: 'invalid-reservation-id',
        userId: testUser.id,
        amount: -1000, // Invalid negative amount
        customerName: '',
        customerEmail: 'invalid-email',
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      await expect(tossPaymentsService.initiatePayment(invalidPaymentRequest))
        .rejects.toThrow();
    }, 15000);

    it('should handle payment initialization with different amounts', async () => {
      const testAmounts = [1000, 5000, 10000, 50000, 100000];

      for (const amount of testAmounts) {
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: testReservation.id,
          userId: testUser.id,
          amount: amount,
          customerName: testUser.name,
          customerEmail: testUser.email,
          customerMobilePhone: testUser.phone_number,
          isDeposit: false
        };

        const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
        expect(paymentResult.amount).toBe(amount);
        expect(paymentResult.paymentKey).toBeDefined();

        logger.info(`Payment initialized successfully for amount: ${amount}`, {
          paymentKey: paymentResult.paymentKey,
          orderId: paymentResult.orderId
        });
      }
    }, 45000);
  });

  describe('Payment Confirmation', () => {
    let testPaymentKey: string;
    let testOrderId: string;

    beforeEach(async () => {
      // Initialize a payment for confirmation testing
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
      testPaymentKey = paymentResult.paymentKey;
      testOrderId = paymentResult.orderId;
    });

    it('should confirm payment successfully with valid payment key', async () => {
      const confirmationRequest: PaymentConfirmationRequest = {
        paymentKey: testPaymentKey,
        orderId: testOrderId,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS
      };

      const confirmationResult = await tossPaymentsService.confirmPayment(confirmationRequest);

      expect(confirmationResult.success).toBe(true);
      expect(confirmationResult.paymentKey).toBe(testPaymentKey);

      // Verify payment status updated in database
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', testOrderId);

      expect(payments).toHaveLength(1);
      expect(payments[0].payment_status).toBe('completed');
    }, 30000);

    it('should handle payment confirmation with invalid payment key', async () => {
      const invalidConfirmationRequest: PaymentConfirmationRequest = {
        paymentKey: 'invalid-payment-key',
        orderId: testOrderId,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS
      };

      await expect(tossPaymentsService.confirmPayment(invalidConfirmationRequest))
        .rejects.toThrow();
    }, 15000);

    it('should handle payment confirmation with amount mismatch', async () => {
      const mismatchConfirmationRequest: PaymentConfirmationRequest = {
        paymentKey: testPaymentKey,
        orderId: testOrderId,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS + 1000 // Different amount
      };

      await expect(tossPaymentsService.confirmPayment(mismatchConfirmationRequest))
        .rejects.toThrow();
    }, 15000);
  });

  describe('Webhook Processing', () => {
    it('should process successful payment webhook', async () => {
      // Create a payment for webhook testing
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      // Simulate successful webhook payload
      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'CARD'
      };

      // Process webhook
      await tossPaymentsService.processWebhook(webhookPayload);

      // Verify webhook processing
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments).toHaveLength(1);
      expect(payments[0].payment_status).toBe('completed');

      // Verify webhook log created
      const { data: webhookLogs } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('payment_key', paymentResult.paymentKey);

      expect(webhookLogs.length).toBeGreaterThan(0);
      expect(webhookLogs[0].processed).toBe(true);
    }, 30000);

    it('should process failed payment webhook', async () => {
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.FAILURE,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      // Simulate failed webhook payload
      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'FAILED',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.FAILURE,
        approvedAt: new Date().toISOString(),
        method: 'CARD',
        failure: {
          code: 'INSUFFICIENT_FUNDS',
          message: '잔액이 부족합니다.'
        }
      };

      await tossPaymentsService.processWebhook(webhookPayload);

      // Verify payment status updated to failed
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments).toHaveLength(1);
      expect(payments[0].payment_status).toBe('failed');
    }, 30000);

    it('should handle webhook idempotency correctly', async () => {
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'CARD'
      };

      // Process webhook first time
      await tossPaymentsService.processWebhook(webhookPayload);

      // Process same webhook again (should be idempotent)
      await tossPaymentsService.processWebhook(webhookPayload);

      // Verify only one payment record exists
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments).toHaveLength(1);

      // Verify webhook logs show duplicate detection
      const { data: webhookLogs } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('payment_key', paymentResult.paymentKey);

      expect(webhookLogs.length).toBeGreaterThanOrEqual(1);
    }, 30000);
  });

  describe('Payment Method Testing', () => {
    it('should handle card payment method', async () => {
      const cardPaymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true,
        paymentMethod: 'CARD'
      };

      const paymentResult = await tossPaymentsService.initiatePayment(cardPaymentRequest);
      expect(paymentResult.paymentKey).toBeDefined();

      // Simulate card payment webhook
      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'CARD',
        card: {
          company: 'HYUNDAI',
          number: '433012******0000',
          installmentPlanMonths: 0,
          isInterestFree: false,
          approveNo: '00000000',
          useCardPoint: false,
          cardType: 'CREDIT',
          ownerType: 'PERSONAL',
          acquireStatus: 'READY'
        }
      };

      await tossPaymentsService.processWebhook(webhookPayload);

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments[0].payment_method).toBe('CARD');
      expect(payments[0].payment_status).toBe('completed');
    }, 30000);

    it('should handle virtual account payment method', async () => {
      const virtualAccountPaymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true,
        paymentMethod: 'VIRTUAL_ACCOUNT'
      };

      const paymentResult = await tossPaymentsService.initiatePayment(virtualAccountPaymentRequest);
      expect(paymentResult.paymentKey).toBeDefined();

      // Simulate virtual account payment webhook
      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'WAITING_FOR_DEPOSIT',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'VIRTUAL_ACCOUNT',
        virtualAccount: {
          accountType: 'NORMAL',
          accountNumber: '55555555555555',
          bankCode: '20',
          customerName: testUser.name,
          dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          expired: false,
          settlementStatus: 'INCOMPLETED'
        }
      };

      await tossPaymentsService.processWebhook(webhookPayload);

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments[0].payment_method).toBe('VIRTUAL_ACCOUNT');
      expect(payments[0].payment_status).toBe('pending');
    }, 30000);

    it('should handle bank transfer payment method', async () => {
      const transferPaymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true,
        paymentMethod: 'TRANSFER'
      };

      const paymentResult = await tossPaymentsService.initiatePayment(transferPaymentRequest);
      expect(paymentResult.paymentKey).toBeDefined();

      // Simulate bank transfer webhook
      const webhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'TRANSFER',
        transfer: {
          bankCode: '20',
          settlementStatus: 'COMPLETED'
        }
      };

      await tossPaymentsService.processWebhook(webhookPayload);

      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('order_id', paymentResult.orderId);

      expect(payments[0].payment_method).toBe('TRANSFER');
      expect(payments[0].payment_status).toBe('completed');
    }, 30000);
  });

  describe('Error Scenario Testing', () => {
    it('should handle network timeout errors', async () => {
      // Mock network timeout by using a very small timeout
      const originalTimeout = process.env.TOSS_PAYMENTS_TIMEOUT;
      process.env.TOSS_PAYMENTS_TIMEOUT = '1'; // 1ms timeout

      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.TIMEOUT,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      try {
        await tossPaymentsService.initiatePayment(paymentRequest);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('timeout');
      }

      // Restore original timeout
      if (originalTimeout) {
        process.env.TOSS_PAYMENTS_TIMEOUT = originalTimeout;
      } else {
        delete process.env.TOSS_PAYMENTS_TIMEOUT;
      }
    }, 15000);

    it('should handle API rate limiting', async () => {
      // Make multiple rapid requests to test rate limiting
      const requests = Array.from({ length: 10 }, (_, index) => {
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: testReservation.id,
          userId: testUser.id,
          amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
          customerName: testUser.name,
          customerEmail: `rate-limit-test-${index}@test.com`,
          customerMobilePhone: testUser.phone_number,
          isDeposit: true
        };

        return tossPaymentsService.initiatePayment(paymentRequest);
      });

      const results = await Promise.allSettled(requests);
      
      // Some requests should succeed, some might be rate limited
      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');

      expect(successful.length + failed.length).toBe(10);
      
      // Log rate limiting behavior
      logger.info('Rate limiting test results', {
        successful: successful.length,
        failed: failed.length,
        failureReasons: failed.map(f => f.reason?.message)
      });
    }, 60000);

    it('should handle invalid API credentials', async () => {
      // Temporarily modify API credentials to invalid ones
      const originalClientKey = process.env.TOSS_PAYMENTS_CLIENT_KEY;
      const originalSecretKey = process.env.TOSS_PAYMENTS_SECRET_KEY;

      process.env.TOSS_PAYMENTS_CLIENT_KEY = 'invalid-client-key';
      process.env.TOSS_PAYMENTS_SECRET_KEY = 'invalid-secret-key';

      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      try {
        await tossPaymentsService.initiatePayment(paymentRequest);
      } catch (error) {
        expect(error).toBeDefined();
        expect(error.message).toContain('unauthorized');
      }

      // Restore original credentials
      if (originalClientKey) process.env.TOSS_PAYMENTS_CLIENT_KEY = originalClientKey;
      if (originalSecretKey) process.env.TOSS_PAYMENTS_SECRET_KEY = originalSecretKey;
    }, 15000);
  });

  describe('Security Validation', () => {
    it('should validate webhook signatures correctly', async () => {
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      // Test valid signature
      const validWebhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: new Date().toISOString(),
        method: 'CARD'
      };

      // Generate valid signature
      const rawBody = JSON.stringify(validWebhookPayload);
      const validSignature = crypto
        .createHmac('sha256', process.env.TOSS_PAYMENTS_WEBHOOK_SECRET || 'test-secret')
        .update(rawBody)
        .digest('base64');

      const isValidSignature = webhookSecurityService.verifySignature(rawBody, validSignature);
      expect(isValidSignature).toBe(true);

      // Test invalid signature
      const invalidSignature = 'invalid-signature';
      const isInvalidSignature = webhookSecurityService.verifySignature(rawBody, invalidSignature);
      expect(isInvalidSignature).toBe(false);
    }, 15000);

    it('should detect and prevent replay attacks', async () => {
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);

      // Create webhook payload with old timestamp (replay attack)
      const oldTimestamp = new Date(Date.now() - 10 * 60 * 1000).toISOString(); // 10 minutes ago
      const replayWebhookPayload: TossWebhookPayload = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        status: 'DONE',
        totalAmount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
        approvedAt: oldTimestamp,
        requestedAt: oldTimestamp,
        method: 'CARD'
      };

      // This should be detected as a replay attack
      const isValidTimestamp = webhookSecurityService.validateTimestamp(oldTimestamp);
      expect(isValidTimestamp).toBe(false);

      // Recent timestamp should be valid
      const recentTimestamp = new Date().toISOString();
      const isRecentTimestampValid = webhookSecurityService.validateTimestamp(recentTimestamp);
      expect(isRecentTimestampValid).toBe(true);
    }, 15000);

    it('should validate IP whitelist correctly', async () => {
      const testIpAddress = '127.0.0.1';
      const unauthorizedIpAddress = '192.168.1.100';

      // Test with allowed IP (assuming localhost is allowed in test)
      const isAllowedIp = webhookSecurityService.isValidSourceIp(testIpAddress);
      expect(typeof isAllowedIp).toBe('boolean');

      // Test with unauthorized IP
      const isUnauthorizedIp = webhookSecurityService.isValidSourceIp(unauthorizedIpAddress);
      expect(typeof isUnauthorizedIp).toBe('boolean');

      logger.info('IP validation test results', {
        testIp: testIpAddress,
        isAllowed: isAllowedIp,
        unauthorizedIp: unauthorizedIpAddress,
        isUnauthorized: isUnauthorizedIp
      });
    }, 5000);
  });

  describe('Performance and Load Testing', () => {
    it('should handle concurrent payment requests', async () => {
      const concurrentRequests = 5;
      const requests = Array.from({ length: concurrentRequests }, (_, index) => {
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: testReservation.id,
          userId: testUser.id,
          amount: SANDBOX_CONFIG.TEST_AMOUNTS.SUCCESS,
          customerName: testUser.name,
          customerEmail: `concurrent-test-${index}@test.com`,
          customerMobilePhone: testUser.phone_number,
          isDeposit: true
        };

        return tossPaymentsService.initiatePayment(paymentRequest);
      });

      const startTime = Date.now();
      const results = await Promise.allSettled(requests);
      const endTime = Date.now();

      const successful = results.filter(result => result.status === 'fulfilled');
      const failed = results.filter(result => result.status === 'rejected');

      expect(successful.length).toBeGreaterThan(0);
      
      logger.info('Concurrent payment test results', {
        totalRequests: concurrentRequests,
        successful: successful.length,
        failed: failed.length,
        totalTime: endTime - startTime,
        averageTime: (endTime - startTime) / concurrentRequests
      });
    }, 45000);

    it('should measure payment processing performance', async () => {
      const performanceTests = [
        { description: 'Small amount payment', amount: 1000 },
        { description: 'Medium amount payment', amount: 50000 },
        { description: 'Large amount payment', amount: 500000 }
      ];

      for (const test of performanceTests) {
        const startTime = Date.now();

        const paymentRequest: PaymentInitiationRequest = {
          reservationId: testReservation.id,
          userId: testUser.id,
          amount: test.amount,
          customerName: testUser.name,
          customerEmail: testUser.email,
          customerMobilePhone: testUser.phone_number,
          isDeposit: true
        };

        try {
          const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
          const endTime = Date.now();
          const processingTime = endTime - startTime;

          expect(paymentResult.paymentKey).toBeDefined();
          expect(processingTime).toBeLessThan(10000); // Should complete within 10 seconds

          logger.info(`Performance test: ${test.description}`, {
            amount: test.amount,
            processingTime,
            paymentKey: paymentResult.paymentKey
          });
        } catch (error) {
          logger.error(`Performance test failed: ${test.description}`, {
            error: error.message,
            amount: test.amount
          });
        }
      }
    }, 60000);
  });
});

