import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

// =============================================
// CUSTOM ERROR CLASSES
// =============================================

export class AppError extends Error {
  public statusCode: number;
  public errorCode: string;
  public isOperational: boolean;

  constructor(
    message: string,
    statusCode: number = 500,
    errorCode: string = 'INTERNAL_ERROR',
    isOperational: boolean = true
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.isOperational = isOperational;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string = '인증이 필요합니다.', errorCode: string = 'AUTH_1001') {
    super(message, 401, errorCode);
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string = '권한이 없습니다.', errorCode: string = 'AUTH_1002') {
    super(message, 403, errorCode);
  }
}

export class ValidationError extends AppError {
  constructor(message: string = '입력 데이터가 유효하지 않습니다.', errorCode: string = 'VALIDATION_2001') {
    super(message, 400, errorCode);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = '요청한 리소스를 찾을 수 없습니다.', errorCode: string = 'NOT_FOUND_3001') {
    super(message, 404, errorCode);
  }
}

export class BusinessLogicError extends AppError {
  constructor(message: string = '비즈니스 로직 오류가 발생했습니다.', errorCode: string = 'BUSINESS_3001') {
    super(message, 400, errorCode);
  }
}

export class DatabaseError extends AppError {
  constructor(message: string = '데이터베이스 오류가 발생했습니다.', errorCode: string = 'DATABASE_4001') {
    super(message, 500, errorCode);
  }
}

export class ExternalServiceError extends AppError {
  constructor(message: string = '외부 서비스 오류가 발생했습니다.', errorCode: string = 'EXTERNAL_5001') {
    super(message, 502, errorCode);
  }
}

export class RateLimitError extends AppError {
  constructor(message: string = '요청이 너무 많습니다.', errorCode: string = 'RATE_LIMIT_6001') {
    super(message, 429, errorCode);
  }
}

// =============================================
// ERROR CODE MAPPING
// =============================================

export const ERROR_CODES = {
  // Authentication Errors (1000-1999)
  AUTH_1001: { message: '인증이 필요합니다.', statusCode: 401 },
  AUTH_1002: { message: '권한이 없습니다.', statusCode: 403 },
  AUTH_1003: { message: '토큰이 만료되었습니다.', statusCode: 401 },
  AUTH_1004: { message: '잘못된 토큰입니다.', statusCode: 401 },
  AUTH_1005: { message: '소셜 로그인 실패', statusCode: 401 },

  // Validation Errors (2000-2999)
  VALIDATION_2001: { message: '입력 데이터가 유효하지 않습니다.', statusCode: 400 },
  VALIDATION_2002: { message: '필수 필드가 누락되었습니다.', statusCode: 400 },
  VALIDATION_2003: { message: '잘못된 데이터 형식입니다.', statusCode: 400 },
  VALIDATION_2004: { message: '파일 크기가 너무 큽니다.', statusCode: 400 },
  VALIDATION_2005: { message: '지원하지 않는 파일 형식입니다.', statusCode: 400 },

  // Business Logic Errors (3000-3999)
  BUSINESS_3001: { message: '비즈니스 로직 오류가 발생했습니다.', statusCode: 400 },
  BUSINESS_3002: { message: '예약 시간이 이미 예약되었습니다.', statusCode: 409 },
  BUSINESS_3003: { message: '포인트가 부족합니다.', statusCode: 400 },
  BUSINESS_3004: { message: '결제가 실패했습니다.', statusCode: 400 },
  BUSINESS_3005: { message: '샵이 비활성화되었습니다.', statusCode: 400 },

  // Database Errors (4000-4999)
  DATABASE_4001: { message: '데이터베이스 오류가 발생했습니다.', statusCode: 500 },
  DATABASE_4002: { message: '데이터베이스 연결 실패', statusCode: 500 },
  DATABASE_4003: { message: '트랜잭션 실패', statusCode: 500 },
  DATABASE_4004: { message: '데이터 무결성 오류', statusCode: 500 },

  // External Service Errors (5000-5999)
  EXTERNAL_5001: { message: '외부 서비스 오류가 발생했습니다.', statusCode: 502 },
  EXTERNAL_5002: { message: 'Toss Payments API 오류', statusCode: 502 },
  EXTERNAL_5003: { message: 'FCM 서비스 오류', statusCode: 502 },
  EXTERNAL_5004: { message: 'Supabase 서비스 오류', statusCode: 502 },

  // Rate Limiting Errors (6000-6999)
  RATE_LIMIT_6001: { message: '요청이 너무 많습니다.', statusCode: 429 },
  RATE_LIMIT_6002: { message: 'IP 차단됨', statusCode: 429 },

  // System Errors (9000-9999)
  INTERNAL_ERROR: { message: '서버 내부 오류가 발생했습니다.', statusCode: 500 },
  ROUTE_NOT_FOUND: { message: '요청한 경로를 찾을 수 없습니다.', statusCode: 404 },
} as const;

// =============================================
// ERROR HANDLING MIDDLEWARE
// =============================================

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
    requestId?: string;
  };
}

/**
 * Global error handling middleware
 */
export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate request ID for tracking
  const requestId = req.headers['x-request-id'] as string || generateRequestId();

  // Log error with context
  logger.error('Error occurred', {
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    requestId,
    userId: (req as any).user?.id,
  });

  // Handle known AppError instances
  if (err instanceof AppError) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: err.errorCode,
        message: err.message,
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId,
      },
    };

    res.status(err.statusCode).json(response);
    return;
  }

  // Handle Joi validation errors
  if (err.name === 'ValidationError' && (err as any).isJoi) {
    const joiError = err as any;
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_2001',
        message: '입력 데이터가 유효하지 않습니다.',
        details: joiError.details?.map((detail: any) => ({
          field: detail.path?.join('.'),
          message: detail.message,
        })),
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId,
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle JSON parsing errors
  if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'VALIDATION_2003',
        message: '잘못된 JSON 형식입니다.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId,
      },
    };

    res.status(400).json(response);
    return;
  }

  // Handle database errors
  if (err.name === 'QueryFailedError' || err.name === 'EntityNotFoundError') {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'DATABASE_4001',
        message: '데이터베이스 오류가 발생했습니다.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId,
      },
    };

    res.status(500).json(response);
    return;
  }

  // Handle rate limiting errors
  if (err.message?.includes('rate limit')) {
    const response: ErrorResponse = {
      success: false,
      error: {
        code: 'RATE_LIMIT_6001',
        message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.',
        timestamp: new Date().toISOString(),
        path: req.originalUrl,
        requestId,
      },
    };

    res.status(429).json(response);
    return;
  }

  // Default error response
  const response: ErrorResponse = {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: process.env.NODE_ENV === 'production' 
        ? '서버 내부 오류가 발생했습니다.' 
        : err.message,
      timestamp: new Date().toISOString(),
      path: req.originalUrl,
      requestId,
    },
  };

  res.status(500).json(response);
}

/**
 * Async error wrapper middleware
 */
export function asyncErrorHandler(fn: Function) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Error tracking and reporting
 */
export function trackError(error: Error, context: any = {}): void {
  // Log error for monitoring
  logger.error('Error tracked', {
    error: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString(),
  });

  // In production, you might want to send to external error tracking service
  // like Sentry, LogRocket, etc.
  if (process.env.NODE_ENV === 'production') {
    // Example: send to external service
    // errorTrackingService.captureException(error, context);
  }
}

/**
 * Validation error formatter
 */
export function formatValidationError(errors: any[]): string[] {
  return errors.map(error => {
    const field = error.path?.join('.') || 'unknown';
    return `${field}: ${error.message}`;
  });
}

/**
 * Create error response helper
 */
export function createErrorResponse(
  code: string,
  message: string,
  details?: any,
  statusCode?: number
): ErrorResponse {
  const errorInfo = ERROR_CODES[code as keyof typeof ERROR_CODES];
  
  return {
    success: false,
    error: {
      code,
      message: message || errorInfo?.message || '알 수 없는 오류가 발생했습니다.',
      details,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Throw error helper
 */
export function throwError(
  code: string,
  message?: string,
  statusCode?: number
): never {
  const errorInfo = ERROR_CODES[code as keyof typeof ERROR_CODES];
  const finalStatusCode = statusCode || errorInfo?.statusCode || 500;
  const finalMessage = message || errorInfo?.message || '알 수 없는 오류가 발생했습니다.';

  throw new AppError(finalMessage, finalStatusCode, code);
} 