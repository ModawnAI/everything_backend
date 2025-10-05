import { getSupabaseClient } from '../config/database';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import bcrypt from 'bcrypt';
import { createHash } from 'crypto';

export interface AdminSession {
  id: string;
  adminId: string;
  token: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  isActive: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface AdminAuthRequest {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
}

export interface AdminAuthResponse {
  success: boolean;
  admin: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
  };
  session: {
    token: string;
    expiresAt: string;
    refreshToken: string;
  };
  security: {
    requiresTwoFactor: boolean;
    lastLoginAt: string;
    loginLocation: string;
  };
}

export interface AdminSessionValidation {
  isValid: boolean;
  admin?: {
    id: string;
    email: string;
    role: string;
    permissions: string[];
  };
  session?: AdminSession;
  error?: string;
}

export interface IPWhitelistEntry {
  id: string;
  ipAddress: string;
  description: string;
  addedBy: string;
  isActive: boolean;
  createdAt: string;
  expiresAt?: string;
}

export class AdminAuthService {
  private supabase = getSupabaseClient();

  /**
   * Admin login with enhanced security
   */
  async adminLogin(request: AdminAuthRequest): Promise<AdminAuthResponse> {
    try {
      logger.info('🔐 [LOGIN-START] Admin login attempt', {
        email: request.email,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      });

      // Check IP whitelist (skip for localhost/Docker IPs)
      const isLocalhost = ['127.0.0.1', '::1', '::ffff:127.0.0.1', 'localhost', 'unknown'].includes(request.ipAddress)
        || request.ipAddress.startsWith('172.17.') // Docker bridge network (default)
        || request.ipAddress.startsWith('172.18.') // Docker bridge network (custom)
        || request.ipAddress.startsWith('::ffff:172.17.') // Docker IPv6 (default)
        || request.ipAddress.startsWith('::ffff:172.18.'); // Docker IPv6 (custom)

      logger.info('🌐 [IP-CHECK] IP validation', {
        ipAddress: request.ipAddress,
        isLocalhost,
        willCheckWhitelist: !isLocalhost
      });

      if (!isLocalhost) {
        logger.info('⚠️ [IP-WHITELIST] Checking IP whitelist for non-localhost IP');
        const isIPAllowed = await this.checkIPWhitelist(request.ipAddress);
        if (!isIPAllowed) {
          logger.error('❌ [IP-BLOCKED] IP not in whitelist', { ipAddress: request.ipAddress });
          throw new Error('Access denied: IP address not whitelisted for admin access');
        }
        logger.info('✅ [IP-ALLOWED] IP found in whitelist');
      } else {
        logger.info('✅ [IP-LOCALHOST] Localhost IP detected, skipping whitelist check');
      }

      // Get admin user FIRST (using service role, no RLS issues)
      logger.info('🔍 [DB-QUERY] Searching for admin user', { email: request.email });
      const { data: admin, error: adminError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', request.email)
        .eq('user_role', 'admin')
        .eq('user_status', 'active')
        .maybeSingle();

      if (adminError || !admin) {
        logger.error('❌ [USER-NOT-FOUND] Admin user not found or query error', {
          email: request.email,
          error: adminError?.message,
          errorCode: adminError?.code,
          errorDetails: adminError?.details,
          errorHint: adminError?.hint,
          adminData: admin,
          hasError: !!adminError,
          hasAdmin: !!admin
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'User not found');
        throw new Error('Invalid admin credentials');
      }

      logger.info('✅ [USER-FOUND] Admin user found', {
        userId: admin.id,
        email: admin.email,
        role: admin.user_role
      });

      // Verify password using a separate temporary client to avoid session pollution
      logger.info('🔑 [PASSWORD-CHECK] Verifying password via Supabase Auth');
      const tempAuthClient = createClient(
        config.database.supabaseUrl,
        config.database.supabaseAnonKey,  // Use anon key for auth operations
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false  // Don't persist session
          }
        }
      );

      const { data: authData, error: authError } = await tempAuthClient.auth.signInWithPassword({
        email: request.email,
        password: request.password
      });

      if (authError || !authData.user) {
        logger.error('❌ [PASSWORD-INVALID] Supabase Auth verification failed', {
          email: request.email,
          error: authError?.message
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Invalid password');
        throw new Error('Invalid admin credentials');
      }

      logger.info('✅ [PASSWORD-VALID] Password verified successfully via Supabase Auth', {
        authUserId: authData.user.id
      });

      // Check if admin account is locked
      logger.info('🔒 [LOCK-CHECK] Checking if account is locked');
      if (admin.is_locked) {
        logger.error('❌ [ACCOUNT-LOCKED] Account is locked', { userId: admin.id });
        throw new Error('Admin account is locked. Please contact system administrator.');
      }
      logger.info('✅ [LOCK-CHECK] Account is not locked');

      // Check failed login attempts
      logger.info('🔢 [ATTEMPTS-CHECK] Checking failed login attempts');
      const failedAttempts = await this.getFailedLoginAttempts(request.email);
      logger.info('📊 [ATTEMPTS-COUNT] Failed attempts count', { failedAttempts });

      if (failedAttempts >= 5) {
        logger.error('❌ [TOO-MANY-ATTEMPTS] Too many failed attempts, locking account', {
          email: request.email,
          failedAttempts
        });
        await this.lockAdminAccount(admin.id);
        throw new Error('Account locked due to multiple failed login attempts');
      }

      // Generate admin session with longer expiry
      logger.info('🎫 [SESSION-CREATE] Creating admin session');
      const session = await this.createAdminSession(admin.id, request);
      logger.info('✅ [SESSION-CREATED] Session created successfully', {
        sessionId: session.id,
        expiresAt: session.expiresAt
      });

      // Update last login
      logger.info('📝 [UPDATE-LOGIN] Updating last login timestamp');
      await this.updateLastLogin(admin.id, request.ipAddress);

      // Clear failed login attempts
      logger.info('🧹 [CLEAR-ATTEMPTS] Clearing failed login attempts');
      await this.clearFailedLoginAttempts(request.email);

      // Log successful login
      logger.info('📋 [LOG-ACTION] Logging admin action');
      await this.logAdminAction(admin.id, 'admin_login', {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        deviceId: request.deviceId
      });

      logger.info('🎉 [LOGIN-SUCCESS] Admin login completed successfully', {
        userId: admin.id,
        email: admin.email
      });

      const response: AdminAuthResponse = {
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.user_role,
          permissions: await this.getAdminPermissions(admin.id)
        },
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
          refreshToken: session.refreshToken
        },
        security: {
          requiresTwoFactor: false, // Can be extended for 2FA
          lastLoginAt: admin.last_login_at || new Date().toISOString(),
          loginLocation: await this.getLocationFromIP(request.ipAddress)
        }
      };

      logger.info('Admin login successful', { adminId: admin.id, email: admin.email });

      return response;
    } catch (error) {
      logger.error('💥 [LOGIN-FAILED] Admin login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        email: request.email,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      });
      throw error;
    }
  }

  /**
   * Validate admin session
   */
  async validateAdminSession(token: string, ipAddress: string): Promise<AdminSessionValidation> {
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;
      
      // Get session from database
      const { data: session, error: sessionError } = await this.supabase
        .from('admin_sessions')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        return { isValid: false, error: 'Invalid or expired session' };
      }

      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        await this.revokeSession(session.id, 'Session expired');
        return { isValid: false, error: 'Session expired' };
      }

      // Check IP address (optional security measure)
      if (session.ip_address !== ipAddress) {
        logger.warn('Admin session IP mismatch', {
          sessionId: session.id,
          expectedIP: session.ip_address,
          actualIP: ipAddress
        });
        // Don't immediately revoke, but log the mismatch
      }

      // Get admin user
      const { data: admin, error: adminError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', session.admin_id)
        .eq('user_role', 'admin')
        .eq('user_status', 'active')
        .single();

      if (adminError || !admin) {
        await this.revokeSession(session.id, 'Admin user not found or inactive');
        return { isValid: false, error: 'Admin user not found or inactive' };
      }

      // Update last activity
      await this.updateSessionActivity(session.id);

      return {
        isValid: true,
        admin: {
          id: admin.id,
          email: admin.email,
          role: admin.user_role,
          permissions: await this.getAdminPermissions(admin.id)
        },
        session: {
          id: session.id,
          adminId: session.admin_id,
          token: session.token,
          refreshToken: session.refresh_token,
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          deviceId: session.device_id,
          isActive: session.is_active,
          lastActivityAt: session.last_activity_at,
          expiresAt: session.expires_at,
          createdAt: session.created_at
        }
      };
    } catch (error) {
      logger.error('Admin session validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        token: token.substring(0, 20) + '...',
        ipAddress
      });
      return { isValid: false, error: 'Session validation failed' };
    }
  }

  /**
   * Create admin session with enhanced security
   */
  private async createAdminSession(adminId: string, request: AdminAuthRequest): Promise<AdminSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours for admin
    const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate tokens with proper JWT claims
    const token = jwt.sign(
      {
        sub: adminId,  // Standard JWT subject claim
        adminId,
        type: 'admin_access',
        ipAddress: request.ipAddress,
        deviceId: request.deviceId,
        aud: 'authenticated',  // Required audience claim
        iss: config.auth.issuer  // Required issuer claim
      },
      config.auth.jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      {
        sub: adminId,  // Standard JWT subject claim
        adminId,
        type: 'admin_refresh',
        sessionId: createHash('sha256').update(token).digest('hex'),
        aud: 'authenticated',  // Required audience claim
        iss: config.auth.issuer  // Required issuer claim
      },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    // Create session record
    const { data: session, error } = await this.supabase
      .from('admin_sessions')
      .insert({
        admin_id: adminId,
        token: token,
        refresh_token: refreshToken,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        device_id: request.deviceId || createHash('sha256').update(request.userAgent).digest('hex'),
        is_active: true,
        last_activity_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        refresh_expires_at: refreshExpiresAt.toISOString()
      })
      .select()
      .single();

    if (error || !session) {
      logger.error('❌ [SESSION-CREATE-ERROR] Failed to create admin session', {
        error: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code
      });
      throw new Error(`Failed to create admin session: ${error?.message || 'Unknown error'}`);
    }

    return {
      id: session.id,
      adminId: session.admin_id,
      token: session.token,
      refreshToken: session.refresh_token,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      deviceId: session.device_id,
      isActive: session.is_active,
      lastActivityAt: session.last_activity_at,
      expiresAt: session.expires_at,
      createdAt: session.created_at
    };
  }

  /**
   * Check IP whitelist
   */
  private async checkIPWhitelist(ipAddress: string): Promise<boolean> {
    try {
      const { data: whitelist, error } = await this.supabase
        .from('admin_ip_whitelist')
        .select('*')
        .eq('ip_address', ipAddress)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString())
        .single();

      if (error || !whitelist) {
        return false;
      }

      return true;
    } catch (error) {
      logger.error('Error checking IP whitelist', { error, ipAddress });
      return false;
    }
  }

  /**
   * Get admin permissions
   */
  private async getAdminPermissions(adminId: string): Promise<string[]> {
    try {
      const { data: permissions, error } = await this.supabase
        .from('admin_permissions')
        .select('permission')
        .eq('admin_id', adminId)
        .eq('is_active', true);

      if (error) {
        logger.error('Error getting admin permissions', { error, adminId });
        return [];
      }

      return permissions?.map(p => p.permission) || [];
    } catch (error) {
      logger.error('Error getting admin permissions', { error, adminId });
      return [];
    }
  }

  /**
   * Log failed login attempt
   */
  private async logFailedLoginAttempt(email: string, ipAddress: string, reason: string): Promise<void> {
    try {
      await this.supabase
        .from('admin_login_attempts')
        .insert({
          email,
          ip_address: ipAddress,
          reason,
          attempted_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging failed login attempt', { error, email, ipAddress });
    }
  }

  /**
   * Get failed login attempts count
   */
  private async getFailedLoginAttempts(email: string): Promise<number> {
    try {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      const { count, error } = await this.supabase
        .from('admin_login_attempts')
        .select('*', { count: 'exact' })
        .eq('email', email)
        .gte('attempted_at', oneHourAgo.toISOString());

      return count || 0;
    } catch (error) {
      logger.error('Error getting failed login attempts', { error, email });
      return 0;
    }
  }

  /**
   * Clear failed login attempts
   */
  private async clearFailedLoginAttempts(email: string): Promise<void> {
    try {
      await this.supabase
        .from('admin_login_attempts')
        .delete()
        .eq('email', email);
    } catch (error) {
      logger.error('Error clearing failed login attempts', { error, email });
    }
  }

  /**
   * Lock admin account
   */
  private async lockAdminAccount(adminId: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({ is_locked: true, locked_at: new Date().toISOString() })
        .eq('id', adminId);
    } catch (error) {
      logger.error('Error locking admin account', { error, adminId });
    }
  }

  /**
   * Update last login
   */
  private async updateLastLogin(adminId: string, ipAddress: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({ 
          last_login_at: new Date().toISOString(),
          last_login_ip: ipAddress
        })
        .eq('id', adminId);
    } catch (error) {
      logger.error('Error updating last login', { error, adminId });
    }
  }

  /**
   * Log admin action
   */
  private async logAdminAction(adminId: string, action: string, metadata: any): Promise<void> {
    try {
      await this.supabase
        .from('admin_actions')
        .insert({
          admin_id: adminId,
          action_type: action,
          metadata,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging admin action', { error, adminId, action });
    }
  }

  /**
   * Get location from IP (placeholder for geolocation service)
   */
  private async getLocationFromIP(ipAddress: string): Promise<string> {
    // This would integrate with a geolocation service
    // For now, return a placeholder
    return 'Unknown Location';
  }

  /**
   * Revoke session
   */
  private async revokeSession(sessionId: string, reason: string): Promise<void> {
    try {
      await this.supabase
        .from('admin_sessions')
        .update({
          is_active: false,
          revoked_at: new Date().toISOString(),
          revocation_reason: reason
        })
        .eq('id', sessionId);
    } catch (error) {
      logger.error('Error revoking session', { error, sessionId });
    }
  }

  /**
   * Update session activity
   */
  private async updateSessionActivity(sessionId: string): Promise<void> {
    try {
      await this.supabase
        .from('admin_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      logger.error('Error updating session activity', { error, sessionId });
    }
  }

  /**
   * Refresh admin session
   */
  async refreshAdminSession(refreshToken: string, ipAddress: string): Promise<AdminAuthResponse> {
    try {
      const decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as any;
      
      if (decoded.type !== 'admin_refresh') {
        throw new Error('Invalid refresh token type');
      }

      // Get session by refresh token
      const { data: session, error: sessionError } = await this.supabase
        .from('admin_sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        throw new Error('Invalid or expired refresh token');
      }

      // Check if refresh token is expired
      if (new Date(session.refresh_expires_at) < new Date()) {
        await this.revokeSession(session.id, 'Refresh token expired');
        throw new Error('Refresh token expired');
      }

      // Get admin user
      const { data: admin, error: adminError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', session.admin_id)
        .eq('user_role', 'admin')
        .eq('user_status', 'active')
        .single();

      if (adminError || !admin) {
        await this.revokeSession(session.id, 'Admin user not found or inactive');
        throw new Error('Admin user not found or inactive');
      }

      // Create new session
      const newSession = await this.createAdminSession(admin.id, {
        email: admin.email,
        password: '', // Not needed for refresh
        ipAddress,
        userAgent: session.user_agent,
        deviceId: session.device_id
      });

      // Revoke old session
      await this.revokeSession(session.id, 'Refreshed');

      return {
        success: true,
        admin: {
          id: admin.id,
          email: admin.email,
          name: admin.name,
          role: admin.user_role,
          permissions: await this.getAdminPermissions(admin.id)
        },
        session: {
          token: newSession.token,
          expiresAt: newSession.expiresAt,
          refreshToken: newSession.refreshToken
        },
        security: {
          requiresTwoFactor: false,
          lastLoginAt: admin.last_login_at || new Date().toISOString(),
          loginLocation: await this.getLocationFromIP(ipAddress)
        }
      };
    } catch (error) {
      logger.error('Admin session refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Logout admin
   */
  async logoutAdmin(token: string): Promise<void> {
    try {
      const { data: session, error } = await this.supabase
        .from('admin_sessions')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (session) {
        await this.revokeSession(session.id, 'Admin logout');
      }
    } catch (error) {
      logger.error('Error during admin logout', { error });
    }
  }
}

export const adminAuthService = new AdminAuthService(); 