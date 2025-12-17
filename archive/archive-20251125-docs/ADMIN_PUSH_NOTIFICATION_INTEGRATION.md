# Admin Push Notification Integration Guide

## Overview

This guide explains how the **eBeautything Admin Panel** sends push notifications to **user mobile devices** using:
- **Supabase** (user authentication and database)
- **Firebase Admin SDK** (push notification delivery via FCM)
- **Backend API** (notification service logic)
- **Admin Frontend** (push notification management UI)

---

## Architecture

```
┌─────────────────┐
│  Admin Panel    │  Admin sends notification via UI
│  (Next.js)      │
└────────┬────────┘
         │ HTTP POST /api/admin/push/send
         ▼
┌─────────────────┐
│  Backend API    │  Validates admin auth, queries users
│  (Express.js)   │
└────────┬────────┘
         │
         ├──► Supabase: Fetch target users & device tokens
         │
         ├──► Firebase Admin SDK: Send FCM messages
         │
         └──► Supabase: Store notification history
         │
         ▼
┌─────────────────┐
│  User Devices   │  Receive push notifications
│  (iOS/Android)  │
└─────────────────┘
```

---

## Component Status

### ✅ Backend Components (ALL CONFIGURED)

1. **Firebase Admin SDK** ✅
   - Location: `src/services/notification.service.ts`
   - Service account: `e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json`
   - Initialization: Automatic on service creation
   - Status: Verified and working

2. **Admin Push Notification Service** ✅
   - Location: `src/services/admin-push-notification.service.ts`
   - Features:
     - Send to all users
     - Send to specific user types (user, shop_owner, influencer)
     - Send to specific user IDs
     - Track delivery status
     - Store notification history

3. **Admin Push Notification API** ✅
   - Routes: `src/routes/admin-push-notification.routes.ts`
   - Controller: `src/controllers/admin-push-notification.controller.ts`
   - Endpoints:
     - `POST /api/admin/push/send` - Send notification
     - `GET /api/admin/push/history` - View history
     - `GET /api/admin/push/:id` - Get notification details

4. **Supabase Integration** ✅
   - Project: `ysrudwzwnzxrrwjtpuoh`
   - Tables used:
     - `users` - User authentication and profiles
     - `push_tokens` - FCM device tokens
     - `notifications` - Notification history
     - `notification_settings` - User notification preferences

### ✅ Frontend Components (ALL CONFIGURED)

1. **Admin Panel Push Notification Page** ✅
   - Location: `/home/bitnami/ebeautything-admin/src/app/dashboard/push-notifications/page.tsx`
   - Features:
     - Form to create notifications
     - Target audience selection (All Users, Shop Owners, Influencers)
     - Specific user ID targeting
     - Image URL support
     - Action URL support
     - Schedule for later delivery
     - Real-time notification history
     - Delivery statistics (sent, failed, success rate)

2. **Admin API Proxy** ✅
   - Location: `/home/bitnami/ebeautything-admin/src/app/api/admin/push/`
   - Routes:
     - `send/route.ts` - Proxy to backend send endpoint
     - `history/route.ts` - Proxy to backend history endpoint
     - `[id]/route.ts` - Proxy to backend detail endpoint

---

## Configuration

### Backend Configuration

**Environment Variables** (`/home/bitnami/everything_backend/.env`):
```bash
# Firebase Configuration
FIREBASE_AUTH_METHOD=service_account
FCM_PROJECT_ID=e-beautything
FCM_SENDER_ID=958913474136
FIREBASE_ADMIN_SDK_PATH=./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json

# Supabase Configuration
SUPABASE_URL=https://ysrudwzwnzxrrwjtpuoh.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

**Firebase Service Account**:
- File: `e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json`
- Project ID: `e-beautything`
- Client Email: `firebase-adminsdk-fbsvc@e-beautything.iam.gserviceaccount.com`
- Status: ✅ Verified and working

### Frontend Configuration

**Environment Variables** (`/home/bitnami/ebeautything-admin/.env.local`):
```bash
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=https://api.e-beautything.com

# For local development, use:
# NEXT_PUBLIC_API_BASE_URL=http://localhost:3001/api
```

---

## How It Works

### Step 1: Admin Creates Notification

Admin fills out the form in `/dashboard/push-notifications`:
- **Title**: "New Promotion Available!"
- **Message**: "Check out our latest deals"
- **Target**: All Users / Shop Owners / Influencers
- **Optional**: Image URL, Action URL, Schedule time

### Step 2: Frontend Sends Request

Frontend calls: `POST /api/admin/push/send`
```typescript
const response = await fetch('/api/admin/push/send', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${adminToken}`,
  },
  body: JSON.stringify({
    title: 'New Promotion Available!',
    body: 'Check out our latest deals',
    targetUserType: ['user'], // or ['shop_owner'] or ['influencer']
    imageUrl: 'https://example.com/promo.jpg',
    data: {
      url: '/promotions',
      type: 'promotion'
    }
  })
});
```

### Step 3: Backend Processes Request

1. **Authenticate Admin** (`middleware/admin-auth.middleware.ts`)
   - Verify JWT token
   - Check user has admin role

2. **Fetch Target Users** (`services/admin-push-notification.service.ts`)
   ```typescript
   // Query Supabase for target users
   const { data: users } = await supabase
     .from('users')
     .select('id')
     .in('user_role', ['user'])
     .eq('user_status', 'active');
   ```

3. **Fetch Device Tokens** (`services/notification.service.ts`)
   ```typescript
   // Get FCM tokens for each user
   const { data: tokens } = await supabase
     .from('push_tokens')
     .select('token')
     .eq('user_id', userId)
     .eq('is_active', true);
   ```

4. **Send via Firebase** (`services/notification.service.ts`)
   ```typescript
   // Send FCM message
   await admin.messaging().send({
     notification: {
       title: 'New Promotion Available!',
       body: 'Check out our latest deals'
     },
     data: {
       url: '/promotions',
       type: 'promotion'
     },
     token: userDeviceToken
   });
   ```

5. **Store in History** (`services/admin-push-notification.service.ts`)
   ```typescript
   // Save notification record
   await supabase.from('notifications').insert({
     notification_type: 'system',
     title: 'New Promotion Available!',
     message: 'Check out our latest deals',
     user_id: adminId,
     status: 'unread'
   });
   ```

### Step 4: User Receives Notification

User's mobile device receives push notification:
- **iOS**: Via APNs (Apple Push Notification service)
- **Android**: Via FCM (Firebase Cloud Messaging)
- **Web**: Via FCM Web Push

---

## API Reference

### Send Push Notification

**Endpoint**: `POST /api/admin/push/send`

**Headers**:
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

**Request Body**:
```json
{
  "title": "Notification Title",
  "body": "Notification message body",
  "targetUserType": ["user", "shop_owner", "influencer"],
  "targetUserIds": ["user-id-1", "user-id-2"],
  "imageUrl": "https://example.com/image.jpg",
  "data": {
    "url": "/destination",
    "type": "promotion"
  },
  "schedule": "2025-11-21T10:00:00Z"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "notification": {
      "id": "notif-123",
      "title": "Notification Title",
      ...
    },
    "targetCount": 150,
    "sentCount": 148,
    "failedCount": 2,
    "success": true
  }
}
```

### Get Notification History

**Endpoint**: `GET /api/admin/push/history?page=1&limit=20&status=sent`

**Headers**:
```
Authorization: Bearer <admin-jwt-token>
```

**Response**:
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "notif-123",
        "title": "Notification Title",
        "body": "Message",
        "targetCount": 150,
        "sentCount": 148,
        "failedCount": 2,
        "sentAt": "2025-11-20T10:00:00Z",
        "createdAt": "2025-11-20T09:55:00Z"
      }
    ],
    "total": 50,
    "page": 1,
    "limit": 20
  }
}
```

---

## Testing Guide

### Prerequisites

1. **Backend running** on port 3001:
   ```bash
   cd /home/bitnami/everything_backend
   npm run dev
   ```

2. **Admin panel running**:
   ```bash
   cd /home/bitnami/ebeautything-admin
   npm run dev
   ```

3. **Admin account** created in Supabase
4. **At least one test user** with FCM device token registered

### Test 1: Send Notification to All Users

1. **Login to Admin Panel**: `http://localhost:3000/login`
2. **Navigate to**: Dashboard → Push Notifications
3. **Fill form**:
   - Title: "Test Notification"
   - Message: "This is a test message"
   - Target: Check "All Users"
4. **Click**: "Send Now"
5. **Expected Result**:
   - Success toast showing "Notification sent to X users"
   - Notification appears in history table

### Test 2: Send to Specific Users

1. **Get User IDs** from Supabase:
   ```sql
   SELECT id, email FROM users WHERE user_role = 'user' LIMIT 5;
   ```

2. **In Admin Panel**:
   - Uncheck all target audiences
   - Paste user IDs in "Specific User IDs" field (comma-separated)
   - Fill title and message
   - Click "Send Now"

3. **Expected Result**:
   - Notification sent only to specified users
   - Check history shows correct target count

### Test 3: Scheduled Notification

1. **In Admin Panel**:
   - Fill title and message
   - Select target audience
   - Set "Schedule" to a future time (e.g., 5 minutes from now)
   - Click "Schedule Notification"

2. **Expected Result**:
   - Notification saved with "Pending" status
   - Will be sent at scheduled time

### Test 4: Verify Delivery (Requires Mobile Device)

1. **Register Device Token** (from mobile app):
   ```typescript
   // Mobile app should call:
   POST /api/user/device-tokens
   {
     "token": "<fcm-device-token>",
     "platform": "android", // or "ios" or "web"
     "deviceInfo": {
       "model": "Samsung Galaxy S21",
       "osVersion": "Android 13",
       "appVersion": "1.0.0"
     }
   }
   ```

2. **Send test notification** from admin panel

3. **Expected Result**:
   - Push notification appears on mobile device
   - Tapping notification opens app at specified URL

---

## Database Queries for Testing

### Check Users with Device Tokens

```sql
SELECT
  u.id,
  u.email,
  u.user_role,
  COUNT(pt.id) as token_count
FROM users u
LEFT JOIN push_tokens pt ON u.id = pt.user_id AND pt.is_active = true
GROUP BY u.id, u.email, u.user_role
HAVING COUNT(pt.id) > 0;
```

### View Recent Notifications

```sql
SELECT
  n.id,
  n.title,
  n.message,
  n.notification_type,
  n.created_at,
  u.email as sender_email
FROM notifications n
JOIN users u ON n.user_id = u.id
WHERE n.notification_type = 'system'
ORDER BY n.created_at DESC
LIMIT 10;
```

### Check Notification Delivery Stats

```sql
SELECT
  DATE(nh.created_at) as date,
  COUNT(*) as total,
  SUM(CASE WHEN nh.status = 'sent' THEN 1 ELSE 0 END) as sent,
  SUM(CASE WHEN nh.status = 'failed' THEN 1 ELSE 0 END) as failed
FROM notification_history nh
GROUP BY DATE(nh.created_at)
ORDER BY date DESC;
```

---

## Troubleshooting

### Issue: "Failed to send notification"

**Possible Causes**:
1. Firebase Admin SDK not initialized
2. No device tokens found for target users
3. Invalid FCM tokens

**Solution**:
```bash
# 1. Verify Firebase initialization
node test-firebase-setup.js

# 2. Check users have device tokens
# Run SQL query above

# 3. Check backend logs
tail -f /home/bitnami/everything_backend/logs/combined.log | grep -i firebase
```

### Issue: "Unauthorized" error

**Possible Causes**:
1. Admin not logged in
2. JWT token expired
3. User doesn't have admin role

**Solution**:
1. Login again to admin panel
2. Check user role in Supabase:
   ```sql
   SELECT id, email, user_role FROM users WHERE email = 'admin@example.com';
   ```
3. Ensure user has `user_role = 'admin'`

### Issue: "No target users found"

**Possible Causes**:
1. No users match the selected criteria
2. All users are inactive

**Solution**:
```sql
-- Check active users by role
SELECT user_role, COUNT(*)
FROM users
WHERE user_status = 'active'
GROUP BY user_role;
```

### Issue: Notifications not reaching devices

**Possible Causes**:
1. Device tokens not registered
2. App not configured to receive push notifications
3. FCM credentials mismatch

**Solution**:
1. **Check device tokens registered**:
   ```sql
   SELECT * FROM push_tokens WHERE user_id = 'test-user-id';
   ```

2. **Verify FCM project ID matches**:
   - Backend: Check `FCM_PROJECT_ID` in `.env`
   - Mobile app: Check `google-services.json` (Android) or `GoogleService-Info.plist` (iOS)

3. **Test with Firebase Console**:
   - Go to Firebase Console → Cloud Messaging
   - Use "Send test message" with device token
   - If this works, backend setup is correct

---

## Production Deployment Checklist

### Backend

- [ ] Update `.env` with production Firebase credentials
- [ ] Set `NEXT_PUBLIC_API_BASE_URL` to production URL
- [ ] Enable CORS for admin panel domain
- [ ] Set up rate limiting for push endpoints
- [ ] Configure monitoring/alerts for failed notifications
- [ ] Set up log aggregation (e.g., CloudWatch, Datadog)

### Frontend

- [ ] Update `NEXT_PUBLIC_API_BASE_URL` to production backend
- [ ] Enable CSP (Content Security Policy)
- [ ] Set up error tracking (e.g., Sentry)
- [ ] Configure authentication with production Supabase
- [ ] Test on production domain

### Firebase

- [ ] Rotate service account keys regularly
- [ ] Enable Firebase audit logs
- [ ] Set up budget alerts for FCM usage
- [ ] Configure FCM delivery reports
- [ ] Test APNs certificate (for iOS) still valid

### Database

- [ ] Create indexes for notification queries
- [ ] Set up automated backups
- [ ] Configure retention policy for old notifications
- [ ] Enable RLS (Row Level Security) on notification tables

---

## Additional Resources

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM Server Documentation](https://firebase.google.com/docs/cloud-messaging/server)
- [Supabase Documentation](https://supabase.com/docs)
- Backend Notification Service: `src/services/notification.service.ts`
- Admin Service: `src/services/admin-push-notification.service.ts`
- Frontend Page: `src/app/dashboard/push-notifications/page.tsx`

---

**Status**: ✅ Fully Integrated and Ready for Testing
**Last Updated**: 2025-11-20
**Verified By**: Claude Code AI Assistant
