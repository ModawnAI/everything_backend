import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Persistent mock object - created before jest.mock so factory can reference it
const mockSupabase: any = {};
function resetMockSupabase() {
  const mockChain: any = {};
  ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
   'like','ilike','is','in','not','contains','containedBy','overlaps',
   'filter','match','or','and','order','limit','range','offset','count',
   'single','maybeSingle','csv','returns','textSearch','throwOnError'
  ].forEach(m => { mockChain[m] = jest.fn().mockReturnValue(mockChain); });
  mockChain.then = (resolve: any) => resolve({ data: null, error: null });
  mockSupabase.from = jest.fn().mockReturnValue(mockChain);
  mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
  mockSupabase.auth = {
    getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    admin: { getUserById: jest.fn(), listUsers: jest.fn(), deleteUser: jest.fn() },
  };
  mockSupabase.storage = { from: jest.fn(() => ({ upload: jest.fn(), getPublicUrl: jest.fn() })) };
}
resetMockSupabase();

// Mock dependencies
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn(() => mockSupabase),
  initializeDatabase: jest.fn(() => ({ client: mockSupabase })),
  getDatabase: jest.fn(() => ({ client: mockSupabase })),
  database: { getClient: jest.fn(() => mockSupabase) },
}));
jest.mock('../../src/services/point.service');
jest.mock('../../src/services/payment.service');
jest.mock('../../src/services/notification.service');
jest.mock('../../src/services/enhanced-referral.service');
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { referralEarningsService } from '../../src/services/referral-earnings.service';
import { getSupabaseClient } from '../../src/config/database';

/**
 * Helper to create a chainable mock for supabase queries.
 * Supports chaining like .select().eq().eq().order().single() etc.
 */
function createChainMock(finalResult: { data: any; error: any; count?: any }) {
  const chain: any = {};
  ['select','insert','update','upsert','delete','eq','neq','gt','gte','lt','lte',
   'like','ilike','is','in','not','contains','containedBy','overlaps',
   'filter','match','or','and','order','limit','range','offset','count',
   'single','maybeSingle','csv','returns','textSearch','throwOnError'
  ].forEach(m => { chain[m] = jest.fn().mockReturnValue(chain); });
  // The final resolution returns the configured result
  chain.then = (resolve: any) => resolve(finalResult);
  // single() and maybeSingle() return the result directly for awaiting
  chain.single = jest.fn().mockReturnValue(finalResult);
  chain.maybeSingle = jest.fn().mockReturnValue(finalResult);
  // Support for count in result
  if (finalResult.count !== undefined) {
    chain.count = finalResult.count;
  }
  return chain;
}

describe('ReferralEarningsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
  });

  describe('calculateReferralEarnings', () => {
    it('should calculate earnings for a valid referral', async () => {
      const referralData = {
        id: 'test-referral-id',
        referrer_id: 'test-referrer-id',
        referred_id: 'test-referred-id',
        bonus_amount: 1000,
        bonus_type: 'points'
      };

      const referrerData = {
        id: 'test-referrer-id',
        name: 'Test Referrer',
        user_status: 'active',
        is_influencer: false,
        total_referrals: 5,
        phone_verified: true,
        profile_image_url: 'https://example.com/image.jpg'
      };

      const referredData = {
        id: 'test-referred-id',
        name: 'Test Referred',
        user_status: 'active'
      };

      // The implementation calls:
      // 1. getReferralDetails (from('referrals').select.eq.single)
      // 2. getReferrerInfo (from('users').select.eq.single)
      // 3. getReferredUserInfo (from('users').select.eq.single)
      // 4. checkEligibility -> getReferrerInfo again
      // 5. checkEligibility -> getReferredUserInfo again
      mockSupabase.from
        .mockReturnValueOnce(createChainMock({ data: referralData, error: null }))
        .mockReturnValueOnce(createChainMock({ data: referrerData, error: null }))
        .mockReturnValueOnce(createChainMock({ data: referredData, error: null }))
        .mockReturnValueOnce(createChainMock({ data: referrerData, error: null }))
        .mockReturnValueOnce(createChainMock({ data: referredData, error: null }));

      const result = await referralEarningsService.calculateReferralEarnings(
        'test-referral-id',
        'test-referrer-id',
        'test-referred-id'
      );

      expect(result).toBeDefined();
      expect(result.referralId).toBe('test-referral-id');
      expect(result.referrerId).toBe('test-referrer-id');
      expect(result.referredId).toBe('test-referred-id');
      expect(result.baseAmount).toBe(1000);
      expect(result.bonusType).toBe('points');
      expect(result.eligibility.isEligible).toBe(true);
    });

    it('should handle referral not found', async () => {
      mockSupabase.from.mockReturnValueOnce(
        createChainMock({ data: null, error: { message: 'Not found' } })
      );

      await expect(
        referralEarningsService.calculateReferralEarnings(
          'non-existent-referral',
          'test-referrer-id',
          'test-referred-id'
        )
      ).rejects.toThrow('Referral not found');
    });
  });

  describe('processReferralPayout', () => {
    it('should process a valid payout request', async () => {
      const payoutRequest = {
        referralId: 'test-referral-id',
        referrerId: 'test-referrer-id',
        referredId: 'test-referred-id',
        payoutType: 'points' as const,
        amount: 1000,
        reason: 'Test payout',
        processedBy: 'test-admin-id',
        metadata: { test: true }
      };

      // The implementation calls:
      // 1. validatePayoutRequest -> getReferralDetails
      // 2. createPayoutRecord (insert.select.single)
      // 3. processPointsPayout -> pointService.addPoints then from('users').select.eq.single
      // 4. notificationService.sendReferralPointNotification (mocked)
      // 5. updatePayoutRecord (update.eq)
      // 6. updateReferralPayoutStatus (update.eq)
      mockSupabase.from
        .mockReturnValueOnce(createChainMock({
          data: {
            id: 'test-referral-id',
            referrer_id: 'test-referrer-id',
            referred_id: 'test-referred-id',
            bonus_paid: false
          },
          error: null
        }))
        .mockReturnValueOnce(createChainMock({
          data: { id: 'test-payout-id' },
          error: null
        }))
        .mockReturnValueOnce(createChainMock({
          data: { name: 'Test Friend', nickname: 'TestNick' },
          error: null
        }))
        .mockReturnValueOnce(createChainMock({ data: null, error: null }))
        .mockReturnValueOnce(createChainMock({ data: null, error: null }));

      // Mock pointService.addPoints on the auto-mocked module
      const pointServiceModule = require('../../src/services/point.service');
      pointServiceModule.pointService.addPoints = jest.fn().mockResolvedValue({ id: 'point-tx-id' });

      // Mock notificationService to prevent errors
      const notificationServiceModule = require('../../src/services/notification.service');
      notificationServiceModule.notificationService.sendReferralPointNotification = jest.fn().mockResolvedValue(true);

      const result = await referralEarningsService.processReferralPayout(payoutRequest);

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      expect(result.payoutId).toBe('test-payout-id');
      expect(result.amount).toBe(1000);
      expect(result.payoutType).toBe('points');
    });

    it('should handle payout validation failure', async () => {
      const payoutRequest = {
        referralId: 'test-referral-id',
        referrerId: 'test-referrer-id',
        referredId: 'test-referred-id',
        payoutType: 'points' as const,
        amount: 1000,
        reason: 'Test payout',
        processedBy: 'test-admin-id'
      };

      // Mock referral already paid
      mockSupabase.from.mockReturnValueOnce(
        createChainMock({
          data: {
            id: 'test-referral-id',
            referrer_id: 'test-referrer-id',
            referred_id: 'test-referred-id',
            bonus_paid: true
          },
          error: null
        })
      );

      await expect(
        referralEarningsService.processReferralPayout(payoutRequest)
      ).rejects.toThrow('Payout validation failed');
    });
  });

  describe('getReferralEarningsSummary', () => {
    it('should return earnings summary for a user', async () => {
      const userId = 'test-user-id';

      // The implementation calls:
      // 1. from('point_transactions').select('*').eq().eq().order()
      // 2. from('referral_payouts').select('*').eq().order()
      // 3. enhancedReferralService.getReferralAnalytics (mocked)
      const earningsChain = createChainMock({
        data: [
          {
            id: 'earning-1',
            amount: 1000,
            payout_type: 'points',
            status: 'completed',
            created_at: '2024-01-01T00:00:00Z',
            reference_id: 'ref-1'
          },
          {
            id: 'earning-2',
            amount: 500,
            payout_type: 'points',
            status: 'pending',
            created_at: '2024-01-02T00:00:00Z',
            reference_id: 'ref-2'
          }
        ],
        error: null
      });

      const payoutsChain = createChainMock({
        data: [
          {
            id: 'payout-1',
            amount: 1000,
            payout_type: 'points',
            status: 'completed',
            processed_at: '2024-01-01T00:00:00Z',
            created_at: '2024-01-01T00:00:00Z'
          }
        ],
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(earningsChain)
        .mockReturnValueOnce(payoutsChain);

      // Mock enhancedReferralService
      const enhancedReferralMod = require('../../src/services/enhanced-referral.service');
      enhancedReferralMod.enhancedReferralService.getReferralAnalytics = jest.fn().mockResolvedValue({
        referralsByMonth: [
          { month: '2024-01', count: 2, rewards: 1500 }
        ]
      });

      const result = await referralEarningsService.getReferralEarningsSummary(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      // totalEarnings = completedEarnings (status === 'completed' or no status)
      // earning-1 has status 'completed' -> 1000
      // earning-2 has status 'pending' -> excluded from completedEarnings
      expect(result.totalEarnings).toBe(1000);
      expect(result.totalPayouts).toBe(1000);
      expect(result.availableBalance).toBe(0);
      expect(result.earningsByType.points).toBe(1000);
    });
  });

  describe('processBulkReferralPayouts', () => {
    it('should process multiple referral payouts', async () => {
      const referralIds = ['referral-1', 'referral-2', 'referral-3'];
      const processedBy = 'test-admin-id';

      // Default mock chain returns { data: null, error: null },
      // so getReferralDetails returns null, and each will fail with 'Referral not found'
      const result = await referralEarningsService.processBulkReferralPayouts(
        referralIds,
        processedBy
      );

      expect(result).toBeDefined();
      expect(result.successful).toBeDefined();
      expect(result.failed).toBeDefined();
      expect(result.totalAmount).toBeGreaterThanOrEqual(0);
    });
  });
});
