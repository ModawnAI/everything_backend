-- =============================================
-- 추천인 데이터 삭제 SQL
-- =============================================
-- 사용자의 추천인 관련 데이터를 완전히 삭제합니다.
-- 테스트 및 재설정 목적으로 사용

-- =============================================
-- 옵션 1: 특정 사용자의 추천인 설정 삭제
-- =============================================

-- A의 추천인 데이터 삭제 (A가 B를 추천인으로 설정한 경우)
-- A의 USER_ID로 교체하세요

BEGIN;

-- 1. referrals 테이블에서 삭제 (A가 referred_id인 레코드)
DELETE FROM public.referrals
WHERE referred_id = 'A의_USER_ID';

-- 2. referral_relationships 테이블에서 삭제 (A가 referred_id인 레코드)
DELETE FROM public.referral_relationships
WHERE referred_id = 'A의_USER_ID';

-- 3. users 테이블에서 추천인 정보 삭제
UPDATE public.users
SET
  referred_by_code = NULL,
  referrer_set_at = NULL,
  updated_at = NOW()
WHERE id = 'A의_USER_ID';

COMMIT;

-- =============================================
-- 옵션 2: 두 사용자의 상호 추천 완전 삭제
-- =============================================

-- A와 B가 서로를 추천한 경우, 모든 관계 삭제
-- A의 USER_ID: 3fc00cc7-e748-45c1-9e30-07a779678a76
-- B의 USER_ID: 33b92c15-e34c-41f7-83ed-c6582ef7fc68

BEGIN;

-- 1. referrals 테이블에서 A, B 관련 모든 레코드 삭제
DELETE FROM public.referrals
WHERE referred_id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);

-- 2. referral_relationships 테이블에서 A, B 관련 모든 레코드 삭제
DELETE FROM public.referral_relationships
WHERE referred_id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);

-- 3. users 테이블에서 A, B의 추천인 정보 삭제
UPDATE public.users
SET
  referred_by_code = NULL,
  referrer_set_at = NULL,
  updated_at = NOW()
WHERE id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);

COMMIT;

-- =============================================
-- 옵션 3: 특정 추천인 코드로 설정된 모든 관계 삭제
-- =============================================

-- 특정 추천 코드를 사용한 모든 사용자의 데이터 삭제
-- '추천코드'를 실제 코드로 교체하세요

BEGIN;

-- 1. referrals 테이블에서 해당 코드 관련 삭제
DELETE FROM public.referrals
WHERE referral_code = '추천코드';

-- 2. referral_relationships 테이블에서 해당 코드 관련 삭제
DELETE FROM public.referral_relationships
WHERE referral_code = '추천코드';

-- 3. users 테이블에서 해당 코드를 사용한 사용자들의 추천인 정보 삭제
UPDATE public.users
SET
  referred_by_code = NULL,
  referrer_set_at = NULL,
  updated_at = NOW()
WHERE referred_by_code = '추천코드';

COMMIT;

-- =============================================
-- 검증 쿼리
-- =============================================

-- 삭제 후 확인: A의 추천인 데이터 확인
SELECT
  id,
  nickname,
  referred_by_code,
  referrer_set_at
FROM public.users
WHERE id = 'A의_USER_ID';
-- 예상: referred_by_code = NULL, referrer_set_at = NULL

-- 삭제 후 확인: referrals 테이블 확인
SELECT COUNT(*) AS remaining_referrals
FROM public.referrals
WHERE referred_id = 'A의_USER_ID';
-- 예상: 0

-- 삭제 후 확인: referral_relationships 테이블 확인
SELECT COUNT(*) AS remaining_relationships
FROM public.referral_relationships
WHERE referred_id = 'A의_USER_ID';
-- 예상: 0

-- =============================================
-- 롤백 (실수로 삭제한 경우)
-- =============================================

-- 트랜잭션 중에 문제가 발생하면:
-- ROLLBACK;

-- 이미 COMMIT 후라면 롤백 불가능
-- 백업에서 복구하거나 수동으로 데이터 재입력 필요
