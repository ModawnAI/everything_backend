# Failing Admin API Endpoints - Fix Tracker

## Test Results Summary

### ✅ PASSED (28 endpoints)
- All authentication endpoints
- All shop management list/search/verification endpoints
- All shop approval endpoints
- All user management list/search/analytics endpoints
- User status endpoints
- All reservation endpoints

### ❌ FAILED (10 endpoints)

1. **GET /api/admin/shops/:shopId/moderation-history** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-moderation.routes.ts:151`
   - Controller: `admin-moderation.controller.ts`

2. **GET /api/admin/shops/:shopId/services** - 404 "샵을 찾을 수 없습니다"
   - Status: Not Fixed
   - Route: `src/routes/admin-shop-service.routes.ts`
   - Controller: `admin-shop-service.controller.ts:112`

3. **GET /api/admin/users/audit/search** - 500 "Failed to search audit logs"
   - Status: Not Fixed
   - Route: `src/routes/admin-user.routes.ts`
   - Controller: TBD

4. **GET /api/admin/users/status-stats** - 404 "User not found"
   - Status: Not Fixed
   - Route: `src/routes/admin-user.routes.ts`
   - Controller: TBD

5. **GET /api/admin/payments** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-payment.routes.ts:471`
   - Controller: `admin-payment.controller.ts`

6. **GET /api/admin/payments/analytics** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-payment.routes.ts:609`
   - Controller: `admin-payment.controller.ts`

7. **GET /api/admin/payments/summary** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-payment.routes.ts:517`
   - Controller: `admin-payment.controller.ts`

8. **GET /api/admin/payments/settlements** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-payment.routes.ts:563`
   - Controller: `admin-payment.controller.ts`

9. **GET /api/admin/analytics/dashboard** - TIMEOUT (15s)
   - Status: Not Fixed
   - Route: `src/routes/admin-analytics.routes.ts:272`
   - Controller: `admin-analytics.controller.ts`

10. **GET /api/admin/analytics/*** (realtime, health, cache/stats) - ALL TIMEOUT (15s)
    - Status: Not Fixed
    - Route: `src/routes/admin-analytics.routes.ts`
    - Controller: `admin-analytics.controller.ts`

### ⏭️ SKIPPED (multiple endpoints - write/update/delete operations)

## Fix Plan

### Priority 1: Fix 404/500 Errors (Logic Issues)
1. Shop services 404 error
2. User audit search 500 error
3. User status-stats 404 error

### Priority 2: Fix Timeout Issues (Performance/Query Issues)
4. Moderation history timeout
5. All payment endpoints timeout
6. All analytics endpoints timeout
