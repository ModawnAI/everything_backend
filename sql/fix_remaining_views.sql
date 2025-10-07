-- Fix Remaining Security Definer Views
-- This script specifically targets the remaining views that still have SECURITY DEFINER

-- =============================================
-- 1. FORCE DROP ALL REMAINING VIEWS
-- =============================================

-- Drop all the specific views mentioned in the linter report
DROP VIEW IF EXISTS public.shop_performance_metrics CASCADE;
DROP VIEW IF EXISTS public.admin_users_summary CASCADE;
DROP VIEW IF EXISTS public.reservation_analytics CASCADE;
DROP VIEW IF EXISTS public.admin_shops_summary CASCADE;
DROP VIEW IF EXISTS public.security_incidents_summary CASCADE;
DROP VIEW IF EXISTS public.user_activity_summary CASCADE;
DROP VIEW IF EXISTS public.active_categories_with_services CASCADE;
DROP VIEW IF EXISTS public.popular_services_by_category CASCADE;
DROP VIEW IF EXISTS public.security_dashboard CASCADE;

-- =============================================
-- 2. RECREATE ALL VIEWS AS SIMPLE VIEWS (NO SECURITY DEFINER)
-- =============================================

-- View 1: active_categories_with_services
CREATE VIEW public.active_categories_with_services AS
SELECT 
    c.id,
    c.display_name as name,
    c.description,
    c.sort_order as level,
    c.created_at,
    c.updated_at,
    COUNT(s.id) as service_count
FROM public.shop_categories c
LEFT JOIN public.service_types s ON c.id = s.category_id AND s.is_active = true
WHERE c.is_active = true
GROUP BY c.id, c.display_name, c.description, c.sort_order, c.created_at, c.updated_at
ORDER BY c.sort_order, c.display_name;

-- View 2: popular_services_by_category
CREATE VIEW public.popular_services_by_category AS
SELECT 
    s.category as category_id,
    s.category as category_name,
    s.id as service_id,
    s.name as service_name,
    COUNT(r.id) as reservation_count
FROM public.shop_services s
LEFT JOIN public.reservation_services rs ON s.id = rs.service_id
LEFT JOIN public.reservations r ON rs.reservation_id = r.id
WHERE s.is_available = true
GROUP BY s.category, s.id, s.name
ORDER BY s.category, reservation_count DESC;

-- View 3: admin_shops_summary
CREATE VIEW public.admin_shops_summary AS
SELECT 
    s.id,
    s.name,
    s.shop_status,
    s.verification_status,
    s.created_at,
    u.name as owner_name,
    u.email as owner_email
FROM public.shops s
LEFT JOIN public.users u ON s.owner_id = u.id
ORDER BY s.created_at DESC;

-- View 4: shop_performance_metrics
CREATE VIEW public.shop_performance_metrics AS
SELECT 
    s.id as shop_id,
    s.name as shop_name,
    COUNT(r.id) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations,
    COUNT(CASE WHEN r.status IN ('cancelled_by_user', 'cancelled_by_shop') THEN 1 END) as cancelled_reservations
FROM public.shops s
LEFT JOIN public.reservations r ON s.id = r.shop_id
GROUP BY s.id, s.name
ORDER BY total_reservations DESC;

-- View 5: user_activity_summary
CREATE VIEW public.user_activity_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.user_status,
    COUNT(r.id) as total_reservations,
    u.created_at
FROM public.users u
LEFT JOIN public.reservations r ON u.id = r.user_id
GROUP BY u.id, u.name, u.email, u.user_status, u.created_at
ORDER BY u.created_at DESC;

-- View 6: reservation_analytics
CREATE VIEW public.reservation_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_reservations,
    COUNT(CASE WHEN status IN ('cancelled_by_user', 'cancelled_by_shop') THEN 1 END) as cancelled_reservations
FROM public.reservations
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View 7: security_incidents_summary
CREATE VIEW public.security_incidents_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_incidents
FROM public.security_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- View 8: admin_users_summary
CREATE VIEW public.admin_users_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.user_role,
    u.user_status,
    u.created_at,
    COUNT(r.id) as reservation_count
FROM public.users u
LEFT JOIN public.reservations r ON u.id = r.user_id
GROUP BY u.id, u.name, u.email, u.user_role, u.user_status, u.created_at
ORDER BY u.created_at DESC;

-- View 9: security_dashboard
CREATE VIEW public.security_dashboard AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_events
FROM public.security_events
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

-- =============================================
-- 3. NOTE ABOUT POSTGIS SYSTEM TABLE
-- =============================================

-- Note: spatial_ref_sys is a PostGIS system table that cannot be modified
-- This is a system table and RLS cannot be enabled on it
-- This is expected behavior and not a security concern

-- Done! All remaining security definer view issues should be resolved.
