import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { referralRelationshipService } from './referral-relationship.service';

/**
 * Influencer Qualification Service
 * 
 * Handles influencer qualification logic with 50 referrals + all paid requirements
 * and automatic promotion system
 */

export interface InfluencerQualificationStatus {
  userId: string;
  userName: string;
  isQualified: boolean;
  isInfluencer: boolean;
  totalReferrals: number;
  successfulReferrals: number;
  paidReferrals: number;
  unpaidReferrals: number;
  qualificationProgress: {
    referralsRequired: number;
    referralsCompleted: number;
    paidRequired: boolean;
    paidCompleted: boolean;
    overallProgress: number; // 0-100
  };
  requirements: {
    minimumReferrals: number;
    allReferralsPaid: boolean;
    accountActive: boolean;
    profileComplete: boolean;
    phoneVerified: boolean;
  };
  nextSteps: string[];
  lastChecked: string;
}

export interface InfluencerPromotionRequest {
  userId: string;
  promotedBy: string;
  reason: string;
  manualOverride: boolean;
  effectiveDate?: string;
}

export interface InfluencerDemotionRequest {
  userId: string;
  demotedBy: string;
  reason: string;
  effectiveDate?: string;
}

export interface InfluencerQualificationStats {
  totalUsers: number;
  qualifiedUsers: number;
  influencers: number;
  pendingQualification: number;
  averageReferrals: number;
  qualificationRate: number;
  promotionRate: number;
  topPerformers: Array<{
    userId: string;
    userName: string;
    totalReferrals: number;
    successfulReferrals: number;
    qualificationScore: number;
  }>;
}

class InfluencerQualificationService {
  private supabase = getSupabaseClient();
  private readonly MINIMUM_REFERRALS = 50;
  private readonly QUALIFICATION_CHECK_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours

  /**
   * Check if a user qualifies for influencer status
   */
  async checkInfluencerQualification(userId: string): Promise<InfluencerQualificationStatus> {
    try {
      logger.info('Checking influencer qualification', { userId });

      // Get user information
      const userInfo = await this.getUserInfo(userId);
      if (!userInfo) {
        throw new Error('User not found');
      }

      // Get referral statistics
      const referralStats = await this.getUserReferralStats(userId);

      // Check qualification requirements
      const requirements = await this.checkQualificationRequirements(userId, referralStats);

      // Calculate qualification progress
      const qualificationProgress = this.calculateQualificationProgress(requirements, referralStats);

      // Determine if user is qualified
      const isQualified = this.determineQualification(requirements, qualificationProgress);

      // Get next steps for improvement
      const nextSteps = this.getNextSteps(requirements, qualificationProgress);

      const status: InfluencerQualificationStatus = {
        userId,
        userName: userInfo.name,
        isQualified,
        isInfluencer: userInfo.is_influencer || false,
        totalReferrals: referralStats.totalReferrals,
        successfulReferrals: referralStats.successfulReferrals,
        paidReferrals: referralStats.paidReferrals,
        unpaidReferrals: referralStats.unpaidReferrals,
        qualificationProgress,
        requirements,
        nextSteps,
        lastChecked: new Date().toISOString()
      };

      // Update qualification check timestamp
      await this.updateQualificationCheckTimestamp(userId);

      logger.info('Influencer qualification check completed', {
        userId,
        isQualified,
        isInfluencer: status.isInfluencer,
        totalReferrals: referralStats.totalReferrals,
        successfulReferrals: referralStats.successfulReferrals
      });

      return status;

    } catch (error) {
      logger.error('Error checking influencer qualification', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Automatically promote qualified users to influencer status
   */
  async autoPromoteQualifiedUsers(): Promise<{
    promoted: string[];
    failed: Array<{ userId: string; reason: string }>;
  }> {
    try {
      logger.info('Starting automatic influencer promotion process');

      // Get all users who might be qualified
      const { data: users, error } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          is_influencer,
          user_status,
          phone_verified,
          profile_image_url,
          last_qualification_check
        `)
        .eq('user_status', 'active')
        .eq('is_influencer', false)
        .gte('total_referrals', this.MINIMUM_REFERRALS * 0.8); // Check users with at least 80% of required referrals

      if (error) {
        throw new Error(`Failed to get users for promotion: ${error.message}`);
      }

      const promoted: string[] = [];
      const failed: Array<{ userId: string; reason: string }> = [];

      for (const user of users || []) {
        try {
          // Check if user needs qualification check
          const needsCheck = this.needsQualificationCheck(user.last_qualification_check);
          if (!needsCheck) {
            continue;
          }

          // Check qualification status
          const qualificationStatus = await this.checkInfluencerQualification(user.id);

          if (qualificationStatus.isQualified && !qualificationStatus.isInfluencer) {
            // Promote user to influencer
            await this.promoteToInfluencer(user.id, 'system', 'Automatic promotion based on qualification criteria');
            promoted.push(user.id);

            logger.info('User automatically promoted to influencer', {
              userId: user.id,
              userName: user.name,
              totalReferrals: qualificationStatus.totalReferrals,
              successfulReferrals: qualificationStatus.successfulReferrals
            });
          }
        } catch (userError) {
          failed.push({
            userId: user.id,
            reason: userError instanceof Error ? userError.message : 'Unknown error'
          });
          logger.error('Failed to process user for promotion', {
            userId: user.id,
            error: userError instanceof Error ? userError.message : 'Unknown error'
          });
        }
      }

      logger.info('Automatic influencer promotion completed', {
        totalProcessed: users?.length || 0,
        promoted: promoted.length,
        failed: failed.length
      });

      return { promoted, failed };

    } catch (error) {
      logger.error('Error in automatic influencer promotion', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Manually promote a user to influencer status
   */
  async promoteToInfluencer(
    userId: string,
    promotedBy: string,
    reason: string,
    manualOverride: boolean = false
  ): Promise<void> {
    try {
      logger.info('Promoting user to influencer', {
        userId,
        promotedBy,
        reason,
        manualOverride
      });

      // If not manual override, check qualification
      if (!manualOverride) {
        const qualificationStatus = await this.checkInfluencerQualification(userId);
        if (!qualificationStatus.isQualified) {
          throw new Error('User does not meet influencer qualification requirements');
        }
      }

      // Update user status
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          is_influencer: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update user status: ${updateError.message}`);
      }

      // Log the promotion
      await this.logInfluencerAction({
        userId,
        action: 'promotion',
        performedBy: promotedBy,
        reason,
        manualOverride,
        effectiveDate: new Date().toISOString()
      });

      logger.info('User successfully promoted to influencer', {
        userId,
        promotedBy,
        reason,
        manualOverride
      });

    } catch (error) {
      logger.error('Failed to promote user to influencer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        promotedBy
      });
      throw error;
    }
  }

  /**
   * Demote a user from influencer status
   */
  async demoteFromInfluencer(
    userId: string,
    demotedBy: string,
    reason: string
  ): Promise<void> {
    try {
      logger.info('Demoting user from influencer', {
        userId,
        demotedBy,
        reason
      });

      // Update user status
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          is_influencer: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to update user status: ${updateError.message}`);
      }

      // Log the demotion
      await this.logInfluencerAction({
        userId,
        action: 'demotion',
        performedBy: demotedBy,
        reason,
        manualOverride: true,
        effectiveDate: new Date().toISOString()
      });

      logger.info('User successfully demoted from influencer', {
        userId,
        demotedBy,
        reason
      });

    } catch (error) {
      logger.error('Failed to demote user from influencer', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        demotedBy
      });
      throw error;
    }
  }

  /**
   * Get influencer qualification statistics
   */
  async getInfluencerQualificationStats(): Promise<InfluencerQualificationStats> {
    try {
      // Get total users
      const { data: totalUsers } = await this.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('user_status', 'active');

      // Get influencers
      const { data: influencers } = await this.supabase
        .from('users')
        .select('id', { count: 'exact' })
        .eq('user_status', 'active')
        .eq('is_influencer', true);

      // Get users with high referral counts (potential qualifiers)
      const { data: potentialQualifiers } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          total_referrals,
          successful_referrals,
          is_influencer
        `)
        .eq('user_status', 'active')
        .gte('total_referrals', this.MINIMUM_REFERRALS * 0.5)
        .order('total_referrals', { ascending: false })
        .limit(100);

      // Calculate statistics
      const qualifiedUsers = potentialQualifiers?.filter(u => 
        u.total_referrals >= this.MINIMUM_REFERRALS
      ).length || 0;

      const pendingQualification = potentialQualifiers?.filter(u => 
        u.total_referrals >= this.MINIMUM_REFERRALS * 0.8 && 
        u.total_referrals < this.MINIMUM_REFERRALS
      ).length || 0;

      const averageReferrals = potentialQualifiers?.length > 0
        ? potentialQualifiers.reduce((sum, u) => sum + u.total_referrals, 0) / potentialQualifiers.length
        : 0;

      const qualificationRate = totalUsers?.length > 0
        ? (qualifiedUsers / totalUsers.length) * 100
        : 0;

      const promotionRate = qualifiedUsers > 0
        ? ((influencers?.length || 0) / qualifiedUsers) * 100
        : 0;

      // Get top performers
      const topPerformers = (potentialQualifiers || [])
        .slice(0, 10)
        .map(user => ({
          userId: user.id,
          userName: user.name,
          totalReferrals: user.total_referrals,
          successfulReferrals: user.successful_referrals,
          qualificationScore: this.calculateQualificationScore(user)
        }));

      return {
        totalUsers: totalUsers?.length || 0,
        qualifiedUsers,
        influencers: influencers?.length || 0,
        pendingQualification,
        averageReferrals: Math.round(averageReferrals * 100) / 100,
        qualificationRate: Math.round(qualificationRate * 100) / 100,
        promotionRate: Math.round(promotionRate * 100) / 100,
        topPerformers
      };

    } catch (error) {
      logger.error('Error getting influencer qualification stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user information
   */
  private async getUserInfo(userId: string): Promise<{
    id: string;
    name: string;
    user_status: string;
    is_influencer: boolean;
    phone_verified: boolean;
    profile_image_url?: string;
  } | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select(`
          id,
          name,
          user_status,
          is_influencer,
          phone_verified,
          profile_image_url
        `)
        .eq('id', userId)
        .single();

      if (error) {
        return null;
      }

      return data;
    } catch (error) {
      logger.error('Error getting user info', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Get user referral statistics
   */
  private async getUserReferralStats(userId: string): Promise<{
    totalReferrals: number;
    successfulReferrals: number;
    paidReferrals: number;
    unpaidReferrals: number;
  }> {
    try {
      // Get total referrals
      const { data: totalReferrals } = await this.supabase
        .from('referral_relationships')
        .select('id', { count: 'exact' })
        .eq('referrer_id', userId)
        .eq('status', 'active');

      // Get successful referrals (completed referrals)
      const { data: successfulReferrals } = await this.supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('referrer_id', userId)
        .eq('status', 'completed');

      // Get paid referrals
      const { data: paidReferrals } = await this.supabase
        .from('referrals')
        .select('id', { count: 'exact' })
        .eq('referrer_id', userId)
        .eq('status', 'completed')
        .eq('bonus_paid', true);

      const total = totalReferrals?.length || 0;
      const successful = successfulReferrals?.length || 0;
      const paid = paidReferrals?.length || 0;
      const unpaid = successful - paid;

      return {
        totalReferrals: total,
        successfulReferrals: successful,
        paidReferrals: paid,
        unpaidReferrals: unpaid
      };

    } catch (error) {
      logger.error('Error getting user referral stats', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return {
        totalReferrals: 0,
        successfulReferrals: 0,
        paidReferrals: 0,
        unpaidReferrals: 0
      };
    }
  }

  /**
   * Check qualification requirements
   */
  private async checkQualificationRequirements(
    userId: string,
    referralStats: any
  ): Promise<{
    minimumReferrals: number;
    allReferralsPaid: boolean;
    accountActive: boolean;
    profileComplete: boolean;
    phoneVerified: boolean;
  }> {
    const userInfo = await this.getUserInfo(userId);
    if (!userInfo) {
      return {
        minimumReferrals: 0,
        allReferralsPaid: false,
        accountActive: false,
        profileComplete: false,
        phoneVerified: false
      };
    }

    return {
      minimumReferrals: referralStats.totalReferrals,
      allReferralsPaid: referralStats.successfulReferrals === 0 || 
                       referralStats.paidReferrals === referralStats.successfulReferrals,
      accountActive: userInfo.user_status === 'active',
      profileComplete: !!(userInfo.profile_image_url && userInfo.name),
      phoneVerified: userInfo.phone_verified
    };
  }

  /**
   * Calculate qualification progress
   */
  private calculateQualificationProgress(
    requirements: any,
    referralStats: any
  ): {
    referralsRequired: number;
    referralsCompleted: number;
    paidRequired: boolean;
    paidCompleted: boolean;
    overallProgress: number;
  } {
    const referralsCompleted = Math.min(referralStats.totalReferrals, this.MINIMUM_REFERRALS);
    const referralsProgress = (referralsCompleted / this.MINIMUM_REFERRALS) * 100;
    
    const paidProgress = referralStats.successfulReferrals > 0
      ? (referralStats.paidReferrals / referralStats.successfulReferrals) * 100
      : 100;

    const overallProgress = Math.min(referralsProgress, paidProgress);

    return {
      referralsRequired: this.MINIMUM_REFERRALS,
      referralsCompleted: referralsCompleted,
      paidRequired: true,
      paidCompleted: requirements.allReferralsPaid,
      overallProgress: Math.round(overallProgress * 100) / 100
    };
  }

  /**
   * Determine if user is qualified
   */
  private determineQualification(requirements: any, progress: any): boolean {
    return requirements.minimumReferrals &&
           requirements.allReferralsPaid &&
           requirements.accountActive &&
           requirements.profileComplete &&
           requirements.phoneVerified;
  }

  /**
   * Get next steps for improvement
   */
  private getNextSteps(requirements: any, progress: any): string[] {
    const steps: string[] = [];

    if (!requirements.minimumReferrals) {
      const needed = this.MINIMUM_REFERRALS - progress.referralsCompleted;
      steps.push(`Need ${needed} more referrals to reach minimum requirement`);
    }

    if (!requirements.allReferralsPaid) {
      steps.push('All successful referrals must be paid before qualification');
    }

    if (!requirements.accountActive) {
      steps.push('Account must be active');
    }

    if (!requirements.profileComplete) {
      steps.push('Profile must be complete (name and profile image required)');
    }

    if (!requirements.phoneVerified) {
      steps.push('Phone number must be verified');
    }

    if (steps.length === 0) {
      steps.push('All requirements met - eligible for influencer status');
    }

    return steps;
  }

  /**
   * Check if user needs qualification check
   */
  private needsQualificationCheck(lastCheck: string | null): boolean {
    if (!lastCheck) return true;
    
    const lastCheckTime = new Date(lastCheck).getTime();
    const now = Date.now();
    
    return (now - lastCheckTime) > this.QUALIFICATION_CHECK_INTERVAL;
  }

  /**
   * Update qualification check timestamp
   */
  private async updateQualificationCheckTimestamp(userId: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({
          last_qualification_check: new Date().toISOString()
        })
        .eq('id', userId);
    } catch (error) {
      logger.error('Failed to update qualification check timestamp', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
    }
  }

  /**
   * Log influencer action
   */
  private async logInfluencerAction(action: {
    userId: string;
    action: string;
    performedBy: string;
    reason: string;
    manualOverride: boolean;
    effectiveDate: string;
  }): Promise<void> {
    try {
      await this.supabase
        .from('influencer_actions')
        .insert({
          user_id: action.userId,
          action: action.action,
          performed_by: action.performedBy,
          reason: action.reason,
          manual_override: action.manualOverride,
          effective_date: action.effectiveDate,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Failed to log influencer action', {
        error: error instanceof Error ? error.message : 'Unknown error',
        action
      });
    }
  }

  /**
   * Calculate qualification score
   */
  private calculateQualificationScore(user: any): number {
    const referralScore = Math.min((user.total_referrals / this.MINIMUM_REFERRALS) * 100, 100);
    const successRate = user.total_referrals > 0 
      ? (user.successful_referrals / user.total_referrals) * 100 
      : 0;
    
    return Math.round((referralScore + successRate) / 2);
  }
}

export const influencerQualificationService = new InfluencerQualificationService();
