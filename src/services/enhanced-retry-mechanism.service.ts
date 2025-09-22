import { logger } from '../utils/logger';
import { concurrentBookingPreventionService } from './concurrent-booking-prevention.service';
import { enhancedAdvisoryLocksService } from './enhanced-advisory-locks.service';

export interface RetryConfig {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  exponentialBackoffMultiplier: number;
  jitterFactor: number;
  timeoutMs: number;
}

export interface RetryContext {
  operationId: string;
  operationType: 'reservation_creation' | 'reservation_update' | 'payment_processing' | 'conflict_resolution';
  userId?: string;
  shopId?: string;
  reservationId?: string;
  metadata?: Record<string, any>;
}

export interface RetryResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  attempts: number;
  totalDurationMs: number;
  finalAttemptError?: string;
  retryReasons: string[];
  conflictDetected?: boolean;
  lockTimeout?: boolean;
  deadlockDetected?: boolean;
}

export interface RetryableOperation<T = any> {
  execute: () => Promise<T>;
  shouldRetry: (error: Error, attempt: number) => boolean;
  getRetryDelay: (attempt: number, error: Error) => number;
  onRetry?: (attempt: number, error: Error) => Promise<void>;
  onSuccess?: (result: T, attempts: number) => Promise<void>;
  onFailure?: (error: Error, attempts: number) => Promise<void>;
}

export class EnhancedRetryMechanismService {
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    baseDelayMs: 100,
    maxDelayMs: 5000,
    exponentialBackoffMultiplier: 2,
    jitterFactor: 0.1,
    timeoutMs: 30000
  };

  constructor(private config: Partial<RetryConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Execute operation with enhanced retry mechanism
   */
  async executeWithRetry<T>(
    operation: RetryableOperation<T>,
    context: RetryContext
  ): Promise<RetryResult<T>> {
    const startTime = Date.now();
    const retryReasons: string[] = [];
    let lastError: Error | null = null;
    let attempts = 0;

    logger.info('Starting retryable operation', {
      operationId: context.operationId,
      operationType: context.operationType,
      maxRetries: this.config.maxRetries
    });

    for (let attempt = 1; attempt <= this.config.maxRetries! + 1; attempt++) {
      attempts = attempt;

      try {
        logger.info(`Executing operation attempt ${attempt}`, {
          operationId: context.operationId,
          operationType: context.operationType,
          attempt,
          maxRetries: this.config.maxRetries
        });

        // Execute the operation with timeout
        const result = await this.executeWithTimeout(
          operation.execute(),
          this.config.timeoutMs!
        );

        const totalDurationMs = Date.now() - startTime;

        logger.info('Operation completed successfully', {
          operationId: context.operationId,
          operationType: context.operationType,
          attempts,
          totalDurationMs
        });

        // Call success callback if provided
        if (operation.onSuccess) {
          try {
            await operation.onSuccess(result, attempts);
          } catch (callbackError) {
            logger.warn('Success callback failed', {
              operationId: context.operationId,
              error: callbackError instanceof Error ? callbackError.message : 'Unknown error'
            });
          }
        }

        return {
          success: true,
          data: result,
          attempts,
          totalDurationMs,
          retryReasons
        };

      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        logger.warn(`Operation attempt ${attempt} failed`, {
          operationId: context.operationId,
          operationType: context.operationType,
          attempt,
          error: lastError.message,
          maxRetries: this.config.maxRetries
        });

        // Check if we should retry
        const shouldRetry = operation.shouldRetry(lastError, attempt);

        if (!shouldRetry || attempt > this.config.maxRetries!) {
          const totalDurationMs = Date.now() - startTime;

          logger.error('Operation failed after all retries', {
            operationId: context.operationId,
            operationType: context.operationType,
            attempts,
            totalDurationMs,
            finalError: lastError.message
          });

          // Call failure callback if provided
          if (operation.onFailure) {
            try {
              await operation.onFailure(lastError, attempts);
            } catch (callbackError) {
              logger.warn('Failure callback failed', {
                operationId: context.operationId,
                error: callbackError instanceof Error ? callbackError.message : 'Unknown error'
              });
            }
          }

          return {
            success: false,
            error: lastError.message,
            attempts,
            totalDurationMs,
            finalAttemptError: lastError.message,
            retryReasons,
            conflictDetected: this.isConflictError(lastError),
            lockTimeout: this.isLockTimeoutError(lastError),
            deadlockDetected: this.isDeadlockError(lastError)
          };
        }

        // Determine retry reason and delay
        const retryReason = this.getRetryReason(lastError);
        retryReasons.push(retryReason);

        const delayMs = operation.getRetryDelay ? 
          operation.getRetryDelay(attempt, lastError) : 
          this.calculateRetryDelay(attempt, lastError);

        logger.info(`Retrying operation after ${delayMs}ms`, {
          operationId: context.operationId,
          operationType: context.operationType,
          attempt,
          retryReason,
          delayMs
        });

        // Call retry callback if provided
        if (operation.onRetry) {
          try {
            await operation.onRetry(attempt, lastError);
          } catch (callbackError) {
            logger.warn('Retry callback failed', {
              operationId: context.operationId,
              error: callbackError instanceof Error ? callbackError.message : 'Unknown error'
            });
          }
        }

        // Wait before retry
        await this.delay(delayMs);
      }
    }

    // This should never be reached, but just in case
    const totalDurationMs = Date.now() - startTime;
    return {
      success: false,
      error: 'Unexpected retry loop exit',
      attempts,
      totalDurationMs,
      retryReasons
    };
  }

  /**
   * Create retryable reservation creation operation
   */
  createReservationCreationOperation(
    request: any,
    context: RetryContext
  ): RetryableOperation {
    return {
      execute: async () => {
        const result = await enhancedAdvisoryLocksService.createReservationWithLock(request);
        if (!result.success) {
          throw new Error(result.error || 'Reservation creation failed');
        }
        return result;
      },

      shouldRetry: (error: Error, attempt: number) => {
        // Don't retry on conflicts - they won't resolve by retrying
        if (this.isConflictError(error)) {
          return false;
        }
        // Retry on lock timeouts and deadlocks
        return this.isLockTimeoutError(error) || this.isDeadlockError(error);
      },

      getRetryDelay: (attempt: number, error: Error) => {
        if (this.isDeadlockError(error)) {
          // Longer delay for deadlocks
          return this.calculateRetryDelay(attempt, error) * 2;
        }
        return this.calculateRetryDelay(attempt, error);
      },

      onRetry: async (attempt: number, error: Error) => {
        logger.info('Retrying reservation creation', {
          operationId: context.operationId,
          attempt,
          error: error.message,
          shopId: context.shopId,
          userId: context.userId
        });
      },

      onSuccess: async (result: any, attempts: number) => {
        logger.info('Reservation created successfully', {
          operationId: context.operationId,
          reservationId: result.reservationId,
          attempts,
          shopId: context.shopId,
          userId: context.userId
        });
      },

      onFailure: async (error: Error, attempts: number) => {
        logger.error('Reservation creation failed after all retries', {
          operationId: context.operationId,
          attempts,
          error: error.message,
          shopId: context.shopId,
          userId: context.userId
        });
      }
    };
  }

  /**
   * Create retryable reservation update operation with optimistic locking
   */
  createReservationUpdateOperation(
    reservationId: string,
    updates: any,
    expectedVersion: number,
    context: RetryContext
  ): RetryableOperation {
    return {
      execute: async () => {
        const result = await concurrentBookingPreventionService.updateReservationWithLock(
          reservationId,
          updates,
          expectedVersion
        );
        if (!result.success) {
          throw new Error(result.error || 'Reservation update failed');
        }
        return result;
      },

      shouldRetry: (error: Error, attempt: number) => {
        // Retry on version conflicts (optimistic locking conflicts)
        if (error.message.includes('Version conflict') || error.message.includes('Version mismatch')) {
          return true;
        }
        // Don't retry on other errors
        return false;
      },

      getRetryDelay: (attempt: number, error: Error) => {
        // Shorter delay for version conflicts
        return Math.min(50 * attempt, 500);
      },

      onRetry: async (attempt: number, error: Error) => {
        logger.info('Retrying reservation update due to version conflict', {
          operationId: context.operationId,
          reservationId,
          attempt,
          error: error.message
        });
      },

      onSuccess: async (result: any, attempts: number) => {
        logger.info('Reservation updated successfully', {
          operationId: context.operationId,
          reservationId,
          attempts
        });
      },

      onFailure: async (error: Error, attempts: number) => {
        logger.error('Reservation update failed after all retries', {
          operationId: context.operationId,
          reservationId,
          attempts,
          error: error.message
        });
      }
    };
  }

  /**
   * Create retryable payment processing operation
   */
  createPaymentProcessingOperation(
    paymentId: string,
    updates: any,
    expectedVersion: number,
    context: RetryContext
  ): RetryableOperation {
    return {
      execute: async () => {
        const result = await concurrentBookingPreventionService.updatePaymentWithLock(
          paymentId,
          updates,
          expectedVersion
        );
        if (!result.success) {
          throw new Error(result.error || 'Payment update failed');
        }
        return result;
      },

      shouldRetry: (error: Error, attempt: number) => {
        // Retry on version conflicts and temporary errors
        return error.message.includes('Version conflict') || 
               error.message.includes('temporary') ||
               error.message.includes('timeout');
      },

      getRetryDelay: (attempt: number, error: Error) => {
        // Longer delay for payment processing
        return this.calculateRetryDelay(attempt, error) * 1.5;
      },

      onRetry: async (attempt: number, error: Error) => {
        logger.info('Retrying payment processing', {
          operationId: context.operationId,
          paymentId,
          attempt,
          error: error.message
        });
      },

      onSuccess: async (result: any, attempts: number) => {
        logger.info('Payment processed successfully', {
          operationId: context.operationId,
          paymentId,
          attempts
        });
      },

      onFailure: async (error: Error, attempts: number) => {
        logger.error('Payment processing failed after all retries', {
          operationId: context.operationId,
          paymentId,
          attempts,
          error: error.message
        });
      }
    };
  }

  /**
   * Execute operation with timeout
   */
  private async executeWithTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * Calculate retry delay with exponential backoff and jitter
   */
  private calculateRetryDelay(attempt: number, error: Error): number {
    const baseDelay = this.config.baseDelayMs!;
    const maxDelay = this.config.maxDelayMs!;
    const multiplier = this.config.exponentialBackoffMultiplier!;
    const jitterFactor = this.config.jitterFactor!;

    // Calculate exponential backoff delay
    const exponentialDelay = baseDelay * Math.pow(multiplier, attempt - 1);
    
    // Apply jitter to prevent thundering herd
    const jitter = exponentialDelay * jitterFactor * Math.random();
    const delay = exponentialDelay + jitter;

    // Cap at maximum delay
    return Math.min(delay, maxDelay);
  }

  /**
   * Check if error is a conflict error
   */
  private isConflictError(error: Error): boolean {
    const conflictKeywords = [
      'SLOT_CONFLICT',
      'conflict',
      'already exists',
      'duplicate',
      'not available'
    ];
    return conflictKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if error is a lock timeout error
   */
  private isLockTimeoutError(error: Error): boolean {
    const timeoutKeywords = [
      'ADVISORY_LOCK_TIMEOUT',
      'lock timeout',
      'timeout',
      'deadline exceeded'
    ];
    return timeoutKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Check if error is a deadlock error
   */
  private isDeadlockError(error: Error): boolean {
    const deadlockKeywords = [
      'deadlock',
      'serialization failure',
      'concurrent update'
    ];
    return deadlockKeywords.some(keyword => 
      error.message.toLowerCase().includes(keyword.toLowerCase())
    );
  }

  /**
   * Get human-readable retry reason
   */
  private getRetryReason(error: Error): string {
    if (this.isDeadlockError(error)) {
      return 'deadlock_detected';
    }
    if (this.isLockTimeoutError(error)) {
      return 'lock_timeout';
    }
    if (error.message.includes('Version conflict')) {
      return 'version_conflict';
    }
    if (error.message.includes('temporary')) {
      return 'temporary_error';
    }
    return 'unknown_error';
  }

  /**
   * Utility method to delay execution
   */
  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get current configuration
   */
  getConfig(): RetryConfig {
    return { ...this.config } as RetryConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<RetryConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Generate unique operation ID
   */
  generateOperationId(): string {
    return `op_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export const enhancedRetryMechanismService = new EnhancedRetryMechanismService();
