# 에뷰리띵 서비스 API - 프론트엔드 개발 가이드

## 📋 목차
1. [개요](#개요)
2. [빠른 시작](#빠른-시작)
3. [인증 (Authentication)](#인증-authentication)
4. [사용자 여정별 API](#사용자-여정별-api)
5. [공통 패턴 및 에러 처리](#공통-패턴-및-에러-처리)
6. [프론트엔드 통합 가이드](#프론트엔드-통합-가이드)

---

## 개요

에뷰리띵 서비스 API는 뷰티 예약 플랫폼의 사용자 대면 기능을 제공합니다. 이 문서는 웹 프론트엔드 개발자가 사용자 서비스 웹페이지를 구축하기 위한 완전한 가이드입니다.

### 기본 정보
- **Base URL**: `http://localhost:3001/api` (개발), `https://api.ebeautything.com/api` (프로덕션)
- **API 문서**: http://localhost:3001/service-docs
- **인증 방식**: JWT Bearer Token
- **응답 형식**: JSON
- **문자 인코딩**: UTF-8

### 핵심 기능 영역
1. 🔐 **인증 & 회원가입** - 소셜 로그인, 휴대폰 인증
2. 🏪 **샵 탐색** - 검색, 필터링, 위치 기반 검색
3. 📋 **서비스 카탈로그** - 서비스 목록, 인기/트렌딩 서비스
4. 📅 **예약 관리** - 예약 생성, 조회, 취소, 변경
5. 💳 **결제** - 토스페이먼츠 연동, 예약금/잔금 결제
6. 🎁 **포인트 & 리워드** - 포인트 적립/사용, 추천 시스템
7. ⭐ **즐겨찾기** - 샵 찜하기, 관리
8. 🔔 **알림** - 푸시 알림, FCM 연동
9. ⚙️ **사용자 설정** - 프로필, 환경설정

---

## 빠른 시작

### 표준 응답 형식

**성공 응답:**
```json
{
  "success": true,
  "data": { ... },
  "message": "작업이 성공적으로 완료되었습니다."
}
```

**에러 응답:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "details": { ... }
  }
}
```

### 필수 헤더

```javascript
{
  "Content-Type": "application/json",
  "Authorization": "Bearer {access_token}"  // 인증이 필요한 경우
}
```

---

## 인증 (Authentication)

### 1. 소셜 로그인

#### 통합 소셜 로그인
모든 소셜 제공자(Kakao, Apple, Google)는 하나의 통합 엔드포인트를 사용합니다.

```http
POST /api/auth/social-login
Content-Type: application/json

{
  "provider": "kakao",  // kakao, apple, google 중 하나
  "token": "social_provider_access_token",
  "fcmToken": "firebase_fcm_token",  // 선택사항
  "deviceInfo": {  // 선택사항
    "deviceId": "device_unique_id",
    "platform": "web",  // ios, android, web
    "version": "1.0.0"
  }
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "email": "user@example.com",
      "name": "홍길동",
      "profileImage": "https://..."
    },
    "tokens": {
      "accessToken": "eyJhbGc...",
      "refreshToken": "eyJhbGc..."
    },
    "isNewUser": false,
    "profileComplete": true
  }
}
```

**참고:**
- 각 제공자의 OAuth 토큰을 먼저 획득한 후 이 엔드포인트에 전달합니다
- 신규 사용자의 경우 `isNewUser: true`가 반환되며, 추가 프로필 입력이 필요할 수 있습니다

### 2. 휴대폰 인증

#### 인증 코드 발송 (통합)
PASS 인증 또는 SMS 인증 방식을 선택하여 인증을 시작합니다.

```http
POST /api/auth/send-verification-code
Content-Type: application/json

{
  "phoneNumber": "01012345678",
  "method": "pass",  // "pass" 또는 "sms" (선택사항, 기본값: sms)
  "userId": "user-uuid"  // 선택사항: 기존 사용자 인증 시
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "method": "pass",
    "txId": "transaction-id-12345",
    "redirectUrl": "https://pass.example.com/verify?tx=...",  // PASS 방식인 경우
    "expiresAt": "2025-10-08T10:30:00Z",
    "message": "인증 요청이 전송되었습니다."
  }
}
```

**참고:**
- `method: "pass"` - PASS 앱을 통한 본인인증 (redirectUrl 사용)
- `method: "sms"` - SMS 문자로 6자리 인증번호 발송

#### 인증 코드 확인 (통합)
발송된 인증 코드를 확인합니다.

```http
POST /api/auth/verify-phone
Content-Type: application/json

{
  "txId": "transaction-id-12345",
  "otpCode": "123456",  // SMS 방식인 경우
  "passResult": {  // PASS 방식인 경우
    "ci": "...",
    "di": "..."
  },
  "method": "sms"  // "pass" 또는 "sms"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "verified": true,
    "userId": "user-uuid",  // 기존 사용자인 경우
    "phoneNumber": "01012345678",
    "method": "sms",
    "message": "인증이 완료되었습니다."
  }
}
```

### 3. 회원가입 완료

소셜 로그인 후 추가 정보를 입력하여 회원가입을 완료합니다.

```http
POST /api/auth/register
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "name": "홍길동",
  "email": "user@example.com",  // optional
  "phoneNumber": "01012345678",
  "birthDate": "1990-01-01",  // optional
  "gender": "male",  // male, female, other - optional
  "nickname": "사용자닉네임",  // optional
  "referredByCode": "FRIEND123",  // optional - 추천인 코드
  "marketingConsent": true,  // optional - 마케팅 수신 동의
  "termsAccepted": true,  // required - 이용약관 동의
  "privacyAccepted": true  // required - 개인정보처리방침 동의
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "name": "홍길동",
      "email": "user@example.com",
      "phoneNumber": "01012345678",
      "nickname": "사용자닉네임",
      "profileImageUrl": null,
      "role": "user",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "profileComplete": true,
    "referralCode": "USER789",  // 본인의 추천인 코드
    "message": "회원가입이 완료되었습니다"
  }
}
```

### 4. 프로바이더 설정 조회

소셜 로그인 프로바이더의 설정 상태를 조회합니다.

```http
GET /api/auth/providers
```

**응답:**
```json
{
  "success": true,
  "data": {
    "kakao": {
      "enabled": true,
      "configured": true
    },
    "apple": {
      "enabled": true,
      "configured": true
    },
    "google": {
      "enabled": true,
      "configured": true
    }
  }
}
```

### 5. 토큰 관리

#### 토큰 갱신
```http
POST /api/auth/refresh
Content-Type: application/json

{
  "refreshToken": "eyJhbGc..."
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "accessToken": "new_access_token",
    "refreshToken": "new_refresh_token"
  }
}
```

#### 로그아웃 (현재 디바이스)
```http
POST /api/auth/logout
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "message": "로그아웃되었습니다"
}
```

#### 모든 디바이스에서 로그아웃
```http
POST /api/auth/logout-all
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "message": "모든 디바이스에서 로그아웃되었습니다"
}
```

#### Supabase 세션 갱신
```http
POST /api/auth/refresh-supabase
Content-Type: application/json

{
  "refreshToken": "supabase_refresh_token"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "session": {
      "access_token": "new_supabase_access_token",
      "refresh_token": "new_supabase_refresh_token",
      "expires_in": 3600
    }
  }
}
```

### 6. 세션 관리

#### 활성 세션 조회
```http
GET /api/auth/sessions
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "deviceId": "device-123",
        "platform": "ios",
        "lastActive": "2024-01-15T10:30:00Z",
        "current": true
      },
      {
        "deviceId": "device-456",
        "platform": "web",
        "lastActive": "2024-01-14T18:20:00Z",
        "current": false
      }
    ]
  }
}
```

---

## 사용자 여정별 API

## 여정 1: 탐색 & 검색

### 샵 조회

#### 샵 목록 조회
```http
GET /api/shops?page={페이지}&limit={개수}&category={카테고리}
```

**쿼리 파라미터:**
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지당 개수 (기본값: 20, 최대: 100)
- `category`: 카테고리 필터 (optional)
- `sortBy`: 정렬 기준 (rating, distance, newest) (optional)

**응답:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "네일샵 이름",
        "category": "nail",
        "address": "서울시 강남구...",
        "rating": 4.5,
        "reviewCount": 120,
        "priceRange": "30000-80000",
        "images": ["url1", "url2"],
        "isOpen": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalCount": 200,
      "hasMore": true
    }
  }
}
```

#### 샵 상세 정보
```http
GET /api/shops/{shopId}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "네일샵 이름",
    "category": "nail",
    "description": "샵 설명...",
    "address": "서울시 강남구...",
    "latitude": 37.5665,
    "longitude": 126.9780,
    "rating": 4.5,
    "reviewCount": 120,
    "priceRange": "30000-80000",
    "images": ["url1", "url2"],
    "operatingHours": {
      "monday": { "open": "10:00", "close": "20:00" },
      "tuesday": { "open": "10:00", "close": "20:00" }
    },
    "services": [
      {
        "id": "service-uuid",
        "name": "젤 네일",
        "price": 45000,
        "duration": 60
      }
    ],
    "amenities": ["주차", "WiFi", "카드결제"],
    "policies": {
      "cancellation": "24시간 전까지 무료 취소",
      "noShow": "노쇼 시 패널티 부과"
    }
  }
}
```

### 샵 검색

#### 고급 검색
```http
GET /api/shops/search?q={검색어}&category={카테고리}&latitude={위도}&longitude={경도}&radius={반경}
```

**쿼리 파라미터:**
- `q`: 검색 키워드
- `category`: 카테고리 (nail, eyelash, waxing, eyebrow_tattoo, hair)
- `latitude`: 위도
- `longitude`: 경도
- `radius`: 검색 반경 (미터)
- `minPrice`, `maxPrice`: 가격 범위
- `rating`: 최소 평점
- `page`, `limit`: 페이지네이션

**응답:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "네일샵 이름",
        "category": "nail",
        "address": "서울시 강남구...",
        "rating": 4.5,
        "reviewCount": 120,
        "distance": 450,
        "priceRange": "30000-80000",
        "images": ["url1", "url2"],
        "isOpen": true,
        "isFavorite": false
      }
    ],
    "totalCount": 45,
    "hasMore": true
  }
}
```

#### 위치 기반 검색
```http
GET /api/shops/nearby?latitude={위도}&longitude={경도}&radius={반경}
```

#### 검색 제안
```http
GET /api/shops/search/suggestions?q={검색어}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "suggestions": ["네일아트", "네일샵", "네일케어"]
  }
}
```

#### 지도 범위 내 검색
```http
GET /api/shops/bounds?minLat={최소위도}&maxLat={최대위도}&minLng={최소경도}&maxLng={최대경도}
```

**쿼리 파라미터:**
- `minLat`, `maxLat`: 위도 범위
- `minLng`, `maxLng`: 경도 범위
- `category`: 카테고리 필터 (optional)

**응답:**
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "네일샵 이름",
        "latitude": 37.5665,
        "longitude": 126.9780,
        "category": "nail"
      }
    ],
    "totalCount": 25
  }
}
```

#### 인기 검색어
```http
GET /api/shops/search/popular
```

**응답:**
```json
{
  "success": true,
  "data": {
    "keywords": [
      { "keyword": "네일아트", "count": 1234 },
      { "keyword": "속눈썹 연장", "count": 892 },
      { "keyword": "왁싱", "count": 756 }
    ]
  }
}
```

### 서비스 카탈로그

#### 서비스 목록 조회
```http
GET /api/service-catalog?category={카테고리}&page={페이지}&limit={개수}
```

**쿼리 파라미터:**
- `q`: 검색어
- `category`: 서비스 카테고리
- `price_min`, `price_max`: 가격 범위
- `duration_min`, `duration_max`: 소요 시간 범위
- `service_level`: 서비스 레벨 (basic, premium, luxury)
- `difficulty_level`: 난이도 (beginner, intermediate, advanced)
- `featured_only`: 추천 서비스만 (true/false)
- `trending_only`: 트렌딩 서비스만 (true/false)
- `min_rating`: 최소 평점
- `sort_by`: 정렬 기준 (price, duration, rating, popularity, newest)
- `sort_order`: 정렬 순서 (asc, desc)

**응답:**
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "service-uuid",
        "name": "젤 네일 아트",
        "category": "nail",
        "description": "...",
        "basePrice": 45000,
        "duration": 60,
        "serviceLevel": "premium",
        "rating": 4.8,
        "bookingCount": 350,
        "images": ["url1"],
        "tags": ["아트", "프렌치"]
      }
    ],
    "totalCount": 150,
    "hasMore": true
  }
}
```

#### 인기 서비스
```http
GET /api/service-catalog/popular?limit={개수}&category={카테고리}
```

#### 트렌딩 서비스
```http
GET /api/service-catalog/trending?limit={개수}
```

#### 서비스 상세
```http
GET /api/service-catalog/{serviceId}
```

#### 서비스 카탈로그 통계
```http
GET /api/service-catalog/stats
```

#### 메타데이터 (카테고리, 레벨 등)
```http
GET /api/service-catalog/metadata
```

### 샵 정보

#### 샵 연락처 정보
```http
GET /api/shops/{shopId}/contact-info
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "phoneNumber": "02-1234-5678",
    "email": "shop@example.com",
    "kakaoTalkId": "shopkakao",
    "instagramId": "@shopinsta",
    "website": "https://shop.example.com"
  }
}
```

### 즐겨찾기

#### 즐겨찾기 추가
```http
POST /api/shops/{shopId}/favorite
Authorization: Bearer {access_token}
```

#### 즐겨찾기 제거
```http
DELETE /api/shops/{shopId}/favorite
Authorization: Bearer {access_token}
```

#### 즐겨찾기 토글
```http
PUT /api/shops/{shopId}/favorite
Authorization: Bearer {access_token}
```

#### 즐겨찾기 상태 확인
```http
GET /api/shops/{shopId}/favorite/status
Authorization: Bearer {access_token}
```

#### 내 즐겨찾기 목록
```http
GET /api/user/favorites?limit={개수}&offset={오프셋}&sortBy={정렬기준}
Authorization: Bearer {access_token}
```

**쿼리 파라미터:**
- `limit`: 페이지 크기 (1-100, 기본 50)
- `offset`: 시작 위치
- `category`: 카테고리 필터
- `sortBy`: 정렬 (recent, name, bookings)

#### 즐겨찾기 통계
```http
GET /api/user/favorites/stats
Authorization: Bearer {access_token}
```

#### 대량 즐겨찾기 추가/제거
```http
POST /api/user/favorites/bulk
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "shopIds": ["uuid1", "uuid2", "uuid3"],
  "action": "add"  // or "remove"
}
```

#### 여러 샵 즐겨찾기 상태 확인
```http
POST /api/user/favorites/check
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "shopIds": ["uuid1", "uuid2", "uuid3"]
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "favorites": {
      "uuid1": true,
      "uuid2": false,
      "uuid3": true
    },
    "summary": {
      "total": 3,
      "favorited": 2,
      "notFavorited": 1
    }
  }
}
```

---

## 여정 2: 예약 & 결제

### 예약 관리

#### 예약 가능 시간 조회
```http
GET /api/reservations/available-slots?shopId={샵ID}&serviceId={서비스ID}&date={날짜}
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "date": "2025-10-15",
    "slots": [
      {
        "time": "10:00",
        "available": true,
        "staffId": "staff-uuid",
        "staffName": "김디자이너"
      },
      {
        "time": "11:00",
        "available": false
      }
    ]
  }
}
```

#### 예약 생성
```http
POST /api/reservations
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "shopId": "shop-uuid",
  "serviceId": "service-uuid",
  "dateTime": "2025-10-15T10:00:00Z",
  "staffId": "staff-uuid",
  "notes": "요청사항"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "reservationId": "reservation-uuid",
    "status": "pending",
    "dateTime": "2025-10-15T10:00:00Z",
    "shopName": "네일샵 이름",
    "serviceName": "젤 네일",
    "totalAmount": 45000,
    "depositAmount": 13500
  }
}
```

#### 내 예약 목록
```http
GET /api/reservations?status={상태}&page={페이지}&limit={개수}
Authorization: Bearer {access_token}
```

**쿼리 파라미터:**
- `status`: pending, confirmed, completed, cancelled
- `startDate`, `endDate`: 날짜 범위

#### 예약 상세
```http
GET /api/reservations/{reservationId}
Authorization: Bearer {access_token}
```

#### 예약 취소
```http
PUT /api/reservations/{reservationId}/cancel
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "reason": "일정 변경",
  "refundMethod": "points"  // or "original"
}
```

#### 예약 변경 (리스케줄링)
```http
POST /api/reservations/{reservationId}/reschedule
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "newDateTime": "2025-10-16T14:00:00Z",
  "reason": "시간 변경"
}
```

### 결제 (TossPayments)

#### 결제 준비 (예약금)
```http
POST /api/payments/toss/prepare
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "reservationId": "reservation-uuid",
  "amount": 13500,
  "customerName": "홍길동",
  "customerEmail": "user@example.com",
  "customerMobilePhone": "01012345678",
  "paymentType": "deposit"
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "paymentKey": "payment-key",
    "orderId": "order-id",
    "amount": 13500,
    "tossPaymentUrl": "https://pay.toss.im/..."
  }
}
```

#### 결제 확인
```http
POST /api/payments/toss/confirm
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "paymentKey": "payment-key",
  "orderId": "order-id",
  "amount": 13500
}
```

#### 잔금 결제 준비
```http
POST /api/payments/final/prepare
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "reservationId": "reservation-uuid",
  "amount": 31500,
  "customerName": "홍길동",
  "customerEmail": "user@example.com"
}
```

#### 결제 상태 조회
```http
GET /api/payments/status/{reservationId}
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "reservationId": "reservation-uuid",
    "totalAmount": 45000,
    "depositPaid": true,
    "depositAmount": 13500,
    "finalPaid": false,
    "remainingAmount": 31500,
    "paymentStatus": "deposit_paid"
  }
}
```

#### 결제 내역 조회
```http
GET /api/payments/{paymentId}
Authorization: Bearer {access_token}
```

#### 사용자 결제 내역
```http
GET /api/payments/user/{userId}
Authorization: Bearer {access_token}
```

---

## 여정 3: 포인트 & 리워드

### 포인트 시스템

#### 포인트 잔액 조회
```http
GET /api/users/{userId}/points/balance
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "balance": 15000,
    "currency": "KRW",
    "expiringPoints": [
      {
        "amount": 5000,
        "expiryDate": "2025-12-31"
      }
    ]
  }
}
```

#### 포인트 내역
```http
GET /api/users/{userId}/points/history?page={페이지}&limit={개수}
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      {
        "id": "transaction-uuid",
        "type": "earn",
        "amount": 1000,
        "description": "예약 완료 적립",
        "balanceAfter": 15000,
        "createdAt": "2025-10-06T10:00:00Z"
      }
    ],
    "totalCount": 50,
    "hasMore": true
  }
}
```

#### 포인트 사용
```http
POST /api/points/use
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "amount": 5000,
  "reservationId": "reservation-uuid",
  "description": "서비스 결제"
}
```

### 추천 시스템

#### 추천 코드 생성
```http
POST /api/referral-codes/generate
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "length": 6,
  "excludeSimilar": true,
  "excludeProfanity": true
}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "code": "ABC123",
    "userId": "user-uuid",
    "createdAt": "2025-10-06T10:00:00Z",
    "shareUrl": "https://app.com/join?ref=ABC123"
  }
}
```

#### 추천 코드 검증
```http
GET /api/referral-codes/validate/{code}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "valid": true,
    "code": "ABC123",
    "referrerName": "홍길동",
    "rewardAmount": 5000
  }
}
```

---

## 여정 4: 알림 & 설정

### 푸시 알림 (FCM)

#### 디바이스 토큰 등록
```http
POST /api/notifications/register
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "token": "fcm_device_token",
  "deviceType": "web"  // android, ios, web
}
```

#### 디바이스 토큰 해제
```http
POST /api/notifications/unregister
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "token": "fcm_device_token"
}
```

#### 테스트 알림 보내기
```http
POST /api/notifications/send
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "title": "테스트 알림",
  "body": "알림 내용",
  "data": {
    "type": "test",
    "url": "/reservations/123"
  }
}
```

#### 알림 설정 조회
```http
GET /api/notifications/settings
Authorization: Bearer {access_token}
```

**응답:**
```json
{
  "success": true,
  "data": {
    "settings": {
      "pushEnabled": true,
      "emailEnabled": false,
      "smsEnabled": true,
      "reservationUpdates": true,
      "paymentNotifications": true,
      "promotionalMessages": false,
      "systemAlerts": true
    }
  }
}
```

#### 알림 설정 업데이트
```http
PUT /api/notifications/settings
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "pushEnabled": true,
  "reservationUpdates": true,
  "promotionalMessages": false
}
```

#### 알림 내역
```http
GET /api/notifications/history?limit={개수}&offset={오프셋}
Authorization: Bearer {access_token}
```

#### 알림 템플릿 목록
```http
GET /api/notifications/templates
Authorization: Bearer {access_token}
```

#### 등록된 디바이스 토큰 조회
```http
GET /api/notifications/tokens
Authorization: Bearer {access_token}
```

### 사용자 설정

#### 설정 조회
```http
GET /api/settings
Authorization: Bearer {access_token}
```

#### 설정 업데이트
```http
PUT /api/settings
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "language": "ko",
  "theme": "dark",
  "notifications": {
    "push": true,
    "email": false
  }
}
```

#### 대량 설정 업데이트
```http
PUT /api/settings/bulk
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "settings": [
    { "key": "theme", "value": "dark" },
    { "key": "language", "value": "ko" }
  ]
}
```

#### 설정 초기화
```http
POST /api/settings/reset
Authorization: Bearer {access_token}
Content-Type: application/json

{
  "category": "all"  // or specific category
}
```

#### 설정 히스토리
```http
GET /api/settings/history?limit={개수}&offset={오프셋}
Authorization: Bearer {access_token}
```

#### 설정 카테고리 조회
```http
GET /api/settings/categories
Authorization: Bearer {access_token}
```

#### 검증 규칙 조회
```http
GET /api/settings/validation-rules
Authorization: Bearer {access_token}
```

#### 기본 설정 조회
```http
GET /api/settings/defaults
Authorization: Bearer {access_token}
```

---

## 공통 패턴 및 에러 처리

### Rate Limiting

대부분의 엔드포인트는 rate limiting이 적용되어 있습니다:

```javascript
// 일반 엔드포인트: 15분당 100 요청
// 검색 엔드포인트: 5분당 100 요청
// 결제 엔드포인트: 15분당 50 요청
// 알림 발송: 15분당 5 요청
```

**Rate Limit 초과 응답:**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests, please try again later.",
    "retryAfter": 300
  }
}
```

### 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|----------|------|
| `UNAUTHORIZED` | 401 | 인증 필요 |
| `FORBIDDEN` | 403 | 권한 없음 |
| `NOT_FOUND` | 404 | 리소스 없음 |
| `VALIDATION_ERROR` | 400 | 입력 검증 실패 |
| `PAYMENT_FAILED` | 402 | 결제 실패 |
| `RATE_LIMIT_EXCEEDED` | 429 | Rate limit 초과 |
| `INTERNAL_ERROR` | 500 | 서버 에러 |

### 페이지네이션

대부분의 목록 API는 페이지네이션을 지원합니다:

```javascript
// 쿼리 파라미터
{
  page: 1,        // 페이지 번호 (1부터 시작)
  limit: 20,      // 페이지 크기 (최대 100)
  offset: 0       // 일부 API는 offset 방식 사용
}

// 응답
{
  success: true,
  data: {
    items: [...],
    totalCount: 150,
    hasMore: true,
    pagination: {
      page: 1,
      limit: 20,
      totalPages: 8
    }
  }
}
```

### 필터링 & 정렬

```javascript
// 일반적인 필터 파라미터
{
  category: 'nail',
  minPrice: 10000,
  maxPrice: 50000,
  rating: 4.0,
  sortBy: 'popularity',  // price, rating, newest, distance
  sortOrder: 'desc'       // asc, desc
}
```

---

## 프론트엔드 통합 가이드

### 1. 인증 플로우 구현

```javascript
// 1. 소셜 로그인
async function loginWithKakao(authCode) {
  const response = await fetch('/api/auth/kakao/callback', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      code: authCode,
      redirectUri: window.location.origin + '/auth/callback'
    })
  });

  const { data } = await response.json();

  // 토큰 저장
  localStorage.setItem('accessToken', data.accessToken);
  localStorage.setItem('refreshToken', data.refreshToken);

  return data.user;
}

// 2. 토큰 갱신
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');

  const response = await fetch('/api/auth/refresh', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken })
  });

  const { data } = await response.json();
  localStorage.setItem('accessToken', data.accessToken);

  return data.accessToken;
}

// 3. API 요청 인터셉터
async function apiRequest(url, options = {}) {
  let token = localStorage.getItem('accessToken');

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers
    }
  });

  // 401 에러 시 토큰 갱신 후 재시도
  if (response.status === 401) {
    token = await refreshAccessToken();
    return fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${token}`
      }
    });
  }

  return response;
}
```

### 2. 예약 플로우 구현

```javascript
// 1. 샵 검색
async function searchShops(filters) {
  const params = new URLSearchParams(filters);
  const response = await apiRequest(`/api/shops/search?${params}`);
  return response.json();
}

// 2. 예약 가능 시간 조회
async function getAvailableSlots(shopId, serviceId, date) {
  const params = new URLSearchParams({ shopId, serviceId, date });
  const response = await apiRequest(`/api/reservations/available-slots?${params}`);
  return response.json();
}

// 3. 예약 생성
async function createReservation(reservationData) {
  const response = await apiRequest('/api/reservations', {
    method: 'POST',
    body: JSON.stringify(reservationData)
  });
  return response.json();
}

// 4. 결제 진행
async function processPayment(reservationId, amount) {
  // 결제 준비
  const prepareResponse = await apiRequest('/api/payments/toss/prepare', {
    method: 'POST',
    body: JSON.stringify({
      reservationId,
      amount,
      customerName: user.name,
      customerEmail: user.email,
      paymentType: 'deposit'
    })
  });

  const { data } = await prepareResponse.json();

  // 토스페이먼츠 결제창 오픈
  window.open(data.tossPaymentUrl, '_blank');

  // 결제 완료 후 콜백에서 confirm 호출
  return data;
}
```

### 3. 실시간 알림 구현 (FCM)

```javascript
// Firebase 초기화
import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  // Firebase 설정
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// FCM 토큰 등록
async function registerFCM() {
  try {
    const token = await getToken(messaging, {
      vapidKey: 'YOUR_VAPID_KEY'
    });

    // 서버에 토큰 등록
    await apiRequest('/api/notifications/register', {
      method: 'POST',
      body: JSON.stringify({
        token,
        deviceType: 'web'
      })
    });

    // 포그라운드 메시지 수신
    onMessage(messaging, (payload) => {
      console.log('Notification received:', payload);
      // 알림 UI 표시
      showNotification(payload.notification);
    });

  } catch (error) {
    console.error('FCM registration failed:', error);
  }
}
```

### 4. 에러 처리

```javascript
async function handleApiError(response) {
  if (!response.ok) {
    const error = await response.json();

    switch (error.error?.code) {
      case 'UNAUTHORIZED':
        // 로그인 페이지로 리다이렉트
        window.location.href = '/login';
        break;

      case 'RATE_LIMIT_EXCEEDED':
        // Rate limit 알림 표시
        const retryAfter = error.error.retryAfter;
        showNotification(`잠시 후 다시 시도해주세요 (${retryAfter}초)`);
        break;

      case 'VALIDATION_ERROR':
        // 유효성 검사 에러 표시
        showValidationErrors(error.error.details);
        break;

      case 'PAYMENT_FAILED':
        // 결제 실패 처리
        showPaymentError(error.error.message);
        break;

      default:
        // 일반 에러
        showNotification('오류가 발생했습니다. 다시 시도해주세요.');
    }
  }

  return response;
}
```

### 5. 상태 관리 (React 예시)

```javascript
// Context API를 사용한 인증 상태 관리
import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 초기 인증 상태 확인
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserProfile();
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchUserProfile() {
    try {
      const response = await apiRequest('/api/users/me');
      const { data } = await response.json();
      setUser(data);
    } catch (error) {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    } finally {
      setLoading(false);
    }
  }

  const login = async (provider, authCode) => {
    const response = await fetch(`/api/auth/${provider}/callback`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: authCode })
    });

    const { data } = await response.json();
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);
    setUser(data.user);
  };

  const logout = async () => {
    await apiRequest('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
```

### 6. 유용한 유틸리티 함수

```javascript
// 날짜 포맷팅
function formatDate(dateString) {
  return new Date(dateString).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// 가격 포맷팅
function formatPrice(amount) {
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW'
  }).format(amount);
}

// 거리 포맷팅
function formatDistance(meters) {
  if (meters < 1000) {
    return `${meters}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

// 디바운스
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// 검색 디바운스 적용 예시
const debouncedSearch = debounce(async (keyword) => {
  const results = await searchShops({ keyword });
  updateSearchResults(results);
}, 300);
```

---

## 추가 리소스

### API 문서
- **Swagger UI**: http://localhost:3001/service-docs
- **OpenAPI Spec**: http://localhost:3001/api/service/openapi.json

### 개발 도구
- **Postman Collection**: 프로젝트 루트의 `postman/` 디렉토리 참조
- **환경 변수 예시**: `.env.example` 파일 참조

### 지원
- **기술 문서**: `/docs` 디렉토리
- **이슈 트래킹**: GitHub Issues
- **슬랙 채널**: #frontend-support

---

## 변경 이력

### v1.0.0 (2025-10-06)
- 초기 문서 작성
- 모든 서비스 API 엔드포인트 문서화
- 프론트엔드 통합 가이드 추가
