# 📱 에뷰리띵 USER API - Complete Frontend Developer Guide

**Version**: 4.0
**Last Updated**: 2025-01-25
**Purpose**: Comprehensive API reference for Node.js client application development
**Environment**: Production Backend API running on port 3001
**Client Platform**: Node.js (Mobile & Web applications)

---

## 📋 Table of Contents

1. [Getting Started](#getting-started)
2. [Authentication System](#authentication-system)
3. [User Profile & Settings](#user-profile--settings)
4. [Feed System](#feed-system)
5. [Shop Discovery](#shop-discovery)
6. [Service Catalog](#service-catalog)
7. [Reservations & Bookings](#reservations--bookings)
8. [Favorites Management](#favorites-management)
9. [Supabase Database Schema](#supabase-database-schema)
10. [Error Handling](#error-handling)
11. [Rate Limiting](#rate-limiting)
12. [Frontend Integration Patterns](#frontend-integration-patterns)

---

## 🚀 Getting Started

### Base URL
```
Production: http://localhost:3001/api
```

### Authentication
All user-specific endpoints require JWT authentication via Bearer token:

```http
Authorization: Bearer <your_jwt_token>
```

### Standard Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Optional success message"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": "Additional error details"
  }
}
```

---

## 🔐 Authentication System

### Overview
에뷰리띵 uses JWT-based authentication with support for social login (Kakao, Apple, Google) and Korean PASS phone verification.

### 1. Social Login

**Endpoint**: `POST /api/auth/social-login`
**Rate Limit**: Standard auth rate limits
**Description**: Authenticate user via social providers

**Request Body**:
```json
{
  "provider": "kakao",  // "kakao" | "apple" | "google"
  "accessToken": "provider_access_token",
  "email": "user@example.com",  // Optional
  "name": "홍길동",  // Optional
  "profileImage": "https://..."  // Optional
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "홍길동",
      "phoneNumber": null,
      "phoneVerified": false,
      "profileImageUrl": "https://...",
      "userRole": "user",
      "userStatus": "active",
      "isInfluencer": false,
      "socialProvider": "kakao",
      "referralCode": "ABC123XYZ",
      "totalPoints": 0,
      "availablePoints": 0,
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "tokenType": "Bearer"
  },
  "message": "로그인 성공"
}
```

**Flutter Example**:
```dart
Future<AuthResponse> socialLogin({
  required String provider,
  required String accessToken,
  String? email,
}) async {
  final response = await http.post(
    Uri.parse('$baseUrl/auth/social-login'),
    headers: {'Content-Type': 'application/json'},
    body: jsonEncode({
      'provider': provider,
      'accessToken': accessToken,
      'email': email,
    }),
  );

  if (response.statusCode == 201) {
    return AuthResponse.fromJson(jsonDecode(response.body));
  }
  throw ApiException.fromResponse(response);
}
```

**Node.js Example**:
```javascript
const axios = require('axios');

async function socialLogin(provider, accessToken, email = null) {
  try {
    const response = await axios.post(`${baseUrl}/auth/social-login`, {
      provider,
      accessToken,
      email
    });

    return response.data;
  } catch (error) {
    if (error.response) {
      throw new Error(error.response.data.error.message);
    }
    throw error;
  }
}
```

### 2. User Registration

**Endpoint**: `POST /api/auth/register`
**Description**: Register new user with email/password

**Request Body**:
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "홍길동",
  "phoneNumber": "01012345678",
  "gender": "male",  // "male" | "female" | "other" | "prefer_not_to_say"
  "birthDate": "1990-01-01",
  "referralCode": "ABC123XYZ",  // Optional
  "marketingConsent": true
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "user": { /* same as social login */ },
    "accessToken": "...",
    "refreshToken": "...",
    "expiresIn": 3600
  }
}
```

### 3. Phone Verification (PASS)

**Step 1: Send Verification Code**

**Endpoint**: `POST /api/auth/send-verification-code`
**Description**: Initiate PASS phone verification

**Request Body**:
```json
{
  "phoneNumber": "01012345678"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "verificationId": "verify_123abc",
    "expiresIn": 180  // seconds
  },
  "message": "인증번호가 발송되었습니다."
}
```

**Step 2: Verify Phone**

**Endpoint**: `POST /api/auth/verify-phone`
**Description**: Confirm phone verification with code

**Request Body**:
```json
{
  "verificationId": "verify_123abc",
  "code": "123456",
  "phoneNumber": "01012345678"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "verified": true,
    "name": "홍길동"  // Name from PASS verification
  },
  "message": "본인인증이 완료되었습니다."
}
```

### 4. Token Refresh

**Endpoint**: `POST /api/auth/refresh`
**Description**: Get new access token using refresh token

**Request Body**:
```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "expiresIn": 3600
  }
}
```

### 5. Logout

**Single Device Logout**

**Endpoint**: `POST /api/auth/logout`
**Auth Required**: Yes
**Description**: Logout from current device

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "로그아웃되었습니다."
}
```

**All Devices Logout**

**Endpoint**: `POST /api/auth/logout-all`
**Auth Required**: Yes
**Description**: Logout from all devices

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "모든 기기에서 로그아웃되었습니다."
}
```

### 6. Active Sessions

**Endpoint**: `GET /api/auth/sessions`
**Auth Required**: Yes
**Description**: Get list of active login sessions

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "session_123",
        "deviceInfo": "iPhone 13 Pro",
        "ipAddress": "123.456.789.0",
        "lastActive": "2024-01-25T10:30:00Z",
        "isCurrent": true,
        "createdAt": "2024-01-20T10:30:00Z"
      }
    ]
  }
}
```

---

## 👤 User Profile & Settings

### 1. Get Current User Profile

**Endpoint**: `GET /api/users/profile`
**Auth Required**: Yes
**Rate Limit**: 200 per 15 minutes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "홍길동",
    "nickname": "길동이",
    "phoneNumber": "01012345678",
    "phoneVerified": true,
    "gender": "male",
    "birthDate": "1990-01-01",
    "profileImageUrl": "https://storage.supabase.co/...",
    "userRole": "user",
    "userStatus": "active",
    "isInfluencer": false,
    "referralCode": "ABC123XYZ",
    "totalPoints": 5000,
    "availablePoints": 3000,
    "totalReferrals": 5,
    "successfulReferrals": 3,
    "marketingConsent": true,
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-25T10:30:00Z"
  }
}
```

### 2. Update Profile

**Endpoint**: `PUT /api/users/profile`
**Auth Required**: Yes
**Description**: Update user profile information

**Request Body** (all fields optional):
```json
{
  "name": "김홍길동",
  "nickname": "길동",
  "gender": "male",
  "birthDate": "1990-01-01",
  "marketingConsent": false
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    /* updated user profile */
  },
  "message": "프로필이 업데이트되었습니다."
}
```

### 3. Upload Profile Image

**Endpoint**: `POST /api/users/profile/image`
**Auth Required**: Yes
**Content-Type**: `multipart/form-data`
**Max File Size**: 5MB

**Request**:
```
POST /api/users/profile/image
Content-Type: multipart/form-data

Form Data:
  image: [file] (JPEG, PNG, WebP)
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "profileImageUrl": "https://storage.supabase.co/v1/object/public/profile-images/..."
  },
  "message": "프로필 이미지가 업로드되었습니다."
}
```

**Flutter Example**:
```dart
Future<String> uploadProfileImage(File imageFile) async {
  var request = http.MultipartRequest(
    'POST',
    Uri.parse('$baseUrl/users/profile/image'),
  );
  request.headers['Authorization'] = 'Bearer $token';
  request.files.add(await http.MultipartFile.fromPath(
    'image',
    imageFile.path,
  ));

  var response = await request.send();
  if (response.statusCode == 200) {
    var body = await response.stream.bytesToString();
    return jsonDecode(body)['data']['profileImageUrl'];
  }
  throw Exception('Upload failed');
}
```

**Node.js Example**:
```javascript
const FormData = require('form-data');
const fs = require('fs');

async function uploadProfileImage(imagePath, token) {
  const form = new FormData();
  form.append('image', fs.createReadStream(imagePath));

  const response = await axios.post(`${baseUrl}/users/profile/image`, form, {
    headers: {
      ...form.getHeaders(),
      'Authorization': `Bearer ${token}`
    }
  });

  return response.data.data.profileImageUrl;
}
```

### 4. Get User Settings

**Endpoint**: `GET /api/users/settings`
**Auth Required**: Yes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "userId": "550e8400-e29b-41d4-a716-446655440000",
    "pushNotificationsEnabled": true,
    "reservationNotifications": true,
    "eventNotifications": true,
    "marketingNotifications": false,
    "locationTrackingEnabled": true,
    "languagePreference": "ko",
    "currencyPreference": "KRW",
    "themePreference": "light",
    "createdAt": "2024-01-01T00:00:00Z",
    "updatedAt": "2024-01-25T10:30:00Z"
  }
}
```

### 5. Update Settings

**Endpoint**: `PUT /api/users/settings`
**Auth Required**: Yes

**Request Body** (all fields optional):
```json
{
  "pushNotificationsEnabled": true,
  "reservationNotifications": true,
  "eventNotifications": false,
  "marketingNotifications": false,
  "locationTrackingEnabled": true,
  "themePreference": "dark"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    /* updated settings */
  },
  "message": "설정이 업데이트되었습니다."
}
```

### 6. Profile Completion Status

**Endpoint**: `GET /api/users/profile/completion`
**Auth Required**: Yes
**Description**: Check profile completeness for onboarding

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "completionPercentage": 85,
    "missingFields": ["nickname", "birthDate"],
    "sections": {
      "basicInfo": {
        "completed": true,
        "fields": ["name", "email", "phoneNumber"]
      },
      "profileDetails": {
        "completed": false,
        "fields": ["nickname", "birthDate", "gender"],
        "missing": ["nickname", "birthDate"]
      },
      "profileImage": {
        "completed": true,
        "fields": ["profileImageUrl"]
      }
    }
  }
}
```

### 7. Accept Terms & Conditions

**Endpoint**: `POST /api/users/terms/accept`
**Auth Required**: Yes

**Request Body**:
```json
{
  "termsVersion": "1.0",
  "acceptedAt": "2024-01-25T10:30:00Z"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "약관 동의가 완료되었습니다."
}
```

### 8. Accept Privacy Policy

**Endpoint**: `POST /api/users/privacy/accept`
**Auth Required**: Yes

**Request Body**:
```json
{
  "privacyVersion": "1.0",
  "acceptedAt": "2024-01-25T10:30:00Z"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "개인정보처리방침 동의가 완료되었습니다."
}
```

### 9. Delete Account (Soft Delete)

**Endpoint**: `DELETE /api/users/account`
**Auth Required**: Yes
**Description**: Soft delete user account (status → 'deleted')

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "계정이 삭제되었습니다. 30일 이내 복구 가능합니다."
}
```

---

## 📰 Feed System

**Complete feed API documentation is available in**: `USER_FEED_API_GUIDE.md`

### Feed Endpoints Summary

| Endpoint | Method | Description | Rate Limit |
|----------|--------|-------------|------------|
| `/api/user/feed/posts` | GET | Get feed posts (discover) | 200/15min |
| `/api/user/feed/my-posts` | GET | Get user's own posts | 200/15min |
| `/api/user/feed/discover` | GET | Get discover feed | 200/15min |
| `/api/user/feed/posts` | POST | Create new post | 5/hour |
| `/api/user/feed/posts/:id` | PUT | Update own post | 100/5min |
| `/api/user/feed/posts/:id` | DELETE | Delete own post | 100/5min |
| `/api/user/feed/posts/:id` | GET | Get single post | 200/15min |
| `/api/user/feed/posts/:id/like` | POST | Like/unlike post (toggle) | 100/5min |
| `/api/user/feed/posts/:id/comments` | GET | Get post comments | 200/15min |
| `/api/user/feed/posts/:id/comments` | POST | Add comment | 100/5min |
| `/api/user/feed/comments/:id` | PUT | Update comment | 100/5min |
| `/api/user/feed/comments/:id` | DELETE | Delete comment | 100/5min |
| `/api/user/feed/comments/:id/like` | POST | Like comment | 100/5min |
| `/api/user/feed/posts/:id/report` | POST | Report post | 100/5min |
| `/api/user/feed/upload-images` | POST | Upload images only | 100/5min |

**📖 For complete feed API documentation with examples, see `USER_FEED_API_GUIDE.md`**

---

## 🏪 Shop Discovery

### 1. Get All Shops

**Endpoint**: `GET /api/shops`
**Auth Required**: No
**Rate Limit**: 200 per 15 minutes

**Query Parameters**:
```
?status=active                    // Shop status filter
&category=nail                    // Service category filter
&shopType=partnered              // Shop type filter
&ownerId=uuid                    // Filter by owner
&limit=20                         // Results per page (default: 50, max: 100)
&offset=0                         // Pagination offset
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "뷰티살롱 강남점",
        "description": "프리미엄 네일아트 전문샵",
        "phoneNumber": "02-1234-5678",
        "email": "shop@example.com",
        "address": "서울시 강남구 테헤란로 123",
        "detailedAddress": "2층",
        "latitude": 37.5665,
        "longitude": 126.9780,
        "shopType": "partnered",
        "shopStatus": "active",
        "mainCategory": "nail",
        "subCategories": ["eyelash", "waxing"],
        "operatingHours": {
          "monday": { "open": "10:00", "close": "20:00" },
          "tuesday": { "open": "10:00", "close": "20:00" }
        },
        "paymentMethods": ["card", "mobile_payment"],
        "totalBookings": 150,
        "isFeatured": true,
        "featuredUntil": "2024-02-28T23:59:59Z",
        "commissionRate": 10.00,
        "images": [
          {
            "id": "img_123",
            "imageUrl": "https://storage.supabase.co/...",
            "thumbnailUrl": "https://storage.supabase.co/.../thumb",
            "isPrimary": true,
            "displayOrder": 0
          }
        ],
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "totalCount": 150,
    "hasMore": true
  }
}
```

### 2. Get Nearby Shops

**Endpoint**: `GET /api/shops/nearby`
**Auth Required**: No
**Rate Limit**: 100 per 15 minutes
**Description**: Find shops near user location using PostGIS

**Query Parameters** (Required: latitude, longitude):
```
?latitude=37.5665              // User's latitude (required)
&longitude=126.9780            // User's longitude (required)
&radius=5                       // Search radius in km (default: 10, max: 50)
&category=nail                  // Filter by category
&shopType=partnered            // Filter by shop type
&onlyFeatured=false            // Show only featured shops
&limit=20                       // Results per page (default: 50, max: 100)
&offset=0                       // Pagination offset
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "name": "뷰티살롱 강남점",
        "distance": 2.5,  // Distance in km from user location
        "latitude": 37.5665,
        "longitude": 126.9780,
        /* ... other shop fields */
      }
    ],
    "userLocation": {
      "latitude": 37.5665,
      "longitude": 126.9780
    },
    "searchRadius": 5,
    "totalCount": 25,
    "hasMore": true
  },
  "message": "반경 5km 내 25개의 샵을 찾았습니다."
}
```

**Flutter Example**:
```dart
Future<List<Shop>> getNearbyShops({
  required double latitude,
  required double longitude,
  double radius = 5.0,
  String? category,
}) async {
  final queryParams = {
    'latitude': latitude.toString(),
    'longitude': longitude.toString(),
    'radius': radius.toString(),
    if (category != null) 'category': category,
  };

  final uri = Uri.parse('$baseUrl/shops/nearby')
      .replace(queryParameters: queryParams);

  final response = await http.get(uri);

  if (response.statusCode == 200) {
    final data = jsonDecode(response.body)['data'];
    return (data['shops'] as List)
        .map((shop) => Shop.fromJson(shop))
        .toList();
  }
  throw ApiException.fromResponse(response);
}
```

**Node.js Example**:
```javascript
async function getNearbyShops(latitude, longitude, radius = 5.0, category = null) {
  const params = {
    latitude,
    longitude,
    radius
  };

  if (category) params.category = category;

  const response = await axios.get(`${baseUrl}/shops/nearby`, { params });

  return response.data.data.shops;
}
```

### 3. Get Popular Shops

**Endpoint**: `GET /api/shops/popular`
**Auth Required**: No
**Rate Limit**: 100 per 15 minutes
**Description**: Get popular shops following PRD 2.1 algorithm

**Sorting Algorithm (PRD 2.1)**:
1. Partnered shops ('입점 샵') appear first
2. Within partnered shops, sorted by newest partnership date
3. Non-partnered shops appear after

**Query Parameters**:
```
?category=nail        // Filter by category
&limit=20             // Results per page (default: 50, max: 100)
&offset=0             // Pagination offset
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shops": [
      /* Same structure as Get All Shops */
    ],
    "totalCount": 50
  }
}
```

### 4. Get Shops in Map Bounds

**Endpoint**: `GET /api/shops/bounds`
**Auth Required**: No
**Rate Limit**: 100 per 15 minutes
**Description**: Get shops within map viewport (rectangle)

**Query Parameters** (All required):
```
?neLat=37.6           // Northeast corner latitude
&neLng=127.0          // Northeast corner longitude
&swLat=37.5           // Southwest corner latitude
&swLng=126.9          // Southwest corner longitude
&category=nail        // Optional: filter by category
&shopType=partnered   // Optional: filter by type
&onlyFeatured=false   // Optional: featured only
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shops": [
      /* Same structure with distance calculated from map center */
    ],
    "bounds": {
      "northeast": { "lat": 37.6, "lng": 127.0 },
      "southwest": { "lat": 37.5, "lng": 126.9 }
    },
    "totalCount": 30
  }
}
```

### 5. Get Shop Details

**Endpoint**: `GET /api/shops/:id`
**Auth Required**: No
**Rate Limit**: 200 per 15 minutes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "뷰티살롱 강남점",
    /* ... all shop fields */
    "images": [
      /* Full image details */
    ],
    "services": [
      {
        "id": "service_123",
        "name": "젤 네일",
        "description": "프리미엄 젤 네일 시술",
        "price": 45000,
        "duration": 60,
        "category": "nail"
      }
    ],
    "reviews": {
      "averageRating": 4.5,
      "totalReviews": 150,
      "recentReviews": [
        /* Review objects */
      ]
    }
  }
}
```

### 6. Get Shop Contact Information

**Endpoint**: `GET /api/shops/:id/contact-info`
**Auth Required**: No
**Rate Limit**: 60 per 15 minutes
**Description**: Get public contact methods for a shop

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "contactMethods": [
      {
        "methodType": "phone",
        "value": "02-1234-5678",
        "description": "매장 전화",
        "displayOrder": 1
      },
      {
        "methodType": "kakao_channel",
        "value": "https://pf.kakao.com/...",
        "description": "카카오톡 채널",
        "displayOrder": 2
      },
      {
        "methodType": "instagram",
        "value": "@beautysalon_gangnam",
        "description": "인스타그램",
        "displayOrder": 3
      }
    ]
  }
}
```

---

## 🔍 Shop Search

### 1. Advanced Shop Search

**Endpoint**: `GET /api/shops/search`
**Auth Required**: No
**Rate Limit**: 60 per minute
**Description**: Full-text search with advanced filtering

**Query Parameters**:
```
?q=네일아트                      // Search query (text search)
&category=nail                   // Service category
&shopType=partnered             // Shop type
&status=active                   // Shop status (default: active)
&onlyFeatured=false             // Featured shops only
&onlyOpen=false                  // Currently open shops only
&priceMin=10000                  // Minimum service price
&priceMax=100000                 // Maximum service price
&ratingMin=4.0                   // Minimum average rating
&latitude=37.5665                // User latitude (for distance sorting)
&longitude=126.9780              // User longitude
&radius=10                       // Search radius in km
&neLat=37.6                      // Map bounds northeast lat
&neLng=127.0                     // Map bounds northeast lng
&swLat=37.5                      // Map bounds southwest lat
&swLng=126.9                     // Map bounds southwest lng
&sortBy=relevance                // Sort field: relevance | distance | rating | price | name | created_at
&sortOrder=desc                  // Sort order: asc | desc
&limit=20                        // Results per page (max: 100)
&offset=0                        // Pagination offset
&page=1                          // Alternative to offset

// Advanced filters
&categories=nail,eyelash         // Multiple categories (comma-separated)
&subCategories=nail,hair         // Sub-categories filter
&shopTypes=partnered,non_partnered  // Multiple shop types
&statuses=active,pending_approval   // Multiple statuses
&openOn=monday                   // Filter shops open on specific day
&openAt=14:30                    // Filter shops open at specific time (HH:mm)
&paymentMethods=card,mobile_pay  // Payment methods filter
&hasServices=nail,eyelash        // Required services filter
&serviceNames=젤네일,속눈썹연장    // Specific service names
&bookingMin=100                  // Minimum total bookings
&bookingMax=5000                 // Maximum total bookings
&commissionMin=5.0               // Minimum commission rate
&commissionMax=15.0              // Maximum commission rate
&createdAfter=2024-01-01         // Filter shops created after date
&createdBefore=2024-12-31        // Filter shops created before date
&partnershipAfter=2024-01-01     // Filter partnerships started after
&partnershipBefore=2024-12-31    // Filter partnerships started before
&hasBusinessLicense=true         // Filter shops with business license
&hasImages=true                  // Filter shops with images
&minImages=3                     // Minimum number of images
&excludeIds=uuid1,uuid2          // Shop IDs to exclude (comma-separated)
&includeInactive=false           // Include inactive shops in results
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shops": [
      /* Shop objects with distance if location provided */
    ],
    "totalCount": 45,
    "hasMore": true,
    "currentPage": 1,
    "totalPages": 3,
    "searchMetadata": {
      "query": "네일아트",
      "filters": {
        "category": "nail",
        "priceRange": { "min": 10000, "max": 100000 },
        "rating": { "min": 4.0 }
      },
      "searchTime": 0.045,  // seconds
      "cached": false
    }
  },
  "message": "네일아트 검색 결과 45개를 찾았습니다."
}
```

### 2. Search Suggestions (Autocomplete)

**Endpoint**: `GET /api/shops/search/suggestions`
**Auth Required**: No
**Rate Limit**: 120 per minute
**Description**: Get search suggestions for autocomplete

**Query Parameters**:
```
?q=네일          // Partial search query (required, min 1 char)
&limit=5         // Max suggestions (default: 5, max: 10)
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "query": "네일",
    "suggestions": [
      "네일아트",
      "네일케어",
      "네일샵",
      "젤네일",
      "아트네일"
    ],
    "count": 5
  },
  "message": "5개의 검색 제안을 찾았습니다."
}
```

### 3. Popular Searches

**Endpoint**: `GET /api/shops/search/popular`
**Auth Required**: No
**Rate Limit**: 60 per minute
**Description**: Get popular search terms and trending categories

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "popularSearches": [
      "네일아트",
      "속눈썹 연장",
      "왁싱",
      "눈썹문신",
      "젤네일"
    ],
    "trendingCategories": [
      {
        "category": "nail",
        "name": "네일",
        "count": 1250
      },
      {
        "category": "eyelash",
        "name": "속눈썹",
        "count": 890
      }
    ],
    "lastUpdated": "2024-01-25T10:30:00Z"
  },
  "message": "인기 검색어를 조회했습니다."
}
```

---

## 🛍️ Service Catalog

### 1. Get Service Catalog

**Endpoint**: `GET /api/service-catalog`
**Auth Required**: No
**Rate Limit**: 1000 per 15 minutes
**Description**: Browse all available services with filtering

**Query Parameters**:
```
?q=젤 네일                       // Search query
&category=nail                   // Service category
&price_min=10000                 // Minimum price
&price_max=100000                // Maximum price
&duration_min=30                 // Minimum duration (minutes)
&duration_max=120                // Maximum duration
&service_level=premium           // basic | premium | luxury
&difficulty_level=intermediate   // beginner | intermediate | advanced
&featured_only=false             // Featured services only
&trending_only=false             // Trending services only
&min_rating=4.0                  // Minimum rating
&tags=아트,프렌치                 // Comma-separated tags
&page=1                          // Page number
&limit=20                        // Items per page (max: 100)
&sort_by=popularity              // price | duration | rating | popularity | distance | newest
&sort_order=desc                 // asc | desc
&include_unavailable=false       // Include unavailable services
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "service_123",
        "name": "젤 네일",
        "description": "프리미엄 젤 네일 시술",
        "category": "nail",
        "price": 45000,
        "estimatedDuration": 60,
        "serviceLevel": "premium",
        "difficultyLevel": "intermediate",
        "tags": ["젤네일", "아트", "프렌치"],
        "isFeatured": false,
        "isTrending": true,
        "averageRating": 4.7,
        "totalBookings": 250,
        "imageUrl": "https://storage.supabase.co/...",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "totalCount": 150,
    "hasMore": true
  },
  "message": "서비스 카탈로그를 성공적으로 조회했습니다."
}
```

### 2. Service Catalog Search

**Endpoint**: `GET /api/service-catalog/search`
**Auth Required**: No
**Rate Limit**: 100 per 5 minutes
**Description**: Advanced search with enhanced relevance

**Same query parameters as Get Service Catalog**

### 3. Get Service Details

**Endpoint**: `GET /api/service-catalog/:serviceId`
**Auth Required**: No

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "service_123",
    "name": "젤 네일",
    "description": "프리미엄 젤 네일 시술",
    "detailedDescription": "고급 젤을 사용한 전문 네일 시술...",
    "category": "nail",
    "price": 45000,
    "priceRange": { "min": 40000, "max": 50000 },
    "estimatedDuration": 60,
    "serviceLevel": "premium",
    "difficultyLevel": "intermediate",
    "tags": ["젤네일", "아트", "프렌치"],
    "requirements": ["손톱 정리", "큐티클 제거"],
    "includes": ["젤 시술", "베이스/탑 코트", "기본 케어"],
    "excludes": ["파츠 추가", "특수 아트"],
    "isFeatured": false,
    "isTrending": true,
    "averageRating": 4.7,
    "totalBookings": 250,
    "totalReviews": 85,
    "images": [
      {
        "url": "https://storage.supabase.co/...",
        "caption": "젤 네일 시술 예시"
      }
    ],
    "relatedServices": [
      {
        "id": "service_124",
        "name": "프렌치 네일",
        "price": 50000
      }
    ],
    "availableShops": 45,
    "createdAt": "2024-01-01T00:00:00Z"
  }
}
```

### 4. Get Service Catalog Statistics

**Endpoint**: `GET /api/service-catalog/stats`
**Auth Required**: No

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalServices": 1500,
    "categoryCounts": {
      "nail": 500,
      "eyelash": 300,
      "waxing": 250,
      "eyebrow_tattoo": 200,
      "hair": 250
    },
    "averagePrice": 45000,
    "averageRating": 4.5,
    "priceRange": {
      "min": 10000,
      "max": 200000
    },
    "durationRange": {
      "min": 15,
      "max": 240
    }
  }
}
```

### 5. Get Service Metadata

**Endpoint**: `GET /api/service-catalog/metadata`
**Auth Required**: No
**Description**: Get available categories, levels, and filter options

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "categories": ["nail", "eyelash", "waxing", "eyebrow_tattoo", "hair"],
    "serviceLevels": ["basic", "premium", "luxury"],
    "difficultyLevels": ["beginner", "intermediate", "advanced"],
    "tags": ["젤네일", "아트", "프렌치", "그라데이션", /* ... */],
    "priceRange": { "min": 10000, "max": 200000 },
    "durationRange": { "min": 15, "max": 240 }
  }
}
```

### 6. Get Popular Services

**Endpoint**: `GET /api/service-catalog/popular`
**Auth Required**: No

**Query Parameters**:
```
?limit=10          // Number of services (max: 50)
&category=nail     // Optional: filter by category
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    {
      "id": "service_123",
      "name": "젤 네일",
      "category": "nail",
      "price": 45000,
      "averageRating": 4.7,
      "totalBookings": 250,
      "popularityScore": 95.5
    }
  ]
}
```

### 7. Get Trending Services

**Endpoint**: `GET /api/service-catalog/trending`
**Auth Required**: No

**Query Parameters**:
```
?limit=10          // Number of services (max: 50)
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": [
    /* Same structure as popular services */
  ]
}
```

---

## 📅 Reservations & Bookings

### 1. Get Available Time Slots

**Endpoint**: `GET /api/shops/:shopId/available-slots`
**Auth Required**: Yes
**Description**: Get available booking time slots for a shop

**Query Parameters**:
```
?date=2024-01-25              // Date for availability check (YYYY-MM-DD)
&serviceId=service_123         // Optional: specific service
&duration=60                   // Optional: service duration in minutes
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "date": "2024-01-25",
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "operatingHours": {
      "open": "10:00",
      "close": "20:00"
    },
    "availableSlots": [
      {
        "startTime": "10:00",
        "endTime": "11:00",
        "available": true,
        "price": 45000
      },
      {
        "startTime": "11:00",
        "endTime": "12:00",
        "available": false,
        "reason": "Already booked"
      },
      {
        "startTime": "14:00",
        "endTime": "15:00",
        "available": true,
        "price": 45000
      }
    ],
    "totalSlots": 10,
    "availableCount": 7,
    "bookedCount": 3
  }
}
```

### 2. Create Reservation

**Endpoint**: `POST /api/reservations`
**Auth Required**: Yes
**Description**: Create new reservation

**Request Body**:
```json
{
  "shopId": "550e8400-e29b-41d4-a716-446655440000",
  "services": [
    {
      "serviceId": "service_123",
      "quantity": 1
    }
  ],
  "reservationDate": "2024-01-25",
  "reservationTime": "14:00",
  "specialRequests": "알레르기 있습니다",
  "usePoints": 1000  // Optional: points to use
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "reservation_123",
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "shopName": "뷰티살롱 강남점",
    "userId": "user_123",
    "services": [
      {
        "id": "service_123",
        "name": "젤 네일",
        "quantity": 1,
        "unitPrice": 45000,
        "totalPrice": 45000
      }
    ],
    "reservationDate": "2024-01-25",
    "reservationTime": "14:00",
    "status": "requested",
    "totalAmount": 45000,
    "depositAmount": 10000,
    "remainingAmount": 35000,
    "pointsUsed": 1000,
    "paymentStatus": "deposit_paid",
    "specialRequests": "알레르기 있습니다",
    "createdAt": "2024-01-20T10:30:00Z"
  },
  "message": "예약이 요청되었습니다. 샵 확인 후 확정됩니다."
}
```

### 3. Get User Reservations

**Endpoint**: `GET /api/reservations`
**Auth Required**: Yes
**Description**: Get all user's reservations with filtering

**Query Parameters**:
```
?status=confirmed              // Filter by status: requested | confirmed | completed | cancelled_by_user | cancelled_by_shop | no_show
&from=2024-01-01               // Date range start (YYYY-MM-DD)
&to=2024-12-31                 // Date range end
&shopId=uuid                   // Filter by specific shop
&page=1                        // Page number
&limit=20                      // Items per page (max: 100)
&sortBy=reservationDate        // Sort field: reservationDate | createdAt | totalAmount
&sortOrder=desc                // Sort order: asc | desc
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation_123",
        "shop": {
          "id": "shop_123",
          "name": "뷰티살롱 강남점",
          "phoneNumber": "02-1234-5678",
          "address": "서울시 강남구...",
          "mainImage": "https://..."
        },
        "services": [
          {
            "id": "service_123",
            "name": "젤 네일",
            "quantity": 1,
            "unitPrice": 45000,
            "totalPrice": 45000
          }
        ],
        "reservationDate": "2024-01-25",
        "reservationTime": "14:00",
        "status": "confirmed",
        "paymentStatus": "fully_paid",
        "totalAmount": 45000,
        "pointsUsed": 1000,
        "canCancel": true,
        "cancellationDeadline": "2024-01-24T14:00:00Z",
        "createdAt": "2024-01-20T10:30:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalCount": 45,
      "hasMore": true
    },
    "summary": {
      "upcoming": 3,
      "past": 42,
      "cancelled": 0
    }
  }
}
```

### 4. Get Reservation Details

**Endpoint**: `GET /api/reservations/:id`
**Auth Required**: Yes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "reservation_123",
    "shop": {
      /* Full shop details */
    },
    "services": [
      {
        "id": "service_123",
        "name": "젤 네일",
        "quantity": 1,
        "unitPrice": 45000,
        "totalPrice": 45000
      }
    ],
    "user": {
      "id": "user_123",
      "name": "홍길동",
      "phoneNumber": "01012345678"
    },
    "reservationDate": "2024-01-25",
    "reservationTime": "14:00",
    "status": "confirmed",
    "paymentStatus": "fully_paid",
    "totalAmount": 45000,
    "depositAmount": 10000,
    "remainingAmount": 35000,
    "pointsUsed": 1000,
    "specialRequests": "알레르기 있습니다",
    "canCancel": true,
    "cancellationPolicy": "24시간 전까지 무료 취소 가능",
    "cancellationDeadline": "2024-01-24T14:00:00Z",
    "timeline": [
      {
        "status": "requested",
        "timestamp": "2024-01-20T10:30:00Z",
        "message": "예약이 요청되었습니다."
      },
      {
        "status": "confirmed",
        "timestamp": "2024-01-20T11:00:00Z",
        "message": "샵에서 예약을 확정했습니다."
      }
    ],
    "createdAt": "2024-01-20T10:30:00Z",
    "updatedAt": "2024-01-20T11:00:00Z"
  }
}
```

### 5. Cancel Reservation

**Endpoint**: `PUT /api/reservations/:id/cancel`
**Auth Required**: Yes
**Description**: Cancel reservation by user

**Request Body** (optional):
```json
{
  "reason": "일정이 변경되었습니다",
  "requestRefund": true
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "reservation_123",
    "status": "cancelled_by_user",
    "cancelledAt": "2024-01-24T10:00:00Z",
    "refundAmount": 44000,
    "refundStatus": "pending",
    "estimatedRefundDate": "2024-01-29T10:00:00Z"
  },
  "message": "예약이 취소되었습니다. 환불은 3-5 영업일 소요됩니다."
}
```

---

## ⭐ Favorites Management

### 1. Add to Favorites

**Endpoint**: `POST /api/shops/:shopId/favorite`
**Auth Required**: Yes
**Description**: Add shop to user's favorites

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "isFavorite": true,
    "favoritedAt": "2024-01-25T10:30:00Z"
  },
  "message": "즐겨찾기에 추가되었습니다."
}
```

### 2. Remove from Favorites

**Endpoint**: `DELETE /api/shops/:shopId/favorite`
**Auth Required**: Yes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "isFavorite": false
  },
  "message": "즐겨찾기에서 제거되었습니다."
}
```

### 3. Toggle Favorite

**Endpoint**: `PUT /api/shops/:shopId/favorite`
**Auth Required**: Yes
**Description**: Toggle favorite status (add if not favorited, remove if favorited)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "isFavorite": true,  // New status after toggle
    "favoritedAt": "2024-01-25T10:30:00Z"
  },
  "message": "즐겨찾기에 추가되었습니다."
}
```

### 4. Check Favorite Status

**Endpoint**: `GET /api/shops/:shopId/favorite/status`
**Auth Required**: Yes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "shopId": "550e8400-e29b-41d4-a716-446655440000",
    "isFavorite": true,
    "favoritedAt": "2024-01-20T10:30:00Z"
  }
}
```

### 5. Get All Favorites

**Endpoint**: `GET /api/user/favorites`
**Auth Required**: Yes
**Description**: Get user's favorited shops with pagination

**Query Parameters**:
```
?page=1              // Page number
&limit=20            // Items per page (max: 100)
&category=nail       // Optional: filter by category
&sortBy=addedDate    // Sort field: addedDate | shopName | distance
&sortOrder=desc      // Sort order: asc | desc
&latitude=37.5665    // Optional: for distance calculation
&longitude=126.9780
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "favorites": [
      {
        "shop": {
          "id": "550e8400-e29b-41d4-a716-446655440000",
          "name": "뷰티살롱 강남점",
          "mainCategory": "nail",
          "address": "서울시 강남구...",
          "latitude": 37.5665,
          "longitude": 126.9780,
          "mainImage": "https://...",
          "averageRating": 4.5,
          "totalBookings": 150,
          "isFeatured": true,
          "distance": 2.5  // If location provided
        },
        "favoritedAt": "2024-01-20T10:30:00Z",
        "visitCount": 3,
        "lastVisitedAt": "2024-01-22T14:00:00Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalCount": 25,
      "hasMore": true
    }
  }
}
```

### 6. Get Favorites Statistics

**Endpoint**: `GET /api/user/favorites/stats`
**Auth Required**: Yes

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "totalFavorites": 25,
    "categoryBreakdown": {
      "nail": 10,
      "eyelash": 8,
      "waxing": 5,
      "eyebrow_tattoo": 2
    },
    "recentlyAdded": 3,  // Last 7 days
    "mostVisitedShop": {
      "id": "shop_123",
      "name": "뷰티살롱 강남점",
      "visitCount": 5
    },
    "averageDistance": 3.2  // km (if location provided)
  }
}
```

### 7. Bulk Add/Remove Favorites

**Endpoint**: `POST /api/user/favorites/bulk`
**Auth Required**: Yes
**Description**: Add or remove multiple shops from favorites

**Request Body**:
```json
{
  "action": "add",  // "add" or "remove"
  "shopIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001",
    "770e8400-e29b-41d4-a716-446655440002"
  ]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "action": "add",
    "totalProcessed": 3,
    "successful": 3,
    "failed": 0,
    "results": [
      {
        "shopId": "550e8400-e29b-41d4-a716-446655440000",
        "success": true,
        "isFavorite": true
      }
    ]
  },
  "message": "3개 샵이 즐겨찾기에 추가되었습니다."
}
```

### 8. Check Multiple Shops

**Endpoint**: `POST /api/user/favorites/check`
**Auth Required**: Yes
**Description**: Check favorite status for multiple shops at once

**Request Body**:
```json
{
  "shopIds": [
    "550e8400-e29b-41d4-a716-446655440000",
    "660e8400-e29b-41d4-a716-446655440001"
  ]
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "favorites": {
      "550e8400-e29b-41d4-a716-446655440000": true,
      "660e8400-e29b-41d4-a716-446655440001": false
    }
  }
}
```

---

## 🗄️ Supabase Database Schema

### User-Related Tables

#### 1. `public.users`

**Description**: Main user profile table extending Supabase Auth

**Columns**:
```sql
id                      UUID PRIMARY KEY (references auth.users)
email                   VARCHAR(255) UNIQUE
phone_number            VARCHAR(20) UNIQUE
phone_verified          BOOLEAN DEFAULT FALSE
name                    VARCHAR(100) NOT NULL
nickname                VARCHAR(50)
gender                  user_gender ENUM
birth_date              DATE
profile_image_url       TEXT
user_role               user_role ENUM DEFAULT 'user'
user_status             user_status ENUM DEFAULT 'active'
is_influencer           BOOLEAN DEFAULT FALSE
influencer_qualified_at TIMESTAMPTZ
social_provider         social_provider ENUM
social_provider_id      VARCHAR(255)
referral_code           VARCHAR(20) UNIQUE
referred_by_code        VARCHAR(20)
total_points            INTEGER DEFAULT 0
available_points        INTEGER DEFAULT 0
total_referrals         INTEGER DEFAULT 0
successful_referrals    INTEGER DEFAULT 0
last_login_at           TIMESTAMPTZ
last_active_at          TIMESTAMPTZ DEFAULT NOW()
terms_accepted_at       TIMESTAMPTZ
privacy_accepted_at     TIMESTAMPTZ
marketing_consent       BOOLEAN DEFAULT FALSE
created_at              TIMESTAMPTZ DEFAULT NOW()
updated_at              TIMESTAMPTZ DEFAULT NOW()
```

**ENUMS**:
- `user_gender`: 'male' | 'female' | 'other' | 'prefer_not_to_say'
- `user_role`: 'user' | 'shop_owner' | 'admin'
- `user_status`: 'active' | 'inactive' | 'suspended' | 'deleted'
- `social_provider`: 'kakao' | 'apple' | 'google' | 'email'

#### 2. `public.user_settings`

**Description**: User preferences and notification settings

**Columns**:
```sql
id                              UUID PRIMARY KEY
user_id                         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
push_notifications_enabled      BOOLEAN DEFAULT TRUE
reservation_notifications       BOOLEAN DEFAULT TRUE
event_notifications             BOOLEAN DEFAULT TRUE
marketing_notifications         BOOLEAN DEFAULT FALSE
location_tracking_enabled       BOOLEAN DEFAULT TRUE
language_preference             VARCHAR(10) DEFAULT 'ko'
currency_preference             VARCHAR(3) DEFAULT 'KRW'
theme_preference                VARCHAR(20) DEFAULT 'light'
created_at                      TIMESTAMPTZ DEFAULT NOW()
updated_at                      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(user_id)
```

### Shop-Related Tables

#### 3. `public.shops`

**Description**: Shop information with PostGIS location data

**Columns**:
```sql
id                          UUID PRIMARY KEY
owner_id                    UUID REFERENCES users(id)
name                        VARCHAR(255) NOT NULL
description                 TEXT
phone_number                VARCHAR(20)
email                       VARCHAR(255)
address                     TEXT NOT NULL
detailed_address            TEXT
postal_code                 VARCHAR(10)
latitude                    DECIMAL(10, 8)
longitude                   DECIMAL(11, 8)
location                    GEOGRAPHY(POINT, 4326)  -- PostGIS
shop_type                   shop_type ENUM DEFAULT 'non_partnered'
shop_status                 shop_status ENUM DEFAULT 'pending_approval'
verification_status         shop_verification_status ENUM
business_license_number     VARCHAR(50)
business_license_image_url  TEXT
main_category               service_category ENUM NOT NULL
sub_categories              service_category[]
operating_hours             JSONB
payment_methods             payment_method[]
kakao_channel_url           TEXT
total_bookings              INTEGER DEFAULT 0
partnership_started_at      TIMESTAMPTZ
featured_until              TIMESTAMPTZ
is_featured                 BOOLEAN DEFAULT FALSE
commission_rate             DECIMAL(5,2) DEFAULT 10.00
created_at                  TIMESTAMPTZ DEFAULT NOW()
updated_at                  TIMESTAMPTZ DEFAULT NOW()
```

**ENUMS**:
- `shop_type`: 'partnered' | 'non_partnered'
- `shop_status`: 'active' | 'inactive' | 'pending_approval' | 'suspended' | 'deleted'
- `shop_verification_status`: 'pending' | 'verified' | 'rejected'
- `service_category`: 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair'
- `payment_method`: 'toss_payments' | 'kakao_pay' | 'naver_pay' | 'card' | 'bank_transfer'

#### 4. `public.shop_images`

**Description**: Multiple images per shop with CDN optimization

**Columns**:
```sql
id                    UUID PRIMARY KEY
shop_id               UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE
image_url             TEXT NOT NULL
alt_text              VARCHAR(255)
is_primary            BOOLEAN DEFAULT FALSE
display_order         INTEGER DEFAULT 0
thumbnail_url         TEXT
medium_url            TEXT
large_url             TEXT
thumbnail_webp_url    TEXT
medium_webp_url       TEXT
large_webp_url        TEXT
title                 VARCHAR(255)
description           TEXT
tags                  TEXT[]
category              VARCHAR(50)
created_at            TIMESTAMPTZ DEFAULT NOW()
```

### Reservation Tables

#### 5. `public.reservations`

**Description**: User bookings with payment tracking

**Columns**:
```sql
id                      UUID PRIMARY KEY
shop_id                 UUID NOT NULL REFERENCES shops(id)
user_id                 UUID NOT NULL REFERENCES users(id)
reservation_date        DATE NOT NULL
reservation_time        TIME NOT NULL
reservation_datetime    TIMESTAMPTZ GENERATED -- Computed field: reservation_date + reservation_time
status                  reservation_status ENUM
payment_status          payment_status ENUM
total_amount            INTEGER NOT NULL  -- Price in smallest currency unit (e.g., cents)
deposit_amount          INTEGER           -- Deposit in smallest currency unit
remaining_amount        INTEGER           -- Remaining balance in smallest currency unit
points_used             INTEGER DEFAULT 0
points_earned           INTEGER DEFAULT 0
special_requests        TEXT              -- User's special requests for the service
shop_notes              TEXT              -- Shop's internal notes
cancellation_reason     TEXT
cancelled_at            TIMESTAMPTZ
completed_at            TIMESTAMPTZ
confirmed_at            TIMESTAMPTZ
no_show_reason          TEXT
version                 INTEGER NOT NULL DEFAULT 1  -- For optimistic locking
created_at              TIMESTAMPTZ DEFAULT NOW()
updated_at              TIMESTAMPTZ DEFAULT NOW()
```

**Note**: All price fields use INTEGER type (storing values in smallest currency unit) for financial accuracy and to avoid floating-point arithmetic issues. For example, $45.00 is stored as 4500 cents.

**ENUMS**:
- `reservation_status`: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show'
- `payment_status`: 'pending' | 'deposit_paid' | 'fully_paid' | 'refunded' | 'partially_refunded' | 'failed'

#### 5a. `public.reservation_services` (Join Table)

**Description**: Many-to-many relationship between reservations and services. A reservation can include multiple services.

**Columns**:
```sql
id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4()
reservation_id      UUID NOT NULL REFERENCES reservations(id) ON DELETE CASCADE
service_id          UUID NOT NULL REFERENCES shop_services(id)
quantity            INTEGER DEFAULT 1
unit_price          INTEGER NOT NULL  -- Price per unit in smallest currency unit
total_price         INTEGER NOT NULL  -- Total price (quantity * unit_price) in smallest currency unit
created_at          TIMESTAMPTZ DEFAULT NOW()
version             INTEGER NOT NULL DEFAULT 1
```

### Favorites Tables

#### 6. `public.user_favorites`

**Description**: User's favorited shops

**Columns**:
```sql
id              UUID PRIMARY KEY
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
shop_id         UUID NOT NULL REFERENCES shops(id) ON DELETE CASCADE
created_at      TIMESTAMPTZ DEFAULT NOW()
UNIQUE(user_id, shop_id)
```

### Feed Tables

#### 7. `public.feed_posts`

**Description**: User-generated content in feed

**Columns**:
```sql
id                  UUID PRIMARY KEY
author_id           UUID NOT NULL REFERENCES users(id)
tagged_shop_id      UUID REFERENCES shops(id)  -- Optional shop tag
content             TEXT NOT NULL
category            service_category ENUM
location_tag        TEXT              -- Location name/description
hashtags            TEXT[]            -- Array of hashtag strings
status              post_status ENUM DEFAULT 'active'
like_count          INTEGER DEFAULT 0    -- Singular: number of likes
comment_count       INTEGER DEFAULT 0    -- Singular: number of comments
view_count          INTEGER DEFAULT 0    -- Singular: number of views
report_count        INTEGER DEFAULT 0    -- Number of reports
moderation_status   VARCHAR DEFAULT 'approved'  -- 'approved' | 'pending' | 'rejected'
is_hidden           BOOLEAN DEFAULT FALSE
is_featured         BOOLEAN DEFAULT FALSE
hidden_at           TIMESTAMPTZ
created_at          TIMESTAMPTZ DEFAULT NOW()
updated_at          TIMESTAMPTZ DEFAULT NOW()
```

**ENUMS**:
- `post_status`: 'active' | 'hidden' | 'reported' | 'deleted'

#### 8. `public.post_images`

**Description**: Images attached to feed posts

**Columns**:
```sql
id              UUID PRIMARY KEY
post_id         UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE
image_url       TEXT NOT NULL
thumbnail_url   TEXT
alt_text        VARCHAR(255)
display_order   INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
```

#### 9. `public.post_likes`

**Description**: User likes on posts

**Columns**:
```sql
id          UUID PRIMARY KEY
post_id     UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE
user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
created_at  TIMESTAMPTZ DEFAULT NOW()
UNIQUE(post_id, user_id)
```

#### 10. `public.post_comments`

**Description**: Comments on feed posts

**Columns**:
```sql
id              UUID PRIMARY KEY
post_id         UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE
author_id       UUID NOT NULL REFERENCES users(id)
content         TEXT NOT NULL
status          comment_status ENUM DEFAULT 'active'
likes_count     INTEGER DEFAULT 0
created_at      TIMESTAMPTZ DEFAULT NOW()
updated_at      TIMESTAMPTZ DEFAULT NOW()
```

**ENUMS**:
- `comment_status`: 'active' | 'hidden' | 'deleted'

### Service Catalog Tables

#### 11. `public.shop_services`

**Description**: Shop-specific services offered by each beauty shop

**Columns**:
```sql
id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4()
shop_id                 UUID NOT NULL REFERENCES shops(id)
name                    VARCHAR(255) NOT NULL
description             TEXT
category                service_category NOT NULL
price_min               INTEGER
price_max               INTEGER
duration_minutes        INTEGER
deposit_amount          INTEGER
deposit_percentage      NUMERIC(5,2)
is_available            BOOLEAN DEFAULT TRUE
booking_advance_days    INTEGER DEFAULT 30
cancellation_hours      INTEGER DEFAULT 24
display_order           INTEGER DEFAULT 0
created_at              TIMESTAMPTZ DEFAULT NOW()
updated_at              TIMESTAMPTZ DEFAULT NOW()
```

**Note**: Prices are stored as INTEGER (in cents/won) for accurate financial calculations.

**Related Table**: `service_images` - Images for shop services
```sql
id                UUID PRIMARY KEY DEFAULT uuid_generate_v4()
service_id        UUID NOT NULL REFERENCES shop_services(id) ON DELETE CASCADE
image_url         TEXT NOT NULL
alt_text          VARCHAR(255)
display_order     INTEGER DEFAULT 0
created_at        TIMESTAMPTZ DEFAULT NOW()
```

### Notification Tables

#### 12. `public.notifications`

**Description**: User notifications

**Columns**:
```sql
id              UUID PRIMARY KEY
user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
type            notification_type ENUM NOT NULL
status          notification_status ENUM DEFAULT 'unread'
title           VARCHAR(255) NOT NULL
message         TEXT NOT NULL
data            JSONB  -- Additional context data
related_id      UUID  -- Related entity ID (reservation, post, etc.)
action_url      TEXT
created_at      TIMESTAMPTZ DEFAULT NOW()
read_at         TIMESTAMPTZ
```

**ENUMS**:
- `notification_type`: 'reservation_confirmed' | 'reservation_cancelled' | 'reservation_completed' | 'point_earned' | 'point_expired' | 'referral_success' | 'post_liked' | 'comment_added' | 'post_reported' | 'content_moderated' | 'system' | 'promotion' | 'shop_message'
- `notification_status`: 'unread' | 'read' | 'deleted'

---

## ❌ Error Handling

### Standard Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `AUTHENTICATION_REQUIRED` | 401 | JWT token missing or invalid |
| `FORBIDDEN` | 403 | User lacks required permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

### Error Response Examples

**Validation Error**:
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "입력값 검증 실패",
    "details": {
      "email": "유효한 이메일 주소를 입력하세요",
      "phoneNumber": "전화번호 형식이 올바르지 않습니다"
    }
  }
}
```

**Authentication Error**:
```json
{
  "success": false,
  "error": {
    "code": "AUTHENTICATION_REQUIRED",
    "message": "인증이 필요합니다",
    "details": "유효한 토큰을 제공하세요"
  }
}
```

**Rate Limit Error**:
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청 횟수 제한 초과",
    "details": "1분 후 다시 시도해주세요"
  }
}
```

### Frontend Error Handling Pattern

```dart
class ApiException implements Exception {
  final String code;
  final String message;
  final Map<String, dynamic>? details;
  final int statusCode;

  ApiException({
    required this.code,
    required this.message,
    this.details,
    required this.statusCode,
  });

  factory ApiException.fromResponse(http.Response response) {
    final body = jsonDecode(response.body);
    return ApiException(
      code: body['error']['code'],
      message: body['error']['message'],
      details: body['error']['details'],
      statusCode: response.statusCode,
    );
  }

  bool get isAuthError => statusCode == 401;
  bool get isNetworkError => statusCode >= 500;
  bool get isValidationError => code == 'VALIDATION_ERROR';
  bool get isRateLimitError => statusCode == 429;
}

// Usage
try {
  final shops = await apiClient.getNearbyShops(lat, lng);
} on ApiException catch (e) {
  if (e.isAuthError) {
    // Redirect to login
  } else if (e.isRateLimitError) {
    // Show rate limit message
  } else {
    // Show generic error
  }
}
```

---

## ⏱️ Rate Limiting

### Rate Limit Headers

All rate-limited endpoints return these headers:

```http
RateLimit-Limit: 200          # Max requests in window
RateLimit-Remaining: 195      # Remaining requests
RateLimit-Reset: 1706178000   # Unix timestamp when limit resets
```

### Rate Limits by Endpoint Category

| Category | Window | Max Requests | Example Endpoints |
|----------|--------|--------------|-------------------|
| **Authentication** | 15 min | 10 | `/auth/login`, `/auth/register` |
| **Profile Updates** | 15 min | 30 | `/users/profile` (PUT), `/users/settings` |
| **Public Browsing** | 15 min | 200 | `/shops`, `/shops/:id`, `/service-catalog` |
| **Search** | 1 min | 60 | `/shops/search`, `/service-catalog/search` |
| **Autocomplete** | 1 min | 120 | `/shops/search/suggestions` |
| **Feed Reads** | 15 min | 200 | GET `/user/feed/posts` |
| **Feed Writes** | 1 hour | 5 | POST `/user/feed/posts` |
| **Feed Interactions** | 5 min | 100 | POST/DELETE likes, comments |
| **Image Uploads** | 5 min | 10 | POST `/users/profile/image` |

### Handling Rate Limits

```dart
class ApiClient {
  Future<T> request<T>(/* ... */) async {
    final response = await http.get(uri, headers: headers);

    // Check rate limit headers
    final limit = response.headers['ratelimit-limit'];
    final remaining = response.headers['ratelimit-remaining'];
    final reset = response.headers['ratelimit-reset'];

    if (response.statusCode == 429) {
      final resetTime = DateTime.fromMillisecondsSinceEpoch(
        int.parse(reset!) * 1000
      );
      throw RateLimitException(resetTime: resetTime);
    }

    // Warn user when approaching limit
    if (remaining != null && int.parse(remaining) < 10) {
      showRateLimitWarning();
    }

    return parseResponse<T>(response);
  }
}
```

---

## 🎨 Frontend Integration Patterns

### 1. Authentication Flow

```dart
class AuthService {
  Future<AuthResponse> socialLogin(String provider, String token) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/social-login'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'provider': provider,
        'accessToken': token,
      }),
    );

    if (response.statusCode == 201) {
      final authData = AuthResponse.fromJson(jsonDecode(response.body));
      await _storeTokens(authData);
      return authData;
    }
    throw ApiException.fromResponse(response);
  }

  Future<void> _storeTokens(AuthResponse auth) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('accessToken', auth.accessToken);
    await prefs.setString('refreshToken', auth.refreshToken);
    await prefs.setInt('tokenExpiry',
      DateTime.now().millisecondsSinceEpoch + (auth.expiresIn * 1000)
    );
  }

  Future<String> getValidToken() async {
    final prefs = await SharedPreferences.getInstance();
    final token = prefs.getString('accessToken');
    final expiry = prefs.getInt('tokenExpiry');

    if (expiry != null && DateTime.now().millisecondsSinceEpoch > expiry) {
      // Token expired, refresh it
      final refreshToken = prefs.getString('refreshToken');
      return await refreshAccessToken(refreshToken!);
    }

    return token!;
  }
}
```

### 2. Shop Discovery with Location

```dart
class ShopService {
  Future<List<Shop>> discoverNearbyShops({
    required Position position,
    double radius = 5.0,
    String? category,
  }) async {
    final token = await authService.getValidToken();
    final queryParams = {
      'latitude': position.latitude.toString(),
      'longitude': position.longitude.toString(),
      'radius': radius.toString(),
      if (category != null) 'category': category,
      'limit': '20',
    };

    final uri = Uri.parse('$baseUrl/shops/nearby')
        .replace(queryParameters: queryParams);

    final response = await http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Content-Type': 'application/json',
      },
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      return (data['shops'] as List)
          .map((json) => Shop.fromJson(json))
          .toList();
    }
    throw ApiException.fromResponse(response);
  }
}

// Usage in UI
class NearbyShopsScreen extends StatefulWidget {
  @override
  _NearbyShopsScreenState createState() => _NearbyShopsScreenState();
}

class _NearbyShopsScreenState extends State<NearbyShopsScreen> {
  List<Shop> shops = [];
  bool isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadNearbyShops();
  }

  Future<void> _loadNearbyShops() async {
    setState(() => isLoading = true);

    try {
      final position = await Geolocator.getCurrentPosition();
      final nearbyShops = await shopService.discoverNearbyShops(
        position: position,
        radius: 5.0,
      );

      setState(() {
        shops = nearbyShops;
        isLoading = false;
      });
    } catch (e) {
      setState(() => isLoading = false);
      _showError(e.toString());
    }
  }
}
```

### 3. Infinite Scroll Pattern

```dart
class FeedScreen extends StatefulWidget {
  @override
  _FeedScreenState createState() => _FeedScreenState();
}

class _FeedScreenState extends State<FeedScreen> {
  final ScrollController _scrollController = ScrollController();
  List<Post> posts = [];
  int currentPage = 1;
  bool isLoading = false;
  bool hasMore = true;

  @override
  void initState() {
    super.initState();
    _scrollController.addListener(_onScroll);
    _loadPosts();
  }

  void _onScroll() {
    if (_scrollController.position.pixels ==
        _scrollController.position.maxScrollExtent) {
      _loadMore();
    }
  }

  Future<void> _loadPosts() async {
    if (isLoading || !hasMore) return;

    setState(() => isLoading = true);

    try {
      final response = await feedService.getPosts(
        page: currentPage,
        limit: 12,
      );

      setState(() {
        posts.addAll(response.posts);
        currentPage++;
        hasMore = response.hasMore;
        isLoading = false;
      });
    } catch (e) {
      setState(() => isLoading = false);
      _showError(e.toString());
    }
  }

  Future<void> _loadMore() {
    return _loadPosts();
  }

  @override
  Widget build(BuildContext context) {
    return ListView.builder(
      controller: _scrollController,
      itemCount: posts.length + (hasMore ? 1 : 0),
      itemBuilder: (context, index) {
        if (index == posts.length) {
          return Center(child: CircularProgressIndicator());
        }
        return PostCard(post: posts[index]);
      },
    );
  }
}
```

### 4. Optimistic Updates

```dart
class FeedService {
  Future<void> likePost(String postId) async {
    // Optimistic update - update UI immediately
    _updateLocalPostLike(postId, isLiked: true);

    try {
      // Make API call
      await http.post(
        Uri.parse('$baseUrl/user/feed/posts/$postId/like'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );
    } catch (e) {
      // Rollback on error
      _updateLocalPostLike(postId, isLiked: false);
      rethrow;
    }
  }

  void _updateLocalPostLike(String postId, {required bool isLiked}) {
    // Update local state/cache
    final post = _cachedPosts[postId];
    if (post != null) {
      post.isLiked = isLiked;
      post.likeCount += isLiked ? 1 : -1;  // Note: singular "likeCount"
      _notifyListeners();
    }
  }
}
```

### 5. Image Upload with Progress

```dart
class ProfileService {
  Future<String> uploadProfileImage(File imageFile) async {
    var request = http.MultipartRequest(
      'POST',
      Uri.parse('$baseUrl/users/profile/image'),
    );

    request.headers['Authorization'] = 'Bearer $token';

    // Add file
    request.files.add(await http.MultipartFile.fromPath(
      'image',
      imageFile.path,
    ));

    // Send with progress tracking
    var streamedResponse = await request.send();

    if (streamedResponse.statusCode == 200) {
      var responseBody = await streamedResponse.stream.bytesToString();
      return jsonDecode(responseBody)['data']['profileImageUrl'];
    }

    throw Exception('Upload failed');
  }
}

// Usage with progress
StreamedResponse uploadWithProgress(File file) async {
  var request = http.MultipartRequest(/* ... */);
  var file = await http.MultipartFile.fromPath(
    'image',
    imageFile.path,
  );

  request.files.add(file);

  var streamedResponse = await request.send();

  // Listen to progress
  streamedResponse.stream.listen(
    (value) {
      // Update progress
      var progress = (value.length / file.length) * 100;
      print('Upload progress: $progress%');
    },
    onDone: () => print('Upload complete'),
    onError: (e) => print('Upload error: $e'),
  );

  return streamedResponse;
}
```

### 6. Caching Strategy

```dart
class CachedApiClient {
  final Map<String, CachedResponse> _cache = {};
  final Duration defaultCacheDuration = Duration(minutes: 5);

  Future<T> get<T>(
    String endpoint, {
    Duration? cacheDuration,
    bool forceRefresh = false,
  }) async {
    final cacheKey = endpoint;
    final cached = _cache[cacheKey];

    // Check if cache is valid
    if (!forceRefresh && cached != null && !cached.isExpired) {
      return cached.data as T;
    }

    // Fetch fresh data
    final response = await http.get(
      Uri.parse('$baseUrl$endpoint'),
      headers: await _getHeaders(),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];

      // Cache the response
      _cache[cacheKey] = CachedResponse(
        data: data,
        expiresAt: DateTime.now().add(
          cacheDuration ?? defaultCacheDuration
        ),
      );

      return data as T;
    }

    throw ApiException.fromResponse(response);
  }

  void invalidateCache(String endpoint) {
    _cache.remove(endpoint);
  }

  void clearCache() {
    _cache.clear();
  }
}

class CachedResponse {
  final dynamic data;
  final DateTime expiresAt;

  CachedResponse({
    required this.data,
    required this.expiresAt,
  });

  bool get isExpired => DateTime.now().isAfter(expiresAt);
}
```

---

## 🔗 Related Documentation

- **Feed API Complete Guide**: `/claudedocs/USER_FEED_API_GUIDE.md` (1,240 lines)
- **Feed Consistency Report**: `/claudedocs/FEED_ENDPOINTS_CONSISTENCY_COMPLETE.md`
- **Backend CLAUDE.md**: `/CLAUDE.md` (Backend instructions)
- **API Swagger Docs**: `http://localhost:3001/api-docs` (Interactive documentation)

---

## 📞 Support & Resources

### API Documentation
- **Complete API Docs**: http://localhost:3001/api-docs
- **Admin API**: http://localhost:3001/admin-docs
- **Service API**: http://localhost:3001/service-docs
- **OpenAPI Specs**: `/api/openapi.json`, `/api/admin/openapi.json`, `/api/service/openapi.json`

### Testing Tools
- **Postman Collection**: Available from backend team
- **Sample Data**: Seed data available via `npm run seed`

### Development Environment
- **Backend Port**: 3001
- **Base URL**: http://localhost:3001/api
- **WebSocket**: ws://localhost:3001 (for real-time features)

---

**Document Version**: 1.0
**Last Updated**: 2025-01-25
**Maintained By**: Backend Team
**Questions**: Contact backend team via Slack #backend-support
