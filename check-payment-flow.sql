-- 1. B의 최근 결제 정보 확인 (모든 컬럼)
SELECT *
FROM payments
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 3;

-- 2. B의 최근 예약 정보 확인
SELECT id, user_id, shop_id, status, total_amount, deposit_amount, remaining_amount, created_at
FROM reservations
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 3;

-- 3. B의 referred_by_code 확인
SELECT id, nickname, referred_by_code, referrer_set_at
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';

-- 4. A (추천인) 확인
SELECT id, nickname, referral_code, user_status
FROM users
WHERE referral_code = 'Y8AP26EY';

-- 5. A의 추천 보상 포인트 트랜잭션 확인
SELECT *
FROM point_transactions
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND category = 'referral'
ORDER BY created_at DESC
LIMIT 10;
