-- ============================================================================
-- INSERT TEST REFUND DATA FOR TESTING REFUND ENDPOINT
-- ============================================================================
-- Run this script in your Supabase SQL Editor to add test refund data
-- This will create refunds for existing reservations in your database
-- ============================================================================

-- First, check what columns actually exist in refunds table
-- Run this query first to see the schema:
-- SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'refunds' ORDER BY ordinal_position;

-- Insert test refund data based on existing reservations
-- This version includes all required columns
INSERT INTO refunds (
  reservation_id,
  requested_amount,
  refunded_amount,
  refund_status,
  created_at,
  updated_at
)
SELECT
  r.id as reservation_id,
  r.total_amount as requested_amount,
  -- Refunded amount varies (full or partial)
  CASE (row_number() OVER ()) % 3
    WHEN 0 THEN r.total_amount * 1.0          -- Full refund
    WHEN 1 THEN r.total_amount * 0.5          -- 50% refund
    ELSE r.total_amount * 0.8                 -- 80% refund
  END as refunded_amount,
  -- Vary refund statuses to test different states
  CASE (row_number() OVER ()) % 6
    WHEN 0 THEN 'pending'
    WHEN 1 THEN 'approved'
    WHEN 2 THEN 'processing'
    WHEN 3 THEN 'completed'
    WHEN 4 THEN 'completed'  -- More completed for testing
    ELSE 'failed'
  END as refund_status,
  -- Created recently (within last 30 days)
  NOW() - ((row_number() OVER ()) || ' days')::interval as created_at,
  NOW() as updated_at
FROM (
  SELECT r.*
  FROM reservations r
  WHERE r.status IN ('cancelled_by_user', 'cancelled_by_shop', 'completed')
  ORDER BY r.created_at DESC
  LIMIT 25  -- Create 25 test refunds
) r;

-- Display results
SELECT
  COUNT(*) as total_refunds_inserted,
  COUNT(CASE WHEN refund_status = 'pending' THEN 1 END) as pending_count,
  COUNT(CASE WHEN refund_status = 'completed' THEN 1 END) as completed_count,
  SUM(refunded_amount) as total_refunded_amount
FROM refunds
WHERE created_at > NOW() - interval '1 minute';

-- Show sample data
SELECT
  r.id,
  r.refund_status,
  r.refunded_amount,
  r.created_at,
  res.total_amount as reservation_amount,
  u.name as user_name,
  s.name as shop_name
FROM refunds r
INNER JOIN reservations res ON r.reservation_id = res.id
INNER JOIN users u ON res.user_id = u.id
INNER JOIN shops s ON res.shop_id = s.id
ORDER BY r.created_at DESC
LIMIT 10;
