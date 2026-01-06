import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { AdminPaymentService, PaymentFilters, RefundRequest } from '../services/admin-payment.service';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

export class AdminPaymentController {
  private adminPaymentService = new AdminPaymentService();

  /**
   * GET /api/admin/payments
   * Get comprehensive payment list with advanced filtering and search capabilities
   */
  async getPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      // Extract query parameters for filtering
      console.log('[AdminPaymentController] Raw query params:', {
        sortBy: req.query.sortBy,
        sortOrder: req.query.sortOrder,
        fullQuery: req.query
      });

      const filters: PaymentFilters = {
        status: req.query.status as any,
        paymentMethod: req.query.paymentMethod as any,
        shopId: req.query.shopId as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
        isDeposit: req.query.isDeposit ? req.query.isDeposit === 'true' : undefined,
        hasRefund: req.query.hasRefund ? req.query.hasRefund === 'true' : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        page: req.query.page ? Number(req.query.page) : 1,
        limit: req.query.limit ? Number(req.query.limit) : 20
      } as PaymentFilters;

      console.log('[AdminPaymentController] Parsed filters:', filters);

      const result = await this.adminPaymentService.getPayments(filters, adminId);

      res.status(200).json({
        success: true,
        data: result,
        message: '결제 내역을 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in getPayments:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5001',
        message: '결제 내역 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/admin/payments/summary
   * Get payment summary with aggregated statistics and insights
   */
  async getPaymentSummary(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      const dateRange = req.query.startDate && req.query.endDate ? {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      } : undefined;

      const summary = await this.adminPaymentService.getPaymentSummary(adminId, dateRange);

      res.status(200).json({
        success: true,
        data: summary,
        message: '결제 요약 정보를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in getPaymentSummary:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5002',
        message: '결제 요약 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/admin/payments/settlements
   * Get comprehensive settlement report for financial oversight
   */
  async getSettlementReport(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      const dateRange = req.query.startDate && req.query.endDate ? {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      } : undefined;

      const settlementReport = await this.adminPaymentService.getSettlementReport(adminId, dateRange);

      res.status(200).json({
        success: true,
        data: settlementReport,
        message: '정산 보고서를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in getSettlementReport:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5003',
        message: '정산 보고서 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * POST /api/admin/payments/:paymentId/refund
   * Process refund for a specific payment with comprehensive tracking
   */
  async processRefund(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '인증이 필요합니다.',
          details: 'Authentication required'
        });
        return;
      }

      const { paymentId } = req.params;
      if (!paymentId) {
        res.status(400).json({
          success: false,
          error: 'PAYMENT_4005',
          message: '결제 ID가 필요합니다.',
          details: 'Payment ID is required'
        });
        return;
      }

      // Shop owners can only refund payments for their own shops
      if (userRole === 'shop_owner') {
        const supabase = getSupabaseClient();
        const { data: payment, error: paymentError } = await supabase
          .from('payments')
          .select(`
            id,
            reservations!inner(
              shop_id,
              shops!inner(owner_id)
            )
          `)
          .eq('id', paymentId)
          .single();

        if (paymentError || !payment) {
          res.status(404).json({
            success: false,
            error: 'PAYMENT_4006',
            message: '결제를 찾을 수 없습니다.',
            details: 'Payment not found'
          });
          return;
        }

        const shopOwnerId = (payment.reservations as any)?.shops?.owner_id;
        if (shopOwnerId !== userId) {
          res.status(403).json({
            success: false,
            error: 'PAYMENT_4007',
            message: '이 결제에 대한 환불 권한이 없습니다.',
            details: 'You can only process refunds for your own shop payments'
          });
          return;
        }
      }

      const refundRequest: RefundRequest = {
        paymentId,
        refundAmount: Number(req.body?.refundAmount),
        reason: req.body?.reason || '',
        refundMethod: req.body?.refundMethod || 'original',
        notes: req.body?.notes,
        notifyCustomer: req.body?.notifyCustomer !== false // Default to true
      };

      // Validate required fields
      if (!refundRequest.refundAmount || refundRequest.refundAmount <= 0) {
        res.status(400).json({
          success: false,
          error: 'PAYMENT_4001',
          message: '환불 금액은 0보다 커야 합니다.',
          details: 'Refund amount must be greater than 0'
        });
        return;
      }

      if (!refundRequest.reason) {
        res.status(400).json({
          success: false,
          error: 'PAYMENT_4002',
          message: '환불 사유를 입력해주세요.',
          details: 'Refund reason is required'
        });
        return;
      }

      const result = await this.adminPaymentService.processRefund(paymentId, refundRequest, userId);

      if (result.success) {
        res.status(200).json({
          success: true,
          data: result,
          message: '환불이 성공적으로 처리되었습니다.'
        });
      } else {
        res.status(400).json({
          success: false,
          error: 'PAYMENT_4003',
          message: '환불 처리에 실패했습니다.',
          details: result
        });
      }
    } catch (error) {
      logger.error('Error in processRefund:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5004',
        message: '환불 처리 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/admin/payments/analytics
   * Get comprehensive payment analytics and business intelligence data
   */
  async getPaymentAnalytics(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      const dateRange = req.query.startDate && req.query.endDate ? {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string
      } : undefined;

      const analytics = await this.adminPaymentService.getPaymentAnalytics(adminId, dateRange);

      res.status(200).json({
        success: true,
        data: analytics,
        message: '결제 분석 데이터를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in getPaymentAnalytics:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5005',
        message: '결제 분석 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/admin/payments/:paymentId
   * Get detailed information for a specific payment
   */
  async getPaymentDetails(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      const { paymentId } = req.params;

      // Get payment details from the service
      const filters: PaymentFilters = { page: 1, limit: 1 };
      const result = await this.adminPaymentService.getPayments(filters, adminId);
      
      const payment = result.payments.find(p => p.id === paymentId);
      
      if (!payment) {
        res.status(404).json({
          success: false,
          error: 'PAYMENT_4004',
          message: '해당 결제 정보를 찾을 수 없습니다.',
          details: 'Payment not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: payment,
        message: '결제 상세 정보를 성공적으로 조회했습니다.'
      });
    } catch (error) {
      logger.error('Error in getPaymentDetails:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5006',
        message: '결제 상세 정보 조회 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * GET /api/admin/payments/export
   * Export payment data for external analysis and reporting
   */
  async exportPayments(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const adminId = req.user?.id;
      if (!adminId) {
        res.status(401).json({
          success: false,
          error: 'AUTH_1001',
          message: '관리자 인증이 필요합니다.',
          details: 'Admin authentication required'
        });
        return;
      }

      // Extract query parameters for filtering
      const filters: PaymentFilters = {
        status: req.query.status as any,
        paymentMethod: req.query.paymentMethod as any,
        shopId: req.query.shopId as string,
        userId: req.query.userId as string,
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        minAmount: req.query.minAmount ? Number(req.query.minAmount) : undefined,
        maxAmount: req.query.maxAmount ? Number(req.query.maxAmount) : undefined,
        isDeposit: req.query.isDeposit ? req.query.isDeposit === 'true' : undefined,
        hasRefund: req.query.hasRefund ? req.query.hasRefund === 'true' : undefined,
        sortBy: req.query.sortBy as any,
        sortOrder: req.query.sortOrder as any,
        page: 1,
        limit: 10000 // Large limit for export
      } as PaymentFilters;

      const result = await this.adminPaymentService.getPayments(filters, adminId);

      // Set headers for CSV download
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="payments-${new Date().toISOString().split('T')[0]}.csv"`);

      // Create CSV header
      const csvHeader = [
        'Payment ID',
        'Reservation ID',
        'Customer Name',
        'Customer Email',
        'Shop Name',
        'Payment Method',
        'Payment Status',
        'Amount',
        'Currency',
        'Is Deposit',
        'Paid At',
        'Refunded At',
        'Refund Amount',
        'Net Amount',
        'Failure Reason',
        'Created At'
      ].join(',');

      // Create CSV rows
      const csvRows = result.payments.map(payment => [
        payment.id,
        payment.reservationId,
        payment.customer.name,
        payment.customer.email || '',
        payment.shop.name,
        payment.paymentMethod,
        payment.paymentStatus,
        payment.amount,
        payment.currency,
        payment.isDeposit,
        payment.paidAt || '',
        payment.refundedAt || '',
        payment.refundAmount,
        payment.netAmount,
        payment.failureReason || '',
        payment.createdAt
      ].join(','));

      const csvContent = [csvHeader, ...csvRows].join('\n');
      res.send(csvContent);

    } catch (error) {
      logger.error('Error in exportPayments:', error);
      res.status(500).json({
        success: false,
        error: 'PAYMENT_5007',
        message: '결제 데이터 내보내기 중 오류가 발생했습니다.',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export default new AdminPaymentController(); 