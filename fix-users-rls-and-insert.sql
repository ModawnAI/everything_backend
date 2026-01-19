-- =============================================
-- 1. RLS 정책 추가: service_role이 users 테이블에 INSERT 가능하도록 설정
-- =============================================
-- 이 정책은 백엔드 API(service_role 권한)가 JWT 토큰의 userId로 자동으로 사용자 레코드를 생성할 수 있도록 허용합니다.

CREATE POLICY "Service role can insert users" ON public.users
    FOR INSERT
    WITH CHECK (auth.role() = 'service_role');

-- =============================================
-- 2. 카카오 로그인 사용자 레코드 생성
-- =============================================
-- 사용자 ID: 3fc00cc7-e748-45c1-9e30-07a779678a76 (JWT에서 확인됨)
-- 문제: JWT에는 userId가 있지만 users 테이블에 레코드가 없어서 추천인 설정 실패

INSERT INTO public.users (
    id,
    email,
    name,
    social_provider,
    social_provider_id,
    phone_verified,
    user_role,
    user_status,
    is_influencer,
    total_points,
    available_points,
    total_referrals,
    successful_referrals,
    marketing_consent,
    created_at,
    updated_at
) VALUES (
    '3fc00cc7-e748-45c1-9e30-07a779678a76',
    NULL,  -- 카카오 로그인은 이메일 선택 제공 (없을 수 있음)
    '사용자',  -- 기본 이름, 본인인증 후 실명으로 업데이트
    'kakao',  -- 소셜 로그인 제공자
    NULL,  -- 카카오 고유 ID (알 수 없음, 추후 로그인 시 업데이트)
    FALSE,  -- 전화번호 미인증
    'user',  -- 기본 권한
    'active',  -- 활성 상태
    FALSE,  -- 인플루언서 아님
    0,  -- 포인트 0
    0,  -- 사용 가능 포인트 0
    0,  -- 추천 수 0
    0,  -- 성공 추천 수 0
    FALSE,  -- 마케팅 동의 안함
    NOW(),
    NOW()
)
ON CONFLICT (id) DO NOTHING;  -- 이미 존재하면 무시

-- =============================================
-- 3. 검증 쿼리
-- =============================================
-- 사용자 레코드가 생성되었는지 확인
SELECT
    id,
    email,
    name,
    social_provider,
    user_status,
    created_at
FROM public.users
WHERE id = '3fc00cc7-e748-45c1-9e30-07a779678a76';

-- RLS 정책이 추가되었는지 확인
SELECT
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE tablename = 'users' AND policyname = 'Service role can insert users';
