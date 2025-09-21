-- =============================================
-- 에뷰리띵 앱 - SUPABASE 데이터베이스 구조
-- EBEAUTYTHING APP - SUPABASE DATABASE STRUCTURE
-- Version: 3.2 - Updated for React/Next.js Hybrid App with Social Feed
-- Based on PRD v3.2, React/Next.js Development Guide, and Web Admin Guide
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

-- 신고 관련 ENUM
-- 신고 사유: 컨텐츠 모더레이션을 위한 신고 카테고리
CREATE TYPE report_reason AS ENUM ('spam', 'inappropriate_content', 'harassment', 'other');

-- 관리자 액션 ENUM
-- 관리자 작업 로그: 웹 관리자 대시보드에서 수행된 작업 추적
CREATE TYPE admin_action_type AS ENUM (
    'user_suspended', 'user_activated', 'shop_approved', 'shop_rejected', 'shop_suspended',
    'refund_processed', 'points_adjusted', 'content_moderated', 'post_hidden', 
    'post_restored', 'user_promoted_influencer', 'reservation_force_completed'
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
    reservation_datetime TIMESTAMPTZ GENERATED ALWAYS AS (
        (reservation_date || ' ' || reservation_time)::TIMESTAMPTZ AT TIME ZONE 'Asia/Seoul'
    ) STORED, -- 날짜+시간 결합 (인덱스 및 정렬용, 한국 시간대 기준)
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

-- 샵 연락처 정보 테이블 (v3.2 신규)
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

-- 프로필 이미지 버킷 (공개)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('profile-images', 'profile-images', true, 5242880, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 샵 이미지 버킷 (공개) - 샵 상세 화면 이미지 슬라이더용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('shop-images', 'shop-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 서비스 이미지 버킷 (공개) - 서비스별 이미지들
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('service-images', 'service-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp']);

-- 피드 이미지 버킷 (공개) - v3.2 피드 기능용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('feed-images', 'feed-images', true, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

-- 사업자등록증 등 문서 버킷 (비공개) - 입점 심사용
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) 
VALUES ('business-documents', 'business-documents', false, 20971520, ARRAY['image/jpeg', 'image/png', 'application/pdf']);

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
