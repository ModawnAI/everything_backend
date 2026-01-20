# 추천인 보상 및 푸시 알림 테스트 가이드

## 전제 조건
- A (추천인): 33b92c15-e34c-41f7-83ed-c6582ef7fc68 / 코드: Y8AP26EY
- B (피추천인): 3fc00cc7-e748-45c1-9e30-07a779678a76 / 코드: RKFAIJ7A
- B가 이미 A의 코드로 추천인 등록 완료

## 테스트 단계

### 1. 사전 확인 (Supabase)

```sql
-- B가 A를 추천인으로 설정했는지 확인
SELECT id, nickname, referred_by_code, referrer_set_at
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
-- 예상: referred_by_code = 'Y8AP26EY'

-- A의 현재 포인트 확인
SELECT user_id, available_balance, total_earned
FROM point_balances
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
-- 현재 포인트를 기록해두기

-- 친구 목록 확인
SELECT *
FROM referrals
WHERE referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND referred_id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
-- 예상: 1개 행 존재
```

### 2. B가 결제 진행 (앱에서)

**예약 및 결제:**
1. B 계정(카카오)으로 로그인
2. 매장 예약 생성
3. 결제 진행 (예: 50,000원)
4. 결제 완료까지 진행

**예상 보상:**
- 결제액: 50,000원
- B가 받는 포인트: 5,000P (10%)
- A가 받는 추천 보상: 500P (B 포인트의 10%)

### 3. PM2 로그 확인

```bash
pm2 logs everything-backend --lines 100 | grep -A 5 -B 5 "referral"
```

**확인할 로그:**
```
Checking if user has referrer for reward processing
Processing referral reward
  referrerId: 33b92c15-... (A)
  referredId: 3fc00cc7-... (B)
  originalPaymentAmount: 50000
Referral reward processed successfully
Sending referral point notification
  userId: 33b92c15-... (A)
  friendNickname: B의_닉네임
  pointsEarned: 500
```

### 4. 데이터베이스 확인 (Supabase)

```sql
-- 1. A의 포인트 증가 확인
SELECT user_id, available_balance, total_earned
FROM point_balances
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
-- 예상: available_balance가 500 증가

-- 2. 포인트 트랜잭션 확인
SELECT *
FROM point_transactions
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY created_at DESC
LIMIT 5;
-- 예상: transaction_type = 'earned', category = 'referral', amount = 500

-- 3. 푸시 알림 생성 확인
SELECT *
FROM notifications
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY created_at DESC
LIMIT 5;
-- 예상: 최신 알림에 "친구 덕분에 용돈 받았어요!" 메시지

-- 4. 결제 audit log 확인
SELECT *
FROM payment_audit_logs
ORDER BY timestamp DESC
LIMIT 5;
```

### 5. A의 앱에서 확인

**A 계정(애플)으로 로그인:**
1. 푸시 알림이 왔는지 확인
   - 제목: "🎉 친구 덕분에 용돈 받았어요!"
   - 내용: "{B_닉네임}님 덕분에 500P가 적립되었습니다."
2. 포인트 페이지에서 500P 증가 확인
3. 친구 목록에서 B가 보이는지 확인

## 예상되는 문제점 및 해결

### 문제 1: 푸시 알림이 오지 않음
**원인:** FCM 토큰이 등록되지 않았거나 만료됨
**확인:**
```sql
SELECT id, fcm_token, fcm_token_updated_at
FROM users
WHERE id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
```
**해결:** A가 앱을 재실행하여 FCM 토큰 갱신

### 문제 2: 포인트가 지급되지 않음
**원인:** processReferralReward 실패
**확인:** PM2 로그에서 에러 메시지 확인
```bash
pm2 logs everything-backend --err --lines 50
```

### 문제 3: referrals 테이블에 레코드가 없음
**원인:** 이전 버그로 레코드가 생성되지 않음
**해결:** 백필 마이그레이션 실행
```sql
-- migrations/backfill_referrals_table.sql 실행
```

## 성공 기준

✅ B가 50,000원 결제 완료
✅ A에게 500P 지급 (point_transactions에 기록)
✅ A에게 푸시 알림 발송 (notifications 테이블에 기록)
✅ PM2 로그에 "Referral reward processed successfully" 메시지
✅ A의 앱에서 푸시 알림 수신 확인
✅ A의 포인트 페이지에서 500P 증가 확인

