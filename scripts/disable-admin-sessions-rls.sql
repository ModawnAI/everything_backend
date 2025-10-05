-- Temporary: Disable RLS on admin_sessions for testing
ALTER TABLE admin_sessions DISABLE ROW LEVEL SECURITY;

SELECT 'RLS disabled on admin_sessions table' AS status;
