-- =============================================
-- SCHEMA CHUNK 8
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 4.0KB
-- =============================================

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