-- =============================================
-- SCHEMA CHUNK 58
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 3.1KB
-- =============================================

-- =============================================

-- IMPORTANT: This chunk creates views and should be run AFTER all tables are created
-- =============================================

-- 활성 카테고리와 서비스 뷰
DO $$
BEGIN
    -- shop_categories와 service_types 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_categories')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_types') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.active_categories_with_services AS
        SELECT 
            c.id,
            c.display_name,
            c.description,
            c.icon,
            c.color,
            c.subcategories,
            c.sort_order,
            COUNT(st.id) as service_count,
            COUNT(CASE WHEN st.is_popular THEN 1 END) as popular_service_count
        FROM public.shop_categories c
        LEFT JOIN public.service_types st ON c.id = st.category_id AND st.is_active = TRUE
        WHERE c.is_active = TRUE
        GROUP BY c.id, c.display_name, c.description, c.icon, c.color, c.subcategories, c.sort_order
        ORDER BY c.sort_order;';
    ELSE
        RAISE NOTICE 'active_categories_with_services view not created: required tables (shop_categories, service_types) do not exist';
    END IF;
END $$;

-- 인기 서비스 카테고리별 뷰
DO $$
BEGIN
    -- shop_categories와 service_types 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_categories')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_types') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.popular_services_by_category AS
        SELECT 
            c.id as category_id,
            c.display_name as category_name,
            st.id as service_id,
            st.name as service_name,
            st.description,
            st.price_range,
            st.duration_minutes,
            st.sort_order
        FROM public.shop_categories c
        JOIN public.service_types st ON c.id = st.category_id
        WHERE c.is_active = TRUE 
            AND st.is_active = TRUE 
            AND st.is_popular = TRUE
        ORDER BY c.sort_order, st.sort_order;';
    ELSE
        RAISE NOTICE 'popular_services_by_category view not created: required tables (shop_categories, service_types) do not exist';
    END IF;
END $$;

-- 활성 공개 연락처 방법 뷰
DO $$
BEGIN
    -- shop_contact_methods와 shops 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contact_methods')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.shop_public_contact_methods AS
        SELECT 
            scm.id,
            scm.shop_id,
            s.name as shop_name,
            scm.contact_type,
            scm.contact_value,
            scm.display_name,
            scm.is_primary,
            scm.metadata,
            scm.display_order,
            scm.click_count,
            scm.last_accessed_at
        FROM public.shop_contact_methods scm
        JOIN public.shops s ON scm.shop_id = s.id
        WHERE scm.is_public = TRUE 
            AND scm.verification_status = ''verified''
            AND s.shop_status = ''active''
        ORDER BY scm.shop_id, scm.display_order;';
    ELSE
        RAISE NOTICE 'shop_public_contact_methods view not created: required tables (shop_contact_methods, shops) do not exist';
    END IF;
END $$;

-- 연락처 방법 분석 뷰
DO $$
BEGIN
    -- shop_contact_methods, shops, contact_method_access_logs 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contact_methods')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_method_access_logs') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.contact_method_analytics AS
        SELECT 
            scm.id as contact_method_id,
            scm.shop_id,
            s.name as shop_name,
            scm.contact_type,
            scm.contact_value,
            scm.click_count,
            COUNT(cmal.id) as total_accesses,
            COUNT(DISTINCT cmal.user_id) as unique_users,
            COUNT(DISTINCT DATE(cmal.created_at)) as active_days,
            MAX(cmal.created_at) as last_access,
            MIN(cmal.created_at) as first_access
        FROM public.shop_contact_methods scm
        JOIN public.shops s ON scm.shop_id = s.id
        LEFT JOIN public.contact_method_access_logs cmal ON scm.id = cmal.contact_method_id
        GROUP BY scm.id, scm.shop_id, s.name, scm.contact_type, scm.contact_value, scm.click_count;';
    ELSE
        RAISE NOTICE 'contact_method_analytics view not created: required tables (shop_contact_methods, shops, contact_method_access_logs) do not exist';
    END IF;
END $$;

-- CDN 캐시 통계 뷰
DO $$
BEGIN
    -- storage.objects 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'storage' AND table_name = 'objects') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.cdn_cache_stats AS
        SELECT 
            bucket_id,
            COUNT(*) as total_files,
            COUNT(*) FILTER (WHERE metadata->>''cdn_processed'' = ''true'') as processed_files,
            COUNT(*) FILTER (WHERE metadata->>''cache_expires_at'' IS NOT NULL AND (metadata->>''cache_expires_at'')::TIMESTAMPTZ < NOW()) as expired_files,
            COALESCE(SUM((metadata->>''size'')::BIGINT), 0) as total_size_bytes,
            AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
        FROM storage.objects
        WHERE bucket_id LIKE ''%-cdn'' OR bucket_id = ''image-cache''
        GROUP BY bucket_id;';
    ELSE
        RAISE NOTICE 'cdn_cache_stats view not created: storage.objects table does not exist';
    END IF;
END $$;

-- 보안 대시보드 뷰
DO $$
BEGIN
    -- security_events 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW public.security_dashboard AS
        SELECT 
            DATE_TRUNC(''hour'', timestamp) as hour,
            type,
            severity,
            COUNT(*) as event_count,
            COUNT(DISTINCT ip) as unique_ips,
            COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_count
        FROM public.security_events
        WHERE timestamp >= NOW() - INTERVAL ''24 hours''
        GROUP BY DATE_TRUNC(''hour'', timestamp), type, severity
        ORDER BY hour DESC, event_count DESC;';
    ELSE
        RAISE NOTICE 'security_dashboard view not created: security_events table does not exist';
    END IF;
END $$;