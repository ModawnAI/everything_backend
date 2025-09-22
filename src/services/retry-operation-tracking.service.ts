import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { RetryContext, RetryResult } from './enhanced-retry-mechanism.service';

export interface RetryOperationTrackingConfig {
  enableTracking: boolean;
  daysToKeep: number;
}

export interface RetryOperationStats {
  operationType: string;
  totalOperations: number;
  successfulOperations: number;
  failedOperations: number;
  timeoutOperations: number;
  avgAttempts: number;
  avgDurationMs: number;
  maxDurationMs: number;
  conflictRate: number;
  lockTimeoutRate: number;
  deadlockRate: number;
}

export class RetryOperationTrackingService {
  private supabase = getSupabaseClient();
  private defaultConfig: RetryOperationTrackingConfig = {
    enableTracking: true,
    daysToKeep: 30
  };

  constructor(private config: Partial<RetryOperationTrackingConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Start tracking a retry operation
   */
  async startTracking(
    operationId: string,
    operationType: string,
    context: RetryContext,
    retryConfig: any
  ): Promise<string | null> {
    if (!this.config.enableTracking) {
      return null;
    }

    try {
      const { data, error } = await this.supabase.rpc('start_retry_operation_tracking', {
        p_operation_id: operationId,
        p_operation_type: operationType,
        p_user_id: context.userId || null,
        p_shop_id: context.shopId || null,
        p_reservation_id: context.reservationId || null,
        p_payment_id: null, // Will be set later if needed
        p_max_retries: retryConfig.maxRetries || 3,
        p_base_delay_ms: retryConfig.baseDelayMs || 100,
        p_max_delay_ms: retryConfig.maxDelayMs || 5000,
        p_exponential_backoff_multiplier: retryConfig.exponentialBackoffMultiplier || 2.0,
        p_jitter_factor: retryConfig.jitterFactor || 0.1,
        p_timeout_ms: retryConfig.timeoutMs || 30000,
        p_metadata: context.metadata || {}
      });

      if (error) {
        logger.error('Failed to start retry operation tracking', {
          error: error.message,
          operationId,
          operationType
        });
        return null;
      }

      logger.info('Started retry operation tracking', {
        operationId,
        operationType,
        trackingId: data
      });

      return data;

    } catch (error) {
      logger.error('Error starting retry operation tracking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationId,
        operationType
      });
      return null;
    }
  }

  /**
   * Record a retry attempt
   */
  async recordAttempt(
    operationId: string,
    attemptNumber: number,
    success: boolean,
    errorMessage?: string,
    errorType?: string,
    retryReason?: string,
    delayBeforeRetryMs?: number,
    timeoutUsedMs?: number,
    metadata?: Record<string, any>
  ): Promise<string | null> {
    if (!this.config.enableTracking) {
      return null;
    }

    try {
      const { data, error } = await this.supabase.rpc('record_retry_attempt', {
        p_operation_id: operationId,
        p_attempt_number: attemptNumber,
        p_success: success,
        p_error_message: errorMessage || null,
        p_error_type: errorType || null,
        p_retry_reason: retryReason || null,
        p_delay_before_retry_ms: delayBeforeRetryMs || null,
        p_timeout_used_ms: timeoutUsedMs || null,
        p_metadata: metadata || {}
      });

      if (error) {
        logger.error('Failed to record retry attempt', {
          error: error.message,
          operationId,
          attemptNumber
        });
        return null;
      }

      return data;

    } catch (error) {
      logger.error('Error recording retry attempt', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationId,
        attemptNumber
      });
      return null;
    }
  }

  /**
   * Complete retry operation tracking
   */
  async completeTracking(
    operationId: string,
    result: RetryResult,
    retryReasons: string[]
  ): Promise<void> {
    if (!this.config.enableTracking) {
      return;
    }

    try {
      const { error } = await this.supabase.rpc('complete_retry_operation', {
        p_operation_id: operationId,
        p_success: result.success,
        p_final_error_message: result.error || null,
        p_final_error_type: this.getErrorType(result.error || ''),
        p_retry_reasons: retryReasons,
        p_conflict_detected: result.conflictDetected || false,
        p_lock_timeout_detected: result.lockTimeout || false,
        p_deadlock_detected: result.deadlockDetected || false,
        p_metadata: {
          attempts: result.attempts,
          totalDurationMs: result.totalDurationMs,
          finalAttemptError: result.finalAttemptError
        }
      });

      if (error) {
        logger.error('Failed to complete retry operation tracking', {
          error: error.message,
          operationId
        });
        return;
      }

      logger.info('Completed retry operation tracking', {
        operationId,
        success: result.success,
        attempts: result.attempts,
        totalDurationMs: result.totalDurationMs
      });

    } catch (error) {
      logger.error('Error completing retry operation tracking', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationId
      });
    }
  }

  /**
   * Get retry operation statistics
   */
  async getStatistics(
    hoursBack: number = 24,
    shopId?: string,
    operationType?: string
  ): Promise<RetryOperationStats[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_retry_operation_statistics', {
        p_hours_back: hoursBack,
        p_shop_id: shopId || null,
        p_operation_type: operationType || null
      });

      if (error) {
        logger.error('Failed to get retry operation statistics', {
          error: error.message,
          hoursBack,
          shopId,
          operationType
        });
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Error getting retry operation statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursBack,
        shopId,
        operationType
      });
      throw error;
    }
  }

  /**
   * Cleanup old retry operation data
   */
  async cleanupOldData(daysToKeep?: number): Promise<{
    deletedOperations: number;
    deletedAttempts: number;
  }> {
    try {
      const { data, error } = await this.supabase.rpc('cleanup_retry_operation_data', {
        p_days_to_keep: daysToKeep || this.config.daysToKeep
      });

      if (error) {
        logger.error('Failed to cleanup retry operation data', {
          error: error.message,
          daysToKeep
        });
        throw error;
      }

      const result = data?.[0] || { deleted_operations: 0, deleted_attempts: 0 };

      logger.info('Retry operation data cleanup completed', {
        deletedOperations: result.deleted_operations,
        deletedAttempts: result.deleted_attempts,
        daysToKeep: daysToKeep || this.config.daysToKeep
      });

      return {
        deletedOperations: result.deleted_operations,
        deletedAttempts: result.deleted_attempts
      };

    } catch (error) {
      logger.error('Error cleaning up retry operation data', {
        error: error instanceof Error ? error.message : 'Unknown error',
        daysToKeep
      });
      throw error;
    }
  }

  /**
   * Get detailed retry operation by ID
   */
  async getOperationDetails(operationId: string): Promise<any> {
    try {
      const { data, error } = await this.supabase
        .from('retry_operations')
        .select(`
          *,
          retry_attempts (*)
        `)
        .eq('operation_id', operationId)
        .single();

      if (error) {
        logger.error('Failed to get operation details', {
          error: error.message,
          operationId
        });
        throw error;
      }

      return data;

    } catch (error) {
      logger.error('Error getting operation details', {
        error: error instanceof Error ? error.message : 'Unknown error',
        operationId
      });
      throw error;
    }
  }

  /**
   * Get retry operations for a specific shop
   */
  async getShopRetryOperations(
    shopId: string,
    hoursBack: number = 24,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('retry_operations')
        .select('*')
        .eq('shop_id', shopId)
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get shop retry operations', {
          error: error.message,
          shopId,
          hoursBack
        });
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Error getting shop retry operations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopId,
        hoursBack
      });
      throw error;
    }
  }

  /**
   * Get retry operations for a specific user
   */
  async getUserRetryOperations(
    userId: string,
    hoursBack: number = 24,
    limit: number = 100
  ): Promise<any[]> {
    try {
      const { data, error } = await this.supabase
        .from('retry_operations')
        .select('*')
        .eq('user_id', userId)
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        logger.error('Failed to get user retry operations', {
          error: error.message,
          userId,
          hoursBack
        });
        throw error;
      }

      return data || [];

    } catch (error) {
      logger.error('Error getting user retry operations', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        hoursBack
      });
      throw error;
    }
  }

  /**
   * Determine error type from error message
   */
  private getErrorType(errorMessage: string): string {
    if (errorMessage.includes('SLOT_CONFLICT') || errorMessage.includes('conflict')) {
      return 'conflict';
    }
    if (errorMessage.includes('ADVISORY_LOCK_TIMEOUT') || errorMessage.includes('timeout')) {
      return 'timeout';
    }
    if (errorMessage.includes('deadlock') || errorMessage.includes('Deadlock')) {
      return 'deadlock';
    }
    if (errorMessage.includes('Version conflict') || errorMessage.includes('version')) {
      return 'version_conflict';
    }
    if (errorMessage.includes('temporary')) {
      return 'temporary';
    }
    return 'unknown';
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryOperationTrackingConfig {
    return { ...this.config } as RetryOperationTrackingConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RetryOperationTrackingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

export const retryOperationTrackingService = new RetryOperationTrackingService();
