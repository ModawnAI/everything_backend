# 에뷰리띵 백엔드 구현 가이드

## 🚀 시작하기

### 개발 환경 준비
```bash
# 1. Node.js 18+ 설치 확인
node --version  # v18.0.0 이상

# 2. 프로젝트 의존성 설치
npm install

# 3. 환경 변수 설정
cp .env.example .env
# .env 파일에 실제 값들 입력

# 4. 데이터베이스 마이그레이션 실행
npm run migrate

# 5. 개발 서버 시작
npm run dev
```

## 📋 단계별 구현 체크리스트

### Phase 1: Foundation Setup ⭐ (1-2주)
```bash
# 체크리스트
□ TypeScript 프로젝트 초기화
□ Express.js 서버 기본 구조 생성
□ Supabase 연결 설정
□ 데이터베이스 스키마 전체 구현
□ 기본 미들웨어 (auth, logging, error handling)
□ 테스트 환경 설정
□ API 문서화 (Swagger) 설정

# 핵심 파일들
src/app.ts                    # Express 앱 진입점
src/config/database.ts        # Supabase 설정
src/middleware/auth.middleware.ts
src/utils/logger.ts
SUPABASE SCHEMA.sql          # 전체 DB 스키마
```

### Phase 2: User Management 👤 (1-2주)
```bash
# 체크리스트
□ 소셜 로그인 API (카카오, 애플, 구글)
□ 사용자 등록 및 프로필 관리
□ 추천인 시스템 구현
□ 사용자 설정 관리
□ 관리자 사용자 관리 도구

# 핵심 파일들
src/controllers/auth.controller.ts
src/services/auth.service.ts
src/controllers/user-profile.controller.ts
src/services/referral.service.ts
src/validators/auth.validators.ts
```

### Phase 3: Shop System 🏪 (2-3주)
```bash
# 체크리스트
□ 위치 기반 샵 검색 (PostGIS)
□ 샵 등록 및 승인 워크플로우
□ 샵 프로필 및 서비스 관리
□ 이미지 업로드 시스템
□ 샵 연락처 통합 (카카오톡 채널)

# 핵심 파일들
src/controllers/shop.controller.ts
src/services/shop.service.ts
src/controllers/admin-shop.controller.ts
src/services/image.service.ts
src/utils/spatial.ts
```

### Phase 4: Reservation System 📅 (2-3주)
```bash
# 체크리스트
□ 시간 슬롯 가용성 시스템
□ 예약 요청 플로우 (v3.1 정책)
□ 샵 사장 확정 시스템
□ 서비스 완료 처리
□ 취소 및 환불 시스템

# 핵심 파일들
src/controllers/reservation.controller.ts
src/services/reservation.service.ts
src/controllers/shop-owner.controller.ts
src/services/time-slot.service.ts
src/services/cancellation.service.ts
```

### Phase 5: Payment & Point System 💳 (2-3주)
```bash
# 체크리스트
□ 토스페이먼츠 API 통합
□ 포인트 적립 시스템 (v3.2 정책)
□ 포인트 사용 시스템 (FIFO)
□ 추천인 리워드 시스템
□ 재정 관리 및 정산

# 핵심 파일들
src/controllers/payment.controller.ts
src/services/toss-payments.service.ts
src/controllers/point.controller.ts
src/services/point.service.ts
src/services/referral-rewards.service.ts
```

### Phase 6: Social Feed System 📱 (2-3주)
```bash
# 체크리스트
□ 소셜 피드 시스템
□ 콘텐츠 조정 및 신고
□ 고급 분석 및 대시보드
□ 성능 최적화
□ 종합 모니터링

# 핵심 파일들
src/controllers/feed.controller.ts
src/services/feed.service.ts
src/services/content-moderation.service.ts
src/services/analytics.service.ts
src/services/monitoring.service.ts
```

## 🔧 실제 구현 순서

### 1주차: 기반 인프라
```bash
Day 1-2: 프로젝트 설정 및 의존성
Day 3-4: 데이터베이스 스키마 구현
Day 5-7: 기본 미들웨어 및 보안 설정
```

### 2주차: 인증 시스템
```bash
Day 8-9: JWT 인증 미들웨어
Day 10-11: 소셜 로그인 통합
Day 12-14: 사용자 등록 및 프로필
```

### 3-4주차: 샵 시스템
```bash
Day 15-17: 위치 기반 샵 검색
Day 18-20: 샵 등록 및 관리
Day 21-23: 이미지 업로드 및 연락처
Day 24-28: 관리자 샵 승인 시스템
```

### 5-7주차: 예약 시스템
```bash
Day 29-31: 시간 슬롯 시스템
Day 32-35: 예약 요청 플로우
Day 36-38: 샵 확정 시스템
Day 39-42: 완료 및 취소 시스템
```

### 8-10주차: 결제 및 포인트
```bash
Day 43-45: 토스페이먼츠 통합
Day 46-49: 포인트 시스템 구현
Day 50-52: 추천인 리워드
Day 53-56: 재정 관리 도구
```

### 11-14주차: 소셜 및 최적화
```bash
Day 57-60: 소셜 피드 시스템
Day 61-63: 콘텐츠 조정
Day 64-67: 분석 및 대시보드
Day 68-70: 성능 최적화 및 런칭 준비
```

## 🧪 테스트 전략

### 단계별 테스트 접근법
```typescript
// Phase 1: Foundation Testing
describe('Foundation Tests', () => {
  test('Database connections');
  test('Authentication middleware');
  test('Error handling');
  test('Security headers');
});

// Phase 2: User Management Testing  
describe('User Management Tests', () => {
  test('Social login flows');
  test('User registration');
  test('Profile management');
  test('Referral system');
});

// ... 각 단계별 테스트 스위트
```

### 테스트 자동화
```bash
# 지속적 테스트 실행
npm run test:watch          # 개발 중 자동 테스트
npm run test:coverage       # 커버리지 리포트
npm run test:security       # 보안 테스트
npm run test:integration    # 통합 테스트
```

## 📊 진행 상황 추적

### 각 단계별 성공 지표
```typescript
interface PhaseMetrics {
  completion_percentage: number;    // 완성도 (0-100%)
  test_coverage: number;           // 테스트 커버리지
  performance_score: number;       // 성능 점수
  security_score: number;          // 보안 점수
  code_quality: number;           // 코드 품질 점수
}
```

### 일일 체크포인트
- **매일 오전**: 전날 진행 상황 리뷰
- **매일 오후**: 당일 목표 달성 확인
- **주간 리뷰**: 단계별 진행률 및 이슈 점검
- **단계 완료**: 품질 게이트 통과 확인

## 🔄 단계 간 전환 기준

### Phase 완료 조건
1. **모든 API 엔드포인트 구현 완료**
2. **테스트 커버리지 목표 달성**
3. **성능 벤치마크 통과**
4. **보안 검증 완료**
5. **다음 단계 의존성 준비 완료**

### 전환 체크리스트
```bash
□ 모든 기능 테스트 통과
□ 성능 요구사항 충족
□ 보안 취약점 해결
□ 문서 업데이트 완료
□ 다음 단계 팀 브리핑 완료
```

## 🚨 문제 해결 가이드

### 일반적인 이슈들
1. **데이터베이스 연결 문제**: Supabase 설정 확인
2. **인증 토큰 이슈**: JWT 시크릿 및 만료 시간 확인
3. **CORS 에러**: 허용된 도메인 설정 확인
4. **성능 저하**: 쿼리 최적화 및 인덱스 확인

### 디버깅 도구
```bash
# 로그 확인
tail -f logs/combined.log

# 데이터베이스 쿼리 분석
npm run db:analyze

# 성능 모니터링
npm run monitor:performance

# 보안 스캔
npm run security:scan
```

## 📚 추가 리소스

### 기술 문서
- [Supabase Documentation](https://supabase.com/docs)
- [Toss Payments API](https://docs.tosspayments.com/)
- [Express.js Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [PostgreSQL Performance](https://www.postgresql.org/docs/current/performance-tips.html)

### 내부 문서
- `에뷰리띵_백엔드_상세_설계서.md` - 전체 API 명세
- `SUPABASE SCHEMA.sql` - 데이터베이스 스키마
- `TYPE_SAFETY_IMPROVEMENTS.md` - 타입 안전성 가이드

---

## 🎉 성공적인 개발을 위한 팁

1. **단계별 집중**: 한 번에 하나의 Phase에만 집중
2. **테스트 우선**: 기능 구현 전 테스트 케이스 작성
3. **문서화**: 코드와 함께 문서 업데이트
4. **성능 고려**: 초기부터 성능을 염두에 둔 설계
5. **보안 우선**: 모든 입력에 대한 검증 및 보안 고려

**성공적인 개발을 응원합니다! 🚀**
