import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { referralEarningsService } from '../../src/services/referral-earnings.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/point.service');
jest.mock('../../src/services/payment.service');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: null,
          error: null
        }))
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn(() => ({
          data: { id: 'test-payout-id' },
          error: null
        }))
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn(() => ({
        data: null,
        error: null
      }))
    }))
  })
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

describe('ReferralEarningsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateReferralEarnings', () => {
    it('should calculate earnings for a valid referral', async () => {
      // Mock referral details
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referral-id',
                referrer_id: 'test-referrer-id',
                referred_id: 'test-referred-id',
                bonus_amount: 1000,
                bonus_type: 'points'
              },
              error: null
            }))
          }))
        }))
      });

      // Mock referrer info
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referrer-id',
                name: 'Test Referrer',
                user_status: 'active',
                is_influencer: false,
                total_referrals: 5,
                phone_verified: true,
                profile_image_url: 'https://example.com/image.jpg'
              },
              error: null
            }))
          }))
        }))
      });

      // Mock referred user info
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referred-id',
                name: 'Test Referred',
                user_status: 'active'
              },
              error: null
            }))
          }))
        }))
      });

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
      // Mock referral not found
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: null,
              error: { message: 'Not found' }
            }))
          }))
        }))
      });

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

      // Mock validation
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referral-id',
                referrer_id: 'test-referrer-id',
                referred_id: 'test-referred-id',
                bonus_paid: false
              },
              error: null
            }))
          }))
        }))
      });

      // Mock payout record creation
      mockSupabase.from.mockReturnValueOnce({
        insert: jest.fn(() => ({
          select: jest.fn(() => ({
            single: jest.fn(() => ({
              data: { id: 'test-payout-id' },
              error: null
            }))
          }))
        }))
      });

      // Mock payout record update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      });

      // Mock referral update
      mockSupabase.from.mockReturnValueOnce({
        update: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: null,
            error: null
          }))
        }))
      });

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
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referral-id',
                referrer_id: 'test-referrer-id',
                referred_id: 'test-referred-id',
                bonus_paid: true
              },
              error: null
            }))
          }))
        }))
      });

      await expect(
        referralEarningsService.processReferralPayout(payoutRequest)
      ).rejects.toThrow('Payout validation failed');
    });
  });

  describe('getReferralEarningsSummary', () => {
    it('should return earnings summary for a user', async () => {
      const userId = 'test-user-id';

      // Mock earnings data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [
              {
                id: 'earning-1',
                amount: 1000,
                payout_type: 'points',
                status: 'completed',
                created_at: '2024-01-01T00:00:00Z'
              },
              {
                id: 'earning-2',
                amount: 500,
                payout_type: 'points',
                status: 'pending',
                created_at: '2024-01-02T00:00:00Z'
              }
            ],
            error: null
          }))
        }))
      });

      // Mock payouts data
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: jest.fn(() => ({
              data: [
                {
                  id: 'payout-1',
                  amount: 1000,
                  payout_type: 'points',
                  status: 'completed',
                  processed_at: '2024-01-01T00:00:00Z'
                }
              ],
              error: null
            }))
          }))
        }))
      });

      const result = await referralEarningsService.getReferralEarningsSummary(userId);

      expect(result).toBeDefined();
      expect(result.userId).toBe(userId);
      expect(result.totalEarnings).toBe(1500);
      expect(result.totalPayouts).toBe(1000);
      expect(result.availableBalance).toBe(500);
      expect(result.earningsByType.points).toBe(1500);
    });
  });

  describe('processBulkReferralPayouts', () => {
    it('should process multiple referral payouts', async () => {
      const referralIds = ['referral-1', 'referral-2', 'referral-3'];
      const processedBy = 'test-admin-id';

      // Mock multiple referral details
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: 'test-referral-id',
                referrer_id: 'test-referrer-id',
                referred_id: 'test-referred-id',
                bonus_amount: 1000,
                bonus_type: 'points'
              },
              error: null
            }))
          }))
        }))
      });

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
