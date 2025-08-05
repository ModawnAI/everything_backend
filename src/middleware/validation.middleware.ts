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

        logger.warn('Request body validation failed', {
          errors: validationErrors,
          path: req.path,
          method: req.method,
          ip: req.ip
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

export default {
  validateRequestBody,
  validateQueryParams,
  validateHeaders,
  customValidation,
  RequestValidationError
}; 