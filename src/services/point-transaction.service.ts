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
import {
  POINT_POLICY_V32,
  POINT_CALCULATIONS,
  POINT_VALIDATION_RULES,
  POINT_TRANSACTION_TYPES,
  POINT_STATUS
} from '../constants/point-policies';

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
   * Calculate transaction details based on type and user using v3.2 policies
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
    const availabilityDate = POINT_CALCULATIONS.calculateAvailabilityDate();
    const expirationDate = POINT_CALCULATIONS.calculateExpirationDate(availabilityDate);

    // Get user's tier for multiplier calculations
    const userTotalPoints = await this.getUserTotalPointsEarned(user.id);
    const tierMultiplier = POINT_CALCULATIONS.getTierMultiplier(userTotalPoints);

    switch (request.transactionType) {
      case 'earned_service':
        // Calculate points using v3.2 policy with influencer and tier bonuses
        const servicePoints = POINT_CALCULATIONS.calculateServicePoints(
          request.amount, 
          user.is_influencer || false, 
          tierMultiplier
        );
        
        return {
          amount: servicePoints,
          status: POINT_STATUS.PENDING,
          availableFrom: availabilityDate.toISOString(),
          expiresAt: expirationDate.toISOString(),
          description: request.description || '서비스 이용 적립',
          metadata: {
            source: 'service_completion',
            originalAmount: request.amount,
            eligibleAmount: Math.min(request.amount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT),
            basePoints: Math.floor(Math.min(request.amount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT) * POINT_POLICY_V32.EARNING_RATE),
            influencerBonus: user.is_influencer ? Math.floor(Math.min(request.amount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT) * POINT_POLICY_V32.EARNING_RATE * (POINT_POLICY_V32.INFLUENCER_MULTIPLIER - 1)) : 0,
            tierBonus: Math.floor(Math.min(request.amount, POINT_POLICY_V32.MAX_ELIGIBLE_AMOUNT) * POINT_POLICY_V32.EARNING_RATE * (tierMultiplier - 1)),
            isInfluencer: user.is_influencer || false,
            userTier: POINT_CALCULATIONS.getUserTier(userTotalPoints),
            tierMultiplier,
            policyVersion: 'v3.2'
          }
        };

      case 'earned_referral':
        return {
          amount: POINT_POLICY_V32.REFERRAL_BASE_BONUS,
          status: POINT_STATUS.PENDING,
          availableFrom: availabilityDate.toISOString(),
          expiresAt: expirationDate.toISOString(),
          description: request.description || '추천 적립',
          metadata: {
            source: 'referral',
            referredUserId: request.relatedUserId,
            baseBonus: POINT_POLICY_V32.REFERRAL_BASE_BONUS,
            policyVersion: 'v3.2'
          }
        };

      case 'influencer_bonus':
        // Apply v3.2 influencer multiplier (2x)
        const influencerBonusAmount = user.is_influencer ? 
          Math.floor(request.amount * POINT_POLICY_V32.INFLUENCER_MULTIPLIER) : 
          request.amount;
          
        return {
          amount: influencerBonusAmount,
          status: POINT_STATUS.PENDING,
          availableFrom: availabilityDate.toISOString(),
          expiresAt: expirationDate.toISOString(),
          description: request.description || '인플루언서 보너스',
          metadata: {
            source: 'influencer_bonus',
            baseAmount: request.amount,
            bonusAmount: user.is_influencer ? Math.floor(request.amount * (POINT_POLICY_V32.INFLUENCER_MULTIPLIER - 1)) : 0,
            multiplier: POINT_POLICY_V32.INFLUENCER_MULTIPLIER,
            isInfluencer: user.is_influencer || false,
            policyVersion: 'v3.2'
          }
        };

      case 'used_service':
        return {
          amount: request.amount, // Should be negative
          status: POINT_STATUS.USED,
          description: request.description || '서비스 결제 사용',
          metadata: {
            source: 'service_payment',
            reservationId: request.reservationId,
            policyVersion: 'v3.2'
          }
        };

      case 'expired':
        return {
          amount: request.amount, // Should be negative
          status: POINT_STATUS.EXPIRED,
          description: request.description || '포인트 만료',
          metadata: {
            source: 'expiration',
            expiredAt: now.toISOString(),
            policyVersion: 'v3.2'
          }
        };

      case 'adjusted':
        return {
          amount: request.amount,
          status: POINT_STATUS.AVAILABLE,
          expiresAt: expirationDate.toISOString(),
          description: request.description || '관리자 조정',
          metadata: {
            source: 'admin_adjustment',
            adjustedBy: 'system',
            policyVersion: 'v3.2'
          }
        };

      default:
        throw new Error(`Unsupported transaction type: ${request.transactionType}`);
    }
  }

  /**
   * Calculate real-time point balance
   * Implements exact calculation from POINTS_SYSTEM_DOCUMENTATION.md
   */
  private async calculateRealTimeBalance(userId: string): Promise<PointBalanceResponse> {
    const { data: transactions, error } = await this.supabase
      .from('point_transactions')
      .select('amount, status, transaction_type, available_from, expires_at')
      .eq('user_id', userId);

    if (error) {
      throw new Error(`Failed to get transactions: ${error.message}`);
    }

    const now = new Date();
    let totalEarned = 0;
    let totalUsed = 0;
    let availableBalance = 0;
    let pendingBalance = 0;
    let expiredBalance = 0;

    for (const transaction of transactions || []) {
      const amount = transaction.amount || 0;
      const transactionType = transaction.transaction_type;
      const status = transaction.status;
      const availableFrom = transaction.available_from ? new Date(transaction.available_from) : null;
      const expiresAt = transaction.expires_at ? new Date(transaction.expires_at) : null;

      // Calculate totalEarned: Sum of ALL positive amounts
      if (amount > 0 && ['earned_service', 'earned_referral', 'influencer_bonus', 'adjusted'].includes(transactionType)) {
        totalEarned += amount;
      }

      // Calculate totalUsed: Sum of ALL negative amounts (stored as absolute values)
      if (amount < 0 || (transactionType === 'used_service' && amount > 0)) {
        totalUsed += Math.abs(amount);
      }

      // Calculate availableBalance: Available points that are not expired
      if (status === 'available' && ['earned_service', 'earned_referral', 'influencer_bonus'].includes(transactionType)) {
        if (!expiresAt || expiresAt > now) {
          availableBalance += amount;
        }
      }

      // Calculate pendingBalance: Points in pending status
      if (status === 'pending' && availableFrom && availableFrom > now) {
        pendingBalance += amount;
      }

      // Calculate expiredBalance: Points that have expired
      if (status === 'expired' || (expiresAt && expiresAt < now && status === 'available')) {
        expiredBalance += amount;
      }
    }

    // Subtract used points from available balance
    availableBalance = availableBalance - totalUsed;

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
   * Get user's total points earned (for tier calculation)
   */
  private async getUserTotalPointsEarned(userId: string): Promise<number> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('point_transactions')
        .select('amount')
        .eq('user_id', userId)
        .gt('amount', 0); // Only positive amounts (earned points)

      if (error) {
        logger.error('Failed to get user total points earned', {
          error: error.message,
          userId
        });
        return 0;
      }

      const totalEarned = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;
      return totalEarned;
    } catch (error) {
      logger.error('Error calculating user total points earned', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return 0;
    }
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