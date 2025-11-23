# Push Notification Toggle API Documentation

## Overview

The backend provides complete endpoints for users to toggle push notifications on/off. The settings are stored in the `user_settings` table in Supabase.

## Database Schema

### `user_settings` Table

The table includes these notification-related fields:

```sql
user_settings
├── id (uuid, PK)
├── user_id (uuid, FK → users.id)
├── push_notifications_enabled (boolean, default: true)  ← Main push toggle
├── reservation_notifications (boolean, default: true)
├── event_notifications (boolean, default: true)
├── marketing_notifications (boolean, default: false)
├── created_at (timestamp)
└── updated_at (timestamp)
```

## API Endpoints

### 1. Get User Notification Settings

**Endpoint:** `GET /api/notifications/settings`
**Alias:** `GET /api/notifications/preferences`

**Authentication:** Required (JWT Bearer token)

**Response:**
```json
{
  "success": true,
  "message": "알림 설정을 조회했습니다.",
  "data": {
    "settings": {
      "userId": "user-uuid",
      "pushEnabled": true,
      "emailEnabled": true,
      "smsEnabled": false,
      "reservationUpdates": true,
      "paymentNotifications": true,
      "promotionalMessages": false,
      "systemAlerts": true,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### 2. Update User Notification Settings

**Endpoint:** `PUT /api/notifications/settings`
**Alias:** `PUT /api/notifications/preferences`

**Authentication:** Required (JWT Bearer token)

**Request Body:**
```json
{
  "pushEnabled": false,
  "reservationUpdates": true,
  "promotionalMessages": false,
  "systemAlerts": true
}
```

**Field Mapping:**

| NotificationSettings Field | user_settings Column | Description |
|---------------------------|---------------------|-------------|
| `pushEnabled` | `push_notifications_enabled` | Master toggle for push notifications |
| `reservationUpdates` | `reservation_notifications` | Reservation-related notifications |
| `promotionalMessages` | `marketing_notifications` | Marketing/promotional messages |
| `systemAlerts` | `event_notifications` | System events and alerts |

**Response:**
```json
{
  "success": true,
  "message": "알림 설정을 업데이트했습니다.",
  "data": {
    "settings": {
      "userId": "user-uuid",
      "pushEnabled": false,
      "emailEnabled": true,
      "smsEnabled": false,
      "reservationUpdates": true,
      "paymentNotifications": true,
      "promotionalMessages": false,
      "systemAlerts": true,
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  },
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

## Implementation Details

### Service Layer

**File:** `src/services/notification.service.ts`

#### `getUserNotificationSettings(userId: string)`

- Fetches settings from `user_settings` table
- Maps database columns to NotificationSettings interface
- Returns default values if no settings exist

#### `updateUserNotificationSettings(userId: string, settings: Partial<NotificationSettings>)`

- Uses `upsert` to create or update settings
- Only updates fields that are provided (partial update)
- Automatically updates `updated_at` timestamp
- Returns the complete updated settings

### Controller Layer

**File:** `src/controllers/notification.controller.ts`

- Validates JWT authentication
- Calls notification service methods
- Returns standardized JSON responses

### Routes

**File:** `src/routes/notification.routes.ts`

- Both `/settings` and `/preferences` routes point to same controller methods
- Rate limiting: 100 requests/15 minutes for GET, 20 requests/15 minutes for PUT
- Requires JWT authentication middleware

## Usage Examples

### Turn OFF Push Notifications

```bash
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pushEnabled": false
  }'
```

### Turn ON Push Notifications

```bash
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pushEnabled": true
  }'
```

### Update Multiple Settings

```bash
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "pushEnabled": true,
    "reservationUpdates": true,
    "promotionalMessages": false,
    "systemAlerts": true
  }'
```

### Get Current Settings

```bash
curl -X GET http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## How It Works

1. **User requests to toggle push notifications** via mobile app/web
2. **Frontend calls** `PUT /api/notifications/settings` with `pushEnabled: false`
3. **Backend updates** `user_settings.push_notifications_enabled = false`
4. **Notification service checks** `push_notifications_enabled` before sending push
5. **If disabled**, push notifications are skipped (user still receives in-app/email if enabled)

## Integration with Push Notification System

When sending push notifications, the system checks the user's settings:

```typescript
// Before sending push notification
const settings = await notificationService.getUserNotificationSettings(userId);

if (!settings.pushEnabled) {
  // Skip push notification
  logger.info('Push notifications disabled for user', { userId });
  return;
}

// Proceed with sending push notification
await firebaseAdmin.messaging().send(message);
```

## Testing

### Via Swagger UI

1. Navigate to http://localhost:3001/api-docs
2. Find "Notifications" section
3. Authenticate with Bearer token
4. Try GET `/api/notifications/settings`
5. Try PUT `/api/notifications/settings` with `{"pushEnabled": false}`

### Via Command Line

```bash
# Get settings
curl -X GET http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_TOKEN"

# Toggle OFF
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushEnabled": false}'

# Toggle ON
curl -X PUT http://localhost:3001/api/notifications/settings \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"pushEnabled": true}'
```

## Frontend Implementation Guide

### Example: React Native

```typescript
import { useAuth } from './hooks/useAuth';

const NotificationSettings = () => {
  const { token } = useAuth();
  const [pushEnabled, setPushEnabled] = useState(true);

  // Load current settings
  useEffect(() => {
    const loadSettings = async () => {
      const response = await fetch('http://api.example.com/api/notifications/settings', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      setPushEnabled(data.data.settings.pushEnabled);
    };
    loadSettings();
  }, [token]);

  // Toggle push notifications
  const togglePush = async (enabled: boolean) => {
    await fetch('http://api.example.com/api/notifications/settings', {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        pushEnabled: enabled
      })
    });
    setPushEnabled(enabled);
  };

  return (
    <Switch
      value={pushEnabled}
      onValueChange={togglePush}
      label="Push Notifications"
    />
  );
};
```

## Security

- ✅ JWT authentication required for all endpoints
- ✅ RLS policies on `user_settings` table (users can only access their own settings)
- ✅ Rate limiting to prevent abuse
- ✅ Input validation via express-validator
- ✅ Secure by default (push notifications enabled by default)

## Notes

- Settings are user-specific and stored per user
- Default value for `push_notifications_enabled` is `true`
- Toggling off push notifications does **not** delete FCM tokens
- Tokens remain in `push_tokens` table but are not used when `pushEnabled = false`
- Users can re-enable push notifications at any time without re-registering tokens
