/**
 * Point Service
 *
 * Handles point-related operations for the referral system
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { PointTransactionType } from '../types/database.types';

// Legacy type mapping for backward compatibility
type LegacyPointType = 'earned' | 'spent' | 'refunded' | 'bonus';
type LegacyPointSource = 'referral' | 'purchase' | 'admin' | 'system';

/**
 * Maps legacy type+source combination to PointTransactionType
 */
function mapToTransactionType(type: LegacyPointType, source: LegacyPointSource): PointTransactionType {
  if (type === 'earned' && source === 'referral') return 'earned_referral';
  if (type === 'earned' && source === 'purchase') return 'earned_service';
  if (type === 'spent' && source === 'purchase') return 'used_service';
  if (type === 'bonus') return 'influencer_bonus';
  if (type === 'refunded') return 'adjusted';
  // Default fallback
  return 'earned_service';
}

export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  transaction_type: PointTransactionType;
  description: string;
  created_at: string;
  updated_at: string;
}

export interface PointBalance {
  user_id: string;
  total_points: number;
  available_points: number;
  pending_points: number;
  last_updated: string;
}

export class PointService {
  private supabase = getSupabaseClient();

  /**
   * Add points to user account
   */
  async addPoints(
    userId: string,
    amount: number,
    type: LegacyPointType,
    source: LegacyPointSource,
    description: string
  ): Promise<PointTransaction> {
    try {
      // Map legacy type+source to new transaction_type
      const transaction_type = mapToTransactionType(type, source);

      // Create point transaction record
      const now = new Date();
      const availableFrom = now; // Points available immediately
      const expiresAt = new Date(now);
      expiresAt.setFullYear(expiresAt.getFullYear() + 1); // Expires in 1 year

      const { data: transaction, error } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          amount: Math.abs(amount), // Ensure positive amount
          transaction_type,
          description,
          status: 'available', // Set status to 'available' so it counts in balance
          available_from: availableFrom.toISOString(),
          expires_at: expiresAt.toISOString(),
          created_at: now.toISOString(),
          updated_at: now.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create point transaction: ${error.message}`);
      }

      // Update user's point balance
      await this.updateUserPointBalance(userId, amount);

      logger.info('Points added successfully', {
        userId,
        amount,
        type,
        source,
        transaction_type,
        transactionId: transaction.id
      });

      return transaction;
    } catch (error) {
      logger.error('Failed to add points', {
        userId,
        amount,
        type,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Deduct points from user account using FIFO logic
   */
  async deductPoints(
    userId: string,
    amount: number,
    type: LegacyPointType,
    source: LegacyPointSource,
    description: string,
    reservationId?: string
  ): Promise<PointTransaction> {
    try {
      // Map legacy type+source to new transaction_type
      const transaction_type = mapToTransactionType(type, source);

      // Try FIFO service first
      try {
        const { fifoPointUsageService } = await import('./fifo-point-usage.service');

        const result = await fifoPointUsageService.usePointsFIFO({
          userId,
          amountToUse: amount,
          reservationId,
          description,
          metadata: {
            type,
            source,
            transaction_type,
            deductedViaPointService: true
          }
        });

        if (result.success) {
          const { data: transaction, error } = await this.supabase
            .from('point_transactions')
            .select('*')
            .eq('id', result.newTransactionId)
            .single();

          if (!error && transaction) {
            logger.info('Points deducted successfully using FIFO', {
              userId,
              amount,
              transactionId: transaction.id
            });
            return transaction;
          }
        }
      } catch (fifoError) {
        logger.warn('FIFO point deduction failed, using fallback', {
          userId,
          amount,
          error: fifoError instanceof Error ? fifoError.message : 'Unknown error'
        });
      }

      // Fallback: Direct point deduction without FIFO RPC
      logger.info('Using fallback point deduction', { userId, amount });

      // 1. Check user's available points
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select('available_points')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        throw new Error('사용자 정보를 찾을 수 없습니다');
      }

      if ((user.available_points || 0) < amount) {
        throw new Error('포인트가 부족합니다');
      }

      // 2. Create point transaction record
      const { data: transaction, error: txError } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          amount: -amount,
          transaction_type: transaction_type,
          description: description,
          reference_type: reservationId ? 'reservation' : null,
          reference_id: reservationId || null,
          status: 'completed'
        })
        .select()
        .single();

      if (txError || !transaction) {
        logger.error('Point transaction insert failed', {
          userId,
          amount,
          txError: txError?.message,
          txErrorDetails: txError?.details,
          txErrorHint: txError?.hint,
          txErrorCode: txError?.code
        });
        throw new Error(`포인트 거래 기록 생성에 실패했습니다: ${txError?.message || 'Unknown error'}`);
      }

      // 3. Update user's available points
      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          available_points: (user.available_points || 0) - amount
        })
        .eq('id', userId);

      if (updateError) {
        // Rollback transaction if update fails
        await this.supabase
          .from('point_transactions')
          .delete()
          .eq('id', transaction.id);
        throw new Error('포인트 차감에 실패했습니다');
      }

      logger.info('Points deducted successfully using fallback', {
        userId,
        amount,
        transactionId: transaction.id
      });

      return transaction;
    } catch (error) {
      logger.error('Failed to deduct points', {
        userId,
        amount,
        type,
        source,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's point balance
   */
  async getUserPointBalance(userId: string): Promise<PointBalance> {
    try {
      const { data: user, error } = await this.supabase
        .from('users')
        .select('total_points, available_points')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      return {
        user_id: userId,
        total_points: user.total_points || 0,
        available_points: user.available_points || 0,
        pending_points: 0, // This would need to be calculated from pending transactions
        last_updated: new Date().toISOString()
      };
    } catch (error) {
      logger.error('Failed to get user point balance', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Update user's point balance
   */
  private async updateUserPointBalance(userId: string, amount: number): Promise<void> {
    try {
      // Get current balance first
      const { data: user, error: getUserError } = await this.supabase
        .from('users')
        .select('total_points, available_points')
        .eq('id', userId)
        .single();

      if (getUserError || !user) {
        throw new Error('User not found');
      }

      const { error } = await this.supabase
        .from('users')
        .update({
          total_points: user.total_points + amount,
          available_points: user.available_points + amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        throw new Error(`Failed to update point balance: ${error.message}`);
      }
    } catch (error) {
      logger.error('Failed to update user point balance', {
        userId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's point transaction history
   */
  async getUserPointHistory(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<PointTransaction[]> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get point history: ${error.message}`);
      }

      return transactions || [];
    } catch (error) {
      logger.error('Failed to get user point history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export const pointService = new PointService();
