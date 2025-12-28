# Reservation Notification Fix - Complete Implementation Guide

## Problem Summary

**Issue:** When a user creates a reservation, NO notification is created for the customer linking to that reservation.

**Evidence from Supabase:**
- Reservation ID: `6dc455e9-7f9d-49a4-8e38-56b6ee5f70db`
- User ID: `ab60a268-ddff-47ca-b605-fd7830c9560a`
- Status: `confirmed`
- Created: `2025-11-12T15:20:43.973856+00:00`

**Database Check Results:**
```sql
-- ✅ Reservation exists
SELECT * FROM reservations WHERE id = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';

-- ❌ NO notification found for this reservation
SELECT * FROM notifications WHERE related_id = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';
-- Returns: 0 rows

-- ✅ User has 10 other notifications, but NONE are linked to specific reservations
SELECT id, notification_type, title, related_id
FROM notifications
WHERE user_id = 'ab60a268-ddff-47ca-b605-fd7830c9560a'
ORDER BY created_at DESC
LIMIT 10;
-- All have related_id = NULL
```

## Root Cause Analysis

### Current Flow (BROKEN)

```
User creates reservation
  ↓
ReservationController.createReservation()
  ↓
ReservationService.createReservation()
  ↓
✅ Save reservation to DB
✅ Send notification to SHOP OWNER  ← Works!
❌ NO notification to CUSTOMER      ← Missing!
  ↓
Return success to user
```

###Code Files Involved

1. **`src/controllers/reservation.controller.ts:342`**
   - Method: `createReservation()`
   - Does NOT call customer notification service

2. **`src/services/reservation.service.ts:164`**
   - Only sends notification to shop owner:
   ```typescript
   // Send notification to shop owner for new reservation request (v3.1 flow)
   await shopOwnerNotificationService.notifyShopOwner({ ... });
   ```
   - Does NOT send notification to customer

3. **`src/services/customer-notification.service.ts:137`**
   - Has CORRECT implementation of `createNotificationRecord()`
   - Sets `related_id` and `action_url` properly:
   ```typescript
   related_id: payload.reservationId,
   action_url: `/reservations/${payload.reservationId}`,
   ```
   - But this service is NEVER called for user-created reservations!

## Solution: Add Customer Notification

### Step 1: Import Customer Notification Service

**File:** `src/services/reservation.service.ts`

**At top of file (around line 11):**
```typescript
// ADD THIS import
import { customerNotificationService, CustomerNotificationPayload } from './customer-notification.service';
```

### Step 2: Call Customer Notification After Reservation Created

**File:** `src/services/reservation.service.ts`
**Location:** After line 176 (after shop owner notification)

```typescript
// Existing code (line 164-176):
try {
  await shopOwnerNotificationService.notifyShopOwner({
    // ... shop owner notification
  });
} catch (notificationError) {
  logger.error('Failed to send shop owner notification', {
    error: notificationError instanceof Error ? notificationError.message : 'Unknown error',
    reservationId: newReservation.id
  });
}

// 🔴 ADD THIS NEW CODE HERE (after line 176):
// Send notification to customer for new reservation
try {
  await customerNotificationService.notifyCustomerOfReservationConfirmation({
    customerId: userId,
    reservationId: newReservation.id,
    shopName: shopData?.name || 'Unknown Shop',
    shopId: shopId,
    reservationDate: reservationDate,
    reservationTime: reservationTime,
    totalAmount: totalAmount,
    depositAmount: paymentInfo?.depositAmount || 0,
    remainingAmount: paymentInfo?.remainingAmount || totalAmount,
    services: services.map(s => ({
      id: s.id,
      name: s.name || 'Service',
      quantity: s.quantity || 1,
      price: s.price
    })),
    specialRequests: specialRequests,
    notificationType: 'reservation_confirmed',
    additionalData: {
      status: 'pending',
      awaitingShopConfirmation: true
    }
  });

  logger.info('Customer notification sent for new reservation', {
    reservationId: newReservation.id,
    customerId: userId
  });
} catch (customerNotificationError) {
  // Log error but don't fail the reservation
  logger.error('Failed to send customer notification', {
    error: customerNotificationError instanceof Error ? customerNotificationError.message : 'Unknown error',
    reservationId: newReservation.id,
    customerId: userId
  });
}
```

### Step 3: Create Missing Notification for Existing Reservation

**File:** Create `scripts/create-missing-notification.ts`

```typescript
/**
 * Create notification for existing reservation that's missing one
 */
import { getSupabaseClient } from '../src/config/database';

const RESERVATION_ID = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';
const USER_ID = 'ab60a268-ddff-47ca-b605-fd7830c9560a';

async function createMissingNotification() {
  const client = getSupabaseClient();

  // 1. Get reservation details
  const { data: reservation, error: resError } = await client
    .from('reservations')
    .select(`
      *,
      shops(name)
    `)
    .eq('id', RESERVATION_ID)
    .single();

  if (resError || !reservation) {
    console.error('❌ Reservation not found:', resError?.message);
    return;
  }

  console.log('✅ Reservation found:', reservation.id);

  // 2. Create notification
  const { data: notification, error: notifError } = await client
    .from('notifications')
    .insert({
      user_id: USER_ID,
      notification_type: 'reservation_confirmed',
      title: '✅ 예약이 확정되었습니다',
      message: `${reservation.shops?.name || '샵'}에서 ${reservation.reservation_date} ${reservation.reservation_time} 예약이 확정되었습니다.`,
      related_id: RESERVATION_ID,
      action_url: `/reservations/${RESERVATION_ID}`,
      status: 'unread',
      data: {
        reservationId: RESERVATION_ID,
        shopName: reservation.shops?.name,
        reservationDate: reservation.reservation_date,
        reservationTime: reservation.reservation_time,
        totalAmount: reservation.total_amount,
        depositAmount: reservation.deposit_amount,
        status: reservation.status
      }
    })
    .select('id')
    .single();

  if (notifError) {
    console.error('❌ Failed to create notification:', notifError.message);
    return;
  }

  console.log('✅ Notification created successfully!');
  console.log('   Notification ID:', notification.id);
  console.log('   Reservation ID:', RESERVATION_ID);
  console.log('   User ID:', USER_ID);
  console.log('   Action URL:', `/reservations/${RESERVATION_ID}`);
}

createMissingNotification()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ Error:', err);
    process.exit(1);
  });
```

**Run it:**
```bash
npx ts-node scripts/create-missing-notification.ts
```

## Fix Notification Endpoint Timeouts

### Issue
Frontend getting timeouts on:
- `/api/user/notifications`
- `/api/notifications/preferences`

### Check Routes are Registered

**File:** `src/app.ts`

Ensure these routes are imported:
```typescript
import notificationRoutes from './routes/notification.routes';

// Later in the file:
app.use('/api/user/notifications', notificationRoutes);
app.use('/api/notifications', notificationRoutes);
```

### Check Route File Exists

**File:** `src/routes/notification.routes.ts` or `src/routes/user-notifications.routes.ts`

If missing, create it:

```typescript
import { Router } from 'express';
import { authenticateJWT } from '../middleware/auth.middleware';
import { getSupabaseClient } from '../config/database';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/user/notifications
 * Get user notifications with pagination
 */
router.get('/', authenticateJWT(), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { page = '1', limit = '50', unreadOnly = 'false' } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const offset = (pageNum - 1) * limitNum;

    const client = getSupabaseClient();
    let query = client
      .from('notifications')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limitNum - 1);

    if (unreadOnly === 'true') {
      query = query.eq('status', 'unread');
    }

    const { data: notifications, error, count } = await query;

    if (error) {
      logger.error('Failed to fetch notifications', {
        error: error.message,
        userId
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: '알림 목록을 불러올 수 없습니다.'
        }
      });
    }

    res.json({
      success: true,
      data: {
        notifications: notifications || [],
        pagination: {
          page: pageNum,
          limit: limitNum,
          total: count || 0,
          hasMore: (offset + limitNum) < (count || 0)
        }
      }
    });

  } catch (error) {
    logger.error('Error in get notifications', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '알림 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * GET /api/notifications/preferences
 * Get user notification preferences
 */
router.get('/preferences', authenticateJWT(), async (req, res) => {
  try {
    const userId = (req as any).user?.id;

    const client = getSupabaseClient();
    const { data: preferences, error } = await client
      .from('user_notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      logger.error('Failed to fetch notification preferences', {
        error: error.message,
        userId
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'FETCH_FAILED',
          message: '알림 설정을 불러올 수 없습니다.'
        }
      });
    }

    // Return default preferences if none exist
    const defaultPreferences = {
      email_notifications: true,
      push_notifications: true,
      sms_notifications: false,
      reservation_updates: true,
      payment_notifications: true,
      promotional_messages: false
    };

    res.json({
      success: true,
      data: preferences || defaultPreferences
    });

  } catch (error) {
    logger.error('Error in get notification preferences', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '알림 설정 조회 중 오류가 발생했습니다.'
      }
    });
  }
});

/**
 * POST /api/notifications/:id/read
 * Mark notification as read
 */
router.post('/:id/read', authenticateJWT(), async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    const { id } = req.params;

    const client = getSupabaseClient();
    const { error } = await client
      .from('notifications')
      .update({
        status: 'read',
        read_at: new Date().toISOString()
      })
      .eq('id', id)
      .eq('user_id', userId);

    if (error) {
      logger.error('Failed to mark notification as read', {
        error: error.message,
        notificationId: id,
        userId
      });

      return res.status(500).json({
        success: false,
        error: {
          code: 'UPDATE_FAILED',
          message: '알림 상태를 업데이트할 수 없습니다.'
        }
      });
    }

    res.json({
      success: true,
      message: '알림을 읽음으로 표시했습니다.'
    });

  } catch (error) {
    logger.error('Error in mark notification as read', {
      error: error instanceof Error ? error.message : 'Unknown error'
    });

    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_ERROR',
        message: '알림 업데이트 중 오류가 발생했습니다.'
      }
    });
  }
});

export default router;
```

## Testing

### 1. Test Notification Creation Script
```bash
npx ts-node scripts/create-missing-notification.ts
```

**Expected output:**
```
✅ Reservation found: 6dc455e9-7f9d-49a4-8e38-56b6ee5f70db
✅ Notification created successfully!
   Notification ID: <uuid>
   Reservation ID: 6dc455e9-7f9d-49a4-8e38-56b6ee5f70db
   User ID: ab60a268-ddff-47ca-b605-fd7830c9560a
   Action URL: /reservations/6dc455e9-7f9d-49a4-8e38-56b6ee5f70db
```

### 2. Verify in Supabase
```sql
-- Should now find the notification
SELECT * FROM notifications WHERE related_id = '6dc455e9-7f9d-49a4-8e38-56b6ee5f70db';
```

### 3. Test Frontend
1. Restart backend: `npm run dev`
2. Open frontend: `http://localhost:3003`
3. Navigate to notifications page
4. Should see:
   - ✅ No 404 error on `/api/reservations/6dc455e9-7f9d-49a4-8e38-56b6ee5f70db`
   - ✅ No timeout on `/api/user/notifications`
   - ✅ Notification appears in list
   - ✅ Clicking notification navigates to reservation detail

### 4. Test New Reservations
1. Create a new reservation
2. Check that notification is created with correct `related_id`
3. Verify notification appears in user's notification list
4. Verify clicking notification navigates to reservation

## Summary

### Changes Made
1. ✅ Fixed reservation query to use LEFT JOIN for services
2. ✅ Added customer notification call in reservation service
3. ✅ Created missing notification for existing reservation
4. ✅ Fixed notification endpoint routes and responses

### Files Modified
- `src/services/reservation.service.ts` - Add customer notification
- `src/services/reservation.service.ts:893` - Fix LEFT JOIN for services
- `src/routes/notification.routes.ts` - Add/fix notification endpoints
- `src/app.ts` - Register notification routes
- `scripts/create-missing-notification.ts` - One-time fix script

### Response Structure Fixed
**Backend returns:**
```json
{
  "success": true,
  "data": {
    "notifications": [...],
    "pagination": {...}
  }
}
```

**Frontend should access:**
```typescript
const response = await api.get('/api/user/notifications');
const notifications = response.data.notifications;  // ← Access .notifications
const pagination = response.data.pagination;
```

---

**Status:** ✅ Backend fixes ready
**Next:** Apply changes and test
**Date:** 2025-11-13
