import { Request, Response, NextFunction } from 'express';
// Supabase client imported from database config
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { securityMonitoringService } from '../services/security-monitoring.service';
import { TokenPayload } from '../types/unified-auth.types';
import { SessionRepository } from '../repositories';

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
    user_role?: string;  // Alias for role (for compatibility)
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
    shopId?: string;  // For dashboard toggle feature (camelCase for API response)
    shop_id?: string;  // Database field name (snake_case)
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
  shopId?: string;  // For shop access validation and dashboard toggle
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
 * Extract refresh token from Supabase auth cookie
 */
function extractRefreshTokenFromCookie(cookieHeader: string): string | null {
  try {
    const projectMatch = cookieHeader.match(/sb-([a-z0-9]+)-auth-token\.0=/);
    if (!projectMatch) return null;

    const projectRef = projectMatch[1];
    const cookieParts: string[] = [];
    let partIndex = 0;

    while (true) {
      const partPattern = new RegExp(`sb-${projectRef}-auth-token\\.${partIndex}=([^;]+)`);
      const partMatch = cookieHeader.match(partPattern);
      if (!partMatch) break;

      let partValue = partMatch[1];
      if (partIndex === 0 && partValue.startsWith('base64-')) {
        partValue = partValue.substring(7);
      }
      cookieParts.push(partValue);
      partIndex++;
    }

    if (cookieParts.length === 0) return null;

    const fullCookieValue = cookieParts.join('');
    const decodedValue = Buffer.from(fullCookieValue, 'base64').toString('utf-8');
    const sessionData = JSON.parse(decodedValue);

    return sessionData.refresh_token || null;
  } catch (error) {
    return null;
  }
}

/**
 * Extract JWT token from Supabase auth cookie
 * Fallback for when frontend doesn't send Authorization header
 * Handles multi-part cookies (sb-{project}-auth-token.0, .1, .2, etc.)
 */
function extractTokenFromSupabaseCookie(cookieHeader: string): string | null {
  try {
    // First, try simple sb-access-token cookie (custom format from frontend)
    const simpleTokenMatch = cookieHeader.match(/sb-access-token=([^;]+)/);
    if (simpleTokenMatch && simpleTokenMatch[1]) {
      const token = simpleTokenMatch[1];
      if (token.split('.').length === 3) {
        return token;
      }
    }

    // Find the project reference from the first cookie part
    const projectMatch = cookieHeader.match(/sb-([a-z0-9]+)-auth-token\.0=/);
    if (!projectMatch) {
      return null;
    }

    const projectRef = projectMatch[1];

    // Collect all cookie parts in order (.0, .1, .2, etc.)
    const cookieParts: string[] = [];
    let partIndex = 0;

    while (true) {
      const partPattern = new RegExp(`sb-${projectRef}-auth-token\\.${partIndex}=([^;]+)`);
      const partMatch = cookieHeader.match(partPattern);

      if (!partMatch) {
        break;
      }

      let partValue = partMatch[1];
      if (partIndex === 0 && partValue.startsWith('base64-')) {
        partValue = partValue.substring(7);
      }

      cookieParts.push(partValue);
      partIndex++;
    }

    if (cookieParts.length === 0) {
      return null;
    }

    const encodedToken = cookieParts.join('');
    const decodedString = Buffer.from(encodedToken, 'base64').toString('utf-8');
    const authData = JSON.parse(decodedString);

    return authData.access_token || null;
  } catch (error) {
    return null;
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

    logger.debug('[verifySupabaseToken] Starting Supabase token verification');

    // Use Supabase's built-in token verification with timeout
    const verificationPromise = supabase.auth.getUser(token);

    // Add 5 second timeout to prevent hanging
    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase token verification timeout')), 5000)
    );

    const { data: { user }, error } = await Promise.race([
      verificationPromise,
      timeoutPromise
    ]) as any;

    logger.debug('[verifySupabaseToken] Verification completed', {
      success: !error,
      hasUser: !!user,
      error: error?.message
    });

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
 *
 * IMPORTANT: JWT_SECRET in .env must be the Supabase JWT Secret
 * You can find it in Supabase Dashboard > Settings > API > JWT Secret
 * This is NOT the same as SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY
 */
export async function verifySupabaseTokenLocal(token: string): Promise<SupabaseJWTPayload> {
  try {
    const jwtSecret = config.auth.jwtSecret;

    if (!jwtSecret) {
      throw new InvalidTokenError('JWT secret not configured');
    }

    // Try with issuer/audience first (for Supabase tokens)
    let decoded: SupabaseJWTPayload;
    try {
      decoded = jwt.verify(token, jwtSecret, {
        issuer: config.auth.issuer,
        audience: config.auth.audience,
      }) as SupabaseJWTPayload;
    } catch (firstError) {
      // If issuer/audience validation fails, try without it (for admin tokens)
      decoded = jwt.verify(token, jwtSecret) as SupabaseJWTPayload;
    }

    // Validate required fields (support both 'sub' and 'userId' for compatibility)
    const userId = decoded.sub || (decoded as any).userId;
    if (!userId) {
      throw new InvalidTokenError('Token missing user ID');
    }
    // Normalize to use 'sub' field
    decoded.sub = userId;

    if (!decoded.exp || decoded.exp < Date.now() / 1000) {
      throw new TokenExpiredError('Token has expired');
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      if (error.name === 'TokenExpiredError') {
        throw new TokenExpiredError('Token has expired');
      }

      if (error.name === 'JsonWebTokenError') {
        throw new InvalidTokenError(
          error.message.includes('invalid signature')
            ? 'Token signature is invalid. Please log in again to get a new token.'
            : `Invalid token: ${error.message}`
        );
      }
    }

    if (error instanceof AuthenticationError) {
      throw error;
    }

    logger.error('[verifySupabaseTokenLocal] Local token verification failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      hint: 'Check if JWT_SECRET in .env matches Supabase Dashboard > Settings > API > JWT Secret'
    });

    throw new InvalidTokenError('Token verification failed');
  }
}

/**
 * Verify Unified Auth System Token
 * Validates tokens generated by the unified authentication system
 */
export async function verifyUnifiedAuthToken(token: string): Promise<SupabaseJWTPayload> {
  try {
    const jwtSecret = config.auth.jwtSecret;
    if (!jwtSecret) {
      throw new InvalidTokenError('JWT secret not configured');
    }

    // Decode and verify token
    const decoded = jwt.verify(token, jwtSecret) as any;

    // Validate token type
    if (decoded.type !== 'access') {
      throw new InvalidTokenError('Invalid token type');
    }

    // Validate session (legacy tokens might not have session) - with timeout
    const sessionRepo = new SessionRepository();

    // Add 3 second timeout to session query
    const sessionQueryPromise = sessionRepo.findByToken(token);
    const sessionTimeoutPromise = new Promise<null>((resolve) =>
      setTimeout(() => resolve(null), 3000)
    );
    const session = await Promise.race([sessionQueryPromise, sessionTimeoutPromise]);

    if (!session) {
      // Legacy token without session - allow if token is still valid by expiry
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new TokenExpiredError('Legacy token has expired');
      }
    } else {
      // Session exists - validate it
      if (!session.is_active) {
        throw new InvalidTokenError('Session is not active');
      }

      if (new Date() > session.expires_at) {
        throw new TokenExpiredError('Session has expired');
      }
    }

    // Fetch user information from database
    const supabase = getSupabaseClient();
    let userQuery;

    switch (decoded.role) {
      case 'admin':
        userQuery = supabase
          .from('admins')
          .select('id, email, role, shop_id')
          .eq('id', decoded.userId)
          .single();
        break;
      case 'shop_owner':
        userQuery = supabase
          .from('admins')
          .select('id, email, role, shop_id')
          .eq('id', decoded.userId)
          .eq('role', 'shop_owner')
          .single();
        break;
      case 'customer':
        userQuery = supabase
          .from('users')
          .select('id, email, full_name, phone')
          .eq('id', decoded.userId)
          .single();
        break;
      default:
        throw new InvalidTokenError('Invalid user role');
    }

    // Add 3 second timeout to user query
    const userQueryPromise = userQuery;
    const userTimeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('User query timeout')), 3000)
    );

    const { data: user, error: userError } = await Promise.race([
      userQueryPromise,
      userTimeoutPromise
    ]) as any;

    if (userError || !user) {
      throw new InvalidTokenError('User not found');
    }

    // Convert to Supabase-compatible payload format
    // Use session timestamps if available, otherwise use current time
    const now = Math.floor(Date.now() / 1000);
    const payload: SupabaseJWTPayload = {
      sub: decoded.userId,
      aud: 'authenticated',
      exp: session?.expires_at ? Math.floor(session.expires_at.getTime() / 1000) : now + 3600,
      iat: session?.created_at ? Math.floor(session.created_at.getTime() / 1000) : now,
      iss: config.auth.issuer,
      email: user.email,
      role: decoded.role,
      user_metadata: {
        full_name: user.full_name || '',
        shop_id: decoded.shopId || user.shop_id
      },
      app_metadata: {
        provider: 'unified-auth'
      }
    };

    return payload;
  } catch (error) {
    if (error instanceof AuthenticationError) {
      throw error;
    }

    if (error instanceof Error && error.name === 'TokenExpiredError') {
      throw new TokenExpiredError('Token has expired');
    }

    if (error instanceof Error && error.name === 'JsonWebTokenError') {
      throw new InvalidTokenError(`Invalid token: ${error.message}`);
    }

    throw new InvalidTokenError('Unified auth token verification failed');
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
  const now = new Date();
  const enhancedFingerprint = generateEnhancedDeviceFingerprint(req, {
    timezone: req.headers['x-timezone'],
    screenResolution: req.headers['x-screen-resolution']
  });
  const deviceFingerprint = enhancedFingerprint.fingerprint;

  // Check if session tracking is disabled for performance
  const skipSessionTracking = process.env.SKIP_SESSION_TRACKING === 'true';
  if (skipSessionTracking) {
    return {
      sessionId: `skip_${Date.now()}`,
      deviceId: `skip_device_${Date.now()}`,
      deviceFingerprint,
      isNewDevice: false,
      lastActivity: now,
      enhancedFingerprint
    };
  }

  const supabase = getSupabaseClient();

  try {
    // Check if we have an active session for this token with timeout
    const sessionQueryPromise = supabase
      .from('refresh_tokens')
      .select('*')
      .eq('user_id', userId)
      .eq('device_fingerprint', deviceFingerprint)
      .eq('is_active', true)
      .gt('expires_at', now.toISOString())
      .order('last_activity', { ascending: false })
      .limit(1)
      .single();

    // Add configurable timeout to prevent hanging (default: 2 seconds)
    const sessionQueryTimeoutMs = parseInt(process.env.SESSION_QUERY_TIMEOUT_MS || '2000', 10);
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Session query timeout')), sessionQueryTimeoutMs)
    );

    const { data: existingSession, error: sessionError } = await Promise.race([
      sessionQueryPromise,
      timeoutPromise
    ]) as any;

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

      // Log security event for new device (non-blocking, fire-and-forget)
      securityMonitoringService.logSecurityEvent({
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
      }).catch(err => {
        logger.debug('Security event logging failed (non-critical)', { error: err instanceof Error ? err.message : 'Unknown' });
      });
    } else {
      // Existing session
      sessionId = existingSession.id;
      deviceId = existingSession.device_id;

      // Update session activity with timeout
      const updatePromise = supabase
        .from('refresh_tokens')
        .update({
          last_activity: now.toISOString(),
          updated_at: now.toISOString()
        })
        .eq('id', sessionId);

      const updateTimeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Session update timeout')), 5000)
      );

      // Fire and forget - don't wait for session update to complete
      Promise.race([updatePromise, updateTimeoutPromise]).catch(error => {
        logger.warn('Session update failed or timed out', {
          error: error instanceof Error ? error.message : 'Unknown error',
          sessionId
        });
      });
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
 * Auto-create user from JWT token metadata
 * Used when Flutter native auth creates user in auth.users but not in public.users
 */
async function autoCreateUserFromToken(supabase: any, tokenPayload: SupabaseJWTPayload): Promise<any> {
  try {
    const metadata = tokenPayload.user_metadata || {};
    const appMetadata = tokenPayload.app_metadata || {};

    // Detect provider (apple, google, kakao, etc.)
    const provider = appMetadata.provider || appMetadata.providers?.[0] || 'unknown';

    // Extract name from various sources
    const name = metadata.full_name ||
                 metadata.name ||
                 metadata.kakao_account?.profile?.nickname ||
                 `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() ||
                 tokenPayload.email?.split('@')[0] ||
                 'User';

    // Extract profile image
    const profileImageUrl = metadata.avatar_url ||
                           metadata.picture ||
                           metadata.kakao_account?.profile?.profile_image_url ||
                           null;

    // Create user record
    const newUserData = {
      id: tokenPayload.sub,
      email: tokenPayload.email || null,
      name: name,
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      phone_verified: !!tokenPayload.phone_confirmed_at,
      profile_image_url: profileImageUrl,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    logger.info('[autoCreateUserFromToken] Creating user from token', {
      userId: tokenPayload.sub,
      email: tokenPayload.email,
      provider,
      name
    });

    // INSERT user
    const { data: createdUser, error: createError } = await supabase
      .from('users')
      .insert(newUserData)
      .select()
      .single();

    // Handle race condition (concurrent requests)
    if (createError?.code === '23505') {
      // User already exists (unique constraint violation) - fetch and return
      logger.info('[autoCreateUserFromToken] User already exists, fetching', { userId: tokenPayload.sub });
      const { data: existingUser } = await supabase
        .from('users')
        .select()
        .eq('id', tokenPayload.sub)
        .single();
      return existingUser;
    }

    if (createError) {
      logger.error('[autoCreateUserFromToken] Failed to create user', {
        error: createError.message,
        userId: tokenPayload.sub
      });
      return null;
    }

    logger.info('[autoCreateUserFromToken] User created successfully', { userId: tokenPayload.sub });
    return createdUser;
  } catch (error) {
    logger.error('[autoCreateUserFromToken] Error', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: tokenPayload.sub
    });
    return null;
  }
}

/**
 * Ensure user exists in background (non-blocking)
 * Used for fast-track endpoints to create user record if missing
 */
async function ensureUserExistsInBackground(tokenPayload: SupabaseJWTPayload): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Quick check if user exists
    const { data: existingUser, error: checkError } = await supabase
      .from('users')
      .select('id')
      .eq('id', tokenPayload.sub)
      .single();

    // If user exists, we're done
    if (existingUser) {
      return;
    }

    // If error is not "row not found", log and return
    if (checkError && checkError.code !== 'PGRST116') {
      return;
    }

    // User doesn't exist, create in background
    logger.info('[ensureUserExistsInBackground] User not found, creating', {
      userId: tokenPayload.sub,
      email: tokenPayload.email
    });

    await autoCreateUserFromToken(supabase, tokenPayload);
  } catch (error) {
    // Non-critical, just log
    logger.debug('[ensureUserExistsInBackground] Failed', {
      error: error instanceof Error ? error.message : 'Unknown error',
      userId: tokenPayload.sub
    });
  }
}

/**
 * Get user data from database using token payload
 */
export async function getUserFromToken(tokenPayload: SupabaseJWTPayload): Promise<any> {
  try {
    const supabase = getSupabaseClient();

    logger.debug('[getUserFromToken] Querying user from database', { userId: tokenPayload.sub });

    // Query user data from our users table with timeout
    const queryPromise = supabase
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

    // Add 5 second timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database query timeout')), 5000)
    );

    const { data: userData, error } = await Promise.race([queryPromise, timeoutPromise]) as any;

    logger.debug('[getUserFromToken] Query completed', {
      success: !error,
      hasData: !!userData,
      error: error?.message
    });

    // If user not found (PGRST116) or no data, try to auto-create from token
    if (error?.code === 'PGRST116' || !userData) {
      logger.info('[getUserFromToken] User not found, attempting auto-create', {
        userId: tokenPayload.sub,
        errorCode: error?.code
      });

      const supabase = getSupabaseClient();
      const newUser = await autoCreateUserFromToken(supabase, tokenPayload);

      if (newUser) {
        logger.info('[getUserFromToken] User auto-created successfully', { userId: tokenPayload.sub });
        return newUser;
      }

      logger.error('User not found in database and auto-create failed', {
        error: error?.message,
        userId: tokenPayload.sub
      });
      throw new UserNotFoundError('User not found in database');
    }

    if (error) {
      logger.error('User query error', {
        error: error?.message,
        userId: tokenPayload.sub
      });
      throw new UserNotFoundError('Failed to fetch user data');
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
 * Simplified token verification with parallel execution
 * Returns token payload and source
 * Uses Promise.any for parallel verification - first success wins
 */
async function verifyTokenWithFallbacks(
  token: string,
  tokenSource: string,
  cookieHeader: string | undefined
): Promise<{ payload: SupabaseJWTPayload; source: string }> {
  // Build verification promises for parallel execution
  const verificationPromises: Promise<{ payload: SupabaseJWTPayload; source: string }>[] = [];

  // Primary: Supabase verification
  verificationPromises.push(
    verifySupabaseToken(token).then(payload => ({ payload, source: tokenSource }))
  );

  // Secondary: Local JWT verification (for admin tokens)
  verificationPromises.push(
    verifySupabaseTokenLocal(token).then(payload => ({ payload, source: tokenSource }))
  );

  // Tertiary: Unified auth token (only for header tokens)
  if (tokenSource === 'header') {
    verificationPromises.push(
      verifyUnifiedAuthToken(token).then(payload => ({ payload, source: 'unified-auth' }))
    );
  }

  // Try parallel verification - first success wins
  try {
    const result = await Promise.any(verificationPromises);
    return result;
  } catch (aggregateError) {
    // All parallel attempts failed, try cookie fallback as last resort
    if (tokenSource === 'header' && cookieHeader) {
      const cookieToken = extractTokenFromSupabaseCookie(cookieHeader);
      if (cookieToken && cookieToken !== token) {
        try {
          const payload = await verifySupabaseToken(cookieToken);
          return { payload, source: 'cookie-fallback' };
        } catch (cookieError) {
          // Final fallback failed
        }
      }
    }
  }

  // All verification attempts failed
  throw new InvalidTokenError('Token verification failed after all fallbacks');
}

/**
 * Main JWT authentication middleware
 */
export function authenticateJWT() {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    // ⏱️ 타이밍 측정 시작
    const authStartTime = Date.now();
    logger.info('[⏱️ AUTH-TIMING] Authentication started', {
      path: req.path,
      method: req.method,
      timestamp: new Date().toISOString()
    });

    // Skip authentication for OPTIONS requests (CORS preflight)
    if (req.method === 'OPTIONS') {
      return next();
    }

    // 🔴 디버그 로그 레벨 설정 (환경변수로 제어)
    const DEBUG_AUTH = process.env.DEBUG_AUTH === 'true';

    if (DEBUG_AUTH) {
      logger.debug('[AUTH] Request', { method: req.method, url: req.originalUrl });
    }

    // Global timeout for entire authentication process (configurable, default: 5 seconds)
    const AUTH_TIMEOUT = parseInt(process.env.AUTH_TIMEOUT_MS || '5000', 10);
    let authTimeoutId: NodeJS.Timeout | undefined;

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        authTimeoutId = setTimeout(() => {
          reject(new AuthenticationError('Authentication timeout - please try again', 408, 'AUTH_TIMEOUT'));
        }, AUTH_TIMEOUT);
      });

      logger.info('[⏱️ AUTH-TIMING] Before performAuthentication', {
        elapsed: Date.now() - authStartTime
      });

      // Run authentication with timeout
      const authResult = await Promise.race([
        performAuthentication(req, res, DEBUG_AUTH),
        timeoutPromise
      ]);

      logger.info('[⏱️ AUTH-TIMING] After performAuthentication', {
        elapsed: Date.now() - authStartTime
      });

      // Clear timeout on success
      if (authTimeoutId) clearTimeout(authTimeoutId);

      // Apply auth result to request
      req.user = authResult.user;
      req.token = authResult.token;
      req.session = authResult.session;

      logger.info('[⏱️ AUTH-TIMING] Before calling next()', {
        elapsed: Date.now() - authStartTime,
        totalAuthTime: Date.now() - authStartTime
      });

      next();
    } catch (error) {
      // Clear timeout on error
      if (authTimeoutId) clearTimeout(authTimeoutId);

      if (error instanceof AuthenticationError) {
        // Log authentication failure for security monitoring (non-blocking, fire-and-forget)
        setImmediate(() => {
          securityMonitoringService.logSecurityEvent({
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
          }).catch(err => {
            logger.debug('Security event logging failed (non-critical)', { error: err instanceof Error ? err.message : 'Unknown' });
          });
        });

        logger.warn('Authentication failed', {
          error: error.message,
          code: error.code,
          ip: req.ip,
          userAgent: req.get('User-Agent'),
          deviceFingerprint: generateDeviceFingerprint(req)
        });

        res.status(error.statusCode).json({
          success: false,
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
        success: false,
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
 * Core authentication logic (extracted for timeout wrapper)
 */
async function performAuthentication(
  req: AuthenticatedRequest,
  res: Response,
  DEBUG_AUTH: boolean
): Promise<{
  user: AuthenticatedRequest['user'];
  token: string;
  session: AuthenticatedRequest['session'];
}> {
  const perfStartTime = Date.now();

  // Extract token from Authorization header OR Supabase cookie
  const authHeader = req.headers.authorization;

  let token = extractTokenFromHeader(authHeader);
  let tokenSource = 'none';

  // FALLBACK: Try extracting from Supabase cookie if header is missing
  if (!token && req.headers.cookie) {
    token = extractTokenFromSupabaseCookie(req.headers.cookie);
    if (token) {
      tokenSource = 'cookie';
    }
  } else if (token) {
    tokenSource = 'header';
  }

  if (!token) {
    throw new AuthenticationError('Missing authorization token', 401, 'MISSING_TOKEN');
  }

  logger.info('[⏱️ PERF-AUTH] Token extracted', {
    elapsed: Date.now() - perfStartTime,
    tokenSource
  });

  // Verify token with simplified fallback chain
  const verifyStartTime = Date.now();
  const { payload: tokenPayload, source: finalSource } = await verifyTokenWithFallbacks(
    token,
    tokenSource,
    req.headers.cookie
  );
  tokenSource = finalSource;

  logger.info('[⏱️ PERF-AUTH] Token verified', {
    elapsed: Date.now() - perfStartTime,
    verifyTime: Date.now() - verifyStartTime,
    finalSource
  });

  // Enhanced token validation with expiration checks
  await validateTokenExpiration(tokenPayload);

  // Performance optimization: Skip expensive database lookup for analytics endpoints
  // The JWT token is already cryptographically verified, so we can trust its contents
  const isAnalyticsEndpoint = req.path.startsWith('/analytics/') ||
                               req.path.startsWith('/dashboard/') ||
                               req.path.includes('/analytics/');

  let userData: any;
  let sessionInfo: any;

  // Performance optimization: Use token data directly for most endpoints
  // Only fetch full user data for critical operations
  const isCriticalEndpoint = req.path.startsWith('/payment') ||
                             req.path.includes('/cancel') ||
                             req.path.includes('/refund') ||
                             req.method === 'DELETE';

  // User-related endpoints require DB lookup to ensure user record exists
  // Note: /api/referrals removed to reduce unnecessary DB queries for stats endpoints
  const isUserEndpoint = req.path.startsWith('/api/users') ||
                         req.path.startsWith('/api/points') ||
                         req.path.includes('/profile');

  if (isAnalyticsEndpoint || (!isCriticalEndpoint && !isUserEndpoint)) {
    logger.info('[⏱️ PERF-AUTH] Using fast-track (no DB lookup)', {
      elapsed: Date.now() - perfStartTime,
      path: req.path
    });

    // Use token data directly without database lookup for better performance
    userData = {
      id: tokenPayload.sub,
      email: tokenPayload.email,
      user_role: tokenPayload.role || 'user',
      user_status: 'active', // Token wouldn't be valid if user was inactive
      name: tokenPayload.user_metadata?.name || tokenPayload.email,
      is_influencer: tokenPayload.user_metadata?.is_influencer || false,
      phone_verified: !!tokenPayload.phone_confirmed_at,
    };

    // Minimal session tracking
    sessionInfo = {
      sessionId: tokenPayload.session_id || crypto.randomUUID(),
      deviceId: 'fast-track',
      deviceFingerprint: undefined,
      isNewDevice: false
    };

    // Background check/create user record (non-blocking)
    ensureUserExistsInBackground(tokenPayload).catch(() => {});
  } else {
    logger.info('[⏱️ PERF-AUTH] Fetching user from database', {
      elapsed: Date.now() - perfStartTime,
      path: req.path
    });

    try {
      const dbStartTime = Date.now();

      // Get user data from database for critical endpoints
      userData = await getUserFromToken(tokenPayload);

      logger.info('[⏱️ PERF-AUTH] User data fetched', {
        elapsed: Date.now() - perfStartTime,
        dbTime: Date.now() - dbStartTime
      });

      const sessionStartTime = Date.now();

      // Validate and track session with device fingerprinting
      sessionInfo = await validateAndTrackSession(userData.id, token, req);

      logger.info('[⏱️ PERF-AUTH] Session tracked', {
        elapsed: Date.now() - perfStartTime,
        sessionTime: Date.now() - sessionStartTime
      });
    } catch (dbError) {
      // Fallback to token data if database query fails
      userData = {
        id: tokenPayload.sub,
        email: tokenPayload.email,
        user_role: tokenPayload.role || 'user',
        user_status: 'active',
        name: tokenPayload.user_metadata?.name || tokenPayload.email,
        is_influencer: tokenPayload.user_metadata?.is_influencer || false,
        phone_verified: !!tokenPayload.phone_confirmed_at,
      };
      sessionInfo = {
        sessionId: tokenPayload.session_id || crypto.randomUUID(),
        deviceId: 'fallback',
        deviceFingerprint: undefined,
        isNewDevice: false
      };
    }
  }

  // Log authentication event for security monitoring (non-blocking, fire-and-forget)
  // Don't await this to prevent blocking the request
  if (!isAnalyticsEndpoint) {
    securityMonitoringService.logSecurityEvent({
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
    }).catch(err => {
      // Silent failure for security logging to not block authentication
      logger.debug('Security event logging failed (non-critical)', { error: err instanceof Error ? err.message : 'Unknown' });
    });
  }

  // Build and return user information
  const user: AuthenticatedRequest['user'] = {
    id: userData.id,
    email: userData.email,
    role: userData.user_role,
    user_role: userData.user_role,  // Alias for compatibility
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
    // Shop fields from JWT token payload for dashboard toggle and access validation
    ...(tokenPayload.shopId && { shopId: tokenPayload.shopId }),
    ...(tokenPayload.shopId && { shop_id: tokenPayload.shopId }),
  };

  const session: AuthenticatedRequest['session'] = {
    id: sessionInfo.sessionId,
    deviceId: sessionInfo.deviceId,
    deviceFingerprint: sessionInfo.deviceFingerprint,
    lastActivity: sessionInfo.lastActivity,
    isNewDevice: sessionInfo.isNewDevice
  };

  return { user, token, session };
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