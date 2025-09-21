-- =============================================
-- SCHEMA CHUNK 4
-- =============================================
-- Upload this file to Supabase SQL Editor
-- Size: 4.9KB
-- =============================================

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

-- 관리자 액션 ENUM
-- 관리자 작업 로그: 웹 관리자 대시보드에서 수행된 작업 추적
CREATE TYPE admin_action_type AS ENUM (
    'user_suspended', 'user_activated', 'shop_approved', 'shop_rejected', 'shop_suspended',
    'refund_processed', 'points_adjusted', 'content_moderated', 'post_hidden', 
    'post_restored', 'user_promoted_influencer', 'reservation_force_completed', 'user_role_update'
);

-- 신고 관련 ENUM (업데이트됨)
-- 신고 사유: 컨텐츠 모더레이션을 위한 신고 카테고리
CREATE TYPE report_reason AS ENUM (
    'inappropriate_content', 'spam', 'fake_shop', 'harassment', 'illegal_services',
    'misleading_information', 'copyright_violation', 'other'
);

-- 신고 상태 ENUM
CREATE TYPE report_status AS ENUM (
    'pending', 'under_review', 'resolved', 'dismissed', 'escalated'
);

-- 연락처 방법 타입 ENUM
CREATE TYPE contact_method_type AS ENUM (
    'phone', 'email', 'kakaotalk_channel', 'kakaotalk_id', 'instagram',
    'facebook', 'youtube', 'naver_blog', 'tiktok', 'website',
    'whatsapp', 'telegram', 'discord', 'custom'
);

-- 연락처 방법 상태 ENUM
CREATE TYPE contact_method_status AS ENUM (
    'active', 'inactive', 'verified', 'pending_verification', 'suspended'
);

-- 모더레이션 룰 타입 ENUM
CREATE TYPE moderation_rule_type AS ENUM (
    'keyword_filter', 'image_content_filter', 'spam_detection', 'duplicate_content',
    'inappropriate_language', 'fake_shop_detection', 'copyright_violation',
    'custom_regex', 'ml_content_analysis', 'user_behavior_pattern'
);

-- 모더레이션 룰 액션 ENUM
CREATE TYPE moderation_rule_action AS ENUM (
    'flag_for_review', 'auto_reject', 'auto_approve', 'send_warning',
    'suspend_shop', 'send_notification', 'escalate_to_admin', 'log_incident', 'custom_action'
);

-- 모더레이션 룰 상태 ENUM
CREATE TYPE moderation_rule_status AS ENUM (
    'active', 'inactive', 'testing', 'deprecated'
);

-- 모더레이션 액션 타입 ENUM
CREATE TYPE moderation_action_type AS ENUM (
    'warning_issued', 'content_removed', 'shop_suspended', 'shop_terminated',
    'report_dismissed', 'no_action_required', 'escalated_to_admin',
    'contact_shop_owner', 'content_edited', 'other'
);

-- 피드 관련 ENUM (v3.2 신규)
-- 피드 게시물 상태: 콘텐츠 모더레이션을 위한 상태 관리
CREATE TYPE post_status AS ENUM ('active', 'hidden', 'reported', 'deleted');

-- 댓글 상태: 댓글 모더레이션 관리
CREATE TYPE comment_status AS ENUM ('active', 'hidden', 'deleted');