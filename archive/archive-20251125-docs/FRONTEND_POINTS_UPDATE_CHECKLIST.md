# Frontend Points System Update Checklist

**Date Created:** 2025-11-17
**Business Decision:** Earning rate confirmed at **2.5%** (not 5%)
**Status:** ⚠️ ACTION REQUIRED - Frontend needs updates to align with backend

---

## 🎯 Executive Summary

The backend correctly implements a **2.5% earning rate** for points. The frontend documentation and code currently reference **5%**, which is incorrect and needs to be updated.

**Backend Status:** ✅ Correct (2.5%)
**Frontend Status:** ❌ Incorrect (5%) - Needs update

---

## 📋 Required Updates

### 1. Documentation Update

**File:** `/home/bitnami/ebeautything-app/POINTS_SYSTEM_DOCUMENTATION.md`

**Current (INCORRECT):**
```typescript
// Calculate points earned: 5% cashback
const pointsEarned = Math.floor(paymentAmount * 0.05);
```

**Should be (CORRECT):**
```typescript
// Calculate points earned: 2.5% cashback
const pointsEarned = Math.floor(paymentAmount * 0.025);
```

**Action Items:**
- [ ] Update earning rate from 5% to 2.5% throughout documentation
- [ ] Update all code examples to use 0.025 instead of 0.05
- [ ] Update description text (e.g., "5% 캐시백" → "2.5% 적립")
- [ ] Review all sections mentioning cashback percentage

---

### 2. Frontend Code Updates

**Search for and replace all instances of:**

#### Pattern 1: Earning rate constant
```typescript
// FIND:
const EARNING_RATE = 0.05;
// or
EARNING_RATE: 0.05

// REPLACE WITH:
const EARNING_RATE = 0.025;
// or
EARNING_RATE: 0.025
```

#### Pattern 2: Direct calculation
```typescript
// FIND:
paymentAmount * 0.05
// or
Math.floor(paymentAmount * 0.05)

// REPLACE WITH:
paymentAmount * 0.025
// or
Math.floor(paymentAmount * 0.025)
```

#### Pattern 3: Display text
```typescript
// FIND (Korean):
"5% 적립"
"5% 캐시백"
"5%를 포인트로"

// REPLACE WITH:
"2.5% 적립"
"2.5% 캐시백"
"2.5%를 포인트로"

// FIND (English):
"5% cashback"
"5% back in points"
"Earn 5%"

// REPLACE WITH:
"2.5% cashback"
"2.5% back in points"
"Earn 2.5%"
```

**Recommended Search Command:**
```bash
# Search for all instances of "0.05" in TypeScript/JavaScript files
grep -r "0\.05" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Search for all instances of "5%" in all files
grep -r "5%" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" --include="*.md"
```

---

### 3. Configuration/Constants Files

**Expected locations to check:**

```typescript
// File: src/config/points.config.ts (or similar)
export const POINT_POLICY = {
  EARNING_RATE: 0.025, // ✅ Update from 0.05 to 0.025
  EARNING_PERCENTAGE: 2.5, // ✅ Update from 5 to 2.5
  EARNING_DESCRIPTION: '2.5% 적립', // ✅ Update from "5% 적립"
  MAX_ELIGIBLE_AMOUNT: 300000,
  MIN_REDEMPTION_AMOUNT: 1000,
  MAX_REDEMPTION_PERCENTAGE: 50,
  AVAILABILITY_DELAY_DAYS: 7,
  EXPIRATION_DAYS: 365
};
```

---

### 4. UI Components

**Components likely to show earning rate:**

#### Point Display Components
```typescript
// File: components/Points/PointsEarningDisplay.tsx (or similar)

// BEFORE:
<Text>결제금액의 5%를 포인트로 적립</Text>

// AFTER:
<Text>결제금액의 2.5%를 포인트로 적립</Text>
```

#### Point Calculator/Preview
```typescript
// File: components/Reservation/PointsPreview.tsx (or similar)

// BEFORE:
const estimatedPoints = Math.floor(paymentAmount * 0.05);

// AFTER:
const estimatedPoints = Math.floor(paymentAmount * 0.025);
```

#### Point Policy Info
```typescript
// File: components/Points/PolicyInfo.tsx (or similar)

// BEFORE:
<Text>포인트 적립률: 5%</Text>

// AFTER:
<Text>포인트 적립률: 2.5%</Text>
```

---

### 5. API Integration

**Verify API calls use backend rate:**

```typescript
// File: services/points.service.ts (or similar)

// If frontend calculates points before sending to backend:
// ❌ DON'T DO THIS (frontend should not calculate, backend does)
const points = Math.floor(amount * 0.05);
await api.post('/points/earn', { amount, points });

// ✅ DO THIS (let backend calculate)
await api.post('/points/earn', { amount });
// Backend will calculate points using 2.5% rate

// If frontend displays estimated points:
// ✅ This is OK, but use correct rate
const estimatedPoints = Math.floor(amount * 0.025);
```

**Important Note:**
- Frontend should **NOT** send calculated points to backend
- Backend always recalculates using server-side logic
- Frontend calculations are **for display purposes only**

---

### 6. Marketing Materials & Help Docs

**Files to check:**

- [ ] User onboarding screens
- [ ] In-app help/FAQ sections
- [ ] Point system explanation modals
- [ ] Terms of service (if mentions earning rate)
- [ ] Privacy policy (if mentions point calculations)
- [ ] Email templates (welcome emails, point notifications)
- [ ] Push notification templates

**Text replacements:**
```
5% 포인트 적립 → 2.5% 포인트 적립
5% cashback → 2.5% cashback
매 결제 시 5% → 매 결제 시 2.5%
```

---

### 7. Testing Checklist

After making updates, verify:

#### Unit Tests
- [ ] Update point calculation test assertions (5% → 2.5%)
- [ ] Update mock data with correct earning rate
- [ ] Verify all point-related tests pass

#### Integration Tests
- [ ] Test point earning flow shows correct amounts
- [ ] Verify estimated points match actual earned points
- [ ] Test edge cases (max cap of 300,000 KRW)

#### UI Tests
- [ ] Point earning preview displays correct amounts
- [ ] Point history shows accurate calculations
- [ ] Policy information shows 2.5%

#### Example Test Update:
```typescript
// BEFORE:
expect(calculatePoints(10000)).toBe(500); // 10,000 * 0.05 = 500

// AFTER:
expect(calculatePoints(10000)).toBe(250); // 10,000 * 0.025 = 250
```

---

### 8. Validation Against Backend

**Create a validation test:**

```typescript
// Test to ensure frontend matches backend
describe('Points calculation alignment', () => {
  it('should calculate points using 2.5% rate matching backend', async () => {
    const testAmount = 100000;

    // Frontend calculation
    const frontendPoints = Math.floor(testAmount * 0.025);

    // Backend calculation (from actual API)
    const response = await api.post('/reservations/complete', {
      amount: testAmount,
      // ... other fields
    });
    const backendPoints = response.data.pointsEarned;

    // Should match (within rounding tolerance)
    expect(frontendPoints).toBe(backendPoints);
    expect(frontendPoints).toBe(2500); // 100,000 * 0.025 = 2,500
  });

  it('should respect 300K KRW cap', () => {
    const testAmount = 500000; // 500K KRW
    const eligibleAmount = Math.min(testAmount, 300000);
    const points = Math.floor(eligibleAmount * 0.025);

    expect(points).toBe(7500); // 300,000 * 0.025 = 7,500 (not 12,500)
  });
});
```

---

## 🔍 Search Patterns

**Use these commands to find all instances:**

```bash
# In your frontend directory:
cd /home/bitnami/ebeautything-app

# Find all 0.05 references (earning rate)
grep -rn "0\.05" . --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Find all "5%" text references
grep -rn "5%" . --include="*.ts" --include="*.tsx" --include="*.md" --include="*.json"

# Find Korean text with 5%
grep -rn "5% 적립\|5% 캐시백\|5%를" .

# Find English text with 5%
grep -rn "5% cashback\|5% back\|Earn 5%" .
```

---

## ✅ Completion Checklist

### Phase 1: Code Updates
- [ ] Updated POINTS_SYSTEM_DOCUMENTATION.md
- [ ] Updated configuration/constants files
- [ ] Updated all calculation logic (0.05 → 0.025)
- [ ] Updated UI component text
- [ ] Updated test assertions

### Phase 2: Content Updates
- [ ] Updated onboarding screens
- [ ] Updated help/FAQ sections
- [ ] Updated email templates
- [ ] Updated push notification templates
- [ ] Updated terms of service (if applicable)

### Phase 3: Validation
- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Manual testing completed
- [ ] Backend alignment verified
- [ ] No references to "5%" remaining

### Phase 4: Deployment
- [ ] Code review completed
- [ ] Changes merged to main branch
- [ ] Deployed to staging environment
- [ ] Smoke testing in staging
- [ ] Deployed to production
- [ ] User communication prepared (if needed)

---

## 📊 Expected Point Calculations

**Reference table for validation:**

| Payment Amount | Points Earned (2.5%) | Notes |
|----------------|---------------------|-------|
| 10,000 KRW | 250P | 10,000 × 0.025 |
| 50,000 KRW | 1,250P | 50,000 × 0.025 |
| 100,000 KRW | 2,500P | 100,000 × 0.025 |
| 200,000 KRW | 5,000P | 200,000 × 0.025 |
| 300,000 KRW | 7,500P | 300,000 × 0.025 (at cap) |
| 500,000 KRW | 7,500P | Capped at 300,000 |
| 1,000,000 KRW | 7,500P | Capped at 300,000 |

**Formula:**
```typescript
const eligibleAmount = Math.min(paymentAmount, 300000);
const points = Math.floor(eligibleAmount * 0.025);
```

---

## ⚠️ Important Notes

1. **Backend is Source of Truth**
   - Backend always calculates actual points awarded
   - Frontend calculations are for display/preview only
   - Never trust client-side calculations for actual point awards

2. **Rounding**
   - Always use `Math.floor()` to round down
   - Backend uses same rounding logic
   - Example: 10,999 KRW × 0.025 = 274.975 → 274P (not 275P)

3. **Cap Enforcement**
   - Maximum eligible amount: 300,000 KRW
   - Payments above 300K still earn only 7,500P
   - Cap is applied before percentage calculation

4. **Influencer Multiplier**
   - Influencers get 2x points (5% effective rate)
   - This is handled by backend only
   - Frontend should not display different rates for influencers

---

## 🚀 Deployment Plan

**Recommended approach:**

1. **Soft Launch** (Internal testing)
   - Deploy to staging
   - Test with team accounts
   - Verify all calculations match backend

2. **Communication** (If needed)
   - Inform users if rate was publicly advertised as 5%
   - Explain correct rate is 2.5%
   - Apologize for confusion if necessary

3. **Production Deployment**
   - Deploy during low-traffic period
   - Monitor error rates
   - Check for user complaints
   - Verify point calculations in production

4. **Post-Deployment Monitoring**
   - Monitor point earnings for anomalies
   - Check support tickets for confusion
   - Verify analytics show correct calculations

---

## 📞 Support

**Questions or issues?**
- Backend team: Review `/home/bitnami/everything_backend/POINTS_SYSTEM_ANALYSIS_REPORT.md`
- API documentation: `http://localhost:3001/api-docs`
- Point calculation source: `/home/bitnami/everything_backend/src/constants/point-policies.ts`

---

**Document Status:** Ready for Frontend Team Review
**Last Updated:** 2025-11-17
**Next Review:** After frontend updates completed
