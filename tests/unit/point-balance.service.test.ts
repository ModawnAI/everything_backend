import { createMockSupabase, createQueryMock } from '../utils/supabase-mock-helper';

// Create mock supabase before module loading
const mockSupabase = createMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeDatabase: jest.fn(),
  getDatabase: jest.fn(),
  database: { getClient: () => mockSupabase }
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
}));

import { pointBalanceService } from '../../src/services/point-balance.service';

describe('PointBalanceService', () => {
  beforeEach(() => {
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
          transaction_type: 'earned_service',
          status: 'available',
          available_from: null,
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '2',
          amount: 50,
          transaction_type: 'earned_service',
          status: 'pending',
          available_from: new Date(Date.now() + 86400000).toISOString(), // tomorrow
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '3',
          amount: 25,
          transaction_type: 'used_service',
          status: 'used',
          available_from: null,
          expires_at: null,
          created_at: '2024-01-01T00:00:00Z'
        },
        {
          id: '4',
          amount: 10,
          transaction_type: 'earned_service',
          status: 'expired',
          available_from: null,
          expires_at: '2023-12-01T00:00:00Z',
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const queryMock = createQueryMock({
        data: mockTransactions,
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await pointBalanceService.getPointBalance('user-1');

      // The source code calculates:
      // totalEarned: earned_service amounts = 100 + 50 + 10 = 160 (id:3 is used_service, not counted as earned)
      // totalUsed: used_service amount = 25
      // availableBalance: status=available + earned type + not expired = 100, then subtract totalUsed = 100 - 25 = 75
      // pendingBalance: status=pending + available_from > now = 50
      // expiredBalance: status=expired (10) + (status=available but expires_at < now) = 10
      expect(result.totalEarned).toBe(160);
      expect(result.totalUsed).toBe(25);
      expect(result.availableBalance).toBe(75);
      expect(result.pendingBalance).toBe(50);
      expect(result.expiredBalance).toBe(10);
      expect(result.lastCalculatedAt).toBeDefined();

      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
    });

    it('should handle expired available points', async () => {
      const now = new Date();
      const expiredDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // Yesterday

      const mockTransactions = [
        {
          id: '1',
          amount: 100,
          transaction_type: 'earned_service',
          status: 'available',
          available_from: null,
          expires_at: expiredDate.toISOString(),
          created_at: '2024-01-01T00:00:00Z'
        }
      ];

      const queryMock = createQueryMock({
        data: mockTransactions,
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await pointBalanceService.getPointBalance('user-1');

      // Status is 'available' but expires_at < now, so it falls through the available check
      // (expiresAt is in the past so !expiresAt || expiresAt > now is false -> not counted as available)
      // It IS counted as expired (expiresAt < now && status === 'available')
      expect(result.availableBalance).toBe(0);
      expect(result.expiredBalance).toBe(100);
    });

    it('should handle database errors', async () => {
      const queryMock = createQueryMock({
        data: null,
        error: { message: 'Database error' }
      });
      mockSupabase.from.mockReturnValue(queryMock);

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
          metadata: null,
          referrer_nickname: null
        }
      ];

      // The source code calls query twice: once for count, once for paginated results
      // With the chainable mock, both resolve to the same value
      const queryMock = createQueryMock({
        data: mockTransactions,
        error: null,
        count: 1
      });
      mockSupabase.from.mockReturnValue(queryMock);

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
      const queryMock = createQueryMock({
        data: [],
        error: null,
        count: 0
      });
      mockSupabase.from.mockReturnValue(queryMock);

      await pointBalanceService.getPointHistory('user-1', {
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        transactionType: 'earned_service',
        status: 'available',
        page: 1,
        limit: 10
      });

      expect(queryMock.gte).toHaveBeenCalledWith('created_at', '2024-01-01');
      expect(queryMock.lte).toHaveBeenCalledWith('created_at', '2024-12-31');
      expect(queryMock.eq).toHaveBeenCalledWith('transaction_type', 'earned_service');
      expect(queryMock.eq).toHaveBeenCalledWith('status', 'available');
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
          transaction_type: 'earned_service',
          status: 'available',
          expires_at: '2024-12-31T00:00:00Z',
          created_at: '2024-01-03T00:00:00Z'
        }
      ];

      const queryMock = createQueryMock({
        data: mockTransactions,
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await pointBalanceService.getPointAnalytics('user-1', 12);

      // Source code calculates:
      // totalEarned: earned_service + bonus + referral types -> 100 + 25 = 125
      // totalSpent: used_service -> 50
      expect(result.totalEarned).toBe(125);
      expect(result.totalSpent).toBe(50);
      expect(result.averageEarningPerMonth).toBeCloseTo(125 / 12, 2);
      expect(result.averageSpendingPerMonth).toBeCloseTo(50 / 12, 2);
      expect(result.mostCommonTransactionType).toBe('earned_service');
    });

    it('should handle points expiring soon', async () => {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 15); // within 30 day window

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

      const queryMock = createQueryMock({
        data: mockTransactions,
        error: null
      });
      mockSupabase.from.mockReturnValue(queryMock);

      const result = await pointBalanceService.getPointAnalytics('user-1', 12);

      expect(result.pointsExpiringSoon).toBe(100);
    });
  });

  describe('getPointProjection', () => {
    it('should calculate projection correctly', async () => {
      // Mock getPointBalance
      jest.spyOn(pointBalanceService, 'getPointBalance').mockResolvedValue({
        totalEarned: 200,
        totalUsed: 0,
        availableBalance: 100,
        pendingBalance: 50,
        expiredBalance: 0,
        todayEarned: 0,
        lastCalculatedAt: new Date().toISOString()
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

      // First from() call: pending transactions query
      const pendingQuery = createQueryMock({
        data: mockPendingTransactions,
        error: null
      });

      // Second from() call: expiring transactions query
      const expiringQuery = createQueryMock({
        data: [],
        error: null
      });

      mockSupabase.from
        .mockReturnValueOnce(pendingQuery)
        .mockReturnValueOnce(expiringQuery);

      const result = await pointBalanceService.getPointProjection('user-1', 90);

      expect(result.currentAvailable).toBe(100);
      // projectedAvailable starts at 100, then +50 from pending = 150 at end
      expect(result.projectedAvailable).toBeGreaterThan(100);
      expect(result.projectedByDate).toBeInstanceOf(Array);
    });
  });

  describe('getPointSummary', () => {
    it('should return comprehensive summary', async () => {
      // Mock all the individual methods
      const mockBalance = {
        totalEarned: 200,
        totalUsed: 50,
        availableBalance: 100,
        pendingBalance: 50,
        expiredBalance: 0,
        todayEarned: 0,
        lastCalculatedAt: new Date().toISOString()
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
