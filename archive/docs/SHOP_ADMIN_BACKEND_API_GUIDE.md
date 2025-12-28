# Shop & Admin Backend API - Complete Integration Guide

> **Last Updated:** 2025-10-13
> **Backend Version:** 1.0.0
> **Environment:** Node.js + Express + TypeScript + Supabase

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Admin Authentication API](#admin-authentication-api)
4. [Shop-Scoped APIs](#shop-scoped-apis)
5. [Platform Admin APIs](#platform-admin-apis)
6. [Response Format & Error Handling](#response-format--error-handling)
7. [Security Considerations](#security-considerations)
8. [Frontend Implementation Guide](#frontend-implementation-guide)
9. [Testing & Debugging](#testing--debugging)

---

## Architecture Overview

### System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Applications                      │
│  ┌─────────────────┐         ┌────────────────────────┐    │
│  │  Flutter App    │         │  Web Admin Dashboard   │    │
│  │  (User-facing)  │         │  (Shop/Platform Admin) │    │
│  └────────┬────────┘         └───────────┬────────────┘    │
└───────────┼────────────────────────────────┼─────────────────┘
            │                                │
            │   JWT Token (Supabase Auth)    │   JWT Token (Admin Auth)
            │                                │
┌───────────▼────────────────────────────────▼─────────────────┐
│                    Backend API Server                         │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │          Authentication Middleware Layer              │   │
│  │  • authenticateJWT() - Validates JWT tokens          │   │
│  │  • validateShopAccess() - Shop-scoped authorization  │   │
│  │  • requireAdmin() - Admin role verification          │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                               │
│  ┌──────────────────────────────────────────────────────┐   │
│  │                   API Routes                          │   │
│  │                                                        │   │
│  │  Admin Auth:        /api/admin/auth/*                │   │
│  │  Shop-Scoped:       /api/shops/:shopId/*             │   │
│  │  Platform Admin:    /api/admin/*                     │   │
│  └──────────────────────────────────────────────────────┘   │
└───────────────────────────────┬───────────────────────────────┘
                                │
                                │
┌───────────────────────────────▼───────────────────────────────┐
│                   Supabase (PostgreSQL)                       │
│                                                               │
│  Tables:                                                      │
│  • users (user_role: admin, shop_owner, shop_manager, etc.)  │
│  • admin_sessions (JWT session management)                   │
│  • shops (shop information)                                  │
│  • reservations (booking data)                               │
│  • payments (transaction records)                            │
└───────────────────────────────────────────────────────────────┘
```

### Key Concepts

#### 1. **Two-Tier Authentication System**

- **User Authentication (Supabase Auth)**: For regular users via Flutter app
- **Admin Authentication (Custom JWT)**: For admin dashboard users (shop owners/managers/platform admins)

#### 2. **Role-Based Access Control (RBAC)**

| Role | Access Level | Can Access |
|------|-------------|------------|
| `super_admin` | Platform-wide | All shops, all data, admin functions |
| `admin` | Platform-wide | All shops, all data (platform admin) |
| `shop_owner` | Shop-specific | Only their own shop data |
| `shop_manager` | Shop-specific | Only their own shop data |
| `shop_admin` | Shop-specific | Only their own shop data |
| `manager` | Shop-specific | Only their own shop data |

#### 3. **Shop-Scoped Architecture**

All shop-related APIs are scoped by `shopId` in the URL path:
- `/api/shops/:shopId/reservations`
- `/api/shops/:shopId/payments`

The backend automatically validates that:
- Platform admins can access any `shopId`
- Shop users can only access their assigned `shop_id`

---

## Authentication & Authorization

### Authentication Flow

#### Admin Login Flow

```
┌──────────────┐
│   Frontend   │
│   (Admin)    │
└──────┬───────┘
       │
       │ 1. POST /api/admin/auth/login
       │    { email, password, deviceInfo }
       │
       ▼
┌──────────────┐
│   Backend    │
│              │
│  Validates:  │
│  • Email     │
│  • Password  │
│  • IP (if not localhost)
│              │
└──────┬───────┘
       │
       │ 2. Returns JWT Token + Admin Info
       │    { token, refreshToken, admin, security }
       │
       ▼
┌──────────────┐
│   Frontend   │
│              │
│  Stores:     │
│  • Token in  │
│    localStorage/
│    secure storage
│              │
└──────┬───────┘
       │
       │ 3. All subsequent requests include
       │    Authorization: Bearer <token>
       │
       ▼
┌──────────────┐
│   Backend    │
│              │
│  Validates:  │
│  • Token     │
│  • Expiry    │
│  • Role      │
│  • Shop ID   │
│              │
└──────────────┘
```

### Middleware Chain

Every protected endpoint goes through these middleware layers:

1. **`authenticateJWT()`** - Validates JWT token from `Authorization` header
2. **`validateShopAccess()`** - For shop-scoped routes, validates user can access the shop
3. **`requireAdmin()`** - For admin routes, validates user has admin role

---

## Admin Authentication API

### Base URL
```
/api/admin/auth
```

### Endpoints

#### 1. Admin Login

**POST** `/api/admin/auth/login`

Authenticates an admin user and returns a JWT token with 24-hour expiry.

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "SecurePassword123!",
  "deviceInfo": {
    "deviceId": "optional-device-uuid",
    "userAgent": "optional-user-agent-string"
  }
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "name": "Admin User",
      "role": "admin",
      "permissions": ["read", "write", "delete"],
      "shopId": "123e4567-e89b-12d3-a456-426614174000",  // Optional, for shop owners
      "shopName": "Beautiful Salon"  // Optional, for shop owners
    },
    "expiresAt": "2025-10-14T12:00:00.000Z"
  }
}
```

**Error Responses:**

```json
// 400 - Missing credentials
{
  "success": false,
  "error": "Email and password are required"
}

// 401 - Invalid credentials
{
  "success": false,
  "error": "Invalid email or password"
}

// 403 - IP not whitelisted (production only)
{
  "success": false,
  "error": "Access denied: IP not authorized for admin access"
}

// 403 - Account locked
{
  "success": false,
  "error": "Account is locked. Please contact system administrator."
}
```

**Frontend Implementation:**

```typescript
// Admin Login Function
async function adminLogin(email: string, password: string) {
  try {
    const response = await fetch('http://localhost:3001/api/admin/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        deviceInfo: {
          deviceId: getDeviceId(), // Generate or retrieve device ID
          userAgent: navigator.userAgent
        }
      })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Login failed');
    }

    // Store tokens securely
    localStorage.setItem('adminToken', result.data.token);
    localStorage.setItem('adminRefreshToken', result.data.refreshToken);
    localStorage.setItem('adminUser', JSON.stringify(result.data.admin));

    return result.data;
  } catch (error) {
    console.error('Admin login error:', error);
    throw error;
  }
}
```

---

#### 2. Refresh Admin Session

**POST** `/api/admin/auth/refresh`

Refreshes an expired admin token using a refresh token.

**Request Body:**
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "token": "new-jwt-token...",
    "refreshToken": "new-refresh-token...",
    "admin": { /* admin info */ },
    "expiresAt": "2025-10-14T12:00:00.000Z"
  }
}
```

**Frontend Implementation:**

```typescript
async function refreshAdminToken() {
  const refreshToken = localStorage.getItem('adminRefreshToken');

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await fetch('http://localhost:3001/api/admin/auth/refresh', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ refreshToken })
    });

    const result = await response.json();

    if (!response.ok) {
      // Refresh token expired, redirect to login
      localStorage.clear();
      window.location.href = '/admin/login';
      throw new Error('Session expired');
    }

    // Update stored tokens
    localStorage.setItem('adminToken', result.data.token);
    localStorage.setItem('adminRefreshToken', result.data.refreshToken);

    return result.data.token;
  } catch (error) {
    console.error('Token refresh error:', error);
    throw error;
  }
}
```

---

#### 3. Admin Logout

**POST** `/api/admin/auth/logout`

Logs out the admin user and invalidates the session.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

---

#### 4. Validate Admin Session

**GET** `/api/admin/auth/validate`

Validates the current admin session and returns admin information.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@example.com",
      "role": "admin",
      "permissions": ["read", "write", "delete"]
    },
    "session": {
      "id": "session-uuid",
      "expiresAt": "2025-10-14T12:00:00.000Z",
      "lastActivityAt": "2025-10-13T10:30:00.000Z"
    }
  }
}
```

**Frontend Implementation:**

```typescript
async function validateSession() {
  const token = localStorage.getItem('adminToken');

  if (!token) {
    return null;
  }

  try {
    const response = await fetch('http://localhost:3001/api/admin/auth/validate', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      // Token invalid, try to refresh
      return await refreshAdminToken();
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Session validation error:', error);
    return null;
  }
}
```

---

#### 5. Get Admin Profile

**GET** `/api/admin/auth/profile`

Gets the complete profile of the currently logged-in admin, including shop information.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "shopowner@example.com",
    "name": "Shop Owner",
    "role": "shop_owner",
    "status": "active",
    "permissions": ["manage_shop", "view_analytics"],
    "shopId": "123e4567-e89b-12d3-a456-426614174000",
    "shopName": "Beautiful Salon",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "lastLoginAt": "2025-10-13T10:00:00.000Z",
    "lastLoginIp": "192.168.1.1"
  }
}
```

---

#### 6. Get Active Sessions

**GET** `/api/admin/auth/sessions`

Gets all active sessions for the current admin user.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-uuid-1",
        "deviceId": "device-uuid-1",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "createdAt": "2025-10-13T08:00:00.000Z",
        "lastActivityAt": "2025-10-13T10:30:00.000Z",
        "expiresAt": "2025-10-14T08:00:00.000Z",
        "isActive": true
      }
    ],
    "total": 1
  }
}
```

---

#### 7. Change Password

**POST** `/api/admin/auth/change-password`

Changes the admin user's password.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**
```json
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword456!"
}
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Password changed successfully"
}
```

**Error Responses:**

```json
// 400 - Weak password
{
  "success": false,
  "error": "New password must be at least 8 characters long"
}

// 400 - Incorrect current password
{
  "success": false,
  "error": "Current password is incorrect"
}
```

---

## Shop-Scoped APIs

These APIs allow shop owners/managers to view and manage their shop's data. Access is automatically scoped to their assigned shop.

### Base URL Pattern
```
/api/shops/:shopId/*
```

### Access Control

- **Platform Admins** (`admin`, `super_admin`): Can access ANY `shopId`
- **Shop Roles** (`shop_owner`, `shop_manager`, `shop_admin`, `manager`): Can ONLY access their own `shopId`

The `shopId` must match the `shop_id` field in the user's JWT token payload.

---

### Shop Payments API

#### Base URL
```
/api/shops/:shopId/payments
```

#### 1. Get Shop Payments

**GET** `/api/shops/:shopId/payments`

Retrieves payment records for a specific shop with filtering and pagination.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by payment status | `completed`, `pending`, `failed`, `refunded`, `partially_refunded` |
| `paymentMethod` | string | Filter by payment method | `card`, `cash`, `points`, `mixed` |
| `startDate` | string (ISO date) | Filter from date | `2025-10-01` |
| `endDate` | string (ISO date) | Filter to date | `2025-10-13` |
| `userId` | UUID | Filter by user ID | `550e8400-e29b-41d4-a716-446655440000` |
| `reservationId` | UUID | Filter by reservation ID | `123e4567-e89b-12d3-a456-426614174000` |
| `minAmount` | integer | Minimum payment amount | `10000` |
| `maxAmount` | integer | Maximum payment amount | `100000` |
| `page` | integer | Page number (default: 1) | `1` |
| `limit` | integer | Items per page (max: 100, default: 20) | `20` |

**Example Request:**

```typescript
const shopId = '123e4567-e89b-12d3-a456-426614174000';
const queryParams = new URLSearchParams({
  status: 'completed',
  startDate: '2025-10-01',
  endDate: '2025-10-13',
  page: '1',
  limit: '20'
});

const response = await fetch(
  `http://localhost:3001/api/shops/${shopId}/payments?${queryParams}`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment-uuid-1",
        "userId": "user-uuid-1",
        "reservationId": "reservation-uuid-1",
        "shopId": "123e4567-e89b-12d3-a456-426614174000",
        "amount": 50000,
        "paymentMethod": "card",
        "status": "completed",
        "refundAmount": 0,
        "createdAt": "2025-10-10T10:00:00.000Z",
        "users": {
          "id": "user-uuid-1",
          "name": "김철수",
          "email": "customer@example.com"
        },
        "reservations": {
          "id": "reservation-uuid-1",
          "reservationDate": "2025-10-15",
          "reservationTime": "14:00",
          "status": "confirmed"
        },
        "shops": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "Beautiful Salon"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasMore": true
    },
    "summary": {
      "totalAmount": 7500000,
      "totalRefunded": 250000,
      "netAmount": 7250000
    }
  }
}
```

**Frontend Implementation:**

```typescript
interface PaymentFilters {
  status?: string;
  paymentMethod?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  reservationId?: string;
  minAmount?: number;
  maxAmount?: number;
  page?: number;
  limit?: number;
}

async function getShopPayments(shopId: string, filters: PaymentFilters = {}) {
  const token = localStorage.getItem('adminToken');

  // Build query string
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });

  try {
    const response = await fetch(
      `http://localhost:3001/api/shops/${shopId}/payments?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to fetch shop payments:', error);
    throw error;
  }
}

// Usage Example
const payments = await getShopPayments('shop-uuid', {
  status: 'completed',
  startDate: '2025-10-01',
  endDate: '2025-10-13',
  page: 1,
  limit: 20
});

console.log('Payments:', payments.payments);
console.log('Total:', payments.pagination.total);
console.log('Summary:', payments.summary);
```

---

#### 2. Get Payment Details

**GET** `/api/shops/:shopId/payments/:paymentId`

Retrieves detailed information about a specific payment, including refund history.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment-uuid-1",
      "userId": "user-uuid-1",
      "reservationId": "reservation-uuid-1",
      "shopId": "123e4567-e89b-12d3-a456-426614174000",
      "amount": 50000,
      "paymentMethod": "card",
      "status": "partially_refunded",
      "refundAmount": 10000,
      "createdAt": "2025-10-10T10:00:00.000Z",
      "updatedAt": "2025-10-11T15:00:00.000Z",
      "users": {
        "id": "user-uuid-1",
        "name": "김철수",
        "email": "customer@example.com",
        "phone": "010-1234-5678"
      },
      "reservations": {
        "id": "reservation-uuid-1",
        "reservationDate": "2025-10-15",
        "reservationTime": "14:00",
        "status": "confirmed",
        "totalAmount": 50000,
        "depositAmount": 20000,
        "remainingAmount": 30000,
        "specialRequests": "창가 자리 선호"
      },
      "shops": {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "name": "Beautiful Salon",
        "phone": "02-1234-5678",
        "address": "서울시 강남구 테헤란로 123"
      }
    },
    "refundHistory": [
      {
        "id": "refund-uuid-1",
        "paymentId": "payment-uuid-1",
        "amount": 10000,
        "reason": "고객 요청",
        "status": "completed",
        "processedBy": "admin-uuid",
        "createdAt": "2025-10-11T15:00:00.000Z"
      }
    ]
  }
}
```

**Frontend Implementation:**

```typescript
async function getPaymentDetails(shopId: string, paymentId: string) {
  const token = localStorage.getItem('adminToken');

  try {
    const response = await fetch(
      `http://localhost:3001/api/shops/${shopId}/payments/${paymentId}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      if (response.status === 404) {
        throw new Error('Payment not found or access denied');
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to fetch payment details:', error);
    throw error;
  }
}
```

---

### Shop Reservations API

#### Base URL
```
/api/shops/:shopId/reservations
```

#### 1. Get Shop Reservations

**GET** `/api/shops/:shopId/reservations`

Retrieves reservations for a specific shop with filtering and pagination.

**Request Headers:**
```
Authorization: Bearer <token>
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `status` | string | Filter by reservation status | `requested`, `confirmed`, `completed`, `cancelled_by_user`, `cancelled_by_shop`, `no_show` |
| `startDate` | string (ISO date) | Filter from reservation date | `2025-10-01` |
| `endDate` | string (ISO date) | Filter to reservation date | `2025-10-31` |
| `userId` | UUID | Filter by user ID | `550e8400-e29b-41d4-a716-446655440000` |
| `page` | integer | Page number (default: 1) | `1` |
| `limit` | integer | Items per page (max: 100, default: 20) | `20` |

**Example Request:**

```typescript
const shopId = '123e4567-e89b-12d3-a456-426614174000';
const queryParams = new URLSearchParams({
  status: 'confirmed',
  startDate: '2025-10-01',
  endDate: '2025-10-31',
  page: '1',
  limit: '20'
});

const response = await fetch(
  `http://localhost:3001/api/shops/${shopId}/reservations?${queryParams}`,
  {
    headers: {
      'Authorization': `Bearer ${adminToken}`
    }
  }
);
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation-uuid-1",
        "userId": "user-uuid-1",
        "shopId": "123e4567-e89b-12d3-a456-426614174000",
        "reservationDate": "2025-10-15",
        "reservationTime": "14:00",
        "status": "confirmed",
        "totalAmount": 50000,
        "depositAmount": 20000,
        "remainingAmount": 30000,
        "specialRequests": "창가 자리 선호",
        "createdAt": "2025-10-10T10:00:00.000Z",
        "updatedAt": "2025-10-10T11:00:00.000Z",
        "users": {
          "id": "user-uuid-1",
          "name": "김철수",
          "email": "customer@example.com",
          "phone": "010-1234-5678"
        },
        "shops": {
          "id": "123e4567-e89b-12d3-a456-426614174000",
          "name": "Beautiful Salon"
        }
      }
    ],
    "pagination": {
      "total": 250,
      "page": 1,
      "limit": 20,
      "totalPages": 13,
      "hasMore": true
    }
  }
}
```

**Frontend Implementation:**

```typescript
interface ReservationFilters {
  status?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  page?: number;
  limit?: number;
}

async function getShopReservations(
  shopId: string,
  filters: ReservationFilters = {}
) {
  const token = localStorage.getItem('adminToken');

  // Build query string
  const queryParams = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      queryParams.append(key, String(value));
    }
  });

  try {
    const response = await fetch(
      `http://localhost:3001/api/shops/${shopId}/reservations?${queryParams}`,
      {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to fetch shop reservations:', error);
    throw error;
  }
}

// Usage Example
const reservations = await getShopReservations('shop-uuid', {
  status: 'confirmed',
  startDate: '2025-10-15',
  endDate: '2025-10-31',
  page: 1,
  limit: 20
});

console.log('Reservations:', reservations.reservations);
console.log('Total:', reservations.pagination.total);
```

---

#### 2. Update Reservation Status

**PATCH** `/api/shops/:shopId/reservations/:reservationId`

Updates the status of a specific reservation (confirm, complete, cancel, no-show).

**Request Headers:**
```
Authorization: Bearer <token>
```

**Request Body:**

```json
{
  "status": "confirmed",
  "reason": "Optional: Required for cancellation",
  "notes": "Optional: Additional notes for internal tracking"
}
```

**Valid Status Values:**

| Status | Description | Requires Reason |
|--------|-------------|-----------------|
| `confirmed` | Shop confirms the reservation | No |
| `completed` | Service completed | No |
| `cancelled_by_shop` | Shop cancels the reservation | **Yes** |
| `no_show` | Customer didn't show up | No |

**Status Transition Rules:**

```
requested → confirmed, cancelled_by_shop
confirmed → completed, cancelled_by_shop, no_show
completed → (terminal state)
cancelled_by_user → (terminal state)
cancelled_by_shop → (terminal state)
no_show → (terminal state)
```

**Example Request:**

```typescript
// Confirm reservation
await updateReservationStatus(shopId, reservationId, {
  status: 'confirmed',
  notes: '고객에게 확인 문자 발송됨'
});

// Cancel reservation
await updateReservationStatus(shopId, reservationId, {
  status: 'cancelled_by_shop',
  reason: '예약 시간에 다른 고객 중복 예약',
  notes: '고객에게 사과 및 대체 시간 제안'
});

// Mark as no-show
await updateReservationStatus(shopId, reservationId, {
  status: 'no_show',
  notes: '예약 시간 30분 경과, 연락 불가'
});
```

**Response (200 OK):**

```json
{
  "success": true,
  "data": {
    "reservationId": "reservation-uuid-1",
    "status": "confirmed",
    "updatedAt": "2025-10-13T14:30:00.000Z",
    "previousStatus": "requested"
  }
}
```

**Error Responses:**

```json
// 400 - Invalid status transition
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "completed 상태에서 confirmed(으)로 변경할 수 없습니다.",
    "details": "현재 상태: completed, 허용된 전환: 없음"
  }
}

// 400 - Missing cancellation reason
{
  "success": false,
  "error": {
    "code": "MISSING_REASON",
    "message": "취소 사유는 필수입니다.",
    "details": "취소 시 reason 필드를 제공해주세요."
  }
}

// 404 - Reservation not found
{
  "success": false,
  "error": {
    "code": "RESERVATION_NOT_FOUND",
    "message": "예약을 찾을 수 없거나 접근 권한이 없습니다."
  }
}
```

**Frontend Implementation:**

```typescript
interface ReservationStatusUpdate {
  status: 'confirmed' | 'completed' | 'cancelled_by_shop' | 'no_show';
  reason?: string;
  notes?: string;
}

async function updateReservationStatus(
  shopId: string,
  reservationId: string,
  update: ReservationStatusUpdate
) {
  const token = localStorage.getItem('adminToken');

  // Validate cancellation reason
  if (update.status === 'cancelled_by_shop' && !update.reason) {
    throw new Error('Cancellation reason is required');
  }

  try {
    const response = await fetch(
      `http://localhost:3001/api/shops/${shopId}/reservations/${reservationId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(update)
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Failed to update reservation');
    }

    const result = await response.json();
    return result.data;
  } catch (error) {
    console.error('Failed to update reservation status:', error);
    throw error;
  }
}

// Usage Examples

// 1. Confirm a reservation
try {
  const result = await updateReservationStatus(
    'shop-uuid',
    'reservation-uuid',
    {
      status: 'confirmed',
      notes: '고객에게 확인 문자 발송됨'
    }
  );
  console.log('Reservation confirmed:', result);
  // Show success notification to admin
} catch (error) {
  console.error('Failed to confirm:', error);
  // Show error notification
}

// 2. Cancel a reservation
try {
  const result = await updateReservationStatus(
    'shop-uuid',
    'reservation-uuid',
    {
      status: 'cancelled_by_shop',
      reason: '시술 불가능한 요청',
      notes: '대체 서비스 제안함'
    }
  );
  console.log('Reservation cancelled:', result);
} catch (error) {
  console.error('Failed to cancel:', error);
}

// 3. Mark as completed
try {
  const result = await updateReservationStatus(
    'shop-uuid',
    'reservation-uuid',
    {
      status: 'completed',
      notes: '서비스 완료, 고객 만족'
    }
  );
  console.log('Reservation completed:', result);
} catch (error) {
  console.error('Failed to complete:', error);
}

// 4. Mark as no-show
try {
  const result = await updateReservationStatus(
    'shop-uuid',
    'reservation-uuid',
    {
      status: 'no_show',
      notes: '예약 시간 30분 경과, 연락 불가'
    }
  );
  console.log('Marked as no-show:', result);
} catch (error) {
  console.error('Failed to mark no-show:', error);
}
```

---

## Platform Admin APIs

Platform admins have access to ALL shops and system-wide management functions.

### Additional Admin Routes

Based on the discovered routes in `app.ts`, here are the key platform admin endpoints:

| Route | Description |
|-------|-------------|
| `/api/admin/shops` | Manage all shops (list, view, update, delete) |
| `/api/admin/shops/approval` | Approve/reject new shop registrations |
| `/api/admin/shops/:shopId/services` | Manage services for specific shops |
| `/api/admin/reservations` | View and manage all reservations across shops |
| `/api/admin/users` | User management (list, view, update, ban, delete) |
| `/api/admin/services` | Service catalog management |
| `/api/admin/payments` | View all payments across shops |
| `/api/admin/payments/management` | Payment operations (refunds, adjustments) |
| `/api/admin/analytics` | System-wide analytics and reporting |
| `/api/admin/dashboard` | Dashboard statistics and KPIs |
| `/api/admin/financial` | Financial reporting and reconciliation |
| `/api/admin/tickets` | Customer support ticket management |
| `/api/admin/security` | Security monitoring and IP management |
| `/api/admin/audit` | Audit trail and activity logs |

**Note:** Detailed documentation for these endpoints can be found in the Swagger UI at:
- Complete API: http://localhost:3001/api-docs
- Admin API: http://localhost:3001/admin-docs

---

## Response Format & Error Handling

### Standard Success Response

All successful API responses follow this format:

```json
{
  "success": true,
  "data": {
    // Response data here
  }
}
```

Or with a message:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data here
  }
}
```

### Standard Error Response

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error information (optional)"
  }
}
```

### Common Error Codes

| HTTP Status | Error Code | Description |
|-------------|------------|-------------|
| 400 | `MISSING_PARAMETERS` | Required parameters are missing |
| 400 | `INVALID_STATUS` | Invalid status value |
| 400 | `INVALID_STATUS_TRANSITION` | Cannot transition from current state to requested state |
| 401 | `AUTHENTICATION_REQUIRED` | No authentication token provided |
| 401 | `MISSING_TOKEN` | Authorization header is missing |
| 401 | `TOKEN_EXPIRED` | JWT token has expired |
| 401 | `INVALID_TOKEN` | JWT token is invalid or malformed |
| 403 | `SHOP_ACCESS_DENIED` | User doesn't have access to this shop |
| 403 | `INVALID_ROLE` | User role doesn't have permission |
| 403 | `INSUFFICIENT_PERMISSIONS` | User lacks required permissions |
| 404 | `PAYMENT_NOT_FOUND` | Payment not found or access denied |
| 404 | `RESERVATION_NOT_FOUND` | Reservation not found or access denied |
| 404 | `USER_NOT_FOUND` | User not found in database |
| 500 | `INTERNAL_SERVER_ERROR` | Internal server error |

### Error Handling in Frontend

```typescript
async function apiRequest(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('adminToken');

  const defaultHeaders = {
    'Content-Type': 'application/json',
    ...(token && { 'Authorization': `Bearer ${token}` })
  };

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers
      }
    });

    const data = await response.json();

    // Handle authentication errors
    if (response.status === 401) {
      // Try to refresh token
      if (data.error?.code === 'TOKEN_EXPIRED') {
        try {
          await refreshAdminToken();
          // Retry original request
          return apiRequest(url, options);
        } catch (refreshError) {
          // Refresh failed, redirect to login
          localStorage.clear();
          window.location.href = '/admin/login';
          throw new Error('Session expired');
        }
      }

      // Other auth errors
      localStorage.clear();
      window.location.href = '/admin/login';
      throw new Error(data.error?.message || 'Authentication failed');
    }

    // Handle other errors
    if (!response.ok) {
      throw new Error(
        data.error?.message ||
        `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return data;
  } catch (error) {
    console.error('API request failed:', error);
    throw error;
  }
}

// Usage
try {
  const result = await apiRequest(
    'http://localhost:3001/api/shops/shop-uuid/payments',
    { method: 'GET' }
  );
  console.log('Success:', result.data);
} catch (error) {
  console.error('Error:', error.message);
  // Show error notification to user
}
```

---

## Security Considerations

### 1. **Token Storage**

**❌ Don't:**
- Store tokens in `localStorage` for public-facing apps (XSS vulnerability)
- Store tokens in cookies without `httpOnly` flag

**✅ Do:**
- For admin dashboard (trusted environment): `localStorage` is acceptable
- For mobile apps: Use secure storage (Keychain/Keystore)
- For web apps with sensitive data: Use `httpOnly` cookies or secure session storage

### 2. **Token Lifecycle**

- **Access Token Expiry**: 24 hours (admin tokens)
- **Refresh Token Expiry**: 7 days
- **Auto-refresh**: Implement automatic token refresh when access token expires
- **Session Tracking**: Backend tracks device fingerprints for security monitoring

### 3. **HTTPS Only**

- **Production**: All API calls MUST use HTTPS
- **Development**: HTTP is acceptable for localhost only

### 4. **Rate Limiting**

The backend implements rate limiting:
- Admin endpoints: 100 requests per 15 minutes
- Sensitive operations: 50 requests per 15 minutes

### 5. **IP Whitelisting** (Production)

For production deployments, admin access can be restricted by IP address:
- Localhost/Docker IPs: Always allowed
- Other IPs: Must be whitelisted in `admin_ip_whitelist` table

### 6. **CORS Configuration**

Frontend must be in allowed origins list:
- Default: `http://localhost:3000`, `http://localhost:3001`, `http://localhost:5173`
- Production: Configure via `CORS_ORIGIN` environment variable

---

## Frontend Implementation Guide

### 1. **Authentication Service**

Create a centralized authentication service:

```typescript
// auth.service.ts
class AuthService {
  private baseUrl = 'http://localhost:3001';
  private tokenKey = 'adminToken';
  private refreshTokenKey = 'adminRefreshToken';
  private userKey = 'adminUser';

  async login(email: string, password: string) {
    const response = await fetch(`${this.baseUrl}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error || 'Login failed');
    }

    // Store tokens and user info
    localStorage.setItem(this.tokenKey, result.data.token);
    localStorage.setItem(this.refreshTokenKey, result.data.refreshToken);
    localStorage.setItem(this.userKey, JSON.stringify(result.data.admin));

    return result.data;
  }

  async logout() {
    const token = this.getToken();

    if (token) {
      try {
        await fetch(`${this.baseUrl}/api/admin/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
      } catch (error) {
        console.error('Logout error:', error);
      }
    }

    // Clear local storage
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshTokenKey);
    localStorage.removeItem(this.userKey);
  }

  async refreshToken() {
    const refreshToken = localStorage.getItem(this.refreshTokenKey);

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(`${this.baseUrl}/api/admin/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const result = await response.json();

    if (!response.ok) {
      // Refresh failed, clear everything
      this.logout();
      throw new Error('Session expired');
    }

    // Update tokens
    localStorage.setItem(this.tokenKey, result.data.token);
    localStorage.setItem(this.refreshTokenKey, result.data.refreshToken);

    return result.data.token;
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getUser() {
    const userStr = localStorage.getItem(this.userKey);
    return userStr ? JSON.parse(userStr) : null;
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}

export const authService = new AuthService();
```

### 2. **API Client with Auto-Refresh**

```typescript
// api-client.ts
import { authService } from './auth.service';

class ApiClient {
  private baseUrl = 'http://localhost:3001';

  async request(endpoint: string, options: RequestInit = {}) {
    const token = authService.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...options.headers
    };

    try {
      let response = await fetch(`${this.baseUrl}${endpoint}`, {
        ...options,
        headers
      });

      // Handle token expiration
      if (response.status === 401) {
        const errorData = await response.json();

        if (errorData.error?.code === 'TOKEN_EXPIRED') {
          // Try to refresh token
          try {
            await authService.refreshToken();

            // Retry request with new token
            const newToken = authService.getToken();
            response = await fetch(`${this.baseUrl}${endpoint}`, {
              ...options,
              headers: {
                ...headers,
                'Authorization': `Bearer ${newToken}`
              }
            });
          } catch (refreshError) {
            // Refresh failed, logout
            authService.logout();
            window.location.href = '/admin/login';
            throw new Error('Session expired');
          }
        } else {
          // Other auth error, logout
          authService.logout();
          window.location.href = '/admin/login';
          throw new Error('Authentication failed');
        }
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error?.message ||
          `HTTP ${response.status}: ${response.statusText}`
        );
      }

      return data;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  get(endpoint: string) {
    return this.request(endpoint, { method: 'GET' });
  }

  post(endpoint: string, body: any) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  patch(endpoint: string, body: any) {
    return this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint: string) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

export const apiClient = new ApiClient();
```

### 3. **Shop Data Service**

```typescript
// shop-data.service.ts
import { apiClient } from './api-client';

class ShopDataService {
  async getPayments(shopId: string, filters: any = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const response = await apiClient.get(
      `/api/shops/${shopId}/payments?${queryParams}`
    );
    return response.data;
  }

  async getPaymentDetails(shopId: string, paymentId: string) {
    const response = await apiClient.get(
      `/api/shops/${shopId}/payments/${paymentId}`
    );
    return response.data;
  }

  async getReservations(shopId: string, filters: any = {}) {
    const queryParams = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        queryParams.append(key, String(value));
      }
    });

    const response = await apiClient.get(
      `/api/shops/${shopId}/reservations?${queryParams}`
    );
    return response.data;
  }

  async updateReservationStatus(
    shopId: string,
    reservationId: string,
    update: { status: string; reason?: string; notes?: string }
  ) {
    const response = await apiClient.patch(
      `/api/shops/${shopId}/reservations/${reservationId}`,
      update
    );
    return response.data;
  }
}

export const shopDataService = new ShopDataService();
```

### 4. **React/Vue Component Examples**

**React Example:**

```typescript
// PaymentsPage.tsx
import React, { useState, useEffect } from 'react';
import { shopDataService } from './services/shop-data.service';
import { authService } from './services/auth.service';

export function PaymentsPage() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: 'completed',
    page: 1,
    limit: 20
  });

  const user = authService.getUser();
  const shopId = user?.shopId;

  useEffect(() => {
    if (!shopId) {
      console.error('No shop ID found for user');
      return;
    }

    loadPayments();
  }, [shopId, filters]);

  async function loadPayments() {
    try {
      setLoading(true);
      const data = await shopDataService.getPayments(shopId, filters);
      setPayments(data.payments);
    } catch (error) {
      console.error('Failed to load payments:', error);
      // Show error notification
    } finally {
      setLoading(false);
    }
  }

  if (!shopId) {
    return <div>Error: No shop assigned to this user</div>;
  }

  if (loading) {
    return <div>Loading payments...</div>;
  }

  return (
    <div>
      <h1>Shop Payments</h1>
      <div>
        {/* Filter controls */}
        <select
          value={filters.status}
          onChange={e => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {payments.map(payment => (
            <tr key={payment.id}>
              <td>{new Date(payment.createdAt).toLocaleDateString()}</td>
              <td>{payment.users?.name}</td>
              <td>{payment.amount.toLocaleString()}원</td>
              <td>{payment.status}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

**Vue Example:**

```vue
<!-- PaymentsPage.vue -->
<template>
  <div>
    <h1>Shop Payments</h1>
    <div v-if="loading">Loading payments...</div>
    <div v-else>
      <div class="filters">
        <select v-model="filters.status" @change="loadPayments">
          <option value="completed">Completed</option>
          <option value="pending">Pending</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Customer</th>
            <th>Amount</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="payment in payments" :key="payment.id">
            <td>{{ formatDate(payment.createdAt) }}</td>
            <td>{{ payment.users?.name }}</td>
            <td>{{ formatCurrency(payment.amount) }}</td>
            <td>{{ payment.status }}</td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { shopDataService } from './services/shop-data.service';
import { authService } from './services/auth.service';

const payments = ref([]);
const loading = ref(true);
const filters = ref({
  status: 'completed',
  page: 1,
  limit: 20
});

const user = authService.getUser();
const shopId = user?.shopId;

async function loadPayments() {
  if (!shopId) {
    console.error('No shop ID found for user');
    return;
  }

  try {
    loading.value = true;
    const data = await shopDataService.getPayments(shopId, filters.value);
    payments.value = data.payments;
  } catch (error) {
    console.error('Failed to load payments:', error);
  } finally {
    loading.value = false;
  }
}

function formatDate(dateString: string) {
  return new Date(dateString).toLocaleDateString();
}

function formatCurrency(amount: number) {
  return `${amount.toLocaleString()}원`;
}

onMounted(() => {
  loadPayments();
});

watch(filters, () => {
  loadPayments();
}, { deep: true });
</script>
```

---

## Testing & Debugging

### 1. **API Documentation**

- **Complete API**: http://localhost:3001/api-docs
- **Admin API**: http://localhost:3001/admin-docs
- **Service API**: http://localhost:3001/service-docs

### 2. **Testing with Postman/Insomnia**

**Example: Admin Login**

```
POST http://localhost:3001/api/admin/auth/login
Content-Type: application/json

{
  "email": "admin@example.com",
  "password": "password123"
}
```

**Example: Get Shop Payments**

```
GET http://localhost:3001/api/shops/123e4567-e89b-12d3-a456-426614174000/payments?status=completed&page=1&limit=20
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. **Debugging Tips**

**Check Authentication:**
```typescript
// Verify token is valid
const response = await fetch('http://localhost:3001/api/admin/auth/validate', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
console.log(await response.json());
```

**Check Shop Access:**
```typescript
// Verify user has access to shop
const shopId = 'shop-uuid';
const response = await fetch(`http://localhost:3001/api/shops/${shopId}/payments`, {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// If 403, user doesn't have access to this shop
// If 401, token is invalid or expired
```

**Browser DevTools:**
- **Network Tab**: Inspect request/response headers and payloads
- **Console**: Check for JavaScript errors
- **Application Tab**: Verify tokens are stored correctly in localStorage

### 4. **Common Issues**

| Issue | Cause | Solution |
|-------|-------|----------|
| 401 Unauthorized | Token expired or invalid | Call refresh endpoint or re-login |
| 403 Shop Access Denied | User trying to access wrong shop | Ensure `shopId` matches user's `shop_id` |
| 404 Not Found | Wrong endpoint URL | Check API documentation |
| CORS Error | Frontend not in allowed origins | Add origin to `CORS_ORIGIN` env variable |
| Network Error | Backend not running | Start backend with `npm run dev` |

---

## Summary

### Key Takeaways

1. **Two authentication systems**:
   - Supabase Auth for regular users
   - Custom JWT for admin dashboard

2. **Shop-scoped architecture**:
   - All shop data accessed via `/api/shops/:shopId/*`
   - Automatic access control based on user role and shop_id

3. **Role-based permissions**:
   - Platform admins: Access all shops
   - Shop roles: Access only their shop

4. **Token management**:
   - 24-hour access tokens
   - 7-day refresh tokens
   - Automatic token refresh on expiry

5. **Standard response format**:
   - Success: `{ success: true, data: {...} }`
   - Error: `{ success: false, error: {...} }`

### Next Steps

1. **Implement authentication service** in your frontend
2. **Create API client** with automatic token refresh
3. **Build shop data services** for payments, reservations, etc.
4. **Add error handling** and user notifications
5. **Test thoroughly** with both platform admin and shop owner accounts
6. **Review Swagger documentation** for additional endpoints

---

## Additional Resources

- **Backend Repository**: Check `src/` directory for complete implementation
- **API Documentation**: http://localhost:3001/api-docs
- **Environment Setup**: See `.env.example` for required configuration
- **Database Schema**: Check Supabase dashboard for table structures

---

**Questions or Issues?**

- Check the Swagger UI for detailed endpoint documentation
- Review error responses for specific error codes
- Contact backend team for API-specific questions
