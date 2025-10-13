/**
 * API Response Formatter
 *
 * Standardizes all API responses across the application with consistent structure,
 * error handling, and metadata support for the 에뷰리띵 Beauty Service Platform
 *
 * IMPORTANT: This formatter automatically transforms all response data from snake_case
 * to camelCase for frontend compatibility while maintaining database conventions.
 */

import { Response } from 'express';
import { logger } from './logger';
import { transformKeysToCamel } from './case-transformer';

// =============================================
// RESPONSE INTERFACES
// =============================================

export interface StandardResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  timestamp: string;
  requestId?: string;
  meta?: ResponseMeta;
}

export interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
    path?: string;
    requestId?: string;
    stack?: string; // Only in development
  };
}

export interface ResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasMore?: boolean;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
  executionTime?: number;
  version?: string;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  total: number;
  hasMore?: boolean;
  filters?: Record<string, any>;
  sort?: {
    field: string;
    order: 'asc' | 'desc';
  };
}

// =============================================
// RESPONSE FORMATTER CLASS
// =============================================

export class ResponseFormatter {
  private static instance: ResponseFormatter;
  private readonly version = '1.0.0';

  private constructor() {}

  public static getInstance(): ResponseFormatter {
    if (!ResponseFormatter.instance) {
      ResponseFormatter.instance = new ResponseFormatter();
    }
    return ResponseFormatter.instance;
  }

  /**
   * Send successful response
   * Automatically transforms data from snake_case to camelCase
   */
  success<T>(
    res: Response,
    data?: T,
    message?: string,
    statusCode: number = 200,
    meta?: ResponseMeta
  ): void {
    const requestId = res.locals.requestId || res.get('x-request-id');
    const startTime = res.locals.startTime;

    // Transform data from snake_case to camelCase for frontend
    const transformedData = data !== undefined ? transformKeysToCamel(data) : undefined;

    const response: StandardResponse<T> = {
      success: true,
      timestamp: new Date().toISOString(),
      ...(transformedData !== undefined && { data: transformedData }),
      ...(message && { message }),
      ...(requestId && { requestId }),
      ...(meta && {
        meta: {
          ...meta,
          ...(startTime && { executionTime: Date.now() - startTime }),
          version: this.version
        }
      })
    };

    // Log successful response
    logger.info('API Response Success', {
      statusCode,
      path: res.req.originalUrl,
      method: res.req.method,
      requestId,
      executionTime: meta?.executionTime,
      dataSize: data ? JSON.stringify(data).length : 0
    });

    res.status(statusCode).json(response);
  }

  /**
   * Send paginated response
   */
  paginated<T>(
    res: Response,
    data: T[],
    pagination: PaginationOptions,
    message?: string,
    statusCode: number = 200
  ): void {
    const totalPages = Math.ceil(pagination.total / pagination.limit);
    const hasMore = pagination.hasMore ?? (pagination.page < totalPages);

    const meta: ResponseMeta = {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages,
      hasMore,
      ...(pagination.filters && { filters: pagination.filters }),
      ...(pagination.sort && { sort: pagination.sort })
    };

    this.success(res, data, message, statusCode, meta);
  }

  /**
   * Send created response (201)
   */
  created<T>(
    res: Response,
    data?: T,
    message: string = '리소스가 성공적으로 생성되었습니다.'
  ): void {
    this.success(res, data, message, 201);
  }

  /**
   * Send no content response (204)
   */
  noContent(res: Response): void {
    const requestId = res.locals.requestId || res.get('x-request-id');
    
    logger.info('API Response No Content', {
      statusCode: 204,
      path: res.req.originalUrl,
      method: res.req.method,
      requestId
    });

    res.status(204).send();
  }

  /**
   * Send error response
   */
  error(
    res: Response,
    code: string,
    message: string,
    statusCode: number = 500,
    details?: any
  ): void {
    const requestId = res.locals.requestId || res.get('x-request-id');
    const isDevelopment = process.env.NODE_ENV === 'development';

    const response: ErrorResponse = {
      success: false,
      error: {
        code,
        message,
        timestamp: new Date().toISOString(),
        path: res.req.originalUrl,
        ...(requestId && { requestId }),
        ...(details && { details }),
        ...(isDevelopment && res.locals.errorStack && { stack: res.locals.errorStack })
      }
    };

    // Log error response
    logger.error('API Response Error', {
      statusCode,
      errorCode: code,
      message,
      path: res.req.originalUrl,
      method: res.req.method,
      requestId,
      details,
      userAgent: res.req.get('User-Agent'),
      ip: res.req.ip
    });

    res.status(statusCode).json(response);
  }

  /**
   * Send validation error response (400)
   */
  validationError(
    res: Response,
    message: string = '입력 데이터가 유효하지 않습니다.',
    details?: any
  ): void {
    this.error(res, 'VALIDATION_ERROR', message, 400, details);
  }

  /**
   * Send unauthorized error response (401)
   */
  unauthorized(
    res: Response,
    message: string = '인증이 필요합니다.'
  ): void {
    this.error(res, 'UNAUTHORIZED', message, 401);
  }

  /**
   * Send forbidden error response (403)
   */
  forbidden(
    res: Response,
    message: string = '접근 권한이 없습니다.'
  ): void {
    this.error(res, 'FORBIDDEN', message, 403);
  }

  /**
   * Send not found error response (404)
   */
  notFound(
    res: Response,
    message: string = '요청한 리소스를 찾을 수 없습니다.'
  ): void {
    this.error(res, 'NOT_FOUND', message, 404);
  }

  /**
   * Send conflict error response (409)
   */
  conflict(
    res: Response,
    message: string = '리소스 충돌이 발생했습니다.',
    details?: any
  ): void {
    this.error(res, 'CONFLICT', message, 409, details);
  }

  /**
   * Send rate limit error response (429)
   */
  rateLimitExceeded(
    res: Response,
    message: string = '요청 한도를 초과했습니다.',
    retryAfter?: number
  ): void {
    if (retryAfter) {
      res.set('Retry-After', retryAfter.toString());
    }
    this.error(res, 'RATE_LIMIT_EXCEEDED', message, 429, { retryAfter });
  }

  /**
   * Send bad request error response (400)
   */
  badRequest(
    res: Response,
    message: string = '잘못된 요청입니다.'
  ): void {
    this.error(res, 'BAD_REQUEST', message, 400);
  }

  /**
   * Send internal server error response (500)
   */
  internalError(
    res: Response,
    message: string = '서버 내부 오류가 발생했습니다.'
  ): void {
    this.error(res, 'INTERNAL_SERVER_ERROR', message, 500);
  }

  /**
   * Send internal server error response (500) - alias for internalError
   */
  internalServerError(
    res: Response,
    message: string = '서버 내부 오류가 발생했습니다.'
  ): void {
    this.internalError(res, message);
  }

  /**
   * Send service unavailable error response (503)
   */
  serviceUnavailable(
    res: Response,
    message: string = '서비스를 일시적으로 사용할 수 없습니다.'
  ): void {
    this.error(res, 'SERVICE_UNAVAILABLE', message, 503);
  }
}

// =============================================
// SINGLETON INSTANCE AND HELPER FUNCTIONS
// =============================================

export const responseFormatter = ResponseFormatter.getInstance();

// Convenience functions for common responses
export const sendSuccess = <T>(
  res: Response,
  data?: T,
  message?: string,
  statusCode?: number,
  meta?: ResponseMeta
) => responseFormatter.success(res, data, message, statusCode, meta);

export const sendPaginated = <T>(
  res: Response,
  data: T[],
  pagination: PaginationOptions,
  message?: string,
  statusCode?: number
) => responseFormatter.paginated(res, data, pagination, message, statusCode);

export const sendCreated = <T>(
  res: Response,
  data?: T,
  message?: string
) => responseFormatter.created(res, data, message);

export const sendNoContent = (res: Response) => 
  responseFormatter.noContent(res);

export const sendError = (
  res: Response,
  code: string,
  message: string,
  statusCode?: number,
  details?: any
) => responseFormatter.error(res, code, message, statusCode, details);

export const sendValidationError = (
  res: Response,
  message?: string,
  details?: any
) => responseFormatter.validationError(res, message, details);

export const sendUnauthorized = (
  res: Response,
  message?: string
) => responseFormatter.unauthorized(res, message);

export const sendForbidden = (
  res: Response,
  message?: string
) => responseFormatter.forbidden(res, message);

export const sendNotFound = (
  res: Response,
  message?: string
) => responseFormatter.notFound(res, message);

export const sendConflict = (
  res: Response,
  message?: string,
  details?: any
) => responseFormatter.conflict(res, message, details);

export const sendRateLimitExceeded = (
  res: Response,
  message?: string,
  retryAfter?: number
) => responseFormatter.rateLimitExceeded(res, message, retryAfter);

export const sendBadRequest = (
  res: Response,
  message?: string
) => responseFormatter.badRequest(res, message);

export const sendInternalError = (
  res: Response,
  message?: string
) => responseFormatter.internalError(res, message);

export const sendInternalServerError = (
  res: Response,
  message?: string
) => responseFormatter.internalServerError(res, message);

export const sendServiceUnavailable = (
  res: Response,
  message?: string
) => responseFormatter.serviceUnavailable(res, message);

// =============================================
// RESPONSE MIDDLEWARE
// =============================================

/**
 * Middleware to add response formatter methods to Express Response object
 */
export function responseFormatterMiddleware() {
  return (req: any, res: any, next: any) => {
    // Add request ID and start time for tracking
    res.locals.requestId = req.headers['x-request-id'] || `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    res.locals.startTime = Date.now();

    // Add convenience methods to response object
    res.sendSuccess = (data?: any, message?: string, statusCode?: number, meta?: ResponseMeta) =>
      responseFormatter.success(res, data, message, statusCode, meta);

    res.sendPaginated = (data: any[], pagination: PaginationOptions, message?: string, statusCode?: number) =>
      responseFormatter.paginated(res, data, pagination, message, statusCode);

    res.sendCreated = (data?: any, message?: string) =>
      responseFormatter.created(res, data, message);

    res.sendNoContent = () =>
      responseFormatter.noContent(res);

    res.sendError = (code: string, message: string, statusCode?: number, details?: any) =>
      responseFormatter.error(res, code, message, statusCode, details);

    res.sendValidationError = (message?: string, details?: any) =>
      responseFormatter.validationError(res, message, details);

    res.sendUnauthorized = (message?: string) =>
      responseFormatter.unauthorized(res, message);

    res.sendForbidden = (message?: string) =>
      responseFormatter.forbidden(res, message);

    res.sendNotFound = (message?: string) =>
      responseFormatter.notFound(res, message);

    res.sendConflict = (message?: string, details?: any) =>
      responseFormatter.conflict(res, message, details);

    res.sendRateLimitExceeded = (message?: string, retryAfter?: number) =>
      responseFormatter.rateLimitExceeded(res, message, retryAfter);

    res.sendBadRequest = (message?: string) =>
      responseFormatter.badRequest(res, message);

    res.sendInternalError = (message?: string) =>
      responseFormatter.internalError(res, message);

    res.sendInternalServerError = (message?: string) =>
      responseFormatter.internalServerError(res, message);

    res.sendServiceUnavailable = (message?: string) =>
      responseFormatter.serviceUnavailable(res, message);

    next();
  };
}

// =============================================
// TYPE EXTENSIONS FOR EXPRESS
// =============================================

declare global {
  namespace Express {
    interface Response {
      sendSuccess<T>(data?: T, message?: string, statusCode?: number, meta?: ResponseMeta): void;
      sendPaginated<T>(data: T[], pagination: PaginationOptions, message?: string, statusCode?: number): void;
      sendCreated<T>(data?: T, message?: string): void;
      sendNoContent(): void;
      sendError(code: string, message: string, statusCode?: number, details?: any): void;
      sendValidationError(message?: string, details?: any): void;
      sendUnauthorized(message?: string): void;
      sendForbidden(message?: string): void;
      sendNotFound(message?: string): void;
      sendConflict(message?: string, details?: any): void;
      sendRateLimitExceeded(message?: string, retryAfter?: number): void;
      sendBadRequest(message?: string): void;
      sendInternalError(message?: string): void;
      sendInternalServerError(message?: string): void;
      sendServiceUnavailable(message?: string): void;
    }
  }
}

export default responseFormatter;
