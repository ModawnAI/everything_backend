# Admin API Documentation - Complete Endpoint Reference

**Base URL**: `http://localhost:3001`
**API Prefix**: `/api/admin`

---

## Table of Contents

1. [Authentication](#authentication)
2. [Dashboard & Statistics](#dashboard--statistics)
3. [User Management](#user-management)
4. [Shop Management](#shop-management)
5. [Shop Services](#shop-services)
6. [Shop Moderation](#shop-moderation)
7. [Booking Management](#booking-management)
8. [Financial Management](#financial-management)
   - [Payments](#payments)
   - [Points](#points)
   - [Refunds](#refunds)
9. [Content Management](#content-management)
10. [System Configuration](#system-configuration)
11. [Audit Logs](#audit-logs)
12. [Notifications](#notifications)
13. [Reports & Analytics](#reports--analytics)

---

## Authentication

### 1. Admin Login
```http
POST /api/admin/auth/login
Content-Type: application/json

Request Body:
{
  "email": "admin@ebeautything.com",
  "password": "Admin123!"
}

Response 200:
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "admin": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "admin@ebeautything.com",
      "name": "Admin User",
      "role": "SUPER_ADMIN",
      "permissions": ["ALL"],
      "lastLogin": "2025-01-15T10:30:00.000Z"
    }
  }
}

Response 401:
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid email or password"
  }
}
```

**Frontend Example:**
```javascript
async function adminLogin(email, password) {
  const response = await fetch('http://localhost:3001/api/admin/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem('adminToken', data.data.token);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    return data.data.admin;
  }
  throw new Error(data.error.message);
}
```

### 2. Logout
```http
POST /api/admin/auth/logout
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "refreshToken": "your_refresh_token_here"
}

Response 200:
{
  "success": true,
  "message": "Successfully logged out"
}
```

**Frontend Example:**
```javascript
async function adminLogout() {
  const token = localStorage.getItem('adminToken');
  const refreshToken = localStorage.getItem('refreshToken');

  await fetch('http://localhost:3001/api/admin/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });

  localStorage.removeItem('adminToken');
  localStorage.removeItem('refreshToken');
}
```

### 3. Refresh Token
```http
POST /api/admin/auth/refresh
Authorization: Bearer <old_token>
Content-Type: application/json

Request Body:
{
  "refreshToken": "your_refresh_token_here"
}

Response 200:
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}

Response 401:
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Invalid or expired refresh token"
  }
}
```

**Frontend Example:**
```javascript
async function refreshAdminToken() {
  const oldToken = localStorage.getItem('adminToken');
  const refreshToken = localStorage.getItem('refreshToken');

  const response = await fetch('http://localhost:3001/api/admin/auth/refresh', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${oldToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ refreshToken })
  });

  const data = await response.json();
  if (data.success) {
    localStorage.setItem('adminToken', data.data.token);
    localStorage.setItem('refreshToken', data.data.refreshToken);
    return data.data.token;
  }
  throw new Error('Token refresh failed');
}
```

### 4. Get Current Admin Profile
```http
GET /api/admin/auth/profile
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "admin@ebeautything.com",
    "name": "Admin User",
    "role": "SUPER_ADMIN",
    "permissions": ["ALL"],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "lastLogin": "2025-01-15T10:30:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function getAdminProfile() {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/auth/profile', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return (await response.json()).data;
}
```

### 5. Change Password
```http
POST /api/admin/auth/change-password
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "currentPassword": "OldPassword123!",
  "newPassword": "NewPassword123!",
  "confirmPassword": "NewPassword123!"
}

Response 200:
{
  "success": true,
  "message": "Password changed successfully"
}

Response 400:
{
  "success": false,
  "error": {
    "code": "INVALID_PASSWORD",
    "message": "Current password is incorrect"
  }
}
```

**Frontend Example:**
```javascript
async function changeAdminPassword(currentPassword, newPassword, confirmPassword) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ currentPassword, newPassword, confirmPassword })
  });
  return await response.json();
}
```

### 6. Validate Token
```http
GET /api/admin/auth/validate
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "valid": true,
    "expiresAt": "2025-01-15T12:00:00.000Z"
  }
}

Response 401:
{
  "success": false,
  "error": {
    "code": "INVALID_TOKEN",
    "message": "Token is invalid or expired"
  }
}
```

**Frontend Example:**
```javascript
async function validateToken() {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/auth/validate', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await response.json();
  return data.success && data.data.valid;
}
```

---

## Dashboard & Statistics

### 1. Get Dashboard Overview
```http
GET /api/admin/dashboard/overview?period=30d
Authorization: Bearer <token>

Query Parameters:
- period: 7d | 30d | 90d | 1y | all (default: 30d)

Response 200:
{
  "success": true,
  "data": {
    "users": {
      "total": 10000,
      "active": 8500,
      "new": 250,
      "growth": 5.2
    },
    "shops": {
      "total": 500,
      "active": 450,
      "pending": 20,
      "suspended": 30
    },
    "bookings": {
      "total": 5000,
      "completed": 4500,
      "cancelled": 300,
      "pending": 200
    },
    "revenue": {
      "total": 500000000,
      "commission": 50000000,
      "growth": 12.5
    },
    "topShops": [
      {
        "id": "uuid",
        "name": "Top Beauty Shop",
        "revenue": 10000000,
        "bookings": 500
      }
    ],
    "recentActivity": [
      {
        "type": "booking",
        "description": "New booking created",
        "timestamp": "2025-01-15T10:30:00.000Z"
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
async function getDashboardOverview(period = '30d') {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/dashboard/overview?period=${period}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get Real-time Statistics
```http
GET /api/admin/dashboard/stats/realtime
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "activeUsers": 1250,
    "ongoingBookings": 45,
    "pendingPayments": 12,
    "systemLoad": {
      "cpu": 45.2,
      "memory": 62.8,
      "requests": 1500
    }
  }
}
```

**Frontend Example:**
```javascript
async function getRealtimeStats() {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/dashboard/stats/realtime', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return (await response.json()).data;
}
```

---

## User Management

**⚠️ Note**: User management endpoints are handled by an **external backend service**.
Configure `NEXT_PUBLIC_EXTERNAL_API_URL` in your environment.

### 1. List Users
```http
GET /api/admin/users?page=1&limit=20&status=active&search=john
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: active | suspended | deleted | all
- search: string (search by name, email, phone)
- role: user | shop_owner | admin
- sortBy: createdAt | lastLogin | name | email
- sortOrder: asc | desc

Response 200:
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "uuid",
        "email": "user@example.com",
        "name": "John Doe",
        "phone": "+82-10-1234-5678",
        "status": "active",
        "role": "user",
        "emailVerified": true,
        "phoneVerified": true,
        "createdAt": "2025-01-01T00:00:00.000Z",
        "lastLogin": "2025-01-15T10:00:00.000Z",
        "totalBookings": 25,
        "totalSpent": 500000
      }
    ],
    "pagination": {
      "total": 10000,
      "page": 1,
      "limit": 20,
      "totalPages": 500
    }
  }
}
```

**Frontend Example:**
```javascript
async function getUsers(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/users?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get User Details
```http
GET /api/admin/users/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe",
    "phone": "+82-10-1234-5678",
    "status": "active",
    "role": "user",
    "emailVerified": true,
    "phoneVerified": true,
    "profileImage": "https://...",
    "address": {
      "street": "123 Main St",
      "city": "Seoul",
      "zipCode": "12345"
    },
    "stats": {
      "totalBookings": 25,
      "completedBookings": 23,
      "cancelledBookings": 2,
      "totalSpent": 500000,
      "averageRating": 4.5
    },
    "recentBookings": [...],
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "lastLogin": "2025-01-15T10:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function getUserDetails(userId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return (await response.json()).data;
}
```

### 3. Create User
```http
POST /api/admin/users
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "email": "newuser@example.com",
  "password": "SecurePass123!",
  "name": "Jane Smith",
  "phone": "+82-10-9876-5432",
  "role": "user",
  "emailVerified": false,
  "phoneVerified": false
}

Response 201:
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "email": "newuser@example.com",
    "name": "Jane Smith",
    "role": "user",
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function createUser(userData) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/users', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(userData)
  });
  return (await response.json()).data;
}
```

### 4. Update User
```http
PATCH /api/admin/users/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "name": "Updated Name",
  "phone": "+82-10-1111-2222",
  "status": "active",
  "emailVerified": true
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Name",
    "phone": "+82-10-1111-2222",
    "status": "active",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function updateUser(userId, updates) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  return (await response.json()).data;
}
```

### 5. Delete User
```http
DELETE /api/admin/users/:id?permanent=false
Authorization: Bearer <token>

Query Parameters:
- permanent: boolean (default: false) - soft delete vs permanent delete

Response 200:
{
  "success": true,
  "message": "User deleted successfully"
}
```

**Frontend Example:**
```javascript
async function deleteUser(userId, permanent = false) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/users/${userId}?permanent=${permanent}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
}
```

### 6. Suspend/Unsuspend User
```http
POST /api/admin/users/:id/suspend
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "reason": "Violation of terms of service",
  "duration": 30,
  "notes": "Repeated inappropriate behavior"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "suspended",
    "suspendedUntil": "2025-02-15T00:00:00.000Z",
    "suspensionReason": "Violation of terms of service"
  }
}

POST /api/admin/users/:id/unsuspend
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active"
  }
}
```

**Frontend Example:**
```javascript
async function suspendUser(userId, reason, duration, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/suspend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, duration, notes })
  });
  return (await response.json()).data;
}

async function unsuspendUser(userId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/users/${userId}/unsuspend`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return (await response.json()).data;
}
```

### 7. Get User Bookings
```http
GET /api/admin/users/:id/bookings?page=1&limit=10&status=completed
Authorization: Bearer <token>

Query Parameters:
- page: number
- limit: number
- status: pending | confirmed | completed | cancelled

Response 200:
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "serviceId": "uuid",
        "serviceName": "Hair Cut",
        "date": "2025-01-20T14:00:00.000Z",
        "status": "completed",
        "amount": 50000,
        "createdAt": "2025-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 25,
      "page": 1,
      "limit": 10,
      "totalPages": 3
    }
  }
}
```

**Frontend Example:**
```javascript
async function getUserBookings(userId, params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/users/${userId}/bookings?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 8. User Statistics
```http
GET /api/admin/user-status/stats?period=30d
Authorization: Bearer <token>

Query Parameters:
- period: 7d | 30d | 90d | all (default: 30d)

Response 200:
{
  "success": true,
  "data": {
    "totalUsers": 10000,
    "activeUsers": 8000,
    "suspendedUsers": 150,
    "deletedUsers": 1850,
    "newUsersThisPeriod": 500,
    "growth": {
      "percentage": 5.2,
      "trend": "up"
    },
    "statusBreakdown": {
      "ACTIVE": 8000,
      "SUSPENDED": 150,
      "PENDING": 50,
      "DELETED": 1850
    },
    "roleBreakdown": {
      "user": 9500,
      "shop_owner": 450,
      "admin": 50
    }
  }
}
```

**Frontend Example:**
```javascript
async function getUserStats(period = '30d') {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/user-status/stats?period=${period}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

---

## Shop Management

### 1. List Shops
```http
GET /api/admin/shops?page=1&limit=20&status=active&search=beauty
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: active | pending | suspended | rejected | all
- search: string (search by name, description)
- category: uuid (filter by category)
- city: string (filter by city)
- sortBy: createdAt | name | rating | bookings
- sortOrder: asc | desc

Response 200:
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "uuid",
        "name": "Beauty Shop A",
        "description": "Premium beauty services",
        "ownerId": "uuid",
        "ownerName": "Shop Owner",
        "status": "active",
        "rating": 4.5,
        "totalReviews": 250,
        "totalBookings": 1500,
        "category": "Beauty Salon",
        "address": {
          "street": "123 Beauty St",
          "city": "Seoul",
          "zipCode": "12345"
        },
        "phone": "+82-10-1234-5678",
        "images": ["url1", "url2"],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "approvedAt": "2024-01-02T00:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 500,
      "page": 1,
      "limit": 20,
      "totalPages": 25
    }
  }
}
```

**Frontend Example:**
```javascript
async function getShops(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/shops?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get Shop Details
```http
GET /api/admin/shops/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Beauty Shop A",
    "description": "Premium beauty services",
    "ownerId": "uuid",
    "owner": {
      "id": "uuid",
      "name": "Shop Owner",
      "email": "owner@example.com",
      "phone": "+82-10-1234-5678"
    },
    "status": "active",
    "rating": 4.5,
    "totalReviews": 250,
    "totalBookings": 1500,
    "revenue": 50000000,
    "category": "Beauty Salon",
    "address": {
      "street": "123 Beauty St",
      "city": "Seoul",
      "district": "Gangnam",
      "zipCode": "12345",
      "coordinates": {
        "lat": 37.5665,
        "lng": 126.9780
      }
    },
    "phone": "+82-10-1234-5678",
    "email": "shop@example.com",
    "images": ["url1", "url2", "url3"],
    "businessHours": {
      "monday": { "open": "09:00", "close": "21:00" },
      "tuesday": { "open": "09:00", "close": "21:00" }
    },
    "services": [
      {
        "id": "uuid",
        "name": "Hair Cut",
        "price": 50000,
        "duration": 60
      }
    ],
    "documents": {
      "businessLicense": "url",
      "verified": true
    },
    "createdAt": "2024-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z",
    "approvedAt": "2024-01-02T00:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function getShopDetails(shopId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/shops/${shopId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  return (await response.json()).data;
}
```

### 3. Update Shop
```http
PUT /api/admin/shops/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "name": "Updated Shop Name",
  "description": "Updated description",
  "phone": "+82-10-9999-8888",
  "status": "active"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "Updated Shop Name",
    "description": "Updated description",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function updateShop(shopId, updates) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/shops/${shopId}`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(updates)
  });
  return (await response.json()).data;
}
```

### 4. Approve/Reject Shop
```http
POST /api/admin/shops/:id/approve
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "notes": "All requirements met"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved",
    "approvedAt": "2025-01-15T11:00:00.000Z",
    "approvedBy": "admin-uuid"
  }
}

POST /api/admin/shops/:id/reject
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "reason": "Incomplete business license",
  "notes": "Please provide valid business license"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "rejected",
    "rejectedAt": "2025-01-15T11:00:00.000Z",
    "rejectionReason": "Incomplete business license"
  }
}
```

**Frontend Example:**
```javascript
async function approveShop(shopId, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/shops/${shopId}/approve`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ notes })
  });
  return (await response.json()).data;
}

async function rejectShop(shopId, reason, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/shops/${shopId}/reject`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, notes })
  });
  return (await response.json()).data;
}
```

### 5. Suspend/Unsuspend Shop
```http
POST /api/admin/shops/:id/suspend
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "reason": "Violation of policies",
  "duration": 30,
  "notes": "Multiple customer complaints"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "suspended",
    "suspendedUntil": "2025-02-15T00:00:00.000Z",
    "suspensionReason": "Violation of policies"
  }
}

POST /api/admin/shops/:id/unsuspend
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "active"
  }
}
```

**Frontend Example:**
```javascript
async function suspendShop(shopId, reason, duration, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(`http://localhost:3001/api/admin/shops/${shopId}/suspend`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ reason, duration, notes })
  });
  return (await response.json()).data;
}
```

### 6. Delete Shop
```http
DELETE /api/admin/shops/:id?permanent=false
Authorization: Bearer <token>

Query Parameters:
- permanent: boolean (default: false)

Response 200:
{
  "success": true,
  "message": "Shop deleted successfully"
}
```

**Frontend Example:**
```javascript
async function deleteShop(shopId, permanent = false) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/shops/${shopId}?permanent=${permanent}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
}
```

### 7. Get Shop Statistics
```http
GET /api/admin/shops/:id/stats?period=30d
Authorization: Bearer <token>

Query Parameters:
- period: 7d | 30d | 90d | all

Response 200:
{
  "success": true,
  "data": {
    "bookings": {
      "total": 500,
      "completed": 450,
      "cancelled": 30,
      "pending": 20
    },
    "revenue": {
      "total": 25000000,
      "commission": 2500000,
      "net": 22500000
    },
    "rating": {
      "average": 4.5,
      "totalReviews": 250,
      "distribution": {
        "5": 150,
        "4": 70,
        "3": 20,
        "2": 5,
        "1": 5
      }
    },
    "performance": {
      "averageResponseTime": 15,
      "cancellationRate": 6.0,
      "repeatCustomerRate": 35.0
    }
  }
}
```

**Frontend Example:**
```javascript
async function getShopStats(shopId, period = '30d') {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/shops/${shopId}/stats?period=${period}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

---

## Shop Services

### 1. Get All Shop Services
```http
GET /api/admin/shop-services?page=1&limit=20&shopId=xxx&isActive=true
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- shopId: uuid (filter by shop)
- serviceId: uuid (filter by service)
- isActive: boolean
- minPrice: number
- maxPrice: number

Response 200:
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "serviceId": "uuid",
        "serviceName": "Hair Cut",
        "price": 50000,
        "duration": 60,
        "isActive": true,
        "description": "Professional hair cutting service",
        "images": ["url1", "url2"],
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-01-15T10:00:00.000Z"
      }
    ],
    "pagination": {
      "total": 1000,
      "page": 1,
      "limit": 20,
      "totalPages": 50
    }
  }
}
```

**Frontend Example:**
```javascript
async function getShopServices(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-services?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get Shop Service Details
```http
GET /api/admin/shop-services/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "shopId": "uuid",
    "shopName": "Beauty Shop A",
    "serviceId": "uuid",
    "serviceName": "Hair Cut",
    "price": 50000,
    "duration": 60,
    "isActive": true,
    "description": "Professional hair cutting service",
    "images": ["url1", "url2"],
    "bookingStats": {
      "total": 500,
      "thisMonth": 50
    },
    "createdAt": "2025-01-01T00:00:00.000Z",
    "updatedAt": "2025-01-15T10:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function getShopServiceDetails(serviceId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-services/${serviceId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 3. Create Shop Service
```http
POST /api/admin/shop-services
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "shopId": "uuid",
  "serviceId": "uuid",
  "price": 50000,
  "duration": 60,
  "isActive": true,
  "description": "Professional hair cutting service",
  "images": ["url1", "url2"]
}

Response 201:
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "shopId": "uuid",
    "serviceId": "uuid",
    "price": 50000,
    "duration": 60,
    "isActive": true,
    "createdAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function createShopService(serviceData) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/shop-services', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(serviceData)
  });
  return (await response.json()).data;
}
```

### 4. Update Shop Service
```http
PUT /api/admin/shop-services/:id
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "price": 60000,
  "duration": 90,
  "isActive": false,
  "description": "Updated description"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "price": 60000,
    "duration": 90,
    "isActive": false,
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function updateShopService(serviceId, updates) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-services/${serviceId}`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    }
  );
  return (await response.json()).data;
}
```

### 5. Delete Shop Service
```http
DELETE /api/admin/shop-services/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "message": "Shop service deleted successfully"
}
```

**Frontend Example:**
```javascript
async function deleteShopService(serviceId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-services/${serviceId}`,
    {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }
  );
  return await response.json();
}
```

---

## Shop Moderation

### 1. Get Moderation History
```http
GET /api/admin/shop-moderation/history?shopId=<uuid>&page=1&limit=20
Authorization: Bearer <token>

Query Parameters:
- shopId: uuid (required)
- page: number (default: 1)
- limit: number (default: 20)
- action: APPROVED | REJECTED | SUSPENDED | REVIEWED

Response 200:
{
  "success": true,
  "data": {
    "history": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "action": "APPROVED",
        "reason": "All requirements met",
        "moderatorId": "uuid",
        "moderatorName": "Admin User",
        "previousStatus": "PENDING",
        "newStatus": "APPROVED",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "metadata": {
          "notes": "Business license verified",
          "documentsChecked": ["business_license", "tax_certificate"]
        }
      }
    ],
    "pagination": {
      "total": 50,
      "page": 1,
      "limit": 20,
      "totalPages": 3
    }
  }
}
```

**Frontend Example:**
```javascript
async function getModerationHistory(shopId, params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams({ ...params, shopId }).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-moderation/history?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get Pending Moderations
```http
GET /api/admin/shop-moderation/pending?page=1&limit=20
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "uuid",
        "name": "New Beauty Shop",
        "ownerId": "uuid",
        "ownerName": "Shop Owner",
        "status": "pending",
        "submittedAt": "2025-01-15T09:00:00.000Z",
        "documents": {
          "businessLicense": "url",
          "taxCertificate": "url"
        }
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    }
  }
}
```

**Frontend Example:**
```javascript
async function getPendingModerations(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/shop-moderation/pending?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

---

## Booking Management

### 1. List All Bookings
```http
GET /api/admin/bookings?page=1&limit=20&status=confirmed
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: pending | confirmed | completed | cancelled | no_show
- userId: uuid
- shopId: uuid
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- sortBy: createdAt | bookingDate | amount
- sortOrder: asc | desc

Response 200:
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "John Doe",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "serviceId": "uuid",
        "serviceName": "Hair Cut",
        "bookingDate": "2025-01-20T14:00:00.000Z",
        "status": "confirmed",
        "amount": 50000,
        "paymentStatus": "paid",
        "createdAt": "2025-01-15T10:00:00.000Z",
        "notes": "Customer notes"
      }
    ],
    "pagination": {
      "total": 5000,
      "page": 1,
      "limit": 20,
      "totalPages": 250
    },
    "summary": {
      "totalBookings": 5000,
      "totalRevenue": 250000000,
      "statusCounts": {
        "pending": 200,
        "confirmed": 1500,
        "completed": 3000,
        "cancelled": 300
      }
    }
  }
}
```

**Frontend Example:**
```javascript
async function getBookings(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/bookings?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Get Booking Details
```http
GET /api/admin/bookings/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "user@example.com",
      "phone": "+82-10-1234-5678"
    },
    "shop": {
      "id": "uuid",
      "name": "Beauty Shop A",
      "address": "123 Beauty St, Seoul"
    },
    "service": {
      "id": "uuid",
      "name": "Hair Cut",
      "duration": 60
    },
    "bookingDate": "2025-01-20T14:00:00.000Z",
    "status": "confirmed",
    "amount": 50000,
    "paymentStatus": "paid",
    "paymentMethod": "card",
    "notes": "Customer notes",
    "createdAt": "2025-01-15T10:00:00.000Z",
    "confirmedAt": "2025-01-15T10:05:00.000Z",
    "history": [
      {
        "status": "pending",
        "timestamp": "2025-01-15T10:00:00.000Z"
      },
      {
        "status": "confirmed",
        "timestamp": "2025-01-15T10:05:00.000Z"
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
async function getBookingDetails(bookingId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/bookings/${bookingId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 3. Update Booking Status
```http
PATCH /api/admin/bookings/:id/status
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "status": "cancelled",
  "reason": "Customer request",
  "notes": "Rescheduling required"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "cancelled",
    "updatedAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function updateBookingStatus(bookingId, status, reason, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/bookings/${bookingId}/status`,
    {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status, reason, notes })
    }
  );
  return (await response.json()).data;
}
```

### 4. Cancel Booking (with refund)
```http
POST /api/admin/bookings/:id/cancel
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "reason": "Customer request",
  "refundAmount": 50000,
  "refundReason": "Full refund due to shop closure",
  "notifyUser": true
}

Response 200:
{
  "success": true,
  "data": {
    "bookingId": "uuid",
    "status": "cancelled",
    "refundId": "refund-uuid",
    "refundAmount": 50000,
    "refundStatus": "pending"
  }
}
```

**Frontend Example:**
```javascript
async function cancelBooking(bookingId, reason, refundAmount, refundReason, notifyUser = true) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/bookings/${bookingId}/cancel`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ reason, refundAmount, refundReason, notifyUser })
    }
  );
  return (await response.json()).data;
}
```

---

## Financial Management

### Payments

#### 1. Get All Payments
```http
GET /api/admin/financial/payments?page=1&limit=20&status=COMPLETED
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: PENDING | COMPLETED | FAILED | REFUNDED
- userId: uuid
- shopId: uuid
- paymentMethod: CARD | TRANSFER | POINTS | VIRTUAL_ACCOUNT
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- minAmount: number
- maxAmount: number
- sortBy: createdAt | amount | status
- sortOrder: asc | desc

Response 200:
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "John Doe",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "bookingId": "uuid",
        "amount": 50000,
        "status": "COMPLETED",
        "paymentMethod": "CARD",
        "transactionId": "toss-txn-12345",
        "createdAt": "2025-01-15T10:30:00.000Z",
        "completedAt": "2025-01-15T10:31:00.000Z",
        "metadata": {
          "cardType": "credit",
          "cardNumber": "****1234"
        }
      }
    ],
    "pagination": {
      "total": 5000,
      "page": 1,
      "limit": 20,
      "totalPages": 250
    },
    "summary": {
      "totalAmount": 250000000,
      "completedCount": 4500,
      "pendingCount": 300,
      "failedCount": 150,
      "refundedCount": 50
    }
  }
}
```

**Frontend Example:**
```javascript
async function getPayments(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/payments?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

#### 2. Get Payment Details
```http
GET /api/admin/financial/payments/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "user@example.com"
    },
    "shop": {
      "id": "uuid",
      "name": "Beauty Shop A"
    },
    "booking": {
      "id": "uuid",
      "serviceName": "Hair Cut",
      "bookingDate": "2025-01-20T14:00:00.000Z"
    },
    "amount": 50000,
    "commission": 5000,
    "netAmount": 45000,
    "status": "COMPLETED",
    "paymentMethod": "CARD",
    "transactionId": "toss-txn-12345",
    "createdAt": "2025-01-15T10:30:00.000Z",
    "completedAt": "2025-01-15T10:31:00.000Z",
    "metadata": {
      "cardType": "credit",
      "cardNumber": "****1234",
      "installment": 0
    },
    "history": [
      {
        "status": "PENDING",
        "timestamp": "2025-01-15T10:30:00.000Z"
      },
      {
        "status": "COMPLETED",
        "timestamp": "2025-01-15T10:31:00.000Z"
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
async function getPaymentDetails(paymentId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/payments/${paymentId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

#### 3. Export Payments
```http
GET /api/admin/financial/payments/export?format=csv&startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>

Query Parameters:
- format: csv | xlsx | pdf
- startDate: ISO 8601 date (required)
- endDate: ISO 8601 date (required)
- status: filter by status
- shopId: filter by shop

Response 200:
Content-Type: text/csv or application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
[File Download]
```

**Frontend Example:**
```javascript
async function exportPayments(format, startDate, endDate, filters = {}) {
  const token = localStorage.getItem('adminToken');
  const params = new URLSearchParams({ format, startDate, endDate, ...filters });
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/payments/export?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payments-${startDate}-${endDate}.${format}`;
  a.click();
}
```

### Points

#### 1. Get Points Transactions
```http
GET /api/admin/financial/points?userId=<uuid>&page=1&limit=20
Authorization: Bearer <token>

Query Parameters:
- userId: uuid (optional)
- page: number (default: 1)
- limit: number (default: 20)
- transactionType: EARN | SPEND | REFUND | EXPIRE | ADMIN_ADJUSTMENT
- startDate: ISO 8601 date
- endDate: ISO 8601 date

Response 200:
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "John Doe",
        "amount": 1000,
        "type": "EARN",
        "description": "Booking completion bonus",
        "balance": 5000,
        "createdAt": "2025-01-15T10:30:00.000Z",
        "expiresAt": "2026-01-15T10:30:00.000Z",
        "relatedBookingId": "uuid"
      }
    ],
    "currentBalance": 5000,
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

**Frontend Example:**
```javascript
async function getPointsTransactions(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/points?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

#### 2. Adjust User Points (Admin)
```http
POST /api/admin/financial/points/adjust
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "userId": "uuid",
  "amount": 5000,
  "type": "EARN",
  "reason": "Compensation for service issue",
  "expiresAt": "2026-01-15T00:00:00.000Z"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "uuid",
    "userId": "uuid",
    "amount": 5000,
    "type": "EARN",
    "newBalance": 10000,
    "createdAt": "2025-01-15T11:00:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function adjustUserPoints(userId, amount, type, reason, expiresAt) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/financial/points/adjust', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ userId, amount, type, reason, expiresAt })
  });
  return (await response.json()).data;
}
```

#### 3. Get Points Statistics
```http
GET /api/admin/financial/points/stats?period=30d
Authorization: Bearer <token>

Query Parameters:
- period: 7d | 30d | 90d | all

Response 200:
{
  "success": true,
  "data": {
    "totalPointsIssued": 50000000,
    "totalPointsRedeemed": 35000000,
    "totalPointsExpired": 5000000,
    "activePoints": 10000000,
    "averagePointsPerUser": 1000,
    "topEarners": [
      {
        "userId": "uuid",
        "userName": "John Doe",
        "totalEarned": 50000
      }
    ]
  }
}
```

**Frontend Example:**
```javascript
async function getPointsStats(period = '30d') {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/points/stats?period=${period}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### Refunds

#### 1. Get All Refunds
```http
GET /api/admin/financial/refunds?page=1&limit=20&status=PENDING
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- status: PENDING | APPROVED | REJECTED | COMPLETED
- paymentId: uuid
- userId: uuid
- shopId: uuid
- startDate: ISO 8601 date
- endDate: ISO 8601 date

Response 200:
{
  "success": true,
  "data": {
    "refunds": [
      {
        "id": "uuid",
        "paymentId": "uuid",
        "userId": "uuid",
        "userName": "John Doe",
        "shopId": "uuid",
        "shopName": "Beauty Shop A",
        "amount": 50000,
        "reason": "Customer request",
        "status": "PENDING",
        "requestedAt": "2025-01-15T10:30:00.000Z",
        "processedAt": null,
        "processedBy": null
      }
    ],
    "pagination": {
      "total": 150,
      "page": 1,
      "limit": 20,
      "totalPages": 8
    },
    "summary": {
      "pendingCount": 50,
      "approvedCount": 80,
      "rejectedCount": 15,
      "completedCount": 5,
      "totalAmount": 7500000
    }
  }
}
```

**Frontend Example:**
```javascript
async function getRefunds(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/refunds?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

#### 2. Get Refund Details
```http
GET /api/admin/financial/refunds/:id
Authorization: Bearer <token>

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "payment": {
      "id": "uuid",
      "amount": 50000,
      "transactionId": "toss-txn-12345",
      "paymentMethod": "CARD"
    },
    "user": {
      "id": "uuid",
      "name": "John Doe",
      "email": "user@example.com"
    },
    "shop": {
      "id": "uuid",
      "name": "Beauty Shop A"
    },
    "booking": {
      "id": "uuid",
      "serviceName": "Hair Cut",
      "bookingDate": "2025-01-20T14:00:00.000Z"
    },
    "amount": 50000,
    "reason": "Customer request - service not provided",
    "refundType": "FULL",
    "status": "PENDING",
    "requestedAt": "2025-01-15T10:30:00.000Z",
    "processedAt": null,
    "processedBy": null,
    "notes": "",
    "attachments": ["url1", "url2"]
  }
}
```

**Frontend Example:**
```javascript
async function getRefundDetails(refundId) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/refunds/${refundId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

#### 3. Create Refund
```http
POST /api/admin/financial/refunds
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "paymentId": "uuid",
  "amount": 50000,
  "reason": "Customer request - service not provided",
  "refundType": "FULL",
  "notes": "Customer complained about service quality"
}

Response 201:
{
  "success": true,
  "data": {
    "id": "new-uuid",
    "paymentId": "uuid",
    "amount": 50000,
    "reason": "Customer request - service not provided",
    "status": "PENDING",
    "requestedAt": "2025-01-15T10:30:00.000Z"
  }
}
```

**Frontend Example:**
```javascript
async function createRefund(paymentId, amount, reason, refundType, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch('http://localhost:3001/api/admin/financial/refunds', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ paymentId, amount, reason, refundType, notes })
  });
  return (await response.json()).data;
}
```

#### 4. Process Refund (Approve/Reject)
```http
PUT /api/admin/financial/refunds/:id/process
Authorization: Bearer <token>
Content-Type: application/json

Request Body:
{
  "action": "APPROVE",
  "notes": "Refund approved as per policy"
}

Response 200:
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "APPROVED",
    "processedAt": "2025-01-15T11:00:00.000Z",
    "processedBy": "admin-uuid"
  }
}
```

**Frontend Example:**
```javascript
async function processRefund(refundId, action, notes) {
  const token = localStorage.getItem('adminToken');
  const response = await fetch(
    `http://localhost:3001/api/admin/financial/refunds/${refundId}/process`,
    {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ action, notes })
    }
  );
  return (await response.json()).data;
}
```

---

## Audit Logs

### 1. Get Audit Logs
```http
GET /api/admin/audit?page=1&limit=20&action=LOGIN
Authorization: Bearer <token>

Query Parameters:
- page: number (default: 1)
- limit: number (default: 20)
- userId: uuid
- adminId: uuid
- action: LOGIN | LOGOUT | CREATE | UPDATE | DELETE | APPROVE | REJECT | etc.
- resource: USER | SHOP | PAYMENT | REFUND | BOOKING | etc.
- startDate: ISO 8601 date
- endDate: ISO 8601 date
- ipAddress: string

Response 200:
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "uuid",
        "userId": "uuid",
        "userName": "Admin User",
        "adminId": "uuid",
        "action": "LOGIN",
        "resource": "ADMIN",
        "resourceId": "uuid",
        "ipAddress": "192.168.1.1",
        "userAgent": "Mozilla/5.0...",
        "success": true,
        "metadata": {
          "location": "Seoul, Korea",
          "device": "Chrome on Windows"
        },
        "createdAt": "2025-01-15T10:30:00.000Z"
      }
    ],
    "pagination": {
      "total": 10000,
      "page": 1,
      "limit": 20,
      "totalPages": 500
    }
  }
}
```

**Frontend Example:**
```javascript
async function getAuditLogs(params = {}) {
  const token = localStorage.getItem('adminToken');
  const queryString = new URLSearchParams(params).toString();
  const response = await fetch(
    `http://localhost:3001/api/admin/audit?${queryString}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  return (await response.json()).data;
}
```

### 2. Export Audit Logs
```http
GET /api/admin/audit/export?format=csv&startDate=2025-01-01&endDate=2025-01-31
Authorization: Bearer <token>

Query Parameters:
- format: csv | xlsx | pdf
- startDate: ISO 8601 date (required)
- endDate: ISO 8601 date (required)
- action: filter by action
- resource: filter by resource

Response 200:
[File Download]
```

**Frontend Example:**
```javascript
async function exportAuditLogs(format, startDate, endDate, filters = {}) {
  const token = localStorage.getItem('adminToken');
  const params = new URLSearchParams({ format, startDate, endDate, ...filters });
  const response = await fetch(
    `http://localhost:3001/api/admin/audit/export?${params}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );

  const blob = await response.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-logs-${startDate}-${endDate}.${format}`;
  a.click();
}
```

---

## Error Handling

All endpoints follow the same error response format:

```javascript
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable error message",
    "details": {
      // Additional error details
    }
  }
}
```

### Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid authentication token |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `VALIDATION_ERROR` | 422 | Request validation failed |
| `INTERNAL_ERROR` | 500 | Server error |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |

### Frontend Error Handling Example

```javascript
class AdminAPI {
  async request(endpoint, options = {}) {
    const token = localStorage.getItem('adminToken');

    try {
      const response = await fetch(`http://localhost:3001${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          ...options.headers
        }
      });

      const data = await response.json();

      if (!data.success) {
        throw new APIError(data.error.code, data.error.message, response.status);
      }

      return data.data;
    } catch (error) {
      if (error instanceof APIError) {
        // Handle specific error codes
        if (error.code === 'UNAUTHORIZED') {
          // Redirect to login
          window.location.href = '/admin/login';
        }
        throw error;
      }

      // Network or other errors
      throw new Error('Network error occurred');
    }
  }
}

class APIError extends Error {
  constructor(code, message, statusCode) {
    super(message);
    this.code = code;
    this.statusCode = statusCode;
  }
}
```

---

## Rate Limiting

All admin endpoints are rate-limited to prevent abuse:

- **General endpoints**: 100 requests per minute
- **Authentication endpoints**: 10 requests per minute
- **Export/Report endpoints**: 5 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642262400
```

---

## Pagination

All list endpoints support pagination with consistent parameters:

- `page`: Page number (starts at 1)
- `limit`: Items per page (max: 100)

Response includes pagination metadata:
```javascript
{
  "pagination": {
    "total": 1000,
    "page": 1,
    "limit": 20,
    "totalPages": 50
  }
}
```

---

## Notes

1. **External User Management**: User CRUD endpoints (`/admin/users/*`) are handled by external backend - configure `NEXT_PUBLIC_EXTERNAL_API_URL`

2. **Shop Search Not Implemented**: `/api/admin/shop/search` returns 405 - use `/api/admin/shops` with query parameters instead

3. **Authentication Required**: All admin endpoints except `/auth/login` require `Authorization: Bearer <token>` header

4. **Refresh Token Storage**: Store refresh tokens securely and use them to get new access tokens when expired

5. **File Uploads**: Use `multipart/form-data` for endpoints that accept file uploads (banners, shop images, etc.)

---

**Last Updated**: 2025-01-15
**API Version**: 1.0.0
**Backend Repository**: everything_backend
