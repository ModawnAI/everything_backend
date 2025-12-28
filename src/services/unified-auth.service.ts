/**
 * Unified Authentication Service
 * Orchestrates authentication logic for all user roles (admin, shop_owner, customer)
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  SessionRepository,
  LoginAttemptRepository,
  AccountSecurityRepository,
  SecurityLogRepository
} from '../repositories';
import {
  UserRole,
  LoginRequest,
  LoginResponse,
  Session,
  CreateSessionInput,
  TokenPayload,
  SessionValidation,
  ROLE_CONFIGS,
  AuthUser
} from '../types/unified-auth.types';

export class UnifiedAuthService {
  private supabase = getSupabaseClient();
  private sessionRepo: SessionRepository;
  private loginAttemptRepo: LoginAttemptRepository;
  private accountSecurityRepo: AccountSecurityRepository;
  private securityLogRepo: SecurityLogRepository;

  constructor() {
    this.sessionRepo = new SessionRepository();
    this.loginAttemptRepo = new LoginAttemptRepository();
    this.accountSecurityRepo = new AccountSecurityRepository();
    this.securityLogRepo = new SecurityLogRepository();
  }

  /**
   * Login user with role-based authentication
   */
  async login(loginData: LoginRequest): Promise<LoginResponse> {
    const { email, password, role, ip_address, user_agent, device_id, device_name } = loginData;

    try {
      // 1. Check if account is locked
      const user = await this.findUserByEmailAndRole(email, role);
      if (!user) {
        await this.recordFailedLogin(email, role, 'user_not_found', ip_address, user_agent, device_id);
        throw new Error('Invalid credentials');
      }

      const isLocked = await this.accountSecurityRepo.isAccountLocked(user.id);
      if (isLocked) {
        await this.loginAttemptRepo.recordAttempt(email, role, 'blocked', {
          userId: user.id,
          ipAddress: ip_address,
          userAgent: user_agent,
          deviceId: device_id,
          failureReason: 'account_locked'
        });

        await this.securityLogRepo.createLog({
          user_id: user.id,
          user_role: role,
          event_type: 'login_blocked',
          event_category: 'authentication',
          severity: 'warning',
          description: 'Login attempt blocked - account locked',
          ip_address,
          user_agent,
          device_id
        });

        throw new Error('Account is locked. Please try again later.');
      }

      // 2. Verify password using Supabase Auth
      const tempAuthClient = createClient(
        config.database.supabaseUrl,
        config.database.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { data: authData, error: authError } = await tempAuthClient.auth.signInWithPassword({
        email,
        password
      });

      if (authError || !authData?.user) {
        await this.handleFailedLogin(user.id, email, role, ip_address, user_agent, device_id);
        throw new Error('Invalid credentials');
      }

      // 3. Role-specific validations
      await this.validateRoleRequirements(user, role);

      // 4. Check if password change is required
      const security = await this.accountSecurityRepo.getOrCreate(user.id, role);
      if (security.require_password_change) {
        return {
          success: false,
          security,
          message: 'Password change required'
        } as LoginResponse;
      }

      // 5. Generate temporary session ID for token generation
      const tempSessionId = `temp-${user.id}-${Date.now()}`;

      // 6. Generate tokens with temporary session ID
      const accessToken = this.generateAccessToken(user.id, role, tempSessionId, user.shop_id);
      const refreshToken = this.generateRefreshToken(user.id, role, tempSessionId);

      // 7. Create session with real tokens
      const sessionInput: CreateSessionInput = {
        user_id: user.id,
        user_role: role,
        shop_id: user.shop_id,
        ip_address,
        user_agent,
        device_id,
        device_name
      };

      const session = await this.sessionRepo.createSession(sessionInput, accessToken, refreshToken);

      // 7. Reset failed attempts and update last login
      await this.accountSecurityRepo.resetFailedAttempts(user.id);

      // 8. Record successful login
      await this.loginAttemptRepo.recordAttempt(email, role, 'success', {
        userId: user.id,
        ipAddress: ip_address,
        userAgent: user_agent,
        deviceId: device_id,
        sessionId: session.id
      });

      await this.securityLogRepo.createLog({
        user_id: user.id,
        user_role: role,
        event_type: 'login_success',
        event_category: 'authentication',
        severity: 'info',
        description: 'User logged in successfully',
        ip_address,
        user_agent,
        device_id,
        session_id: session.id
      });

      logger.info('User logged in successfully', {
        userId: user.id,
        role,
        email
      });

      return {
        success: true,
        token: accessToken,
        refresh_token: refreshToken,
        session,
        user
      } as LoginResponse;
    } catch (error) {
      logger.error('Login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        role
      });
      throw error;
    }
  }

  /**
   * Logout user and revoke session
   */
  async logout(
    token: string,
    revokedBy?: string,
    reason?: string
  ): Promise<void> {
    try {
      const session = await this.sessionRepo.findByToken(token);
      if (!session) {
        throw new Error('Session not found');
      }

      await this.sessionRepo.revokeSession(session.id, revokedBy, reason);

      await this.securityLogRepo.createLog({
        user_id: session.user_id,
        user_role: session.user_role,
        event_type: 'logout',
        event_category: 'session',
        severity: 'info',
        description: 'User logged out',
        session_id: session.id,
        metadata: { reason }
      });

      logger.info('User logged out', {
        userId: session.user_id,
        sessionId: session.id
      });
    } catch (error) {
      logger.error('Logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Logout from all devices
   */
  async logoutAll(
    userId: string,
    role: UserRole,
    revokedBy?: string,
    reason?: string
  ): Promise<number> {
    try {
      const count = await this.sessionRepo.revokeAllUserSessions(userId, role, revokedBy, reason);

      await this.securityLogRepo.createLog({
        user_id: userId,
        user_role: role,
        event_type: 'logout_all_devices',
        event_category: 'session',
        severity: 'info',
        description: `User logged out from ${count} devices`,
        metadata: { count, reason }
      });

      logger.info('User logged out from all devices', {
        userId,
        role,
        count
      });

      return count;
    } catch (error) {
      logger.error('Logout all failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<{
    accessToken: string;
    expiresIn: number;
  }> {
    try {
      // 1. Verify refresh token
      const payload = jwt.verify(refreshToken, config.auth.jwtSecret) as TokenPayload;

      // 2. Find session by refresh token
      const session = await this.sessionRepo.findByRefreshToken(refreshToken);
      if (!session || !session.is_active) {
        throw new Error('Invalid or expired refresh token');
      }

      // 3. Validate session
      const isValid = await this.sessionRepo.isSessionValid(session.id);
      if (!isValid) {
        throw new Error('Session invalid or expired');
      }

      // 4. Generate new access token
      const accessToken = this.generateAccessToken(
        payload.userId,
        payload.role,
        session.id,
        payload.shopId
      );

      // 5. Update session token and last activity
      await this.sessionRepo.updateLastActivity(session.id);
      // Note: In production, you might want to update the token field in sessions table

      await this.securityLogRepo.createLog({
        user_id: payload.userId,
        user_role: payload.role,
        event_type: 'token_refresh',
        event_category: 'session',
        severity: 'info',
        description: 'Access token refreshed',
        session_id: session.id
      });

      logger.info('Token refreshed', {
        userId: payload.userId,
        sessionId: session.id
      });

      return {
        accessToken,
        expiresIn: ROLE_CONFIGS[payload.role].sessionDuration * 3600
      };
    } catch (error) {
      logger.error('Token refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw new Error('Invalid or expired refresh token');
    }
  }

  /**
   * Validate session and return session data
   */
  async validateSession(token: string): Promise<SessionValidation> {
    try {
      // 1. Verify JWT token
      const payload = jwt.verify(token, config.auth.jwtSecret) as TokenPayload;

      // 2. Find session by token
      const session = await this.sessionRepo.findByToken(token);
      if (!session) {
        return {
          valid: false,
          error: 'session_not_found'
        };
      }

      // 3. Validate session
      const isValid = await this.sessionRepo.isSessionValid(session.id);
      if (!isValid) {
        return {
          valid: false,
          error: 'session_expired'
        };
      }

      // 4. Check account lock status
      const isLocked = await this.accountSecurityRepo.isAccountLocked(session.user_id);
      if (isLocked) {
        return {
          valid: false,
          error: 'account_locked'
        };
      }

      // 5. Update last activity
      await this.sessionRepo.updateLastActivity(session.id);

      // 6. Get user info
      const user = await this.findUserById(session.user_id);

      return {
        valid: true,
        session,
        user
      };
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        return {
          valid: false,
          error: 'token_expired'
        };
      }

      if (error instanceof jwt.JsonWebTokenError) {
        return {
          valid: false,
          error: 'invalid_token'
        };
      }

      logger.error('Session validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      return {
        valid: false,
        error: 'validation_error'
      };
    }
  }

  /**
   * Get user's active sessions
   */
  async getUserSessions(userId: string, role: UserRole): Promise<Session[]> {
    try {
      return await this.sessionRepo.findByUserId(userId, role);
    } catch (error) {
      logger.error('Failed to get user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Change user password
   */
  async changePassword(
    userId: string,
    role: UserRole,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    try {
      // 1. Get user
      const user = await this.findUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // 2. Verify current password using Supabase Auth
      const tempAuthClient = createClient(
        config.database.supabaseUrl,
        config.database.supabaseAnonKey,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      );

      const { error: verifyError } = await tempAuthClient.auth.signInWithPassword({
        email: user.email,
        password: currentPassword
      });

      if (verifyError) {
        throw new Error('Current password is incorrect');
      }

      // 3. Update password using Supabase Auth Admin API
      await this.updateUserPassword(userId, role, newPassword);

      // 5. Update account security
      await this.accountSecurityRepo.updateSecurity(userId, {
        user_id: userId,
        password_changed_at: new Date(),
        require_password_change: false
      });

      // 6. Revoke all sessions to force re-login
      await this.sessionRepo.revokeAllUserSessions(
        userId,
        role,
        userId,
        'password_changed'
      );

      await this.securityLogRepo.createLog({
        user_id: userId,
        user_role: role,
        event_type: 'password_change',
        event_category: 'account',
        severity: 'info',
        description: 'User changed password'
      });

      logger.info('Password changed successfully', { userId, role });
    } catch (error) {
      logger.error('Password change failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Get login statistics for user
   */
  async getLoginStatistics(userId: string, role: UserRole) {
    try {
      return await this.loginAttemptRepo.getLoginStatistics(userId, role);
    } catch (error) {
      logger.error('Failed to get login statistics', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  /**
   * Get security logs for user
   */
  async getSecurityLogs(
    userId: string,
    role: UserRole,
    limit: number = 50
  ) {
    try {
      return await this.securityLogRepo.getLogsByUser(userId, role, limit);
    } catch (error) {
      logger.error('Failed to get security logs', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  /**
   * Generate JWT access token
   */
  private generateAccessToken(userId: string, role: UserRole, sessionId: string, shopId?: string): string {
    const payload: TokenPayload = {
      sub: userId,      // JWT standard: subject = user ID
      userId,
      role,
      sessionId,
      shopId,
      type: 'access'
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: `${ROLE_CONFIGS[role].sessionDuration}h`
    });
  }

  /**
   * Generate JWT refresh token
   */
  private generateRefreshToken(userId: string, role: UserRole, sessionId: string): string {
    const payload: TokenPayload = {
      sub: userId,      // JWT standard: subject = user ID
      userId,
      role,
      sessionId,
      type: 'refresh'
    };

    return jwt.sign(payload, config.auth.jwtSecret, {
      expiresIn: `${ROLE_CONFIGS[role].refreshTokenDuration}d`
    });
  }

  /**
   * Handle failed login attempt
   */
  private async handleFailedLogin(
    userId: string,
    email: string,
    role: UserRole,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string
  ): Promise<void> {
    // Increment failed attempts
    const security = await this.accountSecurityRepo.incrementFailedAttempts(userId);

    // Record failed attempt
    await this.loginAttemptRepo.recordAttempt(email, role, 'failure', {
      userId,
      ipAddress,
      userAgent,
      deviceId,
      failureReason: 'invalid_password'
    });

    // Log security event
    const description = security.is_locked
      ? `Login failed - account locked after ${security.failed_login_attempts} attempts`
      : `Login failed - ${security.failed_login_attempts} failed attempts`;

    await this.securityLogRepo.createLog({
      user_id: userId,
      user_role: role,
      event_type: security.is_locked ? 'account_locked' : 'login_failed',
      event_category: 'authentication',
      severity: security.is_locked ? 'warning' : 'info',
      description,
      ip_address: ipAddress,
      user_agent: userAgent,
      device_id: deviceId
    });
  }

  /**
   * Record failed login when user not found
   */
  private async recordFailedLogin(
    email: string,
    role: UserRole,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
    deviceId?: string
  ): Promise<void> {
    await this.loginAttemptRepo.recordAttempt(email, role, 'failure', {
      ipAddress,
      userAgent,
      deviceId,
      failureReason: reason
    });
  }

  /**
   * Validate role-specific requirements
   */
  private async validateRoleRequirements(user: AuthUser, role: UserRole): Promise<void> {
    const roleConfig = ROLE_CONFIGS[role];

    // Check IP whitelist for admin
    if (roleConfig.requireIPWhitelist && role === 'admin') {
      // TODO: Implement IP whitelist check
      // For now, we'll skip this validation
    }

    // Check shop association for shop_owner
    if (roleConfig.requireShopAssociation && !user.shop_id) {
      throw new Error('Shop association required for shop owner');
    }
  }

  /**
   * Find user by email and role
   */
  private async findUserByEmailAndRole(email: string, role: UserRole): Promise<AuthUser | null> {
    try {
      // Map UserRole to database user_role values
      const dbRole = role === 'customer' ? 'user' : role;

      const { data, error } = await this.supabase
        .from('users')
        .select('id, email, name, user_role, shop_id, shop_name')
        .eq('email', email)
        .eq('user_role', dbRole)
        .eq('user_status', 'active')
        .maybeSingle();

      if (error) {
        logger.error('Error finding user by email and role', {
          error: error.message,
          email,
          role
        });
        return null;
      }

      if (!data) {
        return null;
      }

      // Get password hash from Supabase Auth
      // Note: In Supabase, password hashes are stored in auth.users, not public.users
      // We need to use Supabase Auth to verify passwords
      return {
        id: data.id,
        email: data.email,
        full_name: data.name, // Map database 'name' to 'full_name'
        role: role, // Return the requested role format
        shop_id: data.shop_id,
        shop_name: data.shop_name, // Include shop_name for shop_owners
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      logger.error('Error in findUserByEmailAndRole', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email,
        role
      });
      return null;
    }
  }

  /**
   * Find user by ID
   */
  private async findUserById(userId: string): Promise<AuthUser | null> {
    try {
      const { data, error } = await this.supabase
        .from('users')
        .select('id, email, name, user_role, shop_id, shop_name')
        .eq('id', userId)
        .eq('user_status', 'active')
        .single();

      if (error || !data) {
        logger.error('Error finding user by ID', {
          error: error?.message,
          userId
        });
        return null;
      }

      return {
        id: data.id,
        email: data.email,
        full_name: data.name, // Map database 'name' to 'full_name'
        role: data.user_role === 'user' ? 'customer' : (data.user_role as UserRole),
        shop_id: data.shop_id,
        shop_name: data.shop_name, // Include shop_name for shop_owners
        is_active: true,
        email_verified: false,
        created_at: new Date(),
        updated_at: new Date()
      };
    } catch (error) {
      logger.error('Error in findUserById', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId
      });
      return null;
    }
  }

  /**
   * Update user password using Supabase Auth
   */
  private async updateUserPassword(userId: string, role: UserRole, newPassword: string): Promise<void> {
    try {
      // Use Supabase Auth Admin API to update password
      const { error } = await this.supabase.auth.admin.updateUserById(userId, {
        password: newPassword
      });

      if (error) {
        logger.error('Error updating user password', {
          error: error.message,
          userId,
          role
        });
        throw new Error('Failed to update password');
      }

      logger.info('Password updated successfully', { userId, role });
    } catch (error) {
      logger.error('Error in updateUserPassword', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        role
      });
      throw error;
    }
  }
}
