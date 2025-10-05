-- =============================================
-- Admin Authentication Tables Migration
-- =============================================
-- Creates tables for admin authentication, sessions, and security
-- Version: 069
-- Date: 2025-10-05
-- =============================================

-- =============================================
-- 1. Admin Sessions Table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token TEXT NOT NULL UNIQUE,
  refresh_token TEXT NOT NULL UNIQUE,
  ip_address INET NOT NULL,
  user_agent TEXT,
  device_id TEXT,
  is_active BOOLEAN DEFAULT true,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  refresh_expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_by UUID REFERENCES users(id),
  revocation_reason TEXT
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_id ON admin_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_token ON admin_sessions(token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_refresh_token ON admin_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_is_active ON admin_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires_at ON admin_sessions(expires_at);

-- Comments
COMMENT ON TABLE admin_sessions IS 'Admin user sessions with JWT tokens and security tracking';
COMMENT ON COLUMN admin_sessions.token IS 'JWT access token for authentication';
COMMENT ON COLUMN admin_sessions.refresh_token IS 'JWT refresh token for session renewal';
COMMENT ON COLUMN admin_sessions.device_id IS 'Unique device identifier for session tracking';

-- =============================================
-- 2. Admin IP Whitelist Table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_ip_whitelist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ip_address INET NOT NULL UNIQUE,
  description TEXT,
  added_by UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_ip_whitelist_ip_address ON admin_ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_admin_ip_whitelist_is_active ON admin_ip_whitelist(is_active);

-- Comments
COMMENT ON TABLE admin_ip_whitelist IS 'IP whitelist for admin access control';
COMMENT ON COLUMN admin_ip_whitelist.expires_at IS 'Optional expiration date for temporary IP access';

-- =============================================
-- 3. Admin Login Attempts Table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_login_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  reason TEXT,
  attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_email ON admin_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_attempted_at ON admin_login_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_ip_address ON admin_login_attempts(ip_address);

-- Comments
COMMENT ON TABLE admin_login_attempts IS 'Failed admin login attempts for security monitoring';

-- =============================================
-- 4. Admin Permissions Table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_permissions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  is_active BOOLEAN DEFAULT true,
  granted_by UUID REFERENCES users(id),
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,

  UNIQUE(admin_id, permission)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_permissions_admin_id ON admin_permissions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_permission ON admin_permissions(permission);
CREATE INDEX IF NOT EXISTS idx_admin_permissions_is_active ON admin_permissions(is_active);

-- Comments
COMMENT ON TABLE admin_permissions IS 'Granular permissions for admin users';

-- =============================================
-- 5. Admin Actions Audit Log Table
-- =============================================
CREATE TABLE IF NOT EXISTS admin_actions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action_type VARCHAR(100) NOT NULL,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add resource tracking columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'admin_actions' AND column_name = 'resource_type') THEN
    ALTER TABLE admin_actions ADD COLUMN resource_type VARCHAR(100);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'admin_actions' AND column_name = 'resource_id') THEN
    ALTER TABLE admin_actions ADD COLUMN resource_id UUID;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_action_type ON admin_actions(action_type);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- Create resource index only if columns exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'admin_actions' AND column_name = 'resource_type'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_admin_actions_resource ON admin_actions(resource_type, resource_id);
  END IF;
END $$;

-- Comments
COMMENT ON TABLE admin_actions IS 'Comprehensive audit log of all admin actions';

-- =============================================
-- 6. Add missing columns to users table for admin functionality
-- =============================================
-- Add columns if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'is_locked') THEN
    ALTER TABLE users ADD COLUMN is_locked BOOLEAN DEFAULT false;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'locked_at') THEN
    ALTER TABLE users ADD COLUMN locked_at TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_name = 'users' AND column_name = 'last_login_ip') THEN
    ALTER TABLE users ADD COLUMN last_login_ip INET;
  END IF;
END $$;

-- =============================================
-- 7. Row Level Security (RLS) Policies
-- =============================================

-- Enable RLS on admin tables
ALTER TABLE admin_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_ip_whitelist ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_login_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_actions ENABLE ROW LEVEL SECURITY;

-- Service role can do anything (bypass RLS)
-- No policies needed as service role bypasses RLS

-- Admin Sessions Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS admin_sessions_select_own ON admin_sessions;
DROP POLICY IF EXISTS admin_sessions_insert_service ON admin_sessions;
DROP POLICY IF EXISTS admin_sessions_update_own ON admin_sessions;

-- Authenticated users can only see their own sessions
CREATE POLICY admin_sessions_select_own ON admin_sessions
  FOR SELECT
  TO authenticated
  USING (admin_id = auth.uid());

-- Allow service role to insert sessions (backend creates sessions)
CREATE POLICY admin_sessions_insert_service ON admin_sessions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Allow users to update their own sessions
CREATE POLICY admin_sessions_update_own ON admin_sessions
  FOR UPDATE
  TO authenticated
  USING (admin_id = auth.uid());

-- Admin Actions Policies
-- Drop existing policies if they exist
DROP POLICY IF EXISTS admin_actions_select_admin ON admin_actions;
DROP POLICY IF EXISTS admin_actions_insert_service ON admin_actions;

-- Only admins can view admin actions
CREATE POLICY admin_actions_select_admin ON admin_actions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.user_role = 'admin'
    )
  );

-- Allow service role to insert admin actions (backend logs actions)
CREATE POLICY admin_actions_insert_service ON admin_actions
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Admin Login Attempts Policies
-- Drop existing policy if it exists
DROP POLICY IF EXISTS admin_login_attempts_insert_service ON admin_login_attempts;

-- Allow service role to insert login attempts (backend logs attempts)
CREATE POLICY admin_login_attempts_insert_service ON admin_login_attempts
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- =============================================
-- 8. Functions for automatic timestamp updates
-- =============================================

-- Update timestamp function for admin_sessions
CREATE OR REPLACE FUNCTION update_admin_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_activity_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admin_sessions
DROP TRIGGER IF EXISTS trigger_admin_sessions_updated_at ON admin_sessions;
CREATE TRIGGER trigger_admin_sessions_updated_at
  BEFORE UPDATE ON admin_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_sessions_updated_at();

-- Update timestamp function for admin_ip_whitelist
CREATE OR REPLACE FUNCTION update_admin_ip_whitelist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for admin_ip_whitelist
DROP TRIGGER IF EXISTS trigger_admin_ip_whitelist_updated_at ON admin_ip_whitelist;
CREATE TRIGGER trigger_admin_ip_whitelist_updated_at
  BEFORE UPDATE ON admin_ip_whitelist
  FOR EACH ROW
  EXECUTE FUNCTION update_admin_ip_whitelist_updated_at();

-- =============================================
-- 9. Cleanup old sessions function
-- =============================================
CREATE OR REPLACE FUNCTION cleanup_expired_admin_sessions()
RETURNS INTEGER AS $$
DECLARE
  deleted_count INTEGER;
BEGIN
  WITH deleted AS (
    DELETE FROM admin_sessions
    WHERE expires_at < NOW()
    AND is_active = true
    RETURNING *
  )
  SELECT COUNT(*) INTO deleted_count FROM deleted;

  RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION cleanup_expired_admin_sessions IS 'Cleans up expired admin sessions, returns count of deleted sessions';

-- =============================================
-- 10. Insert default admin permissions for existing admin users
-- =============================================
-- Insert default admin permissions for existing admin users
INSERT INTO admin_permissions (admin_id, permission, is_active, granted_at)
SELECT
  id,
  permission,
  true,
  NOW()
FROM users,
LATERAL (
  VALUES
    ('user_management'),
    ('shop_approval'),
    ('shop_management'),
    ('reservation_management'),
    ('payment_management'),
    ('content_moderation'),
    ('analytics_view'),
    ('system_settings')
) AS perms(permission)
WHERE user_role = 'admin'
ON CONFLICT (admin_id, permission) DO NOTHING;

-- =============================================
-- Migration Complete
-- =============================================
-- All admin authentication tables and security features created successfully
