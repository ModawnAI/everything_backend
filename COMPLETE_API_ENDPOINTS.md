# Complete API Endpoints List

## 🚀 에뷰리띵 Beauty Platform API

This document lists all available API endpoints organized by functionality.

**Base URL**: `http://localhost:3000`

**Interactive Documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

---

## 📋 Authentication Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/auth/register` | Register a new user |
| `POST` | `/api/auth/login` | User login |
| `POST` | `/api/auth/refresh` | Refresh access token |
| `POST` | `/api/auth/logout` | User logout |

---

## 👤 User Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/users/profile` | Get user profile |
| `PUT` | `/api/users/profile` | Update user profile |

---

## 🏪 Shop Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/shops` | Get all shops |
| `GET` | `/api/shops/{id}` | Get shop by ID |

---

## 📅 Reservation Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/reservations` | Create a new reservation |
| `GET` | `/api/reservations` | Get user reservations |

---

## 💳 Payment Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/payments` | Process payment |

---

## 🎯 Points System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/points/balance` | Get user point balance |

---

## 🔔 Notification Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/notifications` | Get user notifications |

---

## 📁 Storage Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/storage/upload` | Upload file |

---

## 🔌 WebSocket Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/websocket/connect` | Connect to WebSocket |

---

## 📊 Analytics Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/analytics/dashboard` | Get analytics dashboard data |

---

## 👨‍💼 Admin Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/admin/users` | Get all users (admin only) |

---

## 🌟 Influencer Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/influencer/bonus` | Get influencer bonus information |

---

## 🔒 Security Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/payment-security/fraud-detection` | Perform fraud detection |

---

## 🏥 Health & System Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/health` | Health check |
| `GET` | `/` | API welcome page |
| `GET` | `/api-docs` | Swagger UI documentation |
| `GET` | `/api/openapi.json` | OpenAPI specification |

---

## 📚 Full Backend System Endpoints

The complete backend system includes **80+ endpoints** across these categories:

### Authentication & Authorization
- User registration, login, logout
- Token refresh and management
- Social authentication (Google, Apple, Kakao)
- Phone verification

### User Management
- Profile management
- User status workflows
- Account verification
- User preferences

### Shop Management
- Shop CRUD operations
- Shop approval workflows
- Shop owner management
- Shop services and pricing
- Shop images and media

### Reservation System
- Reservation creation and management
- Time slot management
- Reservation rescheduling
- Conflict resolution
- No-show detection

### Payment Processing
- Payment processing via Toss Payments
- Split payment support
- Payment confirmation
- Refund management
- Payment retry logic
- Payment security and fraud detection

### Points System
- Point balance management
- Point transactions
- FIFO point usage
- Point adjustments
- Influencer bonus system

### Notification System
- Push notifications via FCM
- Notification history
- Notification preferences
- Real-time notifications

### Storage & File Management
- File upload and management
- Image processing
- Storage policies

### WebSocket Communication
- Real-time updates
- Live chat support
- Status updates

### Analytics & Reporting
- Dashboard analytics
- Business intelligence
- Performance metrics
- Custom reports

### Admin Panel
- User management
- Shop approval workflows
- Payment management
- System adjustments
- Analytics and reporting

### Security & Monitoring
- Fraud detection
- Security monitoring
- Error handling
- Compliance reporting

---

## 🔐 Authentication

All protected endpoints require a JWT token in the Authorization header:

```
Authorization: Bearer <your-jwt-token>
```

## 📊 Rate Limiting

- **Guest users**: 50 requests per 15 minutes
- **Authenticated users**: 200 requests per 15 minutes
- **Shop owners**: 500 requests per 15 minutes
- **Admins**: 1000 requests per 15 minutes

## 📝 Response Format

All API responses follow a consistent format:

```json
{
  "success": true,
  "message": "Operation completed successfully",
  "data": {
    // Response data
  }
}
```

## 🚨 Error Handling

Errors follow a standardized format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:00:00Z"
  }
}
```

---

## 🌐 Interactive Documentation

**Visit the interactive Swagger documentation**: [http://localhost:3000/api-docs](http://localhost:3000/api-docs)

This provides:
- Complete API documentation
- Interactive testing interface
- Request/response examples
- Authentication setup
- Schema definitions

---

## 📋 OpenAPI Specification

**Download the OpenAPI spec**: [http://localhost:3000/api/openapi.json](http://localhost:3000/api/openapi.json)

This can be imported into:
- Postman
- Insomnia
- Other API testing tools
- Code generation tools

---

*This API provides a comprehensive solution for beauty service booking platforms with advanced features including real-time communication, secure payments, and extensive admin controls.* 