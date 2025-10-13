# Shop and Admin Endpoint Testing Guide

## Overview

This document provides testing procedures for the shop-scoped and admin platform endpoints that implement dashboard separation architecture.

## Architecture Summary

### 🔐 Security Layers (Defense in Depth)

```
Layer 1: JWT Authentication (authenticateJWT)
         ↓
Layer 2: Middleware Validation (validateShopAccess)
         ↓
Layer 3: Controller Filtering (ALWAYS filter by shop_id)
         ↓
Layer 4: Database Queries (shop_id in WHERE clause)
```

## Endpoint Structure

### Shop-Scoped Endpoints (Pattern: `/api/shops/:shopId/*`)
- **Purpose**: Shop owners/managers manage their own shop
- **Access Control**:
  - Platform admins (super_admin, admin) → Can access any shop
  - Shop roles (shop_owner, shop_manager, shop_admin, manager) → Only their own shop
- **Middleware Chain**: `authenticateJWT()` → `validateShopAccess`

### Admin Platform Endpoints (Pattern: `/api/admin/*`)
- **Purpose**: Platform admins manage all shops
- **Access Control**: Only platform admins (super_admin, admin)
- **Middleware Chain**: `authenticateJWT()` → `requireAdmin()`

## Implemented Endpoints

### ✅ Shop-Scoped Reservations

#### GET `/api/shops/:shopId/reservations`
**Controllers**: `src/controllers/shop-reservations.controller.ts:getShopReservations`
**Routes**: `src/routes/shop-reservations.routes.ts`
**Middleware**: `authenticateJWT()` + `validateShopAccess`

**Query Parameters**:
- `status` - Filter by reservation status
- `startDate` - Filter from date (YYYY-MM-DD)
- `endDate` - Filter to date (YYYY-MM-DD)
- `userId` - Filter by user ID
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 20, max: 100)

**Response**:
```json
{
  "success": true,
  "data": {
    "reservations": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5,
      "hasMore": true
    }
  }
}
```

#### PATCH `/api/shops/:shopId/reservations/:reservationId`
**Controllers**: `src/controllers/shop-reservations.controller.ts:updateReservationStatus`
**Routes**: `src/routes/shop-reservations.routes.ts`

**Request Body**:
```json
{
  "status": "confirmed",  // confirmed | completed | cancelled_by_shop | no_show
  "reason": "Service completed successfully",  // Required for cancellation
  "notes": "Customer satisfied"  // Optional
}
```

**Status Transitions Allowed**:
- `requested` → `confirmed`, `cancelled_by_shop`
- `confirmed` → `completed`, `cancelled_by_shop`, `no_show`
- `completed`, `cancelled_*`, `no_show` → No changes allowed

---

### ✅ Shop-Scoped Payments

#### GET `/api/shops/:shopId/payments`
**Controllers**: `src/controllers/shop-payments.controller.ts:getShopPayments`
**Routes**: `src/routes/shop-payments.routes.ts`
**Middleware**: `authenticateJWT()` + `validateShopAccess`

**Query Parameters**:
- `status` - Filter by payment status
- `paymentMethod` - Filter by payment method
- `startDate` - Filter from date
- `endDate` - Filter to date
- `userId` - Filter by user ID
- `reservationId` - Filter by reservation ID
- `minAmount` - Minimum payment amount
- `maxAmount` - Maximum payment amount
- `page` - Page number
- `limit` - Items per page

**Response**:
```json
{
  "success": true,
  "data": {
    "payments": [...],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3,
      "hasMore": true
    },
    "summary": {
      "totalAmount": 1000000,
      "totalRefunded": 50000,
      "netAmount": 950000
    }
  }
}
```

#### GET `/api/shops/:shopId/payments/:paymentId`
**Controllers**: `src/controllers/shop-payments.controller.ts:getPaymentDetails`
**Routes**: `src/routes/shop-payments.routes.ts`

**Response**: Detailed payment information including refund history

---

### ✅ Admin Platform Endpoints

#### GET `/api/admin/reservations`
**Controllers**: `src/controllers/admin-reservation.controller.ts:getReservations`
**Routes**: `src/routes/admin-reservation.routes.ts`
**Middleware**: `authenticateJWT()` + `requireRole('admin')`

**Query Parameters**:
- `shopId` - Optional filter by specific shop
- `status` - Filter by reservation status
- `userId` - Filter by customer
- `startDate`, `endDate` - Date range
- `search` - Search customer/shop name
- `minAmount`, `maxAmount` - Amount range
- `hasPointsUsed` - Filter by points usage
- `sortBy` - Sort field
- `sortOrder` - Sort order (asc/desc)
- `page`, `limit` - Pagination

**Response**: List of reservations across ALL shops with filters

#### GET `/api/admin/payments`
**Controllers**: `src/controllers/admin-payment.controller.ts:getPayments`
**Routes**: `src/routes/admin-payment.routes.ts`
**Middleware**: `authenticateJWT()` + `requireRole('admin')`

**Query Parameters**: Similar to reservations with payment-specific filters
**Response**: List of payments across ALL shops with analytics

---

## Testing Procedures

### Prerequisites

1. **Server Running**: `npm run dev`
2. **Database Seeded**: Ensure test data exists
3. **Authentication Tokens**:
   - Platform admin token (role: `admin` or `super_admin`)
   - Shop owner token (role: `shop_owner`, has `shop_id`)

### Test Scenarios

#### ✅ Test 1: Shop Owner Accessing Own Shop Reservations
```bash
# Replace with actual shopId from database
curl -X GET "http://localhost:3001/api/shops/{shopId}/reservations?page=1&limit=10" \
  -H "Authorization: Bearer {shop_owner_token}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with reservations for that shop
```

#### ❌ Test 2: Shop Owner Accessing Different Shop (Should Fail)
```bash
# Try to access a different shop's data
curl -X GET "http://localhost:3001/api/shops/{different_shopId}/reservations" \
  -H "Authorization: Bearer {shop_owner_token}" \
  -H "Content-Type: application/json"

# Expected: 403 Forbidden
# {
#   "success": false,
#   "error": {
#     "code": "SHOP_ACCESS_DENIED",
#     "message": "Access denied: You can only access your own shop"
#   }
# }
```

#### ✅ Test 3: Platform Admin Accessing Any Shop
```bash
# Admin can access any shop
curl -X GET "http://localhost:3001/api/shops/{any_shopId}/reservations" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with that shop's reservations
```

#### ✅ Test 4: Platform Admin Getting All Reservations
```bash
# Admin sees ALL shops
curl -X GET "http://localhost:3001/api/admin/reservations?page=1&limit=20" \
  -H "Authorization: Bearer {admin_token}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with reservations from ALL shops
```

#### ✅ Test 5: Update Reservation Status (Shop Owner)
```bash
curl -X PATCH "http://localhost:3001/api/shops/{shopId}/reservations/{reservationId}" \
  -H "Authorization: Bearer {shop_owner_token}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "notes": "Reservation confirmed by shop"
  }'

# Expected: 200 OK with updated reservation
```

#### ✅ Test 6: Get Shop Payments with Filters
```bash
curl -X GET "http://localhost:3001/api/shops/{shopId}/payments?status=completed&page=1&limit=10" \
  -H "Authorization: Bearer {shop_owner_token}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with payments, pagination, and summary
```

#### ✅ Test 7: Get Payment Details
```bash
curl -X GET "http://localhost:3001/api/shops/{shopId}/payments/{paymentId}" \
  -H "Authorization: Bearer {shop_owner_token}" \
  -H "Content-Type: application/json"

# Expected: 200 OK with detailed payment info including refund history
```

---

## Security Validation Checklist

### ✅ Data Isolation
- [ ] Shop owners can ONLY see their own shop's data
- [ ] Attempting to access other shops returns 403 Forbidden
- [ ] Platform admins can access any shop
- [ ] All database queries include `shop_id` filter

### ✅ Authentication
- [ ] All endpoints require valid JWT token
- [ ] Expired tokens return 401 Unauthorized
- [ ] Missing tokens return 401 Unauthorized

### ✅ Authorization
- [ ] `validateShopAccess` middleware blocks cross-shop access
- [ ] `requireAdmin()` middleware blocks non-admin access to admin endpoints
- [ ] Role validation works correctly

### ✅ Defense in Depth
- [ ] Middleware validates shop access
- [ ] Controllers double-check shop_id
- [ ] Database queries always filter by shop_id
- [ ] Audit logging captures access attempts

---

## Implementation Status

| Feature | Status | Files |
|---------|--------|-------|
| Shop-scoped Reservation Routes | ✅ Complete | `src/routes/shop-reservations.routes.ts` |
| Shop-scoped Reservation Controller | ✅ Complete | `src/controllers/shop-reservations.controller.ts` |
| Shop-scoped Payment Routes | ✅ Complete | `src/routes/shop-payments.routes.ts` |
| Shop-scoped Payment Controller | ✅ Complete | `src/controllers/shop-payments.controller.ts` |
| Shop Access Validation Middleware | ✅ Complete | `src/middleware/shop-access.middleware.ts` |
| Admin Reservation Routes | ✅ Complete | `src/routes/admin-reservation.routes.ts` |
| Admin Payment Routes | ✅ Complete | `src/routes/admin-payment.routes.ts` |
| App.ts Integration | ✅ Complete | `src/app.ts` (lines 386-387) |

---

## Key Security Features

### 1. Shop Access Validation (`validateShopAccess`)
Located in: `src/middleware/shop-access.middleware.ts`

**Logic**:
```typescript
// Platform admins can access ANY shop
if (role === 'super_admin' || role === 'admin') {
  return next(); // Allow access
}

// Shop roles must match their shop_id
if (userShopId !== shopId) {
  return 403; // Deny access
}
```

**Features**:
- Validates shopId format (alphanumeric, UUID)
- Verifies shop exists in database
- Checks shop status (active/suspended)
- Logs all access attempts
- Security event tracking for unauthorized attempts

### 2. Always Filter by shop_id

**Every controller query includes**:
```typescript
// Shop-scoped endpoint
.eq('shop_id', shopId)  // ALWAYS present, defense in depth

// Admin endpoint (optional filter)
if (shopId) {
  query = query.eq('shop_id', shopId);
}
```

### 3. Audit Trail

All shop access is logged:
```typescript
logger.info('📋 [AUDIT] Shop access logged', {
  userId: user.id,
  shopId,
  action: `${req.method} ${req.path}`,
  ipAddress: req.ip,
  timestamp: new Date().toISOString()
});
```

---

## Frontend Integration

The frontend should use a `ContextualApiService` that automatically transforms URLs:

```typescript
// Platform admin context
/api/reservations → /api/admin/reservations

// Shop context (shopId = "shop-123")
/api/reservations → /api/shops/shop-123/reservations
```

This ensures the frontend doesn't need to know about the routing structure and the backend enforces security at every layer.

---

## Next Steps

1. ✅ **Verify Current Implementation**: Endpoints are implemented and follow the spec
2. 🔄 **Run Test Suite**: Execute the test scenarios above
3. 📊 **Monitor Logs**: Check for security events and access patterns
4. 📝 **Document for Frontend**: Share endpoint structure with frontend team
5. 🔍 **Performance Testing**: Test with large datasets and concurrent requests

---

## Contact & Support

For questions about the implementation:
- **Backend Architecture**: Check `backend_12.md` for full specification
- **Security Concerns**: Review `src/middleware/shop-access.middleware.ts`
- **Database Queries**: See controller implementations for filtering logic

Last Updated: 2025-10-12
