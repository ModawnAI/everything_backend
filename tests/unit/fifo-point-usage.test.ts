/**
 * FIFO Point Usage Service Unit Tests
 *
 * Tests the First-In-First-Out point usage logic using mock database.
 */

import { createMockSupabase, createQueryMock, setupMockQuery, createDatabaseMock } from '../utils/supabase-mock-helper';

const mockSupabase = createMockSupabase();

jest.mock('../../src/config/database', () => createDatabaseMock(mockSupabase));
jest.mock('../../src/utils/logger', () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { fifoPointUsageService } from '../../src/services/fifo-point-usage.service';
import { POINT_STATUS, POINT_TRANSACTION_TYPES } from '../../src/constants/point-policies';

describe('FIFOPointUsageService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('usePointsFIFO', () => {
    it('should use points in FIFO order', async () => {
      // Mock RPC call
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: true,
          total_used: 1200,
          remaining_balance: 1300,
          new_transaction_id: 'new-tx-1',
          transactions_used: [
            { transactionId: 'older-tx', originalAmount: 1000, usedAmount: 1000, remainingAmount: 0, availableFrom: '2024-01-13T00:00:00Z', createdAt: '2024-01-13T00:00:00Z' },
            { transactionId: 'newer-tx', originalAmount: 1500, usedAmount: 200, remainingAmount: 1300, availableFrom: '2024-01-14T00:00:00Z', createdAt: '2024-01-14T00:00:00Z' }
          ]
        }],
        error: null
      });

      const result = await fifoPointUsageService.usePointsFIFO({
        userId: 'test-user',
        amountToUse: 1200,
        reservationId: 'test-reservation',
        description: 'Test FIFO usage'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(1200);
      expect(result.transactionsUsed).toHaveLength(2);
      expect(result.transactionsUsed[0].usedAmount).toBe(1000);
      expect(result.transactionsUsed[1].usedAmount).toBe(200);
      expect(result.remainingBalance).toBe(1300);

      expect(mockSupabase.rpc).toHaveBeenCalledWith(
        'use_points_fifo_transaction',
        expect.objectContaining({
          p_user_id: 'test-user',
          p_amount_to_use: 1200,
          p_reservation_id: 'test-reservation'
        })
      );
    });

    it('should handle partial point usage correctly', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: true,
          total_used: 800,
          remaining_balance: 1200,
          new_transaction_id: 'new-tx-2',
          transactions_used: [
            { transactionId: 'tx-1', originalAmount: 2000, usedAmount: 800, remainingAmount: 1200, availableFrom: '2024-01-14T00:00:00Z', createdAt: '2024-01-14T00:00:00Z' }
          ]
        }],
        error: null
      });

      const result = await fifoPointUsageService.usePointsFIFO({
        userId: 'test-user',
        amountToUse: 800,
        reservationId: 'test-reservation',
        description: 'Partial usage test'
      });

      expect(result.success).toBe(true);
      expect(result.totalUsed).toBe(800);
      expect(result.remainingBalance).toBe(1200);
    });

    it('should fail when insufficient points available', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: [{
          success: false,
          error_message: 'Insufficient points available'
        }],
        error: null
      });

      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: 'test-user',
          amountToUse: 1000,
          reservationId: 'test-reservation',
          description: 'Insufficient points test'
        })
      ).rejects.toThrow('Insufficient points');
    });

    it('should fail when RPC returns error', async () => {
      mockSupabase.rpc.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: 'test-user',
          amountToUse: 1000,
          reservationId: 'test-reservation',
          description: 'DB error test'
        })
      ).rejects.toThrow('Point usage failed');
    });

    it('should validate request parameters - empty user ID', async () => {
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: '',
          amountToUse: 100,
          description: 'Invalid user ID test'
        })
      ).rejects.toThrow('User ID is required');
    });

    it('should validate request parameters - negative amount', async () => {
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: 'test-user',
          amountToUse: -100,
          description: 'Negative amount test'
        })
      ).rejects.toThrow(/must be positive/);
    });

    it('should validate request parameters - zero amount', async () => {
      await expect(
        fifoPointUsageService.usePointsFIFO({
          userId: 'test-user',
          amountToUse: 0,
          description: 'Zero amount test'
        })
      ).rejects.toThrow(/must be positive/);
    });
  });

  describe('getAvailablePointsFIFO', () => {
    it('should return points in FIFO order', async () => {
      const mockPoints = [
        { id: 'p1', amount: 100, available_from: '2024-01-12T00:00:00Z', created_at: '2024-01-12T00:00:00Z', expires_at: null, description: 'Points 1', metadata: null },
        { id: 'p2', amount: 200, available_from: '2024-01-13T00:00:00Z', created_at: '2024-01-13T00:00:00Z', expires_at: null, description: 'Points 2', metadata: null },
        { id: 'p3', amount: 300, available_from: '2024-01-14T00:00:00Z', created_at: '2024-01-14T00:00:00Z', expires_at: null, description: 'Points 3', metadata: null }
      ];

      setupMockQuery(mockSupabase, 'point_transactions', { data: mockPoints, error: null });

      const availablePoints = await fifoPointUsageService.getAvailablePointsFIFO('test-user');

      expect(availablePoints).toHaveLength(3);
      // Verify FIFO order (oldest first)
      expect(new Date(availablePoints[0].available_from).getTime())
        .toBeLessThan(new Date(availablePoints[1].available_from).getTime());
      expect(new Date(availablePoints[1].available_from).getTime())
        .toBeLessThan(new Date(availablePoints[2].available_from).getTime());
    });

    it('should return empty array when no points available', async () => {
      setupMockQuery(mockSupabase, 'point_transactions', { data: [], error: null });

      const availablePoints = await fifoPointUsageService.getAvailablePointsFIFO('test-user');

      expect(availablePoints).toHaveLength(0);
    });

    it('should throw on database error', async () => {
      setupMockQuery(mockSupabase, 'point_transactions', { data: null, error: { message: 'DB error' } });

      await expect(
        fifoPointUsageService.getAvailablePointsFIFO('test-user')
      ).rejects.toThrow('Failed to get available points');
    });
  });

  describe('calculateUsableAmount', () => {
    it('should calculate correct usable amount', async () => {
      const mockPoints = [
        { id: 'p1', amount: 500, available_from: '2024-01-13T00:00:00Z', created_at: '2024-01-13T00:00:00Z', expires_at: null, description: 'First batch', metadata: null },
        { id: 'p2', amount: 300, available_from: '2024-01-14T00:00:00Z', created_at: '2024-01-14T00:00:00Z', expires_at: null, description: 'Second batch', metadata: null }
      ];

      // Test exact amount
      setupMockQuery(mockSupabase, 'point_transactions', { data: mockPoints, error: null });
      const result1 = await fifoPointUsageService.calculateUsableAmount('test-user', 800);
      expect(result1.canUse).toBe(800);
      expect(result1.insufficient).toBe(false);
      expect(result1.availableBalance).toBe(800);

      // Test partial amount
      setupMockQuery(mockSupabase, 'point_transactions', { data: mockPoints, error: null });
      const result2 = await fifoPointUsageService.calculateUsableAmount('test-user', 600);
      expect(result2.canUse).toBe(600);
      expect(result2.insufficient).toBe(false);
      expect(result2.breakdown).toHaveLength(2);

      // Test insufficient amount
      setupMockQuery(mockSupabase, 'point_transactions', { data: mockPoints, error: null });
      const result3 = await fifoPointUsageService.calculateUsableAmount('test-user', 1000);
      expect(result3.canUse).toBe(800);
      expect(result3.insufficient).toBe(true);
    });
  });

  describe('getPointUsageHistory', () => {
    it('should return usage history in chronological order', async () => {
      const mockHistory = [
        { id: 'h3', user_id: 'test-user', transaction_type: 'used_service', amount: -300, status: 'used', created_at: '2024-01-16T00:00:00Z' },
        { id: 'h2', user_id: 'test-user', transaction_type: 'used_service', amount: -200, status: 'used', created_at: '2024-01-15T00:00:00Z' },
        { id: 'h1', user_id: 'test-user', transaction_type: 'used_service', amount: -100, status: 'used', created_at: '2024-01-14T00:00:00Z' }
      ];

      // First call returns history, second call returns count
      const historyQueryMock = createQueryMock({ data: mockHistory, error: null });
      const countQueryMock = createQueryMock({ data: null, error: null, count: 3 });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return historyQueryMock;
        return countQueryMock;
      });

      const history = await fifoPointUsageService.getPointUsageHistory('test-user', 10, 0);

      expect(history.usageHistory).toHaveLength(3);
      expect(history.totalCount).toBe(3);
      // Newest first
      expect(new Date(history.usageHistory[0].created_at).getTime())
        .toBeGreaterThanOrEqual(new Date(history.usageHistory[1].created_at).getTime());
    });

    it('should handle pagination correctly', async () => {
      const page1Data = [
        { id: 'h5', user_id: 'test-user', transaction_type: 'used_service', amount: -100, status: 'used', created_at: '2024-01-19T00:00:00Z' },
        { id: 'h4', user_id: 'test-user', transaction_type: 'used_service', amount: -100, status: 'used', created_at: '2024-01-18T00:00:00Z' }
      ];

      const historyQueryMock = createQueryMock({ data: page1Data, error: null });
      const countQueryMock = createQueryMock({ data: null, error: null, count: 5 });

      let callCount = 0;
      mockSupabase.from.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return historyQueryMock;
        return countQueryMock;
      });

      const page1 = await fifoPointUsageService.getPointUsageHistory('test-user', 2, 0);
      expect(page1.usageHistory).toHaveLength(2);
      expect(page1.totalCount).toBe(5);
    });
  });
});
