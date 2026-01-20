-- 포인트 히스토리 500 에러 원인 확인 쿼리

-- 1. referrer_set_at 컬럼이 존재하는지 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users' 
  AND column_name = 'referrer_set_at';
-- 예상: 1개 행 (TIMESTAMPTZ, YES)
-- 만약 행이 없다면 → 마이그레이션 미실행

-- 2. point_transactions 테이블 구조 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'point_transactions'
ORDER BY ordinal_position;

-- 3. 특정 사용자의 포인트 트랜잭션 조회 (직접 테스트)
-- B 사용자 ID로 테스트
SELECT *
FROM point_transactions
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 5;

-- 4. users 테이블에서 해당 사용자 존재 확인
SELECT id, nickname, name, user_status
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';

