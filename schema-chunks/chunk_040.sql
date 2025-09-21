-- =============================================
-- SCHEMA CHUNK 40 - RLS POLICIES
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 12.4KB
-- IMPORTANT: This chunk creates RLS policies and should be run AFTER all tables are created
-- =============================================

-- =============================================

-- 샵 카테고리 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_categories') THEN
        CREATE POLICY "Allow public read access to active shop categories" ON public.shop_categories
            FOR SELECT USING (is_active = TRUE);

        CREATE POLICY "Allow authenticated users to read all shop categories" ON public.shop_categories
            FOR SELECT USING (auth.role() = 'authenticated');

        CREATE POLICY "Allow admin full access to shop categories" ON public.shop_categories
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 서비스 타입 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_types') THEN
        CREATE POLICY "Allow public read access to active service types" ON public.service_types
            FOR SELECT USING (is_active = TRUE);

        CREATE POLICY "Allow authenticated users to read all service types" ON public.service_types
            FOR SELECT USING (auth.role() = 'authenticated');

        CREATE POLICY "Allow admin full access to service types" ON public.service_types
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 카테고리 메타데이터 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_metadata') THEN
        CREATE POLICY "Allow public read access to category metadata" ON public.category_metadata
            FOR SELECT USING (TRUE);

        CREATE POLICY "Allow admin full access to category metadata" ON public.category_metadata
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 서비스 타입 메타데이터 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'service_type_metadata') THEN
        CREATE POLICY "Allow public read access to service type metadata" ON public.service_type_metadata
            FOR SELECT USING (TRUE);

        CREATE POLICY "Allow admin full access to service type metadata" ON public.service_type_metadata
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 카테고리 계층 구조 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'category_hierarchy') THEN
        CREATE POLICY "Allow public read access to category hierarchy" ON public.category_hierarchy
            FOR SELECT USING (TRUE);

        CREATE POLICY "Allow admin full access to category hierarchy" ON public.category_hierarchy
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- 샵 연락처 방법 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contact_methods') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        CREATE POLICY "Shop owners can manage shop contact methods" ON public.shop_contact_methods
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.shops 
                    WHERE shops.id = shop_contact_methods.shop_id 
                    AND shops.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Public can read verified shop contact methods" ON public.shop_contact_methods
            FOR SELECT USING (
                is_public = TRUE 
                AND verification_status = 'verified'
                AND EXISTS (
                    SELECT 1 FROM public.shops 
                    WHERE shops.id = shop_contact_methods.shop_id 
                    AND shops.shop_status = 'active'
                )
            );
    END IF;
END $$;

-- 연락처 방법 접근 로그 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'contact_method_access_logs') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contact_methods')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        CREATE POLICY "Authenticated users can log contact access" ON public.contact_method_access_logs
            FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

        CREATE POLICY "Shop owners can view their contact access logs" ON public.contact_method_access_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.shop_contact_methods scm
                    JOIN public.shops s ON scm.shop_id = s.id
                    WHERE scm.id = contact_method_access_logs.contact_method_id
                    AND s.owner_id = auth.uid()
                )
            );
    END IF;
END $$;

-- 샵 신고 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_reports') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Authenticated users can create shop reports" ON public.shop_reports
            FOR INSERT WITH CHECK (auth.uid() = reporter_id);

        CREATE POLICY "Users can view their own reports" ON public.shop_reports
            FOR SELECT USING (auth.uid() = reporter_id);

        CREATE POLICY "Shop owners can view reports about their shops" ON public.shop_reports
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.shops 
                    WHERE shops.id = shop_reports.shop_id 
                    AND shops.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Admins can manage all shop reports" ON public.shop_reports
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 모더레이션 룰 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_rules') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Authenticated users can view active moderation rules" ON public.moderation_rules
            FOR SELECT USING (status = 'active');

        CREATE POLICY "Admins can view all moderation rules" ON public.moderation_rules
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );

        CREATE POLICY "Admins can manage moderation rules" ON public.moderation_rules
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 모더레이션 액션 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_actions') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Authenticated users can view moderation actions" ON public.moderation_actions
            FOR SELECT USING (TRUE);

        CREATE POLICY "Shop owners can view actions on their shops" ON public.moderation_actions
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.shops 
                    WHERE shops.id = moderation_actions.shop_id 
                    AND shops.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Admins can create moderation actions" ON public.moderation_actions
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
                AND auth.uid() = moderator_id
            );

        CREATE POLICY "Admins can manage all moderation actions" ON public.moderation_actions
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 모더레이션 감사 추적 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'moderation_audit_trail') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        CREATE POLICY "Admins can view all moderation audit trail entries" ON public.moderation_audit_trail
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );

        CREATE POLICY "Shop owners can view their shop's moderation audit trail" ON public.moderation_audit_trail
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.shops 
                    WHERE shops.id = moderation_audit_trail.shop_id 
                    AND shops.owner_id = auth.uid()
                )
            );

        CREATE POLICY "System can insert moderation audit trail entries" ON public.moderation_audit_trail
            FOR INSERT WITH CHECK (true);

        CREATE POLICY "Admins can update moderation audit trail entries" ON public.moderation_audit_trail
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE users.id = auth.uid() 
                    AND users.user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 보안 이벤트 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'security_events') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Users can view their own security events" ON public.security_events
            FOR SELECT USING (user_id = auth.uid());

        CREATE POLICY "Admins can view all security events" ON public.security_events
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "System can insert security events" ON public.security_events
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 웹훅 로그 정책 (관리자만 접근)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_logs') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Admin can view webhook logs" ON public.webhook_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "Admin can insert webhook logs" ON public.webhook_logs
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "Admin can update webhook logs" ON public.webhook_logs
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 웹훅 실패 정책 (관리자만 접근)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'webhook_failures') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Admin can view webhook failures" ON public.webhook_failures
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "Admin can insert webhook failures" ON public.webhook_failures
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "Admin can update webhook failures" ON public.webhook_failures
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );
    END IF;
END $$;

-- 충돌 추적 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'conflicts') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Shop owners can view shop conflicts" ON public.conflicts
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.shops s 
                    WHERE s.id = conflicts.shop_id 
                    AND s.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Admins can view all conflicts" ON public.conflicts
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() 
                    AND u.user_role = 'admin'
                )
            );

        CREATE POLICY "Shop owners can update shop conflicts" ON public.conflicts
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.shops s 
                    WHERE s.id = conflicts.shop_id 
                    AND s.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Admins can update all conflicts" ON public.conflicts
            FOR UPDATE USING (
                EXISTS (
                    SELECT 1 FROM public.users u 
                    WHERE u.id = auth.uid() 
                    AND u.user_role = 'admin'
                )
            );

        CREATE POLICY "System can insert conflicts" ON public.conflicts
            FOR INSERT WITH CHECK (true);
    END IF;
END $$;

-- 예약 상태 로그 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservation_status_logs') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Users can view their own reservation status logs" ON public.reservation_status_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.reservations r
                    WHERE r.id = reservation_status_logs.reservation_id
                    AND r.user_id = auth.uid()
                )
            );

        CREATE POLICY "Shop owners can view their shop's reservation status logs" ON public.reservation_status_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.reservations r
                    JOIN public.shops s ON r.shop_id = s.id
                    WHERE r.id = reservation_status_logs.reservation_id
                    AND s.owner_id = auth.uid()
                )
            );

        CREATE POLICY "Admins can view all reservation status logs" ON public.reservation_status_logs
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.user_role = 'admin'
                )
            );

        CREATE POLICY "System can insert reservation status logs" ON public.reservation_status_logs
            FOR INSERT WITH CHECK (changed_by = 'system');

        CREATE POLICY "Users can insert logs for their own reservations" ON public.reservation_status_logs
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.reservations r
                    WHERE r.id = reservation_status_logs.reservation_id
                    AND r.user_id = auth.uid()
                )
                AND changed_by = 'user'
            );

        CREATE POLICY "Shop owners can insert logs for their shop's reservations" ON public.reservation_status_logs
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.reservations r
                    JOIN public.shops s ON r.shop_id = s.id
                    WHERE r.id = reservation_status_logs.reservation_id
                    AND s.owner_id = auth.uid()
                )
                AND changed_by = 'shop'
            );

        CREATE POLICY "Admins can insert reservation status logs" ON public.reservation_status_logs
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users u
                    WHERE u.id = auth.uid()
                    AND u.user_role = 'admin'
                )
                AND changed_by = 'admin'
            );
    END IF;
END $$;

-- 사용자 역할 변경 기록 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_role_history') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "Admins can view all role history" ON public.user_role_history
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND user_role = 'admin'
                )
            );

        CREATE POLICY "Admins can insert role history" ON public.user_role_history
            FOR INSERT WITH CHECK (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() AND user_role = 'admin'
                )
            );
    END IF;
END $$;

-- CDN 설정 정책
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'cdn_configurations') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        CREATE POLICY "cdn_configurations_admin_manage" ON public.cdn_configurations
            FOR ALL USING (
                EXISTS (
                    SELECT 1 FROM public.users 
                    WHERE id = auth.uid() 
                    AND user_role = 'admin'
                )
            );

        CREATE POLICY "cdn_configurations_public_read" ON public.cdn_configurations
            FOR SELECT USING (is_active = TRUE);
    END IF;
END $$;