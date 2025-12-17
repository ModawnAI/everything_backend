# 📱 FCM Push Notification Mobile/Web App Testing Guide

## ✅ Implementation Status

**Backend:** ✅ Complete and Verified
**Frontend:** ✅ Complete and Ready for Testing
**Database:** ✅ Schema Fixed with Migration 078

---

## 🎯 Testing Overview

The FCM integration works with the **ebeautything-app** Next.js web application, which functions as both a web and mobile app (PWA).

### Architecture
```
Mobile/Web App (Next.js PWA)
    ↓ (Social Login + FCM Token)
Backend API (Port 3001)
    ↓ (Store Token)
Supabase Database
    ↓ (RLS Policies)
push_tokens & user_settings tables
```

---

## 🧪 Manual Testing Steps

### Phase 1: Setup Frontend Environment

#### 1. Add Firebase Configuration

**File:** `/home/bitnami/ebeautything-app/.env.local`

```bash
# Firebase Configuration (Get from Firebase Console)
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key

# Backend API
NEXT_PUBLIC_API_URL=http://localhost:3001
```

**Get these values from:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select/Create your project
3. Go to Project Settings → General → Your apps → Web app
4. Copy the config values
5. For VAPID key: Project Settings → Cloud Messaging → Web Push certificates

#### 2. Update Service Worker

**File:** `/home/bitnami/ebeautything-app/public/firebase-messaging-sw.js`

Replace the placeholder config with your actual Firebase config:

```javascript
const firebaseConfig = {
  apiKey: 'YOUR_ACTUAL_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
};
```

#### 3. Start Frontend App

```bash
cd /home/bitnami/ebeautything-app
npm run dev
```

The app will be available at `http://localhost:3000`

---

### Phase 2: Test Social Login with FCM

#### Test 2.1: Login and Token Registration

**Steps:**
1. Open browser to `http://localhost:3000`
2. Click on social login (Google/Kakao/Apple)
3. Complete authentication
4. App should automatically request FCM token
5. Allow notifications when prompted

**Expected Results:**
- User successfully logs in
- FCM token generated and stored in localStorage
- Token sent to backend during login
- Backend returns JWT access token

**Verification:**

Check browser console for logs:
```javascript
[FCM] Token obtained successfully
[AUTH] Including FCM token in request
[AUTH] Backend JWT tokens stored
```

Check database:
```sql
-- Query push_tokens table
SELECT * FROM push_tokens
WHERE user_id = 'your_user_id'
ORDER BY created_at DESC;
```

**Should see:**
- ✅ Token record with platform='web'
- ✅ device_id populated
- ✅ app_version and os_version populated
- ✅ is_active = true
- ✅ created_at timestamp

---

### Phase 3: Test Notification Settings

#### Test 3.1: View Notification Settings

**Steps:**
1. Navigate to Settings page (where NotificationSettingsCard is added)
2. View current notification preferences

**Expected Results:**
- Settings card displays correctly
- Shows current toggle states
- Push notification toggle reflects user's preference

**API Call:**
```bash
curl -X GET http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "userId": "user_uuid",
    "pushEnabled": true,
    "emailEnabled": true,
    "reservationUpdates": true,
    "paymentNotifications": true,
    "promotionalMessages": false,
    "systemAlerts": true
  }
}
```

#### Test 3.2: Disable Push Notifications

**Steps:**
1. Toggle "푸시 알림" switch to OFF
2. Wait for API call to complete
3. Check toast notification appears

**Expected Results:**
- Toggle animates to OFF position
- Toast shows "Push Notifications Disabled"
- Database updated

**Verification:**
```sql
-- Check user_settings
SELECT push_notifications_enabled
FROM user_settings
WHERE user_id = 'your_user_id';

-- Should return: false
```

#### Test 3.3: Enable Push Notifications

**Steps:**
1. Toggle "푸시 알림" switch to ON
2. If no FCM token, browser will request permission
3. Allow notifications
4. Wait for registration to complete

**Expected Results:**
- Browser shows permission prompt (if needed)
- FCM token registered with backend
- Toggle shows ON
- Toast shows "Push Notifications Enabled"
- Database updated

**Verification:**
```sql
-- Check both tables
SELECT push_notifications_enabled FROM user_settings WHERE user_id = 'your_user_id';
SELECT is_active FROM push_tokens WHERE user_id = 'your_user_id';

-- Both should return: true
```

---

### Phase 4: Test Push Notification Delivery

#### Test 4.1: Send Test Notification from Firebase Console

**Steps:**
1. Go to Firebase Console → Cloud Messaging
2. Click "Send test message"
3. Get FCM token from database:
   ```sql
   SELECT token FROM push_tokens WHERE user_id = 'your_user_id' AND is_active = true;
   ```
4. Paste token in Firebase Console
5. Add title: "Test Notification"
6. Add body: "This is a test push notification"
7. Click "Test"

**Expected Results:**

**Foreground (App Open):**
- Notification appears in app (toast/custom UI)
- Console logs: `[FCM] Foreground message received`

**Background (App Closed/Minimized):**
- Browser shows native notification
- Notification appears in system tray
- Clicking opens the app

#### Test 4.2: Send Notification via Backend API

**Create test script:**
```bash
# test-send-notification.sh
#!/bin/bash

USER_ID="your_user_id"
TITLE="Backend Test Notification"
BODY="This notification was sent from the backend"

curl -X POST http://localhost:3001/api/admin/notifications/send \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "'$USER_ID'",
    "title": "'$TITLE'",
    "body": "'$BODY'",
    "data": {
      "type": "test",
      "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
    }
  }'
```

**Expected Results:**
- API returns success
- User receives notification
- Notification logged in database

---

### Phase 5: Test Multiple Devices

#### Test 5.1: Register Second Device

**Steps:**
1. Open app in different browser (Chrome, Firefox, Safari)
2. Login with same account
3. Allow notifications

**Expected Results:**
- Second FCM token registered
- Both tokens active in database

**Verification:**
```sql
SELECT
  token,
  platform,
  device_id,
  is_active,
  created_at
FROM push_tokens
WHERE user_id = 'your_user_id'
ORDER BY created_at DESC;

-- Should see multiple tokens, all is_active = true
```

#### Test 5.2: Broadcast Notification

**Send notification → All devices should receive it**

---

### Phase 6: Test RLS Security

#### Test 6.1: Verify User Isolation

**Try to access another user's tokens:**
```sql
-- As regular user (should fail or return empty)
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims '{"sub": "user_id_1"}';

SELECT * FROM push_tokens
WHERE user_id = 'user_id_2';  -- Different user

-- Should return empty or error
```

**Expected:** Users cannot see other users' tokens

#### Test 6.2: Verify Admin Access

**As admin (should succeed):**
```sql
SET LOCAL ROLE authenticated;
SET LOCAL request.jwt.claims '{"sub": "admin_user_id", "user_role": "admin"}';

SELECT * FROM push_tokens;  -- All tokens

-- Should return all tokens
```

---

## 🔍 Debugging Guide

### Issue: "Notification permission denied"

**Cause:** User blocked notifications in browser

**Fix:**
1. Click lock icon in address bar
2. Find "Notifications" → Change to "Allow"
3. Refresh page and try again

---

### Issue: "FCM token not sent during login"

**Cause:** Firebase not initialized before login

**Fix:**
1. Check `.env.local` has all Firebase config
2. Check browser console for Firebase errors
3. Verify service worker registered:
   ```javascript
   navigator.serviceWorker.getRegistrations().then(console.log)
   ```

---

### Issue: "Background notifications not working"

**Cause:** Service worker not registered or misconfigured

**Debug:**
1. Open DevTools → Application → Service Workers
2. Check if `firebase-messaging-sw.js` is registered
3. Check console for service worker errors
4. Verify Firebase config in service worker file

**Fix:**
```javascript
// In browser console
navigator.serviceWorker.getRegistrations().then(registrations => {
  registrations.forEach(reg => console.log(reg))
})

// Should see firebase-messaging-sw.js
```

---

### Issue: "Token validation failed"

**Cause:** Backend can't reach FCM servers

**Debug:**
```bash
# Check backend logs
tail -f logs/combined.log | grep FCM

# Check Firebase Admin SDK initialized
grep "FIREBASE_SERVICE_ACCOUNT" .env
```

---

## 📊 Success Criteria

### ✅ Backend Tests
- [x] Migration 078 applied
- [x] push_tokens columns exist
- [x] RLS policies active
- [x] Notification service uses database
- [x] FCM token registration in social login
- [x] Settings API endpoints working

### ✅ Frontend Tests
- [ ] Firebase config added to `.env.local`
- [ ] Service worker config updated
- [ ] FCM token retrieved on login
- [ ] Token sent to backend during login
- [ ] Settings UI displays correctly
- [ ] Toggle switches update backend
- [ ] Browser permission flow works
- [ ] Foreground notifications received
- [ ] Background notifications received

### ✅ Integration Tests
- [ ] End-to-end login → token → settings flow
- [ ] Multiple device registration
- [ ] Notification delivery (foreground + background)
- [ ] RLS policies enforced
- [ ] Settings persistence across sessions

---

## 🚀 Production Deployment Checklist

Before deploying to production:

### Backend
- [ ] All migrations applied to production database
- [ ] Firebase Admin SDK credentials configured
- [ ] CORS configured for production domains
- [ ] Rate limiting configured
- [ ] Error tracking enabled

### Frontend
- [ ] Production Firebase project created
- [ ] Environment variables set in hosting platform
- [ ] Service worker config updated with production values
- [ ] HTTPS enabled (required for service workers)
- [ ] Domain added to Firebase authorized domains

### Testing
- [ ] Test on Chrome, Firefox, Safari, Edge
- [ ] Test on iOS Safari (16.4+)
- [ ] Test on Android Chrome
- [ ] Test notification delivery
- [ ] Test multiple devices per user
- [ ] Test settings persistence

---

## 📞 Support

### Documentation
- **Backend API:** `PUSH_NOTIFICATION_TOGGLE_API.md`
- **Frontend Setup:** `FCM_PUSH_NOTIFICATION_SETUP.md`
- **Implementation:** `IMPLEMENTATION_COMPLETE.md`
- **Verification:** `FCM_IMPLEMENTATION_VERIFIED.md`
- **Quick Reference:** `FCM_QUICK_REFERENCE.md`

### Common Issues
- Check Firebase Console for quota limits
- Verify FCM token hasn't expired (tokens can expire)
- Check browser console for errors
- Verify network connectivity to Firebase servers

---

**Testing Status:** ✅ Ready for Manual Testing
**Last Updated:** 2025-11-21
**Backend Version:** 1.0.0
**Frontend App:** ebeautything-app (Next.js 14)
