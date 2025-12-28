# ✅ PortOne SDK V2 - Comprehensive Implementation Analysis
## Backend Application

**Date**: 2025-01-26
**Status**: Mixed Implementation - Payment ✅ / Identity Verification ✅ / Gaps ⚠️
**PortOne Version**: V2
**SDK Version**: @portone/server-sdk ^0.17.0
**Provider**: Danal

---

## 📋 Executive Summary

The backend has **good foundational PortOne V2 integration** with server SDK correctly installed and basic payment/verification flows implemented. However, several **critical features are missing or incomplete**, particularly around refunds, billing keys, and webhook robustness.

### Overall Score: 6.5/10

| Feature | Status | Score |
|---------|--------|-------|
| SDK Installation | ✅ Correct | 10/10 |
| Payment Initialization | ⚠️ Incomplete | 5/10 |
| Payment Verification | ✅ Good | 8/10 |
| Payment Confirmation | ✅ Good | 8/10 |
| Refund/Cancellation | ⚠️ Missing Features | 4/10 |
| Webhook Integration | ✅ Good Base | 7/10 |
| Identity Verification | ✅ Excellent | 9/10 |
| Billing Key Payments | ❌ Not Implemented | 0/10 |
| Error Handling | ⚠️ Generic | 5/10 |
| Database Schema | ⚠️ Missing Fields | 6/10 |

---

## 🎯 Critical Findings

### ✅ STRENGTHS

1. **Server SDK Properly Installed**
   - Package: `@portone/server-sdk@^0.17.0` ✅
   - Correctly initialized with API secret
   - TypeScript types available

2. **Payment Verification Implemented**
   - Uses `client.payment.getPayment()` correctly
   - Amount validation present
   - Status checking implemented

3. **Webhook Integration Working**
   - Uses PortOne SDK `Webhook.verify()` for signature validation
   - Security middleware properly configured
   - Event processing implemented

4. **Identity Verification Excellent**
   - Complete implementation with Danal support
   - Bypass parameters properly configured
   - CI/DI storage for duplicate prevention
   - Database tracking robust

### ❌ CRITICAL GAPS

1. **No PortOne Prepare API** in payment initialization
2. **Missing Virtual Account Refund Implementation**
3. **No Billing Key Payment Support**
4. **Webhook Version Not Specified** (should use `2024-04-25`)
5. **Mock Mode Enabled in Production** (`MOCK_PAYMENTS=true`)
6. **Missing Database Column**: `payment_stage`
7. **No Webhook Idempotency Protection**
8. **PG-Specific Error Handling Missing**

---

## 📦 1. SDK Installation Analysis

### ✅ Package Installation
**Location**: `/home/bitnami/everything_backend/package.json`

```json
{
  "@portone/server-sdk": "^0.17.0"
}
```

**Status**: ✅ Correct version installed

### ✅ Client Initialization
**Location**: `src/services/portone.service.ts:242-256`

```typescript
this.client = PortOneClient({
  secret: config.payments.portone.v2.apiSecret
});
```

**Status**: ✅ Properly initialized with API secret

### ✅ Environment Configuration
**Location**: `.env`

```env
PORTONE_V2_STORE_ID=store-e8fdd5ab-363e-4b42-8326-b740a207acef
PORTONE_V2_CHANNEL_KEY=channel-key-d33714da-6ff6-4e33-88a4-106dd855f122
PORTONE_V2_API_SECRET=jxWYDZC53f1BsrNuJ2L1DjVWUTb5rZZ9XVnsaZtJHg8Pay6t0yA1HefvCNJlz4xd9KAvg7w0hRJ1URR7
PORTONE_V2_WEBHOOK_SECRET=whsec_GMid/yFvdmboHnQcbeEHynj2m7JbvknNAY9SA0fFOuU=
```

**Status**: ✅ All credentials properly configured

### ⚠️ Mock Mode Configuration
**Location**: `.env`

```env
MOCK_PAYMENTS=true
```

**Status**: ⚠️ **CRITICAL** - Mock mode should be disabled in production

---

## 💳 2. Payment Flow Analysis

### ⚠️ Payment Initialization (Incomplete)
**Location**: `src/services/portone.service.ts:265-352`

**Current Implementation**:
```typescript
async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
  // Creates database records only
  // Missing PortOne prepare/pre-register API call
}
```

**Issues**:
1. ❌ No PortOne V2 prepare API call
2. ❌ Not using pre-registration endpoint
3. ✅ Database record creation works
4. ✅ Payment ID generation correct

**Expected Implementation** (from PortOne docs):
```typescript
// Should call PortOne prepare API before client payment
const prepareResponse = await fetch(
  'https://api.portone.io/payments/prepare',
  {
    method: 'POST',
    headers: {
      'Authorization': `PortOne ${apiSecret}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      storeId,
      paymentId,
      orderName,
      totalAmount,
      currency: 'KRW'
    })
  }
);
```

### ✅ Payment Verification (Good)
**Location**: `src/services/portone.service.ts:380-429`

**Current Implementation**:
```typescript
async verifyPayment(paymentId: string): Promise<PaymentVerificationResult> {
  const paymentInfo = await this.client.payment.getPayment({ paymentId });

  // ✅ Validates status
  if (paymentInfo.status !== 'PAID') {
    throw new PaymentError('Payment not completed', 'PAYMENT_NOT_PAID');
  }

  // ✅ Validates amount
  const dbPayment = await this.getPaymentRecord(paymentId);
  if (paymentInfo.amount.total !== dbPayment.amount) {
    throw new PaymentError('Amount mismatch', 'AMOUNT_MISMATCH');
  }

  return paymentInfo;
}
```

**Status**: ✅ Correct SDK usage, proper validation

### ✅ Payment Confirmation (Good)
**Location**: `src/services/portone.service.ts:434-490`

**Current Implementation**:
```typescript
async confirmPayment(paymentId: string): Promise<void> {
  const verified = await this.verifyPayment(paymentId);

  // ✅ Updates database with transaction details
  await this.updatePaymentStatus(paymentId, {
    status: 'paid',
    provider_transaction_id: verified.transactionId,
    paid_at: verified.paidAt,
    metadata: verified
  });
}
```

**Status**: ✅ Proper flow implementation

---

## 💰 3. Refund/Cancellation Analysis

### ⚠️ Basic Cancellation Implemented
**Location**: `src/services/portone.service.ts:592-659`

**Current Implementation**:
```typescript
async cancelPayment(paymentId: string, data: CancellationData): Promise<CancellationResult> {
  const cancellation = await this.client.payment.cancelPayment({
    paymentId,
    reason: data.reason,
    ...(data.amount && { amount: data.amount }),
    ...(data.taxFreeAmount && { taxFreeAmount: data.taxFreeAmount })
  });

  return cancellation;
}
```

**Issues**:
1. ❌ **Missing Virtual Account Refund Handling**
   - No `refundAccount` parameter
   - Virtual account cancellations will fail

2. ❌ **No `currentCancellableAmount` Validation**
   - Can attempt to cancel more than available
   - Should check before attempting

3. ❌ **No Async Cancellation Handling**
   - Some PGs process cancellation asynchronously
   - Should check cancellation status

4. ❌ **No Tax-Free Amount Calculation**
   - Not handling tax-free portions correctly

**Expected Implementation** (from PortOne docs):
```typescript
async cancelPayment(paymentId: string, data: CancellationData): Promise<CancellationResult> {
  // 1. Get current payment to check cancellableAmount
  const payment = await this.client.payment.getPayment({ paymentId });

  const cancelAmount = data.amount || payment.amount.total;
  if (cancelAmount > payment.cancellableAmount) {
    throw new Error('Cancel amount exceeds cancellable amount');
  }

  // 2. Prepare cancellation request
  const cancelRequest: any = {
    paymentId,
    reason: data.reason,
    ...(data.amount && { amount: data.amount }),
    ...(data.taxFreeAmount && { taxFreeAmount: data.taxFreeAmount })
  };

  // 3. Add refund account for virtual account payments
  if (payment.method?.type === 'VIRTUAL_ACCOUNT') {
    if (!data.refundAccount) {
      throw new Error('Refund account required for virtual account cancellation');
    }

    cancelRequest.refundAccount = {
      bank: data.refundAccount.bank,
      number: data.refundAccount.number,
      holderName: data.refundAccount.holderName,
      holderPhoneNumber: data.refundAccount.holderPhoneNumber // Required for Smartro
    };
  }

  // 4. Execute cancellation
  const cancellation = await this.client.payment.cancelPayment(cancelRequest);

  // 5. For async PGs, check status
  if (cancellation.status === 'PENDING') {
    // Poll status or wait for webhook
    logger.info('Cancellation pending - will be confirmed via webhook');
  }

  return cancellation;
}
```

---

## 🔔 4. Webhook Integration Analysis

### ✅ Webhook Signature Verification (Good)
**Location**: `src/services/portone.service.ts:495-517`

**Current Implementation**:
```typescript
async verifyWebhook(body: any, headers: any): Promise<WebhookEvent> {
  const webhook = await PortOne.Webhook.verify(
    process.env.PORTONE_V2_WEBHOOK_SECRET!,
    body,
    headers
  );

  return webhook;
}
```

**Status**: ✅ Using SDK for signature verification (correct approach)

### ✅ Webhook Processing
**Location**: `src/services/portone.service.ts:522-587`

**Current Implementation**:
```typescript
async processWebhook(webhook: WebhookEvent): Promise<void> {
  switch (webhook.type) {
    case 'Transaction.Paid':
      await this.handlePaymentPaid(webhook.data);
      break;
    case 'Transaction.Cancelled':
      await this.handlePaymentCancelled(webhook.data);
      break;
    case 'Transaction.Failed':
      await this.handlePaymentFailed(webhook.data);
      break;
    default:
      logger.warn('Unknown webhook event type', { type: webhook.type });
  }
}
```

**Status**: ✅ Basic event handling implemented

### ⚠️ Webhook Issues

1. **❌ No Webhook Version Specified**
   ```typescript
   // Should specify webhook version
   const webhook = await PortOne.Webhook.verify(
     webhookSecret,
     body,
     headers,
     { version: '2024-04-25' } // Latest version
   );
   ```

2. **❌ No Idempotency Protection**
   - Can process same webhook multiple times
   - Should store webhook event IDs

   ```typescript
   // Should add idempotency check
   const webhookId = headers['idempotency-key'];
   const exists = await this.checkWebhookProcessed(webhookId);
   if (exists) {
     logger.info('Webhook already processed', { webhookId });
     return;
   }

   await this.processWebhook(webhook);
   await this.markWebhookProcessed(webhookId);
   ```

3. **⚠️ Generic Error Handling**
   - Not handling PG-specific errors
   - Should parse error codes from Danal

### ✅ Webhook Security Middleware
**Location**: `src/middleware/webhook-security.middleware.ts:300-385`

**Current Implementation**:
```typescript
export function portOneV2WebhookSecurity(req: Request, res: Response, next: NextFunction): void {
  // ✅ POST method check
  // ✅ JSON content-type check
  // ✅ HTTPS check (production)
  // ✅ Delegates signature verification to SDK
  next();
}
```

**Status**: ✅ Properly implemented security checks

---

## 🔐 5. Identity Verification Analysis

### ✅ Excellent Implementation
**Location**: `src/services/portone-identity-verification.service.ts`

**Features Implemented**:
1. ✅ Complete prepare/verify flow
2. ✅ Danal bypass parameters (IsCarrier, AGELIMIT, CPTITLE)
3. ✅ CI/DI storage for duplicate prevention
4. ✅ Phone number validation
5. ✅ Database tracking in `phone_verifications` table
6. ✅ User phone verification flag
7. ✅ Auto-cleanup of expired verifications
8. ✅ Comprehensive error handling

**Service Methods**:
```typescript
class PortOneIdentityVerificationService {
  // ✅ Prepare verification - creates DB record
  async prepareVerification(request): Promise<{
    identityVerificationId, storeId, channelKey
  }>;

  // ✅ Verify identity - calls PortOne API, stores CI/DI
  async verifyIdentity(id): Promise<PortOneIdentityVerificationResult>;

  // ✅ Get status
  async getVerificationStatus(id): Promise<{exists, status, verifiedAt}>;

  // ✅ Build Danal bypass params
  buildDanalBypass(params: DanalBypassParams): Record<string, any>;

  // ✅ Cleanup expired verifications
  async cleanupExpiredVerifications(): Promise<number>;
}
```

**API Endpoints**:
- `POST /api/identity-verification/prepare` - Prepare verification
- `POST /api/identity-verification/verify` - Verify result
- `GET /api/identity-verification/status/:id` - Get status
- `POST /api/identity-verification/danal/bypass-params` - Build bypass params

**Database Integration**:
```typescript
// phone_verifications table
{
  portone_identity_verification_id: string,
  portone_ci: string,  // Connecting Information
  portone_di: string,  // Duplication Information
  portone_verified_name: string,
  portone_birth_date: string,
  portone_gender: string,
  portone_carrier: string,
  portone_nationality: string,
  status: 'pending' | 'verified' | 'failed' | 'expired'
}
```

**Status**: ✅ **Excellent** - One of the best implementations found

### ⚠️ Minor Identity Verification Issues

1. **Not Using SDK Method**
   - Currently using REST API directly
   - Should consider using SDK method if available

   ```typescript
   // Current approach (using fetch)
   const response = await fetch(
     `https://api.portone.io/identity-verifications/${id}`,
     { headers: { Authorization: `PortOne ${apiSecret}` } }
   );

   // Check if SDK has identity verification methods
   // await this.client.identityVerification.get({ id });
   ```

2. **Missing Frontend Integration**
   - Backend is ready
   - Frontend needs `PortOne.requestIdentityVerification()` implementation

---

## 💾 6. Database Schema Analysis

### ⚠️ Payments Table Issues
**Location**: `supabase/migrations/20241220214100_initial_schema_v3_3.sql`

**Current Schema**:
```sql
CREATE TABLE payments (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  amount DECIMAL(10,2) NOT NULL,
  status payment_status NOT NULL,
  provider_transaction_id TEXT,  -- PortOne transaction ID
  provider_order_id TEXT,        -- PortOne payment ID
  metadata JSONB,                -- PortOne full response
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Issues**:
1. ❌ **Missing Column**: `payment_stage`
   - Referenced in code but not in schema
   - Needed for: prepare, pending, processing, completed stages

2. ⚠️ **No Webhook Tracking**
   - Should have `webhook_logs` table or `webhook_event_id` column

3. ⚠️ **No Cancellation History**
   - Should track partial cancellations
   - Need `cancelled_amount`, `cancellation_history` JSONB

4. ⚠️ **No Billing Key Reference**
   - Missing `billing_key_id` for subscription payments

**Recommended Schema Additions**:
```sql
-- Add missing columns to payments table
ALTER TABLE payments
  ADD COLUMN payment_stage VARCHAR(20),
  ADD COLUMN billing_key_id UUID REFERENCES billing_keys(id),
  ADD COLUMN cancelled_amount DECIMAL(10,2) DEFAULT 0,
  ADD COLUMN cancellable_amount DECIMAL(10,2),
  ADD COLUMN cancellation_history JSONB;

-- Create webhook_logs table for idempotency
CREATE TABLE webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id TEXT UNIQUE NOT NULL,  -- Idempotency key
  event_type TEXT NOT NULL,
  payment_id TEXT,
  payload JSONB NOT NULL,
  processed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_webhook_logs_webhook_id ON webhook_logs(webhook_id);
CREATE INDEX idx_webhook_logs_payment_id ON webhook_logs(payment_id);

-- Create billing_keys table
CREATE TABLE billing_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  billing_key TEXT NOT NULL,
  card_last4 TEXT,
  card_brand TEXT,
  card_type TEXT,
  status TEXT DEFAULT 'active',
  issued_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_billing_keys_user_id ON billing_keys(user_id);
CREATE INDEX idx_billing_keys_status ON billing_keys(status);
```

### ✅ Phone Verifications Table (Good)
```sql
CREATE TABLE phone_verifications (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  phone_number TEXT NOT NULL,
  verification_method TEXT,
  status TEXT,
  portone_identity_verification_id TEXT,
  portone_provider TEXT,
  portone_ci TEXT,  -- ✅ CI storage
  portone_di TEXT,  -- ✅ DI storage
  portone_verified_name TEXT,
  portone_birth_date TEXT,
  portone_gender TEXT,
  portone_carrier TEXT,
  portone_nationality TEXT,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

**Status**: ✅ Well-designed for identity verification tracking

---

## 🚫 7. Missing Features

### ❌ 1. Billing Key Payments (Not Implemented)

**Required for**: Subscription payments, saved card payments

**Expected Implementation**:
```typescript
// Issue billing key (one-time)
async issueBillingKey(data: BillingKeyData): Promise<BillingKeyResult> {
  const result = await this.client.billingKey.issueBillingKey({
    storeId: this.storeId,
    channelKey: this.channelKey,
    billingKeyMethod: 'CARD',
    customer: data.customer
  });

  // Store billing key in database
  await this.storeBillingKey(data.userId, result.billingKey);

  return result;
}

// Pay with billing key
async payWithBillingKey(data: BillingKeyPaymentData): Promise<PaymentResult> {
  const payment = await this.client.payment.payWithBillingKey({
    paymentId: data.paymentId,
    billingKey: data.billingKey,
    orderName: data.orderName,
    amount: data.amount,
    currency: 'KRW'
  });

  return payment;
}

// Delete billing key
async deleteBillingKey(billingKey: string): Promise<void> {
  await this.client.billingKey.deleteBillingKey({ billingKey });
  await this.markBillingKeyDeleted(billingKey);
}
```

### ❌ 2. Payment Method Restrictions

**Use Case**: Restrict payment methods by business logic

**Expected Implementation**:
```typescript
// In payment initialization
const allowedMethods = this.getAllowedPaymentMethods(user, reservationType);

return {
  paymentId,
  storeId: this.storeId,
  channelKey: this.channelKey,
  allowedMethods,  // ['CARD', 'TRANSFER', 'VIRTUAL_ACCOUNT']
  // Exclude easy pay or specific methods based on business rules
};
```

### ❌ 3. Scheduled Payments

**Use Case**: Deposit payments, installment payments

**Expected Implementation**:
```typescript
async schedulePayment(data: ScheduledPaymentData): Promise<ScheduledPaymentResult> {
  // Create scheduled payment record
  const schedule = await this.createPaymentSchedule({
    userId: data.userId,
    reservationId: data.reservationId,
    billingKey: data.billingKey,
    amount: data.amount,
    scheduledAt: data.scheduledAt
  });

  // Cron job will execute payment at scheduled time
  return schedule;
}
```

### ❌ 4. PG-Specific Error Handling

**Current**: Generic error handling
**Needed**: Danal-specific error codes

**Expected Implementation**:
```typescript
// Map Danal error codes to user-friendly messages
const DANAL_ERROR_CODES = {
  'F100': '카드 정보가 올바르지 않습니다',
  'F200': '한도 초과입니다',
  'F300': '결제가 거절되었습니다',
  // ... more Danal error codes
};

function handlePaymentError(error: any): never {
  if (error.pgCode && DANAL_ERROR_CODES[error.pgCode]) {
    throw new PaymentError(
      DANAL_ERROR_CODES[error.pgCode],
      error.pgCode,
      error.pgMessage
    );
  }

  throw new PaymentError('결제 처리 중 오류가 발생했습니다', 'PAYMENT_FAILED');
}
```

---

## 🔧 8. Improvement Recommendations

### Priority 1: Critical (Do Immediately)

1. **Disable Mock Mode in Production**
   ```env
   # .env
   MOCK_PAYMENTS=false
   ```

2. **Add Payment Preparation API**
   ```typescript
   async initializePayment(data: PaymentInitializationData): Promise<PaymentInitializationResult> {
     // 1. Call PortOne prepare API
     const prepareResponse = await fetch(
       'https://api.portone.io/payments/prepare',
       {
         method: 'POST',
         headers: {
           'Authorization': `PortOne ${this.apiSecret}`,
           'Content-Type': 'application/json'
         },
         body: JSON.stringify({
           storeId: this.storeId,
           paymentId: data.paymentId,
           orderName: data.orderName,
           totalAmount: data.amount,
           currency: 'KRW'
         })
       }
     );

     // 2. Create database record
     await this.createPaymentRecord(data);

     return {
       paymentId: data.paymentId,
       storeId: this.storeId,
       channelKey: this.channelKey
     };
   }
   ```

3. **Implement Virtual Account Refund**
   ```typescript
   async cancelPayment(paymentId: string, data: CancellationData): Promise<CancellationResult> {
     const payment = await this.client.payment.getPayment({ paymentId });

     const cancelRequest: any = {
       paymentId,
       reason: data.reason,
       ...(data.amount && { amount: data.amount })
     };

     // Add refund account for virtual account
     if (payment.method?.type === 'VIRTUAL_ACCOUNT') {
       if (!data.refundAccount) {
         throw new Error('Refund account required for virtual account cancellation');
       }

       cancelRequest.refundAccount = {
         bank: data.refundAccount.bank,
         number: data.refundAccount.number,
         holderName: data.refundAccount.holderName,
         holderPhoneNumber: data.refundAccount.holderPhoneNumber
       };
     }

     return await this.client.payment.cancelPayment(cancelRequest);
   }
   ```

4. **Add Webhook Idempotency**
   ```typescript
   async processWebhook(webhook: WebhookEvent, webhookId: string): Promise<void> {
     // Check if already processed
     const exists = await this.supabase
       .from('webhook_logs')
       .select('id')
       .eq('webhook_id', webhookId)
       .single();

     if (exists.data) {
       logger.info('Webhook already processed', { webhookId });
       return;
     }

     // Process webhook
     await this.handleWebhookEvent(webhook);

     // Store webhook log
     await this.supabase
       .from('webhook_logs')
       .insert({
         webhook_id: webhookId,
         event_type: webhook.type,
         payment_id: webhook.data.paymentId,
         payload: webhook,
         processed_at: new Date().toISOString()
       });
   }
   ```

5. **Add Missing Database Columns**
   ```sql
   -- Run migration
   ALTER TABLE payments
     ADD COLUMN payment_stage VARCHAR(20),
     ADD COLUMN cancelled_amount DECIMAL(10,2) DEFAULT 0,
     ADD COLUMN cancellable_amount DECIMAL(10,2);

   CREATE TABLE webhook_logs (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     webhook_id TEXT UNIQUE NOT NULL,
     event_type TEXT NOT NULL,
     payment_id TEXT,
     payload JSONB NOT NULL,
     processed_at TIMESTAMPTZ DEFAULT NOW(),
     created_at TIMESTAMPTZ DEFAULT NOW()
   );
   ```

### Priority 2: High (Do Within 1 Week)

6. **Specify Webhook Version**
   ```typescript
   const webhook = await PortOne.Webhook.verify(
     webhookSecret,
     body,
     headers,
     { version: '2024-04-25' }
   );
   ```

7. **Implement Billing Key Payments**
   - Add billing key service
   - Add database schema
   - Implement issue/pay/delete flows

8. **Add PG-Specific Error Handling**
   - Create Danal error code mapping
   - Improve error messages for users

9. **Implement Cancellable Amount Check**
   ```typescript
   const payment = await this.client.payment.getPayment({ paymentId });
   if (cancelAmount > payment.cancellableAmount) {
     throw new Error('Cancel amount exceeds cancellable amount');
   }
   ```

### Priority 3: Medium (Do Within 1 Month)

10. **Add Payment Method Restrictions**
11. **Implement Scheduled Payments**
12. **Add Partial Cancellation Tracking**
13. **Improve Logging and Monitoring**
14. **Add Payment Analytics**

---

## 📊 9. Testing Recommendations

### Current Test Files
**Location**: `test-*.js` files in root

1. ✅ `test-portone-config.js` - Configuration test
2. ✅ `test-payment-api.js` - API connection test
3. ✅ `test-webhook-signature.js` - Webhook signature test
4. ✅ `test-full-payment-flow.js` - Complete flow test
5. ✅ `START_TESTING.sh` - Test automation script

### Additional Tests Needed

1. **Refund Flow Tests**
   ```javascript
   // test-refund-flow.js
   async function testFullRefund() {
     // 1. Make payment
     // 2. Wait for paid status
     // 3. Request full refund
     // 4. Verify refund status
   }

   async function testPartialRefund() {
     // 1. Make payment
     // 2. Request partial refund
     // 3. Verify cancellable amount updated
     // 4. Request remaining refund
   }

   async function testVirtualAccountRefund() {
     // 1. Make virtual account payment
     // 2. Request refund with account details
     // 3. Verify refund status
   }
   ```

2. **Billing Key Tests**
   ```javascript
   // test-billing-key.js
   async function testBillingKeyIssuance() {
     // 1. Issue billing key
     // 2. Verify stored in database
     // 3. Make payment with billing key
     // 4. Delete billing key
   }
   ```

3. **Identity Verification Tests**
   ```javascript
   // test-identity-verification.js
   async function testDanalVerification() {
     // 1. Prepare verification
     // 2. Simulate Danal verification
     // 3. Verify CI/DI stored
     // 4. Check user phone_verified flag
   }
   ```

4. **Error Handling Tests**
   ```javascript
   // test-error-scenarios.js
   async function testPaymentFailures() {
     // 1. Invalid card
     // 2. Insufficient funds
     // 3. Exceeded limit
     // 4. Network timeout
   }
   ```

---

## 🎯 10. Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**Goal**: Fix production-breaking issues

1. ✅ Review and disable mock mode
   - Check `.env` file
   - Confirm `MOCK_PAYMENTS=false`
   - Test with real Danal test cards

2. ✅ Implement payment preparation
   - Add PortOne prepare API call
   - Test with multiple payment methods
   - Verify error handling

3. ✅ Add virtual account refund support
   - Update cancellation method
   - Add refund account parameters
   - Test with Danal virtual account

4. ✅ Implement webhook idempotency
   - Create `webhook_logs` table
   - Add idempotency checks
   - Test duplicate webhook handling

5. ✅ Add missing database columns
   - Run schema migration
   - Update code to use new columns
   - Test data integrity

**Estimated Time**: 5-7 days
**Resources Needed**: 1 backend developer
**Risk Level**: Medium (production changes)

### Phase 2: Core Features (Week 2-3)

**Goal**: Add essential missing features

6. ✅ Implement billing key payments
   - Design billing key schema
   - Implement issue/pay/delete
   - Add UI in mobile app
   - Test subscription flow

7. ✅ Add PG-specific error handling
   - Map Danal error codes
   - Improve user error messages
   - Add error logging

8. ✅ Specify webhook version
   - Update webhook verification
   - Test webhook events
   - Monitor production webhooks

9. ✅ Add cancellable amount validation
   - Check before cancellation
   - Update cancellable amount
   - Track partial cancellations

**Estimated Time**: 10-14 days
**Resources Needed**: 1 backend + 1 frontend developer
**Risk Level**: Low

### Phase 3: Enhancement (Week 4+)

**Goal**: Add advanced features and optimization

10. ✅ Payment method restrictions
11. ✅ Scheduled payments
12. ✅ Payment analytics dashboard
13. ✅ Advanced logging and monitoring
14. ✅ Performance optimization

**Estimated Time**: 2-3 weeks
**Resources Needed**: 1 backend + 1 frontend developer
**Risk Level**: Low

---

## 📚 11. Documentation References

### PortOne V2 Documentation
- **Payment Integration**: https://developers.portone.io/opi/ko/integration/start/v2/checkout
- **Cancellation API**: https://developers.portone.io/opi/ko/integration/cancel/v2/readme
- **Webhook Integration**: https://developers.portone.io/opi/ko/integration/webhook/readme-v2
- **Server SDK**: https://developers.portone.io/sdk/ko/v2-server-sdk/readme
- **Identity Verification**: https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification

### Danal Documentation
- **Danal Payment**: https://developers.portone.io/opi/ko/integration/pg/v2/danal
- **Danal Identity Verification**: https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification
- **Danal Test Cards**: Use test channel provided in PortOne console

### Project-Specific Documentation
- **Setup Guide**: `TEST_SUMMARY.md`
- **Quick Start**: `QUICK_START_TESTING.md`
- **Danal Setup**: `DANAL_SETUP_COMPLETE.md`

---

## ✅ 12. Conclusion

### Current State
The backend has a **solid foundation** for PortOne V2 integration with:
- ✅ Correct SDK installation
- ✅ Basic payment flow working
- ✅ Webhook integration functional
- ✅ **Excellent identity verification implementation**

### Critical Gaps
However, several **critical features are missing**:
- ❌ Payment preparation API not implemented
- ❌ Virtual account refunds not supported
- ❌ No billing key payment support
- ❌ Webhook idempotency missing
- ❌ Mock mode still enabled
- ❌ Missing database columns

### Recommendation
**Priority**: **HIGH** - Address critical gaps immediately

**Estimated Effort**:
- Phase 1 (Critical): 1 week
- Phase 2 (Core Features): 2 weeks
- Phase 3 (Enhancement): 3 weeks
- **Total**: 6 weeks for complete implementation

**Next Steps**:
1. Disable mock mode and test with real Danal
2. Implement payment preparation API
3. Add virtual account refund support
4. Deploy webhook idempotency protection
5. Run database migrations
6. Test all payment scenarios

---

**Report Generated**: 2025-01-26
**PortOne SDK Version**: @portone/server-sdk ^0.17.0
**Analysis Tool**: Claude Code + PortOne MCP
**Status**: ⚠️ Requires immediate attention for production readiness
