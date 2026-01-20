-- ===================================================================
-- 추천인 친구 이름 표시 오류 진단 쿼리
-- Supabase Dashboard > SQL Editor에서 실행
-- ===================================================================

-- 1. 추천인 (A) 정보 확인
SELECT
  '=== 추천인 (A) 정보 ===' as section,
  id,
  name,
  nickname,
  email,
  referral_code,
  referred_by_code,
  user_status,
  created_at
FROM users
WHERE id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68';

-- 2. 추천받은 사용자 (B) 정보 확인
SELECT
  '=== 추천받은 사용자 (B) 정보 ===' as section,
  id,
  name,
  nickname,
  email,
  phone_number,
  referred_by_code,
  user_status,
  created_at
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';

-- 3. referrals 테이블에서 관계 확인 (백엔드 API가 사용하는 데이터)
SELECT
  '=== Referrals 테이블 데이터 (백엔드가 조회) ===' as section,
  r.id as referral_id,
  r.referrer_id,
  r.referred_id,
  r.status,
  r.bonus_amount,
  r.bonus_paid,
  r.created_at as referral_created_at,
  r.updated_at as referral_updated_at,
  -- 추천받은 사용자 정보 (JOIN)
  u.name as referred_user_name,
  u.nickname as referred_user_nickname,
  u.email as referred_user_email,
  u.phone_number as referred_user_phone,
  u.user_status as referred_user_status
FROM referrals r
LEFT JOIN users u ON r.referred_id = u.id
WHERE r.referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY r.created_at DESC;

-- 4. 백엔드 API 로직 시뮬레이션 (실제 응답 확인)
-- Line 507: user?.name || user?.nickname || 'Unknown User'
SELECT
  '=== 백엔드 API 응답 시뮬레이션 ===' as section,
  r.id,
  r.referred_id,
  r.status,
  r.bonus_amount,
  r.bonus_paid,
  r.created_at,
  -- 백엔드 로직과 동일한 이름 선택 순서
  COALESCE(u.name, u.nickname, 'Unknown User') as display_name,
  u.name as raw_name,
  u.nickname as raw_nickname,
  -- 추가 디버깅 정보
  CASE
    WHEN u.name IS NOT NULL AND u.name != '' THEN 'name 사용'
    WHEN u.nickname IS NOT NULL AND u.nickname != '' THEN 'nickname 사용'
    ELSE 'Unknown User 사용'
  END as name_source
FROM referrals r
LEFT JOIN users u ON r.referred_id = u.id
WHERE r.referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY r.created_at DESC;

-- 5. 모든 users 테이블에서 "홍길동" 검색 (혹시 다른 사용자인지 확인)
SELECT
  '=== "홍길동" 이름을 가진 모든 사용자 ===' as section,
  id,
  name,
  nickname,
  email,
  user_status,
  created_at
FROM users
WHERE name LIKE '%홍길동%' OR nickname LIKE '%홍길동%'
ORDER BY created_at DESC;

-- 6. 실제 B 사용자의 예약 내역 확인 (혹시 이름이 예약 시 다르게 입력되었는지)
SELECT
  '=== B 사용자의 예약 내역 ===' as section,
  id as reservation_id,
  user_id,
  shop_id,
  customer_name,
  customer_phone,
  status,
  created_at
FROM reservations
WHERE user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
ORDER BY created_at DESC
LIMIT 5;
