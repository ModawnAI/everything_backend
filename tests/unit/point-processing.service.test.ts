/**
 * Point Processing Service Tests
 * 
 * Comprehensive tests for automated point processing functionality including:
 * - 7-day pending period processing
 * - Point expiration handling
 * - Expiration warning notifications
 * - Processing statistics
 */

import { PointProcessingService } from '../../src/services/point-processing.service';

// Use real database - no mocking

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('PointProcessingService', () => {
  let pointProcessingService: PointProcessingService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      lt: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      in: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      count: jest.fn().mockReturnThis()
    };

    // Mock the getSupabaseClient function
    const { getSupabaseClient } = require('../../src/config/database');
    getSupabaseClient.mockReturnValue(mockSupabase);

    // Create service instance
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

      // Mock the query chain
      mockSupabase.lte.mockResolvedValue({
        data: mockPendingTransactions,
        error: null
      });

      // Mock the update chain for each transaction
      mockSupabase.update.mockResolvedValue({
        data: { id: 'transaction-1' },
        error: null
      });

      // Mock the balance update query
      mockSupabase.select.mockResolvedValue({
        data: [
          { amount: 100, status: 'available' },
          { amount: 50, status: 'pending' }
        ],
        error: null
      });

      const result = await pointProcessingService.processPendingToAvailable();

      expect(result).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, user_id, amount, available_from, description');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'pending');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.lte.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(pointProcessingService.processPendingToAvailable()).rejects.toThrow('Failed to fetch pending transactions: Database error');
    });

    it('should return 0 when no pending transactions found', async () => {
      mockSupabase.lte.mockResolvedValue({
        data: [],
        error: null
      });

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

      mockSupabase.lt.mockResolvedValue({
        data: mockExpiredTransactions,
        error: null
      });

      mockSupabase.update.mockResolvedValue({
        data: { id: 'transaction-1' },
        error: null
      });

      // Mock the balance update query
      mockSupabase.select.mockResolvedValue({
        data: [
          { amount: 100, status: 'available' },
          { amount: 50, status: 'pending' }
        ],
        error: null
      });

      const result = await pointProcessingService.processExpiredPoints();

      expect(result).toBe(1);
      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
      expect(mockSupabase.select).toHaveBeenCalledWith('id, user_id, amount, expires_at, description');
      expect(mockSupabase.eq).toHaveBeenCalledWith('status', 'available');
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.lt.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(pointProcessingService.processExpiredPoints()).rejects.toThrow('Failed to fetch expired transactions: Database error');
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

      // Mock the first query (expiring transactions)
      mockSupabase.lte.mockResolvedValueOnce({
        data: mockExpiringTransactions,
        error: null
      });

      // Mock the second query (users)
      mockSupabase.in.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      // Mock the insert (notification)
      mockSupabase.insert.mockResolvedValue({
        data: { id: 'notification-1' },
        error: null
      });

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

      mockSupabase.lte.mockResolvedValueOnce({
        data: mockExpiringTransactions,
        error: null
      });

      mockSupabase.in.mockResolvedValue({
        data: mockUsers,
        error: null
      });

      const result = await pointProcessingService.sendExpirationWarnings();

      expect(result).toBe(0);
      expect(mockSupabase.from).not.toHaveBeenCalledWith('notifications');
    });
  });

  describe('runAllProcessingTasks', () => {
    it('should run all processing tasks and return comprehensive stats', async () => {
      // Mock all individual methods
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

      // Restore mocks
      mockProcessPending.mockRestore();
      mockProcessExpired.mockRestore();
      mockSendWarnings.mockRestore();
    });

    it('should handle errors in individual tasks gracefully', async () => {
      // Mock methods to throw errors
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

      // Restore mocks
      mockProcessPending.mockRestore();
      mockProcessExpired.mockRestore();
      mockSendWarnings.mockRestore();
    });
  });

  describe('getProcessingStats', () => {
    it('should return processing statistics', async () => {
      // Mock the count queries
      mockSupabase.count
        .mockResolvedValueOnce({
          count: 10,
          error: null
        })
        .mockResolvedValueOnce({
          count: 5,
          error: null
        })
        .mockResolvedValueOnce({
          count: 3,
          error: null
        });

      const result = await pointProcessingService.getProcessingStats();

      expect(result).toEqual({
        pendingCount: 10,
        expiringCount: 5,
        expiredCount: 3
      });

      expect(mockSupabase.from).toHaveBeenCalledWith('point_transactions');
      expect(mockSupabase.count).toHaveBeenCalledTimes(3);
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.count.mockResolvedValue({
        count: null,
        error: { message: 'Database error' }
      });

      await expect(pointProcessingService.getProcessingStats()).rejects.toThrow('Error getting processing stats');
    });
  });
}); 

describe('FIFO Point Usage Service', () => {
  let mockSupabase: any;
  const userId = 'user-1';
  const reservationId = 'res-1';

  beforeEach(() => {
    // Create a comprehensive mock structure for all chainable methods
    const createMockChain = () => {
      const chain: any = {};
      
      // Add all possible chainable methods
      const methods = ['select', 'eq', 'gt', 'lt', 'lte', 'gte', 'order', 'single', 'update', 'insert', 'from'];
      
      methods.forEach(method => {
        chain[method] = jest.fn().mockReturnValue(chain);
      });
      
      // Special handling for data/error properties
      chain.data = null;
      chain.error = null;
      
      return chain;
    };

    mockSupabase = {
      from: jest.fn().mockReturnValue(createMockChain()),
      rpc: jest.fn().mockReturnValue(createMockChain())
    };
    
    // Patch getSupabaseClient to return mockSupabase
    jest.spyOn(require('../../src/config/database'), 'getSupabaseClient').mockReturnValue(mockSupabase);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('usePoints', () => {
    it('should consume points in FIFO order (oldest first)', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');
      
      const availableTransactions = [
        { id: 't1', amount: 100, available_from: '2024-01-01T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service A', status: 'available' },
        { id: 't2', amount: 50, available_from: '2024-01-02T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service B', status: 'available' },
        { id: 't3', amount: 200, available_from: '2024-01-03T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service C', status: 'available' }
      ];

      // Mock user query
      const mockUserChain = createMockChain();
      mockUserChain.data = { id: userId, name: 'Test User' };
      mockUserChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUserChain);

      // Mock available transactions query
      const mockTransactionsChain = createMockChain();
      mockTransactionsChain.data = availableTransactions;
      mockTransactionsChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockTransactionsChain);

      // Mock update queries for consumed transactions
      const mockUpdateChain1 = createMockChain();
      mockUpdateChain1.data = { id: 't1', amount: 0 };
      mockUpdateChain1.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain1);

      const mockUpdateChain2 = createMockChain();
      mockUpdateChain2.data = { id: 't2', amount: 0 };
      mockUpdateChain2.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain2);

      // Mock insert query for usage record
      const mockInsertChain = createMockChain();
      mockInsertChain.data = { 
        id: 'usage-1', 
        user_id: userId, 
        reservation_id: reservationId, 
        amount: 150,
        transaction_type: 'used_service',
        metadata: {
          consumed_transactions: [
            { transaction_id: 't1', consumed_amount: 100 },
            { transaction_id: 't2', consumed_amount: 50 }
          ]
        }
      };
      mockInsertChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockInsertChain);

      const result = await fifoPointUsageService.usePoints({
        userId,
        amount: 150,
        reservationId,
        description: 'Test reservation'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(150);
      expect(result.consumedTransactions).toHaveLength(2);
      expect(result.consumedTransactions[0].originalTransactionId).toBe('t1');
      expect(result.consumedTransactions[0].consumedAmount).toBe(100);
      expect(result.consumedTransactions[1].originalTransactionId).toBe('t2');
      expect(result.consumedTransactions[1].consumedAmount).toBe(50);
    });

    it('should handle partial usage from multiple transactions', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');
      
      const availableTransactions = [
        { id: 't1', amount: 100, available_from: '2024-01-01T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service A', status: 'available' },
        { id: 't2', amount: 200, available_from: '2024-01-02T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service B', status: 'available' }
      ];

      // Mock user query
      const mockUserChain = createMockChain();
      mockUserChain.data = { id: userId, name: 'Test User' };
      mockUserChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUserChain);

      // Mock available transactions query
      const mockTransactionsChain = createMockChain();
      mockTransactionsChain.data = availableTransactions;
      mockTransactionsChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockTransactionsChain);

      // Mock update queries for consumed transactions
      const mockUpdateChain1 = createMockChain();
      mockUpdateChain1.data = { id: 't1', amount: 0 };
      mockUpdateChain1.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain1);

      const mockUpdateChain2 = createMockChain();
      mockUpdateChain2.data = { id: 't2', amount: 150 };
      mockUpdateChain2.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain2);

      // Mock insert query for usage record
      const mockInsertChain = createMockChain();
      mockInsertChain.data = { 
        id: 'usage-1', 
        user_id: userId, 
        reservation_id: reservationId, 
        amount: 150,
        transaction_type: 'used_service',
        metadata: {
          consumed_transactions: [
            { transaction_id: 't1', consumed_amount: 100 },
            { transaction_id: 't2', consumed_amount: 50 }
          ]
        }
      };
      mockInsertChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockInsertChain);

      const result = await fifoPointUsageService.usePoints({
        userId,
        amount: 150,
        reservationId,
        description: 'Test reservation'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(150);
      expect(result.consumedTransactions).toHaveLength(2);
      expect(result.consumedTransactions[0].consumedAmount).toBe(100);
      expect(result.consumedTransactions[1].consumedAmount).toBe(50);
    });

    it('should not consume any points when insufficient points available', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');
      
      const availableTransactions = [
        { id: 't1', amount: 50, available_from: '2024-01-01T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service A', status: 'available' }
      ];

      // Mock user query
      const mockUserChain = createMockChain();
      mockUserChain.data = { id: userId, name: 'Test User' };
      mockUserChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUserChain);

      // Mock available transactions query
      const mockTransactionsChain = createMockChain();
      mockTransactionsChain.data = availableTransactions;
      mockTransactionsChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockTransactionsChain);

      const result = await fifoPointUsageService.usePoints({
        userId,
        amount: 100,
        reservationId,
        description: 'Test reservation'
      });

      expect(result.success).toBe(false);
      expect(result.totalUsed).toBe(0);
      expect(result.rollbackRequired).toBe(false);
      expect(result.rollbackReason).toContain('Insufficient points');
    });

    it('should handle rollback after usage failure', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');
      
      const availableTransactions = [
        { id: 't1', amount: 100, available_from: '2024-01-01T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service A', status: 'available' }
      ];

      // Mock user query
      const mockUserChain = createMockChain();
      mockUserChain.data = { id: userId, name: 'Test User' };
      mockUserChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUserChain);

      // Mock available transactions query
      const mockTransactionsChain = createMockChain();
      mockTransactionsChain.data = availableTransactions;
      mockTransactionsChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockTransactionsChain);

      // Mock the update query to fail
      const mockUpdateChain = createMockChain();
      mockUpdateChain.data = null;
      mockUpdateChain.error = { message: 'Database error' };
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain);

      await expect(fifoPointUsageService.usePoints({
        userId,
        amount: 50,
        reservationId,
        description: 'Test reservation'
      })).rejects.toThrow('Failed to update transaction');
    });

    it('should provide detailed breakdown of consumed transactions', async () => {
      const { fifoPointUsageService } = require('../../src/services/fifo-point-usage.service');
      
      const availableTransactions = [
        { id: 't1', amount: 100, available_from: '2024-01-01T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service A', status: 'available' },
        { id: 't2', amount: 50, available_from: '2024-01-02T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service B', status: 'available' },
        { id: 't3', amount: 200, available_from: '2024-01-03T00:00:00Z', expires_at: '2024-12-31T23:59:59Z', transaction_type: 'earned_service', description: 'Service C', status: 'available' }
      ];

      // Mock user query
      const mockUserChain = createMockChain();
      mockUserChain.data = { id: userId, name: 'Test User' };
      mockUserChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUserChain);

      // Mock available transactions query
      const mockTransactionsChain = createMockChain();
      mockTransactionsChain.data = availableTransactions;
      mockTransactionsChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockTransactionsChain);

      // Mock update queries for consumed transactions
      const mockUpdateChain1 = createMockChain();
      mockUpdateChain1.data = { id: 't1', amount: 0 };
      mockUpdateChain1.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain1);

      const mockUpdateChain2 = createMockChain();
      mockUpdateChain2.data = { id: 't2', amount: 0 };
      mockUpdateChain2.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain2);

      const mockUpdateChain3 = createMockChain();
      mockUpdateChain3.data = { id: 't3', amount: 150 };
      mockUpdateChain3.error = null;
      mockSupabase.from.mockReturnValueOnce(mockUpdateChain3);

      // Mock insert query for usage record
      const mockInsertChain = createMockChain();
      mockInsertChain.data = { 
        id: 'usage-1', 
        user_id: userId, 
        reservation_id: reservationId, 
        amount: 200,
        transaction_type: 'used_service',
        metadata: {
          consumed_transactions: [
            { transaction_id: 't1', consumed_amount: 100 },
            { transaction_id: 't2', consumed_amount: 50 },
            { transaction_id: 't3', consumed_amount: 50 }
          ]
        }
      };
      mockInsertChain.error = null;
      mockSupabase.from.mockReturnValueOnce(mockInsertChain);

      const result = await fifoPointUsageService.usePoints({
        userId,
        amount: 200,
        reservationId,
        description: 'Test reservation'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(200);
      expect(result.consumedTransactions).toHaveLength(3);
      
      // Verify FIFO order (oldest first)
      expect(result.consumedTransactions[0].originalTransactionId).toBe('t1');
      expect(result.consumedTransactions[0].consumedAmount).toBe(100);
      expect(result.consumedTransactions[1].originalTransactionId).toBe('t2');
      expect(result.consumedTransactions[1].consumedAmount).toBe(50);
      expect(result.consumedTransactions[2].originalTransactionId).toBe('t3');
      expect(result.consumedTransactions[2].consumedAmount).toBe(50);
    });
  });

  // Helper function to create mock chain
  function createMockChain() {
    const chain: any = {};
    
    // Add all possible chainable methods
    const methods = ['select', 'eq', 'gt', 'lt', 'lte', 'gte', 'order', 'single', 'update', 'insert', 'from'];
    
    methods.forEach(method => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    
    // Special handling for data/error properties
    chain.data = null;
    chain.error = null;
    
    return chain;
  }
}); 