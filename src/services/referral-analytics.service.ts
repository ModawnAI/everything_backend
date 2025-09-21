import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Referral Analytics Service
 * 
 * Provides comprehensive analytics and reporting for the referral system
 */

export interface ReferralAnalyticsOverview {
  totalReferrals: number;
  activeReferrals: number;
  completedReferrals: number;
  totalEarnings: number;
  totalPayouts: number;
  conversionRate: number;
  averageEarningsPerReferral: number;
  topPerformers: Array<{
    userId: string;
    userName: string;
    totalReferrals: number;
    earnings: number;
    conversionRate: number;
  }>;
  recentActivity: Array<{
    type: string;
    description: string;
    timestamp: string;
    userId: string;
    amount?: number;
  }>;
}

export interface ReferralTrendsData {
  period: 'day' | 'week' | 'month' | 'year';
  startDate: string;
  endDate: string;
  data: Array<{
    date: string;
    referrals: number;
    earnings: number;
    payouts: number;
    newUsers: number;
    conversionRate: number;
  }>;
  summary: {
    totalReferrals: number;
    totalEarnings: number;
    totalPayouts: number;
    averageDailyReferrals: number;
    growthRate: number;
  };
}

export interface ReferralUserAnalytics {
  userId: string;
  userName: string;
  userEmail: string;
  joinDate: string;
  totalReferrals: number;
  successfulReferrals: number;
  failedReferrals: number;
  conversionRate: number;
  totalEarnings: number;
  totalPayouts: number;
  availableBalance: number;
  tier: string;
  isInfluencer: boolean;
  referralChain: {
    depth: number;
    totalDescendants: number;
    directReferrals: number;
    indirectReferrals: number;
  };
  performance: {
    rank: number;
    percentile: number;
    monthlyGrowth: number;
    bestMonth: string;
    worstMonth: string;
  };
  recentReferrals: Array<{
    referredUserId: string;
    referredUserName: string;
    status: string;
    earnings: number;
    createdAt: string;
  }>;
}

export interface ReferralSystemMetrics {
  systemHealth: {
    activeUsers: number;
    totalReferrals: number;
    systemUptime: number;
    errorRate: number;
    averageResponseTime: number;
  };
  performance: {
    totalEarnings: number;
    totalPayouts: number;
    pendingPayouts: number;
    averagePayoutTime: number;
    payoutSuccessRate: number;
  };
  userEngagement: {
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number;
    referralCodeUsage: number;
  };
  financial: {
    totalRevenue: number;
    totalPayouts: number;
    netProfit: number;
    averageEarningsPerUser: number;
    topEarningUsers: Array<{
      userId: string;
      userName: string;
      earnings: number;
    }>;
  };
}

export interface ReferralReport {
  reportId: string;
  reportType: 'overview' | 'trends' | 'user' | 'system' | 'financial';
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  data: any;
  summary: string;
  insights: string[];
  recommendations: string[];
}

class ReferralAnalyticsService {
  private supabase = getSupabaseClient();

  /**
   * Get comprehensive referral analytics overview
   */
  async getReferralAnalyticsOverview(): Promise<ReferralAnalyticsOverview> {
    try {
      logger.info('Generating referral analytics overview');

      // Get total referrals
      const { data: totalReferrals } = await this.supabase
        .from('referrals')
        .select('id', { count: 'exact' });

      // Get active referrals
      const { data: activeReferrals } = await this.supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('status', 'active');

      // Get completed referrals
      const { data: completedReferrals } = await this.supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('status', 'completed');

      // Get total earnings
      const { data: totalEarnings } = await this.supabase
        .from('referral_earnings')
        .select('amount');

      // Get total payouts
      const { data: totalPayouts } = await this.supabase
        .from('referral_payouts')
        .select('amount')
        .eq('status', 'completed');

      // Calculate metrics
      const totalRefs = totalReferrals?.length || 0;
      const activeRefs = activeReferrals?.length || 0;
      const completedRefs = completedReferrals?.length || 0;
      const earnings = totalEarnings?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const payouts = totalPayouts?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const conversionRate = totalRefs > 0 ? (completedRefs / totalRefs) * 100 : 0;
      const avgEarnings = completedRefs > 0 ? earnings / completedRefs : 0;

      // Get top performers
      const topPerformers = await this.getTopPerformers(10);

      // Get recent activity
      const recentActivity = await this.getRecentActivity(20);

      const overview: ReferralAnalyticsOverview = {
        totalReferrals: totalRefs,
        activeReferrals: activeRefs,
        completedReferrals: completedRefs,
        totalEarnings: earnings,
        totalPayouts: payouts,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageEarningsPerReferral: Math.round(avgEarnings * 100) / 100,
        topPerformers,
        recentActivity
      };

      logger.info('Referral analytics overview generated', {
        totalReferrals: totalRefs,
        conversionRate: Math.round(conversionRate * 100) / 100
      });

      return overview;

    } catch (error) {
      logger.error('Failed to generate referral analytics overview', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get referral trends data for a specific period
   */
  async getReferralTrends(
    period: 'day' | 'week' | 'month' | 'year',
    startDate: string,
    endDate: string
  ): Promise<ReferralTrendsData> {
    try {
      logger.info('Generating referral trends data', { period, startDate, endDate });

      // Get referrals by period
      const { data: referrals } = await this.supabase
        .from('referrals')
        .select('created_at, status')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      // Get earnings by period
      const { data: earnings } = await this.supabase
        .from('referral_earnings')
        .select('amount, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      // Get payouts by period
      const { data: payouts } = await this.supabase
        .from('referral_payouts')
        .select('amount, created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      // Get new users by period
      const { data: newUsers } = await this.supabase
        .from('users')
        .select('created_at')
        .gte('created_at', startDate)
        .lte('created_at', endDate)
        .order('created_at', { ascending: true });

      // Group data by period
      const groupedData = this.groupDataByPeriod(
        referrals || [],
        earnings || [],
        payouts || [],
        newUsers || [],
        period
      );

      // Calculate summary
      const totalReferrals = referrals?.length || 0;
      const totalEarnings = earnings?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const totalPayouts = payouts?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const days = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24));
      const averageDailyReferrals = days > 0 ? totalReferrals / days : 0;

      // Calculate growth rate
      const firstHalf = groupedData.slice(0, Math.floor(groupedData.length / 2));
      const secondHalf = groupedData.slice(Math.floor(groupedData.length / 2));
      const firstHalfAvg = firstHalf.reduce((sum, d) => sum + d.referrals, 0) / firstHalf.length;
      const secondHalfAvg = secondHalf.reduce((sum, d) => sum + d.referrals, 0) / secondHalf.length;
      const growthRate = firstHalfAvg > 0 ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 : 0;

      const trends: ReferralTrendsData = {
        period,
        startDate,
        endDate,
        data: groupedData,
        summary: {
          totalReferrals,
          totalEarnings,
          totalPayouts,
          averageDailyReferrals: Math.round(averageDailyReferrals * 100) / 100,
          growthRate: Math.round(growthRate * 100) / 100
        }
      };

      logger.info('Referral trends data generated', {
        period,
        totalReferrals,
        growthRate: Math.round(growthRate * 100) / 100
      });

      return trends;

    } catch (error) {
      logger.error('Failed to generate referral trends data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        period,
        startDate,
        endDate
      });
      throw error;
    }
  }

  /**
   * Get detailed analytics for a specific user
   */
  async getUserReferralAnalytics(userId: string): Promise<ReferralUserAnalytics> {
    try {
      logger.info('Generating user referral analytics', { userId });

      // Get user information
      const { data: userInfo } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (!userInfo) {
        throw new Error('User not found');
      }

      // Get user's referrals
      const { data: userReferrals } = await this.supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', userId);

      // Get user's earnings
      const { data: userEarnings } = await this.supabase
        .from('referral_earnings')
        .select('*')
        .eq('referrer_id', userId);

      // Get user's payouts
      const { data: userPayouts } = await this.supabase
        .from('referral_payouts')
        .select('*')
        .eq('referrer_id', userId);

      // Get referral chain data
      const { data: referralChain } = await this.supabase
        .from('referral_relationships')
        .select('*')
        .eq('referrer_id', userId);

      // Calculate metrics
      const totalReferrals = userReferrals?.length || 0;
      const successfulReferrals = userReferrals?.filter(r => r.status === 'completed').length || 0;
      const failedReferrals = userReferrals?.filter(r => r.status === 'failed').length || 0;
      const conversionRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0;
      const totalEarnings = userEarnings?.reduce((sum, e) => sum + e.amount, 0) || 0;
      const totalPayouts = userPayouts?.filter(p => p.status === 'completed').reduce((sum, p) => sum + p.amount, 0) || 0;
      const availableBalance = totalEarnings - totalPayouts;

      // Determine tier
      const tier = this.determineUserTier(totalReferrals);

      // Get performance metrics
      const performance = await this.calculateUserPerformance(userId, totalReferrals);

      // Get recent referrals
      const recentReferrals = (userReferrals || [])
        .slice(0, 10)
        .map(r => ({
          referredUserId: r.referred_id,
          referredUserName: 'Unknown', // Would need to join with users table
          status: r.status,
          earnings: userEarnings?.find(e => e.referral_id === r.id)?.amount || 0,
          createdAt: r.created_at
        }));

      const analytics: ReferralUserAnalytics = {
        userId,
        userName: userInfo.name,
        userEmail: userInfo.email,
        joinDate: userInfo.created_at,
        totalReferrals,
        successfulReferrals,
        failedReferrals,
        conversionRate: Math.round(conversionRate * 100) / 100,
        totalEarnings,
        totalPayouts,
        availableBalance,
        tier,
        isInfluencer: userInfo.is_influencer || false,
        referralChain: {
          depth: referralChain?.length || 0,
          totalDescendants: referralChain?.length || 0,
          directReferrals: totalReferrals,
          indirectReferrals: 0 // Would need to calculate from referral chain
        },
        performance,
        recentReferrals
      };

      logger.info('User referral analytics generated', {
        userId,
        totalReferrals,
        conversionRate: Math.round(conversionRate * 100) / 100
      });

      return analytics;

    } catch (error) {
      logger.error('Failed to generate user referral analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get system-wide referral metrics
   */
  async getReferralSystemMetrics(): Promise<ReferralSystemMetrics> {
    try {
      logger.info('Generating referral system metrics');

      // Get system health metrics
      const systemHealth = await this.getSystemHealthMetrics();

      // Get performance metrics
      const performance = await this.getPerformanceMetrics();

      // Get user engagement metrics
      const userEngagement = await this.getUserEngagementMetrics();

      // Get financial metrics
      const financial = await this.getFinancialMetrics();

      const metrics: ReferralSystemMetrics = {
        systemHealth,
        performance,
        userEngagement,
        financial
      };

      logger.info('Referral system metrics generated');

      return metrics;

    } catch (error) {
      logger.error('Failed to generate referral system metrics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Generate comprehensive referral report
   */
  async generateReferralReport(
    reportType: 'overview' | 'trends' | 'user' | 'system' | 'financial',
    startDate: string,
    endDate: string,
    userId?: string
  ): Promise<ReferralReport> {
    try {
      logger.info('Generating referral report', { reportType, startDate, endDate, userId });

      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      let data: any;
      let summary: string;
      let insights: string[] = [];
      let recommendations: string[] = [];

      switch (reportType) {
        case 'overview':
          data = await this.getReferralAnalyticsOverview();
          summary = `Referral system overview for ${startDate} to ${endDate}`;
          insights = this.generateOverviewInsights(data);
          recommendations = this.generateOverviewRecommendations(data);
          break;

        case 'trends':
          data = await this.getReferralTrends('month', startDate, endDate);
          summary = `Referral trends analysis for ${startDate} to ${endDate}`;
          insights = this.generateTrendsInsights(data);
          recommendations = this.generateTrendsRecommendations(data);
          break;

        case 'user':
          if (!userId) throw new Error('User ID required for user report');
          data = await this.getUserReferralAnalytics(userId);
          summary = `User referral analytics for ${data.userName} (${startDate} to ${endDate})`;
          insights = this.generateUserInsights(data);
          recommendations = this.generateUserRecommendations(data);
          break;

        case 'system':
          data = await this.getReferralSystemMetrics();
          summary = `System-wide referral metrics for ${startDate} to ${endDate}`;
          insights = this.generateSystemInsights(data);
          recommendations = this.generateSystemRecommendations(data);
          break;

        case 'financial':
          data = await this.getFinancialMetrics();
          summary = `Financial referral analysis for ${startDate} to ${endDate}`;
          insights = this.generateFinancialInsights(data);
          recommendations = this.generateFinancialRecommendations(data);
          break;

        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      const report: ReferralReport = {
        reportId,
        reportType,
        generatedAt: new Date().toISOString(),
        period: { startDate, endDate },
        data,
        summary,
        insights,
        recommendations
      };

      logger.info('Referral report generated', { reportId, reportType });

      return report;

    } catch (error) {
      logger.error('Failed to generate referral report', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reportType,
        startDate,
        endDate,
        userId
      });
      throw error;
    }
  }

  /**
   * Get top performers
   */
  private async getTopPerformers(limit: number): Promise<Array<{
    userId: string;
    userName: string;
    totalReferrals: number;
    earnings: number;
    conversionRate: number;
  }>> {
    // TODO: Implement top performers query
    return [];
  }

  /**
   * Get recent activity
   */
  private async getRecentActivity(limit: number): Promise<Array<{
    type: string;
    description: string;
    timestamp: string;
    userId: string;
    amount?: number;
  }>> {
    // TODO: Implement recent activity query
    return [];
  }

  /**
   * Group data by period
   */
  private groupDataByPeriod(
    referrals: any[],
    earnings: any[],
    payouts: any[],
    newUsers: any[],
    period: string
  ): Array<{
    date: string;
    referrals: number;
    earnings: number;
    payouts: number;
    newUsers: number;
    conversionRate: number;
  }> {
    // TODO: Implement data grouping logic
    return [];
  }

  /**
   * Determine user tier based on referral count
   */
  private determineUserTier(totalReferrals: number): string {
    if (totalReferrals >= 100) return 'diamond';
    if (totalReferrals >= 50) return 'platinum';
    if (totalReferrals >= 25) return 'gold';
    if (totalReferrals >= 10) return 'silver';
    return 'bronze';
  }

  /**
   * Calculate user performance metrics
   */
  private async calculateUserPerformance(userId: string, totalReferrals: number): Promise<{
    rank: number;
    percentile: number;
    monthlyGrowth: number;
    bestMonth: string;
    worstMonth: string;
  }> {
    // TODO: Implement performance calculation
    return {
      rank: 1,
      percentile: 100,
      monthlyGrowth: 0,
      bestMonth: '',
      worstMonth: ''
    };
  }

  /**
   * Get system health metrics
   */
  private async getSystemHealthMetrics(): Promise<{
    activeUsers: number;
    totalReferrals: number;
    systemUptime: number;
    errorRate: number;
    averageResponseTime: number;
  }> {
    // TODO: Implement system health metrics
    return {
      activeUsers: 0,
      totalReferrals: 0,
      systemUptime: 99.9,
      errorRate: 0.1,
      averageResponseTime: 200
    };
  }

  /**
   * Get performance metrics
   */
  private async getPerformanceMetrics(): Promise<{
    totalEarnings: number;
    totalPayouts: number;
    pendingPayouts: number;
    averagePayoutTime: number;
    payoutSuccessRate: number;
  }> {
    // TODO: Implement performance metrics
    return {
      totalEarnings: 0,
      totalPayouts: 0,
      pendingPayouts: 0,
      averagePayoutTime: 0,
      payoutSuccessRate: 100
    };
  }

  /**
   * Get user engagement metrics
   */
  private async getUserEngagementMetrics(): Promise<{
    dailyActiveUsers: number;
    weeklyActiveUsers: number;
    monthlyActiveUsers: number;
    averageSessionDuration: number;
    referralCodeUsage: number;
  }> {
    // TODO: Implement user engagement metrics
    return {
      dailyActiveUsers: 0,
      weeklyActiveUsers: 0,
      monthlyActiveUsers: 0,
      averageSessionDuration: 0,
      referralCodeUsage: 0
    };
  }

  /**
   * Get financial metrics
   */
  private async getFinancialMetrics(): Promise<{
    totalRevenue: number;
    totalPayouts: number;
    netProfit: number;
    averageEarningsPerUser: number;
    topEarningUsers: Array<{
      userId: string;
      userName: string;
      earnings: number;
    }>;
  }> {
    // TODO: Implement financial metrics
    return {
      totalRevenue: 0,
      totalPayouts: 0,
      netProfit: 0,
      averageEarningsPerUser: 0,
      topEarningUsers: []
    };
  }

  /**
   * Generate insights and recommendations
   */
  private generateOverviewInsights(data: ReferralAnalyticsOverview): string[] {
    const insights: string[] = [];
    
    if (data.conversionRate > 80) {
      insights.push('Excellent conversion rate indicates strong referral quality');
    } else if (data.conversionRate < 50) {
      insights.push('Low conversion rate suggests need for referral quality improvement');
    }

    if (data.averageEarningsPerReferral > 1000) {
      insights.push('High average earnings per referral indicates valuable referral program');
    }

    return insights;
  }

  private generateOverviewRecommendations(data: ReferralAnalyticsOverview): string[] {
    const recommendations: string[] = [];
    
    if (data.conversionRate < 50) {
      recommendations.push('Implement referral quality screening');
      recommendations.push('Provide better onboarding for referred users');
    }

    if (data.averageEarningsPerReferral < 500) {
      recommendations.push('Consider increasing referral bonuses');
      recommendations.push('Implement tier-based bonus system');
    }

    return recommendations;
  }

  private generateTrendsInsights(data: ReferralTrendsData): string[] {
    return [];
  }

  private generateTrendsRecommendations(data: ReferralTrendsData): string[] {
    return [];
  }

  private generateUserInsights(data: ReferralUserAnalytics): string[] {
    return [];
  }

  private generateUserRecommendations(data: ReferralUserAnalytics): string[] {
    return [];
  }

  private generateSystemInsights(data: ReferralSystemMetrics): string[] {
    return [];
  }

  private generateSystemRecommendations(data: ReferralSystemMetrics): string[] {
    return [];
  }

  private generateFinancialInsights(data: any): string[] {
    return [];
  }

  private generateFinancialRecommendations(data: any): string[] {
    return [];
  }
}

export const referralAnalyticsService = new ReferralAnalyticsService();
