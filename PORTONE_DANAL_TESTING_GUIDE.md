# PortOne Danal Testing Guide

## 📋 Overview

This guide provides comprehensive information for testing **Danal Identity Verification** and **Danal Payment Services** using PortOne V2 with demo/test credentials.

Since you already have Danal registered in your PortOne admin console, this guide will help you:
1. Get your channel credentials from PortOne console
2. Configure your backend for testing
3. Test identity verification (본인인증)
4. Test payment processing
5. Verify webhook integrations

---

## 🔑 Step 1: Get Your Channel Credentials

You mentioned you're logged into: `https://admin.portone.io/integration-v2/manage/channel`

### What to Look For:

1. **Store ID** (`storeId`)
   - Navigate to: Integration V2 → Settings
   - Copy your Store ID (format: `store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)

2. **Channel Key** (`channelKey`)
   - In the Channel Management page you're on
   - Find your Danal channel(s)
   - Copy the Channel Key (format: `channel-key-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`)
   - You should have separate channels for:
     - **Identity Verification** (본인인증)
     - **Payment** (결제)

3. **API Secret** (`apiSecret`)
   - Navigate to: Integration V2 → Settings → API Keys
   - Copy your V2 API Secret
   - ⚠️ **CRITICAL**: Never commit this to git!

4. **Webhook Secret** (`webhookSecret`)
   - Navigate to: Integration V2 → Settings → Webhooks
   - Copy your webhook secret
   - Used to verify webhook signatures

---

## 🛠️ Step 2: Update .env Configuration

Update your `/home/bitnami/everything_backend/.env` file with real credentials:

```bash
# PortOne V2 Configuration
PORTONE_ENABLED=true
PORTONE_V2_STORE_ID=store-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PORTONE_V2_CHANNEL_KEY=channel-key-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
PORTONE_V2_API_SECRET=your_actual_v2_api_secret_here
PORTONE_V2_WEBHOOK_SECRET=your_actual_webhook_secret_here
PORTONE_V2_BASE_URL=https://api.portone.io

# Identity Verification Settings
PORTONE_IDENTITY_VERIFICATION_ENABLED=true
PORTONE_IDENTITY_PROVIDER=danal

# For testing, you can use Danal's shared test channel
# Get this from: https://admin.portone.io/integration-v2/manage/channel
```

---

## 📱 Step 3: Test Identity Verification (본인인증)

### A. Backend API Endpoints

Your backend already has these endpoints implemented:

#### 1. **Prepare Verification**
```http
POST /api/identity-verification/prepare
Content-Type: application/json

{
  "identityVerificationId": "identity_verification_test_001",
  "customer": {
    "phoneNumber": "01012345678",
    "fullName": "홍길동"
  },
  "bypass": {
    "danal": {
      "AGELIMIT": 19,
      "CPTITLE": "www.e-beautything.com"
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "identityVerificationId": "identity_verification_test_001",
    "storeId": "store-xxxxxxxx",
    "channelKey": "channel-key-xxxxxxxx"
  },
  "message": "본인인증 준비가 완료되었습니다."
}
```

#### 2. **Verify Identity (After User Completes Verification)**
```http
POST /api/identity-verification/verify
Content-Type: application/json

{
  "identityVerificationId": "identity_verification_test_001"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "identityVerificationId": "identity_verification_test_001",
    "status": "VERIFIED",
    "verifiedCustomer": {
      "ci": "uniqueConnectingInformation",
      "di": "uniqueDuplicationInformation",
      "name": "홍길동",
      "gender": "MALE",
      "birthDate": "1990-01-01",
      "phoneNumber": "01012345678",
      "operator": "SKT",
      "isForeigner": false
    }
  },
  "message": "본인인증이 완료되었습니다."
}
```

### B. Frontend Integration Example

Create a test HTML file to verify frontend SDK integration:

```html
<!DOCTYPE html>
<html>
<head>
  <title>Danal Identity Verification Test</title>
  <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
  <h1>Danal 본인인증 테스트</h1>
  <button onclick="requestVerification()">본인인증 시작</button>

  <script>
    async function requestVerification() {
      // Step 1: Prepare verification via backend
      const prepareResponse = await fetch('http://localhost:3001/api/identity-verification/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityVerificationId: `verify_${Date.now()}`,
          customer: {
            phoneNumber: '01012345678',
            fullName: '홍길동'
          },
          bypass: {
            danal: {
              AGELIMIT: 19,
              CPTITLE: 'www.e-beautything.com'
            }
          }
        })
      });

      const { data } = await prepareResponse.json();

      // Step 2: Request verification via PortOne SDK
      const response = await PortOne.requestIdentityVerification({
        storeId: data.storeId,
        channelKey: data.channelKey,
        identityVerificationId: data.identityVerificationId
      });

      // Step 3: Check response
      if (response.code) {
        alert(`본인인증 실패: ${response.message}`);
        return;
      }

      // Step 4: Verify on backend
      const verifyResponse = await fetch('http://localhost:3001/api/identity-verification/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identityVerificationId: data.identityVerificationId
        })
      });

      const result = await verifyResponse.json();

      if (result.success) {
        alert('본인인증 성공!');
        console.log('인증 정보:', result.data.verifiedCustomer);
      }
    }
  </script>
</body>
</html>
```

### C. Danal Special Parameters

Your backend supports these Danal-specific bypass parameters:

```typescript
{
  "bypass": {
    "danal": {
      // Activate specific carriers (SKT, KTF, LGT, MVNO)
      "IsCarrier": "SKT;KTF",  // Multiple carriers separated by ;

      // Minimum age requirement
      "AGELIMIT": 19,

      // Service URL for ePrivacy Clean
      "CPTITLE": "www.e-beautything.com"
    }
  }
}
```

---

## 💳 Step 4: Test Payment Processing

### A. Backend Payment Initialization

#### 1. **Initialize Payment**
```http
POST /api/payments/initialize
Content-Type: application/json
Authorization: Bearer <user_jwt_token>

{
  "reservationId": "res_test_001",
  "amount": 50000,
  "isDeposit": false,
  "paymentStage": "single",
  "customerName": "홍길동",
  "customerEmail": "test@example.com",
  "customerPhone": "01012345678"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "paymentKey": "pay_res_test_001_single_1234567890_abcd",
    "orderId": "pay_res_test_001_single_1234567890_abcd",
    "checkoutUrl": "",
    "paymentId": "uuid-of-payment-record"
  }
}
```

### B. Frontend Payment Integration

```html
<!DOCTYPE html>
<html>
<head>
  <title>Danal Payment Test</title>
  <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>
</head>
<body>
  <h1>Danal 결제 테스트</h1>
  <button onclick="requestPayment()">결제하기 (50,000원)</button>

  <script>
    async function requestPayment() {
      // Step 1: Initialize payment on backend
      const initResponse = await fetch('http://localhost:3001/api/payments/initialize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN'
        },
        body: JSON.stringify({
          reservationId: 'res_test_001',
          amount: 50000,
          isDeposit: false,
          paymentStage: 'single',
          customerName: '홍길동',
          customerEmail: 'test@example.com',
          customerPhone: '01012345678'
        })
      });

      const { data } = await initResponse.json();

      // Step 2: Request payment via PortOne SDK
      const payment = await PortOne.requestPayment({
        storeId: 'YOUR_STORE_ID',
        channelKey: 'YOUR_CHANNEL_KEY',
        paymentId: data.orderId,
        orderName: '에뷰리띵 전체 결제',
        totalAmount: 50000,
        currency: 'KRW',
        payMethod: 'CARD',  // or 'VIRTUAL_ACCOUNT', 'TRANSFER', etc.
        customer: {
          fullName: '홍길동',
          phoneNumber: '01012345678',
          email: 'test@example.com'
        }
      });

      // Step 3: Check payment result
      if (payment.code) {
        alert(`결제 실패: ${payment.message}`);
        return;
      }

      // Step 4: Confirm payment on backend
      const confirmResponse = await fetch('http://localhost:3001/api/payments/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN'
        },
        body: JSON.stringify({
          paymentKey: payment.paymentId,
          orderId: data.orderId,
          amount: 50000
        })
      });

      const result = await confirmResponse.json();

      if (result.success) {
        alert('결제 성공!');
        console.log('결제 정보:', result.data);
      }
    }
  </script>
</body>
</html>
```

---

## 🎯 Step 5: Test Scenarios

### Identity Verification Test Cases

1. **✅ Successful Verification**
   - Use valid Korean phone number
   - Complete verification process
   - Check database for verified status

2. **❌ Age Restriction Test**
   - Set `AGELIMIT: 19`
   - Try with under-age user
   - Should reject

3. **📱 Carrier Test**
   - Set `IsCarrier: "SKT"`
   - Verify only SKT option appears

4. **⏰ Expiration Test**
   - Start verification
   - Wait 30 minutes
   - Check auto-expiration

### Payment Test Cases

1. **💳 Card Payment**
   - Danal provides test card numbers
   - Test successful payment
   - Verify webhook received

2. **🏦 Virtual Account**
   - Request virtual account
   - Check account issuance
   - Test deposit notification

3. **♻️ Refund Test**
   - Make successful payment
   - Request refund
   - Verify refund status

4. **❌ Failed Payment**
   - Use invalid card
   - Check error handling
   - Verify rollback

---

## 🔍 Step 6: Debugging & Monitoring

### Check Logs

```bash
# Watch backend logs
tail -f /home/bitnami/everything_backend/logs/combined.log | grep -E "PortOne|Identity|Payment"

# Check error logs
tail -f /home/bitnami/everything_backend/logs/error.log
```

### Database Queries

```sql
-- Check phone verifications
SELECT * FROM phone_verifications
WHERE verification_method = 'portone'
ORDER BY created_at DESC
LIMIT 10;

-- Check payments
SELECT * FROM payments
WHERE payment_provider = 'portone'
ORDER BY created_at DESC
LIMIT 10;

-- Check webhook logs
SELECT * FROM webhook_logs
ORDER BY created_at DESC
LIMIT 10;
```

### PortOne Admin Console

Check transaction history in real-time:
- Navigate to: https://admin.portone.io/transactions
- Filter by date/status
- View transaction details
- Check webhook delivery status

---

## 🚨 Common Issues & Solutions

### Issue 1: "Channel not found"
**Solution**: Verify `channelKey` in .env matches your PortOne console

### Issue 2: "Authentication failed"
**Solution**: Check `PORTONE_V2_API_SECRET` is correct and not expired

### Issue 3: Webhook not received
**Solution**:
- Verify webhook URL is publicly accessible
- Check `PORTONE_V2_WEBHOOK_SECRET` matches console
- Test with ngrok for local development

### Issue 4: Phone number validation error
**Solution**: Ensure phone number is:
- Korean format (01X-XXXX-XXXX)
- Numbers only (remove dashes in API call)
- 10-11 digits

### Issue 5: Test payment rejected
**Solution**:
- Use Danal's test credentials from PortOne console
- Verify you're using TEST channel, not LIVE
- Check amount is within test limits

---

## 📚 Reference Documentation

### Official PortOne V2 Docs

1. **Identity Verification**
   - Danal Guide: https://developers.portone.io/opi/ko/integration/pg/v2/danal-identity-verification
   - SDK Reference: https://developers.portone.io/sdk/ko/v2-sdk/identity-verification-request
   - API Reference: https://developers.portone.io/api/rest-v2/identityVerification

2. **Payment Integration**
   - Payment Guide: https://developers.portone.io/opi/ko/integration/start/v2/checkout
   - SDK Reference: https://developers.portone.io/sdk/ko/v2-sdk/payment-request
   - API Reference: https://developers.portone.io/api/rest-v2/payment

### Your Backend Implementation

- Identity Service: `/home/bitnami/everything_backend/src/services/portone-identity-verification.service.ts`
- Payment Service: `/home/bitnami/everything_backend/src/services/portone.service.ts`
- Identity Controller: `/home/bitnami/everything_backend/src/controllers/identity-verification.controller.ts`
- Routes: Check `/home/bitnami/everything_backend/src/routes/identity-verification.routes.ts`

---

## 🧪 Quick Test Commands

```bash
# 1. Start backend server
cd /home/bitnami/everything_backend
npm run dev

# 2. Test identity verification preparation
curl -X POST http://localhost:3001/api/identity-verification/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "identityVerificationId": "test_'$(date +%s)'",
    "customer": {
      "phoneNumber": "01012345678",
      "fullName": "홍길동"
    }
  }'

# 3. Test Danal bypass parameter builder
curl -X POST http://localhost:3001/api/identity-verification/danal/bypass-params \
  -H "Content-Type: application/json" \
  -d '{
    "IsCarrier": "SKT;KTF",
    "AGELIMIT": 19,
    "CPTITLE": "www.e-beautything.com"
  }'

# 4. Check verification status
curl http://localhost:3001/api/identity-verification/status/test_1234567890
```

---

## ✅ Next Steps

1. **Get Real Credentials**
   - Copy Store ID from PortOne console
   - Copy Channel Keys (identity + payment)
   - Copy API Secret
   - Copy Webhook Secret

2. **Update .env**
   - Replace test values with real credentials
   - Enable identity verification: `PORTONE_IDENTITY_VERIFICATION_ENABLED=true`

3. **Test Identity Verification**
   - Use test HTML file above
   - Try with different scenarios
   - Verify database updates

4. **Test Payments**
   - Use Danal test cards
   - Test different payment methods
   - Verify webhook delivery

5. **Monitor & Debug**
   - Watch logs for errors
   - Check PortOne admin console
   - Verify database records

---

## 📞 Support

If you encounter issues:

1. Check PortOne admin console logs
2. Review backend logs: `/home/bitnami/everything_backend/logs/`
3. Verify credentials in `.env`
4. Contact PortOne support: https://portone.io/korea/ko/support

---

**Last Updated**: 2025-11-26
**Backend Version**: Node.js 22.18.0, PortOne SDK @portone/server-sdk
**Your Backend Path**: `/home/bitnami/everything_backend`
