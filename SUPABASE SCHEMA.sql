-- =============================================
-- 에뷰리띵 앱 - SUPABASE 데이터베이스 구조 (MVP)
-- EBEAUTYTHING APP - SUPABASE DATABASE STRUCTURE (MVP)
-- Version: 3.3 - Simplified for MVP (No Social Feed, No Reviews)
-- Based on PRD.txt, Flutter Development Guide, and Web Admin Guide
-- =============================================

-- PostgreSQL 확장 기능 활성화
-- PostGIS: 위치 기반 서비스 (내 주변 샵 찾기, 거리 계산)를 위해 필수
-- UUID: 보안성과 확장성을 위해 모든 Primary Key에 UUID 사용
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- =============================================
-- ENUMS (열거형 타입)
-- =============================================

-- 사용자 관련 ENUM
-- 성별 선택: 회원가입 화면에서 다양한 성별 옵션 제공 (개인정보보호법 준수)
CREATE TYPE user_gender AS ENUM ('male', 'female', 'other', 'prefer_not_to_say');

-- 사용자 상태: 계정 관리 및 보안을 위한 상태 구분
-- active: 정상 사용자, inactive: 비활성, suspended: 정지, deleted: 탈퇴 (소프트 삭제)
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'deleted');

-- 사용자 역할: 권한 기반 접근 제어 및 기능 구분
-- user: 일반 사용자, shop_owner: 샵 사장, admin: 관리자, influencer: 인플루언서
CREATE TYPE user_role AS ENUM ('user', 'shop_owner', 'admin', 'influencer');

-- 소셜 로그인 제공자: 소셜 로그인 화면에서 지원하는 플랫폼들
CREATE TYPE social_provider AS ENUM ('kakao', 'apple', 'google', 'email');

-- 샵 관련 ENUM
-- 샵 상태: 샵 운영 상태 관리 및 노출 제어
-- pending_approval: 신규 입점 대기, active: 운영중, inactive: 임시 중단
CREATE TYPE shop_status AS ENUM ('active', 'inactive', 'pending_approval', 'suspended', 'deleted');

-- 샵 타입: PRD 2.1 정책에 따른 입점샵/비입점샵 구분으로 노출 순서 결정
-- partnered: 입점샵 (우선 노출), non_partnered: 비입점샵
CREATE TYPE shop_type AS ENUM ('partnered', 'non_partnered');

-- 서비스 카테고리: 앱에서 제공하는 뷰티 서비스 분류
-- hair는 향후 확장을 위해 정의하되 현재는 비활성화 상태
CREATE TYPE service_category AS ENUM ('nail', 'eyelash', 'waxing', 'eyebrow_tattoo', 'hair');

-- 샵 인증 상태: 입점 심사 과정 관리
CREATE TYPE shop_verification_status AS ENUM ('pending', 'verified', 'rejected');

-- 예약 관련 ENUM
-- 예약 상태: 예약 플로우 전체 과정을 추적하고 각 상태별 UI 표시
-- requested: 예약 요청됨, confirmed: 샵에서 확정, completed: 서비스 완료
CREATE TYPE reservation_status AS ENUM ('requested', 'confirmed', 'completed', 'cancelled_by_user', 'cancelled_by_shop', 'no_show');

-- 결제 상태: 토스페이먼츠 연동 및 예약금/잔금 분할 결제 지원
-- deposit_paid: 예약금만 결제, fully_paid: 전액 결제 완료
CREATE TYPE payment_status AS ENUM ('pending', 'deposit_paid', 'fully_paid', 'refunded', 'partially_refunded', 'failed');

-- 결제 수단: 토스페이먼츠 및 간편결제 옵션 지원
CREATE TYPE payment_method AS ENUM ('toss_payments', 'kakao_pay', 'naver_pay', 'card', 'bank_transfer');

-- 포인트 관련 ENUM
-- 포인트 거래 유형: PRD 2.4, 2.5 정책에 따른 포인트 적립/사용 추적
-- earned_service: 서비스 이용 적립 (2.5%), earned_referral: 추천 적립
CREATE TYPE point_transaction_type AS ENUM ('earned_service', 'earned_referral', 'used_service', 'expired', 'adjusted', 'influencer_bonus');

-- 포인트 상태: 7일 제한 규칙 적용을 위한 상태 관리
-- pending: 7일 대기중, available: 사용 가능, used: 사용됨, expired: 만료됨
CREATE TYPE point_status AS ENUM ('pending', 'available', 'used', 'expired');

-- 알림 관련 ENUM
-- 알림 타입: 앱 내 다양한 알림 상황에 대응
CREATE TYPE notification_type AS ENUM ('reservation_confirmed', 'reservation_cancelled', 'point_earned', 'referral_success', 'system');

-- 알림 상태: 알림 목록 화면에서 읽음/읽지않음 표시
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'deleted');

-- 신고 관련 ENUM
-- 신고 사유: 컨텐츠 모더레이션을 위한 신고 카테고리
CREATE TYPE report_reason AS ENUM ('spam', 'inappropriate_content', 'harassment', 'other');

-- 관리자 액션 ENUM
-- 관리자 작업 로그: 웹 관리자 대시보드에서 수행된 작업 추적
CREATE TYPE admin_action_type AS ENUM ('user_suspended', 'shop_approved', 'shop_rejected', 'refund_processed', 'points_adjusted');

-- =============================================
-- 핵심 테이블들 (CORE TABLES)
-- =============================================

-- 사용자 테이블 (Supabase auth.users 확장)
-- Supabase Auth와 연동하여 소셜 로그인 정보와 앱 내 프로필 정보를 통합 관리
-- 추천인 시스템(PRD 2.2)과 포인트 시스템(PRD 2.4, 2.5) 지원을 위한 필드들 포함
CREATE TABLE public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE,
    phone_number VARCHAR(20) UNIQUE, -- PASS 본인인증에서 받은 전화번호
    phone_verified BOOLEAN DEFAULT FALSE, -- 전화번호 인증 완료 여부
    name VARCHAR(100) NOT NULL, -- 실명 (본인인증 후 받음)
    nickname VARCHAR(50), -- 향후 확장을 위한 닉네임 필드
    gender user_gender, -- 회원가입 시 선택한 성별
    birth_date DATE, -- 생년월일 (타겟 광고 및 통계용)
    profile_image_url TEXT, -- Supabase Storage에 저장된 프로필 이미지
    user_role user_role DEFAULT 'user', -- 권한 구분
    user_status user_status DEFAULT 'active', -- 계정 상태
    is_influencer BOOLEAN DEFAULT FALSE, -- 인플루언서 자격 여부 (PRD 2.2)
    influencer_qualified_at TIMESTAMPTZ, -- 인플루언서 자격 획득 일시
    social_provider social_provider, -- 소셜 로그인 제공자
    social_provider_id VARCHAR(255), -- 소셜 로그인 고유 ID
    referral_code VARCHAR(20) UNIQUE, -- 개인 추천 코드 (자동 생성)
    referred_by_code VARCHAR(20), -- 가입 시 입력한 추천인 코드
    total_points INTEGER DEFAULT 0, -- 총 적립 포인트 (성능 최적화용 비정규화)
    available_points INTEGER DEFAULT 0, -- 사용 가능한 포인트 (7일 제한 적용 후)
    total_referrals INTEGER DEFAULT 0, -- 총 추천한 친구 수
    successful_referrals INTEGER DEFAULT 0, -- 결제까지 완료한 추천 친구 수
    last_login_at TIMESTAMPTZ, -- 마지막 로그인 시간
    terms_accepted_at TIMESTAMPTZ, -- 이용약관 동의 일시 (법적 요구사항)
    privacy_accepted_at TIMESTAMPTZ, -- 개인정보처리방침 동의 일시
    marketing_consent BOOLEAN DEFAULT FALSE, -- 마케팅 정보 수신 동의
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 설정 테이블
-- 알림 설정 화면과 기타 설정들을 위한 별도 테이블
-- users 테이블과 분리하여 설정 변경 시 메인 테이블 업데이트 최소화
CREATE TABLE public.user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    push_notifications_enabled BOOLEAN DEFAULT TRUE, -- 푸시 알림 전체 ON/OFF
    reservation_notifications BOOLEAN DEFAULT TRUE, -- 예약 관련 알림
    event_notifications BOOLEAN DEFAULT TRUE, -- 이벤트 알림
    marketing_notifications BOOLEAN DEFAULT FALSE, -- 마케팅 알림
    location_tracking_enabled BOOLEAN DEFAULT TRUE, -- 위치 추적 허용
    language_preference VARCHAR(10) DEFAULT 'ko', -- 언어 설정
    currency_preference VARCHAR(3) DEFAULT 'KRW', -- 통화 설정
    theme_preference VARCHAR(20) DEFAULT 'light', -- 테마 설정 (향후 다크모드)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id)
);

-- 샵 정보 테이블
-- 홈 화면의 "내 주변 샵" 기능과 샵 상세 화면을 위한 핵심 테이블
-- PostGIS의 GEOGRAPHY 타입으로 위치 기반 검색 최적화
CREATE TABLE public.shops (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- 샵 사장님 계정
    name VARCHAR(255) NOT NULL, -- 샵명
    description TEXT, -- 샵 소개
    phone_number VARCHAR(20), -- 샵 전화번호 (바로 통화 기능)
    email VARCHAR(255), -- 샵 이메일
    address TEXT NOT NULL, -- 주소 (지도 표시용)
    detailed_address TEXT, -- 상세주소
    postal_code VARCHAR(10), -- 우편번호
    latitude DECIMAL(10, 8), -- 위도 (별도 저장으로 호환성 확보)
    longitude DECIMAL(11, 8), -- 경도
    location GEOGRAPHY(POINT, 4326), -- PostGIS 지리정보 (공간 검색 최적화)
    shop_type shop_type DEFAULT 'non_partnered', -- 입점/비입점 구분 (PRD 2.1)
    shop_status shop_status DEFAULT 'pending_approval', -- 운영 상태
    verification_status shop_verification_status DEFAULT 'pending', -- 인증 상태
    business_license_number VARCHAR(50), -- 사업자등록번호
    business_license_image_url TEXT, -- 사업자등록증 이미지 (인증용)
    main_category service_category NOT NULL, -- 주 서비스 카테고리
    sub_categories service_category[], -- 부가 서비스들 (배열로 다중 선택)
    operating_hours JSONB, -- 영업시간 (요일별 오픈/마감 시간)
    payment_methods payment_method[], -- 지원하는 결제 수단들
    kakao_channel_url TEXT, -- 카카오톡 채널 연결 URL
    total_bookings INTEGER DEFAULT 0, -- 총 예약 수 (성능용 비정규화)
    partnership_started_at TIMESTAMPTZ, -- 입점 시작일 (PRD 2.1 노출 순서 결정)
    featured_until TIMESTAMPTZ, -- 추천샵 노출 종료일
    is_featured BOOLEAN DEFAULT FALSE, -- 추천샵 여부
    commission_rate DECIMAL(5,2) DEFAULT 10.00, -- 수수료율 (%)
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 샵 이미지 테이블
-- 샵 상세 화면의 이미지 슬라이더를 위한 여러 이미지 저장
-- display_order로 노출 순서 제어 가능
CREATE TABLE public.shop_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    alt_text VARCHAR(255), -- 접근성을 위한 대체 텍스트
    is_primary BOOLEAN DEFAULT FALSE, -- 대표 이미지 여부
    display_order INTEGER DEFAULT 0, -- 이미지 노출 순서
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 샵 서비스 테이블
-- 샵 상세 화면의 "서비스 목록" 탭과 예약 시 서비스 선택을 위한 테이블
-- 가격 범위(min/max)로 "₩50,000 ~ ₩80,000" 형태 표시 지원
CREATE TABLE public.shop_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL, -- 서비스명 (예: "속눈썹 연장")
    description TEXT, -- 서비스 상세 설명
    category service_category NOT NULL, -- 서비스 카테고리
    price_min INTEGER, -- 최소 가격 (원 단위)
    price_max INTEGER, -- 최대 가격 (원 단위)
    duration_minutes INTEGER, -- 예상 소요 시간 (예약 슬롯 계산용)
    deposit_amount INTEGER, -- 예약금 금액 (고정값)
    deposit_percentage DECIMAL(5,2), -- 예약금 비율 (전체 금액의 %)
    is_available BOOLEAN DEFAULT TRUE, -- 서비스 제공 여부
    booking_advance_days INTEGER DEFAULT 30, -- 사전 예약 가능 일수
    cancellation_hours INTEGER DEFAULT 24, -- 취소 가능 시간 (시간 단위)
    display_order INTEGER DEFAULT 0, -- 서비스 노출 순서
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 서비스 이미지 테이블
-- 각 서비스별 이미지들 (시술 전후 사진 등)
CREATE TABLE public.service_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    alt_text VARCHAR(255),
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 예약 시스템 (RESERVATION SYSTEM)
-- =============================================

-- 예약 테이블
-- 예약 플로우의 핵심 테이블로, 예약 내역 화면과 샵 관리에서 사용
-- reservation_datetime은 GENERATED ALWAYS로 자동 계산하여 시간 기반 쿼리 최적화
CREATE TABLE public.reservations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    reservation_date DATE NOT NULL, -- 예약 날짜
    reservation_time TIME NOT NULL, -- 예약 시간
    reservation_datetime TIMESTAMPTZ GENERATED ALWAYS AS (
        (reservation_date || ' ' || reservation_time)::TIMESTAMPTZ
    ) STORED, -- 날짜+시간 결합 (인덱스 및 정렬용)
    status reservation_status DEFAULT 'requested', -- 예약 상태
    total_amount INTEGER NOT NULL, -- 총 서비스 금액
    deposit_amount INTEGER NOT NULL, -- 결제한 예약금
    remaining_amount INTEGER, -- 현장에서 결제할 잔금
    points_used INTEGER DEFAULT 0, -- 사용한 포인트
    points_earned INTEGER DEFAULT 0, -- 적립될 포인트 (PRD 2.4 - 2.5%)
    special_requests TEXT, -- 특별 요청사항
    cancellation_reason TEXT, -- 취소 사유
    no_show_reason TEXT, -- 노쇼 사유
    confirmed_at TIMESTAMPTZ, -- 샵에서 예약 확정한 시간
    completed_at TIMESTAMPTZ, -- 서비스 완료 시간
    cancelled_at TIMESTAMPTZ, -- 취소된 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 예약-서비스 연결 테이블 (다대다 관계)
-- 한 번 예약에 여러 서비스를 선택할 수 있도록 지원
-- 예약 시점의 가격을 저장하여 나중에 가격이 변경되어도 예약 정보 보존
CREATE TABLE public.reservation_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE RESTRICT,
    quantity INTEGER DEFAULT 1, -- 동일 서비스 수량
    unit_price INTEGER NOT NULL, -- 예약 시점의 단가
    total_price INTEGER NOT NULL, -- 단가 × 수량
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 결제 거래 테이블
-- 토스페이먼츠 연동과 예약금/잔금 분할 결제 지원
-- provider_transaction_id로 외부 결제사와 매핑
CREATE TABLE public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    payment_method payment_method NOT NULL, -- 결제 수단
    payment_status payment_status DEFAULT 'pending', -- 결제 상태
    amount INTEGER NOT NULL, -- 결제 금액 (원)
    currency VARCHAR(3) DEFAULT 'KRW', -- 통화
    payment_provider VARCHAR(50), -- 결제 제공사 ('toss_payments' 등)
    provider_transaction_id VARCHAR(255), -- 결제사 거래 ID
    provider_order_id VARCHAR(255), -- 결제사 주문 ID
    is_deposit BOOLEAN DEFAULT TRUE, -- 예약금 여부 (true: 예약금, false: 잔금)
    paid_at TIMESTAMPTZ, -- 결제 완료 시간
    refunded_at TIMESTAMPTZ, -- 환불 처리 시간
    refund_amount INTEGER DEFAULT 0, -- 환불 금액
    failure_reason TEXT, -- 결제 실패 사유
    metadata JSONB, -- 결제사별 추가 데이터
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 포인트 시스템 (POINTS SYSTEM)
-- =============================================

-- 포인트 거래 내역 테이블
-- PRD 2.4, 2.5의 포인트 정책 구현을 위한 핵심 테이블
-- available_from으로 7일 제한 규칙 적용
CREATE TABLE public.point_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    reservation_id UUID REFERENCES public.reservations(id) ON DELETE SET NULL, -- 서비스 연관 적립
    transaction_type point_transaction_type NOT NULL, -- 거래 유형
    amount INTEGER NOT NULL, -- 포인트 금액 (적립=양수, 사용=음수)
    description TEXT, -- 거래 설명
    status point_status DEFAULT 'pending', -- 포인트 상태
    available_from TIMESTAMPTZ, -- 사용 가능 시작일 (적립 후 7일)
    expires_at TIMESTAMPTZ, -- 포인트 만료일
    related_user_id UUID REFERENCES public.users(id), -- 추천 관련 포인트의 경우 추천한 사용자
    metadata JSONB, -- 추가 거래 정보
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 포인트 잔액 테이블 (성능 최적화용 구체화 뷰)
-- 포인트 계산이 복잡하므로 별도 테이블로 빠른 조회 지원
CREATE TABLE public.point_balances (
    user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
    total_earned INTEGER DEFAULT 0, -- 총 적립 포인트
    total_used INTEGER DEFAULT 0, -- 총 사용 포인트
    available_balance INTEGER DEFAULT 0, -- 현재 사용 가능 포인트
    pending_balance INTEGER DEFAULT 0, -- 7일 대기 중인 포인트
    last_calculated_at TIMESTAMPTZ DEFAULT NOW(), -- 마지막 계산 시간
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 즐겨찾기 (FAVORITES)
-- =============================================

-- 사용자 즐겨찾기 테이블
-- 홈 화면의 "내가 찜한 샵" 섹션을 위한 테이블
-- UNIQUE 제약으로 중복 즐겨찾기 방지
CREATE TABLE public.user_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, shop_id) -- 동일 샵 중복 즐겨찾기 방지
);

-- =============================================
-- 알림 시스템 (NOTIFICATIONS)
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

-- =============================================
-- 컨텐츠 모더레이션 & 신고 (CONTENT MODERATION & REPORTING)
-- =============================================

-- 컨텐츠 신고 테이블
-- 향후 피드 기능 및 부적절한 샵/사용자 신고 기능 지원
CREATE TABLE public.content_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE, -- 신고자
    reported_content_type VARCHAR(50) NOT NULL, -- 신고 대상 유형 ('shop', 'user')
    reported_content_id UUID NOT NULL, -- 신고 대상 ID
    reason report_reason NOT NULL, -- 신고 사유
    description TEXT, -- 상세 신고 내용
    status VARCHAR(20) DEFAULT 'pending', -- 처리 상태
    reviewed_by UUID REFERENCES public.users(id), -- 검토한 관리자
    reviewed_at TIMESTAMPTZ, -- 검토 완료 시간
    resolution_notes TEXT, -- 처리 결과 메모
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- 관리자 & 분석 (ADMIN & ANALYTICS)
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

-- =============================================
-- STORAGE BUCKETS 설정
-- =============================================

-- Supabase Storage 버킷 설정
-- 이미지 업로드 및 관리를 위한 버킷들

/*
-- 프로필 이미지 버킷 (공개)
INSERT INTO storage.buckets (id, name, public) VALUES ('profile-images', 'profile-images', true);

-- 샵 이미지 버킷 (공개) - 샵 상세 화면 이미지 슬라이더용
INSERT INTO storage.buckets (id, name, public) VALUES ('shop-images', 'shop-images', true);

-- 서비스 이미지 버킷 (공개) - 서비스별 이미지들
INSERT INTO storage.buckets (id, name, public) VALUES ('service-images', 'service-images', true);

-- 사업자등록증 등 문서 버킷 (비공개) - 입점 심사용
INSERT INTO storage.buckets (id, name, public) VALUES ('business-documents', 'business-documents', false);
*/

-- =============================================
-- 성능 최적화 인덱스들 (INDEXES FOR PERFORMANCE)
-- =============================================

-- 사용자 테이블 인덱스
-- 추천인 코드와 전화번호는 자주 검색되므로 인덱스 생성
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_phone_number ON public.users(phone_number);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_status ON public.users(user_status); -- 활성 사용자 필터링

-- 샵 테이블 인덱스
-- location은 GIST 인덱스로 공간 검색 최적화 (내 주변 샵 찾기)
CREATE INDEX idx_shops_location ON public.shops USING GIST(location);
CREATE INDEX idx_shops_status ON public.shops(shop_status); -- 활성 샵 필터링
CREATE INDEX idx_shops_type ON public.shops(shop_type); -- 입점/비입점 구분
CREATE INDEX idx_shops_category ON public.shops(main_category); -- 카테고리별 검색

-- 예약 테이블 인덱스
-- 사용자별, 샵별, 날짜별 예약 조회 최적화
CREATE INDEX idx_reservations_user_id ON public.reservations(user_id);
CREATE INDEX idx_reservations_shop_id ON public.reservations(shop_id);
CREATE INDEX idx_reservations_datetime ON public.reservations(reservation_datetime);
CREATE INDEX idx_reservations_status ON public.reservations(status);
CREATE INDEX idx_reservations_date_status ON public.reservations(reservation_date, status); -- 복합 인덱스

-- 포인트 거래 테이블 인덱스
-- 포인트 관리 화면의 내역 조회 최적화
CREATE INDEX idx_point_transactions_user_id ON public.point_transactions(user_id);
CREATE INDEX idx_point_transactions_type ON public.point_transactions(transaction_type);
CREATE INDEX idx_point_transactions_status ON public.point_transactions(status);
CREATE INDEX idx_point_transactions_available_from ON public.point_transactions(available_from); -- 7일 제한 체크

-- 알림 테이블 인덱스
-- 알림 목록 화면의 빠른 로딩을 위한 인덱스
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_status ON public.notifications(status); -- 읽지 않은 알림 조회
CREATE INDEX idx_notifications_type ON public.notifications(notification_type);

-- =============================================
-- 행 수준 보안 (ROW LEVEL SECURITY - RLS)
-- =============================================

-- 모든 테이블에 RLS 활성화 (보안 강화)
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

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

-- =============================================
-- 자동 업데이트 트리거들 (TRIGGERS FOR AUTOMATIC UPDATES)
-- =============================================

-- updated_at 필드 자동 업데이트 함수
-- 데이터 수정 시 타임스탬프 자동 갱신
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 관련 테이블들에 updated_at 트리거 적용
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_settings_updated_at BEFORE UPDATE ON public.user_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shops_updated_at BEFORE UPDATE ON public.shops
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reservations_updated_at BEFORE UPDATE ON public.reservations
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
CREATE TRIGGER update_point_balances_trigger 
    AFTER INSERT OR UPDATE ON public.point_transactions
    FOR EACH ROW EXECUTE FUNCTION update_user_points();

-- =============================================
-- 비즈니스 로직 함수들 (FUNCTIONS FOR BUSINESS LOGIC)
-- =============================================

-- 고유한 추천인 코드 생성 함수
-- 8자리 영숫자 조합으로 중복 방지
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TEXT AS $$
DECLARE
    chars TEXT := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    result TEXT := '';
    i INTEGER;
BEGIN
    FOR i IN 1..8 LOOP
        result := result || substr(chars, floor(random() * length(chars) + 1)::integer, 1);
    END LOOP;
    
    -- 중복 코드 체크 후 재귀 호출로 고유성 보장
    IF EXISTS (SELECT 1 FROM public.users WHERE referral_code = result) THEN
        RETURN generate_referral_code(); -- 중복 시 재귀 호출
    END IF;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 인플루언서 자격 확인 및 업데이트 함수
-- PRD 2.2 정책: 50명 추천 + 50명 모두 1회 이상 결제 완료
CREATE OR REPLACE FUNCTION check_influencer_status(user_uuid UUID)
RETURNS BOOLEAN AS $$
DECLARE
    referral_count INTEGER;
    paid_referral_count INTEGER;
BEGIN
    -- 총 추천한 친구 수 계산
    SELECT COUNT(*) INTO referral_count
    FROM public.users 
    WHERE referred_by_code = (
        SELECT referral_code FROM public.users WHERE id = user_uuid
    );
    
    -- 추천한 친구 중 1회 이상 결제 완료한 친구 수 계산
    SELECT COUNT(DISTINCT u.id) INTO paid_referral_count
    FROM public.users u
    JOIN public.payments p ON u.id = p.user_id
    WHERE u.referred_by_code = (
        SELECT referral_code FROM public.users WHERE id = user_uuid
    ) AND p.payment_status = 'fully_paid';
    
    -- 인플루언서 자격 조건 충족 시 상태 업데이트
    IF referral_count >= 50 AND paid_referral_count >= 50 THEN
        UPDATE public.users SET
            is_influencer = TRUE,
            influencer_qualified_at = NOW(),
            user_role = 'influencer'
        WHERE id = user_uuid AND NOT is_influencer;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 서비스 이용 포인트 적립 함수
-- PRD 2.4 정책: 총 시술 금액의 2.5% 적립, 최대 30만원까지
CREATE OR REPLACE FUNCTION award_service_points(reservation_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_amount INTEGER;
    user_uuid UUID;
    points_to_award INTEGER;
    max_eligible_amount INTEGER := 300000; -- 30만원 한도
    point_rate DECIMAL := 0.025; -- 2.5% 적립률
BEGIN
    -- 예약 정보 조회
    SELECT r.total_amount, r.user_id INTO total_amount, user_uuid
    FROM public.reservations r
    WHERE r.id = reservation_uuid;
    
    -- 포인트 계산 (30만원 한도 적용)
    points_to_award := FLOOR(
        LEAST(total_amount, max_eligible_amount) * point_rate
    );
    
    -- 포인트 거래 내역 생성 (7일 후 사용 가능)
    INSERT INTO public.point_transactions (
        user_id,
        reservation_id,
        transaction_type,
        amount,
        description,
        status,
        available_from
    ) VALUES (
        user_uuid,
        reservation_uuid,
        'earned_service',
        points_to_award,
        '서비스 이용 적립',
        'pending',
        NOW() + INTERVAL '7 days' -- PRD 2.5: 7일 후 사용 가능
    );
    
    RETURN points_to_award;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 초기 데이터 (INITIAL DATA)
-- =============================================

-- 기본 관리자 계정 생성 (실제 운영시 업데이트 필요)
INSERT INTO public.users (
    id,
    email,
    name,
    user_role,
    user_status,
    referral_code,
    created_at
) VALUES (
    '00000000-0000-0000-0000-000000000001'::UUID,
    'admin@ebeautything.com',
    'System Admin',
    'admin',
    'active',
    'ADMIN001',
    NOW()
) ON CONFLICT (id) DO NOTHING;

-- 자주 묻는 질문 초기 데이터
-- 마이페이지 FAQ 기능을 위한 기본 질문들
INSERT INTO public.faqs (category, question, answer, display_order) VALUES
('예약', '예약을 취소하고 싶어요', '예약 시간 24시간 전까지는 100% 환불이 가능합니다. 마이예약에서 취소 버튼을 눌러주세요.', 1),
('예약', '예약금은 얼마인가요?', '예약금은 샵과 서비스에 따라 다르며, 보통 전체 금액의 20-30% 정도입니다.', 2),
('포인트', '포인트는 언제 사용할 수 있나요?', '포인트는 적립된 날로부터 7일 후에 사용 가능합니다.', 1),
('포인트', '포인트 적립률은 얼마인가요?', '서비스 이용 금액의 2.5%가 포인트로 적립됩니다. (최대 30만원까지)', 2),
('계정', '회원탈퇴는 어떻게 하나요?', '마이페이지 > 설정 > 회원탈퇴에서 진행할 수 있습니다.', 1);

-- 앱 공지사항 초기 데이터
INSERT INTO public.announcements (title, content, is_important, target_user_type) VALUES
('에뷰리띵 앱 출시!', '에뷰리띵 앱이 정식 출시되었습니다. 다양한 혜택을 확인해보세요!', true, ARRAY['user'::user_role]);

-- =============================================
-- 주요 조회용 뷰들 (VIEWS FOR COMMON QUERIES)
-- =============================================

-- 사용자 포인트 요약 뷰
-- 포인트 관리 화면에서 사용할 통합 포인트 정보
CREATE VIEW user_point_summary AS
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
    WHERE status = 'pending'
    GROUP BY user_id
) pending ON u.id = pending.user_id
LEFT JOIN (
    SELECT 
        user_id,
        SUM(amount) as points_this_month
    FROM public.point_transactions 
    WHERE status = 'available'
    AND amount > 0
    AND created_at >= date_trunc('month', NOW())
    GROUP BY user_id
) recent ON u.id = recent.user_id;

-- 샵 성과 요약 뷰
-- 웹 관리자 대시보드의 샵 통계용
CREATE VIEW shop_performance_summary AS
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
    WHERE status IN ('confirmed', 'completed')
    AND created_at >= date_trunc('month', NOW())
    GROUP BY shop_id
) recent ON s.id = recent.shop_id
LEFT JOIN (
    SELECT 
        r.shop_id,
        SUM(r.total_amount) as total_revenue
    FROM public.reservations r
    WHERE r.status = 'completed'
    GROUP BY r.shop_id
) revenue ON s.id = revenue.shop_id;

-- =============================================
-- 웹 관리자 대시보드용 뷰들 (ADMIN VIEWS FOR WEB DASHBOARD)
-- =============================================

-- 관리자용 사용자 요약 뷰
-- 웹 관리자의 사용자 관리 화면용
CREATE VIEW admin_users_summary AS
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
ORDER BY created_at DESC;

-- 관리자용 샵 요약 뷰  
-- 웹 관리자의 샵 관리 화면용
CREATE VIEW admin_shops_summary AS
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
ORDER BY s.created_at DESC;

-- 관리자용 예약 요약 뷰
-- 웹 관리자의 예약 현황 화면용
CREATE VIEW admin_reservations_summary AS
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
ORDER BY r.reservation_date DESC, r.reservation_time DESC;

-- =============================================
-- 간소화된 데이터베이스 구조 완료
-- END OF SIMPLIFIED DATABASE STRUCTURE
-- ============================================= 