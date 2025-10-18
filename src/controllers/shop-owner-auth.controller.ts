import { Request, Response } from 'express';
import { shopOwnerAuthService } from '../services/shop-owner-auth.service';
import { logger } from '../utils/logger';

export class ShopOwnerAuthController {
  /**
   * POST /api/shop-owner/auth/login
   * Shop owner login with email and password
   */
  async shopOwnerLogin(req: Request, res: Response): Promise<void> {
    const { email, password, deviceInfo } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || deviceInfo?.userAgent || 'unknown';
    const deviceId = deviceInfo?.deviceId || `device-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const deviceName = deviceInfo?.deviceName;

    // Log all shop owner login attempts
    logger.info('🔐 Shop owner login attempt', {
      email,
      ipAddress,
      userAgent,
      deviceId,
      timestamp: new Date().toISOString()
    });

    try {
      // Validate required fields
      if (!email || !password) {
        logger.warn('⚠️ Shop owner login failed: Missing credentials', {
          email,
          ipAddress,
          missingFields: { email: !email, password: !password }
        });
        res.status(400).json({
          success: false,
          error: 'Email and password are required'
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        logger.warn('⚠️ Shop owner login failed: Invalid email format', {
          email,
          ipAddress
        });
        res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
        return;
      }

      const authRequest = {
        email,
        password,
        ipAddress,
        userAgent,
        deviceId,
        deviceName
      };

      logger.debug('🔍 Processing shop owner login request', {
        email,
        ipAddress,
        userAgent
      });

      const result = await shopOwnerAuthService.shopOwnerLogin(authRequest);

      logger.info('✅ Shop owner login successful', {
        shopOwnerId: result.shopOwner.id,
        email: result.shopOwner.email,
        role: result.shopOwner.role,
        shopId: result.shopOwner.shop.id,
        shopName: result.shopOwner.shop.name,
        ipAddress,
        sessionExpiresAt: result.session.expiresAt
      });

      // Frontend expects token and refreshToken inside data object
      res.json({
        success: true,
        data: {
          token: result.session.token,
          refreshToken: result.session.refreshToken,
          shopOwner: result.shopOwner,
          security: result.security,
          expiresAt: result.session.expiresAt
        }
      });
    } catch (error) {
      logger.error('❌ Shop owner login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        email,
        ipAddress,
        userAgent
      });

      const errorMessage = error instanceof Error ? error.message : 'Login failed';

      // Map error messages to user-friendly responses
      const clientMessage = errorMessage.includes('Invalid shop owner credentials')
        ? 'Invalid email or password'
        : errorMessage.includes('No active shop')
        ? 'No active shop associated with this account'
        : errorMessage.includes('Account is locked')
        ? 'Account is locked. Please contact support.'
        : errorMessage.includes('Too many failed login attempts')
        ? 'Account locked due to multiple failed login attempts. Please try again later.'
        : 'Login failed. Please try again.';

      res.status(401).json({
        success: false,
        error: clientMessage
      });
    }
  }

  /**
   * POST /api/shop-owner/auth/refresh
   * Refresh shop owner session
   */
  async refreshSession(req: Request, res: Response): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: 'Refresh token is required'
        });
        return;
      }

      const result = await shopOwnerAuthService.refreshShopOwnerSession(refreshToken, ipAddress);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Shop owner session refresh failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(401).json({
        success: false,
        error: 'Invalid or expired refresh token'
      });
    }
  }

  /**
   * POST /api/shop-owner/auth/logout
   * Shop owner logout
   */
  async shopOwnerLogout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      await shopOwnerAuthService.logoutShopOwner(token);

      res.json({
        success: true,
        message: 'Successfully logged out'
      });
    } catch (error) {
      logger.error('Shop owner logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * GET /api/shop-owner/auth/validate
   * Validate shop owner session
   */
  async validateSession(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      const validation = await shopOwnerAuthService.validateShopOwnerSession(token, ipAddress);

      if (!validation.isValid) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          shopOwner: validation.shopOwner,
          session: {
            id: validation.session?.id,
            expiresAt: validation.session?.expiresAt,
            lastActivityAt: validation.session?.lastActivityAt
          }
        }
      });
    } catch (error) {
      logger.error('Shop owner session validation failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(401).json({
        success: false,
        error: 'Session validation failed'
      });
    }
  }

  /**
   * GET /api/shop-owner/auth/profile
   * Get shop owner profile information
   */
  async getShopOwnerProfile(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      const validation = await shopOwnerAuthService.validateShopOwnerSession(token, ipAddress);

      if (!validation.isValid || !validation.shopOwner) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      // Get detailed shop owner profile including shop info
      const { getSupabaseClient } = require('../config/database');
      const supabase = getSupabaseClient();

      const { data: profile, error } = await supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          user_role,
          user_status,
          created_at,
          last_login_at,
          last_login_ip
        `)
        .eq('id', validation.shopOwner.id)
        .single();

      if (error || !profile) {
        res.status(404).json({
          success: false,
          error: 'Shop owner profile not found'
        });
        return;
      }

      // Get shop details
      const { data: shop } = await supabase
        .from('shops')
        .select('*')
        .eq('id', validation.shopOwner.shopId)
        .single();

      res.json({
        success: true,
        data: {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.user_role,
          status: profile.user_status,
          shop: shop ? {
            id: shop.id,
            name: shop.name,
            status: shop.shop_status,
            mainCategory: shop.main_category,
            address: shop.address,
            phoneNumber: shop.phone_number,
            description: shop.description
          } : undefined,
          createdAt: profile.created_at,
          lastLoginAt: profile.last_login_at,
          lastLoginIp: profile.last_login_ip
        }
      });
    } catch (error) {
      logger.error('Get shop owner profile failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop owner profile'
      });
    }
  }

  /**
   * GET /api/shop-owner/auth/sessions
   * Get shop owner's active sessions
   */
  async getShopOwnerSessions(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      const validation = await shopOwnerAuthService.validateShopOwnerSession(token, ipAddress);

      if (!validation.isValid || !validation.shopOwner) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      const sessions = await shopOwnerAuthService.getShopOwnerSessions(validation.shopOwner.id);

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            deviceId: session.deviceId,
            deviceName: session.deviceName,
            ipAddress: session.ipAddress,
            userAgent: session.userAgent,
            createdAt: session.createdAt,
            lastActivityAt: session.lastActivityAt,
            expiresAt: session.expiresAt,
            isActive: session.isActive
          })),
          total: sessions.length
        }
      });
    } catch (error) {
      logger.error('Get shop owner sessions failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get shop owner sessions'
      });
    }
  }

  /**
   * POST /api/shop-owner/auth/change-password
   * Change shop owner password
   */
  async changePassword(req: Request, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      const token = req.headers.authorization?.replace('Bearer ', '');
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

      if (!token) {
        res.status(401).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password and new password are required'
        });
        return;
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          error: 'New password must be at least 8 characters long'
        });
        return;
      }

      const validation = await shopOwnerAuthService.validateShopOwnerSession(token, ipAddress);

      if (!validation.isValid || !validation.shopOwner) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      // Use Supabase Auth to update password
      const { getSupabaseClient } = require('../config/database');
      const { createClient } = require('@supabase/supabase-js');
      const { config } = require('../config/environment');

      // Create auth client with user's token
      const userAuthClient = createClient(
        config.database.supabaseUrl,
        config.database.supabaseAnonKey,
        {
          global: {
            headers: {
              Authorization: `Bearer ${token}`
            }
          }
        }
      );

      // Verify current password
      const { error: signInError } = await userAuthClient.auth.signInWithPassword({
        email: validation.shopOwner.email,
        password: currentPassword
      });

      if (signInError) {
        res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
        return;
      }

      // Update password
      const { error: updateError } = await userAuthClient.auth.updateUser({
        password: newPassword
      });

      if (updateError) {
        res.status(500).json({
          success: false,
          error: 'Failed to update password'
        });
        return;
      }

      // Log password change security event
      const supabase = getSupabaseClient();
      await supabase
        .from('shop_owner_security_logs')
        .insert({
          shop_owner_id: validation.shopOwner.id,
          event_type: 'password_changed',
          event_details: {
            ipAddress,
            userAgent: req.get('User-Agent'),
            changedAt: new Date().toISOString()
          },
          ip_address: ipAddress,
          user_agent: req.get('User-Agent'),
          severity: 'info',
          created_at: new Date().toISOString()
        });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change shop owner password failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to change password'
      });
    }
  }
}

export const shopOwnerAuthController = new ShopOwnerAuthController();
