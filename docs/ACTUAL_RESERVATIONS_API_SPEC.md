# Actual Reservations API Specification

## What the Backend Actually Returns

### GET `/api/admin/reservations`

#### Response Format (Before Auto-Unwrap)
```json
{
  "success": true,
  "data": {
    "reservations": ReservationItem[],
    "totalCount": number,
    "hasMore": boolean,
    "currentPage": number,
    "totalPages": number,
    "filters": ReservationFilters
  }
}
```

#### ReservationItem Structure (Actual Backend Fields)

```typescript
{
  "id": string,
  "reservationDate": string,           // YYYY-MM-DD format
  "reservationTime": string,           // HH:mm:ss format
  "reservationDatetime": string,       // ISO 8601 datetime
  "status": "requested" | "confirmed" | "completed" | "cancelled_by_user" | "cancelled_by_shop" | "no_show",
  "totalAmount": number,
  "depositAmount": number,
  "remainingAmount": number,
  "pointsUsed": number,
  "pointsEarned": number,
  "specialRequests": string | null,
  "cancellationReason": string | null,
  "noShowReason": string | null,
  "confirmedAt": string | null,
  "completedAt": string | null,
  "cancelledAt": string | null,
  "createdAt": string,
  "updatedAt": string,
  
  // Nested customer information
  "customer": {
    "id": string,
    "name": string,
    "email": string,
    "phoneNumber": string,
    "userStatus": string
  },
  
  // Nested shop information
  "shop": {
    "id": string,
    "name": string,
    "address": string,
    "mainCategory": string,
    "shopStatus": string
  },
  
  // Array of services
  "services": [{
    "id": string,
    "name": string,
    "category": string,
    "quantity": number,
    "unitPrice": number,
    "totalPrice": number
  }],
  
  // Array of payments
  "payments": [{
    "id": string,
    "paymentStatus": string,
    "paymentStage": string,
    "amount": number,
    "isDeposit": boolean,
    "dueDate": string | null,
    "createdAt": string
  }],
  
  // Computed fields (added by backend)
  "daysUntilReservation": number,
  "isOverdue": boolean,
  "isToday": boolean,
  "isPast": boolean,
  "totalPaidAmount": number,
  "outstandingAmount": number
}
```

### Example Response
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "9d38669c-d542-44b3-b283-8ea77930a769",
        "reservationDate": "2025-10-06",
        "reservationTime": "14:00:00",
        "reservationDatetime": "2025-10-06T14:00:00Z",
        "status": "requested",
        "totalAmount": 50000,
        "depositAmount": 10000,
        "remainingAmount": 40000,
        "pointsUsed": 0,
        "pointsEarned": 0,
        "specialRequests": "조용한 자리 부탁드려요",
        "cancellationReason": null,
        "noShowReason": null,
        "confirmedAt": null,
        "completedAt": null,
        "cancelledAt": null,
        "createdAt": "2025-10-05T19:45:16.513477+00:00",
        "updatedAt": "2025-10-05T19:45:16.513477+00:00",
        "customer": {
          "id": "b249dc38-7c7c-462e-b3d3-9a541fdd32f7",
          "name": "김민수",
          "email": "kim@example.com",
          "phoneNumber": "+821012345678",
          "userStatus": "active"
        },
        "shop": {
          "id": "1bc6b4cf-6e2b-4608-a02f-6ef102e38e79",
          "name": "강남 프리미엄 네일샵",
          "address": "서울시 강남구 테헤란로 123",
          "mainCategory": "nail",
          "shopStatus": "active"
        },
        "services": [
          {
            "id": "svc-001",
            "name": "젤네일 기본",
            "category": "nail",
            "quantity": 1,
            "unitPrice": 50000,
            "totalPrice": 50000
          }
        ],
        "payments": [
          {
            "id": "pay-001",
            "paymentStatus": "pending",
            "paymentStage": "deposit",
            "amount": 10000,
            "isDeposit": true,
            "dueDate": null,
            "createdAt": "2025-10-05T19:45:16.513477+00:00"
          }
        ],
        "daysUntilReservation": 1,
        "isOverdue": false,
        "isToday": false,
        "isPast": false,
        "totalPaidAmount": 10000,
        "outstandingAmount": 40000
      }
    ],
    "totalCount": 315,
    "hasMore": true,
    "currentPage": 1,
    "totalPages": 16,
    "filters": {
      "page": 1,
      "limit": 20,
      "sortBy": "reservation_datetime",
      "sortOrder": "desc"
    }
  }
}
```

## Database Schema vs Backend Response

| Database Field | Backend Response Field | Type | Notes |
|---------------|----------------------|------|-------|
| `reservation_date` | `reservationDate` | string | Converted to camelCase |
| `reservation_time` | `reservationTime` | string | Converted to camelCase |
| `reservation_datetime` | `reservationDatetime` | string | Converted to camelCase |
| `total_amount` | `totalAmount` | number | Converted to camelCase |
| `deposit_amount` | `depositAmount` | number | Converted to camelCase |
| `remaining_amount` | `remainingAmount` | number | Converted to camelCase |
| `points_used` | `pointsUsed` | number | Converted to camelCase |
| `points_earned` | `pointsEarned` | number | Converted to camelCase |
| `special_requests` | `specialRequests` | string | Converted to camelCase |
| `cancellation_reason` | `cancellationReason` | string | Converted to camelCase |
| `no_show_reason` | `noShowReason` | string | Converted to camelCase |
| `confirmed_at` | `confirmedAt` | string | Converted to camelCase |
| `completed_at` | `completedAt` | string | Converted to camelCase |
| `cancelled_at` | `cancelledAt` | string | Converted to camelCase |
| `created_at` | `createdAt` | string | Converted to camelCase |
| `updated_at` | `updatedAt` | string | Converted to camelCase |
| `user_id` → `users` table | `customer` | object | **Joined & nested** |
| `shop_id` → `shops` table | `shop` | object | **Joined & nested** |
| `reservation_services` table | `services` | array | **Joined & nested** |
| `payments` table | `payments` | array | **Joined & nested** |
| N/A | `daysUntilReservation` | number | **Computed field** |
| N/A | `isOverdue` | boolean | **Computed field** |
| N/A | `isToday` | boolean | **Computed field** |
| N/A | `isPast` | boolean | **Computed field** |
| N/A | `totalPaidAmount` | number | **Computed field** |
| N/A | `outstandingAmount` | number | **Computed field** |

## Query Parameters (What Backend Accepts)

### Filter Parameters
```typescript
{
  // Status and entity filters
  status?: "requested" | "confirmed" | "completed" | "cancelled_by_user" | "cancelled_by_shop" | "no_show",
  shopId?: string,
  userId?: string,
  
  // Date filters
  startDate?: string,             // YYYY-MM-DD format
  endDate?: string,               // YYYY-MM-DD format
  
  // Search
  search?: string,                // Search in customer name, phone, shop name
  
  // Amount filters
  minAmount?: number,
  maxAmount?: number,
  
  // Points filter
  hasPointsUsed?: boolean,        // "true" or "false" string
  
  // Sorting and pagination
  sortBy?: "reservation_datetime" | "created_at" | "total_amount" | "customer_name" | "shop_name",
  sortOrder?: "asc" | "desc",
  page?: number,                  // Default: 1
  limit?: number                  // Default: 20
}
```

## After Auto-Unwrap by api.ts

The interceptor unwraps `{ success: true, data: X }` → `X`

Frontend receives:
```typescript
{
  "reservations": ReservationItem[],
  "totalCount": number,
  "hasMore": boolean,
  "currentPage": number,
  "totalPages": number,
  "filters": ReservationFilters
}
```

## Frontend Usage

### Direct Access (Already in camelCase ✅)
```typescript
const response = await apiService.get('/api/admin/reservations');
const { reservations, totalCount, currentPage, totalPages, hasMore } = response;

// Use reservation data directly - already in camelCase
reservations.forEach(reservation => {
  console.log(reservation.reservationDate);    // ✅ Works
  console.log(reservation.totalAmount);        // ✅ Works
  console.log(reservation.customer.name);      // ✅ Works (nested object)
  console.log(reservation.shop.name);          // ✅ Works (nested object)
  console.log(reservation.services);           // ✅ Array of service objects
  console.log(reservation.daysUntilReservation); // ✅ Computed field
  console.log(reservation.totalPaidAmount);    // ✅ Computed field
});
```

### Optional Transform (If Frontend Needs Different Structure)
```typescript
function transformReservationItem(item: BackendReservationItem): FrontendReservationItem {
  return {
    id: item.id,
    date: item.reservationDate,          // If you want shorter names
    time: item.reservationTime,
    datetime: item.reservationDatetime,
    status: item.status,
    amount: item.totalAmount,
    deposit: item.depositAmount,
    remaining: item.remainingAmount,
    points: {
      used: item.pointsUsed,
      earned: item.pointsEarned
    },
    customer: item.customer,             // Already in good format
    shop: item.shop,                     // Already in good format
    services: item.services,             // Already in good format
    payments: item.payments,             // Already in good format
    
    // Computed fields
    daysUntil: item.daysUntilReservation,
    flags: {
      isOverdue: item.isOverdue,
      isToday: item.isToday,
      isPast: item.isPast
    },
    financial: {
      totalPaid: item.totalPaidAmount,
      outstanding: item.outstandingAmount
    },
    
    createdAt: item.createdAt,
    updatedAt: item.updatedAt
  };
}
```

## Additional Endpoints

### GET `/api/admin/reservations/:id`
Returns single reservation details (same structure as ReservationItem).

### PUT `/api/admin/reservations/:id/status`
Update reservation status:
```json
// Request
{
  "status": "confirmed",
  "notes": "Confirmed by phone call",
  "reason": "Customer called to confirm",
  "notifyCustomer": true,
  "notifyShop": true,
  "autoProcessPayment": false
}

// Response
{
  "success": true,
  "data": {
    "success": true,
    "reservation": {
      "id": "uuid",
      "previousStatus": "requested",
      "newStatus": "confirmed",
      "updatedAt": "2025-10-07T04:00:00Z"
    },
    "action": {
      "type": "status_update",
      "reason": "Customer called to confirm",
      "notes": "Confirmed by phone call",
      "performedBy": "admin-id",
      "performedAt": "2025-10-07T04:00:00Z"
    }
  }
}
```

### POST `/api/admin/reservations/:id/dispute`
Create a dispute for a reservation:
```json
// Request
{
  "disputeType": "service_quality",
  "description": "Customer complained about service",
  "requestedAction": "refund",
  "priority": "high",
  "evidence": ["url1", "url2"]
}

// Response
{
  "success": true,
  "data": {
    "dispute": {
      "id": "dispute-uuid",
      "reservationId": "reservation-uuid",
      "disputeType": "service_quality",
      "status": "open",
      "priority": "high",
      "createdAt": "2025-10-07T04:00:00Z"
    }
  }
}
```

### GET `/api/admin/reservations/analytics`
Get reservation analytics and trends.

### GET `/api/admin/reservations/statuses`
Returns available reservation statuses:
```json
{
  "success": true,
  "data": [
    { "value": "requested", "label": "Requested" },
    { "value": "confirmed", "label": "Confirmed" },
    { "value": "completed", "label": "Completed" },
    { "value": "cancelled_by_user", "label": "Cancelled By User" },
    { "value": "cancelled_by_shop", "label": "Cancelled By Shop" },
    { "value": "no_show", "label": "No Show" }
  ]
}
```

## Key Features

### 1. Nested Relationships ✅
- **Customer**: Automatically joined from `users` table
- **Shop**: Automatically joined from `shops` table
- **Services**: Automatically joined from `reservation_services` and `shop_services` tables
- **Payments**: Automatically joined from `payments` table

### 2. Computed Fields ✅
- `daysUntilReservation`: Days between now and reservation date
- `isOverdue`: Whether reservation is past due
- `isToday`: Whether reservation is today
- `isPast`: Whether reservation date has passed
- `totalPaidAmount`: Sum of all completed payments
- `outstandingAmount`: Total amount minus paid amount

### 3. All Fields in camelCase ✅
- Database uses snake_case
- API converts to camelCase automatically
- Frontend can use fields directly without transformation

### 4. Rich Filtering ✅
- By status, shop, user
- Date ranges
- Amount ranges
- Search across customer name, phone, shop name
- Points usage filter

## Summary

**Key Advantages:**

1. **Already camelCase**: All fields converted ✅
2. **Rich nested data**: Customer, shop, services, payments included ✅
3. **Computed fields**: Business logic calculations included ✅
4. **Extended pagination**: currentPage, totalPages, filters included ✅
5. **No transformation needed**: Use response data directly ✅

**Backend Response Structure:**
```json
{
  "success": true,
  "data": {
    "reservations": ReservationItem[],
    "totalCount": number,
    "hasMore": boolean,
    "currentPage": number,
    "totalPages": number,
    "filters": ReservationFilters
  }
}
```

**After Auto-Unwrap:**
```typescript
{
  reservations: ReservationItem[],
  totalCount: number,
  hasMore: boolean,
  currentPage: number,
  totalPages: number,
  filters: ReservationFilters
}
```

**Frontend Should Use:**
```typescript
const response = await apiService.get('/api/admin/reservations');
const { reservations, totalCount, currentPage, totalPages, hasMore } = response;

// Use directly - no transform needed ✅
reservations.forEach(reservation => {
  // Access all fields in camelCase
  console.log(reservation.reservationDate);
  console.log(reservation.customer.name);
  console.log(reservation.shop.address);
  console.log(reservation.services[0].name);
  console.log(reservation.totalPaidAmount);
});
```
