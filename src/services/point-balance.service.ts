import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { PointTransactionType, PointStatus } from '../types/database.types';

export interface PointBalance {
  available: number;
  pending: number;
  total: number;
  expired: number;
  used: number;
  projectedAvailable: number; // Points that will become available in the future
}

export interface PointHistoryFilters {
  startDate?: string;
  endDate?: string;
  transactionType?: PointTransactionType;
  status?: PointStatus;
  page?: number;
  limit?: number;
}

export interface PointHistoryResponse {
  transactions: Array<{
    id: string;
    amount: number;
    transactionType: PointTransactionType;
    status: PointStatus;
    description: string;
    availableFrom?: string;
    expiresAt?: string;
    createdAt: string;
    metadata?: Record<string, any>;
  }>;
  totalCount: number;
  hasMore: boolean;
  currentPage: number;
  totalPages: number;
}

export interface PointAnalytics {
  totalEarned: number;
  totalSpent: number;
  totalExpired: number;
  averageEarningPerMonth: number;
  averageSpendingPerMonth: number;
  mostCommonTransactionType: PointTransactionType;
  pointsExpiringSoon: number; // Points expiring in next 30 days
  pointsExpiringThisMonth: number;
}

export interface PointProjection {
  currentAvailable: number;
  projectedAvailable: number;
  projectedByDate: Array<{
    date: string;
    available: number;
    expiring: number;
  }>;
  nextExpirationDate?: string;
  nextExpirationAmount: number;
}

export class PointBalanceService {
  private supabase = getSupabaseClient();

  /**
   * Get comprehensive point balance for a user
   */
  async getPointBalance(userId: string): Promise<PointBalance> {
    try {
      logger.info('Getting point balance for user', { userId });

      // Get all point transactions for the user
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId);

      if (error) {
        throw new Error(`Failed to get point transactions: ${error.message}`);
      }

      const now = new Date();
      let available = 0;
      let pending = 0;
      let expired = 0;
      let used = 0;
      let projectedAvailable = 0;

      (transactions || []).forEach(transaction => {
        const amount = transaction.amount || 0;
        const availableFrom = transaction.available_from ? new Date(transaction.available_from) : null;
        const expiresAt = transaction.expires_at ? new Date(transaction.expires_at) : null;

        switch (transaction.status) {
          case 'available':
            if (expiresAt && expiresAt < now) {
              expired += amount;
            } else {
              available += amount;
            }
            break;
          case 'pending':
            pending += amount;
            if (availableFrom && availableFrom > now) {
              projectedAvailable += amount;
            }
            break;
          case 'used':
            used += amount;
            break;
          case 'expired':
            expired += amount;
            break;
        }
      });

      const total = available + pending + used + expired;

      const balance: PointBalance = {
        available,
        pending,
        total,
        expired,
        used,
        projectedAvailable
      };

      logger.info('Point balance calculated', { userId, balance });

      return balance;
    } catch (error) {
      logger.error('Error getting point balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get point transaction history with filtering and pagination
   */
  async getPointHistory(userId: string, filters: PointHistoryFilters = {}): Promise<PointHistoryResponse> {
    try {
      logger.info('Getting point history for user', { userId, filters });

      const {
        startDate,
        endDate,
        transactionType,
        status,
        page = 1,
        limit = 20
      } = filters;

      const offset = (page - 1) * limit;

      // Build query
      let query = this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      if (transactionType) {
        query = query.eq('transaction_type', transactionType);
      }

      if (status) {
        query = query.eq('status', status);
      }

      // Get total count first
      const { count, error: countError } = await query;

      if (countError) {
        throw new Error(`Failed to get transaction count: ${countError.message}`);
      }

      // Get paginated results
      const { data: transactions, error } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get point transactions: ${error.message}`);
      }

      const formattedTransactions = (transactions || []).map(t => ({
        id: t.id,
        amount: t.amount,
        transactionType: t.transaction_type,
        status: t.status,
        description: t.description,
        availableFrom: t.available_from,
        expiresAt: t.expires_at,
        createdAt: t.created_at,
        metadata: t.metadata
      }));

      const totalPages = Math.ceil((count || 0) / limit);
      const hasMore = page < totalPages;

      const response: PointHistoryResponse = {
        transactions: formattedTransactions,
        totalCount: count || 0,
        hasMore,
        currentPage: page,
        totalPages
      };

      logger.info('Point history retrieved', { 
        userId, 
        totalCount: response.totalCount,
        currentPage: response.currentPage 
      });

      return response;
    } catch (error) {
      logger.error('Error getting point history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        filters
      });
      throw error;
    }
  }

  /**
   * Get point analytics and insights
   */
  async getPointAnalytics(userId: string, months: number = 12): Promise<PointAnalytics> {
    try {
      logger.info('Getting point analytics for user', { userId, months });

      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get transactions for the specified period
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', startDate.toISOString())
        .order('created_at', { ascending: false });

      if (error) {
        throw new Error(`Failed to get transactions for analytics: ${error.message}`);
      }

      let totalEarned = 0;
      let totalSpent = 0;
      let totalExpired = 0;
      const transactionTypeCounts: Record<PointTransactionType, number> = {} as any;
      const now = new Date();
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      const endOfMonth = new Date();
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      endOfMonth.setDate(0); // Last day of current month

      let pointsExpiringSoon = 0;
      let pointsExpiringThisMonth = 0;

      (transactions || []).forEach(transaction => {
        const amount = transaction.amount || 0;
        const expiresAt = transaction.expires_at ? new Date(transaction.expires_at) : null;

        // Count transaction types
        const type = transaction.transaction_type;
        transactionTypeCounts[type] = (transactionTypeCounts[type] || 0) + 1;

        // Calculate totals by type
        if (type === 'earned_service' || type === 'bonus' || type === 'referral') {
          totalEarned += amount;
        } else if (type === 'used_service') {
          totalSpent += amount;
        }

        // Check for expired points
        if (transaction.status === 'expired' || (expiresAt && expiresAt < now)) {
          totalExpired += amount;
        }

        // Check for points expiring soon
        if (expiresAt && expiresAt > now && expiresAt <= thirtyDaysFromNow) {
          pointsExpiringSoon += amount;
        }

        if (expiresAt && expiresAt > now && expiresAt <= endOfMonth) {
          pointsExpiringThisMonth += amount;
        }
      });

      // Calculate averages
      const averageEarningPerMonth = totalEarned / months;
      const averageSpendingPerMonth = totalSpent / months;

      // Find most common transaction type
      const mostCommonTransactionType = Object.entries(transactionTypeCounts)
        .reduce((a, b) => {
          const aCount = transactionTypeCounts[a[0] as PointTransactionType] || 0;
          const bCount = transactionTypeCounts[b[0] as PointTransactionType] || 0;
          return aCount > bCount ? a : b;
        })[0] as PointTransactionType;

      const analytics: PointAnalytics = {
        totalEarned,
        totalSpent,
        totalExpired,
        averageEarningPerMonth,
        averageSpendingPerMonth,
        mostCommonTransactionType,
        pointsExpiringSoon,
        pointsExpiringThisMonth
      };

      logger.info('Point analytics calculated', { userId, analytics });

      return analytics;
    } catch (error) {
      logger.error('Error getting point analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get point projection showing future available points
   */
  async getPointProjection(userId: string, days: number = 90): Promise<PointProjection> {
    try {
      logger.info('Getting point projection for user', { userId, days });

      // Get current balance
      const currentBalance = await this.getPointBalance(userId);

      // Get pending transactions that will become available
      const { data: pendingTransactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'pending')
        .not('available_from', 'is', null)
        .order('available_from', { ascending: true });

      if (error) {
        throw new Error(`Failed to get pending transactions: ${error.message}`);
      }

      const now = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + days);

      let projectedAvailable = currentBalance.available;
      const projectedByDate: Array<{ date: string; available: number; expiring: number }> = [];
      let nextExpirationDate: string | undefined;
      let nextExpirationAmount = 0;

      // Group pending transactions by available date
      const pendingByDate = new Map<string, number>();
      (pendingTransactions || []).forEach(transaction => {
        if (transaction.available_from) {
          const date = new Date(transaction.available_from);
          if (date <= endDate) {
            const dateKey = date.toISOString().split('T')[0];
            pendingByDate.set(dateKey, (pendingByDate.get(dateKey) || 0) + (transaction.amount || 0));
          }
        }
      });

      // Get expiring transactions
      const { data: expiringTransactions, error: expiringError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'available')
        .not('expires_at', 'is', null)
        .gte('expires_at', now.toISOString())
        .lte('expires_at', endDate.toISOString())
        .order('expires_at', { ascending: true });

      if (expiringError) {
        throw new Error(`Failed to get expiring transactions: ${expiringError.message}`);
      }

      // Group expiring transactions by date
      const expiringByDate = new Map<string, number>();
      (expiringTransactions || []).forEach(transaction => {
        if (transaction.expires_at) {
          const dateKey = new Date(transaction.expires_at).toISOString().split('T')[0];
          expiringByDate.set(dateKey, (expiringByDate.get(dateKey) || 0) + (transaction.amount || 0));
        }
      });

      // Find next expiration
      if (expiringTransactions && expiringTransactions.length > 0) {
        const nextExpiring = expiringTransactions[0];
        if (nextExpiring.expires_at) {
          nextExpirationDate = nextExpiring.expires_at;
        }
        nextExpirationAmount = nextExpiring.amount || 0;
      }

      // Calculate projection for each day
      const currentDate = new Date(now);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const becomingAvailable = pendingByDate.get(dateKey) || 0;
        const expiring = expiringByDate.get(dateKey) || 0;

        projectedAvailable += becomingAvailable - expiring;

        projectedByDate.push({
          date: dateKey,
          available: projectedAvailable,
          expiring
        });

        currentDate.setDate(currentDate.getDate() + 1);
      }

      const projection: PointProjection = {
        currentAvailable: currentBalance.available,
        projectedAvailable,
        projectedByDate,
        nextExpirationDate,
        nextExpirationAmount
      };

      logger.info('Point projection calculated', { userId, projection });

      return projection;
    } catch (error) {
      logger.error('Error getting point projection', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get point summary for dashboard
   */
  async getPointSummary(userId: string): Promise<{
    balance: PointBalance;
    analytics: PointAnalytics;
    projection: PointProjection;
  }> {
    try {
      logger.info('Getting comprehensive point summary for user', { userId });

      const [balance, analytics, projection] = await Promise.all([
        this.getPointBalance(userId),
        this.getPointAnalytics(userId),
        this.getPointProjection(userId)
      ]);

      const summary = {
        balance,
        analytics,
        projection
      };

      logger.info('Point summary retrieved', { userId });

      return summary;
    } catch (error) {
      logger.error('Error getting point summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }
}

export const pointBalanceService = new PointBalanceService(); 