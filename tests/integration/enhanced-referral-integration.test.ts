/**
 * Enhanced Referral System Integration Tests
 * 
 * Tests the complete referral reward calculation system with real database connections:
 * - Fair referral rewards based on original payment amounts (10% of base points)
 * - Automatic influencer qualification logic (50 successful referrals)
 * - Referral chain validation to prevent circular references
 * - Referral code generation and validation with collision prevention
 * - End-to-end referral processing workflows
 */

import { createClient } from '@supabase/supabase-js';
import { enhancedReferralService } from '../../src/services/enhanced-referral.service';
import { referralService } from '../../src/services/referral.service';
import { pointService } from '../../src/services/point.service';

// Test configuration
const testConfig = {
  supabaseUrl: process.env.SUPABASE_URL!,
  supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
};

describe('Enhanced Referral System Integration Tests', () => {
  let supabase: any;
  let testUsers: any[] = [];
  let testReferrals: any[] = [];
  let testCodes: any[] = [];

  beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(testConfig.supabaseUrl, testConfig.supabaseServiceKey);

    // Create test users
    const testUserData = [
      {
        id: crypto.randomUUID(),
        name: 'Test Referrer',
        email: `referrer-${Date.now()}@test.com`,
        phone_number: '+821012345001',
        is_influencer: false,
        total_referrals: 0,
        successful_referrals: 0
      },
      {
        id: crypto.randomUUID(),
        name: 'Test Referred User 1',
        email: `referred1-${Date.now()}@test.com`,
        phone_number: '+821012345002',
        is_influencer: false,
        total_referrals: 0,
        successful_referrals: 0
      },
      {
        id: crypto.randomUUID(),
        name: 'Test Referred User 2',
        email: `referred2-${Date.now()}@test.com`,
        phone_number: '+821012345003',
        is_influencer: false,
        total_referrals: 0,
        successful_referrals: 0
      },
      {
        id: crypto.randomUUID(),
        name: 'Test Influencer Candidate',
        email: `influencer-${Date.now()}@test.com`,
        phone_number: '+821012345004',
        is_influencer: false,
        total_referrals: 49,
        successful_referrals: 49
      }
    ];

    for (const userData of testUserData) {
      const { data: user, error } = await supabase
        .from('users')
        .insert(userData)
        .select()
        .single();

      if (error) {
        console.error('Failed to create test user:', error);
        throw error;
      }

      testUsers.push(user);
    }

    // Create initial point balances for test users
    for (const user of testUsers) {
      await supabase
        .from('point_balances')
        .insert({
          user_id: user.id,
          total_earned: 0,
          total_used: 0,
          available_balance: 0,
          pending_balance: 0,
          last_calculated_at: new Date().toISOString()
        });
    }
  });

  afterAll(async () => {
    // Clean up test data
    if (testCodes.length > 0) {
      await supabase
        .from('referral_codes')
        .delete()
        .in('id', testCodes.map(c => c.id));
    }

    if (testReferrals.length > 0) {
      await supabase
        .from('referrals')
        .delete()
        .in('id', testReferrals.map(r => r.id));
    }

    // Clean up point transactions
    await supabase
      .from('point_transactions')
      .delete()
      .in('user_id', testUsers.map(u => u.id));

    // Clean up point balances
    await supabase
      .from('point_balances')
      .delete()
      .in('user_id', testUsers.map(u => u.id));

    // Clean up influencer promotions
    await supabase
      .from('influencer_promotions')
      .delete()
      .in('user_id', testUsers.map(u => u.id));

    // Clean up test users
    await supabase
      .from('users')
      .delete()
      .in('id', testUsers.map(u => u.id));
  });

  describe('Referral Reward Calculation', () => {
    it('should calculate correct referral rewards based on original payment amounts', async () => {
      const [referrer, referred] = testUsers;
      const originalPaymentAmount = 200000; // 200,000 KRW

      const calculation = await enhancedReferralService.calculateReferralReward(
        referrer.id,
        referred.id,
        originalPaymentAmount
      );

      // Expected: 200,000 * 0.025 = 5,000 base points
      // Referral reward: 5,000 * 0.10 = 500 points
      expect(calculation.originalPaymentAmount).toBe(200000);
      expect(calculation.basePointsEarned).toBe(5000);
      expect(calculation.referralRewardAmount).toBe(500);
      expect(calculation.referralPercentage).toBe(0.10);
      expect(calculation.calculation.beforeInfluencerMultiplier).toBe(true);
    });

    it('should handle payment amounts exceeding the cap', async () => {
      const [referrer, referred] = testUsers;
      const originalPaymentAmount = 500000; // 500,000 KRW (exceeds 300,000 cap)

      const calculation = await enhancedReferralService.calculateReferralReward(
        referrer.id,
        referred.id,
        originalPaymentAmount
      );

      // Expected: 300,000 * 0.025 = 7,500 base points (capped)
      // Referral reward: 7,500 * 0.10 = 750 points
      expect(calculation.basePointsEarned).toBe(7500);
      expect(calculation.referralRewardAmount).toBe(750);
    });
  });

  describe('Referral Chain Validation', () => {
    it('should validate simple referral chains', async () => {
      const [user1, user2, user3] = testUsers;

      // Create a simple chain: user1 -> user2 -> user3
      const referral1 = await supabase
        .from('referrals')
        .insert({
          referrer_id: user1.id,
          referred_id: user2.id,
          referral_code: 'TEST001',
          status: 'completed',
          bonus_amount: 1000,
          bonus_paid: true
        })
        .select()
        .single();

      testReferrals.push(referral1.data);

      const validation = await enhancedReferralService.validateReferralChain(
        user2.id,
        user3.id
      );

      expect(validation.isValid).toBe(true);
      expect(validation.hasCircularReference).toBe(false);
      expect(validation.chainDepth).toBeGreaterThanOrEqual(0);
      expect(validation.violations).toHaveLength(0);
    });

    it('should detect and prevent circular references', async () => {
      const [user1, user2] = testUsers;

      // Create a referral: user1 -> user2
      const referral = await supabase
        .from('referrals')
        .insert({
          referrer_id: user1.id,
          referred_id: user2.id,
          referral_code: 'TEST002',
          status: 'completed',
          bonus_amount: 1000,
          bonus_paid: true
        })
        .select()
        .single();

      testReferrals.push(referral.data);

      // Try to create reverse referral: user2 -> user1 (would create circular reference)
      const validation = await enhancedReferralService.validateReferralChain(
        user2.id,
        user1.id
      );

      expect(validation.isValid).toBe(false);
      expect(validation.hasCircularReference).toBe(true);
      expect(validation.violations.length).toBeGreaterThan(0);
    });
  });

  describe('Referral Code Generation', () => {
    it('should generate unique referral codes', async () => {
      const [user] = testUsers;

      const codeGeneration = await enhancedReferralService.generateReferralCode(user.id);

      expect(codeGeneration.code).toHaveLength(8);
      expect(codeGeneration.isUnique).toBe(true);
      expect(codeGeneration.attempts).toBeGreaterThanOrEqual(1);
      expect(codeGeneration.generatedAt).toBeDefined();
      expect(codeGeneration.expiresAt).toBeDefined();

      // Verify code was stored in database
      const { data: storedCode, error } = await supabase
        .from('referral_codes')
        .select('*')
        .eq('code', codeGeneration.code)
        .single();

      expect(error).toBeNull();
      expect(storedCode.user_id).toBe(user.id);
      expect(storedCode.is_active).toBe(true);

      testCodes.push(storedCode);
    });

    it('should handle code collisions gracefully', async () => {
      const [user1, user2] = testUsers;

      // Generate first code
      const firstCode = await enhancedReferralService.generateReferralCode(user1.id);
      testCodes.push(await supabase.from('referral_codes').select('*').eq('code', firstCode.code).single().then(r => r.data));

      // Generate second code (should be different)
      const secondCode = await enhancedReferralService.generateReferralCode(user2.id);
      testCodes.push(await supabase.from('referral_codes').select('*').eq('code', secondCode.code).single().then(r => r.data));

      expect(firstCode.code).not.toBe(secondCode.code);
      expect(firstCode.isUnique).toBe(true);
      expect(secondCode.isUnique).toBe(true);
    });
  });

  describe('Influencer Qualification', () => {
    it('should promote user to influencer when reaching 50 successful referrals', async () => {
      const influencerCandidate = testUsers.find(u => u.total_referrals === 49);
      
      // Create 50 successful referrals for the candidate
      const referralPromises = [];
      for (let i = 0; i < 50; i++) {
        const referredUser = {
          id: crypto.randomUUID(),
          name: `Referred User ${i}`,
          email: `referred${i}-${Date.now()}@test.com`,
          phone_number: `+82101234${String(i).padStart(4, '0')}`
        };

        // Create referred user
        await supabase.from('users').insert(referredUser);

        // Create successful referral
        const referralPromise = supabase
          .from('referrals')
          .insert({
            referrer_id: influencerCandidate.id,
            referred_id: referredUser.id,
            referral_code: `PROMO${i}`,
            status: 'completed',
            bonus_amount: 1000,
            bonus_paid: true
          })
          .select()
          .single();

        referralPromises.push(referralPromise);
      }

      const referralResults = await Promise.all(referralPromises);
      testReferrals.push(...referralResults.map(r => r.data));

      // Check and promote influencer
      const promotionResult = await enhancedReferralService.checkAndPromoteInfluencer(
        influencerCandidate.id
      );

      expect(promotionResult.wasInfluencer).toBe(false);
      expect(promotionResult.isNowInfluencer).toBe(true);
      expect(promotionResult.qualificationMet).toBe(true);
      expect(promotionResult.totalReferrals).toBe(50);
      expect(promotionResult.promotedAt).toBeDefined();
      expect(promotionResult.benefits).toContain('2x point earning multiplier');

      // Verify user was updated in database
      const { data: updatedUser, error } = await supabase
        .from('users')
        .select('is_influencer, influencer_qualified_at')
        .eq('id', influencerCandidate.id)
        .single();

      expect(error).toBeNull();
      expect(updatedUser.is_influencer).toBe(true);
      expect(updatedUser.influencer_qualified_at).toBeDefined();

      // Verify promotion was logged
      const { data: promotion, error: promotionError } = await supabase
        .from('influencer_promotions')
        .select('*')
        .eq('user_id', influencerCandidate.id)
        .single();

      expect(promotionError).toBeNull();
      expect(promotion.referral_count_at_promotion).toBe(50);
      expect(promotion.promotion_reason).toBe('referral_threshold_met');
    });
  });

  describe('Referral Analytics', () => {
    it('should provide comprehensive referral analytics', async () => {
      const [referrer] = testUsers;

      // Create some referrals with different statuses
      const referralData = [
        {
          referrer_id: referrer.id,
          referred_id: crypto.randomUUID(),
          referral_code: 'ANALYTICS1',
          status: 'completed',
          bonus_amount: 1000,
          bonus_paid: true
        },
        {
          referrer_id: referrer.id,
          referred_id: crypto.randomUUID(),
          referral_code: 'ANALYTICS2',
          status: 'completed',
          bonus_amount: 1500,
          bonus_paid: true
        },
        {
          referrer_id: referrer.id,
          referred_id: crypto.randomUUID(),
          referral_code: 'ANALYTICS3',
          status: 'pending',
          bonus_amount: 0,
          bonus_paid: false
        }
      ];

      // Create referred users first
      for (const refData of referralData) {
        await supabase.from('users').insert({
          id: refData.referred_id,
          name: `Analytics User ${refData.referral_code}`,
          email: `${refData.referral_code.toLowerCase()}@test.com`,
          phone_number: `+82101234${Math.floor(Math.random() * 10000)}`
        });
      }

      const referralResults = await Promise.all(
        referralData.map(data => 
          supabase.from('referrals').insert(data).select().single()
        )
      );

      testReferrals.push(...referralResults.map(r => r.data));

      const analytics = await enhancedReferralService.getReferralAnalytics(referrer.id);

      expect(analytics.userId).toBe(referrer.id);
      expect(analytics.totalReferrals).toBeGreaterThanOrEqual(3);
      expect(analytics.successfulReferrals).toBeGreaterThanOrEqual(2);
      expect(analytics.pendingReferrals).toBeGreaterThanOrEqual(1);
      expect(analytics.totalRewardsEarned).toBeGreaterThanOrEqual(2500);
      expect(analytics.conversionRate).toBeGreaterThan(0);
      expect(analytics.referralsByMonth).toBeDefined();
      expect(analytics.topReferredUsers).toBeDefined();
      expect(analytics.influencerStatus).toBeDefined();
    });
  });

  describe('End-to-End Referral Processing', () => {
    it('should process complete referral reward workflow', async () => {
      const [referrer, referred] = testUsers;
      const originalPaymentAmount = 150000; // 150,000 KRW
      const reservationId = crypto.randomUUID();

      // Process referral reward
      await enhancedReferralService.processReferralReward(
        referrer.id,
        referred.id,
        originalPaymentAmount,
        reservationId
      );

      // Verify point transaction was created
      const { data: pointTransaction, error: pointError } = await supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', referrer.id)
        .eq('transaction_type', 'earned_referral')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      expect(pointError).toBeNull();
      expect(pointTransaction.amount).toBe(375); // 150,000 * 0.025 * 0.10 = 375 points
      expect(pointTransaction.status).toBe('pending');
      expect(pointTransaction.description).toContain('추천 보상');

      // Verify referral record was updated
      const { data: referralRecord, error: referralError } = await supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', referrer.id)
        .eq('referred_id', referred.id)
        .single();

      expect(referralError).toBeNull();
      expect(referralRecord.status).toBe('completed');
      expect(referralRecord.bonus_paid).toBe(true);
      expect(referralRecord.bonus_amount).toBe(375);

      testReferrals.push(referralRecord);
    });

    it('should reject invalid referral chains during processing', async () => {
      const [user1, user2] = testUsers;

      // Create a referral relationship first
      const referral = await supabase
        .from('referrals')
        .insert({
          referrer_id: user1.id,
          referred_id: user2.id,
          referral_code: 'INVALID001',
          status: 'completed',
          bonus_amount: 1000,
          bonus_paid: true
        })
        .select()
        .single();

      testReferrals.push(referral.data);

      // Try to process reverse referral (circular reference)
      await expect(
        enhancedReferralService.processReferralReward(
          user2.id,
          user1.id,
          100000
        )
      ).rejects.toThrow(/Invalid referral chain/);
    });
  });

  describe('Database Function Integration', () => {
    it('should use database functions for referral reward calculation', async () => {
      const originalPaymentAmount = 100000;

      // Call the database function directly
      const { data: calculation, error } = await supabase
        .rpc('calculate_referral_reward', {
          p_original_payment_amount: originalPaymentAmount,
          p_referral_percentage: 0.10
        });

      expect(error).toBeNull();
      expect(calculation).toHaveLength(1);
      expect(calculation[0].base_points_earned).toBe(2500); // 100,000 * 0.025
      expect(calculation[0].referral_reward_amount).toBe(250); // 2,500 * 0.10
      expect(calculation[0].calculation_method).toBe('base_points_percentage');
    });

    it('should use database functions for chain validation', async () => {
      const [user1, user2] = testUsers;

      // Call the database function directly
      const { data: validation, error } = await supabase
        .rpc('validate_referral_chain', {
          p_referrer_id: user1.id,
          p_referred_id: user2.id,
          p_max_depth: 10
        });

      expect(error).toBeNull();
      expect(validation).toHaveLength(1);
      expect(validation[0].is_valid).toBeDefined();
      expect(validation[0].has_circular_reference).toBeDefined();
      expect(validation[0].chain_depth).toBeDefined();
    });

    it('should use database functions for influencer promotion', async () => {
      const [user] = testUsers;

      // Call the database function directly
      const { data: promoted, error } = await supabase
        .rpc('check_and_promote_influencer', {
          p_user_id: user.id
        });

      expect(error).toBeNull();
      expect(typeof promoted).toBe('boolean');
    });
  });
});

