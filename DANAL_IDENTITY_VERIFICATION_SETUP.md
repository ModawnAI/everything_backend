# Danal Identity Verification Setup Guide

## Overview

This guide covers the complete setup and integration of Danal identity verification (본인인증) service using PortOne V2 API for the 에뷰리띵 (eBeautything) platform.

## Channel Information

- **Channel Name**: 에뷰리띵
- **Channel Type**: 본인인증 (Identity Verification)
- **PG Provider**: Danal
- **Channel Key**: `channel-key-f59b5a95-8507-411c-93a0-dc5fc2d84a91`
- **PG상점아이디 (CPID)**: `B010009040`
- **CPPWD**: `Nh5IhMW5kg`

## Architecture

### Backend Components

1. **Database Layer** (`/supabase/migrations/20251227_identity_verification.sql`)
   - `identity_verifications` table for storing verification records
   - Supports CI (Connecting Information) and DI (Duplication Information) for duplicate prevention
   - Includes RLS policies for secure data access
   - Tracks verification status: `READY`, `VERIFIED`, `FAILED`

2. **Service Layer** (`/src/services/identity-verification.service.ts`)
   - `initializeVerification()`: Creates verification record
   - `getVerificationResult()`: Fetches result from PortOne API
   - `processVerificationResult()`: Updates database with verification results
   - `checkDuplicateByCi()`, `checkDuplicateByDi()`: Duplicate user prevention
   - `validateAgeRestriction()`: Age verification logic
   - `buildDanalBypass()`: Constructs Danal-specific parameters

3. **Controller Layer** (`/src/controllers/identity-verification.controller.ts`)
   - `POST /api/identity-verification/prepare`: Prepare verification request
   - `POST /api/identity-verification/verify`: Verify identity result
   - `GET /api/identity-verification/status/:id`: Get verification status
   - `POST /api/identity-verification/danal/bypass-params`: Build Danal bypass parameters

4. **Configuration** (`/src/config/environment.ts`)
   - Added `PORTONE_V2_IDENTITY_VERIFICATION_CHANNEL_KEY` configuration
   - Validates channel key in production environment
   - Accessible via `config.payments.portone.v2.identityVerificationChannelKey`

### Frontend Components

1. **Identity Verification Library** (`/src/lib/payments/portone-identity.ts`)
   - Uses `@portone/browser-sdk` v0.1.1
   - `requestIdentityVerification()`: SDK integration with Danal bypass parameters
   - `verifyIdentityOnBackend()`: Backend API verification call
   - `completeIdentityVerification()`: Full flow automation
   - Supports carrier restrictions (SKT, KT, LGU+, etc.)
   - Supports age limits (AGELIMIT parameter)
   - Custom CPTITLE for branding

2. **React Component** (`/src/components/auth/portone-identity-verification.tsx`)
   - Full-featured UI component with loading states
   - Error handling and retry logic
   - Success display with verified customer information
   - Toast notifications for user feedback
   - Compact button variant available

## Environment Configuration

### Backend (.env)

```env
# Identity Verification (PortOne V2 - Danal)
PORTONE_IDENTITY_VERIFICATION_ENABLED=true
PORTONE_V2_IDENTITY_VERIFICATION_CHANNEL_KEY=channel-key-f59b5a95-8507-411c-93a0-dc5fc2d84a91
PORTONE_IDENTITY_PROVIDER=danal
DANAL_CPID=B010009040
DANAL_CPPWD=Nh5IhMW5kg
```

### Frontend (.env)

```env
# PortOne V2 Identity Verification Configuration (Danal)
NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY=channel-key-f59b5a95-8507-411c-93a0-dc5fc2d84a91
```

## Database Setup

Run the migration to create the `identity_verifications` table:

```bash
# Apply the migration
psql -h <supabase-host> -U postgres -d postgres -f supabase/migrations/20251227_identity_verification.sql
```

Or use Supabase CLI:

```bash
supabase db push
```

### Table Schema

```sql
CREATE TABLE identity_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  verification_id TEXT NOT NULL UNIQUE,
  store_id TEXT NOT NULL,
  channel_key TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_id TEXT,
  status TEXT NOT NULL DEFAULT 'READY',
  verified_customer JSONB,
  custom_data JSONB,
  pg_provider TEXT DEFAULT 'danal',
  pg_tx_id TEXT,
  pg_raw_response JSONB,
  requested_at TIMESTAMPTZ,
  verified_at TIMESTAMPTZ,
  status_changed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  metadata JSONB DEFAULT '{}'::jsonb
);
```

## API Endpoints

### 1. Prepare Verification

**Endpoint**: `POST /api/identity-verification/prepare`

**Request Body**:
```json
{
  "identityVerificationId": "unique-verification-id",
  "customer": {
    "name": "홍길동",
    "phoneNumber": "01012345678"
  },
  "bypass": {
    "danal": {
      "IsCarrier": "SKT",
      "AGELIMIT": 19,
      "CPTITLE": "에뷰리띵"
    }
  },
  "customData": {
    "purpose": "account_verification"
  }
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "identityVerificationId": "unique-verification-id",
    "status": "READY"
  },
  "message": "본인인증 준비가 완료되었습니다."
}
```

### 2. Verify Identity

**Endpoint**: `POST /api/identity-verification/verify`

**Request Body**:
```json
{
  "identityVerificationId": "unique-verification-id"
}
```

**Response** (Success):
```json
{
  "success": true,
  "data": {
    "identityVerificationId": "unique-verification-id",
    "status": "VERIFIED",
    "verifiedCustomer": {
      "name": "홍길동",
      "phoneNumber": "01012345678",
      "birthDate": "1990-01-01",
      "gender": "MALE",
      "isForeigner": false,
      "ci": "unique-ci-value",
      "di": "unique-di-value",
      "operator": "SKT"
    }
  },
  "message": "본인인증이 완료되었습니다."
}
```

### 3. Get Verification Status

**Endpoint**: `GET /api/identity-verification/status/:identityVerificationId`

**Response**:
```json
{
  "success": true,
  "data": {
    "exists": true,
    "status": "VERIFIED",
    "requestedAt": "2025-11-27T10:00:00Z",
    "verifiedAt": "2025-11-27T10:02:00Z"
  }
}
```

## Frontend Integration

### Basic Usage

```tsx
import { PortOneIdentityVerification } from '@/components/auth/portone-identity-verification';

export default function SignupPage() {
  const handleVerificationComplete = (result: VerifiedCustomerInfo) => {
    console.log('Verification complete:', result);
    // Use CI/DI for duplicate checking
    // Store verified customer info
    // Proceed with account creation
  };

  return (
    <PortOneIdentityVerification
      onVerificationComplete={handleVerificationComplete}
      onVerificationError={(error) => {
        console.error('Verification failed:', error);
      }}
    />
  );
}
```

### Advanced Usage with Custom Parameters

```tsx
import { completeIdentityVerification } from '@/lib/payments/portone-identity';

async function verifyUser() {
  try {
    const result = await completeIdentityVerification({
      storeId: process.env.NEXT_PUBLIC_PORTONE_STORE_ID!,
      channelKey: process.env.NEXT_PUBLIC_PORTONE_IDENTITY_CHANNEL_KEY!,
      customer: {
        name: '홍길동',
        phoneNumber: '01012345678'
      },
      minAge: 19,
      carrierRestriction: 'SKT',
      customData: {
        purpose: 'account_verification',
        userId: 'user-123'
      }
    });

    if (result.success) {
      console.log('Verified customer:', result.verifiedCustomer);
      // CI: result.verifiedCustomer.ci
      // DI: result.verifiedCustomer.di
    }
  } catch (error) {
    console.error('Verification error:', error);
  }
}
```

## Danal Bypass Parameters

### IsCarrier (통신사 제한)

Restrict verification to specific carriers:

- `SKT` - SK Telecom
- `KT` - KT
- `LGU` - LG U+
- `SKT;KT` - Multiple carriers (semicolon-separated)
- `MVNO` - All MVNOs

### AGELIMIT (연령 제한)

Set minimum age requirement:

```typescript
bypass: {
  danal: {
    AGELIMIT: 19  // Require user to be at least 19 years old
  }
}
```

### CPTITLE (상호명 표시)

Custom title displayed during verification:

```typescript
bypass: {
  danal: {
    CPTITLE: '에뷰리띵'  // Display custom service name
  }
}
```

## CI/DI Duplicate Prevention

### What is CI (Connecting Information)?

- Unique identifier that remains consistent across different services
- Used to identify if the same person has accounts in different services
- Cannot be reversed to get personal information
- Mandatory in Korea for financial/adult services

### What is DI (Duplication Information)?

- Unique identifier within a single service
- Used to prevent duplicate accounts in the same service
- Changes if user re-verifies after data deletion

### Implementation

```typescript
// Check for duplicate by CI
const existingUser = await identityVerificationService.checkDuplicateByCi(verifiedCustomer.ci);

if (existingUser) {
  throw new Error('This user already has an account');
}

// Check for duplicate by DI
const duplicateAccount = await identityVerificationService.checkDuplicateByDi(verifiedCustomer.di);

if (duplicateAccount) {
  throw new Error('Duplicate account detected');
}
```

## Testing

### Test Flow

1. **Frontend initiates verification**:
   ```typescript
   const verificationId = generateIdentityVerificationId();
   await requestIdentityVerification({
     storeId: 'store-e8fdd5ab-363e-4b42-8326-b740a207acef',
     channelKey: 'channel-key-f59b5a95-8507-411c-93a0-dc5fc2d84a91',
     identityVerificationId: verificationId
   });
   ```

2. **User completes verification on Danal page**

3. **Frontend receives callback**:
   ```typescript
   // PortOne SDK calls this automatically
   const result = await verifyIdentityOnBackend(verificationId);
   ```

4. **Backend processes result**:
   - Fetches verification from PortOne API
   - Stores verified customer data
   - Checks for duplicates using CI/DI
   - Returns verification result

### Manual Testing

```bash
# Test prepare endpoint
curl -X POST http://localhost:3001/api/identity-verification/prepare \
  -H "Content-Type: application/json" \
  -d '{
    "identityVerificationId": "test-verification-123",
    "customer": {
      "name": "홍길동",
      "phoneNumber": "01012345678"
    }
  }'

# Test status endpoint
curl http://localhost:3001/api/identity-verification/status/test-verification-123
```

## Security Considerations

1. **Always verify on backend**: Never trust client-side verification results
2. **Use HTTPS**: All verification flows must use HTTPS in production
3. **Store sensitive data securely**: CI/DI should be encrypted at rest
4. **Rate limiting**: Implement rate limits on verification endpoints
5. **Logging**: Log all verification attempts for audit trails
6. **RLS policies**: Ensure users can only access their own verification records

## Error Handling

### Common Errors

1. **MISSING_IDENTITY_VERIFICATION_ID**:
   - Cause: No verification ID provided
   - Solution: Generate unique ID before calling API

2. **VERIFICATION_NOT_FOUND**:
   - Cause: Verification record doesn't exist
   - Solution: Check if verification was properly initialized

3. **VERIFICATION_FAILED**:
   - Cause: User failed identity verification
   - Solution: Allow retry with different information

4. **DUPLICATE_USER**:
   - Cause: CI/DI already exists
   - Solution: Guide user to login instead of signup

## Monitoring

### Key Metrics to Track

1. Verification success rate
2. Average verification time
3. Common failure reasons
4. Duplicate detection rate
5. Carrier distribution

### Database Queries

```sql
-- Verification success rate
SELECT
  status,
  COUNT(*) as count,
  ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as percentage
FROM identity_verifications
GROUP BY status;

-- Average verification time
SELECT
  AVG(EXTRACT(EPOCH FROM (verified_at - requested_at))) as avg_seconds
FROM identity_verifications
WHERE status = 'VERIFIED';

-- Duplicate detection
SELECT
  verified_customer->>'ci' as ci,
  COUNT(*) as occurrences
FROM identity_verifications
WHERE status = 'VERIFIED'
GROUP BY verified_customer->>'ci'
HAVING COUNT(*) > 1;
```

## Troubleshooting

### Issue: Verification stuck in READY status

**Solution**:
1. Check if user completed verification on Danal page
2. Verify webhook configuration (if using webhooks)
3. Check PortOne API connectivity
4. Review backend logs for API errors

### Issue: CI/DI not returned

**Solution**:
1. Verify channel is properly configured for CI/DI
2. Check with PortOne support for channel settings
3. Ensure verification completed successfully

### Issue: Age restriction not working

**Solution**:
1. Verify AGELIMIT is set in bypass parameters
2. Check Danal channel supports age restrictions
3. Use `validateAgeRestriction()` on backend as backup

## Support

For issues with:
- **PortOne API**: Contact PortOne support at support@portone.io
- **Danal Service**: Contact Danal support
- **Backend Integration**: Check logs at `/home/bitnami/everything_backend/logs/`
- **Frontend Issues**: Check browser console for errors

## References

- [PortOne V2 Identity Verification Documentation](https://developers.portone.io/docs/ko/v2/identity-verification)
- [Danal Identity Verification Guide](https://developers.portone.io/docs/ko/v2/pg/danal)
- [CI/DI Specification](https://www.kisa.or.kr/)

---

**Last Updated**: 2025-11-27
**Version**: 1.0.0
