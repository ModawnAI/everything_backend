-- =============================================
-- 에뷰리띵 앱 - SUPABASE 데이터베이스 구조
-- EBEAUTYTHING APP - SUPABASE DATABASE STRUCTURE
-- Version: 3.3 - Enhanced with Shop Categories, Moderation System, CDN Integration, and Security Features
-- Based on PRD v3.3, Phase 3 Shop System, Phase 4 Reservation System, and latest migrations
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
-- user: 일반 사용자, shop_owner: 샵 사장, admin: 관리자
-- 주의: influencer는 별도 boolean 필드로 관리 (다중 역할 지원)
CREATE TYPE user_role AS ENUM ('user', 'shop_owner', 'admin');

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
-- pending: 7일 대기중, available: 사용 가능, used: 사용됨, expired: 만료됨, cancelled: 취소됨
CREATE TYPE point_status AS ENUM ('pending', 'available', 'used', 'expired', 'cancelled');

-- 알림 관련 ENUM
-- 알림 타입: 앱 내 다양한 알림 상황에 대응
CREATE TYPE notification_type AS ENUM (
    'reservation_confirmed', 'reservation_cancelled', 'reservation_completed',
    'point_earned', 'point_expired', 'referral_success', 
    'post_liked', 'comment_added', 'post_reported', 'content_moderated',
    'system', 'promotion', 'shop_message'
);

-- 알림 상태: 알림 목록 화면에서 읽음/읽지않음 표시
CREATE TYPE notification_status AS ENUM ('unread', 'read', 'deleted');

-- 관리자 액션 ENUM
-- 관리자 작업 로그: 웹 관리자 대시보드에서 수행된 작업 추적
CREATE TYPE admin_action_type AS ENUM (
    'user_suspended', 'user_activated', 'shop_approved', 'shop_rejected', 'shop_suspended',
    'refund_processed', 'points_adjusted', 'content_moderated', 'post_hidden', 
    'post_restored', 'user_promoted_influencer', 'reservation_force_completed', 'user_role_update'
);

-- 신고 관련 ENUM (업데이트됨)
-- 신고 사유: 컨텐츠 모더레이션을 위한 신고 카테고리
CREATE TYPE report_reason AS ENUM (
    'inappropriate_content', 'spam', 'fake_shop', 'harassment', 'illegal_services',
    'misleading_information', 'copyright_violation', 'other'
);

-- 신고 상태 ENUM
CREATE TYPE report_status AS ENUM (
    'pending', 'under_review', 'resolved', 'dismissed', 'escalated'
);

-- 연락처 방법 타입 ENUM
CREATE TYPE contact_method_type AS ENUM (
    'phone', 'email', 'kakaotalk_channel', 'kakaotalk_id', 'instagram',
    'facebook', 'youtube', 'naver_blog', 'tiktok', 'website',
    'whatsapp', 'telegram', 'discord', 'custom'
);

-- 연락처 방법 상태 ENUM
CREATE TYPE contact_method_status AS ENUM (
    'active', 'inactive', 'verified', 'pending_verification', 'suspended'
);

-- 모더레이션 룰 타입 ENUM
CREATE TYPE moderation_rule_type AS ENUM (
    'keyword_filter', 'image_content_filter', 'spam_detection', 'duplicate_content',
    'inappropriate_language', 'fake_shop_detection', 'copyright_violation',
    'custom_regex', 'ml_content_analysis', 'user_behavior_pattern'
);

-- 모더레이션 룰 액션 ENUM
CREATE TYPE moderation_rule_action AS ENUM (
    'flag_for_review', 'auto_reject', 'auto_approve', 'send_warning',
    'suspend_shop', 'send_notification', 'escalate_to_admin', 'log_incident', 'custom_action'
);

-- 모더레이션 룰 상태 ENUM
CREATE TYPE moderation_rule_status AS ENUM (
    'active', 'inactive', 'testing', 'deprecated'
);

-- 모더레이션 액션 타입 ENUM
CREATE TYPE moderation_action_type AS ENUM (
    'warning_issued', 'content_removed', 'shop_suspended', 'shop_terminated',
    'report_dismissed', 'no_action_required', 'escalated_to_admin',
    'contact_shop_owner', 'content_edited', 'other'
);

-- 피드 관련 ENUM (v3.2 신규)
-- 피드 게시물 상태: 콘텐츠 모더레이션을 위한 상태 관리
CREATE TYPE post_status AS ENUM ('active', 'hidden', 'reported', 'deleted');

-- 댓글 상태: 댓글 모더레이션 관리
CREATE TYPE comment_status AS ENUM ('active', 'hidden', 'deleted');

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
    last_active_at TIMESTAMPTZ DEFAULT NOW(), -- 마지막 활동 시간 (앱 사용 추적)
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

-- 샵 이미지 테이블 (v3.3 확장됨)
-- 샵 상세 화면의 이미지 슬라이더를 위한 여러 이미지 저장
-- display_order로 노출 순서 제어 가능
CREATE TABLE public.shop_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    alt_text VARCHAR(255), -- 접근성을 위한 대체 텍스트
    is_primary BOOLEAN DEFAULT FALSE, -- 대표 이미지 여부
    display_order INTEGER DEFAULT 0, -- 이미지 노출 순서
    -- v3.3 확장 필드들
    thumbnail_url TEXT,
    medium_url TEXT,
    large_url TEXT,
    thumbnail_webp_url TEXT,
    medium_webp_url TEXT,
    large_webp_url TEXT,
    title VARCHAR(255),
    description TEXT,
    tags TEXT[], -- Array of tags for categorization
    category VARCHAR(50), -- Image category (exterior, interior, service, etc.)
    file_size BIGINT, -- Original file size in bytes
    width INTEGER, -- Image width in pixels
    height INTEGER, -- Image height in pixels
    format VARCHAR(10), -- Image format (jpeg, png, webp)
    compression_ratio DECIMAL(5,2), -- Compression ratio percentage
    metadata JSONB, -- Additional metadata (EXIF, etc.)
    is_optimized BOOLEAN DEFAULT FALSE, -- Whether image has been optimized
    optimization_date TIMESTAMPTZ, -- When image was last optimized
    last_accessed TIMESTAMPTZ, -- Last time image was accessed
    access_count INTEGER DEFAULT 0, -- Number of times image has been accessed
    is_archived BOOLEAN DEFAULT FALSE, -- Whether image is archived
    archived_at TIMESTAMPTZ, -- When image was archived
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 샵 서비스 비즈니스 룰 제약 조건들
    CONSTRAINT check_service_price_range CHECK (
        (price_min IS NULL AND price_max IS NULL) OR 
        (price_min IS NOT NULL AND price_max IS NOT NULL AND price_min <= price_max)
    ),
    CONSTRAINT check_service_prices_positive CHECK (
        (price_min IS NULL OR price_min > 0) AND 
        (price_max IS NULL OR price_max > 0)
    ),
    CONSTRAINT check_duration_positive CHECK (duration_minutes IS NULL OR duration_minutes > 0),
    CONSTRAINT check_deposit_settings CHECK (
        (deposit_amount IS NULL AND deposit_percentage IS NULL) OR
        (deposit_amount IS NOT NULL AND deposit_percentage IS NULL) OR
        (deposit_amount IS NULL AND deposit_percentage IS NOT NULL AND deposit_percentage BETWEEN 0 AND 100)
    ),
    CONSTRAINT check_booking_advance CHECK (booking_advance_days IS NULL OR booking_advance_days >= 0),
    CONSTRAINT check_cancellation_hours CHECK (cancellation_hours IS NULL OR cancellation_hours >= 0)
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
    reservation_datetime TIMESTAMPTZ, -- 날짜+시간 결합 (인덱스 및 정렬용, 한국 시간대 기준)
    status reservation_status DEFAULT 'requested', -- 예약 상태
    total_amount INTEGER NOT NULL, -- 총 서비스 금액
    deposit_amount INTEGER NOT NULL, -- 결제한 예약금
    remaining_amount INTEGER, -- 현장에서 결제할 잔금
    points_used INTEGER DEFAULT 0, -- 사용한 포인트
    points_earned INTEGER DEFAULT 0, -- 적립될 포인트 (PRD 2.4 - 2.5%)
    special_requests TEXT, -- 특별 요청사항
    cancellation_reason TEXT, -- 취소 사유
    no_show_reason TEXT, -- 노쇼 사유
    shop_notes TEXT, -- 샵에서 고객에게 전달하는 메모
    confirmed_at TIMESTAMPTZ, -- 샵에서 예약 확정한 시간
    completed_at TIMESTAMPTZ, -- 서비스 완료 시간
    cancelled_at TIMESTAMPTZ, -- 취소된 시간
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 비즈니스 룰 제약 조건들
    CONSTRAINT check_deposit_amount CHECK (deposit_amount > 0),
    CONSTRAINT check_total_amount CHECK (total_amount > 0),
    CONSTRAINT check_points_used CHECK (points_used >= 0),
    CONSTRAINT check_points_earned CHECK (points_earned >= 0),
    CONSTRAINT check_remaining_amount CHECK (remaining_amount IS NULL OR remaining_amount >= 0),
    CONSTRAINT check_reservation_future CHECK (reservation_date >= CURRENT_DATE),
    CONSTRAINT check_status_timestamps CHECK (
        CASE 
            WHEN status = 'confirmed' THEN confirmed_at IS NOT NULL
            WHEN status = 'completed' THEN completed_at IS NOT NULL AND confirmed_at IS NOT NULL
            WHEN status IN ('cancelled_by_user', 'cancelled_by_shop', 'no_show') THEN cancelled_at IS NOT NULL
            ELSE TRUE
        END
    )
);

-- 예약-서비스 연결 테이블 (다대다 관계)
-- 한 번 예약에 여러 서비스를 선택할 수 있도록 지원
-- 예약 시점의 가격을 저장하여 나중에 가격이 변경되어도 예약 정보 보존
CREATE TABLE public.reservation_services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.shop_services(id) ON DELETE CASCADE,
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
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 결제 비즈니스 룰 제약 조건들
    CONSTRAINT check_payment_amount CHECK (amount > 0),
    CONSTRAINT check_refund_amount CHECK (refund_amount >= 0 AND refund_amount <= amount),
    CONSTRAINT check_payment_timestamps CHECK (
        CASE 
            WHEN payment_status IN ('deposit_paid', 'fully_paid') THEN paid_at IS NOT NULL
            WHEN payment_status IN ('refunded', 'partially_refunded') THEN refunded_at IS NOT NULL
            ELSE TRUE
        END
    )
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
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- 포인트 거래 비즈니스 룰 제약 조건들
    CONSTRAINT check_point_amount_not_zero CHECK (amount != 0),
    CONSTRAINT check_point_amount_sign CHECK (
        CASE 
            WHEN transaction_type IN ('earned_service', 'earned_referral', 'adjusted', 'influencer_bonus') 
                THEN amount > 0  -- 적립은 양수
            WHEN transaction_type IN ('used_service', 'expired') 
                THEN amount < 0  -- 사용/만료는 음수
            ELSE TRUE
        END
    ),
    CONSTRAINT check_point_expiry CHECK (expires_at IS NULL OR expires_at > created_at),
    CONSTRAINT check_available_from CHECK (available_from IS NULL OR available_from >= created_at),
    CONSTRAINT check_referral_relation CHECK (
        CASE 
            WHEN transaction_type = 'earned_referral' THEN related_user_id IS NOT NULL
            WHEN transaction_type = 'used_service' THEN reservation_id IS NOT NULL
            WHEN transaction_type = 'earned_service' THEN reservation_id IS NOT NULL
            ELSE TRUE
        END
    )
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
-- 소셜 피드 시스템 (SOCIAL FEED SYSTEM) - v3.2 신규
-- =============================================

-- 피드 게시물 테이블
-- v3.2 피드 기능: 샵, 인플루언서, 일반 사용자가 콘텐츠를 게시하고 소통
CREATE TABLE public.feed_posts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    author_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    content TEXT NOT NULL, -- 게시물 텍스트 내용
    category service_category, -- 관련 서비스 카테고리 (선택사항)
    location_tag TEXT, -- 위치 태그 (예: "서울시 강남구")
    tagged_shop_id UUID REFERENCES public.shops(id) ON DELETE SET NULL, -- 태그된 샵
    hashtags TEXT[], -- 해시태그 배열
    status post_status DEFAULT 'active', -- 게시물 상태
    like_count INTEGER DEFAULT 0, -- 좋아요 수 (성능용 비정규화)
    comment_count INTEGER DEFAULT 0, -- 댓글 수 (성능용 비정규화)
    view_count INTEGER DEFAULT 0, -- 조회 수 (분석용)
    report_count INTEGER DEFAULT 0, -- 신고 수
    is_featured BOOLEAN DEFAULT FALSE, -- 추천 게시물 여부
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 피드 게시물 이미지 테이블
-- 게시물당 여러 이미지 지원 (최대 10개)
CREATE TABLE public.post_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL, -- Supabase Storage URL
    alt_text VARCHAR(255), -- 접근성을 위한 대체 텍스트
    display_order INTEGER DEFAULT 0, -- 이미지 노출 순서
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 게시물 좋아요 테이블
-- 사용자별 좋아요 기록 및 중복 방지
CREATE TABLE public.post_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(post_id, user_id) -- 동일 게시물 중복 좋아요 방지
);

-- 게시물 댓글 테이블
-- 댓글 및 대댓글 지원 (parent_comment_id 활용)
CREATE TABLE public.post_comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    post_id UUID NOT NULL REFERENCES public.feed_posts(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    parent_comment_id UUID REFERENCES public.post_comments(id) ON DELETE CASCADE, -- 대댓글용
    content TEXT NOT NULL, -- 댓글 내용
    status comment_status DEFAULT 'active', -- 댓글 상태
    like_count INTEGER DEFAULT 0, -- 댓글 좋아요 수
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 댓글 좋아요 테이블
-- 댓글에 대한 좋아요 기능
CREATE TABLE public.comment_likes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    comment_id UUID NOT NULL REFERENCES public.post_comments(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(comment_id, user_id) -- 동일 댓글 중복 좋아요 방지
);

-- =============================================
-- 샵 카테고리 시스템 (SHOP CATEGORY SYSTEM) - v3.3 신규
-- =============================================

-- 샵 카테고리 테이블
-- 서비스 카테고리의 상세한 관리를 위한 확장 테이블
CREATE TABLE public.shop_categories (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    color TEXT,
    subcategories TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 서비스 타입 테이블
-- 각 카테고리별 상세 서비스 타입 정의
CREATE TABLE public.service_types (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT NOT NULL,
    price_range JSONB NOT NULL DEFAULT '{"min": 0, "max": 0}',
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    is_popular BOOLEAN DEFAULT FALSE,
    requirements TEXT[] DEFAULT '{}',
    benefits TEXT[] DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id),
    updated_by UUID REFERENCES auth.users(id)
);

-- 카테고리 메타데이터 테이블
CREATE TABLE public.category_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(category_id, metadata_key)
);

-- 서비스 타입 메타데이터 테이블
CREATE TABLE public.service_type_metadata (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_type_id TEXT NOT NULL REFERENCES public.service_types(id) ON DELETE CASCADE,
    metadata_key TEXT NOT NULL,
    metadata_value JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(service_type_id, metadata_key)
);

-- 카테고리 계층 구조 테이블
CREATE TABLE public.category_hierarchy (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parent_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    child_category_id TEXT NOT NULL REFERENCES public.shop_categories(id) ON DELETE CASCADE,
    hierarchy_level INTEGER NOT NULL DEFAULT 1,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(parent_category_id, child_category_id),
    CHECK (parent_category_id != child_category_id)
);

-- =============================================
-- 샵 연락처 관리 시스템 (SHOP CONTACT MANAGEMENT) - v3.3 신규
-- =============================================

-- 샵 연락처 방법 테이블
-- "가게 메시지 보내기" 기능을 위한 다양한 연락 수단 관리
CREATE TABLE public.shop_contact_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    contact_type contact_method_type NOT NULL,
    contact_value TEXT NOT NULL,
    display_name VARCHAR(255), -- Human-readable name for the contact method
    is_primary BOOLEAN DEFAULT FALSE, -- Primary contact method for this type
    is_public BOOLEAN DEFAULT TRUE, -- Whether this contact method is visible to customers
    verification_status contact_method_status DEFAULT 'pending_verification',
    verification_token VARCHAR(255), -- Token for verification process
    verification_expires_at TIMESTAMPTZ,
    verified_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}', -- Additional metadata (e.g., KakaoTalk channel info, social media handles)
    display_order INTEGER DEFAULT 0, -- Order for displaying multiple contact methods
    click_count INTEGER DEFAULT 0, -- Track how many times this contact method was accessed
    last_accessed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure only one primary contact method per type per shop
    UNIQUE(shop_id, contact_type, is_primary) DEFERRABLE INITIALLY DEFERRED,
    
    -- Ensure unique contact values within the same type (case-insensitive)
    UNIQUE(contact_type, LOWER(contact_value))
);

-- 연락처 방법 접근 로그 테이블
-- Track access to contact methods for analytics and security
CREATE TABLE public.contact_method_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contact_method_id UUID NOT NULL REFERENCES public.shop_contact_methods(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL, -- NULL for anonymous access
    ip_address INET,
    user_agent TEXT,
    referrer TEXT,
    access_type VARCHAR(50) DEFAULT 'view', -- 'view', 'click', 'call', 'message'
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 샵 연락처 정보 테이블 (v3.2 레거시 - 호환성 유지)
-- "가게 메시지 보내기" 기능을 위한 다양한 연락 수단 관리
-- JSONB 구조로 통합하여 중복 제거
CREATE TABLE public.shop_contacts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    contact_methods JSONB NOT NULL DEFAULT '[]', -- 연락 수단들 배열
    -- JSONB 구조 예시:
    -- [
    --   {"type": "kakao", "label": "카카오톡 채널", "value": "https://pf.kakao.com/_abc123", "is_primary": true},
    --   {"type": "instagram", "label": "인스타그램", "value": "@shop_handle", "is_primary": false},
    --   {"type": "phone", "label": "전화 문의", "value": "02-123-4567", "is_primary": false},
    --   {"type": "website", "label": "홈페이지", "value": "https://shop.com", "is_primary": false}
    -- ]
    is_active BOOLEAN DEFAULT TRUE, -- 연락처 활성화 상태
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(shop_id)
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
-- 컨텐츠 모더레이션 & 신고 (CONTENT MODERATION & REPORTING) - v3.3 확장
-- =============================================

-- 샵 신고 테이블 (확장됨)
-- 샵에 대한 신고 및 모더레이션을 위한 전용 테이블
CREATE TABLE public.shop_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reporter_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    reason report_reason NOT NULL,
    description TEXT, -- Optional detailed description from reporter
    status report_status DEFAULT 'pending',
    reviewed_by UUID REFERENCES public.users(id) ON DELETE SET NULL, -- Admin who reviewed
    reviewed_at TIMESTAMPTZ,
    resolution_notes TEXT, -- Notes from the moderator/admin
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=urgent
    is_escalated BOOLEAN DEFAULT FALSE, -- Flag for escalated reports
    escalation_reason TEXT, -- Reason for escalation
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure a user can only report the same shop once (unless previous report is resolved/dismissed)
    UNIQUE(reporter_id, shop_id) DEFERRABLE INITIALLY DEFERRED
);

-- 모더레이션 룰 테이블
-- 자동화된 컨텐츠 모더레이션 룰 관리
CREATE TABLE public.moderation_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    rule_type moderation_rule_type NOT NULL,
    rule_action moderation_rule_action NOT NULL,
    rule_config JSONB NOT NULL, -- Configuration for the rule (patterns, thresholds, etc.)
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
    status moderation_rule_status DEFAULT 'active',
    is_automated BOOLEAN DEFAULT TRUE,
    trigger_conditions JSONB, -- Conditions that must be met for the rule to trigger
    action_config JSONB, -- Configuration for the action to be taken
    created_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_triggered_at TIMESTAMPTZ,
    trigger_count INTEGER DEFAULT 0,
    false_positive_count INTEGER DEFAULT 0,
    accuracy_score DECIMAL(5,4) -- Accuracy score (0.0000 to 1.0000)
);

-- 모더레이션 액션 테이블
-- 신고에 대한 모더레이션 액션 추적
CREATE TABLE public.moderation_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.shop_reports(id) ON DELETE CASCADE,
    action_type moderation_action_type NOT NULL,
    description TEXT NOT NULL, -- Detailed description of the action taken
    moderator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE, -- Denormalized for easier querying
    action_data JSONB, -- Additional data related to the action (e.g., suspension duration, content changes)
    is_automated BOOLEAN DEFAULT FALSE, -- Whether this action was taken automatically
    automation_rule_id UUID, -- Reference to the rule that triggered automated action
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 모더레이션 감사 추적 테이블
-- 모든 모더레이션 결정과 액션의 감사 추적
CREATE TABLE public.moderation_audit_trail (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'suspend', 'activate', 'flag', 'block', 'warn', 'approve', 'reject', 
        'auto_suspend', 'auto_flag', 'auto_block', 'auto_warn'
    )),
    moderator_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
    reason TEXT NOT NULL,
    details JSONB DEFAULT '{}',
    previous_status VARCHAR(50),
    new_status VARCHAR(50),
    report_id UUID REFERENCES public.shop_reports(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 보안 이벤트 테이블
-- 종합적인 보안 이벤트 로깅 및 모니터링
CREATE TABLE public.security_events (
    id TEXT PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    ip INET NOT NULL,
    user_agent TEXT,
    endpoint TEXT NOT NULL,
    details JSONB,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    blocked BOOLEAN DEFAULT FALSE,
    reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 컨텐츠 신고 테이블 (레거시 - 호환성 유지)
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
-- 웹훅 및 결제 시스템 (WEBHOOK & PAYMENT SYSTEM) - v3.3 신규
-- =============================================

-- 웹훅 로그 테이블
-- 토스페이먼츠 웹훅 처리를 위한 멱등성 및 실패 추적
CREATE TABLE public.webhook_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payment_key TEXT NOT NULL,
    status TEXT NOT NULL,
    webhook_id TEXT NOT NULL,
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 웹훅 실패 테이블
-- 웹훅 실패 추적 및 재시도 관리
CREATE TABLE public.webhook_failures (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    webhook_id TEXT NOT NULL,
    payment_key TEXT NOT NULL,
    order_id TEXT NOT NULL,
    status TEXT NOT NULL,
    payload JSONB NOT NULL,
    error_message TEXT,
    error_stack TEXT,
    failed_at TIMESTAMPTZ DEFAULT NOW(),
    retry_count INTEGER DEFAULT 0,
    retried_at TIMESTAMPTZ,
    resolved BOOLEAN DEFAULT false,
    resolved_at TIMESTAMPTZ,
    resolution_notes TEXT
);

-- 충돌 추적 테이블
-- 예약 시스템의 모든 충돌 감지 및 해결 작업 추적
CREATE TABLE public.conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'time_overlap', 'resource_shortage', 'staff_unavailable', 
        'capacity_exceeded', 'double_booking', 'service_conflict', 'payment_conflict'
    )),
    severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    description TEXT NOT NULL,
    affected_reservations UUID[] NOT NULL, -- Array of reservation IDs
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.users(id),
    resolution_method TEXT CHECK (resolution_method IN (
        'automatic_reschedule', 'manual_reschedule', 'cancellation', 
        'compensation', 'priority_override', 'resource_reallocation'
    )),
    compensation JSONB, -- Compensation details
    metadata JSONB -- Additional conflict data
);

-- 예약 상태 로그 테이블
-- 예약 상태 변경의 감사 추적
CREATE TABLE public.reservation_status_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE,
    from_status reservation_status NOT NULL,
    to_status reservation_status NOT NULL,
    changed_by TEXT NOT NULL CHECK (changed_by IN ('user', 'shop', 'system', 'admin')),
    changed_by_id UUID NOT NULL,
    reason TEXT,
    metadata JSONB DEFAULT '{}',
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- 사용자 역할 변경 기록 테이블
-- 사용자 역할 변경의 상세 추적
CREATE TABLE public.user_role_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    previous_role user_role NOT NULL,
    new_role user_role NOT NULL,
    changed_by UUID NOT NULL REFERENCES public.users(id) ON DELETE RESTRICT,
    reason TEXT,
    admin_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- CDN 설정 테이블
-- CDN 통합을 위한 변환 프리셋 관리
CREATE TABLE public.cdn_configurations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bucket_id TEXT NOT NULL REFERENCES storage.buckets(id),
    transformation_preset TEXT NOT NULL,
    config JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
-- STORAGE BUCKETS 설정 (v3.3 CDN 통합)
-- =============================================

-- Supabase Storage 버킷 설정
-- 이미지 업로드 및 관리를 위한 버킷들

-- 프로필 이미지 버킷 (공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profile-images', 'profile-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 샵 이미지 버킷 (공개) - v3.3 업데이트 (CDN 최적화)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('shop-images', 'shop-images', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/heic'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 서비스 이미지 버킷 (공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('service-images', 'service-images', true, 16777216, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 피드 이미지 버킷 (공개) - v3.2 피드 기능용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('feed-images', 'feed-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- 사업자등록증 등 문서 버킷 (비공개) - v3.3 업데이트
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('business-documents', 'business-documents', false, 52428800, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- =============================================
-- CDN 최적화 버킷들 (v3.3 신규)
-- =============================================

-- CDN 샵 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('shop-images-cdn', 'shop-images-cdn', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CDN 프로필 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profile-images-cdn', 'profile-images-cdn', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- CDN 서비스 이미지 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('service-images-cdn', 'service-images-cdn', true, 16777216, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 이미지 캐시 버킷
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('image-cache', 'image-cache', true, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Storage RLS 정책 설정
-- 프로필 이미지: 소유자만 업로드, 모든 사용자 조회 가능
CREATE POLICY "Users can upload own profile images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Profile images are publicly viewable" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images');

-- 샵 이미지: 샵 소유자만 업로드
CREATE POLICY "Shop owners can upload shop images" ON storage.objects
    FOR INSERT WITH CHECK (
        bucket_id = 'shop-images' AND 
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    );

-- 피드 이미지: 인증된 사용자만 업로드
CREATE POLICY "Authenticated users can upload feed images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'feed-images' AND auth.uid() IS NOT NULL);

-- 사업자 문서: 해당 샵 소유자만 업로드/조회
CREATE POLICY "Shop owners can manage business documents" ON storage.objects
    FOR ALL USING (
        bucket_id = 'business-documents' AND 
        EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    );

-- =============================================
-- CDN 버킷 RLS 정책들 (v3.3 신규)
-- =============================================

-- CDN 샵 이미지 정책
CREATE POLICY "cdn_shop_images_owner_manage" ON storage.objects
    FOR ALL USING (
        bucket_id = 'shop-images-cdn'
        AND EXISTS (
            SELECT 1 FROM public.shops 
            WHERE owner_id = auth.uid() 
            AND id::text = (storage.foldername(name))[1]
        )
    );

CREATE POLICY "cdn_shop_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'shop-images-cdn');

-- CDN 프로필 이미지 정책
CREATE POLICY "cdn_profile_images_own" ON storage.objects
    FOR ALL USING (
        bucket_id = 'profile-images-cdn' 
        AND auth.uid()::text = (storage.foldername(name))[1]
    );

CREATE POLICY "cdn_profile_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'profile-images-cdn');

-- CDN 서비스 이미지 정책
CREATE POLICY "cdn_service_images_owner_manage" ON storage.objects
    FOR ALL USING (
        bucket_id = 'service-images-cdn'
        AND EXISTS (
            SELECT 1 FROM public.shops s
            JOIN public.shop_services ss ON s.id = ss.shop_id
            WHERE s.owner_id = auth.uid() 
            AND ss.id::text = (storage.foldername(name))[1]
        )
    );

CREATE POLICY "cdn_service_images_public_read" ON storage.objects
    FOR SELECT USING (bucket_id = 'service-images-cdn');

-- 이미지 캐시 정책 (시스템 관리)
CREATE POLICY "image_cache_system_manage" ON storage.objects
    FOR ALL USING (
        bucket_id = 'image-cache'
        AND (
            -- System can manage cache
            auth.uid() IS NOT NULL
            OR
            -- Public read access for cached images
            TRUE
        )
    );

-- =============================================
-- 성능 최적화 인덱스들 (INDEXES FOR PERFORMANCE)
-- =============================================

-- 사용자 테이블 인덱스
-- 추천인 코드와 전화번호는 자주 검색되므로 인덱스 생성
CREATE INDEX idx_users_referral_code ON public.users(referral_code);
CREATE INDEX idx_users_phone_number ON public.users(phone_number);
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_status ON public.users(user_status); -- 활성 사용자 필터링

-- 샵 테이블 인덱스 (v3.3 업데이트됨)
-- location은 GIST 인덱스로 공간 검색 최적화 (내 주변 샵 찾기)
CREATE INDEX idx_shops_location ON public.shops USING GIST(location);

-- v3.3 복합 공간 인덱스들
-- 가장 일반적인 쿼리 패턴: 카테고리별 활성 샵 위치 검색
CREATE INDEX idx_shops_active_category_location ON public.shops USING GIST (
    location, main_category
) WHERE shop_status = 'active' AND location IS NOT NULL;

-- 샵 타입 + 위치 복합 인덱스 (입점샵 우선 정렬)
CREATE INDEX idx_shops_type_status_location ON public.shops USING GIST (
    location, shop_type
) WHERE shop_status = 'active' AND location IS NOT NULL;

-- 종합 복합 인덱스 (카테고리, 상태, 위치)
CREATE INDEX idx_shops_category_status_location ON public.shops USING GIST (
    location, main_category, shop_status
) WHERE location IS NOT NULL;

-- 추천 샵 공간 인덱스
CREATE INDEX idx_shops_featured_location ON public.shops USING GIST (location) 
WHERE is_featured = true AND featured_until > NOW() AND shop_status = 'active' AND location IS NOT NULL;

-- 최적화된 B-tree 인덱스들
CREATE INDEX idx_shops_category_active ON public.shops (main_category) WHERE shop_status = 'active';
CREATE INDEX idx_shops_type_active ON public.shops (shop_type) WHERE shop_status = 'active';
CREATE INDEX idx_shops_status_btree ON public.shops (shop_status);
CREATE INDEX idx_shops_featured_time ON public.shops (is_featured, featured_until) WHERE shop_status = 'active';
CREATE INDEX idx_shops_type_category_active ON public.shops (shop_type, main_category) WHERE shop_status = 'active';
CREATE INDEX idx_shops_owner_status ON public.shops (owner_id, shop_status);

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

-- 피드 시스템 인덱스 (v3.2 신규)
-- 피드 게시물 조회 최적화
CREATE INDEX idx_feed_posts_author_id ON public.feed_posts(author_id);
CREATE INDEX idx_feed_posts_status ON public.feed_posts(status);
CREATE INDEX idx_feed_posts_category ON public.feed_posts(category);
CREATE INDEX idx_feed_posts_created_at ON public.feed_posts(created_at DESC); -- 최신순 정렬
CREATE INDEX idx_feed_posts_location_tag ON public.feed_posts(location_tag); -- 위치 기반 검색
CREATE INDEX idx_feed_posts_tagged_shop ON public.feed_posts(tagged_shop_id);

-- 게시물 좋아요/댓글 인덱스
CREATE INDEX idx_post_likes_post_id ON public.post_likes(post_id);
CREATE INDEX idx_post_likes_user_id ON public.post_likes(user_id);
CREATE INDEX idx_post_comments_post_id ON public.post_comments(post_id);
CREATE INDEX idx_post_comments_user_id ON public.post_comments(user_id);
CREATE INDEX idx_post_comments_parent_id ON public.post_comments(parent_comment_id);

-- 댓글 좋아요 인덱스
CREATE INDEX idx_comment_likes_comment_id ON public.comment_likes(comment_id);
CREATE INDEX idx_comment_likes_user_id ON public.comment_likes(user_id);

-- 성능 최적화 복합 인덱스 (신규 추가)
-- 사용자별 예약 조회 최적화
CREATE INDEX idx_reservations_user_date ON public.reservations(user_id, reservation_date DESC);
CREATE INDEX idx_reservations_shop_date ON public.reservations(shop_id, reservation_date DESC);

-- 피드 위치별 카테고리 검색 최적화
CREATE INDEX idx_feed_posts_location_category ON public.feed_posts(location_tag, category) WHERE status = 'active';
CREATE INDEX idx_feed_posts_author_created ON public.feed_posts(author_id, created_at DESC) WHERE status = 'active';

-- 포인트 거래 사용자별 상태 조회 최적화
CREATE INDEX idx_point_transactions_user_status ON public.point_transactions(user_id, status, available_from);

-- 알림 읽지 않음 조회 최적화
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, status, created_at DESC) WHERE status = 'unread';

-- 샵 위치별 카테고리 검색 최적화 (기존 개별 인덱스 보완)
CREATE INDEX idx_shops_category_location ON public.shops(main_category, location) WHERE shop_status = 'active';
CREATE INDEX idx_shops_type_partnership ON public.shops(shop_type, partnership_started_at DESC) WHERE shop_status = 'active';

-- 결제 내역 조회 최적화
CREATE INDEX idx_payments_user_status ON public.payments(user_id, payment_status, paid_at DESC);
CREATE INDEX idx_payments_reservation_status ON public.payments(reservation_id, payment_status);

-- 추가 중요 성능 인덱스
-- 피드 타임라인 최적화
CREATE INDEX idx_feed_posts_timeline ON public.feed_posts(status, created_at DESC) WHERE status = 'active';

-- 예약 가능 시간 조회 최적화 (가장 자주 사용되는 쿼리)
CREATE INDEX idx_reservations_shop_datetime ON public.reservations(shop_id, reservation_datetime) 
    WHERE status IN ('confirmed', 'requested');

-- 포인트 사용 가능 여부 조회 최적화
CREATE INDEX idx_point_transactions_available ON public.point_transactions(user_id, status, available_from, expires_at) 
    WHERE status = 'available';

-- 추천인 성과 조회 최적화
CREATE INDEX idx_users_referrer_lookup ON public.users(referred_by_code, created_at) WHERE referred_by_code IS NOT NULL;

-- 샵 검색 및 필터링 최적화
CREATE INDEX idx_shops_search ON public.shops(name, main_category, shop_status) WHERE shop_status = 'active';

-- 알림 실시간 조회 최적화
CREATE INDEX idx_notifications_realtime ON public.notifications(user_id, created_at DESC, status) WHERE status = 'unread';

-- 관리자 대시보드 통계 최적화
CREATE INDEX idx_admin_stats_created ON public.users(user_status, created_at) WHERE user_status = 'active';
CREATE INDEX idx_admin_reservations_stats ON public.reservations(status, created_at, total_amount) WHERE status = 'completed';

-- =============================================
-- 새로운 테이블들의 인덱스 (v3.3 신규)
-- =============================================

-- 샵 카테고리 테이블 인덱스
CREATE INDEX idx_shop_categories_active ON public.shop_categories(is_active);
CREATE INDEX idx_shop_categories_sort_order ON public.shop_categories(sort_order);

-- 서비스 타입 테이블 인덱스
CREATE INDEX idx_service_types_category_id ON public.service_types(category_id);
CREATE INDEX idx_service_types_active ON public.service_types(is_active);
CREATE INDEX idx_service_types_popular ON public.service_types(is_popular);
CREATE INDEX idx_service_types_sort_order ON public.service_types(sort_order);

-- 카테고리 메타데이터 인덱스
CREATE INDEX idx_category_metadata_category_id ON public.category_metadata(category_id);

-- 서비스 타입 메타데이터 인덱스
CREATE INDEX idx_service_type_metadata_service_type_id ON public.service_type_metadata(service_type_id);

-- 카테고리 계층 구조 인덱스
CREATE INDEX idx_category_hierarchy_parent ON public.category_hierarchy(parent_category_id);
CREATE INDEX idx_category_hierarchy_child ON public.category_hierarchy(child_category_id);

-- 샵 연락처 방법 인덱스
CREATE INDEX idx_shop_contact_methods_shop_id ON public.shop_contact_methods(shop_id);
CREATE INDEX idx_shop_contact_methods_type ON public.shop_contact_methods(contact_type);
CREATE INDEX idx_shop_contact_methods_status ON public.shop_contact_methods(verification_status);
CREATE INDEX idx_shop_contact_methods_primary ON public.shop_contact_methods(shop_id, contact_type, is_primary);
CREATE INDEX idx_shop_contact_methods_public ON public.shop_contact_methods(shop_id, is_public, verification_status);
CREATE INDEX idx_shop_contact_methods_display_order ON public.shop_contact_methods(shop_id, display_order);

-- 연락처 방법 접근 로그 인덱스
CREATE INDEX idx_contact_access_logs_contact_method_id ON public.contact_method_access_logs(contact_method_id);
CREATE INDEX idx_contact_access_logs_user_id ON public.contact_method_access_logs(user_id);
CREATE INDEX idx_contact_access_logs_created_at ON public.contact_method_access_logs(created_at);
CREATE INDEX idx_contact_access_logs_ip_address ON public.contact_method_access_logs(ip_address);
CREATE INDEX idx_contact_access_logs_analytics ON public.contact_method_access_logs(contact_method_id, created_at, access_type);

-- 샵 신고 테이블 인덱스
CREATE INDEX idx_shop_reports_shop_id ON public.shop_reports(shop_id);
CREATE INDEX idx_shop_reports_reporter_id ON public.shop_reports(reporter_id);
CREATE INDEX idx_shop_reports_status ON public.shop_reports(status);
CREATE INDEX idx_shop_reports_reviewed_by ON public.shop_reports(reviewed_by);
CREATE INDEX idx_shop_reports_created_at ON public.shop_reports(created_at DESC);
CREATE INDEX idx_shop_reports_priority_status ON public.shop_reports(priority DESC, status, created_at DESC);
CREATE INDEX idx_shop_reports_escalated ON public.shop_reports(is_escalated) WHERE is_escalated = TRUE;
CREATE INDEX idx_shop_reports_moderation_queue ON public.shop_reports(status, priority DESC, created_at ASC) 
    WHERE status IN ('pending', 'under_review');

-- 모더레이션 룰 인덱스
CREATE INDEX idx_moderation_rules_type ON public.moderation_rules(rule_type);
CREATE INDEX idx_moderation_rules_status ON public.moderation_rules(status);
CREATE INDEX idx_moderation_rules_priority ON public.moderation_rules(priority DESC);
CREATE INDEX idx_moderation_rules_automated ON public.moderation_rules(is_automated);
CREATE INDEX idx_moderation_rules_created_by ON public.moderation_rules(created_by);
CREATE INDEX idx_moderation_rules_active ON public.moderation_rules(status, priority DESC) WHERE status = 'active';
CREATE INDEX idx_moderation_rules_accuracy ON public.moderation_rules(accuracy_score DESC);

-- 모더레이션 액션 인덱스
CREATE INDEX idx_moderation_actions_report_id ON public.moderation_actions(report_id);
CREATE INDEX idx_moderation_actions_shop_id ON public.moderation_actions(shop_id);
CREATE INDEX idx_moderation_actions_moderator_id ON public.moderation_actions(moderator_id);
CREATE INDEX idx_moderation_actions_action_type ON public.moderation_actions(action_type);
CREATE INDEX idx_moderation_actions_created_at ON public.moderation_actions(created_at DESC);
CREATE INDEX idx_moderation_actions_automated ON public.moderation_actions(is_automated);
CREATE INDEX idx_moderation_actions_shop_created ON public.moderation_actions(shop_id, created_at DESC);
CREATE INDEX idx_moderation_actions_shop_history ON public.moderation_actions(shop_id, action_type, created_at DESC);

-- 모더레이션 감사 추적 인덱스
CREATE INDEX idx_moderation_audit_trail_shop_id ON public.moderation_audit_trail(shop_id);
CREATE INDEX idx_moderation_audit_trail_action ON public.moderation_audit_trail(action);
CREATE INDEX idx_moderation_audit_trail_moderator_id ON public.moderation_audit_trail(moderator_id);
CREATE INDEX idx_moderation_audit_trail_created_at ON public.moderation_audit_trail(created_at);
CREATE INDEX idx_moderation_audit_trail_shop_action ON public.moderation_audit_trail(shop_id, action);
CREATE INDEX idx_moderation_audit_trail_shop_created ON public.moderation_audit_trail(shop_id, created_at DESC);

-- 보안 이벤트 인덱스
CREATE INDEX idx_security_events_type ON public.security_events(type);
CREATE INDEX idx_security_events_severity ON public.security_events(severity);
CREATE INDEX idx_security_events_user_id ON public.security_events(user_id);
CREATE INDEX idx_security_events_ip ON public.security_events(ip);
CREATE INDEX idx_security_events_timestamp ON public.security_events(timestamp);
CREATE INDEX idx_security_events_blocked ON public.security_events(blocked);
CREATE INDEX idx_security_events_endpoint ON public.security_events(endpoint);
CREATE INDEX idx_security_events_ip_timestamp ON public.security_events(ip, timestamp);
CREATE INDEX idx_security_events_user_timestamp ON public.security_events(user_id, timestamp);
CREATE INDEX idx_security_events_type_severity ON public.security_events(type, severity);
CREATE INDEX idx_security_events_ip_type ON public.security_events(ip, type);
CREATE INDEX idx_security_events_details ON public.security_events USING GIN(details);

-- 웹훅 로그 인덱스
CREATE INDEX idx_webhook_logs_payment_key_status ON public.webhook_logs(payment_key, status);
CREATE INDEX idx_webhook_logs_processed ON public.webhook_logs(processed);
CREATE UNIQUE INDEX idx_webhook_logs_unique ON public.webhook_logs(payment_key, status, webhook_id);

-- 웹훅 실패 인덱스
CREATE INDEX idx_webhook_failures_payment_key ON public.webhook_failures(payment_key);
CREATE INDEX idx_webhook_failures_resolved ON public.webhook_failures(resolved);
CREATE INDEX idx_webhook_failures_retry_count ON public.webhook_failures(retry_count);

-- 충돌 추적 인덱스
CREATE INDEX idx_conflicts_shop_id ON public.conflicts(shop_id);
CREATE INDEX idx_conflicts_type ON public.conflicts(type);
CREATE INDEX idx_conflicts_severity ON public.conflicts(severity);
CREATE INDEX idx_conflicts_detected_at ON public.conflicts(detected_at);
CREATE INDEX idx_conflicts_resolved_at ON public.conflicts(resolved_at);

-- 예약 상태 로그 인덱스
CREATE INDEX idx_reservation_status_logs_reservation_id ON public.reservation_status_logs(reservation_id);
CREATE INDEX idx_reservation_status_logs_timestamp ON public.reservation_status_logs(timestamp);
CREATE INDEX idx_reservation_status_logs_changed_by ON public.reservation_status_logs(changed_by);
CREATE INDEX idx_reservation_status_logs_from_status ON public.reservation_status_logs(from_status);
CREATE INDEX idx_reservation_status_logs_to_status ON public.reservation_status_logs(to_status);

-- 사용자 역할 변경 기록 인덱스
CREATE INDEX idx_user_role_history_user_id ON public.user_role_history(user_id);
CREATE INDEX idx_user_role_history_changed_by ON public.user_role_history(changed_by);
CREATE INDEX idx_user_role_history_created_at ON public.user_role_history(created_at);

-- CDN 설정 인덱스
CREATE INDEX idx_cdn_configurations_bucket_preset ON public.cdn_configurations(bucket_id, transformation_preset, is_active);

-- 샵 이미지 확장 인덱스 (v3.3)
CREATE INDEX idx_shop_images_category ON public.shop_images(category);
CREATE INDEX idx_shop_images_tags ON public.shop_images USING GIN(tags);
CREATE INDEX idx_shop_images_metadata ON public.shop_images USING GIN(metadata);
CREATE INDEX idx_shop_images_optimized ON public.shop_images(is_optimized);
CREATE INDEX idx_shop_images_archived ON public.shop_images(is_archived);
CREATE INDEX idx_shop_images_updated_at ON public.shop_images(updated_at);
CREATE INDEX idx_shop_images_display_order ON public.shop_images(shop_id, display_order);

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

-- =============================================
-- 새로운 테이블들의 RLS 정책 (v3.3)
-- =============================================

-- 샵 카테고리 정책
CREATE POLICY "Allow public read access to active shop categories" ON public.shop_categories
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Allow authenticated users to read all shop categories" ON public.shop_categories
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to shop categories" ON public.shop_categories
    FOR ALL USING (auth.role() = 'service_role');

-- 서비스 타입 정책
CREATE POLICY "Allow public read access to active service types" ON public.service_types
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Allow authenticated users to read all service types" ON public.service_types
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Allow admin full access to service types" ON public.service_types
    FOR ALL USING (auth.role() = 'service_role');

-- 카테고리 메타데이터 정책
CREATE POLICY "Allow public read access to category metadata" ON public.category_metadata
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to category metadata" ON public.category_metadata
    FOR ALL USING (auth.role() = 'service_role');

-- 서비스 타입 메타데이터 정책
CREATE POLICY "Allow public read access to service type metadata" ON public.service_type_metadata
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to service type metadata" ON public.service_type_metadata
    FOR ALL USING (auth.role() = 'service_role');

-- 카테고리 계층 구조 정책
CREATE POLICY "Allow public read access to category hierarchy" ON public.category_hierarchy
    FOR SELECT USING (TRUE);

CREATE POLICY "Allow admin full access to category hierarchy" ON public.category_hierarchy
    FOR ALL USING (auth.role() = 'service_role');

-- 샵 연락처 방법 정책
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

-- 연락처 방법 접근 로그 정책
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

-- 샵 신고 정책
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

-- 모더레이션 룰 정책
CREATE POLICY "Authenticated users can view active moderation rules" ON public.moderation_rules
    FOR SELECT USING (status = 'active');

CREATE POLICY "Moderators can view all moderation rules" ON public.moderation_rules
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.user_role IN ('admin', 'moderator')
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

-- 모더레이션 액션 정책
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

CREATE POLICY "Moderators can create moderation actions" ON public.moderation_actions
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.users 
            WHERE users.id = auth.uid() 
            AND users.user_role IN ('admin', 'moderator')
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

-- 모더레이션 감사 추적 정책
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

-- 보안 이벤트 정책
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

-- 웹훅 로그 정책 (관리자만 접근)
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

-- 웹훅 실패 정책 (관리자만 접근)
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

-- 충돌 추적 정책
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

-- 예약 상태 로그 정책
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

-- 사용자 역할 변경 기록 정책
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

-- CDN 설정 정책
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

-- =============================================
-- 자동 업데이트 트리거들 (TRIGGERS FOR AUTOMATIC UPDATES)
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
CREATE TRIGGER update_post_like_count_trigger 
    AFTER INSERT OR DELETE ON public.post_likes
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER update_post_comment_count_trigger 
    AFTER INSERT OR DELETE ON public.post_comments
    FOR EACH ROW EXECUTE FUNCTION update_post_counts();

CREATE TRIGGER update_comment_like_count_trigger 
    AFTER INSERT OR DELETE ON public.comment_likes
    FOR EACH ROW EXECUTE FUNCTION update_comment_like_counts();

-- 피드 게시물 updated_at 트리거
CREATE TRIGGER update_feed_posts_updated_at BEFORE UPDATE ON public.feed_posts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_post_comments_updated_at BEFORE UPDATE ON public.post_comments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_shop_contacts_updated_at BEFORE UPDATE ON public.shop_contacts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

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
CREATE TRIGGER auto_moderate_trigger 
    AFTER INSERT ON public.content_reports
    FOR EACH ROW EXECUTE FUNCTION auto_moderate_content();

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
            influencer_qualified_at = NOW()
            -- user_role은 변경하지 않음 (기존 역할 유지)
        WHERE id = user_uuid AND NOT is_influencer;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;

-- 서비스 이용 포인트 적립 함수
-- PRD 2.4 정책: 총 시술 금액의 2.5% 적립, 최대 30만원까지
-- 중요: 서비스 완료 후에만 호출되어야 함
CREATE OR REPLACE FUNCTION award_service_points(reservation_uuid UUID)
RETURNS INTEGER AS $$
DECLARE
    total_amount INTEGER;
    user_uuid UUID;
    reservation_status_check reservation_status;
    points_to_award INTEGER;
    influencer_multiplier INTEGER := 1;
    max_eligible_amount INTEGER := 300000; -- 30만원 한도
    point_rate DECIMAL := 0.025; -- 2.5% 적립률
BEGIN
    -- 예약 정보 및 상태 조회 (최종 금액 기준)
    SELECT 
        COALESCE(r.total_amount, 0) as final_amount, 
        r.user_id, 
        r.status 
    INTO total_amount, user_uuid, reservation_status_check
    FROM public.reservations r
    WHERE r.id = reservation_uuid;
    
    -- 예약이 존재하지 않으면 오류
    IF user_uuid IS NULL THEN
        RAISE EXCEPTION '존재하지 않는 예약입니다: %', reservation_uuid;
    END IF;
    
    -- 서비스 완료 상태 확인
    IF reservation_status_check != 'completed' THEN
        RAISE EXCEPTION '포인트는 서비스 완료 후에만 적립 가능합니다. 현재 상태: %', reservation_status_check;
    END IF;
    
    -- 중복 적립 방지 확인
    IF EXISTS (
        SELECT 1 FROM public.point_transactions 
        WHERE reservation_id = reservation_uuid 
        AND transaction_type = 'earned_service'
    ) THEN
        RAISE EXCEPTION '이미 포인트가 적립된 예약입니다.';
    END IF;
    
    -- 인플루언서 보너스 확인
    SELECT CASE WHEN is_influencer THEN 2 ELSE 1 END INTO influencer_multiplier
    FROM public.users WHERE id = user_uuid;
    
    -- 포인트 계산 (30만원 한도 적용 + 인플루언서 보너스)
    points_to_award := FLOOR(
        LEAST(total_amount, max_eligible_amount) * point_rate * influencer_multiplier
    );
    
    -- 포인트 거래 내역 생성 (7일 후 사용 가능)
    INSERT INTO public.point_transactions (
        user_id,
        reservation_id,
        transaction_type,
        amount,
        description,
        status,
        available_from,
        expires_at
    ) VALUES (
        user_uuid,
        reservation_uuid,
        CASE WHEN influencer_multiplier = 2 THEN 'influencer_bonus' ELSE 'earned_service' END,
        points_to_award,
        CASE WHEN influencer_multiplier = 2 
             THEN '서비스 이용 적립 (인플루언서 2배 보너스)'
             ELSE '서비스 이용 적립' END,
        'pending',
        NOW() + INTERVAL '7 days', -- PRD 2.5: 7일 후 사용 가능
        NOW() + INTERVAL '1 year' -- 1년 후 만료
    );
    
    -- 추천인에게 추천 포인트 지급
    PERFORM award_referral_points(user_uuid, points_to_award);
    
    RETURN points_to_award;
END;
$$ LANGUAGE plpgsql;

-- 포인트 만료 처리 함수 (신규 추가)
-- 매일 자정에 실행하여 만료된 포인트 처리
CREATE OR REPLACE FUNCTION process_expired_points()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER := 0;
BEGIN
    -- 만료된 포인트를 'expired' 상태로 변경
    UPDATE public.point_transactions 
    SET status = 'expired',
        updated_at = NOW()
    WHERE status = 'available'
      AND expires_at IS NOT NULL 
      AND expires_at <= NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- 사용자별 포인트 잔액 재계산 트리거
    -- (update_user_points 함수가 자동으로 호출됨)
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- 포인트 상태 변경 함수 (pending → available)
-- 매일 자정에 실행하여 7일 지난 포인트를 사용 가능하게 변경
CREATE OR REPLACE FUNCTION activate_pending_points()
RETURNS INTEGER AS $$
DECLARE
    activated_count INTEGER := 0;
BEGIN
    -- 7일 지난 pending 포인트를 available로 변경
    UPDATE public.point_transactions 
    SET status = 'available',
        updated_at = NOW()
    WHERE status = 'pending'
      AND available_from IS NOT NULL 
      AND available_from <= NOW();
    
    GET DIAGNOSTICS activated_count = ROW_COUNT;
    
    RETURN activated_count;
END;
$$ LANGUAGE plpgsql;

-- 포인트 재계산 및 정리 함수 (부분 환불 시 호출)
CREATE OR REPLACE FUNCTION recalculate_points_after_refund(reservation_uuid UUID, refund_amount INTEGER)
RETURNS VOID AS $$
DECLARE
    original_points INTEGER;
    adjusted_points INTEGER;
    user_uuid UUID;
    total_amount INTEGER;
BEGIN
    -- 기존 적립 포인트 조회
    SELECT pt.amount, pt.user_id INTO original_points, user_uuid
    FROM public.point_transactions pt
    WHERE pt.reservation_id = reservation_uuid 
      AND pt.transaction_type IN ('earned_service', 'influencer_bonus')
    LIMIT 1;
    
    -- 포인트가 적립되지 않았으면 종료
    IF original_points IS NULL THEN
        RETURN;
    END IF;
    
    -- 환불 비율에 따른 포인트 조정 계산
    -- 부분 환불 시 포인트도 비례하여 차감
    SELECT r.total_amount INTO total_amount
    FROM public.reservations r WHERE r.id = reservation_uuid;
    
    adjusted_points := FLOOR(original_points * (total_amount - refund_amount)::DECIMAL / total_amount);
    
    -- 기존 포인트 거래 취소
    UPDATE public.point_transactions 
    SET status = 'cancelled',
        description = description || ' (부분환불로 인한 조정)'
    WHERE reservation_id = reservation_uuid 
      AND transaction_type IN ('earned_service', 'influencer_bonus');
    
    -- 조정된 포인트 새로 적립 (0보다 큰 경우만)
    IF adjusted_points > 0 THEN
        INSERT INTO public.point_transactions (
            user_id, reservation_id, transaction_type, amount,
            description, status, available_from, expires_at
        ) VALUES (
            user_uuid, reservation_uuid, 'earned_service', adjusted_points,
            '서비스 이용 적립 (부분환불 조정)', 'pending',
            NOW() + INTERVAL '7 days', NOW() + INTERVAL '1 year'
        );
    END IF;
END;
$$ LANGUAGE plpgsql;

-- 추천인 포인트 지급 함수 (v3.2 신규)
CREATE OR REPLACE FUNCTION award_referral_points(referred_user_id UUID, base_points INTEGER)
RETURNS INTEGER AS $$
DECLARE
    referrer_id UUID;
    referrer_code VARCHAR(20);
    referral_points INTEGER;
    total_amount INTEGER;
    referral_rate DECIMAL := 0.1; -- 추천인은 피추천인 포인트의 10%
    referral_depth INTEGER := 0;
    max_referral_depth INTEGER := 3; -- 최대 3단계까지만 추천 체인 허용
    current_user_id UUID := referred_user_id;
    temp_referrer_code VARCHAR(20);
BEGIN
    -- 추천인 정보 조회
    SELECT referred_by_code INTO referrer_code
    FROM public.users 
    WHERE id = referred_user_id;
    
    -- 추천인 코드가 없으면 종료
    IF referrer_code IS NULL THEN
        RETURN 0;
    END IF;
    
    -- 순환 참조 및 체인 깊이 검사
    temp_referrer_code := referrer_code;
    WHILE temp_referrer_code IS NOT NULL AND referral_depth < max_referral_depth LOOP
        SELECT id, referred_by_code INTO referrer_id, temp_referrer_code
        FROM public.users 
        WHERE referral_code = temp_referrer_code;
        
        -- 순환 참조 검사 (자기 자신을 추천하는 경우)
        IF referrer_id = referred_user_id THEN
            RAISE EXCEPTION '순환 추천은 허용되지 않습니다.';
        END IF;
        
        referral_depth := referral_depth + 1;
    END LOOP;
    
    -- 추천인 ID 최종 확인
    SELECT id INTO referrer_id
    FROM public.users 
    WHERE referral_code = referrer_code;
    
    -- 추천인이 존재하지 않으면 종료
    IF referrer_id IS NULL THEN
        RETURN 0;
    END IF;
    
    -- 중복 지급 방지 (동일 사용자에 대한 추천 포인트 중복 체크)
    IF EXISTS (
        SELECT 1 FROM public.point_transactions 
        WHERE user_id = referrer_id 
          AND related_user_id = referred_user_id 
          AND transaction_type = 'earned_referral'
    ) THEN
        RETURN 0; -- 이미 지급된 추천 포인트
    END IF;
    
    -- 추천 포인트 계산 (공정성을 위해 기본 적립률 기준으로 계산)
    -- base_points는 인플루언서 보너스가 포함될 수 있으므로, 원래 금액 기준으로 재계산
    SELECT r.total_amount INTO total_amount
    FROM public.reservations r WHERE r.id = (
        SELECT reservation_id FROM public.point_transactions 
        WHERE user_id = referred_user_id 
        AND transaction_type IN ('earned_service', 'influencer_bonus')
        ORDER BY created_at DESC LIMIT 1
    );
    
    -- 추천 포인트는 항상 기본 적립률(2.5%) 기준으로 계산하여 공정성 확보
    referral_points := FLOOR(
        LEAST(total_amount, 300000) * 0.025 * referral_rate
    );
    
    -- 추천 포인트 지급
    INSERT INTO public.point_transactions (
        user_id,
        transaction_type,
        amount,
        description,
        status,
        available_from,
        expires_at,
        related_user_id
    ) VALUES (
        referrer_id,
        'earned_referral',
        referral_points,
        '친구 추천 리워드',
        'pending',
        NOW() + INTERVAL '7 days',
        NOW() + INTERVAL '1 year',
        referred_user_id
    );
    
    -- 추천인 통계 업데이트
    UPDATE public.users SET
        successful_referrals = successful_referrals + 1
    WHERE id = referrer_id;
    
    -- 인플루언서 자격 확인
    PERFORM check_influencer_status(referrer_id);
    
    RETURN referral_points;
END;
$$ LANGUAGE plpgsql;

-- 데이터 정리 및 유지보수 함수들 (신규 추가)
-- 비활성 사용자 정리 (90일 이상 미접속)
CREATE OR REPLACE FUNCTION cleanup_inactive_users()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
    inactive_threshold INTERVAL := '90 days';
BEGIN
    -- 90일 이상 미접속 사용자를 inactive 상태로 변경
    UPDATE public.users 
    SET user_status = 'inactive',
        updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
    WHERE user_status = 'active'
      AND (last_active_at IS NULL OR last_active_at < NOW() - inactive_threshold)
      AND user_role != 'admin'; -- 관리자는 제외
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    -- 비활성 사용자의 FCM 토큰 비활성화
    UPDATE public.push_tokens 
    SET is_active = FALSE
    WHERE user_id IN (
        SELECT id FROM public.users WHERE user_status = 'inactive'
    );
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- 만료된 알림 정리 (30일 이상 된 읽은 알림)
CREATE OR REPLACE FUNCTION cleanup_old_notifications()
RETURNS INTEGER AS $$
DECLARE
    cleanup_count INTEGER := 0;
BEGIN
    -- 30일 이상 된 읽은 알림 삭제
    DELETE FROM public.notifications 
    WHERE status = 'read' 
      AND read_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS cleanup_count = ROW_COUNT;
    
    RETURN cleanup_count;
END;
$$ LANGUAGE plpgsql;

-- 고아 데이터 정리 함수
CREATE OR REPLACE FUNCTION cleanup_orphaned_data()
RETURNS JSONB AS $$
DECLARE
    result JSONB := '{}';
    orphaned_images INTEGER := 0;
    orphaned_tokens INTEGER := 0;
BEGIN
    -- 참조되지 않는 이미지 정리
    DELETE FROM public.post_images 
    WHERE post_id NOT IN (SELECT id FROM public.feed_posts);
    GET DIAGNOSTICS orphaned_images = ROW_COUNT;
    
    -- 비활성 사용자의 FCM 토큰 정리
    DELETE FROM public.push_tokens 
    WHERE user_id IN (
        SELECT id FROM public.users WHERE user_status = 'deleted'
    );
    GET DIAGNOSTICS orphaned_tokens = ROW_COUNT;
    
    -- 결과 반환
    result := jsonb_build_object(
        'orphaned_images_cleaned', orphaned_images,
        'orphaned_tokens_cleaned', orphaned_tokens,
        'cleaned_at', NOW() AT TIME ZONE 'Asia/Seoul'
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 사용자 포인트 잔액 검증 함수
CREATE OR REPLACE FUNCTION validate_point_usage(user_uuid UUID, amount_to_use INTEGER)
RETURNS BOOLEAN AS $$
DECLARE
    available_balance INTEGER := 0;
BEGIN
    -- 사용 가능한 포인트 계산
    SELECT COALESCE(SUM(amount), 0) INTO available_balance
    FROM public.point_transactions
    WHERE user_id = user_uuid
      AND status = 'available'
      AND amount > 0
      AND (available_from IS NULL OR available_from <= NOW() AT TIME ZONE 'Asia/Seoul')
      AND (expires_at IS NULL OR expires_at > NOW() AT TIME ZONE 'Asia/Seoul');
    
    -- 사용하려는 금액이 잔액보다 적거나 같은지 확인
    RETURN available_balance >= amount_to_use;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 새로운 비즈니스 로직 함수들 (v3.3)
-- =============================================

-- 예약 재스케줄링 함수
CREATE OR REPLACE FUNCTION reschedule_reservation(
    p_reservation_id UUID,
    p_new_date DATE,
    p_new_time TIME,
    p_reason TEXT DEFAULT NULL,
    p_requested_by TEXT DEFAULT 'user',
    p_requested_by_id UUID DEFAULT NULL,
    p_fees INTEGER DEFAULT 0
)
RETURNS TABLE(
    id UUID,
    shop_id UUID,
    user_id UUID,
    reservation_date DATE,
    reservation_time TIME,
    status TEXT,
    total_amount INTEGER,
    points_used INTEGER,
    special_requests TEXT,
    created_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_reservation reservations%ROWTYPE;
    v_shop_id UUID;
    v_user_id UUID;
BEGIN
    -- Get current reservation details
    SELECT * INTO v_reservation
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
    -- Store shop and user IDs for history logging
    v_shop_id := v_reservation.shop_id;
    v_user_id := v_reservation.user_id;
    
    -- Update the reservation
    UPDATE reservations
    SET 
        reservation_date = p_new_date,
        reservation_time = p_new_time,
        updated_at = NOW()
    WHERE id = p_reservation_id;
    
    -- Log the reschedule history
    INSERT INTO reservation_reschedule_history (
        reservation_id,
        shop_id,
        old_date,
        old_time,
        new_date,
        new_time,
        reason,
        requested_by,
        requested_by_id,
        fees
    ) VALUES (
        p_reservation_id,
        v_shop_id,
        v_reservation.reservation_date,
        v_reservation.reservation_time,
        p_new_date,
        p_new_time,
        p_reason,
        p_requested_by,
        COALESCE(p_requested_by_id, v_user_id),
        p_fees
    );
    
    -- Return updated reservation
    RETURN QUERY
    SELECT 
        r.id,
        r.shop_id,
        r.user_id,
        r.reservation_date,
        r.reservation_time,
        r.status,
        r.total_amount,
        r.points_used,
        r.special_requests,
        r.created_at,
        r.updated_at
    FROM reservations r
    WHERE r.id = p_reservation_id;
    
EXCEPTION
    WHEN OTHERS THEN
        -- Rollback any changes
        RAISE EXCEPTION 'Failed to reschedule reservation: %', SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 모더레이션 룰 통계 업데이트 함수
CREATE OR REPLACE FUNCTION update_rule_stats_on_trigger(rule_id UUID, is_false_positive BOOLEAN DEFAULT FALSE)
RETURNS VOID AS $$
BEGIN
    UPDATE public.moderation_rules 
    SET 
        last_triggered_at = NOW(),
        trigger_count = trigger_count + 1,
        false_positive_count = CASE 
            WHEN is_false_positive THEN false_positive_count + 1 
            ELSE false_positive_count 
        END,
        accuracy_score = CASE 
            WHEN trigger_count > 0 THEN 
                GREATEST(0, (trigger_count::DECIMAL - false_positive_count::DECIMAL) / trigger_count::DECIMAL)
            ELSE accuracy_score
        END
    WHERE id = rule_id;
END;
$$ LANGUAGE plpgsql;

-- 보안 메트릭 조회 함수
CREATE OR REPLACE FUNCTION get_security_metrics(
    p_time_range INTERVAL DEFAULT INTERVAL '24 hours'
)
RETURNS TABLE(
    total_events BIGINT,
    blocked_events BIGINT,
    unique_ips BIGINT,
    high_severity_events BIGINT,
    critical_events BIGINT,
    top_threats JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*) as total_events,
        COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_events,
        COUNT(DISTINCT ip) as unique_ips,
        COUNT(*) FILTER (WHERE severity = 'high') as high_severity_events,
        COUNT(*) FILTER (WHERE severity = 'critical') as critical_events,
        jsonb_agg(
            jsonb_build_object(
                'type', threat_type,
                'count', threat_count,
                'severity', threat_severity
            ) ORDER BY threat_count DESC
        ) as top_threats
    FROM (
        SELECT 
            type as threat_type,
            severity as threat_severity,
            COUNT(*) as threat_count
        FROM public.security_events
        WHERE timestamp >= NOW() - p_time_range
        GROUP BY type, severity
        ORDER BY threat_count DESC
        LIMIT 10
    ) threat_stats;
END;
$$ LANGUAGE plpgsql;

-- 의심스러운 IP 탐지 함수
CREATE OR REPLACE FUNCTION detect_suspicious_ips(
    p_time_window INTERVAL DEFAULT INTERVAL '1 hour',
    p_threshold INTEGER DEFAULT 10
)
RETURNS TABLE(
    ip INET,
    event_count BIGINT,
    severity_distribution JSONB,
    last_activity TIMESTAMPTZ,
    suspicious_score INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        se.ip,
        COUNT(*) as event_count,
        jsonb_object_agg(se.severity, severity_count) as severity_distribution,
        MAX(se.timestamp) as last_activity,
        CASE 
            WHEN COUNT(*) > p_threshold * 2 THEN 100
            WHEN COUNT(*) > p_threshold THEN 75
            WHEN COUNT(*) > p_threshold / 2 THEN 50
            ELSE 25
        END as suspicious_score
    FROM public.security_events se
    JOIN (
        SELECT 
            ip,
            severity,
            COUNT(*) as severity_count
        FROM public.security_events
        WHERE timestamp >= NOW() - p_time_window
        GROUP BY ip, severity
    ) severity_stats ON se.ip = severity_stats.ip
    WHERE se.timestamp >= NOW() - p_time_window
    GROUP BY se.ip
    HAVING COUNT(*) > p_threshold
    ORDER BY suspicious_score DESC, event_count DESC;
END;
$$ LANGUAGE plpgsql;

-- CDN URL 생성 함수
CREATE OR REPLACE FUNCTION public.get_cdn_url(
    bucket_name TEXT,
    file_path TEXT,
    preset TEXT DEFAULT 'original'
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    base_url TEXT;
    cdn_config JSONB;
    transform_params TEXT := '';
BEGIN
    -- Get base URL from environment or use default
    base_url := current_setting('app.supabase_url', true);
    IF base_url IS NULL THEN
        base_url := 'https://your-project.supabase.co';
    END IF;
    
    -- Get transformation configuration
    SELECT config INTO cdn_config
    FROM public.cdn_configurations
    WHERE bucket_id = bucket_name || '-cdn'
        AND transformation_preset = preset
        AND is_active = TRUE;
    
    -- Build transformation parameters if config exists
    IF cdn_config IS NOT NULL THEN
        IF cdn_config->>'width' IS NOT NULL THEN
            transform_params := transform_params || '&width=' || (cdn_config->>'width');
        END IF;
        
        IF cdn_config->>'height' IS NOT NULL THEN
            transform_params := transform_params || '&height=' || (cdn_config->>'height');
        END IF;
        
        IF cdn_config->>'quality' IS NOT NULL THEN
            transform_params := transform_params || '&quality=' || (cdn_config->>'quality');
        END IF;
        
        IF cdn_config->>'format' IS NOT NULL THEN
            transform_params := transform_params || '&format=' || (cdn_config->>'format');
        END IF;
        
        IF cdn_config->>'fit' IS NOT NULL THEN
            transform_params := transform_params || '&fit=' || (cdn_config->>'fit');
        END IF;
        
        IF (cdn_config->>'progressive')::boolean = TRUE THEN
            transform_params := transform_params || '&progressive=true';
        END IF;
        
        IF (cdn_config->>'stripMetadata')::boolean = TRUE THEN
            transform_params := transform_params || '&stripMetadata=true';
        END IF;
        
        -- Remove leading & and add ?
        IF length(transform_params) > 0 THEN
            transform_params := '?' || substring(transform_params from 2);
        END IF;
    END IF;
    
    -- Return CDN URL
    RETURN base_url || '/storage/v1/object/public/' || bucket_name || '-cdn/' || file_path || transform_params;
END;
$$;

-- 만료된 CDN 캐시 정리 함수
CREATE OR REPLACE FUNCTION public.clean_expired_cdn_cache()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    deleted_count INTEGER := 0;
BEGIN
    -- Delete expired cache entries
    WITH deleted AS (
        DELETE FROM storage.objects
        WHERE bucket_id = 'image-cache'
            AND cache_expires_at IS NOT NULL
            AND cache_expires_at < NOW()
        RETURNING id
    )
    SELECT COUNT(*) INTO deleted_count FROM deleted;
    
    RETURN deleted_count;
END;
$$;

-- 카테고리 계층 구조 조회 함수
CREATE OR REPLACE FUNCTION public.get_category_hierarchy()
RETURNS TABLE (
    category_id TEXT,
    display_name TEXT,
    parent_category_id TEXT,
    hierarchy_level INTEGER,
    sort_order INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as category_id,
        c.display_name,
        h.parent_category_id,
        h.hierarchy_level,
        c.sort_order
    FROM public.shop_categories c
    LEFT JOIN public.category_hierarchy h ON c.id = h.child_category_id
    WHERE c.is_active = TRUE
    ORDER BY c.sort_order;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 카테고리 통계 조회 함수
CREATE OR REPLACE FUNCTION public.get_category_statistics()
RETURNS TABLE (
    total_categories BIGINT,
    active_categories BIGINT,
    total_services BIGINT,
    popular_services BIGINT,
    average_price_per_category JSONB
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        (SELECT COUNT(*) FROM public.shop_categories) as total_categories,
        (SELECT COUNT(*) FROM public.shop_categories WHERE is_active = TRUE) as active_categories,
        (SELECT COUNT(*) FROM public.service_types) as total_services,
        (SELECT COUNT(*) FROM public.service_types WHERE is_popular = TRUE) as popular_services,
        (
            SELECT jsonb_agg(
                jsonb_build_object(
                    'category_id', c.id,
                    'category_name', c.display_name,
                    'average_price', (
                        SELECT AVG((st.price_range->>'min')::numeric + (st.price_range->>'max')::numeric) / 2
                        FROM public.service_types st
                        WHERE st.category_id = c.id AND st.is_active = TRUE
                    )
                )
            )
            FROM public.shop_categories c
            WHERE c.is_active = TRUE
        ) as average_price_per_category;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 포인트 사용 처리 함수 (FIFO 방식)
CREATE OR REPLACE FUNCTION use_points(user_uuid UUID, amount_to_use INTEGER, reservation_uuid UUID, description_text TEXT)
RETURNS JSONB AS $$
DECLARE
    remaining_to_use INTEGER := amount_to_use;
    point_record RECORD;
    total_deducted INTEGER := 0;
    transaction_details JSONB := '[]';
BEGIN
    -- 잔액 검증
    IF NOT validate_point_usage(user_uuid, amount_to_use) THEN
        RAISE EXCEPTION '사용 가능한 포인트가 부족합니다. 요청: %, 보유: %', 
            amount_to_use, 
            (SELECT COALESCE(SUM(amount), 0) FROM public.point_transactions 
             WHERE user_id = user_uuid AND status = 'available' AND amount > 0);
    END IF;
    
    -- FIFO 방식으로 포인트 차감
    FOR point_record IN 
        SELECT id, amount, available_from, created_at
        FROM public.point_transactions
        WHERE user_id = user_uuid
          AND status = 'available'
          AND amount > 0
          AND (available_from IS NULL OR available_from <= NOW() AT TIME ZONE 'Asia/Seoul')
          AND (expires_at IS NULL OR expires_at > NOW() AT TIME ZONE 'Asia/Seoul')
        ORDER BY available_from ASC, created_at ASC
    LOOP
        IF remaining_to_use <= 0 THEN
            EXIT;
        END IF;
        
        IF point_record.amount <= remaining_to_use THEN
            -- 전체 포인트 사용
            UPDATE public.point_transactions SET
                status = 'used',
                updated_at = NOW() AT TIME ZONE 'Asia/Seoul'
            WHERE id = point_record.id;
            
            remaining_to_use := remaining_to_use - point_record.amount;
            total_deducted := total_deducted + point_record.amount;
        ELSE
            -- 부분 포인트 사용 (포인트 분할)
            UPDATE public.point_transactions SET
                amount = amount - remaining_to_use
            WHERE id = point_record.id;
            
            -- 사용된 부분을 별도 레코드로 생성
            INSERT INTO public.point_transactions (
                user_id, transaction_type, amount, description,
                status, related_user_id, metadata
            ) VALUES (
                user_uuid, 'used_service', -remaining_to_use, description_text,
                'used', NULL, jsonb_build_object('original_transaction_id', point_record.id)
            );
            
            total_deducted := total_deducted + remaining_to_use;
            remaining_to_use := 0;
        END IF;
    END LOOP;
    
    -- 사용 내역 기록
    INSERT INTO public.point_transactions (
        user_id, reservation_id, transaction_type, amount,
        description, status
    ) VALUES (
        user_uuid, reservation_uuid, 'used_service', -total_deducted,
        description_text, 'used'
    );
    
    RETURN jsonb_build_object(
        'points_used', total_deducted,
        'remaining_balance', (
            SELECT COALESCE(SUM(amount), 0) 
            FROM public.point_transactions 
            WHERE user_id = user_uuid AND status = 'available' AND amount > 0
        )
    );
END;
$$ LANGUAGE plpgsql;

-- 환불 가능 여부 확인 함수 (v3.2 신규)
-- PRD 2.6 정책: 예약 취소 및 환불 정책 적용
CREATE OR REPLACE FUNCTION should_refund(reservation_uuid UUID, cancellation_type TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    reservation_datetime TIMESTAMPTZ;
    current_time TIMESTAMPTZ;
    hours_until_reservation NUMERIC;
    shop_timezone TEXT := 'Asia/Seoul'; -- 기본 한국 시간대
BEGIN
    -- 예약 정보 조회
    SELECT r.reservation_datetime INTO reservation_datetime
    FROM public.reservations r
    WHERE r.id = reservation_uuid;
    
    -- 예약이 존재하지 않으면 환불 불가
    IF reservation_datetime IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- 현재 시간을 한국 시간대로 설정
    current_time := NOW() AT TIME ZONE shop_timezone;
    reservation_datetime := reservation_datetime AT TIME ZONE shop_timezone;
    
    -- 예약까지 남은 시간 계산 (정확한 시간 단위)
    hours_until_reservation := EXTRACT(EPOCH FROM (reservation_datetime - current_time)) / 3600.0;
    
    -- 환불 정책 적용
    CASE cancellation_type
        WHEN 'shop_request' THEN
            RETURN TRUE; -- 샵 사정으로 인한 취소는 항상 100% 환불
        WHEN 'no_show' THEN
            RETURN FALSE; -- 노쇼는 환불 불가
        WHEN 'user_request' THEN
            -- 24시간 전까지는 100% 환불, 그 이후는 환불 불가
            -- 과거 예약에 대한 취소 요청도 처리
            IF hours_until_reservation < 0 THEN
                RETURN FALSE; -- 이미 지난 예약
            END IF;
            RETURN hours_until_reservation >= 24.0;
        ELSE
            RETURN FALSE; -- 기본값: 환불 불가
    END CASE;
END;
$$ LANGUAGE plpgsql;

-- 환불 처리 함수 (v3.2 신규)
CREATE OR REPLACE FUNCTION process_refund(reservation_uuid UUID, cancellation_type TEXT, reason TEXT)
RETURNS JSONB AS $$
DECLARE
    refund_eligible BOOLEAN;
    refund_amount INTEGER := 0;
    refund_percentage INTEGER := 0;
    payment_record RECORD;
BEGIN
    -- 환불 가능 여부 확인
    refund_eligible := should_refund(reservation_uuid, cancellation_type);
    
    IF refund_eligible THEN
        refund_percentage := 100;
        
        -- 해당 예약의 결제 정보 조회
        SELECT amount INTO refund_amount
        FROM public.payments
        WHERE reservation_id = reservation_uuid
        AND is_deposit = TRUE
        AND payment_status = 'deposit_paid';
        
        -- 결제 상태를 환불로 변경
        UPDATE public.payments SET
            payment_status = 'refunded',
            refunded_at = NOW(),
            refund_amount = refund_amount,
            metadata = COALESCE(metadata, '{}') || jsonb_build_object(
                'refund_reason', reason,
                'refund_type', cancellation_type
            )
        WHERE reservation_id = reservation_uuid;
    END IF;
    
    -- 예약 상태 업데이트
    UPDATE public.reservations SET
        status = CASE 
            WHEN cancellation_type = 'user_request' THEN 'cancelled_by_user'
            WHEN cancellation_type = 'shop_request' THEN 'cancelled_by_shop'
            WHEN cancellation_type = 'no_show' THEN 'no_show'
        END,
        cancellation_reason = reason,
        cancelled_at = NOW()
    WHERE id = reservation_uuid;
    
    -- 결과 반환
    RETURN jsonb_build_object(
        'refund_eligible', refund_eligible,
        'refund_percentage', refund_percentage,
        'refund_amount', refund_amount,
        'processing_time', '3-5 영업일'
    );
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- 예약 시스템 고급 함수들 (v3.3 - Phase 4)
-- =============================================

-- 향상된 예약 생성 함수 (데이터베이스 레벨 잠금 포함)
-- Phase 4 Reservation System에서 동시 예약 충돌 방지를 위한 고급 잠금 메커니즘
CREATE OR REPLACE FUNCTION create_reservation_with_lock(
    p_shop_id UUID,
    p_user_id UUID,
    p_reservation_date DATE,
    p_reservation_time TIME,
    p_special_requests TEXT DEFAULT NULL,
    p_points_used INTEGER DEFAULT 0,
    p_services JSONB,
    p_lock_timeout INTEGER DEFAULT 10000
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_reservation_id UUID;
    v_total_amount DECIMAL(10,2) := 0;
    v_service_record RECORD;
    v_service_data JSONB;
    v_service_id UUID;
    v_quantity INTEGER;
    v_price DECIMAL(10,2);
    v_duration_minutes INTEGER;
    v_conflicting_reservations INTEGER;
    v_lock_acquired BOOLEAN := FALSE;
    v_advisory_lock_acquired BOOLEAN := FALSE;
    v_start_time TIMESTAMP;
    v_end_time TIMESTAMP;
    v_result JSONB;
    v_advisory_lock_key BIGINT;
    v_deadlock_retry_count INTEGER := 0;
    v_max_deadlock_retries INTEGER := 3;
BEGIN
    -- Set lock timeout
    SET lock_timeout = p_lock_timeout;
    
    -- Generate advisory lock key based on shop_id, date, and time
    -- This ensures only one reservation can be created for the same slot at a time
    v_advisory_lock_key := ('x' || substr(md5(p_shop_id::text || p_reservation_date::text || p_reservation_time::text), 1, 8))::bit(32)::bigint;
    
    -- Start transaction with retry logic for deadlocks
    LOOP
        BEGIN
            -- Acquire advisory lock for this specific time slot
            IF NOT pg_try_advisory_xact_lock(v_advisory_lock_key) THEN
                RAISE EXCEPTION 'ADVISORY_LOCK_TIMEOUT: Unable to acquire advisory lock for time slot % at %', p_reservation_time, p_reservation_date;
            END IF;
            v_advisory_lock_acquired := TRUE;
            
            -- Check for conflicting reservations with FOR UPDATE lock
            -- Now includes both 'requested' and 'confirmed' status as per v3.1 flow
            SELECT COUNT(*) INTO v_conflicting_reservations
            FROM reservations r
            JOIN reservation_services rs ON r.id = rs.reservation_id
            JOIN shop_services s ON rs.service_id = s.id
            WHERE r.shop_id = p_shop_id
                AND r.reservation_date = p_reservation_date
                AND r.status IN ('requested', 'confirmed', 'in_progress')
                AND (
                    -- Check for time overlap with 15-minute buffer
                    (r.reservation_time <= p_reservation_time AND 
                     r.reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > p_reservation_time)
                    OR
                    (p_reservation_time <= r.reservation_time AND 
                     p_reservation_time + INTERVAL '1 minute' * (s.duration_minutes + 15) > r.reservation_time)
                )
            FOR UPDATE;
            
            -- If conflicts found, raise error
            IF v_conflicting_reservations > 0 THEN
                RAISE EXCEPTION 'SLOT_CONFLICT: Time slot is not available due to existing reservations';
            END IF;
            
            -- Calculate total amount and validate services
            FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
            LOOP
                v_service_id := (v_service_data->>'serviceId')::UUID;
                v_quantity := (v_service_data->>'quantity')::INTEGER;
                
                -- Get service details with FOR UPDATE to prevent concurrent modifications
                SELECT price_min, duration_minutes INTO v_price, v_duration_minutes
                FROM shop_services
                WHERE id = v_service_id
                FOR UPDATE;
                
                IF NOT FOUND THEN
                    RAISE EXCEPTION 'SERVICE_NOT_FOUND: Service with ID % does not exist', v_service_id;
                END IF;
                
                -- Validate quantity
                IF v_quantity <= 0 THEN
                    RAISE EXCEPTION 'INVALID_QUANTITY: Quantity must be greater than 0';
                END IF;
                
                -- Add to total amount
                v_total_amount := v_total_amount + (v_price * v_quantity);
            END LOOP;
            
            -- Validate points usage
            IF p_points_used < 0 THEN
                RAISE EXCEPTION 'INVALID_POINTS: Points used cannot be negative';
            END IF;
            
            IF p_points_used > v_total_amount THEN
                RAISE EXCEPTION 'INSUFFICIENT_AMOUNT: Points used cannot exceed total amount';
            END IF;
            
            -- Create reservation
            INSERT INTO reservations (
                shop_id,
                user_id,
                reservation_date,
                reservation_time,
                status,
                total_amount,
                points_used,
                special_requests,
                created_at,
                updated_at
            ) VALUES (
                p_shop_id,
                p_user_id,
                p_reservation_date,
                p_reservation_time,
                'requested',
                v_total_amount,
                p_points_used,
                p_special_requests,
                NOW(),
                NOW()
            ) RETURNING id INTO v_reservation_id;
            
            -- Create reservation services
            FOR v_service_data IN SELECT * FROM jsonb_array_elements(p_services)
            LOOP
                v_service_id := (v_service_data->>'serviceId')::UUID;
                v_quantity := (v_service_data->>'quantity')::INTEGER;
                
                -- Get service price
                SELECT price_min INTO v_price
                FROM shop_services
                WHERE id = v_service_id;
                
                -- Insert reservation service
                INSERT INTO reservation_services (
                    reservation_id,
                    service_id,
                    quantity,
                    unit_price,
                    total_price
                ) VALUES (
                    v_reservation_id,
                    v_service_id,
                    v_quantity,
                    v_price,
                    v_price * v_quantity
                );
            END LOOP;
            
            -- Mark lock as acquired
            v_lock_acquired := TRUE;
            
            -- Return reservation data
            SELECT jsonb_build_object(
                'id', r.id,
                'shopId', r.shop_id,
                'userId', r.user_id,
                'reservationDate', r.reservation_date,
                'reservationTime', r.reservation_time,
                'status', r.status,
                'totalAmount', r.total_amount,
                'pointsUsed', r.points_used,
                'specialRequests', r.special_requests,
                'createdAt', r.created_at,
                'updatedAt', r.updated_at
            ) INTO v_result
            FROM reservations r
            WHERE r.id = v_reservation_id;
            
            -- Exit the retry loop on success
            EXIT;
            
        EXCEPTION
            WHEN deadlock_detected THEN
                -- Handle deadlock with exponential backoff retry
                v_deadlock_retry_count := v_deadlock_retry_count + 1;
                
                IF v_deadlock_retry_count > v_max_deadlock_retries THEN
                    RAISE EXCEPTION 'DEADLOCK_RETRY_EXCEEDED: Maximum deadlock retry attempts exceeded';
                END IF;
                
                -- Rollback current transaction and wait before retry
                ROLLBACK;
                v_advisory_lock_acquired := FALSE;
                v_lock_acquired := FALSE;
                
                -- Exponential backoff: wait 100ms * 2^retry_count
                PERFORM pg_sleep(0.1 * power(2, v_deadlock_retry_count - 1));
                
                -- Continue to retry
                CONTINUE;
                
            WHEN lock_timeout THEN
                -- Handle lock timeout
                RAISE EXCEPTION 'LOCK_TIMEOUT: Unable to acquire required locks within timeout period';
                
            WHEN OTHERS THEN
                -- If lock was acquired but error occurred, we need to clean up
                IF v_lock_acquired AND v_reservation_id IS NOT NULL THEN
                    -- Delete any created reservation services
                    DELETE FROM reservation_services WHERE reservation_id = v_reservation_id;
                    -- Delete the reservation
                    DELETE FROM reservations WHERE id = v_reservation_id;
                END IF;
                
                -- Re-raise the exception
                RAISE;
        END;
    END LOOP;
    
    RETURN v_result;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_reservation_with_lock TO authenticated;

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
-- 새로운 초기 데이터 (v3.3)
-- =============================================

-- 기본 샵 카테고리 데이터
INSERT INTO public.shop_categories (id, display_name, description, icon, color, subcategories, is_active, sort_order) VALUES
('nail', '네일아트', '매니큐어, 페디큐어, 네일아트 등 네일 관련 서비스', '💅', '#FF6B9D', ARRAY['manicure', 'pedicure', 'nail_art', 'gel_nails'], TRUE, 1),
('eyelash', '속눈썹', '속눈썹 연장, 리프팅, 펌 등 속눈썹 관련 서비스', '👁️', '#8B5CF6', ARRAY['lash_extension', 'lash_lifting', 'lash_perm'], TRUE, 2),
('waxing', '왁싱', '털 제거를 위한 왁싱 서비스', '🪶', '#F59E0B', ARRAY['face_waxing', 'body_waxing', 'bikini_waxing'], TRUE, 3),
('eyebrow_tattoo', '눈썹 문신', '반영구 눈썹 문신 및 보정 서비스', '✏️', '#10B981', ARRAY['eyebrow_tattoo', 'eyebrow_correction', 'eyebrow_design'], TRUE, 4),
('hair', '헤어', '헤어컷, 펌, 염색 등 헤어 관련 서비스', '💇‍♀️', '#3B82F6', ARRAY['haircut', 'perm', 'dye', 'styling'], TRUE, 5)
ON CONFLICT (id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    description = EXCLUDED.description,
    icon = EXCLUDED.icon,
    color = EXCLUDED.color,
    subcategories = EXCLUDED.subcategories,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 기본 서비스 타입 데이터
INSERT INTO public.service_types (id, category_id, name, description, price_range, duration_minutes, is_popular, requirements, benefits, is_active, sort_order) VALUES
-- Nail services
('basic_manicure', 'nail', '베이직 매니큐어', '기본적인 손톱 관리 및 매니큐어', '{"min": 15000, "max": 25000}', 60, TRUE, ARRAY['깨끗한 손'], ARRAY['손톱 건강', '깔끔한 외관'], TRUE, 1),
('gel_manicure', 'nail', '젤 매니큐어', '오래 지속되는 젤 매니큐어', '{"min": 25000, "max": 40000}', 90, TRUE, ARRAY['기존 젤 제거', '깨끗한 손'], ARRAY['2-3주 지속', '반짝이는 외관'], TRUE, 2),
('nail_art', 'nail', '네일아트', '다양한 디자인의 네일아트', '{"min": 30000, "max": 60000}', 120, FALSE, ARRAY['젤 매니큐어', '디자인 선택'], ARRAY['개성 표현', '특별한 외관'], TRUE, 3),
('pedicure', 'nail', '페디큐어', '발톱 관리 및 발 케어 서비스', '{"min": 25000, "max": 60000}', 90, FALSE, ARRAY['발 상태 확인'], ARRAY['발 건강 관리', '깔끔한 발톱'], TRUE, 4),

-- Eyelash services
('classic_extension', 'eyelash', '클래식 속눈썹 연장', '자연스러운 속눈썹 연장', '{"min": 40000, "max": 60000}', 120, TRUE, ARRAY['속눈썹 정리', '알레르기 테스트'], ARRAY['자연스러운 연장', '2-3주 지속'], TRUE, 1),
('volume_extension', 'eyelash', '볼륨 속눈썹 연장', '풍성한 볼륨의 속눈썹 연장', '{"min": 50000, "max": 80000}', 150, TRUE, ARRAY['속눈썹 정리', '알레르기 테스트'], ARRAY['풍성한 볼륨', '드라마틱한 효과'], TRUE, 2),
('lash_lifting', 'eyelash', '속눈썹 리프팅', '자연 속눈썹을 위로 올리는 리프팅', '{"min": 30000, "max": 50000}', 90, FALSE, ARRAY['깨끗한 속눈썹'], ARRAY['자연스러운 곡선', '6-8주 지속'], TRUE, 3),

-- Waxing services
('face_waxing', 'waxing', '페이스 왁싱', '얼굴 털 제거 왁싱', '{"min": 10000, "max": 20000}', 30, TRUE, ARRAY['깨끗한 피부', '자극 없는 상태'], ARRAY['부드러운 피부', '2-3주 지속'], TRUE, 1),
('body_waxing', 'waxing', '바디 왁싱', '몸 전체 털 제거 왁싱', '{"min": 30000, "max": 80000}', 120, FALSE, ARRAY['깨끗한 피부', '충분한 털 길이'], ARRAY['부드러운 피부', '3-4주 지속'], TRUE, 2),
('bikini_waxing', 'waxing', '비키니 왁싱', '비키니 라인 털 제거 왁싱', '{"min": 25000, "max": 50000}', 45, TRUE, ARRAY['털 길이 확인', '피부 상태 체크'], ARRAY['깔끔한 라인', '자신감 향상'], TRUE, 3),

-- Eyebrow tattoo services
('eyebrow_tattoo', 'eyebrow_tattoo', '눈썹 문신', '반영구 눈썹 문신', '{"min": 100000, "max": 200000}', 180, TRUE, ARRAY['피부 상태 확인', '알레르기 테스트'], ARRAY['자연스러운 눈썹', '1-2년 지속'], TRUE, 1),
('eyebrow_correction', 'eyebrow_tattoo', '눈썹 보정', '기존 눈썹 문신 보정', '{"min": 150000, "max": 300000}', 240, FALSE, ARRAY['기존 문신 확인', '보정 가능성 검토'], ARRAY['개선된 모양', '자연스러운 결과'], TRUE, 2),
('eyebrow_design', 'eyebrow_tattoo', '눈썹 디자인', '맞춤형 눈썹 디자인 문신', '{"min": 120000, "max": 250000}', 200, FALSE, ARRAY['상담', '디자인 선택'], ARRAY['개성 있는 눈썹', '자연스러운 모양'], TRUE, 3),

-- Hair services
('haircut', 'hair', '헤어컷', '기본 헤어컷 서비스', '{"min": 20000, "max": 50000}', 60, TRUE, ARRAY['깨끗한 머리'], ARRAY['깔끔한 스타일', '상담 포함'], TRUE, 1),
('perm', 'hair', '펌', '머리카락 곱슬펌', '{"min": 50000, "max": 120000}', 180, FALSE, ARRAY['머리카락 상태 확인', '상담'], ARRAY['곱슬 스타일', '3-6개월 지속'], TRUE, 2),
('hair_dye', 'hair', '헤어 염색', '머리카락 염색 서비스', '{"min": 40000, "max": 150000}', 120, TRUE, ARRAY['알레르기 테스트', '상담'], ARRAY['새로운 색상', '개성 표현'], TRUE, 3),
('hair_treatment', 'hair', '헤어 트리트먼트', '헤어 케어 및 치료 서비스', '{"min": 30000, "max": 120000}', 90, FALSE, ARRAY['헤어 상태 진단'], ARRAY['건강한 헤어', '손상 복구'], TRUE, 4)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    price_range = EXCLUDED.price_range,
    duration_minutes = EXCLUDED.duration_minutes,
    is_popular = EXCLUDED.is_popular,
    requirements = EXCLUDED.requirements,
    benefits = EXCLUDED.benefits,
    is_active = EXCLUDED.is_active,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- 카테고리 메타데이터 초기 데이터
INSERT INTO public.category_metadata (category_id, metadata_key, metadata_value) VALUES
('nail', 'popularity_score', '{"score": 85, "trend": "increasing"}'),
('eyelash', 'popularity_score', '{"score": 92, "trend": "stable"}'),
('waxing', 'popularity_score', '{"score": 78, "trend": "increasing"}'),
('eyebrow_tattoo', 'popularity_score', '{"score": 88, "trend": "stable"}'),
('hair', 'popularity_score', '{"score": 95, "trend": "increasing"}'),
('nail', 'seasonal_trends', '{"spring": 90, "summer": 95, "autumn": 85, "winter": 80}'),
('eyelash', 'seasonal_trends', '{"spring": 85, "summer": 90, "autumn": 88, "winter": 92}'),
('waxing', 'seasonal_trends', '{"spring": 95, "summer": 98, "autumn": 85, "winter": 70}'),
('eyebrow_tattoo', 'seasonal_trends', '{"spring": 88, "summer": 85, "autumn": 90, "winter": 92}'),
('hair', 'seasonal_trends', '{"spring": 90, "summer": 85, "autumn": 95, "winter": 88}')
ON CONFLICT (category_id, metadata_key) DO UPDATE SET
    metadata_value = EXCLUDED.metadata_value,
    updated_at = NOW();

-- 기본 모더레이션 룰 데이터
INSERT INTO public.moderation_rules (name, description, rule_type, rule_action, rule_config, priority, created_by) VALUES
(
    'Spam Keyword Detection',
    'Detects common spam keywords in shop descriptions and names',
    'keyword_filter',
    'flag_for_review',
    '{"keywords": ["spam", "scam", "fake", "click here", "free money", "get rich quick"], "case_sensitive": false, "match_type": "contains"}',
    2,
    (SELECT id FROM public.users WHERE user_role = 'admin' LIMIT 1)
),
(
    'Inappropriate Language Filter',
    'Detects inappropriate language in shop content',
    'inappropriate_language',
    'flag_for_review',
    '{"severity_threshold": 0.7, "categories": ["profanity", "hate_speech", "harassment"]}',
    3,
    (SELECT id FROM public.users WHERE user_role = 'admin' LIMIT 1)
),
(
    'Duplicate Content Detection',
    'Detects duplicate shop descriptions or suspiciously similar content',
    'duplicate_content',
    'flag_for_review',
    '{"similarity_threshold": 0.85, "check_fields": ["description", "name"]}',
    2,
    (SELECT id FROM public.users WHERE user_role = 'admin' LIMIT 1)
),
(
    'Suspicious Contact Information',
    'Detects suspicious or fake contact information patterns',
    'custom_regex',
    'flag_for_review',
    '{"patterns": ["^(\\+?1?[-.\\(\\)\\s]?)?(\\d{3}[-.\\(\\)\\s]?)?\\d{3}[-.\\(\\)\\s]?\\d{4}$", "test@.*\\.com", "fake@.*\\.com"], "description": "Phone numbers and suspicious email patterns"}',
    2,
    (SELECT id FROM public.users WHERE user_role = 'admin' LIMIT 1)
);

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
-- 새로운 뷰들 (v3.3) - 카테고리 및 연락처 관리
-- =============================================

-- 활성 카테고리와 서비스 뷰
CREATE VIEW public.active_categories_with_services AS
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
ORDER BY c.sort_order;

-- 인기 서비스 카테고리별 뷰
CREATE VIEW public.popular_services_by_category AS
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
ORDER BY c.sort_order, st.sort_order;

-- 활성 공개 연락처 방법 뷰
CREATE VIEW public.shop_public_contact_methods AS
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
    AND scm.verification_status = 'verified'
    AND s.shop_status = 'active'
ORDER BY scm.shop_id, scm.display_order;

-- 연락처 방법 분석 뷰
CREATE VIEW public.contact_method_analytics AS
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
GROUP BY scm.id, scm.shop_id, s.name, scm.contact_type, scm.contact_value, scm.click_count;

-- CDN 캐시 통계 뷰
CREATE VIEW public.cdn_cache_stats AS
SELECT 
    bucket_id,
    COUNT(*) as total_files,
    COUNT(*) FILTER (WHERE cdn_processed = TRUE) as processed_files,
    COUNT(*) FILTER (WHERE cache_expires_at < NOW()) as expired_files,
    SUM(metadata->>'size')::BIGINT as total_size_bytes,
    AVG(EXTRACT(EPOCH FROM (NOW() - created_at))/3600) as avg_age_hours
FROM storage.objects
WHERE bucket_id LIKE '%-cdn' OR bucket_id = 'image-cache'
GROUP BY bucket_id;

-- 보안 대시보드 뷰
CREATE VIEW public.security_dashboard AS
SELECT 
    DATE_TRUNC('hour', timestamp) as hour,
    type,
    severity,
    COUNT(*) as event_count,
    COUNT(DISTINCT ip) as unique_ips,
    COUNT(*) FILTER (WHERE blocked = TRUE) as blocked_count
FROM public.security_events
WHERE timestamp >= NOW() - INTERVAL '24 hours'
GROUP BY DATE_TRUNC('hour', timestamp), type, severity
ORDER BY hour DESC, event_count DESC;

-- =============================================
-- 간소화된 데이터베이스 구조 완료
-- END OF SIMPLIFIED DATABASE STRUCTURE
-- ============================================= 

-- =============================================
-- REFRESH TOKENS TABLE
-- =============================================

-- Create refresh_tokens table for secure token storage and management
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    device_id VARCHAR(255),
    device_name VARCHAR(255),
    user_agent TEXT,
    ip_address INET,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoked_reason VARCHAR(100)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_device_id ON refresh_tokens(device_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_is_active ON refresh_tokens(is_active);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_device ON refresh_tokens(user_id, device_id);

-- Add RLS policies
ALTER TABLE refresh_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only access their own refresh tokens
CREATE POLICY "Users can view own refresh tokens" ON refresh_tokens
    FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own refresh tokens
CREATE POLICY "Users can create own refresh tokens" ON refresh_tokens
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own refresh tokens
CREATE POLICY "Users can update own refresh tokens" ON refresh_tokens
    FOR UPDATE USING (auth.uid() = user_id);

-- Policy: Users can delete their own refresh tokens
CREATE POLICY "Users can delete own refresh tokens" ON refresh_tokens
    FOR DELETE USING (auth.uid() = user_id);

-- Policy: Service role can manage all refresh tokens (for cleanup jobs)
CREATE POLICY "Service role can manage all refresh tokens" ON refresh_tokens
    FOR ALL USING (auth.role() = 'service_role');
