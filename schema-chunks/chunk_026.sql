-- =============================================
-- SCHEMA CHUNK 26
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.7KB
-- =============================================

-- =============================================

-- 관리자 액션 로그 테이블
-- 웹 관리자 대시보드에서 수행한 모든 관리 작업 기록
-- 감사(Audit) 목적과 관리자 권한 남용 방지
CREATE TABLE public.admin_actions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    admin_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT, -- 작업 수행 관리자
    action_type admin_action_type NOT NULL, -- 작업 유형
    target_type VARCHAR(50) NOT NULL, -- 대상 엔티티 유형
    target_id UUID NOT NULL, -- 대상 엔티티 ID
    reason TEXT, -- 작업 사유
    metadata JSONB, -- 추가 작업 정보
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 앱 공지사항 테이블
-- 마이페이지의 공지사항 기능과 홈 화면 이벤트 배너 지원
-- target_user_type으로 사용자 그룹별 노출 제어
CREATE TABLE public.announcements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(255) NOT NULL, -- 공지 제목
    content TEXT NOT NULL, -- 공지 내용
    is_important BOOLEAN DEFAULT FALSE, -- 중요 공지 여부
    is_active BOOLEAN DEFAULT TRUE, -- 노출 여부
    target_user_type user_role[], -- 노출 대상 사용자 그룹
    starts_at TIMESTAMPTZ DEFAULT NOW(), -- 노출 시작일
    ends_at TIMESTAMPTZ, -- 노출 종료일
    created_by UUID REFERENCES public.users(id), -- 작성한 관리자
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 자주 묻는 질문 테이블
-- 마이페이지의 FAQ 기능 지원
-- 카테고리별 분류와 조회수/도움됨 통계 수집
CREATE TABLE public.faqs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category VARCHAR(100) NOT NULL, -- FAQ 카테고리 ('예약', '포인트', '계정' 등)
    question TEXT NOT NULL, -- 질문
    answer TEXT NOT NULL, -- 답변
    display_order INTEGER DEFAULT 0, -- 노출 순서
    is_active BOOLEAN DEFAULT TRUE, -- 노출 여부
    view_count INTEGER DEFAULT 0, -- 조회수
    helpful_count INTEGER DEFAULT 0, -- 도움됨 수
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);