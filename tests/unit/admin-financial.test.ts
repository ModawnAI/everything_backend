/**
 * Admin Financial Management Unit Tests
 * 
 * Tests the comprehensive admin financial management system:
 * - Payment overview and analytics
 * - Point system administration
 * - Shop payout calculations
 * - Financial reporting
 * - Refund management
 * - Admin action logging
 */

import { adminFinancialController } from '../../src/controllers/admin-financial.controller';
import { adminFinancialService } from '../../src/services/admin-financial.service';
import { adminAdjustmentService } from '../../src/services/admin-adjustment.service';

// Mock dependencies
jest.mock('../../src/config/database');
jest.mock('../../src/services/admin-financial.service');
jest.mock('../../src/services/admin-adjustment.service');
jest.mock('../../src/utils/logger');

// Create mock Supabase client
const mockSupabase = {
  from: jest.fn(() => ({
    select: jest.fn(() => ({
      eq: jest.fn(() => ({
        single: jest.fn(),
        order: jest.fn(() => ({
          limit: jest.fn()
        })),
        gte: jest.fn(() => ({
          lte: jest.fn(() => ({
            in: jest.fn(() => ({
              order: jest.fn()
            }))
          }))
        }))
      })),
      gte: jest.fn(() => ({
        lte: jest.fn(() => ({
          eq: jest.fn()
        }))
      })),
      in: jest.fn(() => ({
        order: jest.fn()
      }))
    })),
    insert: jest.fn(() => ({
      select: jest.fn(() => ({
        single: jest.fn()
      }))
    })),
    update: jest.fn(() => ({
      eq: jest.fn()
    })),
    delete: jest.fn(() => ({
      eq: jest.fn()
    }))
  })),
  rpc: jest.fn()
};

// Mock the database module
jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase
}));

// Mock services
const mockAdminFinancialService = adminFinancialService as jest.Mocked<typeof adminFinancialService>;
const mockAdminAdjustmentService = adminAdjustmentService as jest.Mocked<typeof adminAdjustmentService>;

describe('AdminFinancialController', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockRequest = {
      user: {
        id: 'admin-id',
        email: 'admin@example.com',
        user_role: 'admin',
        name: 'Test Admin'
      },
      query: {},
      body: {}
    };

    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
  });

  describe('getPaymentOverview', () => {
    it('should return comprehensive payment overview for admin', async () => {
      const mockPayments = [
        {
          id: 'payment-1',
          amount: 100000,
          payment_method: 'card',
          payment_status: 'fully_paid',
          created_at: '2024-01-15T10:00:00Z',
          reservation_id: 'reservation-1',
          reservations: {
            user_id: 'user-1',
            shop_id: 'shop-1',
            users: { name: 'Test User', email: 'user@example.com' },
            shops: { name: 'Test Shop' }
          }
        },
        {
          id: 'payment-2',
          amount: 75000,
          payment_method: 'bank_transfer',
          payment_status: 'fully_paid',
          created_at: '2024-01-16T14:00:00Z',
          reservation_id: 'reservation-2',
          reservations: {
            user_id: 'user-2',
            shop_id: 'shop-2',
            users: { name: 'Test User 2', email: 'user2@example.com' },
            shops: { name: 'Test Shop 2' }
          }
        }
      ];

      const mockRefunds = [
        {
          id: 'refund-1',
          refunded_amount: 25000,
          created_at: '2024-01-17T09:00:00Z'
        }
      ];

      // Mock database calls
      mockSupabase.from().select().gte().lte().eq().in.mockResolvedValueOnce({
        data: mockPayments,
        error: null
      });

      mockSupabase.from().select().gte().lte().eq.mockResolvedValueOnce({
        data: mockRefunds,
        error: null
      });

      mockRequest.query = {
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await adminFinancialController.getPaymentOverview(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalRevenue: 175000,
            totalTransactions: 2,
            totalRefunds: 25000,
            totalCommissions: 8750, // 5% of 175000
            netRevenue: 141250, // 175000 - 25000 - 8750
            averageTransactionValue: 87500
          }),
          recentTransactions: expect.arrayContaining([
            expect.objectContaining({
              id: 'payment-2',
              amount: 75000,
              paymentMethod: 'bank_transfer',
              userName: 'Test User 2'
            }),
            expect.objectContaining({
              id: 'payment-1',
              amount: 100000,
              paymentMethod: 'card',
              userName: 'Test User'
            })
          ]),
          paymentMethods: expect.objectContaining({
            card: expect.objectContaining({
              count: 1,
              totalAmount: 100000,
              percentage: expect.closeTo(57.14, 1)
            }),
            bank_transfer: expect.objectContaining({
              count: 1,
              totalAmount: 75000,
              percentage: expect.closeTo(42.86, 1)
            })
          })
        })
      );
    });

    it('should reject non-admin users', async () => {
      mockRequest.user.user_role = 'customer';

      await adminFinancialController.getPaymentOverview(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Admin access required'
      });
    });

    it('should handle database errors gracefully', async () => {
      mockSupabase.from().select().gte().lte().eq().in.mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' }
      });

      await adminFinancialController.getPaymentOverview(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Failed to fetch payment overview',
        message: 'Failed to fetch payments: Database connection failed'
      });
    });
  });

  describe('getPointSystemOverview', () => {
    it('should return comprehensive point system overview', async () => {
      const mockPointTransactions = [
        {
          id: 'point-1',
          user_id: 'user-1',
          transaction_type: 'earned_service',
          amount: 2500,
          description: 'Service completion points',
          status: 'available',
          created_at: '2024-01-15T10:00:00Z',
          users: { name: 'Test User', email: 'user@example.com' }
        },
        {
          id: 'point-2',
          user_id: 'user-2',
          transaction_type: 'used_service',
          amount: -1000,
          description: 'Points used for discount',
          status: 'used',
          created_at: '2024-01-16T14:00:00Z',
          users: { name: 'Test User 2', email: 'user2@example.com' }
        }
      ];

      const mockUserBalances = [
        { available_points: 5000 },
        { available_points: 3000 },
        { available_points: 2000 }
      ];

      mockSupabase.from().select().gte().lte().eq.mockResolvedValueOnce({
        data: mockPointTransactions,
        error: null
      });

      mockSupabase.from().select().gt.mockResolvedValueOnce({
        data: mockUserBalances,
        error: null
      });

      await adminFinancialController.getPointSystemOverview(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalPointsIssued: 2500,
            totalPointsUsed: 1000,
            totalPointsExpired: 0,
            activePointBalance: 10000, // 5000 + 3000 + 2000
            totalUsers: 3,
            averagePointsPerUser: expect.closeTo(3333.33, 1)
          }),
          recentTransactions: expect.arrayContaining([
            expect.objectContaining({
              id: 'point-2',
              transactionType: 'used_service',
              amount: -1000,
              userName: 'Test User 2'
            }),
            expect.objectContaining({
              id: 'point-1',
              transactionType: 'earned_service',
              amount: 2500,
              userName: 'Test User'
            })
          ]),
          pointDistribution: expect.objectContaining({
            byTransactionType: expect.objectContaining({
              earned_service: expect.objectContaining({
                count: 1,
                totalAmount: 2500
              }),
              used_service: expect.objectContaining({
                count: 1,
                totalAmount: 1000
              })
            })
          })
        })
      );
    });
  });

  describe('processPointAdjustment', () => {
    it('should process manual point adjustment successfully', async () => {
      const mockAdjustmentResult = {
        id: 'adjustment-1',
        userId: 'user-1',
        amount: 5000,
        adjustmentType: 'add',
        reason: 'Customer service compensation',
        category: 'customer_service',
        requiresApproval: false,
        status: 'completed',
        previousBalance: 10000,
        newBalance: 15000
      };

      mockAdminAdjustmentService.processPointAdjustment.mockResolvedValueOnce(mockAdjustmentResult);

      mockRequest.body = {
        userId: 'user-1',
        amount: 5000,
        adjustmentType: 'add',
        reason: 'Customer service compensation',
        category: 'customer_service',
        notes: 'Compensation for service issue'
      };

      await adminFinancialController.processPointAdjustment(mockRequest, mockResponse);

      expect(mockAdminAdjustmentService.processPointAdjustment).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: 5000,
        adjustmentType: 'add',
        reason: 'Customer service compensation',
        category: 'customer_service',
        adminId: 'admin-id',
        notes: 'Compensation for service issue',
        requiresApproval: false // Amount <= 10,000
      });

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        adjustment: mockAdjustmentResult,
        message: 'Point adjustment processed successfully'
      });
    });

    it('should require approval for large adjustments', async () => {
      const mockAdjustmentResult = {
        id: 'adjustment-2',
        userId: 'user-1',
        amount: 15000,
        adjustmentType: 'add',
        reason: 'Large compensation',
        category: 'customer_service',
        requiresApproval: true,
        status: 'pending_approval'
      };

      mockAdminAdjustmentService.processPointAdjustment.mockResolvedValueOnce(mockAdjustmentResult);

      mockRequest.body = {
        userId: 'user-1',
        amount: 15000,
        adjustmentType: 'add',
        reason: 'Large compensation',
        category: 'customer_service'
      };

      await adminFinancialController.processPointAdjustment(mockRequest, mockResponse);

      expect(mockAdminAdjustmentService.processPointAdjustment).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresApproval: true // Amount > 10,000
        })
      );

      expect(mockResponse.json).toHaveBeenCalledWith({
        success: true,
        adjustment: mockAdjustmentResult,
        message: 'Point adjustment created and pending approval'
      });
    });

    it('should validate required fields', async () => {
      mockRequest.body = {
        userId: 'user-1',
        // Missing required fields
      };

      await adminFinancialController.processPointAdjustment(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required fields'
      });
    });
  });

  describe('calculateShopPayout', () => {
    it('should calculate shop payout with commission management', async () => {
      const mockShop = {
        id: 'shop-1',
        name: 'Test Shop',
        owner_id: 'owner-1'
      };

      const mockPayments = [
        {
          id: 'payment-1',
          amount: 100000,
          created_at: '2024-01-15T10:00:00Z',
          reservations: { shop_id: 'shop-1' }
        },
        {
          id: 'payment-2',
          amount: 150000,
          created_at: '2024-01-16T14:00:00Z',
          reservations: { shop_id: 'shop-1' }
        }
      ];

      const mockRefunds = [
        {
          id: 'refund-1',
          refunded_amount: 25000,
          created_at: '2024-01-17T09:00:00Z',
          reservations: { shop_id: 'shop-1' }
        }
      ];

      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: mockShop,
        error: null
      });

      mockSupabase.from().select().eq().gte().lte().in.mockResolvedValueOnce({
        data: mockPayments,
        error: null
      });

      mockSupabase.from().select().eq().gte().lte().eq.mockResolvedValueOnce({
        data: mockRefunds,
        error: null
      });

      mockRequest.query = {
        shopId: 'shop-1',
        startDate: '2024-01-01',
        endDate: '2024-01-31'
      };

      await adminFinancialController.calculateShopPayout(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          shopId: 'shop-1',
          shopName: 'Test Shop',
          revenue: expect.objectContaining({
            grossRevenue: 250000, // 100000 + 150000
            totalTransactions: 2,
            averageTransactionValue: 125000
          }),
          commissions: expect.objectContaining({
            platformCommissionRate: 0.05,
            platformCommissionAmount: 12500, // 5% of 250000
            paymentProcessingFee: 7310, // 2.9% + 30 KRW per transaction
            totalDeductions: 19810
          }),
          refunds: expect.objectContaining({
            totalRefunds: 1,
            refundAmount: 25000,
            refundImpact: 25000
          }),
          payout: expect.objectContaining({
            netAmount: 205190, // 250000 - 19810 - 25000
            payoutStatus: 'pending',
            payoutMethod: 'bank_transfer'
          })
        })
      );
    });

    it('should require shop ID', async () => {
      mockRequest.query = {};

      await adminFinancialController.calculateShopPayout(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Shop ID is required'
      });
    });

    it('should handle non-existent shop', async () => {
      mockSupabase.from().select().eq().single.mockResolvedValueOnce({
        data: null,
        error: { message: 'Shop not found' }
      });

      mockRequest.query = { shopId: 'non-existent-shop' };

      await adminFinancialController.calculateShopPayout(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Shop not found'
      });
    });
  });

  describe('generateFinancialReport', () => {
    it('should generate summary financial report', async () => {
      mockRequest.body = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        reportType: 'summary',
        format: 'json'
      };

      await adminFinancialController.generateFinancialReport(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          reportType: 'summary',
          period: expect.objectContaining({
            startDate: expect.any(String),
            endDate: expect.any(String)
          }),
          generatedAt: expect.any(String),
          data: expect.objectContaining({
            reportType: 'summary',
            message: 'Summary report data would be generated here'
          })
        })
      );
    });

    it('should validate required report parameters', async () => {
      mockRequest.body = {
        // Missing required fields
        reportType: 'summary'
      };

      await adminFinancialController.generateFinancialReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Missing required report parameters'
      });
    });

    it('should reject invalid report type', async () => {
      mockRequest.body = {
        startDate: '2024-01-01',
        endDate: '2024-01-31',
        reportType: 'invalid_type'
      };

      await adminFinancialController.generateFinancialReport(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Invalid report type'
      });
    });
  });

  describe('getRefundManagement', () => {
    it('should return refund management overview', async () => {
      const mockRefunds = [
        {
          id: 'refund-1',
          reservation_id: 'reservation-1',
          refund_type: 'full',
          refund_reason: 'Customer cancellation',
          requested_amount: 100000,
          refunded_amount: 100000,
          refund_status: 'completed',
          triggered_by: 'user',
          created_at: '2024-01-15T10:00:00Z',
          processed_at: '2024-01-15T10:30:00Z',
          reservations: {
            id: 'reservation-1',
            shop_id: 'shop-1',
            user_id: 'user-1',
            total_price: 100000,
            shops: { name: 'Test Shop' },
            users: { name: 'Test User', email: 'user@example.com' }
          }
        },
        {
          id: 'refund-2',
          reservation_id: 'reservation-2',
          refund_type: 'partial',
          refund_reason: 'Late cancellation',
          requested_amount: 75000,
          refunded_amount: 37500,
          refund_status: 'pending',
          triggered_by: 'user',
          created_at: '2024-01-16T14:00:00Z',
          processed_at: null,
          reservations: {
            id: 'reservation-2',
            shop_id: 'shop-2',
            user_id: 'user-2',
            total_price: 75000,
            shops: { name: 'Test Shop 2' },
            users: { name: 'Test User 2', email: 'user2@example.com' }
          }
        }
      ];

      mockSupabase.from().select().gte().lte().order.mockResolvedValueOnce({
        data: mockRefunds,
        error: null
      });

      await adminFinancialController.getRefundManagement(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalRefunds: 2,
            totalRefundAmount: 137500, // 100000 + 37500
            averageRefundAmount: 68750,
            refundsByStatus: expect.objectContaining({
              completed: expect.objectContaining({
                count: 1,
                totalAmount: 100000
              }),
              pending: expect.objectContaining({
                count: 1,
                totalAmount: 37500
              })
            })
          }),
          pendingRefunds: expect.arrayContaining([
            expect.objectContaining({
              id: 'refund-2',
              refundReason: 'Late cancellation',
              requestedAmount: 75000,
              userName: 'Test User 2'
            })
          ]),
          allRefunds: expect.arrayContaining([
            expect.objectContaining({
              id: 'refund-1',
              refundStatus: 'completed',
              refundedAmount: 100000
            }),
            expect.objectContaining({
              id: 'refund-2',
              refundStatus: 'pending',
              refundedAmount: 37500
            })
          ])
        })
      );
    });

    it('should filter refunds by status', async () => {
      mockRequest.query = { status: 'pending' };

      const mockPendingRefunds = [
        {
          id: 'refund-2',
          refund_status: 'pending',
          refunded_amount: 37500,
          reservations: {
            shops: { name: 'Test Shop' },
            users: { name: 'Test User', email: 'user@example.com' }
          }
        }
      ];

      mockSupabase.from().select().gte().lte().eq().order.mockResolvedValueOnce({
        data: mockPendingRefunds,
        error: null
      });

      await adminFinancialController.getRefundManagement(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalRefunds: 1,
            totalRefundAmount: 37500
          })
        })
      );
    });
  });
});

