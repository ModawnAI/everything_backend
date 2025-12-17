# 🚀 FCM Push Notifications - Quick Reference

## 📍 Status: ✅ Implementation Complete

---

## 🔧 Backend API Endpoints

### Notification Settings
```bash
# Get user notification preferences
GET /api/notifications/settings
Authorization: Bearer <access_token>

# Update notification preferences
PUT /api/notifications/settings
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "pushEnabled": true,
  "reservationUpdates": true,
  "promotionalMessages": false
}
```

### FCM Token Registration
```bash
# Register FCM token (automatic during social login)
POST /api/notifications/register
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "token": "fcm_token_here",
  "deviceType": "web"
}
```

---

## 💻 Frontend Integration

### 1. Setup FCM Token Hook
```typescript
import { useFCMToken } from '@/hooks/useFCMToken';

const {
  token,
  isSupported,
  requestToken,
  registerWithBackend
} = useFCMToken({
  autoRequest: true,
  accessToken: userAccessToken
});
```

### 2. Social Login with FCM
```typescript
import { getFCMToken } from '@/lib/firebase/messaging';
import { AuthAPI } from '@/lib/api/auth-api';

async function handleSocialLogin(provider, supabaseSession) {
  // Get FCM token
  const fcmToken = await getFCMToken();

  // Login with FCM token
  const response = await AuthAPI.socialLoginWithSupabase(
    provider,
    supabaseSession.user,
    supabaseSession.access_token,
    supabaseSession.refresh_token,
    fcmToken  // ← Include FCM token
  );

  return response;
}
```

### 3. Add Settings UI
```typescript
import { NotificationSettingsCard } from '@/components/settings/NotificationSettingsCard';

function SettingsPage() {
  const { accessToken } = useAuth();

  return (
    <NotificationSettingsCard accessToken={accessToken} />
  );
}
```

---

## 🗄️ Database Schema

### push_tokens Table
```sql
push_tokens (
  id              uuid PRIMARY KEY,
  user_id         uuid NOT NULL → users.id,
  token           text NOT NULL,
  platform        varchar NOT NULL,
  device_id       varchar,
  app_version     varchar,
  os_version      varchar,
  is_active       boolean DEFAULT true,
  last_used_at    timestamp,
  created_at      timestamp DEFAULT now(),
  updated_at      timestamp DEFAULT now()
)
```

### user_settings Table (relevant columns)
```sql
user_settings (
  user_id                        uuid PRIMARY KEY → users.id,
  push_notifications_enabled     boolean DEFAULT true,
  reservation_notifications      boolean DEFAULT true,
  marketing_notifications        boolean DEFAULT false,
  event_notifications            boolean DEFAULT true
)
```

---

## 🔒 Security

### RLS Policies (push_tokens)
- ✅ Users can view/insert/update/delete own tokens
- ✅ Admins can manage all tokens
- ✅ Protected by `auth.uid()`

### API Authentication
- ✅ All endpoints require JWT Bearer token
- ✅ User ID extracted from token (no spoofing)
- ✅ Rate limiting applied

---

## 🧪 Quick Test

### Test 1: FCM Token Registration
```bash
# 1. Login via social auth
# 2. Check database
SELECT * FROM push_tokens WHERE user_id = 'your_user_id';

# Should see token entry with platform='web'
```

### Test 2: Notification Toggle
```bash
# Update settings
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"pushEnabled": false}'

# Check database
SELECT push_notifications_enabled
FROM user_settings
WHERE user_id = 'your_user_id';

# Should show 'false'
```

### Test 3: Send Test Notification
```bash
# Go to Firebase Console → Cloud Messaging
# Send test message with FCM token from database
# User should receive notification (even when app closed)
```

---

## ⚙️ Environment Variables Needed

### Frontend (.env.local)
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_FIREBASE_VAPID_KEY=

NEXT_PUBLIC_API_URL=http://localhost:3001
```

### Backend (.env)
```bash
# Already configured - Firebase Admin SDK credentials
```

---

## 📁 Key Files

### Backend
- `src/services/notification.service.ts` - Service layer
- `src/controllers/social-auth.controller.ts` - FCM registration
- `src/migrations/078_fix_push_tokens_schema_and_rls.sql` - Schema

### Frontend
- `src/lib/firebase/messaging.ts` - Firebase service
- `src/hooks/useFCMToken.ts` - React hook
- `src/components/settings/NotificationSettingsCard.tsx` - UI
- `src/lib/api/auth-api.ts` - Auth with FCM
- `public/firebase-messaging-sw.js` - Service worker

---

## 🐛 Common Issues

### Issue: "Notification permission denied"
**Fix:** User must manually grant permission. Show explanation first.

### Issue: "FCM token not sent during login"
**Fix:** Ensure Firebase initialized before login. Get token first.

### Issue: "Background notifications not working"
**Fix:**
1. Check service worker registered
2. Verify Firebase config in service worker
3. Test from Firebase Console

### Issue: "VAPID key error"
**Fix:** Generate VAPID key in Firebase Console → Cloud Messaging

---

## 📖 Full Documentation

- **Backend API:** `PUSH_NOTIFICATION_TOGGLE_API.md`
- **Frontend Setup:** `FCM_PUSH_NOTIFICATION_SETUP.md`
- **Complete Guide:** `IMPLEMENTATION_COMPLETE.md`
- **Verification:** `FCM_IMPLEMENTATION_VERIFIED.md`

---

## ✅ Next Steps

1. **Setup Firebase:**
   - Create project at console.firebase.google.com
   - Enable Cloud Messaging
   - Get Web credentials + VAPID key

2. **Configure Frontend:**
   - Add Firebase config to `.env.local`
   - Update service worker config

3. **Add to App:**
   - Import NotificationSettingsCard
   - Add to Settings page

4. **Test:**
   - Login → Check token in DB
   - Toggle settings → Verify in DB
   - Send test from Firebase Console

5. **Deploy:**
   - Update production environment variables
   - Enable HTTPS
   - Test across browsers

---

**Status:** ✅ Ready for Firebase configuration and testing
**Last Updated:** 2025-11-21
