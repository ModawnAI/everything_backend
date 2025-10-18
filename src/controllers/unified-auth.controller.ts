/**
 * Unified Authentication Controller
 * Handles HTTP requests for unified authentication endpoints
 */

import { Request, Response, NextFunction } from 'express';
import { UnifiedAuthService } from '../services/unified-auth.service';
import { logger } from '../utils/logger';
import { LoginRequest, UserRole } from '../types/unified-auth.types';

export class UnifiedAuthController {
  private authService: UnifiedAuthService;

  constructor() {
    this.authService = new UnifiedAuthService();
  }

  /**
   * POST /api/auth/login
   * Unified login endpoint for all user roles
   */
  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, role, device_id, device_name } = req.body;

      // Validate required fields
      if (!email || !password || !role) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Email, password, and role are required'
          }
        });
        return;
      }

      // Validate role
      const validRoles: UserRole[] = ['admin', 'shop_owner', 'customer'];
      if (!validRoles.includes(role)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_ROLE',
            message: 'Invalid role. Must be one of: admin, shop_owner, customer'
          }
        });
        return;
      }

      // Extract client info
      const ip_address = req.ip || req.connection.remoteAddress || 'unknown';
      const user_agent = req.get('user-agent') || 'unknown';

      const loginData: LoginRequest = {
        email,
        password,
        role,
        ip_address,
        user_agent,
        device_id,
        device_name
      };

      const result = await this.authService.login(loginData);

      if (!result.success) {
        res.status(401).json({
          success: false,
          error: {
            code: result.security?.require_password_change ? 'PASSWORD_CHANGE_REQUIRED' : 'LOGIN_FAILED',
            message: result.message || 'Login failed'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Login controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        email: req.body.email,
        role: req.body.role
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'LOGIN_FAILED',
          message: error instanceof Error ? error.message : 'Login failed'
        }
      });
    }
  };

  /**
   * POST /api/auth/logout
   * Logout current session
   */
  logout = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided'
          }
        });
        return;
      }

      const { reason } = req.body;
      const userId = (req as any).user?.id; // From auth middleware

      await this.authService.logout(token, userId, reason);

      res.status(200).json({
        success: true,
        message: 'Logged out successfully'
      });
    } catch (error) {
      logger.error('Logout controller error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_FAILED',
          message: error instanceof Error ? error.message : 'Logout failed'
        }
      });
    }
  };

  /**
   * POST /api/auth/logout-all
   * Logout from all devices
   */
  logoutAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.id || !user.role) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const { reason } = req.body;
      const count = await this.authService.logoutAll(user.id, user.role, user.id, reason);

      res.status(200).json({
        success: true,
        message: `Logged out from ${count} devices`,
        data: { count }
      });
    } catch (error) {
      logger.error('Logout all controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'LOGOUT_ALL_FAILED',
          message: error instanceof Error ? error.message : 'Logout from all devices failed'
        }
      });
    }
  };

  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Refresh token is required'
          }
        });
        return;
      }

      const result = await this.authService.refreshToken(refreshToken);

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (error) {
      logger.error('Refresh token controller error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'TOKEN_REFRESH_FAILED',
          message: error instanceof Error ? error.message : 'Token refresh failed'
        }
      });
    }
  };

  /**
   * GET /api/auth/validate
   * Validate current session
   */
  validateSession = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'No token provided'
          }
        });
        return;
      }

      const validation = await this.authService.validateSession(token);

      if (!validation.valid) {
        res.status(401).json({
          success: false,
          error: {
            code: 'INVALID_SESSION',
            message: validation.error || 'Session is invalid'
          }
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          valid: true,
          user: validation.user,
          session: validation.session
        }
      });
    } catch (error) {
      logger.error('Validate session controller error', {
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      res.status(401).json({
        success: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: error instanceof Error ? error.message : 'Session validation failed'
        }
      });
    }
  };

  /**
   * GET /api/auth/sessions
   * Get user's active sessions
   */
  getSessions = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.id || !user.role) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const sessions = await this.authService.getUserSessions(user.id, user.role);

      res.status(200).json({
        success: true,
        data: { sessions }
      });
    } catch (error) {
      logger.error('Get sessions controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_SESSIONS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve sessions'
        }
      });
    }
  };

  /**
   * POST /api/auth/change-password
   * Change user password
   */
  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.id || !user.role) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'Current password and new password are required'
          }
        });
        return;
      }

      // Validate new password strength
      if (newPassword.length < 8) {
        res.status(400).json({
          success: false,
          error: {
            code: 'WEAK_PASSWORD',
            message: 'New password must be at least 8 characters long'
          }
        });
        return;
      }

      await this.authService.changePassword(
        user.id,
        user.role,
        currentPassword,
        newPassword
      );

      res.status(200).json({
        success: true,
        message: 'Password changed successfully. Please login again.'
      });
    } catch (error) {
      logger.error('Change password controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(400).json({
        success: false,
        error: {
          code: 'PASSWORD_CHANGE_FAILED',
          message: error instanceof Error ? error.message : 'Password change failed'
        }
      });
    }
  };

  /**
   * GET /api/auth/login-statistics
   * Get login statistics for current user
   */
  getLoginStatistics = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.id || !user.role) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const statistics = await this.authService.getLoginStatistics(user.id, user.role);

      res.status(200).json({
        success: true,
        data: statistics
      });
    } catch (error) {
      logger.error('Get login statistics controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_STATISTICS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve login statistics'
        }
      });
    }
  };

  /**
   * GET /api/auth/security-logs
   * Get security logs for current user
   */
  getSecurityLogs = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = (req as any).user;

      if (!user || !user.id || !user.role) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'User not authenticated'
          }
        });
        return;
      }

      const limit = parseInt(req.query.limit as string) || 50;
      const logs = await this.authService.getSecurityLogs(user.id, user.role, limit);

      res.status(200).json({
        success: true,
        data: { logs }
      });
    } catch (error) {
      logger.error('Get security logs controller error', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: (req as any).user?.id
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'GET_LOGS_FAILED',
          message: error instanceof Error ? error.message : 'Failed to retrieve security logs'
        }
      });
    }
  };
}

// Export singleton instance
export const unifiedAuthController = new UnifiedAuthController();
