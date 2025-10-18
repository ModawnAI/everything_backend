-- =====================================================
-- Unified Authentication System Tables
-- =====================================================
-- Purpose: Consolidate admin_* and shop_owner_* auth tables
--          into unified role-based tables to eliminate duplication
-- Date: 2025-01-17
-- Migration: Creates 4 unified tables + data migration from old tables
-- =====================================================

-- =====================================================
-- 1. UNIFIED SESSIONS TABLE
-- =====================================================
-- Replaces: admin_sessions + shop_owner_sessions
-- Consolidates all user session management into single table

CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('admin', 'shop_owner', 'customer')),
  shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),
  device_name VARCHAR(255),
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_activity_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES public.users(id),
  revocation_reason TEXT,

  -- Constraints
  CONSTRAINT valid_shop_owner CHECK (
    (user_role = 'shop_owner' AND shop_id IS NOT NULL) OR
    (user_role != 'shop_owner')
  )
);

-- Indexes for performance
CREATE INDEX idx_sessions_user_id ON public.sessions(user_id);
CREATE INDEX idx_sessions_user_role ON public.sessions(user_role);
CREATE INDEX idx_sessions_token ON public.sessions(token);
CREATE INDEX idx_sessions_refresh_token ON public.sessions(refresh_token) WHERE refresh_token IS NOT NULL;
CREATE INDEX idx_sessions_active ON public.sessions(is_active, expires_at) WHERE is_active = true;
CREATE INDEX idx_sessions_shop_id ON public.sessions(shop_id) WHERE shop_id IS NOT NULL;

-- =====================================================
-- 2. UNIFIED LOGIN ATTEMPTS TABLE
-- =====================================================
-- Replaces: admin_login_attempts + shop_owner_login_attempts
-- Tracks all login attempts for security monitoring

CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('admin', 'shop_owner', 'customer')),
  email VARCHAR(255) NOT NULL,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),
  attempt_result VARCHAR(50) NOT NULL CHECK (attempt_result IN ('success', 'failure', 'blocked')),
  failure_reason VARCHAR(255),
  attempted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  -- Optional foreign keys for successful logins
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL
);

-- Indexes for security analysis
CREATE INDEX idx_login_attempts_user_id ON public.login_attempts(user_id);
CREATE INDEX idx_login_attempts_email ON public.login_attempts(email);
CREATE INDEX idx_login_attempts_user_role ON public.login_attempts(user_role);
CREATE INDEX idx_login_attempts_ip_address ON public.login_attempts(ip_address);
CREATE INDEX idx_login_attempts_result ON public.login_attempts(attempt_result);
CREATE INDEX idx_login_attempts_attempted_at ON public.login_attempts(attempted_at DESC);

-- =====================================================
-- 3. UNIFIED ACCOUNT SECURITY TABLE
-- =====================================================
-- Replaces: shop_owner_account_security (admin didn't have equivalent)
-- Tracks security settings for all user roles

CREATE TABLE IF NOT EXISTS public.account_security (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('admin', 'shop_owner', 'customer')),
  failed_login_attempts INTEGER NOT NULL DEFAULT 0,
  is_locked BOOLEAN NOT NULL DEFAULT false,
  locked_until TIMESTAMPTZ,
  locked_reason VARCHAR(255),
  last_failed_login_at TIMESTAMPTZ,
  last_successful_login_at TIMESTAMPTZ,
  password_changed_at TIMESTAMPTZ,
  require_password_change BOOLEAN NOT NULL DEFAULT false,
  two_factor_enabled BOOLEAN NOT NULL DEFAULT false,
  two_factor_secret TEXT,
  backup_codes TEXT[],
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX idx_account_security_user_id ON public.account_security(user_id);
CREATE INDEX idx_account_security_user_role ON public.account_security(user_role);
CREATE INDEX idx_account_security_locked ON public.account_security(is_locked) WHERE is_locked = true;

-- =====================================================
-- 4. UNIFIED SECURITY LOGS TABLE
-- =====================================================
-- Replaces: shop_owner_security_logs + admin audit trail
-- Comprehensive security event logging for all roles

CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  user_role VARCHAR(50) NOT NULL CHECK (user_role IN ('admin', 'shop_owner', 'customer')),
  event_type VARCHAR(100) NOT NULL,
  event_category VARCHAR(50) NOT NULL CHECK (event_category IN (
    'authentication', 'authorization', 'session', 'account', 'data_access', 'configuration', 'system'
  )),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')) DEFAULT 'info',
  description TEXT,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_id VARCHAR(255),
  session_id UUID REFERENCES public.sessions(id) ON DELETE SET NULL,
  resource_type VARCHAR(100),
  resource_id UUID,
  old_value JSONB,
  new_value JSONB,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for security analysis and audit
CREATE INDEX idx_security_logs_user_id ON public.security_logs(user_id);
CREATE INDEX idx_security_logs_user_role ON public.security_logs(user_role);
CREATE INDEX idx_security_logs_event_type ON public.security_logs(event_type);
CREATE INDEX idx_security_logs_event_category ON public.security_logs(event_category);
CREATE INDEX idx_security_logs_severity ON public.security_logs(severity);
CREATE INDEX idx_security_logs_created_at ON public.security_logs(created_at DESC);
CREATE INDEX idx_security_logs_session_id ON public.security_logs(session_id) WHERE session_id IS NOT NULL;

-- =====================================================
-- 5. HELPER FUNCTIONS
-- =====================================================

-- Auto-cleanup expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.sessions
  SET is_active = false,
      revoked_at = CURRENT_TIMESTAMP,
      revocation_reason = 'Session expired'
  WHERE is_active = true
    AND expires_at < CURRENT_TIMESTAMP;
END;
$$;

-- Auto-unlock accounts after lock period
CREATE OR REPLACE FUNCTION auto_unlock_accounts()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.account_security
  SET is_locked = false,
      locked_until = NULL,
      locked_reason = NULL,
      failed_login_attempts = 0,
      updated_at = CURRENT_TIMESTAMP
  WHERE is_locked = true
    AND locked_until IS NOT NULL
    AND locked_until < CURRENT_TIMESTAMP;
END;
$$;

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Apply update trigger to account_security
CREATE TRIGGER trigger_update_account_security_updated_at
BEFORE UPDATE ON public.account_security
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- =====================================================
-- 6. DATA MIGRATION FROM OLD TABLES
-- =====================================================

-- Migrate admin sessions
INSERT INTO public.sessions (
  id, user_id, user_role, shop_id, token, refresh_token,
  ip_address, user_agent, device_id, device_name,
  is_active, last_activity_at, expires_at, refresh_expires_at,
  created_at, revoked_at, revoked_by, revocation_reason
)
SELECT
  id, admin_id, 'admin', NULL, token, refresh_token,
  ip_address, user_agent, device_id, NULL,
  is_active, last_activity_at, expires_at, refresh_expires_at,
  created_at, revoked_at, revoked_by, revocation_reason
FROM public.admin_sessions
WHERE NOT EXISTS (
  SELECT 1 FROM public.sessions WHERE id = admin_sessions.id
);

-- Migrate shop owner sessions
INSERT INTO public.sessions (
  id, user_id, user_role, shop_id, token, refresh_token,
  ip_address, user_agent, device_id, device_name,
  is_active, last_activity_at, expires_at, refresh_expires_at,
  created_at, revoked_at, revoked_by, revocation_reason
)
SELECT
  id, shop_owner_id, 'shop_owner', shop_id, token, refresh_token,
  ip_address, user_agent, device_id, device_name,
  is_active, last_activity_at, expires_at, NULL,
  created_at, revoked_at, revoked_by, revocation_reason
FROM public.shop_owner_sessions
WHERE NOT EXISTS (
  SELECT 1 FROM public.sessions WHERE id = shop_owner_sessions.id
);

-- Migrate admin login attempts (simpler structure - no user_id, device_id, result)
INSERT INTO public.login_attempts (
  id, user_id, user_role, email, ip_address, user_agent, device_id,
  attempt_result, failure_reason, attempted_at, session_id
)
SELECT
  id, NULL, 'admin', email, ip_address::text, user_agent, NULL,
  CASE WHEN reason IS NULL OR reason = '' THEN 'success' ELSE 'failure' END,
  reason, attempted_at, NULL
FROM public.admin_login_attempts
WHERE NOT EXISTS (
  SELECT 1 FROM public.login_attempts WHERE id = admin_login_attempts.id
);

-- Migrate shop owner login attempts (has more complete structure)
INSERT INTO public.login_attempts (
  id, user_id, user_role, email, ip_address, user_agent, device_id,
  attempt_result, failure_reason, attempted_at, session_id
)
SELECT
  id, NULL, 'shop_owner', email, ip_address, user_agent, device_id,
  attempt_result, failure_reason, attempted_at, NULL
FROM public.shop_owner_login_attempts
WHERE NOT EXISTS (
  SELECT 1 FROM public.login_attempts WHERE id = shop_owner_login_attempts.id
);

-- Migrate shop owner account security
INSERT INTO public.account_security (
  id, user_id, user_role, failed_login_attempts, is_locked, locked_until,
  locked_reason, last_failed_login_at, last_successful_login_at,
  password_changed_at, require_password_change, two_factor_enabled,
  two_factor_secret, backup_codes, created_at, updated_at
)
SELECT
  id, shop_owner_id, 'shop_owner', failed_login_attempts, is_locked, locked_until,
  locked_reason, last_failed_login_at, last_successful_login_at,
  password_changed_at, require_password_change, two_factor_enabled,
  two_factor_secret, backup_codes, created_at, updated_at
FROM public.shop_owner_account_security
WHERE NOT EXISTS (
  SELECT 1 FROM public.account_security WHERE user_id = shop_owner_account_security.shop_owner_id
);

-- Migrate shop owner security logs
INSERT INTO public.security_logs (
  id, user_id, user_role, event_type, event_category, severity,
  description, ip_address, user_agent, device_id, session_id,
  resource_type, resource_id, old_value, new_value, metadata, created_at
)
SELECT
  id, shop_owner_id, 'shop_owner', event_type, event_category, severity,
  description, ip_address, user_agent, device_id, session_id,
  resource_type, resource_id, old_value, new_value, metadata, created_at
FROM public.shop_owner_security_logs
WHERE NOT EXISTS (
  SELECT 1 FROM public.security_logs WHERE id = shop_owner_security_logs.id
);

-- =====================================================
-- 7. GRANT PERMISSIONS
-- =====================================================

-- Grant permissions to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.sessions TO authenticated;
GRANT SELECT, INSERT ON public.login_attempts TO authenticated;
GRANT SELECT, UPDATE ON public.account_security TO authenticated;
GRANT SELECT, INSERT ON public.security_logs TO authenticated;

-- Grant permissions to service role
GRANT ALL ON public.sessions TO service_role;
GRANT ALL ON public.login_attempts TO service_role;
GRANT ALL ON public.account_security TO service_role;
GRANT ALL ON public.security_logs TO service_role;

-- =====================================================
-- 8. ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================

-- Enable RLS
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_security ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Sessions policies
CREATE POLICY "Users can view their own sessions"
  ON public.sessions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own sessions"
  ON public.sessions FOR UPDATE
  USING (auth.uid() = user_id);

-- Account security policies
CREATE POLICY "Users can view their own security settings"
  ON public.account_security FOR SELECT
  USING (auth.uid() = user_id);

-- Security logs policies
CREATE POLICY "Users can view their own security logs"
  ON public.security_logs FOR SELECT
  USING (auth.uid() = user_id);

-- Login attempts policies (view-only for users)
CREATE POLICY "Users can view their own login attempts"
  ON public.login_attempts FOR SELECT
  USING (auth.uid() = user_id);

-- =====================================================
-- MIGRATION COMPLETE
-- =====================================================
-- Summary:
-- ✅ Created 4 unified tables (sessions, login_attempts, account_security, security_logs)
-- ✅ Added proper indexes for performance
-- ✅ Created helper functions for cleanup and maintenance
-- ✅ Migrated all existing data from old tables
-- ✅ Set up RLS policies for security
-- ✅ Granted appropriate permissions
--
-- Next steps:
-- 1. Verify migration success with SELECT COUNT(*) from new tables
-- 2. Test unified auth service with both admin and shop_owner roles
-- 3. Update application code to use new tables
-- 4. After validation, drop old tables (admin_*, shop_owner_*)
-- =====================================================
