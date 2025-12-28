# Reservation State Machine - Quick Reference Guide

## State Transition Matrix

### Summary Table

| Trigger | From | To | Requirement | Time Constraint | Refund |
|---------|------|----|----|---|---|
| User cancels | `requested` | `cancelled_by_user` | Reason | ≥2 hrs before | Per policy |
| User cancels | `confirmed` | `cancelled_by_user` | Reason | ≥2 hrs before | Per policy |
| Shop confirms | `requested` | `confirmed` | Payment OK | ≥24 hrs before | N/A |
| Shop cancels | `requested` | `cancelled_by_shop` | Reason | ≥1 hr before | 100% |
| Shop cancels | `confirmed` | `cancelled_by_shop` | Reason | ≥1 hr before | 100% |
| Service done | `confirmed` | `completed` | Service marked | Anytime | N/A |
| Auto-complete | `confirmed` | `completed` | Time threshold | 30 min after | N/A |
| No-show | `confirmed` | `no_show` | Time threshold | 30 min after | 0% |
| Admin override | `completed` | `no_show` | Approval | Anytime | 0% |
| Admin override | `no_show` | `completed` | Approval | Anytime | Varies |

## Refund Policy by Cancellation Window

### User Cancellation Refund Schedule

```
Time Before Reservation | Refund % | Cancellation Fee
48+ hours              | 100%     | 0%
24-48 hours            | 80%      | 20%
2-24 hours             | 50%      | 50%
< 2 hours              | 0%       | Non-refundable
```

### Shop Cancellation

- **Always:** 100% refund to user
- **No fees apply**
- **Reason required**
- **Full audit trail maintained**

## Deposit Calculation Quick Reference

### Deposit Percentage Rules

| Scenario | Formula | Example (100,000 KRW service) |
|----------|---------|--|
| Service has fixed deposit | Fixed amount × quantity | If deposit_amount=25,000: 25,000 |
| Service has % deposit | (price × percentage) × quantity | If 20%: 20,000 |
| Default calculation | (price × 25%) × quantity | 25,000 |
| After constraints | max(10K, min(100K, calculated)) | Final: 25,000 |

### Key Constants

- Minimum deposit: 10,000 KRW
- Maximum deposit: 100,000 KRW
- Default %: 25%
- Min %: 20%
- Max %: 30%

## Actor-Specific Capabilities

### User Can:
- ✓ Create reservations
- ✓ View own reservations
- ✓ Cancel (if 2+ hrs before)
- ✓ Make deposits
- ✓ Pay final balance

### User Cannot:
- ✗ Confirm reservations
- ✗ Mark service complete
- ✗ Cancel < 2 hours before
- ✗ Access other users' reservations

### Shop Owner Can:
- ✓ Confirm `requested` reservations
- ✓ Mark service complete
- ✓ Cancel reservations (≥1 hr before)
- ✓ View own shop's reservations
- ✓ View payments

### Shop Owner Cannot:
- ✗ Confirm within 24 hours of reservation
- ✗ Access other shops
- ✗ Override no-show status
- ✗ Create reservations for users

### Admin Can:
- ✓ Access any reservation
- ✓ Override states
- ✓ View audit trail
- ✓ Rollback to `requested`/`confirmed`
- ✓ Process manual refunds

## Payment Flow Checklist

### Deposit Payment
- [ ] Calculate deposit (20-30% of total)
- [ ] Check no existing deposit payment
- [ ] User provides name, email, phone
- [ ] Initiate PortOne payment
- [ ] Store payment ID and order ID
- [ ] Update reservation with amounts
- [ ] Wait for webhook confirmation

### Final Payment (After Service Complete)
- [ ] Verify reservation status = `completed`
- [ ] Verify deposit was paid
- [ ] Calculate remaining: total - deposit
- [ ] Check remaining > 0
- [ ] Check no existing final payment
- [ ] Initiate PortOne payment
- [ ] Wait for webhook confirmation

## Error Code Reference

### Most Common Errors

| Code | Status | Fix |
|------|--------|-----|
| `SLOT_CONFLICT` | 409 | Try different time slot |
| `LOCK_TIMEOUT` | 409 | Retry after 1-2 seconds |
| `INVALID_AMOUNT` | 400 | Ensure 20-30% for deposit |
| `SERVICE_NOT_COMPLETED` | 400 | Wait for shop to mark complete |
| `TIME_WINDOW_EXPIRED` | 400 | Cannot cancel < 2 hours before |

## Automatic Transitions (System-Triggered)

### No-Show Detection
- **Trigger:** 30+ minutes after reservation start time
- **Condition:** No service completion confirmation
- **Action:** Auto-transition to `no_show`
- **Refund:** 0% (user liable for full amount)
- **Notifications:** User, Shop, Admin

### Service Auto-Complete
- **Trigger:** 30 minutes after reservation start time
- **Condition:** Service was confirmed as started
- **Action:** Auto-transition to `completed`
- **Notifications:** User notified

## Time Constants Summary

| Event | Duration |
|-------|----------|
| Lock timeout | 10 seconds |
| Advisory lock timeout | 10 seconds |
| Deadlock retry delay | 2 seconds |
| Base retry delay | 1 second (exponential backoff) |
| Max retry delay | 5 seconds |
| Shop confirm deadline | 24 hours before |
| User cancel deadline | 2 hours before |
| Shop cancel deadline | 1 hour before |
| Auto-complete trigger | 30 minutes after start |
| No-show trigger | 30 minutes after start |

## Quick Debugging Guide

### Issue: User cannot cancel
**Check:**
1. Status is `requested` or `confirmed`?
2. Time ≥ 2 hours before reservation?
3. User ID matches reservation owner?
4. Reason provided?

### Issue: Payment won't process
**Check:**
1. Amount between 100 KRW and total?
2. For deposit: 20-30% of total?
3. No existing payment in progress?
4. User authenticated with valid token?
5. Reservation exists and belongs to user?

### Issue: State transition failed
**Check:**
1. Transition rule exists for from→to states?
2. Actor has permission?
3. Time requirements met?
4. Business rules satisfied?
5. Previous state is current state?

## Related Files for Deep Dive

```
Core Logic:
  src/services/reservation.service.ts (1290 lines)
  src/services/reservation-state-machine.service.ts (811 lines)
  src/services/two-stage-payment.service.ts (400+ lines)

Controllers:
  src/controllers/reservation.controller.ts
  src/controllers/payment.controller.ts
  src/controllers/shop-reservations.controller.ts
  src/controllers/shop-payments.controller.ts

Utilities:
  src/utils/korean-timezone.ts (timezone calculations)
  src/middleware/booking-validation.middleware.ts
  src/middleware/shop-access.middleware.ts

Database:
  Types: src/types/database.types.ts
  RPC functions: Database schema file
```

