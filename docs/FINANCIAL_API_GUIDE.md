# Financial API Query Guide

## Overview
The backend has **TWO separate admin payment route groups** that serve different purposes:
1. `/api/admin/payments` - **Detailed payment transactions** (list, export, refund)
2. `/api/admin/financial` - **Financial analytics & management** (overview, reports, point adjustments)

---

## 🔴 CRITICAL: The Error You're Seeing

**Your current query:**
```
GET /admin/financial/payments?page=1&limit=20
```

**❌ This endpoint doesn't exist!**

**✅ Correct endpoints:**
- For payment list: `GET /api/admin/payments?page=1&limit=20`
- For payment analytics: `GET /api/admin/financial/payments/overview?startDate=...&endDate=...`

---

## Payment Queries

### 1. Get Paginated Payment List
**Endpoint:** `GET /api/admin/payments`

**Purpose:** List all payment transactions with advanced filtering

**Query Parameters:**
```typescript
{
  // Pagination
  page?: number;           // Default: 1
  limit?: number;          // Default: 20, Max: 100

  // Filters
  status?: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'refunded';
  paymentMethod?: 'card' | 'transfer' | 'cash' | 'points';
  shopId?: string;         // UUID
  userId?: string;         // UUID
  startDate?: string;      // Date format: YYYY-MM-DD
  endDate?: string;        // Date format: YYYY-MM-DD
  minAmount?: number;
  maxAmount?: number;
  isDeposit?: boolean;
  hasRefund?: boolean;

  // Sorting
  sortBy?: 'paid_at' | 'created_at' | 'amount' | 'customer_name' | 'shop_name';
  sortOrder?: 'asc' | 'desc';
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/payments?page=1&limit=20&status=completed&sortBy=paid_at&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment-uuid",
        "reservationId": "reservation-uuid",
        "userId": "user-uuid",
        "paymentMethod": "card",
        "paymentStatus": "completed",
        "amount": 75000,
        "currency": "KRW",
        "isDeposit": false,
        "paidAt": "2025-10-07T10:30:00Z",
        "refundedAt": null,
        "refundAmount": 0,
        "netAmount": 75000,
        "customer": {
          "id": "user-uuid",
          "name": "홍길동",
          "email": "user@example.com",
          "phoneNumber": "010-1234-5678"
        },
        "shop": {
          "id": "shop-uuid",
          "name": "Beautiful Salon",
          "mainCategory": "HAIR",
          "shopStatus": "ACTIVE"
        },
        "reservation": {
          "id": "reservation-uuid",
          "reservationDate": "2025-10-10",
          "reservationTime": "14:00",
          "status": "confirmed",
          "totalAmount": 75000
        }
      }
    ],
    "totalCount": 150,
    "hasMore": true,
    "currentPage": 1,
    "totalPages": 8
  },
  "message": "Payments retrieved successfully"
}
```

---

### 2. Get Payment Summary (Analytics)
**Endpoint:** `GET /api/admin/payments/summary`

**Purpose:** Get aggregated payment statistics

**Query Parameters:**
```typescript
{
  startDate?: string;  // Date format: YYYY-MM-DD
  endDate?: string;    // Date format: YYYY-MM-DD
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/payments/summary?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPayments": 450,
    "totalAmount": 33750000,
    "totalRefunds": 1250000,
    "netRevenue": 32500000,
    "averagePaymentAmount": 75000,
    "paymentsByStatus": {
      "completed": 420,
      "pending": 15,
      "failed": 10,
      "refunded": 5
    },
    "paymentsByMethod": {
      "card": 350,
      "transfer": 50,
      "cash": 30,
      "points": 20
    },
    "paymentsByShop": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beautiful Salon",
        "count": 100,
        "amount": 7500000,
        "refunds": 150000,
        "netAmount": 7350000
      }
    ],
    "dailyPayments": [
      {
        "date": "2025-10-01",
        "count": 15,
        "amount": 1125000,
        "refunds": 0,
        "netAmount": 1125000
      }
    ]
  },
  "message": "Payment summary retrieved successfully"
}
```

---

### 3. Get Payment Details
**Endpoint:** `GET /api/admin/payments/:paymentId`

**Purpose:** Get detailed information for a specific payment

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/payments/payment-uuid-123" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:** Same structure as individual payment in the list above.

---

### 4. Export Payments (CSV)
**Endpoint:** `GET /api/admin/payments/export`

**Purpose:** Export payment data as CSV for external analysis

**Query Parameters:** Same as payment list endpoint

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/payments/export?startDate=2025-01-01&endDate=2025-12-31&status=completed" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -o payments.csv
```

**Response:** CSV file download

---

### 5. Get Payment Overview (Financial Dashboard)
**Endpoint:** `GET /api/admin/financial/payments/overview`

**Purpose:** Comprehensive payment analytics for dashboard monitoring

**Query Parameters:**
```typescript
{
  startDate?: string;  // ISO 8601 format: 2024-01-01T00:00:00Z
  endDate?: string;    // ISO 8601 format: 2024-12-31T23:59:59Z
  shopId?: string;     // UUID - filter by specific shop
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/financial/payments/overview?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalPayments": 1250000,
      "totalTransactions": 450,
      "successRate": 98.5,
      "averageTransactionValue": 75000
    },
    "trends": [
      {
        "period": "2024-10",
        "totalAmount": 3500000,
        "transactionCount": 120,
        "successRate": 99.2
      }
    ],
    "paymentMethods": {
      "card": { "count": 350, "amount": 26250000 },
      "transfer": { "count": 50, "amount": 3750000 },
      "cash": { "count": 30, "amount": 2250000 },
      "points": { "count": 20, "amount": 1500000 }
    },
    "shopBreakdown": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beautiful Salon",
        "totalAmount": 7500000,
        "transactionCount": 100,
        "averageAmount": 75000
      }
    ]
  }
}
```

---

## Point Queries

### 1. Get Point System Overview
**Endpoint:** `GET /api/admin/financial/points/overview`

**Purpose:** Get comprehensive point system analytics

**Query Parameters:**
```typescript
{
  startDate?: string;  // ISO 8601 format
  endDate?: string;    // ISO 8601 format
  userId?: string;     // UUID - filter by specific user
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/financial/points/overview?startDate=2024-01-01T00:00:00Z&endDate=2024-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalPointsIssued": 5000000,
    "totalPointsRedeemed": 3500000,
    "activePoints": 1200000,
    "expiredPoints": 300000,
    "userEngagement": {
      "activeUsers": 1500,
      "averagePointsPerUser": 800,
      "redemptionRate": 70.0
    },
    "trends": [
      {
        "period": "2024-10",
        "issued": 450000,
        "redeemed": 320000,
        "expired": 25000
      }
    ]
  }
}
```

---

### 2. Get Point Transaction List
**Endpoint:** `GET /api/admin/financial/points`

**Purpose:** List all point transactions with pagination

**Query Parameters:**
```typescript
{
  page?: number;      // Default: 1
  limit?: number;     // Default: 10, Max: 100
  type?: 'EARNED' | 'USED' | 'EXPIRED' | 'REFUNDED' | 'ADMIN_ADJUSTMENT';
  search?: string;    // Search by user name/ID
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/financial/points?page=1&limit=20&type=EARNED" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid",
        "userId": "user-uuid",
        "userName": "홍길동",
        "type": "EARNED",
        "amount": 1000,
        "balance": 5000,
        "reason": "Reservation completion",
        "createdAt": "2025-10-07T10:30:00Z"
      }
    ],
    "pagination": {
      "total": 1500,
      "page": 1,
      "limit": 20,
      "totalPages": 75
    },
    "summary": {
      "totalEarned": 5000000,
      "totalUsed": 3500000,
      "totalExpired": 300000
    }
  }
}
```

---

### 3. Get User Point Balance
**Endpoint:** `GET /api/users/:userId/points/balance`

**Purpose:** Get current point balance for a specific user

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/users/user-uuid-123/points/balance" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid-123",
    "totalPoints": 5000,
    "availablePoints": 4500,
    "pendingPoints": 500,
    "expiringSoon": {
      "points": 300,
      "expiryDate": "2025-11-01"
    }
  }
}
```

---

### 4. Get User Point History
**Endpoint:** `GET /api/users/:userId/points/history`

**Purpose:** Get point transaction history for a specific user

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/users/user-uuid-123/points/history" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid",
        "type": "EARNED",
        "amount": 1000,
        "balance": 5000,
        "reason": "Reservation completion",
        "createdAt": "2025-10-07T10:30:00Z"
      },
      {
        "id": "transaction-uuid-2",
        "type": "USED",
        "amount": -500,
        "balance": 4000,
        "reason": "Payment discount",
        "createdAt": "2025-10-06T15:20:00Z"
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20
    }
  }
}
```

---

### 5. Admin Point Adjustment
**Endpoint:** `POST /api/admin/financial/points/adjust`

**Purpose:** Manually adjust user points (add, subtract, expire)

**Request Body:**
```json
{
  "userId": "user-uuid",
  "amount": 1000,
  "adjustmentType": "add",
  "reason": "Customer service compensation",
  "category": "customer_service",
  "notes": "Compensation for service delay"
}
```

**Fields:**
- `userId` (required): UUID of the user
- `amount` (required): Points amount (1 - 1,000,000)
- `adjustmentType` (required): `"add"` | `"subtract"` | `"expire"`
- `reason` (required): 5-500 characters explanation
- `category` (required): `"customer_service"` | `"promotional"` | `"error_correction"` | `"system_maintenance"` | `"fraud_prevention"` | `"other"`
- `notes` (optional): Additional notes (max 1000 characters)

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/admin/financial/points/adjust" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-uuid-123",
    "amount": 1000,
    "adjustmentType": "add",
    "reason": "Customer service compensation for service delay",
    "category": "customer_service",
    "notes": "Approved by manager - ticket #12345"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactionId": "transaction-uuid",
    "userId": "user-uuid-123",
    "previousBalance": 4000,
    "newBalance": 5000,
    "adjustmentAmount": 1000,
    "reason": "Customer service compensation for service delay",
    "processedAt": "2025-10-07T10:30:00Z"
  },
  "message": "Point adjustment processed successfully"
}
```

---

## Refund Queries

### 1. Get Refund Management Overview
**Endpoint:** `GET /api/admin/financial/refunds`

**Purpose:** Get refund management overview with filters

**Query Parameters:**
```typescript
{
  status?: 'pending' | 'approved' | 'processing' | 'completed' | 'failed' | 'cancelled';
  startDate?: string;  // ISO 8601 format
  endDate?: string;    // ISO 8601 format
  shopId?: string;     // UUID
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/financial/refunds?status=pending&startDate=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "refunds": [
      {
        "id": "refund-uuid",
        "paymentId": "payment-uuid",
        "userId": "user-uuid",
        "shopId": "shop-uuid",
        "amount": 50000,
        "reason": "Service cancellation",
        "status": "pending",
        "requestedAt": "2025-10-07T09:00:00Z",
        "customer": {
          "name": "홍길동",
          "email": "user@example.com"
        },
        "shop": {
          "name": "Beautiful Salon"
        }
      }
    ],
    "summary": {
      "totalRefunds": 50,
      "totalAmount": 2500000,
      "pendingCount": 10,
      "completedCount": 38,
      "failedCount": 2
    }
  }
}
```

---

### 2. Process Payment Refund
**Endpoint:** `POST /api/admin/payments/:paymentId/refund`

**Purpose:** Process refund for a specific payment

**Request Body:**
```json
{
  "refundAmount": 50000,
  "reason": "Service cancellation by customer",
  "refundMethod": "original",
  "notes": "Refund approved - ticket #12345",
  "notifyCustomer": true
}
```

**Fields:**
- `refundAmount` (required): Amount to refund (must be ≤ original payment amount)
- `reason` (required): Reason for refund
- `refundMethod` (required): `"original"` (refund to original payment method) | `"points"` (refund as points)
- `notes` (optional): Additional notes for internal tracking
- `notifyCustomer` (optional): Whether to send notification to customer (default: true)

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/admin/payments/payment-uuid-123/refund" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refundAmount": 50000,
    "reason": "Service cancellation by customer",
    "refundMethod": "original",
    "notes": "Refund approved by manager - ticket #12345",
    "notifyCustomer": true
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "success": true,
    "refund": {
      "id": "refund-uuid",
      "paymentId": "payment-uuid-123",
      "refundAmount": 50000,
      "reason": "Service cancellation by customer",
      "refundMethod": "original",
      "status": "processed",
      "processedAt": "2025-10-07T10:30:00Z"
    },
    "payment": {
      "previousStatus": "completed",
      "newStatus": "refunded",
      "updatedAt": "2025-10-07T10:30:00Z"
    }
  },
  "message": "Refund processed successfully"
}
```

---

## Financial Reports

### 1. Generate Financial Report
**Endpoint:** `POST /api/admin/financial/reports/generate`

**Purpose:** Generate comprehensive financial reports

**Request Body:**
```json
{
  "startDate": "2025-01-01T00:00:00Z",
  "endDate": "2025-12-31T23:59:59Z",
  "reportType": "summary",
  "shopIds": ["shop-uuid-1", "shop-uuid-2"],
  "includeRefunds": true,
  "includePoints": true,
  "format": "json"
}
```

**Fields:**
- `startDate` (required): ISO 8601 format
- `endDate` (required): ISO 8601 format
- `reportType` (required): `"summary"` | `"detailed"` | `"shop_breakdown"` | `"point_analysis"`
- `shopIds` (optional): Array of shop UUIDs to include
- `includeRefunds` (optional): Include refund data (default: true)
- `includePoints` (optional): Include point transaction data (default: true)
- `format` (optional): `"json"` | `"csv"` | `"excel"` (default: "json")

**Example Request:**
```bash
curl -X POST "http://localhost:3001/api/admin/financial/reports/generate" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-01-01T00:00:00Z",
    "endDate": "2025-12-31T23:59:59Z",
    "reportType": "summary",
    "includeRefunds": true,
    "includePoints": true,
    "format": "json"
  }'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "report": {
      "period": {
        "startDate": "2025-01-01T00:00:00Z",
        "endDate": "2025-12-31T23:59:59Z"
      },
      "payments": {
        "totalAmount": 50000000,
        "totalTransactions": 1500,
        "averageAmount": 33333,
        "byMethod": {
          "card": 38000000,
          "transfer": 7500000,
          "cash": 3000000,
          "points": 1500000
        }
      },
      "refunds": {
        "totalAmount": 2500000,
        "totalTransactions": 50,
        "refundRate": 5.0
      },
      "points": {
        "totalIssued": 5000000,
        "totalRedeemed": 1500000,
        "activeBalance": 3200000
      },
      "netRevenue": 47500000
    },
    "reportId": "report-uuid",
    "generatedAt": "2025-10-07T10:30:00Z"
  },
  "message": "Financial report generated successfully"
}
```

---

## Shop Payout Calculations

### Calculate Shop Payout
**Endpoint:** `GET /api/admin/financial/payouts/calculate/:shopId`

**Purpose:** Calculate payout for a specific shop

**Query Parameters:**
```typescript
{
  startDate?: string;  // ISO 8601 format
  endDate?: string;    // ISO 8601 format
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/financial/payouts/calculate/shop-uuid-123?startDate=2025-01-01T00:00:00Z&endDate=2025-12-31T23:59:59Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "shopId": "shop-uuid-123",
    "shopName": "Beautiful Salon",
    "period": {
      "startDate": "2025-01-01T00:00:00Z",
      "endDate": "2025-12-31T23:59:59Z"
    },
    "revenue": {
      "grossRevenue": 10000000,
      "completedReservations": 200,
      "averageReservationValue": 50000
    },
    "deductions": {
      "platformCommission": 1000000,
      "commissionRate": 10.0,
      "refunds": 250000,
      "chargebacks": 50000
    },
    "payout": {
      "netPayout": 8700000,
      "payoutStatus": "pending",
      "estimatedPayoutDate": "2025-11-15"
    }
  },
  "message": "Shop payout calculated successfully"
}
```

---

## Settlement Reports

### Get Settlement Report
**Endpoint:** `GET /api/admin/payments/settlements`

**Purpose:** Get comprehensive settlement report for all shops

**Query Parameters:**
```typescript
{
  startDate?: string;  // Date format: YYYY-MM-DD
  endDate?: string;    // Date format: YYYY-MM-DD
}
```

**Example Request:**
```bash
curl -X GET "http://localhost:3001/api/admin/payments/settlements?startDate=2025-01-01&endDate=2025-12-31" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beautiful Salon",
        "shopType": "HAIR",
        "commissionRate": 10.0,
        "completedReservations": 200,
        "grossRevenue": 10000000,
        "commissionAmount": 1000000,
        "netPayout": 9000000,
        "lastSettlementDate": "2025-09-15T00:00:00Z",
        "nextSettlementDate": "2025-10-15T00:00:00Z",
        "isEligibleForSettlement": true
      }
    ],
    "summary": {
      "totalShops": 50,
      "totalGrossRevenue": 500000000,
      "totalCommissionAmount": 50000000,
      "totalNetPayout": 450000000,
      "averageCommissionRate": 10.0
    },
    "dateRange": {
      "startDate": "2025-01-01",
      "endDate": "2025-12-31"
    }
  },
  "message": "Settlement report retrieved successfully"
}
```

---

## Authentication

All endpoints require JWT authentication via Bearer token:
```bash
Authorization: Bearer YOUR_JWT_TOKEN
```

Admin role is required for all financial endpoints.

---

## Rate Limits

- Payment list: 100 requests / 15 minutes
- Payment summary: 50 requests / 15 minutes
- Payment analytics: 30 requests / 15 minutes
- Payment export: 10 requests / 15 minutes (resource-intensive)
- Refund processing: 20 requests / 15 minutes
- Point adjustments: 50 requests / 15 minutes

---

## Error Responses

All endpoints follow standard error response format:
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {
      // Additional error context
    }
  }
}
```

**Common Error Codes:**
- `UNAUTHORIZED` - Missing or invalid authentication token
- `FORBIDDEN` - Insufficient permissions (not admin)
- `NOT_FOUND` - Resource not found
- `VALIDATION_ERROR` - Invalid request parameters
- `INTERNAL_ERROR` - Server error

---

## Quick Reference

### Payment Endpoints
```
GET  /api/admin/payments                           - List payments
GET  /api/admin/payments/summary                   - Payment summary
GET  /api/admin/payments/settlements               - Settlement report
GET  /api/admin/payments/analytics                 - Payment analytics
GET  /api/admin/payments/export                    - Export payments (CSV)
GET  /api/admin/payments/:paymentId                - Payment details
POST /api/admin/payments/:paymentId/refund         - Process refund

GET  /api/admin/financial/payments/overview        - Payment overview (dashboard)
```

### Point Endpoints
```
GET  /api/admin/financial/points                   - List point transactions
GET  /api/admin/financial/points/overview          - Point system overview
POST /api/admin/financial/points/adjust            - Admin point adjustment

GET  /api/users/:userId/points/balance             - User point balance
GET  /api/users/:userId/points/history             - User point history
```

### Financial Management
```
GET  /api/admin/financial/refunds                  - Refund overview
POST /api/admin/financial/reports/generate         - Generate financial report
GET  /api/admin/financial/payouts/calculate/:shopId - Calculate shop payout
```

---

## Testing Examples

### Test Payment List Query
```bash
# Basic query
curl "http://localhost:3001/api/admin/payments?page=1&limit=20" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Filtered query
curl "http://localhost:3001/api/admin/payments?status=completed&paymentMethod=card&startDate=2025-01-01&sortBy=paid_at&sortOrder=desc" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Point Overview
```bash
curl "http://localhost:3001/api/admin/financial/points/overview?startDate=2024-01-01T00:00:00Z" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Refund Processing
```bash
curl -X POST "http://localhost:3001/api/admin/payments/PAYMENT_ID/refund" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "refundAmount": 50000,
    "reason": "Service cancellation",
    "refundMethod": "original"
  }'
```

---

## Notes

1. **Date Formats:**
   - `/api/admin/payments/*` endpoints use simple date format: `YYYY-MM-DD`
   - `/api/admin/financial/*` endpoints use ISO 8601 format: `YYYY-MM-DDTHH:mm:ssZ`

2. **Pagination:**
   - Default page size is usually 10-20
   - Maximum limit varies by endpoint (typically 100)

3. **Performance:**
   - Use export endpoints for large datasets
   - Analytics endpoints are optimized for dashboard use
   - Settlement calculations may take time for large date ranges

4. **Best Practices:**
   - Always specify date ranges for analytics queries
   - Use appropriate pagination limits
   - Cache summary data when possible
   - Use export for bulk data retrieval
