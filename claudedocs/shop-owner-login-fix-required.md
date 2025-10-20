# Shop Owner Login Fix Required

## Current Status

✅ **Password Reset**: Successfully completed
- Email: `shopowner@test.com`
- New Password: `ShopOwner2025!`
- User ID: `4539aa5d-eb4b-404d-9288-2e6dd338caec`
- Shop ID: `22222222-2222-2222-2222-222222222222`
- Shop Name: "엘레강스 헤어살롱"

❌ **Login Blocked**: Required database tables do not exist

## Problem

The shop owner authentication system requires 4 tables that **do not exist in the database**, resulting in error:

```
42P01: relation "public.shop_owner_account_security" does not exist
```

### Root Cause

The migration file `supabase/migrations/20251017_create_shop_owner_auth_tables.sql` was **never executed**. The tables need to be created before shop owner authentication can work.

**Missing tables (all 4 required)**:
1. `shop_owner_sessions` - Active login sessions with device tracking
2. `shop_owner_login_attempts` - Login audit log for security monitoring
3. `shop_owner_account_security` - Security settings (CRITICAL - blocks login)
4. `shop_owner_security_logs` - Security event audit log

## Solution (REQUIRED)

### Step 1: Execute Migration to Create Tables

1. Run the migration helper script:
```bash
node scripts/execute-shop-owner-migration.js
```

This will display the complete SQL migration (143 lines).

2. Go to **Supabase Dashboard → SQL Editor**
3. Copy the entire SQL output from Step 1
4. Paste and execute in SQL Editor
5. Verify tables were created (should see 4 tables + 2 functions created)

### Step 2: Insert Initial Security Record

After tables are created, insert the security record for the shop owner:

```bash
node scripts/fix-shopowner-security.js
```

OR manually in SQL Editor:

```sql
INSERT INTO public.shop_owner_account_security (
  shop_owner_id,
  failed_login_attempts,
  created_at,
  updated_at
) VALUES (
  '4539aa5d-eb4b-404d-9288-2e6dd338caec',
  0,
  NOW(),
  NOW()
);
```

### Step 3: Test Login

```bash
node scripts/verify-shopowner-login-ready.js
```

Expected result: All 4 checks pass ✅

## Verification

After applying any solution, verify with:

```bash
# Test the login endpoint
node scripts/test-login-with-details.js

# Expected output:
# ✅ LOGIN SUCCESSFUL!
# Shop Owner: shopowner@test.com
# Shop Name: 엘레강스 헤어살롱
# Token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## Authentication Flow Explanation

The shop owner login process requires these checks:

1. **User Verification**: Check `users` table
   - `email` = 'shopowner@test.com'
   - `user_role` = 'shop_owner'
   - `user_status` = 'active' ✅

2. **Password Verification**: Via Supabase Auth
   - `signInWithPassword()` ✅

3. **Security Check**: Verify `shop_owner_account_security` table
   - Record must exist for user ❌ (BLOCKED HERE)
   - Check `is_locked` status
   - Check `locked_until` timestamp

4. **Shop Verification**: Check `shops` table
   - Shop exists and linked to user ✅
   - `shop_status` = 'active' ✅

5. **Session Creation**: Insert into `shop_owner_sessions` table
   - Create new session with device info
   - Generate JWT token

## Files Created During Investigation

### Diagnostic Scripts
- `scripts/check-shop-owner-account.js` - Verify account configuration
- `scripts/check-users-schema.js` - Display database schema
- `scripts/check-shopowner-detailed.js` - Detailed field verification
- `scripts/test-supabase-auth-directly.js` - Test Supabase Auth API
- `scripts/test-login-step-by-step.js` - Test each login step
- `scripts/test-login-with-details.js` - Full endpoint test
- `scripts/create-shop-owner-tables-direct.js` - Table existence check

### Fix Attempt Scripts
- `scripts/fix-shopowner-security.js` - Supabase client approach (failed)
- `scripts/fix-shopowner-security-pg.js` - Direct PostgreSQL (needs password)
- `scripts/fix-security-with-rpc.js` - RPC approach (failed)
- `scripts/fix-security-rest-api.js` - REST API approach (failed)
- `scripts/reload-schema-cache.js` - Cache reload attempt (failed)

All scripts failed due to PostgREST schema cache issue (PGRST205 error).

## Next Steps

1. Apply **Option 1 (Manual SQL)** - this will immediately unblock the login
2. Consider setting up proper migration workflow for future schema changes
3. Investigate why schema cache wasn't automatically refreshed
4. Add schema cache reload to deployment procedures

## Technical Details

### Required Tables (Created by Migration)

1. **shop_owner_sessions** - Active login sessions
2. **shop_owner_login_attempts** - Audit log of login attempts
3. **shop_owner_account_security** - Account security settings (REQUIRED FOR LOGIN)
4. **shop_owner_security_logs** - Comprehensive security events

### Migration File Location
`supabase/migrations/20251017_create_shop_owner_auth_tables.sql`

### Endpoint Information
- **Correct Login Endpoint**: `POST /api/shop-owner/auth/login`
- **Wrong Endpoint**: `POST /api/shop/auth/login` (returns 401 Missing Token)

### Service Implementation
- **Service**: `src/services/shop-owner-auth.service.ts` (897 lines)
- **Controller**: `src/controllers/shop-owner-auth.controller.ts` (525 lines)
- **Routes**: `src/routes/shop-owner-auth.routes.ts` (711 lines)

---

**Document created**: 2025-01-17
**Issue**: PostgREST schema cache mismatch
**Blocking**: Shop owner login functionality
**Priority**: HIGH - Manual SQL execution required
