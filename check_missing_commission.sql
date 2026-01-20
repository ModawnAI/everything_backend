-- 친구 ID로 결제 내역 확인 (최신순)
SELECT 
  p.id as payment_id,
  p.amount as payment_amount,
  p.paid_at,
  p.payment_status,
  p.reservation_id
FROM payments p
WHERE p.user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
  AND p.payment_status = 'fully_paid'
ORDER BY p.paid_at DESC
LIMIT 10;

-- 해당 친구로부터 발생한 모든 커미션 확인 (최신순)
SELECT 
  pt.id,
  pt.amount,
  pt.created_at,
  pt.status,
  pt.payment_id,
  pt.reservation_id,
  pt.transaction_type,
  pt.description
FROM point_transactions pt
WHERE pt.user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
  AND pt.referred_user_id = '3fc00cc7-e748-45c1-9e30-07a779678a76'
  AND pt.transaction_type = 'earned_referral'
ORDER BY pt.created_at DESC
LIMIT 10;
