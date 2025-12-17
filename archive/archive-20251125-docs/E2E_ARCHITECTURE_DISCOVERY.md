# E2E Test Architecture Discovery & Critical Findings

**Date**: 2025-11-12
**Status**: 🔴 CRITICAL - Tests Based on Wrong Architecture

---

## ❌ Critical Issue: Test Architecture Mismatch

### The Problem
**E2E tests were written assuming a custom backend REST API architecture, but the application actually uses Supabase Authentication SDK.**

### Evidence

#### Test Expectations (WRONG)
```typescript
// tests/01-user-auth/login.spec.ts:18-26
const loginRequestPromise = page.waitForRequest(request =>
  request.url().includes('/api/auth/login') &&  // ❌ This never happens!
  request.method() === 'POST'
);

const loginResponsePromise = page.waitForResponse(response =>
  response.url().includes('/api/auth/login') &&  // ❌ This endpoint doesn't exist in flow!
  response.status() === 200
);
```

#### Actual Implementation (CORRECT)
```typescript
// src/contexts/auth-context.tsx:319-322
const { data: authData, error } = await supabase.auth.signInWithPassword({
  email: data.email!,
  password: data.password,
});
// ✅ Uses Supabase Auth SDK, NO HTTP request to /api/auth/login
```

---

## 🏗️ Actual Architecture

### Authentication Flow
```
User fills login form
      ↓
Login Page (page.tsx)
      ↓
signInWithEmail() from useAuth()
      ↓
AuthContext (auth-context.tsx)
      ↓
supabase.auth.signInWithPassword()  ← Supabase SDK (clientside)
      ↓
Supabase Cloud (authentication happens on Supabase servers)
      ↓
Success: Redirect to /dashboard
      ↓
Load user profile from backend (optional, fails gracefully)
```

### Key Architectural Decisions

1. **Primary Auth: Supabase**
   - All authentication goes through Supabase Auth SDK
   - Client-side SDK, not REST API calls
   - No custom `/api/auth/login` endpoint in the flow

2. **Backend Integration: Secondary**
   - Backend syncs JWT tokens AFTER Supabase auth (line 66-84)
   - Profile loading from backend is optional (lines 87-136)
   - If backend fails, app continues with Supabase-only auth
   - Social auth explicitly skips backend sync (lines 72-74)

3. **Token Management**
   - Supabase tokens stored in `apiClient` for backend API calls
   - Backend doesn't issue its own auth tokens
   - JWT sync is optional, non-blocking

### Routes
- Login: `/login` (NOT `/auth/login`)
- Register: `/register` (NOT `/auth/register`)
- Dashboard: `/dashboard` (redirect target after login)
- Forgot Password: `/auth/forgot-password`

---

## 📋 Test Corrections Needed

### 1. Remove Backend API Expectations
**Files to Fix**:
- `tests/01-user-auth/login.spec.ts`
- `tests/01-user-auth/registration.spec.ts`
- `tests/01-user-auth/password.spec.ts`

**Changes**:
```typescript
// ❌ REMOVE these expectations:
const loginRequestPromise = page.waitForRequest(request =>
  request.url().includes('/api/auth/login') &&
  request.method() === 'POST'
);

// ✅ REPLACE with Supabase detection:
// Supabase auth happens through SDK, check for:
// - Success toast message
// - Redirect to /dashboard
// - Session storage/cookies updated
```

### 2. Fix URL Patterns
```typescript
// ❌ WRONG:
await page.waitForURL('**/auth/register')
await page.waitForURL('**/auth/login')

// ✅ CORRECT:
await page.waitForURL('**/register')
await page.waitForURL('**/login')
```

### 3. Fix Success Redirect
```typescript
// ❌ WRONG:
await page.waitForURL('**/dashboard', { timeout: 10000 });

// ✅ CORRECT: (already correct, just needs Supabase user to exist)
await page.waitForURL('**/dashboard', { timeout: 10000 });
```

### 4. Error Message Expectations
Error messages come from Supabase, not custom backend:
- Supabase: "Invalid login credentials"
- Backend (NOT USED): "이메일 또는 비밀번호가 올바르지 않습니다"

Tests need to check for Supabase error formats.

---

## 🔧 Backend Integration Points

### What Backend IS Used For:
1. **Profile Management** (after auth)
   - `AuthAPI.getProfile()` - Load extended profile data
   - `AuthAPI.createProfile()` - Create profile on first login
   - Optional, fails gracefully

2. **Business Logic** (after auth)
   - Bookings, reservations, reviews
   - Shop management
   - Points, referrals, feed
   - All protected by Supabase tokens

### What Backend IS NOT Used For:
1. ❌ User registration
2. ❌ Login authentication
3. ❌ Password resets
4. ❌ Email verification
5. ❌ Social authentication
6. ❌ Session management
7. ❌ Token issuance

---

## 🎯 Test Strategy Revision

### Option 1: Update Tests to Match Supabase Architecture (RECOMMENDED)
**Pros**:
- Tests match actual implementation
- Tests verify real user experience
- No backend changes needed

**Cons**:
- Requires rewriting auth test suite
- Need to handle Supabase test users

**Implementation**:
1. Remove `/api/auth/*` endpoint expectations
2. Test Supabase auth flow:
   - Fill form → submit → check for success indicators
   - Success: Toast + redirect to dashboard
   - Failure: Error message display
3. Use `.env.test` credentials that exist in Supabase

### Option 2: Change App to Use Backend API (NOT RECOMMENDED)
**Pros**:
- Tests would work as-is

**Cons**:
- ❌ Major architectural change
- ❌ Removes Supabase Auth benefits
- ❌ Requires complete auth system rewrite
- ❌ Breaks existing functionality
- ❌ Not aligned with project requirements

---

## 📊 Test User Requirements

### For Supabase Auth Tests
Tests need real Supabase users:
- **Test User**: e2etest@test.com (needs to be created in Supabase)
- **Shop Owner**: shopowner@test.com (already exists)
- **Admin**: admin@test.com (already exists)

### Creating Test Users
**Option A**: Create via Supabase Dashboard
**Option B**: Use registration flow in tests (first test creates user)
**Option C**: Use Supabase Admin API to create test users programmatically

---

## 🚀 Next Steps

### Immediate (High Priority)
1. ✅ Document architecture mismatch (THIS FILE)
2. ⏸️ Create test user in Supabase (e2etest@test.com)
3. ⏸️ Update login.spec.ts to remove `/api/auth/login` expectations
4. ⏸️ Update URL patterns in all auth tests
5. ⏸️ Update error message expectations

### Short Term
1. Rewrite auth test suite to match Supabase flow
2. Create Supabase test user management utilities
3. Update page objects to work with Supabase Auth
4. Document Supabase test account credentials

### Long Term
1. Consider creating E2E helper for Supabase auth setup
2. Add tests for backend profile sync (optional functionality)
3. Document when backend IS used (post-auth business logic)

---

## 📝 Key Takeaways

1. **App Architecture is CORRECT** - Using Supabase Auth as designed
2. **Tests Architecture is WRONG** - Written for non-existent REST API
3. **Backend Exists** - But for business logic, not auth
4. **Fix Strategy**: Update tests to match Supabase flow, not vice versa
5. **No Backend Changes Needed** - Architecture is sound

---

## 🔍 Files Referenced

### Frontend
- `/home/bitnami/ebeautything-app/src/app/(auth)/login/page.tsx` - Login UI
- `/home/bitnami/ebeautything-app/src/contexts/auth-context.tsx` - Auth logic (line 319)

### Tests
- `/home/bitnami/e2e-tests/tests/01-user-auth/login.spec.ts` - Login tests
- `/home/bitnami/e2e-tests/page-objects/auth/LoginPage.ts` - Login page object

### Backend (For Reference Only)
- Backend has `/api/auth/login` endpoint
- But frontend doesn't use it
- Backend is for post-auth business logic

---

**Last Updated**: 2025-11-12 10:05:00 UTC
**Status**: Critical architecture discovery documented
**Next Action**: Create Supabase test user and update test expectations
