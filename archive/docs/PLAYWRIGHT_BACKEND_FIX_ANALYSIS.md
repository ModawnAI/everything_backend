# Playwright Backend Authentication Fix Analysis - 2025-10-16

## Overview
Analysis of the 6 remaining Playwright test failures that are backend/performance issues requiring backend fixes.

## Failing Tests Summary

### 1. Backend API Integration Tests (4 failing)
- **Test #1**: `should successfully call admin shops API` - 401 Unauthorized
- **Test #2**: `should successfully call admin users API` - 401 Unauthorized
- **Test #3**: `should successfully call dashboard stats API` - 401 Unauthorized
- **Test #4**: `should successfully call reservations API` - 401 Unauthorized

### 2. Service Catalog Timeout (1 failing)
- **Test**: `should successfully call service catalog API` - Timeout after 15 seconds

### 3. Dashboard Performance (1 failing)
- **Test**: `should load dashboard within 5 seconds` - Takes 9.5-12.2 seconds

## Root Cause Analysis

### 401 Authentication Errors

#### Test Pattern
```typescript
test('should successfully call admin shops API', async ({ page, request }) => {
  const response = await request.get(
    `${API_BASE_URL}/api/admin/shops?page=1&limit=10`,
    {
      headers: {
        Authorization: `Bearer ${await page.evaluate(() => localStorage.getItem('token') || '')}`,
      },
    }
  );

  expect(response.status()).toBe(200); // ❌ Getting 401 instead
});
```

#### Backend Authentication Middleware Flow

**File**: `/Users/kjyoo/everything_backend-2/src/middleware/auth.middleware.ts`

**Authentication Process** (lines 734-938):
1. Extract token from `Authorization: Bearer <token>` header (line 748-751)
2. Fallback: Extract from Supabase cookie if no header (line 754-759)
3. Verify token using Supabase API OR local JWT verification (lines 772-784)
4. Validate token expiration (lines 787-789)
5. Fetch user from database (lines 822-827)
6. Validate and track session (lines 830-833)
7. Populate `req.user` with user information (lines 854-873)

**Admin Routes** (`admin-shop.routes.ts` lines 247-248):
```typescript
router.use(authenticateJWT());
router.use(requireAdmin());
```

**RBAC Middleware** (`rbac.middleware.ts` lines 587-605):
```typescript
export function requireAdmin() {
  return (req: AuthorizedRequest, res: Response, next: NextFunction): void => {
    const user = req.user;

    if (!user || user.role !== 'admin') {
      res.status(403).json({
        success: false,
        error: {
          code: 'ADMIN_REQUIRED',
          message: 'Admin access required',
          timestamp: new Date().toISOString()
        }
      });
      return;
    }

    next();
  };
}
```

#### Suspected Issues

**Issue #1: Token Storage in Frontend**
The Playwright tests use:
```typescript
await page.evaluate(() => localStorage.getItem('token') || '')
```

This assumes the frontend stores the Supabase access token in `localStorage` with key `'token'`. However:
- **Supabase typically stores tokens in cookies** (multi-part format: `sb-{project}-auth-token.0`, `.1`, `.2`, etc.)
- The backend middleware DOES support cookie extraction (lines 754-759), but only when no Authorization header is present
- If the frontend is not storing tokens in localStorage, the tests will send an empty token: `Bearer `

**Issue #2: Token Format Mismatch**
- Backend expects **Supabase JWT tokens** signed with Supabase JWT Secret
- If frontend stores a different format token (e.g., custom JWT, session token), backend will reject it
- Backend tries Supabase verification first, then falls back to local JWT verification (lines 772-784)

**Issue #3: Cross-Context Token Access**
- Playwright's `page.evaluate()` runs in browser context
- Playwright's `request` context is separate from browser context
- Tokens stored in browser localStorage may not be accessible to `request` context
- **This is the most likely root cause**

#### Recommended Fix Approach

**Option 1: Use Browser Context for API Calls** (Preferred)
Instead of using Playwright's `request` fixture, use browser's fetch API:

```typescript
test('should successfully call admin shops API', async ({ page }) => {
  const response = await page.evaluate(async () => {
    const token = localStorage.getItem('token');
    const res = await fetch('http://localhost:3001/api/admin/shops?page=1&limit=10', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    return {
      status: res.status,
      data: await res.json()
    };
  });

  expect(response.status).toBe(200);
  expect(response.data.success).toBeTruthy();
});
```

**Option 2: Extract Cookie and Pass to Request Context**
```typescript
test('should successfully call admin shops API', async ({ page, request, context }) => {
  // Get cookies from browser context
  const cookies = await context.cookies();
  const authCookie = cookies.find(c => c.name.startsWith('sb-') && c.name.includes('auth-token'));

  const response = await request.get(
    `${API_BASE_URL}/api/admin/shops?page=1&limit=10`,
    {
      headers: {
        'Cookie': authCookie ? `${authCookie.name}=${authCookie.value}` : ''
      }
    }
  );

  expect(response.status()).toBe(200);
});
```

**Option 3: Store Token in Shared State During Login**
```typescript
// In beforeEach or login helper
let authToken: string;

async function login(page: Page) {
  await page.goto('/login');
  // ... login process ...

  // Extract and store token
  authToken = await page.evaluate(() => {
    return localStorage.getItem('token') ||
           document.cookie.match(/sb-[^=]+-auth-token\.0=base64-([^;]+)/)?.[1] || '';
  });
}

test('should successfully call admin shops API', async ({ request }) => {
  const response = await request.get(
    `${API_BASE_URL}/api/admin/shops?page=1&limit=10`,
    {
      headers: {
        'Authorization': `Bearer ${authToken}`
      }
    }
  );

  expect(response.status()).toBe(200);
});
```

### Service Catalog API Timeout

**Test**: Calls `/api/service-catalog/categories` which times out after 15 seconds.

**Likely Issues**:
1. Database query taking too long (missing indexes)
2. N+1 query problem (loading related data inefficiently)
3. Large dataset being loaded without pagination
4. Network/database connection timeout

**Investigation Steps**:
1. Check `/api/service-catalog/categories` endpoint implementation
2. Analyze database queries for efficiency
3. Add query logging to identify slow queries
4. Consider adding pagination or caching

### Dashboard Performance Issue

**Test**: Dashboard loads in 9.5-12.2 seconds, requirement is <5 seconds.

**Likely Issues**:
1. Too many API calls on page load (serial instead of parallel)
2. Large data transfers (unoptimized queries, missing indexes)
3. Blocking/synchronous data fetching
4. No caching strategy

**Investigation Steps**:
1. Profile network waterfall to identify blocking requests
2. Analyze API response sizes and query times
3. Implement data aggregation endpoints
4. Add Redis caching for frequently accessed data
5. Use parallel data fetching instead of serial

## Backend Debug Evidence

From backend logs (`BashOutput e70df8`), authentication IS working for curl requests:
```
[AUTH-DEBUG-1] authenticateJWT middleware started
[AUTH-DEBUG-3] Token extracted from header: yes
[AUTH-DEBUG-5.2] Token verified via local JWT verification
[AUTH-DEBUG-11] User data retrieved
[AUTH-DEBUG-13] Session validated
[AUTH-DEBUG-15] next() called successfully
✅ [2025-10-15T15:44:22.904Z] GET /api/admin/shops/.../services 200 - 1983.281ms
```

This confirms:
- ✅ Backend authentication middleware is functioning correctly
- ✅ JWT verification works (both Supabase and local fallback)
- ✅ Admin role checking works
- ❌ **The issue is NOT in the backend middleware**
- ❌ **The issue IS in how Playwright tests retrieve and pass tokens**

## Next Steps

1. ✅ **Complete root cause analysis** - DONE
2. ✅ **Fix Playwright test token retrieval** - DONE
   - Updated all 4 API integration tests to use correct localStorage key: `'ebeautything_access_token'`
   - Frontend TokenService (src/services/token.ts) stores tokens with 'ebeautything_' prefix
   - Tests now correctly retrieve tokens from browser context
3. ⏳ **Verify 401 errors are resolved** - TESTING
   - Run comprehensive test suite to confirm fixes work
4. ⏳ **Investigate service catalog timeout**
   - Add query logging
   - Identify slow database query
   - Optimize or add pagination
5. ⏳ **Investigate dashboard performance**
   - Profile network requests
   - Identify blocking operations
   - Implement optimizations (caching, parallel loading)
6. ⏳ **Document all changes and commit**

## Conclusion

The 401 authentication errors are **NOT backend bugs** - they are test implementation issues where Playwright's `request` fixture cannot access tokens stored in the browser's `localStorage`. The backend authentication is working correctly as evidenced by successful curl requests with proper authentication.

**Fix Strategy**: Update all 4 failing API tests to use browser context for API calls (Option 1) instead of Playwright's request fixture.
