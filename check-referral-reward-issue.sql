-- 추천인 보상 미지급 원인 확인 쿼리

-- 1. B의 추천인 설정 확인
SELECT id, nickname, referred_by_code, referrer_set_at, user_status
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
-- 예상: referred_by_code = 'Y8AP26EY'

-- 2. A (추천인) 정보 확인
SELECT id, nickname, referral_code, user_status
FROM users
WHERE referral_code = 'Y8AP26EY';
-- 예상: id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68', user_status = 'active'

-- 3. B의 최근 예약 확인
SELECT id, user_id, shop_id, reservation_status, payment_amount, created_at
FROM reservations
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 5;

-- 4. B의 최근 결제 확인
SELECT id, user_id, reservation_id, payment_method, amount, payment_status, created_at
FROM payments
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 5;

-- 5. A의 추천 보상 포인트 트랜잭션 확인
SELECT *
FROM point_transactions
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND category = 'referral'
ORDER BY created_at DESC
LIMIT 10;

-- 6. referrals 테이블 확인 (친구 관계)
SELECT *
FROM referrals
WHERE referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND referred_id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
