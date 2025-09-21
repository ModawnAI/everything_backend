-- =============================================
-- SCHEMA CHUNK 36 - INDEXES
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 8.2KB
-- IMPORTANT: This chunk creates indexes and should be run AFTER all tables are created
-- =============================================

-- =============================================

-- 샵 카테고리 테이블 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_categories') THEN
        CREATE INDEX IF NOT EXISTS idx_shop_categories_active ON public.shop_categories(is_active);
        CREATE INDEX IF NOT EXISTS idx_shop_categories_sort_order ON public.shop_categories(sort_order);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_types') THEN
        CREATE INDEX IF NOT EXISTS idx_service_types_category_id ON public.service_types(category_id);
        CREATE INDEX IF NOT EXISTS idx_service_types_active ON public.service_types(is_active);
        CREATE INDEX IF NOT EXISTS idx_service_types_popular ON public.service_types(is_popular);
        CREATE INDEX IF NOT EXISTS idx_service_types_sort_order ON public.service_types(sort_order);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_metadata') THEN
        CREATE INDEX IF NOT EXISTS idx_category_metadata_category_id ON public.category_metadata(category_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_type_metadata') THEN
        CREATE INDEX IF NOT EXISTS idx_service_type_metadata_service_type_id ON public.service_type_metadata(service_type_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_hierarchy') THEN
        CREATE INDEX IF NOT EXISTS idx_category_hierarchy_parent ON public.category_hierarchy(parent_category_id);
        CREATE INDEX IF NOT EXISTS idx_category_hierarchy_child ON public.category_hierarchy(child_category_id);
    END IF;
END $$;

-- 샵 연락처 방법 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contact_methods') THEN
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_shop_id ON public.shop_contact_methods(shop_id);
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_type ON public.shop_contact_methods(contact_type);
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_status ON public.shop_contact_methods(verification_status);
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_primary ON public.shop_contact_methods(shop_id, contact_type, is_primary);
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_public ON public.shop_contact_methods(shop_id, is_public, verification_status);
        CREATE INDEX IF NOT EXISTS idx_shop_contact_methods_display_order ON public.shop_contact_methods(shop_id, display_order);
    END IF;
END $$;

-- 연락처 방법 접근 로그 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_method_access_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_contact_access_logs_contact_method_id ON public.contact_method_access_logs(contact_method_id);
        CREATE INDEX IF NOT EXISTS idx_contact_access_logs_user_id ON public.contact_method_access_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_contact_access_logs_created_at ON public.contact_method_access_logs(created_at);
        CREATE INDEX IF NOT EXISTS idx_contact_access_logs_ip_address ON public.contact_method_access_logs(ip_address);
        CREATE INDEX IF NOT EXISTS idx_contact_access_logs_analytics ON public.contact_method_access_logs(contact_method_id, created_at, access_type);
    END IF;
END $$;

-- 샵 신고 테이블 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_reports') THEN
        CREATE INDEX IF NOT EXISTS idx_shop_reports_shop_id ON public.shop_reports(shop_id);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_reporter_id ON public.shop_reports(reporter_id);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_status ON public.shop_reports(status);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_reviewed_by ON public.shop_reports(reviewed_by);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_created_at ON public.shop_reports(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_priority_status ON public.shop_reports(priority DESC, status, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_shop_reports_escalated ON public.shop_reports(is_escalated) WHERE is_escalated = TRUE;
        CREATE INDEX IF NOT EXISTS idx_shop_reports_moderation_queue ON public.shop_reports(status, priority DESC, created_at ASC) 
            WHERE status IN ('pending', 'under_review');
    END IF;
END $$;

-- 모더레이션 룰 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_rules') THEN
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_type ON public.moderation_rules(rule_type);
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_status ON public.moderation_rules(status);
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_priority ON public.moderation_rules(priority DESC);
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_automated ON public.moderation_rules(is_automated);
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_created_by ON public.moderation_rules(created_by);
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_active ON public.moderation_rules(status, priority DESC) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS idx_moderation_rules_accuracy ON public.moderation_rules(accuracy_score DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_actions') THEN
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_report_id ON public.moderation_actions(report_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_shop_id ON public.moderation_actions(shop_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_moderator_id ON public.moderation_actions(moderator_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_action_type ON public.moderation_actions(action_type);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_automated ON public.moderation_actions(is_automated);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_shop_created ON public.moderation_actions(shop_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_moderation_actions_shop_history ON public.moderation_actions(shop_id, action_type, created_at DESC);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_audit_trail') THEN
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_id ON public.moderation_audit_trail(shop_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_action ON public.moderation_audit_trail(action);
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_moderator_id ON public.moderation_audit_trail(moderator_id);
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_created_at ON public.moderation_audit_trail(created_at);
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_action ON public.moderation_audit_trail(shop_id, action);
        CREATE INDEX IF NOT EXISTS idx_moderation_audit_trail_shop_created ON public.moderation_audit_trail(shop_id, created_at DESC);
    END IF;
END $$;

-- 보안 이벤트 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events') THEN
        CREATE INDEX IF NOT EXISTS idx_security_events_type ON public.security_events(type);
        CREATE INDEX IF NOT EXISTS idx_security_events_severity ON public.security_events(severity);
        CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON public.security_events(user_id);
        CREATE INDEX IF NOT EXISTS idx_security_events_ip ON public.security_events(ip);
        CREATE INDEX IF NOT EXISTS idx_security_events_timestamp ON public.security_events(timestamp);
        CREATE INDEX IF NOT EXISTS idx_security_events_blocked ON public.security_events(blocked);
        CREATE INDEX IF NOT EXISTS idx_security_events_endpoint ON public.security_events(endpoint);
        CREATE INDEX IF NOT EXISTS idx_security_events_ip_timestamp ON public.security_events(ip, timestamp);
        CREATE INDEX IF NOT EXISTS idx_security_events_user_timestamp ON public.security_events(user_id, timestamp);
        CREATE INDEX IF NOT EXISTS idx_security_events_type_severity ON public.security_events(type, severity);
        CREATE INDEX IF NOT EXISTS idx_security_events_ip_type ON public.security_events(ip, type);
        CREATE INDEX IF NOT EXISTS idx_security_events_details ON public.security_events USING GIN(details);
    END IF;
END $$;

-- 웹훅 로그 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_payment_key_status ON public.webhook_logs(payment_key, status);
        CREATE INDEX IF NOT EXISTS idx_webhook_logs_processed ON public.webhook_logs(processed);
        CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_logs_unique ON public.webhook_logs(payment_key, status, webhook_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_failures') THEN
        CREATE INDEX IF NOT EXISTS idx_webhook_failures_payment_key ON public.webhook_failures(payment_key);
        CREATE INDEX IF NOT EXISTS idx_webhook_failures_resolved ON public.webhook_failures(resolved);
        CREATE INDEX IF NOT EXISTS idx_webhook_failures_retry_count ON public.webhook_failures(retry_count);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conflicts') THEN
        CREATE INDEX IF NOT EXISTS idx_conflicts_shop_id ON public.conflicts(shop_id);
        CREATE INDEX IF NOT EXISTS idx_conflicts_type ON public.conflicts(type);
        CREATE INDEX IF NOT EXISTS idx_conflicts_severity ON public.conflicts(severity);
        CREATE INDEX IF NOT EXISTS idx_conflicts_detected_at ON public.conflicts(detected_at);
        CREATE INDEX IF NOT EXISTS idx_conflicts_resolved_at ON public.conflicts(resolved_at);
    END IF;
END $$;

-- 예약 상태 로그 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservation_status_logs') THEN
        CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_reservation_id ON public.reservation_status_logs(reservation_id);
        CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_timestamp ON public.reservation_status_logs(timestamp);
        CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_changed_by ON public.reservation_status_logs(changed_by);
        CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_from_status ON public.reservation_status_logs(from_status);
        CREATE INDEX IF NOT EXISTS idx_reservation_status_logs_to_status ON public.reservation_status_logs(to_status);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_role_history') THEN
        CREATE INDEX IF NOT EXISTS idx_user_role_history_user_id ON public.user_role_history(user_id);
        CREATE INDEX IF NOT EXISTS idx_user_role_history_changed_by ON public.user_role_history(changed_by);
        CREATE INDEX IF NOT EXISTS idx_user_role_history_created_at ON public.user_role_history(created_at);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cdn_configurations') THEN
        CREATE INDEX IF NOT EXISTS idx_cdn_configurations_bucket_preset ON public.cdn_configurations(bucket_id, transformation_preset, is_active);
    END IF;
END $$;

-- 샵 이미지 확장 인덱스 (v3.3)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_images') THEN
        CREATE INDEX IF NOT EXISTS idx_shop_images_category ON public.shop_images(category);
        CREATE INDEX IF NOT EXISTS idx_shop_images_tags ON public.shop_images USING GIN(tags);
        CREATE INDEX IF NOT EXISTS idx_shop_images_metadata ON public.shop_images USING GIN(metadata);
        CREATE INDEX IF NOT EXISTS idx_shop_images_optimized ON public.shop_images(is_optimized);
        CREATE INDEX IF NOT EXISTS idx_shop_images_archived ON public.shop_images(is_archived);
        CREATE INDEX IF NOT EXISTS idx_shop_images_updated_at ON public.shop_images(updated_at);
        CREATE INDEX IF NOT EXISTS idx_shop_images_display_order ON public.shop_images(shop_id, display_order);
    END IF;
END $$;