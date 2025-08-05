/**
 * Admin Adjustment Service Tests
 * 
 * Comprehensive tests for admin adjustment functionality including:
 * - Point adjustment creation and validation
 * - Approval workflow management
 * - Audit logging and filtering
 * - Statistics and reporting
 * - Multi-level authorization
 */

import { AdminAdjustmentService, PointAdjustmentRequest } from '../../src/services/admin-adjustment.service';
import { PointAdjustmentCategory } from '../../src/services/admin-adjustment.service';

// Mock database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn()
  }
}));

describe('AdminAdjustmentService', () => {
  let adminAdjustmentService: AdminAdjustmentService;
  let mockSupabase: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create mock Supabase client
    mockSupabase = {
      from: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockReturnThis(),
      order: jest.fn().mockReturnThis(),
      range: jest.fn().mockReturnThis(),
      gte: jest.fn().mockReturnThis(),
      lte: jest.fn().mockReturnThis(),
      ilike: jest.fn().mockReturnThis()
    };

    const { getSupabaseClient } = require('../../src/config/database');
    getSupabaseClient.mockReturnValue(mockSupabase);

    adminAdjustmentService = new AdminAdjustmentService();
  });

  describe('adjustUserPoints', () => {
    const validRequest: PointAdjustmentRequest = {
      userId: '123e4567-e89b-12d3-a456-426614174000',
      amount: 1000,
      reason: 'Customer service compensation',
      adjustmentType: 'add',
      category: 'customer_service',
      adminId: '123e4567-e89b-12d3-a456-426614174001'
    };

    it('should create a point adjustment successfully', async () => {
      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: validRequest.userId, available_points: 5000 },
        error: null
      });

      // Mock balance calculation
      mockSupabase.single.mockResolvedValueOnce({
        data: { available_points: 5000 },
        error: null
      });

      // Mock audit log creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'audit-log-id' },
        error: null
      });

      // Mock adjustment record creation
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'adjustment-id',
          user_id: validRequest.userId,
          amount: validRequest.amount,
          adjustment_type: validRequest.adjustmentType,
          reason: validRequest.reason,
          category: validRequest.category,
          adjusted_by: validRequest.adminId,
          previous_balance: 5000,
          status: 'completed',
          created_at: new Date().toISOString(),
          audit_log_id: 'audit-log-id'
        },
        error: null
      });

      // Mock point transaction creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'transaction-id' },
        error: null
      });

      // Mock user balance update
      mockSupabase.eq.mockResolvedValueOnce({
        error: null
      });

      // Mock adjustment status update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'adjustment-id',
          status: 'completed',
          new_balance: 6000,
          transaction_id: 'transaction-id'
        },
        error: null
      });

      const result = await adminAdjustmentService.adjustUserPoints(validRequest);

      expect(result).toBeDefined();
      expect(result.userId).toBe(validRequest.userId);
      expect(result.amount).toBe(validRequest.amount);
      expect(result.adjustmentType).toBe(validRequest.adjustmentType);
      expect(result.status).toBe('completed');
    });

    it('should require approval for large amounts', async () => {
      const largeAmountRequest: PointAdjustmentRequest = {
        ...validRequest,
        amount: 100000 // Large amount requiring approval
      };

      // Mock user lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: largeAmountRequest.userId, available_points: 5000 },
        error: null
      });

      // Mock balance calculation
      mockSupabase.single.mockResolvedValueOnce({
        data: { available_points: 5000 },
        error: null
      });

      // Mock audit log creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'audit-log-id' },
        error: null
      });

      // Mock adjustment record creation (pending status)
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: 'adjustment-id',
          user_id: largeAmountRequest.userId,
          amount: largeAmountRequest.amount,
          adjustment_type: largeAmountRequest.adjustmentType,
          reason: largeAmountRequest.reason,
          category: largeAmountRequest.category,
          adjusted_by: largeAmountRequest.adminId,
          previous_balance: 5000,
          status: 'pending',
          approval_level: 3,
          created_at: new Date().toISOString(),
          audit_log_id: 'audit-log-id'
        },
        error: null
      });

      const result = await adminAdjustmentService.adjustUserPoints(largeAmountRequest);

      expect(result.status).toBe('pending');
      expect(result.approvalLevel).toBe(3);
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        userId: '',
        amount: 0,
        reason: '',
        adjustmentType: 'add' as const,
        category: 'customer_service' as PointAdjustmentCategory,
        adminId: ''
      };

      await expect(adminAdjustmentService.adjustUserPoints(invalidRequest as any))
        .rejects.toThrow('User ID is required');
    });

    it('should validate amount based on adjustment type', async () => {
      const invalidRequest = {
        ...validRequest,
        adjustmentType: 'add' as const,
        amount: -100 // Negative amount for add
      };

      await expect(adminAdjustmentService.adjustUserPoints(invalidRequest))
        .rejects.toThrow('Add adjustments must have positive amount');
    });

    it('should handle user not found', async () => {
      // Mock user lookup failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'User not found' }
      });

      await expect(adminAdjustmentService.adjustUserPoints(validRequest))
        .rejects.toThrow('User not found');
    });
  });

  describe('approveAdjustment', () => {
    it('should approve a pending adjustment successfully', async () => {
      const adjustmentId = 'adjustment-id';
      const approverId = 'approver-id';
      const approverLevel = 3;

      // Mock adjustment lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          user_id: 'user-id',
          amount: 1000,
          adjustment_type: 'add',
          previous_balance: 5000,
          status: 'pending',
          approval_level: 3
        },
        error: null
      });

      // Mock point transaction creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'transaction-id' },
        error: null
      });

      // Mock user balance update
      mockSupabase.eq.mockResolvedValueOnce({
        error: null
      });

      // Mock adjustment status update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          status: 'completed',
          approved_by: approverId,
          new_balance: 6000,
          transaction_id: 'transaction-id'
        },
        error: null
      });

      const result = await adminAdjustmentService.approveAdjustment(
        adjustmentId,
        approverId,
        approverLevel
      );

      expect(result.status).toBe('completed');
      expect(result.approvedBy).toBe(approverId);
    });

    it('should reject approval with insufficient level', async () => {
      const adjustmentId = 'adjustment-id';
      const approverId = 'approver-id';
      const approverLevel = 1; // Lower level

      // Mock adjustment lookup with higher required level
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          status: 'pending',
          approval_level: 3 // Higher required level
        },
        error: null
      });

      await expect(adminAdjustmentService.approveAdjustment(
        adjustmentId,
        approverId,
        approverLevel
      )).rejects.toThrow('Insufficient approval level');
    });

    it('should reject approval for non-pending adjustment', async () => {
      const adjustmentId = 'adjustment-id';
      const approverId = 'approver-id';
      const approverLevel = 3;

      // Mock adjustment lookup with completed status
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          status: 'completed'
        },
        error: null
      });

      await expect(adminAdjustmentService.approveAdjustment(
        adjustmentId,
        approverId,
        approverLevel
      )).rejects.toThrow('Adjustment is not pending');
    });
  });

  describe('rejectAdjustment', () => {
    it('should reject a pending adjustment successfully', async () => {
      const adjustmentId = 'adjustment-id';
      const rejectorId = 'rejector-id';
      const reason = 'Invalid request';

      // Mock adjustment lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          user_id: 'user-id',
          status: 'pending'
        },
        error: null
      });

      // Mock adjustment status update
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          status: 'rejected',
          rejected_by: rejectorId,
          rejection_reason: reason
        },
        error: null
      });

      // Mock audit log creation
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'audit-log-id' },
        error: null
      });

      const result = await adminAdjustmentService.rejectAdjustment(
        adjustmentId,
        rejectorId,
        reason
      );

      expect(result.status).toBe('rejected');
    });

    it('should reject rejection for non-pending adjustment', async () => {
      const adjustmentId = 'adjustment-id';
      const rejectorId = 'rejector-id';
      const reason = 'Invalid request';

      // Mock adjustment lookup with completed status
      mockSupabase.single.mockResolvedValueOnce({
        data: {
          id: adjustmentId,
          status: 'completed'
        },
        error: null
      });

      await expect(adminAdjustmentService.rejectAdjustment(
        adjustmentId,
        rejectorId,
        reason
      )).rejects.toThrow('Adjustment is not pending');
    });
  });

  describe('getAuditLogs', () => {
    it('should retrieve audit logs with filtering', async () => {
      const filter = {
        adminId: 'admin-id',
        actionType: 'points_adjusted' as any,
        page: 1,
        limit: 20
      };

      // Mock audit logs query
      mockSupabase.range.mockResolvedValueOnce({
        data: [
          {
            id: 'log-1',
            admin_id: 'admin-id',
            action_type: 'points_adjusted',
            target_type: 'user',
            target_id: 'user-id',
            reason: 'Test adjustment',
            metadata: {},
            created_at: new Date().toISOString()
          }
        ],
        error: null,
        count: 1
      });

      const result = await adminAdjustmentService.getAuditLogs(filter);

      expect(result.entries).toHaveLength(1);
      expect(result.totalCount).toBe(1);
      expect(result.entries[0].adminId).toBe('admin-id');
    });

    it('should handle empty audit logs', async () => {
      const filter = { page: 1, limit: 20 };

      // Mock empty audit logs query
      mockSupabase.range.mockResolvedValueOnce({
        data: [],
        error: null,
        count: 0
      });

      const result = await adminAdjustmentService.getAuditLogs(filter);

      expect(result.entries).toHaveLength(0);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('getAdjustmentStats', () => {
    it('should calculate adjustment statistics', async () => {
      const startDate = '2024-01-01';
      const endDate = '2024-12-31';

      // Mock adjustments query
      mockSupabase.select.mockResolvedValueOnce({
        data: [
          {
            amount: 1000,
            status: 'completed',
            category: 'customer_service'
          },
          {
            amount: 2000,
            status: 'pending',
            category: 'promotional'
          },
          {
            amount: 500,
            status: 'rejected',
            category: 'customer_service'
          }
        ],
        error: null
      });

      const result = await adminAdjustmentService.getAdjustmentStats(startDate, endDate);

      expect(result.totalAdjustments).toBe(3);
      expect(result.totalAmount).toBe(3500);
      expect(result.pendingAdjustments).toBe(1);
      expect(result.approvedAdjustments).toBe(1);
      expect(result.rejectedAdjustments).toBe(1);
      expect(result.categoryBreakdown.customer_service.count).toBe(2);
    });

    it('should handle empty adjustments', async () => {
      // Mock empty adjustments query
      mockSupabase.select.mockResolvedValueOnce({
        data: [],
        error: null
      });

      const result = await adminAdjustmentService.getAdjustmentStats();

      expect(result.totalAdjustments).toBe(0);
      expect(result.totalAmount).toBe(0);
      expect(result.averageAmount).toBe(0);
    });
  });
}); 