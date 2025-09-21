-- =============================================
-- SCHEMA CHUNK 44
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 12.5KB
-- =============================================

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