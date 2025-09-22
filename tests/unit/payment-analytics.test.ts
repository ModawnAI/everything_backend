// Mock Supabase client
const mockSupabase = {
  from: jest.fn(),
  rpc: jest.fn()
};

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => mockSupabase)
}));

// Mock the database config
jest.mock('../../src/config/database', () => ({
  config: {
    url: 'mock-url',
    anonKey: 'mock-key'
  }
}));

import { PaymentAnalyticsService } from '../../src/services/payment-analytics.service';

describe('PaymentAnalyticsService', () => {
  let service: PaymentAnalyticsService;

  beforeEach(() => {
    service = new PaymentAnalyticsService();
    // Override the supabase instance with our mock
    (service as any).supabase = mockSupabase;
    jest.clearAllMocks();
  });

  describe('analyzePointEarningPatterns', () => {
    it('should analyze point earning patterns from referrals and payments', async () => {
      const mockTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          source: 'referral',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: 500,
          transaction_type: 'earned',
          source: 'payment',
          created_at: '2024-01-16T10:00:00Z'
        },
        {
          user_id: 'user_2',
          amount: 2000,
          transaction_type: 'earned',
          source: 'influencer',
          created_at: '2024-01-17T10:00:00Z'
        }
      ];

      // Mock database call
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      const result = await service.analyzePointEarningPatterns();

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user_1');
      expect(result[0].totalEarned).toBe(1500);
      expect(result[0].referralEarnings).toBe(1000);
      expect(result[0].paymentEarnings).toBe(500);
      expect(result[0].influencerEarnings).toBe(0);
      expect(result[0].earningFrequency).toBe(2);
      expect(result[0].averageEarningPerTransaction).toBe(750);

      expect(result[1].userId).toBe('user_2');
      expect(result[1].totalEarned).toBe(2000);
      expect(result[1].influencerEarnings).toBe(2000);
    });

    it('should handle empty transactions', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      const result = await service.analyzePointEarningPatterns();

      expect(result).toHaveLength(0);
    });

    it('should handle database errors', async () => {
      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: null, error: new Error('Database error') })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      await expect(service.analyzePointEarningPatterns()).rejects.toThrow('Database error');
    });
  });

  describe('trackFIFOUsageEfficiency', () => {
    it('should track FIFO usage efficiency and consumption patterns', async () => {
      const mockUsageTransactions = [
        {
          user_id: 'user_1',
          amount: -500,
          transaction_type: 'used',
          created_at: '2024-01-15T10:00:00Z',
          metadata: {}
        },
        {
          user_id: 'user_1',
          amount: -300,
          transaction_type: 'used',
          created_at: '2024-01-16T10:00:00Z',
          metadata: {}
        }
      ];

      const mockFifoUsages = [
        {
          user_id: 'user_1',
          used_at: '2024-01-15T10:00:00Z',
          amount: 500
        }
      ];

      // Mock database calls
      const mockUsageQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsageTransactions, error: null })
      };
      
      const mockFifoQuery = {
        select: jest.fn().mockResolvedValue({ data: mockFifoUsages, error: null })
      };

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce(mockUsageQuery)
        .mockReturnValueOnce(mockFifoQuery);

      const result = await service.trackFIFOUsageEfficiency();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user_1');
      expect(result[0].totalPointsUsed).toBe(800);
      expect(result[0].pointsUsedViaFIFO).toBe(500);
      expect(result[0].fifoEfficiencyRate).toBe(62.5); // 500/800 * 100
      expect(result[0].usageFrequency).toBe(2);
    });

    it('should handle missing FIFO data gracefully', async () => {
      const mockUsageTransactions = [
        {
          user_id: 'user_1',
          amount: -500,
          transaction_type: 'used',
          created_at: '2024-01-15T10:00:00Z',
          metadata: {}
        }
      ];

      const mockUsageQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockUsageTransactions, error: null })
      };
      
      const mockFifoQuery = {
        select: jest.fn().mockResolvedValue({ data: null, error: new Error('FIFO data not found') })
      };

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce(mockUsageQuery)
        .mockReturnValueOnce(mockFifoQuery);

      const result = await service.trackFIFOUsageEfficiency();

      expect(result).toHaveLength(1);
      expect(result[0].fifoEfficiencyRate).toBe(0); // No FIFO data
    });
  });

  describe('calculatePointConversionMetrics', () => {
    it('should calculate point-to-payment conversion rates', async () => {
      const mockPointTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: -300,
          transaction_type: 'used',
          created_at: '2024-01-16T10:00:00Z'
        }
      ];

      const mockPaymentTransactions = [
        {
          user_id: 'user_1',
          amount: 5000,
          points_used: 300,
          created_at: '2024-01-16T10:00:00Z'
        }
      ];

      // Mock database calls
      const mockPointQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockPointTransactions, error: null })
      };
      
      const mockPaymentQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockPaymentTransactions, error: null })
      };

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce(mockPointQuery)
        .mockReturnValueOnce(mockPaymentQuery);

      const result = await service.calculatePointConversionMetrics();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user_1');
      expect(result[0].totalPointsEarned).toBe(1000);
      expect(result[0].totalPointsUsed).toBe(300);
      expect(result[0].conversionRate).toBe(30); // 300/1000 * 100
      expect(result[0].paymentValueFromPoints).toBe(300);
      expect(result[0].remainingPoints).toBe(700);
    });
  });

  describe('monitorPointAccumulationTrends', () => {
    it('should monitor point accumulation vs spending trends', async () => {
      const mockTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: -300,
          transaction_type: 'used',
          created_at: '2024-01-15T11:00:00Z'
        },
        {
          user_id: 'user_2',
          amount: 500,
          transaction_type: 'earned',
          created_at: '2024-02-15T10:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      const result = await service.monitorPointAccumulationTrends();

      expect(result).toHaveLength(2);
      expect(result[0].month).toBe('2024-01');
      expect(result[0].totalEarned).toBe(1000);
      expect(result[0].totalUsed).toBe(300);
      expect(result[0].netGrowth).toBe(700);
      expect(result[0].activeUsers).toBe(1);

      expect(result[1].month).toBe('2024-02');
      expect(result[1].totalEarned).toBe(500);
      expect(result[1].totalUsed).toBe(0);
      expect(result[1].netGrowth).toBe(500);
      expect(result[1].activeUsers).toBe(1);
    });
  });

  describe('segmentUserPointBehavior', () => {
    it('should segment users based on point behavior', async () => {
      const mockTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: -200,
          transaction_type: 'used',
          created_at: '2024-01-16T10:00:00Z'
        },
        {
          user_id: 'user_2',
          amount: 500,
          transaction_type: 'earned',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_2',
          amount: -800,
          transaction_type: 'used',
          created_at: '2024-01-16T10:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      const result = await service.segmentUserPointBehavior();

      expect(result).toHaveLength(2);
      expect(result[0].userId).toBe('user_1');
      expect(result[0].totalEarned).toBe(1000);
      expect(result[0].totalUsed).toBe(200);
      expect(result[0].segment).toBe('high_earner'); // Earns more than spends

      expect(result[1].userId).toBe('user_2');
      expect(result[1].totalEarned).toBe(500);
      expect(result[1].totalUsed).toBe(800);
      expect(result[1].segment).toBe('high_spender'); // Spends more than earns
    });
  });

  describe('analyzePointLifetimeValue', () => {
    it('should analyze point lifetime value', async () => {
      const mockTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: -300,
          transaction_type: 'used',
          created_at: '2024-01-16T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: 500,
          transaction_type: 'earned',
          created_at: '2024-02-15T10:00:00Z'
        }
      ];

      const mockQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null })
      };
      mockSupabase.from = jest.fn().mockReturnValue(mockQuery);

      const result = await service.analyzePointLifetimeValue();

      expect(result).toHaveLength(1);
      expect(result[0].userId).toBe('user_1');
      expect(result[0].totalLifetimeEarnings).toBe(1500);
      expect(result[0].totalLifetimeUsage).toBe(300);
      expect(result[0].netPointValue).toBe(1200);
      expect(result[0].pointRetentionRate).toBe(80); // (1500-300)/1500 * 100
    });
  });

  describe('getPointAnalyticsSummary', () => {
    it('should get comprehensive point analytics summary', async () => {
      const mockTransactions = [
        {
          user_id: 'user_1',
          amount: 1000,
          transaction_type: 'earned',
          source: 'referral',
          created_at: '2024-01-15T10:00:00Z'
        },
        {
          user_id: 'user_1',
          amount: -300,
          transaction_type: 'used',
          source: 'payment',
          created_at: '2024-01-16T10:00:00Z'
        },
        {
          user_id: 'user_2',
          amount: 500,
          transaction_type: 'earned',
          source: 'payment',
          created_at: '2024-01-17T10:00:00Z'
        }
      ];

      const mockTransactionsQuery = {
        select: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: mockTransactions, error: null })
      };
      
      const mockSegmentsQuery = {
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        order: jest.fn().mockResolvedValue({ data: [], error: null })
      };

      mockSupabase.from = jest.fn()
        .mockReturnValueOnce(mockTransactionsQuery)
        .mockReturnValueOnce(mockSegmentsQuery);

      // Mock segmentUserPointBehavior method
      jest.spyOn(service, 'segmentUserPointBehavior').mockResolvedValue([
        {
          segment: 'high_earner',
          userId: 'user_1',
          totalEarned: 1000,
          totalUsed: 300,
          activityScore: 2,
          lastActivity: '2024-01-16T10:00:00Z',
          characteristics: ['High earner']
        }
      ]);

      // Mock monitorPointAccumulationTrends method
      jest.spyOn(service, 'monitorPointAccumulationTrends').mockResolvedValue([
        {
          month: '2024-01',
          totalEarned: 1500,
          totalUsed: 300,
          netGrowth: 1200,
          activeUsers: 2
        }
      ]);

      const result = await service.getPointAnalyticsSummary();

      expect(result.totalUsers).toBe(2);
      expect(result.totalPointsEarned).toBe(1500);
      expect(result.totalPointsUsed).toBe(300);
      expect(result.averageConversionRate).toBe(20); // 300/1500 * 100
      expect(result.fifoEfficiencyRate).toBe(85);
      expect(result.topEarningSources).toHaveLength(2);
      expect(result.userSegments).toHaveLength(1);
      expect(result.monthlyTrends).toHaveLength(1);
    });
  });
});
