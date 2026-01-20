import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { pointService } from './point.service';
import { paymentService } from './payment.service';
import { notificationService } from './notification.service';

/**
 * Referral Earnings Service
 * 
 * Handles referral earnings calculation, bonus payout processing,
 * and earnings tracking for the referral system
 */

export interface ReferralEarningsCalculation {
  referrerId: string;
  referredId: string;
  referralId: string;
  baseAmount: number;
  bonusAmount: number;
  bonusType: 'points' | 'cash' | 'discount';
  multiplier: number;
  influencerBonus: number;
  totalEarnings: number;
  calculationDetails: {
    baseReferralBonus: number;
    influencerMultiplier: number;
    tierMultiplier: number;
    specialPromotionBonus: number;
    deductions: number;
  };
  eligibility: {
    isEligible: boolean;
    reasons: string[];
    requirements: {
      minimumReferrals: boolean;
      accountActive: boolean;
      phoneVerified: boolean;
      profileComplete: boolean;
      noRecentViolations: boolean;
    };
  };
  payoutSchedule: {
    immediate: boolean;
    scheduledDate?: string;
    conditions: string[];
  };
}

export interface ReferralPayoutRequest {
  referralId: string;
  referrerId: string;
  referredId: string;
  payoutType: 'points' | 'cash' | 'discount';
  amount: number;
  reason: string;
  processedBy: string;
  metadata?: Record<string, any>;
}

export interface ReferralPayoutResult {
  success: boolean;
  payoutId?: string;
  transactionId?: string;
  amount: number;
  payoutType: string;
  status: 'completed' | 'pending' | 'failed';
  error?: string;
  processedAt: string;
  expiresAt?: string;
}

export interface ReferralEarningsSummary {
  userId: string;
  totalEarnings: number;
  totalPayouts: number;
  pendingEarnings: number;
  availableBalance: number;
  earningsByType: {
    points: number;
    cash: number;
    discount: number;
  };
  recentEarnings: Array<{
    referralId: string;
    amount: number;
    type: string;
    status: string;
    earnedAt: string;
  }>;
  nextPayoutDate?: string;
  payoutHistory: Array<{
    payoutId: string;
    amount: number;
    type: string;
    status: string;
    processedAt: string;
  }>;
}

export interface ReferralTierConfig {
  tier: string;
  minReferrals: number;
  maxReferrals?: number;
  multiplier: number;
  benefits: string[];
  requirements: string[];
}

export interface FriendPaymentHistoryResponse {
  friend: {
    id: string;
    name: string;
    maskedName: string;
    joinedAt: string;
    totalPayments: number;
    totalSpent: number;
    myTotalEarnings: number;
    lastPaymentAt?: string;
  };
  payments: Array<{
    id: string;
    friendId: string;
    friendName: string;
    payment: {
      id: string;
      serviceName: string;
      shopName: string;
      originalAmount: number;
      paidAt: string;
      status: 'completed' | 'cancelled' | 'refunded';
    };
    commission: {
      amount: number;
      rate: number;
      type: 'first_booking' | 'repeat_booking' | 'influencer_bonus' | 'signup_bonus';
      status: 'pending' | 'available' | 'paid';
      creditedAt?: string;
      availableAt?: string;
    };
  }>;
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class ReferralEarningsService {
  private supabase = getSupabaseClient();
  private readonly DEFAULT_BASE_BONUS = 1000; // 1000 points
  private readonly INFLUENCER_MULTIPLIER = 2.0; // Updated to v3.2 policy (2x)
  private readonly TIER_MULTIPLIERS = {
    'bronze': 1.0,
    'silver': 1.2,
    'gold': 1.5,
    'platinum': 2.0,
    'diamond': 2.5
  };

  /**
   * Calculate referral earnings for a specific referral
   */
  async calculateReferralEarnings(
    referralId: string,
    referrerId: string,
    referredId: string
  ): Promise<ReferralEarningsCalculation> {
    try {
      logger.info('Calculating referral earnings', {
        referralId,
        referrerId,
        referredId
      });

      // Get referral details
      const referralDetails = await this.getReferralDetails(referralId);
      if (!referralDetails) {
        throw new Error('Referral not found');
      }

      // Get referrer information
      const referrerInfo = await this.getReferrerInfo(referrerId);
      if (!referrerInfo) {
        throw new Error('Referrer not found');
      }

      // Get referred user information
      const referredInfo = await this.getReferredUserInfo(referredId);
      if (!referredInfo) {
        throw new Error('Referred user not found');
      }

      // Check eligibility
      const eligibility = await this.checkEligibility(referrerId, referredId);

      // Calculate base earnings
      const baseAmount = referralDetails.bonus_amount || this.DEFAULT_BASE_BONUS;
      const bonusType = referralDetails.bonus_type || 'points';

      // Calculate multipliers
      const influencerMultiplier = referrerInfo.is_influencer ? this.INFLUENCER_MULTIPLIER : 1.0;
      const tierMultiplier = this.calculateTierMultiplier(referrerInfo);
      const specialPromotionBonus = await this.getSpecialPromotionBonus(referrerId, referredId);

      // Calculate total earnings
      const baseReferralBonus = baseAmount;
      const influencerBonus = baseAmount * (influencerMultiplier - 1);
      const tierBonus = baseAmount * (tierMultiplier - 1);
      const promotionBonus = specialPromotionBonus;
      const deductions = await this.calculateDeductions(referrerId, referredId);

      const totalEarnings = baseReferralBonus + influencerBonus + tierBonus + promotionBonus - deductions;

      const calculation: ReferralEarningsCalculation = {
        referrerId,
        referredId,
        referralId,
        baseAmount,
        bonusAmount: totalEarnings,
        bonusType,
        multiplier: influencerMultiplier * tierMultiplier,
        influencerBonus,
        totalEarnings,
        calculationDetails: {
          baseReferralBonus,
          influencerMultiplier,
          tierMultiplier,
          specialPromotionBonus,
          deductions
        },
        eligibility,
        payoutSchedule: {
          immediate: eligibility.isEligible && totalEarnings > 0,
          scheduledDate: eligibility.isEligible ? new Date().toISOString() : undefined,
          conditions: this.getPayoutConditions(eligibility)
        }
      };

      logger.info('Referral earnings calculated', {
        referralId,
        referrerId,
        totalEarnings,
        eligibility: eligibility.isEligible
      });

      return calculation;

    } catch (error) {
      logger.error('Failed to calculate referral earnings', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referralId,
        referrerId,
        referredId
      });
      throw error;
    }
  }

  /**
   * Process referral bonus payout
   */
  async processReferralPayout(
    payoutRequest: ReferralPayoutRequest
  ): Promise<ReferralPayoutResult> {
    try {
      logger.info('Processing referral payout', {
        referralId: payoutRequest.referralId,
        referrerId: payoutRequest.referrerId,
        amount: payoutRequest.amount,
        payoutType: payoutRequest.payoutType
      });

      // Validate payout request
      const validation = await this.validatePayoutRequest(payoutRequest);
      if (!validation.isValid) {
        throw new Error(`Payout validation failed: ${validation.reasons.join(', ')}`);
      }

      // Create payout record
      const payoutId = await this.createPayoutRecord(payoutRequest);

      let transactionId: string | undefined;
      let status: 'completed' | 'pending' | 'failed' = 'pending';

      try {
        // Process payout based on type
        switch (payoutRequest.payoutType) {
          case 'points':
            transactionId = await this.processPointsPayout(payoutRequest);
            status = 'completed';
            break;
          case 'cash':
            transactionId = await this.processCashPayout(payoutRequest);
            status = 'pending'; // Cash payouts may require manual processing
            break;
          case 'discount':
            transactionId = await this.processDiscountPayout(payoutRequest);
            status = 'completed';
            break;
          default:
            throw new Error(`Unsupported payout type: ${payoutRequest.payoutType}`);
        }

        // Update payout record with transaction details
        await this.updatePayoutRecord(payoutId, {
          status,
          transaction_id: transactionId,
          processed_at: new Date().toISOString()
        });

        // Update referral record
        await this.updateReferralPayoutStatus(payoutRequest.referralId, true);

        logger.info('Referral payout processed successfully', {
          payoutId,
          transactionId,
          status,
          amount: payoutRequest.amount
        });

        return {
          success: true,
          payoutId,
          transactionId,
          amount: payoutRequest.amount,
          payoutType: payoutRequest.payoutType,
          status,
          processedAt: new Date().toISOString()
        };

      } catch (payoutError) {
        // Update payout record as failed
        await this.updatePayoutRecord(payoutId, {
          status: 'failed',
          error: payoutError instanceof Error ? payoutError.message : 'Unknown error',
          processed_at: new Date().toISOString()
        });

        logger.error('Referral payout processing failed', {
          payoutId,
          error: payoutError instanceof Error ? payoutError.message : 'Unknown error'
        });

        return {
          success: false,
          payoutId,
          amount: payoutRequest.amount,
          payoutType: payoutRequest.payoutType,
          status: 'failed',
          error: payoutError instanceof Error ? payoutError.message : 'Unknown error',
          processedAt: new Date().toISOString()
        };
      }

    } catch (error) {
      logger.error('Failed to process referral payout', {
        error: error instanceof Error ? error.message : 'Unknown error',
        payoutRequest
      });
      throw error;
    }
  }

  /**
   * Get referral earnings summary for a user
   */
  async getReferralEarningsSummary(userId: string): Promise<ReferralEarningsSummary> {
    try {
      logger.info('Getting referral earnings summary', { userId });

      // Get referral earnings from point_transactions with transaction_type 'earned_referral'
      const { data: pointTransactions, error: pointError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', 'earned_referral')
        .order('created_at', { ascending: false });

      if (pointError) {
        logger.error('Failed to get point transactions', {
          error: pointError.message,
          userId
        });
        // Don't throw, just log and continue with empty data
      }

      // Get referral payouts if table exists (optional)
      const { data: payouts, error: payoutsError } = await this.supabase
        .from('referral_payouts')
        .select('*')
        .eq('referrer_id', userId)
        .order('created_at', { ascending: false });

      if (payoutsError) {
        logger.warn('Failed to get payouts (table may not exist)', {
          error: payoutsError.message,
          userId
        });
      }

      // Calculate summary from point transactions
      const earnings = pointTransactions || [];
      const completedEarnings = earnings.filter(e => e.status === 'completed' || !e.status);
      const pendingEarnings = earnings.filter(e => e.status === 'pending');

      const totalEarnings = completedEarnings.reduce((sum, earning) => sum + (earning.amount || 0), 0);
      const pendingAmount = pendingEarnings.reduce((sum, earning) => sum + (earning.amount || 0), 0);
      const totalPayouts = payouts?.filter(p => p.status === 'completed').reduce((sum, payout) => sum + payout.amount, 0) || 0;
      const availableBalance = totalEarnings - totalPayouts;

      // Group earnings by type (all are points since from point_transactions)
      const earningsByType = {
        points: totalEarnings,
        cash: 0,
        discount: 0
      };

      // Get recent earnings
      const recentEarnings = earnings
        .slice(0, 10)
        .map(earning => ({
          referralId: earning.reference_id || earning.id,
          amount: earning.amount || 0,
          type: 'points',
          status: earning.status || 'completed',
          earnedAt: earning.created_at
        }));

      // Get payout history
      const payoutHistory = (payouts || [])
        .slice(0, 10)
        .map(payout => ({
          payoutId: payout.id,
          amount: payout.amount,
          type: payout.payout_type,
          status: payout.status,
          processedAt: payout.processed_at || payout.created_at
        }));

      const summary: ReferralEarningsSummary = {
        userId,
        totalEarnings,
        totalPayouts,
        pendingEarnings: pendingAmount,
        availableBalance,
        earningsByType,
        recentEarnings,
        payoutHistory,
        nextPayoutDate: this.calculateNextPayoutDate(userId)
      };

      logger.info('Referral earnings summary retrieved', {
        userId,
        totalEarnings,
        availableBalance,
        transactionCount: earnings.length
      });

      return summary;

    } catch (error) {
      logger.error('Failed to get referral earnings summary', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Process bulk referral payouts
   */
  async processBulkReferralPayouts(
    referralIds: string[],
    processedBy: string
  ): Promise<{
    successful: string[];
    failed: Array<{ referralId: string; error: string }>;
    totalAmount: number;
  }> {
    try {
      logger.info('Processing bulk referral payouts', {
        referralCount: referralIds.length,
        processedBy
      });

      const successful: string[] = [];
      const failed: Array<{ referralId: string; error: string }> = [];
      let totalAmount = 0;

      for (const referralId of referralIds) {
        try {
          // Get referral details
          const referralDetails = await this.getReferralDetails(referralId);
          if (!referralDetails) {
            failed.push({ referralId, error: 'Referral not found' });
            continue;
          }

          // Calculate earnings
          const earnings = await this.calculateReferralEarnings(
            referralId,
            referralDetails.referrer_id,
            referralDetails.referred_id
          );

          if (!earnings.eligibility.isEligible) {
            failed.push({ 
              referralId, 
              error: `Not eligible: ${earnings.eligibility.reasons.join(', ')}` 
            });
            continue;
          }

          // Process payout
          const payoutRequest: ReferralPayoutRequest = {
            referralId,
            referrerId: referralDetails.referrer_id,
            referredId: referralDetails.referred_id,
            payoutType: earnings.bonusType as 'points' | 'cash' | 'discount',
            amount: earnings.totalEarnings,
            reason: 'Bulk referral payout processing',
            processedBy,
            metadata: {
              bulkProcessing: true,
              calculationDetails: earnings.calculationDetails
            }
          };

          const result = await this.processReferralPayout(payoutRequest);

          if (result.success) {
            successful.push(referralId);
            totalAmount += result.amount;
          } else {
            failed.push({ referralId, error: result.error || 'Unknown error' });
          }

        } catch (error) {
          failed.push({ 
            referralId, 
            error: error instanceof Error ? error.message : 'Unknown error' 
          });
        }
      }

      logger.info('Bulk referral payouts completed', {
        successful: successful.length,
        failed: failed.length,
        totalAmount
      });

      return { successful, failed, totalAmount };

    } catch (error) {
      logger.error('Failed to process bulk referral payouts', {
        error: error instanceof Error ? error.message : 'Unknown error',
        referralIds
      });
      throw error;
    }
  }

  /**
   * Get referral details
   */
  private async getReferralDetails(referralId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('referrals')
      .select('*')
      .eq('id', referralId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Get referrer information
   */
  private async getReferrerInfo(referrerId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', referrerId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Get referred user information
   */
  private async getReferredUserInfo(referredId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', referredId)
      .single();

    if (error) {
      return null;
    }

    return data;
  }

  /**
   * Check eligibility for referral earnings
   */
  private async checkEligibility(referrerId: string, referredId: string): Promise<{
    isEligible: boolean;
    reasons: string[];
    requirements: {
      minimumReferrals: boolean;
      accountActive: boolean;
      phoneVerified: boolean;
      profileComplete: boolean;
      noRecentViolations: boolean;
    };
  }> {
    const referrerInfo = await this.getReferrerInfo(referrerId);
    const referredInfo = await this.getReferredUserInfo(referredId);

    const requirements = {
      minimumReferrals: (referrerInfo?.total_referrals || 0) >= 1,
      accountActive: referrerInfo?.user_status === 'active' && referredInfo?.user_status === 'active',
      phoneVerified: referrerInfo?.phone_verified === true,
      profileComplete: !!(referrerInfo?.name && referrerInfo?.profile_image_url),
      noRecentViolations: true // TODO: Implement violation checking
    };

    const reasons: string[] = [];
    if (!requirements.minimumReferrals) reasons.push('Minimum referrals not met');
    if (!requirements.accountActive) reasons.push('Account not active');
    if (!requirements.phoneVerified) reasons.push('Phone not verified');
    if (!requirements.profileComplete) reasons.push('Profile incomplete');
    if (!requirements.noRecentViolations) reasons.push('Recent violations detected');

    return {
      isEligible: Object.values(requirements).every(Boolean),
      reasons,
      requirements
    };
  }

  /**
   * Calculate tier multiplier based on user's referral count
   */
  private calculateTierMultiplier(userInfo: any): number {
    const referralCount = userInfo?.total_referrals || 0;
    
    if (referralCount >= 100) return this.TIER_MULTIPLIERS.diamond;
    if (referralCount >= 50) return this.TIER_MULTIPLIERS.platinum;
    if (referralCount >= 25) return this.TIER_MULTIPLIERS.gold;
    if (referralCount >= 10) return this.TIER_MULTIPLIERS.silver;
    return this.TIER_MULTIPLIERS.bronze;
  }

  /**
   * Get special promotion bonus
   */
  private async getSpecialPromotionBonus(referrerId: string, referredId: string): Promise<number> {
    // TODO: Implement special promotion logic
    return 0;
  }

  /**
   * Calculate deductions
   */
  private async calculateDeductions(referrerId: string, referredId: string): Promise<number> {
    // TODO: Implement deduction logic (fees, penalties, etc.)
    return 0;
  }

  /**
   * Get payout conditions
   */
  private getPayoutConditions(eligibility: any): string[] {
    const conditions: string[] = [];
    
    if (!eligibility.requirements.accountActive) {
      conditions.push('Both accounts must be active');
    }
    if (!eligibility.requirements.phoneVerified) {
      conditions.push('Referrer phone must be verified');
    }
    if (!eligibility.requirements.profileComplete) {
      conditions.push('Referrer profile must be complete');
    }
    
    return conditions;
  }

  /**
   * Validate payout request
   */
  private async validatePayoutRequest(request: ReferralPayoutRequest): Promise<{
    isValid: boolean;
    reasons: string[];
  }> {
    const reasons: string[] = [];

    // Check if referral exists and is eligible
    const referralDetails = await this.getReferralDetails(request.referralId);
    if (!referralDetails) {
      reasons.push('Referral not found');
    }

    // Check if already paid
    if (referralDetails?.bonus_paid) {
      reasons.push('Referral bonus already paid');
    }

    // Validate amount
    if (request.amount <= 0) {
      reasons.push('Invalid payout amount');
    }

    return {
      isValid: reasons.length === 0,
      reasons
    };
  }

  /**
   * Create payout record
   */
  private async createPayoutRecord(request: ReferralPayoutRequest): Promise<string> {
    const { data, error } = await this.supabase
      .from('referral_payouts')
      .insert({
        referral_id: request.referralId,
        referrer_id: request.referrerId,
        referred_id: request.referredId,
        payout_type: request.payoutType,
        amount: request.amount,
        reason: request.reason,
        processed_by: request.processedBy,
        status: 'pending',
        metadata: request.metadata,
        created_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to create payout record: ${error.message}`);
    }

    return data.id;
  }

  /**
   * Update payout record
   */
  private async updatePayoutRecord(
    payoutId: string, 
    updates: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('referral_payouts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', payoutId);

    if (error) {
      throw new Error(`Failed to update payout record: ${error.message}`);
    }
  }

  /**
   * Update referral payout status
   */
  private async updateReferralPayoutStatus(referralId: string, paid: boolean): Promise<void> {
    const { error } = await this.supabase
      .from('referrals')
      .update({
        bonus_paid: paid,
        updated_at: new Date().toISOString()
      })
      .eq('id', referralId);

    if (error) {
      throw new Error(`Failed to update referral payout status: ${error.message}`);
    }
  }

  /**
   * Process points payout
   */
  private async processPointsPayout(request: ReferralPayoutRequest): Promise<string> {
    // Use existing point service to add points
    const result = await pointService.addPoints(
      request.referrerId,
      request.amount,
      'bonus',
      'referral',
      `Referral bonus for referral ${request.referralId}`
    );

    // Get the referred user's nickname for notification
    const { data: referredUser } = await this.supabase
      .from('users')
      .select('name, nickname')
      .eq('id', request.referredId)
      .single();

    const friendNickname = referredUser?.nickname || referredUser?.name || '친구';

    // Send push notification to referrer
    try {
      await notificationService.sendReferralPointNotification(
        request.referrerId,
        friendNickname,
        request.amount
      );

      logger.info('Referral point notification sent', {
        referrerId: request.referrerId,
        friendNickname,
        pointsEarned: request.amount
      });
    } catch (notificationError) {
      // Don't fail the payout if notification fails
      logger.error('Failed to send referral point notification', {
        error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
        referrerId: request.referrerId,
        amount: request.amount
      });
    }

    return result.id;
  }

  /**
   * Process cash payout
   */
  private async processCashPayout(request: ReferralPayoutRequest): Promise<string> {
    // TODO: Implement cash payout logic (bank transfer, etc.)
    // For now, return a placeholder transaction ID
    return `cash_payout_${Date.now()}`;
  }

  /**
   * Process discount payout
   */
  private async processDiscountPayout(request: ReferralPayoutRequest): Promise<string> {
    // TODO: Implement discount payout logic (coupon generation, etc.)
    // For now, return a placeholder transaction ID
    return `discount_payout_${Date.now()}`;
  }

  /**
   * Calculate next payout date
   */
  private calculateNextPayoutDate(userId: string): string | undefined {
    // TODO: Implement payout scheduling logic
    return undefined;
  }

  /**
   * Get payment history and commissions for a referred friend
   */
  async getFriendPaymentHistory(
    currentUserId: string,
    friendId: string,
    page: number = 1,
    limit: number = 10
  ): Promise<FriendPaymentHistoryResponse> {
    try {
      logger.info('Getting friend payment history', {
        currentUserId,
        friendId,
        page,
        limit
      });

      // 1. 권한 검증: currentUserId가 friendId를 추천했는지 확인
      const { data: referral, error: referralError } = await this.supabase
        .from('referrals')
        .select('*')
        .eq('referrer_id', currentUserId)
        .eq('referred_id', friendId)
        .maybeSingle();

      // PGRST116 = "no rows returned" 에러 코드
      if (referralError && referralError.code !== 'PGRST116') {
        logger.error('Error checking referral relationship', {
          currentUserId,
          friendId,
          errorMessage: referralError.message,
          errorCode: referralError.code,
          errorDetails: referralError.details,
          errorHint: referralError.hint
        });
        throw new Error('DATABASE_ERROR');
      }

      if (!referral) {
        logger.warn('Referral relationship not found', {
          currentUserId,
          friendId
        });
        throw new Error('ACCESS_DENIED');
      }

      // 2. 친구 정보 조회
      const { data: friendUser, error: friendError } = await this.supabase
        .from('users')
        .select('id, name, nickname, email, created_at')
        .eq('id', friendId)
        .single();

      if (friendError || !friendUser) {
        logger.warn('Friend user not found', { friendId, error: friendError?.message });
        throw new Error('FRIEND_NOT_FOUND');
      }

      // 3. 친구의 전체 결제 통계 조회 (페이지네이션 없이)
      const { data: allPayments, error: allPaymentsError } = await this.supabase
        .from('payments')
        .select('id, amount, paid_at, payment_status')
        .eq('user_id', friendId)
        .eq('payment_status', 'completed')
        .order('paid_at', { ascending: false });

      const totalPayments = allPayments?.length || 0;
      const totalSpent = allPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;
      const lastPaymentAt = allPayments?.[0]?.paid_at;

      // 4. 추천자(currentUserId)가 받은 총 적립 포인트 조회
      const { data: allCommissions } = await this.supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', currentUserId)
        .eq('related_user_id', friendId)
        .eq('transaction_type', 'earned_referral');

      const myTotalEarnings = allCommissions?.reduce((sum, c) => sum + c.amount, 0) || 0;

      // 5. 친구의 결제 내역 조회 (페이지네이션 적용)
      const offset = (page - 1) * limit;
      const { data: payments, error: paymentsError, count } = await this.supabase
        .from('payments')
        .select(`
          id,
          amount,
          paid_at,
          payment_status,
          reservation_id,
          reservations!inner (
            id,
            shop_id,
            shops!inner (
              id,
              name
            )
          )
        `, { count: 'exact' })
        .eq('user_id', friendId)
        .eq('payment_status', 'completed')
        .order('paid_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (paymentsError) {
        logger.error('Failed to fetch payments', {
          errorMessage: paymentsError.message,
          errorCode: paymentsError.code,
          errorDetails: paymentsError.details,
          errorHint: paymentsError.hint,
          friendId
        });
        throw new Error('PAYMENTS_FETCH_ERROR');
      }

      // 6. 각 결제에 대한 커미션 정보 조회
      const paymentHistories = await Promise.all(
        (payments || []).map(async (payment: any) => {
          // 해당 결제에 대한 커미션 조회
          const { data: commission } = await this.supabase
            .from('point_transactions')
            .select('*')
            .eq('user_id', currentUserId)
            .eq('related_user_id', friendId)
            .eq('reservation_id', payment.reservation_id)
            .eq('transaction_type', 'earned_referral')
            .maybeSingle();

          // 서비스명 조회 (reservation_services 테이블)
          const { data: reservationServices } = await this.supabase
            .from('reservation_services')
            .select(`
              service_id,
              shop_services!inner (
                name
              )
            `)
            .eq('reservation_id', payment.reservation_id)
            .limit(1)
            .maybeSingle();

          const serviceName = (reservationServices?.shop_services as any)?.name || '서비스 정보 없음';
          const shopName = (payment.reservations?.shops as any)?.name || '매장 정보 없음';

          // 커미션 타입 결정 (첫 결제인지 확인)
          const { count: previousPayments } = await this.supabase
            .from('payments')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', friendId)
            .eq('payment_status', 'completed')
            .lt('paid_at', payment.paid_at);

          const isFirstPayment = (previousPayments || 0) === 0;
          const commissionType: 'first_booking' | 'repeat_booking' = isFirstPayment ? 'first_booking' : 'repeat_booking';
          const commissionRate = isFirstPayment ? 10 : 5;

          return {
            id: payment.id,
            friendId,
            friendName: friendUser.name || friendUser.nickname || 'Unknown',
            payment: {
              id: payment.id,
              serviceName,
              shopName,
              originalAmount: payment.amount,
              paidAt: payment.paid_at,
              status: 'completed' as const
            },
            commission: {
              amount: commission?.amount || 0,
              rate: commissionRate,
              type: commissionType,
              status: commission?.status || 'pending',
              creditedAt: commission?.created_at,
              availableAt: commission?.available_from
            }
          };
        })
      );

      // 7. 친구 요약 정보 마스킹 처리
      const friendName = friendUser.name || friendUser.nickname || 'Unknown';
      const maskedName = this.maskUsername(friendName);

      const result: FriendPaymentHistoryResponse = {
        friend: {
          id: friendId,
          name: friendName,
          maskedName,
          joinedAt: friendUser.created_at,
          totalPayments,
          totalSpent,
          myTotalEarnings,
          lastPaymentAt
        },
        payments: paymentHistories,
        pagination: {
          page,
          limit,
          total: count || 0,
          totalPages: Math.ceil((count || 0) / limit)
        }
      };

      logger.info('Friend payment history retrieved', {
        currentUserId,
        friendId,
        totalPayments: result.payments.length,
        totalCommission: myTotalEarnings
      });

      return result;

    } catch (error) {
      logger.error('Failed to get friend payment history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        currentUserId,
        friendId
      });
      throw error;
    }
  }

  /**
   * Mask username for privacy
   */
  private maskUsername(username: string): string {
    if (!username) return '';
    const length = username.length;
    if (length <= 2) return username + '**';

    // 앞 2자만 표시, 나머지는 **
    return username.substring(0, 2) + '**';
  }
}

export const referralEarningsService = new ReferralEarningsService();
