# Actual Users API Specification

## What the Backend Actually Returns

### GET `/api/admin/users`

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "data": {
    "users": UserItem[],
    "totalCount": number,
    "hasMore": boolean,
    "currentPage": number,
    "totalPages": number,
    "filters": UserSearchFilters
  }
}
```

#### UserItem Structure (Actual Backend Fields)

```typescript
{
  "id": string,
  "email": string,
  "phoneNumber": string,
  "phoneVerified": boolean,
  "name": string,
  "nickname": string,
  "gender": "male" | "female" | "other" | "prefer_not_to_say",
  "birthDate": string,
  "userRole": "user" | "shop_owner" | "admin" | "influencer",
  "userStatus": "active" | "inactive" | "suspended" | "deleted",
  "isInfluencer": boolean,
  "influencerQualifiedAt": string | null,
  "socialProvider": string | null,
  "referralCode": string | null,
  "referredByCode": string | null,
  "totalPoints": number,
  "availablePoints": number,
  "totalReferrals": number,
  "successfulReferrals": number,
  "lastLoginAt": string | null,
  "lastLoginIp": string | null,
  "termsAcceptedAt": string | null,
  "privacyAcceptedAt": string | null,
  "marketingConsent": boolean,
  "createdAt": string,
  "updatedAt": string,
  
  // Computed fields (added by backend)
  "daysSinceLastLogin": number | undefined,
  "isActive": boolean,
  "hasCompletedProfile": boolean
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "2e72b09c-08a8-4d33-b5b0-7a1003a0df97",
        "email": "testuser42rale@gmail.com",
        "phoneNumber": "+821012345bz827n",
        "phoneVerified": true,
        "name": "박지혜",
        "nickname": "지혜뷰티",
        "gender": "female",
        "birthDate": "1990-01-01",
        "userRole": "user",
        "userStatus": "active",
        "isInfluencer": true,
        "influencerQualifiedAt": "2025-10-01T07:00:00+00:00",
        "socialProvider": null,
        "referralCode": null,
        "referredByCode": null,
        "totalPoints": 25000,
        "availablePoints": 10000,
        "totalReferrals": 0,
        "successfulReferrals": 0,
        "lastLoginAt": null,
        "lastLoginIp": null,
        "termsAcceptedAt": null,
        "privacyAcceptedAt": null,
        "marketingConsent": false,
        "createdAt": "2025-09-21T14:18:41.870339+00:00",
        "updatedAt": "2025-09-22T04:58:40.993524+00:00",
        "daysSinceLastLogin": undefined,
        "isActive": true,
        "hasCompletedProfile": true
      }
    ],
    "totalCount": 5,
    "hasMore": false,
    "currentPage": 1,
    "totalPages": 1,
    "filters": {
      "page": 1,
      "limit": 20,
      "sortBy": "created_at",
      "sortOrder": "desc"
    }
  }
}
```

## Database Schema vs Backend Response

| Database Field | Backend Response Field | Type | Notes |
|---------------|----------------------|------|-------|
| `phone_number` | `phoneNumber` | string | Converted to camelCase |
| `phone_verified` | `phoneVerified` | boolean | Converted to camelCase |
| `user_role` | `userRole` | string | Converted to camelCase |
| `user_status` | `userStatus` | string | Converted to camelCase |
| `is_influencer` | `isInfluencer` | boolean | Converted to camelCase |
| `influencer_qualified_at` | `influencerQualifiedAt` | string | Converted to camelCase |
| `social_provider` | `socialProvider` | string | Converted to camelCase |
| `social_provider_id` | ❌ Not included | - | Excluded from response |
| `referral_code` | `referralCode` | string | Converted to camelCase |
| `referred_by_code` | `referredByCode` | string | Converted to camelCase |
| `total_points` | `totalPoints` | number | Converted to camelCase |
| `available_points` | `availablePoints` | number | Converted to camelCase |
| `total_referrals` | `totalReferrals` | number | Converted to camelCase |
| `successful_referrals` | `successfulReferrals` | number | Converted to camelCase |
| `last_login_at` | `lastLoginAt` | string | Converted to camelCase |
| `last_login_ip` | `lastLoginIp` | string | Converted to camelCase |
| `terms_accepted_at` | `termsAcceptedAt` | string | Converted to camelCase |
| `privacy_accepted_at` | `privacyAcceptedAt` | string | Converted to camelCase |
| `marketing_consent` | `marketingConsent` | boolean | Converted to camelCase |
| `created_at` | `createdAt` | string | Converted to camelCase |
| `updated_at` | `updatedAt` | string | Converted to camelCase |
| N/A | `daysSinceLastLogin` | number | **Computed field** |
| N/A | `isActive` | boolean | **Computed field** |
| N/A | `hasCompletedProfile` | boolean | **Computed field** |

## Query Parameters (What Backend Accepts)

### Filter Parameters
```typescript
{
  // Search and filters
  search?: string,                 // Search in name, email, phone_number
  role?: "user" | "shop_owner" | "admin" | "influencer",
  status?: "active" | "inactive" | "suspended" | "deleted",
  gender?: "male" | "female" | "other" | "prefer_not_to_say",
  isInfluencer?: boolean,          // "true" or "false" string
  phoneVerified?: boolean,         // "true" or "false" string
  
  // Date ranges
  startDate?: string,              // Created date range start (ISO)
  endDate?: string,                // Created date range end (ISO)
  lastLoginStart?: string,         // Last login range start (ISO)
  lastLoginEnd?: string,           // Last login range end (ISO)
  
  // Referral and points
  hasReferrals?: boolean,          // "true" or "false" string
  minPoints?: number,
  maxPoints?: number,
  
  // Sorting and pagination
  sortBy?: "createdAt" | "name" | "email" | "lastLoginAt" | "totalPoints" | "totalReferrals",
  sortOrder?: "asc" | "desc",
  page?: number,                   // Default: 1
  limit?: number                   // Default: 20
}
```

### Sort Field Mapping (Frontend → Backend)
```typescript
{
  "createdAt": "created_at",
  "updatedAt": "created_at",       // Maps to created_at
  "lastLoginAt": "last_login_at",
  "totalPoints": "total_points",
  "totalReferrals": "total_referrals",
  "name": "name",
  "email": "email"
}
```

## After Auto-Unwrap by api.ts

The interceptor unwraps `{ success: true, data: X }` → `X`

Frontend receives:
```typescript
{
  "users": UserItem[],
  "totalCount": number,
  "hasMore": boolean,
  "currentPage": number,
  "totalPages": number,
  "filters": UserSearchFilters
}
```

## Frontend Transform (If Needed)

If frontend expects different field names, create a transform function:

```typescript
// In users service file
function transformUserItem(item: BackendUserItem): FrontendUserItem {
  return {
    id: item.id,
    email: item.email,
    phone: item.phoneNumber,              // phoneNumber → phone (if needed)
    phoneVerified: item.phoneVerified,
    name: item.name,
    nickname: item.nickname,
    gender: item.gender,
    birthDate: item.birthDate,
    role: item.userRole,                  // userRole → role (if needed)
    status: item.userStatus,              // userStatus → status (if needed)
    isInfluencer: item.isInfluencer,
    influencerQualifiedAt: item.influencerQualifiedAt,
    socialProvider: item.socialProvider,
    referralCode: item.referralCode,
    referredByCode: item.referredByCode,
    totalPoints: item.totalPoints,
    availablePoints: item.availablePoints,
    totalReferrals: item.totalReferrals,
    successfulReferrals: item.successfulReferrals,
    lastLoginAt: item.lastLoginAt,
    lastLoginIp: item.lastLoginIp,
    termsAcceptedAt: item.termsAcceptedAt,
    privacyAcceptedAt: item.privacyAcceptedAt,
    marketingConsent: item.marketingConsent,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
    
    // Computed fields
    daysSinceLastLogin: item.daysSinceLastLogin,
    isActive: item.isActive,
    hasCompletedProfile: item.hasCompletedProfile
  };
}

static async getUsers(filters?: UserSearchFilters): Promise<PaginatedUserResponse> {
  const params = new URLSearchParams();
  
  // Build query params
  if (filters?.search) params.append('search', filters.search);
  if (filters?.role) params.append('role', filters.role);
  // ... add other filters ...
  
  const url = `/api/admin/users?${params.toString()}`;
  const response = await apiService.get<UserManagementResponse>(url);
  
  // Response is already unwrapped by interceptor
  const { users, totalCount, hasMore, currentPage, totalPages } = response;
  
  // Transform if needed
  const transformedUsers = users.map(transformUserItem);
  
  return {
    data: transformedUsers,
    pagination: {
      page: currentPage,
      limit: filters?.limit || 20,
      total: totalCount,
      totalPages,
      hasMore
    }
  };
}
```

## Additional Endpoints

### GET `/api/admin/users/roles`
Returns available user roles:
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

### GET `/api/admin/users/statuses`
Returns available user statuses:
```json
{
  "success": true,
  "data": [
    { "value": "active", "label": "Active" },
    { "value": "inactive", "label": "Inactive" },
    { "value": "suspended", "label": "Suspended" },
    { "value": "deleted", "label": "Deleted" }
  ]
}
```

### GET `/api/admin/users/:id`
Returns single user details (same structure as UserItem above).

### PATCH `/api/admin/users/:id/status`
Update user status:
```json
// Request
{
  "status": "suspended",
  "reason": "Violation of terms",
  "adminNotes": "Multiple complaints received",
  "notifyUser": true
}

// Response
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "User Name",
      "previousStatus": "active",
      "newStatus": "suspended",
      "updatedAt": "2025-10-07T04:00:00Z"
    },
    "action": {
      "type": "status_update",
      "reason": "Violation of terms",
      "adminNotes": "Multiple complaints received",
      "performedBy": "admin-id",
      "performedAt": "2025-10-07T04:00:00Z"
    }
  }
}
```

### PATCH `/api/admin/users/:id/role`
Update user role (similar structure to status update).

### POST `/api/admin/users/bulk-action`
Perform bulk actions on multiple users.

### GET `/api/admin/users/:id/activity`
Get user activity history.

## Summary

**Key Differences from Service Catalog:**

1. **Field naming**: Backend already converts snake_case → camelCase ✅
2. **Pagination**: Includes `currentPage` and `totalPages` in response
3. **Computed fields**: Backend adds `daysSinceLastLogin`, `isActive`, `hasCompletedProfile`
4. **No transformation needed**: If frontend uses same field names as backend response

**Backend Response Structure:**
```json
{
  "success": true,
  "data": {
    "users": UserItem[],
    "totalCount": number,
    "hasMore": boolean,
    "currentPage": number,
    "totalPages": number,
    "filters": UserSearchFilters
  }
}
```

**After Auto-Unwrap:**
```typescript
{
  users: UserItem[],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,
  totalPages: number,
  filters: UserSearchFilters
}
```

**Frontend Should Use:**
```typescript
const response = await apiService.get('/api/admin/users');
const { users, totalCount, currentPage, totalPages, hasMore } = response;

// Use users array directly - already in camelCase
users.forEach(user => {
  console.log(user.phoneNumber);  // ✅ Works
  console.log(user.userRole);     // ✅ Works
  console.log(user.totalPoints);  // ✅ Works
});
```
