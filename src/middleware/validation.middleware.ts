import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import { logger } from '../utils/logger';

/**
 * Request Validation Middleware
 * 
 * Provides Joi-based validation for request bodies, query parameters, and headers.
 * Supports standardized error responses and detailed validation messages.
 */

export interface ValidationError {
  field: string;
  message: string;
  value?: any;
}

export interface ValidationResult {
  success: boolean;
  errors?: ValidationError[];
  data?: any;
}

export class RequestValidationError extends Error {
  constructor(
    message: string,
    public errors: ValidationError[],
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'RequestValidationError';
  }
}

/**
 * Validate request body against Joi schema
 */
export function validateRequestBody(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      // Log incoming request for social-login endpoint
      if (req.path === '/auth/social-login' || req.path.endsWith('/social-login')) {
        logger.info('🔍 [VALIDATION] Incoming social-login request', {
          path: req.path,
          method: req.method,
          bodyKeys: Object.keys(req.body || {}),
          bodyPreview: {
            provider: req.body?.provider,
            hasToken: !!req.body?.token,
            hasIdToken: !!req.body?.idToken,
            hasAccessToken: !!req.body?.accessToken,
            tokenLength: req.body?.token?.length || req.body?.idToken?.length || 0
          },
          headers: {
            contentType: req.headers['content-type'],
            userAgent: req.headers['user-agent']?.substring(0, 50)
          },
          ip: req.ip
        });
      }

      const { error, value } = schema.validate(req.body, {
        abortEarly: false, // Get all validation errors
        stripUnknown: true, // Remove unknown properties
        allowUnknown: false // Don't allow unknown properties
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('❌ [VALIDATION] Request body validation failed', {
          errors: validationErrors,
          path: req.path,
          method: req.method,
          ip: req.ip,
          receivedBody: req.body
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Request validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Log successful validation for social-login
      if (req.path === '/auth/social-login' || req.path.endsWith('/social-login')) {
        logger.info('✅ [VALIDATION] Social-login validation passed', {
          path: req.path,
          validatedFields: Object.keys(value || {})
        });
      }

      // Replace request body with validated and sanitized data
      req.body = value;
      next();
    } catch (error) {
      logger.error('Unexpected error during request validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Validate query parameters against Joi schema
 */
export function validateQueryParams(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Query parameters validation failed', {
          errors: validationErrors,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Query parameters validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Replace query with validated and sanitized data
      req.query = value;
      next();
    } catch (error) {
      logger.error('Unexpected error during query validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Validate request headers against Joi schema
 */
export function validateHeaders(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.headers, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: true // Headers often have additional properties
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Headers validation failed', {
          errors: validationErrors,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Headers validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      next();
    } catch (error) {
      logger.error('Unexpected error during headers validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Generic validation function for custom validation logic
 */
export function customValidation(
  validatorFn: (req: Request) => ValidationResult
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const result = validatorFn(req);

      if (!result.success) {
        logger.warn('Custom validation failed', {
          errors: result.errors,
          path: req.path,
          method: req.method,
          ip: req.ip
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Custom validation failed',
            details: result.errors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (result.data) {
        // Merge validated data into request
        Object.assign(req, result.data);
      }

      next();
    } catch (error) {
      logger.error('Unexpected error during custom validation', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        path: req.path,
        method: req.method
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Internal server error occurred',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Validate request query parameters against Joi schema
 */
export function validateRequestQuery(schema: Joi.Schema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const { error, value } = schema.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
        allowUnknown: false
      });

      if (error) {
        const validationErrors: ValidationError[] = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value
        }));

        logger.warn('Query validation failed', {
          errors: validationErrors,
          query: req.query,
          endpoint: req.originalUrl
        });

        res.status(400).json({
          success: false,
          error: {
            code: 'QUERY_VALIDATION_ERROR',
            message: 'Query parameters validation failed',
            details: validationErrors,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      req.query = value;
      next();
    } catch (error) {
      logger.error('Query validation middleware error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        query: req.query
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'VALIDATION_MIDDLEWARE_ERROR',
          message: 'Query validation middleware error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Express-validator validateRequest function
 * This is a compatibility function for express-validator integration
 */
export function validateRequest(req: Request, res: Response, next: NextFunction): void {
  // This function is used by express-validator
  // The actual validation is handled by the express-validator middleware
  next();
}

/**
 * Validate request with schema and type
 */
export function validateRequestWithSchema(schema: Joi.Schema, type: 'query' | 'body' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    let dataToValidate: any;
    
    switch (type) {
      case 'query':
        dataToValidate = req.query;
        break;
      case 'params':
        dataToValidate = req.params;
        break;
      case 'body':
      default:
        dataToValidate = req.body;
        break;
    }

    const { error, value } = schema.validate(dataToValidate, { abortEarly: false });
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Replace the original data with validated data
    switch (type) {
      case 'query':
        req.query = value;
        break;
      case 'params':
        req.params = value;
        break;
      case 'body':
      default:
        req.body = value;
        break;
    }

    next();
  };
}

export default {
  validateRequestBody,
  validateQueryParams,
  validateRequestQuery,
  validateHeaders,
  customValidation,
  validateRequest,
  validateRequestWithSchema,
  RequestValidationError
}; 