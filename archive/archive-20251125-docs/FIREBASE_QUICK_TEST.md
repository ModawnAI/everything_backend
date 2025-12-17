# Firebase Admin SDK - Quick Test Guide

## Quick Verification

Run this command to verify Firebase setup:

```bash
node test-firebase-setup.js
```

Expected output:
```
🔥 Firebase Admin SDK Setup Test
✅ File exists
✅ Firebase Admin SDK initialized successfully!
✅ FCM Messaging service is available
🎉 All checks passed!
```

## Test Sending a Notification

Create a test script to send a real push notification:

```bash
# Create test notification script
cat > test-send-notification.js << 'SCRIPT'
const admin = require('firebase-admin');
require('dotenv').config();

// Initialize Firebase (same as in NotificationService)
const serviceAccount = require('./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

// Test FCM token (you need to get this from your mobile app)
const testToken = 'YOUR_FCM_DEVICE_TOKEN_HERE';

const message = {
  notification: {
    title: '테스트 알림 📱',
    body: '에뷰리띵 백엔드에서 보내는 테스트 알림입니다.'
  },
  data: {
    type: 'test',
    timestamp: new Date().toISOString()
  },
  token: testToken
};

admin.messaging().send(message)
  .then((response) => {
    console.log('✅ Successfully sent message:', response);
  })
  .catch((error) => {
    console.error('❌ Error sending message:', error);
  });
SCRIPT

# Run the test (after replacing YOUR_FCM_DEVICE_TOKEN_HERE with real token)
node test-send-notification.js
```

## Integration Test with Backend API

```bash
# 1. Start the backend server
npm run dev

# 2. In another terminal, register a device token
curl -X POST http://localhost:3001/api/user/device-tokens \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "token": "YOUR_FCM_DEVICE_TOKEN",
    "platform": "android",
    "deviceInfo": {
      "model": "Test Device",
      "osVersion": "Android 13",
      "appVersion": "1.0.0"
    }
  }'

# 3. Send a test notification
curl -X POST http://localhost:3001/api/admin/notifications/send \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_JWT_TOKEN" \
  -d '{
    "userId": "USER_ID_HERE",
    "notification": {
      "title": "테스트 알림",
      "body": "백엔드 API에서 보내는 테스트입니다.",
      "data": {
        "type": "test"
      }
    }
  }'
```

## Troubleshooting Quick Checks

1. **Check environment variables**
   ```bash
   grep -E "FIREBASE|FCM" .env
   ```

2. **Verify service account file**
   ```bash
   ls -la e-beautything-firebase-adminsdk-*.json
   cat e-beautything-firebase-adminsdk-*.json | jq -r '.project_id'
   ```

3. **Check Firebase initialization in logs**
   ```bash
   # Start server and check logs
   npm run dev 2>&1 | grep -i firebase
   ```

4. **Test with minimal code**
   ```bash
   node -e "
   const admin = require('firebase-admin');
   const sa = require('./e-beautything-firebase-adminsdk-fbsvc-62fc0687ea.json');
   admin.initializeApp({ credential: admin.credential.cert(sa) });
   console.log('✅ Firebase initialized:', admin.app().name);
   "
   ```

## Common Issues & Solutions

### ❌ "ENOENT: no such file or directory"
**Solution**: Update `FIREBASE_ADMIN_SDK_PATH` in `.env` to correct file path

### ❌ "Invalid service account"
**Solution**: Re-download service account JSON from Firebase Console

### ❌ "Insufficient permissions"
**Solution**: Verify service account has "Firebase Cloud Messaging Admin" role

### ❌ "Invalid FCM token"
**Solution**: Ensure you're using a valid FCM device token from Firebase SDK

## Next Steps After Verification

1. ✅ Verify Firebase setup: `node test-firebase-setup.js`
2. 📱 Get FCM token from mobile/web app
3. 📬 Test sending notification with real token
4. 🔗 Integrate with reservation/payment flows
5. 📊 Monitor notification delivery in Firebase Console

---

For detailed documentation, see: `FIREBASE_SETUP_COMPLETE.md`
