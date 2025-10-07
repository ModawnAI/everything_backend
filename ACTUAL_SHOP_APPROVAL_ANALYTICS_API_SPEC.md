# Shop Approval & Analytics - Backend API Specification

## Overview

This document specifies **exactly** how the backend provides data for Shop Approval and Shop Analytics features. All field names use **snake_case** (matching the shops API pattern).

**Important**: The frontend will transform snake_case → camelCase at the service layer, just like the main shops API.

---

## 🔐 Shop Approval API

### Base Path: `/api/admin/shops/approval`

**Authentication**: All endpoints require admin JWT token with appropriate permissions.

---

### 1. GET `/api/admin/shops/approval` - Get Approval Queue

**Description**: Fetch all shops pending approval with filtering support.

#### Query Parameters

```typescript
{
  page?: number;                    // Default: 1
  limit?: number;                   // Default: 20
  status?: 'pending_approval' | 'in_review' | 'approved' | 'rejected';
  verification_status?: 'pending' | 'verified' | 'rejected';
  main_category?: string;           // Filter by category
  shop_type?: 'partnered' | 'non_partnered';
  priority?: 'high' | 'medium' | 'low';
  assigned_reviewer_id?: string;    // Filter by assigned reviewer
  sort_by?: 'created_at' | 'updated_at' | 'shop_name' | 'priority';
  sort_order?: 'asc' | 'desc';
  search?: string;                  // Search shop name/owner
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "approval_requests": [
      {
        "id": "uuid",
        "shop_id": "uuid",
        "shop_name": "Beauty Salon ABC",
        "shop_description": "Premium beauty services",
        "shop_address": "123 Main St",
        "detailed_address": "Suite 100",
        "phone_number": "+82-10-1234-5678",
        "email": "shop@example.com",
        "main_category": "nail",
        "sub_categories": ["manicure", "pedicure"],
        "shop_type": "non_partnered",
        "requested_shop_type": "partnered",
        "commission_rate": 0.15,
        "requested_commission_rate": 0.1,

        "owner": {
          "id": "uuid",
          "name": "John Kim",
          "email": "john@example.com",
          "phone_number": "+82-10-9876-5432",
          "verified": false
        },

        "approval_status": "pending_approval",
        "verification_status": "pending",
        "current_review_stage": "initial_review",
        "priority": "medium",
        "assigned_reviewer_id": "uuid",
        "assigned_reviewer_name": "Admin User",

        "documents": [
          {
            "id": "uuid",
            "type": "business_license",
            "url": "https://storage/docs/123.pdf",
            "file_name": "business_license.pdf",
            "file_size": 1024000,
            "uploaded_at": "2025-01-15T10:00:00Z",
            "verification_status": "pending",
            "verified_by": null,
            "verified_at": null,
            "rejection_reason": null
          }
        ],

        "risk_assessment": {
          "risk_level": "low",
          "risk_factors": ["new_owner", "high_commission_request"],
          "compliance_score": 85,
          "automated_checks": {
            "duplicate_check": "passed",
            "blacklist_check": "passed",
            "address_verification": "pending"
          }
        },

        "review_progress": {
          "initial_review": {
            "status": "completed",
            "completed_at": "2025-01-15T11:00:00Z",
            "reviewed_by": "uuid",
            "notes": "All basic information verified"
          },
          "document_verification": {
            "status": "in_progress",
            "completed_at": null,
            "reviewed_by": "uuid",
            "notes": null
          },
          "background_check": {
            "status": "pending",
            "completed_at": null,
            "reviewed_by": null,
            "notes": null
          },
          "final_approval": {
            "status": "pending",
            "completed_at": null,
            "reviewed_by": null,
            "notes": null
          }
        },

        "submitted_at": "2025-01-15T09:00:00Z",
        "review_started_at": "2025-01-15T10:30:00Z",
        "review_deadline": "2025-01-20T09:00:00Z",
        "created_at": "2025-01-15T09:00:00Z",
        "updated_at": "2025-01-15T11:30:00Z",

        "notes": [
          {
            "id": "uuid",
            "content": "Business license expires in 2 months",
            "created_by": "uuid",
            "created_by_name": "Admin User",
            "is_internal": true,
            "created_at": "2025-01-15T11:00:00Z"
          }
        ],

        "communication_history": [
          {
            "id": "uuid",
            "type": "email",
            "direction": "outbound",
            "subject": "Additional documents required",
            "content": "Please submit...",
            "created_at": "2025-01-15T10:00:00Z"
          }
        ],

        "days_in_queue": 1,
        "auto_approval_eligible": false,
        "urgency_score": 65
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "total_pages": 3,
      "has_more": true
    }
  }
}
```

**⚠️ Uses snake_case** - Frontend must transform to camelCase

---

### 2. GET `/api/admin/shops/approval/statistics` - Approval Statistics

**Description**: Get approval queue statistics and metrics.

#### Query Parameters

```typescript
{
  period?: 'today' | 'week' | 'month' | 'quarter' | 'year';
  start_date?: string;  // ISO 8601 date
  end_date?: string;    // ISO 8601 date
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "queue_summary": {
      "total_pending": 45,
      "in_review": 12,
      "approved_today": 8,
      "rejected_today": 2,
      "auto_approved": 3,
      "manual_review_required": 42,
      "overdue": 5,
      "high_priority": 8
    },

    "by_status": {
      "pending_approval": 33,
      "in_review": 12,
      "approved": 156,
      "rejected": 23
    },

    "by_stage": {
      "initial_review": 15,
      "document_verification": 18,
      "background_check": 7,
      "final_approval": 5
    },

    "by_category": {
      "nail": 12,
      "hair": 18,
      "makeup": 8,
      "skincare": 7
    },

    "by_shop_type": {
      "partnered": 25,
      "non_partnered": 20
    },

    "risk_distribution": {
      "low": 30,
      "medium": 12,
      "high": 3
    },

    "performance_metrics": {
      "average_approval_time_hours": 48.5,
      "median_approval_time_hours": 36.0,
      "approval_rate": 87.2,
      "rejection_rate": 12.8,
      "auto_approval_rate": 6.7,
      "sla_compliance_rate": 94.5,
      "avg_documents_per_request": 3.2
    },

    "reviewer_stats": [
      {
        "reviewer_id": "uuid",
        "reviewer_name": "Admin User",
        "assigned_count": 8,
        "completed_count": 15,
        "avg_completion_time_hours": 24.5,
        "approval_rate": 92.3
      }
    ],

    "trends": {
      "daily_submissions": [
        { "date": "2025-01-15", "count": 5 },
        { "date": "2025-01-16", "count": 8 }
      ],
      "daily_approvals": [
        { "date": "2025-01-15", "approved": 3, "rejected": 1 }
      ]
    },

    "period": {
      "start_date": "2025-01-10T00:00:00Z",
      "end_date": "2025-01-17T23:59:59Z",
      "period_type": "week"
    }
  }
}
```

---

### 3. GET `/api/admin/shops/approval/:id` - Get Single Approval Request

**Description**: Get detailed information for a specific approval request.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "shop_id": "uuid",
    "shop_name": "Beauty Salon ABC",
    "shop_description": "Premium beauty services",
    "shop_address": "123 Main St",
    "detailed_address": "Suite 100",
    "phone_number": "+82-10-1234-5678",
    "email": "shop@example.com",
    "main_category": "nail",
    "sub_categories": ["manicure", "pedicure"],
    "shop_type": "non_partnered",
    "requested_shop_type": "partnered",
    "commission_rate": 0.15,
    "requested_commission_rate": 0.1,

    "operating_hours": {
      "monday": { "open": "09:00", "close": "18:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
      "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
      "thursday": { "open": "09:00", "close": "18:00", "closed": false },
      "friday": { "open": "09:00", "close": "20:00", "closed": false },
      "saturday": { "open": "10:00", "close": "20:00", "closed": false },
      "sunday": { "open": "10:00", "close": "18:00", "closed": false }
    },

    "payment_methods": ["card", "cash", "mobile_payment"],
    "business_license_number": "123-45-67890",
    "business_license_image_url": "https://storage/licenses/123.jpg",
    "latitude": 37.5665,
    "longitude": 126.978,
    "location_address": "서울시 강남구 테헤란로 123",
    "location_description": "강남역 2번 출구 도보 5분",

    "owner": {
      "id": "uuid",
      "name": "John Kim",
      "email": "john@example.com",
      "phone_number": "+82-10-9876-5432",
      "verified": false,
      "user_role": "shop_owner",
      "created_at": "2025-01-10T00:00:00Z"
    },

    "approval_status": "in_review",
    "verification_status": "pending",
    "current_review_stage": "document_verification",
    "priority": "medium",
    "assigned_reviewer_id": "uuid",
    "assigned_reviewer_name": "Admin User",

    "documents": [
      {
        "id": "uuid",
        "type": "business_license",
        "url": "https://storage/docs/123.pdf",
        "file_name": "business_license.pdf",
        "file_size": 1024000,
        "uploaded_at": "2025-01-15T10:00:00Z",
        "verification_status": "verified",
        "verified_by": "uuid",
        "verified_at": "2025-01-15T12:00:00Z",
        "rejection_reason": null,
        "metadata": {
          "expiry_date": "2026-12-31",
          "issuing_authority": "Seoul City"
        }
      }
    ],

    "verification_details": {
      "business_license_verified": true,
      "owner_identity_verified": false,
      "address_verified": true,
      "phone_verified": true,
      "email_verified": true,
      "background_check_status": "pending",
      "background_check_results": null
    },

    "risk_assessment": {
      "risk_level": "low",
      "risk_factors": ["new_owner", "high_commission_request"],
      "compliance_score": 85,
      "automated_checks": {
        "duplicate_check": "passed",
        "blacklist_check": "passed",
        "address_verification": "passed",
        "document_validity": "passed"
      }
    },

    "review_progress": {
      "initial_review": {
        "status": "completed",
        "completed_at": "2025-01-15T11:00:00Z",
        "reviewed_by": "uuid",
        "notes": "All basic information verified"
      },
      "document_verification": {
        "status": "in_progress",
        "completed_at": null,
        "reviewed_by": "uuid",
        "notes": "Reviewing business license"
      },
      "background_check": {
        "status": "pending",
        "completed_at": null,
        "reviewed_by": null,
        "notes": null
      },
      "final_approval": {
        "status": "pending",
        "completed_at": null,
        "reviewed_by": null,
        "notes": null
      }
    },

    "submitted_at": "2025-01-15T09:00:00Z",
    "review_started_at": "2025-01-15T10:30:00Z",
    "review_deadline": "2025-01-20T09:00:00Z",
    "created_at": "2025-01-15T09:00:00Z",
    "updated_at": "2025-01-15T13:30:00Z",

    "notes": [
      {
        "id": "uuid",
        "content": "Business license expires in 2 months",
        "created_by": "uuid",
        "created_by_name": "Admin User",
        "is_internal": true,
        "created_at": "2025-01-15T11:00:00Z"
      }
    ],

    "communication_history": [
      {
        "id": "uuid",
        "type": "email",
        "direction": "outbound",
        "subject": "Additional documents required",
        "content": "Please submit tax documents",
        "sent_by": "uuid",
        "sent_by_name": "Admin User",
        "created_at": "2025-01-15T10:00:00Z"
      }
    ],

    "audit_trail": [
      {
        "id": "uuid",
        "action": "status_changed",
        "from_value": "pending_approval",
        "to_value": "in_review",
        "changed_by": "uuid",
        "changed_by_name": "Admin User",
        "notes": "Started review process",
        "created_at": "2025-01-15T10:30:00Z"
      }
    ],

    "days_in_queue": 2,
    "auto_approval_eligible": false,
    "urgency_score": 65
  }
}
```

---

### 4. PUT `/api/admin/shops/approval/:id` - Process Approval Decision

**Description**: Approve or reject a shop approval request.

#### Request Body

```json
{
  "status": "approved",
  "shop_type": "partnered",
  "commission_rate": 0.12,
  "verification_status": "verified",
  "notes": "All documents verified, approved for partnership",
  "notify_owner": true,
  "conditions": [
    "Submit tax documents within 30 days",
    "Complete facility inspection"
  ]
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "approval_request": {
      "id": "uuid",
      "shop_id": "uuid",
      "approval_status": "approved",
      "shop_type": "partnered",
      "commission_rate": 0.12,
      "verification_status": "verified",
      "approved_by": "uuid",
      "approved_by_name": "Admin User",
      "approved_at": "2025-01-17T14:30:00Z",
      "approval_notes": "All documents verified, approved for partnership",
      "approval_conditions": [
        "Submit tax documents within 30 days",
        "Complete facility inspection"
      ],
      "updated_at": "2025-01-17T14:30:00Z"
    },
    "shop_updated": true,
    "notification_sent": true
  }
}
```

---

### 5. POST `/api/admin/shops/approval/bulk-approval` - Bulk Approval

**Description**: Process multiple approval requests at once.

#### Request Body

```json
{
  "shop_ids": ["uuid1", "uuid2", "uuid3"],
  "action": "approve",
  "shop_type": "partnered",
  "commission_rate": 0.12,
  "notes": "Bulk approved after review",
  "notify_owners": true
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "total_requested": 3,
    "successful": ["uuid1", "uuid2"],
    "failed": [
      {
        "id": "uuid3",
        "shop_name": "Shop C",
        "error": "Missing required documents"
      }
    ],
    "success_count": 2,
    "failure_count": 1
  }
}
```

---

### 6. PATCH `/api/admin/shops/approval/:id/assign` - Assign Reviewer

**Description**: Assign a reviewer to an approval request.

#### Request Body

```json
{
  "reviewer_id": "uuid",
  "notes": "Assigned to specialist"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "assigned_reviewer_id": "uuid",
    "assigned_reviewer_name": "Specialist Admin",
    "assigned_at": "2025-01-17T15:00:00Z",
    "assigned_by": "uuid",
    "notes": "Assigned to specialist"
  }
}
```

---

### 7. PATCH `/api/admin/shops/approval/:id/stage` - Update Review Stage

**Description**: Move approval request to next stage.

#### Request Body

```json
{
  "stage": "document_verification",
  "status": "completed",
  "notes": "All documents verified successfully"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "current_review_stage": "document_verification",
    "review_progress": {
      "document_verification": {
        "status": "completed",
        "completed_at": "2025-01-17T16:00:00Z",
        "reviewed_by": "uuid",
        "notes": "All documents verified successfully"
      }
    },
    "updated_at": "2025-01-17T16:00:00Z"
  }
}
```

---

### 8. POST `/api/admin/shops/approval/:id/documents` - Upload Document

**Description**: Upload a document for verification.

#### Request

`multipart/form-data`

```
file: <binary>
document_type: "business_license"
metadata: {
  "description": "Updated business license",
  "expiry_date": "2026-12-31"
}
```

#### Response (201 Created)

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "uuid",
      "type": "business_license",
      "url": "https://storage/docs/456.pdf",
      "file_name": "business_license.pdf",
      "file_size": 1024000,
      "uploaded_at": "2025-01-17T16:30:00Z",
      "uploaded_by": "uuid",
      "verification_status": "pending",
      "metadata": {
        "description": "Updated business license",
        "expiry_date": "2026-12-31"
      }
    }
  }
}
```

---

### 9. PATCH `/api/admin/shops/approval/documents/:docId/verify` - Verify Document

**Description**: Verify or reject an uploaded document.

#### Request Body

```json
{
  "verification_status": "verified",
  "notes": "Business license is valid and current"
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "document": {
      "id": "uuid",
      "type": "business_license",
      "verification_status": "verified",
      "verified_by": "uuid",
      "verified_at": "2025-01-17T17:00:00Z",
      "verification_notes": "Business license is valid and current",
      "updated_at": "2025-01-17T17:00:00Z"
    }
  }
}
```

---

## 📊 Shop Analytics API

### Base Path: `/api/admin/shops/analytics`

**Authentication**: All endpoints require admin JWT token.

---

### 1. GET `/api/admin/shops/analytics/overview` - Overview Analytics

**Description**: Get comprehensive shop analytics overview.

#### Query Parameters

```typescript
{
  start_date?: string;       // ISO 8601 date, default: 30 days ago
  end_date?: string;         // ISO 8601 date, default: today
  compare_period?: boolean;  // Compare with previous period
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "summary": {
      "total_shops": 1250,
      "active_shops": 1089,
      "inactive_shops": 98,
      "suspended_shops": 45,
      "deleted_shops": 18,
      "partnered_shops": 856,
      "non_partnered_shops": 394,
      "verified_shops": 1156,
      "pending_verification": 78,
      "rejected_verification": 16,
      "featured_shops": 45,
      "new_shops_this_period": 23,
      "growth_rate": 2.1
    },

    "comparison": {
      "total_shops_change": 23,
      "total_shops_change_percent": 1.9,
      "active_shops_change": 18,
      "active_shops_change_percent": 1.7,
      "partnered_shops_change": 12,
      "partnered_shops_change_percent": 1.4
    },

    "by_category": [
      {
        "category": "nail",
        "count": 345,
        "percentage": 27.6,
        "active_count": 312,
        "avg_commission_rate": 0.15,
        "avg_bookings_per_shop": 45.2
      }
    ],

    "by_region": [
      {
        "region": "Seoul",
        "count": 456,
        "percentage": 36.5,
        "active_count": 423,
        "top_category": "nail"
      }
    ],

    "by_shop_type": {
      "partnered": {
        "count": 856,
        "percentage": 68.5,
        "avg_commission_rate": 0.12,
        "avg_bookings": 48.5,
        "total_revenue": 125000000
      },
      "non_partnered": {
        "count": 394,
        "percentage": 31.5,
        "avg_commission_rate": 0.18,
        "avg_bookings": 12.3,
        "total_revenue": 15000000
      }
    },

    "status_distribution": [
      { "status": "active", "count": 1089, "percentage": 87.1 },
      { "status": "inactive", "count": 98, "percentage": 7.8 },
      { "status": "pending_approval", "count": 45, "percentage": 3.6 },
      { "status": "suspended", "count": 18, "percentage": 1.4 }
    ],

    "verification_stats": {
      "verified_rate": 92.5,
      "avg_verification_time_hours": 36.5,
      "pending_verification": 78,
      "auto_verified": 234,
      "manual_verified": 922
    },

    "performance_metrics": {
      "avg_bookings_per_shop": 42.3,
      "avg_revenue_per_shop": 2340000,
      "avg_commission_rate": 0.14,
      "total_commission_earned": 18500000,
      "shop_retention_rate": 94.2,
      "avg_shop_lifespan_days": 456
    },

    "trends": {
      "daily_new_shops": [
        { "date": "2025-01-10", "count": 3 },
        { "date": "2025-01-11", "count": 5 }
      ],
      "daily_active_shops": [
        { "date": "2025-01-10", "count": 1078 },
        { "date": "2025-01-11", "count": 1082 }
      ]
    },

    "period": {
      "start_date": "2024-12-18T00:00:00Z",
      "end_date": "2025-01-17T23:59:59Z",
      "days": 30
    }
  }
}
```

---

### 2. GET `/api/admin/shops/analytics/category/:category` - Category Analytics

**Description**: Get detailed analytics for a specific category.

#### Query Parameters

```typescript
{
  start_date?: string;
  end_date?: string;
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "category": "nail",
    "total_shops": 345,
    "active_shops": 312,
    "growth_rate": 3.2,

    "subcategory_distribution": [
      { "subcategory": "manicure", "count": 234, "percentage": 67.8 },
      { "subcategory": "pedicure", "count": 189, "percentage": 54.8 }
    ],

    "avg_commission_rate": 0.15,
    "total_bookings": 15608,
    "avg_bookings_per_shop": 45.2,
    "total_revenue": 234500000,
    "avg_revenue_per_shop": 6797101,

    "top_performing_shops": [
      {
        "shop_id": "uuid",
        "shop_name": "Premium Nail Spa",
        "bookings": 234,
        "revenue": 12340000,
        "rating": 4.8,
        "rank": 1
      }
    ],

    "geographic_distribution": [
      { "region": "Seoul", "count": 156, "percentage": 45.2 },
      { "region": "Busan", "count": 89, "percentage": 25.8 }
    ]
  }
}
```

---

### 3. GET `/api/admin/shops/analytics/performance` - Performance Analytics

**Description**: Get shop performance metrics and rankings.

#### Query Parameters

```typescript
{
  metric?: 'bookings' | 'revenue' | 'rating' | 'growth';
  period?: 'week' | 'month' | 'quarter' | 'year';
  category?: string;
  shop_type?: 'partnered' | 'non_partnered';
  limit?: number;  // Default: 50
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "rankings": [
      {
        "rank": 1,
        "shop_id": "uuid",
        "shop_name": "Premium Beauty Spa",
        "main_category": "nail",
        "shop_type": "partnered",
        "metric_value": 456,
        "total_bookings": 456,
        "total_revenue": 18900000,
        "avg_rating": 4.9,
        "growth_rate": 15.2,
        "commission_earned": 2268000,
        "active_since": "2024-03-15T00:00:00Z"
      }
    ],

    "summary": {
      "total_shops_analyzed": 1250,
      "avg_metric_value": 42.3,
      "median_metric_value": 35.0,
      "top_10_percent_threshold": 120.0,
      "bottom_10_percent_threshold": 8.0
    },

    "metric_distribution": {
      "0-10": 125,
      "11-25": 234,
      "26-50": 456,
      "51-100": 312,
      "101+": 123
    }
  }
}
```

---

### 4. GET `/api/admin/shops/analytics/commission` - Commission Analytics

**Description**: Analyze commission rates and revenue.

#### Query Parameters

```typescript
{
  start_date?: string;
  end_date?: string;
  group_by?: 'category' | 'shop_type' | 'region';
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "overall": {
      "total_commission_earned": 45600000,
      "avg_commission_rate": 0.14,
      "total_bookings": 54000,
      "total_gross_revenue": 325714285
    },

    "by_group": [
      {
        "group_name": "nail",
        "shop_count": 345,
        "avg_commission_rate": 0.15,
        "total_commission_earned": 12340000,
        "total_bookings": 15608,
        "total_gross_revenue": 82266666
      }
    ],

    "rate_distribution": [
      {
        "rate_range": "0.10-0.12",
        "shop_count": 456,
        "total_commission": 8900000
      },
      {
        "rate_range": "0.13-0.15",
        "shop_count": 589,
        "total_commission": 19800000
      }
    ],

    "trends": {
      "monthly_commission": [
        { "month": "2024-12", "commission": 4200000 },
        { "month": "2025-01", "commission": 4560000 }
      ]
    }
  }
}
```

---

### 5. GET `/api/admin/shops/analytics/growth` - Growth Analytics

**Description**: Track shop growth and expansion metrics.

#### Query Parameters

```typescript
{
  period?: 'week' | 'month' | 'quarter' | 'year';
  granularity?: 'daily' | 'weekly' | 'monthly';
}
```

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "current_period": {
      "new_shops": 23,
      "churned_shops": 5,
      "net_growth": 18,
      "growth_rate": 1.5
    },

    "historical_growth": [
      {
        "period": "2024-12",
        "start_count": 1200,
        "new_shops": 45,
        "churned_shops": 12,
        "end_count": 1233,
        "growth_rate": 2.8
      }
    ],

    "churn_analysis": {
      "total_churned": 45,
      "churn_rate": 3.6,
      "avg_lifespan_days": 456,
      "churn_reasons": [
        { "reason": "low_bookings", "count": 18 },
        { "reason": "policy_violation", "count": 12 },
        { "reason": "business_closure", "count": 15 }
      ]
    },

    "retention_metrics": {
      "30_day_retention": 98.5,
      "60_day_retention": 96.2,
      "90_day_retention": 94.1,
      "180_day_retention": 91.8,
      "365_day_retention": 87.3
    },

    "cohort_analysis": [
      {
        "cohort": "2024-Q1",
        "initial_shops": 250,
        "remaining_shops": 218,
        "retention_rate": 87.2
      }
    ]
  }
}
```

---

### 6. GET `/api/admin/shops/analytics/verification-stats` - Verification Statistics

**Description**: Get shop verification statistics.

#### Response (200 OK)

```json
{
  "success": true,
  "data": {
    "stats": {
      "total_shops": 1250,
      "verified": 1156,
      "pending": 78,
      "rejected": 16,
      "verification_rate": 92.5
    },

    "verification_methods": {
      "auto_verified": 234,
      "manual_verified": 922,
      "auto_verification_rate": 18.7
    },

    "avg_verification_time": {
      "auto_hours": 0.5,
      "manual_hours": 36.5,
      "overall_hours": 28.3
    },

    "by_category": [
      {
        "category": "nail",
        "total": 345,
        "verified": 320,
        "verification_rate": 92.8
      }
    ],

    "pending_details": {
      "less_than_24h": 23,
      "24h_to_48h": 34,
      "48h_to_72h": 15,
      "over_72h": 6
    }
  }
}
```

---

## 🔄 Frontend Data Transformation

The frontend must transform **snake_case → camelCase** at the service layer.

### Backend Response Example

```json
{
  "shop_name": "Beauty Salon",
  "main_category": "nail",
  "commission_rate": 0.15,
  "approved_at": "2025-01-17T14:30:00Z",
  "review_progress": {
    "initial_review": {
      "status": "completed",
      "completed_at": "2025-01-15T11:00:00Z"
    }
  }
}
```

### Frontend (After Transformation)

```typescript
{
  shopName: "Beauty Salon",
  mainCategory: "nail",
  commissionRate: 0.15,
  approvedAt: "2025-01-17T14:30:00Z",
  reviewProgress: {
    initialReview: {
      status: "completed",
      completedAt: "2025-01-15T11:00:00Z"
    }
  }
}
```

### Transform Function Example

```typescript
function transformApprovalRequest(data: BackendApprovalRequest): FrontendApprovalRequest {
  return {
    id: data.id,
    shopId: data.shop_id,
    shopName: data.shop_name,
    shopDescription: data.shop_description,
    mainCategory: data.main_category,
    subCategories: data.sub_categories,
    commissionRate: data.commission_rate,
    requestedCommissionRate: data.requested_commission_rate,
    approvalStatus: data.approval_status,
    verificationStatus: data.verification_status,
    currentReviewStage: data.current_review_stage,
    assignedReviewerId: data.assigned_reviewer_id,
    assignedReviewerName: data.assigned_reviewer_name,
    submittedAt: data.submitted_at,
    reviewStartedAt: data.review_started_at,
    reviewDeadline: data.review_deadline,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    daysInQueue: data.days_in_queue,
    urgencyScore: data.urgency_score,

    owner: data.owner ? {
      id: data.owner.id,
      name: data.owner.name,
      email: data.owner.email,
      phoneNumber: data.owner.phone_number,
      verified: data.owner.verified
    } : null,

    reviewProgress: Object.fromEntries(
      Object.entries(data.review_progress).map(([key, value]) => [
        camelCase(key),
        {
          status: value.status,
          completedAt: value.completed_at,
          reviewedBy: value.reviewed_by,
          notes: value.notes
        }
      ])
    )
  };
}
```

---

## 📝 Field Naming Conventions

### ✅ Correct (Backend - snake_case)

- `shop_name`
- `main_category`
- `commission_rate`
- `approval_status`
- `created_at`
- `phone_number`
- `business_license_number`
- `review_progress`
- `submitted_at`

### ❌ Incorrect (Do NOT use in backend)

- `shopName`
- `mainCategory`
- `commissionRate`
- `approvalStatus`
- `createdAt`
- `phoneNumber`
- `businessLicenseNumber`
- `reviewProgress`
- `submittedAt`

---

## 🚨 Important Backend Requirements

1. **All field names must be snake_case** - Frontend handles transformation
2. **All dates must be ISO 8601** format (`2025-01-17T14:30:00Z`)
3. **All timestamps include timezone** (UTC recommended)
4. **Decimal values for rates** (0.15 = 15%, not 15)
5. **Pagination structure** must match shops API pattern:
   ```json
   {
     "page": 1,
     "limit": 20,
     "total": 45,
     "total_pages": 3,
     "has_more": true
   }
   ```
6. **Error responses** must include meaningful error messages
7. **File uploads** use `multipart/form-data`
8. **Null values** are allowed (use `null`, not `undefined`)
9. **Arrays must not be null** - use empty array `[]` instead
10. **Success wrapper** - All responses wrap data in `{ success: true, data: {...} }`

---

## 📊 Database Tables Required

### `shop_approval_requests`
- All approval-related fields
- Links to `shops` and `users` tables
- Tracks approval workflow and progress

### `shop_approval_documents`
- Document storage and verification
- Links to approval requests

### `shop_approval_notes`
- Internal and external notes
- Communication history

### `shop_approval_audit_trail`
- Complete audit log of all changes
- Who, what, when tracking

---

## 🧪 Testing Commands

### Get Approval Queue
```bash
curl 'http://localhost:3001/api/admin/shops/approval?status=pending_approval&limit=10' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Approval Statistics
```bash
curl 'http://localhost:3001/api/admin/shops/approval/statistics?period=week' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Approve Shop
```bash
curl -X PUT 'http://localhost:3001/api/admin/shops/approval/SHOP_UUID' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "shop_type": "partnered",
    "commission_rate": 0.12,
    "notes": "All documents verified"
  }'
```

### Get Shop Analytics Overview
```bash
curl 'http://localhost:3001/api/admin/shops/analytics/overview?start_date=2024-12-01&end_date=2025-01-17' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

### Get Category Analytics
```bash
curl 'http://localhost:3001/api/admin/shops/analytics/category/nail' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## 📚 Related Documentation

- See `ACTUAL_SHOPS_API_SPEC.md` for main shops API specification
- See `ACTUAL_ANALYTICS_DASHBOARD_API_SPEC.md` for admin analytics
- See `API_SPECIFICATIONS_INDEX.md` for complete API documentation index

---

**Last Updated**: 2025-01-17
**Version**: 1.0
**Status**: Specification Complete - Ready for Implementation
