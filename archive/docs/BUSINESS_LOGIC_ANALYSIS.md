# Backend Business Logic Analysis - 에뷰리띵

## Executive Summary

This document provides a comprehensive analysis of the reservation, payment, and shop management business logic in the 에뷰리띵 (eBeautything) backend. The system implements a sophisticated two-stage payment flow with state machine-based reservation management, supporting complex business rules for cancellation, refunds, and shop operations.

---

## 1. RESERVATION BUSINESS LOGIC

### 1.1 Status Transitions

The reservation system supports the following status values:
- `requested` - Initial state after reservation creation, awaiting shop confirmation
- `confirmed` - Shop has confirmed the reservation, payment required
- `completed` - Service has been completed
- `cancelled` - Reservation cancelled (both user and shop initiated)
- `no_show` - User did not show up for the reservation

**File References:**
- `/home/bitnami/everything_backend/src/types/database.types.ts` (lines 18-24)
- `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 71-77)

### 1.2 Status Transition Rules

#### Transition Matrix (from reservation-state-machine.service.ts)

| From | To | Triggered By | Time Requirement | Business Rules | Notifications |
|------|----|----|---|---|---|
| `requested` | `confirmed` | Shop | 24 hrs before | Payment required, time slot available | User notified |
| `requested` | `cancelled` | User | 2+ hrs before | Refund policy applies, points refunded | Shop notified |
| `requested` | `cancelled` | Shop | 1+ hrs before | Full refund required, user notified | Admin notified |
| `confirmed` | `completed` | Shop | 30 min after | Service completed, points earned | User notified |
| `confirmed` | `no_show` | System | 30 min after | Auto-transition, no refund | User/Shop/Admin notified |
| `confirmed` | `cancelled` | User | 2+ hrs before | Partial refund, cancellation fee | Shop notified |
| `confirmed` | `cancelled` | Shop | 1+ hrs before | Full refund required | Admin notified |
| `completed` | `no_show` | Admin | Manual | Override requires approval | All notified |
| `no_show` | `completed` | Admin | Manual | Override requires investigation | All notified |

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation-state-machine.service.ts` (lines 56-252)

### 1.3 Validation Rules

#### Input Validation (CreateReservationRequest)

**Required Fields:**
- `shopId` (UUID string)
- `userId` (UUID string)  
- `services` (array with at least one service)
  - Each service requires: `serviceId` (UUID), `quantity` (positive integer)
- `reservationDate` (format: YYYY-MM-DD)
- `reservationTime` (format: HH:MM)

**Optional Fields:**
- `specialRequests` (string)
- `pointsToUse` (number >= 0)
- `paymentInfo` (deposit configuration)
- `requestMetadata` (source, user agent, IP)
- `notificationPreferences` (email/SMS/push flags)

**Validation Logic:**
```
Date Format: /^\d{4}-\d{2}-\d{2}$/
Time Format: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/
Service Quantity: > 0
Points: >= 0
IP Address: Valid IPv4 or IPv6
```

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 609-693)

### 1.4 Business Rules - Pricing and Deposits

#### Deposit Calculation Rules

**Default Business Rules:**
- Default deposit percentage: 25% of total amount
- Minimum deposit: 20% of total amount
- Maximum deposit: 30% of total amount
- Minimum deposit amount: 10,000 KRW
- Maximum deposit amount: 100,000 KRW

**Deposit Calculation Priority:**
1. Service-specific fixed deposit (`deposit_amount`)
2. Service-specific percentage deposit (`deposit_percentage`)
3. Default deposit (25% of service price)

**Business Rule Application:**
```
For each service:
  If service.deposit_amount exists:
    serviceDeposit = deposit_amount × quantity
  Else if service.deposit_percentage exists:
    serviceDeposit = (unitPrice × quantity) × (deposit_percentage / 100)
  Else:
    serviceDeposit = (unitPrice × quantity) × 0.25

Apply constraints:
  serviceDeposit = max(10,000, min(serviceDeposit, 100,000))
  serviceDeposit = min(serviceDeposit, totalServicePrice)

Final deposit for reservation:
  reservationDeposit = min(totalServiceDeposit, totalAmountAfterDiscounts)
  remainingAmount = totalAmountAfterDiscounts - reservationDeposit
```

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 182-382)

### 1.5 Cancellation Policies

#### User Cancellation (canCancelReservation)

**Eligibility:**
- User can only cancel their own reservations
- Cancellable statuses: `requested`, `confirmed`
- Minimum time requirement: **2 hours before reservation**

**Refund Calculation (Korean Timezone-Aware):**
- 48+ hours before: 100% refund
- 24-48 hours before: 80% refund (20% cancellation fee)
- 2-24 hours before: 50% refund (50% cancellation fee)
- < 2 hours: 0% refund (no-show fee applies)

**Automatic Refund Processing:**
- Integrated refund calculation service invoked during cancellation
- Refund status tracked in `enhanced_cancellation_audit_log`
- Points used are automatically refunded
- Partial refunds support based on cancellation window

**File References:**
- `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 1021-1154)
- Lines 1214-1280: `canCancelReservation()` method with Korean timezone support

### 1.6 Concurrent Booking Prevention

**Mechanism:** Database-level row locking via RPC function `create_reservation_with_lock`

**Lock Strategy:**
- Advisory locks on time slot + shop combination
- 10-second lock timeout
- Automatic detection of slot conflicts before lock acquisition

**Retry Logic:**
- Max retries: 3
- Base delay: 1 second with exponential backoff
- Deadlock special handling: 2-second fixed delay
- Jitter: 10% variance to prevent thundering herd

**Error Handling:**
- `SLOT_CONFLICT`: Time slot no longer available
- `ADVISORY_LOCK_TIMEOUT`: Lock acquisition timeout
- `LOCK_TIMEOUT`: General lock timeout
- `DEADLOCK_RETRY_EXCEEDED`: Database deadlock
- `SERVICE_NOT_FOUND`: Service unavailable
- `INVALID_QUANTITY`: Invalid service quantity
- `INVALID_POINTS`: Points usage exceeds total

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 387-517)

### 1.7 Reservation Retrieval and Filtering

**Get User Reservations Features:**
- Filter by status (including "upcoming" and "past" as application-level filters)
- Date range filtering (startDate, endDate)
- Shop filtering
- Pagination (page, limit)
- Caching with 5-minute TTL
- Result mapping to internal format

**Status Mapping:**
- "upcoming": `requested` or `confirmed` with reservation_date >= today
- "past": any reservation with reservation_date < today

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 865-1016)

---

## 2. PAYMENT BUSINESS LOGIC

### 2.1 Payment Flow Architecture

The system implements a **two-stage payment flow**:

```
Stage 1: DEPOSIT PAYMENT
├── Deposit amount calculated (20-30% of total)
├── User pays deposit via PortOne
├── Reservation status: "requested"
└── Upon success → triggers notification to shop

Stage 2: SERVICE COMPLETION & FINAL PAYMENT
├── Shop confirms reservation (status → "confirmed")
├── User uses service
├── Shop marks as "completed"
├── Final payment reminder sent to user
├── User pays remaining balance via PortOne
└── Upon success → service completion finalized
```

**File Reference:** `/home/bitnami/everything_backend/src/services/two-stage-payment.service.ts` (lines 1-70)

### 2.2 Payment Status Lifecycle

#### PortOne Official Statuses (V2)
- `READY` - Payment ready/initialized
- `PAID` - Payment completed successfully
- `FAILED` - Payment failed
- `CANCELLED` - Payment cancelled
- `PARTIAL_CANCELLED` - Payment partially cancelled/refunded
- `PAY_PENDING` - Payment pending (awaiting confirmation)
- `VIRTUAL_ACCOUNT_ISSUED` - Virtual account issued (for bank transfer)

#### Internal Payment Statuses (Mapped)
- `pending` - Maps to READY, PAY_PENDING
- `deposit_paid` - Deposit stage completed
- `final_payment_pending` - Awaiting final payment
- `fully_paid` - Maps to PAID (all payments complete)
- `refunded` - Maps to CANCELLED
- `partially_refunded` - Maps to PARTIAL_CANCELLED
- `failed` - Maps to FAILED
- `deposit_refunded` - Deposit refunded
- `final_payment_refunded` - Final payment refunded
- `overdue` - Payment overdue
- `virtual_account_issued` - Maps to VIRTUAL_ACCOUNT_ISSUED

**File Reference:** `/home/bitnami/everything_backend/src/types/database.types.ts` (lines 26-48)

### 2.3 Deposit Payment Process

**Method:** `prepareDepositPayment()` in TwoStagePaymentService

**Steps:**
1. Get and validate reservation
   - User can only pay for their own reservation
   - Reservation must exist and be in valid state
2. Validate deposit amount
   - Deposit must be 20-30% of total amount
   - Check for existing deposit payment
3. Update reservation with deposit info
   - Set `deposit_amount` on reservation
   - Calculate `remaining_amount` = totalAmount - depositAmount
4. Initiate PortOne payment
   - Amount: `depositAmount`
   - Customer info: name, email, phone
   - Success/fail URLs configured
5. Update reservation status: `"requested"`
6. Return payment initialization response

**Request Structure:**
```typescript
{
  reservationId: string (UUID)
  userId: string (UUID)
  depositAmount: number (KRW)
  customerName: string
  customerEmail: string
  customerPhone?: string
  successUrl?: string (redirect after success)
  failUrl?: string (redirect after failure)
}
```

**File Reference:** `/home/bitnami/everything_backend/src/services/two-stage-payment.service.ts` (lines 77-153)

### 2.4 Final Payment Process

**Method:** `prepareFinalPayment()` in TwoStagePaymentService

**Prerequisites:**
1. Reservation status must be `"completed"` (service finished)
2. Deposit payment must be fully paid
3. Remaining balance > 0
4. No existing final payment in progress

**Steps:**
1. Validate reservation and deposit status
2. Calculate final amount: `totalAmount - depositAmount`
3. Initiate PortOne payment for remaining balance
4. Trigger final payment reminder notifications

**Special Cases:**
- If `remainingAmount` = 0: Fully paid, error response
- If status ≠ `"completed"`: Service not complete, error response
- If deposit not paid: Cannot proceed to final payment

**File Reference:** `/home/bitnami/everything_backend/src/services/two-stage-payment.service.ts` (lines 158-200)

### 2.5 Payment Validation Rules

**Amount Validation:**
- Minimum payment: 100 KRW
- Deposit: Must be 20-30% of total
- Final payment: Must equal `total - deposit`
- Cannot exceed reservation total amount

**User Validation:**
- User ID must match reservation owner
- Authenticated user required (bearer token)

**Reservation State Validation:**
- For deposit: Any state where payment not yet made
- For final: Must be in `"completed"` state
- Cannot process multiple payments of same type simultaneously

**Error Codes:**
- `INVALID_AMOUNT` - Amount outside valid range
- `RESERVATION_NOT_FOUND` - Reservation doesn't exist
- `PAYMENT_ALREADY_EXISTS` - Payment in progress
- `UNAUTHORIZED` - Authentication failure
- `SERVICE_NOT_COMPLETED` - Service not ready for final payment

**File Reference:** `/home/bitnami/everything_backend/src/controllers/payment.controller.ts` (lines 188-260)

### 2.6 Refund Logic

**Integrated Refund Services:**
1. `refundService` - Core refund processing
2. `timezoneRefundService` - Korean timezone-aware calculations
3. `paymentConfirmationService` - Payment verification and reconciliation

**Refund Eligibility Calculation:**
- Korean timezone-aware time calculations
- Compares current time (KST) with reservation time
- Calculates hours until reservation
- Applies business rules based on window

**Refund Types:**
- `full_refund` - 100% of amount
- `partial_refund` - Percentage-based (20-50% fee)
- `no_refund` - Non-refundable

**Automatic Refund Processing During Cancellation:**
```
1. Calculate refund eligibility
2. Determine refund amount based on cancellation window
3. Process refund through original payment method
4. Create refund audit trail
5. Update payment status
6. Credit points if applicable
7. Send refund confirmation to user
```

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 1021-1154)

### 2.7 Payment Method Support

**Supported Methods (PortOne V2):**
- `CARD` - Credit/Debit card
- `TRANSFER` - Bank transfer
- `VIRTUAL_ACCOUNT` - Virtual account
- `GIFT_CERTIFICATE` - Gift certificate
- `MOBILE` - Mobile payment
- `EASY_PAY` - Kakao Pay, Naver Pay, etc.
- `CONVENIENCE_STORE` - Convenience store payment
- `POINT` - Point payment

**Legacy Methods (for compatibility):**
- `portone` (V2 - new standard)
- `toss_payments` (legacy)
- `kakao_pay`, `naver_pay`

**File Reference:** `/home/bitnami/everything_backend/src/types/database.types.ts` (lines 50-74)

---

## 3. SHOP MANAGEMENT BUSINESS LOGIC

### 3.1 Shop Owner Authentication

**Login Flow:**
1. Email + password authentication
2. Supabase Auth verification with retry logic (3 attempts)
3. Shop owner validation (user_role = 'shop_owner')
4. Session creation with security metadata
5. JWT token generation with shopId in claims

**Session Information Captured:**
- IP address (with IPv6 normalization)
- User agent
- Device ID (optional)
- Device name (optional)
- Login timestamp and location

**Session Validation:**
- Token expiration check
- Shop ownership verification
- Session status (active/revoked)
- Device consistency checking

**File Reference:** `/home/bitnami/everything_backend/src/services/shop-owner-auth.service.ts` (lines 82-200)

### 3.2 Shop Reservations Management

**Shop-Owner Endpoint: GET /api/shops/:shopId/reservations**

**Filtering Capabilities:**
- By reservation status
- By date range (startDate, endDate)
- By user (userId filter)
- Sorting options:
  - `reservation_date` (default)
  - `created_at`
  - `updated_at`
  - `status`
- Sort order: ascending or descending
- Pagination: page, limit (max 100 per page)

**Access Control:**
- Enforced by `validateShopAccess` middleware
- Platform admins: can access any shop
- Shop owners: can only access their own shop

**Response Includes:**
- Reservation details
- User information (id, name, email, phone)
- Shop information (id, name)
- Pagination metadata

**File Reference:** `/home/bitnami/everything_backend/src/controllers/shop-reservations.controller.ts` (lines 24-150)

### 3.3 Shop Payments Management

**Shop-Owner Endpoint: GET /api/shops/:shopId/payments**

**Available Filters:**
- Payment status
- Payment method
- Date range (startDate, endDate)
- User ID
- Reservation ID
- Amount range (minAmount, maxAmount)

**Summary Calculations:**
- Total amount (sum of completed payments)
- Total refunded (sum of refunds)
- Net amount (total - refunded)

**Pagination:**
- Page and limit parameters
- Default limit: 20, Max limit: 100

**Access Control:**
- Same as shop reservations (validateShopAccess)

**Response Data:**
- Payment records with nested user and reservation details
- Summary statistics
- Pagination information

**File Reference:** `/home/bitnami/everything_backend/src/controllers/shop-payments.controller.ts` (lines 23-200)

### 3.4 Operating Hours Validation

**Validators Location:** `/home/bitnami/everything_backend/src/validators/shop-operating-hours.validators.ts`

**Business Rules:**
- Operating hours required for shop activation
- Time format: HH:MM (24-hour)
- Opening time < closing time validation
- Each day of week can be configured independently
- Closed days supported (holiday flags)

**Validation Check:**
- Reservation times must fall within shop operating hours
- Korean timezone considered for current time checks

### 3.5 Shop Profile Update Rules

**Protected Fields (shop owner modification):**
- Shop name
- Category/services
- Operating hours
- Contact methods
- Description/bio
- Images

**Admin-Only Fields:**
- Shop status (active, suspended, deleted, etc.)
- Verification status
- Moderation flags

**Audit Trails:**
- All updates logged with timestamp and user ID
- Change history queryable for compliance

---

## 4. STATE MACHINE DOCUMENTATION

### 4.1 Complete State Diagram

```
                    ┌─────────────┐
                    │  REQUESTED  │◄────────── Reservation Created
                    └──┬──────┬───┘
                       │      │
        (Shop Confirms │      │ (User/Shop Cancels)
         + Payment OK) │      └─────────────────────┐
                       │                            │
                       ▼                            ▼
                   ┌─────────────┐         ┌─────────────────┐
                   │ CONFIRMED   │         │ CANCELLED_BY_*  │
                   └──┬──────────┘         └─────────────────┘
                      │
         (30min after │ (Before start or
          start time) │  2hrs before)
                      │
      ┌───────────────┼───────────────┐
      │               │               │
  (Completed)     (No Show)     (Cancel)
      │               │               │
      ▼               ▼               ▼
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ COMPLETED   │ │  NO_SHOW    │ │ CANCELLED_* │
└─────────────┘ └─────────────┘ └─────────────┘
      ▲               ▲
      │ (Admin OK)    │ (Admin OK)
      └───────────────┘
```

### 4.2 Transition Rules by Actor

#### USER Actions:
1. **Cancel Requested Reservation**
   - From: `requested`
   - To: `cancelled_by_user`
   - Time constraint: ≥ 2 hours before
   - Requires: Reason
   - Notifications: Shop notified

2. **Cancel Confirmed Reservation**
   - From: `confirmed`
   - To: `cancelled_by_user`
   - Time constraint: ≥ 2 hours before
   - Requires: Reason
   - Notifications: Shop notified

#### SHOP Actions:
1. **Confirm Reservation**
   - From: `requested`
   - To: `confirmed`
   - Time constraint: ≥ 24 hours before
   - Requires: Payment must be completed
   - Notifications: User notified
   - Automatic: No (manual action)

2. **Complete Service**
   - From: `confirmed`
   - To: `completed`
   - Notifications: User notified
   - Automatic: Yes (30 min after start time)
   - Trigger: Service completion confirmation

3. **Cancel Confirmed Reservation**
   - From: `confirmed`
   - To: `cancelled_by_shop`
   - Time constraint: ≥ 1 hour before
   - Requires: Reason
   - Notifications: User and admin notified
   - Refund: Full refund mandatory

#### SYSTEM Actions (Automatic):
1. **No Show Detection**
   - From: `confirmed`
   - To: `no_show`
   - Trigger: 30+ minutes after start time with no check-in
   - Notifications: User, shop, admin notified
   - Refund: None (user is liable)

2. **Auto Complete**
   - From: `confirmed`
   - To: `completed`
   - Trigger: 30 minutes after start time
   - Conditions: Service marked as started
   - Notifications: User notified

#### ADMIN Actions (Override):
1. **Override to No Show**
   - From: `completed`
   - To: `no_show`
   - Requires: Approval and reason
   - Notifications: All parties notified
   - Audit: Full trail recorded

2. **Override to Completed**
   - From: `no_show`
   - To: `completed`
   - Requires: Approval and investigation reason
   - Notifications: All parties notified
   - Refund: May be restored based on decision

3. **Rollback**
   - To states: `requested` or `confirmed` only
   - Requires: Admin ID and reason
   - Use case: Error recovery, dispute resolution
   - Audit: Marked as rollback with original status

### 4.3 Validation Before Transitions

**Pre-Transition Checks:**
1. User/Shop/Admin permissions verified
2. Required reasons captured if needed
3. Time-based conditions validated
4. Business rules enforcement
5. Payment status verification (for confirmation)
6. Time slot availability (for confirmation)
7. Current reservation status matches expected

**Post-Transition Actions:**
1. Update reservation status in database
2. Create state change audit log entry
3. Send notifications (per configuration)
4. Trigger side effects (points, refunds, etc.)
5. Log business context and metadata

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation-state-machine.service.ts` (lines 254-430)

### 4.4 State Change Audit Trail

**Logged Information:**
- Reservation ID
- Previous status
- New status
- Changed by (user/shop/admin/system)
- Changed by ID (actor ID)
- Reason provided
- Timestamp
- Metadata (additional context)
- Business rules applied
- Validation warnings

**Query Methods:**
- `getStateChangeHistory(reservationId)` - Full audit trail
- `getStateTransitionStatistics()` - Analytics by date/shop/actor

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation-state-machine.service.ts` (lines 650-691)

---

## 5. VALIDATION RULES COMPREHENSIVE REFERENCE

### 5.1 Input Validation Standards

#### Reservation Creation Request
```typescript
shopId: string (UUID required)
userId: string (UUID required)
services: Array (required, min length 1)
  - serviceId: string (UUID required)
  - quantity: number (required, > 0)
reservationDate: string (required, format YYYY-MM-DD)
reservationTime: string (required, format HH:MM)
specialRequests?: string
pointsToUse?: number (>= 0, <= totalAmount)
paymentInfo?: {
  depositAmount?: number (>= 0, <= totalAmount)
  remainingAmount?: number (>= 0)
  paymentMethod?: 'card' | 'cash' | 'points' | 'mixed'
  depositRequired?: boolean
}
requestMetadata?: {
  source?: 'mobile_app' | 'web_app' | 'admin_panel'
  userAgent?: string
  ipAddress?: string (valid IPv4/IPv6)
  referrer?: string
}
```

#### Available Time Slots Query
```typescript
shopId: string (UUID, path param - required)
date: string (YYYY-MM-DD - required)
serviceIds: string[] (UUID array - required)
startTime?: string (HH:MM format - optional)
endTime?: string (HH:MM format - optional)
interval?: number (15-120 minutes - optional, default 30)
```

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 609-693)
**File Reference:** `/home/bitnami/everything_backend/src/controllers/reservation.controller.ts` (lines 177-321)

### 5.2 Authorization & Access Control

**Reservation Access:**
- User can view/cancel only own reservations
- Shop owners can view/manage reservations for their shop
- Admins can view all reservations
- State transitions have actor-specific rules

**Payment Access:**
- Users can initiate payments for own reservations
- Shop owners can view payments (shop-scoped)
- Full payment history audit trail maintained

**Middleware Enforcement:**
- `auth.middleware` - User authentication (JWT)
- `shop-access.middleware` - Shop ownership verification
- `webhook-security.middleware` - Payment webhook validation

**File Reference:** `/home/bitnami/everything_backend/src/middleware/` (directory)

### 5.3 Business Rule Validation

#### Cancellation Eligibility
- **User cancellation:** Requires 2+ hours before reservation
- **Shop cancellation:** Requires 1+ hour before reservation
- **Status check:** Only `requested` or `confirmed` statuses
- **Ownership:** User can only cancel own reservations

#### Payment Eligibility
- **Deposit payment:** Before confirmation
- **Final payment:** After service completion
- **No duplicate payments:** Check existing payment status
- **Amount validation:** Within 20-30% range for deposits

#### Time Slot Availability
- **Lock-based prevention:** Concurrent booking protection
- **Service duration:** Sufficient time available
- **Operating hours:** Falls within shop hours
- **Capacity:** Under maximum concurrent services

**File Reference:** `/home/bitnami/everything_backend/src/services/booking-validation.service.ts`

### 5.4 Data Consistency Rules

**Reservation Integrity:**
- Deposit + Remaining = Total Amount
- Points used ≤ Total Amount
- All referenced services must exist
- Referenced shop must be active

**Payment Integrity:**
- Payment amount matches reservation amount
- Single payment per stage per reservation
- Refund amount ≤ original payment amount
- Status transitions follow valid paths

**Audit Trail Integrity:**
- All state changes logged
- No direct status updates (only through RPC)
- Timestamps in UTC with Korean timezone utility support

---

## 6. ERROR HANDLING & MESSAGES

### 6.1 Reservation Errors

| Error Code | HTTP Code | Message | Details |
|---|---|---|---|
| `MISSING_REQUIRED_PARAMETERS` | 400 | 필수 파라미터가 누락되었습니다 | date와 serviceIds 필수 |
| `INVALID_DATE_FORMAT` | 400 | 날짜 형식이 올바르지 않습니다 | YYYY-MM-DD 형식 필수 |
| `INVALID_TIME_FORMAT` | 400 | 시간 형식이 올바르지 않습니다 | HH:MM 형식 필수 |
| `MISSING_SERVICE_IDS` | 400 | 서비스 ID가 필요합니다 | 최소 하나의 서비스 |
| `INVALID_INTERVAL` | 400 | 시간 간격이 올바르지 않습니다 | 15-120분 범위 |
| `SHOP_NOT_FOUND` | 404 | 샵을 찾을 수 없습니다 | - |
| `UNAUTHORIZED` | 401 | 인증이 필요합니다 | 로그인 필요 |
| `SLOT_CONFLICT` | 409 | 선택한 시간은 더 이상 예약할 수 없습니다 | 다른 시간 선택 |
| `LOCK_TIMEOUT` | 409 | 예약이 잠깐 지연되었습니다. 다시 시도하세요 | Retry with exponential backoff |

**File Reference:** `/home/bitnami/everything_backend/src/controllers/reservation.controller.ts` (lines 177-321)

### 6.2 Payment Errors

| Error Code | HTTP Code | Message | Details |
|---|---|---|---|
| `INVALID_AMOUNT` | 400 | 결제 금액이 유효하지 않습니다 | 최소 100원, 최대 총액 |
| `INVALID_DEPOSIT` | 400 | 예약금이 유효하지 않습니다 | 20-30% 범위 필수 |
| `RESERVATION_NOT_FOUND` | 404 | 예약을 찾을 수 없습니다 | - |
| `PAYMENT_ALREADY_EXISTS` | 409 | 이미 진행 중인 결제가 있습니다 | 이전 결제 확인 |
| `SERVICE_NOT_COMPLETED` | 400 | 서비스가 완료되지 않았습니다 | 최종결제 불가 |
| `DEPOSIT_NOT_PAID` | 400 | 예약금 결제가 필요합니다 | 예약금 결제 먼저 |
| `UNAUTHORIZED` | 401 | 인증이 필요합니다 | 로그인 필수 |

**File Reference:** `/home/bitnami/everything_backend/src/controllers/payment.controller.ts` (lines 104-187)

### 6.3 Cancellation Errors

| Error Code | Message | Reason |
|---|---|---|
| `RESERVATION_NOT_FOUND` | 예약을 찾을 수 없습니다 | 잘못된 예약 ID |
| `UNAUTHORIZED` | 자신의 예약만 취소할 수 있습니다 | User attempting another's reservation |
| `INVALID_STATE` | 현재 상태에서는 취소할 수 없습니다 | Non-cancellable status |
| `TIME_WINDOW_EXPIRED` | 예약 2시간 전까지만 취소 가능합니다 | Past cancellation deadline |
| `REFUND_FAILED` | 환불 처리에 실패했습니다 | Payment system error |

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 1217-1280)

---

## 7. CACHING STRATEGY

### 7.1 Query Caching

**Service:** `queryCacheService` (used throughout)

**Cached Queries:**
- Service details by ID: TTL 30 minutes
- Service names: TTL 30 minutes
- User reservations: TTL 5 minutes
- Individual reservations: TTL 10 minutes

**Cache Key Structure:**
- `services:{serviceIds.sorted}`
- `services:names:{serviceIds.sorted}`
- `list:{userId}:{status}:{dateRange}:{shopId}:{page}:{limit}`
- `{reservationId}`

**Invalidation Triggers:**
- Manual cache clear on important updates
- TTL expiration
- Reservation state changes

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 240-258, 758-776, 887-904)

---

## 8. NOTIFICATIONS

### 8.1 Shop Owner Notifications

**Trigger:** New reservation request created

**Payload:**
```typescript
{
  shopId: string
  reservationId: string
  reservationDate: string
  reservationTime: string
  services: Array<{serviceId, serviceName, quantity}>
  totalAmount: number
  depositAmount?: number
  remainingAmount?: number
  specialRequests?: string
  paymentMethod?: string
  notificationPreferences?: {emailNotifications, smsNotifications, pushNotifications}
}
```

**Notification Service:** `shopOwnerNotificationService`

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 707-792)

### 8.2 State Transition Notifications

**Triggered on transitions:**
- User notifications: Confirmation, completion, cancellation
- Shop notifications: Cancellation, no-show
- Admin notifications: Shop-initiated cancellations, overrides

**Configuration:** Per transition rule in state machine

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation-state-machine.service.ts` (lines 31-35, 73-77, 577-591)

---

## 9. SECURITY CONSIDERATIONS

### 9.1 Authentication & Authorization

- JWT-based authentication
- Role-based access control (user, shop_owner, admin)
- Shop ownership verification
- Session-based shop owner auth with device tracking

### 9.2 Data Protection

- Sensitive fields masked in logs
- IP address normalization (IPv6 to IPv4)
- User agent tracking for security audit
- Request metadata logging for forensics

### 9.3 Payment Security

- Webhook signature validation
- Payment confirmation before state changes
- PortOne integration for PCI compliance
- Refund audit trail for dispute resolution

### 9.4 Concurrency Control

- Database-level row locking for reservations
- Advisory locks on time slots
- Deadlock detection and recovery
- Exponential backoff with jitter for retries

---

## 10. CONFIGURATION & CONSTANTS

### 10.1 Reservation Configuration

```typescript
// Lock/Retry Configuration
LOCK_TIMEOUT = 10000ms
MAX_RETRIES = 3
BASE_RETRY_DELAY = 1000ms
MAX_RETRY_DELAY = 5000ms
DEADLOCK_RETRY_DELAY = 2000ms

// Deposit Configuration
DEFAULT_DEPOSIT_PERCENTAGE = 25%
MIN_DEPOSIT_PERCENTAGE = 20%
MAX_DEPOSIT_PERCENTAGE = 30%
MIN_DEPOSIT_AMOUNT = 10,000 KRW
MAX_DEPOSIT_AMOUNT = 100,000 KRW

// Time-based Rules (State Machine)
SHOP_CONFIRM_DEADLINE = 24 hours before
USER_CANCEL_DEADLINE = 2 hours before
SHOP_CANCEL_DEADLINE = 1 hour before
AUTO_COMPLETE_THRESHOLD = 30 minutes after
NO_SHOW_THRESHOLD = 30 minutes after
```

**File Reference:** `/home/bitnami/everything_backend/src/services/reservation.service.ts` (lines 88-93, 215-221)

---

## 11. DATABASE INTEGRATION POINTS

### 11.1 RPC Functions Used

- `create_reservation_with_lock()` - Atomic reservation creation with locking
- `transition_reservation_status_enhanced()` - State machine transitions
- `comprehensive_reservation_cleanup()` - Automatic status updates
- `get_reservation_audit_trail()` - State change history
- `get_state_transition_statistics()` - Analytics
- `bulk_transition_reservations()` - Batch status updates

### 11.2 Tables Accessed

- `reservations` - Core reservation data
- `shop_services` - Service catalog with deposit policies
- `payments` - Payment records
- `users` - User information
- `shops` - Shop information
- `reservation_status_change_log` (implied) - Audit trail
- `enhanced_cancellation_audit_log` - Refund tracking

---

## 12. TESTING RECOMMENDATIONS

### 12.1 Unit Tests

**Reservation Service:**
- Pricing calculation with various deposit scenarios
- Validation of input data
- Refund eligibility calculations
- Status transition validation

**Payment Service:**
- Deposit amount validation (20-30% range)
- Final payment calculations
- Payment status mapping

**State Machine:**
- All state transitions
- Permission checks
- Time-based condition validation

### 12.2 Integration Tests

- Complete reservation flow (create → pay → complete → points)
- Cancellation with refund processing
- Concurrent booking prevention
- Payment webhook handling
- State machine with notifications

### 12.3 E2E Tests

- User flow: Search → Book → Pay → Complete → Review
- Shop owner flow: Login → View reservations → Confirm → Complete
- Admin flow: Override states, rollback changes
- Refund scenarios with various cancellation times

---

## Appendix: File Reference Index

| File | Lines | Content |
|------|-------|---------|
| `reservation.service.ts` | 97-176 | Reservation creation with v3.1 flow |
| `reservation.service.ts` | 182-382 | Deposit calculation with business rules |
| `reservation.service.ts` | 387-517 | Lock-based creation and retry logic |
| `reservation.service.ts` | 609-693 | Input validation |
| `reservation.service.ts` | 1021-1154 | Cancellation with refund processing |
| `reservation.service.ts` | 1214-1280 | Cancellation eligibility checks |
| `reservation-state-machine.service.ts` | 56-252 | State transition rules |
| `reservation-state-machine.service.ts` | 254-430 | Transition execution and validation |
| `two-stage-payment.service.ts` | 77-153 | Deposit payment flow |
| `two-stage-payment.service.ts` | 158-200 | Final payment flow |
| `payment.controller.ts` | 188-260 | Payment API endpoints |
| `reservation.controller.ts` | 177-321 | Available slots and creation |
| `shop-owner-auth.service.ts` | 82-200 | Shop owner authentication |
| `shop-reservations.controller.ts` | 24-150 | Shop reservation viewing |
| `shop-payments.controller.ts` | 23-200 | Shop payment viewing |
| `database.types.ts` | 18-24, 26-48 | Status and payment type definitions |

