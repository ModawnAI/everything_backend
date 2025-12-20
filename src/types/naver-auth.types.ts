/**
 * Naver OAuth Authentication Types
 *
 * Type definitions for Naver OAuth 2.0 integration
 * Reference: https://developers.naver.com/docs/login/api/api.md
 */

/**
 * Naver OAuth token response
 */
export interface NaverTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  error?: string;
  error_description?: string;
}

/**
 * Naver user profile response
 */
export interface NaverUserProfile {
  resultcode: string;
  message: string;
  response: NaverUserInfo;
}

/**
 * Naver user information
 */
export interface NaverUserInfo {
  id: string;
  nickname?: string;
  name?: string;
  email?: string;
  gender?: 'M' | 'F' | 'U'; // Male, Female, Unknown
  age?: string; // Age range (e.g., "20-29")
  birthday?: string; // MM-DD format
  birthyear?: string; // YYYY format
  profile_image?: string;
  mobile?: string;
  mobile_e164?: string;
}

/**
 * Naver OAuth configuration
 */
export interface NaverOAuthConfig {
  clientId: string;
  clientSecret: string;
  callbackUrl: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
}

/**
 * Naver OAuth state parameter for CSRF protection
 */
export interface NaverOAuthState {
  nonce: string;
  timestamp: number;
  returnUrl?: string;
}

/**
 * Naver login request from mobile app
 */
export interface NaverLoginRequest {
  accessToken: string;
  refreshToken?: string;
  fcmToken?: string;
  deviceInfo?: {
    deviceId?: string;
    platform?: 'ios' | 'android' | 'web';
    appVersion?: string;
    osVersion?: string;
  };
}

/**
 * Naver OAuth error types
 */
export class NaverAuthError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'NaverAuthError';
  }
}

export class NaverTokenError extends NaverAuthError {
  constructor(message: string) {
    super(message, 'NAVER_TOKEN_ERROR', 401);
    this.name = 'NaverTokenError';
  }
}

export class NaverUserInfoError extends NaverAuthError {
  constructor(message: string) {
    super(message, 'NAVER_USER_INFO_ERROR', 502);
    this.name = 'NaverUserInfoError';
  }
}

/**
 * Naver OAuth URLs
 */
export const NAVER_OAUTH_URLS = {
  AUTHORIZATION: 'https://nid.naver.com/oauth2.0/authorize',
  TOKEN: 'https://nid.naver.com/oauth2.0/token',
  USER_INFO: 'https://openapi.naver.com/v1/nid/me',
  LOGOUT: 'https://nid.naver.com/oauth2.0/token?grant_type=delete',
} as const;
