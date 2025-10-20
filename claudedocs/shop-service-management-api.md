# 샵 오너 서비스 관리 API 문서

> **대상**: 샵 오너 프론트엔드 개발자
> **작성일**: 2025-01-16
> **Base URL**: `https://api.ebeautything.com` (production) / `http://localhost:3001` (development)

## 📌 개요

샵 오너가 자신의 샵에서 제공하는 서비스(네일, 속눈썹, 왁싱 등)를 관리할 수 있는 API입니다.

### 주요 기능
- ✅ 서비스 목록 조회 (필터링, 페이지네이션)
- ✅ 새 서비스 생성
- ✅ 서비스 상세 조회
- ✅ 서비스 정보 수정
- ✅ 서비스 삭제

---

## 🔐 인증

모든 API는 JWT 인증이 필요합니다.

### Request Header
```http
Authorization: Bearer {access_token}
```

### 권한 요구사항
- **샵 오너 권한** 필수
- **본인 샵에 등록된 서비스만** 접근 가능
- 샵이 승인되지 않은 경우 접근 제한될 수 있음

---

## 📡 API 엔드포인트

### 1. 서비스 목록 조회

내 샵의 모든 서비스를 조회합니다.

#### Request
```http
GET /api/shop/services
```

#### Query Parameters
| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `category` | string | No | 서비스 카테고리 필터<br/>`nail` \| `eyelash` \| `waxing` \| `eyebrow_tattoo` \| `hair` | `nail` |
| `is_available` | string | No | 예약 가능 여부 필터<br/>`true` \| `false` | `true` |
| `limit` | integer | No | 한 페이지 결과 수 (1-100)<br/>기본값: `50` | `20` |
| `offset` | integer | No | 건너뛸 결과 수<br/>기본값: `0` | `0` |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "services": [
      {
        "id": "123e4567-e89b-12d3-a456-426614174000",
        "shop_id": "shop-uuid",
        "name": "젤네일",
        "description": "고품질 젤네일 서비스로 2-3주간 지속됩니다",
        "category": "nail",
        "price_min": 30000,
        "price_max": 50000,
        "duration_minutes": 60,
        "deposit_amount": null,
        "deposit_percentage": 20.0,
        "is_available": true,
        "booking_advance_days": 30,
        "cancellation_hours": 24,
        "display_order": 1,
        "created_at": "2024-01-15T10:30:00Z",
        "updated_at": "2024-01-15T10:30:00Z"
      }
    ],
    "totalCount": 15,
    "hasMore": false
  },
  "message": "서비스 목록을 성공적으로 조회했습니다."
}
```

#### Response Fields
| Field | Type | Description |
|-------|------|-------------|
| `services` | array | 서비스 목록 (아래 Service 객체 참조) |
| `totalCount` | integer | 필터 조건에 맞는 전체 서비스 수 |
| `hasMore` | boolean | 다음 페이지 존재 여부 |

#### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | 인증 토큰 없음 또는 만료 |
| 404 | `SHOP_NOT_FOUND` | 등록된 샵이 없음 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 오류 |

#### 예제 코드
```typescript
// React Query 예제
const { data, isLoading } = useQuery({
  queryKey: ['services', { category: 'nail', isAvailable: true }],
  queryFn: async () => {
    const response = await fetch(
      '/api/shop/services?category=nail&is_available=true&limit=20',
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
        },
      }
    );
    if (!response.ok) throw new Error('Failed to fetch services');
    return response.json();
  },
});
```

---

### 2. 새 서비스 생성

새로운 서비스를 등록합니다.

#### Request
```http
POST /api/shop/services
Content-Type: application/json
```

#### Request Body
```json
{
  "name": "젤네일",
  "description": "고품질 젤네일 서비스로 2-3주간 지속됩니다",
  "category": "nail",
  "price_min": 30000,
  "price_max": 50000,
  "duration_minutes": 60,
  "deposit_percentage": 20.0,
  "is_available": true,
  "booking_advance_days": 30,
  "cancellation_hours": 24,
  "display_order": 1
}
```

#### Request Fields
| Field | Type | Required | Constraints | Description |
|-------|------|----------|-------------|-------------|
| `name` | string | ✅ Yes | 1-255자 | 서비스명 |
| `category` | string | ✅ Yes | `nail` \| `eyelash` \| `waxing` \| `eyebrow_tattoo` \| `hair` | 서비스 카테고리 |
| `description` | string | No | 최대 1000자 | 서비스 상세 설명 |
| `price_min` | integer | No | 0 ~ 10,000,000 | 최소 가격 (원) |
| `price_max` | integer | No | 0 ~ 10,000,000 | 최대 가격 (원) |
| `duration_minutes` | integer | No | 1 ~ 480 | 소요 시간 (분) |
| `deposit_amount` | integer | No | 0 ~ 1,000,000 | 고정 예약금 (원)<br/>⚠️ `deposit_percentage`와 배타적 |
| `deposit_percentage` | number | No | 0.0 ~ 100.0 | 예약금 비율 (%)<br/>⚠️ `deposit_amount`와 배타적 |
| `is_available` | boolean | No | 기본값: `true` | 예약 가능 여부 |
| `booking_advance_days` | integer | No | 1 ~ 365<br/>기본값: `30` | 사전 예약 가능 일수 |
| `cancellation_hours` | integer | No | 1 ~ 168<br/>기본값: `24` | 취소 가능 시간 (시간 단위) |
| `display_order` | integer | No | 0 ~ 999<br/>기본값: `0` | 표시 순서 (작을수록 먼저) |

#### 비즈니스 규칙
- ⚠️ `price_min` ≤ `price_max` (설정 시)
- ⚠️ `deposit_amount` 또는 `deposit_percentage` 중 **하나만** 설정 가능
- ⚠️ `duration_minutes`: 최소 1분, 최대 8시간 (480분)
- ⚠️ `booking_advance_days`: 1일 ~ 1년 (365일)
- ⚠️ `cancellation_hours`: 1시간 ~ 7일 (168시간)

#### Response (201 Created)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "shop_id": "shop-uuid",
    "name": "젤네일",
    "description": "고품질 젤네일 서비스로 2-3주간 지속됩니다",
    "category": "nail",
    "price_min": 30000,
    "price_max": 50000,
    "duration_minutes": 60,
    "deposit_amount": null,
    "deposit_percentage": 20.0,
    "is_available": true,
    "booking_advance_days": 30,
    "cancellation_hours": 24,
    "display_order": 1,
    "created_at": "2024-01-16T14:30:00Z",
    "updated_at": "2024-01-16T14:30:00Z"
  },
  "message": "서비스가 성공적으로 생성되었습니다."
}
```

#### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | 입력 데이터 유효성 검증 실패 |
| 400 | `INVALID_PRICE_RANGE` | 최소 가격이 최대 가격보다 큼 |
| 400 | `INVALID_DEPOSIT_SETTINGS` | 예약금 설정 오류 (고정/비율 동시 설정) |
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 404 | `SHOP_NOT_FOUND` | 등록된 샵이 없음 |
| 429 | `RATE_LIMIT_EXCEEDED` | 요청 제한 초과 (5분당 20회) |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 오류 |

#### 예제 코드
```typescript
// React Query Mutation 예제
const createServiceMutation = useMutation({
  mutationFn: async (serviceData: CreateServiceInput) => {
    const response = await fetch('/api/shop/services', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(serviceData),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error.message);
    }

    return response.json();
  },
  onSuccess: (data) => {
    // 서비스 목록 재조회
    queryClient.invalidateQueries({ queryKey: ['services'] });
    toast.success('서비스가 생성되었습니다.');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// 사용 예시
const handleSubmit = (formData) => {
  createServiceMutation.mutate({
    name: formData.name,
    category: formData.category,
    price_min: formData.priceMin,
    price_max: formData.priceMax,
    duration_minutes: formData.duration,
    deposit_percentage: formData.depositPercent,
    // ...
  });
};
```

---

### 3. 서비스 상세 조회

특정 서비스의 상세 정보를 조회합니다.

#### Request
```http
GET /api/shop/services/{serviceId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceId` | string (UUID) | ✅ Yes | 서비스 고유 ID |

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "shop_id": "shop-uuid",
    "name": "젤네일",
    "description": "고품질 젤네일 서비스로 2-3주간 지속됩니다",
    "category": "nail",
    "price_min": 30000,
    "price_max": 50000,
    "duration_minutes": 60,
    "deposit_amount": null,
    "deposit_percentage": 20.0,
    "is_available": true,
    "booking_advance_days": 30,
    "cancellation_hours": 24,
    "display_order": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-16T14:30:00Z"
  },
  "message": "서비스 정보를 성공적으로 조회했습니다."
}
```

#### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 404 | `SERVICE_NOT_FOUND` | 서비스를 찾을 수 없거나 접근 권한 없음 |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 오류 |

---

### 4. 서비스 수정

기존 서비스의 정보를 수정합니다.

#### Request
```http
PUT /api/shop/services/{serviceId}
Content-Type: application/json
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceId` | string (UUID) | ✅ Yes | 서비스 고유 ID |

#### Request Body
**⚠️ 부분 업데이트 지원**: 수정할 필드만 전송하면 됩니다.

```json
{
  "price_min": 35000,
  "price_max": 60000,
  "is_available": false
}
```

#### Request Fields
생성 API와 동일한 필드를 사용하되, **모든 필드가 선택사항**입니다.

#### Response (200 OK)
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "shop_id": "shop-uuid",
    "name": "젤네일",
    "description": "고품질 젤네일 서비스로 2-3주간 지속됩니다",
    "category": "nail",
    "price_min": 35000,
    "price_max": 60000,
    "duration_minutes": 60,
    "deposit_amount": null,
    "deposit_percentage": 20.0,
    "is_available": false,
    "booking_advance_days": 30,
    "cancellation_hours": 24,
    "display_order": 1,
    "created_at": "2024-01-15T10:30:00Z",
    "updated_at": "2024-01-16T15:45:00Z"
  },
  "message": "서비스가 성공적으로 업데이트되었습니다."
}
```

#### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 400 | `VALIDATION_ERROR` | 입력 데이터 유효성 검증 실패 |
| 400 | `INVALID_PRICE_RANGE` | 가격 범위 오류 |
| 400 | `INVALID_DEPOSIT_SETTINGS` | 예약금 설정 오류 |
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 404 | `SERVICE_NOT_FOUND` | 서비스를 찾을 수 없거나 접근 권한 없음 |
| 429 | `RATE_LIMIT_EXCEEDED` | 요청 제한 초과 (5분당 20회) |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 오류 |

#### 예제 코드
```typescript
// 가격만 업데이트
const updateServiceMutation = useMutation({
  mutationFn: async ({ id, updates }: { id: string; updates: Partial<Service> }) => {
    const response = await fetch(`/api/shop/services/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    });

    if (!response.ok) throw new Error('Update failed');
    return response.json();
  },
});

// 사용 예시 - 가격만 변경
updateServiceMutation.mutate({
  id: serviceId,
  updates: {
    price_min: 35000,
    price_max: 60000,
  },
});

// 사용 예시 - 서비스 비활성화
updateServiceMutation.mutate({
  id: serviceId,
  updates: {
    is_available: false,
  },
});
```

---

### 5. 서비스 삭제

서비스를 삭제합니다.

#### Request
```http
DELETE /api/shop/services/{serviceId}
```

#### Path Parameters
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `serviceId` | string (UUID) | ✅ Yes | 서비스 고유 ID |

#### ⚠️ 중요 제약사항
- **예약이 있는 서비스는 삭제할 수 없습니다** (409 Conflict 반환)
- 삭제는 **영구적**이며 복구할 수 없습니다
- 예약이 있는 경우 대신 `is_available: false`로 비활성화를 권장합니다

#### Response (200 OK)
```json
{
  "success": true,
  "message": "서비스가 성공적으로 삭제되었습니다."
}
```

#### Error Responses
| Status | Code | Description |
|--------|------|-------------|
| 401 | `UNAUTHORIZED` | 인증 실패 |
| 404 | `SERVICE_NOT_FOUND` | 서비스를 찾을 수 없거나 접근 권한 없음 |
| 409 | `SERVICE_HAS_RESERVATIONS` | 예약이 있어 삭제 불가 |
| 429 | `RATE_LIMIT_EXCEEDED` | 요청 제한 초과 (5분당 20회) |
| 500 | `INTERNAL_SERVER_ERROR` | 서버 오류 |

#### 예제 코드
```typescript
const deleteServiceMutation = useMutation({
  mutationFn: async (serviceId: string) => {
    const response = await fetch(`/api/shop/services/${serviceId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      const error = await response.json();

      // 예약이 있는 경우 특별 처리
      if (error.error.code === 'SERVICE_HAS_RESERVATIONS') {
        throw new Error('예약이 있는 서비스는 삭제할 수 없습니다. 서비스를 비활성화해주세요.');
      }

      throw new Error(error.error.message);
    }

    return response.json();
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['services'] });
    toast.success('서비스가 삭제되었습니다.');
  },
  onError: (error) => {
    toast.error(error.message);
  },
});

// 삭제 전 확인 다이얼로그와 함께 사용
const handleDelete = async (serviceId: string) => {
  const confirmed = await confirm({
    title: '서비스 삭제',
    message: '정말로 이 서비스를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.',
    confirmText: '삭제',
    cancelText: '취소',
  });

  if (confirmed) {
    deleteServiceMutation.mutate(serviceId);
  }
};
```

---

## 📊 Service 객체 스키마

### Service Object
```typescript
interface Service {
  id: string;                      // UUID
  shop_id: string;                 // 샵 UUID
  name: string;                    // 서비스명
  description: string | null;      // 상세 설명
  category: ServiceCategory;       // 서비스 카테고리
  price_min: number | null;        // 최소 가격 (원)
  price_max: number | null;        // 최대 가격 (원)
  duration_minutes: number | null; // 소요 시간 (분)
  deposit_amount: number | null;   // 고정 예약금 (원)
  deposit_percentage: number | null; // 예약금 비율 (%)
  is_available: boolean;           // 예약 가능 여부
  booking_advance_days: number;    // 사전 예약 가능 일수
  cancellation_hours: number;      // 취소 가능 시간
  display_order: number;           // 표시 순서
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
}

type ServiceCategory =
  | 'nail'            // 네일
  | 'eyelash'         // 속눈썹
  | 'waxing'          // 왁싱
  | 'eyebrow_tattoo'  // 눈썹 문신
  | 'hair';           // 헤어
```

---

## 🚦 Rate Limiting

### 조회 API (GET)
- **제한**: 15분당 100회
- **적용 대상**:
  - `GET /api/shop/services`
  - `GET /api/shop/services/:id`

### 수정 API (POST/PUT/DELETE)
- **제한**: 5분당 20회
- **적용 대상**:
  - `POST /api/shop/services`
  - `PUT /api/shop/services/:id`
  - `DELETE /api/shop/services/:id`

### Rate Limit 초과 시
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "요청 제한을 초과했습니다.",
    "details": "잠시 후 다시 시도해주세요."
  }
}
```

**Status Code**: `429 Too Many Requests`

---

## 🔥 실전 사용 예시

### 1. 서비스 관리 페이지 구현

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

function ServiceManagementPage() {
  const queryClient = useQueryClient();

  // 서비스 목록 조회
  const { data: servicesData, isLoading } = useQuery({
    queryKey: ['services'],
    queryFn: fetchServices,
  });

  // 서비스 생성
  const createMutation = useMutation({
    mutationFn: createService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  // 서비스 수정
  const updateMutation = useMutation({
    mutationFn: ({ id, updates }) => updateService(id, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });

  // 서비스 삭제
  const deleteMutation = useMutation({
    mutationFn: deleteService,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
    onError: (error: Error) => {
      if (error.message.includes('예약')) {
        alert('예약이 있는 서비스는 삭제할 수 없습니다. 대신 비활성화를 사용하세요.');
      }
    },
  });

  return (
    <div>
      <ServiceList
        services={servicesData?.data.services}
        onEdit={(id, updates) => updateMutation.mutate({ id, updates })}
        onDelete={(id) => deleteMutation.mutate(id)}
      />
      <CreateServiceForm onSubmit={createMutation.mutate} />
    </div>
  );
}
```

### 2. 서비스 토글 (활성화/비활성화)

```typescript
function ServiceToggle({ service }: { service: Service }) {
  const updateMutation = useMutation({
    mutationFn: (isAvailable: boolean) =>
      updateService(service.id, { is_available: isAvailable }),
  });

  return (
    <Switch
      checked={service.is_available}
      onChange={(checked) => updateMutation.mutate(checked)}
      label={service.is_available ? '예약 가능' : '예약 불가'}
    />
  );
}
```

### 3. 카테고리별 필터링

```typescript
function ServiceFilter() {
  const [category, setCategory] = useState<ServiceCategory | null>(null);

  const { data } = useQuery({
    queryKey: ['services', { category }],
    queryFn: () => fetchServices({ category: category ?? undefined }),
  });

  return (
    <div>
      <select onChange={(e) => setCategory(e.target.value as ServiceCategory)}>
        <option value="">전체</option>
        <option value="nail">네일</option>
        <option value="eyelash">속눈썹</option>
        <option value="waxing">왁싱</option>
        <option value="eyebrow_tattoo">눈썹 문신</option>
        <option value="hair">헤어</option>
      </select>

      <ServiceList services={data?.data.services} />
    </div>
  );
}
```

### 4. 예약금 설정 UI

```typescript
function DepositSettings({ form }: { form: UseFormReturn }) {
  const [depositType, setDepositType] = useState<'amount' | 'percentage'>('percentage');

  return (
    <div>
      <RadioGroup value={depositType} onChange={setDepositType}>
        <Radio value="amount">고정 금액</Radio>
        <Radio value="percentage">비율 (%)</Radio>
      </RadioGroup>

      {depositType === 'amount' ? (
        <Input
          type="number"
          placeholder="예약금 (원)"
          {...form.register('deposit_amount')}
          onChange={(e) => {
            form.setValue('deposit_percentage', null); // 배타적 설정
          }}
        />
      ) : (
        <Input
          type="number"
          placeholder="예약금 비율 (%)"
          {...form.register('deposit_percentage')}
          onChange={(e) => {
            form.setValue('deposit_amount', null); // 배타적 설정
          }}
        />
      )}
    </div>
  );
}
```

---

## ⚠️ 주의사항

### 1. 예약금 설정
- `deposit_amount`(고정 금액)와 `deposit_percentage`(비율)는 **배타적**입니다
- 둘 다 설정하면 `400 INVALID_DEPOSIT_SETTINGS` 에러 발생
- UI에서 하나를 선택하면 다른 하나는 자동으로 `null`로 설정

### 2. 서비스 삭제
- 예약이 있는 서비스는 삭제 불가
- 삭제 전 예약 여부 확인 또는 `409` 에러 처리 필수
- 대안: `is_available: false`로 비활성화

### 3. 가격 범위
- `price_min`만 설정 가능 (단일 가격)
- `price_min`과 `price_max` 모두 설정 가능 (범위)
- `price_min` > `price_max`인 경우 검증 실패

### 4. 실시간 업데이트
- 서비스 목록은 실시간으로 변경될 수 있음
- Mutation 성공 후 `invalidateQueries`로 목록 재조회 권장
- WebSocket 또는 Polling으로 실시간 동기화 고려

### 5. 에러 처리
모든 API는 일관된 에러 형식을 반환합니다:
```typescript
interface ErrorResponse {
  success: false;
  error: {
    code: string;      // 에러 코드 (상수, 프로그래밍 처리용)
    message: string;   // 사용자 친화적 에러 메시지
    details?: any;     // 추가 상세 정보
  };
}
```

---

## 📚 TypeScript 타입 정의

```typescript
// API Response Types
interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
}

// Service List Response
interface ServiceListResponse {
  services: Service[];
  totalCount: number;
  hasMore: boolean;
}

// Service Category
type ServiceCategory = 'nail' | 'eyelash' | 'waxing' | 'eyebrow_tattoo' | 'hair';

// Service Object
interface Service {
  id: string;
  shop_id: string;
  name: string;
  description: string | null;
  category: ServiceCategory;
  price_min: number | null;
  price_max: number | null;
  duration_minutes: number | null;
  deposit_amount: number | null;
  deposit_percentage: number | null;
  is_available: boolean;
  booking_advance_days: number;
  cancellation_hours: number;
  display_order: number;
  created_at: string;
  updated_at: string;
}

// Create Service Input
interface CreateServiceInput {
  name: string;
  category: ServiceCategory;
  description?: string;
  price_min?: number;
  price_max?: number;
  duration_minutes?: number;
  deposit_amount?: number;
  deposit_percentage?: number;
  is_available?: boolean;
  booking_advance_days?: number;
  cancellation_hours?: number;
  display_order?: number;
}

// Update Service Input (모든 필드 선택사항)
type UpdateServiceInput = Partial<CreateServiceInput>;

// Service List Query Parameters
interface ServiceListParams {
  category?: ServiceCategory;
  is_available?: boolean;
  limit?: number;
  offset?: number;
}
```

---

## 🧪 테스트 데이터

개발 환경에서 테스트할 때 사용할 수 있는 샘플 데이터입니다.

### 기본 서비스
```json
{
  "name": "기본 젤네일",
  "category": "nail",
  "price_min": 30000,
  "price_max": 50000,
  "duration_minutes": 60
}
```

### 프리미엄 서비스
```json
{
  "name": "프리미엄 속눈썹 연장",
  "description": "고급 밍크 속눈썹 연장 서비스입니다. 자연스럽고 오래 지속됩니다.",
  "category": "eyelash",
  "price_min": 80000,
  "price_max": 120000,
  "duration_minutes": 120,
  "deposit_percentage": 30.0,
  "booking_advance_days": 14,
  "cancellation_hours": 48,
  "display_order": 1
}
```

### 할인 서비스
```json
{
  "name": "왁싱 특가",
  "description": "이번 달 한정 특가 상품입니다.",
  "category": "waxing",
  "price_min": 20000,
  "duration_minutes": 30,
  "deposit_amount": 10000,
  "is_available": true,
  "display_order": 0
}
```

---

## 🔗 관련 문서

- [인증 API 문서](./authentication-api.md)
- [샵 관리 API 문서](./shop-management-api.md)
- [예약 관리 API 문서](./reservation-api.md)
- [Swagger UI](http://localhost:3001/api-docs) (개발 환경)

---

## 📞 문의

API 관련 문의사항이나 버그 리포트:
- 백엔드 팀 Slack: `#backend-support`
- 이슈 트래커: [GitHub Issues](https://github.com/your-org/backend/issues)

---

**문서 버전**: 1.0.0
**최종 수정**: 2025-01-16
