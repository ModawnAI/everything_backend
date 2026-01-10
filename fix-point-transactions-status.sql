-- Fix point transactions that are missing status field
-- This script updates all transactions without a status to have status='available'
-- and sets appropriate available_from and expires_at dates

UPDATE point_transactions
SET
  status = 'available',
  available_from = COALESCE(available_from, created_at),
  expires_at = COALESCE(expires_at, created_at + INTERVAL '1 year'),
  updated_at = NOW()
WHERE status IS NULL
  AND transaction_type IN ('earned_service', 'earned_referral', 'influencer_bonus', 'adjusted')
  AND amount > 0;

-- Log the number of rows updated
DO $$
DECLARE
  updated_count INTEGER;
BEGIN
  GET DIAGNOSTICS updated_count = ROW_COUNT;
  RAISE NOTICE 'Updated % point transactions with status=available', updated_count;
END $$;

-- Verify the update for our specific user
SELECT
  id,
  user_id,
  amount,
  transaction_type,
  status,
  available_from,
  expires_at,
  description,
  created_at
FROM point_transactions
WHERE user_id = '33b92c15-e34c-41f7-83ed-c6582ef7fc68'
ORDER BY created_at DESC
LIMIT 10;
