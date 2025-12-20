# Implementation Plan: FCM Push Notifications

## Overview

| Attribute | Value |
|-----------|-------|
| **Priority** | P2 - Medium |
| **Estimated Effort** | 12-16 hours |
| **Risk Level** | Medium |
| **Components Affected** | Backend + Frontend + Flutter |
| **Dependencies** | Firebase project configured |

## Problem Statement

The FCM (Firebase Cloud Messaging) infrastructure is partially implemented but not fully functional:

**Backend Status:**
- Firebase Admin SDK configured
- Notification service exists (`src/services/notification.service.ts`)
- FCM token storage table exists
- Push notification sending logic partially implemented

**Frontend Status:**
- Firebase configuration not complete
- Service worker missing
- Token registration not implemented
- Push permission request missing

---

## Current Architecture

### Backend (Implemented)

```
src/services/notification.service.ts:
├── FCMTokenInfo interface
├── DeviceToken interface
├── NotificationService class
│   ├── sendTemplateNotification()
│   ├── sendToUser()
│   ├── sendToMultiple()
│   └── Template definitions (Korean)
```

### Missing Components

1. **Frontend**: Firebase initialization & token registration
2. **Frontend**: Service worker for background notifications
3. **Frontend**: Permission request flow
4. **Backend**: Token validation & cleanup
5. **Flutter**: Native push handling integration

---

## Implementation Steps

### Step 1: Create Firebase Configuration

**File:** `src/lib/firebase/config.ts`

```typescript
/**
 * Firebase Configuration for Push Notifications
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getMessaging, Messaging, getToken, onMessage } from 'firebase/messaging';

// Firebase config from environment
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Initialize Firebase
let app: FirebaseApp | null = null;
let messaging: Messaging | null = null;

export function getFirebaseApp(): FirebaseApp {
  if (!app) {
    const apps = getApps();
    app = apps.length > 0 ? apps[0] : initializeApp(firebaseConfig);
  }
  return app;
}

export function getFirebaseMessaging(): Messaging | null {
  if (typeof window === 'undefined') {
    return null; // Not available on server
  }

  if (!messaging) {
    try {
      const app = getFirebaseApp();
      messaging = getMessaging(app);
    } catch (error) {
      console.error('Failed to initialize Firebase Messaging:', error);
      return null;
    }
  }

  return messaging;
}

export const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

export { getToken, onMessage };
```

### Step 2: Create Service Worker

**File:** `public/firebase-messaging-sw.js`

```javascript
/**
 * Firebase Messaging Service Worker
 * Handles background push notifications
 */

importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

// Firebase config (must match app config)
firebase.initializeApp({
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_AUTH_DOMAIN',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_STORAGE_BUCKET',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log('[SW] Background message:', payload);

  const notificationTitle = payload.notification?.title || '에뷰리띵';
  const notificationOptions = {
    body: payload.notification?.body || '',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/badge-72x72.png',
    tag: payload.data?.tag || 'default',
    data: payload.data,
    actions: getNotificationActions(payload.data?.type),
    requireInteraction: payload.data?.priority === 'high',
    vibrate: [200, 100, 200],
  };

  return self.registration.showNotification(notificationTitle, notificationOptions);
});

// Get notification actions based on type
function getNotificationActions(type) {
  switch (type) {
    case 'reservation_confirmed':
    case 'reservation_update':
      return [
        { action: 'view', title: '예약 보기' },
        { action: 'dismiss', title: '닫기' },
      ];
    case 'payment':
      return [
        { action: 'view', title: '결제 확인' },
        { action: 'dismiss', title: '닫기' },
      ];
    default:
      return [
        { action: 'view', title: '확인' },
        { action: 'dismiss', title: '닫기' },
      ];
  }
}

// Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[SW] Notification clicked:', event);
  event.notification.close();

  const action = event.action;
  const data = event.notification.data || {};

  // Determine URL to open
  let url = '/';
  if (action === 'view' || !action) {
    if (data.reservationId) {
      url = `/bookings/${data.reservationId}`;
    } else if (data.url) {
      url = data.url;
    } else {
      url = '/dashboard';
    }
  }

  // Focus or open window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Check if there's already a window open
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.postMessage({ type: 'NOTIFICATION_CLICK', data });
          return client.focus();
        }
      }
      // Open new window
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});

// Handle push subscription change
self.addEventListener('pushsubscriptionchange', (event) => {
  console.log('[SW] Push subscription changed');
  event.waitUntil(
    // Notify the app to re-register
    self.registration.pushManager.subscribe(event.oldSubscription.options).then((subscription) => {
      // Send new subscription to server
      return fetch('/api/notifications/update-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(subscription),
      });
    })
  );
});
```

### Step 3: Create Push Notification Context

**File:** `src/contexts/PushNotificationContext.tsx`

```tsx
/**
 * Push Notification Context
 * Manages FCM token registration and notifications
 */

'use client';

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from 'react';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';
import {
  getFirebaseMessaging,
  getToken,
  onMessage,
  VAPID_KEY,
} from '@/lib/firebase/config';

interface PushNotificationContextType {
  isSupported: boolean;
  permission: NotificationPermission;
  fcmToken: string | null;
  isRegistered: boolean;
  requestPermission: () => Promise<boolean>;
  registerToken: () => Promise<boolean>;
  unregisterToken: () => Promise<boolean>;
}

const PushNotificationContext = createContext<PushNotificationContextType | null>(null);

export function PushNotificationProvider({ children }: { children: React.ReactNode }) {
  const { user, getAuthToken } = useAuth();
  const { toast } = useToast();
  const [isSupported, setIsSupported] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isRegistered, setIsRegistered] = useState(false);

  // Check browser support
  useEffect(() => {
    const checkSupport = () => {
      const supported =
        typeof window !== 'undefined' &&
        'Notification' in window &&
        'serviceWorker' in navigator &&
        'PushManager' in window;

      setIsSupported(supported);

      if (supported) {
        setPermission(Notification.permission);
      }
    };

    checkSupport();
  }, []);

  // Register service worker
  useEffect(() => {
    if (!isSupported) return;

    navigator.serviceWorker
      .register('/firebase-messaging-sw.js')
      .then((registration) => {
        console.log('SW registered:', registration);
      })
      .catch((error) => {
        console.error('SW registration failed:', error);
      });
  }, [isSupported]);

  // Listen for foreground messages
  useEffect(() => {
    if (!isSupported || permission !== 'granted') return;

    const messaging = getFirebaseMessaging();
    if (!messaging) return;

    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message:', payload);

      // Show toast for foreground notifications
      toast({
        title: payload.notification?.title || '알림',
        description: payload.notification?.body,
      });
    });

    return () => {
      // onMessage returns unsubscribe function in Firebase 9+
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, [isSupported, permission, toast]);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        variant: 'error',
        title: '알림 미지원',
        description: '이 브라우저는 알림을 지원하지 않습니다.',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);

      if (result === 'granted') {
        toast({
          title: '알림 허용됨',
          description: '이제 실시간 알림을 받을 수 있습니다.',
        });
        return true;
      } else if (result === 'denied') {
        toast({
          variant: 'error',
          title: '알림 거부됨',
          description: '브라우저 설정에서 알림을 허용해주세요.',
        });
      }

      return false;
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }, [isSupported, toast]);

  // Register FCM token with backend
  const registerToken = useCallback(async (): Promise<boolean> => {
    if (!isSupported || permission !== 'granted' || !user) {
      return false;
    }

    try {
      const messaging = getFirebaseMessaging();
      if (!messaging) return false;

      // Get FCM token
      const token = await getToken(messaging, {
        vapidKey: VAPID_KEY,
        serviceWorkerRegistration: await navigator.serviceWorker.ready,
      });

      if (!token) {
        console.error('Failed to get FCM token');
        return false;
      }

      setFcmToken(token);
      console.log('FCM Token:', token);

      // Send token to backend
      const authToken = await getAuthToken();
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({
          token,
          platform: detectPlatform(),
          deviceInfo: getDeviceInfo(),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to register token');
      }

      setIsRegistered(true);
      console.log('FCM token registered successfully');
      return true;
    } catch (error) {
      console.error('Token registration failed:', error);
      return false;
    }
  }, [isSupported, permission, user, getAuthToken]);

  // Unregister FCM token
  const unregisterToken = useCallback(async (): Promise<boolean> => {
    if (!fcmToken || !user) return false;

    try {
      const authToken = await getAuthToken();
      const response = await fetch('/api/notifications/unregister-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ token: fcmToken }),
      });

      if (response.ok) {
        setFcmToken(null);
        setIsRegistered(false);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Token unregistration failed:', error);
      return false;
    }
  }, [fcmToken, user, getAuthToken]);

  // Auto-register on login
  useEffect(() => {
    if (user && permission === 'granted' && !isRegistered) {
      registerToken();
    }
  }, [user, permission, isRegistered, registerToken]);

  return (
    <PushNotificationContext.Provider
      value={{
        isSupported,
        permission,
        fcmToken,
        isRegistered,
        requestPermission,
        registerToken,
        unregisterToken,
      }}
    >
      {children}
    </PushNotificationContext.Provider>
  );
}

export function usePushNotifications() {
  const context = useContext(PushNotificationContext);
  if (!context) {
    throw new Error('usePushNotifications must be used within PushNotificationProvider');
  }
  return context;
}

// Utility functions
function detectPlatform(): 'ios' | 'android' | 'web' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  return 'web';
}

function getDeviceInfo() {
  return {
    userAgent: navigator.userAgent,
    language: navigator.language,
    platform: navigator.platform,
    screenWidth: window.screen.width,
    screenHeight: window.screen.height,
  };
}

export default PushNotificationContext;
```

### Step 4: Create Backend Token Registration Endpoint

**File:** `src/routes/notification.routes.ts` (add routes)

```typescript
// Add to existing routes:

router.post('/register-token',
  authenticateUser,
  [
    body('token').isString().notEmpty(),
    body('platform').isIn(['ios', 'android', 'web']),
    body('deviceInfo').optional().isObject(),
  ],
  validateRequest,
  notificationController.registerFcmToken
);

router.post('/unregister-token',
  authenticateUser,
  [body('token').isString().notEmpty()],
  validateRequest,
  notificationController.unregisterFcmToken
);
```

**File:** `src/controllers/notification.controller.ts` (add methods)

```typescript
/**
 * Register FCM token
 */
async registerFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { token, platform, deviceInfo } = req.body;

    await notificationService.registerFcmToken(userId, {
      token,
      platform,
      deviceInfo,
    });

    res.json({
      success: true,
      message: 'Token registered successfully',
    });
  } catch (error) {
    next(error);
  }
}

/**
 * Unregister FCM token
 */
async unregisterFcmToken(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.user!.id;
    const { token } = req.body;

    await notificationService.unregisterFcmToken(userId, token);

    res.json({
      success: true,
      message: 'Token unregistered successfully',
    });
  } catch (error) {
    next(error);
  }
}
```

### Step 5: Create Permission Request Component

**File:** `src/components/notifications/push-permission-banner.tsx`

```tsx
/**
 * Push Permission Request Banner
 * Shows when user hasn't enabled notifications
 */

'use client';

import { useState, useEffect } from 'react';
import { usePushNotifications } from '@/contexts/PushNotificationContext';
import { Button } from '@/components/ui/button';
import { Bell, X } from 'lucide-react';
import { cn } from '@/lib/utils';

export function PushPermissionBanner() {
  const { isSupported, permission, requestPermission } = usePushNotifications();
  const [isDismissed, setIsDismissed] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Check if user has dismissed before
    const dismissed = localStorage.getItem('push-permission-dismissed');
    if (dismissed) {
      setIsDismissed(true);
    }

    // Show banner after a delay
    const timer = setTimeout(() => {
      if (isSupported && permission === 'default' && !dismissed) {
        setIsVisible(true);
      }
    }, 5000);

    return () => clearTimeout(timer);
  }, [isSupported, permission]);

  const handleEnable = async () => {
    const granted = await requestPermission();
    if (granted) {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsDismissed(true);
    setIsVisible(false);
    localStorage.setItem('push-permission-dismissed', 'true');
  };

  if (!isVisible || isDismissed) return null;

  return (
    <div className={cn(
      'fixed bottom-20 left-4 right-4 z-50',
      'bg-white rounded-lg shadow-lg border p-4',
      'animate-in slide-in-from-bottom-5'
    )}>
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 p-2 bg-primary/10 rounded-full">
          <Bell className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">알림을 켜시겠어요?</p>
          <p className="text-xs text-muted-foreground mt-1">
            예약 확정, 리마인더 등 중요한 알림을 놓치지 마세요
          </p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="flex gap-2 mt-3">
        <Button
          variant="outline"
          size="sm"
          className="flex-1"
          onClick={handleDismiss}
        >
          나중에
        </Button>
        <Button
          size="sm"
          className="flex-1"
          onClick={handleEnable}
        >
          알림 허용
        </Button>
      </div>
    </div>
  );
}

export default PushPermissionBanner;
```

---

## Environment Variables

**Frontend `.env`:**

```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_VAPID_KEY=your_vapid_key
```

**Backend `.env`:**

```bash
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxx@your_project.iam.gserviceaccount.com
```

---

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/lib/firebase/config.ts` | **CREATE** | Firebase initialization |
| `public/firebase-messaging-sw.js` | **CREATE** | Service worker |
| `src/contexts/PushNotificationContext.tsx` | **CREATE** | Push notification context |
| `src/components/notifications/push-permission-banner.tsx` | **CREATE** | Permission request UI |
| `src/routes/notification.routes.ts` | **MODIFY** | Add token routes |
| `src/controllers/notification.controller.ts` | **MODIFY** | Add token methods |
| `src/services/notification.service.ts` | **MODIFY** | Add token registration |
| `src/app/layout.tsx` | **MODIFY** | Add provider |

---

## Testing Plan

- [ ] Permission request shows correctly
- [ ] Permission granted flow works
- [ ] FCM token generated
- [ ] Token sent to backend
- [ ] Token stored in database
- [ ] Background notification received
- [ ] Foreground notification shows toast
- [ ] Notification click navigates correctly
- [ ] Token refresh works
- [ ] Logout clears token

---

## Deployment Checklist

- [ ] Create Firebase project (if not exists)
- [ ] Generate VAPID key pair
- [ ] Configure Firebase Admin SDK on backend
- [ ] Add all environment variables
- [ ] Create service worker file
- [ ] Implement context and components
- [ ] Add API endpoints
- [ ] Test on staging
- [ ] Test on production domain
- [ ] Verify iOS/Android compatibility
- [ ] Deploy to production

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Token registration success | >90% |
| Push delivery rate | >95% |
| Permission grant rate | >40% |
| Notification click-through | >20% |
