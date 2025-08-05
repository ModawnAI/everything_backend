/**
 * FIFO Point Usage Service
 * 
 * Comprehensive First-In-First-Out point usage system with:
 * - FIFO algorithm for point consumption using available_at timestamp ordering
 * - Partial point usage handling for transactions requiring more points than single transaction provides
 * - Transaction rollback mechanism for insufficient points
 * - Point usage tracking with detailed breakdown of consumed transactions
 * - Atomic operations with database transactions
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  PointTransactionType, 
  PointStatus,
  User 
} from '../types/database.types';

export interface PointUsageRequest {
  userId: string;
  amount: number;
  reservationId: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface PointUsageResponse {
  success: boolean;
  totalUsed: number;
  remainingAmount: number;
  consumedTransactions: ConsumedTransaction[];
  usageTransactionId: string;
  rollbackRequired: boolean;
  rollbackReason?: string;
}

export interface ConsumedTransaction {
  originalTransactionId: string;
  originalAmount: number;
  consumedAmount: number;
  remainingAmount: number;
  availableFrom: string;
  expiresAt?: string;
  transactionType: PointTransactionType;
  description: string;
}

export interface PointUsageBreakdown {
  totalAvailable: number;
  totalRequested: number;
  totalUsed: number;
  insufficientAmount: number;
  availableTransactions: AvailableTransaction[];
}

export interface AvailableTransaction {
  id: string;
  amount: number;
  availableFrom: string;
  expiresAt?: string;
  transactionType: PointTransactionType;
  description: string;
  status: PointStatus;
}

export interface PointUsageRollbackRequest {
  usageTransactionId: string;
  reason: string;
  adminId?: string;
}

export class FIFOPointUsageService {
  private supabase = getSupabaseClient();

  /**
   * Use points with FIFO algorithm
   */
  async usePoints(request: PointUsageRequest): Promise<PointUsageResponse> {
    const { userId, amount, reservationId, description, metadata } = request;

    try {
      logger.info('Starting FIFO point usage', {
        userId,
        amount,
        reservationId
      });

      // Validate request
      this.validateUsageRequest(request);

      // Get user information
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Get available points breakdown
      const breakdown = await this.getAvailablePointsBreakdown(userId);
      
      if (breakdown.totalAvailable < amount) {
        return {
          success: false,
          totalUsed: 0,
          remainingAmount: amount,
          consumedTransactions: [],
          usageTransactionId: '',
          rollbackRequired: false,
          rollbackReason: `Insufficient points. Available: ${breakdown.totalAvailable}, Requested: ${amount}`
        };
      }

      // Execute FIFO point consumption
      const result = await this.executeFIFOConsumption(userId, amount, reservationId, description, metadata);

      logger.info('FIFO point usage completed', {
        userId,
        totalUsed: result.totalUsed,
        consumedTransactionsCount: result.consumedTransactions.length,
        success: result.success
      });

      return result;

    } catch (error) {
      logger.error('Error in FIFO point usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get available points breakdown for FIFO analysis
   */
  async getAvailablePointsBreakdown(userId: string): Promise<PointUsageBreakdown> {
    try {
      // Get all available point transactions ordered by available_from (FIFO)
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'available')
        .gt('amount', 0)
        .order('available_from', { ascending: true }) // FIFO order
        .order('created_at', { ascending: true }); // Secondary sort for same available_from

      if (error) {
        throw new Error(`Failed to get available transactions: ${error.message}`);
      }

      const availableTransactions: AvailableTransaction[] = (transactions || []).map(t => ({
        id: t.id,
        amount: t.amount,
        availableFrom: t.available_from,
        expiresAt: t.expires_at,
        transactionType: t.transaction_type,
        description: t.description,
        status: t.status
      }));

      const totalAvailable = availableTransactions.reduce((sum, t) => sum + t.amount, 0);

      return {
        totalAvailable,
        totalRequested: 0, // Will be set by caller
        totalUsed: 0, // Will be set by caller
        insufficientAmount: 0, // Will be set by caller
        availableTransactions
      };

    } catch (error) {
      logger.error('Error getting available points breakdown', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Execute FIFO point consumption with database transaction
   */
  private async executeFIFOConsumption(
    userId: string,
    amount: number,
    reservationId: string,
    description?: string,
    metadata?: Record<string, any>
  ): Promise<PointUsageResponse> {
    // Start database transaction
    const { data: transaction, error: transactionError } = await this.supabase.rpc('begin_transaction');
    
    if (transactionError) {
      throw new Error(`Failed to begin transaction: ${transactionError.message}`);
    }

    try {
      // Get available transactions in FIFO order
      const { data: availableTransactions, error: fetchError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'available')
        .gt('amount', 0)
        .order('available_from', { ascending: true })
        .order('created_at', { ascending: true });

      if (fetchError) {
        throw new Error(`Failed to fetch available transactions: ${fetchError.message}`);
      }

      const consumedTransactions: ConsumedTransaction[] = [];
      let remainingAmount = amount;
      let totalUsed = 0;

      // Consume points in FIFO order
      for (const transaction of availableTransactions || []) {
        if (remainingAmount <= 0) break;

        const consumeAmount = Math.min(transaction.amount, remainingAmount);
        const newRemainingAmount = transaction.amount - consumeAmount;

        // Update the original transaction
        const { error: updateError } = await this.supabase
          .from('point_transactions')
          .update({
            amount: newRemainingAmount,
            status: newRemainingAmount === 0 ? 'used' : 'available',
            updated_at: new Date().toISOString(),
            metadata: {
              ...transaction.metadata,
              last_used_at: new Date().toISOString(),
              last_used_amount: consumeAmount,
              reservation_id: reservationId
            }
          })
          .eq('id', transaction.id);

        if (updateError) {
          throw new Error(`Failed to update transaction ${transaction.id}: ${updateError.message}`);
        }

        // Record consumed transaction
        consumedTransactions.push({
          originalTransactionId: transaction.id,
          originalAmount: transaction.amount,
          consumedAmount: consumeAmount,
          remainingAmount: newRemainingAmount,
          availableFrom: transaction.available_from,
          expiresAt: transaction.expires_at,
          transactionType: transaction.transaction_type,
          description: transaction.description
        });

        remainingAmount -= consumeAmount;
        totalUsed += consumeAmount;
      }

      // Create usage transaction record
      const { data: usageTransaction, error: usageError } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: userId,
          reservation_id: reservationId,
          transaction_type: 'used_service',
          amount: -totalUsed, // Negative amount for usage
          description: description || '서비스 결제 사용 (FIFO)',
          status: 'used',
          metadata: {
            ...metadata,
            fifo_consumption: true,
            consumed_transactions: consumedTransactions.map(ct => ct.originalTransactionId),
            consumed_amounts: consumedTransactions.map(ct => ct.consumedAmount),
            total_consumed: totalUsed,
            consumed_at: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (usageError) {
        throw new Error(`Failed to create usage transaction: ${usageError.message}`);
      }

      // Update reservation points_used field
      const { error: reservationError } = await this.supabase
        .from('reservations')
        .update({
          points_used: totalUsed,
          updated_at: new Date().toISOString()
        })
        .eq('id', reservationId);

      if (reservationError) {
        throw new Error(`Failed to update reservation: ${reservationError.message}`);
      }

      // Commit transaction
      const { error: commitError } = await this.supabase.rpc('commit_transaction');
      if (commitError) {
        throw new Error(`Failed to commit transaction: ${commitError.message}`);
      }

      return {
        success: true,
        totalUsed,
        remainingAmount,
        consumedTransactions,
        usageTransactionId: usageTransaction.id,
        rollbackRequired: false
      };

    } catch (error) {
      // Rollback transaction on error
      const { error: rollbackError } = await this.supabase.rpc('rollback_transaction');
      if (rollbackError) {
        logger.error('Failed to rollback transaction', { error: rollbackError.message });
      }

      throw error;
    }
  }

  /**
   * Rollback point usage transaction
   */
  async rollbackPointUsage(request: PointUsageRollbackRequest): Promise<boolean> {
    const { usageTransactionId, reason, adminId } = request;

    try {
      logger.info('Rolling back point usage', {
        usageTransactionId,
        reason,
        adminId
      });

      // Get the usage transaction
      const { data: usageTransaction, error: fetchError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('id', usageTransactionId)
        .eq('transaction_type', 'used_service')
        .single();

      if (fetchError || !usageTransaction) {
        throw new Error(`Usage transaction not found: ${usageTransactionId}`);
      }

      const consumedTransactionIds = usageTransaction.metadata?.consumed_transactions || [];
      const consumedAmounts = usageTransaction.metadata?.consumed_amounts || [];

      if (consumedTransactionIds.length === 0) {
        throw new Error('No consumed transactions found in usage record');
      }

      // Start database transaction
      const { error: transactionError } = await this.supabase.rpc('begin_transaction');
      if (transactionError) {
        throw new Error(`Failed to begin rollback transaction: ${transactionError.message}`);
      }

      try {
        // Restore original transactions
        for (let i = 0; i < consumedTransactionIds.length; i++) {
          const originalTransactionId = consumedTransactionIds[i];
          const consumedAmount = consumedAmounts[i];

          // Get the current state of the transaction
          const { data: currentTransaction, error: currentError } = await this.supabase
            .from('point_transactions')
            .select('*')
            .eq('id', originalTransactionId)
            .single();

          if (currentError || !currentTransaction) {
            throw new Error(`Original transaction not found: ${originalTransactionId}`);
          }

          // Restore the consumed amount
          const restoredAmount = currentTransaction.amount + consumedAmount;
          const newStatus = restoredAmount > 0 ? 'available' : currentTransaction.status;

          const { error: restoreError } = await this.supabase
            .from('point_transactions')
            .update({
              amount: restoredAmount,
              status: newStatus,
              updated_at: new Date().toISOString(),
              metadata: {
                ...currentTransaction.metadata,
                rollback_info: {
                  rollback_at: new Date().toISOString(),
                  rollback_reason: reason,
                  rollback_by: adminId,
                  restored_amount: consumedAmount,
                  original_usage_transaction: usageTransactionId
                }
              }
            })
            .eq('id', originalTransactionId);

          if (restoreError) {
            throw new Error(`Failed to restore transaction ${originalTransactionId}: ${restoreError.message}`);
          }
        }

        // Mark usage transaction as rolled back
        const { error: markError } = await this.supabase
          .from('point_transactions')
          .update({
            status: 'cancelled',
            updated_at: new Date().toISOString(),
            metadata: {
              ...usageTransaction.metadata,
              rollback_info: {
                rollback_at: new Date().toISOString(),
                rollback_reason: reason,
                rollback_by: adminId
              }
            }
          })
          .eq('id', usageTransactionId);

        if (markError) {
          throw new Error(`Failed to mark usage transaction as rolled back: ${markError.message}`);
        }

        // Update reservation points_used field
        const { error: reservationError } = await this.supabase
          .from('reservations')
          .update({
            points_used: 0, // Reset to 0 since we're rolling back
            updated_at: new Date().toISOString()
          })
          .eq('id', usageTransaction.reservation_id);

        if (reservationError) {
          throw new Error(`Failed to update reservation: ${reservationError.message}`);
        }

        // Commit rollback transaction
        const { error: commitError } = await this.supabase.rpc('commit_transaction');
        if (commitError) {
          throw new Error(`Failed to commit rollback transaction: ${commitError.message}`);
        }

        logger.info('Point usage rollback completed successfully', {
          usageTransactionId,
          restoredTransactions: consumedTransactionIds.length
        });

        return true;

      } catch (error) {
        // Rollback rollback transaction on error
        const { error: rollbackError } = await this.supabase.rpc('rollback_transaction');
        if (rollbackError) {
          logger.error('Failed to rollback rollback transaction', { error: rollbackError.message });
        }
        throw error;
      }

    } catch (error) {
      logger.error('Error rolling back point usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get detailed point usage history with FIFO breakdown
   */
  async getPointUsageHistory(
    userId: string,
    page: number = 1,
    limit: number = 20
  ): Promise<{
    usageHistory: Array<{
      usageTransactionId: string;
      totalUsed: number;
      consumedTransactions: ConsumedTransaction[];
      reservationId: string;
      usedAt: string;
      description: string;
    }>;
    totalCount: number;
    hasMore: boolean;
  }> {
    try {
      // Get usage transactions
      const offset = (page - 1) * limit;
      const { data: usageTransactions, error, count } = await this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .eq('transaction_type', 'used_service')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get usage history: ${error.message}`);
      }

      const usageHistory = (usageTransactions || []).map(transaction => ({
        usageTransactionId: transaction.id,
        totalUsed: Math.abs(transaction.amount),
        consumedTransactions: transaction.metadata?.consumed_transactions || [],
        reservationId: transaction.reservation_id,
        usedAt: transaction.created_at,
        description: transaction.description
      }));

      const totalCount = count || 0;
      const hasMore = page * limit < totalCount;

      return {
        usageHistory,
        totalCount,
        hasMore
      };

    } catch (error) {
      logger.error('Error getting point usage history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Validate usage request
   */
  private validateUsageRequest(request: PointUsageRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.amount || request.amount <= 0) {
      throw new Error('Amount must be positive');
    }

    if (!request.reservationId) {
      throw new Error('Reservation ID is required');
    }
  }

  /**
   * Get user information
   */
  private async getUser(userId: string): Promise<User | null> {
    const { data: user, error } = await this.supabase
      .from('users')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      logger.error('Failed to get user', {
        error: error.message,
        userId
      });
      return null;
    }

    return user;
  }
}

// Export singleton instance
export const fifoPointUsageService = new FIFOPointUsageService(); 