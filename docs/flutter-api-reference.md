# Flutter API Reference - 에뷰리띵 Backend

> **Last Updated**: 2025-10-04
> **Backend Version**: 1.0.0
> **Base URL**: `http://localhost:3001` (Dev) | `https://api.ebeautything.com` (Production)

## Table of Contents

- [Overview](#overview)
- [Base Configuration](#base-configuration)
- [Authentication](#authentication)
- [API Services](#api-services)
  - [1. AuthService](#1-authservice)
  - [2. ShopService](#2-shopservice)
  - [3. ReservationService](#3-reservationservice)
  - [4. PaymentService](#4-paymentservice)
  - [5. PointService](#5-pointservice)
  - [6. ReferralService](#6-referralservice)
  - [7. NotificationService](#7-notificationservice)
  - [8. FavoriteService](#8-favoriteservice)
  - [9. UserService](#9-userservice)
  - [10. AdminService](#10-adminservice)
- [Response Format Standards](#response-format-standards)
- [Error Handling](#error-handling)
- [Flutter Service Implementation Guide](#flutter-service-implementation-guide)

---

## Overview

This document provides a comprehensive reference for all REST API endpoints in the 에뷰리띵 backend, organized specifically for Flutter mobile app development.

### Key Features

- **Authentication**: Social login (Kakao, Apple, Google), Phone verification (PASS/SMS)
- **Shop Discovery**: Location-based search with PostGIS
- **Booking System**: Real-time availability and reservation management
- **Payment Processing**: TossPayments integration with two-stage payment
- **Points System**: Earn, use, and track points
- **Referral Program**: Referral codes, relationships, and influencer bonuses
- **Notifications**: Firebase Cloud Messaging (FCM) integration
- **Real-time**: WebSocket support for live updates

---

## Base Configuration

### Server Endpoints

```dart
class ApiConfig {
  static const String devBaseUrl = 'http://localhost:3001';
  static const String stagingBaseUrl = 'https://staging-api.ebeautything.com';
  static const String prodBaseUrl = 'https://api.ebeautything.com';

  static String get baseUrl {
    // Return based on environment
    return devBaseUrl;
  }
}
```

### Standard Headers

```dart
Map<String, String> get headers => {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

Map<String, String> get authHeaders => {
  ...headers,
  'Authorization': 'Bearer $accessToken',
};
```

### Rate Limits

| User Role | Requests per 15 min |
|-----------|---------------------|
| Guest | 50 |
| Authenticated User | 200 |
| Shop Owner | 500 |
| Admin | 1000 |
| Super Admin | 2000 |

---

## Authentication

All authenticated endpoints require a JWT token in the `Authorization` header:

```
Authorization: Bearer <your-jwt-token>
```

### Token Types

- **Access Token**: Short-lived (15 minutes), used for API requests
- **Refresh Token**: Long-lived (7 days), used to obtain new access tokens

### Token Refresh Flow

```dart
// When access token expires (401 response)
final refreshResponse = await http.post(
  Uri.parse('${ApiConfig.baseUrl}/api/auth/refresh'),
  headers: headers,
  body: jsonEncode({'refreshToken': refreshToken}),
);

if (refreshResponse.statusCode == 200) {
  final data = jsonDecode(refreshResponse.body);
  // Save new tokens
  accessToken = data['tokens']['accessToken'];
  refreshToken = data['tokens']['refreshToken'];
}
```

---

## API Services

## 1. AuthService

Authentication, registration, and token management.

### 1.1 Social Login

**Endpoint**: `POST /api/auth/social-login`
**Authentication**: Not required
**Rate Limit**: Enhanced with progressive penalties

**Request Body**:
```dart
{
  "provider": "kakao" | "apple" | "google",
  "token": "string",  // Social provider access token
  "fcmToken": "string",  // Optional: Firebase FCM token
  "deviceInfo": {  // Optional
    "deviceId": "string",
    "platform": "ios" | "android" | "web",
    "version": "string"
  }
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "string",
      "name": "string",
      "phoneNumber": "string",
      "profileImageUrl": "string",
      "role": "customer" | "shop_owner" | "admin",
      "status": "active" | "inactive" | "suspended"
    },
    "tokens": {
      "accessToken": "string",
      "refreshToken": "string",
      "expiresIn": 900  // seconds
    },
    "isNewUser": boolean,
    "profileComplete": boolean
  }
}
```

**Flutter Example**:
```dart
class AuthService {
  Future<LoginResponse> socialLogin({
    required String provider,
    required String token,
    String? fcmToken,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/auth/social-login'),
      headers: headers,
      body: jsonEncode({
        'provider': provider,
        'token': token,
        'fcmToken': fcmToken,
      }),
    );

    if (response.statusCode == 200) {
      return LoginResponse.fromJson(jsonDecode(response.body));
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 1.2 Complete Registration

**Endpoint**: `POST /api/auth/register`
**Authentication**: Required (partial user from social login)
**Rate Limit**: Strict (same as login)

**Request Body**:
```dart
{
  "name": "string",  // Required
  "phoneNumber": "string",  // Required
  "birthDate": "YYYY-MM-DD",  // Required
  "termsAccepted": boolean,  // Required
  "privacyAccepted": boolean,  // Required
  "email": "string",  // Optional
  "gender": "male" | "female" | "other",  // Optional
  "nickname": "string",  // Optional
  "referredByCode": "string",  // Optional
  "marketingConsent": boolean  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "user": { /* User object */ },
    "profileComplete": true,
    "referralCode": "string",  // User's own referral code
    "message": "Registration completed successfully"
  }
}
```

### 1.3 Phone Verification - Send Code

**Endpoint**: `POST /api/auth/send-verification-code`
**Authentication**: Not required
**Rate Limit**: Strict

**Request Body**:
```dart
{
  "phoneNumber": "string",  // Required
  "method": "pass" | "sms",  // Optional, default: "sms"
  "userId": "uuid"  // Optional: for existing users
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "method": "pass" | "sms",
    "txId": "string",  // Transaction ID for verification
    "redirectUrl": "string",  // For PASS method only
    "expiresAt": "ISO 8601 datetime",
    "message": "Verification code sent successfully"
  }
}
```

### 1.4 Phone Verification - Verify Code

**Endpoint**: `POST /api/auth/verify-phone`
**Authentication**: Not required
**Rate Limit**: Strict

**Request Body**:
```dart
{
  "txId": "string",  // Required
  "method": "pass" | "sms",  // Required
  "otpCode": "string",  // Required for SMS method
  "passResult": object  // Required for PASS method
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "verified": true,
    "userId": "uuid",  // If existing user
    "phoneNumber": "string",
    "method": "pass" | "sms",
    "message": "Phone verified successfully"
  }
}
```

### 1.5 Refresh Token

**Endpoint**: `POST /api/auth/refresh`
**Authentication**: Not required (uses refresh token)
**Rate Limit**: Strict

**Request Body**:
```dart
{
  "refreshToken": "string",  // Required
  "deviceInfo": {  // Optional
    "deviceId": "string",
    "platform": "ios" | "android" | "web",
    "version": "string"
  }
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "accessToken": "string",
    "refreshToken": "string",  // New refresh token (rotation)
    "expiresIn": 900
  }
}
```

### 1.6 Logout

**Endpoint**: `POST /api/auth/logout`
**Authentication**: Optional (graceful if token invalid)
**Rate Limit**: Standard

**Request Body**:
```dart
{
  "refreshToken": "string"  // Required
}
```

**Response (200)**:
```dart
{
  "success": true,
  "message": "Logged out successfully"
}
```

### 1.7 Logout All Devices

**Endpoint**: `POST /api/auth/logout-all`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```dart
{
  "success": true,
  "message": "Logged out from all devices successfully"
}
```

### 1.8 Get Active Sessions

**Endpoint**: `GET /api/auth/sessions`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "sessions": [
      {
        "id": "uuid",
        "deviceInfo": {
          "deviceId": "string",
          "platform": "ios" | "android" | "web",
          "version": "string"
        },
        "lastActive": "ISO 8601 datetime",
        "createdAt": "ISO 8601 datetime",
        "isCurrent": boolean
      }
    ]
  }
}
```

---

## 2. ShopService

Shop discovery, details, and management.

### 2.1 Get All Shops

**Endpoint**: `GET /api/shops`
**Authentication**: Not required
**Rate Limit**: 200 per 15 min

**Query Parameters**:
```dart
{
  "status": "active" | "pending" | "suspended",  // Optional
  "category": "nail" | "hair" | "makeup" | "skincare" | "massage" | "tattoo" | "piercing" | "eyebrow" | "eyelash",  // Optional
  "shopType": "partnered" | "non_partnered",  // Optional
  "ownerId": "uuid",  // Optional
  "limit": number,  // Optional, default: 50, max: 100
  "offset": number  // Optional, default: 0
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "phoneNumber": "string",
        "email": "string",
        "address": "string",
        "detailedAddress": "string",
        "postalCode": "string",
        "latitude": number,
        "longitude": number,
        "mainCategory": "nail" | "hair" | ...,
        "subCategories": ["string"],
        "operatingHours": object,
        "paymentMethods": ["cash", "card", "mobile_payment", "bank_transfer"],
        "kakaoChannelUrl": "string",
        "businessLicenseNumber": "string",
        "status": "active" | "pending" | "suspended",
        "shopType": "partnered" | "non_partnered",
        "isFeatured": boolean,
        "rating": number,
        "reviewCount": number,
        "images": ["string"],
        "createdAt": "ISO 8601 datetime",
        "updatedAt": "ISO 8601 datetime"
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

### 2.2 Get Nearby Shops (Location-Based)

**Endpoint**: `GET /api/shops/nearby`
**Authentication**: Not required
**Rate Limit**: 100 per 15 min (search limit)

**Query Parameters**:
```dart
{
  "latitude": "string",  // Required (e.g., "37.5665")
  "longitude": "string",  // Required (e.g., "126.9780")
  "radius": "string",  // Optional, default: "10" (km)
  "category": "nail" | "hair" | ...,  // Optional
  "shopType": "partnered" | "non_partnered",  // Optional
  "onlyFeatured": "true" | "false",  // Optional
  "limit": "string",  // Optional, default: "50"
  "offset": "string"  // Optional, default: "0"
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shops": [ /* Array of shop objects */ ],
    "totalCount": number,
    "hasMore": boolean,
    "center": {
      "latitude": number,
      "longitude": number
    },
    "radius": number
  }
}
```

**Flutter Example**:
```dart
class ShopService {
  Future<NearbyShopsResponse> getNearbyShops({
    required double latitude,
    required double longitude,
    double radius = 10.0,
    String? category,
    int limit = 20,
  }) async {
    final queryParams = {
      'latitude': latitude.toString(),
      'longitude': longitude.toString(),
      'radius': radius.toString(),
      if (category != null) 'category': category,
      'limit': limit.toString(),
    };

    final uri = Uri.parse('${ApiConfig.baseUrl}/api/shops/nearby')
        .replace(queryParameters: queryParams);

    final response = await http.get(uri, headers: headers);

    if (response.statusCode == 200) {
      return NearbyShopsResponse.fromJson(jsonDecode(response.body));
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 2.3 Get Shops in Map Bounds

**Endpoint**: `GET /api/shops/bounds`
**Authentication**: Not required
**Rate Limit**: 100 per 15 min (search limit)

**Query Parameters**:
```dart
{
  "neLat": "string",  // Required: North-East latitude
  "neLng": "string",  // Required: North-East longitude
  "swLat": "string",  // Required: South-West latitude
  "swLng": "string",  // Required: South-West longitude
  "category": "nail" | "hair" | ...,  // Optional
  "shopType": "partnered" | "non_partnered",  // Optional
  "onlyFeatured": "true" | "false"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shops": [ /* Array of shop objects */ ],
    "totalCount": number,
    "bounds": {
      "northEast": {"lat": number, "lng": number},
      "southWest": {"lat": number, "lng": number}
    }
  }
}
```

### 2.4 Get Shop Details

**Endpoint**: `GET /api/shops/:id`
**Authentication**: Not required
**Rate Limit**: 200 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shop": { /* Complete shop object with all details */ },
    "services": [
      {
        "id": "uuid",
        "name": "string",
        "description": "string",
        "price": number,
        "duration": number,  // minutes
        "category": "string"
      }
    ],
    "operatingHours": {
      "monday": {"open": "09:00", "close": "18:00", "closed": false},
      "tuesday": {"open": "09:00", "close": "18:00", "closed": false},
      // ... other days
    },
    "contactMethods": [
      {
        "methodType": "phone" | "email" | "kakao_channel" | "instagram" | "facebook" | "website",
        "value": "string",
        "description": "string",
        "displayOrder": number
      }
    ]
  }
}
```

### 2.5 Get Shop Contact Info

**Endpoint**: `GET /api/shops/:id/contact-info`
**Authentication**: Not required
**Rate Limit**: 60 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shopId": "uuid",
    "contactMethods": [
      {
        "methodType": "phone" | "email" | "kakao_channel" | "instagram" | "facebook" | "website" | "other",
        "value": "string",
        "description": "string",
        "displayOrder": number
      }
    ]
  }
}
```

### 2.6 Create Shop (Shop Owner)

**Endpoint**: `POST /api/shops`
**Authentication**: Required (shop owner role)
**Rate Limit**: 200 per 15 min

**Request Body**:
```dart
{
  "name": "string",  // Required
  "address": "string",  // Required
  "mainCategory": "nail" | "hair" | ...,  // Required
  "description": "string",  // Optional
  "phoneNumber": "string",  // Optional
  "email": "string",  // Optional
  "detailedAddress": "string",  // Optional
  "postalCode": "string",  // Optional
  "latitude": number,  // Optional
  "longitude": number,  // Optional
  "subCategories": ["string"],  // Optional
  "operatingHours": object,  // Optional
  "paymentMethods": ["cash", "card", "mobile_payment", "bank_transfer"],  // Optional
  "kakaoChannelUrl": "string",  // Optional
  "businessLicenseNumber": "string"  // Optional
}
```

**Response (201)**:
```dart
{
  "success": true,
  "data": {
    "shop": { /* Created shop object */ },
    "message": "Shop created successfully"
  }
}
```

### 2.7 Update Shop

**Endpoint**: `PUT /api/shops/:id`
**Authentication**: Required (shop owner)
**Rate Limit**: 200 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Request Body**: Same as Create Shop (all fields optional)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shop": { /* Updated shop object */ },
    "message": "Shop updated successfully"
  }
}
```

### 2.8 Delete Shop (Soft Delete)

**Endpoint**: `DELETE /api/shops/:id`
**Authentication**: Required (shop owner)
**Rate Limit**: 200 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "message": "Shop deleted successfully"
}
```

---

## 3. ReservationService

Booking, availability, and reservation management.

### 3.1 Get Available Time Slots

**Endpoint**: `GET /api/shops/:shopId/available-slots`
**Authentication**: Not required
**Rate Limit**: 100 per 15 min

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Query Parameters**:
```dart
{
  "date": "YYYY-MM-DD",  // Required
  "serviceIds[]": ["uuid"],  // Required: Array of service UUIDs
  "startTime": "HH:MM",  // Optional: Filter start time
  "endTime": "HH:MM",  // Optional: Filter end time
  "interval": number  // Optional: Interval in minutes, default: 30
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "date": "YYYY-MM-DD",
    "slots": [
      {
        "time": "HH:MM",
        "available": boolean,
        "capacity": number,
        "bookedCount": number,
        "estimatedDuration": number  // minutes
      }
    ],
    "shopOperatingHours": {
      "open": "HH:MM",
      "close": "HH:MM",
      "closed": boolean
    }
  }
}
```

**Flutter Example**:
```dart
class ReservationService {
  Future<AvailableSlotsResponse> getAvailableSlots({
    required String shopId,
    required DateTime date,
    required List<String> serviceIds,
  }) async {
    final queryParams = {
      'date': DateFormat('yyyy-MM-dd').format(date),
      ...serviceIds.asMap().map(
        (i, id) => MapEntry('serviceIds[$i]', id),
      ),
    };

    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/api/shops/$shopId/available-slots'
    ).replace(queryParameters: queryParams);

    final response = await http.get(uri, headers: headers);

    if (response.statusCode == 200) {
      return AvailableSlotsResponse.fromJson(jsonDecode(response.body));
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 3.2 Create Reservation

**Endpoint**: `POST /api/reservations`
**Authentication**: Required
**Rate Limit**: 20 per 15 min

**Request Body**:
```dart
{
  "shopId": "uuid",  // Required
  "services": [  // Required
    {
      "serviceId": "uuid",  // Required
      "quantity": number  // Optional, default: 1, max: 10
    }
  ],
  "reservationDate": "YYYY-MM-DD",  // Required
  "reservationTime": "HH:MM",  // Required
  "specialRequests": "string",  // Optional, max 500 chars
  "pointsToUse": number,  // Optional, min: 0
  "paymentInfo": {  // Optional
    "depositAmount": number,
    "remainingAmount": number,
    "paymentMethod": "card" | "cash" | "points" | "mixed",
    "depositRequired": boolean
  },
  "notificationPreferences": {  // Optional
    "emailNotifications": boolean,
    "smsNotifications": boolean,
    "pushNotifications": boolean
  }
}
```

**Response (201)**:
```dart
{
  "success": true,
  "data": {
    "reservationId": "uuid",
    "status": "requested" | "confirmed",
    "totalAmount": number,
    "depositAmount": number,
    "pointsUsed": number,
    "finalAmount": number,
    "reservation": {
      "id": "uuid",
      "shopId": "uuid",
      "userId": "uuid",
      "services": [ /* Service details */ ],
      "reservationDateTime": "ISO 8601 datetime",
      "status": "requested",
      "createdAt": "ISO 8601 datetime"
    },
    "message": "Reservation created successfully"
  }
}
```

### 3.3 Get User Reservations

**Endpoint**: `GET /api/reservations`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Query Parameters**:
```dart
{
  "status": "requested" | "confirmed" | "completed" | "cancelled_by_user" | "cancelled_by_shop" | "no_show",  // Optional
  "startDate": "YYYY-MM-DD",  // Optional
  "endDate": "YYYY-MM-DD",  // Optional
  "shopId": "uuid",  // Optional
  "page": number,  // Optional, default: 1
  "limit": number  // Optional, default: 20, max: 100
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "shopName": "string",
        "shopAddress": "string",
        "services": [
          {
            "serviceId": "uuid",
            "serviceName": "string",
            "price": number,
            "duration": number,
            "quantity": number
          }
        ],
        "reservationDateTime": "ISO 8601 datetime",
        "status": "requested" | "confirmed" | "completed" | "cancelled_by_user" | "cancelled_by_shop" | "no_show",
        "totalAmount": number,
        "depositAmount": number,
        "finalAmount": number,
        "pointsUsed": number,
        "specialRequests": "string",
        "createdAt": "ISO 8601 datetime",
        "updatedAt": "ISO 8601 datetime"
      }
    ],
    "totalCount": number,
    "page": number,
    "limit": number,
    "hasMore": boolean
  }
}
```

### 3.4 Get Reservation Details

**Endpoint**: `GET /api/reservations/:id`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Path Parameters**:
- `id`: Reservation UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "reservation": { /* Complete reservation object */ },
    "shop": { /* Shop details */ },
    "payment": {  // If payment exists
      "id": "uuid",
      "status": "pending" | "deposit_paid" | "fully_paid" | "failed" | "refunded",
      "depositAmount": number,
      "finalAmount": number,
      "totalAmount": number,
      "paymentMethod": "string",
      "paidAt": "ISO 8601 datetime"
    }
  }
}
```

### 3.5 Cancel Reservation

**Endpoint**: `PUT /api/reservations/:id/cancel`
**Authentication**: Required
**Rate Limit**: 10 per 15 min

**Path Parameters**:
- `id`: Reservation UUID (required)

**Request Body**:
```dart
{
  "reason": "string",  // Optional, max 500 chars
  "cancellationType": "user_request" | "shop_request" | "no_show" | "admin_force",  // Optional
  "refundPreference": "full_refund" | "partial_refund" | "no_refund",  // Optional
  "notifyShop": boolean,  // Optional, default: true
  "notifyCustomer": boolean  // Optional, default: true
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "reservationId": "uuid",
    "status": "cancelled_by_user" | "cancelled_by_shop",
    "cancelledAt": "ISO 8601 datetime",
    "refundAmount": number,
    "refundStatus": "pending" | "processing" | "completed" | "failed",
    "message": "Reservation cancelled successfully"
  }
}
```

---

## 4. PaymentService

TossPayments integration for deposit and final payments.

### 4.1 Prepare Payment

**Endpoint**: `POST /api/payments/toss/prepare`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Request Body**:
```dart
{
  "reservationId": "uuid",  // Required
  "amount": number,  // Required, min: 1000 KRW
  "customerName": "string",  // Required
  "customerEmail": "string",  // Required (email format)
  "customerMobilePhone": "string",  // Optional
  "paymentType": "deposit" | "final"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "paymentKey": "string",
    "orderId": "string",
    "amount": number,
    "customerName": "string",
    "successUrl": "string",
    "failUrl": "string",
    "message": "Payment prepared successfully"
  }
}
```

**Flutter Example**:
```dart
class PaymentService {
  Future<PreparePaymentResponse> preparePayment({
    required String reservationId,
    required int amount,
    required String customerName,
    required String customerEmail,
    String? customerPhone,
  }) async {
    final response = await http.post(
      Uri.parse('${ApiConfig.baseUrl}/api/payments/toss/prepare'),
      headers: authHeaders,
      body: jsonEncode({
        'reservationId': reservationId,
        'amount': amount,
        'customerName': customerName,
        'customerEmail': customerEmail,
        'customerMobilePhone': customerPhone,
      }),
    );

    if (response.statusCode == 200) {
      return PreparePaymentResponse.fromJson(jsonDecode(response.body));
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 4.2 Confirm Payment

**Endpoint**: `POST /api/payments/toss/confirm`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Request Body**:
```dart
{
  "paymentKey": "string",  // Required (from TossPayments)
  "orderId": "string",  // Required
  "amount": number  // Required
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "paymentId": "uuid",
    "status": "deposit_paid" | "fully_paid",
    "paidAt": "ISO 8601 datetime",
    "amount": number,
    "paymentMethod": "string",
    "message": "Payment confirmed successfully"
  }
}
```

### 4.3 Prepare Deposit Payment

**Endpoint**: `POST /api/payments/deposit/prepare`
**Authentication**: Required
**Rate Limit**: Payment rate limit

Same as Prepare Payment but specifically for deposit (20-30% of total).

### 4.4 Prepare Final Payment

**Endpoint**: `POST /api/payments/final/prepare`
**Authentication**: Required
**Rate Limit**: Payment rate limit

Same as Prepare Payment but specifically for final payment (remaining amount after service).

### 4.5 Get Payment Status

**Endpoint**: `GET /api/payments/status/:reservationId`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Path Parameters**:
- `reservationId`: Reservation UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "reservationId": "uuid",
    "paymentStatus": "pending" | "deposit_paid" | "fully_paid" | "failed" | "refunded",
    "totalAmount": number,
    "depositAmount": number,
    "depositPaid": boolean,
    "depositPaidAt": "ISO 8601 datetime",
    "finalAmount": number,
    "finalPaid": boolean,
    "finalPaidAt": "ISO 8601 datetime",
    "payments": [
      {
        "id": "uuid",
        "type": "deposit" | "final",
        "amount": number,
        "status": "success" | "failed",
        "paymentMethod": "string",
        "paidAt": "ISO 8601 datetime"
      }
    ]
  }
}
```

### 4.6 Get Payment Details

**Endpoint**: `GET /api/payments/:paymentId`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Path Parameters**:
- `paymentId`: Payment UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "id": "uuid",
    "reservationId": "uuid",
    "amount": number,
    "status": "pending" | "deposit_paid" | "fully_paid" | "failed" | "refunded",
    "paymentMethod": "string",
    "paidAt": "ISO 8601 datetime",
    "tossPaymentKey": "string",
    "orderId": "string",
    "createdAt": "ISO 8601 datetime"
  }
}
```

### 4.7 Get User Payment History

**Endpoint**: `GET /api/payments/user/:userId`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Path Parameters**:
- `userId`: User UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "uuid",
        "reservationId": "uuid",
        "shopName": "string",
        "amount": number,
        "status": "string",
        "paymentMethod": "string",
        "paidAt": "ISO 8601 datetime"
      }
    ],
    "totalCount": number
  }
}
```

---

## 5. PointService

Points earning, usage, and balance management.

### 5.1 Get User Point Balance

**Endpoint**: `GET /api/points/users/:userId/points/balance`
**Authentication**: Required
**Rate Limit**: Standard

**Path Parameters**:
- `userId`: User UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "userId": "uuid",
    "balance": number,
    "totalEarned": number,
    "totalUsed": number,
    "expiringPoints": number,
    "nextExpirationDate": "ISO 8601 datetime"
  }
}
```

**Flutter Example**:
```dart
class PointService {
  Future<PointBalance> getBalance(String userId) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/points/users/$userId/points/balance'),
      headers: authHeaders,
    );

    if (response.statusCode == 200) {
      return PointBalance.fromJson(jsonDecode(response.body)['data']);
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 5.2 Get Point Transaction History

**Endpoint**: `GET /api/points/users/:userId/points/history`
**Authentication**: Required
**Rate Limit**: Standard

**Path Parameters**:
- `userId`: User UUID (required)

**Query Parameters**:
```dart
{
  "type": "earn" | "use" | "expire" | "refund",  // Optional
  "startDate": "YYYY-MM-DD",  // Optional
  "endDate": "YYYY-MM-DD",  // Optional
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "uuid",
        "type": "earn" | "use" | "expire" | "refund",
        "amount": number,
        "balance": number,  // Balance after transaction
        "source": "reservation" | "referral" | "admin_adjustment" | "promotion",
        "description": "string",
        "relatedId": "uuid",  // Related reservation/referral ID
        "createdAt": "ISO 8601 datetime",
        "expiresAt": "ISO 8601 datetime"  // For earned points
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

### 5.3 Use Points

**Endpoint**: `POST /api/points/use`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**:
```dart
{
  "amount": number,  // Required, min: 0
  "reservationId": "uuid",  // Required
  "description": "string"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "pointsUsed": number,
    "remainingBalance": number,
    "message": "Points used successfully"
  }
}
```

### 5.4 Earn Points (System)

**Endpoint**: `POST /api/points/earn`
**Authentication**: Required (internal use)
**Rate Limit**: Standard

**Request Body**:
```dart
{
  "userId": "uuid",  // Required
  "amount": number,  // Required
  "source": "reservation" | "referral" | "promotion",  // Required
  "relatedId": "uuid",  // Optional
  "description": "string",  // Optional
  "expirationDays": number  // Optional, default: 365
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "transactionId": "uuid",
    "pointsEarned": number,
    "newBalance": number,
    "expiresAt": "ISO 8601 datetime"
  }
}
```

---

## 6. ReferralService

Referral code management, validation, and relationships.

### 6.1 Generate Referral Code

**Endpoint**: `POST /api/referral-codes/generate`
**Authentication**: Required
**Rate Limit**: Referral code rate limit

**Request Body**:
```dart
{
  "length": number,  // Optional, min: 4, max: 12
  "excludeSimilar": boolean,  // Optional
  "excludeProfanity": boolean  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "code": "string",  // Generated code (uppercase alphanumeric)
    "userId": "uuid",
    "createdAt": "ISO 8601 datetime",
    "expiresAt": "ISO 8601 datetime",  // If applicable
    "message": "Referral code generated successfully"
  }
}
```

### 6.2 Validate Referral Code

**Endpoint**: `GET /api/referral-codes/validate/:code`
**Authentication**: Not required
**Rate Limit**: Referral code rate limit

**Path Parameters**:
- `code`: Referral code (required, 4-12 chars, uppercase alphanumeric)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "valid": boolean,
    "code": "string",
    "ownerId": "uuid",
    "ownerName": "string",
    "usageCount": number,
    "maxUsage": number,  // If limited
    "expiresAt": "ISO 8601 datetime",  // If applicable
    "isActive": boolean
  }
}
```

**Flutter Example**:
```dart
class ReferralService {
  Future<bool> validateCode(String code) async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/referral-codes/validate/$code'),
      headers: headers,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      return data['valid'] == true;
    }
    return false;
  }
}
```

### 6.3 Get Referral Relationships

**Endpoint**: `GET /api/referral-relationships`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```dart
{
  "type": "referred" | "referrer",  // Optional: Get users I referred or who referred me
  "status": "active" | "inactive",  // Optional
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "relationships": [
      {
        "id": "uuid",
        "referrerId": "uuid",
        "referrerName": "string",
        "referredId": "uuid",
        "referredName": "string",
        "referralCode": "string",
        "status": "active" | "inactive",
        "createdAt": "ISO 8601 datetime",
        "totalEarnings": number
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

### 6.4 Get Referral Earnings

**Endpoint**: `GET /api/referral-earnings`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```dart
{
  "startDate": "YYYY-MM-DD",  // Optional
  "endDate": "YYYY-MM-DD",  // Optional
  "status": "pending" | "paid" | "cancelled",  // Optional
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "earnings": [
      {
        "id": "uuid",
        "referralId": "uuid",
        "amount": number,
        "source": "reservation" | "signup_bonus",
        "status": "pending" | "paid" | "cancelled",
        "paidAt": "ISO 8601 datetime",
        "createdAt": "ISO 8601 datetime"
      }
    ],
    "totalEarnings": number,
    "pendingEarnings": number,
    "paidEarnings": number,
    "totalCount": number
  }
}
```

---

## 7. NotificationService

Push notifications and notification settings.

### 7.1 Register Device Token

**Endpoint**: `POST /api/notifications/register-token`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**:
```dart
{
  "token": "string",  // Required: Firebase FCM token
  "deviceType": "android" | "ios" | "web",  // Required
  "deviceId": "string",  // Optional
  "deviceName": "string"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "tokenId": "uuid",
    "isActive": true,
    "message": "Device token registered successfully"
  }
}
```

### 7.2 Get Notification Settings

**Endpoint**: `GET /api/notifications/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "userId": "uuid",
    "pushEnabled": boolean,
    "emailEnabled": boolean,
    "smsEnabled": boolean,
    "reservationUpdates": boolean,
    "paymentNotifications": boolean,
    "promotionalMessages": boolean,
    "systemAlerts": boolean,
    "updatedAt": "ISO 8601 datetime"
  }
}
```

### 7.3 Update Notification Settings

**Endpoint**: `PUT /api/notifications/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**:
```dart
{
  "pushEnabled": boolean,  // Optional
  "emailEnabled": boolean,  // Optional
  "smsEnabled": boolean,  // Optional
  "reservationUpdates": boolean,  // Optional
  "paymentNotifications": boolean,  // Optional
  "promotionalMessages": boolean,  // Optional
  "systemAlerts": boolean  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "settings": { /* Updated settings object */ },
    "message": "Notification settings updated successfully"
  }
}
```

### 7.4 Get Notification History

**Endpoint**: `GET /api/notifications/history`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```dart
{
  "status": "sent" | "failed" | "pending",  // Optional
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "uuid",
        "title": "string",
        "body": "string",
        "data": object,  // Additional data
        "status": "sent" | "failed" | "pending",
        "sentAt": "ISO 8601 datetime",
        "errorMessage": "string",  // If failed
        "createdAt": "ISO 8601 datetime"
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

---

## 8. FavoriteService

User shop favorites management.

### 8.1 Add Shop to Favorites

**Endpoint**: `POST /api/shops/:shopId/favorite`
**Authentication**: Required
**Rate Limit**: 50 per 15 min (modification limit)

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "isFavorite": true,
    "favoriteId": "uuid",
    "message": "Shop added to favorites successfully"
  }
}
```

### 8.2 Remove Shop from Favorites

**Endpoint**: `DELETE /api/shops/:shopId/favorite`
**Authentication**: Required
**Rate Limit**: 50 per 15 min (modification limit)

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "isFavorite": false,
    "message": "Shop removed from favorites successfully"
  }
}
```

### 8.3 Get User Favorites

**Endpoint**: `GET /api/favorites`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Query Parameters**:
```dart
{
  "limit": number,  // Optional, min: 1, max: 100
  "offset": number,  // Optional, min: 0
  "category": "nail" | "hair" | ...,  // Optional
  "sortBy": "recent" | "name" | "bookings"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "favorites": [
      {
        "id": "uuid",
        "shopId": "uuid",
        "shop": {
          "id": "uuid",
          "name": "string",
          "address": "string",
          "mainCategory": "string",
          "rating": number,
          "reviewCount": number,
          "images": ["string"]
        },
        "createdAt": "ISO 8601 datetime"
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

**Flutter Example**:
```dart
class FavoriteService {
  Future<void> toggleFavorite(String shopId, bool isFavorite) async {
    final uri = Uri.parse(
      '${ApiConfig.baseUrl}/api/shops/$shopId/favorite'
    );

    final response = isFavorite
        ? await http.delete(uri, headers: authHeaders)
        : await http.post(uri, headers: authHeaders);

    if (response.statusCode != 200) {
      throw ApiException.fromResponse(response);
    }
  }

  Future<List<FavoriteShop>> getFavorites() async {
    final response = await http.get(
      Uri.parse('${ApiConfig.baseUrl}/api/favorites'),
      headers: authHeaders,
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      return (data['favorites'] as List)
          .map((json) => FavoriteShop.fromJson(json))
          .toList();
    }
    throw ApiException.fromResponse(response);
  }
}
```

### 8.4 Check Favorite Status (Bulk)

**Endpoint**: `POST /api/favorites/check`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Request Body**:
```dart
{
  "shopIds": ["uuid"]  // Required, min: 1, max: 100
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "favorites": {
      "uuid": boolean,  // shopId: isFavorite
      "uuid": boolean
    }
  }
}
```

---

## 9. UserService

User profile and settings management.

### 9.1 Get User Profile

**Endpoint**: `GET /api/users/:userId/profile`
**Authentication**: Required
**Rate Limit**: Standard

**Path Parameters**:
- `userId`: User UUID (required)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "string",
    "email": "string",
    "phoneNumber": "string",
    "birthDate": "YYYY-MM-DD",
    "gender": "male" | "female" | "other",
    "nickname": "string",
    "profileImageUrl": "string",
    "role": "customer" | "shop_owner" | "admin",
    "status": "active" | "inactive" | "suspended",
    "referralCode": "string",
    "createdAt": "ISO 8601 datetime",
    "updatedAt": "ISO 8601 datetime"
  }
}
```

### 9.2 Update User Profile

**Endpoint**: `PUT /api/users/:userId/profile`
**Authentication**: Required
**Rate Limit**: Standard

**Path Parameters**:
- `userId`: User UUID (required)

**Request Body**:
```dart
{
  "name": "string",  // Optional
  "email": "string",  // Optional
  "birthDate": "YYYY-MM-DD",  // Optional
  "gender": "male" | "female" | "other",  // Optional
  "nickname": "string",  // Optional
  "profileImageUrl": "string"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "user": { /* Updated user object */ },
    "message": "Profile updated successfully"
  }
}
```

### 9.3 Get User Settings

**Endpoint**: `GET /api/users/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "userId": "uuid",
    "language": "ko" | "en",
    "timezone": "string",
    "currency": "KRW",
    "notifications": {
      "pushEnabled": boolean,
      "emailEnabled": boolean,
      "smsEnabled": boolean
    },
    "privacy": {
      "showProfile": boolean,
      "showActivity": boolean
    },
    "updatedAt": "ISO 8601 datetime"
  }
}
```

### 9.4 Update User Settings

**Endpoint**: `PUT /api/users/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**: Same as Get User Settings (all fields optional)

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "settings": { /* Updated settings object */ },
    "message": "Settings updated successfully"
  }
}
```

---

## 10. AdminService

Administrative operations (admin/super_admin only).

### 10.1 Get All Users (Admin)

**Endpoint**: `GET /api/admin/users`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min (admin)

**Query Parameters**:
```dart
{
  "status": "active" | "inactive" | "suspended",  // Optional
  "role": "customer" | "shop_owner" | "admin",  // Optional
  "search": "string",  // Optional: search by name/email/phone
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "users": [ /* Array of user objects */ ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

### 10.2 Update User Status (Admin)

**Endpoint**: `PUT /api/admin/users/:userId/status`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Path Parameters**:
- `userId`: User UUID (required)

**Request Body**:
```dart
{
  "status": "active" | "inactive" | "suspended",  // Required
  "reason": "string"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "userId": "uuid",
    "status": "active" | "inactive" | "suspended",
    "message": "User status updated successfully"
  }
}
```

### 10.3 Get Shop Approval Queue (Admin)

**Endpoint**: `GET /api/admin/shops/approval`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Query Parameters**:
```dart
{
  "status": "pending" | "approved" | "rejected",  // Optional
  "page": number,  // Optional
  "limit": number  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "uuid",
        "name": "string",
        "ownerId": "uuid",
        "ownerName": "string",
        "status": "pending" | "approved" | "rejected",
        "submittedAt": "ISO 8601 datetime",
        "reviewedAt": "ISO 8601 datetime",
        "reviewedBy": "uuid",
        "rejectionReason": "string"
      }
    ],
    "totalCount": number,
    "hasMore": boolean
  }
}
```

### 10.4 Approve/Reject Shop (Admin)

**Endpoint**: `PUT /api/admin/shops/:shopId/approval`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Request Body**:
```dart
{
  "action": "approve" | "reject",  // Required
  "reason": "string"  // Optional for approve, required for reject
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "shopId": "uuid",
    "status": "approved" | "rejected",
    "message": "Shop approval status updated successfully"
  }
}
```

### 10.5 Admin Analytics

**Endpoint**: `GET /api/admin/analytics`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Query Parameters**:
```dart
{
  "startDate": "YYYY-MM-DD",  // Optional
  "endDate": "YYYY-MM-DD",  // Optional
  "metric": "users" | "reservations" | "revenue" | "shops"  // Optional
}
```

**Response (200)**:
```dart
{
  "success": true,
  "data": {
    "period": {
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD"
    },
    "metrics": {
      "totalUsers": number,
      "activeUsers": number,
      "newUsers": number,
      "totalReservations": number,
      "completedReservations": number,
      "cancelledReservations": number,
      "totalRevenue": number,
      "averageOrderValue": number,
      "totalShops": number,
      "activeShops": number
    },
    "trends": [
      {
        "date": "YYYY-MM-DD",
        "value": number
      }
    ]
  }
}
```

---

## Response Format Standards

### Success Response

All successful API responses follow this format:

```dart
{
  "success": true,
  "data": {
    // Response data here
  },
  "message": "Optional success message",
  "timestamp": "ISO 8601 datetime"
}
```

### Error Response

All error responses follow this format:

```dart
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": [ /* Optional validation errors */ ],
    "timestamp": "ISO 8601 datetime"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `AUTH_1001` | 401 | Authentication required |
| `AUTH_2001` | 403 | Access denied - insufficient permissions |
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `NOT_FOUND` | 404 | Resource not found |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error |
| `PAYMENT_FAILED` | 402 | Payment processing failed |
| `SLOT_UNAVAILABLE` | 409 | Time slot conflict |

---

## Error Handling

### Flutter Error Handling Example

```dart
class ApiException implements Exception {
  final int statusCode;
  final String code;
  final String message;
  final dynamic details;

  ApiException({
    required this.statusCode,
    required this.code,
    required this.message,
    this.details,
  });

  factory ApiException.fromResponse(http.Response response) {
    final body = jsonDecode(response.body);
    return ApiException(
      statusCode: response.statusCode,
      code: body['error']['code'] ?? 'UNKNOWN_ERROR',
      message: body['error']['message'] ?? 'An error occurred',
      details: body['error']['details'],
    );
  }

  @override
  String toString() => 'ApiException($code): $message';
}

// Usage in service methods
Future<T> handleApiCall<T>(Future<http.Response> Function() apiCall) async {
  try {
    final response = await apiCall();

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final data = jsonDecode(response.body);
      return data['data'] as T;
    }

    throw ApiException.fromResponse(response);
  } on SocketException {
    throw ApiException(
      statusCode: 0,
      code: 'NETWORK_ERROR',
      message: 'No internet connection',
    );
  } on TimeoutException {
    throw ApiException(
      statusCode: 0,
      code: 'TIMEOUT',
      message: 'Request timed out',
    );
  } catch (e) {
    if (e is ApiException) rethrow;
    throw ApiException(
      statusCode: 0,
      code: 'UNKNOWN_ERROR',
      message: e.toString(),
    );
  }
}
```

---

## Flutter Service Implementation Guide

### Base Service Class

```dart
import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;

abstract class BaseService {
  final String baseUrl;
  String? _accessToken;
  String? _refreshToken;

  BaseService({required this.baseUrl});

  // Getters
  Map<String, String> get headers => {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  };

  Map<String, String> get authHeaders => {
    ...headers,
    if (_accessToken != null) 'Authorization': 'Bearer $_accessToken',
  };

  // Token management
  void setTokens(String accessToken, String refreshToken) {
    _accessToken = accessToken;
    _refreshToken = refreshToken;
  }

  void clearTokens() {
    _accessToken = null;
    _refreshToken = null;
  }

  // HTTP methods with automatic token refresh
  Future<http.Response> get(String path, {Map<String, String>? queryParams}) async {
    final uri = Uri.parse('$baseUrl$path').replace(queryParameters: queryParams);
    var response = await http.get(uri, headers: authHeaders);

    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshAccessToken();
      response = await http.get(uri, headers: authHeaders);
    }

    return response;
  }

  Future<http.Response> post(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    var response = await http.post(
      uri,
      headers: authHeaders,
      body: body != null ? jsonEncode(body) : null,
    );

    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshAccessToken();
      response = await http.post(
        uri,
        headers: authHeaders,
        body: body != null ? jsonEncode(body) : null,
      );
    }

    return response;
  }

  Future<http.Response> put(String path, {Map<String, dynamic>? body}) async {
    final uri = Uri.parse('$baseUrl$path');
    var response = await http.put(
      uri,
      headers: authHeaders,
      body: body != null ? jsonEncode(body) : null,
    );

    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshAccessToken();
      response = await http.put(
        uri,
        headers: authHeaders,
        body: body != null ? jsonEncode(body) : null,
      );
    }

    return response;
  }

  Future<http.Response> delete(String path) async {
    final uri = Uri.parse('$baseUrl$path');
    var response = await http.delete(uri, headers: authHeaders);

    if (response.statusCode == 401 && _refreshToken != null) {
      await _refreshAccessToken();
      response = await http.delete(uri, headers: authHeaders);
    }

    return response;
  }

  // Token refresh logic
  Future<void> _refreshAccessToken() async {
    if (_refreshToken == null) return;

    final response = await http.post(
      Uri.parse('$baseUrl/api/auth/refresh'),
      headers: headers,
      body: jsonEncode({'refreshToken': _refreshToken}),
    );

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      _accessToken = data['accessToken'];
      _refreshToken = data['refreshToken'];
    } else {
      clearTokens();
      // Trigger logout/login flow
    }
  }
}
```

### Example Service Implementation

```dart
class ShopService extends BaseService {
  ShopService({required String baseUrl}) : super(baseUrl: baseUrl);

  Future<List<Shop>> getNearbyShops({
    required double latitude,
    required double longitude,
    double radius = 10.0,
    String? category,
    int limit = 20,
  }) async {
    final response = await get(
      '/api/shops/nearby',
      queryParams: {
        'latitude': latitude.toString(),
        'longitude': longitude.toString(),
        'radius': radius.toString(),
        if (category != null) 'category': category,
        'limit': limit.toString(),
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

  Future<Shop> getShopDetails(String shopId) async {
    final response = await get('/api/shops/$shopId');

    if (response.statusCode == 200) {
      final data = jsonDecode(response.body)['data'];
      return Shop.fromJson(data['shop']);
    }

    throw ApiException.fromResponse(response);
  }
}
```

### Service Dependency Injection (Provider)

```dart
// main.dart
void main() {
  runApp(
    MultiProvider(
      providers: [
        Provider(
          create: (_) => AuthService(baseUrl: ApiConfig.baseUrl),
        ),
        Provider(
          create: (_) => ShopService(baseUrl: ApiConfig.baseUrl),
        ),
        Provider(
          create: (_) => ReservationService(baseUrl: ApiConfig.baseUrl),
        ),
        Provider(
          create: (_) => PaymentService(baseUrl: ApiConfig.baseUrl),
        ),
        // ... other services
      ],
      child: MyApp(),
    ),
  );
}

// Usage in widgets
class ShopListScreen extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    final shopService = context.read<ShopService>();

    return FutureBuilder<List<Shop>>(
      future: shopService.getNearbyShops(
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
      ),
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          return ListView.builder(
            itemCount: snapshot.data!.length,
            itemBuilder: (context, index) {
              final shop = snapshot.data![index];
              return ShopCard(shop: shop);
            },
          );
        }

        if (snapshot.hasError) {
          return ErrorWidget(snapshot.error!);
        }

        return LoadingWidget();
      },
    );
  }
}
```

---

## Additional Notes

### Pagination

Most list endpoints support pagination with these query parameters:
- `page`: Page number (1-indexed)
- `limit`: Items per page (max usually 100)
- `offset`: Alternative to page (0-indexed)

### Date Formats

- **Dates**: `YYYY-MM-DD` (e.g., "2025-10-04")
- **Times**: `HH:MM` in 24-hour format (e.g., "14:30")
- **Timestamps**: ISO 8601 format (e.g., "2025-10-04T14:30:00.000Z")

### UUIDs

All IDs in the system are UUIDs in the format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Currency

All monetary amounts are in Korean Won (KRW) as integers (no decimals).

### Geolocation

- **Latitude**: -90 to 90 (decimal degrees)
- **Longitude**: -180 to 180 (decimal degrees)
- **Coordinate System**: WGS84
- **Database**: PostGIS Geography type

### Image URLs

All image URLs are absolute URLs pointing to Supabase Storage or CDN.

### Shop Categories

Valid shop categories:
- `nail` - Nail care
- `hair` - Hair salon
- `makeup` - Makeup services
- `skincare` - Skincare/facial
- `massage` - Massage/spa
- `tattoo` - Tattoo services
- `piercing` - Body piercing
- `eyebrow` - Eyebrow services
- `eyelash` - Eyelash extensions

---

**End of Documentation**

For questions or issues, contact: api-support@ebeautything.com
