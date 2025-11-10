-- =============================================
-- Refresh Dashboard Data - Fix Stale Materialized Views
-- =============================================
-- This script refreshes all materialized views to show current data
-- Run this in Supabase SQL Editor to fix the dashboard showing old data

-- Method 1: Use the built-in refresh function
SELECT refresh_analytics_views();

-- Method 2: Manual refresh of each view (if function doesn't exist)
-- REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_quick_metrics;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_daily_trends;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY user_growth_daily_trends;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY reservation_daily_trends;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY shop_performance_summary;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY payment_status_summary;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY point_transaction_summary;
-- REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_summary;

-- Verify the refresh worked by checking user count
SELECT
  total_users,
  active_users,
  new_users_this_month,
  last_updated
FROM dashboard_quick_metrics;