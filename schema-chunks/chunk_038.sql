-- =============================================
-- SCHEMA CHUNK 38
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 7.0KB
-- =============================================

-- =============================================

-- 모든 테이블에 RLS 활성화 (보안 강화)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 피드 시스템 테이블에 RLS 활성화 (v3.2)
ALTER TABLE public.feed_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_contacts ENABLE ROW LEVEL SECURITY;

-- 새로운 테이블들에 RLS 활성화 (v3.3)
ALTER TABLE public.shop_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_type_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_hierarchy ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contact_method_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shop_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_actions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.moderation_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_failures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conflicts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservation_status_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_role_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cdn_configurations ENABLE ROW LEVEL SECURITY;

-- 기본 RLS 정책들

-- 사용자는 자신의 데이터만 조회 가능
CREATE POLICY "Users can read own data" ON public.users
    FOR SELECT USING (auth.uid() = id);

-- 사용자는 자신의 데이터만 수정 가능
CREATE POLICY "Users can update own data" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- 사용자는 자신의 설정만 관리 가능
CREATE POLICY "Users can manage own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id);

-- 모든 사용자가 활성 샵 조회 가능 (홈 화면, 검색 기능)
CREATE POLICY "Public can read active shops" ON public.shops
    FOR SELECT USING (shop_status = 'active');

-- 샵 사장은 자신의 샵만 관리 가능
CREATE POLICY "Shop owners can manage own shops" ON public.shops
    FOR ALL USING (auth.uid() = owner_id);

-- 사용자는 자신의 예약만 조회 가능
CREATE POLICY "Users can read own reservations" ON public.reservations
    FOR SELECT USING (auth.uid() = user_id);

-- 샵 사장은 자신의 샵 예약들만 조회 가능
CREATE POLICY "Shop owners can read shop reservations" ON public.reservations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE shops.id = reservations.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

-- 사용자는 자신의 포인트 거래만 조회 가능
CREATE POLICY "Users can read own point transactions" ON public.point_transactions
    FOR SELECT USING (auth.uid() = user_id);

-- 사용자는 자신의 알림만 조회 가능
CREATE POLICY "Users can read own notifications" ON public.notifications
    FOR SELECT USING (auth.uid() = user_id);

-- 피드 시스템 RLS 정책 (v3.2)
-- 모든 사용자가 활성 게시물 조회 가능
CREATE POLICY "Public can read active posts" ON public.feed_posts
    FOR SELECT USING (status = 'active');

-- 사용자는 자신의 게시물만 관리 가능
CREATE POLICY "Users can manage own posts" ON public.feed_posts
    FOR ALL USING (auth.uid() = author_id);

-- 게시물 이미지는 해당 게시물 소유자만 관리 가능
CREATE POLICY "Post owners can manage post images" ON public.post_images
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts 
            WHERE feed_posts.id = post_images.post_id 
            AND feed_posts.author_id = auth.uid()
        )
    );

-- 모든 사용자가 활성 게시물에 좋아요 가능
CREATE POLICY "Users can like active posts" ON public.post_likes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts 
            WHERE feed_posts.id = post_likes.post_id 
            AND feed_posts.status = 'active'
        )
    );

-- 모든 사용자가 활성 게시물에 댓글 작성 가능
CREATE POLICY "Users can comment on active posts" ON public.post_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.feed_posts 
            WHERE feed_posts.id = post_comments.post_id 
            AND feed_posts.status = 'active'
        )
    );

-- 사용자는 자신의 댓글만 수정/삭제 가능
CREATE POLICY "Users can manage own comments" ON public.post_comments
    FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments" ON public.post_comments
    FOR DELETE USING (auth.uid() = user_id);

-- 모든 사용자가 활성 댓글에 좋아요 가능
CREATE POLICY "Users can like active comments" ON public.comment_likes
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.post_comments 
            WHERE post_comments.id = comment_likes.comment_id 
            AND post_comments.status = 'active'
        )
    );

-- 샵 소유자는 자신의 샵 연락처만 관리 가능
CREATE POLICY "Shop owners can manage shop contacts" ON public.shop_contacts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE shops.id = shop_contacts.shop_id 
            AND shops.owner_id = auth.uid()
        )
    );

-- 모든 사용자가 활성 샵의 연락처 정보 조회 가능
CREATE POLICY "Public can read shop contacts" ON public.shop_contacts
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE shops.id = shop_contacts.shop_id 
            AND shops.shop_status = 'active'
        )
    );

-- 관리자 전체 권한 정책들 (시스템 관리용)
-- 관리자는 모든 사용자 데이터 조회/수정 가능
CREATE POLICY "Admins can read all user data" ON public.users
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

CREATE POLICY "Admins can update all user data" ON public.users
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- 관리자는 모든 샵 데이터 관리 가능
CREATE POLICY "Admins can manage all shops" ON public.shops
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- 관리자는 모든 예약 관리 가능
CREATE POLICY "Admins can manage all reservations" ON public.reservations
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- 관리자는 모든 피드 콘텐츠 관리 가능
CREATE POLICY "Admins can manage all feed content" ON public.feed_posts
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );

-- 관리자는 모든 댓글 관리 가능
CREATE POLICY "Admins can manage all comments" ON public.post_comments
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE id = auth.uid() AND user_role = 'admin'
        )
    );