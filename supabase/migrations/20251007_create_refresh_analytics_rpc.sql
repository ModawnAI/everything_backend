-- ============================================
-- RPC Function for Manual Analytics Refresh
-- ============================================

-- This function allows manual refresh of all analytics materialized views
-- Useful for admin dashboard "Refresh Now" button or API endpoint

CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  start_time timestamp;
  end_time timestamp;
  result json;
BEGIN
  start_time := clock_timestamp();

  -- Refresh all materialized views concurrently (non-blocking)
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_quick_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_growth_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY reservation_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY shop_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY payment_status_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY point_transaction_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_summary;

  end_time := clock_timestamp();

  result := json_build_object(
    'success', true,
    'message', 'All analytics views refreshed successfully',
    'views_refreshed', 8,
    'duration_ms', EXTRACT(MILLISECONDS FROM (end_time - start_time)),
    'refreshed_at', end_time
  );

  RETURN result;

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM,
      'message', 'Failed to refresh analytics views'
    );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION refresh_analytics_views() TO authenticated;

-- ============================================
-- Helper Function: Get View Last Updated Time
-- ============================================

CREATE OR REPLACE FUNCTION get_analytics_view_status()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result json;
BEGIN
  result := json_build_object(
    'dashboard_quick_metrics', (
      SELECT last_updated FROM dashboard_quick_metrics LIMIT 1
    ),
    'user_growth_daily_trends', (
      SELECT last_updated FROM user_growth_daily_trends ORDER BY date DESC LIMIT 1
    ),
    'revenue_daily_trends', (
      SELECT last_updated FROM revenue_daily_trends ORDER BY date DESC LIMIT 1
    ),
    'reservation_daily_trends', (
      SELECT last_updated FROM reservation_daily_trends ORDER BY date DESC LIMIT 1
    ),
    'shop_performance_summary', (
      SELECT last_updated FROM shop_performance_summary LIMIT 1
    ),
    'payment_status_summary', (
      SELECT last_updated FROM payment_status_summary LIMIT 1
    ),
    'point_transaction_summary', (
      SELECT last_updated FROM point_transaction_summary LIMIT 1
    ),
    'category_performance_summary', (
      SELECT last_updated FROM category_performance_summary LIMIT 1
    )
  );

  RETURN result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION get_analytics_view_status() TO authenticated;

-- ============================================
-- Usage Examples
-- ============================================

-- Call from SQL:
-- SELECT refresh_analytics_views();

-- Call from Supabase client (Node.js):
-- const { data, error } = await supabase.rpc('refresh_analytics_views');

-- Get view status:
-- SELECT get_analytics_view_status();
