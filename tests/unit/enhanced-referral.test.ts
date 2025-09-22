/**
 * Enhanced Referral Service Unit Tests
 * 
 * Tests the enhanced referral reward calculation system with:
 * - Fair referral rewards based on original payment amounts (10% of base points)
 * - Automatic influencer qualification logic (50 successful referrals)
 * - Referral chain validation to prevent circular references
 * - Referral code generation and validation with collision prevention
 */

import { enhancedReferralService } from '../../src/services/enhanced-referral.service';
import { pointService } from '../../src/services/point.service';
import { createClient } from '@supabase/supabase-js';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/point.service');
jest.mock('../../src/utils/logger');

// Create mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn()
        }))
      })),
      filter: jest.fn(() => ({
        order: jest.fn(() => ({
          limit: jest.fn()
        }))
      })),
      gte: jest.fn(() => ({
        lte: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  }))
};

// Mock the database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase
}));

// Mock point service
const mockPointService = {
  addPoints: jest.fn()
};
(pointService as any) = mockPointService;

describe('EnhancedReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateReferralReward', () => {
    it('should calculate 10% of base points as referral reward', async () => {
      // Mock referrer data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 25
        },
        error: null
      });

      const result = await enhancedReferralService.calculateReferralReward(
        'referrer-id',
        'referred-id',
        100000 // 100,000 KRW
      );

      expect(result.referralPercentage).toBe(0.10);
      expect(result.originalPaymentAmount).toBe(100000);
      expect(result.basePointsEarned).toBe(2500); // 100,000 * 0.025 = 2,500 points
      expect(result.referralRewardAmount).toBe(250); // 2,500 * 0.10 = 250 points
      expect(result.calculation.beforeInfluencerMultiplier).toBe(true);
    });

    it('should handle large payment amounts with cap', async () => {
      // Mock referrer data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 25
        },
        error: null
      });

      const result = await enhancedReferralService.calculateReferralReward(
        'referrer-id',
        'referred-id',
        500000 // 500,000 KRW (exceeds 300,000 cap)
      );

      // Should be capped at 300,000 KRW for calculation
      expect(result.basePointsEarned).toBe(7500); // 300,000 * 0.025 = 7,500 points
      expect(result.referralRewardAmount).toBe(750); // 7,500 * 0.10 = 750 points
    });

    it('should identify influencer-eligible referrers', async () => {
      // Mock referrer data with 50+ referrals
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 55
        },
        error: null
      });

      const result = await enhancedReferralService.calculateReferralReward(
        'referrer-id',
        'referred-id',
        100000
      );

      expect(result.isInfluencerEligible).toBe(true);
      expect(result.totalReferrals).toBe(55);
    });
  });

  describe('checkAndPromoteInfluencer', () => {
    it('should promote user to influencer when reaching 50 successful referrals', async () => {
      // Mock user data (not yet influencer)
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'user-id',
          is_influencer: false,
          total_referrals: 45
        },
        error: null
      });

      // Mock successful referrals count (50)
      mockSupabase.from().select().eq().eq().eq.mockResolvedValueOnce({
        data: new Array(50).fill({ id: 'referral-id' }),
        error: null
      });

      // Mock successful update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      // Mock logging insert
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      const result = await enhancedReferralService.checkAndPromoteInfluencer('user-id');

      expect(result.wasInfluencer).toBe(false);
      expect(result.isNowInfluencer).toBe(true);
      expect(result.qualificationMet).toBe(true);
      expect(result.totalReferrals).toBe(50);
      expect(result.promotedAt).toBeDefined();
      expect(result.benefits).toContain('2x point earning multiplier');
    });

    it('should not promote user who is already an influencer', async () => {
      // Mock user data (already influencer)
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'user-id',
          is_influencer: true,
          total_referrals: 60
        },
        error: null
      });

      const result = await enhancedReferralService.checkAndPromoteInfluencer('user-id');

      expect(result.wasInfluencer).toBe(true);
      expect(result.isNowInfluencer).toBe(true);
      expect(result.promotedAt).toBeUndefined();
    });

    it('should not promote user with insufficient referrals', async () => {
      // Mock user data (not enough referrals)
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'user-id',
          is_influencer: false,
          total_referrals: 30
        },
        error: null
      });

      // Mock successful referrals count (30)
      mockSupabase.from().select().eq().eq().eq.mockResolvedValueOnce({
        data: new Array(30).fill({ id: 'referral-id' }),
        error: null
      });

      const result = await enhancedReferralService.checkAndPromoteInfluencer('user-id');

      expect(result.wasInfluencer).toBe(false);
      expect(result.isNowInfluencer).toBe(false);
      expect(result.qualificationMet).toBe(false);
      expect(result.totalReferrals).toBe(30);
      expect(result.promotedAt).toBeUndefined();
    });
  });

  describe('validateReferralChain', () => {
    it('should validate a simple referral chain without circular references', async () => {
      // Mock chain: referrer-id -> intermediate-user -> end-user
      mockSupabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { referrer_id: 'intermediate-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { referrer_id: 'end-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' } // No more referrers
        });

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(true);
      expect(result.hasCircularReference).toBe(false);
      expect(result.chainDepth).toBe(2);
      expect(result.chainPath).toEqual(['referrer-id', 'intermediate-user']);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect circular reference in referral chain', async () => {
      // Mock circular chain: referrer-id -> intermediate-user -> referrer-id
      mockSupabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { referrer_id: 'intermediate-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { referrer_id: 'referrer-id' }, // Circular reference
          error: null
        });

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('Circular reference detected at user referrer-id');
    });

    it('should prevent user from being referred by someone in their chain', async () => {
      // Mock chain where referred user is in the referrer's chain
      mockSupabase.from().select().eq().eq().single
        .mockResolvedValueOnce({
          data: { referrer_id: 'intermediate-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { referrer_id: 'referred-id' }, // The referred user is in the chain
          error: null
        });

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('User referred-id cannot be referred by someone in their referral chain');
    });

    it('should reject self-referral', async () => {
      const result = await enhancedReferralService.validateReferralChain(
        'same-user-id',
        'same-user-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('User cannot refer themselves');
    });
  });

  describe('generateReferralCode', () => {
    it('should generate unique referral code', async () => {
      // Mock no existing code (unique)
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116' } // No existing code
      });

      // Mock successful insert
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      const result = await enhancedReferralService.generateReferralCode('user-id');

      expect(result.code).toHaveLength(8);
      expect(result.isUnique).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.generatedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should handle code collision and retry', async () => {
      // Mock first attempt - collision
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: { id: 'existing-code-id' },
          error: null
        })
        // Mock second attempt - unique
        .mockResolvedValueOnce({
          data: null,
          error: { code: 'PGRST116' }
        });

      // Mock successful insert
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      const result = await enhancedReferralService.generateReferralCode('user-id');

      expect(result.isUnique).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should fail after maximum attempts', async () => {
      // Mock all attempts as collisions
      for (let i = 0; i < 10; i++) {
        mockSupabase.from().select().eq().single.mockResolvedValueOnce({
          data: { id: 'existing-code-id' },
          error: null
        });
      }

      await expect(
        enhancedReferralService.generateReferralCode('user-id')
      ).rejects.toThrow('Failed to generate unique referral code after 10 attempts');
    });
  });

  describe('getReferralAnalytics', () => {
    it('should return comprehensive referral analytics', async () => {
      // Mock user data
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'user-id',
          is_influencer: true,
          influencer_qualified_at: '2024-01-01T00:00:00Z',
          total_referrals: 75
        },
        error: null
      });

      // Mock referrals data
      const mockReferrals = [
        {
          id: 'ref-1',
          referred_id: 'user-1',
          status: 'completed',
          bonus_amount: 1000,
          bonus_paid: true,
          created_at: '2024-01-15T00:00:00Z',
          users: { name: 'User One' }
        },
        {
          id: 'ref-2',
          referred_id: 'user-2',
          status: 'completed',
          bonus_amount: 1500,
          bonus_paid: true,
          created_at: '2024-02-15T00:00:00Z',
          users: { name: 'User Two' }
        },
        {
          id: 'ref-3',
          referred_id: 'user-3',
          status: 'pending',
          bonus_amount: 0,
          bonus_paid: false,
          created_at: '2024-03-15T00:00:00Z',
          users: { name: 'User Three' }
        }
      ];

      mockSupabase.from().select().eq().order.mockResolvedValueOnce({
        data: mockReferrals,
        error: null
      });

      const result = await enhancedReferralService.getReferralAnalytics('user-id');

      expect(result.userId).toBe('user-id');
      expect(result.totalReferrals).toBe(3);
      expect(result.successfulReferrals).toBe(2);
      expect(result.pendingReferrals).toBe(1);
      expect(result.totalRewardsEarned).toBe(2500);
      expect(result.averageRewardPerReferral).toBe(1250);
      expect(result.conversionRate).toBe(66.67);
      expect(result.influencerStatus.isInfluencer).toBe(true);
      expect(result.influencerStatus.referralsNeeded).toBe(0);
      expect(result.topReferredUsers).toHaveLength(2);
      expect(result.referralsByMonth).toBeDefined();
    });

    it('should calculate referrals needed for non-influencer', async () => {
      // Mock user data (not influencer)
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: {
          id: 'user-id',
          is_influencer: false,
          total_referrals: 30
        },
        error: null
      });

      // Mock 30 successful referrals
      const mockReferrals = new Array(30).fill({
        id: 'ref-id',
        status: 'completed',
        bonus_paid: true,
        bonus_amount: 1000,
        created_at: '2024-01-01T00:00:00Z',
        users: { name: 'User' }
      });

      mockSupabase.from().select().eq().order.mockResolvedValueOnce({
        data: mockReferrals,
        error: null
      });

      const result = await enhancedReferralService.getReferralAnalytics('user-id');

      expect(result.influencerStatus.isInfluencer).toBe(false);
      expect(result.influencerStatus.referralsNeeded).toBe(20); // 50 - 30 = 20
    });
  });

  describe('processReferralReward', () => {
    it('should process referral reward with chain validation and influencer check', async () => {
      // Mock chain validation (valid)
      mockSupabase.from().select().eq().eq().single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      // Mock referrer data
      mockSupabase.from().select().eq().single
        .mockResolvedValueOnce({
          data: {
            id: 'referrer-id',
            is_influencer: false,
            total_referrals: 49
          },
          error: null
        })
        // Mock for influencer check
        .mockResolvedValueOnce({
          data: {
            id: 'referrer-id',
            is_influencer: false,
            total_referrals: 49
          },
          error: null
        });

      // Mock successful referrals count (50 after this one)
      mockSupabase.from().select().eq().eq().eq.mockResolvedValueOnce({
        data: new Array(50).fill({ id: 'referral-id' }),
        error: null
      });

      // Mock influencer promotion update
      mockSupabase.from().update().eq.mockResolvedValueOnce({
        error: null
      });

      // Mock promotion logging
      mockSupabase.from().insert.mockResolvedValueOnce({
        error: null
      });

      // Mock referral record update
      mockSupabase.from().update().eq().eq.mockResolvedValueOnce({
        error: null
      });

      await enhancedReferralService.processReferralReward(
        'referrer-id',
        'referred-id',
        100000,
        'reservation-id'
      );

      expect(mockPointService.addPoints).toHaveBeenCalledWith(
        'referrer-id',
        250, // 10% of 2500 base points
        'earned_referral',
        'referral_system',
        expect.stringContaining('추천 보상'),
        'reservation-id'
      );
    });

    it('should reject invalid referral chain', async () => {
      // Mock invalid chain validation
      const mockValidation = {
        isValid: false,
        hasCircularReference: true,
        chainDepth: 2,
        chainPath: ['referrer-id', 'intermediate'],
        violations: ['Circular reference detected']
      };

      // We need to mock the validateReferralChain method directly
      jest.spyOn(enhancedReferralService, 'validateReferralChain')
        .mockResolvedValueOnce(mockValidation);

      await expect(
        enhancedReferralService.processReferralReward(
          'referrer-id',
          'referred-id',
          100000
        )
      ).rejects.toThrow('Invalid referral chain: Circular reference detected');
    });
  });
});

