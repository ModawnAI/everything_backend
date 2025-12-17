# Referee Welcome Bonus Implementation Guide

**Date Created:** 2025-11-17
**Business Decision:** Keep 10% referral bonus structure, add referee bonus
**Priority:** 🔴 HIGH - Missing feature that users expect
**Status:** Ready for implementation

---

## 📋 Executive Summary

**Current State:**
- ✅ Referrer receives 10% of referee's base points as bonus
- ❌ Referee receives NO welcome bonus (missing feature)

**Target State:**
- ✅ Referrer receives 10% of referee's base points as bonus
- ✅ Referee ALSO receives 10% of their own base points as welcome bonus

**Business Logic:**
Both parties receive 10% of the **base points** (before influencer multiplier is applied).

---

## 🎯 Implementation Overview

### Files to Modify

1. **`src/services/enhanced-referral.service.ts`**
   - Update `ReferralRewardCalculation` interface
   - Update `calculateReferralReward()` method
   - Update referral completion flow

2. **`src/types/point.types.ts`** (or similar)
   - Add `EARNED_REFERRAL_SIGNUP` transaction type

3. **Tests to Create/Update**
   - Unit tests for `calculateReferralReward()` with both bonuses
   - Integration tests for referral completion flow
   - E2E test for complete referral journey

---

## 📝 Step-by-Step Implementation

### Step 1: Update ReferralRewardCalculation Interface

**File:** `src/services/enhanced-referral.service.ts`

**Current Interface (Line ~16):**
```typescript
export interface ReferralRewardCalculation {
  referrerId: string;
  referredId: string;
  originalPaymentAmount: number;
  basePointsEarned: number;
  referralRewardAmount: number;        // Only referrer's reward
  referralPercentage: number;
  isInfluencerEligible: boolean;
  totalReferrals: number;
  calculation: {
    basePoints: number;
    referralReward: number;
    beforeInfluencerMultiplier: boolean;
  };
}
```

**Updated Interface (ADD refereeRewardAmount field):**
```typescript
export interface ReferralRewardCalculation {
  referrerId: string;
  referredId: string;
  originalPaymentAmount: number;
  basePointsEarned: number;
  referralRewardAmount: number;        // Referrer's bonus (10% of base)
  refereeRewardAmount: number;         // ✨ NEW: Referee's welcome bonus (10% of base)
  referralPercentage: number;
  isInfluencerEligible: boolean;
  totalReferrals: number;
  calculation: {
    basePoints: number;
    referralReward: number;
    refereeReward: number;             // ✨ NEW: Track referee reward in calculation
    beforeInfluencerMultiplier: boolean;
  };
}
```

---

### Step 2: Add New Transaction Type

**File:** `src/types/point.types.ts` (or wherever transaction types are defined)

**Add to PointTransactionType enum:**
```typescript
export enum PointTransactionType {
  EARNED_SERVICE = 'earned_service',
  EARNED_REFERRAL = 'earned_referral',              // Existing: For referrer
  EARNED_REFERRAL_SIGNUP = 'earned_referral_signup', // ✨ NEW: For referee welcome bonus
  REDEEMED = 'redeemed',
  EXPIRED = 'expired',
  CANCELLED = 'cancelled',
  ADJUSTED = 'adjusted',
}
```

**Add to database if needed:**
```sql
-- If using database enum, add migration
ALTER TYPE point_transaction_type ADD VALUE 'earned_referral_signup';
```

---

### Step 3: Update calculateReferralReward() Method

**File:** `src/services/enhanced-referral.service.ts`

**Current Method (Line ~98):**
```typescript
async calculateReferralReward(
  referrerId: string,
  referredId: string,
  originalPaymentAmount: number
): Promise<ReferralRewardCalculation> {
  // Get referrer information
  const { data: referrer } = await this.supabase
    .from('users')
    .select('id, is_influencer, total_referrals')
    .eq('id', referrerId)
    .single();

  if (!referrer) {
    throw new Error('Referrer not found');
  }

  // Calculate base points WITHOUT influencer multiplier
  const basePointsEarned = POINT_CALCULATIONS.calculateServicePoints(
    originalPaymentAmount,
    false, // Don't apply influencer multiplier
    1.0    // Don't apply tier multiplier
  );

  // Calculate referral reward as 10% of base points
  const referralRewardAmount = Math.floor(basePointsEarned * this.REFERRAL_REWARD_PERCENTAGE);

  return {
    referrerId,
    referredId,
    originalPaymentAmount,
    basePointsEarned,
    referralRewardAmount,
    referralPercentage: this.REFERRAL_REWARD_PERCENTAGE,
    isInfluencerEligible: referrer.is_influencer,
    totalReferrals: referrer.total_referrals || 0,
    calculation: {
      basePoints: basePointsEarned,
      referralReward: referralRewardAmount,
      beforeInfluencerMultiplier: true,
    },
  };
}
```

**Updated Method (WITH referee bonus calculation):**
```typescript
async calculateReferralReward(
  referrerId: string,
  referredId: string,
  originalPaymentAmount: number
): Promise<ReferralRewardCalculation> {
  // Get referrer information
  const { data: referrer } = await this.supabase
    .from('users')
    .select('id, is_influencer, total_referrals')
    .eq('id', referrerId)
    .single();

  if (!referrer) {
    throw new Error('Referrer not found');
  }

  // Calculate base points WITHOUT influencer multiplier
  const basePointsEarned = POINT_CALCULATIONS.calculateServicePoints(
    originalPaymentAmount,
    false, // Don't apply influencer multiplier
    1.0    // Don't apply tier multiplier
  );

  // ✨ NEW: Calculate BOTH referrer and referee rewards (10% of base points each)
  const referralRewardAmount = Math.floor(basePointsEarned * this.REFERRAL_REWARD_PERCENTAGE); // Referrer
  const refereeRewardAmount = Math.floor(basePointsEarned * this.REFERRAL_REWARD_PERCENTAGE);  // Referee

  return {
    referrerId,
    referredId,
    originalPaymentAmount,
    basePointsEarned,
    referralRewardAmount,
    refereeRewardAmount,  // ✨ NEW: Include referee reward
    referralPercentage: this.REFERRAL_REWARD_PERCENTAGE,
    isInfluencerEligible: referrer.is_influencer,
    totalReferrals: referrer.total_referrals || 0,
    calculation: {
      basePoints: basePointsEarned,
      referralReward: referralRewardAmount,
      refereeReward: refereeRewardAmount,  // ✨ NEW: Track referee reward
      beforeInfluencerMultiplier: true,
    },
  };
}
```

---

### Step 4: Update Referral Completion Flow

**File:** `src/services/enhanced-referral.service.ts` (or wherever referral completion is handled)

**Find the method that awards referral points (likely in a method like `completeReferral()` or similar):**

**Current Flow (Referrer only):**
```typescript
// Award points to referrer
await this.pointService.awardPoints({
  userId: referralReward.referrerId,
  amount: referralReward.referralRewardAmount,
  transactionType: PointTransactionType.EARNED_REFERRAL,
  description: `Referral bonus for referring ${referralReward.referredId}`,
  metadata: {
    referredId: referralReward.referredId,
    originalPaymentAmount: referralReward.originalPaymentAmount,
  },
});
```

**Updated Flow (BOTH referrer AND referee):**
```typescript
// ✨ Award points to BOTH parties

// 1. Award points to referrer (existing logic)
await this.pointService.awardPoints({
  userId: referralReward.referrerId,
  amount: referralReward.referralRewardAmount,
  transactionType: PointTransactionType.EARNED_REFERRAL,
  description: `Referral bonus for referring user`,
  metadata: {
    referredId: referralReward.referredId,
    originalPaymentAmount: referralReward.originalPaymentAmount,
    basePointsEarned: referralReward.basePointsEarned,
  },
});

// 2. ✨ NEW: Award welcome bonus to referee (new user)
await this.pointService.awardPoints({
  userId: referralReward.referredId,
  amount: referralReward.refereeRewardAmount,
  transactionType: PointTransactionType.EARNED_REFERRAL_SIGNUP,
  description: `Welcome bonus for signing up with referral code`,
  metadata: {
    referrerId: referralReward.referrerId,
    originalPaymentAmount: referralReward.originalPaymentAmount,
    basePointsEarned: referralReward.basePointsEarned,
  },
});
```

---

### Step 5: Update Point Availability Logic

**Important:** Ensure that referee's welcome bonus follows the same 7-day delay as service points.

**File:** `src/services/point.service.ts` (in `awardPoints()` method)

**Check availability date calculation:**
```typescript
// For EARNED_REFERRAL_SIGNUP (referee bonus), apply same 7-day delay
const availableAt =
  type === PointTransactionType.EARNED_SERVICE ||
  type === PointTransactionType.EARNED_REFERRAL_SIGNUP
    ? new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)  // 7 days from now
    : new Date();  // Immediately available for other types
```

---

## 🧮 Example Calculations

### Scenario 1: Regular User Referral

**User A (Referrer):** Regular user
**User B (Referee):** New user signs up with referral code
**First Purchase:** 100,000 KRW

**Calculations:**

```typescript
// Step 1: Calculate base points (before influencer multiplier)
const paymentAmount = 100000;
const basePoints = Math.floor(100000 * 0.025); // 2,500P

// Step 2: Calculate referral rewards (10% of base)
const referrerReward = Math.floor(2500 * 0.10); // 250P
const refereeReward = Math.floor(2500 * 0.10);  // 250P

// Step 3: User B still gets their normal service points
const userBServicePoints = 2500; // Full 2.5% of 100K
```

**Results:**

| User | Transaction Type | Amount | Available Date | Description |
|------|-----------------|--------|----------------|-------------|
| User A (Referrer) | `earned_referral` | 250P | Immediate | Referral bonus |
| User B (Referee) | `earned_service` | 2,500P | +7 days | Service payment points |
| User B (Referee) | `earned_referral_signup` | 250P | +7 days | Welcome bonus |

**Total for User B:** 2,750P (2,500 + 250)

---

### Scenario 2: Influencer Referee

**User A (Referrer):** Regular user
**User B (Referee):** New influencer signs up with referral code
**First Purchase:** 100,000 KRW

**Calculations:**

```typescript
// Step 1: Calculate base points (before influencer multiplier)
const paymentAmount = 100000;
const basePoints = Math.floor(100000 * 0.025); // 2,500P

// Step 2: Calculate referral rewards (10% of BASE, not influencer points)
const referrerReward = Math.floor(2500 * 0.10); // 250P
const refereeReward = Math.floor(2500 * 0.10);  // 250P

// Step 3: User B gets service points WITH influencer multiplier
const userBServicePoints = Math.floor(2500 * 2.0); // 5,000P (2x multiplier)
```

**Results:**

| User | Transaction Type | Amount | Available Date | Description |
|------|-----------------|--------|----------------|-------------|
| User A (Referrer) | `earned_referral` | 250P | Immediate | Referral bonus (10% of base) |
| User B (Referee) | `earned_service` | 5,000P | +7 days | Service points (2x influencer) |
| User B (Referee) | `earned_referral_signup` | 250P | +7 days | Welcome bonus (10% of base) |

**Total for User B:** 5,250P (5,000 + 250)

**Key Point:** Referral bonuses are calculated from **base points** (2,500P), not from the influencer-multiplied points (5,000P).

---

### Scenario 3: Large Purchase at Cap

**User A (Referrer):** Regular user
**User B (Referee):** New user signs up with referral code
**First Purchase:** 500,000 KRW (exceeds 300K cap)

**Calculations:**

```typescript
// Step 1: Calculate base points (with 300K cap)
const paymentAmount = 500000;
const eligibleAmount = Math.min(500000, 300000); // 300,000 KRW (capped)
const basePoints = Math.floor(300000 * 0.025); // 7,500P

// Step 2: Calculate referral rewards (10% of capped base)
const referrerReward = Math.floor(7500 * 0.10); // 750P
const refereeReward = Math.floor(7500 * 0.10);  // 750P

// Step 3: User B gets service points (capped at 300K)
const userBServicePoints = 7500; // 2.5% of 300K
```

**Results:**

| User | Transaction Type | Amount | Available Date | Description |
|------|-----------------|--------|----------------|-------------|
| User A (Referrer) | `earned_referral` | 750P | Immediate | Referral bonus (10% of 7,500) |
| User B (Referee) | `earned_service` | 7,500P | +7 days | Service points (capped at 300K) |
| User B (Referee) | `earned_referral_signup` | 750P | +7 days | Welcome bonus (10% of 7,500) |

**Total for User B:** 8,250P (7,500 + 750)

---

## ✅ Testing Checklist

### Unit Tests

**File:** `tests/unit/enhanced-referral.service.test.ts`

```typescript
describe('EnhancedReferralService - calculateReferralReward', () => {
  it('should calculate BOTH referrer and referee rewards at 10% of base points', async () => {
    const result = await service.calculateReferralReward(
      'referrer-id',
      'referee-id',
      100000
    );

    expect(result.basePointsEarned).toBe(2500);
    expect(result.referralRewardAmount).toBe(250);  // Referrer
    expect(result.refereeRewardAmount).toBe(250);   // Referee
  });

  it('should calculate rewards based on BASE points, not influencer-multiplied points', async () => {
    // Even if referee is influencer, bonus is 10% of base (before 2x)
    const result = await service.calculateReferralReward(
      'referrer-id',
      'influencer-referee-id',
      100000
    );

    expect(result.basePointsEarned).toBe(2500);
    expect(result.referralRewardAmount).toBe(250);  // 10% of 2,500 (not 5,000)
    expect(result.refereeRewardAmount).toBe(250);   // 10% of 2,500 (not 5,000)
  });

  it('should respect 300K cap when calculating referral bonuses', async () => {
    const result = await service.calculateReferralReward(
      'referrer-id',
      'referee-id',
      500000
    );

    expect(result.basePointsEarned).toBe(7500);     // Capped at 300K * 0.025
    expect(result.referralRewardAmount).toBe(750);  // 10% of 7,500
    expect(result.refereeRewardAmount).toBe(750);   // 10% of 7,500
  });
});
```

### Integration Tests

**File:** `tests/integration/referral-flow.test.ts`

```typescript
describe('Referral Flow - Complete Journey', () => {
  it('should award points to BOTH referrer and referee on first purchase', async () => {
    // 1. User A creates referral code
    const referralCode = await createReferralCode('user-a-id');

    // 2. User B signs up with referral code
    await signUpWithReferral('user-b-id', referralCode);

    // 3. User B makes first purchase (100,000 KRW)
    await completeReservation('user-b-id', 100000);

    // 4. Check User A (referrer) received bonus
    const userATransactions = await getPointTransactions('user-a-id');
    const referralBonus = userATransactions.find(t => t.type === 'earned_referral');
    expect(referralBonus).toBeDefined();
    expect(referralBonus.amount).toBe(250);
    expect(referralBonus.status).toBe('available'); // Immediate

    // 5. Check User B (referee) received welcome bonus
    const userBTransactions = await getPointTransactions('user-b-id');
    const servicePoints = userBTransactions.find(t => t.type === 'earned_service');
    const welcomeBonus = userBTransactions.find(t => t.type === 'earned_referral_signup');

    expect(servicePoints).toBeDefined();
    expect(servicePoints.amount).toBe(2500);
    expect(servicePoints.status).toBe('pending'); // 7-day delay

    expect(welcomeBonus).toBeDefined();
    expect(welcomeBonus.amount).toBe(250);
    expect(welcomeBonus.status).toBe('pending'); // 7-day delay
  });
});
```

### E2E Test Scenarios

- [ ] New user signs up with referral code
- [ ] New user makes first purchase
- [ ] Verify referrer receives 250P immediately
- [ ] Verify referee receives 2,500P + 250P after 7 days
- [ ] Test with influencer referee (service points get 2x, bonus stays 10% of base)
- [ ] Test with large purchase (>300K) to ensure cap applies to bonus calculation
- [ ] Test that second purchase does NOT trigger additional referral bonuses

---

## 🔍 Validation & Monitoring

### Database Queries to Verify Implementation

```sql
-- Check referee welcome bonuses awarded
SELECT
  pt.id,
  pt.user_id,
  pt.amount,
  pt.transaction_type,
  pt.status,
  pt.available_at,
  pt.metadata
FROM point_transactions pt
WHERE pt.transaction_type = 'earned_referral_signup'
ORDER BY pt.created_at DESC
LIMIT 10;

-- Verify both parties received bonuses for a referral
SELECT
  pt.user_id,
  u.email,
  pt.transaction_type,
  pt.amount,
  pt.status,
  pt.metadata->>'referrerId' as related_user
FROM point_transactions pt
JOIN users u ON u.id = pt.user_id
WHERE
  pt.transaction_type IN ('earned_referral', 'earned_referral_signup')
  AND pt.created_at > NOW() - INTERVAL '1 day'
ORDER BY pt.created_at DESC;
```

### Logging Recommendations

Add detailed logs in the referral completion flow:

```typescript
logger.info('Referral bonus awarded', {
  referrerId: referralReward.referrerId,
  referredId: referralReward.referredId,
  referrerBonus: referralReward.referralRewardAmount,
  refereeBonus: referralReward.refereeRewardAmount,
  basePoints: referralReward.basePointsEarned,
  paymentAmount: referralReward.originalPaymentAmount,
});
```

---

## 🚨 Edge Cases & Considerations

### 1. Idempotency
- Ensure referral bonus is only awarded ONCE per referee
- Check if referee has already received welcome bonus before awarding
- Use transaction metadata or separate tracking table

### 2. Transaction Atomicity
- Award both bonuses in a transaction or handle failures gracefully
- If referrer bonus succeeds but referee bonus fails, log and retry

### 3. Availability Date Consistency
- Referee welcome bonus should have same 7-day delay as service points
- Referrer bonus is immediately available (existing behavior)

### 4. Cap Application
- 300K cap applies to service points, which determines base points
- Referral bonuses (10%) are calculated from capped base points

### 5. Influencer Multiplier
- Referral bonuses are ALWAYS 10% of base points
- Influencer multiplier (2x) does NOT apply to referral bonuses
- Only applies to service points

---

## 📊 Success Metrics

After implementation, monitor:

1. **Referral Completion Rate**: % of new users who make first purchase
2. **Average Time to First Purchase**: Days from signup to first transaction
3. **Referee Retention**: Do users with welcome bonus return more often?
4. **Point Redemption**: Do referee bonuses increase point usage?
5. **Database Integrity**: No orphaned transactions, all bonuses paired

---

## 🔗 Related Documentation

- **Main Analysis Report**: `/home/bitnami/everything_backend/POINTS_SYSTEM_ANALYSIS_REPORT.md`
- **Frontend Update Checklist**: `/home/bitnami/everything_backend/FRONTEND_POINTS_UPDATE_CHECKLIST.md`
- **Point Policies**: `/home/bitnami/everything_backend/src/constants/point-policies.ts`
- **Enhanced Referral Service**: `/home/bitnami/everything_backend/src/services/enhanced-referral.service.ts`

---

**Implementation Status:** 📝 Ready for Development
**Estimated Time:** 4-6 hours (including testing)
**Priority:** 🔴 HIGH - User-facing feature gap
**Last Updated:** 2025-11-17
