-- =====================================================
-- Analytics RPC Functions for Performance Optimization
-- =====================================================
-- These functions perform aggregations in the database instead of
-- fetching all rows and filtering in JavaScript

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_shop_reservations_stats(uuid, timestamptz, timestamptz);
DROP FUNCTION IF EXISTS get_shop_payments_stats(uuid, timestamptz, timestamptz);

-- =====================================================
-- Function: get_shop_reservations_stats
-- Purpose: Get aggregated reservation statistics for a shop
-- Parameters:
--   p_shop_id: Shop UUID
--   p_start_date: Start of date range
--   p_end_date: End of date range
-- Returns: JSON object with counts by status
-- =====================================================
CREATE OR REPLACE FUNCTION get_shop_reservations_stats(
  p_shop_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total', COUNT(*),
    'confirmed', COUNT(*) FILTER (WHERE status = 'confirmed'),
    'completed', COUNT(*) FILTER (WHERE status = 'completed'),
    'cancelled_by_user', COUNT(*) FILTER (WHERE status = 'cancelled_by_user'),
    'cancelled_by_shop', COUNT(*) FILTER (WHERE status = 'cancelled_by_shop'),
    'requested', COUNT(*) FILTER (WHERE status = 'requested'),
    'no_show', COUNT(*) FILTER (WHERE status = 'no_show')
  )
  INTO v_result
  FROM reservations
  WHERE shop_id = p_shop_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  RETURN v_result;
END;
$$;

-- =====================================================
-- Function: get_shop_payments_stats
-- Purpose: Get aggregated payment statistics for a shop
-- Parameters:
--   p_shop_id: Shop UUID
--   p_start_date: Start of date range
--   p_end_date: End of date range
-- Returns: JSON object with revenue and counts by status
-- =====================================================
CREATE OR REPLACE FUNCTION get_shop_payments_stats(
  p_shop_id UUID,
  p_start_date TIMESTAMPTZ,
  p_end_date TIMESTAMPTZ
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result JSON;
BEGIN
  SELECT json_build_object(
    'total_revenue', COALESCE(SUM(amount) FILTER (WHERE status IN ('paid', 'completed')), 0),
    'total_count', COUNT(*),
    'pending', COUNT(*) FILTER (WHERE status = 'pending'),
    'completed', COUNT(*) FILTER (WHERE status IN ('paid', 'completed')),
    'failed', COUNT(*) FILTER (WHERE status = 'failed')
  )
  INTO v_result
  FROM payments
  WHERE shop_id = p_shop_id
    AND created_at >= p_start_date
    AND created_at <= p_end_date;

  RETURN v_result;
END;
$$;

-- =====================================================
-- Grant execute permissions
-- =====================================================
GRANT EXECUTE ON FUNCTION get_shop_reservations_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION get_shop_payments_stats(UUID, TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- =====================================================
-- Test queries (commented out - uncomment to test)
-- =====================================================
-- SELECT get_shop_reservations_stats(
--   'your-shop-uuid-here'::uuid,
--   NOW() - INTERVAL '7 days',
--   NOW()
-- );

-- SELECT get_shop_payments_stats(
--   'your-shop-uuid-here'::uuid,
--   NOW() - INTERVAL '7 days',
--   NOW()
-- );
