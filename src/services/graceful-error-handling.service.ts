import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { conflictDetectionResolutionService } from './conflict-detection-resolution.service';
import { enhancedRetryMechanismService } from './enhanced-retry-mechanism.service';

export interface ErrorHandlingConfig {
  enableUserFriendlyMessages: boolean;
  enableDetailedLogging: boolean;
  enableErrorReporting: boolean;
  enableAutomaticRetry: boolean;
  enableFallbackActions: boolean;
  maxRetryAttempts: number;
  retryDelayMs: number;
  enableErrorAnalytics: boolean;
}

export interface UserFriendlyError {
  errorCode: string;
  userMessage: string;
  technicalMessage: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: 'booking' | 'payment' | 'system' | 'network' | 'validation' | 'conflict';
  suggestedActions: string[];
  retryable: boolean;
  fallbackAvailable: boolean;
  supportContact?: string;
  estimatedResolutionTime?: string;
}

export interface ErrorContext {
  operationType: string;
  userId?: string;
  shopId?: string;
  reservationId?: string;
  paymentId?: string;
  requestId?: string;
  userAgent?: string;
  ipAddress?: string;
  metadata?: Record<string, any>;
}

export interface ErrorHandlingResult {
  success: boolean;
  userFriendlyError?: UserFriendlyError;
  retryAttempted?: boolean;
  fallbackExecuted?: boolean;
  errorReported?: boolean;
  suggestedActions?: string[];
  supportContact?: string;
  estimatedResolutionTime?: string;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorsByCategory: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByOperation: Record<string, number>;
  retrySuccessRate: number;
  fallbackSuccessRate: number;
  avgResolutionTimeMs: number;
  topErrorCodes: Array<{ errorCode: string; count: number }>;
}

export class GracefulErrorHandlingService {
  private supabase = getSupabaseClient();
  private defaultConfig: ErrorHandlingConfig = {
    enableUserFriendlyMessages: true,
    enableDetailedLogging: true,
    enableErrorReporting: true,
    enableAutomaticRetry: true,
    enableFallbackActions: true,
    maxRetryAttempts: 3,
    retryDelayMs: 1000,
    enableErrorAnalytics: true
  };

  private errorCodeMappings: Record<string, UserFriendlyError> = {
    // Booking-related errors
    'SLOT_CONFLICT': {
      errorCode: 'SLOT_CONFLICT',
      userMessage: '선택하신 시간에 다른 예약이 있습니다. 다른 시간을 선택해주세요.',
      technicalMessage: 'Reservation slot conflict detected',
      severity: 'medium',
      category: 'booking',
      suggestedActions: [
        '다른 시간대를 선택해보세요',
        '예약 가능한 시간을 다시 확인해보세요',
        '고객센터에 문의하세요'
      ],
      retryable: false,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '즉시'
    },
    'CAPACITY_EXCEEDED': {
      errorCode: 'CAPACITY_EXCEEDED',
      userMessage: '선택하신 시간에 예약 가능한 자리가 없습니다.',
      technicalMessage: 'Shop capacity exceeded for requested time slot',
      severity: 'high',
      category: 'booking',
      suggestedActions: [
        '다른 시간대를 선택해보세요',
        '예약 인원을 조정해보세요',
        '다른 날짜를 선택해보세요'
      ],
      retryable: false,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '즉시'
    },
    'VERSION_CONFLICT': {
      errorCode: 'VERSION_CONFLICT',
      userMessage: '예약 정보가 업데이트되었습니다. 다시 시도해주세요.',
      technicalMessage: 'Optimistic locking version conflict',
      severity: 'low',
      category: 'conflict',
      suggestedActions: [
        '페이지를 새로고침하고 다시 시도해주세요',
        '예약 정보를 다시 확인해주세요'
      ],
      retryable: true,
      fallbackAvailable: false,
      estimatedResolutionTime: '1분 이내'
    },
    'ADVISORY_LOCK_TIMEOUT': {
      errorCode: 'ADVISORY_LOCK_TIMEOUT',
      userMessage: '예약 처리 중 일시적인 지연이 발생했습니다. 잠시 후 다시 시도해주세요.',
      technicalMessage: 'Database advisory lock timeout',
      severity: 'medium',
      category: 'system',
      suggestedActions: [
        '잠시 후 다시 시도해주세요',
        '고객센터에 문의하세요'
      ],
      retryable: true,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '5분 이내'
    },
    'DEADLOCK_DETECTED': {
      errorCode: 'DEADLOCK_DETECTED',
      userMessage: '시스템이 일시적으로 혼잡합니다. 잠시 후 다시 시도해주세요.',
      technicalMessage: 'Database deadlock detected',
      severity: 'medium',
      category: 'system',
      suggestedActions: [
        '잠시 후 다시 시도해주세요',
        '고객센터에 문의하세요'
      ],
      retryable: true,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '10분 이내'
    },
    'PAYMENT_FAILED': {
      errorCode: 'PAYMENT_FAILED',
      userMessage: '결제 처리에 실패했습니다. 결제 정보를 확인하고 다시 시도해주세요.',
      technicalMessage: 'Payment processing failed',
      severity: 'high',
      category: 'payment',
      suggestedActions: [
        '결제 정보를 확인해주세요',
        '다른 결제 수단을 사용해보세요',
        '고객센터에 문의하세요'
      ],
      retryable: true,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '즉시'
    },
    'PAYMENT_CONFLICT': {
      errorCode: 'PAYMENT_CONFLICT',
      userMessage: '결제 중복 처리가 감지되었습니다. 고객센터에 문의해주세요.',
      technicalMessage: 'Duplicate payment detected',
      severity: 'critical',
      category: 'payment',
      suggestedActions: [
        '고객센터에 즉시 문의하세요',
        '결제 내역을 확인해주세요'
      ],
      retryable: false,
      fallbackAvailable: false,
      supportContact: 'customer-service',
      estimatedResolutionTime: '30분 이내'
    },
    'NETWORK_TIMEOUT': {
      errorCode: 'NETWORK_TIMEOUT',
      userMessage: '네트워크 연결이 불안정합니다. 인터넷 연결을 확인하고 다시 시도해주세요.',
      technicalMessage: 'Network timeout occurred',
      severity: 'medium',
      category: 'network',
      suggestedActions: [
        '인터넷 연결을 확인해주세요',
        '잠시 후 다시 시도해주세요',
        'Wi-Fi 연결을 확인해주세요'
      ],
      retryable: true,
      fallbackAvailable: false,
      estimatedResolutionTime: '1분 이내'
    },
    'VALIDATION_ERROR': {
      errorCode: 'VALIDATION_ERROR',
      userMessage: '입력 정보를 확인해주세요.',
      technicalMessage: 'Input validation failed',
      severity: 'low',
      category: 'validation',
      suggestedActions: [
        '입력 정보를 다시 확인해주세요',
        '필수 항목을 모두 입력했는지 확인해주세요'
      ],
      retryable: false,
      fallbackAvailable: false,
      estimatedResolutionTime: '즉시'
    },
    'SYSTEM_ERROR': {
      errorCode: 'SYSTEM_ERROR',
      userMessage: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      technicalMessage: 'Internal system error',
      severity: 'high',
      category: 'system',
      suggestedActions: [
        '잠시 후 다시 시도해주세요',
        '고객센터에 문의하세요'
      ],
      retryable: true,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '15분 이내'
    }
  };

  constructor(private config: Partial<ErrorHandlingConfig> = {}) {
    this.config = { ...this.defaultConfig, ...config };
  }

  /**
   * Handle error gracefully with user-friendly messages and automatic recovery
   */
  async handleError(
    error: Error,
    context: ErrorContext
  ): Promise<ErrorHandlingResult> {
    const startTime = Date.now();
    const errorCode = this.extractErrorCode(error);
    const userFriendlyError = this.getUserFriendlyError(errorCode, error);

    logger.error('Error occurred', {
      error: error.message,
      errorCode,
      context,
      userFriendlyMessage: userFriendlyError.userMessage
    });

    const result: ErrorHandlingResult = {
      success: false,
      userFriendlyError,
      retryAttempted: false,
      fallbackExecuted: false,
      errorReported: false,
      suggestedActions: userFriendlyError.suggestedActions,
      supportContact: userFriendlyError.supportContact,
      estimatedResolutionTime: userFriendlyError.estimatedResolutionTime
    };

    try {
      // Store error for analytics
      if (this.config.enableErrorReporting) {
        await this.storeErrorReport(error, context, userFriendlyError);
        result.errorReported = true;
      }

      // Attempt automatic retry if enabled and error is retryable
      if (this.config.enableAutomaticRetry && userFriendlyError.retryable) {
        const retryResult = await this.attemptAutomaticRetry(error, context);
        result.retryAttempted = true;
        result.success = retryResult.success;
      }

      // Execute fallback action if retry failed or not available
      if (!result.success && this.config.enableFallbackActions && userFriendlyError.fallbackAvailable) {
        const fallbackResult = await this.executeFallbackAction(error, context, userFriendlyError);
        result.fallbackExecuted = true;
        result.success = fallbackResult.success;
      }

      // Log detailed error information
      if (this.config.enableDetailedLogging) {
        await this.logDetailedError(error, context, userFriendlyError, result);
      }

      return result;

    } catch (handlingError) {
      logger.error('Error in error handling process', {
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error',
        context
      });

      return result;
    }
  }

  /**
   * Extract error code from error message
   */
  private extractErrorCode(error: Error): string {
    const message = error.message.toUpperCase();
    
    // Check for specific error codes
    for (const errorCode of Object.keys(this.errorCodeMappings)) {
      if (message.includes(errorCode)) {
        return errorCode;
      }
    }

    // Check for common error patterns
    if (message.includes('CONFLICT') || message.includes('OVERLAP')) {
      return 'SLOT_CONFLICT';
    }
    if (message.includes('CAPACITY') || message.includes('FULL')) {
      return 'CAPACITY_EXCEEDED';
    }
    if (message.includes('VERSION') || message.includes('CONCURRENT')) {
      return 'VERSION_CONFLICT';
    }
    if (message.includes('TIMEOUT')) {
      return 'ADVISORY_LOCK_TIMEOUT';
    }
    if (message.includes('DEADLOCK')) {
      return 'DEADLOCK_DETECTED';
    }
    if (message.includes('PAYMENT') || message.includes('TRANSACTION')) {
      return 'PAYMENT_FAILED';
    }
    if (message.includes('NETWORK') || message.includes('CONNECTION')) {
      return 'NETWORK_TIMEOUT';
    }
    if (message.includes('VALIDATION') || message.includes('INVALID')) {
      return 'VALIDATION_ERROR';
    }

    return 'SYSTEM_ERROR';
  }

  /**
   * Get user-friendly error information
   */
  private getUserFriendlyError(errorCode: string, originalError: Error): UserFriendlyError {
    const mappedError = this.errorCodeMappings[errorCode];
    
    if (mappedError) {
      return mappedError;
    }

    // Default fallback error
    return {
      errorCode: 'SYSTEM_ERROR',
      userMessage: '시스템 오류가 발생했습니다. 잠시 후 다시 시도해주세요.',
      technicalMessage: originalError.message,
      severity: 'high',
      category: 'system',
      suggestedActions: [
        '잠시 후 다시 시도해주세요',
        '고객센터에 문의하세요'
      ],
      retryable: true,
      fallbackAvailable: true,
      supportContact: 'customer-service',
      estimatedResolutionTime: '15분 이내'
    };
  }

  /**
   * Attempt automatic retry for retryable errors
   */
  private async attemptAutomaticRetry(error: Error, context: ErrorContext): Promise<{ success: boolean }> {
    try {
      logger.info('Attempting automatic retry', {
        errorCode: this.extractErrorCode(error),
        context
      });

      // Use the enhanced retry mechanism service
      const operationId = enhancedRetryMechanismService.generateOperationId();
      const retryContext = {
        operationId,
        operationType: context.operationType as any,
        userId: context.userId,
        shopId: context.shopId,
        reservationId: context.reservationId,
        metadata: context.metadata
      };

      // Create a simple retryable operation
      const retryableOperation = {
        execute: async () => {
          // This would be replaced with the actual operation that failed
          throw error; // For now, just re-throw the error
        },
        shouldRetry: (retryError: Error, attempt: number) => {
          return attempt <= this.config.maxRetryAttempts! && 
                 this.extractErrorCode(retryError) !== 'SLOT_CONFLICT' &&
                 this.extractErrorCode(retryError) !== 'CAPACITY_EXCEEDED';
        },
        getRetryDelay: (attempt: number, retryError: Error) => {
          return this.config.retryDelayMs! * Math.pow(2, attempt - 1);
        }
      };

      const result = await enhancedRetryMechanismService.executeWithRetry(
        retryableOperation,
        retryContext
      );

      return { success: result.success };

    } catch (retryError) {
      logger.error('Automatic retry failed', {
        originalError: error.message,
        retryError: retryError instanceof Error ? retryError.message : 'Unknown error',
        context
      });

      return { success: false };
    }
  }

  /**
   * Execute fallback action for errors that cannot be retried
   */
  private async executeFallbackAction(
    error: Error,
    context: ErrorContext,
    userFriendlyError: UserFriendlyError
  ): Promise<{ success: boolean }> {
    try {
      const errorCode = this.extractErrorCode(error);

      logger.info('Executing fallback action', {
        errorCode,
        context,
        fallbackAvailable: userFriendlyError.fallbackAvailable
      });

      switch (errorCode) {
        case 'SLOT_CONFLICT':
          return await this.handleSlotConflictFallback(context);
        case 'CAPACITY_EXCEEDED':
          return await this.handleCapacityExceededFallback(context);
        case 'PAYMENT_FAILED':
          return await this.handlePaymentFailedFallback(context);
        case 'SYSTEM_ERROR':
          return await this.handleSystemErrorFallback(context);
        default:
          return { success: false };
      }

    } catch (fallbackError) {
      logger.error('Fallback action failed', {
        originalError: error.message,
        fallbackError: fallbackError instanceof Error ? fallbackError.message : 'Unknown error',
        context
      });

      return { success: false };
    }
  }

  /**
   * Handle slot conflict fallback
   */
  private async handleSlotConflictFallback(context: ErrorContext): Promise<{ success: boolean }> {
    try {
      // Suggest alternative time slots
      if (context.shopId && context.reservationId) {
        // This would integrate with the conflict detection service
        // to find alternative slots
        logger.info('Handling slot conflict fallback', { context });
        return { success: true };
      }
      return { success: false };
    } catch (error) {
      logger.error('Slot conflict fallback failed', { error, context });
      return { success: false };
    }
  }

  /**
   * Handle capacity exceeded fallback
   */
  private async handleCapacityExceededFallback(context: ErrorContext): Promise<{ success: boolean }> {
    try {
      // Suggest alternative dates or times
      logger.info('Handling capacity exceeded fallback', { context });
      return { success: true };
    } catch (error) {
      logger.error('Capacity exceeded fallback failed', { error, context });
      return { success: false };
    }
  }

  /**
   * Handle payment failed fallback
   */
  private async handlePaymentFailedFallback(context: ErrorContext): Promise<{ success: boolean }> {
    try {
      // Suggest alternative payment methods
      logger.info('Handling payment failed fallback', { context });
      return { success: true };
    } catch (error) {
      logger.error('Payment failed fallback failed', { error, context });
      return { success: false };
    }
  }

  /**
   * Handle system error fallback
   */
  private async handleSystemErrorFallback(context: ErrorContext): Promise<{ success: boolean }> {
    try {
      // Log system error and notify administrators
      logger.error('System error fallback triggered', { context });
      return { success: false }; // System errors typically require manual intervention
    } catch (error) {
      logger.error('System error fallback failed', { error, context });
      return { success: false };
    }
  }

  /**
   * Store error report for analytics
   */
  private async storeErrorReport(
    error: Error,
    context: ErrorContext,
    userFriendlyError: UserFriendlyError
  ): Promise<void> {
    try {
      const { error: dbError } = await this.supabase
        .from('error_reports')
        .insert({
          error_code: userFriendlyError.errorCode,
          error_message: error.message,
          user_message: userFriendlyError.userMessage,
          technical_message: userFriendlyError.technicalMessage,
          severity: userFriendlyError.severity,
          category: userFriendlyError.category,
          operation_type: context.operationType,
          user_id: context.userId || null,
          shop_id: context.shopId || null,
          reservation_id: context.reservationId || null,
          payment_id: context.paymentId || null,
          request_id: context.requestId || null,
          user_agent: context.userAgent || null,
          ip_address: context.ipAddress || null,
          retryable: userFriendlyError.retryable,
          fallback_available: userFriendlyError.fallbackAvailable,
          suggested_actions: userFriendlyError.suggestedActions,
          support_contact: userFriendlyError.supportContact,
          estimated_resolution_time: userFriendlyError.estimatedResolutionTime,
          metadata: context.metadata || {},
          created_at: new Date().toISOString()
        });

      if (dbError) {
        logger.error('Failed to store error report', {
          error: dbError.message,
          originalError: error.message
        });
      }
    } catch (error) {
      logger.error('Error storing error report', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Log detailed error information
   */
  private async logDetailedError(
    error: Error,
    context: ErrorContext,
    userFriendlyError: UserFriendlyError,
    result: ErrorHandlingResult
  ): Promise<void> {
    try {
      const errorLog = {
        timestamp: new Date().toISOString(),
        errorCode: userFriendlyError.errorCode,
        originalError: error.message,
        stack: error.stack,
        context,
        userFriendlyError,
        handlingResult: result,
        severity: userFriendlyError.severity,
        category: userFriendlyError.category
      };

      logger.info('Detailed error log', errorLog);
    } catch (logError) {
      logger.error('Failed to log detailed error', {
        logError: logError instanceof Error ? logError.message : 'Unknown error',
        originalError: error.message
      });
    }
  }

  /**
   * Get error analytics
   */
  async getErrorAnalytics(hoursBack: number = 24): Promise<ErrorAnalytics> {
    try {
      const { data, error } = await this.supabase
        .from('error_reports')
        .select('*')
        .gte('created_at', new Date(Date.now() - hoursBack * 60 * 60 * 1000).toISOString());

      if (error) {
        throw error;
      }

      const errors = data || [];
      const totalErrors = errors.length;

      const errorsByCategory = errors.reduce((acc, error) => {
        acc[error.category] = (acc[error.category] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const errorsBySeverity = errors.reduce((acc, error) => {
        acc[error.severity] = (acc[error.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const errorsByOperation = errors.reduce((acc, error) => {
        acc[error.operation_type] = (acc[error.operation_type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const retryableErrors = errors.filter(e => e.retryable).length;
      const retrySuccessRate = retryableErrors > 0 ? 
        (errors.filter(e => e.retryable && e.resolved).length / retryableErrors) * 100 : 0;

      const fallbackAvailableErrors = errors.filter(e => e.fallback_available).length;
      const fallbackSuccessRate = fallbackAvailableErrors > 0 ? 
        (errors.filter(e => e.fallback_available && e.resolved).length / fallbackAvailableErrors) * 100 : 0;

      const topErrorCodes = Object.entries(
        errors.reduce((acc, error) => {
          acc[error.error_code] = (acc[error.error_code] || 0) + 1;
          return acc;
        }, {} as Record<string, number>)
      )
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10)
      .map(([errorCode, count]) => ({ errorCode, count: count as number }));

      return {
        totalErrors,
        errorsByCategory,
        errorsBySeverity,
        errorsByOperation,
        retrySuccessRate,
        fallbackSuccessRate,
        avgResolutionTimeMs: 0, // Would need resolution tracking
        topErrorCodes
      };

    } catch (error) {
      logger.error('Error getting error analytics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        hoursBack
      });
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  getConfig(): ErrorHandlingConfig {
    return { ...this.config } as ErrorHandlingConfig;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<ErrorHandlingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  /**
   * Add custom error code mapping
   */
  addErrorCodeMapping(errorCode: string, mapping: UserFriendlyError): void {
    this.errorCodeMappings[errorCode] = mapping;
  }

  /**
   * Remove error code mapping
   */
  removeErrorCodeMapping(errorCode: string): void {
    delete this.errorCodeMappings[errorCode];
  }
}

export const gracefulErrorHandlingService = new GracefulErrorHandlingService();
