# Push Notification Quick Start Guide
## Get push notifications running in 15 minutes

---

## 🚀 Quick Setup (Backend)

### Step 1: Get Firebase Service Account (5 min)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project (or create new one: "e-beautything")
3. Click ⚙️ **Project Settings** → **Service accounts**
4. Click **Generate new private key** → Download JSON file
5. Save as `/home/bitnami/everything_backend/config/firebase-admin-sdk.json`

### Step 2: Update Environment Variables (2 min)

Edit `/home/bitnami/everything_backend/.env`:

```bash
# Find these values in Firebase Console → Project Settings
FCM_SERVER_KEY=AAAA...your-server-key-here
FCM_PROJECT_ID=e-beautything
FIREBASE_ADMIN_SDK_PATH=./config/firebase-admin-sdk.json
```

**Where to find:**
- **FCM_SERVER_KEY:** Project Settings → Cloud Messaging → Server Key
- **FCM_PROJECT_ID:** Project Settings → Project ID

### Step 3: Run Migration (1 min)

```bash
cd /home/bitnami/everything_backend
npm run migrate
```

### Step 4: Restart Backend (1 min)

```bash
npm run dev:clean
# or
pm2 restart backend
```

**✅ Backend is ready!** Check logs for: `Firebase Admin SDK initialized`

---

## 📱 Quick Setup (Flutter Mobile App)

### Step 1: Add Dependencies (2 min)

```yaml
# pubspec.yaml
dependencies:
  firebase_core: ^3.8.1
  firebase_messaging: ^15.2.1
  http: ^1.2.2
```

Run: `flutter pub get`

### Step 2: Configure iOS (if applicable)

1. In Firebase Console → Project Settings → Add iOS app
2. Download `GoogleService-Info.plist`
3. Add to `ios/Runner/` in Xcode
4. Upload APNs certificate/key in Firebase Console

### Step 3: Configure Android

1. In Firebase Console → Project Settings → Add Android app
2. Download `google-services.json`
3. Place in `android/app/google-services.json`

### Step 4: Initialize Firebase (2 min)

```dart
// main.dart
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

// Top-level background handler
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  print('Background: ${message.messageId}');
}

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();
  FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);
  runApp(MyApp());
}
```

### Step 5: Register FCM Token (2 min)

```dart
// After user logs in
import 'dart:io' show Platform;

final fcm = FirebaseMessaging.instance;

// Request permission
await fcm.requestPermission(alert: true, badge: true, sound: true);

// Get token
String? token = await fcm.getToken();

// Register with backend
await http.post(
  Uri.parse('http://your-backend-url/api/notifications/register'),
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer $userJwtToken',
  },
  body: json.encode({
    'token': token,
    'platform': Platform.isIOS ? 'ios' : 'android',
  }),
);
```

**✅ Mobile app is ready!**

---

## 🧪 Quick Test (2 min)

### Test 1: Check Token Registration

```bash
# Check database
psql -h your-supabase-url -d postgres -c \
  "SELECT platform, COUNT(*) FROM push_tokens WHERE is_active = true GROUP BY platform;"
```

Expected output:
```
 platform | count
----------+-------
 ios      |     5
 android  |    10
```

### Test 2: Send Test Notification

```bash
curl -X POST http://localhost:3001/api/admin/push/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "title": "🎉 Test Notification",
    "body": "Push notifications are working!",
    "targetUserIds": ["USER_UUID_HERE"]
  }'
```

Expected response:
```json
{
  "success": true,
  "data": {
    "sentCount": 1,
    "failedCount": 0
  }
}
```

**✅ Check your mobile device for the notification!**

---

## 📋 Common Commands

### Backend

```bash
# Start dev server
npm run dev

# Check logs
tail -f logs/combined.log | grep "FCM\|notification"

# Run migration
npm run migrate

# Check migration status
npm run migrate:status
```

### Database Queries

```sql
-- View active tokens
SELECT * FROM push_tokens WHERE is_active = true ORDER BY created_at DESC LIMIT 10;

-- View recent notifications
SELECT * FROM notification_history ORDER BY created_at DESC LIMIT 10;

-- View token stats by platform
SELECT platform, COUNT(*) as count
FROM push_tokens
WHERE is_active = true
GROUP BY platform;
```

---

## 🔧 Common Issues & Quick Fixes

### ❌ "Firebase Admin SDK initialization failed"
**Fix:** Check `config/firebase-admin-sdk.json` exists and is valid JSON

```bash
ls -la /home/bitnami/everything_backend/config/firebase-admin-sdk.json
cat /home/bitnami/everything_backend/config/firebase-admin-sdk.json | jq .
```

### ❌ "No active device tokens found"
**Fix:** Mobile app needs to register token

```dart
// In Flutter app
String? token = await FirebaseMessaging.instance.getToken();
print('FCM Token: $token');
```

### ❌ Mobile app not receiving notifications
**Fix:**
- **iOS:** Check APNs certificate uploaded to Firebase
- **Android:** Check `google-services.json` is in `android/app/`
- **Both:** Check notification permissions granted

```dart
// Check permission status
NotificationSettings settings = await FirebaseMessaging.instance.requestPermission();
print('Authorization: ${settings.authorizationStatus}');
```

### ❌ "401 Unauthorized" when sending notification
**Fix:** Need admin JWT token

```bash
# Get admin token by logging in as admin
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin_password"}'
```

---

## 📱 Send from Admin Panel (Web UI)

If you have an admin web interface, you can send notifications via:

**URL:** `POST /api/admin/push/send`

**Request:**
```json
{
  "title": "New Feature",
  "body": "Check out our new feature!",
  "targetUserType": ["user"],
  "data": {
    "type": "announcement",
    "action": "open_app"
  }
}
```

---

## 📚 Next Steps

1. ✅ **Completed:** Basic push notification setup
2. 📖 **Read:** [PUSH_NOTIFICATION_SETUP.md](./PUSH_NOTIFICATION_SETUP.md) for detailed docs
3. 📖 **Read:** [PUSH_NOTIFICATION_IMPLEMENTATION.md](./PUSH_NOTIFICATION_IMPLEMENTATION.md) for technical details
4. 🎨 **Customize:** Notification templates in `src/services/notification.service.ts`
5. 📊 **Monitor:** Set up monitoring for delivery rates
6. 🚀 **Deploy:** Follow deployment checklist in setup guide

---

## 🆘 Need Help?

- Check logs: `tail -f logs/combined.log`
- Check error logs: `tail -f logs/error.log`
- View notification history: `SELECT * FROM notification_history WHERE status = 'failed';`
- Firebase Console: https://console.firebase.google.com
- Full docs: [PUSH_NOTIFICATION_SETUP.md](./PUSH_NOTIFICATION_SETUP.md)

---

**🎉 Congratulations! Your push notification system is now operational.**
