/**
 * Kakao OAuth Authentication Service
 *
 * Handles Kakao OAuth 2.0 authentication flow
 * - Authorization URL generation (with custom scopes)
 * - Token exchange
 * - User profile retrieval
 * - Token validation and refresh
 */

import axios from 'axios';
import crypto from 'crypto';
import { getSupabaseClient } from '../config/database';
import { config } from '../config/environment';
import { logger } from '../utils/logger';
import {
  KakaoTokenResponse,
  KakaoUserProfile,
  KakaoOAuthState,
  KakaoAuthError,
  KakaoTokenError,
  KakaoUserInfoError,
  KAKAO_OAUTH_URLS,
} from '../types/kakao-auth.types';
import { UserProfile } from '../types/social-auth.types';

class KakaoAuthService {
  private supabase = getSupabaseClient();

  // Scopes to request (excluding account_email which requires business verification)
  private readonly DEFAULT_SCOPES = 'profile_nickname profile_image';

  /**
   * Check if Kakao OAuth is configured
   */
  isConfigured(): boolean {
    return !!(
      config.socialLogin.kakao?.clientId &&
      config.socialLogin.kakao?.clientSecret
    );
  }

  /**
   * Generate authorization URL for Kakao OAuth
   */
  getAuthorizationUrl(returnUrl?: string): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new KakaoAuthError('Kakao OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    // Generate state for CSRF protection
    const stateData: KakaoOAuthState = {
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      returnUrl,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    const callbackUrl = config.socialLogin.kakao.callbackUrl ||
      `${process.env.APP_URL || 'https://api.e-beautything.com'}/api/auth/kakao/callback`;

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.socialLogin.kakao.clientId,
      redirect_uri: callbackUrl,
      state,
      scope: this.DEFAULT_SCOPES,
    });

    const url = `${KAKAO_OAUTH_URLS.AUTHORIZATION}?${params.toString()}`;

    logger.info('Generated Kakao authorization URL', {
      hasReturnUrl: !!returnUrl,
      stateNonce: stateData.nonce.substring(0, 8) + '...',
      scopes: this.DEFAULT_SCOPES,
    });

    return { url, state };
  }

  /**
   * Validate state parameter to prevent CSRF
   */
  validateState(state: string): KakaoOAuthState | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const stateData: KakaoOAuthState = JSON.parse(decoded);

      // Check if state is too old (10 minutes expiry)
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - stateData.timestamp > maxAge) {
        logger.warn('Kakao OAuth state expired', {
          stateAge: Date.now() - stateData.timestamp,
        });
        return null;
      }

      return stateData;
    } catch (error) {
      logger.error('Failed to validate Kakao OAuth state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<KakaoTokenResponse> {
    if (!this.isConfigured()) {
      throw new KakaoAuthError('Kakao OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    try {
      const callbackUrl = config.socialLogin.kakao.callbackUrl ||
        `${process.env.APP_URL || 'https://api.e-beautything.com'}/api/auth/kakao/callback`;

      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.socialLogin.kakao.clientId,
        client_secret: config.socialLogin.kakao.clientSecret,
        redirect_uri: callbackUrl,
        code,
      });

      const response = await axios.post<KakaoTokenResponse>(
        KAKAO_OAUTH_URLS.TOKEN,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          timeout: 10000,
        }
      );

      if (response.data.error) {
        logger.error('Kakao token exchange error', {
          error: response.data.error,
          description: response.data.error_description,
        });
        throw new KakaoTokenError(response.data.error_description || 'Token exchange failed');
      }

      logger.info('Kakao token exchange successful', {
        expiresIn: response.data.expires_in,
      });

      return response.data;
    } catch (error) {
      if (error instanceof KakaoTokenError) {
        throw error;
      }

      logger.error('Failed to exchange Kakao authorization code', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new KakaoTokenError('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile using access token
   */
  async getUserProfile(accessToken: string): Promise<KakaoUserProfile> {
    try {
      const response = await axios.get<KakaoUserProfile>(
        KAKAO_OAUTH_URLS.USER_INFO,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          timeout: 10000,
        }
      );

      logger.info('Kakao user profile retrieved', {
        userId: response.data.id,
        hasNickname: !!response.data.kakao_account?.profile?.nickname,
        hasProfileImage: !!response.data.kakao_account?.profile?.profile_image_url,
      });

      return response.data;
    } catch (error) {
      if (error instanceof KakaoUserInfoError) {
        throw error;
      }

      logger.error('Failed to get Kakao user profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new KakaoUserInfoError('Failed to retrieve user profile');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<KakaoTokenResponse> {
    if (!this.isConfigured()) {
      throw new KakaoAuthError('Kakao OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.socialLogin.kakao.clientId,
        client_secret: config.socialLogin.kakao.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await axios.post<KakaoTokenResponse>(
        KAKAO_OAUTH_URLS.TOKEN,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
          },
          timeout: 10000,
        }
      );

      if (response.data.error) {
        throw new KakaoTokenError(response.data.error_description || 'Token refresh failed');
      }

      logger.info('Kakao token refresh successful');

      return response.data;
    } catch (error) {
      if (error instanceof KakaoTokenError) {
        throw error;
      }

      logger.error('Failed to refresh Kakao token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new KakaoTokenError('Failed to refresh token');
    }
  }

  /**
   * Logout user (invalidate access token)
   */
  async logout(accessToken: string): Promise<boolean> {
    try {
      await axios.post(
        KAKAO_OAUTH_URLS.LOGOUT,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        }
      );

      logger.info('Kakao logout successful');
      return true;
    } catch (error) {
      logger.error('Failed to logout from Kakao', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Unlink Kakao account (revoke access)
   */
  async unlink(accessToken: string): Promise<boolean> {
    try {
      await axios.post(
        KAKAO_OAUTH_URLS.UNLINK,
        {},
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        }
      );

      logger.info('Kakao account unlinked successfully');
      return true;
    } catch (error) {
      logger.error('Failed to unlink Kakao account', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }

  /**
   * Authenticate with Kakao and create/update user in database
   */
  async authenticateWithKakao(accessToken: string): Promise<{
    user: UserProfile;
    isNewUser: boolean;
    kakaoUserId: string;
  }> {
    // Get Kakao user profile
    const kakaoUser = await this.getUserProfile(accessToken);

    if (!kakaoUser.id) {
      throw new KakaoAuthError('No user ID returned from Kakao', 'NO_USER_ID', 400);
    }

    const kakaoUserId = kakaoUser.id.toString();

    // Check if user already exists with this Kakao ID
    const { data: existingUser, error: findError } = await this.supabase
      .from('users')
      .select('*')
      .eq('social_provider', 'kakao')
      .eq('social_provider_id', kakaoUserId)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error finding user by Kakao ID', {
        error: findError.message,
        kakaoId: kakaoUserId,
      });
      throw new KakaoAuthError('Database error', 'DB_ERROR', 500);
    }

    if (existingUser) {
      // Update last login and profile image if changed
      const updateData: any = {
        last_login_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      // Update profile image if available
      const newProfileImage = kakaoUser.kakao_account?.profile?.profile_image_url ||
        kakaoUser.properties?.profile_image;
      if (newProfileImage && newProfileImage !== existingUser.profile_image_url) {
        updateData.profile_image_url = newProfileImage;
      }

      await this.supabase
        .from('users')
        .update(updateData)
        .eq('id', existingUser.id);

      logger.info('Existing Kakao user logged in', {
        userId: existingUser.id,
        kakaoId: kakaoUserId,
      });

      return {
        user: existingUser,
        isNewUser: false,
        kakaoUserId,
      };
    }

    // Check if user exists with same email (for linking) - only if email is available
    const kakaoEmail = kakaoUser.kakao_account?.email;
    if (kakaoEmail) {
      const { data: emailUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', kakaoEmail)
        .single();

      if (emailUser) {
        // Link Kakao to existing account
        await this.supabase
          .from('users')
          .update({
            social_provider: 'kakao',
            social_provider_id: kakaoUserId,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', emailUser.id);

        logger.info('Linked Kakao to existing user', {
          userId: emailUser.id,
          kakaoId: kakaoUserId,
        });

        return {
          user: { ...emailUser, social_provider: 'kakao', social_provider_id: kakaoUserId },
          isNewUser: false,
          kakaoUserId,
        };
      }
    }

    // Create new user
    const newUserId = crypto.randomUUID();
    const nickname = kakaoUser.kakao_account?.profile?.nickname ||
      kakaoUser.properties?.nickname ||
      'Kakao User';
    const profileImage = kakaoUser.kakao_account?.profile?.profile_image_url ||
      kakaoUser.properties?.profile_image;

    const newUser = {
      id: newUserId,
      email: kakaoEmail || null,
      name: nickname,
      nickname: nickname,
      profile_image_url: profileImage || null,
      social_provider: 'kakao',
      social_provider_id: kakaoUserId,
      user_role: 'user',
      user_status: 'active',
      is_influencer: false,
      phone_verified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      last_login_at: new Date().toISOString(),
    };

    const { data: createdUser, error: createError } = await this.supabase
      .from('users')
      .insert(newUser)
      .select()
      .single();

    if (createError) {
      logger.error('Failed to create Kakao user', {
        error: createError.message,
        kakaoId: kakaoUserId,
      });
      throw new KakaoAuthError('Failed to create user', 'USER_CREATION_FAILED', 500);
    }

    logger.info('New Kakao user created', {
      userId: createdUser.id,
      kakaoId: kakaoUserId,
    });

    return {
      user: createdUser,
      isNewUser: true,
      kakaoUserId,
    };
  }

  /**
   * Unlink Kakao account from user
   */
  async unlinkKakaoAccount(userId: string, accessToken?: string): Promise<boolean> {
    try {
      // Unlink from Kakao if access token provided
      if (accessToken) {
        await this.unlink(accessToken);
      }

      // Update user to remove Kakao provider
      const { error } = await this.supabase
        .from('users')
        .update({
          social_provider: null,
          social_provider_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('social_provider', 'kakao');

      if (error) {
        logger.error('Failed to unlink Kakao account from database', {
          error: error.message,
          userId,
        });
        return false;
      }

      logger.info('Kakao account unlinked', { userId });

      return true;
    } catch (error) {
      logger.error('Error unlinking Kakao account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    }
  }
}

// Export singleton instance
export const kakaoAuthService = new KakaoAuthService();
export default kakaoAuthService;
