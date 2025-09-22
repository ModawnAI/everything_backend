/**
 * Point Validation Service
 * 
 * Comprehensive validation for point operations using v3.2 policies:
 * - Transaction amount validation
 * - Point earning eligibility checks
 * - Point redemption validation
 * - Daily and monthly limits enforcement
 * - Influencer status validation
 * - Business rule compliance
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  POINT_POLICY_V32,
  POINT_VALIDATION_RULES,
  POINT_CALCULATIONS
} from '../constants/point-policies';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  metadata?: Record<string, any>;
}

export interface PointEarningValidation extends ValidationResult {
  eligibleAmount: number;
  calculatedPoints: number;
  appliedBonuses: {
    influencer: number;
    tier: number;
    special: number;
  };
}

export interface PointRedemptionValidation extends ValidationResult {
  maxRedeemablePoints: number;
  maxRedeemableAmount: number;
  availableBalance: number;
}

export interface DailyLimitValidation extends ValidationResult {
  currentDailyEarnings: number;
  remainingDailyLimit: number;
  currentMonthlyEarnings: number;
  remainingMonthlyLimit: number;
}

export class PointValidationService {
  private supabase = getSupabaseClient();

  /**
   * Validate point earning transaction
   */
  async validatePointEarning(
    userId: string,
    transactionAmount: number,
    isInfluencer: boolean = false
  ): Promise<PointEarningValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Basic amount validation
      if (!POINT_VALIDATION_RULES.validateEligibleAmount(transactionAmount)) {
        errors.push(`Transaction amount ${transactionAmount} is below minimum ${POINT_POLICY_V32.MIN_TRANSACTION_AMOUNT} KRW`);
      }

      // Check daily limits
      const dailyLimitCheck = await this.validateDailyLimits(userId);
      if (!dailyLimitCheck.isValid) {
        errors.push(...dailyLimitCheck.errors);
        warnings.push(...dailyLimitCheck.warnings);
      }

      // Calculate eligible amount and points
      const eligibleAmount = Math.min(transactionAmount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT);
      if (eligibleAmount < transactionAmount) {
        warnings.push(`Transaction amount capped at ${POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT} KRW for point calculation`);
      }

      // Get user tier for calculations
      const userTotalPoints = await this.getUserTotalPointsEarned(userId);
      const tierMultiplier = POINT_CALCULATIONS.getTierMultiplier(userTotalPoints);

      // Calculate points with bonuses
      const basePoints = Math.floor(eligibleAmount * POINT_POLICY_V32.EARNING_RATE);
      const influencerBonus = isInfluencer ? Math.floor(basePoints * (POINT_POLICY_V32.INFLUENCER_MULTIPLIER - 1)) : 0;
      const tierBonus = Math.floor(basePoints * (tierMultiplier - 1));
      const calculatedPoints = basePoints + influencerBonus + tierBonus;

      // Check if calculated points would exceed daily limit
      if (dailyLimitCheck.isValid && calculatedPoints > dailyLimitCheck.remainingDailyLimit) {
        errors.push(`Calculated points ${calculatedPoints} would exceed daily limit. Remaining: ${dailyLimitCheck.remainingDailyLimit}`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        eligibleAmount,
        calculatedPoints,
        appliedBonuses: {
          influencer: influencerBonus,
          tier: tierBonus,
          special: 0 // Could be extended for special promotions
        },
        metadata: {
          transactionAmount,
          basePoints,
          tierMultiplier,
          userTier: POINT_CALCULATIONS.getUserTier(userTotalPoints),
          isInfluencer,
          policyVersion: 'v3.2'
        }
      };

    } catch (error) {
      logger.error('Error validating point earning', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        transactionAmount
      });

      return {
        isValid: false,
        errors: ['Validation service error'],
        warnings: [],
        eligibleAmount: 0,
        calculatedPoints: 0,
        appliedBonuses: { influencer: 0, tier: 0, special: 0 }
      };
    }
  }

  /**
   * Validate point redemption
   */
  async validatePointRedemption(
    userId: string,
    pointsToRedeem: number,
    paymentAmount: number
  ): Promise<PointRedemptionValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get user's available balance
      const availableBalance = await this.getUserAvailablePoints(userId);

      // Basic redemption validation
      if (pointsToRedeem < POINT_POLICY_V32.MIN_REDEMPTION_AMOUNT) {
        errors.push(`Minimum redemption amount is ${POINT_POLICY_V32.MIN_REDEMPTION_AMOUNT} points`);
      }

      if (pointsToRedeem > availableBalance) {
        errors.push(`Insufficient points. Available: ${availableBalance}, Requested: ${pointsToRedeem}`);
      }

      // Calculate maximum redeemable amount based on payment
      const maxRedeemableAmount = paymentAmount * (POINT_POLICY_V32.MAX_REDEMPTION_PERCENTAGE / 100);
      const maxRedeemablePoints = Math.floor(maxRedeemableAmount / POINT_POLICY_V32.POINT_TO_KRW_RATIO);

      if (pointsToRedeem > maxRedeemablePoints) {
        errors.push(`Cannot redeem more than ${POINT_POLICY_V32.MAX_REDEMPTION_PERCENTAGE}% of payment amount. Max redeemable: ${maxRedeemablePoints} points`);
      }

      // Warnings for large redemptions
      if (pointsToRedeem > availableBalance * 0.8) {
        warnings.push('Redeeming more than 80% of available points');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        maxRedeemablePoints,
        maxRedeemableAmount,
        availableBalance,
        metadata: {
          pointsToRedeem,
          paymentAmount,
          redemptionPercentage: (pointsToRedeem / paymentAmount) * 100,
          policyVersion: 'v3.2'
        }
      };

    } catch (error) {
      logger.error('Error validating point redemption', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        pointsToRedeem,
        paymentAmount
      });

      return {
        isValid: false,
        errors: ['Validation service error'],
        warnings: [],
        maxRedeemablePoints: 0,
        maxRedeemableAmount: 0,
        availableBalance: 0
      };
    }
  }

  /**
   * Validate daily and monthly limits
   */
  async validateDailyLimits(userId: string): Promise<DailyLimitValidation> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Get current daily earnings
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const { data: dailyTransactions, error: dailyError } = await this.supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('created_at', today.toISOString())
        .lt('created_at', tomorrow.toISOString())
        .gt('amount', 0);

      if (dailyError) {
        throw new Error(`Failed to get daily transactions: ${dailyError.message}`);
      }

      const currentDailyEarnings = dailyTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const remainingDailyLimit = Math.max(0, POINT_POLICY_V32.MAX_DAILY_EARNING_LIMIT - currentDailyEarnings);

      // Get current monthly earnings
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
      const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 1);

      const { data: monthlyTransactions, error: monthlyError } = await this.supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', userId)
        .gte('created_at', monthStart.toISOString())
        .lt('created_at', monthEnd.toISOString())
        .gt('amount', 0);

      if (monthlyError) {
        throw new Error(`Failed to get monthly transactions: ${monthlyError.message}`);
      }

      const currentMonthlyEarnings = monthlyTransactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      const remainingMonthlyLimit = Math.max(0, POINT_POLICY_V32.MAX_MONTHLY_EARNING_LIMIT - currentMonthlyEarnings);

      // Check limits
      if (remainingDailyLimit === 0) {
        errors.push(`Daily earning limit of ${POINT_POLICY_V32.MAX_DAILY_EARNING_LIMIT} points reached`);
      } else if (remainingDailyLimit < POINT_POLICY_V32.MAX_DAILY_EARNING_LIMIT * 0.1) {
        warnings.push(`Approaching daily limit. Remaining: ${remainingDailyLimit} points`);
      }

      if (remainingMonthlyLimit === 0) {
        errors.push(`Monthly earning limit of ${POINT_POLICY_V32.MAX_MONTHLY_EARNING_LIMIT} points reached`);
      } else if (remainingMonthlyLimit < POINT_POLICY_V32.MAX_MONTHLY_EARNING_LIMIT * 0.1) {
        warnings.push(`Approaching monthly limit. Remaining: ${remainingMonthlyLimit} points`);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        currentDailyEarnings,
        remainingDailyLimit,
        currentMonthlyEarnings,
        remainingMonthlyLimit,
        metadata: {
          dailyLimit: POINT_POLICY_V32.MAX_DAILY_EARNING_LIMIT,
          monthlyLimit: POINT_POLICY_V32.MAX_MONTHLY_EARNING_LIMIT,
          policyVersion: 'v3.2'
        }
      };

    } catch (error) {
      logger.error('Error validating daily limits', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });

      return {
        isValid: false,
        errors: ['Limit validation service error'],
        warnings: [],
        currentDailyEarnings: 0,
        remainingDailyLimit: 0,
        currentMonthlyEarnings: 0,
        remainingMonthlyLimit: 0
      };
    }
  }

  /**
   * Validate influencer status
   */
  async validateInfluencerStatus(
    userId: string,
    followers: number,
    engagementRate: number
  ): Promise<ValidationResult> {
    try {
      const errors: string[] = [];
      const warnings: string[] = [];

      // Check follower count
      if (followers < POINT_POLICY_V32.INFLUENCER_MIN_FOLLOWERS) {
        errors.push(`Minimum ${POINT_POLICY_V32.INFLUENCER_MIN_FOLLOWERS} followers required. Current: ${followers}`);
      }

      // Check engagement rate
      if (engagementRate < POINT_POLICY_V32.INFLUENCER_MIN_ENGAGEMENT) {
        errors.push(`Minimum ${POINT_POLICY_V32.INFLUENCER_MIN_ENGAGEMENT * 100}% engagement rate required. Current: ${(engagementRate * 100).toFixed(1)}%`);
      }

      // Warnings for borderline cases
      if (followers < POINT_POLICY_V32.INFLUENCER_MIN_FOLLOWERS * 1.2) {
        warnings.push('Follower count is close to minimum requirement');
      }

      if (engagementRate < POINT_POLICY_V32.INFLUENCER_MIN_ENGAGEMENT * 1.2) {
        warnings.push('Engagement rate is close to minimum requirement');
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
        metadata: {
          followers,
          engagementRate,
          minFollowers: POINT_POLICY_V32.INFLUENCER_MIN_FOLLOWERS,
          minEngagement: POINT_POLICY_V32.INFLUENCER_MIN_ENGAGEMENT,
          influencerMultiplier: POINT_POLICY_V32.INFLUENCER_MULTIPLIER,
          policyVersion: 'v3.2'
        }
      };

    } catch (error) {
      logger.error('Error validating influencer status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        followers,
        engagementRate
      });

      return {
        isValid: false,
        errors: ['Influencer validation service error'],
        warnings: []
      };
    }
  }

  /**
   * Get comprehensive validation summary for user
   */
  async getUserValidationSummary(userId: string): Promise<{
    user: {
      totalPointsEarned: number;
      availablePoints: number;
      tier: string;
      isInfluencer: boolean;
    };
    limits: DailyLimitValidation;
    policies: {
      version: string;
      earningRate: number;
      maxEligibleAmount: number;
      influencerMultiplier: number;
      availabilityDelayDays: number;
    };
  }> {
    const totalPointsEarned = await this.getUserTotalPointsEarned(userId);
    const availablePoints = await this.getUserAvailablePoints(userId);
    const limits = await this.validateDailyLimits(userId);
    
    // Get user info for influencer status
    const { data: user } = await this.supabase
      .from('users')
      .select('is_influencer')
      .eq('id', userId)
      .single();

    return {
      user: {
        totalPointsEarned,
        availablePoints,
        tier: POINT_CALCULATIONS.getUserTier(totalPointsEarned),
        isInfluencer: user?.is_influencer || false
      },
      limits,
      policies: {
        version: 'v3.2',
        earningRate: POINT_POLICY_V32.EARNING_RATE,
        maxEligibleAmount: POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT,
        influencerMultiplier: POINT_POLICY_V32.INFLUENCER_MULTIPLIER,
        availabilityDelayDays: POINT_POLICY_V32.AVAILABILITY_DELAY_DAYS
      }
    };
  }

  // Helper methods
  private async getUserTotalPointsEarned(userId: string): Promise<number> {
    const { data: transactions, error } = await this.supabase
      .from('point_transactions')
      .select('amount')
      .eq('user_id', userId)
      .gt('amount', 0);

    if (error) {
      logger.error('Failed to get user total points earned', { error: error.message, userId });
      return 0;
    }

    return transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
  }

  private async getUserAvailablePoints(userId: string): Promise<number> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('available_points')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to get user available points', { error: error.message, userId });
      return 0;
    }

    return user?.available_points || 0;
  }
}

// Export singleton instance
export const pointValidationService = new PointValidationService();

