import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { referralAnalyticsService } from '../../src/services/referral-analytics.service';
import { getSupabaseClient } from '../../src/config/database';

// Mock dependencies
jest.mock('../../src/config/database');

const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(() => ({
          data: null,
          error: null
        })),
        data: [],
        error: null
      })),
      gte: jest.fn(() => ({
        lte: jest.fn(() => ({
          order: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      })),
      data: [],
      error: null
    }))
  }))
};

(getSupabaseClient as jest.Mock).mockReturnValue(mockSupabase);

describe('ReferralAnalyticsService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getReferralAnalyticsOverview', () => {
    it('should return analytics overview with correct structure', async () => {
      // Mock data for overview
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [],
            error: null
          })),
          data: [],
          error: null
        }))
      });

      const overview = await referralAnalyticsService.getReferralAnalyticsOverview();

      expect(overview).toBeDefined();
      expect(overview).toHaveProperty('totalReferrals');
      expect(overview).toHaveProperty('activeReferrals');
      expect(overview).toHaveProperty('completedReferrals');
      expect(overview).toHaveProperty('totalEarnings');
      expect(overview).toHaveProperty('totalPayouts');
      expect(overview).toHaveProperty('conversionRate');
      expect(overview).toHaveProperty('averageEarningsPerReferral');
      expect(overview).toHaveProperty('topPerformers');
      expect(overview).toHaveProperty('recentActivity');
    });

    it('should calculate conversion rate correctly', async () => {
      // Mock data with specific counts
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [],
            error: null
          })),
          data: [],
          error: null
        }))
      });

      const overview = await referralAnalyticsService.getReferralAnalyticsOverview();

      expect(overview.conversionRate).toBeGreaterThanOrEqual(0);
      expect(overview.conversionRate).toBeLessThanOrEqual(100);
    });
  });

  describe('getReferralTrends', () => {
    it('should return trends data for valid period', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const period = 'month';

      // Mock trends data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      });

      const trends = await referralAnalyticsService.getReferralTrends(
        period as 'day' | 'week' | 'month' | 'year',
        startDate,
        endDate
      );

      expect(trends).toBeDefined();
      expect(trends.period).toBe(period);
      expect(trends.startDate).toBe(startDate);
      expect(trends.endDate).toBe(endDate);
      expect(trends.data).toBeDefined();
      expect(trends.summary).toBeDefined();
    });

    it('should handle different period types', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      const periods = ['day', 'week', 'month', 'year'] as const;

      for (const period of periods) {
        mockSupabase.from.mockReturnValue({
          select: jest.fn(() => ({
            gte: jest.fn(() => ({
              lte: jest.fn(() => ({
                order: jest.fn(() => ({
                  data: [],
                  error: null
                }))
              }))
            }))
          }))
        });

        const trends = await referralAnalyticsService.getReferralTrends(
          period,
          startDate,
          endDate
        );

        expect(trends.period).toBe(period);
      }
    });
  });

  describe('getUserReferralAnalytics', () => {
    it('should return user analytics for valid user', async () => {
      const userId = 'test-user-id';

      // Mock user info
      mockSupabase.from.mockReturnValueOnce({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: userId,
                name: 'Test User',
                email: 'test@example.com',
                created_at: '2024-01-01T00:00:00Z',
                is_influencer: false
              },
              error: null
            }))
          }))
        }))
      });

      // Mock other data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [],
            error: null
          }))
        }))
      });

      const analytics = await referralAnalyticsService.getUserReferralAnalytics(userId);

      expect(analytics).toBeDefined();
      expect(analytics.userId).toBe(userId);
      expect(analytics).toHaveProperty('totalReferrals');
      expect(analytics).toHaveProperty('successfulReferrals');
      expect(analytics).toHaveProperty('failedReferrals');
      expect(analytics).toHaveProperty('conversionRate');
      expect(analytics).toHaveProperty('totalEarnings');
      expect(analytics).toHaveProperty('totalPayouts');
      expect(analytics).toHaveProperty('availableBalance');
      expect(analytics).toHaveProperty('tier');
      expect(analytics).toHaveProperty('isInfluencer');
      expect(analytics).toHaveProperty('referralChain');
      expect(analytics).toHaveProperty('performance');
      expect(analytics).toHaveProperty('recentReferrals');
    });

    it('should throw error for non-existent user', async () => {
      const userId = 'non-existent-user';

      // Mock user not found
      mockSupabase.from.mockReturnValue({
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
        referralAnalyticsService.getUserReferralAnalytics(userId)
      ).rejects.toThrow('User not found');
    });
  });

  describe('getReferralSystemMetrics', () => {
    it('should return system metrics', async () => {
      const metrics = await referralAnalyticsService.getReferralSystemMetrics();

      expect(metrics).toBeDefined();
      expect(metrics).toHaveProperty('systemHealth');
      expect(metrics).toHaveProperty('performance');
      expect(metrics).toHaveProperty('userEngagement');
      expect(metrics).toHaveProperty('financial');
    });
  });

  describe('generateReferralReport', () => {
    it('should generate overview report', async () => {
      const reportType = 'overview';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      // Mock overview data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            data: [],
            error: null
          })),
          data: [],
          error: null
        }))
      });

      const report = await referralAnalyticsService.generateReferralReport(
        reportType,
        startDate,
        endDate
      );

      expect(report).toBeDefined();
      expect(report.reportType).toBe(reportType);
      expect(report.period.startDate).toBe(startDate);
      expect(report.period.endDate).toBe(endDate);
      expect(report).toHaveProperty('reportId');
      expect(report).toHaveProperty('generatedAt');
      expect(report).toHaveProperty('data');
      expect(report).toHaveProperty('summary');
      expect(report).toHaveProperty('insights');
      expect(report).toHaveProperty('recommendations');
    });

    it('should generate trends report', async () => {
      const reportType = 'trends';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      // Mock trends data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          gte: jest.fn(() => ({
            lte: jest.fn(() => ({
              order: jest.fn(() => ({
                data: [],
                error: null
              }))
            }))
          }))
        }))
      });

      const report = await referralAnalyticsService.generateReferralReport(
        reportType,
        startDate,
        endDate
      );

      expect(report).toBeDefined();
      expect(report.reportType).toBe(reportType);
    });

    it('should generate user report with userId', async () => {
      const reportType = 'user';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';
      const userId = 'test-user-id';

      // Mock user data
      mockSupabase.from.mockReturnValue({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            single: jest.fn(() => ({
              data: {
                id: userId,
                name: 'Test User',
                email: 'test@example.com',
                created_at: '2024-01-01T00:00:00Z',
                is_influencer: false
              },
              error: null
            }))
          })),
          data: [],
          error: null
        }))
      });

      const report = await referralAnalyticsService.generateReferralReport(
        reportType,
        startDate,
        endDate,
        userId
      );

      expect(report).toBeDefined();
      expect(report.reportType).toBe(reportType);
    });

    it('should throw error for unknown report type', async () => {
      const reportType = 'unknown' as any;
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await expect(
        referralAnalyticsService.generateReferralReport(
          reportType,
          startDate,
          endDate
        )
      ).rejects.toThrow('Unknown report type');
    });

    it('should throw error for user report without userId', async () => {
      const reportType = 'user';
      const startDate = '2024-01-01';
      const endDate = '2024-01-31';

      await expect(
        referralAnalyticsService.generateReferralReport(
          reportType,
          startDate,
          endDate
        )
      ).rejects.toThrow('User ID required for user report');
    });
  });
});

