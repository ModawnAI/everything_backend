import request from 'supertest';
import express from 'express';

// Mock the AdminPaymentService before importing the controller
const mockAdminPaymentService = {
  getPayments: jest.fn(),
  getPaymentSummary: jest.fn(),
  getSettlementReport: jest.fn(),
  processRefund: jest.fn(),
  getPaymentAnalytics: jest.fn()
};

jest.mock('../../src/services/admin-payment.service', () => ({
  AdminPaymentService: jest.fn().mockImplementation(() => mockAdminPaymentService)
}));

// Mock middleware
jest.mock('../../src/middleware/auth.middleware', () => ({
  authenticateJWT: jest.fn((req, res, next) => {
    req.user = { id: 'admin-123', role: 'admin' };
    next();
  }),
  requireRole: jest.fn(() => (req, res, next) => next())
}));

jest.mock('../../src/middleware/rate-limit.middleware', () => ({
  rateLimit: jest.fn(() => (req, res, next) => next())
}));

// Mock logger
jest.mock('../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
  }
}));

// Import after mocks
import { AdminPaymentController } from '../../src/controllers/admin-payment.controller';
import { authenticateJWT, requireRole } from '../../src/middleware/auth.middleware';
import { rateLimit } from '../../src/middleware/rate-limit.middleware';

describe('AdminPaymentController', () => {
  let app: express.Application;
  let adminPaymentController: AdminPaymentController;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    
    adminPaymentController = new AdminPaymentController();
    
    // Setup routes
    app.get('/api/admin/payments', 
      authenticateJWT, 
      requireRole('admin'), 
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
      adminPaymentController.getPayments.bind(adminPaymentController)
    );
    
    app.get('/api/admin/payments/summary',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 50 } }),
      adminPaymentController.getPaymentSummary.bind(adminPaymentController)
    );
    
    app.get('/api/admin/payments/settlements',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }),
      adminPaymentController.getSettlementReport.bind(adminPaymentController)
    );
    
    app.get('/api/admin/payments/analytics',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 30 } }),
      adminPaymentController.getPaymentAnalytics.bind(adminPaymentController)
    );
    
    app.get('/api/admin/payments/export',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 10 } }),
      adminPaymentController.exportPayments.bind(adminPaymentController)
    );
    
    app.get('/api/admin/payments/:paymentId',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 100 } }),
      adminPaymentController.getPaymentDetails.bind(adminPaymentController)
    );
    
    app.post('/api/admin/payments/:paymentId/refund',
      authenticateJWT,
      requireRole('admin'),
      rateLimit({ config: { windowMs: 15 * 60 * 1000, max: 20 } }),
      adminPaymentController.processRefund.bind(adminPaymentController)
    );

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /api/admin/payments', () => {
    it('should return payment list with filters', async () => {
      const mockPayments = {
        payments: [
          {
            id: 'payment-123',
            reservationId: 'reservation-123',
            userId: 'user-123',
            paymentMethod: 'card',
            paymentStatus: 'completed',
            amount: 50000,
            currency: 'KRW',
            isDeposit: false,
            paidAt: '2024-01-01T10:00:00Z',
            refundedAt: null,
            refundAmount: 0,
            netAmount: 50000,
            customer: {
              id: 'user-123',
              name: 'Test User',
              email: 'test@example.com',
              phoneNumber: '010-1234-5678'
            },
            shop: {
              id: 'shop-123',
              name: 'Test Shop',
              mainCategory: 'beauty',
              shopStatus: 'active'
            },
            reservation: {
              id: 'reservation-123',
              reservationDate: '2024-01-01',
              reservationTime: '10:00',
              status: 'confirmed',
              totalAmount: 50000
            }
          }
        ],
        totalCount: 1,
        hasMore: false,
        currentPage: 1,
        totalPages: 1,
        filters: {}
      };

      mockAdminPaymentService.getPayments.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/admin/payments')
        .query({
          status: 'completed',
          paymentMethod: 'card',
          page: 1,
          limit: 20
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPayments);
      expect(response.body.message).toBe('결제 내역을 성공적으로 조회했습니다.');
      expect(mockAdminPaymentService.getPayments).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'completed',
          paymentMethod: 'card',
          page: 1,
          limit: 20
        }),
        'admin-123'
      );
    });

    it('should handle service errors', async () => {
      mockAdminPaymentService.getPayments.mockRejectedValue(new Error('Database error'));

      const response = await request(app)
        .get('/api/admin/payments')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('PAYMENT_5001');
      expect(response.body.message).toBe('결제 내역 조회 중 오류가 발생했습니다.');
    });
  });

  describe('GET /api/admin/payments/summary', () => {
    it('should return payment summary', async () => {
      const mockSummary = {
        totalPayments: 100,
        totalAmount: 5000000,
        totalRefunds: 500000,
        netRevenue: 4500000,
        averagePaymentAmount: 50000,
        paymentsByStatus: {
          completed: 80,
          pending: 10,
          failed: 10
        },
        paymentsByMethod: {
          card: 70,
          transfer: 20,
          cash: 10
        },
        paymentsByShop: [
          {
            shopId: 'shop-123',
            shopName: 'Test Shop',
            count: 50,
            amount: 2500000,
            refunds: 250000,
            netAmount: 2250000
          }
        ],
        dailyPayments: [
          {
            date: '2024-01-01',
            count: 10,
            amount: 500000,
            refunds: 50000,
            netAmount: 450000
          }
        ]
      };

      mockAdminPaymentService.getPaymentSummary.mockResolvedValue(mockSummary);

      const response = await request(app)
        .get('/api/admin/payments/summary')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSummary);
      expect(response.body.message).toBe('결제 요약 정보를 성공적으로 조회했습니다.');
    });
  });

  describe('GET /api/admin/payments/settlements', () => {
    it('should return settlement report', async () => {
      const mockSettlementReport = {
        settlements: [
          {
            shopId: 'shop-123',
            shopName: 'Test Shop',
            shopType: 'beauty',
            commissionRate: 0.1,
            completedReservations: 50,
            grossRevenue: 2500000,
            commissionAmount: 250000,
            netPayout: 2250000,
            lastSettlementDate: '2023-12-01T00:00:00Z',
            nextSettlementDate: '2024-01-01T00:00:00Z',
            isEligibleForSettlement: true
          }
        ],
        summary: {
          totalShops: 1,
          totalGrossRevenue: 2500000,
          totalCommissionAmount: 250000,
          totalNetPayout: 2250000,
          averageCommissionRate: 0.1
        },
        dateRange: {
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        }
      };

      mockAdminPaymentService.getSettlementReport.mockResolvedValue(mockSettlementReport);

      const response = await request(app)
        .get('/api/admin/payments/settlements')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockSettlementReport);
      expect(response.body.message).toBe('정산 보고서를 성공적으로 조회했습니다.');
    });
  });

  describe('POST /api/admin/payments/:paymentId/refund', () => {
    it('should process refund successfully', async () => {
      const mockRefundResult = {
        success: true,
        refund: {
          id: 'refund-123',
          paymentId: 'payment-123',
          refundAmount: 25000,
          reason: 'Customer request',
          refundMethod: 'original',
          status: 'processed',
          processedAt: '2024-01-01T10:00:00Z'
        },
        payment: {
          previousStatus: 'completed',
          newStatus: 'refunded',
          updatedAt: '2024-01-01T10:00:00Z'
        }
      };

      mockAdminPaymentService.processRefund.mockResolvedValue(mockRefundResult);

      const response = await request(app)
        .post('/api/admin/payments/payment-123/refund')
        .send({
          refundAmount: 25000,
          reason: 'Customer request',
          refundMethod: 'original',
          notes: 'Customer requested refund',
          notifyCustomer: true
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockRefundResult);
      expect(response.body.message).toBe('환불이 성공적으로 처리되었습니다.');
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/admin/payments/payment-123/refund')
        .send({
          refundAmount: 0,
          reason: '',
          refundMethod: 'original'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('PAYMENT_4001');
      expect(response.body.message).toBe('환불 금액은 0보다 커야 합니다.');
    });

    it('should validate refund reason', async () => {
      const response = await request(app)
        .post('/api/admin/payments/payment-123/refund')
        .send({
          refundAmount: 25000,
          reason: '',
          refundMethod: 'original'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('PAYMENT_4002');
      expect(response.body.message).toBe('환불 사유를 입력해주세요.');
    });
  });

  describe('GET /api/admin/payments/analytics', () => {
    it('should return payment analytics', async () => {
      const mockAnalytics = {
        totalTransactions: 1000,
        successfulTransactions: 950,
        failedTransactions: 50,
        totalRevenue: 50000000,
        totalRefunds: 5000000,
        netRevenue: 45000000,
        averageTransactionValue: 50000,
        conversionRate: 0.95,
        refundRate: 0.05,
        transactionsByMethod: {
          card: { count: 700, amount: 35000000, successRate: 0.98 },
          transfer: { count: 200, amount: 10000000, successRate: 0.90 },
          cash: { count: 100, amount: 5000000, successRate: 1.0 }
        },
        transactionsByStatus: {
          completed: { count: 950, amount: 47500000 },
          failed: { count: 50, amount: 2500000 }
        },
        revenueTrends: {
          daily: [
            { date: '2024-01-01', revenue: 500000, transactions: 10 }
          ],
          weekly: [
            { week: '2024-W01', revenue: 3500000, transactions: 70 }
          ],
          monthly: [
            { month: '2024-01', revenue: 15000000, transactions: 300 }
          ]
        },
        topPerformingShops: [
          {
            shopId: 'shop-123',
            shopName: 'Top Shop',
            revenue: 10000000,
            transactions: 200,
            averageOrderValue: 50000
          }
        ]
      };

      mockAdminPaymentService.getPaymentAnalytics.mockResolvedValue(mockAnalytics);

      const response = await request(app)
        .get('/api/admin/payments/analytics')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalytics);
      expect(response.body.message).toBe('결제 분석 데이터를 성공적으로 조회했습니다.');
    });
  });

  describe('GET /api/admin/payments/:paymentId', () => {
    it('should return payment details', async () => {
      const mockPayment = {
        id: 'payment-123',
        reservationId: 'reservation-123',
        userId: 'user-123',
        paymentMethod: 'card',
        paymentStatus: 'completed',
        amount: 50000,
        currency: 'KRW',
        isDeposit: false,
        paidAt: '2024-01-01T10:00:00Z',
        refundedAt: null,
        refundAmount: 0,
        netAmount: 50000,
        customer: {
          id: 'user-123',
          name: 'Test User',
          email: 'test@example.com',
          phoneNumber: '010-1234-5678'
        },
        shop: {
          id: 'shop-123',
          name: 'Test Shop',
          mainCategory: 'beauty',
          shopStatus: 'active'
        },
        reservation: {
          id: 'reservation-123',
          reservationDate: '2024-01-01',
          reservationTime: '10:00',
          status: 'confirmed',
          totalAmount: 50000
        }
      };

      mockAdminPaymentService.getPayments.mockResolvedValue({
        payments: [mockPayment],
        totalCount: 1,
        hasMore: false,
        currentPage: 1,
        totalPages: 1,
        filters: {}
      });

      const response = await request(app)
        .get('/api/admin/payments/payment-123')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPayment);
      expect(response.body.message).toBe('결제 상세 정보를 성공적으로 조회했습니다.');
    });

    it('should return 404 for non-existent payment', async () => {
      mockAdminPaymentService.getPayments.mockResolvedValue({
        payments: [],
        totalCount: 0,
        hasMore: false,
        currentPage: 1,
        totalPages: 0,
        filters: {}
      });

      const response = await request(app)
        .get('/api/admin/payments/non-existent')
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('PAYMENT_4004');
      expect(response.body.message).toBe('해당 결제 정보를 찾을 수 없습니다.');
    });
  });

  describe('GET /api/admin/payments/export', () => {
    it('should export payments as CSV', async () => {
      const mockPayments = {
        payments: [
          {
            id: 'payment-123',
            reservationId: 'reservation-123',
            userId: 'user-123',
            paymentMethod: 'card',
            paymentStatus: 'completed',
            amount: 50000,
            currency: 'KRW',
            isDeposit: false,
            paidAt: '2024-01-01T10:00:00Z',
            refundedAt: null,
            refundAmount: 0,
            netAmount: 50000,
            customer: {
              id: 'user-123',
              name: 'Test User',
              email: 'test@example.com',
              phoneNumber: '010-1234-5678'
            },
            shop: {
              id: 'shop-123',
              name: 'Test Shop',
              mainCategory: 'beauty',
              shopStatus: 'active'
            },
            reservation: {
              id: 'reservation-123',
              reservationDate: '2024-01-01',
              reservationTime: '10:00',
              status: 'confirmed',
              totalAmount: 50000
            }
          }
        ],
        totalCount: 1,
        hasMore: false,
        currentPage: 1,
        totalPages: 1,
        filters: {}
      };

      mockAdminPaymentService.getPayments.mockResolvedValue(mockPayments);

      const response = await request(app)
        .get('/api/admin/payments/export')
        .query({
          status: 'completed',
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        })
        .expect(200);

      expect(response.headers['content-type']).toBe('text/csv; charset=utf-8');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.headers['content-disposition']).toContain('payments-');
      expect(response.text).toContain('Payment ID,Reservation ID,Customer Name');
      expect(response.text).toContain('payment-123,reservation-123,Test User');
    });
  });
}); 