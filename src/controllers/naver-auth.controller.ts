/**
 * Naver OAuth Authentication Controller
 *
 * Handles Naver OAuth endpoints:
 * - GET /api/auth/naver - Redirect to Naver authorization
 * - GET /api/auth/naver/callback - Handle OAuth callback
 * - POST /api/auth/naver/token - Authenticate with Naver access token (mobile app)
 * - DELETE /api/auth/naver/unlink - Unlink Naver account
 */

import { Request, Response, NextFunction } from 'express';
import { naverAuthService } from '../services/naver-auth.service';
import { refreshTokenService } from '../services/refresh-token.service';
import { logger } from '../utils/logger';
import { config } from '../config/environment';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { getSupabaseClient } from '../config/database';
import { NaverAuthError } from '../types/naver-auth.types';

class NaverAuthController {
  private supabase = getSupabaseClient();

  /**
   * GET /api/auth/naver
   * Redirect to Naver authorization page
   */
  public initiateAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const returnUrl = req.query.returnUrl as string;

      if (!naverAuthService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'NAVER_NOT_CONFIGURED',
            message: 'Naver OAuth is not configured',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      const { url, state } = naverAuthService.getAuthorizationUrl(returnUrl);

      logger.info('Redirecting to Naver authorization', {
        hasReturnUrl: !!returnUrl,
      });

      // Set state in a cookie for verification later
      res.cookie('naver_oauth_state', state, {
        httpOnly: true,
        secure: config.server.isProduction,
        sameSite: 'lax',
        maxAge: 10 * 60 * 1000, // 10 minutes
      });

      res.redirect(url);
    } catch (error) {
      logger.error('Failed to initiate Naver OAuth', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'NAVER_AUTH_INIT_FAILED',
          message: 'Failed to initiate Naver authentication',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * GET /api/auth/naver/callback
   * Handle Naver OAuth callback
   */
  public handleCallback = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `naver-cb-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    try {
      const { code, state, error, error_description } = req.query;

      // Check for OAuth error
      if (error) {
        logger.warn('Naver OAuth error returned', {
          error,
          error_description,
          requestId,
        });

        const errorUrl = `${process.env.APP_URL}/auth/error?provider=naver&error=${error}`;
        res.redirect(errorUrl);
        return;
      }

      // Validate code
      if (!code || typeof code !== 'string') {
        res.redirect(`${process.env.APP_URL}/auth/error?provider=naver&error=missing_code`);
        return;
      }

      // Validate state
      if (!state || typeof state !== 'string') {
        res.redirect(`${process.env.APP_URL}/auth/error?provider=naver&error=missing_state`);
        return;
      }

      // Verify state from cookie
      const savedState = req.cookies?.naver_oauth_state;
      if (!savedState || savedState !== state) {
        logger.warn('Naver OAuth state mismatch', { requestId });
        res.redirect(`${process.env.APP_URL}/auth/error?provider=naver&error=state_mismatch`);
        return;
      }

      // Clear state cookie
      res.clearCookie('naver_oauth_state');

      // Parse state to get return URL
      const stateData = naverAuthService.validateState(state);
      if (!stateData) {
        res.redirect(`${process.env.APP_URL}/auth/error?provider=naver&error=invalid_state`);
        return;
      }

      // Exchange code for token
      const tokenResponse = await naverAuthService.exchangeCodeForToken(code);

      // Authenticate and get/create user
      const { user, isNewUser, naverUserId } = await naverAuthService.authenticateWithNaver(
        tokenResponse.access_token
      );

      // Generate JWT tokens for our system
      const tokens = await refreshTokenService.generateTokenPair(user.id, {
        deviceType: 'web',
        deviceId: `naver-${naverUserId}`,
      });

      logger.info('Naver OAuth callback successful', {
        userId: user.id,
        isNewUser,
        requestId,
      });

      // Redirect to success page with tokens
      const returnUrl = stateData.returnUrl || '/';
      const successUrl = new URL(`${process.env.APP_URL}/auth/callback`);
      successUrl.searchParams.set('provider', 'naver');
      successUrl.searchParams.set('accessToken', tokens.accessToken);
      successUrl.searchParams.set('refreshToken', tokens.refreshToken);
      successUrl.searchParams.set('isNewUser', String(isNewUser));
      successUrl.searchParams.set('returnUrl', returnUrl);

      res.redirect(successUrl.toString());
    } catch (error) {
      logger.error('Naver OAuth callback failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage = error instanceof NaverAuthError ? error.code : 'callback_failed';
      res.redirect(`${process.env.APP_URL}/auth/error?provider=naver&error=${errorMessage}`);
    }
  };

  /**
   * POST /api/auth/naver/token
   * Authenticate with Naver access token (for mobile apps)
   */
  public authenticateWithToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const requestId = `naver-token-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const startTime = Date.now();

    try {
      const { accessToken, fcmToken, deviceInfo } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
      const userAgent = req.get('User-Agent') || 'unknown';

      if (!accessToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_ACCESS_TOKEN',
            message: 'Naver access token is required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      logger.info('Naver token authentication attempt', {
        requestId,
        hasFcmToken: !!fcmToken,
        platform: deviceInfo?.platform,
        ipAddress,
      });

      // Authenticate with Naver
      const { user, isNewUser, naverUserId } = await naverAuthService.authenticateWithNaver(accessToken);

      // Check user status
      if (user.user_status !== 'active') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: `Account is ${user.user_status}`,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Generate tokens
      const tokens = await refreshTokenService.generateTokenPair(user.id, {
        deviceType: deviceInfo?.platform || 'web',
        deviceId: deviceInfo?.deviceId || `naver-${naverUserId}`,
      });

      // Register FCM token if provided
      if (fcmToken) {
        try {
          await this.supabase
            .from('push_tokens')
            .upsert({
              user_id: user.id,
              token: fcmToken,
              platform: deviceInfo?.platform || 'unknown',
              device_id: deviceInfo?.deviceId,
              app_version: deviceInfo?.appVersion,
              is_active: true,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id,token' });
        } catch (fcmError) {
          logger.warn('Failed to register FCM token', {
            requestId,
            error: fcmError instanceof Error ? fcmError.message : 'Unknown error',
          });
        }
      }

      const duration = Date.now() - startTime;
      logger.info('Naver token authentication successful', {
        requestId,
        userId: user.id,
        isNewUser,
        duration,
      });

      // Check profile completion
      const profileComplete = !!(
        user.name &&
        user.email &&
        user.phone &&
        user.birth_date
      );

      res.status(200).json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            user_role: user.user_role,
            user_status: user.user_status,
            profile_image_url: user.profile_image_url,
            phone: user.phone,
            birth_date: user.birth_date,
            created_at: user.created_at,
            updated_at: user.updated_at,
          },
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 3600, // 1 hour
          isNewUser,
          profileComplete,
        },
        message: isNewUser ? 'Account created successfully' : 'Login successful',
      });
    } catch (error) {
      const duration = Date.now() - startTime;

      logger.error('Naver token authentication failed', {
        requestId,
        duration,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      if (error instanceof NaverAuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'NAVER_AUTH_FAILED',
          message: 'Failed to authenticate with Naver',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * DELETE /api/auth/naver/unlink
   * Unlink Naver account from user
   */
  public unlinkAccount = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user?.id;
      const { accessToken } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Verify user is linked to Naver
      const { data: user } = await this.supabase
        .from('users')
        .select('social_provider')
        .eq('id', userId)
        .single();

      if (!user || user.social_provider !== 'naver') {
        res.status(400).json({
          success: false,
          error: {
            code: 'NOT_LINKED_TO_NAVER',
            message: 'Account is not linked to Naver',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      // Unlink account
      const success = await naverAuthService.unlinkNaverAccount(userId, accessToken);

      if (!success) {
        res.status(500).json({
          success: false,
          error: {
            code: 'UNLINK_FAILED',
            message: 'Failed to unlink Naver account',
            timestamp: new Date().toISOString(),
          },
        });
        return;
      }

      logger.info('Naver account unlinked', { userId });

      res.status(200).json({
        success: true,
        data: {
          message: 'Naver account has been unlinked',
        },
      });
    } catch (error) {
      logger.error('Failed to unlink Naver account', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'UNLINK_ERROR',
          message: 'Failed to unlink Naver account',
          timestamp: new Date().toISOString(),
        },
      });
    }
  };

  /**
   * GET /api/auth/naver/status
   * Check Naver OAuth configuration status
   */
  public getStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    res.status(200).json({
      success: true,
      data: {
        configured: naverAuthService.isConfigured(),
        available: naverAuthService.isConfigured(),
        provider: 'naver',
      },
    });
  };
}

// Export singleton instance
export const naverAuthController = new NaverAuthController();
export default naverAuthController;
