/**
 * Enhanced Referral Service
 * 
 * Implements enhanced referral reward calculation system with:
 * - Fair referral rewards based on original payment amounts (10% of base points)
 * - Automatic influencer qualification logic (50 successful referrals)
 * - Referral chain validation to prevent circular references
 * - Referral code generation and validation with collision prevention
 * - Comprehensive referral tracking and analytics
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { pointService } from './point.service';
import { notificationService } from './notification.service';
import { POINT_POLICY_V32, POINT_CALCULATIONS } from '../constants/point-policies';

export interface ReferralRewardCalculation {
  referrerId: string;
  referredId: string;
  originalPaymentAmount: number;
  basePointsEarned: number;
  referralRewardAmount: number;
  referralPercentage: number;
  isInfluencerEligible: boolean;
  totalReferrals: number;
  calculation: {
    basePoints: number;
    referralReward: number;
    beforeInfluencerMultiplier: boolean;
  };
}

export interface InfluencerQualificationResult {
  userId: string;
  wasInfluencer: boolean;
  isNowInfluencer: boolean;
  totalReferrals: number;
  qualificationMet: boolean;
  promotedAt?: string;
  benefits: string[];
}

export interface ReferralChainValidation {
  isValid: boolean;
  hasCircularReference: boolean;
  chainDepth: number;
  chainPath: string[];
  violations: string[];
}

export interface ReferralCodeGeneration {
  code: string;
  isUnique: boolean;
  attempts: number;
  generatedAt: string;
  expiresAt: string;
}

export interface ReferralAnalytics {
  userId: string;
  totalReferrals: number;
  successfulReferrals: number;
  pendingReferrals: number;
  totalRewardsEarned: number;
  averageRewardPerReferral: number;
  conversionRate: number;
  referralsByMonth: Array<{
    month: string;
    count: number;
    rewards: number;
  }>;
  topReferredUsers: Array<{
    userId: string;
    userName: string;
    rewardAmount: number;
    referredAt: string;
  }>;
  influencerStatus: {
    isInfluencer: boolean;
    qualifiedAt?: string;
    referralsNeeded: number;
  };
}

export class EnhancedReferralService {
  private supabase = getSupabaseClient();
  
  // Enhanced referral system constants
  private readonly REFERRAL_REWARD_PERCENTAGE = 0.10; // 10% of base points
  private readonly INFLUENCER_QUALIFICATION_THRESHOLD = 50; // 50 successful referrals
  private readonly MAX_REFERRAL_CHAIN_DEPTH = 10;
  private readonly REFERRAL_CODE_LENGTH = 8;
  private readonly REFERRAL_CODE_EXPIRY_DAYS = 365;
  private readonly MAX_CODE_GENERATION_ATTEMPTS = 10;

  /**
   * Calculate referral reward based on original payment amount (10% of base points, before influencer multiplier)
   */
  async calculateReferralReward(
    referrerId: string,
    referredId: string,
    originalPaymentAmount: number
  ): Promise<ReferralRewardCalculation> {
    try {
      logger.info('Calculating referral reward', {
        referrerId,
        referredId,
        originalPaymentAmount
      });

      // Get referrer information
      const { data: referrer, error: referrerError } = await this.supabase
        .from('users')
        .select('id, is_influencer, total_referrals')
        .eq('id', referrerId)
        .single();

      if (referrerError || !referrer) {
        throw new Error('Referrer not found');
      }

      // Calculate base points that the referred user would earn (before influencer multiplier)
      const basePointsEarned = POINT_CALCULATIONS.calculateServicePoints(
        originalPaymentAmount,
        false, // Don't apply influencer multiplier for base calculation
        1.0    // Don't apply tier multiplier for base calculation
      );

      // Calculate referral reward as 10% of base points
      const referralRewardAmount = Math.floor(basePointsEarned * this.REFERRAL_REWARD_PERCENTAGE);

      // Check if referrer is eligible for influencer status
      const isInfluencerEligible = referrer.total_referrals >= this.INFLUENCER_QUALIFICATION_THRESHOLD;

      const calculation: ReferralRewardCalculation = {
        referrerId,
        referredId,
        originalPaymentAmount,
        basePointsEarned,
        referralRewardAmount,
        referralPercentage: this.REFERRAL_REWARD_PERCENTAGE,
        isInfluencerEligible,
        totalReferrals: referrer.total_referrals || 0,
        calculation: {
          basePoints: basePointsEarned,
          referralReward: referralRewardAmount,
          beforeInfluencerMultiplier: true
        }
      };

      logger.info('Referral reward calculated', {
        referrerId,
        referralRewardAmount,
        basePointsEarned,
        isInfluencerEligible
      });

      return calculation;

    } catch (error) {
      logger.error('Failed to calculate referral reward', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId,
        originalPaymentAmount
      });
      throw error;
    }
  }

  /**
   * Check and automatically promote user to influencer status when reaching 50 successful referrals
   */
  async checkAndPromoteInfluencer(userId: string): Promise<InfluencerQualificationResult> {
    try {
      logger.info('Checking influencer qualification', { userId });

      // Get current user status and referral count
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, is_influencer, total_referrals')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      const wasInfluencer = user.is_influencer || false;

      // Count successful referrals
      const { data: successfulReferrals, error: referralError } = await this.supabase
        .from('referrals')
        .select('id')
        .eq('referrer_id', userId)
        .eq('status', 'completed')
        .eq('bonus_paid', true);

      if (referralError) {
        throw new Error(`Failed to count successful referrals: ${referralError.message}`);
      }

      const totalSuccessfulReferrals = successfulReferrals?.length || 0;

      // Check if user qualifies for influencer status
      const qualificationMet = totalSuccessfulReferrals >= this.INFLUENCER_QUALIFICATION_THRESHOLD;
      const shouldPromote = qualificationMet && !wasInfluencer;

      let promotedAt: string | undefined;
      let isNowInfluencer = wasInfluencer;

      if (shouldPromote) {
        // Promote user to influencer status
        promotedAt = new Date().toISOString();
        
        const { error: updateError } = await this.supabase
          .from('users')
          .update({
            is_influencer: true,
            influencer_qualified_at: promotedAt,
            updated_at: new Date().toISOString()
          })
          .eq('id', userId);

        if (updateError) {
          throw new Error(`Failed to update influencer status: ${updateError.message}`);
        }

        isNowInfluencer = true;

        // Log influencer promotion
        await this.logInfluencerPromotion(userId, totalSuccessfulReferrals);

        logger.info('User promoted to influencer', {
          userId,
          totalSuccessfulReferrals,
          promotedAt
        });
      }

      const result: InfluencerQualificationResult = {
        userId,
        wasInfluencer,
        isNowInfluencer,
        totalReferrals: totalSuccessfulReferrals,
        qualificationMet,
        promotedAt,
        benefits: isNowInfluencer ? [
          '2x point earning multiplier',
          'Exclusive influencer rewards',
          'Priority customer support',
          'Special influencer badge'
        ] : []
      };

      return result;

    } catch (error) {
      logger.error('Failed to check influencer qualification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Validate referral chain to prevent circular references
   */
  async validateReferralChain(referrerId: string, referredId: string): Promise<ReferralChainValidation> {
    try {
      logger.info('Validating referral chain', { referrerId, referredId });

      const chainPath: string[] = [];
      const visited = new Set<string>();
      const violations: string[] = [];
      let hasCircularReference = false;
      let currentUserId = referrerId;
      let depth = 0;

      // Traverse the referral chain upward
      while (currentUserId && depth < this.MAX_REFERRAL_CHAIN_DEPTH) {
        if (visited.has(currentUserId)) {
          hasCircularReference = true;
          violations.push(`Circular reference detected at user ${currentUserId}`);
          break;
        }

        visited.add(currentUserId);
        chainPath.push(currentUserId);

        // Check if current user is the one being referred (would create a circle)
        if (currentUserId === referredId) {
          hasCircularReference = true;
          violations.push(`User ${referredId} cannot be referred by someone in their referral chain`);
          break;
        }

        // Get the referrer of the current user
        const { data: referral, error } = await this.supabase
          .from('referrals')
          .select('referrer_id')
          .eq('referred_id', currentUserId)
          .eq('status', 'completed')
          .single();

        if (error || !referral) {
          // No more referrers in the chain
          break;
        }

        currentUserId = referral.referrer_id;
        depth++;
      }

      // Check for maximum chain depth violation
      if (depth >= this.MAX_REFERRAL_CHAIN_DEPTH) {
        violations.push(`Referral chain exceeds maximum depth of ${this.MAX_REFERRAL_CHAIN_DEPTH}`);
      }

      const isValid = !hasCircularReference && violations.length === 0;

      const validation: ReferralChainValidation = {
        isValid,
        hasCircularReference,
        chainDepth: depth,
        chainPath,
        violations
      };

      logger.info('Referral chain validation completed', {
        referrerId,
        referredId,
        isValid,
        chainDepth: depth,
        violations: violations.length
      });

      return validation;

    } catch (error) {
      logger.error('Failed to validate referral chain', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId
      });
      throw error;
    }
  }

  /**
   * Generate unique referral code with collision prevention
   */
  async generateReferralCode(userId: string): Promise<ReferralCodeGeneration> {
    try {
      logger.info('Generating referral code', { userId });

      let attempts = 0;
      let code = '';
      let isUnique = false;

      while (attempts < this.MAX_CODE_GENERATION_ATTEMPTS && !isUnique) {
        attempts++;
        
        // Generate random alphanumeric code
        code = this.generateRandomCode();

        // Check for collision
        const { data: existingCode, error } = await this.supabase
          .from('referral_codes')
          .select('id')
          .eq('code', code)
          .single();

        if (error && error.code === 'PGRST116') {
          // No existing code found, this is unique
          isUnique = true;
        } else if (existingCode) {
          // Code already exists, try again
          logger.debug('Referral code collision detected, generating new code', {
            code,
            attempt: attempts
          });
        } else {
          throw new Error(`Database error checking code uniqueness: ${error?.message}`);
        }
      }

      if (!isUnique) {
        throw new Error(`Failed to generate unique referral code after ${this.MAX_CODE_GENERATION_ATTEMPTS} attempts`);
      }

      const generatedAt = new Date().toISOString();
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + this.REFERRAL_CODE_EXPIRY_DAYS);

      // Store the generated code in referral_codes table
      const { error: insertError } = await this.supabase
        .from('referral_codes')
        .insert({
          user_id: userId,
          code,
          generated_at: generatedAt,
          expires_at: expiresAt.toISOString(),
          is_active: true
        });

      if (insertError) {
        throw new Error(`Failed to store referral code: ${insertError.message}`);
      }

      // ✅ CRITICAL FIX: Update users table with the referral code
      // This ensures subsequent queries to users.referral_code return the code
      const { error: updateError } = await this.supabase
        .from('users')
        .update({ referral_code: code })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update user referral_code, but code is stored in referral_codes table', {
          userId,
          code,
          error: updateError.message
        });
        // Don't throw - code is already saved in referral_codes table
      } else {
        logger.info('User referral_code updated successfully', { userId, code });
      }

      const result: ReferralCodeGeneration = {
        code,
        isUnique,
        attempts,
        generatedAt,
        expiresAt: expiresAt.toISOString()
      };

      logger.info('Referral code generated successfully', {
        userId,
        code,
        attempts
      });

      return result;

    } catch (error) {
      logger.error('Failed to generate referral code', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get comprehensive referral analytics for a user
   */
  async getReferralAnalytics(userId: string): Promise<ReferralAnalytics> {
    try {
      logger.info('Getting referral analytics', { userId });

      // Get user information
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('id, is_influencer, influencer_qualified_at, total_referrals')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('User not found');
      }

      // Get all referrals by this user
      const { data: referrals, error: referralsError } = await this.supabase
        .from('referrals')
        .select(`
          id,
          referred_id,
          status,
          bonus_amount,
          bonus_paid,
          created_at,
          users!referrals_referred_id_fkey(name)
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (referralsError) {
        throw new Error(`Failed to fetch referrals: ${referralsError.message}`);
      }

      const totalReferrals = referrals?.length || 0;
      const successfulReferrals = referrals?.filter(r => r.status === 'completed' && r.bonus_paid).length || 0;
      const pendingReferrals = referrals?.filter(r => r.status === 'pending').length || 0;

      // Calculate total rewards earned
      const totalRewardsEarned = referrals
        ?.filter(r => r.bonus_paid)
        .reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0;

      const averageRewardPerReferral = successfulReferrals > 0 ? totalRewardsEarned / successfulReferrals : 0;
      const conversionRate = totalReferrals > 0 ? (successfulReferrals / totalReferrals) * 100 : 0;

      // Group referrals by month
      const referralsByMonth = this.groupReferralsByMonth(referrals || []);

      // Get top referred users
      const topReferredUsers = (referrals || [])
        .filter(r => r.bonus_paid && r.users)
        .sort((a, b) => (b.bonus_amount || 0) - (a.bonus_amount || 0))
        .slice(0, 10)
        .map(r => ({
          userId: r.referred_id,
          userName: Array.isArray(r.users) ? (r.users[0] as any)?.name || 'Unknown' : (r.users as any)?.name || 'Unknown',
          rewardAmount: r.bonus_amount || 0,
          referredAt: r.created_at
        }));

      // Calculate referrals needed for influencer status
      const referralsNeeded = Math.max(0, this.INFLUENCER_QUALIFICATION_THRESHOLD - successfulReferrals);

      const analytics: ReferralAnalytics = {
        userId,
        totalReferrals,
        successfulReferrals,
        pendingReferrals,
        totalRewardsEarned,
        averageRewardPerReferral,
        conversionRate,
        referralsByMonth,
        topReferredUsers,
        influencerStatus: {
          isInfluencer: user.is_influencer || false,
          qualifiedAt: user.influencer_qualified_at,
          referralsNeeded
        }
      };

      logger.info('Referral analytics generated', {
        userId,
        totalReferrals,
        successfulReferrals,
        totalRewardsEarned
      });

      return analytics;

    } catch (error) {
      logger.error('Failed to get referral analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Process referral reward payout with enhanced calculation
   * @param referrerId - User who made the referral
   * @param referredId - User who was referred
   * @param originalPaymentAmount - Amount of the payment
   * @param reservationId - Associated reservation ID
   * @param paymentId - Payment that triggered the commission (NEW - fixes points mismatch bug)
   */
  async processReferralReward(
    referrerId: string,
    referredId: string,
    originalPaymentAmount: number,
    reservationId?: string,
    paymentId?: string
  ): Promise<void> {
    try {
      logger.info('Processing referral reward', {
        referrerId,
        referredId,
        originalPaymentAmount,
        reservationId,
        paymentId
      });

      // Validate referral chain
      const chainValidation = await this.validateReferralChain(referrerId, referredId);
      if (!chainValidation.isValid) {
        throw new Error(`Invalid referral chain: ${chainValidation.violations.join(', ')}`);
      }

      // Calculate referral reward
      const rewardCalculation = await this.calculateReferralReward(
        referrerId,
        referredId,
        originalPaymentAmount
      );

      // Award points to referrer with payment tracking
      await pointService.addPoints(
        referrerId,
        rewardCalculation.referralRewardAmount,
        'earned',
        'referral',
        `추천 보상: ${rewardCalculation.referralRewardAmount}포인트`,
        {
          reservationId,
          paymentId,
          relatedUserId: referredId
        }
      );

      // Get the referred user's nickname for notification
      const { data: referredUser } = await this.supabase
        .from('users')
        .select('name, nickname')
        .eq('id', referredId)
        .single();

      const friendNickname = referredUser?.nickname || referredUser?.name || '친구';

      // Send push notification to referrer
      await notificationService.sendReferralPointNotification(
        referrerId,
        friendNickname,
        rewardCalculation.referralRewardAmount
      );

      logger.info('Referral point notification sent', {
        referrerId,
        friendNickname,
        pointsEarned: rewardCalculation.referralRewardAmount
      });

      // Check and promote to influencer if qualified
      const influencerResult = await this.checkAndPromoteInfluencer(referrerId);
      if (influencerResult.isNowInfluencer && !influencerResult.wasInfluencer) {
        logger.info('User promoted to influencer through referral reward processing', {
          userId: referrerId,
          totalReferrals: influencerResult.totalReferrals
        });
      }

      // Update referral record
      await this.supabase
        .from('referrals')
        .update({
          status: 'completed',
          bonus_paid: true,
          bonus_amount: rewardCalculation.referralRewardAmount,
          updated_at: new Date().toISOString()
        })
        .eq('referrer_id', referrerId)
        .eq('referred_id', referredId);

      logger.info('Referral reward processed successfully', {
        referrerId,
        referredId,
        rewardAmount: rewardCalculation.referralRewardAmount,
        influencerPromoted: influencerResult.isNowInfluencer && !influencerResult.wasInfluencer
      });

    } catch (error) {
      logger.error('Failed to process referral reward', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referrerId,
        referredId,
        originalPaymentAmount
      });
      throw error;
    }
  }

  /**
   * Private helper methods
   */

  private generateRandomCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < this.REFERRAL_CODE_LENGTH; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private async logInfluencerPromotion(userId: string, totalReferrals: number): Promise<void> {
    try {
      await this.supabase
        .from('influencer_promotions')
        .insert({
          user_id: userId,
          promoted_at: new Date().toISOString(),
          referral_count_at_promotion: totalReferrals,
          promotion_reason: 'referral_threshold_met'
        });
    } catch (error) {
      logger.error('Failed to log influencer promotion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
    }
  }

  private groupReferralsByMonth(referrals: any[]): Array<{ month: string; count: number; rewards: number }> {
    const monthlyData: { [key: string]: { count: number; rewards: number } } = {};

    referrals.forEach(referral => {
      const date = new Date(referral.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { count: 0, rewards: 0 };
      }

      monthlyData[monthKey].count++;
      if (referral.bonus_paid) {
        monthlyData[monthKey].rewards += referral.bonus_amount || 0;
      }
    });

    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        count: data.count,
        rewards: data.rewards
      }))
      .sort((a, b) => b.month.localeCompare(a.month))
      .slice(0, 12); // Last 12 months
  }
}

export const enhancedReferralService = new EnhancedReferralService();

