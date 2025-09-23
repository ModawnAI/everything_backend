/**
 * Unified Error Handler
 * 
 * Centralized error handling system to eliminate duplication across controllers
 * and provide consistent error responses throughout the application.
 */

import { Response } from 'express';
import { logger } from './logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: any;
}

export interface ErrorContext {
  userId?: string;
  requestId?: string;
  endpoint?: string;
  method?: string;
  ip?: string;
}

export class UnifiedErrorHandler {
  /**
   * Handle controller errors with consistent formatting and logging
   */
  static handleControllerError(
    error: Error | AppError,
    res: Response,
    context: ErrorContext = {}
  ): void {
    const timestamp = new Date().toISOString();
    const requestId = context.requestId || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Log error with full context
    logger.error('Controller error occurred', {
      error: error.message,
      stack: error.stack,
      endpoint: context.endpoint,
      method: context.method,
      ip: context.ip,
      userId: context.userId,
      requestId,
      timestamp
    });

    // Handle specific error types
    if (this.isAppError(error)) {
      res.status(error.statusCode || 500).json({
        success: false,
        error: {
          code: error.code || 'APPLICATION_ERROR',
          message: error.message,
          details: error.details,
          timestamp,
          requestId
        }
      });
      return;
    }

    // Handle validation errors
    if (error.name === 'ValidationError' || (error as any).isJoi) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Input validation failed',
          details: (error as any).details?.map((detail: any) => ({
            field: detail.path?.join('.'),
            message: detail.message
          })),
          timestamp,
          requestId
        }
      });
      return;
    }

    // Handle database errors
    if (this.isDatabaseError(error)) {
      const dbError = this.formatDatabaseError(error);
      res.status(dbError.statusCode).json({
        success: false,
        error: {
          code: dbError.code,
          message: dbError.message,
          timestamp,
          requestId
        }
      });
      return;
    }

    // Handle payment errors
    if (this.isPaymentError(error)) {
      const paymentError = this.formatPaymentError(error);
      res.status(paymentError.statusCode).json({
        success: false,
        error: {
          code: paymentError.code,
          message: paymentError.message,
          timestamp,
          requestId
        }
      });
      return;
    }

    // Generic server error
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        timestamp,
        requestId
      }
    });
  }

  /**
   * Create error handling decorator for controller methods
   */
  static withErrorHandling(context: Partial<ErrorContext> = {}) {
    return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
      const originalMethod = descriptor.value;

      descriptor.value = async function (...args: any[]) {
        const req = args[0];
        const res = args[1];
        
        const fullContext: ErrorContext = {
          ...context,
          endpoint: req.path,
          method: req.method,
          ip: req.ip,
          userId: req.user?.id,
          requestId: req.headers['x-request-id'] as string
        };

        try {
          return await originalMethod.apply(this, args);
        } catch (error) {
          UnifiedErrorHandler.handleControllerError(error as Error, res, fullContext);
        }
      };

      return descriptor;
    };
  }

  /**
   * Type guards and error formatters
   */
  private static isAppError(error: Error): error is AppError {
    return 'statusCode' in error || 'code' in error;
  }

  private static isDatabaseError(error: Error): boolean {
    return error.message.includes('duplicate key') ||
           error.message.includes('foreign key') ||
           error.message.includes('not null') ||
           error.name === 'QueryFailedError';
  }

  private static isPaymentError(error: Error): boolean {
    return error.message.includes('payment') ||
           error.message.includes('transaction') ||
           error.message.includes('insufficient funds');
  }

  private static formatDatabaseError(error: Error) {
    if (error.message.includes('duplicate key')) {
      return {
        statusCode: 409,
        code: 'DUPLICATE_RESOURCE',
        message: 'Resource already exists'
      };
    }
    
    if (error.message.includes('foreign key')) {
      return {
        statusCode: 400,
        code: 'INVALID_REFERENCE',
        message: 'Referenced resource does not exist'
      };
    }
    
    return {
      statusCode: 500,
      code: 'DATABASE_ERROR',
      message: 'Database operation failed'
    };
  }

  private static formatPaymentError(error: Error) {
    if (error.message.includes('insufficient funds')) {
      return {
        statusCode: 402,
        code: 'INSUFFICIENT_FUNDS',
        message: 'Insufficient funds for transaction'
      };
    }
    
    return {
      statusCode: 500,
      code: 'PAYMENT_ERROR',
      message: 'Payment processing failed'
    };
  }
}

/**
 * Convenience decorator for controller methods
 */
export const HandleErrors = UnifiedErrorHandler.withErrorHandling();

/**
 * Manual error handling function for non-decorator usage
 */
export const handleError = (error: Error, res: Response, context: ErrorContext = {}) => {
  UnifiedErrorHandler.handleControllerError(error, res, context);
};
