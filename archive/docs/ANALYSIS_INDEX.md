# Backend Business Logic Analysis - Complete Index

This directory contains comprehensive documentation of the backend business logic for the 에뷰리띵 (eBeautything) platform.

## Documentation Files

### 1. **BUSINESS_LOGIC_ANALYSIS.md** (34 KB)
   Complete technical analysis covering:
   - Reservation business logic with detailed state transitions
   - Payment flow architecture (two-stage deposit/final)
   - Shop management and owner authentication
   - State machine documentation with all transitions
   - Validation rules and business rule enforcement
   - Error handling and messages
   - Caching strategy
   - Notification system
   - Security considerations
   - Configuration and constants
   - Database integration points

   **Best For:** Deep understanding, implementation details, compliance documentation

### 2. **STATE_MACHINE_QUICK_REFERENCE.md**
   Quick reference guide with:
   - State transition matrix (tabular format)
   - Refund policy schedule
   - Deposit calculation examples
   - Actor-specific capabilities
   - Payment flow checklists
   - Error code reference
   - Automatic transition rules
   - Time constants
   - Debugging guide

   **Best For:** Quick lookups, development, troubleshooting

## Key Findings Summary

### Reservation System

**Status Values:**
- `requested` - Initial state, awaiting confirmation
- `confirmed` - Shop confirmed, payment required
- `completed` - Service finished
- `cancelled_by_user` / `cancelled_by_shop` - Cancelled states
- `no_show` - User didn't appear

**Time-Based Rules:**
- User cancellation: ≥2 hours before
- Shop cancellation: ≥1 hour before
- Shop confirmation: ≥24 hours before
- Auto no-show detection: 30+ minutes after start
- Auto-complete: 30 minutes after start

**Refund Window (User Cancellation):**
- 48+ hours before: 100% refund
- 24-48 hours before: 80% refund (20% fee)
- 2-24 hours before: 50% refund (50% fee)
- <2 hours: 0% refund (non-refundable)

### Payment System

**Two-Stage Flow:**
1. **Deposit Payment** (20-30% of total)
   - Initiated during reservation creation
   - Required before shop confirmation
   - Amount calculated with service-specific policies

2. **Final Payment** (remaining balance)
   - Only after service marked complete
   - Amount = Total - Deposit
   - Processed separately from deposit

**Deposit Rules:**
- Default: 25% of service price
- Range: 20-30% per business rules
- Min amount: 10,000 KRW
- Max amount: 100,000 KRW
- Can be service-specific (fixed or percentage)

### Shop Management

**Shop Owner Functions:**
- Login with email/password (Supabase Auth)
- View shop reservations (filtered/paginated)
- View shop payments (with summary stats)
- Confirm reservations (if 24+ hours before)
- Cancel reservations (if 1+ hours before)
- Mark services complete

**Access Control:**
- Shop owners: limited to own shop
- Admins: full access to all shops
- Users: limited to own reservations

### Concurrent Booking Prevention

**Mechanism:**
- Database-level advisory locks
- Lock per time slot + shop combination
- 10-second timeout
- Retry logic: 3 attempts with exponential backoff
- Deadlock detection and recovery

**Conflict Detection:**
- Pre-lock validation of slot availability
- Automatic slot conflict handling
- Clear error messages with retry guidance

### Audit and Compliance

**State Change Logging:**
- All status transitions logged with timestamps
- Actor identification (user/shop/admin/system)
- Reason capture for all transitions
- Business context and metadata stored
- Full rollback history available

**Refund Audit Trail:**
- Refund calculation details logged
- Refund processing tracked
- Points transaction history maintained
- Korean timezone-aware timestamps

## File References Quick Map

### Core Services (src/services/)
| File | Lines | Purpose |
|------|-------|---------|
| `reservation.service.ts` | 1290 | Reservation CRUD + pricing |
| `reservation-state-machine.service.ts` | 811 | State transitions |
| `two-stage-payment.service.ts` | 400+ | Payment flows |
| `shop-owner-auth.service.ts` | 300+ | Shop owner login |

### Controllers (src/controllers/)
| File | Purpose |
|------|---------|
| `reservation.controller.ts` | Slots + create reservation |
| `payment.controller.ts` | Payment initialization |
| `shop-reservations.controller.ts` | Shop view reservations |
| `shop-payments.controller.ts` | Shop view payments |

### Type Definitions (src/types/)
| File | Contains |
|------|----------|
| `database.types.ts` | All enums + interfaces |

### Utilities & Middleware (src/)
| Location | Purpose |
|----------|---------|
| `utils/korean-timezone.ts` | KST time calculations |
| `middleware/booking-validation.middleware.ts` | Input validation |
| `middleware/shop-access.middleware.ts` | Access control |

## Common Scenarios

### Scenario 1: User Books → Pays Deposit → Service Completes → Final Payment

1. User calls `POST /api/reservations`
   - Validation of inputs
   - Concurrent booking lock acquired
   - Reservation created with status `requested`
   - Deposit amount calculated (20-30% of total)

2. System sends notification to shop owner
   - Shop owner receives reservation details

3. User calls `POST /api/payments/portone/prepare`
   - Deposit payment initialized via PortOne
   - Status: `requested` → awaiting payment

4. User completes deposit payment
   - Webhook received and validated
   - Payment status updated
   - Shop can now confirm

5. Shop confirms reservation
   - Status: `requested` → `confirmed`
   - Shop receives confirmation notification

6. Service occurs at scheduled time

7. Shop marks service complete
   - Status: `confirmed` → `completed`
   - User notified to make final payment

8. User calls `POST /api/payments/portone/final`
   - Final payment initialized
   - Amount = Total - Deposit

9. User completes final payment
   - Payment status: `fully_paid`
   - Service completion finalized
   - Points awarded to user

### Scenario 2: User Cancels 5 Hours Before

1. User calls `DELETE /api/reservations/{id}`
   - Status: `confirmed` (valid for cancellation)
   - Time: 5 hours before (valid, ≥2 hours)
   
2. System calculates refund
   - Window: 2-24 hours before
   - Refund: 50% of deposit
   - Fee: 50% of deposit

3. System processes refund
   - Automatic refund initiated
   - Points refunded
   - Audit trail created

4. Notifications sent
   - User: Cancellation confirmation
   - Shop: Cancellation notification
   
5. Reservation status: `cancelled_by_user`

### Scenario 3: No-Show Detection

1. Reservation scheduled for 14:00

2. At 14:30, system runs automatic transition check
   - No service completion recorded
   - Status still `confirmed`
   
3. System auto-transitions
   - Status: `confirmed` → `no_show`
   - Refund: 0% (user liable)
   - Notifications sent to all parties

4. User account flagged for no-show
   - May impact future booking privileges
   - Account history maintained

## Testing Checklist

### Unit Tests to Implement
- [ ] Deposit calculation (all scenarios)
- [ ] Refund eligibility (all time windows)
- [ ] State transition validation
- [ ] Input validation (all fields)
- [ ] Concurrent booking lock logic
- [ ] Korean timezone calculations

### Integration Tests to Implement
- [ ] End-to-end reservation flow
- [ ] Payment webhook handling
- [ ] State machine with notifications
- [ ] Refund processing
- [ ] Concurrent booking prevention
- [ ] Admin overrides

### E2E Tests to Implement
- [ ] User: Search → Book → Pay → Complete → Review
- [ ] Shop owner: Login → View → Confirm → Complete
- [ ] Admin: Override → Rollback
- [ ] Refund scenarios with different times

## Performance Considerations

### Caching Strategy
- **Services:** 30-minute TTL
- **Reservations:** 5-10 minute TTL
- **Cache invalidation:** On state changes

### Database Optimization
- **Locks:** 10-second timeout to prevent long holds
- **Pagination:** Max 100 per page
- **Indexes:** On shop_id, user_id, reservation_date, status

### Retry Strategy
- **Max retries:** 3
- **Initial delay:** 1 second
- **Max delay:** 5 seconds
- **Backoff:** Exponential with jitter

## Security Checklist

- [x] Input validation on all endpoints
- [x] Authentication required (JWT)
- [x] Authorization checks (actor-specific)
- [x] SQL injection prevention (parameterized queries)
- [x] Rate limiting enabled
- [x] Sensitive data masked in logs
- [x] Audit trail maintained
- [x] Webhook signature validation
- [x] CORS configured
- [x] XSS/CSRF protection enabled

## Migration & Deployment Notes

### Database Setup
- Ensure RPC functions exist:
  - `create_reservation_with_lock`
  - `transition_reservation_status_enhanced`
  - `comprehensive_reservation_cleanup`
  - `get_reservation_audit_trail`
  - `bulk_transition_reservations`

### Configuration Required
- PortOne API credentials
- Supabase URL and keys
- JWT signing secret
- Korean timezone utilities
- Notification service endpoint

### Environment Variables
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `PORTONE_CLIENT_ID`
- `PORTONE_SECRET`
- `JWT_SECRET`
- `NOTIFICATION_SERVICE_URL`

## Troubleshooting Guide

See **STATE_MACHINE_QUICK_REFERENCE.md** for detailed debugging guide including:
- Cancellation issues
- Payment processing failures
- State transition errors
- Lock timeout handling

## Contact & Questions

For questions about specific aspects:

1. **Reservation logic:** See `reservation.service.ts` lines 97-1280
2. **State machine:** See `reservation-state-machine.service.ts` lines 56-430
3. **Payment flow:** See `two-stage-payment.service.ts` lines 77-200
4. **Shop access:** See `shop-owner-auth.service.ts` lines 82-200

## Version History

- **v1.0** (2024-11): Complete analysis of reservation, payment, and shop logic

---

**Last Updated:** 2024-11-12  
**Analysis Scope:** Full backend business logic  
**Coverage:** Reservation, Payment, Shop Management  
**Documentation Status:** Complete and verified against source code
