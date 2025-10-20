# Session Repository Integration Test Blocker

## Summary
The SessionRepository integration tests ([tests/integration/session.repository.test.ts](../../tests/integration/session.repository.test.ts)) are currently blocked by a Supabase Auth API configuration issue that prevents test user creation.

## Problem
When running `npm run test:unified-auth:session`, all 15 tests fail during the `beforeAll` hook with:

```
Failed to create auth user: Database error creating new user

Auth error details: {
  "__isAuthError": true,
  "name": "AuthApiError",
  "status": 500,
  "code": "unexpected_failure"
}
```

## Root Cause
The `users` table has a foreign key constraint that requires users to exist in Supabase Auth's `auth.users` table first:

```sql
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    ...
);
```

This means:
1. ❌ Cannot create test users directly in `users` table
2. ✅ Must create auth users via `supabase.auth.admin.createUser()` first
3. ❌ The Auth API is returning 500 errors when trying to create users

## Technical Details

### Test File Path
`tests/integration/session.repository.test.ts`

### Failed Code
```typescript
const { data: authData, error: authError } = await supabase.auth.admin.createUser({
  email: testEmail,
  password: testPassword,
  email_confirm: true
});
// Returns: { status: 500, code: "unexpected_failure" }
```

### Database Configuration
- Service role key: ✅ Properly configured
- Database connection: ✅ Working (confirmed by test logs)
- Supabase URL: `https://ysrudwzwnzxrrwjtpuoh.supabase.co`

### Impact Scope
This issue affects:
- ✅ `tests/integration/session.repository.test.ts` (15 tests)
- ⚠️ Likely `tests/integration/unified-auth.test.ts` (uses same pattern)
- ⚠️ Any other integration tests that need to create test users

## Investigation Steps Completed

### 1. Initial Diagnosis
- ✅ Verified repository constructors properly call `super()`
- ✅ Fixed database.ts to create real Supabase client for integration tests
- ✅ Moved test file from unit to integration directory
- ✅ Added proper test user setup and cleanup

### 2. Alternative Approaches Attempted
- ❌ Direct user creation in `users` table (blocked by foreign key)
- ❌ Using unique email addresses (still gets 500 error)
- ❌ Generating UUID manually (still need auth.users entry)

### 3. Configuration Verification
- ✅ Service role key is present in `.env`
- ✅ Database connection successful
- ✅ Test environment properly configured

## Required Fix

### Supabase Project Configuration
The Supabase Auth service needs to be configured to allow user creation. This likely requires:

1. **Check Supabase Dashboard**
   - Navigate to Authentication → Settings
   - Verify "Enable email signups" is enabled
   - Check if there are any restrictions on user creation

2. **Service Role Permissions**
   - Verify service role key has admin permissions
   - Check if there are custom RLS policies blocking user creation

3. **Database Triggers**
   - Check if there are any triggers on `auth.users` table that might be failing
   - Review migration files for custom triggers

4. **Supabase Auth Logs**
   - Access Supabase Dashboard → Logs → Auth Logs
   - Look for specific error details when user creation fails

## Temporary Workaround
Until the Supabase configuration is fixed, integration tests requiring user creation will be skipped. The repository logic can be validated through:
1. Unit tests with mocked Supabase client
2. Manual testing via API endpoints
3. Test environment with properly configured Supabase instance

## Related Files
- [tests/integration/session.repository.test.ts](../../tests/integration/session.repository.test.ts) - Blocked test file
- [tests/integration/unified-auth.test.ts](../../tests/integration/unified-auth.test.ts) - Uses same pattern
- [src/config/database.ts](../../src/config/database.ts:56-78) - Fixed to support integration tests
- [src/repositories/session.repository.ts](../../src/repositories/session.repository.ts) - Repository being tested
- [supabase/migrations/20250101_create_unified_auth_tables.sql](../../supabase/migrations/) - Database schema

## Next Steps
1. **Immediate**: Document this issue (✅ This document)
2. **Required**: Fix Supabase Auth configuration to allow user creation
3. **After Fix**: Re-run tests with `npm run test:unified-auth:session`
4. **Validation**: Ensure all 15 SessionRepository tests pass
5. **Continue**: Move forward with additional auth system testing and deprecation tasks

## Status
- **Status**: ❌ BLOCKED
- **Blocker**: Supabase Auth API configuration
- **Severity**: HIGH (prevents all integration testing)
- **Owner**: Requires Supabase project admin access
- **Created**: 2025-10-17
