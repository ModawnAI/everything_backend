-- =============================================
-- SCHEMA CHUNK 56
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.1KB
-- =============================================

-- =============================================

-- IMPORTANT: This chunk creates views and should be run AFTER all tables are created
-- =============================================

-- 관리자용 사용자 요약 뷰
-- 웹 관리자의 사용자 관리 화면용
DO $$
BEGIN
    -- users 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW admin_users_summary AS
        SELECT 
            id,
            name,
            email,
            phone_number,
            user_status,
            user_role,
            is_influencer,
            total_points,
            total_referrals,
            created_at
        FROM public.users
        ORDER BY created_at DESC;';
    ELSE
        RAISE NOTICE 'admin_users_summary view not created: users table does not exist';
    END IF;
END $$;

-- 관리자용 샵 요약 뷰  
-- 웹 관리자의 샵 관리 화면용
DO $$
BEGIN
    -- shops와 users 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') 
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW admin_shops_summary AS
        SELECT 
            s.id,
            s.name,
            s.shop_status,
            s.shop_type,
            s.main_category,
            s.total_bookings,
            u.name as owner_name,
            u.email as owner_email,
            s.created_at
        FROM public.shops s
        LEFT JOIN public.users u ON s.owner_id = u.id
        ORDER BY s.created_at DESC;';
    ELSE
        RAISE NOTICE 'admin_shops_summary view not created: required tables (shops, users) do not exist';
    END IF;
END $$;

-- 관리자용 예약 요약 뷰
-- 웹 관리자의 예약 현황 화면용
DO $$
BEGIN
    -- reservations, users, shops 테이블이 존재하는지 확인
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users')
       AND EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        EXECUTE '
        CREATE OR REPLACE VIEW admin_reservations_summary AS
        SELECT 
            r.id,
            r.reservation_date,
            r.reservation_time,
            r.status,
            r.total_amount,
            u.name as customer_name,
            u.phone_number as customer_phone,
            s.name as shop_name,
            r.created_at
        FROM public.reservations r
        JOIN public.users u ON r.user_id = u.id
        JOIN public.shops s ON r.shop_id = s.id
        ORDER BY r.reservation_date DESC, r.reservation_time DESC;';
    ELSE
        RAISE NOTICE 'admin_reservations_summary view not created: required tables (reservations, users, shops) do not exist';
    END IF;
END $$;