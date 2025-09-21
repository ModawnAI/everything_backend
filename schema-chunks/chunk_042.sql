-- =============================================
-- SCHEMA CHUNK 42 - TRIGGERS AND FUNCTIONS
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 5.6KB
-- IMPORTANT: This chunk creates triggers and functions and should be run AFTER all tables are created
-- =============================================

-- =============================================

-- updated_at 필드 자동 업데이트 함수
-- 데이터 수정 시 타임스탬프 자동 갱신 (한국 시간대 기준)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW() AT TIME ZONE 'Asia/Seoul';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 사용자 활동 시간 업데이트 함수
-- API 호출 시 마지막 활동 시간 자동 갱신
CREATE OR REPLACE FUNCTION update_last_active()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_active_at = NOW() AT TIME ZONE 'Asia/Seoul';
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 관련 테이블들에 updated_at 트리거 적용
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'users') THEN
        DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;
        CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
        DROP TRIGGER IF EXISTS update_user_settings_updated_at ON public.user_settings;
        CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shops') THEN
        DROP TRIGGER IF EXISTS update_shops_updated_at ON public.shops;
        CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'reservations') THEN
        DROP TRIGGER IF EXISTS update_reservations_updated_at ON public.reservations;
        CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 사용자 포인트 잔액 자동 업데이트 함수
-- 포인트 거래 발생 시 users 테이블의 포인트 필드들 자동 갱신
-- 성능을 위해 비정규화된 데이터 동기화 유지
CREATE OR REPLACE FUNCTION update_user_points()
RETURNS TRIGGER AS $$
BEGIN
    -- 사용자의 총 포인트와 사용 가능 포인트 업데이트
    UPDATE public.users SET
        total_points = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.point_transactions 
            WHERE user_id = NEW.user_id 
            AND amount > 0 
            AND status = 'available'
        ),
        available_points = (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.point_transactions 
            WHERE user_id = NEW.user_id 
            AND status = 'available'
            AND (available_from IS NULL OR available_from <= NOW()) -- 7일 제한 체크
            AND (expires_at IS NULL OR expires_at > NOW()) -- 만료 체크
        )
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 포인트 거래 시 잔액 업데이트 트리거
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'point_transactions') THEN
        DROP TRIGGER IF EXISTS update_point_balances_trigger ON public.point_transactions;
        CREATE TRIGGER update_point_balances_trigger 
            AFTER INSERT OR UPDATE ON public.point_transactions
            FOR EACH ROW EXECUTE FUNCTION update_user_points();
    END IF;
END $$;

-- 피드 시스템 트리거 함수들 (v3.2)
-- 게시물 좋아요/댓글 수 자동 업데이트
CREATE OR REPLACE FUNCTION update_post_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_TABLE_NAME = 'post_likes' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE public.feed_posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.feed_posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
        END IF;
    ELSIF TG_TABLE_NAME = 'post_comments' THEN
        IF TG_OP = 'INSERT' THEN
            UPDATE public.feed_posts SET comment_count = comment_count + 1 WHERE id = NEW.post_id;
        ELSIF TG_OP = 'DELETE' THEN
            UPDATE public.feed_posts SET comment_count = comment_count - 1 WHERE id = OLD.post_id;
        END IF;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 댓글 좋아요 수 자동 업데이트
CREATE OR REPLACE FUNCTION update_comment_like_counts()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE public.post_comments SET like_count = like_count + 1 WHERE id = NEW.comment_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE public.post_comments SET like_count = like_count - 1 WHERE id = OLD.comment_id;
    END IF;
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- 피드 관련 트리거 생성
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_likes') THEN
        DROP TRIGGER IF EXISTS update_post_like_count_trigger ON public.post_likes;
        CREATE TRIGGER update_post_like_count_trigger 
            AFTER INSERT OR DELETE ON public.post_likes
            FOR EACH ROW EXECUTE FUNCTION update_post_counts();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_comments') THEN
        DROP TRIGGER IF EXISTS update_post_comment_count_trigger ON public.post_comments;
        CREATE TRIGGER update_post_comment_count_trigger 
            AFTER INSERT OR DELETE ON public.post_comments
            FOR EACH ROW EXECUTE FUNCTION update_post_counts();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'comment_likes') THEN
        DROP TRIGGER IF EXISTS update_comment_like_count_trigger ON public.comment_likes;
        CREATE TRIGGER update_comment_like_count_trigger 
            AFTER INSERT OR DELETE ON public.comment_likes
            FOR EACH ROW EXECUTE FUNCTION update_comment_like_counts();
    END IF;
END $$;

-- 피드 게시물 updated_at 트리거
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feed_posts') THEN
        DROP TRIGGER IF EXISTS update_feed_posts_updated_at ON public.feed_posts;
        CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'post_comments') THEN
        DROP TRIGGER IF EXISTS update_post_comments_updated_at ON public.post_comments;
        CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shop_contacts') THEN
        DROP TRIGGER IF EXISTS update_shop_contacts_updated_at ON public.shop_contacts;
        CREATE TRIGGER update_shop_contacts_updated_at BEFORE UPDATE ON public.shop_contacts
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- 콘텐츠 모더레이션 트리거 함수 (v3.2 신규)
-- 게시물 신고 시 자동 숨김 처리
CREATE OR REPLACE FUNCTION auto_moderate_content()
RETURNS TRIGGER AS $$
DECLARE
    report_threshold INTEGER := 5; -- 신고 5회 이상 시 자동 숨김
BEGIN
    -- 게시물 신고 수 증가
    IF TG_TABLE_NAME = 'content_reports' AND NEW.reported_content_type = 'feed_post' THEN
        UPDATE public.feed_posts 
        SET report_count = report_count + 1,
            status = CASE 
                WHEN report_count + 1 >= report_threshold THEN 'hidden'
                ELSE status 
            END
        WHERE id = NEW.reported_content_id::UUID;
        
        -- 관리자에게 알림 발송 (신고 임계값 도달 시)
        IF (SELECT report_count FROM public.feed_posts WHERE id = NEW.reported_content_id::UUID) >= report_threshold THEN
            INSERT INTO public.notifications (
                user_id, notification_type, title, message, related_id
            )
            SELECT id, 'system', '콘텐츠 자동 숨김', 
                   '신고가 누적되어 게시물이 자동으로 숨겨졌습니다.', 
                   NEW.reported_content_id
            FROM public.users WHERE user_role = 'admin';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 콘텐츠 신고 시 자동 모더레이션 트리거
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'content_reports') THEN
        DROP TRIGGER IF EXISTS auto_moderate_trigger ON public.content_reports;
        CREATE TRIGGER auto_moderate_trigger 
            AFTER INSERT ON public.content_reports
            FOR EACH ROW EXECUTE FUNCTION auto_moderate_content();
    END IF;
END $$;