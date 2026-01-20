# Changelog

eBeautything Backend API 변경 이력

## [2026-01-20] - 친구 상세 페이지 포인트 불일치 수정

### 🐛 수정된 버그
- 친구 상세 모달에서 표시되는 커미션 포인트가 실제 포인트 내역과 불일치하는 문제
  - **증상**: 포인트 내역 775P vs 친구 상세 233P
  - **원인**: 배열 인덱스 기반 결제-커미션 매칭으로 인한 오류
  - **영향**: 사용자가 잘못된 커미션 정보를 보게 됨

### ✨ 주요 변경사항

#### 데이터베이스
- `point_transactions` 테이블에 `payment_id` 컬럼 추가
- 성능 최적화를 위한 인덱스 생성
  - `idx_point_transactions_payment_id`
  - `idx_point_transactions_user_payment`
- 기존 데이터 마이그레이션 (시간 기반 ±10분 매칭)

#### 백엔드 서비스
- **`point.service.ts`**
  - `addPoints` 메서드에 `options` 파라미터 추가
  - `paymentId`, `relatedUserId` 저장 기능 추가

- **`enhanced-referral.service.ts`**
  - `processReferralReward` 메서드에 `paymentId` 파라미터 추가
  - 커미션 생성 시 결제 정보 연결

- **`payment-confirmation.service.ts`**
  - 결제 확인 시 `payment_id` 전달 로직 추가
  - 커미션 생성 시 정확한 결제 추적

- **`referral.service.ts`**
  - Wrapper 메서드 시그니처 업데이트
  - `paymentId` 전달 지원

- **`referral-earnings.service.ts`**
  - `getFriendPaymentHistory` 메서드 완전 재작성
  - 배열 인덱스 매칭 → `payment_id` 기반 정확 매칭
  - 과거 데이터 호환을 위한 fallback 로직 추가

### 🔧 기술적 개선사항

#### Before (문제 코드)
```typescript
// ❌ 배열 인덱스로 매칭 (부정확)
const allFriendCommissions = await supabase
  .from('point_transactions')
  .select('*')
  .order('created_at', { ascending: false });

const commission = allFriendCommissions?.[index];
```

**문제점**:
1. `payments` 배열과 `commissions` 배열의 정렬 순서 불일치
2. 페이지네이션 적용 차이 (payments만 페이지네이션)
3. 결제 시간과 커미션 적립 시간의 차이 (최대 3일)
4. 잘못된 결제에 잘못된 커미션 연결

#### After (수정 코드)
```typescript
// ✅ payment_id로 정확 매칭
const { data: commission } = await supabase
  .from('point_transactions')
  .select('*')
  .eq('payment_id', payment.id)
  .eq('transaction_type', 'earned_referral')
  .maybeSingle();

// Fallback: 과거 데이터 (payment_id NULL) 처리
if (!finalCommission && payment.paid_at) {
  // 시간 범위 ±10분으로 매칭
}
```

**개선점**:
1. ✅ 1:1 정확한 결제-커미션 매칭
2. ✅ 페이지네이션 불일치 해결
3. ✅ 시간 차이 영향 제거
4. ✅ 과거 데이터 호환성 유지

### 📊 성능 영향

**쿼리 최적화**:
- 인덱스 추가로 조회 성능 향상
- `payment_id` 기반 조회는 O(1) 시간 복잡도

**Trade-off**:
- getFriendPaymentHistory의 쿼리 수 증가
  - Before: 전체 커미션 1회 조회
  - After: 각 결제마다 커미션 조회 (페이지당 최대 10회)
- 완화: 페이지네이션으로 제한 (기본 10개)
- 향후 개선: JOIN 쿼리로 최적화 가능

### 🔄 마이그레이션 가이드

#### 1. 데이터베이스 마이그레이션
```bash
# Supabase SQL Editor에서 실행
# src/migrations/084_add_payment_id_to_point_transactions.sql
```

#### 2. 검증
```sql
-- 마이그레이션 결과 확인
SELECT
  COUNT(*) as total,
  COUNT(payment_id) as with_payment_id,
  COUNT(*) - COUNT(payment_id) as without_payment_id
FROM point_transactions
WHERE transaction_type = 'earned_referral';
```

#### 3. 배포
```bash
npm run build
npm test
# 프로덕션 배포
```

#### 4. 확인
- 신규 결제 → `payment_id` 저장 확인
- 친구 상세 모달 → 포인트 일치 확인
- API 테스트 → 정확한 커미션 반환 확인

### 🛡️ 하위 호환성
- ✅ 신규 데이터: `payment_id` 사용
- ✅ 과거 데이터: 시간 범위 fallback
- ✅ API 인터페이스: 변경 없음

### 📝 관련 파일
- 마이그레이션: `src/migrations/084_add_payment_id_to_point_transactions.sql`
- 서비스: `src/services/point.service.ts`
- 서비스: `src/services/enhanced-referral.service.ts`
- 서비스: `src/services/payment-confirmation.service.ts`
- 서비스: `src/services/referral.service.ts`
- 서비스: `src/services/referral-earnings.service.ts`
- 문서: `/.claude/skills/20260120-친구상세페이지포인트불일치수정.md`

### 👤 작성자
- Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>

---

## 이전 변경 이력

### [2026-01-20] - 친구 목록 추천인 미표시 문제 수정
- 참조: `/.claude/skills/20260120-친구목록추천인미표시문제수정.md`

### [2026-01-20] - 추천인 설정 400 에러 수정
- 참조: `/.claude/skills/20260120-추천인설정400에러수정.md`

---

## 변경 이력 형식

각 변경사항은 다음 형식을 따릅니다:

```markdown
## [YYYY-MM-DD] - 제목

### 🐛 수정된 버그 / ✨ 새로운 기능 / 🔧 개선사항

### 주요 변경사항
- 파일명 및 변경 내용

### 마이그레이션 가이드
- 필요한 경우 배포 단계

### 관련 파일
- 변경된 파일 목록
```
