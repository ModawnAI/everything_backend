/**
 * Naver OAuth Authentication Service
 *
 * Handles Naver OAuth 2.0 authentication flow
 * - Authorization URL generation
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
  NaverTokenResponse,
  NaverUserProfile,
  NaverUserInfo,
  NaverOAuthState,
  NaverAuthError,
  NaverTokenError,
  NaverUserInfoError,
  NAVER_OAUTH_URLS,
} from '../types/naver-auth.types';
import { UserProfile } from '../types/social-auth.types';

class NaverAuthService {
  private supabase = getSupabaseClient();

  /**
   * Check if Naver OAuth is configured
   */
  isConfigured(): boolean {
    return !!(
      config.socialLogin.naver?.clientId &&
      config.socialLogin.naver?.clientSecret
    );
  }

  /**
   * Generate authorization URL for Naver OAuth
   */
  getAuthorizationUrl(returnUrl?: string): { url: string; state: string } {
    if (!this.isConfigured()) {
      throw new NaverAuthError('Naver OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    // Generate state for CSRF protection
    const stateData: NaverOAuthState = {
      nonce: crypto.randomBytes(16).toString('hex'),
      timestamp: Date.now(),
      returnUrl,
    };
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.socialLogin.naver.clientId,
      redirect_uri: config.socialLogin.naver.callbackUrl || `${process.env.APP_URL}/api/auth/naver/callback`,
      state,
    });

    const url = `${NAVER_OAUTH_URLS.AUTHORIZATION}?${params.toString()}`;

    logger.info('Generated Naver authorization URL', {
      hasReturnUrl: !!returnUrl,
      stateNonce: stateData.nonce.substring(0, 8) + '...',
    });

    return { url, state };
  }

  /**
   * Validate state parameter to prevent CSRF
   */
  validateState(state: string): NaverOAuthState | null {
    try {
      const decoded = Buffer.from(state, 'base64url').toString();
      const stateData: NaverOAuthState = JSON.parse(decoded);

      // Check if state is too old (10 minutes expiry)
      const maxAge = 10 * 60 * 1000; // 10 minutes
      if (Date.now() - stateData.timestamp > maxAge) {
        logger.warn('Naver OAuth state expired', {
          stateAge: Date.now() - stateData.timestamp,
        });
        return null;
      }

      return stateData;
    } catch (error) {
      logger.error('Failed to validate Naver OAuth state', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return null;
    }
  }

  /**
   * Exchange authorization code for access token
   */
  async exchangeCodeForToken(code: string): Promise<NaverTokenResponse> {
    if (!this.isConfigured()) {
      throw new NaverAuthError('Naver OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: config.socialLogin.naver.clientId,
        client_secret: config.socialLogin.naver.clientSecret,
        code,
      });

      const response = await axios.post<NaverTokenResponse>(
        NAVER_OAUTH_URLS.TOKEN,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      if (response.data.error) {
        logger.error('Naver token exchange error', {
          error: response.data.error,
          description: response.data.error_description,
        });
        throw new NaverTokenError(response.data.error_description || 'Token exchange failed');
      }

      logger.info('Naver token exchange successful', {
        expiresIn: response.data.expires_in,
      });

      return response.data;
    } catch (error) {
      if (error instanceof NaverTokenError) {
        throw error;
      }

      logger.error('Failed to exchange Naver authorization code', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new NaverTokenError('Failed to exchange authorization code');
    }
  }

  /**
   * Get user profile using access token
   */
  async getUserProfile(accessToken: string): Promise<NaverUserInfo> {
    try {
      const response = await axios.get<NaverUserProfile>(
        NAVER_OAUTH_URLS.USER_INFO,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          timeout: 10000,
        }
      );

      if (response.data.resultcode !== '00') {
        logger.error('Naver user info error', {
          resultcode: response.data.resultcode,
          message: response.data.message,
        });
        throw new NaverUserInfoError(response.data.message || 'Failed to get user info');
      }

      logger.info('Naver user profile retrieved', {
        userId: response.data.response.id,
        hasEmail: !!response.data.response.email,
        hasName: !!response.data.response.name,
      });

      return response.data.response;
    } catch (error) {
      if (error instanceof NaverUserInfoError) {
        throw error;
      }

      logger.error('Failed to get Naver user profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new NaverUserInfoError('Failed to retrieve user profile');
    }
  }

  /**
   * Refresh access token using refresh token
   */
  async refreshToken(refreshToken: string): Promise<NaverTokenResponse> {
    if (!this.isConfigured()) {
      throw new NaverAuthError('Naver OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: config.socialLogin.naver.clientId,
        client_secret: config.socialLogin.naver.clientSecret,
        refresh_token: refreshToken,
      });

      const response = await axios.post<NaverTokenResponse>(
        NAVER_OAUTH_URLS.TOKEN,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      if (response.data.error) {
        throw new NaverTokenError(response.data.error_description || 'Token refresh failed');
      }

      logger.info('Naver token refresh successful');

      return response.data;
    } catch (error) {
      if (error instanceof NaverTokenError) {
        throw error;
      }

      logger.error('Failed to refresh Naver token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw new NaverTokenError('Failed to refresh token');
    }
  }

  /**
   * Revoke access token (unlink/logout)
   */
  async revokeToken(accessToken: string): Promise<boolean> {
    if (!this.isConfigured()) {
      throw new NaverAuthError('Naver OAuth is not configured', 'NOT_CONFIGURED', 500);
    }

    try {
      const params = new URLSearchParams({
        grant_type: 'delete',
        client_id: config.socialLogin.naver.clientId,
        client_secret: config.socialLogin.naver.clientSecret,
        access_token: accessToken,
        service_provider: 'NAVER',
      });

      const response = await axios.post(
        NAVER_OAUTH_URLS.TOKEN,
        params.toString(),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          timeout: 10000,
        }
      );

      logger.info('Naver token revoked successfully');

      return response.data.result === 'success';
    } catch (error) {
      logger.error('Failed to revoke Naver token', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      return false;
    }
  }

  /**
   * Authenticate with Naver and create/update user in database
   */
  async authenticateWithNaver(accessToken: string): Promise<{
    user: UserProfile;
    isNewUser: boolean;
    naverUserId: string;
  }> {
    // Get Naver user profile
    const naverUser = await this.getUserProfile(accessToken);

    if (!naverUser.id) {
      throw new NaverAuthError('No user ID returned from Naver', 'NO_USER_ID', 400);
    }

    // Check if user already exists with this Naver ID
    const { data: existingUser, error: findError } = await this.supabase
      .from('users')
      .select('*')
      .eq('social_provider', 'naver')
      .eq('social_provider_id', naverUser.id)
      .single();

    if (findError && findError.code !== 'PGRST116') {
      logger.error('Error finding user by Naver ID', {
        error: findError.message,
        naverId: naverUser.id,
      });
      throw new NaverAuthError('Database error', 'DB_ERROR', 500);
    }

    if (existingUser) {
      // Update last login
      await this.supabase
        .from('users')
        .update({
          last_login_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingUser.id);

      logger.info('Existing Naver user logged in', {
        userId: existingUser.id,
        naverId: naverUser.id,
      });

      return {
        user: existingUser,
        isNewUser: false,
        naverUserId: naverUser.id,
      };
    }

    // Check if user exists with same email (for linking)
    if (naverUser.email) {
      const { data: emailUser } = await this.supabase
        .from('users')
        .select('*')
        .eq('email', naverUser.email)
        .single();

      if (emailUser) {
        // Link Naver to existing account
        await this.supabase
          .from('users')
          .update({
            social_provider: 'naver',
            social_provider_id: naverUser.id,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', emailUser.id);

        logger.info('Linked Naver to existing user', {
          userId: emailUser.id,
          naverId: naverUser.id,
        });

        return {
          user: { ...emailUser, social_provider: 'naver', social_provider_id: naverUser.id },
          isNewUser: false,
          naverUserId: naverUser.id,
        };
      }
    }

    // Create new user
    const newUserId = crypto.randomUUID();
    const newUser = {
      id: newUserId,
      email: naverUser.email,
      name: naverUser.name || naverUser.nickname || 'Naver User',
      nickname: naverUser.nickname,
      profile_image_url: naverUser.profile_image,
      phone_number: naverUser.mobile?.replace(/-/g, ''),
      birth_date: this.parseNaverBirthday(naverUser.birthyear, naverUser.birthday),
      gender: this.mapNaverGender(naverUser.gender),
      social_provider: 'naver',
      social_provider_id: naverUser.id,
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
      logger.error('Failed to create Naver user', {
        error: createError.message,
        naverId: naverUser.id,
      });
      throw new NaverAuthError('Failed to create user', 'USER_CREATION_FAILED', 500);
    }

    logger.info('New Naver user created', {
      userId: createdUser.id,
      naverId: naverUser.id,
    });

    return {
      user: createdUser,
      isNewUser: true,
      naverUserId: naverUser.id,
    };
  }

  /**
   * Unlink Naver account from user
   */
  async unlinkNaverAccount(userId: string, accessToken?: string): Promise<boolean> {
    try {
      // Revoke token if provided
      if (accessToken) {
        await this.revokeToken(accessToken);
      }

      // Update user to remove Naver provider
      const { error } = await this.supabase
        .from('users')
        .update({
          social_provider: null,
          social_provider_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('social_provider', 'naver');

      if (error) {
        logger.error('Failed to unlink Naver account', {
          error: error.message,
          userId,
        });
        return false;
      }

      logger.info('Naver account unlinked', { userId });

      return true;
    } catch (error) {
      logger.error('Error unlinking Naver account', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
      });
      return false;
    }
  }

  /**
   * Parse Naver birthday format to ISO date string
   */
  private parseNaverBirthday(birthyear?: string, birthday?: string): string | null {
    if (!birthyear || !birthday) {
      return null;
    }

    try {
      // birthday format: MM-DD
      const [month, day] = birthday.split('-');
      return `${birthyear}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
    } catch {
      return null;
    }
  }

  /**
   * Map Naver gender to our format
   */
  private mapNaverGender(gender?: 'M' | 'F' | 'U'): string | null {
    switch (gender) {
      case 'M':
        return 'male';
      case 'F':
        return 'female';
      default:
        return null;
    }
  }
}

// Export singleton instance
export const naverAuthService = new NaverAuthService();
export default naverAuthService;
