/**
 * Payment Error Handling Service
 * 
 * Comprehensive error handling system for payment transactions including:
 * - Payment error classification and logging
 * - Automatic retry mechanisms with exponential backoff
 * - Error recovery and resolution workflows
 * - Error analytics and reporting
 * - Integration with fraud detection and security monitoring
 */

import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  PaymentError,
  PaymentErrorType,
  ErrorHandlingConfig,
  FraudDetectionRequest,
  SecurityAlert,
  SecurityAlertType,
  SecurityAlertSeverity
} from '../types/payment-security.types';
import { fraudDetectionService } from './fraud-detection.service';
import { securityMonitoringService } from './security-monitoring.service';

export class PaymentErrorHandlingService {
  private supabase = getSupabaseClient();
  private readonly defaultErrorConfigs: Record<PaymentErrorType, ErrorHandlingConfig> = {
    network_error: {
      id: 'network_error',
      errorType: 'network_error',
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 5,
      exponentialBackoff: true,
      alertOnFailure: false,
      autoResolve: true,
      autoResolveAfter: 30,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    api_error: {
      id: 'api_error',
      errorType: 'api_error',
      retryEnabled: true,
      maxRetries: 2,
      retryDelay: 10,
      exponentialBackoff: true,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 60,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    validation_error: {
      id: 'validation_error',
      errorType: 'validation_error',
      retryEnabled: false,
      maxRetries: 0,
      retryDelay: 0,
      exponentialBackoff: false,
      alertOnFailure: false,
      autoResolve: true,
      autoResolveAfter: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    authentication_error: {
      id: 'authentication_error',
      errorType: 'authentication_error',
      retryEnabled: false,
      maxRetries: 0,
      retryDelay: 0,
      exponentialBackoff: false,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    authorization_error: {
      id: 'authorization_error',
      errorType: 'authorization_error',
      retryEnabled: false,
      maxRetries: 0,
      retryDelay: 0,
      exponentialBackoff: false,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    rate_limit_error: {
      id: 'rate_limit_error',
      errorType: 'rate_limit_error',
      retryEnabled: true,
      maxRetries: 5,
      retryDelay: 60,
      exponentialBackoff: true,
      alertOnFailure: false,
      autoResolve: true,
      autoResolveAfter: 300,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    fraud_detection_error: {
      id: 'fraud_detection_error',
      errorType: 'fraud_detection_error',
      retryEnabled: false,
      maxRetries: 0,
      retryDelay: 0,
      exponentialBackoff: false,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    system_error: {
      id: 'system_error',
      errorType: 'system_error',
      retryEnabled: true,
      maxRetries: 2,
      retryDelay: 30,
      exponentialBackoff: true,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 120,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    timeout_error: {
      id: 'timeout_error',
      errorType: 'timeout_error',
      retryEnabled: true,
      maxRetries: 3,
      retryDelay: 15,
      exponentialBackoff: true,
      alertOnFailure: false,
      autoResolve: true,
      autoResolveAfter: 90,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    webhook_error: {
      id: 'webhook_error',
      errorType: 'webhook_error',
      retryEnabled: true,
      maxRetries: 5,
      retryDelay: 30,
      exponentialBackoff: true,
      alertOnFailure: true,
      autoResolve: false,
      autoResolveAfter: 600,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  };

  /**
   * Handle payment error with comprehensive error management
   */
  async handlePaymentError(
    error: Error,
    errorType: PaymentErrorType,
    context: {
      paymentId?: string;
      userId?: string;
      reservationId?: string;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<PaymentError> {
    try {
      logger.info('Handling payment error', {
        errorType,
        errorMessage: error.message,
        paymentId: context.paymentId,
        userId: context.userId
      });

      // Create payment error record
      const paymentError = await this.createPaymentError(error, errorType, context);

      // Get error handling configuration
      const errorConfig = await this.getErrorHandlingConfig(errorType);

      // Perform fraud detection if applicable
      if (this.shouldPerformFraudDetection(errorType, context)) {
        await this.performFraudDetection(context);
      }

      // Generate security alerts if configured
      if (errorConfig.alertOnFailure) {
        await this.generateSecurityAlert(paymentError, context);
      }

      // Handle retry logic if enabled
      if (errorConfig.retryEnabled) {
        await this.handleRetryLogic(paymentError, errorConfig);
      }

      // Auto-resolve if configured
      if (errorConfig.autoResolve) {
        await this.scheduleAutoResolution(paymentError, errorConfig);
      }

      // Log audit trail
      await this.logErrorAuditTrail(paymentError, context);

      logger.info('Payment error handled successfully', {
        errorId: paymentError.id,
        errorType,
        retryEnabled: errorConfig.retryEnabled,
        alertOnFailure: errorConfig.alertOnFailure
      });

      return paymentError;

    } catch (handlingError) {
      logger.error('Error in payment error handling', {
        originalError: error.message,
        handlingError: handlingError instanceof Error ? handlingError.message : 'Unknown error',
        errorType,
        context
      });

      // Return a basic error record even if handling fails
      return {
        id: `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        errorType,
        errorCode: 'ERROR_HANDLING_FAILED',
        errorMessage: 'Error handling failed',
        errorDetails: error.message,
        paymentId: context.paymentId,
        userId: context.userId,
        reservationId: context.reservationId,
        requestData: context.requestData,
        responseData: context.responseData,
        stackTrace: error.stack,
        isResolved: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  /**
   * Create payment error record
   */
  private async createPaymentError(
    error: Error,
    errorType: PaymentErrorType,
    context: {
      paymentId?: string;
      userId?: string;
      reservationId?: string;
      requestData?: Record<string, any>;
      responseData?: Record<string, any>;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<PaymentError> {
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const paymentError: PaymentError = {
      id: errorId,
      errorType,
      errorCode: this.extractErrorCode(error),
      errorMessage: error.message,
      errorDetails: this.extractErrorDetails(error),
      paymentId: context.paymentId,
      userId: context.userId,
      reservationId: context.reservationId,
      requestData: context.requestData,
      responseData: context.responseData,
      stackTrace: error.stack,
      isResolved: false,
      createdAt: now,
      updatedAt: now
    };

    // Insert error into database
    const { error: dbError } = await this.supabase
      .from('payment_errors')
      .insert({
        id: paymentError.id,
        error_type: paymentError.errorType,
        error_code: paymentError.errorCode,
        error_message: paymentError.errorMessage,
        error_details: paymentError.errorDetails,
        payment_id: paymentError.paymentId,
        user_id: paymentError.userId,
        reservation_id: paymentError.reservationId,
        request_data: paymentError.requestData,
        response_data: paymentError.responseData,
        stack_trace: paymentError.stackTrace,
        is_resolved: paymentError.isResolved,
        resolved_at: paymentError.resolvedAt,
        resolved_by: paymentError.resolvedBy,
        resolution_notes: paymentError.resolutionNotes,
        created_at: paymentError.createdAt,
        updated_at: paymentError.updatedAt
      });

    if (dbError) {
      logger.error('Error creating payment error record', { error: dbError, errorId });
      throw new Error(`Failed to create payment error record: ${dbError.message}`);
    }

    return paymentError;
  }

  /**
   * Get error handling configuration
   */
  private async getErrorHandlingConfig(errorType: PaymentErrorType): Promise<ErrorHandlingConfig> {
    try {
      const { data: config, error } = await this.supabase
        .from('error_handling_configs')
        .select('*')
        .eq('error_type', errorType)
        .single();

      if (error || !config) {
        return this.defaultErrorConfigs[errorType];
      }

      return {
        id: config.id,
        errorType: config.error_type,
        retryEnabled: config.retry_enabled,
        maxRetries: config.max_retries,
        retryDelay: config.retry_delay,
        exponentialBackoff: config.exponential_backoff,
        alertOnFailure: config.alert_on_failure,
        autoResolve: config.auto_resolve,
        autoResolveAfter: config.auto_resolve_after,
        createdAt: config.created_at,
        updatedAt: config.updated_at
      };

    } catch (error) {
      logger.error('Error getting error handling config', { error, errorType });
      return this.defaultErrorConfigs[errorType];
    }
  }

  /**
   * Determine if fraud detection should be performed
   */
  private shouldPerformFraudDetection(errorType: PaymentErrorType, context: any): boolean {
    // Perform fraud detection for suspicious error types
    const suspiciousErrorTypes: PaymentErrorType[] = [
      'authentication_error',
      'authorization_error',
      'fraud_detection_error',
      'system_error'
    ];

    return suspiciousErrorTypes.includes(errorType) && 
           (context.userId || context.ipAddress);
  }

  /**
   * Perform fraud detection
   */
  private async performFraudDetection(context: {
    paymentId?: string;
    userId?: string;
    reservationId?: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
    try {
      if (!context.userId || !context.ipAddress) {
        return;
      }

      // Get payment details for fraud detection
      const paymentDetails = await this.getPaymentDetails(context.paymentId);
      if (!paymentDetails) {
        return;
      }

      const fraudRequest = {
        paymentId: context.paymentId || 'unknown',
        userId: context.userId,
        amount: paymentDetails.amount || 0,
        currency: paymentDetails.currency || 'KRW',
        paymentMethod: paymentDetails.payment_method || 'unknown',
        ipAddress: context.ipAddress,
        userAgent: context.userAgent || '',
        metadata: { errorContext: true }
      };

      const fraudResult = await fraudDetectionService.detectFraud(fraudRequest);

      if ((fraudResult as any).fraudDetected) {
        logger.warn('Fraud detected during error handling', {
          paymentId: context.paymentId,
          userId: context.userId,
          riskScore: fraudResult.riskScore,
          action: fraudResult.action
        });
      }

    } catch (error) {
      logger.error('Error performing fraud detection during error handling', { error });
    }
  }

  /**
   * Generate security alert for payment error
   */
  private async generateSecurityAlert(
    paymentError: PaymentError,
    context: {
      paymentId?: string;
      userId?: string;
      reservationId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const alertSeverity = this.determineAlertSeverity(paymentError.errorType);
      const alertType = this.determineAlertType(paymentError.errorType);

      const securityAlert: Omit<SecurityAlert, 'id' | 'createdAt' | 'updatedAt'> = {
        type: alertType,
        severity: alertSeverity,
        title: `Payment Error: ${paymentError.errorType}`,
        message: `Payment error occurred: ${paymentError.errorMessage}`,
        userId: context.userId,
        paymentId: context.paymentId,
        reservationId: context.reservationId,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        metadata: {
          errorId: paymentError.id,
          errorCode: paymentError.errorCode,
          errorDetails: paymentError.errorDetails
        },
        isResolved: false
      };

      await securityMonitoringService.generateSecurityAlert(securityAlert);

    } catch (error) {
      logger.error('Error generating security alert for payment error', { error });
    }
  }

  /**
   * Handle retry logic for payment errors
   */
  private async handleRetryLogic(paymentError: PaymentError, errorConfig: ErrorHandlingConfig): Promise<void> {
    try {
      // Check if we should retry based on error type and configuration
      if (!errorConfig.retryEnabled || errorConfig.maxRetries === 0) {
        return;
      }

      // Get current retry count
      const currentRetries = await this.getCurrentRetryCount(paymentError.id);
      
      if (currentRetries >= errorConfig.maxRetries) {
        logger.info('Max retries reached for payment error', {
          errorId: paymentError.id,
          currentRetries,
          maxRetries: errorConfig.maxRetries
        });
        return;
      }

      // Calculate retry delay
      const retryDelay = this.calculateRetryDelay(currentRetries, errorConfig);

      // Schedule retry
      await this.scheduleRetry(paymentError, errorConfig, retryDelay, currentRetries + 1);

      logger.info('Retry scheduled for payment error', {
        errorId: paymentError.id,
        retryNumber: currentRetries + 1,
        retryDelay,
        maxRetries: errorConfig.maxRetries
      });

    } catch (error) {
      logger.error('Error handling retry logic', { error, errorId: paymentError.id });
    }
  }

  /**
   * Schedule auto-resolution for payment error
   */
  private async scheduleAutoResolution(paymentError: PaymentError, errorConfig: ErrorHandlingConfig): Promise<void> {
    try {
      if (!errorConfig.autoResolve || errorConfig.autoResolveAfter === 0) {
        return;
      }

      // Schedule auto-resolution after specified time
      setTimeout(async () => {
        try {
          await this.autoResolveError(paymentError.id);
        } catch (error) {
          logger.error('Error in auto-resolution', { error, errorId: paymentError.id });
        }
      }, errorConfig.autoResolveAfter * 60 * 1000); // Convert minutes to milliseconds

      logger.info('Auto-resolution scheduled for payment error', {
        errorId: paymentError.id,
        autoResolveAfter: errorConfig.autoResolveAfter
      });

    } catch (error) {
      logger.error('Error scheduling auto-resolution', { error, errorId: paymentError.id });
    }
  }

  /**
   * Extract error code from error
   */
  private extractErrorCode(error: Error): string {
    // Try to extract error code from error message or name
    if (error.name) {
      return error.name.toUpperCase();
    }

    // Common error patterns
    if (error.message.includes('timeout')) {
      return 'TIMEOUT_ERROR';
    }
    if (error.message.includes('network')) {
      return 'NETWORK_ERROR';
    }
    if (error.message.includes('unauthorized')) {
      return 'UNAUTHORIZED_ERROR';
    }
    if (error.message.includes('forbidden')) {
      return 'FORBIDDEN_ERROR';
    }
    if (error.message.includes('not found')) {
      return 'NOT_FOUND_ERROR';
    }
    if (error.message.includes('validation')) {
      return 'VALIDATION_ERROR';
    }

    return 'UNKNOWN_ERROR';
  }

  /**
   * Extract error details from error
   */
  private extractErrorDetails(error: Error): string {
    // Extract additional details from error message
    const details = [];

    if (error.message) {
      details.push(`Message: ${error.message}`);
    }

    if (error.stack) {
      // Include first few lines of stack trace
      const stackLines = error.stack.split('\n').slice(0, 3);
      details.push(`Stack: ${stackLines.join(' | ')}`);
    }

    return details.join('; ');
  }

  /**
   * Determine alert severity based on error type
   */
  private determineAlertSeverity(errorType: PaymentErrorType): SecurityAlertSeverity {
    switch (errorType) {
      case 'authentication_error':
      case 'authorization_error':
      case 'fraud_detection_error':
        return 'error';
      case 'system_error':
      case 'webhook_error':
        return 'warning';
      case 'api_error':
      case 'rate_limit_error':
        return 'info';
      default:
        return 'info';
    }
  }

  /**
   * Determine alert type based on error type
   */
  private determineAlertType(errorType: PaymentErrorType): SecurityAlertType {
    switch (errorType) {
      case 'authentication_error':
      case 'authorization_error':
        return 'suspicious_activity';
      case 'fraud_detection_error':
        return 'fraud_detected';
      case 'system_error':
        return 'system_error';
      case 'webhook_error':
        return 'webhook_failure';
      case 'rate_limit_error':
        return 'rate_limit_exceeded';
      default:
        return 'system_error';
    }
  }

  /**
   * Get payment details for fraud detection
   */
  private async getPaymentDetails(paymentId?: string): Promise<any> {
    if (!paymentId) {
      return null;
    }

    try {
      const { data: payment, error } = await this.supabase
        .from('payments')
        .select('*')
        .eq('id', paymentId)
        .single();

      if (error || !payment) {
        return null;
      }

      return payment;

    } catch (error) {
      logger.error('Error getting payment details', { error, paymentId });
      return null;
    }
  }

  /**
   * Get current retry count for error
   */
  private async getCurrentRetryCount(errorId: string): Promise<number> {
    try {
      const { count, error } = await this.supabase
        .from('payment_retry_history')
        .select('*', { count: 'exact', head: true })
        .eq('payment_id', errorId);

      if (error) {
        logger.error('Error getting retry count', { error, errorId });
        return 0;
      }

      return count || 0;

    } catch (error) {
      logger.error('Error getting current retry count', { error, errorId });
      return 0;
    }
  }

  /**
   * Calculate retry delay with exponential backoff
   */
  private calculateRetryDelay(currentRetries: number, errorConfig: ErrorHandlingConfig): number {
    if (!errorConfig.exponentialBackoff) {
      return errorConfig.retryDelay;
    }

    // Exponential backoff: delay * 2^retry_number
    const delay = errorConfig.retryDelay * Math.pow(2, currentRetries);
    const maxDelay = 300; // 5 minutes max

    return Math.min(delay, maxDelay);
  }

  /**
   * Schedule retry for payment error
   */
  private async scheduleRetry(
    paymentError: PaymentError,
    errorConfig: ErrorHandlingConfig,
    retryDelay: number,
    retryNumber: number
  ): Promise<void> {
    try {
      const retryId = `retry_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const scheduledAt = new Date(Date.now() + retryDelay * 1000).toISOString();

      // Insert retry record
      const { error } = await this.supabase
        .from('payment_retry_queue')
        .insert({
          id: retryId,
          payment_id: paymentError.paymentId,
          reservation_id: paymentError.reservationId,
          user_id: paymentError.userId,
          retry_type: 'payment_confirmation',
          retry_status: 'pending',
          attempt_number: retryNumber,
          max_attempts: errorConfig.maxRetries,
          next_retry_at: scheduledAt,
          retry_count: retryNumber,
          success_count: 0,
          exponential_backoff_multiplier: errorConfig.exponentialBackoff ? 2 : 1,
          base_retry_delay: errorConfig.retryDelay,
          max_retry_delay: 300,
          metadata: {
            errorId: paymentError.id,
            errorType: paymentError.errorType,
            originalError: paymentError.errorMessage
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Error scheduling retry', { error, errorId: paymentError.id });
      }

    } catch (error) {
      logger.error('Error in scheduleRetry', { error, errorId: paymentError.id });
    }
  }

  /**
   * Auto-resolve payment error
   */
  private async autoResolveError(errorId: string): Promise<void> {
    try {
      const now = new Date().toISOString();

      const { error } = await this.supabase
        .from('payment_errors')
        .update({
          is_resolved: true,
          resolved_at: now,
          resolved_by: 'system',
          resolution_notes: 'Auto-resolved by system',
          updated_at: now
        })
        .eq('id', errorId);

      if (error) {
        logger.error('Error auto-resolving payment error', { error, errorId });
        return;
      }

      logger.info('Payment error auto-resolved', { errorId });

    } catch (error) {
      logger.error('Error in autoResolveError', { error, errorId });
    }
  }

  /**
   * Log error audit trail
   */
  private async logErrorAuditTrail(
    paymentError: PaymentError,
    context: {
      paymentId?: string;
      userId?: string;
      reservationId?: string;
      ipAddress?: string;
      userAgent?: string;
    }
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('audit_logs')
        .insert({
          action: 'payment_error_created',
          resource_type: 'payment_error',
          resource_id: paymentError.id,
          user_id: context.userId,
          ip_address: context.ipAddress,
          user_agent: context.userAgent,
          metadata: {
            errorType: paymentError.errorType,
            errorCode: paymentError.errorCode,
            paymentId: context.paymentId,
            reservationId: context.reservationId
          },
          timestamp: new Date().toISOString()
        });

      if (error) {
        logger.error('Error logging error audit trail', { error });
      }

    } catch (error) {
      logger.error('Error in logErrorAuditTrail', { error });
    }
  }
}

export const paymentErrorHandlingService = new PaymentErrorHandlingService(); 