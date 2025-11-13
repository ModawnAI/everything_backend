import { getSupabaseClient } from '../config/database';
import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';
import jwt from 'jsonwebtoken';
import { config } from '../config/environment';
import { createHash } from 'crypto';

export interface ShopOwnerSession {
  id: string;
  shopOwnerId: string;
  shopId: string;
  token: string;
  refreshToken: string;
  ipAddress: string;
  userAgent: string;
  deviceId: string;
  deviceName?: string;
  isActive: boolean;
  lastActivityAt: string;
  expiresAt: string;
  createdAt: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface ShopOwnerAuthRequest {
  email: string;
  password: string;
  ipAddress: string;
  userAgent: string;
  deviceId?: string;
  deviceName?: string;
}

export interface ShopOwnerAuthResponse {
  success: boolean;
  shopOwner: {
    id: string;
    email: string;
    name: string;
    role: string;
    permissions: string[];
    shop: {
      id: string;
      name: string;
      status: string;
      mainCategory: string;
      address: string;
      phoneNumber?: string;
    };
  };
  session: {
    token: string;
    expiresAt: string;
    refreshToken: string;
  };
  security: {
    lastLoginAt: string;
    loginLocation: string;
  };
}

export interface ShopOwnerSessionValidation {
  isValid: boolean;
  shopOwner?: {
    id: string;
    email: string;
    role: string;
    shopId: string;
  };
  session?: ShopOwnerSession;
  error?: string;
}

export class ShopOwnerAuthService {
  private supabase = getSupabaseClient();

  /**
   * Shop owner login with email and password
   */
  async shopOwnerLogin(request: ShopOwnerAuthRequest): Promise<ShopOwnerAuthResponse> {
    try {
      logger.info('🔐 [SHOP-OWNER-LOGIN] Shop owner login attempt', {
        email: request.email,
        ipAddress: request.ipAddress,
        userAgent: request.userAgent
      });

      // Get shop owner user FIRST
      logger.info('🔍 [DB-QUERY] Searching for shop owner user', { email: request.email });
      const { data: shopOwner, error: shopOwnerError } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', request.email)
        .eq('user_role', 'shop_owner')
        .eq('user_status', 'active')
        .maybeSingle();

      if (shopOwnerError || !shopOwner) {
        logger.error('❌ [USER-NOT-FOUND] Shop owner user not found or query error', {
          email: request.email,
          error: shopOwnerError?.message
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'User not found', 'invalid_credentials');
        throw new Error('Invalid shop owner credentials');
      }

      logger.info('✅ [USER-FOUND] Shop owner user found', {
        userId: shopOwner.id,
        email: shopOwner.email,
        role: shopOwner.user_role
      });

      // Verify password using Supabase Auth
      logger.info('🔑 [PASSWORD-CHECK] Verifying password via Supabase Auth');

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

      let authData: any = null;
      let authError: any = null;
      let retries = 3;

      // Retry with exponential backoff to handle rate limiting
      for (let attempt = 1; attempt <= retries; attempt++) {
        logger.info(`🔐 [AUTH-ATTEMPT-${attempt}] Attempting Supabase auth`, {
          email: request.email
        });

        const result = await tempAuthClient.auth.signInWithPassword({
          email: request.email,
          password: request.password
        });

        authData = result.data;
        authError = result.error;

        if (!authError && authData?.user) {
          break; // Success
        }

        if (authError?.code === 'invalid_credentials') {
          break; // Don't retry on invalid credentials
        }

        if (attempt < retries) {
          const delay = Math.pow(2, attempt) * 100;
          logger.warn(`⏳ [PASSWORD-RETRY] Auth attempt ${attempt} failed, retrying in ${delay}ms`, {
            error: authError?.message
          });
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }

      if (authError || !authData?.user) {
        logger.error('❌ [PASSWORD-INVALID] Supabase Auth verification failed', {
          email: request.email,
          errorMessage: authError?.message,
          errorCode: authError?.code
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Invalid password', 'invalid_credentials');
        throw new Error('Invalid shop owner credentials');
      }

      logger.info('✅ [PASSWORD-VALID] Password verified successfully', {
        authUserId: authData.user.id
      });

      // Check account security status
      logger.info('🔒 [SECURITY-CHECK] Checking account security status');
      const securityStatus = await this.checkAccountSecurity(shopOwner.id);

      if (securityStatus.isLocked) {
        logger.error('❌ [ACCOUNT-LOCKED] Account is locked', {
          userId: shopOwner.id,
          lockedUntil: securityStatus.lockedUntil
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Account locked', 'account_locked');
        throw new Error('Account is locked. Please contact support.');
      }

      if (securityStatus.failedAttempts >= 5) {
        logger.error('❌ [TOO-MANY-ATTEMPTS] Too many failed attempts', {
          email: request.email,
          failedAttempts: securityStatus.failedAttempts
        });
        await this.lockShopOwnerAccount(shopOwner.id, 'Too many failed login attempts');
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Too many failed attempts', 'account_locked');
        throw new Error('Account locked due to multiple failed login attempts');
      }

      // Get shop information (prefer verified shops, then order by creation date)
      logger.info('🏪 [SHOP-QUERY] Getting shop information for owner');
      const { data: shops, error: shopError } = await this.supabase
        .from('shops')
        .select('*')
        .eq('owner_id', shopOwner.id)
        .eq('shop_status', 'active')
        .order('verification_status', { ascending: false }) // verified first
        .order('created_at', { ascending: true })
        .limit(1);

      if (shopError || !shops || shops.length === 0) {
        logger.error('❌ [SHOP-NOT-FOUND] No active shop found for this owner', {
          ownerId: shopOwner.id,
          error: shopError?.message
        });
        await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Shop not found', 'shop_not_found');
        throw new Error('No active shop associated with this account');
      }

      const shop = shops[0];

      logger.info('✅ [SHOP-FOUND] Shop found for owner', {
        shopId: shop.id,
        shopName: shop.name,
        shopStatus: shop.shop_status
      });

      // Generate shop owner session
      logger.info('🎫 [SESSION-CREATE] Creating shop owner session');
      const session = await this.createShopOwnerSession(shopOwner.id, shop.id, request);
      logger.info('✅ [SESSION-CREATED] Session created successfully', {
        sessionId: session.id,
        expiresAt: session.expiresAt
      });

      // Update last login
      logger.info('📝 [UPDATE-LOGIN] Updating last login timestamp');
      await this.updateLastLogin(shopOwner.id, request.ipAddress);

      // Reset failed login attempts on successful login
      logger.info('🧹 [CLEAR-ATTEMPTS] Resetting failed login attempts');
      await this.resetFailedLoginAttempts(shopOwner.id);

      // Log successful login
      logger.info('📋 [LOG-SECURITY] Logging security event');
      await this.logSecurityEvent(shopOwner.id, 'login_success', {
        ipAddress: request.ipAddress,
        userAgent: request.userAgent,
        deviceId: request.deviceId,
        deviceName: request.deviceName
      }, 'info');

      // Log successful login attempt
      await this.logFailedLoginAttempt(request.email, request.ipAddress, 'Success', 'success');

      logger.info('🎉 [LOGIN-SUCCESS] Shop owner login completed successfully', {
        userId: shopOwner.id,
        email: shopOwner.email,
        shopId: shop.id
      });

      const response: ShopOwnerAuthResponse = {
        success: true,
        shopOwner: {
          id: shopOwner.id,
          email: shopOwner.email,
          name: shopOwner.name,
          role: shopOwner.user_role,
          permissions: [
            'shop.dashboard.view',
            'shop.analytics.view',
            'shop.operations.manage',
            'shop.feed.manage',
            'shop.financial.view',
            'shop.settings.manage'
          ],
          shop: {
            id: shop.id,
            name: shop.name,
            status: shop.shop_status,
            mainCategory: shop.main_category,
            address: shop.address,
            phoneNumber: shop.phone_number
          }
        },
        session: {
          token: session.token,
          expiresAt: session.expiresAt,
          refreshToken: session.refreshToken
        },
        security: {
          lastLoginAt: shopOwner.last_login_at || new Date().toISOString(),
          loginLocation: await this.getLocationFromIP(request.ipAddress)
        }
      };

      return response;
    } catch (error) {
      logger.error('💥 [LOGIN-FAILED] Shop owner login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        email: request.email,
        ipAddress: request.ipAddress
      });
      throw error;
    }
  }

  /**
   * Validate shop owner session
   */
  async validateShopOwnerSession(token: string, ipAddress: string): Promise<ShopOwnerSessionValidation> {
    try {
      // Try to verify as Supabase token first
      const { data: { user: supabaseUser }, error: supabaseError } = await this.supabase.auth.getUser(token);

      if (!supabaseError && supabaseUser) {
        logger.info('✅ Token verified as Supabase token', { userId: supabaseUser.id });

        // Get shop owner user from database
        const { data: shopOwner, error: shopOwnerError } = await this.supabase
          .from('users')
          .select('id, email, user_role, user_status, created_at')
          .eq('id', supabaseUser.id)
          .eq('user_role', 'shop_owner')
          .eq('user_status', 'active')
          .single();

        if (shopOwnerError || !shopOwner) {
          logger.error('Supabase token verification failed', {
            error: shopOwnerError?.message || 'Shop owner not found',
            userId: supabaseUser.id
          });
          return { isValid: false, error: 'Shop owner user not found or inactive' };
        }

        // Get shop ID for the shop owner
        const { data: shop } = await this.supabase
          .from('shops')
          .select('id')
          .eq('owner_id', shopOwner.id)
          .eq('shop_status', 'active')
          .single();

        if (!shop) {
          return { isValid: false, error: 'No active shop found for this owner' };
        }

        return {
          isValid: true,
          shopOwner: {
            id: shopOwner.id,
            email: shopOwner.email,
            role: shopOwner.user_role,
            shopId: shop.id
          },
          session: {
            id: supabaseUser.id,
            shopOwnerId: shopOwner.id,
            shopId: shop.id,
            token: token,
            refreshToken: '',
            ipAddress: ipAddress,
            userAgent: '',
            deviceId: '',
            isActive: true,
            lastActivityAt: new Date().toISOString(),
            expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            createdAt: shopOwner.created_at || new Date().toISOString()
          }
        };
      }

      // If Supabase verification failed, try local JWT verification
      logger.debug('Supabase token verification failed, attempting local JWT verification');

      const decoded = jwt.verify(token, config.auth.jwtSecret) as any;

      // Get session from database
      const { data: session, error: sessionError } = await this.supabase
        .from('shop_owner_sessions')
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

      // Get shop owner user
      const { data: shopOwner, error: shopOwnerError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', session.shop_owner_id)
        .eq('user_role', 'shop_owner')
        .eq('user_status', 'active')
        .single();

      if (shopOwnerError || !shopOwner) {
        await this.revokeSession(session.id, 'Shop owner user not found or inactive');
        return { isValid: false, error: 'Shop owner user not found or inactive' };
      }

      // Update last activity
      await this.updateSessionActivity(session.id);

      return {
        isValid: true,
        shopOwner: {
          id: shopOwner.id,
          email: shopOwner.email,
          role: shopOwner.user_role,
          shopId: session.shop_id
        },
        session: {
          id: session.id,
          shopOwnerId: session.shop_owner_id,
          shopId: session.shop_id,
          token: session.token,
          refreshToken: session.refresh_token,
          ipAddress: session.ip_address,
          userAgent: session.user_agent,
          deviceId: session.device_id,
          deviceName: session.device_name,
          isActive: session.is_active,
          lastActivityAt: session.last_activity_at,
          expiresAt: session.expires_at,
          createdAt: session.created_at
        }
      };
    } catch (error) {
      logger.error('Shop owner session validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress
      });
      return { isValid: false, error: 'Session validation failed' };
    }
  }

  /**
   * Create shop owner session
   */
  private async createShopOwnerSession(
    shopOwnerId: string,
    shopId: string,
    request: ShopOwnerAuthRequest
  ): Promise<ShopOwnerSession> {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 hours
    const refreshExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days

    // Generate tokens
    const token = jwt.sign(
      {
        sub: shopOwnerId,
        shopOwnerId,
        shopId,
        role: 'shop_owner',
        type: 'shop_owner_access',
        ipAddress: request.ipAddress,
        deviceId: request.deviceId,
        aud: 'authenticated',
        iss: config.auth.issuer
      },
      config.auth.jwtSecret,
      { expiresIn: '24h' }
    );

    const refreshToken = jwt.sign(
      {
        sub: shopOwnerId,
        shopOwnerId,
        shopId,
        type: 'shop_owner_refresh',
        sessionId: createHash('sha256').update(token).digest('hex'),
        aud: 'authenticated',
        iss: config.auth.issuer
      },
      config.auth.jwtSecret,
      { expiresIn: '7d' }
    );

    // Create session record
    const { data: session, error } = await this.supabase
      .from('shop_owner_sessions')
      .insert({
        shop_owner_id: shopOwnerId,
        shop_id: shopId,
        token: token,
        refresh_token: refreshToken,
        ip_address: request.ipAddress,
        user_agent: request.userAgent,
        device_id: request.deviceId || createHash('sha256').update(request.userAgent).digest('hex'),
        device_name: request.deviceName,
        is_active: true,
        last_activity_at: now.toISOString(),
        expires_at: expiresAt.toISOString()
      })
      .select()
      .single();

    if (error || !session) {
      logger.error('❌ [SESSION-CREATE-ERROR] Failed to create shop owner session', {
        error: error?.message,
        details: error?.details
      });
      throw new Error(`Failed to create shop owner session: ${error?.message || 'Unknown error'}`);
    }

    return {
      id: session.id,
      shopOwnerId: session.shop_owner_id,
      shopId: session.shop_id,
      token: session.token,
      refreshToken: session.refresh_token,
      ipAddress: session.ip_address,
      userAgent: session.user_agent,
      deviceId: session.device_id,
      deviceName: session.device_name,
      isActive: session.is_active,
      lastActivityAt: session.last_activity_at,
      expiresAt: session.expires_at,
      createdAt: session.created_at
    };
  }

  /**
   * Check account security status
   */
  private async checkAccountSecurity(shopOwnerId: string): Promise<{
    isLocked: boolean;
    lockedUntil?: string;
    failedAttempts: number;
  }> {
    try {
      const { data: security } = await this.supabase
        .from('shop_owner_account_security')
        .select('*')
        .eq('shop_owner_id', shopOwnerId)
        .single();

      if (!security) {
        // Create security record if it doesn't exist
        await this.supabase
          .from('shop_owner_account_security')
          .insert({
            shop_owner_id: shopOwnerId,
            failed_login_attempts: 0
          });

        return { isLocked: false, failedAttempts: 0 };
      }

      // Check if account is locked
      const isLocked = security.account_locked_at !== null &&
                      (security.account_locked_until === null ||
                       new Date(security.account_locked_until) > new Date());

      return {
        isLocked,
        lockedUntil: security.account_locked_until,
        failedAttempts: security.failed_login_attempts || 0
      };
    } catch (error) {
      logger.error('Error checking account security', { error, shopOwnerId });
      return { isLocked: false, failedAttempts: 0 };
    }
  }

  /**
   * Lock shop owner account
   */
  private async lockShopOwnerAccount(shopOwnerId: string, reason: string): Promise<void> {
    try {
      const lockedUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

      await this.supabase
        .from('shop_owner_account_security')
        .update({
          account_locked_at: new Date().toISOString(),
          account_locked_until: lockedUntil.toISOString(),
          locked_by: 'system',
          lock_reason: reason,
          updated_at: new Date().toISOString()
        })
        .eq('shop_owner_id', shopOwnerId);

      await this.logSecurityEvent(shopOwnerId, 'account_locked', { reason }, 'warning');
    } catch (error) {
      logger.error('Error locking shop owner account', { error, shopOwnerId });
    }
  }

  /**
   * Reset failed login attempts
   */
  private async resetFailedLoginAttempts(shopOwnerId: string): Promise<void> {
    try {
      await this.supabase
        .from('shop_owner_account_security')
        .update({
          failed_login_attempts: 0,
          last_failed_login_at: null,
          updated_at: new Date().toISOString()
        })
        .eq('shop_owner_id', shopOwnerId);
    } catch (error) {
      logger.error('Error resetting failed login attempts', { error, shopOwnerId });
    }
  }

  /**
   * Log failed login attempt
   */
  private async logFailedLoginAttempt(
    email: string,
    ipAddress: string,
    reason: string,
    attemptResult: string
  ): Promise<void> {
    try {
      await this.supabase
        .from('shop_owner_login_attempts')
        .insert({
          email,
          ip_address: ipAddress,
          attempt_result: attemptResult,
          failure_reason: reason,
          attempted_at: new Date().toISOString()
        });

      // Increment failed attempts count if not successful
      if (attemptResult !== 'success') {
        const { data: user } = await this.supabase
          .from('users')
          .select('id')
          .eq('email', email)
          .eq('user_role', 'shop_owner')
          .single();

        if (user) {
          await this.supabase
            .from('shop_owner_account_security')
            .update({
              failed_login_attempts: await this.supabase
                .from('shop_owner_account_security')
                .select('failed_login_attempts')
                .eq('shop_owner_id', user.id)
                .single()
                .then(({ data }) => (data?.failed_login_attempts || 0) + 1),
              last_failed_login_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('shop_owner_id', user.id);
        }
      }
    } catch (error) {
      logger.error('Error logging failed login attempt', { error, email, ipAddress });
    }
  }

  /**
   * Log security event
   */
  private async logSecurityEvent(
    shopOwnerId: string,
    eventType: string,
    eventDetails: any,
    severity: string = 'info'
  ): Promise<void> {
    try {
      await this.supabase
        .from('shop_owner_security_logs')
        .insert({
          shop_owner_id: shopOwnerId,
          event_type: eventType,
          event_details: eventDetails,
          ip_address: eventDetails.ipAddress,
          user_agent: eventDetails.userAgent,
          device_id: eventDetails.deviceId,
          severity,
          created_at: new Date().toISOString()
        });
    } catch (error) {
      logger.error('Error logging security event', { error, shopOwnerId, eventType });
    }
  }

  /**
   * Update last login
   */
  private async updateLastLogin(shopOwnerId: string, ipAddress: string): Promise<void> {
    try {
      await this.supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          last_login_ip: ipAddress
        })
        .eq('id', shopOwnerId);
    } catch (error) {
      logger.error('Error updating last login', { error, shopOwnerId });
    }
  }

  /**
   * Get location from IP (placeholder)
   */
  private async getLocationFromIP(ipAddress: string): Promise<string> {
    // Placeholder for geolocation service integration
    return 'Unknown Location';
  }

  /**
   * Revoke session
   */
  private async revokeSession(sessionId: string, reason: string): Promise<void> {
    try {
      await this.supabase
        .from('shop_owner_sessions')
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
        .from('shop_owner_sessions')
        .update({ last_activity_at: new Date().toISOString() })
        .eq('id', sessionId);
    } catch (error) {
      logger.error('Error updating session activity', { error, sessionId });
    }
  }

  /**
   * Refresh shop owner session
   */
  async refreshShopOwnerSession(refreshToken: string, ipAddress: string): Promise<ShopOwnerAuthResponse> {
    try {
      logger.info('🔄 [REFRESH-SERVICE] Starting shop owner session refresh', {
        ipAddress,
        refreshTokenPrefix: refreshToken.substring(0, 20) + '...'
      });

      const decoded = jwt.verify(refreshToken, config.auth.jwtSecret) as any;
      logger.info('🔑 [REFRESH-SERVICE] Token decoded successfully', {
        type: decoded.type,
        shopOwnerId: decoded.shopOwnerId,
        shopId: decoded.shopId
      });

      if (decoded.type !== 'shop_owner_refresh') {
        logger.error('❌ [REFRESH-SERVICE] Invalid token type', {
          expected: 'shop_owner_refresh',
          actual: decoded.type
        });
        throw new Error('Invalid refresh token type');
      }

      // Get session by refresh token
      logger.info('🔍 [REFRESH-SERVICE] Looking up session by refresh token');
      const { data: session, error: sessionError } = await this.supabase
        .from('shop_owner_sessions')
        .select('*')
        .eq('refresh_token', refreshToken)
        .eq('is_active', true)
        .single();

      if (sessionError || !session) {
        logger.error('❌ [REFRESH-SERVICE] Session not found or inactive', {
          error: sessionError?.message,
          hasSession: !!session,
          shopOwnerId: decoded.shopOwnerId
        });
        throw new Error('Invalid or expired refresh token');
      }

      logger.info('✅ [REFRESH-SERVICE] Session found', {
        sessionId: session.id,
        shopOwnerId: session.shop_owner_id,
        shopId: session.shop_id,
        createdAt: session.created_at
      });

      // Get shop owner user
      const { data: shopOwner, error: shopOwnerError } = await this.supabase
        .from('users')
        .select('*')
        .eq('id', session.shop_owner_id)
        .eq('user_role', 'shop_owner')
        .eq('user_status', 'active')
        .single();

      if (shopOwnerError || !shopOwner) {
        await this.revokeSession(session.id, 'Shop owner user not found or inactive');
        throw new Error('Shop owner user not found or inactive');
      }

      // Get shop information
      const { data: shop, error: shopError } = await this.supabase
        .from('shops')
        .select('*')
        .eq('id', session.shop_id)
        .eq('shop_status', 'active')
        .single();

      if (shopError || !shop) {
        throw new Error('Shop not found or inactive');
      }

      // Create new session
      const newSession = await this.createShopOwnerSession(
        shopOwner.id,
        shop.id,
        {
          email: shopOwner.email,
          password: '', // Not needed for refresh
          ipAddress,
          userAgent: session.user_agent,
          deviceId: session.device_id,
          deviceName: session.device_name
        }
      );

      // Revoke old session
      await this.revokeSession(session.id, 'Refreshed');

      return {
        success: true,
        shopOwner: {
          id: shopOwner.id,
          email: shopOwner.email,
          name: shopOwner.name,
          role: shopOwner.user_role,
          permissions: this.getShopOwnerPermissions(),
          shop: {
            id: shop.id,
            name: shop.name,
            status: shop.shop_status,
            mainCategory: shop.main_category,
            address: shop.address,
            phoneNumber: shop.phone_number
          }
        },
        session: {
          token: newSession.token,
          expiresAt: newSession.expiresAt,
          refreshToken: newSession.refreshToken
        },
        security: {
          lastLoginAt: shopOwner.last_login_at || new Date().toISOString(),
          loginLocation: await this.getLocationFromIP(ipAddress)
        }
      };
    } catch (error) {
      logger.error('Shop owner session refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress
      });
      throw error;
    }
  }

  /**
   * Logout shop owner
   */
  async logoutShopOwner(token: string): Promise<void> {
    try {
      const { data: session, error } = await this.supabase
        .from('shop_owner_sessions')
        .select('*')
        .eq('token', token)
        .eq('is_active', true)
        .single();

      if (session) {
        await this.revokeSession(session.id, 'Shop owner logout');
        await this.logSecurityEvent(session.shop_owner_id, 'logout', {
          ipAddress: session.ip_address
        }, 'info');
      }
    } catch (error) {
      logger.error('Error during shop owner logout', { error });
    }
  }

  /**
   * Get all active sessions for a shop owner
   */
  async getShopOwnerSessions(shopOwnerId: string): Promise<ShopOwnerSession[]> {
    try {
      const { data: sessions, error } = await this.supabase
        .from('shop_owner_sessions')
        .select('*')
        .eq('shop_owner_id', shopOwnerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) {
        logger.error('Failed to get shop owner sessions', {
          error: error.message,
          shopOwnerId
        });
        throw new Error('Failed to get shop owner sessions');
      }

      return sessions || [];
    } catch (error) {
      logger.error('Error getting shop owner sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        shopOwnerId
      });
      throw error;
    }
  }
}

export const shopOwnerAuthService = new ShopOwnerAuthService();
