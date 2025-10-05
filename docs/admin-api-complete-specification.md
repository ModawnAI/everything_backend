# Admin API Complete Specification
**에뷰리띵 관리자 API 전체 명세**

> 프론트엔드 개발자를 위한 완전한 Admin API 레퍼런스 가이드

**Base URL**: `http://localhost:3001/api/admin`
**API 문서**: http://localhost:3001/admin-docs
**인증 방식**: JWT Bearer Token
**응답 형식**: JSON

---

## 📋 목차

1. [인증 및 세션 관리](#1-인증-및-세션-관리)
2. [대시보드 및 분석](#2-대시보드-및-분석)
3. [사용자 관리](#3-사용자-관리)
4. [샵 관리](#4-샵-관리)
   - 4.14 [샵 서비스 관리](#414-샵-서비스-관리)
5. [예약 관리](#5-예약-관리)
6. [결제 및 정산 관리](#6-결제-및-정산-관리)
7. [보안 및 모니터링](#7-보안-및-모니터링)
8. [콘텐츠 모더레이션](#8-콘텐츠-모더레이션)
9. [포인트 조정 시스템](#9-포인트-조정-시스템)
10. [재무 관리](#10-재무-관리)

---

## 🔐 공통 인증 헤더

모든 Admin API 요청에는 JWT 토큰이 필요합니다:

```http
Authorization: Bearer <admin-jwt-token>
```

## 📊 공통 응답 형식

### 성공 응답
```json
{
  "success": true,
  "data": { /* 응답 데이터 */ },
  "message": "선택적 메시지"
}
```

### 에러 응답
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "에러 메시지",
    "details": "추가 상세 정보"
  }
}
```

---

## 1. 인증 및 세션 관리

### 1.1 관리자 로그인
**POST** `/auth/login`

관리자 계정으로 로그인하여 JWT 토큰을 발급받습니다.

#### Request Body
```json
{
  "email": "admin@example.com",
  "password": "secure_password",
  "deviceInfo": {
    "userAgent": "Mozilla/5.0...",
    "platform": "Web",
    "ipAddress": "192.168.1.1"
  }
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "refresh_token_here",
    "expiresIn": 3600,
    "admin": {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "name": "Admin Name",
      "role": "admin",
      "permissions": ["user_management", "shop_management", "payment_management"]
    },
    "sessionId": "session-uuid"
  }
}
```

#### 에러 코드
- `INVALID_CREDENTIALS`: 잘못된 이메일 또는 비밀번호
- `ACCOUNT_LOCKED`: 계정이 잠김 (로그인 시도 초과)
- `ADMIN_ONLY`: 관리자 권한 필요

---

### 1.2 토큰 갱신
**POST** `/auth/refresh`

만료된 액세스 토큰을 리프레시 토큰으로 갱신합니다.

#### Request Body
```json
{
  "refreshToken": "refresh_token_here"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "token": "new_access_token",
    "refreshToken": "new_refresh_token",
    "expiresIn": 3600
  }
}
```

---

### 1.3 로그아웃
**POST** `/auth/logout`

현재 세션을 종료하고 토큰을 무효화합니다.

#### Response
```json
{
  "success": true,
  "message": "Successfully logged out"
}
```

---

### 1.4 현재 세션 정보
**GET** `/auth/session`

현재 로그인한 관리자의 세션 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "sessionId": "session-uuid",
    "admin": {
      "id": "admin-uuid",
      "email": "admin@example.com",
      "name": "Admin Name",
      "role": "admin"
    },
    "loginAt": "2024-01-01T10:00:00Z",
    "lastActivityAt": "2024-01-01T11:30:00Z",
    "ipAddress": "192.168.1.1",
    "userAgent": "Mozilla/5.0..."
  }
}
```

---

## 2. 대시보드 및 분석

### 2.1 대시보드 개요
**GET** `/analytics/dashboard`

관리자 대시보드의 핵심 지표를 조회합니다.

#### Query Parameters
- `period`: 기간 (today, week, month, year) - 기본값: today

#### Response
```json
{
  "success": true,
  "data": {
    "overview": {
      "totalUsers": 5000,
      "activeUsers": 3500,
      "totalShops": 200,
      "activeShops": 180,
      "todayReservations": 45,
      "todayRevenue": 2500000,
      "pendingApprovals": 15
    },
    "trends": {
      "userGrowth": 12.5,
      "shopGrowth": 8.3,
      "revenueGrowth": 15.2,
      "reservationGrowth": 10.1
    },
    "alerts": [
      {
        "type": "pending_approvals",
        "count": 15,
        "severity": "medium",
        "message": "15 shops pending approval"
      }
    ]
  }
}
```

---

### 2.2 플랫폼 통계
**GET** `/analytics/platform-stats`

플랫폼 전체의 상세 통계를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (YYYY-MM-DD)
- `endDate`: 종료일 (YYYY-MM-DD)

#### Response
```json
{
  "success": true,
  "data": {
    "users": {
      "total": 5000,
      "active": 3500,
      "new": 250,
      "churnRate": 2.5
    },
    "shops": {
      "total": 200,
      "active": 180,
      "pending": 15,
      "verified": 185
    },
    "reservations": {
      "total": 1250,
      "completed": 1100,
      "cancelled": 80,
      "noShow": 25,
      "averageValue": 50000
    },
    "revenue": {
      "total": 62500000,
      "commissions": 9375000,
      "refunds": 1250000,
      "net": 61250000
    }
  }
}
```

---

### 2.3 실시간 활동
**GET** `/analytics/real-time-activity`

실시간 플랫폼 활동을 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "activeNow": 45,
    "recentReservations": [
      {
        "id": "reservation-uuid",
        "customerName": "김미영",
        "shopName": "Beauty Salon",
        "amount": 50000,
        "timestamp": "2024-01-01T11:00:00Z"
      }
    ],
    "recentSignups": [
      {
        "id": "user-uuid",
        "name": "박지수",
        "email": "user@example.com",
        "timestamp": "2024-01-01T10:55:00Z"
      }
    ],
    "systemHealth": {
      "status": "healthy",
      "apiResponseTime": 125,
      "databaseResponseTime": 45,
      "cacheHitRate": 92.5
    }
  }
}
```

---

## 3. 사용자 관리

### 3.1 사용자 목록 조회
**GET** `/users`

고급 검색 및 필터링으로 사용자 목록을 조회합니다.

#### Query Parameters
| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| search | string | 이름, 이메일, 전화번호 검색 | "김미영" |
| role | string | 역할 필터 (user, shop_owner, admin, influencer) | "user" |
| status | string | 상태 필터 (active, inactive, suspended, deleted) | "active" |
| gender | string | 성별 필터 (male, female, other) | "female" |
| isInfluencer | boolean | 인플루언서 여부 | true |
| phoneVerified | boolean | 전화 인증 여부 | true |
| startDate | string | 가입 시작일 (ISO date) | "2024-01-01" |
| endDate | string | 가입 종료일 (ISO date) | "2024-01-31" |
| minPoints | number | 최소 포인트 | 1000 |
| maxPoints | number | 최대 포인트 | 10000 |
| sortBy | string | 정렬 기준 (created_at, name, email, last_login_at, total_points) | "created_at" |
| sortOrder | string | 정렬 순서 (asc, desc) | "desc" |
| page | number | 페이지 번호 (기본값: 1) | 1 |
| limit | number | 페이지 크기 (기본값: 20, 최대: 100) | 20 |

#### Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "email": "user@example.com",
        "phoneNumber": "+82-10-1234-5678",
        "phoneVerified": true,
        "name": "김미영",
        "nickname": "미영",
        "gender": "female",
        "birthDate": "1990-01-01",
        "userRole": "user",
        "userStatus": "active",
        "isInfluencer": false,
        "totalPoints": 1500,
        "availablePoints": 1200,
        "totalReferrals": 5,
        "successfulReferrals": 3,
        "lastLoginAt": "2024-01-01T10:00:00Z",
        "createdAt": "2024-01-01T00:00:00Z"
      }
    ],
    "totalCount": 150,
    "hasMore": true,
    "currentPage": 1,
    "totalPages": 8
  }
}
```

---

### 3.2 사용자 상세 정보
**GET** `/users/:id`

특정 사용자의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "user-uuid",
    "email": "user@example.com",
    "phoneNumber": "+82-10-1234-5678",
    "phoneVerified": true,
    "name": "김미영",
    "nickname": "미영",
    "gender": "female",
    "birthDate": "1990-01-01",
    "userRole": "user",
    "userStatus": "active",
    "isInfluencer": false,
    "totalPoints": 1500,
    "availablePoints": 1200,
    "totalReferrals": 5,
    "successfulReferrals": 3,
    "lastLoginAt": "2024-01-01T10:00:00Z",
    "createdAt": "2024-01-01T00:00:00Z",
    "statistics": {
      "totalReservations": 25,
      "completedReservations": 20,
      "totalPointsEarned": 2000,
      "totalPointsUsed": 500,
      "completionRate": 80.0
    }
  }
}
```

---

### 3.3 사용자 상태 변경
**PUT** `/users/:id/status`

사용자의 상태를 변경합니다 (활성화, 정지, 삭제 등).

#### Request Body
```json
{
  "status": "suspended",
  "reason": "약관 위반",
  "adminNotes": "다수의 신고 접수",
  "notifyUser": true
}
```

#### Available Statuses
- `active`: 활성
- `inactive`: 비활성
- `suspended`: 정지
- `deleted`: 삭제

#### Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "previousStatus": "active",
      "newStatus": "suspended",
      "updatedAt": "2024-01-01T10:00:00Z"
    },
    "action": {
      "type": "status_update",
      "reason": "약관 위반",
      "performedBy": "admin-uuid",
      "performedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 3.4 사용자 역할 변경
**PUT** `/users/:id/role`

사용자의 역할을 변경합니다.

#### Request Body
```json
{
  "role": "shop_owner",
  "reason": "샵 오너 권한 요청",
  "adminNotes": "사업자 등록증 확인 완료"
}
```

#### Available Roles
- `user`: 일반 사용자
- `shop_owner`: 샵 오너
- `admin`: 관리자
- `influencer`: 인플루언서

#### Response
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "user-uuid",
      "previousRole": "user",
      "newRole": "shop_owner",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 3.5 사용자 통계
**GET** `/users/statistics`

전체 사용자 통계를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "totalUsers": 5000,
    "activeUsers": 3500,
    "suspendedUsers": 50,
    "deletedUsers": 10,
    "newUsersThisMonth": 250,
    "newUsersThisWeek": 60,
    "usersByRole": {
      "user": 4500,
      "shop_owner": 400,
      "admin": 20,
      "influencer": 80
    },
    "usersByStatus": {
      "active": 4400,
      "inactive": 500,
      "suspended": 50,
      "deleted": 50
    }
  }
}
```

---

### 3.6 사용자 활동 로그
**GET** `/users/activity`

사용자 활동 로그를 조회합니다.

#### Query Parameters
- `userId`: 특정 사용자 ID 필터
- `activityTypes`: 활동 타입 (login,logout,status_change,role_change,admin_action)
- `severity`: 심각도 (low,medium,high,critical)
- `startDate`: 시작일 (ISO date)
- `endDate`: 종료일 (ISO date)
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 50, 최대: 100)

#### Response
```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-uuid",
        "userId": "user-uuid",
        "userName": "김미영",
        "activityType": "status_change",
        "description": "관리자가 사용자 상태를 변경했습니다",
        "metadata": {
          "previousStatus": "active",
          "newStatus": "suspended",
          "adminId": "admin-uuid"
        },
        "severity": "high",
        "timestamp": "2024-01-01T10:00:00Z"
      }
    ],
    "totalCount": 150,
    "currentPage": 1,
    "totalPages": 3
  }
}
```

---

### 3.7 일괄 작업
**POST** `/users/bulk-action`

여러 사용자에 대해 일괄 작업을 수행합니다.

#### Request Body
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2", "user-uuid-3"],
  "action": "suspend",
  "reason": "정책 위반으로 일괄 정지",
  "adminNotes": "자동 일괄 작업",
  "useTransaction": true,
  "batchSize": 50
}
```

#### Available Actions
- `activate`: 활성화
- `suspend`: 정지
- `delete`: 삭제
- `change_role`: 역할 변경 (targetRole 필요)

#### Response
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "userId": "user-uuid-1",
        "success": true,
        "previousValue": "active",
        "newValue": "suspended"
      },
      {
        "userId": "user-uuid-2",
        "success": false,
        "error": "User not found"
      }
    ],
    "summary": {
      "total": 3,
      "successful": 2,
      "failed": 1
    }
  }
}
```

---

### 3.8 고급 사용자 검색
**GET** `/users/search/advanced`

세그먼트 및 분석 기능이 포함된 고급 사용자 검색입니다.

#### Query Parameters
- `segments`: 사용자 세그먼트 (power_users, inactive_users, high_referral_users, new_users, churned_users)
- `activityLevel`: 활동 수준 (high, medium, low, inactive)
- `referralMin`: 최소 추천 수
- `lifetimeValueMin`: 최소 생애 가치

#### Response
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "user-uuid",
        "name": "김미영",
        "activityScore": 85,
        "segmentTags": ["power_user", "high_referral"]
      }
    ],
    "totalCount": 150
  }
}
```

---

### 3.9 사용자 분석
**GET** `/users/analytics`

포괄적인 사용자 분석 데이터를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (ISO string)
- `endDate`: 종료일 (ISO string)
- `includeGrowthTrends`: 성장 추세 포함 (기본값: true)
- `includeActivityPatterns`: 활동 패턴 포함 (기본값: true)
- `includeBehavioralInsights`: 행동 인사이트 포함 (기본값: true)

#### Response
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalUsers": 5000,
      "activeUsers": 3500,
      "newUsersToday": 25,
      "newUsersThisWeek": 180,
      "newUsersThisMonth": 750,
      "churnRate": 2.5,
      "userGrowthRate": 15.2
    },
    "userSegments": {
      "powerUsers": 250,
      "inactiveUsers": 800,
      "highReferralUsers": 150,
      "newUsers": 180,
      "churnedUsers": 120
    },
    "realTimeMetrics": {
      "activeNow": 45,
      "sessionsToday": 1200,
      "averageSessionDuration": 25
    }
  }
}
```

---

### 3.10 감사 로그 검색
**GET** `/audit/search`

관리자 작업에 대한 감사 로그를 검색합니다.

#### Query Parameters
- `userId`: 사용자 ID
- `adminId`: 관리자 ID
- `actionTypes`: 작업 타입 (쉼표로 구분)
- `categories`: 카테고리 (user_management, shop_management 등)
- `severity`: 심각도 (low, medium, high, critical)
- `startDate`: 시작일
- `endDate`: 종료일
- `searchTerm`: 텍스트 검색
- `page`: 페이지 번호
- `limit`: 페이지 크기

#### Response
```json
{
  "success": true,
  "data": {
    "auditLogs": [
      {
        "id": "audit-uuid",
        "adminId": "admin-uuid",
        "adminName": "관리자 이름",
        "actionType": "user_status_update",
        "targetType": "user",
        "targetId": "user-uuid",
        "reason": "정책 위반",
        "metadata": {},
        "ipAddress": "192.168.1.1",
        "timestamp": "2024-01-01T10:00:00Z",
        "severity": "high"
      }
    ],
    "totalCount": 150,
    "aggregations": {
      "actionTypeCounts": {},
      "adminCounts": {},
      "categoryCounts": {}
    }
  }
}
```

---

### 3.11 감사 로그 내보내기
**POST** `/audit/export`

감사 로그를 CSV, JSON 형식으로 내보냅니다.

#### Request Body
```json
{
  "format": "csv",
  "includeMetadata": true,
  "userId": "user-uuid",
  "startDate": "2024-01-01T00:00:00Z",
  "endDate": "2024-01-31T23:59:59Z",
  "limit": 1000
}
```

#### Supported Formats
- `csv`: CSV 파일
- `json`: JSON 형식
- `pdf`: PDF 보고서 (준비 중)

---

## 4. 샵 관리

### 4.1 전체 샵 목록 조회
**GET** `/api/admin/shops`

관리자가 전체 샵 목록을 조회합니다. 다양한 필터링 및 정렬 옵션을 제공합니다.

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | 페이지 번호 (기본값: 1) |
| limit | number | No | 페이지당 항목 수 (기본값: 20, 최대: 100) |
| status | string | No | 샵 상태 필터 (active, inactive, suspended, deleted) |
| category | string | No | 서비스 카테고리 필터 (nail, eyelash, waxing, eyebrow_tattoo) |
| shopType | string | No | 샵 타입 필터 (partnered, non_partnered) |
| verificationStatus | string | No | 인증 상태 필터 (pending, verified, rejected) |
| sortBy | string | No | 정렬 기준 (created_at, name, main_category, shop_status, verification_status) - 기본값: created_at |
| sortOrder | string | No | 정렬 순서 (asc, desc) - 기본값: desc |

#### Available Filter Values
**status**:
- `active`: 활성
- `inactive`: 비활성
- `suspended`: 정지
- `deleted`: 삭제됨

**shopType**:
- `partnered`: 파트너샵
- `non_partnered`: 비파트너샵

**verificationStatus**:
- `pending`: 대기중
- `verified`: 인증완료
- `rejected`: 거부됨

#### Response
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "Beauty Salon Seoul",
        "description": "프리미엄 네일 & 속눈썹 살롱",
        "address": "서울시 강남구 테헤란로 123",
        "detailedAddress": "456호",
        "phoneNumber": "+82-10-1234-5678",
        "email": "salon@example.com",
        "mainCategory": "nail",
        "subCategories": ["eyelash", "waxing"],
        "shopType": "partnered",
        "shopStatus": "active",
        "verificationStatus": "verified",
        "commissionRate": 15.0,
        "isFeatured": true,
        "createdAt": "2024-01-01T00:00:00Z",
        "updatedAt": "2024-01-15T12:00:00Z",
        "owner": {
          "id": "owner-uuid",
          "name": "김지수",
          "email": "owner@example.com",
          "phoneNumber": "+82-10-9876-5432"
        }
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8
    }
  },
  "message": "샵 목록을 성공적으로 조회했습니다."
}
```

#### Error Responses
```json
{
  "success": false,
  "error": {
    "code": "FETCH_SHOPS_FAILED",
    "message": "샵 목록을 가져오는데 실패했습니다.",
    "details": "잠시 후 다시 시도해주세요."
  }
}
```

#### 사용 예시
```bash
# 기본 조회
GET /api/admin/shops?page=1&limit=20

# 파트너샵만 조회
GET /api/admin/shops?shopType=partnered

# 인증 대기 중인 샵 조회
GET /api/admin/shops?verificationStatus=pending

# 네일 카테고리 + 활성 상태 조회
GET /api/admin/shops?category=nail&status=active

# 이름 오름차순 정렬
GET /api/admin/shops?sortBy=name&sortOrder=asc

# 복합 필터 + 정렬
GET /api/admin/shops?shopType=partnered&verificationStatus=verified&sortBy=created_at&sortOrder=desc&page=1&limit=50
```

---

### 4.2 샵 생성
**POST** `/api/admin/shops`

관리자가 새로운 샵을 직접 생성합니다. 일반 사용자와 달리 관리자는 샵 상태, 검증 상태, 샵 타입 등을 직접 지정할 수 있습니다.

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "뷰티 살롱 강남",
  "description": "프리미엄 네일 & 속눈썹 전문 살롱입니다.",
  "address": "서울시 강남구 테헤란로 123",
  "detailedAddress": "456호",
  "postalCode": "06234",
  "phoneNumber": "+82-10-1234-5678",
  "email": "salon@example.com",
  "mainCategory": "nail",
  "subCategories": ["eyelash", "waxing"],
  "operatingHours": {
    "monday": { "open": "09:00", "close": "20:00" },
    "tuesday": { "open": "09:00", "close": "20:00" },
    "wednesday": { "open": "09:00", "close": "20:00" },
    "thursday": { "open": "09:00", "close": "20:00" },
    "friday": { "open": "09:00", "close": "20:00" },
    "saturday": { "open": "10:00", "close": "18:00" },
    "sunday": { "closed": true }
  },
  "paymentMethods": ["card", "cash", "transfer"],
  "kakaoChannelUrl": "https://pf.kakao.com/example",
  "businessLicenseNumber": "123-45-67890",
  "businessLicenseImageUrl": "https://storage.example.com/licenses/123.jpg",
  "latitude": 37.5012345,
  "longitude": 127.0345678,
  "ownerId": "owner-uuid-optional",
  "shopStatus": "active",
  "verificationStatus": "verified",
  "shopType": "partnered",
  "commissionRate": 15.0,
  "isFeatured": true
}
```

#### 필드 설명
**기본 정보** (필수):
- `name`: 샵명 (1-255자)
- `address`: 주소
- `mainCategory`: 주 서비스 카테고리 (nail, eyelash, waxing, eyebrow_tattoo)

**선택 정보**:
- `description`: 샵 설명
- `detailedAddress`: 상세 주소
- `postalCode`: 우편번호
- `phoneNumber`: 전화번호
- `email`: 이메일
- `subCategories`: 추가 서비스 카테고리 배열
- `operatingHours`: 영업시간 객체
- `paymentMethods`: 결제 수단 배열
- `kakaoChannelUrl`: 카카오톡 채널 URL
- `businessLicenseNumber`: 사업자 등록번호
- `businessLicenseImageUrl`: 사업자 등록증 이미지 URL
- `latitude`, `longitude`: 위도/경도 좌표

**관리자 전용 필드** (선택):
- `ownerId`: 샵 소유자 ID (미지정 시 관리자 본인)
- `shopStatus`: 샵 상태 (active, inactive, pending_approval, suspended, deleted) - 기본값: active
- `verificationStatus`: 검증 상태 (pending, verified, rejected) - 기본값: verified
- `shopType`: 샵 타입 (partnered, non_partnered) - 기본값: partnered
- `commissionRate`: 수수료율 (0-100) - 기본값: 0
- `isFeatured`: 추천 샵 여부 - 기본값: false

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "뷰티 살롱 강남",
    "description": "프리미엄 네일 & 속눈썹 전문 살롱입니다.",
    "address": "서울시 강남구 테헤란로 123",
    "detailedAddress": "456호",
    "postalCode": "06234",
    "phoneNumber": "+82-10-1234-5678",
    "email": "salon@example.com",
    "mainCategory": "nail",
    "subCategories": ["eyelash", "waxing"],
    "operatingHours": { /* ... */ },
    "paymentMethods": ["card", "cash", "transfer"],
    "kakaoChannelUrl": "https://pf.kakao.com/example",
    "businessLicenseNumber": "123-45-67890",
    "businessLicenseImageUrl": "https://storage.example.com/licenses/123.jpg",
    "location": "POINT(127.0345678 37.5012345)",
    "ownerId": "owner-uuid",
    "shopStatus": "active",
    "verificationStatus": "verified",
    "shopType": "partnered",
    "commissionRate": 15.0,
    "isFeatured": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T10:30:00Z"
  },
  "message": "샵이 성공적으로 생성되었습니다."
}
```

#### Error Responses
```json
// 필수 필드 누락
{
  "success": false,
  "error": {
    "code": "MISSING_REQUIRED_FIELDS",
    "message": "필수 필드가 누락되었습니다.",
    "details": "샵명, 주소, 주 서비스 카테고리는 필수입니다."
  }
}

// 샵 생성 실패
{
  "success": false,
  "error": {
    "code": "SHOP_CREATION_FAILED",
    "message": "샵 생성에 실패했습니다.",
    "details": "데이터베이스 오류"
  }
}
```

#### 사용 예시
```bash
# 기본 샵 생성 (관리자가 소유자)
curl -X POST https://api.example.com/api/admin/shops \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "뷰티 살롱 강남",
    "address": "서울시 강남구 테헤란로 123",
    "mainCategory": "nail"
  }'

# 특정 사용자를 소유자로 지정하여 샵 생성
curl -X POST https://api.example.com/api/admin/shops \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "뷰티 살롱 강남",
    "address": "서울시 강남구 테헤란로 123",
    "mainCategory": "nail",
    "ownerId": "user-uuid-123",
    "shopStatus": "active",
    "verificationStatus": "verified",
    "shopType": "partnered",
    "commissionRate": 15.0
  }'
```

#### Rate Limiting
- **제한**: 20 requests / 15분 (sensitiveRateLimit)
- 제한 초과 시 429 Too Many Requests 응답

---

### 4.3 샵 수정
**PUT** `/api/admin/shops/:shopId`

관리자가 기존 샵 정보를 수정합니다. 일반 사용자와 달리 관리자는 샵 상태, 검증 상태, 샵 타입 등의 관리 필드도 수정할 수 있습니다.

#### Path Parameters
- `shopId`: 수정할 샵의 UUID

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

#### Request Body
모든 필드는 선택사항입니다. 제공된 필드만 업데이트됩니다.

```json
{
  "name": "뷰티 살롱 강남 (수정됨)",
  "description": "업데이트된 설명",
  "address": "서울시 강남구 테헤란로 456",
  "detailedAddress": "789호",
  "phoneNumber": "+82-10-9999-8888",
  "email": "updated@example.com",
  "mainCategory": "eyelash",
  "subCategories": ["nail", "eyebrow_tattoo"],
  "operatingHours": { /* ... */ },
  "paymentMethods": ["card", "transfer"],
  "shopStatus": "inactive",
  "verificationStatus": "verified",
  "shopType": "non_partnered",
  "commissionRate": 20.0,
  "isFeatured": false,
  "latitude": 37.5098765,
  "longitude": 127.0456789
}
```

#### 수정 가능한 관리자 전용 필드
- `shopStatus`: active, inactive, pending_approval, suspended, deleted
- `verificationStatus`: pending, verified, rejected
- `shopType`: partnered, non_partnered
- `commissionRate`: 0-100 범위의 수수료율
- `isFeatured`: 추천 샵 지정 여부
- `ownerId`: 샵 소유자 변경 (주의: 소유권 이전)

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "뷰티 살롱 강남 (수정됨)",
    "description": "업데이트된 설명",
    "address": "서울시 강남구 테헤란로 456",
    "detailedAddress": "789호",
    "phoneNumber": "+82-10-9999-8888",
    "email": "updated@example.com",
    "mainCategory": "eyelash",
    "subCategories": ["nail", "eyebrow_tattoo"],
    "operatingHours": { /* ... */ },
    "paymentMethods": ["card", "transfer"],
    "shopStatus": "inactive",
    "verificationStatus": "verified",
    "shopType": "non_partnered",
    "commissionRate": 20.0,
    "isFeatured": false,
    "location": "POINT(127.0456789 37.5098765)",
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-16T14:20:00Z"
  },
  "message": "샵 정보가 성공적으로 업데이트되었습니다."
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "해당 샵을 찾을 수 없습니다.",
    "details": "샵이 존재하지 않습니다."
  }
}

// 업데이트 실패
{
  "success": false,
  "error": {
    "code": "SHOP_UPDATE_FAILED",
    "message": "샵 정보 업데이트에 실패했습니다.",
    "details": "데이터베이스 오류"
  }
}
```

#### 사용 예시
```bash
# 기본 정보만 수정
curl -X PUT https://api.example.com/api/admin/shops/shop-uuid-123 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "뷰티 살롱 강남 (수정됨)",
    "phoneNumber": "+82-10-9999-8888"
  }'

# 샵 상태 및 검증 상태 변경
curl -X PUT https://api.example.com/api/admin/shops/shop-uuid-123 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shopStatus": "suspended",
    "verificationStatus": "rejected"
  }'

# 수수료율 및 추천 샵 설정
curl -X PUT https://api.example.com/api/admin/shops/shop-uuid-123 \
  -H "Authorization: Bearer <admin-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "commissionRate": 25.0,
    "isFeatured": true,
    "shopType": "partnered"
  }'
```

#### Rate Limiting
- **제한**: 20 requests / 15분 (sensitiveRateLimit)
- 제한 초과 시 429 Too Many Requests 응답

---

### 4.4 샵 삭제
**DELETE** `/api/admin/shops/:shopId`

관리자가 샵을 삭제합니다. 기본적으로 소프트 삭제(상태를 'deleted'로 변경)를 수행하며, `permanent=true` 쿼리 파라미터를 사용하면 완전 삭제를 수행합니다.

#### Path Parameters
- `shopId`: 삭제할 샵의 UUID

#### Query Parameters
- `permanent`: (선택) `true`로 설정 시 데이터베이스에서 완전히 삭제. 기본값: `false` (소프트 삭제)

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
```

#### Response (200 OK)

**소프트 삭제 성공**:
```json
{
  "success": true,
  "message": "샵이 성공적으로 삭제되었습니다."
}
```

**영구 삭제 성공**:
```json
{
  "success": true,
  "message": "샵이 영구적으로 삭제되었습니다."
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "해당 샵을 찾을 수 없습니다.",
    "details": "샵이 존재하지 않거나 이미 삭제되었습니다."
  }
}

// 삭제 실패
{
  "success": false,
  "error": {
    "code": "SHOP_DELETION_FAILED",
    "message": "샵 삭제에 실패했습니다.",
    "details": "데이터베이스 오류"
  }
}
```

#### 사용 예시
```bash
# 소프트 삭제 (기본값 - 상태만 'deleted'로 변경)
curl -X DELETE https://api.example.com/api/admin/shops/shop-uuid-123 \
  -H "Authorization: Bearer <admin-token>"

# 영구 삭제 (데이터베이스에서 완전히 제거)
curl -X DELETE "https://api.example.com/api/admin/shops/shop-uuid-123?permanent=true" \
  -H "Authorization: Bearer <admin-token>"
```

#### 삭제 방식 비교

| 방식 | 쿼리 파라미터 | 동작 | 복구 가능 | 사용 시나리오 |
|------|--------------|------|-----------|--------------|
| 소프트 삭제 | `permanent=false` (기본) | shop_status를 'deleted'로 변경 | ✅ 가능 | 일반적인 샵 삭제, 임시 비활성화 |
| 영구 삭제 | `permanent=true` | 데이터베이스에서 완전 제거 | ❌ 불가능 | 스팸, 불법 콘텐츠, GDPR 요청 등 |

#### 주의사항
⚠️ **영구 삭제는 복구할 수 없습니다.** 다음 사항을 확인하세요:
- 연관된 예약, 리뷰, 결제 정보가 적절히 처리되었는지 확인
- 법적 보관 의무 기간이 지났는지 확인
- 데이터 백업이 필요한 경우 삭제 전 백업 수행

#### Rate Limiting
- **제한**: 20 requests / 15분 (sensitiveRateLimit)
- 제한 초과 시 429 Too Many Requests 응답

---

### 4.5 샵 승인 대기 목록
**GET** `/shops/approval`

승인 대기 중인 샵 목록을 조회합니다.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | 샵 상태 (active, inactive, pending_approval, suspended) |
| verificationStatus | string | 검증 상태 (pending, verified, rejected) |
| category | string | 서비스 카테고리 (nail, eyelash, waxing, eyebrow_tattoo) |
| search | string | 이름, 설명, 주소 검색 |
| hasBusinessLicense | boolean | 사업자 등록증 보유 여부 |
| sortBy | string | 정렬 기준 (created_at, name, verification_status) |
| page | number | 페이지 번호 |
| limit | number | 페이지 크기 |

#### Response
```json
{
  "success": true,
  "data": {
    "shops": [
      {
        "id": "shop-uuid",
        "name": "Beauty Salon Seoul",
        "phoneNumber": "+82-10-1234-5678",
        "email": "salon@example.com",
        "address": "서울시 강남구 123",
        "shopStatus": "pending_approval",
        "verificationStatus": "pending",
        "businessLicenseNumber": "1234567890",
        "businessLicenseImageUrl": "https://example.com/license.jpg",
        "mainCategory": "nail",
        "subCategories": ["eyelash", "waxing"],
        "totalBookings": 0,
        "commissionRate": 15.0,
        "createdAt": "2024-01-01T00:00:00Z",
        "owner": {
          "id": "owner-uuid",
          "name": "오너 이름",
          "email": "owner@example.com"
        },
        "daysSinceSubmission": 5,
        "hasCompleteDocuments": true
      }
    ],
    "totalCount": 25,
    "currentPage": 1,
    "totalPages": 2
  }
}
```

---

### 4.6 샵 승인/거부
**PUT** `/shops/:id/approval`

샵을 승인하거나 거부합니다.

#### Request Body
```json
{
  "action": "approve",
  "reason": "모든 서류 검증 완료",
  "adminNotes": "사업자 등록증 정부 데이터베이스로 확인",
  "verificationNotes": "전화번호 및 이메일 확인",
  "notifyOwner": true,
  "autoActivate": true
}
```

#### Available Actions
- `approve`: 승인
- `reject`: 거부

#### Response
```json
{
  "success": true,
  "data": {
    "shop": {
      "id": "shop-uuid",
      "previousStatus": "pending_approval",
      "newStatus": "active",
      "previousVerificationStatus": "pending",
      "newVerificationStatus": "verified",
      "updatedAt": "2024-01-01T10:00:00Z"
    },
    "action": {
      "type": "approval",
      "reason": "모든 서류 검증 완료",
      "performedBy": "admin-uuid",
      "performedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 4.7 샵 승인 상세 정보
**GET** `/shops/:id/approval/details`

샵의 승인 관련 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "shop-uuid",
    "name": "Beauty Salon",
    "businessLicenseNumber": "1234567890",
    "businessLicenseImageUrl": "https://example.com/license.jpg",
    "verificationStatus": "pending",
    "services": [
      {
        "id": "service-uuid",
        "name": "매니큐어",
        "category": "nail",
        "priceMin": 15000,
        "priceMax": 25000
      }
    ],
    "images": [
      {
        "imageUrl": "https://example.com/shop1.jpg",
        "isPrimary": true
      }
    ],
    "verificationHistory": [
      {
        "action": "approve",
        "reason": "요구사항 충족",
        "adminName": "Admin User",
        "reviewedAt": "2024-01-01T10:00:00Z"
      }
    ],
    "approvalAnalysis": {
      "documentCompleteness": 85.7,
      "completedDocuments": ["business_license_number", "name", "address"],
      "missingDocuments": ["business_license_image_url"],
      "daysSinceSubmission": 5,
      "recommendation": "사업자 등록증 이미지 요청"
    }
  }
}
```

---

### 4.8 샵 검증 통계
**GET** `/shops/approval/statistics`

샵 검증 통계를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "totalShops": 500,
    "pendingShops": 25,
    "approvedShops": 400,
    "rejectedShops": 50,
    "verifiedShops": 375,
    "newShopsThisMonth": 45,
    "shopsByCategory": {
      "nail": 200,
      "eyelash": 150,
      "waxing": 100,
      "eyebrow_tattoo": 30
    },
    "averageApprovalTime": 3.5
  }
}
```

---

### 4.9 샵 일괄 승인
**POST** `/shops/bulk-approval`

여러 샵을 일괄로 승인/거부합니다.

#### Request Body
```json
{
  "shopIds": ["shop-uuid-1", "shop-uuid-2"],
  "action": "approve",
  "reason": "완료된 서류를 위한 일괄 승인",
  "adminNotes": "모든 샵이 필수 서류 제출 완료",
  "autoActivate": true
}
```

---

### 4.10 샵 검증 요구사항 확인
**GET** `/shops/:shopId/verification-requirements`

샵이 검증 요구사항을 충족하는지 확인합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "meetsRequirements": false,
    "missingRequirements": [
      "business_license_image_url",
      "phone_verification"
    ],
    "recommendations": [
      "사업자 등록증 이미지 업로드 필요",
      "전화번호 인증 필요"
    ]
  }
}
```

---

### 4.11 샵 검증 이력
**GET** `/shops/:shopId/verification-history`

샵의 검증 이력을 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20, 최대: 100)

---

### 4.12 대기 중인 샵 목록
**GET** `/shops/pending`

검증 대기 중인 샵 목록을 조회합니다.

#### Query Parameters
- `page`: 페이지 번호
- `limit`: 페이지 크기
- `search`: 샵명, 설명, 주소 검색
- `category`: 카테고리 필터
- `sortBy`: 정렬 기준
- `sortOrder`: 정렬 순서

---

### 4.13 샵 승인 처리
**PUT** `/shops/:shopId/approve`

샵을 승인하거나 거부합니다 (간소화된 버전).

#### Request Body
```json
{
  "approved": true,
  "shopType": "partnered",
  "commissionRate": 10.0,
  "notes": "승인 완료"
}
```

---

### 4.14 샵 서비스 관리

관리자가 모든 샵의 서비스를 관리할 수 있는 CRUD API입니다.

#### 4.14.1 특정 샵의 서비스 목록 조회
**GET** `/api/admin/shops/:shopId/services`

특정 샵의 모든 서비스를 조회합니다. 카테고리별 필터링, 정렬, 페이지네이션을 지원합니다.

#### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | Yes | 조회할 샵의 ID |

#### Query Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| page | number | No | 페이지 번호 (기본값: 1) |
| limit | number | No | 페이지당 항목 수 (기본값: 20, 최대: 100) |
| category | string | No | 서비스 카테고리 필터 (nail, eyelash, waxing, eyebrow_tattoo, hair) |
| isActive | boolean | No | 활성화 상태 필터 (true/false) |
| isAvailable | boolean | No | 예약 가능 여부 필터 (true/false) |
| sortBy | string | No | 정렬 기준 (created_at, name, price_min, duration_minutes) - 기본값: created_at |
| sortOrder | string | No | 정렬 순서 (asc, desc) - 기본값: desc |

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "service-uuid",
        "shopId": "shop-uuid",
        "name": "젤 네일 아트",
        "description": "고급 젤 네일 아트 서비스",
        "category": "nail",
        "priceMin": 30000,
        "priceMax": 50000,
        "durationMinutes": 60,
        "depositAmount": null,
        "depositPercentage": 30.00,
        "isActive": true,
        "isAvailable": true,
        "maxAdvanceBookingDays": 30,
        "minAdvanceBookingHours": 24,
        "cancellationPolicy": "24시간 전까지 무료 취소",
        "createdAt": "2024-01-15T10:00:00Z",
        "updatedAt": "2024-01-15T10:00:00Z"
      }
    ],
    "pagination": {
      "total": 15,
      "page": 1,
      "limit": 20,
      "totalPages": 1
    },
    "shopInfo": {
      "id": "shop-uuid",
      "name": "Beauty Salon Seoul"
    }
  }
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "존재하지 않는 샵 ID입니다."
  }
}

// 잘못된 카테고리
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "유효하지 않은 카테고리입니다.",
    "details": "nail, eyelash, waxing, eyebrow_tattoo, hair 중 하나를 선택하세요."
  }
}
```

#### Rate Limiting
- 200 requests per 15 minutes

#### cURL Example
```bash
curl -X GET "http://localhost:3001/api/admin/shops/550e8400-e29b-41d4-a716-446655440000/services?category=nail&page=1&limit=20" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

---

#### 4.14.2 샵 서비스 생성
**POST** `/api/admin/shops/:shopId/services`

특정 샵에 새로운 서비스를 생성합니다.

#### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | Yes | 서비스를 추가할 샵의 ID |

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "젤 네일 아트",
  "description": "고급 젤 네일 아트 서비스입니다. 다양한 디자인 가능합니다.",
  "category": "nail",
  "priceMin": 30000,
  "priceMax": 50000,
  "durationMinutes": 60,
  "depositPercentage": 30.00,
  "isActive": true,
  "isAvailable": true,
  "maxAdvanceBookingDays": 30,
  "minAdvanceBookingHours": 24,
  "cancellationPolicy": "24시간 전까지 무료 취소, 이후 예약금 환불 불가"
}
```

#### 필드 설명
**필수 필드**:
- `name` (string, 1-255자): 서비스명
- `category` (string): 서비스 카테고리
  - 가능한 값: `nail`, `eyelash`, `waxing`, `eyebrow_tattoo`, `hair`

**선택 필드**:
- `description` (string): 서비스 설명
- `priceMin` (number, 0-10,000,000): 최소 가격 (원)
- `priceMax` (number, 0-10,000,000): 최대 가격 (원)
  - 주의: `priceMin`은 `priceMax`보다 작거나 같아야 함
- `durationMinutes` (number, 1-480): 소요 시간 (분)
- `depositAmount` (number, 0-1,000,000): 고정 예약금 (원)
- `depositPercentage` (number, 0-100): 비율 예약금 (%)
  - 주의: `depositAmount`와 `depositPercentage` 중 하나만 설정 가능
- `isActive` (boolean): 활성화 여부 (기본값: true)
- `isAvailable` (boolean): 예약 가능 여부 (기본값: true)
- `maxAdvanceBookingDays` (number, 0-365): 최대 사전 예약 가능 일수
- `minAdvanceBookingHours` (number, 0-720): 최소 사전 예약 필요 시간
- `cancellationPolicy` (string): 취소 정책 설명

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "service-uuid",
    "shopId": "shop-uuid",
    "name": "젤 네일 아트",
    "description": "고급 젤 네일 아트 서비스입니다. 다양한 디자인 가능합니다.",
    "category": "nail",
    "priceMin": 30000,
    "priceMax": 50000,
    "durationMinutes": 60,
    "depositAmount": null,
    "depositPercentage": 30.00,
    "isActive": true,
    "isAvailable": true,
    "maxAdvanceBookingDays": 30,
    "minAdvanceBookingHours": 24,
    "cancellationPolicy": "24시간 전까지 무료 취소, 이후 예약금 환불 불가",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z"
  },
  "message": "서비스가 성공적으로 생성되었습니다."
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "존재하지 않는 샵 ID입니다."
  }
}

// 필수 필드 누락
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "필수 필드가 누락되었습니다.",
    "details": [
      {
        "field": "name",
        "message": "서비스명은 필수입니다."
      },
      {
        "field": "category",
        "message": "서비스 카테고리는 필수입니다."
      }
    ]
  }
}

// 잘못된 가격 범위
{
  "success": false,
  "error": {
    "code": "INVALID_PRICE_RANGE",
    "message": "가격 범위가 올바르지 않습니다.",
    "details": "최소 가격은 최대 가격보다 작거나 같아야 합니다."
  }
}

// 예약금 설정 중복
{
  "success": false,
  "error": {
    "code": "INVALID_DEPOSIT_SETTINGS",
    "message": "예약금 설정이 올바르지 않습니다.",
    "details": "고정 금액과 비율 중 하나만 설정할 수 있습니다."
  }
}
```

#### Rate Limiting
- 50 requests per 5 minutes

#### cURL Example
```bash
curl -X POST "http://localhost:3001/api/admin/shops/550e8400-e29b-41d4-a716-446655440000/services" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "젤 네일 아트",
    "category": "nail",
    "priceMin": 30000,
    "priceMax": 50000,
    "durationMinutes": 60,
    "depositPercentage": 30.00
  }'
```

---

#### 4.14.3 샵 서비스 상세 조회
**GET** `/api/admin/shops/:shopId/services/:serviceId`

특정 샵의 특정 서비스 상세 정보를 조회합니다.

#### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | Yes | 샵 ID |
| serviceId | UUID | Yes | 서비스 ID |

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "service-uuid",
    "shopId": "shop-uuid",
    "name": "젤 네일 아트",
    "description": "고급 젤 네일 아트 서비스입니다. 다양한 디자인 가능합니다.",
    "category": "nail",
    "priceMin": 30000,
    "priceMax": 50000,
    "durationMinutes": 60,
    "depositAmount": null,
    "depositPercentage": 30.00,
    "isActive": true,
    "isAvailable": true,
    "maxAdvanceBookingDays": 30,
    "minAdvanceBookingHours": 24,
    "cancellationPolicy": "24시간 전까지 무료 취소, 이후 예약금 환불 불가",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T10:00:00Z",
    "shop": {
      "id": "shop-uuid",
      "name": "Beauty Salon Seoul",
      "mainCategory": "nail"
    }
  }
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "존재하지 않는 샵 ID입니다."
  }
}

// 서비스를 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "서비스를 찾을 수 없습니다.",
    "details": "존재하지 않는 서비스 ID입니다."
  }
}

// 샵-서비스 불일치
{
  "success": false,
  "error": {
    "code": "SERVICE_SHOP_MISMATCH",
    "message": "서비스가 해당 샵에 속하지 않습니다.",
    "details": "지정된 샵의 서비스가 아닙니다."
  }
}
```

#### Rate Limiting
- 200 requests per 15 minutes

#### cURL Example
```bash
curl -X GET "http://localhost:3001/api/admin/shops/550e8400-e29b-41d4-a716-446655440000/services/660e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

---

#### 4.14.4 샵 서비스 수정
**PUT** `/api/admin/shops/:shopId/services/:serviceId`

특정 샵의 서비스 정보를 수정합니다.

#### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | Yes | 샵 ID |
| serviceId | UUID | Yes | 서비스 ID |

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
Content-Type: application/json
```

#### Request Body
모든 필드는 선택사항이며, 최소 1개 이상의 필드를 포함해야 합니다.

```json
{
  "name": "프리미엄 젤 네일 아트",
  "description": "최고급 젤 네일 아트 서비스. 다양한 디자인과 색상 선택 가능.",
  "priceMin": 35000,
  "priceMax": 60000,
  "durationMinutes": 90,
  "depositPercentage": 50.00,
  "isActive": true,
  "isAvailable": true,
  "maxAdvanceBookingDays": 60,
  "minAdvanceBookingHours": 48
}
```

#### 필드 설명
모든 필드는 선택사항이지만, 최소 1개는 제공되어야 합니다:
- `name` (string, 1-255자): 서비스명
- `description` (string): 서비스 설명
- `category` (string): 서비스 카테고리 (nail, eyelash, waxing, eyebrow_tattoo, hair)
- `priceMin` (number): 최소 가격
- `priceMax` (number): 최대 가격
- `durationMinutes` (number): 소요 시간
- `depositAmount` (number): 고정 예약금
- `depositPercentage` (number): 비율 예약금
- `isActive` (boolean): 활성화 여부
- `isAvailable` (boolean): 예약 가능 여부
- `maxAdvanceBookingDays` (number): 최대 사전 예약 일수
- `minAdvanceBookingHours` (number): 최소 사전 예약 시간
- `cancellationPolicy` (string): 취소 정책

**주의사항**:
- `priceMin`은 `priceMax`보다 작거나 같아야 함
- `depositAmount`와 `depositPercentage`는 동시에 설정할 수 없음

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "service-uuid",
    "shopId": "shop-uuid",
    "name": "프리미엄 젤 네일 아트",
    "description": "최고급 젤 네일 아트 서비스. 다양한 디자인과 색상 선택 가능.",
    "category": "nail",
    "priceMin": 35000,
    "priceMax": 60000,
    "durationMinutes": 90,
    "depositAmount": null,
    "depositPercentage": 50.00,
    "isActive": true,
    "isAvailable": true,
    "maxAdvanceBookingDays": 60,
    "minAdvanceBookingHours": 48,
    "cancellationPolicy": "24시간 전까지 무료 취소, 이후 예약금 환불 불가",
    "createdAt": "2024-01-15T10:00:00Z",
    "updatedAt": "2024-01-15T11:30:00Z"
  },
  "message": "서비스가 성공적으로 업데이트되었습니다."
}
```

#### Error Responses
```json
// 업데이트할 필드가 없음
{
  "success": false,
  "error": {
    "code": "NO_UPDATE_FIELDS",
    "message": "업데이트할 필드가 없습니다.",
    "details": "최소 1개 이상의 필드를 제공해야 합니다."
  }
}

// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "존재하지 않는 샵 ID입니다."
  }
}

// 서비스를 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "서비스를 찾을 수 없습니다.",
    "details": "존재하지 않는 서비스 ID입니다."
  }
}

// 샵-서비스 불일치
{
  "success": false,
  "error": {
    "code": "SERVICE_SHOP_MISMATCH",
    "message": "서비스가 해당 샵에 속하지 않습니다.",
    "details": "지정된 샵의 서비스가 아닙니다."
  }
}

// 잘못된 가격 범위
{
  "success": false,
  "error": {
    "code": "INVALID_PRICE_RANGE",
    "message": "가격 범위가 올바르지 않습니다.",
    "details": "최소 가격은 최대 가격보다 작거나 같아야 합니다."
  }
}

// 예약금 설정 중복
{
  "success": false,
  "error": {
    "code": "INVALID_DEPOSIT_SETTINGS",
    "message": "예약금 설정이 올바르지 않습니다.",
    "details": "고정 금액과 비율 중 하나만 설정할 수 있습니다."
  }
}
```

#### Rate Limiting
- 50 requests per 5 minutes

#### cURL Example
```bash
curl -X PUT "http://localhost:3001/api/admin/shops/550e8400-e29b-41d4-a716-446655440000/services/660e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <admin-jwt-token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "프리미엄 젤 네일 아트",
    "priceMin": 35000,
    "priceMax": 60000,
    "durationMinutes": 90
  }'
```

---

#### 4.14.5 샵 서비스 삭제
**DELETE** `/api/admin/shops/:shopId/services/:serviceId`

특정 샵의 서비스를 삭제합니다 (소프트 삭제).

#### URL Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | Yes | 샵 ID |
| serviceId | UUID | Yes | 삭제할 서비스 ID |

#### Request Headers
```
Authorization: Bearer <admin-jwt-token>
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "서비스가 성공적으로 삭제되었습니다.",
  "data": {
    "deletedServiceId": "service-uuid",
    "deletedAt": "2024-01-15T12:00:00Z"
  }
}
```

#### Error Responses
```json
// 샵을 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "존재하지 않는 샵 ID입니다."
  }
}

// 서비스를 찾을 수 없음
{
  "success": false,
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "서비스를 찾을 수 없습니다.",
    "details": "존재하지 않는 서비스 ID입니다."
  }
}

// 샵-서비스 불일치
{
  "success": false,
  "error": {
    "code": "SERVICE_SHOP_MISMATCH",
    "message": "서비스가 해당 샵에 속하지 않습니다.",
    "details": "지정된 샵의 서비스가 아닙니다."
  }
}

// 활성 예약 존재
{
  "success": false,
  "error": {
    "code": "ACTIVE_RESERVATIONS_EXIST",
    "message": "활성 예약이 존재하여 삭제할 수 없습니다.",
    "details": "모든 예약을 취소하거나 완료한 후 삭제해주세요."
  }
}
```

#### Rate Limiting
- 50 requests per 5 minutes

#### cURL Example
```bash
curl -X DELETE "http://localhost:3001/api/admin/shops/550e8400-e29b-41d4-a716-446655440000/services/660e8400-e29b-41d4-a716-446655440000" \
  -H "Authorization: Bearer <admin-jwt-token>"
```

---

## 5. 예약 관리

### 5.1 예약 목록 조회
**GET** `/reservations`

고급 필터링으로 예약 목록을 조회합니다.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | 예약 상태 (requested, confirmed, completed, cancelled_by_user, cancelled_by_shop, no_show) |
| shopId | string | 샵 ID |
| userId | string | 사용자 ID |
| startDate | string | 예약 시작일 (YYYY-MM-DD) |
| endDate | string | 예약 종료일 (YYYY-MM-DD) |
| search | string | 고객명, 전화번호, 샵명 검색 |
| minAmount | number | 최소 금액 |
| maxAmount | number | 최대 금액 |
| hasPointsUsed | boolean | 포인트 사용 여부 |
| sortBy | string | 정렬 (reservation_datetime, created_at, total_amount) |
| page | number | 페이지 번호 |
| limit | number | 페이지 크기 |

#### Response
```json
{
  "success": true,
  "data": {
    "reservations": [
      {
        "id": "reservation-uuid",
        "reservationDate": "2024-03-15",
        "reservationTime": "14:00:00",
        "status": "confirmed",
        "totalAmount": 50000,
        "depositAmount": 10000,
        "remainingAmount": 40000,
        "pointsUsed": 1000,
        "customer": {
          "id": "user-uuid",
          "name": "김미영",
          "email": "kim@example.com",
          "phoneNumber": "+82-10-1234-5678"
        },
        "shop": {
          "id": "shop-uuid",
          "name": "Beauty Salon Seoul",
          "mainCategory": "nail"
        },
        "services": [
          {
            "name": "젤 매니큐어",
            "quantity": 1,
            "unitPrice": 30000
          }
        ],
        "daysUntilReservation": 5,
        "totalPaidAmount": 50000,
        "outstandingAmount": 0
      }
    ],
    "totalCount": 150,
    "currentPage": 1,
    "totalPages": 8
  }
}
```

---

### 5.2 예약 상세 정보
**GET** `/reservations/:id/details`

예약의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "reservation-uuid",
    "reservationDate": "2024-03-15",
    "reservationTime": "14:00:00",
    "status": "confirmed",
    "totalAmount": 50000,
    "customer": {
      "id": "user-uuid",
      "name": "김미영",
      "email": "kim@example.com"
    },
    "shop": {
      "id": "shop-uuid",
      "name": "Beauty Salon Seoul",
      "address": "서울시 강남구 123"
    },
    "services": [
      {
        "name": "젤 매니큐어",
        "description": "오래 지속되는 젤 폴리시 적용",
        "quantity": 1,
        "unitPrice": 30000,
        "durationMinutes": 60
      }
    ],
    "payments": [
      {
        "id": "payment-uuid",
        "paymentMethod": "card",
        "paymentStatus": "fully_paid",
        "amount": 50000,
        "paidAt": "2024-03-08T16:00:00Z"
      }
    ],
    "disputes": [],
    "analysis": {
      "paymentCompletion": 100,
      "hasDisputes": false,
      "requiresAttention": false
    }
  }
}
```

---

### 5.3 예약 상태 변경
**PUT** `/reservations/:id/status`

예약 상태를 변경합니다.

#### Request Body
```json
{
  "status": "completed",
  "notes": "서비스 성공적으로 완료",
  "reason": "고객이 서비스에 만족",
  "notifyCustomer": true,
  "notifyShop": true,
  "autoProcessPayment": false
}
```

#### Available Statuses
- `requested`: 예약 요청
- `confirmed`: 예약 확정
- `completed`: 서비스 완료
- `cancelled_by_user`: 고객 취소
- `cancelled_by_shop`: 샵 취소
- `no_show`: 노쇼

#### Response
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "previousStatus": "confirmed",
      "newStatus": "completed",
      "updatedAt": "2024-03-15T14:30:00Z"
    }
  }
}
```

---

### 5.4 예약 분석
**GET** `/reservations/analytics`

예약 분석 데이터를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (YYYY-MM-DD, 기본값: 30일 전)
- `endDate`: 종료일 (YYYY-MM-DD, 기본값: 오늘)

#### Response
```json
{
  "success": true,
  "data": {
    "totalReservations": 1250,
    "activeReservations": 45,
    "completedReservations": 1100,
    "cancelledReservations": 80,
    "noShowReservations": 25,
    "totalRevenue": 62500000,
    "averageReservationValue": 50000,
    "reservationsByStatus": {
      "requested": 15,
      "confirmed": 30,
      "completed": 1100,
      "cancelled": 80,
      "no_show": 25
    },
    "reservationsByCategory": {
      "nail": 600,
      "eyelash": 400,
      "waxing": 200
    },
    "trends": {
      "dailyReservations": [],
      "weeklyReservations": [],
      "monthlyReservations": []
    }
  }
}
```

---

### 5.5 분쟁 생성
**POST** `/reservations/:id/dispute`

예약에 대한 분쟁을 생성합니다.

#### Request Body
```json
{
  "disputeType": "customer_complaint",
  "description": "서비스 품질에 대한 고객 불만",
  "requestedAction": "compensation",
  "priority": "high",
  "evidence": ["https://example.com/evidence1.jpg"]
}
```

#### Dispute Types
- `customer_complaint`: 고객 불만
- `shop_issue`: 샵 이슈
- `payment_dispute`: 결제 분쟁
- `service_quality`: 서비스 품질 문제
- `other`: 기타

#### Requested Actions
- `refund`: 환불
- `reschedule`: 일정 변경
- `compensation`: 보상
- `investigation`: 조사
- `other`: 기타

---

### 5.6 강제 완료
**POST** `/reservations/:id/force-complete`

분쟁 해결을 위해 예약을 강제로 완료 처리합니다.

#### Request Body
```json
{
  "reason": "고객 서비스 품질 이슈 해결",
  "notes": "서비스는 완료되었으나 초기 우려 사항 있음. 보상 제공됨",
  "refundAmount": 10000,
  "compensationPoints": 500,
  "notifyCustomer": true,
  "notifyShop": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "reservation": {
      "id": "reservation-uuid",
      "status": "completed",
      "updatedAt": "2024-03-15T14:30:00Z"
    },
    "refundProcessed": true,
    "compensationProcessed": true,
    "notificationsSent": {
      "customer": true,
      "shop": true
    }
  }
}
```

---

### 5.7 일괄 상태 업데이트
**POST** `/reservations/bulk-status-update`

여러 예약의 상태를 일괄 업데이트합니다.

#### Request Body
```json
{
  "reservationIds": ["res-uuid-1", "res-uuid-2"],
  "status": "completed",
  "notes": "확정된 예약의 일괄 완료",
  "reason": "모든 서비스 성공적으로 완료",
  "notifyCustomers": true,
  "notifyShops": true
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "reservationId": "res-uuid-1",
        "success": true
      },
      {
        "reservationId": "res-uuid-2",
        "success": false,
        "error": "Reservation not found"
      }
    ],
    "summary": {
      "total": 2,
      "successful": 1,
      "failed": 1
    }
  }
}
```

---

## 6. 결제 및 정산 관리

### 6.1 결제 목록 조회
**GET** `/payments`

고급 필터링으로 결제 내역을 조회합니다.

#### Query Parameters
| Parameter | Type | Description |
|-----------|------|-------------|
| status | string | 결제 상태 (pending, processing, completed, failed, cancelled, refunded) |
| paymentMethod | string | 결제 수단 (card, transfer, cash, points) |
| shopId | string | 샵 ID |
| userId | string | 사용자 ID |
| startDate | string | 시작일 (YYYY-MM-DD) |
| endDate | string | 종료일 (YYYY-MM-DD) |
| minAmount | number | 최소 금액 |
| maxAmount | number | 최대 금액 |
| isDeposit | boolean | 예치금 여부 |
| hasRefund | boolean | 환불 여부 |
| sortBy | string | 정렬 (paid_at, created_at, amount, customer_name, shop_name) |
| sortOrder | string | 정렬 순서 (asc, desc) |
| page | number | 페이지 번호 |
| limit | number | 페이지 크기 (기본값: 20, 최대: 100) |

#### Response
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "id": "payment-uuid",
        "reservationId": "reservation-uuid",
        "userId": "user-uuid",
        "paymentMethod": "card",
        "paymentStatus": "completed",
        "amount": 50000,
        "currency": "KRW",
        "isDeposit": false,
        "paidAt": "2024-01-01T10:00:00Z",
        "refundedAt": null,
        "refundAmount": 0,
        "netAmount": 50000,
        "customer": {
          "id": "user-uuid",
          "name": "김미영",
          "email": "kim@example.com"
        },
        "shop": {
          "id": "shop-uuid",
          "name": "Beauty Salon Seoul"
        },
        "reservation": {
          "reservationDate": "2024-01-15",
          "status": "completed"
        }
      }
    ],
    "totalCount": 500,
    "currentPage": 1,
    "totalPages": 25
  }
}
```

---

### 6.2 결제 요약
**GET** `/payments/summary`

결제 요약 통계를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (ISO date)
- `endDate`: 종료일 (ISO date)

#### Response
```json
{
  "success": true,
  "data": {
    "totalPayments": 1250,
    "totalAmount": 62500000,
    "totalRefunds": 1250000,
    "netRevenue": 61250000,
    "averagePaymentAmount": 50000,
    "paymentsByStatus": {
      "completed": 1100,
      "pending": 50,
      "refunded": 25,
      "failed": 75
    },
    "paymentsByMethod": {
      "card": 800,
      "transfer": 300,
      "cash": 100,
      "points": 50
    },
    "paymentsByShop": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beauty Salon",
        "count": 100,
        "amount": 5000000,
        "refunds": 100000,
        "netAmount": 4900000
      }
    ],
    "dailyPayments": [
      {
        "date": "2024-01-01",
        "count": 45,
        "amount": 2250000,
        "refunds": 50000,
        "netAmount": 2200000
      }
    ]
  }
}
```

---

### 6.3 정산 보고서
**GET** `/payments/settlements`

샵별 정산 보고서를 조회합니다.

#### Query Parameters
- `startDate`: 정산 기간 시작일
- `endDate`: 정산 기간 종료일

#### Response
```json
{
  "success": true,
  "data": {
    "settlements": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beauty Salon Seoul",
        "shopType": "partnered",
        "commissionRate": 15.0,
        "completedReservations": 50,
        "grossRevenue": 2500000,
        "commissionAmount": 375000,
        "netPayout": 2125000,
        "lastSettlementDate": "2023-12-31T00:00:00Z",
        "nextSettlementDate": "2024-01-31T00:00:00Z",
        "isEligibleForSettlement": true
      }
    ],
    "summary": {
      "totalShops": 180,
      "totalGrossRevenue": 62500000,
      "totalCommissionAmount": 9375000,
      "totalNetPayout": 53125000,
      "averageCommissionRate": 15.0
    },
    "dateRange": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    }
  }
}
```

---

### 6.4 결제 분석
**GET** `/payments/analytics`

결제 분석 데이터를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (ISO date)
- `endDate`: 종료일 (ISO date)

#### Response
```json
{
  "success": true,
  "data": {
    "totalTransactions": 1250,
    "successfulTransactions": 1200,
    "failedTransactions": 50,
    "totalRevenue": 62500000,
    "totalRefunds": 1250000,
    "netRevenue": 61250000,
    "averageTransactionValue": 50000,
    "conversionRate": 96.0,
    "refundRate": 2.0,
    "transactionsByMethod": {
      "card": 800,
      "transfer": 300,
      "cash": 100
    },
    "transactionsByStatus": {
      "completed": 1200,
      "failed": 50
    },
    "revenueTrends": {
      "daily": [],
      "weekly": [],
      "monthly": []
    },
    "topPerformingShops": [
      {
        "shopId": "shop-uuid",
        "shopName": "Beauty Salon Seoul",
        "revenue": 5000000,
        "transactions": 100,
        "averageOrderValue": 50000
      }
    ]
  }
}
```

---

### 6.5 결제 상세 정보
**GET** `/payments/:paymentId`

특정 결제의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "payment-uuid",
    "reservationId": "reservation-uuid",
    "userId": "user-uuid",
    "paymentMethod": "card",
    "paymentStatus": "completed",
    "amount": 50000,
    "paidAt": "2024-01-01T10:00:00Z",
    "customer": {
      "name": "김미영",
      "email": "kim@example.com"
    },
    "shop": {
      "name": "Beauty Salon Seoul"
    },
    "reservation": {
      "reservationDate": "2024-01-15",
      "status": "completed"
    }
  }
}
```

---

### 6.6 환불 처리
**POST** `/payments/:paymentId/refund`

결제 환불을 처리합니다.

#### Request Body
```json
{
  "refundAmount": 50000,
  "reason": "고객 요청",
  "refundMethod": "original",
  "notes": "서비스 취소로 인한 전액 환불",
  "notifyCustomer": true
}
```

#### Refund Methods
- `original`: 원결제 수단으로 환불
- `points`: 포인트로 환불

#### Response
```json
{
  "success": true,
  "data": {
    "refund": {
      "id": "refund-uuid",
      "paymentId": "payment-uuid",
      "refundAmount": 50000,
      "reason": "고객 요청",
      "refundMethod": "original",
      "status": "processed",
      "processedAt": "2024-01-01T10:00:00Z"
    },
    "payment": {
      "previousStatus": "completed",
      "newStatus": "refunded",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 6.7 결제 데이터 내보내기
**GET** `/payments/export`

결제 데이터를 CSV 형식으로 내보냅니다.

#### Query Parameters
- 모든 필터링 파라미터 동일 (6.1 참조)

#### Response
- `Content-Type: text/csv`
- 파일명: `payments-{timestamp}.csv`

---

## 7. 보안 및 모니터링

### 7.1 사용자 세션 강제 무효화
**POST** `/security/users/:userId/invalidate-sessions`

특정 사용자의 모든 세션을 강제로 무효화합니다.

#### Request Body
```json
{
  "reason": "의심스러운 활동 감지",
  "keepCurrentSession": false,
  "eventType": "suspicious_activity"
}
```

#### Event Types
- `admin_action`: 관리자 조치
- `account_compromise`: 계정 침해
- `suspicious_activity`: 의심스러운 활동
- `token_theft_detected`: 토큰 도용 감지

#### Response
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "invalidatedSessions": 3,
    "reason": "의심스러운 활동 감지",
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.2 사용자 세션 정보 조회
**GET** `/security/users/:userId/sessions`

사용자의 세션 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "userId": "user-uuid",
    "sessions": [
      {
        "sessionId": "session-uuid",
        "deviceInfo": {
          "userAgent": "Mozilla/5.0...",
          "platform": "Web"
        },
        "ipAddress": "192.168.1.1",
        "loginAt": "2024-01-01T10:00:00Z",
        "lastActivityAt": "2024-01-01T11:00:00Z",
        "isActive": true
      }
    ],
    "totalActiveSessions": 2
  }
}
```

---

### 7.3 일괄 세션 무효화
**POST** `/security/bulk-invalidate-sessions`

여러 사용자의 세션을 일괄 무효화합니다.

#### Request Body
```json
{
  "userIds": ["user-uuid-1", "user-uuid-2"],
  "reason": "보안 정책 위반",
  "eventType": "admin_action"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "totalUsers": 2,
    "invalidatedSessions": 5,
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.4 보안 이벤트 조회
**GET** `/security/events`

보안 이벤트를 조회합니다.

#### Query Parameters
- `userId`: 사용자 ID
- `eventType`: 이벤트 타입
- `severity`: 심각도 (low, medium, high, critical)
- `startDate`: 시작일 (ISO date)
- `endDate`: 종료일 (ISO date)
- `limit`: 제한 (기본값: 50, 최대: 100)
- `offset`: 오프셋 (기본값: 0)

#### Response
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-uuid",
        "userId": "user-uuid",
        "eventType": "session_invalidated",
        "severity": "high",
        "description": "모든 세션이 관리자에 의해 무효화됨",
        "metadata": {
          "reason": "의심스러운 활동",
          "adminId": "admin-uuid"
        },
        "timestamp": "2024-01-01T10:00:00Z"
      }
    ],
    "totalCount": 150
  }
}
```

---

### 7.5 보안 통계 (향상된)
**GET** `/security-enhanced/stats`

XSS, CSRF, SQL Injection, RPC 보안 통계를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "xss": {
      "totalViolations": 25,
      "blockedViolations": 25,
      "recentViolations": []
    },
    "csrf": {
      "totalViolations": 10,
      "blockedViolations": 10,
      "recentViolations": []
    },
    "sqlInjection": {
      "totalAttempts": 50,
      "blockedAttempts": 50,
      "recentAttempts": []
    },
    "rpc": {
      "totalViolations": 5,
      "blockedViolations": 5,
      "recentViolations": []
    },
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.6 XSS 보호 통계
**GET** `/security-enhanced/xss/stats`

XSS 보호 통계를 조회합니다.

---

### 7.7 CSRF 보호 통계
**GET** `/security-enhanced/csrf/stats`

CSRF 보호 통계를 조회합니다.

---

### 7.8 SQL Injection 통계
**GET** `/security-enhanced/sql-injection/stats`

SQL Injection 방어 통계를 조회합니다.

---

### 7.9 RPC 보안 통계
**GET** `/security-enhanced/rpc/stats`

RPC 보안 통계를 조회합니다.

---

### 7.10 보안 이력 초기화
**POST** `/security-enhanced/xss/reset`

XSS 보호 이력을 초기화합니다.

**POST** `/security-enhanced/csrf/reset`

CSRF 보호 이력을 초기화합니다.

**POST** `/security-enhanced/sql-injection/reset`

SQL Injection 방어 이력을 초기화합니다.

**POST** `/security-enhanced/rpc/reset`

RPC 보안 이력을 초기화합니다.

**POST** `/security-enhanced/reset-all`

모든 보안 이력을 초기화합니다.

---

### 7.11 보안 건강 상태
**GET** `/security-enhanced/health`

보안 시스템의 전반적인 건강 상태를 확인합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "services": {
      "xssProtection": {
        "status": "healthy",
        "violations": 25,
        "blocked": 25
      },
      "csrfProtection": {
        "status": "healthy",
        "violations": 10,
        "blocked": 10
      },
      "sqlInjectionPrevention": {
        "status": "healthy",
        "attempts": 50,
        "blocked": 50
      },
      "rpcSecurity": {
        "status": "healthy",
        "violations": 5,
        "blocked": 5
      }
    },
    "timestamp": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.12 보안 이벤트 통계
**GET** `/security-events/statistics`

포괄적인 보안 이벤트 통계를 조회합니다.

#### Query Parameters
- `timeWindow`: 시간 범위 (밀리초, 기본값: 24시간)

#### Response
```json
{
  "success": true,
  "data": {
    "totalEvents": 500,
    "blockedEvents": 450,
    "eventsByThreatLevel": {
      "critical": 10,
      "high": 50,
      "medium": 200,
      "low": 240
    },
    "eventsBySeverity": {
      "critical": 5,
      "high": 45,
      "medium": 250,
      "low": 200
    },
    "eventsByMiddleware": {
      "xss_protection": 100,
      "csrf_protection": 50,
      "sql_injection": 150,
      "rpc_security": 200
    },
    "topThreatIPs": [
      {
        "ip": "192.168.1.100",
        "count": 25
      }
    ],
    "timeWindow": 86400000,
    "generatedAt": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.13 최근 보안 이벤트
**GET** `/security-events/recent`

최근 보안 이벤트를 조회합니다.

#### Query Parameters
- `limit`: 제한 (기본값: 50)
- `offset`: 오프셋 (기본값: 0)
- `middleware`: 미들웨어 필터
- `threatLevel`: 위협 수준 필터
- `severity`: 심각도 필터

#### Response
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "id": "event-uuid",
        "middleware": "xss_protection",
        "eventType": "xss_attempt_blocked",
        "severity": "high",
        "threatLevel": "high",
        "sourceIp": "192.168.1.100",
        "endpoint": "/api/admin/users",
        "timestamp": "2024-01-01T10:00:00Z",
        "blocked": true
      }
    ],
    "pagination": {
      "limit": 50,
      "offset": 0,
      "total": 150,
      "hasMore": true
    }
  }
}
```

---

### 7.14 보안 경고
**GET** `/security-events/alerts`

활성화된 보안 경고를 조회합니다.

#### Query Parameters
- `severity`: 심각도 필터

#### Response
```json
{
  "success": true,
  "data": {
    "alerts": [
      {
        "id": "alert-uuid",
        "severity": "high",
        "type": "multiple_failed_logins",
        "description": "동일 IP에서 여러 로그인 실패",
        "sourceIp": "192.168.1.100",
        "count": 10,
        "timestamp": "2024-01-01T10:00:00Z"
      }
    ],
    "count": 5,
    "generatedAt": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.15 보안 경고 해결
**POST** `/security-events/alerts/:alertId/resolve`

보안 경고를 해결 처리합니다.

#### Request Body
```json
{
  "resolutionNotes": "IP 차단 완료 및 조사 완료"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "message": "Security alert resolved successfully",
    "alertId": "alert-uuid",
    "resolvedBy": "admin-uuid",
    "resolvedAt": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.16 규정 준수 보고서
**GET** `/security-events/compliance-report`

보안 규정 준수 보고서를 생성합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "complianceScore": 95.5,
    "securityControls": {
      "authentication": "compliant",
      "authorization": "compliant",
      "dataProtection": "compliant",
      "auditLogging": "compliant"
    },
    "recommendations": [
      "정기적인 보안 감사 수행",
      "사용자 교육 프로그램 강화"
    ],
    "generatedAt": "2024-01-01T10:00:00Z"
  }
}
```

---

### 7.17 미들웨어별 통계
**GET** `/security-events/middleware-stats`

미들웨어별 보안 통계를 조회합니다.

#### Query Parameters
- `timeWindow`: 시간 범위 (밀리초)

#### Response
```json
{
  "success": true,
  "data": {
    "middlewareStats": [
      {
        "middleware": "xss_protection",
        "count": 100,
        "percentage": "20.00"
      },
      {
        "middleware": "sql_injection",
        "count": 150,
        "percentage": "30.00"
      }
    ],
    "totalEvents": 500,
    "timeWindow": 86400000
  }
}
```

---

### 7.18 위협 분석
**GET** `/security-events/threat-analysis`

위협 분석 데이터를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "threatLevels": {
      "critical": 10,
      "high": 50,
      "medium": 200,
      "low": 240
    },
    "severities": {
      "critical": 5,
      "high": 45,
      "medium": 250,
      "low": 200
    },
    "blockedEvents": 450,
    "blockRate": "90.00",
    "topThreatIPs": [
      {
        "ip": "192.168.1.100",
        "count": 25
      }
    ],
    "riskScore": 35
  }
}
```

---

### 7.19 보안 이벤트 내보내기
**POST** `/security-events/export`

보안 이벤트를 CSV 또는 JSON 형식으로 내보냅니다.

#### Request Body
```json
{
  "format": "csv",
  "timeWindow": 86400000,
  "filters": {
    "middleware": "xss_protection",
    "threatLevel": "high"
  }
}
```

#### Supported Formats
- `csv`: CSV 파일
- `json`: JSON 형식

---

## 8. 콘텐츠 모더레이션

### 8.1 신고 목록 조회
**GET** `/moderation/reports`

콘텐츠 신고 목록을 조회합니다.

#### Query Parameters
- `status`: 신고 상태 (pending, under_review, resolved, dismissed)
- `reportType`: 신고 유형 (spam, inappropriate_content, fraud, harassment, other)
- `targetType`: 대상 타입 (shop, user, reservation, review)
- `priority`: 우선순위 (low, medium, high, urgent)
- `startDate`: 시작일
- `endDate`: 종료일
- `page`: 페이지 번호
- `limit`: 페이지 크기

#### Response
```json
{
  "success": true,
  "data": {
    "reports": [
      {
        "id": "report-uuid",
        "reportType": "inappropriate_content",
        "targetType": "shop",
        "targetId": "shop-uuid",
        "reporterId": "user-uuid",
        "description": "부적절한 샵 이미지",
        "status": "pending",
        "priority": "high",
        "createdAt": "2024-01-01T10:00:00Z",
        "reporter": {
          "name": "신고자 이름",
          "email": "reporter@example.com"
        },
        "target": {
          "name": "샵 이름",
          "type": "shop"
        }
      }
    ],
    "totalCount": 50,
    "currentPage": 1,
    "totalPages": 3
  }
}
```

---

### 8.2 신고 상세 정보
**GET** `/moderation/reports/:id`

신고의 상세 정보를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "id": "report-uuid",
    "reportType": "inappropriate_content",
    "targetType": "shop",
    "targetId": "shop-uuid",
    "description": "부적절한 샵 이미지",
    "status": "pending",
    "priority": "high",
    "evidence": [
      "https://example.com/evidence1.jpg"
    ],
    "reporter": {
      "id": "user-uuid",
      "name": "신고자 이름",
      "email": "reporter@example.com"
    },
    "target": {
      "id": "shop-uuid",
      "name": "샵 이름",
      "type": "shop"
    },
    "moderationHistory": []
  }
}
```

---

### 8.3 신고 처리
**PUT** `/moderation/reports/:id/resolve`

신고를 처리합니다.

#### Request Body
```json
{
  "resolution": "content_removed",
  "moderationNotes": "부적절한 이미지 제거 완료",
  "actionTaken": "샵 이미지 삭제 및 경고 발송",
  "notifyReporter": true,
  "notifyTarget": true
}
```

#### Available Resolutions
- `content_removed`: 콘텐츠 제거
- `warning_issued`: 경고 발송
- `account_suspended`: 계정 정지
- `no_action`: 조치 없음
- `dismissed`: 기각

#### Response
```json
{
  "success": true,
  "data": {
    "report": {
      "id": "report-uuid",
      "previousStatus": "pending",
      "newStatus": "resolved",
      "resolution": "content_removed",
      "resolvedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 8.4 모더레이션 통계
**GET** `/moderation/statistics`

모더레이션 통계를 조회합니다.

#### Response
```json
{
  "success": true,
  "data": {
    "totalReports": 500,
    "pendingReports": 50,
    "resolvedReports": 400,
    "dismissedReports": 50,
    "reportsByType": {
      "spam": 100,
      "inappropriate_content": 200,
      "fraud": 50,
      "harassment": 100,
      "other": 50
    },
    "reportsByTarget": {
      "shop": 200,
      "user": 150,
      "reservation": 100,
      "review": 50
    },
    "averageResolutionTime": 24.5
  }
}
```

---

## 9. 포인트 조정 시스템

### 9.1 포인트 조정 생성
**POST** `/admin/point-adjustments`

사용자 포인트 조정을 생성합니다.

#### Request Body
```json
{
  "userId": "user-uuid",
  "amount": 1000,
  "reason": "고객 서비스 보상",
  "adjustmentType": "add",
  "category": "compensation",
  "requiresApproval": false,
  "notes": "서비스 불만에 대한 보상"
}
```

#### Adjustment Types
- `add`: 포인트 추가
- `subtract`: 포인트 차감
- `expire`: 포인트 만료

#### Categories
- `customer_service`: 고객 서비스
- `system_error`: 시스템 오류
- `fraud_prevention`: 사기 방지
- `promotional`: 프로모션
- `compensation`: 보상
- `technical_issue`: 기술적 문제
- `other`: 기타

#### Response
```json
{
  "success": true,
  "data": {
    "adjustment": {
      "id": "adjustment-uuid",
      "userId": "user-uuid",
      "amount": 1000,
      "adjustmentType": "add",
      "status": "approved",
      "createdAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 9.2 포인트 조정 승인
**POST** `/admin/point-adjustments/:adjustmentId/approve`

포인트 조정을 승인합니다.

#### Request Body
```json
{
  "approverLevel": 1,
  "notes": "승인 완료"
}
```

#### Response
```json
{
  "success": true,
  "data": {
    "adjustment": {
      "id": "adjustment-uuid",
      "status": "approved",
      "approvedBy": "admin-uuid",
      "approvedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

---

### 9.3 포인트 조정 거부
**POST** `/admin/point-adjustments/:adjustmentId/reject`

포인트 조정을 거부합니다.

#### Request Body
```json
{
  "reason": "증빙 자료 부족"
}
```

---

### 9.4 포인트 조정 조회
**GET** `/admin/point-adjustments/:adjustmentId`

특정 포인트 조정의 상세 정보를 조회합니다.

---

### 9.5 대기 중인 포인트 조정
**GET** `/admin/point-adjustments/pending`

승인 대기 중인 포인트 조정 목록을 조회합니다.

---

### 9.6 포인트 조정 통계
**GET** `/admin/point-adjustments/stats`

포인트 조정 통계를 조회합니다.

#### Query Parameters
- `startDate`: 시작일 (ISO date)
- `endDate`: 종료일 (ISO date)

#### Response
```json
{
  "success": true,
  "data": {
    "totalAdjustments": 500,
    "pendingAdjustments": 25,
    "approvedAdjustments": 400,
    "rejectedAdjustments": 75,
    "totalPointsAdded": 500000,
    "totalPointsSubtracted": 100000,
    "adjustmentsByCategory": {
      "customer_service": 200,
      "compensation": 150,
      "promotional": 100,
      "system_error": 50
    }
  }
}
```

---

### 9.7 사용자별 포인트 조정 이력
**GET** `/admin/point-adjustments/user/:userId`

특정 사용자의 포인트 조정 이력을 조회합니다.

---

### 9.8 감사 로그 조회
**GET** `/admin/audit-logs`

관리자 작업 감사 로그를 조회합니다.

#### Query Parameters
- `adminId`: 관리자 ID
- `actionType`: 작업 타입 (user_suspended, shop_approved, refund_processed, points_adjusted)
- `targetType`: 대상 타입
- `startDate`: 시작일
- `endDate`: 종료일
- `page`: 페이지 번호
- `limit`: 페이지 크기

---

### 9.9 감사 로그 내보내기
**GET** `/admin/audit-logs/export`

감사 로그를 CSV 형식으로 내보냅니다.

---

## 10. 재무 관리

### 10.1 재무 보고서
**GET** `/financial/reports`

재무 보고서를 생성합니다.

#### Query Parameters
- `reportType`: 보고서 유형 (daily, weekly, monthly, yearly)
- `startDate`: 시작일
- `endDate`: 종료일

#### Response
```json
{
  "success": true,
  "data": {
    "reportType": "monthly",
    "period": {
      "startDate": "2024-01-01",
      "endDate": "2024-01-31"
    },
    "revenue": {
      "total": 62500000,
      "byCategory": {
        "nail": 25000000,
        "eyelash": 20000000,
        "waxing": 12500000,
        "eyebrow_tattoo": 5000000
      },
      "byPaymentMethod": {
        "card": 50000000,
        "transfer": 10000000,
        "cash": 2500000
      }
    },
    "commissions": {
      "total": 9375000,
      "averageRate": 15.0
    },
    "refunds": {
      "total": 1250000,
      "count": 25
    },
    "netRevenue": 61250000
  }
}
```

---

### 10.2 수익 분석
**GET** `/financial/revenue-analysis`

상세한 수익 분석 데이터를 조회합니다.

---

### 10.3 비용 추적
**GET** `/financial/expenses`

플랫폼 운영 비용을 추적합니다.

---

### 10.4 수익성 분석
**GET** `/financial/profitability`

샵별, 카테고리별 수익성을 분석합니다.

---

## 📌 공통 에러 코드

| 코드 | 상태 코드 | 설명 |
|------|----------|------|
| UNAUTHORIZED | 401 | 인증 실패 |
| FORBIDDEN | 403 | 권한 없음 (관리자만 접근 가능) |
| NOT_FOUND | 404 | 리소스를 찾을 수 없음 |
| VALIDATION_ERROR | 400 | 입력 데이터 유효성 검사 실패 |
| RATE_LIMIT_EXCEEDED | 429 | 요청 제한 초과 |
| INTERNAL_SERVER_ERROR | 500 | 서버 내부 오류 |

---

## 🔒 Rate Limiting

각 엔드포인트는 요청 제한이 적용됩니다:

| 카테고리 | 제한 |
|---------|------|
| 일반 조회 | 100 req/15min |
| 수정 작업 | 20 req/15min |
| 민감한 작업 | 10 req/15min |
| 데이터 내보내기 | 10 req/15min |

---

## 📝 사용 예제

### TypeScript/JavaScript 예제

```typescript
// API 클라이언트 설정
const API_BASE_URL = 'http://localhost:3001/api/admin';
let authToken = '';

// 로그인
async function login(email: string, password: string) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });

  const data = await response.json();
  authToken = data.data.token;
  return data;
}

// 사용자 목록 조회
async function getUsers(filters?: {
  page?: number;
  limit?: number;
  status?: string;
}) {
  const params = new URLSearchParams(filters as any);

  const response = await fetch(`${API_BASE_URL}/users?${params}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  return response.json();
}

// 사용자 상태 변경
async function updateUserStatus(
  userId: string,
  status: string,
  reason: string
) {
  const response = await fetch(`${API_BASE_URL}/users/${userId}/status`, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status, reason })
  });

  return response.json();
}

// 대시보드 데이터 조회
async function getDashboard(period = 'today') {
  const response = await fetch(`${API_BASE_URL}/analytics/dashboard?period=${period}`, {
    headers: { 'Authorization': `Bearer ${authToken}` }
  });

  return response.json();
}
```

---

## 🎯 Best Practices

### 1. 인증 토큰 관리
```typescript
// 토큰 자동 갱신 구현
async function refreshTokenIfNeeded() {
  const tokenExpiry = localStorage.getItem('tokenExpiry');
  const now = Date.now();

  if (tokenExpiry && now > parseInt(tokenExpiry) - 300000) {
    // 만료 5분 전 갱신
    const refreshToken = localStorage.getItem('refreshToken');
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken })
    });

    const data = await response.json();
    localStorage.setItem('token', data.data.token);
    localStorage.setItem('tokenExpiry', (now + data.data.expiresIn * 1000).toString());
  }
}
```

### 2. 에러 처리
```typescript
async function apiCall(endpoint: string, options?: RequestInit) {
  try {
    await refreshTokenIfNeeded();

    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
        ...options?.headers
      }
    });

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
}
```

### 3. 페이지네이션 처리
```typescript
async function getAllPages<T>(
  endpoint: string,
  limit = 100
): Promise<T[]> {
  let page = 1;
  let allData: T[] = [];
  let hasMore = true;

  while (hasMore) {
    const response = await apiCall(`${endpoint}?page=${page}&limit=${limit}`);
    allData = [...allData, ...response.users];
    hasMore = response.hasMore;
    page++;
  }

  return allData;
}
```

---

## 📚 추가 리소스

- **Swagger UI**: http://localhost:3001/admin-docs
- **OpenAPI Spec**: http://localhost:3001/api/admin/openapi.json
- **백엔드 저장소**: https://github.com/your-repo/everything_backend
- **프론트엔드 가이드**: 별도 문서 참조

---

**문서 버전**: 1.0.0
**최종 업데이트**: 2025-10-04
**관리**: Backend Development Team
