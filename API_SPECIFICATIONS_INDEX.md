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

### 4. [FRONTEND_BACKEND_API_SUMMARY.md](./FRONTEND_BACKEND_API_SUMMARY.md)
**Quick Reference Comparison**
- Side-by-side comparison of Service Catalog vs Users
- Fix checklist for Service Catalog
- Response structure examples
- Testing commands

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

4. **Quick Reference**: Use [FRONTEND_BACKEND_API_SUMMARY.md](./FRONTEND_BACKEND_API_SUMMARY.md)
   - Compare both endpoints side-by-side
   - Copy transform code examples

### For Backend Developers:

- These specs document the **actual current state** of the API
- Any changes to response structure should update these docs
- Maintain consistency with camelCase field naming

## 📊 Sample Data Available

The backend has been seeded with:
- **792 services** across 4 categories (nail, eyelash, waxing, eyebrow_tattoo)
- **5 users** with varying roles and statuses
- **8 admin users** with different roles and permissions
- **315 reservations** with various statuses, linked to users, shops, and services
- **213 shops** with complete information
- All data in Korean for realistic testing

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

## 📝 Notes

- All responses follow the pattern: `{ success: true, data: {...} }`
- Frontend auto-unwrap removes the wrapper, leaving just `{...}`
- Backend uses snake_case in database, camelCase in API responses (for Users and Reservations)
- Service Catalog still uses some snake_case fields (needs frontend transform)
- Reservations include rich nested relationships automatically (customer, shop, services, payments)

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
