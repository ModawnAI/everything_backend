/**
 * Admin Financial Management Routes
 * 
 * Routes for comprehensive financial oversight and management:
 * - Payment management and oversight
 * - Point system administration
 * - Financial reporting and analytics
 * - Shop payout calculations
 * - Refund management
 */

import { Router } from 'express';
import { adminFinancialController } from '../controllers/admin-financial.controller';
import { authenticateJWT } from '../middleware/auth.middleware';
import { rateLimit } from '../middleware/rate-limit.middleware';
import { validateRequest } from '../middleware/validation.middleware';
import { body, query, param } from 'express-validator';

const router = Router();

// Apply authentication and rate limiting to all routes
router.use(authenticateJWT());
router.use(rateLimit());

/**
 * Payment Management Routes
 */

/**
 * @swagger
 * /payments/overview:
 *   get:
 *     summary: 결제 개요 및 분석 조회
 *     description: |
 *       관리자 모니터링을 위한 종합적인 결제 분석 및 개요를 조회합니다.
 *       총 결제액, 성공률, 결제 수단 분석, 트렌드 등을 포함합니다.
 *       
 *       **주요 기능:**
 *       - 결제 볼륨 및 금액 분석
 *       - 성공/실패율 추적
 *       - 결제 수단별 분포 분석
 *       - 매출 트렌드 및 예측
 *       - 샵별 결제 분석
 *       
 *       **인증:** 관리자 권한이 필요합니다.
 *       
 *       ---
 *       
 *       **English:** Retrieve comprehensive payment analytics and overview for administrative monitoring.
 *       Includes total payments, success rates, payment methods breakdown, and trends.
 *     tags: [Admin Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics period (ISO 8601 format)
 *       
 *       관리자용 재무 관리 API입니다. 결제, 포인트, 정산 등의 재무 데이터를 관리합니다.
 *       
 *       ---
 *       
 *         example: "2024-01-01T00:00:00Z"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics period (ISO 8601 format)
 *         example: "2024-12-31T23:59:59Z"
 *       - in: query
 *         name: shopId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific shop ID
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Payment overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     overview:
 *                       type: object
 *                       properties:
 *                         totalPayments:
 *                           type: number
 *                           example: 1250000
 *                         totalTransactions:
 *                           type: integer
 *                           example: 450
 *                         successRate:
 *                           type: number
 *                           example: 98.5
 *                         averageTransactionValue:
 *                           type: number
 *                           example: 75000
 *                     trends:
 *                       type: array
 *                       items:
 *                         type: object
 *                     paymentMethods:
 *                       type: object
 *                     shopBreakdown:
 *                       type: array
 *                       items:
 *                         type: object
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
// GET /api/admin/financial/payments/overview - Get payment overview
router.get(
  '/payments/overview',
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('shopId').optional().isUUID().withMessage('Invalid shop ID format')
  ],
  validateRequest,
  adminFinancialController.getPaymentOverview.bind(adminFinancialController)
);

// GET /api/admin/financial/payments - List all payments with pagination
router.get(
  '/payments',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('status').optional().isIn(['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED']).withMessage('Invalid payment status'),
    query('paymentMethod').optional().isString(),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      // This is a placeholder - will be implemented in controller
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      res.json({
        success: true,
        data: {
          payments: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0
          },
          summary: {
            totalAmount: 0,
            completedAmount: 0,
            pendingAmount: 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payments' } });
    }
  }
);

/**
 * Point System Management Routes
 */

// GET /api/admin/financial/points - List all point transactions
router.get(
  '/points',
  [
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('type').optional().isIn(['EARNED', 'USED', 'EXPIRED', 'REFUNDED', 'ADMIN_ADJUSTMENT']).withMessage('Invalid point transaction type'),
    query('search').optional().isString()
  ],
  validateRequest,
  async (req, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;

      res.json({
        success: true,
        data: {
          transactions: [],
          pagination: {
            total: 0,
            page,
            limit,
            totalPages: 0
          },
          summary: {
            totalEarned: 0,
            totalUsed: 0,
            totalExpired: 0
          }
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch point transactions' } });
    }
  }
);

/**
 * @swagger
 * /points/overview:
 *   get:
 *     summary: 포인트 시스템 개요 및 분석 조회
 *     description: |
 *       발급된 총 포인트, 사용된 포인트, 만료된 포인트, 사용자 활동 패턴을 포함한
 *       종합적인 포인트 시스템 분석을 조회합니다.
 *       
 *       **주요 기능:**
 *       - 총 발급 및 사용 포인트 분석
 *       - 포인트 만료 추적
 *       - 사용자 참여도 분석
 *       - 포인트 거래 트렌드
 *       - 사용자별 포인트 분석
 *       
 *       **인증:** 관리자 권한이 필요합니다.
 *       
 *       ---
 *       
 *       **English:** Retrieve comprehensive point system analytics including total points issued,
 *       redeemed, expired, and user activity patterns.
 *     tags: [Admin Financial]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Start date for analytics period
 *       
 *       관리자용 재무 관리 API입니다. 결제, 포인트, 정산 등의 재무 데이터를 관리합니다.
 *       
 *       ---
 *       
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: End date for analytics period
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Filter by specific user ID
 *     responses:
 *       200:
 *         description: Point system overview retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPointsIssued:
 *                       type: number
 *                     totalPointsRedeemed:
 *                       type: number
 *                     activePoints:
 *                       type: number
 *                     expiredPoints:
 *                       type: number
 *       401:
 *         description: Unauthorized - Admin authentication required
 *       500:
 *         description: Internal server error
 */
// GET /api/admin/financial/points/overview - Get point system overview
router.get(
  '/points/overview',
  [
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('userId').optional().isUUID().withMessage('Invalid user ID format')
  ],
  validateRequest,
  adminFinancialController.getPointSystemOverview.bind(adminFinancialController)
);

// POST /api/admin/financial/points/adjust - Process manual point adjustment
router.post(
  '/points/adjust',
  [
    body('userId').isUUID().withMessage('Valid user ID is required'),
    body('amount').isInt({ min: 1, max: 1000000 }).withMessage('Amount must be between 1 and 1,000,000'),
    body('adjustmentType').isIn(['add', 'subtract', 'expire']).withMessage('Invalid adjustment type'),
    body('reason').isLength({ min: 5, max: 500 }).withMessage('Reason must be 5-500 characters'),
    body('category').isIn([
      'customer_service',
      'promotional',
      'error_correction',
      'system_maintenance',
      'fraud_prevention',
      'other'
    ]).withMessage('Invalid category'),
    body('notes').optional().isLength({ max: 1000 }).withMessage('Notes cannot exceed 1000 characters')
  ],
  validateRequest,
  adminFinancialController.processPointAdjustment.bind(adminFinancialController)
);

/**
 * Shop Payout Management Routes
 */

// GET /api/admin/financial/payouts/calculate/:shopId - Calculate shop payout
router.get(
  '/payouts/calculate/:shopId',
  [
    param('shopId').isUUID().withMessage('Valid shop ID is required'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format')
  ],
  validateRequest,
  adminFinancialController.calculateShopPayout.bind(adminFinancialController)
);

/**
 * Financial Reporting Routes
 */

// POST /api/admin/financial/reports/generate - Generate financial report
router.post(
  '/reports/generate',
  [
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('reportType').isIn(['summary', 'detailed', 'shop_breakdown', 'point_analysis']).withMessage('Invalid report type'),
    body('shopIds').optional().isArray().withMessage('Shop IDs must be an array'),
    body('shopIds.*').optional().isUUID().withMessage('Each shop ID must be a valid UUID'),
    body('includeRefunds').optional().isBoolean().withMessage('Include refunds must be boolean'),
    body('includePoints').optional().isBoolean().withMessage('Include points must be boolean'),
    body('format').optional().isIn(['json', 'csv', 'excel']).withMessage('Invalid format')
  ],
  validateRequest,
  adminFinancialController.generateFinancialReport.bind(adminFinancialController)
);

/**
 * Refund Management Routes
 */

// GET /api/admin/financial/refunds - Get refund management overview
router.get(
  '/refunds',
  [
    query('status').optional().isIn([
      'pending', 'approved', 'processing', 'completed', 'failed', 'cancelled'
    ]).withMessage('Invalid refund status'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
    query('shopId').optional().isUUID().withMessage('Invalid shop ID format')
  ],
  validateRequest,
  adminFinancialController.getRefundManagement.bind(adminFinancialController)
);

export default router;

