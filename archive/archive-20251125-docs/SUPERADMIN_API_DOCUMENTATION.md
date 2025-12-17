# Superadmin API Documentation

## Overview

This document provides comprehensive documentation for the **Platform Superadmin API** - the administrative interface for platform owners who have full access to manage all users, shops, reservations, payments, and system operations.

**Key Capabilities:**
- Full CRUD operations on all entities (users, shops, services, reservations, payments)
- Cross-shop analytics and reporting
- User and shop verification/moderation
- Dispute resolution and support
- System-wide configuration and monitoring
- Audit logging and security tracking

**Base URL:** `https://api.ebeautything.com/api/admin`

**Authentication:** All endpoints require Bearer token with admin role

---

## Table of Contents

1. [Authentication](#1-authentication)
2. [User Management](#2-user-management)
3. [Shop Management](#3-shop-management)
4. [Reservation Management](#4-reservation-management)
5. [Service Management](#5-service-management)
6. [Payment & Settlement Management](#6-payment--settlement-management)
7. [Analytics & Reporting](#7-analytics--reporting)
8. [Security & Audit](#8-security--audit)
9. [Frontend Integration Guide](#9-frontend-integration-guide)
10. [Error Handling](#10-error-handling)

---

## 1. Authentication

### 1.1 Admin Login

**Endpoint:** `POST /api/admin/auth/login`

**Description:** Authenticate as platform administrator with enhanced security features.

**Security Features:**
- IP whitelist verification
- Failed login attempt tracking
- 24-hour session duration
- Rate limiting (10 attempts per 15 minutes)

**Request:**
```json
{
  "email": "admin@ebeautything.com",
  "password": "secureAdminPassword123!"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "user": {
      "id": "admin-uuid",
      "email": "admin@ebeautything.com",
      "name": "Admin User",
      "role": "admin",
      "permissions": [
        "users.read",
        "users.write",
        "shops.read",
        "shops.write",
        "reservations.manage",
        "payments.manage",
        "analytics.view"
      ]
    },
    "expiresAt": "2025-11-12T10:30:00Z"
  }
}
```

**Frontend Usage:**
```typescript
// Store token securely
localStorage.setItem('admin_token', response.data.token);
localStorage.setItem('admin_refresh_token', response.data.refreshToken);

// Set up axios interceptor
axios.interceptors.request.use(config => {
  config.headers.Authorization = `Bearer ${localStorage.getItem('admin_token')}`;
  return config;
});
```

---

### 1.2 Refresh Token

**Endpoint:** `POST /api/admin/auth/refresh`

**Description:** Obtain new access token using refresh token.

**Request:**
```json
{
  "refreshToken": "refresh_token_here"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "expiresAt": "2025-11-12T10:30:00Z"
  }
}
```

---

### 1.3 Validate Session

**Endpoint:** `GET /api/admin/auth/validate`

**Description:** Check if current session is valid.

**Response:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "user": {
      "id": "admin-uuid",
      "email": "admin@ebeautything.com",
      "role": "admin"
    },
    "expiresAt": "2025-11-12T10:30:00Z"
  }
}
```

---

### 1.4 Admin Profile

**Endpoint:** `GET /api/admin/auth/profile`

**Description:** Get current admin user profile details.

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "admin-uuid",
    "email": "admin@ebeautything.com",
    "name": "Admin User",
    "role": "admin",
    "created_at": "2025-01-01T00:00:00Z",
    "last_login_at": "2025-11-11T09:30:00Z",
    "permissions": ["users.read", "users.write", "shops.read", "shops.write"]
  }
}
```

---

### 1.5 Active Sessions

**Endpoint:** `GET /api/admin/auth/sessions`

**Description:** List all active admin sessions for security monitoring.

**Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session-uuid",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "created_at": "2025-11-11T09:30:00Z",
        "expires_at": "2025-11-12T09:30:00Z",
        "is_current": true
      }
    ]
  }
}
```

---

### 1.6 Logout

**Endpoint:** `POST /api/admin/auth/logout`

**Description:** Invalidate current admin session.

**Response:**
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

---

## 2. User Management

### 2.1 List Users

**Endpoint:** `GET /api/admin/users`

**Description:** Retrieve paginated list of all platform users with advanced filtering.

**Query Parameters:**
- `page` (number, default: 1): Page number
- `limit` (number, default: 20, max: 100): Items per page
- `role` (string): Filter by role (admin, shop_owner, user, influencer)
- `status` (string): Filter by status (active, inactive, suspended, banned)
- `search` (string): Search by name, email, or phone
- `segment` (string): Pre-defined user segment (power_users, inactive_users, new_users, high_value_users)
- `sort_by` (string): Sort field (created_at, name, email)
- `sort_order` (string): Sort direction (asc, desc)
- `created_from` (date): Filter users created after date
- `created_to` (date): Filter users created before date
- `last_login_from` (date): Filter by last login date
- `verified` (boolean): Filter by verification status

**Request:**
```
GET /api/admin/users?page=1&limit=20&role=shop_owner&status=active&sort_by=created_at&sort_order=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "shopowner@test.com",
        "name": "김지은",
        "phone_number": "010-1234-5678",
        "user_role": "shop_owner",
        "user_status": "active",
        "is_verified": true,
        "created_at": "2025-09-01T00:00:00Z",
        "last_login_at": "2025-11-11T09:00:00Z",
        "stats": {
          "total_reservations": 45,
          "total_spent": 1250000,
          "shops_owned": 1
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 5,
      "total_items": 95,
      "items_per_page": 20,
      "has_next": true,
      "has_prev": false
    }
  }
}
```

**Frontend Usage:**
```typescript
// User list component with filters
const [filters, setFilters] = useState({
  page: 1,
  limit: 20,
  role: 'all',
  status: 'all',
  search: ''
});

const fetchUsers = async () => {
  const params = new URLSearchParams();
  if (filters.role !== 'all') params.append('role', filters.role);
  if (filters.status !== 'all') params.append('status', filters.status);
  if (filters.search) params.append('search', filters.search);
  params.append('page', filters.page.toString());
  params.append('limit', filters.limit.toString());

  const response = await axios.get(`/api/admin/users?${params}`);
  setUsers(response.data.data.users);
  setPagination(response.data.data.pagination);
};
```

---

### 2.2 Get User Details

**Endpoint:** `GET /api/admin/users/:userId`

**Description:** Retrieve comprehensive details for a specific user.

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "user@example.com",
      "name": "김민수",
      "phone_number": "010-9876-5432",
      "user_role": "user",
      "user_status": "active",
      "is_verified": true,
      "profile_image": "https://storage.example.com/profiles/user.jpg",
      "created_at": "2025-08-15T00:00:00Z",
      "last_login_at": "2025-11-10T15:30:00Z",
      "stats": {
        "total_reservations": 12,
        "completed_reservations": 10,
        "cancelled_reservations": 2,
        "total_spent": 480000,
        "average_rating_given": 4.5
      },
      "recent_activity": [
        {
          "type": "reservation_created",
          "timestamp": "2025-11-10T15:30:00Z",
          "details": "네일 서비스 예약"
        },
        {
          "type": "payment_completed",
          "timestamp": "2025-11-10T15:32:00Z",
          "details": "예약금 24,000원 결제"
        }
      ]
    }
  }
}
```

---

### 2.3 Create User

**Endpoint:** `POST /api/admin/users`

**Description:** Create a new user account (for manual admin creation).

**Request:**
```json
{
  "email": "newuser@example.com",
  "password": "temporaryPassword123!",
  "name": "이영희",
  "phone_number": "010-1111-2222",
  "user_role": "user",
  "send_welcome_email": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "new-user-uuid",
      "email": "newuser@example.com",
      "name": "이영희",
      "user_role": "user",
      "user_status": "active",
      "created_at": "2025-11-11T10:00:00Z"
    },
    "message": "User created successfully. Welcome email sent."
  }
}
```

---

### 2.4 Update User

**Endpoint:** `PUT /api/admin/users/:userId`

**Description:** Update user information.

**Request:**
```json
{
  "name": "이영희 (수정)",
  "phone_number": "010-1111-3333",
  "profile_image": "https://storage.example.com/profiles/new-image.jpg"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "email": "newuser@example.com",
      "name": "이영희 (수정)",
      "phone_number": "010-1111-3333",
      "updated_at": "2025-11-11T10:15:00Z"
    }
  }
}
```

---

### 2.5 Update User Status

**Endpoint:** `PUT /api/admin/users/:userId/status`

**Description:** Change user account status (activate, suspend, ban).

**Request:**
```json
{
  "status": "suspended",
  "reason": "사용자 신고 접수 - 부적절한 행동",
  "duration_days": 30,
  "notify_user": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "user_status": "suspended",
      "suspended_until": "2025-12-11T10:20:00Z",
      "suspension_reason": "사용자 신고 접수 - 부적절한 행동"
    },
    "message": "User status updated. Notification sent."
  }
}
```

**Status Options:**
- `active`: Normal active account
- `inactive`: User deactivated their account
- `suspended`: Temporarily suspended (with duration)
- `banned`: Permanently banned

---

### 2.6 Update User Role

**Endpoint:** `PUT /api/admin/users/:userId/role`

**Description:** Change user role (promotion/demotion).

**Request:**
```json
{
  "role": "shop_owner",
  "reason": "사업자 등록 확인 완료",
  "notify_user": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "user_role": "shop_owner",
      "role_changed_at": "2025-11-11T10:25:00Z"
    },
    "message": "User role updated successfully"
  }
}
```

**Available Roles:**
- `admin`: Platform administrator
- `shop_owner`: Shop owner with management capabilities
- `user`: Regular customer
- `influencer`: Influencer with special privileges

---

### 2.7 Delete User

**Endpoint:** `DELETE /api/admin/users/:userId`

**Description:** Soft delete or permanently delete user account.

**Query Parameters:**
- `hard_delete` (boolean, default: false): Permanent deletion vs soft delete

**Request:**
```
DELETE /api/admin/users/:userId?hard_delete=false
```

**Response:**
```json
{
  "success": true,
  "message": "User account deactivated successfully",
  "data": {
    "deleted_at": "2025-11-11T10:30:00Z",
    "can_restore_until": "2025-12-11T10:30:00Z"
  }
}
```

---

### 2.8 User Analytics

**Endpoint:** `GET /api/admin/users/:userId/analytics`

**Description:** Get detailed analytics for specific user.

**Response:**
```json
{
  "success": true,
  "data": {
    "user_id": "user-uuid",
    "overview": {
      "total_reservations": 12,
      "completed": 10,
      "cancelled": 2,
      "no_show": 0,
      "total_spent": 480000,
      "average_booking_value": 40000
    },
    "spending_by_month": [
      {"month": "2025-09", "amount": 120000},
      {"month": "2025-10", "amount": 160000},
      {"month": "2025-11", "amount": 200000}
    ],
    "favorite_categories": [
      {"category": "nail", "count": 6},
      {"category": "eyelash", "count": 4},
      {"category": "waxing", "count": 2}
    ],
    "favorite_shops": [
      {
        "shop_id": "shop-uuid",
        "shop_name": "네일하우스 강남점",
        "visit_count": 5,
        "total_spent": 200000
      }
    ]
  }
}
```

---

### 2.9 User Activity Log

**Endpoint:** `GET /api/admin/users/:userId/activity`

**Description:** Get user activity history for audit purposes.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 50)
- `activity_type` (string): Filter by type
- `date_from` (date): Start date
- `date_to` (date): End date

**Response:**
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-uuid",
        "user_id": "user-uuid",
        "activity_type": "login",
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "timestamp": "2025-11-11T10:00:00Z",
        "details": {
          "device": "mobile",
          "os": "iOS 17.1"
        }
      },
      {
        "id": "activity-uuid-2",
        "activity_type": "reservation_created",
        "timestamp": "2025-11-11T10:05:00Z",
        "details": {
          "reservation_id": "res-uuid",
          "shop_name": "네일하우스 강남점",
          "amount": 80000
        }
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_items": 150,
      "total_pages": 3
    }
  }
}
```

---

### 2.10 Bulk User Actions

**Endpoint:** `POST /api/admin/users/bulk`

**Description:** Perform actions on multiple users at once.

**Request:**
```json
{
  "action": "update_status",
  "user_ids": ["uuid1", "uuid2", "uuid3"],
  "params": {
    "status": "suspended",
    "reason": "대량 스팸 활동 감지",
    "duration_days": 7
  }
}
```

**Available Actions:**
- `update_status`: Change status for multiple users
- `send_notification`: Send notification to multiple users
- `export_data`: Export user data

**Response:**
```json
{
  "success": true,
  "data": {
    "total_processed": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "user_id": "uuid1",
        "status": "success",
        "message": "Status updated"
      },
      {
        "user_id": "uuid2",
        "status": "success",
        "message": "Status updated"
      },
      {
        "user_id": "uuid3",
        "status": "success",
        "message": "Status updated"
      }
    ]
  }
}
```

---

## 3. Shop Management

### 3.1 List Shops

**Endpoint:** `GET /api/admin/shops`

**Description:** Retrieve paginated list of all shops with filtering.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `status` (string): Filter by status (pending, verified, rejected, suspended)
- `category` (string): Filter by main category
- `search` (string): Search by name, address, or owner
- `sort_by` (string): Sort field (created_at, name, rating)
- `sort_order` (string): Sort direction (asc, desc)
- `region` (string): Filter by region/city
- `verified_only` (boolean): Show only verified shops

**Request:**
```
GET /api/admin/shops?page=1&limit=20&status=verified&category=nail&sort_by=rating&sort_order=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "네일하우스 강남점",
        "shop_status": "verified",
        "main_category": "nail",
        "address": "서울시 강남구 테헤란로 123",
        "phone_number": "02-1234-5678",
        "rating": 4.8,
        "review_count": 125,
        "owner": {
          "id": "owner-uuid",
          "name": "김지은",
          "email": "shopowner@test.com"
        },
        "stats": {
          "total_reservations": 450,
          "monthly_revenue": 12500000,
          "service_count": 20
        },
        "created_at": "2025-09-01T00:00:00Z",
        "verified_at": "2025-09-05T00:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 8,
      "total_items": 156,
      "items_per_page": 20
    }
  }
}
```

---

### 3.2 Get Shop Details

**Endpoint:** `GET /api/admin/shops/:shopId`

**Description:** Retrieve comprehensive details for a specific shop.

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "name": "네일하우스 강남점",
      "shop_status": "verified",
      "main_category": "nail",
      "sub_categories": ["nail_art", "gel_nail", "pedicure"],
      "description": "강남 최고의 네일샵입니다.",
      "address": "서울시 강남구 테헤란로 123",
      "detailed_address": "2층 201호",
      "phone_number": "02-1234-5678",
      "business_hours": {
        "monday": {"open": "10:00", "close": "20:00"},
        "tuesday": {"open": "10:00", "close": "20:00"},
        "wednesday": {"open": "10:00", "close": "20:00"},
        "thursday": {"open": "10:00", "close": "20:00"},
        "friday": {"open": "10:00", "close": "20:00"},
        "saturday": {"open": "11:00", "close": "19:00"},
        "sunday": {"closed": true}
      },
      "rating": 4.8,
      "review_count": 125,
      "images": [
        "https://storage.example.com/shops/shop1-1.jpg",
        "https://storage.example.com/shops/shop1-2.jpg"
      ],
      "owner": {
        "id": "owner-uuid",
        "name": "김지은",
        "email": "shopowner@test.com",
        "phone": "010-1234-5678"
      },
      "verification": {
        "status": "verified",
        "verified_at": "2025-09-05T00:00:00Z",
        "verified_by": "admin-uuid",
        "documents": [
          {
            "type": "business_license",
            "url": "https://storage.example.com/docs/license.pdf",
            "status": "approved"
          }
        ]
      },
      "stats": {
        "total_reservations": 450,
        "completed_reservations": 420,
        "cancelled_reservations": 20,
        "no_show_count": 10,
        "monthly_revenue": 12500000,
        "service_count": 20,
        "average_service_price": 45000
      },
      "created_at": "2025-09-01T00:00:00Z",
      "updated_at": "2025-11-11T00:00:00Z"
    }
  }
}
```

---

### 3.3 Create Shop

**Endpoint:** `POST /api/admin/shops`

**Description:** Create a new shop (admin-initiated creation).

**Request:**
```json
{
  "name": "새로운 네일샵",
  "owner_id": "owner-uuid",
  "main_category": "nail",
  "sub_categories": ["nail_art", "gel_nail"],
  "description": "신규 오픈 네일샵입니다.",
  "address": "서울시 강남구 선릉로 456",
  "detailed_address": "1층",
  "phone_number": "02-9876-5432",
  "business_hours": {
    "monday": {"open": "09:00", "close": "21:00"},
    "tuesday": {"open": "09:00", "close": "21:00"},
    "wednesday": {"open": "09:00", "close": "21:00"},
    "thursday": {"open": "09:00", "close": "21:00"},
    "friday": {"open": "09:00", "close": "21:00"},
    "saturday": {"open": "10:00", "close": "20:00"},
    "sunday": {"closed": true}
  },
  "auto_verify": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "new-shop-uuid",
      "name": "새로운 네일샵",
      "shop_status": "verified",
      "main_category": "nail",
      "created_at": "2025-11-11T11:00:00Z"
    },
    "message": "Shop created and automatically verified"
  }
}
```

---

### 3.4 Update Shop

**Endpoint:** `PUT /api/admin/shops/:shopId`

**Description:** Update shop information.

**Request:**
```json
{
  "name": "네일하우스 강남점 (리뉴얼)",
  "description": "리뉴얼 오픈! 더 좋아진 서비스",
  "phone_number": "02-1234-9999",
  "business_hours": {
    "saturday": {"open": "10:00", "close": "21:00"}
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "name": "네일하우스 강남점 (리뉴얼)",
      "updated_at": "2025-11-11T11:10:00Z"
    }
  }
}
```

---

### 3.5 Update Shop Status

**Endpoint:** `PATCH /api/admin/shops/:shopId/status`

**Description:** Change shop status (verify, suspend, close).

**Request:**
```json
{
  "status": "suspended",
  "reason": "고객 불만 다수 접수",
  "duration_days": 14,
  "notify_owner": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "shop_status": "suspended",
      "suspended_until": "2025-11-25T11:15:00Z",
      "suspension_reason": "고객 불만 다수 접수"
    },
    "message": "Shop status updated. Owner notified."
  }
}
```

**Status Options:**
- `pending`: Awaiting verification
- `verified`: Verified and active
- `suspended`: Temporarily suspended
- `rejected`: Verification rejected
- `closed`: Permanently closed

---

### 3.6 Pending Shops (Verification Queue)

**Endpoint:** `GET /api/admin/shops/pending`

**Description:** List shops awaiting verification.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `sort_by` (string): created_at, name
- `category` (string): Filter by category

**Response:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "pending-shop-uuid",
        "name": "검증 대기 중인 샵",
        "shop_status": "pending",
        "main_category": "eyelash",
        "owner": {
          "id": "owner-uuid",
          "name": "박수진",
          "email": "newowner@example.com"
        },
        "submitted_documents": [
          {
            "type": "business_license",
            "url": "https://storage.example.com/docs/license2.pdf",
            "uploaded_at": "2025-11-10T00:00:00Z"
          },
          {
            "type": "id_verification",
            "url": "https://storage.example.com/docs/id2.pdf",
            "uploaded_at": "2025-11-10T00:00:00Z"
          }
        ],
        "created_at": "2025-11-10T00:00:00Z",
        "waiting_days": 1
      }
    ],
    "pagination": {
      "total_items": 12
    }
  }
}
```

---

### 3.7 Approve Shop

**Endpoint:** `PUT /api/admin/shops/:shopId/approve`

**Description:** Approve pending shop verification.

**Request:**
```json
{
  "notes": "모든 서류 확인 완료. 승인됨.",
  "welcome_bonus": 50000,
  "notify_owner": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "shop_status": "verified",
      "verified_at": "2025-11-11T11:20:00Z",
      "verified_by": "admin-uuid"
    },
    "message": "Shop approved successfully. Welcome bonus credited."
  }
}
```

---

### 3.8 Reject Shop

**Endpoint:** `PUT /api/admin/shops/:shopId/reject`

**Description:** Reject shop verification.

**Request:**
```json
{
  "reason": "사업자 등록증 정보 불일치",
  "details": "제출된 사업자 등록증의 사업장 주소가 신청 주소와 다릅니다.",
  "allow_resubmit": true,
  "notify_owner": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "shop_status": "rejected",
      "rejection_reason": "사업자 등록증 정보 불일치",
      "can_resubmit": true,
      "rejected_at": "2025-11-11T11:25:00Z"
    },
    "message": "Shop verification rejected. Owner notified with details."
  }
}
```

---

### 3.9 Delete Shop

**Endpoint:** `DELETE /api/admin/shops/:shopId`

**Description:** Soft delete or permanently delete shop.

**Query Parameters:**
- `hard_delete` (boolean, default: false)
- `transfer_data` (boolean): Transfer reservation history to archive

**Request:**
```
DELETE /api/admin/shops/:shopId?hard_delete=false&transfer_data=true
```

**Response:**
```json
{
  "success": true,
  "message": "Shop deactivated successfully",
  "data": {
    "deleted_at": "2025-11-11T11:30:00Z",
    "archived_reservations": 450,
    "can_restore_until": "2025-12-11T11:30:00Z"
  }
}
```

---

### 3.10 Shop Analytics

**Endpoint:** `GET /api/admin/shops/:shopId/analytics`

**Description:** Get detailed analytics for specific shop.

**Query Parameters:**
- `period` (string): day, week, month, year, custom
- `start_date` (date): For custom period
- `end_date` (date): For custom period

**Response:**
```json
{
  "success": true,
  "data": {
    "shop_id": "shop-uuid",
    "period": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    },
    "overview": {
      "total_revenue": 3200000,
      "total_reservations": 85,
      "completed_reservations": 78,
      "cancelled_reservations": 5,
      "no_show": 2,
      "average_booking_value": 37647,
      "new_customers": 23,
      "returning_customers": 62
    },
    "revenue_by_day": [
      {"date": "2025-10-01", "revenue": 120000, "bookings": 3},
      {"date": "2025-10-02", "revenue": 95000, "bookings": 2}
    ],
    "popular_services": [
      {
        "service_id": "service-uuid",
        "service_name": "젤네일 + 네일아트",
        "bookings": 32,
        "revenue": 1280000
      }
    ],
    "peak_hours": [
      {"hour": 14, "bookings": 18},
      {"hour": 15, "bookings": 16},
      {"hour": 16, "bookings": 14}
    ],
    "customer_ratings": {
      "average_rating": 4.8,
      "total_reviews": 65,
      "rating_distribution": {
        "5": 48,
        "4": 12,
        "3": 3,
        "2": 1,
        "1": 1
      }
    }
  }
}
```

---

### 3.11 Shop Performance Comparison

**Endpoint:** `GET /api/admin/shops/compare`

**Description:** Compare multiple shops performance.

**Query Parameters:**
- `shop_ids` (string[]): Array of shop IDs to compare
- `period` (string): Comparison period
- `metrics` (string[]): Metrics to compare (revenue, bookings, ratings)

**Request:**
```
GET /api/admin/shops/compare?shop_ids=shop1-uuid,shop2-uuid&period=month&metrics=revenue,bookings,ratings
```

**Response:**
```json
{
  "success": true,
  "data": {
    "comparison": [
      {
        "shop_id": "shop1-uuid",
        "shop_name": "네일하우스 강남점",
        "metrics": {
          "revenue": 3200000,
          "bookings": 85,
          "rating": 4.8,
          "growth_rate": 15.2
        }
      },
      {
        "shop_id": "shop2-uuid",
        "shop_name": "아이래쉬 홍대점",
        "metrics": {
          "revenue": 2800000,
          "bookings": 72,
          "rating": 4.6,
          "growth_rate": 8.7
        }
      }
    ],
    "period": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    }
  }
}
```

---

## 4. Reservation Management

### 4.1 List Reservations

**Endpoint:** `GET /api/admin/reservations`

**Description:** Retrieve all reservations across all shops with advanced filtering.

**Query Parameters:**
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `status` (string): Filter by status
- `shop_id` (string): Filter by shop
- `user_id` (string): Filter by user
- `date_from` (date): Start date range
- `date_to` (date): End date range
- `search` (string): Search by reservation ID, user name, shop name
- `payment_status` (string): Filter by payment status
- `sort_by` (string): Sort field
- `sort_order` (string): Sort direction

**Request:**
```
GET /api/admin/reservations?page=1&limit=20&status=requested&date_from=2025-11-11&date_to=2025-11-18
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation-uuid",
        "user": {
          "id": "user-uuid",
          "name": "김민수",
          "email": "user@example.com",
          "phone": "010-9876-5432"
        },
        "shop": {
          "id": "shop-uuid",
          "name": "네일하우스 강남점",
          "phone": "02-1234-5678"
        },
        "reservation_date": "2025-11-15",
        "reservation_time": "14:00",
        "status": "requested",
        "total_amount": 80000,
        "deposit_amount": 24000,
        "remaining_amount": 56000,
        "payment_status": "deposit_paid",
        "services": [
          {
            "id": "service-uuid",
            "name": "젤네일 + 네일아트",
            "price": 80000,
            "duration_minutes": 90
          }
        ],
        "created_at": "2025-11-11T10:00:00Z",
        "updated_at": "2025-11-11T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_pages": 12,
      "total_items": 235,
      "items_per_page": 20
    },
    "summary": {
      "total_reservations": 235,
      "total_revenue": 9400000,
      "by_status": {
        "requested": 45,
        "confirmed": 120,
        "completed": 50,
        "cancelled_by_user": 15,
        "cancelled_by_shop": 3,
        "no_show": 2
      }
    }
  }
}
```

---

### 4.2 Get Reservation Details

**Endpoint:** `GET /api/admin/reservations/:reservationId/details`

**Description:** Get comprehensive details for a specific reservation.

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "user": {
        "id": "user-uuid",
        "name": "김민수",
        "email": "user@example.com",
        "phone": "010-9876-5432",
        "reservation_history_count": 12
      },
      "shop": {
        "id": "shop-uuid",
        "name": "네일하우스 강남점",
        "address": "서울시 강남구 테헤란로 123",
        "phone": "02-1234-5678"
      },
      "reservation_date": "2025-11-15",
      "reservation_time": "14:00",
      "reservation_datetime": "2025-11-15T14:00:00+09:00",
      "status": "confirmed",
      "total_amount": 80000,
      "deposit_amount": 24000,
      "remaining_amount": 56000,
      "services": [
        {
          "id": "service-uuid",
          "name": "젤네일 + 네일아트",
          "category": "nail",
          "price": 80000,
          "duration_minutes": 90,
          "description": "기본 젤네일과 원하시는 디자인의 네일아트"
        }
      ],
      "payments": [
        {
          "id": "payment-uuid",
          "amount": 24000,
          "payment_method": "card",
          "payment_status": "deposit_paid",
          "is_deposit": true,
          "paid_at": "2025-11-11T10:05:00Z"
        }
      ],
      "special_requests": "핑크톤 컬러 선호합니다",
      "status_history": [
        {
          "status": "requested",
          "changed_at": "2025-11-11T10:00:00Z",
          "changed_by": "user"
        },
        {
          "status": "confirmed",
          "changed_at": "2025-11-11T12:00:00Z",
          "changed_by": "shop_owner"
        }
      ],
      "created_at": "2025-11-11T10:00:00Z",
      "updated_at": "2025-11-11T12:00:00Z",
      "version": 2
    }
  }
}
```

---

### 4.3 Update Reservation Status

**Endpoint:** `PUT /api/admin/reservations/:reservationId/status`

**Description:** Update reservation status with admin override capabilities.

**Request:**
```json
{
  "status": "completed",
  "admin_notes": "고객 요청으로 관리자가 직접 완료 처리",
  "override_validation": true,
  "notify_user": true,
  "notify_shop": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "status": "completed",
      "completed_at": "2025-11-11T12:00:00Z",
      "updated_by": "admin-uuid"
    },
    "message": "Reservation status updated. Notifications sent."
  }
}
```

**Admin Override Capabilities:**
- Force complete reservations even if payment pending
- Cancel confirmed reservations without penalties
- Reopen completed reservations for disputes
- Override no-show status

---

### 4.4 Force Cancel Reservation

**Endpoint:** `POST /api/admin/reservations/:reservationId/force-cancel`

**Description:** Force cancel a reservation (emergency cancellation).

**Request:**
```json
{
  "reason": "응급 상황 - 샵 임시 휴업",
  "cancel_type": "shop",
  "refund_full_amount": true,
  "compensation_amount": 10000,
  "notify_user": true,
  "notify_shop": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "status": "cancelled_by_shop",
      "cancelled_at": "2025-11-11T12:10:00Z",
      "cancellation_reason": "응급 상황 - 샵 임시 휴업",
      "refund_amount": 24000,
      "compensation_amount": 10000
    },
    "refund": {
      "status": "processing",
      "estimated_completion": "2025-11-13T12:10:00Z"
    },
    "message": "Reservation cancelled. Refund and compensation processing."
  }
}
```

---

### 4.5 Bulk Status Update

**Endpoint:** `POST /api/admin/reservations/bulk-status-update`

**Description:** Update status for multiple reservations (mass operations).

**Request:**
```json
{
  "reservation_ids": ["uuid1", "uuid2", "uuid3"],
  "new_status": "cancelled_by_shop",
  "reason": "샵 임시 휴업 (2025-11-15)",
  "refund_deposits": true,
  "notify_affected_users": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "total_processed": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "reservation_id": "uuid1",
        "status": "success",
        "new_status": "cancelled_by_shop",
        "refund_amount": 24000
      },
      {
        "reservation_id": "uuid2",
        "status": "success",
        "new_status": "cancelled_by_shop",
        "refund_amount": 30000
      },
      {
        "reservation_id": "uuid3",
        "status": "success",
        "new_status": "cancelled_by_shop",
        "refund_amount": 24000
      }
    ],
    "total_refund_amount": 78000
  }
}
```

---

### 4.6 Create Dispute

**Endpoint:** `POST /api/admin/reservations/:reservationId/dispute`

**Description:** Create admin dispute case for reservation issue.

**Request:**
```json
{
  "dispute_type": "service_quality",
  "description": "고객이 서비스 품질에 대해 불만 제기",
  "filed_by": "admin",
  "priority": "high",
  "requested_resolution": "partial_refund",
  "refund_amount": 40000,
  "evidence_urls": [
    "https://storage.example.com/disputes/evidence1.jpg"
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dispute": {
      "id": "dispute-uuid",
      "reservation_id": "reservation-uuid",
      "dispute_type": "service_quality",
      "status": "open",
      "priority": "high",
      "requested_resolution": "partial_refund",
      "refund_amount": 40000,
      "created_at": "2025-11-11T12:20:00Z",
      "assigned_to": "admin-uuid"
    },
    "message": "Dispute case created. Shop owner notified."
  }
}
```

**Dispute Types:**
- `service_quality`: Service quality issues
- `no_show`: No-show disputes
- `refund_request`: Refund request
- `incorrect_charge`: Billing disputes
- `shop_closed`: Shop closure issues
- `other`: Other issues

---

### 4.7 Resolve Dispute

**Endpoint:** `PUT /api/admin/reservations/disputes/:disputeId/resolve`

**Description:** Resolve dispute case with admin decision.

**Request:**
```json
{
  "resolution": "partial_refund_approved",
  "admin_notes": "고객 사진 증거 확인. 부분 환불 승인.",
  "refund_amount": 40000,
  "compensation_to_shop": 10000,
  "close_dispute": true,
  "notify_parties": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "dispute": {
      "id": "dispute-uuid",
      "status": "resolved",
      "resolution": "partial_refund_approved",
      "resolved_at": "2025-11-11T12:30:00Z",
      "resolved_by": "admin-uuid"
    },
    "refund": {
      "status": "processing",
      "amount": 40000,
      "to_user": "user-uuid"
    },
    "compensation": {
      "status": "processing",
      "amount": 10000,
      "to_shop": "shop-uuid"
    },
    "message": "Dispute resolved. Refund and compensation processing."
  }
}
```

---

### 4.8 Reservation Timeline

**Endpoint:** `GET /api/admin/reservations/:reservationId/timeline`

**Description:** Get complete timeline of reservation events and status changes.

**Response:**
```json
{
  "success": true,
  "data": {
    "reservation_id": "reservation-uuid",
    "timeline": [
      {
        "timestamp": "2025-11-11T10:00:00Z",
        "event_type": "created",
        "actor": "user",
        "actor_name": "김민수",
        "details": "예약 생성"
      },
      {
        "timestamp": "2025-11-11T10:05:00Z",
        "event_type": "payment",
        "actor": "system",
        "details": "예약금 24,000원 결제 완료"
      },
      {
        "timestamp": "2025-11-11T12:00:00Z",
        "event_type": "status_change",
        "actor": "shop_owner",
        "actor_name": "김지은",
        "details": "상태 변경: requested → confirmed"
      },
      {
        "timestamp": "2025-11-11T12:20:00Z",
        "event_type": "dispute_created",
        "actor": "admin",
        "actor_name": "Admin User",
        "details": "분쟁 케이스 생성 - 서비스 품질 문제"
      },
      {
        "timestamp": "2025-11-11T12:30:00Z",
        "event_type": "dispute_resolved",
        "actor": "admin",
        "actor_name": "Admin User",
        "details": "분쟁 해결 - 부분 환불 승인 (40,000원)"
      }
    ]
  }
}
```

---

## 5. Service Management

### 5.1 List All Services

**Endpoint:** `GET /api/admin/services`

**Description:** Retrieve all services across all shops.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `category` (string): Filter by category
- `shop_id` (string): Filter by shop
- `status` (string): active, inactive
- `price_min` (number): Minimum price
- `price_max` (number): Maximum price
- `search` (string): Search by name or description

**Request:**
```
GET /api/admin/services?page=1&limit=50&category=nail&status=active&price_min=50000
```

**Response:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "service-uuid",
        "name": "젤네일 + 네일아트",
        "category": "nail",
        "price": 80000,
        "duration_minutes": 90,
        "shop": {
          "id": "shop-uuid",
          "name": "네일하우스 강남점"
        },
        "status": "active",
        "booking_count": 145,
        "average_rating": 4.8,
        "created_at": "2025-09-01T00:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_items": 850,
      "total_pages": 17
    },
    "summary": {
      "total_services": 850,
      "active_services": 780,
      "inactive_services": 70,
      "average_price": 65000
    }
  }
}
```

---

### 5.2 Get Service Details

**Endpoint:** `GET /api/admin/services/:serviceId`

**Description:** Get detailed information about a specific service.

**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "service-uuid",
      "name": "젤네일 + 네일아트",
      "category": "nail",
      "sub_category": "nail_art",
      "description": "기본 젤네일과 원하시는 디자인의 네일아트를 제공합니다.",
      "price": 80000,
      "duration_minutes": 90,
      "shop": {
        "id": "shop-uuid",
        "name": "네일하우스 강남점",
        "owner_name": "김지은"
      },
      "status": "active",
      "images": [
        "https://storage.example.com/services/service1-1.jpg",
        "https://storage.example.com/services/service1-2.jpg"
      ],
      "stats": {
        "total_bookings": 145,
        "completed_bookings": 138,
        "cancelled_bookings": 7,
        "average_rating": 4.8,
        "total_reviews": 112,
        "total_revenue": 11600000
      },
      "created_at": "2025-09-01T00:00:00Z",
      "updated_at": "2025-11-01T00:00:00Z"
    }
  }
}
```

---

### 5.3 Update Service

**Endpoint:** `PUT /api/admin/services/:serviceId`

**Description:** Update service information (admin override).

**Request:**
```json
{
  "name": "프리미엄 젤네일 + 네일아트",
  "price": 90000,
  "duration_minutes": 100,
  "description": "더 나은 재료를 사용한 프리미엄 서비스",
  "admin_notes": "가격 인상 승인 - 프리미엄 재료 사용"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "service-uuid",
      "name": "프리미엄 젤네일 + 네일아트",
      "price": 90000,
      "updated_at": "2025-11-11T13:00:00Z",
      "updated_by": "admin-uuid"
    }
  }
}
```

---

### 5.4 Deactivate Service

**Endpoint:** `PATCH /api/admin/services/:serviceId/deactivate`

**Description:** Deactivate service (temporarily or permanently).

**Request:**
```json
{
  "reason": "품질 기준 미달",
  "notify_shop": true,
  "cancel_pending_reservations": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "service": {
      "id": "service-uuid",
      "status": "inactive",
      "deactivated_at": "2025-11-11T13:10:00Z",
      "deactivation_reason": "품질 기준 미달"
    },
    "affected_reservations": 0,
    "message": "Service deactivated. Shop owner notified."
  }
}
```

---

### 5.5 Delete Service

**Endpoint:** `DELETE /api/admin/services/:serviceId`

**Description:** Soft delete or hard delete service.

**Query Parameters:**
- `hard_delete` (boolean, default: false)
- `handle_reservations` (string): cancel, transfer, keep

**Request:**
```
DELETE /api/admin/services/:serviceId?hard_delete=false&handle_reservations=cancel
```

**Response:**
```json
{
  "success": true,
  "message": "Service deleted successfully",
  "data": {
    "deleted_at": "2025-11-11T13:20:00Z",
    "cancelled_reservations": 3,
    "refunds_processing": 72000
  }
}
```

---

### 5.6 Service Analytics

**Endpoint:** `GET /api/admin/services/:serviceId/analytics`

**Description:** Get performance analytics for specific service.

**Query Parameters:**
- `period` (string): day, week, month, year, custom
- `start_date` (date)
- `end_date` (date)

**Response:**
```json
{
  "success": true,
  "data": {
    "service_id": "service-uuid",
    "period": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    },
    "performance": {
      "total_bookings": 32,
      "completed_bookings": 30,
      "cancelled_bookings": 2,
      "no_show": 0,
      "revenue": 2560000,
      "average_rating": 4.9,
      "new_reviews": 25
    },
    "booking_trends": [
      {"date": "2025-10-01", "bookings": 1, "revenue": 80000},
      {"date": "2025-10-05", "bookings": 2, "revenue": 160000}
    ],
    "customer_satisfaction": {
      "rating_distribution": {
        "5": 24,
        "4": 4,
        "3": 1,
        "2": 0,
        "1": 0
      },
      "common_positive_keywords": ["꼼꼼함", "친절", "예쁨"],
      "common_negative_keywords": []
    }
  }
}
```

---

### 5.7 Popular Services Report

**Endpoint:** `GET /api/admin/services/popular`

**Description:** Get list of most popular services platform-wide.

**Query Parameters:**
- `period` (string): week, month, quarter, year
- `category` (string): Filter by category
- `limit` (number): Top N services

**Request:**
```
GET /api/admin/services/popular?period=month&limit=20
```

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "top_services": [
      {
        "rank": 1,
        "service_id": "service-uuid",
        "service_name": "젤네일 + 네일아트",
        "category": "nail",
        "shop_name": "네일하우스 강남점",
        "total_bookings": 145,
        "revenue": 11600000,
        "average_rating": 4.8,
        "growth_rate": 15.2
      },
      {
        "rank": 2,
        "service_id": "service-uuid-2",
        "service_name": "속눈썹 연장",
        "category": "eyelash",
        "shop_name": "아이래쉬 홍대점",
        "total_bookings": 132,
        "revenue": 7920000,
        "average_rating": 4.7,
        "growth_rate": 10.5
      }
    ]
  }
}
```

---

## 6. Payment & Settlement Management

### 6.1 List Payments

**Endpoint:** `GET /api/admin/payments`

**Description:** Retrieve all payments across platform.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `payment_status` (string): deposit_paid, fully_paid, deposit_refunded, failed
- `payment_method` (string): card, easy_pay, virtual_account, transfer
- `shop_id` (string): Filter by shop
- `user_id` (string): Filter by user
- `date_from` (date)
- `date_to` (date)
- `amount_min` (number)
- `amount_max` (number)

**Request:**
```
GET /api/admin/payments?page=1&limit=50&payment_status=fully_paid&date_from=2025-11-01&date_to=2025-11-30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment-uuid",
        "reservation_id": "reservation-uuid",
        "user": {
          "id": "user-uuid",
          "name": "김민수",
          "email": "user@example.com"
        },
        "shop": {
          "id": "shop-uuid",
          "name": "네일하우스 강남점"
        },
        "amount": 80000,
        "payment_method": "card",
        "payment_status": "fully_paid",
        "is_deposit": false,
        "paid_at": "2025-11-15T16:00:00Z",
        "created_at": "2025-11-11T10:00:00Z"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_items": 1250,
      "total_pages": 25
    },
    "summary": {
      "total_payments": 1250,
      "total_amount": 52000000,
      "by_status": {
        "fully_paid": 980,
        "deposit_paid": 220,
        "deposit_refunded": 35,
        "failed": 15
      },
      "by_method": {
        "card": 750,
        "easy_pay": 350,
        "virtual_account": 100,
        "transfer": 50
      }
    }
  }
}
```

---

### 6.2 Get Payment Details

**Endpoint:** `GET /api/admin/payments/:paymentId`

**Description:** Get detailed information about specific payment.

**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "payment-uuid",
      "reservation_id": "reservation-uuid",
      "user": {
        "id": "user-uuid",
        "name": "김민수",
        "email": "user@example.com",
        "phone": "010-9876-5432"
      },
      "shop": {
        "id": "shop-uuid",
        "name": "네일하우스 강남점",
        "owner_name": "김지은"
      },
      "amount": 80000,
      "payment_method": "card",
      "payment_status": "fully_paid",
      "is_deposit": false,
      "pg_provider": "toss",
      "pg_transaction_id": "toss_txn_123456789",
      "card_info": {
        "card_company": "신한카드",
        "card_number_masked": "1234-****-****-5678",
        "installment_months": 0
      },
      "paid_at": "2025-11-15T16:00:00Z",
      "created_at": "2025-11-11T10:00:00Z",
      "updated_at": "2025-11-15T16:00:00Z",
      "version": 2
    }
  }
}
```

---

### 6.3 Process Refund

**Endpoint:** `POST /api/admin/payments/:paymentId/refund`

**Description:** Process refund for a payment (full or partial).

**Request:**
```json
{
  "refund_amount": 80000,
  "refund_type": "full",
  "reason": "서비스 제공 불가 - 샵 사정",
  "compensation_amount": 10000,
  "notify_user": true,
  "notify_shop": true
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "refund-uuid",
      "payment_id": "payment-uuid",
      "amount": 80000,
      "compensation_amount": 10000,
      "status": "processing",
      "estimated_completion": "2025-11-13T16:30:00Z",
      "created_at": "2025-11-11T16:30:00Z"
    },
    "payment": {
      "id": "payment-uuid",
      "payment_status": "deposit_refunded",
      "updated_at": "2025-11-11T16:30:00Z"
    },
    "message": "Refund processing. User and shop notified."
  }
}
```

---

### 6.4 Settlement Report

**Endpoint:** `GET /api/admin/settlements`

**Description:** Get settlement reports for shops.

**Query Parameters:**
- `shop_id` (string): Specific shop or all shops
- `period` (string): daily, weekly, monthly
- `start_date` (date)
- `end_date` (date)
- `status` (string): pending, processing, completed

**Request:**
```
GET /api/admin/settlements?period=monthly&start_date=2025-10-01&end_date=2025-10-31&status=completed
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "id": "settlement-uuid",
        "shop": {
          "id": "shop-uuid",
          "name": "네일하우스 강남점",
          "owner_name": "김지은"
        },
        "period": {
          "start": "2025-10-01",
          "end": "2025-10-31"
        },
        "summary": {
          "total_sales": 3200000,
          "platform_fee": 320000,
          "pg_fee": 96000,
          "refunds": 80000,
          "settlement_amount": 2704000
        },
        "transaction_count": 85,
        "status": "completed",
        "settled_at": "2025-11-05T00:00:00Z",
        "payment_method": "bank_transfer",
        "bank_account": {
          "bank_name": "신한은행",
          "account_number": "****-****-5678",
          "account_holder": "김지은"
        }
      }
    ],
    "totals": {
      "total_sales": 45000000,
      "total_fees": 5850000,
      "total_settlements": 39150000
    }
  }
}
```

---

### 6.5 Generate Settlement

**Endpoint:** `POST /api/admin/settlements/generate`

**Description:** Generate settlement for specific period.

**Request:**
```json
{
  "shop_ids": ["shop-uuid-1", "shop-uuid-2"],
  "period": {
    "start": "2025-11-01",
    "end": "2025-11-30"
  },
  "auto_process": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settlements_generated": 2,
    "total_settlement_amount": 5408000,
    "settlements": [
      {
        "settlement_id": "settlement-uuid-1",
        "shop_id": "shop-uuid-1",
        "amount": 2704000,
        "status": "pending"
      },
      {
        "settlement_id": "settlement-uuid-2",
        "shop_id": "shop-uuid-2",
        "amount": 2704000,
        "status": "pending"
      }
    ],
    "message": "Settlements generated. Awaiting approval."
  }
}
```

---

### 6.6 Approve Settlement

**Endpoint:** `PUT /api/admin/settlements/:settlementId/approve`

**Description:** Approve and process settlement payment.

**Request:**
```json
{
  "admin_notes": "정산 내역 확인 완료. 승인.",
  "scheduled_payment_date": "2025-12-05"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settlement": {
      "id": "settlement-uuid",
      "status": "processing",
      "approved_at": "2025-11-11T17:00:00Z",
      "approved_by": "admin-uuid",
      "scheduled_payment_date": "2025-12-05"
    },
    "message": "Settlement approved and scheduled for payment"
  }
}
```

---

### 6.7 Payment Analytics

**Endpoint:** `GET /api/admin/payments/analytics`

**Description:** Get platform-wide payment analytics.

**Query Parameters:**
- `period` (string): day, week, month, quarter, year
- `start_date` (date)
- `end_date` (date)
- `group_by` (string): day, week, month, payment_method, status

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    },
    "overview": {
      "total_payments": 1250,
      "total_amount": 52000000,
      "successful_payments": 1220,
      "failed_payments": 30,
      "refunded_payments": 35,
      "refund_amount": 1400000,
      "net_revenue": 50600000
    },
    "by_payment_method": [
      {
        "method": "card",
        "count": 750,
        "amount": 31200000,
        "percentage": 60.0
      },
      {
        "method": "easy_pay",
        "count": 350,
        "amount": 14560000,
        "percentage": 28.0
      },
      {
        "method": "virtual_account",
        "count": 100,
        "amount": 4160000,
        "percentage": 8.0
      },
      {
        "method": "transfer",
        "count": 50,
        "amount": 2080000,
        "percentage": 4.0
      }
    ],
    "daily_trends": [
      {"date": "2025-10-01", "amount": 1680000, "count": 40},
      {"date": "2025-10-02", "amount": 1560000, "count": 38}
    ],
    "platform_fees": {
      "total_fees": 5200000,
      "pg_fees": 1560000,
      "platform_commission": 3640000
    }
  }
}
```

---

## 7. Analytics & Reporting

### 7.1 Platform Overview Dashboard

**Endpoint:** `GET /api/admin/analytics/dashboard`

**Description:** Get high-level platform statistics and KPIs.

**Query Parameters:**
- `period` (string): today, week, month, year

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "overview": {
      "total_users": 2450,
      "new_users": 185,
      "active_users": 1200,
      "total_shops": 156,
      "verified_shops": 142,
      "pending_shops": 12,
      "total_reservations": 4850,
      "completed_reservations": 4320,
      "total_revenue": 203500000,
      "platform_revenue": 20350000
    },
    "growth": {
      "users_growth": 8.2,
      "shops_growth": 5.4,
      "reservations_growth": 12.7,
      "revenue_growth": 15.3
    },
    "top_categories": [
      {"category": "nail", "bookings": 1940, "revenue": 77600000},
      {"category": "eyelash", "bookings": 1455, "revenue": 87300000},
      {"category": "waxing", "bookings": 970, "revenue": 24250000}
    ],
    "active_issues": {
      "pending_verifications": 12,
      "open_disputes": 8,
      "failed_payments": 15,
      "suspended_accounts": 3
    }
  }
}
```

---

### 7.2 Revenue Analytics

**Endpoint:** `GET /api/admin/analytics/revenue`

**Description:** Detailed revenue breakdown and trends.

**Query Parameters:**
- `period` (string)
- `start_date` (date)
- `end_date` (date)
- `group_by` (string): day, week, month, category, shop

**Response:**
```json
{
  "success": true,
  "data": {
    "period": {
      "start": "2025-10-01",
      "end": "2025-10-31"
    },
    "summary": {
      "gross_revenue": 203500000,
      "platform_fees": 20350000,
      "pg_fees": 6105000,
      "refunds": 3500000,
      "net_revenue": 173545000
    },
    "daily_revenue": [
      {
        "date": "2025-10-01",
        "gross_revenue": 6780000,
        "net_revenue": 5780000,
        "transactions": 165
      }
    ],
    "by_category": [
      {
        "category": "nail",
        "revenue": 77600000,
        "percentage": 38.1,
        "transactions": 1940
      },
      {
        "category": "eyelash",
        "revenue": 87300000,
        "percentage": 42.9,
        "transactions": 1455
      }
    ],
    "top_shops": [
      {
        "shop_id": "shop-uuid",
        "shop_name": "네일하우스 강남점",
        "revenue": 3200000,
        "percentage": 1.6,
        "transactions": 85
      }
    ],
    "projections": {
      "next_month_estimate": 218000000,
      "growth_forecast": 7.1
    }
  }
}
```

---

### 7.3 User Analytics

**Endpoint:** `GET /api/admin/analytics/users`

**Description:** User behavior and engagement analytics.

**Query Parameters:**
- `period` (string)
- `segment` (string): new_users, power_users, inactive_users, at_risk_users

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "overview": {
      "total_users": 2450,
      "new_users": 185,
      "active_users": 1200,
      "inactive_users": 1250,
      "churned_users": 45
    },
    "engagement": {
      "average_bookings_per_user": 3.2,
      "average_spend_per_user": 127250,
      "repeat_booking_rate": 68.5,
      "user_satisfaction_score": 4.7
    },
    "user_segments": [
      {
        "segment": "power_users",
        "count": 320,
        "percentage": 13.1,
        "average_bookings": 8.5,
        "total_spend": 52000000
      },
      {
        "segment": "regular_users",
        "count": 880,
        "percentage": 35.9,
        "average_bookings": 3.2,
        "total_spend": 98000000
      },
      {
        "segment": "new_users",
        "count": 185,
        "percentage": 7.6,
        "average_bookings": 1.2,
        "total_spend": 15500000
      },
      {
        "segment": "at_risk_users",
        "count": 420,
        "percentage": 17.1,
        "average_bookings": 0.5,
        "total_spend": 8500000
      }
    ],
    "acquisition": {
      "total_new_users": 185,
      "by_source": {
        "organic_search": 78,
        "social_media": 52,
        "referral": 35,
        "paid_ads": 20
      }
    },
    "retention": {
      "day_1": 85.2,
      "day_7": 68.4,
      "day_30": 45.7,
      "day_90": 32.1
    }
  }
}
```

---

### 7.4 Shop Analytics

**Endpoint:** `GET /api/admin/analytics/shops`

**Description:** Shop performance and behavior analytics.

**Query Parameters:**
- `period` (string)
- `category` (string)
- `region` (string)

**Response:**
```json
{
  "success": true,
  "data": {
    "period": "month",
    "overview": {
      "total_shops": 156,
      "active_shops": 142,
      "new_shops": 8,
      "average_bookings_per_shop": 31.1,
      "average_revenue_per_shop": 1304487
    },
    "performance_distribution": [
      {
        "tier": "top_performers",
        "shop_count": 20,
        "percentage": 12.8,
        "average_revenue": 3200000,
        "average_rating": 4.8
      },
      {
        "tier": "high_performers",
        "shop_count": 45,
        "percentage": 28.8,
        "average_revenue": 1800000,
        "average_rating": 4.6
      },
      {
        "tier": "average_performers",
        "shop_count": 65,
        "percentage": 41.7,
        "average_revenue": 950000,
        "average_rating": 4.4
      },
      {
        "tier": "underperformers",
        "shop_count": 26,
        "percentage": 16.7,
        "average_revenue": 420000,
        "average_rating": 4.1
      }
    ],
    "by_category": [
      {
        "category": "nail",
        "shop_count": 68,
        "average_revenue": 1141176,
        "average_bookings": 28.5
      },
      {
        "category": "eyelash",
        "shop_count": 52,
        "average_revenue": 1678846,
        "average_bookings": 28.0
      }
    ],
    "regional_breakdown": [
      {
        "region": "서울 강남구",
        "shop_count": 45,
        "total_revenue": 58650000,
        "average_rating": 4.7
      },
      {
        "region": "서울 홍대",
        "shop_count": 32,
        "total_revenue": 41728000,
        "average_rating": 4.6
      }
    ]
  }
}
```

---

### 7.5 Export Data

**Endpoint:** `POST /api/admin/analytics/export`

**Description:** Export platform data for external analysis.

**Request:**
```json
{
  "export_type": "full_report",
  "data_types": ["users", "shops", "reservations", "payments"],
  "period": {
    "start": "2025-10-01",
    "end": "2025-10-31"
  },
  "format": "csv",
  "email_to": "admin@ebeautything.com",
  "include_personal_data": false
}
```

**Export Types:**
- `full_report`: Complete platform data
- `financial_report`: Financial data only
- `user_report`: User data and behavior
- `shop_report`: Shop performance data

**Formats:**
- `csv`: CSV files (multiple files zipped)
- `excel`: Excel workbook with multiple sheets
- `json`: JSON format

**Response:**
```json
{
  "success": true,
  "data": {
    "export_id": "export-uuid",
    "status": "processing",
    "estimated_completion": "2025-11-11T18:00:00Z",
    "download_url_expires_at": "2025-11-18T18:00:00Z",
    "message": "Export initiated. You will receive an email when ready."
  }
}
```

---

### 7.6 Download Export

**Endpoint:** `GET /api/admin/analytics/export/:exportId/download`

**Description:** Download completed export file.

**Response:**
```json
{
  "success": true,
  "data": {
    "download_url": "https://storage.example.com/exports/export-uuid.zip",
    "file_size": 15728640,
    "expires_at": "2025-11-18T18:00:00Z"
  }
}
```

---

## 8. Security & Audit

### 8.1 Audit Logs

**Endpoint:** `GET /api/admin/audit/logs`

**Description:** Retrieve audit trail of admin actions.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `action_type` (string): Filter by action type
- `admin_id` (string): Filter by admin user
- `entity_type` (string): user, shop, reservation, payment
- `date_from` (date)
- `date_to` (date)
- `severity` (string): low, medium, high, critical

**Request:**
```
GET /api/admin/audit/logs?page=1&limit=50&action_type=status_change&date_from=2025-11-01
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "timestamp": "2025-11-11T12:30:00Z",
        "admin": {
          "id": "admin-uuid",
          "name": "Admin User",
          "email": "admin@ebeautything.com"
        },
        "action_type": "user_status_change",
        "entity_type": "user",
        "entity_id": "user-uuid",
        "entity_name": "김민수",
        "action_details": {
          "old_status": "active",
          "new_status": "suspended",
          "reason": "사용자 신고 접수"
        },
        "ip_address": "192.168.1.100",
        "user_agent": "Mozilla/5.0...",
        "severity": "high",
        "result": "success"
      },
      {
        "id": "log-uuid-2",
        "timestamp": "2025-11-11T12:00:00Z",
        "admin": {
          "id": "admin-uuid",
          "name": "Admin User",
          "email": "admin@ebeautything.com"
        },
        "action_type": "shop_verification",
        "entity_type": "shop",
        "entity_id": "shop-uuid",
        "entity_name": "네일하우스 강남점",
        "action_details": {
          "action": "approved",
          "notes": "모든 서류 확인 완료"
        },
        "ip_address": "192.168.1.100",
        "severity": "medium",
        "result": "success"
      }
    ],
    "pagination": {
      "current_page": 1,
      "total_items": 1250,
      "total_pages": 25
    }
  }
}
```

**Action Types:**
- `user_status_change`
- `user_role_change`
- `user_delete`
- `shop_verification`
- `shop_status_change`
- `shop_delete`
- `reservation_force_cancel`
- `payment_refund`
- `dispute_created`
- `dispute_resolved`
- `settlement_approved`
- `data_export`

---

### 8.2 Security Events

**Endpoint:** `GET /api/admin/security/events`

**Description:** Monitor security-related events and anomalies.

**Query Parameters:**
- `page` (number)
- `limit` (number)
- `event_type` (string)
- `severity` (string): low, medium, high, critical
- `date_from` (date)
- `date_to` (date)
- `resolved` (boolean): Filter by resolution status

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-uuid",
        "timestamp": "2025-11-11T15:00:00Z",
        "event_type": "failed_login_attempts",
        "severity": "high",
        "details": {
          "user_email": "admin@ebeautything.com",
          "ip_address": "203.0.113.42",
          "attempt_count": 5,
          "last_attempt": "2025-11-11T15:00:00Z"
        },
        "resolved": false,
        "actions_taken": [
          "IP temporarily blocked",
          "Admin user notified"
        ]
      },
      {
        "id": "event-uuid-2",
        "timestamp": "2025-11-11T14:30:00Z",
        "event_type": "unusual_payment_activity",
        "severity": "medium",
        "details": {
          "user_id": "user-uuid",
          "anomaly": "Multiple payment attempts in short period",
          "count": 10,
          "total_amount": 800000
        },
        "resolved": true,
        "resolution": "Verified legitimate user activity"
      }
    ],
    "summary": {
      "total_events": 45,
      "by_severity": {
        "critical": 2,
        "high": 8,
        "medium": 20,
        "low": 15
      },
      "unresolved": 12
    }
  }
}
```

**Event Types:**
- `failed_login_attempts`
- `unusual_payment_activity`
- `suspicious_account_activity`
- `data_breach_attempt`
- `rate_limit_exceeded`
- `unauthorized_access_attempt`
- `unusual_refund_pattern`

---

### 8.3 IP Whitelist Management

**Endpoint:** `GET /api/admin/security/ip-whitelist`

**Description:** Manage IP whitelist for admin access.

**Response:**
```json
{
  "success": true,
  "data": {
    "whitelist": [
      {
        "id": "whitelist-uuid",
        "ip_address": "192.168.1.100",
        "description": "Office IP",
        "added_by": "admin-uuid",
        "added_at": "2025-09-01T00:00:00Z",
        "last_used": "2025-11-11T15:30:00Z"
      },
      {
        "id": "whitelist-uuid-2",
        "ip_address": "203.0.113.10",
        "description": "VPN IP",
        "added_by": "admin-uuid",
        "added_at": "2025-09-01T00:00:00Z",
        "last_used": "2025-11-10T12:00:00Z"
      }
    ]
  }
}
```

---

### 8.4 Add IP to Whitelist

**Endpoint:** `POST /api/admin/security/ip-whitelist`

**Description:** Add new IP to admin access whitelist.

**Request:**
```json
{
  "ip_address": "198.51.100.50",
  "description": "Remote Office IP",
  "expires_at": "2025-12-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "whitelist_entry": {
      "id": "whitelist-uuid-new",
      "ip_address": "198.51.100.50",
      "description": "Remote Office IP",
      "added_at": "2025-11-11T16:00:00Z",
      "expires_at": "2025-12-31T23:59:59Z"
    }
  }
}
```

---

### 8.5 Remove IP from Whitelist

**Endpoint:** `DELETE /api/admin/security/ip-whitelist/:id`

**Description:** Remove IP from whitelist.

**Response:**
```json
{
  "success": true,
  "message": "IP removed from whitelist"
}
```

---

### 8.6 System Configuration

**Endpoint:** `GET /api/admin/system/config`

**Description:** View system configuration settings.

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "platform": {
        "name": "에뷰리띵",
        "environment": "production",
        "version": "1.0.0"
      },
      "features": {
        "user_registration": true,
        "shop_registration": true,
        "payment_processing": true,
        "refund_processing": true,
        "dispute_resolution": true
      },
      "business_rules": {
        "deposit_percentage": 30,
        "cancellation_deadline_hours": 24,
        "platform_fee_percentage": 10,
        "max_reservation_advance_days": 60
      },
      "rate_limits": {
        "user_bookings_per_day": 10,
        "api_requests_per_minute": 100,
        "failed_login_attempts": 5
      },
      "notifications": {
        "email_enabled": true,
        "sms_enabled": true,
        "push_enabled": true
      }
    }
  }
}
```

---

### 8.7 Update System Configuration

**Endpoint:** `PUT /api/admin/system/config`

**Description:** Update system configuration (requires super admin).

**Request:**
```json
{
  "business_rules": {
    "deposit_percentage": 35,
    "platform_fee_percentage": 12
  },
  "reason": "Updated pricing structure for Q4 2025"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "config": {
      "business_rules": {
        "deposit_percentage": 35,
        "platform_fee_percentage": 12
      }
    },
    "updated_at": "2025-11-11T17:00:00Z",
    "updated_by": "admin-uuid"
  },
  "message": "Configuration updated successfully"
}
```

---

## 9. Frontend Integration Guide

### 9.1 Authentication Flow

```typescript
// Login flow
const adminLogin = async (email: string, password: string) => {
  try {
    const response = await axios.post('/api/admin/auth/login', {
      email,
      password
    });

    // Store tokens
    localStorage.setItem('admin_token', response.data.data.token);
    localStorage.setItem('admin_refresh_token', response.data.data.refreshToken);

    // Set default auth header
    axios.defaults.headers.common['Authorization'] =
      `Bearer ${response.data.data.token}`;

    return response.data.data.user;
  } catch (error) {
    handleAuthError(error);
  }
};

// Auto token refresh
axios.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const refreshToken = localStorage.getItem('admin_refresh_token');

      try {
        const response = await axios.post('/api/admin/auth/refresh', {
          refreshToken
        });

        localStorage.setItem('admin_token', response.data.data.token);
        axios.defaults.headers.common['Authorization'] =
          `Bearer ${response.data.data.token}`;

        // Retry original request
        return axios(error.config);
      } catch (refreshError) {
        // Redirect to login
        window.location.href = '/admin/login';
      }
    }

    return Promise.reject(error);
  }
);
```

---

### 9.2 List View with Filters

```typescript
// User management list component
interface UserFilters {
  page: number;
  limit: number;
  role?: string;
  status?: string;
  search?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

const UserList: React.FC = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 20
  });

  const fetchUsers = async () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        params.append(key, value.toString());
      }
    });

    const response = await axios.get(`/api/admin/users?${params}`);
    setUsers(response.data.data.users);
    setPagination(response.data.data.pagination);
  };

  useEffect(() => {
    fetchUsers();
  }, [filters]);

  return (
    <div>
      {/* Filters */}
      <UserFilters filters={filters} onChange={setFilters} />

      {/* Table */}
      <UserTable users={users} />

      {/* Pagination */}
      <Pagination
        pagination={pagination}
        onPageChange={(page) => setFilters({...filters, page})}
      />
    </div>
  );
};
```

---

### 9.3 CRUD Operations

```typescript
// Create user
const createUser = async (userData: CreateUserDto) => {
  try {
    const response = await axios.post('/api/admin/users', userData);

    toast.success('User created successfully');
    return response.data.data.user;
  } catch (error) {
    handleError(error);
  }
};

// Update user
const updateUser = async (userId: string, updates: UpdateUserDto) => {
  try {
    const response = await axios.put(`/api/admin/users/${userId}`, updates);

    toast.success('User updated successfully');
    return response.data.data.user;
  } catch (error) {
    handleError(error);
  }
};

// Delete user
const deleteUser = async (userId: string, hardDelete: boolean = false) => {
  try {
    const confirmed = await confirmDialog(
      'Are you sure you want to delete this user?',
      hardDelete ? 'This action cannot be undone!' : 'User can be restored within 30 days.'
    );

    if (!confirmed) return;

    await axios.delete(`/api/admin/users/${userId}?hard_delete=${hardDelete}`);

    toast.success('User deleted successfully');
  } catch (error) {
    handleError(error);
  }
};
```

---

### 9.4 Real-time Updates

```typescript
// WebSocket connection for real-time updates
import io from 'socket.io-client';

const AdminDashboard: React.FC = () => {
  const [stats, setStats] = useState({});

  useEffect(() => {
    const socket = io('wss://api.ebeautything.com', {
      auth: {
        token: localStorage.getItem('admin_token')
      }
    });

    // Subscribe to real-time events
    socket.on('new_reservation', (data) => {
      toast.info(`New reservation: ${data.shop_name}`);
      updateStats();
    });

    socket.on('new_dispute', (data) => {
      toast.warning(`New dispute case: ${data.reservation_id}`);
      updateStats();
    });

    socket.on('payment_completed', (data) => {
      updateStats();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  return <Dashboard stats={stats} />;
};
```

---

### 9.5 Bulk Actions

```typescript
// Bulk user actions
const bulkUpdateUserStatus = async (
  userIds: string[],
  status: string,
  reason: string
) => {
  try {
    const response = await axios.post('/api/admin/users/bulk', {
      action: 'update_status',
      user_ids: userIds,
      params: {
        status,
        reason
      }
    });

    const { successful, failed } = response.data.data;

    toast.success(`${successful} users updated successfully`);
    if (failed > 0) {
      toast.warning(`${failed} users failed to update`);
    }

    return response.data.data;
  } catch (error) {
    handleError(error);
  }
};

// Usage in component
const handleBulkSuspend = async () => {
  const selectedUserIds = selectedUsers.map(u => u.id);

  const reason = await promptDialog('Enter suspension reason:');
  if (!reason) return;

  await bulkUpdateUserStatus(selectedUserIds, 'suspended', reason);
  refreshUserList();
};
```

---

### 9.6 Error Handling

```typescript
// Centralized error handler
const handleError = (error: any) => {
  if (error.response) {
    const { status, data } = error.response;

    switch (status) {
      case 400:
        toast.error(data.error?.message || 'Invalid request');
        break;
      case 401:
        toast.error('Session expired. Please login again.');
        window.location.href = '/admin/login';
        break;
      case 403:
        toast.error('You do not have permission for this action');
        break;
      case 404:
        toast.error('Resource not found');
        break;
      case 429:
        toast.error('Too many requests. Please try again later.');
        break;
      case 500:
        toast.error('Server error. Please contact support.');
        Sentry.captureException(error);
        break;
      default:
        toast.error('An error occurred');
    }
  } else if (error.request) {
    toast.error('Network error. Please check your connection.');
  } else {
    toast.error('An unexpected error occurred');
    Sentry.captureException(error);
  }
};
```

---

### 9.7 Data Export

```typescript
// Export data with progress tracking
const exportData = async (exportParams: ExportParams) => {
  try {
    // Initiate export
    const response = await axios.post('/api/admin/analytics/export', exportParams);
    const { export_id } = response.data.data;

    toast.info('Export started. You will be notified when ready.');

    // Poll for completion
    const checkInterval = setInterval(async () => {
      const statusResponse = await axios.get(
        `/api/admin/analytics/export/${export_id}/status`
      );

      if (statusResponse.data.data.status === 'completed') {
        clearInterval(checkInterval);

        // Get download URL
        const downloadResponse = await axios.get(
          `/api/admin/analytics/export/${export_id}/download`
        );

        // Trigger download
        window.open(downloadResponse.data.data.download_url, '_blank');
        toast.success('Export ready for download');
      } else if (statusResponse.data.data.status === 'failed') {
        clearInterval(checkInterval);
        toast.error('Export failed. Please try again.');
      }
    }, 5000);

  } catch (error) {
    handleError(error);
  }
};
```

---

## 10. Error Handling

### Standard Error Response Format

All API errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      "field": "specific_field",
      "reason": "validation_failed"
    }
  }
}
```

### Common Error Codes

| Status | Code | Description |
|--------|------|-------------|
| 400 | `INVALID_REQUEST` | Request validation failed |
| 400 | `MISSING_REQUIRED_FIELD` | Required field missing |
| 401 | `UNAUTHORIZED` | Authentication required |
| 401 | `INVALID_TOKEN` | Token expired or invalid |
| 403 | `FORBIDDEN` | Insufficient permissions |
| 403 | `IP_NOT_WHITELISTED` | IP address not authorized |
| 404 | `RESOURCE_NOT_FOUND` | Resource does not exist |
| 409 | `CONFLICT` | Resource conflict (duplicate) |
| 422 | `VALIDATION_ERROR` | Input validation failed |
| 429 | `RATE_LIMIT_EXCEEDED` | Too many requests |
| 500 | `INTERNAL_SERVER_ERROR` | Server error |
| 503 | `SERVICE_UNAVAILABLE` | Service temporarily unavailable |

### Business Logic Error Codes

| Code | Description |
|------|-------------|
| `USER_ALREADY_EXISTS` | Email already registered |
| `SHOP_NOT_VERIFIED` | Shop not yet verified |
| `RESERVATION_ALREADY_CONFIRMED` | Cannot modify confirmed reservation |
| `PAYMENT_ALREADY_PROCESSED` | Payment cannot be modified |
| `INSUFFICIENT_BALANCE` | Insufficient account balance |
| `REFUND_DEADLINE_PASSED` | Refund no longer allowed |
| `DISPUTE_ALREADY_RESOLVED` | Dispute case closed |
| `SETTLEMENT_ALREADY_PROCESSED` | Settlement cannot be modified |

---

## Best Practices

### 1. Authentication & Authorization
- Always include Bearer token in Authorization header
- Implement token refresh before expiry
- Handle 401 errors with automatic login redirect
- Store tokens securely (not in localStorage for production)
- Verify IP whitelist for sensitive operations

### 2. Data Management
- Use pagination for all list endpoints
- Implement client-side caching where appropriate
- Debounce search inputs (300-500ms)
- Batch bulk operations to avoid rate limits
- Always validate user input before API calls

### 3. User Experience
- Show loading states during API calls
- Display success/error toast notifications
- Confirm destructive actions (delete, suspend, ban)
- Provide real-time updates via WebSocket
- Implement optimistic updates for better UX

### 4. Performance
- Lazy load large datasets
- Use virtual scrolling for long lists
- Cache static data (categories, enums)
- Implement infinite scroll for lists
- Minimize API calls with proper state management

### 5. Error Handling
- Centralize error handling logic
- Log errors to monitoring service (Sentry, etc.)
- Provide helpful error messages to users
- Implement retry logic for failed requests
- Handle network errors gracefully

### 6. Security
- Never expose sensitive data in URLs
- Sanitize all user input
- Implement CSRF protection
- Use HTTPS for all requests
- Regularly rotate admin credentials
- Monitor for suspicious activity

### 7. Audit & Compliance
- Log all admin actions for audit trail
- Track who made what changes and when
- Implement data retention policies
- Ensure GDPR/privacy compliance
- Regular security audits

---

## Rate Limits

| Endpoint Category | Limit | Window |
|-------------------|-------|--------|
| Authentication | 10 requests | 15 minutes |
| User Management | 100 requests | 1 minute |
| Shop Management | 100 requests | 1 minute |
| Reservation Management | 200 requests | 1 minute |
| Payment Management | 50 requests | 1 minute |
| Analytics | 50 requests | 1 minute |
| Bulk Operations | 10 requests | 5 minutes |
| Data Export | 5 requests | 1 hour |

Rate limit headers included in all responses:
- `X-RateLimit-Limit`: Maximum requests allowed
- `X-RateLimit-Remaining`: Remaining requests
- `X-RateLimit-Reset`: Unix timestamp when limit resets

---

## Support & Resources

### API Documentation
- **Interactive API Docs**: https://api.ebeautything.com/admin-docs
- **OpenAPI Spec**: https://api.ebeautything.com/api/admin/openapi.json

### Developer Resources
- **GitHub Repository**: https://github.com/ebeautything/backend
- **Developer Portal**: https://developers.ebeautything.com
- **Changelog**: https://developers.ebeautything.com/changelog

### Support Channels
- **Email**: dev-support@ebeautything.com
- **Slack**: #dev-support channel
- **Emergency Hotline**: +82-10-XXXX-XXXX (24/7)

### Monitoring & Status
- **Status Page**: https://status.ebeautything.com
- **Incident Reports**: https://status.ebeautything.com/incidents

---

## Changelog

### Version 1.0.0 (2025-11-11)
- Initial superadmin API documentation
- Complete CRUD operations for all entities
- Advanced filtering and analytics
- Bulk operations support
- Real-time updates via WebSocket
- Comprehensive audit logging

---

**Last Updated:** 2025-11-11
**API Version:** 1.0.0
**Document Version:** 1.0.0
