# PRD: Phase 5 - Payment Processing & Point System

## 📋 Overview
**Phase**: 5 of 6  
**Duration**: 2-3 weeks  
**Priority**: Critical  
**Dependencies**: Phase 1-4 (Foundation, Users, Shops, Reservations)  

This phase implements the comprehensive payment system with Toss Payments integration and the sophisticated point system with v3.2 policies including influencer bonuses and referral rewards.

## 🎯 Objectives

### Primary Goals
1. Integrate Toss Payments for secure payment processing
2. Implement v3.2 point system (30만원 한도, 2.5% 적립, 7일 제한)
3. Build referral reward system with influencer 2x bonuses
4. Create comprehensive point management for users and admins
5. Implement financial reporting and settlement system

### Success Criteria
- [ ] Toss Payments integration working for deposits and final payments
- [ ] Point earning system operational with v3.2 policies
- [ ] Referral system awarding points correctly
- [ ] Point usage system with FIFO logic functional
- [ ] Admin financial management tools operational

## 💳 Payment System Architecture

### Two-Stage Payment Flow
```
1. Reservation Creation → Deposit Payment (20-30%)
2. Service Completion → Final Payment (Remaining Amount)
3. Point Calculation → Based on Total Final Amount
```

### Payment Status Management
```
pending → deposit_paid → fully_paid → (optional) refunded
   ↓           ↓              ↓
Request    Confirmed    Completed
```

## 🔗 API Endpoints to Implement

### 1. Payment Processing APIs
```
POST /api/payments/toss/prepare
POST /api/payments/toss/confirm
POST /api/payments/toss/webhook
GET /api/payments/:paymentId/status
POST /api/payments/:paymentId/refund
```

### 2. Point Management APIs
```
GET /api/user/points
GET /api/user/points/history
POST /api/points/use
GET /api/user/referral-earnings
GET /api/user/referral-code
```

### 3. Admin Financial APIs
```
POST /api/admin/points/adjust
POST /api/admin/payments/partial-refund
GET /api/admin/payments/summary
GET /api/admin/settlements
GET /api/admin/financial-reports
```

### 4. Referral System APIs
```
POST /api/user/validate-referral-code
GET /api/user/referral-stats
GET /api/admin/referral-analytics
PUT /api/admin/users/:userId/promote-influencer
```

## 💎 Point System Implementation (v3.2)

### Point Earning Rules
```typescript
// v3.2 Updated Policy
const POINT_POLICY = {
  EARNING_RATE: 0.025,           // 2.5% of payment
  MAX_ELIGIBLE_AMOUNT: 300000,   // 30만원 한도
  AVAILABILITY_DELAY: 7,         // 7일 후 사용 가능
  EXPIRY_PERIOD: 365,           // 1년 후 만료
  INFLUENCER_MULTIPLIER: 2,      // 인플루언서 2배 보너스
  REFERRAL_RATE: 0.1            // 추천인 10% 보너스
};

// Example calculations:
// 20만원 결제 → 5,000 포인트 (20만원 × 2.5%)
// 40만원 결제 → 7,500 포인트 (30만원 × 2.5%)
// 인플루언서: 위 금액 × 2배
```

### Point Usage Logic (FIFO)
```sql
-- First In, First Out point usage
WITH available_points AS (
    SELECT id, amount, available_from, created_at
    FROM point_transactions
    WHERE user_id = $user_id 
      AND status = 'available'
      AND amount > 0
      AND available_from <= NOW()
      AND expires_at > NOW()
    ORDER BY available_from ASC, created_at ASC
)
-- Process points in chronological order
```

## 🎁 Referral & Influencer System

### Influencer Qualification (v3.2)
```typescript
// Automatic influencer promotion criteria
const INFLUENCER_CRITERIA = {
  TOTAL_REFERRALS: 50,           // 50명 초대
  SUCCESSFUL_REFERRALS: 50,      // 50명 모두 첫 결제 완료
  BONUS_MULTIPLIER: 2,           // 2배 포인트 보너스
  REFERRAL_BONUS: 2              // 추천 보상도 2배
};
```

### Referral Reward Logic
```typescript
// Fair referral calculation (not based on inflated influencer points)
function calculateReferralReward(originalAmount: number, isReferrerInfluencer: boolean) {
  const basePoints = Math.floor(Math.min(originalAmount, 300000) * 0.025);
  const referralPoints = Math.floor(basePoints * 0.1); // 10% of base points
  
  // Referrer's influencer status doesn't affect referral calculation
  return referralPoints;
}
```

## 💰 Toss Payments Integration

### Payment Preparation
```typescript
// Prepare payment with Toss
const paymentData = {
  amount: depositAmount,
  orderId: `order_${reservationId}_${timestamp}`,
  orderName: "에뷰리띵 예약금 결제",
  customerName: user.name,
  customerEmail: user.email,
  successUrl: `${FRONTEND_URL}/payment/success`,
  failUrl: `${FRONTEND_URL}/payment/fail`
};
```

### Webhook Processing
```typescript
// Handle Toss payment webhooks
app.post('/api/payments/toss/webhook', (req, res) => {
  // 1. Verify webhook signature
  // 2. Update payment status
  // 3. Update reservation status (stay 'requested')
  // 4. Send notifications
  // 5. Log transaction
});
```

## 📊 Financial Reporting

### Settlement Calculations
```sql
-- Shop settlement calculation
SELECT 
  s.id,
  s.name,
  COUNT(r.id) as completed_reservations,
  SUM(r.total_amount) as gross_revenue,
  SUM(r.total_amount * s.commission_rate / 100) as commission,
  SUM(r.total_amount * (100 - s.commission_rate) / 100) as net_payout
FROM shops s
JOIN reservations r ON s.id = r.shop_id
WHERE r.status = 'completed'
  AND r.completed_at BETWEEN $start_date AND $end_date
GROUP BY s.id;
```

## 🔐 Security Requirements

### Payment Security
- **PCI Compliance**: No card data storage
- **Webhook Verification**: Signature validation
- **Amount Validation**: Server-side verification
- **Fraud Detection**: Unusual payment patterns

### Point Security
- **Balance Validation**: Prevent negative balances
- **Usage Limits**: Daily/monthly point usage caps
- **Audit Trail**: All point transactions logged
- **Admin Controls**: Point adjustment with approval

## 🧪 Testing Requirements

### Payment Tests
- [ ] Successful payment flows (deposit + final)
- [ ] Payment failure scenarios
- [ ] Refund processing accuracy
- [ ] Webhook reliability
- [ ] Concurrent payment handling

### Point System Tests
- [ ] Point calculation accuracy (various amounts)
- [ ] Influencer bonus calculations
- [ ] FIFO usage logic
- [ ] Point expiration handling
- [ ] Referral reward calculations

### Edge Case Tests
- [ ] Partial refund point adjustments
- [ ] Simultaneous point usage attempts
- [ ] Payment webhook replay attacks
- [ ] Point system abuse scenarios

## 📈 Business Metrics

### Payment Metrics
- Payment success rate (target: >99%)
- Average payment processing time
- Refund processing time
- Payment method distribution

### Point System Metrics
- Point earning rate per user
- Point usage patterns
- Referral conversion rates
- Influencer qualification rate

### Financial Metrics
- Total transaction volume
- Commission revenue
- Refund rates by reason
- Settlement accuracy

## 🚨 Risk Management

### Payment Risks
- **Gateway Downtime**: Fallback payment methods
- **Webhook Failures**: Retry mechanisms and manual reconciliation
- **Refund Delays**: SLA monitoring and escalation
- **Currency Fluctuations**: KRW-only policy

### Point System Risks
- **Point Inflation**: Usage caps and monitoring
- **Referral Abuse**: Chain depth limits and validation
- **System Gaming**: Pattern detection and prevention
- **Data Inconsistency**: Regular balance reconciliation

## 🔧 Implementation Priority

### Week 1: Payment Foundation
1. Toss Payments API integration
2. Basic deposit payment flow
3. Payment status tracking
4. Webhook processing

### Week 2: Point System Core
1. Point calculation functions
2. Point usage (FIFO) system
3. Balance management
4. Basic point APIs

### Week 3: Advanced Features
1. Referral system implementation
2. Influencer bonus calculations
3. Admin financial tools
4. Refund automation

## 📋 Acceptance Criteria

### Payment System
- [ ] Users can pay deposits securely through Toss Payments
- [ ] Final payments are processed correctly after service
- [ ] Refunds are processed automatically based on policies
- [ ] All payment states are tracked accurately
- [ ] Webhook processing is reliable and idempotent

### Point System
- [ ] Points are calculated correctly with v3.2 policies
- [ ] 7-day availability delay is enforced
- [ ] FIFO usage works without balance issues
- [ ] Influencer bonuses are applied automatically
- [ ] Point expiration is handled gracefully

### Referral System
- [ ] Referral codes are unique and trackable
- [ ] Referral rewards are fair and accurate
- [ ] Influencer qualification works automatically
- [ ] Circular references are prevented
- [ ] Referral analytics are comprehensive

## 🔄 Integration Points

### With Previous Phases
- User authentication for payment authorization
- Shop information for commission calculations
- Reservation data for payment amounts
- Notification system for payment alerts

### For Next Phase
- Payment completion events for analytics
- Point transaction data for reporting
- Financial data for admin dashboards
- User behavior data for recommendations

## 📋 Definition of Done

### Phase 5 is complete when:
1. ✅ Toss Payments integration is production-ready
2. ✅ Point system operates according to v3.2 policies
3. ✅ Referral system rewards are calculated fairly
4. ✅ Payment refunds are processed automatically
5. ✅ Financial reporting is accurate and comprehensive
6. ✅ Admin can manage points and payments effectively
7. ✅ All payment flows are secure and compliant
8. ✅ Test coverage >95% for financial operations
9. ✅ Performance targets met for payment processing

## 🔄 Next Phase
**Phase 6**: Social Feed & Advanced Features
- Social feed system implementation
- Content moderation and reporting
- Advanced analytics and insights
- Performance optimization and scaling

---
*This phase establishes the financial backbone of the platform with robust payment and reward systems.*
