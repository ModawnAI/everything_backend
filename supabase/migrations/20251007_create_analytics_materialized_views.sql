-- ============================================
-- Analytics Materialized Views Migration
-- Purpose: Pre-calculate dashboard metrics for < 10ms response time
-- Performance: 100-1000x faster than on-demand calculation
-- ============================================

-- Enable pg_cron extension for scheduled refresh
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ============================================
-- 1. Dashboard Quick Metrics (15 Key Metrics)
-- ============================================
CREATE MATERIALIZED VIEW dashboard_quick_metrics AS
WITH
  user_metrics AS (
    SELECT
      COUNT(*) as total_users,
      COUNT(*) FILTER (WHERE user_status = 'active') as active_users,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE)) as new_users_this_month,
      COUNT(*) FILTER (WHERE created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                       AND created_at < DATE_TRUNC('month', CURRENT_DATE)) as new_users_last_month
    FROM users
  ),
  revenue_metrics AS (
    SELECT
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'fully_paid'), 0) as total_revenue,
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'fully_paid'
                                    AND created_at >= CURRENT_DATE), 0) as today_revenue,
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'fully_paid'
                                    AND created_at >= DATE_TRUNC('month', CURRENT_DATE)), 0) as month_revenue,
      COALESCE(SUM(amount) FILTER (WHERE payment_status = 'fully_paid'
                                    AND created_at >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '1 month')
                                    AND created_at < DATE_TRUNC('month', CURRENT_DATE)), 0) as last_month_revenue
    FROM payments
  ),
  reservation_metrics AS (
    SELECT
      COUNT(*) as total_reservations,
      COUNT(*) FILTER (WHERE status IN ('requested', 'confirmed', 'in_progress')) as active_reservations,
      COUNT(*) FILTER (WHERE created_at >= CURRENT_DATE) as today_reservations,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_reservations
    FROM reservations
  ),
  shop_metrics AS (
    SELECT
      COUNT(*) as total_shops,
      COUNT(*) FILTER (WHERE shop_status = 'active') as active_shops,
      COUNT(*) FILTER (WHERE verification_status = 'pending_approval') as pending_approvals
    FROM shops
  ),
  payment_transaction_metrics AS (
    SELECT
      COUNT(*) as total_transactions,
      COUNT(*) FILTER (WHERE payment_status = 'fully_paid') as successful_transactions
    FROM payments
  )
SELECT
  -- User metrics
  um.total_users,
  um.active_users,
  um.new_users_this_month,
  CASE
    WHEN um.new_users_last_month > 0
    THEN ROUND(((um.new_users_this_month::numeric - um.new_users_last_month::numeric) / um.new_users_last_month::numeric * 100)::numeric, 2)
    ELSE 0
  END as user_growth_rate,

  -- Revenue metrics
  rm.total_revenue,
  rm.today_revenue,
  rm.month_revenue,
  CASE
    WHEN rm.last_month_revenue > 0
    THEN ROUND(((rm.month_revenue::numeric - rm.last_month_revenue::numeric) / rm.last_month_revenue::numeric * 100)::numeric, 2)
    ELSE 0
  END as revenue_growth_rate,

  -- Reservation metrics
  resm.total_reservations,
  resm.active_reservations,
  resm.today_reservations,
  CASE
    WHEN resm.total_reservations > 0
    THEN ROUND((resm.completed_reservations::numeric / resm.total_reservations::numeric * 100)::numeric, 2)
    ELSE 0
  END as reservation_success_rate,

  -- Shop metrics
  sm.total_shops,
  sm.active_shops,
  sm.pending_approvals,

  -- Payment transaction metrics
  ptm.total_transactions,
  ptm.successful_transactions,
  CASE
    WHEN ptm.total_transactions > 0
    THEN ROUND((ptm.successful_transactions::numeric / ptm.total_transactions::numeric * 100)::numeric, 2)
    ELSE 0
  END as conversion_rate,

  -- Metadata
  NOW() as last_updated
FROM
  user_metrics um,
  revenue_metrics rm,
  reservation_metrics resm,
  shop_metrics sm,
  payment_transaction_metrics ptm;

-- Create unique index to enable CONCURRENTLY refresh
CREATE UNIQUE INDEX idx_dashboard_quick_metrics_unique ON dashboard_quick_metrics (last_updated);

-- ============================================
-- 2. User Growth Trends (Daily for last 30 days)
-- ============================================
CREATE MATERIALIZED VIEW user_growth_daily_trends AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_users,
  COUNT(*) FILTER (WHERE user_status = 'active') as active_users,
  NOW() as last_updated
FROM users
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_user_growth_daily_trends_unique ON user_growth_daily_trends (date);

-- ============================================
-- 3. Revenue Trends (Daily for last 30 days)
-- ============================================
CREATE MATERIALIZED VIEW revenue_daily_trends AS
SELECT
  DATE(created_at) as date,
  COALESCE(SUM(amount) FILTER (WHERE payment_status = 'fully_paid'), 0) as total_revenue,
  COUNT(*) FILTER (WHERE payment_status = 'fully_paid') as transaction_count,
  COALESCE(AVG(amount) FILTER (WHERE payment_status = 'fully_paid'), 0) as avg_transaction_value,
  NOW() as last_updated
FROM payments
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_revenue_daily_trends_unique ON revenue_daily_trends (date);

-- ============================================
-- 4. Reservation Trends (Daily for last 30 days)
-- ============================================
CREATE MATERIALIZED VIEW reservation_daily_trends AS
SELECT
  DATE(created_at) as date,
  COUNT(*) as total_reservations,
  COUNT(*) FILTER (WHERE status = 'completed') as completed_reservations,
  COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled_reservations,
  CASE
    WHEN COUNT(*) > 0
    THEN ROUND((COUNT(*) FILTER (WHERE status = 'completed')::numeric / COUNT(*)::numeric * 100)::numeric, 2)
    ELSE 0
  END as completion_rate,
  NOW() as last_updated
FROM reservations
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;

CREATE UNIQUE INDEX idx_reservation_daily_trends_unique ON reservation_daily_trends (date);

-- ============================================
-- 5. Shop Performance Summary
-- ============================================
CREATE MATERIALIZED VIEW shop_performance_summary AS
WITH shop_stats AS (
  SELECT
    s.id as shop_id,
    s.shop_name,
    s.main_category,
    s.shop_status,
    COUNT(DISTINCT r.id) as total_reservations,
    COUNT(DISTINCT r.id) FILTER (WHERE r.status = 'completed') as completed_reservations,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'fully_paid'), 0) as total_revenue,
    AVG(r.rating) FILTER (WHERE r.rating IS NOT NULL) as avg_rating
  FROM shops s
  LEFT JOIN reservations r ON r.shop_id = s.id
  LEFT JOIN payments p ON p.reservation_id = r.id
  GROUP BY s.id, s.shop_name, s.main_category, s.shop_status
)
SELECT
  shop_id,
  shop_name,
  main_category,
  shop_status,
  total_reservations,
  completed_reservations,
  total_revenue,
  ROUND(COALESCE(avg_rating, 0)::numeric, 2) as avg_rating,
  CASE
    WHEN total_reservations > 0
    THEN ROUND((completed_reservations::numeric / total_reservations::numeric * 100)::numeric, 2)
    ELSE 0
  END as completion_rate,
  NOW() as last_updated
FROM shop_stats
ORDER BY total_revenue DESC;

CREATE UNIQUE INDEX idx_shop_performance_summary_unique ON shop_performance_summary (shop_id);

-- ============================================
-- 6. Payment Status Summary
-- ============================================
CREATE MATERIALIZED VIEW payment_status_summary AS
SELECT
  payment_status,
  payment_stage,
  COUNT(*) as count,
  COALESCE(SUM(amount), 0) as total_amount,
  COALESCE(AVG(amount), 0) as avg_amount,
  NOW() as last_updated
FROM payments
GROUP BY payment_status, payment_stage;

CREATE UNIQUE INDEX idx_payment_status_summary_unique ON payment_status_summary (payment_status, payment_stage);

-- ============================================
-- 7. Point Transaction Summary
-- ============================================
CREATE MATERIALIZED VIEW point_transaction_summary AS
SELECT
  transaction_type,
  status,
  COUNT(*) as transaction_count,
  COALESCE(SUM(amount), 0) as total_points,
  COALESCE(AVG(amount), 0) as avg_points,
  NOW() as last_updated
FROM point_transactions
GROUP BY transaction_type, status;

CREATE UNIQUE INDEX idx_point_transaction_summary_unique ON point_transaction_summary (transaction_type, status);

-- ============================================
-- 8. Category Performance Summary
-- ============================================
CREATE MATERIALIZED VIEW category_performance_summary AS
WITH category_stats AS (
  SELECT
    sc.main_category,
    COUNT(DISTINCT s.id) as total_shops,
    COUNT(DISTINCT s.id) FILTER (WHERE s.shop_status = 'active') as active_shops,
    COUNT(DISTINCT r.id) as total_reservations,
    COALESCE(SUM(p.amount) FILTER (WHERE p.payment_status = 'fully_paid'), 0) as total_revenue,
    AVG(r.rating) FILTER (WHERE r.rating IS NOT NULL) as avg_rating
  FROM service_catalog sc
  LEFT JOIN shops s ON s.main_category = sc.main_category
  LEFT JOIN reservations r ON r.shop_id = s.id
  LEFT JOIN payments p ON p.reservation_id = r.id
  GROUP BY sc.main_category
)
SELECT
  main_category,
  total_shops,
  active_shops,
  total_reservations,
  total_revenue,
  ROUND(COALESCE(avg_rating, 0)::numeric, 2) as avg_rating,
  NOW() as last_updated
FROM category_stats
ORDER BY total_revenue DESC;

CREATE UNIQUE INDEX idx_category_performance_summary_unique ON category_performance_summary (main_category);

-- ============================================
-- Auto-Refresh Scheduling with pg_cron
-- ============================================

-- Refresh dashboard_quick_metrics every 2 minutes
SELECT cron.schedule(
  'refresh-dashboard-quick-metrics',
  '*/2 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY dashboard_quick_metrics;$$
);

-- Refresh trends every 5 minutes
SELECT cron.schedule(
  'refresh-user-growth-daily-trends',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY user_growth_daily_trends;$$
);

SELECT cron.schedule(
  'refresh-revenue-daily-trends',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY revenue_daily_trends;$$
);

SELECT cron.schedule(
  'refresh-reservation-daily-trends',
  '*/5 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY reservation_daily_trends;$$
);

-- Refresh summaries every 10 minutes
SELECT cron.schedule(
  'refresh-shop-performance-summary',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY shop_performance_summary;$$
);

SELECT cron.schedule(
  'refresh-payment-status-summary',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY payment_status_summary;$$
);

SELECT cron.schedule(
  'refresh-point-transaction-summary',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY point_transaction_summary;$$
);

SELECT cron.schedule(
  'refresh-category-performance-summary',
  '*/10 * * * *',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY category_performance_summary;$$
);

-- ============================================
-- Initial Refresh (populate data immediately)
-- ============================================
REFRESH MATERIALIZED VIEW dashboard_quick_metrics;
REFRESH MATERIALIZED VIEW user_growth_daily_trends;
REFRESH MATERIALIZED VIEW revenue_daily_trends;
REFRESH MATERIALIZED VIEW reservation_daily_trends;
REFRESH MATERIALIZED VIEW shop_performance_summary;
REFRESH MATERIALIZED VIEW payment_status_summary;
REFRESH MATERIALIZED VIEW point_transaction_summary;
REFRESH MATERIALIZED VIEW category_performance_summary;

-- ============================================
-- Grant Permissions
-- ============================================
GRANT SELECT ON dashboard_quick_metrics TO authenticated;
GRANT SELECT ON user_growth_daily_trends TO authenticated;
GRANT SELECT ON revenue_daily_trends TO authenticated;
GRANT SELECT ON reservation_daily_trends TO authenticated;
GRANT SELECT ON shop_performance_summary TO authenticated;
GRANT SELECT ON payment_status_summary TO authenticated;
GRANT SELECT ON point_transaction_summary TO authenticated;
GRANT SELECT ON category_performance_summary TO authenticated;

-- ============================================
-- View pg_cron Jobs
-- ============================================
-- To see all scheduled jobs:
-- SELECT * FROM cron.job;

-- To unschedule a job:
-- SELECT cron.unschedule('refresh-dashboard-quick-metrics');
