/**
 * Point Processing Service Tests
 *
 * Comprehensive tests for automated point processing functionality including:
 * - 7-day pending period processing
 * - Point expiration handling
 * - Expiration warning notifications
 * - Processing statistics
 * - FIFO point usage
 */

// Persistent mock Supabase object -- service singleton captures this at module load
const mockSupabase: any = {};
let queryResultQueue: any[] = [];
let defaultQueryResult: any = { data: [], error: null };

function createChainableQueryMock() {
  const result = queryResultQueue.length > 0 ? queryResultQueue.shift() : defaultQueryResult;
  const mock: any = {};
  const methods = [
    'select', 'insert', 'update', 'upsert', 'delete',
    'eq', 'neq', 'gt', 'gte', 'lt', 'lte',
    'like', 'ilike', 'is', 'in', 'not',
    'contains', 'containedBy', 'overlaps',
    'filter', 'match', 'or', 'and',
    'order', 'limit', 'range', 'offset', 'count',
    'single', 'maybeSingle',
    'csv', 'returns', 'textSearch', 'throwOnError',
  ];
  for (const method of methods) {
    mock[method] = jest.fn(() => mock);
  }
  mock.then = (resolve: any) => resolve(result);
  return mock;
}

function resetMockSupabase() {
  queryResultQueue = [];
  defaultQueryResult = { data: [], error: null };
  mockSupabase.from = jest.fn(() => createChainableQueryMock());
  mockSupabase.rpc = jest.fn(() => {
    const result = queryResultQueue.length > 0 ? queryResultQueue.shift() : { data: null, error: null };
    return { then: (resolve: any) => resolve(result) };
  });
}
resetMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeDatabase: jest.fn(),
  getDatabase: jest.fn(),
  database: { getClient: () => mockSupabase },
}));
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

// Mock constants that point-processing.service imports
jest.mock('../../src/constants/point-policies', () => ({
  POINT_CALCULATIONS: {
    calculateServicePoints: jest.fn(() => 100),
  },
  POINT_POLICY_V32: {
    MAX_ELIGIBLE_AMOUNT: 500000,
  },
  POINT_STATUS: {
    AVAILABLE: 'available',
    PENDING: 'pending',
    USED: 'used',
    EXPIRED: 'expired',
  },
  POINT_TRANSACTION_TYPES: {
    EARNED_SERVICE: 'earned_service',
    USED_SERVICE: 'used_service',
  },
}));

import { PointProcessingService } from '../../src/services/point-processing.service';

describe('PointProcessingService', () => {
  let pointProcessingService: PointProcessingService;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
    pointProcessingService = new PointProcessingService();
  });

  describe('processPendingToAvailable', () => {
    it('should process pending transactions successfully', async () => {
      const mockPendingTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 100,
          available_from: '2024-01-01T00:00:00.000Z',
          description: 'Test transaction'
        }
      ];

      // Queue: 1st -> fetch pending, 2nd -> update status, 3rd -> fetch user balance,
      //        4th -> update user balance
      queryResultQueue = [
        { data: mockPendingTransactions, error: null }, // fetch pending
        { data: { id: 'transaction-1' }, error: null }, // update status
        { data: [{ amount: 100, status: 'available' }, { amount: 50, status: 'pending' }], error: null }, // balance calc
        { data: null, error: null }, // update user balance
      ];

      const result = await pointProcessingService.processPendingToAvailable();

      expect(result).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
    });

    it('should handle database errors gracefully', async () => {
      queryResultQueue = [
        { data: null, error: { message: 'Database error' } },
      ];

      await expect(pointProcessingService.processPendingToAvailable())
        .rejects.toThrow('Failed to fetch pending transactions: Database error');
    });

    it('should return 0 when no pending transactions found', async () => {
      queryResultQueue = [
        { data: [], error: null },
      ];

      const result = await pointProcessingService.processPendingToAvailable();

      expect(result).toBe(0);
    });
  });

  describe('processExpiredPoints', () => {
    it('should process expired transactions successfully', async () => {
      const mockExpiredTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 100,
          expires_at: '2024-01-01T00:00:00.000Z',
          description: 'Expired transaction'
        }
      ];

      // Queue: 1st -> fetch expired, 2nd -> update status, 3rd -> fetch user balance,
      //        4th -> update user balance
      queryResultQueue = [
        { data: mockExpiredTransactions, error: null },
        { data: { id: 'transaction-1' }, error: null },
        { data: [{ amount: 100, status: 'available' }, { amount: 50, status: 'pending' }], error: null },
        { data: null, error: null },
      ];

      const result = await pointProcessingService.processExpiredPoints();

      expect(result).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
    });

    it('should handle database errors gracefully', async () => {
      queryResultQueue = [
        { data: null, error: { message: 'Database error' } },
      ];

      await expect(pointProcessingService.processExpiredPoints())
        .rejects.toThrow('Failed to fetch expired transactions: Database error');
    });
  });

  describe('sendExpirationWarnings', () => {
    it('should send warnings for expiring transactions', async () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockExpiringTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 100,
          expires_at: sevenDaysFromNow.toISOString(),
          description: 'Expiring transaction'
        }
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          push_notifications_enabled: true
        }
      ];

      // Queue: 1st -> fetch expiring transactions, 2nd -> fetch users, 3rd -> insert notification
      queryResultQueue = [
        { data: mockExpiringTransactions, error: null },
        { data: mockUsers, error: null },
        { data: { id: 'notification-1' }, error: null },
      ];

      const result = await pointProcessingService.sendExpirationWarnings();

      expect(result).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
      expect(mockSupabase.from).toHaveBeenCalledWith('users');
      expect(mockSupabase.from).toHaveBeenCalledWith('notifications');
    });

    it('should skip notifications for users with disabled push notifications', async () => {
      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

      const mockExpiringTransactions = [
        {
          id: 'transaction-1',
          user_id: 'user-1',
          amount: 100,
          expires_at: sevenDaysFromNow.toISOString(),
          description: 'Expiring transaction'
        }
      ];

      const mockUsers = [
        {
          id: 'user-1',
          email: 'user1@example.com',
          name: 'User 1',
          push_notifications_enabled: false
        }
      ];

      // Queue: 1st -> fetch expiring transactions, 2nd -> fetch users
      queryResultQueue = [
        { data: mockExpiringTransactions, error: null },
        { data: mockUsers, error: null },
      ];

      const result = await pointProcessingService.sendExpirationWarnings();

      expect(result).toBe(0);
    });
  });

  describe('runAllProcessingTasks', () => {
    it('should run all processing tasks and return comprehensive stats', async () => {
      const mockProcessPending = jest.spyOn(pointProcessingService, 'processPendingToAvailable').mockResolvedValue(5);
      const mockProcessExpired = jest.spyOn(pointProcessingService, 'processExpiredPoints').mockResolvedValue(3);
      const mockSendWarnings = jest.spyOn(pointProcessingService, 'sendExpirationWarnings').mockResolvedValue(2);

      const result = await pointProcessingService.runAllProcessingTasks();

      expect(result).toEqual({
        pendingProcessed: 5,
        expiredProcessed: 3,
        warningsSent: 2,
        errors: 0,
        processingTime: expect.any(Number)
      });

      expect(mockProcessPending).toHaveBeenCalled();
      expect(mockProcessExpired).toHaveBeenCalled();
      expect(mockSendWarnings).toHaveBeenCalled();

      mockProcessPending.mockRestore();
      mockProcessExpired.mockRestore();
      mockSendWarnings.mockRestore();
    });

    it('should handle errors in individual tasks gracefully', async () => {
      const mockProcessPending = jest.spyOn(pointProcessingService, 'processPendingToAvailable').mockRejectedValue(new Error('Pending error'));
      const mockProcessExpired = jest.spyOn(pointProcessingService, 'processExpiredPoints').mockResolvedValue(3);
      const mockSendWarnings = jest.spyOn(pointProcessingService, 'sendExpirationWarnings').mockResolvedValue(2);

      const result = await pointProcessingService.runAllProcessingTasks();

      expect(result).toEqual({
        pendingProcessed: 0,
        expiredProcessed: 3,
        warningsSent: 2,
        errors: 1,
        processingTime: expect.any(Number)
      });

      mockProcessPending.mockRestore();
      mockProcessExpired.mockRestore();
      mockSendWarnings.mockRestore();
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      // Queue: 3 count queries (pending, expiring, expired)
      queryResultQueue = [
        { count: 10, error: null },
        { count: 5, error: null },
        { count: 3, error: null },
      ];

      const result = await pointProcessingService.getProcessingStats();

      expect(result).toEqual({
        pendingCount: 10,
        expiringCount: 5,
        expiredCount: 3
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
    });

    it('should handle database errors gracefully', async () => {
      // The service catches the error and re-throws
      // The first query destructures { count }, which will be undefined on error
      // But the service accesses count directly, and if error exists, it would throw at the catch
      // Actually looking at the source: it just destructures { count } and uses count || 0
      // The error is not checked per-query, so let's test the outer catch
      // Actually let's test with a throw scenario

      // Mock from() to throw
      mockSupabase.from = jest.fn(() => {
        throw new Error('Database error');
      });

      await expect(pointProcessingService.getProcessingStats())
        .rejects.toThrow();
    });
  });
});

describe('FIFO Point Usage Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();
  });

  describe('usePointsFIFO', () => {
    it('should use points via RPC transaction', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');

      // The FIFO service uses supabase.rpc('use_points_fifo_transaction', ...)
      queryResultQueue = [
        {
          data: [{
            success: true,
            total_used: 150,
            remaining_balance: 200,
            transactions_used: [
              { transactionId: 't1', originalAmount: 100, usedAmount: 100, remainingAmount: 0, availableFrom: '2024-01-01', createdAt: '2024-01-01' },
              { transactionId: 't2', originalAmount: 200, usedAmount: 50, remainingAmount: 150, availableFrom: '2024-01-02', createdAt: '2024-01-02' },
            ],
            new_transaction_id: 'usage-1',
          }],
          error: null
        },
      ];

      const result = await fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 150,
        reservationId: 'res-1',
        description: 'Test reservation'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(150);
      expect(result.remainingBalance).toBe(200);
      expect(result.newTransactionId).toBe('usage-1');
    });

    it('should handle RPC transaction failure', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');

      queryResultQueue = [
        { data: null, error: { message: 'Insufficient points' } },
      ];

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 150,
        reservationId: 'res-1',
        description: 'Test reservation'
      })).rejects.toThrow('Point usage failed: Insufficient points');
    });

    it('should handle unsuccessful RPC result', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');

      queryResultQueue = [
        {
          data: [{
            success: false,
            error_message: 'Insufficient balance'
          }],
          error: null
        },
      ];

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 150,
        reservationId: 'res-1',
        description: 'Test reservation'
      })).rejects.toThrow('Insufficient balance');
    });

    it('should validate request parameters', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: '',
        amountToUse: 150,
      })).rejects.toThrow('User ID is required');

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 0,
      })).rejects.toThrow('Amount to use must be positive');

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 2000000,
      })).rejects.toThrow('Maximum usage amount is 1,000,000 points');
    });

    it('should handle empty RPC result', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');

      queryResultQueue = [
        { data: [], error: null },
      ];

      await expect(fifoPointUsageService.usePointsFIFO({
        userId: 'user-1',
        amountToUse: 150,
        reservationId: 'res-1',
      })).rejects.toThrow('No transaction result returned');
    });
  });
});
