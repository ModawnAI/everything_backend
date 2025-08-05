import { Request, Response, NextFunction } from 'express';
import { refreshTokenService, RefreshTokenError, RefreshTokenExpiredError, RefreshTokenRevokedError } from '../services/refresh-token.service';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Authentication Controller
 * 
 * Handles authentication-related endpoints including:
 * - Token refresh
 * - Logout (token revocation)
 * - User session management
 */

interface RefreshTokenRequest extends Request {
  body: {
    refreshToken: string;
    deviceInfo?: {
      deviceId?: string;
      platform?: 'ios' | 'android' | 'web';
      version?: string;
    };
  };
}

interface RefreshTokenResponse {
  success: boolean;
  data?: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: 'Bearer';
  };
  error?: {
    code: string;
    message: string;
    timestamp: string;
  };
}

export class AuthController {
  /**
   * POST /api/auth/refresh
   * Refresh access token using refresh token
   */
  static async refreshToken(
    req: RefreshTokenRequest,
    res: Response<RefreshTokenResponse>,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken, deviceInfo } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      // Extract device information from request
      const deviceDetails: { deviceId?: string; userAgent?: string; ipAddress?: string } = {};
      
      if (deviceInfo?.deviceId) {
        deviceDetails.deviceId = deviceInfo.deviceId;
      }
      if (req.get('User-Agent')) {
        deviceDetails.userAgent = req.get('User-Agent');
      }
      if (req.ip || req.connection.remoteAddress) {
        deviceDetails.ipAddress = req.ip || req.connection.remoteAddress;
      }

      // Refresh tokens with rotation
      const tokenPair = await refreshTokenService.refreshTokens(
        refreshToken,
        deviceDetails
      );

      res.status(200).json({
        success: true,
        data: {
          accessToken: tokenPair.accessToken,
          refreshToken: tokenPair.refreshToken,
          expiresIn: tokenPair.expiresIn,
          tokenType: 'Bearer'
        }
      });

      logger.info('Token refresh successful', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        deviceId: deviceInfo?.deviceId
      });
    } catch (error) {
      if (error instanceof RefreshTokenExpiredError) {
        res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_EXPIRED',
            message: 'Refresh token has expired. Please login again.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (error instanceof RefreshTokenRevokedError) {
        res.status(401).json({
          success: false,
          error: {
            code: 'REFRESH_TOKEN_REVOKED',
            message: 'Refresh token has been revoked. Please login again.',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      if (error instanceof RefreshTokenError) {
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

      logger.error('Unexpected error during token refresh', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        ip: req.ip,
        userAgent: req.get('User-Agent')
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
  }

  /**
   * POST /api/auth/logout
   * Revoke refresh token (logout from current device)
   */
  static async logout(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_REFRESH_TOKEN',
            message: 'Refresh token is required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await refreshTokenService.revokeRefreshToken(refreshToken);

      res.status(200).json({
        success: true,
        message: 'Successfully logged out'
      });

      logger.info('User logged out successfully', {
        userId: req.user?.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (error) {
      if (error instanceof RefreshTokenError) {
        // Even if token revocation fails, consider logout successful
        res.status(200).json({
          success: true,
          message: 'Successfully logged out'
        });
        return;
      }

      logger.error('Error during logout', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip
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
  }

  /**
   * POST /api/auth/logout-all
   * Revoke all refresh tokens for user (logout from all devices)
   */
  static async logoutAll(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      await refreshTokenService.revokeAllUserTokens(req.user.id);

      res.status(200).json({
        success: true,
        message: 'Successfully logged out from all devices'
      });

      logger.info('User logged out from all devices', {
        userId: req.user.id,
        ip: req.ip,
        userAgent: req.get('User-Agent')
      });
    } catch (error) {
      logger.error('Error during logout all', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip
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
  }

  /**
   * GET /api/auth/sessions
   * Get user's active sessions (for admin/user management)
   */
  static async getSessions(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user?.id) {
        res.status(401).json({
          success: false,
          error: {
            code: 'AUTHENTICATION_REQUIRED',
            message: 'Authentication required',
            timestamp: new Date().toISOString()
          }
        });
        return;
      }

      const sessions = await refreshTokenService.getUserRefreshTokens(req.user.id);

      res.status(200).json({
        success: true,
        data: {
          sessions: sessions.map(session => ({
            id: session.id,
            deviceId: session.device_id,
            userAgent: session.user_agent,
            ipAddress: session.ip_address,
            createdAt: session.created_at,
            lastUsedAt: session.last_used_at,
            expiresAt: session.expires_at,
            isRevoked: session.revoked
          }))
        }
      });
    } catch (error) {
      logger.error('Error getting user sessions', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: req.user?.id,
        ip: req.ip
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
  }
}

export default AuthController; 