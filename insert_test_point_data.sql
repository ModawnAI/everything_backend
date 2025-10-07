-- ============================================================================
-- INSERT TEST POINT TRANSACTION DATA FOR TESTING POINTS ENDPOINT
-- ============================================================================
-- Run this script in your Supabase SQL Editor to add test point data
-- This creates realistic point transactions with correct column names
-- ============================================================================

-- IMPORTANT: Correct column names to use:
-- - balance_after (NOT balance)
-- - transaction_type (NOT type)
-- - description (NOT reason)

-- Insert test point transactions
INSERT INTO point_transactions (
  user_id,
  amount,
  transaction_type,
  description,
  balance_after,
  status,
  created_at,
  updated_at,
  expires_at
)
SELECT
  u.id as user_id,
  -- Amount varies by transaction type
  CASE (row_number() OVER ()) % 7
    WHEN 0 THEN 1000   -- signup_bonus
    WHEN 1 THEN 500    -- referral_reward
    WHEN 2 THEN -5000  -- reservation_payment (negative = spent)
    WHEN 3 THEN 3000   -- reservation_cancel_refund
    WHEN 4 THEN 2000   -- admin_adjustment
    WHEN 5 THEN 1500   -- promotion
    ELSE 800           -- review_reward
  END as amount,
  -- Transaction type
  CASE (row_number() OVER ()) % 7
    WHEN 0 THEN 'signup_bonus'
    WHEN 1 THEN 'referral_reward'
    WHEN 2 THEN 'reservation_payment'
    WHEN 3 THEN 'reservation_cancel_refund'
    WHEN 4 THEN 'admin_adjustment'
    WHEN 5 THEN 'promotion'
    ELSE 'review_reward'
  END as transaction_type,
  -- Description matching the transaction type
  CASE (row_number() OVER ()) % 7
    WHEN 0 THEN '신규 가입 환영 포인트'
    WHEN 1 THEN '친구 추천 보상'
    WHEN 2 THEN '예약 결제에 포인트 사용'
    WHEN 3 THEN '예약 취소로 인한 포인트 환불'
    WHEN 4 THEN '관리자 포인트 조정'
    WHEN 5 THEN '프로모션 이벤트 포인트'
    ELSE '리뷰 작성 보상'
  END as description,
  -- Calculate balance_after (cumulative)
  -- Start with 10000 base + add/subtract amounts
  10000 +
  CASE (row_number() OVER ()) % 7
    WHEN 0 THEN 1000
    WHEN 1 THEN 1500
    WHEN 2 THEN -3500
    WHEN 3 THEN 500
    WHEN 4 THEN 2500
    WHEN 5 THEN 4000
    ELSE 4800
  END as balance_after,
  -- Status: most are active, some used/expired
  CASE (row_number() OVER ()) % 10
    WHEN 0 THEN 'expired'
    WHEN 1 THEN 'used'
    WHEN 2 THEN 'cancelled'
    ELSE 'active'
  END as status,
  -- Created recently (within last 60 days)
  NOW() - ((row_number() OVER () * 2) || ' days')::interval as created_at,
  NOW() as updated_at,
  -- Expires in future (6 months from creation for earned points)
  CASE
    WHEN (row_number() OVER ()) % 7 IN (0, 1, 4, 5, 6) THEN
      NOW() + interval '6 months' - ((row_number() OVER () * 2) || ' days')::interval
    ELSE NULL  -- Spent points don't expire
  END as expires_at
FROM (
  SELECT u.*
  FROM users u
  WHERE u.user_status = 'active'
  ORDER BY u.created_at DESC
  LIMIT 50  -- Create transactions for 50 users
) u;

-- Display results summary
SELECT
  COUNT(*) as total_transactions_inserted,
  COUNT(CASE WHEN transaction_type = 'signup_bonus' THEN 1 END) as signup_bonus_count,
  COUNT(CASE WHEN transaction_type = 'referral_reward' THEN 1 END) as referral_count,
  COUNT(CASE WHEN transaction_type = 'reservation_payment' THEN 1 END) as payment_count,
  COUNT(CASE WHEN transaction_type = 'reservation_cancel_refund' THEN 1 END) as refund_count,
  COUNT(CASE WHEN transaction_type = 'admin_adjustment' THEN 1 END) as adjustment_count,
  COUNT(CASE WHEN transaction_type = 'promotion' THEN 1 END) as promotion_count,
  COUNT(CASE WHEN transaction_type = 'review_reward' THEN 1 END) as review_count,
  SUM(amount) as total_amount,
  COUNT(CASE WHEN status = 'active' THEN 1 END) as active_count,
  COUNT(CASE WHEN status = 'used' THEN 1 END) as used_count,
  COUNT(CASE WHEN status = 'expired' THEN 1 END) as expired_count
FROM point_transactions
WHERE created_at > NOW() - interval '2 minutes';

-- Display sample data with correct column names
SELECT
  pt.id,
  u.name as user_name,
  pt.amount,
  pt.transaction_type,  -- NOT "type"
  pt.description,       -- NOT "reason"
  pt.balance_after,     -- NOT "balance"
  pt.status,
  pt.created_at,
  pt.expires_at
FROM point_transactions pt
INNER JOIN users u ON pt.user_id = u.id
ORDER BY pt.created_at DESC
LIMIT 15;

-- Verify column structure (for debugging)
SELECT
  'Expected Columns' as check_type,
  COUNT(*) FILTER (WHERE column_name = 'balance_after') as has_balance_after,
  COUNT(*) FILTER (WHERE column_name = 'transaction_type') as has_transaction_type,
  COUNT(*) FILTER (WHERE column_name = 'description') as has_description,
  COUNT(*) FILTER (WHERE column_name = 'balance') as has_balance_wrong,
  COUNT(*) FILTER (WHERE column_name = 'type') as has_type_wrong,
  COUNT(*) FILTER (WHERE column_name = 'reason') as has_reason_wrong
FROM information_schema.columns
WHERE table_name = 'point_transactions';
