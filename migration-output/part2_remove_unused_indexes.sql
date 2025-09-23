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
