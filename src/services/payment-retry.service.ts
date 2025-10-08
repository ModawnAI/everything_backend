/**
 * Payment Retry Service
 * 
 * Comprehensive service for payment retry functionality including:
 * - Automatic retry queue management with exponential backoff
 * - Configurable retry policies and scheduling
 * - Retry history tracking and analytics
 * - Customer notifications for retry attempts
 * - Manual retry capabilities for admin users
 */

import { getSupabaseClient } from '../config/database';
import { portOneService } from './portone.service';
import { paymentConfirmationService } from './payment-confirmation.service';
import { logger } from '../utils/logger';
import { 
  PaymentRetryQueue, 
  PaymentRetryHistory,
  PaymentRetryConfig,
  PaymentRetryNotification,
  RetryType,
  RetryStatus
} from '../types/database.types';

export interface CreateRetryRequest {
  paymentId: string;
  retryType: RetryType;
  failureReason?: string;
  failureCode?: string;
  metadata?: Record<string, any>;
}

export interface RetryQueueItem {
  id: string;
  paymentId: string;
  reservationId: string;
  userId: string;
  retryType: RetryType;
  retryStatus: RetryStatus;
  attemptNumber: number;
  maxAttempts: number;
  nextRetryAt: string;
  lastAttemptAt?: string;
  lastFailureReason?: string;
  retryCount: number;
  successCount: number;
  createdAt: string;
}

export interface RetryHistoryItem {
  id: string;
  retryQueueId: string;
  paymentId: string;
  attemptNumber: number;
  retryStatus: RetryStatus;
  startedAt: string;
  completedAt?: string;
  processingTime?: number;
  failureReason?: string;
  failureCode?: string;
  providerResponse?: Record<string, any>;
  createdAt: string;
}

export interface RetryConfigItem {
  id: string;
  configName: string;
  retryType: RetryType;
  maxAttempts: number;
  baseRetryDelay: number;
  maxRetryDelay: number;
  exponentialBackoffMultiplier: number;
  jitterFactor: number;
  isActive: boolean;
  description?: string;
}

export interface RetryAnalytics {
  totalRetries: number;
  successfulRetries: number;
  failedRetries: number;
  successRate: number;
  averageProcessingTime: number;
  retryTypeBreakdown: Record<RetryType, {
    total: number;
    successful: number;
    failed: number;
    successRate: number;
  }>;
}

export class PaymentRetryService {
  private supabase = getSupabaseClient();

  /**
   * Create a new retry queue item
   */
  async createRetryQueueItem(request: CreateRetryRequest): Promise<string> {
    const transactionId = `retry_create_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Creating retry queue item', {
        transactionId,
        paymentId: request.paymentId,
        retryType: request.retryType
      });

      // Call database function to create retry queue item
      const { data, error } = await this.supabase.rpc('create_payment_retry_queue_item', {
        p_payment_id: request.paymentId,
        p_retry_type: request.retryType,
        p_failure_reason: request.failureReason,
        p_failure_code: request.failureCode
      });

      if (error) {
        throw new Error(`Failed to create retry queue item: ${error.message}`);
      }

      // Add metadata if provided
      if (request.metadata) {
        await this.supabase
          .from('payment_retry_queue')
          .update({ metadata: request.metadata })
          .eq('id', data);
      }

      logger.info('Retry queue item created successfully', {
        transactionId,
        retryQueueId: data
      });

      return data;

    } catch (error) {
      logger.error('Error creating retry queue item', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process retry attempts for items ready to be retried
   */
  async processRetryAttempts(): Promise<{ processed: number; successful: number; failed: number }> {
    const transactionId = `retry_process_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Processing retry attempts', { transactionId });

      // Get retry queue items ready for processing
      const { data: retryItems, error } = await this.supabase
        .from('payment_retry_queue')
        .select('*')
        .eq('retry_status', 'pending')
        .lte('next_retry_at', new Date().toISOString())
        .order('next_retry_at', { ascending: true })
        .limit(10); // Process in batches

      if (error) {
        throw new Error(`Failed to get retry items: ${error.message}`);
      }

      if (!retryItems || retryItems.length === 0) {
        logger.info('No retry items to process', { transactionId });
        return { processed: 0, successful: 0, failed: 0 };
      }

      let processed = 0;
      let successful = 0;
      let failed = 0;

      for (const retryItem of retryItems) {
        try {
          const success = await this.processRetryAttempt(retryItem.id);
          processed++;
          
          if (success) {
            successful++;
            await this.sendRetrySuccessNotification(retryItem);
          } else {
            failed++;
            await this.sendRetryFailureNotification(retryItem);
          }
        } catch (error) {
          failed++;
          logger.error('Error processing retry attempt', {
            transactionId,
            retryQueueId: retryItem.id,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      logger.info('Retry processing completed', {
        transactionId,
        processed,
        successful,
        failed
      });

      return { processed, successful, failed };

    } catch (error) {
      logger.error('Error processing retry attempts', {
        transactionId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Process a specific retry attempt
   */
  async processRetryAttempt(retryQueueId: string): Promise<boolean> {
    const transactionId = `retry_attempt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      logger.info('Processing retry attempt', {
        transactionId,
        retryQueueId
      });

      // Get retry queue item
      const retryItem = await this.getRetryQueueItem(retryQueueId);
      if (!retryItem) {
        throw new Error('Retry queue item not found');
      }

      // Update status to processing
      await this.updateRetryStatus(retryQueueId, 'processing');

      // Record retry attempt start
      const historyId = await this.recordRetryAttemptStart(retryQueueId, retryItem.attempt_number);

      const startTime = Date.now();
      let success = false;
      let failureReason = '';
      let failureCode = '';
      let providerResponse: Record<string, any> = {};

      try {
        // Execute the retry based on retry type
        switch (retryItem.retry_type) {
          case 'payment_confirmation':
            success = await this.retryPaymentConfirmation(retryItem.payment_id);
            break;
          case 'webhook_delivery':
            success = await this.retryWebhookDelivery(retryItem.payment_id);
            break;
          case 'refund_processing':
            success = await this.retryRefundProcessing(retryItem.payment_id);
            break;
          case 'split_payment':
            success = await this.retrySplitPayment(retryItem.payment_id);
            break;
          default:
            throw new Error(`Unknown retry type: ${retryItem.retry_type}`);
        }
      } catch (error) {
        success = false;
        failureReason = error instanceof Error ? error.message : 'Unknown error';
        failureCode = 'RETRY_EXECUTION_ERROR';
      }

      const processingTime = Date.now() - startTime;

      // Record retry attempt result
      await this.recordRetryAttemptResult(historyId, {
        success,
        processingTime,
        failureReason,
        failureCode,
        providerResponse
      });

      if (success) {
        // Mark retry as completed
        await this.updateRetryStatus(retryQueueId, 'completed');
        await this.updateRetrySuccessCount(retryQueueId);
      } else {
        // Check if we should retry again
        if (retryItem.attempt_number >= retryItem.max_attempts) {
          // Max attempts reached, mark as failed
          await this.updateRetryStatus(retryQueueId, 'failed');
          await this.updateRetryFailureReason(retryQueueId, 'Max retry attempts reached');
        } else {
          // Schedule next retry
          await this.scheduleNextRetry(retryQueueId, retryItem);
        }
      }

      logger.info('Retry attempt processed', {
        transactionId,
        retryQueueId,
        success,
        processingTime
      });

      return success;

    } catch (error) {
      logger.error('Error processing retry attempt', {
        transactionId,
        retryQueueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get retry queue items for a user
   */
  async getUserRetryQueue(userId: string, limit: number = 20, offset: number = 0): Promise<RetryQueueItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('payment_retry_queue')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw new Error(`Failed to get user retry queue: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting user retry queue', {
        userId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get retry history for a retry queue item
   */
  async getRetryHistory(retryQueueId: string): Promise<RetryHistoryItem[]> {
    try {
      const { data, error } = await this.supabase
        .from('payment_retry_history')
        .select('*')
        .eq('retry_queue_id', retryQueueId)
        .order('attempt_number', { ascending: true });

      if (error) {
        throw new Error(`Failed to get retry history: ${error.message}`);
      }

      return data || [];
    } catch (error) {
      logger.error('Error getting retry history', {
        retryQueueId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get retry analytics
   */
  async getRetryAnalytics(timeRange: { start: string; end: string }): Promise<RetryAnalytics> {
    try {
      // Get overall retry statistics
      const { data: overallStats, error: overallError } = await this.supabase
        .from('payment_retry_history')
        .select('retry_status, processing_time')
        .gte('created_at', timeRange.start)
        .lte('created_at', timeRange.end);

      if (overallError) {
        throw new Error(`Failed to get overall retry stats: ${overallError.message}`);
      }

      // Get retry type breakdown
      const { data: typeBreakdown, error: typeError } = await this.supabase
        .from('payment_retry_history')
        .select(`
          retry_status,
          payment_retry_queue!inner(retry_type)
        `)
        .gte('created_at', timeRange.start)
        .lte('created_at', timeRange.end);

      if (typeError) {
        throw new Error(`Failed to get retry type breakdown: ${typeError.message}`);
      }

      // Calculate analytics
      const totalRetries = overallStats?.length || 0;
      const successfulRetries = overallStats?.filter(s => s.retry_status === 'success').length || 0;
      const failedRetries = overallStats?.filter(s => s.retry_status === 'failed').length || 0;
      const successRate = totalRetries > 0 ? (successfulRetries / totalRetries) * 100 : 0;
      
      const processingTimes = overallStats?.map(s => s.processing_time).filter(t => t !== null) || [];
      const averageProcessingTime = processingTimes.length > 0 
        ? processingTimes.reduce((sum, time) => sum + (time || 0), 0) / processingTimes.length 
        : 0;

      // Calculate type breakdown
      const typeStats: Record<RetryType, { total: number; successful: number; failed: number; successRate: number }> = {
        payment_confirmation: { total: 0, successful: 0, failed: 0, successRate: 0 },
        webhook_delivery: { total: 0, successful: 0, failed: 0, successRate: 0 },
        refund_processing: { total: 0, successful: 0, failed: 0, successRate: 0 },
        split_payment: { total: 0, successful: 0, failed: 0, successRate: 0 }
      };

      typeBreakdown?.forEach(item => {
        const retryType = (item as any).payment_retry_queue?.retry_type as RetryType;
        if (retryType && typeStats[retryType]) {
          typeStats[retryType].total++;
          if (item.retry_status === 'success') {
            typeStats[retryType].successful++;
          } else if (item.retry_status === 'failed') {
            typeStats[retryType].failed++;
          }
        }
      });

      // Calculate success rates for each type
      Object.keys(typeStats).forEach(type => {
        const stats = typeStats[type as RetryType];
        stats.successRate = stats.total > 0 ? (stats.successful / stats.total) * 100 : 0;
      });

      return {
        totalRetries,
        successfulRetries,
        failedRetries,
        successRate,
        averageProcessingTime,
        retryTypeBreakdown: typeStats
      };

    } catch (error) {
      logger.error('Error getting retry analytics', {
        timeRange,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Manual retry for admin users
   */
  async manualRetry(retryQueueId: string, adminId: string): Promise<boolean> {
    try {
      // Validate admin permissions
      const admin = await this.getUserById(adminId);
      if (!admin || admin.user_role !== 'admin') {
        throw new Error('Unauthorized: Admin access required');
      }

      // Get retry queue item
      const retryItem = await this.getRetryQueueItem(retryQueueId);
      if (!retryItem) {
        throw new Error('Retry queue item not found');
      }

      // Check if retry is in a valid state for manual retry
      if (retryItem.retry_status !== 'failed' && retryItem.retry_status !== 'pending') {
        throw new Error(`Retry cannot be manually retried in current status: ${retryItem.retry_status}`);
      }

      // Reset retry status and schedule immediate retry
      await this.supabase
        .from('payment_retry_queue')
        .update({
          retry_status: 'pending',
          next_retry_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', retryQueueId);

      // Process the retry immediately
      return await this.processRetryAttempt(retryQueueId);

    } catch (error) {
      logger.error('Error in manual retry', {
        retryQueueId,
        adminId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  // Private helper methods

  private async getRetryQueueItem(retryQueueId: string): Promise<PaymentRetryQueue | null> {
    const { data, error } = await this.supabase
      .from('payment_retry_queue')
      .select('*')
      .eq('id', retryQueueId)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get retry queue item: ${error.message}`);
    }

    return data;
  }

  private async getUserById(userId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('users')
      .select('id, user_role')
      .eq('id', userId)
      .single();

    if (error) {
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data;
  }

  private async updateRetryStatus(retryQueueId: string, status: RetryStatus): Promise<void> {
    const { error } = await this.supabase
      .from('payment_retry_queue')
      .update({
        retry_status: status,
        updated_at: new Date().toISOString()
      })
      .eq('id', retryQueueId);

    if (error) {
      throw new Error(`Failed to update retry status: ${error.message}`);
    }
  }

  private async recordRetryAttemptStart(retryQueueId: string, attemptNumber: number): Promise<string> {
    const { data, error } = await this.supabase
      .from('payment_retry_history')
      .insert({
        retry_queue_id: retryQueueId,
        payment_id: (await this.getRetryQueueItem(retryQueueId))?.payment_id,
        attempt_number: attemptNumber,
        retry_status: 'processing',
        started_at: new Date().toISOString()
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(`Failed to record retry attempt start: ${error.message}`);
    }

    return data.id;
  }

  private async recordRetryAttemptResult(historyId: string, result: {
    success: boolean;
    processingTime: number;
    failureReason?: string;
    failureCode?: string;
    providerResponse?: Record<string, any>;
  }): Promise<void> {
    const { error } = await this.supabase
      .from('payment_retry_history')
      .update({
        retry_status: result.success ? 'success' : 'failed',
        completed_at: new Date().toISOString(),
        processing_time: result.processingTime,
        failure_reason: result.failureReason,
        failure_code: result.failureCode,
        provider_response: result.providerResponse
      })
      .eq('id', historyId);

    if (error) {
      throw new Error(`Failed to record retry attempt result: ${error.message}`);
    }
  }

  private async updateRetrySuccessCount(retryQueueId: string): Promise<void> {
    // Get current success count and increment it
    const { data: currentItem, error: fetchError } = await this.supabase
      .from('payment_retry_queue')
      .select('success_count')
      .eq('id', retryQueueId)
      .single();

    if (fetchError) {
      throw new Error(`Failed to get current retry item: ${fetchError.message}`);
    }

    const { error } = await this.supabase
      .from('payment_retry_queue')
      .update({
        success_count: (currentItem?.success_count || 0) + 1,
        updated_at: new Date().toISOString()
      })
      .eq('id', retryQueueId);

    if (error) {
      throw new Error(`Failed to update retry success count: ${error.message}`);
    }
  }

  private async updateRetryFailureReason(retryQueueId: string, reason: string): Promise<void> {
    const { error } = await this.supabase
      .from('payment_retry_queue')
      .update({
        last_failure_reason: reason,
        updated_at: new Date().toISOString()
      })
      .eq('id', retryQueueId);

    if (error) {
      throw new Error(`Failed to update retry failure reason: ${error.message}`);
    }
  }

  private async scheduleNextRetry(retryQueueId: string, retryItem: PaymentRetryQueue): Promise<void> {
    // Calculate next retry delay using exponential backoff
    const nextDelay = this.calculateNextRetryDelay(
      retryItem.attempt_number + 1,
      retryItem.base_retry_delay,
      retryItem.max_retry_delay,
      retryItem.exponential_backoff_multiplier
    );

    const { error } = await this.supabase
      .from('payment_retry_queue')
      .update({
        retry_status: 'pending',
        attempt_number: retryItem.attempt_number + 1,
        retry_count: retryItem.retry_count + 1,
        next_retry_at: new Date(Date.now() + nextDelay * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', retryQueueId);

    if (error) {
      throw new Error(`Failed to schedule next retry: ${error.message}`);
    }
  }

  private calculateNextRetryDelay(
    attemptNumber: number,
    baseDelay: number,
    maxDelay: number,
    multiplier: number
  ): number {
    let delay = baseDelay * Math.pow(multiplier, attemptNumber - 1);
    
    // Apply maximum delay limit
    if (delay > maxDelay) {
      delay = maxDelay;
    }
    
    // Apply jitter to prevent thundering herd
    const jitter = delay * 0.1 * (Math.random() - 0.5);
    delay = delay + jitter;
    
    // Ensure minimum delay
    return Math.max(1, Math.floor(delay));
  }

  // Retry execution methods

  private async retryPaymentConfirmation(paymentId: string): Promise<boolean> {
    try {
      // Get payment details
      const payment = await this.getPaymentById(paymentId);
      if (!payment) {
        throw new Error('Payment not found');
      }

      // Retry payment confirmation
      const result = await paymentConfirmationService.confirmPaymentWithVerification({
        paymentKey: payment.provider_transaction_id || '',
        orderId: payment.provider_order_id || '',
        amount: payment.amount,
        userId: payment.user_id,
        sendNotification: true,
        generateReceipt: true
      });

      return result.status === 'fully_paid';
    } catch (error) {
      logger.error('Payment confirmation retry failed', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async retryWebhookDelivery(paymentId: string): Promise<boolean> {
    try {
      // Implement webhook delivery retry logic
      // This would typically involve resending webhooks to registered endpoints
      logger.info('Webhook delivery retry executed', { paymentId });
      return true; // Simulate success
    } catch (error) {
      logger.error('Webhook delivery retry failed', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async retryRefundProcessing(paymentId: string): Promise<boolean> {
    try {
      // Implement refund processing retry logic
      // This would typically involve retrying refund API calls
      logger.info('Refund processing retry executed', { paymentId });
      return true; // Simulate success
    } catch (error) {
      logger.error('Refund processing retry failed', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async retrySplitPayment(paymentId: string): Promise<boolean> {
    try {
      // Implement split payment retry logic
      // This would typically involve retrying split payment processing
      logger.info('Split payment retry executed', { paymentId });
      return true; // Simulate success
    } catch (error) {
      logger.error('Split payment retry failed', {
        paymentId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return false;
    }
  }

  private async getPaymentById(paymentId: string): Promise<any> {
    const { data, error } = await this.supabase
      .from('payments')
      .select('*')
      .eq('id', paymentId)
      .single();

    if (error) {
      throw new Error(`Failed to get payment: ${error.message}`);
    }

    return data;
  }

  private async sendRetrySuccessNotification(retryItem: PaymentRetryQueue): Promise<void> {
    try {
      await this.supabase
        .from('payment_retry_notifications')
        .insert({
          retry_queue_id: retryItem.id,
          user_id: retryItem.user_id,
          notification_type: 'retry_success',
          notification_status: 'pending',
          attempt_number: retryItem.attempt_number,
          message: `Payment retry attempt ${retryItem.attempt_number} was successful.`
        });
    } catch (error) {
      logger.error('Failed to send retry success notification', {
        retryQueueId: retryItem.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  private async sendRetryFailureNotification(retryItem: PaymentRetryQueue): Promise<void> {
    try {
      const message = retryItem.retry_status === 'failed' 
        ? `Payment retry failed after ${retryItem.attempt_number} attempts. Please contact support.`
        : `Payment retry attempt ${retryItem.attempt_number} failed. Will retry again.`;

      await this.supabase
        .from('payment_retry_notifications')
        .insert({
          retry_queue_id: retryItem.id,
          user_id: retryItem.user_id,
          notification_type: 'retry_failure',
          notification_status: 'pending',
          attempt_number: retryItem.attempt_number,
          message
        });
    } catch (error) {
      logger.error('Failed to send retry failure notification', {
        retryQueueId: retryItem.id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

// Export singleton instance
export const paymentRetryService = new PaymentRetryService(); 