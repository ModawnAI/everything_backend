# 에뷰리띵 Beauty Platform API - Endpoints Summary

## API Overview

**Base URL:** `http://localhost:3000`  
**API Version:** 1.0.0  
**Documentation:** `http://localhost:3000/api-docs`  
**Health Check:** `http://localhost:3000/health`

## Authentication & Security

### Authentication Endpoints
- **POST** `/api/auth/login` - User login with JWT token generation
- **POST** `/api/auth/register` - User registration (planned)
- **POST** `/api/auth/refresh` - Refresh JWT token (planned)
- **POST** `/api/auth/logout` - User logout (planned)

### Admin Authentication
- **POST** `/api/admin/auth/login` - Admin login
- **POST** `/api/admin/auth/logout` - Admin logout

## User Management

### User Profile
- **GET** `/api/users/profile` - Get user profile
- **PUT** `/api/users/profile` - Update user profile
- **DELETE** `/api/users/profile` - Delete user account

### User Status Management
- **GET** `/api/admin/user-status` - Get user status
- **PUT** `/api/admin/user-status` - Update user status
- **POST** `/api/admin/user-status/verify` - Verify user

### Admin User Management
- **GET** `/api/admin/users` - List all users
- **GET** `/api/admin/users/:id` - Get specific user
- **PUT** `/api/admin/users/:id` - Update user
- **DELETE** `/api/admin/users/:id` - Delete user

## Shop Management

### Shop Operations
- **GET** `/api/shops` - List all shops
- **GET** `/api/shops/:id` - Get specific shop
- **POST** `/api/shops` - Create new shop
- **PUT** `/api/shops/:id` - Update shop
- **DELETE** `/api/shops/:id` - Delete shop

### Shop Owner Operations
- **GET** `/api/shop-owner/profile` - Get shop owner profile
- **PUT** `/api/shop-owner/profile` - Update shop owner profile
- **GET** `/api/shop-owner/shops` - Get owned shops
- **POST** `/api/shop-owner/shops` - Create shop

### Shop Images
- **POST** `/api/shops/:id/images` - Upload shop images
- **GET** `/api/shops/:id/images` - Get shop images
- **DELETE** `/api/shops/:id/images/:imageId` - Delete shop image

### Admin Shop Management
- **GET** `/api/admin/shops` - List all shops (admin)
- **PUT** `/api/admin/shops/:id` - Update shop (admin)
- **DELETE** `/api/admin/shops/:id` - Delete shop (admin)

### Shop Approval
- **GET** `/api/admin/shops/approval` - List pending approvals
- **POST** `/api/admin/shops/approval/:id/approve` - Approve shop
- **POST** `/api/admin/shops/approval/:id/reject` - Reject shop

## Reservation Management

### Reservation Operations
- **GET** `/api/reservations` - List user reservations
- **GET** `/api/reservations/:id` - Get specific reservation
- **POST** `/api/reservations` - Create new reservation
- **PUT** `/api/reservations/:id` - Update reservation
- **DELETE** `/api/reservations/:id` - Cancel reservation

### Reservation Rescheduling
- **POST** `/api/reservations/:id/reschedule` - Reschedule reservation
- **GET** `/api/reservations/:id/available-times` - Get available times

### Conflict Resolution
- **POST** `/api/conflicts` - Report reservation conflict
- **GET** `/api/conflicts` - List conflicts
- **PUT** `/api/conflicts/:id/resolve` - Resolve conflict

### No-Show Detection
- **POST** `/api/admin/no-show/detect` - Detect no-shows
- **GET** `/api/admin/no-show/reports` - Get no-show reports

### Admin Reservation Management
- **GET** `/api/admin/reservations` - List all reservations
- **PUT** `/api/admin/reservations/:id` - Update reservation
- **DELETE** `/api/admin/reservations/:id` - Cancel reservation

## Payment Processing

### Payment Operations
- **POST** `/api/payments` - Process payment
- **GET** `/api/payments/:id` - Get payment details
- **POST** `/api/payments/:id/refund` - Request refund

### Split Payments
- **POST** `/api/split-payments` - Create split payment
- **GET** `/api/split-payments/:id` - Get split payment details
- **PUT** `/api/split-payments/:id/status` - Update split payment status

### Payment Security
- **POST** `/api/payment-security/validate` - Validate payment
- **GET** `/api/payment-security/alerts` - Get security alerts
- **POST** `/api/payment-security/block` - Block suspicious payment

### Admin Payment Management
- **GET** `/api/admin/payments` - List all payments
- **PUT** `/api/admin/payments/:id` - Update payment
- **POST** `/api/admin/payments/:id/refund` - Process refund

## Point System

### Point Operations
- **GET** `/api/points/balance` - Get point balance
- **POST** `/api/points/earn` - Earn points
- **POST** `/api/points/use` - Use points
- **GET** `/api/points/transactions` - Get point transactions

### Point Balance
- **GET** `/api/point-balance` - Get detailed balance
- **GET** `/api/point-balance/history` - Get balance history
- **GET** `/api/point-balance/projection` - Get future projections

### Point Processing (Admin)
- **GET** `/api/admin/point-processing/queue` - Get processing queue
- **POST** `/api/admin/point-processing/process` - Process points
- **PUT** `/api/admin/point-processing/:id/status` - Update processing status

## Influencer & Referral System

### Influencer Bonus
- **POST** `/api/influencer-bonus/claim` - Claim influencer bonus
- **GET** `/api/influencer-bonus/status` - Get bonus status
- **GET** `/api/influencer-bonus/history` - Get bonus history

### Referral System
- **POST** `/api/referrals/generate` - Generate referral code
- **POST** `/api/referrals/use` - Use referral code
- **GET** `/api/referrals/stats` - Get referral statistics

## Notifications

### Notification Management
- **GET** `/api/notifications` - Get user notifications
- **PUT** `/api/notifications/:id/read` - Mark notification as read
- **DELETE** `/api/notifications/:id` - Delete notification
- **POST** `/api/notifications/settings` - Update notification settings

## Storage & File Management

### File Storage
- **POST** `/api/storage/upload` - Upload file
- **GET** `/api/storage/:fileId` - Get file
- **DELETE** `/api/storage/:fileId` - Delete file
- **PUT** `/api/storage/:fileId/move` - Move file

## WebSocket Connections

### Real-time Communication
- **WebSocket** `/api/websocket` - Real-time notifications and updates
- **WebSocket** `/api/websocket/shop/:shopId` - Shop-specific updates
- **WebSocket** `/api/websocket/user/:userId` - User-specific updates

## Analytics & Reporting

### Admin Analytics
- **GET** `/api/admin/analytics/overview` - Get overview statistics
- **GET** `/api/admin/analytics/revenue` - Get revenue analytics
- **GET** `/api/admin/analytics/users` - Get user analytics
- **GET** `/api/admin/analytics/shops` - Get shop analytics

## Admin Adjustments

### System Adjustments
- **POST** `/api/admin/adjustments/points` - Adjust user points
- **POST** `/api/admin/adjustments/payment` - Adjust payment
- **POST** `/api/admin/adjustments/reservation` - Adjust reservation
- **GET** `/api/admin/adjustments/history` - Get adjustment history

## Webhooks

### External Integrations
- **POST** `/api/webhooks/toss-payments` - Toss Payments webhook
- **POST** `/api/webhooks/firebase` - Firebase webhook
- **POST** `/api/webhooks/sms` - SMS service webhook

## Error Responses

All endpoints return consistent error responses:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Error description",
    "timestamp": "2024-01-01T00:00:00Z",
    "path": "/api/endpoint",
    "method": "POST"
  }
}
```

## Success Responses

All endpoints return consistent success responses:

```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation completed successfully"
}
```

## Authentication

Most endpoints require JWT authentication:

```
Authorization: Bearer <jwt-token>
```

## Rate Limiting

- **Guest users:** 50 requests per 15 minutes
- **Authenticated users:** 200 requests per 15 minutes
- **Shop owners:** 500 requests per 15 minutes
- **Admins:** 1000 requests per 15 minutes

## Data Formats

- **Timestamps:** ISO 8601 format (`2024-01-01T00:00:00Z`)
- **Coordinates:** WGS84 decimal degrees
- **Currency:** Korean Won (KRW)
- **IDs:** UUID format

## Testing

### Test Endpoints
- **GET** `/health` - Health check
- **GET** `/` - Welcome message
- **GET** `/api-docs` - API documentation

### Test Data
- Mock shops, users, and reservations available
- Test payment processing with mock Toss Payments
- Simulated notification system

## Development Setup

1. **Start server:** `npm run dev` or `node test-server.js`
2. **View documentation:** `http://localhost:3000/api-docs`
3. **Health check:** `http://localhost:3000/health`
4. **Run tests:** `npm test`

---

**Last Updated:** July 30, 2024  
**API Version:** 1.0.0  
**Total Endpoints:** 80+ endpoints across 15 categories 