-- =============================================
-- SCHEMA CHUNK 10
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 2.3KB
-- =============================================

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