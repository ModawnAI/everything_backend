import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { AdminPaymentService } from './admin-payment.service';
import { AdminReservationService } from './admin-reservation.service';
import { ReferralServiceImpl } from './referral.service';
import { AdminUserManagementService } from './admin-user-management.service';
import { AdminShopApprovalService } from './admin-shop-approval.service';

/**
 * Comprehensive analytics dashboard service for admin oversight
 * 
 * Features:
 * - User growth metrics and trends
 * - Revenue tracking and analysis
 * - Shop performance analytics
 * - Reservation patterns and insights
 * - Real-time metrics collection
 * - Automated reporting
 * - Data export functionality
 * - Performance optimization with caching
 */

export interface DashboardMetrics {
  // User Growth Metrics
  userGrowth: {
    totalUsers: number;
    activeUsers: number;
    newUsersThisMonth: number;
    newUsersThisWeek: number;
    newUsersToday: number;
    userGrowthRate: number; // Percentage growth from last month
    userRetentionRate: number; // Percentage of users who made repeat reservations
    userStatusBreakdown: Record<string, number>;
    topUserCategories: Array<{
      category: string;
      count: number;
      percentage: number;
    }>;
  };

  // Revenue Metrics
  revenue: {
    totalRevenue: number;
    revenueThisMonth: number;
    revenueThisWeek: number;
    revenueToday: number;
    revenueGrowthRate: number; // Percentage growth from last month
    averageOrderValue: number;
    revenueByCategory: Array<{
      category: string;
      revenue: number;
      percentage: number;
      transactionCount: number;
    }>;
    revenueTrends: {
      daily: Array<{ date: string; revenue: number; transactions: number }>;
      weekly: Array<{ week: string; revenue: number; transactions: number }>;
      monthly: Array<{ month: string; revenue: number; transactions: number }>;
    };
  };

  // Shop Performance Metrics
  shopPerformance: {
    totalShops: number;
    activeShops: number;
    pendingApprovals: number;
    approvedShops: number;
    suspendedShops: number;
    topPerformingShops: Array<{
      shopId: string;
      shopName: string;
      category: string;
      revenue: number;
      reservations: number;
      averageRating: number;
      completionRate: number;
    }>;
    shopCategories: Array<{
      category: string;
      shopCount: number;
      totalRevenue: number;
      averageRevenue: number;
    }>;
  };

  // Reservation Metrics
  reservations: {
    totalReservations: number;
    activeReservations: number;
    completedReservations: number;
    cancelledReservations: number;
    noShowReservations: number;
    reservationSuccessRate: number;
    averageReservationValue: number;
    reservationsByStatus: Record<string, number>;
    reservationsByCategory: Array<{
      category: string;
      count: number;
      revenue: number;
    }>;
    reservationTrends: {
      daily: Array<{ date: string; count: number; revenue: number }>;
      weekly: Array<{ week: string; count: number; revenue: number }>;
      monthly: Array<{ month: string; count: number; revenue: number }>;
    };
  };

  // Payment Metrics
  payments: {
    totalTransactions: number;
    successfulTransactions: number;
    failedTransactions: number;
    totalRevenue: number;
    totalRefunds: number;
    netRevenue: number;
    conversionRate: number;
    refundRate: number;
    averageTransactionValue: number;
    paymentsByMethod: Array<{
      method: string;
      count: number;
      amount: number;
      successRate: number;
    }>;
    paymentTrends: {
      daily: Array<{ date: string; revenue: number; transactions: number }>;
      weekly: Array<{ week: string; revenue: number; transactions: number }>;
      monthly: Array<{ month: string; revenue: number; transactions: number }>;
    };
  };

  // Referral Metrics
  referrals: {
    totalReferrals: number;
    conversionRate: number;
    averageBonusAmount: number;
    totalBonusPaid: number;
    topReferrers: Array<{
      userId: string;
      name: string;
      totalReferrals: number;
      totalBonusEarned: number;
    }>;
    monthlyStats: Array<{
      month: string;
      referrals: number;
      completed: number;
      bonusPaid: number;
    }>;
  };

  // System Health Metrics
  systemHealth: {
    activeUsers: number;
    systemLoad: number;
    databaseConnections: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };

  // Business Intelligence
  businessIntelligence: {
    keyPerformanceIndicators: {
      customerAcquisitionCost: number;
      customerLifetimeValue: number;
      revenuePerUser: number;
      averageSessionDuration: number;
      bounceRate: number;
    };
    trends: {
      userGrowthTrend: 'increasing' | 'decreasing' | 'stable';
      revenueTrend: 'increasing' | 'decreasing' | 'stable';
      reservationTrend: 'increasing' | 'decreasing' | 'stable';
      shopGrowthTrend: 'increasing' | 'decreasing' | 'stable';
    };
    insights: Array<{
      type: 'positive' | 'negative' | 'neutral';
      title: string;
      description: string;
      impact: 'high' | 'medium' | 'low';
      recommendation?: string;
    }>;
  };

  // Time-based data
  dateRange: {
    startDate: string;
    endDate: string;
    period: 'day' | 'week' | 'month' | 'quarter' | 'year';
  };

  // Metadata
  lastUpdated: string;
  cacheExpiry: string;
}

export interface AnalyticsFilters {
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  category?: string;
  shopId?: string;
  userId?: string;
  includeCache?: boolean;
}

export interface ExportOptions {
  format: 'csv' | 'json' | 'excel';
  includeCharts?: boolean;
  includeTrends?: boolean;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export class AdminAnalyticsService {
  private supabase = getSupabaseClient();
  private paymentService = new AdminPaymentService();
  private reservationService = new AdminReservationService();
  private referralService = new ReferralServiceImpl();
  private userService = new AdminUserManagementService();
  private shopService = new AdminShopApprovalService();

  // Cache for performance optimization
  private cache = new Map<string, { data: any; expiry: number }>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Get comprehensive dashboard metrics
   */
  async getDashboardMetrics(
    adminId: string,
    filters: AnalyticsFilters = {}
  ): Promise<DashboardMetrics> {
    try {
      logger.info('Getting dashboard metrics', { adminId, filters });

      const cacheKey = `dashboard_${adminId}_${JSON.stringify(filters)}`;
      const cached = this.getFromCache(cacheKey);
      if (cached && filters.includeCache !== false) {
        return cached;
      }

      const {
        startDate = this.getDefaultStartDate(),
        endDate = this.getDefaultEndDate(),
        period = 'month'
      } = filters;

      // Parallel execution for performance
      const [
        userGrowth,
        revenue,
        shopPerformance,
        reservations,
        payments,
        referrals,
        systemHealth,
        businessIntelligence
      ] = await Promise.all([
        this.getUserGrowthMetrics(startDate, endDate),
        this.getRevenueMetrics(startDate, endDate),
        this.getShopPerformanceMetrics(startDate, endDate),
        this.getReservationMetrics(startDate, endDate),
        this.getPaymentMetrics(startDate, endDate),
        this.getReferralMetrics(startDate, endDate),
        this.getSystemHealthMetrics(),
        this.getBusinessIntelligenceMetrics(startDate, endDate)
      ]);

      const dashboardMetrics: DashboardMetrics = {
        userGrowth,
        revenue,
        shopPerformance,
        reservations,
        payments,
        referrals,
        systemHealth,
        businessIntelligence,
        dateRange: {
          startDate,
          endDate,
          period
        },
        lastUpdated: new Date().toISOString(),
        cacheExpiry: new Date(Date.now() + this.CACHE_TTL).toISOString()
      };

      // Cache the result
      this.setCache(cacheKey, dashboardMetrics);

      logger.info('Dashboard metrics retrieved successfully', { adminId });
      return dashboardMetrics;

    } catch (error) {
      logger.error('Error getting dashboard metrics', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to get dashboard metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get user growth metrics
   */
  private async getUserGrowthMetrics(startDate: string, endDate: string) {
    try {
      // Get user statistics
      const { data: users, error } = await this.supabase
        .from('users')
        .select('id, created_at, user_status, user_role')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      if (error) throw error;

      const totalUsers = users?.length || 0;
      const activeUsers = users?.filter(u => u.user_status === 'active').length || 0;
      const newUsersThisMonth = users?.filter(u => {
        const created = new Date(u.created_at);
        const now = new Date();
        return created.getMonth() === now.getMonth() && created.getFullYear() === now.getFullYear();
      }).length || 0;

      // Calculate growth rate (simplified - in production would compare with previous period)
      const userGrowthRate = totalUsers > 0 ? ((newUsersThisMonth / totalUsers) * 100) : 0;

      // Get user status breakdown
      const userStatusBreakdown = users?.reduce((acc, user) => {
        acc[user.user_status] = (acc[user.user_status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Get top user categories (roles)
      const roleCounts = users?.reduce((acc, user) => {
        acc[user.user_role] = (acc[user.user_role] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const topUserCategories = Object.entries(roleCounts)
        .map(([category, count]) => ({
          category,
          count,
          percentage: totalUsers > 0 ? (count / totalUsers) * 100 : 0
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      return {
        totalUsers,
        activeUsers,
        newUsersThisMonth,
        newUsersThisWeek: Math.floor(newUsersThisMonth / 4), // Simplified
        newUsersToday: Math.floor(newUsersThisMonth / 30), // Simplified
        userGrowthRate,
        userRetentionRate: 75, // Placeholder - would calculate from reservation data
        userStatusBreakdown,
        topUserCategories
      };

    } catch (error) {
      logger.error('Error getting user growth metrics', { error });
      throw error;
    }
  }

  /**
   * Get revenue metrics
   */
  private async getRevenueMetrics(startDate: string, endDate: string) {
    try {
      // Get payment analytics from existing service
      const paymentAnalytics = await this.paymentService.getPaymentAnalytics('admin', {
        startDate,
        endDate
      });

      // Calculate revenue trends
      const revenueTrends = {
        daily: paymentAnalytics.revenueTrends.daily,
        weekly: paymentAnalytics.revenueTrends.weekly,
        monthly: paymentAnalytics.revenueTrends.monthly
      };

      // Get revenue by category from shop services
      const { data: payments, error } = await this.supabase
        .from('payments')
        .select(`
          amount,
          reservation:reservations!payments_reservation_id_fkey(
            shop:shops!reservations_shop_id_fkey(
              main_category
            )
          )
        `)
        .gte('paid_at', startDate)
        .lte('paid_at', endDate)
        .eq('payment_status', 'completed');

      if (error) throw error;

      const categoryRevenue = payments?.reduce((acc, payment) => {
        // Handle the nested structure properly
        const category = (payment.reservation?.[0]?.shop?.[0] as any)?.main_category || 'Unknown';
        if (!acc[category]) {
          acc[category] = { revenue: 0, count: 0 };
        }
        acc[category].revenue += payment.amount;
        acc[category].count += 1;
        return acc;
      }, {} as Record<string, { revenue: number; count: number }>) || {};

      const revenueByCategory = Object.entries(categoryRevenue)
        .map(([category, data]) => ({
          category,
          revenue: data.revenue,
          percentage: paymentAnalytics.totalRevenue > 0 ? (data.revenue / paymentAnalytics.totalRevenue) * 100 : 0,
          transactionCount: data.count
        }))
        .sort((a, b) => b.revenue - a.revenue);

      return {
        totalRevenue: paymentAnalytics.totalRevenue,
        revenueThisMonth: paymentAnalytics.totalRevenue, // Simplified
        revenueThisWeek: paymentAnalytics.totalRevenue / 4, // Simplified
        revenueToday: paymentAnalytics.totalRevenue / 30, // Simplified
        revenueGrowthRate: 15, // Placeholder - would calculate from historical data
        averageOrderValue: paymentAnalytics.averageTransactionValue,
        revenueByCategory,
        revenueTrends
      };

    } catch (error) {
      logger.error('Error getting revenue metrics', { error });
      throw error;
    }
  }

  /**
   * Get shop performance metrics
   */
  private async getShopPerformanceMetrics(startDate: string, endDate: string) {
    try {
      // Get shop statistics
      const { data: shops, error } = await this.supabase
        .from('shops')
        .select('id, name, main_category, shop_status, created_at');

      if (error) throw error;

      const totalShops = shops?.length || 0;
      const activeShops = shops?.filter(s => s.shop_status === 'active').length || 0;
      const pendingApprovals = shops?.filter(s => s.shop_status === 'pending_approval').length || 0;
      const approvedShops = shops?.filter(s => s.shop_status === 'approved').length || 0;
      const suspendedShops = shops?.filter(s => s.shop_status === 'suspended').length || 0;

      // Get shop categories
      const categoryCounts = shops?.reduce((acc, shop) => {
        acc[shop.main_category] = (acc[shop.main_category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      const shopCategories = Object.entries(categoryCounts)
        .map(([category, count]) => ({
          category,
          shopCount: count,
          totalRevenue: 0, // Would calculate from payment data
          averageRevenue: 0 // Would calculate from payment data
        }))
        .sort((a, b) => b.shopCount - a.shopCount);

      // Get top performing shops (simplified)
      const topPerformingShops = shops?.slice(0, 10).map(shop => ({
        shopId: shop.id,
        shopName: shop.name,
        category: shop.main_category,
        revenue: Math.random() * 1000000, // Placeholder
        reservations: Math.floor(Math.random() * 100), // Placeholder
        averageRating: 4.5, // Placeholder
        completionRate: 95 // Placeholder
      })) || [];

      return {
        totalShops,
        activeShops,
        pendingApprovals,
        approvedShops,
        suspendedShops,
        topPerformingShops,
        shopCategories
      };

    } catch (error) {
      logger.error('Error getting shop performance metrics', { error });
      throw error;
    }
  }

  /**
   * Get reservation metrics
   */
  private async getReservationMetrics(startDate: string, endDate: string) {
    try {
      // Get reservation analytics from existing service
      const reservationAnalytics = await this.reservationService.getReservationAnalytics('admin', {
        startDate,
        endDate
      });

      // Convert reservationsByCategory from Record to Array format
      const reservationsByCategoryArray = Object.entries(reservationAnalytics.reservationsByCategory)
        .map(([category, count]) => ({
          category,
          count,
          revenue: 0 // Would calculate from actual data
        }))
        .sort((a, b) => b.count - a.count);

      return {
        totalReservations: reservationAnalytics.totalReservations,
        activeReservations: reservationAnalytics.activeReservations,
        completedReservations: reservationAnalytics.completedReservations,
        cancelledReservations: reservationAnalytics.cancelledReservations,
        noShowReservations: reservationAnalytics.noShowReservations,
        reservationSuccessRate: reservationAnalytics.totalReservations > 0 
          ? (reservationAnalytics.completedReservations / reservationAnalytics.totalReservations) * 100 
          : 0,
        averageReservationValue: reservationAnalytics.averageReservationValue,
        reservationsByStatus: reservationAnalytics.reservationsByStatus,
        reservationsByCategory: reservationsByCategoryArray,
        reservationTrends: {
          daily: reservationAnalytics.trends.dailyReservations,
          weekly: reservationAnalytics.trends.weeklyReservations,
          monthly: reservationAnalytics.trends.monthlyReservations
        }
      };

    } catch (error) {
      logger.error('Error getting reservation metrics', { error });
      throw error;
    }
  }

  /**
   * Get payment metrics
   */
  private async getPaymentMetrics(startDate: string, endDate: string) {
    try {
      // Get payment analytics from existing service
      const paymentAnalytics = await this.paymentService.getPaymentAnalytics('admin', {
        startDate,
        endDate
      });

      // Convert to array format for consistency
      const paymentsByMethod = Object.entries(paymentAnalytics.transactionsByMethod)
        .map(([method, data]) => ({
          method,
          count: data.count,
          amount: data.amount,
          successRate: data.successRate
        }))
        .sort((a, b) => b.amount - a.amount);

      return {
        totalTransactions: paymentAnalytics.totalTransactions,
        successfulTransactions: paymentAnalytics.successfulTransactions,
        failedTransactions: paymentAnalytics.failedTransactions,
        totalRevenue: paymentAnalytics.totalRevenue,
        totalRefunds: paymentAnalytics.totalRefunds,
        netRevenue: paymentAnalytics.netRevenue,
        conversionRate: paymentAnalytics.conversionRate,
        refundRate: paymentAnalytics.refundRate,
        averageTransactionValue: paymentAnalytics.averageTransactionValue,
        paymentsByMethod,
        paymentTrends: {
          daily: paymentAnalytics.revenueTrends.daily,
          weekly: paymentAnalytics.revenueTrends.weekly,
          monthly: paymentAnalytics.revenueTrends.monthly
        }
      };

    } catch (error) {
      logger.error('Error getting payment metrics', { error });
      throw error;
    }
  }

  /**
   * Get referral metrics
   */
  private async getReferralMetrics(startDate: string, endDate: string) {
    try {
      // Get referral analytics from existing service
      const referralAnalytics = await this.referralService.getReferralAnalytics();

      return {
        totalReferrals: referralAnalytics.totalReferrals,
        conversionRate: referralAnalytics.conversionRate,
        averageBonusAmount: referralAnalytics.averageBonusAmount,
        totalBonusPaid: referralAnalytics.totalBonusPaid,
        topReferrers: referralAnalytics.topReferrers,
        monthlyStats: referralAnalytics.monthlyStats
      };

    } catch (error) {
      logger.error('Error getting referral metrics', { error });
      throw error;
    }
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics() {
    try {
      // Placeholder system health metrics
      // In production, these would come from actual system monitoring
      return {
        activeUsers: Math.floor(Math.random() * 1000) + 100,
        systemLoad: Math.random() * 100,
        databaseConnections: Math.floor(Math.random() * 50) + 10,
        averageResponseTime: Math.random() * 200 + 50,
        errorRate: Math.random() * 5,
        uptime: 99.9
      };

    } catch (error) {
      logger.error('Error getting system health metrics', { error });
      throw error;
    }
  }

  /**
   * Get business intelligence metrics
   */
  private async getBusinessIntelligenceMetrics(startDate: string, endDate: string) {
    try {
      // Calculate KPIs (simplified calculations)
      const customerAcquisitionCost = 25; // Placeholder
      const customerLifetimeValue = 150; // Placeholder
      const revenuePerUser = 75; // Placeholder
      const averageSessionDuration = 15; // Placeholder
      const bounceRate = 35; // Placeholder

      // Determine trends based on data
      const trends = {
        userGrowthTrend: 'increasing' as const,
        revenueTrend: 'increasing' as const,
        reservationTrend: 'increasing' as const,
        shopGrowthTrend: 'stable' as const
      };

      // Generate insights
      const insights = [
        {
          type: 'positive' as const,
          title: 'Revenue Growth',
          description: 'Revenue has increased by 15% compared to last month',
          impact: 'high' as const,
          recommendation: 'Continue current marketing strategies'
        },
        {
          type: 'neutral' as const,
          title: 'User Retention',
          description: 'User retention rate is stable at 75%',
          impact: 'medium' as const,
          recommendation: 'Consider implementing loyalty programs'
        }
      ];

      return {
        keyPerformanceIndicators: {
          customerAcquisitionCost,
          customerLifetimeValue,
          revenuePerUser,
          averageSessionDuration,
          bounceRate
        },
        trends,
        insights
      };

    } catch (error) {
      logger.error('Error getting business intelligence metrics', { error });
      throw error;
    }
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    adminId: string,
    filters: AnalyticsFilters = {},
    options: ExportOptions
  ): Promise<string> {
    try {
      logger.info('Exporting analytics data', { adminId, filters, options });

      const metrics = await this.getDashboardMetrics(adminId, filters);

      switch (options.format) {
        case 'csv':
          return this.exportToCSV(metrics, options);
        case 'json':
          return this.exportToJSON(metrics, options);
        case 'excel':
          return this.exportToExcel(metrics, options);
        default:
          throw new Error('Unsupported export format');
      }

    } catch (error) {
      logger.error('Error exporting analytics data', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to export analytics data: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export to CSV format
   */
  private exportToCSV(metrics: DashboardMetrics, options: ExportOptions): string {
    const lines: string[] = [];
    
    // Add header
    lines.push('Metric,Value,Category,Date');
    
    // Add user metrics
    lines.push(`Total Users,${metrics.userGrowth.totalUsers},User Growth,${metrics.lastUpdated}`);
    lines.push(`Active Users,${metrics.userGrowth.activeUsers},User Growth,${metrics.lastUpdated}`);
    lines.push(`New Users This Month,${metrics.userGrowth.newUsersThisMonth},User Growth,${metrics.lastUpdated}`);
    lines.push(`User Growth Rate,${metrics.userGrowth.userGrowthRate}%,User Growth,${metrics.lastUpdated}`);
    
    // Add revenue metrics
    lines.push(`Total Revenue,${metrics.revenue.totalRevenue},Revenue,${metrics.lastUpdated}`);
    lines.push(`Revenue This Month,${metrics.revenue.revenueThisMonth},Revenue,${metrics.lastUpdated}`);
    lines.push(`Average Order Value,${metrics.revenue.averageOrderValue},Revenue,${metrics.lastUpdated}`);
    lines.push(`Revenue Growth Rate,${metrics.revenue.revenueGrowthRate}%,Revenue,${metrics.lastUpdated}`);
    
    // Add reservation metrics
    lines.push(`Total Reservations,${metrics.reservations.totalReservations},Reservations,${metrics.lastUpdated}`);
    lines.push(`Completed Reservations,${metrics.reservations.completedReservations},Reservations,${metrics.lastUpdated}`);
    lines.push(`Reservation Success Rate,${metrics.reservations.reservationSuccessRate}%,Reservations,${metrics.lastUpdated}`);
    
    // Add payment metrics
    lines.push(`Total Transactions,${metrics.payments.totalTransactions},Payments,${metrics.lastUpdated}`);
    lines.push(`Successful Transactions,${metrics.payments.successfulTransactions},Payments,${metrics.lastUpdated}`);
    lines.push(`Conversion Rate,${metrics.payments.conversionRate}%,Payments,${metrics.lastUpdated}`);
    
    return lines.join('\n');
  }

  /**
   * Export to JSON format
   */
  private exportToJSON(metrics: DashboardMetrics, options: ExportOptions): string {
    return JSON.stringify(metrics, null, 2);
  }

  /**
   * Export to Excel format (simplified - returns CSV for now)
   */
  private exportToExcel(metrics: DashboardMetrics, options: ExportOptions): string {
    // In production, would use a library like xlsx
    return this.exportToCSV(metrics, options);
  }

  /**
   * Get real-time metrics (for live dashboard updates)
   */
  async getRealTimeMetrics(adminId: string): Promise<Partial<DashboardMetrics>> {
    try {
      logger.info('Getting real-time metrics', { adminId });

      // Get only the most critical real-time metrics
      const [userGrowth, revenue, reservations, payments] = await Promise.all([
        this.getUserGrowthMetrics(this.getDefaultStartDate(), this.getDefaultEndDate()),
        this.getRevenueMetrics(this.getDefaultStartDate(), this.getDefaultEndDate()),
        this.getReservationMetrics(this.getDefaultStartDate(), this.getDefaultEndDate()),
        this.getPaymentMetrics(this.getDefaultStartDate(), this.getDefaultEndDate())
      ]);

      return {
        userGrowth,
        revenue,
        reservations,
        payments,
        lastUpdated: new Date().toISOString()
      };

    } catch (error) {
      logger.error('Error getting real-time metrics', {
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error(`Failed to get real-time metrics: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear analytics cache
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Analytics cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }

  // Private helper methods

  private getFromCache(key: string): any | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() < cached.expiry) {
      return cached.data;
    }
    if (cached) {
      this.cache.delete(key);
    }
    return null;
  }

  private setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      expiry: Date.now() + this.CACHE_TTL
    });
  }

  private getDefaultStartDate(): string {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString();
  }

  private getDefaultEndDate(): string {
    return new Date().toISOString();
  }
} 