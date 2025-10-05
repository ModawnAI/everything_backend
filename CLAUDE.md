# Claude Code Instructions - 에뷰리띵 Backend

## Project Overview
에뷰리띵(eBeautything) 백엔드는 뷰티 예약 플랫폼을 위한 Node.js 기반 REST API 서버입니다.
**중요: 이 프로젝트는 백엔드 전용입니다. 프론트엔드 기능은 별도의 Flutter 앱과 웹 관리자에서 처리됩니다.**

## Tech Stack

### Core Framework
- **Runtime**: Node.js (>=18.0.0)
- **Framework**: Express.js 4.x
- **Language**: TypeScript 5.x
- **Module System**: CommonJS

### Database & Storage
- **Primary Database**: Supabase (PostgreSQL)
- **ORM**: Drizzle ORM
- **Caching**: Redis (ioredis) - optional, disabled by default in dev
- **File Storage**: Supabase Storage

### Authentication & Security
- **Auth Strategy**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt/bcryptjs
- **Security Headers**: Helmet
- **Rate Limiting**: express-rate-limit, rate-limiter-flexible
- **CORS**: cors middleware
- **Input Validation**: express-validator, Joi
- **XSS/CSRF Protection**: dompurify, csrf

### Real-time & Background Jobs
- **WebSocket**: Socket.io
- **Scheduling**: node-cron, cron

### Payment Integration
- **Payment Gateway**: TossPayments SDK

### Notifications
- **Push Notifications**: Firebase Cloud Messaging (FCM)

### Logging & Monitoring
- **Logger**: Winston
- **HTTP Logger**: Morgan
- **Compression**: compression

### API Documentation
- **OpenAPI/Swagger**: swagger-jsdoc, swagger-ui-express

### Testing
- **Test Framework**: Jest
- **HTTP Testing**: Supertest
- **Test Data**: @faker-js/faker

### Development Tools
- **Process Manager**: nodemon
- **Code Quality**: ESLint, Prettier
- **TypeScript Compiler**: tsc
- **Build Tool**: ts-node

## Project Structure

```
src/
├── config/          # 환경 설정 및 데이터베이스 초기화
├── controllers/     # 요청 처리 로직
├── services/        # 비즈니스 로직
├── repositories/    # 데이터 접근 계층
├── middleware/      # Express 미들웨어
├── routes/          # API 라우트 정의
├── types/           # TypeScript 타입 정의
├── utils/           # 유틸리티 함수
├── validators/      # 입력 검증 스키마
├── constants/       # 상수 정의
└── app.ts          # 애플리케이션 진입점
```

## Development Guidelines

### 1. Backend-Only Focus
- ❌ **절대 하지 말 것**: React, Vue, Angular 등 프론트엔드 프레임워크 코드 작성
- ❌ **절대 하지 말 것**: HTML, CSS, 프론트엔드 UI 컴포넌트 생성
- ✅ **해야 할 것**: REST API 엔드포인트 개발
- ✅ **해야 할 것**: 비즈니스 로직 및 데이터 처리
- ✅ **해야 할 것**: 데이터베이스 스키마 및 쿼리 작업

### 2. TypeScript Path Aliases
프로젝트는 다음과 같은 경로 별칭을 사용합니다:
```typescript
import { Controller } from '@/controllers';
import { Service } from '@/services';
import { config } from '@/config';
```

### 3. API Response Format
모든 API 응답은 표준화된 형식을 따릅니다:
```typescript
// 성공 응답
{
  success: true,
  data: { ... },
  message?: string
}

// 에러 응답
{
  success: false,
  error: {
    code: 'ERROR_CODE',
    message: '에러 메시지',
    details?: any
  }
}
```

### 4. Environment Configuration
- 모든 설정은 `src/config/environment.ts`에서 Joi로 검증됨
- `.env` 파일에 환경 변수 정의
- `config` 객체를 통해 타입 안전하게 접근

### 5. Logging in Development
**개발 모드에서는 모든 API 요청에 대한 상세 로그가 자동으로 기록됩니다:**
- 요청 메서드, URL, 헤더
- 요청 본문 (민감 정보는 자동으로 마스킹)
- 응답 상태 코드, 응답 시간
- 에러 스택 트레이스
- 느린 요청 경고 (>1초)

### 6. Security Best Practices
- 모든 라우트에 적절한 인증/인가 미들웨어 적용
- SQL Injection 방지 (자동 적용)
- XSS/CSRF 보호 (자동 적용)
- Rate Limiting 적용
- 민감한 데이터는 로그에서 자동 제거

### 7. Database Access
- Supabase 클라이언트를 통한 데이터베이스 접근
- Repository 패턴 사용
- 트랜잭션 처리 시 Supabase RPC 활용

### 8. Testing Requirements
- 단위 테스트: `tests/unit/`
- 통합 테스트: `tests/integration/`
- E2E 테스트: `tests/e2e/`
- 성능 테스트: `tests/performance/`
- 보안 테스트: `tests/security/`

## API Documentation
- **Complete API**: http://localhost:3001/api-docs
- **Admin API**: http://localhost:3001/admin-docs
- **Service API**: http://localhost:3001/service-docs
- **OpenAPI Specs**:
  - `/api/openapi.json`
  - `/api/admin/openapi.json`
  - `/api/service/openapi.json`

## Common Development Tasks

### Starting Development Server
```bash
npm run dev           # 일반 시작
npm run dev:clean     # 포트 정리 후 시작
npm run kill-port     # 포트 3001 강제 종료
```

### Running Tests
```bash
npm run test                    # 모든 테스트
npm run test:unit              # 단위 테스트
npm run test:integration       # 통합 테스트
npm run test:e2e              # E2E 테스트
npm run test:coverage         # 커버리지 포함
```

### Database Operations
```bash
npm run migrate               # 마이그레이션 실행
npm run migrate:status        # 마이그레이션 상태 확인
npm run migrate:rollback      # 롤백
npm run seed                  # 시드 데이터 생성
npm run db:reset             # 데이터베이스 초기화
```

### Code Quality
```bash
npm run lint                  # ESLint 검사
npm run lint:fix             # 자동 수정
npm run format               # Prettier 포맷팅
```

## Task Master AI Instructions
**Import Task Master's development workflow commands and guidelines, treat as if import is in the main CLAUDE.md file.**
@./.taskmaster/CLAUDE.md
