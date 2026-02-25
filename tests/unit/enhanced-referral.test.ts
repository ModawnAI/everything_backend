/**
 * Enhanced Referral Service Unit Tests
 * 
 * Tests the enhanced referral reward calculation system with:
 * - Fair referral rewards based on original payment amounts (10% of base points)
 * - Automatic influencer qualification logic (50 successful referrals)
 * - Referral chain validation to prevent circular references
 * - Referral code generation and validation with collision prevention
 */

import { createMockSupabase, createQueryMock } from '../utils/supabase-mock-helper';

// Persistent mock object -- the service singleton captures this reference at module load
const mockSupabase = createMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeDatabase: jest.fn(),
  getDatabase: jest.fn(),
  database: { getClient: () => mockSupabase }
}));
jest.mock('../../src/services/point.service', () => ({
  pointService: {
    addPoints: jest.fn()
  }
}));
jest.mock('../../src/services/notification.service', () => ({
  notificationService: {
    sendReferralPointNotification: jest.fn()
  }
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { enhancedReferralService } from '../../src/services/enhanced-referral.service';
import { pointService } from '../../src/services/point.service';

describe('EnhancedReferralService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateReferralReward', () => {
    it('should calculate 10% of base points as referral reward', async () => {
      // Mock referrer data
      const queryMock = createQueryMock({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 25
        },
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await enhancedReferralService.calculateReferralReward(
        'referrer-id',
        'referred-id',
        100000 // 100,000 KRW
      );

      // EARNING_RATE = 0.05 (5%), so base points = 100,000 * 0.05 = 5,000
      // Referral reward = 5,000 * 0.10 = 500
      expect(result.referralPercentage).toBe(0.10);
      expect(result.originalPaymentAmount).toBe(100000);
      expect(result.basePointsEarned).toBe(5000);
      expect(result.referralRewardAmount).toBe(500);
      expect(result.calculation.beforeInfluencerMultiplier).toBe(true);
    });

    it('should handle large payment amounts without cap (MAX_ELIGIBLE_AMOUNT is very high)', async () => {
      // Mock referrer data
      const queryMock = createQueryMock({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 25
        },
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await enhancedReferralService.calculateReferralReward(
        'referrer-id',
        'referred-id',
        500000 // 500,000 KRW
      );

      // MAX_ELIGIBLE_AMOUNT = 999999999 so no cap applied
      // base points = 500,000 * 0.05 = 25,000
      // referral reward = 25,000 * 0.10 = 2,500
      expect(result.basePointsEarned).toBe(25000);
      expect(result.referralRewardAmount).toBe(2500);
    });

    it('should identify influencer-eligible referrers', async () => {
      // Mock referrer data with 50+ referrals
      const queryMock = createQueryMock({
        data: {
          id: 'referrer-id',
          is_influencer: false,
          total_referrals: 55
        },
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

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
      // The method makes multiple supabase calls. We use sequential from() mocks.
      const userQueryMock = createQueryMock({
        data: {
          id: 'user-id',
          is_influencer: false,
          total_referrals: 45
        },
        error: null
      });

      const referralsQueryMock = createQueryMock({
        data: new Array(50).fill({ id: 'referral-id' }),
        error: null
      });

      const updateQueryMock = createQueryMock({
        data: null,
        error: null
      });

      const insertQueryMock = createQueryMock({
        data: null,
        error: null
      });

      // Sequence: 1) select user, 2) select referrals, 3) update user, 4) insert promotion log
      mockSupabase.from
        .mockReturnValueOnce(userQueryMock)
        .mockReturnValueOnce(referralsQueryMock)
        .mockReturnValueOnce(updateQueryMock)
        .mockReturnValueOnce(insertQueryMock);

      const result = await enhancedReferralService.checkAndPromoteInfluencer('user-id');

      expect(result.wasInfluencer).toBe(false);
      expect(result.isNowInfluencer).toBe(true);
      expect(result.qualificationMet).toBe(true);
      expect(result.totalReferrals).toBe(50);
      expect(result.promotedAt).toBeDefined();
      expect(result.benefits).toContain('2x point earning multiplier');
    });

    it('should not promote user who is already an influencer', async () => {
      const userQueryMock = createQueryMock({
        data: {
          id: 'user-id',
          is_influencer: true,
          total_referrals: 60
        },
        error: null
      });

      // Still needs to count referrals
      const referralsQueryMock = createQueryMock({
        data: new Array(60).fill({ id: 'referral-id' }),
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(userQueryMock)
        .mockReturnValueOnce(referralsQueryMock);

      const result = await enhancedReferralService.checkAndPromoteInfluencer('user-id');

      expect(result.wasInfluencer).toBe(true);
      expect(result.isNowInfluencer).toBe(true);
      expect(result.promotedAt).toBeUndefined();
    });

    it('should not promote user with insufficient referrals', async () => {
      const userQueryMock = createQueryMock({
        data: {
          id: 'user-id',
          is_influencer: false,
          total_referrals: 30
        },
        error: null
      });

      const referralsQueryMock = createQueryMock({
        data: new Array(30).fill({ id: 'referral-id' }),
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(userQueryMock)
        .mockReturnValueOnce(referralsQueryMock);

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
      // The chain traversal: referrer-id -> look up referrer of referrer-id -> intermediate-user
      //                       intermediate-user -> look up referrer of intermediate-user -> end-user
      //                       end-user -> look up referrer of end-user -> none (PGRST116)
      // chainPath collects all visited users: [referrer-id, intermediate-user, end-user]
      // depth increments after each successful lookup: 2

      const chainQuery = createQueryMock({ data: null, error: null });
      // Override single to return sequential values
      chainQuery.single
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

      mockSupabase.from.mockReturnValue(chainQuery);

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(true);
      expect(result.hasCircularReference).toBe(false);
      // chainPath includes referrer-id, intermediate-user, end-user (all visited)
      expect(result.chainPath).toEqual(['referrer-id', 'intermediate-user', 'end-user']);
      expect(result.chainDepth).toBe(2);
      expect(result.violations).toHaveLength(0);
    });

    it('should detect circular reference in referral chain', async () => {
      const chainQuery = createQueryMock({ data: null, error: null });
      chainQuery.single
        .mockResolvedValueOnce({
          data: { referrer_id: 'intermediate-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { referrer_id: 'referrer-id' }, // Circular reference
          error: null
        });

      mockSupabase.from.mockReturnValue(chainQuery);

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('Circular reference detected at user referrer-id');
    });

    it('should prevent user from being referred by someone in their chain', async () => {
      const chainQuery = createQueryMock({ data: null, error: null });
      chainQuery.single
        .mockResolvedValueOnce({
          data: { referrer_id: 'intermediate-user' },
          error: null
        })
        .mockResolvedValueOnce({
          data: { referrer_id: 'referred-id' }, // The referred user is in the chain
          error: null
        });

      mockSupabase.from.mockReturnValue(chainQuery);

      const result = await enhancedReferralService.validateReferralChain(
        'referrer-id',
        'referred-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('User referred-id cannot be referred by someone in their referral chain');
    });

    it('should reject self-referral', async () => {
      // When referrer === referred, the code enters the loop, adds same-user-id to visited,
      // then checks if currentUserId === referredId. Since same-user-id === same-user-id,
      // it triggers the "cannot be referred by someone in their referral chain" violation.
      const chainQuery = createQueryMock({ data: null, error: null });
      mockSupabase.from.mockReturnValue(chainQuery);

      const result = await enhancedReferralService.validateReferralChain(
        'same-user-id',
        'same-user-id'
      );

      expect(result.isValid).toBe(false);
      expect(result.hasCircularReference).toBe(true);
      expect(result.violations).toContain('User same-user-id cannot be referred by someone in their referral chain');
    });
  });

  describe('generateReferralCode', () => {
    it('should generate unique referral code', async () => {
      // First call: check uniqueness (not found = unique)
      const checkQuery = createQueryMock({
        data: null,
        error: { code: 'PGRST116' }
      });
      // Second call: insert into referral_codes
      const insertQuery = createQueryMock({ data: null, error: null });
      // Third call: update users table with referral_code
      const updateQuery = createQueryMock({ data: null, error: null });

      mockSupabase.from
        .mockReturnValueOnce(checkQuery)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(updateQuery);

      const result = await enhancedReferralService.generateReferralCode('user-id');

      expect(result.code).toHaveLength(8);
      expect(result.isUnique).toBe(true);
      expect(result.attempts).toBe(1);
      expect(result.generatedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it('should handle code collision and retry', async () => {
      // First attempt: collision (existing code found)
      const checkQuery1 = createQueryMock({
        data: { id: 'existing-code-id' },
        error: null
      });
      // Second attempt: unique
      const checkQuery2 = createQueryMock({
        data: null,
        error: { code: 'PGRST116' }
      });
      // Insert into referral_codes
      const insertQuery = createQueryMock({ data: null, error: null });
      // Update users table
      const updateQuery = createQueryMock({ data: null, error: null });

      mockSupabase.from
        .mockReturnValueOnce(checkQuery1)
        .mockReturnValueOnce(checkQuery2)
        .mockReturnValueOnce(insertQuery)
        .mockReturnValueOnce(updateQuery);

      const result = await enhancedReferralService.generateReferralCode('user-id');

      expect(result.isUnique).toBe(true);
      expect(result.attempts).toBe(2);
    });

    it('should fail after maximum attempts', async () => {
      // All 10 attempts are collisions
      for (let i = 0; i < 10; i++) {
        const collisionQuery = createQueryMock({
          data: { id: 'existing-code-id' },
          error: null
        });
        mockSupabase.from.mockReturnValueOnce(collisionQuery);
      }

      await expect(
        enhancedReferralService.generateReferralCode('user-id')
      ).rejects.toThrow('Failed to generate unique referral code after 10 attempts');
    });
  });

  describe('getReferralAnalytics', () => {
    it('should return comprehensive referral analytics', async () => {
      // First call: get user data
      const userQuery = createQueryMock({
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

      const referralsQuery = createQueryMock({
        data: mockReferrals,
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(userQuery)
        .mockReturnValueOnce(referralsQuery);

      const result = await enhancedReferralService.getReferralAnalytics('user-id');

      expect(result.userId).toBe('user-id');
      expect(result.totalReferrals).toBe(3);
      expect(result.successfulReferrals).toBe(2);
      expect(result.pendingReferrals).toBe(1);
      expect(result.totalRewardsEarned).toBe(2500);
      expect(result.averageRewardPerReferral).toBe(1250);
      // conversionRate = (2/3)*100 = 66.666..., use toBeCloseTo
      expect(result.conversionRate).toBeCloseTo(66.67, 1);
      expect(result.influencerStatus.isInfluencer).toBe(true);
      expect(result.influencerStatus.referralsNeeded).toBe(48); // 50 - 2 successful referrals
      expect(result.topReferredUsers).toHaveLength(2);
      expect(result.referralsByMonth).toBeDefined();
    });

    it('should calculate referrals needed for non-influencer', async () => {
      const userQuery = createQueryMock({
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
        referred_id: 'same-user',
        status: 'completed',
        bonus_paid: true,
        bonus_amount: 1000,
        created_at: '2024-01-01T00:00:00Z',
        users: { name: 'User' }
      });

      const referralsQuery = createQueryMock({
        data: mockReferrals,
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(userQuery)
        .mockReturnValueOnce(referralsQuery);

      const result = await enhancedReferralService.getReferralAnalytics('user-id');

      expect(result.influencerStatus.isInfluencer).toBe(false);
      expect(result.influencerStatus.referralsNeeded).toBe(20); // 50 - 30 = 20
    });
  });

  describe('processReferralReward', () => {
    it('should process referral reward with chain validation and influencer check', async () => {
      // Mock validateReferralChain to return valid
      jest.spyOn(enhancedReferralService, 'validateReferralChain')
        .mockResolvedValueOnce({
          isValid: true,
          hasCircularReference: false,
          chainDepth: 0,
          chainPath: ['referrer-id'],
          violations: []
        });

      // Mock calculateReferralReward
      jest.spyOn(enhancedReferralService, 'calculateReferralReward')
        .mockResolvedValueOnce({
          referrerId: 'referrer-id',
          referredId: 'referred-id',
          originalPaymentAmount: 100000,
          basePointsEarned: 5000,
          referralRewardAmount: 500,
          referralPercentage: 0.10,
          isInfluencerEligible: false,
          totalReferrals: 49,
          calculation: {
            basePoints: 5000,
            referralReward: 500,
            beforeInfluencerMultiplier: true
          }
        });

      // Mock referred user lookup (for notification)
      const referredUserQuery = createQueryMock({
        data: { name: 'Friend', nickname: 'Buddy' },
        error: null
      });

      // Mock checkAndPromoteInfluencer
      jest.spyOn(enhancedReferralService, 'checkAndPromoteInfluencer')
        .mockResolvedValueOnce({
          userId: 'referrer-id',
          wasInfluencer: false,
          isNowInfluencer: false,
          totalReferrals: 49,
          qualificationMet: false,
          benefits: []
        });

      // Mock referral record update
      const updateQuery = createQueryMock({ data: null, error: null });

      mockSupabase.from
        .mockReturnValueOnce(referredUserQuery)
        .mockReturnValueOnce(updateQuery);

      await enhancedReferralService.processReferralReward(
        'referrer-id',
        'referred-id',
        100000,
        'reservation-id'
      );

      // Verify addPoints was called with the correct signature from the source code
      expect(pointService.addPoints).toHaveBeenCalledWith(
        'referrer-id',
        500, // 10% of 5000 base points
        'earned',
        'referral',
        expect.stringContaining('추천 보상'),
        expect.objectContaining({
          reservationId: 'reservation-id',
          relatedUserId: 'referred-id'
        })
      );
    });

    it('should reject invalid referral chain', async () => {
      // We need to mock the validateReferralChain method directly
      jest.spyOn(enhancedReferralService, 'validateReferralChain')
        .mockResolvedValueOnce({
          isValid: false,
          hasCircularReference: true,
          chainDepth: 2,
          chainPath: ['referrer-id', 'intermediate'],
          violations: ['Circular reference detected']
        });

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
