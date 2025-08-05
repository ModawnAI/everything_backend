/**
 * Social Authentication Types
 * 
 * Comprehensive type definitions for social login functionality
 * supporting Kakao, Apple, and Google OAuth providers
 */

export type SocialProvider = 'kakao' | 'apple' | 'google';

/**
 * Social login request payload
 */
export interface SocialLoginRequest {
  provider: SocialProvider;
  token: string;
  fcmToken?: string;
  deviceInfo?: {
    deviceId?: string;
    platform?: 'ios' | 'android' | 'web';
    appVersion?: string;
    osVersion?: string;
  };
}

/**
 * Social login response
 */
export interface SocialLoginResponse {
  success: boolean;
  data: {
    user: UserProfile;
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;
    };
    isNewUser: boolean;
    profileComplete: boolean;
  };
  message: string;
}

/**
 * User profile from social providers
 */
export interface UserProfile {
  id: string;
  email: string;
  name: string;
  user_role: 'user' | 'shop_owner' | 'influencer' | 'admin';
  user_status: 'active' | 'inactive' | 'suspended' | 'deleted';
  profile_image_url?: string;
  phone?: string;
  birth_date?: string;
  created_at: string;
  updated_at: string;
}

/**
 * Provider-specific user data interfaces
 */

// Kakao user data
export interface KakaoUserInfo {
  id: number;
  connected_at: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    name_needs_agreement?: boolean;
    name?: string;
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
    age_range_needs_agreement?: boolean;
    age_range?: string;
    birthyear_needs_agreement?: boolean;
    birthyear?: string;
    birthday_needs_agreement?: boolean;
    birthday?: string;
    birthday_type?: string;
    gender_needs_agreement?: boolean;
    gender?: string;
    phone_number_needs_agreement?: boolean;
    phone_number?: string;
    ci_needs_agreement?: boolean;
    ci?: string;
    ci_authenticated_at?: string;
  };
}

// Apple user data (from ID token)
export interface AppleUserInfo {
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string; // Unique user identifier
  at_hash: string;
  email?: string;
  email_verified?: boolean;
  is_private_email?: boolean;
  auth_time: number;
  nonce_supported?: boolean;
}

// Google user data
export interface GoogleUserInfo {
  id: string;
  email: string;
  verified_email: boolean;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  locale?: string;
  hd?: string; // Hosted domain
}

/**
 * Provider token validation result
 */
export interface TokenValidationResult {
  isValid: boolean;
  userData: KakaoUserInfo | AppleUserInfo | GoogleUserInfo | null;
  error?: string;
  providerUserId: string;
  email?: string;
  name?: string;
  profileImageUrl?: string;
}

/**
 * Social provider configuration
 */
export interface SocialProviderConfig {
  kakao: {
    restApiKey: string;
    adminKey?: string;
    userInfoUrl: string;
    tokenInfoUrl: string;
  };
  apple: {
    clientId: string;
    teamId: string;
    keyId: string;
    privateKey: string;
    publicKeyUrl: string;
  };
  google: {
    clientId: string;
    clientSecret: string;
    userInfoUrl: string;
    tokenInfoUrl: string;
  };
}

/**
 * Social authentication service interface
 */
export interface SocialAuthService {
  validateKakaoToken(token: string): Promise<TokenValidationResult>;
  validateAppleToken(token: string): Promise<TokenValidationResult>;
  validateGoogleToken(token: string): Promise<TokenValidationResult>;
  getUserByProviderId(provider: SocialProvider, providerId: string): Promise<UserProfile | null>;
  createOrUpdateUser(provider: SocialProvider, validationResult: TokenValidationResult): Promise<UserProfile>;
  linkProviderAccount(userId: string, provider: SocialProvider, providerId: string): Promise<void>;
}

/**
 * Social login error types
 */
export class SocialAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400,
    public provider?: SocialProvider
  ) {
    super(message);
    this.name = 'SocialAuthError';
  }
}

export class InvalidProviderTokenError extends SocialAuthError {
  constructor(provider: SocialProvider, details?: string) {
    super(
      `Invalid ${provider} token${details ? `: ${details}` : ''}`,
      'INVALID_PROVIDER_TOKEN',
      401,
      provider
    );
    this.name = 'InvalidProviderTokenError';
  }
}

export class ProviderApiError extends SocialAuthError {
  constructor(provider: SocialProvider, error: string) {
    super(
      `${provider} API error: ${error}`,
      'PROVIDER_API_ERROR',
      502,
      provider
    );
    this.name = 'ProviderApiError';
  }
}

export class UserCreationError extends SocialAuthError {
  constructor(details: string) {
    super(
      `Failed to create user: ${details}`,
      'USER_CREATION_ERROR',
      500
    );
    this.name = 'UserCreationError';
  }
}

export class AccountLinkingError extends SocialAuthError {
  constructor(provider: SocialProvider, details: string) {
    super(
      `Failed to link ${provider} account: ${details}`,
      'ACCOUNT_LINKING_ERROR',
      409,
      provider
    );
    this.name = 'AccountLinkingError';
  }
}

/**
 * FCM token registration interface
 */
export interface FcmTokenRegistration {
  userId: string;
  token: string;
  deviceId?: string;
  platform?: 'ios' | 'android' | 'web';
  appVersion?: string;
  osVersion?: string;
}

/**
 * User provider link tracking
 */
export interface UserProviderLink {
  id: string;
  user_id: string;
  provider: SocialProvider;
  provider_user_id: string;
  provider_email?: string;
  linked_at: string;
  last_used_at?: string;
  is_active: boolean;
}

/**
 * Social login analytics event
 */
export interface SocialLoginAnalytics {
  provider: SocialProvider;
  isNewUser: boolean;
  platform?: 'ios' | 'android' | 'web';
  success: boolean;
  errorCode?: string;
  userId?: string;
  deviceInfo?: {
    deviceId?: string;
    platform?: string;
    appVersion?: string;
    osVersion?: string;
  };
}

/**
 * Provider rate limiting configuration
 */
export interface ProviderRateLimit {
  provider: SocialProvider;
  maxAttempts: number;
  windowMs: number;
  blockDuration: number;
}

/**
 * Social login audit log
 */
export interface SocialLoginAuditLog {
  id: string;
  user_id?: string;
  provider: SocialProvider;
  action: 'login_attempt' | 'login_success' | 'login_failure' | 'token_validation' | 'user_creation';
  ip_address: string;
  user_agent: string;
  success: boolean;
  error_code?: string;
  error_message?: string;
  provider_user_id?: string;
  timestamp: Date;
  request_id?: string;
  session_id?: string;
}

/**
 * Provider token cache entry
 */
export interface TokenCacheEntry {
  token: string;
  validationResult: TokenValidationResult;
  expiresAt: Date;
  provider: SocialProvider;
}

/**
 * Social login configuration validation
 */
export interface SocialConfigValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  providers: {
    kakao: { configured: boolean; valid: boolean; errors: string[] };
    apple: { configured: boolean; valid: boolean; errors: string[] };
    google: { configured: boolean; valid: boolean; errors: string[] };
  };
} 

export interface SocialAuthSession {
  id: string;
  userId: string;
  provider: SocialProvider;
  providerUserId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
} 