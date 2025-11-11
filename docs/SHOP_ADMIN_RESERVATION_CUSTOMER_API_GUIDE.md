# Shop Admin API Guide: Reservations & Customer Management

**Version:** 1.0
**Last Updated:** 2025-01-11
**Target Audience:** Frontend Developers

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
3. [Reservation Management](#reservation-management)
   - [Get Shop Reservations](#1-get-shop-reservations)
   - [Update Reservation Status](#2-update-reservation-status)
   - [Get Reservation Detail](#3-get-reservation-detail)
4. [Customer Management](#customer-management)
   - [Get All Customers](#1-get-all-customers)
   - [Get Customer Statistics](#2-get-customer-statistics)
   - [Search Customers](#3-search-customers)
5. [Frontend Implementation Examples](#frontend-implementation-examples)
6. [Error Handling](#error-handling)
7. [Rate Limits](#rate-limits)
8. [Best Practices](#best-practices)

---

## Overview

This document provides complete API documentation for shop admins to manage reservations and access customer information. All endpoints are shop-scoped and require proper authentication and authorization.

**Base URL:** `https://api.yourapp.com` (replace with your actual API base URL)

**Access Control:**
- ✅ Shop Owners: Can access their own shop's data
- ✅ Platform Admins: Can access any shop's data
- ❌ Regular Users: Cannot access shop admin endpoints

---

## Authentication

All endpoints require JWT authentication with `shopId` claim embedded in the token.

### Request Headers

```http
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

### JWT Token Structure

```json
{
  "userId": "user-uuid",
  "role": "shop_owner",
  "shopId": "shop-uuid",
  "iat": 1641024000,
  "exp": 1641110400
}
```

**Important:** The JWT token must include the `shopId` claim. This was added in commit `a785805`.

---

## Reservation Management

### 1. Get Shop Reservations

Retrieve all reservations for a specific shop with filtering and pagination.

#### Endpoint

```http
GET /api/shops/:shopId/reservations
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | UUID | Yes | Shop ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by status: `requested`, `confirmed`, `completed`, `cancelled_by_user`, `cancelled_by_shop`, `no_show` |
| `startDate` | string | No | - | Filter from date (YYYY-MM-DD) |
| `endDate` | string | No | - | Filter to date (YYYY-MM-DD) |
| `userId` | UUID | No | - | Filter by specific customer |
| `page` | integer | No | 1 | Page number (min: 1) |
| `limit` | integer | No | 20 | Items per page (min: 1, max: 100) |
| `sortBy` | string | No | `reservation_date` | Sort field: `reservation_date`, `created_at`, `updated_at`, `status` |
| `sortOrder` | string | No | `desc` | Sort order: `asc`, `desc` |

#### Request Example

```bash
curl -X GET "https://api.yourapp.com/api/shops/abc-123/reservations?status=requested&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation-uuid",
        "shop_id": "shop-uuid",
        "user_id": "user-uuid",
        "status": "requested",
        "reservation_date": "2025-01-15",
        "reservation_time": "14:00",
        "total_amount": 50000,
        "special_requests": "창가 자리 부탁드립니다",
        "cancellation_reason": null,
        "shop_notes": null,
        "created_at": "2025-01-10T10:00:00Z",
        "updated_at": "2025-01-10T10:00:00Z",
        "cancelled_at": null,
        "cancelled_by": null,
        "completed_at": null,
        "users": {
          "id": "user-uuid",
          "name": "홍길동",
          "email": "hong@example.com",
          "phone_number": "010-1234-5678"
        },
        "shops": {
          "id": "shop-uuid",
          "name": "뷰티샵"
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

#### Frontend Implementation

```typescript
interface Reservation {
  id: string;
  shop_id: string;
  user_id: string;
  status: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
  reservation_date: string;
  reservation_time: string;
  total_amount: number;
  special_requests?: string;
  cancellation_reason?: string;
  shop_notes?: string;
  created_at: string;
  updated_at: string;
  users: {
    id: string;
    name: string;
    email: string;
    phone_number: string;
  };
  shops: {
    id: string;
    name: string;
  };
}

const fetchReservations = async (
  shopId: string,
  filters: {
    status?: string;
    startDate?: string;
    endDate?: string;
    userId?: string;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
  } = {}
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(
    `${API_BASE_URL}/api/shops/${shopId}/reservations?${params}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch reservations: ${response.status}`);
  }

  return response.json();
};
```

---

### 2. Update Reservation Status

Confirm, reject, complete, or mark reservation as no-show.

#### Endpoint

```http
PATCH /api/shops/:shopId/reservations/:reservationId
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | UUID | Yes | Shop ID |
| `reservationId` | UUID | Yes | Reservation ID |

#### Request Body

```json
{
  "status": "confirmed",
  "reason": "예약 가능한 시간이 없습니다.",
  "notes": "추가 메모"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `status` | string | Yes | New status: `confirmed`, `completed`, `cancelled_by_shop`, `no_show` |
| `reason` | string | Conditional | Cancellation reason (REQUIRED if status is `cancelled_by_shop`, max 500 chars) |
| `notes` | string | No | Additional shop notes (max 1000 chars) |

#### Valid Status Transitions

```
requested → confirmed ✅
requested → cancelled_by_shop ✅

confirmed → completed ✅
confirmed → cancelled_by_shop ✅
confirmed → no_show ✅

completed → (no transitions) ❌
cancelled_by_user → (no transitions) ❌
cancelled_by_shop → (no transitions) ❌
no_show → (no transitions) ❌
```

#### Request Examples

**1. Confirm Reservation**

```bash
curl -X PATCH "https://api.yourapp.com/api/shops/abc-123/reservations/res-456" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "confirmed",
    "notes": "예약이 확정되었습니다."
  }'
```

**2. Reject/Cancel Reservation**

```bash
curl -X PATCH "https://api.yourapp.com/api/shops/abc-123/reservations/res-456" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "cancelled_by_shop",
    "reason": "예약 가능한 시간이 없습니다.",
    "notes": "다른 시간대를 제안드립니다."
  }'
```

**3. Complete Reservation**

```bash
curl -X PATCH "https://api.yourapp.com/api/shops/abc-123/reservations/res-456" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "completed",
    "notes": "서비스가 성공적으로 완료되었습니다."
  }'
```

**4. Mark as No-Show**

```bash
curl -X PATCH "https://api.yourapp.com/api/shops/abc-123/reservations/res-456" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json" \
  -d '{
    "status": "no_show",
    "notes": "고객이 나타나지 않았습니다."
  }'
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "reservationId": "res-456",
    "status": "confirmed",
    "updatedAt": "2025-01-11T10:30:00Z",
    "previousStatus": "requested"
  }
}
```

#### Error Responses

**400 - Invalid Status Transition**

```json
{
  "success": false,
  "error": {
    "code": "INVALID_STATUS_TRANSITION",
    "message": "requested 상태에서 completed(으)로 변경할 수 없습니다.",
    "details": "현재 상태: requested, 허용된 전환: confirmed, cancelled_by_shop"
  }
}
```

**400 - Missing Cancellation Reason**

```json
{
  "success": false,
  "error": {
    "code": "MISSING_REASON",
    "message": "취소 사유는 필수입니다.",
    "details": "취소 시 reason 필드를 제공해주세요."
  }
}
```

**404 - Reservation Not Found**

```json
{
  "success": false,
  "error": {
    "code": "RESERVATION_NOT_FOUND",
    "message": "예약을 찾을 수 없거나 접근 권한이 없습니다."
  }
}
```

#### Frontend Implementation

```typescript
type ReservationStatus = 'confirmed' | 'completed' | 'cancelled_by_shop' | 'no_show';

interface UpdateStatusRequest {
  status: ReservationStatus;
  reason?: string;
  notes?: string;
}

const updateReservationStatus = async (
  shopId: string,
  reservationId: string,
  data: UpdateStatusRequest
): Promise<void> => {
  const response = await fetch(
    `${API_BASE_URL}/api/shops/${shopId}/reservations/${reservationId}`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || 'Failed to update reservation');
  }

  return response.json();
};

// Confirm reservation
const handleConfirm = async (shopId: string, reservationId: string) => {
  const confirmed = await showConfirmDialog({
    title: '예약 확정',
    message: '이 예약을 확정하시겠습니까?'
  });

  if (!confirmed) return;

  try {
    await updateReservationStatus(shopId, reservationId, {
      status: 'confirmed',
      notes: '예약이 확정되었습니다.'
    });

    toast.success('예약이 확정되었습니다.');
    await refreshReservations();
  } catch (error) {
    toast.error(error.message);
  }
};

// Reject reservation
const handleReject = async (shopId: string, reservationId: string) => {
  const result = await showRejectDialog({
    title: '예약 거절',
    message: '거절 사유를 입력해주세요.',
    reasonRequired: true
  });

  if (!result.confirmed) return;

  try {
    await updateReservationStatus(shopId, reservationId, {
      status: 'cancelled_by_shop',
      reason: result.reason, // Required
      notes: result.notes
    });

    toast.success('예약이 거절되었습니다.');
    await refreshReservations();
  } catch (error) {
    toast.error(error.message);
  }
};

// Complete reservation
const handleComplete = async (shopId: string, reservationId: string) => {
  try {
    await updateReservationStatus(shopId, reservationId, {
      status: 'completed',
      notes: '서비스가 완료되었습니다.'
    });

    toast.success('예약이 완료 처리되었습니다.');
    await refreshReservations();
  } catch (error) {
    toast.error(error.message);
  }
};

// Mark as no-show
const handleNoShow = async (shopId: string, reservationId: string) => {
  const confirmed = await showConfirmDialog({
    title: 'No-Show 처리',
    message: '이 예약을 노쇼로 처리하시겠습니까?'
  });

  if (!confirmed) return;

  try {
    await updateReservationStatus(shopId, reservationId, {
      status: 'no_show',
      notes: '고객이 나타나지 않았습니다.'
    });

    toast.success('No-Show로 처리되었습니다.');
    await refreshReservations();
  } catch (error) {
    toast.error(error.message);
  }
};
```

---

### 3. Get Reservation Detail

Get detailed information about a specific reservation (user-facing endpoint, but useful for shop admins too).

#### Endpoint

```http
GET /api/reservations/:id
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `id` | UUID | Yes | Reservation ID |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "shop_id": "shop-uuid",
      "user_id": "user-uuid",
      "status": "confirmed",
      "reservation_date": "2025-01-15",
      "reservation_time": "14:00",
      "total_amount": 50000,
      "special_requests": "창가 자리 부탁드립니다",
      "created_at": "2025-01-10T10:00:00Z",
      "updated_at": "2025-01-10T10:00:00Z"
    }
  }
}
```

#### Frontend Implementation

```typescript
const fetchReservationDetail = async (reservationId: string) => {
  const response = await fetch(
    `${API_BASE_URL}/api/reservations/${reservationId}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch reservation detail');
  }

  return response.json();
};

// Usage: Navigate to detail page
const handleViewReservation = async (reservationId: string) => {
  try {
    const data = await fetchReservationDetail(reservationId);
    router.push(`/dashboard/my-shop/reservations/${reservationId}`, {
      state: { reservation: data.data.reservation }
    });
  } catch (error) {
    toast.error('예약 정보를 불러오는데 실패했습니다.');
  }
};
```

---

## Customer Management

### 1. Get All Customers

Retrieve all customers who have made reservations at your shop with aggregated statistics.

#### Endpoint

```http
GET /api/shops/:shopId/users
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | UUID | Yes | Shop ID |

#### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `status` | string | No | - | Filter by reservation status |
| `search` | string | No | - | Search by name, email, or phone number |
| `sortBy` | string | No | `total_reservations` | Sort field: `total_reservations`, `total_spent`, `last_reservation_date`, `name` |
| `sortOrder` | string | No | `desc` | Sort order: `asc`, `desc` |
| `page` | integer | No | 1 | Page number (min: 1) |
| `limit` | integer | No | 20 | Items per page (min: 1, max: 100) |

#### Request Example

```bash
curl -X GET "https://api.yourapp.com/api/shops/abc-123/users?sortBy=total_spent&sortOrder=desc&page=1&limit=20" \
  -H "Authorization: Bearer eyJhbGc..." \
  -H "Content-Type: application/json"
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "customers": [
      {
        "id": "user-uuid",
        "email": "customer@example.com",
        "name": "홍길동",
        "phone_number": "010-1234-5678",
        "profile_image_url": "https://example.com/profile.jpg",
        "total_reservations": 15,
        "total_spent": 450000,
        "last_reservation_date": "2025-01-10T14:30:00Z",
        "reservation_statuses": {
          "confirmed": 8,
          "completed": 5,
          "cancelled_by_user": 2
        }
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    }
  }
}
```

#### Frontend Implementation

```typescript
interface Customer {
  id: string;
  email: string;
  name: string;
  phone_number: string | null;
  profile_image_url: string | null;
  total_reservations: number;
  total_spent: number;
  last_reservation_date: string;
  reservation_statuses: Record<string, number>;
}

const fetchCustomers = async (
  shopId: string,
  filters: {
    status?: string;
    search?: string;
    sortBy?: 'total_reservations' | 'total_spent' | 'last_reservation_date' | 'name';
    sortOrder?: 'asc' | 'desc';
    page?: number;
    limit?: number;
  } = {}
) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined) {
      params.append(key, value.toString());
    }
  });

  const response = await fetch(
    `${API_BASE_URL}/api/shops/${shopId}/users?${params}`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  if (!response.ok) {
    throw new Error('Failed to fetch customers');
  }

  return response.json();
};

// Usage: Customer list component
const CustomerList = ({ shopId }: { shopId: string }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'total_reservations' | 'total_spent'>('total_reservations');

  useEffect(() => {
    fetchCustomers(shopId, { search, sortBy, sortOrder: 'desc' })
      .then(data => setCustomers(data.data.customers))
      .catch(error => toast.error('고객 목록을 불러오는데 실패했습니다.'));
  }, [shopId, search, sortBy]);

  return (
    <div>
      <input
        type="text"
        placeholder="고객 검색 (이름, 이메일, 전화번호)"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <select value={sortBy} onChange={(e) => setSortBy(e.target.value as any)}>
        <option value="total_reservations">예약 횟수</option>
        <option value="total_spent">총 결제금액</option>
        <option value="last_reservation_date">최근 예약일</option>
        <option value="name">이름</option>
      </select>

      <table>
        <thead>
          <tr>
            <th>고객명</th>
            <th>연락처</th>
            <th>총 예약</th>
            <th>총 결제금액</th>
            <th>최근 예약</th>
          </tr>
        </thead>
        <tbody>
          {customers.map(customer => (
            <tr key={customer.id}>
              <td>
                <div>
                  {customer.profile_image_url && (
                    <img src={customer.profile_image_url} alt={customer.name} />
                  )}
                  <div>
                    <div>{customer.name}</div>
                    <div>{customer.email}</div>
                  </div>
                </div>
              </td>
              <td>{customer.phone_number || '-'}</td>
              <td>{customer.total_reservations}회</td>
              <td>{customer.total_spent.toLocaleString()}원</td>
              <td>{new Date(customer.last_reservation_date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
```

---

### 2. Get Customer Statistics

Get overview statistics of customer reservations including status distribution.

#### Endpoint

```http
GET /api/shops/:shopId/users/roles
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | UUID | Yes | Shop ID |

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "statuses": [
      {
        "status": "confirmed",
        "count": 45
      },
      {
        "status": "completed",
        "count": 120
      },
      {
        "status": "cancelled_by_user",
        "count": 12
      },
      {
        "status": "requested",
        "count": 8
      }
    ],
    "totalReservations": 185,
    "uniqueCustomers": 78
  }
}
```

#### Frontend Implementation

```typescript
interface CustomerStats {
  statuses: Array<{ status: string; count: number }>;
  totalReservations: number;
  uniqueCustomers: number;
}

const fetchCustomerStats = async (shopId: string): Promise<CustomerStats> => {
  const response = await fetch(
    `${API_BASE_URL}/api/shops/${shopId}/users/roles`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    }
  );

  const data = await response.json();
  return data.data;
};

// Usage: Dashboard widget
const CustomerStatsWidget = ({ shopId }: { shopId: string }) => {
  const [stats, setStats] = useState<CustomerStats | null>(null);

  useEffect(() => {
    fetchCustomerStats(shopId).then(setStats);
  }, [shopId]);

  if (!stats) return <div>Loading...</div>;

  return (
    <div className="stats-widget">
      <h3>고객 통계</h3>
      <div className="stat-cards">
        <div className="stat-card">
          <label>총 예약</label>
          <strong>{stats.totalReservations}건</strong>
        </div>
        <div className="stat-card">
          <label>총 고객</label>
          <strong>{stats.uniqueCustomers}명</strong>
        </div>
      </div>

      <div className="status-breakdown">
        <h4>예약 상태별 분포</h4>
        {stats.statuses.map(({ status, count }) => (
          <div key={status} className="status-bar">
            <span>{getStatusLabel(status)}</span>
            <span>{count}건</span>
            <div className="progress">
              <div style={{ width: `${(count / stats.totalReservations) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
```

---

### 3. Search Customers

Search customers in real-time by name, email, or phone number using the main customer list endpoint.

#### Frontend Implementation

```typescript
const CustomerSearch = ({ shopId }: { shopId: string }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await fetchCustomers(shopId, {
          search: query,
          limit: 10
        });
        setResults(data.data.customers);
      } catch (error) {
        console.error('Search failed:', error);
      } finally {
        setLoading(false);
      }
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [query, shopId]);

  return (
    <div className="customer-search">
      <input
        type="text"
        placeholder="고객 검색 (이름, 이메일, 전화번호)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      {loading && <div className="loading">검색 중...</div>}

      {results.length > 0 && (
        <div className="search-results">
          {results.map(customer => (
            <div
              key={customer.id}
              className="result-item"
              onClick={() => handleSelectCustomer(customer)}
            >
              <img src={customer.profile_image_url} alt={customer.name} />
              <div className="info">
                <div className="name">{customer.name}</div>
                <div className="email">{customer.email}</div>
                <div className="phone">{customer.phone_number}</div>
              </div>
              <div className="stats">
                <span>{customer.total_reservations}회 방문</span>
                <span>{customer.total_spent.toLocaleString()}원</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {query && !loading && results.length === 0 && (
        <div className="no-results">검색 결과가 없습니다.</div>
      )}
    </div>
  );
};
```

---

## Frontend Implementation Examples

### Complete Reservation Management Component

```typescript
import React, { useState, useEffect } from 'react';

interface ReservationManagerProps {
  shopId: string;
}

const ReservationManager: React.FC<ReservationManagerProps> = ({ shopId }) => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const loadReservations = async () => {
    setLoading(true);
    try {
      const filters: any = { page, limit: 20 };
      if (filter !== 'all') {
        filters.status = filter;
      }

      const data = await fetchReservations(shopId, filters);
      setReservations(data.data.reservations);
      setTotalPages(data.data.pagination.totalPages);
    } catch (error) {
      toast.error('예약 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReservations();
  }, [shopId, filter, page]);

  const handleConfirm = async (reservationId: string) => {
    try {
      await updateReservationStatus(shopId, reservationId, {
        status: 'confirmed',
        notes: '예약이 확정되었습니다.'
      });
      toast.success('예약이 확정되었습니다.');
      await loadReservations();
    } catch (error) {
      toast.error('예약 확정에 실패했습니다.');
    }
  };

  const handleReject = async (reservationId: string) => {
    const reason = prompt('거절 사유를 입력해주세요:');
    if (!reason) return;

    try {
      await updateReservationStatus(shopId, reservationId, {
        status: 'cancelled_by_shop',
        reason
      });
      toast.success('예약이 거절되었습니다.');
      await loadReservations();
    } catch (error) {
      toast.error('예약 거절에 실패했습니다.');
    }
  };

  const handleView = (reservationId: string) => {
    window.location.href = `/dashboard/my-shop/reservations/${reservationId}`;
  };

  return (
    <div className="reservation-manager">
      <div className="filters">
        <button onClick={() => setFilter('all')}>전체</button>
        <button onClick={() => setFilter('requested')}>요청됨</button>
        <button onClick={() => setFilter('confirmed')}>확정됨</button>
        <button onClick={() => setFilter('completed')}>완료됨</button>
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>고객명</th>
              <th>예약일시</th>
              <th>상태</th>
              <th>금액</th>
              <th>특별 요청</th>
              <th>액션</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(reservation => (
              <tr key={reservation.id}>
                <td>
                  <div>{reservation.users.name}</div>
                  <small>{reservation.users.phone_number}</small>
                </td>
                <td>
                  {reservation.reservation_date} {reservation.reservation_time}
                </td>
                <td>
                  <StatusBadge status={reservation.status} />
                </td>
                <td>{reservation.total_amount.toLocaleString()}원</td>
                <td>{reservation.special_requests || '-'}</td>
                <td>
                  <button onClick={() => handleView(reservation.id)}>
                    👁️ 보기
                  </button>
                  {reservation.status === 'requested' && (
                    <>
                      <button onClick={() => handleConfirm(reservation.id)}>
                        ✅ 확정
                      </button>
                      <button onClick={() => handleReject(reservation.id)}>
                        ❌ 거절
                      </button>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <div className="pagination">
        <button
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        >
          이전
        </button>
        <span>{page} / {totalPages}</span>
        <button
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        >
          다음
        </button>
      </div>
    </div>
  );
};
```

### Customer Detail View Component

```typescript
const CustomerDetailView: React.FC<{ shopId: string; customerId: string }> = ({
  shopId,
  customerId
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [reservations, setReservations] = useState<Reservation[]>([]);

  useEffect(() => {
    // Fetch customer info
    fetchCustomers(shopId, { search: customerId, limit: 1 })
      .then(data => setCustomer(data.data.customers[0]));

    // Fetch customer's reservations
    fetchReservations(shopId, { userId: customerId })
      .then(data => setReservations(data.data.reservations));
  }, [shopId, customerId]);

  if (!customer) return <div>Loading...</div>;

  return (
    <div className="customer-detail">
      <div className="customer-header">
        <img src={customer.profile_image_url} alt={customer.name} />
        <div>
          <h2>{customer.name}</h2>
          <p>{customer.email}</p>
          <p>{customer.phone_number}</p>
        </div>
      </div>

      <div className="customer-stats">
        <div className="stat">
          <label>총 예약</label>
          <strong>{customer.total_reservations}회</strong>
        </div>
        <div className="stat">
          <label>총 결제금액</label>
          <strong>{customer.total_spent.toLocaleString()}원</strong>
        </div>
        <div className="stat">
          <label>최근 방문</label>
          <strong>
            {new Date(customer.last_reservation_date).toLocaleDateString()}
          </strong>
        </div>
      </div>

      <div className="reservation-history">
        <h3>예약 내역</h3>
        <table>
          <thead>
            <tr>
              <th>예약일</th>
              <th>시간</th>
              <th>상태</th>
              <th>금액</th>
            </tr>
          </thead>
          <tbody>
            {reservations.map(reservation => (
              <tr key={reservation.id}>
                <td>{reservation.reservation_date}</td>
                <td>{reservation.reservation_time}</td>
                <td><StatusBadge status={reservation.status} /></td>
                <td>{reservation.total_amount.toLocaleString()}원</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## Error Handling

### Common Error Codes

| Code | HTTP Status | Description | Solution |
|------|-------------|-------------|----------|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT token | Redirect to login |
| `FORBIDDEN` | 403 | No access to this shop | Check user role and shopId |
| `RESERVATION_NOT_FOUND` | 404 | Reservation doesn't exist | Refresh list and verify ID |
| `INVALID_STATUS_TRANSITION` | 400 | Cannot change to requested status | Check valid transitions |
| `MISSING_REASON` | 400 | Cancellation reason required | Prompt user for reason |
| `MISSING_PARAMETERS` | 400 | Required parameters missing | Validate request data |
| `DATABASE_ERROR` | 500 | Database operation failed | Retry or contact support |
| `INTERNAL_SERVER_ERROR` | 500 | Unexpected server error | Retry or contact support |

### Error Handling Pattern

```typescript
const handleApiError = (error: any) => {
  if (error.status === 401) {
    // Redirect to login
    router.push('/login');
    return;
  }

  if (error.status === 403) {
    toast.error('이 샵의 데이터에 접근할 권한이 없습니다.');
    return;
  }

  if (error.status === 404) {
    toast.error('요청한 데이터를 찾을 수 없습니다.');
    return;
  }

  if (error.status === 429) {
    toast.error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
    return;
  }

  // Generic error
  const message = error.error?.message || '오류가 발생했습니다.';
  toast.error(message);
};

// Usage
try {
  await updateReservationStatus(shopId, reservationId, data);
} catch (error) {
  handleApiError(error);
}
```

---

## Rate Limits

All endpoints are rate-limited to prevent abuse.

| Endpoint | Rate Limit | Window |
|----------|------------|--------|
| `GET /api/shops/:shopId/reservations` | 100 requests | 15 minutes |
| `PATCH /api/shops/:shopId/reservations/:id` | 50 requests | 15 minutes |
| `GET /api/shops/:shopId/users` | 100 requests | 15 minutes |
| `GET /api/shops/:shopId/users/roles` | 100 requests | 15 minutes |
| `GET /api/reservations/:id` | 100 requests | 15 minutes |

When rate limit is exceeded, the API returns:

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
    "retryAfter": 300
  }
}
```

**HTTP Status:** 429 Too Many Requests

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1641024600
Retry-After: 300
```

---

## Best Practices

### 1. Authentication

```typescript
// Store token securely
const token = localStorage.getItem('auth_token');

// Always include Authorization header
const headers = {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
};

// Handle token expiration
if (response.status === 401) {
  // Clear token and redirect to login
  localStorage.removeItem('auth_token');
  window.location.href = '/login';
}
```

### 2. Data Caching

```typescript
// Use React Query or SWR for caching
import { useQuery } from 'react-query';

const useReservations = (shopId: string, filters: any) => {
  return useQuery(
    ['reservations', shopId, filters],
    () => fetchReservations(shopId, filters),
    {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000 // 10 minutes
    }
  );
};
```

### 3. Optimistic Updates

```typescript
const handleConfirm = async (reservationId: string) => {
  // Optimistically update UI
  setReservations(prev =>
    prev.map(res =>
      res.id === reservationId
        ? { ...res, status: 'confirmed' }
        : res
    )
  );

  try {
    await updateReservationStatus(shopId, reservationId, {
      status: 'confirmed'
    });
    toast.success('예약이 확정되었습니다.');
  } catch (error) {
    // Revert on error
    await loadReservations();
    toast.error('예약 확정에 실패했습니다.');
  }
};
```

### 4. Pagination

```typescript
// Track pagination state
const [page, setPage] = useState(1);
const [hasMore, setHasMore] = useState(true);

// Load more pattern
const loadMore = async () => {
  const data = await fetchReservations(shopId, { page: page + 1 });
  setReservations(prev => [...prev, ...data.data.reservations]);
  setPage(page + 1);
  setHasMore(data.data.pagination.hasMore);
};

// Infinite scroll
useEffect(() => {
  const handleScroll = () => {
    if (
      window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 &&
      hasMore &&
      !loading
    ) {
      loadMore();
    }
  };

  window.addEventListener('scroll', handleScroll);
  return () => window.removeEventListener('scroll', handleScroll);
}, [hasMore, loading]);
```

### 5. Real-time Updates

```typescript
// WebSocket connection for real-time reservation updates
const socket = io(WS_URL, {
  auth: { token }
});

socket.on('reservation.updated', (data) => {
  // Update local state
  setReservations(prev =>
    prev.map(res =>
      res.id === data.reservationId
        ? { ...res, status: data.status }
        : res
    )
  );

  toast.info(`예약 상태가 업데이트되었습니다: ${data.status}`);
});

// Clean up on unmount
useEffect(() => {
  return () => {
    socket.disconnect();
  };
}, []);
```

### 6. Loading States

```typescript
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);

const loadData = async () => {
  setLoading(true);
  setError(null);

  try {
    const data = await fetchReservations(shopId);
    setReservations(data.data.reservations);
  } catch (err) {
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

// UI rendering
if (loading) return <LoadingSpinner />;
if (error) return <ErrorMessage message={error} />;
return <ReservationList reservations={reservations} />;
```

### 7. Input Validation

```typescript
// Validate before sending request
const validateRejectReason = (reason: string): boolean => {
  if (!reason || reason.trim().length === 0) {
    toast.error('거절 사유를 입력해주세요.');
    return false;
  }

  if (reason.length > 500) {
    toast.error('거절 사유는 최대 500자까지 입력 가능합니다.');
    return false;
  }

  return true;
};

const handleReject = async (reservationId: string, reason: string) => {
  if (!validateRejectReason(reason)) return;

  // Proceed with API call
  await updateReservationStatus(shopId, reservationId, {
    status: 'cancelled_by_shop',
    reason
  });
};
```

### 8. Privacy & Security

```typescript
// Mask sensitive customer data in logs
const maskPhoneNumber = (phone: string) => {
  return phone.replace(/(\d{3})-(\d{4})-(\d{4})/, '$1-****-$3');
};

const maskEmail = (email: string) => {
  const [name, domain] = email.split('@');
  return `${name.slice(0, 2)}***@${domain}`;
};

// Use when logging
console.log('Customer:', {
  id: customer.id,
  name: customer.name,
  email: maskEmail(customer.email),
  phone: maskPhoneNumber(customer.phone_number)
});
```

---

## Appendix

### Status Badge Component

```typescript
const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const getStatusColor = () => {
    switch (status) {
      case 'requested': return 'yellow';
      case 'confirmed': return 'blue';
      case 'completed': return 'green';
      case 'cancelled_by_user':
      case 'cancelled_by_shop': return 'red';
      case 'no_show': return 'gray';
      default: return 'gray';
    }
  };

  const getStatusLabel = () => {
    switch (status) {
      case 'requested': return '요청됨';
      case 'confirmed': return '확정됨';
      case 'completed': return '완료됨';
      case 'cancelled_by_user': return '고객 취소';
      case 'cancelled_by_shop': return '샵 취소';
      case 'no_show': return '노쇼';
      default: return status;
    }
  };

  return (
    <span className={`badge badge-${getStatusColor()}`}>
      {getStatusLabel()}
    </span>
  );
};
```

### API Client Utility

```typescript
class ApiClient {
  private baseURL: string;
  private getToken: () => string | null;

  constructor(baseURL: string, getToken: () => string | null) {
    this.baseURL = baseURL;
    this.getToken = getToken;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getToken();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers
      }
    });

    if (!response.ok) {
      const error = await response.json();
      throw {
        status: response.status,
        error: error.error || { message: 'Request failed' }
      };
    }

    return response.json();
  }

  async get<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'GET' });
  }

  async post<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  async patch<T>(endpoint: string, data: any): Promise<T> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data)
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Usage
const api = new ApiClient(
  'https://api.yourapp.com',
  () => localStorage.getItem('auth_token')
);

// Fetch reservations
const reservations = await api.get<ReservationsResponse>(
  `/api/shops/${shopId}/reservations?page=1&limit=20`
);

// Update status
await api.patch(
  `/api/shops/${shopId}/reservations/${reservationId}`,
  { status: 'confirmed' }
);
```

---

## Support

For questions or issues:
- **Backend Repository:** [GitHub Link]
- **API Documentation:** https://api.yourapp.com/api-docs
- **Technical Support:** dev@yourapp.com

---

**Document Version:** 1.0
**Last Updated:** 2025-01-11
**Author:** Backend Development Team
