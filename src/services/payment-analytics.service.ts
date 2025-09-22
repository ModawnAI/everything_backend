import { createClient } from '@supabase/supabase-js';
import { pointService } from './point.service';
import { referralService } from './referral.service';
import { paymentService } from './payment.service';
import { fifoPointUsageService } from './fifo-point-usage.service';

// Initialize Supabase client in constructor to avoid import issues
let supabase: any;

export interface PointEarningPattern {
  userId: string;
  totalEarned: number;
  referralEarnings: number;
  paymentEarnings: number;
  influencerEarnings: number;
  earningPeriod: string;
  averageEarningPerTransaction: number;
  earningFrequency: number;
}

export interface FIFOUsageEfficiency {
  userId: string;
  totalPointsUsed: number;
  pointsUsedViaFIFO: number;
  fifoEfficiencyRate: number;
  averageUsagePerTransaction: number;
  usageFrequency: number;
  pointsExpired: number;
  expirationRate: number;
}

export interface PointConversionMetrics {
  userId: string;
  totalPointsEarned: number;
  totalPointsUsed: number;
  conversionRate: number;
  pointsToPaymentRatio: number;
  averagePointsPerPayment: number;
  paymentValueFromPoints: number;
  remainingPoints: number;
}

export interface PointBehaviorSegment {
  segment: 'high_earner' | 'high_spender' | 'balanced' | 'inactive' | 'new_user';
  userId: string;
  totalEarned: number;
  totalUsed: number;
  activityScore: number;
  lastActivity: string;
  characteristics: string[];
}

export interface PointLifetimeValue {
  userId: string;
  totalLifetimeEarnings: number;
  totalLifetimeUsage: number;
  netPointValue: number;
  averageMonthlyEarnings: number;
  averageMonthlyUsage: number;
  pointRetentionRate: number;
  predictedFutureValue: number;
}

export interface PointAnalyticsSummary {
  totalUsers: number;
  totalPointsEarned: number;
  totalPointsUsed: number;
  averageConversionRate: number;
  fifoEfficiencyRate: number;
  topEarningSources: Array<{
    source: string;
    totalEarnings: number;
    percentage: number;
  }>;
  userSegments: Array<{
    segment: string;
    count: number;
    percentage: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    earnings: number;
    usage: number;
    netGrowth: number;
  }>;
}

export class PaymentAnalyticsService {
  private supabase: any;
  private logger = {
    info: (message: string, data?: any) => console.log(`[PaymentAnalytics] ${message}`, data),
    warn: (message: string, data?: any) => console.warn(`[PaymentAnalytics] ${message}`, data),
    error: (message: string, data?: any) => console.error(`[PaymentAnalytics] ${message}`, data)
  };

  constructor() {
    // Initialize Supabase client
    try {
      if (typeof window === 'undefined') {
        // Server-side
        const { config } = require('../config/database');
        this.supabase = createClient(config.url, config.anonKey);
      } else {
        // Client-side (for testing)
        this.supabase = supabase || createClient('mock-url', 'mock-key');
      }
    } catch (error) {
      // Fallback for testing or when config is not available
      this.supabase = createClient('mock-url', 'mock-key');
    }
  }

  /**
   * Analyze point earning patterns from referrals and payments
   */
  async analyzePointEarningPatterns(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PointEarningPattern[]> {
    try {
      let query = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          source,
          created_at
        `)
        .eq('transaction_type', 'earned');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch point transactions: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Group by user and calculate patterns
      const userPatterns = new Map<string, PointEarningPattern>();

      for (const transaction of transactions) {
        const userId = transaction.user_id;
        
        if (!userPatterns.has(userId)) {
          userPatterns.set(userId, {
            userId,
            totalEarned: 0,
            referralEarnings: 0,
            paymentEarnings: 0,
            influencerEarnings: 0,
            earningPeriod: `${startDate || 'all'} to ${endDate || 'now'}`,
            averageEarningPerTransaction: 0,
            earningFrequency: 0
          });
        }

        const pattern = userPatterns.get(userId)!;
        pattern.totalEarned += transaction.amount;

        // Categorize earnings by source
        switch (transaction.source) {
          case 'referral':
            pattern.referralEarnings += transaction.amount;
            break;
          case 'payment':
            pattern.paymentEarnings += transaction.amount;
            break;
          case 'influencer':
            pattern.influencerEarnings += transaction.amount;
            break;
        }
      }

      // Calculate averages and frequencies
      for (const [userId, pattern] of userPatterns) {
        const userTransactions = transactions.filter(t => t.user_id === userId);
        pattern.averageEarningPerTransaction = pattern.totalEarned / userTransactions.length;
        pattern.earningFrequency = userTransactions.length;
      }

      return Array.from(userPatterns.values());
    } catch (error) {
      this.logger.error('Failed to analyze point earning patterns', { error, userId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Track FIFO point usage efficiency and consumption patterns
   */
  async trackFIFOUsageEfficiency(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<FIFOUsageEfficiency[]> {
    try {
      // Get point usage transactions
      let query = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          created_at,
          metadata
        `)
        .eq('transaction_type', 'used');

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: usageTransactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch usage transactions: ${error.message}`);
      }

      if (!usageTransactions || usageTransactions.length === 0) {
        return [];
      }

      // Get FIFO usage data
      const { data: fifoUsages, error: fifoError } = await this.supabase
        .from('fifo_point_usage')
        .select('*');

      if (fifoError) {
        this.logger.warn('Failed to fetch FIFO usage data', { error: fifoError.message });
      }

      // Group by user and calculate efficiency
      const userEfficiency = new Map<string, FIFOUsageEfficiency>();

      for (const transaction of usageTransactions) {
        const userId = transaction.user_id;
        
        if (!userEfficiency.has(userId)) {
          userEfficiency.set(userId, {
            userId,
            totalPointsUsed: 0,
            pointsUsedViaFIFO: 0,
            fifoEfficiencyRate: 0,
            averageUsagePerTransaction: 0,
            usageFrequency: 0,
            pointsExpired: 0,
            expirationRate: 0
          });
        }

        const efficiency = userEfficiency.get(userId)!;
        efficiency.totalPointsUsed += Math.abs(transaction.amount);

        // Check if this transaction used FIFO
        const fifoUsage = fifoUsages?.find(f => 
          f.user_id === userId && 
          f.used_at === transaction.created_at
        );
        
        if (fifoUsage) {
          efficiency.pointsUsedViaFIFO += Math.abs(transaction.amount);
        }
      }

      // Calculate efficiency rates and other metrics
      for (const [userId, efficiency] of userEfficiency) {
        const userTransactions = usageTransactions.filter(t => t.user_id === userId);
        efficiency.fifoEfficiencyRate = efficiency.totalPointsUsed > 0 
          ? (efficiency.pointsUsedViaFIFO / efficiency.totalPointsUsed) * 100 
          : 0;
        efficiency.averageUsagePerTransaction = efficiency.totalPointsUsed / userTransactions.length;
        efficiency.usageFrequency = userTransactions.length;

        // Calculate expiration rate (simplified - would need more complex logic in real implementation)
        efficiency.pointsExpired = 0; // Placeholder
        efficiency.expirationRate = 0; // Placeholder
      }

      return Array.from(userEfficiency.values());
    } catch (error) {
      this.logger.error('Failed to track FIFO usage efficiency', { error, userId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Calculate point-to-payment conversion rates
   */
  async calculatePointConversionMetrics(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<PointConversionMetrics[]> {
    try {
      // Get point transactions
      let pointQuery = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          created_at
        `);

      if (userId) {
        pointQuery = pointQuery.eq('user_id', userId);
      }

      if (startDate) {
        pointQuery = pointQuery.gte('created_at', startDate);
      }

      if (endDate) {
        pointQuery = pointQuery.lte('created_at', endDate);
      }

      const { data: pointTransactions, error: pointError } = await pointQuery;

      if (pointError) {
        throw new Error(`Failed to fetch point transactions: ${pointError.message}`);
      }

      // Get payment transactions
      let paymentQuery = this.supabase
        .from('payments')
        .select(`
          user_id,
          amount,
          points_used,
          created_at
        `);

      if (userId) {
        paymentQuery = paymentQuery.eq('user_id', userId);
      }

      if (startDate) {
        paymentQuery = paymentQuery.gte('created_at', startDate);
      }

      if (endDate) {
        paymentQuery = paymentQuery.lte('created_at', endDate);
      }

      const { data: paymentTransactions, error: paymentError } = await paymentQuery;

      if (paymentError) {
        throw new Error(`Failed to fetch payment transactions: ${paymentError.message}`);
      }

      // Group by user and calculate conversion metrics
      const userMetrics = new Map<string, PointConversionMetrics>();

      // Process point transactions
      for (const transaction of pointTransactions || []) {
        const userId = transaction.user_id;
        
        if (!userMetrics.has(userId)) {
          userMetrics.set(userId, {
            userId,
            totalPointsEarned: 0,
            totalPointsUsed: 0,
            conversionRate: 0,
            pointsToPaymentRatio: 0,
            averagePointsPerPayment: 0,
            paymentValueFromPoints: 0,
            remainingPoints: 0
          });
        }

        const metrics = userMetrics.get(userId)!;
        
        if (transaction.transaction_type === 'earned') {
          metrics.totalPointsEarned += transaction.amount;
        } else if (transaction.transaction_type === 'used') {
          metrics.totalPointsUsed += Math.abs(transaction.amount);
        }
      }

      // Process payment transactions
      for (const payment of paymentTransactions || []) {
        const userId = payment.user_id;
        
        if (!userMetrics.has(userId)) {
          userMetrics.set(userId, {
            userId,
            totalPointsEarned: 0,
            totalPointsUsed: 0,
            conversionRate: 0,
            pointsToPaymentRatio: 0,
            averagePointsPerPayment: 0,
            paymentValueFromPoints: 0,
            remainingPoints: 0
          });
        }

        const metrics = userMetrics.get(userId)!;
        metrics.paymentValueFromPoints += payment.points_used || 0;
      }

      // Calculate conversion rates and ratios
      for (const [userId, metrics] of userMetrics) {
        metrics.conversionRate = metrics.totalPointsEarned > 0 
          ? (metrics.totalPointsUsed / metrics.totalPointsEarned) * 100 
          : 0;
        
        const userPayments = paymentTransactions?.filter(p => p.user_id === userId) || [];
        metrics.pointsToPaymentRatio = userPayments.length > 0 
          ? metrics.totalPointsUsed / userPayments.length 
          : 0;
        
        metrics.averagePointsPerPayment = userPayments.length > 0 
          ? metrics.paymentValueFromPoints / userPayments.length 
          : 0;
        
        metrics.remainingPoints = metrics.totalPointsEarned - metrics.totalPointsUsed;
      }

      return Array.from(userMetrics.values());
    } catch (error) {
      this.logger.error('Failed to calculate point conversion metrics', { error, userId, startDate, endDate });
      throw error;
    }
  }

  /**
   * Monitor point accumulation vs spending trends
   */
  async monitorPointAccumulationTrends(
    userId?: string,
    months: number = 12
  ): Promise<Array<{
    month: string;
    totalEarned: number;
    totalUsed: number;
    netGrowth: number;
    activeUsers: number;
  }>> {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setMonth(startDate.getMonth() - months);

      // Get monthly point transactions
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          created_at
        `)
        .gte('created_at', startDate.toISOString())
        .lte('created_at', endDate.toISOString())
        .order('created_at', { ascending: true });

      if (error) {
        throw new Error(`Failed to fetch point transactions: ${error.message}`);
      }

      // Group by month and calculate trends
      const monthlyTrends = new Map<string, {
        month: string;
        totalEarned: number;
        totalUsed: number;
        netGrowth: number;
        activeUsers: Set<string>;
      }>();

      for (const transaction of transactions || []) {
        const date = new Date(transaction.created_at);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        
        if (!monthlyTrends.has(monthKey)) {
          monthlyTrends.set(monthKey, {
            month: monthKey,
            totalEarned: 0,
            totalUsed: 0,
            netGrowth: 0,
            activeUsers: new Set()
          });
        }

        const trend = monthlyTrends.get(monthKey)!;
        trend.activeUsers.add(transaction.user_id);

        if (transaction.transaction_type === 'earned') {
          trend.totalEarned += transaction.amount;
        } else if (transaction.transaction_type === 'used') {
          trend.totalUsed += Math.abs(transaction.amount);
        }
      }

      // Calculate net growth and convert to array
      const trends = Array.from(monthlyTrends.values()).map(trend => ({
        month: trend.month,
        totalEarned: trend.totalEarned,
        totalUsed: trend.totalUsed,
        netGrowth: trend.totalEarned - trend.totalUsed,
        activeUsers: trend.activeUsers.size
      }));

      return trends.sort((a, b) => a.month.localeCompare(b.month));
    } catch (error) {
      this.logger.error('Failed to monitor point accumulation trends', { error, userId, months });
      throw error;
    }
  }

  /**
   * Implement user point behavior segmentation
   */
  async segmentUserPointBehavior(
    userId?: string
  ): Promise<PointBehaviorSegment[]> {
    try {
      // Get user point data
      let query = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          created_at
        `)
        .order('created_at', { ascending: false });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch point transactions: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Group by user and analyze behavior
      const userBehaviors = new Map<string, PointBehaviorSegment>();

      for (const transaction of transactions) {
        const userId = transaction.user_id;
        
        if (!userBehaviors.has(userId)) {
          userBehaviors.set(userId, {
            segment: 'new_user',
            userId,
            totalEarned: 0,
            totalUsed: 0,
            activityScore: 0,
            lastActivity: transaction.created_at,
            characteristics: []
          });
        }

        const behavior = userBehaviors.get(userId)!;
        
        if (transaction.transaction_type === 'earned') {
          behavior.totalEarned += transaction.amount;
        } else if (transaction.transaction_type === 'used') {
          behavior.totalUsed += Math.abs(transaction.amount);
        }

        // Update last activity
        if (new Date(transaction.created_at) > new Date(behavior.lastActivity)) {
          behavior.lastActivity = transaction.created_at;
        }
      }

      // Calculate activity scores and determine segments
      for (const [userId, behavior] of userBehaviors) {
        const userTransactions = transactions.filter(t => t.user_id === userId);
        behavior.activityScore = userTransactions.length;

        // Determine segment based on behavior
        const daysSinceLastActivity = Math.floor(
          (Date.now() - new Date(behavior.lastActivity).getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysSinceLastActivity > 90) {
          behavior.segment = 'inactive';
          behavior.characteristics.push('No activity in 90+ days');
        } else if (behavior.totalEarned > behavior.totalUsed * 2) {
          behavior.segment = 'high_earner';
          behavior.characteristics.push('Earns significantly more than spends');
        } else if (behavior.totalUsed > behavior.totalEarned * 1.5) {
          behavior.segment = 'high_spender';
          behavior.characteristics.push('Spends more than earns');
        } else if (Math.abs(behavior.totalEarned - behavior.totalUsed) < behavior.totalEarned * 0.2) {
          behavior.segment = 'balanced';
          behavior.characteristics.push('Balanced earning and spending');
        } else {
          behavior.segment = 'new_user';
          behavior.characteristics.push('New user with limited activity');
        }

        // Add additional characteristics
        if (behavior.activityScore > 50) {
          behavior.characteristics.push('High activity user');
        }
        if (behavior.totalEarned > 10000) {
          behavior.characteristics.push('High earner');
        }
        if (behavior.totalUsed > 10000) {
          behavior.characteristics.push('High spender');
        }
      }

      return Array.from(userBehaviors.values());
    } catch (error) {
      this.logger.error('Failed to segment user point behavior', { error, userId });
      throw error;
    }
  }

  /**
   * Create point lifetime value analysis
   */
  async analyzePointLifetimeValue(
    userId?: string
  ): Promise<PointLifetimeValue[]> {
    try {
      // Get all point transactions for users
      let query = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          created_at
        `)
        .order('created_at', { ascending: true });

      if (userId) {
        query = query.eq('user_id', userId);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch point transactions: ${error.message}`);
      }

      if (!transactions || transactions.length === 0) {
        return [];
      }

      // Group by user and calculate lifetime value
      const userLifetimeValues = new Map<string, PointLifetimeValue>();

      for (const transaction of transactions) {
        const userId = transaction.user_id;
        
        if (!userLifetimeValues.has(userId)) {
          userLifetimeValues.set(userId, {
            userId,
            totalLifetimeEarnings: 0,
            totalLifetimeUsage: 0,
            netPointValue: 0,
            averageMonthlyEarnings: 0,
            averageMonthlyUsage: 0,
            pointRetentionRate: 0,
            predictedFutureValue: 0
          });
        }

        const lifetimeValue = userLifetimeValues.get(userId)!;
        
        if (transaction.transaction_type === 'earned') {
          lifetimeValue.totalLifetimeEarnings += transaction.amount;
        } else if (transaction.transaction_type === 'used') {
          lifetimeValue.totalLifetimeUsage += Math.abs(transaction.amount);
        }
      }

      // Calculate additional metrics
      for (const [userId, lifetimeValue] of userLifetimeValues) {
        const userTransactions = transactions.filter(t => t.user_id === userId);
        const firstTransaction = userTransactions[0];
        const lastTransaction = userTransactions[userTransactions.length - 1];
        
        if (firstTransaction && lastTransaction) {
          const monthsActive = Math.max(1, Math.floor(
            (new Date(lastTransaction.created_at).getTime() - new Date(firstTransaction.created_at).getTime()) 
            / (1000 * 60 * 60 * 24 * 30)
          ));

          lifetimeValue.averageMonthlyEarnings = lifetimeValue.totalLifetimeEarnings / monthsActive;
          lifetimeValue.averageMonthlyUsage = lifetimeValue.totalLifetimeUsage / monthsActive;
        }

        lifetimeValue.netPointValue = lifetimeValue.totalLifetimeEarnings - lifetimeValue.totalLifetimeUsage;
        lifetimeValue.pointRetentionRate = lifetimeValue.totalLifetimeEarnings > 0 
          ? ((lifetimeValue.totalLifetimeEarnings - lifetimeValue.totalLifetimeUsage) / lifetimeValue.totalLifetimeEarnings) * 100 
          : 0;

        // Simple prediction based on current trends
        lifetimeValue.predictedFutureValue = lifetimeValue.averageMonthlyEarnings * 12;
      }

      return Array.from(userLifetimeValues.values());
    } catch (error) {
      this.logger.error('Failed to analyze point lifetime value', { error, userId });
      throw error;
    }
  }

  /**
   * Get comprehensive point analytics summary
   */
  async getPointAnalyticsSummary(
    startDate?: string,
    endDate?: string
  ): Promise<PointAnalyticsSummary> {
    try {
      // Get all point transactions
      let query = this.supabase
        .from('point_transactions')
        .select(`
          user_id,
          amount,
          transaction_type,
          source,
          created_at
        `);

      if (startDate) {
        query = query.gte('created_at', startDate);
      }

      if (endDate) {
        query = query.lte('created_at', endDate);
      }

      const { data: transactions, error } = await query;

      if (error) {
        throw new Error(`Failed to fetch point transactions: ${error.message}`);
      }

      // Calculate summary statistics
      const totalUsers = new Set(transactions?.map(t => t.user_id) || []).size;
      const totalPointsEarned = transactions?.filter(t => t.transaction_type === 'earned')
        .reduce((sum, t) => sum + t.amount, 0) || 0;
      const totalPointsUsed = transactions?.filter(t => t.transaction_type === 'used')
        .reduce((sum, t) => sum + Math.abs(t.amount), 0) || 0;
      const averageConversionRate = totalPointsEarned > 0 
        ? (totalPointsUsed / totalPointsEarned) * 100 
        : 0;

      // Calculate FIFO efficiency (simplified)
      const fifoEfficiencyRate = 85; // Placeholder - would need actual FIFO data

      // Calculate top earning sources
      const sourceEarnings = new Map<string, number>();
      transactions?.filter(t => t.transaction_type === 'earned').forEach(t => {
        const source = t.source || 'unknown';
        sourceEarnings.set(source, (sourceEarnings.get(source) || 0) + t.amount);
      });

      const topEarningSources = Array.from(sourceEarnings.entries())
        .map(([source, totalEarnings]) => ({
          source,
          totalEarnings,
          percentage: (totalEarnings / totalPointsEarned) * 100
        }))
        .sort((a, b) => b.totalEarnings - a.totalEarnings)
        .slice(0, 5);

      // Get user segments
      const segments = await this.segmentUserPointBehavior();
      const segmentCounts = new Map<string, number>();
      segments.forEach(segment => {
        segmentCounts.set(segment.segment, (segmentCounts.get(segment.segment) || 0) + 1);
      });

      const userSegments = Array.from(segmentCounts.entries())
        .map(([segment, count]) => ({
          segment,
          count,
          percentage: (count / totalUsers) * 100
        }));

      // Get monthly trends
      const rawMonthlyTrends = await this.monitorPointAccumulationTrends(undefined, 12);
      const monthlyTrends = rawMonthlyTrends.map(trend => ({
        month: trend.month,
        earnings: trend.totalEarned,
        usage: trend.totalUsed,
        netGrowth: trend.netGrowth
      }));

      return {
        totalUsers,
        totalPointsEarned,
        totalPointsUsed,
        averageConversionRate,
        fifoEfficiencyRate,
        topEarningSources,
        userSegments,
        monthlyTrends
      };
    } catch (error) {
      this.logger.error('Failed to get point analytics summary', { error, startDate, endDate });
      throw error;
    }
  }
}

export const paymentAnalyticsService = new PaymentAnalyticsService();
