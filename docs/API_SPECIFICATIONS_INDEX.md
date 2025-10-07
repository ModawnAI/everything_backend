# API Specifications Index

This directory contains the actual API specifications for the backend, showing exactly what data is returned and how the frontend should handle it.

## 📄 Documents

### 1. [ACTUAL_SERVICE_CATALOG_API_SPEC.md](./ACTUAL_SERVICE_CATALOG_API_SPEC.md)
**Service Catalog Endpoint Specification**
- What the backend actually returns
- Field mappings (duration_minutes → duration, service_images → images)
- Missing fields that need defaults (service_level, rating_average, etc.)
- Transform function example
- All related endpoints (stats, config, popular, trending)

### 2. [ACTUAL_USERS_API_SPEC.md](./ACTUAL_USERS_API_SPEC.md)
**Users/Admin User Management Endpoint Specification**
- What the backend actually returns
- Database schema → API response mapping
- All fields already in camelCase ✅
- Computed fields (daysSinceLastLogin, isActive, hasCompletedProfile)
- Query parameters and filtering
- All related endpoints (roles, statuses, activity, bulk actions)

### 3. [ACTUAL_RESERVATIONS_API_SPEC.md](./ACTUAL_RESERVATIONS_API_SPEC.md)
**Reservations/Bookings Endpoint Specification**
- What the backend actually returns
- Database schema → API response mapping
- All fields already in camelCase ✅
- Nested relationships (customer, shop, services, payments)
- Computed fields (daysUntilReservation, totalPaidAmount, outstandingAmount, isOverdue, etc.)
- Rich filtering and search capabilities
- All related endpoints (status updates, disputes, analytics)

### 4. [ACTUAL_ANALYTICS_DASHBOARD_API_SPEC.md](./ACTUAL_ANALYTICS_DASHBOARD_API_SPEC.md)
**Analytics & Dashboard Endpoint Specification**
- Admin analytics comprehensive dashboard (camelCase) ✅
- Shop dashboard overview (snake_case) ⚠️
- Real-time metrics and trends
- Business intelligence and KPIs
- Export functionality (CSV, JSON, Excel)
- System health monitoring
- All 11 analytics/dashboard endpoints documented

**⚡ PERFORMANCE UPDATE**: Optimized version now available!
- **Old endpoints**: 5-10 seconds response time (documented above)
- **New endpoints**: < 10ms response time using materialized views ✨
- See [ANALYTICS_IMPLEMENTATION_SUMMARY.md](./ANALYTICS_IMPLEMENTATION_SUMMARY.md) for details

### 5. [ACTUAL_SHOP_APPROVAL_ANALYTICS_API_SPEC.md](./ACTUAL_SHOP_APPROVAL_ANALYTICS_API_SPEC.md)
**Shop Approval & Analytics Specification**
- Shop approval queue and workflow (snake_case) ⚠️
- Shop analytics and performance metrics (snake_case) ⚠️
- Approval processing and document verification
- Performance rankings and commission analytics
- Growth tracking and retention metrics
- 15 endpoints for approval and analytics workflows

### 6. [ACTUAL_PAYMENTS_POINTS_REFUNDS_API_SPEC.md](./ACTUAL_PAYMENTS_POINTS_REFUNDS_API_SPEC.md)
**Payments, Points, and Refunds Specification**
- Payment API with two-stage payment system (snake_case) ⚠️
- Point system with FIFO usage tracking (snake_case) ⚠️
- Refund workflow and processing (snake_case) ⚠️
- TossPayments integration flow
- Admin payment management and analytics
- Complete transform examples for frontend
- 20+ endpoints covering payment lifecycle

### 7. [FRONTEND_BACKEND_API_SUMMARY.md](./FRONTEND_BACKEND_API_SUMMARY.md)
**Quick Reference Comparison**
- Side-by-side comparison of Service Catalog vs Users
- Fix checklist for Service Catalog
- Response structure examples
- Testing commands

### 8. [ANALYTICS_IMPLEMENTATION_SUMMARY.md](./ANALYTICS_IMPLEMENTATION_SUMMARY.md) ⚡ **NEW**
**Optimized Analytics Implementation (< 10ms response)**
- 100-1000x performance improvement using materialized views
- Complete backend implementation (migrations, service, controller, routes)
- Frontend integration guide with React components
- Deployment instructions and verification checklist
- Architecture diagrams and data flow
- **Performance**: 5-10s → < 10ms (100-1000x faster)

### 9. [FRONTEND_ANALYTICS_INTEGRATION_GUIDE.md](./FRONTEND_ANALYTICS_INTEGRATION_GUIDE.md) ⚡ **NEW**
**Complete Frontend Integration Guide**
- TypeScript interfaces for all analytics types
- API service class with optimized methods
- React components (Dashboard, Charts, Tables)
- Utility functions (formatting, dates)
- Complete working examples
- Testing instructions and migration checklist

## 🔑 Key Findings

### Service Catalog (`/api/service-catalog`)
- ⚠️ **Needs frontend transform**
- Field names don't match: `duration_minutes` vs `duration`
- Image format: `service_images` array of objects vs `images` array of strings
- Missing fields need defaults: `service_level`, `difficulty_level`, `is_featured`, `is_trending`, `rating_average`, `booking_count`, `tags`

### Users (`/api/admin/users`)
- ✅ **Already working correctly**
- All fields in camelCase
- Extended pagination info (currentPage, totalPages)
- Bonus computed fields

### Reservations (`/api/admin/reservations`)
- ✅ **Already working correctly**
- All fields in camelCase
- Rich nested relationships (customer, shop, services, payments)
- Extended pagination info (currentPage, totalPages)
- Bonus computed fields (daysUntilReservation, isOverdue, totalPaidAmount, etc.)

### Analytics & Dashboard
- ✅ **Admin Analytics** (`/api/admin/analytics/*`) - Already camelCase
- ⚠️ **Shop Dashboard** (`/api/shop/dashboard/*`) - Uses snake_case
- Comprehensive metrics: users, revenue, shops, reservations, payments, referrals
- Real-time updates and trend analysis
- Business intelligence with KPIs and insights
- Export functionality (CSV, JSON, Excel)
- System health monitoring

### Shop Approval & Analytics
- ⚠️ **Shop Approval** (`/api/admin/shops/approval`) - Uses snake_case
- ⚠️ **Shop Analytics** (`/api/admin/shops/analytics`) - Uses snake_case
- Complete approval workflow with document verification
- Risk assessment and compliance scoring
- Performance rankings and commission analytics
- Growth tracking and retention metrics
- Comprehensive shop performance analysis

### Payments, Points, and Refunds
- ⚠️ **Payment API** (`/api/payments/*`, `/api/admin/payments/*`) - Uses snake_case
- ⚠️ **Point System** (`/api/points/*`, `/api/users/:userId/points/*`) - Uses snake_case
- ⚠️ **Refund API** (`/api/refunds/*`) - Uses snake_case
- Two-stage payment system (deposit + final)
- TossPayments integration for Korean market
- FIFO point usage with expiration tracking
- Comprehensive refund workflow with policy engine
- Admin payment analytics and settlement reports
- 20+ endpoints covering complete payment lifecycle

## 🔧 How to Use These Specs

### For Frontend Developers:

1. **Service Catalog**: Read [ACTUAL_SERVICE_CATALOG_API_SPEC.md](./ACTUAL_SERVICE_CATALOG_API_SPEC.md)
   - Implement the transform function shown in the spec
   - Fix the data access bug (response.data → response)
   - Use defaults for missing fields

2. **Users**: Read [ACTUAL_USERS_API_SPEC.md](./ACTUAL_USERS_API_SPEC.md)
   - Use response fields directly (already in camelCase)
   - Take advantage of computed fields

3. **Reservations**: Read [ACTUAL_RESERVATIONS_API_SPEC.md](./ACTUAL_RESERVATIONS_API_SPEC.md)
   - Use response fields directly (already in camelCase)
   - Access nested relationships (customer, shop, services, payments)
   - Take advantage of computed fields

4. **Analytics & Dashboard**: Read [ACTUAL_ANALYTICS_DASHBOARD_API_SPEC.md](./ACTUAL_ANALYTICS_DASHBOARD_API_SPEC.md)
   - **Admin Analytics** - Use directly (already camelCase)
   - **Shop Dashboard** - Implement transform for snake_case → camelCase
   - 11 endpoints covering all analytics needs
   - Rich business intelligence and KPIs

5. **Shop Approval & Analytics**: Read [ACTUAL_SHOP_APPROVAL_ANALYTICS_API_SPEC.md](./ACTUAL_SHOP_APPROVAL_ANALYTICS_API_SPEC.md)
   - **Shop Approval** - Implement transform for snake_case → camelCase
   - **Shop Analytics** - Implement transform for snake_case → camelCase
   - 15 endpoints for approval workflow and analytics
   - Complete documentation with transform examples

6. **Payments, Points, and Refunds**: Read [ACTUAL_PAYMENTS_POINTS_REFUNDS_API_SPEC.md](./ACTUAL_PAYMENTS_POINTS_REFUNDS_API_SPEC.md)
   - **Payment API** - Implement transform for snake_case → camelCase
   - **Point System** - Implement transform for snake_case → camelCase
   - **Refund API** - Implement transform for snake_case → camelCase
   - Two-stage payment flow (deposit + final)
   - TossPayments integration guide
   - FIFO point usage system
   - Complete refund workflow
   - 20+ endpoints with transform examples

7. **Quick Reference**: Use [FRONTEND_BACKEND_API_SUMMARY.md](./FRONTEND_BACKEND_API_SUMMARY.md)
   - Compare both endpoints side-by-side
   - Copy transform code examples

### For Backend Developers:

- These specs document the **actual current state** of the API
- Any changes to response structure should update these docs
- Maintain consistency with camelCase field naming

## 📊 Sample Data Available

The backend has been seeded with:
- **792 services** across 4 categories (nail, eyelash, waxing, eyebrow_tattoo)
- **22 users** with varying roles and statuses
- **8 admin users** with different roles and permissions
- **315 reservations** with various statuses, linked to users, shops, and services
- **223 shops** with complete information
- **7 payments** - various statuses (fully_paid, deposit_paid, pending)
- **124 point transactions** - earn and use transactions with FIFO tracking
- **0 refunds** - table exists and ready to be populated
- All data in Korean for realistic testing
- **Analytics data** - Full metrics from all seeded data available via analytics endpoints

## 🧪 Testing

### Service Catalog
```bash
curl 'http://localhost:3001/api/service-catalog?limit=2'
```

### Users (requires auth)
```bash
curl 'http://localhost:3001/api/admin/users?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Reservations (requires auth)
```bash
curl 'http://localhost:3001/api/admin/reservations?limit=2' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Admin Analytics Dashboard (requires auth)
```bash
curl 'http://localhost:3001/api/admin/analytics/dashboard?period=month' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Shop Dashboard (requires auth)
```bash
curl 'http://localhost:3001/api/shop/dashboard' \
  -H "Authorization: Bearer YOUR_SHOP_OWNER_TOKEN"
```

### Payments (requires auth)
```bash
# Get payment details
curl 'http://localhost:3001/api/payments/PAYMENT_ID' \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get user payment history
curl 'http://localhost:3001/api/payments/user/USER_ID?page=1&limit=10' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Points (requires auth)
```bash
# Get point balance
curl 'http://localhost:3001/api/users/USER_ID/points/balance' \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get point transaction history
curl 'http://localhost:3001/api/users/USER_ID/points/history?page=1&limit=20' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Admin Payments (requires admin auth)
```bash
curl 'http://localhost:3001/api/admin/payments?limit=10' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

## 📝 Notes

- All responses follow the pattern: `{ success: true, data: {...} }`
- Frontend auto-unwrap removes the wrapper, leaving just `{...}`
- Backend uses snake_case in database, camelCase in API responses (for Users, Reservations, Admin Analytics)
- APIs using snake_case (need frontend transform):
  - Service Catalog (`/api/service-catalog`)
  - Shop Dashboard (`/api/shop/dashboard`)
  - Shop Approval & Analytics (`/api/admin/shops/approval`, `/api/admin/shops/analytics`)
  - Payments (`/api/payments/*`, `/api/admin/payments/*`)
  - Points (`/api/points/*`, `/api/users/:userId/points/*`)
  - Refunds (`/api/refunds/*`)
- Reservations include rich nested relationships automatically (customer, shop, services, payments)
- Admin Analytics provides comprehensive dashboard with 8 major metric categories
- Payment system uses two-stage flow: deposit (20-30%) → final payment (70-80%)
- Point system uses FIFO (First In, First Out) for point usage
- TossPayments integration for Korean market payment processing
- Export functionality available in CSV, JSON, Excel formats

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
