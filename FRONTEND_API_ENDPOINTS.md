# Frontend API Endpoints Documentation

This document lists all API endpoints used in the eBeautyThing Admin frontend application.

**Last Updated:** 2025-10-07

---

## Table of Contents

- [Authentication](#authentication)
- [User Management](#user-management)
- [Shop Management](#shop-management)
- [Service Catalog](#service-catalog)
- [Bookings](#bookings)
- [Financial](#financial)
- [Products](#products)
- [Tickets](#tickets)
- [Dashboard](#dashboard)
- [Health Check](#health-check)

---

## Authentication

### Login
- **POST** `/api/admin/auth/login`
  - Request: `{ email, password, deviceInfo }`
  - Response: `{ success, token, refreshToken, data: { admin, tokens, session } }`
  - Used in: `src/services/auth.ts`

### Logout
- **POST** `/api/admin/auth/logout`
  - Request: `{ sessionId? }`
  - Response: `{ success, message }`
  - Used in: `src/services/auth.ts`

### Refresh Token
- **POST** `/api/admin/auth/refresh`
  - Request: `{ refreshToken }`
  - Response: `{ success, token, refreshToken }`
  - Used in: `src/services/auth.ts`

### Change Password
- **POST** `/api/admin/auth/change-password`
  - Request: `{ currentPassword, newPassword }`
  - Response: `{ success, message }`
  - Used in: `src/services/auth.ts`

### Get Profile
- **GET** `/api/admin/auth/profile`
  - Response: `{ success, data: { admin } }`
  - Used in: `src/services/auth.ts`

### Update Profile
- **PATCH** `/api/admin/auth/profile`
  - Request: `{ name?, email?, avatar? }`
  - Response: `{ success, data: { admin } }`
  - Used in: `src/services/auth.ts`

### Validate Session
- **POST** `/api/admin/auth/validate`
  - Request: `{ token }`
  - Response: `{ success, isValid, admin }`
  - Backend only

---

## User Management

### List Users
- **GET** `/api/admin/users`
  - Query: `?page=1&limit=20&role=&status=&search=`
  - Response: `{ success, data: { users, pagination } }`
  - Used in: `src/services/userManagement.ts`

### Get User by ID
- **GET** `/api/admin/users/:id`
  - Response: `{ success, data: { user } }`
  - Used in: `src/services/userManagement.ts`

### Create User
- **POST** `/api/admin/users`
  - Request: `{ email, password, name, role, permissions }`
  - Response: `{ success, data: { user } }`
  - Used in: `src/services/userManagement.ts`

### Update User
- **PUT** `/api/admin/users/:id`
  - Request: `{ name?, email?, role?, permissions? }`
  - Response: `{ success, data: { user } }`
  - Used in: `src/services/userManagement.ts`

### Delete User
- **DELETE** `/api/admin/users/:id`
  - Response: `{ success, message }`
  - Used in: `src/services/userManagement.ts`

### Get User Roles
- **GET** `/api/admin/users/roles`
  - Response: `{ success, data: { roles } }`
  - Backend only

---

## Shop Management

### List Shops
- **GET** `/api/admin/shops`
  - Query: `?page=1&limit=20&status=&category=&shopType=&verificationStatus=&sortBy=&sortOrder=`
  - Response: `{ success, data: { shops, pagination } }`
  - Used in: `src/services/shop.ts`, `src/hooks/api/useShop.ts`

### Create Shop
- **POST** `/api/admin/shops`
  - Request: `{ name, description, phone_number, email, address, ... }`
  - Response: `{ success, data: { shop } }`
  - Used in: `src/app/dashboard/system/shops/new/page.tsx`

### Get Shop by ID
- **GET** `/api/admin/shops/:id`
  - Response: `{ success, data: { shop } }`
  - Used in: `src/services/shop.ts`

### Update Shop
- **PUT** `/api/admin/shops/:id`
  - Request: `{ name?, description?, status?, ... }`
  - Response: `{ success, data: { shop } }`
  - Used in: `src/services/shop.ts`

### Delete Shop
- **DELETE** `/api/admin/shops/:id`
  - Response: `{ success, message }`
  - Used in: `src/services/shop.ts`

### Get Pending Shops
- **GET** `/api/admin/shops/pending`
  - Response: `{ success, data: { shops } }`
  - Backend only

### Search Shops
- **POST** `/api/admin/shops/search`
  - Request: `{ query, filters }`
  - Response: `{ success, data: { shops, pagination } }`
  - Backend only

### Get Verification Stats
- **GET** `/api/admin/shops/verification-stats`
  - Response: `{ success, data: { stats } }`
  - Used in: `src/app/dashboard/system/shops/analytics/page.tsx`

### Get Verification History
- **GET** `/api/admin/shops/:id/verification-history`
  - Response: `{ success, data: { history } }`
  - Backend only

### Get Verification Requirements
- **GET** `/api/admin/shops/:id/verification-requirements`
  - Response: `{ success, data: { requirements } }`
  - Backend only

### Approve/Reject Shop
- **PUT** `/api/admin/shops/:id/approve`
  - Request: `{ status: 'approved' | 'rejected', notes? }`
  - Response: `{ success, data: { shop } }`
  - Backend only

### Get Shop Services
- **GET** `/api/admin/shops/:id/services`
  - Response: `{ success, data: { services } }`
  - Used in: `src/app/dashboard/system/shops/[id]/services/page.tsx`

### Create Shop Service
- **POST** `/api/admin/shops/:id/services`
  - Request: `{ name, description, category, priceMin, priceMax, ... }`
  - Response: `{ success, data: { service } }`
  - Used in: `src/app/dashboard/system/shops/[id]/services/page.tsx`

### Get Service by ID
- **GET** `/api/admin/shops/:id/services/:serviceId`
  - Response: `{ success, data: { service } }`
  - Backend only

### Update Shop Service
- **PUT** `/api/admin/shops/:id/services/:serviceId`
  - Request: `{ name?, description?, priceMin?, ... }`
  - Response: `{ success, data: { service } }`
  - Used in: `src/app/dashboard/system/shops/[id]/services/page.tsx`

### Delete Shop Service
- **DELETE** `/api/admin/shops/:id/services/:serviceId`
  - Response: `{ success, message }`
  - Used in: `src/app/dashboard/system/shops/[id]/services/page.tsx`

### Get Approval Queue
- **GET** `/api/admin/shops/approval`
  - Response: `{ success, data: { shops, totalCount } }`
  - Used in: `src/app/dashboard/system/shops/approval/page.tsx`

### Get Approval Statistics
- **GET** `/api/admin/shops/approval/statistics`
  - Response: `{ success, data: { pending, approved, rejected } }`
  - Used in: `src/app/dashboard/system/shops/approval/page.tsx`

### Process Approval
- **PUT** `/api/admin/shops/approval/:id`
  - Request: `{ status, shopType?, commissionRate?, notes? }`
  - Response: `{ success, data: { shop } }`
  - Used in: `src/app/dashboard/system/shops/approval/page.tsx`

### Get Approval Details
- **GET** `/api/admin/shops/approval/:id/details`
  - Response: `{ success, data: { shop, verification } }`
  - Backend only

### Bulk Approval
- **POST** `/api/admin/shops/approval/bulk-approval`
  - Request: `{ shopIds, action: 'approve' | 'reject', shopType?, commissionRate? }`
  - Response: `{ success, data: { processed, failed } }`
  - Used in: `src/app/dashboard/system/shops/approval/page.tsx`

---

## Service Catalog

### List & Search

#### Get All Services
- **GET** `/api/service-catalog`
  - Query: `?q=&category=&price_min=&price_max=&duration_min=&duration_max=&service_level=&difficulty_level=&featured_only=&trending_only=&min_rating=&tags=&page=1&limit=20&sort_by=&sort_order=&include_unavailable=`
  - Response: `{ success, data: { services, totalCount, hasMore } }`
  - Used in: `src/services/serviceCatalog.ts`, `src/app/dashboard/services/page.tsx`
  - **Public Access** (No authentication required)

#### Advanced Search
- **GET** `/api/service-catalog/search`
  - Query: Same as Get All Services with enhanced relevance ranking
  - Response: `{ success, data: { services, totalCount, hasMore } }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

### Analytics & Stats

#### Get Statistics
- **GET** `/api/service-catalog/stats`
  - Response: `{ success, data: { totalServices, categoryCounts, averagePrice, averageRating } }`
  - Used in: `src/services/serviceCatalog.ts`, `src/app/dashboard/services/page.tsx`
  - **Public Access**

#### Get Metadata
- **GET** `/api/service-catalog/metadata`
  - Response: `{ success, data: { categories, serviceLevels, difficultyLevels } }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

#### Get UI Configuration
- **GET** `/api/service-catalog/config`
  - Response: `{ success, data: { categories, serviceLevels, priceRange } }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

### Featured & Trending

#### Get Popular Services
- **GET** `/api/service-catalog/popular`
  - Query: `?limit=10&category=`
  - Response: `{ success, data: [ { id, name, booking_count, rating_average, popularity_score } ] }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

#### Get Trending Services
- **GET** `/api/service-catalog/trending`
  - Query: `?limit=10`
  - Response: `{ success, data: [ { id, name, booking_count, rating_average, popularity_score } ] }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

### Detail

#### Get Service Details
- **GET** `/api/service-catalog/:serviceId`
  - Response: `{ success, data: { service } }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Public Access**

### Internal Management (Admin Only)

#### Update Popularity
- **PUT** `/api/service-catalog/:serviceId/popularity`
  - Request: `{ bookingCount, ratingAverage }`
  - Response: `{ success, message }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Requires Authentication**

#### Mark as Trending
- **PUT** `/api/service-catalog/:serviceId/trending`
  - Request: `{ isTrending }`
  - Response: `{ success, message }`
  - Used in: `src/services/serviceCatalog.ts`
  - **Requires Authentication**

---

## Bookings

### List Bookings
- **GET** `/api/admin/bookings`
  - Query: `?page=1&limit=20&status=&shopId=&customerId=&startDate=&endDate=`
  - Response: `{ success, data: { bookings, pagination } }`
  - Used in: `src/app/dashboard/bookings/page.tsx`

### Get Booking by ID
- **GET** `/api/admin/bookings/:id`
  - Response: `{ success, data: { booking } }`
  - Used in: `src/app/dashboard/bookings/[id]/page.tsx`

### Update Booking Status
- **PUT** `/api/admin/bookings/:id/status`
  - Request: `{ status, notes? }`
  - Response: `{ success, data: { booking } }`
  - Backend only

### Cancel Booking
- **POST** `/api/admin/bookings/:id/cancel`
  - Request: `{ reason, refundAmount? }`
  - Response: `{ success, data: { booking } }`
  - Backend only

---

## Financial

### Payments

#### List Payments
- **GET** `/api/admin/financial/payments`
  - Query: `?page=1&limit=20&status=&method=&startDate=&endDate=`
  - Response: `{ success, data: { payments, pagination } }`
  - Used in: `src/app/dashboard/financial/payments/page.tsx`

#### Get Payment by ID
- **GET** `/api/admin/financial/payments/:id`
  - Response: `{ success, data: { payment } }`
  - Backend only

### Points

#### List Points Transactions
- **GET** `/api/admin/financial/points`
  - Query: `?page=1&limit=20&userId=&type=&startDate=&endDate=`
  - Response: `{ success, data: { transactions, pagination } }`
  - Used in: `src/app/dashboard/financial/points/page.tsx`

### Refunds

#### List Refunds
- **GET** `/api/admin/financial/refunds`
  - Query: `?page=1&limit=20&status=&paymentId=&startDate=&endDate=`
  - Response: `{ success, data: { refunds, pagination } }`
  - Used in: `src/app/dashboard/financial/refunds/page.tsx`

#### Create Refund
- **POST** `/api/admin/financial/refunds`
  - Request: `{ paymentId, amount, reason, type }`
  - Response: `{ success, data: { refund } }`
  - Used in: `src/app/dashboard/financial/refunds/page.tsx`

#### Get Refund by ID
- **GET** `/api/admin/financial/refunds/:id`
  - Response: `{ success, data: { refund } }`
  - Backend only

#### Process Refund
- **PUT** `/api/admin/financial/refunds/:id`
  - Request: `{ status, processedBy, notes? }`
  - Response: `{ success, data: { refund } }`
  - Backend only

---

## Products

### List Products
- **GET** `/api/admin/products`
  - Query: `?page=1&limit=20&category=&status=&search=`
  - Response: `{ success, data: { products, pagination } }`
  - Backend only

### Get Product Categories
- **GET** `/api/admin/products/categories`
  - Response: `{ success, data: { categories } }`
  - Backend only

---

## Dashboard

### Get Overview Stats
- **GET** `/api/admin/dashboard/overview`
  - Query: `?timeRange=today|week|month|year`
  - Response: `{ success, data: { stats } }`
  - Backend only

### Get Realtime Stats
- **GET** `/api/admin/dashboard/stats/realtime`
  - Response: `{ success, data: { activeUsers, activeBookings, revenue } }`
  - Backend only

---

## Tickets

### Ticket CRUD

#### List Tickets
- **GET** `/api/admin/tickets`
  - Query: `?page=1&limit=20&status=&priority=&category=&assignedTo=&search=&dateFrom=&dateTo=`
  - Response: `{ success, data: { items, pagination } }`
  - Used in: `src/services/ticket.ts`

#### Get Ticket by ID
- **GET** `/api/admin/tickets/:id`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Create Ticket
- **POST** `/api/admin/tickets`
  - Request: `{ subject, description, priority, category, customerId?, ... }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Update Ticket
- **PATCH** `/api/admin/tickets/:id`
  - Request: `{ subject?, description?, priority?, category?, ... }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Delete Ticket
- **DELETE** `/api/admin/tickets/:id`
  - Response: `{ success, message }`
  - Used in: `src/services/ticket.ts`

### Ticket Status Management

#### Update Ticket Status
- **PATCH** `/api/admin/tickets/:id/status`
  - Request: `{ status, note? }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Assign Ticket
- **PATCH** `/api/admin/tickets/:id/assign`
  - Request: `{ assignedTo }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Reassign Ticket
- **PATCH** `/api/admin/tickets/:id/reassign`
  - Request: `{ assignedTo, reason? }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

#### Escalate Ticket
- **POST** `/api/admin/tickets/:id/escalate`
  - Request: `{ escalatedTo, reason }`
  - Response: `{ success, data: { ticket } }`
  - Used in: `src/services/ticket.ts`

### Ticket Responses

#### Get Ticket Responses
- **GET** `/api/admin/tickets/:ticketId/responses`
  - Response: `{ success, data: [ responses ] }`
  - Used in: `src/services/ticket.ts`

#### Add Ticket Response
- **POST** `/api/admin/tickets/:ticketId/responses`
  - Request: `FormData { content, isInternal?, attachments[] }`
  - Content-Type: `multipart/form-data`
  - Response: `{ success, data: { response } }`
  - Used in: `src/services/ticket.ts`

#### Update Ticket Response
- **PATCH** `/api/admin/tickets/:ticketId/responses/:responseId`
  - Request: `{ content }`
  - Response: `{ success, data: { response } }`
  - Used in: `src/services/ticket.ts`

#### Delete Ticket Response
- **DELETE** `/api/admin/tickets/:ticketId/responses/:responseId`
  - Response: `{ success, message }`
  - Used in: `src/services/ticket.ts`

### Auto-Response Templates

#### List Templates
- **GET** `/admin/ticket-templates`
  - Response: `{ success, data: [ templates ] }`
  - Used in: `src/services/ticket.ts`

#### Get Template by ID
- **GET** `/admin/ticket-templates/:id`
  - Response: `{ success, data: { template } }`
  - Used in: `src/services/ticket.ts`

#### Create Template
- **POST** `/admin/ticket-templates`
  - Request: `{ name, content, conditions, isActive, ... }`
  - Response: `{ success, data: { template } }`
  - Used in: `src/services/ticket.ts`

#### Update Template
- **PATCH** `/admin/ticket-templates/:id`
  - Request: `{ name?, content?, conditions?, isActive?, ... }`
  - Response: `{ success, data: { template } }`
  - Used in: `src/services/ticket.ts`

#### Delete Template
- **DELETE** `/admin/ticket-templates/:id`
  - Response: `{ success, message }`
  - Used in: `src/services/ticket.ts`

#### Test Template
- **POST** `/admin/ticket-templates/:templateId/test`
  - Request: `{ ticketId }`
  - Response: `{ success, data: { matches, preview } }`
  - Used in: `src/services/ticket.ts`

### Escalation Rules

#### List Escalation Rules
- **GET** `/admin/ticket-escalation-rules`
  - Response: `{ success, data: [ rules ] }`
  - Used in: `src/services/ticket.ts`

#### Create Escalation Rule
- **POST** `/admin/ticket-escalation-rules`
  - Request: `{ name, conditions, escalateTo, ... }`
  - Response: `{ success, data: { rule } }`
  - Used in: `src/services/ticket.ts`

#### Update Escalation Rule
- **PATCH** `/admin/ticket-escalation-rules/:id`
  - Request: `{ name?, conditions?, escalateTo?, ... }`
  - Response: `{ success, data: { rule } }`
  - Used in: `src/services/ticket.ts`

#### Delete Escalation Rule
- **DELETE** `/admin/ticket-escalation-rules/:id`
  - Response: `{ success, message }`
  - Used in: `src/services/ticket.ts`

### Statistics & Reporting

#### Get Ticket Statistics
- **GET** `/api/admin/tickets/statistics`
  - Query: `?dateFrom=&dateTo=`
  - Response: `{ success, data: { total, byStatus, byPriority, avgResolutionTime, ... } }`
  - Used in: `src/services/ticket.ts`

#### Get Ticket Activity
- **GET** `/api/admin/tickets/:ticketId/activity`
  - Response: `{ success, data: [ activities ] }`
  - Used in: `src/services/ticket.ts`

#### Export Tickets
- **GET** `/api/admin/tickets/export`
  - Query: Same filters as List Tickets
  - Response: `Blob` (CSV file)
  - Content-Type: `text/csv`
  - Used in: `src/services/ticket.ts`

### Bulk Operations

#### Bulk Update Status
- **POST** `/api/admin/tickets/bulk/status`
  - Request: `{ ticketIds, status }`
  - Response: `{ success, data: { updated, failed } }`
  - Used in: `src/services/ticket.ts`

#### Bulk Assign
- **POST** `/api/admin/tickets/bulk/assign`
  - Request: `{ ticketIds, assignedTo }`
  - Response: `{ success, data: { updated, failed } }`
  - Used in: `src/services/ticket.ts`

#### Bulk Add Tags
- **POST** `/api/admin/tickets/bulk/tags`
  - Request: `{ ticketIds, tags, action: 'add' }`
  - Response: `{ success, data: { updated, failed } }`
  - Used in: `src/services/ticket.ts`

---

## Health Check

### API Health
- **GET** `/api/health`
  - Response: `{ status: 'ok', timestamp }`
  - Used for monitoring

---

## Backend Configuration

### Base URL
- **Development**: `http://localhost:3001/api/admin`
- **Environment Variable**: `NEXT_PUBLIC_API_BASE_URL`

### Authentication
All endpoints (except `/api/admin/auth/login` and `/api/health`) require authentication:

```
Authorization: Bearer <jwt-token>
```

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description"
  }
}
```

### Pagination Format

For list endpoints:
```json
{
  "success": true,
  "data": {
    "items": [...],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

## Frontend Service Files

- **Auth**: `src/services/auth.ts`
- **Users**: `src/services/userManagement.ts`
- **Shops**: `src/services/shop.ts`
- **Shop Approval**: `src/services/shopApproval.ts`
- **Service Catalog**: `src/services/serviceCatalog.ts`
- **Admin Services**: `src/services/adminService.ts`
- **Tickets**: `src/services/ticket.ts`
- **Financial**: `src/services/financial.ts`
- **Payments**: `src/services/payment.ts`
- **Analytics**: `src/services/analytics.ts`
- **API Client**: `src/services/api.ts`
- **Token Management**: `src/services/token.ts`
- **Session Management**: `src/services/session.ts`

## Frontend Proxy Routes

All `/api/admin/*` routes in the Next.js app are proxied to the backend using:
- **Proxy Utility**: `src/app/api/admin/_proxy.ts`
- **Pattern**: Forwards requests with authentication headers to external backend

---

## Notes

1. **Mock Data Removed**: All mock data has been removed from the frontend. The frontend is a thin client that only consumes backend APIs.

2. **Backend Required**: The backend server must be running at `http://localhost:3001` (or configured URL) for the frontend to function.

3. **Session Management**: Handled via JWT tokens stored in localStorage with keys:
   - `ebeautything_access_token`
   - `ebeautything_refresh_token`

4. **Auto Token Refresh**: The API service automatically refreshes expired tokens before making requests.

5. **Error Handling**: 401 errors trigger automatic token refresh. If refresh fails, user is redirected to login.

6. **API Path Requirements**: All API calls in the frontend MUST use the full path `/api/admin/...` not just `/shops/...` or other relative paths. The apiService uses an empty baseURL and relies on relative paths to Next.js API routes.

7. **Service Catalog vs Shop Services**:
   - `/api/service-catalog/*` - Public read-only catalog of all services across all shops (no auth required)
   - `/api/admin/shops/:id/services/*` - Admin/shop owner endpoints to CRUD shop-specific services (auth required)
   - The catalog aggregates services from all shops for customer browsing
   - Shop services endpoints allow admins to manage individual shop offerings

8. **Products Migration**: The `/api/admin/products` endpoints are legacy. The new service-oriented architecture uses:
   - Service Catalog for public service browsing
   - Shop Services for admin service management
   - Products may be deprecated in future versions

---

## Summary

This frontend application interfaces with **two types of API endpoints**:

1. **Admin Endpoints** (`/api/admin/*`) - Require authentication, used for management operations
2. **Public Endpoints** (`/api/service-catalog/*`) - No authentication required, public service catalog

**Total Endpoint Categories:**
- Authentication: 7 endpoints
- User Management: 7 endpoints
- Shop Management: 22 endpoints
- Service Catalog: 13 endpoints (11 public + 2 admin)
- Bookings: 4 endpoints
- Financial: 9 endpoints
- Products: 2 endpoints
- Tickets: 35+ endpoints
- Dashboard: 2 endpoints
- Health Check: 1 endpoint

---

**Last Updated:** 2025-10-07
**Frontend Version:** Next.js 15.5.4
**API Version:** Admin API v1
