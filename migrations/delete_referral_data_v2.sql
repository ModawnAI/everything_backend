-- =============================================
-- 추천인 데이터 삭제 SQL (수정본)
-- =============================================
-- referral_relationships 테이블이 없으므로 제외

-- =============================================
-- 옵션 1: 특정 사용자의 추천인 설정 삭제
-- =============================================

BEGIN;

-- 1. referrals 테이블에서 삭제 (해당 사용자가 referred_id인 레코드)
DELETE FROM public.referrals
WHERE referred_id = 'USER_ID';

-- 2. users 테이블에서 추천인 정보 삭제
UPDATE public.users
SET
  referred_by_code = NULL,
  referrer_set_at = NULL,
  updated_at = NOW()
WHERE id = 'USER_ID';

COMMIT;

-- =============================================
-- 옵션 2: 두 사용자의 상호 추천 완전 삭제 (A와 B)
-- =============================================

BEGIN;

-- 1. referrals 테이블에서 A, B 관련 모든 레코드 삭제
DELETE FROM public.referrals
WHERE referred_id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);

-- 2. users 테이블에서 A, B의 추천인 정보 삭제
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
-- 옵션 3: 모든 추천인 관계 삭제 (전체 초기화)
-- =============================================

BEGIN;

-- 1. 모든 referrals 레코드 삭제
DELETE FROM public.referrals;

-- 2. 모든 users의 추천인 정보 삭제
UPDATE public.users
SET
  referred_by_code = NULL,
  referrer_set_at = NULL,
  updated_at = NOW()
WHERE referred_by_code IS NOT NULL;

COMMIT;

-- =============================================
-- 옵션 4: 특정 추천 코드로 설정된 관계만 삭제
-- =============================================

BEGIN;

-- 1. 해당 코드를 사용한 referrals 레코드 삭제
DELETE FROM public.referrals
WHERE referral_code = '추천코드';

-- 2. 해당 코드를 설정한 users의 추천인 정보 삭제
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

-- 삭제 후 확인: users 테이블
SELECT
  id,
  nickname,
  referred_by_code,
  referrer_set_at
FROM public.users
WHERE id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);
-- 예상: referred_by_code = NULL, referrer_set_at = NULL

-- 삭제 후 확인: referrals 테이블
SELECT COUNT(*) AS remaining_referrals
FROM public.referrals
WHERE referred_id IN (
  '3fc00cc7-e748-45c1-9e30-07a779678a76',
  '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
);
-- 예상: 0

-- 전체 데이터 확인
SELECT COUNT(*) AS total_referrals FROM public.referrals;
SELECT COUNT(*) AS users_with_referrer FROM public.users WHERE referred_by_code IS NOT NULL;
