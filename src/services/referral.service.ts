/**
 * Referral Service
 * 
 * Handles referral code generation, tracking, bonus calculation,
 * and referral history management
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { referralRelationshipService } from './referral-relationship.service';
import { enhancedReferralService } from './enhanced-referral.service';
import {
  ReferralRecord,
  ReferralStatus,
  BonusType,
  ReferralStats,
  ReferralHistoryItem,
  CreateReferralRequest,
  UpdateReferralStatusRequest,
  ReferralBonusPayoutRequest,
  ReferralSystemConfig,
  ReferralAnalytics,
  ReferralError,
  ReferralCodeNotFoundError,
  ReferralCodeExpiredError,
  ReferralLimitExceededError,
  ReferralBonusPayoutError,
  ReferralValidationError
} from '../types/referral.types';

/**
 * Default referral system configuration
 */
const defaultReferralConfig: ReferralSystemConfig = {
  defaultBonusType: 'points',
  defaultBonusAmount: 1000, // 1000 points
  referralValidityDays: 30,
  maxReferralsPerUser: 50,
  minimumRequirements: ['profile_complete', 'phone_verified'],
  autoPayoutEnabled: false,
  payoutThreshold: 5000 // 5000 points minimum for payout
};

/**
 * Referral Service Implementation
 */
class ReferralServiceImpl {
  private supabase = getSupabaseClient();

  /**
   * Create a new referral record with enhanced relationship tracking
   */
  async createReferral(request: CreateReferralRequest): Promise<ReferralRecord> {
    try {
      logger.info('Creating referral record', {
        referrerId: request.referrerId,
        referredId: request.referredId,
        referralCode: request.referralCode
      });

      // Use the enhanced relationship service for validation
      const relationshipValidation = await referralRelationshipService.validateReferralEligibility(
        request.referrerId,
        request.referredId
      );

      if (!relationshipValidation.canRefer) {
        throw new ReferralValidationError(
          'referralEligibility', 
          relationshipValidation.reason || 'Cannot create referral relationship'
        );
      }

      // Validate referrer exists and is active
      const { data: referrer, error: referrerError } = await this.supabase
        .from('users')
        .select('id, user_status, total_referrals')
        .eq('id', request.referrerId)
        .single();

      if (referrerError || !referrer) {
        throw new ReferralValidationError('referrerId', '추천인을 찾을 수 없습니다.');
      }

      if (referrer.user_status !== 'active') {
        throw new ReferralValidationError('referrerId', '비활성화된 사용자는 추천할 수 없습니다.');
      }

      // Check referral limit
      if (defaultReferralConfig.maxReferralsPerUser && 
          referrer.total_referrals >= defaultReferralConfig.maxReferralsPerUser) {
        throw new ReferralLimitExceededError(request.referrerId, defaultReferralConfig.maxReferralsPerUser);
      }

      // Validate referred user exists
      const { data: referred, error: referredError } = await this.supabase
        .from('users')
        .select('id, user_status')
        .eq('id', request.referredId)
        .single();

      if (referredError || !referred) {
        throw new ReferralValidationError('referredId', '추천받은 사용자를 찾을 수 없습니다.');
      }

      // Check if referral already exists
      const { data: existingReferral, error: existingError } = await this.supabase
        .from('referrals')
        .select('id')
        .eq('referred_id', request.referredId)
        .single();

      if (existingReferral) {
        throw new ReferralValidationError('referredId', '이미 추천받은 사용자입니다.');
      }

      // Calculate bonus amount
      const bonusAmount = request.bonusAmount || defaultReferralConfig.defaultBonusAmount;
      const bonusType = request.bonusType || defaultReferralConfig.defaultBonusType;

      // Set expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + defaultReferralConfig.referralValidityDays);

      // Create referral record
      const referralRecord: Omit<ReferralRecord, 'id'> = {
        referrer_id: request.referrerId,
        referred_id: request.referredId,
        referral_code: request.referralCode,
        status: 'pending',
        bonus_amount: bonusAmount,
        bonus_type: bonusType,
        bonus_paid: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        expires_at: expiresAt.toISOString(),
        ...(request.notes && { notes: request.notes })
      };

      const { data: newReferral, error: createError } = await this.supabase
        .from('referrals')
        .insert(referralRecord)
        .select()
        .single();

      if (createError) {
        throw new ReferralError(
          '추천 기록 생성에 실패했습니다.',
          'REFERRAL_CREATION_FAILED',
          500
        );
      }

      // Create referral relationship for tracking
      try {
        await referralRelationshipService.createReferralRelationship(
          request.referrerId,
          request.referredId,
          request.referralCode
        );
        logger.info('Referral relationship created', {
          referrerId: request.referrerId,
          referredId: request.referredId
        });
      } catch (relationshipError) {
        // If relationship creation fails, we should rollback the referral record
        logger.error('Failed to create referral relationship, rolling back referral record', {
          error: relationshipError instanceof Error ? relationshipError.message : 'Unknown error',
          referralId: newReferral.id
        });
        
        // Rollback the referral record
        await this.supabase
          .from('referrals')
          .delete()
          .eq('id', newReferral.id);
        
        throw new ReferralError(
          'Failed to create referral relationship',
          'RELATIONSHIP_CREATION_FAILED',
          500
        );
      }

      // Update referrer's total referrals count
      await this.incrementReferralCount(request.referrerId);

      logger.info('Referral record created successfully', {
        referralId: newReferral.id,
        referrerId: request.referrerId,
        referredId: request.referredId
      });

      return newReferral;

    } catch (error) {
      logger.error('Failed to create referral record', {
        referrerId: request.referrerId,
        referredId: request.referredId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ReferralError) {
        throw error;
      }

      throw new ReferralError(
        '추천 기록 생성 중 오류가 발생했습니다.',
        'REFERRAL_CREATION_ERROR',
        500
      );
    }
  }

  /**
   * Update referral status
   */
  async updateReferralStatus(request: UpdateReferralStatusRequest): Promise<ReferralRecord> {
    try {
      logger.info('Updating referral status', {
        referralId: request.referralId,
        status: request.status
      });

      const updateData: Partial<ReferralRecord> = {
        status: request.status,
        updated_at: new Date().toISOString(),
        ...(request.notes && { notes: request.notes })
      };

      // Set completion date if status is completed
      if (request.status === 'completed') {
        updateData.completed_at = new Date().toISOString();
      }

      const { data: updatedReferral, error } = await this.supabase
        .from('referrals')
        .update(updateData)
        .eq('id', request.referralId)
        .select()
        .single();

      if (error || !updatedReferral) {
        throw new ReferralError(
          '추천 상태 업데이트에 실패했습니다.',
          'REFERRAL_UPDATE_FAILED',
          500
        );
      }

      // If status is completed, process bonus payout
      if (request.status === 'completed') {
        await this.processBonusPayout(updatedReferral);
      }

      logger.info('Referral status updated successfully', {
        referralId: request.referralId,
        status: request.status
      });

      return updatedReferral;

    } catch (error) {
      logger.error('Failed to update referral status', {
        referralId: request.referralId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ReferralError) {
        throw error;
      }

      throw new ReferralError(
        '추천 상태 업데이트 중 오류가 발생했습니다.',
        'REFERRAL_UPDATE_ERROR',
        500
      );
    }
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<ReferralStats> {
    try {
      // Get user's referral code
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('referral_code, total_referrals')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new ReferralValidationError('userId', '사용자를 찾을 수 없습니다.');
      }

      // Get referral statistics
      const { data: referrals, error: referralsError } = await this.supabase
        .from('referrals')
        .select('status, bonus_amount, bonus_paid, created_at, completed_at')
        .eq('referrer_id', userId);

      if (referralsError) {
        throw new ReferralError(
          '추천 통계 조회에 실패했습니다.',
          'REFERRAL_STATS_ERROR',
          500
        );
      }

      const stats: ReferralStats = {
        totalReferrals: referrals?.length || 0,
        completedReferrals: referrals?.filter(r => r.status === 'completed').length || 0,
        pendingReferrals: referrals?.filter(r => r.status === 'pending').length || 0,
        totalBonusEarned: referrals?.reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0,
        totalBonusPaid: referrals?.filter(r => r.bonus_paid).reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0,
        referralCode: user.referral_code || '',
        lastReferralDate: referrals?.length ? referrals[referrals.length - 1]?.created_at : undefined,
        ...(this.calculateAverageCompletionTime(referrals || []) && { 
          averageCompletionTime: this.calculateAverageCompletionTime(referrals || []) 
        })
      };

      return stats;

    } catch (error) {
      logger.error('Failed to get referral stats', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ReferralError) {
        throw error;
      }

      throw new ReferralError(
        '추천 통계 조회 중 오류가 발생했습니다.',
        'REFERRAL_STATS_ERROR',
        500
      );
    }
  }

  /**
   * Get referral history for a user
   */
  async getReferralHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{ referrals: ReferralHistoryItem[]; pagination: any }> {
    try {
      const offset = (page - 1) * limit;

      // Get total count
      const { count, error: countError } = await this.supabase
        .from('referrals')
        .select('*', { count: 'exact', head: true })
        .eq('referrer_id', userId);

      if (countError) {
        throw new ReferralError(
          '추천 기록 수 조회에 실패했습니다.',
          'REFERRAL_COUNT_ERROR',
          500
        );
      }

      // Get referral records with referred user info
      const { data: referrals, error: referralsError } = await this.supabase
        .from('referrals')
        .select(`
          id,
          status,
          bonus_amount,
          bonus_type,
          bonus_paid,
          bonus_paid_at,
          created_at,
          completed_at,
          expires_at,
          referred_users!inner(
            id,
            name,
            email,
            phone_number
          )
        `)
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (referralsError) {
        throw new ReferralError(
          '추천 기록 조회에 실패했습니다.',
          'REFERRAL_HISTORY_ERROR',
          500
        );
      }

      const referralHistory: ReferralHistoryItem[] = (referrals || []).map(ref => ({
        id: ref.id,
        referredUser: {
          id: ref.referred_users[0]?.id,
          name: ref.referred_users[0]?.name,
          email: ref.referred_users[0]?.email,
          phone: ref.referred_users[0]?.phone_number,
          joinedAt: ref.created_at
        },
        status: ref.status,
        bonusAmount: ref.bonus_amount,
        bonusType: ref.bonus_type,
        bonusPaid: ref.bonus_paid,
        bonusPaidAt: ref.bonus_paid_at,
        createdAt: ref.created_at,
        completedAt: ref.completed_at,
        expiresAt: ref.expires_at
      }));

      const pagination = {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      };

      return { referrals: referralHistory, pagination };

    } catch (error) {
      logger.error('Failed to get referral history', {
        userId,
        page,
        limit,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ReferralError) {
        throw error;
      }

      throw new ReferralError(
        '추천 기록 조회 중 오류가 발생했습니다.',
        'REFERRAL_HISTORY_ERROR',
        500
      );
    }
  }

  /**
   * Process bonus payout for completed referral
   */
  private async processBonusPayout(referral: ReferralRecord): Promise<void> {
    try {
      if (referral.bonus_paid) {
        return; // Already paid
      }

      // Check if auto-payout is enabled
      if (!defaultReferralConfig.autoPayoutEnabled) {
        logger.info('Auto-payout disabled, manual payout required', {
          referralId: referral.id
        });
        return;
      }

      // Check payout threshold
      if (referral.bonus_amount < defaultReferralConfig.payoutThreshold) {
        logger.info('Bonus amount below payout threshold', {
          referralId: referral.id,
          bonusAmount: referral.bonus_amount,
          threshold: defaultReferralConfig.payoutThreshold
        });
        return;
      }

      // Process payout based on bonus type
      if (referral.bonus_type === 'points') {
        await this.payoutPoints(referral);
      } else if (referral.bonus_type === 'cash') {
        await this.payoutCash(referral);
      }

      // Mark as paid
      await this.supabase
        .from('referrals')
        .update({
          bonus_paid: true,
          bonus_paid_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', referral.id);

      logger.info('Bonus payout processed successfully', {
        referralId: referral.id,
        bonusAmount: referral.bonus_amount,
        bonusType: referral.bonus_type
      });

    } catch (error) {
      logger.error('Failed to process bonus payout', {
        referralId: referral.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw new ReferralBonusPayoutError(
        referral.id,
        error instanceof Error ? error.message : 'Unknown error'
      );
    }
  }

  /**
   * Payout points to user
   */
  private async payoutPoints(referral: ReferralRecord): Promise<void> {
    // Add points to user's account
    const { error } = await this.supabase
      .from('users')
      .update({
        points: this.supabase.rpc('increment_points', { 
          user_id: referral.referrer_id, 
          points: referral.bonus_amount 
        }),
        updated_at: new Date().toISOString()
      })
      .eq('id', referral.referrer_id);

    if (error) {
      throw new ReferralBonusPayoutError(
        referral.id,
        '포인트 지급에 실패했습니다.'
      );
    }
  }

  /**
   * Payout cash to user (placeholder implementation)
   */
  private async payoutCash(referral: ReferralRecord): Promise<void> {
    // TODO: Implement cash payout logic
    // This would typically integrate with a payment processor
    logger.info('Cash payout requested (not implemented)', {
      referralId: referral.id,
      amount: referral.bonus_amount
    });
  }

  /**
   * Increment referral count for user
   */
  private async incrementReferralCount(userId: string): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('users')
        .update({
          total_referrals: this.supabase.rpc('increment_referrals', { user_id: userId }),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.warn('Failed to increment referral count', {
          userId,
          error: error.message
        });
      }
    } catch (error) {
      logger.warn('Error incrementing referral count', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Calculate average completion time for referrals
   */
  private calculateAverageCompletionTime(referrals: any[]): number | undefined {
    const completedReferrals = referrals.filter(r => 
      r.status === 'completed' && r.created_at && r.completed_at
    );

    if (completedReferrals.length === 0) {
      return undefined;
    }

    const totalDays = completedReferrals.reduce((sum, ref) => {
      const created = new Date(ref.created_at);
      const completed = new Date(ref.completed_at);
      const days = (completed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return sum + days;
    }, 0);

    return Math.round(totalDays / completedReferrals.length);
  }

  /**
   * Get referral analytics for admin dashboard
   */
  async getReferralAnalytics(): Promise<ReferralAnalytics> {
    try {
      // Get overall statistics
      const { data: referrals, error: referralsError } = await this.supabase
        .from('referrals')
        .select('*');

      if (referralsError) {
        throw new ReferralError(
          '추천 분석 데이터 조회에 실패했습니다.',
          'REFERRAL_ANALYTICS_ERROR',
          500
        );
      }

      const totalReferrals = referrals?.length || 0;
      const completedReferrals = referrals?.filter(r => r.status === 'completed').length || 0;
      const conversionRate = totalReferrals > 0 ? (completedReferrals / totalReferrals) * 100 : 0;
      const totalBonusPaid = referrals?.filter(r => r.bonus_paid).reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0;
      const averageBonusAmount = totalReferrals > 0 ? 
        (referrals?.reduce((sum, r) => sum + (r.bonus_amount || 0), 0) || 0) / totalReferrals : 0;

      // Get top referrers
      const { data: topReferrers, error: topReferrersError } = await this.supabase
        .from('users')
        .select('id, name, total_referrals')
        .not('total_referrals', 'is', null)
        .order('total_referrals', { ascending: false })
        .limit(10);

      if (topReferrersError) {
        throw new ReferralError(
          '상위 추천인 조회에 실패했습니다.',
          'TOP_REFERRERS_ERROR',
          500
        );
      }

      const analytics: ReferralAnalytics = {
        totalReferrals,
        conversionRate: Math.round(conversionRate * 100) / 100,
        averageBonusAmount: Math.round(averageBonusAmount),
        totalBonusPaid,
        topReferrers: (topReferrers || []).map(user => ({
          userId: user.id,
          name: user.name,
          totalReferrals: user.total_referrals || 0,
          totalBonusEarned: 0 // TODO: Calculate from referrals table
        })),
        monthlyStats: [] // TODO: Implement monthly statistics
      };

      return analytics;

    } catch (error) {
      logger.error('Failed to get referral analytics', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      if (error instanceof ReferralError) {
        throw error;
      }

      throw new ReferralError(
        '추천 분석 조회 중 오류가 발생했습니다.',
        'REFERRAL_ANALYTICS_ERROR',
        500
      );
    }
  }

  /**
   * Cleanup expired referrals
   */
  async cleanupExpiredReferrals(): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('referrals')
        .update({ 
          status: 'expired',
          updated_at: new Date().toISOString()
        })
        .eq('status', 'pending')
        .lt('expires_at', new Date().toISOString());

      if (error) {
        logger.error('Failed to cleanup expired referrals', {
          error: error.message
        });
      } else {
        logger.info('Expired referrals cleanup completed');
      }
    } catch (error) {
      logger.error('Error during expired referrals cleanup', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Enhanced referral reward calculation based on original payment amounts (10% of base points)
   */
  async calculateReferralReward(
    referrerId: string,
    referredId: string,
    originalPaymentAmount: number
  ) {
    return await enhancedReferralService.calculateReferralReward(
      referrerId,
      referredId,
      originalPaymentAmount
    );
  }

  /**
   * Check and automatically promote user to influencer status when reaching 50 successful referrals
   */
  async checkAndPromoteInfluencer(userId: string) {
    return await enhancedReferralService.checkAndPromoteInfluencer(userId);
  }

  /**
   * Validate referral chain to prevent circular references
   */
  async validateReferralChain(referrerId: string, referredId: string) {
    return await enhancedReferralService.validateReferralChain(referrerId, referredId);
  }

  /**
   * Generate unique referral code with collision prevention
   */
  async generateReferralCode(userId: string) {
    return await enhancedReferralService.generateReferralCode(userId);
  }

  /**
   * Get comprehensive referral analytics for a user
   */
  async getUserReferralAnalytics(userId: string) {
    return await enhancedReferralService.getReferralAnalytics(userId);
  }

  /**
   * Process referral reward payout with enhanced calculation
   */
  async processReferralReward(
    referrerId: string,
    referredId: string,
    originalPaymentAmount: number,
    reservationId?: string
  ) {
    return await enhancedReferralService.processReferralReward(
      referrerId,
      referredId,
      originalPaymentAmount,
      reservationId
    );
  }
}

// Export singleton instance
export const referralService = new ReferralServiceImpl();

// Export class for testing
export { ReferralServiceImpl }; 