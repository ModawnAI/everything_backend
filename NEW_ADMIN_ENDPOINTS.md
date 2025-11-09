# New Admin API Endpoints Documentation

This document describes the newly implemented admin API endpoints for the eBeautything backend.

## Table of Contents
1. [User Referrals Endpoint (2.2 추천 친구 목록)](#1-user-referrals-endpoint)
2. [Point Policy Management (6. 포인트 정책 관리)](#2-point-policy-management)
3. [Announcements Management (7. 공지사항 관리)](#3-announcements-management)
4. [Push Notification Management (8. 푸시 발송 관리)](#4-push-notification-management)

---

## 1. User Referrals Endpoint

### GET `/api/admin/users/:id/referrals`
Get a user's referral list with first payment status information.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): User UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "uuid",
        "referredId": "uuid",
        "referredUserName": "Kim** (masked)",
        "referredUserEmail": "ki***@example.com",
        "status": "completed",
        "hasFirstPayment": true,
        "firstPaymentDate": "2024-01-01T10:00:00Z",
        "firstPaymentAmount": 50000,
        "bonusPaid": true,
        "bonusAmount": 5000,
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "totalReferrals": 50,
    "completedReferrals": 50,
    "referralsWithFirstPayment": 50
  }
}
```

**Features:**
- Masked user information for privacy
- First payment status tracking
- Bonus payment information
- Comprehensive statistics

**Use Case:** Verify influencer qualification (친구 50명 초대 및 전원 첫 결제 완료)

---

## 2. Point Policy Management

### GET `/api/admin/points/policy`
Get the current active point policy.

**Authentication:** Required (Admin JWT)

**Response:**
```json
{
  "success": true,
  "data": {
    "policy": {
      "id": "uuid",
      "earning_rate_percent": 2.5,
      "earning_cap_amount": 300000,
      "usage_availability_delay_days": 7,
      "minimum_usage_amount": 0,
      "maximum_usage_percent": 100,
      "points_expiry_days": 365,
      "influencer_referral_multiplier": 2.0,
      "influencer_bonus_rate_percent": 0,
      "referral_signup_bonus": 0,
      "referral_first_purchase_bonus": 0,
      "is_active": true,
      "effective_from": "2024-01-01T00:00:00Z",
      "effective_until": null,
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "updated_by": "admin-uuid"
    }
  }
}
```

### GET `/api/admin/points/policy/history`
Get point policy history with pagination.

**Authentication:** Required (Admin JWT)

**Query Parameters:**
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 20): Items per page

**Response:**
```json
{
  "success": true,
  "data": {
    "policies": [...],
    "totalCount": 15,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

### POST `/api/admin/points/policy`
Create a new point policy (automatically deactivates the current active policy).

**Authentication:** Required (Admin JWT)

**Request Body:**
```json
{
  "earningRatePercent": 2.5,
  "earningCapAmount": 300000,
  "usageAvailabilityDelayDays": 7,
  "minimumUsageAmount": 0,
  "maximumUsagePercent": 100,
  "pointsExpiryDays": 365,
  "influencerReferralMultiplier": 2.0,
  "influencerBonusRatePercent": 0,
  "referralSignupBonus": 0,
  "referralFirstPurchaseBonus": 0,
  "effectiveFrom": "2024-01-01T00:00:00Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "policy": {...}
  }
}
```

### PUT `/api/admin/points/policy/:id`
Update an existing point policy.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Policy UUID

**Request Body:** (All fields optional)
```json
{
  "earningRatePercent": 3.0,
  "earningCapAmount": 350000,
  "usageAvailabilityDelayDays": 5
}
```

### DELETE `/api/admin/points/policy/:id`
Deactivate a point policy.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Policy UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "policy": {...}
  }
}
```

---

## 3. Announcements Management

### GET `/api/admin/announcements`
Get all announcements with optional filtering.

**Authentication:** Required (Admin JWT)

**Query Parameters:**
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 20): Items per page
- `isActive` (boolean, optional): Filter by active status
- `isImportant` (boolean, optional): Filter by important flag

**Response:**
```json
{
  "success": true,
  "data": {
    "announcements": [
      {
        "id": "uuid",
        "title": "서비스 점검 안내",
        "content": "2024년 1월 1일 오전 2시부터...",
        "is_important": true,
        "is_active": true,
        "target_user_type": ["user", "shop_owner"],
        "starts_at": "2024-01-01T00:00:00Z",
        "ends_at": "2024-01-31T23:59:59Z",
        "created_by": "admin-uuid",
        "created_at": "2024-01-01T00:00:00Z",
        "updated_at": "2024-01-01T00:00:00Z"
      }
    ],
    "totalCount": 10,
    "currentPage": 1,
    "totalPages": 1
  }
}
```

### GET `/api/admin/announcements/:id`
Get a specific announcement by ID.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Announcement UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "announcement": {...}
  }
}
```

### POST `/api/admin/announcements`
Create a new announcement.

**Authentication:** Required (Admin JWT)

**Request Body:**
```json
{
  "title": "서비스 점검 안내",
  "content": "2024년 1월 1일 오전 2시부터 오전 4시까지 서비스 점검이 진행됩니다.",
  "isImportant": true,
  "isActive": true,
  "targetUserType": ["user", "shop_owner", "influencer"],
  "startsAt": "2024-01-01T00:00:00Z",
  "endsAt": "2024-01-31T23:59:59Z"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "announcement": {...}
  }
}
```

### PUT `/api/admin/announcements/:id`
Update an existing announcement.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Announcement UUID

**Request Body:** (All fields optional)
```json
{
  "title": "Updated title",
  "content": "Updated content",
  "isActive": false
}
```

### DELETE `/api/admin/announcements/:id`
Delete an announcement.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Announcement UUID

---

## 4. Push Notification Management

### POST `/api/admin/push/send`
Send push notification to users.

**Authentication:** Required (Admin JWT)

**Request Body:**
```json
{
  "title": "새로운 공지사항",
  "body": "에뷰리띵의 새로운 소식을 확인하세요!",
  "targetUserType": ["user", "shop_owner"],
  "targetUserIds": ["uuid1", "uuid2"],
  "data": {
    "url": "/announcements",
    "type": "announcement"
  },
  "imageUrl": "https://example.com/image.jpg",
  "schedule": "2024-01-01T10:00:00Z"
}
```

**Field Descriptions:**
- `title` (string, required): Notification title
- `body` (string, required): Notification message
- `targetUserType` (array, optional): User roles to target ['user', 'shop_owner', 'influencer']
- `targetUserIds` (array, optional): Specific user IDs to target
- `data` (object, optional): Additional data to include
- `imageUrl` (string, optional): Image URL for rich notification
- `schedule` (string, optional): ISO datetime for scheduled delivery

**Note:** If neither `targetUserType` nor `targetUserIds` is provided, the notification will be sent to ALL active users.

**Response:**
```json
{
  "success": true,
  "data": {
    "notification": {...},
    "targetCount": 1500,
    "sentCount": 1480,
    "failedCount": 20,
    "success": true
  }
}
```

### GET `/api/admin/push/history`
Get push notification history.

**Authentication:** Required (Admin JWT)

**Query Parameters:**
- `page` (number, optional, default: 1): Page number
- `limit` (number, optional, default: 20): Items per page
- `status` (string, optional): Filter by status

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "totalCount": 50,
    "currentPage": 1,
    "totalPages": 3
  }
}
```

### GET `/api/admin/push/:id`
Get push notification details.

**Authentication:** Required (Admin JWT)

**Path Parameters:**
- `id` (string, required): Notification UUID

**Response:**
```json
{
  "success": true,
  "data": {
    "notification": {...}
  }
}
```

---

## Authentication

All endpoints require admin authentication. Include the JWT token in the Authorization header:

```
Authorization: Bearer <admin-jwt-token>
```

## Error Responses

All endpoints return standardized error responses:

```json
{
  "success": false,
  "error": "Error message"
}
```

Common HTTP status codes:
- `200 OK`: Successful request
- `201 Created`: Resource successfully created
- `400 Bad Request`: Invalid request data
- `401 Unauthorized`: Missing or invalid authentication
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `500 Internal Server Error`: Server error

## Rate Limiting

All admin endpoints are protected by rate limiting. Default limits:
- 100 requests per 15 minutes per IP address
- Stricter limits may apply to specific endpoints

---

## Implementation Notes

### Database Tables

1. **referrals**: Existing table with payment tracking
2. **points_policy**: Existing table for point policy configuration
3. **announcements**: Existing table for announcements
4. **notifications**: Existing table for push notifications

### Security Features

- Admin authentication required for all endpoints
- Comprehensive audit logging
- User data masking for privacy
- IP address tracking
- Session validation

### Frontend Integration

These endpoints can be integrated with the ebeautything-admin frontend at `/home/bitnami/ebeautything-admin`.

Example integration:
```typescript
// Fetch referrals
const response = await fetch(`/api/admin/users/${userId}/referrals`, {
  headers: {
    'Authorization': `Bearer ${adminToken}`
  }
});
const data = await response.json();
```

---

## Testing

Server is running at: http://localhost:3001

Test health endpoint:
```bash
curl http://localhost:3001/health
```

Test admin endpoint (requires auth token):
```bash
curl -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  http://localhost:3001/api/admin/points/policy
```

---

Last Updated: 2025-11-09
