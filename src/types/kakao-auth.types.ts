/**
 * Kakao OAuth Types
 */

// Kakao OAuth URLs
export const KAKAO_OAUTH_URLS = {
  AUTHORIZATION: 'https://kauth.kakao.com/oauth/authorize',
  TOKEN: 'https://kauth.kakao.com/oauth/token',
  USER_INFO: 'https://kapi.kakao.com/v2/user/me',
  LOGOUT: 'https://kapi.kakao.com/v1/user/logout',
  UNLINK: 'https://kapi.kakao.com/v1/user/unlink',
} as const;

// Kakao Token Response
export interface KakaoTokenResponse {
  access_token: string;
  token_type: string;
  refresh_token?: string;
  expires_in: number;
  refresh_token_expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
}

// Kakao User Profile Response
export interface KakaoUserProfile {
  id: number;
  connected_at?: string;
  properties?: {
    nickname?: string;
    profile_image?: string;
    thumbnail_image?: string;
  };
  kakao_account?: {
    profile_needs_agreement?: boolean;
    profile_nickname_needs_agreement?: boolean;
    profile_image_needs_agreement?: boolean;
    profile?: {
      nickname?: string;
      thumbnail_image_url?: string;
      profile_image_url?: string;
      is_default_image?: boolean;
    };
    email_needs_agreement?: boolean;
    is_email_valid?: boolean;
    is_email_verified?: boolean;
    email?: string;
    name_needs_agreement?: boolean;
    name?: string;
    age_range_needs_agreement?: boolean;
    age_range?: string;
    birthyear_needs_agreement?: boolean;
    birthyear?: string;
    birthday_needs_agreement?: boolean;
    birthday?: string;
    birthday_type?: 'SOLAR' | 'LUNAR';
    gender_needs_agreement?: boolean;
    gender?: 'male' | 'female';
    phone_number_needs_agreement?: boolean;
    phone_number?: string;
  };
}

// Kakao OAuth State (for CSRF protection)
export interface KakaoOAuthState {
  nonce: string;
  timestamp: number;
  returnUrl?: string;
}

// Error classes
export class KakaoAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'KakaoAuthError';
  }
}

export class KakaoTokenError extends KakaoAuthError {
  constructor(message: string) {
    super(message, 'TOKEN_ERROR', 401);
    this.name = 'KakaoTokenError';
  }
}

export class KakaoUserInfoError extends KakaoAuthError {
  constructor(message: string) {
    super(message, 'USER_INFO_ERROR', 400);
    this.name = 'KakaoUserInfoError';
  }
}
