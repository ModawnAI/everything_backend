-- =============================================
-- SCHEMA CHUNK 24
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 3.2KB
-- =============================================

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