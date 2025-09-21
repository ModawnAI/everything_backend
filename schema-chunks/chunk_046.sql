-- =============================================
-- SCHEMA CHUNK 46 - FUNCTIONS
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 16.1KB
-- IMPORTANT: This chunk creates functions and should be run AFTER all tables are created
-- =============================================

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
    v_shop_id UUID;
    v_user_id UUID;
    v_reservation_date DATE;
    v_reservation_time TIME;
BEGIN
    -- Get current reservation details
    SELECT shop_id, user_id, reservation_date, reservation_time 
    INTO v_shop_id, v_user_id, v_reservation_date, v_reservation_time
    FROM reservations
    WHERE id = p_reservation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Reservation not found';
    END IF;
    
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
        v_reservation_date,
        v_reservation_time,
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
    current_datetime TIMESTAMPTZ;
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
    current_datetime := NOW() AT TIME ZONE shop_timezone;
    reservation_datetime := reservation_datetime AT TIME ZONE shop_timezone;
    
    -- 예약까지 남은 시간 계산 (정확한 시간 단위)
    hours_until_reservation := EXTRACT(EPOCH FROM (reservation_datetime - current_datetime)) / 3600.0;
    
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