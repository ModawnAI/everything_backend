# Platform Admin API Guide - Comprehensive Backend Reference

**Document Version**: 1.0
**Last Updated**: 2025-10-13
**Status**: Production Ready

---

## Table of Contents

1. [Overview](#overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Admin Shop Management API](#admin-shop-management-api)
4. [Admin User Management API](#admin-user-management-api)
5. [Admin Payment Management API](#admin-payment-management-api)
6. [Admin Analytics API](#admin-analytics-api)
7. [Error Handling](#error-handling)
8. [Frontend Integration Examples](#frontend-integration-examples)
9. [Security Considerations](#security-considerations)
10. [Testing & Debugging](#testing--debugging)

---

## Overview

This document supplements the [Shop Admin Backend API Guide](./SHOP_ADMIN_BACKEND_API_GUIDE.md) by providing detailed specifications for **Platform Admin APIs** - the powerful administrative endpoints available to super admins for managing the entire platform.

### Key Differences: Platform Admin vs Shop Admin

| Feature | Platform Admin | Shop Admin |
|---------|---------------|------------|
| **Scope** | Entire platform | Single shop only |
| **Authentication** | Admin JWT | Admin JWT + Shop Access Validation |
| **URL Pattern** | `/api/admin/*` | `/api/shops/:shopId/*` |
| **Roles** | `super_admin`, `admin` | `shop_owner`, `shop_manager`, `shop_admin`, `manager` |
| **Access Level** | All shops, all users, system settings | Own shop data only |
| **Rate Limiting** | 100 req/15min | 100 req/15min |
| **IP Whitelisting** | Yes (production) | No |

---

## Authentication & Authorization

### Authentication Flow for Platform Admin APIs

All platform admin endpoints require:
1. **Valid Admin JWT Token** (obtained from `/api/admin/auth/login`)
2. **Platform Admin Role** (`super_admin` or `admin`)
3. **Active Admin Session** (validated on each request)

```typescript
// Headers required for all platform admin requests
{
  "Authorization": "Bearer <admin_jwt_token>",
  "Content-Type": "application/json"
}
```

### Middleware Chain

```
authenticateJWT() → requireAdmin() → [Controller Method]
```

**Important**: Platform admins can access ANY shop's data. Shop access validation is NOT applied to platform admin routes.

---

## Admin Shop Management API

Base Path: `/api/admin/shops`

Platform admins have full control over shop lifecycle: creation, verification, approval, updates, deletion, and analytics.

### 1. Get All Shops

**GET** `/api/admin/shops`

Retrieve all shops with advanced filtering and pagination.

**Query Parameters**:
```typescript
{
  page?: number;           // Default: 1
  limit?: number;          // Default: 20, Max: 100
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  category?: string;       // Main service category
  shopType?: 'partnered' | 'internal' | 'franchise';
  verificationStatus?: 'pending' | 'verified' | 'rejected';
  sortBy?: 'created_at' | 'name' | 'main_category' | 'shop_status' | 'verification_status';
  sortOrder?: 'asc' | 'desc';  // Default: 'desc'
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "Beauty Salon ABC",
        "description": "Premium beauty services",
        "address": "123 Main St, Seoul",
        "detailed_address": "2nd Floor",
        "phone_number": "010-1234-5678",
        "email": "contact@beautysalon.com",
        "main_category": "hair",
        "sub_categories": ["cut", "color", "perm"],
        "shop_type": "partnered",
        "shop_status": "active",
        "verification_status": "verified",
        "commission_rate": 15.0,
        "is_featured": false,
        "created_at": "2025-01-15T10:00:00Z",
        "updated_at": "2025-01-20T14:30:00Z",
        "shop_services": [
          {
            "id": "service-uuid",
            "name": "Premium Haircut",
            "category": "hair",
            "price_min": 30000,
            "price_max": 50000,
            "duration_minutes": 60,
            "is_available": true,
            "display_order": 1
          }
        ],
        "owner": {
          "id": "user-uuid",
          "name": "John Doe",
          "email": "owner@beautysalon.com",
          "phone_number": "010-1234-5678"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "샵 목록을 성공적으로 조회했습니다."
}
```

---

### 2. Get Shop by ID

**GET** `/api/admin/shops/:shopId`

Get complete shop details including services and images.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "Beauty Salon ABC",
    "description": "Premium beauty services",
    "address": "123 Main St, Seoul",
    "detailed_address": "2nd Floor",
    "postal_code": "06000",
    "phone_number": "010-1234-5678",
    "email": "contact@beautysalon.com",
    "main_category": "hair",
    "sub_categories": ["cut", "color", "perm"],
    "operating_hours": {
      "mon": { "open": "09:00", "close": "21:00" },
      "tue": { "open": "09:00", "close": "21:00" }
    },
    "payment_methods": ["card", "cash", "transfer"],
    "kakao_channel_url": "https://pf.kakao.com/_example",
    "business_license_number": "123-45-67890",
    "business_license_image_url": "https://storage.example.com/license.jpg",
    "owner_id": "user-uuid",
    "shop_status": "active",
    "verification_status": "verified",
    "shop_type": "partnered",
    "commission_rate": 15.0,
    "is_featured": false,
    "location": "POINT(126.9780 37.5665)",
    "created_at": "2025-01-15T10:00:00Z",
    "updated_at": "2025-01-20T14:30:00Z",
    "shop_services": [...],
    "shop_images": [
      {
        "id": "image-uuid",
        "image_url": "https://storage.example.com/shop1.jpg",
        "alt_text": "Shop exterior",
        "display_order": 1,
        "is_primary": true
      }
    ]
  }
}
```

---

### 3. Search Shops

**POST** `/api/admin/shops/search`

Advanced search with full-text search across name, description, and address.

**Request Body**:
```json
{
  "page": 1,
  "limit": 20,
  "search": "beauty salon",
  "category": "hair",
  "verificationStatus": "pending",
  "shopStatus": "active",
  "sortBy": "created_at",
  "sortOrder": "desc"
}
```

**Response**: Same as Get All Shops

---

### 4. Get Pending Verification Shops

**GET** `/api/admin/shops/pending`

Retrieve shops awaiting admin verification.

**Query Parameters**:
```typescript
{
  page?: number;
  limit?: number;
  search?: string;      // Search in name, description, address
  category?: string;
  sortBy?: 'created_at' | 'name' | 'main_category';
  sortOrder?: 'asc' | 'desc';
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shops": [...],
    "pagination": {...}
  },
  "message": "승인 대기 중인 샵 목록을 성공적으로 조회했습니다."
}
```

---

### 5. Approve or Reject Shop

**PUT** `/api/admin/shops/:shopId/approve`

Process shop verification - approve or reject pending shops.

**Request Body**:
```json
{
  "approved": true,
  "shopType": "partnered",      // Required if approved: true
  "commissionRate": 15.0,       // Required if approved: true (0-100)
  "notes": "Approved after document verification"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shopId": "shop-uuid",
    "action": "approved",
    "previousStatus": "pending",
    "newStatus": "verified",
    "message": "샵이 성공적으로 승인되었습니다."
  }
}
```

**Rejection Example**:
```json
{
  "approved": false,
  "notes": "Invalid business license document"
}
```

**Rejection Response**:
```json
{
  "success": true,
  "data": {
    "shopId": "shop-uuid",
    "action": "rejected",
    "previousStatus": "pending",
    "newStatus": "rejected",
    "message": "샵이 거부되었습니다."
  }
}
```

---

### 6. Get Shop Verification History

**GET** `/api/admin/shops/:shopId/verification-history`

Retrieve complete verification audit trail for a shop.

**Query Parameters**:
```typescript
{
  page?: number;    // Default: 1
  limit?: number;   // Default: 20
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "actions": [
      {
        "id": "action-uuid",
        "shop_id": "shop-uuid",
        "admin_id": "admin-uuid",
        "action": "approved",
        "previous_status": "pending",
        "new_status": "verified",
        "shop_type": "partnered",
        "commission_rate": 15.0,
        "notes": "Approved after document verification",
        "created_at": "2025-01-20T14:30:00Z",
        "admin": {
          "id": "admin-uuid",
          "email": "admin@example.com",
          "name": "Admin User"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "totalPages": 1
    }
  },
  "message": "샵 인증 이력을 성공적으로 조회했습니다."
}
```

---

### 7. Get Verification Statistics

**GET** `/api/admin/shops/verification-stats`

Get aggregated statistics about shop verifications.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total": 250,
    "pending": 15,
    "verified": 220,
    "rejected": 15,
    "byCategory": {
      "hair": 100,
      "nail": 80,
      "makeup": 70
    },
    "byShopType": {
      "partnered": 200,
      "internal": 30,
      "franchise": 20
    },
    "averageApprovalTime": "2.5 days"
  },
  "message": "샵 인증 통계를 성공적으로 조회했습니다."
}
```

---

### 8. Check Verification Requirements

**GET** `/api/admin/shops/:shopId/verification-requirements`

Check if shop meets all verification requirements.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shopId": "shop-uuid",
    "canBeVerified": true,
    "requirements": {
      "hasBusinessLicense": true,
      "hasValidContact": true,
      "hasServices": true,
      "hasImages": true,
      "hasOperatingHours": true
    },
    "missingRequirements": [],
    "recommendations": [
      "Add more shop images for better visibility"
    ]
  },
  "message": "샵 인증 요구사항을 성공적으로 확인했습니다."
}
```

---

### 9. Create New Shop (Admin Only)

**POST** `/api/admin/shops`

Platform admin can create shops directly (bypasses normal registration flow).

**Request Body**:
```json
{
  "name": "New Beauty Salon",
  "description": "Premium beauty services",
  "address": "123 Main St, Seoul",
  "detailed_address": "2nd Floor",
  "postal_code": "06000",
  "phone_number": "010-1234-5678",
  "email": "contact@newshop.com",
  "main_category": "hair",
  "sub_categories": ["cut", "color"],
  "operating_hours": {
    "mon": { "open": "09:00", "close": "21:00" }
  },
  "payment_methods": ["card", "cash"],
  "kakao_channel_url": "https://pf.kakao.com/_example",
  "business_license_number": "123-45-67890",
  "business_license_image_url": "https://storage.example.com/license.jpg",

  // Admin-specific fields
  "owner_id": "user-uuid",           // Optional, defaults to admin
  "shop_status": "active",           // Optional, default: 'active'
  "verification_status": "verified", // Optional, default: 'verified'
  "shop_type": "partnered",          // Optional, default: 'partnered'
  "commission_rate": 15.0,           // Optional, default: 0
  "is_featured": false,              // Optional, default: false

  // Location (optional)
  "latitude": 37.5665,
  "longitude": 126.9780
}
```

**Response** (201 Created):
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "New Beauty Salon",
    "shop_status": "active",
    "verification_status": "verified",
    "created_at": "2025-01-20T15:00:00Z"
  },
  "message": "샵이 성공적으로 생성되었습니다."
}
```

---

### 10. Update Shop

**PUT** `/api/admin/shops/:shopId`

Update any shop field. Admin can update all fields including status, verification, and commission rate.

**Request Body** (partial updates allowed):
```json
{
  "name": "Updated Shop Name",
  "description": "Updated description",
  "shop_status": "suspended",
  "commission_rate": 20.0,
  "is_featured": true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "Updated Shop Name",
    "updated_at": "2025-01-20T16:00:00Z"
  },
  "message": "샵 정보가 성공적으로 업데이트되었습니다."
}
```

---

### 11. Delete Shop

**DELETE** `/api/admin/shops/:shopId`

Delete shop (soft delete by default, hard delete with query parameter).

**Query Parameters**:
```typescript
{
  permanent?: 'true' | 'false'  // Default: 'false' (soft delete)
}
```

**Soft Delete** (default):
```
DELETE /api/admin/shops/shop-uuid
```
Sets `shop_status` to 'deleted', data remains in database.

**Hard Delete**:
```
DELETE /api/admin/shops/shop-uuid?permanent=true
```
Permanently removes shop from database.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "샵이 성공적으로 삭제되었습니다."
}
```

**Hard Delete Response**:
```json
{
  "success": true,
  "message": "샵이 영구적으로 삭제되었습니다."
}
```

---

### 12. Get Shop Analytics

**GET** `/api/admin/shops/:shopId/analytics`

Get comprehensive analytics for a specific shop.

**Query Parameters**:
```typescript
{
  period?: '7d' | '30d' | '90d'  // Default: '30d'
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "shopInfo": {
      "id": "shop-uuid",
      "name": "Beauty Salon ABC",
      "category": "hair"
    },
    "period": "30d",
    "dateRange": {
      "startDate": "2024-12-20T00:00:00Z",
      "endDate": "2025-01-20T00:00:00Z"
    },
    "services": {
      "total": 15,
      "active": 12,
      "categories": ["cut", "color", "perm"],
      "priceRange": {
        "min": 20000,
        "max": 150000
      }
    },
    "bookings": {
      "total": 250,
      "confirmed": 200,
      "pending": 20,
      "cancelled": 20,
      "completed": 190,
      "revenue": 15000000
    },
    "customers": {
      "total": 150,
      "new": 30,
      "returning": 120,
      "averageBookings": 1.67
    },
    "performance": {
      "averageRating": 4.5,
      "reviewCount": 80,
      "responseRate": 95,
      "utilizationRate": 75
    }
  }
}
```

---

### 13. Validate Data Integrity

**POST** `/api/admin/data-integrity/validate`

Validate data integrity across all analytics tables.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": [],
    "lastValidated": "2025-01-20T16:30:00Z"
  },
  "message": "모든 데이터가 올바른 관계를 유지하고 있습니다."
}
```

**With Issues**:
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "issues": [
      {
        "table": "referral_analytics",
        "type": "orphaned_record",
        "count": 5,
        "description": "Records without valid referrer_id"
      }
    ],
    "lastValidated": "2025-01-20T16:30:00Z"
  },
  "message": "5개의 데이터 무결성 문제가 발견되었습니다."
}
```

---

### 14. Cleanup Orphaned Data

**POST** `/api/admin/data-integrity/cleanup`

Clean up orphaned analytics data.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalCleaned": 25,
    "breakdown": {
      "referral_analytics": 10,
      "payment_analytics": 8,
      "user_analytics": 7
    }
  },
  "message": "25개의 고아 데이터가 정리되었습니다."
}
```

---

### 15. Get Data Integrity Status

**GET** `/api/admin/data-integrity/status`

Get current data integrity status with statistics.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "issues": [],
    "statistics": {
      "totalShops": 250,
      "totalUsers": 5000,
      "totalReservations": 12000,
      "totalPayments": 10000,
      "totalAnalytics": 15000
    },
    "lastChecked": "2025-01-20T16:30:00Z"
  }
}
```

---

## Admin User Management API

Base Path: `/api/admin/users`

Comprehensive user management for platform admins including advanced search, bulk operations, audit logs, and analytics.

### 1. Get Users with Advanced Search

**GET** `/api/admin/users`

Retrieve users with extensive filtering capabilities.

**Query Parameters**:
```typescript
{
  // Search & Filtering
  search?: string;                    // Search in name, email, phone
  role?: 'user' | 'shop_owner' | 'admin' | 'influencer';
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  gender?: 'male' | 'female' | 'other';
  isInfluencer?: boolean;
  phoneVerified?: boolean;

  // Date Ranges
  startDate?: string;                 // Registration date start (ISO 8601)
  endDate?: string;                   // Registration date end
  lastLoginStart?: string;
  lastLoginEnd?: string;

  // Referral & Points
  hasReferrals?: boolean;
  minPoints?: number;
  maxPoints?: number;

  // Sorting & Pagination
  sortBy?: 'created_at' | 'name' | 'email' | 'last_login_at' | 'total_points' | 'total_referrals';
  sortOrder?: 'asc' | 'desc';
  page?: number;                      // Default: 1
  limit?: number;                     // Default: 20, Max: 100
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "phone_number": "010-1234-5678",
        "phone_verified": true,
        "name": "John Doe",
        "nickname": "johnny",
        "gender": "male",
        "birth_date": "1990-01-15",
        "user_role": "user",
        "user_status": "active",
        "is_influencer": false,
        "influencer_qualified_at": null,
        "social_provider": "kakao",
        "referral_code": "JOHN2025",
        "referred_by_code": "FRIEND123",
        "total_points": 5000,
        "available_points": 3000,
        "total_referrals": 10,
        "successful_referrals": 7,
        "last_login_at": "2025-01-20T10:00:00Z",
        "last_login_ip": "1.2.3.4",
        "created_at": "2024-06-15T08:00:00Z",
        "updated_at": "2025-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5000,
      "totalPages": 250
    }
  }
}
```

---

### 2. Get Available User Roles

**GET** `/api/admin/users/roles`

Get list of all available user roles with labels.

**Response** (200 OK):
```json
{
  "success": true,
  "data": [
    { "value": "user", "label": "User" },
    { "value": "shop_owner", "label": "Shop Owner" },
    { "value": "admin", "label": "Admin" },
    { "value": "influencer", "label": "Influencer" }
  ]
}
```

---

### 3. Update User Status

**PUT** `/api/admin/users/:id/status`

Update user account status (activate, suspend, delete).

**Request Body**:
```json
{
  "status": "suspended",
  "reason": "Terms of service violation",
  "adminNotes": "User reported for fraudulent activity",
  "notifyUser": true
}
```

**Valid Statuses**: `active`, `inactive`, `suspended`, `deleted`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "previousStatus": "active",
    "newStatus": "suspended",
    "reason": "Terms of service violation",
    "updatedAt": "2025-01-20T14:30:00Z",
    "updatedBy": "admin-uuid"
  }
}
```

---

### 4. Perform Bulk Actions

**POST** `/api/admin/users/bulk-action`

Perform bulk operations on multiple users.

**Request Body**:
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
  "action": "suspend",
  "reason": "Batch suspension for policy violations",
  "adminNotes": "Q1 2025 compliance review",

  // Optional: For change_role action
  "targetRole": "influencer",

  // Optional: Performance tuning
  "useTransaction": true,
  "batchSize": 50
}
```

**Valid Actions**:
- `activate` - Reactivate users
- `suspend` - Suspend user accounts
- `delete` - Soft delete users
- `export` - Export user data
- `change_role` - Change user role (requires targetRole)

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalRequested": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "userId": "user-uuid-1",
        "status": "success",
        "previousStatus": "active",
        "newStatus": "suspended"
      }
    ],
    "processedAt": "2025-01-20T14:45:00Z",
    "processedBy": "admin-uuid"
  }
}
```

---

### 5. Get User Statistics

**GET** `/api/admin/users/statistics`

Get comprehensive user statistics for admin dashboard.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "total": 5000,
    "byStatus": {
      "active": 4500,
      "inactive": 300,
      "suspended": 150,
      "deleted": 50
    },
    "byRole": {
      "user": 4700,
      "shop_owner": 250,
      "admin": 30,
      "influencer": 20
    },
    "growth": {
      "last7days": 50,
      "last30days": 300,
      "last90days": 1000
    },
    "influencers": {
      "total": 20,
      "active": 18,
      "averageReferrals": 25
    },
    "referrals": {
      "totalReferrals": 8000,
      "successfulReferrals": 6000,
      "conversionRate": 75
    },
    "points": {
      "totalAllocated": 50000000,
      "totalUsed": 30000000,
      "averagePerUser": 10000
    }
  }
}
```

---

### 6. Update User Role

**PUT** `/api/admin/users/:id/role`

Update user role with authorization checks.

**Request Body**:
```json
{
  "role": "influencer",
  "reason": "Qualified as influencer with 20+ referrals",
  "adminNotes": "Approved by admin team"
}
```

**Authorization Rules**:
- Only super admins (`role: 'admin'`) can assign admin role
- Prevents privilege escalation

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "previousRole": "user",
    "newRole": "influencer",
    "reason": "Qualified as influencer with 20+ referrals",
    "updatedAt": "2025-01-20T15:00:00Z",
    "updatedBy": "admin-uuid"
  }
}
```

---

### 7. Get User Activity Feed

**GET** `/api/admin/users/activity`

Get user activity feed for monitoring.

**Query Parameters**:
```typescript
{
  userId?: string;              // Filter by specific user
  activityTypes?: string;       // Comma-separated: 'login,purchase,refund'
  severity?: string;            // Comma-separated: 'low,medium,high'
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;               // Default: 50, Max: 100
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-uuid",
        "user_id": "user-uuid",
        "activity_type": "login",
        "severity": "low",
        "ip_address": "1.2.3.4",
        "user_agent": "Mozilla/5.0...",
        "metadata": {
          "location": "Seoul, Korea",
          "device": "iPhone 14 Pro"
        },
        "created_at": "2025-01-20T10:00:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 1000
    }
  }
}
```

---

### 8. Get Detailed User Information

**GET** `/api/admin/users/:id`

Get comprehensive user details with related data and statistics.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "phoneNumber": "010-1234-5678",
    "phoneVerified": true,
    "name": "John Doe",
    "nickname": "johnny",
    "gender": "male",
    "birthDate": "1990-01-15",
    "userRole": "user",
    "userStatus": "active",
    "isInfluencer": false,
    "influencerQualifiedAt": null,
    "socialProvider": "kakao",
    "referralCode": "JOHN2025",
    "referredByCode": "FRIEND123",
    "totalPoints": 5000,
    "availablePoints": 3000,
    "totalReferrals": 10,
    "successfulReferrals": 7,
    "lastLoginAt": "2025-01-20T10:00:00Z",
    "lastLoginIp": "1.2.3.4",
    "termsAcceptedAt": "2024-06-15T08:00:00Z",
    "privacyAcceptedAt": "2024-06-15T08:00:00Z",
    "marketingConsent": true,
    "createdAt": "2024-06-15T08:00:00Z",
    "updatedAt": "2025-01-20T10:00:00Z",

    "statistics": {
      "totalReservations": 25,
      "completedReservations": 20,
      "totalPointsEarned": 5000,
      "totalPointsUsed": 2000,
      "successfulReferrals": 7,
      "completionRate": 80
    }
  }
}
```

---

### 9. Search Audit Logs

**GET** `/api/admin/users/audit-logs`

Search audit logs with comprehensive filtering.

**Query Parameters**:
```typescript
{
  userId?: string;
  adminId?: string;
  actionTypes?: string;         // Comma-separated
  targetTypes?: string;         // Comma-separated
  categories?: string;          // Comma-separated
  severity?: string;            // Comma-separated
  startDate?: string;
  endDate?: string;
  searchTerm?: string;
  ipAddress?: string;
  sessionId?: string;
  page?: number;
  limit?: number;               // Default: 50, Max: 100
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "log-uuid",
        "user_id": "user-uuid",
        "admin_id": "admin-uuid",
        "action_type": "status_update",
        "target_type": "user",
        "target_id": "user-uuid",
        "category": "user_management",
        "severity": "medium",
        "ip_address": "1.2.3.4",
        "session_id": "session-uuid",
        "metadata": {
          "previousStatus": "active",
          "newStatus": "suspended",
          "reason": "Policy violation"
        },
        "created_at": "2025-01-20T14:30:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 50,
      "total": 500
    }
  }
}
```

---

### 10. Get User Audit Logs

**GET** `/api/admin/users/:userId/audit-logs`

Get audit logs for a specific user.

**Query Parameters**: Same filtering options as Search Audit Logs

**Response**: Same format as Search Audit Logs

---

### 11. Export Audit Logs

**POST** `/api/admin/users/audit-logs/export`

Export audit logs in various formats.

**Request Body**:
```json
{
  "format": "csv",
  "includeMetadata": true,
  "includeAggregations": true,

  // Filters (same as Search Audit Logs)
  "userId": "user-uuid",
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-01-20T23:59:59Z",
  "limit": 1000
}
```

**Supported Formats**: `csv`, `json`, `pdf`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://storage.example.com/exports/audit-logs-20250120.csv",
    "format": "csv",
    "recordCount": 500,
    "fileSize": "2.5 MB",
    "expiresAt": "2025-01-21T16:00:00Z",
    "generatedAt": "2025-01-20T16:00:00Z",
    "generatedBy": "admin-uuid"
  }
}
```

---

### 12. Get User Analytics

**GET** `/api/admin/users/analytics`

Get comprehensive user analytics for admin dashboard.

**Query Parameters**:
```typescript
{
  startDate?: string;
  endDate?: string;
  userSegments?: string;          // Comma-separated
  roles?: string;                 // Comma-separated
  statuses?: string;              // Comma-separated
  platforms?: string;             // Comma-separated
  countries?: string;             // Comma-separated
  includeGrowthTrends?: boolean;
  includeActivityPatterns?: boolean;
  includeBehavioralInsights?: boolean;
  includeRetentionMetrics?: boolean;
  includeGeographicData?: boolean;
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 5000,
      "activeUsers": 4500,
      "newUsers": 300,
      "churnedUsers": 50
    },
    "growthTrends": {
      "daily": [...],
      "weekly": [...],
      "monthly": [...]
    },
    "activityPatterns": {
      "peakHours": [9, 12, 18, 21],
      "peakDays": ["monday", "friday"],
      "averageSessionDuration": 15.5
    },
    "behavioralInsights": {
      "averageBookingsPerUser": 2.5,
      "averageSpendingPerUser": 150000,
      "topCategories": ["hair", "nail", "makeup"]
    },
    "retentionMetrics": {
      "day1": 85,
      "day7": 60,
      "day30": 40
    },
    "geographicData": {
      "byCity": {
        "Seoul": 3000,
        "Busan": 1000,
        "Incheon": 500
      }
    }
  }
}
```

---

### 13. Advanced User Search

**POST** `/api/admin/users/advanced-search`

Advanced user search with segments and complex filters.

**Request Body**:
```json
{
  "email": "user@example.com",
  "name": "John",
  "role": ["user", "influencer"],
  "status": ["active"],
  "segments": ["high_value", "frequent_user"],
  "activityLevel": "active",
  "registrationDateRange": {
    "startDate": "2024-01-01T00:00:00Z",
    "endDate": "2024-12-31T23:59:59Z"
  },
  "lastActivityRange": {
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-01-20T23:59:59Z"
  },
  "referralCount": {
    "min": 10,
    "max": 50
  },
  "lifetimeValue": {
    "min": 500000,
    "max": 5000000
  },
  "platform": ["ios", "android"],
  "country": ["KR"],
  "sortBy": "created_at",
  "sortOrder": "desc",
  "page": 1,
  "limit": 50
}
```

**Response**: Same format as Get Users with Advanced Search

---

## Admin Payment Management API

Base Path: `/api/admin/payments`

Comprehensive payment management including gateway configuration, real-time monitoring, webhook management, fraud detection, disputes, and batch operations.

### 1. Get Gateway Configuration

**GET** `/api/admin/payments/gateway/config`

Get payment gateway configuration and status.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "configuration": {
      "provider": "PortOne",
      "environment": "production",
      "version": "1.0",
      "features": {
        "creditCard": true,
        "bankTransfer": true,
        "virtualAccount": true,
        "mobilePayment": true,
        "internationalCards": true,
        "recurringPayments": true,
        "partialRefunds": true,
        "webhooks": true
      },
      "limits": {
        "maxTransactionAmount": 10000000,
        "minTransactionAmount": 100,
        "dailyTransactionLimit": 100000000,
        "monthlyTransactionLimit": 3000000000
      },
      "fees": {
        "creditCard": 2.9,
        "bankTransfer": 1.5,
        "virtualAccount": 1.0,
        "mobilePayment": 3.2
      },
      "webhookEndpoint": "https://api.example.com/api/webhooks/payments",
      "apiStatus": "operational",
      "lastHealthCheck": "2025-01-20T16:00:00Z"
    },
    "health": {
      "status": "healthy",
      "responseTime": 150,
      "lastCheck": "2025-01-20T16:00:00Z"
    },
    "metadata": {
      "lastUpdated": "2025-01-20T16:00:00Z",
      "retrievedBy": "admin-uuid"
    }
  },
  "message": "게이트웨이 구성 정보를 성공적으로 조회했습니다."
}
```

---

### 2. Test Gateway Connectivity

**POST** `/api/admin/payments/gateway/test`

Test payment gateway connectivity and functionality.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "testResults": {
      "connectivity": true,
      "authentication": true,
      "paymentInitiation": true,
      "webhookDelivery": true,
      "refundCapability": true,
      "responseTime": 245
    },
    "timestamp": "2025-01-20T16:05:00Z",
    "performedBy": "admin-uuid"
  },
  "message": "게이트웨이 테스트를 완료했습니다."
}
```

---

### 3. Get Real-time Payment Monitoring

**GET** `/api/admin/payments/monitoring/realtime`

Get real-time payment monitoring dashboard data.

**Query Parameters**:
```typescript
{
  range?: '1h' | '6h' | '24h' | '7d'  // Default: '1h'
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "metrics": {
      "totalTransactions": 1250,
      "successfulPayments": 1100,
      "failedPayments": 100,
      "pendingPayments": 50,
      "totalVolume": 125000000,
      "averageTransactionValue": 100000,
      "successRate": 88,
      "failureRate": 8
    },
    "velocity": {
      "transactionsPerMinute": 20.83,
      "peakHour": 18,
      "trend": "increasing"
    },
    "recentTransactions": [
      {
        "id": "payment-uuid",
        "amount": 50000,
        "status": "fully_paid",
        "method": "card",
        "createdAt": "2025-01-20T15:55:00Z",
        "userId": "user-uuid",
        "reservationId": "reservation-uuid"
      }
    ],
    "suspiciousActivities": [
      {
        "id": "alert-uuid",
        "paymentId": "payment-uuid",
        "type": "velocity_check",
        "severity": "medium",
        "detectedAt": "2025-01-20T15:50:00Z"
      }
    ],
    "timeRange": "1h",
    "lastUpdated": "2025-01-20T16:00:00Z"
  },
  "message": "실시간 모니터링 데이터를 조회했습니다."
}
```

---

### 4. Get Webhook History

**GET** `/api/admin/payments/webhooks`

Get webhook history and status.

**Query Parameters**:
```typescript
{
  status?: 'pending' | 'processed' | 'failed' | 'retried';
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;        // Default: 50
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "webhooks": [
      {
        "id": "webhook-uuid",
        "payment_id": "payment-uuid",
        "event_type": "payment.completed",
        "status": "processed",
        "payload": {...},
        "response_code": 200,
        "response_body": "OK",
        "retry_count": 0,
        "received_at": "2025-01-20T15:45:00Z",
        "processed_at": "2025-01-20T15:45:01Z"
      }
    ],
    "statistics": {
      "total": 1500,
      "successful": 1450,
      "failed": 30,
      "pending": 10,
      "retried": 10
    },
    "pagination": {
      "total": 1500,
      "page": 1,
      "limit": 50,
      "totalPages": 30
    }
  },
  "message": "웹훅 히스토리를 조회했습니다."
}
```

---

### 5. Retry Failed Webhook

**POST** `/api/admin/payments/webhooks/:webhookId/retry`

Retry a failed webhook.

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "webhookId": "webhook-uuid",
    "retryResult": {
      "success": true,
      "statusCode": 200,
      "responseTime": 150
    },
    "retriedBy": "admin-uuid",
    "retriedAt": "2025-01-20T16:10:00Z"
  },
  "message": "웹훅 재시도를 완료했습니다."
}
```

---

### 6. Get Fraud Detection Alerts

**GET** `/api/admin/payments/fraud`

Get fraud detection alerts and statistics.

**Query Parameters**:
```typescript
{
  severity?: 'low' | 'medium' | 'high';
  status?: 'pending' | 'investigated' | 'resolved' | 'false_positive';
  startDate?: string;
  endDate?: string;
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "payment_id": "payment-uuid",
        "user_id": "user-uuid",
        "alert_type": "velocity_check",
        "severity": "high",
        "status": "pending",
        "risk_score": 85,
        "reason": "Multiple transactions from different locations",
        "detected_at": "2025-01-20T15:30:00Z",
        "payments": {
          "id": "payment-uuid",
          "amount": 500000,
          "status": "pending"
        }
      }
    ],
    "statistics": {
      "totalAlerts": 50,
      "pendingAlerts": 15,
      "resolvedAlerts": 30,
      "falsePositives": 5,
      "blockedTransactions": 10,
      "savedAmount": 5000000
    },
    "riskLevels": {
      "high": 10,
      "medium": 25,
      "low": 15
    },
    "lastUpdated": "2025-01-20T16:00:00Z"
  },
  "message": "사기 탐지 알림을 조회했습니다."
}
```

---

### 7. Handle Fraud Alert

**POST** `/api/admin/payments/fraud/:alertId/action`

Take action on a fraud alert.

**Request Body**:
```json
{
  "action": "block_payment",
  "notes": "Confirmed fraudulent activity - multiple stolen cards"
}
```

**Valid Actions**:
- `block_payment` - Block the payment
- `block_user` - Suspend user account
- `allow` - Allow payment (false positive)
- `investigate` - Mark for further investigation
- `refund` - Issue refund

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "alertId": "alert-uuid",
    "action": "block_payment",
    "result": {
      "paymentBlocked": true,
      "userNotified": true,
      "refundInitiated": false
    },
    "processedBy": "admin-uuid",
    "processedAt": "2025-01-20T16:15:00Z"
  },
  "message": "사기 알림 처리를 완료했습니다."
}
```

---

### 8. Get Payment Disputes

**GET** `/api/admin/payments/disputes`

Get payment disputes and chargebacks.

**Query Parameters**:
```typescript
{
  status?: 'open' | 'resolved' | 'lost' | 'contested';
  type?: 'chargeback' | 'dispute' | 'inquiry';
  startDate?: string;
  endDate?: string;
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "disputes": [
      {
        "id": "dispute-uuid",
        "payment_id": "payment-uuid",
        "user_id": "user-uuid",
        "dispute_type": "chargeback",
        "dispute_status": "open",
        "dispute_reason": "Service not provided",
        "dispute_amount": 100000,
        "evidence_deadline": "2025-01-25T23:59:59Z",
        "created_at": "2025-01-18T10:00:00Z",
        "payments": {
          "id": "payment-uuid",
          "amount": 100000,
          "status": "disputed"
        }
      }
    ],
    "metrics": {
      "total": 25,
      "open": 10,
      "resolved": 12,
      "lost": 3,
      "totalAmount": 2500000
    },
    "lastUpdated": "2025-01-20T16:00:00Z"
  },
  "message": "분쟁 내역을 조회했습니다."
}
```

---

### 9. Respond to Dispute

**POST** `/api/admin/payments/disputes/:disputeId/respond`

Respond to a payment dispute.

**Request Body**:
```json
{
  "response": "Service was provided as agreed. Attaching proof.",
  "evidence": {
    "serviceReceipt": "https://storage.example.com/receipt.pdf",
    "customerSignature": "https://storage.example.com/signature.jpg",
    "photos": ["https://storage.example.com/photo1.jpg"]
  },
  "action": "contest"
}
```

**Valid Actions**:
- `accept` - Accept dispute and issue refund
- `contest` - Contest dispute with evidence

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "disputeId": "dispute-uuid",
    "action": "contest",
    "dispute": {
      "id": "dispute-uuid",
      "dispute_status": "contested",
      "admin_response": "Service was provided as agreed. Attaching proof.",
      "responded_by": "admin-uuid",
      "responded_at": "2025-01-20T16:20:00Z"
    },
    "respondedBy": "admin-uuid",
    "respondedAt": "2025-01-20T16:20:00Z"
  },
  "message": "분쟁 응답을 처리했습니다."
}
```

---

### 10. Process Batch Refunds

**POST** `/api/admin/payments/batch/refund`

Process refunds for multiple payments.

**Request Body**:
```json
{
  "paymentIds": ["payment-uuid-1", "payment-uuid-2", "payment-uuid-3"],
  "reason": "Event cancellation - full refund",
  "refundMethod": "original"
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalProcessed": 3,
    "successCount": 3,
    "failCount": 0,
    "results": [
      {
        "paymentId": "payment-uuid-1",
        "status": "success",
        "refundAmount": 50000
      },
      {
        "paymentId": "payment-uuid-2",
        "status": "success",
        "refundAmount": 75000
      },
      {
        "paymentId": "payment-uuid-3",
        "status": "success",
        "refundAmount": 100000
      }
    ]
  },
  "message": "일괄 환불 처리 완료: 성공 3건, 실패 0건"
}
```

---

### 11. Batch Update Payment Status

**POST** `/api/admin/payments/batch/update-status`

Batch update payment statuses.

**Request Body**:
```json
{
  "paymentIds": ["payment-uuid-1", "payment-uuid-2"],
  "newStatus": "cancelled",
  "reason": "Administrative cancellation"
}
```

**Valid Statuses**: `pending`, `fully_paid`, `deposit_paid`, `failed`, `cancelled`, `refunded`

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "totalRequested": 2,
    "totalUpdated": 2,
    "updatedPayments": [
      {
        "id": "payment-uuid-1",
        "payment_status": "cancelled",
        "updated_at": "2025-01-20T16:25:00Z"
      },
      {
        "id": "payment-uuid-2",
        "payment_status": "cancelled",
        "updated_at": "2025-01-20T16:25:00Z"
      }
    ]
  },
  "message": "2건의 결제 상태를 업데이트했습니다."
}
```

---

### 12. Get Reconciliation Report

**GET** `/api/admin/payments/reconciliation`

Get payment reconciliation report.

**Query Parameters**:
```typescript
{
  startDate?: string;  // Default: 30 days ago
  endDate?: string;    // Default: now
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "data": {
    "reconciliation": {
      "totalTransactions": 1500,
      "totalExpectedAmount": 150000000,
      "totalReceivedAmount": 148000000,
      "totalRefundedAmount": 5000000,
      "pendingSettlements": 50,
      "completedSettlements": 1450,
      "discrepancies": [
        {
          "paymentId": "payment-uuid",
          "type": "missing_payment_date",
          "amount": 50000,
          "details": {...}
        }
      ]
    },
    "dateRange": {
      "start": "2024-12-20T00:00:00Z",
      "end": "2025-01-20T23:59:59Z"
    },
    "generatedAt": "2025-01-20T16:30:00Z",
    "generatedBy": "admin-uuid"
  },
  "message": "정산 보고서를 생성했습니다."
}
```

---

## Admin Analytics API

Base Path: `/api/admin/analytics`

Comprehensive analytics dashboard endpoints including real-time metrics, exports, and cache management.

### 1. Get Dashboard Metrics

**GET** `/api/admin/analytics/dashboard`

Get comprehensive dashboard metrics with real-time data.

**Query Parameters**:
```typescript
{
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
  category?: string;
  shopId?: string;
  userId?: string;
  includeCache?: boolean;  // Default: true
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "대시보드 메트릭을 성공적으로 조회했습니다.",
  "data": {
    "userGrowth": {
      "totalUsers": 5000,
      "newUsers": 300,
      "activeUsers": 4500,
      "churnRate": 2.5,
      "growthRate": 6.4
    },
    "revenue": {
      "totalRevenue": 500000000,
      "avgRevenuePerUser": 100000,
      "topCategory": "hair",
      "revenueByCategory": {
        "hair": 250000000,
        "nail": 150000000,
        "makeup": 100000000
      }
    },
    "reservations": {
      "totalReservations": 12000,
      "completedReservations": 10000,
      "cancelledReservations": 1500,
      "noShowRate": 4.2,
      "completionRate": 83.3
    },
    "payments": {
      "totalTransactions": 11000,
      "successfulTransactions": 10000,
      "failedTransactions": 500,
      "averageTransactionValue": 90909,
      "successRate": 90.9
    },
    "shops": {
      "totalShops": 250,
      "activeShops": 220,
      "pendingVerification": 15,
      "topPerformingShops": [...]
    },
    "trends": {
      "daily": [...],
      "weekly": [...],
      "monthly": [...]
    }
  },
  "timestamp": "2025-01-20T16:00:00Z"
}
```

---

### 2. Get Real-time Metrics

**GET** `/api/admin/analytics/realtime`

Get real-time metrics for live dashboard updates.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "실시간 메트릭을 성공적으로 조회했습니다.",
  "data": {
    "currentActiveUsers": 350,
    "activeReservations": 45,
    "pendingPayments": 12,
    "recentSignups": 8,
    "liveTransactions": {
      "count": 25,
      "totalValue": 2500000,
      "averageValue": 100000
    },
    "systemHealth": {
      "apiResponseTime": 150,
      "databaseLatency": 50,
      "cacheHitRate": 85
    }
  },
  "timestamp": "2025-01-20T16:35:00Z"
}
```

---

### 3. Export Analytics

**GET** `/api/admin/analytics/export`

Export analytics data in various formats.

**Query Parameters**:
```typescript
{
  // Date Range
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';

  // Filters
  category?: string;
  shopId?: string;
  userId?: string;

  // Export Options
  format?: 'csv' | 'json' | 'excel';  // Default: 'csv'
  includeCharts?: boolean;            // Default: false
  includeTrends?: boolean;            // Default: false
}
```

**Response Headers**:
```
Content-Type: text/csv; charset=utf-8
Content-Disposition: attachment; filename="analytics_export_2025-01-20.csv"
Content-Length: 1048576
```

**Response Body** (CSV format):
```csv
Date,Total Users,New Users,Revenue,Reservations
2025-01-01,4700,50,15000000,400
2025-01-02,4750,50,16000000,420
...
```

---

### 4. Get Cache Statistics

**GET** `/api/admin/analytics/cache/stats`

Get cache statistics for performance monitoring.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "캐시 통계를 성공적으로 조회했습니다.",
  "data": {
    "size": 256,
    "maxSize": 500,
    "hitRate": 85.5,
    "missRate": 14.5,
    "avgGetTime": 5,
    "oldestEntry": "2025-01-20T10:00:00Z",
    "newestEntry": "2025-01-20T16:30:00Z"
  },
  "timestamp": "2025-01-20T16:40:00Z"
}
```

---

### 5. Clear Analytics Cache

**POST** `/api/admin/analytics/cache/clear`

Clear analytics cache to force fresh data retrieval.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "분석 캐시를 성공적으로 초기화했습니다.",
  "timestamp": "2025-01-20T16:45:00Z"
}
```

---

### 6. Get Analytics System Health

**GET** `/api/admin/analytics/health`

Get analytics system health status.

**Response** (200 OK):
```json
{
  "success": true,
  "message": "분석 시스템 상태를 성공적으로 조회했습니다.",
  "data": {
    "status": "healthy",
    "timestamp": "2025-01-20T16:50:00Z",
    "metrics": {
      "hasUserData": true,
      "hasRevenueData": true,
      "hasReservationData": true,
      "hasPaymentData": true
    },
    "cache": {
      "size": 256,
      "isOperational": true
    },
    "performance": {
      "responseTime": "fast",
      "dataFreshness": "current"
    }
  },
  "timestamp": "2025-01-20T16:50:00Z"
}
```

---

### 7. Get Shop-Specific Analytics

**GET** `/api/admin/shops/:shopId/analytics`

Get detailed analytics for a specific shop.

**Query Parameters**:
```typescript
{
  startDate?: string;
  endDate?: string;
  period?: 'day' | 'week' | 'month' | 'quarter' | 'year';
}
```

**Response** (200 OK):
```json
{
  "success": true,
  "message": "샵 분석 데이터를 성공적으로 조회했습니다.",
  "data": {
    "shopInfo": {
      "id": "shop-uuid",
      "name": "Beauty Salon ABC",
      "category": "hair"
    },
    "performance": {
      "totalRevenue": 50000000,
      "totalReservations": 500,
      "completionRate": 85,
      "averageRating": 4.5
    },
    "services": {
      "mostPopular": "Premium Haircut",
      "highestRevenue": "Hair Coloring",
      "averageServiceDuration": 60
    },
    "customers": {
      "totalCustomers": 300,
      "returningCustomerRate": 60,
      "averageSpendPerCustomer": 166667
    },
    "trends": {
      "daily": [...],
      "weekly": [...],
      "monthly": [...]
    }
  },
  "timestamp": "2025-01-20T17:00:00Z"
}
```

---

## Error Handling

### Standard Error Response Format

All platform admin APIs use a consistent error response format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "사용자 친화적 에러 메시지",
    "details": "기술적 세부 정보 (선택적)",
    "timestamp": "2025-01-20T17:00:00Z"
  }
}
```

### Common Error Codes

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Admin authentication required |
| `FORBIDDEN` | 403 | Insufficient admin privileges |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request parameters |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |

### Authentication Errors

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "관리자 인증이 필요합니다.",
    "timestamp": "2025-01-20T17:00:00Z"
  }
}
```

### Authorization Errors

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "이 작업을 수행할 권한이 없습니다.",
    "details": "Super admin privileges required",
    "timestamp": "2025-01-20T17:00:00Z"
  }
}
```

### Validation Errors

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "유효하지 않은 요청입니다.",
    "details": {
      "field": "shopType",
      "message": "shopType is required when approved is true"
    },
    "timestamp": "2025-01-20T17:00:00Z"
  }
}
```

---

## Frontend Integration Examples

### TypeScript Admin API Client

```typescript
// src/services/adminApi.ts
import axios, { AxiosInstance, AxiosError } from 'axios';

interface AdminApiConfig {
  baseURL: string;
  timeout?: number;
}

interface AdminApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
    timestamp: string;
  };
}

class AdminApiClient {
  private client: AxiosInstance;
  private token: string | null = null;

  constructor(config: AdminApiConfig) {
    this.client = axios.create({
      baseURL: config.baseURL,
      timeout: config.timeout || 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Request interceptor for adding auth token
    this.client.interceptors.request.use(
      (config) => {
        if (this.token) {
          config.headers.Authorization = `Bearer ${this.token}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor for handling errors
    this.client.interceptors.response.use(
      (response) => response.data,
      async (error: AxiosError<AdminApiResponse>) => {
        if (error.response?.status === 401) {
          // Token expired or invalid - redirect to login
          this.clearToken();
          window.location.href = '/admin/login';
        }
        return Promise.reject(error.response?.data || error);
      }
    );
  }

  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('admin_token', token);
  }

  clearToken(): void {
    this.token = null;
    localStorage.removeItem('admin_token');
  }

  loadToken(): void {
    const token = localStorage.getItem('admin_token');
    if (token) {
      this.token = token;
    }
  }

  // Shop Management
  async getAllShops(params?: {
    page?: number;
    limit?: number;
    status?: string;
    category?: string;
    shopType?: string;
    verificationStatus?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<AdminApiResponse> {
    return this.client.get('/admin/shops', { params });
  }

  async getShopById(shopId: string): Promise<AdminApiResponse> {
    return this.client.get(`/admin/shops/${shopId}`);
  }

  async searchShops(data: {
    page?: number;
    limit?: number;
    search?: string;
    category?: string;
    verificationStatus?: string;
    shopStatus?: string;
    sortBy?: string;
    sortOrder?: string;
  }): Promise<AdminApiResponse> {
    return this.client.post('/admin/shops/search', data);
  }

  async approveShop(
    shopId: string,
    data: {
      approved: boolean;
      shopType?: string;
      commissionRate?: number;
      notes?: string;
    }
  ): Promise<AdminApiResponse> {
    return this.client.put(`/admin/shops/${shopId}/approve`, data);
  }

  async createShop(data: any): Promise<AdminApiResponse> {
    return this.client.post('/admin/shops', data);
  }

  async updateShop(shopId: string, data: any): Promise<AdminApiResponse> {
    return this.client.put(`/admin/shops/${shopId}`, data);
  }

  async deleteShop(shopId: string, permanent: boolean = false): Promise<AdminApiResponse> {
    return this.client.delete(`/admin/shops/${shopId}`, {
      params: { permanent: permanent.toString() },
    });
  }

  // User Management
  async getUsers(params?: {
    search?: string;
    role?: string;
    status?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminApiResponse> {
    return this.client.get('/admin/users', { params });
  }

  async getUserDetails(userId: string): Promise<AdminApiResponse> {
    return this.client.get(`/admin/users/${userId}`);
  }

  async updateUserStatus(
    userId: string,
    data: {
      status: string;
      reason?: string;
      adminNotes?: string;
      notifyUser?: boolean;
    }
  ): Promise<AdminApiResponse> {
    return this.client.put(`/admin/users/${userId}/status`, data);
  }

  async performBulkAction(data: {
    userIds: string[];
    action: string;
    reason?: string;
    adminNotes?: string;
    targetRole?: string;
  }): Promise<AdminApiResponse> {
    return this.client.post('/admin/users/bulk-action', data);
  }

  async getUserStatistics(): Promise<AdminApiResponse> {
    return this.client.get('/admin/users/statistics');
  }

  // Payment Management
  async getGatewayConfig(): Promise<AdminApiResponse> {
    return this.client.get('/admin/payments/gateway/config');
  }

  async testGateway(): Promise<AdminApiResponse> {
    return this.client.post('/admin/payments/gateway/test');
  }

  async getRealtimeMonitoring(range: string = '1h'): Promise<AdminApiResponse> {
    return this.client.get('/admin/payments/monitoring/realtime', {
      params: { range },
    });
  }

  async getWebhooks(params?: {
    status?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<AdminApiResponse> {
    return this.client.get('/admin/payments/webhooks', { params });
  }

  async getFraudAlerts(params?: {
    severity?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<AdminApiResponse> {
    return this.client.get('/admin/payments/fraud', { params });
  }

  async handleFraudAlert(
    alertId: string,
    data: { action: string; notes?: string }
  ): Promise<AdminApiResponse> {
    return this.client.post(`/admin/payments/fraud/${alertId}/action`, data);
  }

  async processBatchRefund(data: {
    paymentIds: string[];
    reason: string;
    refundMethod?: string;
  }): Promise<AdminApiResponse> {
    return this.client.post('/admin/payments/batch/refund', data);
  }

  // Analytics
  async getDashboardMetrics(params?: {
    startDate?: string;
    endDate?: string;
    period?: string;
    category?: string;
    shopId?: string;
  }): Promise<AdminApiResponse> {
    return this.client.get('/admin/analytics/dashboard', { params });
  }

  async getRealTimeMetrics(): Promise<AdminApiResponse> {
    return this.client.get('/admin/analytics/realtime');
  }

  async exportAnalytics(params?: {
    format?: 'csv' | 'json' | 'excel';
    startDate?: string;
    endDate?: string;
    includeCharts?: boolean;
    includeTrends?: boolean;
  }): Promise<Blob> {
    const response = await this.client.get('/admin/analytics/export', {
      params,
      responseType: 'blob',
    });
    return response as unknown as Blob;
  }

  async clearAnalyticsCache(): Promise<AdminApiResponse> {
    return this.client.post('/admin/analytics/cache/clear');
  }
}

// Export singleton instance
export const adminApi = new AdminApiClient({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api',
});

// Load token on initialization
adminApi.loadToken();
```

---

### React Admin Shop Management Example

```typescript
// src/pages/admin/shops/ShopManagement.tsx
import React, { useState, useEffect } from 'react';
import { adminApi } from '../../../services/adminApi';

interface Shop {
  id: string;
  name: string;
  shop_status: string;
  verification_status: string;
  main_category: string;
  created_at: string;
}

export const ShopManagement: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
  });
  const [filters, setFilters] = useState({
    status: '',
    verificationStatus: '',
    search: '',
  });

  useEffect(() => {
    loadShops();
  }, [pagination.page, filters]);

  const loadShops = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getAllShops({
        page: pagination.page,
        limit: pagination.limit,
        status: filters.status,
        verificationStatus: filters.verificationStatus,
      });

      if (response.success && response.data) {
        setShops(response.data.shops);
        setPagination((prev) => ({
          ...prev,
          total: response.data.pagination.total,
        }));
      }
    } catch (error) {
      console.error('Failed to load shops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (shopId: string) => {
    try {
      const response = await adminApi.approveShop(shopId, {
        approved: true,
        shopType: 'partnered',
        commissionRate: 15.0,
        notes: 'Approved after verification',
      });

      if (response.success) {
        alert('Shop approved successfully!');
        loadShops();
      }
    } catch (error) {
      console.error('Failed to approve shop:', error);
      alert('Failed to approve shop');
    }
  };

  const handleReject = async (shopId: string) => {
    const notes = prompt('Enter rejection reason:');
    if (!notes) return;

    try {
      const response = await adminApi.approveShop(shopId, {
        approved: false,
        notes,
      });

      if (response.success) {
        alert('Shop rejected successfully!');
        loadShops();
      }
    } catch (error) {
      console.error('Failed to reject shop:', error);
      alert('Failed to reject shop');
    }
  };

  return (
    <div className="shop-management">
      <h1>Shop Management</h1>

      {/* Filters */}
      <div className="filters">
        <select
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>

        <select
          value={filters.verificationStatus}
          onChange={(e) =>
            setFilters({ ...filters, verificationStatus: e.target.value })
          }
        >
          <option value="">All Verification</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {/* Shop List */}
      {loading ? (
        <div>Loading...</div>
      ) : (
        <table className="shops-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Status</th>
              <th>Verification</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id}>
                <td>{shop.name}</td>
                <td>{shop.main_category}</td>
                <td>{shop.shop_status}</td>
                <td>{shop.verification_status}</td>
                <td>{new Date(shop.created_at).toLocaleDateString()}</td>
                <td>
                  {shop.verification_status === 'pending' && (
                    <>
                      <button onClick={() => handleApprove(shop.id)}>
                        Approve
                      </button>
                      <button onClick={() => handleReject(shop.id)}>
                        Reject
                      </button>
                    </>
                  )}
                  <button onClick={() => viewShop(shop.id)}>View</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Pagination */}
      <div className="pagination">
        <button
          disabled={pagination.page === 1}
          onClick={() =>
            setPagination({ ...pagination, page: pagination.page - 1 })
          }
        >
          Previous
        </button>
        <span>
          Page {pagination.page} of{' '}
          {Math.ceil(pagination.total / pagination.limit)}
        </span>
        <button
          disabled={
            pagination.page >= Math.ceil(pagination.total / pagination.limit)
          }
          onClick={() =>
            setPagination({ ...pagination, page: pagination.page + 1 })
          }
        >
          Next
        </button>
      </div>
    </div>
  );
};

function viewShop(id: string) {
  window.location.href = `/admin/shops/${id}`;
}
```

---

## Security Considerations

### 1. IP Whitelisting (Production Only)

Platform admin routes are IP-whitelisted in production environments:

```typescript
// Admin routes require IP whitelisting in production
// Localhost (127.0.0.1, ::1) and Docker containers (172.17.0.0/16) always allowed
// Additional IPs configured via ADMIN_ALLOWED_IPS environment variable
```

**Configuration**:
```env
ADMIN_ALLOWED_IPS=1.2.3.4,5.6.7.8
```

### 2. Admin Session Management

- **Session Duration**: 24 hours (access token)
- **Refresh Token**: 7 days
- **Device Fingerprinting**: Each session tracked with device info
- **Concurrent Session Limit**: 5 active sessions per admin
- **Automatic Logout**: On suspicious activity or token expiration

### 3. Rate Limiting

All admin endpoints are rate-limited:
- **Limit**: 100 requests per 15 minutes per IP
- **Burst Allowance**: 120 requests per 15 minutes
- **Penalty**: 1-hour temporary block on repeated violations

### 4. Audit Logging

All admin actions are logged:
- **What**: Action type, target resource, before/after state
- **Who**: Admin ID, IP address, device info
- **When**: Timestamp with timezone
- **Why**: Reason and notes (if provided)

Example audit log entry:
```json
{
  "id": "log-uuid",
  "admin_id": "admin-uuid",
  "action_type": "shop_approval",
  "target_type": "shop",
  "target_id": "shop-uuid",
  "metadata": {
    "previousStatus": "pending",
    "newStatus": "verified",
    "shopType": "partnered",
    "commissionRate": 15.0,
    "notes": "Approved after verification"
  },
  "ip_address": "1.2.3.4",
  "created_at": "2025-01-20T14:30:00Z"
}
```

### 5. Permission Hierarchy

| Action | Super Admin | Admin |
|--------|-------------|-------|
| View all shops | ✅ | ✅ |
| Approve/reject shops | ✅ | ✅ |
| Create shops | ✅ | ✅ |
| Delete shops (soft) | ✅ | ✅ |
| Delete shops (hard) | ✅ | ❌ |
| Assign admin role | ✅ | ❌ |
| View audit logs | ✅ | ✅ |
| Manage gateway config | ✅ | ❌ |

---

## Testing & Debugging

### 1. API Testing with cURL

**Get All Shops**:
```bash
curl -X GET "http://localhost:3001/api/admin/shops?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json"
```

**Approve Shop**:
```bash
curl -X PUT "http://localhost:3001/api/admin/shops/SHOP_UUID/approve" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "approved": true,
    "shopType": "partnered",
    "commissionRate": 15.0,
    "notes": "Approved after verification"
  }'
```

**Update User Status**:
```bash
curl -X PUT "http://localhost:3001/api/admin/users/USER_UUID/status" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "suspended",
    "reason": "Policy violation",
    "notifyUser": true
  }'
```

**Get Real-time Payment Monitoring**:
```bash
curl -X GET "http://localhost:3001/api/admin/payments/monitoring/realtime?range=1h" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN"
```

**Export Analytics**:
```bash
curl -X GET "http://localhost:3001/api/admin/analytics/export?format=csv&startDate=2025-01-01&endDate=2025-01-20" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  --output analytics_export.csv
```

### 2. Development Server Logs

All admin operations are logged in development mode:

```bash
npm run dev

# Watch logs
tail -f logs/admin-operations.log
```

Log format:
```
[2025-01-20T14:30:00Z] INFO: Admin action
  adminId: admin-uuid
  action: shop_approval
  targetId: shop-uuid
  result: success
  duration: 245ms
```

### 3. Common Issues & Solutions

**Issue**: 401 Unauthorized
```
Solution: Check if admin JWT token is valid and not expired
- Verify token in localStorage/sessionStorage
- Check token expiration with jwt.io
- Re-login if token expired
```

**Issue**: 403 Forbidden
```
Solution: Verify admin role permissions
- Super admin required for certain operations (hard delete, assign admin role)
- Check user role in JWT token payload
```

**Issue**: Rate limit exceeded
```
Solution: Wait and reduce request frequency
- Default limit: 100 req/15min
- Implement exponential backoff
- Cache responses when possible
```

**Issue**: Empty response data
```
Solution: Check query parameters and filters
- Verify date ranges are valid
- Check filter values match enum types
- Ensure shopId/userId exists in database
```

---

## Related Documentation

- [Shop Admin Backend API Guide](./SHOP_ADMIN_BACKEND_API_GUIDE.md) - Shop-scoped admin APIs
- [API Transformation Implementation](./API_TRANSFORMATION_IMPLEMENTATION.md) - API design patterns
- [Backend Frontend Schema Alignment](./BACKEND_FRONTEND_SCHEMA_ALIGNMENT.md) - Data structure specifications

---

**Document End**
