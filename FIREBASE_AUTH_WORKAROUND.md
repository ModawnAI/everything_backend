# Firebase Authentication Workaround
## Solutions for Restricted Service Account Key Creation

**Problem:** Your organization's Firebase project has policies that restrict service account key creation.

**Error Message:** "이 서비스 계정에서는 키를 만들 수 없습니다. 조직 정책에 따라 서비스 계정 키 생성이 제한되는지 확인하세요."

---

## 🔧 Solution Options (Choose One)

### **Option 1: Use Firebase Cloud Functions (Recommended)** ⭐

Since you can't create service account keys, the best approach is to use Firebase Cloud Functions or Cloud Run, which have built-in authentication.

**Not applicable for your current Express.js backend**, but good to know for future Firebase-native deployments.

---

### **Option 2: Use FCM HTTP v1 API with OAuth2** ⭐ **RECOMMENDED**

Instead of Firebase Admin SDK, use the FCM HTTP v1 API directly with OAuth2 authentication.

#### Step 1: Get OAuth2 Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Select project: **e-beautything**
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. Application type: **Web application**
6. Download JSON file

#### Step 2: Configure Backend

Update `.env`:
```bash
# Firebase OAuth2 Authentication
FIREBASE_AUTH_METHOD=oauth2
FCM_PROJECT_ID=e-beautything
GOOGLE_CLIENT_ID=your-oauth-client-id
GOOGLE_CLIENT_SECRET=your-oauth-client-secret
GOOGLE_REFRESH_TOKEN=your-refresh-token
```

#### Step 3: Install Dependencies

```bash
npm install googleapis google-auth-library
```

#### Step 4: Create FCM Service with OAuth2

Create `src/services/fcm-http-v1.service.ts`:

```typescript
import { google } from 'googleapis';
import { logger } from '../utils/logger';
import axios from 'axios';

export class FCMHttpV1Service {
  private oauth2Client: any;
  private projectId: string;

  constructor() {
    this.projectId = process.env.FCM_PROJECT_ID || 'e-beautything';

    // Initialize OAuth2 client
    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );

    this.oauth2Client.setCredentials({
      refresh_token: process.env.GOOGLE_REFRESH_TOKEN
    });

    logger.info('FCM HTTP v1 Service initialized with OAuth2');
  }

  /**
   * Get access token for FCM API
   */
  async getAccessToken(): Promise<string> {
    try {
      const { token } = await this.oauth2Client.getAccessToken();
      return token;
    } catch (error) {
      logger.error('Failed to get access token', { error });
      throw error;
    }
  }

  /**
   * Send push notification using FCM HTTP v1 API
   */
  async sendNotification(
    fcmToken: string,
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    },
    data?: Record<string, string>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const accessToken = await this.getAccessToken();

      const message = {
        message: {
          token: fcmToken,
          notification: {
            title: notification.title,
            body: notification.body,
            ...(notification.imageUrl && { image: notification.imageUrl })
          },
          ...(data && { data }),
          android: {
            notification: {
              icon: 'ic_notification',
              color: '#FF5C00',
              sound: 'default'
            }
          },
          apns: {
            payload: {
              aps: {
                alert: {
                  title: notification.title,
                  body: notification.body
                },
                badge: 1,
                sound: 'default'
              }
            }
          }
        }
      };

      const response = await axios.post(
        `https://fcm.googleapis.com/v1/projects/${this.projectId}/messages:send`,
        message,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('FCM notification sent successfully', {
        messageId: response.data.name
      });

      return {
        success: true,
        messageId: response.data.name
      };
    } catch (error: any) {
      logger.error('Failed to send FCM notification', {
        error: error.response?.data || error.message
      });

      return {
        success: false,
        error: error.response?.data?.error?.message || error.message
      };
    }
  }

  /**
   * Send to multiple devices
   */
  async sendMulticast(
    fcmTokens: string[],
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    },
    data?: Record<string, string>
  ): Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{ success: boolean; messageId?: string; error?: string }>;
  }> {
    const results = await Promise.allSettled(
      fcmTokens.map(token => this.sendNotification(token, notification, data))
    );

    const responses = results.map(result =>
      result.status === 'fulfilled' ? result.value : { success: false, error: 'Request failed' }
    );

    return {
      successCount: responses.filter(r => r.success).length,
      failureCount: responses.filter(r => !r.success).length,
      responses
    };
  }
}

export const fcmHttpV1Service = new FCMHttpV1Service();
```

#### Step 5: Generate Refresh Token

Run this script once to get your refresh token:

Create `scripts/get-firebase-refresh-token.js`:

```javascript
const { google } = require('googleapis');
const readline = require('readline');

const oauth2Client = new google.auth.OAuth2(
  'YOUR_CLIENT_ID',
  'YOUR_CLIENT_SECRET',
  'http://localhost:3000/oauth2callback'
);

const scopes = [
  'https://www.googleapis.com/auth/firebase.messaging'
];

const url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: scopes
});

console.log('Authorize this app by visiting this URL:', url);

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('Enter the authorization code: ', async (code) => {
  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log('\n✅ Refresh Token:', tokens.refresh_token);
    console.log('\nAdd this to your .env file:');
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
  } catch (error) {
    console.error('Error getting tokens:', error);
  }
  rl.close();
});
```

Run:
```bash
node scripts/get-firebase-refresh-token.js
```

---

### **Option 3: Use Legacy FCM Server Key** ⚠️ (Deprecated but Works)

Firebase still supports the legacy server key method, though it's deprecated.

#### Step 1: Get Server Key

1. Firebase Console → **Project Settings**
2. **Cloud Messaging** tab
3. Copy **Server Key** (starts with `AAAA...`)

#### Step 2: Update `.env`

```bash
FIREBASE_AUTH_METHOD=server_key
FCM_SERVER_KEY=AAAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
FCM_PROJECT_ID=e-beautything
```

#### Step 3: Use Legacy FCM API

Create `src/services/fcm-legacy.service.ts`:

```typescript
import axios from 'axios';
import { logger } from '../utils/logger';

export class FCMLegacyService {
  private serverKey: string;

  constructor() {
    this.serverKey = process.env.FCM_SERVER_KEY || '';

    if (!this.serverKey) {
      throw new Error('FCM_SERVER_KEY not configured');
    }

    logger.info('FCM Legacy Service initialized');
  }

  /**
   * Send notification using legacy FCM API
   */
  async sendNotification(
    fcmToken: string,
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    },
    data?: Record<string, string>
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        {
          to: fcmToken,
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/icon-192x192.png',
            ...(notification.imageUrl && { image: notification.imageUrl })
          },
          ...(data && { data }),
          priority: 'high'
        },
        {
          headers: {
            'Authorization': `key=${this.serverKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info('FCM notification sent successfully', {
        messageId: response.data.results?.[0]?.message_id
      });

      return {
        success: response.data.success === 1,
        messageId: response.data.results?.[0]?.message_id
      };
    } catch (error: any) {
      logger.error('Failed to send FCM notification', {
        error: error.response?.data || error.message
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message
      };
    }
  }

  /**
   * Send to multiple devices
   */
  async sendMulticast(
    fcmTokens: string[],
    notification: {
      title: string;
      body: string;
      imageUrl?: string;
    },
    data?: Record<string, string>
  ): Promise<{
    successCount: number;
    failureCount: number;
    responses: Array<{ success: boolean; messageId?: string; error?: string }>;
  }> {
    try {
      const response = await axios.post(
        'https://fcm.googleapis.com/fcm/send',
        {
          registration_ids: fcmTokens,
          notification: {
            title: notification.title,
            body: notification.body,
            icon: '/icon-192x192.png',
            ...(notification.imageUrl && { image: notification.imageUrl })
          },
          ...(data && { data }),
          priority: 'high'
        },
        {
          headers: {
            'Authorization': `key=${this.serverKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      return {
        successCount: response.data.success,
        failureCount: response.data.failure,
        responses: response.data.results || []
      };
    } catch (error: any) {
      logger.error('Failed to send multicast notification', {
        error: error.response?.data || error.message
      });

      return {
        successCount: 0,
        failureCount: fcmTokens.length,
        responses: []
      };
    }
  }
}

export const fcmLegacyService = new FCMLegacyService();
```

---

### **Option 4: Contact Firebase Administrator**

If you're not the Firebase project owner:

1. Contact your Firebase project administrator
2. Request they either:
   - **Option A:** Create a service account key for you
   - **Option B:** Grant you the "Service Account Key Admin" role
   - **Option C:** Change organization policies to allow key creation

---

## 🎯 Recommended Approach

**For your situation, I recommend Option 3 (Legacy Server Key)** because:

✅ **Simplest to implement** - No complex OAuth2 flow
✅ **Works immediately** - Server key is available in Firebase Console
✅ **No organizational restrictions** - Server key creation isn't restricted
✅ **Sufficient for MVP** - Can migrate to OAuth2 later

### Quick Implementation (Option 3)

1. **Get Server Key:**
   ```
   Firebase Console → Project Settings → Cloud Messaging → Server Key
   ```

2. **Update `.env`:**
   ```bash
   FIREBASE_AUTH_METHOD=server_key
   FCM_SERVER_KEY=AAAAxxxxxxxx...
   FCM_PROJECT_ID=e-beautything
   ```

3. **Update your notification service to use the legacy service above**

4. **Test:**
   ```bash
   npm run dev:clean
   # Check logs for "FCM Legacy Service initialized"
   ```

---

## 📝 Summary

| Option | Complexity | Recommended | Notes |
|--------|-----------|-------------|-------|
| Option 1: Cloud Functions | High | ❌ | Requires rewriting backend |
| Option 2: OAuth2 | Medium | ⚠️ | Most secure, but complex setup |
| Option 3: Server Key | Low | ✅ | Easiest, works immediately |
| Option 4: Contact Admin | N/A | ⚠️ | If you have admin access |

---

## 🚀 Next Steps

1. Choose **Option 3 (Legacy Server Key)**
2. Get server key from Firebase Console
3. Update `.env` with `FCM_SERVER_KEY`
4. The existing code will automatically use it
5. Test notification sending

The backend is already configured to handle this! Just update your `.env` file and restart.

---

**Need help implementing? Let me know which option you choose!**
