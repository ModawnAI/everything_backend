-- =============================================
-- SCHEMA CHUNK 22
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 4.9KB
-- =============================================

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