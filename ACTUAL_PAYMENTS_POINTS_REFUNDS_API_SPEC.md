# Payments, Points, and Refunds - Backend API Specification

## Overview

This document specifies **exactly** how the backend provides data for Payments, Points, and Refunds features. All field names are in **snake_case** (matching database schema).

**Important**: The frontend will transform snake_case → camelCase at the service layer.

---

## Table of Contents

1. [Mock Data Summary](#mock-data-summary)
2. [Payment API](#payment-api)
3. [Point System API](#point-system-api)
4. [Refund API](#refund-api)
5. [Admin Payment Management](#admin-payment-management)
6. [Frontend Integration Guide](#frontend-integration-guide)
7. [TossPayments Integration Flow](#tosspayments-integration-flow)

---

## Mock Data Summary

**Database contains actual test data:**
- **7 payments** - fully seeded with various statuses (fully_paid, pending, etc.)
- **124 point transactions** - earn and use transactions
- **0 refunds** - table exists but empty (can be populated if needed)

### Sample Payment Data (snake_case):
```json
{
  "id": "7ff2760f-6fc1-449b-ab18-88aeaf46eee8",
  "reservation_id": "9d3971e4-7a7b-4544-a1b7-b1575185027e",
  "user_id": "2e72b09c-08a8-4d33-b5b0-7a1003a0df97",
  "amount": 10000,
  "payment_status": "fully_paid",
  "payment_stage": "deposit",
  "is_deposit": true,
  "payment_method": "card",
  "paid_at": "2025-10-02T05:10:07.859196+00:00",
  "version": 1,
  "reminder_sent_at": null,
  "reminder_count": 0
}
```

### Sample Point Transaction Data (snake_case):
```json
{
  "id": "77c8d423-082a-4c50-a784-9bb20057ce1d",
  "user_id": "4c635487-4756-4163-a81f-e48565c398e2",
  "amount": 10000,
  "transaction_type": "earn",
  "description": "회원가입 축하 포인트",
  "status": "completed",
  "created_at": "2025-09-20T01:00:00+00:00"
}
```

---

## Payment API

### Two-Stage Payment System

The platform uses a **two-stage payment system**:
1. **Deposit Payment** (20-30% of total amount) - Paid at reservation time
2. **Final Payment** (remaining 70-80%) - Paid after service completion

### Payment Statuses
- `pending` - Payment initiated but not completed
- `deposit_paid` - Deposit payment completed
- `fully_paid` - Full payment completed (both deposit and final)
- `partially_paid` - Partial payment received
- `failed` - Payment failed
- `refunded` - Payment has been refunded

### Payment Stages
- `deposit` - Initial deposit payment
- `final` - Final payment after service completion

### 1. Initialize Payment (TossPayments)

**Endpoint**: `POST /api/payments/toss/prepare`

**Request Body**:
```json
{
  "reservationId": "uuid",
  "amount": 50000,
  "isDeposit": true,
  "successUrl": "https://app.reviewthing.com/payment/success",
  "failUrl": "https://app.reviewthing.com/payment/fail"
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "payment_key": "tgen_20241015_...",
    "order_id": "order_20241015_123456",
    "checkout_url": "https://pay.toss.im/...",
    "payment_id": "uuid",
    "amount": 50000,
    "is_deposit": true,
    "payment_stage": "deposit",
    "reservation_id": "uuid",
    "reservation_status": "pending"
  }
}
```

### 2. Prepare Deposit Payment

**Endpoint**: `POST /api/payments/deposit/prepare`

**Request Body**:
```json
{
  "reservationId": "uuid",
  "depositAmount": 15000,
  "successUrl": "https://...",
  "failUrl": "https://..."
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "order_id": "order_20241015_...",
    "checkout_url": "https://pay.toss.im/...",
    "payment_key": "tgen_...",
    "amount": 15000,
    "payment_stage": "deposit",
    "is_deposit": true
  }
}
```

### 3. Prepare Final Payment

**Endpoint**: `POST /api/payments/final/prepare`

**Request Body**:
```json
{
  "reservationId": "uuid",
  "successUrl": "https://...",
  "failUrl": "https://..."
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "order_id": "order_20241015_...",
    "checkout_url": "https://pay.toss.im/...",
    "payment_key": "tgen_...",
    "amount": 35000,
    "payment_stage": "final",
    "is_deposit": false,
    "remaining_amount": 35000
  }
}
```

### 4. Confirm Payment

**Endpoint**: `POST /api/payments/toss/confirm`

**Request Body**:
```json
{
  "paymentKey": "tgen_20241015_...",
  "orderId": "order_20241015_...",
  "amount": 50000
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "payment_id": "uuid",
    "status": "fully_paid",
    "transaction_id": "txn_...",
    "approved_at": "2025-01-15T10:30:00Z",
    "receipt_url": "https://...",
    "amount": 50000,
    "order_id": "order_20241015_...",
    "reservation_status": "confirmed",
    "notification_sent": true,
    "receipt_generated": true,
    "audit_log_id": "uuid",
    "payment_stage": "deposit",
    "is_deposit": true
  }
}
```

### 5. Get Payment Status Summary

**Endpoint**: `GET /api/payments/status/:reservationId`

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "reservation_id": "uuid",
    "total_amount": 50000,
    "deposit_required": 15000,
    "final_amount": 35000,

    "deposit_payment": {
      "payment_id": "uuid",
      "status": "deposit_paid",
      "amount": 15000,
      "paid_at": "2025-01-15T10:30:00Z",
      "payment_method": "card"
    },

    "final_payment": {
      "payment_id": "uuid",
      "status": "pending",
      "amount": 35000,
      "due_date": "2025-01-20T15:00:00Z"
    },

    "overall_status": "deposit_paid",
    "is_fully_paid": false,
    "total_paid": 15000,
    "remaining_balance": 35000,
    "next_payment_due": "2025-01-20T15:00:00Z"
  }
}
```

### 6. Get Payment Details

**Endpoint**: `GET /api/payments/:paymentId`

**Response** (snake_case with nested relationships):
```json
{
  "success": true,
  "data": {
    "payment": {
      "id": "uuid",
      "amount": 50000,
      "currency": "KRW",
      "payment_method": "card",
      "payment_status": "fully_paid",
      "payment_stage": "deposit",
      "is_deposit": true,
      "paid_at": "2025-01-15T10:30:00Z",
      "refunded_at": null,
      "refund_amount": 0,
      "failure_reason": null,
      "metadata": {
        "provider": "tosspayments",
        "payment_key": "tgen_..."
      },
      "created_at": "2025-01-15T10:25:00Z",
      "updated_at": "2025-01-15T10:30:00Z"
    },

    "reservation": {
      "id": "uuid",
      "date": "2025-01-20",
      "time": "15:00",
      "total_amount": 50000,
      "deposit_amount": 15000,
      "status": "confirmed",
      "shop": {
        "name": "Beauty Salon ABC",
        "address": "서울시 강남구..."
      }
    }
  }
}
```

### 7. Get User Payment History

**Endpoint**: `GET /api/payments/user/:userId?page=1&limit=10&status=fully_paid`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 10, max: 100)
- `status` (optional): `pending`, `deposit_paid`, `fully_paid`, `failed`, `refunded`

**Response** (snake_case with pagination):
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "uuid",
        "amount": 50000,
        "currency": "KRW",
        "payment_method": "card",
        "payment_status": "fully_paid",
        "payment_stage": "deposit",
        "is_deposit": true,
        "paid_at": "2025-01-15T10:30:00Z",
        "refunded_at": null,
        "refund_amount": 0,
        "failure_reason": null,
        "created_at": "2025-01-15T10:25:00Z",

        "reservation": {
          "id": "uuid",
          "date": "2025-01-20",
          "time": "15:00",
          "total_amount": 50000,
          "deposit_amount": 15000,
          "status": "confirmed",
          "shop": {
            "name": "Beauty Salon ABC",
            "address": "서울시 강남구..."
          }
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 45,
      "total_pages": 5
    }
  }
}
```

---

## Point System API

### Point Transaction Types
- **Earning**:
  - `earned_service` - Points earned after service completion
  - `earned_referral` - Points earned from referral
  - `influencer_bonus` - Bonus points for influencers
- **Usage**:
  - `used_service` - Points used for payment
- **Admin**:
  - `adjusted` - Manual admin adjustment (add/subtract)

### Point Transaction Statuses
- `completed` - Transaction completed
- `pending` - Transaction pending
- `cancelled` - Transaction cancelled
- `expired` - Points expired

### 1. Get Point Balance

**Endpoint**: `GET /api/users/:userId/points/balance`

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "user_id": "uuid",
    "available_balance": 15000,
    "pending_balance": 3000,
    "total_earned": 50000,
    "total_used": 35000,
    "total_expired": 0,
    "expiring_soon": {
      "amount": 2000,
      "expiry_date": "2025-02-15"
    },
    "last_transaction_at": "2025-01-15T10:30:00Z"
  }
}
```

### 2. Get Point Transaction History

**Endpoint**: `GET /api/users/:userId/points/history?page=1&limit=20&transactionType=earn&status=completed`

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20, max: 100)
- `transactionType` (optional): `earn`, `use`, `adjusted`
- `status` (optional): `completed`, `pending`, `cancelled`, `expired`
- `startDate` (optional): ISO 8601 date string
- `endDate` (optional): ISO 8601 date string

**Response** (snake_case with pagination):
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "user_id": "uuid",
        "transaction_type": "earned_service",
        "amount": 5000,
        "balance_after": 15000,
        "description": "네일 서비스 완료 포인트 적립",
        "status": "completed",
        "reservation_id": "uuid",
        "expires_at": "2026-01-15T00:00:00Z",
        "metadata": {
          "service_name": "젤네일",
          "shop_name": "Beauty Salon ABC"
        },
        "created_at": "2025-01-15T10:30:00Z"
      },
      {
        "id": "uuid",
        "user_id": "uuid",
        "transaction_type": "used_service",
        "amount": -3000,
        "balance_after": 10000,
        "description": "서비스 결제 사용",
        "status": "completed",
        "reservation_id": "uuid",
        "metadata": {
          "payment_id": "uuid",
          "service_name": "속눈썹 연장"
        },
        "created_at": "2025-01-14T15:20:00Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 124,
      "total_pages": 7
    },
    "summary": {
      "total_earned": 50000,
      "total_used": 35000,
      "net_balance": 15000
    }
  }
}
```

### 3. Use Points

**Endpoint**: `POST /api/points/use`

**Request Body**:
```json
{
  "amount": 5000,
  "reservationId": "uuid",
  "description": "서비스 결제 포인트 사용"
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "transaction_type": "used_service",
    "amount": -5000,
    "balance_after": 10000,
    "description": "서비스 결제 포인트 사용",
    "status": "completed",
    "reservation_id": "uuid",
    "created_at": "2025-01-15T10:30:00Z"
  },
  "message": "포인트가 성공적으로 사용되었습니다."
}
```

**Error Response - Insufficient Points**:
```json
{
  "success": false,
  "error": {
    "code": "INSUFFICIENT_POINTS",
    "message": "사용 가능한 포인트가 부족합니다.",
    "details": "사용 가능한 포인트: 3000원, 요청한 포인트: 5000원"
  }
}
```

### 4. Earn Points (System/Admin Only)

**Endpoint**: `POST /api/points/earn`

**Request Body**:
```json
{
  "userId": "uuid",
  "transactionType": "earned_service",
  "amount": 5000,
  "description": "서비스 완료 포인트 적립",
  "reservationId": "uuid",
  "metadata": {
    "service_name": "젤네일",
    "shop_name": "Beauty Salon ABC"
  }
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "user_id": "uuid",
    "transaction_type": "earned_service",
    "amount": 5000,
    "balance_after": 15000,
    "description": "서비스 완료 포인트 적립",
    "status": "completed",
    "expires_at": "2026-01-15T00:00:00Z",
    "created_at": "2025-01-15T10:30:00Z"
  },
  "message": "포인트가 성공적으로 적립되었습니다."
}
```

### 5. Admin Point Adjustment

**Endpoint**: `POST /api/admin/points/adjust`

**Request Body**:
```json
{
  "userId": "uuid",
  "amount": 10000,
  "type": "add",
  "reason": "고객 보상 포인트 지급"
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "transaction": {
      "id": "uuid",
      "user_id": "uuid",
      "transaction_type": "adjusted",
      "amount": 10000,
      "description": "포인트 추가: 고객 보상 포인트 지급",
      "status": "completed",
      "created_at": "2025-01-15T10:30:00Z"
    },
    "adjustment": {
      "id": "uuid",
      "user_id": "uuid",
      "amount": 10000,
      "type": "add",
      "reason": "고객 보상 포인트 지급",
      "previous_balance": 15000,
      "new_balance": 25000,
      "adjusted_by": "admin_uuid",
      "created_at": "2025-01-15T10:30:00Z"
    }
  },
  "message": "포인트가 성공적으로 조정되었습니다."
}
```

---

## Refund API

### Refund Types
- `full` - Full refund
- `partial` - Partial refund

### Refund Reasons
- `cancelled_by_customer` - Customer requested cancellation
- `service_issue` - Service quality/issue
- `shop_cancelled` - Shop cancelled the reservation
- `no_show` - Customer no-show (may have penalties)
- `double_booking` - Duplicate booking error
- `other` - Other reasons

### Refund Statuses
- `pending` - Refund requested, awaiting approval
- `approved` - Refund approved by admin
- `rejected` - Refund rejected
- `processing` - Refund being processed by payment provider
- `completed` - Refund completed successfully
- `failed` - Refund processing failed

### Refund Methods
- `original` - Refund to original payment method (default)
- `bank_transfer` - Bank transfer refund
- `point_return` - Return as points

### 1. Create Refund Request

**Endpoint**: `POST /api/refunds/request`

**Request Body**:
```json
{
  "paymentId": "uuid",
  "refundType": "full",
  "refundReason": "cancelled_by_customer",
  "refundReasonDetails": "개인 사정으로 인한 취소",
  "customerNotes": "다음 기회에 다시 예약하겠습니다",
  "refundMethod": "original"
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "refund_id": "uuid",
    "status": "pending",
    "requested_amount": 50000,
    "refund_method": "original",
    "message": "환불 요청이 성공적으로 제출되었습니다."
  }
}
```

### 2. Get Refund Status

**Endpoint**: `GET /api/refunds/:refundId/status`

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "refund_id": "uuid",
    "payment_id": "uuid",
    "reservation_id": "uuid",
    "user_id": "uuid",
    "refund_type": "full",
    "refund_reason": "cancelled_by_customer",
    "requested_amount": 50000,
    "approved_amount": 45000,
    "refunded_amount": 45000,
    "refund_status": "completed",
    "refund_method": "original",
    "requested_at": "2025-01-15T10:30:00Z",
    "approved_at": "2025-01-15T11:00:00Z",
    "processed_at": "2025-01-15T11:15:00Z",
    "completed_at": "2025-01-15T11:20:00Z",
    "admin_notes": "환불 수수료 5,000원 차감",
    "customer_notes": "개인 사정으로 인한 취소",
    "is_eligible_for_refund": true,
    "refund_policy": {
      "policy_id": "uuid",
      "policy_name": "Standard Refund Policy",
      "refund_percentage": 90,
      "cancellation_window": "24시간 전 취소",
      "penalties": "예약 24시간 이내 취소 시 10% 수수료"
    }
  }
}
```

### 3. Calculate Refund Amount

**Endpoint**: `POST /api/refunds/calculate`

**Request Body**:
```json
{
  "reservationId": "uuid",
  "cancellationType": "user_request",
  "cancellationReason": "개인 사정",
  "refundPreference": "full_refund"
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "is_eligible": true,
    "refund_amount": 45000,
    "refund_percentage": 90,
    "base_percentage": 100,
    "adjustment_percentage": -10,
    "cancellation_window": "24시간 이내",
    "reason": "예약 24시간 이내 취소로 인한 10% 수수료 적용",
    "policy_applied": "Standard Refund Policy",

    "korean_time_info": {
      "current_time": "2025-01-19T14:30:00+09:00",
      "reservation_time": "2025-01-20T15:00:00+09:00",
      "time_zone": "Asia/Seoul"
    },

    "business_rules": {
      "applied_policies": [
        "24시간 전 취소 규정",
        "예약금 비환불 정책"
      ],
      "exceptions": [],
      "notes": [
        "서비스 3일 전 취소 시 100% 환불",
        "24시간 전 취소 시 90% 환불",
        "당일 취소 시 50% 환불"
      ]
    },

    "audit_trail": {
      "calculated_at": "2025-01-19T14:30:00Z",
      "calculated_by": "system",
      "reservation_id": "uuid",
      "cancellation_type": "user_request"
    }
  }
}
```

---

## Admin Payment Management

### 1. Get All Payments (Admin)

**Endpoint**: `GET /api/admin/payments?status=fully_paid&page=1&limit=20`

**Query Parameters**:
- `status` (optional): `pending`, `deposit_paid`, `fully_paid`, `failed`, `refunded`
- `paymentMethod` (optional): `card`, `transfer`, `point`
- `shopId` (optional): Filter by shop
- `userId` (optional): Filter by user
- `startDate`, `endDate` (optional): Date range filter
- `minAmount`, `maxAmount` (optional): Amount range filter
- `isDeposit` (optional): `true` or `false`
- `hasRefund` (optional): `true` or `false`
- `sortBy` (optional): `created_at`, `amount`, `paid_at`
- `sortOrder` (optional): `asc`, `desc`
- `page`, `limit` (pagination)

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "uuid",
        "reservation_id": "uuid",
        "user_id": "uuid",
        "amount": 50000,
        "currency": "KRW",
        "payment_method": "card",
        "payment_status": "fully_paid",
        "payment_stage": "deposit",
        "is_deposit": true,
        "paid_at": "2025-01-15T10:30:00Z",
        "refunded_at": null,
        "refund_amount": 0,
        "net_amount": 50000,
        "failure_reason": null,
        "created_at": "2025-01-15T10:25:00Z",

        "customer": {
          "id": "uuid",
          "name": "김지은",
          "email": "test@example.com",
          "phone_number": "+82-10-1234-5678"
        },

        "shop": {
          "id": "uuid",
          "name": "Beauty Salon ABC",
          "phone_number": "+82-10-9876-5432"
        },

        "reservation": {
          "id": "uuid",
          "reservation_date": "2025-01-20",
          "status": "confirmed"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 156,
      "total_pages": 8,
      "has_more": true
    },
    "filters": {
      "status": "fully_paid",
      "sortBy": "created_at",
      "sortOrder": "desc"
    }
  },
  "message": "결제 내역을 성공적으로 조회했습니다."
}
```

### 2. Get Payment Summary (Admin)

**Endpoint**: `GET /api/admin/payments/summary?startDate=2025-01-01&endDate=2025-01-31`

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "total_payments": 156,
    "total_amount": 7800000,
    "total_refunded": 450000,
    "net_revenue": 7350000,

    "by_status": {
      "pending": 12,
      "deposit_paid": 45,
      "fully_paid": 89,
      "failed": 8,
      "refunded": 2
    },

    "by_method": {
      "card": 120,
      "transfer": 30,
      "point": 6
    },

    "average_payment_amount": 50000,
    "median_payment_amount": 45000,

    "daily_trends": [
      {
        "date": "2025-01-15",
        "payment_count": 8,
        "total_amount": 400000,
        "refund_count": 1,
        "refund_amount": 45000
      }
    ],

    "top_performing_shops": [
      {
        "shop_id": "uuid",
        "shop_name": "Beauty Salon ABC",
        "payment_count": 45,
        "total_amount": 2250000
      }
    ]
  },
  "message": "결제 요약 정보를 성공적으로 조회했습니다."
}
```

### 3. Process Refund (Admin)

**Endpoint**: `POST /api/admin/payments/:paymentId/refund`

**Request Body**:
```json
{
  "refundAmount": 45000,
  "reason": "고객 요청에 따른 환불",
  "refundMethod": "original",
  "notes": "10% 수수료 차감 후 환불",
  "notifyCustomer": true
}
```

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "refund_id": "uuid",
    "payment_id": "uuid",
    "refund_amount": 45000,
    "refund_status": "processing",
    "refund_method": "original",
    "estimated_completion": "2025-01-18T00:00:00Z",
    "admin_notes": "10% 수수료 차감 후 환불",
    "processed_at": "2025-01-15T11:15:00Z"
  },
  "message": "환불이 성공적으로 처리되었습니다."
}
```

### 4. Get Payment Analytics (Admin)

**Endpoint**: `GET /api/admin/payments/analytics?startDate=2025-01-01&endDate=2025-01-31`

**Response** (snake_case):
```json
{
  "success": true,
  "data": {
    "overview": {
      "total_revenue": 7800000,
      "payment_count": 156,
      "refund_rate": 2.5,
      "average_transaction_value": 50000
    },

    "payment_method_breakdown": {
      "card": {
        "count": 120,
        "amount": 6000000,
        "percentage": 76.9
      },
      "transfer": {
        "count": 30,
        "amount": 1500000,
        "percentage": 19.2
      },
      "point": {
        "count": 6,
        "amount": 300000,
        "percentage": 3.8
      }
    },

    "time_series": [
      {
        "period": "2025-01-15",
        "payment_count": 8,
        "amount": 400000,
        "average_amount": 50000
      }
    ],

    "failure_analysis": {
      "total_failed": 8,
      "failure_rate": 5.1,
      "common_reasons": [
        {
          "reason": "카드 한도 초과",
          "count": 3
        },
        {
          "reason": "승인 거부",
          "count": 5
        }
      ]
    }
  },
  "message": "결제 분석 데이터를 성공적으로 조회했습니다."
}
```

### 5. Export Payments (Admin CSV Download)

**Endpoint**: `GET /api/admin/payments/export?startDate=2025-01-01&endDate=2025-01-31`

**Response**: CSV file download

**CSV Format**:
```csv
Payment ID,Reservation ID,Customer Name,Customer Email,Shop Name,Payment Method,Payment Status,Amount,Currency,Is Deposit,Paid At,Refunded At,Refund Amount,Net Amount,Failure Reason,Created At
uuid,uuid,김지은,test@example.com,Beauty Salon ABC,card,fully_paid,50000,KRW,true,2025-01-15T10:30:00Z,,0,50000,,2025-01-15T10:25:00Z
```

---

## Frontend Integration Guide

### Transform Function Example

```typescript
// Backend types (snake_case)
interface BackendPayment {
  id: string;
  reservation_id: string;
  user_id: string;
  amount: number;
  payment_status: string;
  payment_stage: string;
  is_deposit: boolean;
  payment_method: string;
  paid_at: string;
  refunded_at: string | null;
  refund_amount: number;
  created_at: string;
  updated_at: string;
}

// Frontend types (camelCase)
interface FrontendPayment {
  id: string;
  reservationId: string;
  userId: string;
  amount: number;
  paymentStatus: string;
  paymentStage: string;
  isDeposit: boolean;
  paymentMethod: string;
  paidAt: string;
  refundedAt: string | null;
  refundAmount: number;
  createdAt: string;
  updatedAt: string;
}

// Transform function
function transformPayment(data: BackendPayment): FrontendPayment {
  return {
    id: data.id,
    reservationId: data.reservation_id,
    userId: data.user_id,
    amount: data.amount,
    paymentStatus: data.payment_status,
    paymentStage: data.payment_stage,
    isDeposit: data.is_deposit,
    paymentMethod: data.payment_method,
    paidAt: data.paid_at,
    refundedAt: data.refunded_at,
    refundAmount: data.refund_amount,
    createdAt: data.created_at,
    updatedAt: data.updated_at
  };
}

// Point transaction transform
interface BackendPointTransaction {
  id: string;
  user_id: string;
  transaction_type: string;
  amount: number;
  balance_after: number;
  description: string;
  status: string;
  reservation_id: string | null;
  expires_at: string | null;
  created_at: string;
}

interface FrontendPointTransaction {
  id: string;
  userId: string;
  transactionType: string;
  amount: number;
  balanceAfter: number;
  description: string;
  status: string;
  reservationId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function transformPointTransaction(data: BackendPointTransaction): FrontendPointTransaction {
  return {
    id: data.id,
    userId: data.user_id,
    transactionType: data.transaction_type,
    amount: data.amount,
    balanceAfter: data.balance_after,
    description: data.description,
    status: data.status,
    reservationId: data.reservation_id,
    expiresAt: data.expires_at,
    createdAt: data.created_at
  };
}

// Refund transform
interface BackendRefund {
  refund_id: string;
  payment_id: string;
  refund_status: string;
  refund_type: string;
  refund_reason: string;
  requested_amount: number;
  approved_amount: number;
  refunded_amount: number;
  refund_method: string;
  requested_at: string;
  approved_at: string | null;
  completed_at: string | null;
}

interface FrontendRefund {
  refundId: string;
  paymentId: string;
  refundStatus: string;
  refundType: string;
  refundReason: string;
  requestedAmount: number;
  approvedAmount: number;
  refundedAmount: number;
  refundMethod: string;
  requestedAt: string;
  approvedAt: string | null;
  completedAt: string | null;
}

function transformRefund(data: BackendRefund): FrontendRefund {
  return {
    refundId: data.refund_id,
    paymentId: data.payment_id,
    refundStatus: data.refund_status,
    refundType: data.refund_type,
    refundReason: data.refund_reason,
    requestedAmount: data.requested_amount,
    approvedAmount: data.approved_amount,
    refundedAmount: data.refunded_amount,
    refundMethod: data.refund_method,
    requestedAt: data.requested_at,
    approvedAt: data.approved_at,
    completedAt: data.completed_at
  };
}
```

### Usage in Frontend Service

```typescript
// Payment service
async function getPaymentDetails(paymentId: string) {
  const response = await apiService.get(`/api/payments/${paymentId}`);

  // Response is already unwrapped by interceptor
  const { payment, reservation } = response;

  // Transform to camelCase
  const transformedPayment = transformPayment(payment);

  return {
    payment: transformedPayment,
    reservation: transformReservation(reservation)
  };
}

// Point service
async function getPointHistory(userId: string, page: number = 1) {
  const response = await apiService.get(
    `/api/users/${userId}/points/history?page=${page}&limit=20`
  );

  const { transactions, pagination, summary } = response;

  return {
    transactions: transactions.map(transformPointTransaction),
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      total: pagination.total,
      totalPages: pagination.total_pages
    },
    summary: {
      totalEarned: summary.total_earned,
      totalUsed: summary.total_used,
      netBalance: summary.net_balance
    }
  };
}
```

---

## TossPayments Integration Flow

### User Flow (Two-Stage Payment)

```
1. User creates reservation
   └─> Reservation status: pending

2. User initiates deposit payment
   POST /api/payments/deposit/prepare
   └─> Returns checkout_url
   └─> Redirect to TossPayments checkout page

3. User completes payment on TossPayments
   └─> TossPayments redirects to successUrl
   └─> Frontend calls POST /api/payments/toss/confirm
   └─> Payment status: deposit_paid
   └─> Reservation status: confirmed

4. Shop provides service
   └─> Reservation status: completed

5. User initiates final payment
   POST /api/payments/final/prepare
   └─> Returns checkout_url
   └─> Redirect to TossPayments checkout page

6. User completes final payment
   └─> Frontend calls POST /api/payments/toss/confirm
   └─> Payment status: fully_paid
   └─> Points earned automatically
```

### Webhook Flow

```
TossPayments sends webhook
   └─> POST /api/webhooks/toss-payments (secured)
   └─> Webhook security middleware validates
   └─> Process payment status update
   └─> Update reservation status
   └─> Send notification to user
   └─> Generate receipt
```

### FIFO Point Usage

When user uses points:
1. System retrieves all available point transactions (oldest first)
2. Deducts from oldest points first
3. Creates negative transaction for each point batch used
4. Updates user's available balance

---

## Testing Endpoints

### Test Payment Initialization
```bash
curl -X POST 'http://localhost:3001/api/payments/toss/prepare' \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "reservationId": "YOUR_RESERVATION_ID",
    "amount": 50000,
    "isDeposit": true,
    "successUrl": "http://localhost:3000/payment/success",
    "failUrl": "http://localhost:3000/payment/fail"
  }'
```

### Test Point Balance
```bash
curl 'http://localhost:3001/api/users/YOUR_USER_ID/points/balance' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Point History
```bash
curl 'http://localhost:3001/api/users/YOUR_USER_ID/points/history?page=1&limit=20' \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Test Admin Payment List
```bash
curl 'http://localhost:3001/api/admin/payments?status=fully_paid&limit=10' \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN"
```

---

## Key Differences from Other APIs

### Payments vs Users/Reservations
- **Payments**: Uses snake_case (like Service Catalog and Shops)
- **Users**: Already uses camelCase ✅
- **Reservations**: Already uses camelCase ✅

### Why snake_case?
Payments, points, and refunds tables follow the original database schema naming convention. Frontend should transform these at the service layer, just like Service Catalog and Shops APIs.

### Nested Relationships
Payment API includes nested relationships:
- `customer` object (user information)
- `shop` object (shop information)
- `reservation` object (reservation details)

All nested objects also use snake_case and need transformation.

---

## Error Codes Reference

### Payment Error Codes
- `PAYMENT_INITIALIZATION_FAILED` - Payment setup failed
- `PAYMENT_CONFIRMATION_FAILED` - Payment confirmation failed
- `AMOUNT_MISMATCH` - Payment amount doesn't match
- `PAYMENT_ALREADY_EXISTS` - Duplicate payment attempt
- `PAYMENT_NOT_FOUND` - Payment record not found
- `SERVICE_NOT_COMPLETED` - Cannot make final payment before service completion
- `DEPOSIT_NOT_PAID` - Deposit must be paid before final payment

### Point Error Codes
- `INSUFFICIENT_POINTS` - Not enough points available
- `POINT_EARNING_FAILED` - Point earning transaction failed
- `POINT_USAGE_FAILED` - Point usage transaction failed
- `POINT_ADJUSTMENT_FAILED` - Admin point adjustment failed

### Refund Error Codes
- `REFUND_REQUEST_FAILED` - Refund request creation failed
- `REFUND_NOT_ELIGIBLE` - Payment not eligible for refund
- `REFUND_ALREADY_EXISTS` - Refund already requested
- `REFUND_PROCESSING_FAILED` - Refund processing failed

---

**Last Updated**: 2025-10-07
**Backend Version**: 1.0.0
**API Endpoint Base**: `http://localhost:3001`
