/**
 * Point Transaction Service
 * 
 * Comprehensive point transaction system with status tracking including:
 * - Point transaction creation and validation
 * - Status transition logic (pending, available, used, expired)
 * - 7-day pending period enforcement
 * - Point expiration handling
 * - Transaction history tracking
 * - Business rule validation
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { 
  PointTransaction, 
  PointTransactionType, 
  PointStatus,
  User 
} from '../types/database.types';

export interface CreatePointTransactionRequest {
  userId: string;
  transactionType: PointTransactionType;
  amount: number;
  description?: string;
  reservationId?: string;
  relatedUserId?: string;
  metadata?: Record<string, any>;
}

export interface PointTransactionResponse {
  id: string;
  userId: string;
  transactionType: PointTransactionType;
  amount: number;
  status: PointStatus;
  description?: string;
  availableFrom?: string;
  expiresAt?: string;
  createdAt: string;
  metadata?: Record<string, any>;
}

export interface PointBalanceResponse {
  totalEarned: number;
  totalUsed: number;
  availableBalance: number;
  pendingBalance: number;
  expiredBalance: number;
  lastCalculatedAt: string;
}

export interface PointTransactionHistoryResponse {
  transactions: PointTransactionResponse[];
  totalCount: number;
  hasMore: boolean;
  pagination: {
    page: number;
    limit: number;
    totalPages: number;
  };
}

export class PointTransactionService {
  private supabase = getSupabaseClient();

  /**
   * Create a new point transaction with proper validation and status tracking
   */
  async createTransaction(request: CreatePointTransactionRequest): Promise<PointTransactionResponse> {
    try {
      logger.info('Creating point transaction', {
        userId: request.userId,
        transactionType: request.transactionType,
        amount: request.amount,
        reservationId: request.reservationId
      });

      // Validate request
      this.validateTransactionRequest(request);

      // Get user information
      const user = await this.getUser(request.userId);
      if (!user) {
        throw new Error(`User not found: ${request.userId}`);
      }

      // Calculate transaction details
      const transactionDetails = await this.calculateTransactionDetails(request, user);

      // Create transaction record
      const { data: transaction, error } = await this.supabase
        .from('point_transactions')
        .insert({
          user_id: request.userId,
          reservation_id: request.reservationId,
          transaction_type: request.transactionType,
          amount: transactionDetails.amount,
          description: request.description || transactionDetails.description,
          status: transactionDetails.status,
          available_from: transactionDetails.availableFrom,
          expires_at: transactionDetails.expiresAt,
          related_user_id: request.relatedUserId,
          metadata: {
            ...request.metadata,
            ...transactionDetails.metadata,
            createdBy: 'system',
            createdAt: new Date().toISOString()
          }
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to create point transaction', {
          error: error.message,
          request
        });
        throw new Error(`Failed to create point transaction: ${error.message}`);
      }

      // Update user point balance
      await this.updateUserPointBalance(request.userId);

      logger.info('Point transaction created successfully', {
        transactionId: transaction.id,
        userId: request.userId,
        amount: transaction.amount,
        status: transaction.status
      });

      return this.mapToResponse(transaction);

    } catch (error) {
      logger.error('Error creating point transaction', {
        error: error instanceof Error ? error.message : 'Unknown error',
        request
      });
      throw error;
    }
  }

  /**
   * Get user's point balance with real-time calculation
   */
  async getUserPointBalance(userId: string): Promise<PointBalanceResponse> {
    try {
      logger.info('Getting user point balance', { userId });

      // Get user information
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Calculate real-time balance
      const balance = await this.calculateRealTimeBalance(userId);

      // Update user's cached balance
      await this.updateUserPointBalance(userId);

      logger.info('User point balance retrieved', {
        userId,
        availableBalance: balance.availableBalance,
        pendingBalance: balance.pendingBalance
      });

      return balance;

    } catch (error) {
      logger.error('Error getting user point balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Get user's point transaction history with pagination
   */
  async getUserTransactionHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
    filters?: {
      transactionType?: PointTransactionType;
      status?: PointStatus;
      startDate?: string;
      endDate?: string;
    }
  ): Promise<PointTransactionHistoryResponse> {
    try {
      logger.info('Getting user transaction history', {
        userId,
        page,
        limit,
        filters
      });

      // Validate user exists
      const user = await this.getUser(userId);
      if (!user) {
        throw new Error(`User not found: ${userId}`);
      }

      // Build query
      let query = this.supabase
        .from('point_transactions')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (filters?.transactionType) {
        query = query.eq('transaction_type', filters.transactionType);
      }

      if (filters?.status) {
        query = query.eq('status', filters.status);
      }

      if (filters?.startDate) {
        query = query.gte('created_at', filters.startDate);
      }

      if (filters?.endDate) {
        query = query.lte('created_at', filters.endDate);
      }

      // Apply pagination
      const offset = (page - 1) * limit;
      query = query.range(offset, offset + limit - 1);

      const { data: transactions, error, count } = await query;

      if (error) {
        logger.error('Failed to get transaction history', {
          error: error.message,
          userId
        });
        throw new Error(`Failed to get transaction history: ${error.message}`);
      }

      const totalCount = count || 0;
      const totalPages = Math.ceil(totalCount / limit);

      logger.info('Transaction history retrieved', {
        userId,
        transactionCount: transactions?.length || 0,
        totalCount,
        totalPages
      });

      return {
        transactions: transactions?.map(t => this.mapToResponse(t)) || [],
        totalCount,
        hasMore: page < totalPages,
        pagination: {
          page,
          limit,
          totalPages
        }
      };

    } catch (error) {
      logger.error('Error getting transaction history', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      throw error;
    }
  }

  /**
   * Update transaction status (for system operations)
   */
  async updateTransactionStatus(
    transactionId: string,
    newStatus: PointStatus,
    metadata?: Record<string, any>
  ): Promise<PointTransactionResponse> {
    try {
      logger.info('Updating transaction status', {
        transactionId,
        newStatus
      });

      // First get the current transaction to preserve previous status
      const { data: currentTransaction, error: getError } = await this.supabase
        .from('point_transactions')
        .select('status, user_id')
        .eq('id', transactionId)
        .single();

      if (getError) {
        logger.error('Failed to get current transaction', {
          error: getError.message,
          transactionId
        });
        throw new Error(`Failed to get current transaction: ${getError.message}`);
      }

      if (!currentTransaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      // Update the transaction
      const { data: transaction, error } = await this.supabase
        .from('point_transactions')
        .update({
          status: newStatus,
          updated_at: new Date().toISOString(),
          metadata: {
            ...metadata,
            statusUpdatedAt: new Date().toISOString(),
            previousStatus: currentTransaction.status
          }
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (error) {
        logger.error('Failed to update transaction status', {
          error: error.message,
          transactionId,
          newStatus
        });
        throw new Error(`Failed to update transaction status: ${error.message}`);
      }

      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      // Update user balance if status affects balance
      if (['available', 'used', 'expired'].includes(newStatus)) {
        await this.updateUserPointBalance(transaction.user_id);
      }

      logger.info('Transaction status updated successfully', {
        transactionId,
        newStatus,
        userId: transaction.user_id
      });

      return this.mapToResponse(transaction);

    } catch (error) {
      logger.error('Error updating transaction status', {
        error: error instanceof Error ? error.message : 'Unknown error',
        transactionId,
        newStatus
      });
      throw error;
    }
  }

  /**
   * Process pending points to available (7-day rule)
   */
  async processPendingToAvailable(): Promise<number> {
    try {
      logger.info('Processing pending points to available');

      const now = new Date().toISOString();

      const { data: pendingTransactions, error } = await this.supabase
        .from('point_transactions')
        .select('id, user_id')
        .eq('status', 'pending')
        .lte('available_from', now);

      if (error) {
        logger.error('Failed to get pending transactions', {
          error: error.message
        });
        throw new Error(`Failed to get pending transactions: ${error.message}`);
      }

      let processedCount = 0;

      for (const transaction of pendingTransactions || []) {
        try {
          await this.updateTransactionStatus(transaction.id, 'available', {
            processedAt: now,
            reason: '7-day pending period completed'
          });
          processedCount++;
        } catch (updateError) {
          logger.error('Failed to update transaction status', {
            transactionId: transaction.id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          });
        }
      }

      logger.info('Pending points processing completed', {
        processedCount,
        totalPending: pendingTransactions?.length || 0
      });

      return processedCount;

    } catch (error) {
      logger.error('Error processing pending points', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process expired points
   */
  async processExpiredPoints(): Promise<number> {
    try {
      logger.info('Processing expired points');

      const now = new Date().toISOString();

      const { data: expiredTransactions, error } = await this.supabase
        .from('point_transactions')
        .select('id, user_id')
        .eq('status', 'available')
        .lt('expires_at', now);

      if (error) {
        logger.error('Failed to get expired transactions', {
          error: error.message
        });
        throw new Error(`Failed to get expired transactions: ${error.message}`);
      }

      let processedCount = 0;

      for (const transaction of expiredTransactions || []) {
        try {
          await this.updateTransactionStatus(transaction.id, 'expired', {
            processedAt: now,
            reason: 'Points expired'
          });
          processedCount++;
        } catch (updateError) {
          logger.error('Failed to update expired transaction status', {
            transactionId: transaction.id,
            error: updateError instanceof Error ? updateError.message : 'Unknown error'
          });
        }
      }

      logger.info('Expired points processing completed', {
        processedCount,
        totalExpired: expiredTransactions?.length || 0
      });

      return processedCount;

    } catch (error) {
      logger.error('Error processing expired points', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate transaction request
   */
  private validateTransactionRequest(request: CreatePointTransactionRequest): void {
    if (!request.userId) {
      throw new Error('User ID is required');
    }

    if (!request.transactionType) {
      throw new Error('Transaction type is required');
    }

    if (!request.amount || request.amount === 0) {
      throw new Error('Amount must be non-zero');
    }

    // Validate amount based on transaction type
    if (['earned_service', 'earned_referral', 'influencer_bonus'].includes(request.transactionType)) {
      if (request.amount <= 0) {
        throw new Error('Earning transactions must have positive amount');
      }
    }

    if (['used_service', 'expired', 'adjusted'].includes(request.transactionType)) {
      if (request.amount >= 0) {
        throw new Error('Usage/expiration/adjustment transactions must have negative amount');
      }
    }
  }

  /**
   * Calculate transaction details based on type and user
   */
  private async calculateTransactionDetails(
    request: CreatePointTransactionRequest,
    user: User
  ): Promise<{
    amount: number;
    status: PointStatus;
    availableFrom?: string;
    expiresAt?: string;
    description: string;
    metadata: Record<string, any>;
  }> {
    const now = new Date();
    const oneYearFromNow = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000);

    switch (request.transactionType) {
      case 'earned_service':
        return {
          amount: request.amount,
          status: 'pending',
          availableFrom: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          expiresAt: oneYearFromNow.toISOString(),
          description: request.description || '서비스 이용 적립',
          metadata: {
            source: 'service_completion',
            baseAmount: request.amount,
            bonusAmount: 0
          }
        };

      case 'earned_referral':
        return {
          amount: request.amount,
          status: 'pending',
          availableFrom: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          expiresAt: oneYearFromNow.toISOString(),
          description: request.description || '추천 적립',
          metadata: {
            source: 'referral',
            referredUserId: request.relatedUserId
          }
        };

      case 'influencer_bonus':
        const bonusAmount = user.is_influencer ? request.amount * 2 : request.amount;
        return {
          amount: bonusAmount,
          status: 'pending',
          availableFrom: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
          expiresAt: oneYearFromNow.toISOString(),
          description: request.description || '인플루언서 보너스',
          metadata: {
            source: 'influencer_bonus',
            baseAmount: request.amount,
            bonusAmount: user.is_influencer ? request.amount : 0,
            isInfluencer: user.is_influencer
          }
        };

      case 'used_service':
        return {
          amount: request.amount, // Should be negative
          status: 'used',
          description: request.description || '서비스 결제 사용',
          metadata: {
            source: 'service_payment',
            reservationId: request.reservationId
          }
        };

      case 'expired':
        return {
          amount: request.amount, // Should be negative
          status: 'expired',
          description: request.description || '포인트 만료',
          metadata: {
            source: 'expiration',
            expiredAt: now.toISOString()
          }
        };

      case 'adjusted':
        return {
          amount: request.amount,
          status: 'available',
          expiresAt: oneYearFromNow.toISOString(),
          description: request.description || '관리자 조정',
          metadata: {
            source: 'admin_adjustment',
            adjustedBy: 'system'
          }
        };

      default:
        throw new Error(`Unsupported transaction type: ${request.transactionType}`);
    }
  }

  /**
   * Calculate real-time point balance
   */
  private async calculateRealTimeBalance(userId: string): Promise<PointBalanceResponse> {
    const { data: transactions, error } = await this.supabase
      .from('point_transactions')
      .select('amount, status')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get transactions: ${error.message}`);
    }

    let totalEarned = 0;
    let totalUsed = 0;
    let availableBalance = 0;
    let pendingBalance = 0;
    let expiredBalance = 0;

    for (const transaction of transactions || []) {
      if (transaction.amount > 0) {
        totalEarned += transaction.amount;
        
        switch (transaction.status) {
          case 'available':
            availableBalance += transaction.amount;
            break;
          case 'pending':
            pendingBalance += transaction.amount;
            break;
          case 'expired':
            expiredBalance += transaction.amount;
            break;
        }
      } else {
        totalUsed += Math.abs(transaction.amount);
        availableBalance += transaction.amount; // Negative amount
      }
    }

    return {
      totalEarned,
      totalUsed,
      availableBalance,
      pendingBalance,
      expiredBalance,
      lastCalculatedAt: new Date().toISOString()
    };
  }

  /**
   * Update user's cached point balance
   */
  private async updateUserPointBalance(userId: string): Promise<void> {
    try {
      const balance = await this.calculateRealTimeBalance(userId);

      const { error } = await this.supabase
        .from('users')
        .update({
          total_points: balance.totalEarned,
          available_points: balance.availableBalance,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (error) {
        logger.error('Failed to update user point balance', {
          error: error.message,
          userId
        });
      }
    } catch (error) {
      logger.error('Error updating user point balance', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
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

  /**
   * Map database transaction to response format
   */
  private mapToResponse(transaction: any): PointTransactionResponse {
    return {
      id: transaction.id,
      userId: transaction.user_id,
      transactionType: transaction.transaction_type,
      amount: transaction.amount,
      status: transaction.status,
      description: transaction.description,
      availableFrom: transaction.available_from,
      expiresAt: transaction.expires_at,
      createdAt: transaction.created_at,
      metadata: transaction.metadata
    };
  }
}

// Export singleton instance
export const pointTransactionService = new PointTransactionService(); 