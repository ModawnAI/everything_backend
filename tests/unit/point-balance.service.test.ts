import { PointBalanceService } from '../../src/services/point-balance.service';

// Mock the entire PointBalanceService class
jest.mock('../../src/services/point-balance.service', () => {
  return {
    PointBalanceService: jest.fn().mockImplementation(() => ({
      supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        data: null,
        error: null,
        count: null
      }
    })),
    pointBalanceService: {
      supabase: {
        from: jest.fn().mockReturnThis(),
        select: jest.fn().mockReturnThis(),
        eq: jest.fn().mockReturnThis(),
        gte: jest.fn().mockReturnThis(),
        lte: jest.fn().mockReturnThis(),
        order: jest.fn().mockReturnThis(),
        range: jest.fn().mockReturnThis(),
        not: jest.fn().mockReturnThis(),
        data: null,
        error: null,
        count: null
      }
    }
  };
});

// Import after mocking
import { pointBalanceService } from '../../src/services/point-balance.service';

describe('PointBalanceService', () => {
  let mockSupabase: any;

  beforeEach(() => {
    // Get the mocked supabase instance
    mockSupabase = (pointBalanceService as any).supabase;
    
    // Reset all mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getPointBalance', () => {
    it('should calculate point balance correctly', async () => {
      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          status: 'available',
          available_from: null,
          expires_at: null
        },
        {
          id: '2',
          amount: 50,
          status: 'pending',
          available_from: '2024-01-01T00:00:00Z',
          expires_at: null
        },
        {
          id: '3',
          amount: 25,
          status: 'used',
          available_from: null,
          expires_at: null
        },
        {
          id: '4',
          amount: 10,
          status: 'expired',
          available_from: null,
          expires_at: '2023-12-01T00:00:00Z'
        }
      ];

      // Mock the final result
      mockSupabase.data = mockTransactions;
      mockSupabase.error = null;

      const result = await pointBalanceService.getPointBalance('user-1');

      expect(result).toEqual({
        available: 100,
        pending: 50,
        total: 185,
        expired: 10,
        used: 25,
        projectedAvailable: 50
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
      expect(mockSupabase.select).toHaveBeenCalledWith('*');
      expect(mockSupabase.eq).toHaveBeenCalledWith('user_id', 'user-1');
    });

    it('should handle expired available points', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          status: 'available',
          available_from: null,
          expires_at: expiredDate.toISOString()
        }
      ];

      mockSupabase.data = mockTransactions;
      mockSupabase.error = null;

      const result = await pointBalanceService.getPointBalance('user-1');

      expect(result.available).toBe(0);
      expect(result.expired).toBe(100);
    });

    it('should handle database errors', async () => {
      mockSupabase.error = { message: 'Database error' };

      await expect(pointBalanceService.getPointBalance('user-1'))
        .rejects.toThrow('Failed to get point transactions: Database error');
    });
  });

  describe('getPointHistory', () => {
    it('should return paginated transaction history', async () => {
      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'earned_service',
          status: 'available',
          description: 'Service completion',
          available_from: null,
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z',
          metadata: null
        }
      ];

      mockSupabase.data = mockTransactions;
      mockSupabase.error = null;
      mockSupabase.count = 1;

      const result = await pointBalanceService.getPointHistory('user-1', {
        page: 1,
        limit: 20
      });

      expect(result.transactions).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.currentPage).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should apply filters correctly', async () => {
      mockSupabase.data = [];
      mockSupabase.error = null;
      mockSupabase.count = 0;

      await pointBalanceService.getPointHistory('user-1', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        transactionType: 'earned_service',
        status: 'available',
        page: 1,
        limit: 10
      });

      expect(mockSupabase.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(mockSupabase.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
      expect(mockSupabase.eq).toHaveBeenCalledWith('transaction_type', 'earned_service');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'available');
    });
  });

  describe('getPointAnalytics', () => {
    it('should calculate analytics correctly', async () => {
      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'earned_service',
          status: 'available',
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          amount: 50,
          transaction_type: 'used_service',
          status: 'used',
          expires_at: null,
          created_at: '2024-01-02T00:00:00Z'
        },
        {
          id: '3',
          amount: 25,
          transaction_type: 'earned_referral',
          status: 'available',
          expires_at: '2024-12-31T00:00:00Z',
          created_at: '2024-01-03T00:00:00Z'
        }
      ];

      mockSupabase.data = mockTransactions;
      mockSupabase.error = null;

      const result = await pointBalanceService.getPointAnalytics('user-1', 12);

      expect(result.totalEarned).toBe(125); // 100 + 25
      expect(result.totalSpent).toBe(50);
      expect(result.totalExpired).toBe(0);
      expect(result.averageEarningPerMonth).toBe(125 / 12);
      expect(result.averageSpendingPerMonth).toBe(50 / 12);
      expect(result.mostCommonTransactionType).toBe('earned_service');
    });

    it('should handle points expiring soon', async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'earned_service',
          status: 'available',
          expires_at: thirtyDaysFromNow.toISOString(),
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      mockSupabase.data = mockTransactions;
      mockSupabase.error = null;

      const result = await pointBalanceService.getPointAnalytics('user-1', 12);

      expect(result.pointsExpiringSoon).toBe(100);
    });
  });

  describe('getPointProjection', () => {
    it('should calculate projection correctly', async () => {
      // Mock getPointBalance
      jest.spyOn(pointBalanceService, 'getPointBalance').mockResolvedValue({
        available: 100,
        pending: 50,
        total: 150,
        expired: 0,
        used: 0,
        projectedAvailable: 50
      });

      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 7);

      const mockPendingTransactions = [
        {
          id: '1',
          amount: 50,
          status: 'pending',
          available_from: futureDate.toISOString()
        }
      ];

      const mockExpiringTransactions = [
        {
          id: '2',
          amount: 25,
          status: 'available',
          expires_at: futureDate.toISOString()
        }
      ];

      // Mock the two separate queries
      mockSupabase.data = mockPendingTransactions;
      mockSupabase.error = null;

      const result = await pointBalanceService.getPointProjection('user-1', 90);

      expect(result.currentAvailable).toBe(100);
      expect(result.projectedAvailable).toBeGreaterThan(100);
      expect(result.projectedByDate).toBeInstanceOf(Array);
    });
  });

  describe('getPointSummary', () => {
    it('should return comprehensive summary', async () => {
      // Mock all the individual methods
      const mockBalance = {
        available: 100,
        pending: 50,
        total: 150,
        expired: 0,
        used: 0,
        projectedAvailable: 50
      };

      const mockAnalytics = {
        totalEarned: 200,
        totalSpent: 50,
        totalExpired: 0,
        averageEarningPerMonth: 16.67,
        averageSpendingPerMonth: 4.17,
        mostCommonTransactionType: 'earned_service' as any,
        pointsExpiringSoon: 0,
        pointsExpiringThisMonth: 0
      };

      const mockProjection = {
        currentAvailable: 100,
        projectedAvailable: 125,
        projectedByDate: [],
        nextExpirationDate: undefined,
        nextExpirationAmount: 0
      };

      jest.spyOn(pointBalanceService, 'getPointBalance').mockResolvedValue(mockBalance);
      jest.spyOn(pointBalanceService, 'getPointAnalytics').mockResolvedValue(mockAnalytics);
      jest.spyOn(pointBalanceService, 'getPointProjection').mockResolvedValue(mockProjection);

      const result = await pointBalanceService.getPointSummary('user-1');

      expect(result).toEqual({
        balance: mockBalance,
        analytics: mockAnalytics,
        projection: mockProjection
      });
    });
  });
}); 