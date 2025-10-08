-- =============================================
-- SCHEMA CHUNK 20
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.2KB
-- =============================================

-- =============================================

-- 알림 테이블
-- 앱 내 알림 목록과 푸시 알림 발송 이력 관리
-- related_id로 예약, 포인트 등 관련 엔티티 연결
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    notification_type notification_type NOT NULL, -- 알림 유형
    title VARCHAR(255) NOT NULL, -- 알림 제목
    message TEXT NOT NULL, -- 알림 내용
    status notification_status DEFAULT 'unread', -- 읽음 상태
    related_id UUID, -- 관련 엔티티 ID (예약 ID, 포인트 거래 ID 등)
    action_url TEXT, -- 딥링크 URL (탭 시 이동할 화면)
    scheduled_for TIMESTAMPTZ, -- 예약 알림 발송 시간
    sent_at TIMESTAMPTZ, -- 실제 발송 시간
    read_at TIMESTAMPTZ, -- 읽은 시간
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 푸시 알림 토큰 테이블
-- FCM 토큰 관리로 기기별 푸시 알림 발송
-- 기기 변경이나 앱 재설치 시 토큰 업데이트 대응
CREATE TABLE public.push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    token TEXT NOT NULL, -- FCM 토큰
    platform VARCHAR(20) NOT NULL, -- 플랫폼 ('ios', 'android')
    is_active BOOLEAN DEFAULT TRUE, -- 토큰 활성 상태
    last_used_at TIMESTAMPTZ DEFAULT NOW(), -- 마지막 사용 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, token) -- 사용자당 동일 토큰 중복 방지
);