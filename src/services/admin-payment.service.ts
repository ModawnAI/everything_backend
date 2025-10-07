import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { PaymentStatus, PaymentMethod } from '../types/database.types';

export interface PaymentFilters {
  status?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  shopId?: string;
  userId?: string;
  startDate?: string;
  endDate?: string;
  minAmount?: number;
  maxAmount?: number;
  isDeposit?: boolean;
  hasRefund?: boolean;
  sortBy?: 'paid_at' | 'created_at' | 'amount' | 'customer_name' | 'shop_name';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export interface PaymentListResponse {
  payments: Array<{
    id: string;
    reservationId: string;
    userId: string;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    amount: number;
    currency: string;
    paymentProvider?: string;
    providerTransactionId?: string;
    isDeposit: boolean;
    paidAt?: string;
    refundedAt?: string;
    refundAmount: number;
    failureReason?: string;
    createdAt: string;
    updatedAt: string;
    // Customer information
    customer: {
      id: string;
      name: string;
      email?: string;
      phoneNumber?: string;
    };
    // Shop information
    shop: {
      id: string;
      name: string;
      mainCategory: string;
      shopStatus: string;
    };
    // Reservation information
    reservation: {
      id: string;
      reservationDate: string;
      reservationTime: string;
      status: string;
      totalAmount: number;
    };
    // Computed fields
    netAmount: number;
    refundPercentage: number;
    isRefundable: boolean;
    daysSincePayment: number;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
  filters: PaymentFilters;
}

export interface PaymentSummary {
  totalPayments: number;
  totalAmount: number;
  totalRefunds: number;
  netRevenue: number;
  averagePaymentAmount: number;
  paymentsByStatus: Record<PaymentStatus, number>;
  paymentsByMethod: Record<PaymentMethod, number>;
  paymentsByShop: Array<{
    shopId: string;
    shopName: string;
    count: number;
    amount: number;
    refunds: number;
    netAmount: number;
  }>;
  dailyPayments: Array<{
    date: string;
    count: number;
    amount: number;
    refunds: number;
    netAmount: number;
  }>;
  recentActivity: Array<{
    id: string;
    action: string;
    paymentId: string;
    customerName: string;
    shopName: string;
    amount: number;
    timestamp: string;
  }>;
}

export interface SettlementReport {
  settlements: Array<{
    shopId: string;
    shopName: string;
    shopType: string;
    commissionRate: number;
    completedReservations: number;
    grossRevenue: number;
    commissionAmount: number;
    netPayout: number;
    lastSettlementDate?: string;
    nextSettlementDate: string;
    isEligibleForSettlement: boolean;
  }>;
  summary: {
    totalShops: number;
    totalGrossRevenue: number;
    totalCommissionAmount: number;
    totalNetPayout: number;
    averageCommissionRate: number;
  };
  dateRange: {
    startDate: string;
    endDate: string;
  };
}

export interface RefundRequest {
  paymentId: string;
  refundAmount: number;
  reason: string;
  refundMethod: 'original' | 'points';
  notes?: string;
  notifyCustomer?: boolean;
}

export interface RefundResult {
  success: boolean;
  refund: {
    id: string;
    paymentId: string;
    refundAmount: number;
    reason: string;
    refundMethod: string;
    status: 'pending' | 'processed' | 'failed';
    processedAt?: string;
  };
  payment: {
    previousStatus: PaymentStatus;
    newStatus: PaymentStatus;
    updatedAt: string;
  };
}

export interface PaymentAnalytics {
  totalTransactions: number;
  successfulTransactions: number;
  failedTransactions: number;
  totalRevenue: number;
  totalRefunds: number;
  netRevenue: number;
  averageTransactionValue: number;
  conversionRate: number;
  refundRate: number;
  transactionsByMethod: Record<PaymentMethod, {
    count: number;
    amount: number;
    successRate: number;
  }>;
  transactionsByStatus: Record<PaymentStatus, {
    count: number;
    amount: number;
  }>;
  revenueTrends: {
    daily: Array<{ date: string; revenue: number; transactions: number }>;
    weekly: Array<{ week: string; revenue: number; transactions: number }>;
    monthly: Array<{ month: string; revenue: number; transactions: number }>;
  };
  topPerformingShops: Array<{
    shopId: string;
    shopName: string;
    revenue: number;
    transactions: number;
    averageOrderValue: number;
  }>;
}

export class AdminPaymentService {
  private supabase = getSupabaseClient();

  /**
   * Get payments with comprehensive filtering and admin oversight
   */
  async getPayments(filters: PaymentFilters = {}, adminId: string): Promise<PaymentListResponse> {
    try {
      logger.info('Admin payment search', { adminId, filters });

      const {
        status,
        paymentMethod,
        shopId,
        userId,
        startDate,
        endDate,
        minAmount,
        maxAmount,
        isDeposit,
        hasRefund,
        sortBy = 'paid_at',
        sortOrder = 'desc',
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // Build base query with all related information
      let query = this.supabase
        .from('payments')
        .select(`
          *,
          customer:users!payments_user_id_fkey(
            id,
            name,
            email,
            phone_number
          ),
          reservation:reservations!payments_reservation_id_fkey(
            id,
            reservation_date,
            reservation_time,
            status,
            total_amount,
            shop:shops(
              id,
              name,
              main_category,
              shop_status
            )
          )
        `, { count: 'exact' });

      // Apply status filter
      if (status) {
        query = query.eq('payment_status', status);
      }

      // Apply payment method filter
      if (paymentMethod) {
        query = query.eq('payment_method', paymentMethod);
      }

      // Apply shop filter
      if (shopId) {
        query = query.eq('reservation.shop_id', shopId);
      }

      // Apply user filter
      if (userId) {
        query = query.eq('user_id', userId);
      }

      // Apply date range filters
      if (startDate) {
        query = query.gte('paid_at', startDate);
      }

      if (endDate) {
        query = query.lte('paid_at', endDate);
      }

      // Apply amount filters
      if (minAmount !== undefined) {
        query = query.gte('amount', minAmount);
      }

      if (maxAmount !== undefined) {
        query = query.lte('amount', maxAmount);
      }

      // Apply deposit filter
      if (isDeposit !== undefined) {
        query = query.eq('is_deposit', isDeposit);
      }

      // Apply refund filter
      if (hasRefund !== undefined) {
        if (hasRefund) {
          query = query.gt('refund_amount', 0);
        } else {
          query = query.eq('refund_amount', 0);
        }
      }

      // Get total count first
      const { count, error: countError } = await query;

      if (countError) {
        throw new Error(`Failed to get payment count: ${countError.message}`);
      }

      // Apply sorting and pagination
      const { data: payments, error } = await query
        .order(sortBy, { ascending: sortOrder === 'asc' })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get payments: ${error.message}`);
      }

      // Process and enrich payment data
      const enrichedPayments = (payments || []).map(payment => {
        const now = new Date();
        const paidDate = payment.paid_at ? new Date(payment.paid_at) : null;
        const daysSincePayment = paidDate ? Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24)) : 0;

        const netAmount = payment.amount - payment.refund_amount;
        const refundPercentage = payment.amount > 0 ? (payment.refund_amount / payment.amount) * 100 : 0;
        const isRefundable = payment.payment_status === 'fully_paid' && payment.refund_amount < payment.amount;

        return {
          id: payment.id,
          reservationId: payment.reservation_id,
          userId: payment.user_id,
          paymentMethod: payment.payment_method,
          paymentStatus: payment.payment_status,
          amount: payment.amount,
          currency: payment.currency,
          paymentProvider: payment.payment_provider,
          providerTransactionId: payment.provider_transaction_id,
          isDeposit: payment.is_deposit,
          paidAt: payment.paid_at,
          refundedAt: payment.refunded_at,
          refundAmount: payment.refund_amount,
          failureReason: payment.failure_reason,
          createdAt: payment.created_at,
          updatedAt: payment.updated_at,
          // Customer information
          customer: payment.customer ? {
            id: payment.customer.id,
            name: payment.customer.name,
            email: payment.customer.email,
            phoneNumber: payment.customer.phone_number
          } : undefined,
          // Shop information (nested under reservation)
          shop: payment.reservation?.shop ? {
            id: payment.reservation.shop.id,
            name: payment.reservation.shop.name,
            mainCategory: payment.reservation.shop.main_category,
            shopStatus: payment.reservation.shop.shop_status
          } : undefined,
          // Reservation information
          reservation: payment.reservation ? {
            id: payment.reservation.id,
            reservationDate: payment.reservation.reservation_date,
            reservationTime: payment.reservation.reservation_time,
            status: payment.reservation.status,
            totalAmount: payment.reservation.total_amount
          } : undefined,
          // Computed fields
          netAmount,
          refundPercentage,
          isRefundable,
          daysSincePayment
        };
      });

      const totalPages = Math.ceil((count || 0) / limit);
      const hasMore = page < totalPages;

      const response: PaymentListResponse = {
        payments: enrichedPayments,
        totalCount: count || 0,
        hasMore,
        currentPage: page,
        totalPages,
        filters
      };

      // Log admin action
      await this.logAdminAction(adminId, 'payment_search', {
        filters,
        resultCount: enrichedPayments.length,
        totalCount: count || 0
      });

      logger.info('Admin payment search completed', { 
        adminId, 
        resultCount: enrichedPayments.length,
        totalCount: count || 0 
      });

      return response;
    } catch (error) {
      logger.error('Admin payment search failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get payment summary for admin dashboard
   */
  async getPaymentSummary(adminId: string, dateRange?: { startDate: string; endDate: string }): Promise<PaymentSummary> {
    try {
      logger.info('Getting payment summary', { adminId, dateRange });

      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

      // Get basic counts and amounts
      const { count: totalPayments } = await this.supabase
        .from('payments')
        .select('*', { count: 'exact' })
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const { data: paymentData } = await this.supabase
        .from('payments')
        .select('amount, refund_amount, payment_status, payment_method, paid_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalAmount = (paymentData || []).reduce((sum, payment) => sum + payment.amount, 0);
      const totalRefunds = (paymentData || []).reduce((sum, payment) => sum + payment.refund_amount, 0);
      const netRevenue = totalAmount - totalRefunds;
      const averagePaymentAmount = totalPayments ? totalAmount / totalPayments : 0;

      // Get payments by status
      const paymentsByStatus = (paymentData || []).reduce((acc, payment) => {
        acc[payment.payment_status] = (acc[payment.payment_status] || 0) + 1;
        return acc;
      }, {} as Record<PaymentStatus, number>);

      // Get payments by method
      const paymentsByMethod = (paymentData || []).reduce((acc, payment) => {
        acc[payment.payment_method] = (acc[payment.payment_method] || 0) + 1;
        return acc;
      }, {} as Record<PaymentMethod, number>);

      // Get payments by shop
      const { data: shopData } = await this.supabase
        .from('payments')
        .select(`
          amount,
          refund_amount,
          shop:shops!reservations_shop_id_fkey(
            id,
            name
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const shopStats = (shopData || []).reduce((acc, payment) => {
        const shopId = (payment.shop as any)?.id || 'unknown';
        if (!acc[shopId]) {
          acc[shopId] = { count: 0, amount: 0, refunds: 0, name: (payment.shop as any)?.name || 'Unknown' };
        }
        acc[shopId].count += 1;
        acc[shopId].amount += payment.amount;
        acc[shopId].refunds += payment.refund_amount;
        return acc;
      }, {} as Record<string, { count: number; amount: number; refunds: number; name: string }>);

      const paymentsByShop = Object.entries(shopStats).map(([shopId, stats]) => {
        const { count, amount, refunds, name } = stats;
        return {
          shopId,
          shopName: name,
          count,
          amount,
          refunds,
          netAmount: amount - refunds
        };
      }).sort((a, b) => b.netAmount - a.netAmount);

      // Get daily payments
      const { data: dailyData } = await this.supabase
        .from('payments')
        .select('paid_at, amount, refund_amount')
        .not('paid_at', 'is', null)
        .gte('paid_at', startDate)
        .lte('paid_at', endDate);

      const dailyPayments = this.aggregateByDate(dailyData || [], 'paid_at').map(item => ({
        ...item,
        refunds: item.refunds || 0,
        netAmount: item.amount - (item.refunds || 0)
      }));

      // Get recent activity
      const { data: recentActivity } = await this.supabase
        .from('admin_actions')
        .select(`
          id,
          action_type,
          target_id,
          created_at,
          metadata
        `)
        .eq('target_type', 'payment')
        .order('created_at', { ascending: false })
        .limit(20);

      const recentActivityList = (recentActivity || []).map(activity => ({
        id: activity.id,
        action: activity.action_type,
        paymentId: activity.target_id,
        customerName: 'Customer', // Would need to join with payment data
        shopName: 'Shop', // Would need to join with payment data
        amount: 0, // Would need to join with payment data
        timestamp: activity.created_at
      }));

      const summary: PaymentSummary = {
        totalPayments: totalPayments || 0,
        totalAmount,
        totalRefunds,
        netRevenue,
        averagePaymentAmount,
        paymentsByStatus,
        paymentsByMethod,
        paymentsByShop,
        dailyPayments,
        recentActivity: recentActivityList
      };

      logger.info('Payment summary retrieved', { adminId });

      return summary;
    } catch (error) {
      logger.error('Failed to get payment summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Get settlement report for partnered shops
   */
  async getSettlementReport(adminId: string, dateRange?: { startDate: string; endDate: string }): Promise<SettlementReport> {
    try {
      logger.info('Getting settlement report', { adminId, dateRange });

      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

      // Get completed reservations for partnered shops
      const { data: settlementData, error } = await this.supabase
        .from('reservations')
        .select(`
          id,
          total_amount,
          completed_at,
          shop:shops!reservations_shop_id_fkey(
            id,
            name,
            shop_type,
            commission_rate
          )
        `)
        .eq('status', 'completed')
        .eq('shop.shop_type', 'partnered')
        .gte('completed_at', startDate)
        .lte('completed_at', endDate)
        .not('completed_at', 'is', null);

      if (error) {
        throw new Error(`Failed to get settlement data: ${error.message}`);
      }

      // Calculate settlements by shop
      const shopSettlements = (settlementData || []).reduce((acc, reservation) => {
        const shopId = (reservation.shop as any)?.id || 'unknown';
        if (!acc[shopId]) {
          acc[shopId] = {
            shopId,
            shopName: (reservation.shop as any)?.name || 'Unknown',
            shopType: (reservation.shop as any)?.shop_type || 'unknown',
            commissionRate: (reservation.shop as any)?.commission_rate || 0,
            completedReservations: 0,
            grossRevenue: 0,
            commissionAmount: 0,
            netPayout: 0
          };
        }
        acc[shopId].completedReservations += 1;
        acc[shopId].grossRevenue += reservation.total_amount;
        acc[shopId].commissionAmount += (reservation.total_amount * ((acc[shopId].commissionRate || 0) / 100));
        acc[shopId].netPayout += (reservation.total_amount * ((100 - (acc[shopId].commissionRate || 0)) / 100));
        return acc;
      }, {} as Record<string, any>);

      // Add settlement dates and eligibility
      const settlements = Object.values(shopSettlements).map((settlement: any) => {
        const nextSettlementDate = new Date();
        nextSettlementDate.setDate(nextSettlementDate.getDate() + 7); // Weekly settlements

        return {
          ...settlement,
          lastSettlementDate: undefined, // Would need to track from settlement history
          nextSettlementDate: nextSettlementDate.toISOString().split('T')[0],
          isEligibleForSettlement: settlement.netPayout >= 10000 // Minimum 10,000 KRW for settlement
        };
      });

      // Calculate summary
      const totalShops = settlements.length;
      const totalGrossRevenue = settlements.reduce((sum, settlement) => sum + settlement.grossRevenue, 0);
      const totalCommissionAmount = settlements.reduce((sum, settlement) => sum + settlement.commissionAmount, 0);
      const totalNetPayout = settlements.reduce((sum, settlement) => sum + settlement.netPayout, 0);
      const averageCommissionRate = totalShops ? settlements.reduce((sum, settlement) => sum + (settlement.commissionRate || 0), 0) / totalShops : 0;

      const report: SettlementReport = {
        settlements,
        summary: {
          totalShops,
          totalGrossRevenue,
          totalCommissionAmount,
          totalNetPayout,
          averageCommissionRate
        },
        dateRange: {
          startDate,
          endDate
        }
      };

      logger.info('Settlement report retrieved', { adminId });

      return report;
    } catch (error) {
      logger.error('Failed to get settlement report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Process refund for payment
   */
  async processRefund(paymentId: string, request: RefundRequest, adminId: string): Promise<RefundResult> {
    try {
      logger.info('Admin processing refund', { adminId, paymentId, request });

      // Get current payment
      const { data: payment, error: paymentError } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (paymentError || !payment) {
        throw new Error('Payment not found');
      }

      // Validate refund amount
      if (request.refundAmount > payment.amount - payment.refund_amount) {
        throw new Error('Refund amount exceeds available amount');
      }

      // Validate payment status
      if (payment.payment_status !== 'fully_paid' && payment.payment_status !== 'partially_refunded') {
        throw new Error('Payment is not eligible for refund');
      }

      const previousStatus = payment.payment_status;
      const newRefundAmount = payment.refund_amount + request.refundAmount;
      const newStatus = newRefundAmount >= payment.amount ? 'refunded' : 'partially_refunded';

      // Update payment
      const { error: updateError } = await this.supabase
        .from('payments')
        .update({
          payment_status: newStatus,
          refund_amount: newRefundAmount,
          refunded_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) {
        throw new Error(`Failed to update payment: ${updateError.message}`);
      }

      // Create refund record (if refunds table exists)
      // This would be implemented if a separate refunds table is created

      // Log admin action
      await this.logAdminAction(adminId, 'refund_processed', {
        paymentId,
        refundAmount: request.refundAmount,
        reason: request.reason,
        refundMethod: request.refundMethod,
        previousStatus,
        newStatus
      });

      const result: RefundResult = {
        success: true,
        refund: {
          id: `refund_${Date.now()}`, // Would be actual refund ID if refunds table exists
          paymentId,
          refundAmount: request.refundAmount,
          reason: request.reason,
          refundMethod: request.refundMethod,
          status: 'processed',
          processedAt: new Date().toISOString()
        },
        payment: {
          previousStatus,
          newStatus,
          updatedAt: new Date().toISOString()
        }
      };

      logger.info('Refund processed successfully', { 
        adminId, 
        paymentId, 
        refundAmount: request.refundAmount 
      });

      return result;
    } catch (error) {
      logger.error('Refund processing failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        paymentId,
        request
      });
      throw error;
    }
  }

  /**
   * Get payment analytics for admin dashboard
   */
  async getPaymentAnalytics(adminId: string, dateRange?: { startDate: string; endDate: string }): Promise<PaymentAnalytics> {
    try {
      logger.info('Getting payment analytics', { adminId, dateRange });

      const startDate = dateRange?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = dateRange?.endDate || new Date().toISOString().split('T')[0];

      // Get all payment data for analytics
      const { data: paymentData } = await this.supabase
        .from('payments')
        .select(`
          amount,
          refund_amount,
          payment_status,
          payment_method,
          paid_at,
          shop:shops!reservations_shop_id_fkey(
            id,
            name
          )
        `)
        .gte('created_at', startDate)
        .lte('created_at', endDate);

      const totalTransactions = paymentData?.length || 0;
      const successfulTransactions = paymentData?.filter(p => p.payment_status === 'fully_paid').length || 0;
      const failedTransactions = paymentData?.filter(p => p.payment_status === 'failed').length || 0;
      const totalRevenue = paymentData?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const totalRefunds = paymentData?.reduce((sum, p) => sum + p.refund_amount, 0) || 0;
      const netRevenue = totalRevenue - totalRefunds;
      const averageTransactionValue = totalTransactions ? totalRevenue / totalTransactions : 0;
      const conversionRate = totalTransactions ? (successfulTransactions / totalTransactions) * 100 : 0;
      const refundRate = totalRevenue ? (totalRefunds / totalRevenue) * 100 : 0;

      // Transactions by method
      const transactionsByMethod = (paymentData || []).reduce((acc, payment) => {
        if (!acc[payment.payment_method]) {
          acc[payment.payment_method] = { count: 0, amount: 0, successCount: 0, successRate: 0 };
        }
        acc[payment.payment_method].count += 1;
        acc[payment.payment_method].amount += payment.amount;
        if (payment.payment_status === 'fully_paid') {
          acc[payment.payment_method].successCount += 1;
        }
        acc[payment.payment_method].successRate = acc[payment.payment_method].count ? (acc[payment.payment_method].successCount / acc[payment.payment_method].count) * 100 : 0;
        return acc;
      }, {} as Record<PaymentMethod, { count: number; amount: number; successCount: number; successRate: number }>);

      // Transactions by status
      const transactionsByStatus = (paymentData || []).reduce((acc, payment) => {
        if (!acc[payment.payment_status]) {
          acc[payment.payment_status] = { count: 0, amount: 0 };
        }
        acc[payment.payment_status].count += 1;
        acc[payment.payment_status].amount += payment.amount;
        return acc;
      }, {} as Record<PaymentStatus, { count: number; amount: number }>);

      // Revenue trends
      const revenueTrends = {
        daily: this.aggregateByDate(paymentData || [], 'paid_at').map(item => ({
          date: item.date,
          revenue: item.amount,
          transactions: item.count
        })),
        weekly: [], // Would need more complex aggregation
        monthly: [] // Would need more complex aggregation
      };

      // Top performing shops
      const shopPerformance = (paymentData || []).reduce((acc, payment) => {
        const shopId = (payment.shop as any)?.id || 'unknown';
        if (!acc[shopId]) {
          acc[shopId] = {
            shopId,
            shopName: (payment.shop as any)?.name || 'Unknown',
            revenue: 0,
            transactions: 0
          };
        }
        acc[shopId].revenue += payment.amount;
        acc[shopId].transactions += 1;
        return acc;
      }, {} as Record<string, any>);

      const topPerformingShops = Object.values(shopPerformance)
        .map((shop: any) => ({
          ...shop,
          averageOrderValue: shop.transactions ? shop.revenue / shop.transactions : 0
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const analytics: PaymentAnalytics = {
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        totalRevenue,
        totalRefunds,
        netRevenue,
        averageTransactionValue,
        conversionRate,
        refundRate,
        transactionsByMethod,
        transactionsByStatus,
        revenueTrends,
        topPerformingShops
      };

      logger.info('Payment analytics retrieved', { adminId });

      return analytics;
    } catch (error) {
      logger.error('Failed to get payment analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Aggregate data by date
   */
  private aggregateByDate(data: any[], dateField: string): Array<{ date: string; count: number; amount: number; refunds?: number; netAmount?: number }> {
    const aggregated = data.reduce((acc, item) => {
      const date = item[dateField]?.split('T')[0];
      if (!date) return acc;
      
      if (!acc[date]) {
        acc[date] = { count: 0, amount: 0, refunds: 0 };
      }
      acc[date].count += 1;
      acc[date].amount += item.amount || 0;
      acc[date].refunds += item.refund_amount || 0;
      return acc;
    }, {} as Record<string, { count: number; amount: number; refunds: number }>);

    return Object.entries(aggregated).map(([date, stats]) => ({
      date,
      count: (stats as any).count,
      amount: (stats as any).amount,
      refunds: (stats as any).refunds,
      netAmount: (stats as any).amount - (stats as any).refunds
    })).sort((a, b) => a.date.localeCompare(b.date));
  }

  /**
   * Log admin action
   */
  private async logAdminAction(adminId: string, action: string, metadata: any): Promise<void> {
    try {
      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          target_type: 'payment',
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
  }
}

export const adminPaymentService = new AdminPaymentService(); 