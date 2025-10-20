# 샵 영업시간 API 문서

## 목차
- [개요](#개요)
- [인증 및 권한](#인증-및-권한)
- [데이터 모델](#데이터-모델)
- [API 엔드포인트](#api-엔드포인트)
  - [어드민 API](#어드민-api)
  - [샵 오너 API](#샵-오너-api)
- [에러 처리](#에러-처리)
- [실제 사용 예시](#실제-사용-예시)

---

## 개요

샵 영업시간 API는 관리자와 샵 오너가 영업시간을 관리할 수 있는 기능을 제공합니다.

### API 구분
- **어드민 API**: 관리자가 모든 샵의 영업시간을 조회 (읽기 전용)
- **샵 오너 API**: 샵 오너가 자신의 샵 영업시간을 조회/수정

### 기본 정보

#### 어드민 API
- **Base URL**: `http://localhost:3001/api/admin/shops`
- **Production URL**: `https://api.ebeautything.com/api/admin/shops`
- **Protocol**: HTTPS (Production)
- **Content-Type**: `application/json`

#### 샵 오너 API
- **Base URL**: `http://localhost:3001/api/shop/operating-hours`
- **Production URL**: `https://api.ebeautything.com/api/shop/operating-hours`
- **Protocol**: HTTPS (Production)
- **Content-Type**: `application/json`

### 주요 기능 비교

| 기능 | 어드민 API | 샵 오너 API |
|------|-----------|-------------|
| 영업시간 조회 | ✅ (모든 샵) | ✅ (자신의 샵) |
| 영업시간 생성/수정 | ❌ | ✅ |
| 샵 이름 포함 | ✅ | ❌ |
| 실시간 영업 상태 | ✅ | ✅ |
| 기본 템플릿 제공 | ✅ | ✅ |
| Rate Limiting | 15분/100회 | 조회 15분/50회, 수정 5분/10회 |

---

## 인증 및 권한

### 인증 방식
모든 API 요청에는 JWT 토큰이 필요합니다.

```http
Authorization: Bearer <JWT_TOKEN>
```

### 필요 권한

#### 어드민 API
- **역할**: Admin (관리자)
- **조건**: 관리자 계정으로 로그인되어 있어야 함

#### 샵 오너 API
- **역할**: Shop Owner (샵 오너)
- **조건**: 샵 오너로 로그인되어 있어야 하며, 등록된 샵이 있어야 함

### Rate Limiting

#### 어드민 API
| 엔드포인트 | 제한 |
|-----------|------|
| GET (조회) | 15분당 100회 |

#### 샵 오너 API
| 엔드포인트 | 제한 |
|-----------|------|
| GET (조회) | 15분당 50회 |
| PUT (수정) | 5분당 10회 |

---

## 데이터 모델

### DayOperatingHours (요일별 영업시간)

```typescript
interface DayOperatingHours {
  open?: string;        // 영업 시작 시간 (HH:MM 형식)
  close?: string;       // 영업 종료 시간 (HH:MM 형식)
  closed?: boolean;     // 휴무 여부 (기본값: false)
  break_start?: string; // 휴게 시작 시간 (선택사항)
  break_end?: string;   // 휴게 종료 시간 (선택사항)
}
```

**필드 설명**:
- `open`: 영업 시작 시간 (24시간 형식, 예: "09:00", "14:30")
- `close`: 영업 종료 시간 (24시간 형식, 예: "18:00", "22:00")
- `closed`: `true`이면 해당 요일은 휴무
- `break_start`, `break_end`: 점심시간 등 휴게시간 (둘 다 설정하거나 둘 다 생략)

### WeeklyOperatingHours (주간 영업시간)

```typescript
interface WeeklyOperatingHours {
  monday?: DayOperatingHours;
  tuesday?: DayOperatingHours;
  wednesday?: DayOperatingHours;
  thursday?: DayOperatingHours;
  friday?: DayOperatingHours;
  saturday?: DayOperatingHours;
  sunday?: DayOperatingHours;
}
```

### CurrentStatus (현재 영업 상태)

```typescript
interface CurrentStatus {
  is_open: boolean;      // 현재 영업 중 여부
  current_day: string;   // 현재 요일 (예: "monday")
  current_time: string;  // 현재 시간 (HH:MM)
  next_opening?: string; // 다음 영업 시작 시간 (영업 중이 아닐 때)
}
```

### AdminOperatingHoursResponse

```typescript
interface AdminOperatingHoursResponse {
  success: boolean;
  data: {
    shopId: string;                           // 샵 UUID
    shopName: string;                         // 샵 이름
    operating_hours: WeeklyOperatingHours;    // 주간 영업시간
    current_status: CurrentStatus;            // 현재 영업 상태
  };
  message: string;
}
```

---

## API 엔드포인트

---

## 어드민 API

### GET /api/admin/shops/:shopId/operating-hours

특정 샵의 영업시간 스케줄과 실시간 영업 상태를 조회합니다.

#### 요청

```http
GET /api/admin/shops/582e19b1-49fc-4f7f-b852-54dd54f56a7f/operating-hours
Authorization: Bearer <ADMIN_JWT_TOKEN>
```

#### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| shopId | UUID | ✅ Yes | 조회할 샵의 고유 ID |

#### 응답 (200 OK)

**영업시간이 설정된 경우:**

```json
{
  "success": true,
  "data": {
    "shopId": "582e19b1-49fc-4f7f-b852-54dd54f56a7f",
    "shopName": "아름다운 네일샵",
    "operating_hours": {
      "monday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "tuesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "wednesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "thursday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "friday": {
        "open": "09:00",
        "close": "20:00",
        "closed": false
      },
      "saturday": {
        "open": "10:00",
        "close": "17:00",
        "closed": false
      },
      "sunday": {
        "closed": true
      }
    },
    "current_status": {
      "is_open": true,
      "current_day": "monday",
      "current_time": "14:30",
      "next_opening": null
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

**영업시간이 설정되지 않은 경우 (기본 템플릿 반환):**

```json
{
  "success": true,
  "data": {
    "shopId": "582e19b1-49fc-4f7f-b852-54dd54f56a7f",
    "shopName": "아름다운 네일샵",
    "operating_hours": {
      "monday": { "open": "09:00", "close": "18:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
      "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
      "thursday": { "open": "09:00", "close": "18:00", "closed": false },
      "friday": { "open": "09:00", "close": "18:00", "closed": false },
      "saturday": { "open": "10:00", "close": "17:00", "closed": false },
      "sunday": { "closed": true }
    },
    "current_status": {
      "is_open": false,
      "current_day": "monday",
      "current_time": "08:00",
      "next_opening": "Today at 09:00"
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

**휴게시간 포함 예시:**

```json
{
  "success": true,
  "data": {
    "shopId": "582e19b1-49fc-4f7f-b852-54dd54f56a7f",
    "shopName": "아름다운 네일샵",
    "operating_hours": {
      "monday": {
        "open": "10:00",
        "close": "19:00",
        "break_start": "12:30",
        "break_end": "13:30",
        "closed": false
      },
      "tuesday": {
        "open": "10:00",
        "close": "19:00",
        "break_start": "12:30",
        "break_end": "13:30",
        "closed": false
      }
    },
    "current_status": {
      "is_open": false,
      "current_day": "monday",
      "current_time": "13:00",
      "next_opening": "Today at 13:30"
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

**심야 영업 예시:**

```json
{
  "success": true,
  "data": {
    "shopId": "582e19b1-49fc-4f7f-b852-54dd54f56a7f",
    "shopName": "24시 뷰티샵",
    "operating_hours": {
      "friday": {
        "open": "22:00",
        "close": "02:00",
        "closed": false
      },
      "saturday": {
        "open": "22:00",
        "close": "04:00",
        "closed": false
      }
    },
    "current_status": {
      "is_open": true,
      "current_day": "friday",
      "current_time": "23:30"
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

#### 에러 응답

**400 Bad Request** - shopId 누락

```json
{
  "success": false,
  "error": {
    "code": "MISSING_SHOP_ID",
    "message": "샵 ID가 필요합니다."
  }
}
```

**401 Unauthorized** - 인증 실패

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": "관리자 권한으로 로그인해주세요."
  }
}
```

**403 Forbidden** - 관리자 권한 없음

```json
{
  "success": false,
  "error": {
    "code": "FORBIDDEN",
    "message": "접근 권한이 없습니다.",
    "details": "관리자만 접근할 수 있습니다."
  }
}
```

**404 Not Found** - 샵을 찾을 수 없음

```json
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "샵을 찾을 수 없습니다.",
    "details": "요청하신 샵이 존재하지 않거나 삭제되었습니다."
  }
}
```

**429 Too Many Requests** - Rate Limit 초과

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청이 너무 많습니다. 15분 후에 다시 시도해주세요.",
    "timestamp": "2025-01-16T12:34:56.789Z"
  }
}
```

**500 Internal Server Error** - 서버 오류

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "영업시간 조회 중 오류가 발생했습니다.",
    "details": "잠시 후 다시 시도해주세요."
  }
}
```

---

## 샵 오너 API

### GET /api/shop/operating-hours

자신의 샵 영업시간 스케줄과 실시간 영업 상태를 조회합니다.

#### 요청

```http
GET /api/shop/operating-hours
Authorization: Bearer <SHOP_OWNER_JWT_TOKEN>
```

#### 응답 (200 OK)

**영업시간이 설정된 경우:**

```json
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "tuesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "wednesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "thursday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "friday": {
        "open": "09:00",
        "close": "20:00",
        "closed": false
      },
      "saturday": {
        "open": "10:00",
        "close": "17:00",
        "closed": false
      },
      "sunday": {
        "closed": true
      }
    },
    "current_status": {
      "is_open": true,
      "current_day": "monday",
      "current_time": "14:30"
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

**영업시간이 설정되지 않은 경우 (기본 템플릿 반환):**

```json
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": { "open": "09:00", "close": "18:00", "closed": false },
      "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
      "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
      "thursday": { "open": "09:00", "close": "18:00", "closed": false },
      "friday": { "open": "09:00", "close": "18:00", "closed": false },
      "saturday": { "open": "10:00", "close": "17:00", "closed": false },
      "sunday": { "closed": true }
    },
    "current_status": {
      "is_open": false,
      "current_day": "monday",
      "current_time": "08:00",
      "next_opening": "Today at 09:00"
    }
  },
  "message": "영업시간을 성공적으로 조회했습니다."
}
```

#### 에러 응답

**401 Unauthorized** - 인증 실패

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": "로그인 후 다시 시도해주세요."
  }
}
```

**404 Not Found** - 샵을 찾을 수 없음

```json
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "등록된 샵이 없습니다.",
    "details": "샵 등록을 먼저 완료해주세요."
  }
}
```

**500 Internal Server Error** - 서버 오류

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "영업시간 조회 중 오류가 발생했습니다.",
    "details": "잠시 후 다시 시도해주세요."
  }
}
```

---

### PUT /api/shop/operating-hours

자신의 샵 영업시간을 생성하거나 수정합니다.

#### 요청

```http
PUT /api/shop/operating-hours
Authorization: Bearer <SHOP_OWNER_JWT_TOKEN>
Content-Type: application/json

{
  "operating_hours": {
    "monday": {
      "open": "09:00",
      "close": "18:00",
      "closed": false
    },
    "tuesday": {
      "open": "09:00",
      "close": "18:00",
      "closed": false
    },
    "wednesday": {
      "open": "09:00",
      "close": "18:00",
      "closed": false
    },
    "thursday": {
      "open": "09:00",
      "close": "18:00",
      "closed": false
    },
    "friday": {
      "open": "09:00",
      "close": "20:00",
      "closed": false
    },
    "saturday": {
      "open": "10:00",
      "close": "17:00",
      "closed": false
    },
    "sunday": {
      "closed": true
    }
  }
}
```

#### 요청 Body 스키마

```typescript
{
  operating_hours: {
    monday?: DayOperatingHours;
    tuesday?: DayOperatingHours;
    wednesday?: DayOperatingHours;
    thursday?: DayOperatingHours;
    friday?: DayOperatingHours;
    saturday?: DayOperatingHours;
    sunday?: DayOperatingHours;
  }
}
```

**주요 특징:**
- **부분 업데이트 지원**: 수정하려는 요일만 전송 가능
- **기존 데이터 병합**: 전송하지 않은 요일은 기존 데이터 유지
- **완전 교체**: 전체 영업시간을 새로 설정하려면 모든 요일 전송

#### 비즈니스 규칙

| 규칙 | 설명 |
|------|------|
| 시간 형식 | HH:MM (24시간 형식, 예: "09:00", "18:00") |
| 시작/종료 시간 | open < close (심야 영업 제외) |
| 휴게시간 | break_start와 break_end 둘 다 설정하거나 둘 다 생략 |
| 휴게시간 위치 | 영업시간 내에 있어야 함 |
| 심야 영업 | 22:00 - 02:00 같은 형식 지원 |
| 최소 영업 시간 | 30분 |
| 최대 영업 시간 | 18시간 |
| 휴게시간 범위 | 15분 ~ 3시간 |

#### 응답 (200 OK)

**성공 응답:**

```json
{
  "success": true,
  "data": {
    "operating_hours": {
      "monday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "tuesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "wednesday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "thursday": {
        "open": "09:00",
        "close": "18:00",
        "closed": false
      },
      "friday": {
        "open": "09:00",
        "close": "20:00",
        "closed": false
      },
      "saturday": {
        "open": "10:00",
        "close": "17:00",
        "closed": false
      },
      "sunday": {
        "closed": true
      }
    },
    "current_status": {
      "is_open": true,
      "current_day": "monday",
      "current_time": "14:30"
    }
  },
  "message": "영업시간이 성공적으로 업데이트되었습니다."
}
```

#### 에러 응답

**400 Bad Request** - 유효성 검증 실패

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "영업시간 데이터가 유효하지 않습니다.",
    "details": [
      {
        "field": "monday.open",
        "message": "시간 형식이 올바르지 않습니다. HH:MM 형식을 사용해주세요."
      },
      {
        "field": "tuesday.close",
        "message": "종료 시간은 시작 시간보다 늦어야 합니다."
      }
    ]
  }
}
```

**400 Bad Request** - operating_hours 누락

```json
{
  "success": false,
  "error": {
    "code": "MISSING_OPERATING_HOURS",
    "message": "영업시간 데이터가 필요합니다.",
    "details": "operating_hours 필드를 제공해주세요."
  }
}
```

**400 Bad Request** - 휴게시간 오류

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "영업시간 데이터가 유효하지 않습니다.",
    "details": [
      {
        "field": "monday.break_start",
        "message": "휴게 시간은 시작과 종료 시간을 모두 설정해야 합니다."
      },
      {
        "field": "tuesday.break_start",
        "message": "휴게 시간은 영업시간 내에 있어야 합니다."
      }
    ]
  }
}
```

**401 Unauthorized** - 인증 실패

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "인증이 필요합니다.",
    "details": "로그인 후 다시 시도해주세요."
  }
}
```

**404 Not Found** - 샵을 찾을 수 없음

```json
{
  "success": false,
  "error": {
    "code": "SHOP_NOT_FOUND",
    "message": "등록된 샵이 없습니다.",
    "details": "샵 등록을 먼저 완료해주세요."
  }
}
```

**429 Too Many Requests** - Rate Limit 초과

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청이 너무 많습니다. 5분 후에 다시 시도해주세요.",
    "timestamp": "2025-01-16T12:34:56.789Z"
  }
}
```

**500 Internal Server Error** - 서버 오류

```json
{
  "success": false,
  "error": {
    "code": "INTERNAL_SERVER_ERROR",
    "message": "영업시간 업데이트 중 오류가 발생했습니다.",
    "details": "잠시 후 다시 시도해주세요."
  }
}
```

#### 요청 예시

**표준 영업시간 설정:**

```json
{
  "operating_hours": {
    "monday": { "open": "09:00", "close": "18:00", "closed": false },
    "tuesday": { "open": "09:00", "close": "18:00", "closed": false },
    "wednesday": { "open": "09:00", "close": "18:00", "closed": false },
    "thursday": { "open": "09:00", "close": "18:00", "closed": false },
    "friday": { "open": "09:00", "close": "20:00", "closed": false },
    "saturday": { "open": "10:00", "close": "17:00", "closed": false },
    "sunday": { "closed": true }
  }
}
```

**휴게시간 포함:**

```json
{
  "operating_hours": {
    "monday": {
      "open": "10:00",
      "close": "19:00",
      "break_start": "12:30",
      "break_end": "13:30",
      "closed": false
    },
    "tuesday": {
      "open": "10:00",
      "close": "19:00",
      "break_start": "12:30",
      "break_end": "13:30",
      "closed": false
    }
  }
}
```

**심야 영업:**

```json
{
  "operating_hours": {
    "friday": {
      "open": "22:00",
      "close": "02:00",
      "closed": false
    },
    "saturday": {
      "open": "22:00",
      "close": "04:00",
      "closed": false
    }
  }
}
```

**부분 수정 (금요일, 토요일만):**

```json
{
  "operating_hours": {
    "friday": {
      "open": "09:00",
      "close": "21:00",
      "closed": false
    },
    "saturday": {
      "open": "10:00",
      "close": "22:00",
      "closed": false
    }
  }
}
```

**휴무일 설정:**

```json
{
  "operating_hours": {
    "sunday": { "closed": true },
    "monday": { "closed": true }
  }
}
```

---

## 에러 처리

### 에러 응답 형식

모든 에러는 다음 형식으로 반환됩니다:

```typescript
{
  success: false,
  error: {
    code: string,      // 에러 코드
    message: string,   // 사용자용 메시지 (한국어)
    details?: any      // 추가 상세 정보
  }
}
```

### 주요 에러 코드

| 코드 | HTTP 상태 | 설명 |
|------|-----------|------|
| `MISSING_SHOP_ID` | 400 | shopId 파라미터 누락 |
| `UNAUTHORIZED` | 401 | 인증 토큰 없음 또는 유효하지 않음 |
| `FORBIDDEN` | 403 | 관리자 권한 없음 |
| `SHOP_NOT_FOUND` | 404 | 해당 ID의 샵이 존재하지 않음 |
| `RATE_LIMIT_EXCEEDED` | 429 | 요청 횟수 제한 초과 |
| `INTERNAL_SERVER_ERROR` | 500 | 서버 내부 오류 |

### 에러 처리 권장사항

#### React 에러 처리 예시

```typescript
async function fetchShopOperatingHours(shopId: string, adminToken: string) {
  try {
    const response = await fetch(
      `/api/admin/shops/${shopId}/operating-hours`,
      {
        headers: {
          'Authorization': `Bearer ${adminToken}`
        }
      }
    );

    const data = await response.json();

    if (!response.ok) {
      // 에러 처리
      switch (data.error.code) {
        case 'MISSING_SHOP_ID':
          console.error('샵 ID가 필요합니다.');
          break;
        case 'UNAUTHORIZED':
          console.error('인증이 필요합니다. 다시 로그인해주세요.');
          // 로그인 페이지로 리다이렉트
          window.location.href = '/admin/login';
          break;
        case 'FORBIDDEN':
          console.error('관리자 권한이 필요합니다.');
          break;
        case 'SHOP_NOT_FOUND':
          console.error('샵을 찾을 수 없습니다.');
          break;
        case 'RATE_LIMIT_EXCEEDED':
          console.error('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
          break;
        default:
          console.error('알 수 없는 오류가 발생했습니다.');
      }
      return null;
    }

    // 성공 처리
    return data.data;

  } catch (error) {
    // 네트워크 오류 등
    console.error('네트워크 오류:', error);
    return null;
  }
}
```

---

## 실제 사용 예시

---

## 어드민 사용 예시

### 예시 1: 특정 샵 영업시간 조회 (어드민)

```typescript
// React Component
import { useEffect, useState } from 'react';

interface OperatingHoursData {
  shopId: string;
  shopName: string;
  operating_hours: any;
  current_status: {
    is_open: boolean;
    current_day: string;
    current_time: string;
    next_opening?: string;
  };
}

function ShopOperatingHoursView({ shopId }: { shopId: string }) {
  const [data, setData] = useState<OperatingHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchOperatingHours();
  }, [shopId]);

  const fetchOperatingHours = async () => {
    try {
      const token = localStorage.getItem('adminToken');
      const response = await fetch(
        `/api/admin/shops/${shopId}/operating-hours`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('영업시간을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <div className="operating-hours-view">
      <h2>{data.shopName} 영업시간</h2>

      <div className="current-status">
        {data.current_status.is_open ? (
          <span className="badge-success">✅ 영업 중</span>
        ) : (
          <span className="badge-warning">
            🔒 영업 종료
            {data.current_status.next_opening &&
              ` (다음 영업: ${data.current_status.next_opening})`
            }
          </span>
        )}
      </div>

      <table className="hours-table">
        <thead>
          <tr>
            <th>요일</th>
            <th>영업시간</th>
            <th>휴게시간</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.operating_hours).map(([day, hours]: [string, any]) => (
            <tr key={day}>
              <td>{getDayLabel(day)}</td>
              <td>
                {hours.closed ? (
                  <span className="text-muted">휴무</span>
                ) : (
                  `${hours.open} - ${hours.close}`
                )}
              </td>
              <td>
                {hours.break_start && hours.break_end ? (
                  `${hours.break_start} - ${hours.break_end}`
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getDayLabel(day: string): string {
  const labels: Record<string, string> = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };
  return labels[day] || day;
}
```

### 예시 2: 영업 상태 뱃지 컴포넌트

```typescript
interface CurrentStatus {
  is_open: boolean;
  current_day: string;
  current_time: string;
  next_opening?: string;
}

function OpenStatusBadge({ status }: { status: CurrentStatus }) {
  if (status.is_open) {
    return (
      <div className="status-badge open">
        <span className="icon">✅</span>
        <span className="text">영업 중</span>
        <span className="time">{status.current_time}</span>
      </div>
    );
  }

  return (
    <div className="status-badge closed">
      <span className="icon">🔒</span>
      <span className="text">영업 종료</span>
      {status.next_opening && (
        <span className="next-opening">
          다음 영업: {status.next_opening}
        </span>
      )}
    </div>
  );
}
```

### 예시 3: 샵 목록에서 영업시간 표시

```typescript
function ShopListItem({ shop }: { shop: any }) {
  const [operatingHours, setOperatingHours] = useState<any>(null);

  useEffect(() => {
    fetchShopOperatingHours(shop.id);
  }, [shop.id]);

  const fetchShopOperatingHours = async (shopId: string) => {
    const token = localStorage.getItem('adminToken');
    const response = await fetch(
      `/api/admin/shops/${shopId}/operating-hours`,
      {
        headers: { 'Authorization': `Bearer ${token}` }
      }
    );

    if (response.ok) {
      const data = await response.json();
      setOperatingHours(data.data);
    }
  };

  return (
    <div className="shop-list-item">
      <h3>{shop.name}</h3>
      <p>{shop.address}</p>

      {operatingHours && (
        <div className="quick-status">
          <OpenStatusBadge status={operatingHours.current_status} />
          <span className="today-hours">
            오늘: {getTodayHours(operatingHours)}
          </span>
        </div>
      )}
    </div>
  );
}

function getTodayHours(data: any): string {
  const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const today = dayNames[new Date().getDay()];
  const todayHours = data.operating_hours[today];

  if (!todayHours || todayHours.closed) {
    return '휴무';
  }

  return `${todayHours.open} - ${todayHours.close}`;
}
```

### 예시 4: Axios를 사용한 API 호출

```typescript
import axios from 'axios';

const adminApi = axios.create({
  baseURL: '/api/admin',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
adminApi.interceptors.request.use(
  config => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for error handling
adminApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// API call function
export async function getShopOperatingHours(shopId: string) {
  try {
    const response = await adminApi.get(`/shops/${shopId}/operating-hours`);
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch operating hours:', error);
    throw error;
  }
}

// Usage in component
function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getShopOperatingHours('582e19b1-49fc-4f7f-b852-54dd54f56a7f')
      .then(result => setData(result.data))
      .catch(error => console.error(error));
  }, []);

  // ...
}
```

---

---

## 샵 오너 사용 예시

### 예시 1: 영업시간 조회 (샵 오너)

```typescript
// React Component
import { useEffect, useState } from 'react';

interface OperatingHoursData {
  operating_hours: any;
  current_status: {
    is_open: boolean;
    current_day: string;
    current_time: string;
    next_opening?: string;
  };
}

function ShopOwnerOperatingHoursView() {
  const [data, setData] = useState<OperatingHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMyOperatingHours();
  }, []);

  const fetchMyOperatingHours = async () => {
    try {
      const token = localStorage.getItem('shopOwnerToken');
      const response = await fetch('/api/shop/operating-hours', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      const result = await response.json();

      if (result.success) {
        setData(result.data);
      } else {
        setError(result.error.message);
      }
    } catch (err) {
      setError('영업시간을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>로딩 중...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!data) return null;

  return (
    <div className="shop-hours-view">
      <h2>내 샵 영업시간</h2>

      <div className="current-status">
        {data.current_status.is_open ? (
          <span className="badge-success">✅ 영업 중</span>
        ) : (
          <span className="badge-warning">
            🔒 영업 종료
            {data.current_status.next_opening &&
              ` (다음 영업: ${data.current_status.next_opening})`
            }
          </span>
        )}
      </div>

      <table className="hours-table">
        <thead>
          <tr>
            <th>요일</th>
            <th>영업시간</th>
            <th>휴게시간</th>
          </tr>
        </thead>
        <tbody>
          {Object.entries(data.operating_hours).map(([day, hours]: [string, any]) => (
            <tr key={day}>
              <td>{getDayLabel(day)}</td>
              <td>
                {hours.closed ? (
                  <span className="text-muted">휴무</span>
                ) : (
                  `${hours.open} - ${hours.close}`
                )}
              </td>
              <td>
                {hours.break_start && hours.break_end ? (
                  `${hours.break_start} - ${hours.break_end}`
                ) : (
                  <span className="text-muted">-</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getDayLabel(day: string): string {
  const labels: Record<string, string> = {
    monday: '월요일',
    tuesday: '화요일',
    wednesday: '수요일',
    thursday: '목요일',
    friday: '금요일',
    saturday: '토요일',
    sunday: '일요일'
  };
  return labels[day] || day;
}
```

### 예시 2: 영업시간 수정 (샵 오너)

```typescript
import { useState } from 'react';

interface DayHours {
  open?: string;
  close?: string;
  closed?: boolean;
  break_start?: string;
  break_end?: string;
}

function ShopOperatingHoursEditor() {
  const [operatingHours, setOperatingHours] = useState<Record<string, DayHours>>({
    monday: { open: '09:00', close: '18:00', closed: false },
    tuesday: { open: '09:00', close: '18:00', closed: false },
    wednesday: { open: '09:00', close: '18:00', closed: false },
    thursday: { open: '09:00', close: '18:00', closed: false },
    friday: { open: '09:00', close: '20:00', closed: false },
    saturday: { open: '10:00', close: '17:00', closed: false },
    sunday: { closed: true }
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateOperatingHours = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const token = localStorage.getItem('shopOwnerToken');
      const response = await fetch('/api/shop/operating-hours', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operating_hours: operatingHours })
      });

      const result = await response.json();

      if (result.success) {
        setMessage('영업시간이 성공적으로 업데이트되었습니다.');
      } else {
        setMessage(result.error.message);
      }
    } catch (err) {
      setMessage('영업시간 업데이트 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDayChange = (day: string, field: string, value: string | boolean) => {
    setOperatingHours(prev => ({
      ...prev,
      [day]: {
        ...prev[day],
        [field]: value
      }
    }));
  };

  return (
    <div className="hours-editor">
      <h2>영업시간 설정</h2>

      {Object.entries(operatingHours).map(([day, hours]) => (
        <div key={day} className="day-editor">
          <label>{getDayLabel(day)}</label>

          <input
            type="checkbox"
            checked={hours.closed || false}
            onChange={(e) => handleDayChange(day, 'closed', e.target.checked)}
          />
          <span>휴무</span>

          {!hours.closed && (
            <>
              <input
                type="time"
                value={hours.open || ''}
                onChange={(e) => handleDayChange(day, 'open', e.target.value)}
              />
              <span>~</span>
              <input
                type="time"
                value={hours.close || ''}
                onChange={(e) => handleDayChange(day, 'close', e.target.value)}
              />

              <input
                type="time"
                value={hours.break_start || ''}
                onChange={(e) => handleDayChange(day, 'break_start', e.target.value)}
                placeholder="휴게 시작"
              />
              <span>~</span>
              <input
                type="time"
                value={hours.break_end || ''}
                onChange={(e) => handleDayChange(day, 'break_end', e.target.value)}
                placeholder="휴게 종료"
              />
            </>
          )}
        </div>
      ))}

      <button onClick={updateOperatingHours} disabled={loading}>
        {loading ? '저장 중...' : '영업시간 저장'}
      </button>

      {message && <div className="message">{message}</div>}
    </div>
  );
}
```

### 예시 3: Axios를 사용한 영업시간 관리

```typescript
import axios from 'axios';

const shopApi = axios.create({
  baseURL: '/api/shop',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor to add auth token
shopApi.interceptors.request.use(
  config => {
    const token = localStorage.getItem('shopOwnerToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  error => Promise.reject(error)
);

// Response interceptor for error handling
shopApi.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/shop/login';
    }
    return Promise.reject(error);
  }
);

// API call functions
export async function getMyOperatingHours() {
  try {
    const response = await shopApi.get('/operating-hours');
    return response.data;
  } catch (error: any) {
    console.error('Failed to fetch operating hours:', error);
    throw error;
  }
}

export async function updateMyOperatingHours(operatingHours: any) {
  try {
    const response = await shopApi.put('/operating-hours', {
      operating_hours: operatingHours
    });
    return response.data;
  } catch (error: any) {
    console.error('Failed to update operating hours:', error);
    throw error;
  }
}

// Usage in component
function MyComponent() {
  const [data, setData] = useState(null);

  useEffect(() => {
    getMyOperatingHours()
      .then(result => setData(result.data))
      .catch(error => console.error(error));
  }, []);

  const handleUpdate = async (newHours: any) => {
    try {
      const result = await updateMyOperatingHours(newHours);
      console.log('Updated:', result);
      // Refresh data
      const refreshed = await getMyOperatingHours();
      setData(refreshed.data);
    } catch (error) {
      console.error('Update failed:', error);
    }
  };

  // ...
}
```

### 예시 4: 부분 업데이트 (특정 요일만 수정)

```typescript
async function updateWeekendHours() {
  const token = localStorage.getItem('shopOwnerToken');

  // 금요일과 토요일만 수정
  const response = await fetch('/api/shop/operating-hours', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operating_hours: {
        friday: {
          open: '09:00',
          close: '21:00',
          closed: false
        },
        saturday: {
          open: '10:00',
          close: '22:00',
          closed: false
        }
      }
    })
  });

  const result = await response.json();

  if (result.success) {
    console.log('주말 영업시간 업데이트 완료');
    console.log('전체 영업시간:', result.data.operating_hours);
  }
}
```

### 예시 5: 휴게시간 설정

```typescript
async function setLunchBreak() {
  const token = localStorage.getItem('shopOwnerToken');

  // 평일에 점심시간 설정
  const response = await fetch('/api/shop/operating-hours', {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      operating_hours: {
        monday: {
          open: '10:00',
          close: '19:00',
          break_start: '12:30',
          break_end: '13:30',
          closed: false
        },
        tuesday: {
          open: '10:00',
          close: '19:00',
          break_start: '12:30',
          break_end: '13:30',
          closed: false
        },
        wednesday: {
          open: '10:00',
          close: '19:00',
          break_start: '12:30',
          break_end: '13:30',
          closed: false
        },
        thursday: {
          open: '10:00',
          close: '19:00',
          break_start: '12:30',
          break_end: '13:30',
          closed: false
        },
        friday: {
          open: '10:00',
          close: '20:00',
          closed: false
        }
      }
    })
  });

  const result = await response.json();
  console.log(result);
}
```

---

## 추가 참고사항

### 응답 데이터 특징

1. **샵 정보 포함**: 응답에 `shopId`와 `shopName`이 포함되어 샵 식별이 용이합니다.

2. **기본 템플릿 제공**: 샵이 영업시간을 설정하지 않은 경우, 기본 템플릿이 반환됩니다:
   - 평일(월~금): 09:00 - 18:00
   - 토요일: 10:00 - 17:00
   - 일요일: 휴무

3. **실시간 상태**: `current_status` 필드를 통해 현재 영업 중 여부와 다음 영업 시작 시간을 확인할 수 있습니다.

### 영업 상태 계산 로직

현재 영업 상태는 다음과 같이 결정됩니다:

1. **영업 중 판단**:
   - 오늘 요일의 `closed`가 `true`이면 휴무
   - 현재 시간이 `open`과 `close` 사이에 있으면 영업 중
   - 휴게시간(`break_start` ~ `break_end`) 중이면 영업 종료

2. **심야 영업 지원**:
   - `close` 시간이 `open` 시간보다 작고 12:00 이전이면 심야 영업으로 판단
   - 예: 22:00 - 02:00은 유효한 영업시간

3. **다음 영업 시간 계산**:
   - 영업 종료 상태일 때 다음 영업 시작 시간을 계산
   - 휴게시간 중이면 휴게시간 종료 시간 반환
   - 오늘 영업이 종료되었으면 다음 영업일 찾기

### UI 표시 권장사항

```typescript
// 영업시간 표시 색상 코드
const STATUS_COLORS = {
  open: '#10b981',        // 녹색 - 영업 중
  closed: '#ef4444',      // 빨간색 - 영업 종료
  break: '#f59e0b',       // 주황색 - 휴게시간
  holiday: '#6b7280'      // 회색 - 휴무일
};

// 영업시간 포맷팅
function formatOperatingHours(hours: any): string {
  if (hours.closed) return '휴무';

  let result = `${hours.open} - ${hours.close}`;

  if (hours.break_start && hours.break_end) {
    result += ` (휴게: ${hours.break_start}-${hours.break_end})`;
  }

  return result;
}
```

---

## 문의 및 지원

API 관련 문의사항이나 버그 리포트는 백엔드 팀에 연락해주세요.

**문서 버전**: 2.0.0
**최종 수정일**: 2025-01-16
**작성자**: Backend Development Team

---

## 변경 이력

### 3.0.0 (2025-01-16)
- **Major Update**: 어드민 API와 샵 오너 API 통합 문서로 변경
- 샵 오너 API 추가:
  - `GET /api/shop/operating-hours` - 자신의 샵 영업시간 조회
  - `PUT /api/shop/operating-hours` - 자신의 샵 영업시간 수정
- 샵 오너 API 기능:
  - 부분 업데이트 지원 (특정 요일만 수정 가능)
  - 휴게시간 설정 기능
  - 심야 영업 지원
  - 포괄적인 유효성 검증
- 문서 구조 개선:
  - API 구분 명확화 (어드민 vs 샵 오너)
  - 주요 기능 비교 표 추가
  - 샵 오너 사용 예시 추가

### 2.0.0 (2025-01-16)
- **Breaking Change**: 샵 오너 API에서 어드민 조회 API로 변경
- GET-only 엔드포인트로 수정 (영업시간 수정 불가)
- 응답에 shopId, shopName 필드 추가
- Rate limiting 15분당 100회로 증가
- 기본 템플릿 응답 기능 추가

### 1.0.0 (2025-01-15)
- 초기 버전 (샵 오너 API 문서)
