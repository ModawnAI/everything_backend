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

// Persistent mock Supabase object — singleton controller captures this at module load
const mockSupabase: any = {};
let queryResultQueue: any[] = [];
let defaultQueryResult: any = { data: [], error: null };

function createChainableQueryMock() {
  // If there are queued results, pop the first one; otherwise use default
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
  mockSupabase.rpc = jest.fn().mockResolvedValue({ data: null, error: null });
}
resetMockSupabase();

jest.mock('../../src/config/database', () => ({
  getSupabaseClient: () => mockSupabase,
  initializeDatabase: jest.fn(),
  getDatabase: jest.fn(),
  database: { getClient: () => mockSupabase },
}));
jest.mock('../../src/services/admin-financial.service');
jest.mock('../../src/services/admin-adjustment.service');
jest.mock('../../src/services/admin-payment.service');
jest.mock('../../src/services/refund.service');
jest.mock('../../src/services/point.service');
jest.mock('../../src/services/portone.service');
jest.mock('../../src/utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { adminFinancialController } from '../../src/controllers/admin-financial.controller';
import { adminAdjustmentService } from '../../src/services/admin-adjustment.service';

const mockAdminAdjustmentService = adminAdjustmentService as jest.Mocked<typeof adminAdjustmentService>;

describe('AdminFinancialController', () => {
  let mockRequest: any;
  let mockResponse: any;

  beforeEach(() => {
    jest.clearAllMocks();
    resetMockSupabase();

    mockRequest = {
      user: {
        id: 'admin-id',
        email: 'admin@example.com',
        role: 'admin',
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

      // Queue: 1st from() -> payments, 2nd from() -> refunds, 3rd from() -> audit log insert
      queryResultQueue = [
        { data: mockPayments, error: null },
        { data: mockRefunds, error: null },
        { data: null, error: null }, // audit log
      ];

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
            totalCommissions: 8750,
            netRevenue: 141250,
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
      mockRequest.user.role = 'customer';

      await adminFinancialController.getPaymentOverview(mockRequest, mockResponse);

      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(mockResponse.json).toHaveBeenCalledWith({
        error: 'Admin access required'
      });
    });

    it('should handle database errors gracefully', async () => {
      queryResultQueue = [
        { data: null, error: { message: 'Database connection failed' } },
      ];

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

      // Queue: 1st from() -> point_transactions, 2nd from() -> users (balances), 3rd -> audit log
      queryResultQueue = [
        { data: mockPointTransactions, error: null },
        { data: mockUserBalances, error: null },
        { data: null, error: null }, // audit log
      ];

      await adminFinancialController.getPointSystemOverview(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalPointsIssued: 2500,
            totalPointsUsed: 1000,
            totalPointsExpired: 0,
            activePointBalance: 10000,
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

      mockAdminAdjustmentService.adjustUserPoints = jest.fn().mockResolvedValueOnce(mockAdjustmentResult);

      mockRequest.body = {
        userId: 'user-1',
        amount: 5000,
        adjustmentType: 'add',
        reason: 'Customer service compensation',
        category: 'customer_service',
        notes: 'Compensation for service issue'
      };

      // Queue for audit log insert
      queryResultQueue = [
        { data: null, error: null },
      ];

      await adminFinancialController.processPointAdjustment(mockRequest, mockResponse);

      expect(mockAdminAdjustmentService.adjustUserPoints).toHaveBeenCalledWith({
        userId: 'user-1',
        amount: 5000,
        adjustmentType: 'add',
        reason: 'Customer service compensation',
        category: 'customer_service',
        adminId: 'admin-id',
        notes: 'Compensation for service issue',
        requiresApproval: false
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
        status: 'pending'
      };

      mockAdminAdjustmentService.adjustUserPoints = jest.fn().mockResolvedValueOnce(mockAdjustmentResult);

      mockRequest.body = {
        userId: 'user-1',
        amount: 15000,
        adjustmentType: 'add',
        reason: 'Large compensation',
        category: 'customer_service'
      };

      // Queue for audit log insert
      queryResultQueue = [
        { data: null, error: null },
      ];

      await adminFinancialController.processPointAdjustment(mockRequest, mockResponse);

      expect(mockAdminAdjustmentService.adjustUserPoints).toHaveBeenCalledWith(
        expect.objectContaining({
          requiresApproval: true
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

      // Queue: 1st from() -> shop, 2nd -> payments, 3rd -> refunds, 4th -> audit log
      queryResultQueue = [
        { data: mockShop, error: null },
        { data: mockPayments, error: null },
        { data: mockRefunds, error: null },
        { data: null, error: null }, // audit log
      ];

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
            grossRevenue: 250000,
            totalTransactions: 2,
            averageTransactionValue: 125000
          }),
          commissions: expect.objectContaining({
            platformCommissionRate: 0.05,
            platformCommissionAmount: 12500,
            paymentProcessingFee: 7310,
            totalDeductions: 19810
          }),
          refunds: expect.objectContaining({
            totalRefunds: 1,
            refundAmount: 25000,
            refundImpact: 25000
          }),
          payout: expect.objectContaining({
            netAmount: 205190,
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
      queryResultQueue = [
        { data: null, error: { message: 'Shop not found' } },
      ];

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

      // Queue for audit log insert
      queryResultQueue = [
        { data: null, error: null },
      ];

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
            shops: { name: 'Test Shop', owner_id: 'owner-1' },
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
            shops: { name: 'Test Shop 2', owner_id: 'owner-2' },
            users: { name: 'Test User 2', email: 'user2@example.com' }
          }
        }
      ];

      // Queue: 1st from() -> refunds query, 2nd -> audit log
      queryResultQueue = [
        { data: mockRefunds, error: null },
        { data: null, error: null }, // audit log
      ];

      await adminFinancialController.getRefundManagement(mockRequest, mockResponse);

      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          summary: expect.objectContaining({
            totalRefunds: 2,
            totalRefundAmount: 137500,
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
          reservation_id: 'reservation-2',
          refund_status: 'pending',
          refund_reason: 'Late cancellation',
          requested_amount: 75000,
          refunded_amount: 37500,
          triggered_by: 'user',
          created_at: '2024-01-16T14:00:00Z',
          processed_at: null,
          reservations: {
            id: 'reservation-2',
            shop_id: 'shop-2',
            user_id: 'user-2',
            total_price: 75000,
            shops: { name: 'Test Shop', owner_id: 'owner-1' },
            users: { name: 'Test User', email: 'user@example.com' }
          }
        }
      ];

      // Queue: 1st from() -> refunds, 2nd -> audit log
      queryResultQueue = [
        { data: mockPendingRefunds, error: null },
        { data: null, error: null }, // audit log
      ];

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
