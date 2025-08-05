/**
 * Social Authentication Service
 * 
 * Handles provider-specific token validation and user management
 * for Kakao, Apple, and Google OAuth providers
 */

import axios from 'axios';
import jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  SocialProvider,
  TokenValidationResult,
  KakaoUserInfo,
  AppleUserInfo,
  GoogleUserInfo,
  UserProfile,
  SocialProviderConfig,
  InvalidProviderTokenError,
  ProviderApiError,
  UserCreationError,
  AccountLinkingError,
  SocialAuthService,
  UserProviderLink
} from '../types/social-auth.types';
import { config } from '../config/environment';

/**
 * Social Provider Configuration
 */
const socialConfig: SocialProviderConfig = {
  kakao: {
    restApiKey: process.env.KAKAO_REST_API_KEY || '',
    userInfoUrl: 'https://kapi.kakao.com/v2/user/me',
    tokenInfoUrl: 'https://kapi.kakao.com/v1/user/access_token_info',
    ...(process.env.KAKAO_ADMIN_KEY && { adminKey: process.env.KAKAO_ADMIN_KEY })
  },
  apple: {
    clientId: process.env.APPLE_CLIENT_ID || '',
    teamId: process.env.APPLE_TEAM_ID || '',
    keyId: process.env.APPLE_KEY_ID || '',
    privateKey: process.env.APPLE_PRIVATE_KEY || '',
    publicKeyUrl: 'https://appleid.apple.com/auth/keys'
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    tokenInfoUrl: 'https://www.googleapis.com/oauth2/v1/tokeninfo'
  }
};

/**
 * Apple JWKS client for token verification
 */
const appleJwksClient = jwksClient({
  jwksUri: socialConfig.apple.publicKeyUrl,
  cache: true,
  cacheMaxAge: 86400000, // 24 hours
  rateLimit: true
});

/**
 * Social Authentication Service Implementation
 */
class SocialAuthServiceImpl implements SocialAuthService {
  private supabase = getSupabaseClient();

  /**
   * Validate Kakao access token
   */
  async validateKakaoToken(token: string): Promise<TokenValidationResult> {
    try {
      logger.info('Validating Kakao token', { tokenLength: token.length });

      // First, verify the token is valid by checking token info
      const tokenInfoResponse = await axios.get(socialConfig.kakao.tokenInfoUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      if (!tokenInfoResponse.data || !tokenInfoResponse.data.id) {
        throw new InvalidProviderTokenError('kakao', 'Token validation failed');
      }

      // Get user information
      const userInfoResponse = await axios.get(socialConfig.kakao.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8'
        },
        timeout: 10000
      });

      const userData: KakaoUserInfo = userInfoResponse.data;

      if (!userData.id) {
        throw new InvalidProviderTokenError('kakao', 'User data not found');
      }

      // Extract user information
      const providerUserId = userData.id.toString();
      const email = userData.kakao_account?.email;
      const name = userData.kakao_account?.profile?.nickname || 
                   userData.properties?.nickname || 
                   'Kakao User';
      const profileImageUrl = userData.kakao_account?.profile?.profile_image_url || 
                             userData.properties?.profile_image;

      logger.info('Kakao token validated successfully', { 
        providerUserId,
        hasEmail: !!email,
        hasName: !!name
      });

      const result: TokenValidationResult = {
        isValid: true,
        userData,
        providerUserId
      };

      if (email) {
        result.email = email;
      }
      if (name) {
        result.name = name;
      }
      if (profileImageUrl) {
        result.profileImageUrl = profileImageUrl;
      }

      return result;

    } catch (error) {
      logger.error('Kakao token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenLength: token.length
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new InvalidProviderTokenError('kakao', 'Token expired or invalid');
        }
        throw new ProviderApiError('kakao', error.response?.data?.msg || error.message);
      }

      throw new ProviderApiError('kakao', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate Apple ID token
   */
  async validateAppleToken(token: string): Promise<TokenValidationResult> {
    try {
      logger.info('Validating Apple ID token', { tokenLength: token.length });

      // Decode token header to get key ID
      const decodedHeader = jwt.decode(token, { complete: true });
      if (!decodedHeader || !decodedHeader.header.kid) {
        throw new InvalidProviderTokenError('apple', 'Invalid token format');
      }

      // Get public key from Apple
      const key = await new Promise<string>((resolve, reject) => {
        appleJwksClient.getSigningKey(decodedHeader.header.kid, (err, signingKey) => {
          if (err) {
            reject(err);
            return;
          }
          if (!signingKey) {
            reject(new Error('Failed to get signing key'));
            return;
          }
          resolve(signingKey.getPublicKey());
        });
      });

      // Verify and decode token
      const decoded = jwt.verify(token, key, {
        algorithms: ['RS256'],
        audience: socialConfig.apple.clientId,
        issuer: 'https://appleid.apple.com'
      }) as AppleUserInfo;

      if (!decoded.sub) {
        throw new InvalidProviderTokenError('apple', 'Invalid token payload');
      }

      // Apple doesn't always provide email in subsequent logins
      const providerUserId = decoded.sub;
      const email = decoded.email;
      const name = email ? email.split('@')[0] : 'Apple User';

      logger.info('Apple token validated successfully', { 
        providerUserId,
        hasEmail: !!email
      });

      const result: TokenValidationResult = {
        isValid: true,
        userData: decoded,
        providerUserId
      };

      if (email) {
        result.email = email;
      }
      if (name) {
        result.name = name;
      }

      return result;

    } catch (error) {
      logger.error('Apple token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenLength: token.length
      });

      if (error instanceof jwt.JsonWebTokenError) {
        throw new InvalidProviderTokenError('apple', error.message);
      }

      throw new ProviderApiError('apple', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Validate Google access token
   */
  async validateGoogleToken(token: string): Promise<TokenValidationResult> {
    try {
      logger.info('Validating Google token', { tokenLength: token.length });

      // Verify token with Google
      const tokenInfoResponse = await axios.get(
        `${socialConfig.google.tokenInfoUrl}?access_token=${token}`,
        { timeout: 10000 }
      );

      const tokenInfo = tokenInfoResponse.data;

      // Check if token is valid and belongs to our app
      if (tokenInfo.error || tokenInfo.audience !== socialConfig.google.clientId) {
        throw new InvalidProviderTokenError('google', 'Token validation failed');
      }

      // Get user information
      const userInfoResponse = await axios.get(socialConfig.google.userInfoUrl, {
        headers: {
          'Authorization': `Bearer ${token}`
        },
        timeout: 10000
      });

      const userData: GoogleUserInfo = userInfoResponse.data;

      if (!userData.id) {
        throw new InvalidProviderTokenError('google', 'User data not found');
      }

      const providerUserId = userData.id;
      const email = userData.email;
      const name = userData.name || 'Google User';
      const profileImageUrl = userData.picture;

      logger.info('Google token validated successfully', { 
        providerUserId,
        hasEmail: !!email,
        hasName: !!name
      });

      const result: TokenValidationResult = {
        isValid: true,
        userData,
        providerUserId
      };

      if (email) {
        result.email = email;
      }
      if (name) {
        result.name = name;
      }
      if (profileImageUrl) {
        result.profileImageUrl = profileImageUrl;
      }

      return result;

    } catch (error) {
      logger.error('Google token validation failed', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        tokenLength: token.length
      });

      if (axios.isAxiosError(error)) {
        if (error.response?.status === 401) {
          throw new InvalidProviderTokenError('google', 'Token expired or invalid');
        }
        throw new ProviderApiError('google', error.response?.data?.error_description || error.message);
      }

      throw new ProviderApiError('google', error instanceof Error ? error.message : 'Unknown error');
    }
  }

  /**
   * Get user by provider ID
   */
  async getUserByProviderId(provider: SocialProvider, providerId: string): Promise<UserProfile | null> {
    try {
      logger.info('Looking up user by provider ID', { provider, providerId });

      // First check if we have a provider link
      const { data: providerLink, error: linkError } = await this.supabase
        .from('user_provider_links')
        .select('user_id')
        .eq('provider', provider)
        .eq('provider_user_id', providerId)
        .eq('is_active', true)
        .single();

      if (linkError && linkError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw new Error(`Failed to check provider link: ${linkError.message}`);
      }

      if (!providerLink) {
        logger.info('No existing user found for provider ID', { provider, providerId });
        return null;
      }

      // Get user profile
      const { data: user, error: userError } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          user_role,
          user_status,
          profile_image_url,
          phone,
          birth_date,
          created_at,
          updated_at
        `)
        .eq('id', providerLink.user_id)
        .single();

      if (userError) {
        throw new Error(`Failed to get user: ${userError.message}`);
      }

      logger.info('User found by provider ID', { 
        provider, 
        providerId, 
        userId: user.id,
        userStatus: user.user_status
      });

      return user;

    } catch (error) {
      logger.error('Failed to get user by provider ID', { 
        provider, 
        providerId, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Create or update user from provider data
   */
  async createOrUpdateUser(provider: SocialProvider, validationResult: TokenValidationResult): Promise<UserProfile> {
    try {
      logger.info('Creating or updating user', { 
        provider, 
        providerUserId: validationResult.providerUserId,
        hasEmail: !!validationResult.email
      });

      // Check if user exists by email (if available)
      let existingUser: UserProfile | null = null;
      
      if (validationResult.email) {
        const { data: userByEmail, error } = await this.supabase
          .from('users')
          .select(`
            id,
            email,
            name,
            user_role,
            user_status,
            profile_image_url,
            phone,
            birth_date,
            created_at,
            updated_at
          `)
          .eq('email', validationResult.email)
          .single();

        if (!error) {
          existingUser = userByEmail;
        }
      }

      let user: UserProfile;

      if (existingUser) {
        // Update existing user
        const updateData: Partial<UserProfile> = {};
        
        if (validationResult.name && validationResult.name !== existingUser.name) {
          updateData.name = validationResult.name;
        }
        
        if (validationResult.profileImageUrl && validationResult.profileImageUrl !== existingUser.profile_image_url) {
          updateData.profile_image_url = validationResult.profileImageUrl;
        }

        if (Object.keys(updateData).length > 0) {
          const { data: updatedUser, error } = await this.supabase
            .from('users')
            .update({
              ...updateData,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingUser.id)
            .select()
            .single();

          if (error) {
            throw new UserCreationError(`Failed to update user: ${error.message}`);
          }

          user = updatedUser;
        } else {
          user = existingUser;
        }

        logger.info('Updated existing user', { userId: user.id, provider });

      } else {
        // Create new user
        const newUser = {
          email: validationResult.email || null,
          name: validationResult.name || `${provider} User`,
          user_role: 'user' as const,
          user_status: 'active' as const,
          profile_image_url: validationResult.profileImageUrl || null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        const { data: createdUser, error } = await this.supabase
          .from('users')
          .insert(newUser)
          .select()
          .single();

        if (error) {
          throw new UserCreationError(`Failed to create user: ${error.message}`);
        }

        user = createdUser;
        logger.info('Created new user', { userId: user.id, provider });
      }

      // Link provider account
      await this.linkProviderAccount(user.id, provider, validationResult.providerUserId);

      return user;

    } catch (error) {
      logger.error('Failed to create or update user', { 
        provider, 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Link provider account to user
   */
  async linkProviderAccount(userId: string, provider: SocialProvider, providerId: string): Promise<void> {
    try {
      logger.info('Linking provider account', { userId, provider, providerId });

      // Check if link already exists
      const { data: existingLink } = await this.supabase
        .from('user_provider_links')
        .select('id, is_active')
        .eq('user_id', userId)
        .eq('provider', provider)
        .eq('provider_user_id', providerId)
        .single();

      if (existingLink) {
        if (!existingLink.is_active) {
          // Reactivate existing link
          const { error } = await this.supabase
            .from('user_provider_links')
            .update({
              is_active: true,
              last_used_at: new Date().toISOString()
            })
            .eq('id', existingLink.id);

          if (error) {
            throw new AccountLinkingError(provider, `Failed to reactivate link: ${error.message}`);
          }

          logger.info('Reactivated provider link', { userId, provider });
        } else {
          // Just update last used timestamp
          const { error } = await this.supabase
            .from('user_provider_links')
            .update({
              last_used_at: new Date().toISOString()
            })
            .eq('id', existingLink.id);

          if (error) {
            logger.warn('Failed to update last_used_at', { error: error.message });
          }
        }
        return;
      }

      // Create new link
      const linkData: Omit<UserProviderLink, 'id'> = {
        user_id: userId,
        provider,
        provider_user_id: providerId,
        linked_at: new Date().toISOString(),
        last_used_at: new Date().toISOString(),
        is_active: true
      };

      const { error } = await this.supabase
        .from('user_provider_links')
        .insert(linkData);

      if (error) {
        throw new AccountLinkingError(provider, `Failed to create link: ${error.message}`);
      }

      logger.info('Created new provider link', { userId, provider });

    } catch (error) {
      logger.error('Failed to link provider account', { 
        userId, 
        provider, 
        providerId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Validate provider configuration
   */
  validateConfiguration(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Check Kakao configuration
    if (!socialConfig.kakao.restApiKey) {
      errors.push('KAKAO_REST_API_KEY is required');
    }

    // Check Apple configuration
    if (!socialConfig.apple.clientId) {
      errors.push('APPLE_CLIENT_ID is required');
    }
    if (!socialConfig.apple.teamId) {
      errors.push('APPLE_TEAM_ID is required');
    }
    if (!socialConfig.apple.keyId) {
      errors.push('APPLE_KEY_ID is required');
    }
    if (!socialConfig.apple.privateKey) {
      errors.push('APPLE_PRIVATE_KEY is required');
    }

    // Check Google configuration
    if (!socialConfig.google.clientId) {
      errors.push('GOOGLE_CLIENT_ID is required');
    }
    if (!socialConfig.google.clientSecret) {
      errors.push('GOOGLE_CLIENT_SECRET is required');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export singleton instance
export const socialAuthService = new SocialAuthServiceImpl();

// Export class for testing
export { SocialAuthServiceImpl }; 