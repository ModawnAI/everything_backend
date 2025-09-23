-- Complete RLS Fix - All Tables from Schema
-- Systematically enables RLS on ALL tables that exist

-- =============================================
-- 1. ENABLE RLS ON ALL EXISTING TABLES
-- =============================================

DO $$
BEGIN
    -- Core business tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops' AND table_schema = 'public') THEN
        ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'payments' AND table_schema = 'public') THEN
        ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_services' AND table_schema = 'public') THEN
        ALTER TABLE public.shop_services ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_services' AND table_schema = 'public') THEN
        ALTER TABLE public.reservation_services ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Category and service tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_categories' AND table_schema = 'public') THEN
        ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_types' AND table_schema = 'public') THEN
        ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_hierarchy' AND table_schema = 'public') THEN
        ALTER TABLE public.category_hierarchy ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'category_metadata' AND table_schema = 'public') THEN
        ALTER TABLE public.category_metadata ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_type_metadata' AND table_schema = 'public') THEN
        ALTER TABLE public.service_type_metadata ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Social feed tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'feed_posts' AND table_schema = 'public') THEN
        ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_comments' AND table_schema = 'public') THEN
        ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_likes' AND table_schema = 'public') THEN
        ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_images' AND table_schema = 'public') THEN
        ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_likes' AND table_schema = 'public') THEN
        ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- User interaction tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_favorites' AND table_schema = 'public') THEN
        ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_settings' AND table_schema = 'public') THEN
        ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'push_tokens' AND table_schema = 'public') THEN
        ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Referral system tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referrals' AND table_schema = 'public') THEN
        ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_codes' AND table_schema = 'public') THEN
        ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'referral_analytics' AND table_schema = 'public') THEN
        ALTER TABLE public.referral_analytics ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'influencer_promotions' AND table_schema = 'public') THEN
        ALTER TABLE public.influencer_promotions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Notification system
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'notifications' AND table_schema = 'public') THEN
        ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Image management
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_images' AND table_schema = 'public') THEN
        ALTER TABLE public.shop_images ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_images' AND table_schema = 'public') THEN
        ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Reporting and moderation
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.shop_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'post_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'comment_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'content_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Moderation system
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_actions' AND table_schema = 'public') THEN
        ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_audit_trail' AND table_schema = 'public') THEN
        ALTER TABLE public.moderation_audit_trail ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_log' AND table_schema = 'public') THEN
        ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'moderation_rules' AND table_schema = 'public') THEN
        ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Admin and system tables
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'admin_actions' AND table_schema = 'public') THEN
        ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'announcements' AND table_schema = 'public') THEN
        ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'faqs' AND table_schema = 'public') THEN
        ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Monitoring and analytics
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monitoring_alerts' AND table_schema = 'public') THEN
        ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monitoring_dashboard_widgets' AND table_schema = 'public') THEN
        ALTER TABLE public.monitoring_dashboard_widgets ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monitoring_metrics_history' AND table_schema = 'public') THEN
        ALTER TABLE public.monitoring_metrics_history ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'monitoring_sla_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.monitoring_sla_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Security and error handling
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events' AND table_schema = 'public') THEN
        ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'error_reports' AND table_schema = 'public') THEN
        ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Conflict resolution
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conflict_detection_log' AND table_schema = 'public') THEN
        ALTER TABLE public.conflict_detection_log ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conflict_resolution_actions' AND table_schema = 'public') THEN
        ALTER TABLE public.conflict_resolution_actions ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'conflict_resolution_strategies' AND table_schema = 'public') THEN
        ALTER TABLE public.conflict_resolution_strategies ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Performance and retry system
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'advisory_lock_metrics' AND table_schema = 'public') THEN
        ALTER TABLE public.advisory_lock_metrics ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retry_operations' AND table_schema = 'public') THEN
        ALTER TABLE public.retry_operations ENABLE ROW LEVEL SECURITY;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'retry_attempts' AND table_schema = 'public') THEN
        ALTER TABLE public.retry_attempts ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Status tracking
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_status_logs' AND table_schema = 'public') THEN
        ALTER TABLE public.reservation_status_logs ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Authentication
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'refresh_tokens' AND table_schema = 'public') THEN
        ALTER TABLE public.refresh_tokens ENABLE ROW LEVEL SECURITY;
    END IF;
    
    -- Skip PostGIS system table
    -- spatial_ref_sys is a PostGIS system table, skip it
    
END $$;

-- =============================================
-- 2. DROP AND RECREATE VIEWS (NO SECURITY DEFINER)
-- =============================================

-- Drop all existing views first
DROP VIEW IF EXISTS public.active_categories_with_services CASCADE;
DROP VIEW IF EXISTS public.popular_services_by_category CASCADE;
DROP VIEW IF EXISTS public.admin_shops_summary CASCADE;
DROP VIEW IF EXISTS public.shop_performance_metrics CASCADE;
DROP VIEW IF EXISTS public.user_activity_summary CASCADE;
DROP VIEW IF EXISTS public.reservation_analytics CASCADE;
DROP VIEW IF EXISTS public.security_incidents_summary CASCADE;
DROP VIEW IF EXISTS public.cdn_cache_stats CASCADE;
DROP VIEW IF EXISTS public.admin_users_summary CASCADE;

-- Recreate views only if required tables exist
DO $$
BEGIN
    -- active_categories_with_services view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_categories' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'service_types' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.active_categories_with_services AS
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
        ORDER BY c.sort_order, c.display_name';
    END IF;
    
    -- popular_services_by_category view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shop_services' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservation_services' AND table_schema = 'public')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.popular_services_by_category AS
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
        ORDER BY s.category, reservation_count DESC';
    END IF;
    
    -- admin_shops_summary view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.admin_shops_summary AS
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
        ORDER BY s.created_at DESC';
    END IF;
    
    -- shop_performance_metrics view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'shops' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.shop_performance_metrics AS
        SELECT 
            s.id as shop_id,
            s.name as shop_name,
            COUNT(r.id) as total_reservations,
            COUNT(CASE WHEN r.status = ''completed'' THEN 1 END) as completed_reservations,
            COUNT(CASE WHEN r.status IN (''cancelled_by_user'', ''cancelled_by_shop'') THEN 1 END) as cancelled_reservations
        FROM public.shops s
        LEFT JOIN public.reservations r ON s.id = r.shop_id
        GROUP BY s.id, s.name
        ORDER BY total_reservations DESC';
    END IF;
    
    -- user_activity_summary view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.user_activity_summary AS
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
        ORDER BY u.created_at DESC';
    END IF;
    
    -- reservation_analytics view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.reservation_analytics AS
        SELECT 
            DATE_TRUNC(''day'', created_at) as date,
            COUNT(*) as total_reservations,
            COUNT(CASE WHEN status = ''completed'' THEN 1 END) as completed_reservations,
            COUNT(CASE WHEN status IN (''cancelled_by_user'', ''cancelled_by_shop'') THEN 1 END) as cancelled_reservations
        FROM public.reservations
        WHERE created_at >= CURRENT_DATE - INTERVAL ''30 days''
        GROUP BY DATE_TRUNC(''day'', created_at)
        ORDER BY date DESC';
    END IF;
    
    -- security_incidents_summary view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'security_events' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.security_incidents_summary AS
        SELECT 
            DATE_TRUNC(''day'', created_at) as date,
            COUNT(*) as total_incidents,
            COUNT(CASE WHEN severity = ''high'' THEN 1 END) as high_severity_incidents
        FROM public.security_events
        WHERE created_at >= CURRENT_DATE - INTERVAL ''30 days''
        GROUP BY DATE_TRUNC(''day'', created_at)
        ORDER BY date DESC';
    END IF;
    
    -- admin_users_summary view
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users' AND table_schema = 'public') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'reservations' AND table_schema = 'public') THEN
        EXECUTE 'CREATE VIEW public.admin_users_summary AS
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
        ORDER BY u.created_at DESC';
    END IF;
END $$;

-- Done! All RLS errors should be fixed now.
