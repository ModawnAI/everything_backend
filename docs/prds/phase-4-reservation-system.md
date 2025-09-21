# PRD: Phase 4 - Reservation & Booking System

## 📋 Overview
**Phase**: 4 of 6  
**Duration**: 2-3 weeks  
**Priority**: Critical  
**Dependencies**: Phase 1 (Foundation), Phase 2 (Users), Phase 3 (Shops)  

This phase implements the core reservation system with the updated v3.1 flow emphasizing 'request' status and shop confirmation requirements.

## 🎯 Objectives

### Primary Goals
1. Build time slot availability system with conflict prevention
2. Implement reservation request flow (not auto-confirmation)
3. Create shop owner reservation management interface
4. Build reservation completion system for service tracking
5. Implement cancellation and refund system (v3.2 policies)

### Success Criteria
- [ ] Users can check available time slots in real-time
- [ ] Reservation requests are properly queued for shop confirmation
- [ ] Shop owners can confirm/reject reservations efficiently
- [ ] Service completion triggers point awarding correctly
- [ ] Cancellation policies are enforced automatically

## 🔗 API Endpoints to Implement

### 1. Availability & Booking APIs
```
GET /api/shops/:shopId/available-slots
POST /api/reservations
GET /api/reservations/:reservationId
PUT /api/reservations/:reservationId
DELETE /api/reservations/:reservationId
```

### 2. Shop Owner Reservation Management
```
GET /api/shop/reservations/pending
PUT /api/shop/reservations/:reservationId/confirm
PUT /api/shop/reservations/:reservationId/complete
GET /api/shop/reservations
PUT /api/shop/reservations/:reservationId/reschedule
```

### 3. Cancellation & Refund APIs (v3.2)
```
POST /api/reservations/:reservationId/cancel
GET /api/reservations/:reservationId/refund-eligibility
POST /api/reservations/:reservationId/reschedule
```

### 4. Admin Reservation Management
```
GET /api/admin/reservations
PUT /api/admin/reservations/:reservationId/status
GET /api/admin/reservations/analytics
POST /api/admin/reservations/:reservationId/force-complete
```

## 📅 Reservation State Machine (v3.1 Updated)

### Critical State Flow
```
1. User submits → 'requested' (NOT confirmed)
2. Payment completed → STILL 'requested' (waiting for shop)
3. Shop confirms → 'confirmed' 
4. Service happens → Shop marks 'completed'
5. Points awarded → Process complete
```

### State Transitions
```
requested → confirmed (shop owner action)
requested → cancelled_by_shop (shop rejection)
confirmed → completed (shop owner marks service done)
confirmed → cancelled_by_user (user cancels)
confirmed → no_show (automatic after grace period)
any → cancelled_by_admin (admin intervention)
```

## 💰 Payment Integration

### Two-Stage Payment Process
1. **Deposit Payment**: User pays upfront (20-30% of total)
2. **Final Payment**: Remaining amount paid after service
3. **Point Calculation**: Based on final total amount

### Payment Status Flow
```
pending → deposit_paid (initial payment)
deposit_paid → fully_paid (after service completion)
deposit_paid/fully_paid → refunded (cancellation)
```

## 🕐 Time Slot Management

### Availability Algorithm
```typescript
// Core logic for time slot generation
generateTimeSlots(date, shopId, serviceIds) {
  // 1. Get shop operating hours for the date
  // 2. Generate 30-minute intervals
  // 3. Check existing reservations (requested + confirmed)
  // 4. Consider service duration for conflicts
  // 5. Return available slots
}
```

### Conflict Prevention
- **Database-level locks**: Prevent concurrent booking of same slot
- **Service duration buffer**: Account for service overlap
- **Grace period**: 15-minute buffer between services
- **Real-time validation**: Double-check availability before confirmation

## 🔐 Business Logic Requirements

### Reservation Creation Logic
1. **Validation**: Time slot availability, service compatibility
2. **Pricing**: Calculate total amount, deposit, remaining balance
3. **Point Usage**: Validate and apply point discounts
4. **State**: Create in 'requested' status (v3.1 requirement)
5. **Notifications**: Alert shop owner of new request

### Shop Confirmation Logic (Critical v3.1 Feature)
1. **Authorization**: Only shop owner can confirm their reservations
2. **Status Check**: Only 'requested' reservations can be confirmed
3. **Timing**: Shop should confirm within reasonable time
4. **Notifications**: Alert customer of confirmation/rejection
5. **Calendar**: Update shop's availability calendar

### Service Completion Logic
1. **Authorization**: Only shop owner can mark as completed
2. **Final Amount**: Allow adjustment of total service cost
3. **Point Triggering**: Automatic point calculation and awarding
4. **Payment Completion**: Mark remaining payments as fully_paid
5. **Referral Processing**: Trigger referral point awards

## 🚫 Cancellation & Refund System (v3.2)

### Refund Policy Implementation
```typescript
// 24-hour rule with timezone handling
function calculateRefundEligibility(reservationDateTime: Date) {
  const now = new Date();
  const koreaTime = now.toLocaleString("en-US", {timeZone: "Asia/Seoul"});
  const hoursUntilReservation = (reservationDateTime - koreaTime) / (1000 * 60 * 60);
  
  return {
    isRefundable: hoursUntilReservation >= 24,
    refundPercentage: hoursUntilReservation >= 24 ? 100 : 0,
    deadline: new Date(reservationDateTime - 24 * 60 * 60 * 1000)
  };
}
```

### Cancellation Types
- **User Request**: Subject to 24-hour rule
- **Shop Request**: Always 100% refund
- **No Show**: No refund, automatic after 30-minute grace period
- **Admin Force**: Emergency cancellation with custom refund

## 📱 Frontend Integration Points

### React/Next.js Components Expected
- **TimeSlotPicker**: Calendar + time selection interface
- **ReservationForm**: Multi-step booking process
- **ReservationCard**: Status display with actions
- **ShopCalendar**: Shop owner's reservation management
- **CancellationDialog**: Refund policy explanation

### Real-time Updates
- **WebSocket Events**: Reservation status changes
- **Push Notifications**: Confirmation, completion, cancellation
- **Calendar Sync**: Availability updates
- **Status Badges**: Real-time reservation status

## 💾 Database Operations Focus

### Critical Tables
- `reservations` - Core booking data
- `reservation_services` - Service selection details
- `payments` - Payment tracking
- `point_transactions` - Point usage and awarding
- `notifications` - Status change alerts

### Performance-Critical Queries
```sql
-- Most frequent: Check available time slots
SELECT available_slots FROM get_available_slots($shop_id, $date, $service_ids);

-- High frequency: User's reservations
SELECT * FROM reservations WHERE user_id = $user_id ORDER BY reservation_date DESC;

-- Shop owner: Pending confirmations
SELECT * FROM reservations WHERE shop_id = $shop_id AND status = 'requested';
```

## 🧪 Testing Strategy

### Unit Tests
- [ ] Time slot generation algorithms
- [ ] Conflict detection logic
- [ ] Refund eligibility calculations
- [ ] Point awarding calculations
- [ ] State transition validations

### Integration Tests
- [ ] Complete reservation flow (request → confirm → complete)
- [ ] Concurrent booking prevention
- [ ] Payment integration with reservations
- [ ] Point system integration
- [ ] Cancellation and refund processing

### Load Tests
- [ ] High-volume time slot queries
- [ ] Concurrent reservation attempts
- [ ] Shop owner dashboard performance
- [ ] Real-time notification delivery

## 🔔 Notification System

### Reservation Notifications
- **Request Submitted**: "예약 요청이 완료되었습니다. 사장님 확인을 기다려주세요."
- **Confirmed**: "예약이 확정되었습니다. 정시에 방문해주세요."
- **Rejected**: "예약이 취소되었습니다. 예약금은 3-5일 내 환불됩니다."
- **Completed**: "서비스가 완료되었습니다. 포인트가 적립되었습니다."

### Shop Owner Notifications
- **New Request**: "새로운 예약 요청이 있습니다."
- **Cancellation**: "고객이 예약을 취소했습니다."
- **Payment Received**: "예약금 결제가 완료되었습니다."

## 📊 Analytics & Monitoring

### Business Metrics
- Reservation request rate
- Confirmation rate by shops
- Completion rate
- Cancellation rate and reasons
- Average time from request to confirmation

### Performance Metrics
- Time slot query response time
- Reservation creation success rate
- Payment processing time
- Notification delivery rate

## 🚨 Edge Cases & Error Handling

### Booking Conflicts
- **Simultaneous Requests**: Database-level locking
- **Service Overlap**: Duration-based conflict detection
- **Overbooking**: Prevention with real-time validation
- **System Failures**: Graceful degradation and recovery

### Payment Edge Cases
- **Partial Payments**: Handle incomplete transactions
- **Refund Failures**: Retry mechanisms and manual intervention
- **Currency Issues**: Proper KRW handling
- **Fraud Detection**: Unusual booking patterns

## 📋 Acceptance Criteria

### For Users
- [ ] Can see real-time availability for any shop/date
- [ ] Booking process is intuitive and error-free
- [ ] Reservation status is always clear and up-to-date
- [ ] Cancellation process respects refund policies
- [ ] Point usage and earning is transparent

### For Shop Owners
- [ ] Can see all pending requests in real-time
- [ ] Confirmation/rejection process is simple and fast
- [ ] Can manage their calendar and availability
- [ ] Service completion process triggers points correctly
- [ ] Revenue tracking is accurate and timely

### For Admins
- [ ] Can monitor reservation system health
- [ ] Can intervene in disputes or issues
- [ ] Analytics provide actionable insights
- [ ] System performance meets SLA requirements

## 🔄 Integration Dependencies

### Requires from Previous Phases
- User authentication and profile data
- Shop information and service catalogs
- Admin management capabilities
- Notification infrastructure

### Provides for Next Phases
- Reservation data for payment processing
- Service completion events for point system
- Usage patterns for analytics
- Customer-shop relationship data

## 📋 Definition of Done

### Phase 4 is complete when:
1. ✅ Time slot availability system is accurate and fast
2. ✅ Reservation request flow works end-to-end
3. ✅ Shop confirmation system is operational
4. ✅ Service completion and point awarding works correctly
5. ✅ Cancellation and refund policies are enforced
6. ✅ Real-time notifications are delivered reliably
7. ✅ Admin management tools are functional
8. ✅ System handles concurrent bookings safely
9. ✅ Test coverage >90% for all booking logic

## 🔄 Next Phase
**Phase 5**: Payment Processing & Point System
- Toss Payments integration
- Point earning and usage system
- Referral rewards processing
- Financial reporting and analytics

---
*This phase creates the core booking experience that defines the platform's value proposition.*
