/**
 * Point Service
 * 
 * Handles point-related operations for the referral system
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface PointTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: 'earned' | 'spent' | 'refunded' | 'bonus';
  source: 'referral' | 'purchase' | 'admin' | 'system';
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
    type: PointTransaction['type'], 
    source: PointTransaction['source'],
    description: string
  ): Promise<PointTransaction> {
    try {
      // Create point transaction record
      const { data: transaction, error } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          amount: Math.abs(amount), // Ensure positive amount
          type,
          source,
          description,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
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
    type: PointTransaction['type'], 
    source: PointTransaction['source'],
    description: string,
    reservationId?: string
  ): Promise<PointTransaction> {
    try {
      // Import FIFO service dynamically to avoid circular dependency
      const { fifoPointUsageService } = await import('./fifo-point-usage.service');

      // Use FIFO point usage service
      const result = await fifoPointUsageService.usePointsFIFO({
        userId,
        amountToUse: amount,
        reservationId,
        description,
        metadata: {
          type,
          source,
          deductedViaPointService: true
        }
      });

      if (!result.success) {
        throw new Error('Failed to deduct points using FIFO logic');
      }

      // Get the created transaction
      const { data: transaction, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('id', result.newTransactionId)
        .single();

      if (error || !transaction) {
        throw new Error('Failed to retrieve created transaction');
      }

      logger.info('Points deducted successfully using FIFO', {
        userId,
        amount,
        type,
        source,
        transactionId: transaction.id,
        transactionsUsed: result.transactionsUsed.length,
        remainingBalance: result.remainingBalance
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
