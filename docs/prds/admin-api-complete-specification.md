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

### 4.1 샵 승인 대기 목록
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

### 4.2 샵 승인/거부
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

### 4.3 샵 승인 상세 정보
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

### 4.4 샵 검증 통계
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

### 4.5 샵 일괄 승인
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

### 4.6 샵 검증 요구사항 확인
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

### 4.7 샵 검증 이력
**GET** `/shops/:shopId/verification-history`

샵의 검증 이력을 조회합니다.

#### Query Parameters
- `page`: 페이지 번호 (기본값: 1)
- `limit`: 페이지 크기 (기본값: 20, 최대: 100)

---

### 4.8 대기 중인 샵 목록
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

### 4.9 샵 승인 처리
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
