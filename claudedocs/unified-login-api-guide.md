# 통합 로그인 시스템 API 가이드

프론트엔드 개발자를 위한 통합 인증 시스템 API 문서

## 📌 기본 정보

### Base URL
```
http://localhost:3001/api/auth
```

### 지원 역할
- `admin` - 플랫폼 관리자
- `shop_owner` - 샵 소유자
- `user` - 일반 사용자 (고객)

### 인증 방식
- Bearer Token (JWT)
- Access Token (짧은 수명) + Refresh Token (긴 수명)

---

## 🔐 1. 로그인 (Login)

모든 역할의 사용자를 위한 통합 로그인 엔드포인트입니다.

### Endpoint
```http
POST /api/auth/login
```

### Rate Limit
- **5회 시도 / 15분**
- 초과 시 15분간 차단

### Request Body
```typescript
{
  email: string;           // Required - 사용자 이메일
  password: string;        // Required - 비밀번호
  role: 'admin' | 'shop_owner' | 'user';  // Required - 역할
  device_id?: string;      // Optional - 디바이스 식별자
  device_name?: string;    // Optional - 디바이스 이름 (예: "iPhone 13")
}
```

### Response (200 OK)
```typescript
{
  success: true,
  user: {
    id: string;
    email: string;
    role: 'admin' | 'shop_owner' | 'user';
    shop_id?: string;        // shop_owner인 경우 필수
    full_name?: string;
    phone?: string;
    avatar_url?: string;
    is_active: boolean;
    email_verified: boolean;
    last_login_at?: string;  // ISO 8601 format
  },
  session: {
    id: string;
    expires_at: string;      // ISO 8601 format
    refresh_expires_at?: string;
  },
  token: string;             // Access Token (JWT)
  refresh_token?: string;    // Refresh Token
  permissions?: string[];    // 권한 목록
}
```

### Error Responses

#### 400 Bad Request - 유효성 검증 실패
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Valid email is required"
      }
    ]
  }
}
```

#### 401 Unauthorized - 인증 실패
```json
{
  "success": false,
  "error": {
    "code": "INVALID_CREDENTIALS",
    "message": "Invalid credentials"
  }
}
```

#### 403 Forbidden - 계정 잠김
```json
{
  "success": false,
  "error": {
    "code": "ACCOUNT_LOCKED",
    "message": "Account is locked. Please try again later."
  }
}
```

#### 429 Too Many Requests - Rate Limit 초과
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many login attempts. Please try again later."
  }
}
```

### 예제 코드

#### JavaScript/TypeScript
```typescript
async function login(email: string, password: string, role: string) {
  const response = await fetch('http://localhost:3001/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email,
      password,
      role,
      device_id: 'web-app-' + Date.now(),
      device_name: navigator.userAgent
    })
  });

  const data = await response.json();

  if (data.success) {
    // 토큰 저장
    localStorage.setItem('access_token', data.token);
    localStorage.setItem('refresh_token', data.refresh_token);
    localStorage.setItem('user', JSON.stringify(data.user));

    return data;
  } else {
    throw new Error(data.error.message);
  }
}

// 사용 예시
try {
  const result = await login('admin@example.com', 'password123', 'admin');
  console.log('로그인 성공:', result.user);
} catch (error) {
  console.error('로그인 실패:', error.message);
}
```

---

## 🔄 2. 토큰 갱신 (Refresh Token)

Access Token이 만료되었을 때 Refresh Token을 사용하여 새 토큰을 발급받습니다.

### Endpoint
```http
POST /api/auth/refresh
```

### Request Body
```typescript
{
  refreshToken: string;  // Required - Refresh Token
}
```

### Response (200 OK)
```typescript
{
  success: true,
  token: string;         // 새로운 Access Token
  expires_at: string;    // ISO 8601 format
}
```

### 예제 코드
```typescript
async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refresh_token');

  const response = await fetch('http://localhost:3001/api/auth/refresh', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ refreshToken })
  });

  const data = await response.json();

  if (data.success) {
    localStorage.setItem('access_token', data.token);
    return data.token;
  } else {
    // Refresh Token도 만료됨 - 재로그인 필요
    localStorage.clear();
    window.location.href = '/login';
  }
}
```

---

## ✅ 3. 세션 검증 (Validate Session)

현재 토큰이 유효한지 확인합니다.

### Endpoint
```http
GET /api/auth/validate
```

### Headers
```
Authorization: Bearer {access_token}
```

### Response (200 OK)
```typescript
{
  valid: boolean;
  session?: {
    id: string;
    expires_at: string;
    last_activity_at: string;
  };
  user?: {
    id: string;
    email: string;
    role: string;
    // ... other user fields
  };
}
```

### 예제 코드
```typescript
async function validateSession() {
  const token = localStorage.getItem('access_token');

  const response = await fetch('http://localhost:3001/api/auth/validate', {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`
    }
  });

  const data = await response.json();
  return data.valid;
}
```

---

## 🚪 4. 로그아웃 (Logout)

현재 디바이스에서 로그아웃합니다.

### Endpoint
```http
POST /api/auth/logout
```

### Headers
```
Authorization: Bearer {access_token}
```

### Request Body (Optional)
```typescript
{
  reason?: string;  // 로그아웃 사유 (예: "user_requested")
}
```

### Response (200 OK)
```typescript
{
  success: true,
  message: "Successfully logged out"
}
```

### 예제 코드
```typescript
async function logout() {
  const token = localStorage.getItem('access_token');

  await fetch('http://localhost:3001/api/auth/logout', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      reason: 'user_requested'
    })
  });

  // 로컬 스토리지 정리
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user');

  window.location.href = '/login';
}
```

---

## 🚪🚪 5. 전체 로그아웃 (Logout All Devices)

모든 디바이스에서 로그아웃합니다.

### Endpoint
```http
POST /api/auth/logout-all
```

### Headers
```
Authorization: Bearer {access_token}
```

### Request Body (Optional)
```typescript
{
  reason?: string;  // 로그아웃 사유
}
```

### Response (200 OK)
```typescript
{
  success: true,
  message: "Successfully logged out from all devices",
  sessions_revoked: number  // 로그아웃된 세션 수
}
```

---

## 🔑 6. 비밀번호 변경 (Change Password)

사용자 비밀번호를 변경합니다.

### Endpoint
```http
POST /api/auth/change-password
```

### Headers
```
Authorization: Bearer {access_token}
```

### Request Body
```typescript
{
  currentPassword: string;  // Required - 현재 비밀번호
  newPassword: string;      // Required - 새 비밀번호 (최소 8자)
}
```

### Response (200 OK)
```typescript
{
  success: true,
  message: "Password changed successfully"
}
```

### 예제 코드
```typescript
async function changePassword(currentPassword: string, newPassword: string) {
  const token = localStorage.getItem('access_token');

  const response = await fetch('http://localhost:3001/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      currentPassword,
      newPassword
    })
  });

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.error.message);
  }

  return data;
}
```

---

## 📱 7. 활성 세션 조회 (Get Active Sessions)

사용자의 모든 활성 세션을 조회합니다.

### Endpoint
```http
GET /api/auth/sessions
```

### Headers
```
Authorization: Bearer {access_token}
```

### Response (200 OK)
```typescript
{
  success: true,
  sessions: [
    {
      id: string;
      device_name?: string;
      device_id?: string;
      ip_address?: string;
      user_agent?: string;
      last_activity_at: string;
      created_at: string;
      expires_at: string;
      is_current: boolean;  // 현재 세션 여부
    }
  ]
}
```

---

## 📊 8. 로그인 통계 (Login Statistics)

사용자의 로그인 시도 통계를 조회합니다.

### Endpoint
```http
GET /api/auth/login-statistics
```

### Headers
```
Authorization: Bearer {access_token}
```

### Response (200 OK)
```typescript
{
  success: true,
  statistics: {
    total_attempts: number;
    successful_attempts: number;
    failed_attempts: number;
    blocked_attempts: number;
    last_success_at?: string;
    last_failure_at?: string;
  }
}
```

---

## 🔒 9. 보안 로그 (Security Logs)

사용자의 보안 이벤트 로그를 조회합니다.

### Endpoint
```http
GET /api/auth/security-logs?limit=50
```

### Headers
```
Authorization: Bearer {access_token}
```

### Query Parameters
- `limit` (optional): 조회할 로그 개수 (기본값: 50)

### Response (200 OK)
```typescript
{
  success: true,
  logs: [
    {
      id: string;
      event_type: string;        // 예: "login_success", "password_changed"
      event_category: string;    // 예: "authentication", "account"
      severity: string;          // "info", "warning", "critical"
      description: string;
      ip_address?: string;
      user_agent?: string;
      device_id?: string;
      created_at: string;
    }
  ]
}
```

---

## 🛡️ 보안 모범 사례

### 1. 토큰 저장
```typescript
// ✅ 권장: HttpOnly 쿠키 (서버에서 설정)
// 또는 localStorage (XSS 주의)
localStorage.setItem('access_token', token);

// ❌ 비권장: sessionStorage (탭 닫으면 사라짐)
```

### 2. 자동 토큰 갱신
```typescript
// Access Token 만료 5분 전 자동 갱신
setInterval(async () => {
  const tokenExpiry = getTokenExpiry(); // JWT 디코드하여 exp 확인
  const now = Date.now() / 1000;

  if (tokenExpiry - now < 300) { // 5분 이내 만료
    await refreshAccessToken();
  }
}, 60000); // 1분마다 체크
```

### 3. 401 에러 처리
```typescript
// Axios 인터셉터 예시
axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      try {
        const newToken = await refreshAccessToken();
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return axios.request(error.config);
      } catch (refreshError) {
        // Refresh 실패 - 로그인 페이지로
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
```

### 4. API 호출 헬퍼 함수
```typescript
async function apiCall(url: string, options: RequestInit = {}) {
  const token = localStorage.getItem('access_token');

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    }
  });

  // 401 에러 처리
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // 재시도
      return apiCall(url, options);
    } else {
      window.location.href = '/login';
      return;
    }
  }

  return response.json();
}
```

---

## 📱 10. SNS 소셜 로그인 (Social Login)

일반 사용자(`user`)는 소셜 로그인을 사용할 수 있습니다.

### 지원 Provider
- ✅ **Google** - Google OAuth 2.0
- ✅ **Kakao** - 카카오 로그인
- ✅ **Apple** - Sign in with Apple

### 인증 Flow

**SNS 로그인은 Supabase Auth를 통해 처리됩니다:**

```typescript
// 1. 프론트엔드에서 Supabase SDK 사용
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'YOUR_SUPABASE_URL',
  'YOUR_SUPABASE_ANON_KEY'
);

// 2. Google 로그인
async function loginWithGoogle() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: window.location.origin + '/auth/callback'
    }
  });
}

// 3. Kakao 로그인
async function loginWithKakao() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'kakao',
    options: {
      redirectTo: window.location.origin + '/auth/callback'
    }
  });
}

// 4. Apple 로그인
async function loginWithApple() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'apple',
    options: {
      redirectTo: window.location.origin + '/auth/callback'
    }
  });
}
```

### 콜백 처리

```typescript
// /auth/callback 페이지에서
async function handleAuthCallback() {
  // URL에서 Supabase 세션 정보 추출
  const { data: { session }, error } = await supabase.auth.getSession();

  if (error) {
    console.error('Auth callback error:', error);
    window.location.href = '/login?error=auth_failed';
    return;
  }

  if (session) {
    // 세션 정보를 저장하고 대시보드로 이동
    localStorage.setItem('supabase_session', JSON.stringify(session));

    // 사용자 정보 가져오기
    const { data: user } = await supabase.auth.getUser();

    console.log('Logged in user:', user);
    window.location.href = '/dashboard';
  }
}
```

### 자동 사용자 생성

**SNS 로그인 시 자동으로 처리되는 사항:**
- ✅ 신규 사용자는 자동으로 `user_role = 'user'`로 생성
- ✅ 사용자 프로필 정보 자동 매핑 (이름, 이메일, 프로필 사진)
- ✅ 이메일 자동 인증 완료
- ✅ `user_status = 'active'` 설정

### 기존 계정과 연결

```typescript
// 이미 이메일/비밀번호로 가입한 사용자가 SNS로 로그인하면
// Supabase가 자동으로 같은 이메일을 기준으로 계정 연결
```

### 주의사항

1. **역할 제한**: SNS 로그인은 **user 역할만** 사용 가능
   - Admin, Shop Owner는 이메일/비밀번호 로그인 필수

2. **Supabase 설정 필요**:
   - Supabase Dashboard에서 각 Provider 활성화 필요
   - OAuth Credentials 설정 필요 (Client ID, Client Secret)

3. **리다이렉트 URL**:
   - Supabase Dashboard에서 허용된 리다이렉트 URL 등록 필요
   - 개발: `http://localhost:3000/auth/callback`
   - 프로덕션: `https://yourdomain.com/auth/callback`

### 전체 예제 (React)

```tsx
import { createClient } from '@supabase/supabase-js';
import { useEffect } from 'react';

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL!,
  process.env.REACT_APP_SUPABASE_ANON_KEY!
);

function LoginPage() {
  useEffect(() => {
    // 기존 세션 확인
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        window.location.href = '/dashboard';
      }
    });

    // Auth 상태 변화 감지
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) {
        window.location.href = '/dashboard';
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return (
    <div>
      <h1>로그인</h1>

      {/* 이메일/비밀번호 로그인 */}
      <form onSubmit={handleEmailLogin}>
        <input type="email" name="email" />
        <input type="password" name="password" />
        <select name="role">
          <option value="user">일반 사용자</option>
          <option value="shop_owner">샵 소유자</option>
          <option value="admin">관리자</option>
        </select>
        <button type="submit">로그인</button>
      </form>

      {/* 소셜 로그인 (user만) */}
      <div>
        <button onClick={() => supabase.auth.signInWithOAuth({
          provider: 'google',
          options: { redirectTo: window.location.origin + '/auth/callback' }
        })}>
          Google로 계속하기
        </button>

        <button onClick={() => supabase.auth.signInWithOAuth({
          provider: 'kakao',
          options: { redirectTo: window.location.origin + '/auth/callback' }
        })}>
          Kakao로 계속하기
        </button>

        <button onClick={() => supabase.auth.signInWithOAuth({
          provider: 'apple',
          options: { redirectTo: window.location.origin + '/auth/callback' }
        })}>
          Apple로 계속하기
        </button>
      </div>
    </div>
  );
}
```

---

## 🎯 역할별 사용 예시

### Admin (관리자)
```typescript
// 관리자 로그인
const adminLogin = await login('admin@example.com', 'password', 'admin');

// IP 화이트리스트 체크 필요
// 세션 지속 시간: 24시간
```

### Shop Owner (샵 소유자)
```typescript
// 샵 소유자 로그인
const shopOwnerLogin = await login('owner@shop.com', 'password', 'shop_owner');

// 반드시 shop_id가 있어야 함
console.log('Shop ID:', shopOwnerLogin.user.shop_id);

// 계정 보안 강화 적용
// 세션 지속 시간: 24시간
```

### User (일반 사용자)
```typescript
// 일반 사용자 로그인
const userLogin = await login('user@example.com', 'password', 'user');

// 가장 긴 세션 지속 시간: 30일
// 추가 보안 체크 없음
```

---

## ⚠️ 주의사항

1. **절대 사용하지 말아야 할 엔드포인트**:
   - ❌ `/api/admin/auth/login` (레거시 - 사용 금지)
   - ✅ `/api/auth/login` (통합 시스템 - 사용)

2. **역할 필드 필수**:
   - 로그인 시 반드시 `role` 필드를 포함해야 합니다
   - 올바른 값: `'admin'`, `'shop_owner'`, `'user'`

3. **토큰 만료 시간**:
   - Admin: 24시간
   - Shop Owner: 24시간
   - User: 30일

4. **Rate Limiting**:
   - 로그인: 5회 시도 / 15분
   - 초과 시 자동으로 계정이 잠기지 않지만 요청이 차단됩니다

---

## 🐛 디버깅

### 토큰이 "invalid signature" 에러를 발생시키는 경우

**원인**: 이전 버전의 서버에서 발급된 토큰 사용

**해결책**:
```typescript
// 1. 로컬 스토리지 완전 초기화
localStorage.clear();
sessionStorage.clear();

// 2. 쿠키 삭제
document.cookie.split(";").forEach(c => {
  document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
});

// 3. 재로그인
window.location.href = '/login';
```

### 토큰 페이로드 확인
```typescript
function decodeToken(token: string) {
  const base64Url = token.split('.')[1];
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const jsonPayload = decodeURIComponent(
    atob(base64).split('').map(c => {
      return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join('')
  );
  return JSON.parse(jsonPayload);
}

const token = localStorage.getItem('access_token');
console.log('Token payload:', decodeToken(token));
```

---

## 📞 지원

문제가 발생하면 백엔드 개발자에게 다음 정보와 함께 문의하세요:
- API 엔드포인트
- 요청 Body/Headers
- 응답 코드 및 에러 메시지
- 브라우저 콘솔 에러 로그
