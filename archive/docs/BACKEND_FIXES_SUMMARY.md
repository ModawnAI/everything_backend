# Backend API Implementation Specification

## Overview
This document specifies the exact endpoints that the backend (running on port 3001) must implement to support the frontend admin application.

---

## 1. Reservation Statistics Endpoint

### Endpoint
```
GET /api/admin/reservations/statistics
```

### Authentication
- **Required**: Yes (JWT Bearer token)
- **Permissions**: Admin or Platform Admin role

### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `shopId` | string (UUID) | No | Filter statistics by specific shop |
| `staffId` | string (UUID) | No | Filter by specific staff member |
| `dateFrom` | string (ISO 8601 date) | No | Start date for statistics (YYYY-MM-DD) |
| `dateTo` | string (ISO 8601 date) | No | End date for statistics (YYYY-MM-DD) |

### Request Example
```http
GET /api/admin/reservations/statistics?shopId=123e4567-e89b-12d3-a456-426614174000&dateFrom=2025-01-01&dateTo=2025-01-31
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### Response Schema
```typescript
{
  "success": true,
  "data": {
    // Today's Statistics
    "todayReservations": number,      // Total reservations today
    "todayConfirmed": number,         // Confirmed reservations today
    "todayPending": number,           // Pending/requested reservations today
    "todayCompleted": number,         // Completed reservations today

    // Monthly Statistics
    "monthlyRevenue": number,         // Total revenue this month (KRW)
    "revenueGrowth": number,          // Growth percentage vs last month
    "monthlyReservations": number,    // Total reservations this month

    // Customer Statistics
    "totalCustomers": number,         // Total unique customers
    "newCustomersThisMonth": number,  // New customers this month
    "returningCustomers": number,     // Customers with >1 reservation

    // Service Statistics
    "activeServices": number,         // Number of active services
    "topService": string,             // Name of most booked service
    "topServiceCount": number,        // Number of bookings for top service

    // Status Breakdown
    "statusBreakdown": {
      "requested": number,
      "confirmed": number,
      "completed": number,
      "cancelled_by_user": number,
      "cancelled_by_shop": number,
      "no_show": number
    },

    // Revenue Breakdown
    "revenueByStatus": {
      "total": number,              // Total amount from all reservations
      "paid": number,               // Total paid amount
      "outstanding": number         // Total outstanding amount
    }
  },
  "message": "Statistics retrieved successfully"
}
```

### Response Example
```json
{
  "success": true,
  "data": {
    "todayReservations": 12,
    "todayConfirmed": 8,
    "todayPending": 3,
    "todayCompleted": 1,
    "monthlyRevenue": 1250000,
    "revenueGrowth": 15.5,
    "monthlyReservations": 145,
    "totalCustomers": 320,
    "newCustomersThisMonth": 28,
    "returningCustomers": 187,
    "activeServices": 8,
    "topService": "헤어 컷",
    "topServiceCount": 45,
    "statusBreakdown": {
      "requested": 5,
      "confirmed": 42,
      "completed": 89,
      "cancelled_by_user": 7,
      "cancelled_by_shop": 2,
      "no_show": 0
    },
    "revenueByStatus": {
      "total": 1480000,
      "paid": 1250000,
      "outstanding": 230000
    }
  },
  "message": "Statistics retrieved successfully"
}
```

### Error Responses

**401 Unauthorized**
```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Authentication required"
  }
}
```

**403 Forbidden**
```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "Insufficient permissions to access statistics"
  }
}
```

**404 Not Found** (if shopId doesn't exist)
```json
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "Shop not found"
  }
}
```

**500 Internal Server Error**
```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "Failed to retrieve statistics"
  }
}
```

### Implementation Notes
1. **Date Range Defaults**: If `dateFrom` and `dateTo` are not provided, use current month as default
2. **Timezone**: Use shop's configured timezone for date calculations
3. **Performance**: Consider caching statistics for 5 minutes to reduce database load
4. **Shop Filtering**: When `shopId` is provided, scope all statistics to that specific shop
5. **Revenue Calculations**: Only include completed reservations in revenue totals

---

## 2. Shop Operating Hours Endpoints

### 2.1 Get Operating Hours

#### Endpoint
```
GET /api/shop/operating-hours
```

#### Authentication
- **Required**: Yes (JWT Bearer token)
- **Permissions**: Shop owner or admin for the authenticated shop

#### Request Example
```http
GET /api/shop/operating-hours
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

#### Response Schema
```typescript
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": {
        "closed": boolean,           // true if shop is closed this day
        "open": string,              // Opening time (HH:mm format, e.g., "09:00")
        "close": string,             // Closing time (HH:mm format, e.g., "18:00")
        "break_start": string | null,// Break start time (optional)
        "break_end": string | null   // Break end time (optional)
      },
      "tuesday": { /* same structure */ },
      "wednesday": { /* same structure */ },
      "thursday": { /* same structure */ },
      "friday": { /* same structure */ },
      "saturday": { /* same structure */ },
      "sunday": { /* same structure */ }
    },
    "current_status": {
      "is_open": boolean,            // Is shop currently open?
      "current_day": string,         // Current day name (e.g., "monday")
      "next_opening": string | null, // Next opening time (ISO 8601 datetime)
      "message": string              // Human-readable status message
    }
  },
  "message": "Operating hours retrieved successfully"
}
```

#### Response Example
```json
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": {
        "closed": false,
        "open": "09:00",
        "close": "18:00",
        "break_start": "12:00",
        "break_end": "13:00"
      },
      "tuesday": {
        "closed": false,
        "open": "09:00",
        "close": "18:00",
        "break_start": null,
        "break_end": null
      },
      "wednesday": {
        "closed": false,
        "open": "09:00",
        "close": "18:00",
        "break_start": "12:00",
        "break_end": "13:00"
      },
      "thursday": {
        "closed": false,
        "open": "09:00",
        "close": "18:00",
        "break_start": null,
        "break_end": null
      },
      "friday": {
        "closed": false,
        "open": "09:00",
        "close": "20:00",
        "break_start": null,
        "break_end": null
      },
      "saturday": {
        "closed": false,
        "open": "10:00",
        "close": "17:00",
        "break_start": null,
        "break_end": null
      },
      "sunday": {
        "closed": true,
        "open": "00:00",
        "close": "00:00",
        "break_start": null,
        "break_end": null
      }
    },
    "current_status": {
      "is_open": true,
      "current_day": "monday",
      "next_opening": null,
      "message": "현재 영업 중입니다 (오늘 18:00까지)"
    }
  },
  "message": "Operating hours retrieved successfully"
}
```

### 2.2 Update Operating Hours

#### Endpoint
```
PUT /api/shop/operating-hours
```

#### Authentication
- **Required**: Yes (JWT Bearer token)
- **Permissions**: Shop owner or admin for the authenticated shop
- **Rate Limit**: 10 requests per 5 minutes

#### Request Body Schema
```typescript
{
  "operating_hours": {
    "monday"?: {
      "closed": boolean,
      "open": string,              // HH:mm format
      "close": string,             // HH:mm format
      "break_start"?: string | null,
      "break_end"?: string | null
    },
    // ... other days (only include days you want to update)
  }
}
```

#### Request Example
```http
PUT /api/shop/operating-hours
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
Content-Type: application/json

{
  "operating_hours": {
    "monday": {
      "closed": false,
      "open": "09:00",
      "close": "18:00",
      "break_start": "12:00",
      "break_end": "13:00"
    },
    "friday": {
      "closed": false,
      "open": "09:00",
      "close": "20:00",
      "break_start": null,
      "break_end": null
    }
  }
}
```

#### Response Schema
Same as GET endpoint - returns updated operating hours with current status.

#### Validation Rules
1. **Time Format**: Must be valid HH:mm format (00:00 to 23:59)
2. **Time Logic**:
   - `close` time must be after `open` time (handle overnight hours if needed)
   - `break_start` must be between `open` and `close`
   - `break_end` must be after `break_start` and before `close`
3. **Closed Days**: If `closed: true`, `open` and `close` can be set to "00:00" (ignored)
4. **Break Time**: Both `break_start` and `break_end` must be provided together or both null

#### Error Responses

**400 Bad Request** (Validation Error)
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid operating hours format",
    "details": [
      {
        "field": "operating_hours.monday.close",
        "message": "Close time must be after open time"
      }
    ]
  }
}
```

**429 Too Many Requests** (Rate Limit)
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Please try again in 5 minutes.",
    "retry_after": 300
  }
}
```

### Implementation Notes

1. **Shop Identification**: Extract shopId from JWT token (authenticated user's shop)
2. **Partial Updates**: Support updating only specific days, not requiring all 7 days
3. **Current Status Calculation**:
   - Check current server time against operating hours
   - Consider timezone of the shop
   - Handle break times (shop is closed during breaks)
4. **Database Schema**: Store as JSONB column or separate table with day/time columns
5. **Validation**: Validate all time values before saving
6. **Audit Trail**: Log all operating hours changes with timestamp and user

---

## 3. Database Schema Recommendations

### reservations table
```sql
CREATE TABLE reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id),
  customer_id UUID NOT NULL REFERENCES users(id),
  staff_id UUID REFERENCES users(id),

  -- Scheduling
  reservation_date DATE NOT NULL,
  reservation_time TIME NOT NULL,
  duration_minutes INTEGER NOT NULL,

  -- Status
  status VARCHAR(50) NOT NULL CHECK (status IN (
    'requested', 'confirmed', 'completed',
    'cancelled_by_user', 'cancelled_by_shop', 'no_show'
  )),

  -- Payment
  total_amount DECIMAL(10,2) NOT NULL,
  paid_amount DECIMAL(10,2) DEFAULT 0,
  outstanding_amount DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,

  -- Metadata
  source VARCHAR(50) DEFAULT 'web',
  is_first_time BOOLEAN DEFAULT false,
  special_requests TEXT,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Indexes
  INDEX idx_shop_date (shop_id, reservation_date),
  INDEX idx_customer (customer_id),
  INDEX idx_status (status),
  INDEX idx_created_at (created_at)
);
```

### reservation_services table (many-to-many)
```sql
CREATE TABLE reservation_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id),
  quantity INTEGER DEFAULT 1,
  price DECIMAL(10,2) NOT NULL,

  INDEX idx_reservation (reservation_id),
  INDEX idx_service (service_id)
);
```

### shop_operating_hours table
```sql
CREATE TABLE shop_operating_hours (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES shops(id) UNIQUE,

  -- Weekly schedule stored as JSONB
  operating_hours JSONB NOT NULL,

  -- Example structure:
  -- {
  --   "monday": {"closed": false, "open": "09:00", "close": "18:00", "break_start": "12:00", "break_end": "13:00"},
  --   "tuesday": {"closed": false, "open": "09:00", "close": "18:00", "break_start": null, "break_end": null},
  --   ...
  -- }

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  INDEX idx_shop (shop_id)
);
```

---

## 4. SQL Query Examples

### Get Reservation Statistics
```sql
-- Today's statistics
SELECT
  COUNT(*) FILTER (WHERE DATE(reservation_date) = CURRENT_DATE) as today_reservations,
  COUNT(*) FILTER (WHERE DATE(reservation_date) = CURRENT_DATE AND status = 'confirmed') as today_confirmed,
  COUNT(*) FILTER (WHERE DATE(reservation_date) = CURRENT_DATE AND status = 'requested') as today_pending,
  COUNT(*) FILTER (WHERE DATE(reservation_date) = CURRENT_DATE AND status = 'completed') as today_completed,

  -- Monthly revenue
  SUM(total_amount) FILTER (
    WHERE DATE(reservation_date) >= DATE_TRUNC('month', CURRENT_DATE)
    AND status = 'completed'
  ) as monthly_revenue,

  -- Monthly reservations
  COUNT(*) FILTER (
    WHERE DATE(reservation_date) >= DATE_TRUNC('month', CURRENT_DATE)
  ) as monthly_reservations,

  -- Customers
  COUNT(DISTINCT customer_id) as total_customers,
  COUNT(DISTINCT customer_id) FILTER (
    WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)
  ) as new_customers_this_month

FROM reservations
WHERE shop_id = $1
  AND ($2::DATE IS NULL OR reservation_date >= $2)
  AND ($3::DATE IS NULL OR reservation_date <= $3);
```

### Get Current Shop Status
```sql
SELECT
  operating_hours,
  CASE
    WHEN (operating_hours->>TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE shop_timezone, 'Day'))::jsonb->>'closed' = 'true'
    THEN false
    WHEN TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE shop_timezone, 'HH24:MI') BETWEEN
         (operating_hours->>TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE shop_timezone, 'Day'))::jsonb->>'open' AND
         (operating_hours->>TO_CHAR(CURRENT_TIMESTAMP AT TIME ZONE shop_timezone, 'Day'))::jsonb->>'close'
    THEN true
    ELSE false
  END as is_open
FROM shop_operating_hours
WHERE shop_id = $1;
```

---

## 5. Testing Checklist

### Reservation Statistics Endpoint
- [ ] Returns correct statistics for admin user
- [ ] Returns 401 for unauthenticated requests
- [ ] Returns 403 for non-admin users
- [ ] Filters by shopId when provided
- [ ] Filters by date range when provided
- [ ] Handles missing shop gracefully (404)
- [ ] Returns 0 values for shops with no data
- [ ] Calculates revenue correctly (only completed reservations)
- [ ] Handles timezone correctly for date filtering

### Operating Hours Endpoints
- [ ] GET returns current operating hours for authenticated shop
- [ ] GET calculates current status correctly
- [ ] GET handles shops without configured hours
- [ ] PUT validates time format (HH:mm)
- [ ] PUT validates time logic (close > open)
- [ ] PUT validates break time logic
- [ ] PUT enforces rate limiting (10 req / 5 min)
- [ ] PUT returns updated hours immediately
- [ ] PUT creates audit trail entry
- [ ] Handles timezone correctly for current status

---

## 6. API Client Configuration

The frontend expects these environment variables:

```env
# Backend API base URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001

# For server-side API calls
API_BASE_URL=http://localhost:3001
```

All requests include:
- **Authorization Header**: `Bearer <JWT_TOKEN>`
- **Content-Type**: `application/json`
- **Accept**: `application/json`

---

## 7. Response Format Convention

All endpoints should follow this consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { /* endpoint-specific data */ },
  "message": "Success message",
  "meta": { /* optional metadata like pagination */ }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ /* optional validation errors */ ]
  }
}
```

---

## Next Steps

1. **Implement Backend Endpoints**: Use this spec to implement the missing endpoints in your backend service (port 3001)
2. **Test Endpoints**: Use the testing checklist to verify implementation
3. **Update Documentation**: Document any deviations from this spec
4. **Frontend Integration**: Once backend is ready, the frontend will automatically work (no changes needed)

---

## Contact & Support

If you need clarification on any endpoint specifications, please refer to:
- Frontend implementation in `/src/services/api/` directory
- TypeScript types in `/src/types/` directory
- React hooks in `/src/hooks/api/` directory
