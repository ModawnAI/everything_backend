-- 추천받은 사용자 (B)의 실제 이름 확인
SELECT
  id,
  name,
  nickname,
  email,
  phone_number,
  user_status,
  created_at
FROM users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';

-- 추천인 (A)의 referral 목록 확인
SELECT
  r.id as referral_id,
  r.referred_id,
  r.status,
  r.bonus_amount,
  r.bonus_paid,
  r.created_at,
  u.name as referred_user_name,
  u.nickname as referred_user_nickname,
  u.user_status
FROM referrals r
LEFT JOIN users u ON r.referred_id = u.id
WHERE r.referrer_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY r.created_at DESC;
