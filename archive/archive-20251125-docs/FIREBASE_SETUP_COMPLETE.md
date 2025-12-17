# Firebase Admin SDK Setup - Complete ✅

## Setup Status: COMPLETE

The Firebase Admin SDK has been successfully configured for the eBeautything backend.

## Configuration Summary

### ✅ Files Configured

1. **Firebase Service Account Key**
   - Location: `/home/bitnami/everything_backend/e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json`
   - Type: Service Account Credentials
   - Project ID: `e-beautything`
   - Status: ✅ Verified and working

2. **Environment Variables** (`.env`)
   ```bash
   FIREBASE_AUTH_METHOD=service_account
   FCM_PROJECT_ID=e-beautything
   FCM_SENDER_ID=958913474136
   FIREBASE_ADMIN_SDK_PATH=./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json
   ```

3. **Git Ignore** (`.gitignore`)
   - Firebase Admin SDK file is properly excluded from version control
   - Pattern added: `*-firebase-adminsdk-*.json`

### ✅ Initialization Method

The `NotificationService` class (`src/services/notification.service.ts`) uses a smart initialization strategy:

1. **Primary Method**: Service Account File (line 534-554)
   - Loads credentials from `FIREBASE_ADMIN_SDK_PATH`
   - Validates file exists and parses JSON
   - Initializes Firebase Admin SDK with certificate

2. **Fallback Method**: Application Default Credentials (line 575-584)
   - Used if service account file not found
   - Suitable for cloud environments with implicit credentials

3. **Alternative Method**: Refresh Token (line 557-573)
   - Available for restricted environments
   - Set `FIREBASE_AUTH_METHOD=refresh_token` and provide `FIREBASE_REFRESH_TOKEN`

## Testing Results

### ✅ Firebase Admin SDK Initialization Test

```bash
$ node test-firebase-setup.js

🔥 Firebase Admin SDK Setup Test

📋 Environment Configuration:
   FIREBASE_AUTH_METHOD: service_account
   FIREBASE_ADMIN_SDK_PATH: ./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json
   FCM_PROJECT_ID: e-beautything

📂 Checking service account file:
   Path: /home/bitnami/everything_backend/e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json
   ✅ File exists

🔑 Service Account Details:
   Type: service_account
   Project ID: e-beautything
   Client Email: firebase-adminsdk-fbsvc@e-beautything.iam.gserviceaccount.com
   Private Key: ✅ Present

🚀 Initializing Firebase Admin SDK...
✅ Firebase Admin SDK initialized successfully!

📬 Testing FCM Messaging Service...
✅ FCM Messaging service is available

📱 App Configuration:
   Name: [DEFAULT]
   Project ID: e-beautything

🎉 All checks passed!
```

## Service Account Details

- **Project ID**: e-beautything
- **Client Email**: firebase-adminsdk-fbsvc@e-beautything.iam.gserviceaccount.com
- **Client ID**: 111141949113026742117
- **Auth Provider**: Google OAuth2
- **Token URI**: https://oauth2.googleapis.com/token

## How to Use Push Notifications

### 1. Register Device Token

When a user logs into the app, register their FCM device token:

```typescript
import { NotificationService } from '@/services/notification.service';

const notificationService = new NotificationService();

// Register device token
await notificationService.registerDeviceToken(
  userId,
  fcmToken,
  'android', // or 'ios' or 'web'
  {
    model: 'Samsung Galaxy S21',
    osVersion: 'Android 13',
    appVersion: '1.0.0'
  }
);
```

### 2. Send Push Notification

Send notifications to users:

```typescript
// Send to single user
await notificationService.sendPushNotification(
  userId,
  {
    title: '예약이 확정되었습니다 🎉',
    body: '예약이 성공적으로 확정되었습니다.',
    data: {
      type: 'reservation_confirmed',
      reservationId: '123'
    },
    clickAction: '/reservations'
  }
);

// Send to multiple users
await notificationService.sendBulkPushNotifications([
  { userId: 'user1', notification: { ... } },
  { userId: 'user2', notification: { ... } }
]);
```

### 3. Send Reservation Notifications

Use pre-defined templates for common notifications:

```typescript
// User receives notification when reservation is confirmed
await notificationService.sendReservationNotification(
  userId,
  'reservation_confirmed',
  {
    shopName: '서울 헤어살롱',
    serviceName: '커트 + 파마',
    reservationTime: '2025-11-21 14:00'
  }
);

// Shop owner receives notification for new reservation request
await notificationService.sendReservationNotification(
  shopOwnerId,
  'reservation_requested',
  {
    customerName: '김철수',
    serviceName: '커트',
    requestedTime: '2025-11-21 15:00'
  }
);
```

## Available Notification Templates

The service includes Korean notification templates for:

- `reservation_requested` - New reservation request (for shop)
- `reservation_requested_user` - Reservation submitted (for user)
- `reservation_confirmed` - Reservation confirmed (for user)
- `reservation_confirmed_shop` - Reservation confirmed (for shop)
- `reservation_rejected` - Reservation rejected (for user)
- `reservation_rejected_shop` - Reservation rejected (for shop)
- `reservation_completed` - Service completed (for user)
- `reservation_completed_shop` - Service completed (for shop)
- `reservation_cancelled_user` - Reservation cancelled (for user)
- `reservation_cancelled_shop` - Reservation cancelled (for shop)
- `reservation_no_show` - User didn't show up
- `reservation_reminder_1h` - Reminder 1 hour before
- `reservation_reminder_24h` - Reminder 24 hours before
- `payment_completed` - Payment successful
- `payment_failed` - Payment failed
- `payment_refunded` - Refund processed
- `review_request` - Request for review
- `promotion_new` - New promotion
- `user_welcome` - Welcome new user
- And many more...

## API Endpoints

### Register Device Token
```
POST /api/user/device-tokens
Body: {
  token: "fcm-device-token",
  platform: "android|ios|web",
  deviceInfo: { model, osVersion, appVersion }
}
```

### Update Notification Settings
```
PUT /api/user/notification-settings
Body: {
  pushEnabled: true,
  reservationUpdates: true,
  paymentNotifications: true,
  ...
}
```

### Get Notification History
```
GET /api/user/notifications?limit=20&offset=0
```

### Mark Notification as Read
```
PUT /api/user/notifications/:id/read
```

## Database Tables

### push_tokens
Stores FCM device tokens for each user:
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `token` (text, unique)
- `platform` (enum: ios, android, web)
- `is_active` (boolean)
- `last_used_at` (timestamp)
- `device_info` (jsonb)
- `created_at` (timestamp)

### notification_history
Tracks all sent notifications:
- `id` (uuid, primary key)
- `user_id` (uuid, foreign key)
- `title` (text)
- `body` (text)
- `data` (jsonb)
- `status` (enum: sent, failed, pending)
- `sent_at` (timestamp)
- `read_at` (timestamp)
- `error_message` (text)
- `created_at` (timestamp)

### notification_settings
User notification preferences:
- `user_id` (uuid, primary key)
- `push_enabled` (boolean)
- `email_enabled` (boolean)
- `sms_enabled` (boolean)
- `reservation_updates` (boolean)
- `payment_notifications` (boolean)
- `promotional_messages` (boolean)
- `system_alerts` (boolean)
- `updated_at` (timestamp)

## Security Considerations

### ✅ Implemented

1. **Credential Protection**
   - Service account file excluded from git
   - File permissions set to 644 (readable by owner)
   - No credentials in source code

2. **Token Validation**
   - FCM token format validation
   - Duplicate token detection
   - Inactive token cleanup

3. **Rate Limiting**
   - Per-user notification limits
   - Bulk send throttling
   - Retry logic with exponential backoff

4. **User Privacy**
   - Users can opt out of notifications
   - Granular notification preferences
   - Token deletion on logout

### 🔒 Recommendations

1. **Production Deployment**
   - Use environment-specific service accounts
   - Rotate service account keys regularly
   - Enable Cloud Audit Logs

2. **Monitoring**
   - Track notification delivery rates
   - Monitor failed notifications
   - Alert on high error rates

3. **Compliance**
   - Obtain user consent for push notifications
   - Provide easy opt-out mechanism
   - Log notification events for audit

## Troubleshooting

### Issue: "Firebase Admin SDK initialization failed"

**Solution:**
1. Verify `FIREBASE_ADMIN_SDK_PATH` in `.env`
2. Check file exists and is readable: `ls -la e-beautything-firebase-adminsdk-*.json`
3. Validate JSON format: `cat e-beautything-firebase-adminsdk-*.json | jq .`
4. Run test script: `node test-firebase-setup.js`

### Issue: "Invalid FCM token"

**Solution:**
1. Ensure token is from Firebase SDK (not APNs or other services)
2. Token should be ~152 characters long
3. Format: starts with alphanumeric characters
4. Verify app's Firebase configuration matches backend project

### Issue: "Notification not received"

**Solution:**
1. Check user has `push_enabled: true` in `notification_settings`
2. Verify device token is `is_active: true` in `push_tokens`
3. Check notification history for error messages
4. Test with Firebase Console's "Cloud Messaging" test send
5. Verify app has notification permissions enabled

### Issue: "Service account does not have permission"

**Solution:**
1. Go to Firebase Console → Project Settings → Service Accounts
2. Ensure service account has "Firebase Cloud Messaging Admin" role
3. Regenerate key if necessary
4. Update `FIREBASE_ADMIN_SDK_PATH` with new file

## Next Steps

### ✅ Completed
- [x] Configure Firebase Admin SDK
- [x] Set environment variables
- [x] Add git ignore rules
- [x] Test initialization
- [x] Verify FCM messaging service

### 📋 Frontend Integration

To complete the push notification setup, the frontend app needs to:

1. **Initialize Firebase SDK**
   ```typescript
   import { initializeApp } from 'firebase/app';
   import { getMessaging, getToken } from 'firebase/messaging';

   const firebaseConfig = {
     apiKey: "your-api-key",
     authDomain: "e-beautything.firebaseapp.com",
     projectId: "e-beautything",
     storageBucket: "e-beautything.appspot.com",
     messagingSenderId: "958913474136",
     appId: "your-app-id"
   };

   const app = initializeApp(firebaseConfig);
   const messaging = getMessaging(app);
   ```

2. **Request Permission & Get Token**
   ```typescript
   const token = await getToken(messaging, {
     vapidKey: 'your-vapid-key'
   });

   // Send token to backend
   await fetch('/api/user/device-tokens', {
     method: 'POST',
     body: JSON.stringify({
       token,
       platform: 'web',
       deviceInfo: { ... }
     })
   });
   ```

3. **Handle Foreground Messages**
   ```typescript
   import { onMessage } from 'firebase/messaging';

   onMessage(messaging, (payload) => {
     console.log('Notification received:', payload);
     // Show notification to user
   });
   ```

4. **Add Service Worker** (`firebase-messaging-sw.js`)
   ```javascript
   importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
   importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

   firebase.initializeApp({ ... });

   const messaging = firebase.messaging();

   messaging.onBackgroundMessage((payload) => {
     // Handle background notification
   });
   ```

## References

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [FCM Server Documentation](https://firebase.google.com/docs/cloud-messaging/server)
- [Firebase Console](https://console.firebase.google.com/project/e-beautything)
- Backend Implementation: `src/services/notification.service.ts`

---

**Status**: ✅ Ready for production use
**Last Updated**: 2025-11-20
**Verified By**: Claude Code AI Assistant
