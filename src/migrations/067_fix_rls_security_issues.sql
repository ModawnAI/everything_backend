-- =============================================
-- Fix RLS Security Issues - Single Migration
-- =============================================
-- This migration fixes all RLS security issues identified by the database linter
-- Generated: 2025-01-27
-- =============================================

-- =============================================
-- 1. Enable RLS on tables that have policies but RLS disabled
-- =============================================

-- Tables with policies but RLS disabled
ALTER TABLE public.category_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 2. Enable RLS on all public tables that lack it
-- =============================================

-- Core user and shop tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.error_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retry_operations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.retry_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_metrics_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_detection_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_resolution_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflict_resolution_strategies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_sla_reports ENABLE ROW LEVEL SECURITY;
-- spatial_ref_sys is a PostGIS system table, skip RLS for it
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.advisory_lock_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monitoring_dashboard_widgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.influencer_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- 3. Create basic RLS policies for tables missing them
-- =============================================

-- Users table - users can only access their own data, admins can access all
DROP POLICY IF EXISTS "Users can view own profile" ON public.users;
DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
DROP POLICY IF EXISTS "Admins can manage all users" ON public.users;
CREATE POLICY "Users can view own profile" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Admins can manage all users" ON public.users FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Error reports - users can create, admins can view all
DROP POLICY IF EXISTS "Users can create error reports" ON public.error_reports;
DROP POLICY IF EXISTS "Admins can view all error reports" ON public.error_reports;
CREATE POLICY "Users can create error reports" ON public.error_reports FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all error reports" ON public.error_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Reservations - users can access their own, shop owners can access their shop's
DROP POLICY IF EXISTS "Users can manage own reservations" ON public.reservations;
DROP POLICY IF EXISTS "Shop owners can manage shop reservations" ON public.reservations;
DROP POLICY IF EXISTS "Admins can manage all reservations" ON public.reservations;
CREATE POLICY "Users can manage own reservations" ON public.reservations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Shop owners can manage shop reservations" ON public.reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all reservations" ON public.reservations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Payments - users can view their own, shop owners can view their shop's, admins can view all
DROP POLICY IF EXISTS "Users can view own payments" ON public.payments;
DROP POLICY IF EXISTS "Shop owners can view shop payments" ON public.payments;
DROP POLICY IF EXISTS "Admins can manage all payments" ON public.payments;
CREATE POLICY "Users can view own payments" ON public.payments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Shop owners can view shop payments" ON public.payments FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r JOIN public.shops s ON r.shop_id = s.id 
          WHERE r.id = reservation_id AND s.owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all payments" ON public.payments FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Shops - public read access, owners can manage their shops, admins can manage all
DROP POLICY IF EXISTS "Public can view active shops" ON public.shops;
DROP POLICY IF EXISTS "Shop owners can manage own shops" ON public.shops;
DROP POLICY IF EXISTS "Admins can manage all shops" ON public.shops;
CREATE POLICY "Public can view active shops" ON public.shops FOR SELECT USING (shop_status = 'active');
CREATE POLICY "Shop owners can manage own shops" ON public.shops FOR ALL USING (auth.uid() = owner_id);
CREATE POLICY "Admins can manage all shops" ON public.shops FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Notifications - users can view their own, admins can view all
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
CREATE POLICY "Users can view own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage all notifications" ON public.notifications FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- User settings - users can manage their own
DROP POLICY IF EXISTS "Users can manage own settings" ON public.user_settings;
CREATE POLICY "Users can manage own settings" ON public.user_settings FOR ALL USING (auth.uid() = user_id);

-- Shop images - public read access, shop owners can manage their shop's images
DROP POLICY IF EXISTS "Public can view shop images" ON public.shop_images;
DROP POLICY IF EXISTS "Shop owners can manage shop images" ON public.shop_images;
CREATE POLICY "Public can view shop images" ON public.shop_images FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND shop_status = 'active')
);
CREATE POLICY "Shop owners can manage shop images" ON public.shop_images FOR ALL USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND owner_id = auth.uid())
);

-- Shop services - public read access, shop owners can manage their shop's services
DROP POLICY IF EXISTS "Public can view shop services" ON public.shop_services;
DROP POLICY IF EXISTS "Shop owners can manage shop services" ON public.shop_services;
CREATE POLICY "Public can view shop services" ON public.shop_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND shop_status = 'active')
);
CREATE POLICY "Shop owners can manage shop services" ON public.shop_services FOR ALL USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND owner_id = auth.uid())
);

-- Service images - public read access
DROP POLICY IF EXISTS "Public can view service images" ON public.service_images;
CREATE POLICY "Public can view service images" ON public.service_images FOR SELECT USING (true);

-- Feed posts - public read access, users can manage their own posts
DROP POLICY IF EXISTS "Public can view feed posts" ON public.feed_posts;
DROP POLICY IF EXISTS "Users can manage own posts" ON public.feed_posts;
CREATE POLICY "Public can view feed posts" ON public.feed_posts FOR SELECT USING (true);
CREATE POLICY "Users can manage own posts" ON public.feed_posts FOR ALL USING (auth.uid() = author_id);

-- Post images - public read access
DROP POLICY IF EXISTS "Public can view post images" ON public.post_images;
CREATE POLICY "Public can view post images" ON public.post_images FOR SELECT USING (true);

-- Post likes - users can manage their own likes
DROP POLICY IF EXISTS "Users can manage own post likes" ON public.post_likes;
CREATE POLICY "Users can manage own post likes" ON public.post_likes FOR ALL USING (auth.uid() = user_id);

-- Post comments - public read access, users can manage their own comments
DROP POLICY IF EXISTS "Public can view post comments" ON public.post_comments;
DROP POLICY IF EXISTS "Users can manage own comments" ON public.post_comments;
CREATE POLICY "Public can view post comments" ON public.post_comments FOR SELECT USING (true);
CREATE POLICY "Users can manage own comments" ON public.post_comments FOR ALL USING (auth.uid() = user_id);

-- Comment likes - users can manage their own likes
DROP POLICY IF EXISTS "Users can manage own comment likes" ON public.comment_likes;
CREATE POLICY "Users can manage own comment likes" ON public.comment_likes FOR ALL USING (auth.uid() = user_id);

-- User favorites - users can manage their own favorites
DROP POLICY IF EXISTS "Users can manage own favorites" ON public.user_favorites;
CREATE POLICY "Users can manage own favorites" ON public.user_favorites FOR ALL USING (auth.uid() = user_id);

-- Push tokens - users can manage their own tokens
DROP POLICY IF EXISTS "Users can manage own push tokens" ON public.push_tokens;
CREATE POLICY "Users can manage own push tokens" ON public.push_tokens FOR ALL USING (auth.uid() = user_id);

-- Shop reports - users can create, shop owners can view their shop's reports, admins can view all
DROP POLICY IF EXISTS "Users can create shop reports" ON public.shop_reports;
DROP POLICY IF EXISTS "Shop owners can view shop reports" ON public.shop_reports;
DROP POLICY IF EXISTS "Admins can manage all shop reports" ON public.shop_reports;
CREATE POLICY "Users can create shop reports" ON public.shop_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Shop owners can view shop reports" ON public.shop_reports FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.shops WHERE id = shop_id AND owner_id = auth.uid())
);
CREATE POLICY "Admins can manage all shop reports" ON public.shop_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Content reports - users can create, admins can manage all
DROP POLICY IF EXISTS "Users can create content reports" ON public.content_reports;
DROP POLICY IF EXISTS "Admins can manage all content reports" ON public.content_reports;
CREATE POLICY "Users can create content reports" ON public.content_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage all content reports" ON public.content_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Admin actions - admins only
DROP POLICY IF EXISTS "Admins can manage admin actions" ON public.admin_actions;
CREATE POLICY "Admins can manage admin actions" ON public.admin_actions FOR ALL USING (
  auth.uid() = admin_id AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Announcements - public read access, admins can manage
DROP POLICY IF EXISTS "Public can view announcements" ON public.announcements;
DROP POLICY IF EXISTS "Admins can manage announcements" ON public.announcements;
CREATE POLICY "Public can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Admins can manage announcements" ON public.announcements FOR ALL USING (
  auth.uid() = created_by AND EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- FAQs - public read access, admins can manage
DROP POLICY IF EXISTS "Public can view FAQs" ON public.faqs;
DROP POLICY IF EXISTS "Admins can manage FAQs" ON public.faqs;
CREATE POLICY "Public can view FAQs" ON public.faqs FOR SELECT USING (true);
CREATE POLICY "Admins can manage FAQs" ON public.faqs FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Referrals - users can view their own, admins can view all
DROP POLICY IF EXISTS "Users can view own referrals" ON public.referrals;
DROP POLICY IF EXISTS "Admins can manage all referrals" ON public.referrals;
CREATE POLICY "Users can view own referrals" ON public.referrals FOR SELECT USING (
  auth.uid() = referrer_id OR auth.uid() = referred_id
);
CREATE POLICY "Admins can manage all referrals" ON public.referrals FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Referral codes - public read access, users can manage their own
DROP POLICY IF EXISTS "Public can view active referral codes" ON public.referral_codes;
DROP POLICY IF EXISTS "Users can manage own referral codes" ON public.referral_codes;
CREATE POLICY "Public can view active referral codes" ON public.referral_codes FOR SELECT USING (is_active = true);
CREATE POLICY "Users can manage own referral codes" ON public.referral_codes FOR ALL USING (auth.uid() = user_id);

-- System tables - admins only
DROP POLICY IF EXISTS "Admins can manage retry operations" ON public.retry_operations;
DROP POLICY IF EXISTS "Admins can manage retry attempts" ON public.retry_attempts;
DROP POLICY IF EXISTS "Admins can manage monitoring metrics" ON public.monitoring_metrics_history;
DROP POLICY IF EXISTS "Admins can manage conflict detection" ON public.conflict_detection_log;
DROP POLICY IF EXISTS "Admins can manage conflict resolution actions" ON public.conflict_resolution_actions;
DROP POLICY IF EXISTS "Admins can manage conflict resolution strategies" ON public.conflict_resolution_strategies;
DROP POLICY IF EXISTS "Admins can manage monitoring SLA reports" ON public.monitoring_sla_reports;
DROP POLICY IF EXISTS "Admins can manage advisory lock metrics" ON public.advisory_lock_metrics;
DROP POLICY IF EXISTS "Admins can manage monitoring alerts" ON public.monitoring_alerts;
DROP POLICY IF EXISTS "Admins can manage monitoring dashboard widgets" ON public.monitoring_dashboard_widgets;
DROP POLICY IF EXISTS "Admins can manage moderation log" ON public.moderation_log;
DROP POLICY IF EXISTS "Admins can manage referral analytics" ON public.referral_analytics;

CREATE POLICY "Admins can manage retry operations" ON public.retry_operations FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage retry attempts" ON public.retry_attempts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage monitoring metrics" ON public.monitoring_metrics_history FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage conflict detection" ON public.conflict_detection_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage conflict resolution actions" ON public.conflict_resolution_actions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage conflict resolution strategies" ON public.conflict_resolution_strategies FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage monitoring SLA reports" ON public.monitoring_sla_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage advisory lock metrics" ON public.advisory_lock_metrics FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage monitoring alerts" ON public.monitoring_alerts FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage monitoring dashboard widgets" ON public.monitoring_dashboard_widgets FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage moderation log" ON public.moderation_log FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);
CREATE POLICY "Admins can manage referral analytics" ON public.referral_analytics FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Spatial reference system is a PostGIS system table, skip RLS policies for it

-- Reservation services - users can view their own, shop owners can view their shop's
DROP POLICY IF EXISTS "Users can view own reservation services" ON public.reservation_services;
DROP POLICY IF EXISTS "Shop owners can view shop reservation services" ON public.reservation_services;
CREATE POLICY "Users can view own reservation services" ON public.reservation_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations WHERE id = reservation_id AND user_id = auth.uid())
);
CREATE POLICY "Shop owners can view shop reservation services" ON public.reservation_services FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r JOIN public.shops s ON r.shop_id = s.id 
          WHERE r.id = reservation_id AND s.owner_id = auth.uid())
);

-- Reservation status logs - users can view their own, shop owners can view their shop's
DROP POLICY IF EXISTS "Users can view own reservation status logs" ON public.reservation_status_logs;
DROP POLICY IF EXISTS "Shop owners can view shop reservation status logs" ON public.reservation_status_logs;
CREATE POLICY "Users can view own reservation status logs" ON public.reservation_status_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations WHERE id = reservation_id AND user_id = auth.uid())
);
CREATE POLICY "Shop owners can view shop reservation status logs" ON public.reservation_status_logs FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.reservations r JOIN public.shops s ON r.shop_id = s.id 
          WHERE r.id = reservation_id AND s.owner_id = auth.uid())
);

-- Post reports - users can create, admins can manage all
DROP POLICY IF EXISTS "Users can create post reports" ON public.post_reports;
DROP POLICY IF EXISTS "Admins can manage all post reports" ON public.post_reports;
CREATE POLICY "Users can create post reports" ON public.post_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage all post reports" ON public.post_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Comment reports - users can create, admins can manage all
DROP POLICY IF EXISTS "Users can create comment reports" ON public.comment_reports;
DROP POLICY IF EXISTS "Admins can manage all comment reports" ON public.comment_reports;
CREATE POLICY "Users can create comment reports" ON public.comment_reports FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "Admins can manage all comment reports" ON public.comment_reports FOR ALL USING (
  EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND user_role = 'admin')
);

-- Influencer promotions - public read access, users can manage their own
DROP POLICY IF EXISTS "Public can view active influencer promotions" ON public.influencer_promotions;
DROP POLICY IF EXISTS "Users can manage own influencer promotions" ON public.influencer_promotions;
CREATE POLICY "Public can view active influencer promotions" ON public.influencer_promotions FOR SELECT USING (new_status = true);
CREATE POLICY "Users can manage own influencer promotions" ON public.influencer_promotions FOR ALL USING (auth.uid() = user_id);

-- =============================================
-- 4. Fix SECURITY DEFINER views (remove SECURITY DEFINER)
-- =============================================

-- Recreate views without SECURITY DEFINER
CREATE OR REPLACE VIEW public.active_categories_with_services AS
SELECT 
    c.id,
    c.display_name,
    c.description,
    c.created_at,
    c.updated_at,
    COUNT(s.id) as service_count
FROM public.shop_categories c
LEFT JOIN public.service_types s ON c.id = s.category_id AND s.is_active = true
WHERE c.is_active = true
GROUP BY c.id, c.display_name, c.description, c.created_at, c.updated_at
ORDER BY c.sort_order, c.display_name;

CREATE OR REPLACE VIEW public.popular_services_by_category AS
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

CREATE OR REPLACE VIEW public.admin_shops_summary AS
SELECT 
    s.id,
    s.name,
    s.status,
    s.type,
    s.owner_id,
    u.name as owner_name,
    u.email as owner_email,
    COUNT(r.id) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations,
    s.created_at
FROM public.shops s
JOIN public.users u ON s.owner_id = u.id
LEFT JOIN public.reservations r ON s.id = r.shop_id
GROUP BY s.id, s.name, s.status, s.type, s.owner_id, u.name, u.email, s.created_at
ORDER BY s.created_at DESC;

CREATE OR REPLACE VIEW public.security_dashboard AS
SELECT 
    DATE_TRUNC('day', created_at) as date,
    COUNT(*) as total_events,
    COUNT(CASE WHEN event_type = 'login_success' THEN 1 END) as successful_logins,
    COUNT(CASE WHEN event_type = 'login_failed' THEN 1 END) as failed_logins,
    COUNT(CASE WHEN event_type = 'suspicious_activity' THEN 1 END) as suspicious_activities
FROM public.security_events
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY DATE_TRUNC('day', created_at)
ORDER BY date DESC;

CREATE OR REPLACE VIEW public.cdn_cache_stats AS
SELECT 
    DATE_TRUNC('hour', created_at) as hour,
    COUNT(*) as total_requests,
    COUNT(CASE WHEN cache_hit = true THEN 1 END) as cache_hits,
    ROUND(
        COUNT(CASE WHEN cache_hit = true THEN 1 END) * 100.0 / COUNT(*), 2
    ) as cache_hit_rate
FROM public.cdn_configurations
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE_TRUNC('hour', created_at)
ORDER BY hour DESC;

CREATE OR REPLACE VIEW public.admin_users_summary AS
SELECT 
    u.id,
    u.name,
    u.email,
    u.role,
    u.status,
    u.created_at,
    u.last_login_at,
    COUNT(r.id) as total_reservations,
    COUNT(CASE WHEN r.status = 'completed' THEN 1 END) as completed_reservations
FROM public.users u
LEFT JOIN public.reservations r ON u.id = r.user_id
GROUP BY u.id, u.name, u.email, u.role, u.status, u.created_at, u.last_login_at
ORDER BY u.created_at DESC;

-- =============================================
-- Migration completed successfully
-- =============================================
