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
   */
  async getRealTimeDashboardMetrics(): Promise<RealTimeDashboardMetrics> {
    try {
      logger.info('Calculating real-time dashboard metrics');

      const now = new Date();
      const today = now.toISOString().split('T')[0];
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const prevMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
      const prevMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

      // Calculate user metrics
      const userMetrics = await this.calculateUserMetrics(today, monthStart, prevMonthStart, prevMonthEnd);

      // Calculate revenue metrics
      const revenueMetrics = await this.calculateRevenueMetrics(today, monthStart, prevMonthStart, prevMonthEnd);

      // Calculate reservation metrics
      const reservationMetrics = await this.calculateReservationMetrics(today);

      // Calculate shop metrics
      const shopMetrics = await this.calculateShopMetrics();

      // Calculate payment metrics
      const paymentMetrics = await this.calculatePaymentMetrics();

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

  private async calculateUserMetrics(today: string, monthStart: string, prevMonthStart: string, prevMonthEnd: string) {
    try {
      // Total and active users
      const { count: totalUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true });

      const { count: activeUsers } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('user_status', 'active');

      // New users this month
      const { count: newUsersThisMonth } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', monthStart + 'T00:00:00')
        .lt('created_at', new Date().toISOString());

      // New users previous month
      const { count: newUsersPrevMonth } = await this.supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', prevMonthStart + 'T00:00:00')
        .lte('created_at', prevMonthEnd + 'T23:59:59');

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

  private async calculateRevenueMetrics(today: string, monthStart: string, prevMonthStart: string, prevMonthEnd: string) {
    try {
      // Total revenue
      const { data: allPayments } = await this.supabase
        .from('payments')
        .select('amount, created_at')
        .not('amount', 'is', null);

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

  private async calculateReservationMetrics(today: string) {
    try {
      // Total reservations
      const { count: totalReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true });

      // Active reservations (confirmed or requested)
      const { count: activeReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .in('status', ['confirmed', 'requested']);

      // Today's reservations
      const { count: todayReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', today + 'T00:00:00')
        .lt('created_at', today + 'T23:59:59');

      // Completed reservations for success rate
      const { count: completedReservations } = await this.supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'completed');

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

  private async calculateShopMetrics() {
    try {
      // Total shops
      const { count: totalShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true });

      // Active shops
      const { count: activeShops } = await this.supabase
        .from('shops')
        .select('*', { count: 'exact', head: true })
        .eq('shop_status', 'active');

      // Pending approvals
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

  private async calculatePaymentMetrics() {
    try {
      // Total transactions
      const { count: totalTransactions } = await this.supabase
        .from('payments')
        .select('*', { count: 'exact', head: true });

      // Successful transactions (assuming status exists)
      const { count: successfulTransactions } = await this.supabase
        .from('payments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['fully_paid', 'deposit_paid']);

      // If status column doesn't exist, assume all payments with amounts are successful
      let actualSuccessful = successfulTransactions;
      if (successfulTransactions === null || successfulTransactions === 0) {
        const { count: paymentsWithAmount } = await this.supabase
          .from('payments')
          .select('*', { count: 'exact', head: true })
          .not('amount', 'is', null)
          .gt('amount', 0);

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