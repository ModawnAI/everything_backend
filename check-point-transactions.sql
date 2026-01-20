-- point_transactions 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'point_transactions'
ORDER BY ordinal_position;

-- A의 모든 포인트 트랜잭션 확인
SELECT *
FROM point_transactions
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY created_at DESC
LIMIT 10;

-- B가 받은 포인트 확인 (최근 예약 완료 시)
SELECT *
FROM point_transactions
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 10;
