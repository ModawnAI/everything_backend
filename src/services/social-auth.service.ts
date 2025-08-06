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

      // Use Supabase's signInWithIdToken for social auth
      const { data, error } = await this.supabase.auth.signInWithIdToken({
        provider: this.mapProviderToSupabase(provider),
        token: idToken,
        ...(accessToken && { access_token: accessToken })
      });

      if (error) {
        logger.error('Supabase Auth error', { error: error.message, provider });
        throw new ProviderApiError(provider, error.message);
      }

      if (!data.user) {
        throw new ProviderApiError(provider, 'No user returned from Supabase Auth');
      }

      logger.info('Supabase Auth successful', { 
        userId: data.user.id, 
        provider,
        email: data.user.email 
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
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      throw error;
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
   * Get or create user profile in our database
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
        return existingUser;
      }

      // Create new user if not exists
      logger.info('Creating new user profile', { 
        userId: supabaseUser.id, 
        email: supabaseUser.email,
        provider 
      });

      const newUser = {
        id: supabaseUser.id,
        email: supabaseUser.email,
        name: supabaseUser.user_metadata?.full_name || 
              supabaseUser.user_metadata?.name || 
              'User',
        user_role: 'user',
        user_status: 'active',
        profile_image_url: supabaseUser.user_metadata?.avatar_url || null,
        phone: null,
        birth_date: null,
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

      // Create provider link
      await this.createProviderLink(supabaseUser.id, provider, supabaseUser.id);

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