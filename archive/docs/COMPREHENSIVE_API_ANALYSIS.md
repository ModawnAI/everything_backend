# Comprehensive API Analysis - Frontend vs Backend Mapping

**Date**: 2025-10-15
**Analysis Type**: Deep comparison of frontend API calls vs backend route implementations
**Purpose**: Identify all untested endpoints, missing routes, and operation gaps

---

## Executive Summary

### Analysis Scope
- **Backend Routes Analyzed**: 80+ route files
- **Frontend Services Analyzed**: 27+ service files with API calls
- **Test Coverage**: ~15 endpoints tested so far
- **Missing Tests**: ~150+ endpoints require verification

### Critical Findings
1. 🔴 **CRUD operations fail** after successful creation (GET/PUT/DELETE return 404)
2. ⚠️ **Missing routes**: Dashboard stats, service catalog categories
3. ❌ **Untested areas**: 95% of admin endpoints, all shop owner endpoints
4. ⚠️ **Permission separation**: Shop vs super admin access not verified

---

## Backend Route Inventory

### Admin Routes (Requires Super Admin)

#### 1. Admin Authentication (`/api/admin/auth`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/login` | POST | ✅ | `AuthService.login()` | Working |
| `/refresh` | POST | ❌ | `AuthService.refreshAccessToken()` | Auto-used by interceptor |
| `/logout` | POST | ❌ | `AuthService.logout()` | Untested |
| `/validate` | GET | ✅ | Auto-called by middleware | Working |
| `/profile` | GET | ✅ | Frontend auth pages | Working |
| `/sessions` | GET | ✅ | Admin dashboard | Returns 22 sessions |
| `/change-password` | POST | ❌ | Admin profile page | Untested |
| `/csrf` | GET | ❌ | `apiService.fetchCsrfToken()` | Called automatically |

**Status**: 50% tested (4/8 endpoints)

#### 2. Admin Shop Management (`/api/admin/shops`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ✅ | Shop list page | Working with nested services |
| `/?status=active` | GET | ✅ | Filtered shop list | Working |
| `/:id` | GET | ❌ | Shop detail page | **CRITICAL: Untested** |
| `/` | POST | ❌ | Create shop form | **CRITICAL: Untested** |
| `/:id` | PUT | ❌ | Edit shop form | **CRITICAL: Untested** |
| `/:id` | DELETE | ❌ | Delete shop action | **CRITICAL: Untested** |
| `/:shopId/services` | GET | ✅ | Service list (verified in CRUD test) | Working |
| `/:shopId/services` | POST | ✅ | Create service | **Works - data persisted** |
| `/:shopId/services/:serviceId` | GET | ❌ 404 | Service detail | **CRITICAL BUG: Returns 404** |
| `/:shopId/services/:serviceId` | PUT | ❌ 404 | Update service | **CRITICAL BUG: Returns 404** |
| `/:shopId/services/:serviceId` | DELETE | ❌ 404 | Delete service | **CRITICAL BUG: Returns 404** |

**Status**: 36% tested (4/11 endpoints)
**Critical Issues**: Individual service operations fail despite successful creation

#### 3. Admin User Management (`/api/admin/users`)

Based on `AdminUsersService` frontend service:

| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ✅ | User list page | Working - returns paginated users |
| `/:id` | GET | ❌ | User detail page | `getUserDetails()` |
| `/:id/status` | PUT | ❌ | Status update form | `updateUserStatus()` |
| `/:id/role` | PUT | ❌ | Role management | `updateUserRole()` |
| `/bulk-action` | POST | ❌ | Bulk operations | `performBulkActions()` |
| `/statistics` | GET | ❌ | Dashboard stats | `getStatistics()` |
| `/analytics` | GET | ❌ | Analytics page | `getAnalytics()` |
| `/activity` | GET | ❌ | Activity logs | `getActivityLogs()` |
| `/search/advanced` | POST | ❌ | Advanced search | `advancedSearch()` |
| `/:userId/audit` | GET | ❌ | User audit logs | `getUserAuditLogs()` |
| `/audit/search` | GET | ❌ | Search all audits | `searchAuditLogs()` |
| `/audit/export` | POST | ❌ | Export audit data | `exportAuditLogs()` |
| `/bulk-action/:jobId/status` | GET | ❌ | Job status polling | `getBulkActionStatus()` |

**Status**: 8% tested (1/13 endpoints)

#### 4. Admin Reservations (`/api/admin/reservations`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ✅ | Reservations list | Working - returns paginated data |
| `/:id` | GET | ❌ | Reservation detail | **Untested** |
| `/:id/status` | PUT | ❌ | Update status | **Untested** |
| `/:id/cancel` | POST | ❌ | Cancel reservation | **Untested** |

**Status**: 25% tested (1/4 endpoints)

#### 5. Admin Dashboard (`/api/admin/dashboard`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/stats` | GET | ❌ | **404 - Route doesn't exist** | Frontend expects this |
| `/statistics` | GET | ❌ | Exists in frontend service | `getDashboardStatistics()` |

**Status**: 0% tested - **MISSING IMPLEMENTATION**

#### 6. Admin Analytics (`/api/admin/analytics`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ✅ | Analytics dashboard | Working |
| `/realtime` | GET | ❌ | Real-time stats | **Untested** |
| `/export` | POST | ❌ | Data export | **Untested** |

**Status**: 33% tested (1/3 endpoints)

#### 7. Admin Security (`/api/admin/security`)

Based on `AdminUsersService`:

| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/users/:userId/sessions` | GET | ❌ | Session management | `getUserSessions()` |
| `/users/:userId/invalidate-sessions` | POST | ❌ | Force logout | `invalidateUserSessions()` |
| `/bulk-invalidate-sessions` | POST | ❌ | Mass logout | `bulkInvalidateSessions()` |
| `/events` | GET | ❌ | Security events | `getSecurityEvents()` |

**Status**: 0% tested

#### 8. Admin Moderation (`/api/admin/moderation`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/users/:userId/warn` | POST | ❌ | Warning system | `warnUser()` |
| `/users/:userId/suspend` | POST | ❌ | Suspension | `suspendUser()` |
| `/users/:userId/ban` | POST | ❌ | Ban user | `banUser()` |
| `/users/:userId/unban` | POST | ❌ | Unban user | `unbanUser()` |

**Status**: 0% tested

#### 9. Admin Payments (`/api/admin/payments`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/` | GET | ❌ | Untested | Payment list |
| `/:id` | GET | ❌ | Untested | Payment detail |
| `/management` | * | ❌ | Untested | Payment management routes |

**Status**: 0% tested

#### 10. Admin Financial (`/api/admin/financial`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| Multiple routes | * | ❌ | Untested | Financial management |

**Status**: 0% tested

#### 11. Admin Products (`/api/admin/products`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| Multiple routes | * | ❌ | Untested | Product management |

**Status**: 0% tested

#### 12. Admin Tickets (`/api/admin/tickets`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| Multiple routes | * | ❌ | Untested | Support ticket system |

**Status**: 0% tested

---

### Shop Owner Routes (Requires Shop Owner Role)

#### 1. Shop Services (`/api/shop/services`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ❌ | `ShopServiceList.tsx` | Service list |
| `/` | POST | ❌ | Create service form | Create new service |
| `/:id` | GET | ❌ | `ShopServiceDetailDrawer.tsx` | Service detail |
| `/:id` | PUT | ❌ | Edit service form | Update service |
| `/:id` | DELETE | ❌ | Delete action | Remove service |

**Status**: 0% tested - **CRITICAL GAP**

#### 2. Shop Operating Hours (`/api/shop/operating-hours`)
| Route | Method | Tested | Frontend Usage | Notes |
|-------|---------|---------|----------------|-------|
| `/` | GET | ❌ | `OperatingHoursManager.tsx` | Get hours |
| `/` | PUT | ❌ | Update hours form | Update hours |

**Status**: 0% tested

#### 3. Shop Dashboard (`/api/shop/dashboard`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/stats` | GET | ❌ | Untested | Shop statistics |

**Status**: 0% tested

#### 4. Shop Reservations (`/api/shops/:shopId/reservations`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/` | GET | ❌ | Untested | Reservation list |
| `/:id/status` | PUT | ❌ | Untested | Update status |

**Status**: 0% tested

#### 5. Shop Payments (`/api/shops/:shopId/payments`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| Multiple routes | * | ❌ | Untested | Payment management |

**Status**: 0% tested

#### 6. Shop Analytics (`/api/shops/:shopId/analytics`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| Multiple routes | * | ❌ | Untested | Shop analytics |

**Status**: 0% tested

---

### Public/User Routes (No Auth Required or User Auth)

#### 1. Service Catalog (`/api/service-catalog`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/` | GET | ✅ | Working | Returns paginated services |
| `/categories` | GET | ❌ **500** | **Route doesn't exist** | Frontend expects this |
| `/metadata` | GET | ❌ | Untested | Exists in backend |
| `/stats` | GET | ❌ | Untested | Exists in backend |
| `/config` | GET | ❌ | Untested | Exists in backend |
| `/popular` | GET | ❌ | Untested | Exists in backend |
| `/trending` | GET | ❌ | Untested | Exists in backend |
| `/:id` | GET | ❌ | Untested | Service detail |
| `/search` | GET | ❌ | Untested | Search services |

**Status**: 11% tested (1/9 endpoints)

#### 2. Shops (`/api/shops`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/` | GET | ❌ | Untested | Public shop list |
| `/:id` | GET | ❌ | Untested | Shop detail |
| `/search` | GET | ❌ | Untested | Search shops |
| `/categories` | GET | ❌ | Untested | Shop categories |

**Status**: 0% tested

#### 3. Reservations (`/api/reservations`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/` | POST | ❌ | Untested | Create reservation |
| `/:id` | GET | ❌ | Untested | Reservation detail |
| `/:id/cancel` | PUT | ❌ | Untested | Cancel reservation |

**Status**: 0% tested

#### 4. User Profile (`/api/users`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/profile` | GET | ❌ | Untested | User profile |
| `/profile` | PUT | ❌ | Untested | Update profile |
| `/favorites` | GET | ❌ | Untested | User favorites |
| `/favorites` | POST | ❌ | Untested | Add favorite |
| `/favorites/:id` | DELETE | ❌ | Untested | Remove favorite |

**Status**: 0% tested

#### 5. Payments (`/api/payments`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/prepare` | POST | ❌ | Untested | Payment preparation |
| `/confirm` | POST | ❌ | Untested | Payment confirmation |
| `/:id` | GET | ❌ | Untested | Payment status |
| `/webhook` | POST | ❌ | Untested | Payment webhook |

**Status**: 0% tested

#### 6. Authentication (`/api/auth`)
| Route | Method | Tested | Status | Notes |
|-------|---------|---------|--------|-------|
| `/login` | POST | ❌ | Untested | User login |
| `/register` | POST | ❌ | Untested | User registration |
| `/refresh` | POST | ❌ | Untested | Token refresh |
| `/social-login` | POST | ❌ | Untested | Google/Kakao/Naver |

**Status**: 0% tested

---

## Frontend Service Analysis

### Services Making API Calls

1. **`services/api.ts`** - Base API service with interceptors
   - Auto token refresh ✅
   - CSRF token handling ✅
   - Error transformation ✅
   - Retry logic ✅

2. **`services/admin-users.ts`** - Comprehensive admin user management
   - 13 endpoints defined
   - 0 tested
   - Full CRUD + analytics + audit + moderation

3. **`services/analytics.service.ts`** - Analytics endpoints
   - Multiple analytics routes
   - 1 tested (basic analytics)

4. **`services/payments.service.ts`** - Payment management
   - Payment operations
   - 0 tested

5. **`services/portone-payments.service.ts`** - PortOne integration
   - Payment gateway specific
   - 0 tested

6. **`services/reservation.ts`** - Reservation operations
   - Reservation CRUD
   - 0 tested

7. **`services/product.ts`** - Product management
   - Product operations
   - 0 tested

8. **`services/order.ts`** - Order management
   - Order operations
   - 0 tested

9. **`components/OperatingHoursManager.tsx`** - Shop hours
   - Uses `/api/shop/operating-hours`
   - 0 tested

10. **`components/shop/services/*`** - Shop service management
    - `ShopServiceList.tsx` - List services
    - `ShopServiceDetailDrawer.tsx` - Service detail
    - 0 tested

---

## Missing Implementations

### Backend Routes Not Implemented

1. **`/api/admin/dashboard/stats`** ❌
   - Frontend: `src/app/dashboard/system/shops/page.tsx` expects this
   - Backend: Route doesn't exist
   - Error: 404 "ROUTE_NOT_FOUND"

2. **`/api/service-catalog/categories`** ❌
   - Frontend: Service catalog expects categories
   - Backend: Only `/metadata` exists, not `/categories`
   - Error: 500 Internal Server Error
   - Fix: Either rename `/metadata` to `/categories` or create `/categories` endpoint

### Frontend Calls Without Backend Routes

1. Dashboard statistics endpoint mismatch
2. Service catalog categories vs metadata naming

---

## Critical Bug Analysis

### CRUD Operations Failure

**Issue**: After successful CREATE, individual GET/PUT/DELETE return 404

**Evidence**:
```bash
POST /api/admin/shops/:shopId/services → ✅ 201 (creates service)
GET /api/admin/shops/:shopId/services → ✅ 200 (shows created service in list)
GET /api/admin/shops/:shopId/services/:serviceId → ❌ 404 "SERVICE_NOT_FOUND"
```

**Created Test Data**:
- Service ID: `82fee67f-b9ab-4118-889a-767619a35a0b`
- Shop ID: `11111111-1111-1111-1111-111111111111`
- Name: "테스트 젤네일"
- Verified in Supabase: ✅ EXISTS

**Root Cause Hypothesis**:
1. **Query filter mismatch**: `admin-shop-service.controller.ts:377-382`
   ```typescript
   .eq('id', serviceId)
   .eq('shop_id', shopId)
   .single()
   ```
   - Possible snake_case vs camelCase mismatch
   - Possible UUID format issue
   - Possible shopId parameter extraction issue

2. **Permission check failure**: Controller might be rejecting based on admin permissions

3. **Nested route parameter issue**: `:shopId` and `:serviceId` extraction problem

---

## Permission Testing Requirements

### Shop Owner vs Super Admin Separation

**Untested Scenarios**:

1. ✅ Super admin can access all shops
2. ❌ Shop owner can ONLY access their own shop
3. ❌ Shop owner CANNOT access other shops
4. ❌ Super admin can perform moderation actions
5. ❌ Shop owner CANNOT perform moderation actions
6. ❌ Cross-shop data access prevention

**Test Requirements**:
- Create shop owner user
- Verify access to own shop ✅
- Verify denial to other shops ❌ 403
- Create super admin user
- Verify access to all shops ✅

---

## Test Coverage Summary

### By Endpoint Category

| Category | Total Endpoints | Tested | % Coverage |
|----------|----------------|--------|------------|
| Admin Auth | 8 | 4 | 50% |
| Admin Shops | 11 | 4 | 36% |
| Admin Users | 13 | 1 | 8% |
| Admin Reservations | 4 | 1 | 25% |
| Admin Dashboard | 2 | 0 | 0% |
| Admin Analytics | 3 | 1 | 33% |
| Admin Security | 4 | 0 | 0% |
| Admin Moderation | 4 | 0 | 0% |
| Admin Payments | 3+ | 0 | 0% |
| Shop Services | 5 | 0 | 0% |
| Shop Operating Hours | 2 | 0 | 0% |
| Shop Dashboard | 1 | 0 | 0% |
| Service Catalog | 9 | 1 | 11% |
| Public Shops | 4 | 0 | 0% |
| Reservations | 3 | 0 | 0% |
| User Profile | 5 | 0 | 0% |
| Payments | 4 | 0 | 0% |
| User Auth | 4 | 0 | 0% |

**Overall**: ~15/100+ endpoints tested = **~10% coverage**

---

## Recommended Test Priorities

### P0 - Critical (Fix Immediately)

1. **Fix CRUD bug** - GET/PUT/DELETE service endpoints
   - Debug `admin-shop-service.controller.ts` query
   - Verify column names and filters
   - Test with actual service ID

2. **Implement missing routes**:
   - `/api/admin/dashboard/stats`
   - `/api/service-catalog/categories` (or rename `/metadata`)

### P1 - High Priority (Test Next)

3. **Complete Admin Shop CRUD**:
   - POST `/api/admin/shops` - Create shop
   - GET `/api/admin/shops/:id` - Get shop detail
   - PUT `/api/admin/shops/:id` - Update shop
   - DELETE `/api/admin/shops/:id` - Delete shop

4. **Admin User Management**:
   - GET `/api/admin/users/:id` - User detail
   - PUT `/api/admin/users/:id/status` - Update status
   - PUT `/api/admin/users/:id/role` - Update role

5. **Shop Owner Endpoints**:
   - All `/api/shop/*` endpoints
   - Permission verification
   - Cross-shop access denial

### P2 - Medium Priority

6. **Admin Reservations CRUD**
7. **Security & Moderation**
8. **Analytics & Statistics**
9. **Service Catalog completeness**

### P3 - Low Priority

10. **Payment webhooks**
11. **Social login flows**
12. **Bulk operations**
13. **Export functionality**

---

## Supabase Integration Verification

### What Needs Verification

1. **CREATE operations**:
   - ✅ Shop services - VERIFIED working
   - ❌ Shops - Untested
   - ❌ Users - Untested
   - ❌ Reservations - Untested

2. **READ operations**:
   - ✅ Service list - VERIFIED working
   - ❌ Individual services - FAILING (404)
   - ✅ Shop list - VERIFIED working
   - ❌ Individual shops - Untested

3. **UPDATE operations**:
   - ❌ All PUT endpoints - Untested or failing

4. **DELETE operations**:
   - ❌ All DELETE endpoints - Untested or failing

### Schema Consistency

**Known Issues**:
- Backend queries use `shop_id` (snake_case)
- Frontend expects `shopId` (camelCase)
- Transformation middleware handles response conversion
- **Potential mismatch in query filters**

---

## Next Steps

### Immediate Actions

1. **Debug CRUD failure**:
   ```bash
   # Test direct Supabase query
   - Read controller code to understand query structure
   - Manually test Supabase query with service ID
   - Verify column names and data types
   - Check route parameter extraction
   ```

2. **Implement missing routes**:
   ```typescript
   // Add to dashboard.routes.ts
   router.get('/stats', dashboardController.getStats);

   // Fix or add to service-catalog.routes.ts
   router.get('/categories', serviceCatalogController.getCategories);
   ```

3. **Create comprehensive test suite**:
   ```bash
   # Shop CRUD test
   ./test-shop-crud.sh

   # User management test
   ./test-user-crud.sh

   # Permission separation test
   ./test-permissions.sh
   ```

### Test Script Creation Needed

1. `test-shop-crud.sh` - Complete shop CRUD verification
2. `test-user-management.sh` - User operations testing
3. `test-permissions.sh` - Role-based access control
4. `test-reservations.sh` - Reservation operations
5. `test-payments.sh` - Payment flow verification
6. `test-shop-owner.sh` - Shop owner specific endpoints

---

**Generated**: 2025-10-15
**Tool**: Claude Code Analysis
**Coverage**: Backend (80+ routes) + Frontend (27+ services)
**Purpose**: Comprehensive gap analysis for systematic testing
