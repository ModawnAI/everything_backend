import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

const supabase = getSupabaseClient();

interface DashboardStats {
  totalRevenue: number;
  revenueGrowth: number;
  totalCustomers: number;
  customersGrowth: number;
  totalProducts: number;
  newProducts: number;
  activeOrders: number;
  ordersGrowth: number;
}

interface RecentOrder {
  id: string;
  customer: string;
  customerEmail: string;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  amount: number;
  createdAt: string;
}

interface TopProduct {
  id: string;
  name: string;
  sales: number;
  revenue: number;
}

interface DashboardOverview {
  stats: DashboardStats;
  recentOrders: RecentOrder[];
  topProducts: TopProduct[];
}

type Period = '7d' | '30d' | '90d';

export class DashboardService {
  /**
   * Get dashboard overview statistics
   */
  async getDashboardOverview(period: Period = '30d'): Promise<DashboardOverview> {
    const days = this.parsePeriodToDays(period);
    const currentPeriodStart = new Date();
    currentPeriodStart.setDate(currentPeriodStart.getDate() - days);

    const previousPeriodStart = new Date();
    previousPeriodStart.setDate(previousPeriodStart.getDate() - (days * 2));
    const previousPeriodEnd = new Date(currentPeriodStart);

    // Calculate all statistics in parallel
    const [
      stats,
      recentOrders,
      topProducts
    ] = await Promise.all([
      this.calculateStats(currentPeriodStart, previousPeriodStart, previousPeriodEnd),
      this.getRecentOrders(10),
      this.getTopProducts(days, 5)
    ]);

    return {
      stats,
      recentOrders,
      topProducts
    };
  }

  /**
   * Calculate dashboard statistics
   */
  private async calculateStats(
    currentPeriodStart: Date,
    previousPeriodStart: Date,
    previousPeriodEnd: Date
  ): Promise<DashboardStats> {
    // Get current period data
    const [
      currentRevenue,
      previousRevenue,
      currentCustomers,
      previousCustomers,
      totalProducts,
      newProducts,
      currentOrders,
      previousOrders
    ] = await Promise.all([
      this.calculateRevenue(currentPeriodStart),
      this.calculateRevenue(previousPeriodStart, previousPeriodEnd),
      this.countNewCustomers(currentPeriodStart),
      this.countNewCustomers(previousPeriodStart, previousPeriodEnd),
      this.countTotalProducts(),
      this.countNewProducts(currentPeriodStart),
      this.countActiveOrders(currentPeriodStart),
      this.countActiveOrders(previousPeriodStart, previousPeriodEnd)
    ]);

    // Calculate growth percentages
    const revenueGrowth = this.calculateGrowth(currentRevenue, previousRevenue);
    const customersGrowth = this.calculateGrowth(currentCustomers, previousCustomers);
    const ordersGrowth = this.calculateGrowth(currentOrders, previousOrders);

    // Get total customer count
    const { count: totalCustomers } = await supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_role', 'user');

    return {
      totalRevenue: currentRevenue,
      revenueGrowth,
      totalCustomers: totalCustomers || 0,
      customersGrowth,
      totalProducts,
      newProducts,
      activeOrders: currentOrders,
      ordersGrowth
    };
  }

  /**
   * Calculate total revenue for a period
   */
  private async calculateRevenue(startDate: Date, endDate?: Date): Promise<number> {
    let query = supabase
      .from('payments')
      .select('amount')
      .eq('payment_status', 'completed')
      .gte('created_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data, error } = await query;

    if (error) {
      logger.error('Failed to calculate revenue', { error });
      return 0;
    }

    return data?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;
  }

  /**
   * Count new customers in a period
   */
  private async countNewCustomers(startDate: Date, endDate?: Date): Promise<number> {
    let query = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('user_role', 'user')
      .gte('created_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { count } = await query;
    return count || 0;
  }

  /**
   * Count total products
   */
  private async countTotalProducts(): Promise<number> {
    const { count } = await supabase
      .from('shop_services')
      .select('*', { count: 'exact', head: true })
      .eq('is_available', true);

    return count || 0;
  }

  /**
   * Count new products in a period
   */
  private async countNewProducts(startDate: Date): Promise<number> {
    const { count } = await supabase
      .from('shop_services')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startDate.toISOString())
      .eq('is_available', true);

    return count || 0;
  }

  /**
   * Count active orders in a period
   */
  private async countActiveOrders(startDate: Date, endDate?: Date): Promise<number> {
    let query = supabase
      .from('reservations')
      .select('*', { count: 'exact', head: true })
      .in('status', ['requested', 'confirmed'])
      .gte('created_at', startDate.toISOString());

    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { count } = await query;
    return count || 0;
  }

  /**
   * Get recent orders
   */
  private async getRecentOrders(limit: number = 10): Promise<RecentOrder[]> {
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        total_amount,
        status,
        created_at,
        user_id
      `)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error || !reservations) {
      logger.error('Failed to get recent orders', { error });
      return [];
    }

    // Get user details for each reservation
    const userIds = reservations.map(r => r.user_id);
    const { data: users } = await supabase
      .from('users')
      .select('id, name, email')
      .in('id', userIds);

    const userMap = new Map(users?.map(u => [u.id, u]) || []);

    // Map reservation status to order status
    const statusMap: Record<string, RecentOrder['status']> = {
      'requested': 'pending',
      'confirmed': 'processing',
      'completed': 'delivered',
      'cancelled_by_user': 'cancelled',
      'cancelled_by_shop': 'cancelled',
      'no_show': 'cancelled'
    };

    return reservations.map(reservation => {
      const user = userMap.get(reservation.user_id);
      return {
        id: `ORD-${reservation.id.slice(0, 8).toUpperCase()}`,
        customer: user?.name || '알 수 없음',
        customerEmail: user?.email || '',
        status: statusMap[reservation.status] || 'pending',
        amount: reservation.total_amount,
        createdAt: reservation.created_at
      };
    });
  }

  /**
   * Get top selling products
   */
  private async getTopProducts(days: number, limit: number = 5): Promise<TopProduct[]> {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Get completed reservations with their services
    const { data: reservations, error } = await supabase
      .from('reservations')
      .select(`
        id,
        total_amount,
        created_at
      `)
      .eq('status', 'completed')
      .gte('created_at', startDate.toISOString());

    if (error || !reservations || reservations.length === 0) {
      logger.error('Failed to get completed reservations', { error });
      return [];
    }

    // Get reservation services
    const reservationIds = reservations.map(r => r.id);
    const { data: reservationServices } = await supabase
      .from('reservation_services')
      .select(`
        service_id,
        quantity,
        total_price
      `)
      .in('reservation_id', reservationIds);

    if (!reservationServices || reservationServices.length === 0) {
      return [];
    }

    // Aggregate by service
    const serviceStats = new Map<string, { sales: number; revenue: number }>();

    reservationServices.forEach(rs => {
      const current = serviceStats.get(rs.service_id) || { sales: 0, revenue: 0 };
      serviceStats.set(rs.service_id, {
        sales: current.sales + rs.quantity,
        revenue: current.revenue + rs.total_price
      });
    });

    // Get service details
    const serviceIds = Array.from(serviceStats.keys());
    const { data: services } = await supabase
      .from('shop_services')
      .select('id, name')
      .in('id', serviceIds);

    if (!services) {
      return [];
    }

    // Combine data and sort by revenue
    const topProducts = services
      .map(service => {
        const stats = serviceStats.get(service.id)!;
        return {
          id: `PROD-${service.id.slice(0, 8).toUpperCase()}`,
          name: service.name,
          sales: stats.sales,
          revenue: stats.revenue
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, limit);

    return topProducts;
  }

  /**
   * Calculate growth percentage
   */
  private calculateGrowth(current: number, previous: number): number {
    if (previous === 0) {
      return current > 0 ? 100 : 0;
    }
    return Number((((current - previous) / previous) * 100).toFixed(1));
  }

  /**
   * Parse period string to number of days
   */
  private parsePeriodToDays(period: Period): number {
    const periodMap: Record<Period, number> = {
      '7d': 7,
      '30d': 30,
      '90d': 90
    };
    return periodMap[period];
  }
}

export const dashboardService = new DashboardService();
