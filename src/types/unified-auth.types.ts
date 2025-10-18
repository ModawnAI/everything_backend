/**
 * Unified Authentication System Types
 * Consolidates admin and shop_owner auth into role-based system
 */

// =====================================================
// USER ROLES
// =====================================================

export type UserRole = 'admin' | 'shop_owner' | 'customer';

export interface RoleConfig {
  requireIPWhitelist?: boolean;
  requireAccountSecurity?: boolean;
  requireShopAssociation?: boolean;
  sessionDuration: number; // in hours
  refreshTokenDuration: number; // in days
}

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    requireIPWhitelist: true,
    requireAccountSecurity: false,
    requireShopAssociation: false,
    sessionDuration: 24,
    refreshTokenDuration: 7,
  },
  shop_owner: {
    requireIPWhitelist: false,
    requireAccountSecurity: true,
    requireShopAssociation: true,
    sessionDuration: 24,
    refreshTokenDuration: 7,
  },
  customer: {
    requireIPWhitelist: false,
    requireAccountSecurity: false,
    requireShopAssociation: false,
    sessionDuration: 720, // 30 days
    refreshTokenDuration: 90,
  },
};

// =====================================================
// SESSION TYPES
// =====================================================

export interface Session {
  id: string;
  user_id: string;
  user_role: UserRole;
  shop_id?: string;
  token: string;
  refresh_token?: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  device_name?: string;
  is_active: boolean;
  last_activity_at: Date;
  expires_at: Date;
  refresh_expires_at?: Date;
  created_at: Date;
  revoked_at?: Date;
  revoked_by?: string;
  revocation_reason?: string;
}

export interface CreateSessionInput {
  user_id: string;
  user_role: UserRole;
  shop_id?: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  device_name?: string;
}

export interface SessionValidation {
  valid: boolean;
  session?: Session;
  user?: AuthUser;
  error?: string;
}

// =====================================================
// LOGIN TYPES
// =====================================================

export interface LoginRequest {
  email: string;
  password: string;
  role: UserRole;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  device_name?: string;
}

export interface LoginResponse {
  success: boolean;
  user: AuthUser;
  session: Session;
  token: string;
  refresh_token?: string;
  security?: AccountSecurity;
  permissions?: string[];
  message?: string;
}

export interface LoginAttempt {
  id: string;
  user_id?: string;
  user_role: UserRole;
  email: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  attempt_result: 'success' | 'failure' | 'blocked';
  failure_reason?: string;
  attempted_at: Date;
  session_id?: string;
}

// =====================================================
// USER TYPES
// =====================================================

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  shop_id?: string;
  full_name?: string;
  phone?: string;
  avatar_url?: string;
  is_active: boolean;
  email_verified: boolean;
  last_login_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// =====================================================
// ACCOUNT SECURITY TYPES
// =====================================================

export interface AccountSecurity {
  id: string;
  user_id: string;
  user_role: UserRole;
  failed_login_attempts: number;
  is_locked: boolean;
  locked_until?: Date;
  locked_reason?: string;
  last_failed_login_at?: Date;
  last_successful_login_at?: Date;
  password_changed_at?: Date;
  require_password_change: boolean;
  two_factor_enabled: boolean;
  two_factor_secret?: string;
  backup_codes?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface UpdateAccountSecurityInput {
  user_id: string;
  failed_login_attempts?: number;
  is_locked?: boolean;
  locked_until?: Date;
  locked_reason?: string;
  last_failed_login_at?: Date;
  last_successful_login_at?: Date;
  password_changed_at?: Date;
  require_password_change?: boolean;
}

// =====================================================
// SECURITY LOG TYPES
// =====================================================

export type SecurityEventCategory =
  | 'authentication'
  | 'authorization'
  | 'session'
  | 'account'
  | 'data_access'
  | 'configuration'
  | 'system';

export type SecuritySeverity = 'info' | 'warning' | 'error' | 'critical';

export interface SecurityLog {
  id: string;
  user_id?: string;
  user_role: UserRole;
  event_type: string;
  event_category: SecurityEventCategory;
  severity: SecuritySeverity;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  session_id?: string;
  resource_type?: string;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
  created_at: Date;
}

export interface CreateSecurityLogInput {
  user_id?: string;
  user_role: UserRole;
  event_type: string;
  event_category: SecurityEventCategory;
  severity: SecuritySeverity;
  description?: string;
  ip_address?: string;
  user_agent?: string;
  device_id?: string;
  session_id?: string;
  resource_type?: string;
  resource_id?: string;
  old_value?: any;
  new_value?: any;
  metadata?: Record<string, any>;
}

// =====================================================
// TOKEN TYPES
// =====================================================

export interface TokenPayload {
  userId: string;
  role: UserRole;
  shopId?: string;
  type: 'access' | 'refresh';
  sessionId: string;
  ipAddress?: string;
  deviceId?: string;
}

// =====================================================
// VALIDATION TYPES
// =====================================================

export interface ValidationResult {
  valid: boolean;
  error?: string;
  details?: Record<string, any>;
}

export interface IPWhitelistCheck {
  allowed: boolean;
  ip_address: string;
  reason?: string;
}

export interface AccountSecurityCheck {
  passed: boolean;
  is_locked: boolean;
  locked_until?: Date;
  failed_attempts: number;
  max_attempts: number;
  reason?: string;
}

// =====================================================
// REFRESH TOKEN TYPES
// =====================================================

export interface RefreshTokenRequest {
  refresh_token: string;
  role: UserRole;
  ip_address?: string;
  user_agent?: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  token: string;
  refresh_token?: string;
  session: Session;
}

// =====================================================
// LOGOUT TYPES
// =====================================================

export interface LogoutRequest {
  token: string;
  role: UserRole;
  revocation_reason?: string;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

// =====================================================
// SESSION MANAGEMENT TYPES
// =====================================================

export interface GetSessionsRequest {
  user_id: string;
  role: UserRole;
  include_revoked?: boolean;
}

export interface GetSessionsResponse {
  sessions: Session[];
  total: number;
}

export interface RevokeSessionRequest {
  session_id: string;
  revoked_by: string;
  revocation_reason: string;
}

// =====================================================
// MIGRATION HELPER TYPES (temporary)
// =====================================================

export interface LegacyAdminAuth {
  adminId: string;
  email: string;
}

export interface LegacyShopOwnerAuth {
  shopOwnerId: string;
  shopId: string;
  email: string;
}
