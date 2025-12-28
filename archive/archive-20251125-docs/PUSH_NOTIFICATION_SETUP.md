# Push Notification Setup Guide
## Firebase Cloud Messaging (FCM) Integration for Admin-to-Mobile Push Notifications

This guide will help you set up push notifications from the admin panel to iOS and Android mobile apps using Firebase Cloud Messaging and Supabase.

---

## Architecture Overview

```
Admin Panel → Backend API → Firebase Cloud Messaging → Mobile App (iOS/Android)
                ↓
            Supabase (User data, FCM tokens, notification history)
```

**Key Components:**
- **Backend (Node.js/Express)**: Manages FCM tokens, sends notifications via Firebase Admin SDK
- **Firebase Cloud Messaging**: Delivers push notifications to devices
- **Supabase**: Stores user data, FCM tokens, and notification history
- **Mobile App (Flutter)**: Registers FCM tokens, receives and displays notifications

---

## Prerequisites

1. **Firebase Project**   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)   - Enable Cloud Messaging   - Download the service account JSON file

2. **Flutter App**   - Install `firebase_messaging` package   - Configure for iOS and Android

3. **Supabase**   - Database tables: `users`, `push_tokens`, `notifications`, `notification_history`

---

## Step 1: Firebase Configuration

### 1.1 Create Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click "Add project" or select existing project
3. Enter project name (e.g., "e-beautything")
4. Enable Google Analytics (optional)
5. Click "Create project"

### 1.2 Generate Service Account Key

1. In Firebase Console, go to **Project Settings** (gear icon)
2. Navigate to **Service accounts** tab
3. Click **Generate new private key**
4. Save the JSON file as `firebase-admin-sdk.json`
5. **IMPORTANT:** Keep this file secure and never commit to Git

### 1.3 Configure iOS (APNs)

1. In Firebase Console → **Project Settings** → **Cloud Messaging**
2. Under **Apple app configuration**, upload your APNs certificate or key
3. Get your iOS Bundle ID from your Flutter project

### 1.4 Configure Android

1. In Firebase Console → **Project Settings**
2. Under **Your apps**, add Android app
3. Enter your package name (e.g., `com.ebeautything.app`)
4. Download `google-services.json`
5. Place in `android/app/` directory

---

## Step 2: Backend Setup

### 2.1 Place Firebase Service Account File

```bash
# Create config directory if it doesn't exist
mkdir -p /home/bitnami/everything_backend/config

# Copy your firebase-admin-sdk.json file to this location
cp /path/to/firebase-admin-sdk.json /home/bitnami/everything_backend/config/
```

### 2.2 Update Environment Variables

Edit `/home/bitnami/everything_backend/.env`:

```bash
# Push Notifications (Firebase FCM)
FCM_SERVER_KEY=your-fcm-server-key-from-firebase-console
FCM_PROJECT_ID=your-firebase-project-id
FIREBASE_ADMIN_SDK_PATH=./config/firebase-admin-sdk.json
```

**Where to find these values:**
- **FCM_SERVER_KEY**: Firebase Console → Project Settings → Cloud Messaging → Server Key
- **FCM_PROJECT_ID**: Firebase Console → Project Settings → Project ID

### 2.3 Install Dependencies (Already Installed)

```bash
npm install firebase-admin @supabase/supabase-js
```

---

## Step 3: Database Schema

### 3.1 Verify Tables Exist

The following tables should already exist from the initial schema migration:

**`push_tokens` table** (already exists):
```sql
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    platform VARCHAR(20) NOT NULL, -- 'ios', 'android', 'web'
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token)
);
```

**`notification_history` table** (needs to be created):
```sql
CREATE TABLE public.notification_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    data JSONB,
    status VARCHAR(20) NOT NULL, -- 'sent', 'failed', 'pending'
    sent_at TIMESTAMPTZ,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_notification_history_user_id ON public.notification_history(user_id);
CREATE INDEX idx_notification_history_status ON public.notification_history(status);
CREATE INDEX idx_notification_history_created_at ON public.notification_history(created_at DESC);
```

---

## Step 4: Mobile App Integration (Flutter)

### 4.1 Install Firebase Messaging

Add to `pubspec.yaml`:
```yaml
dependencies:
  firebase_core: ^3.8.1
  firebase_messaging: ^15.2.1
  http: ^1.2.2
```

### 4.2 Initialize Firebase in Flutter

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Background message handler (must be top-level function)
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background message received: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Set up background message handler
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

  runApp(MyApp());
}
```

### 4.3 Request Notification Permission & Get FCM Token

```dart
// push_notification_service.dart
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import 'dart:io' show Platform;

class PushNotificationService {
  final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  final String _backendUrl = 'http://your-backend-url.com/api';

  /// Initialize push notifications
  Future<void> initialize() async {
    // Request permission (iOS)
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );

    if (settings.authorizationStatus == AuthorizationStatus.authorized) {
      print('User granted permission');

      // Get FCM token
      String? token = await _fcm.getToken();
      if (token != null) {
        print('FCM Token: $token');
        await registerToken(token);
      }

      // Handle token refresh
      _fcm.onTokenRefresh.listen((newToken) {
        print('FCM Token refreshed: $newToken');
        registerToken(newToken);
      });

      // Handle foreground messages
      FirebaseMessaging.onMessage.listen((RemoteMessage message) {
        print('Foreground message: ${message.notification?.title}');
        _handleMessage(message);
      });

      // Handle notification tap (app opened from notification)
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        print('App opened from notification');
        _handleNotificationTap(message);
      });
    } else {
      print('User declined or has not accepted permission');
    }
  }

  /// Register FCM token with backend
  Future<void> registerToken(String token) async {
    try {
      final String platform = Platform.isIOS ? 'ios' : Platform.isAndroid ? 'android' : 'web';

      final response = await http.post(
        Uri.parse('$_backendUrl/notifications/register-token'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer YOUR_JWT_TOKEN', // Add user's JWT token
        },
        body: json.encode({
          'token': token,
          'platform': platform,
          'deviceInfo': {
            'model': Platform.operatingSystemVersion,
            'osVersion': Platform.operatingSystemVersion,
            'appVersion': '1.0.0', // Get from package_info_plus
          }
        }),
      );

      if (response.statusCode == 201) {
        print('FCM token registered successfully');
      } else {
        print('Failed to register FCM token: ${response.statusCode}');
      }
    } catch (e) {
      print('Error registering FCM token: $e');
    }
  }

  /// Handle foreground message
  void _handleMessage(RemoteMessage message) {
    // Show local notification or update UI
    print('Title: ${message.notification?.title}');
    print('Body: ${message.notification?.body}');
    print('Data: ${message.data}');
  }

  /// Handle notification tap
  void _handleNotificationTap(RemoteMessage message) {
    // Navigate to appropriate screen based on data
    final String? type = message.data['type'];
    final String? action = message.data['action'];

    if (type == 'reservation' && action == 'view_reservation') {
      final String? reservationId = message.data['reservation_id'];
      // Navigate to reservation detail screen
      // Navigator.push(...);
    }
  }

  /// Unregister token (on logout)
  Future<void> unregisterToken() async {
    try {
      String? token = await _fcm.getToken();
      if (token != null) {
        await http.delete(
          Uri.parse('$_backendUrl/notifications/unregister-token'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer YOUR_JWT_TOKEN',
          },
          body: json.encode({'token': token}),
        );
      }
    } catch (e) {
      print('Error unregistering token: $e');
    }
  }
}
```

### 4.4 Use the Service

```dart
// In your app initialization (after login)
final pushService = PushNotificationService();
await pushService.initialize();
```

---

## Step 5: Backend API Endpoints

### 5.1 Mobile App Endpoints (Token Management)

**POST `/api/notifications/register-token`**
- Register FCM token for a user
- Body: `{ token: string, platform: 'ios'|'android'|'web', deviceInfo?: {...} }`

**DELETE `/api/notifications/unregister-token`**
- Unregister FCM token (on logout)
- Body: `{ token: string }`

**GET `/api/notifications/user`**
- Get user's notifications
- Query: `?page=1&limit=20&status=unread`

### 5.2 Admin Panel Endpoints (Send Notifications)

**POST `/api/admin/push/send`**
- Send push notification to users
- Body:
```json
{
  "title": "알림 제목",
  "body": "알림 내용",
  "targetUserType": ["user", "shop_owner", "influencer"],
  "targetUserIds": ["uuid1", "uuid2"],
  "data": { "key": "value" },
  "imageUrl": "https://...",
  "schedule": "2025-02-01T10:00:00Z"
}
```

**GET `/api/admin/push/history`**
- Get notification history
- Query: `?page=1&limit=20&status=sent`

**GET `/api/admin/push/:id`**
- Get notification details

---

## Step 6: Testing

### 6.1 Test Mobile Token Registration

```bash
# 1. Run the mobile app and login
# 2. Check backend logs for FCM token registration:
tail -f /home/bitnami/everything_backend/logs/combined.log | grep "FCM token registered"

# 3. Verify token in database:
# In Supabase SQL Editor:
SELECT * FROM push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 10;
```

### 6.2 Test Admin Push Notification

```bash
# Send test notification via curl:
curl -X POST http://localhost:3001/api/admin/push/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "title": "Test Notification",
    "body": "This is a test push notification",
    "targetUserIds": ["USER_UUID_HERE"]
  }'
```

### 6.3 Verify Notification Delivery

1. Check mobile app logs for received notification
2. Check backend logs:
```bash
tail -f /home/bitnami/everything_backend/logs/combined.log | grep "Notification sent"
```

3. Verify in database:
```sql
SELECT * FROM notification_history ORDER BY created_at DESC LIMIT 10;
```

---

## Step 7: Production Deployment

### 7.1 Security Checklist

- [ ] Firebase service account JSON is in `.gitignore`
- [ ] Environment variables are set in production
- [ ] Admin endpoints have proper authentication
- [ ] Rate limiting is enabled for push endpoints
- [ ] FCM tokens are properly validated
- [ ] User permissions are checked before sending

### 7.2 Performance Optimization

- [ ] Use batch sending for multiple users
- [ ] Implement retry logic for failed notifications
- [ ] Clean up inactive tokens periodically
- [ ] Monitor FCM quota usage

### 7.3 Monitoring & Logging

```bash
# Monitor push notification logs
pm2 logs backend | grep "push\|notification\|FCM"

# Check error rates
SELECT status, COUNT(*) as count
FROM notification_history
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

---

## Troubleshooting

### Issue: "No active device tokens found"
**Solution:** Verify FCM token is registered in `push_tokens` table and `is_active = true`

### Issue: "Failed to send notification to device"
**Solution:**
- Check Firebase service account JSON is valid
- Verify FCM_PROJECT_ID matches Firebase project
- Check Firebase Cloud Messaging is enabled

### Issue: Mobile app not receiving notifications
**Solution:**
- iOS: Verify APNs certificate is uploaded to Firebase
- Android: Verify `google-services.json` is in `android/app/`
- Check notification permissions are granted
- Test with Firebase Console test message

### Issue: "Invalid FCM token format"
**Solution:** Token should be ~150+ characters, alphanumeric with special chars

---

## API Reference

### Send Push Notification (Admin)

**Endpoint:** `POST /api/admin/push/send`

**Request:**
```json
{
  "title": "예약 확정 알림",
  "body": "2025년 2월 1일 10:00 예약이 확정되었습니다.",
  "targetUserType": ["user"],
  "targetUserIds": [],
  "data": {
    "type": "reservation",
    "reservation_id": "123",
    "action": "view_reservation"
  },
  "imageUrl": "https://example.com/image.png",
  "schedule": null
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "notification": { "id": "uuid", ... },
    "targetCount": 100,
    "sentCount": 98,
    "failedCount": 2
  }
}
```

---

## Next Steps

1. ✅ **Setup Firebase Project** → Get service account JSON
2. ✅ **Configure Backend** → Place JSON file, update .env
3. ✅ **Create Database Tables** → Run migration for notification_history
4. ✅ **Implement Mobile App** → Flutter FCM integration
5. ✅ **Test End-to-End** → Send test notification
6. 🚀 **Deploy to Production** → Follow security checklist

---

## Support & References

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging)
- [Flutter Firebase Messaging](https://firebase.flutter.dev/docs/messaging/overview/)
- [Supabase Documentation](https://supabase.com/docs)

---

**Need Help?** Check the backend logs at `/home/bitnami/everything_backend/logs/` for detailed error messages.
