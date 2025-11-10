-- =============================================
-- Fix Materialized Views for Correct Dashboard Data
-- =============================================
-- This script recreates the materialized views with proper date handling
-- and calculations that work with the actual test data

-- Drop existing views to recreate them
DROP MATERIALIZED VIEW IF EXISTS dashboard_quick_metrics;
DROP MATERIALIZED VIEW IF EXISTS revenue_daily_trends;
DROP MATERIALIZED VIEW IF EXISTS user_growth_daily_trends;
DROP MATERIALIZED VIEW IF EXISTS reservation_daily_trends;

-- =============================================
-- 1. Dashboard Quick Metrics (Main dashboard)
-- =============================================
CREATE MATERIALIZED VIEW dashboard_quick_metrics AS
WITH
current_date_info AS (
  SELECT
    CURRENT_DATE as today,
    DATE_TRUNC('month', CURRENT_DATE) as month_start,
    DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '1 month' as prev_month_start,
    DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day' as month_end
),
user_metrics AS (
  SELECT
    COUNT(*) as total_users,
    COUNT(*) FILTER (WHERE user_status = 'active') as active_users,
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = (SELECT month_start FROM current_date_info)) as new_users_this_month,
    COUNT(*) FILTER (WHERE DATE_TRUNC('month', created_at) = (SELECT prev_month_start FROM current_date_info)) as new_users_prev_month
  FROM users
),
revenue_metrics AS (
  SELECT
    COALESCE(SUM(amount), 0) as total_revenue,
    COALESCE(SUM(amount) FILTER (WHERE DATE(created_at) = (SELECT today FROM current_date_info)), 0) as today_revenue,
    COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', created_at) = (SELECT month_start FROM current_date_info)), 0) as month_revenue,
    COALESCE(SUM(amount) FILTER (WHERE DATE_TRUNC('month', created_at) = (SELECT prev_month_start FROM current_date_info)), 0) as prev_month_revenue
  FROM payments
  WHERE amount IS NOT NULL
),
reservation_metrics AS (
  SELECT
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE status IN ('confirmed', 'requested')) as active_reservations,
    COUNT(*) FILTER (WHERE DATE(created_at) = (SELECT today FROM current_date_info)) as today_reservations,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_reservations
  FROM reservations
),
shop_metrics AS (
  SELECT
    COUNT(*) as total_shops,
    COUNT(*) FILTER (WHERE shop_status = 'active') as active_shops,
    COUNT(*) FILTER (WHERE shop_status = 'pending_approval') as pending_approvals
  FROM shops
),
payment_metrics AS (
  SELECT
    COUNT(*) as total_transactions,
    COUNT(*) FILTER (WHERE status IN ('fully_paid', 'deposit_paid')) as successful_transactions
  FROM payments
)
SELECT
  u.total_users,
  u.active_users,
  u.new_users_this_month,
  CASE
    WHEN u.new_users_prev_month > 0
    THEN ROUND(((u.new_users_this_month::numeric - u.new_users_prev_month::numeric) / u.new_users_prev_month::numeric * 100), 2)
    ELSE 0
  END as user_growth_rate,

  r.total_revenue,
  r.today_revenue,
  r.month_revenue,
  CASE
    WHEN r.prev_month_revenue > 0
    THEN ROUND(((r.month_revenue::numeric - r.prev_month_revenue::numeric) / r.prev_month_revenue::numeric * 100), 2)
    ELSE 0
  END as revenue_growth_rate,

  res.total_reservations,
  res.active_reservations,
  res.today_reservations,
  CASE
    WHEN res.total_reservations > 0
    THEN ROUND((res.completed_reservations::numeric / res.total_reservations::numeric * 100), 2)
    ELSE 0
  END as reservation_success_rate,

  s.total_shops,
  s.active_shops,
  s.pending_approvals,

  p.total_transactions,
  p.successful_transactions,
  CASE
    WHEN p.total_transactions > 0
    THEN ROUND((p.successful_transactions::numeric / p.total_transactions::numeric * 100), 2)
    ELSE 0
  END as conversion_rate,

  NOW() as last_updated
FROM user_metrics u, revenue_metrics r, reservation_metrics res, shop_metrics s, payment_metrics p;

-- =============================================
-- 2. Revenue Daily Trends
-- =============================================
CREATE MATERIALIZED VIEW revenue_daily_trends AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '90 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date as date
),
daily_revenue AS (
  SELECT
    DATE(created_at) as date,
    COALESCE(SUM(amount), 0) as total_revenue,
    COUNT(*) as transaction_count,
    COALESCE(AVG(amount), 0) as avg_transaction_value
  FROM payments
  WHERE amount IS NOT NULL
    AND created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(created_at)
)
SELECT
  ds.date,
  COALESCE(dr.total_revenue, 0) as total_revenue,
  COALESCE(dr.transaction_count, 0) as transaction_count,
  COALESCE(dr.avg_transaction_value, 0) as avg_transaction_value
FROM date_series ds
LEFT JOIN daily_revenue dr ON ds.date = dr.date
ORDER BY ds.date DESC;

-- =============================================
-- 3. User Growth Daily Trends
-- =============================================
CREATE MATERIALIZED VIEW user_growth_daily_trends AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '90 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date as date
),
daily_users AS (
  SELECT
    DATE(created_at) as date,
    COUNT(*) as new_users
  FROM users
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(created_at)
),
active_users AS (
  SELECT
    DATE(last_active_at) as date,
    COUNT(DISTINCT id) as active_users
  FROM users
  WHERE last_active_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(last_active_at)
)
SELECT
  ds.date,
  COALESCE(du.new_users, 0) as new_users,
  COALESCE(au.active_users, 0) as active_users
FROM date_series ds
LEFT JOIN daily_users du ON ds.date = du.date
LEFT JOIN active_users au ON ds.date = au.date
ORDER BY ds.date DESC;

-- =============================================
-- 4. Reservation Daily Trends
-- =============================================
CREATE MATERIALIZED VIEW reservation_daily_trends AS
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE - INTERVAL '90 days',
    CURRENT_DATE,
    INTERVAL '1 day'
  )::date as date
),
daily_reservations AS (
  SELECT
    DATE(created_at) as date,
    COUNT(*) as total_reservations,
    COUNT(*) FILTER (WHERE status = 'completed') as completed_reservations,
    COUNT(*) FILTER (WHERE status IN ('cancelled_by_user', 'cancelled_by_shop', 'no_show')) as cancelled_reservations
  FROM reservations
  WHERE created_at >= CURRENT_DATE - INTERVAL '90 days'
  GROUP BY DATE(created_at)
)
SELECT
  ds.date,
  COALESCE(dr.total_reservations, 0) as total_reservations,
  COALESCE(dr.completed_reservations, 0) as completed_reservations,
  COALESCE(dr.cancelled_reservations, 0) as cancelled_reservations,
  CASE
    WHEN COALESCE(dr.total_reservations, 0) > 0
    THEN ROUND((COALESCE(dr.completed_reservations, 0)::numeric / dr.total_reservations::numeric * 100), 2)
    ELSE 0
  END as completion_rate
FROM date_series ds
LEFT JOIN daily_reservations dr ON ds.date = dr.date
ORDER BY ds.date DESC;

-- =============================================
-- Create indexes for better performance
-- =============================================
CREATE UNIQUE INDEX IF NOT EXISTS idx_dashboard_quick_metrics_unique ON dashboard_quick_metrics (last_updated);
CREATE INDEX IF NOT EXISTS idx_revenue_daily_trends_date ON revenue_daily_trends (date);
CREATE INDEX IF NOT EXISTS idx_user_growth_daily_trends_date ON user_growth_daily_trends (date);
CREATE INDEX IF NOT EXISTS idx_reservation_daily_trends_date ON reservation_daily_trends (date);

-- =============================================
-- Create a function to refresh all views
-- =============================================
CREATE OR REPLACE FUNCTION refresh_analytics_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_quick_metrics;
  REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY user_growth_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY reservation_daily_trends;
  REFRESH MATERIALIZED VIEW CONCURRENTLY shop_performance_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY payment_status_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY point_transaction_summary;
  REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_summary;
END;
$$ LANGUAGE plpgsql;