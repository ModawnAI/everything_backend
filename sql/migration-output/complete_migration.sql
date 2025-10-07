-- =============================================
-- DATABASE PERFORMANCE OPTIMIZATION MIGRATION
-- =============================================
-- This migration addresses performance issues identified by Supabase database linter
-- 1. Adds missing indexes for foreign key constraints
-- 2. Removes unused indexes to reduce storage overhead
-- 
-- Generated: 2025-01-27
-- Based on Supabase database linter report
-- =============================================

-- =============================================
-- PART 1: ADD MISSING FOREIGN KEY INDEXES
-- =============================================
-- These indexes are recommended by Supabase for optimal query performance
-- when JOINing tables or filtering by foreign key columns
-- Only includes tables that actually exist in the current schema

-- Admin actions table
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id 
ON admin_actions (admin_id);

-- Announcements table
CREATE INDEX IF NOT EXISTS idx_announcements_created_by 
ON announcements (created_by);

-- Content reports table - multiple foreign keys
CREATE INDEX IF NOT EXISTS idx_content_reports_reporter_id 
ON content_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_content_reports_reviewed_by 
ON content_reports (reviewed_by);

-- Moderation audit trail table
CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_moderator_id 
ON moderation_audit_trail (moderator_id);

-- Post images table
CREATE INDEX IF NOT EXISTS idx_post_images_post_id 
ON post_images (post_id);

-- Reservation services table - multiple foreign keys
CREATE INDEX IF NOT EXISTS idx_reservation_services_reservation_id 
ON reservation_services (reservation_id);

CREATE INDEX IF NOT EXISTS idx_reservation_services_service_id 
ON reservation_services (service_id);

-- Service images table
CREATE INDEX IF NOT EXISTS idx_service_images_service_id 
ON service_images (service_id);

-- Shop reports table
CREATE INDEX IF NOT EXISTS idx_shop_reports_reporter_id 
ON shop_reports (reporter_id);

CREATE INDEX IF NOT EXISTS idx_shop_reports_reviewed_by 
ON shop_reports (reviewed_by);

-- Shop services table
CREATE INDEX IF NOT EXISTS idx_shop_services_shop_id 
ON shop_services (shop_id);

-- User favorites table
CREATE INDEX IF NOT EXISTS idx_user_favorites_user_id 
ON user_favorites (user_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_shop_id 
ON user_favorites (shop_id);

-- Moderation rules table
CREATE INDEX IF NOT EXISTS idx_moderation_rules_created_by 
ON moderation_rules (created_by);

-- Moderation actions table
CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id 
ON moderation_actions (moderator_id);

-- Security events table
CREATE INDEX IF NOT EXISTS idx_security_events_user_id 
ON security_events (user_id);

-- User role history table (check if exists first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_role_history') THEN
        CREATE INDEX IF NOT EXISTS idx_user_role_history_user_id ON user_role_history (user_id);
        CREATE INDEX IF NOT EXISTS idx_user_role_history_changed_by ON user_role_history (changed_by);
    END IF;
END $$;

-- Conflicts table (check if exists first)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conflicts') THEN
        CREATE INDEX IF NOT EXISTS idx_conflicts_resolved_by ON conflicts (resolved_by);
    END IF;
END $$;

-- =============================================
-- PART 2: REMOVE UNUSED INDEXES
-- =============================================
-- These indexes have never been used according to the linter report
-- Removing them will reduce storage overhead and improve write performance
-- Only includes indexes that actually exist in the current schema

-- Shop categories unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_categories') THEN
        DROP INDEX IF EXISTS idx_shop_categories_active;
        DROP INDEX IF EXISTS idx_shop_categories_sort_order;
    END IF;
END $$;

-- Service types unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_types') THEN
        DROP INDEX IF EXISTS idx_service_types_category_id;
        DROP INDEX IF EXISTS idx_service_types_active;
        DROP INDEX IF EXISTS idx_service_types_popular;
        DROP INDEX IF EXISTS idx_service_types_sort_order;
    END IF;
END $$;

-- Category metadata unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_metadata') THEN
        DROP INDEX IF EXISTS idx_category_metadata_category_id;
    END IF;
END $$;

-- Service type metadata unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_type_metadata') THEN
        DROP INDEX IF EXISTS idx_service_type_metadata_service_type_id;
    END IF;
END $$;

-- Category hierarchy unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_hierarchy') THEN
        DROP INDEX IF EXISTS idx_category_hierarchy_parent;
        DROP INDEX IF EXISTS idx_category_hierarchy_child;
    END IF;
END $$;

-- Shop reports unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_reports') THEN
        DROP INDEX IF EXISTS idx_shop_reports_status;
        DROP INDEX IF EXISTS idx_shop_reports_created_at;
        DROP INDEX IF EXISTS idx_shop_reports_priority_status;
        DROP INDEX IF EXISTS idx_shop_reports_escalated;
        DROP INDEX IF EXISTS idx_shop_reports_moderation_queue;
    END IF;
END $$;

-- Moderation rules unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_rules') THEN
        DROP INDEX IF EXISTS idx_moderation_rules_type;
        DROP INDEX IF EXISTS idx_moderation_rules_status;
        DROP INDEX IF EXISTS idx_moderation_rules_priority;
        DROP INDEX IF EXISTS idx_moderation_rules_automated;
        DROP INDEX IF EXISTS idx_moderation_rules_active;
        DROP INDEX IF EXISTS idx_moderation_rules_accuracy;
    END IF;
END $$;

-- Moderation actions unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_actions') THEN
        DROP INDEX IF EXISTS idx_moderation_actions_report_id;
        DROP INDEX IF EXISTS idx_moderation_actions_shop_id;
        DROP INDEX IF EXISTS idx_moderation_actions_action_type;
        DROP INDEX IF EXISTS idx_moderation_actions_created_at;
        DROP INDEX IF EXISTS idx_moderation_actions_automated;
        DROP INDEX IF EXISTS idx_moderation_actions_shop_created;
    END IF;
END $$;

-- Moderation audit trail unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_audit_trail') THEN
        DROP INDEX IF EXISTS idx_moderation_audit_trail_shop_id;
        DROP INDEX IF EXISTS idx_moderation_audit_trail_action;
        DROP INDEX IF EXISTS idx_moderation_audit_trail_created_at;
        DROP INDEX IF EXISTS idx_moderation_audit_trail_shop_action;
    END IF;
END $$;

-- Security events unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events') THEN
        DROP INDEX IF EXISTS idx_security_events_type;
        DROP INDEX IF EXISTS idx_security_events_severity;
        DROP INDEX IF EXISTS idx_security_events_user_id;
        DROP INDEX IF EXISTS idx_security_events_ip;
        DROP INDEX IF EXISTS idx_security_events_timestamp;
        DROP INDEX IF EXISTS idx_security_events_blocked;
        DROP INDEX IF EXISTS idx_security_events_endpoint;
        DROP INDEX IF EXISTS idx_security_events_ip_timestamp;
        DROP INDEX IF EXISTS idx_security_events_type_severity;
        DROP INDEX IF EXISTS idx_security_events_ip_type;
        DROP INDEX IF EXISTS idx_security_events_details;
    END IF;
END $$;

-- Refresh tokens unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'refresh_tokens') THEN
        DROP INDEX IF EXISTS idx_refresh_tokens_user_id;
        DROP INDEX IF EXISTS idx_refresh_tokens_token_hash;
        DROP INDEX IF EXISTS idx_refresh_tokens_device_id;
        DROP INDEX IF EXISTS idx_refresh_tokens_expires_at;
        DROP INDEX IF EXISTS idx_refresh_tokens_is_active;
    END IF;
END $$;

-- Users unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DROP INDEX IF EXISTS idx_users_referral_code;
        DROP INDEX IF EXISTS idx_users_phone_number;
        DROP INDEX IF EXISTS idx_users_email;
        DROP INDEX IF EXISTS idx_users_status;
        DROP INDEX IF EXISTS idx_users_referrer_lookup;
    END IF;
END $$;

-- Reservations unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        DROP INDEX IF EXISTS idx_reservations_status;
        DROP INDEX IF EXISTS idx_reservations_datetime;
    END IF;
END $$;

-- Notifications unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        DROP INDEX IF EXISTS idx_notifications_status;
        DROP INDEX IF EXISTS idx_notifications_type;
        DROP INDEX IF EXISTS idx_notifications_user_unread;
        DROP INDEX IF EXISTS idx_notifications_realtime;
    END IF;
END $$;

-- Feed posts unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_posts') THEN
        DROP INDEX IF EXISTS idx_feed_posts_status;
        DROP INDEX IF EXISTS idx_feed_posts_category;
        DROP INDEX IF EXISTS idx_feed_posts_created_at;
        DROP INDEX IF EXISTS idx_feed_posts_location_tag;
        DROP INDEX IF EXISTS idx_feed_posts_location_category;
        DROP INDEX IF EXISTS idx_feed_posts_author_created;
        DROP INDEX IF EXISTS idx_feed_posts_timeline;
    END IF;
END $$;

-- Post likes unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_likes') THEN
        DROP INDEX IF EXISTS idx_post_likes_post_id;
    END IF;
END $$;

-- Post comments unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_comments') THEN
        DROP INDEX IF EXISTS idx_post_comments_post_id;
        DROP INDEX IF EXISTS idx_post_comments_parent_id;
    END IF;
END $$;

-- Comment likes unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_likes') THEN
        DROP INDEX IF EXISTS idx_comment_likes_comment_id;
    END IF;
END $$;

-- Shops unused indexes
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        DROP INDEX IF EXISTS idx_shops_location;
        DROP INDEX IF EXISTS idx_shops_active_location;
        DROP INDEX IF EXISTS idx_shops_type_active;
        DROP INDEX IF EXISTS idx_shops_category_status;
        DROP INDEX IF EXISTS idx_shops_featured_location;
        DROP INDEX IF EXISTS idx_shops_category_active;
        DROP INDEX IF EXISTS idx_shops_status_btree;
        DROP INDEX IF EXISTS idx_shops_featured_time;
        DROP INDEX IF EXISTS idx_shops_type_category_active;
        DROP INDEX IF EXISTS idx_shops_type_partnership;
        DROP INDEX IF EXISTS idx_shops_search;
    END IF;
END $$;

-- =============================================
-- PART 3: PERFORMANCE VALIDATION QUERIES
-- =============================================
-- These queries can be run to validate the performance improvements
-- and ensure no critical indexes were accidentally removed

-- Check remaining indexes on key tables
-- SELECT schemaname, tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('users', 'shops', 'reservations', 'payments')
-- ORDER BY tablename, indexname;

-- Check foreign key constraint performance
-- EXPLAIN (ANALYZE, BUFFERS) 
-- SELECT u.* FROM users u 
-- JOIN shops s ON u.id = s.owner_id 
-- WHERE s.status = 'active';

-- =============================================
-- MIGRATION NOTES
-- =============================================
-- 1. This migration addresses unindexed foreign key constraints in existing tables
-- 2. Removes unused indexes to reduce storage overhead and improve write performance
-- 3. Expected performance improvements:
--    - Faster JOIN operations on foreign key columns
--    - Reduced storage requirements
--    - Faster INSERT/UPDATE operations due to fewer indexes to maintain
--    - Improved overall database performance
-- 
-- 4. After applying this migration, run:
--    - VACUUM ANALYZE; to update table statistics
--    - Monitor query performance with EXPLAIN ANALYZE
--    - Check index usage with pg_stat_user_indexes view
-- 
-- 5. Tables affected:
--    - admin_actions, announcements, content_reports
--    - moderation_audit_trail, post_images, reservation_services
--    - service_images, shop_reports, shop_services, user_favorites
--    - moderation_rules, moderation_actions, security_events
--    - user_role_history, conflicts
-- =============================================
