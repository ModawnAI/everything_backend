import { Request, Response } from 'express';
import { adminAuthService } from '../services/admin-auth.service';
import { logger } from '../utils/logger';

export class AdminAuthController {
  /**
   * POST /api/admin/auth/login
   * Admin login with enhanced security
   */
  async adminLogin(req: Request, res: Response): Promise<void> {
    const { email, password, deviceInfo } = req.body;
    const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
    const userAgent = req.get('User-Agent') || deviceInfo?.userAgent || 'unknown';
    const deviceId = deviceInfo?.deviceId || `device-${Date.now()}-${Math.random().toString(36).substring(7)}`;

    // Log all admin login attempts
    logger.info('🔐 Admin login attempt', {
      email,
      ipAddress,
      userAgent,
      deviceId,
      timestamp: new Date().toISOString()
    });

    try {
      // Validate required fields
      if (!email || !password) {
        logger.warn('⚠️ Admin login failed: Missing credentials', {
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
        logger.warn('⚠️ Admin login failed: Invalid email format', {
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
        deviceId
      };

      logger.debug('🔍 Processing admin login request', {
        email,
        ipAddress,
        userAgent
      });

      const result = await adminAuthService.adminLogin(authRequest);

      logger.info('✅ Admin login successful', {
        adminId: result.admin.id,
        email: result.admin.email,
        role: result.admin.role,
        ipAddress,
        sessionExpiresAt: result.session?.expiresAt
      });

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('❌ Admin login failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        email,
        ipAddress,
        userAgent
      });

      const errorMessage = error instanceof Error ? error.message : 'Login failed';

      // Don't expose internal errors to client
      const clientMessage = errorMessage.includes('Invalid admin credentials')
        ? 'Invalid email or password'
        : errorMessage.includes('IP address not whitelisted')
        ? 'Access denied: IP not authorized for admin access'
        : errorMessage.includes('Account locked')
        ? 'Account is locked. Please contact system administrator.'
        : 'Login failed. Please try again.';

      res.status(401).json({
        success: false,
        error: clientMessage
      });
    }
  }

  /**
   * POST /api/admin/auth/refresh
   * Refresh admin session
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

      const result = await adminAuthService.refreshAdminSession(refreshToken, ipAddress);

      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Admin session refresh failed', {
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
   * POST /api/admin/auth/logout
   * Admin logout
   */
  async adminLogout(req: Request, res: Response): Promise<void> {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        res.status(400).json({
          success: false,
          error: 'Authorization token is required'
        });
        return;
      }

      await adminAuthService.logoutAdmin(token);

      res.json({
        success: true,
        message: 'Successfully logged out'
      });
    } catch (error) {
      logger.error('Admin logout failed', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: 'Logout failed'
      });
    }
  }

  /**
   * GET /api/admin/auth/validate
   * Validate admin session
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

      const validation = await adminAuthService.validateAdminSession(token, ipAddress);

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
          admin: validation.admin,
          session: {
            id: validation.session?.id,
            expiresAt: validation.session?.expiresAt,
            lastActivityAt: validation.session?.lastActivityAt
          }
        }
      });
    } catch (error) {
      logger.error('Admin session validation failed', {
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
   * GET /api/admin/auth/profile
   * Get admin profile information
   */
  async getAdminProfile(req: Request, res: Response): Promise<void> {
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

      const validation = await adminAuthService.validateAdminSession(token, ipAddress);

      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      // Get additional admin profile data
      const { data: adminProfile, error } = await adminAuthService['supabase']
        .from('users')
        .select('id, email, name, user_role, user_status, created_at, last_login_at, last_login_ip')
        .eq('id', validation.admin.id)
        .single();

      if (error || !adminProfile) {
        res.status(404).json({
          success: false,
          error: 'Admin profile not found'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          id: adminProfile.id,
          email: adminProfile.email,
          name: adminProfile.name,
          role: adminProfile.user_role,
          status: adminProfile.user_status,
          permissions: validation.admin.permissions,
          createdAt: adminProfile.created_at,
          lastLoginAt: adminProfile.last_login_at,
          lastLoginIp: adminProfile.last_login_ip
        }
      });
    } catch (error) {
      logger.error('Get admin profile failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get admin profile'
      });
    }
  }

  /**
   * GET /api/admin/auth/sessions
   * Get admin's active sessions
   */
  async getAdminSessions(req: Request, res: Response): Promise<void> {
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

      const validation = await adminAuthService.validateAdminSession(token, ipAddress);

      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      const sessions = await adminAuthService.getAdminSessions(validation.admin.id);

      res.json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            deviceId: session.deviceId,
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
      logger.error('Get admin sessions failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        ipAddress: req.ip
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get admin sessions'
      });
    }
  }

  /**
   * POST /api/admin/auth/change-password
   * Change admin password
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

      const validation = await adminAuthService.validateAdminSession(token, ipAddress);

      if (!validation.isValid || !validation.admin) {
        res.status(401).json({
          success: false,
          error: validation.error || 'Invalid session'
        });
        return;
      }

      // Verify current password and update to new password
      const { data: admin, error: adminError } = await adminAuthService['supabase']
        .from('users')
        .select('password_hash')
        .eq('id', validation.admin.id)
        .single();

      if (adminError || !admin) {
        res.status(404).json({
          success: false,
          error: 'Admin user not found'
        });
        return;
      }

      // Verify current password
      const bcrypt = require('bcrypt');
      const isValidCurrentPassword = await bcrypt.compare(currentPassword, admin.password_hash);
      
      if (!isValidCurrentPassword) {
        res.status(400).json({
          success: false,
          error: 'Current password is incorrect'
        });
        return;
      }

      // Hash new password
      const saltRounds = 12;
      const newPasswordHash = await bcrypt.hash(newPassword, saltRounds);

      // Update password
      const { error: updateError } = await adminAuthService['supabase']
        .from('users')
        .update({ 
          password_hash: newPasswordHash,
          updated_at: new Date().toISOString()
        })
        .eq('id', validation.admin.id);

      if (updateError) {
        res.status(500).json({
          success: false,
          error: 'Failed to update password'
        });
        return;
      }

      // Log password change
      await adminAuthService['logAdminAction'](validation.admin.id, 'password_changed', {
        ipAddress,
        userAgent: req.get('User-Agent'),
        changedAt: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error) {
      logger.error('Change admin password failed', {
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

export const adminAuthController = new AdminAuthController(); 