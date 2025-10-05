import { Request, Response, NextFunction } from 'express';
// Supabase client imported from database config
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { securityMonitoringService } from '../services/security-monitoring.service';

/**
 * JWT Authentication Middleware
 * 
 * Provides comprehensive JWT token validation for Supabase Auth integration.
 * Handles token extraction, verification, user population, and error scenarios.
 */

// Extended Request interface with authenticated user and session info
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
  session?: {
    id: string;
    deviceId: string;
    deviceFingerprint?: string;
    lastActivity: Date;
    isNewDevice: boolean;
  };
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
 * Verify JWT token using Supabase's built-in verification
 */
export async function verifySupabaseToken(token: string): Promise<SupabaseJWTPayload> {
  try {
    const supabase = getSupabaseClient();
    
    // Use Supabase's built-in token verification
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error) {
      logger.error('Supabase token verification failed', { error: error.message });
      
      if (error.message.includes('expired')) {
        throw new TokenExpiredError('Token has expired');
      }
      
      throw new InvalidTokenError(`Invalid token: ${error.message}`);
    }
    
    if (!user) {
      throw new InvalidTokenError('No user found for token');
    }

    // Create compatible payload format
    const payload: SupabaseJWTPayload = {
      sub: user.id,
      aud: user.aud || 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600, // Default 1 hour if not available
      iat: Math.floor(Date.now() / 1000),
      iss: config.auth.issuer,
      email: user.email,
      phone: user.phone,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
      role: user.role,
      ...(user.email_confirmed_at && { email_confirmed_at: user.email_confirmed_at }),
      ...(user.phone_confirmed_at && { phone_confirmed_at: user.phone_confirmed_at }),
      ...(user.last_sign_in_at && { last_sign_in_at: user.last_sign_in_at })
    };

    return payload;
  } catch (error) {
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
 * Fallback JWT verification using local secret (for backward compatibility)
 */
export async function verifySupabaseTokenLocal(token: string): Promise<SupabaseJWTPayload> {
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
    
    logger.error('Local token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    
    throw new InvalidTokenError('Token verification failed');
  }
}

/**
 * Enhanced device fingerprint interface
 */
export interface EnhancedDeviceFingerprint {
  fingerprint: string;
  userAgent: string;
  ipAddress: string;
  acceptLanguage: string;
  acceptEncoding: string;
  timezone?: string;
  screenResolution?: string;
  platform?: string;
  browser?: {
    name: string;
    version: string;
  };
  os?: {
    name: string;
    version: string;
  };
  deviceType?: 'mobile' | 'tablet' | 'desktop' | 'unknown';
}

/**
 * Parse user agent to extract browser and OS information
 */
function parseUserAgent(userAgent: string): { browser: { name: string; version: string }, os: { name: string; version: string }, platform: string, deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' } {
  const browser = { name: 'unknown', version: 'unknown' };
  const os = { name: 'unknown', version: 'unknown' };
  let platform = 'unknown';
  let deviceType: 'mobile' | 'tablet' | 'desktop' | 'unknown' = 'unknown';

  // Browser detection
  if (userAgent.includes('Chrome')) {
    browser.name = 'Chrome';
    const match = userAgent.match(/Chrome\/([0-9.]+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Firefox')) {
    browser.name = 'Firefox';
    const match = userAgent.match(/Firefox\/([0-9.]+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Safari') && !userAgent.includes('Chrome')) {
    browser.name = 'Safari';
    const match = userAgent.match(/Version\/([0-9.]+)/);
    if (match) browser.version = match[1];
  } else if (userAgent.includes('Edge')) {
    browser.name = 'Edge';
    const match = userAgent.match(/Edge\/([0-9.]+)/);
    if (match) browser.version = match[1];
  }

  // OS detection
  if (userAgent.includes('Windows')) {
    os.name = 'Windows';
    if (userAgent.includes('Windows NT 10.0')) os.version = '10';
    else if (userAgent.includes('Windows NT 6.3')) os.version = '8.1';
    else if (userAgent.includes('Windows NT 6.2')) os.version = '8';
    else if (userAgent.includes('Windows NT 6.1')) os.version = '7';
    platform = 'Windows';
    deviceType = 'desktop';
  } else if (userAgent.includes('Mac OS X')) {
    os.name = 'macOS';
    const match = userAgent.match(/Mac OS X ([0-9_]+)/);
    if (match) os.version = match[1].replace(/_/g, '.');
    platform = 'macOS';
    deviceType = userAgent.includes('Mobile') ? 'mobile' : 'desktop';
  } else if (userAgent.includes('Linux')) {
    os.name = 'Linux';
    platform = 'Linux';
    deviceType = 'desktop';
  } else if (userAgent.includes('Android')) {
    os.name = 'Android';
    const match = userAgent.match(/Android ([0-9.]+)/);
    if (match) os.version = match[1];
    platform = 'Android';
    deviceType = userAgent.includes('Mobile') ? 'mobile' : 'tablet';
  } else if (userAgent.includes('iPhone') || userAgent.includes('iPad')) {
    os.name = 'iOS';
    const match = userAgent.match(/OS ([0-9_]+)/);
    if (match) os.version = match[1].replace(/_/g, '.');
    platform = 'iOS';
    deviceType = userAgent.includes('iPad') ? 'tablet' : 'mobile';
  }

  return { browser, os, platform, deviceType };
}

/**
 * Generate comprehensive device fingerprint from request headers and client info
 */
export function generateEnhancedDeviceFingerprint(req: Request, clientInfo?: any): EnhancedDeviceFingerprint {
  const userAgent = req.headers['user-agent'] || '';
  const acceptLanguage = req.headers['accept-language'] || '';
  const acceptEncoding = req.headers['accept-encoding'] || '';
  const ipAddress = req.ip || req.connection.remoteAddress || '';
  const timezone = clientInfo?.timezone || req.headers['x-timezone'] || '';
  const screenResolution = clientInfo?.screenResolution || req.headers['x-screen-resolution'] || '';

  // Parse user agent for detailed device info
  const { browser, os, platform, deviceType } = parseUserAgent(userAgent);

  // Create comprehensive fingerprint data
  const fingerprintData = [
    userAgent,
    acceptLanguage,
    acceptEncoding,
    ipAddress,
    timezone,
    screenResolution,
    platform,
    browser.name,
    browser.version,
    os.name,
    os.version
  ].join('|');

  const fingerprint = crypto.createHash('sha256').update(fingerprintData).digest('hex');

  return {
    fingerprint,
    userAgent,
    ipAddress,
    acceptLanguage,
    acceptEncoding,
    timezone,
    screenResolution,
    platform,
    browser,
    os,
    deviceType
  };
}

/**
 * Generate simple device fingerprint from request headers (backward compatibility)
 */
export function generateDeviceFingerprint(req: Request): string {
  return generateEnhancedDeviceFingerprint(req).fingerprint;
}

/**
 * Validate and track user session
 */
export async function validateAndTrackSession(
  userId: string, 
  token: string, 
  req: Request
): Promise<{
  sessionId: string;
  deviceId: string;
  deviceFingerprint: string;
  isNewDevice: boolean;
  lastActivity: Date;
  enhancedFingerprint: EnhancedDeviceFingerprint;
}> {
  const supabase = getSupabaseClient();
  const enhancedFingerprint = generateEnhancedDeviceFingerprint(req, {
    timezone: req.headers['x-timezone'],
    screenResolution: req.headers['x-screen-resolution']
  });
  const deviceFingerprint = enhancedFingerprint.fingerprint;
  const now = new Date();

  try {
    // Check if we have an active session for this token
    const { data: existingSession, error: sessionError } = await supabase
      .from('refresh_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .eq('is_active', true)
      .gt('expires_at', now.toISOString())
      .order('last_activity', { ascending: false })
      .limit(1)
      .single();

    let sessionId: string;
    let deviceId: string;
    let isNewDevice = false;

    if (sessionError || !existingSession) {
      // New device/session
      isNewDevice = true;
      sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      deviceId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      logger.info('New device detected for user', {
        userId,
        deviceFingerprint,
        deviceType: enhancedFingerprint.deviceType,
        browser: enhancedFingerprint.browser,
        os: enhancedFingerprint.os,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      });

      // Log security event for new device
      await securityMonitoringService.logSecurityEvent({
        event_type: 'suspicious_activity',
        user_id: userId,
        source_ip: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.path,
        severity: 'medium',
        details: {
          deviceFingerprint,
          isNewDevice: true,
          activity_type: 'new_device_login',
          deviceInfo: {
            deviceType: enhancedFingerprint.deviceType,
            browser: enhancedFingerprint.browser,
            os: enhancedFingerprint.os,
            platform: enhancedFingerprint.platform
          }
        }
      });
    } else {
      // Existing session
      sessionId = existingSession.id;
      deviceId = existingSession.device_id;

      // Update session activity
      await supabase
        .from('refresh_tokens')
        .update({
          last_activity: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', sessionId);
    }

    return {
      sessionId,
      deviceId,
      deviceFingerprint,
      isNewDevice,
      lastActivity: now,
      enhancedFingerprint
    };

  } catch (error) {
    logger.error('Session validation failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId,
      deviceFingerprint
    });

    // Return minimal session info on error
    return {
      sessionId: `fallback_${Date.now()}`,
      deviceId: `fallback_device_${Date.now()}`,
      deviceFingerprint,
      isNewDevice: true,
      lastActivity: now,
      enhancedFingerprint
    };
  }
}

/**
 * Enhanced token validation with expiration checks
 */
export async function validateTokenExpiration(tokenPayload: SupabaseJWTPayload): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  
  // Check if token is expired
  if (tokenPayload.exp && tokenPayload.exp < now) {
    throw new TokenExpiredError('Access token has expired');
  }

  // Check if token is too old (beyond refresh threshold)
  const tokenAge = now - (tokenPayload.iat || 0);
  const maxTokenAge = 24 * 60 * 60; // 24 hours in seconds
  
  if (tokenAge > maxTokenAge) {
    logger.warn('Token is beyond maximum age', {
      tokenAge,
      maxTokenAge,
      userId: tokenPayload.sub
    });
    throw new TokenExpiredError('Token is too old and needs refresh');
  }

  // Check if token was issued in the future (clock skew protection)
  const clockSkewTolerance = 300; // 5 minutes
  if (tokenPayload.iat && tokenPayload.iat > (now + clockSkewTolerance)) {
    throw new InvalidTokenError('Token issued in the future');
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

      // Verify the JWT token with fallback mechanism
      let tokenPayload: SupabaseJWTPayload;
      try {
        // First try Supabase verification (for regular users)
        tokenPayload = await verifySupabaseToken(token);
      } catch (supabaseError) {
        // If Supabase verification fails, try local JWT verification (for admin tokens)
        logger.debug('Supabase token verification failed, attempting local verification', {
          error: supabaseError instanceof Error ? supabaseError.message : 'Unknown error'
        });
        tokenPayload = await verifySupabaseTokenLocal(token);
      }

      // Enhanced token validation with expiration checks
      await validateTokenExpiration(tokenPayload);

      // Get user data from database
      const userData = await getUserFromToken(tokenPayload);

      // Validate and track session with device fingerprinting
      const sessionInfo = await validateAndTrackSession(userData.id, token, req);

      // Log authentication event for security monitoring
      await securityMonitoringService.logSecurityEvent({
        event_type: 'auth_success',
        user_id: userData.id,
        source_ip: req.ip || 'unknown',
        user_agent: req.headers['user-agent'] || 'unknown',
        endpoint: req.path,
        severity: 'low',
        details: {
          deviceFingerprint: sessionInfo.deviceFingerprint,
          isNewDevice: sessionInfo.isNewDevice,
          sessionId: sessionInfo.sessionId
        }
      });

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
      req.session = {
        id: sessionInfo.sessionId,
        deviceId: sessionInfo.deviceId,
        deviceFingerprint: sessionInfo.deviceFingerprint,
        lastActivity: sessionInfo.lastActivity,
        isNewDevice: sessionInfo.isNewDevice
      };

      logger.debug('User authenticated successfully', {
        userId: userData.id,
        email: userData.email,
        role: userData.user_role,
        sessionId: sessionInfo.sessionId,
        isNewDevice: sessionInfo.isNewDevice
      });

      next();
    } catch (error) {
      if (error instanceof AuthenticationError) {
        // Log authentication failure for security monitoring
        await securityMonitoringService.logSecurityEvent({
          event_type: 'auth_failure',
          source_ip: req.ip || 'unknown',
          user_agent: req.headers['user-agent'] || 'unknown',
          endpoint: req.path,
          severity: error.code === 'TOKEN_EXPIRED' ? 'low' : 'medium',
          details: {
            errorCode: error.code,
            errorMessage: error.message,
            deviceFingerprint: generateDeviceFingerprint(req)
          }
        });

        logger.warn('Authentication failed', {
          error: error.message,
          code: error.code,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          deviceFingerprint: generateDeviceFingerprint(req)
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

/**
 * Alias for authenticateJWT for backward compatibility
 */
export const authenticateToken = authenticateJWT;

export default {
  authenticateJWT,
  authenticateToken,
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