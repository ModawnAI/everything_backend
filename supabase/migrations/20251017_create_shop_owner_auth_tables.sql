-- =============================================
-- Shop Owner Authentication Tables
-- =============================================
-- Created: 2025-10-17
-- Purpose: Session management and security tracking for shop owner authentication
-- Similar to admin auth system but tailored for shop owners

-- Shop Owner Sessions Table
-- Manages active login sessions for shop owners with device tracking
CREATE TABLE IF NOT EXISTS public.shop_owner_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_owner_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE,
    refresh_token TEXT NOT NULL UNIQUE,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255),
    device_name VARCHAR(255), -- "iPhone 14 Pro", "Chrome on Windows"
    is_active BOOLEAN DEFAULT TRUE,
    last_activity_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES public.users(id),
    revocation_reason TEXT
);

-- Indexes for shop owner sessions
CREATE INDEX idx_shop_owner_sessions_owner_id ON public.shop_owner_sessions(shop_owner_id);
CREATE INDEX idx_shop_owner_sessions_shop_id ON public.shop_owner_sessions(shop_id);
CREATE INDEX idx_shop_owner_sessions_token ON public.shop_owner_sessions(token);
CREATE INDEX idx_shop_owner_sessions_refresh_token ON public.shop_owner_sessions(refresh_token);
CREATE INDEX idx_shop_owner_sessions_is_active ON public.shop_owner_sessions(is_active);
CREATE INDEX idx_shop_owner_sessions_expires_at ON public.shop_owner_sessions(expires_at);

-- Shop Owner Login Attempts Table
-- Tracks failed login attempts for security monitoring and account protection
CREATE TABLE IF NOT EXISTS public.shop_owner_login_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255),
    attempt_result VARCHAR(50) NOT NULL, -- 'success', 'invalid_credentials', 'account_locked', 'shop_not_found'
    failure_reason TEXT,
    attempted_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for login attempts
CREATE INDEX idx_shop_owner_login_attempts_email ON public.shop_owner_login_attempts(email);
CREATE INDEX idx_shop_owner_login_attempts_ip ON public.shop_owner_login_attempts(ip_address);
CREATE INDEX idx_shop_owner_login_attempts_attempted_at ON public.shop_owner_login_attempts(attempted_at);
CREATE INDEX idx_shop_owner_login_attempts_result ON public.shop_owner_login_attempts(attempt_result);

-- Shop Owner Account Security Table
-- Tracks account lock status and security events
CREATE TABLE IF NOT EXISTS public.shop_owner_account_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_owner_id UUID NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMPTZ,
    account_locked_at TIMESTAMPTZ,
    account_locked_until TIMESTAMPTZ,
    locked_by VARCHAR(50), -- 'system', 'admin', 'self'
    lock_reason TEXT,
    password_changed_at TIMESTAMPTZ,
    last_password_change_ip VARCHAR(50),
    security_questions_set BOOLEAN DEFAULT FALSE,
    two_factor_enabled BOOLEAN DEFAULT FALSE,
    two_factor_secret TEXT,
    backup_codes TEXT[], -- Array of backup codes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for account security
CREATE INDEX idx_shop_owner_account_security_owner_id ON public.shop_owner_account_security(shop_owner_id);
CREATE INDEX idx_shop_owner_account_security_locked ON public.shop_owner_account_security(account_locked_at) WHERE account_locked_at IS NOT NULL;

-- Shop Owner Security Logs Table
-- Comprehensive audit log for security-related events
CREATE TABLE IF NOT EXISTS public.shop_owner_security_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL, -- 'login_success', 'login_failed', 'password_changed', 'session_revoked', etc.
    event_details JSONB,
    ip_address VARCHAR(50),
    user_agent TEXT,
    device_id VARCHAR(255),
    severity VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'error', 'critical'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for security logs
CREATE INDEX idx_shop_owner_security_logs_owner_id ON public.shop_owner_security_logs(shop_owner_id);
CREATE INDEX idx_shop_owner_security_logs_event_type ON public.shop_owner_security_logs(event_type);
CREATE INDEX idx_shop_owner_security_logs_created_at ON public.shop_owner_security_logs(created_at);
CREATE INDEX idx_shop_owner_security_logs_severity ON public.shop_owner_security_logs(severity);

-- Function: Clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_shop_owner_sessions()
RETURNS void AS $$
BEGIN
    UPDATE public.shop_owner_sessions
    SET is_active = FALSE,
        revoked_at = NOW(),
        revocation_reason = 'Session expired'
    WHERE expires_at < NOW()
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Function: Auto-unlock accounts after lock period
CREATE OR REPLACE FUNCTION auto_unlock_shop_owner_accounts()
RETURNS void AS $$
BEGIN
    UPDATE public.shop_owner_account_security
    SET account_locked_at = NULL,
        account_locked_until = NULL,
        failed_login_attempts = 0,
        lock_reason = NULL,
        updated_at = NOW()
    WHERE account_locked_until IS NOT NULL
    AND account_locked_until < NOW();
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE public.shop_owner_sessions IS 'Active login sessions for shop owners with device tracking and security features';
COMMENT ON TABLE public.shop_owner_login_attempts IS 'Audit log of all login attempts (successful and failed) for security monitoring';
COMMENT ON TABLE public.shop_owner_account_security IS 'Account security settings and lock status for shop owners';
COMMENT ON TABLE public.shop_owner_security_logs IS 'Comprehensive security event log for shop owner accounts';

COMMENT ON COLUMN public.shop_owner_sessions.token IS 'JWT access token for API authentication';
COMMENT ON COLUMN public.shop_owner_sessions.refresh_token IS 'Refresh token for obtaining new access tokens';
COMMENT ON COLUMN public.shop_owner_sessions.device_id IS 'Unique device identifier for tracking and session management';
COMMENT ON COLUMN public.shop_owner_sessions.expires_at IS 'Token expiration time (typically 24 hours for shop owners)';

COMMENT ON COLUMN public.shop_owner_account_security.failed_login_attempts IS 'Counter for failed login attempts (resets on successful login)';
COMMENT ON COLUMN public.shop_owner_account_security.account_locked_until IS 'Automatic unlock time (NULL if not locked or permanently locked)';
COMMENT ON COLUMN public.shop_owner_account_security.two_factor_enabled IS 'Whether 2FA is enabled (future feature)';
