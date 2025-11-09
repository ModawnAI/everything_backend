import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface PointPolicyData {
  earningRatePercent: number;
  earningCapAmount: number;
  usageAvailabilityDelayDays: number;
  minimumUsageAmount?: number;
  maximumUsagePercent?: number;
  pointsExpiryDays?: number;
  influencerReferralMultiplier?: number;
  influencerBonusRatePercent?: number;
  referralSignupBonus?: number;
  referralFirstPurchaseBonus?: number;
  effectiveFrom?: string;
}

export class AdminPointPolicyService {
  private supabase = getSupabaseClient();

  /**
   * Get current active point policy
   */
  async getActivePolicy(adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('points_policy')
        .select('*')
        .eq('is_active', true)
        .order('effective_from', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 is "no rows returned"
        throw error;
      }

      logger.info('Active point policy retrieved', { adminId });

      return { policy: data || null };
    } catch (error) {
      logger.error('Get active point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Get point policy history
   */
  async getPolicyHistory(page: number, limit: number, adminId: string): Promise<any> {
    try {
      const offset = (page - 1) * limit;

      const { data, error, count } = await this.supabase
        .from('points_policy')
        .select('*', { count: 'exact' })
        .order('effective_from', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      logger.info('Point policy history retrieved', { adminId, page, limit });

      return {
        policies: data || [],
        totalCount: count || 0,
        currentPage: page,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      logger.error('Get point policy history failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Create new point policy
   */
  async createPolicy(policyData: PointPolicyData, adminId: string): Promise<any> {
    try {
      // Deactivate current active policy if exists
      const { data: currentPolicy } = await this.supabase
        .from('points_policy')
        .select('id')
        .eq('is_active', true)
        .limit(1)
        .single();

      if (currentPolicy) {
        await this.supabase
          .from('points_policy')
          .update({
            is_active: false,
            effective_until: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            updated_by: adminId
          })
          .eq('id', currentPolicy.id);
      }

      // Create new policy
      const { data, error } = await this.supabase
        .from('points_policy')
        .insert({
          earning_rate_percent: policyData.earningRatePercent,
          earning_cap_amount: policyData.earningCapAmount,
          usage_availability_delay_days: policyData.usageAvailabilityDelayDays,
          minimum_usage_amount: policyData.minimumUsageAmount || 0,
          maximum_usage_percent: policyData.maximumUsagePercent || 100,
          points_expiry_days: policyData.pointsExpiryDays || 365,
          influencer_referral_multiplier: policyData.influencerReferralMultiplier || 2.0,
          influencer_bonus_rate_percent: policyData.influencerBonusRatePercent || 0,
          referral_signup_bonus: policyData.referralSignupBonus || 0,
          referral_first_purchase_bonus: policyData.referralFirstPurchaseBonus || 0,
          is_active: true,
          effective_from: policyData.effectiveFrom || new Date().toISOString(),
          updated_by: adminId
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Point policy created', { adminId, policyId: data.id });

      return { policy: data };
    } catch (error) {
      logger.error('Create point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId
      });
      throw error;
    }
  }

  /**
   * Update point policy
   */
  async updatePolicy(policyId: string, updates: Partial<PointPolicyData>, adminId: string): Promise<any> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
        updated_by: adminId
      };

      if (updates.earningRatePercent !== undefined) {
        updateData.earning_rate_percent = updates.earningRatePercent;
      }
      if (updates.earningCapAmount !== undefined) {
        updateData.earning_cap_amount = updates.earningCapAmount;
      }
      if (updates.usageAvailabilityDelayDays !== undefined) {
        updateData.usage_availability_delay_days = updates.usageAvailabilityDelayDays;
      }
      if (updates.minimumUsageAmount !== undefined) {
        updateData.minimum_usage_amount = updates.minimumUsageAmount;
      }
      if (updates.maximumUsagePercent !== undefined) {
        updateData.maximum_usage_percent = updates.maximumUsagePercent;
      }
      if (updates.pointsExpiryDays !== undefined) {
        updateData.points_expiry_days = updates.pointsExpiryDays;
      }
      if (updates.influencerReferralMultiplier !== undefined) {
        updateData.influencer_referral_multiplier = updates.influencerReferralMultiplier;
      }
      if (updates.influencerBonusRatePercent !== undefined) {
        updateData.influencer_bonus_rate_percent = updates.influencerBonusRatePercent;
      }
      if (updates.referralSignupBonus !== undefined) {
        updateData.referral_signup_bonus = updates.referralSignupBonus;
      }
      if (updates.referralFirstPurchaseBonus !== undefined) {
        updateData.referral_first_purchase_bonus = updates.referralFirstPurchaseBonus;
      }

      const { data, error } = await this.supabase
        .from('points_policy')
        .update(updateData)
        .eq('id', policyId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Point policy updated', { adminId, policyId });

      return { policy: data };
    } catch (error) {
      logger.error('Update point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        policyId
      });
      throw error;
    }
  }

  /**
   * Deactivate point policy
   */
  async deactivatePolicy(policyId: string, adminId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('points_policy')
        .update({
          is_active: false,
          effective_until: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          updated_by: adminId
        })
        .eq('id', policyId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Point policy deactivated', { adminId, policyId });

      return { policy: data };
    } catch (error) {
      logger.error('Deactivate point policy failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        adminId,
        policyId
      });
      throw error;
    }
  }
}

export const adminPointPolicyService = new AdminPointPolicyService();
