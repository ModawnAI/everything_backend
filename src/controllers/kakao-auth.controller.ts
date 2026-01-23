/**
 * Kakao OAuth Controller
 *
 * Handles Kakao OAuth authentication endpoints
 */

import { Request, Response } from 'express';
import { kakaoAuthService } from '../services/kakao-auth.service';
import { logger } from '../utils/logger';
import { refreshTokenService } from '../services/refresh-token.service';
import { KakaoAuthError } from '../types/kakao-auth.types';

class KakaoAuthController {
  /**
   * GET /api/auth/kakao
   * Initiate Kakao OAuth login
   */
  initiateAuth = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!kakaoAuthService.isConfigured()) {
        res.status(503).json({
          success: false,
          error: {
            code: 'NOT_CONFIGURED',
            message: 'Kakao OAuth is not configured',
          },
        });
        return;
      }

      const returnUrl = req.query.returnUrl as string | undefined;
      const { url } = kakaoAuthService.getAuthorizationUrl(returnUrl);

      logger.info('Redirecting to Kakao OAuth', { hasReturnUrl: !!returnUrl });

      res.redirect(url);
    } catch (error) {
      logger.error('Failed to initiate Kakao OAuth', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'OAUTH_INIT_FAILED',
          message: 'Failed to initiate Kakao login',
        },
      });
    }
  };

  /**
   * GET /api/auth/kakao/callback
   * Handle Kakao OAuth callback
   */
  handleCallback = async (req: Request, res: Response): Promise<void> => {
    try {
      const { code, state, error, error_description } = req.query;

      // Handle OAuth errors
      if (error) {
        logger.error('Kakao OAuth error', { error, error_description });
        res.redirect(`/auth/error?error=${error}&message=${error_description}`);
        return;
      }

      if (!code || !state) {
        logger.error('Missing code or state in Kakao callback');
        res.redirect('/auth/error?error=invalid_request&message=Missing authorization code or state');
        return;
      }

      // Validate state
      const stateData = kakaoAuthService.validateState(state as string);
      if (!stateData) {
        logger.error('Invalid or expired state in Kakao callback');
        res.redirect('/auth/error?error=invalid_state&message=Invalid or expired state');
        return;
      }

      // Exchange code for tokens
      const tokenResponse = await kakaoAuthService.exchangeCodeForToken(code as string);

      // Authenticate user
      const { user, isNewUser, kakaoUserId } = await kakaoAuthService.authenticateWithKakao(
        tokenResponse.access_token
      );

      // Generate JWT tokens
      const tokens = await refreshTokenService.generateTokenPair(user.id);

      logger.info('Kakao OAuth callback successful', {
        userId: user.id,
        kakaoUserId,
        isNewUser,
      });

      // Determine redirect URL
      const baseUrl = process.env.FRONTEND_URL || 'https://e-beautything.com';
      const returnUrl = stateData.returnUrl || '/';

      // Redirect with tokens
      const redirectUrl = new URL(returnUrl, baseUrl);
      redirectUrl.searchParams.set('token', tokens.accessToken);
      redirectUrl.searchParams.set('refreshToken', tokens.refreshToken);
      redirectUrl.searchParams.set('isNewUser', isNewUser.toString());

      res.redirect(redirectUrl.toString());
    } catch (error) {
      logger.error('Kakao OAuth callback failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      const errorMessage = error instanceof KakaoAuthError
        ? error.message
        : 'Authentication failed';

      res.redirect(`/auth/error?error=auth_failed&message=${encodeURIComponent(errorMessage)}`);
    }
  };

  /**
   * POST /api/auth/kakao/token
   * Authenticate with Kakao access token (for mobile apps)
   */
  authenticateWithToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const { accessToken, fcmToken, deviceInfo } = req.body;

      if (!accessToken) {
        res.status(400).json({
          success: false,
          error: {
            code: 'MISSING_TOKEN',
            message: 'Access token is required',
          },
        });
        return;
      }

      // Authenticate with Kakao
      logger.debug('[KAKAO] Step 1: Starting authentication');
      const { user, isNewUser, kakaoUserId } = await kakaoAuthService.authenticateWithKakao(accessToken);
      logger.debug('[KAKAO] Step 2: User authenticated', { userId: user.id, isNewUser });

      // Check if user is active
      if (user.user_status !== 'active') {
        res.status(403).json({
          success: false,
          error: {
            code: 'ACCOUNT_INACTIVE',
            message: 'Account is inactive',
          },
        });
        return;
      }

      // Generate JWT tokens
      logger.debug('[KAKAO] Step 3: Generating JWT tokens', { userId: user.id });
      const tokens = await refreshTokenService.generateTokenPair(user.id);
      logger.debug('[KAKAO] Step 4: JWT tokens generated');

      // Update FCM token if provided
      if (fcmToken) {
        // TODO: Save FCM token to database
        logger.info('FCM token received', { userId: user.id });
      }

      logger.info('Kakao token authentication successful', {
        userId: user.id,
        kakaoUserId,
        isNewUser,
      });

      res.json({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            profileImageUrl: user.profile_image_url,
            role: user.user_role,
            status: user.user_status,
          },
          token: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 3600, // 1 hour
          isNewUser,
          profileComplete: !!(user.name && user.phone),
        },
      });
    } catch (error) {
      console.error('=== KAKAO AUTH ERROR ===');
      console.error('Error:', error);
      console.error('========================');
      logger.error('Kakao token authentication failed', {
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined,
        name: error instanceof Error ? error.name : undefined,
      });

      if (error instanceof KakaoAuthError) {
        res.status(error.statusCode).json({
          success: false,
          error: {
            code: error.code,
            message: error.message,
          },
        });
        return;
      }

      res.status(500).json({
        success: false,
        error: {
          code: 'AUTH_FAILED',
          message: 'Authentication failed',
        },
      });
    }
  };

  /**
   * DELETE /api/auth/kakao/unlink
   * Unlink Kakao account from user
   */
  unlinkAccount = async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = (req as any).user?.id;
      const { accessToken } = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        });
        return;
      }

      const result = await kakaoAuthService.unlinkKakaoAccount(userId, accessToken);

      if (!result) {
        res.status(400).json({
          success: false,
          error: {
            code: 'UNLINK_FAILED',
            message: 'Failed to unlink Kakao account',
          },
        });
        return;
      }

      res.json({
        success: true,
        message: 'Kakao account unlinked successfully',
      });
    } catch (error) {
      logger.error('Failed to unlink Kakao account', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      res.status(500).json({
        success: false,
        error: {
          code: 'UNLINK_FAILED',
          message: 'Failed to unlink Kakao account',
        },
      });
    }
  };

  /**
   * GET /api/auth/kakao/status
   * Check Kakao OAuth configuration status
   */
  getStatus = async (req: Request, res: Response): Promise<void> => {
    const configured = kakaoAuthService.isConfigured();

    res.json({
      success: true,
      data: {
        configured,
        available: configured,
        provider: 'kakao',
        scopes: ['profile_nickname', 'profile_image'],
      },
    });
  };
}

// Export singleton instance
export const kakaoAuthController = new KakaoAuthController();
export default kakaoAuthController;
