import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Real-time Analytics Service
 *
 * Provides accurate, real-time dashboard metrics calculated on-demand
 * from actual database data. Used as fallback when materialized views
 * are outdated or unavailable.
 */

export interface RealTimeDashboardMetrics {
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
  calculationMethod: 'realtime';
}

export class AdminAnalyticsRealtimeService {
  private supabase = getSupabaseClient();

  /**
   * Get real-time dashboard metrics calculated from actual database data
   *
   * @param shopId - Optional shop ID to filter metrics for shop owners
   */
  async getRealTimeDashboardMetrics(shopId?: string): Promise<RealTimeDashboardMetrics> {
    try {
      logger.info('Calculating real-time dashboard metrics', { shopId });

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

      // Calculate user metrics (shop-filtered if shopId provided)
      const userMetrics = await this.calculateUserMetrics(today, monthStart, prevMonthStart, prevMonthEnd, shopId);

      // Calculate revenue metrics (shop-filtered if shopId provided)
      const revenueMetrics = await this.calculateRevenueMetrics(today, monthStart, prevMonthStart, prevMonthEnd, shopId);

      // Calculate reservation metrics (shop-filtered if shopId provided)
      const reservationMetrics = await this.calculateReservationMetrics(today, shopId);

      // Calculate shop metrics (single shop or all shops)
      const shopMetrics = await this.calculateShopMetrics(shopId);

      // Calculate payment metrics (shop-filtered if shopId provided)
      const paymentMetrics = await this.calculatePaymentMetrics(shopId);

      return {
        ...userMetrics,
        ...revenueMetrics,
        ...reservationMetrics,
        ...shopMetrics,
        ...paymentMetrics,
        lastUpdated: now.toISOString(),
        calculationMethod: 'realtime'
      };

    } catch (error) {
      logger.error('Error calculating real-time dashboard metrics', { error });
      throw error;
    }
  }

  private async calculateUserMetrics(today: string, monthStart: string, prevMonthStart: string, prevMonthEnd: string, shopId?: string) {
    try {
      // Build base query
      let totalUsersQuery = this.supabase.from('users').select('*', { count: 'exact', head: true });
      let activeUsersQuery = this.supabase.from('users').select('*', { count: 'exact', head: true }).eq('user_status', 'active');
      let newUsersThisMonthQuery = this.supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart + 'T00:00:00')
        .lt('created_at', new Date().toISOString());
      let newUsersPrevMonthQuery = this.supabase.from('users').select('*', { count: 'exact', head: true })
        .gte('created_at', prevMonthStart + 'T00:00:00')
        .lte('created_at', prevMonthEnd + 'T23:59:59');

      // Apply shop filter if provided
      if (shopId) {
        totalUsersQuery = totalUsersQuery.eq('shop_id', shopId);
        activeUsersQuery = activeUsersQuery.eq('shop_id', shopId);
        newUsersThisMonthQuery = newUsersThisMonthQuery.eq('shop_id', shopId);
        newUsersPrevMonthQuery = newUsersPrevMonthQuery.eq('shop_id', shopId);
      }

      // Execute queries
      const { count: totalUsers } = await totalUsersQuery;
      const { count: activeUsers } = await activeUsersQuery;
      const { count: newUsersThisMonth } = await newUsersThisMonthQuery;
      const { count: newUsersPrevMonth } = await newUsersPrevMonthQuery;

      // Calculate growth rate
      const userGrowthRate = newUsersPrevMonth > 0
        ? Math.round(((newUsersThisMonth - newUsersPrevMonth) / newUsersPrevMonth) * 100 * 100) / 100
        : 0;

      return {
        totalUsers: totalUsers || 0,
        activeUsers: activeUsers || 0,
        newUsersThisMonth: newUsersThisMonth || 0,
        userGrowthRate
      };
    } catch (error) {
      logger.error('Error calculating user metrics', { error });
      throw error;
    }
  }

  private async calculateRevenueMetrics(today: string, monthStart: string, prevMonthStart: string, prevMonthEnd: string, shopId?: string) {
    try {
      // Build query for total revenue
      let paymentsQuery = this.supabase
        .from('payments')
        .select('amount, created_at, shop_id')
        .not('amount', 'is', null);

      // Apply shop filter if provided
      if (shopId) {
        paymentsQuery = paymentsQuery.eq('shop_id', shopId);
      }

      const { data: allPayments } = await paymentsQuery;

      const totalRevenue = allPayments?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

      // Today's revenue
      const todayPayments = allPayments?.filter(p =>
        p.created_at && p.created_at.startsWith(today)
      ) || [];
      const todayRevenue = todayPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // This month's revenue
      const thisMonthPayments = allPayments?.filter(p =>
        p.created_at && p.created_at >= monthStart + 'T00:00:00'
      ) || [];
      const monthRevenue = thisMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Previous month's revenue
      const prevMonthPayments = allPayments?.filter(p =>
        p.created_at &&
        p.created_at >= prevMonthStart + 'T00:00:00' &&
        p.created_at <= prevMonthEnd + 'T23:59:59'
      ) || [];
      const prevMonthRevenue = prevMonthPayments.reduce((sum, p) => sum + (p.amount || 0), 0);

      // Calculate growth rate
      const revenueGrowthRate = prevMonthRevenue > 0
        ? Math.round(((monthRevenue - prevMonthRevenue) / prevMonthRevenue) * 100 * 100) / 100
        : 0;

      return {
        totalRevenue,
        todayRevenue,
        monthRevenue,
        revenueGrowthRate
      };
    } catch (error) {
      logger.error('Error calculating revenue metrics', { error });
      throw error;
    }
  }

  private async calculateReservationMetrics(today: string, shopId?: string) {
    try {
      // Build base queries
      let totalReservationsQuery = this.supabase.from('reservations').select('*', { count: 'exact', head: true });
      let activeReservationsQuery = this.supabase.from('reservations').select('*', { count: 'exact', head: true }).in('status', ['confirmed', 'requested']);
      let todayReservationsQuery = this.supabase.from('reservations').select('*', { count: 'exact', head: true })
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59');
      let completedReservationsQuery = this.supabase.from('reservations').select('*', { count: 'exact', head: true }).eq('status', 'completed');

      // Apply shop filter if provided
      if (shopId) {
        totalReservationsQuery = totalReservationsQuery.eq('shop_id', shopId);
        activeReservationsQuery = activeReservationsQuery.eq('shop_id', shopId);
        todayReservationsQuery = todayReservationsQuery.eq('shop_id', shopId);
        completedReservationsQuery = completedReservationsQuery.eq('shop_id', shopId);
      }

      // Execute queries
      const { count: totalReservations } = await totalReservationsQuery;
      const { count: activeReservations } = await activeReservationsQuery;
      const { count: todayReservations } = await todayReservationsQuery;
      const { count: completedReservations } = await completedReservationsQuery;

      // Calculate success rate
      const reservationSuccessRate = totalReservations > 0
        ? Math.round((completedReservations / totalReservations) * 100 * 100) / 100
        : 0;

      return {
        totalReservations: totalReservations || 0,
        activeReservations: activeReservations || 0,
        todayReservations: todayReservations || 0,
        reservationSuccessRate
      };
    } catch (error) {
      logger.error('Error calculating reservation metrics', { error });
      throw error;
    }
  }

  private async calculateShopMetrics(shopId?: string) {
    try {
      if (shopId) {
        // For shop owners, just return info about their single shop
        const { data: shop, error } = await this.supabase
          .from('shops')
          .select('*')
          .eq('id', shopId)
          .single();

        if (error) {
          logger.error('Error fetching shop info', { error, shopId });
          throw error;
        }

        return {
          totalShops: 1,
          activeShops: shop?.shop_status === 'active' ? 1 : 0,
          pendingApprovals: shop?.shop_status === 'pending_approval' ? 1 : 0
        };
      }

      // For admin, return system-wide stats
      const { count: totalShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true });

      const { count: activeShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('shop_status', 'active');

      const { count: pendingApprovals } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('shop_status', 'pending_approval');

      return {
        totalShops: totalShops || 0,
        activeShops: activeShops || 0,
        pendingApprovals: pendingApprovals || 0
      };
    } catch (error) {
      logger.error('Error calculating shop metrics', { error });
      throw error;
    }
  }

  private async calculatePaymentMetrics(shopId?: string) {
    try {
      // Build base queries
      let totalTransactionsQuery = this.supabase.from('payments').select('*', { count: 'exact', head: true });
      let successfulTransactionsQuery = this.supabase.from('payments').select('*', { count: 'exact', head: true }).in('status', ['fully_paid', 'deposit_paid']);

      // Apply shop filter if provided
      if (shopId) {
        totalTransactionsQuery = totalTransactionsQuery.eq('shop_id', shopId);
        successfulTransactionsQuery = successfulTransactionsQuery.eq('shop_id', shopId);
      }

      // Execute queries
      const { count: totalTransactions } = await totalTransactionsQuery;
      const { count: successfulTransactions } = await successfulTransactionsQuery;

      // If status column doesn't exist, assume all payments with amounts are successful
      let actualSuccessful = successfulTransactions;
      if (successfulTransactions === null || successfulTransactions === 0) {
        let paymentsWithAmountQuery = this.supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .not('amount', 'is', null)
          .gt('amount', 0);

        if (shopId) {
          paymentsWithAmountQuery = paymentsWithAmountQuery.eq('shop_id', shopId);
        }

        const { count: paymentsWithAmount } = await paymentsWithAmountQuery;
        actualSuccessful = paymentsWithAmount;
      }

      // Calculate conversion rate
      const conversionRate = totalTransactions > 0
        ? Math.round((actualSuccessful / totalTransactions) * 100 * 100) / 100
        : 0;

      return {
        totalTransactions: totalTransactions || 0,
        successfulTransactions: actualSuccessful || 0,
        conversionRate
      };
    } catch (error) {
      logger.error('Error calculating payment metrics', { error });
      throw error;
    }
  }
}