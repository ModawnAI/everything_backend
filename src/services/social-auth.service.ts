/**
 * Social Authentication Service
 * 
 * Handles Supabase Auth integration for social login providers
 * (Kakao, Apple, and Google OAuth providers)
 */

import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';
import {
  SocialProvider,
  TokenValidationResult,
  UserProfile,
  InvalidProviderTokenError,
  ProviderApiError,
  UserCreationError,
  AccountLinkingError,
  SocialAuthService,
  UserProviderLink
} from '../types/social-auth.types';
import { config } from '../config/environment';

/**
 * Supabase Auth Social Authentication Service Implementation
 */
class SupabaseSocialAuthService implements SocialAuthService {
  private supabase = getSupabaseClient();

  /**
   * Authenticate user with social provider using Supabase Auth
   */
  async authenticateWithProvider(
    provider: SocialProvider,
    supabaseAccessToken: string,
    accessToken?: string
  ): Promise<{
    user: any;
    session: any;
    supabaseUser: UserProfile | null;
  }> {
    try {
      logger.info('🔐 [SERVICE] authenticateWithProvider called', {
        provider,
        hasSupabaseToken: !!supabaseAccessToken,
        tokenLength: supabaseAccessToken?.length || 0,
        tokenPreview: supabaseAccessToken?.substring(0, 20) + '...'
      });

      // Verify the Supabase access token and get user info
      logger.info('🔍 [SERVICE] Verifying Supabase access token', { provider });

      const { data: { user }, error } = await this.supabase.auth.getUser(supabaseAccessToken);

      logger.info('📬 [SERVICE] Supabase getUser response', {
        provider,
        hasUser: !!user,
        hasError: !!error,
        userId: user?.id,
        email: user?.email,
        errorMessage: error?.message
      });

      if (error) {
        logger.error('❌ [SERVICE] Supabase token verification failed', {
          error: error.message,
          provider,
          errorDetails: error
        });

        // Enhanced error handling based on error type
        if (error.message.includes('Invalid token') || error.message.includes('JWT')) {
          throw new InvalidProviderTokenError(provider, 'Invalid or expired Supabase token');
        } else if (error.message.includes('Network')) {
          throw new ProviderApiError(provider, 'Network error during token verification');
        } else if (error.message.includes('Rate limit')) {
          throw new ProviderApiError(provider, 'Rate limit exceeded');
        }

        throw new ProviderApiError(provider, error.message);
      }

      if (!user) {
        logger.error('❌ [SERVICE] No user returned from Supabase', { provider });
        throw new ProviderApiError(provider, 'No user returned from Supabase token verification');
      }

      // Verify the user authenticated via the expected provider
      const userProvider = user.app_metadata?.provider || user.app_metadata?.providers?.[0];
      logger.info('🔍 [SERVICE] User provider verification', {
        expectedProvider: provider,
        actualProvider: userProvider,
        allProviders: user.app_metadata?.providers
      });

      // Additional user validation
      if (!user.email && provider !== 'apple') {
        logger.warn('No email provided by social provider', { provider, userId: user.id });
      }

      logger.info('✅ [SERVICE] Supabase token verification successful', {
        userId: user.id,
        provider,
        email: user.email,
        userProvider: userProvider
      });

      // Get or create user profile in our database
      const userProfile = await this.getOrCreateUserProfile(user, provider);

      // Create a mock session object for compatibility
      const session = {
        access_token: supabaseAccessToken,
        token_type: 'bearer',
        user: user
      };

      return {
        user: user,
        session: session,
        supabaseUser: userProfile
      };

    } catch (error) {
      logger.error('❌ [SERVICE] Social authentication failed', {
        provider,
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Basic Supabase token validation
   * NOTE: Detailed validation is done by Supabase's getUser() API
   */
  private validateSupabaseToken(token: string, provider: SocialProvider): void {
    // Basic token format validation
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      throw new InvalidProviderTokenError(provider, 'Invalid token format');
    }

    // Check if it looks like a JWT (Supabase tokens are JWTs)
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new InvalidProviderTokenError(
        provider,
        'Invalid Supabase token format - must be a valid JWT'
      );
    }

    logger.info('✅ [SERVICE] Basic Supabase token format validation passed', {
      provider,
      tokenLength: token.length
    });
  }

  /**
   * DEPRECATED: No longer used with Supabase OAuth flow
   * Validate Google ID token format
   */
  private async validateGoogleTokenFormat_DEPRECATED(idToken: string): Promise<void> {
    logger.info('Validating Google token format', {
      tokenLength: idToken.length,
      tokenPrefix: idToken.substring(0, 20) + '...'
    });

    // Google ID tokens are JWTs with 3 parts separated by dots
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      logger.error('Google token format validation failed: incorrect number of parts', {
        partsCount: parts.length
      });
      throw new InvalidProviderTokenError('google', 'Invalid Google ID token format - must have 3 parts');
    }

    logger.info('Google token has correct structure (3 parts)');

    try {
      // Decode header and payload (without verification for format check)
      // Use base64 with URL-safe character conversion for compatibility
      const base64UrlToBase64 = (base64url: string): string => {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        // Add padding if needed
        const padding = base64.length % 4;
        if (padding > 0) {
          base64 += '='.repeat(4 - padding);
        }
        return base64;
      };

      logger.debug('Decoding Google token header and payload');

      const header = JSON.parse(Buffer.from(base64UrlToBase64(parts[0]), 'base64').toString());
      const payload = JSON.parse(Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString());

      logger.info('Google token decoded successfully', {
        header: { alg: header.alg, typ: header.typ },
        payload: {
          iss: payload.iss,
          aud: payload.aud?.substring(0, 20) + '...',
          exp: payload.exp,
          email: payload.email
        }
      });

      // Basic JWT structure validation
      if (!header.alg || !header.typ) {
        logger.error('Google token header validation failed', {
          hasAlg: !!header.alg,
          hasTyp: !!header.typ
        });
        throw new InvalidProviderTokenError('google', 'Invalid Google token header - missing alg or typ');
      }

      if (!payload.iss || !payload.aud || !payload.exp) {
        logger.error('Google token payload validation failed', {
          hasIss: !!payload.iss,
          hasAud: !!payload.aud,
          hasExp: !!payload.exp
        });
        throw new InvalidProviderTokenError('google', 'Invalid Google token payload - missing required fields');
      }

      // Check if token is expired (basic check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        logger.error('Google token expired', {
          exp: payload.exp,
          now: now,
          expiredBy: now - payload.exp
        });
        throw new InvalidProviderTokenError('google', 'Google token has expired');
      }

      logger.info('Google token validation successful', { exp: payload.exp, now: now });

    } catch (error) {
      if (error instanceof InvalidProviderTokenError) {
        throw error;
      }
      logger.error('Google token parsing error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new InvalidProviderTokenError('google', `Failed to parse Google token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DEPRECATED: No longer used with Supabase OAuth flow
   * Validate Apple ID token format
   */
  private async validateAppleTokenFormat_DEPRECATED(idToken: string): Promise<void> {
    logger.info('Validating Apple token format', {
      tokenLength: idToken.length,
      tokenPrefix: idToken.substring(0, 20) + '...'
    });

    // Apple ID tokens are also JWTs
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      logger.error('Apple token format validation failed: incorrect number of parts', {
        partsCount: parts.length
      });
      throw new InvalidProviderTokenError('apple', 'Invalid Apple ID token format - must have 3 parts');
    }

    logger.info('Apple token has correct structure (3 parts)');

    try {
      // Use base64 with URL-safe character conversion for compatibility
      const base64UrlToBase64 = (base64url: string): string => {
        let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
        const padding = base64.length % 4;
        if (padding > 0) {
          base64 += '='.repeat(4 - padding);
        }
        return base64;
      };

      logger.debug('Decoding Apple token header and payload');

      const header = JSON.parse(Buffer.from(base64UrlToBase64(parts[0]), 'base64').toString());
      const payload = JSON.parse(Buffer.from(base64UrlToBase64(parts[1]), 'base64').toString());

      logger.info('Apple token decoded successfully', {
        header: { alg: header.alg, kid: header.kid },
        payload: {
          iss: payload.iss,
          aud: payload.aud,
          exp: payload.exp,
          email: payload.email
        }
      });

      if (!header.alg || !header.kid) {
        logger.error('Apple token header validation failed', {
          hasAlg: !!header.alg,
          hasKid: !!header.kid
        });
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token header - missing alg or kid');
      }

      if (!payload.iss || !payload.aud || !payload.exp) {
        logger.error('Apple token payload validation failed', {
          hasIss: !!payload.iss,
          hasAud: !!payload.aud,
          hasExp: !!payload.exp
        });
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token payload - missing required fields');
      }

      // Check issuer
      if (payload.iss !== 'https://appleid.apple.com') {
        logger.error('Apple token issuer validation failed', {
          actualIss: payload.iss,
          expectedIss: 'https://appleid.apple.com'
        });
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token issuer');
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        logger.error('Apple token expired', {
          exp: payload.exp,
          now: now,
          expiredBy: now - payload.exp
        });
        throw new InvalidProviderTokenError('apple', 'Apple token has expired');
      }

      logger.info('Apple token validation successful', { exp: payload.exp, now: now });

    } catch (error) {
      if (error instanceof InvalidProviderTokenError) {
        throw error;
      }
      logger.error('Apple token parsing error', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
      throw new InvalidProviderTokenError('apple', `Failed to parse Apple token: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * DEPRECATED: No longer used with Supabase OAuth flow
   * Validate Kakao token format
   */
  private async validateKakaoTokenFormat_DEPRECATED(idToken: string, accessToken?: string): Promise<void> {
    logger.info('Validating Kakao token format', {
      tokenLength: idToken.length,
      hasAccessToken: !!accessToken,
      tokenPrefix: idToken.substring(0, 20) + '...'
    });

    // Kakao tokens are typically opaque strings
    if (idToken.length < 10) {
      logger.error('Kakao token too short', { tokenLength: idToken.length });
      throw new InvalidProviderTokenError('kakao', 'Kakao token too short - must be at least 10 characters');
    }

    // Basic format validation - Kakao tokens are usually alphanumeric
    const kakaoTokenPattern = /^[a-zA-Z0-9_-]+$/;
    if (!kakaoTokenPattern.test(idToken)) {
      logger.error('Kakao token format validation failed', {
        tokenSample: idToken.substring(0, 20) + '...'
      });
      throw new InvalidProviderTokenError('kakao', 'Invalid Kakao token format - must be alphanumeric with _ or -');
    }

    logger.info('Kakao ID token format valid');

    // If access token is provided, validate it too
    if (accessToken) {
      if (!kakaoTokenPattern.test(accessToken)) {
        logger.error('Kakao access token format validation failed');
        throw new InvalidProviderTokenError('kakao', 'Invalid Kakao access token format - must be alphanumeric with _ or -');
      }
      logger.info('Kakao access token format valid');
    }

    logger.info('Kakao token validation successful');
  }

  /**
   * Sign out user from Supabase Auth
   */
  async signOut(): Promise<void> {
    try {
      const { error } = await this.supabase.auth.signOut();
      if (error) {
        logger.error('Supabase signout error', { error: error.message });
        throw new Error(`Sign out failed: ${error.message}`);
      }
      logger.info('User signed out successfully');
    } catch (error) {
      logger.error('Sign out failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Refresh authentication session
   */
  async refreshSession(refreshToken: string): Promise<{ user: any; session: any }> {
    try {
      const { data, error } = await this.supabase.auth.refreshSession({
        refresh_token: refreshToken
      });

      if (error) {
        logger.error('Session refresh error', { error: error.message });
        throw new Error(`Session refresh failed: ${error.message}`);
      }

      return {
        user: data.user,
        session: data.session
      };

    } catch (error) {
      logger.error('Session refresh failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get current authenticated user
   */
  async getCurrentUser(): Promise<any> {
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      
      if (error) {
        logger.error('Get current user error', { error: error.message });
        throw new Error(`Failed to get current user: ${error.message}`);
      }

      return user;
    } catch (error) {
      logger.error('Get current user failed', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
    }
  }

  /**
   * Get or create user profile in our database with provider-specific compliance
   */
  private async getOrCreateUserProfile(supabaseUser: any, provider: SocialProvider): Promise<UserProfile> {
    try {
      // First, try to get existing user
      const { data: existingUser, error: getUserError } = await this.supabase
        .from('users')
        .select(`
          id,
          email,
          name,
          created_at,
          updated_at
        `)
        .eq('id', supabaseUser.id)
        .single();

      if (!getUserError && existingUser) {
        logger.info('Existing user found', { userId: existingUser.id });
        
        // Sync profile data from provider if needed
        await this.syncProviderProfile(existingUser.id, supabaseUser, provider);
        
        return existingUser;
      }

      // Create new user if not exists with provider-specific data mapping
      logger.info('Creating new user profile', { 
        userId: supabaseUser.id, 
        email: supabaseUser.email,
        provider 
      });

      const profileData = this.mapProviderProfileData(supabaseUser, provider);
      const newUser = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        ...profileData
        // Note: Only include fields that exist in users table schema
        // user_role, user_status, is_influencer, phone_verified removed - not in current schema
      };

      const { data: createdUser, error: createError } = await this.supabase
        .from('users')
        .insert(newUser)
        .select()
        .single();

      if (createError) {
        logger.error('Failed to create user profile', { 
          error: createError.message,
          userId: supabaseUser.id 
        });
        throw new UserCreationError(`Failed to create user profile: ${createError.message}`);
      }

      // Create provider link with compliance metadata
      await this.createProviderLinkWithCompliance(supabaseUser.id, provider, supabaseUser.id, supabaseUser);

      logger.info('New user profile created successfully', { userId: createdUser.id });
      return createdUser;

    } catch (error) {
      logger.error('Failed to get or create user profile', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: supabaseUser.id 
      });
      throw error;
    }
  }

  /**
   * Map provider-specific profile data with compliance requirements
   */
  private mapProviderProfileData(supabaseUser: any, provider: SocialProvider): any {
    const metadata = supabaseUser.user_metadata || {};

    switch (provider) {
      case 'kakao':
        return {
          name: metadata.kakao_account?.profile?.nickname ||
                metadata.name ||
                'Kakao User'
          // Note: phone, birth_date, provider_compliance removed - not in users table schema
          // Store provider-specific data in user_metadata if needed
        };

      case 'apple':
        return {
          name: metadata.full_name ||
                `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() ||
                'Apple User'
          // Note: phone, birth_date, provider_compliance removed - not in users table schema
          // Store provider-specific data in user_metadata if needed
        };

      case 'google':
        return {
          name: metadata.full_name ||
                metadata.name ||
                'Google User'
          // Note: phone, birth_date, provider_compliance removed - not in users table schema
          // profile_image_url removed - not in current users table schema
          // Store provider-specific data in user_metadata if needed
        };

      default:
        return {
          name: metadata.full_name ||
                metadata.name ||
                'User'
          // Note: phone, birth_date, provider_compliance removed - not in users table schema
        };
    }
  }

  /**
   * Sync provider profile data for existing users
   */
  private async syncProviderProfile(userId: string, supabaseUser: any, provider: SocialProvider): Promise<void> {
    try {
      const profileData = this.mapProviderProfileData(supabaseUser, provider);

      // Only update fields that are allowed to be synced and not manually overridden by user
      const updateData: any = {};

      // Update name if it changed from provider
      if (profileData.name) {
        const { data: currentUser } = await this.supabase
          .from('users')
          .select('name')
          .eq('id', userId)
          .single();

        if (currentUser && currentUser.name !== profileData.name) {
          updateData.name = profileData.name;
        }
      }

      if (Object.keys(updateData).length > 0) {
        updateData.updated_at = new Date().toISOString();

        const { error } = await this.supabase
          .from('users')
          .update(updateData)
          .eq('id', userId);

        if (error) {
          logger.error('Failed to sync provider profile', {
            error: error.message,
            userId,
            provider
          });
        } else {
          logger.info('Provider profile synced successfully', { userId, provider });
        }
      }

    } catch (error) {
      logger.error('Error syncing provider profile', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        provider
      });
    }
  }

  /**
   * Create provider link with compliance metadata
   */
  private async createProviderLinkWithCompliance(
    userId: string, 
    provider: SocialProvider, 
    providerId: string, 
    supabaseUser: any
  ): Promise<void> {
    try {
      const metadata = supabaseUser.user_metadata || {};
      const complianceData = this.getProviderComplianceData(provider, metadata);
      
      const { error } = await this.supabase
        .from('user_provider_links')
        .insert({
          user_id: userId,
          provider,
          provider_user_id: providerId,
          is_active: true,
          linked_at: new Date().toISOString(),
          compliance_data: complianceData,
          last_sync_at: new Date().toISOString()
        });

      if (error) {
        logger.error('Failed to create provider link with compliance', { 
          error: error.message,
          userId,
          provider 
        });
        // Fallback to basic provider link
        await this.createProviderLink(userId, provider, providerId);
      } else {
        logger.info('Provider link with compliance created', { userId, provider });
      }
    } catch (error) {
      logger.error('Error creating provider link with compliance', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        provider 
      });
      // Fallback to basic provider link
      await this.createProviderLink(userId, provider, providerId);
    }
  }

  /**
   * Get provider-specific compliance data
   */
  private getProviderComplianceData(provider: SocialProvider, metadata: any): any {
    switch (provider) {
      case 'kakao':
        return {
          service_terms_version: metadata.kakao_account?.service_terms_version || null,
          privacy_policy_version: metadata.kakao_account?.privacy_policy_version || null,
          consented_scopes: metadata.kakao_account?.scopes || [],
          profile_sync_allowed: !metadata.kakao_account?.profile_nickname_needs_agreement,
          image_sync_allowed: !metadata.kakao_account?.profile_image_needs_agreement
        };
        
      case 'apple':
        return {
          real_user_status: metadata.real_user_status || 'unknown',
          is_private_email: metadata.is_private_email || false,
          transfer_sub: metadata.transfer_sub || null,
          authorized_scopes: metadata.authorized_scopes || []
        };
        
      case 'google':
        return {
          email_verified: metadata.email_verified || false,
          locale: metadata.locale || null,
          hosted_domain: metadata.hd || null,
          granted_scopes: metadata.granted_scopes || []
        };
        
      default:
        return {};
    }
  }

  /**
   * Create provider link for tracking social login providers
   */
  private async createProviderLink(
    userId: string, 
    provider: SocialProvider, 
    providerId: string
  ): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('user_provider_links')
        .insert({
          user_id: userId,
          provider,
          provider_user_id: providerId,
          is_active: true
        });

      if (error) {
        logger.error('Failed to create provider link', { 
          error: error.message,
          userId,
          provider 
        });
        // Don't throw error here as user creation should succeed
      } else {
        logger.info('Provider link created', { userId, provider });
      }
    } catch (error) {
      logger.error('Error creating provider link', { 
        error: error instanceof Error ? error.message : 'Unknown error',
        userId,
        provider 
      });
    }
  }

  /**
   * Map our provider enum to Supabase provider names
   */
  private mapProviderToSupabase(provider: SocialProvider): string {
    const providerMap = {
      google: 'google',
      apple: 'apple',
      kakao: 'kakao'  // Note: Kakao might need custom implementation
    };

    return providerMap[provider] || provider;
  }

  // Legacy methods for backward compatibility
  async validateKakaoToken(token: string): Promise<TokenValidationResult> {
    throw new Error('Use authenticateWithProvider instead');
  }

  async validateAppleToken(token: string): Promise<TokenValidationResult> {
    throw new Error('Use authenticateWithProvider instead');
  }

  async validateGoogleToken(token: string): Promise<TokenValidationResult> {
    throw new Error('Use authenticateWithProvider instead');
  }

  async getUserByProviderId(provider: SocialProvider, providerId: string): Promise<UserProfile | null> {
    try {
      const { data: providerLink, error: linkError } = await this.supabase
        .from('user_provider_links')
        .select('user_id')
        .eq('provider', provider)
        .eq('provider_user_id', providerId)
        .eq('is_active', true)
        .single();

      if (linkError && linkError.code !== 'PGRST116') {
        throw new Error(`Failed to check provider link: ${linkError.message}`);
      }

      if (!providerLink) {
        return null;
      }

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

  async createOrUpdateUser(provider: SocialProvider, validationResult: TokenValidationResult): Promise<UserProfile> {
    throw new Error('Use authenticateWithProvider instead');
  }

  async linkProviderAccount(userId: string, provider: SocialProvider, providerId: string): Promise<void> {
    await this.createProviderLink(userId, provider, providerId);
  }
}

// Export singleton instance
export const socialAuthService = new SupabaseSocialAuthService();
export default socialAuthService;