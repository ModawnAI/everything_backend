# Web API Reference - 에뷰리띵 Backend

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
- [Web Service Implementation Guide](#web-service-implementation-guide)

---

## Overview

This document provides a comprehensive reference for all REST API endpoints in the 에뷰리띵 backend, organized specifically for web application development (React, Vue, Angular, or vanilla JavaScript).

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

```javascript
// config/api.config.js
export const API_CONFIG = {
  DEV_BASE_URL: 'http://localhost:3001',
  STAGING_BASE_URL: 'https://staging-api.ebeautything.com',
  PROD_BASE_URL: 'https://api.ebeautything.com',

  get baseUrl() {
    // Return based on environment
    return process.env.REACT_APP_API_URL || this.DEV_BASE_URL;
  }
};
```

**TypeScript Version**:
```typescript
// config/api.config.ts
interface ApiConfig {
  DEV_BASE_URL: string;
  STAGING_BASE_URL: string;
  PROD_BASE_URL: string;
  baseUrl: string;
}

export const API_CONFIG: ApiConfig = {
  DEV_BASE_URL: 'http://localhost:3001',
  STAGING_BASE_URL: 'https://staging-api.ebeautything.com',
  PROD_BASE_URL: 'https://api.ebeautything.com',

  get baseUrl(): string {
    return process.env.REACT_APP_API_URL || this.DEV_BASE_URL;
  }
};
```

### Standard Headers

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

const getAuthHeaders = (accessToken) => ({
  ...headers,
  'Authorization': `Bearer ${accessToken}`,
});
```

**TypeScript Version**:
```typescript
const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

const getAuthHeaders = (accessToken: string): Record<string, string> => ({
  ...headers,
  'Authorization': `Bearer ${accessToken}`,
});
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

### Token Storage

**Best Practices**:
- **Access Token**: Store in memory or sessionStorage (XSS mitigation)
- **Refresh Token**: Store in httpOnly cookie (preferred) or localStorage
- **Never** store tokens in regular cookies without httpOnly flag
- Consider using secure, httpOnly cookies for production

```javascript
// Token storage utilities
class TokenStorage {
  static setTokens(accessToken, refreshToken) {
    // Store access token in memory/sessionStorage
    sessionStorage.setItem('accessToken', accessToken);

    // Store refresh token in localStorage (or handle via httpOnly cookie)
    localStorage.setItem('refreshToken', refreshToken);
  }

  static getAccessToken() {
    return sessionStorage.getItem('accessToken');
  }

  static getRefreshToken() {
    return localStorage.getItem('refreshToken');
  }

  static clearTokens() {
    sessionStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}
```

### Token Refresh Flow

```javascript
// Using axios
async function refreshAccessToken() {
  const refreshToken = TokenStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post(
      `${API_CONFIG.baseUrl}/api/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    TokenStorage.setTokens(accessToken, newRefreshToken);

    return accessToken;
  } catch (error) {
    TokenStorage.clearTokens();
    // Redirect to login
    window.location.href = '/login';
    throw error;
  }
}
```

**TypeScript Version**:
```typescript
interface RefreshTokenResponse {
  data: {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  };
}

async function refreshAccessToken(): Promise<string> {
  const refreshToken = TokenStorage.getRefreshToken();

  if (!refreshToken) {
    throw new Error('No refresh token available');
  }

  try {
    const response = await axios.post<RefreshTokenResponse>(
      `${API_CONFIG.baseUrl}/api/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    TokenStorage.setTokens(accessToken, newRefreshToken);

    return accessToken;
  } catch (error) {
    TokenStorage.clearTokens();
    window.location.href = '/login';
    throw error;
  }
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
```typescript
interface SocialLoginRequest {
  provider: 'kakao' | 'apple' | 'google';
  token: string;  // Social provider access token
  fcmToken?: string;  // Optional: Firebase FCM token
  deviceInfo?: {
    deviceId: string;
    platform: 'ios' | 'android' | 'web';
    version: string;
  };
}
```

**Response (200)**:
```typescript
interface SocialLoginResponse {
  success: true;
  data: {
    user: {
      id: string;
      email: string;
      name: string;
      phoneNumber: string;
      profileImageUrl: string;
      role: 'customer' | 'shop_owner' | 'admin';
      status: 'active' | 'inactive' | 'suspended';
    };
    tokens: {
      accessToken: string;
      refreshToken: string;
      expiresIn: number;  // seconds
    };
    isNewUser: boolean;
    profileComplete: boolean;
  };
}
```

**JavaScript Example**:
```javascript
class AuthService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async socialLogin({ provider, token, fcmToken }) {
    const response = await axios.post(
      `${this.baseUrl}/api/auth/social-login`,
      {
        provider,
        token,
        fcmToken,
      }
    );

    return response.data;
  }
}

// Usage
const authService = new AuthService(API_CONFIG.baseUrl);
const result = await authService.socialLogin({
  provider: 'kakao',
  token: 'kakao-access-token',
  fcmToken: 'firebase-token'
});

TokenStorage.setTokens(result.data.tokens.accessToken, result.data.tokens.refreshToken);
```

**TypeScript Example**:
```typescript
class AuthService {
  constructor(private baseUrl: string) {}

  async socialLogin(request: SocialLoginRequest): Promise<SocialLoginResponse> {
    const response = await axios.post<SocialLoginResponse>(
      `${this.baseUrl}/api/auth/social-login`,
      request
    );

    return response.data;
  }
}
```

### 1.2 Complete Registration

**Endpoint**: `POST /api/auth/register`
**Authentication**: Required (partial user from social login)
**Rate Limit**: Strict (same as login)

**Request Body**:
```typescript
interface RegistrationRequest {
  name: string;  // Required
  phoneNumber: string;  // Required
  birthDate: string;  // Required (YYYY-MM-DD)
  termsAccepted: boolean;  // Required
  privacyAccepted: boolean;  // Required
  email?: string;  // Optional
  gender?: 'male' | 'female' | 'other';  // Optional
  nickname?: string;  // Optional
  referredByCode?: string;  // Optional
  marketingConsent?: boolean;  // Optional
}
```

**Response (200)**:
```typescript
interface RegistrationResponse {
  success: true;
  data: {
    user: User;
    profileComplete: true;
    referralCode: string;
    message: string;
  };
}
```

### 1.3 Phone Verification - Send Code

**Endpoint**: `POST /api/auth/send-verification-code`
**Authentication**: Not required
**Rate Limit**: Strict

**Request Body**:
```typescript
interface SendVerificationRequest {
  phoneNumber: string;  // Required
  method?: 'pass' | 'sms';  // Optional, default: "sms"
  userId?: string;  // Optional: for existing users
}
```

**Response (200)**:
```typescript
interface SendVerificationResponse {
  success: true;
  data: {
    method: 'pass' | 'sms';
    txId: string;  // Transaction ID for verification
    redirectUrl?: string;  // For PASS method only
    expiresAt: string;  // ISO 8601 datetime
    message: string;
  };
}
```

### 1.4 Phone Verification - Verify Code

**Endpoint**: `POST /api/auth/verify-phone`
**Authentication**: Not required
**Rate Limit**: Strict

**Request Body**:
```typescript
interface VerifyPhoneRequest {
  txId: string;  // Required
  method: 'pass' | 'sms';  // Required
  otpCode?: string;  // Required for SMS method
  passResult?: any;  // Required for PASS method
}
```

**Response (200)**:
```typescript
interface VerifyPhoneResponse {
  success: true;
  data: {
    verified: true;
    userId?: string;  // If existing user
    phoneNumber: string;
    method: 'pass' | 'sms';
    message: string;
  };
}
```

### 1.5 Refresh Token

**Endpoint**: `POST /api/auth/refresh`
**Authentication**: Not required (uses refresh token)
**Rate Limit**: Strict

**Request Body**:
```typescript
interface RefreshTokenRequest {
  refreshToken: string;  // Required
  deviceInfo?: {
    deviceId: string;
    platform: 'ios' | 'android' | 'web';
    version: string;
  };
}
```

**Response (200)**:
```typescript
interface RefreshTokenResponse {
  success: true;
  data: {
    accessToken: string;
    refreshToken: string;  // New refresh token (rotation)
    expiresIn: number;
  };
}
```

### 1.6 Logout

**Endpoint**: `POST /api/auth/logout`
**Authentication**: Optional (graceful if token invalid)
**Rate Limit**: Standard

**Request Body**:
```typescript
interface LogoutRequest {
  refreshToken: string;  // Required
}
```

**Response (200)**:
```typescript
interface LogoutResponse {
  success: true;
  message: string;
}
```

### 1.7 Logout All Devices

**Endpoint**: `POST /api/auth/logout-all`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```typescript
interface LogoutAllResponse {
  success: true;
  message: string;
}
```

### 1.8 Get Active Sessions

**Endpoint**: `GET /api/auth/sessions`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```typescript
interface SessionsResponse {
  success: true;
  data: {
    sessions: Array<{
      id: string;
      deviceInfo: {
        deviceId: string;
        platform: 'ios' | 'android' | 'web';
        version: string;
      };
      lastActive: string;  // ISO 8601 datetime
      createdAt: string;  // ISO 8601 datetime
      isCurrent: boolean;
    }>;
  };
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
```typescript
interface GetShopsParams {
  status?: 'active' | 'pending' | 'suspended';
  category?: 'nail' | 'hair' | 'makeup' | 'skincare' | 'massage' | 'tattoo' | 'piercing' | 'eyebrow' | 'eyelash';
  shopType?: 'partnered' | 'non_partnered';
  ownerId?: string;
  limit?: number;  // Default: 50, max: 100
  offset?: number;  // Default: 0
}
```

**Response (200)**:
```typescript
interface Shop {
  id: string;
  name: string;
  description: string;
  phoneNumber: string;
  email: string;
  address: string;
  detailedAddress: string;
  postalCode: string;
  latitude: number;
  longitude: number;
  mainCategory: string;
  subCategories: string[];
  operatingHours: any;
  paymentMethods: Array<'cash' | 'card' | 'mobile_payment' | 'bank_transfer'>;
  kakaoChannelUrl: string;
  businessLicenseNumber: string;
  status: 'active' | 'pending' | 'suspended';
  shopType: 'partnered' | 'non_partnered';
  isFeatured: boolean;
  rating: number;
  reviewCount: number;
  images: string[];
  createdAt: string;
  updatedAt: string;
}

interface GetShopsResponse {
  success: true;
  data: {
    shops: Shop[];
    totalCount: number;
    hasMore: boolean;
  };
}
```

### 2.2 Get Nearby Shops (Location-Based)

**Endpoint**: `GET /api/shops/nearby`
**Authentication**: Not required
**Rate Limit**: 100 per 15 min (search limit)

**Query Parameters**:
```typescript
interface GetNearbyShopsParams {
  latitude: string;  // Required (e.g., "37.5665")
  longitude: string;  // Required (e.g., "126.9780")
  radius?: string;  // Optional, default: "10" (km)
  category?: string;
  shopType?: 'partnered' | 'non_partnered';
  onlyFeatured?: 'true' | 'false';
  limit?: string;  // Default: "50"
  offset?: string;  // Default: "0"
}
```

**Response (200)**:
```typescript
interface NearbyShopsResponse {
  success: true;
  data: {
    shops: Shop[];
    totalCount: number;
    hasMore: boolean;
    center: {
      latitude: number;
      longitude: number;
    };
    radius: number;
  };
}
```

**JavaScript Example**:
```javascript
class ShopService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getNearbyShops({ latitude, longitude, radius = 10, category, limit = 20 }) {
    const params = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      limit: limit.toString(),
    });

    if (category) {
      params.append('category', category);
    }

    const response = await axios.get(
      `${this.baseUrl}/api/shops/nearby?${params.toString()}`
    );

    return response.data;
  }
}

// Usage
const shopService = new ShopService(API_CONFIG.baseUrl);
const nearbyShops = await shopService.getNearbyShops({
  latitude: 37.5665,
  longitude: 126.9780,
  radius: 5,
  category: 'nail'
});
```

**TypeScript Example**:
```typescript
class ShopService {
  constructor(private baseUrl: string) {}

  async getNearbyShops(params: {
    latitude: number;
    longitude: number;
    radius?: number;
    category?: string;
    limit?: number;
  }): Promise<NearbyShopsResponse> {
    const { latitude, longitude, radius = 10, category, limit = 20 } = params;

    const queryParams = new URLSearchParams({
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      limit: limit.toString(),
    });

    if (category) {
      queryParams.append('category', category);
    }

    const response = await axios.get<NearbyShopsResponse>(
      `${this.baseUrl}/api/shops/nearby?${queryParams.toString()}`
    );

    return response.data;
  }
}
```

### 2.3 Get Shops in Map Bounds

**Endpoint**: `GET /api/shops/bounds`
**Authentication**: Not required
**Rate Limit**: 100 per 15 min (search limit)

**Query Parameters**:
```typescript
interface GetShopsBoundsParams {
  neLat: string;  // Required: North-East latitude
  neLng: string;  // Required: North-East longitude
  swLat: string;  // Required: South-West latitude
  swLng: string;  // Required: South-West longitude
  category?: string;
  shopType?: 'partnered' | 'non_partnered';
  onlyFeatured?: 'true' | 'false';
}
```

**Response (200)**:
```typescript
interface ShopsBoundsResponse {
  success: true;
  data: {
    shops: Shop[];
    totalCount: number;
    bounds: {
      northEast: { lat: number; lng: number };
      southWest: { lat: number; lng: number };
    };
  };
}
```

### 2.4 Get Shop Details

**Endpoint**: `GET /api/shops/:id`
**Authentication**: Not required
**Rate Limit**: 200 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```typescript
interface ShopDetailsResponse {
  success: true;
  data: {
    shop: Shop;
    services: Array<{
      id: string;
      name: string;
      description: string;
      price: number;
      duration: number;  // minutes
      category: string;
    }>;
    operatingHours: {
      monday: { open: string; close: string; closed: boolean };
      tuesday: { open: string; close: string; closed: boolean };
      // ... other days
    };
    contactMethods: Array<{
      methodType: 'phone' | 'email' | 'kakao_channel' | 'instagram' | 'facebook' | 'website';
      value: string;
      description: string;
      displayOrder: number;
    }>;
  };
}
```

### 2.5 Get Shop Contact Info

**Endpoint**: `GET /api/shops/:id/contact-info`
**Authentication**: Not required
**Rate Limit**: 60 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```typescript
interface ContactInfoResponse {
  success: true;
  data: {
    shopId: string;
    contactMethods: Array<{
      methodType: 'phone' | 'email' | 'kakao_channel' | 'instagram' | 'facebook' | 'website' | 'other';
      value: string;
      description: string;
      displayOrder: number;
    }>;
  };
}
```

### 2.6 Create Shop (Shop Owner)

**Endpoint**: `POST /api/shops`
**Authentication**: Required (shop owner role)
**Rate Limit**: 200 per 15 min

**Request Body**:
```typescript
interface CreateShopRequest {
  name: string;  // Required
  address: string;  // Required
  mainCategory: string;  // Required
  description?: string;
  phoneNumber?: string;
  email?: string;
  detailedAddress?: string;
  postalCode?: string;
  latitude?: number;
  longitude?: number;
  subCategories?: string[];
  operatingHours?: any;
  paymentMethods?: Array<'cash' | 'card' | 'mobile_payment' | 'bank_transfer'>;
  kakaoChannelUrl?: string;
  businessLicenseNumber?: string;
}
```

**Response (201)**:
```typescript
interface CreateShopResponse {
  success: true;
  data: {
    shop: Shop;
    message: string;
  };
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
```typescript
interface UpdateShopResponse {
  success: true;
  data: {
    shop: Shop;
    message: string;
  };
}
```

### 2.8 Delete Shop (Soft Delete)

**Endpoint**: `DELETE /api/shops/:id`
**Authentication**: Required (shop owner)
**Rate Limit**: 200 per 15 min

**Path Parameters**:
- `id`: Shop UUID (required)

**Response (200)**:
```typescript
interface DeleteShopResponse {
  success: true;
  message: string;
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
```typescript
interface GetAvailableSlotsParams {
  date: string;  // Required (YYYY-MM-DD)
  'serviceIds[]': string[];  // Required: Array of service UUIDs
  startTime?: string;  // Optional (HH:MM)
  endTime?: string;  // Optional (HH:MM)
  interval?: number;  // Optional: Interval in minutes, default: 30
}
```

**Response (200)**:
```typescript
interface AvailableSlotsResponse {
  success: true;
  data: {
    date: string;  // YYYY-MM-DD
    slots: Array<{
      time: string;  // HH:MM
      available: boolean;
      capacity: number;
      bookedCount: number;
      estimatedDuration: number;  // minutes
    }>;
    shopOperatingHours: {
      open: string;  // HH:MM
      close: string;  // HH:MM
      closed: boolean;
    };
  };
}
```

**JavaScript Example**:
```javascript
class ReservationService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getAvailableSlots({ shopId, date, serviceIds }) {
    const params = new URLSearchParams({ date });

    serviceIds.forEach((id, index) => {
      params.append(`serviceIds[${index}]`, id);
    });

    const response = await axios.get(
      `${this.baseUrl}/api/shops/${shopId}/available-slots?${params.toString()}`
    );

    return response.data;
  }
}

// Usage
const reservationService = new ReservationService(API_CONFIG.baseUrl);
const slots = await reservationService.getAvailableSlots({
  shopId: 'shop-uuid',
  date: '2025-10-15',
  serviceIds: ['service-uuid-1', 'service-uuid-2']
});
```

**TypeScript Example**:
```typescript
class ReservationService {
  constructor(private baseUrl: string) {}

  async getAvailableSlots(params: {
    shopId: string;
    date: string;
    serviceIds: string[];
  }): Promise<AvailableSlotsResponse> {
    const { shopId, date, serviceIds } = params;
    const queryParams = new URLSearchParams({ date });

    serviceIds.forEach((id, index) => {
      queryParams.append(`serviceIds[${index}]`, id);
    });

    const response = await axios.get<AvailableSlotsResponse>(
      `${this.baseUrl}/api/shops/${shopId}/available-slots?${queryParams.toString()}`
    );

    return response.data;
  }
}
```

### 3.2 Create Reservation

**Endpoint**: `POST /api/reservations`
**Authentication**: Required
**Rate Limit**: 20 per 15 min

**Request Body**:
```typescript
interface CreateReservationRequest {
  shopId: string;  // Required
  services: Array<{
    serviceId: string;  // Required
    quantity?: number;  // Optional, default: 1, max: 10
  }>;
  reservationDate: string;  // Required (YYYY-MM-DD)
  reservationTime: string;  // Required (HH:MM)
  specialRequests?: string;  // Optional, max 500 chars
  pointsToUse?: number;  // Optional, min: 0
  paymentInfo?: {
    depositAmount: number;
    remainingAmount: number;
    paymentMethod: 'card' | 'cash' | 'points' | 'mixed';
    depositRequired: boolean;
  };
  notificationPreferences?: {
    emailNotifications: boolean;
    smsNotifications: boolean;
    pushNotifications: boolean;
  };
}
```

**Response (201)**:
```typescript
interface CreateReservationResponse {
  success: true;
  data: {
    reservationId: string;
    status: 'requested' | 'confirmed';
    totalAmount: number;
    depositAmount: number;
    pointsUsed: number;
    finalAmount: number;
    reservation: {
      id: string;
      shopId: string;
      userId: string;
      services: any[];
      reservationDateTime: string;  // ISO 8601
      status: string;
      createdAt: string;  // ISO 8601
    };
    message: string;
  };
}
```

### 3.3 Get User Reservations

**Endpoint**: `GET /api/reservations`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Query Parameters**:
```typescript
interface GetReservationsParams {
  status?: 'requested' | 'confirmed' | 'completed' | 'cancelled_by_user' | 'cancelled_by_shop' | 'no_show';
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  shopId?: string;
  page?: number;  // Default: 1
  limit?: number;  // Default: 20, max: 100
}
```

**Response (200)**:
```typescript
interface Reservation {
  id: string;
  shopId: string;
  shopName: string;
  shopAddress: string;
  services: Array<{
    serviceId: string;
    serviceName: string;
    price: number;
    duration: number;
    quantity: number;
  }>;
  reservationDateTime: string;  // ISO 8601
  status: string;
  totalAmount: number;
  depositAmount: number;
  finalAmount: number;
  pointsUsed: number;
  specialRequests: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
}

interface GetReservationsResponse {
  success: true;
  data: {
    reservations: Reservation[];
    totalCount: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
```

### 3.4 Get Reservation Details

**Endpoint**: `GET /api/reservations/:id`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Path Parameters**:
- `id`: Reservation UUID (required)

**Response (200)**:
```typescript
interface ReservationDetailsResponse {
  success: true;
  data: {
    reservation: Reservation;
    shop: Shop;
    payment?: {
      id: string;
      status: 'pending' | 'deposit_paid' | 'fully_paid' | 'failed' | 'refunded';
      depositAmount: number;
      finalAmount: number;
      totalAmount: number;
      paymentMethod: string;
      paidAt: string;  // ISO 8601
    };
  };
}
```

### 3.5 Cancel Reservation

**Endpoint**: `PUT /api/reservations/:id/cancel`
**Authentication**: Required
**Rate Limit**: 10 per 15 min

**Path Parameters**:
- `id`: Reservation UUID (required)

**Request Body**:
```typescript
interface CancelReservationRequest {
  reason?: string;  // Optional, max 500 chars
  cancellationType?: 'user_request' | 'shop_request' | 'no_show' | 'admin_force';
  refundPreference?: 'full_refund' | 'partial_refund' | 'no_refund';
  notifyShop?: boolean;  // Default: true
  notifyCustomer?: boolean;  // Default: true
}
```

**Response (200)**:
```typescript
interface CancelReservationResponse {
  success: true;
  data: {
    reservationId: string;
    status: 'cancelled_by_user' | 'cancelled_by_shop';
    cancelledAt: string;  // ISO 8601
    refundAmount: number;
    refundStatus: 'pending' | 'processing' | 'completed' | 'failed';
    message: string;
  };
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
```typescript
interface PreparePaymentRequest {
  reservationId: string;  // Required
  amount: number;  // Required, min: 1000 KRW
  customerName: string;  // Required
  customerEmail: string;  // Required (email format)
  customerMobilePhone?: string;
  paymentType?: 'deposit' | 'final';
}
```

**Response (200)**:
```typescript
interface PreparePaymentResponse {
  success: true;
  data: {
    paymentKey: string;
    orderId: string;
    amount: number;
    customerName: string;
    successUrl: string;
    failUrl: string;
    message: string;
  };
}
```

**JavaScript Example**:
```javascript
class PaymentService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.accessToken = TokenStorage.getAccessToken();
  }

  async preparePayment({
    reservationId,
    amount,
    customerName,
    customerEmail,
    customerPhone
  }) {
    const response = await axios.post(
      `${this.baseUrl}/api/payments/toss/prepare`,
      {
        reservationId,
        amount,
        customerName,
        customerEmail,
        customerMobilePhone: customerPhone,
      },
      {
        headers: getAuthHeaders(this.accessToken)
      }
    );

    return response.data;
  }
}

// Usage with TossPayments SDK
const paymentService = new PaymentService(API_CONFIG.baseUrl);
const paymentData = await paymentService.preparePayment({
  reservationId: 'reservation-uuid',
  amount: 50000,
  customerName: '홍길동',
  customerEmail: 'hong@example.com'
});

// Redirect to TossPayments
window.location.href = `https://pay.toss.im?orderId=${paymentData.data.orderId}&amount=${paymentData.data.amount}`;
```

**TypeScript Example**:
```typescript
class PaymentService {
  constructor(private baseUrl: string) {}

  async preparePayment(request: PreparePaymentRequest): Promise<PreparePaymentResponse> {
    const accessToken = TokenStorage.getAccessToken();

    const response = await axios.post<PreparePaymentResponse>(
      `${this.baseUrl}/api/payments/toss/prepare`,
      request,
      {
        headers: getAuthHeaders(accessToken!)
      }
    );

    return response.data;
  }
}
```

### 4.2 Confirm Payment

**Endpoint**: `POST /api/payments/toss/confirm`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Request Body**:
```typescript
interface ConfirmPaymentRequest {
  paymentKey: string;  // Required (from TossPayments)
  orderId: string;  // Required
  amount: number;  // Required
}
```

**Response (200)**:
```typescript
interface ConfirmPaymentResponse {
  success: true;
  data: {
    paymentId: string;
    status: 'deposit_paid' | 'fully_paid';
    paidAt: string;  // ISO 8601
    amount: number;
    paymentMethod: string;
    message: string;
  };
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
```typescript
interface PaymentStatusResponse {
  success: true;
  data: {
    reservationId: string;
    paymentStatus: 'pending' | 'deposit_paid' | 'fully_paid' | 'failed' | 'refunded';
    totalAmount: number;
    depositAmount: number;
    depositPaid: boolean;
    depositPaidAt?: string;  // ISO 8601
    finalAmount: number;
    finalPaid: boolean;
    finalPaidAt?: string;  // ISO 8601
    payments: Array<{
      id: string;
      type: 'deposit' | 'final';
      amount: number;
      status: 'success' | 'failed';
      paymentMethod: string;
      paidAt: string;  // ISO 8601
    }>;
  };
}
```

### 4.6 Get Payment Details

**Endpoint**: `GET /api/payments/:paymentId`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Path Parameters**:
- `paymentId`: Payment UUID (required)

**Response (200)**:
```typescript
interface PaymentDetailsResponse {
  success: true;
  data: {
    id: string;
    reservationId: string;
    amount: number;
    status: 'pending' | 'deposit_paid' | 'fully_paid' | 'failed' | 'refunded';
    paymentMethod: string;
    paidAt: string;  // ISO 8601
    tossPaymentKey: string;
    orderId: string;
    createdAt: string;  // ISO 8601
  };
}
```

### 4.7 Get User Payment History

**Endpoint**: `GET /api/payments/user/:userId`
**Authentication**: Required
**Rate Limit**: Payment rate limit

**Path Parameters**:
- `userId`: User UUID (required)

**Response (200)**:
```typescript
interface PaymentHistoryResponse {
  success: true;
  data: {
    payments: Array<{
      id: string;
      reservationId: string;
      shopName: string;
      amount: number;
      status: string;
      paymentMethod: string;
      paidAt: string;  // ISO 8601
    }>;
    totalCount: number;
  };
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
```typescript
interface PointBalanceResponse {
  success: true;
  data: {
    userId: string;
    balance: number;
    totalEarned: number;
    totalUsed: number;
    expiringPoints: number;
    nextExpirationDate?: string;  // ISO 8601
  };
}
```

**JavaScript Example**:
```javascript
class PointService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async getBalance(userId) {
    const accessToken = TokenStorage.getAccessToken();

    const response = await axios.get(
      `${this.baseUrl}/api/points/users/${userId}/points/balance`,
      {
        headers: getAuthHeaders(accessToken)
      }
    );

    return response.data.data;
  }
}

// Usage
const pointService = new PointService(API_CONFIG.baseUrl);
const balance = await pointService.getBalance('user-uuid');
console.log(`Current balance: ${balance.balance} points`);
```

**TypeScript Example**:
```typescript
class PointService {
  constructor(private baseUrl: string) {}

  async getBalance(userId: string): Promise<PointBalanceResponse['data']> {
    const accessToken = TokenStorage.getAccessToken();

    const response = await axios.get<PointBalanceResponse>(
      `${this.baseUrl}/api/points/users/${userId}/points/balance`,
      {
        headers: getAuthHeaders(accessToken!)
      }
    );

    return response.data.data;
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
```typescript
interface GetPointHistoryParams {
  type?: 'earn' | 'use' | 'expire' | 'refund';
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface PointHistoryResponse {
  success: true;
  data: {
    transactions: Array<{
      id: string;
      type: 'earn' | 'use' | 'expire' | 'refund';
      amount: number;
      balance: number;  // Balance after transaction
      source: 'reservation' | 'referral' | 'admin_adjustment' | 'promotion';
      description: string;
      relatedId?: string;  // Related reservation/referral ID
      createdAt: string;  // ISO 8601
      expiresAt?: string;  // ISO 8601 (for earned points)
    }>;
    totalCount: number;
    hasMore: boolean;
  };
}
```

### 5.3 Use Points

**Endpoint**: `POST /api/points/use`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**:
```typescript
interface UsePointsRequest {
  amount: number;  // Required, min: 0
  reservationId: string;  // Required
  description?: string;
}
```

**Response (200)**:
```typescript
interface UsePointsResponse {
  success: true;
  data: {
    transactionId: string;
    pointsUsed: number;
    remainingBalance: number;
    message: string;
  };
}
```

### 5.4 Earn Points (System)

**Endpoint**: `POST /api/points/earn`
**Authentication**: Required (internal use)
**Rate Limit**: Standard

**Request Body**:
```typescript
interface EarnPointsRequest {
  userId: string;  // Required
  amount: number;  // Required
  source: 'reservation' | 'referral' | 'promotion';  // Required
  relatedId?: string;
  description?: string;
  expirationDays?: number;  // Default: 365
}
```

**Response (200)**:
```typescript
interface EarnPointsResponse {
  success: true;
  data: {
    transactionId: string;
    pointsEarned: number;
    newBalance: number;
    expiresAt: string;  // ISO 8601
  };
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
```typescript
interface GenerateReferralCodeRequest {
  length?: number;  // Min: 4, max: 12
  excludeSimilar?: boolean;
  excludeProfanity?: boolean;
}
```

**Response (200)**:
```typescript
interface GenerateReferralCodeResponse {
  success: true;
  data: {
    code: string;  // Generated code (uppercase alphanumeric)
    userId: string;
    createdAt: string;  // ISO 8601
    expiresAt?: string;  // ISO 8601 (if applicable)
    message: string;
  };
}
```

### 6.2 Validate Referral Code

**Endpoint**: `GET /api/referral-codes/validate/:code`
**Authentication**: Not required
**Rate Limit**: Referral code rate limit

**Path Parameters**:
- `code`: Referral code (required, 4-12 chars, uppercase alphanumeric)

**Response (200)**:
```typescript
interface ValidateReferralCodeResponse {
  success: true;
  data: {
    valid: boolean;
    code: string;
    ownerId: string;
    ownerName: string;
    usageCount: number;
    maxUsage?: number;  // If limited
    expiresAt?: string;  // ISO 8601 (if applicable)
    isActive: boolean;
  };
}
```

**JavaScript Example**:
```javascript
class ReferralService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async validateCode(code) {
    try {
      const response = await axios.get(
        `${this.baseUrl}/api/referral-codes/validate/${code}`
      );

      return response.data.data.valid;
    } catch (error) {
      return false;
    }
  }
}

// Usage
const referralService = new ReferralService(API_CONFIG.baseUrl);
const isValid = await referralService.validateCode('ABC123XYZ');
if (isValid) {
  console.log('Valid referral code!');
}
```

**TypeScript Example**:
```typescript
class ReferralService {
  constructor(private baseUrl: string) {}

  async validateCode(code: string): Promise<boolean> {
    try {
      const response = await axios.get<ValidateReferralCodeResponse>(
        `${this.baseUrl}/api/referral-codes/validate/${code}`
      );

      return response.data.data.valid;
    } catch (error) {
      return false;
    }
  }
}
```

### 6.3 Get Referral Relationships

**Endpoint**: `GET /api/referral-relationships`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```typescript
interface GetReferralRelationshipsParams {
  type?: 'referred' | 'referrer';  // Get users I referred or who referred me
  status?: 'active' | 'inactive';
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface ReferralRelationshipsResponse {
  success: true;
  data: {
    relationships: Array<{
      id: string;
      referrerId: string;
      referrerName: string;
      referredId: string;
      referredName: string;
      referralCode: string;
      status: 'active' | 'inactive';
      createdAt: string;  // ISO 8601
      totalEarnings: number;
    }>;
    totalCount: number;
    hasMore: boolean;
  };
}
```

### 6.4 Get Referral Earnings

**Endpoint**: `GET /api/referral-earnings`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```typescript
interface GetReferralEarningsParams {
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  status?: 'pending' | 'paid' | 'cancelled';
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface ReferralEarningsResponse {
  success: true;
  data: {
    earnings: Array<{
      id: string;
      referralId: string;
      amount: number;
      source: 'reservation' | 'signup_bonus';
      status: 'pending' | 'paid' | 'cancelled';
      paidAt?: string;  // ISO 8601
      createdAt: string;  // ISO 8601
    }>;
    totalEarnings: number;
    pendingEarnings: number;
    paidEarnings: number;
    totalCount: number;
  };
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
```typescript
interface RegisterTokenRequest {
  token: string;  // Required: Firebase FCM token
  deviceType: 'android' | 'ios' | 'web';  // Required
  deviceId?: string;
  deviceName?: string;
}
```

**Response (200)**:
```typescript
interface RegisterTokenResponse {
  success: true;
  data: {
    tokenId: string;
    isActive: true;
    message: string;
  };
}
```

### 7.2 Get Notification Settings

**Endpoint**: `GET /api/notifications/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```typescript
interface NotificationSettingsResponse {
  success: true;
  data: {
    userId: string;
    pushEnabled: boolean;
    emailEnabled: boolean;
    smsEnabled: boolean;
    reservationUpdates: boolean;
    paymentNotifications: boolean;
    promotionalMessages: boolean;
    systemAlerts: boolean;
    updatedAt: string;  // ISO 8601
  };
}
```

### 7.3 Update Notification Settings

**Endpoint**: `PUT /api/notifications/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**:
```typescript
interface UpdateNotificationSettingsRequest {
  pushEnabled?: boolean;
  emailEnabled?: boolean;
  smsEnabled?: boolean;
  reservationUpdates?: boolean;
  paymentNotifications?: boolean;
  promotionalMessages?: boolean;
  systemAlerts?: boolean;
}
```

**Response (200)**:
```typescript
interface UpdateNotificationSettingsResponse {
  success: true;
  data: {
    settings: NotificationSettingsResponse['data'];
    message: string;
  };
}
```

### 7.4 Get Notification History

**Endpoint**: `GET /api/notifications/history`
**Authentication**: Required
**Rate Limit**: Standard

**Query Parameters**:
```typescript
interface GetNotificationHistoryParams {
  status?: 'sent' | 'failed' | 'pending';
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface NotificationHistoryResponse {
  success: true;
  data: {
    notifications: Array<{
      id: string;
      title: string;
      body: string;
      data: any;  // Additional data
      status: 'sent' | 'failed' | 'pending';
      sentAt: string;  // ISO 8601
      errorMessage?: string;  // If failed
      createdAt: string;  // ISO 8601
    }>;
    totalCount: number;
    hasMore: boolean;
  };
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
```typescript
interface AddFavoriteResponse {
  success: true;
  data: {
    isFavorite: true;
    favoriteId: string;
    message: string;
  };
}
```

### 8.2 Remove Shop from Favorites

**Endpoint**: `DELETE /api/shops/:shopId/favorite`
**Authentication**: Required
**Rate Limit**: 50 per 15 min (modification limit)

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Response (200)**:
```typescript
interface RemoveFavoriteResponse {
  success: true;
  data: {
    isFavorite: false;
    message: string;
  };
}
```

### 8.3 Get User Favorites

**Endpoint**: `GET /api/favorites`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Query Parameters**:
```typescript
interface GetFavoritesParams {
  limit?: number;  // Min: 1, max: 100
  offset?: number;  // Min: 0
  category?: string;
  sortBy?: 'recent' | 'name' | 'bookings';
}
```

**Response (200)**:
```typescript
interface GetFavoritesResponse {
  success: true;
  data: {
    favorites: Array<{
      id: string;
      shopId: string;
      shop: {
        id: string;
        name: string;
        address: string;
        mainCategory: string;
        rating: number;
        reviewCount: number;
        images: string[];
      };
      createdAt: string;  // ISO 8601
    }>;
    totalCount: number;
    hasMore: boolean;
  };
}
```

**JavaScript Example**:
```javascript
class FavoriteService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  async toggleFavorite(shopId, isFavorite) {
    const accessToken = TokenStorage.getAccessToken();
    const method = isFavorite ? 'delete' : 'post';

    const response = await axios[method](
      `${this.baseUrl}/api/shops/${shopId}/favorite`,
      {
        headers: getAuthHeaders(accessToken)
      }
    );

    return response.data;
  }

  async getFavorites() {
    const accessToken = TokenStorage.getAccessToken();

    const response = await axios.get(
      `${this.baseUrl}/api/favorites`,
      {
        headers: getAuthHeaders(accessToken)
      }
    );

    return response.data.data.favorites;
  }
}

// Usage
const favoriteService = new FavoriteService(API_CONFIG.baseUrl);

// Toggle favorite
await favoriteService.toggleFavorite('shop-uuid', false); // Add to favorites
await favoriteService.toggleFavorite('shop-uuid', true);  // Remove from favorites

// Get all favorites
const favorites = await favoriteService.getFavorites();
```

**TypeScript Example**:
```typescript
class FavoriteService {
  constructor(private baseUrl: string) {}

  async toggleFavorite(shopId: string, isFavorite: boolean): Promise<void> {
    const accessToken = TokenStorage.getAccessToken();
    const method = isFavorite ? 'delete' : 'post';

    await axios[method](
      `${this.baseUrl}/api/shops/${shopId}/favorite`,
      {
        headers: getAuthHeaders(accessToken!)
      }
    );
  }

  async getFavorites(): Promise<GetFavoritesResponse['data']['favorites']> {
    const accessToken = TokenStorage.getAccessToken();

    const response = await axios.get<GetFavoritesResponse>(
      `${this.baseUrl}/api/favorites`,
      {
        headers: getAuthHeaders(accessToken!)
      }
    );

    return response.data.data.favorites;
  }
}
```

### 8.4 Check Favorite Status (Bulk)

**Endpoint**: `POST /api/favorites/check`
**Authentication**: Required
**Rate Limit**: 100 per 15 min

**Request Body**:
```typescript
interface CheckFavoritesRequest {
  shopIds: string[];  // Min: 1, max: 100
}
```

**Response (200)**:
```typescript
interface CheckFavoritesResponse {
  success: true;
  data: {
    favorites: Record<string, boolean>;  // shopId: isFavorite
  };
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
```typescript
interface UserProfileResponse {
  success: true;
  data: {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    birthDate: string;  // YYYY-MM-DD
    gender: 'male' | 'female' | 'other';
    nickname: string;
    profileImageUrl: string;
    role: 'customer' | 'shop_owner' | 'admin';
    status: 'active' | 'inactive' | 'suspended';
    referralCode: string;
    createdAt: string;  // ISO 8601
    updatedAt: string;  // ISO 8601
  };
}
```

### 9.2 Update User Profile

**Endpoint**: `PUT /api/users/:userId/profile`
**Authentication**: Required
**Rate Limit**: Standard

**Path Parameters**:
- `userId`: User UUID (required)

**Request Body**:
```typescript
interface UpdateUserProfileRequest {
  name?: string;
  email?: string;
  birthDate?: string;  // YYYY-MM-DD
  gender?: 'male' | 'female' | 'other';
  nickname?: string;
  profileImageUrl?: string;
}
```

**Response (200)**:
```typescript
interface UpdateUserProfileResponse {
  success: true;
  data: {
    user: UserProfileResponse['data'];
    message: string;
  };
}
```

### 9.3 Get User Settings

**Endpoint**: `GET /api/users/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Response (200)**:
```typescript
interface UserSettingsResponse {
  success: true;
  data: {
    userId: string;
    language: 'ko' | 'en';
    timezone: string;
    currency: 'KRW';
    notifications: {
      pushEnabled: boolean;
      emailEnabled: boolean;
      smsEnabled: boolean;
    };
    privacy: {
      showProfile: boolean;
      showActivity: boolean;
    };
    updatedAt: string;  // ISO 8601
  };
}
```

### 9.4 Update User Settings

**Endpoint**: `PUT /api/users/settings`
**Authentication**: Required
**Rate Limit**: Standard

**Request Body**: Same as Get User Settings (all fields optional)

**Response (200)**:
```typescript
interface UpdateUserSettingsResponse {
  success: true;
  data: {
    settings: UserSettingsResponse['data'];
    message: string;
  };
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
```typescript
interface GetAdminUsersParams {
  status?: 'active' | 'inactive' | 'suspended';
  role?: 'customer' | 'shop_owner' | 'admin';
  search?: string;  // Search by name/email/phone
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface GetAdminUsersResponse {
  success: true;
  data: {
    users: UserProfileResponse['data'][];
    totalCount: number;
    hasMore: boolean;
  };
}
```

### 10.2 Update User Status (Admin)

**Endpoint**: `PUT /api/admin/users/:userId/status`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Path Parameters**:
- `userId`: User UUID (required)

**Request Body**:
```typescript
interface UpdateUserStatusRequest {
  status: 'active' | 'inactive' | 'suspended';  // Required
  reason?: string;
}
```

**Response (200)**:
```typescript
interface UpdateUserStatusResponse {
  success: true;
  data: {
    userId: string;
    status: 'active' | 'inactive' | 'suspended';
    message: string;
  };
}
```

### 10.3 Get Shop Approval Queue (Admin)

**Endpoint**: `GET /api/admin/shops/approval`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Query Parameters**:
```typescript
interface GetShopApprovalParams {
  status?: 'pending' | 'approved' | 'rejected';
  page?: number;
  limit?: number;
}
```

**Response (200)**:
```typescript
interface GetShopApprovalResponse {
  success: true;
  data: {
    shops: Array<{
      id: string;
      name: string;
      ownerId: string;
      ownerName: string;
      status: 'pending' | 'approved' | 'rejected';
      submittedAt: string;  // ISO 8601
      reviewedAt?: string;  // ISO 8601
      reviewedBy?: string;
      rejectionReason?: string;
    }>;
    totalCount: number;
    hasMore: boolean;
  };
}
```

### 10.4 Approve/Reject Shop (Admin)

**Endpoint**: `PUT /api/admin/shops/:shopId/approval`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Path Parameters**:
- `shopId`: Shop UUID (required)

**Request Body**:
```typescript
interface ShopApprovalRequest {
  action: 'approve' | 'reject';  // Required
  reason?: string;  // Optional for approve, required for reject
}
```

**Response (200)**:
```typescript
interface ShopApprovalResponse {
  success: true;
  data: {
    shopId: string;
    status: 'approved' | 'rejected';
    message: string;
  };
}
```

### 10.5 Admin Analytics

**Endpoint**: `GET /api/admin/analytics`
**Authentication**: Required (admin role)
**Rate Limit**: 1000 per 15 min

**Query Parameters**:
```typescript
interface GetAnalyticsParams {
  startDate?: string;  // YYYY-MM-DD
  endDate?: string;  // YYYY-MM-DD
  metric?: 'users' | 'reservations' | 'revenue' | 'shops';
}
```

**Response (200)**:
```typescript
interface AdminAnalyticsResponse {
  success: true;
  data: {
    period: {
      startDate: string;  // YYYY-MM-DD
      endDate: string;  // YYYY-MM-DD
    };
    metrics: {
      totalUsers: number;
      activeUsers: number;
      newUsers: number;
      totalReservations: number;
      completedReservations: number;
      cancelledReservations: number;
      totalRevenue: number;
      averageOrderValue: number;
      totalShops: number;
      activeShops: number;
    };
    trends: Array<{
      date: string;  // YYYY-MM-DD
      value: number;
    }>;
  };
}
```

---

## Response Format Standards

### Success Response

All successful API responses follow this format:

```typescript
interface SuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
  timestamp?: string;  // ISO 8601
}
```

### Error Response

All error responses follow this format:

```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: any[];
    timestamp?: string;  // ISO 8601
  };
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

### Web Error Handling Example

**JavaScript Version**:
```javascript
class ApiError extends Error {
  constructor(statusCode, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }

  static fromResponse(error) {
    if (error.response) {
      const { status, data } = error.response;
      return new ApiError(
        status,
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An error occurred',
        data.error?.details
      );
    }

    if (error.request) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'No internet connection',
        null
      );
    }

    return new ApiError(
      0,
      'UNKNOWN_ERROR',
      error.message,
      null
    );
  }
}

// Error handling wrapper for async calls
async function handleApiCall(apiCall) {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    throw ApiError.fromResponse(error);
  }
}

// Usage
try {
  const shops = await handleApiCall(() =>
    axios.get(`${API_CONFIG.baseUrl}/api/shops/nearby`)
  );
  console.log(shops);
} catch (error) {
  if (error instanceof ApiError) {
    console.error(`Error ${error.code}: ${error.message}`);
    if (error.statusCode === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
  }
}
```

**TypeScript Version**:
```typescript
class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: any
  ) {
    super(message);
    this.name = 'ApiError';
  }

  static fromResponse(error: any): ApiError {
    if (error.response) {
      const { status, data } = error.response;
      return new ApiError(
        status,
        data.error?.code || 'UNKNOWN_ERROR',
        data.error?.message || 'An error occurred',
        data.error?.details
      );
    }

    if (error.request) {
      return new ApiError(
        0,
        'NETWORK_ERROR',
        'No internet connection'
      );
    }

    return new ApiError(
      0,
      'UNKNOWN_ERROR',
      error.message
    );
  }
}

async function handleApiCall<T>(apiCall: () => Promise<AxiosResponse<T>>): Promise<T> {
  try {
    const response = await apiCall();
    return response.data;
  } catch (error) {
    throw ApiError.fromResponse(error);
  }
}
```

---

## Web Service Implementation Guide

### Base Service Class

**JavaScript Version**:
```javascript
import axios from 'axios';

class BaseService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  setupInterceptors() {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const accessToken = TokenStorage.getAccessToken();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // If 401 and not already retried, try to refresh token
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            TokenStorage.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  async refreshAccessToken() {
    const refreshToken = TokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(
      `${this.baseUrl}/api/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    TokenStorage.setTokens(accessToken, newRefreshToken);

    return accessToken;
  }

  // HTTP methods
  async get(url, params) {
    return this.client.get(url, { params });
  }

  async post(url, data) {
    return this.client.post(url, data);
  }

  async put(url, data) {
    return this.client.put(url, data);
  }

  async delete(url) {
    return this.client.delete(url);
  }
}
```

**TypeScript Version**:
```typescript
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';

class BaseService {
  protected client: AxiosInstance;

  constructor(protected baseUrl: string) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor - add auth token
    this.client.interceptors.request.use(
      (config) => {
        const accessToken = TokenStorage.getAccessToken();
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
        }
        return config;
      },
      (error) => Promise.reject(error)
    );

    // Response interceptor - handle token refresh
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            const newAccessToken = await this.refreshAccessToken();
            originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
            return this.client(originalRequest);
          } catch (refreshError) {
            TokenStorage.clearTokens();
            window.location.href = '/login';
            return Promise.reject(refreshError);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  private async refreshAccessToken(): Promise<string> {
    const refreshToken = TokenStorage.getRefreshToken();

    if (!refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post<RefreshTokenResponse>(
      `${this.baseUrl}/api/auth/refresh`,
      { refreshToken }
    );

    const { accessToken, refreshToken: newRefreshToken } = response.data.data;
    TokenStorage.setTokens(accessToken, newRefreshToken);

    return accessToken;
  }

  // HTTP methods
  protected async get<T = any>(url: string, params?: any): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, { params });
  }

  protected async post<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data);
  }

  protected async put<T = any>(url: string, data?: any): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data);
  }

  protected async delete<T = any>(url: string): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url);
  }
}
```

### Example Service Implementation

**TypeScript Version**:
```typescript
class ShopService extends BaseService {
  async getNearbyShops(params: {
    latitude: number;
    longitude: number;
    radius?: number;
    category?: string;
    limit?: number;
  }): Promise<Shop[]> {
    const { latitude, longitude, radius = 10, category, limit = 20 } = params;

    const response = await this.get<NearbyShopsResponse>('/api/shops/nearby', {
      latitude: latitude.toString(),
      longitude: longitude.toString(),
      radius: radius.toString(),
      category,
      limit: limit.toString(),
    });

    return response.data.data.shops;
  }

  async getShopDetails(shopId: string): Promise<Shop> {
    const response = await this.get<ShopDetailsResponse>(`/api/shops/${shopId}`);
    return response.data.data.shop;
  }

  async createShop(shopData: CreateShopRequest): Promise<Shop> {
    const response = await this.post<CreateShopResponse>('/api/shops', shopData);
    return response.data.data.shop;
  }
}
```

### State Management Integration

**React Context Example**:
```typescript
// contexts/ApiContext.tsx
import React, { createContext, useContext, useMemo } from 'react';
import { API_CONFIG } from '../config/api.config';
import { AuthService } from '../services/auth.service';
import { ShopService } from '../services/shop.service';
import { ReservationService } from '../services/reservation.service';

interface ApiContextValue {
  authService: AuthService;
  shopService: ShopService;
  reservationService: ReservationService;
}

const ApiContext = createContext<ApiContextValue | undefined>(undefined);

export const ApiProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const services = useMemo(() => ({
    authService: new AuthService(API_CONFIG.baseUrl),
    shopService: new ShopService(API_CONFIG.baseUrl),
    reservationService: new ReservationService(API_CONFIG.baseUrl),
  }), []);

  return (
    <ApiContext.Provider value={services}>
      {children}
    </ApiContext.Provider>
  );
};

export const useApi = () => {
  const context = useContext(ApiContext);
  if (!context) {
    throw new Error('useApi must be used within ApiProvider');
  }
  return context;
};

// Usage in components
function ShopList() {
  const { shopService } = useApi();
  const [shops, setShops] = useState<Shop[]>([]);

  useEffect(() => {
    async function loadShops() {
      try {
        const nearbyShops = await shopService.getNearbyShops({
          latitude: 37.5665,
          longitude: 126.9780,
          radius: 10
        });
        setShops(nearbyShops);
      } catch (error) {
        console.error('Failed to load shops:', error);
      }
    }

    loadShops();
  }, [shopService]);

  return (
    <div>
      {shops.map(shop => (
        <div key={shop.id}>{shop.name}</div>
      ))}
    </div>
  );
}
```

**Redux Toolkit Example**:
```typescript
// store/slices/shopSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { ShopService } from '../../services/shop.service';
import { API_CONFIG } from '../../config/api.config';

const shopService = new ShopService(API_CONFIG.baseUrl);

export const fetchNearbyShops = createAsyncThunk(
  'shops/fetchNearby',
  async (params: {
    latitude: number;
    longitude: number;
    radius?: number;
  }) => {
    return await shopService.getNearbyShops(params);
  }
);

interface ShopState {
  shops: Shop[];
  loading: boolean;
  error: string | null;
}

const initialState: ShopState = {
  shops: [],
  loading: false,
  error: null,
};

const shopSlice = createSlice({
  name: 'shops',
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchNearbyShops.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchNearbyShops.fulfilled, (state, action) => {
        state.loading = false;
        state.shops = action.payload;
      })
      .addCase(fetchNearbyShops.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch shops';
      });
  },
});

export default shopSlice.reducer;

// Usage in components
import { useDispatch, useSelector } from 'react-redux';
import { fetchNearbyShops } from './store/slices/shopSlice';

function ShopList() {
  const dispatch = useDispatch();
  const { shops, loading, error } = useSelector((state) => state.shops);

  useEffect(() => {
    dispatch(fetchNearbyShops({
      latitude: 37.5665,
      longitude: 126.9780,
      radius: 10
    }));
  }, [dispatch]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div>
      {shops.map(shop => (
        <div key={shop.id}>{shop.name}</div>
      ))}
    </div>
  );
}
```

---

## Web-Specific Considerations

### CORS (Cross-Origin Resource Sharing)

The backend is configured to handle CORS automatically. For development:

```javascript
// Backend already handles CORS
// No additional configuration needed on frontend

// If using custom headers or credentials:
axios.defaults.withCredentials = true;  // For cookies
```

### Cookie Handling

For production, consider using httpOnly cookies for refresh tokens:

```javascript
// Backend sends refresh token as httpOnly cookie
// Frontend automatically includes it in requests

// No need to manually handle refresh token storage
// Access token still stored in sessionStorage/memory
```

### XSS Protection

**Best Practices**:
- Never use `dangerouslySetInnerHTML` with user input
- Sanitize all user input before rendering
- Use Content Security Policy (CSP) headers
- Store sensitive data in httpOnly cookies

```javascript
// Use DOMPurify for sanitizing HTML
import DOMPurify from 'dompurify';

const cleanHTML = DOMPurify.sanitize(userInput);
```

### CSRF Protection

The backend handles CSRF tokens automatically. For forms:

```javascript
// CSRF token automatically included in requests
// via axios interceptors or fetch headers
```

### Browser Storage Options

**Comparison**:

| Storage Type | Size Limit | Lifetime | Accessible via JS | Sent with Requests |
|--------------|------------|----------|-------------------|--------------------|
| localStorage | ~5-10MB | Forever | Yes | No |
| sessionStorage | ~5-10MB | Session | Yes | No |
| Cookies | ~4KB | Configurable | Yes (unless httpOnly) | Yes |
| IndexedDB | ~50MB+ | Forever | Yes | No |

**Recommendations**:
- **Access Token**: sessionStorage or memory (XSS mitigation)
- **Refresh Token**: httpOnly cookie (preferred) or localStorage
- **User Preferences**: localStorage
- **Large Data**: IndexedDB

### Performance Optimization

**Request Debouncing**:
```javascript
import { debounce } from 'lodash';

const searchShops = debounce(async (query) => {
  const shops = await shopService.search(query);
  setSearchResults(shops);
}, 300);
```

**Request Caching**:
```javascript
// Using React Query
import { useQuery } from '@tanstack/react-query';

function useNearbyShops(latitude, longitude) {
  return useQuery({
    queryKey: ['nearbyShops', latitude, longitude],
    queryFn: () => shopService.getNearbyShops({ latitude, longitude }),
    staleTime: 5 * 60 * 1000,  // 5 minutes
    cacheTime: 10 * 60 * 1000,  // 10 minutes
  });
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

**JavaScript Date Handling**:
```javascript
// Format date for API
const formatDate = (date) => {
  return date.toISOString().split('T')[0];  // YYYY-MM-DD
};

// Parse ISO 8601 timestamp
const parseTimestamp = (timestamp) => {
  return new Date(timestamp);
};

// Format time for API
const formatTime = (date) => {
  return date.toTimeString().slice(0, 5);  // HH:MM
};
```

### UUIDs

All IDs in the system are UUIDs in the format:
```
xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### Currency

All monetary amounts are in Korean Won (KRW) as integers (no decimals).

```javascript
// Format currency for display
const formatCurrency = (amount) => {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
};

// Example: formatCurrency(50000) => "₩50,000"
```

### Geolocation

- **Latitude**: -90 to 90 (decimal degrees)
- **Longitude**: -180 to 180 (decimal degrees)
- **Coordinate System**: WGS84
- **Database**: PostGIS Geography type

**Browser Geolocation**:
```javascript
// Get user's current location
function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation not supported'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
      },
      (error) => reject(error),
      {
        enableHighAccuracy: true,
        timeout: 5000,
        maximumAge: 0
      }
    );
  });
}

// Usage
try {
  const location = await getCurrentPosition();
  const shops = await shopService.getNearbyShops(location);
} catch (error) {
  console.error('Failed to get location:', error);
}
```

### Image URLs

All image URLs are absolute URLs pointing to Supabase Storage or CDN.

**Image Loading Optimization**:
```javascript
// Lazy loading images
<img
  src={shop.images[0]}
  alt={shop.name}
  loading="lazy"
  decoding="async"
/>

// Responsive images
<img
  src={shop.images[0]}
  srcSet={`
    ${shop.images[0]}?width=400 400w,
    ${shop.images[0]}?width=800 800w,
    ${shop.images[0]}?width=1200 1200w
  `}
  sizes="(max-width: 600px) 400px, (max-width: 1200px) 800px, 1200px"
  alt={shop.name}
/>
```

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
