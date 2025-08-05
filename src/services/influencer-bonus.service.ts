/**
 * Influencer Bonus Service
 * 
 * Comprehensive influencer bonus system including:
 * - Influencer bonus calculation and validation
 * - Bonus analytics and reporting
 * - Influencer qualification tracking
 * - Bonus distribution monitoring
 * - Performance metrics and insights
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  PointTransaction, 
  PointTransactionType, 
  User,
  PointStatus 
} from '../types/database.types';

export interface InfluencerBonusStats {
  totalInfluencers: number;
  totalBonusPointsAwarded: number;
  totalBonusTransactions: number;
  averageBonusPerInfluencer: number;
  topEarningInfluencers: Array<{
    userId: string;
    userName: string;
    totalBonusPoints: number;
    totalTransactions: number;
    averageBonusPerTransaction: number;
  }>;
  monthlyTrends: Array<{
    month: string;
    totalBonusPoints: number;
    totalTransactions: number;
    activeInfluencers: number;
  }>;
  bonusDistribution: {
    smallBonus: number; // 1-100 points
    mediumBonus: number; // 101-500 points
    largeBonus: number; // 501+ points
  };
}

export interface InfluencerBonusAnalytics {
  influencerId: string;
  influencerName: string;
  totalBonusPoints: number;
  totalTransactions: number;
  averageBonusPerTransaction: number;
  firstBonusDate: string;
  lastBonusDate: string;
  bonusHistory: Array<{
    transactionId: string;
    amount: number;
    baseAmount: number;
    bonusAmount: number;
    description: string;
    createdAt: string;
    status: PointStatus;
  }>;
  performanceMetrics: {
    monthlyAverage: number;
    growthRate: number;
    consistencyScore: number;
  };
}

export interface InfluencerQualificationCriteria {
  minimumFollowers?: number;
  minimumEngagement?: number;
  minimumContentPosts?: number;
  accountAge?: number; // in days
  verificationStatus?: boolean;
  contentQuality?: 'high' | 'medium' | 'low';
}

export interface InfluencerQualificationResult {
  userId: string;
  userName: string;
  isQualified: boolean;
  qualificationScore: number;
  criteriaMet: string[];
  criteriaFailed: string[];
  recommendations: string[];
  qualifiedAt?: string;
}

export class InfluencerBonusService {
  private supabase = getSupabaseClient();

  /**
   * Calculate influencer bonus for a transaction
   */
  async calculateInfluencerBonus(
    userId: string,
    baseAmount: number,
    transactionType: PointTransactionType
  ): Promise<{
    totalAmount: number;
    baseAmount: number;
    bonusAmount: number;
    isInfluencer: boolean;
    bonusMultiplier: number;
  }> {
    try {
      // Get user information
      const { data: user, error } = await this.supabase
        .from('users')
        .select('id, name, is_influencer, influencer_qualified_at')
        .eq('id', userId)
        .single();

      if (error || !user) {
        logger.error('Failed to fetch user for influencer bonus calculation', {
          userId,
          error: error?.message
        });
        throw new Error(`User not found: ${userId}`);
      }

      const isInfluencer = user.is_influencer;
      const bonusMultiplier = isInfluencer ? 2 : 1;
      const bonusAmount = isInfluencer ? baseAmount : 0;
      const totalAmount = baseAmount + bonusAmount;

      logger.info('Influencer bonus calculated', {
        userId,
        userName: user.name,
        isInfluencer,
        baseAmount,
        bonusAmount,
        totalAmount,
        transactionType
      });

      return {
        totalAmount,
        baseAmount,
        bonusAmount,
        isInfluencer,
        bonusMultiplier
      };

    } catch (error) {
      logger.error('Error calculating influencer bonus', {
        userId,
        baseAmount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate influencer bonus calculation
   */
  async validateInfluencerBonus(
    userId: string,
    transactionId: string
  ): Promise<{
    isValid: boolean;
    errors: string[];
    warnings: string[];
    validationDetails: Record<string, any>;
  }> {
    const errors: string[] = [];
    const warnings: string[] = [];
    const validationDetails: Record<string, any> = {};

    try {
      // Get transaction details
      const { data: transaction, error: transactionError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('id', transactionId)
        .eq('user_id', userId)
        .single();

      if (transactionError || !transaction) {
        errors.push(`Transaction not found: ${transactionId}`);
        return { isValid: false, errors, warnings, validationDetails };
      }

      // Get user details
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        errors.push(`User not found: ${userId}`);
        return { isValid: false, errors, warnings, validationDetails };
      }

      validationDetails.transaction = {
        id: transaction.id,
        type: transaction.transaction_type,
        amount: transaction.amount,
        status: transaction.status,
        metadata: transaction.metadata
      };

      validationDetails.user = {
        id: user.id,
        name: user.name,
        isInfluencer: user.is_influencer,
        qualifiedAt: user.influencer_qualified_at
      };

      // Validate transaction type
      if (transaction.transaction_type !== 'influencer_bonus') {
        errors.push('Transaction type must be influencer_bonus');
      }

      // Validate influencer status
      if (!user.is_influencer) {
        errors.push('User is not marked as influencer');
      }

      // Validate bonus calculation
      const metadata = transaction.metadata || {};
      const baseAmount = metadata.baseAmount || 0;
      const bonusAmount = metadata.bonusAmount || 0;
      const expectedBonus = user.is_influencer ? baseAmount : 0;

      if (bonusAmount !== expectedBonus) {
        errors.push(`Bonus amount mismatch: expected ${expectedBonus}, got ${bonusAmount}`);
      }

      // Validate total amount
      const expectedTotal = baseAmount + expectedBonus;
      if (transaction.amount !== expectedTotal) {
        errors.push(`Total amount mismatch: expected ${expectedTotal}, got ${transaction.amount}`);
      }

      // Check for warnings
      if (user.is_influencer && !user.influencer_qualified_at) {
        warnings.push('Influencer qualification date is not set');
      }

      if (bonusAmount > 10000) {
        warnings.push('Large bonus amount detected - verify legitimacy');
      }

      const isValid = errors.length === 0;

      logger.info('Influencer bonus validation completed', {
        transactionId,
        userId,
        isValid,
        errorCount: errors.length,
        warningCount: warnings.length
      });

      return { isValid, errors, warnings, validationDetails };

    } catch (error) {
      logger.error('Error validating influencer bonus', {
        userId,
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      errors.push(`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return { isValid: false, errors, warnings, validationDetails };
    }
  }

  /**
   * Get influencer bonus statistics
   */
  async getInfluencerBonusStats(
    timeRange?: { start: string; end: string }
  ): Promise<InfluencerBonusStats> {
    try {
      const start = timeRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const end = timeRange?.end || new Date().toISOString();

      // Get all influencer bonus transactions
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select(`
          id,
          user_id,
          amount,
          metadata,
          created_at,
          users!inner(id, name, is_influencer)
        `)
        .eq('transaction_type', 'influencer_bonus')
        .gte('created_at', start)
        .lte('created_at', end)
        .eq('users.is_influencer', true);

      if (error) {
        logger.error('Failed to fetch influencer bonus transactions', { error: error.message });
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      // Calculate statistics
      const influencerMap = new Map<string, {
        userId: string;
        userName: string;
        totalBonusPoints: number;
        totalTransactions: number;
        transactions: any[];
      }>();

      let totalBonusPoints = 0;
      let totalTransactions = 0;

      for (const transaction of transactions || []) {
        const metadata = transaction.metadata || {};
        const bonusAmount = metadata.bonusAmount || 0;
        
        totalBonusPoints += bonusAmount;
        totalTransactions++;

        const influencerId = transaction.user_id;
        if (!influencerMap.has(influencerId)) {
          influencerMap.set(influencerId, {
            userId: influencerId,
            userName: (transaction.users as any)?.name || 'Unknown',
            totalBonusPoints: 0,
            totalTransactions: 0,
            transactions: []
          });
        }

        const influencer = influencerMap.get(influencerId)!;
        influencer.totalBonusPoints += bonusAmount;
        influencer.totalTransactions++;
        influencer.transactions.push(transaction);
      }

      // Calculate top earning influencers
      const topEarningInfluencers = Array.from(influencerMap.values())
        .map(influencer => ({
          userId: influencer.userId,
          userName: influencer.userName,
          totalBonusPoints: influencer.totalBonusPoints,
          totalTransactions: influencer.totalTransactions,
          averageBonusPerTransaction: influencer.totalTransactions > 0 
            ? influencer.totalBonusPoints / influencer.totalTransactions 
            : 0
        }))
        .sort((a, b) => b.totalBonusPoints - a.totalBonusPoints)
        .slice(0, 10);

      // Calculate monthly trends
      const monthlyTrends = this.calculateMonthlyTrends(transactions || []);

      // Calculate bonus distribution
      const bonusDistribution = this.calculateBonusDistribution(transactions || []);

      const stats: InfluencerBonusStats = {
        totalInfluencers: influencerMap.size,
        totalBonusPointsAwarded: totalBonusPoints,
        totalBonusTransactions: totalTransactions,
        averageBonusPerInfluencer: influencerMap.size > 0 ? totalBonusPoints / influencerMap.size : 0,
        topEarningInfluencers,
        monthlyTrends,
        bonusDistribution
      };

      logger.info('Influencer bonus statistics calculated', {
        totalInfluencers: stats.totalInfluencers,
        totalBonusPoints: stats.totalBonusPointsAwarded,
        totalTransactions: stats.totalBonusTransactions
      });

      return stats;

    } catch (error) {
      logger.error('Error getting influencer bonus stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific influencer
   */
  async getInfluencerBonusAnalytics(
    influencerId: string,
    timeRange?: { start: string; end: string }
  ): Promise<InfluencerBonusAnalytics> {
    try {
      const start = timeRange?.start || new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString();
      const end = timeRange?.end || new Date().toISOString();

      // Get influencer information
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, name, is_influencer, influencer_qualified_at')
        .eq('id', influencerId)
        .single();

      if (userError || !user) {
        throw new Error(`Influencer not found: ${influencerId}`);
      }

      if (!user.is_influencer) {
        throw new Error(`User is not an influencer: ${influencerId}`);
      }

      // Get influencer bonus transactions
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', influencerId)
        .eq('transaction_type', 'influencer_bonus')
        .gte('created_at', start)
        .lte('created_at', end)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to fetch influencer bonus transactions', { 
          influencerId, 
          error: error.message 
        });
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      // Calculate analytics
      let totalBonusPoints = 0;
      let totalTransactions = 0;
      const bonusHistory: any[] = [];

      for (const transaction of transactions || []) {
        const metadata = transaction.metadata || {};
        const bonusAmount = metadata.bonusAmount || 0;
        
        totalBonusPoints += bonusAmount;
        totalTransactions++;

        bonusHistory.push({
          transactionId: transaction.id,
          amount: transaction.amount,
          baseAmount: metadata.baseAmount || 0,
          bonusAmount,
          description: transaction.description,
          createdAt: transaction.created_at,
          status: transaction.status
        });
      }

      // Calculate performance metrics
      const performanceMetrics = this.calculatePerformanceMetrics(bonusHistory);

      const analytics: InfluencerBonusAnalytics = {
        influencerId: user.id,
        influencerName: user.name,
        totalBonusPoints,
        totalTransactions,
        averageBonusPerTransaction: totalTransactions > 0 ? totalBonusPoints / totalTransactions : 0,
        firstBonusDate: bonusHistory.length > 0 ? bonusHistory[bonusHistory.length - 1].createdAt : '',
        lastBonusDate: bonusHistory.length > 0 ? bonusHistory[0].createdAt : '',
        bonusHistory,
        performanceMetrics
      };

      logger.info('Influencer bonus analytics calculated', {
        influencerId,
        influencerName: user.name,
        totalBonusPoints,
        totalTransactions
      });

      return analytics;

    } catch (error) {
      logger.error('Error getting influencer bonus analytics', {
        influencerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Check influencer qualification based on criteria
   */
  async checkInfluencerQualification(
    userId: string,
    criteria: InfluencerQualificationCriteria
  ): Promise<InfluencerQualificationResult> {
    try {
      // Get user information
      const { data: user, error } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error(`User not found: ${userId}`);
      }

      const criteriaMet: string[] = [];
      const criteriaFailed: string[] = [];
      const recommendations: string[] = [];
      let qualificationScore = 0;
      let isQualified = true;

      // Check account age
      if (criteria.accountAge) {
        const accountAge = Math.floor((Date.now() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24));
        if (accountAge >= criteria.accountAge) {
          criteriaMet.push(`Account age: ${accountAge} days`);
          qualificationScore += 20;
        } else {
          criteriaFailed.push(`Account age: ${accountAge} days (minimum ${criteria.accountAge} days)`);
          isQualified = false;
          recommendations.push(`Wait ${criteria.accountAge - accountAge} more days to meet account age requirement`);
        }
      }

      // Check verification status
      if (criteria.verificationStatus !== undefined) {
        if (user.phone_verified === criteria.verificationStatus) {
          criteriaMet.push(`Phone verification: ${criteria.verificationStatus ? 'Verified' : 'Not required'}`);
          qualificationScore += 15;
        } else {
          criteriaFailed.push(`Phone verification: ${user.phone_verified ? 'Verified' : 'Not verified'} (required: ${criteria.verificationStatus})`);
          isQualified = false;
          recommendations.push('Complete phone verification to qualify');
        }
      }

      // Check user status
      if (user.user_status === 'active') {
        criteriaMet.push('Account status: Active');
        qualificationScore += 10;
      } else {
        criteriaFailed.push(`Account status: ${user.user_status} (required: active)`);
        isQualified = false;
        recommendations.push('Ensure account is in active status');
      }

      // Check existing influencer status
      if (user.is_influencer) {
        criteriaMet.push('Already qualified as influencer');
        qualificationScore += 50;
      }

      const result: InfluencerQualificationResult = {
        userId: user.id,
        userName: user.name,
        isQualified,
        qualificationScore,
        criteriaMet,
        criteriaFailed,
        recommendations,
        qualifiedAt: user.influencer_qualified_at
      };

      logger.info('Influencer qualification check completed', {
        userId,
        userName: user.name,
        isQualified,
        qualificationScore,
        criteriaMetCount: criteriaMet.length,
        criteriaFailedCount: criteriaFailed.length
      });

      return result;

    } catch (error) {
      logger.error('Error checking influencer qualification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Calculate monthly trends from transactions
   */
  private calculateMonthlyTrends(transactions: any[]): Array<{
    month: string;
    totalBonusPoints: number;
    totalTransactions: number;
    activeInfluencers: number;
  }> {
    const monthlyData = new Map<string, {
      totalBonusPoints: number;
      totalTransactions: number;
      activeInfluencers: Set<string>;
    }>();

    for (const transaction of transactions) {
      const month = transaction.created_at.substring(0, 7); // YYYY-MM format
      const metadata = transaction.metadata || {};
      const bonusAmount = metadata.bonusAmount || 0;

      if (!monthlyData.has(month)) {
        monthlyData.set(month, {
          totalBonusPoints: 0,
          totalTransactions: 0,
          activeInfluencers: new Set()
        });
      }

      const monthData = monthlyData.get(month)!;
      monthData.totalBonusPoints += bonusAmount;
      monthData.totalTransactions++;
      monthData.activeInfluencers.add(transaction.user_id);
    }

    return Array.from(monthlyData.entries())
      .map(([month, data]) => ({
        month,
        totalBonusPoints: data.totalBonusPoints,
        totalTransactions: data.totalTransactions,
        activeInfluencers: data.activeInfluencers.size
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }

  /**
   * Calculate bonus distribution
   */
  private calculateBonusDistribution(transactions: any[]): {
    smallBonus: number;
    mediumBonus: number;
    largeBonus: number;
  } {
    const distribution = {
      smallBonus: 0,
      mediumBonus: 0,
      largeBonus: 0
    };

    for (const transaction of transactions) {
      const metadata = transaction.metadata || {};
      const bonusAmount = metadata.bonusAmount || 0;

      if (bonusAmount <= 100) {
        distribution.smallBonus++;
      } else if (bonusAmount <= 500) {
        distribution.mediumBonus++;
      } else {
        distribution.largeBonus++;
      }
    }

    return distribution;
  }

  /**
   * Calculate performance metrics
   */
  private calculatePerformanceMetrics(bonusHistory: any[]): {
    monthlyAverage: number;
    growthRate: number;
    consistencyScore: number;
  } {
    if (bonusHistory.length === 0) {
      return {
        monthlyAverage: 0,
        growthRate: 0,
        consistencyScore: 0
      };
    }

    // Calculate monthly average
    const totalBonus = bonusHistory.reduce((sum, transaction) => sum + transaction.bonusAmount, 0);
    const monthsActive = this.calculateMonthsActive(bonusHistory);
    const monthlyAverage = monthsActive > 0 ? totalBonus / monthsActive : 0;

    // Calculate growth rate
    const growthRate = this.calculateGrowthRate(bonusHistory);

    // Calculate consistency score
    const consistencyScore = this.calculateConsistencyScore(bonusHistory);

    return {
      monthlyAverage,
      growthRate,
      consistencyScore
    };
  }

  /**
   * Calculate months active
   */
  private calculateMonthsActive(bonusHistory: any[]): number {
    if (bonusHistory.length === 0) return 0;

    const firstDate = new Date(bonusHistory[bonusHistory.length - 1].createdAt);
    const lastDate = new Date(bonusHistory[0].createdAt);
    
    const monthsDiff = (lastDate.getFullYear() - firstDate.getFullYear()) * 12 + 
                      (lastDate.getMonth() - firstDate.getMonth());
    
    return Math.max(1, monthsDiff + 1);
  }

  /**
   * Calculate growth rate
   */
  private calculateGrowthRate(bonusHistory: any[]): number {
    if (bonusHistory.length < 2) return 0;

    const recentTransactions = bonusHistory.slice(0, Math.floor(bonusHistory.length / 2));
    const olderTransactions = bonusHistory.slice(Math.floor(bonusHistory.length / 2));

    const recentAverage = recentTransactions.reduce((sum, t) => sum + t.bonusAmount, 0) / recentTransactions.length;
    const olderAverage = olderTransactions.reduce((sum, t) => sum + t.bonusAmount, 0) / olderTransactions.length;

    if (olderAverage === 0) return recentAverage > 0 ? 100 : 0;

    return ((recentAverage - olderAverage) / olderAverage) * 100;
  }

  /**
   * Calculate consistency score
   */
  private calculateConsistencyScore(bonusHistory: any[]): number {
    if (bonusHistory.length < 2) return 100;

    const monthlyBonuses = new Map<string, number>();
    
    for (const transaction of bonusHistory) {
      const month = transaction.createdAt.substring(0, 7);
      monthlyBonuses.set(month, (monthlyBonuses.get(month) || 0) + transaction.bonusAmount);
    }

    const bonuses = Array.from(monthlyBonuses.values());
    const average = bonuses.reduce((sum, bonus) => sum + bonus, 0) / bonuses.length;
    
    if (average === 0) return 0;

    const variance = bonuses.reduce((sum, bonus) => sum + Math.pow(bonus - average, 2), 0) / bonuses.length;
    const standardDeviation = Math.sqrt(variance);
    const coefficientOfVariation = standardDeviation / average;

    // Convert to consistency score (0-100, higher is more consistent)
    return Math.max(0, 100 - (coefficientOfVariation * 50));
  }
} 