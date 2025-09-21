/**
 * Payment Service
 * 
 * Handles payment-related operations for the referral system
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

export interface PaymentTransaction {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  type: 'referral_bonus' | 'cash_payout' | 'refund' | 'admin_adjustment';
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  payment_method: 'bank_transfer' | 'digital_wallet' | 'points' | 'admin';
  description: string;
  reference_id?: string;
  created_at: string;
  updated_at: string;
}

export interface PaymentRequest {
  userId: string;
  amount: number;
  currency: string;
  type: PaymentTransaction['type'];
  paymentMethod: PaymentTransaction['payment_method'];
  description: string;
  referenceId?: string;
}

export class PaymentService {
  private supabase = getSupabaseClient();

  /**
   * Process a payment transaction
   */
  async processPayment(request: PaymentRequest): Promise<PaymentTransaction> {
    try {
      // Create payment transaction record
      const { data: transaction, error } = await this.supabase
        .from('payment_transactions')
        .insert({
          user_id: request.userId,
          amount: request.amount,
          currency: request.currency,
          type: request.type,
          status: 'pending',
          payment_method: request.paymentMethod,
          description: request.description,
          reference_id: request.referenceId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to create payment transaction: ${error.message}`);
      }

      // Process the payment based on method
      let paymentResult: boolean;
      switch (request.paymentMethod) {
        case 'points':
          paymentResult = await this.processPointsPayment(request.userId, request.amount);
          break;
        case 'bank_transfer':
          paymentResult = await this.processBankTransfer(request.userId, request.amount, request.currency);
          break;
        case 'digital_wallet':
          paymentResult = await this.processDigitalWalletPayment(request.userId, request.amount, request.currency);
          break;
        case 'admin':
          paymentResult = true; // Admin payments are always successful
          break;
        default:
          throw new Error(`Unsupported payment method: ${request.paymentMethod}`);
      }

      // Update transaction status
      const status = paymentResult ? 'completed' : 'failed';
      await this.updatePaymentStatus(transaction.id, status);

      logger.info('Payment processed', {
        transactionId: transaction.id,
        userId: request.userId,
        amount: request.amount,
        method: request.paymentMethod,
        status
      });

      return { ...transaction, status };
    } catch (error) {
      logger.error('Failed to process payment', {
        userId: request.userId,
        amount: request.amount,
        method: request.paymentMethod,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process points payment
   */
  private async processPointsPayment(userId: string, amount: number): Promise<boolean> {
    try {
      // Check if user has sufficient points
      const { data: user, error } = await this.supabase
        .from('users')
        .select('available_points')
        .eq('id', userId)
        .single();

      if (error || !user) {
        throw new Error('User not found');
      }

      if (user.available_points < amount) {
        throw new Error('Insufficient points');
      }

      // Deduct points - get current balance first
      const { data: currentUser, error: getUserError } = await this.supabase
        .from('users')
        .select('available_points')
        .eq('id', userId)
        .single();

      if (getUserError || !currentUser) {
        throw new Error('User not found');
      }

      const { error: updateError } = await this.supabase
        .from('users')
        .update({
          available_points: user.available_points - amount,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw new Error(`Failed to deduct points: ${updateError.message}`);
      }

      return true;
    } catch (error) {
      logger.error('Points payment failed', {
        userId,
        amount,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Process bank transfer payment
   */
  private async processBankTransfer(userId: string, amount: number, currency: string): Promise<boolean> {
    try {
      // In a real implementation, this would integrate with a payment gateway
      // For now, we'll simulate a successful bank transfer
      logger.info('Bank transfer payment processed', {
        userId,
        amount,
        currency
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      return true;
    } catch (error) {
      logger.error('Bank transfer payment failed', {
        userId,
        amount,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Process digital wallet payment
   */
  private async processDigitalWalletPayment(userId: string, amount: number, currency: string): Promise<boolean> {
    try {
      // In a real implementation, this would integrate with digital wallet providers
      // For now, we'll simulate a successful digital wallet payment
      logger.info('Digital wallet payment processed', {
        userId,
        amount,
        currency
      });

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500));

      return true;
    } catch (error) {
      logger.error('Digital wallet payment failed', {
        userId,
        amount,
        currency,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  /**
   * Update payment transaction status
   */
  private async updatePaymentStatus(transactionId: string, status: PaymentTransaction['status']): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('payment_transactions')
        .update({
          status,
          updated_at: new Date().toISOString()
        })
        .eq('id', transactionId);

      if (error) {
        throw new Error(`Failed to update payment status: ${error.message}`);
      }
    } catch (error) {
      logger.error('Failed to update payment status', {
        transactionId,
        status,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get user's payment history
   */
  async getUserPaymentHistory(
    userId: string, 
    limit: number = 50, 
    offset: number = 0
  ): Promise<PaymentTransaction[]> {
    try {
      const { data: transactions, error } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get payment history: ${error.message}`);
      }

      return transactions || [];
    } catch (error) {
      logger.error('Failed to get user payment history', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get payment transaction by ID
   */
  async getPaymentTransaction(transactionId: string): Promise<PaymentTransaction | null> {
    try {
      const { data: transaction, error } = await this.supabase
        .from('payment_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Transaction not found
        }
        throw new Error(`Failed to get payment transaction: ${error.message}`);
      }

      return transaction;
    } catch (error) {
      logger.error('Failed to get payment transaction', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }
}

export const paymentService = new PaymentService();
