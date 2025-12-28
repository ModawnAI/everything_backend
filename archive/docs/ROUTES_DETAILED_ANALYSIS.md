# COMPREHENSIVE BACKEND ROUTES ANALYSIS
# 에뷰리띵 (eBeautything) Backend API

**Date:** 2025-11-12
**Environment:** Production Stack (Bitnami Node.js 22.18.0)
**Framework:** Express.js 4.x + TypeScript 5.x
**Total Route Files:** 91

---

## I. AUTHENTICATION ROUTES (4 files)

### A. User Authentication - `/auth.routes.ts`
**Prefix:** `/api/auth`
**Authentication:** Public + JWT

| Method | Endpoint | Auth Required | Rate Limit | Description |
|--------|----------|---------------|------------|-------------|
| POST | `/social-login` | No | Enhanced (progressive penalties) | Social provider authentication (Kakao, Apple, Google) |
| POST | `/register` | No | Strict (10/min) | Complete user registration with profile |
| POST | `/send-verification-code` | No | Strict (10/min) | Initiate phone verification (PASS/SMS) |
| POST | `/verify-phone` | No | Strict (10/min) | Confirm phone verification with OTP |
| POST | `/pass/callback` | No | Standard | PASS verification callback handler |
| GET | `/providers` | No | Standard | Get social provider configuration status |
| POST | `/refresh` | No | Strict (10/min) | Refresh access token using refresh token |
| POST | `/logout` | Optional | Standard | Single device logout (revoke refresh token) |
| POST | `/logout-all` | Yes (JWT) | Standard | All devices logout (revoke all tokens) |
| GET | `/sessions` | Yes (JWT) | Standard | Get user's active sessions/devices |
| POST | `/supabase-session` | No | Standard | Process Supabase Auth session |
| POST | `/refresh-supabase` | No | Standard | Refresh Supabase Auth session |

**Validation:** Joi schema validation for all POST/PATCH
**Session Management:** Token rotation, device tracking, IP logging

---

### B. Admin Authentication - `/admin-auth.routes.ts`
**Prefix:** `/api/admin/auth`
**Authentication:** Public (login) + JWT (other endpoints)
**Authorization:** Admin role required

| Method | Endpoint | Auth | Role | Rate Limit | Description |
|--------|----------|------|------|------------|-------------|
| GET | `/csrf` | No | - | - | Get CSRF token for admin forms |
| POST | `/login` | No | - | Standard | Admin login with email/password |
| POST | `/refresh` | No | - | Standard | Refresh admin session token |
| POST | `/logout` | Yes | Admin | Standard | Admin logout and session revocation |
| GET | `/validate` | Yes | Admin | Standard | Validate admin session |
| GET | `/profile` | Yes | Admin | Standard | Get admin profile information |
| GET | `/sessions` | Yes | Admin | Standard | Get admin's active sessions |
| POST | `/change-password` | Yes | Admin | Standard | Change admin password |

**Security Features:**
- IP whitelist validation
- Failed login attempt tracking (5 attempts = 30min lockout)
- Session creation with device tracking
- Comprehensive audit logging
- Session activity timestamp tracking

---

### C. Shop Owner Authentication - `/shop-owner-auth.routes.ts`
**Prefix:** `/api/shop-owner/auth`
**Authentication:** Public (login) + JWT (other endpoints)
**Authorization:** Shop owner role required

| Method | Endpoint | Auth | Role | Rate Limit | Description |
|--------|----------|------|------|------------|-------------|
| POST | `/login` | No | - | Standard | Shop owner login with email/password |
| POST | `/refresh` | No | - | Standard | Refresh shop owner session token |
| POST | `/logout` | Yes | Shop Owner | Standard | Shop owner logout |
| GET | `/validate` | Yes | Shop Owner | Standard | Validate shop owner session |
| GET | `/profile` | Yes | Shop Owner | Standard | Get shop owner profile + shop info |
| GET | `/sessions` | Yes | Shop Owner | Standard | Get shop owner's active sessions |
| POST | `/change-password` | Yes | Shop Owner | Standard | Change shop owner password |

**Security Features:**
- Email/password authentication via Supabase Auth
- Shop ownership verification (must own active shop)
- Failed login attempt tracking (5 attempts = 30min lockout)
- Device tracking and session management
- Comprehensive audit logging
- Session expiry: 24 hours (access), 7 days (refresh)

---

### D. Unified Authentication - `/unified-auth.routes.ts`
**Prefix:** `/api/auth` (alternative unified endpoints)
**Authentication:** Public (login) + JWT (other endpoints)
**Supports:** Admin, Shop Owner, Customer roles

| Method | Endpoint | Auth | Rate Limit | Description |
|--------|----------|------|------------|-------------|
| POST | `/login` | No | Strict (5/15min) | Unified login for all roles (email/password) |
| POST | `/logout` | Yes | Standard | Current session logout |
| POST | `/logout-all` | Yes | Standard | All sessions logout |
| POST | `/refresh` | No | Standard | Refresh access token |
| GET | `/validate` | Optional | Standard | Validate current session |
| GET | `/sessions` | Yes | Standard | Get user's active sessions |
| POST | `/change-password` | Yes | Standard | Change user password |
| GET | `/login-statistics` | Yes | Standard | Get login attempt statistics |
| GET | `/security-logs` | Yes | Standard | Get security event logs |

**Role Support:** admin, shop_owner, customer
**Validation:** Email normalization, password strength, device info tracking

---

## II. ADMIN ROUTES (20 files)

### A. Admin User Management - `/admin-user-management.routes.ts`
**Prefix:** `/api/admin/users`
**Authentication:** JWT + Admin Auth
**Authorization:** Admin role required

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get users with advanced search/filtering |
| GET | `/roles` | Get list of available user roles |

**Query Parameters (GET /):**
- search: name, email, phone_number
- role: user, shop_owner, admin, influencer
- status: active, inactive, suspended, deleted
- gender: male, female, other, prefer_not_to_say
- isInfluencer: boolean filter
- phoneVerified: boolean filter
- startDate/endDate: creation date range
- lastLoginStart/lastLoginEnd: login date range
- hasReferrals: boolean filter
- minPoints/maxPoints: point range filter
- sortBy: created_at, name, email, last_login_at, total_points, total_referrals
- sortOrder: asc/desc
- page, limit: pagination (1-100 items)

**Returned Fields:**
- User profile (email, name, phone, gender, birthDate)
- Account status (role, status, isInfluencer)
- Points tracking (totalPoints, availablePoints)
- Referral metrics (totalReferrals, successfulReferrals)
- Activity logs (lastLoginAt, lastLoginIp)
- Consent tracking (termsAcceptedAt, privacyAcceptedAt, marketingConsent)

---

### B. Admin Shop Management - `/admin-shop.routes.ts`
**Prefix:** `/api/admin/shops`
**Authentication:** JWT + Admin Auth
**Authorization:** Admin role required

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Create new shop (admin-only) |
| GET | `/` | Get all shops with filtering/pagination |
| GET | `/pending` | Get shops pending verification |
| POST | `/search` | Search shops with advanced filters |
| GET | `/verification-stats` | Get verification statistics |
| GET | `/:shopId/verification-history` | Get verification audit trail |
| GET | `/:shopId/verification-requirements` | Check verification completeness |
| GET | `/:shopId` | Get detailed shop information |
| GET | `/:shopId/reservations` | Get shop reservations |
| GET | `/:shopId/analytics` | Get shop analytics data |
| GET | `/:shopId/operating-hours` | Get shop operating hours |
| PUT | `/:shopId/approve` | Approve/reject shop for verification |
| PATCH | `/:shopId/status` | Update shop status |
| PUT | `/:shopId` | Update shop information |
| DELETE | `/:shopId` | Delete shop (soft/hard delete) |
| GET | `/data-integrity/status` | Get data integrity status |
| POST | `/data-integrity/validate` | Validate data integrity |
| POST | `/data-integrity/cleanup` | Clean up orphaned data |

**Shop Status Values:**
- active, inactive, pending_approval, suspended, deleted

**Verification Status:**
- pending, verified, rejected

**Shop Type:**
- partnered, non_partnered

**Rate Limits:**
- Standard: 100 requests/15 min
- Sensitive (approval, status, delete): 20 requests/15 min

---

### C. Admin Reservation Management - `/admin-reservation.routes.ts`
**Prefix:** `/api/admin/reservations`
**Authentication:** JWT + Admin Auth
**Authorization:** Admin role required

**Key Endpoints:**
- GET / - List all reservations with filtering
- GET /pending - Get pending reservations
- GET /analytics - Reservation analytics
- PATCH /:id/status - Update reservation status
- GET /:id - Get reservation details

---

### D. Admin Analytics Dashboard - `/admin-analytics.routes.ts`
**Prefix:** `/api/admin/analytics`
**Authentication:** JWT + Admin Auth

**Key Endpoints:**
- GET /dashboard - Quick dashboard overview
- GET /realtime - Real-time metrics
- GET /export - Export analytics data
- GET /cache/stats - Cache statistics
- POST /cache/clear - Clear cache
- GET /trends/users - User trend analysis
- GET /trends/revenue - Revenue trends
- GET /trends/reservations - Reservation trends
- GET /shops/performance - Shop performance metrics
- GET /payments/summary - Payment summary
- GET /points/summary - Points system summary
- GET /categories/performance - Category performance

---

### E. Admin Announcement Management - `/admin-announcement.routes.ts`
**Prefix:** `/api/admin/announcements`
**Authentication:** JWT + Admin Auth

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get all announcements |
| GET | `/:id` | Get announcement by ID |
| POST | `/` | Create new announcement |
| PUT | `/:id` | Update announcement |
| DELETE | `/:id` | Delete announcement |

---

### F. Additional Admin Routes (15+ files)
- **admin-payment.routes.ts** - Payment management, refunds, settlements
- **admin-adjustment.routes.ts** - Manual adjustments, corrections
- **admin-financial.routes.ts** - Financial reports, revenue analysis
- **admin-moderation.routes.ts** - Content moderation, review management
- **admin-security.routes.ts** - Security events, IP blocking, audit logs
- **admin-security-events.routes.ts** - Detailed security event logging
- **admin-security-enhanced.routes.ts** - Enhanced security features
- **admin-payment-management.routes.ts** - Payment gateway management
- **admin-point-policy.routes.ts** - Point system policy management
- **admin-product.routes.ts** - Product/service catalog management
- **admin-push-notification.routes.ts** - Push notification management
- **admin-ticket.routes.ts** - Support ticket management
- **admin-shop-approval.routes.ts** - Shop approval workflow
- **admin-shop-service.routes.ts** - Service/product management per shop
- **admin-service-details.routes.ts** - Detailed service information

---

## III. SHOP OWNER ROUTES (10 files)

### A. Shop Owner Main Dashboard - `/shop-owner.routes.ts`
**Prefix:** `/api/shop-owner`
**Authentication:** JWT (all endpoints)
**Authorization:** Shop owner role required
**Middleware:** requireShopOwnerWithShop() for some endpoints

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/dashboard` | JWT | Dashboard overview (stats, pending reservations) |
| GET | `/analytics` | JWT | Analytics with time period filtering |
| GET | `/reservations` | JWT | List reservations (filterable, paginated) |
| GET | `/reservations/pending` | JWT+ShopOwner | Get pending reservations only |
| PUT | `/reservations/:id/confirm` | JWT+ShopOwner | Confirm pending reservation |
| PUT | `/reservations/:id/reject` | JWT+ShopOwner | Reject pending reservation |
| PUT | `/reservations/:id/complete` | JWT+ShopOwner | Mark service as completed |
| PUT | `/reservations/:id/status` | JWT | Update reservation status |
| GET | `/profile` | JWT | Get shop owner profile + shops |
| GET | `/customers` | JWT+ShopOwner | Get shop customers list |
| GET | `/customers/stats` | JWT+ShopOwner | Customer statistics |
| GET | `/payments` | JWT+ShopOwner | Payment records for shop |

**Rate Limits:**
- Standard operations: 100 req/15min
- Analytics: 50 req/15min
- Sensitive (confirm, reject, complete): 30 req/15min

**Reservation Status Flow:**
- requested → confirmed → completed
- requested → cancelled_by_shop
- confirmed → no_show

---

### B. Shop-Scoped Reservations - `/shop-reservations.routes.ts`
**Prefix:** `/api/shops/:shopId/reservations`
**Authentication:** JWT (all endpoints)
**Authorization:** Shop owner access validation

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get shop reservations (filtered, paginated) |
| PATCH | `/:reservationId` | Update reservation status |

**Query Filters:**
- status: requested, confirmed, completed, cancelled_by_user, cancelled_by_shop, no_show
- startDate, endDate: date range filtering
- userId: filter by customer
- page, limit: pagination

---

### C. Shop Profile & Settings (Multiple files)
- **shop-profile.routes.ts** - Shop profile management
- **shop-dashboard.routes.ts** - Dashboard analytics
- **shop-analytics.routes.ts** - Detailed analytics
- **shop-operating-hours.routes.ts** - Operating hours management
- **shop-categories.routes.ts** - Shop categories/services
- **shop-contact-methods.routes.ts** - Contact information
- **shop-image.routes.ts** - Shop image management
- **shop-payments.routes.ts** - Payment history and settlement
- **shop-users.routes.ts** - Customer management
- **shop-reporting.routes.ts** - Reporting and export

---

## IV. USER ROUTES (15+ files)

### A. User Profile Management - `/user-profile.routes.ts`
**Prefix:** `/api/users/profile` or `/api/profile`
**Authentication:** JWT (all endpoints)

**Endpoints:**
- GET / - Get user profile
- PUT / - Update user profile
- GET /preferences - Get user preferences
- PUT /preferences - Update preferences
- DELETE / - Delete account

---

### B. User Settings - `/user-settings.routes.ts`
**Prefix:** `/api/users/settings`
**Authentication:** JWT

**Endpoints:**
- GET / - Get all user settings
- PUT / - Update settings
- POST /notification-preferences - Update notification settings

---

### C. Reservation Management - `/reservation.routes.ts`
**Prefix:** `/api/reservations` or `/api/shops/:shopId/available-slots`
**Authentication:** JWT (most endpoints)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/shops/:shopId/available-slots` | Get available time slots |
| POST | `/` | Create reservation |
| GET | `/` | Get user's reservations |
| GET | `/:id` | Get reservation details |
| PATCH | `/:id/status` | Update reservation status |
| POST | `/:id/cancel` | Cancel reservation |
| POST | `/:id/reschedule` | Reschedule reservation |

**Validation:** Joi schema for date/time format, service selection, payment info

---

### D. Additional User Routes
- **user-sessions.routes.ts** - Session management
- **user-status.routes.ts** - User status tracking
- **user-feed.routes.ts** - Feed/timeline
- **feed.routes.ts** - Feed with ranking algorithm
- **favorites.routes.ts** - Favorite shops/services
- **point.routes.ts** - Points balance and history
- **point-balance.routes.ts** - Points account details
- **referral.routes.ts** - Referral program management
- **referral-code.routes.ts** - Referral code generation
- **referral-earnings.routes.ts** - Referral earnings tracking
- **referral-analytics.routes.ts** - Referral analytics

---

## V. PAYMENT & FINANCIAL ROUTES (8 files)

### A. Payment Processing - `/payment.routes.ts`
**Prefix:** `/api/payments`
**Authentication:** JWT (most endpoints)
**Provider:** PortOne V2 SDK

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/portone/prepare` | JWT | Initialize payment transaction |
| POST | `/portone/confirm` | JWT | Confirm and finalize payment |
| POST | `/portone/webhook` | Webhook | PortOne webhook handler |
| GET | `/history` | JWT | Get payment history |
| GET | `/:id` | JWT | Get payment details |
| POST | `/:id/refund` | JWT | Request refund |

**Webhook Security:** portOneV2WebhookSecurity middleware

**Payment Types:**
- deposit: Partial deposit payment
- final: Full payment or remaining balance

**Rate Limit:** paymentRateLimit (configurable)

---

### B. Split Payments - `/split-payment.routes.ts`
**Prefix:** `/api/split-payments`
**Authentication:** JWT

**Endpoints:**
- POST / - Create split payment
- GET / - Get split payment records
- PATCH /:id/status - Update payment split status

---

### C. Payment Security - `/payment-security.routes.ts`
**Prefix:** `/api/payments/security`
**Authentication:** JWT

**Endpoints:**
- GET /validation - Payment validation checks
- POST /verification - Payment verification

---

## VI. POINT SYSTEM ROUTES (5 files)

### A. Points Balance - `/point-balance.routes.ts`
**Prefix:** `/api/points/balance`
**Authentication:** JWT

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user's point balance |
| GET | `/history` | Get points transaction history |
| POST | `/use` | Use points for reservation |

---

### B. Point Processing - `/point-processing.routes.ts`
**Prefix:** `/api/admin/points`
**Authentication:** JWT + Admin
**Authorization:** Admin role

**Endpoints:**
- GET /pending - Pending point awards
- POST /process - Process pending points
- POST /manual-adjust - Manual point adjustment

---

### C. Additional Points Routes
- **point.routes.ts** - General points management
- **influencer-bonus.routes.ts** - Influencer bonus points
- **admin-point-policy.routes.ts** - Point policy configuration

---

## VII. SHOP ROUTES (8 files)

### A. Shop Listing & Search - `/shop.routes.ts`
**Prefix:** `/api/shops`
**Authentication:** Optional JWT

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| GET | `/` | Optional | Get all shops (searchable, filterable) |
| GET | `/nearby` | Optional | Get nearby shops (location-based) |
| GET | `/:id` | Optional | Get shop details |
| POST | `/` | JWT | User-created custom shop |

**Query Filters:**
- search: shop name, description
- category: main_category or sub_categories
- location: coordinates or area
- rating: minimum rating filter
- page, limit: pagination

---

### B. Shop Search & Discovery - `/shop-search.routes.ts`
**Prefix:** `/api/shops/search`
**Authentication:** Optional JWT

**Endpoints:**
- GET / - Advanced shop search
- GET /trending - Trending shops
- GET /recommended - Recommended shops

---

### C. Shop Registration - `/shop-registration.routes.ts`
**Prefix:** `/api/shops/registration`
**Authentication:** JWT

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/` | Register new shop |
| POST | `/:id/submit` | Submit shop for approval |
| GET | `/:id/status` | Check registration status |

---

### D. Shop Service Management - `/shop-service.routes.ts`
**Prefix:** `/api/shops/:shopId/services`
**Authentication:** JWT + Shop Owner Auth

**Endpoints:**
- GET / - List shop services
- POST / - Create service
- PUT /:id - Update service
- DELETE /:id - Delete service

---

### E. Additional Shop Routes
- **shop-categories.routes.ts** - Service categories
- **shop-operating-hours.routes.ts** - Operating hours
- **shop-contact-methods.routes.ts** - Contact info
- **shop-image.routes.ts** - Image/photo management
- **service-catalog.routes.ts** - Service catalog

---

## VIII. REFERRAL & INFLUENCER ROUTES (7 files)

### A. Referral Program - `/referral.routes.ts`
**Prefix:** `/api/referrals`
**Authentication:** JWT

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get referral details |
| GET | `/code` | Get user's referral code |
| POST | `/claim/:code` | Claim referral bonus |
| GET | `/earnings` | Get referral earnings |

---

### B. Referral Code Management - `/referral-code.routes.ts`
**Prefix:** `/api/referral-codes`
**Authentication:** JWT

**Endpoints:**
- GET / - Get referral codes
- POST / - Generate new code
- POST /:code/validate - Validate referral code

---

### C. Influencer Routes
- **influencer-qualification.routes.ts** - Influencer qualification criteria
- **influencer-bonus.routes.ts** - Influencer bonus tracking
- **referral-earnings.routes.ts** - Earnings management
- **referral-analytics.routes.ts** - Referral analytics
- **referral-relationship.routes.ts** - Referrer/referee relationships

---

## IX. NOTIFICATION & COMMUNICATION ROUTES (3 files)

### A. Notifications - `/notification.routes.ts`
**Prefix:** `/api/notifications`
**Authentication:** JWT

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Get user notifications |
| GET | `/settings` | Get notification preferences |
| PUT | `/settings` | Update notification preferences |
| POST | `/:id/read` | Mark notification as read |
| DELETE | `/:id` | Delete notification |

---

### B. Push Notifications - `/admin-push-notification.routes.ts`
**Prefix:** `/api/admin/push-notifications`
**Authentication:** JWT + Admin

**Endpoints:**
- GET / - Get push notification history
- POST / - Send push notification
- GET /analytics - Push notification analytics

---

### C. WebSocket Routes - `/websocket.routes.ts`
**Protocol:** WebSocket (Socket.io)
**Authentication:** JWT on connection

**Events:**
- notification - Real-time notifications
- message - Chat/messaging
- status-update - Status changes
- typing-indicator - User typing status

---

## X. SECURITY & AUDIT ROUTES (6 files)

### A. Security Events - `/admin-security-events.routes.ts`
**Prefix:** `/api/admin/security/events`
**Authentication:** JWT + Admin

**Endpoints:**
- GET / - Get security events log
- GET /summary - Security summary
- GET /threats - Potential security threats
- POST /ip-block - Block IP address

---

### B. Audit Trail - `/audit-trail.routes.ts`
**Prefix:** `/api/admin/audit`
**Authentication:** JWT + Admin

**Endpoints:**
- GET / - Get audit log entries
- GET /export - Export audit log

---

### C. Security Monitoring
- **security.routes.ts** - General security endpoints
- **monitoring.routes.ts** - System monitoring
- **monitoring-dashboard.routes.ts** - Monitoring dashboard
- **ip-blocking.routes.ts** - IP block management

---

## XI. UTILITY & INFRASTRUCTURE ROUTES (12+ files)

### A. Health Checks - `/health.routes.ts`
**Prefix:** `/health`
**Authentication:** None

**Endpoints:**
- GET / - Server health status
- GET /db - Database connection status
- GET /cache - Cache service status
- GET /storage - Storage service status

---

### B. Cache Management - `/cache.routes.ts`
**Prefix:** `/api/admin/cache`
**Authentication:** JWT + Admin

**Endpoints:**
- GET /stats - Cache statistics
- POST /clear - Clear cache
- POST /invalidate/:key - Invalidate specific key

---

### C. Storage & CDN
- **storage.routes.ts** - File storage management
- **cdn.routes.ts** - CDN content delivery
- **shop-image.routes.ts** - Image upload/management
- **image-metadata.routes.ts** - Image metadata

---

### D. Testing & Debug Routes (Dev only)
- **test-error.routes.ts** - Error testing
- **test-dashboard.routes.ts** - Test dashboard
- **csrf.routes.ts** - CSRF token generation
- **shutdown.routes.ts** - Graceful shutdown

---

### E. System & Configuration
- **health.routes.ts** - Health checks
- **monitoring.routes.ts** - System monitoring
- **auth-analytics.routes.ts** - Authentication analytics
- **dashboard.routes.ts** - Admin dashboard

---

## XII. ADVANCED FEATURES (8+ files)

### A. Reservation Management
- **reservation-rescheduling.routes.ts** - Reschedule reservations
- **conflict-resolution.routes.ts** - Handle booking conflicts
- **no-show-detection.routes.ts** - No-show detection & tracking
- **automatic-state-progression.routes.ts** - Automatic status updates

---

### B. Identity & Verification
- **identity-verification.routes.ts** - Identity verification process
- **registration.routes.ts** - User registration workflow

---

### C. Additional Features
- **conflict-resolution.routes.ts** - Dispute resolution
- **payment-security.routes.ts** - Payment security measures

---

## AUTHENTICATION & AUTHORIZATION SUMMARY

### Role-Based Access Control (RBAC)
```
Roles:
├── admin
│   └── All endpoints with requireAdmin() middleware
├── shop_owner
│   └── Shop-scoped endpoints with requireShopOwnerWithShop()
└── user/customer
    └── Public + authenticated user endpoints
```

### Authentication Methods
1. **JWT Bearer Token** - Primary authentication
2. **Supabase Auth** - Social provider integration
3. **Session Tokens** - For device tracking
4. **Refresh Tokens** - 7-day expiry for extended sessions
5. **API Keys** - For service-to-service (internal only)

### Authorization Checks
1. **RBAC Middleware** - Role verification
2. **Resource Ownership** - User must own/manage resource
3. **Shop Access** - User must have access to shop
4. **IP Whitelist** - Admin access IP validation
5. **Device Tracking** - Session device verification

---

## MIDDLEWARE CHAIN (Standard Flow)

```
Request
  ↓
Logger (logging.middleware)
  ↓
Helmet (security headers)
  ↓
CORS & Origin Validation
  ↓
Body Parser & Input Validation
  ↓
Rate Limiting (rate-limit.middleware)
  ↓
Authentication (auth.middleware)
  ↓
Authorization/RBAC (rbac.middleware)
  ↓
Resource Access Validation (shop-access.middleware)
  ↓
Business Logic Validation (booking-validation.middleware)
  ↓
XSS/CSRF Protection (xss-csrf-protection.middleware)
  ↓
Input Sanitization (input-sanitization.middleware)
  ↓
Route Handler
  ↓
Response Standardization (response-standardization.middleware)
  ↓
Error Handling (error-handling.middleware)
  ↓
Response
```

---

## KEY SECURITY FEATURES

### Rate Limiting Strategy
- **Login Endpoints:** 5-10 requests per minute (strict)
- **Read Operations:** 100 requests per 15 minutes
- **Sensitive Operations:** 20-30 requests per 15 minutes
- **Payment Operations:** Custom paymentRateLimit
- **Public Endpoints:** Standard rate limiting

### Session Management
- **Access Token Expiry:** 15-24 hours (varies by role)
- **Refresh Token Expiry:** 7 days
- **Device Tracking:** deviceId, deviceName, userAgent logging
- **IP Address Logging:** All auth and sensitive operations
- **Session Revocation:** Supported for logout scenarios

### Security Headers
- Helmet.js for security headers
- CSRF protection on form submissions
- XSS protection (Content-Security-Policy)
- HSTS for HTTPS enforcement
- X-Frame-Options to prevent clickjacking

### Payment Security
- PortOne V2 webhook signature validation
- Idempotent payment operations
- Payment amount verification
- Encryption of sensitive payment data

---

## CRITICAL ENDPOINTS REQUIRING ATTENTION

### Shop Owner Endpoints
```
POST   /api/shop-owner/auth/login           # Shop owner authentication
PUT    /api/shop-owner/reservations/:id/confirm    # Confirm bookings
PUT    /api/shop-owner/reservations/:id/complete   # Complete services
GET    /api/shop-owner/dashboard            # Dashboard overview
```

### Admin Endpoints
```
POST   /api/admin/auth/login                # Admin authentication
GET    /api/admin/users                     # User management
GET    /api/admin/shops                     # Shop management
PATCH  /api/admin/shops/:id/status          # Shop status changes
POST   /api/admin/shops/:id/approve         # Shop approval workflow
```

### Payment Endpoints
```
POST   /api/payments/portone/prepare        # Payment preparation
POST   /api/payments/portone/confirm        # Payment confirmation
POST   /api/payments/portone/webhook        # Payment webhook (public)
```

### User Endpoints
```
POST   /api/auth/register                   # User registration
POST   /api/reservations                    # Reservation creation
POST   /api/payments/portone/confirm        # Payment confirmation
```

---

## VALIDATION & ERROR HANDLING

### Joi Schema Validation
- All POST/PUT/PATCH requests validated against Joi schemas
- Custom error messages in Korean for user endpoints
- Type coercion and normalization enabled
- UUID validation for resource IDs
- Pattern validation for phone numbers, dates, times

### HTTP Status Codes Used
- **200 OK** - Successful GET/retrieve operations
- **201 Created** - Successful resource creation
- **204 No Content** - Successful DELETE
- **400 Bad Request** - Validation errors, malformed input
- **401 Unauthorized** - Missing/invalid authentication
- **403 Forbidden** - Insufficient permissions
- **404 Not Found** - Resource not found
- **409 Conflict** - Business logic conflict
- **429 Too Many Requests** - Rate limit exceeded
- **500 Internal Server Error** - Unhandled exceptions

### Response Format
```json
{
  "success": true/false,
  "data": { ... },
  "error": {
    "code": "ERROR_CODE",
    "message": "User-friendly message",
    "details": "Technical details (optional)"
  }
}
```

---

## IMPLEMENTATION NOTES

### Path Conventions
- `/api/auth/*` - User authentication
- `/api/admin/auth/*` - Admin authentication
- `/api/shop-owner/auth/*` - Shop owner authentication
- `/api/admin/*` - Admin operations
- `/api/shop-owner/*` - Shop owner operations
- `/api/reservations/*` - User reservations
- `/api/shops/*` - Shop information
- `/api/payments/*` - Payment operations
- `/api/users/*` - User profile/settings
- `/api/points/*` - Points system
- `/api/referrals/*` - Referral program

### Error Response Examples
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

### Pagination
- Default page size: 20 items
- Maximum page size: 100 items
- Parameters: `page` (1-indexed), `limit`
- Response includes: `totalCount`, `hasMore`, `currentPage`, `totalPages`

---

## FILE LOCATIONS

**Route Files:** `/home/bitnami/everything_backend/src/routes/`
**Controllers:** `/home/bitnami/everything_backend/src/controllers/`
**Middleware:** `/home/bitnami/everything_backend/src/middleware/`
**Validators:** `/home/bitnami/everything_backend/src/validators/`
**Main App:** `/home/bitnami/everything_backend/src/app.ts`

