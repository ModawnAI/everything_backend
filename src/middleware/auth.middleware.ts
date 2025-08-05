import { Request, Response, NextFunction } from 'express';
// Supabase client imported from database config
import jwt from 'jsonwebtoken';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';

/**
 * JWT Authentication Middleware
 * 
 * Provides comprehensive JWT token validation for Supabase Auth integration.
 * Handles token extraction, verification, user population, and error scenarios.
 */

// Extended Request interface with authenticated user
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role: string;
    status: string;
    aud: string;
    exp: number;
    iat: number;
    iss: string;
    sub: string;
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    last_sign_in_at?: string;
    user_metadata?: Record<string, any>;
    app_metadata?: Record<string, any>;
  };
  token?: string;
}

// JWT Payload interface for Supabase tokens
interface SupabaseJWTPayload {
  aud: string;
  exp: number;
  iat: number;
  iss: string;
  sub: string;
  email?: string;
  phone?: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
  };
  user_metadata?: Record<string, any>;
  role?: string;
  aal?: string;
  amr?: Array<{
    method: string;
    timestamp: number;
  }>;
  session_id?: string;
  email_confirmed_at?: string;
  phone_confirmed_at?: string;
  last_sign_in_at?: string;
}

// Authentication error types
export class AuthenticationError extends Error {
  constructor(
    message: string,
    public statusCode: number = 401,
    public code: string = 'AUTH_ERROR'
  ) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class TokenExpiredError extends AuthenticationError {
  constructor(message: string = 'Token has expired') {
    super(message, 401, 'TOKEN_EXPIRED');
    this.name = 'TokenExpiredError';
  }
}

export class InvalidTokenError extends AuthenticationError {
  constructor(message: string = 'Invalid token') {
    super(message, 401, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export class UserNotFoundError extends AuthenticationError {
  constructor(message: string = 'User not found') {
    super(message, 404, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

/**
 * Extract JWT token from Authorization header
 */
export function extractTokenFromHeader(authHeader?: string): string | null {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2) {
    return null;
  }

  const [scheme, token] = parts;
  
  if (!scheme || !/^Bearer$/i.test(scheme)) {
    return null;
  }

  return token || null;
}

/**
 * Verify JWT token using Supabase JWT secret
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseJWTPayload> {
  try {
    // Get JWT secret from Supabase configuration
    const jwtSecret = config.auth.jwtSecret;
    
    if (!jwtSecret) {
      throw new InvalidTokenError('JWT secret not configured');
    }

    // Verify and decode the token
    const decoded = jwt.verify(token, jwtSecret, {
      issuer: config.auth.issuer,
      audience: config.auth.audience,
    }) as SupabaseJWTPayload;

    // Validate required fields
    if (!decoded.sub) {
      throw new InvalidTokenError('Token missing user ID');
    }

    if (!decoded.exp || decoded.exp < Date.now() / 1000) {
      throw new TokenExpiredError('Token has expired');
    }

    return decoded;
  } catch (error) {
    // Check error name for JWT library errors
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError('Token has expired');
      }
      
      if (error.name === 'JsonWebTokenError') {
        throw new InvalidTokenError(`Invalid token: ${error.message}`);
      }
    }
    
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    logger.error('Token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw new InvalidTokenError('Token verification failed');
  }
}

/**
 * Get user data from database using token payload
 */
export async function getUserFromToken(tokenPayload: SupabaseJWTPayload): Promise<any> {
  try {
    const supabase = getSupabaseClient();
    
    // Query user data from our users table
    const { data: userData, error } = await supabase
      .from('users')
      .select(`
        id,
        email,
        name,
        user_role,
        user_status,
        is_influencer,
        phone_verified,
        created_at,
        updated_at
      `)
      .eq('id', tokenPayload.sub)
      .single();

    if (error || !userData) {
      logger.error('User not found in database', {
        error: error?.message,
        userId: tokenPayload.sub
      });
      throw new UserNotFoundError('User not found in database');
    }

    // Check if user is active
    if (userData.user_status !== 'active') {
      throw new AuthenticationError(
        `User account is ${userData.user_status}`,
        403,
        'USER_INACTIVE'
      );
    }

    return userData;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }
    
    logger.error('Error fetching user from database', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: tokenPayload.sub
    });
    
    throw new UserNotFoundError('Failed to fetch user data');
  }
}

/**
 * Main JWT authentication middleware
 */
export function authenticateJWT() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Extract token from Authorization header
      const authHeader = req.headers.authorization;
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        throw new AuthenticationError('Missing authorization token', 401, 'MISSING_TOKEN');
      }

      // Verify the JWT token
      const tokenPayload = await verifySupabaseToken(token);

      // Get user data from database
      const userData = await getUserFromToken(tokenPayload);

      // Populate request with user information
      req.user = {
        id: userData.id,
        email: userData.email,
        role: userData.user_role,
        status: userData.user_status,
        aud: tokenPayload.aud,
        exp: tokenPayload.exp,
        iat: tokenPayload.iat,
        iss: tokenPayload.iss,
        sub: tokenPayload.sub,
        ...(tokenPayload.email_confirmed_at && { email_confirmed_at: tokenPayload.email_confirmed_at }),
        ...(tokenPayload.phone_confirmed_at && { phone_confirmed_at: tokenPayload.phone_confirmed_at }),
        ...(tokenPayload.last_sign_in_at && { last_sign_in_at: tokenPayload.last_sign_in_at }),
        ...(tokenPayload.user_metadata && { user_metadata: tokenPayload.user_metadata }),
        ...(tokenPayload.app_metadata && { app_metadata: tokenPayload.app_metadata }),
      };

      req.token = token;

      logger.debug('User authenticated successfully', {
        userId: userData.id,
        email: userData.email,
        role: userData.user_role
      });

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        logger.warn('Authentication failed', {
          error: error.message,
          code: error.code,
          ip: req.ip,
          userAgent: req.get('User-Agent')
        });
        
        res.status(error.statusCode).json({
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      logger.error('Unexpected authentication error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip
      });

      res.status(500).json({
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Internal server error',
          timestamp: new Date().toISOString()
        }
      });
    }
  };
}

/**
 * Optional authentication middleware (doesn't fail if no token)
 */
export function optionalAuth() {
  return async (req: AuthenticatedRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;
      const token = extractTokenFromHeader(authHeader);

      if (!token) {
        // No token provided, continue without authentication
        next();
        return;
      }

      // Try to authenticate if token is provided
      const tokenPayload = await verifySupabaseToken(token);
      const userData = await getUserFromToken(tokenPayload);

      req.user = {
        id: userData.id,
        email: userData.email,
        role: userData.user_role,
        status: userData.user_status,
        aud: tokenPayload.aud,
        exp: tokenPayload.exp,
        iat: tokenPayload.iat,
        iss: tokenPayload.iss,
        sub: tokenPayload.sub,
        ...(tokenPayload.email_confirmed_at && { email_confirmed_at: tokenPayload.email_confirmed_at }),
        ...(tokenPayload.phone_confirmed_at && { phone_confirmed_at: tokenPayload.phone_confirmed_at }),
        ...(tokenPayload.last_sign_in_at && { last_sign_in_at: tokenPayload.last_sign_in_at }),
        ...(tokenPayload.user_metadata && { user_metadata: tokenPayload.user_metadata }),
        ...(tokenPayload.app_metadata && { app_metadata: tokenPayload.app_metadata }),
      };

      req.token = token;

      next();
    } catch (error) {
      // For optional auth, we log but don't fail the request
      logger.debug('Optional authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ip: req.ip
      });

      next();
    }
  };
}

/**
 * Require specific user roles
 */
export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn('Insufficient permissions', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: roles,
        ip: req.ip
      });

      res.status(403).json({
        error: {
          code: 'INSUFFICIENT_PERMISSIONS',
          message: 'Insufficient permissions for this action',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

/**
 * Require user account verification
 */
export function requireVerification() {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: {
          code: 'AUTHENTICATION_REQUIRED',
          message: 'Authentication required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    if (!req.user.email_confirmed_at) {
      res.status(403).json({
        error: {
          code: 'EMAIL_NOT_VERIFIED',
          message: 'Email verification required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}

export default {
  authenticateJWT,
  optionalAuth,
  requireRole,
  requireVerification,
  extractTokenFromHeader,
  verifySupabaseToken,
  getUserFromToken,
  AuthenticationError,
  TokenExpiredError,
  InvalidTokenError,
  UserNotFoundError
}; 