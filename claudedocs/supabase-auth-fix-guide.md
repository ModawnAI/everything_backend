# Supabase Auth API Fix Guide

## Quick Reference

**Problem**: Supabase Auth API returns 500 error when creating users via `admin.createUser()`
**Impact**: Blocks all integration tests for unified authentication system
**Priority**: 🔴 CRITICAL
**Required**: Supabase Dashboard access for project `ysrudwzwnzxrrwjtpuoh`

## Step-by-Step Fix Instructions

### Step 1: Access Supabase Dashboard
1. Navigate to: https://supabase.com/dashboard/project/ysrudwzwnzxrrwjtpuoh
2. Log in with project admin credentials
3. Select the project: `ysrudwzwnzxrrwjtpuoh`

### Step 2: Check Authentication Settings
1. Click **Authentication** in left sidebar
2. Click **Settings** tab
3. Verify these settings:

#### Critical Settings to Check:
```
✅ Enable Email Signups: ENABLED
✅ Enable Email Confirmations: Can be DISABLED for development
✅ Minimum Password Length: 6 or higher (shouldn't affect admin creation)
✅ Email Auth: ENABLED
✅ Phone Auth: Optional
```

### Step 3: Verify Service Role Permissions
1. Go to **Settings** → **API**
2. Locate **service_role** key
3. Verify it matches the key in `.env`:
   ```
   SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```
4. Check that service_role has admin permissions

### Step 4: Check Database Triggers
1. Go to **Database** → **Triggers**
2. Look for triggers on `auth.users` table
3. Check if any triggers might be failing:
   - User creation triggers
   - Email validation triggers
   - Profile creation triggers

### Step 5: Review Auth Logs
1. Go to **Logs** → **Auth Logs**
2. Filter by:
   - Time: Last 24 hours
   - Error Level: Error
3. Look for specific error messages related to user creation
4. Note any database constraint violations or trigger failures

### Step 6: Check RLS Policies
1. Go to **Database** → **Policies**
2. Check policies on `auth.users` table
3. Verify service_role can bypass RLS (it should by default)
4. Look for any custom policies that might block user creation

### Step 7: Verify Database Health
1. Go to **Database** → **Health**
2. Check for any database issues:
   - Connection pool exhausted
   - Disk space issues
   - High CPU usage
3. Run a test query in SQL Editor:
   ```sql
   SELECT COUNT(*) FROM auth.users;
   ```

### Step 8: Test User Creation Manually
In **SQL Editor**, try creating a user directly:
```sql
-- This should work if Auth is properly configured
SELECT auth.admin_create_user(
  'test@example.com'::text,
  'TestPassword123!'::text
);
```

If this fails, note the exact error message.

### Step 9: Check for Known Issues
1. Supabase Status Page: https://status.supabase.com/
2. Check if there are any ongoing incidents
3. Review Supabase Discord/GitHub for similar issues

### Step 10: Contact Supabase Support
If issue persists:
1. Gather information:
   - Project ID: `ysrudwzwnzxrrwjtpuoh`
   - Error: `AuthApiError: status 500, code: unexpected_failure`
   - Full error from logs
   - Timeline of when issue started
2. Open support ticket at: https://supabase.com/dashboard/support
3. Include all gathered information

## Common Solutions

### Solution 1: Email Signups Disabled
**Symptom**: 500 error on user creation
**Fix**: Enable email signups in Authentication → Settings
```
✅ Enable Email Signups: ON
```

### Solution 2: Database Trigger Failure
**Symptom**: "Database error creating new user"
**Fix**: Check trigger logs and disable problematic triggers temporarily
```sql
-- Disable trigger temporarily
ALTER TABLE auth.users DISABLE TRIGGER trigger_name;
```

### Solution 3: RLS Policy Blocking Creation
**Symptom**: Permission denied or constraint violation
**Fix**: Verify service_role can bypass RLS
```sql
-- Check RLS status
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'auth';
```

### Solution 4: Email Provider Not Configured
**Symptom**: Email-related errors in Auth logs
**Fix**: Configure email provider or disable email confirmation for dev
```
✅ Enable Email Confirmations: OFF (for development)
```

### Solution 5: Database Connection Limits
**Symptom**: Intermittent 500 errors
**Fix**: Check connection pool and increase if needed
- Go to Database → Settings
- Increase max connections if low

## Verification After Fix

### Test 1: Direct API Test
```bash
curl -X POST 'https://ysrudwzwnzxrrwjtpuoh.supabase.co/auth/v1/admin/users' \
  -H "apikey: YOUR_SERVICE_ROLE_KEY" \
  -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test-verify@example.com",
    "password": "TestPassword123!",
    "email_confirm": true
  }'
```

Expected: 200 OK with user data

### Test 2: Run Integration Tests
```bash
npm run test:unified-auth:session
```

Expected: All 15 SessionRepository tests pass

### Test 3: Full Auth Test Suite
```bash
npm run test:unified-auth
```

Expected: All unified auth tests pass

## Emergency Workarounds (Temporary)

### Workaround 1: Skip Integration Tests
```bash
# Run only unit tests temporarily
npm run test:unit
```

### Workaround 2: Use Pre-created Test Users
Manually create test users in Supabase Dashboard:
1. Go to Authentication → Users
2. Click "Add User"
3. Create test users with known credentials
4. Update test files to use these pre-created users

**Note**: This is NOT a permanent solution - integration tests need dynamic user creation

### Workaround 3: Use Alternative Test Environment
Set up a separate Supabase project specifically for testing:
1. Create new Supabase project
2. Run migrations on test project
3. Configure tests to use test project
4. Use test project credentials in `.env.test`

## Monitoring After Fix

### Health Checks
1. Monitor Auth API response times
2. Check error rates in Auth logs
3. Verify user creation success rate

### Test Schedule
```bash
# Run tests every 6 hours to verify stability
0 */6 * * * cd /path/to/project && npm run test:unified-auth
```

### Alert Conditions
- Auth API errors > 5% of requests
- User creation failures > 1%
- Test suite failures

## Related Documentation
- [Session Repository Test Blocker](session-repository-test-blocker.md) - Detailed problem analysis
- [Unified Auth Implementation Summary](unified-auth-implementation-summary.md) - Project overview
- [Unified Auth Deprecation Plan](unified-auth-deprecation-plan.md) - Next steps after fix

## Support Resources
- **Supabase Docs**: https://supabase.com/docs/guides/auth
- **Supabase Discord**: https://discord.supabase.com/
- **Supabase GitHub**: https://github.com/supabase/supabase/issues
- **Stack Overflow**: Tag `supabase`

---

**Last Updated**: 2025-10-17
**Status**: Awaiting Fix
**Next Action**: Access Supabase Dashboard and follow Step 1
