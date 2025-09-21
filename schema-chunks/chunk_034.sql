-- =============================================
-- SCHEMA CHUNK 34 - INDEXES
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 6.3KB
-- IMPORTANT: This chunk creates indexes and should be run AFTER all tables are created
-- =============================================

-- =============================================

-- 사용자 테이블 인덱스
-- 추천인 코드와 전화번호는 자주 검색되므로 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_users_referral_code ON public.users(referral_code);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON public.users(phone_number);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON public.users(user_status); -- 활성 사용자 필터링

-- 샵 테이블 인덱스 (v3.3 업데이트됨)
-- location은 GIST 인덱스로 공간 검색 최적화 (내 주변 샵 찾기)
CREATE INDEX IF NOT EXISTS idx_shops_location ON public.shops USING GIST(location);

-- v3.3 복합 공간 인덱스들
-- 가장 일반적인 쿼리 패턴: 카테고리별 활성 샵 위치 검색
-- 공간 인덱스와 일반 인덱스를 분리하여 최적화
CREATE INDEX IF NOT EXISTS idx_shops_active_location ON public.shops USING GIST (location) 
WHERE shop_status = 'active' AND location IS NOT NULL;

-- 샵 타입 + 위치 복합 인덱스 (입점샵 우선 정렬)
CREATE INDEX IF NOT EXISTS idx_shops_type_active ON public.shops (shop_type) 
WHERE shop_status = 'active';

-- 종합 복합 인덱스 (카테고리, 상태, 위치)
CREATE INDEX IF NOT EXISTS idx_shops_category_status ON public.shops (main_category, shop_status) 
WHERE location IS NOT NULL;

-- 추천 샵 공간 인덱스
CREATE INDEX IF NOT EXISTS idx_shops_featured_location ON public.shops USING GIST (location) 
WHERE is_featured = true AND shop_status = 'active' AND location IS NOT NULL;

-- 최적화된 B-tree 인덱스들
CREATE INDEX IF NOT EXISTS idx_shops_category_active ON public.shops (main_category) WHERE shop_status = 'active';
CREATE INDEX IF NOT EXISTS idx_shops_status_btree ON public.shops (shop_status);
CREATE INDEX IF NOT EXISTS idx_shops_featured_time ON public.shops (is_featured, featured_until) WHERE shop_status = 'active';
CREATE INDEX IF NOT EXISTS idx_shops_type_category_active ON public.shops (shop_type, main_category) WHERE shop_status = 'active';
CREATE INDEX IF NOT EXISTS idx_shops_owner_status ON public.shops (owner_id, shop_status);

-- 예약 테이블 인덱스
-- 사용자별, 샵별, 날짜별 예약 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        CREATE INDEX IF NOT EXISTS idx_reservations_user_id ON public.reservations(user_id);
        CREATE INDEX IF NOT EXISTS idx_reservations_shop_id ON public.reservations(shop_id);
        CREATE INDEX IF NOT EXISTS idx_reservations_datetime ON public.reservations(reservation_datetime);
        CREATE INDEX IF NOT EXISTS idx_reservations_status ON public.reservations(status);
        CREATE INDEX IF NOT EXISTS idx_reservations_date_status ON public.reservations(reservation_date, status); -- 복합 인덱스
    END IF;
END $$;

-- 포인트 거래 테이블 인덱스
-- 포인트 관리 화면의 내역 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_point_transactions_user_id ON public.point_transactions(user_id);
        CREATE INDEX IF NOT EXISTS idx_point_transactions_type ON public.point_transactions(transaction_type);
        CREATE INDEX IF NOT EXISTS idx_point_transactions_status ON public.point_transactions(status);
        CREATE INDEX IF NOT EXISTS idx_point_transactions_available_from ON public.point_transactions(available_from); -- 7일 제한 체크
    END IF;
END $$;

-- 알림 테이블 인덱스
-- 알림 목록 화면의 빠른 로딩을 위한 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status); -- 읽지 않은 알림 조회
        CREATE INDEX IF NOT EXISTS idx_notifications_type ON public.notifications(notification_type);
    END IF;
END $$;

-- 피드 시스템 인덱스 (v3.2 신규)
-- 피드 게시물 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_posts') THEN
        CREATE INDEX IF NOT EXISTS idx_feed_posts_author_id ON public.feed_posts(author_id);
        CREATE INDEX IF NOT EXISTS idx_feed_posts_status ON public.feed_posts(status);
        CREATE INDEX IF NOT EXISTS idx_feed_posts_category ON public.feed_posts(category);
        CREATE INDEX IF NOT EXISTS idx_feed_posts_created_at ON public.feed_posts(created_at DESC); -- 최신순 정렬
        CREATE INDEX IF NOT EXISTS idx_feed_posts_location_tag ON public.feed_posts(location_tag); -- 위치 기반 검색
        CREATE INDEX IF NOT EXISTS idx_feed_posts_tagged_shop ON public.feed_posts(tagged_shop_id);
    END IF;
END $$;

-- 게시물 좋아요/댓글 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_likes') THEN
        CREATE INDEX IF NOT EXISTS idx_post_likes_post_id ON public.post_likes(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_likes_user_id ON public.post_likes(user_id);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_comments') THEN
        CREATE INDEX IF NOT EXISTS idx_post_comments_post_id ON public.post_comments(post_id);
        CREATE INDEX IF NOT EXISTS idx_post_comments_user_id ON public.post_comments(user_id);
        CREATE INDEX IF NOT EXISTS idx_post_comments_parent_id ON public.post_comments(parent_comment_id);
    END IF;
END $$;

-- 댓글 좋아요 인덱스
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_likes') THEN
        CREATE INDEX IF NOT EXISTS idx_comment_likes_comment_id ON public.comment_likes(comment_id);
        CREATE INDEX IF NOT EXISTS idx_comment_likes_user_id ON public.comment_likes(user_id);
    END IF;
END $$;

-- 성능 최적화 복합 인덱스 (신규 추가)
-- 사용자별 예약 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        CREATE INDEX IF NOT EXISTS idx_reservations_user_date ON public.reservations(user_id, reservation_date DESC);
        CREATE INDEX IF NOT EXISTS idx_reservations_shop_date ON public.reservations(shop_id, reservation_date DESC);
    END IF;
END $$;

-- 피드 위치별 카테고리 검색 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_posts') THEN
        CREATE INDEX IF NOT EXISTS idx_feed_posts_location_category ON public.feed_posts(location_tag, category) WHERE status = 'active';
        CREATE INDEX IF NOT EXISTS idx_feed_posts_author_created ON public.feed_posts(author_id, created_at DESC) WHERE status = 'active';
    END IF;
END $$;

-- 포인트 거래 사용자별 상태 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_point_transactions_user_status ON public.point_transactions(user_id, status, available_from);
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications(user_id, status, created_at DESC) WHERE status = 'unread';
    END IF;
END $$;

-- 샵 위치별 카테고리 검색 최적화 (기존 개별 인덱스 보완)
-- 공간 데이터와 일반 데이터를 분리하여 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_shops_category_active ON public.shops(main_category) WHERE shop_status = 'active';
CREATE INDEX IF NOT EXISTS idx_shops_type_partnership ON public.shops(shop_type, partnership_started_at DESC) WHERE shop_status = 'active';

-- 결제 내역 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
        CREATE INDEX IF NOT EXISTS idx_payments_user_status ON public.payments(user_id, payment_status, paid_at DESC);
        CREATE INDEX IF NOT EXISTS idx_payments_reservation_status ON public.payments(reservation_id, payment_status);
    END IF;
END $$;

-- 추가 중요 성능 인덱스
-- 피드 타임라인 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_posts') THEN
        CREATE INDEX IF NOT EXISTS idx_feed_posts_timeline ON public.feed_posts(status, created_at DESC) WHERE status = 'active';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        CREATE INDEX IF NOT EXISTS idx_reservations_shop_datetime ON public.reservations(shop_id, reservation_datetime) 
            WHERE status IN ('confirmed', 'requested');
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        CREATE INDEX IF NOT EXISTS idx_point_transactions_available ON public.point_transactions(user_id, status, available_from, expires_at) 
            WHERE status = 'available';
    END IF;
END $$;

-- 추천인 성과 조회 최적화
CREATE INDEX IF NOT EXISTS idx_users_referrer_lookup ON public.users(referred_by_code, created_at) WHERE referred_by_code IS NOT NULL;

-- 샵 검색 및 필터링 최적화
CREATE INDEX IF NOT EXISTS idx_shops_search ON public.shops(name, main_category, shop_status) WHERE shop_status = 'active';

-- 알림 실시간 조회 최적화
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
        CREATE INDEX IF NOT EXISTS idx_notifications_realtime ON public.notifications(user_id, created_at DESC, status) WHERE status = 'unread';
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        CREATE INDEX IF NOT EXISTS idx_admin_reservations_stats ON public.reservations(status, created_at, total_amount) WHERE status = 'completed';
    END IF;
END $$;