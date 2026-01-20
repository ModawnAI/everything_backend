-- A와 B의 추천인 설정 상태 확인

-- 1. A 사용자 정보 확인
SELECT
  id,
  nickname,
  name,
  referral_code,
  referred_by_code,
  referrer_set_at,
  user_status,
  created_at
FROM users
WHERE id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';
-- A (Apple 로그인)

-- 2. B 사용자 정보 확인
SELECT
  id,
  nickname,
  name,
  referral_code,
  referred_by_code,
  referrer_set_at,
  user_status,
  created_at
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
-- B (Kakao 로그인)

-- 3. A가 B의 코드로 설정하려는 경우 - B의 추천인 코드 확인
-- B의 코드: RKFAIJ7A
SELECT
  id,
  nickname,
  referral_code,
  user_status
FROM users
WHERE referral_code = 'RKFAIJ7A';

-- 4. referrals 테이블에서 관계 확인
SELECT *
FROM referrals
WHERE (referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
   OR referred_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68')
   OR (referrer_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
   OR referred_id = '3fc00cc7-e748-45c1-9e30-07a779678a76');

-- 5. 상호 추천 관계 체크
SELECT
  r1.referrer_id as a_id,
  r1.referred_id as b_id,
  r2.referrer_id as b_as_referrer,
  r2.referred_id as a_as_referred
FROM referrals r1
LEFT JOIN referrals r2
  ON r1.referrer_id = r2.referred_id
  AND r1.referred_id = r2.referrer_id
WHERE r1.referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND r1.referred_id = '3fc00cc7-e748-45c1-9e30-07a779678a76';
