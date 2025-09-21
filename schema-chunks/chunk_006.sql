-- =============================================
-- SCHEMA CHUNK 6
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 8.0KB
-- =============================================

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