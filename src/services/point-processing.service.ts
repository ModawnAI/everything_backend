/**
 * Point Processing Service
 * 
 * Handles automated point processing tasks including:
 * - 7-day pending period processing
 * - Point expiration handling
 * - Expiration warning notifications
 * - Automated status transitions
 * - Background job management
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { PointStatus } from '../types/database.types';
import { POINT_CALCULATIONS, POINT_POLICY_V32 } from '../constants/point-policies';

export interface PointProcessingStats {
  pendingProcessed: number;
  expiredProcessed: number;
  warningsSent: number;
  errors: number;
  processingTime: number;
}

export interface ExpirationWarning {
  userId: string;
  transactionId: string;
  pointsAmount: number;
  expiresAt: string;
  daysUntilExpiration: number;
}

export class PointProcessingService {
  private supabase = getSupabaseClient();

  /**
   * Process all pending points that have completed their 7-day waiting period
   */
  async processPendingToAvailable(): Promise<number> {
    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    try {
      logger.info('Starting pending points processing');

      const now = new Date().toISOString();

      // Get all pending transactions that have passed their available_from date
      const { data: pendingTransactions, error } = await this.supabase
        .from('point_transactions')
        .select('id, user_id, amount, available_from, description')
        .eq('status', 'pending')
        .lte('available_from', now);

      if (error) {
        logger.error('Failed to fetch pending transactions', {
          error: error.message
        });
        throw new Error(`Failed to fetch pending transactions: ${error.message}`);
      }

      logger.info(`Found ${pendingTransactions?.length || 0} pending transactions to process`);

      // Process each pending transaction
      for (const transaction of pendingTransactions || []) {
        try {
          await this.updateTransactionStatus(transaction.id, 'available', {
            processedAt: now,
            reason: '7-day pending period completed',
            originalAmount: transaction.amount
          });

          // Update user's cached balance
          await this.updateUserPointBalance(transaction.user_id);

          processedCount++;

          logger.info('Successfully processed pending transaction', {
            transactionId: transaction.id,
            userId: transaction.user_id,
            amount: transaction.amount
          });

        } catch (updateError) {
          errorCount++;
          logger.error('Failed to process pending transaction', {
            transactionId: transaction.id,
            userId: transaction.user_id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          });
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info('Pending points processing completed', {
        processedCount,
        errorCount,
        totalFound: pendingTransactions?.length || 0,
        processingTime
      });

      return processedCount;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Error in pending points processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });
      throw error;
    }
  }

  /**
   * Process all available points that have expired
   */
  async processExpiredPoints(): Promise<number> {
    const startTime = Date.now();
    let processedCount = 0;
    let errorCount = 0;

    try {
      logger.info('Starting expired points processing');

      const now = new Date().toISOString();

      // Get all available transactions that have passed their expiration date
      const { data: expiredTransactions, error } = await this.supabase
        .from('point_transactions')
        .select('id, user_id, amount, expires_at, description')
        .eq('status', 'available')
        .lt('expires_at', now);

      if (error) {
        logger.error('Failed to fetch expired transactions', {
          error: error.message
        });
        throw new Error(`Failed to fetch expired transactions: ${error.message}`);
      }

      logger.info(`Found ${expiredTransactions?.length || 0} expired transactions to process`);

      // Process each expired transaction
      for (const transaction of expiredTransactions || []) {
        try {
          await this.updateTransactionStatus(transaction.id, 'expired', {
            processedAt: now,
            reason: 'Points expired',
            originalAmount: transaction.amount
          });

          // Update user's cached balance
          await this.updateUserPointBalance(transaction.user_id);

          processedCount++;

          logger.info('Successfully processed expired transaction', {
            transactionId: transaction.id,
            userId: transaction.user_id,
            amount: transaction.amount
          });

        } catch (updateError) {
          errorCount++;
          logger.error('Failed to process expired transaction', {
            transactionId: transaction.id,
            userId: transaction.user_id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          });
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info('Expired points processing completed', {
        processedCount,
        errorCount,
        totalFound: expiredTransactions?.length || 0,
        processingTime
      });

      return processedCount;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Error in expired points processing', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });
      throw error;
    }
  }

  /**
   * Send expiration warning notifications for points expiring within 7 days
   */
  async sendExpirationWarnings(): Promise<number> {
    const startTime = Date.now();
    let warningsSent = 0;
    let errorCount = 0;

    try {
      logger.info('Starting expiration warning notifications');

      const now = new Date();
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      const sevenDaysFromNowISO = sevenDaysFromNow.toISOString();

      // Get all available transactions expiring within 7 days
      const { data: expiringTransactions, error } = await this.supabase
        .from('point_transactions')
        .select(`
          id, 
          user_id, 
          amount, 
          expires_at, 
          description
        `)
        .eq('status', 'available')
        .gte('expires_at', now.toISOString())
        .lte('expires_at', sevenDaysFromNowISO);

      if (error) {
        logger.error('Failed to fetch expiring transactions', {
          error: error.message
        });
        throw new Error(`Failed to fetch expiring transactions: ${error.message}`);
      }

      logger.info(`Found ${expiringTransactions?.length || 0} transactions expiring within 7 days`);

      // Group by user to avoid multiple notifications
      const userWarnings = new Map<string, ExpirationWarning[]>();

      for (const transaction of expiringTransactions || []) {
        const userId = transaction.user_id;
        if (!userWarnings.has(userId)) {
          userWarnings.set(userId, []);
        }

        const daysUntilExpiration = Math.ceil(
          (new Date(transaction.expires_at).getTime() - now.getTime()) / (24 * 60 * 60 * 1000)
        );

        userWarnings.get(userId)!.push({
          userId,
          transactionId: transaction.id,
          pointsAmount: transaction.amount,
          expiresAt: transaction.expires_at,
          daysUntilExpiration
        });
      }

      // Get user notification preferences for users with expiring points
      const userIds = Array.from(userWarnings.keys());
      const { data: users, error: usersError } = await this.supabase
        .from('users')
        .select('id, email, name, push_notifications_enabled')
        .in('id', userIds);

      if (usersError) {
        logger.error('Failed to fetch user notification preferences', {
          error: usersError.message
        });
        // Continue without notification preferences check
      }

      const userPreferences = new Map(
        (users || []).map(user => [user.id, user])
      );

      // Send notifications for each user
      for (const [userId, warnings] of userWarnings) {
        try {
          const user = userPreferences.get(userId);
          
          // Only send if user has notifications enabled
          if (user && !user.push_notifications_enabled) {
            logger.info('Skipping notification for user with disabled push notifications', {
              userId,
              email: user.email
            });
            continue;
          }

          await this.sendExpirationWarningNotification(userId, warnings);
          warningsSent++;

          logger.info('Successfully sent expiration warning notification', {
            userId,
            email: user?.email,
            warningCount: warnings.length,
            totalPoints: warnings.reduce((sum, w) => sum + w.pointsAmount, 0)
          });

        } catch (notificationError) {
          errorCount++;
          logger.error('Failed to send expiration warning notification', {
            userId,
            error: notificationError instanceof Error ? notificationError.message : 'Unknown error'
          });
        }
      }

      const processingTime = Date.now() - startTime;
      logger.info('Expiration warning notifications completed', {
        warningsSent,
        errorCount,
        totalUsers: userWarnings.size,
        processingTime
      });

      return warningsSent;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      logger.error('Error in expiration warning notifications', {
        error: error instanceof Error ? error.message : 'Unknown error',
        processingTime
      });
      throw error;
    }
  }

  /**
   * Run all point processing tasks
   */
  async runAllProcessingTasks(): Promise<PointProcessingStats> {
    const startTime = Date.now();
    const stats: PointProcessingStats = {
      pendingProcessed: 0,
      expiredProcessed: 0,
      warningsSent: 0,
      errors: 0,
      processingTime: 0
    };

    try {
      logger.info('Starting all point processing tasks');

      // Process pending to available
      try {
        stats.pendingProcessed = await this.processPendingToAvailable();
      } catch (error) {
        stats.errors++;
        logger.error('Error processing pending points', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Process expired points
      try {
        stats.expiredProcessed = await this.processExpiredPoints();
      } catch (error) {
        stats.errors++;
        logger.error('Error processing expired points', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Send expiration warnings
      try {
        stats.warningsSent = await this.sendExpirationWarnings();
      } catch (error) {
        stats.errors++;
        logger.error('Error sending expiration warnings', {
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      stats.processingTime = Date.now() - startTime;

      logger.info('All point processing tasks completed', stats);

      return stats;

    } catch (error) {
      stats.processingTime = Date.now() - startTime;
      logger.error('Error in point processing tasks', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stats
      });
      throw error;
    }
  }

  /**
   * Update transaction status with metadata
   */
  private async updateTransactionStatus(
    transactionId: string,
    newStatus: PointStatus,
    metadata: Record<string, any>
  ): Promise<void> {
    const { error } = await this.supabase
      .from('point_transactions')
      .update({
        status: newStatus,
        updated_at: new Date().toISOString(),
        metadata: metadata
      })
      .eq('id', transactionId);

    if (error) {
      logger.error('Failed to update transaction status', {
        transactionId,
        newStatus,
        error: error.message
      });
      throw new Error(`Failed to update transaction status: ${error.message}`);
    }
  }

  /**
   * Update user's cached point balance
   */
  private async updateUserPointBalance(userId: string): Promise<void> {
    try {
      // Calculate real-time balance
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('amount, status')
        .eq('user_id', userId);

      if (error) {
        logger.error('Failed to fetch user transactions for balance update', {
          userId,
          error: error.message
        });
        return;
      }

      let availableBalance = 0;
      let pendingBalance = 0;

      for (const transaction of transactions || []) {
        if (transaction.status === 'available') {
          availableBalance += transaction.amount;
        } else if (transaction.status === 'pending') {
          pendingBalance += transaction.amount;
        }
      }

      // Update user's cached balance
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          point_balance: availableBalance,
          pending_point_balance: pendingBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        logger.error('Failed to update user point balance', {
          userId,
          error: updateError.message
        });
      }

    } catch (error) {
      logger.error('Error updating user point balance', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send expiration warning notification to user
   */
  private async sendExpirationWarningNotification(
    userId: string,
    warnings: ExpirationWarning[]
  ): Promise<void> {
    try {
      const totalPoints = warnings.reduce((sum, w) => sum + w.pointsAmount, 0);
      const earliestExpiration = warnings.reduce(
        (earliest, w) => w.daysUntilExpiration < earliest.daysUntilExpiration ? w : earliest
      );

      // Create notification record
      const { error } = await this.supabase
        .from('notifications')
        .insert({
          user_id: userId,
          notification_type: 'point_expiration_warning',
          title: '포인트 만료 예정 알림',
          message: `${totalPoints}포인트가 ${earliestExpiration.daysUntilExpiration}일 후에 만료됩니다. 사용하지 않은 포인트가 있으시면 서비스를 이용해 주세요.`,
          data: {
            type: 'point_expiration_warning',
            totalPoints,
            daysUntilExpiration: earliestExpiration.daysUntilExpiration,
            expiringTransactions: warnings.map(w => ({
              transactionId: w.transactionId,
              pointsAmount: w.pointsAmount,
              expiresAt: w.expiresAt
            }))
          },
          status: 'unread',
          created_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to create expiration warning notification', {
          userId,
          error: error.message
        });
        throw new Error(`Failed to create notification: ${error.message}`);
      }

      // TODO: Integrate with push notification service
      // For now, we just log that the notification was created
      logger.info('Expiration warning notification created', {
        userId,
        totalPoints,
        daysUntilExpiration: earliestExpiration.daysUntilExpiration
      });

    } catch (error) {
      logger.error('Error sending expiration warning notification', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get processing statistics
   */
  async getProcessingStats(): Promise<{
    pendingCount: number;
    expiringCount: number;
    expiredCount: number;
  }> {
    try {
      const now = new Date().toISOString();
      const sevenDaysFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      // Get pending count
      const { count: pendingCount } = await this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .lte('available_from', now);

      // Get expiring count (within 7 days)
      const { count: expiringCount } = await this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available')
        .gte('expires_at', now)
        .lte('expires_at', sevenDaysFromNow);

      // Get expired count
      const { count: expiredCount } = await this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'available')
        .lt('expires_at', now);

      return {
        pendingCount: pendingCount || 0,
        expiringCount: expiringCount || 0,
        expiredCount: expiredCount || 0
      };

    } catch (error) {
      logger.error('Error getting processing stats', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Award points for service completion
   */
  async awardPointsForCompletion(params: {
    reservationId: string;
    userId: string;
    finalAmount: number;
    shopId: string;
    shopName: string;
    services: any[];
    completionNotes?: string;
  }): Promise<{ success: boolean; pointsAwarded: number; error?: string }> {
    try {
      const { reservationId, userId, finalAmount, shopId, shopName, services, completionNotes } = params;

      logger.info('Awarding points for service completion', {
        reservationId,
        userId,
        finalAmount,
        shopId
      });

      // Calculate points using v3.2 policies
      const pointsToAward = POINT_CALCULATIONS.calculateServicePoints(
        finalAmount,
        false, // Will be determined by user data
        1.0 // Will be calculated based on user tier
      );

      if (pointsToAward <= 0) {
        logger.info('No points to award for completion', {
          reservationId,
          userId,
          finalAmount,
          pointsToAward
        });

        return {
          success: true,
          pointsAwarded: 0
        };
      }

      // Create point transaction for completion
      const { data: pointTransaction, error: transactionError } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          amount: pointsToAward,
          transaction_type: 'earned',
          source_type: 'service_completion',
          source_id: reservationId,
          description: `서비스 완료 포인트 - ${shopName}`,
          status: 'pending',
          available_from: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days pending
          metadata: {
            reservationId,
            shopId,
            shopName,
            finalAmount,
            eligibleAmount: Math.min(finalAmount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT),
            pointRate: 0.025,
            services: services.map(s => ({
              serviceId: s.service_id,
              serviceName: s.shop_services?.name || 'Unknown Service',
              quantity: s.quantity,
              unitPrice: s.unit_price,
              totalPrice: s.total_price
            })),
            completionNotes
          },
          created_at: new Date().toISOString()
        })
        .select('id')
        .single();

      if (transactionError) {
        logger.error('Failed to create point transaction for completion', {
          error: transactionError.message,
          reservationId,
          userId,
          pointsToAward
        });

        return {
          success: false,
          pointsAwarded: 0,
          error: transactionError.message
        };
      }

      // Update user's cached point balance
      await this.updateUserPointBalance(userId);

      logger.info('Successfully awarded points for service completion', {
        reservationId,
        userId,
        pointsToAward,
        transactionId: pointTransaction.id,
        finalAmount,
        eligibleAmount: Math.min(finalAmount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT)
      });

      // Process referral bonuses if applicable
      try {
        await this.processReferralBonuses(params.userId, params.reservationId);
      } catch (referralError) {
        logger.error('Failed to process referral bonuses', {
          error: referralError instanceof Error ? referralError.message : 'Unknown error',
          userId: params.userId,
          reservationId: params.reservationId
        });
        // Don't fail the main completion if referral processing fails
      }

      return {
        success: true,
        pointsAwarded: pointsToAward
      };

    } catch (error) {
      logger.error('Error awarding points for service completion', {
        error: error instanceof Error ? error.message : 'Unknown error',
        reservationId: params.reservationId,
        userId: params.userId,
        finalAmount: params.finalAmount
      });

      return {
        success: false,
        pointsAwarded: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Process referral bonuses for service completion
   */
  private async processReferralBonuses(userId: string, reservationId: string): Promise<void> {
    try {
      logger.info('Processing referral bonuses for service completion', {
        userId,
        reservationId
      });

      // Find active referrals for this user that haven't been processed for this reservation
      const { data: referrals, error: referralError } = await this.supabase
        .from('referrals')
        .select(`
          id,
          referrer_id,
          referred_id,
          status,
          bonus_amount,
          bonus_type,
          bonus_paid,
          referral_code,
          notes
        `)
        .eq('referred_id', userId)
        .eq('status', 'active')
        .not('notes', 'like', `%reservation ${reservationId}%`); // Prevent duplicate processing

      if (referralError) {
        logger.error('Failed to fetch referrals for user', {
          error: referralError.message,
          userId
        });
        return;
      }

      if (!referrals || referrals.length === 0) {
        logger.info('No active referrals found for user', { userId });
        return;
      }

      // Process each active referral
      let processedReferrals = 0;
      let failedReferrals = 0;

      for (const referral of referrals) {
        try {
          // Validate referral eligibility
          if (referral.bonus_paid) {
            logger.warn('Referral already has bonus paid, skipping', {
              referralId: referral.id,
              referrerId: referral.referrer_id,
              referredId: referral.referred_id
            });
            continue;
          }

          // Import referral service to update status
          const { ReferralServiceImpl } = await import('./referral.service');
          const referralService = new ReferralServiceImpl();

          // Update referral status to completed (this will trigger bonus payout)
          await referralService.updateReferralStatus({
            referralId: referral.id,
            status: 'completed',
            notes: `Service completed - reservation ${reservationId}`
          });

          processedReferrals++;

          logger.info('Referral marked as completed and bonus processed', {
            referralId: referral.id,
            referrerId: referral.referrer_id,
            referredId: referral.referred_id,
            bonusAmount: referral.bonus_amount,
            bonusType: referral.bonus_type,
            reservationId
          });

        } catch (updateError) {
          failedReferrals++;
          logger.error('Failed to update referral status', {
            error: updateError instanceof Error ? updateError.message : 'Unknown error',
            referralId: referral.id,
            referrerId: referral.referrer_id,
            referredId: referral.referred_id,
            userId,
            reservationId
          });
        }
      }

      logger.info('Referral bonus processing completed', {
        userId,
        reservationId,
        totalReferrals: referrals.length,
        processedReferrals,
        failedReferrals,
        skippedReferrals: referrals.length - processedReferrals - failedReferrals
      });

    } catch (error) {
      logger.error('Error processing referral bonuses', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        reservationId
      });
      throw error;
    }
  }
}

// Export singleton instance
export const pointProcessingService = new PointProcessingService(); 