# Shop Admin API Implementation Guide

**Version:** 3.1
**Last Updated:** 2025-07-23
**Backend Base URL:** `http://localhost:3001` (Development) | `https://api.ebeautything.com` (Production)

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Shop Owner Authentication Endpoints](#shop-owner-authentication-endpoints)
4. [Shop Owner Dashboard Endpoints](#shop-owner-dashboard-endpoints)
5. [Shop Management Endpoints](#shop-management-endpoints)
6. [Reservation Management Endpoints](#reservation-management-endpoints)
7. [Service Management Endpoints](#service-management-endpoints)
8. [Customer Management Endpoints](#customer-management-endpoints)
9. [Payment & Settlement Endpoints](#payment--settlement-endpoints)
10. [Analytics & Reports Endpoints](#analytics--reports-endpoints)
11. [Admin Panel Endpoints (Platform Admin)](#admin-panel-endpoints-platform-admin)
12. [Data Structures](#data-structures)
13. [Error Handling](#error-handling)
14. [Implementation Best Practices](#implementation-best-practices)

---

## Overview

This document provides a comprehensive guide for implementing the Shop Admin (샵 관리자) functionality for the Ebeautything platform frontend. The Shop Admin system allows shop owners to manage their shops, reservations, services, customers, and view analytics.

### Key Features

- **Shop Owner Authentication**: Login, session management, password change
- **Dashboard**: Real-time shop metrics, reservation overview, revenue tracking
- **Reservation Management**: Confirm, reject, complete reservations, manage status
- **Service Management**: CRUD operations for shop services
- **Customer Management**: View customer history, reservation stats
- **Payment Management**: View payment records, settlement history
- **Analytics**: Revenue analytics, performance metrics

---

## Authentication & Authorization

### Authentication Flow

1. **Shop Owner Login** → Returns JWT access token + refresh token
2. **Include JWT** in all subsequent requests via `Authorization: Bearer <token>` header
3. **Token Refresh** when access token expires (24 hours)
4. **Logout** to revoke session

### JWT Token Structure

```typescript
interface JWTPayload {
  id: string;           // User ID (UUID)
  email: string;        // Shop owner email
  user_role: 'shop_owner';
  shopId: string;       // Primary shop ID
  iat: number;          // Issued at timestamp
  exp: number;          // Expiration timestamp
}
```

### Authorization Levels

- **Shop Owner**: Can only access their own shop data
- **Platform Admin**: Can access any shop data (separate admin routes)

---

## Shop Owner Authentication Endpoints

### 1. Shop Owner Login

**Endpoint:** `POST /api/shop-owner/auth/login`
**Description:** Authenticate shop owner and create session

**Request:**
```typescript
{
  email: string;                    // Shop owner email (required)
  password: string;                 // Password (required, min 8 characters)
  deviceInfo?: {
    deviceId?: string;              // Unique device identifier
    deviceName?: string;            // Human-readable name (e.g., "iPhone 14 Pro")
    userAgent?: string;             // Browser user agent
  };
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shopOwner: {
      id: string;                   // User UUID
      email: string;
      name: string;
      role: 'shop_owner';
      shop: {
        id: string;                 // Shop UUID
        name: string;
        status: 'active' | 'inactive' | 'suspended';
        mainCategory: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
        address: string;
        phoneNumber: string;
      };
    };
    token: string;                  // JWT access token (24h expiry)
    refreshToken: string;           // JWT refresh token (7d expiry)
    expiresAt: string;              // ISO 8601 timestamp
    security: {
      lastLoginAt: string;          // ISO 8601 timestamp
      loginLocation: string;        // Geographic location
    };
  };
}
```

**Error Responses:**
- `400`: Invalid input (missing email/password)
- `401`: Invalid credentials
- `403`: Account locked (after 5 failed attempts, 30min lockout) or no active shop
- `500`: Internal server error

**Security Features:**
- Failed login tracking (locks after 5 attempts for 30 minutes)
- Account status validation
- Shop ownership verification
- Session creation with device tracking
- Comprehensive audit logging

**Implementation Example:**
```typescript
async function shopOwnerLogin(email: string, password: string, deviceInfo?: DeviceInfo) {
  try {
    const response = await fetch('/api/shop-owner/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, deviceInfo })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Login failed');
    }

    const { data } = await response.json();

    // Store tokens securely
    localStorage.setItem('accessToken', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    localStorage.setItem('shopOwner', JSON.stringify(data.shopOwner));

    return data;
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
}
```

---

### 2. Refresh Session Token

**Endpoint:** `POST /api/shop-owner/auth/refresh`
**Description:** Refresh access token using refresh token

**Request:**
```typescript
{
  refreshToken: string;             // JWT refresh token (required)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shopOwner: {
      id: string;
      email: string;
      role: 'shop_owner';
      shop: {
        id: string;
        name: string;
      };
    };
    token: string;                  // New JWT access token
    refreshToken: string;           // New JWT refresh token
    expiresAt: string;              // ISO 8601 timestamp
  };
}
```

**Error Responses:**
- `401`: Invalid or expired refresh token
- `500`: Internal server error

**Implementation Example:**
```typescript
async function refreshAuthToken() {
  const refreshToken = localStorage.getItem('refreshToken');

  const response = await fetch('/api/shop-owner/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  if (response.ok) {
    const { data } = await response.json();
    localStorage.setItem('accessToken', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return data.token;
  }

  // Refresh failed, redirect to login
  localStorage.clear();
  window.location.href = '/shop-admin/login';
}
```

---

### 3. Logout

**Endpoint:** `POST /api/shop-owner/auth/logout`
**Authentication:** Required (Bearer token)

**Request:** No body required

**Response (200 OK):**
```typescript
{
  success: true;
  message: 'Successfully logged out';
}
```

**Implementation Example:**
```typescript
async function logout() {
  const token = localStorage.getItem('accessToken');

  await fetch('/api/shop-owner/auth/logout', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });

  // Clear local storage
  localStorage.clear();
  window.location.href = '/shop-admin/login';
}
```

---

### 4. Validate Session

**Endpoint:** `GET /api/shop-owner/auth/validate`
**Authentication:** Required (Bearer token)
**Description:** Validate current session and get session info

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shopOwner: {
      id: string;
      email: string;
      role: 'shop_owner';
      shop: {
        id: string;
        name: string;
      };
    };
    session: {
      id: string;                   // Session UUID
      expiresAt: string;            // ISO 8601 timestamp
      lastActivityAt: string;       // ISO 8601 timestamp
    };
  };
}
```

**Error Responses:**
- `401`: Invalid or expired session
- `500`: Internal server error

---

### 5. Get Shop Owner Profile

**Endpoint:** `GET /api/shop-owner/auth/profile`
**Authentication:** Required (Bearer token)

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    id: string;
    email: string;
    name: string;
    role: 'shop_owner';
    status: 'active' | 'inactive' | 'suspended';
    shop: {
      id: string;
      name: string;
      status: 'active' | 'inactive' | 'suspended';
      mainCategory: string;
      address: string;
      phoneNumber: string;
      description: string;
    };
    createdAt: string;              // ISO 8601 timestamp
    lastLoginAt: string;            // ISO 8601 timestamp
    lastLoginIp: string;
  };
}
```

---

### 6. Change Password

**Endpoint:** `POST /api/shop-owner/auth/change-password`
**Authentication:** Required (Bearer token)

**Request:**
```typescript
{
  currentPassword: string;          // Current password (required)
  newPassword: string;              // New password (required, min 8 characters)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  message: 'Password changed successfully';
}
```

**Error Responses:**
- `400`: Current password is incorrect or new password doesn't meet requirements
- `401`: Authentication required
- `500`: Internal server error

---

## Shop Owner Dashboard Endpoints

### 1. Get Dashboard Overview

**Endpoint:** `GET /api/shop-owner/dashboard`
**Authentication:** Required (Bearer token)
**Description:** Get shop owner dashboard overview with key metrics

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shops: {
      total: number;                // Total number of shops owned
      active: number;               // Active shops count
    };
    reservations: {
      today: number;                // Reservations scheduled for today
      pending: number;              // Reservations awaiting confirmation
      thisWeek: number;             // Reservations this week
      thisMonth: number;            // Reservations this month
    };
    revenue: {
      today: number;                // Today's revenue in KRW
      thisWeek: number;             // This week's revenue
      thisMonth: number;            // This month's revenue
      lastMonth: number;            // Last month's revenue (for comparison)
    };
    recentReservations: [
      {
        id: string;                 // Reservation UUID
        customerName: string;
        customerPhone: string;
        serviceName: string;
        reservationDate: string;    // ISO 8601 date
        reservationTime: string;    // HH:MM format
        status: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
        totalAmount: number;        // Amount in KRW
        depositAmount: number;      // Deposit paid in KRW
        createdAt: string;          // ISO 8601 timestamp
      }
    ];
    stats: {
      completionRate: number;       // Percentage (0-100)
      averageRating: number;        // Average rating (0-5)
      totalCustomers: number;       // Unique customer count
      repeatCustomers: number;      // Customers with 2+ reservations
    };
  };
}
```

**Error Responses:**
- `401`: Authentication required
- `404`: No active shops found
- `500`: Internal server error

**Implementation Example:**
```typescript
async function getDashboard() {
  const token = localStorage.getItem('accessToken');

  const response = await fetch('/api/shop-owner/dashboard', {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  if (!response.ok) {
    if (response.status === 401) {
      // Try to refresh token
      await refreshAuthToken();
      return getDashboard(); // Retry
    }
    throw new Error('Failed to fetch dashboard');
  }

  return await response.json();
}
```

---

### 2. Get Analytics

**Endpoint:** `GET /api/shop-owner/analytics`
**Authentication:** Required (Bearer token)
**Description:** Get detailed shop analytics and performance metrics

**Query Parameters:**
```typescript
{
  period?: 'day' | 'week' | 'month' | 'year';  // Default: 'month'
  startDate?: string;                          // ISO date (YYYY-MM-DD)
  endDate?: string;                            // ISO date (YYYY-MM-DD)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    overview: {
      totalReservations: number;
      completedReservations: number;
      cancelledReservations: number;
      noShowCount: number;
      completionRate: number;       // Percentage (0-100)
      totalRevenue: number;         // Total revenue in KRW
      averageOrderValue: number;    // Average per reservation
      growthRate: number;           // Percentage change vs previous period
    };
    chartData: [
      {
        date: string;               // YYYY-MM-DD format
        reservations: number;       // Count for this date
        revenue: number;            // Revenue for this date in KRW
        completions: number;        // Completed count
        cancellations: number;      // Cancelled count
      }
    ];
    topServices: [
      {
        serviceId: string;
        serviceName: string;
        category: string;
        bookingCount: number;
        revenue: number;
      }
    ];
    shop: {
      id: string;
      name: string;
      mainCategory: string;
    };
  };
}
```

**Error Responses:**
- `400`: Invalid date range
- `401`: Authentication required
- `500`: Internal server error

**Implementation Example:**
```typescript
async function getAnalytics(period: 'day' | 'week' | 'month' | 'year' = 'month') {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`/api/shop-owner/analytics?period=${period}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });

  return await response.json();
}
```

---

## Reservation Management Endpoints

### 1. Get All Reservations

**Endpoint:** `GET /api/shop-owner/reservations`
**Authentication:** Required (Bearer token)
**Description:** Get all reservations for the shop with filtering and pagination

**Query Parameters:**
```typescript
{
  status?: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
  startDate?: string;               // ISO date (YYYY-MM-DD)
  endDate?: string;                 // ISO date (YYYY-MM-DD)
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20, max: 100
  search?: string;                  // Search by customer name/phone
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservations: [
      {
        id: string;                 // Reservation UUID
        userId: string;             // Customer UUID
        shopId: string;             // Shop UUID
        customer: {
          id: string;
          name: string;
          email: string;
          phoneNumber: string;
          profileImageUrl: string | null;
        };
        service: {
          id: string;
          name: string;
          category: string;
          priceMin: number;
          priceMax: number;
          durationMinutes: number;
        };
        reservationDate: string;    // YYYY-MM-DD
        reservationTime: string;    // HH:MM
        reservationDatetime: string; // ISO 8601 timestamp
        status: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
        totalAmount: number;        // Total service amount in KRW
        depositAmount: number;      // Deposit paid in KRW
        remainingAmount: number;    // Remaining balance in KRW
        pointsUsed: number;         // Points used for payment
        pointsEarned: number;       // Points earned from completion
        specialRequests: string | null;
        shopNotes: string | null;
        cancellationReason: string | null;
        noShowReason: string | null;
        confirmedAt: string | null; // ISO 8601 timestamp
        completedAt: string | null; // ISO 8601 timestamp
        cancelledAt: string | null; // ISO 8601 timestamp
        createdAt: string;          // ISO 8601 timestamp
        updatedAt: string;          // ISO 8601 timestamp
      }
    ];
    pagination: {
      total: number;                // Total count
      page: number;                 // Current page
      limit: number;                // Items per page
      totalPages: number;           // Total pages
    };
  };
}
```

**Error Responses:**
- `400`: Invalid query parameters
- `401`: Authentication required
- `500`: Internal server error

---

### 2. Get Pending Reservations

**Endpoint:** `GET /api/shop-owner/reservations/pending`
**Authentication:** Required (Bearer token)
**Description:** Get reservations awaiting shop owner confirmation (status: 'requested')

**Query Parameters:**
```typescript
{
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20
  search?: string;                  // Search by customer name/phone/email
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservations: [
      {
        id: string;
        userId: string;
        shopId: string;
        customer: {
          id: string;
          name: string;
          email: string;
          phoneNumber: string;
          profileImageUrl: string | null;
        };
        service: {
          id: string;
          name: string;
          category: string;
          durationMinutes: number;
        };
        reservationDate: string;
        reservationTime: string;
        reservationDatetime: string;
        status: 'requested';
        totalAmount: number;
        depositAmount: number;
        depositPaid: boolean;        // Whether deposit has been paid
        specialRequests: string | null;
        waitingTime: string;         // Human-readable (e.g., "2 hours ago")
        urgencyLevel: 'low' | 'medium' | 'high';  // Based on waiting time
        createdAt: string;
      }
    ];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      total: number;                // Total pending count
      urgent: number;               // Count waiting >24h
      today: number;                // Count for today's reservations
    };
  };
}
```

---

### 3. Confirm Reservation

**Endpoint:** `PUT /api/shop-owner/reservations/:reservationId/confirm`
**Authentication:** Required (Bearer token)
**Description:** Confirm a pending reservation (status: requested → confirmed)

**Path Parameters:**
- `reservationId`: Reservation UUID (required)

**Request Body:**
```typescript
{
  notes?: string;                   // Optional confirmation notes (max 500 chars)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservation: {
      id: string;
      status: 'confirmed';
      confirmedAt: string;          // ISO 8601 timestamp
      shopNotes: string | null;
      updatedAt: string;
    };
    notification: {
      sent: boolean;                // Whether customer was notified
      method: 'push' | 'sms' | 'email';
    };
  };
  message: '예약이 확정되었습니다.';
}
```

**Business Rules:**
- Only reservations with status 'requested' can be confirmed
- Shop owner must own the reservation
- Deposit must be paid if required
- Sends automatic confirmation notification to customer

**Error Responses:**
- `400`: Invalid reservation status (not 'requested')
- `401`: Authentication required
- `403`: Not authorized for this shop
- `404`: Reservation not found
- `500`: Internal server error

**Implementation Example:**
```typescript
async function confirmReservation(reservationId: string, notes?: string) {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`/api/shop-owner/reservations/${reservationId}/confirm`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ notes })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to confirm reservation');
  }

  return await response.json();
}
```

---

### 4. Reject Reservation

**Endpoint:** `PUT /api/shop-owner/reservations/:reservationId/reject`
**Authentication:** Required (Bearer token)
**Description:** Reject a pending reservation (status: requested → cancelled_by_shop)

**Path Parameters:**
- `reservationId`: Reservation UUID (required)

**Request Body:**
```typescript
{
  notes?: string;                   // Optional rejection reason (max 500 chars)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservation: {
      id: string;
      status: 'cancelled_by_shop';
      cancelledAt: string;          // ISO 8601 timestamp
      cancellationReason: string | null;
      updatedAt: string;
    };
    refund: {
      processed: boolean;           // Whether deposit refund was processed
      amount: number;               // Refunded amount in KRW
      refundedAt: string | null;    // ISO 8601 timestamp
    };
    notification: {
      sent: boolean;
      method: 'push' | 'sms' | 'email';
    };
  };
  message: '예약이 거절되었습니다.';
}
```

**Business Rules:**
- Only reservations with status 'requested' can be rejected
- Shop owner must own the reservation
- Automatically processes deposit refund if paid
- Sends rejection notification to customer

**Error Responses:**
- `400`: Invalid reservation status
- `401`: Authentication required
- `403`: Not authorized for this shop
- `404`: Reservation not found
- `500`: Internal server error

---

### 5. Complete Service

**Endpoint:** `PUT /api/shop-owner/reservations/:reservationId/complete`
**Authentication:** Required (Bearer token)
**Description:** Mark service as completed and trigger point calculation (status: confirmed → completed)

**Path Parameters:**
- `reservationId`: Reservation UUID (required)

**Request Body:**
```typescript
{
  finalAmount?: number;             // Final service amount (optional, defaults to original)
  completionNotes?: string;         // Completion notes (optional, max 1000 chars)
  serviceDetails?: object;          // Additional service details (optional)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservation: {
      id: string;
      status: 'completed';
      completedAt: string;          // ISO 8601 timestamp
      totalAmount: number;          // Final amount
      remainingAmount: number;      // Balance due
      pointsEarned: number;         // Points awarded to customer
      updatedAt: string;
    };
    pointCalculation: {
      baseAmount: number;           // Amount points calculated on
      rate: number;                 // Point rate (e.g., 2.5%)
      pointsAwarded: number;        // Points added to customer account
      maxCap: number;               // Maximum points cap (300,000 KRW)
    };
    payment: {
      depositPaid: boolean;
      remainingDue: number;
      paymentStatus: 'completed' | 'partial';
    };
  };
  message: '서비스 완료 처리되었습니다.';
}
```

**Business Rules:**
- Only reservations with status 'confirmed' can be completed
- Shop owner must own the reservation
- Automatically calculates and awards points (2.5% rate, 300,000 KRW max)
- Updates payment status to 'completed'
- Triggers referral point awards if applicable
- Points become available after 7 days (configurable)

**Error Responses:**
- `400`: Invalid reservation status (not 'confirmed')
- `401`: Authentication required
- `403`: Not authorized for this shop
- `404`: Reservation not found
- `500`: Internal server error

**Implementation Example:**
```typescript
async function completeService(
  reservationId: string,
  finalAmount?: number,
  completionNotes?: string
) {
  const token = localStorage.getItem('accessToken');

  const response = await fetch(`/api/shop-owner/reservations/${reservationId}/complete`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ finalAmount, completionNotes })
  });

  if (!response.ok) {
    throw new Error('Failed to complete service');
  }

  return await response.json();
}
```

---

### 6. Update Reservation Status (Generic)

**Endpoint:** `PUT /api/shop-owner/reservations/:reservationId/status`
**Authentication:** Required (Bearer token)
**Description:** Generic endpoint to update reservation status

**Path Parameters:**
- `reservationId`: Reservation UUID (required)

**Request Body:**
```typescript
{
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_shop' | 'no_show';  // Required
  notes?: string;                   // Optional status change notes
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    reservation: {
      id: string;
      status: string;
      updatedAt: string;
    };
  };
  message: '예약 상태가 업데이트되었습니다.';
}
```

---

## Service Management Endpoints

### 1. Get Shop Services

**Endpoint:** `GET /api/admin/shops/:shopId/services`
**Authentication:** Required (Bearer token, shop owner or admin)
**Description:** Get all services for a specific shop

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Query Parameters:**
```typescript
{
  category?: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  isAvailable?: boolean;
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    services: [
      {
        id: string;                 // Service UUID
        shopId: string;
        name: string;
        description: string | null;
        category: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
        priceMin: number;           // Minimum price in KRW
        priceMax: number;           // Maximum price in KRW
        durationMinutes: number;    // Service duration
        depositAmount: number | null;      // Fixed deposit amount
        depositPercentage: number | null;  // Or percentage-based deposit (0-100)
        isAvailable: boolean;
        bookingAdvanceDays: number; // How many days in advance can book (default: 30)
        cancellationHours: number;  // Cancellation policy hours (default: 24)
        displayOrder: number;       // Display order (for sorting)
        createdAt: string;
        updatedAt: string;
      }
    ];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
```

**Error Responses:**
- `401`: Authentication required
- `403`: Not authorized for this shop
- `404`: Shop not found
- `500`: Internal server error

---

### 2. Create Service

**Endpoint:** `POST /api/admin/shops/:shopId/services`
**Authentication:** Required (Bearer token, shop owner or admin)
**Description:** Create a new service for the shop

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Request Body:**
```typescript
{
  name: string;                     // Service name (required, max 255 chars)
  description?: string;             // Service description (max 1000 chars)
  category: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';  // Required
  priceMin: number;                 // Minimum price (required, min: 0)
  priceMax: number;                 // Maximum price (required, >= priceMin)
  durationMinutes: number;          // Duration in minutes (required, min: 1)
  depositAmount?: number;           // Fixed deposit amount (optional)
  depositPercentage?: number;       // Or percentage (optional, 0-100)
  isAvailable?: boolean;            // Default: true
  bookingAdvanceDays?: number;      // Default: 30
  cancellationHours?: number;       // Default: 24
  displayOrder?: number;            // Default: 0
}
```

**Response (201 Created):**
```typescript
{
  success: true;
  data: {
    service: {
      id: string;
      shopId: string;
      name: string;
      description: string | null;
      category: string;
      priceMin: number;
      priceMax: number;
      durationMinutes: number;
      depositAmount: number | null;
      depositPercentage: number | null;
      isAvailable: boolean;
      bookingAdvanceDays: number;
      cancellationHours: number;
      displayOrder: number;
      createdAt: string;
      updatedAt: string;
    };
  };
  message: '서비스가 생성되었습니다.';
}
```

**Error Responses:**
- `400`: Validation error (invalid input)
- `401`: Authentication required
- `403`: Not authorized for this shop
- `500`: Internal server error

---

### 3. Update Service

**Endpoint:** `PUT /api/admin/shops/:shopId/services/:serviceId`
**Authentication:** Required (Bearer token, shop owner or admin)

**Path Parameters:**
- `shopId`: Shop UUID (required)
- `serviceId`: Service UUID (required)

**Request Body:** (All fields optional)
```typescript
{
  name?: string;
  description?: string;
  category?: string;
  priceMin?: number;
  priceMax?: number;
  durationMinutes?: number;
  depositAmount?: number;
  depositPercentage?: number;
  isAvailable?: boolean;
  bookingAdvanceDays?: number;
  cancellationHours?: number;
  displayOrder?: number;
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    service: {
      id: string;
      // ... updated service fields
      updatedAt: string;
    };
  };
  message: '서비스가 업데이트되었습니다.';
}
```

---

### 4. Delete Service

**Endpoint:** `DELETE /api/admin/shops/:shopId/services/:serviceId`
**Authentication:** Required (Bearer token, shop owner or admin)

**Path Parameters:**
- `shopId`: Shop UUID (required)
- `serviceId`: Service UUID (required)

**Response (200 OK):**
```typescript
{
  success: true;
  message: '서비스가 삭제되었습니다.';
}
```

**Error Responses:**
- `400`: Cannot delete (has active reservations)
- `401`: Authentication required
- `403`: Not authorized
- `404`: Service not found
- `500`: Internal server error

---

## Customer Management Endpoints

### 1. Get Shop Customers

**Endpoint:** `GET /api/shop-owner/customers`
**Authentication:** Required (Bearer token)
**Description:** Get list of customers who have made reservations at the shop

**Query Parameters:**
```typescript
{
  status?: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
  search?: string;                  // Search by name, email, phone
  sortBy?: 'total_reservations' | 'total_spent' | 'last_reservation_date' | 'name';
  sortOrder?: 'asc' | 'desc';       // Default: 'desc'
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    customers: [
      {
        id: string;                 // User UUID
        name: string;
        email: string;
        phoneNumber: string;
        profileImageUrl: string | null;
        stats: {
          totalReservations: number;
          completedReservations: number;
          cancelledReservations: number;
          noShowCount: number;
          totalSpent: number;       // Total amount spent in KRW
          averageSpending: number;  // Average per reservation
          lastReservationDate: string | null;  // ISO date
          firstReservationDate: string;        // ISO date
        };
        recentReservations: [
          {
            id: string;
            serviceName: string;
            reservationDate: string;
            status: string;
            totalAmount: number;
          }
        ];
      }
    ];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
```

---

### 2. Get Customer Statistics

**Endpoint:** `GET /api/shop-owner/customers/stats`
**Authentication:** Required (Bearer token)

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    total: number;                  // Total unique customers
    new: number;                    // New customers this month
    active: number;                 // Customers with reservations this month
    returning: number;              // Customers with 2+ reservations
    byStatus: {
      active: number;
      inactive: number;
      suspended: number;
    };
  };
}
```

---

## Payment & Settlement Endpoints

### 1. Get Shop Payments

**Endpoint:** `GET /api/shop-owner/payments`
**Authentication:** Required (Bearer token)
**Description:** Get payment records for the shop

**Query Parameters:**
```typescript
{
  status?: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  paymentMethod?: 'card' | 'cash' | 'points' | 'mixed';
  startDate?: string;               // ISO date (YYYY-MM-DD)
  endDate?: string;                 // ISO date (YYYY-MM-DD)
  userId?: string;                  // Filter by customer UUID
  reservationId?: string;           // Filter by reservation UUID
  minAmount?: number;               // Minimum amount filter
  maxAmount?: number;               // Maximum amount filter
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    payments: [
      {
        id: string;                 // Payment UUID
        reservationId: string;
        userId: string;
        amount: number;             // Payment amount in KRW
        paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
        paymentStage: 'single' | 'deposit' | 'final';  // Payment stage
        paymentMethod: 'card' | 'cash' | 'points' | 'mixed';
        isDeposit: boolean;         // Whether this is a deposit payment
        paidAt: string | null;      // ISO 8601 timestamp

        // PortOne payment details
        portonePaymentId: string | null;
        portonePaymentKey: string | null;
        portoneTransactionId: string | null;
        portoneMethodType: 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'GIFT_CERTIFICATE' | 'EASY_PAY';
        portonePgProvider: string | null;

        // Amount breakdown
        totalAmount: number;
        suppliedAmount: number;
        vatAmount: number;
        taxFreeAmount: number;
        discountAmount: number;
        balanceAmount: number;

        // Card details (if card payment)
        cardCompany: string | null;
        cardNumber: string | null;   // Masked (e.g., "1234-****-****-5678")
        cardInstallmentMonths: number | null;
        cardIsInterestFree: boolean | null;
        cardApproveNo: string | null;

        // Virtual account details (if virtual account)
        virtualAccountNumber: string | null;
        virtualAccountBankCode: string | null;
        virtualAccountBankName: string | null;
        virtualAccountHolderName: string | null;
        virtualAccountDueDate: string | null;
        virtualAccountExpired: boolean;

        // Receipt URLs
        receiptUrl: string | null;
        checkoutUrl: string | null;

        // Related data
        reservation: {
          id: string;
          serviceName: string;
          reservationDate: string;
          status: string;
        };
        customer: {
          id: string;
          name: string;
          email: string;
          phoneNumber: string;
        };

        createdAt: string;
        updatedAt: string;
      }
    ];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
    summary: {
      totalAmount: number;          // Sum of all payment amounts
      totalRefunded: number;        // Sum of refunded amounts
      netAmount: number;            // Total - Refunded
    };
  };
}
```

---

### 2. Get Payment Details

**Endpoint:** `GET /api/shops/:shopId/payments/:paymentId`
**Authentication:** Required (Bearer token)

**Path Parameters:**
- `shopId`: Shop UUID (required)
- `paymentId`: Payment UUID (required)

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    // Complete payment object with all details (same as payments array item above)
  };
}
```

---

## Analytics & Reports Endpoints

### 1. Get Quick Dashboard Analytics

**Endpoint:** `GET /api/shops/:shopId/analytics/dashboard/quick`
**Authentication:** Required (Bearer token)

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Query Parameters:**
```typescript
{
  period?: '7d' | '30d' | '90d';    // Default: '7d'
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    period: '7d' | '30d' | '90d';
    metrics: {
      totalReservations: number;
      completedReservations: number;
      totalRevenue: number;
      averageOrderValue: number;
      completionRate: number;       // Percentage (0-100)
      cancellationRate: number;     // Percentage (0-100)
      noShowRate: number;           // Percentage (0-100)
    };
    comparison: {
      reservationsChange: number;   // Percentage change vs previous period
      revenueChange: number;        // Percentage change vs previous period
      completionRateChange: number; // Percentage point change
    };
  };
}
```

---

### 2. Get Detailed Revenue Analytics

**Endpoint:** `GET /api/shops/:shopId/analytics/revenue`
**Authentication:** Required (Bearer token)

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Query Parameters:**
```typescript
{
  startDate: string;                // ISO date (YYYY-MM-DD) (required)
  endDate: string;                  // ISO date (YYYY-MM-DD) (required)
  groupBy?: 'day' | 'week' | 'month';  // Default: 'day'
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    dateRange: {
      start: string;                // ISO date
      end: string;                  // ISO date
    };
    summary: {
      totalRevenue: number;
      depositRevenue: number;       // Total deposit payments
      finalPaymentRevenue: number;  // Total final payments
      refundedAmount: number;
      netRevenue: number;           // Total - Refunded
      averageOrderValue: number;
      transactionCount: number;
    };
    chartData: [
      {
        date: string;               // Grouping key (YYYY-MM-DD, YYYY-Wnn, or YYYY-MM)
        revenue: number;
        depositRevenue: number;
        finalPaymentRevenue: number;
        refundedAmount: number;
        transactionCount: number;
      }
    ];
    topServices: [
      {
        serviceId: string;
        serviceName: string;
        category: string;
        revenue: number;
        transactionCount: number;
      }
    ];
    paymentMethods: [
      {
        method: 'card' | 'cash' | 'points' | 'mixed';
        count: number;
        amount: number;
        percentage: number;         // Percentage of total (0-100)
      }
    ];
  };
}
```

---

## Admin Panel Endpoints (Platform Admin)

### 1. Get All Shops (Admin)

**Endpoint:** `GET /api/admin/shops`
**Authentication:** Required (Bearer token, admin role)
**Description:** Get all shops with filtering and pagination (admin only)

**Query Parameters:**
```typescript
{
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20, max: 100
  status?: 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';
  category?: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  shopType?: 'partnered' | 'non_partnered';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  sortBy?: 'created_at' | 'name' | 'main_category' | 'shop_status' | 'verification_status';
  sortOrder?: 'asc' | 'desc';       // Default: 'desc'
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shops: [
      {
        id: string;
        ownerId: string;
        name: string;
        description: string | null;
        phoneNumber: string | null;
        email: string | null;
        address: string;
        detailedAddress: string | null;
        postalCode: string | null;
        latitude: number | null;
        longitude: number | null;
        shopType: 'partnered' | 'non_partnered';
        shopStatus: 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';
        verificationStatus: 'pending' | 'verified' | 'rejected';
        businessLicenseNumber: string | null;
        businessLicenseImageUrl: string | null;
        mainCategory: string;
        subCategories: string[];
        operatingHours: object | null;
        paymentMethods: string[];
        kakaoChannelUrl: string | null;
        totalBookings: number;
        partnershipStartedAt: string | null;
        featuredUntil: string | null;
        isFeatured: boolean;
        commissionRate: number;
        createdAt: string;
        updatedAt: string;
        owner: {
          id: string;
          name: string;
          email: string;
          phoneNumber: string;
        };
      }
    ];
    pagination: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  };
}
```

---

### 2. Get Pending Shops (Admin)

**Endpoint:** `GET /api/admin/shops/pending`
**Authentication:** Required (Bearer token, admin role)
**Description:** Get shops pending verification/approval

**Query Parameters:**
```typescript
{
  page?: number;
  limit?: number;
  search?: string;                  // Search name, description, address
  category?: string;
  sortBy?: 'created_at' | 'name' | 'main_category';
  sortOrder?: 'asc' | 'desc';
}
```

**Response:** Similar to Get All Shops, filtered to pending shops

---

### 3. Approve/Reject Shop (Admin)

**Endpoint:** `PUT /api/admin/shops/:shopId/approve`
**Authentication:** Required (Bearer token, admin role)
**Description:** Approve or reject a shop application

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Request Body:**
```typescript
{
  approved: boolean;                // true = approve, false = reject (required)
  shopType?: 'partnered' | 'non_partnered';  // For approval
  commissionRate?: number;          // Commission rate (0-100), for approval
  notes?: string;                   // Admin notes (max 1000 chars)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shop: {
      id: string;
      name: string;
      shopStatus: 'active' | 'inactive';
      verificationStatus: 'verified' | 'rejected';
      shopType: string;
      commissionRate: number;
      updatedAt: string;
    };
  };
  message: '샵이 승인되었습니다.' | '샵이 거절되었습니다.';
}
```

---

### 4. Update Shop Status (Admin)

**Endpoint:** `PATCH /api/admin/shops/:shopId/status`
**Authentication:** Required (Bearer token, admin role)

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Request Body:**
```typescript
{
  status: 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';  // Required
  reason?: string;                  // Reason for status change (max 500 chars)
}
```

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    shop: {
      id: string;
      shopStatus: string;
      updatedAt: string;
    };
  };
  message: '샵 상태가 업데이트되었습니다.';
}
```

---

### 5. Get Shop Details (Admin)

**Endpoint:** `GET /api/admin/shops/:shopId`
**Authentication:** Required (Bearer token, admin role)

**Path Parameters:**
- `shopId`: Shop UUID (required)

**Response (200 OK):**
```typescript
{
  success: true;
  data: {
    // Complete shop object with all details
    id: string;
    // ... all shop fields
    owner: {
      id: string;
      name: string;
      email: string;
      phoneNumber: string;
      userStatus: string;
    };
    services: [
      {
        id: string;
        name: string;
        category: string;
        priceMin: number;
        priceMax: number;
        isAvailable: boolean;
      }
    ];
    images: [
      {
        id: string;
        imageUrl: string;
        altText: string;
        isPrimary: boolean;
        displayOrder: number;
      }
    ];
    stats: {
      totalReservations: number;
      completedReservations: number;
      totalRevenue: number;
      averageRating: number;
    };
  };
}
```

---

## Data Structures

### Shop Object

```typescript
interface Shop {
  id: string;                       // UUID
  ownerId: string;                  // UUID
  name: string;
  description: string | null;
  phoneNumber: string | null;
  email: string | null;
  address: string;
  detailedAddress: string | null;
  postalCode: string | null;
  latitude: number | null;          // Decimal degrees
  longitude: number | null;         // Decimal degrees
  shopType: 'partnered' | 'non_partnered';
  shopStatus: 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted';
  verificationStatus: 'pending' | 'verified' | 'rejected';
  businessLicenseNumber: string | null;
  businessLicenseImageUrl: string | null;
  mainCategory: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  subCategories: string[];
  operatingHours: {
    [key: string]: {                // 'monday', 'tuesday', etc.
      open: string;                 // HH:MM format
      close: string;                // HH:MM format
      closed: boolean;              // Is closed on this day
    };
  } | null;
  paymentMethods: ('cash' | 'card' | 'mobile_payment' | 'bank_transfer')[];
  kakaoChannelUrl: string | null;
  totalBookings: number;
  partnershipStartedAt: string | null;  // ISO 8601 timestamp
  featuredUntil: string | null;    // ISO 8601 timestamp
  isFeatured: boolean;
  commissionRate: number;           // Decimal (e.g., 10.00 = 10%)
  createdAt: string;                // ISO 8601 timestamp
  updatedAt: string;                // ISO 8601 timestamp
}
```

---

### Reservation Object

```typescript
interface Reservation {
  id: string;                       // UUID
  userId: string;                   // Customer UUID
  shopId: string;                   // Shop UUID
  reservationDate: string;          // YYYY-MM-DD
  reservationTime: string;          // HH:MM
  reservationDatetime: string;      // ISO 8601 timestamp
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
  totalAmount: number;              // Total service amount (KRW)
  depositAmount: number;            // Deposit required (KRW)
  remainingAmount: number;          // Balance due (KRW)
  pointsUsed: number;               // Points used for payment
  pointsEarned: number;             // Points earned on completion
  specialRequests: string | null;
  cancellationReason: string | null;
  noShowReason: string | null;
  shopNotes: string | null;
  confirmedAt: string | null;       // ISO 8601 timestamp
  completedAt: string | null;       // ISO 8601 timestamp
  cancelledAt: string | null;       // ISO 8601 timestamp
  createdAt: string;                // ISO 8601 timestamp
  updatedAt: string;                // ISO 8601 timestamp
  version: number;                  // Optimistic locking version
}
```

---

### Service Object

```typescript
interface ShopService {
  id: string;                       // UUID
  shopId: string;                   // UUID
  name: string;
  description: string | null;
  category: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  priceMin: number;                 // Minimum price (KRW)
  priceMax: number;                 // Maximum price (KRW)
  durationMinutes: number;          // Service duration
  depositAmount: number | null;     // Fixed deposit amount
  depositPercentage: number | null; // Or percentage-based (0-100)
  isAvailable: boolean;
  bookingAdvanceDays: number;       // How many days in advance (default: 30)
  cancellationHours: number;        // Cancellation policy (default: 24)
  displayOrder: number;             // For sorting (default: 0)
  createdAt: string;                // ISO 8601 timestamp
  updatedAt: string;                // ISO 8601 timestamp
}
```

---

### Payment Object

```typescript
interface Payment {
  id: string;                       // UUID
  reservationId: string;            // UUID
  userId: string;                   // UUID
  amount: number;                   // Payment amount (KRW)
  paymentStatus: 'pending' | 'completed' | 'failed' | 'refunded' | 'partially_refunded';
  paymentStage: 'single' | 'deposit' | 'final';
  paymentMethod: 'card' | 'cash' | 'points' | 'mixed';
  isDeposit: boolean;
  paidAt: string | null;            // ISO 8601 timestamp

  // PortOne integration
  portonePaymentId: string | null;
  portonePaymentKey: string | null;
  portoneTransactionId: string | null;
  portoneMethodType: 'CARD' | 'VIRTUAL_ACCOUNT' | 'TRANSFER' | 'MOBILE' | 'GIFT_CERTIFICATE' | 'EASY_PAY';
  portonePgProvider: string | null;

  // Amount breakdown
  totalAmount: number;
  suppliedAmount: number;
  vatAmount: number;
  taxFreeAmount: number;
  discountAmount: number;
  balanceAmount: number;

  // Card payment details
  cardCompany: string | null;
  cardNumber: string | null;        // Masked
  cardInstallmentMonths: number | null;
  cardIsInterestFree: boolean | null;
  cardApproveNo: string | null;

  // Virtual account details
  virtualAccountNumber: string | null;
  virtualAccountBankCode: string | null;
  virtualAccountBankName: string | null;
  virtualAccountHolderName: string | null;
  virtualAccountDueDate: string | null;
  virtualAccountExpired: boolean;

  // Receipt URLs
  receiptUrl: string | null;
  checkoutUrl: string | null;

  createdAt: string;                // ISO 8601 timestamp
  updatedAt: string;                // ISO 8601 timestamp
  version: number;                  // Optimistic locking version
}
```

---

### User (Customer) Object

```typescript
interface User {
  id: string;                       // UUID
  email: string | null;
  phoneNumber: string | null;
  phoneVerified: boolean;
  name: string;
  nickname: string | null;
  gender: 'male' | 'female' | 'other' | null;
  birthDate: string | null;         // YYYY-MM-DD
  profileImageUrl: string | null;
  userRole: 'user' | 'shop_owner' | 'admin';
  userStatus: 'active' | 'inactive' | 'suspended';
  isInfluencer: boolean;
  influencerQualifiedAt: string | null;
  socialProvider: 'google' | 'kakao' | 'naver' | 'apple' | null;
  socialProviderId: string | null;
  referralCode: string | null;
  referredByCode: string | null;
  totalPoints: number;
  availablePoints: number;
  totalReferrals: number;
  successfulReferrals: number;
  lastLoginAt: string | null;
  lastActiveAt: string;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  marketingConsent: boolean;
  createdAt: string;
  updatedAt: string;
}
```

---

## Error Handling

### Standard Error Response Format

All error responses follow this structure:

```typescript
{
  success: false;
  error: {
    code: string;                   // Error code (e.g., 'UNAUTHORIZED', 'VALIDATION_ERROR')
    message: string;                // Human-readable message (Korean)
    details?: string | object;      // Additional error details
  };
}
```

### HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid input, validation error
- **401 Unauthorized**: Authentication required or invalid token
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate)
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Common Error Codes

```typescript
// Authentication Errors
'UNAUTHORIZED': 'Authentication required'
'INVALID_TOKEN': 'Invalid or expired token'
'SESSION_EXPIRED': 'Session has expired'
'ACCOUNT_LOCKED': 'Account locked due to failed login attempts'

// Authorization Errors
'FORBIDDEN': 'Insufficient permissions'
'NOT_SHOP_OWNER': 'User is not a shop owner'
'SHOP_ACCESS_DENIED': 'Access to this shop is denied'

// Validation Errors
'VALIDATION_ERROR': 'Input validation failed'
'INVALID_STATUS': 'Invalid status value'
'INVALID_DATE_RANGE': 'Invalid date range'

// Resource Errors
'NOT_FOUND': 'Resource not found'
'SHOP_NOT_FOUND': 'Shop not found'
'RESERVATION_NOT_FOUND': 'Reservation not found'
'SERVICE_NOT_FOUND': 'Service not found'

// Business Logic Errors
'INVALID_RESERVATION_STATUS': 'Cannot perform action on reservation in current status'
'DEPOSIT_NOT_PAID': 'Deposit payment required'
'NO_ACTIVE_SHOPS': 'No active shops found for user'

// Rate Limiting
'RATE_LIMIT_EXCEEDED': 'Too many requests, please try again later'
```

### Error Handling Example

```typescript
async function handleApiCall(apiFunction: () => Promise<any>) {
  try {
    const response = await apiFunction();
    return response.data;
  } catch (error: any) {
    if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // Try to refresh token
          await refreshAuthToken();
          return await apiFunction(); // Retry

        case 403:
          showError('접근 권한이 없습니다.');
          break;

        case 404:
          showError('요청한 데이터를 찾을 수 없습니다.');
          break;

        case 429:
          showError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
          break;

        default:
          showError(data.error?.message || '오류가 발생했습니다.');
      }
    } else {
      showError('네트워크 오류가 발생했습니다.');
    }

    throw error;
  }
}
```

---

## Implementation Best Practices

### 1. Token Management

```typescript
// Store tokens securely
class AuthService {
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiryTime: number | null = null;

  async login(email: string, password: string) {
    const response = await fetch('/api/shop-owner/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const { data } = await response.json();
    this.accessToken = data.token;
    this.refreshToken = data.refreshToken;
    this.tokenExpiryTime = new Date(data.expiresAt).getTime();

    // Store in localStorage
    localStorage.setItem('accessToken', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  async getValidToken(): Promise<string> {
    // Check if token is about to expire (within 5 minutes)
    if (this.tokenExpiryTime && Date.now() >= this.tokenExpiryTime - 5 * 60 * 1000) {
      await this.refreshToken();
    }

    return this.accessToken!;
  }

  async refreshToken() {
    const response = await fetch('/api/shop-owner/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken })
    });

    if (!response.ok) {
      // Refresh failed, redirect to login
      this.logout();
      window.location.href = '/shop-admin/login';
      return;
    }

    const { data } = await response.json();
    this.accessToken = data.token;
    this.refreshToken = data.refreshToken;
    this.tokenExpiryTime = new Date(data.expiresAt).getTime();

    localStorage.setItem('accessToken', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
  }

  logout() {
    this.accessToken = null;
    this.refreshToken = null;
    this.tokenExpiryTime = null;
    localStorage.clear();
  }
}
```

---

### 2. API Client Setup

```typescript
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Create axios instance
const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor - Handle errors and token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If 401 and haven't retried yet
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        const response = await axios.post(`${API_BASE_URL}/api/shop-owner/auth/refresh`, {
          refreshToken
        });

        const { data } = response.data;
        localStorage.setItem('accessToken', data.token);
        localStorage.setItem('refreshToken', data.refreshToken);

        // Retry original request with new token
        originalRequest.headers.Authorization = `Bearer ${data.token}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        localStorage.clear();
        window.location.href = '/shop-admin/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;
```

---

### 3. React Hooks for API Calls

```typescript
import { useState, useEffect } from 'react';
import apiClient from './apiClient';

// Custom hook for fetching data
export function useApiData<T>(endpoint: string, dependencies: any[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.get(endpoint);

        if (!cancelled) {
          setData(response.data.data);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.response?.data?.error?.message || 'An error occurred');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    fetchData();

    return () => {
      cancelled = true;
    };
  }, dependencies);

  return { data, loading, error };
}

// Usage example
function DashboardPage() {
  const { data: dashboardData, loading, error } = useApiData('/api/shop-owner/dashboard');

  if (loading) return <Loader />;
  if (error) return <Error message={error} />;

  return (
    <div>
      <h1>Dashboard</h1>
      <p>Today's reservations: {dashboardData?.reservations.today}</p>
      <p>Monthly revenue: {dashboardData?.revenue.thisMonth} KRW</p>
    </div>
  );
}
```

---

### 4. Reservation Status Management

```typescript
import apiClient from './apiClient';

class ReservationService {
  async confirmReservation(reservationId: string, notes?: string) {
    try {
      const response = await apiClient.put(
        `/api/shop-owner/reservations/${reservationId}/confirm`,
        { notes }
      );

      // Show success message
      showSuccessToast('예약이 확정되었습니다.');

      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || '예약 확정에 실패했습니다.';
      showErrorToast(message);
      throw error;
    }
  }

  async rejectReservation(reservationId: string, notes?: string) {
    try {
      const response = await apiClient.put(
        `/api/shop-owner/reservations/${reservationId}/reject`,
        { notes }
      );

      showSuccessToast('예약이 거절되었습니다.');

      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || '예약 거절에 실패했습니다.';
      showErrorToast(message);
      throw error;
    }
  }

  async completeService(
    reservationId: string,
    finalAmount?: number,
    completionNotes?: string
  ) {
    try {
      const response = await apiClient.put(
        `/api/shop-owner/reservations/${reservationId}/complete`,
        { finalAmount, completionNotes }
      );

      showSuccessToast('서비스가 완료 처리되었습니다.');

      return response.data.data;
    } catch (error: any) {
      const message = error.response?.data?.error?.message || '서비스 완료 처리에 실패했습니다.';
      showErrorToast(message);
      throw error;
    }
  }
}

export const reservationService = new ReservationService();
```

---

### 5. Real-time Data Updates

```typescript
// Poll for updates every 30 seconds
function useRealtimeReservations(shopId: string) {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchReservations() {
      try {
        const response = await apiClient.get(`/api/shop-owner/reservations/pending`);
        setReservations(response.data.data.reservations);
        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch reservations:', error);
      }
    }

    // Initial fetch
    fetchReservations();

    // Poll every 30 seconds
    const interval = setInterval(fetchReservations, 30000);

    return () => clearInterval(interval);
  }, [shopId]);

  return { reservations, loading };
}
```

---

### 6. Date & Time Formatting

```typescript
import { format, parseISO, formatDistance } from 'date-fns';
import { ko } from 'date-fns/locale';

export function formatReservationDate(dateString: string): string {
  return format(parseISO(dateString), 'yyyy년 MM월 dd일 (EEE)', { locale: ko });
}

export function formatReservationTime(timeString: string): string {
  return timeString; // Already in HH:MM format
}

export function formatTimestamp(isoString: string): string {
  return format(parseISO(isoString), 'yyyy-MM-dd HH:mm', { locale: ko });
}

export function formatRelativeTime(isoString: string): string {
  return formatDistance(parseISO(isoString), new Date(), {
    addSuffix: true,
    locale: ko
  });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
}

// Usage
const reservationDate = formatReservationDate('2024-01-15');  // "2024년 01월 15일 (월)"
const relativeTime = formatRelativeTime('2024-01-15T10:30:00Z');  // "2시간 전"
const price = formatCurrency(50000);  // "₩50,000"
```

---

## Testing Recommendations

### 1. Unit Tests

Test individual API service functions:

```typescript
import { reservationService } from './reservationService';
import apiClient from './apiClient';

jest.mock('./apiClient');

describe('ReservationService', () => {
  it('should confirm reservation successfully', async () => {
    const mockResponse = {
      data: {
        success: true,
        data: {
          reservation: {
            id: 'test-id',
            status: 'confirmed'
          }
        }
      }
    };

    (apiClient.put as jest.Mock).mockResolvedValue(mockResponse);

    const result = await reservationService.confirmReservation('test-id', 'Test notes');

    expect(apiClient.put).toHaveBeenCalledWith(
      '/api/shop-owner/reservations/test-id/confirm',
      { notes: 'Test notes' }
    );
    expect(result.reservation.status).toBe('confirmed');
  });
});
```

---

### 2. Integration Tests

Test API endpoints with actual HTTP requests:

```typescript
import axios from 'axios';

const API_URL = 'http://localhost:3001';
let authToken: string;

beforeAll(async () => {
  // Login and get auth token
  const response = await axios.post(`${API_URL}/api/shop-owner/auth/login`, {
    email: 'test@example.com',
    password: 'testpassword'
  });
  authToken = response.data.data.token;
});

describe('Shop Owner Dashboard API', () => {
  it('should get dashboard data', async () => {
    const response = await axios.get(`${API_URL}/api/shop-owner/dashboard`, {
      headers: { Authorization: `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    expect(response.data.success).toBe(true);
    expect(response.data.data).toHaveProperty('reservations');
    expect(response.data.data).toHaveProperty('revenue');
  });
});
```

---

## Conclusion

This comprehensive guide provides all the information needed to implement the Shop Admin functionality for the Ebeautything platform. Key points:

1. **Authentication**: Use JWT-based authentication with automatic token refresh
2. **Authorization**: Shop owners can only access their own data; admins can access all
3. **Error Handling**: Follow standardized error response format
4. **Data Validation**: All endpoints validate input and return meaningful errors
5. **Real-time Updates**: Implement polling or WebSocket for real-time data
6. **Security**: Use HTTPS, secure token storage, and validate all user inputs

For questions or issues, please contact the backend development team or refer to the API documentation at:
- **Swagger UI**: http://localhost:3001/api-docs
- **GitHub**: https://github.com/ebeautything/backend

---

**Document Version**: 3.1
**Last Updated**: 2025-07-23
**Maintained by**: Backend Development Team
