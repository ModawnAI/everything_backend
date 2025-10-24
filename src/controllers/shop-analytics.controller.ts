/**
 * Shop Analytics Controller
 *
 * Handles shop-scoped analytics endpoints for shop owners and admins.
 * All operations are filtered by shopId from the route parameter.
 *
 * Access Control:
 * - Enforced by validateShopAccess middleware
 * - Platform admins can access any shop
 * - Shop users can only access their own shop
 */

import { Response } from 'express';
import { ShopAccessRequest } from '../middleware/shop-access.middleware';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export class ShopAnalyticsController {
  /**
   * GET /api/shops/:shopId/analytics/dashboard/quick
   * Get quick dashboard metrics for a specific shop
   */
  async getQuickDashboard(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { period = '7d' } = req.query;

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

      logger.info('🔍 [SHOP-ANALYTICS] Fetching quick dashboard', {
        shopId,
        period,
        user: { id: req.user?.id, role: req.user?.role }
      });

      const supabase = getSupabaseClient();

      // Calculate date range based on period
      const endDate = new Date();
      const startDate = new Date();

      switch (period) {
        case '7d':
          startDate.setDate(endDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(endDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(endDate.getDate() - 90);
          break;
        default:
          startDate.setDate(endDate.getDate() - 7);
      }

      // Optimized: Use database aggregations instead of fetching all rows
      const [reservationsResult, paymentsResult] = await Promise.all([
        supabase.rpc('get_shop_reservations_stats', {
          p_shop_id: shopId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        }),
        supabase.rpc('get_shop_payments_stats', {
          p_shop_id: shopId,
          p_start_date: startDate.toISOString(),
          p_end_date: endDate.toISOString()
        })
      ]);

      if (reservationsResult.error) {
        logger.error('❌ [SHOP-ANALYTICS] Reservations stats error', {
          error: reservationsResult.error.message,
          shopId
        });
        throw reservationsResult.error;
      }

      if (paymentsResult.error) {
        logger.error('❌ [SHOP-ANALYTICS] Payments stats error', {
          error: paymentsResult.error.message,
          shopId
        });
        throw paymentsResult.error;
      }

      const reservationStats = reservationsResult.data || {};
      const paymentStats = paymentsResult.data || {};

      // Calculate metrics from aggregated data
      const totalReservations = reservationStats.total || 0;
      const confirmedReservations = reservationStats.confirmed || 0;
      const completedReservations = reservationStats.completed || 0;
      const cancelledReservations = (reservationStats.cancelled_by_user || 0) + (reservationStats.cancelled_by_shop || 0);
      const requestedReservations = reservationStats.requested || 0;
      const noShowReservations = reservationStats.no_show || 0;

      const totalRevenue = paymentStats.total_revenue || 0;
      const totalPayments = paymentStats.total_count || 0;
      const pendingPayments = paymentStats.pending || 0;
      const completedPayments = paymentStats.completed || 0;
      const failedPayments = paymentStats.failed || 0;

      // Calculate conversion rate
      const conversionRate = totalReservations > 0
        ? ((completedReservations / totalReservations) * 100).toFixed(2)
        : '0.00';

      // Calculate average order value
      const averageOrderValue = completedPayments > 0
        ? (totalRevenue / completedPayments).toFixed(0)
        : '0';

      const metrics = {
        overview: {
          totalReservations,
          confirmedReservations,
          completedReservations,
          cancelledReservations,
          totalRevenue,
          conversionRate: parseFloat(conversionRate),
          averageOrderValue: parseFloat(averageOrderValue)
        },
        reservations: {
          total: totalReservations,
          byStatus: {
            confirmed: confirmedReservations,
            completed: completedReservations,
            cancelled: cancelledReservations,
            requested: requestedReservations,
            no_show: noShowReservations
          }
        },
        payments: {
          total: totalPayments,
          completed: completedPayments,
          pending: pendingPayments,
          failed: failedPayments,
          totalRevenue
        },
        period: {
          start: startDate.toISOString(),
          end: endDate.toISOString(),
          days: period
        }
      };

      logger.info('✅ [SHOP-ANALYTICS] Quick dashboard fetched successfully', {
        shopId,
        totalReservations,
        totalRevenue
      });

      res.status(200).json({
        success: true,
        data: metrics
      });

    } catch (error) {
      logger.error('💥 [SHOP-ANALYTICS] Error fetching quick dashboard', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '대시보드 데이터 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }

  /**
   * GET /api/shops/:shopId/analytics/revenue
   * Get detailed revenue analytics for a specific shop
   */
  async getRevenueAnalytics(req: ShopAccessRequest, res: Response): Promise<void> {
    try {
      const { shopId } = req.params;
      const { startDate, endDate, groupBy = 'day' } = req.query;

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

      logger.info('🔍 [SHOP-ANALYTICS] Fetching revenue analytics', {
        shopId,
        startDate,
        endDate,
        groupBy
      });

      const supabase = getSupabaseClient();

      let query = supabase
        .from('payments')
        .select('id, amount, status, created_at, payment_method')
        .eq('shop_id', shopId);

      if (startDate) {
        query = query.gte('created_at', startDate as string);
      }
      if (endDate) {
        query = query.lte('created_at', endDate as string);
      }

      const { data: payments, error } = await query;

      if (error) {
        logger.error('❌ [SHOP-ANALYTICS] Revenue query error', {
          error: error.message,
          shopId
        });
        throw error;
      }

      // Group payments by specified period
      const revenueByPeriod: Record<string, { amount: number; count: number }> = {};

      payments?.forEach(payment => {
        if (payment.status === 'paid' || payment.status === 'completed') {
          const date = new Date(payment.created_at);
          let periodKey: string;

          switch (groupBy) {
            case 'day':
              periodKey = date.toISOString().split('T')[0];
              break;
            case 'week':
              const weekStart = new Date(date);
              weekStart.setDate(date.getDate() - date.getDay());
              periodKey = weekStart.toISOString().split('T')[0];
              break;
            case 'month':
              periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
              break;
            default:
              periodKey = date.toISOString().split('T')[0];
          }

          if (!revenueByPeriod[periodKey]) {
            revenueByPeriod[periodKey] = { amount: 0, count: 0 };
          }
          revenueByPeriod[periodKey].amount += payment.amount || 0;
          revenueByPeriod[periodKey].count += 1;
        }
      });

      const totalRevenue = Object.values(revenueByPeriod).reduce((sum, period) => sum + period.amount, 0);
      const totalTransactions = Object.values(revenueByPeriod).reduce((sum, period) => sum + period.count, 0);

      const analytics = {
        summary: {
          totalRevenue,
          totalTransactions,
          averageTransactionValue: totalTransactions > 0 ? (totalRevenue / totalTransactions).toFixed(0) : '0'
        },
        revenueByPeriod,
        paymentMethodBreakdown: payments?.reduce((acc, payment) => {
          if (payment.status === 'paid' || payment.status === 'completed') {
            const method = payment.payment_method || 'unknown';
            if (!acc[method]) {
              acc[method] = { amount: 0, count: 0 };
            }
            acc[method].amount += payment.amount || 0;
            acc[method].count += 1;
          }
          return acc;
        }, {} as Record<string, { amount: number; count: number }>)
      };

      logger.info('✅ [SHOP-ANALYTICS] Revenue analytics fetched successfully', {
        shopId,
        totalRevenue,
        totalTransactions
      });

      res.status(200).json({
        success: true,
        data: analytics
      });

    } catch (error) {
      logger.error('💥 [SHOP-ANALYTICS] Error fetching revenue analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        shopId: req.params.shopId
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: '수익 분석 조회 중 오류가 발생했습니다.',
          details: '잠시 후 다시 시도해주세요.'
        }
      });
    }
  }
}
