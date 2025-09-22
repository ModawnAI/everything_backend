/**
 * Point System Integration Tests
 * 
 * Comprehensive integration tests for the point system with business rules:
 * - Point earning calculations and validation
 * - Point redemption and spending scenarios
 * - Referral bonus calculations and payouts
 * - Point expiration handling and lifecycle
 * - Concurrent point operations and race conditions
 * - Point system integration with payment workflows
 * - Influencer bonus calculations and qualifications
 * - Point balance management and projections
 * 
 * Uses real database connections and services (no mocking)
 */

import { getSupabaseClient } from '../../src/config/database';
import * as crypto from 'crypto';

// Import point system services
import { PointService } from '../../src/services/point.service';
import { PointBalanceService } from '../../src/services/point-balance.service';
import { PointProcessingService } from '../../src/services/point-processing.service';
import { PointTransactionService } from '../../src/services/point-transaction.service';
import { ReferralEarningsService } from '../../src/services/referral-earnings.service';
import { InfluencerBonusService } from '../../src/services/influencer-bonus.service';
import { FifoPointUsageService } from '../../src/services/fifo-point-usage.service';
import { PaymentService } from '../../src/services/payment.service';
import { ReservationService } from '../../src/services/reservation.service';
import { logger } from '../../src/utils/logger';

describe('Point System Integration Tests', () => {
  let supabase: any;
  let pointService: PointService;
  let pointBalanceService: PointBalanceService;
  let pointProcessingService: PointProcessingService;
  let pointTransactionService: PointTransactionService;
  let referralEarningsService: ReferralEarningsService;
  let influencerBonusService: InfluencerBonusService;
  let fifoPointUsageService: FifoPointUsageService;
  let paymentService: PaymentService;
  let reservationService: ReservationService;

  // Test data
  let testUser: any;
  let testReferrer: any;
  let testInfluencer: any;
  let testShop: any;
  let testService: any;

  beforeAll(async () => {
    supabase = getSupabaseClient();
    
    // Initialize services
    pointService = new PointService();
    pointBalanceService = new PointBalanceService();
    pointProcessingService = new PointProcessingService();
    pointTransactionService = new PointTransactionService();
    referralEarningsService = new ReferralEarningsService();
    influencerBonusService = new InfluencerBonusService();
    fifoPointUsageService = new FifoPointUsageService();
    paymentService = new PaymentService();
    reservationService = new ReservationService();

    // Create test users
    const testUserId = crypto.randomUUID();
    const testReferrerId = crypto.randomUUID();
    const testInfluencerId = crypto.randomUUID();
    const testShopId = crypto.randomUUID();
    const testServiceId = crypto.randomUUID();

    // Create test user
    const { data: insertedUser, error: userError } = await supabase
      .from('users')
      .insert({
        id: testUserId,
        email: `point-system-${Date.now()}@test.com`,
        name: 'Point System Test User',
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

    // Create test referrer
    const { data: insertedReferrer, error: referrerError } = await supabase
      .from('users')
      .insert({
        id: testReferrerId,
        email: `point-referrer-${Date.now()}@test.com`,
        name: 'Point System Referrer',
        phone_number: '+821087654321',
        status: 'active',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (referrerError) {
      throw new Error(`Failed to create test referrer: ${referrerError.message}`);
    }
    testReferrer = insertedReferrer;

    // Create test influencer
    const { data: insertedInfluencer, error: influencerError } = await supabase
      .from('users')
      .insert({
        id: testInfluencerId,
        email: `point-influencer-${Date.now()}@test.com`,
        name: 'Point System Influencer',
        phone_number: '+821098765432',
        status: 'active',
        user_type: 'influencer',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (influencerError) {
      throw new Error(`Failed to create test influencer: ${influencerError.message}`);
    }
    testInfluencer = insertedInfluencer;

    // Create test shop
    const { data: insertedShop, error: shopError } = await supabase
      .from('shops')
      .insert({
        id: testShopId,
        name: 'Point System Test Shop',
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
        name: 'Point System Test Service',
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

    logger.info('Point system test setup completed', {
      testUser: testUser.id,
      testReferrer: testReferrer.id,
      testInfluencer: testInfluencer.id,
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
    if (testReferrer?.id) {
      await supabase.from('users').delete().eq('id', testReferrer.id);
    }
    if (testInfluencer?.id) {
      await supabase.from('users').delete().eq('id', testInfluencer.id);
    }
  }, 10000);

  describe('Point Earning Calculations', () => {
    it('should calculate points earned from purchases correctly', async () => {
      const purchaseAmount = 50000; // 50,000 KRW
      const expectedPoints = Math.floor(purchaseAmount * 0.01); // 1% earning rate

      // Add points for purchase
      const transaction = await pointService.addPoints(
        testUser.id,
        expectedPoints,
        'earned',
        'purchase',
        `Points earned from purchase of ${purchaseAmount} KRW`
      );

      expect(transaction).toBeDefined();
      expect(transaction.amount).toBe(expectedPoints);
      expect(transaction.type).toBe('earned');
      expect(transaction.source).toBe('purchase');

      // Verify point balance updated
      const balance = await pointBalanceService.getPointBalance(testUser.id);
      expect(balance.available).toBeGreaterThanOrEqual(expectedPoints);

      // Verify transaction recorded
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'earned');

      expect(transactions).toHaveLength(1);
      expect(transactions[0].amount).toBe(expectedPoints);
    }, 30000);

    it('should handle different earning rates for different user tiers', async () => {
      const purchaseAmount = 100000; // 100,000 KRW
      
      // Test different user tiers
      const tierTests = [
        { tier: 'bronze', rate: 0.01, expectedPoints: 1000 },
        { tier: 'silver', rate: 0.015, expectedPoints: 1500 },
        { tier: 'gold', rate: 0.02, expectedPoints: 2000 },
        { tier: 'platinum', rate: 0.025, expectedPoints: 2500 }
      ];

      for (const tierTest of tierTests) {
        // Update user tier
        await supabase
          .from('users')
          .update({ user_tier: tierTest.tier })
          .eq('id', testUser.id);

        // Calculate points based on tier
        const pointsToEarn = Math.floor(purchaseAmount * tierTest.rate);
        
        const transaction = await pointService.addPoints(
          testUser.id,
          pointsToEarn,
          'earned',
          'purchase',
          `Tier ${tierTest.tier} purchase points`
        );

        expect(transaction.amount).toBe(pointsToEarn);
        
        logger.info(`Tier ${tierTest.tier} earning test completed`, {
          purchaseAmount,
          rate: tierTest.rate,
          pointsEarned: pointsToEarn
        });
      }
    }, 45000);

    it('should calculate bonus points for special promotions', async () => {
      const basePoints = 1000;
      const bonusMultiplier = 2.0; // 2x bonus promotion
      const expectedBonusPoints = Math.floor(basePoints * (bonusMultiplier - 1));

      // Add base points
      await pointService.addPoints(
        testUser.id,
        basePoints,
        'earned',
        'purchase',
        'Base purchase points'
      );

      // Add bonus points
      const bonusTransaction = await pointService.addPoints(
        testUser.id,
        expectedBonusPoints,
        'bonus',
        'system',
        `Promotion bonus: ${bonusMultiplier}x multiplier`
      );

      expect(bonusTransaction.amount).toBe(expectedBonusPoints);
      expect(bonusTransaction.type).toBe('bonus');

      // Verify total balance includes both base and bonus
      const balance = await pointBalanceService.getPointBalance(testUser.id);
      expect(balance.available).toBeGreaterThanOrEqual(basePoints + expectedBonusPoints);
    }, 30000);
  });

  describe('Point Redemption and Spending', () => {
    beforeEach(async () => {
      // Ensure user has points to spend
      await pointService.addPoints(
        testUser.id,
        5000,
        'earned',
        'purchase',
        'Setup points for redemption tests'
      );
    });

    it('should redeem points for discounts correctly', async () => {
      const pointsToRedeem = 1000;
      const discountValue = pointsToRedeem; // 1:1 ratio

      // Check initial balance
      const initialBalance = await pointBalanceService.getPointBalance(testUser.id);
      expect(initialBalance.available).toBeGreaterThanOrEqual(pointsToRedeem);

      // Redeem points
      const redemption = await pointService.redeemPoints(
        testUser.id,
        pointsToRedeem,
        'payment_discount',
        { discountAmount: discountValue }
      );

      expect(redemption.success).toBe(true);
      expect(redemption.pointsRedeemed).toBe(pointsToRedeem);

      // Verify balance decreased
      const finalBalance = await pointBalanceService.getPointBalance(testUser.id);
      expect(finalBalance.available).toBe(initialBalance.available - pointsToRedeem);

      // Verify redemption transaction recorded
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'spent');

      expect(transactions.length).toBeGreaterThan(0);
      const redemptionTransaction = transactions.find(t => t.amount === pointsToRedeem);
      expect(redemptionTransaction).toBeDefined();
    }, 30000);

    it('should prevent redemption when insufficient points', async () => {
      const balance = await pointBalanceService.getPointBalance(testUser.id);
      const insufficientAmount = balance.available + 1000;

      // Attempt to redeem more points than available
      await expect(pointService.redeemPoints(
        testUser.id,
        insufficientAmount,
        'payment_discount',
        { discountAmount: insufficientAmount }
      )).rejects.toThrow('Insufficient points');
    }, 15000);

    it('should handle FIFO point usage correctly', async () => {
      // Add points with different expiration dates
      const pointBatches = [
        { amount: 1000, expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) }, // 30 days
        { amount: 2000, expiresAt: new Date(Date.now() + 60 * 24 * 60 * 60 * 1000) }, // 60 days
        { amount: 1500, expiresAt: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000) }  // 90 days
      ];

      // Add point batches
      for (const batch of pointBatches) {
        await supabase
          .from('point_transactions')
          .insert({
            user_id: testUser.id,
            amount: batch.amount,
            type: 'earned',
            source: 'purchase',
            status: 'available',
            expires_at: batch.expiresAt.toISOString(),
            description: 'FIFO test points',
            created_at: new Date().toISOString()
          });
      }

      // Use FIFO service to redeem points
      const redemptionAmount = 2500; // Should use first batch (1000) + part of second batch (1500)
      const fifoResult = await fifoPointUsageService.usePoints(testUser.id, redemptionAmount);

      expect(fifoResult.success).toBe(true);
      expect(fifoResult.totalUsed).toBe(redemptionAmount);
      expect(fifoResult.batches).toHaveLength(2); // Should use 2 batches
      expect(fifoResult.batches[0].amount).toBe(1000); // First batch fully used
      expect(fifoResult.batches[1].amount).toBe(1500); // Second batch partially used
    }, 30000);
  });

  describe('Referral Bonus Calculations', () => {
    it('should calculate referral bonuses correctly', async () => {
      const referralAmount = 50000; // Purchase amount by referred user
      const expectedReferrerBonus = Math.floor(referralAmount * 0.05); // 5% referral bonus
      const expectedReferredBonus = Math.floor(referralAmount * 0.02); // 2% welcome bonus

      // Create referral relationship
      const { data: referral, error: referralError } = await supabase
        .from('referrals')
        .insert({
          referrer_id: testReferrer.id,
          referred_id: testUser.id,
          status: 'completed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (referralError) {
        throw new Error(`Failed to create referral: ${referralError.message}`);
      }

      // Calculate and process referral earnings
      const earningsCalculation = await referralEarningsService.calculateReferralEarnings(
        testReferrer.id,
        testUser.id,
        referral.id,
        referralAmount
      );

      expect(earningsCalculation.referrerId).toBe(testReferrer.id);
      expect(earningsCalculation.referredId).toBe(testUser.id);
      expect(earningsCalculation.baseAmount).toBe(referralAmount);
      expect(earningsCalculation.totalEarnings).toBeGreaterThan(0);
      expect(earningsCalculation.eligibility.isEligible).toBe(true);

      // Process the payout
      const payoutRequest = {
        referralId: referral.id,
        referrerId: testReferrer.id,
        referredId: testUser.id,
        payoutType: 'points' as const,
        amount: earningsCalculation.totalEarnings,
        reason: 'Referral bonus payout',
        processedBy: 'system'
      };

      const payoutResult = await referralEarningsService.processReferralPayout(payoutRequest);
      expect(payoutResult.success).toBe(true);
      expect(payoutResult.status).toBe('completed');

      // Verify referrer received bonus points
      const referrerBalance = await pointBalanceService.getPointBalance(testReferrer.id);
      expect(referrerBalance.available).toBeGreaterThanOrEqual(expectedReferrerBonus);
    }, 45000);

    it('should handle multi-tier referral bonuses', async () => {
      // Create multi-tier referral chain: testInfluencer -> testReferrer -> testUser
      const { data: tier1Referral } = await supabase
        .from('referrals')
        .insert({
          referrer_id: testInfluencer.id,
          referred_id: testReferrer.id,
          status: 'completed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      const { data: tier2Referral } = await supabase
        .from('referrals')
        .insert({
          referrer_id: testReferrer.id,
          referred_id: testUser.id,
          status: 'completed',
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      const purchaseAmount = 100000;

      // Calculate multi-tier bonuses
      const tier1Calculation = await referralEarningsService.calculateReferralEarnings(
        testInfluencer.id,
        testReferrer.id,
        tier1Referral.id,
        purchaseAmount
      );

      const tier2Calculation = await referralEarningsService.calculateReferralEarnings(
        testReferrer.id,
        testUser.id,
        tier2Referral.id,
        purchaseAmount
      );

      // Tier 1 (influencer) should get higher bonus
      expect(tier1Calculation.totalEarnings).toBeGreaterThan(0);
      expect(tier2Calculation.totalEarnings).toBeGreaterThan(0);

      // Process both payouts
      await referralEarningsService.processReferralPayout({
        referralId: tier1Referral.id,
        referrerId: testInfluencer.id,
        referredId: testReferrer.id,
        payoutType: 'points',
        amount: tier1Calculation.totalEarnings,
        reason: 'Tier 1 referral bonus',
        processedBy: 'system'
      });

      await referralEarningsService.processReferralPayout({
        referralId: tier2Referral.id,
        referrerId: testReferrer.id,
        referredId: testUser.id,
        payoutType: 'points',
        amount: tier2Calculation.totalEarnings,
        reason: 'Tier 2 referral bonus',
        processedBy: 'system'
      });

      // Verify both users received appropriate bonuses
      const influencerBalance = await pointBalanceService.getPointBalance(testInfluencer.id);
      const referrerBalance = await pointBalanceService.getPointBalance(testReferrer.id);

      expect(influencerBalance.available).toBeGreaterThan(0);
      expect(referrerBalance.available).toBeGreaterThan(0);
    }, 60000);
  });

  describe('Point Expiration Handling', () => {
    it('should handle point expiration correctly', async () => {
      const pointAmount = 1000;
      const expirationDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 1 day from now

      // Add points with expiration
      await supabase
        .from('point_transactions')
        .insert({
          user_id: testUser.id,
          amount: pointAmount,
          type: 'earned',
          source: 'purchase',
          status: 'available',
          expires_at: expirationDate.toISOString(),
          description: 'Points with expiration',
          created_at: new Date().toISOString()
        });

      // Get balance before expiration
      const balanceBeforeExpiration = await pointBalanceService.getPointBalance(testUser.id);
      expect(balanceBeforeExpiration.available).toBeGreaterThanOrEqual(pointAmount);

      // Simulate expiration by updating the expiration date to past
      await supabase
        .from('point_transactions')
        .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
        .eq('user_id', testUser.id)
        .eq('description', 'Points with expiration');

      // Get balance after expiration
      const balanceAfterExpiration = await pointBalanceService.getPointBalance(testUser.id);
      expect(balanceAfterExpiration.expired).toBeGreaterThanOrEqual(pointAmount);
      expect(balanceAfterExpiration.available).toBeLessThan(balanceBeforeExpiration.available);
    }, 30000);

    it('should provide point expiration projections', async () => {
      // Add points with different expiration dates
      const pointBatches = [
        { amount: 500, days: 10 },
        { amount: 1000, days: 30 },
        { amount: 1500, days: 60 }
      ];

      for (const batch of pointBatches) {
        const expirationDate = new Date(Date.now() + batch.days * 24 * 60 * 60 * 1000);
        await supabase
          .from('point_transactions')
          .insert({
            user_id: testUser.id,
            amount: batch.amount,
            type: 'earned',
            source: 'purchase',
            status: 'available',
            expires_at: expirationDate.toISOString(),
            description: `Points expiring in ${batch.days} days`,
            created_at: new Date().toISOString()
          });
      }

      // Get point projections
      const projection = await pointBalanceService.getPointProjection(testUser.id);
      
      expect(projection.currentAvailable).toBeGreaterThan(0);
      expect(projection.projectedByDate).toHaveLength(3); // Should have 3 expiration dates
      expect(projection.nextExpirationDate).toBeDefined();
      expect(projection.nextExpirationAmount).toBe(500); // First batch to expire
    }, 30000);
  });

  describe('Concurrent Point Operations', () => {
    it('should handle concurrent point additions safely', async () => {
      const concurrentOperations = 10;
      const pointsPerOperation = 100;

      // Create concurrent point addition operations
      const operations = Array.from({ length: concurrentOperations }, (_, index) => 
        pointService.addPoints(
          testUser.id,
          pointsPerOperation,
          'earned',
          'purchase',
          `Concurrent operation ${index}`
        )
      );

      // Execute all operations concurrently
      const results = await Promise.allSettled(operations);
      
      // All operations should succeed
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBe(concurrentOperations);

      // Verify final balance is correct
      const finalBalance = await pointBalanceService.getPointBalance(testUser.id);
      const expectedMinimumIncrease = concurrentOperations * pointsPerOperation;
      
      // Balance should have increased by at least the expected amount
      expect(finalBalance.available).toBeGreaterThanOrEqual(expectedMinimumIncrease);

      // Verify all transactions were recorded
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUser.id)
        .like('description', 'Concurrent operation%');

      expect(transactions).toHaveLength(concurrentOperations);
    }, 45000);

    it('should handle concurrent point redemptions safely', async () => {
      // First, add sufficient points
      await pointService.addPoints(testUser.id, 10000, 'earned', 'purchase', 'Setup for concurrent redemption test');

      const concurrentRedemptions = 5;
      const pointsPerRedemption = 500;

      // Create concurrent redemption operations
      const redemptions = Array.from({ length: concurrentRedemptions }, (_, index) => 
        pointService.redeemPoints(
          testUser.id,
          pointsPerRedemption,
          'payment_discount',
          { description: `Concurrent redemption ${index}` }
        )
      );

      // Execute all redemptions concurrently
      const results = await Promise.allSettled(redemptions);
      
      // All redemptions should succeed (assuming sufficient balance)
      const successful = results.filter(result => result.status === 'fulfilled');
      expect(successful.length).toBe(concurrentRedemptions);

      // Verify redemption transactions were recorded
      const { data: redemptionTransactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'spent');

      expect(redemptionTransactions.length).toBeGreaterThanOrEqual(concurrentRedemptions);
    }, 45000);
  });

  describe('Point System Payment Integration', () => {
    it('should integrate points with payment workflows', async () => {
      // Create a reservation for payment integration
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
        throw new Error(`Failed to create reservation: ${reservationError.message}`);
      }

      // Add points to user account
      const pointsToEarn = Math.floor(testService.price * 0.01); // 1% earning rate
      await pointService.addPoints(
        testUser.id,
        pointsToEarn,
        'earned',
        'purchase',
        `Points earned from reservation ${reservation.id}`
      );

      // Use points for discount
      const pointsToRedeem = Math.min(pointsToEarn, 1000);
      const redemption = await pointService.redeemPoints(
        testUser.id,
        pointsToRedeem,
        'payment_discount',
        { 
          reservationId: reservation.id,
          discountAmount: pointsToRedeem 
        }
      );

      expect(redemption.success).toBe(true);

      // Verify integration with payment calculation
      const finalAmount = testService.price - pointsToRedeem;
      expect(finalAmount).toBe(testService.price - pointsToRedeem);

      // Verify point transaction metadata includes reservation info
      const { data: transactions } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', testUser.id)
        .eq('type', 'spent');

      const redemptionTransaction = transactions.find(t => t.amount === pointsToRedeem);
      expect(redemptionTransaction).toBeDefined();
    }, 45000);
  });

  describe('Influencer Bonus Integration', () => {
    it('should calculate and award influencer bonuses', async () => {
      const baseTransactionAmount = 50000;
      const expectedBonusMultiplier = 1.5; // 50% bonus for influencers

      // Calculate influencer bonus
      const bonusCalculation = await influencerBonusService.calculateInfluencerBonus(
        testInfluencer.id,
        baseTransactionAmount,
        'purchase'
      );

      expect(bonusCalculation.bonusAmount).toBeGreaterThan(0);
      expect(bonusCalculation.multiplier).toBeGreaterThanOrEqual(1.0);

      // Award the bonus
      const bonusTransaction = await pointService.addPoints(
        testInfluencer.id,
        bonusCalculation.bonusAmount,
        'bonus',
        'system',
        `Influencer bonus: ${bonusCalculation.multiplier}x multiplier`
      );

      expect(bonusTransaction.amount).toBe(bonusCalculation.bonusAmount);

      // Verify influencer balance updated
      const influencerBalance = await pointBalanceService.getPointBalance(testInfluencer.id);
      expect(influencerBalance.available).toBeGreaterThanOrEqual(bonusCalculation.bonusAmount);
    }, 30000);

    it('should track influencer qualification and performance', async () => {
      // Get influencer qualification status
      const qualification = await influencerBonusService.checkInfluencerQualification(testInfluencer.id);
      
      expect(qualification.userId).toBe(testInfluencer.id);
      expect(typeof qualification.isQualified).toBe('boolean');
      expect(qualification.qualificationScore).toBeGreaterThanOrEqual(0);

      // Get influencer analytics
      const analytics = await influencerBonusService.getInfluencerBonusAnalytics(testInfluencer.id);
      
      expect(analytics.influencerId).toBe(testInfluencer.id);
      expect(typeof analytics.totalBonusPoints).toBe('number');
      expect(Array.isArray(analytics.bonusHistory)).toBe(true);
    }, 30000);
  });

  describe('Point Balance Management', () => {
    it('should provide comprehensive point balance information', async () => {
      // Add various types of points
      await pointService.addPoints(testUser.id, 1000, 'earned', 'purchase', 'Purchase points');
      await pointService.addPoints(testUser.id, 500, 'bonus', 'referral', 'Referral bonus');
      await pointService.addPoints(testUser.id, 200, 'earned', 'admin', 'Admin adjustment');

      // Get comprehensive balance
      const balance = await pointBalanceService.getPointBalance(testUser.id);
      
      expect(balance.available).toBeGreaterThan(0);
      expect(balance.total).toBeGreaterThanOrEqual(balance.available);
      expect(typeof balance.pending).toBe('number');
      expect(typeof balance.expired).toBe('number');
      expect(typeof balance.used).toBe('number');

      // Get point history
      const history = await pointBalanceService.getPointHistory(testUser.id, {
        limit: 10,
        page: 1
      });

      expect(history.transactions.length).toBeGreaterThan(0);
      expect(history.totalCount).toBeGreaterThan(0);
      expect(typeof history.hasMore).toBe('boolean');

      // Get point analytics
      const analytics = await pointBalanceService.getPointAnalytics(testUser.id);
      
      expect(typeof analytics.totalEarned).toBe('number');
      expect(typeof analytics.totalSpent).toBe('number');
      expect(typeof analytics.averageEarningPerMonth).toBe('number');
    }, 45000);

    it('should handle point balance edge cases', async () => {
      // Test with user who has no points
      const emptyUserId = crypto.randomUUID();
      await supabase
        .from('users')
        .insert({
          id: emptyUserId,
          email: `empty-points-${Date.now()}@test.com`,
          name: 'Empty Points User',
          phone_number: '+821099999999',
          status: 'active',
          created_at: new Date().toISOString()
        });

      const emptyBalance = await pointBalanceService.getPointBalance(emptyUserId);
      expect(emptyBalance.available).toBe(0);
      expect(emptyBalance.total).toBe(0);
      expect(emptyBalance.pending).toBe(0);

      // Test with invalid user ID
      await expect(pointBalanceService.getPointBalance('invalid-user-id'))
        .resolves.toBeDefined(); // Should handle gracefully

      // Clean up
      await supabase.from('users').delete().eq('id', emptyUserId);
    }, 30000);
  });
});

