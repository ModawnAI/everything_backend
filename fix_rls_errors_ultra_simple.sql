-- Ultra Simple RLS Fix - Just Fix the Errors
-- No security concerns, just make it work

-- =============================================
-- 1. ENABLE RLS ON ALL TABLES
-- =============================================

ALTER TABLE public.category_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdn_configurations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_hashtags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. DROP AND RECREATE VIEWS (NO SECURITY DEFINER)
-- =============================================

-- Drop all problematic views
DROP VIEW IF EXISTS public.active_categories_with_services CASCADE;
DROP VIEW IF EXISTS public.popular_services_by_category CASCADE;
DROP VIEW IF EXISTS public.admin_shops_summary CASCADE;
DROP VIEW IF EXISTS public.shop_performance_metrics CASCADE;
DROP VIEW IF EXISTS public.user_activity_summary CASCADE;
DROP VIEW IF EXISTS public.reservation_analytics CASCADE;
DROP VIEW IF EXISTS public.security_incidents_summary CASCADE;
DROP VIEW IF EXISTS public.cdn_cache_stats CASCADE;
DROP VIEW IF EXISTS public.admin_users_summary CASCADE;

-- Recreate with basic structure (no SECURITY DEFINER)
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

CREATE VIEW public.popular_services_by_category AS
SELECT 
    c.id as category_id,
    c.display_name as category_name,
    s.id as service_id,
    s.name as service_name,
    COUNT(r.id) as reservation_count
FROM public.shop_categories c
JOIN public.service_types s ON c.id = s.category_id
LEFT JOIN public.reservation_services rs ON s.id = rs.service_id
LEFT JOIN public.reservations r ON rs.reservation_id = r.id
WHERE c.is_active = true AND s.is_active = true
GROUP BY c.id, c.display_name, s.id, s.name
ORDER BY c.display_name, reservation_count DESC;

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

CREATE VIEW public.shop_performance_metrics AS
SELECT 
    s.id as shop_id,
    s.name as shop_name,
    COUNT(r.id) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations,
    AVG(r.rating) as average_rating
FROM public.shops s
LEFT JOIN public.reservations r ON s.id = r.shop_id
GROUP BY s.id, s.name
ORDER BY total_reservations DESC;

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

CREATE VIEW public.reservation_analytics AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_reservations,
    COUNT(CASE WHEN status = 'completed' THEN 1 END) as completed_reservations,
    COUNT(CASE WHEN status = 'cancelled' THEN 1 END) as cancelled_reservations
FROM public.reservations
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE VIEW public.security_incidents_summary AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_incidents,
    COUNT(CASE WHEN severity = 'high' THEN 1 END) as high_severity_incidents
FROM public.security_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE VIEW public.cdn_cache_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_configurations,
    COUNT(CASE WHEN is_active = true THEN 1 END) as active_configurations
FROM public.cdn_configurations
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

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

-- Done! All errors should be fixed now.
