-- =============================================
-- SCHEMA CHUNK 50
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 1.1KB
-- =============================================

-- =============================================

-- 기본 관리자 계정 생성 (실제 운영시 업데이트 필요)
-- 주의: 이 사용자는 auth.users에 먼저 생성되어야 합니다
DO $$
BEGIN
    -- auth.users에 해당 ID가 존재하는지 확인
    IF EXISTS (SELECT 1 FROM auth.users WHERE id = '00000000-0000-0000-0000-000000000001'::UUID) THEN
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
    ELSE
        RAISE NOTICE 'Admin user not created: User ID 00000000-0000-0000-0000-000000000001 does not exist in auth.users';
    END IF;
END $$;

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