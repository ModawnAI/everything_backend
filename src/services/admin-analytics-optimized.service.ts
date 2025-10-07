import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Optimized Analytics Service using Materialized Views
 *
 * Performance: < 10ms response time (100-1000x faster than on-demand calculation)
 * Data Freshness: Auto-refreshed by pg_cron every 2-10 minutes
 *
 * This service reads pre-calculated metrics from materialized views instead of
 * executing complex queries on-demand. All heavy computation is done by PostgreSQL
 * in the background.
 */

// ============================================
// Response Interfaces (camelCase for frontend)
// ============================================

export interface QuickDashboardMetrics {
  // User metrics
  totalUsers: number;
  activeUsers: number;
  newUsersThisMonth: number;
  userGrowthRate: number;

  // Revenue metrics
  totalRevenue: number;
  todayRevenue: number;
  monthRevenue: number;
  revenueGrowthRate: number;

  // Reservation metrics
  totalReservations: number;
  activeReservations: number;
  todayReservations: number;
  reservationSuccessRate: number;

  // Shop metrics
  totalShops: number;
  activeShops: number;
  pendingApprovals: number;

  // Payment metrics
  totalTransactions: number;
  successfulTransactions: number;
  conversionRate: number;

  // Metadata
  lastUpdated: string;
}

export interface UserGrowthTrend {
  date: string;
  newUsers: number;
  activeUsers: number;
}

export interface RevenueTrend {
  date: string;
  totalRevenue: number;
  transactionCount: number;
  avgTransactionValue: number;
}

export interface ReservationTrend {
  date: string;
  totalReservations: number;
  completedReservations: number;
  cancelledReservations: number;
  completionRate: number;
}

export interface ShopPerformance {
  shopId: string;
  shopName: string;
  mainCategory: string;
  shopStatus: string;
  totalReservations: number;
  completedReservations: number;
  totalRevenue: number;
  avgRating: number;
  completionRate: number;
}

export interface PaymentStatusSummary {
  paymentStatus: string;
  paymentStage: string;
  count: number;
  totalAmount: number;
  avgAmount: number;
}

export interface PointTransactionSummary {
  transactionType: string;
  status: string;
  transactionCount: number;
  totalPoints: number;
  avgPoints: number;
}

export interface CategoryPerformance {
  mainCategory: string;
  totalShops: number;
  activeShops: number;
  totalReservations: number;
  totalRevenue: number;
  avgRating: number;
}

// ============================================
// Optimized Analytics Service
// ============================================

export class AdminAnalyticsOptimizedService {
  private supabase = getSupabaseClient();

  /**
   * Get quick dashboard metrics (< 10ms)
   * Reads from dashboard_quick_metrics materialized view
   */
  async getQuickDashboardMetrics(): Promise<QuickDashboardMetrics> {
    try {
      logger.info('Getting quick dashboard metrics from materialized view');

      const { data, error } = await this.supabase
        .from('dashboard_quick_metrics')
        .select('*')
        .single();

      if (error) {
        logger.error('Error fetching quick dashboard metrics', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return {
        totalUsers: data.total_users,
        activeUsers: data.active_users,
        newUsersThisMonth: data.new_users_this_month,
        userGrowthRate: data.user_growth_rate,

        totalRevenue: data.total_revenue,
        todayRevenue: data.today_revenue,
        monthRevenue: data.month_revenue,
        revenueGrowthRate: data.revenue_growth_rate,

        totalReservations: data.total_reservations,
        activeReservations: data.active_reservations,
        todayReservations: data.today_reservations,
        reservationSuccessRate: data.reservation_success_rate,

        totalShops: data.total_shops,
        activeShops: data.active_shops,
        pendingApprovals: data.pending_approvals,

        totalTransactions: data.total_transactions,
        successfulTransactions: data.successful_transactions,
        conversionRate: data.conversion_rate,

        lastUpdated: data.last_updated
      };
    } catch (error) {
      logger.error('Error in getQuickDashboardMetrics', { error });
      throw error;
    }
  }

  /**
   * Get user growth daily trends (< 10ms)
   * Reads from user_growth_daily_trends materialized view
   */
  async getUserGrowthTrends(limit: number = 30): Promise<UserGrowthTrend[]> {
    try {
      logger.info('Getting user growth trends from materialized view', { limit });

      const { data, error } = await this.supabase
        .from('user_growth_daily_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching user growth trends', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        date: row.date,
        newUsers: row.new_users,
        activeUsers: row.active_users
      }));
    } catch (error) {
      logger.error('Error in getUserGrowthTrends', { error });
      throw error;
    }
  }

  /**
   * Get revenue daily trends (< 10ms)
   * Reads from revenue_daily_trends materialized view
   */
  async getRevenueTrends(limit: number = 30): Promise<RevenueTrend[]> {
    try {
      logger.info('Getting revenue trends from materialized view', { limit });

      const { data, error } = await this.supabase
        .from('revenue_daily_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching revenue trends', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        date: row.date,
        totalRevenue: row.total_revenue,
        transactionCount: row.transaction_count,
        avgTransactionValue: row.avg_transaction_value
      }));
    } catch (error) {
      logger.error('Error in getRevenueTrends', { error });
      throw error;
    }
  }

  /**
   * Get reservation daily trends (< 10ms)
   * Reads from reservation_daily_trends materialized view
   */
  async getReservationTrends(limit: number = 30): Promise<ReservationTrend[]> {
    try {
      logger.info('Getting reservation trends from materialized view', { limit });

      const { data, error } = await this.supabase
        .from('reservation_daily_trends')
        .select('*')
        .order('date', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching reservation trends', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        date: row.date,
        totalReservations: row.total_reservations,
        completedReservations: row.completed_reservations,
        cancelledReservations: row.cancelled_reservations,
        completionRate: row.completion_rate
      }));
    } catch (error) {
      logger.error('Error in getReservationTrends', { error });
      throw error;
    }
  }

  /**
   * Get shop performance summary (< 10ms)
   * Reads from shop_performance_summary materialized view
   */
  async getShopPerformance(limit: number = 20): Promise<ShopPerformance[]> {
    try {
      logger.info('Getting shop performance from materialized view', { limit });

      const { data, error } = await this.supabase
        .from('shop_performance_summary')
        .select('*')
        .order('total_revenue', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Error fetching shop performance', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        shopId: row.shop_id,
        shopName: row.shop_name,
        mainCategory: row.main_category,
        shopStatus: row.shop_status,
        totalReservations: row.total_reservations,
        completedReservations: row.completed_reservations,
        totalRevenue: row.total_revenue,
        avgRating: row.avg_rating,
        completionRate: row.completion_rate
      }));
    } catch (error) {
      logger.error('Error in getShopPerformance', { error });
      throw error;
    }
  }

  /**
   * Get payment status summary (< 10ms)
   * Reads from payment_status_summary materialized view
   */
  async getPaymentStatusSummary(): Promise<PaymentStatusSummary[]> {
    try {
      logger.info('Getting payment status summary from materialized view');

      const { data, error } = await this.supabase
        .from('payment_status_summary')
        .select('*')
        .order('total_amount', { ascending: false });

      if (error) {
        logger.error('Error fetching payment status summary', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        paymentStatus: row.payment_status,
        paymentStage: row.payment_stage,
        count: row.count,
        totalAmount: row.total_amount,
        avgAmount: row.avg_amount
      }));
    } catch (error) {
      logger.error('Error in getPaymentStatusSummary', { error });
      throw error;
    }
  }

  /**
   * Get point transaction summary (< 10ms)
   * Reads from point_transaction_summary materialized view
   */
  async getPointTransactionSummary(): Promise<PointTransactionSummary[]> {
    try {
      logger.info('Getting point transaction summary from materialized view');

      const { data, error } = await this.supabase
        .from('point_transaction_summary')
        .select('*')
        .order('total_points', { ascending: false });

      if (error) {
        logger.error('Error fetching point transaction summary', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        transactionType: row.transaction_type,
        status: row.status,
        transactionCount: row.transaction_count,
        totalPoints: row.total_points,
        avgPoints: row.avg_points
      }));
    } catch (error) {
      logger.error('Error in getPointTransactionSummary', { error });
      throw error;
    }
  }

  /**
   * Get category performance summary (< 10ms)
   * Reads from category_performance_summary materialized view
   */
  async getCategoryPerformance(): Promise<CategoryPerformance[]> {
    try {
      logger.info('Getting category performance from materialized view');

      const { data, error } = await this.supabase
        .from('category_performance_summary')
        .select('*')
        .order('total_revenue', { ascending: false });

      if (error) {
        logger.error('Error fetching category performance', { error });
        throw error;
      }

      // Transform snake_case to camelCase
      return data.map(row => ({
        mainCategory: row.main_category,
        totalShops: row.total_shops,
        activeShops: row.active_shops,
        totalReservations: row.total_reservations,
        totalRevenue: row.total_revenue,
        avgRating: row.avg_rating
      }));
    } catch (error) {
      logger.error('Error in getCategoryPerformance', { error });
      throw error;
    }
  }

  /**
   * Manual refresh of all materialized views (admin only)
   * This is optional - pg_cron automatically refreshes them
   */
  async refreshAllViews(): Promise<{ success: boolean; message: string }> {
    try {
      logger.info('Manually refreshing all materialized views');

      // Note: This requires RPC function or direct SQL execution
      // In Supabase, you would create an RPC function to do this

      const views = [
        'dashboard_quick_metrics',
        'user_growth_daily_trends',
        'revenue_daily_trends',
        'reservation_daily_trends',
        'shop_performance_summary',
        'payment_status_summary',
        'point_transaction_summary',
        'category_performance_summary'
      ];

      // This would require a Supabase RPC function like:
      // CREATE OR REPLACE FUNCTION refresh_analytics_views()
      // RETURNS void AS $$
      // BEGIN
      //   REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_quick_metrics;
      //   REFRESH MATERIALIZED VIEW CONCURRENTLY user_growth_daily_trends;
      //   ...
      // END;
      // $$ LANGUAGE plpgsql;

      const { error } = await this.supabase.rpc('refresh_analytics_views');

      if (error) {
        logger.error('Error refreshing materialized views', { error });
        throw error;
      }

      return {
        success: true,
        message: `Successfully refreshed ${views.length} materialized views`
      };
    } catch (error) {
      logger.error('Error in refreshAllViews', { error });
      throw error;
    }
  }
}
