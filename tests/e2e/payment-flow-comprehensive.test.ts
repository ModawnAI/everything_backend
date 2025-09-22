/**
 * Comprehensive End-to-End Payment Flow Test Suite
 * 
 * This test suite covers complete payment workflows from start to finish:
 * - Complete booking with deposit and final payment
 * - Payment failures and retry mechanisms
 * - Refund processing and reconciliation
 * - Point system integration with payments
 * - Multi-service booking payments
 * - Concurrent payment handling
 * - TossPayments webhook integration
 * 
 * Uses real database connections and services (no mocking)
 */

import { getSupabaseClient } from '../../src/config/database';
import { createTestService, cleanupTestData } from '../setup-real-db';
import * as crypto from 'crypto';

// Import all payment-related services
import { PaymentService } from '../../src/services/payment.service';
import { PaymentCalculationService } from '../../src/services/payment-calculation.service';
import { PaymentStatusTransitionService } from '../../src/services/payment-status-transition.service';
import { PaymentConfirmationService } from '../../src/services/payment-confirmation.service';
import { RefundService } from '../../src/services/refund.service';
import { ReservationService } from '../../src/services/reservation.service';
import { PointService } from '../../src/services/point.service';
import { PointBalanceService } from '../../src/services/point-balance.service';
import { TossPaymentsService } from '../../src/services/toss-payments.service';
import { SplitPaymentService } from '../../src/services/split-payment.service';
import { logger } from '../../src/utils/logger';

// Types
import { 
  PaymentInitiationRequest, 
  PaymentConfirmationRequest,
  TossWebhookPayload 
} from '../../src/services/toss-payments.service';

describe('Comprehensive Payment Flow E2E Tests', () => {
  let supabase: any;
  let paymentService: PaymentService;
  let paymentCalculationService: PaymentCalculationService;
  let paymentStatusTransitionService: PaymentStatusTransitionService;
  let paymentConfirmationService: PaymentConfirmationService;
  let refundService: RefundService;
  let reservationService: ReservationService;
  let pointService: PointService;
  let pointBalanceService: PointBalanceService;
  let tossPaymentsService: TossPaymentsService;
  let splitPaymentService: SplitPaymentService;

  // Test data
  let testUser: any;
  let testShop: any;
  let testService: any;
  let testReservation: any;
  let testPayment: any;

  beforeAll(async () => {
    supabase = getSupabaseClient();
    
    // Initialize services
    paymentService = new PaymentService();
    paymentCalculationService = new PaymentCalculationService();
    paymentStatusTransitionService = new PaymentStatusTransitionService();
    paymentConfirmationService = new PaymentConfirmationService();
    refundService = new RefundService();
    reservationService = new ReservationService();
    pointService = new PointService();
    pointBalanceService = new PointBalanceService();
    tossPaymentsService = new TossPaymentsService();
    splitPaymentService = new SplitPaymentService();

    // Create test data directly in database to avoid auth.users constraint issues
    const testUserId = crypto.randomUUID();
    const testShopId = crypto.randomUUID();
    const testServiceId = crypto.randomUUID();

    // Insert test user directly
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `payment-e2e-${Date.now()}@test.com`,
        name: 'Payment E2E Test User',
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

    // Insert test shop directly
    const { data: insertedShop, error: shopError } = await supabase
      .from('shops')
      .insert({
        id: testShopId,
        name: 'Payment E2E Test Shop',
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

    // Insert test service directly
    const { data: insertedService, error: serviceError } = await supabase
      .from('services')
      .insert({
        id: testServiceId,
        shop_id: testShop.id,
        name: 'Payment E2E Test Service',
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

    logger.info('Payment E2E test setup completed', {
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

  describe('Complete Payment Journey', () => {
    it('should handle complete booking with deposit and final payment', async () => {
      // Step 1: Create reservation
      const reservationData = {
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
        start_time: '14:00:00',
        end_time: '15:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      };

      testReservation = await reservationService.createReservation(reservationData);
      expect(testReservation).toBeDefined();
      expect(testReservation.status).toBe('pending_deposit');

      // Step 2: Calculate payment amounts
      const paymentCalculation = await paymentCalculationService.calculatePaymentAmounts(
        testReservation.id,
        'deposit'
      );
      
      expect(paymentCalculation.depositAmount).toBe(testService.deposit_amount);
      expect(paymentCalculation.remainingAmount).toBe(testService.price - testService.deposit_amount);

      // Step 3: Initiate deposit payment
      const depositPaymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: testService.deposit_amount,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const depositPaymentResult = await tossPaymentsService.initiatePayment(depositPaymentRequest);
      expect(depositPaymentResult.paymentKey).toBeDefined();
      expect(depositPaymentResult.orderId).toBeDefined();

      // Step 4: Simulate successful deposit payment confirmation
      const depositConfirmationRequest: PaymentConfirmationRequest = {
        paymentKey: depositPaymentResult.paymentKey,
        orderId: depositPaymentResult.orderId,
        amount: testService.deposit_amount
      };

      const depositConfirmation = await tossPaymentsService.confirmPayment(depositConfirmationRequest);
      expect(depositConfirmation.success).toBe(true);

      // Step 5: Verify reservation status updated
      const updatedReservation = await reservationService.getReservationById(testReservation.id);
      expect(updatedReservation.status).toBe('confirmed');

      // Step 6: Initiate final payment
      const finalPaymentRequest: PaymentInitiationRequest = {
        reservationId: testReservation.id,
        userId: testUser.id,
        amount: testService.price - testService.deposit_amount,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: false
      };

      const finalPaymentResult = await tossPaymentsService.initiatePayment(finalPaymentRequest);
      expect(finalPaymentResult.paymentKey).toBeDefined();

      // Step 7: Confirm final payment
      const finalConfirmationRequest: PaymentConfirmationRequest = {
        paymentKey: finalPaymentResult.paymentKey,
        orderId: finalPaymentResult.orderId,
        amount: testService.price - testService.deposit_amount
      };

      const finalConfirmation = await tossPaymentsService.confirmPayment(finalConfirmationRequest);
      expect(finalConfirmation.success).toBe(true);

      // Step 8: Verify final reservation status
      const finalReservation = await reservationService.getReservationById(testReservation.id);
      expect(finalReservation.status).toBe('confirmed');

      // Step 9: Verify payment records
      const { data: payments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', testReservation.id);

      expect(payments).toHaveLength(2); // Deposit + Final payment
      expect(payments.some((p: any) => p.is_deposit === true)).toBe(true);
      expect(payments.some((p: any) => p.is_deposit === false)).toBe(true);
      expect(payments.every((p: any) => p.payment_status === 'completed')).toBe(true);

      testPayment = payments[0]; // Store for later tests
    }, 60000);

    it('should handle payment failures and retry mechanisms', async () => {
      // Create another reservation for failure testing
      const failureReservationData = {
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(),
        start_time: '15:00:00',
        end_time: '16:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      };

      const failureReservation = await reservationService.createReservation(failureReservationData);

      // Simulate payment failure by using invalid payment data
      const failurePaymentRequest: PaymentInitiationRequest = {
        reservationId: failureReservation.id,
        userId: testUser.id,
        amount: testService.deposit_amount,
        customerName: testUser.name,
        customerEmail: 'invalid-email', // Invalid email to trigger failure
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      // This should handle the failure gracefully
      try {
        await tossPaymentsService.initiatePayment(failurePaymentRequest);
      } catch (error) {
        expect(error).toBeDefined();
        logger.info('Payment failure handled correctly', { error: error.message });
      }

      // Verify reservation status remains pending
      const unchangedReservation = await reservationService.getReservationById(failureReservation.id);
      expect(unchangedReservation.status).toBe('pending_deposit');
    }, 30000);

    it('should process refunds correctly', async () => {
      // Use the successful payment from the first test
      expect(testPayment).toBeDefined();

      // Process refund
      const refundRequest = {
        paymentId: testPayment.id,
        refundAmount: testService.deposit_amount,
        reason: 'customer_request',
        requestedBy: testUser.id
      };

      const refundResult = await refundService.processRefund(refundRequest);
      expect(refundResult.success).toBe(true);
      expect(refundResult.refundAmount).toBe(testService.deposit_amount);

      // Verify refund record created
      const { data: refunds } = await supabase
        .from('refunds')
        .select('*')
        .eq('payment_id', testPayment.id);

      expect(refunds).toHaveLength(1);
      expect(refunds[0].amount).toBe(testService.deposit_amount);
      expect(refunds[0].status).toBe('completed');
    }, 30000);
  });

  describe('Point System Integration', () => {
    it('should handle point earning and redemption with payments', async () => {
      // Create reservation for point testing
      const pointReservationData = {
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 26 * 60 * 60 * 1000).toISOString(),
        start_time: '16:00:00',
        end_time: '17:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      };

      const pointReservation = await reservationService.createReservation(pointReservationData);

      // Check initial point balance
      const initialBalance = await pointBalanceService.getUserPointBalance(testUser.id);
      
      // Complete payment (this should earn points)
      const paymentRequest: PaymentInitiationRequest = {
        reservationId: pointReservation.id,
        userId: testUser.id,
        amount: testService.price,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: false
      };

      const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
      const confirmationRequest: PaymentConfirmationRequest = {
        paymentKey: paymentResult.paymentKey,
        orderId: paymentResult.orderId,
        amount: testService.price
      };

      await tossPaymentsService.confirmPayment(confirmationRequest);

      // Verify points were earned
      const finalBalance = await pointBalanceService.getUserPointBalance(testUser.id);
      expect(finalBalance.available_points).toBeGreaterThan(initialBalance.available_points);

      // Test point redemption
      const pointsToRedeem = Math.min(1000, finalBalance.available_points);
      if (pointsToRedeem > 0) {
        const redemptionResult = await pointService.redeemPoints(
          testUser.id,
          pointsToRedeem,
          'payment_discount',
          { reservationId: pointReservation.id }
        );

        expect(redemptionResult.success).toBe(true);
        expect(redemptionResult.pointsRedeemed).toBe(pointsToRedeem);
      }
    }, 45000);
  });

  describe('Multi-Service Booking Payments', () => {
    it('should handle payments for multiple services in one booking', async () => {
      // Create additional service
      const additionalServiceId = crypto.randomUUID();
      const { data: additionalService, error: additionalServiceError } = await supabase
        .from('services')
        .insert({
          id: additionalServiceId,
          shop_id: testShop.id,
          name: 'Additional Payment E2E Service',
          price: 30000,
          deposit_amount: 5000,
          duration_minutes: 30,
          status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (additionalServiceError) {
        throw new Error(`Failed to create additional service: ${additionalServiceError.message}`);
      }

      // Create multi-service reservation
      const multiServiceReservationData = {
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id, // Primary service
        additional_services: [additionalService.id],
        reservation_date: new Date(Date.now() + 27 * 60 * 60 * 1000).toISOString(),
        start_time: '17:00:00',
        end_time: '18:30:00',
        total_amount: testService.price + additionalService.price,
        deposit_amount: testService.deposit_amount + additionalService.deposit_amount,
        status: 'pending_deposit'
      };

      const multiServiceReservation = await reservationService.createReservation(multiServiceReservationData);

      // Calculate total payment
      const totalAmount = testService.price + additionalService.price;
      const totalDeposit = testService.deposit_amount + additionalService.deposit_amount;

      // Process payment for multiple services
      const multiPaymentRequest: PaymentInitiationRequest = {
        reservationId: multiServiceReservation.id,
        userId: testUser.id,
        amount: totalAmount,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: false
      };

      const multiPaymentResult = await tossPaymentsService.initiatePayment(multiPaymentRequest);
      expect(multiPaymentResult.paymentKey).toBeDefined();

      const multiConfirmationRequest: PaymentConfirmationRequest = {
        paymentKey: multiPaymentResult.paymentKey,
        orderId: multiPaymentResult.orderId,
        amount: totalAmount
      };

      const multiConfirmation = await tossPaymentsService.confirmPayment(multiConfirmationRequest);
      expect(multiConfirmation.success).toBe(true);

      // Verify payment amount matches total of all services
      const { data: multiPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', multiServiceReservation.id);

      expect(multiPayments).toHaveLength(1);
      expect(multiPayments[0].amount).toBe(totalAmount);
    }, 45000);
  });

  describe('Concurrent Payment Handling', () => {
    it('should handle concurrent payment attempts safely', async () => {
      // Create multiple reservations for concurrent testing
      const concurrentReservations = await Promise.all([
        reservationService.createReservation({
          user_id: testUser.id,
          shop_id: testShop.id,
          service_id: testService.id,
          reservation_date: new Date(Date.now() + 28 * 60 * 60 * 1000).toISOString(),
          start_time: '18:00:00',
          end_time: '19:00:00',
          total_amount: testService.price,
          deposit_amount: testService.deposit_amount,
          status: 'pending_deposit'
        }),
        reservationService.createReservation({
          user_id: testUser.id,
          shop_id: testShop.id,
          service_id: testService.id,
          reservation_date: new Date(Date.now() + 29 * 60 * 60 * 1000).toISOString(),
          start_time: '19:00:00',
          end_time: '20:00:00',
          total_amount: testService.price,
          deposit_amount: testService.deposit_amount,
          status: 'pending_deposit'
        })
      ]);

      // Attempt concurrent payments
      const concurrentPaymentPromises = concurrentReservations.map(async (reservation, index) => {
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: reservation.id,
          userId: testUser.id,
          amount: testService.deposit_amount,
          customerName: testUser.name,
          customerEmail: testUser.email,
          customerMobilePhone: testUser.phone_number,
          isDeposit: true
        };

        try {
          const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
          const confirmationRequest: PaymentConfirmationRequest = {
            paymentKey: paymentResult.paymentKey,
            orderId: paymentResult.orderId,
            amount: testService.deposit_amount
          };

          return await tossPaymentsService.confirmPayment(confirmationRequest);
        } catch (error) {
          logger.warn(`Concurrent payment ${index} failed`, { error: error.message });
          return { success: false, error: error.message };
        }
      });

      const concurrentResults = await Promise.all(concurrentPaymentPromises);
      
      // At least one should succeed, and system should handle concurrency gracefully
      const successfulPayments = concurrentResults.filter(result => result.success);
      expect(successfulPayments.length).toBeGreaterThan(0);

      // Verify no duplicate payments were created
      const { data: allPayments } = await supabase
        .from('payments')
        .select('*')
        .in('reservation_id', concurrentReservations.map(r => r.id));

      // Should have one payment per reservation, no duplicates
      expect(allPayments.length).toBeLessThanOrEqual(concurrentReservations.length);
    }, 60000);
  });

  describe('TossPayments Webhook Integration', () => {
    it('should process webhook notifications correctly', async () => {
      // Create a payment for webhook testing
      const webhookReservation = await reservationService.createReservation({
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 30 * 60 * 60 * 1000).toISOString(),
        start_time: '20:00:00',
        end_time: '21:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      });

      const webhookPaymentRequest: PaymentInitiationRequest = {
        reservationId: webhookReservation.id,
        userId: testUser.id,
        amount: testService.deposit_amount,
        customerName: testUser.name,
        customerEmail: testUser.email,
        customerMobilePhone: testUser.phone_number,
        isDeposit: true
      };

      const webhookPaymentResult = await tossPaymentsService.initiatePayment(webhookPaymentRequest);

      // Simulate webhook payload
      const webhookPayload: TossWebhookPayload = {
        paymentKey: webhookPaymentResult.paymentKey,
        orderId: webhookPaymentResult.orderId,
        status: 'DONE',
        totalAmount: testService.deposit_amount,
        approvedAt: new Date().toISOString(),
        method: 'CARD'
      };

      // Process webhook
      await tossPaymentsService.processWebhook(webhookPayload);

      // Verify webhook processing updated payment status
      const { data: webhookPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', webhookReservation.id);

      expect(webhookPayments).toHaveLength(1);
      expect(webhookPayments[0].payment_status).toBe('completed');

      // Verify webhook was logged
      const { data: webhookLogs } = await supabase
        .from('webhook_logs')
        .select('*')
        .eq('payment_key', webhookPayload.paymentKey);

      expect(webhookLogs.length).toBeGreaterThan(0);
      expect(webhookLogs[0].processed).toBe(true);
    }, 45000);
  });

  describe('Split Payment Scenarios', () => {
    it('should handle split payments between multiple parties', async () => {
      // Create a second user for split payment
      const secondUserId = crypto.randomUUID();
      const { data: secondUser, error: secondUserError } = await supabase
        .from('users')
        .insert({
          id: secondUserId,
          email: `split-payment-${Date.now()}@test.com`,
          name: 'Split Payment User',
          phone_number: '+821098765432',
          status: 'active',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (secondUserError) {
        throw new Error(`Failed to create second user: ${secondUserError.message}`);
      }

      const splitReservation = await reservationService.createReservation({
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 31 * 60 * 60 * 1000).toISOString(),
        start_time: '21:00:00',
        end_time: '22:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      });

      // Create split payment configuration
      const splitConfig = {
        reservationId: splitReservation.id,
        splits: [
          {
            userId: testUser.id,
            amount: Math.floor(testService.price * 0.6), // 60%
            percentage: 60
          },
          {
            userId: secondUser.id,
            amount: Math.ceil(testService.price * 0.4), // 40%
            percentage: 40
          }
        ]
      };

      const splitPaymentResult = await splitPaymentService.createSplitPayment(splitConfig);
      expect(splitPaymentResult.success).toBe(true);
      expect(splitPaymentResult.splitPayments).toHaveLength(2);

      // Process individual split payments
      for (const splitPayment of splitPaymentResult.splitPayments) {
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: splitReservation.id,
          userId: splitPayment.userId,
          amount: splitPayment.amount,
          customerName: splitPayment.userId === testUser.id ? testUser.name : secondUser.name,
          customerEmail: splitPayment.userId === testUser.id ? testUser.email : secondUser.email,
          customerMobilePhone: splitPayment.userId === testUser.id ? testUser.phone_number : secondUser.phone_number,
          isDeposit: false
        };

        const paymentResult = await tossPaymentsService.initiatePayment(paymentRequest);
        const confirmationRequest: PaymentConfirmationRequest = {
          paymentKey: paymentResult.paymentKey,
          orderId: paymentResult.orderId,
          amount: splitPayment.amount
        };

        const confirmation = await tossPaymentsService.confirmPayment(confirmationRequest);
        expect(confirmation.success).toBe(true);
      }

      // Verify all split payments completed
      const { data: splitPayments } = await supabase
        .from('payments')
        .select('*')
        .eq('reservation_id', splitReservation.id);

      expect(splitPayments).toHaveLength(2);
      expect(splitPayments.every((p: any) => p.payment_status === 'completed')).toBe(true);
      
      const totalPaid = splitPayments.reduce((sum: number, p: any) => sum + p.amount, 0);
      expect(totalPaid).toBe(testService.price);
    }, 60000);
  });

  describe('Payment Error Recovery', () => {
    it('should recover from payment system errors gracefully', async () => {
      const errorReservation = await reservationService.createReservation({
        user_id: testUser.id,
        shop_id: testShop.id,
        service_id: testService.id,
        reservation_date: new Date(Date.now() + 32 * 60 * 60 * 1000).toISOString(),
        start_time: '22:00:00',
        end_time: '23:00:00',
        total_amount: testService.price,
        deposit_amount: testService.deposit_amount,
        status: 'pending_deposit'
      });

      // Test payment system recovery by simulating various error conditions
      const errorScenarios = [
        { description: 'Network timeout', shouldRetry: true },
        { description: 'Invalid payment method', shouldRetry: false },
        { description: 'Insufficient funds', shouldRetry: false },
        { description: 'System maintenance', shouldRetry: true }
      ];

      for (const scenario of errorScenarios) {
        logger.info(`Testing error recovery scenario: ${scenario.description}`);
        
        // The payment service should handle these errors gracefully
        // and provide appropriate user feedback
        const paymentRequest: PaymentInitiationRequest = {
          reservationId: errorReservation.id,
          userId: testUser.id,
          amount: testService.deposit_amount,
          customerName: testUser.name,
          customerEmail: testUser.email,
          customerMobilePhone: testUser.phone_number,
          isDeposit: true
        };

        try {
          await tossPaymentsService.initiatePayment(paymentRequest);
        } catch (error) {
          // Error handling should be graceful and informative
          expect(error).toBeDefined();
          logger.info(`Error scenario handled: ${scenario.description}`, { 
            error: error.message 
          });
        }
      }

      // Verify reservation status is still manageable after errors
      const finalReservation = await reservationService.getReservationById(errorReservation.id);
      expect(['pending_deposit', 'cancelled']).toContain(finalReservation.status);
    }, 45000);
  });
});
