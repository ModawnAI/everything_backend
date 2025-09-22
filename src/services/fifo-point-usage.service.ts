/**
 * FIFO Point Usage Service
 * 
 * Implements First-In-First-Out point usage logic with proper balance validation
 * and transaction atomicity. Points are consumed in the order they become available.
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  PointTransaction, 
  PointTransactionType, 
  PointStatus 
} from '../types/database.types';
import {
  POINT_STATUS,
  POINT_TRANSACTION_TYPES
} from '../constants/point-policies';

export interface FIFOPointUsageRequest {
  userId: string;
  amountToUse: number;
  reservationId?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export interface FIFOPointUsageResponse {
  success: boolean;
  totalUsed: number;
  remainingBalance: number;
  transactionsUsed: PointUsageDetail[];
  newTransactionId: string;
  message: string;
}

export interface PointUsageDetail {
  transactionId: string;
  originalAmount: number;
  usedAmount: number;
  remainingAmount: number;
  availableFrom: string;
  createdAt: string;
}

export interface AvailablePointTransaction {
  id: string;
  amount: number;
  available_from: string;
  created_at: string;
  expires_at?: string;
  description?: string;
  metadata?: Record<string, any>;
}

export class FIFOPointUsageService {
  private supabase = getSupabaseClient();

  /**
   * Use points following FIFO logic with transaction atomicity
   */
  async usePointsFIFO(request: FIFOPointUsageRequest): Promise<FIFOPointUsageResponse> {
    const { userId, amountToUse, reservationId, description, metadata } = request;

    try {
      logger.info('Starting FIFO point usage', {
        userId,
        amountToUse,
        reservationId
      });

      // Validate request
      this.validateUsageRequest(request);

      // Start database transaction
      const { data: transactionResult, error: transactionError } = await this.supabase.rpc(
        'use_points_fifo_transaction',
        {
          p_user_id: userId,
          p_amount_to_use: amountToUse,
          p_reservation_id: reservationId,
          p_description: description || '서비스 결제 포인트 사용',
          p_metadata: metadata || {}
        }
      );

      if (transactionError) {
        logger.error('FIFO point usage transaction failed', {
          error: transactionError.message,
          userId,
          amountToUse
        });
        throw new Error(`Point usage failed: ${transactionError.message}`);
      }

      if (!transactionResult || transactionResult.length === 0) {
        throw new Error('No transaction result returned');
      }

      const result = transactionResult[0];

      if (!result.success) {
        throw new Error(result.error_message || 'Point usage failed');
      }

      logger.info('FIFO point usage completed successfully', {
        userId,
        totalUsed: result.total_used,
        remainingBalance: result.remaining_balance,
        transactionId: result.new_transaction_id
      });

      return {
        success: true,
        totalUsed: result.total_used,
        remainingBalance: result.remaining_balance,
        transactionsUsed: result.transactions_used || [],
        newTransactionId: result.new_transaction_id,
        message: `Successfully used ${result.total_used} points`
      };

    } catch (error) {
      logger.error('Error in FIFO point usage', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        amountToUse
      });
      throw error;
    }
  }

  /**
   * Get available points for a user in FIFO order
   */
  async getAvailablePointsFIFO(userId: string): Promise<AvailablePointTransaction[]> {
    try {
      logger.info('Getting available points in FIFO order', { userId });

      const { data: availablePoints, error } = await this.supabase
        .from('point_transactions')
        .select(`
          id,
          amount,
          available_from,
          created_at,
          expires_at,
          description,
          metadata
        `)
        .eq('user_id', userId)
        .eq('status', POINT_STATUS.AVAILABLE)
        .gt('amount', 0) // Only positive amounts (earned points)
        .lte('available_from', new Date().toISOString()) // Only points that are available now
        .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`) // Not expired
        .order('available_from', { ascending: true })
        .order('created_at', { ascending: true });

      if (error) {
        logger.error('Failed to get available points', {
          error: error.message,
          userId
        });
        throw new Error(`Failed to get available points: ${error.message}`);
      }

      logger.info('Retrieved available points', {
        userId,
        count: availablePoints?.length || 0,
        totalAmount: availablePoints?.reduce((sum, p) => sum + p.amount, 0) || 0
      });

      return availablePoints || [];

    } catch (error) {
      logger.error('Error getting available points', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Calculate how much points can be used (without actually using them)
   */
  async calculateUsableAmount(userId: string, requestedAmount: number): Promise<{
    canUse: number;
    insufficient: boolean;
    availableBalance: number;
    breakdown: PointUsageDetail[];
  }> {
    try {
      logger.info('Calculating usable point amount', {
        userId,
        requestedAmount
      });

      const availablePoints = await this.getAvailablePointsFIFO(userId);
      
      let totalAvailable = 0;
      let canUse = 0;
      let remainingToUse = requestedAmount;
      const breakdown: PointUsageDetail[] = [];

      for (const point of availablePoints) {
        totalAvailable += point.amount;
        
        if (remainingToUse > 0) {
          const usedFromThis = Math.min(point.amount, remainingToUse);
          canUse += usedFromThis;
          remainingToUse -= usedFromThis;

          breakdown.push({
            transactionId: point.id,
            originalAmount: point.amount,
            usedAmount: usedFromThis,
            remainingAmount: point.amount - usedFromThis,
            availableFrom: point.available_from,
            createdAt: point.created_at
          });
        }
      }

      const result = {
        canUse,
        insufficient: canUse < requestedAmount,
        availableBalance: totalAvailable,
        breakdown
      };

      logger.info('Point usage calculation completed', {
        userId,
        requestedAmount,
        ...result
      });

      return result;

    } catch (error) {
      logger.error('Error calculating usable amount', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        requestedAmount
      });
      throw error;
    }
  }

  /**
   * Get point usage history for a user
   */
  async getPointUsageHistory(
    userId: string,
    limit: number = 20,
    offset: number = 0
  ): Promise<{
    usageHistory: PointTransaction[];
    totalCount: number;
  }> {
    try {
      logger.info('Getting point usage history', {
        userId,
        limit,
        offset
      });

      // Get usage transactions
      const { data: usageHistory, error: historyError } = await this.supabase
        .from('point_transactions')
        .select('*')
        .eq('user_id', userId)
        .eq('transaction_type', POINT_TRANSACTION_TYPES.USED_SERVICE)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (historyError) {
        throw new Error(`Failed to get usage history: ${historyError.message}`);
      }

      // Get total count
      const { count, error: countError } = await this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('transaction_type', POINT_TRANSACTION_TYPES.USED_SERVICE);

      if (countError) {
        throw new Error(`Failed to get usage count: ${countError.message}`);
      }

      logger.info('Point usage history retrieved', {
        userId,
        historyCount: usageHistory?.length || 0,
        totalCount: count || 0
      });

      return {
        usageHistory: usageHistory || [],
        totalCount: count || 0
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
   * Validate point usage request
   */
  private validateUsageRequest(request: FIFOPointUsageRequest): void {
    const { userId, amountToUse } = request;

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!amountToUse || amountToUse <= 0) {
      throw new Error('Amount to use must be positive');
    }

    if (amountToUse < 1) {
      throw new Error('Minimum usage amount is 1 point');
    }

    if (amountToUse > 1000000) {
      throw new Error('Maximum usage amount is 1,000,000 points');
    }

    logger.debug('Point usage request validated', {
      userId,
      amountToUse
    });
  }
}

export const fifoPointUsageService = new FIFOPointUsageService();