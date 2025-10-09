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
    idToken: string, 
    accessToken?: string
  ): Promise<{
    user: any;
    session: any;
    supabaseUser: UserProfile | null;
  }> {
    try {
      logger.info('Authenticating with Supabase Auth', { provider });

      // Enhanced token validation
      await this.validateProviderToken(provider, idToken, accessToken);

      // Use Supabase's signInWithIdToken for social auth
      const { data, error } = await this.supabase.auth.signInWithIdToken({
        provider: this.mapProviderToSupabase(provider),
        token: idToken,
        ...(accessToken && { access_token: accessToken })
      });

      if (error) {
        logger.error('Supabase Auth error', { error: error.message, provider });
        
        // Enhanced error handling based on error type
        if (error.message.includes('Invalid token')) {
          throw new InvalidProviderTokenError(provider, 'Token validation failed');
        } else if (error.message.includes('Network')) {
          throw new ProviderApiError(provider, 'Network error during authentication');
        } else if (error.message.includes('Rate limit')) {
          throw new ProviderApiError(provider, 'Rate limit exceeded');
        }
        
        throw new ProviderApiError(provider, error.message);
      }

      if (!data.user) {
        throw new ProviderApiError(provider, 'No user returned from Supabase Auth');
      }

      // Additional user validation
      if (!data.user.email && provider !== 'apple') {
        logger.warn('No email provided by social provider', { provider, userId: data.user.id });
      }

      logger.info('Supabase Auth successful', { 
        userId: data.user.id, 
        provider,
        email: data.user.email,
        hasSession: !!data.session
      });

      // Get or create user profile in our database
      const userProfile = await this.getOrCreateUserProfile(data.user, provider);

      return {
        user: data.user,
        session: data.session,
        supabaseUser: userProfile
      };

    } catch (error) {
      logger.error('Social authentication failed', { 
        provider, 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      throw error;
    }
  }

  /**
   * Enhanced token validation for different providers
   */
  private async validateProviderToken(
    provider: SocialProvider,
    idToken: string,
    accessToken?: string
  ): Promise<void> {
    // Basic token format validation
    if (!idToken || typeof idToken !== 'string' || idToken.trim().length === 0) {
      throw new InvalidProviderTokenError(provider, 'Invalid token format');
    }

    // Provider-specific validation
    switch (provider) {
      case 'google':
        await this.validateGoogleTokenFormat(idToken);
        break;
      case 'apple':
        await this.validateAppleTokenFormat(idToken);
        break;
      case 'kakao':
        await this.validateKakaoTokenFormat(idToken, accessToken);
        break;
      default:
        throw new InvalidProviderTokenError(provider, 'Unsupported provider');
    }
  }

  /**
   * Validate Google ID token format
   */
  private async validateGoogleTokenFormat(idToken: string): Promise<void> {
    // Google ID tokens are JWTs with 3 parts separated by dots
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new InvalidProviderTokenError('google', 'Invalid Google ID token format');
    }

    try {
      // Decode header and payload (without verification for format check)
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      // Basic JWT structure validation
      if (!header.alg || !header.typ) {
        throw new InvalidProviderTokenError('google', 'Invalid Google token header');
      }

      if (!payload.iss || !payload.aud || !payload.exp) {
        throw new InvalidProviderTokenError('google', 'Invalid Google token payload');
      }

      // Check if token is expired (basic check)
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new InvalidProviderTokenError('google', 'Google token has expired');
      }

    } catch (error) {
      if (error instanceof InvalidProviderTokenError) {
        throw error;
      }
      throw new InvalidProviderTokenError('google', 'Failed to parse Google token');
    }
  }

  /**
   * Validate Apple ID token format
   */
  private async validateAppleTokenFormat(idToken: string): Promise<void> {
    // Apple ID tokens are also JWTs
    const parts = idToken.split('.');
    if (parts.length !== 3) {
      throw new InvalidProviderTokenError('apple', 'Invalid Apple ID token format');
    }

    try {
      const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
      const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());

      if (!header.alg || !header.kid) {
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token header');
      }

      if (!payload.iss || !payload.aud || !payload.exp) {
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token payload');
      }

      // Check issuer
      if (payload.iss !== 'https://appleid.apple.com') {
        throw new InvalidProviderTokenError('apple', 'Invalid Apple token issuer');
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new InvalidProviderTokenError('apple', 'Apple token has expired');
      }

    } catch (error) {
      if (error instanceof InvalidProviderTokenError) {
        throw error;
      }
      throw new InvalidProviderTokenError('apple', 'Failed to parse Apple token');
    }
  }

  /**
   * Validate Kakao token format
   */
  private async validateKakaoTokenFormat(idToken: string, accessToken?: string): Promise<void> {
    // Kakao tokens are typically opaque strings
    if (idToken.length < 10) {
      throw new InvalidProviderTokenError('kakao', 'Kakao token too short');
    }

    // Basic format validation - Kakao tokens are usually alphanumeric
    const kakaoTokenPattern = /^[a-zA-Z0-9_-]+$/;
    if (!kakaoTokenPattern.test(idToken)) {
      throw new InvalidProviderTokenError('kakao', 'Invalid Kakao token format');
    }

    // If access token is provided, validate it too
    if (accessToken && !kakaoTokenPattern.test(accessToken)) {
      throw new InvalidProviderTokenError('kakao', 'Invalid Kakao access token format');
    }
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
          user_role,
          user_status,
          profile_image_url,
          phone,
          birth_date,
          is_influencer,
          phone_verified,
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
        ...profileData,
        user_role: 'user',
        user_status: 'active',
        is_influencer: false,
        phone_verified: false
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
                'Kakao User',
          profile_image_url: metadata.kakao_account?.profile?.profile_image_url || null,
          phone: null, // Kakao requires separate consent for phone access
          birth_date: null, // Kakao requires separate consent for birth date
          provider_compliance: {
            kakao_service_terms_agreed: metadata.kakao_account?.has_service_terms || false,
            kakao_privacy_policy_agreed: metadata.kakao_account?.has_privacy_policy || false,
            profile_image_needs_agreement: metadata.kakao_account?.profile_image_needs_agreement || false,
            nickname_needs_agreement: metadata.kakao_account?.profile_nickname_needs_agreement || false
          }
        };
        
      case 'apple':
        return {
          name: metadata.full_name || 
                `${metadata.first_name || ''} ${metadata.last_name || ''}`.trim() || 
                'Apple User',
          profile_image_url: null, // Apple doesn't provide profile images
          phone: null, // Apple requires separate authorization
          birth_date: null, // Apple doesn't provide birth date
          provider_compliance: {
            apple_private_email: metadata.is_private_email || false,
            apple_real_user_status: metadata.real_user_status || 'unknown',
            apple_transfer_sub: metadata.transfer_sub || null
          }
        };
        
      case 'google':
        return {
          name: metadata.full_name || 
                metadata.name || 
                'Google User',
          profile_image_url: metadata.avatar_url || 
                            metadata.picture || null,
          phone: null, // Google requires separate scope for phone
          birth_date: null, // Google requires separate scope for birth date
          provider_compliance: {
            google_email_verified: metadata.email_verified || false,
            google_locale: metadata.locale || null,
            google_hd: metadata.hd || null // Hosted domain for G Suite users
          }
        };
        
      default:
        return {
          name: metadata.full_name || 
                metadata.name || 
                'User',
          profile_image_url: metadata.avatar_url || null,
          phone: null,
          birth_date: null,
          provider_compliance: {}
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
      
      // Update profile image if user hasn't set a custom one
      if (profileData.profile_image_url) {
        const { data: currentUser } = await this.supabase
          .from('users')
          .select('profile_image_url, profile_image_custom')
          .eq('id', userId)
          .single();
          
        if (currentUser && !currentUser.profile_image_custom) {
          updateData.profile_image_url = profileData.profile_image_url;
        }
      }
      
      // Update provider compliance data
      if (Object.keys(profileData.provider_compliance).length > 0) {
        updateData.provider_compliance = profileData.provider_compliance;
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