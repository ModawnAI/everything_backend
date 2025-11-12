/**
 * Shop Payments Controller
 *
 * Handles shop-scoped payment viewing endpoints.
 * All operations are filtered by shopId from the route parameter.
 *
 * Access Control:
 * - Enforced by validateShopAccess middleware
 * - Platform admins can access any shop
 * - Shop users can only access their own shop
 */

import { Response } from 'express';
import { ShopAccessRequest } from '../middleware/shop-access.middleware';
import { logger } from '../utils/logger';
import { getSupabaseClient } from '../config/database';

export class ShopPaymentsController {
  /**
   * GET /api/shops/:shopId/payments
   * Get payment records for a specific shop with filtering
   */
  async getShopPayments(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const {
        status,
        paymentMethod,
        startDate,
        endDate,
        userId,
        reservationId,
        minAmount,
        maxAmount,
        page = 1,
        limit = 20
      } = req.query;

      // Validate shopId (already validated by middleware, but double-check)
      if (!shopId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_SHOP_ID',
            message: '샵 ID가 필요합니다.'
          }
        });
        return;
      }

      // Build query filters
      const filters: any = {
        shopId,
        page: parseInt(page as string) || 1,
        limit: Math.min(parseInt(limit as string) || 20, 100) // Max 100 per page
      };

      if (status) filters.status = status as string;
      if (paymentMethod) filters.paymentMethod = paymentMethod as string;
      if (startDate) filters.startDate = startDate as string;
      if (endDate) filters.endDate = endDate as string;
      if (userId) filters.userId = userId as string;
      if (reservationId) filters.reservationId = reservationId as string;
      if (minAmount) filters.minAmount = parseInt(minAmount as string);
      if (maxAmount) filters.maxAmount = parseInt(maxAmount as string);

      logger.info('💳 [SHOP-PAYMENTS] Fetching payments for shop', {
        shopId,
        filters,
        user: { id: req.user?.id, role: req.user?.role }
      });

      const supabase = getSupabaseClient();

      // Get payments from database - join through reservations to filter by shop_id
      // Note: payments table doesn't have shop_id, must join through reservations
      let query = supabase
        .from('payments')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email
          ),
          reservations:reservation_id!inner (
            id,
            reservation_date,
            reservation_time,
            status,
            shop_id,
            shops (
              id,
              name
            )
          )
        `, { count: 'exact' })
        .eq('reservations.shop_id', shopId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.paymentMethod) {
        query = query.eq('payment_method', filters.paymentMethod);
      }
      if (filters.startDate) {
        query = query.gte('created_at', filters.startDate);
      }
      if (filters.endDate) {
        query = query.lte('created_at', filters.endDate);
      }
      if (filters.userId) {
        query = query.eq('user_id', filters.userId);
      }
      if (filters.reservationId) {
        query = query.eq('reservation_id', filters.reservationId);
      }
      if (filters.minAmount !== undefined) {
        query = query.gte('amount', filters.minAmount);
      }
      if (filters.maxAmount !== undefined) {
        query = query.lte('amount', filters.maxAmount);
      }

      // Apply pagination
      const offset = (filters.page - 1) * filters.limit;
      query = query.range(offset, offset + filters.limit - 1);

      const { data: payments, error, count } = await query;

      if (error) {
        logger.error('❌ [SHOP-PAYMENTS] Database error', {
          error: error.message,
          shopId
        });
        throw error;
      }

      // Calculate summary statistics - join through reservations to filter by shop_id
      let summaryFilteredQuery = supabase
        .from('payments')
        .select(`
          amount,
          refund_amount,
          status,
          reservations!inner (
            shop_id
          )
        `)
        .eq('reservations.shop_id', shopId);

      // Apply same filters for summary
      if (filters.status) summaryFilteredQuery = summaryFilteredQuery.eq('status', filters.status);
      if (filters.paymentMethod) summaryFilteredQuery = summaryFilteredQuery.eq('payment_method', filters.paymentMethod);
      if (filters.startDate) summaryFilteredQuery = summaryFilteredQuery.gte('created_at', filters.startDate);
      if (filters.endDate) summaryFilteredQuery = summaryFilteredQuery.lte('created_at', filters.endDate);
      if (filters.userId) summaryFilteredQuery = summaryFilteredQuery.eq('user_id', filters.userId);
      if (filters.reservationId) summaryFilteredQuery = summaryFilteredQuery.eq('reservation_id', filters.reservationId);
      if (filters.minAmount !== undefined) summaryFilteredQuery = summaryFilteredQuery.gte('amount', filters.minAmount);
      if (filters.maxAmount !== undefined) summaryFilteredQuery = summaryFilteredQuery.lte('amount', filters.maxAmount);

      const { data: summaryData } = await summaryFilteredQuery;

      const summary = {
        totalAmount: 0,
        totalRefunded: 0,
        netAmount: 0
      };

      if (summaryData) {
        summaryData.forEach((payment: any) => {
          if (payment.status === 'completed') {
            summary.totalAmount += payment.amount || 0;
            summary.totalRefunded += payment.refund_amount || 0;
          }
        });
        summary.netAmount = summary.totalAmount - summary.totalRefunded;
      }

      const totalPages = count ? Math.ceil(count / filters.limit) : 0;

      logger.info('✅ [SHOP-PAYMENTS] Payments fetched successfully', {
        shopId,
        count: payments?.length || 0,
        total: count,
        page: filters.page,
        totalPages,
        summary
      });

      res.status(200).json({
        success: true,
        data: {
          payments: payments || [],
          pagination: {
            total: count || 0,
            page: filters.page,
            limit: filters.limit,
            totalPages,
            hasMore: filters.page < totalPages
          },
          summary
        }
      });

    } catch (error) {
      logger.error('💥 [SHOP-PAYMENTS] Error fetching shop payments', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId,
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 내역 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/:shopId/payments/:paymentId
   * Get detailed payment information
   */
  async getPaymentDetails(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId, paymentId } = req.params;

      // Validate required parameters
      if (!shopId || !paymentId) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_PARAMETERS',
            message: '샵 ID와 결제 ID가 필요합니다.'
          }
        });
        return;
      }

      logger.info('💳 [SHOP-PAYMENTS] Fetching payment details', {
        shopId,
        paymentId,
        user: { id: req.user?.id, role: req.user?.role }
      });

      const supabase = getSupabaseClient();

      // Get payment - join through reservations to filter by shop_id
      // Note: payments table doesn't have shop_id, must join through reservations
      const { data: payment, error } = await supabase
        .from('payments')
        .select(`
          *,
          users:user_id (
            id,
            name,
            email,
            phone
          ),
          reservations:reservation_id!inner (
            id,
            reservation_date,
            reservation_time,
            status,
            total_amount,
            deposit_amount,
            remaining_amount,
            special_requests,
            shop_id,
            shops (
              id,
              name,
              phone,
              address
            )
          )
        `)
        .eq('id', paymentId)
        .eq('reservations.shop_id', shopId)
        .single();

      if (error || !payment) {
        logger.warn('⚠️ [SHOP-PAYMENTS] Payment not found or access denied', {
          shopId,
          paymentId,
          error: error?.message
        });

        res.status(404).json({
          success: false,
          error: {
            code: 'PAYMENT_NOT_FOUND',
            message: '결제 내역을 찾을 수 없거나 접근 권한이 없습니다.'
          }
        });
        return;
      }

      // Get refund history if applicable
      let refundHistory = null;
      if (payment.refund_amount && payment.refund_amount > 0) {
        const { data: refunds } = await supabase
          .from('refunds')
          .select('*')
          .eq('payment_id', paymentId)
          .order('created_at', { ascending: false });

        refundHistory = refunds || [];
      }

      logger.info('✅ [SHOP-PAYMENTS] Payment details fetched successfully', {
        shopId,
        paymentId,
        hasRefunds: !!refundHistory
      });

      res.status(200).json({
        success: true,
        data: {
          payment,
          refundHistory
        }
      });

    } catch (error) {
      logger.error('💥 [SHOP-PAYMENTS] Error fetching payment details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId,
        paymentId: req.params.paymentId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '결제 상세 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}
