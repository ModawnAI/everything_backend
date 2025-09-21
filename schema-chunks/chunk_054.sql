-- =============================================
-- SCHEMA CHUNK 54
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.6KB
-- =============================================

-- =============================================

-- IMPORTANT: This chunk creates views and should be run AFTER all tables are created
-- =============================================

-- 사용자 포인트 요약 뷰
-- 포인트 관리 화면에서 사용할 통합 포인트 정보
DO $$
BEGIN
    -- point_transactions 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW user_point_summary AS
        SELECT 
            u.id as user_id,
            u.name,
            u.total_points,
            u.available_points,
            COALESCE(pending.pending_points, 0) as pending_points, -- 7일 대기 중인 포인트
            COALESCE(recent.points_this_month, 0) as points_this_month -- 이번 달 적립 포인트
        FROM public.users u
        LEFT JOIN (
            SELECT 
                user_id,
                SUM(amount) as pending_points
            FROM public.point_transactions 
            WHERE status = ''pending''
            GROUP BY user_id
        ) pending ON u.id = pending.user_id
        LEFT JOIN (
            SELECT 
                user_id,
                SUM(amount) as points_this_month
            FROM public.point_transactions 
            WHERE status = ''available''
            AND amount > 0
            AND created_at >= date_trunc(''month'', NOW())
            GROUP BY user_id
        ) recent ON u.id = recent.user_id;';
    ELSE
        RAISE NOTICE 'user_point_summary view not created: point_transactions table does not exist';
    END IF;
END $$;

-- 샵 성과 요약 뷰
-- 웹 관리자 대시보드의 샵 통계용
DO $$
BEGIN
    -- shops와 reservations 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW shop_performance_summary AS
        SELECT 
            s.id as shop_id,
            s.name,
            s.shop_status,
            s.shop_type,
            s.total_bookings,
            COALESCE(recent.bookings_this_month, 0) as bookings_this_month, -- 이번 달 예약 수
            COALESCE(revenue.total_revenue, 0) as total_revenue -- 총 매출액
        FROM public.shops s
        LEFT JOIN (
            SELECT 
                shop_id,
                COUNT(*) as bookings_this_month
            FROM public.reservations
            WHERE status IN (''confirmed'', ''completed'')
            AND created_at >= date_trunc(''month'', NOW())
            GROUP BY shop_id
        ) recent ON s.id = recent.shop_id
        LEFT JOIN (
            SELECT 
                r.shop_id,
                SUM(r.total_amount) as total_revenue
            FROM public.reservations r
            WHERE r.status = ''completed''
            GROUP BY r.shop_id
        ) revenue ON s.id = revenue.shop_id;';
    ELSE
        RAISE NOTICE 'shop_performance_summary view not created: required tables (shops, reservations) do not exist';
    END IF;
END $$;